import { hashCanonical } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import {
  buildMarketCorpusSnapshot,
  SearchIssueScheduler,
  SearchLeaseScheduler,
  SqliteOperationalStore,
  type DiscoveryCatalogContext,
  type DiscoveryRunRecord,
  type DiscoveryTask,
  type OpportunityHypothesis,
} from "../src/index.js";

const nowMs = Date.parse("2026-08-01T00:00:00.000Z");

const listings = Object.freeze(["venue-a", "venue-b"].map((venueId) => Object.freeze({
  listingRef: `${venueId}:pizza`,
  venueId,
  venueInstrumentId: "pizza",
  title: "Will Trump eat pizza on stream in August?",
  description: "A bounded public event.",
  status: "OPEN",
  mechanism: "CLOB",
  closesAt: "2026-09-01T00:00:00.000Z",
  rulesText: "Resolves yes if the named event occurs.",
  outcomes: Object.freeze([
    Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.5" }),
    Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.5" }),
  ]),
  priceScale: "1000000",
  quantityScale: "1000000",
  minPriceTick: "1000",
  sourceKind: "LIVE_OBSERVATION" as const,
  sourceReceivedAt: "2026-08-01T00:00:00.000Z",
  sourceRawHash: hashCanonical({ venueId }),
  protocolIdentity: `protocol:${venueId}`,
})));

function snapshot(source = "search-issue-test") {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings,
  });
}

function context(question: string, venueIds: readonly string[]): DiscoveryCatalogContext {
  const body = Object.freeze({
    schemaVersion: "pmh.discovery-catalog-context.v2" as const,
    source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    listings: Object.freeze(listings.filter((item) => venueIds.includes(item.venueId))),
  });
  expect(question).not.toHaveLength(0);
  return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
}

function runRecord(task: DiscoveryTask): DiscoveryRunRecord {
  const hypothesis: OpportunityHypothesis = Object.freeze({
    hypothesisId: `hypothesis:${hashCanonical(task.taskId).slice(7, 23)}`,
    workerId: "model:fast",
    thesis: "The two listings may resolve to the same claim.",
    strategyKind: "SAME_CLAIM_CROSS_VENUE",
    venueIds: Object.freeze(["venue-a", "venue-b"]),
    claimSearchTerms: Object.freeze(["Trump", "pizza", "August"]),
    listingRefs: Object.freeze(["venue-a:pizza", "venue-b:pizza"]),
    confidenceBps: 5_000,
    authority: "PROPOSE_ONLY",
    reviewStatus: "UNREVIEWED",
  });
  return Object.freeze({
    runId: hashCanonical({ taskId: task.taskId }),
    taskId: task.taskId,
    startedAt: "2026-08-01T00:00:01.000Z",
    completedAt: "2026-08-01T00:00:02.000Z",
    workerIds: Object.freeze(["model:fast"]),
    workerReports: Object.freeze([Object.freeze({
      workerId: "model:fast",
      kind: "MODEL" as const,
      costTier: "LOW" as const,
      status: "PASS" as const,
      startedAt: "2026-08-01T00:00:01.000Z",
      completedAt: "2026-08-01T00:00:02.000Z",
      durationMs: 1_000,
      hypothesisCount: 1,
      diagnostic: null,
    })]),
    hypotheses: Object.freeze([hypothesis]),
    diagnostics: Object.freeze([]),
    executionAuthority: false,
    question: task.question,
    venueIds: task.venueIds,
    catalogContext: task.catalogContext,
    catalogContextIdentity: task.catalogContext?.contextIdentity,
    catalogListingCount: task.catalogContext?.listings.length,
    catalogContextSource: task.catalogContext?.source,
  });
}

describe("issue-driven concurrent search scheduler", () => {
  it("seeds durable issues, fills three priority slots, and notifies only a novel signature", async () => {
    const pending: Array<{ task: DiscoveryTask; resolve: (record: DiscoveryRunRecord) => void }> = [];
    const runFast = vi.fn((task: DiscoveryTask) => new Promise<DiscoveryRunRecord>((resolve) => {
      pending.push({ task, resolve });
    }));
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: 1 }),
      status: "PASS" as const,
      proposalIds: Object.freeze([hashCanonical({ proposal: 1 })]),
      proposalDetails: Object.freeze([Object.freeze({
        proposalId: hashCanonical({ proposal: 1 }),
        relationKind: "EQUIVALENT" as const,
        listingRefs: Object.freeze(["venue-a:pizza", "venue-b:pizza"]),
      })]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const store = new SqliteOperationalStore(":memory:");
    const leases = new SearchLeaseScheduler({
      context,
      runFast,
      runDeep,
      concurrencyLimit: 3,
      store,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      tickIntervalMs: 1_000,
      concurrencyLimit: 3,
      store,
      now: () => nowMs,
    });

    const runs = issues.tick(snapshot());
    expect(runs).toHaveLength(3);
    expect(issues.projection()).toMatchObject({
      issueCount: 5,
      enabledIssueCount: 5,
      activeCount: 3,
      concurrencyLimit: 3,
    });
    expect(pending).toHaveLength(3);
    const focusedTask = pending.find((item) =>
      item.task.question.includes("exactly two current OPEN/ACTIVE binary listings")
    )?.task;
    expect(focusedTask?.question).toContain("explicit settlement path");
    expect(focusedTask?.question).toContain("indicative prices");
    expect(focusedTask?.question).toContain("executable profit remain unproven");
    expect(focusedTask?.question).toContain("Return no hypothesis unless");
    for (const item of pending) item.resolve(runRecord(item.task));
    await Promise.all(runs);

    const completed = issues.projection();
    expect(completed.activeCount).toBe(0);
    expect(completed.issues.reduce((sum, issue) => sum + issue.runCount, 0)).toBe(3);
    expect(completed.unreadNotificationCount).toBe(1);
    expect(runDeep).toHaveBeenCalledTimes(1);
    expect(completed.performance).toMatchObject({
      measurementWindow: "RETAINED_TERMINAL_LEASES",
      retainedLeaseLimit: 40,
      terminalLeaseCount: 3,
      novelCandidateCount: 1,
      duplicateCount: 1,
      piEscalationCount: 1,
      economicGateRequiredCount: 1,
      economicGatePositiveCount: 0,
      economicGateBlockedCount: 1,
      piAvoidedCount: 1,
      modelSelectionRequiredCount: 1,
      modelSelectedCandidateCount: 1,
      modelSelectionMissCount: 0,
      quoteEnrichmentAttemptCount: 0,
      quoteEnrichmentReadyCount: 0,
      quoteEnrichmentPartialCount: 0,
      quoteEnrichmentFailedCount: 0,
      quoteEnrichmentRescuedGateCount: 0,
      quoteObservationCount: 0,
      exactSemanticScopeCount: 3,
      semanticScopeRevisitCount: 0,
      noLeadSemanticScopeCount: 0,
      boundedSemanticScopeCount: 0,
      boundedScopeRevisitCount: 0,
      noLeadBoundedScopeCount: 0,
      hypothesisCount: 3,
      proposalCount: 1,
      evidenceGapCount: 0,
      novelCandidateRateBps: 3_333,
      duplicateRateBps: 3_333,
      piEscalationRateBps: 3_333,
      economicGatePositiveRateBps: 0,
    });
    expect(completed.performance.byIssue).toHaveLength(5);
    expect(completed.performance.byIssue.reduce(
      (sum, item) => sum + item.terminalLeaseCount,
      0,
    )).toBe(3);
    expect(completed.notifications[0]).toMatchObject({
      kind: "NOVEL_CANDIDATE",
      status: "UNREAD",
    });
    expect(leases.projection().records.find((record) =>
      record.lease.issueId === completed.issues.find((issue) =>
        issue.title === "Settlement-qualified two-leg parity"
      )?.issueId
    )?.lease.candidatePolicy).toEqual({
      allowedRelationKinds: ["EQUIVALENT"],
      exactListingRefCount: 2,
      requirePositiveGrossHint: true,
      candidateSelection: "MODEL_HYPOTHESIS",
      requireDistinctVenues: true,
    });
    expect(completed.storage.issues).toMatchObject({ durable: false, schemaVersion: 15 });
    expect(leases.projection()).toMatchObject({
      retainedCorpusCount: 1,
      recoverableIssuedCount: 0,
      missingCorpusIssuedCount: 0,
      corpusStorage: { durable: false, schemaVersion: 15 },
    });

    const restored = new SearchIssueScheduler({
      leaseScheduler: leases,
      store,
      seedDefaults: false,
      now: () => nowMs + 1_000,
    });
    expect(restored.projection()).toMatchObject({
      issueCount: 5,
      unreadNotificationCount: 1,
      performance: { terminalLeaseCount: 3, duplicateCount: 1 },
    });
    const notification = restored.projection().notifications[0]!;
    restored.acknowledge(notification.notificationId);
    expect(restored.projection().unreadNotificationCount).toBe(0);
    store.close();
  });

  it("attributes selected-pair quote acquisition and a rescued gate to its issue", async () => {
    const priced = Object.freeze({
      ...listings[0]!,
      listingRef: "limitless:hourly",
      venueId: "limitless",
      venueInstrumentId: "hourly",
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "201", label: "Up", indicativePrice: "0.4" }),
        Object.freeze({ venueOutcomeId: "202", label: "Down", indicativePrice: "0.6" }),
      ]),
    });
    const unpriced = Object.freeze({
      ...listings[1]!,
      listingRef: "opinion:hourly",
      venueId: "opinion",
      venueInstrumentId: "hourly",
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "101", label: "Up", indicativePrice: null }),
        Object.freeze({ venueOutcomeId: "102", label: "Down", indicativePrice: null }),
      ]),
    });
    const pair = Object.freeze([priced, unpriced]);
    const current = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "issue-quote-enrichment" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: pair,
    });
    const selectedRefs = Object.freeze(pair.map((item) => item.listingRef).sort());
    const quoteIds = Object.freeze([
      hashCanonical({ quote: "issue-up" }),
      hashCanonical({ quote: "issue-down" }),
    ]);
    const leases = new SearchLeaseScheduler({
      context: (question) => {
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: pair,
        });
        expect(question).not.toHaveLength(0);
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task) => {
        const base = runRecord(task);
        return Object.freeze({
          ...base,
          hypotheses: Object.freeze([Object.freeze({
            ...base.hypotheses[0]!,
            venueIds: Object.freeze(["limitless", "opinion"]),
            listingRefs: selectedRefs,
          })]),
        });
      },
      enrichPrices: async (selected) => Object.freeze({
        status: "READY" as const,
        requestedListingCount: 2,
        attemptedOutcomeCount: 2,
        enrichedOutcomeCount: 2,
        listings: Object.freeze(selected.map((item) => item.venueId !== "opinion"
          ? item
          : Object.freeze({
              ...item,
              outcomes: Object.freeze([
                Object.freeze({ ...item.outcomes[0]!, indicativePrice: "0.5" }),
                Object.freeze({ ...item.outcomes[1]!, indicativePrice: "0.4" }),
              ]),
            })
        )),
        observationIds: quoteIds,
        diagnostics: Object.freeze([]),
        authority: "SEARCH_PRICE_EVIDENCE_ONLY" as const,
        semanticDecisionAuthority: false as const,
        simulationAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          anonymousPublicGets: true,
          credentialsUsed: false as const,
          externalWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      }),
      runDeep: async () => Object.freeze({
        runId: hashCanonical({ deep: "issue-quote-enrichment" }),
        status: "PASS" as const,
        proposalIds: Object.freeze([hashCanonical({ proposal: "issue-quote" })]),
        proposalDetails: Object.freeze([Object.freeze({
          proposalId: hashCanonical({ proposal: "issue-quote" }),
          relationKind: "EQUIVALENT" as const,
          listingRefs: selectedRefs,
        })]),
        evidenceGaps: Object.freeze([]),
        diagnostic: null,
      }),
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({ leaseScheduler: leases, now: () => nowMs });
    const issue = issues.projection().issues.find((item) =>
      item.title === "Settlement-qualified two-leg parity"
    )!;

    await issues.runNow(issue.issueId, current).promise;

    expect(issues.projection().performance).toMatchObject({
      quoteEnrichmentAttemptCount: 1,
      quoteEnrichmentReadyCount: 1,
      quoteEnrichmentPartialCount: 0,
      quoteEnrichmentFailedCount: 0,
      quoteEnrichmentRescuedGateCount: 1,
      quoteObservationCount: 2,
    });
    expect(issues.projection().performance.byIssue.find((item) =>
      item.issueId === issue.issueId
    )).toMatchObject({
      quoteEnrichmentAttemptCount: 1,
      quoteEnrichmentReadyCount: 1,
      quoteEnrichmentRescuedGateCount: 1,
      quoteObservationCount: 2,
    });
  });

  it("coalesces one issue on one snapshot and does not double-count a retained lease", async () => {
    let release: ((record: DiscoveryRunRecord) => void) | undefined;
    let task: DiscoveryTask | undefined;
    const leases = new SearchLeaseScheduler({
      context,
      runFast: async (nextTask) => {
        task = nextTask;
        return await new Promise<DiscoveryRunRecord>((resolve) => { release = resolve; });
      },
      maxPiInvocations: 0,
      concurrencyLimit: 3,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      seedDefaults: true,
      concurrencyLimit: 3,
      now: () => nowMs,
    });
    const issue = issues.projection().issues[0]!;
    const first = issues.runNow(issue.issueId, snapshot());
    const replayWhileActive = issues.runNow(issue.issueId, snapshot());
    expect(replayWhileActive.idempotentReplay).toBe(true);
    release!(runRecord(task!));
    await Promise.all([first.promise, replayWhileActive.promise]);
    expect(issues.projection().issues.find((item) => item.issueId === issue.issueId)?.runCount).toBe(1);

    const retained = issues.runNow(issue.issueId, snapshot());
    expect(retained.idempotentReplay).toBe(true);
    await retained.promise;
    expect(issues.projection().issues.find((item) => item.issueId === issue.issueId)?.runCount).toBe(1);
  });

  it("reports issue-local bounded neighborhood coverage and revisits", async () => {
    const boundedListings = Object.freeze([
      ...listings,
      Object.freeze({
        ...listings[0]!,
        listingRef: "venue-c:pizza",
        venueId: "venue-c",
        sourceRawHash: hashCanonical({ venueId: "venue-c" }),
        protocolIdentity: "protocol:venue-c",
      }),
    ]);
    const boundedSnapshot = (source: string) => buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source }),
      eligibleSourceCount: 3,
      excludedSourceCount: 0,
      listings: boundedListings,
    });
    const leases = new SearchLeaseScheduler({
      context: (question) => {
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: boundedListings,
        });
        expect(question).not.toHaveLength(0);
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task) => Object.freeze({
        ...runRecord(task),
        hypotheses: Object.freeze([]),
      }),
      maxPiInvocations: 0,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      seedDefaults: false,
      now: () => nowMs,
    });
    const issue = issues.create({
      title: "Bounded rotation",
      question: "Search a bounded semantic neighborhood.",
      lens: "IMPLICATION",
      cadenceMs: 3_600_000,
    });
    await issues.runNow(issue.issueId, boundedSnapshot("bounded-1")).promise;
    await issues.runNow(issue.issueId, boundedSnapshot("bounded-2")).promise;

    expect(issues.projection().performance).toMatchObject({
      exactSemanticScopeCount: 0,
      semanticScopeRevisitCount: 0,
      noLeadSemanticScopeCount: 0,
      boundedSemanticScopeCount: 1,
      boundedScopeRevisitCount: 1,
      noLeadBoundedScopeCount: 2,
      byIssue: [expect.objectContaining({
        issueId: issue.issueId,
        boundedSemanticScopeCount: 1,
        boundedScopeRevisitCount: 1,
        noLeadBoundedScopeCount: 2,
      })],
    });
  });

  it("bounds a long operator brief to the durable lease audit contract", async () => {
    let dispatched: DiscoveryTask | undefined;
    const leases = new SearchLeaseScheduler({
      context,
      runFast: async (task) => {
        dispatched = task;
        return runRecord(task);
      },
      maxPiInvocations: 0,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      seedDefaults: false,
      now: () => nowMs,
    });
    const issue = issues.create({
      title: "Bounded long brief",
      question: `Find a grounded pair. ${"x".repeat(700)}`,
      lens: "EQUIVALENCE",
      cadenceMs: 300_000,
    });

    await issues.runNow(issue.issueId, snapshot()).promise;

    expect(dispatched?.question).toHaveLength(500);
    expect(dispatched?.question).toMatch(/^Find a grounded pair\./u);
  });

  it("pauses schedules and creates a durable failure notification", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const leases = new SearchLeaseScheduler({
      context,
      runFast: async () => { throw new Error("provider unavailable"); },
      maxPiInvocations: 0,
      concurrencyLimit: 3,
      store,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      tickIntervalMs: 1_000,
      concurrencyLimit: 3,
      store,
      now: () => nowMs,
    });
    const paused = issues.setEnabled(issues.projection().issues[0]!.issueId, false);
    expect(paused.enabled).toBe(false);
    const runs = issues.tick(snapshot());
    expect(runs).toHaveLength(3);
    await Promise.all(runs);
    expect(issues.projection().notifications.some((item) => item.kind === "RUN_FAILED")).toBe(true);
    expect(issues.projection().issues.find((item) => item.issueId === paused.issueId)?.runCount).toBe(0);
    store.close();
  });

  it("reconciles missing defaults without overwriting durable operator issue state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-search-issues-"));
    const path = join(directory, "control-plane.sqlite");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstLeases = new SearchLeaseScheduler({
        context,
        runFast: async (task) => runRecord(task),
        maxPiInvocations: 0,
        store: firstStore,
      });
      const first = new SearchIssueScheduler({
        leaseScheduler: firstLeases,
        store: firstStore,
        seedDefaults: false,
        now: () => nowMs,
      });
      const created = first.create({
        title: "Named-person action aliases",
        question: "Search for the same named person and public action across venues.",
        lens: "EQUIVALENCE",
        cadenceMs: 300_000,
        priority: 5,
      });
      first.setEnabled(created.issueId, false);
      expect(first.projection().storage.issues.durable).toBe(true);
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondLeases = new SearchLeaseScheduler({
        context,
        runFast: async () => { throw new Error("must not run while restoring"); },
        maxPiInvocations: 0,
        store: secondStore,
      });
      const restored = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        store: secondStore,
      });
      expect(restored.projection()).toMatchObject({
        issueCount: 6,
        enabledIssueCount: 5,
        storage: { issues: { durable: true, schemaVersion: 15 } },
      });
      expect(restored.projection().issues.find((issue) => issue.issueId === created.issueId))
        .toMatchObject({ enabled: false, title: created.title });
      const focusedDefault = restored.projection().issues.find((issue) =>
        issue.title === "Settlement-qualified two-leg parity"
      )!;
      const disabledDefault = restored.setEnabled(focusedDefault.issueId, false);
      const { artifactHash: _focusedHash, ...disabledBody } = disabledDefault;
      const legacyPolicyBody = Object.freeze({
        ...disabledBody,
        candidatePolicy: Object.freeze({
          allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
          exactListingRefCount: 2,
        }),
      });
      secondStore.saveSearchIssueRecord(Object.freeze({
        ...legacyPolicyBody,
        artifactHash: hashCanonical(legacyPolicyBody),
      }));
      const restarted = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        store: secondStore,
      });
      expect(restarted.projection()).toMatchObject({
        issueCount: 6,
        enabledIssueCount: 4,
      });
      expect(restarted.projection().issues.find((issue) => issue.issueId === focusedDefault.issueId))
        .toMatchObject({
          enabled: false,
          updatedAt: disabledDefault.updatedAt,
          candidatePolicy: {
            allowedRelationKinds: ["EQUIVALENT"],
            exactListingRefCount: 2,
            requirePositiveGrossHint: true,
          },
        });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("resumes an issued lease immediately after restart instead of waiting for cadence", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const firstLeases = new SearchLeaseScheduler({
      context,
      runFast: async () => await new Promise<DiscoveryRunRecord>(() => undefined),
      maxPiInvocations: 0,
      store,
      now: () => nowMs,
    });
    const firstIssues = new SearchIssueScheduler({
      leaseScheduler: firstLeases,
      seedDefaults: false,
      store,
      now: () => nowMs,
    });
    const issue = firstIssues.create({
      title: "Restart-safe equivalence",
      question: "Search for same-claim listings and falsify title similarity.",
      lens: "EQUIVALENCE",
      cadenceMs: 3_600_000,
    });
    firstIssues.runNow(issue.issueId, snapshot());
    expect(Date.parse(firstIssues.projection().issues[0]!.nextRunAt)).toBe(nowMs + 3_600_000);

    const resumedFast = vi.fn(async (task: DiscoveryTask) => runRecord(task));
    const secondLeases = new SearchLeaseScheduler({
      context,
      runFast: resumedFast,
      maxPiInvocations: 0,
      store,
      now: () => nowMs + 1_000,
    });
    const secondIssues = new SearchIssueScheduler({
      leaseScheduler: secondLeases,
      tickIntervalMs: 1_000,
      seedDefaults: false,
      store,
      now: () => nowMs + 1_000,
    });
    expect(secondIssues.projection().dueIssueCount).toBe(1);
    const resumed = secondIssues.tick(snapshot());
    expect(resumed).toHaveLength(1);
    await Promise.all(resumed);
    expect(resumedFast).toHaveBeenCalledTimes(1);
    expect(secondIssues.projection().issues[0]).toMatchObject({
      runCount: 1,
      passCount: 1,
    });
    store.close();
  });

  it("resumes the retained issued corpus even when the current corpus changed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-search-lease-resume-"));
    const path = join(directory, "control-plane.sqlite");
    try {
      const oldSnapshot = snapshot("old-corpus");
      const newSnapshot = snapshot("new-corpus");
      const firstStore = new SqliteOperationalStore(path);
      const firstLeases = new SearchLeaseScheduler({
        context,
        runFast: async () => await new Promise<DiscoveryRunRecord>(() => undefined),
        maxPiInvocations: 0,
        store: firstStore,
        now: () => nowMs,
      });
      const firstIssues = new SearchIssueScheduler({
        leaseScheduler: firstLeases,
        seedDefaults: false,
        store: firstStore,
        now: () => nowMs,
      });
      const issue = firstIssues.create({
        title: "Changing corpus",
        question: "Search the current corpus without substituting evidence during a lease.",
        lens: "MECHANISM",
        cadenceMs: 3_600_000,
      });
      firstIssues.runNow(issue.issueId, oldSnapshot);
      firstStore.close();

      const resumedSnapshots: string[] = [];
      const secondStore = new SqliteOperationalStore(path);
      const secondLeases = new SearchLeaseScheduler({
        context: (question, venueIds, _lens, retained) => {
          resumedSnapshots.push(retained.snapshotIdentity);
          return context(question, venueIds);
        },
        runFast: async (task) => runRecord(task),
        maxPiInvocations: 0,
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      const secondIssues = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        tickIntervalMs: 1_000,
        seedDefaults: false,
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      const runs = secondIssues.tick(newSnapshot);
      expect(runs).toHaveLength(1);
      await Promise.all(runs);
      expect(secondIssues.projection().issues[0]).toMatchObject({
        runCount: 1,
        passCount: 1,
        failedCount: 0,
      });
      expect(resumedSnapshots).toEqual([oldSnapshot.snapshotIdentity]);
      expect(secondLeases.projection()).toMatchObject({
        retainedCorpusCount: 1,
        recoverableIssuedCount: 0,
        missingCorpusIssuedCount: 0,
      });
      expect(secondLeases.projection().records).toHaveLength(1);
      expect(secondLeases.projection().records[0]).toMatchObject({
        status: "PASS",
        lease: { snapshotIdentity: oldSnapshot.snapshotIdentity },
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a tampered retained corpus before an Agent call", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-search-lease-tamper-"));
    const path = join(directory, "control-plane.sqlite");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstLeases = new SearchLeaseScheduler({
        context,
        runFast: async () => await new Promise<DiscoveryRunRecord>(() => undefined),
        maxPiInvocations: 0,
        store: firstStore,
        now: () => nowMs,
      });
      const firstIssues = new SearchIssueScheduler({
        leaseScheduler: firstLeases,
        seedDefaults: false,
        store: firstStore,
        now: () => nowMs,
      });
      const issue = firstIssues.create({
        title: "Tamper test",
        question: "Never run an Agent on corrupt retained evidence.",
        lens: "EQUIVALENCE",
        cadenceMs: 3_600_000,
      });
      firstIssues.runNow(issue.issueId, snapshot("tamper"));
      firstStore.close();

      const database = new DatabaseSync(path);
      database.prepare(
        `UPDATE search_lease_corpora
         SET corpus_json = json_set(corpus_json, '$.listings[0].title', 'tampered')`,
      ).run();
      database.close();

      const runFast = vi.fn(async (task: DiscoveryTask) => runRecord(task));
      const secondStore = new SqliteOperationalStore(path);
      const secondLeases = new SearchLeaseScheduler({
        context,
        runFast,
        maxPiInvocations: 0,
        store: secondStore,
      });
      expect(() => secondLeases.resumeIssued(issue.issueId)).toThrow(/identity mismatch/);
      expect(runFast).not.toHaveBeenCalled();
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails a legacy issued lease without retained corpus and runs current evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-search-lease-legacy-"));
    const path = join(directory, "control-plane.sqlite");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstLeases = new SearchLeaseScheduler({
        context,
        runFast: async () => await new Promise<DiscoveryRunRecord>(() => undefined),
        maxPiInvocations: 0,
        store: firstStore,
        now: () => nowMs,
      });
      const firstIssues = new SearchIssueScheduler({
        leaseScheduler: firstLeases,
        seedDefaults: false,
        store: firstStore,
        now: () => nowMs,
      });
      const issue = firstIssues.create({
        title: "Legacy corpus gap",
        question: "Preserve visible migration debt without substituting evidence.",
        lens: "MECHANISM",
        cadenceMs: 3_600_000,
      });
      firstIssues.runNow(issue.issueId, snapshot("legacy-old"));
      firstStore.close();

      const database = new DatabaseSync(path);
      const retainedLeaseHash = (database.prepare(
        "SELECT record_hash FROM search_lease_records",
      ).get() as { record_hash: string }).record_hash;
      database.exec("DROP TABLE search_lease_corpora; PRAGMA user_version = 12");
      database.close();

      const secondStore = new SqliteOperationalStore(path);
      const migrated = new DatabaseSync(path, { readOnly: true });
      expect((migrated.prepare(
        "SELECT record_hash FROM search_lease_records",
      ).get() as { record_hash: string }).record_hash).toBe(retainedLeaseHash);
      expect((migrated.prepare("PRAGMA user_version").get() as {
        user_version: number;
      }).user_version).toBe(15);
      migrated.close();
      const secondLeases = new SearchLeaseScheduler({
        context,
        runFast: async (task) => runRecord(task),
        maxPiInvocations: 0,
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      const secondIssues = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        tickIntervalMs: 1_000,
        seedDefaults: false,
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      const runs = secondIssues.tick(snapshot("legacy-new"));
      await Promise.all(runs);
      expect(secondIssues.projection().issues[0]).toMatchObject({
        runCount: 2,
        passCount: 1,
        failedCount: 1,
      });
      expect(secondIssues.projection().notifications.find(
        (notification) => notification.kind === "RUN_FAILED",
      )).toMatchObject({
        summary: "issued search lease snapshot is no longer available after restart",
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
