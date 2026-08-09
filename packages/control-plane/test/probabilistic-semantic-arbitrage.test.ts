import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertProbabilityCalibrationArtifact,
  assertProbabilityCalibrationObservation,
  assertProbabilisticSemanticArbitrageEvaluation,
  assertProbabilisticSemanticBound,
  buildProbabilityCalibrationArtifact,
  buildProbabilityCalibrationObservation,
  buildProbabilitySearchOrigin,
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

describe("resolved-outcome probability calibration", () => {
  function calibrationBound(
    tag: string,
    searchOrigin?: ReturnType<typeof buildProbabilitySearchOrigin>,
  ) {
    return buildProbabilisticSemanticBound({
      semanticConstraint: constraint,
      adverseStateIds: ["TT"],
      estimates: estimates(),
      counterScenarios: [
        "A non-fatal shooting permits the later appearance.",
        `Calibration cohort case ${tag}.`,
      ],
      ...(searchOrigin === undefined ? {} : { searchOrigin }),
    });
  }

  function observation(tag: string, adverse: boolean) {
    const artifact = calibrationBound(tag);
    return buildProbabilityCalibrationObservation({
      bound: artifact,
      resolutionEvidence: [...listingRefs].reverse().map((listingRef, index) => ({
        listingRef,
        truthValue: adverse,
        resolvedAt: `2026-08-02T0${index + 5}:00:00.000Z`,
        sourceRawHash: hashCanonical({ resolution: tag, listingRef }),
        protocolIdentity: `resolution:${listingRef}`,
      })),
    });
  }

  it("measures resolved adverse frequency against immutable role intervals", () => {
    const ordinary = observation("ordinary", false);
    const adverse = observation("adverse", true);
    expect(ordinary).toMatchObject({
      observedStateId: "FF",
      adverseOccurred: false,
      horizonBucket: "LE_1D",
      authority: "SHADOW_CALIBRATION_ONLY",
      probabilityCertificateAuthority: false,
      executionAuthority: false,
    });
    expect(adverse).toMatchObject({ observedStateId: "TT", adverseOccurred: true });
    expect(ordinary.resolutionEvidence.map((item) => item.listingRef)).toEqual(listingRefs);
    expect(() => assertProbabilityCalibrationObservation(ordinary)).not.toThrow();

    const calibration = buildProbabilityCalibrationArtifact({
      observations: [adverse, ordinary],
      createdAt: "2026-08-03T00:00:00.000Z",
      minimumSampleSize: 2,
    });
    expect(calibration).toMatchObject({
      minimumSampleSize: "2",
      measuredGroupCount: "2",
      insufficientGroupCount: "0",
      authority: "CALIBRATION_EVIDENCE_ONLY",
      probabilityCertificateAuthority: false,
      executionAuthority: false,
    });
    expect(calibration.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        estimator: "reference-class-worker",
        method: "REFERENCE_CLASS",
        sampleCount: "2",
        adverseCount: "1",
        empiricalRatePpm: "500000",
        meanLowerPpm: "20000",
        meanUpperPpm: "40000",
        upperExceedancePpm: "460000",
        meanMidpointBrierPpm: "470900",
        status: "UNDERPREDICTED",
      }),
      expect.objectContaining({
        estimator: "independent-causal-worker",
        method: "CAUSAL_MODEL",
        empiricalRatePpm: "500000",
        meanUpperPpm: "50000",
        upperExceedancePpm: "450000",
        meanMidpointBrierPpm: "461600",
        status: "UNDERPREDICTED",
      }),
    ]));
    expect(() => assertProbabilityCalibrationArtifact(calibration)).not.toThrow();
  });

  it("fails closed on duplicated outcomes, post-hoc forecasts, and metric tampering", () => {
    const resolved = observation("one-case", false);
    expect(() => buildProbabilityCalibrationArtifact({
      observations: [resolved, resolved],
      createdAt: "2026-08-03T00:00:00.000Z",
      minimumSampleSize: 2,
    })).toThrow(/duplicated/u);
    expect(() => buildProbabilityCalibrationObservation({
      bound: calibrationBound("post-hoc"),
      resolutionEvidence: listingRefs.map((listingRef) => ({
        listingRef,
        truthValue: false,
        resolvedAt: "2026-08-01T23:59:00.000Z",
        sourceRawHash: hashCanonical({ early: listingRef }),
        protocolIdentity: `resolution:${listingRef}`,
      })),
    })).toThrow(/predates/u);
    const sufficient = buildProbabilityCalibrationArtifact({
      observations: [observation("first", false), observation("second", true)],
      createdAt: "2026-08-03T00:00:00.000Z",
      minimumSampleSize: 2,
    });
    expect(() => assertProbabilityCalibrationArtifact({
      ...sufficient,
      groups: [{ ...sufficient.groups[0]!, empiricalRatePpm: "0" }, ...sufficient.groups.slice(1)],
    })).toThrow(/does not replay/u);
  });

  it("retains first-party search origin and builds family-aware mixed-history cohorts", () => {
    const issueId = hashCanonical({ issue: "physical co-occurrence exploration" });
    const origin = buildProbabilitySearchOrigin({
      issueIds: [issueId],
      semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
    });
    const currentBound = calibrationBound("origin-linked", origin);
    expect(currentBound).toMatchObject({
      schemaVersion: "pmh.probabilistic-semantic-bound.v2",
      searchOrigin: {
        issueIds: [issueId],
        semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
        attributionBasis: "SEMANTIC_REVIEW_DURABLE_ISSUES",
        authority: "ATTRIBUTION_ONLY",
      },
    });
    const currentObservation = buildProbabilityCalibrationObservation({
      bound: currentBound,
      resolutionEvidence: listingRefs.map((listingRef) => ({
        listingRef,
        truthValue: false,
        resolvedAt: "2026-08-02T08:00:00.000Z",
        sourceRawHash: hashCanonical({ current: listingRef }),
        protocolIdentity: `resolution:${listingRef}`,
      })),
    });
    const legacyObservation = observation("legacy-unattributed", true);
    const calibration = buildProbabilityCalibrationArtifact({
      observations: [legacyObservation, currentObservation],
      createdAt: "2026-08-03T00:00:00.000Z",
      minimumSampleSize: 2,
    });
    expect(currentObservation.schemaVersion).toBe(
      "pmh.probability-calibration-observation.v2",
    );
    expect(calibration.schemaVersion).toBe("pmh.probability-calibration.v2");
    expect(new Set(calibration.groups.map((group) => group.semanticFamily))).toEqual(
      new Set([null, "PHYSICAL_CO_OCCURRENCE"]),
    );
    expect(() => assertProbabilityCalibrationArtifact(calibration)).not.toThrow();

    const malformedOriginBody = {
      ...origin,
      issueIds: [issueId, issueId],
    };
    expect(() => calibrationBound("tampered-origin", {
      ...malformedOriginBody,
      originIdentity: hashCanonical((({ originIdentity: _identity, ...body }) => body)(
        malformedOriginBody,
      )),
    })).toThrow(/search origin/u);
  });
});
