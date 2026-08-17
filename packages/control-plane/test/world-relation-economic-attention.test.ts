import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertWorldRelationEconomicAttention,
  buildWorldRelationEconomicAttention,
  buildWorldRelationEconomicMemory,
  buildWorldRelationShadowRoutingProjection,
  type WorldRelationFrontierSeed,
  type WorldRelationShadowTradeHypothesis,
} from "../src/index.js";

const hash = (label: string) => hashCanonical({ label });

describe("world relation economic attention", () => {
  it("turns a retired quote-bound construction into descriptive domain pressure", () => {
    const hypothesis: WorldRelationShadowTradeHypothesis = Object.freeze({
      schemaVersion: "pmh.world-relation-shadow-trade-hypothesis.v2",
      hypothesisId: hash("hypothesis"), sourceExperimentArtifactHash: hash("experiment"),
      sourceInputRevisionId: hash("input"), sourceCorpusSnapshotIdentity: hash("semantic"),
      quoteCorpusSnapshotIdentity: hash("quotes"), adverseWorldStateId: "TF",
      adverseListingStateId: "TF", legs: [],
      payoffShape: Object.freeze({ commonPriceScale: "100000000",
        minimumNonAdversePayoutUnits: "100000000", adversePayoutUnits: "0",
        totalIndicativeCostUnits: "103000000", grossFailureBudgetUnits: "-3000000",
        breakEvenAdverseProbabilityUpperPpm: "0",
        formula: "MIN_NON_ADVERSE_PAYOUT_MINUS_COST_MINUS_ADVERSE_PROBABILITY_TAIL" }),
      status: "NON_POSITIVE_INDICATIVE_MARGIN",
      blockers: Object.freeze(["ADVERSE_PROBABILITY_BOUND_UNAVAILABLE",
        "NON_POSITIVE_INDICATIVE_FAILURE_BUDGET"]),
      quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH",
      quoteRefreshPosture: "CURRENT_LISTING_REF_MATCH_OVER_RETAINED_SEMANTIC_INPUT",
      guaranteedProfit: false, verifierEligible: false,
      authority: "SHADOW_TRADE_HYPOTHESIS_ONLY", semanticDecisionAuthority: false,
      probabilityAuthority: false, certificateAuthority: false, executionAuthority: false,
      externalWriteAuthority: false, valueMovingAuthority: false,
    });
    const route = buildWorldRelationShadowRoutingProjection([hypothesis]).actions[0]!;
    const frontier = Object.freeze({ artifactHash: hash("frontier"),
      relationKind: "STATE_MEDIATED_INHIBITION",
      predicates: [{ semantic: { subjects: [{ canonicalLabel: "Example subject" }],
        verbPhrase: "performs a later public action" } }],
    }) as unknown as WorldRelationFrontierSeed;
    const memory = buildWorldRelationEconomicMemory({ hypothesis, routeAction: route,
      sourceFrontierArtifactHash: frontier.artifactHash });
    const attention = buildWorldRelationEconomicAttention({ memories: [memory],
      frontiers: [frontier] });

    expect(assertWorldRelationEconomicAttention(attention)).toBe(attention);
    expect(attention).toMatchObject({ retiredConstructionCount: 1,
      positiveScreenCount: 0, recommendedMutation: "DIVERSIFY_SEMANTIC_DOMAIN",
      priceIsSemanticTruth: false, schedulingAuthority: false });
    expect(attention.observations[0]).toMatchObject({
      grossFailureBudgetPpm: "-30000",
      selectionSignal: "DIVERSIFY_FROM_NON_POSITIVE_CONSTRUCTION",
      predicateSummaries: ["Example subject performs a later public action"],
    });
    const { projectionIdentity: _projectionIdentity, ...attentionBody } = attention;
    const inconsistentBody = Object.freeze({ ...attentionBody,
      retiredConstructionCount: 0 });
    expect(() => assertWorldRelationEconomicAttention(Object.freeze({
      ...inconsistentBody,
      projectionIdentity: hashCanonical(inconsistentBody),
    }))).toThrow(/bounded contract/u);
  });
});
