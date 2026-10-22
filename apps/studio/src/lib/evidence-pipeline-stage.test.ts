import { describe, expect, it } from "vitest";
import { verifiedClaimsPipelineState } from "./evidence-pipeline-stage.js";

describe("verifiedClaimsPipelineState", () => {
  it("is interpreted after a passed claim", () => {
    expect(verifiedClaimsPipelineState({
      passedCount: 1,
      pendingCount: 0,
      activeCount: 0,
    })).toBe("INTERPRETED");
  });

  it("is running only while claims are in the Agent loop", () => {
    expect(verifiedClaimsPipelineState({
      passedCount: 0,
      pendingCount: 1,
      activeCount: 0,
    })).toBe("RUNNING");
    expect(verifiedClaimsPipelineState({
      passedCount: 0,
      pendingCount: 0,
      activeCount: 2,
    })).toBe("RUNNING");
  });

  it("is waiting when the lane is idle so PAUSED desks do not show RUNNING", () => {
    expect(verifiedClaimsPipelineState({
      passedCount: 0,
      pendingCount: 0,
      activeCount: 0,
    })).toBe("WAITING");
  });
});
