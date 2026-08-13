import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildAgentRun,
  buildAgentTask,
  buildAgentToolEffect,
  buildModelInvocation,
  buildOntologyAgentIntentCostProjection,
  emptyAgentExecutionSnapshot,
  importLegacyAiRuntimeConfiguration,
} from "../src/index.js";

const NOW = "2026-08-13T04:00:00.000Z";

describe("ontology Agent intent cost attribution", () => {
  it("counts each invocation once and preserves historical unlinked posture", () => {
    const imported = importLegacyAiRuntimeConfiguration({
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 1,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: NOW,
    });
    const task = buildAgentTask({
      kind: "ONTOLOGY_NORMALIZATION",
      protocol: "MARKET_ONTOLOGY_NORMALIZATION_TASK_V3",
      inputArtifacts: [],
      taskPayload: { issueId: hashCanonical({ issue: "intent-cost" }) },
      requestedEffectProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V2",
      provenanceRef: `ontology-issue:${hashCanonical({ issue: "intent-cost" })}`,
      priority: 1,
      createdAt: NOW,
    });
    const run = buildAgentRun({
      task,
      executionProfile: imported.executionProfile,
      runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:test", authorizedAt: NOW },
      createdAt: NOW,
    });
    const invocations = [
      buildModelInvocation({
        run, modelProfile: imported.modelProfile, ordinal: 1, status: "SUCCEEDED",
        startedAt: NOW, completedAt: "2026-08-13T04:00:01.000Z",
        inputTokens: "100", outputTokens: "10", reasoningTokens: "5",
        purpose: "PRIMARY_REASONING",
      }),
      buildModelInvocation({
        run, modelProfile: imported.modelProfile, ordinal: 2, status: "SUCCEEDED",
        startedAt: "2026-08-13T04:00:01.000Z",
        completedAt: "2026-08-13T04:00:02.000Z",
        inputTokens: "200", outputTokens: "20", reasoningTokens: "10",
        purpose: "TOOL_CONTINUATION",
      }),
      buildModelInvocation({
        run, modelProfile: imported.modelProfile, ordinal: 3, status: "SUCCEEDED",
        startedAt: "2026-08-13T04:00:02.000Z",
        completedAt: "2026-08-13T04:00:03.000Z",
        inputTokens: "300", outputTokens: "30", reasoningTokens: "15",
        purpose: "RESULT_REPAIR", repairContext: {
          attemptOrdinal: 1,
          rejectedResultEffectIds: [hashCanonical({ rejected: "historical" })],
        },
      }),
    ];
    const linked = [
      buildAgentToolEffect({
        run, ordinal: 1, toolProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V2",
        toolName: "list_assigned_ontology_trailheads", status: "ACCEPTED",
        canonicalInput: {}, canonicalOutput: { count: 1 }, diagnostic: null,
        sourceInvocation: invocations[0], occurredAt: invocations[0]!.completedAt,
      }),
      buildAgentToolEffect({
        run, ordinal: 2, toolProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V2",
        toolName: "list_world_state_mechanism_coverage", status: "ACCEPTED",
        canonicalInput: {}, canonicalOutput: { routes: 0 }, diagnostic: null,
        sourceInvocation: invocations[1], occurredAt: invocations[1]!.completedAt,
      }),
      buildAgentToolEffect({
        run, ordinal: 3, toolProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V2",
        toolName: "propose_world_state_mechanism", status: "REJECTED",
        canonicalInput: { candidate: 1 }, canonicalOutput: { diagnostic: "counter-scenario required" },
        diagnostic: "counter-scenario required", sourceInvocation: invocations[2],
        occurredAt: invocations[2]!.completedAt,
      }),
    ];
    const historical = buildAgentToolEffect({
      run, ordinal: 4, toolProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V2",
      toolName: "record_ontology_counterexample", status: "ACCEPTED",
      canonicalInput: { legacy: true }, canonicalOutput: { retained: true },
      occurredAt: "2026-08-13T04:00:04.000Z",
    });
    const projection = buildOntologyAgentIntentCostProjection({
      observedAt: "2026-08-13T04:00:04.000Z",
      execution: Object.freeze({
        ...emptyAgentExecutionSnapshot(),
        runtimeDefinitions: [imported.runtimeDefinition],
        credentialBindings: [imported.credentialBinding],
        modelProfiles: [imported.modelProfile],
        executionProfiles: [imported.executionProfile],
        tasks: [task], runs: [run], modelInvocations: invocations,
        toolEffects: [...linked, historical],
      }),
    });

    expect(projection).toMatchObject({
      ontologyRunCount: 1,
      ontologyInvocationCount: 3,
      exactLinkedInvocationCount: 3,
      historicalUnlinkedInvocationCount: 0,
      unlinkedHistoricalEffectCount: 1,
      invalidExactLineageEffectCount: 0,
      mechanismInspectionCallCount: 1,
      acceptedMechanismResultCallCount: 0,
      rejectedMechanismResultCallCount: 1,
      acceptedOrdinaryResultCallCount: 1,
      knownInputTokens: "600",
      knownOutputTokens: "60",
      knownReasoningTokens: "30",
      knownTotalTokens: "690",
      totalsReconcile: true,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      writesStartedByRead: 0,
    });
    expect(projection.strata.map((item) => [item.stratum, item.invocationCount,
      item.knownTotalTokens])).toEqual([
      ["EVIDENCE_INSPECTION", 1, "115"],
      ["ORDINARY_ONTOLOGY_RESULT", 0, "0"],
      ["MECHANISM_MEMORY_INSPECTION", 1, "230"],
      ["MECHANISM_RESULT", 0, "0"],
      ["RESULT_REPAIR", 1, "345"],
      ["MIXED_TOOL_INTENT", 0, "0"],
      ["NO_RETAINED_TOOL_EFFECT", 0, "0"],
      ["HISTORICAL_UNLINKED", 0, "0"],
    ]);
  });
});
