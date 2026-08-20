import { describe, expect, it } from "vitest";
import { reviewQueueNeedsKeyPath } from "./review-queue-needs-key.js";
import { serializeWorkspaceRoute } from "./workspace-route.js";

describe("review queue NEEDS KEY path", () => {
  it("returns null when reviewer and estimators are configured", () => {
    expect(reviewQueueNeedsKeyPath({
      reviewerConfigured: true,
      estimatorsConfigured: true,
    })).toBeNull();
  });

  it("points at Agent operations when the reviewer is not configured", () => {
    expect(reviewQueueNeedsKeyPath({
      reviewerConfigured: false,
      estimatorsConfigured: true,
    })).toBe(serializeWorkspaceRoute("agents"));
    expect(reviewQueueNeedsKeyPath({
      reviewerConfigured: false,
      estimatorsConfigured: true,
    })).toBe("?view=agents");
  });

  it("points at Agent operations when estimators are not configured", () => {
    expect(reviewQueueNeedsKeyPath({
      reviewerConfigured: true,
      estimatorsConfigured: false,
    })).toBe("?view=agents");
  });

  it("points at Agent operations when neither lane is configured", () => {
    expect(reviewQueueNeedsKeyPath({
      reviewerConfigured: false,
      estimatorsConfigured: false,
    })).toBe("?view=agents");
  });
});
