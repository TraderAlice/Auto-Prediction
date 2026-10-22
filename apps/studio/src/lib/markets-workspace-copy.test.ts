import { describe, expect, it } from "vitest";
import { marketsWorkspaceCopy } from "./markets-workspace-copy.js";

const observed = {
  healthySourceCount: 5,
  sourceCount: 7,
  listingCount: 580,
  venueAdapterCount: 7,
} as const;

describe("marketsWorkspaceCopy", () => {
  it("does not call catalog listingCount markets next to the Markets venue matrix", () => {
    const copy = marketsWorkspaceCopy(observed);
    expect(copy.sidebarCatalogLine).toBe("5/7 sources · 580 listings");
    expect(copy.sidebarCatalogLine.toLowerCase()).not.toContain("market");
    expect(copy.pageTitle).toBe("Venue capability matrix");
    expect(copy.pageDescription).toContain("7 venue adapters");
    expect(copy.pageDescription).toContain("580 listings");
    expect(copy.pageDescription).toContain("not a listing browser");
  });

  it("uses the same listing count on the Markets page as in the sidebar", () => {
    const copy = marketsWorkspaceCopy({
      ...observed,
      listingCount: 1,
      venueAdapterCount: 1,
    });
    expect(copy.sidebarCatalogLine).toBe("5/7 sources · 1 listing");
    expect(copy.pageDescription).toContain("1 venue adapter");
    expect(copy.pageDescription).toContain("1 listing");
    expect(copy.pageDescription).not.toMatch(/market/i);
  });
});
