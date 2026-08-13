import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildWorldRelationShadowRoutingProjection,
  type WorldRelationShadowTradeHypothesis,
} from "../src/index.js";

const hash = (label: string) => hashCanonical({ label });

function hypothesis(
  label: string,
  blockers: WorldRelationShadowTradeHypothesis["blockers"],
): WorldRelationShadowTradeHypothesis {
  return {
    schemaVersion: "pmh.world-relation-shadow-trade-hypothesis.v1",
    hypothesisId: hash(label), sourceExperimentArtifactHash: hash(`${label}:experiment`),
    sourceInputRevisionId: hash(`${label}:input`),
    sourceCorpusSnapshotIdentity: hash(`${label}:corpus`), adverseWorldStateId: "TF",
    adverseListingStateId: "TF", legs: [],
    payoffShape: { commonPriceScale: "1000000", minimumNonAdversePayoutUnits: "1000000",
      adversePayoutUnits: "0", totalIndicativeCostUnits: "800000",
      grossFailureBudgetUnits: "200000", breakEvenAdverseProbabilityUpperPpm: "200000",
      formula: "MIN_NON_ADVERSE_PAYOUT_MINUS_COST_MINUS_ADVERSE_PROBABILITY_TAIL" },
    status: "RESEARCH_ONLY", blockers,
    quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH",
    guaranteedProfit: false, verifierEligible: false,
    authority: "SHADOW_TRADE_HYPOTHESIS_ONLY", semanticDecisionAuthority: false,
    probabilityAuthority: false, certificateAuthority: false, executionAuthority: false,
    externalWriteAuthority: false, valueMovingAuthority: false,
  };
}

describe("world relation shadow routing", () => {
  it("spends no estimator attention before margin and settlement gates", () => {
    const projection = buildWorldRelationShadowRoutingProjection([
      hypothesis("negative", ["NON_POSITIVE_INDICATIVE_FAILURE_BUDGET",
        "NON_EXACT_SETTLEMENT_PROJECTION", "ADVERSE_PROBABILITY_BOUND_UNAVAILABLE"]),
      hypothesis("settlement", ["NON_EXACT_SETTLEMENT_PROJECTION",
        "ADVERSE_PROBABILITY_BOUND_UNAVAILABLE"]),
      hypothesis("estimate", ["ADVERSE_PROBABILITY_BOUND_UNAVAILABLE"]),
      hypothesis("hold", ["INDICATIVE_PRICE_UNAVAILABLE"]),
    ]);
    expect(projection).toMatchObject({ hypothesisCount: 4, retiredCount: 1,
      settlementEvidenceCount: 1, probabilityEstimationCount: 1, heldCount: 1,
      providerRequestsStartedByRead: 0, jobsCreatedByRead: 0, automaticDispatch: false });
    expect(projection.actions.map((item) => item.action)).toEqual([
      "ESTIMATE_ADVERSE_PROBABILITY", "ACQUIRE_SETTLEMENT_EVIDENCE",
      "HOLD_RESEARCH_ONLY", "RETIRE_NON_POSITIVE_MARGIN",
    ]);
  });
});
