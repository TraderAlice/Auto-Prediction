import { describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  AgentCampaignDispatcher,
  AgentCredentialBroker,
  AgentExecutionRegistry,
  buildAgentRun,
  buildAgentTask,
  buildPausedAgentCampaign,
  pauseAgentCampaign,
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
} = { kind: "MANUAL_ONLY", intervalMs: null }) {
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
    now: time.now,
  });
  return { time, store, registry, tasks, paused, dispatcher };
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
      maximumImmediateFanout: 0,
    });
    expect(item.registry.snapshot()).toMatchObject({
      runs: [
        { status: "SUCCEEDED", authorization: { kind: "CAMPAIGN" } },
        { status: "SUCCEEDED", authorization: { kind: "CAMPAIGN" } },
      ],
      modelInvocations: [{ inputTokens: "10" }, { inputTokens: "10" }],
      runArtifacts: [{ kind: "RUNTIME_FINAL" }, { kind: "RUNTIME_FINAL" }],
    });
    expect(JSON.stringify(item.registry.snapshot())).not.toContain("test-only-access");
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
