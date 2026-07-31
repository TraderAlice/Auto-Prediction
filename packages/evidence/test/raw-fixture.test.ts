import { describe, expect, it } from "vitest";
import { hashBytes } from "@pmh/domain";
import { verifyRawFixture } from "../src/index.js";

const bytes = new TextEncoder().encode('{"venue":"test"}');

const metadata = {
  schemaVersion: "pmh.raw-fixture.v1",
  name: "test",
  venue: "test",
  protocolVersion: "test-v1",
  sourceUrl: "https://example.com/markets",
  fetchedAt: "2026-07-31T00:00:00.000Z",
  httpStatus: 200,
  contentType: "application/json",
  etag: null,
  lastModified: null,
  rawHash: hashBytes(bytes),
  byteLength: bytes.byteLength.toString(),
  acquisition: {
    method: "GET",
    credentialsUsed: false,
    valueMovingOperation: false,
  },
} as const;

describe("raw fixture evidence", () => {
  it("accepts bytes bound to acquisition metadata", () => {
    expect(verifyRawFixture(bytes, metadata).rawHash).toBe(metadata.rawHash);
  });

  it("rejects tampered bytes", () => {
    expect(() =>
      verifyRawFixture(new TextEncoder().encode('{"venue":"evil"}'), metadata),
    ).toThrow(/hash mismatch/);
  });

  it("proves fixture acquisition is anonymous and read-only", () => {
    const unsafe = {
      ...metadata,
      acquisition: { ...metadata.acquisition, credentialsUsed: true },
    };
    expect(() => verifyRawFixture(bytes, unsafe)).toThrow();
  });
});
