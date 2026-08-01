import { hashCanonical, type Hash } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSemanticReviewJobRecord,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  createSemanticReviewDesk,
  SemanticReviewScheduler,
  type MarketRelationProposal,
  type SemanticReviewCandidate,
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

function proposal(name: string): MarketRelationProposal {
  const body = {
    relationKind: "EQUIVALENT" as const,
    listingRefs: ["venue-a:event", "venue-b:event"],
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
    completed.jobs.forEach((job) => expect(() => assertSemanticReviewJobRecord(job)).not.toThrow());
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
      budget: { requestAttemptsStarted: 1 },
    });
    expect(scheduler.tick([item], snapshot)).toHaveLength(0);
    now += 1_000;
    await Promise.all(scheduler.tick([item], snapshot));
    expect(calls).toBe(2);
    expect(scheduler.projection()).toMatchObject({
      retryWaitCount: 0,
      exhaustedCount: 1,
      unreadNotificationCount: 1,
      budget: { requestAttemptsStarted: 2 },
    });
    const notification = scheduler.projection().notifications[0]!;
    expect(notification.kind).toBe("JOB_EXHAUSTED");
    scheduler.acknowledge(notification.notificationId);
    scheduler.reconcile([item], desk.projection().records);
    expect(scheduler.projection().notifications).toHaveLength(1);
    expect(scheduler.projection().unreadNotificationCount).toBe(0);
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
        storage: { jobs: { durable: true, schemaVersion: 15 } },
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
        storage: {
          jobs: { durable: true, schemaVersion: 15 },
          notifications: { durable: true, schemaVersion: 15 },
        },
      });
      thirdStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
