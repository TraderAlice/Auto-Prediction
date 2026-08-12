import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import {
  AiUsageLedger,
  assertPremiseAnalysisArtifact,
  assertPremiseAnalysisJobRecord,
  assertPremiseAnalysisOutcomeCapsule,
  assertResearchRelationPayoff,
  buildProposalEvidenceBundle,
  buildPremiseBearingRelationArtifact,
  buildMarketCorpusSnapshot,
  buildSemanticPremiseArtifact,
  createPremiseAnalysisDesk,
  createSemanticReviewDesk,
  compileResearchRelationPayoff,
  classifySemanticReviewAdmission,
  DeepSeekPremiseAnalysisModelPort,
  PremiseAnalysisDesk,
  PremiseAnalysisScheduler,
  SemanticReviewScheduler,
  parsePremiseAnalysisTickInterval,
  type MarketRelationProposal,
  type PremiseAnalysisModelPort,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";
import { deepSeekTextResponse, deepSeekToolResponse } from "./model-agent-fixtures.js";

const refs = ["venue:shot", "venue:cola", "venue:fatal"] as const;

function listing(listingRef: string, title: string) {
  return Object.freeze({
    listingRef,
    venueId: "venue",
    venueInstrumentId: listingRef.split(":")[1]!,
    title,
    description: `${title} binary contract.`,
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: `Official binary settlement rule for ${title}.`,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: `${listingRef}:yes`, label: "Yes", indicativePrice: "0.40" }),
      Object.freeze({ venueOutcomeId: `${listingRef}:no`, label: "No", indicativePrice: "0.60" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T08:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef, source: "premise-analysis" }),
    protocolIdentity: hashCanonical({ venue: "premise-analysis" }),
  });
}

const snapshot = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ sources: "premise-analysis" }),
  eligibleSourceCount: 1,
  excludedSourceCount: 0,
  listings: [
    listing(refs[0], "Trump is shot in August"),
    listing(refs[1], "Trump livestreams drinking cola in September"),
    listing(refs[2], "The August shooting is fatal"),
  ],
});

const proposalBody = Object.freeze({
  relationKind: "CONDITIONAL" as const,
  listingRefs: Object.freeze([...refs]),
  statement: "A fatal August shooting excludes a September personal livestream.",
  rationale: "The fatality condition must be represented as a traded truth, not assumed.",
  falsifiers: Object.freeze(["A non-fatal shooting followed by a September livestream."]),
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
});
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({
    corpusSnapshotIdentity: snapshot.snapshotIdentity,
    ...proposalBody,
  }),
});

function truthTable() {
  return Array.from({ length: 8 }, (_, value) => {
    const truths = [Boolean(value & 4), Boolean(value & 2), Boolean(value & 1)];
    const impossible = truths[2] && truths[1];
    return Object.freeze({
      truths,
      disposition: impossible ? "IMPOSSIBLE" as const : "FEASIBLE" as const,
      rationale: impossible
        ? "A fatal outcome and later personal livestream cannot both settle true."
        : "The fatality premise is false or the later livestream is false.",
      evidenceListingRefs: Object.freeze([...refs]),
    });
  });
}

async function reviewed() {
  let count = 0;
  const desk = createSemanticReviewDesk(
    { DEEPSEEK_API_KEY: "test-review-key", PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000" },
    {
      async fetcher() {
        count += 1;
        if (count === 1) {
          return deepSeekToolResponse("record_counterexample", {
            result: "NOT_FOUND",
            narrative: "No state permits fatality and a later personal livestream together.",
            truths: [true, true, true],
          }, count);
        }
        if (count === 2) {
          return deepSeekToolResponse("record_semantic_assessment", {
            outcomeMapping: "Each listing is an explicit binary truth.",
            timingAndClose: "The August condition precedes the September appearance.",
            voidAndCancellation: "The retained rules provide the scoped binary outcomes.",
            resolutionSources: "Each truth is retained as its own listing settlement.",
          }, count);
        }
        const states = truthTable();
        if (count <= 2 + states.length) {
          return deepSeekToolResponse(
            "record_truth_state",
            states[count - 3],
            count,
          );
        }
        return deepSeekToolResponse("submit_semantic_review", {
          classification: "HARD_SETTLEMENT_CONSTRAINT",
          rationale: "The third traded outcome makes the hidden fatality premise explicit.",
        }, count);
      },
    },
  );
  const record = await desk.begin(`ai:${proposal.proposalId}`, proposal, snapshot).promise;
  expect(record.status).toBe("PASS");
  expect(record.report?.result.semanticConstraint?.exactCompilerAdmission).toBe("ELIGIBLE");
  return record;
}

function analysisResult(review: Awaited<ReturnType<typeof reviewed>>) {
  const constraint = review.report!.result.semanticConstraint!;
  const premise = buildSemanticPremiseArtifact({
    proposalId: proposal.proposalId,
    evidenceScopeIdentity: review.corpusSnapshotIdentity,
    listings: review.report!.input.listingEvidence.map((item) => ({
      listingRef: item.listingRef,
      listingHash: item.listingHash,
    })),
    draft: {
      proposition: "The August shooting is fatal.",
      kind: "TRADED_OUTCOME",
      truthPosture: "TRADED_VARIABLE",
      binding: { kind: "LISTING_TRUTH", listingRef: refs[2], truthValue: true },
      evidenceClaimIds: [],
      rationale: "The third contract exposes fatality as an exact traded state variable.",
      counterexample: {
        attempted: true,
        result: "NOT_FOUND",
        narrative: "The premise has exactly the bound fatality listing truth.",
      },
    },
  });
  const relation = buildPremiseBearingRelationArtifact({
    constraint,
    premises: [premise],
    expression: {
      op: "IMPLIES",
      left: { op: "PREMISE", premiseId: premise.premiseId },
      right: { op: "NOT", operand: { op: "LISTING", listingRef: refs[1], equals: true } },
    },
  });
  return Object.freeze({
    premises: Object.freeze([premise]),
    relation,
    trace: Object.freeze({
      premiseEffectCount: 1,
      rejectedEffectCount: 0,
      submittedEffectHash: hashCanonical({
        schemaVersion: "pmh.premise-analysis-terminal-effect.v1",
        premiseIds: relation.premiseIds,
        relationId: relation.relationId,
      }),
    }),
  });
}

function attributedPremiseCandidate(review: Awaited<ReturnType<typeof reviewed>>) {
  return Object.freeze({
    proposal,
    review,
    semanticReviewJobId: hashCanonical({
      schemaVersion: "pmh.semantic-review-job-id.v1",
      proposalId: proposal.proposalId,
    }),
    issueIds: Object.freeze([hashCanonical({ issue: "premise-analysis" })]),
    admissionLane: "AUTO_PREMISE_REVIEW" as const,
  });
}

describe("Agent-native hidden premise analysis", () => {
  it("carries a three-market conditional proposal through review, premise audit, and exact payoff replay", async () => {
    expect(classifySemanticReviewAdmission(proposal)).toMatchObject({
      lane: "AUTO_PREMISE_REVIEW",
      reason: "PREMISE_AUDIT_REQUIRED",
    });
    let reviewCalls = 0;
    const reviewDesk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-review-key" },
      {
        reviewer: {
          async review() {
            reviewCalls += 1;
            return {
              recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
              relationConclusion: "CONDITIONAL" as const,
              assessments: {
                outcomeMapping: "Three explicit binary listing truths.",
                timingAndClose: "Fatality precedes the later appearance window.",
                voidAndCancellation: "Fixture rules retain the scoped outcomes.",
                resolutionSources: "Each truth is independently settlement-bound.",
              },
              counterexamples: [],
              missingEvidence: [],
              rationale: "The fatality listing turns the hidden condition into a traded variable.",
              constraintDraft: {
                relationKind: "CONDITIONAL" as const,
                classification: "HARD_SETTLEMENT_CONSTRAINT" as const,
                assumptions: [],
                truthTable: truthTable(),
                unresolvedEvidence: [],
                counterexampleAttempt: {
                  attempted: true as const,
                  result: "NOT_FOUND" as const,
                  narrative: "No fatal-and-later-livestream state survives.",
                  truths: [true, true, true],
                },
              },
              evidenceRequirementDrafts: [],
            };
          },
        },
      },
    );
    let now = Date.parse("2026-08-02T08:00:00.000Z");
    const reviewScheduler = new SemanticReviewScheduler({
      reviewDesk,
      tickIntervalMs: 1_000,
      now: () => now,
    });
    const evidenceBundle = buildProposalEvidenceBundle(proposal, snapshot);
    const temporalIssueId = hashCanonical({ issue: "three-market-conditional" });
    const reviewCandidate = Object.freeze({
      proposal,
      proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
      evidenceBundle,
      issueIds: Object.freeze([temporalIssueId]),
      priority: 5 as const,
    });
    await Promise.all(reviewScheduler.tick([reviewCandidate], snapshot));
    expect(reviewCalls).toBe(1);
    expect(reviewScheduler.projection()).toMatchObject({
      passedCount: 1,
      researchOnlyCount: 0,
      budget: { requestAttemptsStarted: 1 },
    });
    const review = reviewDesk.projection().records[0]!;
    expect(review.report?.result.semanticConstraint).toMatchObject({
      listingRefs: refs,
      exactCompilerAdmission: "ELIGIBLE",
    });
    expect(reviewScheduler.projection().jobs[0]?.reviewOutcome).toMatchObject({
      semanticConstraint: { exactCompilerAdmission: "ELIGIBLE" },
    });

    let premiseCalls = 0;
    const premiseDesk = new PremiseAnalysisDesk({
      async analyze() {
        premiseCalls += 1;
        return analysisResult(review);
      },
    }, "deepseek-v4-flash", 20, undefined, 2);
    const premiseScheduler = new PremiseAnalysisScheduler({
      desk: premiseDesk,
      tickIntervalMs: 1_000,
      now: () => now,
    });
    const reviewJob = reviewScheduler.projection().jobs[0]!;
    const premiseCandidates = [Object.freeze({
      proposal,
      review,
      semanticReviewJobId: reviewJob.jobId,
      issueIds: reviewJob.issueIds,
      admissionLane: "AUTO_PREMISE_REVIEW" as const,
    })] as const;
    await Promise.all(premiseScheduler.tick(premiseCandidates));
    expect(premiseCalls).toBe(1);
    expect(premiseScheduler.projection()).toMatchObject({
      passedCount: 1,
      exactEligibleCount: 1,
      unreadNotificationCount: 1,
      notifications: [{ kind: "EXACT_RELATION_READY", status: "UNREAD" }],
    });
    const premiseAnalysis = premiseDesk.projection().records[0]!.analysis!;
    const decisionBody = Object.freeze({
      schemaVersion: "pmh.research-semantic-decision.v1" as const,
      opportunityId: `ai:${proposal.proposalId}`,
      semanticReviewArtifactHash: review.report!.artifactHash,
      reviewRecommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
      decision: "ACCEPT_FOR_SIMULATION" as const,
      rationale: "Exercise the fully audited three-market path.",
      decidedAt: "2026-08-02T08:00:01.000Z",
      authority: "LOCAL_OPERATOR_RESEARCH_ONLY" as const,
      productionReviewAuthority: false as const,
      productionPromotionEligible: false as const,
      executionAuthority: false as const,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
    const payoff = compileResearchRelationPayoff({
      opportunityId: `ai:${proposal.proposalId}`,
      proposal,
      review,
      decision: Object.freeze({
        ...decisionBody,
        decisionId: hashCanonical(decisionBody),
      }),
      premiseAnalysis,
      sourceAttribution: Object.freeze({
        issueIds: reviewJob.issueIds,
        semanticFamilies: Object.freeze(["TEMPORAL_IMPOSSIBILITY"] as const),
      }),
    });
    expect(payoff).toMatchObject({
      schemaVersion: "pmh.research-relation-payoff.v4",
      status: "SIMULATION_TEMPLATE_READY",
      premiseBearingRelationArtifactHash: premiseAnalysis.relation.artifactHash,
      sourceAttribution: {
        issueIds: [temporalIssueId],
        semanticFamilies: ["TEMPORAL_IMPOSSIBILITY"],
      },
    });
    expect(premiseScheduler.projection().jobs[0]).toMatchObject({
      issueIds: [temporalIssueId],
      semanticReviewJobId: reviewJob.jobId,
    });
    const { artifactHash: _payoffHash, sourceAttribution: _source, ...withoutSource } = payoff;
    expect(() => assertResearchRelationPayoff({
      ...withoutSource,
      artifactHash: hashCanonical(withoutSource),
    })).toThrow(/source attribution/);
    expect(payoff.canonicalStates).toHaveLength(6);
    expect(payoff.portfolios).toHaveLength(1);
    now += 1_000;
  });

  it("uses repairable tool effects and emits a self-verifying traded-premise relation", async () => {
    const review = await reviewed();
    const bodies: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (bodies.length === 1) {
        return deepSeekToolResponse("submit_premise_relation", {
          tokens: [
            { op: "LISTING", listingRef: refs[2], equals: true },
            { op: "LISTING", listingRef: refs[1], equals: true },
            { op: "AND" },
          ],
        }, bodies.length);
      }
      if (bodies.length === 2) {
        return deepSeekToolResponse("record_hidden_premise", {
          premiseKey: "fatality",
          proposition: "The August shooting is fatal.",
          kind: "TRADED_OUTCOME",
          truthPosture: "TRADED_VARIABLE",
          binding: { kind: "LISTING_TRUTH", listingRef: refs[2], truthValue: true },
          evidenceClaimIds: [],
          rationale: "The premise is the exact truth of the offered fatality contract.",
          counterexample: {
            attempted: true,
            result: "NOT_FOUND",
            narrative: "The bound fatality listing cannot be true while this premise is false.",
          },
        }, bodies.length);
      }
      return deepSeekToolResponse("submit_premise_relation", {
        tokens: [
          { op: "PREMISE", premiseKey: "fatality" },
          { op: "LISTING", listingRef: refs[1], equals: true },
          { op: "NOT" },
          { op: "IMPLIES" },
        ],
      }, bodies.length);
    });
    const port = new DeepSeekPremiseAnalysisModelPort(
      "deepseek-v4-flash",
      "test-premise-key",
      1_800,
      3_000,
      fetcher,
    );
    const directory = await mkdtemp(join(tmpdir(), "pmh-premise-analysis-"));
    const databasePath = join(directory, "operational.sqlite");
    const store = new SqliteOperationalStore(databasePath);
    const desk = new PremiseAnalysisDesk(port, "deepseek-v4-flash", 20, store, 2);
    const first = desk.begin(proposal, review);
    const concurrent = desk.begin(proposal, review);
    expect(concurrent.idempotentReplay).toBe(true);
    expect(concurrent.promise).toBe(first.promise);
    const record = await first.promise;

    expect(bodies).toHaveLength(3);
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(JSON.stringify(bodies[1])).toContain("record a hidden premise first");
    expect(record).toMatchObject({
      status: "PASS",
      analysis: {
        schemaVersion: "pmh.premise-analysis.v1",
        trace: {
          maximumSteps: 16,
          premiseEffectCount: 1,
          rejectedEffectCount: 1,
          wholeResponseSchemaParsing: false,
          terminalEffectEndsLoop: true,
        },
        relation: {
          classification: "CONDITIONAL_TRADED",
          expressionMatchesStateSpace: true,
          exactCompilerAdmission: "ELIGIBLE",
          blocker: null,
          semanticDecisionAuthority: false,
          certificateAuthority: false,
          executionAuthority: false,
        },
      },
    });
    expect(record.analysis?.semanticConstraint.artifactHash)
      .toBe(review.report?.result.semanticConstraint?.artifactHash);
    expect(() => assertPremiseAnalysisArtifact(record.analysis)).not.toThrow();
    const { artifactHash: _oldHash, ...originalBody } = record.analysis!;
    const tamperedBody = Object.freeze({
      ...originalBody,
      semanticReviewArtifactHash: hashCanonical({ differentReview: true }),
    });
    expect(() => assertPremiseAnalysisArtifact({
      ...tamperedBody,
      artifactHash: hashCanonical(tamperedBody),
    })).toThrow(/lineage/);
    store.close();
    const restartedStore = new SqliteOperationalStore(databasePath);
    const restartedDesk = new PremiseAnalysisDesk(
      port,
      "deepseek-v4-flash",
      20,
      restartedStore,
      2,
    );
    expect(restartedDesk.projection().storage).toMatchObject({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "analysisId",
    });
    expect(restartedDesk.projection().records).toEqual([record]);
    const replay = restartedDesk.begin(proposal, review);
    expect(replay.idempotentReplay).toBe(true);
    expect((await replay.promise).analysisId).toBe(record.analysisId);
    expect(fetcher).toHaveBeenCalledTimes(3);
    restartedStore.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("retains provider usage when the analyst omits its terminal relation effect", async () => {
    const review = await reviewed();
    const usageLedger = new AiUsageLedger();
    const port = new DeepSeekPremiseAnalysisModelPort(
      "deepseek-v4-flash",
      "test-premise-key",
      1_800,
      3_000,
      async () => deepSeekTextResponse("The relation needs more thought.", 1),
      usageLedger,
    );

    await expect(port.analyze({ proposal, review })).rejects.toThrow(
      /without an accepted terminal relation effect/u,
    );
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      coverage: { complete: 1, unavailable: 0 },
      byPurpose: [{ key: "PREMISE_ANALYSIS", invocationCount: "1" }],
      byOutcome: [{ key: "FAILED", invocationCount: "1" }],
      totals: {
        durableEffectCount: "0",
        tokens: { inputTokens: "100", outputTokens: "20", totalTokens: "120" },
      },
    });
  });

  it("exposes bounded configuration defaults", async () => {
    const review = await reviewed();
    const model = {
      async analyze() {
        throw new Error("not needed for configuration assertions");
      },
    };
    const configured = createPremiseAnalysisDesk(
      { PMH_PREMISE_ANALYSIS_TIMEOUT_MS: "300000" },
      { analyst: model },
    );
    expect(configured.projection()).toMatchObject({
      configured: true,
      model: "deepseek-v4-flash",
      concurrencyLimit: 3,
      authority: "PROPOSE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
    });
    expect(createPremiseAnalysisDesk({}).projection()).toMatchObject({
      configured: false,
      status: "NEEDS_KEY",
      storage: { mode: "MEMORY", durable: false },
    });
    expect(() => createPremiseAnalysisDesk({ PMH_PREMISE_ANALYSIS_TIMEOUT_MS: "999" }))
      .toThrow(/PMH_PREMISE_ANALYSIS_TIMEOUT_MS/);

    // The review is used to prove the fixture itself remains a valid scoped input.
    expect(configured.idFor(proposal, review)).toMatch(/^sha256:/u);
  });

  it("retries bounded failures and restores terminal jobs across process restarts", async () => {
    const review = await reviewed();
    const result = analysisResult(review);
    let attempts = 0;
    const analyst: PremiseAnalysisModelPort = {
      async analyze() {
        attempts += 1;
        if (attempts === 1) throw new Error("transient provider failure");
        return result;
      },
    };
    let now = Date.parse("2026-08-02T08:00:00.000Z");
    const directory = await mkdtemp(join(tmpdir(), "pmh-premise-scheduler-"));
    const databasePath = join(directory, "operational.sqlite");
    const store = new SqliteOperationalStore(databasePath);
    const desk = new PremiseAnalysisDesk(analyst, "deepseek-v4-flash", 20, store, 2);
    const scheduler = new PremiseAnalysisScheduler({
      desk,
      store,
      tickIntervalMs: 1_000,
      retryDelayMs: 1_000,
      maxAttempts: 2,
      now: () => now,
    });
    const candidates = [attributedPremiseCandidate(review)] as const;

    scheduler.reconcile(candidates);
    expect(scheduler.projection()).toMatchObject({
      enabled: true,
      configured: true,
      pendingCount: 1,
      dueCount: 1,
      storage: { mode: "SQLITE_WAL", durable: true, schemaVersion: 47 },
    });
    await Promise.all(scheduler.tick(candidates));
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 1,
      passedCount: 0,
      budget: { providerAttemptsStarted: 1 },
    });
    now += 1_000;
    await Promise.all(scheduler.tick(candidates));
    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      exactEligibleCount: 1,
      unreadNotificationCount: 1,
      retryWaitCount: 0,
      budget: { providerAttemptsStarted: 2 },
      authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    const completedJob = scheduler.projection().jobs[0]!;
    expect(completedJob).toMatchObject({
      schemaVersion: "pmh.premise-analysis-job.v3",
      upgradedFromArtifactHash: null,
      outcomeCapsule: {
        schemaVersion: "pmh.premise-analysis-outcome-capsule.v1",
        premiseCount: 1,
        unboundPremiseCount: 0,
        exactCompilerAdmission: "ELIGIBLE",
        blocker: null,
        obligations: [{
          kind: "TRADED_OUTCOME",
          bindingKind: "LISTING_TRUTH",
          exactStateAuthority: "BOUND_LISTING_TRUTH",
        }],
        authority: "ADVISORY_SUMMARY_ONLY",
        semanticDecisionAuthority: false,
        simulationAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      },
    });
    expect(() => assertPremiseAnalysisOutcomeCapsule(completedJob.outcomeCapsule))
      .not.toThrow();
    expect(() => assertPremiseAnalysisJobRecord({
      ...completedJob,
      outcomeCapsule: {
        ...completedJob.outcomeCapsule!,
        unboundPremiseCount: 1,
      },
    })).toThrow(/capsule|authority/u);
    expect(scheduler.projection().notifications).toHaveLength(1);
    expect(scheduler.projection().notifications[0]).toMatchObject({
      kind: "EXACT_RELATION_READY",
      status: "UNREAD",
      proposalId: proposal.proposalId,
    });
    const notificationId = scheduler.projection().notifications[0]!.notificationId;
    expect(scheduler.acknowledge(notificationId)).toMatchObject({
      notificationId,
      status: "READ",
      readAt: "2026-08-02T08:00:01.000Z",
    });
    expect(scheduler.acknowledge(notificationId).status).toBe("READ");
    const completedAnalysis = desk.projection().records.find((record) =>
      record.status === "PASS"
    )?.analysis;
    if (completedAnalysis === undefined || completedAnalysis === null) {
      throw new Error("premise scheduler did not retain its completed analysis");
    }
    const decisionBody = Object.freeze({
      schemaVersion: "pmh.research-semantic-decision.v1" as const,
      opportunityId: `ai:${proposal.proposalId}`,
      semanticReviewArtifactHash: review.report!.artifactHash,
      reviewRecommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
      decision: "ACCEPT_FOR_SIMULATION" as const,
      rationale: "Compile the audited three-market state space for research simulation.",
      decidedAt: "2026-08-02T08:45:00.000Z",
      authority: "LOCAL_OPERATOR_RESEARCH_ONLY" as const,
      productionReviewAuthority: false as const,
      productionPromotionEligible: false as const,
      executionAuthority: false as const,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
    const qualification = compileResearchRelationPayoff({
      opportunityId: `ai:${proposal.proposalId}`,
      proposal,
      review,
      decision: Object.freeze({
        ...decisionBody,
        decisionId: hashCanonical(decisionBody),
      }),
      premiseAnalysis: completedAnalysis,
    });
    expect(qualification).toMatchObject({
      schemaVersion: "pmh.research-relation-payoff.v3",
      status: "SIMULATION_TEMPLATE_READY",
      semanticConstraintArtifactHash: review.report!.result.semanticConstraint!.artifactHash,
      premiseBearingRelationArtifactHash: completedAnalysis.relation.artifactHash,
    });
    expect(qualification.listingBindings).toHaveLength(3);
    expect(qualification.canonicalStates).toHaveLength(6);
    expect(qualification.portfolios).toHaveLength(1);
    expect(qualification.portfolios[0]!.legs.map((leg) => leg.listingRef).sort())
      .toEqual([refs[1], refs[2]].sort());
    const {
      artifactHash: _qualificationHash,
      premiseAnalysis: _premiseAnalysis,
      premiseBearingRelationArtifactHash: _premiseRelationHash,
      ...qualificationWithoutPremise
    } = qualification;
    expect(() => assertResearchRelationPayoff({
      ...qualificationWithoutPremise,
      artifactHash: hashCanonical(qualificationWithoutPremise),
    })).toThrow(/premise audit/);
    const { artifactHash: _stateHash, ...qualificationBody } = qualification;
    const tamperedStates = qualification.canonicalStates.map((state, index) =>
      index === 0
        ? { ...state, truthByListingRef: { ...state.truthByListingRef, [refs[0]]: true } }
        : state
    );
    const tamperedQualificationBody = { ...qualificationBody, canonicalStates: tamperedStates };
    expect(() => assertResearchRelationPayoff({
      ...tamperedQualificationBody,
      artifactHash: hashCanonical(tamperedQualificationBody),
    })).toThrow(/state|replay/);
    const {
      artifactHash: _completedJobHash,
      outcomeCapsule: _completedCapsule,
      upgradedFromArtifactHash: _completedUpgrade,
      ...completedJobBody
    } = completedJob;
    const legacyBody = Object.freeze({
      ...completedJobBody,
      schemaVersion: "pmh.premise-analysis-job.v2" as const,
    });
    const legacyJob = assertPremiseAnalysisJobRecord(Object.freeze({
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    }));
    store.savePremiseAnalysisJobRecord(legacyJob, 500);
    store.close();

    const restartedStore = new SqliteOperationalStore(databasePath);
    const restartedDesk = new PremiseAnalysisDesk(
      analyst,
      "deepseek-v4-flash",
      20,
      restartedStore,
      2,
    );
    const restarted = new PremiseAnalysisScheduler({
      desk: restartedDesk,
      store: restartedStore,
      tickIntervalMs: 1_000,
      now: () => now,
    });
    restarted.reconcile(candidates);
    expect(restarted.projection()).toMatchObject({
      passedCount: 1,
      exactEligibleCount: 1,
      unreadNotificationCount: 0,
      activeCount: 0,
      dueCount: 0,
      notificationStorage: { durable: true, schemaVersion: 47 },
    });
    expect(restarted.projection().notifications).toEqual(
      scheduler.projection().notifications,
    );
    expect(restarted.projection().jobs[0]).toMatchObject({
      schemaVersion: "pmh.premise-analysis-job.v3",
      upgradedFromArtifactHash: legacyJob.artifactHash,
      outcomeCapsule: {
        analysisArtifactHash: completedAnalysis.artifactHash,
        exactCompilerAdmission: "ELIGIBLE",
      },
    });
    expect(restarted.tick(candidates)).toEqual([]);
    expect(attempts).toBe(2);
    restartedStore.close();
    await rm(directory, { recursive: true, force: true });

    expect(parsePremiseAnalysisTickInterval({ PMH_PREMISE_ANALYSIS_TICK_MS: "1000" }))
      .toBe(1_000);
    expect(parsePremiseAnalysisTickInterval({ PMH_PREMISE_ANALYSIS_TICK_MS: "0" }))
      .toBeNull();
    expect(() => parsePremiseAnalysisTickInterval({ PMH_PREMISE_ANALYSIS_TICK_MS: "999" }))
      .toThrow(/PMH_PREMISE_ANALYSIS_TICK_MS/);
  });
});
