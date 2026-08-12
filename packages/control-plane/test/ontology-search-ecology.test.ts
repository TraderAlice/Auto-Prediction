import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertOntologySearchIssueRevision,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildOntologySearchYieldProjection,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  SqliteOperationalStore,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const RECEIVED_AT = "2026-08-12T09:00:00.000Z";

function listing(listingRef: string, title: string): DiscoveryCatalogListing {
  const venueId = listingRef.split(":")[0]!;
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":")[1]!,
    title,
    description: title,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2028-12-31T00:00:00.000Z",
    rulesText: null,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "400000000000000000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "600000000000000000" }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: RECEIVED_AT,
    sourceRawHash: hashCanonical({ listingRef, title }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-ecology-test" }),
    eligibleSourceCount: 3,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic presidential nomination?"),
      listing("venue-c:alice", "Will Alice Johnson win the 2028 governor election?"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  return { corpus, ontology };
}

describe("ontology search ecology", () => {
  it("materializes durable task payloads without authorizing a run or campaign", () => {
    const { corpus, ontology } = fixture();
    const first = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    });
    const replay = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    });

    expect(first.length).toBeGreaterThan(0);
    expect(replay).toEqual(first);
    expect(assertOntologySearchIssueRevision(first[0])).toBe(first[0]);
    expect(first[0]).toMatchObject({
      coverageState: "UNEXPLORED",
      campaignEligible: true,
      automaticDispatch: false,
      authority: "SEARCH_WORK_ASSIGNMENT_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
      task: {
        kind: "ONTOLOGY_NORMALIZATION",
        authority: {
          modelInvocations: false,
          externalWrites: false,
          semanticDecision: false,
          certificatePublication: false,
          valueMovingActions: false,
        },
      },
    });
    expect(first[0]?.taskPayload.listingEvidence.length).toBeGreaterThanOrEqual(2);
    expect(first[0]?.taskPayload.listingEvidence[0]).toMatchObject({
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
      sourceRawHash: expect.stringMatching(/^sha256:/u),
      node: {
        worldFacet: { semanticDecisionAuthority: false },
        settlementFacet: { certificateAuthority: false },
      },
    });
    expect(first.map((item) => `${item.selectionLane}:${item.relationPatternId}`).sort())
      .toEqual([...new Set(ontology.trailheads.map((item) =>
        `${item.selectionLane}:${item.relationPatternId}`
      ))].sort());
  });

  it("projects zero-cost unexplored work honestly before any campaign runs", () => {
    const { corpus, ontology } = fixture();
    const revisions = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    });
    const projection = buildOntologySearchYieldProjection({
      revisions,
      proposals: [],
      execution: emptyAgentExecutionSnapshot(),
    });

    expect(projection).toMatchObject({
      issueCount: revisions.length,
      campaignEligibleIssueCount: revisions.length,
      attemptedIssueCount: 0,
      runCount: 0,
      modelInvocationCount: 0,
      acceptedToolEffectCount: 0,
      rejectedToolEffectCount: 0,
      usage: {
        knownInputTokens: "0",
        knownOutputTokens: "0",
        knownReasoningTokens: "0",
        unknownInputInvocationCount: 0,
        unknownOutputInvocationCount: 0,
        unknownReasoningInvocationCount: 0,
      },
      downstreamOpportunityAttribution: "NOT_YET_CONNECTED",
      authority: "DERIVED_RESEARCH_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        providerRequests: false,
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.projectionIdentity).toMatch(/^sha256:/u);
  });

  it("fails closed if automatic dispatch or the task payload is altered", () => {
    const { corpus, ontology } = fixture();
    const revision = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    })[0]!;
    expect(() => assertOntologySearchIssueRevision({
      ...revision,
      automaticDispatch: true,
    })).toThrow(/(?:bounded|evidence) contract/iu);
    expect(() => assertOntologySearchIssueRevision({
      ...revision,
      taskPayload: { ...revision.taskPayload, trailheadIds: [] },
    })).toThrow(/(?:bounded|evidence) contract/iu);
  });

  it("persists exact task payload revisions after retaining provider-neutral tasks", () => {
    const { corpus, ontology } = fixture();
    const revisions = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    });
    const store = new SqliteOperationalStore(":memory:");
    store.saveAgentExecutionBatch({ tasks: revisions.map((item) => item.task) });

    expect(store.saveOntologySearchIssueRevisions(revisions)).toEqual(revisions);
    expect(store.saveOntologySearchIssueRevisions(revisions)).toEqual(revisions);
    expect(store.loadOntologySearchIssueRevisions(100)).toEqual(
      [...revisions].sort((left, right) =>
        right.materializedAt.localeCompare(left.materializedAt) ||
        right.revisionId.localeCompare(left.revisionId)
      ),
    );
    expect(store.ontologySearchIssueRevisionStorage).toMatchObject({
      durable: false,
      schemaVersion: 39,
      idempotencyKey: "revisionId",
    });
    store.close();
  });
});
