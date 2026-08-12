import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertMarketOntologyAgentProposal,
  buildAgentRun,
  buildAgentInputRevisionRunAnnotation,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildModelInvocation,
  buildOntologyAttentionAllocation,
  buildOntologyRelationWorkProjection,
  completeAgentRun,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  ontologyIssueResearchInputIdentity,
  type AgentExecutionSnapshot,
  type DiscoveryCatalogListing,
  type OntologySearchIssueRevision,
} from "../src/index.js";

const FIRST = "2026-08-12T09:00:00.000Z";
const SECOND = "2026-08-12T10:00:00.000Z";

function listing(
  listingRef: string,
  title: string,
  rulesText: string,
  sourceReceivedAt: string,
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
    rulesText,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "400000000000000000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "600000000000000000" }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt,
    sourceRawHash: hashCanonical({ listingRef, title, rulesText, sourceReceivedAt }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture(
  rulesText = "Resolves from source version one.",
  sourceReceivedAt = FIRST,
) {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-attention-test" }),
    eligibleSourceCount: 3,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?", rulesText, sourceReceivedAt),
      listing("venue-b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic nomination?", rulesText, sourceReceivedAt),
      listing("venue-a:fred-warner", "Defensive Player of the Year Winner? — Fred Warner", rulesText, sourceReceivedAt),
      listing("venue-a:mark-warner", "Virginia US Senate Winner — Mark Warner", rulesText, sourceReceivedAt),
      listing("venue-a:kurt-warner", "Broadcast Award Winner — Kurt Warner", rulesText, sourceReceivedAt),
      listing("venue-c:corbin-combo", "yes Arizona,yes Corbin Carroll: 1+,no Tampa Bay", rulesText, sourceReceivedAt),
      listing("venue-d:corbin-mvp", "National League MVP — Corbin Carroll", rulesText, sourceReceivedAt),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({
    corpus,
    ontology,
    proposals: [],
  });
  return { corpus, ontology, revisions };
}

function executionFor(
  revisions: readonly OntologySearchIssueRevision[],
): AgentExecutionSnapshot {
  const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(
    { PMH_DISCOVERY_PROVIDER: "codex" },
    () => Date.parse(FIRST),
  ));
  return Object.freeze({
    ...emptyAgentExecutionSnapshot(),
    ...portfolio,
    tasks: Object.freeze(revisions.map((item) => item.task)),
  });
}

function profile(execution: AgentExecutionSnapshot) {
  const route = execution.workloadRoutes.find((item) =>
    item.taskKind === "ONTOLOGY_NORMALIZATION"
  )!;
  return execution.executionProfiles.find((item) =>
    item.executionProfileId === route.executionProfileId
  )!;
}

describe("ontology research attention allocation", () => {
  it("keeps ambiguity as a bounded exploration stratum without semantic authority", () => {
    const work = fixture();
    const execution = executionFor(work.revisions);
    const first = buildOntologyAttentionAllocation({
      currentRevisions: work.revisions,
      retainedRevisions: work.revisions,
      proposals: [],
      execution,
    });
    const replay = buildOntologyAttentionAllocation({
      currentRevisions: work.revisions,
      retainedRevisions: work.revisions,
      proposals: [],
      execution,
    });

    expect(replay).toEqual(first);
    expect(first.issueCount).toBeGreaterThan(2);
    expect(first.scorecards.some((item) => item.ambiguityPosture === "EVIDENCE_RICH"))
      .toBe(true);
    expect(first.scorecards.some((item) => item.ambiguityPosture !== "EVIDENCE_RICH"))
      .toBe(true);
    expect(first.portfolio.filter((item) => item.kind === "PROBE_AMBIGUOUS_ISSUE"))
      .toHaveLength(1);
    expect(first.portfolio.filter((item) =>
      item.kind === "EXPLOIT_EVIDENCE_RICH_ISSUE"
    ).length).toBeLessThanOrEqual(2);
    expect(first).toMatchObject({
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      executionAuthority: false,
      valueMovingAuthority: false,
      policy: {
        structuralAmbiguitySemanticAuthority: false,
        automaticDispatch: false,
      },
    });
    expect(first.scorecards.every((item) =>
      item.structuralHeuristicSemanticAuthority === false &&
      item.modelConfidenceAuthority === false
    )).toBe(true);
  });

  it("distinguishes transport refresh from material exact-input novelty", () => {
    const initial = fixture();
    const transportOnly = fixture(
      "Resolves from source version one.",
      SECOND,
    );
    const materiallyChanged = fixture(
      "Resolves from source version two with a changed controlling rule.",
      SECOND,
    );
    const original = initial.revisions.find((revision) =>
      transportOnly.revisions.some((item) => item.issueId === revision.issueId)
    )!;
    const transported = transportOnly.revisions.find((item) =>
      item.issueId === original.issueId
    )!;
    const changed = materiallyChanged.revisions.find((item) =>
      item.issueId === original.issueId
    )!;
    expect(original.task.taskId).toBe(transported.task.taskId);
    expect(original.task.taskId).toBe(changed.task.taskId);
    expect(ontologyIssueResearchInputIdentity(transported))
      .toBe(ontologyIssueResearchInputIdentity(original));
    expect(ontologyIssueResearchInputIdentity(changed))
      .not.toBe(ontologyIssueResearchInputIdentity(original));

    const baseExecution = executionFor([original, changed]);
    const run = completeAgentRun(buildAgentRun({
      task: original.task,
      executionProfile: profile(baseExecution),
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:ontology-attention-test",
        authorizedAt: FIRST,
      },
      createdAt: FIRST,
    }), "SUCCEEDED", "2026-08-12T09:01:00.000Z", null);
    const annotation = buildAgentInputRevisionRunAnnotation({
      task: original.task,
      run,
      revisionKind: "ONTOLOGY_SEARCH_ISSUE",
      revisionId: original.revisionId,
      exactInput: original.taskPayload,
    });
    const model = baseExecution.modelProfiles.find((item) =>
      item.modelProfileId === profile(baseExecution).modelProfileId
    )!;
    const invocation = buildModelInvocation({
      run,
      modelProfile: model,
      ordinal: 1,
      status: "SUCCEEDED",
      startedAt: FIRST,
      completedAt: "2026-08-12T09:00:30.000Z",
      inputTokens: "1234",
      outputTokens: "56",
      reasoningTokens: "12",
    });
    const execution = Object.freeze({
      ...baseExecution,
      runs: Object.freeze([run]),
      runAnnotations: Object.freeze([annotation]),
      modelInvocations: Object.freeze([invocation]),
    });
    const unchanged = buildOntologyAttentionAllocation({
      currentRevisions: [transported],
      retainedRevisions: [original, transported],
      proposals: [],
      execution,
    }).scorecards[0]!;
    const successor = buildOntologyAttentionAllocation({
      currentRevisions: [changed],
      retainedRevisions: [original, changed],
      proposals: [],
      execution,
    }).scorecards[0]!;

    expect(unchanged).toMatchObject({
      inputBoundRunCount: 1,
      currentInputAttempted: true,
      nextActionKind: "HOLD_NO_NOVELTY",
      noveltyReason: "NO_MATERIAL_NOVELTY",
      usage: {
        knownInputTokens: "1234",
        knownOutputTokens: "56",
        knownReasoningTokens: "12",
      },
    });
    expect(successor).toMatchObject({
      inputBoundRunCount: 1,
      currentInputAttempted: false,
      nextActionKind: "RECHECK_CHANGED_INPUT",
      noveltyReason: "MATERIAL_INPUT_CHANGED",
      nextActionEligible: true,
      usage: {
        knownInputTokens: "1234",
        knownOutputTokens: "56",
        knownReasoningTokens: "12",
      },
    });
  });

  it("routes accepted positive output downstream and retains counterexamples as negative memory", () => {
    const work = fixture();
    const revision = work.revisions.find((item) =>
      item.taskPayload.trailheads.some((trailhead) =>
        trailhead.listingRefs.includes("venue-a:kelly-crime") &&
        trailhead.listingRefs.includes("venue-b:kelly-nominee")
      )
    )!;
    const baseExecution = executionFor(work.revisions);
    const run = completeAgentRun(buildAgentRun({
      task: revision.task,
      executionProfile: profile(baseExecution),
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:ontology-output-test",
        authorizedAt: FIRST,
      },
      createdAt: FIRST,
    }), "SUCCEEDED", "2026-08-12T09:01:00.000Z", null);
    const node = revision.taskPayload.listingEvidence[0]!.node;
    const envelope = Object.freeze({
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
      rationale: "Exact assigned evidence supports a bounded ontology effect.",
      proposedAt: "2026-08-12T09:00:30.000Z",
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const positiveBody = Object.freeze({
      schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
      kind: "WORLD_PROPOSITION" as const,
      ...envelope,
      label: "Mark Kelly wins the 2028 Democratic nomination",
      subjectLabels: Object.freeze(["Mark Kelly"]),
      predicate: "wins_democratic_nomination",
      timeScope: "2028",
      parameters: Object.freeze([]),
      ambiguityNotes: Object.freeze([]),
      falsifiers: Object.freeze(["The listing names a different person."]),
    });
    const positive = assertMarketOntologyAgentProposal(Object.freeze({
      ...positiveBody,
      proposalId: hashCanonical(positiveBody),
    }));
    const execution = Object.freeze({
      ...baseExecution,
      runs: Object.freeze([run]),
    });
    const relationWork = buildOntologyRelationWorkProjection({
      proposals: [positive],
      revisions: work.revisions,
      execution,
    });
    const positiveScorecard = buildOntologyAttentionAllocation({
      currentRevisions: work.revisions,
      retainedRevisions: work.revisions,
      proposals: [positive],
      execution,
      relationWork,
    }).scorecards.find((item) => item.issueId === revision.issueId)!;
    expect(positiveScorecard).toMatchObject({
      proposalCounts: { worldProposition: 1 },
      downstreamRelationWorkCount: 1,
      downstreamRunnableWorkCount: 1,
      nextActionKind: "ADVANCE_DOWNSTREAM",
      nextActionEligible: false,
      noveltyReason: "PROPOSAL_HAS_DOWNSTREAM_WORK",
    });

    const counterBody = Object.freeze({
      schemaVersion: "pmh.market-ontology-agent-proposal.v1" as const,
      kind: "COUNTEREXAMPLE" as const,
      ...envelope,
      rejectedClaim: "The two Mark Kelly contracts are equivalent.",
      reason: "They concern different predicates and time windows.",
      searchSignals: Object.freeze(["Mark Kelly"]),
    });
    const counterexample = assertMarketOntologyAgentProposal(Object.freeze({
      ...counterBody,
      proposalId: hashCanonical(counterBody),
    }));
    const negativeWork = buildOntologyRelationWorkProjection({
      proposals: [counterexample],
      revisions: work.revisions,
      execution,
    });
    const negativeScorecard = buildOntologyAttentionAllocation({
      currentRevisions: work.revisions,
      retainedRevisions: work.revisions,
      proposals: [counterexample],
      execution,
      relationWork: negativeWork,
    }).scorecards.find((item) => item.issueId === revision.issueId)!;
    expect(negativeScorecard).toMatchObject({
      proposalCounts: { counterexample: 1 },
      downstreamNegativeMemoryCount: 1,
      nextActionKind: "HOLD_NEGATIVE_MEMORY",
      nextActionEligible: false,
      noveltyReason: "COUNTEREXAMPLE_NEGATIVE_MEMORY",
    });
  });
});
