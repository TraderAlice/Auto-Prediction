import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "@pmh/evidence";
import {
  normalizeOpinionCatalog,
  normalizeOpinionOrderbookBestAsk,
  opinionManifest,
} from "../src/index.js";

const fixtureBase = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/opinion/2026-07-31/opinion-catalog",
);

describe("Opinion catalog fixture", () => {
  it("keeps on-chain token identities as strings", async () => {
    const fixture = await loadRawFixture(
      `${fixtureBase}.json`,
      `${fixtureBase}.meta.json`,
    );
    const [listing] = normalizeOpinionCatalog(fixture);
    expect(listing?.outcomes[0]?.venueOutcomeId).toMatch(/^\d+$/);
    expect(listing?.mechanism).toBe("ONCHAIN_CLOB");
    expect(opinionManifest.liveExecutionEnabled).toBe(false);
  });

  it("normalizes the best valid ask with fixed-point bigint precision", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      errno: "0",
      result: {
        tokenId: "123",
        timestamp: "1785623000000",
        asks: [
          { price: "0.51000000", size: "2.5" },
          { price: "0.49999999", size: "3" },
          { price: "1.1", size: "5" },
          { price: "0.4", size: "0" },
          { price: "bad", size: "8" },
        ],
      },
    }));

    expect(normalizeOpinionOrderbookBestAsk(
      bytes,
      "123",
      100_000_000n,
      1_000_000_000_000_000_000n,
    )).toEqual({
      bestAsk: 49_999_999n,
      nativeTimestamp: "1785623000000",
    });
  });

  it("rejects an orderbook bound to another outcome token", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      errno: "0",
      result: {
        tokenId: "wrong",
        timestamp: "1785623000000",
        asks: [{ price: "0.5", size: "1" }],
      },
    }));

    expect(() => normalizeOpinionOrderbookBestAsk(
      bytes,
      "expected",
      100_000_000n,
      1_000_000_000_000_000_000n,
    )).toThrow("token id does not match");
  });
});
