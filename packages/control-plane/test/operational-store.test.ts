import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashBytes, hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPiInvestigatorRuntime,
  DiscoveryLedger,
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  InvestigationDesk,
  type DiscoveryTask,
  type PiProcessResult,
} from "../src/index.js";
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

function investigationTask(
  taskId: string,
  question = "Investigate the fixture",
): DiscoveryTask {
  return {
    taskId,
    question,
    venueIds: ["gemini-predictions"],
    maxHypotheses: 3,
    deadlineEpochMs: Date.now() + 30_000,
    catalogContext: {
      schemaVersion: "pmh.discovery-catalog-context.v2",
      source: "VERIFIED_FIXTURE_CATALOGS",
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
      contextIdentity: hashCanonical({ taskId, question }),
      listings: [
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
          sourceKind: "VERIFIED_FIXTURE",
          sourceReceivedAt: "2026-07-31T00:00:00.000Z",
          sourceRawHash: hashCanonical({ source: "fixture-a" }),
          protocolIdentity: "prediction-markets-v1:test",
        },
      ],
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
        schemaVersion: 3,
        idempotencyKey: "taskId",
      },
    });
    const firstRun = firstLedger.projection().runs[0];
    firstLedger.close();

    const secondStore = new SqliteOperationalStore(path);
    const secondLedger = new DiscoveryLedger(25, secondStore);
    expect(secondLedger.projection().runs).toEqual([firstRun]);
    expect(secondLedger.findByTaskId("task:persistent")).toEqual(firstRun);
    secondLedger.close();
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
    expect(migrated.storage.schemaVersion).toBe(3);
    expect(migrated.investigationStorage).toMatchObject({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 3,
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
      "catalog_observations",
      "discovery_runs",
      "investigation_records",
    ]);
    expect(version.user_version).toBe(3);
    inspected.close();
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
      schemaVersion: 3,
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
      schemaVersion: 3,
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
});
