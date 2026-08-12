import { hashCanonical, type Hash } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSemanticReviewJobRecord,
  assertSemanticReviewOutcomeCapsule,
  buildDiscoveryEvidenceLocator,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  createSemanticReviewDesk,
  SemanticReviewScheduler,
  type MarketRelationProposal,
  type SemanticReviewCandidate,
  type SemanticReviewJobRecord,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const listings = [
  {
    listingRef: "venue-a:event",
    venueId: "venue-a",
    venueInstrumentId: "event",
    title: "Will the event happen?",
    description: "Fixture A",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-08-10T00:00:00.000Z",
    rulesText: "Resolves Yes if the official source confirms the event.",
    outcomes: [
      { venueOutcomeId: "a-yes", label: "Yes", indicativePrice: "0.45" },
      { venueOutcomeId: "a-no", label: "No", indicativePrice: "0.55" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "a" }),
    protocolIdentity: hashCanonical({ protocol: "a" }),
  },
  {
    listingRef: "venue-b:event",
    venueId: "venue-b",
    venueInstrumentId: "event",
    title: "Event before the deadline?",
    description: "Fixture B",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-08-10T00:00:00.000Z",
    rulesText: "Resolves Yes when the named authority publishes confirmation.",
    outcomes: [
      { venueOutcomeId: "b-yes", label: "Yes", indicativePrice: "0.50" },
      { venueOutcomeId: "b-no", label: "No", indicativePrice: "0.50" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "b" }),
    protocolIdentity: hashCanonical({ protocol: "b" }),
  },
];

const snapshot = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ sources: 2 }),
  eligibleSourceCount: 2,
  excludedSourceCount: 0,
  listings,
});

function proposal(
  name: string,
  relationKind: MarketRelationProposal["relationKind"] = "EQUIVALENT",
  listingRefs: readonly string[] = ["venue-a:event", "venue-b:event"],
): MarketRelationProposal {
  const body = {
    relationKind,
    listingRefs: Object.freeze([...listingRefs]),
    statement: `The two fixture listings describe the same event (${name}).`,
    rationale: "Their authority and deadline appear aligned.",
    falsifiers: ["Different void rules would break equivalence."],
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  };
  return Object.freeze({
    ...body,
    proposalId: hashCanonical({ corpusSnapshotIdentity: snapshot.snapshotIdentity, ...body }),
  });
}

function candidate(
  item: MarketRelationProposal,
  priority: 1 | 2 | 3 | 4 | 5,
  issueIds: readonly Hash[] = [hashCanonical({ issue: priority })],
  evidenceBundle: SemanticReviewCandidate["evidenceBundle"] = null,
): SemanticReviewCandidate {
  return Object.freeze({
    proposal: item,
    proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
    evidenceBundle,
    issueIds,
    priority,
  });
}

function reviewResult(recommendation: "REJECT" | "ESCALATE" | "ACCEPT_FOR_RESEARCH_SIMULATION") {
  return {
    recommendation,
    relationConclusion: "EQUIVALENT" as const,
    assessments: {
      outcomeMapping: "Labels map directly.",
      timingAndClose: "Deadlines align in the fixture.",
      voidAndCancellation: "Independent void evidence is still required.",
      resolutionSources: "Named authority appears aligned.",
    },
    counterexamples: ["A venue-specific cancellation could diverge."],
    missingEvidence: ["Complete cancellation clauses."],
    rationale: "Fixture review completed within the advisory boundary.",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("persistent semantic review scheduler", () => {
  it("leases concurrent jobs by priority within an exact request-attempt budget", async () => {
    const calls: Array<ReturnType<typeof deferred<ReturnType<typeof reviewResult>>>> = [];
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      {
        concurrencyLimit: 2,
        reviewer: {
          review: async () => {
            const call = deferred<ReturnType<typeof reviewResult>>();
            calls.push(call);
            return call.promise;
          },
        },
      },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      concurrencyLimit: 2,
      maxRequestsPerTick: 2,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    const low = proposal("low");
    const high = proposal("high");
    const runs = scheduler.tick([candidate(low, 1), candidate(high, 5)], snapshot);
    await Promise.resolve();

    expect(runs).toHaveLength(2);
    expect(desk.projection()).toMatchObject({ activeCount: 2, concurrencyLimit: 2 });
    expect(scheduler.projection()).toMatchObject({
      activeCount: 2,
      leasedCount: 2,
      budget: { basis: "REQUEST_ATTEMPTS", requestAttemptsStarted: 2 },
    });
    expect(scheduler.projection().jobs[0]?.proposalId).toBe(high.proposalId);

    calls[0]!.resolve(reviewResult("ESCALATE"));
    calls[1]!.resolve(reviewResult("REJECT"));
    await Promise.all(runs);
    const completed = scheduler.projection();
    expect(completed).toMatchObject({
      activeCount: 0,
      passedCount: 2,
      unreadNotificationCount: 2,
      authority: "ADVISORY_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(completed.notifications.map((item) => item.kind).sort()).toEqual([
      "REVIEW_COMPLETE",
      "REVIEW_ESCALATED",
    ]);
    completed.jobs.forEach((job) => {
      expect(job).toMatchObject({
        schemaVersion: "pmh.semantic-review-job.v3",
        reviewOutcome: {
          schemaVersion: "pmh.semantic-review-outcome-capsule.v1",
          proposalId: job.proposalId,
          missingEvidenceCount: 1,
          counterexampleCount: 1,
          semanticConstraint: null,
          authority: "ADVISORY_SUMMARY_ONLY",
          semanticDecisionAuthority: false,
          simulationAuthority: false,
          certificateAuthority: false,
          executionAuthority: false,
        },
      });
      expect(() => assertSemanticReviewJobRecord(job)).not.toThrow();
    });
    const capsule = completed.jobs[0]!.reviewOutcome!;
    expect(() => assertSemanticReviewOutcomeCapsule({
      ...capsule,
      missingEvidenceCount: capsule.missingEvidenceCount + 1,
    })).toThrow(/outcome capsule/u);
  });

  it("retries on a bounded clock and emits one durable terminal notification", async () => {
    let now = Date.parse("2026-08-02T00:00:00.000Z");
    let calls = 0;
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      {
        reviewer: {
          review: async () => {
            calls += 1;
            throw new Error("provider unavailable");
          },
        },
      },
    );
    const item = candidate(proposal("retry"), 3);
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      maxAttempts: 2,
      retryDelayMs: 1_000,
      now: () => now,
    });

    await Promise.all(scheduler.tick([item], snapshot));
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 1,
      exhaustedCount: 0,
      classifiedFailureJobCount: 1,
      unclassifiedFailureJobCount: 0,
      failureClassCounts: [{
        failureClass: "PROVIDER_RETRYABLE",
        jobCount: 1,
      }],
      budget: { requestAttemptsStarted: 1 },
    });
    expect(scheduler.tick([item], snapshot)).toHaveLength(0);
    now += 1_000;
    await Promise.all(scheduler.tick([item], snapshot));
    expect(calls).toBe(2);
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 0,
      exhaustedCount: 1,
      classifiedFailureJobCount: 1,
      unreadNotificationCount: 1,
      budget: { requestAttemptsStarted: 2 },
    });
    expect(scheduler.projection().jobs[0]).toMatchObject({
      lastFailure: {
        failureClass: "PROVIDER_RETRYABLE",
        retryPolicy: "STANDARD_RETRY",
      },
    });
    const notification = scheduler.projection().notifications[0]!;
    expect(notification.kind).toBe("JOB_EXHAUSTED");
    scheduler.acknowledge(notification.notificationId);
    scheduler.reconcile([item], desk.projection().records);
    expect(scheduler.projection().notifications).toHaveLength(1);
    expect(scheduler.projection().unreadNotificationCount).toBe(0);
  });

  it("allows one repair retry for a stable model protocol failure", async () => {
    let now = Date.parse("2026-08-02T00:00:00.000Z");
    let calls = 0;
    const item = candidate(proposal("protocol-retry"), 4);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      {
        reviewer: {
          review: async () => {
            calls += 1;
            throw new Error(
              "semantic reviewer completed without submitting its tool effect",
            );
          },
        },
      },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      maxAttempts: 3,
      retryDelayMs: 1_000,
      now: () => now,
    });

    await Promise.all(scheduler.tick([item], snapshot));
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 1,
      exhaustedCount: 0,
      failureClassCounts: [{ failureClass: "MODEL_PROTOCOL", jobCount: 1 }],
      budget: { requestAttemptsStarted: 1 },
    });
    now += 1_000;
    await Promise.all(scheduler.tick([item], snapshot));
    expect(calls).toBe(2);
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 0,
      exhaustedCount: 1,
      budget: { maxAttemptsPerJob: 3, requestAttemptsStarted: 2 },
    });
    expect(scheduler.tick([item], snapshot)).toHaveLength(0);
  });

  it("does not spend a second model request on a first-party contract failure", async () => {
    let calls = 0;
    const item = candidate(proposal("first-party-contract"), 5);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      {
        reviewer: {
          review: async () => {
            calls += 1;
            return {
              ...reviewResult("ESCALATE"),
              constraintDraft: {
                classification: "HARD_SETTLEMENT_CONSTRAINT" as const,
                relationKind: "EQUIVALENT" as const,
                assumptions: [],
                counterexampleAttempt: {
                  attempted: false,
                  result: "INCONCLUSIVE" as const,
                  narrative: "No valid first-party counterexample effect was retained.",
                  truths: null,
                },
                truthTable: [],
                unresolvedEvidence: [],
              },
            };
          },
        },
      },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      maxAttempts: 3,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    await Promise.all(scheduler.tick([item], snapshot));
    expect(calls).toBe(1);
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 0,
      exhaustedCount: 1,
      failureClassCounts: [{
        failureClass: "FIRST_PARTY_CONTRACT",
        jobCount: 1,
      }],
      budget: { maxAttemptsPerJob: 3, requestAttemptsStarted: 1 },
    });
    expect(scheduler.tick([item], snapshot)).toHaveLength(0);
  });

  it("reconciles a passed review without spending another request", async () => {
    let calls = 0;
    const item = candidate(proposal("reconcile"), 4);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    scheduler.reconcile([item], []);
    await desk.begin(
      `ai:${item.proposal.proposalId}`,
      item.proposal,
      snapshot,
      item.proposalCorpusSnapshotIdentity,
    ).promise;
    scheduler.reconcile([], desk.projection().records);

    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      pendingCount: 0,
      budget: { requestAttemptsStarted: 0 },
    });
    expect(scheduler.tick([item], snapshot)).toHaveLength(0);
    expect(calls).toBe(1);
  });

  it("replaces a durable legacy PASS capsule when the current Agent protocol arrives", async () => {
    const item = candidate(proposal("protocol-upgrade"), 5);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => reviewResult("ESCALATE") } },
    );
    const current = await desk.begin(
      `ai:${item.proposal.proposalId}`,
      item.proposal,
      snapshot,
      item.proposalCorpusSnapshotIdentity,
    ).promise;
    const { protocolIdentity: _protocolIdentity, ...legacyBody } = current;
    const legacy = Object.freeze({
      ...legacyBody,
      reviewId: hashCanonical({
        schemaVersion: "pmh.semantic-review-run.v1",
        opportunityId: current.opportunityId,
        proposalId: current.proposalId,
        proposalCorpusSnapshotIdentity: current.proposalCorpusSnapshotIdentity,
        corpusSnapshotIdentity: current.corpusSnapshotIdentity,
        model: current.model,
      }),
    });
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    scheduler.reconcile([item], [legacy]);
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "PASS",
      lastReviewId: legacy.reviewId,
    });

    scheduler.reconcile([item], [legacy, current]);
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "PASS",
      lastReviewId: current.reviewId,
      reviewOutcome: { reviewId: current.reviewId },
    });
  });

  it("replays legacy PASS jobs and upgrades only from their exact retained review", async () => {
    const item = candidate(proposal("legacy-pass"), 4);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => reviewResult("ESCALATE") } },
    );
    const source = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    await Promise.all(source.tick([item], snapshot));
    const contemporary = source.projection().jobs[0]!;
    const {
      artifactHash: _artifactHash,
      reviewOutcome: _reviewOutcome,
      ...contemporaryBody
    } = contemporary;
    const legacyBody = {
      ...contemporaryBody,
      schemaVersion: "pmh.semantic-review-job.v1" as const,
    };
    let storedJob: SemanticReviewJobRecord = assertSemanticReviewJobRecord({
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    });
    const legacyStore = {
      semanticReviewJobStorage: Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "jobId" as const,
      }),
      semanticReviewNotificationStorage: Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "notificationId" as const,
      }),
      loadSemanticReviewJobRecords: () => [storedJob],
      saveSemanticReviewJobRecord: (record: SemanticReviewJobRecord) => {
        storedJob = record;
        return record;
      },
      loadSemanticReviewNotificationRecords: () => [],
      saveSemanticReviewNotificationRecord: (record: never) => record,
    };
    const restored = new SemanticReviewScheduler({
      reviewDesk: createSemanticReviewDesk({}),
      store: legacyStore,
    });

    restored.reconcile([item], []);
    expect(restored.projection().jobs[0]).toMatchObject({
      schemaVersion: "pmh.semantic-review-job.v1",
      status: "PASS",
    });
    expect(restored.projection().jobs[0]!.reviewOutcome).toBeUndefined();

    restored.reconcile([item], desk.projection().records);
    expect(restored.projection().jobs[0]).toMatchObject({
      schemaVersion: "pmh.semantic-review-job.v3",
      status: "PASS",
      lastReviewId: contemporary.lastReviewId,
      reviewOutcome: { reviewId: contemporary.lastReviewId },
    });
  });

  it("durably recovers one exact canonical legacy review for duplicate proposals", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-review-detail-recovery-"));
    const path = join(directory, "control-plane.sqlite");
    const firstProposal = proposal("recovery-canonical", "EQUIVALENT");
    const duplicateProposal = proposal(
      "recovery-duplicate",
      "EQUIVALENT",
      ["venue-b:event", "venue-a:event"],
    );
    const first = candidate(
      firstProposal,
      5,
      undefined,
      buildProposalEvidenceBundle(firstProposal, snapshot),
    );
    const duplicate = candidate(
      duplicateProposal,
      4,
      undefined,
      buildProposalEvidenceBundle(duplicateProposal, snapshot),
    );
    const sourceDesk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => reviewResult("ESCALATE") } },
    );
    const source = new SemanticReviewScheduler({
      reviewDesk: sourceDesk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    await Promise.all(source.tick([first, duplicate], snapshot));
    const contemporary = source.projection().jobs.find((job) => job.status === "PASS")!;
    const duplicateJob = source.projection().jobs.find(
      (job) => job.status === "DUPLICATE_SCOPE",
    )!;
    expect(() => source.requestOutcomeRecovery(firstProposal.proposalId))
      .toThrow(/already retains outcome detail/u);
    const {
      artifactHash: _artifactHash,
      reviewOutcome: _reviewOutcome,
      ...contemporaryBody
    } = contemporary;
    const legacyBody = {
      ...contemporaryBody,
      schemaVersion: "pmh.semantic-review-job.v1" as const,
    };
    const legacy = assertSemanticReviewJobRecord({
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    });

    try {
      const retainedReview = sourceDesk.projection().records.find((record) =>
        record.reviewId === contemporary.lastReviewId
      )!;
      const reviewLookupStore = new SqliteOperationalStore(
        join(directory, "review-lookup.sqlite"),
      );
      reviewLookupStore.saveSemanticReviewRecord(retainedReview, 100);
      expect(reviewLookupStore.loadSemanticReviewRecordsByIds([
        retainedReview.reviewId,
      ])).toEqual([retainedReview]);
      expect(reviewLookupStore.loadSemanticReviewRecordsByIds([
        hashCanonical({ review: "absent" }),
      ])).toEqual([]);
      reviewLookupStore.close();
      const firstStore = new SqliteOperationalStore(path);
      firstStore.saveSemanticReviewJobRecord(legacy);
      firstStore.saveSemanticReviewJobRecord(duplicateJob);
      expect(firstStore.loadSemanticReviewJobRecordsByProposalIds([
        firstProposal.proposalId,
      ])).toEqual([legacy]);
      expect(firstStore.loadSemanticReviewJobRecordsByProposalIds([
        hashCanonical({ proposal: "absent" }),
      ])).toEqual([]);
      expect(() => firstStore.loadSemanticReviewJobRecordsByProposalIds([
        firstProposal.proposalId,
        firstProposal.proposalId,
      ])).toThrow(/invalid or unbounded/u);
      const queuedScheduler = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store: firstStore }),
        tickIntervalMs: 1_000,
        store: firstStore,
        now: () => Date.parse("2026-08-02T00:01:00.000Z"),
      });
      const queued = queuedScheduler.requestOutcomeRecovery(duplicateProposal.proposalId);
      expect(queued).toMatchObject({
        requestedProposalId: duplicateProposal.proposalId,
        targetJobId: legacy.jobId,
        idempotentReplay: false,
        authority: "REVIEW_DETAIL_RECOVERY_ONLY",
        semanticDecisionAuthority: false,
        executionAuthority: false,
        job: {
          schemaVersion: "pmh.semantic-review-job.v4",
          status: "PENDING",
          lastReviewId: null,
          recommendation: null,
          detailRecovery: {
            requestedForProposalId: duplicateProposal.proposalId,
            targetJobId: legacy.jobId,
            priorJobArtifactHash: legacy.artifactHash,
            priorReviewId: legacy.lastReviewId,
            priorRecommendation: legacy.recommendation,
            effects: { schedulerRequestAdded: true, modelCallsAtEnqueue: false },
          },
        },
      });
      expect(
        queuedScheduler.requestOutcomeRecovery(firstProposal.proposalId),
      ).toMatchObject({ idempotentReplay: true, targetJobId: legacy.jobId });
      expect(() => assertSemanticReviewJobRecord({
        ...queued.job,
        detailRecovery: {
          ...queued.job.detailRecovery!,
          priorJobArtifactHash: hashCanonical({ tampered: true }),
        },
      })).toThrow(/bounded contract/u);
      firstStore.close();

      let calls = 0;
      const secondStore = new SqliteOperationalStore(path);
      const restored = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk(
          { DEEPSEEK_API_KEY: "test-only" },
          {
            store: secondStore,
            reviewer: {
              review: async () => {
                calls += 1;
                return reviewResult("ACCEPT_FOR_RESEARCH_SIMULATION");
              },
            },
          },
        ),
        tickIntervalMs: 1_000,
        store: secondStore,
        now: () => Date.parse("2026-08-02T00:02:00.000Z"),
      });
      expect(restored.projection()).toMatchObject({
        recoveryRequestedCount: 1,
        recoveryInFlightCount: 1,
        recoveryCompletedCount: 0,
        jobs: expect.arrayContaining([expect.objectContaining({
          jobId: legacy.jobId,
          schemaVersion: "pmh.semantic-review-job.v4",
          status: "PENDING",
        })]),
      });
      const currentWindowCandidate = Object.freeze({
        ...first,
        proposalCorpusSnapshotIdentity: hashCanonical({ currentWindow: true }),
        evidenceBundle: null,
      });
      await Promise.all(restored.tick([currentWindowCandidate], snapshot));
      expect(calls).toBe(1);
      const recoveredProjection = restored.projection();
      expect(recoveredProjection).toMatchObject({
        recoveryRequestedCount: 1,
        recoveryInFlightCount: 0,
        recoveryCompletedCount: 1,
      });
      expect(recoveredProjection.jobs.find((job) => job.jobId === legacy.jobId))
        .toMatchObject({
          jobId: legacy.jobId,
          schemaVersion: "pmh.semantic-review-job.v4",
          status: "PASS",
          detailRecovery: {
            priorJobArtifactHash: legacy.artifactHash,
          },
          reviewOutcome: {
            recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION",
          },
        });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reviews one canonical job for an unchanged symmetric semantic scope", async () => {
    let calls = 0;
    const firstProposal = proposal("scope-first", "EQUIVALENT");
    const reversedProposal = proposal(
      "scope-reversed",
      "EQUIVALENT",
      ["venue-b:event", "venue-a:event"],
    );
    const first = candidate(
      firstProposal,
      4,
      undefined,
      buildProposalEvidenceBundle(firstProposal, snapshot),
    );
    const reversed = candidate(
      reversedProposal,
      4,
      undefined,
      buildProposalEvidenceBundle(reversedProposal, snapshot),
    );
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    await Promise.all(scheduler.tick([first, reversed], snapshot));

    expect(calls).toBe(1);
    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      duplicateScopeCount: 1,
      scopedJobCount: 2,
      uniqueReviewScopeCount: 1,
      historicalRedundantPassCount: 0,
      budget: { requestAttemptsStarted: 1 },
    });
    const duplicate = scheduler.projection().jobs.find(
      (job) => job.status === "DUPLICATE_SCOPE",
    );
    const canonical = scheduler.projection().jobs.find((job) => job.status === "PASS");
    expect(duplicate).toMatchObject({
      reviewScopeIdentity: canonical?.reviewScopeIdentity,
      duplicateOfJobId: canonical?.jobId,
      completedAt: "2026-08-02T00:00:00.000Z",
      recommendation: null,
      lastReviewId: null,
    });
    expect(scheduler.tick([first, reversed], snapshot)).toHaveLength(0);
  });

  it("does not deduplicate reversed directional relations or unscoped evidence", async () => {
    let calls = 0;
    const forwardProposal = proposal("forward", "IMPLIES");
    const reverseProposal = proposal(
      "reverse",
      "IMPLIES",
      ["venue-b:event", "venue-a:event"],
    );
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    await Promise.all(scheduler.tick([
      candidate(
        forwardProposal,
        3,
        undefined,
        buildProposalEvidenceBundle(forwardProposal, snapshot),
      ),
      candidate(
        reverseProposal,
        3,
        undefined,
        buildProposalEvidenceBundle(reverseProposal, snapshot),
      ),
      candidate(proposal("unscoped-one"), 2),
      candidate(proposal("unscoped-two"), 2),
    ], snapshot));

    expect(calls).toBe(3);
    expect(scheduler.projection()).toMatchObject({
      passedCount: 3,
      duplicateScopeCount: 0,
      scopedJobCount: 2,
      uniqueReviewScopeCount: 2,
      budget: { requestAttemptsStarted: 3 },
    });
    expect(scheduler.projection().pendingCount).toBe(1);
  });

  it("allows an explicit manual review to override a duplicate disposition", async () => {
    let calls = 0;
    const firstProposal = proposal("manual-scope-first");
    const secondProposal = proposal("manual-scope-second");
    const candidates = [firstProposal, secondProposal].map((item) => candidate(
      item,
      4,
      undefined,
      buildProposalEvidenceBundle(item, snapshot),
    ));
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    await Promise.all(scheduler.tick(candidates, snapshot));
    const duplicate = scheduler.projection().jobs.find(
      (job) => job.status === "DUPLICATE_SCOPE",
    )!;

    await desk.begin(
      duplicate.opportunityId,
      candidates.find((item) => item.proposal.proposalId === duplicate.proposalId)!.proposal,
      snapshot,
      snapshot.snapshotIdentity,
    ).promise;
    scheduler.reconcile(candidates, desk.projection().records);

    expect(calls).toBe(2);
    expect(scheduler.projection()).toMatchObject({
      passedCount: 2,
      duplicateScopeCount: 0,
      historicalRedundantPassCount: 1,
      budget: { requestAttemptsStarted: 1 },
    });
  });

  it("keeps an in-flight canonical review when a matching scope arrives", async () => {
    const pendingReview = deferred<ReturnType<typeof reviewResult>>();
    let calls = 0;
    const firstProposal = proposal("leased-scope-first");
    const secondProposal = proposal("leased-scope-second");
    const first = candidate(
      firstProposal,
      4,
      undefined,
      buildProposalEvidenceBundle(firstProposal, snapshot),
    );
    const second = candidate(
      secondProposal,
      5,
      undefined,
      buildProposalEvidenceBundle(secondProposal, snapshot),
    );
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      {
        reviewer: {
          review: async () => {
            calls += 1;
            return pendingReview.promise;
          },
        },
      },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    const runs = scheduler.tick([first], snapshot);
    await Promise.resolve();
    scheduler.reconcile([first, second], desk.projection().records);

    expect(calls).toBe(1);
    expect(scheduler.projection()).toMatchObject({
      leasedCount: 1,
      duplicateScopeCount: 1,
      uniqueReviewScopeCount: 1,
      budget: { requestAttemptsStarted: 1 },
    });
    const leased = scheduler.projection().jobs.find((job) => job.status === "LEASED")!;
    const duplicate = scheduler.projection().jobs.find(
      (job) => job.status === "DUPLICATE_SCOPE",
    )!;
    expect(duplicate.duplicateOfJobId).toBe(leased.jobId);

    pendingReview.resolve(reviewResult("REJECT"));
    await Promise.all(runs);
    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      duplicateScopeCount: 1,
    });
  });

  it("automatically reviews premise-bearing relations before exact admission", async () => {
    let calls = 0;
    const researchProposal = proposal("research-only", "RELATED");
    const item = candidate(
      researchProposal,
      4,
      undefined,
      buildProposalEvidenceBundle(researchProposal, snapshot),
    );
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    await Promise.all(scheduler.tick([item], snapshot));
    expect(scheduler.tick([item], snapshot)).toHaveLength(0);
    expect(calls).toBe(1);
    expect(scheduler.projection()).toMatchObject({
      researchOnlyCount: 0,
      pendingCount: 0,
      dueCount: 0,
      passedCount: 1,
      budget: { requestAttemptsStarted: 1 },
    });
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "PASS",
      recommendation: "REJECT",
      lastReviewId: expect.stringMatching(/^sha256:/u),
      completedAt: expect.stringMatching(/^2026-/u),
      diagnostic: null,
    });
  });

  it("allows an explicitly requested manual review to complete a research-only job", async () => {
    let calls = 0;
    const researchProposal = proposal(
      "manual-research",
      "CONFLICTING",
      [
        "venue-a:event",
        "venue-b:event",
        "venue-c:event",
        "venue-d:event",
        "venue-e:event",
      ],
    );
    const manualSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "manual-research" }),
      eligibleSourceCount: 5,
      excludedSourceCount: 0,
      listings: [
        ...listings,
        {
          ...listings[1]!,
          listingRef: "venue-c:event",
          venueId: "venue-c",
          venueInstrumentId: "event",
          sourceRawHash: hashCanonical({ source: "c" }),
          protocolIdentity: hashCanonical({ protocol: "c" }),
        },
        {
          ...listings[1]!,
          listingRef: "venue-d:event",
          venueId: "venue-d",
          venueInstrumentId: "event",
          sourceRawHash: hashCanonical({ source: "d" }),
          protocolIdentity: hashCanonical({ protocol: "d" }),
        },
        {
          ...listings[1]!,
          listingRef: "venue-e:event",
          venueId: "venue-e",
          venueInstrumentId: "event",
          sourceRawHash: hashCanonical({ source: "e" }),
          protocolIdentity: hashCanonical({ protocol: "e" }),
        },
      ],
    });
    const item = candidate(researchProposal, 3);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    scheduler.reconcile([item], []);
    expect(scheduler.projection().researchOnlyCount).toBe(1);

    await desk.begin(
      `ai:${researchProposal.proposalId}`,
      researchProposal,
      manualSnapshot,
      snapshot.snapshotIdentity,
    ).promise;
    scheduler.reconcile([item], desk.projection().records);

    expect(calls).toBe(1);
    expect(scheduler.projection()).toMatchObject({
      researchOnlyCount: 0,
      passedCount: 1,
      budget: { requestAttemptsStarted: 0 },
    });
  });

  it("blocks stale proposal evidence without spending an attempt and resumes after rebase", async () => {
    let calls = 0;
    const item = candidate(proposal("evidence"), 4);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("REJECT"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    const incompleteSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: 1 }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: [listings[0]!],
    });

    await Promise.all(scheduler.tick([item], incompleteSnapshot));
    expect(scheduler.projection()).toMatchObject({
      blockedEvidenceCount: 1,
      exhaustedCount: 0,
      budget: { requestAttemptsStarted: 0 },
    });
    expect(calls).toBe(0);
    await Promise.all(scheduler.tick([item], snapshot));
    expect(scheduler.projection()).toMatchObject({
      blockedEvidenceCount: 0,
      passedCount: 1,
      budget: { requestAttemptsStarted: 1 },
    });
    expect(calls).toBe(1);
  });

  it("reviews captured proposal evidence after the live catalog rotates", async () => {
    const item = proposal("captured-evidence");
    const bundle = buildProposalEvidenceBundle(item, snapshot);
    const captured = candidate(item, 5, undefined, bundle);
    let receivedTitles: readonly string[] = [];
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      {
        reviewer: {
          review: async ({ listings }) => {
            receivedTitles = listings.map((listing) => listing.title);
            return reviewResult("ESCALATE");
          },
        },
      },
    );
    const rotatedSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "rotated" }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: [{
        ...listings[0]!,
        listingRef: "venue-c:replacement",
        venueId: "venue-c",
        venueInstrumentId: "replacement",
        title: "An unrelated replacement listing",
      }],
    });
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });

    await Promise.all(scheduler.tick([captured], rotatedSnapshot));
    expect(receivedTitles).toEqual(listings.map((listing) => listing.title));
    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      blockedEvidenceCount: 0,
      bundledJobCount: 1,
      capturedOriginalJobCount: 1,
      rebasedJobCount: 0,
      legacyEvidenceDebtCount: 0,
      budget: { requestAttemptsStarted: 1 },
    });
    expect(desk.projection().records[0]).toMatchObject({
      proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
      corpusSnapshotIdentity: snapshot.snapshotIdentity,
      report: { input: { evidencePosture: "ORIGINAL_CORPUS" } },
    });
    const durableJob = scheduler.projection().jobs[0]!;
    const durableBundle = durableJob.evidenceBundle!;
    if (durableBundle.schemaVersion !== "pmh.proposal-evidence-bundle.v2") {
      throw new Error("fixture expected a durable evidence bundle");
    }
    const {
      bundleId: _bundleId,
      proposal: _proposal,
      schemaVersion: _schemaVersion,
      ...legacyFields
    } = durableBundle;
    const legacyBundleBody = {
      schemaVersion: "pmh.proposal-evidence-bundle.v1" as const,
      ...legacyFields,
    };
    const { artifactHash: _artifactHash, ...jobBody } = durableJob;
    const legacyJobBody = {
      ...jobBody,
      evidenceBundle: {
        ...legacyBundleBody,
        bundleId: hashCanonical(legacyBundleBody),
      },
    };
    expect(() => assertSemanticReviewJobRecord({
      ...legacyJobBody,
      artifactHash: hashCanonical(legacyJobBody),
    })).not.toThrow();
  });

  it("reopens a passed proposal when an exact current rebase adds official evidence", async () => {
    const item = proposal("official-evidence-rebase", "MUTUALLY_EXCLUSIVE");
    const originalBundle = buildProposalEvidenceBundle(item, snapshot);
    let calls = 0;
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only" },
      { reviewer: { review: async () => { calls += 1; return reviewResult("ESCALATE"); } } },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    await Promise.all(scheduler.tick([
      candidate(item, 5, undefined, originalBundle),
    ], snapshot));
    expect(calls).toBe(1);

    const locator = buildDiscoveryEvidenceLocator({
      venueId: listings[1]!.venueId,
      protocolIdentity: listings[1]!.protocolIdentity,
      role: "CONTRACT_RULE_DOCUMENT",
      url: "https://rules.example.test/current.docx",
    });
    if (locator === null) throw new Error("fixture locator should be valid");
    const currentSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "official-evidence-rebase" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: [listings[0]!, { ...listings[1]!, evidenceLocators: [locator] }],
    });
    const rebasedBundle = buildProposalEvidenceBundle(
      item,
      currentSnapshot,
      snapshot.snapshotIdentity,
    );
    const rebasedCandidate = candidate(item, 5, undefined, rebasedBundle);
    scheduler.reconcile([rebasedCandidate], desk.projection().records);
    expect(scheduler.projection()).toMatchObject({
      pendingCount: 1,
      passedCount: 0,
      rebasedJobCount: 1,
    });

    await Promise.all(scheduler.tick([rebasedCandidate], currentSnapshot));
    expect(calls).toBe(2);
    expect(desk.projection().records.filter((record) => record.status === "PASS"))
      .toHaveLength(2);
    expect(scheduler.projection()).toMatchObject({
      pendingCount: 0,
      passedCount: 1,
      rebasedJobCount: 1,
    });
  });

  it("loads durable attribution beyond the bounded scheduler projection", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-review-attribution-"));
    const path = join(directory, "control-plane.sqlite");
    const items = Array.from({ length: 12 }, (_, index) => candidate(
      proposal(`attribution-${index}`),
      4,
      [hashCanonical({ issue: `attribution-${index}` })],
    ));
    try {
      const store = new SqliteOperationalStore(path);
      const scheduler = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store }),
        retentionLimit: 10,
        store,
      });
      scheduler.reconcile(items, []);

      // Retention bounds terminal history, never live work. Otherwise a full
      // high-priority history window can silently starve lower-priority jobs.
      expect(scheduler.projection().jobs).toHaveLength(12);
      expect(scheduler.attributionSource(20)).toMatchObject({
        basis: "DURABLE_STORE_RECORDS",
        maximumJobCount: 20,
        truncated: false,
      });
      expect(scheduler.attributionSource(20).jobs).toHaveLength(12);
      expect(scheduler.attributionSource(11)).toMatchObject({
        maximumJobCount: 11,
        truncated: true,
      });
      expect(scheduler.attributionSource(11).jobs).toHaveLength(11);
      store.close();

      const memoryScheduler = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}),
        retentionLimit: 10,
      });
      memoryScheduler.reconcile(items, []);
      expect(memoryScheduler.attributionSource(20)).toMatchObject({
        basis: "IN_MEMORY_RETAINED_WINDOW",
        truncated: false,
      });
      expect(memoryScheduler.attributionSource(20).jobs).toHaveLength(12);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recovers an expired SQLite lease and retains the result across restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-review-scheduler-"));
    const path = join(directory, "control-plane.sqlite");
    const restartProposal = proposal("restart");
    const item = candidate(
      restartProposal,
      5,
      undefined,
      buildProposalEvidenceBundle(restartProposal, snapshot),
    );
    const rotatedSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "restart-rotated" }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: [{
        ...listings[0]!,
        listingRef: "venue-c:after-restart",
        venueId: "venue-c",
        venueInstrumentId: "after-restart",
      }],
    });
    let now = Date.parse("2026-08-02T00:00:00.000Z");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const never = deferred<ReturnType<typeof reviewResult>>();
      const firstDesk = createSemanticReviewDesk(
        { DEEPSEEK_API_KEY: "test-only" },
        { reviewer: { review: async () => never.promise }, store: firstStore },
      );
      const firstScheduler = new SemanticReviewScheduler({
        reviewDesk: firstDesk,
        tickIntervalMs: 1_000,
        leaseTimeoutMs: 1_000,
        retryDelayMs: 1_000,
        store: firstStore,
        now: () => now,
      });
      expect(firstScheduler.tick([item], snapshot)).toHaveLength(1);
      expect(firstScheduler.projection()).toMatchObject({
        leasedCount: 1,
        storage: { jobs: { durable: true, schemaVersion: 41 } },
      });
      firstStore.close();

      now += 1_000;
      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createSemanticReviewDesk(
        { DEEPSEEK_API_KEY: "test-only" },
        { reviewer: { review: async () => reviewResult("REJECT") }, store: secondStore },
      );
      const secondScheduler = new SemanticReviewScheduler({
        reviewDesk: secondDesk,
        tickIntervalMs: 1_000,
        leaseTimeoutMs: 1_000,
        retryDelayMs: 1_000,
        store: secondStore,
        now: () => now,
      });
      expect(secondScheduler.tick([], rotatedSnapshot)).toHaveLength(0);
      expect(secondScheduler.projection().retryWaitCount).toBe(1);
      now += 1_000;
      await Promise.all(secondScheduler.tick([], rotatedSnapshot));
      expect(secondScheduler.projection()).toMatchObject({
        passedCount: 1,
        bundledJobCount: 1,
        capturedOriginalJobCount: 1,
        legacyEvidenceDebtCount: 0,
        unreadNotificationCount: 1,
        budget: { requestAttemptsStarted: 2 },
      });
      secondStore.close();

      const thirdStore = new SqliteOperationalStore(path);
      const restored = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store: thirdStore }),
        store: thirdStore,
        now: () => now,
      }).projection();
      expect(restored).toMatchObject({
        passedCount: 1,
        bundledJobCount: 1,
        unreadNotificationCount: 1,
        jobs: [{
          schemaVersion: "pmh.semantic-review-job.v3",
          status: "PASS",
          reviewOutcome: {
            schemaVersion: "pmh.semantic-review-outcome-capsule.v1",
            recommendation: "REJECT",
            authority: "ADVISORY_SUMMARY_ONLY",
          },
        }],
        storage: {
          jobs: { durable: true, schemaVersion: 41 },
          notifications: { durable: true, schemaVersion: 41 },
        },
      });
      thirdStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains the one-retry protocol policy across SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-review-failure-policy-"));
    const path = join(directory, "control-plane.sqlite");
    const item = candidate(
      proposal("restart-protocol-policy"),
      5,
    );
    let now = Date.parse("2026-08-02T00:00:00.000Z");
    let calls = 0;
    const failingReviewer = {
      review: async () => {
        calls += 1;
        throw new Error(
          "semantic reviewer completed without submitting its tool effect",
        );
      },
    };
    try {
      const firstStore = new SqliteOperationalStore(path);
      const first = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk(
          { DEEPSEEK_API_KEY: "test-only" },
          { reviewer: failingReviewer, store: firstStore },
        ),
        tickIntervalMs: 1_000,
        retryDelayMs: 1_000,
        maxAttempts: 3,
        store: firstStore,
        now: () => now,
      });
      await Promise.all(first.tick([item], snapshot));
      expect(first.projection().jobs[0]).toMatchObject({
        status: "RETRY_WAIT",
        attemptCount: 1,
        lastFailure: {
          failureClass: "MODEL_PROTOCOL",
          retryPolicy: "ONE_RETRY",
        },
      });
      firstStore.close();

      now += 1_000;
      const secondStore = new SqliteOperationalStore(path);
      const second = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk(
          { DEEPSEEK_API_KEY: "test-only" },
          { reviewer: failingReviewer, store: secondStore },
        ),
        tickIntervalMs: 1_000,
        retryDelayMs: 1_000,
        maxAttempts: 3,
        store: secondStore,
        now: () => now,
      });
      await Promise.all(second.tick([item], snapshot));
      expect(calls).toBe(2);
      expect(second.projection()).toMatchObject({
        retryWaitCount: 0,
        exhaustedCount: 1,
        classifiedFailureJobCount: 1,
        failureClassCounts: [{ failureClass: "MODEL_PROTOCOL", jobCount: 1 }],
        budget: { requestAttemptsStarted: 2 },
      });
      secondStore.close();

      const thirdStore = new SqliteOperationalStore(path);
      const restored = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store: thirdStore }),
        store: thirdStore,
        now: () => now,
      }).projection();
      expect(restored.jobs[0]).toMatchObject({
        status: "EXHAUSTED",
        lastFailure: {
          failureClass: "MODEL_PROTOCOL",
          retryPolicy: "ONE_RETRY",
        },
      });
      expect(restored.failureClassCounts).toEqual([{
        failureClass: "MODEL_PROTOCOL",
        jobCount: 1,
      }]);
      thirdStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("restores a research-only disposition without rehydrating a due request", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-review-admission-"));
    const path = join(directory, "control-plane.sqlite");
    const researchProposal = proposal(
      "restart-research-only",
      "EXHAUSTIVE",
      ["venue-a:event"],
    );
    const item = candidate(researchProposal, 2);
    const now = () => Date.parse("2026-08-02T00:00:00.000Z");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const first = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store: firstStore }),
        tickIntervalMs: 1_000,
        store: firstStore,
        now,
      });
      expect(first.tick([item], snapshot)).toHaveLength(0);
      expect(first.projection()).toMatchObject({
        researchOnlyCount: 1,
        dueCount: 0,
        storage: { jobs: { durable: true, schemaVersion: 41 } },
      });
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const second = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store: secondStore }),
        tickIntervalMs: 1_000,
        store: secondStore,
        now,
      });
      expect(second.tick([], snapshot)).toHaveLength(0);
      expect(second.projection()).toMatchObject({
        researchOnlyCount: 1,
        pendingCount: 0,
        dueCount: 0,
        budget: { requestAttemptsStarted: 0 },
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("restores duplicate-scope lineage without rehydrating a due request", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-review-scope-"));
    const path = join(directory, "control-plane.sqlite");
    const firstProposal = proposal("restart-scope-first");
    const secondProposal = proposal("restart-scope-second");
    const items = [firstProposal, secondProposal].map((item) => candidate(
      item,
      4,
      undefined,
      buildProposalEvidenceBundle(item, snapshot),
    ));
    const now = () => Date.parse("2026-08-02T00:00:00.000Z");
    let calls = 0;
    try {
      const firstStore = new SqliteOperationalStore(path);
      const first = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk(
          { DEEPSEEK_API_KEY: "test-only" },
          {
            store: firstStore,
            reviewer: {
              review: async () => {
                calls += 1;
                return reviewResult("REJECT");
              },
            },
          },
        ),
        tickIntervalMs: 1_000,
        store: firstStore,
        now,
      });
      await Promise.all(first.tick(items, snapshot));
      expect(first.projection()).toMatchObject({
        passedCount: 1,
        duplicateScopeCount: 1,
        uniqueReviewScopeCount: 1,
        storage: { jobs: { durable: true, schemaVersion: 41 } },
      });
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const second = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, { store: secondStore }),
        tickIntervalMs: 1_000,
        store: secondStore,
        now,
      });
      expect(second.tick([], snapshot)).toHaveLength(0);
      expect(second.projection()).toMatchObject({
        passedCount: 1,
        duplicateScopeCount: 1,
        dueCount: 0,
        pendingCount: 0,
        budget: { requestAttemptsStarted: 1 },
      });
      expect(calls).toBe(1);
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
