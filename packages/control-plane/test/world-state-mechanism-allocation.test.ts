import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildWorldStateMechanismAllocation,
  materializeOntologySearchIssueRevisions,
  materializeWorldStateMechanismResearchAssignments,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

function listing(listingRef: string, title: string): DiscoveryCatalogListing {
  const [venueId, venueInstrumentId] = listingRef.split(":") as [string, string];
  return Object.freeze({
    listingRef, venueId, venueInstrumentId, title, description: title,
    status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2028-12-31T00:00:00.000Z", rulesText: "Official resolution.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "4" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "6" }),
    ]),
    priceScale: "10", quantityScale: "10", minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION", sourceReceivedAt: NOW,
    sourceRawHash: hashCanonical({ listingRef, title }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ fixture: "mechanism-suitability" }),
    eligibleSourceCount: 3,
    excludedSourceCount: 0,
    listings: [
      listing("a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic nomination?"),
      listing("a:bitcoin-august", "Will Bitcoin exceed 100000 in August?"),
      listing("b:bitcoin-september", "Will Bitcoin exceed 100000 in September?"),
      listing("a:jon-jones", "Will Jon Jones win a UFC fight?"),
      listing("b:jon-ossoff", "Will Jon Ossoff win an election?"),
      listing("a:fear-index", "Fear and Greed Index at 29 or higher on August 14?"),
      listing("b:fear-choice", "Fear or Greed?"),
      listing("a:stephen-smith", "Will Stephen A. Smith win the 2028 Democratic presidential nomination?"),
      listing("b:will-smith", "National League MVP — Will Smith"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({ ontology, corpus, proposals: [] });
  const assignments = materializeWorldStateMechanismResearchAssignments({
    revisions, proposals: [], counterexamples: [], abstentions: [],
  });
  return { revisions, assignments };
}

describe("world-state mechanism suitability allocation", () => {
  it("selects predicate-divergent coherent subjects and retains structural noise as held evidence", () => {
    const work = fixture();
    const allocation = buildWorldStateMechanismAllocation(work);
    const byTitle = (needle: string) => allocation.actions.find((item) =>
      item.representativeTitleExcerpts.some((title) => title.includes(needle))
    )!;

    expect(byTitle("Mark Kelly")).toMatchObject({
      disposition: "SELECTED_FOR_MECHANISM_RESEARCH",
      structuralSuitability: "SUITABLE",
      positiveSignals: expect.arrayContaining([
        "MULTI_SIGNAL_SUBJECT", "WORLD_PREDICATE_DIVERGENCE",
      ]),
      hazards: [],
    });
    expect(byTitle("Bitcoin")).toMatchObject({
      disposition: "HELD_LOW_STRUCTURAL_SUITABILITY",
      hazards: expect.arrayContaining([
        "NO_WORLD_PREDICATE_DIVERGENCE", "SAME_EVENT_INTERVAL_PATTERN",
      ]),
    });
    expect(byTitle("Jon Jones")).toMatchObject({
      disposition: "HELD_LOW_STRUCTURAL_SUITABILITY",
      hazards: expect.arrayContaining(["SINGLE_SIGNAL_SUBJECT_AMBIGUITY"]),
    });
    expect(byTitle("Fear and Greed")).toMatchObject({
      disposition: "HELD_LOW_STRUCTURAL_SUITABILITY",
      hazards: expect.arrayContaining(["NO_DISTINCT_ROLE_LANGUAGE"]),
    });
    expect(byTitle("Stephen A. Smith")).toMatchObject({
      disposition: "HELD_LOW_STRUCTURAL_SUITABILITY",
      hazards: expect.arrayContaining(["SINGLE_SIGNAL_SUBJECT_AMBIGUITY"]),
    });
    expect(allocation).toMatchObject({
      eligibleCount: 6,
      structurallySuitableCount: 1,
      selectedCount: 1,
      heldLowSuitabilityCount: 5,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      executionAuthority: false,
      valueMovingAuthority: false,
    });
  });

  it("is permutation-invariant and binds campaign candidates to allocation actions", () => {
    const work = fixture();
    const first = buildWorldStateMechanismAllocation(work);
    const second = buildWorldStateMechanismAllocation({
      assignments: [...work.assignments].reverse(),
      revisions: [...work.revisions].reverse(),
    });
    expect(second).toEqual(first);
    expect(first.selectedActions.every((item) => item.actionId.startsWith("sha256:"))).toBe(true);
  });
});
