import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertResearchDecisionEpisode,
  buildResearchDecisionEpisode,
  buildResearchDecisionOutcomeProjection,
  type ResearchActionTarget,
  type ResearchActionTargetProjection,
  type ResearchAttentionAllocationProjection,
  type ResearchAttentionFamilyScorecard,
} from "../src/index.js";

const observedAt = "2026-08-12T12:00:00.000Z";
const workItemId = hashCanonical({ work: "decision-fixture" });
const taskId = hashCanonical({ task: "decision-fixture" });

function family(input?: Readonly<{
  stage?: ResearchAttentionFamilyScorecard["valueStage"];
  runIds?: readonly Hash[];
  inputTokens?: string;
  unknown?: number;
}>): ResearchAttentionFamilyScorecard {
  const body = {
    schemaVersion: "pmh.research-attention-family-scorecard.v1" as const,
    workItemId,
    workArtifactHash: hashCanonical({ artifact: "work" }),
    workKind: "RELATION_NEIGHBORHOOD" as const,
    workPriority: 50,
    sourceSelectionLanes: ["WORLD_DIVERGENCE"] as const,
    currentTaskRevisionId: hashCanonical({ revision: "current" }),
    currentTaskId: taskId,
    currentTaskAttempted: (input?.runIds?.length ?? 0) > 0,
    retainedTaskRevisionCount: 1,
    attemptedTaskRevisionCount: (input?.runIds?.length ?? 0) > 0 ? 1 : 0,
    runIds: input?.runIds ?? [],
    runCount: input?.runIds?.length ?? 0,
    terminalRunCount: input?.runIds?.length ?? 0,
    succeededRunCount: input?.runIds?.length ?? 0,
    failedRunCount: 0,
    interruptedRunCount: 0,
    productiveInterruptedRunCount: 0,
    successfulWithoutAcceptedResultCount: 0,
    acceptedToolEffectCount: input?.runIds?.length ?? 0,
    rejectedToolEffectCount: 0,
    acceptedResultToolEffectCount: input?.runIds?.length ?? 0,
    positiveFindingIds: [],
    counterexampleIds: [],
    positiveFindingCount: 0,
    counterexampleCount: 0,
    noFindingTerminalRunCount: 0,
    semanticReviewCandidateCount: 0,
    semanticReviewConnectedCount: 0,
    semanticReviewPassCount: 0,
    semanticReviewJobIds: [],
    semanticClassificationCounts: {
      hardSettlementConstraint: 0,
      probabilisticDependence: 0,
      textualRelatedness: 0,
    },
    probabilityJobCount: 0,
    probabilityJobIds: [],
    usage: {
      knownInputTokens: input?.inputTokens ?? "0",
      knownOutputTokens: "0",
      knownReasoningTokens: "0",
      unknownInputInvocationCount: input?.unknown ?? 0,
      unknownOutputInvocationCount: 0,
      unknownReasoningInvocationCount: 0,
      knownWallClockMs: "0",
      incompleteWallClockRunCount: 0,
      incompleteUsagePenalized: (input?.unknown ?? 0) > 0,
    },
    valueStage: input?.stage ?? "UNATTEMPTED",
    nextActionKind: "EXPLORE_NEW_FAMILY" as const,
    nextActionLane: "EXPLORATION" as const,
    nextActionEligible: true,
    directRelationTaskId: taskId,
    noveltyReason: "NEW_STABLE_FAMILY" as const,
    diagnostic: "fixture",
    downstreamOpportunityAttribution: "NOT_YET_CONNECTED" as const,
    authority: "DERIVED_RESEARCH_EVIDENCE_ONLY" as const,
    modelConfidenceAuthority: false as const,
    campaignAuthority: false as const,
    executionAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  return { ...body, scorecardId: hashCanonical(body) };
}

function allocation(familyValue = family()): ResearchAttentionAllocationProjection {
  const actionBody = {
    schemaVersion: "pmh.research-attention-allocation-action.v1" as const,
    lane: "EXPLORATION" as const,
    kind: "EXPLORE_NEW_FAMILY" as const,
    workItemId,
    scorecardId: familyValue.scorecardId,
    taskId,
    targetArtifactRefs: [workItemId],
    valueStage: familyValue.valueStage,
    diagnostic: "Explore the exact family",
    dispatchableByRelationCampaign: true,
    authority: "ATTENTION_PROPOSAL_ONLY" as const,
    modelInvocationAuthority: false as const,
    campaignAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  const action = { ...actionBody, actionId: hashCanonical(actionBody) };
  return {
    schemaVersion: "pmh.research-attention-allocation.v1",
    projectionIdentity: hashCanonical({ allocation: action.actionId, score: familyValue.scorecardId }),
    observedAt,
    policy: {
      schemaVersion: "pmh.research-attention-policy.v1",
      policyIdentity: hashCanonical({ policy: 1 }),
      minimumRecheckCooldownMs: 86_400_000,
      portfolioCaps: { exploration: 4, falsificationOrDebt: 2, changedEvidenceRecheck: 1, ontologyMutation: 1, total: 8 },
      automaticDispatch: false,
      modelConfidenceAuthority: false,
    },
    familyCount: 1,
    actionableFamilyCount: 1,
    heldFamilyCount: 0,
    families: [familyValue],
    portfolio: [action],
    laneCounts: { exploration: 1, falsificationOrDebt: 0, changedEvidenceRecheck: 0, ontologyMutation: 0 },
    omittedActionableFamilyCount: 0,
    recurrenceQualification: {
      terminalRelationRunCount: familyValue.terminalRunCount,
      attemptedStableFamilyCount: familyValue.runCount > 0 ? 1 : 0,
      independentlyReviewedPositiveFindingCount: 0,
      usageComplete: familyValue.usage.unknownInputInvocationCount === 0,
      noveltyGateImplemented: true,
      evidenceThresholdSatisfied: false,
      operatorActivationStillRequired: true,
    },
    providerRequestsStartedByRead: 0,
    modelInvocationsStartedByRead: 0,
    campaignsCreatedByRead: 0,
    runsCreatedByRead: 0,
    automaticDispatch: false,
    authority: "ATTENTION_PROPOSAL_ONLY",
    semanticDecisionAuthority: false,
    probabilityAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  };
}

function targets(allocationValue: ResearchAttentionAllocationProjection, state: ResearchActionTarget["state"] = "READY_RELATION_DISCOVERY", retained = { providerRequestCount: 0, toolCallCount: 0, fetchAttemptCount: 0, interpretationAttemptCount: 0 }): ResearchActionTargetProjection {
  const action = allocationValue.portfolio[0]!;
  const targetBody = {
    schemaVersion: "pmh.research-action-target.v1" as const,
    allocationActionId: action.actionId,
    allocationActionKind: action.kind,
    workItemId,
    proposalId: null,
    semanticReviewJobId: null,
    requirementId: null,
    requirementKind: null,
    acquisitionRoute: null,
    downstreamSystem: "RELATION_DISCOVERY" as const,
    state,
    sourceTaskId: taskId,
    currentJobId: null,
    currentJobStatus: null,
    priorNegativeJobIds: [],
    exactArtifactRefs: [taskId, workItemId].sort() as Hash[],
    retainedCost: retained,
    manualOperation: { available: state.startsWith("READY_"), kind: state.startsWith("READY_") ? "RELATION_DISCOVERY_TASK" as const : "NONE" as const, targetId: state.startsWith("READY_") ? taskId : null },
    noveltyGate: state === "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH" ? "NEW_OFFICIAL_SOURCE_TASK_IDENTITY" as const : "NOT_REQUIRED" as const,
    diagnostic: "fixture target",
    authority: "RESEARCH_ROUTING_PROPOSAL_ONLY" as const,
    automaticDispatch: false as const,
    modelInvocationAuthority: false as const,
    providerRequestAuthority: false as const,
    fetchAuthority: false as const,
    campaignAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  const target = { ...targetBody, targetId: hashCanonical(targetBody) };
  const body = {
    schemaVersion: "pmh.research-action-target-projection.v1" as const,
    allocationProjectionIdentity: allocationValue.projectionIdentity,
    selectedActionCount: 1,
    targetCount: 1,
    readyCount: state.startsWith("READY_") ? 1 : 0,
    inFlightCount: state.endsWith("_IN_FLIGHT") ? 1 : 0,
    blockedNegativeSearchCount: state === "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH" ? 1 : 0,
    unresolvedCount: 0,
    truncatedActionCount: 0,
    targets: [target],
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    fetchesStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    schedulerDispatchesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "RESEARCH_ROUTING_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  return { ...body, projectionIdentity: hashCanonical(body) };
}

function episode(allocationValue = allocation(), targetValue = targets(allocationValue)) {
  return buildResearchDecisionEpisode({
    allocation: allocationValue,
    targets: targetValue,
    allocationActionId: allocationValue.portfolio[0]!.actionId,
    targetId: targetValue.targets[0]!.targetId,
    capturedAt: observedAt,
    captureRef: "operator:test",
  });
}

describe("research decision outcomes", () => {
  it("captures an exact current action and target with zero effects", () => {
    const result = episode();
    expect(result).toMatchObject({
      schemaVersion: "pmh.research-decision-episode.v1",
      providerRequestsStartedByCapture: 0,
      modelInvocationsStartedByCapture: 0,
      campaignsCreatedByCapture: 0,
      runsCreatedByCapture: 0,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(assertResearchDecisionEpisode(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("rejects stale or mismatched action-target lineage", () => {
    const allocationValue = allocation();
    const targetValue = targets(allocationValue);
    expect(() => buildResearchDecisionEpisode({
      allocation: allocationValue,
      targets: targetValue,
      allocationActionId: hashCanonical({ stale: true }),
      targetId: targetValue.targets[0]!.targetId,
      capturedAt: observedAt,
      captureRef: "operator:test",
    })).toThrow(/stale or mismatched/u);
  });

  it("reports an unchanged ready target as unacted", () => {
    const allocationValue = allocation();
    const targetValue = targets(allocationValue);
    const projection = buildResearchDecisionOutcomeProjection({
      observedAt,
      episodes: [episode(allocationValue, targetValue)],
      allocation: allocationValue,
      targets: targetValue,
    });
    expect(projection.outcomes[0]).toMatchObject({
      state: "UNACTED_READY",
      attributionBasis: "NOT_ACTED",
      valueStageDelta: 0,
      newArtifactRefs: [],
    });
  });

  it("values retained negative memory without calling it progress", () => {
    const allocationValue = allocation();
    const targetValue = targets(allocationValue, "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH", {
      providerRequestCount: 4,
      toolCallCount: 3,
      fetchAttemptCount: 0,
      interpretationAttemptCount: 0,
    });
    expect(buildResearchDecisionOutcomeProjection({
      observedAt,
      episodes: [episode(allocationValue, targetValue)],
      allocation: allocationValue,
      targets: targetValue,
    }).outcomes[0]).toMatchObject({
      state: "USEFUL_NEGATIVE_MEMORY",
      attributionBasis: "NOT_ACTED",
      valueStageDelta: 0,
    });
  });

  it("distinguishes exact-lineage movement from spend without movement", () => {
    const baselineAllocation = allocation();
    const baselineTargets = targets(baselineAllocation);
    const captured = episode(baselineAllocation, baselineTargets);
    const runId = hashCanonical({ run: "new" });
    const advancedAllocation = allocation(family({
      stage: "ATTEMPTED",
      runIds: [runId],
      inputTokens: "1200",
    }));
    const advanced = buildResearchDecisionOutcomeProjection({
      observedAt,
      episodes: [captured],
      allocation: advancedAllocation,
      targets: targets(advancedAllocation),
    }).outcomes[0]!;
    expect(advanced).toMatchObject({
      state: "ADVANCED",
      attributionBasis: "TARGET_LINEAGE_OBSERVED",
      valueStageDelta: 1,
      costDelta: { knownInputTokens: "1200" },
    });
    expect(advanced.newArtifactRefs).toContain(runId);

    const spentAllocation = allocation(family({ inputTokens: "1200" }));
    expect(buildResearchDecisionOutcomeProjection({
      observedAt,
      episodes: [captured],
      allocation: spentAllocation,
      targets: targets(spentAllocation),
    }).outcomes[0]).toMatchObject({ state: "SPENT_WITHOUT_MOVEMENT" });
  });

  it("does not call another same-stage run evidence progress", () => {
    const firstRunId = hashCanonical({ run: "first" });
    const secondRunId = hashCanonical({ run: "second" });
    const baselineAllocation = allocation(family({
      stage: "ATTEMPTED",
      runIds: [firstRunId],
      inputTokens: "100",
    }));
    const baselineTargets = targets(baselineAllocation);
    const currentAllocation = allocation(family({
      stage: "ATTEMPTED",
      runIds: [firstRunId, secondRunId].sort() as Hash[],
      inputTokens: "300",
    }));
    const result = buildResearchDecisionOutcomeProjection({
      observedAt,
      episodes: [episode(baselineAllocation, baselineTargets)],
      allocation: currentAllocation,
      targets: targets(currentAllocation),
    }).outcomes[0]!;
    expect(result).toMatchObject({
      state: "SPENT_WITHOUT_MOVEMENT",
      valueStageDelta: 0,
      costDelta: { knownInputTokens: "200" },
    });
    expect(result.newArtifactRefs).toContain(secondRunId);
  });

  it("refuses false efficiency when usage is unknown", () => {
    const allocationValue = allocation(family({ unknown: 1 }));
    const targetValue = targets(allocationValue);
    expect(buildResearchDecisionOutcomeProjection({
      observedAt,
      episodes: [episode(allocationValue, targetValue)],
      allocation: allocationValue,
      targets: targetValue,
    }).outcomes[0]).toMatchObject({
      state: "ATTRIBUTION_INCOMPLETE",
      usageComplete: false,
    });
  });
});
