import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashBytes, hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgenticModelDiscoveryWorker,
  candidateWatchSources,
  AnonymousSimulationMaterializerDesk,
  buildLiveStudioProjection,
  buildStudioProjection,
  buildStudioProjectionSnapshot,
  createPiInvestigatorRuntime,
  DiscoveryLedger,
  DiscoveryAgentSession,
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  InvestigationDesk,
  researchDecisionEpisodeId,
  type DiscoveryTask,
  type CandidateWatchRefreshRecord,
  type PiProcessResult,
  type ResearchDecisionEpisode,
  type StoredAnonymousSimulationMaterialization,
  type StoredCandidateBookObservation,
} from "../src/index.js";
import {
  agentTask,
  proposalInput,
  TEST_LISTING_REF,
  TEST_LISTING_REFS,
} from "./model-agent-fixtures.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pmh-operational-"));
  tempDirectories.push(directory);
  return join(directory, "control-plane.sqlite");
}

function task(taskId: string, question = "Will the fixture resolve yes?"):
  DiscoveryTask {
  return {
    taskId,
    question,
    venueIds: ["fixture-alpha", "fixture-beta"],
    maxHypotheses: 5,
    deadlineEpochMs: 2_000,
  };
}

function researchDecisionEpisode(
  capturedAt = "2026-08-12T12:00:00.000Z",
): ResearchDecisionEpisode {
  const allocationProjectionIdentity = hashCanonical({ allocation: "store" });
  const allocationActionId = hashCanonical({ action: "store" });
  const targetId = hashCanonical({ target: "store" });
  const captureRef = "operator:store-test";
  return {
    schemaVersion: "pmh.research-decision-episode.v1",
    episodeId: researchDecisionEpisodeId({
      allocationProjectionIdentity,
      allocationActionId,
      targetId,
      captureRef,
    }),
    capturedAt,
    captureRef,
    allocationProjectionIdentity,
    allocationPolicyIdentity: hashCanonical({ policy: "store" }),
    allocationObservedAt: "2026-08-12T12:00:00.000Z",
    allocationActionId,
    allocationActionKind: "EXPLORE_NEW_FAMILY",
    allocationLane: "EXPLORATION",
    actionTargetProjectionIdentity: hashCanonical({ projection: "target-store" }),
    targetId,
    workItemId: hashCanonical({ work: "store" }),
    proposalId: null,
    requirementId: null,
    sourceTaskId: hashCanonical({ task: "store" }),
    downstreamSystem: "RELATION_DISCOVERY",
    baseline: {
      valueStage: "UNATTEMPTED",
      targetState: "READY_RELATION_DISCOVERY",
      runIds: [],
      positiveFindingIds: [],
      counterexampleIds: [],
      semanticReviewJobIds: [],
      probabilityJobIds: [],
      exactTargetArtifactRefs: [],
      cost: {
        knownInputTokens: "0",
        knownOutputTokens: "0",
        knownReasoningTokens: "0",
        knownWallClockMs: "0",
        unknownInputInvocationCount: 0,
        unknownOutputInvocationCount: 0,
        unknownReasoningInvocationCount: 0,
        incompleteWallClockRunCount: 0,
        providerRequestCount: 0,
        toolCallCount: 0,
        fetchAttemptCount: 0,
        interpretationAttemptCount: 0,
      },
      usageComplete: true,
    },
    authority: "RESEARCH_DECISION_EVIDENCE_ONLY",
    providerRequestsStartedByCapture: 0,
    modelInvocationsStartedByCapture: 0,
    fetchesStartedByCapture: 0,
    campaignsCreatedByCapture: 0,
    runsCreatedByCapture: 0,
    schedulerDispatchesStartedByCapture: 0,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  };
}

function noveltyBoundResearchDecisionEpisode(): ResearchDecisionEpisode {
  const legacy = researchDecisionEpisode();
  const noveltyReason = "NEW_STABLE_FAMILY" as const;
  return {
    ...legacy,
    schemaVersion: "pmh.research-decision-episode.v2",
    noveltyReason,
    baseline: {
      ...legacy.baseline,
      counterexampleCount: 0,
      noFindingTerminalRunCount: 0,
      successfulWithoutAcceptedResultCount: 0,
    },
    episodeId: researchDecisionEpisodeId({
      allocationProjectionIdentity: legacy.allocationProjectionIdentity,
      allocationActionId: legacy.allocationActionId,
      targetId: legacy.targetId,
      captureRef: legacy.captureRef,
      noveltyReason,
    }),
  };
}

function investigationTask(
  taskId: string,
  question = "Investigate the fixture",
): DiscoveryTask {
  const listings = [
    {
      listingRef: "gemini-predictions:fixture-a",
      venueId: "gemini-predictions",
      venueInstrumentId: "fixture-a",
      title: "Fixture A",
      description: "Bounded fixture",
      status: "OPEN",
      mechanism: "CLOB",
      closesAt: null,
      rulesText: null,
      outcomes: [{ label: "Yes", indicativePrice: "0.5" }],
      sourceKind: "VERIFIED_FIXTURE" as const,
      sourceReceivedAt: "2026-07-31T00:00:00.000Z",
      sourceRawHash: hashCanonical({ source: "fixture-a" }),
      protocolIdentity: "prediction-markets-v1:test",
    },
  ];
  const contextBody = {
    schemaVersion: "pmh.discovery-catalog-context.v2" as const,
    source: "VERIFIED_FIXTURE_CATALOGS" as const,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    listings,
  };
  return {
    taskId,
    question,
    venueIds: ["gemini-predictions"],
    maxHypotheses: 3,
    deadlineEpochMs: Date.now() + 30_000,
    catalogContext: {
      ...contextBody,
      contextIdentity: hashCanonical(contextBody),
    },
  };
}

function piResult(summary = "Bounded investigation complete."): PiProcessResult {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      summary,
      candidateListingRefs: [],
      findings: [],
      missingEvidence: ["Independent resolution evidence"],
    }),
    stderr: "",
    timedOut: false,
    outputLimitExceeded: false,
  };
}

function catalogObservation(
  receivedAt = "2026-08-01T03:20:00.000Z",
  venueId = "kalshi",
) {
  const bytes = new TextEncoder().encode('{"markets":[]}');
  const body = {
    schemaVersion: "pmh.catalog-observation.v1" as const,
    venueId,
    protocolIdentity: "trade-api-v2:test",
    sourceUrl: `https://example.test/${venueId}/markets`,
    receivedAt,
    httpStatus: 200 as const,
    contentType: "application/json",
    etag: null,
    lastModified: null,
    rawHash: hashBytes(bytes),
    byteLength: bytes.byteLength.toString(),
    listingCount: 0,
    listingIdentity: hashCanonical([]),
    acquisition: {
      method: "GET" as const,
      credentialsUsed: false as const,
      valueMovingOperation: false as const,
    },
  };
  return {
    record: {
      ...body,
      observationId: `catalog-observation:${hashCanonical(body).slice(7)}`,
    },
    bytes,
  };
}

function candidateBookObservation(
  venueId: "polymarket-global" | "limitless",
  receivedAt = "2026-08-01T06:20:00.000Z",
): StoredCandidateBookObservation {
  const source = candidateWatchSources.find(
    (candidate) => candidate.venueId === venueId,
  );
  if (source === undefined) throw new Error("missing candidate watch source");
  const bytes = new TextEncoder().encode(
    venueId === "polymarket-global"
      ? '{"hash":"generation:test","bids":[],"asks":[]}'
      : '{"bids":[],"asks":[]}',
  );
  const refreshId = `candidate-watch-refresh:${hashCanonical({ receivedAt }).slice(7)}`;
  const body = {
    schemaVersion: "pmh.candidate-book-observation.v1" as const,
    refreshId,
    candidateClaimIdentity: hashCanonical({ claim: "fixture" }),
    venueId,
    protocolIdentity: source.protocolIdentity,
    sourceUrl: source.sourceUrl,
    receivedAt,
    httpStatus: 200 as const,
    contentType: "application/json",
    etag: null,
    lastModified: null,
    rawHash: hashBytes(bytes),
    byteLength: bytes.byteLength.toString(),
    nativeGeneration:
      venueId === "polymarket-global" ? "generation:test" : null,
    acquisition: {
      method: "GET" as const,
      credentialsUsed: false as const,
      valueMovingOperation: false as const,
    },
  };
  return {
    record: {
      ...body,
      observationId:
        `candidate-book-observation:${hashCanonical(body).slice(7)}`,
    },
    bytes,
  };
}

function candidateWatchRefresh(
  attemptedAt = "2026-08-01T06:30:00.000Z",
): CandidateWatchRefreshRecord {
  return {
    schemaVersion: "pmh.candidate-watch-refresh.v1",
    refreshId:
      `candidate-watch-refresh:${hashCanonical({ attemptedAt }).slice(7)}`,
    candidateClaimIdentity: hashCanonical({ claim: "fixture" }),
    attemptedAt,
    completedAt: attemptedAt,
    status: "DEGRADED",
    diagnostic: null,
    decision: null,
    sources: [
      {
        venueId: "limitless",
        status: "FAILED",
        observationId: null,
        diagnostic: "fixture outage",
      },
      {
        venueId: "polymarket-global",
        status: "FAILED",
        observationId: null,
        diagnostic: "fixture outage",
      },
    ],
    effects: {
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    },
  };
}

function anonymousSimulationMaterialization(
  completedAt = "2026-08-01T08:00:00.000Z",
): StoredAnonymousSimulationMaterialization {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ book: completedAt, asks: [] }),
  );
  const sourceBody = {
    kind: "BOOK" as const,
    venueId: "fixture-venue",
    instrumentId: `instrument:${completedAt}`,
    protocolIdentity: "fixture-book-rest:v1",
    sourceUrl: `https://example.test/books/${encodeURIComponent(completedAt)}`,
    receivedAt: completedAt,
    httpStatus: 200 as const,
    contentType: "application/json",
    rawHash: hashBytes(bytes),
    byteLength: bytes.byteLength.toString(),
    nativeGeneration: null,
    acquisition: {
      method: "GET" as const,
      credentialsUsed: false as const,
      valueMovingOperation: false as const,
    },
  };
  const source = {
    ...sourceBody,
    sourceId: hashCanonical(sourceBody),
  };
  const recordBody = {
    schemaVersion: "pmh.anonymous-simulation-materialization.v1" as const,
    opportunityId: `opportunity:${completedAt}`,
    relationConstraintHash: hashCanonical({ relation: completedAt }),
    semanticDecisionId: hashCanonical({ decision: completedAt }),
    portfolioId: hashCanonical({ portfolio: completedAt }),
    requestedQuantity: "1",
    attemptedAt: completedAt,
    completedAt,
    status: "BLOCKED" as const,
    diagnostic: "fixture evidence is intentionally non-simulatable",
    legs: ["left", "right"].map((legId) => ({
      legId,
      venueId: "fixture-venue",
      instrumentId: source.instrumentId,
      outcome: legId === "left" ? ("TRUE" as const) : ("FALSE" as const),
      status: "BLOCKED" as const,
      blocker: "BOOK_SCHEMA_INVALID" as const,
      diagnostic: "fixture book has no levels",
      bookSourceId: source.sourceId,
      feeSourceId: null,
      askLevelCount: 0,
      feeModel: null,
      feeQualification: null,
    })),
    sources: [source],
    authority: "ANONYMOUS_RESEARCH_MATERIALIZER" as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return {
    record: {
      ...recordBody,
      materializationId: hashCanonical(recordBody),
    },
    rawSources: [{ record: source, bytes }],
  };
}

function durableDesk(
  store: SqliteOperationalStore,
  onRun: () => void = () => undefined,
  retentionLimit = 10,
): InvestigationDesk {
  const runtime = createPiInvestigatorRuntime(
    { DEEPSEEK_API_KEY: "test-only-key" },
    {
      runner: async () => {
        onRun();
        return piResult();
      },
    },
  );
  return new InvestigationDesk(
    runtime.investigator,
    retentionLimit,
    store,
  );
}

async function recordTask(
  ledger: DiscoveryLedger,
  discoveryTask: DiscoveryTask,
): Promise<void> {
  const pool = new DiscoveryPool(
    [new HeuristicDiscoveryWorker()],
    () => 1_000,
  );
  ledger.record(discoveryTask, await pool.run(discoveryTask));
}

describe("SQLite operational store", () => {
  it("restores one disposable bounded Studio snapshot and ignores tampering", async () => {
    const path = await databasePath();
    const first = new SqliteOperationalStore(path);
    const snapshot = buildStudioProjectionSnapshot({
      projection: buildLiveStudioProjection(
        buildStudioProjection({ workers: [], activeRuns: 0 }),
      ),
      sourceProjectionRevision: 9n,
      materializedAt: "2026-08-13T00:00:00.000Z",
    });
    expect(first.saveStudioProjectionSnapshot(snapshot)).toEqual(snapshot);
    first.close();

    const second = new SqliteOperationalStore(path);
    expect(second.loadStudioProjectionSnapshot()).toEqual(snapshot);
    second.close();

    const database = new DatabaseSync(path);
    database.prepare(
      `UPDATE studio_projection_snapshot SET record_hash = ? WHERE singleton = 1`,
    ).run(hashCanonical({ tampered: true }));
    database.close();
    const third = new SqliteOperationalStore(path);
    expect(third.loadStudioProjectionSnapshot()).toBeNull();
    third.close();
  });

  it("restores bounded discovery state in WAL mode across process lifetimes", async () => {
    const path = await databasePath();
    const firstStore = new SqliteOperationalStore(path);
    const firstLedger = new DiscoveryLedger(25, firstStore);
    await recordTask(firstLedger, task("task:persistent"));
    expect(firstLedger.projection()).toMatchObject({
      runCount: 1,
      storage: {
        mode: "SQLITE_WAL",
        durable: true,
        schemaVersion: 47,
        idempotencyKey: "taskId",
      },
    });
    const firstRun = firstLedger.projection().runs[0];
    firstLedger.close();

    const secondStore = new SqliteOperationalStore(path);
    const secondLedger = new DiscoveryLedger(25, secondStore);
    expect(secondLedger.projection().runs).toEqual([firstRun]);
    expect(secondLedger.findByTaskId("task:persistent")).toMatchObject({
      taskId: "task:persistent",
      question: "Will the fixture resolve yes?",
      executionAuthority: false,
    });
    expect(
      secondLedger.findByTaskId("task:persistent")?.catalogContext,
    ).toBeUndefined();
    secondLedger.close();
  });

  it("restores the exact discovery-agent effect journal across restart", async () => {
    const path = await databasePath();
    const session = new DiscoveryAgentSession("model:durable-agent", agentTask, 24);
    session.inspectListings({ listingRefs: TEST_LISTING_REFS });
    session.recordHypothesis(proposalInput());
    session.completeSearch({ reason: "Persist the qualified tool loop." });
    const result = session.finish({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 3,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    const worker = new AgenticModelDiscoveryWorker(
      "model:durable-agent",
      "provider/cheap",
      { async run() { return result; } },
    );
    const first = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    first.record(agentTask, await new DiscoveryPool([worker]).run(agentTask));
    first.close();

    const restored = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    expect(restored.findByTaskId(agentTask.taskId)?.workerReports?.[0]?.agentTrace)
      .toEqual(result.trace);
    restored.close();
  });

  it("retains an exact catalog snapshot for server-side handoff without projecting it", async () => {
    const path = await databasePath();
    const taskWithContext = investigationTask("task:context-handoff");
    const firstLedger = new DiscoveryLedger(
      25,
      new SqliteOperationalStore(path),
    );
    await recordTask(firstLedger, taskWithContext);
    expect(firstLedger.findByTaskId(taskWithContext.taskId)?.catalogContext).toEqual(
      taskWithContext.catalogContext,
    );
    expect(firstLedger.projection().runs[0]).not.toHaveProperty(
      "catalogContext",
    );
    expect(firstLedger.projection().runs[0]).toMatchObject({
      catalogContextRetained: true,
    });
    firstLedger.close();

    const restored = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    expect(restored.findByTaskId(taskWithContext.taskId)?.catalogContext).toEqual(
      taskWithContext.catalogContext,
    );
    expect(restored.projection().runs[0]).not.toHaveProperty("catalogContext");
    expect(restored.projection().runs[0]).toMatchObject({
      catalogContextRetained: true,
    });
    restored.close();
  });

  it("enforces retention in the durable transaction", async () => {
    const path = await databasePath();
    const ledger = new DiscoveryLedger(1, new SqliteOperationalStore(path));
    await recordTask(ledger, task("task:first", "First fixture question?"));
    await recordTask(ledger, task("task:second", "Second fixture question?"));
    expect(ledger.projection().runs.map((run) => run.taskId)).toEqual([
      "task:second",
    ]);
    ledger.close();

    const restored = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    expect(restored.projection().runs.map((run) => run.taskId)).toEqual([
      "task:second",
    ]);
    expect(restored.findByTaskId("task:first")).toBeUndefined();
    restored.close();
  });

  it("fails closed when persisted JSON no longer matches its content hash", async () => {
    const path = await databasePath();
    const ledger = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    await recordTask(ledger, task("task:tamper"));
    ledger.close();

    const database = new DatabaseSync(path);
    database
      .prepare(
        "UPDATE discovery_runs SET record_json = json_set(record_json, '$.question', 'tampered')",
      )
      .run();
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.load(25)).toThrow(/identity mismatch/);
    reopened.close();
  });

  it("rejects a rehashed discovery row whose retained context was substituted", async () => {
    const path = await databasePath();
    const ledger = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    await recordTask(ledger, investigationTask("task:context-tamper"));
    ledger.close();

    const database = new DatabaseSync(path);
    const row = database
      .prepare(
        "SELECT task_id, record_json FROM discovery_runs WHERE task_id = ?",
      )
      .get("task:context-tamper") as {
      task_id: string;
      record_json: string;
    };
    const decoded = JSON.parse(row.record_json) as {
      catalogContext: { listings: { title: string }[] };
    };
    const firstListing = decoded.catalogContext.listings[0];
    if (firstListing === undefined) throw new Error("missing retained listing");
    firstListing.title = "Substituted retained context";
    database
      .prepare(
        "UPDATE discovery_runs SET record_json = ?, record_hash = ? WHERE task_id = ?",
      )
      .run(
        JSON.stringify(decoded),
        hashCanonical(decoded),
        "task:context-tamper",
      );
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.load(25)).toThrow(/invalid or unbounded/);
    reopened.close();
  });

  it("never overwrites an existing taskId with a different scope", async () => {
    const path = await databasePath();
    const ledger = new DiscoveryLedger(25, new SqliteOperationalStore(path));
    await recordTask(ledger, task("task:scope-bound", "Original scope?"));
    await expect(
      recordTask(ledger, task("task:scope-bound", "Substituted scope?")),
    ).rejects.toThrow(/another discovery scope/);
    expect(ledger.findByTaskId("task:scope-bound")?.question).toBe(
      "Original scope?",
    );
    ledger.close();
  });

  it("refuses a database schema newer than this binary", async () => {
    const path = await databasePath();
    const database = new DatabaseSync(path);
    database.exec("PRAGMA user_version = 99");
    database.close();
    expect(() => new SqliteOperationalStore(path)).toThrow(/newer than supported/);
  });

  it("migrates a version-one discovery database without replacing its table", async () => {
    const path = await databasePath();
    const database = new DatabaseSync(path);
    database.exec(`
      CREATE TABLE discovery_runs (
        task_id TEXT PRIMARY KEY NOT NULL,
        run_id TEXT NOT NULL UNIQUE,
        completed_at TEXT NOT NULL,
        record_json TEXT NOT NULL,
        record_hash TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 1;
    `);
    database.close();

    const migrated = new SqliteOperationalStore(path);
    expect(migrated.storage.schemaVersion).toBe(47);
    expect(migrated.investigationStorage).toMatchObject({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "taskId+catalogContextIdentity",
    });
    migrated.close();

    const inspected = new DatabaseSync(path);
    const tables = inspected
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);
    const version = inspected.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(tables).toEqual([
      "agent_campaign_memberships",
      "agent_campaigns",
      "agent_run_annotations",
      "agent_run_artifacts",
      "agent_runs",
      "agent_runtime_definitions",
      "agent_tasks",
      "agent_tool_effects",
      "ai_runtime_configuration",
      "ai_usage_events",
      "anonymous_materialization_sources",
      "anonymous_simulation_materializations",
      "candidate_book_observations",
      "candidate_watch_refreshes",
      "catalog_contract_text_evidence",
      "catalog_observations",
      "catalog_rule_evidence_claim_records",
      "contract_semantic_continuities",
      "credential_bindings",
      "discovery_runs",
      "evidence_acquisition_jobs",
      "evidence_document_observations",
      "evidence_document_texts",
      "evidence_documents",
      "execution_capability_observations",
      "execution_profiles",
      "investigation_records",
      "market_archaeologist_records",
      "market_ontology_agent_proposals",
      "model_invocations",
      "model_profiles",
      "official_source_discovery_jobs",
      "ontology_search_issue_revisions",
      "opportunity_lifecycle_journals",
      "premise_analysis_jobs",
      "premise_analysis_notifications",
      "premise_analysis_records",
      "premise_evidence_routing_jobs",
      "premise_route_expansion_jobs",
      "probability_calibration_bounds",
      "probability_calibration_observations",
      "probability_calibration_snapshots",
      "probability_estimation_jobs",
      "probability_estimation_notifications",
      "probability_estimation_runs",
      "probability_resolution_captures",
      "probability_resolution_sources",
      "relation_discovery_corpora",
      "relation_discovery_findings",
      "relation_discovery_task_revisions",
      "research_decision_episodes",
      "result_selections",
      "rule_evidence_claim_jobs",
      "rule_evidence_claim_records",
      "search_attention_deliveries",
      "search_attention_messages",
      "search_issue_records",
      "search_lease_corpora",
      "search_lease_records",
      "search_notification_records",
      "search_quote_observations",
      "semantic_review_jobs",
      "semantic_review_notifications",
      "semantic_review_records",
      "standing_ontology_route_observation_episodes",
      "studio_projection_snapshot",
      "workload_routes",
    ]);
    expect(version.user_version).toBe(47);
    inspected.close();

    const partial = new DatabaseSync(path);
    partial.exec("DROP TABLE search_lease_corpora");
    partial.exec("DROP TABLE search_lease_records");
    partial.exec("DROP TABLE search_notification_records");
    expect((partial.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(47);
    partial.close();
    const repaired = new SqliteOperationalStore(path);
    repaired.close();
    const verifiedRepair = new DatabaseSync(path, { readOnly: true });
    expect(
      verifiedRepair.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'search_lease_records'",
      ).get(),
    ).toEqual({ name: "search_lease_records" });
    expect(
      verifiedRepair.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'search_lease_corpora'",
      ).get(),
    ).toEqual({ name: "search_lease_corpora" });
    expect(
      verifiedRepair.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'search_notification_records'",
      ).get(),
    ).toEqual({ name: "search_notification_records" });
    verifiedRepair.close();

    const partialExecutionSchema = new DatabaseSync(path);
    partialExecutionSchema.exec("PRAGMA foreign_keys = OFF");
    partialExecutionSchema.exec("DROP TABLE agent_runtime_definitions");
    expect((partialExecutionSchema.prepare("PRAGMA user_version").get() as {
      user_version: number;
    }).user_version).toBe(47);
    partialExecutionSchema.close();
    const repairedExecutionSchema = new SqliteOperationalStore(path);
    repairedExecutionSchema.close();
    const verifiedExecutionRepair = new DatabaseSync(path, { readOnly: true });
    expect(
      verifiedExecutionRepair.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_runtime_definitions'",
      ).get(),
    ).toEqual({ name: "agent_runtime_definitions" });
    verifiedExecutionRepair.close();
  });

  it("retains immutable research decision episodes idempotently across restart", async () => {
    const path = await databasePath();
    const expected = noveltyBoundResearchDecisionEpisode();
    const legacy = researchDecisionEpisode("2026-08-12T11:00:00.000Z");
    const first = new SqliteOperationalStore(path);
    expect(first.saveResearchDecisionEpisode(expected)).toEqual(expected);
    expect(first.saveResearchDecisionEpisode(expected)).toEqual(expected);
    expect(first.saveResearchDecisionEpisode(legacy)).toEqual(legacy);
    expect(first.loadResearchDecisionEpisodes(10)).toEqual([expected, legacy]);
    expect(first.researchDecisionEpisodeStorage).toMatchObject({
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "episodeId",
    });
    first.close();

    const second = new SqliteOperationalStore(path);
    expect(second.loadResearchDecisionEpisode(expected.episodeId)).toEqual(expected);
    expect(second.loadResearchDecisionEpisode(legacy.episodeId)).toEqual(legacy);
    expect(second.loadResearchDecisionEpisodes(10)).toEqual([expected, legacy]);
    expect(() => second.saveResearchDecisionEpisode({
      ...expected,
      capturedAt: "2026-08-12T12:01:00.000Z",
    })).toThrow(/already bound elsewhere/u);
    second.close();
  });

  it("restores passed investigations and task idempotency across store lifetimes", async () => {
    const path = await databasePath();
    const firstStore = new SqliteOperationalStore(path);
    const firstDesk = durableDesk(firstStore);
    const created = await firstDesk.begin(
      investigationTask("task:investigation:persistent"),
    ).promise;
    expect(created.status).toBe("PASS");
    expect(firstDesk.projection().storage).toMatchObject({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
    });
    firstStore.close();

    let reruns = 0;
    const secondStore = new SqliteOperationalStore(path);
    const secondDesk = durableDesk(secondStore, () => {
      reruns += 1;
    });
    expect(secondDesk.projection().records).toEqual([created]);
    const replay = secondDesk.begin(
      investigationTask("task:investigation:persistent"),
    );
    expect(replay.idempotentReplay).toBe(true);
    await expect(replay.promise).resolves.toEqual(created);
    expect(reruns).toBe(0);
    secondStore.close();
  });

  it("enforces investigation retention in SQLite", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    const desk = durableDesk(store, undefined, 1);
    await desk.begin(investigationTask("task:investigation:first", "First?"))
      .promise;
    await desk.begin(investigationTask("task:investigation:second", "Second?"))
      .promise;
    expect(desk.projection().records.map((record) => record.taskId)).toEqual([
      "task:investigation:second",
    ]);
    store.close();

    const reopened = new SqliteOperationalStore(path);
    expect(reopened.loadInvestigations(10).map((record) => record.taskId)).toEqual([
      "task:investigation:second",
    ]);
    reopened.close();
  });

  it("restores failed investigations and permits a durable retry", async () => {
    const path = await databasePath();
    const firstStore = new SqliteOperationalStore(path);
    const failingRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async () => {
          throw new Error("pi investigator timed out");
        },
      },
    );
    const failed = await new InvestigationDesk(
      failingRuntime.investigator,
      10,
      firstStore,
    ).begin(investigationTask("task:investigation:retry"))
      .promise;
    expect(failed).toMatchObject({
      status: "FAILED",
      diagnostic: "pi investigator timed out",
    });
    firstStore.close();

    const secondStore = new SqliteOperationalStore(path);
    const retryDesk = durableDesk(secondStore);
    expect(retryDesk.projection()).toMatchObject({
      failedCount: 1,
      passCount: 0,
    });
    const retry = retryDesk.begin(
      investigationTask("task:investigation:retry"),
    );
    expect(retry.idempotentReplay).toBe(false);
    await expect(retry.promise).resolves.toMatchObject({ status: "PASS" });
    expect(retryDesk.projection()).toMatchObject({
      runCount: 2,
      failedCount: 1,
      passCount: 1,
    });
    secondStore.close();
  });

  it("fails closed when a persisted investigation report is tampered", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    await durableDesk(store).begin(
      investigationTask("task:investigation:tamper"),
    ).promise;
    store.close();

    const database = new DatabaseSync(path);
    database
      .prepare(
        "UPDATE investigation_records SET record_json = json_set(record_json, '$.report.result.summary', 'tampered')",
      )
      .run();
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.loadInvestigations(10)).toThrow(/identity mismatch/);
    reopened.close();
  });

  it("restores bounded raw catalog observations byte-for-byte", async () => {
    const path = await databasePath();
    const first = new SqliteOperationalStore(path);
    const observation = catalogObservation();
    expect(first.saveCatalogObservation(observation, 3)).toEqual(observation);
    expect(first.catalogObservationStorage).toEqual({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "observationId",
    });
    first.close();

    const second = new SqliteOperationalStore(path);
    expect(second.loadCatalogObservations(3)).toEqual([observation]);
    second.close();
  });

  it("fails closed when persisted catalog bytes no longer match their hash", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    store.saveCatalogObservation(catalogObservation(), 3);
    store.close();

    const database = new DatabaseSync(path);
    database.prepare("UPDATE catalog_observations SET raw_bytes = X'00'").run();
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.loadCatalogObservations(3)).toThrow(
      /raw payload identity mismatch/,
    );
    reopened.close();
  });

  it("retains catalog history per venue so one source cannot evict another", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    const oldKalshi = catalogObservation("2026-08-01T03:20:00.000Z", "kalshi");
    const opinion = catalogObservation("2026-08-01T03:21:00.000Z", "opinion");
    const newKalshi = catalogObservation("2026-08-01T03:22:00.000Z", "kalshi");
    store.saveCatalogObservation(oldKalshi, 1);
    store.saveCatalogObservation(opinion, 1);
    store.saveCatalogObservation(newKalshi, 1);
    expect(
      store.loadCatalogObservations(10).map((item) => item.record.observationId),
    ).toEqual([
      newKalshi.record.observationId,
      opinion.record.observationId,
    ]);
    store.close();
  });

  it("restores bounded candidate books byte-for-byte across store lifetimes", async () => {
    const path = await databasePath();
    const polymarket = candidateBookObservation("polymarket-global");
    const limitless = candidateBookObservation("limitless");
    const first = new SqliteOperationalStore(path);
    expect(first.saveCandidateBookObservation(polymarket, 3)).toEqual(polymarket);
    expect(first.saveCandidateBookObservation(limitless, 3)).toEqual(limitless);
    expect(first.candidateBookObservationStorage).toEqual({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "observationId",
    });
    first.close();

    const second = new SqliteOperationalStore(path);
    expect(second.loadCandidateBookObservations(6)).toEqual([
      limitless,
      polymarket,
    ]);
    second.close();
  });

  it("fails closed when persisted candidate book bytes are tampered", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    store.saveCandidateBookObservation(
      candidateBookObservation("polymarket-global"),
      3,
    );
    store.close();

    const database = new DatabaseSync(path);
    database
      .prepare("UPDATE candidate_book_observations SET raw_bytes = X'00'")
      .run();
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.loadCandidateBookObservations(3)).toThrow(
      /raw payload identity mismatch/,
    );
    reopened.close();
  });

  it("restores a bounded candidate watch refresh journal", async () => {
    const path = await databasePath();
    const oldest = candidateWatchRefresh("2026-08-01T06:30:00.000Z");
    const middle = candidateWatchRefresh("2026-08-01T06:31:00.000Z");
    const latest = candidateWatchRefresh("2026-08-01T06:32:00.000Z");
    const first = new SqliteOperationalStore(path);
    first.saveCandidateWatchRefresh(oldest, 2);
    first.saveCandidateWatchRefresh(middle, 2);
    expect(first.saveCandidateWatchRefresh(latest, 2)).toEqual(latest);
    expect(first.candidateWatchRefreshStorage).toEqual({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "refreshId",
    });
    first.close();

    const second = new SqliteOperationalStore(path);
    expect(second.loadCandidateWatchRefreshes(10)).toEqual([latest, middle]);
    second.close();
  });

  it("fails closed when a candidate watch refresh journal is tampered", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    store.saveCandidateWatchRefresh(candidateWatchRefresh(), 3);
    store.close();

    const database = new DatabaseSync(path);
    database
      .prepare(
        `UPDATE candidate_watch_refreshes
         SET record_json = json_set(record_json, '$.status', 'READY')`,
      )
      .run();
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.loadCandidateWatchRefreshes(3)).toThrow(
      /record state is inconsistent|identity mismatch/,
    );
    reopened.close();
  });

  it("restores anonymous simulation evidence byte-for-byte across store lifetimes", async () => {
    const path = await databasePath();
    const materialization = anonymousSimulationMaterialization();
    const first = new SqliteOperationalStore(path);
    expect(
      first.saveAnonymousSimulationMaterialization(materialization, 3),
    ).toEqual(materialization);
    expect(first.anonymousSimulationMaterializationStorage).toEqual({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 47,
      idempotencyKey: "materializationId",
    });
    first.close();

    const second = new SqliteOperationalStore(path);
    expect(second.loadAnonymousSimulationMaterializations(3)).toEqual([
      materialization,
    ]);
    const restoredDesk = new AnonymousSimulationMaterializerDesk({
      store: second,
    });
    expect(restoredDesk.projection()).toMatchObject({
      runCount: 1,
      blockedCount: 1,
      retainedRawSourceCount: 1,
      storage: {
        mode: "SQLITE_WAL",
        durable: true,
        schemaVersion: 47,
      },
    });
    expect(
      restoredDesk.rawSource(materialization.rawSources[0]!.record.sourceId),
    ).toEqual(materialization.rawSources[0]);
    second.close();
  });

  it("fails closed when anonymous simulation raw evidence is tampered", async () => {
    const path = await databasePath();
    const first = new SqliteOperationalStore(path);
    first.saveAnonymousSimulationMaterialization(
      anonymousSimulationMaterialization(),
      3,
    );
    first.close();

    const database = new DatabaseSync(path);
    database
      .prepare("UPDATE anonymous_materialization_sources SET raw_bytes = X'00'")
      .run();
    database.close();

    const reopened = new SqliteOperationalStore(path);
    expect(() => reopened.loadAnonymousSimulationMaterializations(3)).toThrow(
      /source is malformed/,
    );
    reopened.close();
  });

  it("removes orphaned anonymous evidence with bounded materialization retention", async () => {
    const path = await databasePath();
    const oldest = anonymousSimulationMaterialization(
      "2026-08-01T08:00:00.000Z",
    );
    const latest = anonymousSimulationMaterialization(
      "2026-08-01T08:01:00.000Z",
    );
    const store = new SqliteOperationalStore(path);
    store.saveAnonymousSimulationMaterialization(oldest, 1);
    store.saveAnonymousSimulationMaterialization(latest, 1);
    expect(store.loadAnonymousSimulationMaterializations(10)).toEqual([latest]);
    store.close();

    const database = new DatabaseSync(path);
    const row = database
      .prepare("SELECT count(*) AS count FROM anonymous_materialization_sources")
      .get() as { count: number };
    expect(row.count).toBe(1);
    database.close();
  });
});
