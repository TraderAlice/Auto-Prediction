import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertReviewAttentionProjection,
  buildMarketCorpusSnapshot,
  buildProposalEconomicTriage,
  buildProposalEvidenceBundle,
  buildReviewAttentionProjection,
  createSemanticReviewDesk,
  type MarketArchaeologistProjection,
  type MarketRelationKind,
  type MarketRelationProposal,
  type ResearchSemanticDecision,
  type SemanticReviewRecommendation,
  type SemanticReviewRecord,
} from "../src/index.js";

const listings = [
  {
    listingRef: "polymarket-global:left", venueId: "polymarket-global", venueInstrumentId: "left",
    title: "Left event", description: "Left fixture", status: "OPEN", mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z", rulesText: "Resolves Yes if left happens.",
    outcomes: [
      { venueOutcomeId: "left-yes", label: "Yes", indicativePrice: "0.20" },
      { venueOutcomeId: "left-no", label: "No", indicativePrice: "0.80" },
    ],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION" as const, sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "left" }), protocolIdentity: hashCanonical({ protocol: "left" }),
  },
  {
    listingRef: "polymarket-global:right", venueId: "polymarket-global", venueInstrumentId: "right",
    title: "Right event", description: "Right fixture", status: "OPEN", mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z", rulesText: "Resolves Yes if right happens.",
    outcomes: [
      { venueOutcomeId: "right-yes", label: "Yes", indicativePrice: "0.30" },
      { venueOutcomeId: "right-no", label: "No", indicativePrice: "0.70" },
    ],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION" as const, sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "right" }), protocolIdentity: hashCanonical({ protocol: "right" }),
  },
];

const corpus = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ sources: "attention" }),
  eligibleSourceCount: 2,
  excludedSourceCount: 0,
  listings,
});

function proposal(
  relationKind: MarketRelationKind,
  name: string,
  sourceCorpus = corpus,
): MarketRelationProposal {
  const body = {
    relationKind,
    listingRefs: sourceCorpus.listings.map((listing) => listing.listingRef),
    statement: `${name} semantic relation`,
    rationale: "Fixture rationale.",
    falsifiers: ["Rules can diverge."],
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  };
  return Object.freeze({
    ...body,
    proposalId: hashCanonical({ corpusSnapshotIdentity: sourceCorpus.snapshotIdentity, ...body }),
  });
}

async function review(
  item: MarketRelationProposal,
  recommendation: SemanticReviewRecommendation,
  reviewCorpus = corpus,
): Promise<SemanticReviewRecord> {
  const desk = createSemanticReviewDesk(
    { DEEPSEEK_API_KEY: "test-only" },
    { reviewer: { review: async () => ({
      recommendation,
      relationConclusion: item.relationKind,
      assessments: {
        outcomeMapping: "Binary outcome mapping is explicit.",
        timingAndClose: "The deadlines align.",
        voidAndCancellation: "The fixture scopes cancellation.",
        resolutionSources: "The fixture sources align.",
      },
      counterexamples: recommendation === "REJECT" ? ["A direct contradiction exists."] : [],
      missingEvidence: recommendation === "ESCALATE" ? ["Need the complete rule text."] : [],
      rationale: "Advisory fixture conclusion.",
    }) } },
  );
  return desk.begin(`ai:${item.proposalId}`, item, reviewCorpus).promise;
}

function archaeologist(
  proposals: readonly MarketRelationProposal[],
  evidenceCorpus = corpus,
): MarketArchaeologistProjection {
  const bundles = proposals.map((item) => buildProposalEvidenceBundle(item, evidenceCorpus));
  const reportBody = {
    schemaVersion: "pmh.market-archaeologist-report.v1" as const,
    status: "PASS" as const,
    startedAt: "2026-08-02T00:00:00.000Z", completedAt: "2026-08-02T00:00:01.000Z",
    engine: { name: "PI_CLI" as const, provider: "deepseek" as const, model: "deepseek-v4-flash", mode: "MARKETFS_RECURSIVE_SEARCH" as const },
    task: { question: "fixture", corpusSnapshotIdentity: evidenceCorpus.snapshotIdentity, sourceSetIdentity: evidenceCorpus.sourceSetIdentity, corpusListingCount: evidenceCorpus.listingCount },
    result: { summary: "fixture", proposals, proposalEvidenceBundles: bundles, missingEvidence: [], authority: "PROPOSE_ONLY" as const, reviewStatus: "UNREVIEWED" as const, executionAuthority: false as const },
    trace: { workspace: "EPHEMERAL_MARKETFS" as const, permittedTools: ["read", "grep", "find", "ls"] as const, recursiveSearchAvailable: true as const, toolExecutionTraceAvailable: false as const, corpusRemovedAfterRun: true as const },
    effects: { sessionPersistence: false as const, shellAccess: false as const, agentFileWrites: false as const, valueMovingActions: false as const, liveExecutionEnabled: false as const },
  };
  const report = Object.freeze({ ...reportBody, artifactHash: hashCanonical(reportBody) });
  return Object.freeze({
    schemaVersion: "pmh.market-archaeologist-desk.v1", configured: true, model: "deepseek-v4-flash", status: "IDLE",
    activeCount: 0, concurrencyLimit: 1, runCount: 1, passCount: 1, failedCount: 0, retentionLimit: 10,
    storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "runId" },
    scheduler: { enabled: true, intervalMs: 60_000, changedCorpusOnly: true, lastAttemptedSnapshotIdentity: evidenceCorpus.snapshotIdentity },
    records: [{ runId: hashCanonical({ run: "attention", corpus: evidenceCorpus.snapshotIdentity }), corpusSnapshotIdentity: evidenceCorpus.snapshotIdentity, question: "fixture", status: "PASS", startedAt: report.startedAt, completedAt: report.completedAt, diagnostic: null, report, trigger: "SCHEDULE" }],
    authority: "PROPOSE_ONLY", effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
  });
}

describe("review attention queue", () => {
  it("ranks deterministic decision work and computes a bigint-only gross hint", async () => {
    const ready = proposal("EQUIVALENT", "ready");
    const research = proposal("RELATED", "research");
    const escalate = proposal("EQUIVALENT", "escalate");
    const reject = proposal("EQUIVALENT", "reject");
    const reviews = await Promise.all([
      review(ready, "ACCEPT_FOR_RESEARCH_SIMULATION"),
      review(research, "ACCEPT_FOR_RESEARCH_SIMULATION"),
      review(escalate, "ESCALATE"),
      review(reject, "REJECT"),
    ]);
    const projection = buildReviewAttentionProjection({
      archaeologist: archaeologist([ready, research, escalate, reject]),
      semanticReviews: reviews,
      semanticReviewJobs: [], semanticDecisions: [], corpus,
    });
    expect(projection.counts).toEqual({
      DECISION_READY: 1, RESEARCH_ONLY: 1, EVIDENCE_ESCALATION: 1, REJECT_RECOMMENDED: 1,
    });
    expect(projection.items.map((item) => item.operatorPosture)).toEqual([
      "DECISION_READY", "RESEARCH_ONLY", "EVIDENCE_ESCALATION", "REJECT_RECOMMENDED",
    ]);
    expect(projection.items[0]).toMatchObject({
      anonymousCoverage: { status: "EXACT_ADAPTER_COVERAGE", exactLegCount: 2 },
      indicativeEconomics: {
        status: "POSITIVE_GROSS_HINT", portfolioLabel: "Left true + right false",
        indicativeCostBpsCeil: "9000", grossEdgeBpsFloor: "1000",
        feesIncluded: false, depthIncluded: false, executable: false,
      },
      semanticDecisionAuthority: false, simulationAuthority: false, certificateAuthority: false, executionAuthority: false,
    });
    expect(projection.items[1]?.payoffReadiness.blocker).toBe("RELATION_UNSUPPORTED");
    const preReview = buildProposalEconomicTriage({
      candidates: [{
        proposal: ready,
        proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
        evidenceBundle: buildProposalEvidenceBundle(ready, corpus),
        issueIds: [],
        priority: 3,
      }],
      corpus,
    });
    expect(preReview.items[0]?.indicativeEconomics).toEqual(
      projection.items[0]?.indicativeEconomics,
    );
    expect(() => assertReviewAttentionProjection(projection)).not.toThrow();
  });

  it("withholds prices when current contract semantics changed", async () => {
    const ready = proposal("IMPLIES", "stale");
    const changed = buildMarketCorpusSnapshot({
      sourceSetIdentity: corpus.sourceSetIdentity, eligibleSourceCount: 2, excludedSourceCount: 0,
      listings: listings.map((listing, index) => index === 0 ? { ...listing, rulesText: "Changed resolution rule." } : listing),
    });
    const projection = buildReviewAttentionProjection({
      archaeologist: archaeologist([ready]), semanticReviews: [await review(ready, "ACCEPT_FOR_RESEARCH_SIMULATION")],
      semanticReviewJobs: [], semanticDecisions: [], corpus: changed,
    });
    expect(projection.items[0]).toMatchObject({
      currentContractMatchCount: 1,
      anonymousCoverage: { status: "EXACT_ADAPTER_COVERAGE" },
      indicativeEconomics: { status: "PRICE_UNAVAILABLE", source: null },
    });
  });

  it("recognizes a compiler-ready Polymarket US pair as exact anonymous adapter coverage", async () => {
    const usListings = listings.map((listing, index) => ({
      ...listing,
      listingRef: `polymarket-us:${index === 0 ? "left" : "right"}`,
      venueId: "polymarket-us",
      venueInstrumentId: index === 0 ? "left" : "right",
      outcomes: listing.outcomes.map((outcome) => ({
        ...outcome,
        venueOutcomeId: `us-${outcome.venueOutcomeId}`,
      })),
    }));
    const usCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "attention-us" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: usListings,
    });
    const ready = proposal("IMPLIES", "us-ready", usCorpus);
    const projection = buildReviewAttentionProjection({
      archaeologist: archaeologist([ready], usCorpus),
      semanticReviews: [await review(
        ready,
        "ACCEPT_FOR_RESEARCH_SIMULATION",
        usCorpus,
      )],
      semanticReviewJobs: [],
      semanticDecisions: [],
      corpus: usCorpus,
    });

    expect(projection).toMatchObject({
      exactAdapterCoverageCount: 1,
      counts: { DECISION_READY: 1 },
    });
    expect(projection.items[0]?.anonymousCoverage).toEqual({
      status: "EXACT_ADAPTER_COVERAGE",
      exactLegCount: 2,
      bookOnlyLegCount: 0,
      unsupportedLegCount: 0,
    });
  });

  it("keeps an accepted but explicitly non-settling relation out of simulation attention", async () => {
    const nonSettlingCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "attention-non-settling" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: listings.map((listing, index) => index === 0
        ? {
          ...listing,
          description: "This market is trading only and will never be resolved towards either option.",
        }
        : listing),
    });
    const item = proposal("EQUIVALENT", "non-settling", nonSettlingCorpus);
    const projection = buildReviewAttentionProjection({
      archaeologist: archaeologist([item], nonSettlingCorpus),
      semanticReviews: [await review(
        item,
        "ACCEPT_FOR_RESEARCH_SIMULATION",
        nonSettlingCorpus,
      )],
      semanticReviewJobs: [],
      semanticDecisions: [],
      corpus: nonSettlingCorpus,
    });
    expect(projection).toMatchObject({
      counts: { DECISION_READY: 0, RESEARCH_ONLY: 1 },
      positiveGrossHintCount: 0,
    });
    expect(projection.items[0]).toMatchObject({
      operatorPosture: "RESEARCH_ONLY",
      nextAction: "KEEP_FOR_RESEARCH",
      settlementPosture: {
        status: "EXPLICITLY_INELIGIBLE",
        checkedListingCount: 2,
        evidence: [{
          listingRef: "polymarket-global:left",
          signal: "NEVER_RESOLVES",
        }],
      },
      indicativeEconomics: {
        status: "SETTLEMENT_INELIGIBLE",
        grossEdgeBpsFloor: null,
      },
    });
  });

  it("removes explicitly decided reviews and rejects rehashed authority escalation", async () => {
    const ready = proposal("IMPLIES", "decided");
    const acceptedReview = await review(ready, "ACCEPT_FOR_RESEARCH_SIMULATION");
    const decisionBody = {
      schemaVersion: "pmh.research-semantic-decision.v1" as const,
      opportunityId: acceptedReview.opportunityId,
      semanticReviewArtifactHash: acceptedReview.report!.artifactHash,
      reviewRecommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
      decision: "ACCEPT_FOR_SIMULATION" as const,
      rationale: "Fixture operator decision.", decidedAt: "2026-08-02T01:00:00.000Z",
      authority: "LOCAL_OPERATOR_RESEARCH_ONLY" as const, productionReviewAuthority: false as const,
      productionPromotionEligible: false as const, executionAuthority: false as const,
      effects: { externalWrites: false as const, valueMovingActions: false as const, liveExecutionEnabled: false as const },
    };
    const decision: ResearchSemanticDecision = { ...decisionBody, decisionId: hashCanonical(decisionBody) };
    const projection = buildReviewAttentionProjection({
      archaeologist: archaeologist([ready]), semanticReviews: [acceptedReview], semanticReviewJobs: [],
      semanticDecisions: [decision], corpus,
    });
    expect(projection).toMatchObject({ sourceReviewCount: 1, decidedReviewCount: 1, itemCount: 0 });

    const tampered = { ...projection, semanticDecisionAuthority: true };
    const { contentHash: _old, ...body } = tampered;
    expect(() => assertReviewAttentionProjection({ ...tampered, contentHash: hashCanonical(body) })).toThrow(/contract/);
  });
});
