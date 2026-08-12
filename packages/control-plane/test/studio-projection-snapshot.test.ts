import { describe, expect, it } from "vitest";
import {
  buildLiveStudioProjection,
  buildStudioProjection,
  buildStudioProjectionSnapshot,
  assertStudioProjectionSnapshot,
} from "../src/index.js";

describe("durable bounded Studio projection snapshot", () => {
  const projection = () => buildLiveStudioProjection(
    buildStudioProjection({ workers: [], activeRuns: 0 }),
  );

  it("binds an immutable bounded view without gaining research authority", () => {
    const snapshot = buildStudioProjectionSnapshot({
      projection: projection(),
      sourceProjectionRevision: 7n,
      materializedAt: "2026-08-13T00:00:00.000Z",
    });
    expect(snapshot).toMatchObject({
      sourceProjectionRevision: "7",
      authority: "DERIVED_PRESENTATION_CACHE_ONLY",
      providerRequestsStartedByCache: 0,
      modelInvocationsStartedByCache: 0,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(snapshot.projection.identity.view).toBe("LIVE_BOUNDED");
  });

  it("rejects tampering and refuses a full projection", () => {
    const snapshot = buildStudioProjectionSnapshot({
      projection: projection(),
      sourceProjectionRevision: 0n,
      materializedAt: "2026-08-13T00:00:00.000Z",
    });
    expect(() => assertStudioProjectionSnapshot({
      ...snapshot,
      projectionViewHash: snapshot.projection.identity.stateHash,
    })).toThrow(/cache contract|valid bounded view/);
    expect(() => buildStudioProjectionSnapshot({
      projection: buildStudioProjection({ workers: [], activeRuns: 0 }),
      sourceProjectionRevision: 0n,
      materializedAt: "2026-08-13T00:00:00.000Z",
    })).toThrow(/bounded view/);
  });
});
