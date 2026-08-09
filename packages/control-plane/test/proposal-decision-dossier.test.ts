import { describe, expect, it } from "vitest";
import type { Hash } from "@pmh/domain";
import {
  deriveProposalDecisionNextGate,
  resolveProposalPremiseOutcome,
  resolveProposalReviewOutcome,
} from "../src/proposal-decision-dossier.js";
import type {
  PremiseAnalysisJobRecord,
  PremiseAnalysisOutcomeCapsule,
} from "../src/premise-analysis-scheduler.js";
import type {
  SemanticReviewJobRecord,
  SemanticReviewOutcomeCapsule,
} from "../src/semantic-review-scheduler.js";

const hash = (seed: string): Hash =>
  `sha256:${seed.padEnd(64, seed[0] ?? "0").slice(0, 64)}` as Hash;

function capsule(seed: string): SemanticReviewOutcomeCapsule {
  return {
    schemaVersion: "pmh.semantic-review-outcome-capsule.v1",
    outcomeHash: hash(seed),
    reviewId: hash(`${seed}1`),
    reportArtifactHash: hash(`${seed}2`),
    reportSchemaVersion: "pmh.semantic-review-report.v4",
    proposalId: hash(`${seed}3`),
    corpusSnapshotIdentity: hash(`${seed}4`),
    completedAt: "2026-08-10T00:00:00.000Z",
    recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION",
    relationConclusion: "MUTUALLY_EXCLUSIVE",
    semanticConstraint: {
      artifactHash: hash(`${seed}5`),
      classification: "HARD_SETTLEMENT_CONSTRAINT",
      relationKind: "MUTUALLY_EXCLUSIVE",
      exactCompilerAdmission: "ELIGIBLE",
    },
    missingEvidenceCount: 0,
    counterexampleCount: 1,
    authority: "ADVISORY_SUMMARY_ONLY",
    semanticDecisionAuthority: false,
    simulationAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
  };
}

function job(
  seed: string,
  status: SemanticReviewJobRecord["status"],
  options: Readonly<{
    duplicateOfJobId?: Hash;
    reviewOutcome?: SemanticReviewOutcomeCapsule;
  }> = {},
): SemanticReviewJobRecord {
  return {
    schemaVersion: options.reviewOutcome === undefined
      ? "pmh.semantic-review-job.v2"
      : "pmh.semantic-review-job.v3",
    jobId: hash(seed),
    opportunityId: `ai:${hash(`${seed}p`)}`,
    proposalId: hash(`${seed}p`),
    proposalCorpusSnapshotIdentity: hash(`${seed}c`),
    issueIds: [],
    priority: 3,
    status,
    attemptCount: 1,
    maxAttempts: 3,
    nextAttemptAt: "2026-08-10T00:00:00.000Z",
    leasedAt: null,
    leaseExpiresAt: null,
    completedAt: status === "PASS" ? "2026-08-10T00:00:00.000Z" : null,
    lastReviewId: options.reviewOutcome?.reviewId ?? null,
    recommendation: options.reviewOutcome?.recommendation ?? null,
    duplicateOfJobId: options.duplicateOfJobId,
    reviewOutcome: options.reviewOutcome,
    diagnostic: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    artifactHash: hash(`${seed}a`),
  };
}

function premiseCapsule(
  seed: string,
  exactCompilerAdmission: "ELIGIBLE" | "RESEARCH_ONLY" = "ELIGIBLE",
): PremiseAnalysisOutcomeCapsule {
  const researchOnly = exactCompilerAdmission === "RESEARCH_ONLY";
  return {
    schemaVersion: "pmh.premise-analysis-outcome-capsule.v1",
    outcomeHash: hash(`${seed}o`),
    analysisId: hash(`${seed}a`),
    analysisArtifactHash: hash(`${seed}b`),
    proposalId: hash(`${seed}p`),
    semanticReviewArtifactHash: hash(`${seed}r`),
    completedAt: "2026-08-10T00:00:01.000Z",
    relationArtifactHash: hash(`${seed}l`),
    classification: researchOnly ? "CAUSAL_RESEARCH_ONLY" : "CONDITIONAL_TRADED",
    exactCompilerAdmission,
    blocker: researchOnly ? "PREMISE_RESEARCH_ONLY" : null,
    premiseCount: 1,
    unboundPremiseCount: researchOnly ? 1 : 0,
    obligations: [{
      premiseId: hash(`${seed}m`),
      proposition: "The decisive premise is explicitly retained.",
      kind: researchOnly ? "CAUSAL_HYPOTHESIS" : "TRADED_OUTCOME",
      truthPosture: researchOnly ? "UNRESOLVED" : "TRADED_VARIABLE",
      bindingKind: researchOnly ? "NONE" : "LISTING_TRUTH",
      evidenceClaimCount: 0,
      exactStateAuthority: researchOnly ? "NONE" : "BOUND_LISTING_TRUTH",
      counterexampleResult: "NOT_FOUND",
    }],
    authority: "ADVISORY_SUMMARY_ONLY",
    semanticDecisionAuthority: false,
    simulationAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
  };
}

function premiseJob(
  seed: string,
  status: PremiseAnalysisJobRecord["status"],
  outcomeCapsule?: PremiseAnalysisOutcomeCapsule,
): PremiseAnalysisJobRecord {
  return {
    schemaVersion: outcomeCapsule === undefined
      ? "pmh.premise-analysis-job.v2"
      : "pmh.premise-analysis-job.v3",
    jobId: hash(`${seed}j`),
    analysisId: hash(`${seed}j`),
    proposalId: outcomeCapsule?.proposalId ?? hash(`${seed}p`),
    semanticReviewArtifactHash: outcomeCapsule?.semanticReviewArtifactHash ?? hash(`${seed}r`),
    evidenceScopeIdentity: hash(`${seed}s`),
    interpreterIdentity: hash(`${seed}i`),
    semanticReviewJobId: hash(`${seed}q`),
    issueIds: [hash(`${seed}u`)],
    admissionLane: "AUTO_ARBITRAGE_REVIEW",
    outcomeCapsule,
    upgradedFromArtifactHash: outcomeCapsule === undefined ? undefined : null,
    status,
    attemptCount: status === "PENDING" ? 0 : 1,
    maxAttempts: 3,
    nextAttemptAt: "2026-08-10T00:00:00.000Z",
    leasedAt: null,
    leaseExpiresAt: null,
    completedAt: status === "PASS" || status === "EXHAUSTED"
      ? "2026-08-10T00:00:01.000Z"
      : null,
    lastAnalysisArtifactHash: outcomeCapsule?.analysisArtifactHash ?? null,
    exactCompilerAdmission: outcomeCapsule?.exactCompilerAdmission ?? null,
    diagnostic: status === "EXHAUSTED" ? "bounded failure" : null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:01.000Z",
    authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY",
    providerRequestAuthority: false,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    artifactHash: hash(`${seed}h`),
  } as PremiseAnalysisJobRecord;
}

describe("proposal decision dossier", () => {
  it("distinguishes direct, named canonical reuse, and historical detail gaps", () => {
    const directOutcome = capsule("a");
    const direct = job("b", "PASS", { reviewOutcome: directOutcome });
    const unrelated = job("c", "PASS", { reviewOutcome: capsule("d") });
    const duplicate = job("e", "DUPLICATE_SCOPE", {
      duplicateOfJobId: direct.jobId,
    });
    const jobs = new Map([
      [direct.jobId, direct],
      [unrelated.jobId, unrelated],
      [duplicate.jobId, duplicate],
    ]);

    expect(resolveProposalReviewOutcome(direct, jobs)).toMatchObject({
      basis: "DIRECT_REVIEW",
      canonicalJobId: direct.jobId,
      outcome: directOutcome,
    });
    expect(resolveProposalReviewOutcome(duplicate, jobs)).toMatchObject({
      basis: "CANONICAL_SCOPE_REUSE",
      canonicalJobId: direct.jobId,
      outcome: directOutcome,
    });

    const missingNamedCanonical = job("f", "DUPLICATE_SCOPE", {
      duplicateOfJobId: hash("9"),
    });
    expect(resolveProposalReviewOutcome(missingNamedCanonical, jobs)).toMatchObject({
      basis: "LEGACY_DETAIL_UNAVAILABLE",
      canonicalJobId: hash("9"),
      outcome: null,
    });
    expect(resolveProposalReviewOutcome(job("1", "PASS"), jobs)).toMatchObject({
      basis: "LEGACY_DETAIL_UNAVAILABLE",
      outcome: null,
    });
  });

  it("derives gates from evidence, not from a bare PASS label", () => {
    const pass = job("a", "PASS", { reviewOutcome: capsule("b") });
    const direct = resolveProposalReviewOutcome(pass, new Map([[pass.jobId, pass]]));
    const exactPremiseJob = premiseJob("x", "PASS", premiseCapsule("x"));
    const base = {
      reviewJob: pass,
      reviewOutcome: direct,
      premiseAuditRequired: false,
      premiseJob: exactPremiseJob,
      premiseOutcome: resolveProposalPremiseOutcome(exactPremiseJob),
      attention: null,
      lifecycleCase: null,
      economics: null,
    } as const;
    expect(deriveProposalDecisionNextGate(base)).toBe("OPERATOR_DECISION");
    expect(deriveProposalDecisionNextGate({
      ...base,
      economics: { status: "POSITIVE_GROSS_HINT" },
    })).toBe("FEE_DEPTH_QUALIFICATION");
    const staleResearchPremise = premiseJob(
      "z",
      "PASS",
      premiseCapsule("z", "RESEARCH_ONLY"),
    );
    expect(deriveProposalDecisionNextGate({
      ...base,
      premiseJob: staleResearchPremise,
      premiseOutcome: resolveProposalPremiseOutcome(staleResearchPremise),
      economics: { status: "POSITIVE_GROSS_HINT" },
    })).toBe("FEE_DEPTH_QUALIFICATION");
    expect(deriveProposalDecisionNextGate({
      ...base,
      reviewOutcome: {
        ...direct,
        outcome: {
          ...direct.outcome!,
          semanticConstraint: {
            ...direct.outcome!.semanticConstraint!,
            exactCompilerAdmission: undefined,
          },
        },
      },
      premiseJob: null,
      premiseOutcome: resolveProposalPremiseOutcome(null),
    })).toBe("HIDDEN_PREMISE_ANALYSIS");
    expect(deriveProposalDecisionNextGate({
      ...base,
      reviewOutcome: resolveProposalReviewOutcome(job("c", "PASS"), new Map()),
    })).toBe("RECOVER_REVIEW_DETAIL");
    expect(deriveProposalDecisionNextGate({
      ...base,
      reviewOutcome: {
        ...direct,
        outcome: { ...direct.outcome!, missingEvidenceCount: 1 },
      },
    })).toBe("RESOLVE_EVIDENCE_GAPS");
    expect(deriveProposalDecisionNextGate({
      ...base,
      reviewOutcome: {
        ...direct,
        outcome: { ...direct.outcome!, semanticConstraint: null },
      },
    })).toBe("RETAIN_AS_RESEARCH_ONLY");
  });

  it("shows direct and named canonical recovery as one in-flight gate", () => {
    const canonical = {
      ...job("a", "PENDING"),
      detailRecovery: {} as NonNullable<SemanticReviewJobRecord["detailRecovery"]>,
    } as SemanticReviewJobRecord;
    const duplicate = job("b", "DUPLICATE_SCOPE", {
      duplicateOfJobId: canonical.jobId,
    });
    const jobs = new Map([[canonical.jobId, canonical]]);

    const directResolution = resolveProposalReviewOutcome(canonical, jobs);
    expect(directResolution).toMatchObject({
      basis: "RECOVERY_PENDING",
      canonicalJobId: canonical.jobId,
      outcome: null,
    });
    expect(resolveProposalReviewOutcome(duplicate, jobs)).toMatchObject({
      basis: "RECOVERY_PENDING",
      canonicalJobId: canonical.jobId,
      outcome: null,
    });
    expect(deriveProposalDecisionNextGate({
      reviewJob: canonical,
      reviewOutcome: directResolution,
      premiseAuditRequired: false,
      premiseJob: null,
      premiseOutcome: resolveProposalPremiseOutcome(null),
      attention: null,
      lifecycleCase: null,
      economics: { status: "POSITIVE_GROSS_HINT" },
    })).toBe("AWAIT_REVIEW_RECOVERY");
  });

  it("turns premise state into explicit deterministic gates", () => {
    const pass = job("a", "PASS", { reviewOutcome: capsule("b") });
    const reviewOutcome = resolveProposalReviewOutcome(pass, new Map([[pass.jobId, pass]]));
    const input = {
      reviewJob: pass,
      reviewOutcome,
      premiseAuditRequired: true,
      attention: { operatorPosture: "RESEARCH_ONLY" as const },
      lifecycleCase: null,
      economics: { status: "POSITIVE_GROSS_HINT" as const },
    };
    expect(deriveProposalDecisionNextGate({
      ...input,
      premiseJob: null,
      premiseOutcome: resolveProposalPremiseOutcome(null),
    })).toBe("HIDDEN_PREMISE_ANALYSIS");
    const pending = premiseJob("p", "PENDING");
    expect(deriveProposalDecisionNextGate({
      ...input,
      premiseJob: pending,
      premiseOutcome: resolveProposalPremiseOutcome(pending),
    })).toBe("AWAIT_PREMISE_ANALYSIS");
    const exhausted = premiseJob("e", "EXHAUSTED");
    expect(deriveProposalDecisionNextGate({
      ...input,
      premiseJob: exhausted,
      premiseOutcome: resolveProposalPremiseOutcome(exhausted),
    })).toBe("RETRY_PREMISE_ANALYSIS");
    const research = premiseJob("r", "PASS", premiseCapsule("r", "RESEARCH_ONLY"));
    expect(deriveProposalDecisionNextGate({
      ...input,
      premiseJob: research,
      premiseOutcome: resolveProposalPremiseOutcome(research),
    })).toBe("BIND_PREMISE_EVIDENCE");
    expect(resolveProposalPremiseOutcome(research)).toMatchObject({
      basis: "DIRECT_ANALYSIS",
      outcome: { unboundPremiseCount: 1, exactCompilerAdmission: "RESEARCH_ONLY" },
    });
  });
});
