import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentExecutionSnapshot } from "./agent-execution-substrate.js";
import type {
  ConsolidatedWorldStateMechanismRoute,
  WorldStateMechanismCounterexample,
} from "./world-state-mechanism.js";
import type {
  WorldStateMechanismObservation,
  WorldStateMechanismSubjectBindingReview,
  WorldStateMechanismWake,
} from "./world-state-mechanism-observer.js";
import type {
  WorldStateSubjectBindingPromotionReadinessItem,
} from "./world-state-subject-binding-promotion-readiness.js";

export type WorldStateMechanismFamilyUsage = Readonly<{
  sourceRunIds: readonly Hash[];
  sourceRunCount: number;
  retainedSourceRunCount: number;
  missingSourceRunCount: number;
  modelInvocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  unknownUsageInvocationCount: number;
}>;

export type WorldStateMechanismFamilyScorecard = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-family-scorecard.v1";
  scorecardId: Hash;
  routeFamilyId: Hash;
  routeId: Hash;
  canonicalSubjectLabels: readonly string[];
  stateDimension: ConsolidatedWorldStateMechanismRoute["canonicalRoute"]["stateDimension"];
  frontier:
    | "PROPOSED_ONLY"
    | "ASSESSMENT_EVIDENCE_RETAINED"
    | "READY_FOR_PROMOTION"
    | "REVIEW_DECIDED"
    | "OBSERVATION_BASELINE"
    | "WAKE_PRODUCED";
  evidence: Readonly<{
    proposalCount: number;
    counterScenarioCount: number;
    counterexampleCount: number;
    assessmentCount: number;
    assessmentAbstentionCount: number;
    assessmentRecommendation: WorldStateSubjectBindingPromotionReadinessItem["recommendation"];
    promotionReadinessStatus: WorldStateSubjectBindingPromotionReadinessItem["status"] | "NO_CASE";
    subjectBindingReviewCount: number;
    latestSubjectBindingDecision: WorldStateMechanismSubjectBindingReview["decision"] | "NONE";
    observationCount: number;
    latestObservationStatus: WorldStateMechanismObservation["status"] | "UNOBSERVED";
    wakeCount: number;
  }>;
  authoringUsage: WorldStateMechanismFamilyUsage;
  assessmentUsage: WorldStateMechanismFamilyUsage;
  totalUsage: WorldStateMechanismFamilyUsage;
  sharedAuthoringAssessmentRunCount: number;
  automaticDispatch: false;
  attentionPolicyAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismFamilyScorecardProjection = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-family-scorecards.v1";
  projectionIdentity: Hash;
  familyCount: number;
  items: readonly WorldStateMechanismFamilyScorecard[];
  automaticDispatch: false;
  attentionPolicyAuthority: false;
  authority: "DERIVED_MECHANISM_FAMILY_EVIDENCE_ONLY";
}>;

function usage(
  execution: AgentExecutionSnapshot,
  sourceRunIdsInput: readonly Hash[],
): WorldStateMechanismFamilyUsage {
  const sourceRunIds = Object.freeze([...new Set(sourceRunIdsInput)].sort());
  const requested = new Set(sourceRunIds);
  const retainedRunIds = new Set(execution.runs.filter((run) => requested.has(run.runId))
    .map((run) => run.runId));
  const invocations = execution.modelInvocations.filter((invocation) =>
    retainedRunIds.has(invocation.runId)
  );
  const sum = (field: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, invocation) =>
      total + BigInt(invocation[field] ?? "0"), 0n
    ).toString();
  return Object.freeze({
    sourceRunIds,
    sourceRunCount: sourceRunIds.length,
    retainedSourceRunCount: retainedRunIds.size,
    missingSourceRunCount: sourceRunIds.length - retainedRunIds.size,
    modelInvocationCount: invocations.length,
    knownInputTokens: sum("inputTokens"),
    knownOutputTokens: sum("outputTokens"),
    knownReasoningTokens: sum("reasoningTokens"),
    unknownUsageInvocationCount: invocations.filter((invocation) =>
      invocation.inputTokens === null || invocation.outputTokens === null ||
      invocation.reasoningTokens === null
    ).length,
  });
}

export function buildWorldStateMechanismFamilyScorecards(input: Readonly<{
  routes: readonly ConsolidatedWorldStateMechanismRoute[];
  counterexamples: readonly WorldStateMechanismCounterexample[];
  promotionReadiness: readonly WorldStateSubjectBindingPromotionReadinessItem[];
  reviews: readonly WorldStateMechanismSubjectBindingReview[];
  observations: readonly WorldStateMechanismObservation[];
  wakes: readonly WorldStateMechanismWake[];
  execution: AgentExecutionSnapshot;
}>): WorldStateMechanismFamilyScorecardProjection {
  const items = Object.freeze(input.routes.map((route) => {
    const readiness = input.promotionReadiness.find((item) =>
      item.routeFamilyId === route.routeFamilyId
    );
    const counterexamples = input.counterexamples.filter((item) =>
      item.targetRouteFamilyId === route.routeFamilyId
    );
    const reviews = input.reviews.filter((item) =>
      item.routeFamilyId === route.routeFamilyId
    ).sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) ||
      left.reviewId.localeCompare(right.reviewId));
    const observations = input.observations.filter((item) =>
      item.routeFamilyId === route.routeFamilyId
    ).sort((left, right) => left.observedAt.localeCompare(right.observedAt) ||
      left.observationId.localeCompare(right.observationId));
    const wakes = input.wakes.filter((item) => item.routeFamilyId === route.routeFamilyId);
    const authoringRunIds = route.sourceAgentRunIds;
    const assessmentRunIds = readiness?.assessmentUsage.runIds ?? [];
    const authoringRuns = new Set(authoringRunIds);
    const sharedAuthoringAssessmentRunCount = assessmentRunIds.filter((runId) =>
      authoringRuns.has(runId)
    ).length;
    const latestReview = reviews.at(-1);
    const latestObservation = observations.at(-1);
    const frontier = wakes.length > 0
      ? "WAKE_PRODUCED" as const
      : latestObservation?.status === "OBSERVED"
      ? "OBSERVATION_BASELINE" as const
      : reviews.length > 0
      ? "REVIEW_DECIDED" as const
      : readiness?.status === "READY_FOR_INDEPENDENT_PROMOTION"
      ? "READY_FOR_PROMOTION" as const
      : readiness !== undefined &&
          (readiness.assessmentIds.length > 0 || readiness.abstentionIds.length > 0)
      ? "ASSESSMENT_EVIDENCE_RETAINED" as const
      : "PROPOSED_ONLY" as const;
    const body = Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-family-scorecard.v1" as const,
      routeFamilyId: route.routeFamilyId,
      routeId: route.routeId,
      canonicalSubjectLabels: route.canonicalRoute.canonicalSubjectLabels,
      stateDimension: route.canonicalRoute.stateDimension,
      frontier,
      evidence: Object.freeze({
        proposalCount: route.sourceProposalIds.length,
        counterScenarioCount: route.counterScenarios.length,
        counterexampleCount: counterexamples.length,
        assessmentCount: readiness?.assessmentIds.length ?? 0,
        assessmentAbstentionCount: readiness?.abstentionIds.length ?? 0,
        assessmentRecommendation: readiness?.recommendation ?? "NONE" as const,
        promotionReadinessStatus: readiness?.status ?? "NO_CASE" as const,
        subjectBindingReviewCount: reviews.length,
        latestSubjectBindingDecision: latestReview?.decision ?? "NONE" as const,
        observationCount: observations.length,
        latestObservationStatus: latestObservation?.status ?? "UNOBSERVED" as const,
        wakeCount: wakes.length,
      }),
      authoringUsage: usage(input.execution, authoringRunIds),
      assessmentUsage: usage(input.execution, assessmentRunIds),
      totalUsage: usage(input.execution, [...authoringRunIds, ...assessmentRunIds]),
      sharedAuthoringAssessmentRunCount,
      automaticDispatch: false as const,
      attentionPolicyAuthority: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, scorecardId: hashCanonical(body) });
  }).sort((left, right) =>
    left.routeFamilyId.localeCompare(right.routeFamilyId)
  ));
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-family-scorecards.v1" as const,
    familyCount: items.length,
    items,
    automaticDispatch: false as const,
    attentionPolicyAuthority: false as const,
    authority: "DERIVED_MECHANISM_FAMILY_EVIDENCE_ONLY" as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
