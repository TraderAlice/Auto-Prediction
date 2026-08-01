import {
  hashCanonical,
  parseFixed,
  type Hash,
} from "@pmh/domain";
import { parseJsonWithNumberLexemes } from "@pmh/protocol";
import { z } from "zod";
import type { VerifiedRawFixture } from "./raw-fixture.js";
import {
  buildThreeVenueClaimEvidence,
  type ThreeVenueClaimEvidence,
} from "./three-venue-claim.js";

const PRICE_SCALE = 1_000_000n;

const PolymarketQuoteSchema = z.array(
  z.object({
    id: z.string(),
    question: z.string(),
    outcomes: z.string(),
    outcomePrices: z.string(),
    bestAsk: z.string(),
    feesEnabled: z.boolean(),
  }),
);

const LimitlessQuoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  prices: z.tuple([z.string(), z.string()]),
  tradePrices: z.object({
    buy: z.object({ market: z.tuple([z.string(), z.string()]) }),
  }),
  metadata: z.object({ fee: z.boolean() }),
  settings: z.object({ creatorFeePct: z.string() }),
});

export type RealCandidatePreflightStage = Readonly<{
  stage:
    | "EXACT_CLAIM_MAP"
    | "INDICATIVE_SCREEN"
    | "REPORTED_BUY_SCREEN"
    | "FEE_AND_DEPTH"
    | "INDEPENDENT_REVIEW"
    | "EXACT_VERIFICATION";
  status: "PASS" | "BLOCKED";
  detail: string;
  evidenceHashes: readonly Hash[];
}>;

export type RealCandidatePreflightEvidence = Readonly<{
  schemaVersion: "pmh.real-candidate-preflight.v1";
  campaignId: "architecture-qualification";
  checkpointId: "three-venue-real-candidate-preflight";
  status: "BLOCKED";
  classification: "SEARCH_LEAD_ONLY";
  claimEvidenceHash: Hash;
  claimIdentity: Hash;
  canonicalTitle: string;
  exactVenueCount: 3;
  payoutScale: string;
  legs: readonly Readonly<{
    venueId: "limitless" | "polymarket-global";
    listingId: string;
    outcome: "NO" | "YES";
    catalogIndicativeCost: string;
    venueReportedBuyCost: string;
    venueReportedBuyKind: "GAMMA_BEST_ASK" | "LIMITLESS_MARKET_BUY";
    sourceFixtureHash: Hash;
    sourceReceivedAt: string;
  }>[];
  catalogIndicativeTotalCost: string;
  catalogIndicativeGrossFloor: string;
  catalogIndicativeGrossEdgeBps: string;
  venueReportedBuyTotalCost: string;
  venueReportedBuyGrossFloor: string;
  venueReportedBuyGrossEdgeBps: string;
  quoteEvidenceHash: Hash;
  blockers: readonly Readonly<{
    code:
      | "NON_POSITIVE_REPORTED_BUY_FLOOR"
      | "EXECUTABLE_DEPTH_MISSING"
      | "FEE_SCHEDULE_INCOMPLETE"
      | "INDEPENDENT_REVIEW_AUTHORITY_ABSENT";
    detail: string;
  }>[];
  stages: readonly RealCandidatePreflightStage[];
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

function fixed(value: string): bigint {
  const parsed = parseFixed(value, PRICE_SCALE);
  if (parsed < 0n || parsed > PRICE_SCALE) {
    throw new Error(`preflight price is outside [0, 1]: ${value}`);
  }
  return parsed;
}

function assertFixtureBinding(
  claim: ThreeVenueClaimEvidence,
  fixture: VerifiedRawFixture,
  venueId: "limitless" | "polymarket-global",
  listingId: string,
): void {
  const listing = claim.listings.find((item) => item.venueId === venueId);
  if (
    listing === undefined ||
    listing.listingId !== listingId ||
    listing.sourceFixtureHash !== fixture.rawHash
  ) {
    throw new Error(`${venueId} quote fixture does not bind the exact claim map`);
  }
}

export function buildRealCandidatePreflightEvidence(input: {
  polymarket: VerifiedRawFixture;
  opinion: VerifiedRawFixture;
  limitless: VerifiedRawFixture;
}): RealCandidatePreflightEvidence {
  const claim = buildThreeVenueClaimEvidence(input);
  const [polymarket] = PolymarketQuoteSchema.parse(
    decodeLexical(input.polymarket),
  );
  const limitless = LimitlessQuoteSchema.parse(decodeLexical(input.limitless));
  if (polymarket === undefined) {
    throw new Error("Polymarket quote fixture is empty");
  }
  assertFixtureBinding(claim, input.polymarket, "polymarket-global", polymarket.id);
  assertFixtureBinding(claim, input.limitless, "limitless", limitless.id);
  if (
    polymarket.question !== claim.canonicalTitle ||
    limitless.title !== claim.canonicalTitle
  ) {
    throw new Error("quote fixture title differs from the exact claim map");
  }

  const polymarketOutcomes = z
    .array(z.string())
    .length(2)
    .parse(JSON.parse(polymarket.outcomes));
  const polymarketPrices = z
    .array(z.string())
    .length(2)
    .parse(JSON.parse(polymarket.outcomePrices));
  const yesIndex = polymarketOutcomes.findIndex(
    (outcome) => outcome.toUpperCase() === "YES",
  );
  if (yesIndex < 0) {
    throw new Error("Polymarket fixture has no YES outcome quote");
  }

  const polymarketYesIndicative = fixed(polymarketPrices[yesIndex] ?? "");
  const polymarketYesBuy = fixed(polymarket.bestAsk);
  const limitlessNoIndicative = fixed(limitless.prices[1]);
  const limitlessNoBuy = fixed(limitless.tradePrices.buy.market[1]);
  const legs = Object.freeze([
    Object.freeze({
      venueId: "polymarket-global" as const,
      listingId: polymarket.id,
      outcome: "YES" as const,
      catalogIndicativeCost: polymarketYesIndicative.toString(),
      venueReportedBuyCost: polymarketYesBuy.toString(),
      venueReportedBuyKind: "GAMMA_BEST_ASK" as const,
      sourceFixtureHash: input.polymarket.rawHash,
      sourceReceivedAt: input.polymarket.metadata.fetchedAt,
    }),
    Object.freeze({
      venueId: "limitless" as const,
      listingId: limitless.id,
      outcome: "NO" as const,
      catalogIndicativeCost: limitlessNoIndicative.toString(),
      venueReportedBuyCost: limitlessNoBuy.toString(),
      venueReportedBuyKind: "LIMITLESS_MARKET_BUY" as const,
      sourceFixtureHash: input.limitless.rawHash,
      sourceReceivedAt: input.limitless.metadata.fetchedAt,
    }),
  ]);
  const catalogIndicativeTotalCost = legs.reduce(
    (total, leg) => total + BigInt(leg.catalogIndicativeCost),
    0n,
  );
  const catalogIndicativeGrossFloor = PRICE_SCALE - catalogIndicativeTotalCost;
  const venueReportedBuyTotalCost = legs.reduce(
    (total, leg) => total + BigInt(leg.venueReportedBuyCost),
    0n,
  );
  const venueReportedBuyGrossFloor = PRICE_SCALE - venueReportedBuyTotalCost;
  const quoteEvidenceBody = {
    claimEvidenceHash: claim.artifactHash,
    payoutScale: PRICE_SCALE.toString(),
    legs,
    catalogIndicativeTotalCost: catalogIndicativeTotalCost.toString(),
    catalogIndicativeGrossFloor: catalogIndicativeGrossFloor.toString(),
    venueReportedBuyTotalCost: venueReportedBuyTotalCost.toString(),
    venueReportedBuyGrossFloor: venueReportedBuyGrossFloor.toString(),
  };
  const quoteEvidenceHash = hashCanonical(quoteEvidenceBody);
  const blockers = Object.freeze([
    ...(venueReportedBuyGrossFloor <= 0n
      ? [
          Object.freeze({
            code: "NON_POSITIVE_REPORTED_BUY_FLOOR" as const,
            detail:
              "Venue-reported buy costs consume the complete payout before fees.",
          }),
        ]
      : []),
    Object.freeze({
      code: "EXECUTABLE_DEPTH_MISSING" as const,
      detail:
        "Catalog and venue-reported quotes do not bind executable quantity or book generation.",
    }),
    Object.freeze({
      code: "FEE_SCHEDULE_INCOMPLETE" as const,
      detail:
        "The fixtures do not bind a complete conservative fee schedule for both legs.",
    }),
    Object.freeze({
      code: "INDEPENDENT_REVIEW_AUTHORITY_ABSENT" as const,
      detail:
        "The exact claim map is qualification evidence, not a production equivalence review.",
    }),
  ]);
  const stages = Object.freeze([
    Object.freeze({
      stage: "EXACT_CLAIM_MAP" as const,
      status: "PASS" as const,
      detail: "Three fixture listings bind identical rules and binary payouts.",
      evidenceHashes: Object.freeze([claim.artifactHash]),
    }),
    Object.freeze({
      stage: "INDICATIVE_SCREEN" as const,
      status: catalogIndicativeGrossFloor > 0n ? ("PASS" as const) : ("BLOCKED" as const),
      detail: `${(catalogIndicativeGrossFloor * 10_000n) / PRICE_SCALE} bps gross catalog hint before fees and depth.`,
      evidenceHashes: Object.freeze([quoteEvidenceHash]),
    }),
    Object.freeze({
      stage: "REPORTED_BUY_SCREEN" as const,
      status: venueReportedBuyGrossFloor > 0n ? ("PASS" as const) : ("BLOCKED" as const),
      detail: `${(venueReportedBuyGrossFloor * 10_000n) / PRICE_SCALE} bps gross floor at venue-reported buy quotes.`,
      evidenceHashes: Object.freeze([quoteEvidenceHash]),
    }),
    Object.freeze({
      stage: "FEE_AND_DEPTH" as const,
      status: "BLOCKED" as const,
      detail: "No quantity-bound book generation or complete fee evidence.",
      evidenceHashes: Object.freeze(
        legs.map((leg) => leg.sourceFixtureHash).sort(),
      ),
    }),
    Object.freeze({
      stage: "INDEPENDENT_REVIEW" as const,
      status: "BLOCKED" as const,
      detail: "Production equivalence-review authority is not configured.",
      evidenceHashes: Object.freeze([claim.artifactHash]),
    }),
    Object.freeze({
      stage: "EXACT_VERIFICATION" as const,
      status: "BLOCKED" as const,
      detail: "Verifier not invoked because prerequisite evidence failed closed.",
      evidenceHashes: Object.freeze([quoteEvidenceHash]),
    }),
  ]);
  const body = {
    schemaVersion: "pmh.real-candidate-preflight.v1" as const,
    campaignId: "architecture-qualification" as const,
    checkpointId: "three-venue-real-candidate-preflight" as const,
    status: "BLOCKED" as const,
    classification: "SEARCH_LEAD_ONLY" as const,
    claimEvidenceHash: claim.artifactHash,
    claimIdentity: claim.claimIdentity,
    canonicalTitle: claim.canonicalTitle,
    exactVenueCount: 3 as const,
    payoutScale: PRICE_SCALE.toString(),
    legs,
    catalogIndicativeTotalCost: catalogIndicativeTotalCost.toString(),
    catalogIndicativeGrossFloor: catalogIndicativeGrossFloor.toString(),
    catalogIndicativeGrossEdgeBps: (
      (catalogIndicativeGrossFloor * 10_000n) /
      PRICE_SCALE
    ).toString(),
    venueReportedBuyTotalCost: venueReportedBuyTotalCost.toString(),
    venueReportedBuyGrossFloor: venueReportedBuyGrossFloor.toString(),
    venueReportedBuyGrossEdgeBps: (
      (venueReportedBuyGrossFloor * 10_000n) /
      PRICE_SCALE
    ).toString(),
    quoteEvidenceHash,
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
