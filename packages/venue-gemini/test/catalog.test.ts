import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashBytes } from "@pmh/domain";
import { loadRawFixture, verifyRawFixture } from "@pmh/evidence";
import { geminiEventTickerFromInstrumentSymbol, geminiManifest,
  normalizeGeminiCatalog, normalizeGeminiEventDetailQuote } from "../src/index.js";

const fixtureDirectory = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/gemini-predictions/2026-07-31",
);

describe("Gemini catalog fixtures", () => {
  it("binds a targeted event detail response to the exact instrument", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: "93889",
      ticker: "SEN26IA", title: "Iowa US Senate Winner", type: "categorical",
      status: "active", expiryDate: "2026-11-10T00:00:00.000Z", contracts: [{
        id: "93889-282131", label: "Josh Turek", ticker: "JOSHTUREK",
        instrumentSymbol: "GEMI-SEN26IA-JOSHTUREK", status: "active",
        marketState: "open", prices: { buy: { yes: "0.48", no: "0.56" } },
      }] }));
    expect(geminiEventTickerFromInstrumentSymbol("GEMI-SEN26IA-JOSHTUREK"))
      .toBe("SEN26IA");
    expect(normalizeGeminiEventDetailQuote(bytes,
      "GEMI-SEN26IA-JOSHTUREK")).toEqual({ eventTicker: "SEN26IA",
      instrumentSymbol: "GEMI-SEN26IA-JOSHTUREK", contractStatus: "active",
      marketState: "open", yesAsk: "0.48", noAsk: "0.56" });
    expect(() => normalizeGeminiEventDetailQuote(bytes,
      "GEMI-CTRLUSSEN-DEM")).toThrow(/ticker does not match/u);
  });
  it("normalizes a public binary contract", async () => {
    const fixture = await loadRawFixture(
      `${fixtureDirectory}/gemini-binary-catalog.json`,
      `${fixtureDirectory}/gemini-binary-catalog.meta.json`,
    );
    const listings = normalizeGeminiCatalog(fixture);
    expect(listings).toHaveLength(1);
    expect(typeof listings[0]?.outcomes[0]?.indicativePrice).toBe("bigint");
    expect(listings[0]?.rulesText).toContain("Outcome verified against");
    expect(listings[0]?.rulesUrl).toBe(
      "https://assets.gemini.com/predictions/terms_and_conditions/btc_227f8e79-2af6-40f9-9a0c-a8297696e7ab.pdf",
    );
    expect(geminiManifest.liveExecutionEnabled).toBe(false);
  });

  it("preserves all six contracts in a native temperature range event", async () => {
    const fixture = await loadRawFixture(
      `${fixtureDirectory}/gemini-range-catalog.json`,
      `${fixtureDirectory}/gemini-range-catalog.meta.json`,
    );
    const listings = normalizeGeminiCatalog(fixture);
    expect(listings).toHaveLength(6);
    expect(listings.map((listing) => listing.title)).toContain(
      "Highest temperature in Boston on July 31, 2026? — 78°F to 79°F",
    );
    expect(new Set(listings.map((listing) => listing.rulesUrl))).toEqual(new Set([
      "https://assets.gemini.com/predictions/terms_and_conditions/Weather_Terms_and_Conditions_67323dd4-5775-48d5-bea0-c33d672d1f74.pdf",
    ]));
    expect(listings.every((listing) =>
      listing.rulesText?.includes("Each temperature range listed for this event is mutually exclusive")
    )).toBe(true);
  });

  it("retains an active contract when Gemini omits its indicative prices", async () => {
    const original = await loadRawFixture(
      `${fixtureDirectory}/gemini-binary-catalog.json`,
      `${fixtureDirectory}/gemini-binary-catalog.meta.json`,
    );
    const payload = JSON.parse(new TextDecoder().decode(original.bytes)) as {
      data: { contracts: { prices?: unknown }[] }[];
    };
    delete payload.data[0]?.contracts[0]?.prices;
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const fixture = verifyRawFixture(bytes, {
      ...original.metadata,
      rawHash: hashBytes(bytes),
      byteLength: bytes.byteLength.toString(),
    });
    const listings = normalizeGeminiCatalog(fixture);
    expect(listings).toHaveLength(1);
    expect(listings[0]?.outcomes).toEqual([
      expect.not.objectContaining({ indicativePrice: expect.anything() }),
      expect.not.objectContaining({ indicativePrice: expect.anything() }),
    ]);
  });
});
