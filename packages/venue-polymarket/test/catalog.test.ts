import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashBytes } from "@pmh/domain";
import { loadRawFixture, verifyRawFixture } from "@pmh/evidence";
import {
  decodePolymarketBinaryResolution,
  normalizePolymarketCatalog,
  polymarketManifest,
} from "../src/index.js";

const fixtureBase = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/polymarket-global/2026-07-31/polymarket-catalog",
);

function resolutionFixture(value: Readonly<Record<string, unknown>>) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return verifyRawFixture(bytes, {
    schemaVersion: "pmh.raw-fixture.v1",
    name: "polymarket-resolution",
    venue: polymarketManifest.venueId,
    protocolVersion: polymarketManifest.protocolIdentity,
    sourceUrl: "https://gamma-api.polymarket.com/markets/42",
    fetchedAt: "2026-08-09T09:00:00.000Z",
    httpStatus: 200,
    contentType: "application/json",
    etag: null,
    lastModified: null,
    rawHash: hashBytes(bytes),
    byteLength: String(bytes.byteLength),
    acquisition: { method: "GET", credentialsUsed: false, valueMovingOperation: false },
  });
}

function resolvedMarket(overrides: Readonly<Record<string, unknown>> = {}) {
  return resolutionFixture({
    id: "42",
    closed: true,
    closedTime: "2026-08-09 08:49:42+00",
    umaResolutionStatus: "resolved",
    outcomes: "[\"Yes\",\"No\"]",
    outcomePrices: "[\"1\",\"0\"]",
    clobTokenIds: "[\"yes-token\",\"no-token\"]",
    ...overrides,
  });
}

describe("Polymarket catalog fixture", () => {
  it("normalizes outcome tokens without floating-point values", async () => {
    const fixture = await loadRawFixture(
      `${fixtureBase}.json`,
      `${fixtureBase}.meta.json`,
    );
    const [listing] = normalizePolymarketCatalog(fixture);
    expect(listing?.mechanism).toBe("ONCHAIN_CLOB");
    expect(listing?.outcomes).toHaveLength(2);
    expect(typeof listing?.outcomes[0]?.indicativePrice).toBe("bigint");
    expect(typeof listing?.minPriceTick).toBe("bigint");
    expect(listing?.rulesText).toBe(listing?.description);
    expect(listing?.rulesText).toContain("resolve");
    expect(polymarketManifest.liveExecutionEnabled).toBe(false);

    const response = JSON.parse(new TextDecoder().decode(fixture.bytes)) as
      Record<string, unknown>[];
    if (response[0] === undefined) throw new Error("fixture is empty");
    response[0].resolutionSource = "https://official.example/resolution";
    const [withResolutionSource] = normalizePolymarketCatalog({
      ...fixture,
      bytes: new TextEncoder().encode(JSON.stringify(response)),
    });
    expect(withResolutionSource?.rulesUrl).toBeUndefined();
    expect(withResolutionSource?.resolutionSourceUrl).toBe(
      "https://official.example/resolution",
    );
  });

  it("decodes a venue-resolved exact binary payout with its venue close time", () => {
    expect(decodePolymarketBinaryResolution(resolvedMarket(), "42")).toMatchObject({
      venueInstrumentId: "42",
      truthValue: true,
      winningOutcome: "Yes",
      winningOutcomeId: "yes-token",
      resolvedAt: "2026-08-09T08:49:42.000Z",
      protocolIdentity: polymarketManifest.protocolIdentity,
    });
    expect(
      decodePolymarketBinaryResolution(resolvedMarket({ outcomePrices: "[\"0\",\"1\"]" })),
    ).toMatchObject({ truthValue: false, winningOutcome: "No", winningOutcomeId: "no-token" });
  });

  it("does not treat a closed or unresolved Global market as settlement evidence", () => {
    expect(decodePolymarketBinaryResolution(resolvedMarket({ closed: false }))).toBeNull();
    expect(
      decodePolymarketBinaryResolution(resolvedMarket({ umaResolutionStatus: "proposed" })),
    ).toBeNull();
    expect(
      decodePolymarketBinaryResolution(resolvedMarket({ umaResolutionStatus: null })),
    ).toBeNull();
  });

  it("rejects mismatched, untimed, or non-exact Global settlement payloads", () => {
    expect(() => decodePolymarketBinaryResolution(resolvedMarket(), "elsewhere")).toThrow(
      /requested instrument/u,
    );
    expect(() => decodePolymarketBinaryResolution(resolvedMarket({ closedTime: null }))).toThrow(
      /no venue-reported close time/u,
    );
    expect(() => decodePolymarketBinaryResolution(
      resolvedMarket({ outcomePrices: "[\"0.5\",\"0.5\"]" }),
    )).toThrow(/exact Yes\/No/u);
    expect(() => decodePolymarketBinaryResolution(
      resolvedMarket({ outcomes: "[\"No\",\"Yes\"]" }),
    )).toThrow(/exact Yes\/No/u);
  });
});
