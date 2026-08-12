import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertMarketOntologyAgentProposal,
  assertOntologyRelationWorkItem,
  buildAgentRun,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildOntologyRelationWorkProjection,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  type DiscoveryCatalogListing,
  type MarketOntologyAgentProposal,
  type MarketOntologyListingBinding,
} from "../src/index.js";

const NOW = "2026-08-12T09:00:00.000Z";

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
  return { revisions, proposals, execution };
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
});
