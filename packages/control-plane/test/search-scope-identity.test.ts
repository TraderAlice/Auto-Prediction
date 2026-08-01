import { describe, expect, it } from "vitest";
import {
  buildSearchScopeIdentity,
  type DiscoveryCatalogListing,
} from "../src/index.js";

function listing(overrides: Partial<DiscoveryCatalogListing> = {}): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef: "venue-a:event",
    venueId: "venue-a",
    venueInstrumentId: "event",
    title: "Will the event happen?",
    description: "A bounded event.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "Resolves Yes if the event happens.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.6" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: `sha256:${"a".repeat(64)}`,
    protocolIdentity: "venue-a:v1",
    ...overrides,
  });
}

describe("search scope identity", () => {
  it("keeps semantics stable across receive/source/price changes but reroutes price changes", () => {
    const first = buildSearchScopeIdentity([listing()]);
    const refreshed = buildSearchScopeIdentity([listing({
      sourceReceivedAt: "2026-08-01T00:05:00.000Z",
      sourceRawHash: `sha256:${"b".repeat(64)}`,
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.3" }),
        Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.7" }),
      ]),
    })]);

    expect(refreshed.semanticScopeIdentity).toBe(first.semanticScopeIdentity);
    expect(refreshed.routingScopeIdentity).not.toBe(first.routingScopeIdentity);
    expect(first).toMatchObject({
      kind: "BOUNDED_CONTEXT",
      priceIndependentSemanticIdentity: true,
      authority: "SEARCH_ROUTING_ONLY",
    });
  });

  it("collapses partial price motion until the missing price posture changes", () => {
    const incomplete = listing({
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" }),
        Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
      ]),
    });
    const movedAvailableLeg = listing({
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.7" }),
        Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
      ]),
    });
    const completed = listing({
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.7" }),
        Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.3" }),
      ]),
    });

    expect(buildSearchScopeIdentity([movedAvailableLeg]).routingScopeIdentity)
      .toBe(buildSearchScopeIdentity([incomplete]).routingScopeIdentity);
    expect(buildSearchScopeIdentity([completed]).routingScopeIdentity)
      .not.toBe(buildSearchScopeIdentity([incomplete]).routingScopeIdentity);
  });

  it("reroutes an exact pair only when its equivalent economic posture changes", () => {
    const second = (yes: string, no: string): DiscoveryCatalogListing => listing({
      listingRef: "venue-b:event",
      venueId: "venue-b",
      venueInstrumentId: "event",
      protocolIdentity: "venue-b:v1",
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: yes }),
        Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: no }),
      ]),
    });
    const repricedFirst = listing({
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.6" }),
        Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.4" }),
      ]),
    });
    const neutral = buildSearchScopeIdentity([listing(), second("0.4", "0.6")]);
    const stillNeutral = buildSearchScopeIdentity([repricedFirst, second("0.6", "0.4")]);
    const positive = buildSearchScopeIdentity([repricedFirst, second("0.7", "0.3")]);

    expect(stillNeutral.routingScopeIdentity).toBe(neutral.routingScopeIdentity);
    expect(positive.routingScopeIdentity).not.toBe(neutral.routingScopeIdentity);
    expect(positive.semanticScopeIdentity).toBe(neutral.semanticScopeIdentity);
  });

  it.each([
    ["rules", { rulesText: "Resolves Yes only after an official announcement." }],
    ["outcome label", { outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Up", indicativePrice: "0.4" }),
      Object.freeze({ venueOutcomeId: "no", label: "Down", indicativePrice: "0.6" }),
    ]) }],
    ["close", { closesAt: "2026-10-01T00:00:00.000Z" }],
    ["mechanism", { mechanism: "AMM" }],
    ["status", { status: "CLOSED" }],
    ["protocol", { protocolIdentity: "venue-a:v2" }],
  ] as const)("changes semantic identity when %s changes", (_label, overrides) => {
    expect(buildSearchScopeIdentity([listing(overrides)]).semanticScopeIdentity)
      .not.toBe(buildSearchScopeIdentity([listing()]).semanticScopeIdentity);
  });
});
