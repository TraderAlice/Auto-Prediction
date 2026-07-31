import { parseFixed, type Hash } from "@pmh/domain";
import type {
  VerifiedRawFixture,
  VerifiedStreamFixture,
} from "@pmh/evidence";
import type { NormalizedBookUpdate } from "@pmh/market-state";
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

const DepthUpdateSchema = z.object({
  e: z.literal("depthUpdate"),
  s: z.string(),
  U: z.string().regex(/^\d+$/),
  u: z.string().regex(/^\d+$/),
  b: z.array(z.tuple([z.string(), z.string()])),
  a: z.array(z.tuple([z.string(), z.string()])),
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
      capability: "REALTIME_BOOK",
      implemented: true,
      qualification: ["DISCOVER", "OBSERVE"],
      evidenceRefs: ["gemini-book"],
      limitations: [
        "public market-data stream only",
        "decoder fails closed when update ranges skip the last applied sequence",
      ],
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

export class GeminiRealtimeBookDecoder {
  readonly #sequences = new Map<string, bigint>();

  public decode(
    rawText: string,
    sourceHash: Hash,
  ): NormalizedBookUpdate | undefined {
    const candidate = DepthUpdateSchema.safeParse(
      parseJsonWithNumberLexemes(rawText),
    );
    if (!candidate.success) return undefined;

    const message = candidate.data;
    const first = BigInt(message.U);
    const last = BigInt(message.u);
    const previous = this.#sequences.get(message.s);
    if (previous === undefined) {
      if (first !== last) {
        return {
          instrumentId: message.s,
          requiresRebuild: false,
          event: {
            kind: "MARK_STALE",
            reason:
              `Gemini stream began with range ${first}-${last}; ` +
              "a snapshot where U equals u is required",
          },
        };
      }
      this.#sequences.set(message.s, last);
      return {
        instrumentId: message.s,
        requiresRebuild: false,
        event: {
          kind: "SNAPSHOT",
          sequence: last,
          tickSize: 10_000n,
          bids: message.b.map(([price, size]) => ({
            price: parseFixed(price, 100_000_000n),
            size: parseFixed(size, 100_000_000n),
          })),
          asks: message.a.map(([price, size]) => ({
            price: parseFixed(price, 100_000_000n),
            size: parseFixed(size, 100_000_000n),
          })),
          sourceHash,
        },
      };
    }
    if (last <= previous) return undefined;
    if (first > previous + 1n) {
      this.#sequences.delete(message.s);
      return {
        instrumentId: message.s,
        requiresRebuild: false,
        event: {
          kind: "MARK_STALE",
          reason:
            `Gemini sequence gap after ${previous}; ` +
            `received range ${first}-${last}`,
        },
      };
    }

    this.#sequences.set(message.s, last);
    return {
      instrumentId: message.s,
      requiresRebuild: false,
      event: {
        kind: "DELTA",
        previousSequence: previous,
        sequence: last,
        changes: [
          ...message.b.map(([price, size]) => ({
            side: "BID" as const,
            price: parseFixed(price, 100_000_000n),
            size: parseFixed(size, 100_000_000n),
          })),
          ...message.a.map(([price, size]) => ({
            side: "ASK" as const,
            price: parseFixed(price, 100_000_000n),
            size: parseFixed(size, 100_000_000n),
          })),
        ],
        sourceHash,
      },
    };
  }
}

export function decodeGeminiBookStream(
  fixture: VerifiedStreamFixture,
): readonly NormalizedBookUpdate[] {
  if (fixture.metadata.venue !== geminiManifest.venueId) {
    throw new Error("stream fixture venue does not match Gemini adapter");
  }
  const decoder = new GeminiRealtimeBookDecoder();
  return fixture.frames.flatMap((frame) => {
    const update = decoder.decode(frame.rawText, frame.frameHash);
    return update === undefined ? [] : [update];
  });
}
