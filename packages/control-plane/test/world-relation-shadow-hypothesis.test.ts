import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildWorldPredicateArtifact,
  buildWorldRelationExperiment,
  buildWorldRelationExperimentAssignment,
  buildSettlementProjection,
  compileWorldRelationShadowTradeHypotheses,
  type SettlementProjection,
  type WorldRelationFrontierSeed,
} from "../src/index.js";

const at = "2026-08-14T00:00:00.000Z";
const hash = (label: string) => hashCanonical({ label });

function fixture(exact = true) {
  const predicate = (label: string) => buildWorldPredicateArtifact({
    semantic: { operatorKind: "OCCURRENCE",
      subjects: [{ canonicalLabel: "Republican Party", entityType: "ORGANIZATION" }],
      verbPhrase: label, timeScope: { startsAt: null, endsAt: null,
        precision: "UNRESOLVED" }, parameters: [], polarity: "POSITIVE" },
    observability: "DERIVED", epistemicPosture: "SETTLEMENT_BOUND_PREDICATE",
    evidenceBindings: [{ listingRef: `fixture:${label}`, nodeId: hash(`${label}:node`),
      worldFacetId: hash(`${label}:world`), sourceRawHash: hash("shared-raw"),
      protocolIdentity: "fixture:v1" }], ambiguityNotes: [], counterworlds: [],
    source: { sourceOntologyIdentities: [hash("ontology")],
      sourceSnapshotIdentities: [hash("snapshot")], sourceAgentRunIds: [hash("run")],
      sourceToolEffectIds: [] }, proposedAt: at,
  });
  const alaska = predicate("wins Alaska");
  const national = predicate("controls Senate");
  const frontierBody = { schemaVersion: "pmh.world-relation-frontier-seed.v1" as const,
    frontierId: hash("frontier"), predicates: [alaska, national],
    relationKind: "COMMON_CAUSE_DEPENDENCE" as const,
    antecedentPredicateIds: [alaska.predicateId], consequentPredicateIds: [national.predicateId],
    latentPredicateIds: [], temporalPosture: "OVERLAPPING_INTERVALS" as const,
    searchNeighborhoods: ["Alaska Senate"], counterworlds: ["Alaska true, national false"],
    rationale: "Partisan conditions may affect both.", sourceMechanismProposalId: hash("m"),
    sourceAgentRunId: hash("run"), disposition: "UNTESTED_RELATION_FRONTIER" as const,
    authority: "RELATION_EXPERIMENT_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const };
  const frontier = Object.freeze({ ...frontierBody,
    artifactHash: hashCanonical(frontierBody) }) satisfies WorldRelationFrontierSeed;
  const listing = (listingRef: string, yes: string, no: string) => ({
    listingRef, venueId: "fixture", venueInstrumentId: listingRef, title: listingRef,
    description: "fixture", status: "OPEN" as const,
    mechanism: "CENTRALIZED_ORDER_BOOK" as const, closesAt: null,
    rulesText: "Resolves Yes if the named event occurs; otherwise No.",
    rulesTextPosture: "COMPLETE" as const, rulesTextSourceCharacterCount: 53,
    outcomes: [{ venueOutcomeId: "yes", label: "Yes", indicativePrice: yes },
      { venueOutcomeId: "no", label: "No", indicativePrice: no }],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "1000",
    sourceKind: "VERIFIED_FIXTURE" as const, sourceReceivedAt: at,
    sourceRawHash: hash("shared-raw"), protocolIdentity: "fixture:v1",
  });
  const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set"),
    eligibleSourceCount: 1, excludedSourceCount: 0,
    listings: [listing("fixture:alaska", "0.47", "0.54"),
      listing("fixture:national", "0.507", "0.494")] });
  const projection = (predicateArtifact: typeof alaska, listingRef: string): SettlementProjection => {
    const predicateId = predicateArtifact.predicateId;
    return buildSettlementProjection({
      listing: { listingRef, listingHash: hash(`${listingRef}:listing`), venueId: "fixture",
        venueInstrumentId: listingRef, protocolIdentity: "fixture:v1",
        sourceRawHash: hash("shared-raw"), sourceReceivedAt: at },
      predicateArtifacts: [predicateArtifact], predicateIds: [predicateId],
      truthStates: [{ stateId: "F", truthByPredicateId: { [predicateId]: false },
        listingTruth: exact ? false : null, disposition: exact ? "RESOLVES" as const :
          "UNRESOLVED" as const, rationale: "fixture", ruleEvidenceHashes: [hash("rule")] },
      { stateId: "T", truthByPredicateId: { [predicateId]: true },
        listingTruth: exact ? true : null, disposition: exact ? "RESOLVES" as const :
          "UNRESOLVED" as const, rationale: "fixture", ruleEvidenceHashes: [hash("rule")] }],
      mappingPosture: exact ? "TOTAL_EXACT" as const : "VOIDABLE_OVERRIDE" as const,
      ambiguityNotes: exact ? [] : ["venue discretion"],
      sourceAgentRunIds: [hash("run")], sourceToolEffectIds: [], observedAt: at,
    });
  };
  const projections = [projection(alaska, "fixture:alaska"),
    projection(national, "fixture:national")];
  const assignment = buildWorldRelationExperimentAssignment({ frontier, corpus, projections });
  const experiment = buildWorldRelationExperiment({ relationKind: "COMMON_CAUSE_DEPENDENCE",
    predicateArtifacts: [alaska, national], antecedentPredicateIds: [alaska.predicateId],
    consequentPredicateIds: [national.predicateId], latentPredicateIds: [],
    temporalPosture: "OVERLAPPING_INTERVALS", adverseAssignments: [{
      truthByPredicateId: { [alaska.predicateId]: true, [national.predicateId]: false },
      rationale: "Alaska win coexists with losing national control." }],
    searchNeighborhoods: ["Alaska Senate"], inspectedProjectionIds: projections.map((x) =>
      x.projectionId), counterworlds: [{ description: "The adverse world survives.",
      truthByPredicateId: { [alaska.predicateId]: true, [national.predicateId]: false },
      result: "SURVIVES", evidenceBindingHashes: [hash("shared-raw")] }],
    terminalDisposition: "SUPPORTED_PROBABILISTIC", rationale: "Soft dependence only.",
    sourceAgentRunId: hash("experiment-run"), sourceToolEffectIds: [hash("effect")],
    invocationIds: [hash("invocation")], usage: { inputTokens: "10", outputTokens: "2",
      reasoningTokens: "1" }, closedAt: at });
  return { corpus, projections, assignment, experiment };
}

describe("world relation shadow trade hypotheses", () => {
  it("prices the complement of the adverse listing state as a failure-budget hypothesis", () => {
    const work = fixture();
    const result = compileWorldRelationShadowTradeHypotheses({ experiment: work.experiment,
      inputRevision: work.assignment.inputRevision, corpus: work.corpus,
      projections: work.projections });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      adverseListingStateId: "TF",
      legs: [{ listingRef: "fixture:alaska", adverseTruth: true, outcome: "FALSE",
        indicativeAskUnits: "540000" },
      { listingRef: "fixture:national", adverseTruth: false, outcome: "TRUE",
        indicativeAskUnits: "507000" }],
      payoffShape: { minimumNonAdversePayoutUnits: "1000000", adversePayoutUnits: "0",
        totalIndicativeCostUnits: "1047000", grossFailureBudgetUnits: "-47000",
        breakEvenAdverseProbabilityUpperPpm: "0" },
      status: "NON_POSITIVE_INDICATIVE_MARGIN",
      blockers: ["ADVERSE_PROBABILITY_BOUND_UNAVAILABLE",
        "NON_POSITIVE_INDICATIVE_FAILURE_BUDGET"],
      guaranteedProfit: false, verifierEligible: false,
    });
  });

  it("keeps non-exact settlement mapping as an independent blocker", () => {
    const work = fixture(false);
    const result = compileWorldRelationShadowTradeHypotheses({ experiment: work.experiment,
      inputRevision: work.assignment.inputRevision, corpus: work.corpus,
      projections: work.projections });
    expect(result[0]).toMatchObject({ status: "SETTLEMENT_MAPPING_BLOCKED" });
    expect(result[0]?.blockers).toEqual(expect.arrayContaining([
      "ADVERSE_PROBABILITY_BOUND_UNAVAILABLE", "NON_EXACT_SETTLEMENT_PROJECTION",
    ]));
  });
});
