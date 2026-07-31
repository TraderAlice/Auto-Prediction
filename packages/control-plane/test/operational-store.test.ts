import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  DiscoveryLedger,
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  type DiscoveryTask,
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
        schemaVersion: 1,
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
});
