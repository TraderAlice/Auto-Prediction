import { describe, expect, it } from "vitest";

import { systemExploreNextAction } from "./system-explore-next.js";
import { serializeWorkspaceRoute } from "./workspace-route.js";

const heuristicReady = Object.freeze({
  kind: "HEURISTIC" as const,
  status: "READY" as const,
});
const modelNeedsKey = Object.freeze({
  kind: "MODEL" as const,
  status: "NEEDS_KEY" as const,
});
const modelReady = Object.freeze({
  kind: "MODEL" as const,
  status: "READY" as const,
});

describe("system overview Explore next", () => {
  it("keeps Explore next when the routed discovery profile can dispatch", () => {
    expect(systemExploreNextAction({
      workers: [heuristicReady, modelReady],
      dispatchEligibility: "ELIGIBLE",
    })).toEqual({ kind: "SCOUT", label: "Explore next" });
  });

  it("labels the remaining heuristic-only path when the model lane needs a key", () => {
    expect(systemExploreNextAction({
      workers: [heuristicReady, modelNeedsKey],
      dispatchEligibility: "BLOCKED",
    })).toEqual({ kind: "SCOUT", label: "Explore next · heuristic" });
    expect(systemExploreNextAction({
      workers: [heuristicReady, modelNeedsKey],
      dispatchEligibility: null,
    })).toEqual({ kind: "SCOUT", label: "Explore next · heuristic" });
  });

  it("does not keep a green Explore next when the model looks ready but cannot dispatch", () => {
    expect(systemExploreNextAction({
      workers: [heuristicReady, modelReady],
      dispatchEligibility: "BLOCKED",
    })).toEqual({
      kind: "NEEDS_SETUP",
      href: serializeWorkspaceRoute("agents"),
    });
    expect(systemExploreNextAction({
      workers: [modelReady],
      dispatchEligibility: null,
    })).toEqual({
      kind: "NEEDS_SETUP",
      href: "?view=agents",
    });
  });

  it("points at Agent operations when no honest scout path exists", () => {
    expect(systemExploreNextAction({
      workers: [modelNeedsKey],
      dispatchEligibility: "BLOCKED",
    })).toEqual({
      kind: "NEEDS_SETUP",
      href: "?view=agents",
    });
    expect(systemExploreNextAction({
      workers: [],
      dispatchEligibility: null,
    }).kind).toBe("NEEDS_SETUP");
  });
});
