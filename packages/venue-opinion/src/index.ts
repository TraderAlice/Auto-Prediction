import { parseFixed } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import {
  parseJsonWithNumberLexemes,
  type NormalizedCatalogListing,
  type VenueManifest,
} from "@pmh/protocol";
import { z } from "zod";

const ResponseSchema = z.object({
  errno: z.string(),
  result: z.object({
    list: z.array(
      z.object({
        marketId: z.string(),
        questionId: z.string(),
        marketTitle: z.string(),
        statusEnum: z.string(),
        rules: z.string(),
        yesLabel: z.string(),
        noLabel: z.string(),
        yesTokenId: z.string(),
        noTokenId: z.string(),
        quoteToken: z.string(),
        chainId: z.string(),
      }),
    ),
  }),
});

const UnsignedIntegerSchema = z.string().regex(/^(?:0|[1-9]\d*)$/u);
const DecimalSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/u);
const OrderbookResponseSchema = z.object({
  errno: z.string(),
  result: z.object({
    tokenId: z.string(),
    timestamp: UnsignedIntegerSchema,
    asks: z.array(z.unknown()),
  }),
});
const OrderbookLevelSchema = z.object({
  price: DecimalSchema,
  size: DecimalSchema,
});

export const OPINION_ORDERBOOK_PROTOCOL_IDENTITY =
  "opinion-openapi-token-orderbook:2026-08-02" as const;

export type OpinionOrderbookBestAsk = Readonly<{
  bestAsk: bigint;
  nativeTimestamp: string;
}>;

export const opinionManifest: VenueManifest = {
  venueId: "opinion",
  displayName: "Opinion",
  adapterVersion: "0.1.1",
  protocolIdentity: "openapi:2026-07-31",
  officialSources: [
    "https://docs.opinion.trade/developer-guide/opinion-open-api/overview",
    "https://docs.opinion.trade/developer-guide/opinion-open-api/token",
  ],
  mechanisms: ["BNB outcome-token CLOB"],
  precisionRules: ["token identifiers stay as decimal strings"],
  authenticationBoundary:
    "public catalog/orderbook anonymous; wallet and trading SDK excluded",
  capabilities: [
    {
      capability: "MARKET_CATALOG",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["opinion-catalog"],
      limitations: ["fixture-backed catalog slice"],
    },
    {
      capability: "REALTIME_BOOK",
      implemented: true,
      qualification: ["DISCOVER", "OBSERVE"],
      evidenceRefs: ["opinion-token-orderbook"],
      limitations: [
        "bounded on-demand anonymous REST snapshots only",
        "best asks are search evidence, not executable depth or fee-complete prices",
        "no sequence-bearing stream is implemented",
      ],
    },
  ],
  liveExecutionEnabled: false,
};

export function normalizeOpinionOrderbookBestAsk(
  bytes: Uint8Array,
  expectedTokenId: string,
  priceScale: bigint,
  quantityScale: bigint,
): OpinionOrderbookBestAsk {
  if (priceScale <= 0n || quantityScale <= 0n) {
    throw new Error("Opinion orderbook scales must be positive");
  }
  const response = OrderbookResponseSchema.parse(
    parseJsonWithNumberLexemes(new TextDecoder().decode(bytes)),
  );
  if (response.errno !== "0") {
    throw new Error(`Opinion orderbook reports errno ${response.errno}`);
  }
  if (response.result.tokenId !== expectedTokenId) {
    throw new Error("Opinion orderbook token id does not match the request");
  }
  const asks = response.result.asks.flatMap((value) => {
    const parsed = OrderbookLevelSchema.safeParse(value);
    if (!parsed.success) return [];
    const price = parseFixed(parsed.data.price, priceScale);
    const size = parseFixed(parsed.data.size, quantityScale);
    return price >= 0n && price <= priceScale && size > 0n ? [price] : [];
  });
  if (asks.length === 0) {
    throw new Error("Opinion orderbook has no valid ask");
  }
  asks.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  return Object.freeze({
    bestAsk: asks[0]!,
    nativeTimestamp: response.result.timestamp,
  });
}

export function normalizeOpinionCatalog(
  fixture: VerifiedRawFixture,
): readonly NormalizedCatalogListing[] {
  const response = ResponseSchema.parse(
    parseJsonWithNumberLexemes(new TextDecoder().decode(fixture.bytes)),
  );
  if (response.errno !== "0") {
    throw new Error(`Opinion fixture reports errno ${response.errno}`);
  }
  return response.result.list.map((market) => ({
    venueId: opinionManifest.venueId,
    venueEventId: market.questionId,
    venueInstrumentId: market.marketId,
    title: market.marketTitle,
    description: market.rules,
    status: market.statusEnum,
    mechanism: "ONCHAIN_CLOB",
    rulesText: market.rules,
    outcomes: [
      {
        venueOutcomeId: market.yesTokenId,
        label: market.yesLabel,
      },
      {
        venueOutcomeId: market.noTokenId,
        label: market.noLabel,
      },
    ],
    collateralId: `${market.chainId}:${market.quoteToken}`,
    priceScale: 100_000_000n,
    quantityScale: 1_000_000_000_000_000_000n,
    sourceFixtureHash: fixture.rawHash,
    protocolIdentity: fixture.metadata.protocolVersion,
  }));
}
