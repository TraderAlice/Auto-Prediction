import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "@pmh/evidence";
import { kalshiManifest, normalizeKalshiCatalog } from "../src/index.js";

const fixtureBase = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/kalshi/2026-07-31/kalshi-catalog",
);

describe("Kalshi catalog fixture", () => {
  it("normalizes fixed-point prices and tick structure", async () => {
    const fixture = await loadRawFixture(
      `${fixtureBase}.json`,
      `${fixtureBase}.meta.json`,
    );
    const [listing] = normalizeKalshiCatalog(fixture);
    expect(listing?.mechanism).toBe("CENTRALIZED_ORDER_BOOK");
    expect(typeof listing?.outcomes[0]?.indicativePrice).toBe("bigint");
    expect(typeof listing?.minPriceTick).toBe("bigint");
    expect(kalshiManifest.liveExecutionEnabled).toBe(false);
  });
});
