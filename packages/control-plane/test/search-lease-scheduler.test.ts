import { hashCanonical } from "@pmh/domain";
import { describe, expect, it, vi } from "vitest";
import {
  buildMarketCorpusSnapshot,
  SearchLeaseScheduler,
  SqliteOperationalStore,
  type DiscoveryCatalogContext,
  type DiscoveryRunRecord,
  type DiscoveryTask,
  type OpportunityHypothesis,
} from "../src/index.js";

const receivedAt = "2026-08-01T00:00:00.000Z";

function listing(venueId: string, suffix: string) {
  return Object.freeze({
    listingRef: `${venueId}:${suffix}`,
    venueId,
    venueInstrumentId: suffix,
    title: "Will Trump eat pizza on stream in August?",
    description: "A bounded public event.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "Resolves yes if the named event occurs.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "500000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "500000" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: receivedAt,
    sourceRawHash: hashCanonical({ venueId, suffix }),
    protocolIdentity: `protocol:${venueId}`,
  });
}

const listings = Object.freeze([
  listing("venue-a", "pizza-a"),
  listing("venue-b", "pizza-b"),
]);

function snapshot(source = "search-lease") {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ receivedAt, source }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings,
  });
}

function context(
  question: string,
  venueIds: readonly string[],
): DiscoveryCatalogContext {
  const scoped = listings.filter((item) => venueIds.includes(item.venueId));
  const body = Object.freeze({
    schemaVersion: "pmh.discovery-catalog-context.v2" as const,
    source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    listings: Object.freeze(scoped),
  });
  expect(question.length).toBeGreaterThan(0);
  return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
}

function hypothesis(task: DiscoveryTask): OpportunityHypothesis {
  return Object.freeze({
    hypothesisId: `hypothesis:${hashCanonical(task.taskId).slice(7, 23)}`,
    workerId: "model:fast",
    thesis: "The two listings may resolve to the same claim.",
    strategyKind: "SAME_CLAIM_CROSS_VENUE" as const,
    venueIds: Object.freeze(["venue-a", "venue-b"]),
    claimSearchTerms: Object.freeze(["Trump", "pizza", "August"]),
    listingRefs: Object.freeze(["venue-a:pizza-a", "venue-b:pizza-b"]),
    confidenceBps: 5_000,
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
  });
}

function runRecord(task: DiscoveryTask): DiscoveryRunRecord {
  const startedAt = "2026-08-01T00:00:01.000Z";
  const completedAt = "2026-08-01T00:00:02.000Z";
  return Object.freeze({
    runId: hashCanonical({ taskId: task.taskId }),
    taskId: task.taskId,
    startedAt,
    completedAt,
    workerIds: Object.freeze(["heuristic:free", "model:fast"]),
    workerReports: Object.freeze([
      Object.freeze({
        workerId: "heuristic:free",
        kind: "HEURISTIC" as const,
        costTier: "FREE" as const,
        status: "PASS" as const,
        startedAt,
        completedAt,
        durationMs: 1_000,
        hypothesisCount: 0,
        diagnostic: null,
      }),
      Object.freeze({
        workerId: "model:fast",
        kind: "MODEL" as const,
        costTier: "LOW" as const,
        status: "PASS" as const,
        startedAt,
        completedAt,
        durationMs: 1_000,
        hypothesisCount: 1,
        diagnostic: null,
      }),
    ]),
    hypotheses: Object.freeze([hypothesis(task)]),
    diagnostics: Object.freeze([]),
    executionAuthority: false as const,
    question: task.question,
    venueIds: task.venueIds,
    catalogContext: task.catalogContext,
    catalogContextIdentity: task.catalogContext?.contextIdentity,
    catalogListingCount: task.catalogContext?.listings.length,
    catalogContextSource: task.catalogContext?.source,
  });
}

describe("AI-native search lease scheduler", () => {
  it("bounds the cheap lane and escalates only a novel grounded multi-venue candidate", async () => {
    const runFast = vi.fn(async (task: DiscoveryTask, budget: number) => {
      expect(budget).toBe(1);
      return runRecord(task);
    });
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: 1 }),
      status: "PASS" as const,
      proposalIds: Object.freeze([hashCanonical({ proposal: 1 })]),
      evidenceGaps: Object.freeze(["Need authoritative void rules."]),
      diagnostic: null,
    }));
    const scheduler = new SearchLeaseScheduler({
      context,
      graphContext: (_snapshot, lens) => {
        const graphIdentity = hashCanonical({ graph: 1 });
        const items = Object.freeze([Object.freeze({
          proposalId: hashCanonical({ proposal: "prior" }),
          relationKind: "EQUIVALENT" as const,
          listingRefs: Object.freeze(["venue-a:pizza-a", "venue-b:pizza-b"]),
          outcomeCodes: Object.freeze(["MISSING_RULE" as const]),
          summary: "A prior relation is missing authoritative void rules.",
        })]);
        return Object.freeze({
          schemaVersion: "pmh.semantic-graph-search-context.v1" as const,
          graphIdentity,
          neighborhoodIdentity: hashCanonical({ graphIdentity, lens, items }),
          lens,
          relationCount: 1,
          feedbackCount: 1,
          items,
          searchBrief: "Revisit the pizza pair; use MISSING_RULE as falsification evidence.",
          priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS" as const,
          modelConfidenceUsed: false as const,
          authority: "SEARCH_EVIDENCE_ONLY" as const,
          semanticDecisionAuthority: false as const,
          executionAuthority: false as const,
        });
      },
      runFast,
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });

    const first = scheduler.begin(snapshot(), "EQUIVALENCE");
    const record = await first.promise;

    expect(record.status).toBe("PASS");
    expect(record.fastLane.modelRequestCount).toBe(1);
    expect(record.deepLane.reason).toBe("NOVEL_MULTI_LISTING");
    expect(record.deepLane.permittedTools).toEqual(["read", "grep", "find", "ls"]);
    expect(record.trace.chainOfThoughtStored).toBe(false);
    expect(record.lease.graphContext?.feedbackCount).toBe(1);
    expect(record.trace.querySummary).toContain("Graph neighborhood:");
    expect(runFast.mock.calls[0]?.[0].question).toContain("MISSING_RULE");
    expect(record.semanticDecisionAuthority).toBe(false);
    expect(record.certificateAuthority).toBe(false);
    expect(record.executionAuthority).toBe(false);
    expect(runDeep).toHaveBeenCalledTimes(1);

    const replay = scheduler.begin(snapshot(), "EQUIVALENCE");
    expect(replay.idempotentReplay).toBe(true);
    await expect(replay.promise).resolves.toEqual(record);
    expect(runFast).toHaveBeenCalledTimes(1);
    expect(runDeep).toHaveBeenCalledTimes(1);
  });

  it("links duplicate candidate signatures and does not spend a second pi invocation", async () => {
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: 1 }),
      status: "PASS" as const,
      proposalIds: Object.freeze([]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const first = await scheduler.begin(snapshot(), "EQUIVALENCE").promise;
    const duplicate = await scheduler.begin(snapshot(), "IMPLICATION").promise;

    expect(duplicate.deepLane.reason).toBe("DUPLICATE");
    expect(duplicate.lineage.duplicateOfLeaseId).toBe(first.lease.leaseId);
    expect(duplicate.outcome.novelCandidate).toBe(false);
    expect(runDeep).toHaveBeenCalledTimes(1);
  });

  it("persists issued-to-terminal records and restores idempotent results", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      maxPiInvocations: 0,
      store,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const completed = await scheduler.begin(snapshot(), "PARTITION").promise;
    expect(completed.deepLane.reason).toBe("PI_DISABLED");
    expect(store.loadSearchLeaseRecords(10)).toEqual([completed]);
    const { artifactHash: _artifactHash, ...completedBody } = completed;
    const rewrittenBody = Object.freeze({
      ...completedBody,
      diagnostic: "attempted terminal rewrite",
    });
    expect(() => store.saveSearchLeaseRecord(Object.freeze({
      ...rewrittenBody,
      artifactHash: hashCanonical(rewrittenBody),
    }), 40)).toThrow(/cannot rewrite/);

    const restored = new SearchLeaseScheduler({
      context,
      runFast: async () => {
        throw new Error("must not rerun");
      },
      maxPiInvocations: 0,
      store,
    });
    const replay = restored.begin(snapshot(), "PARTITION");
    expect(replay.idempotentReplay).toBe(true);
    await expect(replay.promise).resolves.toEqual(completed);
    expect(restored.projection()).toMatchObject({
      retainedCorpusCount: 1,
      recoverableIssuedCount: 0,
      missingCorpusIssuedCount: 0,
      storage: { schemaVersion: 13 },
      corpusStorage: { schemaVersion: 13, idempotencyKey: "snapshotIdentity" },
    });
    store.close();
  });

  it("writes ISSUED before AI work and resumes that exact lease after restart", async () => {
    const store = new SqliteOperationalStore(":memory:");
    let release: ((record: DiscoveryRunRecord) => void) | undefined;
    const pending = new Promise<DiscoveryRunRecord>((resolve) => {
      release = resolve;
    });
    const first = new SearchLeaseScheduler({
      context,
      runFast: async () => pending,
      maxPiInvocations: 0,
      store,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const issueId = hashCanonical({ issue: "restart" });
    const originalSnapshot = snapshot("restart-original");
    const inFlight = first.begin(
      originalSnapshot,
      "MECHANISM",
      "SCHEDULE",
      { issueId, question: "Resume exact evidence.", venueIds: [] },
    ).promise;
    const issued = store.loadSearchLeaseRecords(10)[0];
    expect(issued?.status).toBe("ISSUED");
    expect(first.projection()).toMatchObject({
      retainedCorpusCount: 1,
      recoverableIssuedCount: 1,
      missingCorpusIssuedCount: 0,
    });

    const restored = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      maxPiInvocations: 0,
      store,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const resumedInvocation = restored.resumeIssued(issueId);
    expect(resumedInvocation).not.toBeNull();
    const resumed = await resumedInvocation!.promise;
    expect(resumed.lease.leaseId).toBe(issued?.lease.leaseId);
    expect(resumed.lease.snapshotIdentity).toBe(originalSnapshot.snapshotIdentity);
    expect(resumed.status).toBe("PASS");

    if (release === undefined) throw new Error("missing pending fast lane");
    release(runRecord({
      taskId: issued!.fastLane.taskId,
      question: issued!.trace.querySummary,
      venueIds: issued!.lease.scope.venueIds,
      maxHypotheses: issued!.lease.budget.maxHypotheses,
      deadlineEpochMs: Date.parse(issued!.lease.deadlineAt),
      catalogContext: context(issued!.trace.querySummary, issued!.lease.scope.venueIds),
    }));
    await expect(inFlight).resolves.toEqual(resumed);
    store.close();
  });

  it("deduplicates retained corpora and prunes them with terminal lease retention", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      maxPiInvocations: 0,
      retentionLimit: 4,
      store,
    });
    const firstSnapshot = snapshot("retention-0");
    await scheduler.begin(firstSnapshot, "EQUIVALENCE").promise;
    await scheduler.begin(firstSnapshot, "IMPLICATION").promise;
    expect(store.countSearchLeaseCorpora()).toBe(1);
    for (let index = 1; index < 5; index += 1) {
      await scheduler.begin(snapshot(`retention-${index}`), "EQUIVALENCE").promise;
    }
    expect(store.countSearchLeaseCorpora()).toBe(4);
    expect(store.loadSearchLeaseCorpus(firstSnapshot.snapshotIdentity)).toBeNull();
    store.close();
  });

  it("finishes each lens once per immutable snapshot and remains opt-in", async () => {
    const scheduler = new SearchLeaseScheduler({
      intervalMs: 60_000,
      context,
      runFast: async (task) => Object.freeze({
        ...runRecord(task),
        hypotheses: Object.freeze([]),
      }),
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const current = snapshot();
    for (let index = 0; index < 4; index += 1) {
      expect(scheduler.shouldSchedule(current)).toBe(true);
      await scheduler.begin(current, undefined, "SCHEDULE").promise;
    }
    expect(scheduler.shouldSchedule(current)).toBe(false);
    expect(scheduler.projection().runCount).toBe(4);
  });
});
