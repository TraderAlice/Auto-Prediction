import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildFailureBudgetFrontier,
  buildMarketCorpusSnapshot,
  buildProbabilisticSemanticBound,
  buildSemanticConstraintArtifact,
  type DiscoveryCatalogListing,
  type MarketRelationProposal,
  type ProbabilityEstimateInput,
} from "../src/index.js";

const evaluatedAt = "2026-08-02T00:02:00.000Z";
const listingRefs = ["venue-a:shot", "venue-b:cola"] as const;

function listing(listingRef: string, title: string): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef,
    venueId: listingRef.split(":")[0]!,
    venueInstrumentId: listingRef.split(":")[1]!,
    title,
    description: "Public binary prediction market",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: "Resolves from the named public event.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: `${listingRef}:yes`, label: "Yes", indicativePrice: "0.61" }),
      Object.freeze({ venueOutcomeId: `${listingRef}:no`, label: "No", indicativePrice: "0.39" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-02T00:01:30.000Z",
    sourceRawHash: hashCanonical({ quote: listingRef }),
    protocolIdentity: hashCanonical({ protocol: listingRef.split(":")[0] }),
  });
}

const listings = Object.freeze([
  listing(listingRefs[0], "Will Trump be shot in August?"),
  listing(listingRefs[1], "Will Trump livestream drinking cola in September?"),
]);
const corpus = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ source: "failure-budget-test" }),
  eligibleSourceCount: 2,
  excludedSourceCount: 0,
  listings,
});
const proposalBody = Object.freeze({
  relationKind: "MUTUALLY_EXCLUSIVE" as const,
  listingRefs,
  statement: "An August shooting suppresses the later public appearance.",
  rationale: "Price the surviving joint state rather than declare it impossible.",
  falsifiers: Object.freeze(["A non-fatal injury followed by recovery permits both events."]),
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
});
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({ corpus: corpus.snapshotIdentity, ...proposalBody }),
});
const constraint = buildSemanticConstraintArtifact({
  proposal,
  proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
  evidenceCorpusSnapshotIdentity: corpus.snapshotIdentity,
  listingEvidence: listings.map((item) => ({
    listingRef: item.listingRef,
    listingHash: hashCanonical(item),
    sourceRawHash: item.sourceRawHash,
    protocolIdentity: item.protocolIdentity,
  })),
  draft: {
    classification: "PROBABILISTIC_DEPENDENCE",
    relationKind: "MUTUALLY_EXCLUSIVE",
    assumptions: ["The September contract requires a personal live appearance."],
    counterexampleAttempt: {
      attempted: true,
      result: "FOUND",
      narrative: "Recovery after a non-fatal injury preserves the joint Yes state.",
      truths: [true, true],
    },
    truthTable: [
      [false, false], [false, true], [true, false], [true, true],
    ].map((truths) => ({
      truths,
      disposition: "FEASIBLE" as const,
      rationale: truths[0] && truths[1] ? "Adverse but possible." : "Ordinary state.",
      evidenceListingRefs: listingRefs,
    })),
    unresolvedEvidence: ["Recovery time changes the joint probability."],
  },
});

function estimates(epsilonPpm: string): readonly ProbabilityEstimateInput[] {
  return Object.freeze([
    Object.freeze({
      estimator: "reference-class",
      method: "REFERENCE_CLASS" as const,
      lowerPpm: "20000",
      upperPpm: "40000",
      evidenceHashes: Object.freeze([hashCanonical({ evidence: "history" })]),
      assumptions: Object.freeze(["The injury is survivable."]),
      completedAt: "2026-08-02T00:00:00.000Z",
      expiresAt: "2026-08-03T00:00:00.000Z",
    }),
    Object.freeze({
      estimator: "causal",
      method: "CAUSAL_MODEL" as const,
      lowerPpm: "30000",
      upperPpm: epsilonPpm,
      evidenceHashes: Object.freeze([hashCanonical({ evidence: "causal" })]),
      assumptions: Object.freeze(["A proxy appearance does not count."]),
      completedAt: "2026-08-02T00:01:00.000Z",
      expiresAt: "2026-08-03T00:00:00.000Z",
    }),
  ]);
}

function bound(epsilonPpm: string) {
  return buildProbabilisticSemanticBound({
    semanticConstraint: constraint,
    adverseStateIds: ["TT"],
    estimates: estimates(epsilonPpm),
    counterScenarios: ["A fast recovery permits the later appearance."],
  });
}

describe("failure budget frontier", () => {
  it("ranks the portfolio by remaining tolerable semantic error", () => {
    const frontier = buildFailureBudgetFrontier({
      bounds: [bound("50000")],
      jobs: [],
      corpus,
      evaluatedAt,
    });

    expect(frontier).toMatchObject({
      schemaVersion: "pmh.failure-budget-frontier.v1",
      itemCount: 1,
      positiveMarginCount: 1,
      boundedCandidateCount: 0,
      quotePosture: "INDICATIVE_ZERO_FEE_ZERO_DEPTH_ONLY",
      authority: "FAILURE_BUDGET_RANKING_ONLY",
      executionAuthority: false,
      effects: { providerRequests: false, valueMovingActions: false },
    });
    expect(frontier.items[0]).toMatchObject({
      status: "RESEARCH_MARGIN",
      portfolioLabel: `NO ${listingRefs[0]} + NO ${listingRefs[1]}`,
      breakEvenEpsilonPpm: "220000",
      adverseProbabilityUpperPpm: "50000",
      remainingFailureBudgetPpm: "170000",
      budgetUtilizationBps: "2273",
      expectedEdgeFloorUnits: "170000",
      adverseTailLossUnits: "780000",
      blockers: ["DEPTH_INSUFFICIENT", "UNCALIBRATED"],
      guaranteedProfit: false,
      certificateAuthority: false,
    });
    expect(frontier.items[0]?.failureFactors.map((item) => item.source)).toEqual([
      "ASSUMPTION",
      "COUNTER_SCENARIO",
    ]);
    expect(buildFailureBudgetFrontier({
      bounds: [bound("50000")],
      jobs: [],
      corpus,
      evaluatedAt,
    }).contentHash).toBe(frontier.contentHash);
  });

  it("makes exhausted error tolerance visible instead of calling it arbitrage", () => {
    const item = buildFailureBudgetFrontier({
      bounds: [bound("250000")],
      jobs: [],
      corpus,
      evaluatedAt,
    }).items[0];
    expect(item).toMatchObject({
      status: "BUDGET_EXHAUSTED",
      remainingFailureBudgetPpm: "-30000",
      expectedEdgeFloorUnits: "-30000",
      guaranteedProfit: false,
      executionAuthority: false,
    });
  });

  it("fails early on non-canonical evaluation time", () => {
    expect(() => buildFailureBudgetFrontier({
      bounds: [], jobs: [], corpus, evaluatedAt: "not-a-date",
    })).toThrow(/canonical ISO/u);
  });
});
