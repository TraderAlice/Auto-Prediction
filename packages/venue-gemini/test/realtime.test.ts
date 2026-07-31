import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import { loadStreamFixture } from "@pmh/evidence";
import { DeterministicBook } from "@pmh/market-state";
import {
  decodeGeminiBookStream,
  GeminiRealtimeBookDecoder,
} from "../src/index.js";

const fixtureDirectory = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/gemini-predictions/2026-07-31",
);

describe("Gemini public depth stream", () => {
  it("normalizes the initial U-equals-u depth image as a snapshot", async () => {
    const fixture = await loadStreamFixture(
      `${fixtureDirectory}/gemini-book.stream.json`,
      `${fixtureDirectory}/gemini-book.stream.meta.json`,
    );
    const update = decodeGeminiBookStream(fixture)[0];
    expect(update?.event.kind).toBe("SNAPSHOT");
    if (update === undefined) throw new Error("missing book update");
    const projection = new DeterministicBook(update.instrumentId).apply(
      update.event,
    );
    expect(projection.lifecycle).toBe("SNAPSHOT_VALID");
  });

  it("accepts overlapping ranges and fails closed on a sequence gap", () => {
    const decoder = new GeminiRealtimeBookDecoder();
    const sourceHash = hashCanonical("test");
    const initial = decoder.decode(
      '{"e":"depthUpdate","s":"example","U":10,"u":10,"b":[],"a":[]}',
      sourceHash,
    );
    const delta = decoder.decode(
      '{"e":"depthUpdate","s":"example","U":10,"u":12,"b":[["0.1","1"]],"a":[]}',
      sourceHash,
    );
    const gap = decoder.decode(
      '{"e":"depthUpdate","s":"example","U":14,"u":14,"b":[],"a":[]}',
      sourceHash,
    );
    expect(initial?.event.kind).toBe("SNAPSHOT");
    expect(delta?.event.kind).toBe("DELTA");
    expect(gap?.event.kind).toBe("MARK_STALE");
  });
});
