import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  AgentExecutionRegistry,
  buildAgentRun,
  buildAgentRunAnnotation,
  buildAgentRunArtifact,
  buildExecutionCapabilityObservation,
  buildAgentTask,
  buildAgentToolEffect,
  buildModelInvocation,
  buildPausedAgentCampaign,
  buildResultSelection,
  buildWorkloadRoute,
  completeAgentRun,
  importLegacyAiRuntimeConfiguration,
  SqliteOperationalStore,
  type AiRuntimeConfiguration,
} from "../src/index.js";

const NOW = "2026-08-10T12:00:00.000Z";
const LATER = "2026-08-10T12:01:00.000Z";
const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pmh-agent-execution-"));
  tempDirectories.push(directory);
  return join(directory, "control-plane.sqlite");
}

function configuration(
  revision = 20,
  effort: AiRuntimeConfiguration["codexReasoningEffort"] = "high",
): AiRuntimeConfiguration {
  return {
    schemaVersion: "pmh.ai-runtime-configuration.v2",
    revision,
    provider: "CODEX",
    codexModel: "gpt-5.6-terra",
    codexReasoningEffort: effort,
    deepseekAutomationEnabled: false,
    updatedAt: revision === 20 ? NOW : LATER,
  };
}

function task(ordinal: number) {
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: [{
      kind: "EVIDENCE_REQUIREMENT",
      artifactId: `requirement:${ordinal}`,
      artifactHash: hashCanonical({ requirement: ordinal }),
    }],
    taskPayload: { requirementId: `requirement:${ordinal}` },
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: `requirement:${ordinal}`,
    priority: ordinal % 100,
    createdAt: NOW,
  });
}

describe("SQLite Agent execution substrate", () => {
  it("imports configuration durably without creating tasks, runs, campaigns, or invocations", async () => {
    const path = await databasePath();
    const first = new SqliteOperationalStore(path);
    const registry = new AgentExecutionRegistry(first);
    registry.importLegacyConfiguration(configuration());
    expect(registry.projection()).toMatchObject({
      runtimeDefinitionCount: 1,
      credentialBindingCount: 1,
      modelProfileCount: 1,
      executionProfileCount: 1,
      workloadRouteCount: 1,
      taskCount: 0,
      runCount: 0,
      modelInvocationCount: 0,
      activeCampaignCount: 0,
      automaticDispatchFromConfiguration: false,
      runArtifactCount: 0,
      runAnnotationCount: 0,
      storage: { schemaVersion: 64, durable: true },
    });
    first.close();

    const reopened = new SqliteOperationalStore(path);
    const replay = new AgentExecutionRegistry(reopened);
    expect(replay.projection()).toMatchObject(registry.projection());

    replay.importLegacyConfiguration(configuration(21, "max"));
    expect(replay.projection()).toMatchObject({
      runtimeDefinitionCount: 1,
      credentialBindingCount: 1,
      modelProfileCount: 2,
      executionProfileCount: 2,
      workloadRouteCount: 2,
      taskCount: 0,
      runCount: 0,
      modelInvocationCount: 0,
      activeCampaignCount: 0,
    });
    reopened.close();
  });

  it("persists an explicitly authorized task/run/invocation/effect/result lineage", async () => {
    const store = new SqliteOperationalStore(await databasePath());
    const imported = importLegacyAiRuntimeConfiguration(configuration());
    store.saveAgentExecutionBatch({
      runtimeDefinitions: [imported.runtimeDefinition],
      credentialBindings: [imported.credentialBinding],
      modelProfiles: [imported.modelProfile],
      executionProfiles: [imported.executionProfile],
      workloadRoutes: [imported.workloadRoute],
    });
    const work = task(1);
    const paused = buildPausedAgentCampaign({
      campaignKey: "rule-evidence-test",
      revision: 1,
      executionProfileId: imported.executionProfile.executionProfileId,
      taskIds: [work.taskId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      budget: {
        maximumConcurrentRuns: 1,
        maximumModelInvocations: 2,
        maximumInputTokens: "10000",
        maximumOutputTokens: "1000",
        maximumWallClockMs: 300_000,
      },
      selectionBinding: {
        schemaVersion: "pmh.agent-campaign-selection-binding.v1",
        selectionProtocol: "RULE_EVIDENCE_SELECTION_FIXTURE_V1",
        selectionIdentity: hashCanonical({ selection: "fixture" }),
        selectionPolicyIdentity: hashCanonical({ policy: "fixture" }),
        taskBindings: [{
          taskId: work.taskId,
          workFamilyRef: "requirement:1",
          selectionActionRef: hashCanonical({ action: "fixture" }),
          selectionActionKind: "CAPTURE_RULE_EVIDENCE",
          inputRevisionKind: "EVIDENCE_REQUIREMENT",
          inputRevisionId: hashCanonical({ revision: "fixture" }),
          exactInputHash: hashCanonical({ requirementId: "requirement:1" }),
          semanticInputIdentity: hashCanonical({ semanticInput: "fixture" }),
        }],
      },
      createdAt: NOW,
    });
    const active = activateAgentCampaign(paused, "operator:test", LATER);
    const run = buildAgentRun({
      task: work,
      executionProfile: imported.executionProfile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: LATER },
      createdAt: LATER,
    });
    const invocation = buildModelInvocation({
      purpose: "PRIMARY_REASONING",
      run,
      modelProfile: imported.modelProfile,
      ordinal: 1,
      status: "SUCCEEDED",
      startedAt: LATER,
      completedAt: "2026-08-10T12:01:03.000Z",
      inputTokens: "1234",
      outputTokens: "56",
      reasoningTokens: "12",
    });
    const effect = buildAgentToolEffect({
      run,
      ordinal: 1,
      toolProtocol: imported.executionProfile.toolPolicy.protocol,
      toolName: "submit_rule_evidence_claim",
      status: "ACCEPTED",
      canonicalInput: { disposition: "SUPPORTS" },
      canonicalOutput: { accepted: true },
      sourceInvocation: invocation,
      occurredAt: "2026-08-10T12:01:03.000Z",
    });
    store.saveAgentExecutionBatch({
      tasks: [work],
      campaigns: [paused, active],
      runs: [run],
      modelInvocations: [invocation],
      toolEffects: [effect],
    });

    const completed = completeAgentRun(
      run,
      "SUCCEEDED",
      "2026-08-10T12:01:04.000Z",
      null,
    );
    const artifactContentHash = hashCanonical({ claim: "fixture" });
    const artifact = buildAgentRunArtifact({
      run: completed,
      ordinal: 1,
      kind: "RUNTIME_FINAL",
      contentHash: artifactContentHash,
      createdAt: "2026-08-10T12:01:04.000Z",
    });
    const annotation = buildAgentRunAnnotation({
      run: completed,
      category: "QUALIFICATION_FIXTURE",
      sourceRecordRef: "fixture:agent-execution-store",
      observedFacts: { invocationId: invocation.invocationId },
      note: "Fixture annotation proves append-only run context survives restart.",
      createdAt: "2026-08-10T12:01:04.000Z",
    });
    const selection = buildResultSelection({
      task: work,
      run: completed,
      artifactHash: artifactContentHash,
      rationale: "First-party fixture qualification passed.",
      selectedAt: "2026-08-10T12:01:05.000Z",
      selectionAuthorityRef: "operator:test",
    });
    store.saveAgentExecutionBatch({
      runs: [completed],
      runArtifacts: [artifact],
      runAnnotations: [annotation],
      resultSelections: [selection],
    });

    const snapshot = store.loadAgentExecutionSnapshot();
    expect(snapshot).toMatchObject({
      tasks: [{ taskId: work.taskId }],
      runs: [{ runId: run.runId, status: "SUCCEEDED" }],
      modelInvocations: [{
        invocationId: invocation.invocationId,
        runId: run.runId,
        inputTokens: "1234",
      }],
      toolEffects: [{
        effectId: effect.effectId,
        status: "ACCEPTED",
        schemaVersion: "pmh.agent-tool-effect.v3",
        sourceInvocationId: invocation.invocationId,
      }],
      runArtifacts: [{ artifactId: artifact.artifactId, contentHash: artifactContentHash }],
      runAnnotations: [{ annotationId: annotation.annotationId }],
      resultSelections: [{ selectionId: selection.selectionId }],
    });
    expect(snapshot.campaigns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        campaignId: paused.campaignId,
        schemaVersion: "pmh.agent-campaign.v2",
        status: "PAUSED",
      }),
      expect.objectContaining({
        campaignId: active.campaignId,
        schemaVersion: "pmh.agent-campaign.v2",
        status: "ACTIVE",
        selectionBinding: paused.selectionBinding,
      }),
    ]));
    expect(JSON.stringify(snapshot)).not.toContain("test-only-secret-value");
    const danglingEffect = buildAgentToolEffect({
      run,
      ordinal: 2,
      toolProtocol: imported.executionProfile.toolPolicy.protocol,
      toolName: "submit_rule_evidence_claim",
      status: "ACCEPTED",
      canonicalInput: { disposition: "SUPPORTS", duplicate: true },
      canonicalOutput: { accepted: true },
      sourceInvocation: buildModelInvocation({
        purpose: "PRIMARY_REASONING",
        run,
        modelProfile: imported.modelProfile,
        ordinal: 2,
        status: "SUCCEEDED",
        startedAt: "2026-08-10T12:01:03.000Z",
        completedAt: "2026-08-10T12:01:03.500Z",
        inputTokens: "1",
        outputTokens: "1",
        reasoningTokens: "0",
      }),
      occurredAt: "2026-08-10T12:01:03.500Z",
    });
    expect(() => store.saveAgentExecutionBatch({ toolEffects: [danglingEffect] }))
      .toThrow(/source invocation/iu);
    store.close();
  });

  it("persists execution capability observations across restart without secret material", async () => {
    const path = await databasePath();
    const first = new SqliteOperationalStore(path);
    const imported = importLegacyAiRuntimeConfiguration(configuration());
    first.saveAgentExecutionBatch({
      runtimeDefinitions: [imported.runtimeDefinition],
      credentialBindings: [imported.credentialBinding],
      modelProfiles: [imported.modelProfile],
      executionProfiles: [imported.executionProfile],
    });
    const observation = buildExecutionCapabilityObservation({
      executionProfile: imported.executionProfile,
      outcome: "AUTH_REJECTED",
      probeKind: "CODEX_USAGE",
      observedAt: NOW,
      validUntil: LATER,
      diagnostic: "CODEX/CODEX_RESPONSES rejected the non-inference probe (HTTP 403)",
    });
    first.saveAgentExecutionBatch({ capabilityObservations: [observation] });
    first.close();

    const reopened = new SqliteOperationalStore(path);
    expect(reopened.loadAgentExecutionSnapshot().capabilityObservations).toEqual([observation]);
    expect(JSON.stringify(observation)).not.toContain("Bearer");
    reopened.close();
  });

  it("replays bounded v2 invocation diagnostics while preserving historical v1 compatibility", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    const imported = importLegacyAiRuntimeConfiguration(configuration());
    const work = task(85);
    const run = buildAgentRun({
      task: work,
      executionProfile: imported.executionProfile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:diagnostic-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const invocation = buildModelInvocation({
      purpose: "PRIMARY_REASONING",
      run,
      modelProfile: imported.modelProfile,
      ordinal: 1,
      status: "FAILED",
      startedAt: NOW,
      completedAt: LATER,
      failureCategory: "CODEX_CLI_EXIT",
      diagnostic: "exitCode=23; timedOut=false; stderr=\"model is unavailable\"",
    });
    store.saveAgentExecutionBatch({
      runtimeDefinitions: [imported.runtimeDefinition],
      credentialBindings: [imported.credentialBinding],
      modelProfiles: [imported.modelProfile],
      executionProfiles: [imported.executionProfile],
      workloadRoutes: [imported.workloadRoute],
      tasks: [work],
      runs: [run],
      modelInvocations: [invocation],
    });
    store.close();

    const reopened = new SqliteOperationalStore(path);
    expect(reopened.loadAgentExecutionSnapshot().modelInvocations).toEqual([
      expect.objectContaining({
        schemaVersion: "pmh.model-invocation.v3",
        invocationId: invocation.invocationId,
        purpose: "PRIMARY_REASONING",
        diagnostic: "exitCode=23; timedOut=false; stderr=\"model is unavailable\"",
      }),
    ]);
    reopened.close();
  });

  it("rejects dangling routes atomically", async () => {
    const store = new SqliteOperationalStore(await databasePath());
    const route = buildWorkloadRoute({
      routeKey: "dangling",
      revision: 1,
      taskKind: "DISCOVERY_SCOUT",
      executionProfileId: hashCanonical({ missing: "profile" }),
      updatedAt: NOW,
    });
    expect(() => store.saveAgentExecutionBatch({ workloadRoutes: [route] }))
      .toThrow(/unavailable execution profile/);
    expect(store.loadAgentExecutionSnapshot()).toEqual({
      runtimeDefinitions: [],
      credentialBindings: [],
      modelProfiles: [],
      executionProfiles: [],
      capabilityObservations: [],
      workloadRoutes: [],
      tasks: [],
      runs: [],
      modelInvocations: [],
      toolEffects: [],
      runArtifacts: [],
      runAnnotations: [],
      campaigns: [],
      resultSelections: [],
    });
    store.close();
  });

  it("persists 506 provider-neutral tasks in one bounded batch", async () => {
    const store = new SqliteOperationalStore(await databasePath());
    const tasks = Array.from({ length: 506 }, (_, index) => task(index + 1));
    const startedAt = performance.now();
    store.saveAgentExecutionBatch({ tasks });
    const durationMs = performance.now() - startedAt;
    expect(store.loadAgentExecutionSnapshot().tasks).toHaveLength(506);
    expect(durationMs).toBeLessThan(1_000);
    store.close();
  });
});
