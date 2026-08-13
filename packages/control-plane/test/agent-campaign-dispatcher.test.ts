import { describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  AgentCampaignDispatcher,
  AgentCredentialBroker,
  AgentExecutionRegistry,
  buildAgentRun,
  completeAgentRun,
  buildAgentRunAnnotation,
  buildAgentTask,
  buildPausedAgentCampaign,
  pauseAgentCampaign,
  migrateAgentCampaignToEvolvingMembership,
  reviseAgentCampaignMembership,
  importLegacyAiRuntimeConfiguration,
  InProcessAgentRuntimeAdapter,
  SqliteOperationalStore,
  type AgentRuntimeOpenContext,
  type AgentTask,
  type AiRuntimeConfiguration,
} from "../src/index.js";

const START = "2026-08-10T14:00:00.000Z";

function clock() {
  let current = Date.parse(START);
  return Object.freeze({
    now: () => current,
    advance: (milliseconds: number) => { current += milliseconds; },
    iso: () => new Date(current).toISOString(),
  });
}

function configuration(): AiRuntimeConfiguration {
  return Object.freeze({
    schemaVersion: "pmh.ai-runtime-configuration.v2",
    revision: 1,
    provider: "CODEX",
    codexModel: "gpt-5.6-terra",
    codexReasoningEffort: "high",
    deepseekAutomationEnabled: false,
    updatedAt: START,
  });
}

function task(index: number): Readonly<{ task: AgentTask; payload: unknown }> {
  const payload = Object.freeze({ taskIndex: index });
  return Object.freeze({
    payload,
    task: buildAgentTask({
      kind: "RULE_EVIDENCE_CLAIM",
      protocol: "RULE_EVIDENCE_TASK_V1",
      inputArtifacts: [],
      taskPayload: payload,
      requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
      provenanceRef: `dispatcher-fixture:${index}`,
      priority: index,
      createdAt: START,
    }),
  });
}

function fixture(taskCount: number, budget?: Partial<{
  maximumConcurrentRuns: number;
  maximumModelInvocations: number;
  maximumInputTokens: string | null;
  maximumOutputTokens: string | null;
  maximumWallClockMs: number;
}>, schedule: { kind: "MANUAL_ONLY"; intervalMs: null } | {
  kind: "INTERVAL";
  intervalMs: number;
} = { kind: "MANUAL_ONLY", intervalMs: null }, taskRunPolicy?:
  "REPEATABLE" | "ONCE_PER_TASK_PER_LINEAGE") {
  const time = clock();
  const store = new SqliteOperationalStore(":memory:");
  const registry = new AgentExecutionRegistry(store);
  const imported = importLegacyAiRuntimeConfiguration(configuration());
  const tasks = Array.from({ length: taskCount }, (_, index) => task(index + 1));
  const paused = buildPausedAgentCampaign({
    campaignKey: "dispatcher-qualification",
    revision: 1,
    executionProfileId: imported.executionProfile.executionProfileId,
    taskIds: tasks.map((item) => item.task.taskId),
    schedule,
    budget: {
      maximumConcurrentRuns: 2,
      maximumModelInvocations: 2,
      maximumInputTokens: "1000",
      maximumOutputTokens: "1000",
      maximumWallClockMs: 60_000,
      ...budget,
    },
    ...(taskRunPolicy === undefined ? {} : {
      selectionBinding: {
        schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
        selectionProtocol: "DISPATCHER_QUALIFICATION_V1",
        selectionIdentity: imported.executionProfile.executionProfileId,
        selectionPolicyIdentity: imported.modelProfile.modelProfileId,
        taskBindings: tasks.map((item) => ({
          taskId: item.task.taskId,
          workFamilyRef: `dispatcher:${item.task.taskId}`,
          selectionActionRef: item.task.taskId,
          selectionActionKind: "DISPATCHER_TASK",
          inputRevisionKind: "FIXTURE",
          inputRevisionId: item.task.taskPayloadHash,
          exactInputHash: item.task.taskPayloadHash,
          semanticInputIdentity: item.task.taskPayloadHash,
        })).sort((left, right) => left.taskId.localeCompare(right.taskId)),
      },
      taskRunPolicy,
    }),
    createdAt: START,
  });
  registry.saveBatch({
    runtimeDefinitions: [imported.runtimeDefinition],
    credentialBindings: [imported.credentialBinding],
    modelProfiles: [imported.modelProfile],
    executionProfiles: [imported.executionProfile],
    tasks: tasks.map((item) => item.task),
    campaigns: [paused],
  });
  const payloads = new Map(tasks.map((item) => [item.task.taskId, item.payload] as const));
  const adapter = new InProcessAgentRuntimeAdapter(async (
    _context: AgentRuntimeOpenContext,
  ) => ({
    advance: async () => {
      const startedAt = time.iso();
      time.advance(10);
      return Object.freeze({
        invocation: Object.freeze({
          status: "SUCCEEDED" as const,
          startedAt,
          completedAt: time.iso(),
          inputTokens: "10",
          outputTokens: "2",
          reasoningTokens: "1",
          failureCategory: null,
        }),
        toolCalls: Object.freeze([]),
        completed: true,
        finalArtifact: Object.freeze({ qualified: true }),
      });
    },
  }));
  const credentialBroker = new AgentCredentialBroker([{
    resolverKind: "CODEX_AUTH_CACHE" as const,
    resolve: async () => Object.freeze({
      kind: "CODEX_OAUTH" as const,
      accessToken: "test-only-access",
      accountId: "test-account",
      expiresAt: "2026-08-10T15:00:00.000Z",
    }),
  }]);
  const dispatcher = new AgentCampaignDispatcher({
    registry,
    credentialBroker,
    adapters: [adapter],
    toolHost: {
      manifest: () => Object.freeze([]),
      execute: async () => Object.freeze({ status: "REJECTED" as const, output: {} }),
    },
    taskPayload: (work) => payloads.get(work.taskId),
    runAnnotations: (work, run) => Object.freeze([buildAgentRunAnnotation({
      run,
      category: "INPUT_REVISION_BINDING",
      sourceRecordRef: `fixture-revision:${work.taskId}`,
      observedFacts: payloads.get(work.taskId),
      note: "Fixture run is bound before runtime execution.",
      createdAt: run.createdAt,
    })]),
    now: time.now,
  });
  return { time, store, registry, tasks, payloads, paused, dispatcher };
}

describe("Agent campaign dispatcher", () => {
  it("requires explicit activation and obeys campaign concurrency and request budgets", async () => {
    const item = fixture(4);
    expect(() => item.dispatcher.dispatchCampaign(item.paused.campaignId))
      .toThrow(/Paused Agent campaign/);
    expect(item.registry.snapshot().runs).toHaveLength(0);

    item.time.advance(1_000);
    const active = activateAgentCampaign(item.paused, "operator:fixture", item.time.iso());
    item.registry.saveBatch({ campaigns: [active] });
    const dispatched = item.dispatcher.dispatchCampaign(active.campaignId);
    expect(dispatched.preparedRuns).toHaveLength(2);
    expect(dispatched.preview).toMatchObject({
      maximumImmediateFanout: 2,
      providerRequestsStarted: 0,
    });
    await Promise.all(dispatched.completions);

    expect(item.dispatcher.preview(active.campaignId)).toMatchObject({
      consumedModelInvocations: 2,
      remainingModelInvocations: 0,
      dispatchableTaskCount: 4,
      maximumImmediateFanout: 0,
    });
    expect(item.registry.snapshot()).toMatchObject({
      runs: [
        { status: "SUCCEEDED", authorization: { kind: "CAMPAIGN" } },
        { status: "SUCCEEDED", authorization: { kind: "CAMPAIGN" } },
      ],
      modelInvocations: [{ inputTokens: "10" }, { inputTokens: "10" }],
      runArtifacts: [{ kind: "RUNTIME_FINAL" }, { kind: "RUNTIME_FINAL" }],
      runAnnotations: [
        { category: "INPUT_REVISION_BINDING" },
        { category: "INPUT_REVISION_BINDING" },
      ],
    });
    expect(JSON.stringify(item.registry.snapshot())).not.toContain("test-only-access");
    item.store.close();
  });

  it("dispatches each manual-only campaign task at most once", async () => {
    const item = fixture(2, {
      maximumConcurrentRuns: 1,
      maximumModelInvocations: 4,
    }, { kind: "MANUAL_ONLY", intervalMs: null }, "ONCE_PER_TASK_PER_LINEAGE");
    item.time.advance(1_000);
    const active = activateAgentCampaign(item.paused, "operator:manual-once", item.time.iso());
    item.registry.saveBatch({ campaigns: [active] });

    const first = item.dispatcher.dispatchCampaign(active.campaignId);
    const firstTaskId = first.preparedRuns[0]!.taskId;
    expect(item.paused.taskIds).toContain(firstTaskId);
    await Promise.all(first.completions);
    expect(item.dispatcher.preview(active.campaignId)).toMatchObject({
      dispatchableTaskCount: 1,
      maximumImmediateFanout: 1,
    });

    const second = item.dispatcher.dispatchCampaign(active.campaignId);
    expect(second.preparedRuns[0]!.taskId).not.toBe(firstTaskId);
    expect(item.paused.taskIds).toContain(second.preparedRuns[0]!.taskId);
    await Promise.all(second.completions);
    expect(item.dispatcher.preview(active.campaignId)).toMatchObject({
      dispatchableTaskCount: 0,
      maximumImmediateFanout: 0,
    });
    expect(item.dispatcher.dispatchCampaign(active.campaignId).preparedRuns).toEqual([]);
    expect(item.registry.snapshot().runs.map((run) => run.runOrdinal)).toEqual([1, 1]);

    const pausedAgain = pauseAgentCampaign(active);
    item.registry.saveBatch({ campaigns: [pausedAgain] });
    const reactivated = activateAgentCampaign(
      pausedAgain,
      "operator:manual-once-reactivation",
      item.time.iso(),
    );
    item.registry.saveBatch({ campaigns: [reactivated] });
    expect(item.dispatcher.preview(reactivated.campaignId)).toMatchObject({
      dispatchableTaskCount: 0,
      consumedModelInvocations: 2,
      remainingModelInvocations: 2,
      maximumImmediateFanout: 0,
    });
    expect(item.dispatcher.dispatchCampaign(reactivated.campaignId).preparedRuns).toEqual([]);
    item.store.close();
  });

  it("treats an interrupted run as an attempted once-per-lineage task", () => {
    const item = fixture(2, {
      maximumConcurrentRuns: 1,
      maximumModelInvocations: 4,
    }, { kind: "MANUAL_ONLY", intervalMs: null }, "ONCE_PER_TASK_PER_LINEAGE");
    item.time.advance(1_000);
    const active = activateAgentCampaign(item.paused, "operator:interrupted-once", item.time.iso());
    item.registry.saveBatch({ campaigns: [active] });
    const attemptedTask = item.tasks[0]!.task;
    const profile = item.registry.snapshot().executionProfiles[0]!;
    const prepared = buildAgentRun({
      task: attemptedTask,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: item.time.iso() },
      createdAt: item.time.iso(),
    });
    item.time.advance(10);
    item.registry.saveBatch({ runs: [completeAgentRun(
      prepared, "INTERRUPTED", item.time.iso(), "model invocation timed_out",
    )] });

    expect(item.dispatcher.preview(active.campaignId)).toMatchObject({
      dispatchableTaskCount: 1,
      maximumImmediateFanout: 1,
    });
    const next = item.dispatcher.dispatchCampaign(active.campaignId);
    expect(next.preparedRuns).toHaveLength(1);
    expect(next.preparedRuns[0]!.taskId).not.toBe(attemptedTask.taskId);
    item.store.close();
  });

  it("preserves once-per-lineage attempts and consumed budget across membership revisions", async () => {
    const item = fixture(2, {
      maximumConcurrentRuns: 1,
      maximumModelInvocations: 2,
    }, { kind: "MANUAL_ONLY", intervalMs: null }, "ONCE_PER_TASK_PER_LINEAGE");
    item.time.advance(1_000);
    const active = activateAgentCampaign(item.paused, "operator:evolving", item.time.iso());
    item.registry.saveBatch({ campaigns: [active] });
    const first = item.dispatcher.dispatchCampaign(active.campaignId);
    await Promise.all(first.completions);
    const attemptedTaskId = first.preparedRuns[0]!.taskId;
    const newTask = task(3);
    item.registry.saveBatch({ tasks: [newTask.task] });
    item.payloads.set(newTask.task.taskId, newTask.payload);
    const evolving = migrateAgentCampaignToEvolvingMembership(active);
    const selection = evolving.selectionBinding;
    const currentUnattempted = item.tasks.find((entry) =>
      entry.task.taskId !== attemptedTaskId
    )!.task;
    const revisedSelection = {
      ...selection,
      selectionIdentity: newTask.task.taskId,
      taskBindings: [currentUnattempted, newTask.task].map((work) => ({
        taskId: work.taskId,
        workFamilyRef: `dispatcher:${work.taskId}`,
        selectionActionRef: work.taskId,
        selectionActionKind: "DISPATCHER_TASK",
        inputRevisionKind: "FIXTURE",
        inputRevisionId: work.taskPayloadHash,
        exactInputHash: work.taskPayloadHash,
        semanticInputIdentity: work.taskPayloadHash,
      })).sort((left, right) => left.taskId.localeCompare(right.taskId)),
    };
    const revised = reviseAgentCampaignMembership(evolving, revisedSelection);
    item.registry.saveBatch({ campaigns: [evolving, revised] });

    expect(item.dispatcher.preview(revised.campaignId)).toMatchObject({
      configuredTaskCount: 2,
      dispatchableTaskCount: 2,
      consumedModelInvocations: 1,
      remainingModelInvocations: 1,
      maximumImmediateFanout: 1,
    });
    const next = item.dispatcher.dispatchCampaign(revised.campaignId);
    await Promise.all(next.completions);
    expect(next.preparedRuns).toHaveLength(1);
    expect(next.preparedRuns[0]!.taskId).not.toBe(attemptedTaskId);
    expect(item.dispatcher.preview(revised.campaignId)).toMatchObject({
      consumedModelInvocations: 2,
      remainingModelInvocations: 0,
      maximumImmediateFanout: 0,
    });
    item.store.close();
  });

  it("interrupts durable prepared runs during startup recovery without inferring retry authority", () => {
    const item = fixture(1);
    item.time.advance(1_000);
    const active = activateAgentCampaign(item.paused, "operator:fixture", item.time.iso());
    item.registry.saveBatch({ campaigns: [active] });
    const work = item.tasks[0]!.task;
    const profile = item.registry.snapshot().executionProfiles[0]!;
    const prepared = buildAgentRun({
      task: work,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: item.time.iso() },
      createdAt: item.time.iso(),
    });
    item.registry.saveBatch({ runs: [prepared] });
    item.time.advance(1_000);
    expect(item.dispatcher.recoverPreparedRuns(item.time.iso())).toMatchObject([{
      runId: prepared.runId,
      status: "INTERRUPTED",
      terminalDiagnostic:
        "prepared run recovered after dispatcher restart; no retry authority inferred",
    }]);
    expect(item.dispatcher.recoverPreparedRuns(item.time.iso())).toEqual([]);
    item.store.close();
  });

  it("previews and attributes a manual run independently of campaign activation", async () => {
    const item = fixture(1);
    const work = item.tasks[0]!.task;
    const profile = item.registry.snapshot().executionProfiles[0]!;
    expect(item.dispatcher.previewManual(work.taskId, profile.executionProfileId)).toMatchObject({
      nextRunOrdinal: 1,
      maximumModelInvocations: 8,
      providerRequestsStarted: 0,
    });
    const dispatched = item.dispatcher.dispatchManual(
      work.taskId,
      profile.executionProfileId,
      "operator:manual-fixture",
    );
    expect(dispatched.run.authorization).toMatchObject({
      kind: "MANUAL",
      campaignId: null,
    });
    await expect(dispatched.completion).resolves.toMatchObject({ status: "SUCCEEDED" });
    expect(item.registry.snapshot().modelInvocations).toHaveLength(1);
    expect(item.registry.snapshot().runAnnotations).toMatchObject([{
      runId: dispatched.run.runId,
      category: "INPUT_REVISION_BINDING",
      sourceRecordRef: `fixture-revision:${work.taskId}`,
      createdAt: dispatched.run.createdAt,
    }]);
    item.store.close();
  });

  it("retains the bounded pre-runtime failure instead of hiding it", async () => {
    const item = fixture(1);
    const work = item.tasks[0]!.task;
    const profile = item.registry.snapshot().executionProfiles[0]!;
    const broken = new AgentCampaignDispatcher({
      registry: item.registry,
      credentialBroker: new AgentCredentialBroker([]),
      adapters: [new InProcessAgentRuntimeAdapter(async () => {
        throw new Error("fixture adapter must not open");
      })],
      toolHost: {
        manifest: () => Object.freeze([]),
        execute: async () => Object.freeze({ status: "REJECTED" as const, output: {} }),
      },
      taskPayload: () => {
        throw new Error("exact input revision disappeared");
      },
      now: item.time.now,
    });
    const dispatched = broken.dispatchManual(
      work.taskId,
      profile.executionProfileId,
      "operator:diagnostic-fixture",
    );
    await expect(dispatched.completion).resolves.toMatchObject({
      status: "FAILED",
      terminalDiagnostic:
        "campaign dispatcher failed before runtime completion: exact input revision disappeared",
    });
    item.store.close();
  });

  it("rejects a historical task before creating a run or opening an adapter", () => {
    const item = fixture(1);
    const work = item.tasks[0]!.task;
    const profile = item.registry.snapshot().executionProfiles[0]!;
    const dispatcher = new AgentCampaignDispatcher({
      registry: item.registry,
      credentialBroker: new AgentCredentialBroker([]),
      adapters: [],
      toolHost: {
        manifest: () => Object.freeze([]),
        execute: async () => Object.freeze({ status: "REJECTED" as const, output: {} }),
      },
      taskPayload: () => ({ unreachable: true }),
      taskReadiness: () => Object.freeze({
        status: "SUPERSEDED_INPUT" as const,
        diagnostic: "a current successor owns this input family",
        successorTaskId: work.taskId,
      }),
      now: item.time.now,
    });
    expect(() => dispatcher.previewManual(work.taskId, profile.executionProfileId))
      .toThrow(/SUPERSEDED_INPUT.*current successor/);
    expect(() => dispatcher.dispatchManual(
      work.taskId,
      profile.executionProfileId,
      "operator:must-not-run",
    )).toThrow(/SUPERSEDED_INPUT/);
    expect(item.registry.snapshot().runs).toHaveLength(0);
    expect(item.registry.snapshot().modelInvocations).toHaveLength(0);
    item.store.close();
  });

  it("dispatches only a due effective interval revision and stops after pause", async () => {
    const item = fixture(4, {
      maximumConcurrentRuns: 3,
      maximumModelInvocations: 3,
    }, { kind: "INTERVAL", intervalMs: 2_000 });
    item.time.advance(1_000);
    const active = activateAgentCampaign(item.paused, "operator:interval-fixture", item.time.iso());
    item.registry.saveBatch({ campaigns: [active] });
    expect(item.dispatcher.tick()).toEqual([]);
    item.time.advance(2_000);
    const [dispatch] = item.dispatcher.tick();
    expect(dispatch?.preparedRuns).toHaveLength(3);
    await Promise.all(dispatch!.completions);
    expect(item.registry.snapshot().modelInvocations).toHaveLength(3);

    const paused = pauseAgentCampaign(active);
    item.registry.saveBatch({ campaigns: [paused] });
    item.time.advance(2_000);
    expect(item.dispatcher.tick()).toEqual([]);
    expect(() => item.dispatcher.dispatchCampaign(active.campaignId))
      .toThrow(/superseded/);
    expect(item.registry.projection().activeCampaignCount).toBe(0);
    item.store.close();
  });
});
