import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertModelInvocation,
  buildAgentResultRepairProjection,
  buildAgentRun,
  buildAgentRunArtifact,
  buildAgentTask,
  buildAgentToolEffect,
  buildModelInvocation,
  completeAgentRun,
  importLegacyAiRuntimeConfiguration,
  type AgentExecutionSnapshot,
} from "../src/index.js";

const START = "2026-08-13T02:00:00.000Z";

function fixture() {
  const imported = importLegacyAiRuntimeConfiguration({
    schemaVersion: "pmh.ai-runtime-configuration.v2",
    revision: 1,
    provider: "CODEX",
    codexModel: "gpt-5.6-terra",
    codexReasoningEffort: "high",
    deepseekAutomationEnabled: false,
    updatedAt: START,
  });
  const task = buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: [{
      kind: "EVIDENCE_REQUIREMENT",
      artifactId: "requirement:repair",
      artifactHash: hashCanonical({ requirement: "repair" }),
    }],
    taskPayload: { requirementId: "requirement:repair" },
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: "requirement:repair",
    priority: 1,
    createdAt: START,
  });
  const run = (ordinal: number) => buildAgentRun({
    task,
    executionProfile: imported.executionProfile,
    runOrdinal: ordinal,
    authorization: {
      kind: "MANUAL",
      authorizationRef: "operator:repair-test",
      authorizedAt: START,
    },
    createdAt: START,
  });
  return { imported, task, run } as const;
}

describe("Agent result repair observability", () => {
  it("attributes accepted and budget-terminated repairs without guessing historical purpose", () => {
    const work = fixture();
    const success = work.run(1);
    const rejectedSuccess = buildAgentToolEffect({
      run: success,
      ordinal: 1,
      toolProtocol: work.imported.executionProfile.toolPolicy.protocol,
      toolName: "submit_rule_evidence_claim",
      status: "REJECTED",
      canonicalInput: { listingRefs: ["one"] },
      canonicalOutput: { diagnostic: "listingRefs requires between 2 and 8 items" },
      diagnostic: "listingRefs requires between 2 and 8 items",
      occurredAt: "2026-08-13T02:00:01.000Z",
    });
    const acceptedSuccess = buildAgentToolEffect({
      run: success,
      ordinal: 2,
      toolProtocol: work.imported.executionProfile.toolPolicy.protocol,
      toolName: "submit_rule_evidence_claim",
      status: "ACCEPTED",
      canonicalInput: { listingRefs: ["one", "two"] },
      canonicalOutput: { accepted: true },
      diagnostic: null,
      occurredAt: "2026-08-13T02:00:04.000Z",
    });
    const successInvocations = [
      buildModelInvocation({
        run: success, modelProfile: work.imported.modelProfile, ordinal: 1,
        status: "SUCCEEDED", startedAt: START,
        completedAt: "2026-08-13T02:00:01.000Z", inputTokens: "40",
        outputTokens: "4", reasoningTokens: "2", purpose: "PRIMARY_REASONING",
      }),
      buildModelInvocation({
        run: success, modelProfile: work.imported.modelProfile, ordinal: 2,
        status: "SUCCEEDED", startedAt: "2026-08-13T02:00:01.000Z",
        completedAt: "2026-08-13T02:00:02.000Z", inputTokens: "100",
        outputTokens: "10", reasoningTokens: "5", purpose: "RESULT_REPAIR",
        repairContext: {
          attemptOrdinal: 1,
          rejectedResultEffectIds: [rejectedSuccess.effectId],
        },
      }),
      buildModelInvocation({
        run: success, modelProfile: work.imported.modelProfile, ordinal: 3,
        status: "SUCCEEDED", startedAt: "2026-08-13T02:00:02.000Z",
        completedAt: "2026-08-13T02:00:04.000Z", inputTokens: "200",
        outputTokens: "20", reasoningTokens: "10", purpose: "RESULT_REPAIR",
        repairContext: {
          attemptOrdinal: 2,
          rejectedResultEffectIds: [rejectedSuccess.effectId],
        },
      }),
    ];
    const completedSuccess = completeAgentRun(
      success, "SUCCEEDED", "2026-08-13T02:00:04.000Z", null,
    );
    const resultArtifact = buildAgentRunArtifact({
      run: completedSuccess,
      ordinal: 1,
      kind: "RESULT_TOOL_FINAL",
      contentHash: acceptedSuccess.canonicalOutputHash,
      sourceArtifactRef: `agent-tool-effect:${acceptedSuccess.effectId}`,
      createdAt: "2026-08-13T02:00:04.000Z",
    });

    const interrupted = work.run(2);
    const rejectedInterrupted = buildAgentToolEffect({
      run: interrupted,
      ordinal: 1,
      toolProtocol: work.imported.executionProfile.toolPolicy.protocol,
      toolName: "submit_rule_evidence_claim",
      status: "REJECTED",
      canonicalInput: { quote: "" },
      canonicalOutput: { diagnostic: "quote must be non-empty" },
      diagnostic: "quote must be non-empty",
      occurredAt: "2026-08-13T02:01:01.000Z",
    });
    const interruptedInvocations = [
      buildModelInvocation({
        run: interrupted, modelProfile: work.imported.modelProfile, ordinal: 1,
        status: "SUCCEEDED", startedAt: "2026-08-13T02:01:00.000Z",
        completedAt: "2026-08-13T02:01:01.000Z", inputTokens: "30",
        outputTokens: "3", reasoningTokens: "1", purpose: "PRIMARY_REASONING",
      }),
      buildModelInvocation({
        run: interrupted, modelProfile: work.imported.modelProfile, ordinal: 2,
        status: "SUCCEEDED", startedAt: "2026-08-13T02:01:01.000Z",
        completedAt: "2026-08-13T02:01:02.000Z", inputTokens: "50",
        outputTokens: "5", reasoningTokens: "2", purpose: "RESULT_REPAIR",
        repairContext: {
          attemptOrdinal: 1,
          rejectedResultEffectIds: [rejectedInterrupted.effectId],
        },
      }),
    ];
    const completedInterrupted = completeAgentRun(
      interrupted,
      "INTERRUPTED",
      "2026-08-13T02:01:02.000Z",
      "model invocation budget exhausted",
    );

    const historicalRun = work.run(3);
    const currentHistorical = buildModelInvocation({
      run: historicalRun, modelProfile: work.imported.modelProfile, ordinal: 1,
      status: "SUCCEEDED", startedAt: "2026-08-13T02:02:00.000Z",
      completedAt: "2026-08-13T02:02:01.000Z", inputTokens: "9",
      outputTokens: "1", reasoningTokens: "0", purpose: "PRIMARY_REASONING",
    });
    if (currentHistorical.schemaVersion !== "pmh.model-invocation.v3") {
      throw new Error("current invocation fixture must use v3");
    }
    const {
      schemaVersion: _schemaVersion,
      purpose: _purpose,
      repairContext: _repairContext,
      ...historicalFields
    } = currentHistorical;
    const historical = assertModelInvocation({
      schemaVersion: "pmh.model-invocation.v2",
      ...historicalFields,
    });
    const unlinkedRejection = buildAgentToolEffect({
      run: historicalRun,
      ordinal: 1,
      toolProtocol: work.imported.executionProfile.toolPolicy.protocol,
      toolName: "submit_rule_evidence_claim",
      status: "REJECTED",
      canonicalInput: { historical: true },
      canonicalOutput: { diagnostic: "historical rejection" },
      diagnostic: "historical rejection",
      occurredAt: "2026-08-13T02:02:01.000Z",
    });

    const execution: AgentExecutionSnapshot = Object.freeze({
      runtimeDefinitions: [work.imported.runtimeDefinition],
      credentialBindings: [work.imported.credentialBinding],
      modelProfiles: [work.imported.modelProfile],
      executionProfiles: [work.imported.executionProfile],
      capabilityObservations: [],
      workloadRoutes: [work.imported.workloadRoute],
      tasks: [work.task],
      runs: [completedSuccess, completedInterrupted, historicalRun],
      modelInvocations: [...successInvocations, ...interruptedInvocations, historical],
      toolEffects: [rejectedSuccess, acceptedSuccess, rejectedInterrupted, unlinkedRejection],
      runArtifacts: [resultArtifact],
      runAnnotations: [],
      campaigns: [],
      resultSelections: [],
    });
    const projection = buildAgentResultRepairProjection({
      observedAt: "2026-08-13T02:02:01.000Z",
      execution,
    });

    expect(projection).toMatchObject({
      repairRunCount: 2,
      repairInvocationCount: 3,
      rejectedResultEffectCount: 2,
      acceptedAfterRepairRunCount: 1,
      budgetTerminatedRepairRunCount: 1,
      otherTerminalRepairRunCount: 0,
      exactRepairRunCount: 2,
      knownInputTokens: "350",
      knownOutputTokens: "35",
      knownReasoningTokens: "17",
      knownTotalTokens: "402",
      incompleteUsageInvocationCount: 0,
      historicalUnclassifiedInvocationCount: 1,
      unlinkedRejectedEffectCount: 1,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      writesStartedByRead: 0,
      automaticDispatch: false,
    });
    expect(projection.runs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runId: success.runId,
        acceptedAfterRepair: true,
        acceptedResultEffectId: acceptedSuccess.effectId,
        repairAttemptCount: 2,
        knownTotalTokens: "345",
      }),
      expect.objectContaining({
        runId: interrupted.runId,
        budgetTerminated: true,
        repairAttemptCount: 1,
        knownTotalTokens: "57",
      }),
    ]));
  });
});
