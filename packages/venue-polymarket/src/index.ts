import { parseFixed } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import {
  parseJsonWithNumberLexemes,
  type NormalizedCatalogListing,
  type VenueManifest,
} from "@pmh/protocol";
import { z } from "zod";

const MarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string(),
  conditionId: z.string(),
  active: z.boolean(),
  closed: z.boolean(),
  endDate: z.string(),
  outcomes: z.string(),
  outcomePrices: z.string(),
  clobTokenIds: z.string(),
  orderPriceMinTickSize: z.string(),
  resolutionSource: z.string(),
});

const StringArraySchema = z.array(z.string());

export const polymarketManifest: VenueManifest = {
  venueId: "polymarket-global",
  displayName: "Polymarket Predictions",
  adapterVersion: "0.0.0",
  protocolIdentity: "gamma-rest+combo-rfq:2026-07-31",
  officialSources: ["https://docs.polymarket.com/"],
  mechanisms: ["Polygon conditional outcome-token CLOB", "Combo/RFQ"],
  precisionRules: [
    "Gamma numeric tokens are decoded lexically before fixed-point parsing",
    "catalog price scale is 1e8",
  ],
  authenticationBoundary:
    "public catalog and market data only; signing and order APIs excluded",
  capabilities: [
    {
      capability: "MARKET_CATALOG",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["polymarket-catalog"],
      limitations: ["fixture-backed catalog slice"],
    },
    {
      capability: "COMBO_RFQ",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["polymarket-combo"],
      limitations: ["read-only combo discovery"],
    },
    {
      capability: "CONDITIONAL_TOKEN",
      implemented: false,
      qualification: [],
      evidenceRefs: ["https://docs.polymarket.com/trading/positions/manage"],
      limitations: ["simulation not implemented"],
    },
  ],
  liveExecutionEnabled: false,
};

export function normalizePolymarketCatalog(
  fixture: VerifiedRawFixture,
): readonly NormalizedCatalogListing[] {
  if (fixture.metadata.venue !== polymarketManifest.venueId) {
    throw new Error("fixture venue does not match Polymarket adapter");
  }
  const decoded = z
    .array(MarketSchema)
    .parse(parseJsonWithNumberLexemes(new TextDecoder().decode(fixture.bytes)));

  return decoded.map((market) => {
    const labels = StringArraySchema.parse(JSON.parse(market.outcomes));
    const prices = StringArraySchema.parse(JSON.parse(market.outcomePrices));
    const tokenIds = StringArraySchema.parse(JSON.parse(market.clobTokenIds));
    if (labels.length !== prices.length || labels.length !== tokenIds.length) {
      throw new Error(`market ${market.id} has inconsistent outcome arrays`);
    }
    return {
      venueId: polymarketManifest.venueId,
      venueEventId: market.conditionId,
      venueInstrumentId: market.id,
      title: market.question,
      description: market.description,
      status: market.active && !market.closed ? "OPEN" : "CLOSED",
      mechanism: "ONCHAIN_CLOB",
      closesAt: market.endDate,
      ...(market.resolutionSource === ""
        ? {}
        : { rulesUrl: market.resolutionSource }),
      outcomes: labels.map((label, index) => ({
        venueOutcomeId: tokenIds[index] ?? "",
        label,
        indicativePrice: parseFixed(prices[index] ?? "", 100_000_000n),
      })),
      priceScale: 100_000_000n,
      quantityScale: 100_000_000n,
      minPriceTick: parseFixed(market.orderPriceMinTickSize, 100_000_000n),
      sourceFixtureHash: fixture.rawHash,
      protocolIdentity: fixture.metadata.protocolVersion,
    };
  });
}
