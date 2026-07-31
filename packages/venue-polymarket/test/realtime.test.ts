import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadStreamFixture } from "@pmh/evidence";
import { DeterministicBook } from "@pmh/market-state";
import { decodePolymarketBookStream } from "../src/index.js";

const fixtureDirectory = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/polymarket-global/2026-07-31",
);

describe("Polymarket public book stream", () => {
  it("normalizes only full book messages from the captured stream", async () => {
    const fixture = await loadStreamFixture(
      `${fixtureDirectory}/polymarket-book.stream.json`,
      `${fixtureDirectory}/polymarket-book.stream.meta.json`,
    );
    const update = decodePolymarketBookStream(fixture)[0];
    expect(update?.event.kind).toBe("SNAPSHOT");
    if (update === undefined) throw new Error("missing book update");
    const projection = new DeterministicBook(update.instrumentId).apply(
      update.event,
    );
    expect(projection.lifecycle).toBe("SNAPSHOT_VALID");
  });
});
