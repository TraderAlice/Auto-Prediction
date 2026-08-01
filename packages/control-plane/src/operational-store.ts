import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson, hashCanonical, type Hash } from "@pmh/domain";
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
  assertSemanticReviewJobRecord,
  assertSemanticReviewNotificationRecord,
  type SemanticReviewJobRecord,
  type SemanticReviewNotificationRecord,
  type SemanticReviewSchedulerStore,
} from "./semantic-review-scheduler.js";
import {
  assertSearchLeaseRecord,
  type SearchLeaseRecord,
  type SearchLeaseRecordStore,
} from "./search-lease-scheduler.js";
import {
  verifyStoredSearchQuoteObservation,
  type SearchQuoteObservationRecord,
  type SearchQuoteObservationStore,
  type StoredSearchQuoteObservation,
} from "./search-quote-enrichment.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import {
  assertSearchIssueRecord,
  assertSearchNotificationRecord,
  type SearchIssueRecord,
  type SearchIssueRecordStore,
  type SearchNotificationRecord,
} from "./search-issue-scheduler.js";
import {
  assertSearchAttentionDelivery,
  assertSearchAttentionMessage,
  type SearchAttentionDeliveryRecord,
  type SearchAttentionMessageRecord,
  type SearchAttentionStore,
} from "./search-attention-outbox.js";
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

const SCHEMA_VERSION = 17;
const MAX_SEARCH_LEASE_CORPUS_BYTES = 32_000_000;

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

type StoredSearchQuoteObservationRow = Readonly<{
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

type SearchLeaseRow = Readonly<{
  lease_id: string;
  snapshot_identity: string;
  lens: string;
  status: string;
  record_json: string;
  record_hash: string;
}>;

type SearchLeaseCorpusRow = Readonly<{
  snapshot_identity: string;
  source_set_identity: string;
  listing_count: number | bigint;
  corpus_json: string;
  corpus_hash: string;
}>;

type SearchIssueRow = Readonly<{
  issue_id: string;
  record_json: string;
  record_hash: string;
}>;

type SearchNotificationRow = Readonly<{
  notification_id: string;
  record_json: string;
  record_hash: string;
}>;

type SearchAttentionMessageRow = Readonly<{
  message_id: string;
  record_json: string;
  record_hash: string;
}>;

type SearchAttentionDeliveryRow = Readonly<{
  delivery_id: string;
  record_json: string;
  record_hash: string;
}>;

type SemanticReviewRow = Readonly<{
  review_id: string;
  opportunity_id: string;
  record_json: string;
  record_hash: string;
}>;

type SemanticReviewJobRow = Readonly<{
  job_id: string;
  record_json: string;
  record_hash: string;
}>;

type SemanticReviewNotificationRow = Readonly<{
  notification_id: string;
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

function parseStoredSearchQuoteObservation(
  value: unknown,
): StoredSearchQuoteObservation {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search quote observation row is malformed");
  }
  const row = value as Partial<StoredSearchQuoteObservationRow>;
  if (
    typeof row.observation_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string" ||
    !(row.raw_bytes instanceof Uint8Array)
  ) {
    throw new Error("SQLite search quote observation row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite search quote observation contains invalid JSON");
  }
  if (decoded === null || typeof decoded !== "object") {
    throw new Error("SQLite search quote observation record is malformed");
  }
  const record = decoded as SearchQuoteObservationRecord;
  if (
    record.observationId !== row.observation_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite search quote observation identity mismatch");
  }
  return verifyStoredSearchQuoteObservation({ record, bytes: row.raw_bytes });
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

function parseSearchLeaseRecord(value: unknown): SearchLeaseRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search lease row is malformed");
  }
  const row = value as Partial<SearchLeaseRow>;
  if (
    typeof row.lease_id !== "string" ||
    typeof row.snapshot_identity !== "string" ||
    typeof row.lens !== "string" ||
    typeof row.status !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite search lease row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite search lease record contains invalid JSON");
  }
  const record = assertSearchLeaseRecord(decoded);
  if (
    record.lease.leaseId !== row.lease_id ||
    record.lease.snapshotIdentity !== row.snapshot_identity ||
    record.lease.lens !== row.lens ||
    record.status !== row.status ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite search lease record identity mismatch");
  }
  return record;
}

function parseSearchLeaseCorpus(value: unknown): MarketCorpusSnapshot {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search lease corpus row is malformed");
  }
  const row = value as Partial<SearchLeaseCorpusRow>;
  if (
    typeof row.snapshot_identity !== "string" ||
    typeof row.source_set_identity !== "string" ||
    (typeof row.listing_count !== "number" && typeof row.listing_count !== "bigint") ||
    typeof row.corpus_json !== "string" ||
    Buffer.byteLength(row.corpus_json, "utf8") > MAX_SEARCH_LEASE_CORPUS_BYTES ||
    typeof row.corpus_hash !== "string"
  ) {
    throw new Error("SQLite search lease corpus row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.corpus_json);
  } catch {
    throw new Error("SQLite search lease corpus contains invalid JSON");
  }
  const snapshot = assertMarketCorpusSnapshot(decoded);
  if (
    snapshot.snapshotIdentity !== row.snapshot_identity ||
    snapshot.sourceSetIdentity !== row.source_set_identity ||
    snapshot.listingCount !== Number(row.listing_count) ||
    hashCanonical(snapshot) !== row.corpus_hash
  ) {
    throw new Error("SQLite search lease corpus identity mismatch");
  }
  return snapshot;
}

function parseSearchIssueRecord(value: unknown): SearchIssueRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search issue row is malformed");
  }
  const row = value as Partial<SearchIssueRow>;
  if (
    typeof row.issue_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite search issue row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite search issue contains invalid JSON");
  }
  const record = assertSearchIssueRecord(decoded);
  if (record.issueId !== row.issue_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite search issue identity mismatch");
  }
  return record;
}

function parseSearchNotificationRecord(value: unknown): SearchNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search notification row is malformed");
  }
  const row = value as Partial<SearchNotificationRow>;
  if (
    typeof row.notification_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite search notification row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite search notification contains invalid JSON");
  }
  const record = assertSearchNotificationRecord(decoded);
  if (
    record.notificationId !== row.notification_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite search notification identity mismatch");
  }
  return record;
}

function parseSearchAttentionMessage(value: unknown): SearchAttentionMessageRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search attention message row is malformed");
  }
  const row = value as Partial<SearchAttentionMessageRow>;
  if (
    typeof row.message_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite search attention message row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite search attention message contains invalid JSON");
  }
  const record = assertSearchAttentionMessage(decoded as SearchAttentionMessageRecord);
  if (
    record.messageId !== row.message_id ||
    hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite search attention message identity mismatch");
  return record;
}

function parseSearchAttentionDelivery(value: unknown): SearchAttentionDeliveryRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite search attention delivery row is malformed");
  }
  const row = value as Partial<SearchAttentionDeliveryRow>;
  if (
    typeof row.delivery_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite search attention delivery row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite search attention delivery contains invalid JSON");
  }
  const record = assertSearchAttentionDelivery(decoded as SearchAttentionDeliveryRecord);
  if (
    record.deliveryId !== row.delivery_id ||
    hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite search attention delivery identity mismatch");
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

function parseSemanticReviewJobRecord(value: unknown): SemanticReviewJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite semantic review job row is malformed");
  }
  const row = value as Partial<SemanticReviewJobRow>;
  if (
    typeof row.job_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite semantic review job row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite semantic review job contains invalid JSON");
  }
  const record = assertSemanticReviewJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite semantic review job identity mismatch");
  }
  return record;
}

function parseSemanticReviewNotificationRecord(
  value: unknown,
): SemanticReviewNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite semantic review notification row is malformed");
  }
  const row = value as Partial<SemanticReviewNotificationRow>;
  if (
    typeof row.notification_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite semantic review notification row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite semantic review notification contains invalid JSON");
  }
  const record = assertSemanticReviewNotificationRecord(decoded);
  if (
    record.notificationId !== row.notification_id ||
    hashCanonical(record) !== row.record_hash
  ) {
    throw new Error("SQLite semantic review notification identity mismatch");
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
    SearchLeaseRecordStore,
    SearchQuoteObservationStore,
    SearchIssueRecordStore,
    SearchAttentionStore,
    SemanticReviewRecordStore,
    SemanticReviewSchedulerStore,
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
  public readonly searchLeaseStorage: OperationalStorageProjection<"leaseId">;
  public readonly searchLeaseCorpusStorage: OperationalStorageProjection<"snapshotIdentity">;
  public readonly searchQuoteObservationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "observationId";
  }>;
  public readonly searchIssueStorage: OperationalStorageProjection<"issueId">;
  public readonly searchNotificationStorage: OperationalStorageProjection<"notificationId">;
  public readonly searchAttentionMessageStorage: OperationalStorageProjection<"messageId">;
  public readonly searchAttentionDeliveryStorage: OperationalStorageProjection<"deliveryId">;
  public readonly semanticReviewStorage: OperationalStorageProjection<"reviewId">;
  public readonly semanticReviewJobStorage: OperationalStorageProjection<"jobId">;
  public readonly semanticReviewNotificationStorage: OperationalStorageProjection<"notificationId">;
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
      this.#pruneUnreferencedSearchLeaseCorpora();
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
    this.searchLeaseStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "leaseId",
    });
    this.searchLeaseCorpusStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "snapshotIdentity",
    });
    this.searchQuoteObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.searchIssueStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "issueId",
    });
    this.searchNotificationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "notificationId",
    });
    this.searchAttentionMessageStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "messageId",
    });
    this.searchAttentionDeliveryStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "deliveryId",
    });
    this.semanticReviewStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "reviewId",
    });
    this.semanticReviewJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
    });
    this.semanticReviewNotificationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "notificationId",
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
    const searchLeaseTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_lease_records'`,
      )
      .get() !== undefined;
    const searchLeaseCorpusTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_lease_corpora'`,
      )
      .get() !== undefined;
    const searchIssueTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_issue_records'`,
      )
      .get() !== undefined;
    const searchNotificationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_notification_records'`,
      )
      .get() !== undefined;
    const searchAttentionMessageTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_attention_messages'`,
      )
      .get() !== undefined;
    const searchAttentionDeliveryTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_attention_deliveries'`,
      )
      .get() !== undefined;
    const semanticReviewJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'semantic_review_jobs'`,
      )
      .get() !== undefined;
    const semanticReviewNotificationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'semantic_review_notifications'`,
      )
      .get() !== undefined;
    const searchQuoteObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_quote_observations'`,
      )
      .get() !== undefined;
    if (
      current === SCHEMA_VERSION &&
      searchLeaseTableExists &&
      searchLeaseCorpusTableExists &&
      searchIssueTableExists &&
      searchNotificationTableExists &&
      searchAttentionMessageTableExists &&
      searchAttentionDeliveryTableExists &&
      semanticReviewJobTableExists &&
      semanticReviewNotificationTableExists &&
      searchQuoteObservationTableExists
    ) return;
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
      if (current < 9 || !searchLeaseTableExists) {
        this.#database.exec(`
          CREATE TABLE search_lease_records (
            lease_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(lease_id) = 71 AND lease_id GLOB 'sha256:[0-9a-f]*'
            ),
            snapshot_identity TEXT NOT NULL CHECK (
              length(snapshot_identity) = 71 AND
              snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            lens TEXT NOT NULL CHECK (
              lens IN ('EQUIVALENCE', 'IMPLICATION', 'PARTITION', 'MECHANISM')
            ),
            status TEXT NOT NULL CHECK (status IN ('ISSUED', 'PASS', 'FAILED')),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE UNIQUE INDEX search_lease_snapshot_lens
            ON search_lease_records (snapshot_identity, lens);
          CREATE INDEX search_lease_records_updated
            ON search_lease_records (updated_at DESC, lease_id DESC);
        `);
      }
      if (current < 10 || !searchIssueTableExists || !searchNotificationTableExists) {
        this.#database.exec(`
          DROP INDEX IF EXISTS search_lease_snapshot_lens;
          CREATE INDEX IF NOT EXISTS search_lease_snapshot_lens
            ON search_lease_records (snapshot_identity, lens);

          CREATE TABLE IF NOT EXISTS search_issue_records (
            issue_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(issue_id) = 71 AND issue_id GLOB 'sha256:[0-9a-f]*'
            ),
            priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
            enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
            next_run_at TEXT NOT NULL CHECK (length(next_run_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS search_issue_due
            ON search_issue_records (enabled DESC, next_run_at, priority DESC);

          CREATE TABLE IF NOT EXISTS search_notification_records (
            notification_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(notification_id) = 71 AND
              notification_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND
              dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READ')),
            created_at TEXT NOT NULL CHECK (length(created_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS search_notifications_status_created
            ON search_notification_records (status, created_at DESC);
        `);
      }
      if (
        current < 11 ||
        !semanticReviewJobTableExists ||
        !semanticReviewNotificationTableExists
      ) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS semantic_review_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'BLOCKED_EVIDENCE',
                'PASS', 'EXHAUSTED', 'RESEARCH_ONLY', 'DUPLICATE_SCOPE'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS semantic_review_jobs_due
            ON semantic_review_jobs (status, next_attempt_at, priority DESC);

          CREATE TABLE IF NOT EXISTS semantic_review_notifications (
            notification_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(notification_id) = 71 AND
              notification_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND
              dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READ')),
            created_at TEXT NOT NULL CHECK (length(created_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS semantic_review_notifications_status_created
            ON semantic_review_notifications (status, created_at DESC);
        `);
      }
      if (current === 11 && semanticReviewJobTableExists) {
        this.#database.exec(`
          DROP INDEX IF EXISTS semantic_review_jobs_due;
          ALTER TABLE semantic_review_jobs RENAME TO semantic_review_jobs_v11;
          CREATE TABLE semantic_review_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'BLOCKED_EVIDENCE',
                'PASS', 'EXHAUSTED'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          INSERT INTO semantic_review_jobs
            SELECT * FROM semantic_review_jobs_v11;
          DROP TABLE semantic_review_jobs_v11;
          CREATE INDEX semantic_review_jobs_due
            ON semantic_review_jobs (status, next_attempt_at, priority DESC);
        `);
      }
      if (current < 13 || !searchLeaseCorpusTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS search_lease_corpora (
            snapshot_identity TEXT PRIMARY KEY NOT NULL CHECK (
              length(snapshot_identity) = 71 AND
              snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_set_identity TEXT NOT NULL CHECK (
              length(source_set_identity) = 71 AND
              source_set_identity GLOB 'sha256:[0-9a-f]*'
            ),
            listing_count INTEGER NOT NULL CHECK (
              listing_count BETWEEN 0 AND 5000
            ),
            created_at TEXT NOT NULL CHECK (length(created_at) > 0),
            corpus_json TEXT NOT NULL CHECK (json_valid(corpus_json)),
            corpus_hash TEXT NOT NULL CHECK (
              length(corpus_hash) = 71 AND corpus_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS search_lease_corpora_created
            ON search_lease_corpora (created_at DESC, snapshot_identity DESC);
        `);
      }
      if (current < 14 || !searchQuoteObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS search_quote_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND
              observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            listing_ref TEXT NOT NULL CHECK (length(listing_ref) > 0),
            venue_id TEXT NOT NULL CHECK (venue_id = 'opinion'),
            received_at TEXT NOT NULL CHECK (length(received_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            raw_bytes BLOB NOT NULL
          ) STRICT;
          CREATE INDEX IF NOT EXISTS search_quote_observations_received
            ON search_quote_observations (received_at DESC, observation_id DESC);
          CREATE INDEX IF NOT EXISTS search_quote_observations_listing
            ON search_quote_observations (listing_ref, received_at DESC);
        `);
      }
      if (
        current < 15 ||
        !searchAttentionMessageTableExists ||
        !searchAttentionDeliveryTableExists
      ) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS search_attention_messages (
            message_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(message_id) = 71 AND message_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND
              dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            kind TEXT NOT NULL CHECK (
              kind IN ('HOURLY_DIGEST', 'ACTION_CANDIDATE', 'ISSUE_DEGRADED')
            ),
            severity TEXT NOT NULL CHECK (
              severity IN ('ROUTINE', 'WATCH', 'ACTION', 'DEGRADED')
            ),
            occurred_at TEXT NOT NULL CHECK (length(occurred_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS search_attention_messages_occurred
            ON search_attention_messages (occurred_at DESC, message_id DESC);

          CREATE TABLE IF NOT EXISTS search_attention_deliveries (
            delivery_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(delivery_id) = 71 AND delivery_id GLOB 'sha256:[0-9a-f]*'
            ),
            message_id TEXT NOT NULL CHECK (
              length(message_id) = 71 AND message_id GLOB 'sha256:[0-9a-f]*'
            ),
            channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'WEBHOOK_JSON')),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'RETRY_WAIT', 'DELIVERED', 'ACKNOWLEDGED',
                'DEAD_LETTER'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (message_id) REFERENCES search_attention_messages(message_id)
              ON DELETE CASCADE
          ) STRICT;
          CREATE UNIQUE INDEX IF NOT EXISTS search_attention_delivery_channel
            ON search_attention_deliveries (message_id, channel);
          CREATE INDEX IF NOT EXISTS search_attention_deliveries_due
            ON search_attention_deliveries (status, next_attempt_at, delivery_id);
        `);
      }
      if (current < 16) {
        this.#database.exec(`
          DROP INDEX IF EXISTS semantic_review_jobs_due;
          ALTER TABLE semantic_review_jobs RENAME TO semantic_review_jobs_v15;
          CREATE TABLE semantic_review_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'BLOCKED_EVIDENCE',
                'PASS', 'EXHAUSTED', 'RESEARCH_ONLY'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          INSERT INTO semantic_review_jobs
            SELECT * FROM semantic_review_jobs_v15;
          DROP TABLE semantic_review_jobs_v15;
          CREATE INDEX semantic_review_jobs_due
            ON semantic_review_jobs (status, next_attempt_at, priority DESC);
        `);
      }
      if (current < 17) {
        this.#database.exec(`
          DROP INDEX IF EXISTS semantic_review_jobs_due;
          ALTER TABLE semantic_review_jobs RENAME TO semantic_review_jobs_v16;
          CREATE TABLE semantic_review_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'BLOCKED_EVIDENCE',
                'PASS', 'EXHAUSTED', 'RESEARCH_ONLY', 'DUPLICATE_SCOPE'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          INSERT INTO semantic_review_jobs
            SELECT * FROM semantic_review_jobs_v16;
          DROP TABLE semantic_review_jobs_v16;
          CREATE INDEX semantic_review_jobs_due
            ON semantic_review_jobs (status, next_attempt_at, priority DESC);
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

  #pruneUnreferencedSearchLeaseCorpora(): void {
    this.#database
      .prepare(
        `DELETE FROM search_lease_corpora
         WHERE NOT EXISTS (
           SELECT 1 FROM search_lease_records
           WHERE search_lease_records.snapshot_identity =
                 search_lease_corpora.snapshot_identity
         )`,
      )
      .run();
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

  public loadSearchQuoteObservations(
    limit: number,
  ): readonly StoredSearchQuoteObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT observation_id, record_json, record_hash, raw_bytes
         FROM search_quote_observations
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseStoredSearchQuoteObservation));
  }

  public saveSearchQuoteObservation(
    observation: StoredSearchQuoteObservation,
    retentionLimit: number,
  ): StoredSearchQuoteObservation {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = verifyStoredSearchQuoteObservation(observation);
    const recordJson = canonicalJson(validated.record);
    const recordHash = hashCanonical(validated.record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO search_quote_observations (
             observation_id, listing_ref, venue_id, received_at,
             record_json, record_hash, raw_bytes
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        )
        .run(
          validated.record.observationId,
          validated.record.listingRef,
          validated.record.venueId,
          validated.record.receivedAt,
          recordJson,
          recordHash,
          validated.bytes,
        );
      this.#database
        .prepare(
          `DELETE FROM search_quote_observations
           WHERE observation_id IN (
             SELECT observation_id
             FROM search_quote_observations
             ORDER BY rowid DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT observation_id, record_json, record_hash, raw_bytes
           FROM search_quote_observations
           WHERE observation_id = ?`,
        )
        .get(validated.record.observationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the search quote observation");
      }
      const stored = parseStoredSearchQuoteObservation(row);
      if (hashCanonical(stored.record) !== recordHash) {
        throw new Error("observationId is already bound to other search quote evidence");
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

  public loadSearchLeaseRecords(
    limit: number,
  ): readonly SearchLeaseRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT lease_id, snapshot_identity, lens, status,
                record_json, record_hash
         FROM search_lease_records
         ORDER BY rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSearchLeaseRecord));
  }

  public saveSearchLeaseCorpus(
    value: MarketCorpusSnapshot,
  ): MarketCorpusSnapshot {
    this.#assertOpen();
    const snapshot = assertMarketCorpusSnapshot(value);
    const corpusJson = canonicalJson(snapshot);
    if (Buffer.byteLength(corpusJson, "utf8") > MAX_SEARCH_LEASE_CORPUS_BYTES) {
      throw new Error("search lease corpus exceeds the retained byte limit");
    }
    const corpusHash = hashCanonical(snapshot);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.#database
        .prepare(
          `SELECT snapshot_identity, source_set_identity, listing_count,
                  corpus_json, corpus_hash
           FROM search_lease_corpora WHERE snapshot_identity = ?`,
        )
        .get(snapshot.snapshotIdentity);
      if (prior !== undefined) {
        const retained = parseSearchLeaseCorpus(prior);
        if (hashCanonical(retained) !== corpusHash) {
          throw new Error("snapshotIdentity is already bound to another search corpus");
        }
        this.#database.exec("COMMIT");
        return retained;
      }
      this.#database
        .prepare(
          `INSERT INTO search_lease_corpora (
             snapshot_identity, source_set_identity, listing_count, created_at,
             corpus_json, corpus_hash
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          snapshot.snapshotIdentity,
          snapshot.sourceSetIdentity,
          snapshot.listingCount,
          new Date().toISOString(),
          corpusJson,
          corpusHash,
        );
      const row = this.#database
        .prepare(
          `SELECT snapshot_identity, source_set_identity, listing_count,
                  corpus_json, corpus_hash
           FROM search_lease_corpora WHERE snapshot_identity = ?`,
        )
        .get(snapshot.snapshotIdentity);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the search lease corpus");
      }
      const retained = parseSearchLeaseCorpus(row);
      this.#database.exec("COMMIT");
      return retained;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSearchLeaseCorpus(
    snapshotIdentity: Hash,
  ): MarketCorpusSnapshot | null {
    this.#assertOpen();
    const row = this.#database
      .prepare(
        `SELECT snapshot_identity, source_set_identity, listing_count,
                corpus_json, corpus_hash
         FROM search_lease_corpora WHERE snapshot_identity = ?`,
      )
      .get(snapshotIdentity);
    return row === undefined ? null : parseSearchLeaseCorpus(row);
  }

  public hasSearchLeaseCorpus(snapshotIdentity: Hash): boolean {
    return this.loadSearchLeaseCorpus(snapshotIdentity) !== null;
  }

  public countSearchLeaseCorpora(): number {
    this.#assertOpen();
    const row = this.#database
      .prepare("SELECT COUNT(*) AS count FROM search_lease_corpora")
      .get() as { count?: number | bigint } | undefined;
    const count = Number(row?.count ?? -1);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("SQLite search lease corpus count is invalid");
    }
    return count;
  }

  public saveSearchLeaseRecord(
    record: SearchLeaseRecord,
    retentionLimit: number,
  ): SearchLeaseRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertSearchLeaseRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const priorRow = this.#database
        .prepare(
          `SELECT lease_id, snapshot_identity, lens, status,
                  record_json, record_hash
           FROM search_lease_records WHERE lease_id = ?`,
        )
        .get(validated.lease.leaseId);
      if (priorRow !== undefined) {
        const prior = parseSearchLeaseRecord(priorRow);
        const exactReplay = hashCanonical(prior) === recordHash;
        if (
          (!exactReplay && prior.status !== "ISSUED") ||
          (!exactReplay && validated.status === "ISSUED") ||
          prior.lease.snapshotIdentity !== validated.lease.snapshotIdentity ||
          prior.lease.lens !== validated.lease.lens ||
          hashCanonical(prior.lease) !== hashCanonical(validated.lease)
        ) {
          throw new Error("search lease record cannot rewrite issued scope or a terminal result");
        }
      }
      this.#database
        .prepare(
          `INSERT INTO search_lease_records (
             lease_id, snapshot_identity, lens, status, updated_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(lease_id) DO UPDATE SET
             status = excluded.status,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE search_lease_records.status = 'ISSUED'`,
        )
        .run(
          validated.lease.leaseId,
          validated.lease.snapshotIdentity,
          validated.lease.lens,
          validated.status,
          validated.completedAt ?? validated.lease.issuedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM search_lease_records
           WHERE lease_id IN (
             SELECT lease_id FROM search_lease_records
             WHERE status IN ('PASS', 'FAILED')
             ORDER BY rowid DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      this.#pruneUnreferencedSearchLeaseCorpora();
      const row = this.#database
        .prepare(
          `SELECT lease_id, snapshot_identity, lens, status,
                  record_json, record_hash
           FROM search_lease_records WHERE lease_id = ?`,
        )
        .get(validated.lease.leaseId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the search lease record");
      }
      const stored = parseSearchLeaseRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("leaseId is already bound to another search lease record");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSearchIssueRecords(limit: number): readonly SearchIssueRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT issue_id, record_json, record_hash
         FROM search_issue_records
         ORDER BY priority DESC, next_run_at, issue_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSearchIssueRecord));
  }

  public saveSearchIssueRecord(record: SearchIssueRecord): SearchIssueRecord {
    this.#assertOpen();
    const validated = assertSearchIssueRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database
      .prepare(
        `INSERT INTO search_issue_records (
           issue_id, priority, enabled, next_run_at, updated_at,
           record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(issue_id) DO UPDATE SET
           priority = excluded.priority,
           enabled = excluded.enabled,
           next_run_at = excluded.next_run_at,
           updated_at = excluded.updated_at,
           record_json = excluded.record_json,
           record_hash = excluded.record_hash`,
      )
      .run(
        validated.issueId,
        validated.priority,
        validated.enabled ? 1 : 0,
        validated.nextRunAt,
        validated.updatedAt,
        recordJson,
        recordHash,
      );
    const row = this.#database
      .prepare(
        `SELECT issue_id, record_json, record_hash
         FROM search_issue_records WHERE issue_id = ?`,
      )
      .get(validated.issueId);
    if (row === undefined) throw new Error("SQLite failed to retain the search issue");
    const stored = parseSearchIssueRecord(row);
    if (hashCanonical(stored) !== recordHash) {
      throw new Error("issueId is already bound to another search issue");
    }
    return stored;
  }

  public loadSearchNotificationRecords(
    limit: number,
  ): readonly SearchNotificationRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT notification_id, record_json, record_hash
         FROM search_notification_records
         ORDER BY created_at DESC, notification_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSearchNotificationRecord));
  }

  public saveSearchNotificationRecord(
    record: SearchNotificationRecord,
    retentionLimit: number,
  ): SearchNotificationRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertSearchNotificationRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO search_notification_records (
             notification_id, dedupe_identity, status, created_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(notification_id) DO UPDATE SET
             status = excluded.status,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.notificationId,
          validated.dedupeIdentity,
          validated.status,
          validated.createdAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM search_notification_records
           WHERE notification_id IN (
             SELECT notification_id FROM search_notification_records
             ORDER BY created_at DESC, notification_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT notification_id, record_json, record_hash
           FROM search_notification_records WHERE notification_id = ?`,
        )
        .get(validated.notificationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the search notification");
      }
      const stored = parseSearchNotificationRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("notificationId is already bound to another notification");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSearchAttentionMessages(
    limit: number,
  ): readonly SearchAttentionMessageRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT message_id, record_json, record_hash
         FROM search_attention_messages
         ORDER BY occurred_at DESC, message_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSearchAttentionMessage));
  }

  public saveSearchAttentionMessage(
    record: SearchAttentionMessageRecord,
    retentionLimit: number,
  ): SearchAttentionMessageRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertSearchAttentionMessage(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO search_attention_messages (
             message_id, dedupe_identity, kind, severity, occurred_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id) DO NOTHING`,
        )
        .run(
          validated.messageId,
          validated.dedupeIdentity,
          validated.kind,
          validated.severity,
          validated.occurredAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM search_attention_messages
           WHERE message_id IN (
             SELECT message_id FROM search_attention_messages
             ORDER BY occurred_at DESC, message_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT message_id, record_json, record_hash
           FROM search_attention_messages WHERE message_id = ?`,
        )
        .get(validated.messageId);
      if (row === undefined) throw new Error("SQLite failed to retain the search attention message");
      const stored = parseSearchAttentionMessage(row);
      if (stored.artifactHash !== validated.artifactHash || hashCanonical(stored) !== recordHash) {
        throw new Error("messageId is already bound to another search attention message");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSearchAttentionDeliveries(
    limit: number,
  ): readonly SearchAttentionDeliveryRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT delivery_id, record_json, record_hash
         FROM search_attention_deliveries
         ORDER BY updated_at DESC, delivery_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSearchAttentionDelivery));
  }

  public saveSearchAttentionDelivery(
    record: SearchAttentionDeliveryRecord,
    retentionLimit: number,
  ): SearchAttentionDeliveryRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertSearchAttentionDelivery(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existingRow = this.#database
        .prepare(
          `SELECT delivery_id, record_json, record_hash
           FROM search_attention_deliveries WHERE delivery_id = ?`,
        )
        .get(validated.deliveryId);
      if (existingRow !== undefined) {
        const existing = parseSearchAttentionDelivery(existingRow);
        const transitions: Readonly<Record<SearchAttentionDeliveryRecord["status"],
          readonly SearchAttentionDeliveryRecord["status"][]>> = {
          PENDING: ["PENDING", "RETRY_WAIT", "DELIVERED", "DEAD_LETTER"],
          RETRY_WAIT: ["RETRY_WAIT", "DELIVERED", "DEAD_LETTER"],
          DELIVERED: ["DELIVERED", "ACKNOWLEDGED"],
          ACKNOWLEDGED: ["ACKNOWLEDGED"],
          DEAD_LETTER: ["DEAD_LETTER"],
        };
        if (
          existing.messageId !== validated.messageId ||
          existing.channel !== validated.channel ||
          !transitions[existing.status].includes(validated.status) ||
          validated.attemptCount < existing.attemptCount ||
          validated.attemptCount > existing.attemptCount + 1
        ) throw new Error("search attention delivery transition is invalid");
      }
      this.#database
        .prepare(
          `INSERT INTO search_attention_deliveries (
             delivery_id, message_id, channel, status, next_attempt_at,
             updated_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(delivery_id) DO UPDATE SET
             status = excluded.status,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.deliveryId,
          validated.messageId,
          validated.channel,
          validated.status,
          validated.nextAttemptAt,
          validated.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM search_attention_deliveries
           WHERE delivery_id IN (
             SELECT delivery_id FROM search_attention_deliveries
             ORDER BY updated_at DESC, delivery_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT delivery_id, record_json, record_hash
           FROM search_attention_deliveries WHERE delivery_id = ?`,
        )
        .get(validated.deliveryId);
      if (row === undefined) throw new Error("SQLite failed to retain the search attention delivery");
      const stored = parseSearchAttentionDelivery(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("deliveryId is already bound to another search attention delivery");
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

  public loadSemanticReviewJobRecords(
    limit: number,
  ): readonly SemanticReviewJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM semantic_review_jobs
         ORDER BY priority DESC, next_attempt_at, job_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSemanticReviewJobRecord));
  }

  public saveSemanticReviewJobRecord(
    record: SemanticReviewJobRecord,
  ): SemanticReviewJobRecord {
    this.#assertOpen();
    const validated = assertSemanticReviewJobRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database
      .prepare(
        `INSERT INTO semantic_review_jobs (
           job_id, priority, status, next_attempt_at, updated_at,
           record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(job_id) DO UPDATE SET
           priority = excluded.priority,
           status = excluded.status,
           next_attempt_at = excluded.next_attempt_at,
           updated_at = excluded.updated_at,
           record_json = excluded.record_json,
           record_hash = excluded.record_hash`,
      )
      .run(
        validated.jobId,
        validated.priority,
        validated.status,
        validated.nextAttemptAt,
        validated.updatedAt,
        recordJson,
        recordHash,
      );
    const row = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM semantic_review_jobs WHERE job_id = ?`,
      )
      .get(validated.jobId);
    if (row === undefined) throw new Error("SQLite failed to retain the semantic review job");
    const stored = parseSemanticReviewJobRecord(row);
    if (hashCanonical(stored) !== recordHash) {
      throw new Error("jobId is already bound to another semantic review job");
    }
    return stored;
  }

  public loadSemanticReviewNotificationRecords(
    limit: number,
  ): readonly SemanticReviewNotificationRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT notification_id, record_json, record_hash
         FROM semantic_review_notifications
         ORDER BY created_at DESC, notification_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSemanticReviewNotificationRecord));
  }

  public saveSemanticReviewNotificationRecord(
    record: SemanticReviewNotificationRecord,
    retentionLimit: number,
  ): SemanticReviewNotificationRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertSemanticReviewNotificationRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO semantic_review_notifications (
             notification_id, dedupe_identity, status, created_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(notification_id) DO UPDATE SET
             status = excluded.status,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.notificationId,
          validated.dedupeIdentity,
          validated.status,
          validated.createdAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM semantic_review_notifications
           WHERE notification_id IN (
             SELECT notification_id FROM semantic_review_notifications
             ORDER BY created_at DESC, notification_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT notification_id, record_json, record_hash
           FROM semantic_review_notifications WHERE notification_id = ?`,
        )
        .get(validated.notificationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the semantic review notification");
      }
      const stored = parseSemanticReviewNotificationRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("notificationId is already bound to another review notification");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
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
