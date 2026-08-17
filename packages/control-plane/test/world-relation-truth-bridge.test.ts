import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildSettlementProjection,
  buildWorldPredicateArtifact,
  buildWorldRelationExperiment,
} from "../src/world-history-ontology.js";
import { compileWorldRelationTruthBridge } from
  "../src/world-relation-truth-bridge.js";

const hash = (label: string) => hashCanonical({ label });
const at = "2026-08-14T00:00:00.000Z";

function predicate(verbPhrase: string, kind: "OCCURRENCE" | "STATE_PRESENCE" | "PUBLIC_ACTION") {
  return buildWorldPredicateArtifact({
    semantic: {
      operatorKind: kind,
      subjects: [{ canonicalLabel: "Donald Trump", entityType: "PERSON" }],
      verbPhrase,
      timeScope: { startsAt: null, endsAt: null, precision: "UNRESOLVED" },
      parameters: [],
      polarity: "POSITIVE",
    },
    observability: "RULE_DEFINED",
    epistemicPosture: "SETTLEMENT_BOUND_PREDICATE",
    evidenceBindings: [{
      listingRef: `fixture:${verbPhrase}`,
      nodeId: hash(`${verbPhrase}:node`),
      worldFacetId: hash(`${verbPhrase}:world`),
      sourceRawHash: hash(`${verbPhrase}:raw`),
      protocolIdentity: "fixture:v1",
    }],
    ambiguityNotes: [], counterworlds: [],
    source: {
      sourceOntologyIdentities: [hash("ontology")],
      sourceSnapshotIdentities: [hash("snapshot")],
      sourceAgentRunIds: [hash("run")],
      sourceToolEffectIds: [hash("effect")],
    },
    proposedAt: at,
  });
}

function projection(listingRef: string, item: ReturnType<typeof predicate>) {
  return buildSettlementProjection({
    listing: {
      listingRef,
      listingHash: hash(`${listingRef}:listing`),
      venueId: "fixture", venueInstrumentId: listingRef,
      protocolIdentity: "fixture:v1",
      sourceRawHash: hash(`${listingRef}:raw`), sourceReceivedAt: at,
    },
    predicateArtifacts: [item], predicateIds: [item.predicateId],
    truthStates: [false, true].map((truth) => ({
      truthByPredicateId: { [item.predicateId]: truth },
      listingTruth: truth,
      disposition: "RESOLVES" as const,
      rationale: "Fixture identity projection.",
      ruleEvidenceHashes: [hash(`${listingRef}:rules`)],
    })),
    mappingPosture: "TOTAL_EXACT", ambiguityNotes: [],
    sourceAgentRunIds: [hash("run")], sourceToolEffectIds: [hash("effect")],
    observedAt: at,
  });
}

function experiment(input: Readonly<{
  predicates: readonly ReturnType<typeof predicate>[];
  adverseTruths: readonly Readonly<Record<string, boolean>>[];
  terminal: "SUPPORTED_HARD" | "SUPPORTED_PROBABILISTIC";
  relationKind?: "MUTUALLY_EXCLUSIVE" | "STATE_MEDIATED_INHIBITION";
}>) {
  return buildWorldRelationExperiment({
    relationKind: input.relationKind ?? "MUTUALLY_EXCLUSIVE",
    predicateArtifacts: input.predicates,
    antecedentPredicateIds: [input.predicates[0]!.predicateId],
    consequentPredicateIds: [input.predicates.at(-1)!.predicateId],
    latentPredicateIds: input.predicates.slice(1, -1).map((item) => item.predicateId),
    temporalPosture: "ANTECEDENT_PRECEDES_CONSEQUENT",
    adverseAssignments: input.adverseTruths.map((truthByPredicateId) => ({
      truthByPredicateId,
      rationale: "Adverse fixture world.",
    })),
    searchNeighborhoods: ["fixture"], inspectedProjectionIds: [],
    counterworlds: [{
      description: "Fixture counterworld was tested.",
      truthByPredicateId: input.adverseTruths[0]!,
      result: input.terminal === "SUPPORTED_HARD" ? "REJECTED" : "SURVIVES",
      evidenceBindingHashes: [],
    }],
    terminalDisposition: input.terminal,
    rationale: "Fixture relation.", sourceAgentRunId: hash("relation-run"),
    sourceToolEffectIds: [hash("relation-effect")], invocationIds: [hash("invocation")],
    usage: { inputTokens: "10", outputTokens: "2", reasoningTokens: "1" },
    closedAt: at,
  });
}

describe("world relation truth bridge", () => {
  it("compiles a hard world exclusion into a complete listing truth table", () => {
    const fatal = predicate("is fatally shot", "OCCURRENCE");
    const cola = predicate("drinks cola publicly", "PUBLIC_ACTION");
    const relation = experiment({
      predicates: [fatal, cola],
      adverseTruths: [{ [fatal.predicateId]: true, [cola.predicateId]: true }],
      terminal: "SUPPORTED_HARD",
    });
    const bridge = compileWorldRelationTruthBridge({
      experiment: relation,
      predicates: [fatal, cola],
      projections: [projection("fixture:fatal", fatal), projection("fixture:cola", cola)],
    });

    expect(bridge.admission).toBe("HARD_SEMANTIC_CONSTRAINT_DRAFT");
    expect(bridge.listingRefs).toEqual(["fixture:cola", "fixture:fatal"]);
    expect(bridge.listingTruthStates).toHaveLength(4);
    expect(bridge.listingTruthStates.find((item) => item.stateId === "TT")?.disposition)
      .toBe("IMPOSSIBLE");
    expect(bridge.semanticConstraintDraft?.classification).toBe("HARD_SETTLEMENT_CONSTRAINT");
  });

  it("blocks a probabilistic bound when an untraded latent state collapses into the same listing state", () => {
    const shot = predicate("is shot", "OCCURRENCE");
    const incapacity = predicate("is incapacitated", "STATE_PRESENCE");
    const cola = predicate("drinks cola publicly", "PUBLIC_ACTION");
    const relation = experiment({
      predicates: [shot, incapacity, cola],
      adverseTruths: [{
        [shot.predicateId]: true,
        [incapacity.predicateId]: true,
        [cola.predicateId]: true,
      }],
      terminal: "SUPPORTED_PROBABILISTIC",
      relationKind: "STATE_MEDIATED_INHIBITION",
    });
    const bridge = compileWorldRelationTruthBridge({
      experiment: relation,
      predicates: [shot, incapacity, cola],
      projections: [projection("fixture:shot", shot), projection("fixture:cola", cola)],
    });

    expect(bridge.admission).toBe("RESEARCH_ONLY");
    expect(bridge.blockers).toContain("LATENT_STATE_COLLAPSE");
    expect(bridge.collapsedListingStates).toContainEqual(expect.objectContaining({
      stateId: "TT",
      adverseWorldCount: 1,
      nonAdverseWorldCount: 1,
    }));
    expect(bridge.probabilityBoundDraft).toBeNull();
  });

  it("allows a listing-level probability candidate when every collapsed world is adverse", () => {
    const shot = predicate("is shot", "OCCURRENCE");
    const incapacity = predicate("is incapacitated", "STATE_PRESENCE");
    const cola = predicate("drinks cola publicly", "PUBLIC_ACTION");
    const adverseTruths = [false, true].map((incapacitated) => ({
      [shot.predicateId]: true,
      [incapacity.predicateId]: incapacitated,
      [cola.predicateId]: true,
    }));
    const relation = experiment({
      predicates: [shot, incapacity, cola], adverseTruths,
      terminal: "SUPPORTED_PROBABILISTIC",
      relationKind: "STATE_MEDIATED_INHIBITION",
    });
    const bridge = compileWorldRelationTruthBridge({
      experiment: relation,
      predicates: [shot, incapacity, cola],
      projections: [projection("fixture:shot", shot), projection("fixture:cola", cola)],
    });

    expect(bridge.admission).toBe("PROBABILITY_BOUND_DRAFT");
    expect(bridge.probabilityBoundDraft).toEqual({ adverseStateIds: ["TT"] });
    expect(bridge.blockers).toEqual([]);
  });
});
