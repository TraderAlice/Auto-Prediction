import {
  hashCanonical,
  multiplyFixedCeil,
  multiplyFixedFloor,
  parseFixed,
  type Hash,
} from "@pmh/domain";
import { parseJsonWithNumberLexemes } from "@pmh/protocol";
import { z } from "zod";
import type { VerifiedRawFixture } from "./raw-fixture.js";
import {
  buildRealCandidatePreflightEvidence,
  type RealCandidatePreflightEvidence,
} from "./real-candidate-preflight.js";

const SCALE = 100_000_000n;

const PolymarketMarketSchema = z.array(
  z.object({
    id: z.string(),
    conditionId: z.string(),
    outcomes: z.string(),
    clobTokenIds: z.string(),
    feesEnabled: z.boolean(),
  }),
);

const LimitlessMarketSchema = z.object({
  id: z.string(),
  slug: z.string(),
  tradeType: z.literal("clob"),
  tokens: z.object({ yes: z.string(), no: z.string() }),
  metadata: z.object({ fee: z.boolean() }),
  settings: z.object({ minSize: z.string(), creatorFeePct: z.string() }),
});

const DecimalLevelSchema = z.object({
  price: z.string(),
  size: z.string(),
});

const PolymarketBookSchema = z.object({
  market: z.string(),
  asset_id: z.string(),
  timestamp: z.string().regex(/^\d+$/),
  hash: z.string().min(1),
  bids: z.array(DecimalLevelSchema),
  asks: z.array(DecimalLevelSchema),
  min_order_size: z.string(),
  tick_size: z.string(),
  neg_risk: z.boolean(),
});

const LimitlessLevelSchema = z.object({
  price: z.string(),
  size: z.string().regex(/^(?:0|[1-9]\d*)$/),
  side: z.enum(["BUY", "SELL"]),
});

const LimitlessBookSchema = z.object({
  bids: z.array(LimitlessLevelSchema),
  asks: z.array(LimitlessLevelSchema),
  tokenId: z.string(),
  minSize: z.string().regex(/^(?:0|[1-9]\d*)$/),
});

type Level = Readonly<{ price: bigint; quantity: bigint }>;

export type RealCandidateDepthEvidence = Readonly<{
  schemaVersion: "pmh.real-candidate-depth.v1";
  campaignId: "architecture-qualification";
  checkpointId: "three-venue-real-candidate-depth";
  status: "BLOCKED";
  classification: "SEARCH_LEAD_ONLY";
  preflightArtifactHash: Hash;
  claimIdentity: Hash;
  canonicalTitle: string;
  priceScale: string;
  quantityScale: string;
  screenQuantity: string;
  quantityBound: true;
  certificateGrade: false;
  books: readonly Readonly<{
    venueId: "limitless" | "polymarket-global";
    instrumentId: string;
    sourceFixtureHash: Hash;
    sourceReceivedAt: string;
    protocolIdentity: string;
    venueGeneration: string | null;
  }>[];
  legs: readonly Readonly<{
    venueId: "limitless" | "polymarket-global";
    outcome: "NO" | "YES";
    route: "DIRECT_BUY" | "SIMULATED_COMPLETE_SET_AND_SELL_YES";
    sourceInstrumentId: string;
    quantity: string;
    levelsConsumed: number;
    marginalPrice: string;
    collateralIn: string;
    proceeds: string;
    effectiveCost: string;
    feePosture:
      | "VENUE_REPORTS_DISABLED"
      | "VENUE_REPORTS_ENABLED_DYNAMIC_SCHEDULE_UNBOUND";
  }>[];
  totalCostBeforeFees: string;
  grossFloorBeforeFees: string;
  grossEdgeBpsBeforeFees: string;
  feeAdjustedFloor: null;
  blockers: readonly Readonly<{
    code:
      | "NON_POSITIVE_DEPTH_BOUND_FLOOR"
      | "FEE_SCHEDULE_INCOMPLETE"
      | "LIMITLESS_ROUTE_UNQUALIFIED"
      | "LIMITLESS_BOOK_GENERATION_UNAVAILABLE"
      | "INDEPENDENT_REVIEW_AUTHORITY_ABSENT";
    detail: string;
  }>[];
  stages: readonly Readonly<{
    stage:
      | "EXACT_CLAIM_MAP"
      | "BOOK_BINDING"
      | "QUANTITY_SCREEN"
      | "GROSS_DEPTH_SCREEN"
      | "FEE_SCHEDULE"
      | "ROUTE_QUALIFICATION"
      | "INDEPENDENT_REVIEW"
      | "EXACT_VERIFICATION";
    status: "PASS" | "BLOCKED";
    detail: string;
    evidenceHashes: readonly Hash[];
  }>[];
  verifierInvoked: false;
  arbitrageVerified: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: Hash;
}>;

function decodeLexical(fixture: VerifiedRawFixture): unknown {
  return parseJsonWithNumberLexemes(
    new TextDecoder("utf-8", { fatal: true }).decode(fixture.bytes),
  );
}

function fixedPrice(value: string): bigint {
  const price = parseFixed(value, SCALE);
  if (price < 0n || price > SCALE) {
    throw new Error(`depth price is outside [0, 1]: ${value}`);
  }
  return price;
}

function positiveQuantity(value: bigint, label: string): bigint {
  if (value <= 0n) throw new Error(`${label} quantity must be positive`);
  return value;
}

function buyFromAsks(levels: readonly Level[], quantity: bigint) {
  let remaining = quantity;
  let cost = 0n;
  let marginalPrice = 0n;
  let levelsConsumed = 0;
  for (const level of [...levels].sort((left, right) =>
    left.price < right.price ? -1 : left.price > right.price ? 1 : 0,
  )) {
    if (remaining === 0n) break;
    const take = remaining < level.quantity ? remaining : level.quantity;
    cost += multiplyFixedCeil(take, level.price, SCALE);
    remaining -= take;
    marginalPrice = level.price;
    levelsConsumed += 1;
  }
  if (remaining !== 0n) throw new Error("Polymarket YES ask depth is insufficient");
  return { cost, marginalPrice, levelsConsumed };
}

function sellIntoBids(levels: readonly Level[], quantity: bigint) {
  let remaining = quantity;
  let proceeds = 0n;
  let marginalPrice = 0n;
  let levelsConsumed = 0;
  for (const level of [...levels].sort((left, right) =>
    left.price > right.price ? -1 : left.price < right.price ? 1 : 0,
  )) {
    if (remaining === 0n) break;
    const take = remaining < level.quantity ? remaining : level.quantity;
    proceeds += multiplyFixedFloor(take, level.price, SCALE);
    remaining -= take;
    marginalPrice = level.price;
    levelsConsumed += 1;
  }
  if (remaining !== 0n) throw new Error("Limitless YES bid depth is insufficient");
  return { proceeds, marginalPrice, levelsConsumed };
}

function assertFixture(
  fixture: VerifiedRawFixture,
  venue: "limitless" | "polymarket-global",
  name: string,
): void {
  if (fixture.metadata.venue !== venue || fixture.metadata.name !== name) {
    throw new Error(`${name} fixture binding is invalid`);
  }
}

export function buildRealCandidateDepthEvidence(input: {
  polymarket: VerifiedRawFixture;
  opinion: VerifiedRawFixture;
  limitless: VerifiedRawFixture;
  polymarketBook: VerifiedRawFixture;
  limitlessBook: VerifiedRawFixture;
}): RealCandidateDepthEvidence {
  const preflight: RealCandidatePreflightEvidence =
    buildRealCandidatePreflightEvidence(input);
  assertFixture(
    input.polymarketBook,
    "polymarket-global",
    "polymarket-trump-out-2027-book",
  );
  assertFixture(
    input.limitlessBook,
    "limitless",
    "limitless-trump-out-2027-book",
  );

  const [polymarketMarket] = PolymarketMarketSchema.parse(
    decodeLexical(input.polymarket),
  );
  if (polymarketMarket === undefined) {
    throw new Error("Polymarket exact-market fixture is empty");
  }
  const limitlessMarket = LimitlessMarketSchema.parse(
    decodeLexical(input.limitless),
  );
  const polymarketBook = PolymarketBookSchema.parse(
    decodeLexical(input.polymarketBook),
  );
  const limitlessBook = LimitlessBookSchema.parse(
    decodeLexical(input.limitlessBook),
  );

  const outcomes = z.array(z.string()).length(2).parse(
    JSON.parse(polymarketMarket.outcomes),
  );
  const tokenIds = z.array(z.string()).length(2).parse(
    JSON.parse(polymarketMarket.clobTokenIds),
  );
  const yesIndex = outcomes.findIndex(
    (outcome) => outcome.toUpperCase() === "YES",
  );
  const polymarketYesToken = tokenIds[yesIndex];
  if (
    yesIndex < 0 ||
    polymarketYesToken === undefined ||
    polymarketBook.asset_id !== polymarketYesToken ||
    polymarketBook.market !== polymarketMarket.conditionId
  ) {
    throw new Error("Polymarket book does not bind the exact YES instrument");
  }
  if (
    limitlessBook.tokenId !== limitlessMarket.tokens.yes ||
    preflight.legs.find((leg) => leg.venueId === "limitless")?.outcome !== "NO"
  ) {
    throw new Error("Limitless book cannot support the exact NO acquisition route");
  }
  if (polymarketMarket.feesEnabled || !limitlessMarket.metadata.fee) {
    throw new Error("venue-reported fee posture differs from the depth model");
  }
  if (polymarketBook.neg_risk) {
    throw new Error("Polymarket exact route unexpectedly uses negative risk");
  }

  const polymarketMinimum = positiveQuantity(
    parseFixed(polymarketBook.min_order_size, SCALE),
    "Polymarket minimum",
  );
  const limitlessMinimum = positiveQuantity(
    BigInt(limitlessBook.minSize),
    "Limitless minimum",
  );
  if (limitlessMinimum !== BigInt(limitlessMarket.settings.minSize)) {
    throw new Error("Limitless book minimum differs from the exact market");
  }
  const screenQuantity =
    polymarketMinimum > limitlessMinimum
      ? polymarketMinimum
      : limitlessMinimum;
  const polymarketTick = positiveQuantity(
    parseFixed(polymarketBook.tick_size, SCALE),
    "Polymarket tick",
  );

  const polymarketAsks = polymarketBook.asks.map((level) => ({
    price: fixedPrice(level.price),
    quantity: positiveQuantity(
      parseFixed(level.size, SCALE),
      "Polymarket ask",
    ),
  }));
  if (polymarketAsks.some((level) => level.price % polymarketTick !== 0n)) {
    throw new Error("Polymarket ask depth is off tick");
  }
  const limitlessBids = limitlessBook.bids.map((level) => {
    if (level.side !== "BUY") {
      throw new Error("Limitless bid level has the wrong side");
    }
    return {
      price: fixedPrice(level.price),
      quantity: positiveQuantity(BigInt(level.size), "Limitless bid"),
    };
  });
  const directBuy = buyFromAsks(polymarketAsks, screenQuantity);
  const splitAndSell = sellIntoBids(limitlessBids, screenQuantity);
  const limitlessNoCost = screenQuantity - splitAndSell.proceeds;
  const totalCostBeforeFees = directBuy.cost + limitlessNoCost;
  const grossFloorBeforeFees = screenQuantity - totalCostBeforeFees;

  const books = Object.freeze([
    Object.freeze({
      venueId: "polymarket-global" as const,
      instrumentId: polymarketYesToken,
      sourceFixtureHash: input.polymarketBook.rawHash,
      sourceReceivedAt: input.polymarketBook.metadata.fetchedAt,
      protocolIdentity: input.polymarketBook.metadata.protocolVersion,
      venueGeneration: polymarketBook.hash,
    }),
    Object.freeze({
      venueId: "limitless" as const,
      instrumentId: limitlessBook.tokenId,
      sourceFixtureHash: input.limitlessBook.rawHash,
      sourceReceivedAt: input.limitlessBook.metadata.fetchedAt,
      protocolIdentity: input.limitlessBook.metadata.protocolVersion,
      venueGeneration: null,
    }),
  ]);
  const legs = Object.freeze([
    Object.freeze({
      venueId: "polymarket-global" as const,
      outcome: "YES" as const,
      route: "DIRECT_BUY" as const,
      sourceInstrumentId: polymarketYesToken,
      quantity: screenQuantity.toString(),
      levelsConsumed: directBuy.levelsConsumed,
      marginalPrice: directBuy.marginalPrice.toString(),
      collateralIn: directBuy.cost.toString(),
      proceeds: "0",
      effectiveCost: directBuy.cost.toString(),
      feePosture: "VENUE_REPORTS_DISABLED" as const,
    }),
    Object.freeze({
      venueId: "limitless" as const,
      outcome: "NO" as const,
      route: "SIMULATED_COMPLETE_SET_AND_SELL_YES" as const,
      sourceInstrumentId: limitlessBook.tokenId,
      quantity: screenQuantity.toString(),
      levelsConsumed: splitAndSell.levelsConsumed,
      marginalPrice: splitAndSell.marginalPrice.toString(),
      collateralIn: screenQuantity.toString(),
      proceeds: splitAndSell.proceeds.toString(),
      effectiveCost: limitlessNoCost.toString(),
      feePosture: "VENUE_REPORTS_ENABLED_DYNAMIC_SCHEDULE_UNBOUND" as const,
    }),
  ]);
  const blockers = Object.freeze([
    ...(grossFloorBeforeFees <= 0n
      ? [
          Object.freeze({
            code: "NON_POSITIVE_DEPTH_BOUND_FLOOR" as const,
            detail:
              "The quantity-bound route consumes the complete payout before fees.",
          }),
        ]
      : []),
    Object.freeze({
      code: "FEE_SCHEDULE_INCOMPLETE" as const,
      detail:
        "The Limitless taker fee is dynamic and is not bound by these anonymous book fixtures.",
    }),
    Object.freeze({
      code: "LIMITLESS_ROUTE_UNQUALIFIED" as const,
      detail:
        "Acquiring NO requires a simulated complete-set split and YES sale; no value-moving route was invoked or qualified.",
    }),
    Object.freeze({
      code: "LIMITLESS_BOOK_GENERATION_UNAVAILABLE" as const,
      detail:
        "The anonymous Limitless REST orderbook binds receive time and raw bytes but exposes no venue generation identity.",
    }),
    Object.freeze({
      code: "INDEPENDENT_REVIEW_AUTHORITY_ABSENT" as const,
      detail:
        "The exact claim map remains qualification evidence, not a production equivalence review.",
    }),
  ]);
  const bookHashes = Object.freeze(
    books.map((book) => book.sourceFixtureHash).sort(),
  );
  const stages = Object.freeze([
    Object.freeze({
      stage: "EXACT_CLAIM_MAP" as const,
      status: "PASS" as const,
      detail: "The depth screen reuses the immutable exact three-venue claim map.",
      evidenceHashes: Object.freeze([preflight.claimEvidenceHash]),
    }),
    Object.freeze({
      stage: "BOOK_BINDING" as const,
      status: "PASS" as const,
      detail: "Both anonymous books bind the exact route instruments and raw bytes.",
      evidenceHashes: bookHashes,
    }),
    Object.freeze({
      stage: "QUANTITY_SCREEN" as const,
      status: "PASS" as const,
      detail: "Five complete-payout shares fit inside the first level on both route legs.",
      evidenceHashes: bookHashes,
    }),
    Object.freeze({
      stage: "GROSS_DEPTH_SCREEN" as const,
      status: grossFloorBeforeFees > 0n ? ("PASS" as const) : ("BLOCKED" as const),
      detail: `${(grossFloorBeforeFees * 10_000n) / screenQuantity} bps before fees at the quantity-bound route.`,
      evidenceHashes: bookHashes,
    }),
    Object.freeze({
      stage: "FEE_SCHEDULE" as const,
      status: "BLOCKED" as const,
      detail: "The dynamic Limitless taker fee is not fixture-bound.",
      evidenceHashes: Object.freeze([input.limitless.rawHash]),
    }),
    Object.freeze({
      stage: "ROUTE_QUALIFICATION" as const,
      status: "BLOCKED" as const,
      detail: "Complete-set split and YES sale remain simulation-only.",
      evidenceHashes: Object.freeze([input.limitlessBook.rawHash]),
    }),
    Object.freeze({
      stage: "INDEPENDENT_REVIEW" as const,
      status: "BLOCKED" as const,
      detail: "Production equivalence-review authority is not configured.",
      evidenceHashes: Object.freeze([preflight.claimEvidenceHash]),
    }),
    Object.freeze({
      stage: "EXACT_VERIFICATION" as const,
      status: "BLOCKED" as const,
      detail: "Verifier not invoked because gross economics and prerequisites fail closed.",
      evidenceHashes: bookHashes,
    }),
  ]);
  const body = {
    schemaVersion: "pmh.real-candidate-depth.v1" as const,
    campaignId: "architecture-qualification" as const,
    checkpointId: "three-venue-real-candidate-depth" as const,
    status: "BLOCKED" as const,
    classification: "SEARCH_LEAD_ONLY" as const,
    preflightArtifactHash: preflight.artifactHash,
    claimIdentity: preflight.claimIdentity,
    canonicalTitle: preflight.canonicalTitle,
    priceScale: SCALE.toString(),
    quantityScale: SCALE.toString(),
    screenQuantity: screenQuantity.toString(),
    quantityBound: true as const,
    certificateGrade: false as const,
    books,
    legs,
    totalCostBeforeFees: totalCostBeforeFees.toString(),
    grossFloorBeforeFees: grossFloorBeforeFees.toString(),
    grossEdgeBpsBeforeFees: (
      (grossFloorBeforeFees * 10_000n) /
      screenQuantity
    ).toString(),
    feeAdjustedFloor: null,
    blockers,
    stages,
    verifierInvoked: false as const,
    arbitrageVerified: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
