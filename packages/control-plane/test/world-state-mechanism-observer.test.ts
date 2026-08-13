import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildWorldStateMechanismProposal,
  buildWorldStateMechanismSubjectBindingReview,
  compileConsolidatedWorldStateMechanismRoutes,
  materializeOntologySearchIssueRevisions,
  materializeRelationDiscoveryTaskRevisions,
  observeWorldStateMechanismRoutes,
  type DiscoveryCatalogListing,
  type MarketCorpusSnapshot,
  type WorldStateMechanismEvidenceBinding,
} from "../src/index.js";

const AUGUST = "2026-08-01T00:00:00.000Z";
const OCTOBER = "2026-10-01T00:00:00.000Z";

function hash(label: string): Hash {
  return hashCanonical({ label });
}

function listing(
  listingRef: string,
  title: string,
  sourceReceivedAt = AUGUST,
): DiscoveryCatalogListing {
  const [venueId, venueInstrumentId] = listingRef.split(":") as [string, string];
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId,
    title,
    description: title,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-12-31T00:00:00.000Z",
    rulesText: "Resolves from the named official source.",
    outcomes: Object.freeze([
      Object.freeze({
        venueOutcomeId: "yes", label: "Yes",
        indicativePrice: "400000000000000000",
      }),
      Object.freeze({
        venueOutcomeId: "no", label: "No",
        indicativePrice: "600000000000000000",
      }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt,
    sourceRawHash: hash(`raw:${listingRef}:${title}`),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function corpus(
  listings: readonly DiscoveryCatalogListing[],
  receivedAt: string,
): MarketCorpusSnapshot {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hash(`source:${receivedAt}`),
    eligibleSourceCount: new Set(listings.map((item) => item.venueId)).size,
    excludedSourceCount: 0,
    listings,
  });
}

function mechanismFixture() {
  const triggerRef = "venue-a:trump-shot-august";
  const dependentRef = "venue-b:trump-cola-september";
  const baselineCorpus = corpus([
    listing(triggerRef, "Will Donald Trump be shot during August?"),
    listing(
      dependentRef,
      "Will Donald Trump personally livestream drinking cola during September?",
    ),
  ], AUGUST);
  const baselineOntology = buildMarketOntologySnapshot(baselineCorpus);
  const revisions = materializeOntologySearchIssueRevisions({
    ontology: baselineOntology,
    corpus: baselineCorpus,
    proposals: [],
  });
  const revision = revisions.find((item) => {
    const refs = new Set(item.taskPayload.listingEvidence.map((entry) => entry.listingRef));
    return refs.has(triggerRef) && refs.has(dependentRef);
  })!;
  const evidenceByRef = new Map(revision.taskPayload.listingEvidence
    .map((item) => [item.listingRef, item]));
  const binding = (ref: string): WorldStateMechanismEvidenceBinding => {
    const evidence = evidenceByRef.get(ref)!;
    return Object.freeze({
      listingRef: ref,
      title: evidence.title,
      nodeId: evidence.node.nodeId,
      worldFacetId: evidence.node.worldFacet.facetId,
      sourceRawHash: evidence.sourceRawHash as Hash,
      protocolIdentity: evidence.protocolIdentity,
    });
  };
  const proposal = buildWorldStateMechanismProposal({
    ontologyIdentity: baselineOntology.ontologyIdentity,
    sourceSnapshotIdentity: baselineCorpus.snapshotIdentity,
    sourceIssueRevisionId: revision.revisionId,
    sourceAgentRunId: hash("run:mechanism-author"),
    sourceTrailheadIds: [revision.trailheadIds[0]!],
    sourceRelationPatternIds: [revision.relationPatternId],
    subjectLabel: "Donald Trump",
    subjectAliases: ["Donald Trump", "Trump"],
    subjectAmbiguityNotes: [
      "Trump alone must be reviewed before it expands to another title.",
    ],
    trigger: {
      predicateLabel: "is shot during August",
      searchSignals: ["shot"],
      influence: "MAY_DEGRADE_STATE",
      evidenceBindings: [binding(triggerRef)],
    },
    state: {
      dimension: "PHYSICAL_CAPABILITY",
      label: "able to appear personally in public",
    },
    dependent: {
      predicateLabel: "personally livestreams drinking cola during September",
      searchSignals: ["livestream", "drinking cola"],
      requirement: "REQUIRES_STATE_PRESENT",
      evidenceBindings: [binding(dependentRef)],
    },
    temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
    counterScenarios: [
      "A non-fatal shooting allows recovery before the later appearance.",
      "A prerecorded or proxy appearance may satisfy different venue wording.",
    ],
    rationale: "The later public act may depend on physical capability.",
    proposedAt: AUGUST,
  });
  const route = compileConsolidatedWorldStateMechanismRoutes([proposal])[0]!;
  const review = buildWorldStateMechanismSubjectBindingReview({
    route,
    decision: "APPROVED",
    approvedLabels: ["Donald Trump"],
    rejectedLabels: ["Trump"],
    rationale: "The complete name is exact; the surname alone remains ambiguous.",
    reviewerRef: "operator:fixture",
    reviewedAt: AUGUST,
  });
  const titles = (snapshot: MarketCorpusSnapshot) => new Map(snapshot.listings
    .map((item) => [item.listingRef, item.title]));
  return {
    triggerRef,
    dependentRef,
    baselineCorpus,
    baselineOntology,
    revisions,
    route,
    review,
    titles,
  };
}

describe("world-state mechanism observation", () => {
  it("wakes a physical-capability mechanism on a later public action without phrase overlap", () => {
    const fixture = mechanismFixture();
    const baseline = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: fixture.baselineOntology,
      listingTitles: fixture.titles(fixture.baselineCorpus),
      subjectBindingReviews: [fixture.review],
      priorObservations: [],
      issueRevisions: fixture.revisions,
      observedAt: AUGUST,
    });
    expect(baseline).toMatchObject({
      wakes: [],
      providerRequests: 0,
      modelInvocations: 0,
      campaigns: 0,
      runs: 0,
      dispatches: 0,
    });
    expect(baseline.observations[0]).toMatchObject({
      status: "OBSERVED",
      triggerMembers: [{ listingRef: fixture.triggerRef }],
      dependentMembers: [{ listingRef: fixture.dependentRef }],
    });

    const appearanceRef = "venue-c:trump-appearance-october";
    const laterCorpus = corpus([
      ...fixture.baselineCorpus.listings,
      listing(
        appearanceRef,
        "Will Donald Trump appear in person at an event during October?",
        OCTOBER,
      ),
    ], OCTOBER);
    const laterOntology = buildMarketOntologySnapshot(laterCorpus);
    const later = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: laterOntology,
      listingTitles: fixture.titles(laterCorpus),
      subjectBindingReviews: [fixture.review],
      priorObservations: baseline.observations,
      issueRevisions: fixture.revisions,
      observedAt: OCTOBER,
    });
    expect(later.wakes).toHaveLength(1);
    expect(later.wakes[0]).toMatchObject({
      newTriggerListingRefs: [],
      newDependentListingRefs: [appearanceRef],
      authority: "RELATION_RESEARCH_SUPPLY_ONLY",
      campaignActivationAuthority: false,
      automaticDispatch: false,
      providerRequests: 0,
      modelInvocations: 0,
      workItem: {
        kind: "STANDING_ROUTE_FOLLOWUP",
        disposition: "RUNNABLE_RESEARCH",
        candidateRelationKinds: [
          "IMPLIES", "MUTUALLY_EXCLUSIVE", "CONDITIONAL", "CONFLICTING",
        ],
        campaignEligible: true,
        automaticDispatch: false,
        semanticDecisionAuthority: false,
        probabilityAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      },
    });
    expect(later.wakes[0]!.workItem.searchSignals).not.toContain("public appearance");
    expect(later.wakes[0]!.workItem.seedListingBindings.map((item) => item.listingRef))
      .toContain(appearanceRef);

    const relationWork = Object.freeze({
      schemaVersion: "pmh.ontology-relation-work-projection.v1" as const,
      projectionIdentity: hash("projection:mechanism-wake"),
      sourceProposalCount: 1,
      workItemCount: 1,
      runnableResearchCount: 1,
      negativeMemoryCount: 0,
      blockedMissingLineageCount: 0,
      consolidatedSourceProposalCount: 1,
      proposalToWorkCoverageBps: 10_000,
      runnableProposalCoverageBps: 10_000,
      items: Object.freeze([later.wakes[0]!.workItem]),
      providerRequestsStarted: 0 as const,
      modelInvocationsStarted: 0 as const,
      automaticDispatch: false as const,
      authority: "RELATION_SEARCH_PROPOSAL_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const taskRevisions = materializeRelationDiscoveryTaskRevisions({
      relationWork,
      corpus: laterCorpus,
    });
    expect(taskRevisions).toHaveLength(1);
    expect(taskRevisions[0]).toMatchObject({
      workItemId: later.wakes[0]!.workItem.workItemId,
      campaignEligible: true,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
  });

  it("stays quiet without reviewed identity, on name-only matches, and on exact replay", () => {
    const fixture = mechanismFixture();
    const blocked = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: fixture.baselineOntology,
      listingTitles: fixture.titles(fixture.baselineCorpus),
      subjectBindingReviews: [],
      priorObservations: [],
      issueRevisions: fixture.revisions,
      observedAt: AUGUST,
    });
    expect(blocked.observations[0]).toMatchObject({
      status: "BLOCKED_SUBJECT_BINDING",
      triggerMembers: [],
      dependentMembers: [],
    });
    const approvedBaseline = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: fixture.baselineOntology,
      listingTitles: fixture.titles(fixture.baselineCorpus),
      subjectBindingReviews: [fixture.review],
      priorObservations: blocked.observations,
      issueRevisions: fixture.revisions,
      observedAt: AUGUST,
    });
    expect(approvedBaseline.observations[0]!.status).toBe("OBSERVED");
    expect(approvedBaseline.wakes).toEqual([]);

    const priceRef = "venue-c:trump-price-october";
    const unrelatedRef = "venue-d:trump-purple-socks-october";
    const nameOnlyCorpus = corpus([
      ...fixture.baselineCorpus.listings,
      listing(
        priceRef,
        "Will the Donald Trump media share price exceed $20 during October?",
        OCTOBER,
      ),
      listing(
        unrelatedRef,
        "Will Donald Trump wear purple socks during October?",
        OCTOBER,
      ),
    ], OCTOBER);
    const nameOnlyOntology = buildMarketOntologySnapshot(nameOnlyCorpus);
    const baseline = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: fixture.baselineOntology,
      listingTitles: fixture.titles(fixture.baselineCorpus),
      subjectBindingReviews: [fixture.review],
      priorObservations: [],
      issueRevisions: fixture.revisions,
      observedAt: AUGUST,
    });
    const nameOnly = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: nameOnlyOntology,
      listingTitles: fixture.titles(nameOnlyCorpus),
      subjectBindingReviews: [fixture.review],
      priorObservations: baseline.observations,
      issueRevisions: fixture.revisions,
      observedAt: OCTOBER,
    });
    expect(nameOnly.wakes).toEqual([]);
    expect(nameOnly.observations[0]!.dependentMembers.map((item) => item.listingRef))
      .not.toContain(priceRef);
    expect(nameOnly.observations[0]!.dependentMembers.map((item) => item.listingRef))
      .not.toContain(unrelatedRef);

    const replay = observeWorldStateMechanismRoutes({
      routes: [fixture.route],
      ontology: nameOnlyOntology,
      listingTitles: fixture.titles(nameOnlyCorpus),
      subjectBindingReviews: [fixture.review],
      priorObservations: nameOnly.observations,
      issueRevisions: fixture.revisions,
      observedAt: OCTOBER,
    });
    expect(replay.observations).toEqual(nameOnly.observations);
    expect(replay.wakes).toEqual([]);
  });
});
