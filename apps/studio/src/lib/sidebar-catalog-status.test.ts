import { describe, expect, it } from "vitest";
import {
  describeSidebarCatalogStatus,
  type SidebarCatalogObservationInput,
  type SidebarCatalogSourceInput,
} from "./sidebar-catalog-status.js";

function source(
  venueId: string,
  status: SidebarCatalogSourceInput["status"],
  diagnostic: string | null = null,
): SidebarCatalogSourceInput {
  return { venueId, status, diagnostic };
}

function observation(
  patch: Partial<SidebarCatalogObservationInput> &
    Pick<SidebarCatalogObservationInput, "status" | "sources">,
): SidebarCatalogObservationInput {
  const healthySourceCount = patch.sources.filter(
    (item) => item.status === "CURRENT",
  ).length;
  return {
    healthySourceCount: patch.healthySourceCount ?? healthySourceCount,
    sourceCount: patch.sourceCount ?? patch.sources.length,
    listingCount: patch.listingCount ?? 600,
    ...patch,
  };
}

describe("sidebar catalog status", () => {
  it("keeps the ready heading when every source is current", () => {
    const status = describeSidebarCatalogStatus(
      observation({
        status: "READY",
        listingCount: 600,
        sources: [
          source("polymarket-global", "CURRENT"),
          source("kalshi", "CURRENT"),
        ],
      }),
    );

    expect(status).toMatchObject({
      heading: "System ready",
      tone: "ready",
      countLabel: "2/2 sources · 600 markets",
      refreshUseful: false,
      refreshHint: "Catalog refresh is not required for source health.",
      unhealthySources: [],
    });
    expect(status.hoverLabel).toContain("All catalog sources are current.");
    expect(status.hoverLabel).toContain("2/2 sources · 600 markets");
  });

  it("names the missing source and says refresh may help", () => {
    const status = describeSidebarCatalogStatus(
      observation({
        status: "DEGRADED",
        listingCount: 600,
        sources: [
          source("polymarket-global", "CURRENT"),
          source("polymarket-us", "CURRENT"),
          source("kalshi", "CURRENT"),
          source("gemini-predictions", "FAILED", "timed out"),
          source("opinion", "CURRENT"),
          source("myriad", "CURRENT"),
          source("limitless", "CURRENT"),
        ],
      }),
    );

    expect(status.heading).toBe("Sources degraded");
    expect(status.tone).toBe("degraded");
    expect(status.countLabel).toBe("6/7 sources · 600 markets");
    expect(status.unhealthySources).toEqual([
      {
        venueId: "gemini-predictions",
        status: "FAILED",
        statusLabel: "failed",
        diagnostic: "timed out",
      },
    ]);
    expect(status.refreshUseful).toBe(true);
    expect(status.refreshHint).toBe(
      "Catalog refresh on System overview may recover this source.",
    );
    expect(status.hoverLabel).toContain(
      "Unhealthy: gemini-predictions (failed).",
    );
    expect(status.hoverLabel).toContain(
      "Catalog refresh on System overview may recover this source.",
    );
  });

  it("names every unhealthy source when more than one is down", () => {
    const status = describeSidebarCatalogStatus(
      observation({
        status: "DEGRADED",
        listingCount: 412,
        sources: [
          source("kalshi", "STALE_AFTER_FAILURE", "502"),
          source("limitless", "NEVER_REFRESHED"),
          source("opinion", "CURRENT"),
        ],
      }),
    );

    expect(status.unhealthySources.map((item) => item.venueId)).toEqual([
      "kalshi",
      "limitless",
    ]);
    expect(status.refreshHint).toBe(
      "Catalog refresh on System overview may recover these sources.",
    );
    expect(status.hoverLabel).toContain(
      "Unhealthy: kalshi (stale after failure), limitless (never refreshed).",
    );
  });

  it("treats an idle catalog as refresh-next without claiming readiness", () => {
    const status = describeSidebarCatalogStatus(
      observation({
        status: "IDLE",
        listingCount: 0,
        sources: [
          source("polymarket-global", "NEVER_REFRESHED"),
          source("kalshi", "NEVER_REFRESHED"),
        ],
      }),
    );

    expect(status).toMatchObject({
      heading: "Catalog idle",
      tone: "idle",
      countLabel: "0/2 sources · 0 markets",
      refreshUseful: true,
      refreshHint: "Catalog refresh on System overview is the next step.",
    });
    expect(status.hoverLabel).not.toContain("System ready");
  });

  it("does not recommend another refresh while one is already running", () => {
    const status = describeSidebarCatalogStatus(
      observation({
        status: "REFRESHING",
        listingCount: 600,
        sources: [
          source("kalshi", "CURRENT"),
          source("gemini-predictions", "FAILED", "connection reset"),
        ],
      }),
    );

    expect(status).toMatchObject({
      heading: "Refreshing catalogs",
      tone: "refreshing",
      refreshUseful: false,
      refreshHint: "Catalog refresh is already running.",
    });
    expect(status.unhealthySources[0]?.venueId).toBe("gemini-predictions");
  });
});
