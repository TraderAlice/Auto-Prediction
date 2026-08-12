import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  assertMarketOntologyAgentProposal,
  buildAgentRun,
  buildAgentInputRevisionRunAnnotation,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildModelInvocation,
  buildOntologyAgentCampaignPreview,
  buildOntologyAllocationOutcomeProjection,
  buildOntologyRelationWorkProjection,
  buildPausedAgentCampaign,
  completeAgentRun,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  type AgentExecutionSnapshot,
  type DiscoveryCatalogListing,
  type MarketOntologyAgentProposal,
  type OntologySearchIssueRevision,
} from "../src/index.js";

const NOW = "2026-08-12T09:00:00.000Z";
const LATER = "2026-08-12T09:01:00.000Z";

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

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-outcome-test" }),
    eligibleSourceCount: 3,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic nomination?"),
      listing("venue-a:warner-award", "Will Fred Warner win defensive player of the year?"),
      listing("venue-b:warner-senate", "Will Mark Warner win the Virginia Senate race?"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({ corpus, ontology, proposals: [] });
  const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(
    { PMH_DISCOVERY_PROVIDER: "codex" },
    () => Date.parse(NOW),
  ));
  const execution: AgentExecutionSnapshot = Object.freeze({
    ...emptyAgentExecutionSnapshot(),
    ...portfolio,
    tasks: Object.freeze(revisions.map((item) => item.task)),
  });
  const route = execution.workloadRoutes.find((item) =>
    item.taskKind === "ONTOLOGY_NORMALIZATION"
  )!;
  const profile = execution.executionProfiles.find((item) =>
    item.executionProfileId === route.executionProfileId
  )!;
  const preview = buildOntologyAgentCampaignPreview({
    revisions,
    execution,
    capability: {
      executionProfileId: profile.executionProfileId,
      configurationStatus: "CONFIGURED",
      runtimeStatus: "AVAILABLE",
      serviceCapability: "USABLE",
      dispatchEligibility: "ELIGIBLE",
      diagnostic: "fixture",
      observation: null,
      inferenceRequestsStarted: 0,
      modelInvocationsStarted: 0,
      secretMaterialRetained: false,
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
    createdAt: NOW,
  });
  const active = activateAgentCampaign(paused, "operator:fixture", LATER);
  return { corpus, revisions, execution, profile, preview, paused, active };
}

function proposal(
  revision: OntologySearchIssueRevision,
  runId: `sha256:${string}`,
  kind: "WORLD_PROPOSITION" | "COUNTEREXAMPLE",
  proposedAt = LATER,
): MarketOntologyAgentProposal {
  const node = revision.taskPayload.listingEvidence[0]!.node;
  const envelope = Object.freeze({
    ontologyIdentity: revision.ontologyIdentity,
    sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
    sourceAgentRunId: runId,
    sourceTrailheadIds: Object.freeze([revision.trailheadIds[0]!]),
    sourceRelationPatternIds: Object.freeze([revision.relationPatternId]),
    listingBindings: Object.freeze([Object.freeze({
      listingRef: node.listingRef,
      nodeId: node.nodeId,
      worldFacetId: node.worldFacet.facetId,
      settlementFacetId: node.settlementFacet.facetId,
      tradedFacetId: node.tradedFacet.facetId,
    })]),
    rationale: "Exact fixture evidence supports a bounded ontology result.",
    proposedAt,
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  const specific = kind === "WORLD_PROPOSITION" ? Object.freeze({
    kind,
    label: "Mark Kelly wins the 2028 Democratic nomination",
    subjectLabels: Object.freeze(["Mark Kelly"]),
    predicate: "wins_democratic_nomination",
    timeScope: "2028",
    parameters: Object.freeze([]),
    ambiguityNotes: Object.freeze([]),
    falsifiers: Object.freeze(["The listing names a different person."]),
  }) : Object.freeze({
    kind,
    rejectedClaim: "The assigned contracts are equivalent.",
    reason: "They concern different predicates and people.",
    searchSignals: Object.freeze(["Mark Kelly"]),
  });
  const body = Object.freeze({
    schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
    ...envelope,
    ...specific,
  });
  return assertMarketOntologyAgentProposal(Object.freeze({
    ...body,
    proposalId: hashCanonical(body),
  }));
}

function projection(input: Readonly<{
  execution: AgentExecutionSnapshot;
  revisions: readonly OntologySearchIssueRevision[];
  proposals?: readonly MarketOntologyAgentProposal[];
}>) {
  const proposals = input.proposals ?? [];
  return buildOntologyAllocationOutcomeProjection({
    execution: input.execution,
    ontologyProposals: proposals,
    relationWork: buildOntologyRelationWorkProjection({
      proposals,
      revisions: input.revisions,
      execution: input.execution,
    }),
    relationTaskRevisions: [],
    relationFindings: [],
    relationCompilations: [],
    semanticReviews: [],
    probabilityJobs: [],
    opportunities: [],
  });
}

describe("ontology allocation realized outcomes", () => {
  it("retains a provider-free unacted baseline for a paused campaign", () => {
    const work = fixture();
    const execution = Object.freeze({
      ...work.execution,
      campaigns: Object.freeze([work.paused]),
    });
    const first = projection({ execution, revisions: work.revisions });
    const replay = projection({ execution, revisions: work.revisions });

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      campaignEpisodeCount: 1,
      selectedActionCount: work.preview.taskIds.length,
      actedActionCount: 0,
      terminalActionCount: 0,
      stageCounts: { UNACTED: work.preview.taskIds.length },
      recurrenceQualification: {
        qualifiedStratumCount: 0,
        yieldCostEvidenceSufficient: false,
        operatorActivationStillRequired: true,
      },
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
      writesStartedByRead: 0,
      automaticDispatch: false,
      policyMutationAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });

    const unrelated = proposal(
      work.revisions[0]!,
      hashCanonical({ run: "unrelated" }),
      "COUNTEREXAMPLE",
      "2026-08-13T09:00:00.000Z",
    );
    expect(projection({
      execution,
      revisions: work.revisions,
      proposals: [unrelated],
    })).toEqual(first);
  });

  it("groups paused and active revisions and attributes direct spend to exact actions", () => {
    const work = fixture();
    const binding = work.preview.selectionBinding.taskBindings[0]!;
    const revision = work.revisions.find((item) =>
      item.revisionId === binding.inputRevisionId
    )!;
    const run = completeAgentRun(buildAgentRun({
      task: revision.task,
      executionProfile: work.profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: work.active, authorizedAt: LATER },
      createdAt: LATER,
    }), "SUCCEEDED", "2026-08-12T09:02:00.000Z", null);
    const model = work.execution.modelProfiles.find((item) =>
      item.modelProfileId === work.profile.modelProfileId
    )!;
    const invocation = buildModelInvocation({
      run,
      modelProfile: model,
      ordinal: 1,
      status: "SUCCEEDED",
      startedAt: LATER,
      completedAt: "2026-08-12T09:01:30.000Z",
      inputTokens: "1200",
      outputTokens: "80",
      reasoningTokens: "20",
    });
    const annotation = buildAgentInputRevisionRunAnnotation({
      task: revision.task,
      run,
      revisionKind: "ONTOLOGY_SEARCH_ISSUE",
      revisionId: revision.revisionId,
      exactInput: revision.taskPayload,
    });
    const positive = proposal(revision, run.runId, "WORLD_PROPOSITION");
    const unmatched = projection({
      execution: Object.freeze({
        ...work.execution,
        campaigns: Object.freeze([work.paused, work.active]),
        runs: Object.freeze([run]),
        modelInvocations: Object.freeze([invocation]),
      }),
      revisions: work.revisions,
      proposals: [positive],
    });
    expect(unmatched.campaigns[0]!.actionOutcomes.find((item) =>
      item.selectionActionRef === binding.selectionActionRef
    )).toMatchObject({ stage: "UNACTED", acted: false, directRunIds: [] });
    const execution = Object.freeze({
      ...work.execution,
      campaigns: Object.freeze([work.paused, work.active]),
      runs: Object.freeze([run]),
      runAnnotations: Object.freeze([annotation]),
      modelInvocations: Object.freeze([invocation]),
    });
    const result = projection({ execution, revisions: work.revisions, proposals: [positive] });
    const outcome = result.campaigns[0]!.actionOutcomes.find((item) =>
      item.selectionActionRef === binding.selectionActionRef
    )!;

    expect(result.campaignEpisodeCount).toBe(1);
    expect(result.campaigns[0]!.campaignRevisionIds).toHaveLength(2);
    expect(outcome).toMatchObject({
      stage: "RELATION_WORK_READY",
      acted: true,
      terminal: true,
      ontologyProposalIds: [positive.proposalId],
      directCost: {
        runCount: 1,
        terminalRunCount: 1,
        modelInvocationCount: 1,
        knownInputTokens: "1200",
        knownOutputTokens: "80",
        knownReasoningTokens: "20",
        usageComplete: true,
      },
      downstreamAttribution: "EXCLUSIVE_LINEAGE",
    });

    const counterexample = proposal(revision, run.runId, "COUNTEREXAMPLE");
    const mixed = projection({
      execution,
      revisions: work.revisions,
      proposals: [positive, counterexample],
    }).campaigns[0]!.actionOutcomes.find((item) =>
      item.selectionActionRef === binding.selectionActionRef
    )!;
    expect(mixed).toMatchObject({
      stage: "RELATION_WORK_READY",
      usefulNegativeMemory: true,
      ontologyProposalIds: [positive.proposalId],
      ontologyCounterexampleIds: [counterexample.proposalId],
    });
  });

  it("counts ontology counterexamples as useful negative relation memory", () => {
    const work = fixture();
    const binding = work.preview.selectionBinding.taskBindings[0]!;
    const revision = work.revisions.find((item) =>
      item.revisionId === binding.inputRevisionId
    )!;
    const run = completeAgentRun(buildAgentRun({
      task: revision.task,
      executionProfile: work.profile,
      runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: work.active, authorizedAt: LATER },
      createdAt: LATER,
    }), "SUCCEEDED", "2026-08-12T09:02:00.000Z", null);
    const negative = proposal(revision, run.runId, "COUNTEREXAMPLE");
    const annotation = buildAgentInputRevisionRunAnnotation({
      task: revision.task,
      run,
      revisionKind: "ONTOLOGY_SEARCH_ISSUE",
      revisionId: revision.revisionId,
      exactInput: revision.taskPayload,
    });
    const execution = Object.freeze({
      ...work.execution,
      campaigns: Object.freeze([work.paused, work.active]),
      runs: Object.freeze([run]),
      runAnnotations: Object.freeze([annotation]),
    });
    const result = projection({ execution, revisions: work.revisions, proposals: [negative] });
    const outcome = result.campaigns[0]!.actionOutcomes.find((item) =>
      item.selectionActionRef === binding.selectionActionRef
    )!;

    expect(outcome).toMatchObject({
      stage: "RELATION_NEGATIVE_MEMORY",
      usefulNegativeMemory: true,
      ontologyCounterexampleIds: [negative.proposalId],
    });
    expect(result.strata.find((item) =>
      item.selectionActionKind === binding.selectionActionKind
    )).toMatchObject({
      actedActionCount: 1,
      terminalActionCount: 1,
      usefulNegativeMemoryActionCount: 1,
      yieldCostEstimateQualified: false,
    });
  });
});
