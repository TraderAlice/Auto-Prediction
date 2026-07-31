import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "@pmh/evidence";
import {
  normalizePolymarketCatalog,
  polymarketManifest,
} from "../src/index.js";

const fixtureBase = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/polymarket-global/2026-07-31/polymarket-catalog",
);

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
    expect(polymarketManifest.liveExecutionEnabled).toBe(false);
  });
});
