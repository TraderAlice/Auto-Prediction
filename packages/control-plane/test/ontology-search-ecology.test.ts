import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertOntologySearchIssueRevision,
  assertMarketOntologyAgentProposal,
  buildAgentRun,
  buildAgentTask,
  buildAgentToolEffect,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildModelInvocation,
  buildOntologySearchYieldProjection,
  completeAgentRun,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  reconcileOntologySearchIssueRevisions,
  SqliteOperationalStore,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const RECEIVED_AT = "2026-08-12T09:00:00.000Z";

function listing(
  listingRef: string,
  title: string,
  sourceReceivedAt = RECEIVED_AT,
): DiscoveryCatalogListing {
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
    sourceReceivedAt,
    sourceRawHash: hashCanonical({ listingRef, title }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture(sourceReceivedAt = RECEIVED_AT) {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-ecology-test" }),
    eligibleSourceCount: 3,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?", sourceReceivedAt),
      listing("venue-b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic presidential nomination?", sourceReceivedAt),
      listing("venue-c:alice", "Will Alice Johnson win the 2028 governor election?", sourceReceivedAt),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  return { corpus, ontology };
}

describe("ontology search ecology", () => {
  it("keeps one issue task across exact input and coverage revisions", () => {
    const firstInput = fixture();
    const first = reconcileOntologySearchIssueRevisions({
      ...firstInput,
      proposals: [],
      retainedRevisions: [],
    });
    const refreshedInput = fixture("2026-08-12T10:00:00.000Z");
    const refreshed = reconcileOntologySearchIssueRevisions({
      ...refreshedInput,
      proposals: [],
      retainedRevisions: first.currentRevisions,
    });

    expect(refreshedInput.corpus.snapshotIdentity)
      .not.toBe(firstInput.corpus.snapshotIdentity);
    expect(refreshed.currentRevisions.map((item) => item.issueId))
      .toEqual(first.currentRevisions.map((item) => item.issueId));
    expect(refreshed.currentRevisions.map((item) => item.task.taskId))
      .toEqual(first.currentRevisions.map((item) => item.task.taskId));
    expect(refreshed.currentRevisions.map((item) => item.revisionId))
      .not.toEqual(first.currentRevisions.map((item) => item.revisionId));
    expect(refreshed.createdRevisionIds).toHaveLength(refreshed.currentRevisions.length);
    expect(refreshed.reusedRevisionIds).toEqual([]);
    expect(refreshed.effects).toEqual({
      providerRequests: 0,
      modelInvocations: 0,
      runs: 0,
      campaigns: 0,
      dispatches: 0,
      externalWrites: 0,
      valueMovingActions: 0,
    });

    const exactReplay = reconcileOntologySearchIssueRevisions({
      ...refreshedInput,
      proposals: [],
      retainedRevisions: refreshed.currentRevisions,
    });
    expect(exactReplay.createdRevisionIds).toEqual([]);
    expect(exactReplay.reusedRevisionIds)
      .toEqual(refreshed.currentRevisions.map((item) => item.revisionId).sort());

    const issue = refreshed.currentRevisions[0]!;
    const node = issue.taskPayload.listingEvidence[0]!.node;
    const proposalBody = Object.freeze({
      schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
      kind: "WORLD_PROPOSITION" as const,
      ontologyIdentity: issue.ontologyIdentity,
      sourceSnapshotIdentity: issue.sourceSnapshotIdentity,
      sourceAgentRunId: hashCanonical({ run: "coverage-only" }),
      sourceTrailheadIds: Object.freeze([issue.trailheadIds[0]!]),
      sourceRelationPatternIds: Object.freeze([issue.relationPatternId]),
      listingBindings: Object.freeze([Object.freeze({
        listingRef: node.listingRef,
        nodeId: node.nodeId,
        worldFacetId: node.worldFacet.facetId,
        settlementFacetId: node.settlementFacet.facetId,
        tradedFacetId: node.tradedFacet.facetId,
      })]),
      rationale: "Coverage changes the issue observation, not the durable assignment.",
      proposedAt: "2026-08-12T10:01:00.000Z",
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
      label: "A retained world proposition",
      subjectLabels: Object.freeze(["Mark Kelly"]),
      predicate: "retained predicate",
      timeScope: null,
      parameters: Object.freeze([]),
      ambiguityNotes: Object.freeze([]),
      falsifiers: Object.freeze(["The assigned listing concerns another subject."]),
    });
    const proposal = assertMarketOntologyAgentProposal(Object.freeze({
      ...proposalBody,
      proposalId: hashCanonical(proposalBody),
    }));
    const covered = reconcileOntologySearchIssueRevisions({
      ...refreshedInput,
      proposals: [proposal],
      retainedRevisions: refreshed.currentRevisions,
    });
    const coveredIssue = covered.currentRevisions.find((item) => item.issueId === issue.issueId)!;
    expect(coveredIssue.task.taskId).toBe(issue.task.taskId);
    expect(coveredIssue.revisionId).not.toBe(issue.revisionId);
    expect(coveredIssue).toMatchObject({
      coverageState: "PROPOSAL_RECORDED",
      campaignEligible: false,
      matchedProposalIds: [proposal.proposalId],
    });
  });

  it("replays legacy corpus-bound v1 revisions without rewriting them", () => {
    const { corpus, ontology } = fixture();
    const current = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    })[0]!;
    if (current.schemaVersion !== "pmh.ontology-search-issue-revision.v2") {
      throw new Error("test requires the successor issue revision");
    }
    const legacyTask = buildAgentTask({
      kind: "ONTOLOGY_NORMALIZATION",
      protocol: "MARKET_ONTOLOGY_NORMALIZATION_TASK_V1",
      inputArtifacts: [{
        kind: "MARKET_ONTOLOGY",
        artifactId: current.ontologyIdentity,
        artifactHash: current.ontologyIdentity,
      }],
      taskPayload: current.taskPayload,
      requestedEffectProtocol: current.task.requestedEffectProtocol,
      provenanceRef: current.task.provenanceRef,
      priority: current.task.priority,
      createdAt: current.materializedAt,
    });
    const { revisionId: _revisionId, taskContract: _taskContract,
      schemaVersion: _schemaVersion, task: _task, ...retained } = current;
    const body = Object.freeze({
      schemaVersion: "pmh.ontology-search-issue-revision.v1" as const,
      ...retained,
      task: legacyTask,
    });
    const legacy = Object.freeze({ ...body, revisionId: hashCanonical(body) });

    expect(assertOntologySearchIssueRevision(legacy)).toBe(legacy);
    expect(legacy.task.taskId).not.toBe(current.task.taskId);
    expect(legacy.taskPayload).toEqual(current.taskPayload);

    const store = new SqliteOperationalStore(":memory:");
    store.saveAgentExecutionBatch({ tasks: [legacy.task, current.task] });
    store.saveOntologySearchIssueRevisions([legacy, current]);
    const replayed = store.loadOntologySearchIssueRevisions(10);
    expect(replayed).toContainEqual(legacy);
    expect(replayed).toContainEqual(current);
    store.close();
  });

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
      downstreamRelationWorkAttribution: {
        status: "NOT_YET_CONNECTED",
        workItemCount: 0,
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

  it("retains issue yield when a newer ontology snapshot changes the task ID", () => {
    const { corpus, ontology } = fixture();
    const revisions = materializeOntologySearchIssueRevisions({
      corpus,
      ontology,
      proposals: [],
    });
    const revision = revisions[0]!;
    const historicalTask = buildAgentTask({
      kind: "ONTOLOGY_NORMALIZATION",
      protocol: revision.task.protocol,
      inputArtifacts: revision.task.inputArtifacts,
      taskPayload: { schemaVersion: "historical-ontology-payload.v1" },
      requestedEffectProtocol: revision.task.requestedEffectProtocol,
      provenanceRef: revision.task.provenanceRef,
      priority: revision.task.priority,
      createdAt: "2026-08-11T09:00:00.000Z",
    });
    expect(historicalTask.taskId).not.toBe(revision.task.taskId);
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(
      { PMH_DISCOVERY_PROVIDER: "codex" },
      () => Date.parse(RECEIVED_AT),
    ));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "ONTOLOGY_NORMALIZATION"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const model = portfolio.modelProfiles.find((item) =>
      item.modelProfileId === profile.modelProfileId
    )!;
    const prepared = buildAgentRun({
      task: historicalTask,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:historical-yield-test",
        authorizedAt: "2026-08-11T09:00:00.000Z",
      },
      createdAt: "2026-08-11T09:00:00.000Z",
    });
    const run = completeAgentRun(
      prepared,
      "SUCCEEDED",
      "2026-08-11T09:01:00.000Z",
      null,
    );
    const invocation = buildModelInvocation({
      run,
      modelProfile: model,
      ordinal: 1,
      status: "SUCCEEDED",
      startedAt: "2026-08-11T09:00:00.000Z",
      completedAt: "2026-08-11T09:00:30.000Z",
      inputTokens: "1234",
      outputTokens: "56",
      reasoningTokens: "12",
    });
    const effect = buildAgentToolEffect({
      run,
      ordinal: 1,
      toolProtocol: revision.task.requestedEffectProtocol,
      toolName: "propose_world_proposition",
      status: "ACCEPTED",
      canonicalInput: { label: "historical proposition" },
      canonicalOutput: { accepted: true },
      occurredAt: "2026-08-11T09:00:30.000Z",
    });
    const node = revision.taskPayload.listingEvidence[0]!.node;
    const proposalBody = Object.freeze({
      schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
      kind: "WORLD_PROPOSITION" as const,
      ontologyIdentity: revision.ontologyIdentity,
      sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
      sourceAgentRunId: run.runId,
      sourceTrailheadIds: Object.freeze([revision.trailheadIds[0]!]),
      sourceRelationPatternIds: Object.freeze([revision.relationPatternId]),
      listingBindings: Object.freeze([Object.freeze({
        listingRef: node.listingRef,
        nodeId: node.nodeId,
        worldFacetId: node.worldFacet.facetId,
        settlementFacetId: node.settlementFacet.facetId,
        tradedFacetId: node.tradedFacet.facetId,
      })]),
      rationale: "Historical evidence named the proposition.",
      proposedAt: "2026-08-11T09:00:30.000Z",
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
      label: "Mark Kelly charged with a federal crime in 2026",
      subjectLabels: Object.freeze(["Mark Kelly"]),
      predicate: "charged_with_federal_crime",
      timeScope: "2026",
      parameters: Object.freeze([]),
      ambiguityNotes: Object.freeze(["The legal definition remains venue-specific."]),
      falsifiers: Object.freeze(["The retained listing names a different person."]),
    });
    const proposal = assertMarketOntologyAgentProposal(Object.freeze({
      ...proposalBody,
      proposalId: hashCanonical(proposalBody),
    }));
    const execution = Object.freeze({
      ...emptyAgentExecutionSnapshot(),
      ...portfolio,
      tasks: Object.freeze([historicalTask, ...revisions.map((item) => item.task)]),
      runs: Object.freeze([run]),
      modelInvocations: Object.freeze([invocation]),
      toolEffects: Object.freeze([effect]),
    });

    const projection = buildOntologySearchYieldProjection({
      revisions,
      proposals: [proposal],
      execution,
    });

    expect(projection).toMatchObject({
      attemptedIssueCount: 1,
      proposalCoveredIssueCount: 1,
      runCount: 1,
      succeededRunCount: 1,
      modelInvocationCount: 1,
      acceptedToolEffectCount: 1,
      proposalCounts: { worldProposition: 1 },
      usage: {
        knownInputTokens: "1234",
        knownOutputTokens: "56",
        knownReasoningTokens: "12",
      },
    });
    expect(projection.byIssue.find((item) => item.issueId === revision.issueId))
      .toMatchObject({ runCount: 1, proposalCount: 1, knownInputTokens: "1234" });
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
      schemaVersion: 41,
      idempotencyKey: "revisionId",
    });
    store.close();
  });
});
