import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertRelationDiscoveryTaskRevision,
  assertRelationDiscoveryTaskPayload,
  assertRelationDiscoveryFinding,
  assertMarketOntologyAgentProposal,
  assertOntologyRelationWorkItem,
  buildAgentRun,
  buildAgentInputRevisionRunAnnotation,
  buildDefaultAgentRuntimePortfolio,
  buildExecutionProfile,
  buildRelationDiscoveryAgentTask,
  compileRelationDiscoveryFindingForSemanticReview,
  compileRelationDiscoveryFindingsForSemanticReview,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildOntologyRelationWorkProjection,
  buildStandingOntologyRouteProjection,
  buildStandingRouteSeedCampaignPreview,
  buildStandingRouteSeedOutcomeProjection,
  buildStandingRouteSeedSelection,
  buildStandingOntologyRouteValueProjection,
  extendOntologyRelationWorkWithStandingRouteFollowups,
  materializeRelationDiscoveryTaskRevisions,
  materializeStandingOntologyRouteObservationEpisodes,
  materializeStandingOntologyRouteFollowups,
  materializeStandingRouteSeedCampaignMembership,
  materializeStandingRouteSeedTaskRevisions,
  migrateStandingRouteSeedCampaignPolicies,
  reconcileStandingRouteSeedCampaignMembership,
  buildPausedAgentCampaign,
  activateAgentCampaign,
  reconcileRelationDiscoveryTaskRevisions,
  relationDiscoveryListingEvidenceHash,
  relationDiscoveryReviewLane,
  relationDiscoveryResearchInputIdentity,
  relationDiscoveryRevisionWorkItem,
  RelationDiscoveryAgentToolHost,
  selectRelationDiscoverySemanticReviewCompilations,
  selectRelationDiscoveryCampaignTasks,
  SqliteOperationalStore,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  type DiscoveryCatalogListing,
  type MarketOntologyAgentProposal,
  type MarketOntologyListingBinding,
  type OntologyRelationWorkItem,
  type StandingOntologyRouteProjection,
} from "../src/index.js";

const NOW = "2026-08-12T09:00:00.000Z";
const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

function listing(listingRef: string, title: string): DiscoveryCatalogListing {
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
    rulesText: "Resolves from the named official source.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "400000000000000000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "600000000000000000" }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: NOW,
    sourceRawHash: hashCanonical({ listingRef, title }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function binding(node: Readonly<{
  listingRef: string;
  nodeId: `sha256:${string}`;
  worldFacet: { facetId: `sha256:${string}` };
  settlementFacet: { facetId: `sha256:${string}` };
  tradedFacet: { facetId: `sha256:${string}` };
}>): MarketOntologyListingBinding {
  return Object.freeze({
    listingRef: node.listingRef,
    nodeId: node.nodeId,
    worldFacetId: node.worldFacet.facetId,
    settlementFacetId: node.settlementFacet.facetId,
    tradedFacetId: node.tradedFacet.facetId,
  });
}

function proposal(
  common: Readonly<{
    runId: `sha256:${string}`;
    ontologyIdentity: `sha256:${string}`;
    sourceSnapshotIdentity: `sha256:${string}`;
    trailheadId: `sha256:${string}`;
    relationPatternId: `sha256:${string}`;
    listingBinding: MarketOntologyListingBinding;
    proposedAt: string;
    rationale: string;
  }>,
  specific: Readonly<Record<string, unknown>>,
): MarketOntologyAgentProposal {
  const body = Object.freeze({
    schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
    ontologyIdentity: common.ontologyIdentity,
    sourceSnapshotIdentity: common.sourceSnapshotIdentity,
    sourceAgentRunId: common.runId,
    sourceTrailheadIds: Object.freeze([common.trailheadId]),
    sourceRelationPatternIds: Object.freeze([common.relationPatternId]),
    listingBindings: Object.freeze([common.listingBinding]),
    rationale: common.rationale,
    proposedAt: common.proposedAt,
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
    ...specific,
  });
  return assertMarketOntologyAgentProposal(Object.freeze({
    ...body,
    proposalId: hashCanonical(body),
  }));
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "relation-work-test" }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-b:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-a:kelly-nominee", "Will Mark Kelly win the 2028 Democratic nomination?"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({ corpus, ontology, proposals: [] });
  const revision = revisions[0]!;
  const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(
    { PMH_DISCOVERY_PROVIDER: "codex" },
    () => Date.parse(NOW),
  ));
  const route = portfolio.workloadRoutes.find((item) =>
    item.taskKind === "ONTOLOGY_NORMALIZATION"
  )!;
  const profile = portfolio.executionProfiles.find((item) =>
    item.executionProfileId === route.executionProfileId
  )!;
  const run = buildAgentRun({
    task: revision.task,
    executionProfile: profile,
    runOrdinal: 1,
    authorization: {
      kind: "MANUAL",
      authorizationRef: "operator:relation-work-test",
      authorizedAt: NOW,
    },
    createdAt: NOW,
  });
  const nodes = revision.taskPayload.listingEvidence.map((item) => item.node);
  const common = (index: number, proposedAt: string, rationale: string) => Object.freeze({
    runId: run.runId,
    ontologyIdentity: revision.ontologyIdentity,
    sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
    trailheadId: revision.trailheadIds[0]!,
    relationPatternId: revision.relationPatternId,
    listingBinding: binding(nodes[index % nodes.length]!),
    proposedAt,
    rationale,
  });
  const proposals = Object.freeze([
    proposal(common(0, NOW, "The listing names LAFC and the MLS Cup."), {
      kind: "WORLD_PROPOSITION",
      label: "Los Angeles Football Club wins the 2026 MLS Cup",
      subjectLabels: ["Los Angeles Football Club"],
      predicate: "wins_sports_competition",
      timeScope: "2026",
      parameters: ["competition: 2026 MLS Cup"],
      ambiguityNotes: ["The normalized proposition is unreviewed."],
      falsifiers: ["The listing names a different club or competition."],
    }),
    proposal(common(1, "2026-08-12T09:01:00.000Z", "A second source uses the LAFC alias."), {
      kind: "WORLD_PROPOSITION",
      label: "LAFC wins 2026 MLS Cup",
      subjectLabels: ["Los Angeles Football Club"],
      predicate: "wins_sports_competition",
      timeScope: "2026",
      parameters: ["competition: 2026 MLS Cup"],
      ambiguityNotes: ["LAFC is an unreviewed alias."],
      falsifiers: ["LAFC is not Los Angeles Football Club in this contract."],
    }),
    proposal(common(1, "2026-08-12T09:02:00.000Z", "The listing names Club Brugge."), {
      kind: "WORLD_PROPOSITION",
      label: "Club Brugge wins the 2026-27 UEFA Champions League",
      subjectLabels: ["Club Brugge"],
      predicate: "wins_sports_competition",
      timeScope: "2026-27",
      parameters: ["competition: 2026-27 UEFA Champions League"],
      ambiguityNotes: ["The competition label remains unreviewed."],
      falsifiers: ["The listing names a different competition."],
    }),
    proposal(common(0, "2026-08-12T09:03:00.000Z", "The inspected pair was unrelated."), {
      kind: "COUNTEREXAMPLE",
      rejectedClaim: "LAFC winning MLS Cup is related to Club Brugge winning Champions League",
      reason: "The competitions and subjects are distinct.",
      searchSignals: ["LAFC", "Club Brugge"],
    }),
  ]);
  const execution = Object.freeze({
    ...emptyAgentExecutionSnapshot(),
    ...portfolio,
    tasks: Object.freeze([revision.task]),
    runs: Object.freeze([run]),
  });
  return { corpus, revisions, proposals, execution, portfolio };
}

describe("ontology proposal relation work", () => {
  it("compiles legacy entity RELATED findings into quiet standing routes", () => {
    const work = fixture();
    const source = work.proposals.find((item) => item.kind === "WORLD_PROPOSITION")!;
    const entityBody = Object.freeze({
      schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
      ontologyIdentity: source.ontologyIdentity,
      sourceSnapshotIdentity: source.sourceSnapshotIdentity,
      sourceAgentRunId: source.sourceAgentRunId,
      sourceTrailheadIds: source.sourceTrailheadIds,
      sourceRelationPatternIds: source.sourceRelationPatternIds,
      listingBindings: source.listingBindings,
      rationale: "The listing title names Mark Kelly.",
      proposedAt: source.proposedAt,
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
      kind: "ENTITY_ALIAS" as const,
      canonicalLabel: "Mark Kelly",
      aliases: Object.freeze(["Mark Kelly"]),
      ambiguityNotes: Object.freeze(["The entity normalization is unreviewed."]),
    });
    const entity = assertMarketOntologyAgentProposal(Object.freeze({
      ...entityBody,
      proposalId: hashCanonical(entityBody),
    }));
    const relationWork = buildOntologyRelationWorkProjection({
      proposals: [entity],
      revisions: work.revisions,
      execution: work.execution,
    });
    expect(relationWork.items[0]!.kind).toBe("ENTITY_ALIAS_NEIGHBORHOOD");
    const revision = materializeRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: work.corpus,
    })[0]!;
    const listingRefs = work.corpus.listings.slice(0, 2).map((item) => item.listingRef);
    const findingBody = Object.freeze({
      schemaVersion: "pmh.relation-discovery-finding.v1" as const,
      workItemId: revision.workItemId,
      workArtifactHash: revision.workArtifactHash,
      sourceTaskId: revision.task.taskId,
      sourceAgentRunId: hashCanonical({ run: "legacy-related" }),
      sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
      listingRefs: Object.freeze(listingRefs),
      listingEvidenceHashes: Object.freeze(work.corpus.listings.slice(0, 2)
        .map(relationDiscoveryListingEvidenceHash)),
      statement: "The contracts name the same Mark Kelly subject.",
      rationale: "This is entity routing memory only.",
      falsifiers: Object.freeze(["The name refers to different people."]),
      recordedAt: NOW,
      authority: "RELATION_FINDING_PROPOSAL_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
      kind: "RELATION_HYPOTHESIS" as const,
      relationKind: "RELATED" as const,
    });
    const finding = Object.freeze({
      ...findingBody,
      findingId: hashCanonical(findingBody),
    });
    const projection = buildStandingOntologyRouteProjection({
      findings: [finding],
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: work.corpus,
    });
    expect(projection).toMatchObject({
      routeCount: 1,
      nativeRouteCount: 0,
      legacyRouteCount: 1,
      blockedRouteCount: 0,
      quietRouteCount: 1,
      followupEligibleRouteCount: 0,
    });
    expect(projection.routes[0]).toMatchObject({
      route: {
        sourceDisposition: "LEGACY_RELATED_FINDING",
        routeLayer: "SUBJECT_REFERENCE",
        searchSignals: ["Mark Kelly"],
        baselineListingRefs: [
          "venue-a:kelly-crime",
          "venue-a:kelly-nominee",
          "venue-b:kelly-crime",
        ],
      },
      observation: { state: "QUIESCENT", followupEligible: false },
    });
  });

  it("consolidates duplicate semantic scopes without pairing unrelated run output", () => {
    const work = fixture();
    const projection = buildOntologyRelationWorkProjection(work);

    expect(projection).toMatchObject({
      sourceProposalCount: 4,
      workItemCount: 3,
      runnableResearchCount: 2,
      negativeMemoryCount: 1,
      blockedMissingLineageCount: 0,
      consolidatedSourceProposalCount: 1,
      proposalToWorkCoverageBps: 10_000,
      runnableProposalCoverageBps: 7_500,
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
      automaticDispatch: false,
      authority: "RELATION_SEARCH_PROPOSAL_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    const lafc = projection.items.find((item) =>
      item.searchSignals.includes("Los Angeles Football Club")
    )!;
    const brugge = projection.items.find((item) => item.searchSignals.includes("Club Brugge"))!;
    expect(lafc.workItemId).not.toBe(brugge.workItemId);
    expect(lafc.sourceProposalIds).toHaveLength(2);
    expect(lafc.sourceIssueIds).toHaveLength(1);
    expect(lafc.candidateRelationKinds.length).toBeGreaterThan(0);
    expect(assertOntologyRelationWorkItem(lafc)).toBe(lafc);
    const beforeDuplicate = buildOntologyRelationWorkProjection({
      ...work,
      proposals: [work.proposals[0]!],
    }).items[0]!;
    expect(lafc.workItemId).toBe(beforeDuplicate.workItemId);
    expect(lafc.artifactHash).not.toBe(beforeDuplicate.artifactHash);
    expect(projection.items.find((item) => item.kind === "COUNTEREXAMPLE_MEMORY"))
      .toMatchObject({
        disposition: "NEGATIVE_EVIDENCE_ONLY",
        campaignEligible: false,
        automaticDispatch: false,
      });
  });

  it("selects one honest route seed per layer and binds a route-only Agent intent", async () => {
    const work = fixture();
    const relationWork = buildOntologyRelationWorkProjection(work);
    const revisions = materializeRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: work.corpus,
    });
    const relationRoute = work.execution.workloadRoutes.find((item) =>
      item.taskKind === "RELATION_DISCOVERY"
    )!;
    const relationProfile = work.execution.executionProfiles.find((item) =>
      item.executionProfileId === relationRoute.executionProfileId
    )!;
    const capability = Object.freeze({
      executionProfileId: relationProfile.executionProfileId,
      configurationStatus: "CONFIGURED" as const,
      runtimeStatus: "AVAILABLE" as const,
      serviceCapability: "USABLE" as const,
      dispatchEligibility: "ELIGIBLE" as const,
      diagnostic: "test runtime is usable",
      observation: null,
      inferenceRequestsStarted: 0 as const,
      modelInvocationsStarted: 0 as const,
      secretMaterialRetained: false as const,
    });
    const execution = Object.freeze({
      ...work.execution,
      tasks: Object.freeze([...work.execution.tasks, ...revisions.map((item) => item.task)]),
    });
    const selection = buildStandingRouteSeedSelection({
      revisions,
      corpus: work.corpus,
      standingRoutes: null,
      execution,
    });
    expect(selection).toMatchObject({
      consideredCandidateCount: 2,
      selectedCandidateCount: 1,
      selected: [{
        targetRouteLayer: "EVENT_REFERENCE",
        selectionReason: "WORLD_PROPOSITION_EVENT_FIT",
        eligibility: "SELECTABLE",
        expectedSearchFields: ["title"],
      }],
      unusedLayers: ["SUBJECT_REFERENCE", "SETTLEMENT_REFERENCE"],
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
      campaignsCreated: 0,
      runsCreated: 0,
      automaticDispatch: false,
    });
    const repeat = buildStandingRouteSeedSelection({
      revisions,
      corpus: work.corpus,
      standingRoutes: null,
      execution,
    });
    expect(repeat).toEqual(selection);
    const preview = buildStandingRouteSeedCampaignPreview({
      revisions,
      corpus: work.corpus,
      standingRoutes: null,
      execution,
      capability,
    });
    expect(preview).toMatchObject({
      creationEligible: true,
      dispatchEligible: true,
      taskIds: [expect.stringMatching(/^sha256:/u)],
      preparedCampaignIds: [],
      selectionBinding: {
        selectionProtocol: "STANDING_ROUTE_SEED_SELECTION_V1",
        taskBindings: [{
          inputRevisionKind: "RELATION_DISCOVERY_ROUTE_SEED",
          selectionActionKind: "EVENT_REFERENCE",
        }],
      },
      budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 24 },
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
      automaticDispatch: false,
    });
    const paused = buildPausedAgentCampaign({
      campaignKey: preview.campaignKey,
      revision: 1,
      executionProfileId: relationProfile.executionProfileId,
      taskIds: preview.taskIds,
      schedule: preview.schedule,
      budget: preview.budget,
      selectionBinding: preview.selectionBinding,
      createdAt: NOW,
    });
    const active = activateAgentCampaign(
      paused,
      "operator:route-seed-contract-test",
      "2026-08-12T09:00:01.000Z",
    );
    const migrated = migrateStandingRouteSeedCampaignPolicies({
      campaigns: [paused, active],
      observedAt: "2026-08-12T09:00:02.000Z",
    });
    expect(migrated).toMatchObject([{
      schemaVersion: "pmh.agent-campaign.v4",
      campaignKey: paused.campaignKey,
      revision: 3,
      status: "ACTIVE",
      activationRef: "operator:route-seed-contract-test",
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      selectionBinding: paused.selectionBinding,
      membershipPolicyBinding: {
        selectionProtocol: "STANDING_ROUTE_SEED_SELECTION_V1",
        selectionPolicyIdentity: paused.selectionBinding.selectionPolicyIdentity,
      },
    }]);
    expect(migrateStandingRouteSeedCampaignPolicies({
      campaigns: [...migrated, paused, active],
      observedAt: "2026-08-12T09:00:03.000Z",
    })).toEqual([]);
    const effective = migrated[0]!;
    if (effective.schemaVersion !== "pmh.agent-campaign.v4") {
      throw new Error("route seed campaign migration did not create evolving membership");
    }
    const refreshedBinding = {
      ...preview.selectionBinding,
      selectionIdentity: hashCanonical({ selection: "refreshed-route-seed" }),
      taskBindings: preview.selectionBinding.taskBindings.map((binding) => ({
        ...binding,
        selectionActionRef: hashCanonical({ refreshed: binding.selectionActionRef }),
      })),
    };
    const refreshed = reconcileStandingRouteSeedCampaignMembership({
      execution: Object.freeze({
        ...execution,
        campaigns: Object.freeze([paused, active, effective]),
      }),
      selectionBinding: refreshedBinding,
    });
    expect(refreshed).toMatchObject([{
      schemaVersion: "pmh.agent-campaign.v4",
      campaignKey: effective.campaignKey,
      revision: effective.revision + 1,
      status: "ACTIVE",
      activationRef: effective.activationRef,
      executionProfileId: effective.executionProfileId,
      budget: effective.budget,
      selectionBinding: {
        selectionPolicyIdentity: effective.selectionBinding.selectionPolicyIdentity,
      },
    }]);
    const retainedSelection = buildStandingRouteSeedSelection({
      revisions: [...revisions, ...preview.taskRevisions],
      corpus: work.corpus,
      standingRoutes: null,
      execution: Object.freeze({
        ...execution,
        tasks: Object.freeze([...execution.tasks, ...preview.taskRevisions.map((item) =>
          item.task
        )]),
        campaigns: Object.freeze([paused]),
      }),
    });
    expect(retainedSelection.selected).toHaveLength(1);
    expect(retainedSelection.selected[0]!.selectionActionRef)
      .toBe(selection.selected[0]!.selectionActionRef);
    expect(retainedSelection.candidates.find((item) =>
      item.selectionActionRef === selection.selected[0]!.selectionActionRef
    )).toMatchObject({ attemptedExactIntent: false, eligibility: "SELECTABLE" });
    const seedRevision = preview.taskRevisions[0]!;
    expect(seedRevision).toMatchObject({
      schemaVersion: "pmh.relation-discovery-task-revision.v4",
      taskPayload: {
        schemaVersion: "pmh.relation-discovery-task.v4",
        objective: "AUTHOR_AND_FALSIFY_EVIDENCE_BOUND_STANDING_ROUTE",
        researchIntent: {
          targetRouteLayer: "EVENT_REFERENCE",
          acceptedTerminalEffectKinds: ["ONTOLOGY_ROUTE", "COUNTEREXAMPLE"],
          ordinaryPayoffFindingAllowed: false,
        },
      },
    });
    expect(selectRelationDiscoveryCampaignTasks({
      revisions: [...revisions, seedRevision],
      execution,
    }).some((item) => item.revisionId === seedRevision.revisionId)).toBe(false);

    const run = buildAgentRun({
      task: seedRevision.task,
      executionProfile: relationProfile,
      runOrdinal: 1,
      authorization: {
        kind: "CAMPAIGN",
        campaign: active,
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const firstAttemptedSelection = buildStandingRouteSeedSelection({
      revisions: [...revisions, ...preview.taskRevisions],
      corpus: work.corpus,
      standingRoutes: null,
      execution: Object.freeze({
        ...execution,
        tasks: Object.freeze([...execution.tasks, ...preview.taskRevisions.map((item) =>
          item.task
        )]),
        campaigns: Object.freeze([paused, active]),
        runs: Object.freeze([run]),
      }),
    });
    expect(firstAttemptedSelection.candidates.find((item) =>
      item.selectionActionRef === selection.selected[0]!.selectionActionRef
    )).toMatchObject({ attemptedExactIntent: true, eligibility: "HELD_ALREADY_ATTEMPTED" });
    const host = new RelationDiscoveryAgentToolHost(
      seedRevision.taskPayload,
      work.corpus,
      undefined,
      relationDiscoveryRevisionWorkItem(seedRevision),
    );
    expect(host.resultToolNames("RELATION_DISCOVERY_AGENT_TOOLS_V1"))
      .toEqual(["record_ontology_route", "record_relation_counterexample"]);
    expect(host.manifest("RELATION_DISCOVERY_AGENT_TOOLS_V1").map((item) => item.name))
      .not.toContain("record_relation_hypothesis");
    const context = (toolName: string, input: unknown) => ({
      run,
      task: seedRevision.task,
      executionProfile: relationProfile,
      callId: `call-${toolName}`,
      toolName,
      input,
    });
    const refs = work.corpus.listings.slice(0, 2).map((item) => item.listingRef);
    await host.execute(context("inspect_market_listings", { listingRefs: refs }));
    await expect(host.execute(context("record_relation_hypothesis", {
      relationKind: "EQUIVALENT",
      listingRefs: refs,
      statement: "This payoff result must be rejected.",
      rationale: "A route seed cannot silently consume payoff-research budget.",
      falsifiers: ["The contract is route-only."],
    }))).rejects.toThrow("cannot publish a payoff relation hypothesis");
    await expect(host.execute(context("record_ontology_route", {
      routeLayer: "SETTLEMENT_REFERENCE",
      searchSignals: ["Mark Kelly"],
      listingRefs: refs,
      statement: "This is the wrong assigned layer.",
      rationale: "The immutable intent targets event continuity.",
      falsifiers: ["The assigned layer differs."],
    }))).rejects.toThrow("outside the assigned route-seed intent");

    const annotation = buildAgentInputRevisionRunAnnotation({
      task: seedRevision.task,
      run,
      revisionKind: "RELATION_DISCOVERY",
      revisionId: seedRevision.revisionId,
      exactInput: seedRevision.taskPayload,
    });
    const outcome = buildStandingRouteSeedOutcomeProjection({
      execution: Object.freeze({
        ...execution,
        tasks: Object.freeze([...execution.tasks, ...preview.taskRevisions.map((item) => item.task)]),
        campaigns: Object.freeze([paused, active]),
        runs: Object.freeze([...execution.runs, run]),
        runAnnotations: Object.freeze([...execution.runAnnotations, annotation]),
      }),
      taskRevisions: [...revisions, ...preview.taskRevisions],
      findings: [],
      standingRoutes: null,
      observedAt: NOW,
    });
    expect(outcome).toMatchObject({
      campaignCount: 2,
      selectedActionCount: 1,
      actedActionCount: 1,
      terminalActionCount: 0,
      routeRetainedActionCount: 0,
      usefulNegativeMemoryActionCount: 0,
      conflictingTerminalEffectActionCount: 0,
      outcomes: [{
        targetRouteLayer: "EVENT_REFERENCE",
        stage: "RUN_IN_FLIGHT",
        acted: true,
        terminal: false,
        directCost: { runCount: 1, terminalRunCount: 0, modelInvocationCount: 0 },
      }],
      strata: [{
        targetRouteLayer: "EVENT_REFERENCE",
        selectedActionCount: 1,
        actedActionCount: 1,
        terminalActionCount: 0,
        terminalEvidenceMinimum: 3,
        yieldCostEstimateQualified: false,
      }],
      recurrenceQualification: {
        representedLayerCount: 1,
        qualifiedLayerCount: 0,
        yieldCostEvidenceSufficient: false,
        operatorActivationStillRequired: true,
      },
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
      writesStartedByRead: 0,
      automaticDispatch: false,
    });

    await host.execute(context("record_ontology_route", {
      routeLayer: "EVENT_REFERENCE",
      searchSignals: ["Mark Kelly"],
      listingRefs: refs,
      statement: "The inspected listings share the named event subject.",
      rationale: "The literal signal occurs in both retained titles.",
      falsifiers: ["A title no longer contains the signal."],
    }));
    await host.execute(context("record_relation_counterexample", {
      rejectedRelationKind: null,
      listingRefs: refs,
      statement: "The same run also claimed the route should not be retained.",
      rationale: "This fixture preserves a historical conflicting terminal effect.",
      falsifiers: ["Only one terminal effect exists."],
    }));
    const conflicting = buildStandingRouteSeedOutcomeProjection({
      execution: Object.freeze({
        ...execution,
        tasks: Object.freeze([...execution.tasks, ...preview.taskRevisions.map((item) =>
          item.task
        )]),
        campaigns: Object.freeze([paused, active]),
        runs: Object.freeze([...execution.runs, run]),
        runAnnotations: Object.freeze([...execution.runAnnotations, annotation]),
      }),
      taskRevisions: [...revisions, ...preview.taskRevisions],
      findings: host.findings(),
      standingRoutes: null,
      observedAt: NOW,
    });
    expect(conflicting).toMatchObject({
      terminalActionCount: 1,
      routeRetainedActionCount: 0,
      usefulNegativeMemoryActionCount: 0,
      conflictingTerminalEffectActionCount: 1,
      outcomes: [{
        stage: "CONFLICTING_TERMINAL_EFFECTS",
        terminal: true,
        usefulNegativeMemory: false,
        routeFindingIds: [expect.stringMatching(/^sha256:/u)],
        counterexampleFindingIds: [expect.stringMatching(/^sha256:/u)],
      }],
      strata: [{
        terminalActionCount: 1,
        routeRetainedActionCount: 0,
        usefulNegativeMemoryActionCount: 0,
        conflictingTerminalEffectActionCount: 1,
      }],
    });

    const attemptedSelection = buildStandingRouteSeedSelection({
      revisions: [...revisions, seedRevision],
      corpus: work.corpus,
      standingRoutes: null,
      execution: Object.freeze({
        ...execution,
        tasks: Object.freeze([...execution.tasks, seedRevision.task]),
        runs: Object.freeze([...execution.runs, run]),
      }),
    });
    expect(attemptedSelection.selected).toHaveLength(1);
    expect(attemptedSelection.selected[0]!.selectionActionRef)
      .not.toBe(selection.selected[0]!.selectionActionRef);
    expect(attemptedSelection.candidates.filter((item) =>
      item.selectionActionRef === selection.selected[0]!.selectionActionRef
    )[0]).toMatchObject({
      attemptedExactIntent: true,
      eligibility: "HELD_ALREADY_ATTEMPTED",
    });

    const coveredRoutes = Object.freeze({
      routes: revisions.map((revision, index) => Object.freeze({
        route: Object.freeze({
          routeId: hashCanonical({ route: index }),
          routeLayer: "EVENT_REFERENCE" as const,
          sourceWorkItemId: revision.workItemId,
        }),
      })),
      families: revisions.map((revision, index) => Object.freeze({
        family: Object.freeze({
          routeFamilyId: hashCanonical({ family: index }),
          sourceRouteIds: Object.freeze([hashCanonical({ route: index })]),
        }),
      })),
    }) as unknown as StandingOntologyRouteProjection;
    const coveredSelection = buildStandingRouteSeedSelection({
      revisions,
      corpus: work.corpus,
      standingRoutes: coveredRoutes,
      execution,
    });
    expect(coveredSelection.selected).toEqual([]);
    expect(coveredSelection.candidates.every((item) =>
      item.eligibility === "HELD_EXISTING_ROUTE"
    )).toBe(true);
  });

  it("blocks positive work when the immutable run-to-issue lineage is absent", () => {
    const work = fixture();
    const projection = buildOntologyRelationWorkProjection({
      ...work,
      execution: Object.freeze({ ...work.execution, tasks: [], runs: [] }),
    });

    expect(projection.runnableResearchCount).toBe(0);
    expect(projection.blockedMissingLineageCount).toBe(2);
    expect(projection.items.filter((item) => item.kind !== "COUNTEREXAMPLE_MEMORY"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          disposition: "BLOCKED_MISSING_ISSUE_LINEAGE",
          campaignEligible: false,
        }),
      ]));
  });

  it("keeps repeated counterexample identity stable and bounds accumulated seed bindings", () => {
    const work = fixture();
    const base = work.proposals[0]!;
    if (base.kind !== "WORLD_PROPOSITION") throw new Error("world proposal fixture is missing");
    const revision = work.revisions[0]!;
    const runId = work.execution.runs[0]!.runId;
    const many = Array.from({ length: 33 }, (_, index) => proposal({
      runId,
      ontologyIdentity: revision.ontologyIdentity,
      sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
      trailheadId: revision.trailheadIds[0]!,
      relationPatternId: revision.relationPatternId,
      listingBinding: Object.freeze({
        listingRef: `venue-a:semantic-seed-${index.toString().padStart(2, "0")}`,
        nodeId: hashCanonical({ kind: "node", index }),
        worldFacetId: hashCanonical({ kind: "world", index }),
        settlementFacetId: hashCanonical({ kind: "settlement", index }),
        tradedFacetId: hashCanonical({ kind: "traded", index }),
      }),
      proposedAt: new Date(Date.parse(NOW) + index * 1_000).toISOString(),
      rationale: `Independent observation ${index}.`,
    }, {
      kind: "WORLD_PROPOSITION",
      label: base.label,
      subjectLabels: base.subjectLabels,
      predicate: base.predicate,
      timeScope: base.timeScope,
      parameters: base.parameters,
      ambiguityNotes: base.ambiguityNotes,
      falsifiers: base.falsifiers,
    }));
    const bounded = buildOntologyRelationWorkProjection({
      ...work,
      proposals: many,
    }).items[0]!;
    expect(bounded).toMatchObject({
      sourceListingBindingCount: 33,
      seedListingBindingsTruncated: true,
    });
    expect(bounded.seedListingBindings).toHaveLength(32);
    expect(bounded.sourceProposalIds).toHaveLength(33);
    expect(assertOntologyRelationWorkItem(bounded)).toBe(bounded);

    const counter = work.proposals.find((item) => item.kind === "COUNTEREXAMPLE")!;
    if (counter.kind !== "COUNTEREXAMPLE") throw new Error("counterexample fixture is missing");
    const alternate = proposal({
      runId,
      ontologyIdentity: counter.ontologyIdentity,
      sourceSnapshotIdentity: counter.sourceSnapshotIdentity,
      trailheadId: counter.sourceTrailheadIds[0]!,
      relationPatternId: counter.sourceRelationPatternIds[0]!,
      listingBinding: counter.listingBindings[0]!,
      proposedAt: "2026-08-12T09:04:00.000Z",
      rationale: "The same rejected claim was rediscovered through another phrase.",
    }, {
      kind: "COUNTEREXAMPLE",
      rejectedClaim: counter.rejectedClaim,
      reason: counter.reason,
      searchSignals: ["MLS Cup", "Champions League"],
    });
    const negative = buildOntologyRelationWorkProjection({
      ...work,
      proposals: [counter, alternate],
    });
    expect(negative.workItemCount).toBe(1);
    expect(negative.consolidatedSourceProposalCount).toBe(1);
    expect(negative.items[0]!.searchSignals).toEqual(expect.arrayContaining([
      "LAFC", "Club Brugge", "MLS Cup", "Champions League",
    ]));
  });

  it("separates stable research tasks from exact catalog observations", async () => {
    const work = fixture();
    const relationWork = buildOntologyRelationWorkProjection(work);
    const original = materializeRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: work.corpus,
    });
    const provenanceOnlyWork = relationWork.items.find((item) =>
      item.disposition === "RUNNABLE_RESEARCH"
    )!;
    const { artifactHash: _artifactHash, ...provenanceBody } = provenanceOnlyWork;
    const rotatedProvenanceBody = Object.freeze({
      ...provenanceBody,
      sourceIssueRevisionIds: Object.freeze([
        hashCanonical({ rotated: provenanceOnlyWork.workItemId }),
      ]),
    });
    const rotatedProvenanceWork = assertOntologyRelationWorkItem(Object.freeze({
      ...rotatedProvenanceBody,
      artifactHash: hashCanonical(rotatedProvenanceBody),
    }));
    const provenanceRotation = materializeRelationDiscoveryTaskRevisions({
      relationWork: Object.freeze({
        ...relationWork,
        items: Object.freeze(relationWork.items.map((item) =>
          item.workItemId === rotatedProvenanceWork.workItemId
            ? rotatedProvenanceWork
            : item
        )),
      }),
      corpus: work.corpus,
    }).find((item) => item.workItemId === rotatedProvenanceWork.workItemId)!;
    const originalStableTask = original.find((item) =>
      item.workItemId === rotatedProvenanceWork.workItemId
    )!;
    expect(provenanceRotation.workArtifactHash)
      .not.toBe(originalStableTask.workArtifactHash);
    expect(provenanceRotation.revisionId).not.toBe(originalStableTask.revisionId);
    expect(provenanceRotation.task.taskId).toBe(originalStableTask.task.taskId);
    const refreshedAt = "2026-08-12T09:10:00.000Z";
    const observationOnlyRefresh = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "relation-work-refresh" }),
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: work.corpus.listings.map((item) => Object.freeze({
        ...item,
        sourceReceivedAt: refreshedAt,
        sourceRawHash: hashCanonical({ refresh: item.listingRef }),
        status: item.status === "OPEN" ? "ACTIVE" : item.status,
        outcomes: Object.freeze(item.outcomes.map((outcome, index) => Object.freeze({
          ...outcome,
          indicativePrice: index === 0
            ? "410000000000000000"
            : "590000000000000000",
        }))),
      })),
    });
    expect(observationOnlyRefresh.snapshotIdentity).not.toBe(work.corpus.snapshotIdentity);
    expect(relationDiscoveryResearchInputIdentity(observationOnlyRefresh)).toBe(
      relationDiscoveryResearchInputIdentity(work.corpus),
    );
    const seedBeforeRefresh = buildStandingRouteSeedSelection({
      revisions: original,
      corpus: work.corpus,
      standingRoutes: null,
      execution: emptyAgentExecutionSnapshot(),
    });
    const seedAfterRefresh = buildStandingRouteSeedSelection({
      revisions: original,
      corpus: observationOnlyRefresh,
      standingRoutes: null,
      execution: emptyAgentExecutionSnapshot(),
    });
    expect(seedAfterRefresh.sourceCorpusSnapshotIdentity)
      .not.toBe(seedBeforeRefresh.sourceCorpusSnapshotIdentity);
    expect(seedAfterRefresh.selectionIdentity).toBe(seedBeforeRefresh.selectionIdentity);
    const disjointObservationWindow = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "disjoint-relation-window" }),
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: work.corpus.listings.map((item, index) => Object.freeze({
        ...item,
        listingRef: `rotated-window:${index}`,
        venueInstrumentId: `rotated-instrument-${index}`,
        title: `Unrelated current market ${index}`,
        description: "This listing belongs to a different bounded catalog window.",
        sourceRawHash: hashCanonical({ rotated: index }),
      })),
    });
    expect(relationDiscoveryResearchInputIdentity(disjointObservationWindow)).not.toBe(
      relationDiscoveryResearchInputIdentity(work.corpus),
    );
    const seedInDisjointWindow = buildStandingRouteSeedSelection({
      revisions: original,
      corpus: disjointObservationWindow,
      standingRoutes: null,
      execution: emptyAgentExecutionSnapshot(),
    });
    expect(seedInDisjointWindow.selectionIdentity).toBe(seedBeforeRefresh.selectionIdentity);
    const originalMembership = materializeStandingRouteSeedCampaignMembership({
      revisions: original,
      corpus: work.corpus,
      standingRoutes: null,
      execution: work.execution,
    });
    const rotatedMembership = materializeStandingRouteSeedCampaignMembership({
      revisions: [...original, ...originalMembership.taskRevisions],
      corpus: disjointObservationWindow,
      standingRoutes: null,
      execution: work.execution,
    });
    expect(rotatedMembership.taskIds).toEqual(originalMembership.taskIds);
    expect(rotatedMembership.selectionBinding).toEqual(originalMembership.selectionBinding);
    const reused = reconcileRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: observationOnlyRefresh,
      retainedRevisions: original,
      loadRetainedCorpus: (identity) =>
        identity === work.corpus.snapshotIdentity ? work.corpus : null,
    });
    expect(reused).toMatchObject({
      createdRevisionIds: [],
      reusedRevisionIds: original.map((item) => item.revisionId).sort(),
      missingRetainedCorpusRevisionIds: [],
      effects: {
        providerRequests: 0,
        modelInvocations: 0,
        runs: 0,
        campaigns: 0,
        dispatches: 0,
        externalWrites: 0,
        valueMovingActions: 0,
      },
    });
    expect(reused.currentRevisions).toEqual(original);

    const changedCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: observationOnlyRefresh.sourceSetIdentity,
      eligibleSourceCount: observationOnlyRefresh.eligibleSourceCount,
      excludedSourceCount: observationOnlyRefresh.excludedSourceCount,
      listings: observationOnlyRefresh.listings.map((item, index) => index === 0
        ? Object.freeze({ ...item, rulesText: `${item.rulesText} Material amendment.` })
        : item),
    });
    const changed = reconcileRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: changedCorpus,
      retainedRevisions: original,
      loadRetainedCorpus: (identity) =>
        identity === work.corpus.snapshotIdentity ? work.corpus : null,
    });
    expect(changed.createdRevisionIds).toHaveLength(original.length);
    expect(changed.reusedRevisionIds).toEqual([]);
    expect(changed.currentRevisions.map((item) => item.revisionId))
      .not.toEqual(original.map((item) => item.revisionId));
    expect(changed.currentRevisions.map((item) => item.task.taskId))
      .toEqual(original.map((item) => item.task.taskId));

    const first = original[0]!;
    if (first.taskPayload.schemaVersion !== "pmh.relation-discovery-task.v3") {
      throw new Error("current relation task fixture is not v3");
    }
    const legacyPayload = assertRelationDiscoveryTaskPayload(Object.freeze({
      schemaVersion: "pmh.relation-discovery-task.v1" as const,
      workItem: relationDiscoveryRevisionWorkItem(first),
      sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
      sourceSetIdentity: work.corpus.sourceSetIdentity,
      sourceCorpusListingCount: work.corpus.listingCount,
      objective: first.taskPayload.objective,
      contentPolicy: first.taskPayload.contentPolicy,
      authority: first.taskPayload.authority,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    }));
    const legacyTask = buildRelationDiscoveryAgentTask({
      payload: legacyPayload,
      createdAt: first.materializedAt,
    });
    const legacyBody = Object.freeze({
      schemaVersion: "pmh.relation-discovery-task-revision.v1" as const,
      workItemId: first.workItemId,
      workArtifactHash: first.workArtifactHash,
      sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
      task: legacyTask,
      taskPayload: legacyPayload,
      campaignEligible: true as const,
      materializedAt: first.materializedAt,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const legacy = assertRelationDiscoveryTaskRevision(Object.freeze({
      ...legacyBody,
      revisionId: hashCanonical(legacyBody),
    }));
    let legacyCorpusLoads = 0;
    const prefersSelfDescribingRevision = reconcileRelationDiscoveryTaskRevisions({
      relationWork: Object.freeze({
        ...relationWork,
        items: Object.freeze(relationWork.items.filter((item) =>
          item.workItemId === first.workItemId || item.disposition !== "RUNNABLE_RESEARCH"
        )),
        runnableResearchCount: 1,
        workItemCount: relationWork.items.filter((item) =>
          item.workItemId === first.workItemId || item.disposition !== "RUNNABLE_RESEARCH"
        ).length,
      }),
      corpus: observationOnlyRefresh,
      retainedRevisions: [legacy, first],
      loadRetainedCorpus: () => {
        legacyCorpusLoads += 1;
        return work.corpus;
      },
    });
    expect(prefersSelfDescribingRevision.reusedRevisionIds).toEqual([first.revisionId]);
    expect(legacyCorpusLoads).toBe(0);
    const legacyReused = reconcileRelationDiscoveryTaskRevisions({
      relationWork: Object.freeze({
        ...relationWork,
        items: Object.freeze(relationWork.items.filter((item) =>
          item.workItemId === legacy.workItemId || item.disposition !== "RUNNABLE_RESEARCH"
        )),
        runnableResearchCount: 1,
        workItemCount: relationWork.items.filter((item) =>
          item.workItemId === legacy.workItemId || item.disposition !== "RUNNABLE_RESEARCH"
        ).length,
      }),
      corpus: observationOnlyRefresh,
      retainedRevisions: [legacy],
      loadRetainedCorpus: (identity) =>
        identity === work.corpus.snapshotIdentity ? work.corpus : null,
    });
    expect(legacyReused.reusedRevisionIds).toEqual([legacy.revisionId]);
    expect(legacyReused.currentRevisions).toEqual([legacy]);
    const missingLegacyCorpus = reconcileRelationDiscoveryTaskRevisions({
      relationWork: Object.freeze({
        ...relationWork,
        items: Object.freeze(relationWork.items.filter((item) =>
          item.workItemId === legacy.workItemId || item.disposition !== "RUNNABLE_RESEARCH"
        )),
        runnableResearchCount: 1,
        workItemCount: relationWork.items.filter((item) =>
          item.workItemId === legacy.workItemId || item.disposition !== "RUNNABLE_RESEARCH"
        ).length,
      }),
      corpus: observationOnlyRefresh,
      retainedRevisions: [legacy],
      loadRetainedCorpus: () => null,
    });
    expect(missingLegacyCorpus.createdRevisionIds).toHaveLength(1);
    expect(missingLegacyCorpus.missingRetainedCorpusRevisionIds)
      .toEqual([legacy.revisionId]);

    const directory = await mkdtemp(join(tmpdir(), "pmh-research-input-novelty-"));
    tempDirectories.push(directory);
    const store = new SqliteOperationalStore(join(directory, "control-plane.sqlite"));
    store.saveRelationDiscoveryCorpus(work.corpus);
    store.saveAgentExecutionBatch({ tasks: original.map((item) => item.task) });
    store.saveRelationDiscoveryTaskRevisions(original);
    store.saveRelationDiscoveryCorpus(observationOnlyRefresh);
    const durable = reconcileRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: observationOnlyRefresh,
      retainedRevisions: store.loadRelationDiscoveryTaskRevisions(512),
      loadRetainedCorpus: (identity) => store.loadRelationDiscoveryCorpus(identity),
    });
    store.saveAgentExecutionBatch({
      tasks: durable.currentRevisions.filter((item) =>
        durable.createdRevisionIds.includes(item.revisionId)
      ).map((item) => item.task),
    });
    store.saveRelationDiscoveryTaskRevisions(durable.currentRevisions.filter((item) =>
      durable.createdRevisionIds.includes(item.revisionId)
    ));
    expect(store.loadRelationDiscoveryCorpus(observationOnlyRefresh.snapshotIdentity))
      .toEqual(observationOnlyRefresh);
    expect(store.loadRelationDiscoveryTaskRevisions(512)).toHaveLength(original.length);
    expect(store.loadAgentExecutionSnapshot().tasks).toHaveLength(original.length);
    store.saveRelationDiscoveryCorpus(changedCorpus);
    const durableChanged = reconcileRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: changedCorpus,
      retainedRevisions: store.loadRelationDiscoveryTaskRevisions(512),
      loadRetainedCorpus: (identity) => store.loadRelationDiscoveryCorpus(identity),
    });
    const newlyBound = durableChanged.currentRevisions.filter((item) =>
      durableChanged.createdRevisionIds.includes(item.revisionId)
    );
    store.saveAgentExecutionBatch({ tasks: newlyBound.map((item) => item.task) });
    store.saveRelationDiscoveryTaskRevisions(newlyBound);
    expect(store.loadRelationDiscoveryTaskRevisions(512))
      .toHaveLength(original.length * 2);
    expect(store.loadAgentExecutionSnapshot().tasks).toHaveLength(original.length);
    store.close();
  });

  it("materializes corpus-bound input revisions and accepts inspected policy-bound findings", async () => {
    const work = fixture();
    const relationWork = buildOntologyRelationWorkProjection(work);
    const revisions = materializeRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: work.corpus,
    });
    expect(revisions).toHaveLength(2);
    expect(revisions.every((item) => item.task.kind === "RELATION_DISCOVERY")).toBe(true);
    expect(revisions.every((item) => item.automaticDispatch === false)).toBe(true);

    const rotatedCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: work.corpus.sourceSetIdentity,
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: [
        ...work.corpus.listings,
        listing("venue-c:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      ],
    });
    const rotated = materializeRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: rotatedCorpus,
    });
    expect(rotated[0]!.workItemId).toBe(revisions[0]!.workItemId);
    expect(rotated[0]!.revisionId).not.toBe(revisions[0]!.revisionId);
    expect(rotated[0]!.task.taskId).toBe(revisions[0]!.task.taskId);

    const revision = revisions[0]!;
    const ontologyProfile = work.execution.executionProfiles.find((item) =>
      item.toolPolicy.protocol === "MARKET_ONTOLOGY_AGENT_TOOLS_V1"
    )!;
    const runtime = work.portfolio.runtimeDefinitions.find((item) =>
      item.runtimeDefinitionId === ontologyProfile.runtimeDefinitionId
    )!;
    const credential = work.portfolio.credentialBindings.find((item) =>
      item.credentialBindingId === ontologyProfile.credentialBindingId
    )!;
    const model = work.portfolio.modelProfiles.find((item) =>
      item.modelProfileId === ontologyProfile.modelProfileId
    )!;
    const profile = buildExecutionProfile({
      profileKey: "relation-discovery-test",
      revision: 1,
      runtimeDefinition: runtime,
      credentialBinding: credential,
      modelProfile: model,
      toolProtocol: "RELATION_DISCOVERY_AGENT_TOOLS_V1",
      runBudget: {
        maximumModelInvocations: 8,
        maximumToolCalls: 24,
        maximumWallClockMs: 300_000,
        maximumInputTokens: "200000",
        maximumOutputTokens: "20000",
      },
      createdAt: NOW,
    });
    const run = buildAgentRun({
      task: revision.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:relation-discovery-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const beforeAttempt = selectRelationDiscoveryCampaignTasks({
      revisions: [...revisions, ...rotated],
      execution: Object.freeze({
        ...work.execution,
        tasks: Object.freeze([
          ...work.execution.tasks,
          ...revisions.map((item) => item.task),
          ...rotated.map((item) => item.task),
        ]),
      }),
    });
    expect(beforeAttempt).toHaveLength(1);
    expect(beforeAttempt[0]!.workItemId).toBe(revision.workItemId);
    const afterAttempt = selectRelationDiscoveryCampaignTasks({
      revisions: [...revisions, ...rotated],
      execution: Object.freeze({
        ...work.execution,
        tasks: Object.freeze([
          ...work.execution.tasks,
          ...revisions.map((item) => item.task),
          ...rotated.map((item) => item.task),
        ]),
        runs: Object.freeze([...work.execution.runs, run]),
      }),
    });
    expect(afterAttempt).toHaveLength(1);
    expect(afterAttempt[0]!.workItemId).not.toBe(revision.workItemId);
    const directory = await mkdtemp(join(tmpdir(), "pmh-relation-discovery-"));
    tempDirectories.push(directory);
    const path = join(directory, "control-plane.sqlite");
    const store = new SqliteOperationalStore(path);
    store.saveAgentExecutionBatch({
      runtimeDefinitions: [runtime],
      credentialBindings: [credential],
      modelProfiles: [model],
      executionProfiles: [profile],
      tasks: [revision.task],
      runs: [run],
    });
    store.saveRelationDiscoveryCorpus(work.corpus);
    store.saveRelationDiscoveryTaskRevisions([revision]);
    const host = new RelationDiscoveryAgentToolHost(
      revision.taskPayload,
      work.corpus,
      store,
      relationDiscoveryRevisionWorkItem(revision),
    );
    const refs = work.corpus.listings.slice(0, 2).map((item) => item.listingRef);
    const context = (toolName: string, input: unknown) => ({
      run,
      task: revision.task,
      executionProfile: profile,
      callId: `call-${toolName}`,
      toolName,
      input,
    });
    const hypothesis = {
      relationKind: relationDiscoveryRevisionWorkItem(revision).candidateRelationKinds[0]!,
      listingRefs: refs,
      statement: "The inspected listings may encode the same settlement proposition.",
      rationale: "Titles align, but independent rules review remains necessary.",
      falsifiers: ["The contracts use different resolution criteria."],
    };
    await expect(host.execute(context("record_relation_hypothesis", hypothesis)))
      .rejects.toThrow("inspected first");
    const inspection = await host.execute(
      context("inspect_market_listings", { listingRefs: refs }),
    );
    expect(inspection.output).toMatchObject({
      schemaVersion: "pmh.relation-discovery-listing-inspection.v2",
      sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
    });
    const inspectedListing = (inspection.output as {
      listings: readonly Readonly<Record<string, unknown>>[];
    }).listings[0]!;
    expect(inspectedListing).toMatchObject({
      listingRef: refs[0],
      rulesText: "Resolves from the named official source.",
    });
    expect((inspectedListing.outcomes as readonly Readonly<Record<string, unknown>>[])[0])
      .not.toHaveProperty("indicativePrice");
    expect(inspectedListing).not.toHaveProperty("sourceReceivedAt");
    expect(inspectedListing).not.toHaveProperty("sourceRawHash");
    expect(inspectedListing).not.toHaveProperty("status");
    expect(inspectedListing).not.toHaveProperty("priceScale");
    await expect(host.execute(context("record_relation_hypothesis", {
      ...hypothesis,
      relationKind: "EXHAUSTIVE",
    }))).rejects.toThrow("outside the assigned candidate policy");
    const first = await host.execute(context("record_relation_hypothesis", hypothesis));
    const replay = await host.execute(context("record_relation_hypothesis", hypothesis));
    expect(first).toEqual(replay);
    const counterexample = {
      rejectedRelationKind: relationDiscoveryRevisionWorkItem(revision)
        .candidateRelationKinds[0]!,
      listingRefs: refs,
      statement: "The apparent relation may fail under the retained settlement wording.",
      rationale: "The evidence still needs independent rule review.",
      falsifiers: ["The exact rules prove the relation under every relevant state."],
    };
    await host.execute(context("record_relation_counterexample", counterexample));
    await expect(host.execute(context("record_relation_hypothesis", {
      ...hypothesis,
      relationKind: "RELATED",
    }))).rejects.toThrow("use record_ontology_route");
    await expect(host.execute(context("record_ontology_route", {
      routeLayer: "SUBJECT_REFERENCE",
      searchSignals: ["Taylor Swift"],
      listingRefs: refs,
      statement: "The inspected contracts mention the same subject.",
      rationale: "A standing route should wake only on membership novelty.",
      falsifiers: ["The names refer to different subjects."],
    }))).rejects.toThrow("ground at least two inspected listings");
    const routeObservation = await host.execute(context("record_ontology_route", {
      routeLayer: "SUBJECT_REFERENCE",
      searchSignals: ["Mark Kelly"],
      listingRefs: refs,
      statement: "The inspected contracts mention the same named person.",
      rationale: "The subject reference is routing evidence, not a payoff relation.",
      falsifiers: ["The name refers to different people in these contracts."],
    }));
    expect(routeObservation.output).toMatchObject({
      kind: "ONTOLOGY_ROUTE",
      authority: "SEARCH_ROUTING_ONLY",
      reviewStatus: "NOT_APPLICABLE_ROUTING_ONLY",
      routeLayer: "SUBJECT_REFERENCE",
      searchSignals: ["Mark Kelly"],
      searchFields: ["title"],
      baselineListingRefs: [
        "venue-a:kelly-crime",
        "venue-a:kelly-nominee",
        "venue-b:kelly-crime",
      ],
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      executionAuthority: false,
    });
    expect(host.findings()).toHaveLength(3);
    expect(host.findings()[0]).toMatchObject({
      workItemId: revision.workItemId,
      sourceTaskId: revision.task.taskId,
      sourceAgentRunId: run.runId,
      sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
      reviewStatus: "UNREVIEWED",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(host.findings()[1]).toMatchObject({
      kind: "COUNTEREXAMPLE",
      reviewStatus: "UNREVIEWED",
      semanticDecisionAuthority: false,
    });
    const retained = host.findings();
    const quietRoutes = buildStandingOntologyRouteProjection({
      findings: retained,
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: work.corpus,
    });
    expect(quietRoutes).toMatchObject({
      routeCount: 1,
      familyCount: 1,
      corroboratedFamilyCount: 0,
      baselineDisagreementFamilyCount: 0,
      nativeRouteCount: 1,
      legacyRouteCount: 0,
      blockedRouteCount: 0,
      quietRouteCount: 1,
      followupEligibleRouteCount: 0,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
    });
    const quietEpisodes = materializeStandingOntologyRouteObservationEpisodes({
      projection: quietRoutes,
      priorEpisodes: [],
      observedAt: NOW,
    });
    expect(quietEpisodes).toHaveLength(1);
    expect(quietEpisodes[0]).toMatchObject({
      previousEpisodeId: null,
      state: "QUIESCENT",
      followupEligible: false,
      authority: "DURABLE_ROUTE_LIFECYCLE_EVIDENCE_ONLY",
    });
    const receiveTimeOnlyCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: work.corpus.sourceSetIdentity,
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: work.corpus.listings.map((item) => Object.freeze({
        ...item,
        sourceReceivedAt: "2026-08-12T10:00:00.000Z",
      })),
    });
    expect(buildStandingOntologyRouteProjection({
      findings: retained,
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: receiveTimeOnlyCorpus,
    }).routes[0]!.observation).toMatchObject({
      state: "QUIESCENT",
      addedListingRefs: [],
      removedListingRefs: [],
      changedListingRefs: [],
      followupEligible: false,
    });
    const expandedCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: work.corpus.sourceSetIdentity,
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: [
        ...work.corpus.listings,
        listing("venue-c:kelly-senate", "Will Mark Kelly win reelection to the Senate?"),
      ],
    });
    const expandedProjection = buildStandingOntologyRouteProjection({
      findings: retained,
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: expandedCorpus,
    });
    expect(expandedProjection.routes[0]!.observation).toMatchObject({
      state: "EXPANDED",
      addedListingRefs: ["venue-c:kelly-senate"],
      removedListingRefs: [],
      changedListingRefs: [],
      followupEligible: true,
    });
    const wakeEpisodes = materializeStandingOntologyRouteObservationEpisodes({
      projection: expandedProjection,
      priorEpisodes: quietEpisodes,
      observedAt: "2026-08-12T09:30:00.000Z",
    });
    expect(wakeEpisodes).toHaveLength(1);
    expect(wakeEpisodes[0]).toMatchObject({
      previousEpisodeId: quietEpisodes[0]!.episodeId,
      state: "EXPANDED",
      followupEligible: true,
    });
    expect(materializeStandingOntologyRouteObservationEpisodes({
      projection: expandedProjection,
      priorEpisodes: [...quietEpisodes, ...wakeEpisodes],
      observedAt: "2026-08-12T09:45:00.000Z",
    })).toEqual([]);
    const followupOntology = buildMarketOntologySnapshot(expandedCorpus);
    const followups = materializeStandingOntologyRouteFollowups({
      projection: expandedProjection,
      ontology: followupOntology,
    });
    expect(followups).toHaveLength(1);
    expect(followups[0]).toMatchObject({
      schemaVersion: "pmh.standing-ontology-route-followup.v2",
      routeFamilyId: expandedProjection.families[0]!.family.routeFamilyId,
      sourceRouteIds: [expandedProjection.routes[0]!.route.routeId],
      sourceObservationId: expandedProjection.families[0]!.observation.observationId,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      executionAuthority: false,
      workItem: {
        kind: "STANDING_ROUTE_FOLLOWUP",
        disposition: "RUNNABLE_RESEARCH",
        campaignEligible: true,
        candidateRelationKinds: [
          "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
          "CONDITIONAL", "CONFLICTING",
        ],
      },
    });
    expect(followups[0]!.workItem).toMatchObject({
      sourceProposalIds: relationDiscoveryRevisionWorkItem(revision).sourceProposalIds,
      sourceIssueIds: relationDiscoveryRevisionWorkItem(revision).sourceIssueIds,
      sourceIssueRevisionIds:
        relationDiscoveryRevisionWorkItem(revision).sourceIssueRevisionIds,
    });
    expect(followups[0]!.workItem.candidateRelationKinds).not.toContain("RELATED");
    expect(materializeStandingOntologyRouteFollowups({
      projection: expandedProjection,
      ontology: followupOntology,
    })).toEqual(followups);
    const unrelatedAfterWakeCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: work.corpus.sourceSetIdentity,
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: [
        ...expandedCorpus.listings,
        listing("venue-z:unrelated", "Will an unrelated event happen in 2027?"),
      ],
    });
    const unrelatedAfterWakeProjection = buildStandingOntologyRouteProjection({
      findings: retained,
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: unrelatedAfterWakeCorpus,
    });
    expect(unrelatedAfterWakeProjection.currentCorpusSnapshotIdentity)
      .not.toBe(expandedProjection.currentCorpusSnapshotIdentity);
    expect(unrelatedAfterWakeProjection.routes[0]!.observation.observationId)
      .toBe(expandedProjection.routes[0]!.observation.observationId);
    expect(materializeStandingOntologyRouteFollowups({
      projection: unrelatedAfterWakeProjection,
      ontology: buildMarketOntologySnapshot(unrelatedAfterWakeCorpus),
    })).toEqual(followups);
    const secondWakeCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: work.corpus.sourceSetIdentity,
      eligibleSourceCount: work.corpus.eligibleSourceCount,
      excludedSourceCount: work.corpus.excludedSourceCount,
      listings: [
        ...unrelatedAfterWakeCorpus.listings,
        listing("venue-d:kelly-cabinet", "Will Mark Kelly join the cabinet in 2027?"),
      ],
    });
    const secondWakeProjection = buildStandingOntologyRouteProjection({
      findings: retained,
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: secondWakeCorpus,
    });
    const secondWakeFollowups = materializeStandingOntologyRouteFollowups({
      projection: secondWakeProjection,
      ontology: buildMarketOntologySnapshot(secondWakeCorpus),
    });
    expect(secondWakeFollowups).toHaveLength(1);
    expect(secondWakeFollowups[0]!.observationMembershipIdentity)
      .not.toBe(followups[0]!.observationMembershipIdentity);
    expect(secondWakeFollowups[0]!.workItem.workItemId)
      .not.toBe(followups[0]!.workItem.workItemId);
    const nativeRoute = retained.find((item) => item.kind === "ONTOLOGY_ROUTE")!;
    if (nativeRoute.kind !== "ONTOLOGY_ROUTE") {
      throw new Error("native route fixture is missing");
    }
    const { findingId: _nativeFindingId, ...nativeRouteBody } = nativeRoute;
    const corroboratingRouteBody = Object.freeze({
      ...nativeRouteBody,
      sourceAgentRunId: hashCanonical({ duplicateRouteSource: true }),
      searchSignals: Object.freeze(["mark kelly"]),
    });
    const corroboratingRoute = assertRelationDiscoveryFinding(Object.freeze({
      ...corroboratingRouteBody,
      findingId: hashCanonical(corroboratingRouteBody),
    }));
    const corroboratedProjection = buildStandingOntologyRouteProjection({
      findings: [...retained, corroboratingRoute],
      taskRevisions: [revision],
      loadCorpus: (identity) => identity === work.corpus.snapshotIdentity
        ? work.corpus
        : null,
      currentCorpus: expandedCorpus,
    });
    expect(corroboratedProjection).toMatchObject({
      routeCount: 2,
      familyCount: 1,
      corroboratedFamilyCount: 1,
      baselineDisagreementFamilyCount: 0,
      followupEligibleRouteCount: 2,
      followupEligibleFamilyCount: 1,
    });
    expect(corroboratedProjection.families[0]!.family).toMatchObject({
      canonicalSearchSignals: ["mark kelly"],
      sourceCount: 2,
      nativeSourceCount: 2,
      legacySourceCount: 0,
      authoringRunIds: expect.arrayContaining([
        run.runId,
        corroboratingRoute.sourceAgentRunId,
      ]),
      sourceFindingIds: expect.arrayContaining([
        nativeRoute.findingId,
        corroboratingRoute.findingId,
      ]),
    });
    const corroboratedFollowups = materializeStandingOntologyRouteFollowups({
      projection: corroboratedProjection,
      ontology: followupOntology,
    });
    expect(corroboratedFollowups).toHaveLength(1);
    expect(corroboratedFollowups[0]!.sourceRouteIds).toHaveLength(2);
    const routeExtendedWork = extendOntologyRelationWorkWithStandingRouteFollowups({
      base: relationWork,
      followups,
    });
    const followupRevision = materializeRelationDiscoveryTaskRevisions({
      relationWork: routeExtendedWork,
      corpus: expandedCorpus,
    }).find((item) => relationDiscoveryRevisionWorkItem(item).kind ===
      "STANDING_ROUTE_FOLLOWUP")!;
    const followupRun = buildAgentRun({
      task: followupRevision.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:standing-route-non-recursion-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const followupHost = new RelationDiscoveryAgentToolHost(
      followupRevision.taskPayload,
      expandedCorpus,
      undefined,
      relationDiscoveryRevisionWorkItem(followupRevision),
    );
    await expect(followupHost.execute({
      run: followupRun,
      task: followupRevision.task,
      executionProfile: profile,
      callId: "call-no-recursive-route",
      toolName: "record_ontology_route",
      input: {
        routeLayer: "SUBJECT_REFERENCE",
        searchSignals: ["Mark Kelly"],
        listingRefs: followups[0]!.workItem.seedListingBindings
          .slice(0, 2).map((item) => item.listingRef),
        statement: "This must not create a recursively autonomous route.",
        rationale: "The follow-up is already the single bounded wake hop.",
        falsifiers: ["No recursion boundary exists."],
      },
    })).rejects.toThrow("cannot create another autonomous route");
    const valueProjection = buildStandingOntologyRouteValueProjection({
      projection: expandedProjection,
      followups,
      episodes: [...quietEpisodes, ...wakeEpisodes],
      execution: Object.freeze({
        ...work.execution,
        runs: Object.freeze([...work.execution.runs, run, followupRun]),
      }),
      taskRevisions: [...revisions, followupRevision],
      findings: retained,
      compilations: [],
      semanticReviews: [],
      probabilityJobs: [],
      opportunities: [],
      observedAt: "2026-08-12T10:00:00.000Z",
    });
    expect(valueProjection).toMatchObject({
      familyCount: 1,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      automaticDispatch: false,
      authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY",
      causalClaim: false,
      values: [{
        routeFamilyId: expandedProjection.families[0]!.family.routeFamilyId,
        observedWakeCount: 1,
        observationEpisodeCount: 2,
        totalQuietDurationMs: "1800000",
        valueStage: "WAKE_ATTEMPTED",
        quietDurationMs: null,
        followupWorkItemIds: [followups[0]!.workItem.workItemId],
        followupRunIds: [followupRun.runId],
        creationUsage: { runCount: expect.any(Number) },
        followupUsage: { runCount: 1, invocationCount: 0 },
      }],
    });
    expect(valueProjection.values[0]!.creationUsage.runCount).toBeGreaterThanOrEqual(1);
    const quietValue = buildStandingOntologyRouteValueProjection({
      projection: quietRoutes,
      followups: [],
      episodes: quietEpisodes,
      execution: work.execution,
      taskRevisions: revisions,
      findings: retained,
      compilations: [],
      semanticReviews: [],
      probabilityJobs: [],
      opportunities: [],
      observedAt: "2026-08-12T10:00:00.000Z",
    });
    expect(quietValue.values[0]).toMatchObject({
      observedWakeCount: 0,
      observationEpisodeCount: 1,
      valueStage: "QUIET_MEMORY",
      quietDurationMs: "3600000",
      totalQuietDurationMs: "3600000",
    });
    expect(materializeStandingOntologyRouteFollowups({
      projection: quietRoutes,
      ontology: buildMarketOntologySnapshot(work.corpus),
    })).toEqual([]);
    const positive = retained.find((item) => item.kind === "RELATION_HYPOTHESIS")!;
    if (positive.kind !== "RELATION_HYPOTHESIS") {
      throw new Error("positive relation finding fixture is missing");
    }
    const compilation = compileRelationDiscoveryFindingForSemanticReview({
      finding: positive,
      taskRevision: revision,
      corpus: work.corpus,
    });
    expect(compilation).toMatchObject({
      schemaVersion: "pmh.relation-discovery-proposal-compilation.v1",
      proposal: {
        relationKind: hypothesis.relationKind,
        listingRefs: refs,
        reviewStatus: "UNREVIEWED",
        authority: "PROPOSE_ONLY",
      },
      origin: {
        workItemId: revision.workItemId,
        workArtifactHash: revision.workArtifactHash,
        relationDiscoveryTaskRevisionId: revision.revisionId,
        relationDiscoveryTaskId: revision.task.taskId,
        relationDiscoveryRunId: run.runId,
        relationDiscoveryFindingId: positive.findingId,
        sourceCorpusSnapshotIdentity: work.corpus.snapshotIdentity,
        sourceOntologyIssueIds: relationDiscoveryRevisionWorkItem(revision).sourceIssueIds,
        semanticReviewIssueIds: relationDiscoveryRevisionWorkItem(revision).sourceIssueIds,
        authority: "LINEAGE_ONLY",
        semanticDecisionAuthority: false,
        probabilityAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      },
      admission: "SEMANTIC_REVIEW_CANDIDATE",
      semanticDecisionAuthority: false,
    });
    expect(compilation.evidenceBundle.listingRefs).toEqual(refs);
    expect(relationDiscoveryReviewLane("RELATED")).toBe("ONTOLOGY_ROUTING_ONLY");
    for (const relationKind of [
      "EQUIVALENT",
      "IMPLIES",
      "SUBSET",
      "MUTUALLY_EXCLUSIVE",
      "EXHAUSTIVE",
      "CONDITIONAL",
      "CONFLICTING",
    ] as const) {
      expect(relationDiscoveryReviewLane(relationKind)).toBe("SEMANTIC_PAYOFF_REVIEW");
    }
    const { findingId: _relatedFindingId, ...relatedFindingBase } = positive;
    const relatedFindingBody = Object.freeze({
      ...relatedFindingBase,
      relationKind: "RELATED" as const,
    });
    const relatedCompilation = compileRelationDiscoveryFindingForSemanticReview({
      finding: Object.freeze({
        ...relatedFindingBody,
        findingId: hashCanonical(relatedFindingBody),
      }),
      taskRevision: revision,
      corpus: work.corpus,
    });
    const { findingId: _payoffFindingId, ...payoffFindingBase } = positive;
    const payoffFindingBody = Object.freeze({
      ...payoffFindingBase,
      relationKind: "IMPLIES" as const,
    });
    const payoffCompilation = compileRelationDiscoveryFindingForSemanticReview({
      finding: Object.freeze({
        ...payoffFindingBody,
        findingId: hashCanonical(payoffFindingBody),
      }),
      taskRevision: revision,
      corpus: work.corpus,
    });
    expect(selectRelationDiscoverySemanticReviewCompilations([
      relatedCompilation,
      payoffCompilation,
    ])).toEqual([payoffCompilation]);
    expect(compileRelationDiscoveryFindingForSemanticReview({
      finding: positive,
      taskRevision: revision,
      corpus: work.corpus,
    })).toEqual(compilation);
    const { findingId: _rotatedFindingId, ...rotatedFindingBase } = positive;
    const rotatedFindingBody = Object.freeze({
      ...rotatedFindingBase,
      sourceCorpusSnapshotIdentity: rotatedCorpus.snapshotIdentity,
    });
    const rotatedFinding = Object.freeze({
      ...rotatedFindingBody,
      findingId: hashCanonical(rotatedFindingBody),
    });
    const rotatedCompilation = compileRelationDiscoveryFindingsForSemanticReview({
      findings: [rotatedFinding, positive],
      // Durable reads are newest-first. Both corpus-bound revisions deliberately
      // share one stable task identity, so taskId alone cannot choose lineage.
      taskRevisions: [rotated[0]!, revision],
      loadCorpus: (snapshotIdentity) => snapshotIdentity === rotatedCorpus.snapshotIdentity
        ? rotatedCorpus
        : snapshotIdentity === work.corpus.snapshotIdentity
          ? work.corpus
          : null,
    });
    expect(rotatedCompilation).toHaveLength(2);
    expect(rotatedCompilation.map((item) => [
      item.origin.sourceCorpusSnapshotIdentity,
      item.origin.relationDiscoveryTaskRevisionId,
    ])).toEqual(expect.arrayContaining([
      [work.corpus.snapshotIdentity, revision.revisionId],
      [rotatedCorpus.snapshotIdentity, rotated[0]!.revisionId],
    ]));
    const counter = retained.find((item) => item.kind === "COUNTEREXAMPLE")!;
    expect(() => compileRelationDiscoveryFindingForSemanticReview({
      // The compiler must reject this at runtime even when an unsafe caller lies.
      finding: counter as typeof positive,
      taskRevision: revision,
      corpus: work.corpus,
    })).toThrow("counterexamples cannot enter semantic review automatically");
    const { findingId: _findingId, ...findingBody } = retained[0]!;
    const tamperedBody = Object.freeze({
      ...findingBody,
      listingEvidenceHashes: Object.freeze([
        hashCanonical({ substituted: true }),
        ...findingBody.listingEvidenceHashes.slice(1),
      ]),
    });
    expect(() => store.saveRelationDiscoveryFindings([Object.freeze({
      ...tamperedBody,
      findingId: hashCanonical(tamperedBody),
    })])).toThrow("listing evidence hash is inconsistent");
    const returnedQuietEpisodes = materializeStandingOntologyRouteObservationEpisodes({
      projection: quietRoutes,
      priorEpisodes: [...quietEpisodes, ...wakeEpisodes],
      observedAt: "2026-08-12T11:00:00.000Z",
    });
    expect(returnedQuietEpisodes).toHaveLength(1);
    expect(returnedQuietEpisodes[0]).toMatchObject({
      familyObservationId: quietEpisodes[0]!.familyObservationId,
      previousEpisodeId: wakeEpisodes[0]!.episodeId,
      state: "QUIESCENT",
    });
    expect(returnedQuietEpisodes[0]!.episodeId).not.toBe(quietEpisodes[0]!.episodeId);
    const lifecycleEpisodes = [...quietEpisodes, ...wakeEpisodes, ...returnedQuietEpisodes];
    store.saveStandingOntologyRouteObservationEpisodes(lifecycleEpisodes);
    expect(store.loadStandingOntologyRouteObservationEpisodes([
      quietRoutes.families[0]!.family.routeFamilyId,
    ])).toEqual(lifecycleEpisodes);
    const forkedWake = materializeStandingOntologyRouteObservationEpisodes({
      projection: secondWakeProjection,
      priorEpisodes: quietEpisodes,
      observedAt: "2026-08-12T09:40:00.000Z",
    });
    expect(() => store.saveStandingOntologyRouteObservationEpisodes(forkedWake))
      .toThrow("history cannot fork");
    store.close();
    const reopened = new SqliteOperationalStore(path);
    expect(reopened.loadRelationDiscoveryCorpus(work.corpus.snapshotIdentity)).toEqual(work.corpus);
    expect(reopened.loadRelationDiscoveryTaskRevisions(10)).toEqual([revision]);
    expect(reopened.loadRelationDiscoveryFindings(10)).toEqual(
      expect.arrayContaining(retained),
    );
    expect(reopened.loadRelationDiscoveryFindings(10)).toHaveLength(3);
    expect(reopened.loadStandingOntologyRouteSourceFindings()).toEqual([
      expect.objectContaining({
        kind: "ONTOLOGY_ROUTE",
        authority: "SEARCH_ROUTING_ONLY",
        reviewStatus: "NOT_APPLICABLE_ROUTING_ONLY",
      }),
    ]);
    expect(reopened.loadStandingOntologyRouteObservationEpisodes()).toEqual(
      lifecycleEpisodes,
    );
    expect(reopened.loadRelationDiscoveryTaskRevisionsForTaskIds([
      revision.task.taskId,
      revision.task.taskId,
    ])).toEqual([revision]);
    expect(() => reopened.loadRelationDiscoveryTaskRevisionsForTaskIds([
      "sha256:not-a-task" as never,
    ])).toThrow("invalid task id");
    const secondRun = buildAgentRun({
      task: revision.task,
      executionProfile: profile,
      runOrdinal: 2,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:semantic-admission-restart-test",
        authorizedAt: "2026-08-12T09:01:00.000Z",
      },
      createdAt: "2026-08-12T09:01:00.000Z",
    });
    reopened.saveAgentExecutionBatch({ runs: [secondRun] });
    const restartedHost = new RelationDiscoveryAgentToolHost(
      revision.taskPayload,
      work.corpus,
      reopened,
      relationDiscoveryRevisionWorkItem(revision),
    );
    const restartedContext = (toolName: string, input: unknown) => ({
      run: secondRun,
      task: revision.task,
      executionProfile: profile,
      callId: `restart-${toolName}`,
      toolName,
      input,
    });
    const workRead = await restartedHost.execute(
      restartedContext("read_relation_work", {}),
    );
    expect(workRead.output).toMatchObject({
      semanticCoverage: {
        retainedFindingCount: 3,
        matchingCoverageCount: 3,
        completeAdmissionCheckStillRequired: true,
        providerRequestsStartedByRead: 0,
        modelInvocationsStartedByRead: 0,
        writesStartedByRead: 0,
      },
    });
    await restartedHost.execute(
      restartedContext("inspect_market_listings", { listingRefs: refs }),
    );
    const findingCountBeforeRedundancy =
      reopened.loadRelationDiscoveryFindingsForAdmission().length;
    await expect(restartedHost.execute(restartedContext("record_ontology_route", {
      routeLayer: "EVENT_REFERENCE",
      searchSignals: ["Mark Kelly"],
      listingRefs: refs,
      statement: "The same exact title query is described as an event route.",
      rationale: "Changing the route label cannot create new operational search memory.",
      falsifiers: ["The literal query or permitted fields differ."],
    }))).rejects.toThrow(
      `REDUNDANT_SEARCH_MEMORY; overlap finding ids: ${
        retained.find((item) => item.kind === "ONTOLOGY_ROUTE")!.findingId
      }`,
    );
    expect(restartedHost.findings()).toEqual([]);
    expect(restartedHost.semanticNoveltyDecisions()).toEqual([]);
    expect(reopened.loadRelationDiscoveryFindingsForAdmission())
      .toHaveLength(findingCountBeforeRedundancy);
    reopened.close();
  });
});
