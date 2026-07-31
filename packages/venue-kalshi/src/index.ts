import { parseFixed } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import {
  parseJsonWithNumberLexemes,
  type NormalizedCatalogListing,
  type VenueManifest,
} from "@pmh/protocol";
import { z } from "zod";

const ResponseSchema = z.object({
  markets: z.array(
    z.object({
      ticker: z.string(),
      event_ticker: z.string(),
      title: z.string(),
      subtitle: z.string().nullable().optional(),
      yes_sub_title: z.string().optional(),
      no_sub_title: z.string().optional(),
      market_type: z.string(),
      status: z.string(),
      open_time: z.string(),
      close_time: z.string(),
      rules_primary: z.string(),
      rules_secondary: z.string(),
      yes_ask_dollars: z.string(),
      no_ask_dollars: z.string(),
      price_ranges: z.array(
        z.object({ start: z.string(), end: z.string(), step: z.string() }),
      ),
    }),
  ),
});

export const kalshiManifest: VenueManifest = {
  venueId: "kalshi",
  displayName: "Kalshi",
  adapterVersion: "0.0.0",
  protocolIdentity: "trade-api-v2:2026-07-31",
  officialSources: ["https://docs.kalshi.com/welcome"],
  mechanisms: ["centralized binary and multivariate event contracts"],
  precisionRules: ["fixed-point dollar fields are decimal strings"],
  authenticationBoundary:
    "public catalog fixture; private trading and demo authentication excluded",
  capabilities: [
    {
      capability: "MARKET_CATALOG",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["kalshi-catalog"],
      limitations: ["fixture-backed catalog slice"],
    },
    {
      capability: "ORDER_GATEWAY",
      implemented: false,
      qualification: [],
      evidenceRefs: ["https://demo-api.kalshi.co/trade-api/v2"],
      limitations: ["inert demo contract pending"],
    },
  ],
  liveExecutionEnabled: false,
};

export function normalizeKalshiCatalog(
  fixture: VerifiedRawFixture,
): readonly NormalizedCatalogListing[] {
  const response = ResponseSchema.parse(
    parseJsonWithNumberLexemes(new TextDecoder().decode(fixture.bytes)),
  );
  return response.markets.map((market) => ({
    venueId: kalshiManifest.venueId,
    venueEventId: market.event_ticker,
    venueInstrumentId: market.ticker,
    title: market.title,
    description:
      market.subtitle ??
      [market.yes_sub_title, market.no_sub_title]
        .filter((item) => item !== undefined)
        .join(" / "),
    status: market.status.toUpperCase(),
    mechanism: "CENTRALIZED_ORDER_BOOK",
    opensAt: market.open_time,
    closesAt: market.close_time,
    rulesText: [market.rules_primary, market.rules_secondary]
      .filter((item) => item !== "")
      .join("\n\n"),
    outcomes: [
      {
        venueOutcomeId: `${market.ticker}:YES`,
        label: "Yes",
        indicativePrice: parseFixed(market.yes_ask_dollars, 10_000n),
      },
      {
        venueOutcomeId: `${market.ticker}:NO`,
        label: "No",
        indicativePrice: parseFixed(market.no_ask_dollars, 10_000n),
      },
    ],
    collateralId: "USD",
    priceScale: 10_000n,
    quantityScale: 10_000n,
    ...(market.price_ranges[0] === undefined
      ? {}
      : {
          minPriceTick: parseFixed(market.price_ranges[0].step, 10_000n),
        }),
    sourceFixtureHash: fixture.rawHash,
    protocolIdentity: fixture.metadata.protocolVersion,
  }));
}
