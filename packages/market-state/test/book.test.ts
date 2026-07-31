import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import { DeterministicBook, type BookEvent } from "../src/index.js";

const snapshot: BookEvent = {
  kind: "SNAPSHOT",
  sequence: 10n,
  tickSize: 1_000_000n,
  bids: [{ price: 45_000_000n, size: 200_000_000n }],
  asks: [{ price: 47_000_000n, size: 100_000_000n }],
  sourceHash: hashCanonical({ fixture: "snapshot" }),
};

const delta: BookEvent = {
  kind: "DELTA",
  previousSequence: 10n,
  sequence: 11n,
  changes: [
    { side: "BID", price: 46_000_000n, size: 50_000_000n },
    { side: "ASK", price: 47_000_000n, size: 0n },
  ],
  sourceHash: hashCanonical({ fixture: "delta" }),
};

describe("deterministic book replay", () => {
  it("replays the same fixture stream to the same state hash", () => {
    const replay = (): string | undefined => {
      const book = new DeterministicBook("instrument:test");
      book.apply(snapshot);
      return book.apply(delta).stateHash;
    };
    expect(replay()).toBe(replay());
  });

  it("detects gaps and requires rebuild before a replacement snapshot", () => {
    const book = new DeterministicBook("instrument:test");
    const initial = book.apply(snapshot);
    const gap = book.apply({
      ...delta,
      previousSequence: 12n,
      sequence: 13n,
    });
    expect(gap.lifecycle).toBe("GAP_DETECTED");

    book.apply({ kind: "BEGIN_REBUILD", reason: "sequence gap" });
    const rebuilt = book.apply({ ...snapshot, sequence: 20n });
    expect(rebuilt.lifecycle).toBe("SNAPSHOT_VALID");
    expect(rebuilt.generation).toBe(2n);
    expect(rebuilt.generationHash).not.toBe(initial.generationHash);
  });

  it("ignores exact duplicate sequence but fails closed out of order", () => {
    const book = new DeterministicBook("instrument:test");
    book.apply(snapshot);
    const afterDelta = book.apply(delta);
    expect(book.apply(delta).stateHash).toBe(afterDelta.stateHash);

    const outOfOrder = book.apply({
      ...delta,
      sequence: 9n,
      previousSequence: 8n,
    });
    expect(outOfOrder.lifecycle).toBe("GAP_DETECTED");
  });

  it("rejects off-tick levels", () => {
    const book = new DeterministicBook("instrument:test");
    expect(() =>
      book.apply({
        ...snapshot,
        bids: [{ price: 45_000_001n, size: 1n }],
      }),
    ).toThrow(/not aligned/);
  });
});
