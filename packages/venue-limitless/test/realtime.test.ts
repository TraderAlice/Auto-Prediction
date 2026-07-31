import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadStreamFixture } from "@pmh/evidence";
import { DeterministicBook } from "@pmh/market-state";
import {
  decodeLimitlessBookStream,
  limitlessManifest,
} from "../src/index.js";

const fixtureDirectory = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/limitless/2026-07-31",
);

describe("Limitless public book stream", () => {
  it("normalizes a captured Socket.IO full-book update", async () => {
    const fixture = await loadStreamFixture(
      `${fixtureDirectory}/limitless-book.stream.json`,
      `${fixtureDirectory}/limitless-book.stream.meta.json`,
    );
    const update = decodeLimitlessBookStream(fixture)[0];
    expect(update?.event.kind).toBe("SNAPSHOT");
    expect(limitlessManifest.liveExecutionEnabled).toBe(false);
    if (update === undefined) throw new Error("missing book update");
    const projection = new DeterministicBook(update.instrumentId).apply(
      update.event,
    );
    expect(projection.lifecycle).toBe("SNAPSHOT_VALID");
  });
});
