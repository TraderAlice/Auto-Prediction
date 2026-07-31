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
      ticker: z.string(),
      title: z.string(),
      type: z.string(),
      status: z.string(),
      description: z.string().optional(),
      expiryDate: z.string(),
      termsLink: z.string().optional(),
      contracts: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          ticker: z.string(),
          instrumentSymbol: z.string(),
          status: z.string(),
          termsAndConditionsUrl: z.string().optional(),
          prices: z.object({
            buy: z.object({ yes: z.string(), no: z.string() }),
          }),
        }),
      ),
    }),
  ),
});

export const geminiManifest: VenueManifest = {
  venueId: "gemini-predictions",
  displayName: "Gemini Prediction Markets",
  adapterVersion: "0.0.0",
  protocolIdentity: "prediction-markets-v1:2026-07-30",
  officialSources: [
    "https://developer.gemini.com/prediction-markets/prediction-markets",
  ],
  mechanisms: [
    "centralized binary event contracts",
    "categorical/range event groups",
    "Combo/RFQ",
  ],
  precisionRules: ["prices and quantities are decimal strings"],
  authenticationBoundary:
    "public REST catalog; authenticated WebSocket trading excluded",
  capabilities: [
    {
      capability: "MARKET_CATALOG",
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: ["gemini-binary-catalog", "gemini-range-catalog"],
      limitations: ["fixture-backed catalog slice"],
    },
    {
      capability: "COMBO_RFQ",
      implemented: false,
      qualification: [],
      evidenceRefs: [
        "https://developer.gemini.com/prediction-markets/prediction-markets",
      ],
      limitations: ["official surface verified; codec pending"],
    },
    {
      capability: "ORDER_GATEWAY",
      implemented: false,
      qualification: [],
      evidenceRefs: ["https://api.sandbox.gemini.com"],
      limitations: ["inert sandbox contract pending"],
    },
  ],
  liveExecutionEnabled: false,
};

export function normalizeGeminiCatalog(
  fixture: VerifiedRawFixture,
): readonly NormalizedCatalogListing[] {
  const response = ResponseSchema.parse(
    parseJsonWithNumberLexemes(new TextDecoder().decode(fixture.bytes)),
  );
  return response.data.flatMap((event) =>
    event.contracts.map((contract) => ({
      venueId: geminiManifest.venueId,
      venueEventId: event.id,
      venueInstrumentId: contract.instrumentSymbol,
      title: `${event.title} — ${contract.label}`,
      description: event.description ?? "",
      status: contract.status.toUpperCase(),
      mechanism: "CENTRALIZED_ORDER_BOOK" as const,
      closesAt: event.expiryDate,
      ...((contract.termsAndConditionsUrl ?? event.termsLink) === undefined
        ? {}
        : {
            rulesUrl: contract.termsAndConditionsUrl ?? event.termsLink ?? "",
          }),
      outcomes: [
        {
          venueOutcomeId: `${contract.id}:YES`,
          label: "Yes",
          indicativePrice: parseFixed(contract.prices.buy.yes, 100_000_000n),
        },
        {
          venueOutcomeId: `${contract.id}:NO`,
          label: "No",
          indicativePrice: parseFixed(contract.prices.buy.no, 100_000_000n),
        },
      ],
      collateralId: "USD",
      priceScale: 100_000_000n,
      quantityScale: 100_000_000n,
      minPriceTick: 1_000_000n,
      sourceFixtureHash: fixture.rawHash,
      protocolIdentity: fixture.metadata.protocolVersion,
    })),
  );
}
