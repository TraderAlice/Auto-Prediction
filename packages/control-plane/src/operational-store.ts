import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson, hashBytes, hashCanonical, type Hash } from "@pmh/domain";
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
  assertPremiseAnalysisRecord,
  type PremiseAnalysisRecord,
  type PremiseAnalysisRecordStore,
} from "./premise-analysis.js";
import {
  assertProbabilityEstimationRunRecord,
  type ProbabilityEstimationRunRecord,
  type ProbabilityEstimationRunStore,
} from "./probability-estimation-agent.js";
import {
  assertProbabilityEstimationJobRecord,
  assertProbabilityEstimationNotificationRecord,
  type ProbabilityEstimationJobRecord,
  type ProbabilityEstimationNotificationRecord,
  type ProbabilityEstimationSchedulerStore,
} from "./probability-estimation-scheduler.js";
import {
  assertPremiseAnalysisJobRecord,
  assertPremiseAnalysisNotificationRecord,
  type PremiseAnalysisJobRecord,
  type PremiseAnalysisNotificationRecord,
  type PremiseAnalysisSchedulerStore,
} from "./premise-analysis-scheduler.js";
import {
  assertPremiseEvidenceRoutingJobRecord,
  type PremiseEvidenceRoutingJobRecord,
  type PremiseEvidenceRoutingSchedulerStore,
} from "./premise-evidence-routing-scheduler.js";
import {
  assertPremiseRouteExpansionJobRecord,
  type PremiseRouteExpansionJobRecord,
  type PremiseRouteExpansionSchedulerStore,
} from "./premise-route-expansion-scheduler.js";
import {
  assertSemanticReviewJobRecord,
  assertSemanticReviewNotificationRecord,
  type SemanticReviewJobRecord,
  type SemanticReviewNotificationRecord,
  type SemanticReviewSchedulerStore,
} from "./semantic-review-scheduler.js";
import {
  assertEvidenceAcquisitionJobRecord,
  type EvidenceAcquisitionJobRecord,
  type EvidenceAcquisitionSchedulerStore,
} from "./evidence-acquisition-scheduler.js";
import {
  assertEvidenceDocumentCapture,
  assertEvidenceDocumentObservation,
  assertStoredEvidenceDocument,
  assertStoredEvidenceDocumentText,
  type EvidenceDocumentCapture,
  type EvidenceDocumentObservation,
  type EvidenceDocumentRecord,
  type EvidenceDocumentTextRecord,
  type StoredEvidenceDocument,
  type StoredEvidenceDocumentText,
} from "./evidence-document.js";
import {
  assertRuleEvidenceClaimRecord,
  type RuleEvidenceClaimRecord,
  type RuleEvidenceClaimRecordStore,
} from "./rule-evidence-claim.js";
import {
  assertRuleEvidenceClaimJobRecord,
  type RuleEvidenceClaimJobRecord,
  type RuleEvidenceClaimSchedulerStore,
} from "./rule-evidence-claim-scheduler.js";
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
import {
  assertAiUsageEvent,
  type AiUsageEvent,
  type AiUsageEventStore,
} from "./ai-usage-ledger.js";
import {
  assertAiRuntimeConfiguration,
  type AiRuntimeConfiguration,
  type AiRuntimeConfigurationStore,
} from "./ai-runtime-configuration.js";
import {
  assertProbabilityCalibrationArtifact,
  assertProbabilityCalibrationObservation,
  type ProbabilityCalibrationArtifact,
  type ProbabilityCalibrationObservation,
} from "./probability-calibration.js";
import type { ProbabilityCalibrationStore } from "./probability-calibration-desk.js";
import {
  assertProbabilityResolutionCapture,
  type ProbabilityResolutionCapture,
  type ProbabilityResolutionCaptureStore,
} from "./probability-resolution-acquisition.js";
import {
  assertProbabilisticSemanticBound,
  type ProbabilisticSemanticBoundArtifact,
} from "./probabilistic-semantic-arbitrage.js";

const SCHEMA_VERSION = 32;
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

type StoredAiUsageEventRow = Readonly<{
  event_id: string;
  record_json: string;
  record_hash: string;
}>;

type StoredAiRuntimeConfigurationRow = Readonly<{
  singleton_key: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityCalibrationObservationRow = Readonly<{
  artifact_hash: string;
  bound_artifact_hash: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityCalibrationBoundRow = Readonly<{
  artifact_hash: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityCalibrationSnapshotRow = Readonly<{
  artifact_hash: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityResolutionCaptureRow = Readonly<{
  artifact_hash: string;
  listing_ref: string;
  source_raw_hash: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityResolutionSourceRow = Readonly<{
  raw_hash: string;
  byte_length: number | bigint;
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

type ProbabilityEstimationRunRow = Readonly<{
  run_id: string;
  semantic_review_artifact_hash: string;
  semantic_constraint_artifact_hash: string;
  role: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityEstimationJobRow = Readonly<{
  job_id: string;
  record_json: string;
  record_hash: string;
}>;

type ProbabilityEstimationNotificationRow = Readonly<{
  notification_id: string;
  record_json: string;
  record_hash: string;
}>;

type PremiseAnalysisRow = Readonly<{
  analysis_id: string;
  proposal_id: string;
  semantic_review_artifact_hash: string;
  evidence_scope_identity: string;
  record_json: string;
  record_hash: string;
}>;

type PremiseAnalysisJobRow = Readonly<{
  job_id: string;
  record_json: string;
  record_hash: string;
}>;

type PremiseEvidenceRoutingJobRow = Readonly<{
  job_id: string;
  record_json: string;
  record_hash: string;
}>;
type PremiseRouteExpansionJobRow = PremiseEvidenceRoutingJobRow;

type PremiseAnalysisNotificationRow = Readonly<{
  notification_id: string;
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

type EvidenceAcquisitionJobRow = Readonly<{
  job_id: string;
  record_json: string;
  record_hash: string;
}>;

type EvidenceDocumentRow = Readonly<{
  document_id: string;
  record_json: string;
  record_hash: string;
  raw_bytes: Uint8Array;
}>;

type EvidenceDocumentTextRow = Readonly<{
  extraction_id: string;
  document_id: string;
  record_json: string;
  record_hash: string;
  extracted_text: string;
}>;

type EvidenceDocumentObservationRow = Readonly<{
  observation_id: string;
  acquisition_job_id: string;
  document_id: string;
  record_json: string;
  record_hash: string;
}>;

type RuleEvidenceClaimJobRow = Readonly<{
  job_id: string;
  record_json: string;
  record_hash: string;
}>;

type RuleEvidenceClaimRecordRow = Readonly<{
  interpretation_id: string;
  requirement_id: string;
  document_id: string;
  extraction_id: string;
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

function parseProbabilityEstimationRunRecord(
  value: unknown,
): ProbabilityEstimationRunRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability estimation row is malformed");
  }
  const row = value as Partial<ProbabilityEstimationRunRow>;
  if (
    typeof row.run_id !== "string" ||
    typeof row.semantic_review_artifact_hash !== "string" ||
    typeof row.semantic_constraint_artifact_hash !== "string" ||
    typeof row.role !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite probability estimation row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite probability estimation record contains invalid JSON");
  }
  const record = assertProbabilityEstimationRunRecord(decoded);
  if (
    record.runId !== row.run_id ||
    record.semanticReviewArtifactHash !== row.semantic_review_artifact_hash ||
    record.semanticConstraintArtifactHash !== row.semantic_constraint_artifact_hash ||
    record.role !== row.role || hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite probability estimation record identity mismatch");
  return record;
}

function parseProbabilityEstimationJobRecord(
  value: unknown,
): ProbabilityEstimationJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability estimation job row is malformed");
  }
  const row = value as Partial<ProbabilityEstimationJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite probability estimation job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite probability estimation job contains invalid JSON");
  }
  const record = assertProbabilityEstimationJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite probability estimation job identity mismatch");
  }
  return record;
}

function parseProbabilityEstimationNotificationRecord(
  value: unknown,
): ProbabilityEstimationNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability estimation notification row is malformed");
  }
  const row = value as Partial<ProbabilityEstimationNotificationRow>;
  if (
    typeof row.notification_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite probability estimation notification row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite probability estimation notification contains invalid JSON");
  }
  const record = assertProbabilityEstimationNotificationRecord(decoded);
  if (
    record.notificationId !== row.notification_id ||
    hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite probability estimation notification identity mismatch");
  return record;
}

function parsePremiseAnalysisRecord(value: unknown): PremiseAnalysisRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite premise analysis row is malformed");
  }
  const row = value as Partial<PremiseAnalysisRow>;
  if (
    typeof row.analysis_id !== "string" || typeof row.proposal_id !== "string" ||
    typeof row.semantic_review_artifact_hash !== "string" ||
    typeof row.evidence_scope_identity !== "string" ||
    typeof row.record_json !== "string" || typeof row.record_hash !== "string"
  ) throw new Error("SQLite premise analysis row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite premise analysis record contains invalid JSON");
  }
  const record = assertPremiseAnalysisRecord(decoded);
  if (
    record.status === "RUNNING" || record.analysisId !== row.analysis_id ||
    record.proposalId !== row.proposal_id ||
    record.semanticReviewArtifactHash !== row.semantic_review_artifact_hash ||
    record.evidenceScopeIdentity !== row.evidence_scope_identity ||
    hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite premise analysis record identity mismatch");
  return record;
}

function parsePremiseAnalysisJobRecord(value: unknown): PremiseAnalysisJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite premise analysis job row is malformed");
  }
  const row = value as Partial<PremiseAnalysisJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite premise analysis job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite premise analysis job contains invalid JSON");
  }
  const record = assertPremiseAnalysisJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite premise analysis job identity mismatch");
  }
  return record;
}

function parsePremiseEvidenceRoutingJobRecord(
  value: unknown,
): PremiseEvidenceRoutingJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite premise evidence routing job row is malformed");
  }
  const row = value as Partial<PremiseEvidenceRoutingJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite premise evidence routing job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite premise evidence routing job contains invalid JSON");
  }
  const record = assertPremiseEvidenceRoutingJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite premise evidence routing job identity mismatch");
  }
  return record;
}

function parsePremiseRouteExpansionJobRecord(
  value: unknown,
): PremiseRouteExpansionJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite premise route expansion job row is malformed");
  }
  const row = value as Partial<PremiseRouteExpansionJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite premise route expansion job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite premise route expansion job contains invalid JSON");
  }
  const record = assertPremiseRouteExpansionJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite premise route expansion job identity mismatch");
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

function parsePremiseAnalysisNotificationRecord(
  value: unknown,
): PremiseAnalysisNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite premise analysis notification row is malformed");
  }
  const row = value as Partial<PremiseAnalysisNotificationRow>;
  if (
    typeof row.notification_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite premise analysis notification row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite premise analysis notification contains invalid JSON");
  }
  const record = assertPremiseAnalysisNotificationRecord(decoded);
  if (record.notificationId !== row.notification_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite premise analysis notification identity mismatch");
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

function parseEvidenceAcquisitionJobRecord(value: unknown): EvidenceAcquisitionJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite evidence acquisition job row is malformed");
  }
  const row = value as Partial<EvidenceAcquisitionJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite evidence acquisition job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite evidence acquisition job contains invalid JSON");
  }
  const record = assertEvidenceAcquisitionJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite evidence acquisition job identity mismatch");
  }
  return record;
}

function parseEvidenceDocument(value: unknown): StoredEvidenceDocument {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite evidence document row is malformed");
  }
  const row = value as Partial<EvidenceDocumentRow>;
  if (
    typeof row.document_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string" || !(row.raw_bytes instanceof Uint8Array)
  ) throw new Error("SQLite evidence document row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite evidence document contains invalid JSON");
  }
  const document = assertStoredEvidenceDocument({
    record: decoded as EvidenceDocumentRecord,
    bytes: row.raw_bytes,
  });
  if (
    document.record.documentId !== row.document_id ||
    hashCanonical(document.record) !== row.record_hash
  ) throw new Error("SQLite evidence document identity mismatch");
  return document;
}

function parseEvidenceDocumentText(value: unknown): StoredEvidenceDocumentText {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite evidence document text row is malformed");
  }
  const row = value as Partial<EvidenceDocumentTextRow>;
  if (
    typeof row.extraction_id !== "string" || typeof row.document_id !== "string" ||
    typeof row.record_json !== "string" || typeof row.record_hash !== "string" ||
    typeof row.extracted_text !== "string"
  ) throw new Error("SQLite evidence document text row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite evidence document text contains invalid JSON");
  }
  const extraction = assertStoredEvidenceDocumentText({
    record: decoded as EvidenceDocumentTextRecord,
    text: row.extracted_text,
  });
  if (
    extraction.record.extractionId !== row.extraction_id ||
    extraction.record.documentId !== row.document_id ||
    hashCanonical(extraction.record) !== row.record_hash
  ) throw new Error("SQLite evidence document text identity mismatch");
  return extraction;
}

function parseEvidenceDocumentObservation(
  value: unknown,
): Readonly<{ jobId: Hash; observation: EvidenceDocumentObservation }> {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite evidence document observation row is malformed");
  }
  const row = value as Partial<EvidenceDocumentObservationRow>;
  if (
    typeof row.observation_id !== "string" ||
    typeof row.acquisition_job_id !== "string" || typeof row.document_id !== "string" ||
    typeof row.record_json !== "string" || typeof row.record_hash !== "string"
  ) throw new Error("SQLite evidence document observation row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite evidence document observation contains invalid JSON");
  }
  const observation = assertEvidenceDocumentObservation(decoded);
  if (
    observation.observationId !== row.observation_id ||
    observation.documentId !== row.document_id ||
    hashCanonical(observation) !== row.record_hash ||
    !/^sha256:[0-9a-f]{64}$/u.test(row.acquisition_job_id)
  ) throw new Error("SQLite evidence document observation identity mismatch");
  return Object.freeze({ jobId: row.acquisition_job_id as Hash, observation });
}

function parseRuleEvidenceClaimJobRecord(value: unknown): RuleEvidenceClaimJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite rule evidence claim job row is malformed");
  }
  const row = value as Partial<RuleEvidenceClaimJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite rule evidence claim job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite rule evidence claim job contains invalid JSON");
  }
  const record = assertRuleEvidenceClaimJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite rule evidence claim job identity mismatch");
  }
  return record;
}

function parseRuleEvidenceClaimRecord(value: unknown): RuleEvidenceClaimRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite rule evidence claim record row is malformed");
  }
  const row = value as Partial<RuleEvidenceClaimRecordRow>;
  if (
    typeof row.interpretation_id !== "string" ||
    typeof row.requirement_id !== "string" || typeof row.document_id !== "string" ||
    typeof row.extraction_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite rule evidence claim record row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite rule evidence claim record contains invalid JSON");
  }
  const record = assertRuleEvidenceClaimRecord(decoded);
  if (
    record.interpretationId !== row.interpretation_id ||
    record.requirementId !== row.requirement_id || record.documentId !== row.document_id ||
    record.extractionId !== row.extraction_id || hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite rule evidence claim record identity mismatch");
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

function parseAiUsageEvent(value: unknown): AiUsageEvent {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite AI usage event row is malformed");
  }
  const row = value as Partial<StoredAiUsageEventRow>;
  if (
    typeof row.event_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite AI usage event row has invalid column types");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite AI usage event contains invalid JSON");
  }
  const event = assertAiUsageEvent(decoded as AiUsageEvent);
  if (
    event.eventId !== row.event_id ||
    hashCanonical(event) !== row.record_hash
  ) {
    throw new Error("SQLite AI usage event identity mismatch");
  }
  return event;
}

function parseAiRuntimeConfiguration(value: unknown): AiRuntimeConfiguration {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite AI runtime configuration row is malformed");
  }
  const row = value as Partial<StoredAiRuntimeConfigurationRow>;
  if (
    row.singleton_key !== "active" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) {
    throw new Error("SQLite AI runtime configuration row has invalid columns");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite AI runtime configuration contains invalid JSON");
  }
  const configuration = assertAiRuntimeConfiguration(
    decoded as AiRuntimeConfiguration,
  );
  if (hashCanonical(configuration) !== row.record_hash) {
    throw new Error("SQLite AI runtime configuration hash mismatch");
  }
  return configuration;
}

function parseProbabilityCalibrationObservation(
  value: unknown,
): ProbabilityCalibrationObservation {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability calibration observation row is malformed");
  }
  const row = value as Partial<ProbabilityCalibrationObservationRow>;
  if (
    typeof row.artifact_hash !== "string" ||
    typeof row.bound_artifact_hash !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite probability calibration observation row has invalid columns");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite probability calibration observation contains invalid JSON");
  }
  const observation = assertProbabilityCalibrationObservation(decoded);
  if (
    observation.artifactHash !== row.artifact_hash ||
    observation.boundArtifactHash !== row.bound_artifact_hash ||
    hashCanonical(observation) !== row.record_hash
  ) throw new Error("SQLite probability calibration observation identity mismatch");
  return observation;
}

function parseProbabilityCalibrationBound(value: unknown): ProbabilisticSemanticBoundArtifact {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability calibration bound row is malformed");
  }
  const row = value as Partial<ProbabilityCalibrationBoundRow>;
  if (
    typeof row.artifact_hash !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite probability calibration bound row has invalid columns");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite probability calibration bound contains invalid JSON");
  }
  const bound = assertProbabilisticSemanticBound(decoded);
  if (bound.artifactHash !== row.artifact_hash || hashCanonical(bound) !== row.record_hash) {
    throw new Error("SQLite probability calibration bound identity mismatch");
  }
  return bound;
}

function parseProbabilityCalibrationSnapshot(value: unknown): ProbabilityCalibrationArtifact {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability calibration snapshot row is malformed");
  }
  const row = value as Partial<ProbabilityCalibrationSnapshotRow>;
  if (
    typeof row.artifact_hash !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite probability calibration snapshot row has invalid columns");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite probability calibration snapshot contains invalid JSON");
  }
  const artifact = assertProbabilityCalibrationArtifact(decoded);
  if (
    artifact.artifactHash !== row.artifact_hash ||
    hashCanonical(artifact) !== row.record_hash
  ) throw new Error("SQLite probability calibration snapshot identity mismatch");
  return artifact;
}

function parseProbabilityResolutionCapture(value: unknown): ProbabilityResolutionCapture {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite probability resolution capture row is malformed");
  }
  const row = value as Partial<ProbabilityResolutionCaptureRow>;
  if (typeof row.artifact_hash !== "string" || typeof row.listing_ref !== "string" ||
    typeof row.source_raw_hash !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string") {
    throw new Error("SQLite probability resolution capture row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite probability resolution capture contains invalid JSON");
  }
  const capture = assertProbabilityResolutionCapture(decoded);
  if (capture.artifactHash !== row.artifact_hash || capture.listingRef !== row.listing_ref ||
    capture.sourceRawHash !== row.source_raw_hash || hashCanonical(capture) !== row.record_hash) {
    throw new Error("SQLite probability resolution capture identity mismatch");
  }
  return capture;
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
    ProbabilityEstimationRunStore,
    ProbabilityEstimationSchedulerStore,
    AiUsageEventStore,
    AiRuntimeConfigurationStore,
    PremiseAnalysisRecordStore,
    PremiseAnalysisSchedulerStore,
    PremiseEvidenceRoutingSchedulerStore,
    PremiseRouteExpansionSchedulerStore,
    SemanticReviewSchedulerStore,
    EvidenceAcquisitionSchedulerStore,
    RuleEvidenceClaimRecordStore,
    RuleEvidenceClaimSchedulerStore,
    OpportunityLifecycleJournalStore,
    AnonymousSimulationMaterializationStore,
    ProbabilityCalibrationStore,
    ProbabilityResolutionCaptureStore
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
  public readonly probabilityEstimationStorage: OperationalStorageProjection<"runId">;
  public readonly probabilityEstimationJobStorage: OperationalStorageProjection<"jobId">;
  public readonly probabilityEstimationNotificationStorage:
    OperationalStorageProjection<"notificationId">;
  public readonly probabilityCalibrationBoundStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly probabilityCalibrationObservationStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly probabilityCalibrationSnapshotStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly probabilityResolutionCaptureStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly probabilityResolutionSourceStorage:
    OperationalStorageProjection<"rawHash">;
  public readonly aiUsageStorage: OperationalStorageProjection<"eventId">;
  public readonly aiRuntimeConfigurationStorage:
    OperationalStorageProjection<"singleton">;
  public readonly premiseAnalysisStorage: OperationalStorageProjection<"analysisId">;
  public readonly premiseAnalysisJobStorage: OperationalStorageProjection<"jobId">;
  public readonly premiseAnalysisNotificationStorage: OperationalStorageProjection<"notificationId">;
  public readonly premiseEvidenceRoutingJobStorage: OperationalStorageProjection<"jobId">;
  public readonly premiseRouteExpansionJobStorage: OperationalStorageProjection<"jobId">;
  public readonly semanticReviewJobStorage: OperationalStorageProjection<"jobId">;
  public readonly semanticReviewNotificationStorage: OperationalStorageProjection<"notificationId">;
  public readonly evidenceAcquisitionJobStorage: OperationalStorageProjection<"jobId">;
  public readonly evidenceDocumentStorage: OperationalStorageProjection<"documentId">;
  public readonly evidenceDocumentTextStorage: OperationalStorageProjection<"extractionId">;
  public readonly evidenceDocumentObservationStorage: OperationalStorageProjection<"observationId">;
  public readonly ruleEvidenceClaimStorage: OperationalStorageProjection<"interpretationId">;
  public readonly ruleEvidenceClaimJobStorage: OperationalStorageProjection<"jobId">;
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
    this.probabilityEstimationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "runId",
    });
    this.probabilityEstimationJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
    });
    this.probabilityEstimationNotificationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "notificationId",
    });
    this.probabilityCalibrationBoundStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.probabilityCalibrationObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.probabilityCalibrationSnapshotStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.probabilityResolutionCaptureStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.probabilityResolutionSourceStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "rawHash",
    });
    this.aiUsageStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "eventId",
    });
    this.aiRuntimeConfigurationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "singleton",
    });
    this.premiseAnalysisStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "analysisId",
    });
    this.premiseAnalysisJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
    });
    this.premiseAnalysisNotificationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "notificationId",
    });
    this.premiseEvidenceRoutingJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
    });
    this.premiseRouteExpansionJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
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
    this.evidenceAcquisitionJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
    });
    this.evidenceDocumentStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "documentId",
    });
    this.evidenceDocumentTextStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "extractionId",
    });
    this.evidenceDocumentObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.ruleEvidenceClaimStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "interpretationId",
    });
    this.ruleEvidenceClaimJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
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
    const probabilityEstimationRunTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_estimation_runs'`,
      )
      .get() !== undefined;
    const probabilityEstimationJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_estimation_jobs'`,
      )
      .get() !== undefined;
    const probabilityEstimationNotificationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_estimation_notifications'`,
      )
      .get() !== undefined;
    const probabilityCalibrationObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_calibration_observations'`,
      )
      .get() !== undefined;
    const probabilityCalibrationBoundTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_calibration_bounds'`,
      )
      .get() !== undefined;
    const probabilityCalibrationSnapshotTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_calibration_snapshots'`,
      )
      .get() !== undefined;
    const probabilityResolutionCaptureTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_resolution_captures'`,
      )
      .get() !== undefined;
    const probabilityResolutionSourceTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'probability_resolution_sources'`,
      )
      .get() !== undefined;
    const aiUsageEventTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'ai_usage_events'`,
      )
      .get() !== undefined;
    const aiRuntimeConfigurationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'ai_runtime_configuration'`,
      )
      .get() !== undefined;
    const premiseAnalysisRecordTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'premise_analysis_records'`,
      )
      .get() !== undefined;
    const premiseAnalysisJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'premise_analysis_jobs'`,
      )
      .get() !== undefined;
    const premiseAnalysisNotificationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'premise_analysis_notifications'`,
      )
      .get() !== undefined;
    const premiseEvidenceRoutingJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'premise_evidence_routing_jobs'`,
      )
      .get() !== undefined;
    const premiseRouteExpansionJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'premise_route_expansion_jobs'`,
      )
      .get() !== undefined;
    const searchQuoteObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'search_quote_observations'`,
      )
      .get() !== undefined;
    const evidenceAcquisitionJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'evidence_acquisition_jobs'`,
      )
      .get() !== undefined;
    const evidenceDocumentTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'evidence_documents'`,
      )
      .get() !== undefined;
    const evidenceDocumentTextTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'evidence_document_texts'`,
      )
      .get() !== undefined;
    const evidenceDocumentObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'evidence_document_observations'`,
      )
      .get() !== undefined;
    const ruleEvidenceClaimJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'rule_evidence_claim_jobs'`,
      )
      .get() !== undefined;
    const ruleEvidenceClaimRecordTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'rule_evidence_claim_records'`,
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
      probabilityEstimationRunTableExists &&
      probabilityEstimationJobTableExists &&
      probabilityEstimationNotificationTableExists &&
      probabilityCalibrationBoundTableExists &&
      probabilityCalibrationObservationTableExists &&
      probabilityCalibrationSnapshotTableExists &&
      probabilityResolutionCaptureTableExists &&
      probabilityResolutionSourceTableExists &&
      aiUsageEventTableExists &&
      aiRuntimeConfigurationTableExists &&
      searchQuoteObservationTableExists &&
      evidenceAcquisitionJobTableExists && evidenceDocumentTableExists &&
      evidenceDocumentTextTableExists && evidenceDocumentObservationTableExists &&
      ruleEvidenceClaimJobTableExists && ruleEvidenceClaimRecordTableExists
      && premiseAnalysisRecordTableExists
      && premiseAnalysisJobTableExists
      && premiseAnalysisNotificationTableExists
      && premiseEvidenceRoutingJobTableExists
      && premiseRouteExpansionJobTableExists
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
              kind IN (
                'HOURLY_DIGEST', 'ACTION_CANDIDATE', 'DEEP_UNAVAILABLE',
                'ISSUE_DEGRADED'
              )
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
      if (current < 18) {
        this.#database.exec(`
          DROP INDEX IF EXISTS search_attention_messages_occurred;
          DROP INDEX IF EXISTS search_attention_delivery_channel;
          DROP INDEX IF EXISTS search_attention_deliveries_due;
          ALTER TABLE search_attention_deliveries
            RENAME TO search_attention_deliveries_v17;
          ALTER TABLE search_attention_messages
            RENAME TO search_attention_messages_v17;

          CREATE TABLE search_attention_messages (
            message_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(message_id) = 71 AND message_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND
              dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            kind TEXT NOT NULL CHECK (
              kind IN (
                'HOURLY_DIGEST', 'ACTION_CANDIDATE', 'DEEP_UNAVAILABLE',
                'ISSUE_DEGRADED'
              )
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
          CREATE INDEX search_attention_messages_occurred
            ON search_attention_messages (occurred_at DESC, message_id DESC);

          CREATE TABLE search_attention_deliveries (
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
          CREATE UNIQUE INDEX search_attention_delivery_channel
            ON search_attention_deliveries (message_id, channel);
          CREATE INDEX search_attention_deliveries_due
            ON search_attention_deliveries (status, next_attempt_at, delivery_id);

          INSERT INTO search_attention_messages
            SELECT * FROM search_attention_messages_v17;
          INSERT INTO search_attention_deliveries
            SELECT * FROM search_attention_deliveries_v17;
          DROP TABLE search_attention_deliveries_v17;
          DROP TABLE search_attention_messages_v17;
        `);
      }
      if (
        current < 19 || !evidenceAcquisitionJobTableExists ||
        !evidenceDocumentTableExists || !evidenceDocumentTextTableExists ||
        !evidenceDocumentObservationTableExists
      ) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS evidence_acquisition_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'CAPTURED', 'STALE',
                'UNSUPPORTED', 'EXHAUSTED'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS evidence_acquisition_jobs_due
            ON evidence_acquisition_jobs (status, next_attempt_at, job_id);

          CREATE TABLE IF NOT EXISTS evidence_documents (
            document_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(document_id) = 71 AND document_id GLOB 'sha256:[0-9a-f]*'
            ),
            raw_hash TEXT NOT NULL CHECK (
              length(raw_hash) = 71 AND raw_hash GLOB 'sha256:[0-9a-f]*'
            ),
            received_at TEXT NOT NULL CHECK (length(received_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            raw_bytes BLOB NOT NULL
          ) STRICT;
          CREATE INDEX IF NOT EXISTS evidence_documents_received
            ON evidence_documents (received_at DESC, document_id DESC);

          CREATE TABLE IF NOT EXISTS evidence_document_texts (
            extraction_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(extraction_id) = 71 AND extraction_id GLOB 'sha256:[0-9a-f]*'
            ),
            document_id TEXT NOT NULL CHECK (
              length(document_id) = 71 AND document_id GLOB 'sha256:[0-9a-f]*'
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            extracted_text TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES evidence_documents(document_id)
              ON DELETE CASCADE
          ) STRICT;
          CREATE INDEX IF NOT EXISTS evidence_document_texts_document
            ON evidence_document_texts (document_id, extraction_id);

          CREATE TABLE IF NOT EXISTS evidence_document_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            acquisition_job_id TEXT NOT NULL CHECK (
              length(acquisition_job_id) = 71 AND
              acquisition_job_id GLOB 'sha256:[0-9a-f]*'
            ),
            document_id TEXT NOT NULL CHECK (
              length(document_id) = 71 AND document_id GLOB 'sha256:[0-9a-f]*'
            ),
            received_at TEXT NOT NULL CHECK (length(received_at) > 0),
            http_status INTEGER NOT NULL CHECK (http_status IN (200, 304)),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (acquisition_job_id) REFERENCES evidence_acquisition_jobs(job_id)
              ON DELETE CASCADE,
            FOREIGN KEY (document_id) REFERENCES evidence_documents(document_id)
              ON DELETE RESTRICT
          ) STRICT;
          CREATE INDEX IF NOT EXISTS evidence_document_observations_job
            ON evidence_document_observations (
              acquisition_job_id, received_at DESC, observation_id DESC
            );
        `);
      }
      if (
        current < 20 || !ruleEvidenceClaimJobTableExists ||
        !ruleEvidenceClaimRecordTableExists
      ) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS rule_evidence_claim_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN ('PENDING', 'LEASED', 'RETRY_WAIT', 'PASS', 'EXHAUSTED')
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS rule_evidence_claim_jobs_due
            ON rule_evidence_claim_jobs (status, next_attempt_at, job_id);

          CREATE TABLE IF NOT EXISTS rule_evidence_claim_records (
            interpretation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(interpretation_id) = 71 AND
              interpretation_id GLOB 'sha256:[0-9a-f]*'
            ),
            requirement_id TEXT NOT NULL CHECK (
              length(requirement_id) = 71 AND requirement_id GLOB 'sha256:[0-9a-f]*'
            ),
            document_id TEXT NOT NULL CHECK (
              length(document_id) = 71 AND document_id GLOB 'sha256:[0-9a-f]*'
            ),
            extraction_id TEXT NOT NULL CHECK (
              length(extraction_id) = 71 AND extraction_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('PASS', 'FAILED')),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (document_id) REFERENCES evidence_documents(document_id)
              ON DELETE RESTRICT,
            FOREIGN KEY (extraction_id) REFERENCES evidence_document_texts(extraction_id)
              ON DELETE RESTRICT
          ) STRICT;
          CREATE INDEX IF NOT EXISTS rule_evidence_claim_records_requirement
            ON rule_evidence_claim_records (
              requirement_id, completed_at DESC, interpretation_id DESC
            );
        `);
      }
      if (current < 21 || !premiseAnalysisRecordTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS premise_analysis_records (
            analysis_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(analysis_id) = 71 AND analysis_id GLOB 'sha256:[0-9a-f]*'
            ),
            proposal_id TEXT NOT NULL CHECK (
              length(proposal_id) = 71 AND proposal_id GLOB 'sha256:[0-9a-f]*'
            ),
            semantic_review_artifact_hash TEXT NOT NULL CHECK (
              length(semantic_review_artifact_hash) = 71 AND
              semantic_review_artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            evidence_scope_identity TEXT NOT NULL CHECK (
              length(evidence_scope_identity) = 71 AND
              evidence_scope_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('PASS', 'FAILED')),
            completed_at TEXT NOT NULL CHECK (length(completed_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS premise_analysis_records_completed
            ON premise_analysis_records (completed_at DESC, analysis_id DESC);
          CREATE INDEX IF NOT EXISTS premise_analysis_records_proposal
            ON premise_analysis_records (
              proposal_id, semantic_review_artifact_hash, completed_at DESC
            );
        `);
      }
      if (current < 22 || !premiseAnalysisJobTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS premise_analysis_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN ('PENDING', 'LEASED', 'RETRY_WAIT', 'PASS', 'EXHAUSTED')
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS premise_analysis_jobs_due
            ON premise_analysis_jobs (status, next_attempt_at, job_id);
        `);
      }
      if (current < 23 || !premiseAnalysisNotificationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS premise_analysis_notifications (
            notification_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(notification_id) = 71 AND notification_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READ')),
            created_at TEXT NOT NULL CHECK (length(created_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS premise_analysis_notifications_status_created
            ON premise_analysis_notifications (status, created_at DESC);
        `);
      }
      if (current < 30 || !premiseEvidenceRoutingJobTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS premise_evidence_routing_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN ('PENDING', 'LEASED', 'RETRY_WAIT', 'PASS', 'EXHAUSTED')
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS premise_evidence_routing_jobs_due
            ON premise_evidence_routing_jobs (status, next_attempt_at, job_id);
        `);
      }
      if (current < 32 || !premiseRouteExpansionJobTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS premise_route_expansion_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN ('PENDING', 'LEASED', 'RETRY_WAIT', 'PASS', 'EXHAUSTED')
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS premise_route_expansion_jobs_due
            ON premise_route_expansion_jobs (status, next_attempt_at, job_id);
        `);
      }
      if (current < 24 || !probabilityEstimationRunTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS probability_estimation_runs (
            run_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(run_id) = 71 AND run_id GLOB 'sha256:[0-9a-f]*'
            ),
            semantic_review_artifact_hash TEXT NOT NULL CHECK (
              length(semantic_review_artifact_hash) = 71 AND
              semantic_review_artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            semantic_constraint_artifact_hash TEXT NOT NULL CHECK (
              length(semantic_constraint_artifact_hash) = 71 AND
              semantic_constraint_artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            role TEXT NOT NULL CHECK (
              role IN ('REFERENCE_CLASS', 'CAUSAL', 'INDEPENDENT')
            ),
            status TEXT NOT NULL CHECK (
              status IN ('RUNNING', 'PASS', 'ABSTAINED', 'FAILED')
            ),
            started_at TEXT NOT NULL CHECK (length(started_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_estimation_runs_scope
            ON probability_estimation_runs (
              semantic_review_artifact_hash,
              semantic_constraint_artifact_hash,
              started_at DESC,
              run_id DESC
            );
        `);
      }
      if (
        current < 25 || !probabilityEstimationJobTableExists ||
        !probabilityEstimationNotificationTableExists
      ) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS probability_estimation_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'BLOCKED_EVIDENCE',
                'PASS', 'ABSTAINED', 'EXHAUSTED'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_estimation_jobs_due
            ON probability_estimation_jobs (status, next_attempt_at, job_id);
          CREATE TABLE IF NOT EXISTS probability_estimation_notifications (
            notification_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(notification_id) = 71 AND notification_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READ')),
            created_at TEXT NOT NULL CHECK (length(created_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_estimation_notifications_status_created
            ON probability_estimation_notifications (status, created_at DESC);
        `);
      }
      if (current < 26 || !aiUsageEventTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS ai_usage_events (
            event_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(event_id) = 71 AND event_id GLOB 'sha256:[0-9a-f]*'
            ),
            occurred_at TEXT NOT NULL CHECK (length(occurred_at) > 0),
            purpose TEXT NOT NULL CHECK (
              purpose IN (
                'DISCOVERY_FAST', 'SEMANTIC_REVIEW', 'RULE_EVIDENCE_CLAIM',
                'PREMISE_ANALYSIS', 'PREMISE_EVIDENCE_ROUTING', 'PROBABILITY_ESTIMATION',
                'PI_INVESTIGATION', 'PI_MARKET_ARCHAEOLOGY'
              )
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS ai_usage_events_occurred
            ON ai_usage_events (occurred_at DESC, event_id DESC);
          CREATE INDEX IF NOT EXISTS ai_usage_events_purpose_occurred
            ON ai_usage_events (purpose, occurred_at DESC, event_id DESC);
        `);
      }
      if (current < 31) {
        this.#database.exec(`
          DROP INDEX IF EXISTS ai_usage_events_occurred;
          DROP INDEX IF EXISTS ai_usage_events_purpose_occurred;
          ALTER TABLE ai_usage_events RENAME TO ai_usage_events_before_premise_routing;
          CREATE TABLE ai_usage_events (
            event_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(event_id) = 71 AND event_id GLOB 'sha256:[0-9a-f]*'
            ),
            occurred_at TEXT NOT NULL CHECK (length(occurred_at) > 0),
            purpose TEXT NOT NULL CHECK (
              purpose IN (
                'DISCOVERY_FAST', 'SEMANTIC_REVIEW', 'RULE_EVIDENCE_CLAIM',
                'PREMISE_ANALYSIS', 'PREMISE_EVIDENCE_ROUTING', 'PROBABILITY_ESTIMATION',
                'PI_INVESTIGATION', 'PI_MARKET_ARCHAEOLOGY'
              )
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          INSERT INTO ai_usage_events (
            event_id, occurred_at, purpose, record_json, record_hash
          ) SELECT event_id, occurred_at, purpose, record_json, record_hash
            FROM ai_usage_events_before_premise_routing;
          DROP TABLE ai_usage_events_before_premise_routing;
          CREATE INDEX ai_usage_events_occurred
            ON ai_usage_events (occurred_at DESC, event_id DESC);
          CREATE INDEX ai_usage_events_purpose_occurred
            ON ai_usage_events (purpose, occurred_at DESC, event_id DESC);
        `);
      }
      if (current < 27 || !aiRuntimeConfigurationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS ai_runtime_configuration (
            singleton_key TEXT PRIMARY KEY NOT NULL CHECK (singleton_key = 'active'),
            revision INTEGER NOT NULL CHECK (revision >= 1),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
        `);
      }
      if (
        current < 28 || !probabilityCalibrationBoundTableExists ||
        !probabilityCalibrationObservationTableExists ||
        !probabilityCalibrationSnapshotTableExists
      ) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS probability_calibration_bounds (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            valid_from TEXT NOT NULL CHECK (length(valid_from) > 0),
            expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_calibration_bounds_validity
            ON probability_calibration_bounds (valid_from DESC, artifact_hash DESC);
          CREATE TABLE IF NOT EXISTS probability_calibration_observations (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            bound_artifact_hash TEXT NOT NULL UNIQUE CHECK (
              length(bound_artifact_hash) = 71 AND bound_artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            resolved_at TEXT NOT NULL CHECK (length(resolved_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_calibration_observations_resolved
            ON probability_calibration_observations (resolved_at DESC, artifact_hash DESC);
          CREATE TABLE IF NOT EXISTS probability_calibration_snapshots (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            created_at TEXT NOT NULL CHECK (length(created_at) > 0),
            observation_count INTEGER NOT NULL CHECK (observation_count >= 1),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_calibration_snapshots_created
            ON probability_calibration_snapshots (created_at DESC, artifact_hash DESC);
        `);
      }
      if (current < 29 || !probabilityResolutionCaptureTableExists ||
        !probabilityResolutionSourceTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS probability_resolution_sources (
            raw_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(raw_hash) = 71 AND raw_hash GLOB 'sha256:[0-9a-f]*'
            ),
            byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
            raw_bytes BLOB NOT NULL
          ) STRICT;
          CREATE TABLE IF NOT EXISTS probability_resolution_captures (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            listing_ref TEXT NOT NULL CHECK (length(listing_ref) > 0),
            fetched_at TEXT NOT NULL CHECK (length(fetched_at) > 0),
            status TEXT NOT NULL CHECK (status IN (
              'UNRESOLVED', 'RESOLVED', 'RESOLUTION_TIME_UNAVAILABLE',
              'CONFLICT', 'HTTP_ERROR', 'UNSUPPORTED'
            )),
            source_raw_hash TEXT NOT NULL CHECK (
              length(source_raw_hash) = 71 AND source_raw_hash GLOB 'sha256:[0-9a-f]*'
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_raw_hash) REFERENCES probability_resolution_sources(raw_hash)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS probability_resolution_captures_listing
            ON probability_resolution_captures (listing_ref, fetched_at DESC, artifact_hash DESC);
          CREATE INDEX IF NOT EXISTS probability_resolution_captures_status
            ON probability_resolution_captures (status, fetched_at DESC);
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
         ORDER BY
           CASE
             WHEN status = 'ISSUED' OR
               json_extract(record_json, '$.deepLane.status') IN ('PENDING', 'RUNNING')
             THEN 0 ELSE 1
           END,
           rowid DESC
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
        const priorAttempts = prior.deepLane.attempts ?? [];
        const nextAttempts = validated.deepLane.attempts ?? [];
        const retainedAttemptPrefix = priorAttempts.every((attempt, index) => {
          const next = nextAttempts[index];
          if (next === undefined) return false;
          if (hashCanonical(attempt) === hashCanonical(next)) return true;
          return index === priorAttempts.length - 1 &&
            attempt.status === "RUNNING" &&
            (next.status === "PASS" || next.status === "FAILED") &&
            attempt.attemptId === next.attemptId &&
            attempt.inputIdentity === next.inputIdentity &&
            attempt.attemptNumber === next.attemptNumber &&
            attempt.startedAt === next.startedAt &&
            attempt.deadlineAt === next.deadlineAt;
        });
        const allowedDeepStateTransition =
          (prior.deepLane.status === "PENDING" &&
            validated.deepLane.status === "RUNNING" &&
            nextAttempts.length === priorAttempts.length + 1) ||
          (prior.deepLane.status === "RUNNING" &&
            (validated.deepLane.status === "PASS" ||
              validated.deepLane.status === "FAILED") &&
            nextAttempts.length === priorAttempts.length) ||
          (prior.deepLane.status === "FAILED" &&
            validated.deepLane.status === "PENDING" &&
            nextAttempts.length === priorAttempts.length);
        const duplicateWhilePending =
          prior.deepLane.status === "PENDING" &&
          validated.deepLane.status === "NOT_RUN" &&
          validated.deepLane.reason === "DUPLICATE" &&
          priorAttempts.length === 0 && nextAttempts.length === 0 &&
          prior.lineage.duplicateOfLeaseId === null &&
          validated.lineage.duplicateOfLeaseId !== null &&
          prior.lineage.noveltySignature === validated.lineage.noveltySignature;
        const monotonicDeepTransition =
          (prior.lease.algorithmVersion === "pmh.ai-search-leases.v5" ||
            prior.lease.algorithmVersion === "pmh.ai-search-leases.v6" ||
            prior.lease.algorithmVersion === "pmh.ai-search-leases.v7" ||
            prior.lease.algorithmVersion === "pmh.ai-search-leases.v8" ||
            prior.lease.algorithmVersion === "pmh.ai-search-leases.v9" ||
            prior.lease.algorithmVersion === "pmh.ai-search-leases.v10") &&
          (validated.lease.algorithmVersion === "pmh.ai-search-leases.v5" ||
            validated.lease.algorithmVersion === "pmh.ai-search-leases.v6" ||
            validated.lease.algorithmVersion === "pmh.ai-search-leases.v7" ||
            validated.lease.algorithmVersion === "pmh.ai-search-leases.v8" ||
            validated.lease.algorithmVersion === "pmh.ai-search-leases.v9" ||
            validated.lease.algorithmVersion === "pmh.ai-search-leases.v10") &&
          prior.status === "PASS" && validated.status === "PASS" &&
          prior.completedAt === validated.completedAt &&
          prior.diagnostic === validated.diagnostic &&
          hashCanonical(prior.fastLane) === hashCanonical(validated.fastLane) &&
          hashCanonical(prior.lease) === hashCanonical(validated.lease) &&
          (hashCanonical(prior.lineage) === hashCanonical(validated.lineage) ||
            duplicateWhilePending) &&
          hashCanonical(prior.trace) === hashCanonical(validated.trace) &&
          prior.outcome.novelCandidate === validated.outcome.novelCandidate &&
          prior.outcome.hypothesisCount === validated.outcome.hypothesisCount &&
          prior.deepLane.inputIdentity === validated.deepLane.inputIdentity &&
          retainedAttemptPrefix &&
          (allowedDeepStateTransition || duplicateWhilePending);
        if (
          (!exactReplay && prior.status !== "ISSUED" && !monotonicDeepTransition) ||
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
             record_hash = excluded.record_hash`,
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
               AND COALESCE(
                 json_extract(record_json, '$.deepLane.status'),
                 'NOT_RUN'
               ) NOT IN ('PENDING', 'RUNNING')
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

  public loadProbabilityEstimationRunRecords(
    limit: number,
  ): readonly ProbabilityEstimationRunRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT run_id, semantic_review_artifact_hash,
                semantic_constraint_artifact_hash, role, record_json, record_hash
         FROM probability_estimation_runs
         ORDER BY started_at DESC, run_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityEstimationRunRecord));
  }

  public loadProbabilityCalibrationObservations(
    limit: number,
  ): readonly ProbabilityCalibrationObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT artifact_hash, bound_artifact_hash, record_json, record_hash
         FROM probability_calibration_observations
         ORDER BY resolved_at DESC, artifact_hash DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityCalibrationObservation));
  }

  public loadProbabilityResolutionCaptures(
    limit: number,
  ): readonly ProbabilityResolutionCapture[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT artifact_hash, listing_ref, source_raw_hash, record_json, record_hash
         FROM probability_resolution_captures
         ORDER BY fetched_at DESC, artifact_hash DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityResolutionCapture));
  }

  public loadProbabilityResolutionSource(rawHash: Hash): Uint8Array | null {
    this.#assertOpen();
    const row = this.#database
      .prepare(
        `SELECT raw_hash, byte_length, raw_bytes
         FROM probability_resolution_sources WHERE raw_hash = ?`,
      )
      .get(rawHash) as ProbabilityResolutionSourceRow | undefined;
    if (row === undefined) return null;
    if (typeof row.raw_hash !== "string" ||
      (typeof row.byte_length !== "number" && typeof row.byte_length !== "bigint") ||
      !(row.raw_bytes instanceof Uint8Array)) {
      throw new Error("SQLite probability resolution source row is malformed");
    }
    const bytes = new Uint8Array(row.raw_bytes);
    if (row.raw_hash !== rawHash || BigInt(bytes.byteLength) !== BigInt(row.byte_length) ||
      hashBytes(bytes) !== rawHash) {
      throw new Error("SQLite probability resolution source identity mismatch");
    }
    return bytes;
  }

  public saveProbabilityResolutionCapture(
    capture: ProbabilityResolutionCapture,
    rawBytes: Uint8Array,
  ): ProbabilityResolutionCapture {
    this.#assertOpen();
    const validated = assertProbabilityResolutionCapture(capture);
    if (hashBytes(rawBytes) !== validated.sourceRawHash ||
      BigInt(rawBytes.byteLength) !== BigInt(validated.byteLength)) {
      throw new Error("probability resolution raw source does not match capture");
    }
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(
        `INSERT INTO probability_resolution_sources (raw_hash, byte_length, raw_bytes)
         VALUES (?, ?, ?) ON CONFLICT(raw_hash) DO NOTHING`,
      ).run(validated.sourceRawHash, rawBytes.byteLength, rawBytes);
      const retainedBytes = this.loadProbabilityResolutionSource(validated.sourceRawHash);
      if (retainedBytes === null || hashBytes(retainedBytes) !== validated.sourceRawHash) {
        throw new Error("SQLite failed to retain probability resolution source");
      }
      this.#database.prepare(
        `INSERT INTO probability_resolution_captures (
           artifact_hash, listing_ref, fetched_at, status, source_raw_hash,
           record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(artifact_hash) DO NOTHING`,
      ).run(validated.artifactHash, validated.listingRef, validated.fetchedAt,
        validated.status, validated.sourceRawHash, recordJson, recordHash);
      const row = this.#database.prepare(
        `SELECT artifact_hash, listing_ref, source_raw_hash, record_json, record_hash
         FROM probability_resolution_captures WHERE artifact_hash = ?`,
      ).get(validated.artifactHash);
      if (row === undefined) throw new Error("SQLite failed to retain probability resolution capture");
      const stored = parseProbabilityResolutionCapture(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("artifactHash is already bound to another probability resolution capture");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadProbabilityCalibrationBounds(
    limit: number,
  ): readonly ProbabilisticSemanticBoundArtifact[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT artifact_hash, record_json, record_hash
         FROM probability_calibration_bounds
         ORDER BY valid_from DESC, artifact_hash DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityCalibrationBound));
  }

  public saveProbabilityCalibrationBound(bound: ProbabilisticSemanticBoundArtifact): void {
    this.#assertOpen();
    const validated = assertProbabilisticSemanticBound(bound);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database
      .prepare(
        `INSERT INTO probability_calibration_bounds (
           artifact_hash, valid_from, expires_at, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(artifact_hash) DO NOTHING`,
      )
      .run(
        validated.artifactHash,
        validated.validFrom,
        validated.expiresAt,
        recordJson,
        recordHash,
      );
    const row = this.#database
      .prepare(
        `SELECT artifact_hash, record_json, record_hash
         FROM probability_calibration_bounds WHERE artifact_hash = ?`,
      )
      .get(validated.artifactHash);
    if (row === undefined || hashCanonical(parseProbabilityCalibrationBound(row)) !== recordHash) {
      throw new Error("artifactHash is already bound to another probability calibration bound");
    }
  }

  public saveProbabilityCalibrationObservation(
    observation: ProbabilityCalibrationObservation,
  ): void {
    this.#assertOpen();
    const validated = assertProbabilityCalibrationObservation(observation);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database
      .prepare(
        `INSERT INTO probability_calibration_observations (
           artifact_hash, bound_artifact_hash, resolved_at, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(artifact_hash) DO NOTHING`,
      )
      .run(
        validated.artifactHash,
        validated.boundArtifactHash,
        validated.resolvedAt,
        recordJson,
        recordHash,
      );
    const row = this.#database
      .prepare(
        `SELECT artifact_hash, bound_artifact_hash, record_json, record_hash
         FROM probability_calibration_observations WHERE artifact_hash = ?`,
      )
      .get(validated.artifactHash);
    if (row === undefined || hashCanonical(parseProbabilityCalibrationObservation(row)) !== recordHash) {
      throw new Error("artifactHash is already bound to another probability calibration observation");
    }
  }

  public loadProbabilityCalibrationSnapshots(
    limit: number,
  ): readonly ProbabilityCalibrationArtifact[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT artifact_hash, record_json, record_hash
         FROM probability_calibration_snapshots
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityCalibrationSnapshot));
  }

  public saveProbabilityCalibrationSnapshot(
    artifact: ProbabilityCalibrationArtifact,
    retentionLimit: number,
  ): void {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertProbabilityCalibrationArtifact(artifact);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO probability_calibration_snapshots (
             artifact_hash, created_at, observation_count, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(artifact_hash) DO NOTHING`,
        )
        .run(
          validated.artifactHash,
          validated.createdAt,
          validated.observations.length,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM probability_calibration_snapshots
           WHERE rowid IN (
             SELECT rowid FROM probability_calibration_snapshots
             ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT artifact_hash, record_json, record_hash
           FROM probability_calibration_snapshots WHERE artifact_hash = ?`,
        )
        .get(validated.artifactHash);
      if (row === undefined || hashCanonical(parseProbabilityCalibrationSnapshot(row)) !== recordHash) {
        throw new Error("artifactHash is already bound to another probability calibration snapshot");
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public saveProbabilityEstimationRunRecord(
    record: ProbabilityEstimationRunRecord,
    retentionLimit: number,
  ): ProbabilityEstimationRunRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertProbabilityEstimationRunRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO probability_estimation_runs (
             run_id, semantic_review_artifact_hash,
             semantic_constraint_artifact_hash, role, status, started_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(run_id) DO UPDATE SET
             status = excluded.status,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE probability_estimation_runs.status IN ('RUNNING', 'FAILED')`,
        )
        .run(
          validated.runId,
          validated.semanticReviewArtifactHash,
          validated.semanticConstraintArtifactHash,
          validated.role,
          validated.status,
          validated.startedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM probability_estimation_runs
           WHERE run_id IN (
             SELECT run_id FROM probability_estimation_runs
             ORDER BY started_at DESC, run_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT run_id, semantic_review_artifact_hash,
                  semantic_constraint_artifact_hash, role, record_json, record_hash
           FROM probability_estimation_runs WHERE run_id = ?`,
        )
        .get(validated.runId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the probability estimation run");
      }
      const stored = parseProbabilityEstimationRunRecord(row);
      if (
        stored.semanticReviewArtifactHash !== validated.semanticReviewArtifactHash ||
        stored.semanticConstraintArtifactHash !== validated.semanticConstraintArtifactHash ||
        stored.role !== validated.role ||
        (stored.status === validated.status && hashCanonical(stored) !== recordHash)
      ) throw new Error("runId is already bound to another probability estimation run");
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadProbabilityEstimationJobRecords(
    limit: number,
  ): readonly ProbabilityEstimationJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM probability_estimation_jobs
         ORDER BY next_attempt_at, job_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityEstimationJobRecord));
  }

  public saveProbabilityEstimationJobRecord(
    record: ProbabilityEstimationJobRecord,
    retentionLimit: number,
  ): ProbabilityEstimationJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertProbabilityEstimationJobRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO probability_estimation_jobs (
             job_id, status, next_attempt_at, updated_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             status = excluded.status,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.jobId,
          validated.status,
          validated.nextAttemptAt,
          validated.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM probability_estimation_jobs
           WHERE job_id IN (
             SELECT job_id FROM probability_estimation_jobs
             ORDER BY updated_at DESC, job_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM probability_estimation_jobs WHERE job_id = ?`,
        )
        .get(validated.jobId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the probability estimation job");
      }
      const stored = parseProbabilityEstimationJobRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("jobId is already bound to another probability estimation job");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadProbabilityEstimationNotificationRecords(
    limit: number,
  ): readonly ProbabilityEstimationNotificationRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT notification_id, record_json, record_hash
         FROM probability_estimation_notifications
         ORDER BY created_at DESC, notification_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseProbabilityEstimationNotificationRecord));
  }

  public saveProbabilityEstimationNotificationRecord(
    record: ProbabilityEstimationNotificationRecord,
    retentionLimit: number,
  ): ProbabilityEstimationNotificationRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertProbabilityEstimationNotificationRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO probability_estimation_notifications (
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
          `DELETE FROM probability_estimation_notifications
           WHERE notification_id IN (
             SELECT notification_id FROM probability_estimation_notifications
             ORDER BY created_at DESC, notification_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT notification_id, record_json, record_hash
           FROM probability_estimation_notifications WHERE notification_id = ?`,
        )
        .get(validated.notificationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the probability estimation notification");
      }
      const stored = parseProbabilityEstimationNotificationRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error(
          "notificationId is already bound to another probability estimation notification",
        );
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadAiUsageEvents(): readonly AiUsageEvent[] {
    this.#assertOpen();
    const rows = this.#database
      .prepare(
        `SELECT event_id, record_json, record_hash
         FROM ai_usage_events
         ORDER BY occurred_at ASC, event_id ASC`,
      )
      .all();
    return Object.freeze(rows.map(parseAiUsageEvent));
  }

  public saveAiUsageEvent(event: AiUsageEvent): void {
    this.#assertOpen();
    const validated = assertAiUsageEvent(event);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database
      .prepare(
        `INSERT INTO ai_usage_events (
           event_id, occurred_at, purpose, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(event_id) DO NOTHING`,
      )
      .run(
        validated.eventId,
        validated.occurredAt,
        validated.purpose,
        recordJson,
        recordHash,
      );
    const row = this.#database
      .prepare(
        `SELECT event_id, record_json, record_hash
         FROM ai_usage_events WHERE event_id = ?`,
      )
      .get(validated.eventId);
    if (row === undefined) throw new Error("SQLite failed to retain the AI usage event");
    const stored = parseAiUsageEvent(row);
    if (hashCanonical(stored) !== recordHash) {
      throw new Error("eventId is already bound to another AI usage event");
    }
  }

  public loadAiRuntimeConfiguration(): AiRuntimeConfiguration | null {
    this.#assertOpen();
    const row = this.#database
      .prepare(
        `SELECT singleton_key, record_json, record_hash
         FROM ai_runtime_configuration WHERE singleton_key = 'active'`,
      )
      .get();
    return row === undefined ? null : parseAiRuntimeConfiguration(row);
  }

  public saveAiRuntimeConfiguration(
    configuration: AiRuntimeConfiguration,
  ): AiRuntimeConfiguration {
    this.#assertOpen();
    const validated = assertAiRuntimeConfiguration(configuration);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.loadAiRuntimeConfiguration();
      if (
        (existing === null && validated.revision !== 1) ||
        (existing !== null && validated.revision !== existing.revision + 1)
      ) {
        throw new Error("AI runtime configuration revision is not consecutive");
      }
      this.#database
        .prepare(
          `INSERT INTO ai_runtime_configuration (
             singleton_key, revision, updated_at, record_json, record_hash
           ) VALUES ('active', ?, ?, ?, ?)
           ON CONFLICT(singleton_key) DO UPDATE SET
             revision = excluded.revision,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE excluded.revision > ai_runtime_configuration.revision`,
        )
        .run(
          validated.revision,
          validated.updatedAt,
          recordJson,
          recordHash,
        );
      const stored = this.loadAiRuntimeConfiguration();
      if (stored === null || hashCanonical(stored) !== recordHash) {
        throw new Error("SQLite failed to retain AI runtime configuration");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadPremiseAnalysisRecords(
    limit: number,
  ): readonly PremiseAnalysisRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT analysis_id, proposal_id, semantic_review_artifact_hash,
                evidence_scope_identity, record_json, record_hash
         FROM premise_analysis_records
         ORDER BY completed_at DESC, analysis_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parsePremiseAnalysisRecord));
  }

  public savePremiseAnalysisRecord(
    record: PremiseAnalysisRecord,
    retentionLimit: number,
  ): PremiseAnalysisRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertPremiseAnalysisRecord(record);
    if (validated.status === "RUNNING" || validated.completedAt === null) {
      throw new Error("SQLite cannot persist an active premise analysis");
    }
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO premise_analysis_records (
             analysis_id, proposal_id, semantic_review_artifact_hash,
             evidence_scope_identity, status, completed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(analysis_id) DO UPDATE SET
             proposal_id = excluded.proposal_id,
             semantic_review_artifact_hash = excluded.semantic_review_artifact_hash,
             evidence_scope_identity = excluded.evidence_scope_identity,
             status = excluded.status,
             completed_at = excluded.completed_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE premise_analysis_records.status = 'FAILED'`,
        )
        .run(
          validated.analysisId,
          validated.proposalId,
          validated.semanticReviewArtifactHash,
          validated.evidenceScopeIdentity,
          validated.status,
          validated.completedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM premise_analysis_records
           WHERE analysis_id IN (
             SELECT analysis_id FROM premise_analysis_records
             ORDER BY completed_at DESC, analysis_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT analysis_id, proposal_id, semantic_review_artifact_hash,
                  evidence_scope_identity, record_json, record_hash
           FROM premise_analysis_records WHERE analysis_id = ?`,
        )
        .get(validated.analysisId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the premise analysis record");
      }
      const stored = parsePremiseAnalysisRecord(row);
      if (
        stored.proposalId !== validated.proposalId ||
        stored.semanticReviewArtifactHash !== validated.semanticReviewArtifactHash ||
        stored.evidenceScopeIdentity !== validated.evidenceScopeIdentity ||
        (stored.status === validated.status && hashCanonical(stored) !== recordHash)
      ) throw new Error("analysisId is already bound to another premise analysis");
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadPremiseAnalysisJobRecords(
    limit: number,
  ): readonly PremiseAnalysisJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM premise_analysis_jobs
         ORDER BY next_attempt_at, job_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parsePremiseAnalysisJobRecord));
  }

  public savePremiseAnalysisJobRecord(
    record: PremiseAnalysisJobRecord,
    retentionLimit: number,
  ): PremiseAnalysisJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertPremiseAnalysisJobRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO premise_analysis_jobs (
             job_id, status, next_attempt_at, updated_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             status = excluded.status,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.jobId,
          validated.status,
          validated.nextAttemptAt,
          validated.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM premise_analysis_jobs
           WHERE job_id IN (
             SELECT job_id FROM premise_analysis_jobs
             ORDER BY updated_at DESC, job_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM premise_analysis_jobs WHERE job_id = ?`,
        )
        .get(validated.jobId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the premise analysis job");
      }
      const stored = parsePremiseAnalysisJobRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("jobId is already bound to another premise analysis job");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadPremiseEvidenceRoutingJobRecords(
    limit: number,
  ): readonly PremiseEvidenceRoutingJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM premise_evidence_routing_jobs
         ORDER BY next_attempt_at, job_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parsePremiseEvidenceRoutingJobRecord));
  }

  public savePremiseEvidenceRoutingJobRecord(
    record: PremiseEvidenceRoutingJobRecord,
    retentionLimit: number,
  ): PremiseEvidenceRoutingJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertPremiseEvidenceRoutingJobRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO premise_evidence_routing_jobs (
             job_id, status, next_attempt_at, updated_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             status = excluded.status,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.jobId,
          validated.status,
          validated.nextAttemptAt,
          validated.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM premise_evidence_routing_jobs
           WHERE job_id IN (
             SELECT job_id FROM premise_evidence_routing_jobs
             ORDER BY updated_at DESC, job_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM premise_evidence_routing_jobs WHERE job_id = ?`,
        )
        .get(validated.jobId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the premise evidence routing job");
      }
      const stored = parsePremiseEvidenceRoutingJobRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("jobId is already bound to another premise evidence routing job");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadPremiseRouteExpansionJobRecords(
    limit: number,
  ): readonly PremiseRouteExpansionJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM premise_route_expansion_jobs
         ORDER BY next_attempt_at, job_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parsePremiseRouteExpansionJobRecord));
  }

  public savePremiseRouteExpansionJobRecord(
    record: PremiseRouteExpansionJobRecord,
    retentionLimit: number,
  ): PremiseRouteExpansionJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertPremiseRouteExpansionJobRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO premise_route_expansion_jobs (
             job_id, status, next_attempt_at, updated_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             status = excluded.status,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          validated.jobId,
          validated.status,
          validated.nextAttemptAt,
          validated.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM premise_route_expansion_jobs
           WHERE job_id IN (
             SELECT job_id FROM premise_route_expansion_jobs
             ORDER BY updated_at DESC, job_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM premise_route_expansion_jobs WHERE job_id = ?`,
        )
        .get(validated.jobId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the premise route expansion job");
      }
      const stored = parsePremiseRouteExpansionJobRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("jobId is already bound to another premise route expansion job");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadPremiseAnalysisNotificationRecords(
    limit: number,
  ): readonly PremiseAnalysisNotificationRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT notification_id, record_json, record_hash
         FROM premise_analysis_notifications
         ORDER BY created_at DESC, notification_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parsePremiseAnalysisNotificationRecord));
  }

  public savePremiseAnalysisNotificationRecord(
    record: PremiseAnalysisNotificationRecord,
    retentionLimit: number,
  ): PremiseAnalysisNotificationRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const validated = assertPremiseAnalysisNotificationRecord(record);
    const recordJson = canonicalJson(validated);
    const recordHash = hashCanonical(validated);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO premise_analysis_notifications (
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
          `DELETE FROM premise_analysis_notifications
           WHERE notification_id IN (
             SELECT notification_id FROM premise_analysis_notifications
             ORDER BY created_at DESC, notification_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT notification_id, record_json, record_hash
           FROM premise_analysis_notifications WHERE notification_id = ?`,
        )
        .get(validated.notificationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the premise analysis notification");
      }
      const stored = parsePremiseAnalysisNotificationRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("notificationId is already bound to another premise analysis notification");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
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

  public loadEvidenceAcquisitionJobRecords(
    limit: number,
  ): readonly EvidenceAcquisitionJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM evidence_acquisition_jobs
         ORDER BY updated_at DESC, job_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseEvidenceAcquisitionJobRecord));
  }

  #upsertEvidenceAcquisitionJob(
    record: EvidenceAcquisitionJobRecord,
  ): EvidenceAcquisitionJobRecord {
    const recordJson = canonicalJson(record);
    const recordHash = hashCanonical(record);
    this.#database
      .prepare(
        `INSERT INTO evidence_acquisition_jobs (
           job_id, status, next_attempt_at, updated_at, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(job_id) DO UPDATE SET
           status = excluded.status,
           next_attempt_at = excluded.next_attempt_at,
           updated_at = excluded.updated_at,
           record_json = excluded.record_json,
           record_hash = excluded.record_hash`,
      )
      .run(
        record.jobId,
        record.status,
        record.nextAttemptAt,
        record.updatedAt,
        recordJson,
        recordHash,
      );
    const row = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM evidence_acquisition_jobs WHERE job_id = ?`,
      )
      .get(record.jobId);
    if (row === undefined) throw new Error("SQLite failed to retain the evidence acquisition job");
    const stored = parseEvidenceAcquisitionJobRecord(row);
    if (hashCanonical(stored) !== recordHash) {
      throw new Error("jobId is already bound to another evidence acquisition scope");
    }
    return stored;
  }

  #pruneEvidenceAcquisition(retentionLimit: number): void {
    this.#database
      .prepare(
        `DELETE FROM evidence_acquisition_jobs
         WHERE job_id IN (
           SELECT job_id FROM evidence_acquisition_jobs
           ORDER BY updated_at DESC, job_id DESC
           LIMIT -1 OFFSET ?
         )`,
      )
      .run(retentionLimit);
    this.#database
      .prepare(
        `DELETE FROM evidence_documents
         WHERE NOT EXISTS (
           SELECT 1 FROM evidence_document_observations
           WHERE evidence_document_observations.document_id =
                 evidence_documents.document_id
         )`,
      )
      .run();
  }

  public saveEvidenceAcquisitionJobRecord(
    recordInput: EvidenceAcquisitionJobRecord,
    retentionLimit: number,
  ): EvidenceAcquisitionJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const record = assertEvidenceAcquisitionJobRecord(recordInput);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const stored = this.#upsertEvidenceAcquisitionJob(record);
      this.#pruneEvidenceAcquisition(retentionLimit);
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadEvidenceDocumentCapture(jobId: Hash): EvidenceDocumentCapture | null {
    this.#assertOpen();
    if (!/^sha256:[0-9a-f]{64}$/u.test(jobId)) {
      throw new Error("evidence acquisition job identity is malformed");
    }
    const jobRow = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM evidence_acquisition_jobs WHERE job_id = ?`,
      )
      .get(jobId);
    if (jobRow === undefined) return null;
    const job = parseEvidenceAcquisitionJobRecord(jobRow);
    if (
      job.lastObservationId === null || job.lastDocumentId === null ||
      job.lastExtractionId === null
    ) return null;
    const observationRow = this.#database
      .prepare(
        `SELECT observation_id, acquisition_job_id, document_id, record_json, record_hash
         FROM evidence_document_observations
         WHERE observation_id = ? AND acquisition_job_id = ?`,
      )
      .get(job.lastObservationId, job.jobId);
    const documentRow = this.#database
      .prepare(
        `SELECT document_id, record_json, record_hash, raw_bytes
         FROM evidence_documents WHERE document_id = ?`,
      )
      .get(job.lastDocumentId);
    const extractionRow = this.#database
      .prepare(
        `SELECT extraction_id, document_id, record_json, record_hash, extracted_text
         FROM evidence_document_texts WHERE extraction_id = ?`,
      )
      .get(job.lastExtractionId);
    if (
      observationRow === undefined || documentRow === undefined || extractionRow === undefined
    ) throw new Error("SQLite evidence acquisition capture is incomplete");
    const observation = parseEvidenceDocumentObservation(observationRow);
    if (observation.jobId !== job.jobId) {
      throw new Error("SQLite evidence observation is bound to another acquisition job");
    }
    return assertEvidenceDocumentCapture(Object.freeze({
      status: observation.observation.httpStatus === 304 ? "NOT_MODIFIED" : "CAPTURED",
      observation: observation.observation,
      document: parseEvidenceDocument(documentRow),
      extraction: parseEvidenceDocumentText(extractionRow),
    }));
  }

  public saveEvidenceAcquisitionCompletion(
    recordInput: EvidenceAcquisitionJobRecord,
    captureInput: EvidenceDocumentCapture,
    retentionLimit: number,
  ): Readonly<{ record: EvidenceAcquisitionJobRecord; capture: EvidenceDocumentCapture }> {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const record = assertEvidenceAcquisitionJobRecord(recordInput);
    const capture = assertEvidenceDocumentCapture(captureInput);
    if (
      record.status !== "CAPTURED" ||
      record.lastObservationId !== capture.observation.observationId ||
      record.lastDocumentId !== capture.document.record.documentId ||
      record.lastExtractionId !== capture.extraction.record.extractionId ||
      record.httpStatus !== capture.observation.httpStatus ||
      record.acquisitionScopeIdentity !== capture.observation.acquisitionScopeIdentity ||
      !record.requirementIds.includes(capture.observation.requirementId) ||
      record.locatorIdentity !== capture.observation.locatorIdentity ||
      record.policyIdentity !== capture.observation.policyIdentity
    ) throw new Error("evidence acquisition completion lineage is inconsistent");
    const documentJson = canonicalJson(capture.document.record);
    const documentHash = hashCanonical(capture.document.record);
    const extractionJson = canonicalJson(capture.extraction.record);
    const extractionHash = hashCanonical(capture.extraction.record);
    const observationJson = canonicalJson(capture.observation);
    const observationHash = hashCanonical(capture.observation);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#upsertEvidenceAcquisitionJob(record);
      this.#database
        .prepare(
          `INSERT INTO evidence_documents (
             document_id, raw_hash, received_at, record_json, record_hash, raw_bytes
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(document_id) DO NOTHING`,
        )
        .run(
          capture.document.record.documentId,
          capture.document.record.rawHash,
          capture.document.record.receivedAt,
          documentJson,
          documentHash,
          capture.document.bytes,
        );
      this.#database
        .prepare(
          `INSERT INTO evidence_document_texts (
             extraction_id, document_id, record_json, record_hash, extracted_text
           ) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(extraction_id) DO NOTHING`,
        )
        .run(
          capture.extraction.record.extractionId,
          capture.extraction.record.documentId,
          extractionJson,
          extractionHash,
          capture.extraction.text,
        );
      this.#database
        .prepare(
          `INSERT INTO evidence_document_observations (
             observation_id, acquisition_job_id, document_id, received_at, http_status,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        )
        .run(
          capture.observation.observationId,
          record.jobId,
          capture.observation.documentId,
          capture.observation.receivedAt,
          capture.observation.httpStatus,
          observationJson,
          observationHash,
        );
      const storedDocumentRow = this.#database
        .prepare(
          `SELECT document_id, record_json, record_hash, raw_bytes
           FROM evidence_documents WHERE document_id = ?`,
        )
        .get(capture.document.record.documentId);
      const storedExtractionRow = this.#database
        .prepare(
          `SELECT extraction_id, document_id, record_json, record_hash, extracted_text
           FROM evidence_document_texts WHERE extraction_id = ?`,
        )
        .get(capture.extraction.record.extractionId);
      const storedObservationRow = this.#database
        .prepare(
          `SELECT observation_id, acquisition_job_id, document_id, record_json, record_hash
           FROM evidence_document_observations WHERE observation_id = ?`,
        )
        .get(capture.observation.observationId);
      if (
        storedDocumentRow === undefined || storedExtractionRow === undefined ||
        storedObservationRow === undefined
      ) throw new Error("SQLite failed to retain the evidence acquisition capture");
      const storedDocument = parseEvidenceDocument(storedDocumentRow);
      const storedExtraction = parseEvidenceDocumentText(storedExtractionRow);
      const storedObservation = parseEvidenceDocumentObservation(storedObservationRow);
      if (
        storedDocument.record.documentId !== capture.document.record.documentId ||
        storedExtraction.record.extractionId !== capture.extraction.record.extractionId ||
        storedObservation.jobId !== record.jobId ||
        storedObservation.observation.observationId !== capture.observation.observationId
      ) throw new Error("content identity is already bound to another evidence artifact");
      this.#pruneEvidenceAcquisition(retentionLimit);
      const storedRecord = this.#upsertEvidenceAcquisitionJob(record);
      const storedCapture = assertEvidenceDocumentCapture(Object.freeze({
        status: capture.status,
        observation: storedObservation.observation,
        document: storedDocument,
        extraction: storedExtraction,
      }));
      this.#database.exec("COMMIT");
      return Object.freeze({ record: storedRecord, capture: storedCapture });
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadRuleEvidenceClaimJobRecords(
    limit: number,
  ): readonly RuleEvidenceClaimJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM rule_evidence_claim_jobs
         ORDER BY updated_at DESC, job_id DESC LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseRuleEvidenceClaimJobRecord));
  }

  public saveRuleEvidenceClaimJobRecord(
    recordInput: RuleEvidenceClaimJobRecord,
    retentionLimit: number,
  ): RuleEvidenceClaimJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const record = assertRuleEvidenceClaimJobRecord(recordInput);
    const recordJson = canonicalJson(record);
    const recordHash = hashCanonical(record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO rule_evidence_claim_jobs (
             job_id, status, next_attempt_at, updated_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             status = excluded.status,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          record.jobId,
          record.status,
          record.nextAttemptAt,
          record.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM rule_evidence_claim_jobs
           WHERE job_id IN (
             SELECT job_id FROM rule_evidence_claim_jobs
             ORDER BY updated_at DESC, job_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM rule_evidence_claim_jobs WHERE job_id = ?`,
        )
        .get(record.jobId);
      if (row === undefined) throw new Error("SQLite failed to retain rule evidence claim job");
      const stored = parseRuleEvidenceClaimJobRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("SQLite rule evidence claim job changed during persistence");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  #verifyRuleEvidenceClaimExtraction(record: RuleEvidenceClaimRecord): void {
    const row = this.#database
      .prepare(
        `SELECT extraction_id, document_id, record_json, record_hash, extracted_text
         FROM evidence_document_texts WHERE extraction_id = ?`,
      )
      .get(record.extractionId);
    if (row === undefined) {
      throw new Error("SQLite rule evidence claim lost its retained extraction");
    }
    const extraction = parseEvidenceDocumentText(row);
    if (extraction.record.documentId !== record.documentId) {
      throw new Error("SQLite rule evidence claim extraction belongs to another document");
    }
    if (record.claim === null) return;
    if (
      record.claim.documentRawHash !== extraction.record.rawHash ||
      record.claim.extractionTextHash !== extraction.record.textHash ||
      record.claim.citations.some((citation) =>
        extraction.text.slice(citation.start, citation.end) !== citation.quote
      )
    ) throw new Error("SQLite rule evidence claim citation or extraction lineage mismatch");
  }

  public loadRuleEvidenceClaimRecords(
    limit: number,
  ): readonly RuleEvidenceClaimRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT interpretation_id, requirement_id, document_id, extraction_id,
                record_json, record_hash
         FROM rule_evidence_claim_records
         ORDER BY completed_at DESC, interpretation_id DESC LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map((row) => {
      const record = parseRuleEvidenceClaimRecord(row);
      this.#verifyRuleEvidenceClaimExtraction(record);
      return record;
    }));
  }

  public saveRuleEvidenceClaimRecord(
    recordInput: RuleEvidenceClaimRecord,
    retentionLimit: number,
  ): RuleEvidenceClaimRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const record = assertRuleEvidenceClaimRecord(recordInput);
    if (record.status === "RUNNING" || record.completedAt === null) {
      throw new Error("SQLite cannot persist an active rule evidence claim");
    }
    this.#verifyRuleEvidenceClaimExtraction(record);
    const recordJson = canonicalJson(record);
    const recordHash = hashCanonical(record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO rule_evidence_claim_records (
             interpretation_id, requirement_id, document_id, extraction_id,
             status, completed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(interpretation_id) DO UPDATE SET
             requirement_id = excluded.requirement_id,
             document_id = excluded.document_id,
             extraction_id = excluded.extraction_id,
             status = excluded.status,
             completed_at = excluded.completed_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE rule_evidence_claim_records.status = 'FAILED'`,
        )
        .run(
          record.interpretationId,
          record.requirementId,
          record.documentId,
          record.extractionId,
          record.status,
          record.completedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM rule_evidence_claim_records
           WHERE interpretation_id IN (
             SELECT interpretation_id FROM rule_evidence_claim_records
             ORDER BY completed_at DESC, interpretation_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT interpretation_id, requirement_id, document_id, extraction_id,
                  record_json, record_hash
           FROM rule_evidence_claim_records WHERE interpretation_id = ?`,
        )
        .get(record.interpretationId);
      if (row === undefined) throw new Error("SQLite failed to retain rule evidence claim");
      const stored = parseRuleEvidenceClaimRecord(row);
      this.#verifyRuleEvidenceClaimExtraction(stored);
      if (
        stored.requirementId !== record.requirementId ||
        stored.documentId !== record.documentId || stored.extractionId !== record.extractionId ||
        (stored.status === record.status && hashCanonical(stored) !== recordHash)
      ) throw new Error("SQLite rule evidence claim identity is already bound elsewhere");
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
