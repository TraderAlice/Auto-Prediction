import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertSemanticFamilyRetrievalPlan,
  buildSearchScopeIdentity,
  buildSemanticFamilyCatalogSelection,
  semanticFamilyRetrievalBrief,
  type DiscoveryCatalogListing,
  type SearchSemanticFamily,
} from "../src/index.js";

function listing(
  listingRef: string,
  title: string,
  venueId = listingRef.split(":")[0]!,
): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":").slice(1).join(":"),
    title,
    description: title,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-12-31T00:00:00.000Z",
    rulesText: null,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: `${venueId}:v1`,
  });
}

const corpusIdentity = hashCanonical({ corpus: "semantic-family-retrieval" });
const noFeedback = Object.freeze({
  completedSemanticScopeIdentities: Object.freeze([]),
  attemptedRoutingScopeIdentities: Object.freeze([]),
});

function select(
  semanticFamily: SearchSemanticFamily,
  listings: readonly DiscoveryCatalogListing[],
) {
  return buildSemanticFamilyCatalogSelection({
    source: "QUALIFIED_LIVE_OBSERVATIONS",
    corpusIdentity,
    listings,
    question: "Find a grounded semantic relation and try to falsify it.",
    eligibleVenueIds: Object.freeze([...new Set(listings.map((item) => item.venueId))]),
    semanticFamily,
    maxContextListings: 2,
    feedback: noFeedback,
  });
}

describe("semantic-family retrieval trailheads", () => {
  it("recalls the shooting/live-cola pair without asserting mutual exclusion", () => {
    const selected = select("TEMPORAL_IMPOSSIBILITY", [
      listing("venue-a:shot", "Will Trump be shot during August 2026?"),
      listing("venue-b:cola", "Will Trump publicly livestream drinking cola in September 2026?"),
      listing("venue-c:rates", "Will the Federal Reserve cut rates in September 2026?"),
    ]);

    expect(selected.catalogContext.listings.map((item) => item.listingRef)).toEqual([
      "venue-a:shot",
      "venue-b:cola",
    ]);
    expect(selected.retrievalPlan).toMatchObject({
      semanticFamily: "TEMPORAL_IMPOSSIBILITY",
      neighborhoodCount: 1,
      selectedNeighborhoodRank: 1,
      selectionReason: "FRESH_FAMILY_NEIGHBORHOOD",
      anchorListingRefs: ["venue-a:shot", "venue-b:cola"],
      sharedSignals: ["trump"],
      authority: "SEARCH_ROUTING_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(semanticFamilyRetrievalBrief(selected.retrievalPlan)).toContain(
      "not a semantic or probability judgment",
    );
    expect(assertSemanticFamilyRetrievalPlan(selected.retrievalPlan)).toBe(
      selected.retrievalPlan,
    );
    expect(() => assertSemanticFamilyRetrievalPlan({
      ...selected.retrievalPlan,
      sharedSignals: ["trump", "certainly-exclusive"],
    })).toThrow(/bounded contract/);
  });

  it("rotates away from an attempted routing neighborhood deterministically", () => {
    const listings = [
      listing("venue-a:shot", "Will Trump be shot during August 2026?"),
      listing("venue-b:cola", "Will Trump publicly livestream drinking cola in September 2026?"),
      listing("venue-c:speech", "Will Trump attend a live speech in October 2026?"),
    ];
    const first = select("TEMPORAL_IMPOSSIBILITY", listings);
    const scope = buildSearchScopeIdentity(first.catalogContext.listings);
    const rotated = buildSemanticFamilyCatalogSelection({
      source: "QUALIFIED_LIVE_OBSERVATIONS",
      corpusIdentity,
      listings,
      question: "Find temporal tension.",
      eligibleVenueIds: ["venue-a", "venue-b", "venue-c"],
      semanticFamily: "TEMPORAL_IMPOSSIBILITY",
      maxContextListings: 2,
      feedback: {
        completedSemanticScopeIdentities: [],
        attemptedRoutingScopeIdentities: [scope.routingScopeIdentity],
      },
    });

    expect(rotated.retrievalPlan.selectedNeighborhoodRank).toBeGreaterThan(1);
    expect(rotated.retrievalPlan.selectionReason).toBe("FRESH_FAMILY_NEIGHBORHOOD");
    expect(rotated.catalogContext.contextIdentity).not.toBe(
      first.catalogContext.contextIdentity,
    );
  });

  it.each([
    ["EVENT_CONTAINMENT", [
      "Will US CPI exceed 4 percent by June 2026?",
      "Will US CPI exceed 3 percent by June 2026?",
    ]],
    ["PARTITION_COMPLETENESS", [
      "Will Boston high temperature be 70 or under?",
      "Will Boston high temperature be between 71 and 75?",
    ]],
    ["IDENTITY_SUCCESSION", [
      "Will Alice remain party nominee through September 2026?",
      "Will Alice be elected president in November 2026?",
    ]],
    ["PHYSICAL_CO_OCCURRENCE", [
      "Will Taylor perform live in Tokyo during August 2026?",
      "Will Taylor attend a live debate in London during August 2026?",
    ]],
  ] as const)("builds a bounded %s neighborhood", (family, titles) => {
    const selected = select(family, [
      listing("venue-a:left", titles[0]),
      listing("venue-b:right", titles[1]),
    ]);
    expect(selected.retrievalPlan).toMatchObject({
      semanticFamily: family,
      neighborhoodCount: 1,
      selectedNeighborhoodRank: 1,
      score: expect.any(Number),
    });
    expect(selected.catalogContext.listings).toHaveLength(2);
  });

  it("records a query fallback when deterministic family cues are absent", () => {
    const selected = select("IDENTITY_SUCCESSION", [
      listing("venue-a:weather", "Will rainfall exceed one inch tomorrow?"),
      listing("venue-b:sports", "Will the Tigers win tonight?"),
    ]);
    expect(selected.retrievalPlan).toMatchObject({
      neighborhoodCount: 0,
      selectedNeighborhoodRank: null,
      selectionReason: "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK",
      anchorListingRefs: [],
      sharedSignals: [],
      score: null,
    });
  });
});
