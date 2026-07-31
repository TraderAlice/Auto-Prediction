import { hashCanonical, type Hash } from "@pmh/domain";
import { z } from "zod";
import type { VerifiedRawFixture } from "./raw-fixture.js";

const PolymarketSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    question: z.string(),
    description: z.string(),
    outcomes: z.string(),
    endDate: z.string(),
  }),
);

const OpinionSchema = z.object({
  result: z.object({
    data: z.object({
      marketId: z.number().int(),
      slug: z.string(),
      marketTitle: z.string(),
      rules: z.string(),
      yesLabel: z.string(),
      noLabel: z.string(),
      cutoffAt: z.number().int(),
    }),
  }),
});

const LimitlessSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  expirationTimestamp: z.number().int(),
  metadata: z.object({ externalSlug: z.string() }),
});

type ClaimListing = Readonly<{
  venueId: "limitless" | "opinion" | "polymarket-global";
  listingId: string;
  slug: string;
  closesAt: string;
  sourceFixtureHash: Hash;
  ruleTextHash: Hash;
}>;

export type ThreeVenueClaimEvidence = Readonly<{
  schemaVersion: "pmh.three-venue-claim-evidence.v1";
  campaignId: "architecture-qualification";
  checkpointId: "three-venue-exact-claim";
  status: "PASS";
  mappingGrade: "EXACT";
  canonicalTitle: string;
  canonicalOutcomes: readonly ["NO", "YES"];
  ruleTextHash: Hash;
  claimIdentity: Hash;
  listings: readonly ClaimListing[];
  assertions: readonly Readonly<{
    assertionId: "THREE_DISTINCT_VENUES" | "IDENTICAL_RESOLUTION_RULES";
    status: "PASS";
    evidenceHashes: readonly Hash[];
  }>[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: Hash;
}>;

function decode(fixture: VerifiedRawFixture): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fixture.bytes));
}

function normalizeRuleText(value: string): string {
  return value
    .replace(/<\/p>\s*<p>/giu, "\n\n")
    .replace(/<[^>]+>/gu, "")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&amp;/giu, "&")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/gu, " "))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function buildThreeVenueClaimEvidence(input: {
  polymarket: VerifiedRawFixture;
  opinion: VerifiedRawFixture;
  limitless: VerifiedRawFixture;
}): ThreeVenueClaimEvidence {
  if (
    input.polymarket.metadata.venue !== "polymarket-global" ||
    input.opinion.metadata.venue !== "opinion" ||
    input.limitless.metadata.venue !== "limitless"
  ) {
    throw new Error("three-venue claim fixtures are bound to unexpected venues");
  }
  const [polymarket] = PolymarketSchema.parse(decode(input.polymarket));
  const opinion = OpinionSchema.parse(decode(input.opinion)).result.data;
  const limitless = LimitlessSchema.parse(decode(input.limitless));
  if (polymarket === undefined) throw new Error("Polymarket claim fixture is empty");

  const titles = [polymarket.question, opinion.marketTitle, limitless.title];
  const rules = [
    normalizeRuleText(polymarket.description),
    normalizeRuleText(opinion.rules),
    normalizeRuleText(limitless.description),
  ];
  const outcomes = [
    z.array(z.string()).parse(JSON.parse(polymarket.outcomes)),
    [opinion.yesLabel, opinion.noLabel],
    ["YES", "NO"],
  ].map((labels) => labels.map((label) => label.toUpperCase()).sort().join("|"));
  if (new Set(titles).size !== 1) throw new Error("claim titles are not identical");
  if (new Set(rules).size !== 1) throw new Error("resolution rules are not identical");
  if (outcomes.some((labels) => labels !== "NO|YES")) {
    throw new Error("claim outcomes are not the same binary partition");
  }
  if (limitless.metadata.externalSlug !== polymarket.slug) {
    throw new Error("Limitless external slug does not bind the Polymarket listing");
  }

  const canonicalTitle = titles[0] ?? "";
  const canonicalOutcomes = ["NO", "YES"] as const;
  const ruleTextHash = hashCanonical(rules[0]);
  const listings: readonly ClaimListing[] = [
    {
      venueId: "limitless",
      listingId: String(limitless.id),
      slug: limitless.slug,
      closesAt: new Date(limitless.expirationTimestamp).toISOString(),
      sourceFixtureHash: input.limitless.rawHash,
      ruleTextHash,
    },
    {
      venueId: "opinion",
      listingId: String(opinion.marketId),
      slug: opinion.slug,
      closesAt: new Date(opinion.cutoffAt * 1_000).toISOString(),
      sourceFixtureHash: input.opinion.rawHash,
      ruleTextHash,
    },
    {
      venueId: "polymarket-global",
      listingId: polymarket.id,
      slug: polymarket.slug,
      closesAt: polymarket.endDate,
      sourceFixtureHash: input.polymarket.rawHash,
      ruleTextHash,
    },
  ];
  const sourceHashes = listings.map((listing) => listing.sourceFixtureHash);
  const body = {
    schemaVersion: "pmh.three-venue-claim-evidence.v1" as const,
    campaignId: "architecture-qualification" as const,
    checkpointId: "three-venue-exact-claim" as const,
    status: "PASS" as const,
    mappingGrade: "EXACT" as const,
    canonicalTitle,
    canonicalOutcomes,
    ruleTextHash,
    claimIdentity: hashCanonical({ canonicalTitle, canonicalOutcomes, ruleTextHash }),
    listings,
    assertions: [
      {
        assertionId: "THREE_DISTINCT_VENUES" as const,
        status: "PASS" as const,
        evidenceHashes: sourceHashes,
      },
      {
        assertionId: "IDENTICAL_RESOLUTION_RULES" as const,
        status: "PASS" as const,
        evidenceHashes: [ruleTextHash, ...sourceHashes],
      },
    ],
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
