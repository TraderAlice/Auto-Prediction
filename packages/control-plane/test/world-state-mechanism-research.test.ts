import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  buildAgentRun,
  buildAgentToolEffect,
  buildModelInvocation,
  buildRetainedWorldStateMechanismMemory,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildWorldStateMechanismCampaignPreview,
  buildWorldStateMechanismResearchYield,
  buildPausedAgentCampaign,
  buildWorldStateMechanismProposal,
  defaultAiRuntimeConfiguration,
  completeAgentRun,
  compileConsolidatedWorldStateMechanismRoutes,
  materializeOntologySearchIssueRevisions,
  materializeWorldStateMechanismResearchAssignments,
  MarketOntologyAgentToolHost,
  resolveWorldStateMechanismTaskRevision,
  WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

function listing(ref: string, title: string, receivedAt = NOW): DiscoveryCatalogListing {
  const [venueId, venueInstrumentId] = ref.split(":") as [string, string];
  return Object.freeze({
    listingRef: ref, venueId, venueInstrumentId, title, description: title,
    status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-10-01T00:00:00.000Z", rulesText: "Official resolution.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "400000000000000000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "600000000000000000" }),
    ]),
    priceScale: "1000000000000000000", quantityScale: "1000000000000000000",
    minPriceTick: "1", sourceKind: "LIVE_OBSERVATION", sourceReceivedAt: receivedAt,
    sourceRawHash: hashCanonical({ ref }), protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture(receivedAt = NOW) {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ fixture: "mechanism-research" }),
    eligibleSourceCount: 2, excludedSourceCount: 0,
    listings: [
      listing("a:trump-shot", "Will Trump be shot during August?", receivedAt),
      listing("b:trump-cola", "Will Trump livestream drinking cola during September?", receivedAt),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({
    ontology, corpus, proposals: [],
  });
  const assignments = materializeWorldStateMechanismResearchAssignments({
    revisions, proposals: [], counterexamples: [], abstentions: [],
  });
  return { corpus, ontology, revisions, assignments };
}

function twoIssueFixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ fixture: "mechanism-rotation" }),
    eligibleSourceCount: 2, excludedSourceCount: 0,
    listings: [
      listing("a:trump-shot", "Will Trump be shot during August?"),
      listing("b:trump-cola", "Will Trump livestream drinking cola during September?"),
      listing("a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic nomination?"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({ ontology, corpus, proposals: [] });
  const assignments = materializeWorldStateMechanismResearchAssignments({
    revisions, proposals: [], counterexamples: [], abstentions: [],
  });
  return { revisions, assignments };
}

describe("world-state mechanism research role", () => {
  it("accounts for retained mechanism memory across assignment windows", () => {
    const work = fixture();
    const assignment = work.assignments[0]!;
    const revision = work.revisions.find((item) =>
      item.revisionId === assignment.sourceRevisionId
    )!;
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const model = portfolio.modelProfiles.find((item) =>
      item.modelProfileId === profile.modelProfileId
    )!;
    const sourceRun = buildAgentRun({
      task: assignment.task, executionProfile: profile, runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:memory-test",
        authorizedAt: NOW },
      createdAt: NOW,
    });
    const proposal = buildWorldStateMechanismProposal({
      ontologyIdentity: revision.ontologyIdentity,
      sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
      sourceIssueRevisionId: revision.revisionId,
      sourceAgentRunId: sourceRun.runId,
      sourceTrailheadIds: [revision.trailheadIds[0]!],
      sourceRelationPatternIds: [revision.relationPatternId],
      subjectLabel: "Trump", subjectAliases: ["Trump"],
      subjectAmbiguityNotes: ["The exact role listings must bind the same person."],
      trigger: {
        predicateLabel: "is shot during August", searchSignals: ["shot", "August"],
        influence: "MAY_DEGRADE_STATE",
        evidenceBindings: [{
          listingRef: "a:trump-shot", title: "Will Trump be shot during August?",
          nodeId: hashCanonical({ node: "shot" }), worldFacetId: hashCanonical({ facet: "shot" }),
          sourceRawHash: hashCanonical({ raw: "shot" }), protocolIdentity: "protocol:a:v1",
        }],
      },
      state: { dimension: "PHYSICAL_CAPABILITY", label: "Trump can appear publicly" },
      dependent: {
        predicateLabel: "livestreams drinking cola during September",
        searchSignals: ["livestream", "cola", "September"],
        requirement: "STATE_INFLUENCES_LIKELIHOOD",
        evidenceBindings: [{
          listingRef: "b:trump-cola", title: "Will Trump livestream drinking cola during September?",
          nodeId: hashCanonical({ node: "cola" }), worldFacetId: hashCanonical({ facet: "cola" }),
          sourceRawHash: hashCanonical({ raw: "cola" }), protocolIdentity: "protocol:b:v1",
        }],
      },
      temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
      counterScenarios: ["A non-fatal injury does not prevent the later appearance."],
      rationale: "A world-state mechanism worth falsifying.", proposedAt: NOW,
    });
    const routes = compileConsolidatedWorldStateMechanismRoutes([proposal]);
    const known = buildModelInvocation({
      run: sourceRun, modelProfile: model, ordinal: 1, status: "SUCCEEDED",
      startedAt: NOW, completedAt: NOW, inputTokens: "1200", outputTokens: "80",
      reasoningTokens: "30", purpose: "PRIMARY_REASONING",
    });
    const unknown = buildModelInvocation({
      run: sourceRun, modelProfile: model, ordinal: 2, status: "FAILED",
      startedAt: NOW, completedAt: NOW, purpose: "TOOL_CONTINUATION",
      failureCategory: "PROVIDER_FAILURE",
    });
    const memory = buildRetainedWorldStateMechanismMemory({
      proposals: [proposal], routes, counterexamples: [], abstentions: [],
      execution: {
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        capabilityObservations: [], workloadRoutes: portfolio.workloadRoutes,
        campaigns: [], tasks: [assignment.task], runs: [sourceRun],
        modelInvocations: [known, unknown], toolEffects: [], runArtifacts: [],
        runAnnotations: [], resultSelections: [],
      },
    });
    expect(memory).toMatchObject({
      proposalCount: 1, routeCount: 1, sourceRunCount: 1,
      retainedSourceRunCount: 1, missingSourceRunCount: 0, modelInvocationCount: 2,
      usage: {
        knownInputTokens: "1200", knownOutputTokens: "80", knownReasoningTokens: "30",
        unknownUsageInvocationCount: 1,
      },
    });
    expect(buildRetainedWorldStateMechanismMemory({
      proposals: [proposal], routes, counterexamples: [], abstentions: [],
      execution: { ...portfolio, capabilityObservations: [], campaigns: [], tasks: [], runs: [],
        modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
        resultSelections: [] },
    })).toMatchObject({ sourceRunCount: 1, retainedSourceRunCount: 0, missingSourceRunCount: 1 });
  });

  it("materializes stable role tasks from exact ontology inputs", () => {
    const first = fixture();
    const second = materializeWorldStateMechanismResearchAssignments({
      revisions: first.revisions, proposals: [], counterexamples: [], abstentions: [],
    });
    expect(first.assignments.length).toBeGreaterThan(0);
    expect(second).toEqual(first.assignments);
    expect(first.assignments[0]).toMatchObject({
      coverageState: "UNEXPLORED",
      campaignEligible: true,
      automaticDispatch: false,
      task: {
        kind: "WORLD_STATE_MECHANISM_RESEARCH",
        requestedEffectProtocol: WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
      },
    });
  });

  it("cannot terminate through ordinary normalization results", () => {
    const work = fixture();
    const assignment = work.assignments[0]!;
    const revision = work.revisions.find((item) =>
      item.revisionId === assignment.sourceRevisionId
    )!;
    const emptyStore = {
      worldStateMechanismProposalStorage: { mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "proposalId" },
      loadWorldStateMechanismProposals: () => [],
      saveWorldStateMechanismProposals: (values: readonly never[]) => values,
    } as never;
    const host = MarketOntologyAgentToolHost.fromMechanismResearchRevision(
      assignment.taskContract,
      revision.taskPayload,
      emptyStore,
      {
        worldStateMechanismCounterexampleStorage: { mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "counterexampleId" },
        loadWorldStateMechanismCounterexamples: () => [],
        saveWorldStateMechanismCounterexamples: (values) => values,
      },
      {
        worldStateMechanismAbstentionStorage: { mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "abstentionId" },
        loadWorldStateMechanismAbstentions: () => [],
        saveWorldStateMechanismAbstentions: (values) => values,
      },
      revision.revisionId,
    );
    const manifestNames = host.manifest(WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL)
      .map((item) => item.name);
    expect(manifestNames).toEqual(expect.arrayContaining([
      "list_assigned_ontology_trailheads",
      "read_ontology_trailhead_evidence",
      "list_world_state_mechanism_coverage",
      "propose_world_state_mechanism",
      "record_world_state_mechanism_counterexample",
      "record_world_state_mechanism_abstention",
    ]));
    expect(manifestNames).not.toEqual(expect.arrayContaining([
      "propose_entity_alias", "propose_world_proposition", "record_ontology_counterexample",
    ]));
    expect(host.resultToolNames(WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL)).toEqual([
      "propose_world_state_mechanism",
      "record_world_state_mechanism_counterexample",
      "record_world_state_mechanism_abstention",
    ]);
  });

  it("builds an independently budgeted manual campaign and honest zero baseline", () => {
    const work = fixture();
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const execution = {
      runtimeDefinitions: portfolio.runtimeDefinitions,
      credentialBindings: portfolio.credentialBindings,
      modelProfiles: portfolio.modelProfiles,
      executionProfiles: portfolio.executionProfiles,
      workloadRoutes: portfolio.workloadRoutes,
      campaigns: [], tasks: work.assignments.map((item) => item.task), runs: [],
      modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
      resultSelections: [],
    };
    const capability = {
      schemaVersion: "pmh.execution-capability.v1", executionProfileId: profile.executionProfileId,
      runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH", accessDriver: "CODEX_RESPONSES",
      model: "gpt-5.6-terra", configured: true, credentialPresent: true,
      dispatchEligibility: "ELIGIBLE", diagnostic: "ready", observedAt: NOW,
      authority: "EXECUTION_CAPABILITY_ONLY", secretMaterialRetained: false,
      externalWriteAuthority: false, valueMovingAuthority: false,
    } as const;
    const preview = buildWorldStateMechanismCampaignPreview({
      assignments: work.assignments, revisions: work.revisions, execution, capability,
    });
    expect(preview).toMatchObject({
      schemaVersion: "pmh.world-state-mechanism-campaign-preview.v2",
      schedule: { kind: "MANUAL_ONLY" },
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 8 },
      taskIds: [preview.taskIds[0]],
      portfolioSelectedTaskCount: 1,
      terminallyAttemptedSelectedTaskCount: 0,
      specimenTaskLimit: 1,
      deferredSelectedTaskCount: 0,
      creationEligible: true,
      dispatchEligible: true,
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
    });
    expect(preview.taskIds).toHaveLength(1);
    expect(preview.selectionBinding.taskBindings).toHaveLength(1);
    expect(buildWorldStateMechanismResearchYield({
      assignments: work.assignments, execution,
    })).toMatchObject({
      eligibleCount: work.assignments.length,
      attemptedCount: 0, proposedCount: 0, abstainedCount: 0, falsifiedCount: 0,
      runCount: 0, modelInvocationCount: 0,
      usage: { inputTokens: "0", outputTokens: "0", reasoningTokens: "0" },
      outcomeStrata: expect.arrayContaining([{
        outcome: "NO_ACCEPTED_RESULT", runCount: 0, modelInvocationCount: 0,
        knownInputTokens: "0", knownOutputTokens: "0", knownReasoningTokens: "0",
        unknownUsageInvocationCount: 0,
      }]),
    });
  });

  it("rotates a bounded campaign specimen after any terminal mechanism attempt", () => {
    const { assignments, revisions } = twoIssueFixture();
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const capability = {
      schemaVersion: "pmh.execution-capability.v1", executionProfileId: profile.executionProfileId,
      runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH", accessDriver: "CODEX_RESPONSES",
      model: "gpt-5.6-terra", configured: true, credentialPresent: true,
      dispatchEligibility: "ELIGIBLE", diagnostic: "ready", observedAt: NOW,
      authority: "EXECUTION_CAPABILITY_ONLY", secretMaterialRetained: false,
      externalWriteAuthority: false, valueMovingAuthority: false,
    } as const;
    const baseExecution = {
      runtimeDefinitions: portfolio.runtimeDefinitions,
      credentialBindings: portfolio.credentialBindings,
      modelProfiles: portfolio.modelProfiles,
      executionProfiles: portfolio.executionProfiles,
      workloadRoutes: portfolio.workloadRoutes,
      campaigns: [], tasks: assignments.map((item) => item.task), runs: [],
      modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
      resultSelections: [],
    };
    const first = buildWorldStateMechanismCampaignPreview({
      assignments, revisions, execution: baseExecution, capability,
    });
    expect(first.taskIds).toHaveLength(1);
    const paused = buildPausedAgentCampaign({
      campaignKey: first.campaignKey, revision: 1,
      executionProfileId: profile.executionProfileId, taskIds: first.taskIds,
      schedule: first.schedule, budget: first.budget,
      selectionBinding: first.selectionBinding, taskRunPolicy: first.taskRunPolicy,
      createdAt: NOW,
    });
    const active = activateAgentCampaign(paused, "operator:rotation-test", NOW);
    const task = assignments.find((item) => item.task.taskId === first.taskIds[0])!.task;
    const terminal = completeAgentRun(buildAgentRun({
      task, executionProfile: profile, runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: NOW },
      createdAt: NOW,
    }), "FAILED", NOW, "bounded negative result");
    const rotated = buildWorldStateMechanismCampaignPreview({
      assignments, revisions,
      execution: { ...baseExecution, campaigns: [active], runs: [terminal] },
      capability,
    });
    expect(rotated.taskIds).toHaveLength(1);
    expect(rotated.taskIds[0]).not.toBe(first.taskIds[0]);
    expect(rotated).toMatchObject({
      portfolioSelectedTaskCount: 2,
      terminallyAttemptedSelectedTaskCount: 1,
      specimenTaskLimit: 1,
      deferredSelectedTaskCount: 0,
      creationEligible: true,
    });
    expect(rotated.campaignKey).not.toBe(first.campaignKey);
    expect(rotated.selectionBinding.taskBindings).toHaveLength(1);
  });

  it("resolves a frozen campaign revision without current assignment membership", () => {
    const work = fixture();
    const assignment = work.assignments[0]!;
    const revision = work.revisions.find((item) =>
      item.revisionId === assignment.sourceRevisionId
    )!;
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const preview = buildWorldStateMechanismCampaignPreview({
      assignments: [assignment],
      revisions: [revision],
      execution: {
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        workloadRoutes: portfolio.workloadRoutes,
        campaigns: [], tasks: [assignment.task], runs: [], modelInvocations: [],
        toolEffects: [], runArtifacts: [], runAnnotations: [], resultSelections: [],
      },
      capability: {
        schemaVersion: "pmh.execution-capability.v1",
        executionProfileId: profile.executionProfileId,
        runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH",
        accessDriver: "CODEX_RESPONSES", model: "gpt-5.6-terra",
        configured: true, credentialPresent: true, dispatchEligibility: "ELIGIBLE",
        diagnostic: "ready", observedAt: NOW, authority: "EXECUTION_CAPABILITY_ONLY",
        secretMaterialRetained: false, externalWriteAuthority: false,
        valueMovingAuthority: false,
      },
    });
    const paused = buildPausedAgentCampaign({
      campaignKey: preview.campaignKey,
      revision: 1,
      executionProfileId: profile.executionProfileId,
      taskIds: preview.taskIds,
      schedule: preview.schedule,
      budget: preview.budget,
      selectionBinding: preview.selectionBinding,
      taskRunPolicy: preview.taskRunPolicy,
      createdAt: NOW,
    });
    const active = activateAgentCampaign(paused, "operator:frozen-replay", NOW);
    const run = buildAgentRun({
      task: assignment.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: NOW },
      createdAt: NOW,
    });

    expect(resolveWorldStateMechanismTaskRevision({
      taskId: assignment.task.taskId,
      run,
      campaigns: [active],
      assignments: [],
      currentRevisions: [],
      loadRevision: (revisionId) => revisionId === revision.revisionId ? revision : null,
    })).toEqual(revision);
    expect(() => resolveWorldStateMechanismTaskRevision({
      taskId: assignment.task.taskId,
      run,
      campaigns: [active],
      assignments: [],
      currentRevisions: [],
      loadRevision: () => null,
    })).toThrow(/cannot be resolved/);
  });

  it("counts accepted terminal effects immediately and excludes rejected repair attempts", () => {
    const work = fixture();
    const assignment = work.assignments[0]!;
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const prepared = buildAgentRun({
      task: assignment.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:yield", authorizedAt: NOW },
      createdAt: NOW,
    });
    const run = completeAgentRun(prepared, "SUCCEEDED", NOW, null);
    const rejected = buildAgentToolEffect({
      run,
      ordinal: 1,
      toolProtocol: WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
      toolName: "propose_world_state_mechanism",
      status: "REJECTED",
      canonicalInput: { attempt: 1 },
      canonicalOutput: { accepted: false },
      occurredAt: NOW,
    });
    const execution = {
      runtimeDefinitions: portfolio.runtimeDefinitions,
      credentialBindings: portfolio.credentialBindings,
      modelProfiles: portfolio.modelProfiles,
      executionProfiles: portfolio.executionProfiles,
      workloadRoutes: portfolio.workloadRoutes,
      campaigns: [], tasks: [assignment.task], runs: [run], modelInvocations: [],
      toolEffects: [rejected], runArtifacts: [], runAnnotations: [], resultSelections: [],
    };
    expect(buildWorldStateMechanismResearchYield({
      assignments: work.assignments,
      execution,
    })).toMatchObject({ proposedCount: 0, acceptedResultCount: 0 });

    const accepted = buildAgentToolEffect({
      run,
      ordinal: 2,
      toolProtocol: WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
      toolName: "propose_world_state_mechanism",
      status: "ACCEPTED",
      canonicalInput: { attempt: 2 },
      canonicalOutput: { accepted: true },
      occurredAt: NOW,
    });
    expect(buildWorldStateMechanismResearchYield({
      assignments: work.assignments,
      execution: { ...execution, toolEffects: [rejected, accepted] },
    })).toMatchObject({
      proposedCount: 1,
      acceptedResultCount: 1,
      outcomeStrata: expect.arrayContaining([expect.objectContaining({
        outcome: "PROPOSAL",
        runCount: 1,
      })]),
    });
  });

  it("carries evidence-bound mechanism coverage across exact revision snapshots", () => {
    const historical = fixture("2026-08-13T11:00:00.000Z");
    const current = fixture("2026-08-13T12:00:00.000Z");
    const historicalRevision = historical.revisions[0]!;
    const currentRevision = current.revisions.find((item) =>
      item.issueId === historicalRevision.issueId
    )!;
    expect(currentRevision.revisionId).not.toBe(historicalRevision.revisionId);
    const proposal = buildWorldStateMechanismProposal({
      ontologyIdentity: historicalRevision.ontologyIdentity,
      sourceSnapshotIdentity: historicalRevision.sourceSnapshotIdentity,
      sourceIssueRevisionId: historicalRevision.revisionId,
      sourceAgentRunId: hashCanonical({ run: "historical-mechanism" }),
      sourceTrailheadIds: [historicalRevision.trailheadIds[0]!],
      sourceRelationPatternIds: [historicalRevision.relationPatternId],
      subjectLabel: "Trump",
      subjectAliases: ["Trump"],
      subjectAmbiguityNotes: ["Both bindings must refer to the same person."],
      trigger: {
        predicateLabel: "is shot during August",
        searchSignals: ["shot", "August"],
        influence: "MAY_DEGRADE_STATE",
        evidenceBindings: [{
          listingRef: "a:trump-shot", title: "Will Trump be shot during August?",
          nodeId: hashCanonical({ node: "shot" }),
          worldFacetId: hashCanonical({ facet: "shot" }),
          sourceRawHash: hashCanonical({ raw: "shot" }),
          protocolIdentity: "protocol:a:v1",
        }],
      },
      state: { dimension: "PHYSICAL_CAPABILITY", label: "Trump can appear publicly" },
      dependent: {
        predicateLabel: "livestreams drinking cola during September",
        searchSignals: ["livestream", "cola", "September"],
        requirement: "STATE_INFLUENCES_LIKELIHOOD",
        evidenceBindings: [{
          listingRef: "b:trump-cola",
          title: "Will Trump livestream drinking cola during September?",
          nodeId: hashCanonical({ node: "cola" }),
          worldFacetId: hashCanonical({ facet: "cola" }),
          sourceRawHash: hashCanonical({ raw: "cola" }),
          protocolIdentity: "protocol:b:v1",
        }],
      },
      temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
      counterScenarios: ["Trump recovers before September."],
      rationale: "The first event may change the likelihood of the later public action.",
      proposedAt: NOW,
    });

    const withoutEvidence = materializeWorldStateMechanismResearchAssignments({
      revisions: [currentRevision], proposals: [proposal], counterexamples: [], abstentions: [],
    })[0]!;
    expect(withoutEvidence).toMatchObject({
      coverageState: "UNEXPLORED",
      campaignEligible: true,
      matchedProposalIds: [],
    });
    const covered = materializeWorldStateMechanismResearchAssignments({
      revisions: [currentRevision],
      historicalRevisions: [historicalRevision],
      proposals: [proposal], counterexamples: [], abstentions: [],
    })[0]!;
    expect(covered).toMatchObject({
      mechanismIssueId: historical.assignments[0]!.mechanismIssueId,
      coverageState: "PROPOSED",
      campaignEligible: false,
      matchedProposalIds: [proposal.proposalId],
    });
    expect(proposal.sourceIssueRevisionId).toBe(historicalRevision.revisionId);
  });
});
