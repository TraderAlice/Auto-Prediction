import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildDiscoveryYieldProjection,
  buildResearchDecisionOutcomeObservation,
  researchDecisionEpisodeId,
  type ResearchDecisionCost,
  type ResearchDecisionEpisode,
  type ResearchDecisionOutcome,
} from "../src/index.js";

const START = "2026-08-13T01:00:00.000Z";
const POLICY = hashCanonical({ policy: "yield-test" });

function cost(inputTokens: string): ResearchDecisionCost {
  return {
    knownInputTokens: inputTokens,
    knownOutputTokens: "0",
    knownReasoningTokens: "0",
    knownWallClockMs: inputTokens,
    unknownInputInvocationCount: 0,
    unknownOutputInvocationCount: 0,
    unknownReasoningInvocationCount: 0,
    incompleteWallClockRunCount: 0,
    providerRequestCount: 0,
    toolCallCount: 0,
    fetchAttemptCount: 0,
    interpretationAttemptCount: 0,
  };
}

function episode(input: Readonly<{
  name: string;
  capturedAt: string;
  baselineTokens: string;
  baselineArtifacts?: readonly Hash[];
  downstreamSystem?: ResearchDecisionEpisode["downstreamSystem"];
}>): ResearchDecisionEpisode {
  const allocationProjectionIdentity = hashCanonical({ allocation: input.name });
  const allocationActionId = hashCanonical({ action: input.name });
  const targetId = hashCanonical({ target: input.name });
  const captureRef = `agent-campaign:${input.name}`;
  const noveltyReason = "NEW_STABLE_FAMILY" as const;
  const artifacts = [...(input.baselineArtifacts ?? [])].sort();
  return {
    schemaVersion: "pmh.research-decision-episode.v2",
    episodeId: researchDecisionEpisodeId({
      allocationProjectionIdentity,
      allocationActionId,
      targetId,
      captureRef,
      noveltyReason,
    }),
    capturedAt: input.capturedAt,
    captureRef,
    allocationProjectionIdentity,
    allocationPolicyIdentity: POLICY,
    allocationObservedAt: input.capturedAt,
    allocationActionId,
    allocationActionKind: "EXPLORE_NEW_FAMILY",
    allocationLane: "EXPLORATION",
    noveltyReason,
    actionTargetProjectionIdentity: hashCanonical({ targets: input.name }),
    targetId,
    workItemId: hashCanonical({ work: input.name.split("-")[0] }),
    proposalId: null,
    requirementId: null,
    sourceTaskId: hashCanonical({ task: input.name }),
    downstreamSystem: input.downstreamSystem ?? "RELATION_DISCOVERY",
    baseline: {
      valueStage: artifacts.length > 0 ? "POSITIVE_FINDING" : "UNATTEMPTED",
      targetState: "READY_RELATION_DISCOVERY",
      runIds: [],
      positiveFindingIds: artifacts,
      counterexampleIds: [],
      semanticReviewJobIds: [],
      probabilityJobIds: [],
      exactTargetArtifactRefs: [],
      counterexampleCount: 0,
      noFindingTerminalRunCount: 0,
      successfulWithoutAcceptedResultCount: 0,
      cost: cost(input.baselineTokens),
      usageComplete: true,
    },
    authority: "RESEARCH_DECISION_EVIDENCE_ONLY",
    providerRequestsStartedByCapture: 0,
    modelInvocationsStartedByCapture: 0,
    fetchesStartedByCapture: 0,
    campaignsCreatedByCapture: 0,
    runsCreatedByCapture: 0,
    schedulerDispatchesStartedByCapture: 0,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  };
}

function outcome(input: Readonly<{
  episode: ResearchDecisionEpisode;
  observedAt: string;
  tokens: string;
  artifacts?: readonly Hash[];
  positiveFindingCount?: number;
  state?: ResearchDecisionOutcome["state"];
}>): ResearchDecisionOutcome {
  const artifacts = [...(input.artifacts ?? [])].sort();
  const positiveFindingCount = input.positiveFindingCount ?? artifacts.length;
  const body = {
    schemaVersion: "pmh.research-decision-outcome.v1" as const,
    episodeId: input.episode.episodeId,
    capturedAt: input.episode.capturedAt,
    allocationActionId: input.episode.allocationActionId,
    noveltyReason: input.episode.noveltyReason,
    targetId: input.episode.targetId,
    workItemId: input.episode.workItemId,
    observedAt: input.observedAt,
    state: input.state ?? "ADVANCED" as const,
    attributionBasis: "TARGET_LINEAGE_OBSERVED" as const,
    baselineValueStage: input.episode.baseline.valueStage,
    currentValueStage: "POSITIVE_FINDING" as const,
    valueStageDelta: positiveFindingCount > 0 ? 1 : 0,
    currentTargetState: "READY_RELATION_DISCOVERY" as const,
    newArtifactRefs: artifacts,
    yieldDelta: {
      newRunCount: 1,
      newPositiveFindingCount: positiveFindingCount,
      newCounterexampleCount: 0,
      newSemanticReviewJobCount: 0,
      newProbabilityJobCount: 0,
      newExactTargetArtifactCount: 0,
      newNoFindingTerminalRunCount: 0,
      newSuccessfulWithoutAcceptedResultCount: 0,
      positiveValueStageDelta: positiveFindingCount > 0 ? 1 : 0,
    },
    antiLoopMemory: {
      newCounterexampleCount: 0,
      newNoFindingTerminalRunCount: 0,
      newSuccessfulWithoutAcceptedResultCount: 0,
      retainedCounterexampleCount: 0,
      retainedNoFindingTerminalRunCount: 0,
      exactTaskAlreadyAttempted: true,
    },
    costDelta: cost(input.tokens),
    usageComplete: true,
    diagnostic: "Synthetic exact-lineage outcome",
    authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    automaticDispatch: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  return { ...body, outcomeId: hashCanonical(body) };
}

function observation(input: Readonly<{
  outcome: ResearchDecisionOutcome;
  boundary?: ResearchDecisionEpisode;
}>) {
  return buildResearchDecisionOutcomeObservation({
    previous: null,
    outcome: input.outcome,
    observedAt: input.outcome.observedAt,
    trigger: input.boundary === undefined
      ? "AGENT_TASK_COMPLETION"
      : "CAMPAIGN_MEMBERSHIP_RECONCILIATION",
    triggerRef: input.boundary?.episodeId ?? "task:yield-test",
    boundaryEpisodeId: input.boundary?.episodeId ?? null,
  });
}

describe("discovery yield attribution", () => {
  it("closes adjacent windows without double-counting cost or artifacts", () => {
    const firstFinding = hashCanonical({ finding: "first" });
    const secondFinding = hashCanonical({ finding: "second" });
    const first = episode({
      name: "shared-first", capturedAt: START, baselineTokens: "0",
    });
    const second = episode({
      name: "shared-second",
      capturedAt: "2026-08-13T01:10:00.000Z",
      baselineTokens: "60000",
      baselineArtifacts: [firstFinding],
    });
    const firstObservation = observation({
      outcome: outcome({
        episode: first,
        observedAt: "2026-08-13T01:10:00.001Z",
        tokens: "60000",
        artifacts: [firstFinding],
      }),
      boundary: second,
    });
    const secondObservation = observation({
      outcome: outcome({
        episode: second,
        observedAt: "2026-08-13T01:20:00.000Z",
        tokens: "40000",
        artifacts: [secondFinding],
      }),
    });
    const projection = buildDiscoveryYieldProjection({
      observedAt: "2026-08-13T01:21:00.000Z",
      episodes: [first, second],
      observations: [firstObservation, secondObservation],
    });

    expect(projection.windows).toMatchObject([
      { status: "CLOSED_BY_SUCCESSOR", comparable: true, creditedArtifactRefs: [firstFinding] },
      { status: "CURRENT_TERMINAL_OBSERVATION", comparable: true,
        creditedArtifactRefs: [secondFinding] },
    ]);
    expect(projection.strata).toMatchObject([{
      comparableTerminalWindowCount: 2,
      newRunCount: 2,
      positiveFindingCount: 2,
      knownTotalTokens: "100000",
      yieldCostEstimateQualified: false,
      ratesPer100kKnownTokens: { positiveFindings: null },
    }]);
  });

  it("fails a later window closed when it tries to claim an earlier artifact", () => {
    const sharedFinding = hashCanonical({ finding: "duplicate" });
    const first = episode({ name: "duplicate-first", capturedAt: START, baselineTokens: "0" });
    const second = episode({
      name: "duplicate-second",
      capturedAt: "2026-08-13T01:10:00.000Z",
      baselineTokens: "50000",
      baselineArtifacts: [sharedFinding],
    });
    const projection = buildDiscoveryYieldProjection({
      observedAt: "2026-08-13T01:20:00.000Z",
      episodes: [first, second],
      observations: [
        observation({
          outcome: outcome({ episode: first, observedAt: "2026-08-13T01:10:00.001Z",
            tokens: "50000", artifacts: [sharedFinding] }),
          boundary: second,
        }),
        observation({
          outcome: outcome({ episode: second, observedAt: "2026-08-13T01:15:00.000Z",
            tokens: "10000", artifacts: [sharedFinding] }),
        }),
      ],
    });
    expect(projection.windows[1]).toMatchObject({
      status: "INCOMPARABLE",
      integrity: "DUPLICATE_ARTIFACT_CREDIT",
      duplicateArtifactCreditCount: 1,
      comparable: false,
    });
    expect(projection.strata[0]).toMatchObject({
      comparableTerminalWindowCount: 1,
      positiveFindingCount: 1,
      knownTotalTokens: "50000",
    });
  });

  it("qualifies only three complete terminal windows and isolates downstream systems", () => {
    const relationEpisodes = [0, 1, 2].map((index) => episode({
      name: `relation${index}`,
      capturedAt: `2026-08-13T02:0${index}:00.000Z`,
      baselineTokens: "0",
    }));
    const ruleEpisode = episode({
      name: "rule-0",
      capturedAt: "2026-08-13T02:10:00.000Z",
      baselineTokens: "0",
      downstreamSystem: "RULE_EVIDENCE_INTERPRETATION",
    });
    const openRelationEpisode = episode({
      name: "relation-open",
      capturedAt: "2026-08-13T02:20:00.000Z",
      baselineTokens: "0",
    });
    const observedEpisodes = [...relationEpisodes, ruleEpisode];
    const allEpisodes = [...observedEpisodes, openRelationEpisode];
    const observations = observedEpisodes.map((item, index) => observation({
      outcome: outcome({
        episode: item,
        observedAt: `2026-08-13T03:${String(index).padStart(2, "0")}:00.000Z`,
        tokens: "100000",
        artifacts: [hashCanonical({ finding: index })],
      }),
    }));
    const projection = buildDiscoveryYieldProjection({
      observedAt: "2026-08-13T04:00:00.000Z",
      episodes: allEpisodes,
      observations,
    });
    expect(projection.strata).toHaveLength(2);
    const relation = projection.strata.find((item) =>
      item.downstreamSystem === "RELATION_DISCOVERY"
    );
    const rule = projection.strata.find((item) =>
      item.downstreamSystem === "RULE_EVIDENCE_INTERPRETATION"
    );
    expect(relation).toMatchObject({
      selectedWindowCount: 4,
      comparableTerminalWindowCount: 3,
      newRunCount: 3,
      nonComparableWindowCount: 1,
      unknownUsageWindowCount: 0,
      positiveFindingCount: 3,
      knownTotalTokens: "300000",
      yieldCostEstimateQualified: true,
      ratesPer100kKnownTokens: { positiveFindings: "1000000" },
    });
    expect(rule).toMatchObject({
      comparableTerminalWindowCount: 1,
      knownTotalTokens: "100000",
      yieldCostEstimateQualified: false,
    });
  });
});
