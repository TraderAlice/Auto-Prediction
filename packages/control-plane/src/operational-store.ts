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
import {
  verifyCandidateWatchRefreshRecord,
  verifyStoredCandidateBookObservation,
  type CandidateBookObservationStore,
  type CandidateBookObservationRecord,
  type CandidateWatchRefreshRecord,
  type CandidateWatchRefreshStore,
  type StoredCandidateBookObservation,
} from "./candidate-watch.js";
import {
  assertMarketArchaeologistRecord,
  type MarketArchaeologistRecord,
  type MarketArchaeologistRecordStore,
} from "./market-archaeologist.js";
import {
  assertOpportunityLifecycleJournal,
  type OpportunityLifecycleJournal,
  type OpportunityLifecycleJournalStore,
} from "./opportunity-lifecycle-desk.js";
import {
  assertSemanticReviewRecord,
  type SemanticReviewRecord,
  type SemanticReviewRecordStore,
} from "./semantic-review.js";
import {
  assertAnonymousSimulationMaterializationRecord,
  verifyStoredAnonymousMaterializationSource,
  verifyStoredAnonymousSimulationMaterialization,
  type AnonymousSimulationMaterializationStore,
  type StoredAnonymousMaterializationSource,
  type StoredAnonymousSimulationMaterialization,
} from "./anonymous-simulation-materializer.js";
import type {
  DiscoveryRunRecord,
  OperationalStorageProjection,
} from "./types.js";

const SCHEMA_VERSION = 8;

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

type StoredCandidateBookObservationRow = Readonly<{
  observation_id: string;
  record_json: string;
  record_hash: string;
  raw_bytes: Uint8Array;
}>;

type CandidateWatchRefreshRow = Readonly<{
  refresh_id: string;
  record_json: string;
  record_hash: string;
}>;

type MarketArchaeologistRow = Readonly<{
  run_id: string;
  corpus_snapshot_identity: string;
  record_json: string;
  record_hash: string;
}>;

type SemanticReviewRow = Readonly<{
  review_id: string;
  opportunity_id: string;
  record_json: string;
  record_hash: string;
}>;

type OpportunityLifecycleRow = Readonly<{
  opportunity_id: string;
  journal_json: string;
  journal_hash: string;
}>;

type AnonymousMaterializationSourceRow = Readonly<{
  source_id: string;
  record_json: string;
  record_hash: string;
  raw_bytes: Uint8Array;
}>;

type AnonymousSimulationMaterializationRow = Readonly<{
  materialization_id: string;
  record_json: string;
  record_hash: string;
}>;

function reviveCanonicalBigInt(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 1 &&
    typeof (value as { $bigint?: unknown }).$bigint === "string" &&
    /^-?(?:0|[1-9]\d*)$/u.test((value as { $bigint: string }).$bigint)
  ) {
    return BigInt((value as { $bigint: string }).$bigint);
  }
  return value;
}

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

function parseStoredCandidateBookObservation(
  value: unknown,
): StoredCandidateBookObservation {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite candidate book observation row is malformed");
  }
  const row = value as Partial<StoredCandidateBookObservationRow>;
  if (
    typeof row.observation_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string" ||
    !(row.raw_bytes instanceof Uint8Array)
  ) {
    throw new Error(
      "SQLite candidate book observation row has invalid column types",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite candidate book observation contains invalid JSON");
  }
  if (decoded === null || typeof decoded !== "object") {
    throw new Error("SQLite candidate book observation record is malformed");
  }
  const record = decoded as CandidateBookObservationRecord;
  if (
    record.observationId !== row.observation_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error(
      "SQLite candidate book observation record identity mismatch",
    );
  }
  return verifyStoredCandidateBookObservation({
    record,
    bytes: row.raw_bytes,
  });
}

function parseCandidateWatchRefresh(
  value: unknown,
): CandidateWatchRefreshRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite candidate watch refresh row is malformed");
  }
  const row = value as Partial<CandidateWatchRefreshRow>;
  if (
    typeof row.refresh_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error(
      "SQLite candidate watch refresh row has invalid column types",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite candidate watch refresh contains invalid JSON");
  }
  const record = verifyCandidateWatchRefreshRecord(decoded);
  if (
    record.refreshId !== row.refresh_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite candidate watch refresh identity mismatch");
  }
  return record;
}

function parseMarketArchaeologistRecord(
  value: unknown,
): MarketArchaeologistRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite Market Archaeologist row is malformed");
  }
  const row = value as Partial<MarketArchaeologistRow>;
  if (
    typeof row.run_id !== "string" ||
    typeof row.corpus_snapshot_identity !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error(
      "SQLite Market Archaeologist row has invalid column types",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite Market Archaeologist record contains invalid JSON");
  }
  const record = assertMarketArchaeologistRecord(decoded);
  if (
    record.status === "RUNNING" ||
    record.runId !== row.run_id ||
    record.corpusSnapshotIdentity !== row.corpus_snapshot_identity ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite Market Archaeologist record identity mismatch");
  }
  return record;
}

function parseSemanticReviewRecord(value: unknown): SemanticReviewRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite semantic review row is malformed");
  }
  const row = value as Partial<SemanticReviewRow>;
  if (
    typeof row.review_id !== "string" ||
    typeof row.opportunity_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite semantic review row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite semantic review record contains invalid JSON");
  }
  const record = assertSemanticReviewRecord(decoded);
  if (
    record.status === "RUNNING" ||
    record.reviewId !== row.review_id ||
    record.opportunityId !== row.opportunity_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite semantic review record identity mismatch");
  }
  return record;
}

function parseOpportunityLifecycleJournal(
  value: unknown,
): OpportunityLifecycleJournal {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite opportunity lifecycle row is malformed");
  }
  const row = value as Partial<OpportunityLifecycleRow>;
  if (
    typeof row.opportunity_id !== "string" ||
    typeof row.journal_json !== "string" ||
    typeof row.journal_hash !== "string"
  ) {
    throw new Error(
      "SQLite opportunity lifecycle row has invalid column types",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.journal_json, reviveCanonicalBigInt);
  } catch {
    throw new Error("SQLite opportunity lifecycle journal contains invalid JSON");
  }
  const journal = assertOpportunityLifecycleJournal(decoded);
  if (
    journal.opportunityId !== row.opportunity_id ||
    hashCanonical(journal) !== row.journal_hash
  ) {
    throw new Error("SQLite opportunity lifecycle journal identity mismatch");
  }
  return journal;
}

function parseAnonymousMaterializationSource(
  value: unknown,
): StoredAnonymousMaterializationSource {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite anonymous materialization source row is malformed");
  }
  const row = value as Partial<AnonymousMaterializationSourceRow>;
  if (
    typeof row.source_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string" ||
    !(row.raw_bytes instanceof Uint8Array)
  ) {
    throw new Error(
      "SQLite anonymous materialization source row has invalid column types",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite anonymous materialization source contains invalid JSON");
  }
  if (decoded === null || typeof decoded !== "object") {
    throw new Error("SQLite anonymous materialization source record is malformed");
  }
  const source = verifyStoredAnonymousMaterializationSource({
    record: decoded as StoredAnonymousMaterializationSource["record"],
    bytes: row.raw_bytes,
  });
  if (
    source.record.sourceId !== row.source_id ||
    hashCanonical(source.record) !== row.record_hash
  ) {
    throw new Error("SQLite anonymous materialization source identity mismatch");
  }
  return source;
}

function parseAnonymousSimulationMaterializationRecord(
  value: unknown,
) {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite anonymous simulation materialization row is malformed");
  }
  const row = value as Partial<AnonymousSimulationMaterializationRow>;
  if (
    typeof row.materialization_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error(
      "SQLite anonymous simulation materialization row has invalid column types",
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite anonymous simulation materialization contains invalid JSON");
  }
  const record = assertAnonymousSimulationMaterializationRecord(decoded);
  if (
    record.materializationId !== row.materialization_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite anonymous simulation materialization identity mismatch");
  }
  return record;
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
  implements
    DiscoveryRunStore,
    InvestigationRecordStore,
    CatalogObservationStore,
    CandidateBookObservationStore,
    CandidateWatchRefreshStore,
    MarketArchaeologistRecordStore,
    SemanticReviewRecordStore,
    OpportunityLifecycleJournalStore,
    AnonymousSimulationMaterializationStore
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
  public readonly candidateBookObservationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "observationId";
  }>;
  public readonly candidateWatchRefreshStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "refreshId";
  }>;
  public readonly marketArchaeologistStorage: OperationalStorageProjection<"runId">;
  public readonly semanticReviewStorage: OperationalStorageProjection<"reviewId">;
  public readonly opportunityLifecycleStorage: OperationalStorageProjection<"opportunityId">;
  public readonly anonymousSimulationMaterializationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "materializationId";
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
    this.candidateBookObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.candidateWatchRefreshStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "refreshId",
    });
    this.marketArchaeologistStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "runId",
    });
    this.semanticReviewStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "reviewId",
    });
    this.opportunityLifecycleStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "opportunityId",
    });
    this.anonymousSimulationMaterializationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "materializationId",
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
      if (current < 4) {
        this.#database.exec(`
          CREATE TABLE candidate_book_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) > 0 AND
              observation_id GLOB 'candidate-book-observation:[0-9a-f]*'
            ),
            refresh_id TEXT NOT NULL CHECK (
              length(refresh_id) > 0 AND
              refresh_id GLOB 'candidate-watch-refresh:[0-9a-f]*'
            ),
            venue_id TEXT NOT NULL CHECK (
              venue_id IN ('polymarket-global', 'limitless')
            ),
            received_at TEXT NOT NULL CHECK (length(received_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            raw_bytes BLOB NOT NULL
          ) STRICT;
          CREATE INDEX candidate_book_observations_received
            ON candidate_book_observations (
              received_at DESC, observation_id DESC
            );
          CREATE INDEX candidate_book_observations_venue
            ON candidate_book_observations (venue_id, received_at DESC);
          CREATE INDEX candidate_book_observations_refresh
            ON candidate_book_observations (refresh_id, venue_id);
        `);
      }
      if (current < 5) {
        this.#database.exec(`
          CREATE TABLE candidate_watch_refreshes (
            refresh_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(refresh_id) > 0 AND
              refresh_id GLOB 'candidate-watch-refresh:[0-9a-f]*'
            ),
            attempted_at TEXT NOT NULL CHECK (length(attempted_at) > 0),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            status TEXT NOT NULL CHECK (status IN ('READY', 'DEGRADED')),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX candidate_watch_refreshes_attempted
            ON candidate_watch_refreshes (
              attempted_at DESC, refresh_id DESC
            );
        `);
      }
      if (current < 6) {
        this.#database.exec(`
          CREATE TABLE market_archaeologist_records (
            run_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(run_id) = 71 AND run_id GLOB 'sha256:[0-9a-f]*'
            ),
            corpus_snapshot_identity TEXT NOT NULL CHECK (
              length(corpus_snapshot_identity) = 71 AND
              corpus_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('PASS', 'FAILED')),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX market_archaeologist_records_completed
            ON market_archaeologist_records (
              completed_at DESC, run_id DESC
            );
        `);
      }
      if (current < 7) {
        this.#database.exec(`
          CREATE TABLE semantic_review_records (
            review_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(review_id) = 71 AND review_id GLOB 'sha256:[0-9a-f]*'
            ),
            opportunity_id TEXT NOT NULL CHECK (length(opportunity_id) > 0),
            status TEXT NOT NULL CHECK (status IN ('PASS', 'FAILED')),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX semantic_review_records_completed
            ON semantic_review_records (completed_at DESC, review_id DESC);
          CREATE INDEX semantic_review_records_opportunity
            ON semantic_review_records (opportunity_id, completed_at DESC);

          CREATE TABLE opportunity_lifecycle_journals (
            opportunity_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(opportunity_id) > 0
            ),
            state TEXT NOT NULL CHECK (length(state) > 0),
            event_count INTEGER NOT NULL CHECK (event_count > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            journal_json TEXT NOT NULL CHECK (json_valid(journal_json)),
            journal_hash TEXT NOT NULL CHECK (
              length(journal_hash) = 71 AND journal_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX opportunity_lifecycle_journals_updated
            ON opportunity_lifecycle_journals (
              updated_at DESC, opportunity_id DESC
            );
        `);
      }
      if (current < 8) {
        this.#database.exec(`
          CREATE TABLE anonymous_materialization_sources (
            source_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(source_id) = 71 AND source_id GLOB 'sha256:[0-9a-f]*'
            ),
            received_at TEXT NOT NULL CHECK (length(received_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            raw_bytes BLOB NOT NULL
          ) STRICT;
          CREATE INDEX anonymous_materialization_sources_received
            ON anonymous_materialization_sources (received_at DESC, source_id DESC);

          CREATE TABLE anonymous_simulation_materializations (
            materialization_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(materialization_id) = 71 AND
              materialization_id GLOB 'sha256:[0-9a-f]*'
            ),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            status TEXT NOT NULL CHECK (status IN ('READY', 'BLOCKED')),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX anonymous_simulation_materializations_completed
            ON anonymous_simulation_materializations (
              completed_at DESC, materialization_id DESC
            );
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

  public loadCandidateBookObservations(
    limit: number,
  ): readonly StoredCandidateBookObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT observation_id, record_json, record_hash, raw_bytes
         FROM candidate_book_observations
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseStoredCandidateBookObservation));
  }

  public saveCandidateBookObservation(
    observation: StoredCandidateBookObservation,
    retentionLimit: number,
  ): StoredCandidateBookObservation {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = verifyStoredCandidateBookObservation(observation);
    const recordJson = canonicalJson(validated.record);
    const recordHash = hashCanonical(validated.record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO candidate_book_observations (
             observation_id, refresh_id, venue_id, received_at,
             record_json, record_hash, raw_bytes
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        )
        .run(
          validated.record.observationId,
          validated.record.refreshId,
          validated.record.venueId,
          validated.record.receivedAt,
          recordJson,
          recordHash,
          validated.bytes,
        );
      this.#database
        .prepare(
          `DELETE FROM candidate_book_observations
           WHERE venue_id = ? AND observation_id IN (
             SELECT observation_id
             FROM candidate_book_observations
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
           FROM candidate_book_observations
           WHERE observation_id = ?`,
        )
        .get(validated.record.observationId);
      if (row === undefined) {
        throw new Error(
          "SQLite failed to retain the candidate book observation",
        );
      }
      const stored = parseStoredCandidateBookObservation(row);
      if (hashCanonical(stored.record) !== recordHash) {
        throw new Error(
          "candidate observationId is already bound to another record",
        );
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadCandidateWatchRefreshes(
    limit: number,
  ): readonly CandidateWatchRefreshRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT refresh_id, record_json, record_hash
         FROM candidate_watch_refreshes
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseCandidateWatchRefresh));
  }

  public saveCandidateWatchRefresh(
    record: CandidateWatchRefreshRecord,
    retentionLimit: number,
  ): CandidateWatchRefreshRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = verifyCandidateWatchRefreshRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO candidate_watch_refreshes (
             refresh_id, attempted_at, completed_at, status,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(refresh_id) DO NOTHING`,
        )
        .run(
          validated.refreshId,
          validated.attemptedAt,
          validated.completedAt,
          validated.status,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM candidate_watch_refreshes
           WHERE refresh_id IN (
             SELECT refresh_id
             FROM candidate_watch_refreshes
             ORDER BY rowid DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT refresh_id, record_json, record_hash
           FROM candidate_watch_refreshes
           WHERE refresh_id = ?`,
        )
        .get(validated.refreshId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the candidate watch refresh");
      }
      const stored = parseCandidateWatchRefresh(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("refreshId is already bound to another record");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMarketArchaeologistRecords(
    limit: number,
  ): readonly MarketArchaeologistRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT run_id, corpus_snapshot_identity, record_json, record_hash
         FROM market_archaeologist_records
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseMarketArchaeologistRecord));
  }

  public saveMarketArchaeologistRecord(
    record: MarketArchaeologistRecord,
    retentionLimit: number,
  ): MarketArchaeologistRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertMarketArchaeologistRecord(record);
    if (validated.status === "RUNNING" || validated.completedAt === null) {
      throw new Error("SQLite cannot persist an active Market Archaeologist run");
    }
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO market_archaeologist_records (
             run_id, corpus_snapshot_identity, status, completed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(run_id) DO UPDATE SET
             corpus_snapshot_identity = excluded.corpus_snapshot_identity,
             status = excluded.status,
             completed_at = excluded.completed_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE market_archaeologist_records.status = 'FAILED'`,
        )
        .run(
          validated.runId,
          validated.corpusSnapshotIdentity,
          validated.status,
          validated.completedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM market_archaeologist_records
           WHERE run_id IN (
             SELECT run_id
             FROM market_archaeologist_records
             ORDER BY rowid DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT run_id, corpus_snapshot_identity, record_json, record_hash
           FROM market_archaeologist_records
           WHERE run_id = ?`,
        )
        .get(validated.runId);
      if (row === undefined) {
        throw new Error(
          "SQLite failed to retain the Market Archaeologist record",
        );
      }
      const stored = parseMarketArchaeologistRecord(row);
      if (
        stored.question !== validated.question ||
        stored.corpusSnapshotIdentity !== validated.corpusSnapshotIdentity ||
        (stored.status === validated.status &&
          hashCanonical(stored) !== recordHash)
      ) {
        throw new Error("runId is already bound to another archaeologist record");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSemanticReviewRecords(
    limit: number,
  ): readonly SemanticReviewRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT review_id, opportunity_id, record_json, record_hash
         FROM semantic_review_records
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSemanticReviewRecord));
  }

  public saveSemanticReviewRecord(
    record: SemanticReviewRecord,
    retentionLimit: number,
  ): SemanticReviewRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertSemanticReviewRecord(record);
    if (validated.status === "RUNNING" || validated.completedAt === null) {
      throw new Error("SQLite cannot persist an active semantic review");
    }
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO semantic_review_records (
             review_id, opportunity_id, status, completed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(review_id) DO UPDATE SET
             opportunity_id = excluded.opportunity_id,
             status = excluded.status,
             completed_at = excluded.completed_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE semantic_review_records.status = 'FAILED'`,
        )
        .run(
          validated.reviewId,
          validated.opportunityId,
          validated.status,
          validated.completedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM semantic_review_records
           WHERE review_id IN (
             SELECT review_id FROM semantic_review_records
             ORDER BY rowid DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT review_id, opportunity_id, record_json, record_hash
           FROM semantic_review_records WHERE review_id = ?`,
        )
        .get(validated.reviewId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the semantic review record");
      }
      const stored = parseSemanticReviewRecord(row);
      if (
        stored.opportunityId !== validated.opportunityId ||
        stored.proposalId !== validated.proposalId ||
        (stored.status === validated.status &&
          hashCanonical(stored) !== recordHash)
      ) {
        throw new Error("reviewId is already bound to another semantic review");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadOpportunityLifecycleJournals(
    limit: number,
  ): readonly OpportunityLifecycleJournal[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT opportunity_id, journal_json, journal_hash
         FROM opportunity_lifecycle_journals
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseOpportunityLifecycleJournal));
  }

  public saveOpportunityLifecycleJournal(
    journal: OpportunityLifecycleJournal,
    retentionLimit: number,
  ): OpportunityLifecycleJournal {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertOpportunityLifecycleJournal(journal);
    const journalJson = canonicalJson(validated);
    const journalHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const priorRow = this.#database
        .prepare(
          `SELECT opportunity_id, journal_json, journal_hash
           FROM opportunity_lifecycle_journals WHERE opportunity_id = ?`,
        )
        .get(validated.opportunityId);
      if (priorRow !== undefined) {
        const prior = parseOpportunityLifecycleJournal(priorRow);
        if (
          validated.lifecycle.events.length < prior.lifecycle.events.length ||
          prior.lifecycle.events.some(
            (event, index) =>
              event.eventId !== validated.lifecycle.events[index]?.eventId,
          ) ||
          prior.semanticDecisions.some(
            (decision, index) =>
              decision.decisionId !==
              validated.semanticDecisions[index]?.decisionId,
          ) ||
          (prior.simulationBundles ?? []).some(
            (bundle, index) =>
              bundle.artifactHash !==
              (validated.simulationBundles ?? [])[index]?.artifactHash,
          ) ||
          (prior.exactVerifications ?? []).some(
            (record, index) =>
              record.artifactHash !==
              (validated.exactVerifications ?? [])[index]?.artifactHash,
          ) ||
          (prior.shadowRuns ?? []).some(
            (run, index) =>
              run.artifactHash !==
              (validated.shadowRuns ?? [])[index]?.artifactHash,
          )
        ) {
          throw new Error("opportunity lifecycle journal cannot be rewritten");
        }
      }
      this.#database
        .prepare(
          `INSERT INTO opportunity_lifecycle_journals (
             opportunity_id, state, event_count, updated_at,
             journal_json, journal_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(opportunity_id) DO UPDATE SET
             state = excluded.state,
             event_count = excluded.event_count,
             updated_at = excluded.updated_at,
             journal_json = excluded.journal_json,
             journal_hash = excluded.journal_hash`,
        )
        .run(
          validated.opportunityId,
          validated.lifecycle.state,
          validated.lifecycle.events.length,
          validated.updatedAt,
          journalJson,
          journalHash,
        );
      this.#database
        .prepare(
          `DELETE FROM opportunity_lifecycle_journals
           WHERE opportunity_id IN (
             SELECT opportunity_id FROM opportunity_lifecycle_journals
             ORDER BY rowid DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT opportunity_id, journal_json, journal_hash
           FROM opportunity_lifecycle_journals WHERE opportunity_id = ?`,
        )
        .get(validated.opportunityId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the lifecycle journal");
      }
      const stored = parseOpportunityLifecycleJournal(row);
      if (hashCanonical(stored) !== journalHash) {
        throw new Error("opportunityId is already bound to another journal");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadAnonymousSimulationMaterializations(
    limit: number,
  ): readonly StoredAnonymousSimulationMaterialization[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT materialization_id, record_json, record_hash
         FROM anonymous_simulation_materializations
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(
      rows.map((row) => {
        const record = parseAnonymousSimulationMaterializationRecord(row);
        const rawSources = record.sources.map((source) => {
          const sourceRow = this.#database
            .prepare(
              `SELECT source_id, record_json, record_hash, raw_bytes
               FROM anonymous_materialization_sources
               WHERE source_id = ?`,
            )
            .get(source.sourceId);
          if (sourceRow === undefined) {
            throw new Error(
              "SQLite anonymous simulation materialization is missing raw evidence",
            );
          }
          return parseAnonymousMaterializationSource(sourceRow);
        });
        return verifyStoredAnonymousSimulationMaterialization({
          record,
          rawSources,
        });
      }),
    );
  }

  public saveAnonymousSimulationMaterialization(
    value: StoredAnonymousSimulationMaterialization,
    retentionLimit: number,
  ): StoredAnonymousSimulationMaterialization {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = verifyStoredAnonymousSimulationMaterialization(value);
    const recordJson = canonicalJson(validated.record);
    const recordHash = hashCanonical(validated.record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const source of validated.rawSources) {
        this.#database
          .prepare(
            `INSERT INTO anonymous_materialization_sources (
               source_id, received_at, record_json, record_hash, raw_bytes
             ) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(source_id) DO NOTHING`,
          )
          .run(
            source.record.sourceId,
            source.record.receivedAt,
            canonicalJson(source.record),
            hashCanonical(source.record),
            source.bytes,
          );
        const sourceRow = this.#database
          .prepare(
            `SELECT source_id, record_json, record_hash, raw_bytes
             FROM anonymous_materialization_sources
             WHERE source_id = ?`,
          )
          .get(source.record.sourceId);
        if (sourceRow === undefined) {
          throw new Error("SQLite failed to retain anonymous raw evidence");
        }
        const storedSource = parseAnonymousMaterializationSource(sourceRow);
        if (hashCanonical(storedSource.record) !== hashCanonical(source.record)) {
          throw new Error("sourceId is already bound to other anonymous evidence");
        }
      }
      this.#database
        .prepare(
          `INSERT INTO anonymous_simulation_materializations (
             materialization_id, completed_at, status, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(materialization_id) DO NOTHING`,
        )
        .run(
          validated.record.materializationId,
          validated.record.completedAt,
          validated.record.status,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM anonymous_simulation_materializations
           WHERE materialization_id IN (
             SELECT materialization_id
             FROM anonymous_simulation_materializations
             ORDER BY rowid DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      this.#database.exec(`
        DELETE FROM anonymous_materialization_sources
        WHERE source_id NOT IN (
          SELECT json_extract(source.value, '$.sourceId')
          FROM anonymous_simulation_materializations AS materialization,
               json_each(materialization.record_json, '$.sources') AS source
        )
      `);
      const row = this.#database
        .prepare(
          `SELECT materialization_id, record_json, record_hash
           FROM anonymous_simulation_materializations
           WHERE materialization_id = ?`,
        )
        .get(validated.record.materializationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain anonymous materialization");
      }
      const storedRecord = parseAnonymousSimulationMaterializationRecord(row);
      if (hashCanonical(storedRecord) !== recordHash) {
        throw new Error(
          "materializationId is already bound to another anonymous materialization",
        );
      }
      const stored = verifyStoredAnonymousSimulationMaterialization({
        record: storedRecord,
        rawSources: storedRecord.sources.map((source) => {
          const sourceRow = this.#database
            .prepare(
              `SELECT source_id, record_json, record_hash, raw_bytes
               FROM anonymous_materialization_sources
               WHERE source_id = ?`,
            )
            .get(source.sourceId);
          if (sourceRow === undefined) {
            throw new Error("SQLite lost anonymous raw evidence during commit");
          }
          return parseAnonymousMaterializationSource(sourceRow);
        }),
      });
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
