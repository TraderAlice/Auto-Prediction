import { hashCanonical } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adaptMarketOntologyWorldProposition,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceRequirements,
  compileSettlementProjections,
  EvidenceDocumentFetcher,
  settlementVenuePolicyEvidenceFromCaptures,
  type DiscoveryCatalogListing,
  type MarketOntologyWorldPropositionProposal,
  SqliteOperationalStore,
} from "../src/index.js";

const at = "2026-08-14T00:00:00.000Z";
const hash = (label: string) => hashCanonical({ label });

function listing(overrides: Partial<DiscoveryCatalogListing> = {}): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef: "fixture:cola", venueId: "fixture", venueInstrumentId: "cola",
    title: "Will Donald Trump drink cola on a livestream?", description: "Fixture.",
    status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK", closesAt: null,
    rulesText: "Resolves Yes if Donald Trump drinks cola on a livestream. Otherwise resolves No.",
    rulesTextPosture: "COMPLETE", rulesTextSourceCharacterCount: 80,
    outcomes: [{ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" },
      { venueOutcomeId: "no", label: "No", indicativePrice: "0.6" }],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "1000",
    sourceKind: "VERIFIED_FIXTURE", sourceReceivedAt: at,
    sourceRawHash: hash("raw"), protocolIdentity: "fixture:v1", ...overrides,
  });
}

function fixture(overrides: Partial<DiscoveryCatalogListing> = {}) {
  const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set"),
    eligibleSourceCount: 1, excludedSourceCount: 0, listings: [listing(overrides)] });
  const ontology = buildMarketOntologySnapshot(corpus);
  const node = ontology.nodes[0]!;
  const proposal = {
    schemaVersion: "pmh.market-ontology-agent-proposal.v1", kind: "WORLD_PROPOSITION",
    proposalId: hash("proposal"), ontologyIdentity: ontology.ontologyIdentity,
    sourceSnapshotIdentity: corpus.snapshotIdentity, sourceAgentRunId: hash("run"),
    sourceTrailheadIds: [hash("trailhead")], sourceRelationPatternIds: [hash("pattern")],
    listingBindings: [{ listingRef: node.listingRef, nodeId: node.nodeId,
      worldFacetId: node.worldFacet.facetId, settlementFacetId: node.settlementFacet.facetId,
      tradedFacetId: node.tradedFacet.facetId }],
    label: "Trump drinks cola on a livestream", subjectLabels: ["Donald Trump"],
    predicate: "drinks cola on a livestream", timeScope: null, parameters: [],
    ambiguityNotes: [], falsifiers: ["The drink is not cola."], rationale: "Fixture.",
    proposedAt: at, authority: "PROPOSE_ONLY", reviewStatus: "UNREVIEWED",
    semanticDecisionAuthority: false, probabilityAuthority: false, certificateAuthority: false,
    executionAuthority: false, externalWriteAuthority: false, valueMovingAuthority: false,
  } as const satisfies MarketOntologyWorldPropositionProposal;
  return { corpus, ontology, predicate: adaptMarketOntologyWorldProposition({ proposal, ontology }) };
}

describe("first-party settlement projection compiler", () => {
  it("admits an explicit complete binary iff mapping", () => {
    const input = fixture();
    const result = compileSettlementProjections({ ...input, predicates: [input.predicate] });
    expect(result.predicates[0]).toMatchObject({
      predicateId: input.predicate.predicateId,
      epistemicPosture: "SETTLEMENT_BOUND_PREDICATE",
      observability: "RULE_DEFINED",
    });
    expect(result.projections[0]).toMatchObject({
      mappingPosture: "TOTAL_EXACT", compilerAdmission: "EXACT_BINARY_ELIGIBLE",
      truthStates: [{ stateId: "F", listingTruth: false, disposition: "RESOLVES" },
        { stateId: "T", listingTruth: true, disposition: "RESOLVES" }],
    });
    expect(result.observations[0]).toMatchObject({
      disposition: "EXACT_PROJECTED", blockers: [],
      semanticDecisionAuthority: false, certificateAuthority: false,
    });
  });

  it("retains a research-only projection when a void override exists", () => {
    const rulesText = "Resolves Yes if Donald Trump drinks cola on a livestream. Otherwise resolves No. The venue may void this market at its sole discretion.";
    const input = fixture({
      rulesText,
      rulesTextSourceCharacterCount: rulesText.length,
    });
    const result = compileSettlementProjections({ ...input, predicates: [input.predicate] });
    expect(result.predicates[0]?.epistemicPosture).toBe("EVIDENCE_BOUND_PROPOSITION");
    expect(result.projections[0]).toMatchObject({
      mappingPosture: "VOIDABLE_OVERRIDE", compilerAdmission: "RESEARCH_ONLY",
    });
    expect(result.observations[0]).toMatchObject({
      disposition: "RESEARCH_ONLY_PROJECTED",
      blockers: ["VOID_REFUND_OR_DISCRETION_OVERRIDE"],
    });
  });

  it("binds retained venue-wide settlement discretion through the listing locator", async () => {
    const venueRuleUrl = "https://rules.example.com/current-rulebook.txt";
    const locator = buildDiscoveryEvidenceLocator({
      venueId: "fixture", protocolIdentity: "fixture:v1",
      role: "VENUE_RULE_DOCUMENT", url: venueRuleUrl,
    });
    if (locator === null) throw new Error("missing fixture venue rule locator");
    const input = fixture({ evidenceLocators: [locator] });
    const requirementListings = [
      input.corpus.listings[0]!,
      listing({ listingRef: "fixture:cola-peer", venueInstrumentId: "cola-peer" }),
    ];
    const requirement = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW", proposalId: hash("venue-policy-proposal"),
      proposalListingRefs: requirementListings.map((item) => item.listingRef),
      listings: requirementListings,
      drafts: [{
        kind: "VENUE_POLICY",
        listingRefs: [input.corpus.listings[0]!.listingRef],
        claim: "The venue retains final settlement discretion.",
        reason: "Venue-wide review authority changes the world-to-settlement mapping.",
        satisfyingObservation: "The official rulebook grants settlement discretion.",
        contradictingObservation: "The rulebook makes settlement mechanically exhaustive.",
        temporalPosture: "CURRENT",
      }],
    })[0]!;
    const capture = await new EvidenceDocumentFetcher({
      policies: [buildEvidenceDocumentFetchPolicy({
        venueId: "fixture", protocolIdentity: "fixture:v1",
        role: "VENUE_RULE_DOCUMENT", allowedHostnames: ["rules.example.com"],
        allowedContentTypes: ["text/plain"],
      })],
      fetch: async () => new Response(
        "Prior to Settlement, the Company may at its sole discretion undertake a review process. The Company has full discretion in reviewing markets and determines the final outcome.",
        { status: 200, headers: { "content-type": "text/plain" } },
      ),
      resolve: async () => [{ address: "8.8.8.8", family: 4 as const }],
      now: () => Date.parse(at),
    }).capture({ requirement, locatorIdentity: locator.locatorIdentity });
    const venuePolicyEvidence = settlementVenuePolicyEvidenceFromCaptures([capture]);
    const result = compileSettlementProjections({
      ...input, predicates: [input.predicate], venuePolicyEvidence,
    });

    expect(venuePolicyEvidence[0]).toMatchObject({
      venueId: "fixture", protocolIdentity: "fixture:v1",
      locatorIdentity: locator.locatorIdentity,
      authority: "RETAINED_FIRST_PARTY_DOCUMENT_EXTRACTION",
      semanticDecisionAuthority: false,
    });
    expect(result.projections[0]).toMatchObject({
      mappingPosture: "VOIDABLE_OVERRIDE", compilerAdmission: "RESEARCH_ONLY",
    });
    expect(result.projections[0]?.truthStates.every((state) =>
      state.ruleEvidenceHashes.includes(capture.extraction.record.textHash))).toBe(true);
    expect(result.observations[0]).toMatchObject({
      disposition: "RESEARCH_ONLY_PROJECTED",
      blockers: ["VOID_REFUND_OR_DISCRETION_OVERRIDE"],
    });

    const unbound = fixture();
    expect(compileSettlementProjections({
      ...unbound, predicates: [unbound.predicate], venuePolicyEvidence,
    }).projections[0]?.mappingPosture).toBe("TOTAL_EXACT");
  });

  it("records exact ambiguity debt instead of choosing between two predicates", () => {
    const input = fixture();
    const second = { ...input.predicate,
      artifactHash: hashCanonical({ duplicateRevision: input.predicate.artifactHash }) };
    // Same semantic predicate ID with a different artifact revision is a single
    // predicate; a distinct semantic proposition bound to the same listing is not.
    const different = adaptMarketOntologyWorldProposition({
      ontology: input.ontology,
      proposal: {
        schemaVersion: "pmh.market-ontology-agent-proposal.v1", kind: "WORLD_PROPOSITION",
        proposalId: hash("proposal-2"), ontologyIdentity: input.ontology.ontologyIdentity,
        sourceSnapshotIdentity: input.corpus.snapshotIdentity, sourceAgentRunId: hash("run-2"),
        sourceTrailheadIds: [hash("trailhead")], sourceRelationPatternIds: [hash("pattern")],
        listingBindings: [{ listingRef: input.ontology.nodes[0]!.listingRef,
          nodeId: input.ontology.nodes[0]!.nodeId,
          worldFacetId: input.ontology.nodes[0]!.worldFacet.facetId,
          settlementFacetId: input.ontology.nodes[0]!.settlementFacet.facetId,
          tradedFacetId: input.ontology.nodes[0]!.tradedFacet.facetId }],
        label: "Trump drinks a beverage", subjectLabels: ["Donald Trump"],
        predicate: "drinks a beverage", timeScope: null, parameters: [], ambiguityNotes: [],
        falsifiers: [], rationale: "Broader fixture.", proposedAt: at,
        authority: "PROPOSE_ONLY", reviewStatus: "UNREVIEWED",
        semanticDecisionAuthority: false, probabilityAuthority: false,
        certificateAuthority: false, executionAuthority: false,
        externalWriteAuthority: false, valueMovingAuthority: false,
      },
    });
    expect(second.predicateId).toBe(input.predicate.predicateId);
    const result = compileSettlementProjections({ ...input,
      predicates: [input.predicate, second, different] });
    expect(result.projections).toEqual([]);
    expect(result.observations[0]).toMatchObject({
      disposition: "BLOCKED", blockers: ["MULTIPLE_PREDICATES_FOR_LISTING"],
    });
  });

  it("replays content-addressed settlement debt across SQLite restart", async () => {
    const rulesText = "Resolves Yes if Donald Trump drinks cola on a livestream.";
    const input = fixture({
      rulesText,
      rulesTextSourceCharacterCount: rulesText.length,
    });
    const result = compileSettlementProjections({ ...input, predicates: [input.predicate] });
    const directory = await mkdtemp(join(tmpdir(), "pmh-settlement-observation-"));
    const path = join(directory, "control-plane.sqlite");
    let store = new SqliteOperationalStore(path);
    try {
      expect(store.saveSettlementProjectionObservations(result.observations))
        .toEqual(result.observations);
      expect(store.settlementProjectionObservationStorage).toMatchObject({
        durable: true, schemaVersion: 63, idempotencyKey: "artifactHash",
      });
      store.close();
      store = new SqliteOperationalStore(path);
      expect(store.loadSettlementProjectionObservations(10)).toEqual(result.observations);
    } finally {
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
