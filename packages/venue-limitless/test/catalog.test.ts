import { resolve } from "node:path";
import { loadRawFixture } from "@pmh/evidence";
import { describe, expect, it } from "vitest";
import { normalizeLimitlessCatalog } from "../src/index.js";

describe("Limitless catalog normalization", () => {
  it("preserves lexical prices and token identities", async () => {
    const base = resolve(
      import.meta.dirname,
      "../../../projects/fixtures/limitless/2026-07-31/limitless-catalog",
    );
    const fixture = await loadRawFixture(`${base}.json`, `${base}.meta.json`);
    const listings = normalizeLimitlessCatalog(fixture);
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      venueId: "limitless",
      venueInstrumentId: "341897",
      title: "BTC Up or Down - 5 Min",
      mechanism: "ONCHAIN_CLOB",
      closesAt: "2026-07-31T08:55:00.000Z",
      priceScale: 100_000_000n,
      quantityScale: 1_000_000n,
      sourceFixtureHash: fixture.rawHash,
    });
    expect(listings[0]?.outcomes).toEqual([
      expect.objectContaining({ label: "Yes", indicativePrice: 950_000n }),
      expect.objectContaining({ label: "No", indicativePrice: 99_050_000n }),
    ]);
  });
});
