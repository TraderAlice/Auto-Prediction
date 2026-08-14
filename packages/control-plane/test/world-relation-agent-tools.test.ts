import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildAgentRun,
  buildAgentRuntimeDefinition,
  buildAgentTask,
  buildAgentToolEffect,
  buildCredentialBinding,
  buildExecutionProfile,
  buildMarketCorpusSnapshot,
  buildModelInvocation,
  buildModelProfile,
  buildWorldRelationEconomicMemory,
  buildWorldRelationShadowRoutingProjection,
  buildWorldPredicateArtifact,
  completeAgentRun,
  checkpointWorldRelationExperimentRun,
  compileWorldRelationExperimentFromCheckpoint,
  compileWorldRelationExperimentFromRun,
  buildWorldRelationExperimentAssignment,
  WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL,
  WorldRelationExperimentAgentToolHost,
  type AgentToolHostContext,
  type WorldRelationFrontierSeed,
  type WorldRelationShadowTradeHypothesis,
} from "../src/index.js";

const at = "2026-08-14T00:00:00.000Z";
const hash = (label: string) => hashCanonical({ label });

function predicate(verbPhrase: string, kind: "OCCURRENCE" | "STATE_PRESENCE" | "PUBLIC_ACTION") {
  return buildWorldPredicateArtifact({
    semantic: {
      operatorKind: kind,
      subjects: [{ canonicalLabel: "Donald Trump", entityType: "PERSON" }],
      verbPhrase,
      timeScope: { startsAt: null, endsAt: null, precision: "UNRESOLVED" },
      parameters: [], polarity: "POSITIVE",
    },
    observability: kind === "STATE_PRESENCE" ? "LATENT_HYPOTHESIS" : "DERIVED",
    epistemicPosture: kind === "STATE_PRESENCE"
      ? "SEARCH_HYPOTHESIS_ONLY" : "EVIDENCE_BOUND_PROPOSITION",
    evidenceBindings: kind === "STATE_PRESENCE" ? [] : [{
      listingRef: `fixture:${kind.toLowerCase()}`,
      nodeId: hash(`${verbPhrase}:node`), worldFacetId: hash(`${verbPhrase}:world`),
      sourceRawHash: hash(`${verbPhrase}:raw`), protocolIdentity: "fixture:v1",
    }],
    ambiguityNotes: [], counterworlds: ["The relation may fail in a mild case."],
    source: { sourceOntologyIdentities: [hash("ontology")],
      sourceSnapshotIdentities: [hash("snapshot")], sourceAgentRunIds: [hash("source-run")],
      sourceToolEffectIds: [] },
    proposedAt: at,
  });
}

function fixture(sharedRawEvidence = false) {
  const shot = predicate("is shot in August", "OCCURRENCE");
  const capacity = predicate("is physically able to appear personally", "STATE_PRESENCE");
  const cola = predicate("drinks cola on a September livestream", "PUBLIC_ACTION");
  const frontierBody = {
    schemaVersion: "pmh.world-relation-frontier-seed.v1" as const,
    frontierId: hash("frontier"), predicates: [shot, capacity, cola],
    relationKind: "STATE_MEDIATED_INHIBITION" as const,
    antecedentPredicateIds: [shot.predicateId], consequentPredicateIds: [cola.predicateId],
    latentPredicateIds: [capacity.predicateId],
    temporalPosture: "ANTECEDENT_PRECEDES_CONSEQUENT" as const,
    searchNeighborhoods: ["Trump shot", "Trump cola livestream"],
    counterworlds: ["The shooting is minor and recovery is rapid."],
    rationale: "A broad shooting can affect a later public action through physical capacity.",
    sourceMechanismProposalId: hash("mechanism"), sourceAgentRunId: hash("source-run"),
    disposition: "UNTESTED_RELATION_FRONTIER" as const,
    authority: "RELATION_EXPERIMENT_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const,
  };
  const frontier = Object.freeze({ ...frontierBody,
    artifactHash: hashCanonical(frontierBody) }) satisfies WorldRelationFrontierSeed;
  const listing = (listingRef: string, title: string) => {
    const rulesText = `Resolves Yes according to official reporting: ${title}`;
    return {
      listingRef, venueId: "fixture", venueInstrumentId: listingRef.split(":")[1]!, title,
      description: "A retained anonymous fixture listing.", status: "OPEN" as const,
      mechanism: "CENTRALIZED_ORDER_BOOK" as const,
      closesAt: "2026-10-01T00:00:00.000Z", rulesText,
      rulesTextPosture: "COMPLETE" as const,
      rulesTextSourceCharacterCount: rulesText.length,
      outcomes: [{ venueOutcomeId: "yes", label: "Yes", indicativePrice: "100000" },
        { venueOutcomeId: "no", label: "No", indicativePrice: "900000" }],
      priceScale: "1000000", quantityScale: "1000000", minPriceTick: "1000",
      sourceKind: "VERIFIED_FIXTURE" as const, sourceReceivedAt: at,
      sourceRawHash: hash(sharedRawEvidence ? "shared-catalog-response" : `${listingRef}:raw`),
      protocolIdentity: "fixture:v1",
    };
  };
  const corpus = buildMarketCorpusSnapshot({ sourceSetIdentity: hash("source-set"),
    eligibleSourceCount: 1, excludedSourceCount: 0,
    listings: [listing("fixture:shot", "Will Trump be shot in August?"),
      listing("fixture:cola", "Will Trump drink cola on a September livestream?")] });
  const runtime = buildAgentRuntimeDefinition({ kind: "CODEX", version: "test-v1" });
  const credential = buildCredentialBinding({ kind: "CODEX_OAUTH",
    logicalAccountRef: "codex-oauth:test", resolverKind: "CODEX_AUTH_CACHE",
    resolverRef: "codex-auth-cache:test" });
  const model = buildModelProfile({ profileKey: "terra-test", revision: 1,
    accessDriver: "CODEX_RESPONSES", model: "gpt-5.6-terra",
    configuration: { schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort: "high" }, responseStorage: false }, createdAt: at });
  const profile = buildExecutionProfile({ profileKey: "world-relation-test", revision: 1,
    runtimeDefinition: runtime, credentialBinding: credential, modelProfile: model,
    toolProtocol: WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL,
    runBudget: { maximumModelInvocations: 12, maximumToolCalls: 24,
      maximumWallClockMs: 300_000, maximumInputTokens: "1000000",
      maximumOutputTokens: "100000" }, createdAt: at });
  const task = buildAgentTask({ kind: "WORLD_RELATION_EXPERIMENT",
    protocol: "WORLD_RELATION_EXPERIMENT_TASK_V1", inputArtifacts: [{
      kind: "WORLD_RELATION_FRONTIER", artifactId: frontier.frontierId,
      artifactHash: frontier.artifactHash,
    }], taskPayload: { frontierId: frontier.frontierId,
      corpusSnapshotIdentity: corpus.snapshotIdentity },
    requestedEffectProtocol: WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL,
    provenanceRef: `world-relation:${frontier.frontierId}`, priority: 50, createdAt: at });
  const run = buildAgentRun({ task, executionProfile: profile, runOrdinal: 1,
    authorization: { kind: "MANUAL", authorizationRef: "operator:test", authorizedAt: at },
    createdAt: at });
  const host = new WorldRelationExperimentAgentToolHost(frontier, corpus);
  const call = async (toolName: string, input: unknown) => host.execute({
    run, task, executionProfile: profile, callId: `call:${toolName}`, toolName, input,
  } satisfies AgentToolHostContext);
  return { shot, capacity, cola, frontier, corpus, runtime, credential, model,
    profile, task, run, host, call };
}

describe("world relation Agent tools", () => {
  it("rejects an adverse world that already has an economic projection", async () => {
    const work = fixture();
    const stateId = work.frontier.predicates.map(() => "T").sort().join("");
    const hypothesis: WorldRelationShadowTradeHypothesis = Object.freeze({
      schemaVersion: "pmh.world-relation-shadow-trade-hypothesis.v2",
      hypothesisId: hash("projected-hypothesis"),
      sourceExperimentArtifactHash: hash("prior-experiment"),
      sourceInputRevisionId: hash("prior-input"),
      sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
      quoteCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
      adverseWorldStateId: stateId, adverseListingStateId: "TF", legs: [],
      payoffShape: Object.freeze({ commonPriceScale: "1000000",
        minimumNonAdversePayoutUnits: "1000000", adversePayoutUnits: "0",
        totalIndicativeCostUnits: "1100000", grossFailureBudgetUnits: "-100000",
        breakEvenAdverseProbabilityUpperPpm: "0",
        formula: "MIN_NON_ADVERSE_PAYOUT_MINUS_COST_MINUS_ADVERSE_PROBABILITY_TAIL" }),
      status: "NON_POSITIVE_INDICATIVE_MARGIN",
      blockers: Object.freeze(["ADVERSE_PROBABILITY_BOUND_UNAVAILABLE",
        "NON_POSITIVE_INDICATIVE_FAILURE_BUDGET"]),
      quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH",
      quoteRefreshPosture: "CURRENT_LISTING_REF_MATCH_OVER_RETAINED_SEMANTIC_INPUT",
      guaranteedProfit: false, verifierEligible: false,
      authority: "SHADOW_TRADE_HYPOTHESIS_ONLY", semanticDecisionAuthority: false,
      probabilityAuthority: false, certificateAuthority: false,
      executionAuthority: false, externalWriteAuthority: false, valueMovingAuthority: false,
    });
    const routeAction = buildWorldRelationShadowRoutingProjection([hypothesis]).actions[0]!;
    const memory = buildWorldRelationEconomicMemory({ hypothesis, routeAction,
      sourceFrontierArtifactHash: work.frontier.artifactHash });
    const host = new WorldRelationExperimentAgentToolHost(
      work.frontier, work.corpus, [], [], [memory],
    );
    const call = (toolName: string, input: unknown) => host.execute({
      run: work.run, task: work.task, executionProfile: work.profile,
      callId: `call:memory:${toolName}`, toolName, input,
    });
    const context = await call("read_world_relation_context", {});
    expect(context).toMatchObject({ status: "ACCEPTED",
      output: { priorEconomicMemory: [{ memoryId: memory.memoryId }] } });
    await call("open_world_relation_hypothesis", {
      predictedConstraint: "Test a distinct state only.",
      supportingObservation: "Prior state exists.",
      falsifyingObservation: "A different assignment survives.",
      rationale: "Avoid repeated token spend.",
    });
    await call("search_world_relation_corpus", { patterns: ["Trump"], syntax: "LITERAL",
      mode: "ANY", fields: ["title"], venueIds: [], limit: 10 });
    await call("close_world_relation_search", {});
    await call("inspect_world_relation_listings", {
      listingRefs: ["fixture:shot", "fixture:cola"],
    });
    await expect(call("select_active_counterworld", {
      truePredicateIds: work.frontier.predicates.map((item) => item.predicateId),
      falsePredicateIds: [], description: "Repeat the economically projected world.",
    })).resolves.toMatchObject({ status: "REJECTED",
      output: { diagnostic: expect.stringContaining("already has an economic projection") } });
    expect(host.counterworld()).toBeNull();
  });

  it("supports multi-neighborhood search and binds an explicit complete counterworld", async () => {
    const work = fixture();
    expect(work.host.manifest(WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL).map((item) => item.name))
      .toEqual(["read_world_relation_context"]);
    await work.call("read_world_relation_context", {});
    await work.call("open_world_relation_hypothesis", {
      predictedConstraint: "Shooting may inhibit a later personal appearance through capacity.",
      supportingObservation: "The intervals are ordered and concern the same person.",
      falsifyingObservation: "A mild shooting followed by recovery and the public action.",
      rationale: "Test a soft state-mediated relation rather than hard exclusion.",
    });
    await work.call("search_world_relation_corpus", {
      patterns: ["shot"], syntax: "LITERAL", mode: "ANY", fields: ["title"],
      venueIds: [], limit: 10,
    });
    expect(work.host.manifest(WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL).map((item) => item.name))
      .toEqual(["search_world_relation_corpus", "close_world_relation_search"]);
    await work.call("search_world_relation_corpus", {
      patterns: ["cola", "livestream"], syntax: "LITERAL", mode: "ALL",
      fields: ["title", "rulesText"], venueIds: [], limit: 10,
    });
    await work.call("close_world_relation_search", {});
    await work.call("inspect_world_relation_listings", {
      listingRefs: ["fixture:shot", "fixture:cola"],
    });
    await expect(work.call("search_world_relation_corpus", {
      patterns: ["stale"], syntax: "LITERAL", mode: "ANY", fields: ["title"],
      venueIds: [], limit: 10,
    })).rejects.toThrow(/not legal in the current state/iu);
    await expect(work.call("select_active_counterworld", {
      truePredicateIds: [work.shot.predicateId, work.cola.predicateId],
      falsePredicateIds: [], description: "Incomplete on purpose.",
    })).rejects.toThrow(/partition every frontier predicate exactly once/iu);
    await work.call("select_active_counterworld", {
      truePredicateIds: [work.shot.predicateId, work.capacity.predicateId, work.cola.predicateId],
      falsePredicateIds: [],
      description: "The shooting occurs, incapacity is present, yet the later personal act occurs.",
    });
    await work.call("record_active_counterworld_outcome", {
      outcome: "SURVIVES", description: "A broad shooting can be minor; the adverse world remains possible.",
    });
    await expect(work.call("submit_world_relation_terminal", {
      disposition: "SUPPORTED_HARD", rationale: "Incorrectly claim a hard relation.",
    })).resolves.toMatchObject({ status: "REJECTED" });
    await expect(work.call("submit_world_relation_terminal", {
      disposition: "SUPPORTED_PROBABILISTIC",
      rationale: "The relation remains a probabilistic inhibition candidate with an explicit surviving counterworld.",
    })).resolves.toMatchObject({ status: "ACCEPTED" });

    expect(work.host.searches()).toHaveLength(2);
    expect(work.host.counterworld()?.truthByPredicateId).toEqual({
      [work.shot.predicateId]: true, [work.capacity.predicateId]: true,
      [work.cola.predicateId]: true,
    });
  });

  it("compiles only host-bound state with exact run, effect, invocation, and token lineage", async () => {
    const work = fixture();
    await work.call("read_world_relation_context", {});
    await work.call("open_world_relation_hypothesis", {
      predictedConstraint: "A state-mediated inhibition may exist.",
      supportingObservation: "Shared subject and ordered intervals.",
      falsifyingObservation: "The later act occurs despite the inhibiting state.",
      rationale: "Retain a falsifiable probabilistic relationship.",
    });
    await work.call("search_world_relation_corpus", { patterns: ["Trump"], syntax: "LITERAL",
      mode: "ANY", fields: ["title"], venueIds: [], limit: 10 });
    await work.call("close_world_relation_search", {});
    await work.call("inspect_world_relation_listings", { listingRefs: ["fixture:shot"] });
    await work.call("select_active_counterworld", {
      truePredicateIds: [work.shot.predicateId, work.capacity.predicateId],
      falsePredicateIds: [work.cola.predicateId],
      description: "Shooting and incapacity occur while the later action does not.",
    });
    await work.call("record_active_counterworld_outcome", {
      outcome: "INCONCLUSIVE", description: "The retained rules do not establish causal direction.",
    });
    await work.call("submit_world_relation_terminal", {
      disposition: "UNRESOLVED", rationale: "Evidence is insufficient; retain bounded negative memory.",
    });
    const invocations = [
      buildModelInvocation({ run: work.run, modelProfile: work.model, ordinal: 1,
        status: "SUCCEEDED", startedAt: at, completedAt: "2026-08-14T00:00:01.000Z",
        inputTokens: "100", outputTokens: "20", reasoningTokens: "5",
        purpose: "PRIMARY_REASONING" }),
      buildModelInvocation({ run: work.run, modelProfile: work.model, ordinal: 2,
        status: "SUCCEEDED", startedAt: "2026-08-14T00:00:01.000Z",
        completedAt: "2026-08-14T00:00:02.000Z", inputTokens: "200",
        outputTokens: "30", reasoningTokens: "7", purpose: "TOOL_CONTINUATION" }),
    ];
    const effects = invocations.map((invocation, index) => buildAgentToolEffect({
      run: work.run, ordinal: index + 1,
      toolProtocol: WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL,
      toolName: index === 0 ? "read_world_relation_context" : "submit_world_relation_terminal",
      status: "ACCEPTED", canonicalInput: {}, canonicalOutput: { accepted: true },
      diagnostic: null, sourceInvocation: invocation, occurredAt: invocation.completedAt,
    }));
    const completed = completeAgentRun(work.run, "SUCCEEDED",
      "2026-08-14T00:00:03.000Z", null);
    const experiment = compileWorldRelationExperimentFromRun({ host: work.host,
      execution: { run: completed, modelInvocations: invocations, toolEffects: effects,
        runArtifacts: [], finalArtifactHash: hash("final"), runtimeKind: "CODEX",
        credentialBindingId: work.credential.credentialBindingId,
        secretMaterialRetained: false } });

    expect(experiment.terminalDisposition).toBe("UNRESOLVED");
    expect(experiment.sourceAgentRunId).toBe(work.run.runId);
    expect(experiment.sourceToolEffectIds).toEqual(
      effects.map((item) => item.effectId).sort(),
    );
    expect(experiment.invocationIds).toEqual(
      invocations.map((item) => item.invocationId).sort(),
    );
    expect(experiment.usage).toEqual({ inputTokens: "300", outputTokens: "50",
      reasoningTokens: "12" });
    expect(experiment.adverseAssignments[0]?.truthByPredicateId[work.cola.predicateId])
      .toBe(false);
    expect(experiment.counterworlds[0]?.result).toBe("INCONCLUSIVE");

    const assignment = buildWorldRelationExperimentAssignment({
      frontier: work.frontier,
      corpus: work.corpus,
    });
    const checkpoint = checkpointWorldRelationExperimentRun({
      host: work.host,
      inputRevisionId: assignment.inputRevision.inputRevisionId,
      execution: { run: completed, modelInvocations: invocations, toolEffects: effects,
        runArtifacts: [], finalArtifactHash: hash("final"), runtimeKind: "CODEX",
        credentialBindingId: work.credential.credentialBindingId,
        secretMaterialRetained: false },
    });
    expect(checkpoint.authority).toBe("FIRST_PARTY_REPLAYABLE_TOOL_HOST_STATE");
    expect(checkpoint.sourceAgentRunId).toBe(completed.runId);
    expect(compileWorldRelationExperimentFromCheckpoint({
      checkpoint,
      inputRevision: assignment.inputRevision,
      corpus: assignment.corpus,
      projections: assignment.projections,
    })).toEqual(experiment);
    expect(() => compileWorldRelationExperimentFromCheckpoint({
      checkpoint,
      inputRevision: buildWorldRelationExperimentAssignment({
        frontier: work.frontier,
        corpus: buildMarketCorpusSnapshot({ sourceSetIdentity: hash("other-source"),
          eligibleSourceCount: 1, excludedSourceCount: 0,
          listings: work.corpus.listings }),
      }).inputRevision,
      corpus: assignment.corpus,
    })).toThrow(/does not bind the exact retained input/iu);
  });

  it("deduplicates shared raw catalog evidence across inspected listings", async () => {
    const work = fixture(true);
    await work.call("read_world_relation_context", {});
    await work.call("open_world_relation_hypothesis", {
      predictedConstraint: "A state-mediated inhibition may exist.",
      supportingObservation: "Shared subject and ordered intervals.",
      falsifyingObservation: "The later act occurs despite the inhibiting state.",
      rationale: "Retain a bounded relation experiment.",
    });
    await work.call("search_world_relation_corpus", { patterns: ["Trump"], syntax: "LITERAL",
      mode: "ANY", fields: ["title"], venueIds: [], limit: 10 });
    await work.call("close_world_relation_search", {});
    await work.call("inspect_world_relation_listings", {
      listingRefs: ["fixture:shot", "fixture:cola"],
    });
    await work.call("select_active_counterworld", {
      truePredicateIds: [work.shot.predicateId, work.capacity.predicateId],
      falsePredicateIds: [work.cola.predicateId],
      description: "Shooting and incapacity occur while the later action does not.",
    });
    await work.call("record_active_counterworld_outcome", {
      outcome: "INCONCLUSIVE", description: "The retained rules do not establish direction.",
    });
    await work.call("submit_world_relation_terminal", {
      disposition: "UNRESOLVED", rationale: "Keep the bounded negative memory.",
    });
    const invocation = buildModelInvocation({ run: work.run, modelProfile: work.model, ordinal: 1,
      status: "SUCCEEDED", startedAt: at, completedAt: "2026-08-14T00:00:01.000Z",
      inputTokens: "100", outputTokens: "20", reasoningTokens: "5",
      purpose: "PRIMARY_REASONING" });
    const effect = buildAgentToolEffect({ run: work.run, ordinal: 1,
      toolProtocol: WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL,
      toolName: "submit_world_relation_terminal", status: "ACCEPTED",
      canonicalInput: {}, canonicalOutput: { accepted: true }, diagnostic: null,
      sourceInvocation: invocation, occurredAt: invocation.completedAt });
    const completed = completeAgentRun(work.run, "SUCCEEDED",
      "2026-08-14T00:00:02.000Z", null);
    const experiment = compileWorldRelationExperimentFromRun({
      host: work.host,
      execution: { run: completed, modelInvocations: [invocation], toolEffects: [effect],
        runArtifacts: [], finalArtifactHash: hash("final-shared"), runtimeKind: "CODEX",
        credentialBindingId: work.credential.credentialBindingId,
        secretMaterialRetained: false },
    });
    expect(experiment.counterworlds[0]?.evidenceBindingHashes)
      .toEqual([hash("shared-catalog-response")]);
  });
});
