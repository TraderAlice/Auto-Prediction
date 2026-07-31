import { describe, expect, it } from "vitest";
import {
  buildStudioProjection,
  HeuristicDiscoveryWorker,
  ReplayBookDesk,
} from "@pmh/control-plane";

describe("Studio projection safety", () => {
  const studioProjection = buildStudioProjection({
    workers: [new HeuristicDiscoveryWorker()],
    activeRuns: 0,
  });

  it("keeps live execution disabled", () => {
    expect(studioProjection.system.liveExecutionEnabled).toBe(false);
    expect(studioProjection.identity.mode).toBe("CONTROL_PLANE");
  });

  it("labels every displayed opportunity as exact fixture evidence", () => {
    expect(
      studioProjection.opportunities.every(
        (opportunity) => opportunity.confidence === "EXACT",
      ),
    ).toBe(true);
  });

  it("binds the projection to a state identity", () => {
    expect(studioProjection.identity.stateHash).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
  });

  it("carries verified replay books without adding execution authority", async () => {
    const bookDesk = await new ReplayBookDesk().replay();
    const projection = buildStudioProjection({
      workers: [new HeuristicDiscoveryWorker()],
      activeRuns: 0,
      bookDesk,
    });
    expect(projection.bookDesk.books).toHaveLength(3);
    expect(
      projection.bookDesk.books.every(
        (book) => book.lifecycle === "SNAPSHOT_VALID",
      ),
    ).toBe(true);
    expect(projection.system.liveExecutionEnabled).toBe(false);
  });
});
