import { hashCanonical, type Hash } from "@pmh/domain";
import {
  worldStateMechanismSubjectBindingReviewCoversRoute,
  type WorldStateMechanismSubjectBindingReview,
} from "./world-state-mechanism-observer.js";
import type {
  WorldStateSubjectBindingAbstention,
  WorldStateSubjectBindingAssessment,
  WorldStateSubjectBindingResearchCase,
} from "./world-state-subject-binding-research.js";

export type WorldStateSubjectBindingPromotionReadinessItem = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-promotion-readiness-item.v1";
  readinessId: Hash;
  caseId: Hash;
  routeFamilyId: Hash;
  inputRevisionId: Hash;
  status:
    | "UNASSESSED"
    | "READY_FOR_INDEPENDENT_PROMOTION"
    | "HOLD_REJECTED"
    | "HOLD_EVIDENCE_GAP"
    | "HOLD_CONFLICTING_ASSESSMENTS"
    | "HOLD_NONINDEPENDENT_ASSESSMENT"
    | "HOLD_INCOMPLETE_LABEL_COVERAGE"
    | "ALREADY_REVIEWED";
  assessmentIds: readonly Hash[];
  abstentionIds: readonly Hash[];
  exactReviewIds: readonly Hash[];
  approvingAssessmentId: Hash | null;
  checks: Readonly<{
    exactInputBound: boolean;
    independentFromAuthoring: boolean;
    candidateLabelsCovered: boolean;
    triggerEvidencePresent: boolean;
    dependentEvidencePresent: boolean;
    crossRoleEvidencePresent: boolean;
    counterexamplesPresent: boolean;
    noConflictingAssessment: boolean;
    exactReviewAbsent: boolean;
  }>;
  diagnostic: string;
  promotionRequired: true;
  promotionAuthority: false;
  automaticPromotion: false;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  semanticRelationAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateSubjectBindingPromotionReadinessProjection = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-promotion-readiness.v1";
  projectionIdentity: Hash;
  caseCount: number;
  readyCount: number;
  heldCount: number;
  unassessedCount: number;
  alreadyReviewedCount: number;
  items: readonly WorldStateSubjectBindingPromotionReadinessItem[];
  reviewerPolicyConfigured: false;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticPromotion: false;
  promotionAuthority: false;
  authority: "PROMOTION_READINESS_ROUTING_ONLY";
}>;

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return [...new Set(left)].sort().join("\n") === [...new Set(right)].sort().join("\n");
}

export function worldStateSubjectBindingReviewCoversCase(
  review: WorldStateMechanismSubjectBindingReview,
  item: Pick<WorldStateSubjectBindingResearchCase, "routeFamilyId" | "currentInputRevision">,
): boolean {
  return worldStateMechanismSubjectBindingReviewCoversRoute(review, {
    routeFamilyId: item.routeFamilyId,
    sourceProposalIds: item.currentInputRevision.sourceProposalIds,
  });
}

function orderedResults<T extends { assessedAt: string }>(
  values: readonly T[],
  identity: (value: T) => Hash,
): readonly T[] {
  return Object.freeze([...values].sort((left, right) =>
    left.assessedAt.localeCompare(right.assessedAt) ||
    identity(left).localeCompare(identity(right))
  ));
}

export function buildWorldStateSubjectBindingPromotionReadiness(input: Readonly<{
  cases: readonly WorldStateSubjectBindingResearchCase[];
  assessments: readonly WorldStateSubjectBindingAssessment[];
  abstentions: readonly WorldStateSubjectBindingAbstention[];
  reviews: readonly WorldStateMechanismSubjectBindingReview[];
}>): WorldStateSubjectBindingPromotionReadinessProjection {
  const items = Object.freeze(input.cases.map((item) => {
    const assessments = orderedResults(input.assessments.filter((assessment) =>
      assessment.caseId === item.caseId &&
      assessment.inputRevisionId === item.currentInputRevision.revisionId
    ), (assessment) => assessment.assessmentId);
    const abstentions = orderedResults(input.abstentions.filter((abstention) =>
      abstention.caseId === item.caseId &&
      abstention.inputRevisionId === item.currentInputRevision.revisionId
    ), (abstention) => abstention.abstentionId);
    const exactReviews = input.reviews.filter((review) =>
      worldStateSubjectBindingReviewCoversCase(review, item)
    ).sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt));
    const recommendations = new Set(assessments.map((assessment) =>
      `${assessment.recommendation}:${assessment.supportedLabels.join("|")}:` +
      assessment.rejectedLabels.join("|")
    ));
    const conflict = recommendations.size > 1 ||
      (assessments.length > 0 && abstentions.length > 0);
    const approval = [...assessments].reverse().find((assessment) =>
      assessment.recommendation === "APPROVE"
    ) ?? null;
    const candidateLabels = item.currentInputRevision.candidateLabels;
    const coveredLabels = approval === null ? [] : [
      ...approval.supportedLabels, ...approval.rejectedLabels,
    ];
    const exactInputBound = assessments.every((assessment) =>
      assessment.inputRevisionId === item.currentInputRevision.revisionId
    ) && abstentions.every((abstention) =>
      abstention.inputRevisionId === item.currentInputRevision.revisionId
    );
    const independentFromAuthoring = approval !== null &&
      !item.currentInputRevision.sourceAuthoringRunIds.includes(approval.sourceAgentRunId);
    const candidateLabelsCovered = approval !== null &&
      sameValues(candidateLabels, coveredLabels);
    const roles = new Set(approval?.evidenceFindings.map((finding) => finding.role) ?? []);
    const checks = Object.freeze({
      exactInputBound,
      independentFromAuthoring,
      candidateLabelsCovered,
      triggerEvidencePresent: roles.has("TRIGGER"),
      dependentEvidencePresent: roles.has("DEPENDENT"),
      crossRoleEvidencePresent: roles.has("CROSS_ROLE"),
      counterexamplesPresent: (approval?.counterexamples.length ?? 0) > 0,
      noConflictingAssessment: !conflict,
      exactReviewAbsent: exactReviews.length === 0,
    });
    const complete = Object.values(checks).every(Boolean);
    const rejected = assessments.some((assessment) => assessment.recommendation === "REJECT");
    const status = exactReviews.length > 0
      ? "ALREADY_REVIEWED" as const
      : conflict
      ? "HOLD_CONFLICTING_ASSESSMENTS" as const
      : abstentions.length > 0
      ? "HOLD_EVIDENCE_GAP" as const
      : rejected
      ? "HOLD_REJECTED" as const
      : assessments.length === 0
      ? "UNASSESSED" as const
      : !independentFromAuthoring
      ? "HOLD_NONINDEPENDENT_ASSESSMENT" as const
      : !candidateLabelsCovered || !checks.triggerEvidencePresent ||
          !checks.dependentEvidencePresent || !checks.crossRoleEvidencePresent ||
          !checks.counterexamplesPresent
      ? "HOLD_INCOMPLETE_LABEL_COVERAGE" as const
      : complete
      ? "READY_FOR_INDEPENDENT_PROMOTION" as const
      : "HOLD_INCOMPLETE_LABEL_COVERAGE" as const;
    const diagnostic = status === "READY_FOR_INDEPENDENT_PROMOTION"
      ? "Exact independent approval evidence is ready for a separately authorized promotion decision"
      : status === "ALREADY_REVIEWED"
      ? "An exact proposal-set subject-binding review already exists"
      : status === "UNASSESSED"
      ? "No assessment is retained for the current exact input"
      : status === "HOLD_EVIDENCE_GAP"
      ? "An evidence-bound abstention or incompatible result requires new evidence"
      : status === "HOLD_REJECTED"
      ? "The retained assessment rejects at least one candidate subject binding"
      : status === "HOLD_CONFLICTING_ASSESSMENTS"
      ? "Current exact-input results conflict and cannot be promoted"
      : status === "HOLD_NONINDEPENDENT_ASSESSMENT"
      ? "The approving assessment is not independent from mechanism authoring"
      : "The assessment does not cover every candidate label, role, and counterexample gate";
    const body = Object.freeze({
      schemaVersion: "pmh.world-state-subject-binding-promotion-readiness-item.v1" as const,
      caseId: item.caseId,
      routeFamilyId: item.routeFamilyId,
      inputRevisionId: item.currentInputRevision.revisionId,
      status,
      assessmentIds: Object.freeze(assessments.map((assessment) => assessment.assessmentId).sort()),
      abstentionIds: Object.freeze(abstentions.map((abstention) => abstention.abstentionId).sort()),
      exactReviewIds: Object.freeze(exactReviews.map((review) => review.reviewId).sort()),
      approvingAssessmentId: approval?.assessmentId ?? null,
      checks,
      diagnostic,
      promotionRequired: true as const,
      promotionAuthority: false as const,
      automaticPromotion: false as const,
      providerRequestsStarted: 0 as const,
      modelInvocationsStarted: 0 as const,
      semanticRelationAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, readinessId: hashCanonical(body) });
  }).sort((left, right) => left.caseId.localeCompare(right.caseId)));
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-subject-binding-promotion-readiness.v1" as const,
    caseCount: items.length,
    readyCount: items.filter((item) => item.status === "READY_FOR_INDEPENDENT_PROMOTION").length,
    heldCount: items.filter((item) => item.status.startsWith("HOLD_")).length,
    unassessedCount: items.filter((item) => item.status === "UNASSESSED").length,
    alreadyReviewedCount: items.filter((item) => item.status === "ALREADY_REVIEWED").length,
    items,
    reviewerPolicyConfigured: false as const,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    automaticPromotion: false as const,
    promotionAuthority: false as const,
    authority: "PROMOTION_READINESS_ROUTING_ONLY" as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
