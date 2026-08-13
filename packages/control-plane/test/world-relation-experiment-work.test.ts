import { hashCanonical } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertWorldRelationExperimentInputRevision,
  buildAgentRun,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildWorldPredicateArtifact,
  buildWorldRelationExperimentAssignment,
  buildWorldRelationExperimentCampaignPreview,
  buildWorldRelationExperimentCheckpoint,
  completeAgentRun,
  defaultAiRuntimeConfiguration,
  SqliteOperationalStore,
  type WorldRelationFrontierSeed,
} from "../src/index.js";

const at = "2026-08-14T00:00:00.000Z";
const hash = (label: string) => hashCanonical({ label });

function assignment() {
  const predicate = buildWorldPredicateArtifact({
    semantic: { operatorKind: "PUBLIC_ACTION",
      subjects: [{ canonicalLabel: "Donald Trump", entityType: "PERSON" }],
      verbPhrase: "drinks cola on a livestream",
      timeScope: { startsAt: null, endsAt: null, precision: "UNRESOLVED" },
      parameters: [], polarity: "POSITIVE" },
    observability: "DERIVED", epistemicPosture: "EVIDENCE_BOUND_PROPOSITION",
    evidenceBindings: [{ listingRef: "fixture:cola", nodeId: hash("node"),
      worldFacetId: hash("world"), sourceRawHash: hash("raw"),
      protocolIdentity: "fixture:v1" }], ambiguityNotes: [], counterworlds: [],
    source: { sourceOntologyIdentities: [hash("ontology")],
      sourceSnapshotIdentities: [hash("snapshot")], sourceAgentRunIds: [hash("run")],
      sourceToolEffectIds: [] }, proposedAt: at,
  });
  const frontierBody = { schemaVersion: "pmh.world-relation-frontier-seed.v1" as const,
    frontierId: hash("frontier"), predicates: [predicate],
    relationKind: "UNRESOLVED_ASSOCIATION" as const, antecedentPredicateIds: [],
    consequentPredicateIds: [predicate.predicateId], latentPredicateIds: [],
    temporalPosture: "ORDER_UNRESOLVED" as const, searchNeighborhoods: ["cola"],
    counterworlds: ["The event is unrelated."], rationale: "Fixture frontier.",
    sourceMechanismProposalId: hash("mechanism"), sourceAgentRunId: hash("run"),
    disposition: "UNTESTED_RELATION_FRONTIER" as const,
    authority: "RELATION_EXPERIMENT_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const };
  const frontier = Object.freeze({ ...frontierBody,
    artifactHash: hashCanonical(frontierBody) }) satisfies WorldRelationFrontierSeed;
  const rulesText = "Resolves Yes if Donald Trump drinks cola on the named livestream.";
  const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set"),
    eligibleSourceCount: 1, excludedSourceCount: 0, listings: [{
      listingRef: "fixture:cola", venueId: "fixture", venueInstrumentId: "cola",
      title: "Will Trump drink cola on a livestream?", description: "Fixture.",
      status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK", closesAt: null, rulesText,
      rulesTextPosture: "COMPLETE", rulesTextSourceCharacterCount: rulesText.length,
      outcomes: [{ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" },
        { venueOutcomeId: "no", label: "No", indicativePrice: "0.6" }],
      priceScale: "1000000", quantityScale: "1000000", minPriceTick: "1000",
      sourceKind: "VERIFIED_FIXTURE", sourceReceivedAt: at,
      sourceRawHash: hash("raw"), protocolIdentity: "fixture:v1",
    }] });
  return buildWorldRelationExperimentAssignment({ frontier, corpus });
}

describe("world relation experiment work", () => {
  it("rotates semantic input when frontier evidence changes but ignores price-only corpus revisions", () => {
    const base = assignment();
    const refreshedCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: base.corpus.sourceSetIdentity,
      eligibleSourceCount: base.corpus.eligibleSourceCount,
      excludedSourceCount: base.corpus.excludedSourceCount,
      listings: base.corpus.listings.map((listing) => ({
        ...listing,
        sourceReceivedAt: "2026-08-14T00:01:00.000Z",
        outcomes: listing.outcomes.map((outcome, index) => ({
          ...outcome,
          indicativePrice: index === 0 ? "0.7" : "0.3",
        })),
      })),
    });
    const priceOnly = buildWorldRelationExperimentAssignment({
      frontier: base.inputRevision.frontier,
      corpus: refreshedCorpus,
      projections: base.projections,
      priorExperiments: [],
    });
    expect(priceOnly.inputRevision.semanticInputIdentity)
      .toBe(base.inputRevision.semanticInputIdentity);
    const revisedFrontier = Object.freeze({
      ...base.inputRevision.frontier,
      artifactHash: hashCanonical({
        prior: base.inputRevision.frontier.artifactHash,
        evidenceRevision: 2,
      }),
    });
    const evidenceChanged = buildWorldRelationExperimentAssignment({
      frontier: revisedFrontier,
      corpus: base.corpus,
      projections: base.projections,
      priorExperiments: [],
    });
    expect(evidenceChanged.inputRevision.frontier.frontierId)
      .toBe(base.inputRevision.frontier.frontierId);
    expect(evidenceChanged.inputRevision.semanticInputIdentity)
      .not.toBe(base.inputRevision.semanticInputIdentity);
  });
  it("binds exact frontier and corpus while keeping price-only refreshes semantically stable", () => {
    const first = assignment();
    expect(assertWorldRelationExperimentInputRevision(first.inputRevision))
      .toBe(first.inputRevision);
    expect(first.task.kind).toBe("WORLD_RELATION_EXPERIMENT");
    expect(first.task.requestedEffectProtocol).toBe("WORLD_RELATION_EXPERIMENT_TOOLS_V1");
    expect(first.inputRevision.frontier.predicates).toHaveLength(1);
    expect(first.inputRevision.priorExperimentArtifactHashes).toEqual([]);
    expect(first.taskPayload.automaticDispatch).toBe(false);
  });

  it("selects one unattempted specimen and uses the dedicated Terra/Codex route", () => {
    const work = assignment();
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(at));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_RELATION_EXPERIMENT")!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId)!;
    const execution = { ...portfolio, tasks: [work.task], runs: [], campaigns: [],
      capabilityObservations: [], modelInvocations: [], toolEffects: [], runArtifacts: [],
      runAnnotations: [], resultSelections: [] };
    const capability = { schemaVersion: "pmh.execution-capability.v1" as const,
      executionProfileId: profile.executionProfileId, runtimeKind: "CODEX" as const,
      credentialKind: "CODEX_OAUTH" as const, accessDriver: "CODEX_RESPONSES" as const,
      model: "gpt-5.6-terra", configured: true, credentialPresent: true,
      dispatchEligibility: "ELIGIBLE" as const, diagnostic: "ready", observedAt: at,
      authority: "EXECUTION_CAPABILITY_ONLY" as const, secretMaterialRetained: false as const,
      externalWriteAuthority: false as const, valueMovingAuthority: false as const };
    const preview = buildWorldRelationExperimentCampaignPreview({
      assignments: [work], execution, capability,
    });
    expect(preview).toMatchObject({ creationEligible: true, dispatchEligible: true,
      taskIds: [work.task.taskId], taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 16,
        maximumInputTokens: "400000" },
      automaticDispatch: false, providerRequestsStarted: 0 });

    const prepared = {
      ...work.task,
    };
    expect(prepared.kind).toBe("WORLD_RELATION_EXPERIMENT");
    expect(profile.toolPolicy.protocol).toBe("WORLD_RELATION_EXPERIMENT_TOOLS_V1");
  });

  it("retains the exact frontier and corpus across a SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-world-relation-input-"));
    const databasePath = join(directory, "control-plane.sqlite");
    const work = assignment();
    let store = new SqliteOperationalStore(databasePath);
    try {
      store.saveWorldPredicateArtifacts(work.inputRevision.frontier.predicates);
      store.saveWorldRelationExperimentCorpus(work.corpus);
      expect(store.saveWorldRelationExperimentInputs([work.inputRevision]))
        .toEqual([work.inputRevision]);
      expect(store.worldRelationExperimentInputStorage).toMatchObject({
        durable: true, schemaVersion: 63, idempotencyKey: "inputRevisionId",
      });
    } finally {
      store.close();
    }
    store = new SqliteOperationalStore(databasePath);
    try {
      expect(store.loadWorldRelationExperimentInput(work.inputRevision.inputRevisionId))
        .toEqual(work.inputRevision);
      expect(store.loadWorldRelationExperimentCorpus(work.corpus.snapshotIdentity))
        .toEqual(work.corpus);
    } finally {
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains a replayable terminal checkpoint only after its exact input and successful run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-world-relation-checkpoint-"));
    const databasePath = join(directory, "control-plane.sqlite");
    const work = assignment();
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(at));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_RELATION_EXPERIMENT")!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId)!;
    const prepared = buildAgentRun({ task: work.task, executionProfile: profile,
      runOrdinal: 1, authorization: { kind: "MANUAL", authorizationRef: "operator:test",
        authorizedAt: at }, createdAt: at });
    const run = completeAgentRun(prepared, "SUCCEEDED", "2026-08-14T00:00:01.000Z", null);
    const checkpoint = buildWorldRelationExperimentCheckpoint({
      inputRevisionId: work.inputRevision.inputRevisionId,
      frontierId: work.inputRevision.frontier.frontierId,
      frontierArtifactHash: work.inputRevision.frontier.artifactHash,
      corpusSnapshotIdentity: work.corpus.snapshotIdentity,
      sourceAgentRunId: run.runId,
      sourceToolEffectIds: [], invocationIds: [],
      usage: { inputTokens: "0", outputTokens: "0", reasoningTokens: "0" },
      searchNeighborhoods: ["cola"], inspectedListingRefs: [], counterworld: null,
      terminalDisposition: "EXHAUSTED", rationale: "No additional listing survived search.",
      closedAt: run.completedAt!,
    });
    let store = new SqliteOperationalStore(databasePath);
    try {
      expect(() => store.saveWorldRelationExperimentCheckpoints([checkpoint]))
        .toThrow(/unavailable exact input/iu);
      store.saveWorldPredicateArtifacts(work.inputRevision.frontier.predicates);
      store.saveWorldRelationExperimentCorpus(work.corpus);
      store.saveWorldRelationExperimentInputs([work.inputRevision]);
      store.saveAgentExecutionBatch({
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        workloadRoutes: portfolio.workloadRoutes,
        tasks: [work.task], runs: [run],
      });
      expect(store.saveWorldRelationExperimentCheckpoints([checkpoint]))
        .toEqual([checkpoint]);
      expect(store.worldRelationExperimentCheckpointStorage).toMatchObject({
        durable: true, schemaVersion: 63, idempotencyKey: "checkpointId",
      });
    } finally {
      store.close();
    }
    store = new SqliteOperationalStore(databasePath);
    try {
      expect(store.loadWorldRelationExperimentCheckpoints(10)).toEqual([checkpoint]);
    } finally {
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
