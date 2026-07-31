import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildKalshiDemoOrderRequest,
  KALSHI_DEMO_BASE_URL,
  KalshiDemoInertOrderGateway,
  KalshiDemoOrderIntentSchema,
} from "../src/index.js";

const intent = {
  ticker: "HIGHNY-24JAN01-T60",
  clientOrderId: "8c35ecb3-328f-4f52-8c7c-0f4b9862f8d1",
  side: "bid",
  count: "10.00",
  price: "0.5600",
  timeInForce: "good_till_canceled",
  selfTradePreventionType: "taker_at_cross",
} as const;

describe("Kalshi demo inert order gateway", () => {
  it("records the official V2 request shape and rejects submission inertly", async () => {
    const acknowledgement = await new KalshiDemoInertOrderGateway().submit(
      intent,
    );
    const request = buildKalshiDemoOrderRequest(intent);

    expect(request).toMatchObject({
      ticker: intent.ticker,
      client_order_id: intent.clientOrderId,
      side: "bid",
      count: "10.00",
      price: "0.5600",
      cancel_order_on_pause: true,
    });
    expect(acknowledgement).toMatchObject({
      venueId: "kalshi",
      targetEnvironment: "DEMO",
      targetBaseUrl: KALSHI_DEMO_BASE_URL,
      targetPath: "/portfolio/events/orders",
      targetMethod: "POST",
      operation: "SUBMIT",
      status: "REJECTED_INERT",
      liveExecutionEnabled: false,
      networkAttempted: false,
      credentialsUsed: false,
      valueMovingOperation: false,
    });
    expect(acknowledgement.requestHash).toBe(
      hashCanonical({
        method: "POST",
        path: "/portfolio/events/orders",
        request,
      }),
    );
  });

  it("returns inert receipts for cancel and reconciliation", async () => {
    const gateway = new KalshiDemoInertOrderGateway();
    const cancel = await gateway.cancel("order-123");
    const reconcile = await gateway.reconcile("order-123");

    expect(cancel).toMatchObject({
      targetPath: "/portfolio/events/orders/order-123",
      targetMethod: "DELETE",
      operation: "CANCEL",
      status: "REJECTED_INERT",
    });
    expect(reconcile).toMatchObject({
      targetPath: "/portfolio/orders/order-123",
      targetMethod: "GET",
      operation: "RECONCILE",
      status: "REJECTED_INERT",
    });
  });

  it("fails closed for invalid quantity and price lexemes", () => {
    expect(() =>
      KalshiDemoOrderIntentSchema.parse({ ...intent, count: "0" }),
    ).toThrow();
    expect(() =>
      KalshiDemoOrderIntentSchema.parse({ ...intent, price: "1.01" }),
    ).toThrow();
    expect(() =>
      KalshiDemoOrderIntentSchema.parse({ ...intent, price: 0.56 }),
    ).toThrow();
  });
});
