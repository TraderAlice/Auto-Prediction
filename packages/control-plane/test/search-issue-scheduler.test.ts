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
  type CatalogContextCoverage,
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

function degradedCoverage(): CatalogContextCoverage {
  const body = Object.freeze({
    schemaVersion: "pmh.catalog-context-coverage.v1" as const,
    status: "DEGRADED" as const,
    requestedVenueIds: Object.freeze(["venue-a", "venue-b"]),
    eligibleVenueIds: Object.freeze(["venue-a"]),
    contextVenueIds: Object.freeze(["venue-a"]),
    minimumEligibleVenueCount: 1,
    omittedSources: Object.freeze([Object.freeze({
      venueId: "venue-b",
      reason: "LATEST_REFRESH_FAILED" as const,
      lastObservationRawHash: hashCanonical({ venueId: "venue-b", prior: 1 }),
      lastAttemptAt: "2026-08-01T00:00:00.000Z",
      freshUntil: "2026-08-01T00:15:00.000Z",
    })]),
    authority: "SEARCH_COVERAGE_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, coverageIdentity: hashCanonical(body) });
}

function underrepresentedCoverage(): CatalogContextCoverage {
  const body = Object.freeze({
    schemaVersion: "pmh.catalog-context-coverage.v1" as const,
    status: "FULL" as const,
    requestedVenueIds: Object.freeze(["venue-a", "venue-b"]),
    eligibleVenueIds: Object.freeze(["venue-a", "venue-b"]),
    contextVenueIds: Object.freeze(["venue-a"]),
    minimumEligibleVenueCount: 2,
    omittedSources: Object.freeze([]),
    authority: "SEARCH_COVERAGE_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, coverageIdentity: hashCanonical(body) });
}

function runRecord(task: DiscoveryTask): DiscoveryRunRecord {
  const hypothesis: OpportunityHypothesis = Object.freeze({
    hypothesisId: `hypothesis:${hashCanonical(task.taskId).slice(7, 23)}`,
    workerId: "model:fast",
    thesis: "The two listings may resolve to the same claim.",
    strategyKind: "SAME_CLAIM_CROSS_VENUE",
    relationKind: task.question.includes("TEMPORAL_IMPOSSIBILITY")
      ? "CONDITIONAL"
      : "EQUIVALENT",
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
  it("runs an immutable semantic family issue through a bounded three-listing scope", async () => {
    const wideListings = Object.freeze(Array.from({ length: 5 }, (_, index) => {
      const base = listings[index % listings.length]!;
      return Object.freeze({
        ...base,
        listingRef: `${base.venueId}:temporal-${index}`,
        venueInstrumentId: `temporal-${index}`,
        title: index === 0
          ? "Will Trump be unable to appear before September?"
          : `Will Trump perform public act ${index} in September?`,
        sourceRawHash: hashCanonical({ temporal: index }),
      });
    }));
    const wideSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "family-bounded-context" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: wideListings,
    });
    let selectedRefs: readonly string[] = [];
    let observedQuestion = "";
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: "family" }),
      status: "PASS" as const,
      proposalIds: Object.freeze([hashCanonical({ proposal: "family" })]),
      proposalDetails: Object.freeze([Object.freeze({
        proposalId: hashCanonical({ proposal: "family" }),
        relationKind: "CONDITIONAL" as const,
        listingRefs: selectedRefs,
      })]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const leases = new SearchLeaseScheduler({
      context: (question) => {
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: wideListings,
        });
        observedQuestion = question;
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task) => {
        expect(task.catalogContext?.listings).toHaveLength(3);
        selectedRefs = Object.freeze(task.catalogContext!.listings
          .map((item) => item.listingRef).sort());
        const base = runRecord(task);
        return Object.freeze({
          ...base,
          hypotheses: Object.freeze([Object.freeze({
            ...base.hypotheses[0]!,
            listingRefs: selectedRefs,
            venueIds: Object.freeze([...new Set(
              task.catalogContext!.listings.map((item) => item.venueId),
            )]),
          })]),
        });
      },
      runDeep,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      seedDefaults: false,
      now: () => nowMs,
    });
    const family = Object.freeze({
      semanticFamily: "TEMPORAL_IMPOSSIBILITY" as const,
      intendedRelationKinds: Object.freeze(["CONDITIONAL"] as const),
      falsifiers: Object.freeze([
        "the earlier outcome does not prevent the later act",
        "a recording or proxy satisfies the later contract",
      ]),
      expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 3 as const }),
      maxCorpusListings: 3,
      acceptablePremiseKinds: Object.freeze([
        "SETTLEMENT_INTRINSIC", "CAUSAL_HYPOTHESIS",
      ] as const),
    });
    const createInput = Object.freeze({
      title: "Temporal contradiction probe",
      question: "Search a bounded temporal neighborhood and distinguish impossibility from likelihood.",
      lens: "IMPLICATION" as const,
      family,
      discoveryMode: "HEURISTIC_EXPLORATION" as const,
      cadenceMs: 300_000,
      priority: 5 as const,
    });
    const issue = issues.create(createInput);
    const replay = issues.create(createInput);
    const revised = issues.create(Object.freeze({
      ...createInput,
      question: `${createInput.question} Also test postponement.`,
    }));
    expect(issue).toMatchObject({
      schemaVersion: "pmh.search-issue.v3",
      discoveryMode: "HEURISTIC_EXPLORATION",
      issueId: replay.issueId,
      familyDefinition: {
        semanticFamily: "TEMPORAL_IMPOSSIBILITY",
        maxCorpusListings: 3,
      },
      candidatePolicy: {
        minimumListingRefCount: 2,
        maximumListingRefCount: 3,
        maxCorpusListings: 3,
        candidateSelection: "MODEL_HYPOTHESIS",
      },
    });
    expect(revised.issueId).not.toBe(issue.issueId);

    const checkpoint = await issues.runNow(issue.issueId, wideSnapshot).promise;
    const completed = await leases.awaitDeep(checkpoint.lease.leaseId);
    expect(observedQuestion).toContain("Issue topic: Search a bounded temporal neighborhood");
    expect(observedQuestion).toContain("Semantic family TEMPORAL_IMPOSSIBILITY");
    expect(observedQuestion).toContain("Try to falsify first");
    expect(completed).toMatchObject({
      status: "PASS",
      lease: {
        semanticFamily: "TEMPORAL_IMPOSSIBILITY",
        discoveryMode: "HEURISTIC_EXPLORATION",
        algorithmVersion: "pmh.ai-search-leases.v10",
      },
      fastLane: { candidateListingRefs: selectedRefs },
      deepLane: { status: "PASS", proposalIds: [hashCanonical({ proposal: "family" })] },
      outcome: { proposalCount: 1 },
    });
    expect(runDeep).toHaveBeenCalledTimes(1);
    expect(issues.projection().performance.byFamily).toContainEqual(expect.objectContaining({
      semanticFamily: "TEMPORAL_IMPOSSIBILITY",
      issueCount: 2,
      terminalLeaseCount: 1,
      proposalCount: 1,
      providerRequestAttemptCount: 1,
    }));
    expect(issues.projection()).toMatchObject({
      explorationIssueCount: 2,
      claimMonitoringIssueCount: 0,
      performance: {
        byDiscoveryMode: expect.arrayContaining([expect.objectContaining({
          discoveryMode: "HEURISTIC_EXPLORATION",
          issueCount: 2,
          terminalLeaseCount: 1,
          proposalCount: 1,
          piEscalationCount: 1,
        })]),
      },
    });
  });

  it("enforces a per-family concurrency budget without blocking another family", async () => {
    const pending: Array<{ task: DiscoveryTask; resolve: (record: DiscoveryRunRecord) => void }> = [];
    const leases = new SearchLeaseScheduler({
      context,
      maxPiInvocations: 0,
      concurrencyLimit: 3,
      runFast: (task) => new Promise<DiscoveryRunRecord>((resolve) => {
        pending.push({ task, resolve });
      }),
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      seedDefaults: false,
      tickIntervalMs: 1_000,
      concurrencyLimit: 3,
      familyConcurrencyLimit: 1,
      now: () => nowMs,
    });
    const familyInput = (
      semanticFamily: "TEMPORAL_IMPOSSIBILITY" | "EVENT_CONTAINMENT",
      title: string,
    ) => Object.freeze({
      title,
      question: `Search ${title} and try to falsify it.`,
      lens: "IMPLICATION" as const,
      cadenceMs: 300_000,
      priority: 5 as const,
      discoveryMode: "HEURISTIC_EXPLORATION" as const,
      family: Object.freeze({
        semanticFamily,
        intendedRelationKinds: Object.freeze(["CONDITIONAL"] as const),
        falsifiers: Object.freeze(["the apparent relationship has a valid counterexample"]),
        expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 2 as const }),
        maxCorpusListings: 2,
        acceptablePremiseKinds: Object.freeze(["CAUSAL_HYPOTHESIS"] as const),
      }),
    });
    const temporalA = issues.create(familyInput("TEMPORAL_IMPOSSIBILITY", "temporal A"));
    const temporalB = issues.create(familyInput("TEMPORAL_IMPOSSIBILITY", "temporal B"));
    const containment = issues.create(familyInput("EVENT_CONTAINMENT", "containment"));

    const runs = issues.tick(snapshot("family-concurrency"));
    expect(runs).toHaveLength(2);
    expect(pending).toHaveLength(2);
    const activeIssueIds = new Set(leases.projection().records
      .filter((record) => record.status === "ISSUED")
      .map((record) => record.lease.issueId));
    expect(activeIssueIds.has(containment.issueId)).toBe(true);
    expect(Number(activeIssueIds.has(temporalA.issueId)) +
      Number(activeIssueIds.has(temporalB.issueId))).toBe(1);
    expect(issues.projection()).toMatchObject({
      activeCount: 2,
      concurrencyLimit: 3,
      familyConcurrencyLimit: 1,
    });
    for (const item of pending) item.resolve(runRecord(item.task));
    await Promise.all(runs);
  });

  it("preserves exploration origin across SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-search-origin-"));
    const path = join(directory, "operations.sqlite");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstLeases = new SearchLeaseScheduler({
        context,
        maxPiInvocations: 0,
        runFast: async (task) => Object.freeze({
          ...runRecord(task),
          hypotheses: Object.freeze([]),
        }),
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
        title: "Restart-safe exploration",
        question: "Explore an uncommon temporal neighborhood before forming a claim.",
        lens: "IMPLICATION",
        cadenceMs: 300_000,
        discoveryMode: "HEURISTIC_EXPLORATION",
        family: {
          semanticFamily: "TEMPORAL_IMPOSSIBILITY",
          intendedRelationKinds: ["CONDITIONAL"],
          falsifiers: ["both events can occur without conflict"],
          expectedListingCount: { minimum: 2, maximum: 2 },
          maxCorpusListings: 2,
          acceptablePremiseKinds: ["CAUSAL_HYPOTHESIS"],
        },
      });
      await firstIssues.runNow(issue.issueId, snapshot("origin-restart")).promise;
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondLeases = new SearchLeaseScheduler({
        context,
        maxPiInvocations: 0,
        runFast: async () => { throw new Error("retained terminal lease must not rerun"); },
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      const restored = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        seedDefaults: false,
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      expect(restored.projection().issues[0]).toMatchObject({
        issueId: issue.issueId,
        schemaVersion: "pmh.search-issue.v3",
        discoveryMode: "HEURISTIC_EXPLORATION",
      });
      expect(secondLeases.projection().records[0]?.lease).toMatchObject({
        issueId: issue.issueId,
        algorithmVersion: "pmh.ai-search-leases.v10",
        discoveryMode: "HEURISTIC_EXPLORATION",
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("counts degraded productive scans and omitted venues separately", async () => {
    const leases = new SearchLeaseScheduler({
      context: (question) => Object.freeze({
        catalogContext: context(question, ["venue-a"]),
        coverage: degradedCoverage(),
      }),
      maxPiInvocations: 0,
      runFast: async (task) => {
        const run = runRecord(task);
        return Object.freeze({
          ...run,
          hypotheses: Object.freeze([]),
          workerReports: Object.freeze(run.workerReports!.map((report) =>
            Object.freeze({ ...report, hypothesisCount: 0 })
          )),
        });
      },
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      tickIntervalMs: 1_000,
      now: () => nowMs,
    });
    const issue = issues.projection().issues.find(
      (item) => item.lens === "PARTITION",
    );
    if (issue === undefined) throw new Error("missing partition issue");

    await issues.runNow(issue.issueId, snapshot("degraded-metrics")).promise;
    const performance = issues.projection().performance;
    expect(performance).toMatchObject({
      terminalLeaseCount: 1,
      coverageManifestCount: 1,
      degradedContextCount: 1,
      degradedPassCount: 1,
      insufficientCoverageFailureCount: 0,
      omittedVenueCount: 1,
    });
    expect(performance.byIssue.find((item) => item.issueId === issue.issueId))
      .toMatchObject({
        degradedContextCount: 1,
        degradedPassCount: 1,
        omittedVenueCount: 1,
      });
  });

  it("counts a full-source but underrepresented context as insufficient", async () => {
    const runFast = vi.fn(async (task: DiscoveryTask) => runRecord(task));
    const leases = new SearchLeaseScheduler({
      context: (question) => Object.freeze({
        catalogContext: context(question, ["venue-a"]),
        coverage: underrepresentedCoverage(),
      }),
      maxPiInvocations: 0,
      runFast,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      tickIntervalMs: 1_000,
      now: () => nowMs,
    });
    const issue = issues.projection().issues.find(
      (item) => item.lens === "IMPLICATION",
    );
    if (issue === undefined) throw new Error("missing implication issue");

    const record = await issues.runNow(
      issue.issueId,
      snapshot("underrepresented-metrics"),
    ).promise;
    expect(record.status).toBe("FAILED");
    expect(runFast).not.toHaveBeenCalled();
    expect(issues.projection().performance).toMatchObject({
      coverageManifestCount: 1,
      degradedContextCount: 0,
      insufficientCoverageFailureCount: 1,
      omittedVenueCount: 0,
    });
  });

  it("rotates a single-listing result without candidate notification and excludes a legacy misclassification", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const runDeep = vi.fn();
    const leases = new SearchLeaseScheduler({
      context,
      runFast: async (task) => {
        const run = runRecord(task);
        const candidate = run.hypotheses[0];
        if (candidate === undefined) throw new Error("missing candidate");
        return Object.freeze({
          ...run,
          hypotheses: Object.freeze([
            Object.freeze({
              ...candidate,
              venueIds: Object.freeze(["venue-a"]),
              listingRefs: Object.freeze(["venue-a:pizza"]),
            }),
          ]),
          diagnostics: Object.freeze(["DeepSeek request timed out"]),
        });
      },
      runDeep,
      store,
      now: () => nowMs,
    });
    const issues = new SearchIssueScheduler({
      leaseScheduler: leases,
      tickIntervalMs: 1_000,
      store,
      now: () => nowMs,
    });
    const issue = issues.projection().issues.find((item) =>
      item.title === "Cross-venue same claim"
    );
    if (issue === undefined) throw new Error("missing general search issue");

    const record = await issues.runNow(issue.issueId, snapshot()).promise;
    expect(record).toMatchObject({
      deepLane: { reason: "NOT_MULTI_LISTING" },
      outcome: { novelCandidate: false, hypothesisCount: 1 },
      lineage: { noveltySignature: null },
    });
    expect(issues.projection()).toMatchObject({
      unreadNotificationCount: 0,
      performance: {
        terminalLeaseCount: 1,
        novelCandidateCount: 0,
        noLeadSemanticScopeCount: 1,
      },
    });
    expect(runDeep).not.toHaveBeenCalled();

    const { artifactHash: _artifactHash, ...recordBody } = record;
    const { providerTelemetry: _providerTelemetry, ...legacyFastLane } = record.fastLane;
    const legacyBody = Object.freeze({
      ...recordBody,
      fastLane: Object.freeze(legacyFastLane),
      lineage: Object.freeze({
        ...record.lineage,
        noveltySignature: hashCanonical({ legacy: record.lease.leaseId }),
      }),
      outcome: Object.freeze({
        ...record.outcome,
        novelCandidate: true,
      }),
    });
    const legacyStore = new SqliteOperationalStore(":memory:");
    legacyStore.saveSearchLeaseRecord(Object.freeze({
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    }), 40);

    const restoredLeases = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      store: legacyStore,
      now: () => nowMs,
    });
    expect(restoredLeases.projection().records[0]).toMatchObject({
      outcome: { novelCandidate: true },
      fastLane: { candidateListingRefs: ["venue-a:pizza"] },
      deepLane: { reason: "NOT_MULTI_LISTING" },
    });
    const restoredIssues = new SearchIssueScheduler({
      leaseScheduler: restoredLeases,
      tickIntervalMs: 1_000,
      store: legacyStore,
      now: () => nowMs,
    });
    expect(restoredIssues.projection().performance).toMatchObject({
      terminalLeaseCount: 1,
      novelCandidateCount: 0,
      noLeadSemanticScopeCount: 1,
      providerRequestAttemptCount: 1,
      providerFailureCount: 1,
      providerFailureRateBps: 10_000,
      providerNativeTelemetryLeaseCount: 0,
      providerLegacyDerivedLeaseCount: 1,
    });
    legacyStore.close();
    store.close();
  });

  it("seeds durable issues, fills three priority slots, and notifies only novel signatures", async () => {
    const pending: Array<{ task: DiscoveryTask; resolve: (record: DiscoveryRunRecord) => void }> = [];
    const runFast = vi.fn((task: DiscoveryTask) => new Promise<DiscoveryRunRecord>((resolve) => {
      pending.push({ task, resolve });
    }));
    const runDeep = vi.fn(async (_snapshot: unknown, question: string) => Object.freeze({
      runId: hashCanonical({ deep: 1 }),
      status: "PASS" as const,
      proposalIds: Object.freeze([hashCanonical({ proposal: 1 })]),
      proposalDetails: Object.freeze([Object.freeze({
        proposalId: hashCanonical({ proposal: 1 }),
        relationKind: question.includes("Semantic family TEMPORAL_IMPOSSIBILITY")
          ? "CONDITIONAL" as const
          : "EQUIVALENT" as const,
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
      issueCount: 10,
      enabledIssueCount: 10,
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
    await Promise.all(
      leases.projection().records
        .filter((record) => record.deepLane.status === "PENDING" ||
          record.deepLane.status === "RUNNING")
        .map((record) => leases.awaitDeep(record.lease.leaseId)),
    );

    const completed = issues.projection();
    expect(completed.activeCount).toBe(0);
    expect(completed.issues.reduce((sum, issue) => sum + issue.runCount, 0)).toBe(3);
    expect(completed.unreadNotificationCount).toBe(2);
    expect(runDeep).toHaveBeenCalledTimes(2);
    expect(completed.performance).toMatchObject({
      measurementWindow: "RETAINED_TERMINAL_LEASES",
      retainedLeaseLimit: 40,
      terminalLeaseCount: 3,
      novelCandidateCount: 2,
      duplicateCount: 0,
      piEscalationCount: 2,
      economicGateRequiredCount: 1,
      economicGatePositiveCount: 0,
      economicGateBlockedCount: 1,
      piAvoidedCount: 1,
      modelSelectionRequiredCount: 2,
      modelSelectedCandidateCount: 1,
      modelSelectionMissCount: 1,
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
      proposalCount: 2,
      evidenceGapCount: 0,
      providerRequestAttemptCount: 3,
      providerFailureCount: 0,
      providerFailureRateBps: 0,
      providerNativeTelemetryLeaseCount: 3,
      providerLegacyDerivedLeaseCount: 0,
      novelCandidateRateBps: 6_666,
      duplicateRateBps: 0,
      piEscalationRateBps: 6_666,
      economicGatePositiveRateBps: 0,
    });
    expect(completed.performance.byIssue).toHaveLength(10);
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
    expect(completed.storage.issues).toMatchObject({ durable: false, schemaVersion: 63 });
    expect(leases.projection()).toMatchObject({
      retainedCorpusCount: 1,
      recoverableIssuedCount: 0,
      missingCorpusIssuedCount: 0,
      corpusStorage: { durable: false, schemaVersion: 63 },
    });

    const restored = new SearchIssueScheduler({
      leaseScheduler: leases,
      store,
      seedDefaults: false,
      now: () => nowMs + 1_000,
    });
    expect(restored.projection()).toMatchObject({
      issueCount: 10,
      unreadNotificationCount: 2,
      performance: { terminalLeaseCount: 3, duplicateCount: 0 },
    });
    for (const notification of restored.projection().notifications) {
      restored.acknowledge(notification.notificationId);
    }
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

    expect(issue.discoveryMode).toBeUndefined();
    expect(leases.projection().records[0]?.lease.discoveryMode).toBe("CLAIM_MONITORING");
    expect(issues.projection()).toMatchObject({
      explorationIssueCount: 0,
      claimMonitoringIssueCount: 1,
      performance: {
        byDiscoveryMode: expect.arrayContaining([expect.objectContaining({
          discoveryMode: "CLAIM_MONITORING",
          terminalLeaseCount: 1,
        })]),
      },
    });
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

  it("notifies a grounded falsification without presenting it as a candidate", async () => {
    const leases = new SearchLeaseScheduler({
      context,
      runFast: async (task) => {
        const base = runRecord(task);
        const findingIdentity = hashCanonical({
          schemaVersion: "pmh.discovery-falsification-finding.v1",
          relationKind: "EQUIVALENCE",
          listingRefs: ["venue-a:pizza", "venue-b:pizza"],
        });
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-falsification.v2" as const,
          findingIdentity,
          workerId: "model:fast",
          taskId: task.taskId,
          claim: "The two pizza contracts are equivalent.",
          reason: "Their settlement windows differ.",
          relationKind: "EQUIVALENCE" as const,
          listingRefs: Object.freeze(["venue-a:pizza", "venue-b:pizza"]),
          claimSearchTerms: Object.freeze(["Trump pizza", "August"]),
          authority: "SEARCH_NEGATIVE_EVIDENCE_ONLY" as const,
          semanticDecisionAuthority: false as const,
          certificateAuthority: false as const,
          executionAuthority: false as const,
          externalWriteAuthority: false as const,
          valueMovingAuthority: false as const,
        });
        return Object.freeze({
          ...base,
          hypotheses: Object.freeze([]),
          falsifications: Object.freeze([Object.freeze({
            ...body,
            falsificationId: hashCanonical(body),
          })]),
          workerReports: Object.freeze(base.workerReports!.map((report) =>
            Object.freeze({ ...report, hypothesisCount: 0, falsificationCount: 1 })
          )),
        });
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
      title: "Falsification notice",
      question: "Test the pizza equivalence claim.",
      lens: "EQUIVALENCE",
      cadenceMs: 300_000,
    });

    const record = await issues.runNow(issue.issueId, snapshot("falsification-notice")).promise;
    const projection = issues.projection();

    expect(record.outcome).toMatchObject({ hypothesisCount: 0, falsificationCount: 1 });
    expect(projection.performance).toMatchObject({
      hypothesisCount: 0,
      falsificationCount: 1,
      novelCandidateCount: 0,
      piEscalationCount: 0,
    });
    expect(projection.notifications).toHaveLength(1);
    expect(projection.notifications[0]).toMatchObject({
      kind: "FALSIFICATION_RECORDED",
      status: "UNREAD",
      title: "Falsification notice: relation falsified",
    });
    expect(projection.notifications[0]?.summary).toContain("no proposal or Pi work");
  });

  it("persists one exact-ref inspiration follow-up and exhausts it without recursion", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-inspiration-restart-"));
    const databasePath = join(directory, "operational.sqlite");
    const store = new SqliteOperationalStore(databasePath);
    const seenTasks: DiscoveryTask[] = [];
    const leases = new SearchLeaseScheduler({
      intervalMs: 60_000,
      context,
      maxPiInvocations: 0,
      registeredVenueIds: ["venue-a", "venue-b"],
      store,
      runFast: async (task) => {
        seenTasks.push(task);
        const inspirationBody = Object.freeze({
          schemaVersion: "pmh.discovery-inspiration.v1" as const,
          contentIdentity: hashCanonical({
            schemaVersion: "pmh.discovery-inspiration-content.v1",
            listingRefs: Object.freeze(["venue-a:pizza", "venue-b:pizza"]),
            suggestedLens: "IMPLICATION",
            suggestedSemanticFamily: "EVENT_CONTAINMENT",
            sourceTrailheadIdentity: task.searchAssignment?.sourceTrailheadIdentity ?? null,
          }),
          workerId: "model:fast",
          taskId: task.taskId,
          observation: "The same named event is expressed through nested deadlines.",
          listingRefs: Object.freeze(["venue-a:pizza", "venue-b:pizza"]),
          searchSignals: Object.freeze(["nested deadline", "same event"]),
          sourceLens: task.searchAssignment!.lens,
          sourceSemanticFamily: task.searchAssignment!.semanticFamily,
          sourceTrailheadIdentity: task.searchAssignment!.sourceTrailheadIdentity,
          suggestedLens: "IMPLICATION" as const,
          suggestedSemanticFamily: "EVENT_CONTAINMENT" as const,
          inspirationDepth: task.searchAssignment!.inspirationDepth,
          authority: "SEARCH_ROUTING_ONLY" as const,
          semanticDecisionAuthority: false as const,
          probabilityAuthority: false as const,
          certificateAuthority: false as const,
          executionAuthority: false as const,
          externalWriteAuthority: false as const,
          valueMovingAuthority: false as const,
        });
        const inspiration = Object.freeze({
          ...inspirationBody,
          inspirationId: hashCanonical(inspirationBody),
        });
        return Object.freeze({
          runId: hashCanonical({ taskId: task.taskId }),
          taskId: task.taskId,
          startedAt: "2026-08-01T00:00:01.000Z",
          completedAt: "2026-08-01T00:00:02.000Z",
          workerIds: Object.freeze(["model:fast"]),
          hypotheses: Object.freeze([]),
          falsifications: Object.freeze([]),
          inspirations: task.searchAssignment?.inspirationDepth === 0
            ? Object.freeze([inspiration])
            : Object.freeze([]),
          diagnostics: Object.freeze([]),
          executionAuthority: false,
          question: task.question,
          venueIds: task.venueIds,
        });
      },
      now: () => nowMs,
    });
    const scheduler = new SearchIssueScheduler({
      leaseScheduler: leases,
      tickIntervalMs: 60_000,
      seedDefaults: false,
      store,
      now: () => nowMs,
    });
    const issue = scheduler.create({
      title: "Physical event exploration",
      question: "Explore a rare physical-event neighborhood.",
      lens: "MECHANISM",
      family: {
        semanticFamily: "PHYSICAL_CO_OCCURRENCE",
        intendedRelationKinds: ["RELATED"],
        falsifiers: ["Different subjects or event windows"],
        expectedListingCount: { minimum: 2, maximum: 2 },
        maxCorpusListings: 8,
        acceptablePremiseKinds: ["TRADED_OUTCOME"],
      },
      discoveryMode: "HEURISTIC_EXPLORATION",
      cadenceMs: 60_000,
    });
    await scheduler.runNow(issue.issueId, snapshot()).promise;
    expect(scheduler.projection()).toMatchObject({
      inspirationCount: 1,
      queuedInspirationCount: 1,
      notifications: [{ kind: "INSPIRATION_RECORDED" }],
    });
    const followups = scheduler.tick(snapshot());
    expect(followups).toHaveLength(1);
    await followups[0];
    const inbox = scheduler.projection().inspirations;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      status: "EXHAUSTED",
      downstreamHypothesisCount: 0,
      downstreamFalsificationCount: 0,
    });
    expect(seenTasks).toHaveLength(2);
    expect(seenTasks[1]?.searchAssignment).toMatchObject({
      lens: "IMPLICATION",
      semanticFamily: "EVENT_CONTAINMENT",
      inspirationDepth: 1,
    });
    expect(seenTasks[1]?.catalogContext?.listings.map((item) => item.listingRef))
      .toEqual(["venue-a:pizza", "venue-b:pizza"]);
    expect(scheduler.tick(snapshot())).toHaveLength(0);
    store.close();

    const reopenedStore = new SqliteOperationalStore(databasePath);
    const reopenedLeases = new SearchLeaseScheduler({
      intervalMs: 60_000,
      context,
      maxPiInvocations: 0,
      registeredVenueIds: ["venue-a", "venue-b"],
      runFast: async () => {
        throw new Error("restart replay must not spend another Agent request");
      },
      store: reopenedStore,
      now: () => nowMs,
    });
    const reopenedScheduler = new SearchIssueScheduler({
      leaseScheduler: reopenedLeases,
      tickIntervalMs: 60_000,
      seedDefaults: false,
      store: reopenedStore,
      now: () => nowMs,
    });
    expect(reopenedScheduler.projection().inspirations).toMatchObject([
      { status: "EXHAUSTED", followupLeaseId: expect.stringMatching(/^sha256:/u) },
    ]);
    expect(reopenedScheduler.tick(snapshot())).toHaveLength(0);
    reopenedStore.close();
    await rm(directory, { recursive: true, force: true });
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
        issueCount: 11,
        enabledIssueCount: 10,
        storage: { issues: { durable: true, schemaVersion: 63 } },
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
        issueCount: 11,
        enabledIssueCount: 9,
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

  it("retires obsolete default family revisions without pausing operator-owned issues", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-search-family-supersession-"));
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
      const family = Object.freeze({
        semanticFamily: "TEMPORAL_IMPOSSIBILITY" as const,
        intendedRelationKinds: Object.freeze([
          "MUTUALLY_EXCLUSIVE", "IMPLIES", "CONDITIONAL", "CONFLICTING",
        ] as const),
        falsifiers: Object.freeze([
          "the earlier event need not prevent the later act",
          "the later contract permits a proxy, recording, postponement, or changed identity",
          "the settlement windows overlap differently than the titles imply",
        ]),
        expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 4 as const }),
        maxCorpusListings: 18,
        acceptablePremiseKinds: Object.freeze([
          "SETTLEMENT_INTRINSIC", "TRADED_OUTCOME", "EXTERNAL_OBSERVATION", "CAUSAL_HYPOTHESIS",
        ] as const),
      });
      const obsolete = first.create({
        title: "Temporal impossibility",
        question: "Find contracts where one settled outcome would make a later required appearance, publication, certification, office-holding, or personal act impossible. Separate logical impossibility from merely reduced likelihood.",
        lens: "IMPLICATION",
        cadenceMs: 20 * 60_000,
        priority: 4,
        family,
      });
      const operatorIssue = first.create({
        title: "Operator temporal trailhead",
        question: "Search a named operator-owned temporal hypothesis without adopting default lifecycle management.",
        lens: "IMPLICATION",
        cadenceMs: 20 * 60_000,
        priority: 3,
        family,
      });
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondLeases = new SearchLeaseScheduler({
        context,
        runFast: async () => { throw new Error("must not run while reconciling defaults"); },
        maxPiInvocations: 0,
        store: secondStore,
      });
      const restored = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        store: secondStore,
        now: () => nowMs + 1_000,
      });
      const projection = restored.projection();
      const current = projection.issues.find((issue) =>
        issue.defaultKey === "temporal-impossibility-v1" &&
        issue.supersededByIssueId === null
      )!;
      expect(current).toMatchObject({ enabled: true, priority: 5 });
      expect(projection.issues.find((issue) => issue.issueId === obsolete.issueId)).toMatchObject({
        enabled: false,
        defaultKey: "temporal-impossibility-v1",
        supersededByIssueId: current.issueId,
      });
      const retainedOperatorIssue = projection.issues.find(
        (issue) => issue.issueId === operatorIssue.issueId,
      )!;
      expect(retainedOperatorIssue.enabled).toBe(true);
      expect(retainedOperatorIssue.defaultKey).toBeUndefined();
      expect(retainedOperatorIssue.supersededByIssueId).toBeUndefined();
      expect(projection).toMatchObject({
        issueCount: 12,
        enabledIssueCount: 11,
        defaultManagedIssueCount: 6,
        supersededIssueCount: 1,
      });
      expect(() => restored.setEnabled(obsolete.issueId, true)).toThrow(
        "superseded default search issue cannot be re-enabled",
      );

      const supersededHash = restored.projection().issues.find(
        (issue) => issue.issueId === obsolete.issueId,
      )!.artifactHash;
      const restarted = new SearchIssueScheduler({
        leaseScheduler: secondLeases,
        store: secondStore,
        now: () => nowMs + 2_000,
      });
      expect(restarted.projection().issues.find(
        (issue) => issue.issueId === obsolete.issueId,
      )?.artifactHash).toBe(supersededHash);
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
      }).user_version).toBe(63);
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
