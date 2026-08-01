import { hashCanonical, type Hash } from "@pmh/domain";
import { calculateTwoListingIndicativeEconomics } from "./indicative-relation-economics.js";
import type { DiscoveryCatalogListing } from "./types.js";

export type SearchScopeIdentity = Readonly<{
  semanticScopeIdentity: Hash;
  routingScopeIdentity: Hash;
  listingRefs: readonly string[];
  kind: "EXACT_PAIR" | "BOUNDED_CONTEXT";
  priceIndependentSemanticIdentity: true;
  authority: "SEARCH_ROUTING_ONLY";
}>;

function semanticListing(listing: DiscoveryCatalogListing) {
  return Object.freeze({
    listingRef: listing.listingRef,
    venueId: listing.venueId,
    venueInstrumentId: listing.venueInstrumentId,
    title: listing.title,
    description: listing.description,
    status: listing.status,
    mechanism: listing.mechanism,
    closesAt: listing.closesAt,
    rulesText: listing.rulesText,
    outcomes: Object.freeze(
      [...listing.outcomes]
        .map((outcome) => Object.freeze({
          venueOutcomeId: outcome.venueOutcomeId,
          label: outcome.label,
        }))
        .sort((left, right) =>
          left.venueOutcomeId.localeCompare(right.venueOutcomeId) ||
          left.label.localeCompare(right.label)
        ),
    ),
    priceScale: listing.priceScale,
    quantityScale: listing.quantityScale,
    protocolIdentity: listing.protocolIdentity,
  });
}

function routingListing(
  listing: DiscoveryCatalogListing,
  completeScopePrices: boolean,
) {
  return Object.freeze({
    listingRef: listing.listingRef,
    minPriceTick: listing.minPriceTick,
    outcomes: Object.freeze(
      [...listing.outcomes]
        .map((outcome) => Object.freeze({
          venueOutcomeId: outcome.venueOutcomeId,
          priceAvailable: outcome.indicativePrice !== null,
          ...(completeScopePrices
            ? { indicativePrice: outcome.indicativePrice }
            : {}),
        }))
        .sort((left, right) =>
          left.venueOutcomeId.localeCompare(right.venueOutcomeId)
        ),
    ),
  });
}

export function buildSearchScopeIdentity(
  listingsInput: readonly DiscoveryCatalogListing[],
): SearchScopeIdentity {
  const listings = [...listingsInput].sort((left, right) =>
    left.listingRef.localeCompare(right.listingRef)
  );
  const listingRefs = Object.freeze(listings.map((listing) => listing.listingRef));
  if (
    listings.length === 0 ||
    new Set(listingRefs).size !== listingRefs.length ||
    listingRefs.some((listingRef) => listingRef.trim() === "")
  ) {
    throw new Error("search scope identity requires unique non-empty listings");
  }
  const semanticScopeIdentity = hashCanonical({
    schemaVersion: "pmh.search-semantic-scope.v1",
    listings: listings.map(semanticListing),
  });
  const completeScopePrices = listings.every(
    (listing) => listing.outcomes.length > 0 &&
      listing.outcomes.every((outcome) => outcome.indicativePrice !== null),
  );
  const equivalentEconomicPosture = listings.length === 2
    ? calculateTwoListingIndicativeEconomics({
        listingRefs,
        relation: "EQUIVALENT",
        currentListings: new Map(
          listings.map((listing) => [listing.listingRef, listing] as const),
        ),
      }).status
    : null;
  const routingScopeIdentity = hashCanonical({
    schemaVersion: "pmh.search-routing-scope.v3",
    semanticScopeIdentity,
    equivalentEconomicPosture,
    ...(equivalentEconomicPosture === null
      ? {
          completeScopePrices,
          listings: listings.map((listing) =>
            routingListing(listing, completeScopePrices)
          ),
        }
      : {}),
  });
  return Object.freeze({
    semanticScopeIdentity,
    routingScopeIdentity,
    listingRefs,
    kind: listings.length === 2 ? "EXACT_PAIR" as const : "BOUNDED_CONTEXT" as const,
    priceIndependentSemanticIdentity: true as const,
    authority: "SEARCH_ROUTING_ONLY" as const,
  });
}
