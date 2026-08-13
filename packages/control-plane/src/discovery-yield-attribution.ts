import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertResearchDecisionEpisode,
  type ResearchDecisionCost,
  type ResearchDecisionEpisode,
  type ResearchDecisionOutcome,
} from "./research-decision-outcomes.js";
import {
  assertResearchDecisionOutcomeObservation,
  type ResearchDecisionOutcomeObservation,
} from "./research-decision-outcome-observations.js";

const TERMINAL_EVIDENCE_MINIMUM = 3 as const;
const RATE_SCALE = 1_000_000n;
const RATE_BASIS_TOKENS = 100_000n;
const MAX_WINDOWS = 512;

export type DiscoveryDecisionWindowStatus =
  | "OPEN_UNACTED"
  | "OPEN_IN_FLIGHT"
  | "CLOSED_BY_SUCCESSOR"
  | "CURRENT_TERMINAL_OBSERVATION"
  | "INCOMPARABLE";

export type DiscoveryDecisionWindowIntegrity =
  | "EXACT"
  | "NO_OUTCOME_OBSERVATION"
  | "SUCCESSOR_NOT_IMMEDIATE"
  | "BOUNDARY_COST_MISMATCH"
  | "BOUNDARY_ARTIFACT_NOT_CARRIED"
  | "DUPLICATE_ARTIFACT_CREDIT"
  | "INCOMPLETE_USAGE"
  | "UNBOUND_RESCOPE";

export type DiscoveryDecisionWindow = Readonly<{
  schemaVersion: "pmh.discovery-decision-window.v1";
  windowId: Hash;
  episodeId: Hash;
  workItemId: Hash | null;
  allocationPolicyIdentity: Hash;
  allocationLane: ResearchDecisionEpisode["allocationLane"];
  allocationActionKind: ResearchDecisionEpisode["allocationActionKind"];
  noveltyReason: ResearchDecisionEpisode["noveltyReason"];
  downstreamSystem: ResearchDecisionEpisode["downstreamSystem"];
  campaignMembershipBound: boolean;
  startedAt: string;
  endedAt: string | null;
  boundaryEpisodeId: Hash | null;
  observationId: Hash | null;
  outcomeState: ResearchDecisionOutcome["state"] | null;
  status: DiscoveryDecisionWindowStatus;
  integrity: DiscoveryDecisionWindowIntegrity;
  comparable: boolean;
  acted: boolean;
  terminal: boolean;
  creditedArtifactRefs: readonly Hash[];
  duplicateArtifactCreditCount: number;
  yieldDelta: ResearchDecisionOutcome["yieldDelta"];
  cost: ResearchDecisionCost;
  usageComplete: boolean;
  diagnostic: string;
  authority: "DESCRIPTIVE_DISCOVERY_YIELD_ONLY";
  policyMutationAuthority: false;
  automaticDispatch: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type DiscoveryYieldStratum = Readonly<{
  schemaVersion: "pmh.discovery-yield-stratum.v1";
  stratumId: Hash;
  allocationPolicyIdentity: Hash;
  allocationLane: ResearchDecisionEpisode["allocationLane"];
  allocationActionKind: ResearchDecisionEpisode["allocationActionKind"];
  noveltyReason: ResearchDecisionEpisode["noveltyReason"];
  downstreamSystem: ResearchDecisionEpisode["downstreamSystem"];
  selectedWindowCount: number;
  actedWindowCount: number;
  terminalWindowCount: number;
  comparableTerminalWindowCount: number;
  nonComparableWindowCount: number;
  positiveFindingCount: number;
  counterexampleCount: number;
  noFindingTerminalRunCount: number;
  successfulWithoutAcceptedResultCount: number;
  semanticReviewJobCount: number;
  probabilityJobCount: number;
  exactTargetArtifactCount: number;
  newRunCount: number;
  positiveValueStageDelta: number;
  productiveWindowCount: number;
  spentWithoutMovementWindowCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  knownWallClockMs: string;
  unknownUsageWindowCount: number;
  terminalEvidenceMinimum: 3;
  yieldCostEstimateQualified: boolean;
  ratesPer100kKnownTokens: Readonly<{
    scale: "1000000";
    unit: "EVENTS_PER_100000_KNOWN_TOKENS";
    positiveFindings: string | null;
    counterexamples: string | null;
    productiveWindows: string | null;
    positiveValueStageDelta: string | null;
  }>;
}>;

export type DiscoveryYieldProjection = Readonly<{
  schemaVersion: "pmh.discovery-yield-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  episodeCount: number;
  observationCount: number;
  windowCount: number;
  campaignMembershipBoundWindowCount: number;
  newRunCount: number;
  actedWindowCount: number;
  openWindowCount: number;
  terminalWindowCount: number;
  comparableTerminalWindowCount: number;
  productiveComparableWindowCount: number;
  nonComparableWindowCount: number;
  representedStratumCount: number;
  qualifiedStratumCount: number;
  windows: readonly DiscoveryDecisionWindow[];
  strata: readonly DiscoveryYieldStratum[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_DISCOVERY_YIELD_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const ZERO_YIELD: ResearchDecisionOutcome["yieldDelta"] = Object.freeze({
  newRunCount: 0,
  newPositiveFindingCount: 0,
  newCounterexampleCount: 0,
  newSemanticReviewJobCount: 0,
  newProbabilityJobCount: 0,
  newExactTargetArtifactCount: 0,
  newNoFindingTerminalRunCount: 0,
  newSuccessfulWithoutAcceptedResultCount: 0,
  positiveValueStageDelta: 0,
});

const ZERO_COST: ResearchDecisionCost = Object.freeze({
  knownInputTokens: "0",
  knownOutputTokens: "0",
  knownReasoningTokens: "0",
  knownWallClockMs: "0",
  unknownInputInvocationCount: 0,
  unknownOutputInvocationCount: 0,
  unknownReasoningInvocationCount: 0,
  incompleteWallClockRunCount: 0,
  providerRequestCount: 0,
  toolCallCount: 0,
  fetchAttemptCount: 0,
  interpretationAttemptCount: 0,
});

function artifactRefs(episode: ResearchDecisionEpisode): readonly Hash[] {
  return Object.freeze([...new Set([
    ...episode.baseline.runIds,
    ...episode.baseline.positiveFindingIds,
    ...episode.baseline.counterexampleIds,
    ...episode.baseline.semanticReviewJobIds,
    ...episode.baseline.probabilityJobIds,
    ...episode.baseline.exactTargetArtifactRefs,
  ])].sort());
}

function addCost(left: ResearchDecisionCost, right: ResearchDecisionCost) {
  const stringFields = ["knownInputTokens", "knownOutputTokens",
    "knownReasoningTokens", "knownWallClockMs"] as const;
  const numberFields = ["unknownInputInvocationCount", "unknownOutputInvocationCount",
    "unknownReasoningInvocationCount", "incompleteWallClockRunCount",
    "providerRequestCount", "toolCallCount", "fetchAttemptCount",
    "interpretationAttemptCount"] as const;
  return Object.freeze({
    ...Object.fromEntries(stringFields.map((field) =>
      [field, (BigInt(left[field]) + BigInt(right[field])).toString()]
    )),
    ...Object.fromEntries(numberFields.map((field) =>
      [field, left[field] + right[field]]
    )),
  }) as ResearchDecisionCost;
}

function sameCost(left: ResearchDecisionCost, right: ResearchDecisionCost): boolean {
  return hashCanonical(left) === hashCanonical(right);
}

function hasCost(cost: ResearchDecisionCost): boolean {
  return BigInt(cost.knownInputTokens) + BigInt(cost.knownOutputTokens) +
    BigInt(cost.knownReasoningTokens) + BigInt(cost.knownWallClockMs) > 0n ||
    cost.unknownInputInvocationCount > 0 || cost.unknownOutputInvocationCount > 0 ||
    cost.unknownReasoningInvocationCount > 0 || cost.incompleteWallClockRunCount > 0 ||
    cost.providerRequestCount > 0 || cost.toolCallCount > 0 ||
    cost.fetchAttemptCount > 0 || cost.interpretationAttemptCount > 0;
}

function latestObservations(
  observations: readonly ResearchDecisionOutcomeObservation[],
): ReadonlyMap<Hash, ResearchDecisionOutcomeObservation> {
  const latest = new Map<Hash, ResearchDecisionOutcomeObservation>();
  for (const observation of observations) {
    const retained = latest.get(observation.episodeId);
    if (retained === undefined || observation.observedAt > retained.observedAt ||
        (observation.observedAt === retained.observedAt &&
          observation.observationId > retained.observationId)) {
      latest.set(observation.episodeId, observation);
    }
  }
  return latest;
}

function terminalState(state: ResearchDecisionOutcome["state"]): boolean {
  return ["ADVANCED", "USEFUL_NEGATIVE_MEMORY", "SPENT_WITHOUT_MOVEMENT",
    "TERMINAL_HOLD"].includes(state);
}

function windowBody(input: Readonly<{
  episode: ResearchDecisionEpisode;
  observation: ResearchDecisionOutcomeObservation | null;
  immediateSuccessor: ResearchDecisionEpisode | null;
  credited: Set<Hash>;
}>): Omit<DiscoveryDecisionWindow, "windowId"> {
  const { episode, observation, immediateSuccessor } = input;
  let status: DiscoveryDecisionWindowStatus;
  let integrity: DiscoveryDecisionWindowIntegrity;
  let diagnostic: string;
  let comparable = false;
  let terminal = false;
  let endedAt: string | null = null;
  const outcome = observation?.outcome ?? null;
  if (observation === null || outcome === null) {
    status = "INCOMPARABLE";
    integrity = "NO_OUTCOME_OBSERVATION";
    diagnostic = "No append-only outcome observation exists for this decision baseline.";
  } else if (observation.boundaryEpisodeId !== null) {
    terminal = true;
    endedAt = immediateSuccessor?.capturedAt ?? observation.observedAt;
    if (immediateSuccessor?.episodeId !== observation.boundaryEpisodeId) {
      status = "INCOMPARABLE";
      integrity = "SUCCESSOR_NOT_IMMEDIATE";
      diagnostic = "The retained boundary is not the immediate same-family successor.";
    } else if (!sameCost(
      addCost(episode.baseline.cost, outcome.costDelta),
      immediateSuccessor.baseline.cost,
    )) {
      status = "INCOMPARABLE";
      integrity = "BOUNDARY_COST_MISMATCH";
      diagnostic = "The predecessor cost interval does not meet the successor baseline exactly.";
    } else {
      const successorArtifacts = new Set(artifactRefs(immediateSuccessor));
      const missing = outcome.newArtifactRefs.filter((ref) => !successorArtifacts.has(ref));
      if (missing.length > 0) {
        status = "INCOMPARABLE";
        integrity = "BOUNDARY_ARTIFACT_NOT_CARRIED";
        diagnostic = "The successor baseline does not carry every predecessor artifact credit.";
      } else if (!outcome.usageComplete) {
        status = "INCOMPARABLE";
        integrity = "INCOMPLETE_USAGE";
        diagnostic = "The closed interval contains incomplete model or wall-clock usage.";
      } else {
        status = "CLOSED_BY_SUCCESSOR";
        integrity = "EXACT";
        comparable = true;
        diagnostic = "The next same-family baseline closes this cost and artifact interval exactly.";
      }
    }
  } else if (immediateSuccessor !== null) {
    status = "INCOMPARABLE";
    integrity = "SUCCESSOR_NOT_IMMEDIATE";
    terminal = true;
    endedAt = immediateSuccessor.capturedAt;
    diagnostic = "A same-family successor exists without an exact predecessor boundary observation.";
  } else if (outcome.state === "UNACTED_READY") {
    status = "OPEN_UNACTED";
    integrity = "EXACT";
    diagnostic = "The current decision remains open and has not consumed attributable work.";
  } else if (outcome.state === "IN_FLIGHT") {
    status = "OPEN_IN_FLIGHT";
    integrity = "EXACT";
    diagnostic = "The current decision remains open while its exact target is in flight.";
  } else if (outcome.state === "REGRESSED_OR_RESCOPED") {
    status = "INCOMPARABLE";
    integrity = "UNBOUND_RESCOPE";
    diagnostic = "The target rescoped without an exact successor boundary.";
  } else if (!outcome.usageComplete) {
    status = "INCOMPARABLE";
    integrity = "INCOMPLETE_USAGE";
    diagnostic = "The latest outcome has incomplete model or wall-clock usage.";
  } else if (terminalState(outcome.state)) {
    status = "CURRENT_TERMINAL_OBSERVATION";
    integrity = "EXACT";
    comparable = true;
    terminal = true;
    endedAt = observation.observedAt;
    diagnostic = "The latest retained terminal observation is a current comparable sample.";
  } else {
    status = "INCOMPARABLE";
    integrity = "UNBOUND_RESCOPE";
    diagnostic = "The current outcome cannot define a terminal comparison window.";
  }
  const candidateArtifacts = outcome?.newArtifactRefs ?? [];
  const duplicateArtifactCreditCount = candidateArtifacts.filter((ref) =>
    input.credited.has(ref)
  ).length;
  const creditedArtifactRefs = Object.freeze(candidateArtifacts.filter((ref) =>
    !input.credited.has(ref)
  ));
  if (duplicateArtifactCreditCount > 0) {
    comparable = false;
    status = "INCOMPARABLE";
    integrity = "DUPLICATE_ARTIFACT_CREDIT";
    diagnostic = "At least one artifact was already credited to an earlier decision window.";
  } else if (comparable) {
    for (const ref of creditedArtifactRefs) input.credited.add(ref);
  }
  return Object.freeze({
    schemaVersion: "pmh.discovery-decision-window.v1" as const,
    episodeId: episode.episodeId,
    workItemId: episode.workItemId,
    allocationPolicyIdentity: episode.allocationPolicyIdentity,
    allocationLane: episode.allocationLane,
    allocationActionKind: episode.allocationActionKind,
    noveltyReason: episode.noveltyReason,
    downstreamSystem: episode.downstreamSystem,
    campaignMembershipBound: episode.captureRef.startsWith("agent-campaign:"),
    startedAt: episode.capturedAt,
    endedAt,
    boundaryEpisodeId: observation?.boundaryEpisodeId ?? null,
    observationId: observation?.observationId ?? null,
    outcomeState: outcome?.state ?? null,
    status,
    integrity,
    comparable,
    acted: outcome !== null &&
      (outcome.attributionBasis === "TARGET_LINEAGE_OBSERVED" || hasCost(outcome.costDelta)),
    terminal,
    creditedArtifactRefs,
    duplicateArtifactCreditCount,
    yieldDelta: outcome?.yieldDelta ?? ZERO_YIELD,
    cost: outcome?.costDelta ?? ZERO_COST,
    usageComplete: outcome?.usageComplete ?? false,
    diagnostic,
    authority: "DESCRIPTIVE_DISCOVERY_YIELD_ONLY" as const,
    policyMutationAuthority: false as const,
    automaticDispatch: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}

function rate(count: number, knownTokens: bigint, qualified: boolean): string | null {
  if (!qualified || knownTokens === 0n) return null;
  return (BigInt(count) * RATE_BASIS_TOKENS * RATE_SCALE / knownTokens).toString();
}

function stratum(windows: readonly DiscoveryDecisionWindow[]): DiscoveryYieldStratum {
  const first = windows[0]!;
  const comparable = windows.filter((item) => item.comparable && item.terminal);
  const sumCount = (field: keyof ResearchDecisionOutcome["yieldDelta"]) =>
    comparable.reduce((sum, item) => sum + item.yieldDelta[field], 0);
  const sumCost = (field: "knownInputTokens" | "knownOutputTokens" |
    "knownReasoningTokens" | "knownWallClockMs") => comparable.reduce((sum, item) =>
      sum + BigInt(item.cost[field]), 0n
    );
  const knownInputTokens = sumCost("knownInputTokens");
  const knownOutputTokens = sumCost("knownOutputTokens");
  const knownReasoningTokens = sumCost("knownReasoningTokens");
  const knownTotalTokens = knownInputTokens + knownOutputTokens + knownReasoningTokens;
  const positiveFindingCount = sumCount("newPositiveFindingCount");
  const counterexampleCount = sumCount("newCounterexampleCount");
  const positiveValueStageDelta = sumCount("positiveValueStageDelta");
  const productiveWindowCount = comparable.filter((item) =>
    item.yieldDelta.newPositiveFindingCount > 0 ||
    item.yieldDelta.newCounterexampleCount > 0 ||
    item.yieldDelta.newNoFindingTerminalRunCount > 0 ||
    item.yieldDelta.positiveValueStageDelta > 0
  ).length;
  // Open exposure is not part of the completed denominator yet. Only a terminal
  // interval with incomplete usage makes the retained yield sample unknowable.
  const unknownUsageWindowCount = windows.filter((item) =>
    item.terminal && !item.usageComplete
  ).length;
  const qualified = comparable.length >= TERMINAL_EVIDENCE_MINIMUM &&
    unknownUsageWindowCount === 0 && knownTotalTokens > 0n;
  const identity = Object.freeze({
    allocationPolicyIdentity: first.allocationPolicyIdentity,
    allocationLane: first.allocationLane,
    allocationActionKind: first.allocationActionKind,
    noveltyReason: first.noveltyReason,
    downstreamSystem: first.downstreamSystem,
  });
  return Object.freeze({
    schemaVersion: "pmh.discovery-yield-stratum.v1" as const,
    stratumId: hashCanonical({
      schemaVersion: "pmh.discovery-yield-stratum-identity.v1",
      ...identity,
    }),
    ...identity,
    selectedWindowCount: windows.length,
    actedWindowCount: windows.filter((item) => item.acted).length,
    terminalWindowCount: windows.filter((item) => item.terminal).length,
    comparableTerminalWindowCount: comparable.length,
    nonComparableWindowCount: windows.filter((item) => !item.comparable).length,
    positiveFindingCount,
    counterexampleCount,
    noFindingTerminalRunCount: sumCount("newNoFindingTerminalRunCount"),
    successfulWithoutAcceptedResultCount:
      sumCount("newSuccessfulWithoutAcceptedResultCount"),
    semanticReviewJobCount: sumCount("newSemanticReviewJobCount"),
    probabilityJobCount: sumCount("newProbabilityJobCount"),
    exactTargetArtifactCount: sumCount("newExactTargetArtifactCount"),
    newRunCount: sumCount("newRunCount"),
    positiveValueStageDelta,
    productiveWindowCount,
    spentWithoutMovementWindowCount: comparable.filter((item) =>
      item.outcomeState === "SPENT_WITHOUT_MOVEMENT"
    ).length,
    knownInputTokens: knownInputTokens.toString(),
    knownOutputTokens: knownOutputTokens.toString(),
    knownReasoningTokens: knownReasoningTokens.toString(),
    knownTotalTokens: knownTotalTokens.toString(),
    knownWallClockMs: sumCost("knownWallClockMs").toString(),
    unknownUsageWindowCount,
    terminalEvidenceMinimum: TERMINAL_EVIDENCE_MINIMUM,
    yieldCostEstimateQualified: qualified,
    ratesPer100kKnownTokens: Object.freeze({
      scale: RATE_SCALE.toString() as "1000000",
      unit: "EVENTS_PER_100000_KNOWN_TOKENS" as const,
      positiveFindings: rate(positiveFindingCount, knownTotalTokens, qualified),
      counterexamples: rate(counterexampleCount, knownTotalTokens, qualified),
      productiveWindows: rate(productiveWindowCount, knownTotalTokens, qualified),
      positiveValueStageDelta: rate(positiveValueStageDelta, knownTotalTokens, qualified),
    }),
  });
}

export function buildDiscoveryYieldProjection(input: Readonly<{
  observedAt: string;
  episodes: readonly ResearchDecisionEpisode[];
  observations: readonly ResearchDecisionOutcomeObservation[];
}>): DiscoveryYieldProjection {
  const observedAtMs = Date.parse(input.observedAt);
  if (!Number.isFinite(observedAtMs) ||
      new Date(observedAtMs).toISOString() !== input.observedAt ||
      input.episodes.length > MAX_WINDOWS || input.observations.length > 4096) {
    throw new Error("discovery yield input is invalid or unbounded");
  }
  const episodes = input.episodes.map(assertResearchDecisionEpisode).sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt) ||
    left.episodeId.localeCompare(right.episodeId)
  );
  const observations = input.observations.map(assertResearchDecisionOutcomeObservation);
  const latest = latestObservations(observations);
  const credited = new Set<Hash>();
  const windows = Object.freeze(episodes.map((episode) => {
    const family = episode.workItemId === null ? [] : episodes.filter((item) =>
      item.workItemId === episode.workItemId
    );
    const index = family.findIndex((item) => item.episodeId === episode.episodeId);
    const immediateSuccessor = index >= 0 ? family[index + 1] ?? null : null;
    const body = windowBody({
      episode,
      observation: latest.get(episode.episodeId) ?? null,
      immediateSuccessor,
      credited,
    });
    return Object.freeze({ ...body, windowId: hashCanonical(body) });
  }));
  const grouped = new Map<Hash, DiscoveryDecisionWindow[]>();
  for (const window of windows) {
    const key = hashCanonical({
      policy: window.allocationPolicyIdentity,
      lane: window.allocationLane,
      kind: window.allocationActionKind,
      novelty: window.noveltyReason,
      downstream: window.downstreamSystem,
    });
    grouped.set(key, [...(grouped.get(key) ?? []), window]);
  }
  const strata = Object.freeze([...grouped.values()].map(stratum).sort((left, right) =>
    left.downstreamSystem.localeCompare(right.downstreamSystem) ||
    left.allocationLane.localeCompare(right.allocationLane) ||
    left.stratumId.localeCompare(right.stratumId)
  ));
  const body = Object.freeze({
    schemaVersion: "pmh.discovery-yield-projection.v1" as const,
    observedAt: input.observedAt,
    episodeCount: episodes.length,
    observationCount: observations.length,
    windowCount: windows.length,
    campaignMembershipBoundWindowCount: windows.filter((item) =>
      item.campaignMembershipBound
    ).length,
    newRunCount: windows.filter((item) => item.comparable).reduce((sum, item) =>
      sum + item.yieldDelta.newRunCount, 0
    ),
    actedWindowCount: windows.filter((item) => item.acted).length,
    openWindowCount: windows.filter((item) => item.status.startsWith("OPEN_")).length,
    terminalWindowCount: windows.filter((item) => item.terminal).length,
    comparableTerminalWindowCount: windows.filter((item) =>
      item.terminal && item.comparable
    ).length,
    productiveComparableWindowCount: windows.filter((item) =>
      item.terminal && item.comparable && (
        item.yieldDelta.newPositiveFindingCount > 0 ||
        item.yieldDelta.newCounterexampleCount > 0 ||
        item.yieldDelta.newNoFindingTerminalRunCount > 0 ||
        item.yieldDelta.positiveValueStageDelta > 0
      )
    ).length,
    nonComparableWindowCount: windows.filter((item) => !item.comparable).length,
    representedStratumCount: strata.length,
    qualifiedStratumCount: strata.filter((item) =>
      item.yieldCostEstimateQualified
    ).length,
    windows,
    strata,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_DISCOVERY_YIELD_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
