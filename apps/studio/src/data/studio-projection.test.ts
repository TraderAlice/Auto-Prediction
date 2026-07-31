import { describe, expect, it } from "vitest";
import {
  buildStudioProjection,
  HeuristicDiscoveryWorker,
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
});
