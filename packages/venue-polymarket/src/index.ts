import { parseFixed } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import type { VerifiedStreamFixture } from "@pmh/evidence";
import type { NormalizedBookUpdate } from "@pmh/market-state";
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

const BookLevelSchema = z.object({
  price: z.string(),
  size: z.string(),
});

const BookMessageSchema = z.object({
  event_type: z.literal("book"),
  asset_id: z.string(),
  timestamp: z.string().regex(/^\d+$/),
  hash: z.string(),
  bids: z.array(BookLevelSchema),
  asks: z.array(BookLevelSchema),
  tick_size: z.string(),
});

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
      capability: "REALTIME_BOOK",
      implemented: true,
      qualification: ["DISCOVER", "OBSERVE"],
      evidenceRefs: ["polymarket-book"],
      limitations: [
        "public price-change messages have no venue sequence; only full book events are normalized",
        "each replacement snapshot must enter rebuild before application",
      ],
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
      rulesText: market.description,
      status: market.active && !market.closed ? "OPEN" : "CLOSED",
      mechanism: "ONCHAIN_CLOB",
      closesAt: market.endDate,
      ...(market.resolutionSource === ""
        ? {}
        : { resolutionSourceUrl: market.resolutionSource }),
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

export function decodePolymarketBookStream(
  fixture: VerifiedStreamFixture,
): readonly NormalizedBookUpdate[] {
  if (fixture.metadata.venue !== polymarketManifest.venueId) {
    throw new Error("stream fixture venue does not match Polymarket adapter");
  }
  const seen = new Set<string>();
  const updates: NormalizedBookUpdate[] = [];
  for (const frame of fixture.frames) {
    const parsed: unknown = JSON.parse(frame.rawText);
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of messages) {
      const result = BookMessageSchema.safeParse(candidate);
      if (!result.success) continue;
      const message = result.data;
      const requiresRebuild = seen.has(message.asset_id);
      seen.add(message.asset_id);
      updates.push({
        instrumentId: message.asset_id,
        requiresRebuild,
        event: {
          kind: "SNAPSHOT",
          sequence: BigInt(message.timestamp),
          tickSize: parseFixed(message.tick_size, 100_000_000n),
          bids: message.bids.map((level) => ({
            price: parseFixed(level.price, 100_000_000n),
            size: parseFixed(level.size, 100_000_000n),
          })),
          asks: message.asks.map((level) => ({
            price: parseFixed(level.price, 100_000_000n),
            size: parseFixed(level.size, 100_000_000n),
          })),
          sourceHash: frame.frameHash,
        },
      });
    }
  }
  return updates;
}
