import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildSearchOutcomeAttribution,
  type SearchOutcomeAttributionInput,
} from "../src/index.js";

function h(value: string): Hash {
  return hashCanonical({ value });
}

const issueA = h("issue-a");
const issueB = h("issue-b");
const p1 = h("proposal-1");
const p2 = h("proposal-2");
const p3 = h("proposal-3");
const p4 = h("manual-proposal");
const p5 = h("lifecycle-missing");

function lease(
  name: string,
  issueId: Hash,
  proposalIds: readonly string[],
  status: "PASS" | "FAILED" = "PASS",
): SearchOutcomeAttributionInput["searchLeases"][number] {
  return Object.freeze({
    artifactHash: h(`lease:${name}`),
    status,
    completedAt: "2026-08-02T00:00:00.000Z",
    lease: Object.freeze({ issueId }),
    deepLane: Object.freeze({
      status: status === "PASS" ? "PASS" as const : "FAILED" as const,
      proposalIds,
    }),
  });
}

function input(): SearchOutcomeAttributionInput {
  return Object.freeze({
    issues: Object.freeze([{ issueId: issueA }, { issueId: issueB }]),
    searchLeases: Object.freeze([
      lease("a", issueA, [p1, p2, p5, "invalid-proposal-reference"]),
      lease("b", issueB, [p2, p3]),
      lease("failed", issueA, [p4], "FAILED"),
    ]),
    semanticReviews: Object.freeze([
      Object.freeze({
        reviewId: h("review-1"),
        proposalId: p1,
        status: "PASS" as const,
        completedAt: "2026-08-02T00:01:00.000Z",
        report: Object.freeze({
          artifactHash: h("review-report-1"),
          result: Object.freeze({ missingEvidence: Object.freeze(["fee evidence"]) }),
        }),
      }),
      Object.freeze({
        reviewId: h("review-2"),
        proposalId: p2,
        status: "PASS" as const,
        completedAt: "2026-08-02T00:02:00.000Z",
        report: Object.freeze({
          artifactHash: h("review-report-2"),
          result: Object.freeze({ missingEvidence: Object.freeze(["rule A", "rule B"]) }),
        }),
      }),
      Object.freeze({
        reviewId: h("review-3"),
        proposalId: p3,
        status: "FAILED" as const,
        completedAt: "2026-08-02T00:03:00.000Z",
        report: null,
      }),
    ]),
    lifecycle: Object.freeze({
      cases: Object.freeze([
        Object.freeze({ opportunityId: `ai:${p1}`, discoveryKind: "AI_RELATION_PROPOSAL" as const, discoveryArtifactHash: p1, state: "SHADOW_COMPLETE" as const }),
        Object.freeze({ opportunityId: `ai:${p2}`, discoveryKind: "AI_RELATION_PROPOSAL" as const, discoveryArtifactHash: p2, state: "REJECTED_SEMANTICS" as const }),
        Object.freeze({ opportunityId: `ai:${p3}`, discoveryKind: "AI_RELATION_PROPOSAL" as const, discoveryArtifactHash: p3, state: "AWAITING_SEMANTIC_REVIEW" as const }),
        Object.freeze({ opportunityId: `ai:${p4}`, discoveryKind: "AI_RELATION_PROPOSAL" as const, discoveryArtifactHash: p4, state: "AWAITING_SEMANTIC_REVIEW" as const }),
      ]),
      semanticDecisions: Object.freeze([
        Object.freeze({ decisionId: h("decision-1"), opportunityId: `ai:${p1}`, decision: "ACCEPT_FOR_SIMULATION" as const, decidedAt: "2026-08-02T00:04:00.000Z" }),
        Object.freeze({ decisionId: h("decision-2"), opportunityId: `ai:${p2}`, decision: "REJECT" as const, decidedAt: "2026-08-02T00:05:00.000Z" }),
      ]),
      simulationBundles: Object.freeze([
        Object.freeze({ artifactHash: h("simulation-1"), opportunityId: `ai:${p1}`, status: "POSITIVE_SIMULATED_FLOOR" as const }),
      ]),
      exactVerifications: Object.freeze([
        Object.freeze({ artifactHash: h("exact-1"), opportunityId: `ai:${p1}`, status: "CERTIFIED" as const }),
      ]),
      shadowObservations: Object.freeze([
        Object.freeze({ artifactHash: h("shadow-1"), opportunityId: `ai:${p1}`, observedAtEpochMs: "1785600600000", status: "MATCHED_BOUNDS" as const }),
      ]),
    }),
    materializations: Object.freeze([
      Object.freeze({ materializationId: h("materialization-1"), opportunityId: `ai:${p1}`, completedAt: "2026-08-02T00:06:00.000Z", status: "READY" as const }),
    ]),
  });
}

describe("search outcome attribution", () => {
  it("attributes distinct proposals through every deterministic funnel stage", () => {
    const projection = buildSearchOutcomeAttribution(input());

    expect(projection).toMatchObject({
      measurementBasis: "DISTINCT_PROPOSALS_FROM_PASSED_ISSUE_LEASES",
      sourceArtifactCount: 16,
      issueCount: 2,
      attributedLeaseCount: 3,
      attributedProposalCount: 4,
      totalAiProposalCount: 4,
      unattributedAiProposalCount: 1,
      multiIssueProposalCount: 1,
      invalidProposalReferenceCount: 1,
      lifecycleMissingCount: 1,
      attributionCoverageBps: 7_500,
      modelConfidenceUsed: false,
      authority: "DERIVED_RESEARCH_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.stages).toEqual([
      { stage: "PROPOSED", count: 4 },
      { stage: "REVIEWED", count: 2 },
      { stage: "OPERATOR_ACCEPTED", count: 1 },
      { stage: "MATERIALIZED_READY", count: 1 },
      { stage: "POSITIVE_SIMULATION", count: 1 },
      { stage: "CERTIFIED", count: 1 },
      { stage: "SHADOW_OBSERVED", count: 1 },
    ]);
    expect(projection.bottlenecks).toEqual({
      pendingReviewCount: 2,
      reviewFailedCount: 1,
      pendingOperatorDecisionCount: 0,
      materializationBlockedCount: 0,
      simulationBlockedCount: 0,
      exactRejectedCount: 0,
      shadowDivergedCount: 0,
      missingEvidenceCount: 3,
    });
    expect(projection.byIssue.find((item) => item.issueId === issueA)).toMatchObject({
      leaseCount: 2,
      proposalCount: 3,
      reviewedCount: 2,
      operatorAcceptedCount: 1,
      operatorRejectedCount: 1,
      certifiedCount: 1,
      pendingReviewCount: 1,
      missingEvidenceCount: 3,
      operatorAcceptanceRateBps: 5_000,
    });
    expect(projection.byIssue.find((item) => item.issueId === issueB)).toMatchObject({
      leaseCount: 1,
      proposalCount: 2,
      reviewedCount: 1,
      operatorRejectedCount: 1,
      pendingReviewCount: 1,
      operatorAcceptanceRateBps: 0,
    });
  });

  it("is content-addressed and independent of input ordering", () => {
    const original = input();
    const reversed = buildSearchOutcomeAttribution({
      ...original,
      issues: Object.freeze([...original.issues].reverse()),
      searchLeases: Object.freeze([...original.searchLeases].reverse()),
      semanticReviews: Object.freeze([...original.semanticReviews].reverse()),
      lifecycle: Object.freeze({
        cases: Object.freeze([...original.lifecycle.cases].reverse()),
        semanticDecisions: Object.freeze([...original.lifecycle.semanticDecisions].reverse()),
        simulationBundles: Object.freeze([...original.lifecycle.simulationBundles].reverse()),
        exactVerifications: Object.freeze([...original.lifecycle.exactVerifications].reverse()),
        shadowObservations: Object.freeze([...original.lifecycle.shadowObservations].reverse()),
      }),
      materializations: Object.freeze([...original.materializations].reverse()),
    });
    const first = buildSearchOutcomeAttribution(original);
    expect(reversed).toEqual(first);
    const { attributionIdentity: _attributionIdentity, ...body } = first;
    expect(first.attributionIdentity).toBe(hashCanonical(body));
  });

  it("retains issue attribution from durable review jobs after leases roll off", () => {
    const original = input();
    const projection = buildSearchOutcomeAttribution({
      ...original,
      searchLeases: [],
      semanticReviewJobs: Object.freeze([
        Object.freeze({
          artifactHash: h("review-job-1"),
          proposalId: p1,
          issueIds: Object.freeze([issueA]),
        }),
        Object.freeze({
          artifactHash: h("review-job-2"),
          proposalId: p2,
          issueIds: Object.freeze([issueA, issueB]),
        }),
      ]),
    });

    expect(projection).toMatchObject({
      attributedLeaseCount: 0,
      attributedProposalCount: 2,
      multiIssueProposalCount: 1,
    });
    expect(projection.stages).toContainEqual({ stage: "REVIEWED", count: 2 });
    expect(projection.byIssue.find((item) => item.issueId === issueA)).toMatchObject({
      leaseCount: 0,
      proposalCount: 2,
      reviewedCount: 2,
    });
  });

  it("projects an empty, authority-locked funnel", () => {
    const projection = buildSearchOutcomeAttribution({
      issues: [],
      searchLeases: [],
      semanticReviews: [],
      lifecycle: {
        cases: [],
        semanticDecisions: [],
        simulationBundles: [],
        exactVerifications: [],
        shadowObservations: [],
      },
      materializations: [],
    });
    expect(projection.attributedProposalCount).toBe(0);
    expect(projection.attributionCoverageBps).toBeNull();
    expect(projection.stages.every((stage) => stage.count === 0)).toBe(true);
    expect(projection.effects.valueMovingActions).toBe(false);
  });
});
