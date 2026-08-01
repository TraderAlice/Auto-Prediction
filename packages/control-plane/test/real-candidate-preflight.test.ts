import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RealCandidatePreflightDesk } from "../src/index.js";

const fixtureRoot = resolve(
  import.meta.dirname,
  "../../../projects/fixtures",
);

describe("real candidate preflight desk", () => {
  it("loads the immutable real-fixture screen once and projects no authority", async () => {
    const desk = new RealCandidatePreflightDesk(fixtureRoot);
    expect(() => desk.projection()).toThrow(/not loaded/);
    expect(() => desk.depthProjection()).toThrow(/not loaded/);
    expect(() => desk.dispositionProjection()).toThrow(/not loaded/);
    const [first, second] = await Promise.all([desk.load(), desk.load()]);
    expect(first).toBe(second);
    expect(desk.projection()).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      catalogIndicativeGrossEdgeBps: "55",
      venueReportedBuyGrossEdgeBps: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(desk.depthProjection()).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      screenQuantity: "500000000",
      quantityBound: true,
      totalCostBeforeFees: "500000000",
      grossEdgeBpsBeforeFees: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(desk.dispositionProjection()).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "BOUND_BOOK_SNAPSHOT_ONLY",
      postFeeFloorUpperBound: "0",
      strictlyPositivePostFeeFloorPossible: false,
      terminalForSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
  });
});
