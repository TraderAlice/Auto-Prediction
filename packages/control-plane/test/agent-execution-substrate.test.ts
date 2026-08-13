import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  AgentExecutionRegistry,
  assertExecutionProfileCompatibility,
  buildAgentRun,
  buildAgentCampaignMembershipPolicyBinding,
  buildAgentRuntimeDefinition,
  buildAgentTask,
  buildAgentToolEffect,
  buildCredentialBinding,
  buildExecutionProfile,
  buildModelProfile,
  buildPausedAgentCampaign,
  buildWorkloadRoute,
  importLegacyAiRuntimeConfiguration,
  migrateAgentCampaignToEvolvingMembership,
  migrateAgentCampaignToOncePerTaskLineage,
  reviseAgentCampaignMembership,
  type AiRuntimeConfiguration,
  type CodexModelConfiguration,
  type ExecutionProfile,
  type AgentExecutionStore,
} from "../src/index.js";

const NOW = "2026-08-10T12:00:00.000Z";
const LATER = "2026-08-10T12:01:00.000Z";

function runtime(kind: "PI" | "CODEX" | "HARNESS_IN_PROCESS") {
  return buildAgentRuntimeDefinition({ kind, version: `${kind.toLowerCase()}-test-v1` });
}

function codexCredential(account = "codex-oauth:test") {
  return buildCredentialBinding({
    kind: "CODEX_OAUTH",
    logicalAccountRef: account,
    resolverKind: "CODEX_AUTH_CACHE",
    resolverRef: "codex-auth-cache:test",
  });
}

function deepSeekCredential() {
  return buildCredentialBinding({
    kind: "DEEPSEEK_API_KEY",
    logicalAccountRef: "deepseek-api-key:test",
    resolverKind: "ENVIRONMENT",
    resolverRef: "env:DEEPSEEK_API_KEY",
  });
}

function codexModel(effort: CodexModelConfiguration["reasoning"]["effort"] = "high") {
  return buildModelProfile({
    profileKey: "codex-terra-test",
    revision: effort === "high" ? 1 : 2,
    accessDriver: "CODEX_RESPONSES",
    model: "gpt-5.6-terra",
    configuration: {
      schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort },
      responseStorage: false,
    },
    createdAt: effort === "high" ? NOW : LATER,
  });
}

function deepSeekModel() {
  return buildModelProfile({
    profileKey: "deepseek-flash-test",
    revision: 1,
    accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
    model: "deepseek-v4-flash",
    configuration: {
      schemaVersion: "pmh.deepseek-flash-model-configuration.v1",
      thinking: { mode: "disabled" },
      responseStorage: false,
    },
    createdAt: NOW,
  });
}

function executionProfile(input: Readonly<{
  runtimeKind?: "PI" | "CODEX" | "HARNESS_IN_PROCESS";
  effort?: CodexModelConfiguration["reasoning"]["effort"];
  revision?: number;
}> = {}): ExecutionProfile {
  return buildExecutionProfile({
    profileKey: "rule-evidence-test",
    revision: input.revision ?? 1,
    runtimeDefinition: runtime(input.runtimeKind ?? "HARNESS_IN_PROCESS"),
    credentialBinding: codexCredential(),
    modelProfile: codexModel(input.effort),
    toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 8,
      maximumToolCalls: 24,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "100000",
      maximumOutputTokens: "10000",
    },
    createdAt: NOW,
  });
}

function task(priority = 10, provenanceRef = "evidence-requirement:test") {
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: [{
      kind: "EVIDENCE_REQUIREMENT",
      artifactId: "requirement:test",
      artifactHash: hashCanonical({ requirement: "test" }),
    }],
    taskPayload: { requirementId: "requirement:test", documentId: "document:test" },
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef,
    priority,
    createdAt: NOW,
  });
}

describe("Agent execution substrate", () => {
  it("does not persist a batch whose durable identities and content are unchanged", () => {
    const retainedTask = task();
    const snapshot = {
      runtimeDefinitions: Object.freeze([]),
      credentialBindings: Object.freeze([]),
      modelProfiles: Object.freeze([]),
      executionProfiles: Object.freeze([]),
      capabilityObservations: Object.freeze([]),
      workloadRoutes: Object.freeze([]),
      tasks: Object.freeze([retainedTask]),
      runs: Object.freeze([]),
      modelInvocations: Object.freeze([]),
      toolEffects: Object.freeze([]),
      runArtifacts: Object.freeze([]),
      runAnnotations: Object.freeze([]),
      campaigns: Object.freeze([]),
      resultSelections: Object.freeze([]),
    };
    let writes = 0;
    const store: AgentExecutionStore = {
      agentExecutionStorage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 54,
        idempotencyKey: "recordId",
      },
      loadAgentExecutionSnapshot: () => snapshot,
      saveAgentExecutionBatch: () => { writes += 1; },
    };
    const registry = new AgentExecutionRegistry(store);
    expect(registry.saveBatch({ tasks: [retainedTask] })).toBe(snapshot);
    expect(writes).toBe(0);
  });

  it("uses the additive store path for a task-only batch", () => {
    const snapshot = {
      runtimeDefinitions: Object.freeze([]), credentialBindings: Object.freeze([]),
      modelProfiles: Object.freeze([]), executionProfiles: Object.freeze([]),
      capabilityObservations: Object.freeze([]), workloadRoutes: Object.freeze([]),
      tasks: Object.freeze([]), runs: Object.freeze([]),
      modelInvocations: Object.freeze([]), toolEffects: Object.freeze([]),
      runArtifacts: Object.freeze([]), runAnnotations: Object.freeze([]),
      campaigns: Object.freeze([]), resultSelections: Object.freeze([]),
    };
    const retainedTask = task();
    let fullWrites = 0;
    let additiveWrites = 0;
    const store: AgentExecutionStore = {
      agentExecutionStorage: {
        mode: "MEMORY", durable: false, schemaVersion: 54, idempotencyKey: "recordId",
      },
      loadAgentExecutionSnapshot: () => snapshot,
      saveAgentExecutionBatch: () => { fullWrites += 1; },
      saveAgentTaskAdditions: (tasks) => {
        additiveWrites += 1;
        expect(tasks).toEqual([retainedTask]);
      },
    };
    const registry = new AgentExecutionRegistry(store);
    expect(registry.saveBatch({ tasks: [retainedTask] }).tasks).toEqual([retainedTask]);
    expect({ fullWrites, additiveWrites }).toEqual({ fullWrites: 0, additiveWrites: 1 });
  });

  it("keeps the full store path for mutable task metadata", () => {
    const retainedTask = task();
    const changedTask = task(11, "evidence-requirement:successor");
    const snapshot = {
      runtimeDefinitions: Object.freeze([]), credentialBindings: Object.freeze([]),
      modelProfiles: Object.freeze([]), executionProfiles: Object.freeze([]),
      capabilityObservations: Object.freeze([]), workloadRoutes: Object.freeze([]),
      tasks: Object.freeze([retainedTask]), runs: Object.freeze([]),
      modelInvocations: Object.freeze([]), toolEffects: Object.freeze([]),
      runArtifacts: Object.freeze([]), runAnnotations: Object.freeze([]),
      campaigns: Object.freeze([]), resultSelections: Object.freeze([]),
    };
    let fullWrites = 0;
    let additiveWrites = 0;
    const updatedSnapshot = { ...snapshot, tasks: Object.freeze([changedTask]) };
    const store: AgentExecutionStore = {
      agentExecutionStorage: {
        mode: "MEMORY", durable: false, schemaVersion: 54, idempotencyKey: "recordId",
      },
      loadAgentExecutionSnapshot: () => fullWrites === 0 ? snapshot : updatedSnapshot,
      saveAgentExecutionBatch: (batch) => {
        fullWrites += 1;
        expect(batch.tasks).toEqual([changedTask]);
      },
      saveAgentTaskAdditions: () => { additiveWrites += 1; },
    };
    const registry = new AgentExecutionRegistry(store);
    expect(registry.saveBatch({ tasks: [changedTask] }).tasks).toEqual([changedTask]);
    expect({ fullWrites, additiveWrites }).toEqual({ fullWrites: 1, additiveWrites: 0 });
  });

  it("imports the flat Codex setting as an in-process model route with zero dispatch", () => {
    const configuration: AiRuntimeConfiguration = {
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 20,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: NOW,
    };
    const imported = importLegacyAiRuntimeConfiguration(configuration);

    expect(imported.runtimeDefinition.kind).toBe("HARNESS_IN_PROCESS");
    expect(imported.credentialBinding.kind).toBe("CODEX_OAUTH");
    expect(imported.modelProfile).toMatchObject({
      accessDriver: "CODEX_RESPONSES",
      model: "gpt-5.6-terra",
      configuration: { reasoning: { effort: "high" }, responseStorage: false },
    });
    expect(imported.workloadRoute).toMatchObject({
      taskKind: "DISCOVERY_SCOUT",
      automaticDispatch: false,
    });
    expect(imported).toMatchObject({
      activeCampaignsCreated: 0,
      tasksCreated: 0,
      runsCreated: 0,
      modelInvocationsCreated: 0,
    });
    expect(JSON.stringify(imported)).not.toMatch(/bearer|api[-_]?key|refresh[-_]?token/iu);
  });

  it("keeps task identity stable across priority, provenance, runtime, model effort, and credentials", () => {
    const original = task(10, "evidence-requirement:one");
    const reprioritized = task(500, "evidence-requirement:recovered");
    const high = executionProfile({ runtimeKind: "PI", effort: "high", revision: 1 });
    const maximum = executionProfile({ runtimeKind: "CODEX", effort: "max", revision: 2 });

    expect(reprioritized.taskId).toBe(original.taskId);
    expect(maximum.executionProfileId).not.toBe(high.executionProfileId);
    expect(codexCredential("codex-oauth:other").credentialBindingId)
      .not.toBe(codexCredential().credentialBindingId);
    expect(original.taskId).toBe(reprioritized.taskId);
  });

  it("makes effort part of the selected model profile instead of a global setting", () => {
    const high = codexModel("high");
    const maximum = codexModel("max");
    expect(high.modelProfileId).not.toBe(maximum.modelProfileId);
    expect(high.configuration).toEqual({
      schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort: "high" },
      responseStorage: false,
    });
    expect(() => buildModelProfile({
      profileKey: "invalid-deepseek-effort",
      revision: 1,
      accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
      model: "deepseek-v4-flash",
      configuration: {
        schemaVersion: "pmh.codex-model-configuration.v1",
        reasoning: { effort: "high" },
        responseStorage: false,
      },
      createdAt: NOW,
    })).toThrow(/DeepSeek model configuration/);
    expect(() => buildModelProfile({
      profileKey: "invalid-codex-model",
      revision: 1,
      accessDriver: "CODEX_RESPONSES",
      model: "deepseek-v4-flash",
      configuration: {
        schemaVersion: "pmh.codex-model-configuration.v1",
        reasoning: { effort: "high" },
        responseStorage: false,
      },
      createdAt: NOW,
    })).toThrow(/Codex model configuration/);
  });

  it("validates runtime, credential, and model compatibility without assuming a Cartesian product", () => {
    expect(() => assertExecutionProfileCompatibility(
      runtime("PI"),
      codexCredential(),
      codexModel(),
    )).not.toThrow();
    expect(() => assertExecutionProfileCompatibility(
      runtime("HARNESS_IN_PROCESS"),
      deepSeekCredential(),
      deepSeekModel(),
    )).not.toThrow();
    expect(() => assertExecutionProfileCompatibility(
      runtime("CODEX"),
      deepSeekCredential(),
      deepSeekModel(),
    )).toThrow(/does not support/);
    expect(() => assertExecutionProfileCompatibility(
      runtime("PI"),
      deepSeekCredential(),
      codexModel(),
    )).toThrow(/Credential binding is incompatible/);
  });

  it("treats routes as configuration and campaigns as explicit spend authority", () => {
    const work = task();
    const profile = executionProfile();
    const route = buildWorkloadRoute({
      routeKey: "rule-evidence-default",
      revision: 1,
      taskKind: work.kind,
      executionProfileId: profile.executionProfileId,
      updatedAt: NOW,
    });
    const paused = buildPausedAgentCampaign({
      campaignKey: "rule-evidence-one-shot",
      revision: 1,
      executionProfileId: profile.executionProfileId,
      taskIds: [work.taskId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      budget: {
        maximumConcurrentRuns: 1,
        maximumModelInvocations: 8,
        maximumInputTokens: "100000",
        maximumOutputTokens: "10000",
        maximumWallClockMs: 300_000,
      },
      createdAt: NOW,
    });

    expect(route.automaticDispatch).toBe(false);
    expect(() => buildAgentRun({
      task: work,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: paused, authorizedAt: NOW },
      createdAt: NOW,
    })).toThrow(/Paused campaign/);

    const active = activateAgentCampaign(paused, "operator:explicit-test", LATER);
    const run = buildAgentRun({
      task: work,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: LATER },
      createdAt: LATER,
    });
    expect(run).toMatchObject({
      taskId: work.taskId,
      executionProfileId: profile.executionProfileId,
      status: "PREPARED",
      authorization: { kind: "CAMPAIGN", campaignId: active.campaignId },
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
  });

  it("revises exact campaign membership without changing research authority", () => {
    const first = task(10, "evidence-requirement:one");
    const successor = buildAgentTask({
      kind: first.kind,
      protocol: first.protocol,
      inputArtifacts: first.inputArtifacts,
      taskPayload: { requirementId: "requirement:test", documentId: "document:changed" },
      requestedEffectProtocol: first.requestedEffectProtocol,
      provenanceRef: first.provenanceRef,
      priority: first.priority,
      createdAt: LATER,
    });
    const profile = executionProfile();
    const selection = (selected: typeof first, identity: ReturnType<typeof hashCanonical>) => ({
      schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
      selectionProtocol: "RULE_EVIDENCE_SELECTION_V1",
      selectionIdentity: identity,
      selectionPolicyIdentity: hashCanonical({ policy: "rule-evidence-v1" }),
      taskBindings: [{
        taskId: selected.taskId,
        workFamilyRef: "evidence-requirement:test",
        selectionActionRef: hashCanonical({ selected: selected.taskId }),
        selectionActionKind: "RULE_EVIDENCE",
        inputRevisionKind: "RULE_DOCUMENT",
        inputRevisionId: selected.taskPayloadHash,
        exactInputHash: selected.taskPayloadHash,
        semanticInputIdentity: selected.taskPayloadHash,
      }],
    });
    const originalSelection = selection(first, hashCanonical({ selection: 1 }));
    const paused = buildPausedAgentCampaign({
      campaignKey: "evolving-rule-evidence",
      revision: 1,
      executionProfileId: profile.executionProfileId,
      taskIds: [first.taskId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      budget: {
        maximumConcurrentRuns: 1,
        maximumModelInvocations: 8,
        maximumInputTokens: "100000",
        maximumOutputTokens: "10000",
        maximumWallClockMs: 300_000,
      },
      selectionBinding: originalSelection,
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      createdAt: NOW,
    });
    const active = activateAgentCampaign(paused, "operator:evolving", LATER);
    const evolving = migrateAgentCampaignToEvolvingMembership(active);
    const revised = reviseAgentCampaignMembership(
      evolving,
      selection(successor, hashCanonical({ selection: 2 })),
    );

    expect(revised).toMatchObject({
      schemaVersion: "pmh.agent-campaign.v4",
      campaignKey: active.campaignKey,
      revision: evolving.revision + 1,
      status: "ACTIVE",
      activationRef: active.activationRef,
      executionProfileId: active.executionProfileId,
      budget: active.budget,
      taskIds: [successor.taskId],
      membershipPolicyBinding: buildAgentCampaignMembershipPolicyBinding(originalSelection),
    });
    expect(() => reviseAgentCampaignMembership(evolving, {
      ...selection(successor, hashCanonical({ selection: 3 })),
      selectionPolicyIdentity: hashCanonical({ policy: "expanded" }),
    })).toThrow(/cannot change research policy/);
  });

  it("upgrades a selection-bound campaign to once-per-lineage without changing authority", () => {
    const work = task(11, "mechanism:one");
    const profile = executionProfile();
    const selectionBinding = {
      schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
      selectionProtocol: "WORLD_STATE_MECHANISM_RESEARCH_SELECTION_V1",
      selectionIdentity: hashCanonical({ selection: "mechanism" }),
      selectionPolicyIdentity: hashCanonical({ policy: "mechanism-v1" }),
      taskBindings: [{
        taskId: work.taskId,
        workFamilyRef: "world-state-mechanism-issue:fixture",
        selectionActionRef: hashCanonical({ action: work.taskId }),
        selectionActionKind: "RESEARCH_WORLD_STATE_MECHANISM",
        inputRevisionKind: "ONTOLOGY_SEARCH_ISSUE",
        inputRevisionId: work.taskPayloadHash,
        exactInputHash: work.taskPayloadHash,
        semanticInputIdentity: work.taskPayloadHash,
      }],
    };
    const legacy = buildPausedAgentCampaign({
      campaignKey: "mechanism-frozen-specimen",
      revision: 5,
      executionProfileId: profile.executionProfileId,
      taskIds: [work.taskId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      budget: {
        maximumConcurrentRuns: 1,
        maximumModelInvocations: 8,
        maximumInputTokens: "200000",
        maximumOutputTokens: "20000",
        maximumWallClockMs: 900_000,
      },
      selectionBinding,
      createdAt: NOW,
    });

    const upgraded = migrateAgentCampaignToOncePerTaskLineage(legacy);
    expect(upgraded).toMatchObject({
      schemaVersion: "pmh.agent-campaign.v3",
      revision: 6,
      status: "PAUSED",
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      selectionBinding,
      budget: legacy.budget,
      schedule: legacy.schedule,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(migrateAgentCampaignToOncePerTaskLineage(upgraded)).toBe(upgraded);
  });

  it("records only first-party bounded tool effects", () => {
    const work = task();
    const profile = executionProfile();
    const run = buildAgentRun({
      task: work,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const effect = buildAgentToolEffect({
      run,
      ordinal: 1,
      toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
      toolName: "submit_rule_evidence_claim",
      status: "ACCEPTED",
      canonicalInput: { disposition: "INCONCLUSIVE" },
      canonicalOutput: { accepted: true },
      occurredAt: NOW,
    });
    expect(effect).toMatchObject({
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(effect.effectId).toBe(hashCanonical({
      runId: run.runId,
      ordinal: 1,
      toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
      canonicalInputHash: hashCanonical({ disposition: "INCONCLUSIVE" }),
    }));
  });

  it("keeps legacy configuration import idempotent in the in-memory registry", () => {
    const registry = new AgentExecutionRegistry();
    const configuration: AiRuntimeConfiguration = {
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 20,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: NOW,
    };
    registry.importLegacyConfiguration(configuration);
    registry.importLegacyConfiguration(configuration);
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
    });
  });
});
