import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildWorldPredicateArtifact,
  compileWorldRelationProjectionCoverage,
  type DiscoveryCatalogListing,
  type WorldRelationFrontierSeed,
} from "../src/index.js";

const at = "2026-08-14T00:00:00.000Z";
const hash = (label: string) => hashCanonical({ label });

function listing(ref: string, title: string, rulesText: string): DiscoveryCatalogListing {
  return Object.freeze({ listingRef: ref, venueId: "gemini-predictions",
    venueInstrumentId: ref.split(":")[1]!, title,
    description: title, status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: null, rulesText, rulesTextPosture: "COMPLETE",
    rulesTextSourceCharacterCount: rulesText.length,
    outcomes: [{ venueOutcomeId: `${ref}:yes`, label: "Yes", indicativePrice: "0.47" },
      { venueOutcomeId: `${ref}:no`, label: "No", indicativePrice: "0.54" }],
    priceScale: "100000000", quantityScale: "1000000", minPriceTick: "1000",
    sourceKind: "VERIFIED_FIXTURE", sourceReceivedAt: at,
    sourceRawHash: hash("gemini-raw"), protocolIdentity: "prediction-markets-v1:test" });
}

describe("world relation projection coverage", () => {
  it("binds exact party/event text but refuses to infer a candidate party role", () => {
    const democraticControl = listing("gemini:control-dem",
      "Which party will win the U.S. Senate? — Democratic Party",
      "This contract resolves to Yes if the Democratic Party controls the U.S. Senate following the 2026 United States midterm elections and to No otherwise.");
    const republicanControl = listing("gemini:control-gop",
      "Which party will win the U.S. Senate? — Republican Party",
      "This contract resolves to Yes if the Republican Party controls the U.S. Senate following the 2026 United States midterm elections and to No otherwise.");
    const candidate = listing("gemini:iowa-josh",
      "Iowa US Senate Winner — Josh Turek",
      "If Josh Turek wins the 2026 U.S. Senate election in Iowa, then this market resolves to Yes.");
    const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("sources"),
      eligibleSourceCount: 1, excludedSourceCount: 0,
      listings: [democraticControl, republicanControl, candidate] });
    const predicate = (verbPhrase: string) => buildWorldPredicateArtifact({
      semantic: { operatorKind: "MEMBERSHIP_OR_SELECTION",
        subjects: [{ canonicalLabel: "Democratic Party", entityType: "ORGANIZATION" }],
        verbPhrase, timeScope: { startsAt: null, endsAt: null,
          precision: "UNRESOLVED" }, parameters: [], polarity: "POSITIVE" },
      observability: "DERIVED", epistemicPosture: "EVIDENCE_BOUND_PROPOSITION",
      evidenceBindings: [{ listingRef: `source:${verbPhrase}`, nodeId: hash(`${verbPhrase}:node`),
        worldFacetId: hash(`${verbPhrase}:world`), sourceRawHash: hash(`${verbPhrase}:raw`),
        protocolIdentity: "source:test" }], ambiguityNotes: [], counterworlds: [],
      source: { sourceOntologyIdentities: [hash("ontology")],
        sourceSnapshotIdentities: [hash("snapshot")], sourceAgentRunIds: [hash("run")],
        sourceToolEffectIds: [] }, proposedAt: at,
    });
    const iowa = predicate("Iowa Senate Election Winner — Democratic Party");
    const control = predicate("U.S Senate Midterm Winner — Democratic Party");
    const frontierBody = { schemaVersion: "pmh.world-relation-frontier-seed.v1" as const,
      frontierId: hash("frontier"), predicates: [iowa, control],
      relationKind: "COMMON_CAUSE_DEPENDENCE" as const,
      antecedentPredicateIds: [iowa.predicateId], consequentPredicateIds: [control.predicateId],
      latentPredicateIds: [], temporalPosture: "OVERLAPPING_INTERVALS" as const,
      searchNeighborhoods: ["Iowa Senate"], counterworlds: [], rationale: "fixture",
      sourceMechanismProposalId: hash("mechanism"), sourceAgentRunId: hash("run"),
      disposition: "UNTESTED_RELATION_FRONTIER" as const,
      authority: "RELATION_EXPERIMENT_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
      certificateAuthority: false as const, executionAuthority: false as const,
      externalWriteAuthority: false as const, valueMovingAuthority: false as const };
    const frontier = Object.freeze({ ...frontierBody,
      artifactHash: hashCanonical(frontierBody) }) satisfies WorldRelationFrontierSeed;
    const result = compileWorldRelationProjectionCoverage({ frontier, corpus,
      inspectedListingRefs: corpus.listings.map((item) => item.listingRef),
      existingProjections: [] });

    expect(result.observations.map((item) => [item.listingRef, item.disposition])).toEqual([
      ["gemini:control-dem", "TEXT_GROUNDED_PREDICATE_BOUND"],
      ["gemini:control-gop", "OPPOSING_SUBJECT"],
      ["gemini:iowa-josh", "ENTITY_ROLE_EVIDENCE_REQUIRED"],
    ]);
    expect(result.predicates).toHaveLength(1);
    expect(result.predicates[0]?.predicateId).toBe(control.predicateId);
    expect(result.projections).toHaveLength(1);
    expect(result.projections[0]).toMatchObject({
      listing: { listingRef: "gemini:control-dem" },
      predicateIds: [control.predicateId],
    });
    expect(result.projections[0]?.compilerAdmission).toBe("RESEARCH_ONLY");
    expect(result.settlement.observations[0]?.blockers).toContain(
      "MISSING_NEGATIVE_RESOLUTION_CLAUSE",
    );
  });
});
