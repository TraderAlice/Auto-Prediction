import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildGeminiSandboxOrderRequest,
  GEMINI_SANDBOX_BASE_URL,
  GeminiSandboxInertOrderGateway,
  GeminiSandboxOrderIntentSchema,
} from "../src/index.js";

const intent = {
  clientOrderId: "pmh-shadow-470135",
  symbol: "BTCUSD",
  amount: "0.01",
  price: "3633.00",
  side: "buy",
  type: "exchange limit",
  option: "maker-or-cancel",
} as const;

describe("Gemini sandbox inert order gateway", () => {
  it("records the official request shape without auth material or nonce", async () => {
    const acknowledgement = await new GeminiSandboxInertOrderGateway().submit(
      intent,
    );
    const request = buildGeminiSandboxOrderRequest(intent);

    expect(request).toEqual({
      request: "/v1/order/new",
      client_order_id: "pmh-shadow-470135",
      symbol: "BTCUSD",
      amount: "0.01",
      price: "3633.00",
      side: "buy",
      type: "exchange limit",
      options: ["maker-or-cancel"],
    });
    expect(request).not.toHaveProperty("nonce");
    expect(acknowledgement).toMatchObject({
      venueId: "gemini-predictions",
      targetEnvironment: "SANDBOX",
      targetBaseUrl: GEMINI_SANDBOX_BASE_URL,
      targetPath: "/v1/order/new",
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
        path: "/v1/order/new",
        request,
      }),
    );
  });

  it("uses the documented cancel and status paths but never transports", async () => {
    const gateway = new GeminiSandboxInertOrderGateway();
    const cancel = await gateway.cancel("123456789012345");
    const reconcile = await gateway.reconcile("123456789012345");

    expect(cancel).toMatchObject({
      targetPath: "/v1/order/cancel",
      operation: "CANCEL",
      networkAttempted: false,
    });
    expect(reconcile).toMatchObject({
      targetPath: "/v1/order/status",
      operation: "RECONCILE",
      networkAttempted: false,
    });
    expect(cancel.requestHash).not.toBe(reconcile.requestHash);
  });

  it("fails closed for unsafe identities and non-string decimals", async () => {
    const gateway = new GeminiSandboxInertOrderGateway();
    await expect(gateway.cancel("9007199254740992")).rejects.toThrow();
    expect(() =>
      GeminiSandboxOrderIntentSchema.parse({ ...intent, amount: 0.01 }),
    ).toThrow();
    expect(() =>
      GeminiSandboxOrderIntentSchema.parse({ ...intent, amount: "0" }),
    ).toThrow();
  });
});
