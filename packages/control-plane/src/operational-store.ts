import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson, hashCanonical } from "@pmh/domain";
import {
  assertDiscoveryRunRecord,
  type DiscoveryRunStore,
} from "./discovery-ledger.js";
import {
  assertInvestigationRecord,
  type InvestigationRecord,
  type InvestigationRecordStore,
} from "./investigation-desk.js";
import {
  verifyStoredCatalogObservation,
  type CatalogObservationRecord,
  type CatalogObservationStore,
  type StoredCatalogObservation,
} from "./catalog-observation.js";
import type {
  DiscoveryRunRecord,
  OperationalStorageProjection,
} from "./types.js";

const SCHEMA_VERSION = 3;

type StoredRunRow = Readonly<{
  task_id: string;
  run_id: string;
  record_json: string;
  record_hash: string;
}>;

type StoredInvestigationRow = Readonly<{
  investigation_id: string;
  task_id: string;
  record_json: string;
  record_hash: string;
}>;

type StoredCatalogObservationRow = Readonly<{
  observation_id: string;
  record_json: string;
  record_hash: string;
  raw_bytes: Uint8Array;
}>;

function assertLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("operational retention limit must be a positive integer");
  }
}

function parseStoredInvestigation(value: unknown): InvestigationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite investigation row is malformed");
  }
  const row = value as Partial<StoredInvestigationRow>;
  if (
    typeof row.investigation_id !== "string" ||
    typeof row.task_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite investigation row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite investigation record contains invalid JSON");
  }
  const record = assertInvestigationRecord(decoded);
  if (
    record.status === "RUNNING" ||
    record.investigationId !== row.investigation_id ||
    record.taskId !== row.task_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite investigation record identity mismatch");
  }
  return record;
}

function parseStoredRun(value: unknown): DiscoveryRunRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite discovery row is malformed");
  }
  const row = value as Partial<StoredRunRow>;
  if (
    typeof row.task_id !== "string" ||
    typeof row.run_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite discovery row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite discovery record contains invalid JSON");
  }
  const record = assertDiscoveryRunRecord(decoded);
  if (
    record.taskId !== row.task_id ||
    record.runId !== row.run_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite discovery record identity mismatch");
  }
  return record;
}

function parseStoredCatalogObservation(
  value: unknown,
): StoredCatalogObservation {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite catalog observation row is malformed");
  }
  const row = value as Partial<StoredCatalogObservationRow>;
  if (
    typeof row.observation_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string" ||
    !(row.raw_bytes instanceof Uint8Array)
  ) {
    throw new Error("SQLite catalog observation row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite catalog observation contains invalid JSON");
  }
  if (decoded === null || typeof decoded !== "object") {
    throw new Error("SQLite catalog observation record is malformed");
  }
  const record = decoded as CatalogObservationRecord;
  if (
    record.observationId !== row.observation_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite catalog observation record identity mismatch");
  }
  return verifyStoredCatalogObservation({ record, bytes: row.raw_bytes });
}

function readPragmaNumber(database: DatabaseSync, pragma: string): number {
  const row = database.prepare(`PRAGMA ${pragma}`).get();
  if (row === undefined || row === null || typeof row !== "object") {
    throw new Error(`SQLite PRAGMA ${pragma} returned no value`);
  }
  const value = Object.values(row)[0];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`SQLite PRAGMA ${pragma} returned an invalid value`);
  }
  return value;
}

function readJournalMode(database: DatabaseSync): string {
  const row = database.prepare("PRAGMA journal_mode").get();
  if (row === undefined || row === null || typeof row !== "object") {
    throw new Error("SQLite journal mode is unavailable");
  }
  const value = Object.values(row)[0];
  if (typeof value !== "string") {
    throw new Error("SQLite journal mode is invalid");
  }
  return value.toLowerCase();
}

export class SqliteOperationalStore
  implements DiscoveryRunStore, InvestigationRecordStore, CatalogObservationStore
{
  readonly #database: DatabaseSync;
  #closed = false;
  public readonly storage: OperationalStorageProjection;
  public readonly investigationStorage: OperationalStorageProjection<"taskId+catalogContextIdentity">;
  public readonly catalogObservationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "observationId";
  }>;

  public constructor(databasePath: string) {
    if (databasePath.trim() === "") {
      throw new Error("operational database path must not be empty");
    }
    const inMemory = databasePath === ":memory:";
    if (!inMemory) mkdirSync(dirname(databasePath), { recursive: true });
    this.#database = new DatabaseSync(databasePath, {
      enableForeignKeyConstraints: true,
      allowExtension: false,
    });
    try {
      this.#database.exec("PRAGMA busy_timeout = 5000");
      this.#database.exec("PRAGMA synchronous = FULL");
      if (!inMemory) {
        this.#database.exec("PRAGMA journal_mode = WAL");
        if (readJournalMode(this.#database) !== "wal") {
          throw new Error("operational database could not enter WAL mode");
        }
      }
      this.#migrate();
    } catch (error) {
      this.#closed = true;
      try {
        this.#database.close();
      } catch {
        // Preserve the initialization error if SQLite already closed itself.
      }
      throw error;
    }
    this.storage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "taskId",
    });
    this.investigationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "taskId+catalogContextIdentity",
    });
    this.catalogObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
  }

  #migrate(): void {
    const current = readPragmaNumber(this.#database, "user_version");
    if (current > SCHEMA_VERSION) {
      throw new Error(
        `operational database schema ${current} is newer than supported ${SCHEMA_VERSION}`,
      );
    }
    if (current === SCHEMA_VERSION) return;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (current < 1) {
        this.#database.exec(`
          CREATE TABLE discovery_runs (
            task_id TEXT PRIMARY KEY NOT NULL CHECK (length(task_id) > 0),
            run_id TEXT NOT NULL UNIQUE CHECK (length(run_id) > 0),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX discovery_runs_completed
            ON discovery_runs (completed_at DESC, run_id DESC);
        `);
      }
      if (current < 2) {
        this.#database.exec(`
          CREATE TABLE investigation_records (
            investigation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(investigation_id) = 78 AND
              investigation_id GLOB 'investigation:[0-9a-f]*'
            ),
            task_id TEXT NOT NULL CHECK (length(task_id) > 0),
            status TEXT NOT NULL CHECK (status IN ('PASS', 'FAILED')),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE UNIQUE INDEX investigation_passed_task
            ON investigation_records (task_id) WHERE status = 'PASS';
          CREATE INDEX investigations_completed
            ON investigation_records (completed_at DESC, investigation_id DESC);
        `);
      }
      if (current < 3) {
        this.#database.exec(`
          CREATE TABLE catalog_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 84 AND
              observation_id GLOB 'catalog-observation:[0-9a-f]*'
            ),
            venue_id TEXT NOT NULL CHECK (length(venue_id) > 0),
            received_at TEXT NOT NULL CHECK (length(received_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            raw_bytes BLOB NOT NULL
          ) STRICT;
          CREATE INDEX catalog_observations_received
            ON catalog_observations (received_at DESC, observation_id DESC);
          CREATE INDEX catalog_observations_venue
            ON catalog_observations (venue_id, received_at DESC);
        `);
      }
      this.#database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error("operational database is closed");
  }

  public load(limit: number): readonly DiscoveryRunRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT task_id, run_id, record_json, record_hash
         FROM discovery_runs
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseStoredRun));
  }

  public findByTaskId(taskId: string): DiscoveryRunRecord | undefined {
    this.#assertOpen();
    if (taskId.trim() === "") return undefined;
    const row = this.#database
      .prepare(
        `SELECT task_id, run_id, record_json, record_hash
         FROM discovery_runs
         WHERE task_id = ?`,
      )
      .get(taskId);
    return row === undefined ? undefined : parseStoredRun(row);
  }

  public save(
    record: DiscoveryRunRecord,
    retentionLimit: number,
  ): DiscoveryRunRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertDiscoveryRunRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO discovery_runs (
             task_id, run_id, completed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(task_id) DO NOTHING`,
        )
        .run(
          validated.taskId,
          validated.runId,
          validated.completedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM discovery_runs
           WHERE task_id IN (
             SELECT task_id
             FROM discovery_runs
             ORDER BY rowid DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const stored = this.findByTaskId(validated.taskId);
      if (stored === undefined) {
        throw new Error("SQLite failed to retain the saved discovery run");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadInvestigations(limit: number): readonly InvestigationRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT investigation_id, task_id, record_json, record_hash
         FROM investigation_records
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseStoredInvestigation));
  }

  public saveInvestigation(
    record: InvestigationRecord,
    retentionLimit: number,
  ): InvestigationRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertInvestigationRecord(record);
    if (validated.status === "RUNNING" || validated.completedAt === null) {
      throw new Error("SQLite cannot persist an active investigation");
    }
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO investigation_records (
             investigation_id, task_id, status, completed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(investigation_id) DO NOTHING`,
        )
        .run(
          validated.investigationId,
          validated.taskId,
          validated.status,
          validated.completedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM investigation_records
           WHERE investigation_id IN (
             SELECT investigation_id
             FROM investigation_records
             ORDER BY rowid DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT investigation_id, task_id, record_json, record_hash
           FROM investigation_records
           WHERE investigation_id = ?`,
        )
        .get(validated.investigationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the saved investigation");
      }
      const stored = parseStoredInvestigation(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("investigationId is already bound to another record");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadCatalogObservations(
    limit: number,
  ): readonly StoredCatalogObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT observation_id, record_json, record_hash, raw_bytes
         FROM catalog_observations
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseStoredCatalogObservation));
  }

  public saveCatalogObservation(
    observation: StoredCatalogObservation,
    retentionLimit: number,
  ): StoredCatalogObservation {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = verifyStoredCatalogObservation(observation);
    const recordJson = canonicalJson(validated.record);
    const recordHash = hashCanonical(validated.record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO catalog_observations (
             observation_id, venue_id, received_at, record_json,
             record_hash, raw_bytes
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        )
        .run(
          validated.record.observationId,
          validated.record.venueId,
          validated.record.receivedAt,
          recordJson,
          recordHash,
          validated.bytes,
        );
      this.#database
        .prepare(
          `DELETE FROM catalog_observations
           WHERE venue_id = ? AND observation_id IN (
             SELECT observation_id
             FROM catalog_observations
             WHERE venue_id = ?
             ORDER BY rowid DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(
          validated.record.venueId,
          validated.record.venueId,
          retentionLimit,
        );
      const row = this.#database
        .prepare(
          `SELECT observation_id, record_json, record_hash, raw_bytes
           FROM catalog_observations
           WHERE observation_id = ?`,
        )
        .get(validated.record.observationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the catalog observation");
      }
      const stored = parseStoredCatalogObservation(row);
      if (hashCanonical(stored.record) !== recordHash) {
        throw new Error("observationId is already bound to another record");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }
}
