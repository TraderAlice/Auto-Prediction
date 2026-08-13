import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertPremiseEvidenceRoutingArtifact,
  buildMarketCorpusSnapshot,
  buildPremiseEvidenceRoutingArtifact,
  premiseEvidenceCorpusIdentity,
  PremiseEvidenceRoutingScheduler,
  SqliteOperationalStore,
  type MarketRelationProposal,
  type PremiseAnalysisOutcomeCapsule,
  type PremiseEvidenceRouterPort,
  type PremiseEvidenceRoutingArtifact,
} from "../src/index.js";

function listing(listingRef: string, title: string, yesPrice = "0.40") {
  return Object.freeze({
    listingRef,
    venueId: "venue",
    venueInstrumentId: listingRef.split(":")[1]!,
    title,
    description: `${title} binary contract.`,
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: `Official settlement rule for ${title}.`,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: `${listingRef}:yes`, label: "Yes", indicativePrice: yesPrice }),
      Object.freeze({ venueOutcomeId: `${listingRef}:no`, label: "No", indicativePrice: "0.60" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-10T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef, yesPrice }),
    protocolIdentity: hashCanonical({ venue: "routing-test" }),
  });
}

function corpus(yesPrice = "0.40", secondTitle = "Trump drinks cola in September") {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "routing-test" }),
    eligibleSourceCount: 1,
    excludedSourceCount: 0,
    listings: [
      listing("venue:shot", "Trump is shot in August", yesPrice),
      listing("venue:cola", secondTitle),
      listing("venue:fatal", "The August shooting is fatal"),
    ],
  });
}

const proposalBody = Object.freeze({
  relationKind: "CONDITIONAL" as const,
  listingRefs: Object.freeze(["venue:shot", "venue:cola"]),
  statement: "A fatal August shooting excludes a September personal livestream.",
  rationale: "The hidden fatality condition needs an explicit truth source.",
  falsifiers: Object.freeze(["A non-fatal shooting followed by a livestream."]),
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
});
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical(proposalBody),
});

function outcome(): PremiseAnalysisOutcomeCapsule {
  const obligations = Object.freeze([
    Object.freeze({
      premiseId: hashCanonical("fatality"),
      proposition: "The August shooting is fatal.",
      kind: "CAUSAL_HYPOTHESIS" as const,
      truthPosture: "UNRESOLVED" as const,
      bindingKind: "NONE" as const,
      evidenceClaimCount: 0,
      exactStateAuthority: "NONE" as const,
      counterexampleResult: "INCONCLUSIVE" as const,
    }),
    Object.freeze({
      premiseId: hashCanonical("joint-state"),
      proposition: "The fatality and later livestream cannot both be true.",
      kind: "CAUSAL_HYPOTHESIS" as const,
      truthPosture: "UNRESOLVED" as const,
      bindingKind: "NONE" as const,
      evidenceClaimCount: 0,
      exactStateAuthority: "NONE" as const,
      counterexampleResult: "NOT_FOUND" as const,
    }),
  ].sort((left, right) => left.premiseId.localeCompare(right.premiseId)));
  const body = Object.freeze({
    schemaVersion: "pmh.premise-analysis-outcome-capsule.v1" as const,
    analysisId: hashCanonical("analysis"),
    analysisArtifactHash: hashCanonical("analysis-artifact"),
    proposalId: proposal.proposalId,
    semanticReviewArtifactHash: hashCanonical("review"),
    completedAt: "2026-08-10T00:00:00.000Z",
    relationArtifactHash: hashCanonical("relation"),
    classification: "CAUSAL_RESEARCH_ONLY" as const,
    exactCompilerAdmission: "RESEARCH_ONLY" as const,
    blocker: "PREMISE_RESEARCH_ONLY" as const,
    premiseCount: obligations.length,
    unboundPremiseCount: obligations.length,
    obligations,
    authority: "ADVISORY_SUMMARY_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, outcomeHash: hashCanonical(body) });
}

const router = Object.freeze({
  identity: hashCanonical("router"),
  transport: "VERCEL_AI_SDK" as const,
  provider: "deepseek" as const,
  model: "deepseek-v4-flash",
  role: "PREMISE_EVIDENCE_ROUTER" as const,
});

function routeArtifact(snapshot = corpus()): PremiseEvidenceRoutingArtifact {
  const capsule = outcome();
  const [first, second] = capsule.obligations;
  return buildPremiseEvidenceRoutingArtifact({
    proposal,
    outcome: capsule,
    corpus: snapshot,
    router,
    groupDrafts: [
      {
        premiseIds: [first!.premiseId],
        disposition: "TRADED_STATE_CANDIDATE",
        evidenceQuestion: "Does the fatality contract expose the hidden state?",
        dependentPremiseIds: [],
        candidateListingRefs: ["venue:fatal"],
        targetListingRefs: [],
        officialSourceQueries: [],
        rationale: "A traded fatality outcome can represent the hidden Boolean state.",
      },
      {
        premiseIds: [second!.premiseId],
        disposition: "DERIVED_RESTATEMENT",
        evidenceQuestion: "Is this only the relation conclusion restated?",
        dependentPremiseIds: [first!.premiseId],
        candidateListingRefs: [],
        targetListingRefs: [],
        officialSourceQueries: [],
        rationale: "The joint-state sentence derives from the fatality dependency.",
      },
    ],
    trace: {
      searchEffectCount: 1,
      readEffectCount: 1,
      rejectedEffectCount: 0,
      searches: [{
        resultIdentity: hashCanonical("search"),
        patterns: ["fatal shooting"],
        hitListingRefs: ["venue:fatal"],
      }],
      readListingRefs: ["venue:fatal"],
      observedListingRefs: ["venue:fatal"],
      submittedEffectHash: hashCanonical("submit"),
    },
    completedAt: "2026-08-10T00:00:01.000Z",
  });
}

describe("premise evidence routing", () => {
  it("ignores price churn but revisions material semantic corpus changes", () => {
    expect(premiseEvidenceCorpusIdentity(corpus("0.40")))
      .toBe(premiseEvidenceCorpusIdentity(corpus("0.55")));
    expect(premiseEvidenceCorpusIdentity(corpus("0.40")))
      .not.toBe(premiseEvidenceCorpusIdentity(corpus("0.40", "Trump drinks tea in September")));
  });

  it("requires exact obligation coverage and observed market refs", () => {
    const artifact = routeArtifact();
    expect(artifact.groups).toHaveLength(2);
    expect(artifact.groups.map((group) => group.nextAction)).toEqual(
      expect.arrayContaining(["EXPAND_RELATION_SCOPE", "REANALYZE_PREMISES"]),
    );
    expect(() => assertPremiseEvidenceRoutingArtifact({
      ...artifact,
      executionAuthority: true,
    })).toThrow(/closed contract/u);
    expect(() => buildPremiseEvidenceRoutingArtifact({
      proposal,
      outcome: outcome(),
      corpus: corpus(),
      router,
      groupDrafts: [{
        premiseIds: outcome().obligations.map((item) => item.premiseId),
        disposition: "TRADED_STATE_CANDIDATE",
        evidenceQuestion: "Can an invented listing represent both premises?",
        dependentPremiseIds: [],
        candidateListingRefs: ["venue:invented"],
        targetListingRefs: [],
        officialSourceQueries: [],
        rationale: "It cannot because the reference was never observed.",
      }],
      trace: {
        searchEffectCount: 0,
        readEffectCount: 0,
        rejectedEffectCount: 0,
        searches: [],
        readListingRefs: [],
        observedListingRefs: ["venue:invented"],
        submittedEffectHash: hashCanonical("invalid"),
      },
      completedAt: "2026-08-10T00:00:01.000Z",
    })).toThrow(/candidate listing/u);
  });

  it("rekeys an unspent route when its semantic corpus changes", () => {
    const scheduler = new PremiseEvidenceRoutingScheduler({
      router: {
        configured: true,
        model: router.model,
        routerIdentity: router.identity,
        async route(): Promise<PremiseEvidenceRoutingArtifact> {
          return routeArtifact();
        },
      },
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-10T00:00:00.000Z"),
    });
    const first = Object.freeze({ proposal, outcome: outcome(), corpus: corpus() });
    const revised = Object.freeze({
      proposal,
      outcome: outcome(),
      corpus: corpus("0.40", "Trump drinks tea in September"),
    });
    scheduler.reconcile([first]);
    const firstJob = scheduler.projection().jobs[0]!;
    scheduler.reconcile([revised]);
    const projection = scheduler.projection();

    expect(projection).toMatchObject({
      pendingCount: 1,
      supersededCount: 1,
      budget: { providerAttemptsStarted: 0 },
    });
    expect(projection.jobs).toHaveLength(2);
    expect(projection.jobs.at(-1)?.jobId).not.toBe(firstJob.jobId);
    expect(projection.jobs.at(-1)?.corpusIdentity).toBe(
      premiseEvidenceCorpusIdentity(revised.corpus),
    );
  });

  it("leases, persists, and reuses a passing route across restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-premise-route-"));
    const path = join(directory, "operational.sqlite");
    let calls = 0;
    const port: PremiseEvidenceRouterPort = {
      configured: true,
      model: router.model,
      routerIdentity: router.identity,
      async route(): Promise<PremiseEvidenceRoutingArtifact> {
        calls += 1;
        return routeArtifact();
      },
    };
    const candidate = Object.freeze({ proposal, outcome: outcome(), corpus: corpus() });
    try {
      const store = new SqliteOperationalStore(path);
      const scheduler = new PremiseEvidenceRoutingScheduler({
        router: port,
        store,
        tickIntervalMs: 1_000,
      });
      scheduler.reconcile([candidate]);
      expect(scheduler.projection()).toMatchObject({
        pendingCount: 1,
        sourcePremiseCount: 0,
        storage: { durable: true, schemaVersion: 62 },
      });
      await Promise.all(scheduler.tick([candidate]));
      expect(scheduler.projection()).toMatchObject({
        passedCount: 1,
        sourcePremiseCount: 2,
        routeGroupCount: 2,
        tradedStateGroupCount: 1,
        derivedGroupCount: 1,
        exactPotentialGroupCount: 2,
        budget: { providerAttemptsStarted: 1 },
        authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY",
        certificateAuthority: false,
        executionAuthority: false,
      });
      const revisedCorpusCandidate = Object.freeze({
        proposal,
        outcome: outcome(),
        corpus: corpus("0.40", "Trump drinks tea in September"),
      });
      scheduler.reconcile([revisedCorpusCandidate]);
      expect(scheduler.tick([revisedCorpusCandidate])).toHaveLength(0);
      expect(scheduler.projection()).toMatchObject({
        passedCount: 1,
        pendingCount: 0,
        budget: { providerAttemptsStarted: 1 },
      });
      expect(calls).toBe(1);
      store.close();

      const reopened = new SqliteOperationalStore(path);
      const resumed = new PremiseEvidenceRoutingScheduler({
        router: port,
        store: reopened,
        tickIntervalMs: 1_000,
      });
      expect(resumed.tick([candidate])).toHaveLength(0);
      expect(resumed.projection().passedCount).toBe(1);
      expect(calls).toBe(1);
      reopened.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
