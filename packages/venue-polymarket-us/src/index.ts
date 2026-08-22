import { hashCanonical, parseFixed, type Hash } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import type { NormalizedBookUpdate } from "@pmh/market-state";
import {
  parseJsonWithNumberLexemes,
  type NormalizedCatalogListing,
  type VenueManifest,
} from "@pmh/protocol";
import { z } from "zod";

export const POLYMARKET_US_PRICE_SCALE = 100_000_000n;
export const POLYMARKET_US_QUANTITY_SCALE = 10_000n;
export const POLYMARKET_US_RULEBOOK_URL =
  "https://www.cftc.gov/filings/orgrules/rules0519263672.docx";
export const POLYMARKET_US_GATEWAY_ORIGIN = "https://gateway.polymarket.us";

const MARKET_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,254}[a-z0-9])?$/u;

export function polymarketUsContractRulesUrl(slug: string): string {
  if (!MARKET_SLUG_PATTERN.test(slug)) {
    throw new Error("Polymarket US market slug is not URL-safe");
  }
  return `${POLYMARKET_US_GATEWAY_ORIGIN}/v1/market/slug/${slug}`;
}

export function polymarketUsContractRulesSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const prefix = "/v1/market/slug/";
    const slug = parsed.pathname.startsWith(prefix)
      ? parsed.pathname.slice(prefix.length)
      : "";
    return parsed.origin === POLYMARKET_US_GATEWAY_ORIGIN &&
        parsed.search === "" && parsed.hash === "" &&
        MARKET_SLUG_PATTERN.test(slug) &&
        polymarketUsContractRulesUrl(slug) === parsed.toString()
      ? slug
      : null;
  } catch {
    return null;
  }
}

const AmountSchema = z.object({
  value: z.string(),
  currency: z.literal("USD"),
});

const MarketSideSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  description: z.string(),
  price: z.string().optional(),
  long: z.boolean(),
  quote: AmountSchema.optional(),
  tradable: z.boolean().optional(),
});

const MarketSchema = z.object({
  id: z.string(),
  slug: z.string(),
  question: z.string(),
  title: z.string().optional(),
  description: z.string(),
  active: z.boolean(),
  closed: z.boolean(),
  archived: z.boolean(),
  status: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  orderPriceMinTickSize: z.string(),
  minimumTradeQty: z.string().optional(),
  feeCoefficient: z.string().optional(),
  marketSides: z.array(MarketSideSchema),
});

const CatalogSchema = z.object({ markets: z.array(MarketSchema) });
const MarketRuleDetailSchema = z.object({
  market: z.object({
    slug: z.string(),
    description: z.string(),
  }),
});
const SettlementSchema = z.object({
  slug: z.string(),
  settlement: z.string(),
});

export type PolymarketUsBinarySettlement = Readonly<{
  venueInstrumentId: string;
  truthValue: boolean;
  settlementPrice: "0" | "1";
  resolvedAt: null;
  resolutionTimeBasis: "UNAVAILABLE_FROM_ANONYMOUS_SETTLEMENT_ENDPOINT";
  sourceRawHash: Hash;
  protocolIdentity: string;
}>;

const BookLevelSchema = z.object({ px: AmountSchema, qty: z.string() });
const BookSchema = z.object({
  marketData: z.object({
    marketSlug: z.string(),
    bids: z.array(BookLevelSchema),
    offers: z.array(BookLevelSchema),
    state: z.literal("MARKET_STATE_OPEN"),
    transactTime: z.string(),
  }),
});

const BboSchema = z.object({
  marketData: z.object({
    marketSlug: z.string(),
    currentPx: AmountSchema,
    lastTradePx: AmountSchema,
    bestAsk: AmountSchema,
    bestBid: AmountSchema,
    askDepth: z.string(),
    bidDepth: z.string(),
    longQuote: AmountSchema,
    shortQuote: AmountSchema,
    lastPriceSample: z.object({
      longPx: AmountSchema,
      shortPx: AmountSchema,
      ts: z.string(),
    }),
  }),
});

export type PolymarketUsBboObservation = Readonly<{
  schemaVersion: "pmh.polymarket-us-bbo-observation.v1";
  artifactHash: Hash;
  marketSlug: string;
  observedAtEpochNs: bigint;
  currentPrice: bigint;
  lastTradePrice: bigint;
  bestBid: bigint;
  bestAsk: bigint;
  longQuote: bigint;
  shortQuote: bigint;
  bidDepth: number;
  askDepth: number;
  priceScale: bigint;
  catalogRawHash: Hash;
  bboRawHash: Hash;
  authority: "PUBLIC_MARKET_OBSERVATION_ONLY";
  executableDepth: false;
}>;

export const polymarketUsManifest: VenueManifest = {
  venueId: "polymarket-us",
  displayName: "Polymarket US",
  adapterVersion: "0.1.1",
  protocolIdentity: "gateway-rest-v1:2026-08-01",
  officialSources: [
    "https://docs.polymarket.us/api-reference/introduction",
    "https://docs.polymarket.us/api-reference/market/overview",
    "https://docs.polymarket.us/fees",
    POLYMARKET_US_RULEBOOK_URL,
  ],
  mechanisms: ["US centralized event-contract order book"],
  precisionRules: [
    "JSON numeric tokens are decoded lexically before fixed-point parsing",
    "internal public-price normalization scale is 1e8 and public quantity scale is 1e4",
    "the public book is long-side native; research-only NO depth is the documented one-minus-bid transform",
    "theta taker fees use a one-cent cumulative half-to-even upper bound for a fixed FOK research request",
  ],
  authenticationBoundary:
    "gateway catalog, book, and BBO are anonymous; api.polymarket.us trading and WebSocket surfaces require credentials and are excluded",
  capabilities: [
    {
      capability: "MARKET_CATALOG",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["polymarket-us-catalog"],
      limitations: ["bounded anonymous REST catalog slice"],
    },
    {
      capability: "REALTIME_BOOK",
      implemented: true,
      qualification: ["DISCOVER", "OBSERVE"],
      evidenceRefs: ["polymarket-us-market-book", "polymarket-us-market-bbo"],
      limitations: [
        "REST snapshots only; the documented market WebSocket requires API-key authentication",
        "book normalization remains long-contract native; anonymous simulation derives synthetic NO asks with raw lineage",
        "anonymous simulation uses the documented cumulative fee cap as a conservative fee bound, never as an observed fill charge",
      ],
    },
    {
      capability: "ORDER_GATEWAY",
      implemented: false,
      qualification: [],
      evidenceRefs: ["https://docs.polymarket.us/api-reference/orders/create-order"],
      limitations: ["authenticated order entry is outside this anonymous adapter"],
    },
  ],
  liveExecutionEnabled: false,
};

function decode(fixture: VerifiedRawFixture): unknown {
  if (fixture.metadata.venue !== polymarketUsManifest.venueId) {
    throw new Error("fixture venue does not match Polymarket US adapter");
  }
  return parseJsonWithNumberLexemes(
    new TextDecoder("utf-8", { fatal: true }).decode(fixture.bytes),
  );
}

function marketTitle(question: string, title: string | undefined): string {
  const trimmed = title?.trim() ?? "";
  return trimmed === "" || trimmed === question
    ? question
    : `${question} — ${trimmed}`;
}

function catalogMarkets(fixture: VerifiedRawFixture): z.infer<typeof MarketSchema>[] {
  return CatalogSchema.parse(decode(fixture)).markets;
}

export function normalizePolymarketUsCatalog(
  fixture: VerifiedRawFixture,
): readonly NormalizedCatalogListing[] {
  return catalogMarkets(fixture).map((market) => {
    if (
      market.marketSides.length !== 2 ||
      market.marketSides.filter((side) => side.long).length !== 1 ||
      market.marketSides.some((side) => side.identifier !== market.slug) ||
      new Set(market.marketSides.map((side) => side.id)).size !== 2
    ) {
      throw new Error(`Polymarket US market ${market.id} is not a bound binary contract`);
    }
    const outcomes = market.marketSides.map((side) => {
      if (
        side.quote !== undefined &&
        side.price !== undefined &&
        side.quote.value !== side.price
      ) {
        throw new Error(`Polymarket US market ${market.id} side price/quote diverged`);
      }
      const quote = side.quote?.value ?? side.price;
      return Object.freeze({
        venueOutcomeId: side.id,
        label: side.description,
        ...(quote === undefined
          ? {}
          : {
              indicativePrice: parseFixed(
                quote,
                POLYMARKET_US_PRICE_SCALE,
              ),
            }),
      });
    });
    return Object.freeze({
      venueId: polymarketUsManifest.venueId,
      venueEventId: market.id,
      venueInstrumentId: market.slug,
      title: marketTitle(market.question, market.title),
      description: market.description,
      status:
        market.active && !market.closed && !market.archived &&
        market.status === "MARKET_STATUS_OPEN"
          ? "OPEN"
          : "CLOSED",
      mechanism: "CENTRALIZED_ORDER_BOOK" as const,
      ...(market.startDate === undefined ? {} : { opensAt: market.startDate }),
      ...(market.endDate === undefined ? {} : { closesAt: market.endDate }),
      rulesText: market.description,
      rulesUrl: polymarketUsContractRulesUrl(market.slug),
      venueRulesUrl: POLYMARKET_US_RULEBOOK_URL,
      outcomes: Object.freeze(outcomes),
      collateralId: "USD",
      priceScale: POLYMARKET_US_PRICE_SCALE,
      quantityScale: POLYMARKET_US_QUANTITY_SCALE,
      minPriceTick: parseFixed(
        market.orderPriceMinTickSize,
        POLYMARKET_US_PRICE_SCALE,
      ),
      sourceFixtureHash: fixture.rawHash,
      protocolIdentity: fixture.metadata.protocolVersion,
    });
  });
}

export function extractPolymarketUsContractRules(
  bytes: Uint8Array,
  expectedSlug: string,
): string {
  const decoded = parseJsonWithNumberLexemes(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  const detail = MarketRuleDetailSchema.parse(decoded).market;
  if (detail.slug !== expectedSlug) {
    throw new Error("Polymarket US contract detail does not match the requested slug");
  }
  const rules = detail.description.replace(/\r\n?/gu, "\n").trim();
  if (rules === "") {
    throw new Error("Polymarket US contract detail has no resolution rules");
  }
  return rules;
}

export function decodePolymarketUsBinarySettlement(
  fixture: VerifiedRawFixture,
  expectedVenueInstrumentId?: string,
): PolymarketUsBinarySettlement {
  if (
    fixture.metadata.venue !== polymarketUsManifest.venueId ||
    fixture.metadata.protocolVersion !== polymarketUsManifest.protocolIdentity
  ) throw new Error("fixture protocol does not match Polymarket US settlement adapter");
  const settlement = SettlementSchema.parse(decode(fixture));
  if (
    expectedVenueInstrumentId !== undefined &&
    settlement.slug !== expectedVenueInstrumentId
  ) throw new Error("Polymarket US settlement does not match the requested instrument");
  if (settlement.settlement !== "0" && settlement.settlement !== "1") {
    throw new Error("Polymarket US settlement is not an exact binary payout");
  }
  return Object.freeze({
    venueInstrumentId: settlement.slug,
    truthValue: settlement.settlement === "1",
    settlementPrice: settlement.settlement,
    resolvedAt: null,
    resolutionTimeBasis: "UNAVAILABLE_FROM_ANONYMOUS_SETTLEMENT_ENDPOINT" as const,
    sourceRawHash: fixture.rawHash,
    protocolIdentity: fixture.metadata.protocolVersion,
  });
}

function timestampToEpochNanoseconds(value: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/u.exec(value);
  if (match === null) throw new Error("Polymarket US timestamp is not UTC nanoseconds");
  const secondsEpochMs = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(secondsEpochMs)) throw new Error("Polymarket US timestamp is invalid");
  const fractionalNs = BigInt((match[2] ?? "").padEnd(9, "0"));
  return BigInt(secondsEpochMs) * 1_000_000n + fractionalNs;
}

function boundCatalogMarket(
  catalogFixture: VerifiedRawFixture,
  marketSlug: string,
): z.infer<typeof MarketSchema> {
  const market = catalogMarkets(catalogFixture).find((item) => item.slug === marketSlug);
  if (market === undefined) {
    throw new Error(`Polymarket US market ${marketSlug} is absent from bound catalog evidence`);
  }
  return market;
}

export function decodePolymarketUsBookSnapshot(
  bookFixture: VerifiedRawFixture,
  catalogFixture: VerifiedRawFixture,
): NormalizedBookUpdate {
  const book = BookSchema.parse(decode(bookFixture)).marketData;
  const market = boundCatalogMarket(catalogFixture, book.marketSlug);
  const tickSize = parseFixed(
    market.orderPriceMinTickSize,
    POLYMARKET_US_PRICE_SCALE,
  );
  const normalizeLevels = (
    levels: readonly z.infer<typeof BookLevelSchema>[],
    side: "BID" | "ASK",
  ) => levels.map((level) => {
    const price = parseFixed(level.px.value, POLYMARKET_US_PRICE_SCALE);
    const size = parseFixed(level.qty, POLYMARKET_US_QUANTITY_SCALE);
    if (price <= 0n || price >= POLYMARKET_US_PRICE_SCALE || size <= 0n || price % tickSize !== 0n) {
      throw new Error(`Polymarket US ${side.toLowerCase()} level violates fixed-point bounds`);
    }
    return Object.freeze({ price, size });
  });
  return Object.freeze({
    instrumentId: book.marketSlug,
    requiresRebuild: false,
    event: Object.freeze({
      kind: "SNAPSHOT" as const,
      sequence: timestampToEpochNanoseconds(book.transactTime),
      tickSize,
      bids: Object.freeze(normalizeLevels(book.bids, "BID")),
      asks: Object.freeze(normalizeLevels(book.offers, "ASK")),
      sourceHash: hashCanonical({
        bookRawHash: bookFixture.rawHash,
        catalogRawHash: catalogFixture.rawHash,
        marketSlug: book.marketSlug,
        representation: "PUBLISHED_LONG_CONTRACT_BOOK_ONLY",
      }),
    }),
  });
}

export function normalizePolymarketUsBbo(
  bboFixture: VerifiedRawFixture,
  catalogFixture: VerifiedRawFixture,
): PolymarketUsBboObservation {
  const bbo = BboSchema.parse(decode(bboFixture)).marketData;
  boundCatalogMarket(catalogFixture, bbo.marketSlug);
  const depth = (value: string, name: string): number => {
    if (!/^(?:0|[1-9]\d*)$/u.test(value)) throw new Error(`${name} is not an integer`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error(`${name} exceeds safe count range`);
    return parsed;
  };
  const body = Object.freeze({
    schemaVersion: "pmh.polymarket-us-bbo-observation.v1" as const,
    marketSlug: bbo.marketSlug,
    observedAtEpochNs: timestampToEpochNanoseconds(bbo.lastPriceSample.ts),
    currentPrice: parseFixed(bbo.currentPx.value, POLYMARKET_US_PRICE_SCALE),
    lastTradePrice: parseFixed(bbo.lastTradePx.value, POLYMARKET_US_PRICE_SCALE),
    bestBid: parseFixed(bbo.bestBid.value, POLYMARKET_US_PRICE_SCALE),
    bestAsk: parseFixed(bbo.bestAsk.value, POLYMARKET_US_PRICE_SCALE),
    longQuote: parseFixed(bbo.longQuote.value, POLYMARKET_US_PRICE_SCALE),
    shortQuote: parseFixed(bbo.shortQuote.value, POLYMARKET_US_PRICE_SCALE),
    bidDepth: depth(bbo.bidDepth, "Polymarket US bid depth"),
    askDepth: depth(bbo.askDepth, "Polymarket US ask depth"),
    priceScale: POLYMARKET_US_PRICE_SCALE,
    catalogRawHash: catalogFixture.rawHash,
    bboRawHash: bboFixture.rawHash,
    authority: "PUBLIC_MARKET_OBSERVATION_ONLY" as const,
    executableDepth: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
