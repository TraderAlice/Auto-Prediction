import { parseFixed } from "@pmh/domain";
import type { VerifiedRawFixture } from "@pmh/evidence";
import {
  createInertGatewayAcknowledgement,
  parseJsonWithNumberLexemes,
  type InertGatewayAcknowledgement,
  type NormalizedCatalogListing,
  type OrderGatewayPort,
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

const PositiveDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .refine((value) => /[1-9]/.test(value));

const ProbabilityPriceSchema = PositiveDecimalSchema.refine(
  (value) => value.startsWith("0.") || /^1(?:\.0+)?$/.test(value),
);

export const KalshiDemoOrderIntentSchema = z.object({
  ticker: z.string().min(1),
  clientOrderId: z.string().min(1).max(200),
  side: z.enum(["bid", "ask"]),
  count: PositiveDecimalSchema,
  price: ProbabilityPriceSchema,
  timeInForce: z.enum([
    "fill_or_kill",
    "good_till_canceled",
    "immediate_or_cancel",
  ]),
  selfTradePreventionType: z.enum(["taker_at_cross", "maker"]),
});

export type KalshiDemoOrderIntent = z.infer<
  typeof KalshiDemoOrderIntentSchema
>;

export const KALSHI_DEMO_BASE_URL =
  "https://external-api.demo.kalshi.co/trade-api/v2";

export function buildKalshiDemoOrderRequest(intent: KalshiDemoOrderIntent) {
  const parsed = KalshiDemoOrderIntentSchema.parse(intent);
  return Object.freeze({
    ticker: parsed.ticker,
    client_order_id: parsed.clientOrderId,
    side: parsed.side,
    count: parsed.count,
    price: parsed.price,
    time_in_force: parsed.timeInForce,
    self_trade_prevention_type: parsed.selfTradePreventionType,
    post_only: false,
    cancel_order_on_pause: true,
    reduce_only: false,
    subaccount: 0,
    exchange_index: 0,
  });
}

export class KalshiDemoInertOrderGateway
  implements
    OrderGatewayPort<KalshiDemoOrderIntent, InertGatewayAcknowledgement>
{
  public readonly liveExecutionEnabled = false;

  public async submit(
    intent: KalshiDemoOrderIntent,
  ): Promise<InertGatewayAcknowledgement> {
    const targetPath = "/portfolio/events/orders";
    return createInertGatewayAcknowledgement({
      venueId: "kalshi",
      targetEnvironment: "DEMO",
      targetBaseUrl: KALSHI_DEMO_BASE_URL,
      targetPath,
      targetMethod: "POST",
      operation: "SUBMIT",
      request: buildKalshiDemoOrderRequest(intent),
    });
  }

  public async cancel(
    orderIdentity: string,
  ): Promise<InertGatewayAcknowledgement> {
    const parsedIdentity = z.string().min(1).max(200).parse(orderIdentity);
    const targetPath = `/portfolio/events/orders/${encodeURIComponent(parsedIdentity)}`;
    return createInertGatewayAcknowledgement({
      venueId: "kalshi",
      targetEnvironment: "DEMO",
      targetBaseUrl: KALSHI_DEMO_BASE_URL,
      targetPath,
      targetMethod: "DELETE",
      operation: "CANCEL",
      request: { order_id: parsedIdentity },
    });
  }

  public async reconcile(
    orderIdentity: string,
  ): Promise<InertGatewayAcknowledgement> {
    const parsedIdentity = z.string().min(1).max(200).parse(orderIdentity);
    const targetPath = `/portfolio/orders/${encodeURIComponent(parsedIdentity)}`;
    return createInertGatewayAcknowledgement({
      venueId: "kalshi",
      targetEnvironment: "DEMO",
      targetBaseUrl: KALSHI_DEMO_BASE_URL,
      targetPath,
      targetMethod: "GET",
      operation: "RECONCILE",
      request: { order_id: parsedIdentity },
    });
  }
}

export const kalshiManifest: VenueManifest = {
  venueId: "kalshi",
  displayName: "Kalshi",
  adapterVersion: "0.0.0",
  protocolIdentity: "trade-api-v2:2026-07-31",
  officialSources: ["https://docs.kalshi.com/welcome"],
  mechanisms: ["centralized binary and multivariate event contracts"],
  precisionRules: ["fixed-point dollar fields are decimal strings"],
  authenticationBoundary:
    "public catalog fixture; demo order shape is inert with no transport, signing, credentials, or nonce generation",
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
      implemented: true,
      qualification: ["DISCOVER"],
      evidenceRefs: [
        "https://docs.kalshi.com/api-reference/orders/create-order-v2",
        "https://docs.kalshi.com/getting_started/api_environments",
      ],
      limitations: [
        "inert demo request-shape contract only",
        "all operations return REJECTED_INERT without network or credentials",
      ],
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
