import { describe, expect, it } from "vitest";
import { ReplayBookDesk } from "../src/index.js";

describe("replay book desk", () => {
  it("projects three verified venue books without execution authority", async () => {
    const desk = new ReplayBookDesk();
    const projection = await desk.replay();
    expect(projection.mode).toBe("FIXTURE_REPLAY");
    expect(projection.replayCount).toBe(1);
    expect(projection.books).toHaveLength(3);
    expect(
      projection.books.map((book) => [book.venueId, book.lifecycle]),
    ).toEqual([
      ["gemini-predictions", "SNAPSHOT_VALID"],
      ["limitless", "SNAPSHOT_VALID"],
      ["polymarket-global", "SNAPSHOT_VALID"],
    ]);
    expect(
      projection.books.every(
        (book) =>
          book.stateHash?.startsWith("sha256:") === true &&
          book.evidenceHash.startsWith("sha256:"),
      ),
    ).toBe(true);
  });

  it("replays deterministically while advancing only the operational count", async () => {
    const desk = new ReplayBookDesk();
    const first = await desk.replay();
    const second = await desk.replay();
    expect(second.replayCount).toBe(2);
    expect(second.books.map((book) => book.stateHash)).toEqual(
      first.books.map((book) => book.stateHash),
    );
    expect(second.books.map((book) => book.evidenceHash)).toEqual(
      first.books.map((book) => book.evidenceHash),
    );
  });
});
