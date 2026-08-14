import { hashBytes, hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildWorldPredicateArtifact,
  buildWorldRelationEntityRoleAssertion,
  buildWorldRelationEntityRoleRequirements,
  buildWorldRelationEntityRoleSourceDocument,
  compileIowaGeneralElectionEntityRoleAssertions,
  compileWorldRelationProjectionCoverage,
  type DiscoveryCatalogListing,
  type WorldRelationFrontierSeed,
} from "../src/index.js";

const at = "2026-08-14T00:00:00.000Z";
const hash = (label: string) => hashCanonical({ label });

function listing(): DiscoveryCatalogListing {
  const rulesText = "If Josh Turek wins the 2026 U.S. Senate election in Iowa, then this market resolves to Yes.";
  return Object.freeze({ listingRef: "gemini-predictions:GEMI-SEN26IA-JOSHTUREK",
    venueId: "gemini-predictions", venueInstrumentId: "GEMI-SEN26IA-JOSHTUREK",
    title: "Iowa US Senate Winner — Josh Turek",
    description: "Who will win the 2026 U.S. Senate election in Iowa?",
    status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK", closesAt: null,
    rulesText, rulesTextPosture: "COMPLETE", rulesTextSourceCharacterCount: rulesText.length,
    outcomes: [{ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.52" },
      { venueOutcomeId: "no", label: "No", indicativePrice: "0.49" }],
    priceScale: "100000000", quantityScale: "1000000", minPriceTick: "1000",
    sourceKind: "VERIFIED_FIXTURE", sourceReceivedAt: at,
    sourceRawHash: hash("listing"), protocolIdentity: "gemini:test" });
}

function frontier(): WorldRelationFrontierSeed {
  const predicate = buildWorldPredicateArtifact({ semantic: {
    operatorKind: "MEMBERSHIP_OR_SELECTION",
    subjects: [{ canonicalLabel: "Democratic Party", entityType: "ORGANIZATION" }],
    verbPhrase: "Iowa Senate Election Winner — Democratic Party",
    timeScope: { startsAt: null, endsAt: null, precision: "UNRESOLVED" },
    parameters: [], polarity: "POSITIVE" }, observability: "DERIVED",
    epistemicPosture: "EVIDENCE_BOUND_PROPOSITION",
    evidenceBindings: [{ listingRef: "source:party", nodeId: hash("node"),
      worldFacetId: hash("facet"), sourceRawHash: hash("raw"),
      protocolIdentity: "source:test" }], ambiguityNotes: [], counterworlds: [],
    source: { sourceOntologyIdentities: [hash("ontology")],
      sourceSnapshotIdentities: [hash("snapshot")], sourceAgentRunIds: [hash("run")],
      sourceToolEffectIds: [] }, proposedAt: at });
  const body = { schemaVersion: "pmh.world-relation-frontier-seed.v1" as const,
    frontierId: hash("frontier"), predicates: [predicate],
    relationKind: "COMMON_CAUSE_DEPENDENCE" as const,
    antecedentPredicateIds: [predicate.predicateId], consequentPredicateIds: [],
    latentPredicateIds: [], temporalPosture: "OVERLAPPING_INTERVALS" as const,
    searchNeighborhoods: ["Iowa Senate"], counterworlds: [], rationale: "fixture",
    sourceMechanismProposalId: hash("mechanism"), sourceAgentRunId: hash("run"),
    disposition: "UNTESTED_RELATION_FRONTIER" as const,
    authority: "RELATION_EXPERIMENT_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

describe("world relation entity-role evidence", () => {
  it("turns a conservative role gap into an exact independent evidence requirement", () => {
    const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set"),
      eligibleSourceCount: 1, excludedSourceCount: 0, listings: [listing()] });
    const relation = frontier();
    const coverage = compileWorldRelationProjectionCoverage({ frontier: relation, corpus,
      inspectedListingRefs: [listing().listingRef], existingProjections: [] });
    const [requirement] = buildWorldRelationEntityRoleRequirements({ frontier: relation,
      corpus, coverageObservations: coverage.observations });
    expect(requirement).toMatchObject({ entityLabel: "Josh Turek",
      organizationLabel: "Democratic Party",
      roleKind: "GENERAL_ELECTION_CANDIDATE_OF_ORGANIZATION",
      listingRef: listing().listingRef, status: "EVIDENCE_REQUIRED",
      semanticDecisionAuthority: false });

    const excerpt = "United States Senator | Democratic Party | Josh Turek";
    const document = buildWorldRelationEntityRoleSourceDocument({
      url: "https://sos.iowa.gov/candidates.pdf", publisher: "Iowa Secretary of State",
      contentType: "application/pdf", bytes: new TextEncoder().encode("fixture pdf"),
      text: `Candidate List 2026\n${excerpt}`, receivedAt: at,
      extractorIdentity: hash("extractor"),
    });
    const assertion = buildWorldRelationEntityRoleAssertion({ requirement: requirement!,
      document, source: { url: document.record.url,
        publisher: document.record.publisher, documentId: document.record.documentId,
        rawHash: document.record.rawHash, textHash: document.record.textHash, receivedAt: at },
      evidenceExcerpt: excerpt, disposition: "SUPPORTED", assertedAt: at });
    expect(assertion).toMatchObject({ requirementId: requirement?.requirementId,
      entityLabel: "Josh Turek", organizationLabel: "Democratic Party",
      disposition: "SUPPORTED", evidenceExcerptHash: hashBytes(new TextEncoder().encode(excerpt)),
      authority: "INDEPENDENT_ENTITY_ROLE_EVIDENCE_ONLY" });
  });

  it("refuses a supported assertion that omits the organization", () => {
    const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set"),
      eligibleSourceCount: 1, excludedSourceCount: 0, listings: [listing()] });
    const relation = frontier();
    const coverage = compileWorldRelationProjectionCoverage({ frontier: relation, corpus,
      inspectedListingRefs: [listing().listingRef], existingProjections: [] });
    const [requirement] = buildWorldRelationEntityRoleRequirements({ frontier: relation,
      corpus, coverageObservations: coverage.observations });
    expect(() => buildWorldRelationEntityRoleAssertion({ requirement: requirement!,
      source: { url: "https://sos.iowa.gov/candidates.pdf",
        publisher: "Iowa Secretary of State", documentId: hash("document"),
        rawHash: hash("document-raw"), textHash: hash("document-text"), receivedAt: at },
      evidenceExcerpt: "Josh Turek filed for the election.", disposition: "SUPPORTED",
      assertedAt: at })).toThrow(/lacks exact entity or organization/u);
  });

  it("compiles supported, contradicted, and unresolved roles from the scoped official list", () => {
    const entities = ["Ashley Hinson", "Josh Turek", "Nathan Sage"] as const;
    const listings = entities.map((entity) => Object.freeze({ ...listing(),
      listingRef: `gemini-predictions:${entity.replaceAll(" ", "").toUpperCase()}`,
      venueInstrumentId: entity.replaceAll(" ", "").toUpperCase(),
      title: `Iowa US Senate Winner — ${entity}`,
      sourceRawHash: hash(`listing:${entity}`) }));
    const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set:all"),
      eligibleSourceCount: 1, excludedSourceCount: 0, listings });
    const relation = frontier();
    const coverage = compileWorldRelationProjectionCoverage({ frontier: relation, corpus,
      inspectedListingRefs: listings.map((item) => item.listingRef),
      existingProjections: [] });
    const requirements = buildWorldRelationEntityRoleRequirements({ frontier: relation,
      corpus, coverageObservations: coverage.observations });
    const officialText = [
      "Candidate List November 3, 2026 General Election",
      "United States Senator Republican Ashley Hinson Democratic Josh Turek Libertarian Thomas Laehn",
      "United States Representative District 1 Republican Fixture Person",
    ].join("\n");
    const document = buildWorldRelationEntityRoleSourceDocument({
      url: "https://sos.iowa.gov/sites/default/files/2026-07/candidates.pdf",
      publisher: "Iowa Secretary of State", contentType: "application/pdf",
      bytes: new TextEncoder().encode("fixture pdf"), text: officialText,
      receivedAt: at, extractorIdentity: hash("extractor"),
    });
    const assertions = compileIowaGeneralElectionEntityRoleAssertions({ document,
      requirements });
    expect(Object.fromEntries(assertions.map((item) =>
      [item.entityLabel, item.disposition]))).toEqual({
      "Ashley Hinson": "CONTRADICTED",
      "Josh Turek": "SUPPORTED",
      "Nathan Sage": "INCONCLUSIVE",
    });
    expect(assertions.every((item) => item.source.documentId ===
      document.record.documentId)).toBe(true);
  });
});
