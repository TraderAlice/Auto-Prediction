import { describe, expect, it } from "vitest";

import { systemExploreNextAction } from "./system-explore-next.js";
import { serializeWorkspaceRoute } from "./workspace-route.js";

describe("system overview Explore next", () => {
  it("keeps Explore next only when discovery can dispatch", () => {
    expect(systemExploreNextAction({
      dispatchEligibility: "ELIGIBLE",
    })).toEqual({ kind: "SCOUT", label: "Explore next" });
  });

  it("does not keep a clickable scout when dispatch is blocked or unknown", () => {
    expect(systemExploreNextAction({
      dispatchEligibility: "BLOCKED",
    })).toEqual({
      kind: "NEEDS_SETUP",
      href: serializeWorkspaceRoute("agents"),
    });
    expect(systemExploreNextAction({
      dispatchEligibility: null,
    })).toEqual({
      kind: "NEEDS_SETUP",
      href: "?view=agents",
    });
  });
});
