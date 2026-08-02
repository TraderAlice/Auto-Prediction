import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertProbabilisticSemanticArbitrageEvaluation,
  assertProbabilisticSemanticBound,
  buildProbabilisticSemanticBound,
  buildSemanticConstraintArtifact,
  compileProbabilisticSemanticArbitrage,
  inspectSemanticConstraintAdmission,
  type MarketRelationProposal,
  type ProbabilityEstimateInput,
  type ProbabilisticPortfolioQuote,
} from "../src/index.js";

const listingRefs = ["venue-a:trump-shot-august", "venue-b:trump-cola-september"] as const;
const corpus = hashCanonical({ corpus: "shooting-cola-probability" });
const proposalBody = Object.freeze({
  relationKind: "MUTUALLY_EXCLUSIVE" as const,
  listingRefs,
  statement: "An August shooting makes a September live cola appearance substantially less likely.",
  rationale: "Search for a bounded-risk semantic price discrepancy.",
  falsifiers: ["A non-fatal shooting followed by recovery permits both events."],
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
});
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({ corpusSnapshotIdentity: corpus, ...proposalBody }),
});
const constraint = buildSemanticConstraintArtifact({
  proposal,
  proposalCorpusSnapshotIdentity: corpus,
  evidenceCorpusSnapshotIdentity: corpus,
  listingEvidence: listingRefs.map((listingRef) => ({
    listingRef,
    listingHash: hashCanonical({ listingRef }),
    sourceRawHash: hashCanonical({ rules: listingRef }),
    protocolIdentity: `protocol:${listingRef}`,
  })),
  draft: {
    classification: "PROBABILISTIC_DEPENDENCE",
    relationKind: "MUTUALLY_EXCLUSIVE",
    assumptions: ["The later market requires Trump to appear live and in person."],
    counterexampleAttempt: {
      attempted: true,
      result: "FOUND",
      narrative: "A non-fatal August shooting followed by recovery permits both markets to settle Yes.",
      truths: [true, true],
    },
    truthTable: [
      [false, false], [false, true], [true, false], [true, true],
    ].map((truths) => ({
      truths,
      disposition: "FEASIBLE" as const,
      rationale: truths[0] && truths[1]
        ? "Possible but treated as the probability-bounded adverse state."
        : "Ordinary feasible settlement state.",
      evidenceListingRefs: listingRefs,
    })),
    unresolvedEvidence: ["Recovery time and appearance format change the joint probability."],
  },
});

function estimates(epsilonPpm = "50000"): readonly ProbabilityEstimateInput[] {
  return Object.freeze([
    Object.freeze({
      estimator: "reference-class-worker",
      method: "REFERENCE_CLASS" as const,
      lowerPpm: "20000",
      upperPpm: "40000",
      evidenceHashes: Object.freeze([hashCanonical({ evidence: "historical-recovery" })]),
      assumptions: Object.freeze(["The shooting resolves Yes without requiring fatality."]),
      completedAt: "2026-08-02T00:00:00.000Z",
      expiresAt: "2026-08-03T00:00:00.000Z",
    }),
    Object.freeze({
      estimator: "independent-causal-worker",
      method: "CAUSAL_MODEL" as const,
      lowerPpm: "30000",
      upperPpm: epsilonPpm,
      evidenceHashes: Object.freeze([hashCanonical({ evidence: "appearance-mechanics" })]),
      assumptions: Object.freeze(["Recorded or proxy appearances do not resolve the live contract Yes."]),
      completedAt: "2026-08-02T00:01:00.000Z",
      expiresAt: "2026-08-02T12:00:00.000Z",
    }),
  ]);
}

function bound(epsilonPpm = "50000") {
  return buildProbabilisticSemanticBound({
    semanticConstraint: constraint,
    adverseStateIds: ["TT"],
    estimates: estimates(epsilonPpm),
    counterScenarios: [
      "The shooting is non-fatal and recovery is fast enough for the live appearance.",
      "The venue treats a prerecorded appearance as live.",
    ],
  });
}

function quotes(overrides?: Partial<ProbabilisticPortfolioQuote>): readonly ProbabilisticPortfolioQuote[] {
  return Object.freeze(listingRefs.map((listingRef, index) => Object.freeze({
    listingRef,
    outcome: "FALSE" as const,
    askPriceUnits: "390000",
    feeUnitsPerContract: "10000",
    priceScale: "1000000",
    availableQuantityUnits: "1000000",
    requiredQuantityUnits: "1000000",
    quantityScale: "1000000",
    observedAt: "2026-08-02T00:01:30.000Z",
    evidenceHash: hashCanonical({ quote: index }),
    ...overrides,
  })));
}

const riskPolicy = Object.freeze({
  maxQuoteAgeMs: 300_000,
  maxTailLossPpm: "900000",
  concentrationPpm: "100000",
  maxConcentrationPpm: "500000",
});

describe("probabilistic semantic arbitrage", () => {
  it("keeps the non-fatal shooting counterexample out of the hard lane but prices the bounded tail", () => {
    expect(inspectSemanticConstraintAdmission(constraint)).toMatchObject({
      status: "RESEARCH_ONLY",
      blocker: "NOT_HARD_CONSTRAINT",
    });
    const artifact = bound();
    expect(artifact).toMatchObject({
      adverseStateIds: ["TT"],
      lowerPpm: "20000",
      epsilonPpm: "50000",
      aggregateMethod: "CONSERVATIVE_ESTIMATOR_ENVELOPE",
      authority: "ESTIMATE_ONLY",
      hardArbitrageAuthority: false,
    });

    const evaluation = compileProbabilisticSemanticArbitrage({
      bound: artifact,
      quotes: quotes(),
      evaluatedAt: "2026-08-02T00:02:00.000Z",
      riskPolicy,
    });
    expect(evaluation).toMatchObject({
      classification: "PROBABILISTIC_SEMANTIC_ARBITRAGE",
      adverseProbabilityUpperPpm: "50000",
      minimumNonAdversePayoutUnits: "1000000",
      minimumAdversePayoutUnits: "0",
      expectedPayoutFloorUnits: "950000",
      totalAskUnits: "780000",
      totalFeeUnits: "20000",
      totalCostUnits: "800000",
      preFeeExpectedEdgeFloorUnits: "170000",
      expectedEdgeFloorUnits: "150000",
      adverseTailLossUnits: "800000",
      breakEvenEpsilonPpm: "200000",
      gates: {
        probabilityBoundFresh: "PASS",
        quoteFreshness: "PASS",
        depth: "PASS",
        concentration: "PASS",
        tailLoss: "PASS",
        positiveExpectedEdgeFloor: "PASS",
      },
      guaranteedProfit: false,
      verifierEligible: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(evaluation.statePayoffs).toEqual([
      { stateId: "FF", adverse: false, payoutUnits: "2000000" },
      { stateId: "FT", adverse: false, payoutUnits: "1000000" },
      { stateId: "TF", adverse: false, payoutUnits: "1000000" },
      { stateId: "TT", adverse: true, payoutUnits: "0" },
    ]);
    expect(() => assertProbabilisticSemanticArbitrageEvaluation(evaluation)).not.toThrow();
  });

  it("turns the same prices into a watch at the break-even epsilon", () => {
    const evaluation = compileProbabilisticSemanticArbitrage({
      bound: bound("200000"),
      quotes: quotes(),
      evaluatedAt: "2026-08-02T00:02:00.000Z",
      riskPolicy,
    });
    expect(evaluation).toMatchObject({
      classification: "SEMANTIC_WATCH",
      expectedEdgeFloorUnits: "0",
      breakEvenEpsilonPpm: "200000",
      gates: { positiveExpectedEdgeFloor: "BLOCKED" },
      diagnostics: ["NO_POSITIVE_EXPECTED_EDGE_FLOOR"],
    });
  });

  it("reports stale evidence, depth, concentration, and tail loss as independent gates", () => {
    const evaluation = compileProbabilisticSemanticArbitrage({
      bound: bound(),
      quotes: quotes({ availableQuantityUnits: "500000" }),
      evaluatedAt: "2026-08-04T00:00:00.000Z",
      riskPolicy: {
        maxQuoteAgeMs: 60_000,
        maxTailLossPpm: "700000",
        concentrationPpm: "600000",
        maxConcentrationPpm: "500000",
      },
    });
    expect(evaluation.classification).toBe("SEMANTIC_WATCH");
    expect(evaluation.gates).toMatchObject({
      probabilityBoundFresh: "BLOCKED",
      quoteFreshness: "BLOCKED",
      depth: "BLOCKED",
      concentration: "BLOCKED",
      tailLoss: "BLOCKED",
      positiveExpectedEdgeFloor: "PASS",
    });
    expect(evaluation.diagnostics).toEqual([
      "PROBABILITY_BOUND_STALE",
      "QUOTE_STALE",
      "DEPTH_INSUFFICIENT",
      "CONCENTRATION_LIMIT",
      "TAIL_LOSS_LIMIT",
    ]);
  });

  it("fails closed when aggregate probability or replay arithmetic is tampered", () => {
    const artifact = bound();
    const { artifactHash: _artifactHash, ...tamperedBody } = {
      ...artifact,
      epsilonPpm: "10000",
    };
    expect(() => assertProbabilisticSemanticBound({
      ...tamperedBody,
      artifactHash: hashCanonical(tamperedBody),
    })).toThrow(/evidence or authority contract/u);

    const evaluation = compileProbabilisticSemanticArbitrage({
      bound: artifact,
      quotes: quotes(),
      evaluatedAt: "2026-08-02T00:02:00.000Z",
      riskPolicy,
    });
    const { artifactHash: _evaluationHash, ...evaluationBody } = {
      ...evaluation,
      expectedEdgeFloorUnits: "999999",
    };
    expect(() => assertProbabilisticSemanticArbitrageEvaluation({
      ...evaluationBody,
      artifactHash: hashCanonical(evaluationBody),
    })).toThrow(/does not replay/u);
  });
});
