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

export const opinionManifest: VenueManifest = {
  venueId: "opinion",
  displayName: "Opinion",
  adapterVersion: "0.0.0",
  protocolIdentity: "openapi:2026-07-31",
  officialSources: [
    "https://docs.opinion.trade/developer-guide/opinion-open-api/overview",
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
  ],
  liveExecutionEnabled: false,
};

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
