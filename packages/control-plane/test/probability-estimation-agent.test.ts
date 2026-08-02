import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import {
  assertProbabilityEstimationRunRecord,
  buildMarketCorpusSnapshot,
  buildProbabilisticSemanticBound,
  buildSemanticConstraintArtifact,
  createProbabilityEstimationDesk,
  deriveProbabilityAdverseStates,
  ProbabilityEstimationScheduler,
  type MarketRelationProposal,
  type SemanticReviewRecord,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const listings = [
  {
    listingRef: "venue-a:trump-shot-august",
    venueId: "venue-a",
    venueInstrumentId: "trump-shot-august",
    title: "Will Trump be shot in August?",
    description: "Resolves Yes for a qualifying gunshot injury.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "A non-fatal gunshot injury counts.",
    outcomes: [
      { venueOutcomeId: "shot-yes", label: "Yes", indicativePrice: "0.60" },
      { venueOutcomeId: "shot-no", label: "No", indicativePrice: "0.40" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "shooting-rules" }),
    protocolIdentity: hashCanonical({ protocol: "venue-a" }),
  },
  {
    listingRef: "venue-b:trump-cola-september",
    venueId: "venue-b",
    venueInstrumentId: "trump-cola-september",
    title: "Will Trump livestream drinking cola in September?",
    description: "Resolves Yes for an in-person public livestream.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: "Prerecorded footage and proxy appearances do not count.",
    outcomes: [
      { venueOutcomeId: "cola-yes", label: "Yes", indicativePrice: "0.50" },
      { venueOutcomeId: "cola-no", label: "No", indicativePrice: "0.50" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "cola-rules" }),
    protocolIdentity: hashCanonical({ protocol: "venue-b" }),
  },
];
const snapshot = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ sources: ["venue-a", "venue-b"] }),
  eligibleSourceCount: 2,
  excludedSourceCount: 0,
  listings,
});
const proposalBody = Object.freeze({
  relationKind: "MUTUALLY_EXCLUSIVE" as const,
  listingRefs: listings.map((listing) => listing.listingRef),
  statement: "The August injury suppresses the later live appearance.",
  rationale: "Estimate the surviving joint state instead of declaring it impossible.",
  falsifiers: ["A non-fatal injury followed by recovery permits both events."],
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
});
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({ corpusSnapshotIdentity: snapshot.snapshotIdentity, ...proposalBody }),
});
const constraint = buildSemanticConstraintArtifact({
  proposal,
  proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  evidenceCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  listingEvidence: listings.map((listing) => ({
    listingRef: listing.listingRef,
    listingHash: hashCanonical(listing),
    sourceRawHash: listing.sourceRawHash,
    protocolIdentity: listing.protocolIdentity,
  })),
  draft: {
    classification: "PROBABILISTIC_DEPENDENCE",
    relationKind: "MUTUALLY_EXCLUSIVE",
    assumptions: ["The September contract requires a personal live appearance."],
    counterexampleAttempt: {
      attempted: true,
      result: "FOUND",
      narrative: "Recovery after a non-fatal injury preserves the TT state.",
      truths: [true, true],
    },
    truthTable: [
      [false, false], [false, true], [true, false], [true, true],
    ].map((truths) => ({
      truths,
      disposition: "FEASIBLE" as const,
      rationale: truths[0] && truths[1] ? "Adverse but possible." : "Feasible.",
      evidenceListingRefs: proposal.listingRefs,
    })),
    unresolvedEvidence: ["Recovery time is not specified by either contract."],
  },
});
const reportBody = Object.freeze({
  schemaVersion: "pmh.semantic-review-report.v2" as const,
  status: "PASS" as const,
  startedAt: "2026-08-02T00:00:00.000Z",
  completedAt: "2026-08-02T00:00:01.000Z",
  engine: Object.freeze({
    transport: "VERCEL_AI_SDK" as const,
    provider: "deepseek" as const,
    model: "deepseek-v4-flash",
    role: "ADVERSARIAL_SEMANTIC_REVIEWER" as const,
    independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER" as const,
  }),
  input: Object.freeze({
    opportunityId: `ai:${proposal.proposalId}`,
    proposalId: proposal.proposalId,
    proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
    corpusSnapshotIdentity: snapshot.snapshotIdentity,
    evidencePosture: "ORIGINAL_CORPUS" as const,
    relationKind: proposal.relationKind,
    statement: proposal.statement,
    listingEvidence: Object.freeze(listings.map((listing) => Object.freeze({
      listingRef: listing.listingRef,
      listingHash: hashCanonical(listing),
      sourceRawHash: listing.sourceRawHash,
      protocolIdentity: listing.protocolIdentity,
      venueId: listing.venueId,
      venueInstrumentId: listing.venueInstrumentId,
      outcomes: listing.outcomes.map((outcome) => ({
        venueOutcomeId: outcome.venueOutcomeId,
        label: outcome.label,
      })),
      priceScale: listing.priceScale,
      quantityScale: listing.quantityScale,
      minPriceTick: listing.minPriceTick,
    }))),
  }),
  result: Object.freeze({
    recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
    relationConclusion: "MUTUALLY_EXCLUSIVE" as const,
    assessments: Object.freeze({
      outcomeMapping: "Canonical binary outcomes.",
      timingAndClose: "August precedes September.",
      voidAndCancellation: "No hard exclusion follows.",
      resolutionSources: "Each venue resolves independently.",
    }),
    counterexamples: Object.freeze(["Non-fatal recovery permits TT."]),
    missingEvidence: Object.freeze(["A calibrated recovery reference class."]),
    rationale: "Retain as probabilistic dependence.",
    semanticConstraint: constraint,
    authority: "ADVISORY_ONLY" as const,
    productionReviewAuthority: false as const,
    simulationAuthority: false as const,
    executionAuthority: false as const,
  }),
  trace: Object.freeze({
    protocol: "AI_SDK_TOOL_LOOP" as const,
    maximumSteps: 12 as const,
    counterexampleEffectCount: 1,
    submittedEffectHash: hashCanonical({ review: "shooting-cola" }),
    wholeResponseSchemaParsing: false as const,
  }),
  effects: Object.freeze({
    externalWrites: false as const,
    valueMovingActions: false as const,
    liveExecutionEnabled: false as const,
  }),
});
const report = Object.freeze({ ...reportBody, artifactHash: hashCanonical(reportBody) });
const reviewIdentity = Object.freeze({
  schemaVersion: "pmh.semantic-review-run.v1",
  opportunityId: `ai:${proposal.proposalId}`,
  proposalId: proposal.proposalId,
  proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  corpusSnapshotIdentity: snapshot.snapshotIdentity,
  model: "deepseek-v4-flash",
});
const review: SemanticReviewRecord = Object.freeze({
  reviewId: hashCanonical(reviewIdentity),
  opportunityId: reviewIdentity.opportunityId,
  proposalId: proposal.proposalId,
  proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  corpusSnapshotIdentity: snapshot.snapshotIdentity,
  model: "deepseek-v4-flash",
  status: "PASS",
  startedAt: report.startedAt,
  completedAt: report.completedAt,
  diagnostic: null,
  report,
});

function toolCompletion(name: string, payload: unknown, id: number): Response {
  return Response.json({
    id: `chatcmpl-probability-${id}`,
    object: "chat.completion",
    created: 1_785_523_200,
    model: "deepseek-v4-flash",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: `call-${id}`,
          type: "function",
          function: { name, arguments: JSON.stringify(payload) },
        }],
      },
      finish_reason: "tool_calls",
    }],
    usage: { prompt_tokens: 300, completion_tokens: 100, total_tokens: 400 },
  });
}

describe("Agent-first probability estimation", () => {
  it("uses counter-scenario and estimate tools instead of whole-response parsing", async () => {
    const allowedEvidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const bodies: Record<string, unknown>[] = [];
    const desk = createProbabilityEstimationDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_PROBABILITY_ESTIMATION_TIMEOUT_MS: "3000",
      },
      {
        now: () => Date.parse("2026-08-02T00:02:00.000Z"),
        async fetcher(_request, init) {
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return bodies.length === 1
            ? toolCompletion("record_counter_scenario", {
                stateId: "TT",
                narrative: "A non-fatal wound followed by recovery permits both events.",
                evidenceHashes: [allowedEvidenceHash],
              }, 1)
            : toolCompletion("submit_probability_estimate", {
                lowerPpm: "20000",
                upperPpm: "50000",
                evidenceHashes: [allowedEvidenceHash],
                assumptions: ["Recorded appearances do not count."],
                validForMs: 3_600_000,
                rationale: "Causal recovery path gives a small but non-zero joint-state interval.",
              }, 2);
        },
      },
    );
    const record = await desk.begin(review, snapshot, ["TT"], "CAUSAL").promise;

    expect(record).toMatchObject({
      status: "PASS",
      role: "CAUSAL",
      estimate: {
        estimator: "deepseek-v4-flash:CAUSAL",
        method: "CAUSAL_MODEL",
        lowerPpm: "20000",
        upperPpm: "50000",
        completedAt: "2026-08-02T00:02:00.000Z",
        expiresAt: "2026-08-02T01:02:00.000Z",
      },
      trace: {
        protocol: "AI_SDK_TOOL_LOOP",
        stepCount: 2,
        toolCallCount: 2,
        providerRequestAttemptCount: 2,
        counterScenarioEffectCount: 1,
        wholeResponseSchemaParsing: false,
      },
      authority: "ESTIMATE_ONLY",
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(record.allowedEvidenceHashes).toEqual(
      [...new Set(constraint.ruleEvidence.flatMap(
        (item) => [item.listingHash, item.sourceRawHash],
      ))].sort(),
    );
    expect(() => assertProbabilityEstimationRunRecord(record)).not.toThrow();
    expect(() => assertProbabilityEstimationRunRecord({
      ...record,
      counterScenarios: [{
        ...record.counterScenarios[0]!,
        evidenceHashes: [hashCanonical({ outside: true })],
      }],
      artifactHash: record.artifactHash,
    })).toThrow(/lineage or authority/u);
    expect(bodies).toHaveLength(2);
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(JSON.stringify(bodies[0])).toContain("record_counter_scenario");
    expect(JSON.stringify(bodies[0])).toContain("abstain_probability_estimate");
    expect(JSON.stringify(record)).not.toContain("test-only-key");
  });

  it("aggregates separate role runs conservatively and replays idempotently", async () => {
    let calls = 0;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:03:00.000Z"),
        estimator: {
          async estimate(input) {
            calls += 1;
            const upperPpm = input.role === "REFERENCE_CLASS" ? "40000" : "60000";
            const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
            return Object.freeze({
              status: "SUBMITTED" as const,
              lowerPpm: "10000",
              upperPpm,
              evidenceHashes: Object.freeze([evidenceHash]),
              assumptions: Object.freeze(["Bounded fixture assumption."]),
              validForMs: 3_600_000,
              rationale: `${input.role} estimate.`,
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "Recovery preserves the adverse state.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: 2,
                toolCallCount: 2,
                providerRequestAttemptCount: 2,
                counterScenarioEffectCount: 1,
                submittedEffectHash: hashCanonical({ role: input.role }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    const reference = await desk.begin(review, snapshot, ["TT"], "REFERENCE_CLASS").promise;
    const independent = await desk.begin(review, snapshot, ["TT"], "INDEPENDENT").promise;
    const replay = desk.begin(review, snapshot, ["TT"], "REFERENCE_CLASS");
    expect(replay.idempotentReplay).toBe(true);
    expect((await replay.promise).runId).toBe(reference.runId);
    expect(calls).toBe(2);

    const bound = buildProbabilisticSemanticBound({
      semanticConstraint: constraint,
      adverseStateIds: ["TT"],
      estimates: [reference.estimate!, independent.estimate!],
      counterScenarios: [
        ...reference.counterScenarios.map((item) => item.narrative),
        ...independent.counterScenarios.map((item) => item.narrative),
      ],
    });
    expect(bound).toMatchObject({
      lowerPpm: "10000",
      epsilonPpm: "60000",
      estimates: [
        { method: "REFERENCE_CLASS" },
        { method: "INDEPENDENT_JUDGMENT" },
      ],
    });
    expect(desk.projection()).toMatchObject({
      configured: true,
      runCount: 2,
      passCount: 2,
      abstainedCount: 0,
      authority: "ESTIMATION_ORCHESTRATION_ONLY",
    });
  });

  it("makes abstention a successful bounded effect instead of fabricating a number", async () => {
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:04:00.000Z"),
        estimator: {
          async estimate() {
            return Object.freeze({
              status: "ABSTAINED" as const,
              lowerPpm: null,
              upperPpm: null,
              evidenceHashes: Object.freeze([]),
              assumptions: Object.freeze(["Missing recovery reference class."]),
              validForMs: null,
              rationale: "The supplied rules establish possibility but not a numeric frequency bound.",
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "A fast recovery remains possible.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: 2,
                toolCallCount: 2,
                providerRequestAttemptCount: 2,
                counterScenarioEffectCount: 1,
                submittedEffectHash: hashCanonical({ abstain: true }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    const record = await desk.begin(review, snapshot, ["TT"], "INDEPENDENT").promise;
    expect(record).toMatchObject({
      status: "ABSTAINED",
      estimate: null,
      diagnostic: "The supplied rules establish possibility but not a numeric frequency bound.",
      authority: "ESTIMATE_ONLY",
    });
    expect(() => assertProbabilityEstimationRunRecord(record)).not.toThrow();
  });

  it("persists terminal runs and converts interrupted work into retryable failure on restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-estimation-"));
    const path = join(directory, "operations.sqlite");
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          now: () => Date.parse("2026-08-02T00:05:00.000Z"),
          estimator: {
            async estimate() {
              return await new Promise<never>(() => undefined);
            },
          },
        },
      );
      firstDesk.begin(review, snapshot, ["TT"], "CAUSAL");
      expect(firstDesk.projection().records[0]).toMatchObject({ status: "RUNNING" });
      expect(firstStore.loadProbabilityEstimationRunRecords(10)[0]).toMatchObject({
        status: "RUNNING",
      });
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: secondStore,
          now: () => Date.parse("2026-08-02T00:06:00.000Z"),
          estimator: {
            async estimate(input) {
              return Object.freeze({
                status: "SUBMITTED" as const,
                lowerPpm: "10000",
                upperPpm: "70000",
                evidenceHashes: Object.freeze([evidenceHash]),
                assumptions: Object.freeze([]),
                validForMs: 3_600_000,
                rationale: "Restarted estimate.",
                counterScenarios: Object.freeze([{
                  stateId: "TT",
                  narrative: "Non-fatal recovery remains the adverse route.",
                  evidenceHashes: Object.freeze([evidenceHash]),
                }]),
                trace: Object.freeze({
                  protocol: "AI_SDK_TOOL_LOOP" as const,
                  maximumSteps: 10 as const,
                  stepCount: 2,
                  toolCallCount: 2,
                  providerRequestAttemptCount: 2,
                  counterScenarioEffectCount: 1,
                  submittedEffectHash: hashCanonical({ restarted: input.role }),
                  wholeResponseSchemaParsing: false as const,
                }),
              });
            },
          },
        },
      );
      expect(secondDesk.projection().records[0]).toMatchObject({
        status: "FAILED",
        diagnostic: "probability estimation was interrupted by process restart",
      });
      const retried = secondDesk.begin(review, snapshot, ["TT"], "CAUSAL");
      expect(retried.idempotentReplay).toBe(false);
      expect(await retried.promise).toMatchObject({ status: "PASS" });
      expect(secondStore.loadProbabilityEstimationRunRecords(10)[0]).toMatchObject({
        status: "PASS",
        estimate: { upperPpm: "70000" },
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("durable probability estimation scheduling", () => {
  it("derives relation-specific adverse states and assembles two independent roles", async () => {
    expect(deriveProbabilityAdverseStates(constraint)).toEqual({
      status: "SUPPORTED",
      adverseStateIds: ["TT"],
      diagnostic: null,
    });
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:10:00.000Z"),
        estimator: {
          async estimate(input) {
            const abstained = input.role === "CAUSAL";
            return Object.freeze({
              status: abstained ? "ABSTAINED" as const : "SUBMITTED" as const,
              lowerPpm: abstained ? null : "10000",
              upperPpm: abstained ? null : input.role === "REFERENCE_CLASS"
                ? "40000"
                : "60000",
              evidenceHashes: abstained ? Object.freeze([]) : Object.freeze([evidenceHash]),
              assumptions: Object.freeze(abstained
                ? ["Missing a calibrated recovery cohort."]
                : ["The public appearance requires Trump in person."]),
              validForMs: abstained ? null : 3_600_000,
              rationale: abstained
                ? "The causal role abstains without a recovery reference class."
                : `${input.role} bounded the surviving TT state.`,
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "A non-fatal wound followed by recovery permits both events.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: 2,
                toolCallCount: 2,
                providerRequestAttemptCount: 2,
                counterScenarioEffectCount: 1,
                submittedEffectHash: hashCanonical({ role: input.role }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    const scheduler = new ProbabilityEstimationScheduler({
      desk,
      tickIntervalMs: 1_000,
      maxRequestsPerTick: 3,
      concurrencyLimit: 3,
      now: () => Date.parse("2026-08-02T00:10:00.000Z"),
    });
    const runs = scheduler.tick([{ review }], snapshot);
    expect(runs).toHaveLength(3);
    await Promise.all(runs);

    const projection = scheduler.projection();
    expect(projection).toMatchObject({
      caseCount: 1,
      passedCount: 2,
      abstainedCount: 1,
      boundReadyCount: 1,
      freshBoundCount: 1,
      unreadNotificationCount: 1,
      authority: "ESTIMATION_ORCHESTRATION_ONLY",
      probabilityCertificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.bounds[0]).toMatchObject({
      adverseStateIds: ["TT"],
      epsilonPpm: "60000",
      authority: "ESTIMATE_ONLY",
      probabilityCertificateAuthority: false,
    });
    expect(projection.bounds[0]!.estimates.map((item) => item.method).sort()).toEqual([
      "INDEPENDENT_JUDGMENT",
      "REFERENCE_CLASS",
    ]);
    expect(projection.notifications[0]).toMatchObject({
      kind: "BOUND_READY",
      status: "UNREAD",
      boundArtifactHash: projection.bounds[0]!.artifactHash,
    });
    scheduler.acknowledge(projection.notifications[0]!.notificationId);
    expect(scheduler.projection().unreadNotificationCount).toBe(0);
  });

  it("rebuilds deterministic bounds from SQLite jobs and estimator runs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-scheduler-"));
    const path = join(directory, "operations.sqlite");
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const makeEstimator = () => ({
      async estimate(input: { role: "REFERENCE_CLASS" | "CAUSAL" | "INDEPENDENT" }) {
        return Object.freeze({
          status: "SUBMITTED" as const,
          lowerPpm: "10000",
          upperPpm: input.role === "REFERENCE_CLASS" ? "40000" : "50000",
          evidenceHashes: Object.freeze([evidenceHash]),
          assumptions: Object.freeze(["Bounded fixture assumption."]),
          validForMs: 3_600_000,
          rationale: `${input.role} estimate.`,
          counterScenarios: Object.freeze([{
            stateId: "TT",
            narrative: "Recovery preserves the adverse state.",
            evidenceHashes: Object.freeze([evidenceHash]),
          }]),
          trace: Object.freeze({
            protocol: "AI_SDK_TOOL_LOOP" as const,
            maximumSteps: 10 as const,
            stepCount: 2,
            toolCallCount: 2,
            providerRequestAttemptCount: 2,
            counterScenarioEffectCount: 1,
            submittedEffectHash: hashCanonical({ role: input.role }),
            wholeResponseSchemaParsing: false as const,
          }),
        });
      },
    });
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          estimator: makeEstimator(),
          now: () => Date.parse("2026-08-02T00:11:00.000Z"),
        },
      );
      const firstScheduler = new ProbabilityEstimationScheduler({
        desk: firstDesk,
        store: firstStore,
        tickIntervalMs: 1_000,
        maxRequestsPerTick: 2,
        concurrencyLimit: 2,
        now: () => Date.parse("2026-08-02T00:11:00.000Z"),
      });
      await Promise.all(firstScheduler.tick([{ review }], snapshot));
      expect(firstScheduler.projection().boundReadyCount).toBe(1);
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        { store: secondStore, estimator: makeEstimator() },
      );
      const secondScheduler = new ProbabilityEstimationScheduler({
        desk: secondDesk,
        store: secondStore,
        tickIntervalMs: 1_000,
      });
      secondScheduler.reconcile([{ review }], snapshot);
      expect(secondScheduler.projection()).toMatchObject({
        boundReadyCount: 1,
        passedCount: 2,
        unreadNotificationCount: 1,
        storage: {
          jobs: { durable: true, schemaVersion: 25 },
          notifications: { durable: true, schemaVersion: 25 },
        },
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
