export type MarketsWorkspaceCounts = Readonly<{
  healthySourceCount: number;
  sourceCount: number;
  listingCount: number;
  venueAdapterCount: number;
}>;

export type MarketsWorkspaceCopy = Readonly<{
  sidebarCatalogLine: string;
  pageTitle: string;
  pageDescription: string;
}>;

export const MARKETS_PAGE_TITLE = "Venue capability matrix";

export function marketsWorkspaceCopy(
  counts: MarketsWorkspaceCounts,
): MarketsWorkspaceCopy {
  const listings = countPhrase(counts.listingCount, "listing", "listings");
  const adapters = countPhrase(
    counts.venueAdapterCount,
    "venue adapter",
    "venue adapters",
  );
  return {
    sidebarCatalogLine: `${counts.healthySourceCount}/${counts.sourceCount} sources · ${listings}`,
    pageTitle: MARKETS_PAGE_TITLE,
    pageDescription:
      `These are ${adapters}, not a listing browser. The catalog currently holds ${listings}. Each adapter owns its precision, authentication boundary, mechanism, and qualification evidence.`,
  };
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
