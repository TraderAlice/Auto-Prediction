import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  adaptMarketOntologyWorldProposition,
  adaptWorldStateMechanismProposal,
} from "../src/world-history-ontology-adapter.js";
import { buildMarketOntologySnapshot } from "../src/market-ontology.js";
import { buildMarketCorpusSnapshot } from "../src/market-corpus.js";
import {
  buildWorldStateMechanismProposal,
} from "../src/world-state-mechanism.js";
import type { MarketOntologyWorldPropositionProposal } from
  "../src/market-ontology-agent-tools.js";

const hash = (label: string) => hashCanonical({ label });
const observedAt = "2026-08-14T00:00:00.000Z";

function corpus() {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hash("source-set"),
    eligibleSourceCount: 1,
    excludedSourceCount: 0,
    listings: [{
      listingRef: "venue:trump-shot",
      venueId: "venue",
      venueInstrumentId: "trump-shot",
      title: "Will Donald Trump be shot in August 2026?",
      description: "Fixture.",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      closesAt: "2026-09-01T00:00:00.000Z",
      rulesText: "Resolves Yes if Donald Trump is shot in August 2026.",
      rulesTextPosture: "COMPLETE",
      rulesTextSourceCharacterCount: 52,
      outcomes: [
        { venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.1" },
        { venueOutcomeId: "no", label: "No", indicativePrice: "0.9" },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "0.01",
      sourceKind: "VERIFIED_FIXTURE",
      sourceReceivedAt: observedAt,
      sourceRawHash: hash("raw"),
      protocolIdentity: "fixture:v1",
    }],
  });
}

describe("world-history ontology adapters", () => {
  it("turns a retained world proposition into evidence-bound predicate memory", () => {
    const source = corpus();
    const ontology = buildMarketOntologySnapshot(source);
    const node = ontology.nodes[0]!;
    const proposal = {
      schemaVersion: "pmh.market-ontology-agent-proposal.v1",
      kind: "WORLD_PROPOSITION",
      proposalId: hash("proposal"),
      ontologyIdentity: ontology.ontologyIdentity,
      sourceSnapshotIdentity: source.snapshotIdentity,
      sourceAgentRunId: hash("run"),
      sourceTrailheadIds: [hash("trailhead")],
      sourceRelationPatternIds: [hash("pattern")],
      listingBindings: [{
        listingRef: node.listingRef,
        nodeId: node.nodeId,
        worldFacetId: node.worldFacet.facetId,
        settlementFacetId: node.settlementFacet.facetId,
        tradedFacetId: node.tradedFacet.facetId,
      }],
      label: "Trump is shot in August 2026",
      subjectLabels: ["Donald Trump"],
      predicate: "is shot",
      timeScope: "August 2026",
      parameters: [],
      ambiguityNotes: ["The severity of the shooting is not specified."],
      falsifiers: ["A report concerns someone else."],
      rationale: "Preserve the world proposition separately from settlement.",
      proposedAt: observedAt,
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    } as const satisfies MarketOntologyWorldPropositionProposal;

    const predicate = adaptMarketOntologyWorldProposition({
      proposal,
      ontology,
    });
    expect(predicate.semantic.verbPhrase).toBe("is shot");
    expect(predicate.semantic.timeScope.precision).toBe("UNRESOLVED");
    expect(predicate.semantic.parameters).toContainEqual({
      name: "legacy_time_scope",
      value: "August 2026",
      unit: null,
    });
    expect(predicate.epistemicPosture).toBe("EVIDENCE_BOUND_PROPOSITION");
    expect(predicate.evidenceBindings[0]).toMatchObject({
      listingRef: "venue:trump-shot",
      sourceRawHash: hash("raw"),
    });
  });

  it("turns a trigger/state/dependent proposal into three predicates and one untested frontier", () => {
    const proposal = buildWorldStateMechanismProposal({
      ontologyIdentity: hash("ontology"),
      sourceSnapshotIdentity: hash("snapshot"),
      sourceIssueRevisionId: hash("revision"),
      sourceAgentRunId: hash("run"),
      sourceTrailheadIds: [hash("trailhead")],
      sourceRelationPatternIds: [hash("pattern")],
      subjectLabel: "Donald Trump",
      subjectAliases: ["Trump"],
      subjectAmbiguityNotes: [],
      trigger: {
        predicateLabel: "is shot in August",
        searchSignals: ["shot"],
        influence: "MAY_DEGRADE_STATE",
        evidenceBindings: [{
          listingRef: "venue:shot", title: "Will Donald Trump be shot in August?",
          nodeId: hash("shot-node"), worldFacetId: hash("shot-world"),
          sourceRawHash: hash("shot-raw"), protocolIdentity: "fixture:v1",
        }],
      },
      state: { dimension: "PHYSICAL_CAPABILITY", label: "able to appear personally" },
      dependent: {
        predicateLabel: "personally drinks cola on a September livestream",
        searchSignals: ["cola"],
        requirement: "REQUIRES_STATE_PRESENT",
        evidenceBindings: [{
          listingRef: "venue:cola", title: "Will Donald Trump drink cola on livestream?",
          nodeId: hash("cola-node"), worldFacetId: hash("cola-world"),
          sourceRawHash: hash("cola-raw"), protocolIdentity: "fixture:v1",
        }],
      },
      temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
      counterScenarios: ["The shooting is non-fatal and recovery is rapid."],
      rationale: "A broad shooting may reduce capacity for a later personal action.",
      proposedAt: observedAt,
    });

    const seed = adaptWorldStateMechanismProposal(proposal);
    expect(seed.predicates).toHaveLength(3);
    expect(seed.relationKind).toBe("STATE_MEDIATED_INHIBITION");
    expect(seed.latentPredicateIds).toEqual([
      seed.predicates.find((item) => item.semantic.operatorKind === "STATE_PRESENCE")!
        .predicateId,
    ]);
    expect(seed.counterworlds).toEqual([
      "The shooting is non-fatal and recovery is rapid.",
    ]);
    expect(seed.disposition).toBe("UNTESTED_RELATION_FRONTIER");
    expect(seed.semanticDecisionAuthority).toBe(false);
  });

  it("deduplicates equivalent mechanism semantics across Agent runs", () => {
    const mechanism = (sourceAgentRunId: ReturnType<typeof hash>, proposedAt: string) =>
      buildWorldStateMechanismProposal({
      ontologyIdentity: hash("ontology"),
      sourceSnapshotIdentity: hash("snapshot"),
      sourceIssueRevisionId: hash("revision"),
      sourceAgentRunId,
      sourceTrailheadIds: [hash("trailhead")],
      sourceRelationPatternIds: [hash("pattern")],
      subjectLabel: "Donald Trump",
      subjectAliases: ["Trump"],
      subjectAmbiguityNotes: [],
      trigger: {
        predicateLabel: "is shot", searchSignals: ["shot"],
        influence: "MAY_DEGRADE_STATE", evidenceBindings: [{
          listingRef: "venue:shot", title: "Will Donald Trump be shot?",
          nodeId: hash("shot-node"), worldFacetId: hash("shot-world"),
          sourceRawHash: hash("shot-raw"), protocolIdentity: "fixture:v1",
        }],
      },
      state: { dimension: "PHYSICAL_CAPABILITY", label: "can act personally" },
      dependent: {
        predicateLabel: "appears publicly", searchSignals: ["appear"],
        requirement: "REQUIRES_STATE_PRESENT", evidenceBindings: [{
          listingRef: "venue:appears", title: "Will Donald Trump appear publicly?",
          nodeId: hash("appear-node"), worldFacetId: hash("appear-world"),
          sourceRawHash: hash("appear-raw"), protocolIdentity: "fixture:v1",
        }],
      },
      temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
      counterScenarios: ["The shooting is minor."],
      rationale: "Fixture.",
      proposedAt,
    });
    const base = mechanism(hash("run-1"), observedAt);
    const anotherRun = mechanism(hash("run-2"), "2026-08-14T01:00:00.000Z");

    const first = adaptWorldStateMechanismProposal(base);
    const second = adaptWorldStateMechanismProposal(anotherRun);
    expect(first.frontierId).toBe(second.frontierId);
    expect(first.artifactHash).not.toBe(second.artifactHash);
    expect(first.predicates.map((item) => item.predicateId)).toEqual(
      second.predicates.map((item) => item.predicateId),
    );
  });
});
