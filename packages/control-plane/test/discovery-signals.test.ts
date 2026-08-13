import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  acknowledgeDiscoverySignal,
  buildDiscoverySignalProjection,
  deriveDiscoverySignals,
  type ResearchAttentionAllocationProjection,
  type ResearchDecisionEpisode,
  type ResearchDecisionOutcomeProjection,
} from "../src/index.js";

const observedAt = "2026-08-13T00:00:00.000Z";
const workItemId = hashCanonical({ work: "signal" });
const episodeId = hashCanonical({ episode: "signal" });
const actionId = hashCanonical({ action: "signal" });
const targetId = hashCanonical({ target: "signal" });
const counterexampleId = hashCanonical({ counterexample: "signal" });

function episode(captureRef = "agent-campaign:signal"): ResearchDecisionEpisode {
  return {
    schemaVersion: "pmh.research-decision-episode.v2",
    episodeId,
    capturedAt: observedAt,
    captureRef,
    allocationProjectionIdentity: hashCanonical({ allocation: "signal" }),
    allocationPolicyIdentity: hashCanonical({ policy: "signal" }),
    allocationObservedAt: observedAt,
    allocationActionId: actionId,
    allocationActionKind: "EXPLORE_NEW_FAMILY",
    allocationLane: "EXPLORATION",
    noveltyReason: "NEW_STABLE_FAMILY",
    actionTargetProjectionIdentity: hashCanonical({ targets: "signal" }),
    targetId,
    workItemId,
    proposalId: null,
    requirementId: null,
    sourceTaskId: hashCanonical({ task: "signal" }),
    downstreamSystem: "RELATION_DISCOVERY",
    baseline: {
      valueStage: "UNATTEMPTED",
      targetState: "READY_RELATION_DISCOVERY",
      runIds: [], positiveFindingIds: [], counterexampleIds: [],
      semanticReviewJobIds: [], probabilityJobIds: [], exactTargetArtifactRefs: [],
      counterexampleCount: 0,
      noFindingTerminalRunCount: 0,
      successfulWithoutAcceptedResultCount: 0,
      cost: {
        knownInputTokens: "0", knownOutputTokens: "0", knownReasoningTokens: "0",
        knownWallClockMs: "0", unknownInputInvocationCount: 0,
        unknownOutputInvocationCount: 0, unknownReasoningInvocationCount: 0,
        incompleteWallClockRunCount: 0, providerRequestCount: 0, toolCallCount: 0,
        fetchAttemptCount: 0, interpretationAttemptCount: 0,
      },
      usageComplete: true,
    },
    authority: "RESEARCH_DECISION_EVIDENCE_ONLY",
    providerRequestsStartedByCapture: 0, modelInvocationsStartedByCapture: 0,
    fetchesStartedByCapture: 0, campaignsCreatedByCapture: 0,
    runsCreatedByCapture: 0, schedulerDispatchesStartedByCapture: 0,
    semanticDecisionAuthority: false, certificateAuthority: false,
    executionAuthority: false, externalWriteAuthority: false, valueMovingAuthority: false,
  };
}

function outcomes(state: "UNACTED_READY" | "USEFUL_NEGATIVE_MEMORY" =
"USEFUL_NEGATIVE_MEMORY"): ResearchDecisionOutcomeProjection {
  const outcome = {
    schemaVersion: "pmh.research-decision-outcome.v1" as const,
    outcomeId: hashCanonical({ outcome: state }), episodeId, capturedAt: observedAt,
    allocationActionId: actionId, noveltyReason: "NEW_STABLE_FAMILY" as const,
    targetId, workItemId, observedAt, state,
    attributionBasis: state === "UNACTED_READY" ? "NOT_ACTED" as const :
      "TARGET_LINEAGE_OBSERVED" as const,
    baselineValueStage: "UNATTEMPTED" as const,
    currentValueStage: state === "UNACTED_READY" ? "UNATTEMPTED" as const :
      "NEGATIVE_EVIDENCE" as const,
    valueStageDelta: state === "UNACTED_READY" ? 0 : 2,
    currentTargetState: "READY_RELATION_DISCOVERY" as const,
    newArtifactRefs: state === "UNACTED_READY" ? [] : [counterexampleId],
    antiLoopMemory: {
      newCounterexampleCount: state === "UNACTED_READY" ? 0 : 1,
      newNoFindingTerminalRunCount: 0,
      newSuccessfulWithoutAcceptedResultCount: 0,
      retainedCounterexampleCount: state === "UNACTED_READY" ? 0 : 1,
      retainedNoFindingTerminalRunCount: 0,
      exactTaskAlreadyAttempted: state !== "UNACTED_READY",
    },
    costDelta: {
      knownInputTokens: "1000", knownOutputTokens: "10", knownReasoningTokens: "20",
      knownWallClockMs: "500", unknownInputInvocationCount: 0,
      unknownOutputInvocationCount: 0, unknownReasoningInvocationCount: 0,
      incompleteWallClockRunCount: 0, providerRequestCount: 0, toolCallCount: 1,
      fetchAttemptCount: 0, interpretationAttemptCount: 0,
    },
    usageComplete: true,
    diagnostic: "fixture",
    authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const, policyMutationAuthority: false as const,
    automaticDispatch: false as const, certificateAuthority: false as const,
    executionAuthority: false as const, externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  return {
    schemaVersion: "pmh.research-decision-outcome-projection.v1",
    projectionIdentity: hashCanonical({ projection: state }), observedAt,
    episodeCount: 1,
    outcomeCounts: {
      UNACTED_READY: state === "UNACTED_READY" ? 1 : 0,
      USEFUL_NEGATIVE_MEMORY: state === "USEFUL_NEGATIVE_MEMORY" ? 1 : 0,
      IN_FLIGHT: 0, ADVANCED: 0, SPENT_WITHOUT_MOVEMENT: 0,
      REGRESSED_OR_RESCOPED: 0, TERMINAL_HOLD: 0, ATTRIBUTION_INCOMPLETE: 0,
    },
    outcomes: [outcome], providerRequestsStartedByRead: 0,
    modelInvocationsStartedByRead: 0, fetchesStartedByRead: 0,
    campaignsCreatedByRead: 0, runsCreatedByRead: 0,
    schedulerDispatchesStartedByRead: 0, writesStartedByRead: 0,
    automaticDispatch: false, authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY",
    semanticDecisionAuthority: false, policyMutationAuthority: false,
    certificateAuthority: false, executionAuthority: false,
    externalWriteAuthority: false, valueMovingAuthority: false,
  };
}

const allocation = {
  observedAt,
  portfolio: [],
} as unknown as ResearchAttentionAllocationProjection;

describe("discovery signal inbox", () => {
  it("signals exact campaign membership and structured negative memory once", () => {
    const signals = deriveDiscoverySignals({
      observedAt, episodes: [episode()], outcomes: outcomes(), allocation,
    });
    expect(signals.map((item) => item.kind)).toEqual([
      "CAMPAIGN_MEMBERSHIP_ADDED", "STRUCTURED_OUTCOME",
    ]);
    expect(signals[1]).toMatchObject({
      status: "UNREAD", outcomeState: "USEFUL_NEGATIVE_MEMORY",
      noveltyReason: "NEW_STABLE_FAMILY", knownTokenDelta: "1030",
      providerRequestsStarted: 0, modelInvocationsStarted: 0,
      campaignsActivated: 0, runsStarted: 0,
    });
    expect(deriveDiscoverySignals({
      observedAt, episodes: [episode()], outcomes: outcomes(), allocation,
    })).toEqual(signals);
  });

  it("does not notify on timer liveness, ordinary manual capture or unacted state", () => {
    expect(deriveDiscoverySignals({
      observedAt, episodes: [episode("operator:manual")],
      outcomes: outcomes("UNACTED_READY"), allocation,
    })).toEqual([]);
  });

  it("acknowledges without changing the durable signal identity", () => {
    const [record] = deriveDiscoverySignals({
      observedAt, episodes: [episode()], outcomes: outcomes("UNACTED_READY"), allocation,
    });
    const read = acknowledgeDiscoverySignal(record!, "2026-08-13T01:00:00.000Z");
    expect(read).toMatchObject({ signalId: record!.signalId, status: "READ" });
    expect(buildDiscoverySignalProjection({ observedAt, signals: [read] })).toMatchObject({
      signalCount: 1, unreadCount: 0, providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0, writesStartedByRead: 0,
    });
  });

  it("signals portfolio exhaustion without requiring an Agent response", () => {
    const mutationId = hashCanonical({ mutation: "signal" });
    const exhaustedAllocation = {
      ...allocation,
      portfolio: [{
        schemaVersion: "pmh.research-attention-allocation-action.v2",
        actionId: mutationId,
        lane: "ONTOLOGY_MUTATION",
        kind: "PROPOSE_ONTOLOGY_MUTATION",
        workItemId: null,
        scorecardId: null,
        taskId: null,
        targetArtifactRefs: [],
        valueStage: "PORTFOLIO_EXHAUSTED",
        noveltyReason: "PORTFOLIO_EXHAUSTED",
        diagnostic: "fixture",
        dispatchableByRelationCampaign: false,
        authority: "ATTENTION_PROPOSAL_ONLY",
        modelInvocationAuthority: false,
        campaignAuthority: false,
        executionAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      }],
    } as unknown as ResearchAttentionAllocationProjection;
    expect(deriveDiscoverySignals({
      observedAt, episodes: [], outcomes: { ...outcomes("UNACTED_READY"), outcomes: [] },
      allocation: exhaustedAllocation,
    })).toMatchObject([{
      kind: "PORTFOLIO_EXHAUSTED",
      allocationActionId: mutationId,
      knownTokenDelta: "0",
      automaticDispatch: false,
    }]);
  });

  it("warns only after repeated high-cost no-movement in one stable family", () => {
    const firstEpisode = episode("operator:first");
    const secondEpisodeId = hashCanonical({ episode: "signal-second" });
    const secondActionId = hashCanonical({ action: "signal-second" });
    const secondEpisode = {
      ...episode("operator:second"),
      episodeId: secondEpisodeId,
      allocationActionId: secondActionId,
    };
    const baseOutcome = outcomes("UNACTED_READY").outcomes[0]!;
    const noMovement = (currentEpisodeId: typeof episodeId, currentActionId: typeof actionId) => ({
      ...baseOutcome,
      outcomeId: hashCanonical({ outcome: currentEpisodeId }),
      episodeId: currentEpisodeId,
      allocationActionId: currentActionId,
      state: "SPENT_WITHOUT_MOVEMENT" as const,
      attributionBasis: "TARGET_LINEAGE_OBSERVED" as const,
      costDelta: {
        ...baseOutcome.costDelta,
        knownInputTokens: "50000",
        knownOutputTokens: "1",
        knownReasoningTokens: "0",
      },
    });
    const repeated = [
      noMovement(episodeId, actionId),
      noMovement(secondEpisodeId, secondActionId),
    ];
    const projection = {
      ...outcomes("UNACTED_READY"),
      episodeCount: 2,
      outcomeCounts: {
        UNACTED_READY: 0, USEFUL_NEGATIVE_MEMORY: 0, IN_FLIGHT: 0, ADVANCED: 0,
        SPENT_WITHOUT_MOVEMENT: 2, REGRESSED_OR_RESCOPED: 0, TERMINAL_HOLD: 0,
        ATTRIBUTION_INCOMPLETE: 0,
      },
      outcomes: repeated,
    } as ResearchDecisionOutcomeProjection;
    const signals = deriveDiscoverySignals({
      observedAt,
      episodes: [firstEpisode, secondEpisode],
      outcomes: projection,
      allocation,
    });
    expect(signals).toMatchObject([{
      kind: "REPEATED_COSTLY_NO_MOVEMENT",
      severity: "WARNING",
      workItemId,
      knownTokenDelta: "100002",
    }]);
  });
});
