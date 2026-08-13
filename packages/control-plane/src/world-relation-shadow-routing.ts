import { hashCanonical, type Hash } from "@pmh/domain";
import type { WorldRelationShadowTradeHypothesis } from
  "./world-relation-shadow-hypothesis.js";

export type WorldRelationShadowRouteAction = Readonly<{
  actionId: Hash;
  hypothesisId: Hash;
  action:
    | "RETIRE_NON_POSITIVE_MARGIN"
    | "ACQUIRE_SETTLEMENT_EVIDENCE"
    | "ESTIMATE_ADVERSE_PROBABILITY"
    | "HOLD_RESEARCH_ONLY";
  priority: number;
  diagnostic: string;
  sourceBlockers: readonly string[];
  providerRequestsStarted: 0;
  jobsCreated: 0;
  automaticDispatch: false;
  authority: "SHADOW_RESEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldRelationShadowRoutingProjection = Readonly<{
  schemaVersion: "pmh.world-relation-shadow-routing.v1";
  projectionIdentity: Hash;
  hypothesisCount: number;
  retiredCount: number;
  settlementEvidenceCount: number;
  probabilityEstimationCount: number;
  heldCount: number;
  actions: readonly WorldRelationShadowRouteAction[];
  policy:
    "MARGIN_FIRST_THEN_SETTLEMENT_EXACTNESS_THEN_PROBABILITY_BOUND";
  providerRequestsStartedByRead: 0;
  jobsCreatedByRead: 0;
  automaticDispatch: false;
  authority: "SHADOW_RESEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function route(hypothesis: WorldRelationShadowTradeHypothesis): WorldRelationShadowRouteAction {
  const blockers = hypothesis.blockers;
  const nonPositive = blockers.includes("NON_POSITIVE_INDICATIVE_FAILURE_BUDGET");
  const settlement = blockers.includes("NON_EXACT_SETTLEMENT_PROJECTION") ||
    blockers.includes("MISSING_EXACT_INPUT_PROJECTION") ||
    blockers.includes("PROJECTION_NOT_SINGLE_PREDICATE");
  const onlyProbability = blockers.length === 1 &&
    blockers[0] === "ADVERSE_PROBABILITY_BOUND_UNAVAILABLE";
  const action = nonPositive
    ? "RETIRE_NON_POSITIVE_MARGIN" as const
    : settlement
      ? "ACQUIRE_SETTLEMENT_EVIDENCE" as const
      : onlyProbability
        ? "ESTIMATE_ADVERSE_PROBABILITY" as const
        : "HOLD_RESEARCH_ONLY" as const;
  const priority = action === "ESTIMATE_ADVERSE_PROBABILITY" ? 900
    : action === "ACQUIRE_SETTLEMENT_EVIDENCE" ? 700
      : action === "HOLD_RESEARCH_ONLY" ? 200 : 0;
  const diagnostic = action === "RETIRE_NON_POSITIVE_MARGIN"
    ? "Indicative complement-leg cost leaves no positive adverse-probability failure budget; do not spend estimator tokens."
    : action === "ACQUIRE_SETTLEMENT_EVIDENCE"
      ? "Positive indicative margin, if any, cannot advance until first-party settlement mapping becomes exact."
      : action === "ESTIMATE_ADVERSE_PROBABILITY"
        ? "The complement portfolio has positive indicative failure budget and exact settlement mapping; estimate the adverse-state probability upper bound."
        : "The hypothesis has unsupported blockers and remains research memory.";
  const body = Object.freeze({ hypothesisId: hypothesis.hypothesisId, action, priority,
    diagnostic, sourceBlockers: hypothesis.blockers,
    providerRequestsStarted: 0 as const, jobsCreated: 0 as const,
    automaticDispatch: false as const,
    authority: "SHADOW_RESEARCH_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    executionAuthority: false as const, externalWriteAuthority: false as const,
    valueMovingAuthority: false as const });
  return Object.freeze({ ...body, actionId: hashCanonical(body) });
}

export function buildWorldRelationShadowRoutingProjection(
  hypotheses: readonly WorldRelationShadowTradeHypothesis[],
): WorldRelationShadowRoutingProjection {
  const actions = Object.freeze(hypotheses.map(route).sort((left, right) =>
    right.priority - left.priority || left.actionId.localeCompare(right.actionId)));
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-shadow-routing.v1" as const,
    hypothesisCount: hypotheses.length,
    retiredCount: actions.filter((item) => item.action ===
      "RETIRE_NON_POSITIVE_MARGIN").length,
    settlementEvidenceCount: actions.filter((item) => item.action ===
      "ACQUIRE_SETTLEMENT_EVIDENCE").length,
    probabilityEstimationCount: actions.filter((item) => item.action ===
      "ESTIMATE_ADVERSE_PROBABILITY").length,
    heldCount: actions.filter((item) => item.action === "HOLD_RESEARCH_ONLY").length,
    actions,
    policy: "MARGIN_FIRST_THEN_SETTLEMENT_EXACTNESS_THEN_PROBABILITY_BOUND" as const,
    providerRequestsStartedByRead: 0 as const, jobsCreatedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "SHADOW_RESEARCH_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    executionAuthority: false as const, externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
