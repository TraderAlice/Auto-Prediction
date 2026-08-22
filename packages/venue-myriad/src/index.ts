import { parseFixed } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import {
  parseJsonWithNumberLexemes,
  type NormalizedCatalogListing,
  type VenueManifest,
} from "@pmh/protocol";
import { z } from "zod";

const ResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      state: z.string(),
      tradingModel: z.enum(["amm", "ob"]),
      executionMode: z.string(),
      eventId: z.string().nullable(),
      expiresAt: z.string(),
      resolutionSource: z.string(),
      token: z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.string(),
      }),
      outcomes: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          price: z.string(),
          tokenId: z.string(),
        }),
      ),
    }),
  ),
});

export const myriadManifest: VenueManifest = {
  venueId: "myriad",
  displayName: "Myriad Markets",
  adapterVersion: "0.1.1",
  protocolIdentity: "api-v2.0.4:2026-07-31",
  officialSources: [
    "https://docs.myriad.markets/builders/myriad-api-reference",
  ],
  mechanisms: ["multi-chain AMM and order-book listings"],
  precisionRules: [
    "JSON numeric tokens are decoded from source lexemes before fixed-point parsing",
  ],
  authenticationBoundary:
    "public catalog at anonymous rate limit; quote-with-fee and value-moving calls excluded",
  capabilities: [
    {
      capability: "MARKET_CATALOG",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["myriad-amm-catalog"],
      limitations: ["fixture-backed catalog slice"],
    },
    {
      capability: "AMM_POOL",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["myriad-amm-catalog"],
      limitations: ["catalog state only; quote curve pending"],
    },
  ],
  liveExecutionEnabled: false,
};

export function normalizeMyriadCatalog(
  fixture: VerifiedRawFixture,
): readonly NormalizedCatalogListing[] {
  const response = ResponseSchema.parse(
    parseJsonWithNumberLexemes(new TextDecoder().decode(fixture.bytes)),
  );
  return response.data.map((market) => {
    const collateralScale = 10n ** BigInt(market.token.decimals);
    return {
      venueId: myriadManifest.venueId,
      ...(market.eventId === null ? {} : { venueEventId: market.eventId }),
      venueInstrumentId: `${market.id}:${market.slug}`,
      title: market.title,
      description: market.description,
      rulesText: market.description,
      status: market.state.toUpperCase(),
      mechanism: market.tradingModel === "amm" ? "AMM" : "ONCHAIN_CLOB",
      closesAt: market.expiresAt,
      resolutionSourceUrl: market.resolutionSource,
      outcomes: market.outcomes.map((outcome) => ({
        venueOutcomeId: outcome.tokenId,
        label: outcome.title,
        indicativePrice: parseFixed(outcome.price, 100_000_000n),
      })),
      collateralId: `${market.token.symbol}:${market.token.address}`,
      priceScale: 100_000_000n,
      quantityScale: collateralScale,
      sourceFixtureHash: fixture.rawHash,
      protocolIdentity: fixture.metadata.protocolVersion,
    };
  });
}
