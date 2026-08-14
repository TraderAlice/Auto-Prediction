import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertPremiseRouteExpansionJobRecord,
  buildMarketCorpusSnapshot,
  buildPremiseEvidenceRoutingArtifact,
  buildPremiseRouteExpansionCandidate,
  derivePremiseRouteExpansionReviewLineage,
  PremiseRouteExpansionScheduler,
  parsePremiseRouteExpansionTickInterval,
  premiseEvidenceRoutingId,
  SqliteOperationalStore,
  type MarketRelationProposal,
  type PremiseAnalysisOutcomeCapsule,
  type PremiseEvidenceRoutingJobRecord,
  type PremiseRouteExpanderPort,
} from "../src/index.js";

function listing(ref: string, title: string, yes = "0.40") {
  return Object.freeze({
    listingRef: ref,
    venueId: "venue",
    venueInstrumentId: ref.split(":")[1]!,
    title,
    description: `${title} official description.`,
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: `Official settlement rule for ${title}.`,
    rulesTextPosture: "COMPLETE" as const,
    rulesTextSourceCharacterCount: `Official settlement rule for ${title}.`.length,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: `${ref}:yes`, label: "Yes", indicativePrice: yes }),
      Object.freeze({ venueOutcomeId: `${ref}:no`, label: "No", indicativePrice: "0.60" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-10T00:00:00.000Z",
    sourceRawHash: hashCanonical({ ref, yes }),
    protocolIdentity: "route-expansion-test-v1",
  });
}

function corpus(yes = "0.40") {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical("route-expansion-source"),
    eligibleSourceCount: 1,
    excludedSourceCount: 0,
    listings: [
      listing("venue:shot", "Trump is shot in August", yes),
      listing("venue:cola", "Trump drinks cola in September"),
      listing("venue:fatal", "The August shooting is fatal"),
    ],
  });
}

const proposalBody = Object.freeze({
  relationKind: "CONDITIONAL" as const,
  listingRefs: Object.freeze(["venue:shot", "venue:cola"]),
  statement: "A fatal August shooting excludes a September livestream.",
  rationale: "The fatality premise is not represented in the original pair.",
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
  const obligation = Object.freeze({
    premiseId: hashCanonical("fatality-premise"),
    proposition: "The August shooting is fatal.",
    kind: "CAUSAL_HYPOTHESIS" as const,
    truthPosture: "UNRESOLVED" as const,
    bindingKind: "NONE" as const,
    evidenceClaimCount: 0,
    exactStateAuthority: "NONE" as const,
    counterexampleResult: "INCONCLUSIVE" as const,
  });
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
    premiseCount: 1,
    unboundPremiseCount: 1,
    obligations: Object.freeze([obligation]),
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

function sourceJob(): PremiseEvidenceRoutingJobRecord {
  const snapshot = corpus();
  const capsule = outcome();
  const route = buildPremiseEvidenceRoutingArtifact({
    proposal,
    outcome: capsule,
    corpus: snapshot,
    router,
    groupDrafts: [{
      premiseIds: [capsule.obligations[0]!.premiseId],
      disposition: "TRADED_STATE_CANDIDATE",
      evidenceQuestion: "Can the fatality contract bind the hidden premise?",
      dependentPremiseIds: [],
      candidateListingRefs: ["venue:fatal"],
      targetListingRefs: [],
      officialSourceQueries: [],
      rationale: "The added market explicitly trades the fatality state.",
    }],
    trace: {
      searchEffectCount: 1,
      readEffectCount: 1,
      rejectedEffectCount: 0,
      searches: [{
        resultIdentity: hashCanonical("search"),
        patterns: ["fatal"],
        hitListingRefs: ["venue:fatal"],
      }],
      readListingRefs: ["venue:fatal"],
      observedListingRefs: ["venue:fatal"],
      submittedEffectHash: hashCanonical("submit"),
    },
    completedAt: "2026-08-10T00:00:01.000Z",
  });
  const body = Object.freeze({
    schemaVersion: "pmh.premise-evidence-routing-job.v1" as const,
    jobId: premiseEvidenceRoutingId({
      proposalId: proposal.proposalId,
      outcomeHash: capsule.outcomeHash,
      corpusIdentity: route.corpusIdentity,
      routerIdentity: router.identity,
    }),
    proposal,
    outcome: capsule,
    corpusIdentity: route.corpusIdentity,
    routerIdentity: router.identity,
    status: "PASS" as const,
    attemptCount: 1,
    maxAttempts: 2,
    nextAttemptAt: "2026-08-10T00:00:00.000Z",
    leasedAt: null,
    leaseExpiresAt: null,
    completedAt: route.completedAt,
    route,
    diagnostic: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: route.completedAt,
    authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY" as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    productionReviewAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function candidate() {
  const source = sourceJob();
  return buildPremiseRouteExpansionCandidate({
    sourceJob: source,
    availableCorpus: corpus(),
    routeGroupId: source.route!.groups[0]!.groupId,
  });
}

function expander(
  proposalIds: readonly `sha256:${string}`[] = [],
  calls: { value: number } = { value: 0 },
): PremiseRouteExpanderPort {
  return {
    configured: true,
    model: "deepseek-v4-flash",
    expanderIdentity: hashCanonical("expander"),
    async expand() {
      calls.value += 1;
      return Object.freeze({
        marketArchaeologistRunId: hashCanonical("run"),
        reportArtifactHash: hashCanonical("report"),
        generatedProposalIds: Object.freeze([...proposalIds]),
      });
    },
  };
}

describe("traded-state premise route expansion", () => {
  it("keeps automatic expansion opt-in after negative live selection evidence", () => {
    expect(parsePremiseRouteExpansionTickInterval({})).toBeNull();
    expect(parsePremiseRouteExpansionTickInterval({
      PMH_PREMISE_ROUTE_EXPANSION_TICK_MS: "30000",
    })).toBe(30_000);
  });

  it("retains the exact original-plus-candidate corpus and closed authority", () => {
    const built = candidate();
    expect(built.corpus.listings.map((item) => item.listingRef)).toEqual([
      "venue:cola", "venue:fatal", "venue:shot",
    ]);
    expect(built.question).toContain("Zero proposals is a valid result");
    const scheduler = new PremiseRouteExpansionScheduler({
      expander: expander(),
      tickIntervalMs: 1_000,
    });
    scheduler.reconcile([built]);
    const job = scheduler.projection().jobs[0]!;
    expect(() => assertPremiseRouteExpansionJobRecord({
      ...job,
      executionAuthority: true,
    })).toThrow(/bounded contract/u);
  });

  it("reformulates an existing source listing when the traded-state candidate overlaps", () => {
    const source = sourceJob();
    const route = buildPremiseEvidenceRoutingArtifact({
      proposal,
      outcome: source.outcome,
      corpus: corpus(),
      router,
      groupDrafts: [{
        premiseIds: [source.outcome.obligations[0]!.premiseId],
        disposition: "TRADED_STATE_CANDIDATE",
        evidenceQuestion: "Does the shooting contract itself bind the fatality premise?",
        dependentPremiseIds: [],
        candidateListingRefs: ["venue:shot"],
        targetListingRefs: [],
        officialSourceQueries: [],
        rationale: "The source listing may encode the hidden state in its settlement rule.",
      }],
      trace: {
        searchEffectCount: 1,
        readEffectCount: 1,
        rejectedEffectCount: 0,
        searches: [{
          resultIdentity: hashCanonical("overlap-search"),
          patterns: ["shot"],
          hitListingRefs: ["venue:shot"],
        }],
        readListingRefs: ["venue:shot"],
        observedListingRefs: ["venue:shot"],
        submittedEffectHash: hashCanonical("overlap-submit"),
      },
      completedAt: "2026-08-10T00:00:02.000Z",
    });
    const sourceBody = {
      ...source,
      route,
      completedAt: route.completedAt,
      updatedAt: route.completedAt,
    };
    const { artifactHash: _oldHash, ...unhashed } = sourceBody;
    const overlappingSource = Object.freeze({
      ...unhashed,
      artifactHash: hashCanonical(unhashed),
    });
    const built = buildPremiseRouteExpansionCandidate({
      sourceJob: overlappingSource,
      availableCorpus: corpus(),
      routeGroupId: route.groups[0]!.groupId,
    });

    expect(built.candidateListingRefs).toEqual(["venue:shot"]);
    expect(built.corpus.listings.map((item) => item.listingRef)).toEqual([
      "venue:cola", "venue:shot",
    ]);
    expect(built.question).toContain("may already belong to the source relation");
  });

  it("persists a zero-proposal PASS and never replays it after restart or price churn", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-route-expansion-"));
    const path = join(directory, "operational.sqlite");
    const calls = { value: 0 };
    try {
      const store = new SqliteOperationalStore(path);
      const scheduler = new PremiseRouteExpansionScheduler({
        expander: expander([], calls),
        tickIntervalMs: 1_000,
        store,
      });
      await Promise.all(scheduler.tick([candidate()]));
      expect(scheduler.projection()).toMatchObject({
        passedCount: 1,
        zeroProposalCount: 1,
        proposalYieldJobCount: 0,
        generatedProposalCount: 0,
        budget: { providerAttemptsStarted: 1 },
        storage: { durable: true, schemaVersion: 65 },
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      });
      store.close();

      const source = sourceJob();
      const repriced = buildPremiseRouteExpansionCandidate({
        sourceJob: source,
        availableCorpus: corpus("0.55"),
        routeGroupId: source.route!.groups[0]!.groupId,
      });
      const reopened = new SqliteOperationalStore(path);
      const resumed = new PremiseRouteExpansionScheduler({
        expander: expander([], calls),
        tickIntervalMs: 1_000,
        store: reopened,
      });
      expect(resumed.tick([repriced])).toHaveLength(0);
      expect(resumed.projection().passedCount).toBe(1);
      expect(calls.value).toBe(1);
      reopened.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains proposal yield only as downstream review lineage", async () => {
    const generated = hashCanonical("expanded-proposal");
    const scheduler = new PremiseRouteExpansionScheduler({
      expander: expander([generated]),
      tickIntervalMs: 1_000,
    });
    await Promise.all(scheduler.tick([candidate()]));
    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      proposalYieldJobCount: 1,
      generatedProposalCount: 1,
      authority: "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(scheduler.projection().jobs[0]?.generatedProposalIds).toEqual([generated]);
    const issueId = hashCanonical("source-search-issue");
    expect(derivePremiseRouteExpansionReviewLineage(
      scheduler.projection().jobs,
      [{ proposalId: proposal.proposalId, issueIds: [issueId], priority: 4 }],
    )).toEqual([{
      proposalId: generated,
      issueIds: [issueId],
      priority: 4,
    }]);
  });
});
