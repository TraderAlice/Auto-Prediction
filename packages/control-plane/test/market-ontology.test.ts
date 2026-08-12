import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertMarketOntologySnapshot,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  type DiscoveryCatalogListing,
} from "../src/index.js";

function listing(input: Readonly<{
  listingRef: string;
  title: string;
  venueId?: string;
  description?: string;
  closesAt?: string | null;
  rulesText?: string | null;
  rulesTextPosture?: "COMPLETE" | "TRUNCATED";
  mechanism?: string;
  prices?: readonly (string | null)[];
}>): DiscoveryCatalogListing {
  const venueId = input.venueId ?? input.listingRef.split(":")[0]!;
  return Object.freeze({
    listingRef: input.listingRef,
    venueId,
    venueInstrumentId: input.listingRef.split(":").slice(1).join(":"),
    title: input.title,
    description: input.description ?? input.title,
    status: "OPEN",
    mechanism: input.mechanism ?? "CENTRALIZED_ORDER_BOOK",
    closesAt: input.closesAt ?? "2026-12-31T00:00:00.000Z",
    rulesText: input.rulesText ?? null,
    ...(input.rulesTextPosture === undefined ? {} : {
      rulesTextPosture: input.rulesTextPosture,
      rulesTextSourceCharacterCount: input.rulesText?.length ?? 0,
    }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: input.prices?.[0] ?? null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: input.prices?.[1] ?? null }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-12T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef: input.listingRef, title: input.title }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function corpus(listings: readonly DiscoveryCatalogListing[]) {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-test" }),
    eligibleSourceCount: new Set(listings.map((item) => item.venueId)).size,
    excludedSourceCount: 0,
    listings,
  });
}

describe("evidence-bound market ontology", () => {
  it("keeps world proposition, settlement contract, and traded state distinct", () => {
    const snapshot = buildMarketOntologySnapshot(corpus([
      listing({
        listingRef: "venue-a:trump-shot",
        title: "Will Trump be shot during August 2026?",
        closesAt: "2026-09-01T00:00:00.000Z",
        rulesText: "Resolves Yes if the named event occurs.",
        prices: ["999999999999999999", "1"],
      }),
      listing({
        listingRef: "venue-b:trump-cola",
        title: "Will Trump livestream drinking cola in September 2026?",
        closesAt: "2026-10-01T00:00:00.000Z",
        prices: ["100000000000000001", "899999999999999999"],
      }),
      listing({
        listingRef: "venue-c:fed",
        title: "Will the Federal Reserve cut rates in September 2026?",
      }),
    ]));

    expect(assertMarketOntologySnapshot(snapshot)).toBe(snapshot);
    expect(snapshot).toMatchObject({
      listingCount: 3,
      worldFacetCount: 3,
      settlementFacetCount: 3,
      tradedFacetCount: 3,
      authority: "DERIVED_SEARCH_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      priceInterpretation: "TRADED_PAYOFF_VALUATION_OBSERVATION_NOT_CERTIFIED_WORLD_PROBABILITY",
    });
    const shot = snapshot.nodes.find((item) => item.listingRef === "venue-a:trump-shot")!;
    expect(shot.worldFacet).toMatchObject({
      subjectSignals: expect.arrayContaining(["trump"]),
      predicateFamilies: expect.arrayContaining(["DEATH_OR_INCAPACITY"]),
      temporalSignals: expect.arrayContaining(["2026", "august"]),
      extractionPosture: "BOUNDED_LEXICAL_ROUTING_HYPOTHESIS",
    });
    expect(shot.settlementFacet).toMatchObject({
      rulesEvidencePosture: "PRESENT_COMPLETE",
      closeBoundaryPosture: "VENUE_CLOSE_ONLY_NOT_INFERRED_RESOLUTION",
    });
    expect(shot.tradedFacet.indicativePriceStrings[0]?.value).toBe("999999999999999999");
    expect(shot.tradedFacet.pricePosture).toBe(
      "INDICATIVE_VENUE_STRINGS_NOT_WORLD_PROBABILITY",
    );

    const trailhead = snapshot.trailheads.find((item) =>
      item.listingRefs.includes("venue-a:trump-shot") &&
      item.listingRefs.includes("venue-b:trump-cola")
    );
    expect(trailhead).toMatchObject({
      sharedSubjectSignals: expect.arrayContaining(["trump"]),
      changedFacets: expect.arrayContaining([
        "WORLD_PREDICATE",
        "WORLD_TIME_SCOPE",
        "SETTLEMENT_EVIDENCE",
        "VENUE",
        "PRICE_OBSERVATION",
      ]),
      authority: "SEARCH_ROUTING_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(trailhead?.searchQuestion).toContain("test counterexamples");
  });

  it("changes only the traded facet when an exact indicative price string changes", () => {
    const firstListing = listing({
      listingRef: "venue-a:house-dem",
      title: "Will the Democratic Party control the House after the 2026 election?",
      prices: ["500000000000000000", "500000000000000000"],
    });
    const changedListing = Object.freeze({
      ...firstListing,
      outcomes: Object.freeze([
        Object.freeze({ ...firstListing.outcomes[0]!, indicativePrice: "500000000000000001" }),
        firstListing.outcomes[1]!,
      ]),
    });
    const first = buildMarketOntologySnapshot(corpus([firstListing]));
    const changed = buildMarketOntologySnapshot(corpus([changedListing]));

    expect(changed.ontologyIdentity).not.toBe(first.ontologyIdentity);
    expect(changed.nodes[0]?.worldFacet.facetId).toBe(first.nodes[0]?.worldFacet.facetId);
    expect(changed.nodes[0]?.settlementFacet.facetId).toBe(first.nodes[0]?.settlementFacet.facetId);
    expect(changed.nodes[0]?.tradedFacet.facetId).not.toBe(first.nodes[0]?.tradedFacet.facetId);
    expect(changed.nodes[0]?.tradedFacet.indicativePriceStrings[0]?.value).toBe(
      "500000000000000001",
    );
  });

  it("does not spend fuzzy-search budget on a single twice-seen name token", () => {
    const snapshot = buildMarketOntologySnapshot(corpus([
      listing({
        listingRef: "venue-a:lisa-cook",
        title: "Will Lisa Cook leave office in 2026?",
      }),
      listing({
        listingRef: "venue-a:lisa-demuth",
        title: "Will Lisa Demuth win the Minnesota governor election?",
      }),
    ]));

    expect(snapshot.clusters.some((item) => item.subjectSignal === "lisa")).toBe(true);
    expect(snapshot.trailheads).toHaveLength(0);
  });

  it("fails closed when authority or content identity is tampered", () => {
    const snapshot = buildMarketOntologySnapshot(corpus([
      listing({ listingRef: "venue-a:left", title: "Will Alice win the 2026 election?" }),
      listing({ listingRef: "venue-b:right", title: "Will Alice leave office in 2026?" }),
    ]));
    expect(() => assertMarketOntologySnapshot({
      ...snapshot,
      probabilityAuthority: true,
    })).toThrow(/bounded authority/);
    expect(() => assertMarketOntologySnapshot({
      ...snapshot,
      ontologyIdentity: hashCanonical({ forged: true }),
    })).toThrow(/bounded authority/);
  });

  it("admits the bounded live-source ceiling above five thousand listings", () => {
    const listings = Array.from({ length: 5_004 }, (_, index) => listing({
      listingRef: `venue-a:bounded-${index}`,
      title: `Bounded proposition ${index}`,
    }));
    expect(buildMarketOntologySnapshot(corpus(listings))).toMatchObject({
      listingCount: 5_004,
      authority: "DERIVED_SEARCH_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
    });
  });
});
