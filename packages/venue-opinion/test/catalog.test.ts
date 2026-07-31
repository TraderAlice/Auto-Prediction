import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "@pmh/evidence";
import { normalizeOpinionCatalog, opinionManifest } from "../src/index.js";

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
});
