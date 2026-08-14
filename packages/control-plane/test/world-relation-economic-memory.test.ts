import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertWorldRelationEconomicMemory,
  buildWorldRelationEconomicMemory,
  buildWorldRelationShadowRoutingProjection,
  type WorldRelationShadowTradeHypothesis,
} from "../src/index.js";

const hash = (label: string) => hashCanonical({ label });

describe("world relation economic memory", () => {
  it("binds the exact quote revision and deterministic route without authority", () => {
    const hypothesis: WorldRelationShadowTradeHypothesis = Object.freeze({
      schemaVersion: "pmh.world-relation-shadow-trade-hypothesis.v2",
      hypothesisId: hash("hypothesis"),
      sourceExperimentArtifactHash: hash("experiment"),
      sourceInputRevisionId: hash("input"),
      sourceCorpusSnapshotIdentity: hash("semantic-corpus"),
      quoteCorpusSnapshotIdentity: hash("quote-corpus"),
      adverseWorldStateId: "TF", adverseListingStateId: "TF", legs: [],
      payoffShape: Object.freeze({ commonPriceScale: "1000000",
        minimumNonAdversePayoutUnits: "1000000", adversePayoutUnits: "0",
        totalIndicativeCostUnits: "1047000", grossFailureBudgetUnits: "-47000",
        breakEvenAdverseProbabilityUpperPpm: "0",
        formula: "MIN_NON_ADVERSE_PAYOUT_MINUS_COST_MINUS_ADVERSE_PROBABILITY_TAIL" }),
      status: "NON_POSITIVE_INDICATIVE_MARGIN",
      blockers: Object.freeze(["ADVERSE_PROBABILITY_BOUND_UNAVAILABLE",
        "NON_POSITIVE_INDICATIVE_FAILURE_BUDGET"]),
      quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH",
      quoteRefreshPosture: "CURRENT_LISTING_REF_MATCH_OVER_RETAINED_SEMANTIC_INPUT",
      guaranteedProfit: false, verifierEligible: false,
      authority: "SHADOW_TRADE_HYPOTHESIS_ONLY", semanticDecisionAuthority: false,
      probabilityAuthority: false, certificateAuthority: false,
      executionAuthority: false, externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    const [route] = buildWorldRelationShadowRoutingProjection([hypothesis]).actions;
    const memory = buildWorldRelationEconomicMemory({ hypothesis, routeAction: route!,
      sourceFrontierArtifactHash: hash("frontier") });
    expect(assertWorldRelationEconomicMemory(memory)).toBe(memory);
    expect(memory).toMatchObject({ routeAction: "RETIRE_NON_POSITIVE_MARGIN",
      quoteCorpusSnapshotIdentity: hypothesis.quoteCorpusSnapshotIdentity,
      grossFailureBudgetUnits: "-47000", executionAuthority: false,
      valueMovingAuthority: false });
    expect(() => buildWorldRelationEconomicMemory({ hypothesis,
      routeAction: { ...route!, hypothesisId: hash("other") },
      sourceFrontierArtifactHash: hash("frontier") })).toThrow(/exact route action/u);
  });
});
