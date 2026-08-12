import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertMarketOntologyAgentProposal,
  assertOntologyRelationWorkItem,
  buildAgentRun,
  buildDefaultAgentRuntimePortfolio,
  buildExecutionProfile,
  compileRelationDiscoveryFindingForSemanticReview,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildOntologyRelationWorkProjection,
  materializeRelationDiscoveryTaskRevisions,
  RelationDiscoveryAgentToolHost,
  selectRelationDiscoveryCampaignTasks,
  SqliteOperationalStore,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  type DiscoveryCatalogListing,
  type MarketOntologyAgentProposal,
  type MarketOntologyListingBinding,
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

  it("materializes corpus-bound tasks and accepts only inspected policy-bound findings", async () => {
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
    expect(rotated[0]!.task.taskId).not.toBe(revisions[0]!.task.taskId);

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
      relationKind: revision.taskPayload.workItem.candidateRelationKinds[0]!,
      listingRefs: refs,
      statement: "The inspected listings may encode the same settlement proposition.",
      rationale: "Titles align, but independent rules review remains necessary.",
      falsifiers: ["The contracts use different resolution criteria."],
    };
    await expect(host.execute(context("record_relation_hypothesis", hypothesis)))
      .rejects.toThrow("inspected first");
    await host.execute(context("inspect_market_listings", { listingRefs: refs }));
    await expect(host.execute(context("record_relation_hypothesis", {
      ...hypothesis,
      relationKind: "EXHAUSTIVE",
    }))).rejects.toThrow("outside the assigned candidate policy");
    const first = await host.execute(context("record_relation_hypothesis", hypothesis));
    const replay = await host.execute(context("record_relation_hypothesis", hypothesis));
    expect(first).toEqual(replay);
    const counterexample = {
      rejectedRelationKind: revision.taskPayload.workItem.candidateRelationKinds[0]!,
      listingRefs: refs,
      statement: "The apparent relation may fail under the retained settlement wording.",
      rationale: "The evidence still needs independent rule review.",
      falsifiers: ["The exact rules prove the relation under every relevant state."],
    };
    await host.execute(context("record_relation_counterexample", counterexample));
    expect(host.findings()).toHaveLength(2);
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
        sourceOntologyIssueIds: revision.taskPayload.workItem.sourceIssueIds,
        semanticReviewIssueIds: revision.taskPayload.workItem.sourceIssueIds,
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
    expect(compileRelationDiscoveryFindingForSemanticReview({
      finding: positive,
      taskRevision: revision,
      corpus: work.corpus,
    })).toEqual(compilation);
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
    store.close();
    const reopened = new SqliteOperationalStore(path);
    expect(reopened.loadRelationDiscoveryCorpus(work.corpus.snapshotIdentity)).toEqual(work.corpus);
    expect(reopened.loadRelationDiscoveryTaskRevisions(10)).toEqual([revision]);
    expect(reopened.loadRelationDiscoveryFindings(10)).toEqual(
      expect.arrayContaining(retained),
    );
    expect(reopened.loadRelationDiscoveryFindings(10)).toHaveLength(2);
    reopened.close();
  });
});
