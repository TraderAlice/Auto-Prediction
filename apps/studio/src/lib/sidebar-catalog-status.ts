export type SidebarCatalogSourceStatus =
  | "NEVER_REFRESHED"
  | "CURRENT"
  | "STALE_AFTER_FAILURE"
  | "FAILED";

export type SidebarCatalogObservationStatus =
  | "IDLE"
  | "REFRESHING"
  | "READY"
  | "DEGRADED";

export type SidebarCatalogSourceInput = Readonly<{
  venueId: string;
  status: SidebarCatalogSourceStatus;
  diagnostic: string | null;
}>;

export type SidebarCatalogObservationInput = Readonly<{
  status: SidebarCatalogObservationStatus;
  healthySourceCount: number;
  sourceCount: number;
  listingCount: number;
  sources: readonly SidebarCatalogSourceInput[];
}>;

export type SidebarCatalogTone = "ready" | "degraded" | "refreshing" | "idle";

export type SidebarUnhealthySource = Readonly<{
  venueId: string;
  status: Exclude<SidebarCatalogSourceStatus, "CURRENT">;
  statusLabel: string;
  diagnostic: string | null;
}>;

export type SidebarCatalogStatus = Readonly<{
  heading: string;
  tone: SidebarCatalogTone;
  sourceCount: number;
  healthySourceCount: number;
  listingCount: number;
  countLabel: string;
  hoverLabel: string;
  unhealthySources: readonly SidebarUnhealthySource[];
  refreshUseful: boolean;
  refreshHint: string;
}>;

const SOURCE_STATUS_LABEL: Readonly<
  Record<Exclude<SidebarCatalogSourceStatus, "CURRENT">, string>
> = Object.freeze({
  NEVER_REFRESHED: "never refreshed",
  STALE_AFTER_FAILURE: "stale after failure",
  FAILED: "failed",
});

export function sourceStatusLabel(
  status: Exclude<SidebarCatalogSourceStatus, "CURRENT">,
): string {
  return SOURCE_STATUS_LABEL[status];
}

export function describeSidebarCatalogStatus(
  observation: SidebarCatalogObservationInput,
): SidebarCatalogStatus {
  const unhealthySources = Object.freeze(
    observation.sources.flatMap((source): SidebarUnhealthySource[] => {
      if (source.status === "CURRENT") {
        return [];
      }
      return [
        Object.freeze({
          venueId: source.venueId,
          status: source.status,
          statusLabel: sourceStatusLabel(source.status),
          diagnostic: source.diagnostic,
        }),
      ];
    }),
  );
  const tone = catalogTone(observation.status);
  const heading = catalogHeading(observation.status);
  const countLabel =
    `${observation.healthySourceCount}/${observation.sourceCount} sources · ` +
    `${observation.listingCount} markets`;
  const refreshUseful =
    observation.status !== "REFRESHING" &&
    (observation.status === "IDLE" || unhealthySources.length > 0);
  const refreshHint = catalogRefreshHint({
    status: observation.status,
    unhealthyCount: unhealthySources.length,
    refreshUseful,
  });
  const hoverLabel = [
    countLabel,
    unhealthySources.length === 0
      ? "All catalog sources are current."
      : `Unhealthy: ${unhealthySources
          .map((source) => `${source.venueId} (${source.statusLabel})`)
          .join(", ")}.`,
    refreshHint,
  ].join(" ");

  return Object.freeze({
    heading,
    tone,
    sourceCount: observation.sourceCount,
    healthySourceCount: observation.healthySourceCount,
    listingCount: observation.listingCount,
    countLabel,
    hoverLabel,
    unhealthySources,
    refreshUseful,
    refreshHint,
  });
}

function catalogTone(
  status: SidebarCatalogObservationStatus,
): SidebarCatalogTone {
  if (status === "READY") {
    return "ready";
  }
  if (status === "REFRESHING") {
    return "refreshing";
  }
  if (status === "IDLE") {
    return "idle";
  }
  return "degraded";
}

function catalogHeading(status: SidebarCatalogObservationStatus): string {
  if (status === "REFRESHING") {
    return "Refreshing catalogs";
  }
  if (status === "IDLE") {
    return "Catalog idle";
  }
  if (status === "DEGRADED") {
    return "Sources degraded";
  }
  return "System ready";
}

function catalogRefreshHint(input: {
  status: SidebarCatalogObservationStatus;
  unhealthyCount: number;
  refreshUseful: boolean;
}): string {
  if (input.status === "REFRESHING") {
    return "Catalog refresh is already running.";
  }
  if (input.status === "IDLE") {
    return "Catalog refresh on System overview is the next step.";
  }
  if (!input.refreshUseful) {
    return "Catalog refresh is not required for source health.";
  }
  return input.unhealthyCount === 1
    ? "Catalog refresh on System overview may recover this source."
    : "Catalog refresh on System overview may recover these sources.";
}
