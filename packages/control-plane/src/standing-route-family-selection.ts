import { hashCanonical, type Hash } from "@pmh/domain";
import type { StandingRouteSeedOutcomeProjection } from
  "./standing-route-seeding-outcomes.js";
import type {
  StandingOntologyRouteProjection,
  StandingOntologyRouteValueProjection,
} from "./standing-ontology-routes.js";

const QUIET_REVIEW_HORIZON_MS = 7n * 24n * 60n * 60n * 1_000n;
const UNPRODUCTIVE_WAKE_MINIMUM = 3;

export type StandingRouteFamilyRecommendation = "ADOPT" | "HOLD" | "RETIRE";

export type StandingRouteFamilySelectionReason =
  | "ADOPT_DOWNSTREAM_PROGRESS"
  | "HOLD_CONFLICTING_SEED"
  | "HOLD_AWAITING_FIRST_WAKE"
  | "HOLD_QUIET_HORIZON_REACHED"
  | "HOLD_WAKE_UNATTEMPTED"
  | "HOLD_REVIEW_IN_PROGRESS"
  | "HOLD_EVIDENCE_IMMATURE"
  | "RETIRE_QUERY_TOO_BROAD"
  | "RETIRE_REPEATED_UNPRODUCTIVE_WAKES";

export type StandingRouteFamilySelection = Readonly<{
  schemaVersion: "pmh.standing-route-family-selection.v1";
  selectionId: Hash;
  routeFamilyId: Hash;
  sourceValueId: Hash;
  observedAt: string;
  recommendation: StandingRouteFamilyRecommendation;
  reason: StandingRouteFamilySelectionReason;
  rationale: string;
  missingObservation: string | null;
  nextReviewTrigger: string;
  seedConflictCount: number;
  cleanSeedCount: number;
  observedWakeCount: number;
  attemptedFollowupRunCount: number;
  positiveFindingCount: number;
  semanticReviewPassCount: number;
  probabilityJobCount: number;
  opportunityCount: number;
  quietReviewHorizonMs: string;
  unproductiveWakeMinimum: number;
  authority: "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY";
  automaticMutation: false;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingRouteFamilySelectionProjection = Readonly<{
  schemaVersion: "pmh.standing-route-family-selection-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  familyCount: number;
  adoptCount: number;
  holdCount: number;
  retireCount: number;
  selections: readonly StandingRouteFamilySelection[];
  quietReviewHorizonMs: string;
  unproductiveWakeMinimum: number;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  writesStartedByRead: 0;
  automaticMutation: false;
  automaticDispatch: false;
  authority: "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

type Decision = Readonly<{
  recommendation: StandingRouteFamilyRecommendation;
  reason: StandingRouteFamilySelectionReason;
  rationale: string;
  missingObservation: string | null;
  nextReviewTrigger: string;
}>;

function decide(input: Readonly<{
  state: StandingOntologyRouteProjection["families"][number]["observation"]["state"];
  seedConflictCount: number;
  cleanSeedCount: number;
  observedWakeCount: number;
  followupRunCount: number;
  positiveFindingCount: number;
  semanticReviewPassCount: number;
  probabilityJobCount: number;
  opportunityCount: number;
  totalQuietDurationMs: bigint;
}>): Decision {
  if (input.state === "BLOCKED_TOO_BROAD") return Object.freeze({
    recommendation: "RETIRE",
    reason: "RETIRE_QUERY_TOO_BROAD",
    rationale: "The literal query exceeds the bounded route membership contract.",
    missingObservation: null,
    nextReviewTrigger: "A narrower independently grounded route family is retained.",
  });
  if (input.seedConflictCount > 0 && input.cleanSeedCount === 0) return Object.freeze({
    recommendation: "HOLD",
    reason: "HOLD_CONFLICTING_SEED",
    rationale: "The source seed retained both a route and a counterexample; family overlap alone cannot resolve that conflict.",
    missingObservation: "A later clean seed result corroborating the same family.",
    nextReviewTrigger: "A conflict-free seed result is retained for the same family.",
  });
  if (input.opportunityCount > 0 || input.probabilityJobCount > 0 ||
      input.semanticReviewPassCount > 0) return Object.freeze({
    recommendation: "ADOPT",
    reason: "ADOPT_DOWNSTREAM_PROGRESS",
    rationale: "At least one route wake reached independently retained downstream research progress.",
    missingObservation: null,
    nextReviewTrigger: "New negative evidence, query broadening, or downstream reversal appears.",
  });
  if (input.observedWakeCount >= UNPRODUCTIVE_WAKE_MINIMUM &&
      input.followupRunCount >= UNPRODUCTIVE_WAKE_MINIMUM &&
      input.positiveFindingCount === 0) return Object.freeze({
    recommendation: "RETIRE",
    reason: "RETIRE_REPEATED_UNPRODUCTIVE_WAKES",
    rationale: "Three or more observed wakes and attempted follow-ups produced no positive relation finding.",
    missingObservation: null,
    nextReviewTrigger: "Materially different literal evidence supports a replacement family.",
  });
  if (input.state === "EXPANDED" || input.state === "CHANGED") {
    if (input.followupRunCount === 0) return Object.freeze({
      recommendation: "HOLD",
      reason: "HOLD_WAKE_UNATTEMPTED",
      rationale: "The route has current novelty, but its bounded follow-up has not been attempted.",
      missingObservation: "One terminal follow-up result for the current membership change.",
      nextReviewTrigger: "The current wake receives a terminal follow-up result.",
    });
    return Object.freeze({
      recommendation: "HOLD",
      reason: input.positiveFindingCount > 0
        ? "HOLD_REVIEW_IN_PROGRESS"
        : "HOLD_EVIDENCE_IMMATURE",
      rationale: input.positiveFindingCount > 0
        ? "A positive route finding exists, but independent downstream review has not passed."
        : "The current wake has not yet produced selection-grade downstream progress.",
      missingObservation: input.positiveFindingCount > 0
        ? "An independent semantic review PASS or later probability work."
        : "A positive route finding or enough repeated negative wakes to retire the family.",
      nextReviewTrigger: "The wake advances downstream or reaches the unproductive-wake minimum.",
    });
  }
  const quietHorizonReached = input.totalQuietDurationMs >= QUIET_REVIEW_HORIZON_MS;
  return Object.freeze({
    recommendation: "HOLD",
    reason: quietHorizonReached
      ? "HOLD_QUIET_HORIZON_REACHED"
      : "HOLD_AWAITING_FIRST_WAKE",
    rationale: quietHorizonReached
      ? "The route remains cheap to observe but has crossed its quiet review horizon without a wake."
      : "No novelty wake has yet tested whether this literal sensor produces useful work.",
    missingObservation: "A first material membership or evidence change.",
    nextReviewTrigger: quietHorizonReached
      ? "Operator review or the first material wake."
      : "The first material wake or the seven-day quiet review horizon.",
  });
}

export function buildStandingRouteFamilySelectionProjection(input: Readonly<{
  routes: StandingOntologyRouteProjection;
  value: StandingOntologyRouteValueProjection;
  seedOutcomes: StandingRouteSeedOutcomeProjection;
  observedAt: string;
}>): StandingRouteFamilySelectionProjection {
  if (new Date(input.observedAt).toISOString() !== input.observedAt) {
    throw new Error("standing route family selection observedAt must be canonical ISO time");
  }
  const values = new Map(input.value.values.map((item) => [item.routeFamilyId, item]));
  if (values.size !== input.routes.families.length) {
    throw new Error("standing route family selection lost exact value lineage");
  }
  const selections = Object.freeze(input.routes.families.map(({ family, observation }) => {
    const value = values.get(family.routeFamilyId);
    if (value === undefined) {
      throw new Error("standing route family selection cannot resolve family value");
    }
    const seedConflictCount = input.seedOutcomes.outcomes.filter((item) =>
      item.stage === "CONFLICTING_TERMINAL_EFFECTS" &&
      item.retainedRouteFamilyIds.includes(family.routeFamilyId)
    ).length;
    const cleanSeedCount = input.seedOutcomes.outcomes.filter((item) =>
      item.stage === "ROUTE_RETAINED" &&
      item.retainedRouteFamilyIds.includes(family.routeFamilyId)
    ).length;
    const decision = decide({
      state: observation.state,
      seedConflictCount,
      cleanSeedCount,
      observedWakeCount: value.observedWakeCount,
      followupRunCount: value.followupRunIds.length,
      positiveFindingCount: value.positiveFindingIds.length,
      semanticReviewPassCount: value.semanticReviewPassCount,
      probabilityJobCount: value.probabilityJobIds.length,
      opportunityCount: value.opportunityIds.length,
      totalQuietDurationMs: BigInt(value.totalQuietDurationMs),
    });
    const body = Object.freeze({
      schemaVersion: "pmh.standing-route-family-selection.v1" as const,
      routeFamilyId: family.routeFamilyId,
      sourceValueId: value.valueId,
      observedAt: input.observedAt,
      ...decision,
      seedConflictCount,
      cleanSeedCount,
      observedWakeCount: value.observedWakeCount,
      attemptedFollowupRunCount: value.followupRunIds.length,
      positiveFindingCount: value.positiveFindingIds.length,
      semanticReviewPassCount: value.semanticReviewPassCount,
      probabilityJobCount: value.probabilityJobIds.length,
      opportunityCount: value.opportunityIds.length,
      quietReviewHorizonMs: QUIET_REVIEW_HORIZON_MS.toString(),
      unproductiveWakeMinimum: UNPRODUCTIVE_WAKE_MINIMUM,
      authority: "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY" as const,
      automaticMutation: false as const,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, selectionId: hashCanonical(body) });
  }).sort((left, right) => left.routeFamilyId.localeCompare(right.routeFamilyId)));
  const body = Object.freeze({
    schemaVersion: "pmh.standing-route-family-selection-projection.v1" as const,
    observedAt: input.observedAt,
    familyCount: selections.length,
    adoptCount: selections.filter((item) => item.recommendation === "ADOPT").length,
    holdCount: selections.filter((item) => item.recommendation === "HOLD").length,
    retireCount: selections.filter((item) => item.recommendation === "RETIRE").length,
    selections,
    quietReviewHorizonMs: QUIET_REVIEW_HORIZON_MS.toString(),
    unproductiveWakeMinimum: UNPRODUCTIVE_WAKE_MINIMUM,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticMutation: false as const,
    automaticDispatch: false as const,
    authority: "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
