import type { Hash } from "@pmh/domain";
import type { OpportunityLifecycleProjection } from "@pmh/execution";
import type { ProposalEconomicTriageItem } from "./proposal-economic-triage.js";
import type { ReviewAttentionItem } from "./review-attention.js";
import type {
  PremiseAnalysisJobRecord,
  PremiseAnalysisOutcomeCapsule,
} from "./premise-analysis-scheduler.js";
import type {
  SemanticReviewJobRecord,
  SemanticReviewOutcomeCapsule,
} from "./semantic-review-scheduler.js";

export type ProposalReviewOutcomeResolution = Readonly<{
  basis:
    | "DIRECT_REVIEW"
    | "CANONICAL_SCOPE_REUSE"
    | "RECOVERY_PENDING"
    | "LEGACY_DETAIL_UNAVAILABLE"
    | "NOT_REVIEWED";
  canonicalJobId: Hash | null;
  outcome: SemanticReviewOutcomeCapsule | null;
  diagnostic: string;
}>;

export type ProposalDecisionNextGate =
  | "INDEPENDENT_SEMANTIC_REVIEW"
  | "AWAIT_REVIEW_RECOVERY"
  | "RECOVER_REVIEW_DETAIL"
  | "RESOLVE_EVIDENCE_GAPS"
  | "HIDDEN_PREMISE_ANALYSIS"
  | "AWAIT_PREMISE_ANALYSIS"
  | "RETRY_PREMISE_ANALYSIS"
  | "BIND_PREMISE_EVIDENCE"
  | "OPERATOR_DECISION"
  | "FEE_DEPTH_QUALIFICATION"
  | "RETAIN_AS_RESEARCH_ONLY";

export type ProposalPremiseOutcomeResolution = Readonly<{
  basis:
    | "DIRECT_ANALYSIS"
    | "ANALYSIS_PENDING"
    | "ANALYSIS_EXHAUSTED"
    | "LEGACY_DETAIL_UNAVAILABLE"
    | "NOT_ANALYZED";
  outcome: PremiseAnalysisOutcomeCapsule | null;
  diagnostic: string;
}>;

export function resolveProposalPremiseOutcome(
  job: PremiseAnalysisJobRecord | null,
): ProposalPremiseOutcomeResolution {
  if (job === null) {
    return Object.freeze({
      basis: "NOT_ANALYZED",
      outcome: null,
      diagnostic: "No retained hidden-premise analysis job is bound to this proposal.",
    });
  }
  if (job.outcomeCapsule !== undefined) {
    return Object.freeze({
      basis: "DIRECT_ANALYSIS",
      outcome: job.outcomeCapsule,
      diagnostic: "Premise outcome capsule comes from this proposal's exact retained analysis.",
    });
  }
  if (["PENDING", "LEASED", "RETRY_WAIT"].includes(job.status)) {
    return Object.freeze({
      basis: "ANALYSIS_PENDING",
      outcome: null,
      diagnostic: `Hidden-premise analysis is ${job.status.toLowerCase().replaceAll("_", " ")}.`,
    });
  }
  if (job.status === "EXHAUSTED") {
    return Object.freeze({
      basis: "ANALYSIS_EXHAUSTED",
      outcome: null,
      diagnostic: job.diagnostic ?? "Hidden-premise analysis exhausted its bounded request budget.",
    });
  }
  return Object.freeze({
    basis: "LEGACY_DETAIL_UNAVAILABLE",
    outcome: null,
    diagnostic: "This historical premise PASS predates durable outcome capsules; its result is not reconstructed from terminal labels.",
  });
}

export function resolveProposalReviewOutcome(
  job: SemanticReviewJobRecord | null,
  jobsById: ReadonlyMap<Hash, SemanticReviewJobRecord>,
): ProposalReviewOutcomeResolution {
  if (job === null) {
    return Object.freeze({
      basis: "NOT_REVIEWED",
      canonicalJobId: null,
      outcome: null,
      diagnostic: "No retained semantic-review job is bound to this proposal.",
    });
  }
  if (job.reviewOutcome !== undefined) {
    return Object.freeze({
      basis: "DIRECT_REVIEW",
      canonicalJobId: job.jobId,
      outcome: job.reviewOutcome,
      diagnostic: "Outcome capsule comes from this proposal's exact retained review.",
    });
  }
  if (job.detailRecovery !== undefined) {
    return Object.freeze({
      basis: "RECOVERY_PENDING",
      canonicalJobId: job.jobId,
      outcome: null,
      diagnostic: `Review detail recovery is ${job.status.toLowerCase().replaceAll("_", " ")}.`,
    });
  }
  if (job.status === "DUPLICATE_SCOPE") {
    const canonicalJobId = job.duplicateOfJobId ?? null;
    const canonical = canonicalJobId === null ? undefined : jobsById.get(canonicalJobId);
    if (canonical?.reviewOutcome !== undefined) {
      return Object.freeze({
        basis: "CANONICAL_SCOPE_REUSE",
        canonicalJobId,
        outcome: canonical.reviewOutcome,
        diagnostic: "Outcome capsule is reused only from the explicitly named canonical review job.",
      });
    }
    if (canonical?.detailRecovery !== undefined) {
      return Object.freeze({
        basis: "RECOVERY_PENDING",
        canonicalJobId,
        outcome: null,
        diagnostic: `Named canonical review recovery is ${canonical.status.toLowerCase().replaceAll("_", " ")}.`,
      });
    }
    return Object.freeze({
      basis: "LEGACY_DETAIL_UNAVAILABLE",
      canonicalJobId,
      outcome: null,
      diagnostic: canonicalJobId === null
        ? "The retained duplicate-scope job does not name a canonical review job."
        : "The named canonical review predates durable outcome capsules or is outside retained detail.",
    });
  }
  if (job.status === "PASS") {
    return Object.freeze({
      basis: "LEGACY_DETAIL_UNAVAILABLE",
      canonicalJobId: job.jobId,
      outcome: null,
      diagnostic: "This historical PASS predates durable outcome capsules; its recommendation is not reconstructed.",
    });
  }
  return Object.freeze({
    basis: "NOT_REVIEWED",
    canonicalJobId: job.jobId,
    outcome: null,
    diagnostic: `Semantic review is retained as ${job.status}; no passing outcome capsule exists.`,
  });
}

type NextGateInput = Readonly<{
  reviewJob: SemanticReviewJobRecord | null;
  reviewOutcome: ProposalReviewOutcomeResolution;
  premiseAuditRequired: boolean;
  premiseJob: PremiseAnalysisJobRecord | null;
  premiseOutcome: ProposalPremiseOutcomeResolution;
  attention: Pick<ReviewAttentionItem, "operatorPosture"> | null;
  lifecycleCase: Pick<OpportunityLifecycleProjection, "nextAction"> | null;
  economics: Pick<ProposalEconomicTriageItem, "status"> | null;
}>;

function derivePostSemanticGate(
  input: Pick<NextGateInput, "attention" | "lifecycleCase" | "economics">,
): ProposalDecisionNextGate {
  if (
    input.lifecycleCase !== null &&
    input.lifecycleCase.nextAction !== "INDEPENDENT_SEMANTIC_REVIEW" &&
    input.lifecycleCase.nextAction !== "WAIT_FOR_HUMAN_APPROVAL" &&
    input.lifecycleCase.nextAction !== "DISPLAY_NOTIFICATION" &&
    input.lifecycleCase.nextAction !== "NONE"
  ) return "FEE_DEPTH_QUALIFICATION";
  if (
    input.attention?.operatorPosture === "DECISION_READY" ||
    input.lifecycleCase?.nextAction === "WAIT_FOR_HUMAN_APPROVAL" ||
    input.lifecycleCase?.nextAction === "DISPLAY_NOTIFICATION"
  ) return "OPERATOR_DECISION";
  if (input.economics?.status === "POSITIVE_GROSS_HINT") {
    return "FEE_DEPTH_QUALIFICATION";
  }
  return "OPERATOR_DECISION";
}

export function deriveProposalDecisionNextGate(
  input: NextGateInput,
): ProposalDecisionNextGate {
  if (input.reviewOutcome.basis === "LEGACY_DETAIL_UNAVAILABLE") {
    return "RECOVER_REVIEW_DETAIL";
  }
  if (input.reviewOutcome.basis === "RECOVERY_PENDING") {
    return "AWAIT_REVIEW_RECOVERY";
  }
  const outcome = input.reviewOutcome.outcome;
  if (outcome === null) {
    if (input.reviewJob?.status === "BLOCKED_EVIDENCE") {
      return "RESOLVE_EVIDENCE_GAPS";
    }
    if (
      input.reviewJob?.status === "RESEARCH_ONLY" ||
      input.reviewJob?.status === "EXHAUSTED"
    ) return "RETAIN_AS_RESEARCH_ONLY";
    return "INDEPENDENT_SEMANTIC_REVIEW";
  }
  if (
    outcome.recommendation === "REJECT" ||
    input.attention?.operatorPosture === "REJECT_RECOMMENDED"
  ) return "RETAIN_AS_RESEARCH_ONLY";
  if (
    outcome.recommendation === "ESCALATE" ||
    outcome.missingEvidenceCount > 0 ||
    input.attention?.operatorPosture === "EVIDENCE_ESCALATION"
  ) return "RESOLVE_EVIDENCE_GAPS";
  if (outcome.semanticConstraint?.classification !== "HARD_SETTLEMENT_CONSTRAINT") {
    return "RETAIN_AS_RESEARCH_ONLY";
  }
  if (
    !input.premiseAuditRequired &&
    outcome.semanticConstraint.exactCompilerAdmission === "ELIGIBLE"
  ) {
    return derivePostSemanticGate(input);
  }
  if (input.premiseOutcome.basis === "NOT_ANALYZED") {
    return "HIDDEN_PREMISE_ANALYSIS";
  }
  if (input.premiseOutcome.basis === "ANALYSIS_PENDING") {
    return "AWAIT_PREMISE_ANALYSIS";
  }
  if (input.premiseOutcome.basis === "ANALYSIS_EXHAUSTED") {
    return "RETRY_PREMISE_ANALYSIS";
  }
  if (input.premiseOutcome.basis === "LEGACY_DETAIL_UNAVAILABLE") {
    return "RETAIN_AS_RESEARCH_ONLY";
  }
  const premiseOutcome = input.premiseOutcome.outcome!;
  if (premiseOutcome.exactCompilerAdmission !== "ELIGIBLE") {
    if (
      premiseOutcome.unboundPremiseCount > 0 ||
      premiseOutcome.blocker === "BASE_CONSTRAINT_RESEARCH_ONLY" ||
      premiseOutcome.blocker === "PREMISE_RESEARCH_ONLY"
    ) return "BIND_PREMISE_EVIDENCE";
    if (
      premiseOutcome.blocker === "EXPRESSION_UNRESOLVED" ||
      premiseOutcome.blocker === "EXPRESSION_STATE_MISMATCH"
    ) return "RETRY_PREMISE_ANALYSIS";
    return "RETAIN_AS_RESEARCH_ONLY";
  }
  return derivePostSemanticGate(input);
}
