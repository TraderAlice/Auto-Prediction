import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildSemanticRelationGraph,
  searchSemanticGraphNeighborhood,
} from "../src/index.js";

const at = "2026-08-01T00:00:00.000Z";

function listing(venueId: string) {
  return Object.freeze({
    listingRef: `${venueId}:pizza`,
    venueId,
    venueInstrumentId: "pizza",
    title: "Will Trump eat pizza on stream in August?",
    description: "A public event claim.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "Resolves yes if the named event occurs; void rule is not supplied.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "500000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "500000" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: at,
    sourceRawHash: hashCanonical({ venueId }),
    protocolIdentity: `protocol:${venueId}`,
  });
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ sources: 2 }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings: Object.freeze([listing("venue-a"), listing("venue-b")]),
  });
  const proposalBody = Object.freeze({
    relationKind: "EQUIVALENT" as const,
    listingRefs: Object.freeze(["venue-a:pizza", "venue-b:pizza"]),
    statement: "The two listings may resolve to the same public event claim.",
    rationale: "Titles and positive conditions align.",
    falsifiers: Object.freeze(["Venue void rules differ."]),
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  });
  const proposal = Object.freeze({ ...proposalBody, proposalId: hashCanonical(proposalBody) });
  const opportunityId = `ai:${proposal.proposalId}`;
  const reportBody = Object.freeze({
    schemaVersion: "pmh.semantic-review-report.v1" as const,
    status: "PASS" as const,
    startedAt: at,
    completedAt: "2026-08-01T00:00:01.000Z",
    engine: Object.freeze({
      transport: "VERCEL_AI_SDK" as const,
      provider: "deepseek" as const,
      model: "deepseek-v4-flash",
      role: "ADVERSARIAL_SEMANTIC_REVIEWER" as const,
      independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER" as const,
    }),
    input: Object.freeze({
      opportunityId,
      proposalId: proposal.proposalId,
      proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
      corpusSnapshotIdentity: corpus.snapshotIdentity,
      evidencePosture: "ORIGINAL_CORPUS" as const,
      relationKind: "EQUIVALENT" as const,
      statement: proposal.statement,
      listingEvidence: Object.freeze(corpus.listings.map((item) => Object.freeze({
        listingRef: item.listingRef,
        listingHash: hashCanonical(item),
        sourceRawHash: item.sourceRawHash,
        protocolIdentity: item.protocolIdentity,
      }))),
    }),
    result: Object.freeze({
      recommendation: "ESCALATE" as const,
      relationConclusion: "EQUIVALENT" as const,
      assessments: Object.freeze({
        outcomeMapping: "Binary labels align.",
        timingAndClose: "Close times align.",
        voidAndCancellation: "Void evidence is missing.",
        resolutionSources: "Protocol sources are distinct.",
      }),
      counterexamples: Object.freeze(["One venue may void while the other settles no."]),
      missingEvidence: Object.freeze(["Need authoritative void and cancellation rules."]),
      rationale: "Escalate until the mismatch is resolved.",
      authority: "ADVISORY_ONLY" as const,
      productionReviewAuthority: false as const,
      simulationAuthority: false as const,
      executionAuthority: false as const,
    }),
    effects: Object.freeze({ externalWrites: false as const, valueMovingActions: false as const, liveExecutionEnabled: false as const }),
  });
  const report = Object.freeze({ ...reportBody, artifactHash: hashCanonical(reportBody) });
  const review = Object.freeze({
    reviewId: hashCanonical({ opportunityId, proposalId: proposal.proposalId }),
    opportunityId,
    proposalId: proposal.proposalId,
    proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
    corpusSnapshotIdentity: corpus.snapshotIdentity,
    model: "deepseek-v4-flash",
    status: "PASS" as const,
    startedAt: at,
    completedAt: report.completedAt,
    diagnostic: null,
    report,
  });
  const decisionBody = Object.freeze({
    schemaVersion: "pmh.research-semantic-decision.v1" as const,
    opportunityId,
    semanticReviewArtifactHash: report.artifactHash,
    reviewRecommendation: "ESCALATE" as const,
    decision: "REJECT" as const,
    rationale: "Reject until authoritative void semantics are bound.",
    decidedAt: "2026-08-01T00:00:02.000Z",
    authority: "LOCAL_OPERATOR_RESEARCH_ONLY" as const,
    productionReviewAuthority: false as const,
    productionPromotionEligible: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({ externalWrites: false as const, valueMovingActions: false as const, liveExecutionEnabled: false as const }),
  });
  const decision = Object.freeze({ ...decisionBody, decisionId: hashCanonical(decisionBody) });
  const leaseArtifact = hashCanonical({ duplicate: 1 });

  return {
    corpus,
    input: {
      corpus,
      archaeologist: {
        records: [{
          status: "PASS",
          report: { completedAt: at, result: { proposals: [proposal] } },
        }],
      },
      searchLeases: {
        records: [{
          artifactHash: leaseArtifact,
          lease: { issuedAt: at },
          completedAt: at,
          lineage: { duplicateOfLeaseId: hashCanonical({ earlier: 1 }) },
          fastLane: { candidateListingRefs: proposal.listingRefs },
        }],
      },
      semanticReviews: { records: [review] },
      lifecycle: {
        semanticDecisions: [decision],
        cases: [],
        exactVerifications: [],
        shadowRuns: [],
      },
      relationPayoff: { qualifications: [] },
      materializations: { records: [] },
    } as unknown as Parameters<typeof buildSemanticRelationGraph>[0],
  };
}

describe("content-addressed semantic relation graph", () => {
  it("binds listings, relation review, counterexamples, and lifecycle feedback deterministically", () => {
    const { input } = fixture();
    const first = buildSemanticRelationGraph(input);
    const replay = buildSemanticRelationGraph(input);

    expect(replay).toEqual(first);
    expect(first.graphIdentity).toBe(replay.graphIdentity);
    expect(first.listingCount).toBe(2);
    expect(first.relationCount).toBe(1);
    expect(first.relations[0]?.counterexamples).toEqual([
      "One venue may void while the other settles no.",
    ]);
    expect(first.relations[0]?.exactDecision).toBe("REJECT");
    expect(first.feedback.map((item) => item.code).sort()).toEqual([
      "DUPLICATE",
      "MISSING_RULE",
      "SEMANTIC_REJECTED",
    ]);
    expect(first.modelConfidenceUsed).toBe(false);
    expect(first.executionAuthority).toBe(false);
  });

  it("returns a bounded graph neighborhood ranked by outcomes and freshness", () => {
    const graph = buildSemanticRelationGraph(fixture().input);
    const context = searchSemanticGraphNeighborhood(graph, "EQUIVALENCE", 4);

    expect(context.graphIdentity).toBe(graph.graphIdentity);
    expect(context.items[0]?.listingRefs).toEqual(["venue-a:pizza", "venue-b:pizza"]);
    expect(context.items[0]?.outcomeCodes).toEqual(["MISSING_RULE", "SEMANTIC_REJECTED"]);
    expect(context.searchBrief).toContain("falsification evidence");
    expect(context.priorityBasis).toBe("EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS");
    expect(context.semanticDecisionAuthority).toBe(false);
  });
});
