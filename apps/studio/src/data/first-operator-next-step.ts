export type DiscoveryDispatchEligibility = "ELIGIBLE" | "BLOCKED";

export type CatalogHealth = Readonly<{
  healthySourceCount: number;
  sourceCount: number;
  listingCount: number;
}>;

export function catalogHealthLabel(health: CatalogHealth): string {
  return `System ready · ${health.healthySourceCount}/${health.sourceCount} sources · ${health.listingCount} markets`;
}

export function isCredentialBlockedDispatch(
  eligibility: DiscoveryDispatchEligibility | undefined,
  diagnostic: string | null | undefined,
): boolean {
  if (eligibility === "ELIGIBLE") return false;
  if (eligibility === "BLOCKED") return true;
  return (diagnostic ?? "").toLowerCase().includes("credential unavailable");
}

export function discoverFirstStep(health: CatalogHealth): Readonly<{
  title: "First step";
  sourceHealthLabel: string;
  body: string;
  primaryAction: "REFRESH_CATALOGS";
  primaryLabel: "Refresh catalogs";
}> {
  return Object.freeze({
    title: "First step",
    sourceHealthLabel: catalogHealthLabel(health),
    body: health.listingCount === 0
      ? "Refresh anonymous catalogs to see which sources are healthy. This does not spend model budget or grant trading authority."
      : "Anonymous catalogs are already in view. Refresh catalogs to take a new immutable corpus, then start a heuristic scan. Refresh does not spend model budget.",
    primaryAction: "REFRESH_CATALOGS",
    primaryLabel: "Refresh catalogs",
  });
}

export function inspirationEmptyState(blocked: boolean): Readonly<{
  title: "No useful detours yet";
  body: string;
}> {
  return Object.freeze({
    title: "No useful detours yet",
    body: blocked
      ? "Refresh catalogs here without a provider key, or open Agent operations to inspect the existing Codex session. Model spend stays blocked until that session is available."
      : "Refresh catalogs on this page first, then start a heuristic scan. Cross-lens inspirations appear here after a scan finds a grounded relation outside its assignment.",
  });
}

export function discoverSpendAction(blocked: boolean): Readonly<{
  kind: "HEURISTIC_SCAN" | "OPEN_AGENT_OPERATIONS";
  label: string;
}> {
  return blocked
    ? Object.freeze({
        kind: "OPEN_AGENT_OPERATIONS",
        label: "Open Agent operations",
      })
    : Object.freeze({
        kind: "HEURISTIC_SCAN",
        label: "Start heuristic scan",
      });
}

export function findingsPrimaryAction(input: Readonly<{
  dispatchEligibility: DiscoveryDispatchEligibility | undefined;
  diagnostic: string | null | undefined;
}>): Readonly<{
  kind: "EXPLORE_NEXT" | "OPEN_AGENT_OPERATIONS";
  label: string;
  helper: string;
  exploreNextPrimary: boolean;
}> {
  if (isCredentialBlockedDispatch(input.dispatchEligibility, input.diagnostic)) {
    return Object.freeze({
      kind: "OPEN_AGENT_OPERATIONS",
      label: "Open Agent operations",
      helper:
        "Attach the existing Codex OAuth session in Agent operations, or stay on Discover to refresh catalogs without DeepSeek or Codex.",
      exploreNextPrimary: false,
    });
  }
  return Object.freeze({
    kind: "EXPLORE_NEXT",
    label: "Explore next",
    helper: "",
    exploreNextPrimary: true,
  });
}
