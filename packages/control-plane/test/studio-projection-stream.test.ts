import { describe, expect, it } from "vitest";
import {
  assertStudioProjectionInvalidation,
  buildStudioProjectionInvalidation,
} from "../src/index.js";

describe("Studio projection invalidation stream", () => {
  it("publishes a content-addressed presentation-only refresh signal", () => {
    const invalidation = buildStudioProjectionInvalidation({
      revision: 42n,
      emittedAt: "2026-08-10T00:00:00.000Z",
      reason: "STATE_CHANGED",
    });
    expect(invalidation).toMatchObject({
      schemaVersion: "pmh.studio-projection-invalidation.v1",
      revision: "42",
      projectionResource: "/api/v1/projection",
      projectionView: "LIVE_BOUNDED",
      refreshRequired: true,
      sourceStateHashKnown: false,
      authority: "PRESENTATION_INVALIDATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(() => assertStudioProjectionInvalidation(invalidation)).not.toThrow();
    expect(() => assertStudioProjectionInvalidation({
      ...invalidation,
      revision: "43",
    })).toThrow(/transport contract/u);
  });

  it("rejects non-canonical revisions and timestamps", () => {
    expect(() => buildStudioProjectionInvalidation({
      revision: "01",
      emittedAt: "2026-08-10T00:00:00.000Z",
      reason: "SUBSCRIBER_CONNECTED",
    })).toThrow(/revision/u);
    expect(() => buildStudioProjectionInvalidation({
      revision: 0,
      emittedAt: "not-a-time",
      reason: "SUBSCRIBER_CONNECTED",
    })).toThrow();
  });
});
