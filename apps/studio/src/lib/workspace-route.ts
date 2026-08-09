const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_FOCUSED_PROPOSALS = 5;

export type WorkspaceView =
  | "overview"
  | "archaeologist"
  | "lifecycle"
  | "radar"
  | "preflight"
  | "scouts"
  | "cases"
  | "venues"
  | "books"
  | "evidence";

const ROUTE_BY_VIEW: Readonly<Record<WorkspaceView, string>> = Object.freeze({
  archaeologist: "discover",
  scouts: "findings",
  lifecycle: "review",
  preflight: "preflight",
  venues: "markets",
  evidence: "evidence",
  overview: "system",
  radar: "radar",
  cases: "cases",
  books: "books",
});

const VIEW_BY_ROUTE = new Map(
  Object.entries(ROUTE_BY_VIEW).map(([view, route]) => [route, view as WorkspaceView]),
);

export type WorkspaceRoute = Readonly<{
  view: WorkspaceView;
  proposalIds: readonly string[];
}>;

function validProposalIds(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter((value) => HASH_PATTERN.test(value)))]
    .slice(0, MAX_FOCUSED_PROPOSALS));
}

export function parseWorkspaceRoute(search: string): WorkspaceRoute {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const view = VIEW_BY_ROUTE.get(params.get("view") ?? "") ?? "archaeologist";
  const proposalIds = view === "lifecycle"
    ? validProposalIds((params.get("proposals") ?? "").split(",").filter(Boolean))
    : Object.freeze([]);
  return Object.freeze({ view, proposalIds });
}

export function serializeWorkspaceRoute(
  view: WorkspaceView,
  proposalIds: readonly string[] = [],
): string {
  const params = new URLSearchParams({ view: ROUTE_BY_VIEW[view] });
  const focused = view === "lifecycle" ? validProposalIds(proposalIds) : [];
  if (focused.length > 0) params.set("proposals", focused.join(","));
  return `?${params.toString()}`;
}

