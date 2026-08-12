import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  ResearchActionTarget,
  ResearchActionTargetProjection,
} from "./research-action-targets.js";
import type {
  ResearchAttentionAllocationAction,
  ResearchAttentionAllocationProjection,
  ResearchAttentionFamilyScorecard,
  ResearchAttentionNoveltyReason,
  ResearchAttentionValueStage,
} from "./research-attention-allocation.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const INTEGER_PATTERN = /^(0|[1-9][0-9]*)$/u;
const MAX_EPISODES = 512;
const ACTION_KINDS = Object.freeze([
  "EXPLORE_NEW_FAMILY", "RECHECK_CHANGED_EVIDENCE", "FALSIFY_RELATION",
  "ADVANCE_RESEARCH_DEBT", "EXPAND_REVIEWED_NEIGHBORHOOD",
  "PROPOSE_ONTOLOGY_MUTATION",
] as const);
const ACTION_LANES = Object.freeze([
  "EXPLORATION", "FALSIFICATION_OR_DEBT", "CHANGED_EVIDENCE_RECHECK",
  "ONTOLOGY_MUTATION",
] as const);
const VALUE_STAGES = Object.freeze([
  "PORTFOLIO_EXHAUSTED", "UNATTEMPTED", "ATTEMPTED", "NEGATIVE_EVIDENCE",
  "POSITIVE_FINDING", "SEMANTICALLY_REVIEWED", "SEMANTICALLY_ADMITTED",
  "PROBABILITY_RESEARCH",
] as const);
const TARGET_STATES = Object.freeze([
  "READY_RELATION_DISCOVERY", "READY_OFFICIAL_SOURCE_DISCOVERY",
  "OFFICIAL_SOURCE_DISCOVERY_IN_FLIGHT", "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH",
  "READY_EVIDENCE_ACQUISITION", "EVIDENCE_ACQUISITION_IN_FLIGHT",
  "READY_RULE_INTERPRETATION", "RULE_INTERPRETATION_IN_FLIGHT",
  "REVIEW_REENTRY_READY", "REQUIREMENT_SATISFIED", "NEEDS_BOUNDED_REQUIREMENT",
  "HOLD",
] as const);
const DOWNSTREAM_SYSTEMS = Object.freeze([
  "RELATION_DISCOVERY", "RELATION_FALSIFICATION", "OFFICIAL_SOURCE_DISCOVERY",
  "EVIDENCE_ACQUISITION", "RULE_EVIDENCE_INTERPRETATION", "SEMANTIC_REVIEW",
  "ONTOLOGY_DESIGN", "UNRESOLVED",
] as const);
const NOVELTY_REASONS = Object.freeze([
  "NEW_STABLE_FAMILY", "WORK_ARTIFACT_CHANGED", "CORPUS_REVISION_ONLY",
  "DOWNSTREAM_RESEARCH_DEBT", "MISSING_COUNTEREXAMPLE",
  "PORTFOLIO_EXHAUSTED", "NO_BOUNDED_NOVELTY",
] as const);

export type ResearchDecisionCost = Readonly<{
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownWallClockMs: string;
  unknownInputInvocationCount: number;
  unknownOutputInvocationCount: number;
  unknownReasoningInvocationCount: number;
  incompleteWallClockRunCount: number;
  providerRequestCount: number;
  toolCallCount: number;
  fetchAttemptCount: number;
  interpretationAttemptCount: number;
}>;

export type ResearchDecisionEvidenceBaseline = Readonly<{
  valueStage: ResearchAttentionValueStage | "PORTFOLIO_EXHAUSTED";
  targetState: ResearchActionTarget["state"];
  runIds: readonly Hash[];
  positiveFindingIds: readonly Hash[];
  counterexampleIds: readonly Hash[];
  semanticReviewJobIds: readonly Hash[];
  probabilityJobIds: readonly Hash[];
  exactTargetArtifactRefs: readonly Hash[];
  counterexampleCount?: number;
  noFindingTerminalRunCount?: number;
  successfulWithoutAcceptedResultCount?: number;
  cost: ResearchDecisionCost;
  usageComplete: boolean;
}>;

type ResearchDecisionEpisodeFields = Readonly<{
  episodeId: Hash;
  capturedAt: string;
  captureRef: string;
  allocationProjectionIdentity: Hash;
  allocationPolicyIdentity: Hash;
  allocationObservedAt: string;
  allocationActionId: Hash;
  allocationActionKind: ResearchAttentionAllocationAction["kind"];
  allocationLane: ResearchAttentionAllocationAction["lane"];
  actionTargetProjectionIdentity: Hash;
  targetId: Hash;
  workItemId: Hash | null;
  proposalId: Hash | null;
  requirementId: Hash | null;
  sourceTaskId: Hash | null;
  downstreamSystem: ResearchActionTarget["downstreamSystem"];
  baseline: ResearchDecisionEvidenceBaseline;
  authority: "RESEARCH_DECISION_EVIDENCE_ONLY";
  providerRequestsStartedByCapture: 0;
  modelInvocationsStartedByCapture: 0;
  fetchesStartedByCapture: 0;
  campaignsCreatedByCapture: 0;
  runsCreatedByCapture: 0;
  schedulerDispatchesStartedByCapture: 0;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResearchDecisionEpisode =
  | Readonly<ResearchDecisionEpisodeFields & {
      schemaVersion: "pmh.research-decision-episode.v1";
    }>
  | Readonly<ResearchDecisionEpisodeFields & {
      schemaVersion: "pmh.research-decision-episode.v2";
      noveltyReason: ResearchAttentionNoveltyReason;
    }>;

export interface ResearchDecisionEpisodeStore {
  loadResearchDecisionEpisodes(limit: number): readonly ResearchDecisionEpisode[];
  loadResearchDecisionEpisode(episodeId: Hash): ResearchDecisionEpisode | null;
  saveResearchDecisionEpisode(episode: ResearchDecisionEpisode): ResearchDecisionEpisode;
}

export type ResearchDecisionOutcomeState =
  | "UNACTED_READY"
  | "USEFUL_NEGATIVE_MEMORY"
  | "IN_FLIGHT"
  | "ADVANCED"
  | "SPENT_WITHOUT_MOVEMENT"
  | "REGRESSED_OR_RESCOPED"
  | "TERMINAL_HOLD"
  | "ATTRIBUTION_INCOMPLETE";

export type ResearchDecisionOutcome = Readonly<{
  schemaVersion: "pmh.research-decision-outcome.v1";
  outcomeId: Hash;
  episodeId: Hash;
  capturedAt: string;
  allocationActionId: Hash;
  noveltyReason: ResearchAttentionNoveltyReason | "LEGACY_UNBOUND";
  targetId: Hash;
  workItemId: Hash | null;
  observedAt: string;
  state: ResearchDecisionOutcomeState;
  attributionBasis: "NOT_ACTED" | "TARGET_LINEAGE_OBSERVED";
  baselineValueStage: ResearchDecisionEpisode["baseline"]["valueStage"];
  currentValueStage: ResearchAttentionValueStage | null;
  valueStageDelta: number | null;
  currentTargetState: ResearchActionTarget["state"] | null;
  newArtifactRefs: readonly Hash[];
  antiLoopMemory: Readonly<{
    newCounterexampleCount: number;
    newNoFindingTerminalRunCount: number;
    newSuccessfulWithoutAcceptedResultCount: number;
    retainedCounterexampleCount: number;
    retainedNoFindingTerminalRunCount: number;
    exactTaskAlreadyAttempted: boolean;
  }>;
  costDelta: ResearchDecisionCost;
  usageComplete: boolean;
  diagnostic: string;
  authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  automaticDispatch: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResearchDecisionOutcomeProjection = Readonly<{
  schemaVersion: "pmh.research-decision-outcome-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  episodeCount: number;
  outcomeCounts: Readonly<Record<ResearchDecisionOutcomeState, number>>;
  outcomes: readonly ResearchDecisionOutcome[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  fetchesStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  schedulerDispatchesStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function unique(items: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(items)].sort());
}

function familyArtifacts(family: ResearchAttentionFamilyScorecard | null): readonly Hash[] {
  return family === null ? Object.freeze([]) : unique([
    ...family.runIds,
    ...family.positiveFindingIds,
    ...family.counterexampleIds,
    ...family.semanticReviewJobIds,
    ...family.probabilityJobIds,
  ]);
}

function zeroCost(): ResearchDecisionCost {
  return Object.freeze({
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
}

function cost(
  family: ResearchAttentionFamilyScorecard | null,
  retainedCost: ResearchActionTarget["retainedCost"],
): ResearchDecisionCost {
  return Object.freeze({
    knownInputTokens: family?.usage.knownInputTokens ?? "0",
    knownOutputTokens: family?.usage.knownOutputTokens ?? "0",
    knownReasoningTokens: family?.usage.knownReasoningTokens ?? "0",
    knownWallClockMs: family?.usage.knownWallClockMs ?? "0",
    unknownInputInvocationCount: family?.usage.unknownInputInvocationCount ?? 0,
    unknownOutputInvocationCount: family?.usage.unknownOutputInvocationCount ?? 0,
    unknownReasoningInvocationCount: family?.usage.unknownReasoningInvocationCount ?? 0,
    incompleteWallClockRunCount: family?.usage.incompleteWallClockRunCount ?? 0,
    ...retainedCost,
  });
}

export function researchDecisionEpisodeId(input: Readonly<{
  allocationProjectionIdentity: Hash;
  allocationActionId: Hash;
  targetId: Hash;
  captureRef: string;
  noveltyReason?: ResearchAttentionNoveltyReason;
}>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.research-decision-episode-identity.v1",
    ...input,
  });
}

export function buildResearchDecisionEpisode(input: Readonly<{
  allocation: ResearchAttentionAllocationProjection;
  targets: ResearchActionTargetProjection;
  allocationActionId: Hash;
  targetId: Hash;
  capturedAt: string;
  captureRef: string;
}>): ResearchDecisionEpisode {
  if (input.targets.allocationProjectionIdentity !== input.allocation.projectionIdentity) {
    throw new Error("research decision target projection does not match allocation");
  }
  if (!Number.isFinite(Date.parse(input.capturedAt))) {
    throw new Error("research decision capture time is invalid");
  }
  const captureRef = input.captureRef.trim();
  if (!/^[a-z0-9][a-z0-9:._/-]{0,127}$/iu.test(captureRef)) {
    throw new Error("research decision capture reference is invalid");
  }
  const action = input.allocation.portfolio.find((item) =>
    item.actionId === input.allocationActionId
  );
  const target = input.targets.targets.find((item) => item.targetId === input.targetId);
  if (action === undefined || target === undefined ||
      target.allocationActionId !== action.actionId) {
    throw new Error("research decision action or target is stale or mismatched");
  }
  const family = action.workItemId === null ? null : input.allocation.families.find((item) =>
    item.workItemId === action.workItemId && item.scorecardId === action.scorecardId
  ) ?? null;
  if (action.workItemId !== null && family === null) {
    throw new Error("research decision family scorecard is unavailable");
  }
  const baselineCost = cost(family, target.retainedCost);
  const baseline: ResearchDecisionEvidenceBaseline = Object.freeze({
    valueStage: action.valueStage,
    targetState: target.state,
    runIds: family?.runIds ?? Object.freeze([]),
    positiveFindingIds: family?.positiveFindingIds ?? Object.freeze([]),
    counterexampleIds: family?.counterexampleIds ?? Object.freeze([]),
    semanticReviewJobIds: family?.semanticReviewJobIds ?? Object.freeze([]),
    probabilityJobIds: family?.probabilityJobIds ?? Object.freeze([]),
    exactTargetArtifactRefs: target.exactArtifactRefs,
    counterexampleCount: family?.counterexampleCount ?? 0,
    noFindingTerminalRunCount: family?.noFindingTerminalRunCount ?? 0,
    successfulWithoutAcceptedResultCount:
      family?.successfulWithoutAcceptedResultCount ?? 0,
    cost: baselineCost,
    usageComplete: baselineCost.unknownInputInvocationCount === 0 &&
      baselineCost.unknownOutputInvocationCount === 0 &&
      baselineCost.unknownReasoningInvocationCount === 0 &&
      baselineCost.incompleteWallClockRunCount === 0,
  });
  const episodeId = researchDecisionEpisodeId({
    allocationProjectionIdentity: input.allocation.projectionIdentity,
    allocationActionId: action.actionId,
    targetId: target.targetId,
    captureRef,
    noveltyReason: action.noveltyReason,
  });
  return assertResearchDecisionEpisode(Object.freeze({
    schemaVersion: "pmh.research-decision-episode.v2" as const,
    episodeId,
    capturedAt: input.capturedAt,
    captureRef,
    allocationProjectionIdentity: input.allocation.projectionIdentity,
    allocationPolicyIdentity: input.allocation.policy.policyIdentity,
    allocationObservedAt: input.allocation.observedAt,
    allocationActionId: action.actionId,
    allocationActionKind: action.kind,
    allocationLane: action.lane,
    noveltyReason: action.noveltyReason,
    actionTargetProjectionIdentity: input.targets.projectionIdentity,
    targetId: target.targetId,
    workItemId: action.workItemId,
    proposalId: target.proposalId,
    requirementId: target.requirementId,
    sourceTaskId: target.sourceTaskId,
    downstreamSystem: target.downstreamSystem,
    baseline,
    authority: "RESEARCH_DECISION_EVIDENCE_ONLY" as const,
    providerRequestsStartedByCapture: 0 as const,
    modelInvocationsStartedByCapture: 0 as const,
    fetchesStartedByCapture: 0 as const,
    campaignsCreatedByCapture: 0 as const,
    runsCreatedByCapture: 0 as const,
    schedulerDispatchesStartedByCapture: 0 as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  }));
}

function validHashes(value: unknown): value is readonly Hash[] {
  return Array.isArray(value) && value.length <= 512 &&
    value.every((item) => typeof item === "string" && HASH_PATTERN.test(item)) &&
    value.join("\n") === [...value].sort().join("\n") &&
    new Set(value).size === value.length;
}

function validCost(value: unknown): value is ResearchDecisionCost {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["knownInputTokens", "knownOutputTokens", "knownReasoningTokens", "knownWallClockMs"]
    .every((key) => typeof item[key] === "string" && INTEGER_PATTERN.test(item[key] as string)) &&
    ["unknownInputInvocationCount", "unknownOutputInvocationCount",
      "unknownReasoningInvocationCount", "incompleteWallClockRunCount",
      "providerRequestCount", "toolCallCount", "fetchAttemptCount",
      "interpretationAttemptCount"].every((key) =>
      Number.isSafeInteger(item[key]) && Number(item[key]) >= 0
    );
}

export function assertResearchDecisionEpisode(value: unknown): ResearchDecisionEpisode {
  if (value === null || typeof value !== "object") {
    throw new Error("research decision episode is malformed");
  }
  const item = value as ResearchDecisionEpisode;
  const baseline = item.baseline;
  const nullableHashes = [item.workItemId, item.proposalId, item.requirementId, item.sourceTaskId];
  const noveltyBound = item.schemaVersion === "pmh.research-decision-episode.v2";
  const legacy = item.schemaVersion === "pmh.research-decision-episode.v1";
  const noveltyReason = noveltyBound ? item.noveltyReason : undefined;
  if ((!legacy && !noveltyBound) ||
      !HASH_PATTERN.test(String(item.episodeId)) ||
      !HASH_PATTERN.test(String(item.allocationProjectionIdentity)) ||
      !HASH_PATTERN.test(String(item.allocationPolicyIdentity)) ||
      !HASH_PATTERN.test(String(item.allocationActionId)) ||
      !HASH_PATTERN.test(String(item.actionTargetProjectionIdentity)) ||
      !HASH_PATTERN.test(String(item.targetId)) ||
      nullableHashes.some((hash) => hash !== null && !HASH_PATTERN.test(String(hash))) ||
      !Number.isFinite(Date.parse(String(item.capturedAt))) ||
      !Number.isFinite(Date.parse(String(item.allocationObservedAt))) ||
      !/^[a-z0-9][a-z0-9:._/-]{0,127}$/iu.test(String(item.captureRef)) ||
      !ACTION_KINDS.includes(item.allocationActionKind) ||
      !ACTION_LANES.includes(item.allocationLane) ||
      !DOWNSTREAM_SYSTEMS.includes(item.downstreamSystem) ||
      baseline === null || typeof baseline !== "object" ||
      !VALUE_STAGES.includes(baseline.valueStage) ||
      !TARGET_STATES.includes(baseline.targetState) ||
      !validHashes(baseline.runIds) || !validHashes(baseline.positiveFindingIds) ||
      !validHashes(baseline.counterexampleIds) ||
      !validHashes(baseline.semanticReviewJobIds) ||
      !validHashes(baseline.probabilityJobIds) ||
      !validHashes(baseline.exactTargetArtifactRefs) || !validCost(baseline.cost) ||
      (noveltyBound && !NOVELTY_REASONS.includes(
        noveltyReason as (typeof NOVELTY_REASONS)[number]
      )) ||
      (noveltyBound && [baseline.counterexampleCount,
        baseline.noFindingTerminalRunCount,
        baseline.successfulWithoutAcceptedResultCount].some((count) =>
        !Number.isSafeInteger(count) || Number(count) < 0
      )) ||
      typeof baseline.usageComplete !== "boolean" ||
      baseline.usageComplete !== (
        baseline.cost.unknownInputInvocationCount === 0 &&
        baseline.cost.unknownOutputInvocationCount === 0 &&
        baseline.cost.unknownReasoningInvocationCount === 0 &&
        baseline.cost.incompleteWallClockRunCount === 0
      ) ||
      item.authority !== "RESEARCH_DECISION_EVIDENCE_ONLY" ||
      item.providerRequestsStartedByCapture !== 0 ||
      item.modelInvocationsStartedByCapture !== 0 ||
      item.fetchesStartedByCapture !== 0 || item.campaignsCreatedByCapture !== 0 ||
      item.runsCreatedByCapture !== 0 || item.schedulerDispatchesStartedByCapture !== 0 ||
      item.semanticDecisionAuthority !== false || item.certificateAuthority !== false ||
      item.executionAuthority !== false || item.externalWriteAuthority !== false ||
      item.valueMovingAuthority !== false ||
      item.episodeId !== (noveltyBound
        ? researchDecisionEpisodeId({
            allocationProjectionIdentity: item.allocationProjectionIdentity,
            allocationActionId: item.allocationActionId,
            targetId: item.targetId,
            captureRef: item.captureRef,
            noveltyReason: noveltyReason!,
          })
        : researchDecisionEpisodeId({
            allocationProjectionIdentity: item.allocationProjectionIdentity,
            allocationActionId: item.allocationActionId,
            targetId: item.targetId,
            captureRef: item.captureRef,
          }))) {
    throw new Error("research decision episode violates its bounded contract");
  }
  return Object.freeze(item);
}

function subtractCost(current: ResearchDecisionCost, prior: ResearchDecisionCost): ResearchDecisionCost {
  const subtractString = (left: string, right: string) => {
    const delta = BigInt(left) - BigInt(right);
    return (delta > 0n ? delta : 0n).toString();
  };
  const subtractNumber = (left: number, right: number) => Math.max(0, left - right);
  return Object.freeze({
    knownInputTokens: subtractString(current.knownInputTokens, prior.knownInputTokens),
    knownOutputTokens: subtractString(current.knownOutputTokens, prior.knownOutputTokens),
    knownReasoningTokens: subtractString(current.knownReasoningTokens, prior.knownReasoningTokens),
    knownWallClockMs: subtractString(current.knownWallClockMs, prior.knownWallClockMs),
    unknownInputInvocationCount: subtractNumber(current.unknownInputInvocationCount, prior.unknownInputInvocationCount),
    unknownOutputInvocationCount: subtractNumber(current.unknownOutputInvocationCount, prior.unknownOutputInvocationCount),
    unknownReasoningInvocationCount: subtractNumber(current.unknownReasoningInvocationCount, prior.unknownReasoningInvocationCount),
    incompleteWallClockRunCount: subtractNumber(current.incompleteWallClockRunCount, prior.incompleteWallClockRunCount),
    providerRequestCount: subtractNumber(current.providerRequestCount, prior.providerRequestCount),
    toolCallCount: subtractNumber(current.toolCallCount, prior.toolCallCount),
    fetchAttemptCount: subtractNumber(current.fetchAttemptCount, prior.fetchAttemptCount),
    interpretationAttemptCount: subtractNumber(current.interpretationAttemptCount, prior.interpretationAttemptCount),
  });
}

const STAGE_RANK: Readonly<Record<ResearchAttentionValueStage | "PORTFOLIO_EXHAUSTED", number>> = {
  PORTFOLIO_EXHAUSTED: 0,
  UNATTEMPTED: 0,
  ATTEMPTED: 1,
  NEGATIVE_EVIDENCE: 2,
  POSITIVE_FINDING: 3,
  SEMANTICALLY_REVIEWED: 4,
  SEMANTICALLY_ADMITTED: 5,
  PROBABILITY_RESEARCH: 6,
};

function hasCost(value: ResearchDecisionCost): boolean {
  return [value.knownInputTokens, value.knownOutputTokens, value.knownReasoningTokens,
    value.knownWallClockMs].some((item) => BigInt(item) > 0n) ||
    value.unknownInputInvocationCount > 0 || value.unknownOutputInvocationCount > 0 ||
    value.unknownReasoningInvocationCount > 0 || value.incompleteWallClockRunCount > 0 ||
    value.providerRequestCount > 0 || value.toolCallCount > 0 ||
    value.fetchAttemptCount > 0 || value.interpretationAttemptCount > 0;
}

function currentTargetFor(
  episode: ResearchDecisionEpisode,
  targets: ResearchActionTargetProjection,
): ResearchActionTarget | null {
  return targets.targets.find((item) =>
    item.workItemId === episode.workItemId && item.proposalId === episode.proposalId &&
    item.requirementId === episode.requirementId && item.sourceTaskId === episode.sourceTaskId &&
    item.downstreamSystem === episode.downstreamSystem
  ) ?? null;
}

function outcome(input: Readonly<{
  episode: ResearchDecisionEpisode;
  observedAt: string;
  allocation: ResearchAttentionAllocationProjection;
  targets: ResearchActionTargetProjection;
}>): ResearchDecisionOutcome {
  const family = input.episode.workItemId === null ? null : input.allocation.families.find((item) =>
    item.workItemId === input.episode.workItemId
  ) ?? null;
  const target = currentTargetFor(input.episode, input.targets);
  const currentArtifacts = unique([
    ...familyArtifacts(family),
    ...(target?.exactArtifactRefs ?? []),
  ]);
  const baselineArtifacts = new Set(unique([
    ...input.episode.baseline.runIds,
    ...input.episode.baseline.positiveFindingIds,
    ...input.episode.baseline.counterexampleIds,
    ...input.episode.baseline.semanticReviewJobIds,
    ...input.episode.baseline.probabilityJobIds,
    ...input.episode.baseline.exactTargetArtifactRefs,
  ]));
  const newArtifactRefs = Object.freeze(currentArtifacts.filter((item) =>
    !baselineArtifacts.has(item)
  ));
  const baselineProgressArtifacts = new Set(unique([
    ...input.episode.baseline.positiveFindingIds,
    ...input.episode.baseline.counterexampleIds,
    ...input.episode.baseline.semanticReviewJobIds,
    ...input.episode.baseline.probabilityJobIds,
    ...input.episode.baseline.exactTargetArtifactRefs,
  ]));
  const currentProgressArtifacts = unique([
    ...(family?.positiveFindingIds ?? []),
    ...(family?.counterexampleIds ?? []),
    ...(family?.semanticReviewJobIds ?? []),
    ...(family?.probabilityJobIds ?? []),
    ...(target?.exactArtifactRefs ?? []),
  ]);
  const newProgressArtifactCount = currentProgressArtifacts.filter((item) =>
    !baselineProgressArtifacts.has(item)
  ).length;
  const retainedCounterexampleCount = family?.counterexampleCount ?? 0;
  const retainedNoFindingTerminalRunCount = family?.noFindingTerminalRunCount ?? 0;
  const retainedSuccessfulWithoutAcceptedResultCount =
    family?.successfulWithoutAcceptedResultCount ?? 0;
  const antiLoopMemory = Object.freeze({
    newCounterexampleCount: Math.max(
      0,
      retainedCounterexampleCount - (input.episode.baseline.counterexampleCount ??
        input.episode.baseline.counterexampleIds.length),
    ),
    newNoFindingTerminalRunCount: Math.max(
      0,
      retainedNoFindingTerminalRunCount -
        (input.episode.baseline.noFindingTerminalRunCount ?? 0),
    ),
    newSuccessfulWithoutAcceptedResultCount: Math.max(
      0,
      retainedSuccessfulWithoutAcceptedResultCount -
        (input.episode.baseline.successfulWithoutAcceptedResultCount ?? 0),
    ),
    retainedCounterexampleCount,
    retainedNoFindingTerminalRunCount,
    exactTaskAlreadyAttempted: input.episode.sourceTaskId !== null &&
      family?.currentTaskId === input.episode.sourceTaskId &&
      family.currentTaskAttempted,
  });
  const currentCost = target === null ? (family === null ? zeroCost() : cost(family, {
    providerRequestCount: 0,
    toolCallCount: 0,
    fetchAttemptCount: 0,
    interpretationAttemptCount: 0,
  })) : cost(family, target.retainedCost);
  const costDelta = subtractCost(currentCost, input.episode.baseline.cost);
  const baselineRank = STAGE_RANK[input.episode.baseline.valueStage];
  const currentValueStage = family?.valueStage ?? null;
  const valueStageDelta = currentValueStage === null ? null :
    STAGE_RANK[currentValueStage] - baselineRank;
  const usageComplete = input.episode.baseline.usageComplete &&
    currentCost.unknownInputInvocationCount === 0 &&
    currentCost.unknownOutputInvocationCount === 0 &&
    currentCost.unknownReasoningInvocationCount === 0 &&
    currentCost.incompleteWallClockRunCount === 0;
  const inFlight = target !== null && target.state.endsWith("_IN_FLIGHT");
  const usefulNegative = antiLoopMemory.newCounterexampleCount > 0 ||
    antiLoopMemory.newNoFindingTerminalRunCount > 0 ||
    (input.episode.baseline.targetState === "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH" &&
      (target?.state ?? input.episode.baseline.targetState) ===
        "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH" &&
      !hasCost(costDelta));
  const advanced = (valueStageDelta ?? 0) > 0 || newProgressArtifactCount > 0;
  let state: ResearchDecisionOutcomeState;
  let diagnostic: string;
  if (!usageComplete) {
    state = "ATTRIBUTION_INCOMPLETE";
    diagnostic = "Usage lineage is incomplete, so efficiency cannot be compared honestly";
  } else if (usefulNegative) {
    state = "USEFUL_NEGATIVE_MEMORY";
    diagnostic = antiLoopMemory.newCounterexampleCount > 0 ||
      antiLoopMemory.newNoFindingTerminalRunCount > 0
      ? "Exact-lineage counterexample or no-yield evidence now prevents duplicate research spend"
      : "Retained terminal negative evidence still prevents duplicate research spend";
  } else if (inFlight) {
    state = "IN_FLIGHT";
    diagnostic = "The exact downstream target is currently in flight";
  } else if (advanced) {
    state = "ADVANCED";
    diagnostic = "Exact family or target lineage gained a later evidence-stage artifact";
  } else if (hasCost(costDelta)) {
    state = "SPENT_WITHOUT_MOVEMENT";
    diagnostic = "Attributable cost increased without evidence-stage movement";
  } else if (target === null && family !== null) {
    state = "REGRESSED_OR_RESCOPED";
    diagnostic = "The stable family remains, but the exact selected target is no longer current";
  } else if (target?.state.startsWith("READY_") ||
      (target === null && input.episode.baseline.targetState.startsWith("READY_"))) {
    state = "UNACTED_READY";
    diagnostic = "The exact selected target remains ready with no observed downstream movement";
  } else if (target !== null || input.episode.baseline.targetState.includes("BLOCKED") ||
      input.episode.baseline.targetState === "HOLD") {
    state = "TERMINAL_HOLD";
    diagnostic = "The target remains boundedly held without new attributable spend";
  } else {
    state = "ATTRIBUTION_INCOMPLETE";
    diagnostic = "The retained lineage is insufficient to resolve the decision outcome";
  }
  const body = Object.freeze({
    schemaVersion: "pmh.research-decision-outcome.v1" as const,
    episodeId: input.episode.episodeId,
    capturedAt: input.episode.capturedAt,
    allocationActionId: input.episode.allocationActionId,
    noveltyReason: input.episode.schemaVersion === "pmh.research-decision-episode.v2"
      ? input.episode.noveltyReason : "LEGACY_UNBOUND" as const,
    targetId: input.episode.targetId,
    workItemId: input.episode.workItemId,
    observedAt: input.observedAt,
    state,
    attributionBasis: advanced || inFlight || hasCost(costDelta)
      ? "TARGET_LINEAGE_OBSERVED" as const : "NOT_ACTED" as const,
    baselineValueStage: input.episode.baseline.valueStage,
    currentValueStage,
    valueStageDelta,
    currentTargetState: target?.state ?? null,
    newArtifactRefs,
    antiLoopMemory,
    costDelta,
    usageComplete,
    diagnostic,
    authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    automaticDispatch: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, outcomeId: hashCanonical(body) });
}

export function buildResearchDecisionOutcomeProjection(input: Readonly<{
  observedAt: string;
  episodes: readonly ResearchDecisionEpisode[];
  allocation: ResearchAttentionAllocationProjection;
  targets: ResearchActionTargetProjection;
}>): ResearchDecisionOutcomeProjection {
  if (input.episodes.length > MAX_EPISODES || !Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("research decision outcome input is invalid or unbounded");
  }
  const episodes = input.episodes.map(assertResearchDecisionEpisode);
  const outcomes = Object.freeze(episodes.map((episode) => outcome({
    episode,
    observedAt: input.observedAt,
    allocation: input.allocation,
    targets: input.targets,
  })).sort((left, right) => left.episodeId.localeCompare(right.episodeId)));
  const states: readonly ResearchDecisionOutcomeState[] = Object.freeze([
    "UNACTED_READY", "USEFUL_NEGATIVE_MEMORY", "IN_FLIGHT", "ADVANCED",
    "SPENT_WITHOUT_MOVEMENT", "REGRESSED_OR_RESCOPED", "TERMINAL_HOLD",
    "ATTRIBUTION_INCOMPLETE",
  ]);
  const outcomeCounts = Object.freeze(Object.fromEntries(states.map((state) =>
    [state, outcomes.filter((item) => item.state === state).length]
  )) as Record<ResearchDecisionOutcomeState, number>);
  const body = Object.freeze({
    schemaVersion: "pmh.research-decision-outcome-projection.v1" as const,
    observedAt: input.observedAt,
    episodeCount: outcomes.length,
    outcomeCounts,
    outcomes,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    fetchesStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    schedulerDispatchesStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_RESEARCH_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
