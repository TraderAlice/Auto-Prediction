import { serializeWorkspaceRoute } from "./workspace-route.js";

export type SystemExploreNextAction = Readonly<
  | { kind: "SCOUT"; label: "Explore next" }
  | { kind: "NEEDS_SETUP"; href: string }
>;

export function systemExploreNextAction(input: {
  readonly dispatchEligibility: "ELIGIBLE" | "BLOCKED" | null;
}): SystemExploreNextAction {
  // Search leases always requireDispatchEligible. There is no Studio path
  // that runs heuristic-fast-1 without that gate, so a heuristic suffix
  // would still call runScout and bounce.
  if (input.dispatchEligibility === "ELIGIBLE") {
    return Object.freeze({ kind: "SCOUT", label: "Explore next" as const });
  }
  return Object.freeze({
    kind: "NEEDS_SETUP",
    href: serializeWorkspaceRoute("agents"),
  });
}
