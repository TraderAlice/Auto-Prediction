import { describe, expect, it } from "vitest";
import type { Hash } from "@pmh/domain";
import {
  deriveProposalDecisionNextGate,
  resolveProposalReviewOutcome,
} from "../src/proposal-decision-dossier.js";
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
    const base = {
      reviewJob: pass,
      reviewOutcome: direct,
      attention: null,
      lifecycleCase: null,
      economics: null,
    } as const;
    expect(deriveProposalDecisionNextGate(base)).toBe("OPERATOR_DECISION");
    expect(deriveProposalDecisionNextGate({
      ...base,
      economics: { status: "POSITIVE_GROSS_HINT" },
    })).toBe("FEE_DEPTH_QUALIFICATION");
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
      attention: null,
      lifecycleCase: null,
      economics: { status: "POSITIVE_GROSS_HINT" },
    })).toBe("AWAIT_REVIEW_RECOVERY");
  });
});
