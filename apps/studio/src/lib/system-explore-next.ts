import { serializeWorkspaceRoute } from "./workspace-route.js";

export type SystemExploreWorker = Readonly<{
  kind: "HEURISTIC" | "MODEL";
  status: "READY" | "NEEDS_KEY" | "NEEDS_PROVIDER";
}>;

export type SystemExploreNextAction = Readonly<
  | { kind: "SCOUT"; label: "Explore next" | "Explore next · heuristic" }
  | { kind: "NEEDS_SETUP"; href: string }
>;

export function systemExploreNextAction(input: {
  readonly workers: readonly SystemExploreWorker[];
  readonly dispatchEligibility: "ELIGIBLE" | "BLOCKED" | null;
}): SystemExploreNextAction {
  const heuristicReady = input.workers.some(
    (worker) => worker.kind === "HEURISTIC" && worker.status === "READY",
  );
  const modelReady = input.workers.some(
    (worker) => worker.kind === "MODEL" && worker.status === "READY",
  );

  if (input.dispatchEligibility === "ELIGIBLE") {
    return Object.freeze({ kind: "SCOUT", label: "Explore next" as const });
  }

  // A model worker can appear READY while Codex dispatch is still blocked.
  // The lease refuses that path, so do not keep a green Explore next.
  if (modelReady) {
    return Object.freeze({
      kind: "NEEDS_SETUP",
      href: serializeWorkspaceRoute("agents"),
    });
  }

  if (heuristicReady) {
    return Object.freeze({
      kind: "SCOUT",
      label: "Explore next · heuristic" as const,
    });
  }

  return Object.freeze({
    kind: "NEEDS_SETUP",
    href: serializeWorkspaceRoute("agents"),
  });
}
