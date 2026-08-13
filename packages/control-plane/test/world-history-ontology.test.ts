import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertSettlementProjection,
  assertWorldPredicateArtifact,
  assertWorldRelationExperiment,
  buildSettlementProjection,
  buildWorldPredicateArtifact,
  buildWorldRelationExperiment,
  inspectWorldRelationCompilerBridge,
} from "../src/world-history-ontology.js";
import { SqliteOperationalStore } from "../src/operational-store.js";
import {
  buildAgentRun,
  buildAgentTask,
  importLegacyAiRuntimeConfiguration,
} from "../src/agent-execution-substrate.js";

const hash = (label: string) => hashCanonical({ label });
const observedAt = "2026-08-14T00:00:00.000Z";

function predicate(input: Readonly<{
  verbPhrase: string;
  operatorKind?: "OCCURRENCE" | "STATE_PRESENCE" | "PUBLIC_ACTION";
  posture?: "SEARCH_HYPOTHESIS_ONLY" | "EVIDENCE_BOUND_PROPOSITION" |
    "SETTLEMENT_BOUND_PREDICATE";
  listingRef?: string;
}>) {
  return buildWorldPredicateArtifact({
    semantic: {
      operatorKind: input.operatorKind ?? "OCCURRENCE",
      subjects: [{ canonicalLabel: "Donald Trump", entityType: "PERSON" }],
      verbPhrase: input.verbPhrase,
      timeScope: {
        startsAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-09-30T23:59:59.000Z",
        precision: "BOUNDED_INTERVAL",
      },
      parameters: [],
      polarity: "POSITIVE",
    },
    observability: input.posture === "SEARCH_HYPOTHESIS_ONLY"
      ? "LATENT_HYPOTHESIS"
      : "RULE_DEFINED",
    epistemicPosture: input.posture ?? "SEARCH_HYPOTHESIS_ONLY",
    evidenceBindings: input.listingRef === undefined ? [] : [{
      listingRef: input.listingRef,
      nodeId: hash(`${input.listingRef}:node`),
      worldFacetId: hash(`${input.listingRef}:world`),
      sourceRawHash: hash(`${input.listingRef}:raw`),
      protocolIdentity: "fixture:v1",
    }],
    ambiguityNotes: [],
    counterworlds: [],
    source: {
      sourceOntologyIdentities: [hash("ontology")],
      sourceSnapshotIdentities: [hash("snapshot")],
      sourceAgentRunIds: [hash("run")],
      sourceToolEffectIds: [hash("effect")],
    },
    proposedAt: observedAt,
  });
}

function projection(
  listingRef: string,
  boundPredicate: ReturnType<typeof predicate>,
  posture: "TOTAL_EXACT" | "PARTIAL" = "TOTAL_EXACT",
) {
  return buildSettlementProjection({
    listing: {
      listingRef,
      listingHash: hash(`${listingRef}:listing`),
      venueId: "fixture",
      venueInstrumentId: listingRef,
      protocolIdentity: "fixture:v1",
      sourceRawHash: hash(`${listingRef}:raw`),
      sourceReceivedAt: observedAt,
    },
    predicateArtifacts: [boundPredicate],
    predicateIds: [boundPredicate.predicateId],
    truthStates: posture === "TOTAL_EXACT" ? [
      {
        truthByPredicateId: { [boundPredicate.predicateId]: false },
        listingTruth: false,
        disposition: "RESOLVES",
        rationale: "The venue resolves No when the bound predicate is false.",
        ruleEvidenceHashes: [hash(`${listingRef}:rules`)],
      },
      {
        truthByPredicateId: { [boundPredicate.predicateId]: true },
        listingTruth: true,
        disposition: "RESOLVES",
        rationale: "The venue resolves Yes when the bound predicate is true.",
        ruleEvidenceHashes: [hash(`${listingRef}:rules`)],
      },
    ] : [{
      truthByPredicateId: { [boundPredicate.predicateId]: true },
      listingTruth: true,
      disposition: "RESOLVES",
      rationale: "Only the positive rule branch has been inspected.",
      ruleEvidenceHashes: [hash(`${listingRef}:rules`)],
    }],
    mappingPosture: posture,
    ambiguityNotes: posture === "TOTAL_EXACT" ? [] : ["Negative resolution path absent."],
    sourceAgentRunIds: [hash("run")],
    sourceToolEffectIds: [hash("effect")],
    observedAt,
  });
}

describe("world-history settlement ontology", () => {
  it("keeps semantic predicate identity stable while evidence lineage changes", () => {
    const first = predicate({ verbPhrase: "is shot", listingRef: "venue-a:shooting" });
    const second = buildWorldPredicateArtifact({
      ...first,
      evidenceBindings: [{
        listingRef: "venue-b:shooting",
        nodeId: hash("b-node"),
        worldFacetId: hash("b-world"),
        sourceRawHash: hash("b-raw"),
        protocolIdentity: "fixture:v2",
      }],
      source: {
        sourceOntologyIdentities: [hash("ontology-2")],
        sourceSnapshotIdentities: [hash("snapshot-2")],
        sourceAgentRunIds: [hash("run-2")],
        sourceToolEffectIds: [hash("effect-2")],
      },
      proposedAt: "2026-08-14T01:00:00.000Z",
    });

    expect(first.predicateId).toBe(second.predicateId);
    expect(first.artifactHash).not.toBe(second.artifactHash);
    expect(assertWorldPredicateArtifact(first)).toEqual(first);
    expect(assertWorldPredicateArtifact(second)).toEqual(second);
  });

  it("makes settlement exactness a property of complete rule-bound projection", () => {
    const event = predicate({
      verbPhrase: "is fatally shot",
      posture: "SETTLEMENT_BOUND_PREDICATE",
      listingRef: "venue-a:fatal-shooting",
    });
    const exact = projection("venue-a:fatal-shooting", event);
    const partial = projection("venue-b:fatal-shooting", event, "PARTIAL");

    expect(exact.compilerAdmission).toBe("EXACT_BINARY_ELIGIBLE");
    expect(partial.compilerAdmission).toBe("RESEARCH_ONLY");
    expect(assertSettlementProjection(exact)).toEqual(exact);
    expect(assertSettlementProjection(partial)).toEqual(partial);
  });

  it("represents shooting, incapacity, and cola as distinct state-mediated predicates", () => {
    const shooting = predicate({ verbPhrase: "is shot" });
    const incapacity = predicate({
      verbPhrase: "is dead or physically incapacitated",
      operatorKind: "STATE_PRESENCE",
    });
    const cola = predicate({
      verbPhrase: "personally drinks cola on a public livestream",
      operatorKind: "PUBLIC_ACTION",
    });

    const experiment = buildWorldRelationExperiment({
      relationKind: "STATE_MEDIATED_INHIBITION",
      predicateArtifacts: [shooting, incapacity, cola],
      antecedentPredicateIds: [shooting.predicateId],
      consequentPredicateIds: [cola.predicateId],
      latentPredicateIds: [incapacity.predicateId],
      temporalPosture: "ANTECEDENT_PRECEDES_CONSEQUENT",
      adverseAssignments: [{
        truthByPredicateId: {
          [shooting.predicateId]: true,
          [incapacity.predicateId]: true,
          [cola.predicateId]: true,
        },
        rationale: "The adverse joint state contains incapacity and the later personal act.",
      }],
      searchNeighborhoods: ["August Trump shooting", "September Trump public drink"],
      inspectedProjectionIds: [],
      counterworlds: [{
        description: "A non-fatal shooting followed by recovery and a later livestream.",
        truthByPredicateId: {
          [shooting.predicateId]: true,
          [incapacity.predicateId]: false,
          [cola.predicateId]: true,
        },
        result: "SURVIVES",
        evidenceBindingHashes: [],
      }],
      terminalDisposition: "SUPPORTED_PROBABILISTIC",
      rationale: "Broad shooting can influence incapacity, which inhibits the later action.",
      sourceAgentRunId: hash("relation-run"),
      sourceToolEffectIds: [hash("relation-effect")],
      invocationIds: [hash("invocation")],
      usage: { inputTokens: "100", outputTokens: "20", reasoningTokens: "10" },
      closedAt: observedAt,
    });

    expect(experiment.relationKind).toBe("STATE_MEDIATED_INHIBITION");
    expect(experiment.counterworlds[0]?.result).toBe("SURVIVES");
    expect(experiment.compilerBridge).toBe("PROBABILISTIC_BOUND_CANDIDATE");
    expect(assertWorldRelationExperiment(experiment)).toEqual(experiment);
    expect(inspectWorldRelationCompilerBridge({
      experiment,
      predicates: [shooting, incapacity, cola],
      projections: [],
    }).admission).toBe("PROBABILISTIC_BOUND_CANDIDATE");
  });

  it("fails hard admission when a counterworld survives or a projection is partial", () => {
    const fatal = predicate({
      verbPhrase: "is fatally shot",
      posture: "SETTLEMENT_BOUND_PREDICATE",
      listingRef: "venue-a:fatal",
    });
    const cola = predicate({
      verbPhrase: "personally drinks cola on a public livestream",
      operatorKind: "PUBLIC_ACTION",
      posture: "SETTLEMENT_BOUND_PREDICATE",
      listingRef: "venue-b:cola",
    });
    const fatalProjection = projection("venue-a:fatal", fatal);
    const partialColaProjection = projection("venue-b:cola", cola, "PARTIAL");
    const experiment = buildWorldRelationExperiment({
      relationKind: "MUTUALLY_EXCLUSIVE",
      predicateArtifacts: [fatal, cola],
      antecedentPredicateIds: [fatal.predicateId],
      consequentPredicateIds: [cola.predicateId],
      latentPredicateIds: [],
      temporalPosture: "ANTECEDENT_PRECEDES_CONSEQUENT",
      adverseAssignments: [{
        truthByPredicateId: { [fatal.predicateId]: true, [cola.predicateId]: true },
        rationale: "Both predicates true is the claimed forbidden state.",
      }],
      searchNeighborhoods: ["fatal shooting and later appearance"],
      inspectedProjectionIds: [fatalProjection.projectionId, partialColaProjection.projectionId],
      counterworlds: [{
        description: "Venue B could resolve the public action under an uninspected proxy rule.",
        truthByPredicateId: { [fatal.predicateId]: true, [cola.predicateId]: true },
        result: "INCONCLUSIVE",
        evidenceBindingHashes: [],
      }],
      terminalDisposition: "UNRESOLVED",
      rationale: "The world relation may be hard, but settlement evidence is incomplete.",
      sourceAgentRunId: hash("hard-run"),
      sourceToolEffectIds: [hash("hard-effect")],
      invocationIds: [hash("hard-invocation")],
      usage: { inputTokens: "50", outputTokens: "10", reasoningTokens: "5" },
      closedAt: observedAt,
    });

    const bridge = inspectWorldRelationCompilerBridge({
      experiment,
      predicates: [fatal, cola],
      projections: [fatalProjection, partialColaProjection],
    });
    expect(bridge.admission).toBe("RESEARCH_ONLY");
    expect(bridge.blockers).toContain("RELATION_NOT_SUPPORTED_HARD");
    expect(bridge.blockers).toContain("NON_EXACT_SETTLEMENT_PROJECTION");
    expect(bridge.blockers).toContain("COUNTERWORLD_NOT_REJECTED");
  });

  it("rejects tampered content identities", () => {
    const event = predicate({ verbPhrase: "is shot" });
    expect(() => assertWorldPredicateArtifact({
      ...event,
      semantic: { ...event.semantic, verbPhrase: "is not shot" },
    })).toThrow(/identity/i);
  });

  it("replays predicate revisions, projections, and experiments without rewriting history", () => {
    const store = new SqliteOperationalStore(":memory:");
    const event = predicate({
      verbPhrase: "is fatally shot",
      posture: "SETTLEMENT_BOUND_PREDICATE",
      listingRef: "venue-a:fatal",
    });
    const revised = buildWorldPredicateArtifact({
      ...event,
      ambiguityNotes: ["A second source uses a narrower definition of fatality."],
      proposedAt: "2026-08-14T01:00:00.000Z",
    });
    const mapped = projection("venue-a:fatal", event);
    store.saveWorldPredicateArtifacts([event, revised]);
    store.saveSettlementProjections([mapped]);

    const imported = importLegacyAiRuntimeConfiguration({
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 1,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: observedAt,
    });
    store.saveAgentExecutionBatch({
      runtimeDefinitions: [imported.runtimeDefinition],
      credentialBindings: [imported.credentialBinding],
      modelProfiles: [imported.modelProfile],
      executionProfiles: [imported.executionProfile],
      workloadRoutes: [imported.workloadRoute],
    });
    const task = buildAgentTask({
      kind: "ONTOLOGY_NORMALIZATION",
      protocol: "WORLD_HISTORY_ONTOLOGY_TASK_V1",
      inputArtifacts: [],
      taskPayload: { fixture: true },
      requestedEffectProtocol: "WORLD_HISTORY_ONTOLOGY_TOOLS_V1",
      priority: 1,
      provenanceRef: "fixture:world-history",
      createdAt: observedAt,
    });
    const run = buildAgentRun({
      task,
      executionProfile: imported.executionProfile,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "fixture:test",
        authorizedAt: observedAt,
      },
      runOrdinal: 1,
      createdAt: observedAt,
    });
    store.saveAgentExecutionBatch({ tasks: [task], runs: [run] });
    const experiment = buildWorldRelationExperiment({
      relationKind: "MUTUALLY_EXCLUSIVE",
      predicateArtifacts: [event, predicate({ verbPhrase: "publicly appears", operatorKind: "PUBLIC_ACTION" })],
      antecedentPredicateIds: [event.predicateId],
      consequentPredicateIds: [predicate({ verbPhrase: "publicly appears", operatorKind: "PUBLIC_ACTION" }).predicateId],
      latentPredicateIds: [],
      temporalPosture: "ANTECEDENT_PRECEDES_CONSEQUENT",
      adverseAssignments: [{
        truthByPredicateId: {
          [event.predicateId]: true,
          [predicate({ verbPhrase: "publicly appears", operatorKind: "PUBLIC_ACTION" }).predicateId]: true,
        },
        rationale: "Fatality and a later personal appearance cannot both obtain.",
      }],
      searchNeighborhoods: ["fatality and later appearance"],
      inspectedProjectionIds: [mapped.projectionId],
      counterworlds: [{
        description: "A recording or proxy is not a personal appearance.",
        truthByPredicateId: {
          [event.predicateId]: true,
          [predicate({ verbPhrase: "publicly appears", operatorKind: "PUBLIC_ACTION" }).predicateId]: true,
        },
        result: "REJECTED",
        evidenceBindingHashes: [hash("appearance-rules")],
      }],
      terminalDisposition: "SUPPORTED_HARD",
      rationale: "The personal action requires the person to be alive.",
      sourceAgentRunId: run.runId,
      sourceToolEffectIds: [hash("effect")],
      invocationIds: [hash("invocation")],
      usage: { inputTokens: "10", outputTokens: "5", reasoningTokens: "2" },
      closedAt: observedAt,
    });
    const appearance = predicate({ verbPhrase: "publicly appears", operatorKind: "PUBLIC_ACTION" });
    store.saveWorldPredicateArtifacts([appearance]);
    store.saveWorldRelationExperiments([experiment]);

    expect(store.loadWorldPredicateArtifacts(10).filter((item) =>
      item.predicateId === event.predicateId
    )).toHaveLength(2);
    expect(store.loadSettlementProjections(10)).toEqual([mapped]);
    expect(store.loadWorldRelationExperiments(10)).toEqual([experiment]);
    store.close();
  });
});
