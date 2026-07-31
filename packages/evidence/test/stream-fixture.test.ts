import { describe, expect, it } from "vitest";
import { hashBytes, hashCanonical } from "@pmh/domain";
import { verifyStreamFixture } from "../src/index.js";

const rawText = '{"e":"depthUpdate"}';
const acquisition = {
  schemaVersion: "pmh.stream-acquisition.v1",
  frames: [
    {
      ordinal: "0",
      receivedAt: "2026-07-31T00:00:00.000Z",
      eventName: null,
      rawText,
      frameHash: hashBytes(new TextEncoder().encode(rawText)),
    },
  ],
} as const;
const bytes = new TextEncoder().encode(JSON.stringify(acquisition));
const subscription = {
  id: "1",
  method: "SUBSCRIBE",
  params: ["EXAMPLE@depth"],
};
const metadata = {
  schemaVersion: "pmh.stream-fixture.v1",
  name: "test-stream",
  venue: "test",
  protocolVersion: "test-v1",
  sourceUrl: "wss://example.com/ws",
  connectedAt: "2026-07-31T00:00:00.000Z",
  closedAt: "2026-07-31T00:00:01.000Z",
  transport: "WEBSOCKET",
  subscription,
  subscriptionHash: hashCanonical(subscription),
  instrumentIds: ["EXAMPLE"],
  frameCount: "1",
  rawHash: hashBytes(bytes),
  byteLength: bytes.byteLength.toString(),
  acquisition: {
    credentialsUsed: false,
    valueMovingOperation: false,
  },
} as const;

describe("stream fixture evidence", () => {
  it("binds frame boundaries, subscription, and anonymous acquisition metadata", () => {
    expect(verifyStreamFixture(bytes, metadata).frames[0]?.rawText).toBe(rawText);
  });

  it("rejects a tampered frame even when the outer hash is recomputed", () => {
    const tampered = new TextEncoder().encode(
      JSON.stringify({
        ...acquisition,
        frames: [{ ...acquisition.frames[0], rawText: '{"evil":true}' }],
      }),
    );
    expect(() =>
      verifyStreamFixture(tampered, {
        ...metadata,
        rawHash: hashBytes(tampered),
        byteLength: tampered.byteLength.toString(),
      }),
    ).toThrow(/frame 0 hash mismatch/);
  });
});
