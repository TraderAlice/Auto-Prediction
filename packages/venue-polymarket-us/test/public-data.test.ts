import { resolve } from "node:path";
import { hashBytes } from "@pmh/domain";
import { loadRawFixture } from "@pmh/evidence";
import { verifyRawFixture } from "@pmh/evidence";
import { describe, expect, it } from "vitest";
import {
  POLYMARKET_US_RULEBOOK_URL,
  decodePolymarketUsBinarySettlement,
  decodePolymarketUsBookSnapshot,
  normalizePolymarketUsBbo,
  normalizePolymarketUsCatalog,
  polymarketUsManifest,
} from "../src/index.js";

const fixtureRoot = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/polymarket-us/2026-08-01",
);

async function fixture(name: string) {
  return loadRawFixture(
    resolve(fixtureRoot, `${name}.json`),
    resolve(fixtureRoot, `${name}.meta.json`),
  );
}

function settlementFixture(settlement: number, slug = "resolved-market") {
  const bytes = new TextEncoder().encode(JSON.stringify({ slug, settlement }));
  return verifyRawFixture(bytes, {
    schemaVersion: "pmh.raw-fixture.v1",
    name: "polymarket-us-settlement",
    venue: polymarketUsManifest.venueId,
    protocolVersion: polymarketUsManifest.protocolIdentity,
    sourceUrl: `https://gateway.polymarket.us/v1/markets/${slug}/settlement`,
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

describe("Polymarket US anonymous public data", () => {
  it("normalizes a distinct centralized binary catalog without floating point", async () => {
    const catalog = await fixture("polymarket-us-catalog");
    const listings = normalizePolymarketUsCatalog(catalog);

    expect(listings).toHaveLength(20);
    expect(listings[0]).toMatchObject({
      venueId: "polymarket-us",
      venueInstrumentId: "tec-mlb-nlchamp-2026-09-27-nym",
      title: "National League Champion — New York Mets",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      collateralId: "USD",
      minPriceTick: 100_000n,
      rulesUrl: POLYMARKET_US_RULEBOOK_URL,
    });
    expect(listings[0]?.outcomes.map((outcome) => [outcome.label, outcome.indicativePrice])).toEqual([
      ["Yes", 300_000n],
      ["No", 99_800_000n],
    ]);
    expect(typeof listings[0]?.priceScale).toBe("bigint");
    expect(listings[1]?.outcomes[1]).toEqual({
      venueOutcomeId: "15798",
      label: "No",
    });
    expect(polymarketUsManifest.venueId).not.toBe("polymarket-global");
    expect(polymarketUsManifest.liveExecutionEnabled).toBe(false);
    expect(polymarketUsManifest.officialSources).toContain(
      POLYMARKET_US_RULEBOOK_URL,
    );
  });

  it("binds a REST long-contract book to catalog tick evidence", async () => {
    const catalog = await fixture("polymarket-us-catalog");
    const book = await fixture("polymarket-us-market-book");
    const update = decodePolymarketUsBookSnapshot(book, catalog);

    expect(update).toMatchObject({
      instrumentId: "tec-mlb-nlchamp-2026-09-27-nym",
      requiresRebuild: false,
      event: {
        kind: "SNAPSHOT",
        tickSize: 100_000n,
      },
    });
    if (update.event.kind !== "SNAPSHOT") throw new Error("expected snapshot");
    expect(update.event.bids[0]).toEqual({ price: 200_000n, size: 352_710_000n });
    expect(update.event.asks[0]).toEqual({ price: 300_000n, size: 5_740_000n });
    expect(update.event.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("normalizes BBO as observation-only evidence without inventing depth", async () => {
    const catalog = await fixture("polymarket-us-catalog");
    const bbo = await fixture("polymarket-us-market-bbo");
    const observation = normalizePolymarketUsBbo(bbo, catalog);

    expect(observation).toMatchObject({
      bestBid: 200_000n,
      bestAsk: 300_000n,
      longQuote: 300_000n,
      shortQuote: 99_800_000n,
      bidDepth: 2,
      askDepth: 20,
      authority: "PUBLIC_MARKET_OBSERVATION_ONLY",
      executableDepth: false,
    });
    expect(observation.artifactHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("decodes an exact US settlement without inventing a resolution time", () => {
    expect(decodePolymarketUsBinarySettlement(settlementFixture(1), "resolved-market"))
      .toMatchObject({
        venueInstrumentId: "resolved-market",
        truthValue: true,
        settlementPrice: "1",
        resolvedAt: null,
        resolutionTimeBasis: "UNAVAILABLE_FROM_ANONYMOUS_SETTLEMENT_ENDPOINT",
        protocolIdentity: polymarketUsManifest.protocolIdentity,
      });
    expect(decodePolymarketUsBinarySettlement(settlementFixture(0))).toMatchObject({
      truthValue: false,
      settlementPrice: "0",
      resolvedAt: null,
    });
  });

  it("rejects a mismatched or fractional US settlement", () => {
    expect(() => decodePolymarketUsBinarySettlement(
      settlementFixture(1),
      "elsewhere",
    )).toThrow(/requested instrument/u);
    expect(() => decodePolymarketUsBinarySettlement(settlementFixture(0.5))).toThrow(
      /exact binary payout/u,
    );
  });
});
