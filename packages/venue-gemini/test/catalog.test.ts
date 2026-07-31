import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "@pmh/evidence";
import { geminiManifest, normalizeGeminiCatalog } from "../src/index.js";

const fixtureDirectory = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/gemini-predictions/2026-07-31",
);

describe("Gemini catalog fixtures", () => {
  it("normalizes a public binary contract", async () => {
    const fixture = await loadRawFixture(
      `${fixtureDirectory}/gemini-binary-catalog.json`,
      `${fixtureDirectory}/gemini-binary-catalog.meta.json`,
    );
    const listings = normalizeGeminiCatalog(fixture);
    expect(listings).toHaveLength(1);
    expect(typeof listings[0]?.outcomes[0]?.indicativePrice).toBe("bigint");
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
  });
});
