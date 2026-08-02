import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "@pmh/evidence";
import { myriadManifest, normalizeMyriadCatalog } from "../src/index.js";

const fixtureBase = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/myriad/2026-07-31/myriad-amm-catalog",
);

describe("Myriad AMM fixture", () => {
  it("normalizes source-number prices without binary floating point", async () => {
    const fixture = await loadRawFixture(
      `${fixtureBase}.json`,
      `${fixtureBase}.meta.json`,
    );
    const [listing] = normalizeMyriadCatalog(fixture);
    expect(listing?.mechanism).toBe("AMM");
    expect(typeof listing?.outcomes[0]?.indicativePrice).toBe("bigint");
    expect(listing?.outcomes[0]?.indicativePrice).toBe(69_936_850n);
    expect(listing?.rulesText).toBe(listing?.description);
    expect(listing?.rulesText).toContain("Resolution Criteria");
    expect(listing?.rulesUrl).toBeUndefined();
    expect(listing?.resolutionSourceUrl).toBe("https://x.com/myriadmarkets");
    expect(myriadManifest.liveExecutionEnabled).toBe(false);
  });
});
