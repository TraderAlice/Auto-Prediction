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
  assertCatalogContractTextEvidence,
  type CatalogContractTextEvidence,
  type CatalogContractTextEvidenceStore,
} from "./catalog-contract-text-evidence.js";
import {
  assertContractSemanticContinuity,
  type ContractSemanticContinuity,
  type ContractSemanticContinuityStore,
} from "./contract-semantic-continuity.js";
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
  assertOfficialSourceDiscoveryJobRecord,
  type OfficialSourceDiscoveryJobRecord,
  type OfficialSourceDiscoverySchedulerStore,
} from "./official-source-discovery-scheduler.js";
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
  isCatalogRuleEvidenceClaim,
  isCatalogRuleEvidenceClaimRecord,
  type RuleEvidenceClaimRecord,
  type RuleEvidenceClaimRecordStore,
  type CatalogRuleEvidenceClaimRecord,
  type CatalogRuleEvidenceClaimRecordStore,
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
  migrateAiRuntimeConfiguration,
  type AiRuntimeConfiguration,
  type AiRuntimeConfigurationStore,
} from "./ai-runtime-configuration.js";
import {
  assertAgentCampaign,
  assertAgentRun,
  assertAgentRunAnnotation,
  assertAgentRunArtifact,
  assertAgentRuntimeDefinition,
  assertAgentTask,
  assertAgentToolEffect,
  assertCredentialBinding,
  assertExecutionCapabilityObservation,
  assertExecutionProfile,
  assertExecutionProfileCompatibility,
  assertModelInvocation,
  assertModelProfile,
  assertResultSelection,
  assertWorkloadRoute,
  emptyAgentExecutionSnapshot,
  type AgentCampaign,
  type AgentExecutionBatch,
  type AgentExecutionSnapshot,
  type AgentExecutionStore,
  type AgentRun,
  type AgentRunAnnotation,
  type AgentRunArtifact,
  type AgentRuntimeDefinition,
  type AgentTask,
  type AgentToolEffect,
  type CredentialBinding,
  type ExecutionProfile,
  type ExecutionCapabilityObservation,
  type ModelInvocation,
  type ModelProfile,
  type ResultSelection,
  type WorkloadRoute,
} from "./agent-execution-substrate.js";
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
import {
  assertMarketOntologyAgentProposal,
  type MarketOntologyAgentProposal,
  type MarketOntologyAgentProposalStore,
} from "./market-ontology-agent-tools.js";
import {
  assertWorldStateMechanismAbstention,
  assertWorldStateMechanismCounterexample,
  assertWorldStateMechanismProposal,
  worldStateMechanismRouteFamilyIdentity,
  type WorldStateMechanismAbstention,
  type WorldStateMechanismAbstentionStore,
  type WorldStateMechanismCounterexample,
  type WorldStateMechanismCounterexampleStore,
  type WorldStateMechanismProposal,
  type WorldStateMechanismProposalStore,
} from "./world-state-mechanism.js";
import { worldStateMechanismResearchIssueIdentity } from "./world-state-mechanism-research.js";
import {
  assertWorldStateMechanismObservation,
  assertWorldStateMechanismSubjectBindingReview,
  assertWorldStateMechanismWake,
  type WorldStateMechanismObservation,
  type WorldStateMechanismObservationStore,
  type WorldStateMechanismSubjectBindingReview,
  type WorldStateMechanismSubjectBindingReviewStore,
  type WorldStateMechanismWake,
  type WorldStateMechanismWakeStore,
} from "./world-state-mechanism-observer.js";
import {
  assertWorldStateSubjectBindingAbstention,
  assertWorldStateSubjectBindingAssessment,
  assertWorldStateSubjectBindingResearchInput,
  type WorldStateSubjectBindingAbstention,
  type WorldStateSubjectBindingAssessment,
  type WorldStateSubjectBindingResearchInputRevision,
  type WorldStateSubjectBindingResearchStore,
} from "./world-state-subject-binding-research.js";
import {
  assertWorldStateMechanismPrototypeAbstention,
  assertWorldStateMechanismPrototypeInput,
  assertWorldStateMechanismPrototypeProposal,
  buildWorldStateMechanismPrototypeProposal,
  type WorldStateMechanismPrototypeAbstention,
  type WorldStateMechanismPrototypeInputRevision,
  type WorldStateMechanismPrototypeProposal,
  type WorldStateMechanismPrototypeStore,
} from "./world-state-mechanism-prototype.js";
import {
  assertMechanismPrototypeExplorationActionObservation,
  assertMechanismPrototypeExplorationStepObservation,
  assertMechanismPrototypeExplorationFlatSearchObservation,
  assertMechanismPrototypeExplorationRoleSearchObservation,
  assertMechanismPrototypeExplorationExhaustion,
  assertMechanismPrototypeExplorationInputRevision,
  assertMechanismPrototypeExplorationTrailhead,
  type MechanismPrototypeExplorationExhaustion,
  type MechanismPrototypeExplorationActionObservation,
  type MechanismPrototypeExplorationInputRevision,
  type MechanismPrototypeExplorationFlatSearchObservation,
  type MechanismPrototypeExplorationRoleSearchObservation,
  type MechanismPrototypeExplorationStepObservation,
  type MechanismPrototypeExplorationStore,
  type MechanismPrototypeExplorationTrailhead,
} from "./mechanism-prototype-guided-exploration.js";
import {
  assertOntologySearchIssueRevision,
  type OntologySearchIssueRevision,
  type OntologySearchIssueRevisionStore,
} from "./ontology-search-ecology.js";
import {
  assertRelationDiscoveryFinding,
  verifyRelationDiscoveryFindingEvidence,
  verifyRelationDiscoveryFindingEvidenceAgainstVerifiedCorpus,
  type RelationDiscoveryFinding,
  type RelationDiscoveryFindingStore,
} from "./relation-discovery-agent-tools.js";
import {
  assertRelationDiscoveryTaskRevision,
  type RelationDiscoveryTaskRevision,
  type RelationDiscoveryTaskRevisionStore,
} from "./relation-discovery-work.js";
import {
  assertDiscoverySignalRecord,
  type DiscoverySignalRecord,
  type DiscoverySignalStore,
} from "./discovery-signals.js";
import {
  assertResearchDecisionEpisode,
  type ResearchDecisionEpisode,
  type ResearchDecisionEpisodeStore,
} from "./research-decision-outcomes.js";
import {
  assertResearchDecisionOutcomeObservation,
  type ResearchDecisionOutcomeObservation,
  type ResearchDecisionOutcomeObservationStore,
} from "./research-decision-outcome-observations.js";
import {
  assertStandingOntologyRouteObservationEpisode,
  type StandingOntologyRouteObservationEpisode,
  type StandingOntologyRouteObservationEpisodeStore,
} from "./standing-ontology-routes.js";
import {
  assertStudioProjectionSnapshot,
  type StudioProjectionSnapshot,
  type StudioProjectionSnapshotStore,
} from "./studio-projection-snapshot.js";
import {
  assertSettlementProjection,
  assertWorldPredicateArtifact,
  assertWorldRelationExperiment,
  type SettlementProjection,
  type WorldHistoryOntologyStore,
  type WorldPredicateArtifact,
  type WorldRelationExperiment,
} from "./world-history-ontology.js";
import {
  assertWorldRelationExperimentInputRevision,
  type WorldRelationExperimentInputRevision,
  type WorldRelationExperimentInputStore,
} from "./world-relation-experiment-work.js";
import {
  assertSettlementProjectionObservation,
  type SettlementProjectionObservation,
  type SettlementProjectionObservationStore,
} from "./settlement-projection-compiler.js";

const SCHEMA_VERSION = 62;
const MAX_SEARCH_LEASE_CORPUS_BYTES = 32_000_000;
const MAX_RETAINED_ONTOLOGY_SEARCH_REVISIONS = 512;

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

type DiscoverySignalRow = Readonly<{
  signal_id: string;
  record_json: string;
  record_hash: string;
}>;

type ResearchDecisionOutcomeObservationRow = Readonly<{
  observation_id: string;
  record_json: string;
  record_hash: string;
}>;

type CatalogContractTextEvidenceRow = Readonly<{
  artifact_id: string;
  catalog_observation_id: string;
  record_json: string;
  record_hash: string;
}>;

type ContractSemanticContinuityRow = Readonly<{
  continuity_id: string;
  record_json: string;
  record_hash: string;
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

type AgentExecutionRecordRow = Readonly<{
  record_id: string;
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

type OfficialSourceDiscoveryJobRow = EvidenceAcquisitionJobRow;

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

type CatalogRuleEvidenceClaimRecordRow = Readonly<{
  interpretation_id: string;
  requirement_id: string;
  source_artifact_id: string;
  text_artifact_id: string;
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

function parseCatalogContractTextEvidence(
  value: unknown,
): CatalogContractTextEvidence {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite catalog contract-text evidence row is malformed");
  }
  const row = value as Partial<CatalogContractTextEvidenceRow>;
  if (
    typeof row.artifact_id !== "string" ||
    typeof row.catalog_observation_id !== "string" ||
    typeof row.record_json !== "string" || typeof row.record_hash !== "string"
  ) throw new Error("SQLite catalog contract-text evidence row has invalid columns");
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite catalog contract-text evidence contains invalid JSON");
  }
  const artifact = assertCatalogContractTextEvidence(decoded);
  if (
    artifact.artifactId !== row.artifact_id ||
    artifact.catalogObservationId !== row.catalog_observation_id ||
    hashCanonical(artifact) !== row.record_hash
  ) throw new Error("SQLite catalog contract-text evidence identity mismatch");
  return artifact;
}

function parseContractSemanticContinuity(
  value: unknown,
): ContractSemanticContinuity {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite contract semantic continuity row is malformed");
  }
  const row = value as Partial<ContractSemanticContinuityRow>;
  if (
    typeof row.continuity_id !== "string" ||
    typeof row.record_json !== "string" || typeof row.record_hash !== "string"
  ) throw new Error("SQLite contract semantic continuity row has invalid columns");
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite contract semantic continuity contains invalid JSON");
  }
  const continuity = assertContractSemanticContinuity(decoded);
  if (
    continuity.continuityId !== row.continuity_id ||
    hashCanonical(continuity) !== row.record_hash
  ) throw new Error("SQLite contract semantic continuity identity mismatch");
  return continuity;
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

function parseOfficialSourceDiscoveryJobRecord(
  value: unknown,
): OfficialSourceDiscoveryJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite official source discovery job row is malformed");
  }
  const row = value as Partial<OfficialSourceDiscoveryJobRow>;
  if (
    typeof row.job_id !== "string" || typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error("SQLite official source discovery job row has invalid column types");
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error("SQLite official source discovery job contains invalid JSON");
  }
  const record = assertOfficialSourceDiscoveryJobRecord(decoded);
  if (record.jobId !== row.job_id || hashCanonical(record) !== row.record_hash) {
    throw new Error("SQLite official source discovery job identity mismatch");
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
  if (isCatalogRuleEvidenceClaimRecord(record)) {
    throw new Error("catalog rule evidence claim is stored in the wrong table");
  }
  if (
    record.interpretationId !== row.interpretation_id ||
    record.requirementId !== row.requirement_id || record.documentId !== row.document_id ||
    record.extractionId !== row.extraction_id || hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite rule evidence claim record identity mismatch");
  return record;
}

function parseCatalogRuleEvidenceClaimRecord(
  value: unknown,
): CatalogRuleEvidenceClaimRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite catalog rule evidence claim row is malformed");
  }
  const row = value as Partial<CatalogRuleEvidenceClaimRecordRow>;
  if (
    typeof row.interpretation_id !== "string" ||
    typeof row.requirement_id !== "string" ||
    typeof row.source_artifact_id !== "string" ||
    typeof row.text_artifact_id !== "string" ||
    typeof row.record_json !== "string" || typeof row.record_hash !== "string"
  ) throw new Error("SQLite catalog rule evidence claim row has invalid columns");
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite catalog rule evidence claim contains invalid JSON");
  }
  const record = assertRuleEvidenceClaimRecord(decoded);
  if (
    !isCatalogRuleEvidenceClaimRecord(record) ||
    record.interpretationId !== row.interpretation_id ||
    record.requirementId !== row.requirement_id ||
    record.sourceArtifactId !== row.source_artifact_id ||
    record.textArtifactId !== row.text_artifact_id ||
    hashCanonical(record) !== row.record_hash
  ) throw new Error("SQLite catalog rule evidence claim identity mismatch");
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
  if (hashCanonical(decoded) !== row.record_hash) {
    throw new Error("SQLite AI runtime configuration hash mismatch");
  }
  return migrateAiRuntimeConfiguration(decoded);
}

function parseAgentExecutionRecord<T>(
  value: unknown,
  identity: (record: T) => string,
  validator: (record: unknown) => T,
  label: string,
): T {
  if (value === null || typeof value !== "object") {
    throw new Error(`SQLite ${label} row is malformed`);
  }
  const row = value as Partial<AgentExecutionRecordRow>;
  if (
    typeof row.record_id !== "string" ||
    typeof row.record_json !== "string" ||
    typeof row.record_hash !== "string"
  ) throw new Error(`SQLite ${label} row has invalid columns`);
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.record_json);
  } catch {
    throw new Error(`SQLite ${label} contains invalid JSON`);
  }
  const record = validator(decoded);
  if (identity(record) !== row.record_id || hashCanonical(record) !== row.record_hash) {
    throw new Error(`SQLite ${label} identity mismatch`);
  }
  return record;
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

function parseMarketOntologyAgentProposal(value: unknown): MarketOntologyAgentProposal {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite market ontology Agent proposal row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.proposal_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite market ontology Agent proposal row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite market ontology Agent proposal contains invalid JSON");
  }
  const proposal = assertMarketOntologyAgentProposal(decoded);
  if (proposal.proposalId !== row.proposal_id || hashCanonical(proposal) !== row.record_hash) {
    throw new Error("SQLite market ontology Agent proposal identity mismatch");
  }
  return proposal;
}

function parseWorldPredicateArtifact(value: unknown): WorldPredicateArtifact {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world predicate artifact row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.artifact_hash !== "string" || typeof row.predicate_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world predicate artifact row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world predicate artifact contains invalid JSON");
  }
  const artifact = assertWorldPredicateArtifact(decoded);
  if (artifact.artifactHash !== row.artifact_hash || artifact.predicateId !== row.predicate_id ||
      artifact.artifactHash !== row.record_hash) {
    throw new Error("SQLite world predicate artifact identity mismatch");
  }
  return artifact;
}

function parseSettlementProjection(value: unknown): SettlementProjection {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite settlement projection row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.artifact_hash !== "string" || typeof row.projection_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite settlement projection row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite settlement projection contains invalid JSON");
  }
  const projection = assertSettlementProjection(decoded);
  if (projection.artifactHash !== row.artifact_hash ||
      projection.projectionId !== row.projection_id ||
      projection.artifactHash !== row.record_hash) {
    throw new Error("SQLite settlement projection identity mismatch");
  }
  return projection;
}

function parseSettlementProjectionObservation(
  value: unknown,
): SettlementProjectionObservation {
  const row = value as Readonly<{ artifact_hash?: unknown; record_json?: unknown;
    record_hash?: unknown }>;
  if (typeof row?.record_json !== "string" || row.record_hash !== row.artifact_hash) {
    throw new Error("stored settlement projection observation is malformed");
  }
  const decoded = assertSettlementProjectionObservation(JSON.parse(row.record_json));
  if (decoded.artifactHash !== row.artifact_hash) {
    throw new Error("stored settlement projection observation identity is inconsistent");
  }
  return decoded;
}

function parseWorldRelationExperiment(value: unknown): WorldRelationExperiment {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world relation experiment row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.artifact_hash !== "string" || typeof row.experiment_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world relation experiment row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world relation experiment contains invalid JSON");
  }
  const experiment = assertWorldRelationExperiment(decoded);
  if (experiment.artifactHash !== row.artifact_hash ||
      experiment.experimentId !== row.experiment_id ||
      experiment.artifactHash !== row.record_hash) {
    throw new Error("SQLite world relation experiment identity mismatch");
  }
  return experiment;
}

function parseWorldRelationExperimentInput(
  value: unknown,
): WorldRelationExperimentInputRevision {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world relation experiment input row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.input_revision_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world relation experiment input row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world relation experiment input contains invalid JSON");
  }
  const revision = assertWorldRelationExperimentInputRevision(decoded);
  if (revision.inputRevisionId !== row.input_revision_id ||
      hashCanonical(revision) !== row.record_hash) {
    throw new Error("SQLite world relation experiment input identity mismatch");
  }
  return revision;
}

function parseWorldStateMechanismProposal(value: unknown): WorldStateMechanismProposal {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world-state mechanism proposal row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.proposal_id !== "string" || typeof row.route_family_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world-state mechanism proposal row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world-state mechanism proposal contains invalid JSON");
  }
  const proposal = assertWorldStateMechanismProposal(decoded);
  if (proposal.proposalId !== row.proposal_id ||
      worldStateMechanismRouteFamilyIdentity(proposal) !== row.route_family_id ||
      hashCanonical(proposal) !== row.record_hash) {
    throw new Error("SQLite world-state mechanism proposal identity mismatch");
  }
  return proposal;
}

function parseWorldStateMechanismCounterexample(
  value: unknown,
): WorldStateMechanismCounterexample {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world-state mechanism counterexample row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.counterexample_id !== "string" ||
      typeof row.target_route_family_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world-state mechanism counterexample row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world-state mechanism counterexample contains invalid JSON");
  }
  const counterexample = assertWorldStateMechanismCounterexample(decoded);
  if (counterexample.counterexampleId !== row.counterexample_id ||
      counterexample.targetRouteFamilyId !== row.target_route_family_id ||
      hashCanonical(counterexample) !== row.record_hash) {
    throw new Error("SQLite world-state mechanism counterexample identity mismatch");
  }
  return counterexample;
}

function parseWorldStateMechanismAbstention(
  value: unknown,
): WorldStateMechanismAbstention {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world-state mechanism abstention row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.abstention_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world-state mechanism abstention row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world-state mechanism abstention contains invalid JSON");
  }
  const abstention = assertWorldStateMechanismAbstention(decoded);
  if (abstention.abstentionId !== row.abstention_id ||
      hashCanonical(abstention) !== row.record_hash) {
    throw new Error("SQLite world-state mechanism abstention identity mismatch");
  }
  return abstention;
}

function parseWorldStateMechanismSubjectBindingReview(
  value: unknown,
): WorldStateMechanismSubjectBindingReview {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world-state mechanism subject review row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.review_id !== "string" || typeof row.route_family_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world-state mechanism subject review row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world-state mechanism subject review contains invalid JSON");
  }
  const review = assertWorldStateMechanismSubjectBindingReview(decoded);
  if (review.reviewId !== row.review_id || review.routeFamilyId !== row.route_family_id ||
      hashCanonical(review) !== row.record_hash) {
    throw new Error("SQLite world-state mechanism subject review identity mismatch");
  }
  return review;
}

function parseWorldStateSubjectBindingResearchInput(
  value: unknown,
): WorldStateSubjectBindingResearchInputRevision {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite subject-binding research input row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.revision_id !== "string" || typeof row.case_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite subject-binding research input row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite subject-binding research input contains invalid JSON");
  }
  const input = assertWorldStateSubjectBindingResearchInput(decoded);
  if (input.revisionId !== row.revision_id || input.caseId !== row.case_id ||
      hashCanonical(input) !== row.record_hash) {
    throw new Error("SQLite subject-binding research input identity mismatch");
  }
  return input;
}

function parseWorldStateSubjectBindingAssessment(
  value: unknown,
): WorldStateSubjectBindingAssessment {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite subject-binding assessment row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.assessment_id !== "string" || typeof row.case_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite subject-binding assessment row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite subject-binding assessment contains invalid JSON");
  }
  const assessment = assertWorldStateSubjectBindingAssessment(decoded);
  if (assessment.assessmentId !== row.assessment_id || assessment.caseId !== row.case_id ||
      hashCanonical(assessment) !== row.record_hash) {
    throw new Error("SQLite subject-binding assessment identity mismatch");
  }
  return assessment;
}

function parseWorldStateSubjectBindingAbstention(
  value: unknown,
): WorldStateSubjectBindingAbstention {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite subject-binding abstention row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.abstention_id !== "string" || typeof row.case_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite subject-binding abstention row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite subject-binding abstention contains invalid JSON");
  }
  const abstention = assertWorldStateSubjectBindingAbstention(decoded);
  if (abstention.abstentionId !== row.abstention_id || abstention.caseId !== row.case_id ||
      hashCanonical(abstention) !== row.record_hash) {
    throw new Error("SQLite subject-binding abstention identity mismatch");
  }
  return abstention;
}

function parseWorldStateMechanismPrototypeInput(
  value: unknown,
): WorldStateMechanismPrototypeInputRevision {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.revision_id !== "string" ||
      typeof row.candidate_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism prototype input row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism prototype input contains invalid JSON");
  }
  const input = assertWorldStateMechanismPrototypeInput(decoded);
  if (input.revisionId !== row.revision_id || input.candidateId !== row.candidate_id ||
      hashCanonical(input) !== row.record_hash) {
    throw new Error("SQLite mechanism prototype input identity mismatch");
  }
  return input;
}

function parseWorldStateMechanismPrototypeProposal(
  value: unknown,
): WorldStateMechanismPrototypeProposal {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.prototype_id !== "string" ||
      typeof row.candidate_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism prototype proposal row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism prototype proposal contains invalid JSON");
  }
  const proposal = assertWorldStateMechanismPrototypeProposal(decoded);
  if (proposal.prototypeId !== row.prototype_id || proposal.candidateId !== row.candidate_id ||
      hashCanonical(proposal) !== row.record_hash) {
    throw new Error("SQLite mechanism prototype proposal identity mismatch");
  }
  return proposal;
}

function parseWorldStateMechanismPrototypeAbstention(
  value: unknown,
): WorldStateMechanismPrototypeAbstention {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.abstention_id !== "string" ||
      typeof row.candidate_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism prototype abstention row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism prototype abstention contains invalid JSON");
  }
  const abstention = assertWorldStateMechanismPrototypeAbstention(decoded);
  if (abstention.abstentionId !== row.abstention_id ||
      abstention.candidateId !== row.candidate_id ||
      hashCanonical(abstention) !== row.record_hash) {
    throw new Error("SQLite mechanism prototype abstention identity mismatch");
  }
  return abstention;
}

function parseMechanismPrototypeExplorationInput(
  value: unknown,
): MechanismPrototypeExplorationInputRevision {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" ||
      typeof row.input_revision_id !== "string" || typeof row.lens_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration input row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration input contains invalid JSON");
  }
  const input = assertMechanismPrototypeExplorationInputRevision(decoded);
  if (input.inputRevisionId !== row.input_revision_id || input.lensId !== row.lens_id ||
      hashCanonical(input) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration input identity mismatch");
  }
  return input;
}

function parseMechanismPrototypeExplorationTrailhead(
  value: unknown,
): MechanismPrototypeExplorationTrailhead {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.trailhead_id !== "string" ||
      typeof row.lens_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration trailhead row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration trailhead contains invalid JSON");
  }
  const trailhead = assertMechanismPrototypeExplorationTrailhead(decoded);
  if (trailhead.trailheadId !== row.trailhead_id || trailhead.lensId !== row.lens_id ||
      hashCanonical(trailhead) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration trailhead identity mismatch");
  }
  return trailhead;
}

function parseMechanismPrototypeExplorationExhaustion(
  value: unknown,
): MechanismPrototypeExplorationExhaustion {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.exhaustion_id !== "string" ||
      typeof row.lens_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration exhaustion row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration exhaustion contains invalid JSON");
  }
  const exhaustion = assertMechanismPrototypeExplorationExhaustion(decoded);
  if (exhaustion.exhaustionId !== row.exhaustion_id || exhaustion.lensId !== row.lens_id ||
      hashCanonical(exhaustion) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration exhaustion identity mismatch");
  }
  return exhaustion;
}

function parseMechanismPrototypeExplorationRoleSearchObservation(
  value: unknown,
): MechanismPrototypeExplorationRoleSearchObservation {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.observation_id !== "string" ||
      typeof row.lens_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration role-search observation row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration role-search observation contains invalid JSON");
  }
  const observation = assertMechanismPrototypeExplorationRoleSearchObservation(decoded);
  if (observation.observationId !== row.observation_id ||
      observation.lensId !== row.lens_id || hashCanonical(observation) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration role-search observation identity mismatch");
  }
  return observation;
}

function parseMechanismPrototypeExplorationFlatSearchObservation(
  value: unknown,
): MechanismPrototypeExplorationFlatSearchObservation {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.observation_id !== "string" ||
      typeof row.lens_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration flat-search observation row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration flat-search observation contains invalid JSON");
  }
  const observation = assertMechanismPrototypeExplorationFlatSearchObservation(decoded);
  if (observation.observationId !== row.observation_id ||
      observation.lensId !== row.lens_id || hashCanonical(observation) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration flat-search observation identity mismatch");
  }
  return observation;
}

function parseMechanismPrototypeExplorationActionObservation(
  value: unknown,
): MechanismPrototypeExplorationActionObservation {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.observation_id !== "string" ||
      typeof row.lens_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration action observation row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration action observation contains invalid JSON");
  }
  const observation = assertMechanismPrototypeExplorationActionObservation(decoded);
  if (observation.observationId !== row.observation_id ||
      observation.lensId !== row.lens_id || hashCanonical(observation) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration action observation identity mismatch");
  }
  return observation;
}

function parseMechanismPrototypeExplorationStepObservation(
  value: unknown,
): MechanismPrototypeExplorationStepObservation {
  const row = value as Readonly<Record<string, unknown>> | null;
  if (row === null || typeof row !== "object" || typeof row.observation_id !== "string" ||
      typeof row.lens_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite mechanism exploration step observation row is malformed");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite mechanism exploration step observation contains invalid JSON");
  }
  const observation = assertMechanismPrototypeExplorationStepObservation(decoded);
  if (observation.observationId !== row.observation_id ||
      observation.lensId !== row.lens_id || hashCanonical(observation) !== row.record_hash) {
    throw new Error("SQLite mechanism exploration step observation identity mismatch");
  }
  return observation;
}

function parseWorldStateMechanismObservation(
  value: unknown,
): WorldStateMechanismObservation {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world-state mechanism observation row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.observation_id !== "string" ||
      typeof row.route_family_id !== "string" ||
      typeof row.membership_identity !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite world-state mechanism observation row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world-state mechanism observation contains invalid JSON");
  }
  const observation = assertWorldStateMechanismObservation(decoded);
  if (observation.observationId !== row.observation_id ||
      observation.routeFamilyId !== row.route_family_id ||
      observation.membershipIdentity !== row.membership_identity ||
      hashCanonical(observation) !== row.record_hash) {
    throw new Error("SQLite world-state mechanism observation identity mismatch");
  }
  return observation;
}

function parseWorldStateMechanismWake(value: unknown): WorldStateMechanismWake {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite world-state mechanism wake row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.wake_id !== "string" || typeof row.route_family_id !== "string" ||
      typeof row.work_item_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite world-state mechanism wake row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite world-state mechanism wake contains invalid JSON");
  }
  const wake = assertWorldStateMechanismWake(decoded);
  if (wake.wakeId !== row.wake_id || wake.routeFamilyId !== row.route_family_id ||
      wake.workItem.workItemId !== row.work_item_id || hashCanonical(wake) !== row.record_hash) {
    throw new Error("SQLite world-state mechanism wake identity mismatch");
  }
  return wake;
}

function parseOntologySearchIssueRevision(value: unknown): OntologySearchIssueRevision {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite ontology search issue revision row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.revision_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite ontology search issue revision row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite ontology search issue revision contains invalid JSON");
  }
  const revision = assertOntologySearchIssueRevision(decoded);
  if (revision.revisionId !== row.revision_id || hashCanonical(revision) !== row.record_hash) {
    throw new Error("SQLite ontology search issue revision identity mismatch");
  }
  return revision;
}

function parseRelationDiscoveryTaskRevision(value: unknown): RelationDiscoveryTaskRevision {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite relation discovery task revision row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.revision_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite relation discovery task revision row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite relation discovery task revision contains invalid JSON");
  }
  const revision = assertRelationDiscoveryTaskRevision(decoded);
  if (revision.revisionId !== row.revision_id || hashCanonical(revision) !== row.record_hash) {
    throw new Error("SQLite relation discovery task revision identity mismatch");
  }
  return revision;
}

function parseRelationDiscoveryCorpus(value: unknown): MarketCorpusSnapshot {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite relation discovery corpus row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.snapshot_identity !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite relation discovery corpus row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite relation discovery corpus contains invalid JSON");
  }
  const corpus = assertMarketCorpusSnapshot(decoded);
  if (corpus.snapshotIdentity !== row.snapshot_identity || hashCanonical(corpus) !== row.record_hash) {
    throw new Error("SQLite relation discovery corpus identity mismatch");
  }
  return corpus;
}

function parseRelationDiscoveryFinding(value: unknown): RelationDiscoveryFinding {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite relation discovery finding row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.finding_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite relation discovery finding row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite relation discovery finding contains invalid JSON");
  }
  const finding = assertRelationDiscoveryFinding(decoded);
  if (finding.findingId !== row.finding_id || hashCanonical(finding) !== row.record_hash) {
    throw new Error("SQLite relation discovery finding identity mismatch");
  }
  return finding;
}

function parseStandingOntologyRouteObservationEpisode(
  value: unknown,
): StandingOntologyRouteObservationEpisode {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite standing route observation episode row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.episode_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite standing route observation episode row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite standing route observation episode contains invalid JSON");
  }
  const episode = assertStandingOntologyRouteObservationEpisode(decoded);
  if (episode.episodeId !== row.episode_id || hashCanonical(episode) !== row.record_hash) {
    throw new Error("SQLite standing route observation episode identity mismatch");
  }
  return episode;
}

function parseResearchDecisionEpisode(value: unknown): ResearchDecisionEpisode {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite research decision episode row is malformed");
  }
  const row = value as Readonly<Record<string, unknown>>;
  if (typeof row.episode_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite research decision episode row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite research decision episode contains invalid JSON");
  }
  const episode = assertResearchDecisionEpisode(decoded);
  if (episode.episodeId !== row.episode_id || hashCanonical(episode) !== row.record_hash) {
    throw new Error("SQLite research decision episode identity mismatch");
  }
  return episode;
}

function parseDiscoverySignal(value: unknown): DiscoverySignalRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite discovery signal row is malformed");
  }
  const row = value as DiscoverySignalRow;
  if (typeof row.signal_id !== "string" || typeof row.record_json !== "string" ||
      typeof row.record_hash !== "string") {
    throw new Error("SQLite discovery signal row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite discovery signal contains invalid JSON");
  }
  const signal = assertDiscoverySignalRecord(decoded);
  if (signal.signalId !== row.signal_id || hashCanonical(signal) !== row.record_hash) {
    throw new Error("SQLite discovery signal identity mismatch");
  }
  return signal;
}

function parseResearchDecisionOutcomeObservation(
  value: unknown,
): ResearchDecisionOutcomeObservation {
  if (value === null || typeof value !== "object") {
    throw new Error("SQLite research decision outcome observation row is malformed");
  }
  const row = value as ResearchDecisionOutcomeObservationRow;
  if (typeof row.observation_id !== "string" ||
      typeof row.record_json !== "string" || typeof row.record_hash !== "string") {
    throw new Error("SQLite research decision outcome observation row has invalid columns");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.record_json); } catch {
    throw new Error("SQLite research decision outcome observation contains invalid JSON");
  }
  const observation = assertResearchDecisionOutcomeObservation(decoded);
  if (observation.observationId !== row.observation_id ||
      hashCanonical(observation) !== row.record_hash) {
    throw new Error("SQLite research decision outcome observation identity mismatch");
  }
  return observation;
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
    CatalogContractTextEvidenceStore,
    ContractSemanticContinuityStore,
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
    AgentExecutionStore,
    PremiseAnalysisRecordStore,
    PremiseAnalysisSchedulerStore,
    PremiseEvidenceRoutingSchedulerStore,
    PremiseRouteExpansionSchedulerStore,
    SemanticReviewSchedulerStore,
    OfficialSourceDiscoverySchedulerStore,
    EvidenceAcquisitionSchedulerStore,
    RuleEvidenceClaimRecordStore,
    CatalogRuleEvidenceClaimRecordStore,
    RuleEvidenceClaimSchedulerStore,
    OpportunityLifecycleJournalStore,
    AnonymousSimulationMaterializationStore,
    ProbabilityCalibrationStore,
    ProbabilityResolutionCaptureStore,
    MarketOntologyAgentProposalStore,
    WorldStateMechanismProposalStore,
    WorldStateMechanismCounterexampleStore,
    WorldStateMechanismAbstentionStore,
    WorldStateMechanismSubjectBindingReviewStore,
    WorldStateSubjectBindingResearchStore,
    WorldStateMechanismPrototypeStore,
    MechanismPrototypeExplorationStore,
    WorldStateMechanismObservationStore,
    WorldStateMechanismWakeStore,
    OntologySearchIssueRevisionStore,
    RelationDiscoveryTaskRevisionStore,
    RelationDiscoveryFindingStore,
    StandingOntologyRouteObservationEpisodeStore,
    ResearchDecisionEpisodeStore,
    ResearchDecisionOutcomeObservationStore,
    DiscoverySignalStore,
    StudioProjectionSnapshotStore,
    WorldHistoryOntologyStore,
    WorldRelationExperimentInputStore,
    SettlementProjectionObservationStore
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
  public readonly catalogContractTextEvidenceStorage:
    OperationalStorageProjection<"artifactId">;
  public readonly contractSemanticContinuityStorage:
    OperationalStorageProjection<"continuityId">;
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
  public readonly agentExecutionStorage:
    OperationalStorageProjection<"recordId">;
  public readonly marketOntologyAgentProposalStorage:
    OperationalStorageProjection<"proposalId">;
  public readonly worldStateMechanismProposalStorage:
    OperationalStorageProjection<"proposalId">;
  public readonly worldStateMechanismCounterexampleStorage:
    OperationalStorageProjection<"counterexampleId">;
  public readonly worldStateMechanismAbstentionStorage:
    OperationalStorageProjection<"abstentionId">;
  public readonly worldStateMechanismSubjectBindingReviewStorage:
    OperationalStorageProjection<"reviewId">;
  public readonly worldStateSubjectBindingResearchInputStorage:
    OperationalStorageProjection<"revisionId">;
  public readonly worldStateSubjectBindingAssessmentStorage:
    OperationalStorageProjection<"assessmentId">;
  public readonly worldStateSubjectBindingAbstentionStorage:
    OperationalStorageProjection<"abstentionId">;
  public readonly worldStateMechanismPrototypeInputStorage:
    OperationalStorageProjection<"revisionId">;
  public readonly worldStateMechanismPrototypeProposalStorage:
    OperationalStorageProjection<"prototypeId">;
  public readonly worldStateMechanismPrototypeAbstentionStorage:
    OperationalStorageProjection<"abstentionId">;
  public readonly mechanismPrototypeExplorationInputStorage:
    OperationalStorageProjection<"inputRevisionId">;
  public readonly mechanismPrototypeExplorationTrailheadStorage:
    OperationalStorageProjection<"trailheadId">;
  public readonly mechanismPrototypeExplorationExhaustionStorage:
    OperationalStorageProjection<"exhaustionId">;
  public readonly mechanismPrototypeExplorationRoleSearchObservationStorage:
    OperationalStorageProjection<"observationId">;
  public readonly mechanismPrototypeExplorationFlatSearchObservationStorage:
    OperationalStorageProjection<"observationId">;
  public readonly mechanismPrototypeExplorationActionObservationStorage:
    OperationalStorageProjection<"observationId">;
  public readonly mechanismPrototypeExplorationStepObservationStorage:
    OperationalStorageProjection<"observationId">;
  public readonly worldStateMechanismObservationStorage:
    OperationalStorageProjection<"observationId">;
  public readonly worldStateMechanismWakeStorage:
    OperationalStorageProjection<"wakeId">;
  public readonly ontologySearchIssueRevisionStorage:
    OperationalStorageProjection<"revisionId">;
  public readonly relationDiscoveryTaskRevisionStorage:
    OperationalStorageProjection<"revisionId">;
  public readonly relationDiscoveryCorpusStorage:
    OperationalStorageProjection<"snapshotIdentity">;
  public readonly relationDiscoveryFindingStorage:
    OperationalStorageProjection<"findingId">;
  public readonly standingOntologyRouteObservationEpisodeStorage:
    OperationalStorageProjection<"episodeId">;
  public readonly researchDecisionEpisodeStorage:
    OperationalStorageProjection<"episodeId">;
  public readonly researchDecisionOutcomeObservationStorage:
    OperationalStorageProjection<"observationId">;
  public readonly discoverySignalStorage:
    OperationalStorageProjection<"signalId">;
  public readonly studioProjectionSnapshotStorage:
    OperationalStorageProjection<"singleton">;
  public readonly worldPredicateArtifactStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly settlementProjectionStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly settlementProjectionObservationStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly worldRelationExperimentStorage:
    OperationalStorageProjection<"artifactHash">;
  public readonly worldRelationExperimentInputStorage:
    OperationalStorageProjection<"inputRevisionId">;
  public readonly worldRelationExperimentCorpusStorage:
    OperationalStorageProjection<"snapshotIdentity">;
  public readonly premiseAnalysisStorage: OperationalStorageProjection<"analysisId">;
  public readonly premiseAnalysisJobStorage: OperationalStorageProjection<"jobId">;
  public readonly premiseAnalysisNotificationStorage: OperationalStorageProjection<"notificationId">;
  public readonly premiseEvidenceRoutingJobStorage: OperationalStorageProjection<"jobId">;
  public readonly premiseRouteExpansionJobStorage: OperationalStorageProjection<"jobId">;
  public readonly semanticReviewJobStorage: OperationalStorageProjection<"jobId">;
  public readonly semanticReviewNotificationStorage: OperationalStorageProjection<"notificationId">;
  public readonly officialSourceDiscoveryJobStorage: OperationalStorageProjection<"jobId">;
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
    this.catalogContractTextEvidenceStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactId",
    });
    this.contractSemanticContinuityStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "continuityId",
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
    this.agentExecutionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "recordId",
    });
    this.marketOntologyAgentProposalStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "proposalId",
    });
    this.worldStateMechanismProposalStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "proposalId",
    });
    this.worldStateMechanismCounterexampleStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "counterexampleId",
    });
    this.worldStateMechanismAbstentionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "abstentionId",
    });
    this.worldStateMechanismSubjectBindingReviewStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "reviewId",
    });
    this.worldStateSubjectBindingResearchInputStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "revisionId",
    });
    this.worldStateSubjectBindingAssessmentStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "assessmentId",
    });
    this.worldStateSubjectBindingAbstentionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "abstentionId",
    });
    this.worldStateMechanismPrototypeInputStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "revisionId",
    });
    this.worldStateMechanismPrototypeProposalStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "prototypeId",
    });
    this.worldStateMechanismPrototypeAbstentionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "abstentionId",
    });
    this.mechanismPrototypeExplorationInputStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "inputRevisionId",
    });
    this.mechanismPrototypeExplorationTrailheadStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "trailheadId",
    });
    this.mechanismPrototypeExplorationExhaustionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "exhaustionId",
    });
    this.mechanismPrototypeExplorationRoleSearchObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.mechanismPrototypeExplorationFlatSearchObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.mechanismPrototypeExplorationActionObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.mechanismPrototypeExplorationStepObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.worldStateMechanismObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.worldStateMechanismWakeStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "wakeId",
    });
    this.ontologySearchIssueRevisionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "revisionId",
    });
    this.relationDiscoveryTaskRevisionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "revisionId",
    });
    this.relationDiscoveryCorpusStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "snapshotIdentity",
    });
    this.relationDiscoveryFindingStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "findingId",
    });
    this.standingOntologyRouteObservationEpisodeStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "episodeId",
    });
    this.researchDecisionEpisodeStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "episodeId",
    });
    this.researchDecisionOutcomeObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "observationId",
    });
    this.discoverySignalStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "signalId",
    });
    this.studioProjectionSnapshotStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "singleton",
    });
    this.worldPredicateArtifactStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.settlementProjectionStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.settlementProjectionObservationStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.worldRelationExperimentStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "artifactHash",
    });
    this.worldRelationExperimentInputStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "inputRevisionId",
    });
    this.worldRelationExperimentCorpusStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "snapshotIdentity",
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
    this.officialSourceDiscoveryJobStorage = Object.freeze({
      mode: inMemory ? "MEMORY" : "SQLITE_WAL",
      durable: !inMemory,
      schemaVersion: SCHEMA_VERSION,
      idempotencyKey: "jobId",
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
    const catalogContractTextEvidenceTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'catalog_contract_text_evidence'`,
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
    const officialSourceDiscoveryJobTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'official_source_discovery_jobs'`,
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
    const catalogRuleEvidenceClaimRecordTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'catalog_rule_evidence_claim_records'`,
      )
      .get() !== undefined;
    const contractSemanticContinuityTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'contract_semantic_continuities'`,
      )
      .get() !== undefined;
    const agentRuntimeDefinitionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'agent_runtime_definitions'`,
      )
      .get() !== undefined;
    const agentRunArtifactTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'agent_run_artifacts'`,
      )
      .get() !== undefined;
    const agentRunAnnotationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'agent_run_annotations'`,
      )
      .get() !== undefined;
    const executionCapabilityObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'execution_capability_observations'`,
      )
      .get() !== undefined;
    const marketOntologyAgentProposalTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'market_ontology_agent_proposals'`,
      )
      .get() !== undefined;
    const worldStateMechanismProposalTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_proposals'`,
      )
      .get() !== undefined;
    const worldStateMechanismCounterexampleTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_counterexamples'`,
      )
      .get() !== undefined;
    const worldStateMechanismAbstentionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_abstentions'`,
      )
      .get() !== undefined;
    const worldStateMechanismSubjectReviewTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_subject_reviews'`,
      )
      .get() !== undefined;
    const worldStateSubjectBindingResearchInputTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_subject_binding_research_inputs'`,
      )
      .get() !== undefined;
    const worldStateSubjectBindingAssessmentTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_subject_binding_assessments'`,
      )
      .get() !== undefined;
    const worldStateSubjectBindingAbstentionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_subject_binding_abstentions'`,
      )
      .get() !== undefined;
    const worldStateMechanismPrototypeInputTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_prototype_inputs'`,
      )
      .get() !== undefined;
    const worldStateMechanismPrototypeProposalTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_prototypes'`,
      )
      .get() !== undefined;
    const worldStateMechanismPrototypeAbstentionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_prototype_abstentions'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationInputTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'mechanism_prototype_exploration_inputs'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationTrailheadTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'mechanism_prototype_exploration_trailheads'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationExhaustionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'mechanism_prototype_exploration_exhaustions'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationRoleSearchObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND
           name = 'mechanism_prototype_exploration_role_search_observations'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationFlatSearchObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND
           name = 'mechanism_prototype_exploration_flat_search_observations'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationActionObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND
           name = 'mechanism_prototype_exploration_action_observations'`,
      )
      .get() !== undefined;
    const mechanismPrototypeExplorationStepObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND
           name = 'mechanism_prototype_exploration_step_observations'`,
      )
      .get() !== undefined;
    const worldStateMechanismObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_observations'`,
      )
      .get() !== undefined;
    const worldStateMechanismWakeTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_state_mechanism_wakes'`,
      )
      .get() !== undefined;
    const ontologySearchIssueRevisionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'ontology_search_issue_revisions'`,
      )
      .get() !== undefined;
    const relationDiscoveryTaskRevisionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'relation_discovery_task_revisions'`,
      )
      .get() !== undefined;
    const relationDiscoveryCorpusTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'relation_discovery_corpora'`,
      )
      .get() !== undefined;
    const relationDiscoveryFindingTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'relation_discovery_findings'`,
      )
      .get() !== undefined;
    const standingOntologyRouteObservationEpisodeTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'standing_ontology_route_observation_episodes'`,
      )
      .get() !== undefined;
    const researchDecisionEpisodeTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'research_decision_episodes'`,
      )
      .get() !== undefined;
    const discoverySignalTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'discovery_signals'`,
      )
      .get() !== undefined;
    const researchDecisionOutcomeObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'research_decision_outcome_observations'`,
      )
      .get() !== undefined;
    const researchDecisionOutcomeObservationBoundaryExists =
      researchDecisionOutcomeObservationTableExists &&
      this.#database.prepare(
        "PRAGMA table_info(research_decision_outcome_observations)",
      ).all().some((row) => (row as { name?: unknown }).name === "boundary_episode_id");
    const researchDecisionOutcomeObservationYieldVectorCurrent =
      researchDecisionOutcomeObservationBoundaryExists &&
      this.#database.prepare(
        `SELECT observation_id
         FROM research_decision_outcome_observations
         WHERE json_type(record_json, '$.outcome.yieldDelta.newRunCount') IS NULL
         LIMIT 1`,
      ).get() === undefined;
    const studioProjectionSnapshotTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'studio_projection_snapshot'`,
      )
      .get() !== undefined;
    const worldPredicateArtifactTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_predicate_artifacts'`,
      )
      .get() !== undefined;
    const settlementProjectionTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'settlement_projections'`,
      )
      .get() !== undefined;
    const settlementProjectionObservationTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'settlement_projection_observations'`,
      )
      .get() !== undefined;
    const worldRelationExperimentTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_relation_experiments'`,
      )
      .get() !== undefined;
    const worldRelationExperimentInputTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_relation_experiment_inputs'`,
      )
      .get() !== undefined;
    const worldRelationExperimentCorpusTableExists = this.#database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'world_relation_experiment_corpora'`,
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
      officialSourceDiscoveryJobTableExists &&
      evidenceAcquisitionJobTableExists && evidenceDocumentTableExists &&
      evidenceDocumentTextTableExists && evidenceDocumentObservationTableExists &&
      ruleEvidenceClaimJobTableExists && ruleEvidenceClaimRecordTableExists
      && catalogRuleEvidenceClaimRecordTableExists
      && contractSemanticContinuityTableExists
      && premiseAnalysisRecordTableExists
      && premiseAnalysisJobTableExists
      && premiseAnalysisNotificationTableExists
      && premiseEvidenceRoutingJobTableExists
      && premiseRouteExpansionJobTableExists
      && agentRuntimeDefinitionTableExists
      && agentRunArtifactTableExists
      && agentRunAnnotationTableExists
      && executionCapabilityObservationTableExists
      && marketOntologyAgentProposalTableExists
      && worldStateMechanismProposalTableExists
      && worldStateMechanismCounterexampleTableExists
      && worldStateMechanismAbstentionTableExists
      && worldStateMechanismSubjectReviewTableExists
      && worldStateSubjectBindingResearchInputTableExists
      && worldStateSubjectBindingAssessmentTableExists
      && worldStateSubjectBindingAbstentionTableExists
      && worldStateMechanismPrototypeInputTableExists
      && worldStateMechanismPrototypeProposalTableExists
      && worldStateMechanismPrototypeAbstentionTableExists
      && mechanismPrototypeExplorationInputTableExists
      && mechanismPrototypeExplorationTrailheadTableExists
      && mechanismPrototypeExplorationExhaustionTableExists
      && mechanismPrototypeExplorationRoleSearchObservationTableExists
      && mechanismPrototypeExplorationFlatSearchObservationTableExists
      && mechanismPrototypeExplorationActionObservationTableExists
      && mechanismPrototypeExplorationStepObservationTableExists
      && worldStateMechanismObservationTableExists
      && worldStateMechanismWakeTableExists
      && ontologySearchIssueRevisionTableExists
      && relationDiscoveryTaskRevisionTableExists
      && relationDiscoveryCorpusTableExists
      && relationDiscoveryFindingTableExists
      && standingOntologyRouteObservationEpisodeTableExists
      && researchDecisionEpisodeTableExists
      && discoverySignalTableExists
      && researchDecisionOutcomeObservationTableExists
      && researchDecisionOutcomeObservationBoundaryExists
      && researchDecisionOutcomeObservationYieldVectorCurrent
      && studioProjectionSnapshotTableExists
      && worldPredicateArtifactTableExists
      && settlementProjectionTableExists
      && settlementProjectionObservationTableExists
      && worldRelationExperimentTableExists
      && worldRelationExperimentInputTableExists
      && worldRelationExperimentCorpusTableExists
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
      if (
        current >= 24 && current < 33 && probabilityEstimationRunTableExists &&
        probabilityEstimationJobTableExists
      ) {
        this.#database.exec(`
          DROP INDEX IF EXISTS probability_estimation_runs_scope;
          ALTER TABLE probability_estimation_runs RENAME TO probability_estimation_runs_v32;
          CREATE TABLE probability_estimation_runs (
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
              status IN ('RUNNING', 'PASS', 'ABSTAINED', 'CHALLENGED', 'FAILED')
            ),
            started_at TEXT NOT NULL CHECK (length(started_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          INSERT INTO probability_estimation_runs
            SELECT * FROM probability_estimation_runs_v32;
          DROP TABLE probability_estimation_runs_v32;
          CREATE INDEX probability_estimation_runs_scope
            ON probability_estimation_runs (
              semantic_review_artifact_hash,
              semantic_constraint_artifact_hash,
              started_at DESC,
              run_id DESC
            );

          DROP INDEX IF EXISTS probability_estimation_jobs_due;
          ALTER TABLE probability_estimation_jobs RENAME TO probability_estimation_jobs_v32;
          CREATE TABLE probability_estimation_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (
              status IN (
                'PENDING', 'LEASED', 'RETRY_WAIT', 'BLOCKED_EVIDENCE',
                'PASS', 'ABSTAINED', 'CHALLENGED', 'EXHAUSTED'
              )
            ),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          INSERT INTO probability_estimation_jobs
            SELECT * FROM probability_estimation_jobs_v32;
          DROP TABLE probability_estimation_jobs_v32;
          CREATE INDEX probability_estimation_jobs_due
            ON probability_estimation_jobs (status, next_attempt_at, job_id);
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
              status IN ('RUNNING', 'PASS', 'ABSTAINED', 'CHALLENGED', 'FAILED')
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
                'PASS', 'ABSTAINED', 'CHALLENGED', 'EXHAUSTED'
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
      if (current < 34 || !officialSourceDiscoveryJobTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS official_source_discovery_jobs (
            job_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(job_id) = 71 AND job_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN (
              'PENDING', 'LEASED', 'RETRY_WAIT', 'ADMITTED',
              'NO_OFFICIAL_SOURCE_FOUND', 'ABSTAINED', 'EXHAUSTED'
            )),
            priority_tier TEXT NOT NULL CHECK (priority_tier IN (
              'POSITIVE_GROSS_BLOCKER', 'EVIDENCE_ESCALATION',
              'ACTIVE_TRIAGE_DEBT', 'RETAINED_RESEARCH_DEBT'
            )),
            next_attempt_at TEXT NOT NULL CHECK (length(next_attempt_at) > 0),
            updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS official_source_discovery_jobs_due
            ON official_source_discovery_jobs (
              status, priority_tier, next_attempt_at, job_id
          );
        `);
      }
      if (current < 35 || !agentRuntimeDefinitionTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS agent_runtime_definitions (
            runtime_definition_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(runtime_definition_id) = 71 AND
              runtime_definition_id GLOB 'sha256:[0-9a-f]*'
            ),
            runtime_kind TEXT NOT NULL CHECK (
              runtime_kind IN ('PI', 'CODEX', 'HARNESS_IN_PROCESS')
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;

          CREATE TABLE IF NOT EXISTS credential_bindings (
            credential_binding_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(credential_binding_id) = 71 AND
              credential_binding_id GLOB 'sha256:[0-9a-f]*'
            ),
            credential_kind TEXT NOT NULL CHECK (
              credential_kind IN ('CODEX_OAUTH', 'DEEPSEEK_API_KEY')
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;

          CREATE TABLE IF NOT EXISTS model_profiles (
            model_profile_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(model_profile_id) = 71 AND model_profile_id GLOB 'sha256:[0-9a-f]*'
            ),
            profile_key TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            access_driver TEXT NOT NULL CHECK (
              access_driver IN ('CODEX_RESPONSES', 'DEEPSEEK_OPENAI_COMPATIBLE')
            ),
            model TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (profile_key, revision)
          ) STRICT;

          CREATE TABLE IF NOT EXISTS execution_profiles (
            execution_profile_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(execution_profile_id) = 71 AND
              execution_profile_id GLOB 'sha256:[0-9a-f]*'
            ),
            profile_key TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            runtime_definition_id TEXT NOT NULL,
            credential_binding_id TEXT NOT NULL,
            model_profile_id TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (profile_key, revision),
            FOREIGN KEY (runtime_definition_id)
              REFERENCES agent_runtime_definitions(runtime_definition_id),
            FOREIGN KEY (credential_binding_id)
              REFERENCES credential_bindings(credential_binding_id),
            FOREIGN KEY (model_profile_id) REFERENCES model_profiles(model_profile_id)
          ) STRICT;

          CREATE TABLE IF NOT EXISTS workload_routes (
            workload_route_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(workload_route_id) = 71 AND workload_route_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_key TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            task_kind TEXT NOT NULL,
            execution_profile_id TEXT NOT NULL,
            automatic_dispatch INTEGER NOT NULL CHECK (automatic_dispatch = 0),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (route_key, revision),
            FOREIGN KEY (execution_profile_id)
              REFERENCES execution_profiles(execution_profile_id)
          ) STRICT;

          CREATE TABLE IF NOT EXISTS agent_tasks (
            task_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(task_id) = 71 AND task_id GLOB 'sha256:[0-9a-f]*'
            ),
            task_kind TEXT NOT NULL,
            priority INTEGER NOT NULL CHECK (priority >= 0),
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS agent_tasks_priority
            ON agent_tasks (task_kind, priority DESC, created_at, task_id);

          CREATE TABLE IF NOT EXISTS agent_runs (
            run_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(run_id) = 71 AND run_id GLOB 'sha256:[0-9a-f]*'
            ),
            task_id TEXT NOT NULL,
            execution_profile_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (
              status IN ('PREPARED', 'INTERRUPTED', 'SUCCEEDED', 'FAILED', 'CANCELLED')
            ),
            created_at TEXT NOT NULL,
            completed_at TEXT,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id),
            FOREIGN KEY (execution_profile_id)
              REFERENCES execution_profiles(execution_profile_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS agent_runs_task
            ON agent_runs (task_id, created_at, run_id);
          CREATE INDEX IF NOT EXISTS agent_runs_status
            ON agent_runs (status, created_at, run_id);

          CREATE TABLE IF NOT EXISTS model_invocations (
            invocation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(invocation_id) = 71 AND invocation_id GLOB 'sha256:[0-9a-f]*'
            ),
            run_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL CHECK (ordinal > 0),
            model_profile_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (
              status IN ('SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED')
            ),
            started_at TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (run_id, ordinal),
            FOREIGN KEY (run_id) REFERENCES agent_runs(run_id),
            FOREIGN KEY (model_profile_id) REFERENCES model_profiles(model_profile_id)
          ) STRICT;

          CREATE TABLE IF NOT EXISTS agent_tool_effects (
            effect_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(effect_id) = 71 AND effect_id GLOB 'sha256:[0-9a-f]*'
            ),
            run_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL CHECK (ordinal > 0),
            status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
            occurred_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (run_id, ordinal),
            FOREIGN KEY (run_id) REFERENCES agent_runs(run_id)
          ) STRICT;

          CREATE TABLE IF NOT EXISTS agent_campaigns (
            campaign_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(campaign_id) = 71 AND campaign_id GLOB 'sha256:[0-9a-f]*'
            ),
            campaign_key TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            execution_profile_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PAUSED', 'ACTIVE')),
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (campaign_key, revision),
            FOREIGN KEY (execution_profile_id)
              REFERENCES execution_profiles(execution_profile_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS agent_campaigns_status
            ON agent_campaigns (status, created_at, campaign_id);

          CREATE TABLE IF NOT EXISTS agent_campaign_memberships (
            campaign_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            PRIMARY KEY (campaign_id, task_id),
            FOREIGN KEY (campaign_id) REFERENCES agent_campaigns(campaign_id),
            FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id)
          ) STRICT;

          CREATE TABLE IF NOT EXISTS result_selections (
            selection_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(selection_id) = 71 AND selection_id GLOB 'sha256:[0-9a-f]*'
            ),
            task_id TEXT NOT NULL,
            run_id TEXT NOT NULL,
            selected_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id),
            FOREIGN KEY (run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS result_selections_task
            ON result_selections (task_id, selected_at DESC, selection_id DESC);
        `);
      }
      if (current < 36 || !agentRunArtifactTableExists || !agentRunAnnotationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS agent_run_artifacts (
            artifact_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_id) = 71 AND artifact_id GLOB 'sha256:[0-9a-f]*'
            ),
            run_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL CHECK (ordinal > 0),
            kind TEXT NOT NULL,
            content_hash TEXT NOT NULL CHECK (
              length(content_hash) = 71 AND content_hash GLOB 'sha256:[0-9a-f]*'
            ),
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (run_id, ordinal),
            FOREIGN KEY (run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS agent_run_artifacts_content
            ON agent_run_artifacts (content_hash, created_at, artifact_id);

          CREATE TABLE IF NOT EXISTS agent_run_annotations (
            annotation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(annotation_id) = 71 AND annotation_id GLOB 'sha256:[0-9a-f]*'
            ),
            run_id TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS agent_run_annotations_run
            ON agent_run_annotations (run_id, created_at, annotation_id);
          CREATE INDEX IF NOT EXISTS agent_run_annotations_category
            ON agent_run_annotations (category, created_at, annotation_id);
        `);
      }
      if (current < 37 || !executionCapabilityObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS execution_capability_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            execution_profile_id TEXT NOT NULL,
            outcome TEXT NOT NULL CHECK (outcome IN (
              'USABLE', 'AUTH_REJECTED', 'TRANSIENT_FAILURE',
              'UNSUPPORTED_PROBE', 'CONFIGURATION_MISSING'
            )),
            observed_at TEXT NOT NULL,
            valid_until TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (execution_profile_id)
              REFERENCES execution_profiles(execution_profile_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS execution_capability_profile_time
            ON execution_capability_observations (
              execution_profile_id, observed_at DESC, observation_id DESC
            );
        `);
      }
      if (current < 38 || !marketOntologyAgentProposalTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS market_ontology_agent_proposals (
            proposal_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(proposal_id) = 71 AND proposal_id GLOB 'sha256:[0-9a-f]*'
            ),
            ontology_identity TEXT NOT NULL CHECK (
              length(ontology_identity) = 71 AND ontology_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_snapshot_identity TEXT NOT NULL CHECK (
              length(source_snapshot_identity) = 71 AND
              source_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_agent_run_id TEXT NOT NULL,
            proposal_kind TEXT NOT NULL CHECK (
              proposal_kind IN ('ENTITY_ALIAS', 'WORLD_PROPOSITION', 'COUNTEREXAMPLE')
            ),
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS market_ontology_agent_proposals_ontology
            ON market_ontology_agent_proposals (
              ontology_identity, proposed_at DESC, proposal_id DESC
            );
          CREATE INDEX IF NOT EXISTS market_ontology_agent_proposals_run
            ON market_ontology_agent_proposals (
              source_agent_run_id, proposed_at, proposal_id
            );
        `);
      }
      if (current < 39 || !ontologySearchIssueRevisionTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS ontology_search_issue_revisions (
            revision_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(revision_id) = 71 AND revision_id GLOB 'sha256:[0-9a-f]*'
            ),
            issue_id TEXT NOT NULL CHECK (
              length(issue_id) = 71 AND issue_id GLOB 'sha256:[0-9a-f]*'
            ),
            relation_pattern_id TEXT NOT NULL CHECK (
              length(relation_pattern_id) = 71 AND
              relation_pattern_id GLOB 'sha256:[0-9a-f]*'
            ),
            ontology_identity TEXT NOT NULL CHECK (
              length(ontology_identity) = 71 AND ontology_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_snapshot_identity TEXT NOT NULL CHECK (
              length(source_snapshot_identity) = 71 AND
              source_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            task_id TEXT NOT NULL,
            materialized_at TEXT NOT NULL,
            campaign_eligible INTEGER NOT NULL CHECK (campaign_eligible IN (0, 1)),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS ontology_search_issue_revisions_issue
            ON ontology_search_issue_revisions (
              issue_id, materialized_at DESC, revision_id DESC
            );
          CREATE INDEX IF NOT EXISTS ontology_search_issue_revisions_campaign
            ON ontology_search_issue_revisions (
              campaign_eligible, materialized_at DESC, revision_id DESC
            );
        `);
      }
      if (current < 50 || !worldStateMechanismProposalTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_proposals (
            proposal_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(proposal_id) = 71 AND proposal_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_family_id TEXT NOT NULL CHECK (
              length(route_family_id) = 71 AND route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            ontology_identity TEXT NOT NULL CHECK (
              length(ontology_identity) = 71 AND ontology_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_snapshot_identity TEXT NOT NULL CHECK (
              length(source_snapshot_identity) = 71 AND
              source_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_issue_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_issue_revision_id)
              REFERENCES ontology_search_issue_revisions(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_proposals_family
            ON world_state_mechanism_proposals (
              route_family_id, proposed_at DESC, proposal_id DESC
            );
          CREATE INDEX IF NOT EXISTS world_state_mechanism_proposals_run
            ON world_state_mechanism_proposals (
              source_agent_run_id, proposed_at, proposal_id
            );
        `);
      }
      if (current < 50 || !worldStateMechanismCounterexampleTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_counterexamples (
            counterexample_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(counterexample_id) = 71 AND
              counterexample_id GLOB 'sha256:[0-9a-f]*'
            ),
            target_route_family_id TEXT NOT NULL CHECK (
              length(target_route_family_id) = 71 AND
              target_route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            ontology_identity TEXT NOT NULL CHECK (
              length(ontology_identity) = 71 AND ontology_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_snapshot_identity TEXT NOT NULL CHECK (
              length(source_snapshot_identity) = 71 AND
              source_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_issue_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_issue_revision_id)
              REFERENCES ontology_search_issue_revisions(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_counterexamples_family
            ON world_state_mechanism_counterexamples (
              target_route_family_id, proposed_at DESC, counterexample_id DESC
            );
          CREATE INDEX IF NOT EXISTS world_state_mechanism_counterexamples_run
            ON world_state_mechanism_counterexamples (
              source_agent_run_id, proposed_at, counterexample_id
            );
        `);
      }
      if (current < 52 || !worldStateMechanismAbstentionTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_abstentions (
            abstention_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(abstention_id) = 71 AND abstention_id GLOB 'sha256:[0-9a-f]*'
            ),
            ontology_identity TEXT NOT NULL CHECK (
              length(ontology_identity) = 71 AND ontology_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_snapshot_identity TEXT NOT NULL CHECK (
              length(source_snapshot_identity) = 71 AND
              source_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_issue_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_issue_revision_id)
              REFERENCES ontology_search_issue_revisions(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_abstentions_revision
            ON world_state_mechanism_abstentions (
              source_issue_revision_id, proposed_at DESC, abstention_id DESC
            );
          CREATE INDEX IF NOT EXISTS world_state_mechanism_abstentions_run
            ON world_state_mechanism_abstentions (
              source_agent_run_id, proposed_at, abstention_id
            );
        `);
      }
      if (current < 51 || !worldStateMechanismSubjectReviewTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_subject_reviews (
            review_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(review_id) = 71 AND review_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_family_id TEXT NOT NULL CHECK (
              length(route_family_id) = 71 AND route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            decision TEXT NOT NULL CHECK (
              decision IN ('APPROVED', 'REJECTED', 'NEEDS_EVIDENCE')
            ),
            reviewed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_subject_reviews_family
            ON world_state_mechanism_subject_reviews (
              route_family_id, reviewed_at DESC, review_id DESC
            );
        `);
      }
      if (current < 53 || !worldStateSubjectBindingResearchInputTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_subject_binding_research_inputs (
            revision_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(revision_id) = 71 AND revision_id GLOB 'sha256:[0-9a-f]*'
            ),
            case_id TEXT NOT NULL CHECK (
              length(case_id) = 71 AND case_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_family_id TEXT NOT NULL CHECK (
              length(route_family_id) = 71 AND route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            materialized_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_subject_binding_inputs_case
            ON world_state_subject_binding_research_inputs (
              case_id, materialized_at DESC, revision_id DESC
            );
        `);
      }
      if (current < 53 || !worldStateSubjectBindingAssessmentTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_subject_binding_assessments (
            assessment_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(assessment_id) = 71 AND assessment_id GLOB 'sha256:[0-9a-f]*'
            ),
            case_id TEXT NOT NULL CHECK (
              length(case_id) = 71 AND case_id GLOB 'sha256:[0-9a-f]*'
            ),
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            recommendation TEXT NOT NULL CHECK (recommendation IN ('APPROVE', 'REJECT')),
            assessed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES world_state_subject_binding_research_inputs(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_subject_binding_assessments_case
            ON world_state_subject_binding_assessments (
              case_id, assessed_at DESC, assessment_id DESC
            );
        `);
      }
      if (current < 53 || !worldStateSubjectBindingAbstentionTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_subject_binding_abstentions (
            abstention_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(abstention_id) = 71 AND abstention_id GLOB 'sha256:[0-9a-f]*'
            ),
            case_id TEXT NOT NULL CHECK (
              length(case_id) = 71 AND case_id GLOB 'sha256:[0-9a-f]*'
            ),
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            assessed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES world_state_subject_binding_research_inputs(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_subject_binding_abstentions_case
            ON world_state_subject_binding_abstentions (
              case_id, assessed_at DESC, abstention_id DESC
            );
        `);
      }
      if (current < 54 || !worldStateMechanismPrototypeInputTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_prototype_inputs (
            revision_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(revision_id) = 71 AND revision_id GLOB 'sha256:[0-9a-f]*'
            ),
            candidate_id TEXT NOT NULL CHECK (
              length(candidate_id) = 71 AND candidate_id GLOB 'sha256:[0-9a-f]*'
            ),
            materialized_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_prototype_inputs_candidate
            ON world_state_mechanism_prototype_inputs (
              candidate_id, materialized_at DESC, revision_id DESC
            );
        `);
      }
      if (current < 54 || !worldStateMechanismPrototypeProposalTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_prototypes (
            prototype_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(prototype_id) = 71 AND prototype_id GLOB 'sha256:[0-9a-f]*'
            ),
            candidate_id TEXT NOT NULL CHECK (
              length(candidate_id) = 71 AND candidate_id GLOB 'sha256:[0-9a-f]*'
            ),
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES world_state_mechanism_prototype_inputs(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_prototypes_candidate
            ON world_state_mechanism_prototypes (
              candidate_id, proposed_at DESC, prototype_id DESC
            );
        `);
      }
      if (current < 54 || !worldStateMechanismPrototypeAbstentionTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_prototype_abstentions (
            abstention_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(abstention_id) = 71 AND abstention_id GLOB 'sha256:[0-9a-f]*'
            ),
            candidate_id TEXT NOT NULL CHECK (
              length(candidate_id) = 71 AND candidate_id GLOB 'sha256:[0-9a-f]*'
            ),
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES world_state_mechanism_prototype_inputs(revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_prototype_abstentions_candidate
            ON world_state_mechanism_prototype_abstentions (
              candidate_id, proposed_at DESC, abstention_id DESC
            );
        `);
      }
      if (current < 55 || !mechanismPrototypeExplorationInputTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_inputs (
            input_revision_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(input_revision_id) = 71 AND input_revision_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL CHECK (
              length(lens_id) = 71 AND lens_id GLOB 'sha256:[0-9a-f]*'
            ),
            prototype_id TEXT NOT NULL,
            semantic_input_identity TEXT NOT NULL,
            corpus_snapshot_identity TEXT NOT NULL,
            materialized_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (prototype_id)
              REFERENCES world_state_mechanism_prototypes(prototype_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_inputs_lens
            ON mechanism_prototype_exploration_inputs (
              lens_id, materialized_at DESC, input_revision_id DESC
            );
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_inputs_semantic
            ON mechanism_prototype_exploration_inputs (
              lens_id, semantic_input_identity, input_revision_id
            );
        `);
      }
      if (current < 55 || !mechanismPrototypeExplorationTrailheadTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_trailheads (
            trailhead_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(trailhead_id) = 71 AND trailhead_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL,
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES mechanism_prototype_exploration_inputs(input_revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_trailheads_lens
            ON mechanism_prototype_exploration_trailheads (
              lens_id, proposed_at DESC, trailhead_id DESC
            );
        `);
      }
      if (current < 55 || !mechanismPrototypeExplorationExhaustionTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_exhaustions (
            exhaustion_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(exhaustion_id) = 71 AND exhaustion_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL,
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES mechanism_prototype_exploration_inputs(input_revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_exhaustions_lens
            ON mechanism_prototype_exploration_exhaustions (
              lens_id, proposed_at DESC, exhaustion_id DESC
            );
        `);
      }
      if (current < 56 || !mechanismPrototypeExplorationRoleSearchObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_role_search_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL,
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES mechanism_prototype_exploration_inputs(input_revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_role_search_lens
            ON mechanism_prototype_exploration_role_search_observations (
              lens_id, captured_at DESC, observation_id DESC
            );
          CREATE UNIQUE INDEX IF NOT EXISTS mechanism_prototype_exploration_role_search_call
            ON mechanism_prototype_exploration_role_search_observations (
              source_agent_run_id, json_extract(record_json, '$.sourceToolCallId')
            );
        `);
      }
      if (current < 57 || !mechanismPrototypeExplorationActionObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_action_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL,
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES mechanism_prototype_exploration_inputs(input_revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_action_lens
            ON mechanism_prototype_exploration_action_observations (
              lens_id, captured_at DESC, observation_id DESC
            );
          CREATE UNIQUE INDEX IF NOT EXISTS mechanism_prototype_exploration_action_call
            ON mechanism_prototype_exploration_action_observations (
              source_agent_run_id, json_extract(record_json, '$.sourceToolCallId')
            );
        `);
      }
      if (current < 59 || !mechanismPrototypeExplorationFlatSearchObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_flat_search_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL,
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (input_revision_id)
              REFERENCES mechanism_prototype_exploration_inputs(input_revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_flat_search_lens
            ON mechanism_prototype_exploration_flat_search_observations (
              lens_id, captured_at DESC, observation_id DESC
            );
          CREATE UNIQUE INDEX IF NOT EXISTS mechanism_prototype_exploration_flat_search_call
            ON mechanism_prototype_exploration_flat_search_observations (
              source_agent_run_id, json_extract(record_json, '$.sourceToolCallId')
            );
        `);
      }
      if (current < 58 || !mechanismPrototypeExplorationStepObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS mechanism_prototype_exploration_step_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            lens_id TEXT NOT NULL,
            input_revision_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            source_invocation_id TEXT NOT NULL,
            source_effect_id TEXT NOT NULL UNIQUE,
            effect_ordinal INTEGER NOT NULL CHECK (effect_ordinal > 0),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            UNIQUE (source_agent_run_id, effect_ordinal),
            FOREIGN KEY (input_revision_id)
              REFERENCES mechanism_prototype_exploration_inputs(input_revision_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id),
            FOREIGN KEY (source_invocation_id) REFERENCES model_invocations(invocation_id),
            FOREIGN KEY (source_effect_id) REFERENCES agent_tool_effects(effect_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS mechanism_prototype_exploration_step_lens
            ON mechanism_prototype_exploration_step_observations (
              lens_id, observed_at DESC, observation_id DESC
            );
        `);
      }
      if (current < 51 || !worldStateMechanismObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_family_id TEXT NOT NULL CHECK (
              length(route_family_id) = 71 AND route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            membership_identity TEXT NOT NULL CHECK (
              length(membership_identity) = 71 AND
              membership_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_snapshot_identity TEXT NOT NULL CHECK (
              length(source_snapshot_identity) = 71 AND
              source_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            subject_binding_review_id TEXT,
            status TEXT NOT NULL CHECK (status IN (
              'OBSERVED', 'BLOCKED_SUBJECT_BINDING',
              'BROAD_ROLE_MEMBERSHIP', 'NO_TIME_COMPATIBLE_PAIR'
            )),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (subject_binding_review_id)
              REFERENCES world_state_mechanism_subject_reviews(review_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_state_mechanism_observations_family_time
            ON world_state_mechanism_observations (
              route_family_id, observed_at DESC, observation_id DESC
            );
          CREATE INDEX IF NOT EXISTS world_state_mechanism_observations_snapshot
            ON world_state_mechanism_observations (
              source_snapshot_identity, observation_id
            );
        `);
      }
      if (current < 51 || !worldStateMechanismWakeTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_state_mechanism_wakes (
            wake_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(wake_id) = 71 AND wake_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_family_id TEXT NOT NULL CHECK (
              length(route_family_id) = 71 AND route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            previous_observation_id TEXT NOT NULL,
            current_observation_id TEXT NOT NULL,
            work_item_id TEXT NOT NULL CHECK (
              length(work_item_id) = 71 AND work_item_id GLOB 'sha256:[0-9a-f]*'
            ),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (previous_observation_id)
              REFERENCES world_state_mechanism_observations(observation_id),
            FOREIGN KEY (current_observation_id)
              REFERENCES world_state_mechanism_observations(observation_id)
          ) STRICT;
          CREATE UNIQUE INDEX IF NOT EXISTS world_state_mechanism_wakes_transition
            ON world_state_mechanism_wakes (
              route_family_id, previous_observation_id, current_observation_id
            );
          CREATE INDEX IF NOT EXISTS world_state_mechanism_wakes_work
            ON world_state_mechanism_wakes (work_item_id, observed_at DESC);
        `);
      }
      if (current < 40 || !relationDiscoveryCorpusTableExists ||
          !relationDiscoveryTaskRevisionTableExists ||
          !relationDiscoveryFindingTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS relation_discovery_corpora (
            snapshot_identity TEXT PRIMARY KEY NOT NULL CHECK (
              length(snapshot_identity) = 71 AND snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_set_identity TEXT NOT NULL CHECK (
              length(source_set_identity) = 71 AND source_set_identity GLOB 'sha256:[0-9a-f]*'
            ),
            listing_count INTEGER NOT NULL CHECK (listing_count >= 0),
            retained_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS relation_discovery_corpora_retained
            ON relation_discovery_corpora (retained_at DESC, snapshot_identity DESC);
          CREATE TABLE IF NOT EXISTS relation_discovery_task_revisions (
            revision_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(revision_id) = 71 AND revision_id GLOB 'sha256:[0-9a-f]*'
            ),
            work_item_id TEXT NOT NULL CHECK (
              length(work_item_id) = 71 AND work_item_id GLOB 'sha256:[0-9a-f]*'
            ),
            work_artifact_hash TEXT NOT NULL CHECK (
              length(work_artifact_hash) = 71 AND work_artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            source_corpus_snapshot_identity TEXT NOT NULL CHECK (
              length(source_corpus_snapshot_identity) = 71 AND
              source_corpus_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            task_id TEXT NOT NULL,
            materialized_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id),
            FOREIGN KEY (source_corpus_snapshot_identity)
              REFERENCES relation_discovery_corpora(snapshot_identity)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS relation_discovery_task_revisions_work
            ON relation_discovery_task_revisions (
              work_item_id, materialized_at DESC, revision_id DESC
            );
          CREATE INDEX IF NOT EXISTS relation_discovery_task_revisions_task
            ON relation_discovery_task_revisions (task_id, revision_id);
          CREATE TABLE IF NOT EXISTS relation_discovery_findings (
            finding_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(finding_id) = 71 AND finding_id GLOB 'sha256:[0-9a-f]*'
            ),
            work_item_id TEXT NOT NULL CHECK (
              length(work_item_id) = 71 AND work_item_id GLOB 'sha256:[0-9a-f]*'
            ),
            source_task_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            source_corpus_snapshot_identity TEXT NOT NULL CHECK (
              length(source_corpus_snapshot_identity) = 71 AND
              source_corpus_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            finding_kind TEXT NOT NULL CHECK (
              finding_kind IN ('RELATION_HYPOTHESIS', 'COUNTEREXAMPLE', 'ONTOLOGY_ROUTE')
            ),
            recorded_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_task_id) REFERENCES agent_tasks(task_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS relation_discovery_findings_work
            ON relation_discovery_findings (
              work_item_id, recorded_at DESC, finding_id DESC
            );
          CREATE INDEX IF NOT EXISTS relation_discovery_findings_run
            ON relation_discovery_findings (
              source_agent_run_id, recorded_at, finding_id
            );
        `);
      }
      if (current >= 40 && current < 42 && relationDiscoveryFindingTableExists) {
        this.#database.exec(`
          ALTER TABLE relation_discovery_findings
            RENAME TO relation_discovery_findings_v41;
          CREATE TABLE relation_discovery_findings (
            finding_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(finding_id) = 71 AND finding_id GLOB 'sha256:[0-9a-f]*'
            ),
            work_item_id TEXT NOT NULL CHECK (
              length(work_item_id) = 71 AND work_item_id GLOB 'sha256:[0-9a-f]*'
            ),
            source_task_id TEXT NOT NULL,
            source_agent_run_id TEXT NOT NULL,
            source_corpus_snapshot_identity TEXT NOT NULL CHECK (
              length(source_corpus_snapshot_identity) = 71 AND
              source_corpus_snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            finding_kind TEXT NOT NULL CHECK (
              finding_kind IN ('RELATION_HYPOTHESIS', 'COUNTEREXAMPLE', 'ONTOLOGY_ROUTE')
            ),
            recorded_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_task_id) REFERENCES agent_tasks(task_id),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          INSERT INTO relation_discovery_findings (
            finding_id, work_item_id, source_task_id, source_agent_run_id,
            source_corpus_snapshot_identity, finding_kind, recorded_at,
            record_json, record_hash
          ) SELECT
            finding_id, work_item_id, source_task_id, source_agent_run_id,
            source_corpus_snapshot_identity, finding_kind, recorded_at,
            record_json, record_hash
          FROM relation_discovery_findings_v41;
          DROP TABLE relation_discovery_findings_v41;
          CREATE INDEX relation_discovery_findings_work
            ON relation_discovery_findings (
              work_item_id, recorded_at DESC, finding_id DESC
            );
          CREATE INDEX relation_discovery_findings_run
            ON relation_discovery_findings (
              source_agent_run_id, recorded_at, finding_id
            );
        `);
      }
      if (current < 43 || !standingOntologyRouteObservationEpisodeTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS standing_ontology_route_observation_episodes (
            episode_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(episode_id) = 71 AND episode_id GLOB 'sha256:[0-9a-f]*'
            ),
            route_family_id TEXT NOT NULL CHECK (
              length(route_family_id) = 71 AND route_family_id GLOB 'sha256:[0-9a-f]*'
            ),
            family_observation_id TEXT NOT NULL CHECK (
              length(family_observation_id) = 71 AND
              family_observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            previous_episode_id TEXT CHECK (
              previous_episode_id IS NULL OR (
                length(previous_episode_id) = 71 AND
                previous_episode_id GLOB 'sha256:[0-9a-f]*'
              )
            ),
            observed_at TEXT NOT NULL,
            state TEXT NOT NULL CHECK (
              state IN ('QUIESCENT', 'EXPANDED', 'CHANGED', 'CONTRACTED',
                        'BLOCKED_TOO_BROAD')
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS standing_route_episodes_family_time
            ON standing_ontology_route_observation_episodes (
              route_family_id, observed_at DESC, episode_id DESC
            );
          CREATE UNIQUE INDEX IF NOT EXISTS standing_route_episodes_transition
            ON standing_ontology_route_observation_episodes (
              route_family_id, IFNULL(previous_episode_id, '')
            );
        `);
      }
      if (current < 41 || !researchDecisionEpisodeTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS research_decision_episodes (
            episode_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(episode_id) = 71 AND episode_id GLOB 'sha256:[0-9a-f]*'
            ),
            captured_at TEXT NOT NULL,
            work_item_id TEXT,
            allocation_action_id TEXT NOT NULL CHECK (
              length(allocation_action_id) = 71 AND
              allocation_action_id GLOB 'sha256:[0-9a-f]*'
            ),
            target_id TEXT NOT NULL CHECK (
              length(target_id) = 71 AND target_id GLOB 'sha256:[0-9a-f]*'
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS research_decision_episodes_captured
            ON research_decision_episodes (captured_at DESC, episode_id DESC);
          CREATE INDEX IF NOT EXISTS research_decision_episodes_work
            ON research_decision_episodes (
              work_item_id, captured_at DESC, episode_id DESC
            );
        `);
      }
      if (current < 44 || !studioProjectionSnapshotTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS studio_projection_snapshot (
            singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
            projection_view_hash TEXT NOT NULL CHECK (
              length(projection_view_hash) = 71 AND
              projection_view_hash GLOB 'sha256:[0-9a-f]*'
            ),
            materialized_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
        `);
      }
      if (current < 45 || !catalogContractTextEvidenceTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS catalog_contract_text_evidence (
            artifact_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_id) = 71 AND artifact_id GLOB 'sha256:[0-9a-f]*'
            ),
            catalog_observation_id TEXT NOT NULL CHECK (
              length(catalog_observation_id) = 84 AND
              catalog_observation_id GLOB 'catalog-observation:[0-9a-f]*'
            ),
            listing_ref TEXT NOT NULL,
            source_raw_hash TEXT NOT NULL CHECK (
              length(source_raw_hash) = 71 AND source_raw_hash GLOB 'sha256:[0-9a-f]*'
            ),
            received_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (catalog_observation_id)
              REFERENCES catalog_observations(observation_id) ON DELETE RESTRICT
          ) STRICT;
          CREATE INDEX IF NOT EXISTS catalog_contract_text_evidence_listing
            ON catalog_contract_text_evidence (
              listing_ref, received_at DESC, artifact_id DESC
            );
        `);
      }
      if (current < 46 || !catalogRuleEvidenceClaimRecordTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS catalog_rule_evidence_claim_records (
            interpretation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(interpretation_id) = 71 AND
              interpretation_id GLOB 'sha256:[0-9a-f]*'
            ),
            requirement_id TEXT NOT NULL CHECK (
              length(requirement_id) = 71 AND
              requirement_id GLOB 'sha256:[0-9a-f]*'
            ),
            source_artifact_id TEXT NOT NULL CHECK (
              length(source_artifact_id) = 71 AND
              source_artifact_id GLOB 'sha256:[0-9a-f]*'
            ),
            text_artifact_id TEXT NOT NULL CHECK (
              length(text_artifact_id) = 71 AND
              text_artifact_id GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('PASS', 'FAILED')),
            completed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (source_artifact_id)
              REFERENCES catalog_contract_text_evidence(artifact_id)
              ON DELETE RESTRICT
          ) STRICT;
          CREATE INDEX IF NOT EXISTS catalog_rule_evidence_claim_requirement
            ON catalog_rule_evidence_claim_records (
              requirement_id, completed_at DESC, interpretation_id DESC
            );
        `);
      }
      if (current < 47 || !contractSemanticContinuityTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS contract_semantic_continuities (
            continuity_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(continuity_id) = 71 AND continuity_id GLOB 'sha256:[0-9a-f]*'
            ),
            listing_ref TEXT NOT NULL,
            prior_semantic_source_artifact_id TEXT NOT NULL CHECK (
              length(prior_semantic_source_artifact_id) = 71 AND
              prior_semantic_source_artifact_id GLOB 'sha256:[0-9a-f]*'
            ),
            current_catalog_text_artifact_id TEXT NOT NULL CHECK (
              length(current_catalog_text_artifact_id) = 71 AND
              current_catalog_text_artifact_id GLOB 'sha256:[0-9a-f]*'
            ),
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (current_catalog_text_artifact_id)
              REFERENCES catalog_contract_text_evidence(artifact_id)
              ON DELETE RESTRICT
          ) STRICT;
          CREATE INDEX IF NOT EXISTS contract_semantic_continuities_listing
            ON contract_semantic_continuities (listing_ref, continuity_id DESC);
        `);
      }
      if (current < 48 || !discoverySignalTableExists) {
        // Pre-alpha decision episodes without a first-party novelty premise are
        // intentionally retired instead of teaching every future reader a
        // permanently ambiguous legacy ontology.
        this.#database.exec(`
          DELETE FROM research_decision_episodes
          WHERE json_extract(record_json, '$.schemaVersion') !=
                'pmh.research-decision-episode.v2';

          CREATE TABLE IF NOT EXISTS discovery_signals (
            signal_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(signal_id) = 71 AND signal_id GLOB 'sha256:[0-9a-f]*'
            ),
            dedupe_identity TEXT NOT NULL UNIQUE CHECK (
              length(dedupe_identity) = 71 AND
              dedupe_identity GLOB 'sha256:[0-9a-f]*'
            ),
            status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READ')),
            kind TEXT NOT NULL CHECK (kind IN (
              'CAMPAIGN_MEMBERSHIP_ADDED', 'STRUCTURED_OUTCOME',
              'REPEATED_COSTLY_NO_MOVEMENT', 'PORTFOLIO_EXHAUSTED'
            )),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE INDEX IF NOT EXISTS discovery_signals_status_time
            ON discovery_signals (status, observed_at DESC, signal_id DESC);
        `);
      }
      if (current < 49 || !researchDecisionOutcomeObservationTableExists ||
          !researchDecisionOutcomeObservationBoundaryExists ||
          !researchDecisionOutcomeObservationYieldVectorCurrent) {
        // Schema 49 was still local-only when the explicit successor boundary
        // and typed retained-run yield became part of the observation identity.
        // Any earlier rows are reproducible projections, so repair the
        // unpublished table instead of teaching the product an ambiguous
        // compatibility state.
        this.#database.exec("DROP TABLE IF EXISTS research_decision_outcome_observations");
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS research_decision_outcome_observations (
            observation_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(observation_id) = 71 AND
              observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            state_identity TEXT NOT NULL CHECK (
              length(state_identity) = 71 AND
              state_identity GLOB 'sha256:[0-9a-f]*'
            ),
            previous_observation_id TEXT CHECK (
              previous_observation_id IS NULL OR (
                length(previous_observation_id) = 71 AND
                previous_observation_id GLOB 'sha256:[0-9a-f]*'
              )
            ),
            boundary_episode_id TEXT CHECK (
              boundary_episode_id IS NULL OR (
                length(boundary_episode_id) = 71 AND
                boundary_episode_id GLOB 'sha256:[0-9a-f]*'
              )
            ),
            episode_id TEXT NOT NULL CHECK (
              length(episode_id) = 71 AND episode_id GLOB 'sha256:[0-9a-f]*'
            ),
            work_item_id TEXT CHECK (
              work_item_id IS NULL OR (
                length(work_item_id) = 71 AND
                work_item_id GLOB 'sha256:[0-9a-f]*'
              )
            ),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (episode_id)
              REFERENCES research_decision_episodes(episode_id) ON DELETE RESTRICT,
            FOREIGN KEY (boundary_episode_id)
              REFERENCES research_decision_episodes(episode_id) ON DELETE RESTRICT,
            FOREIGN KEY (previous_observation_id)
              REFERENCES research_decision_outcome_observations(observation_id)
              ON DELETE RESTRICT
          ) STRICT;
          CREATE INDEX IF NOT EXISTS research_decision_outcomes_episode_time
            ON research_decision_outcome_observations (
              episode_id, observed_at DESC, observation_id DESC
            );
          CREATE INDEX IF NOT EXISTS research_decision_outcomes_work_time
            ON research_decision_outcome_observations (
              work_item_id, observed_at DESC, observation_id DESC
            );
          CREATE UNIQUE INDEX IF NOT EXISTS research_decision_outcomes_transition
            ON research_decision_outcome_observations (
              episode_id, IFNULL(previous_observation_id, '')
            );
        `);
      }
      if (current < 60 || !worldPredicateArtifactTableExists ||
          !settlementProjectionTableExists || !worldRelationExperimentTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_predicate_artifacts (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            predicate_id TEXT NOT NULL CHECK (
              length(predicate_id) = 71 AND predicate_id GLOB 'sha256:[0-9a-f]*'
            ),
            epistemic_posture TEXT NOT NULL CHECK (epistemic_posture IN (
              'SEARCH_HYPOTHESIS_ONLY', 'EVIDENCE_BOUND_PROPOSITION',
              'SETTLEMENT_BOUND_PREDICATE'
            )),
            proposed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (record_hash = artifact_hash)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_predicate_artifacts_predicate
            ON world_predicate_artifacts (
              predicate_id, proposed_at DESC, artifact_hash DESC
            );

          CREATE TABLE IF NOT EXISTS settlement_projections (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            projection_id TEXT NOT NULL CHECK (
              length(projection_id) = 71 AND projection_id GLOB 'sha256:[0-9a-f]*'
            ),
            listing_ref TEXT NOT NULL,
            compiler_admission TEXT NOT NULL CHECK (
              compiler_admission IN ('EXACT_BINARY_ELIGIBLE', 'RESEARCH_ONLY')
            ),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (record_hash = artifact_hash)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS settlement_projections_listing
            ON settlement_projections (
              listing_ref, observed_at DESC, artifact_hash DESC
            );
          CREATE INDEX IF NOT EXISTS settlement_projections_identity
            ON settlement_projections (
              projection_id, observed_at DESC, artifact_hash DESC
            );

          CREATE TABLE IF NOT EXISTS world_relation_experiments (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            experiment_id TEXT NOT NULL CHECK (
              length(experiment_id) = 71 AND experiment_id GLOB 'sha256:[0-9a-f]*'
            ),
            relation_kind TEXT NOT NULL,
            terminal_disposition TEXT NOT NULL CHECK (terminal_disposition IN (
              'SUPPORTED_HARD', 'SUPPORTED_PROBABILISTIC', 'FALSIFIED',
              'EXHAUSTED', 'UNRESOLVED'
            )),
            source_agent_run_id TEXT NOT NULL,
            closed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (record_hash = artifact_hash),
            FOREIGN KEY (source_agent_run_id) REFERENCES agent_runs(run_id)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_relation_experiments_scope
            ON world_relation_experiments (
              experiment_id, closed_at DESC, artifact_hash DESC
            );
          CREATE INDEX IF NOT EXISTS world_relation_experiments_run
            ON world_relation_experiments (
              source_agent_run_id, closed_at, artifact_hash
            );
        `);
      }
      if (current < 61 || !worldRelationExperimentInputTableExists ||
          !worldRelationExperimentCorpusTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS world_relation_experiment_corpora (
            snapshot_identity TEXT PRIMARY KEY NOT NULL CHECK (
              length(snapshot_identity) = 71 AND snapshot_identity GLOB 'sha256:[0-9a-f]*'
            ),
            source_set_identity TEXT NOT NULL CHECK (
              length(source_set_identity) = 71 AND source_set_identity GLOB 'sha256:[0-9a-f]*'
            ),
            listing_count INTEGER NOT NULL CHECK (listing_count >= 0),
            retained_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            )
          ) STRICT;
          CREATE TABLE IF NOT EXISTS world_relation_experiment_inputs (
            input_revision_id TEXT PRIMARY KEY NOT NULL CHECK (
              length(input_revision_id) = 71 AND input_revision_id GLOB 'sha256:[0-9a-f]*'
            ),
            semantic_input_identity TEXT NOT NULL CHECK (
              length(semantic_input_identity) = 71 AND
              semantic_input_identity GLOB 'sha256:[0-9a-f]*'
            ),
            frontier_id TEXT NOT NULL CHECK (
              length(frontier_id) = 71 AND frontier_id GLOB 'sha256:[0-9a-f]*'
            ),
            corpus_snapshot_identity TEXT NOT NULL,
            materialized_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (
              length(record_hash) = 71 AND record_hash GLOB 'sha256:[0-9a-f]*'
            ),
            FOREIGN KEY (corpus_snapshot_identity)
              REFERENCES world_relation_experiment_corpora(snapshot_identity)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS world_relation_experiment_inputs_frontier
            ON world_relation_experiment_inputs (
              frontier_id, materialized_at DESC, input_revision_id DESC
            );
          CREATE INDEX IF NOT EXISTS world_relation_experiment_inputs_semantic
            ON world_relation_experiment_inputs (
              semantic_input_identity, materialized_at DESC, input_revision_id DESC
            );
        `);
      }
      if (current < 62 || !settlementProjectionObservationTableExists) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS settlement_projection_observations (
            artifact_hash TEXT PRIMARY KEY NOT NULL CHECK (
              length(artifact_hash) = 71 AND artifact_hash GLOB 'sha256:[0-9a-f]*'
            ),
            observation_id TEXT NOT NULL CHECK (
              length(observation_id) = 71 AND observation_id GLOB 'sha256:[0-9a-f]*'
            ),
            listing_ref TEXT NOT NULL,
            disposition TEXT NOT NULL CHECK (disposition IN (
              'EXACT_PROJECTED', 'RESEARCH_ONLY_PROJECTED', 'BLOCKED'
            )),
            observed_at TEXT NOT NULL,
            record_json TEXT NOT NULL CHECK (json_valid(record_json)),
            record_hash TEXT NOT NULL CHECK (record_hash = artifact_hash)
          ) STRICT;
          CREATE INDEX IF NOT EXISTS settlement_projection_observations_listing
            ON settlement_projection_observations (
              listing_ref, observed_at DESC, artifact_hash DESC
            );
          CREATE INDEX IF NOT EXISTS settlement_projection_observations_identity
            ON settlement_projection_observations (
              observation_id, observed_at DESC, artifact_hash DESC
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

  #worldStateMechanismRunMatchesRevision(
    runTaskId: string,
    revision: OntologySearchIssueRevision,
  ): boolean {
    if (runTaskId === revision.task.taskId) return true;
    const row = this.#database.prepare(
      "SELECT record_json FROM agent_tasks WHERE task_id = ?",
    ).get(runTaskId) as Readonly<{ record_json?: unknown }> | undefined;
    if (typeof row?.record_json !== "string") return false;
    let decoded: unknown;
    try { decoded = JSON.parse(row.record_json); } catch { return false; }
    const task = assertAgentTask(decoded);
    const mechanismIssueId = worldStateMechanismResearchIssueIdentity(revision);
    return task.kind === "WORLD_STATE_MECHANISM_RESEARCH" &&
      task.protocol === "WORLD_STATE_MECHANISM_RESEARCH_TASK_V1" &&
      task.requestedEffectProtocol === "WORLD_STATE_MECHANISM_RESEARCH_TOOLS_V1" &&
      task.provenanceRef === `world-state-mechanism-issue:${mechanismIssueId}`;
  }

  #worldStateSubjectBindingRunMatchesInput(
    runTaskId: string,
    input: WorldStateSubjectBindingResearchInputRevision,
  ): boolean {
    const row = this.#database.prepare(
      "SELECT record_json FROM agent_tasks WHERE task_id = ?",
    ).get(runTaskId) as Readonly<{ record_json?: unknown }> | undefined;
    if (typeof row?.record_json !== "string") return false;
    let decoded: unknown;
    try { decoded = JSON.parse(row.record_json); } catch { return false; }
    const task = assertAgentTask(decoded);
    return task.kind === "SUBJECT_BINDING_RESEARCH" &&
      task.protocol === "WORLD_STATE_SUBJECT_BINDING_TASK_V1" &&
      task.requestedEffectProtocol === "WORLD_STATE_SUBJECT_BINDING_TOOLS_V1" &&
      task.provenanceRef === `world-state-subject-binding-case:${input.caseId}`;
  }

  #worldStateMechanismPrototypeRunMatchesInput(
    runTaskId: string,
    input: WorldStateMechanismPrototypeInputRevision,
  ): boolean {
    const row = this.#database.prepare(
      "SELECT record_json FROM agent_tasks WHERE task_id = ?",
    ).get(runTaskId) as Readonly<{ record_json?: unknown }> | undefined;
    if (typeof row?.record_json !== "string") return false;
    let decoded: unknown;
    try { decoded = JSON.parse(row.record_json); } catch { return false; }
    const task = assertAgentTask(decoded);
    return task.kind === "MECHANISM_PROTOTYPE_RESEARCH" &&
      task.protocol === "WORLD_STATE_MECHANISM_PROTOTYPE_TASK_V1" &&
      task.requestedEffectProtocol === "WORLD_STATE_MECHANISM_PROTOTYPE_TOOLS_V1" &&
      task.provenanceRef ===
        `world-state-mechanism-prototype-candidate:${input.candidateId}`;
  }

  #mechanismPrototypeExplorationRunMatchesInput(
    runTaskId: string,
    input: MechanismPrototypeExplorationInputRevision,
  ): boolean {
    const row = this.#database.prepare(
      "SELECT record_json FROM agent_tasks WHERE task_id = ?",
    ).get(runTaskId) as Readonly<{ record_json?: unknown }> | undefined;
    if (typeof row?.record_json !== "string") return false;
    let decoded: unknown;
    try { decoded = JSON.parse(row.record_json); } catch { return false; }
    const task = assertAgentTask(decoded);
    return task.kind === "MECHANISM_PROTOTYPE_EXPLORATION" &&
      task.protocol === "MECHANISM_PROTOTYPE_EXPLORATION_TASK_V1" &&
      // V9 is the only dispatchable protocol. Earlier tasks remain recognizable
      // here solely so their immutable input/result lineage survives restart.
      (task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V1" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V2" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V3" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V4" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V5" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V6" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V7" ||
        task.requestedEffectProtocol === "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V8" ||
        ["MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V9",
          "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V10",
          "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V11",
          "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V12"]
          .includes(task.requestedEffectProtocol)) &&
      task.provenanceRef === `mechanism-prototype-exploration:${input.lensId}`;
  }

  public loadStudioProjectionSnapshot(): StudioProjectionSnapshot | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      `SELECT projection_view_hash, record_json, record_hash
       FROM studio_projection_snapshot WHERE singleton = 1`,
    ).get() as Readonly<{
      projection_view_hash: string;
      record_json: string;
      record_hash: string;
    }> | undefined;
    if (row === undefined) return null;
    try {
      const snapshot = assertStudioProjectionSnapshot(JSON.parse(row.record_json));
      if (
        row.projection_view_hash !== snapshot.projectionViewHash ||
        row.record_hash !== snapshot.snapshotHash
      ) return null;
      return snapshot;
    } catch {
      // This is a disposable presentation cache. Malformation is a cache miss,
      // not a durable evidence recovery failure.
      return null;
    }
  }

  public saveStudioProjectionSnapshot(
    snapshotInput: StudioProjectionSnapshot,
  ): StudioProjectionSnapshot {
    this.#assertOpen();
    const snapshot = assertStudioProjectionSnapshot(snapshotInput);
    const recordJson = canonicalJson(snapshot);
    this.#database.prepare(
      `INSERT INTO studio_projection_snapshot (
         singleton, projection_view_hash, materialized_at, record_json, record_hash
       ) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET
         projection_view_hash = excluded.projection_view_hash,
         materialized_at = excluded.materialized_at,
         record_json = excluded.record_json,
         record_hash = excluded.record_hash`,
    ).run(
      snapshot.projectionViewHash,
      snapshot.materializedAt,
      recordJson,
      snapshot.snapshotHash,
    );
    const stored = this.loadStudioProjectionSnapshot();
    if (stored === null || stored.snapshotHash !== snapshot.snapshotHash) {
      throw new Error("SQLite failed to retain the Studio projection snapshot");
    }
    return stored;
  }

  public loadResearchDecisionEpisodes(limit: number): readonly ResearchDecisionEpisode[] {
    this.#assertOpen();
    assertLimit(limit);
    if (limit > 512) throw new Error("research decision episode limit exceeds 512");
    const rows = this.#database
      .prepare(
        `SELECT episode_id, record_json, record_hash
         FROM research_decision_episodes
         ORDER BY captured_at DESC, episode_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseResearchDecisionEpisode));
  }

  public loadResearchDecisionEpisode(episodeId: Hash): ResearchDecisionEpisode | null {
    this.#assertOpen();
    if (!/^sha256:[0-9a-f]{64}$/u.test(String(episodeId))) {
      throw new Error("research decision episode identity is invalid");
    }
    const row = this.#database
      .prepare(
        `SELECT episode_id, record_json, record_hash
         FROM research_decision_episodes WHERE episode_id = ?`,
      )
      .get(episodeId);
    return row === undefined ? null : parseResearchDecisionEpisode(row);
  }

  public saveResearchDecisionEpisode(
    episodeInput: ResearchDecisionEpisode,
  ): ResearchDecisionEpisode {
    this.#assertOpen();
    const episode = assertResearchDecisionEpisode(episodeInput);
    const recordJson = canonicalJson(episode);
    const recordHash = hashCanonical(episode);
    this.#database
      .prepare(
        `INSERT INTO research_decision_episodes (
           episode_id, captured_at, work_item_id, allocation_action_id,
           target_id, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(episode_id) DO NOTHING`,
      )
      .run(
        episode.episodeId,
        episode.capturedAt,
        episode.workItemId,
        episode.allocationActionId,
        episode.targetId,
        recordJson,
        recordHash,
      );
    const stored = this.loadResearchDecisionEpisode(episode.episodeId);
    if (stored === null || hashCanonical(stored) !== recordHash) {
      throw new Error("research decision episode identity is already bound elsewhere");
    }
    return stored;
  }

  public loadResearchDecisionOutcomeObservations(
    limit: number,
  ): readonly ResearchDecisionOutcomeObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    if (limit > 4096) {
      throw new Error("research decision outcome observation limit exceeds 4096");
    }
    const rows = this.#database.prepare(
      `SELECT observation_id, record_json, record_hash
       FROM research_decision_outcome_observations
       ORDER BY observed_at DESC, observation_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseResearchDecisionOutcomeObservation));
  }

  public loadResearchDecisionOutcomeObservation(
    observationId: Hash,
  ): ResearchDecisionOutcomeObservation | null {
    this.#assertOpen();
    if (!/^sha256:[0-9a-f]{64}$/u.test(String(observationId))) {
      throw new Error("research decision outcome observation identity is invalid");
    }
    const row = this.#database.prepare(
      `SELECT observation_id, record_json, record_hash
       FROM research_decision_outcome_observations
       WHERE observation_id = ?`,
    ).get(observationId);
    return row === undefined ? null : parseResearchDecisionOutcomeObservation(row);
  }

  public loadLatestResearchDecisionOutcomeObservation(
    episodeId: Hash,
  ): ResearchDecisionOutcomeObservation | null {
    this.#assertOpen();
    if (!/^sha256:[0-9a-f]{64}$/u.test(String(episodeId))) {
      throw new Error("research decision episode identity is invalid");
    }
    const row = this.#database.prepare(
      `SELECT observation_id, record_json, record_hash
       FROM research_decision_outcome_observations
       WHERE episode_id = ?
       ORDER BY observed_at DESC, observation_id DESC
       LIMIT 1`,
    ).get(episodeId);
    return row === undefined ? null : parseResearchDecisionOutcomeObservation(row);
  }

  public saveResearchDecisionOutcomeObservation(
    observationInput: ResearchDecisionOutcomeObservation,
  ): ResearchDecisionOutcomeObservation {
    this.#assertOpen();
    const observation = assertResearchDecisionOutcomeObservation(observationInput);
    const episode = this.loadResearchDecisionEpisode(observation.episodeId);
    if (episode === null || episode.workItemId !== observation.workItemId) {
      throw new Error("research decision outcome observation episode is unavailable");
    }
    if (observation.boundaryEpisodeId !== null) {
      const boundary = this.loadResearchDecisionEpisode(observation.boundaryEpisodeId);
      if (boundary === null || boundary.workItemId === null ||
          boundary.workItemId !== episode.workItemId ||
          boundary.capturedAt.localeCompare(episode.capturedAt) < 0) {
        throw new Error("research decision outcome boundary episode is invalid");
      }
    }
    const recordJson = canonicalJson(observation);
    const recordHash = hashCanonical(observation);
    const retained = this.loadResearchDecisionOutcomeObservation(
      observation.observationId,
    );
    if (retained !== null) {
      if (hashCanonical(retained) !== recordHash) {
        throw new Error("research decision outcome observation identity is already bound");
      }
      return retained;
    }
    const latest = this.loadLatestResearchDecisionOutcomeObservation(
      observation.episodeId,
    );
    if ((latest?.observationId ?? null) !== observation.previousObservationId) {
      throw new Error("research decision outcome observation predecessor is not latest");
    }
    this.#database.prepare(
      `INSERT INTO research_decision_outcome_observations (
         observation_id, state_identity, previous_observation_id,
         boundary_episode_id, episode_id, work_item_id, observed_at,
         record_json, record_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(observation_id) DO NOTHING`,
    ).run(
      observation.observationId,
      observation.stateIdentity,
      observation.previousObservationId,
      observation.boundaryEpisodeId,
      observation.episodeId,
      observation.workItemId,
      observation.observedAt,
      recordJson,
      recordHash,
    );
    const stored = this.loadResearchDecisionOutcomeObservation(
      observation.observationId,
    );
    if (stored === null || hashCanonical(stored) !== recordHash) {
      throw new Error("research decision outcome observation transition already exists");
    }
    return stored;
  }

  public loadDiscoverySignalRecords(limit: number): readonly DiscoverySignalRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    if (limit > 512) throw new Error("discovery signal limit exceeds 512");
    const rows = this.#database.prepare(
      `SELECT signal_id, record_json, record_hash
       FROM discovery_signals
       ORDER BY observed_at DESC, signal_id ASC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseDiscoverySignal));
  }

  public loadDiscoverySignalRecord(signalId: Hash): DiscoverySignalRecord | null {
    this.#assertOpen();
    if (!/^sha256:[0-9a-f]{64}$/u.test(String(signalId))) {
      throw new Error("discovery signal identity is invalid");
    }
    const row = this.#database.prepare(
      `SELECT signal_id, record_json, record_hash
       FROM discovery_signals WHERE signal_id = ?`,
    ).get(signalId);
    return row === undefined ? null : parseDiscoverySignal(row);
  }

  public saveDiscoverySignalRecord(
    recordInput: DiscoverySignalRecord,
  ): DiscoverySignalRecord {
    this.#assertOpen();
    const record = assertDiscoverySignalRecord(recordInput);
    const existing = this.loadDiscoverySignalRecord(record.signalId);
    if (existing !== null) {
      const sourceIdentity = (item: DiscoverySignalRecord) => hashCanonical({
        ...item,
        status: "UNREAD",
        readAt: null,
      });
      if (sourceIdentity(existing) !== sourceIdentity(record) ||
          (existing.status === "READ" &&
            (record.status !== "READ" || record.readAt !== existing.readAt))) {
        throw new Error("discovery signal source state is immutable");
      }
    }
    const recordJson = canonicalJson(record);
    const recordHash = hashCanonical(record);
    this.#database.prepare(
      `INSERT INTO discovery_signals (
         signal_id, dedupe_identity, status, kind, observed_at,
         record_json, record_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(signal_id) DO UPDATE SET
         status = excluded.status,
         record_json = excluded.record_json,
         record_hash = excluded.record_hash
       WHERE discovery_signals.dedupe_identity = excluded.dedupe_identity`,
    ).run(
      record.signalId, record.dedupeIdentity, record.status, record.kind,
      record.observedAt, recordJson, recordHash,
    );
    const stored = this.loadDiscoverySignalRecord(record.signalId);
    if (stored === null || hashCanonical(stored) !== recordHash) {
      throw new Error("discovery signal identity is already bound elsewhere");
    }
    return stored;
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
               AND NOT EXISTS (
                 SELECT 1 FROM catalog_contract_text_evidence
                 WHERE catalog_contract_text_evidence.catalog_observation_id =
                       catalog_observations.observation_id
               )
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

  public loadCatalogContractTextEvidence(
    limit: number,
  ): readonly CatalogContractTextEvidence[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT artifact_id, catalog_observation_id, record_json, record_hash
       FROM catalog_contract_text_evidence
       ORDER BY received_at DESC, artifact_id DESC LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseCatalogContractTextEvidence));
  }

  public saveCatalogContractTextEvidence(
    evidenceInput: CatalogContractTextEvidence,
  ): CatalogContractTextEvidence {
    this.#assertOpen();
    const evidence = assertCatalogContractTextEvidence(evidenceInput);
    const recordJson = canonicalJson(evidence);
    const recordHash = hashCanonical(evidence);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const source = this.#database.prepare(
        `SELECT observation_id, record_json, record_hash, raw_bytes
         FROM catalog_observations WHERE observation_id = ?`,
      ).get(evidence.catalogObservationId);
      if (source === undefined) {
        throw new Error("catalog contract-text evidence lost its raw observation");
      }
      const observation = parseStoredCatalogObservation(source);
      if (
        observation.record.rawHash !== evidence.sourceRawHash ||
        observation.record.receivedAt !== evidence.receivedAt ||
        observation.record.venueId !== evidence.venueId ||
        observation.record.protocolIdentity !== evidence.protocolIdentity ||
        observation.record.schemaVersion !== "pmh.catalog-observation.v2" ||
        observation.record.normalizerIdentity !== evidence.normalizerIdentity
      ) throw new Error("catalog contract-text evidence source lineage is inconsistent");
      this.#database.prepare(
        `INSERT INTO catalog_contract_text_evidence (
           artifact_id, catalog_observation_id, listing_ref, source_raw_hash,
           received_at, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(artifact_id) DO NOTHING`,
      ).run(
        evidence.artifactId,
        evidence.catalogObservationId,
        evidence.listingRef,
        evidence.sourceRawHash,
        evidence.receivedAt,
        recordJson,
        recordHash,
      );
      const row = this.#database.prepare(
        `SELECT artifact_id, catalog_observation_id, record_json, record_hash
         FROM catalog_contract_text_evidence WHERE artifact_id = ?`,
      ).get(evidence.artifactId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain catalog contract-text evidence");
      }
      const stored = parseCatalogContractTextEvidence(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("catalog contract-text artifact is already bound elsewhere");
      }
      this.#database.exec("COMMIT");
      return stored;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadContractSemanticContinuities(
    limit: number,
  ): readonly ContractSemanticContinuity[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT continuity_id, record_json, record_hash
       FROM contract_semantic_continuities
       ORDER BY rowid DESC LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseContractSemanticContinuity));
  }

  public saveContractSemanticContinuity(
    continuityInput: ContractSemanticContinuity,
  ): ContractSemanticContinuity {
    this.#assertOpen();
    const continuity = assertContractSemanticContinuity(continuityInput);
    const recordJson = canonicalJson(continuity);
    const recordHash = hashCanonical(continuity);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const artifact = this.#database.prepare(
        `SELECT artifact_id, catalog_observation_id, record_json, record_hash
         FROM catalog_contract_text_evidence WHERE artifact_id = ?`,
      ).get(continuity.currentCatalogTextArtifactId);
      if (artifact === undefined) {
        throw new Error("contract semantic continuity lost its catalog text artifact");
      }
      const evidence = parseCatalogContractTextEvidence(artifact);
      if (
        evidence.schemaVersion !== "pmh.catalog-contract-text-evidence.v2" ||
        evidence.listingRef !== continuity.listingRef ||
        evidence.discoveryListingHash !== continuity.currentListingHash ||
        evidence.sourceRawHash !== continuity.currentSourceRawHash ||
        evidence.receivedAt !== continuity.currentSourceReceivedAt ||
        evidence.textHash !== continuity.rulesTextHash
      ) throw new Error("contract semantic continuity source lineage is inconsistent");
      this.#database.prepare(
        `INSERT INTO contract_semantic_continuities (
           continuity_id, listing_ref, prior_semantic_source_artifact_id,
           current_catalog_text_artifact_id, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(continuity_id) DO NOTHING`,
      ).run(
        continuity.continuityId,
        continuity.listingRef,
        continuity.priorSemanticSourceArtifactId,
        continuity.currentCatalogTextArtifactId,
        recordJson,
        recordHash,
      );
      const row = this.#database.prepare(
        `SELECT continuity_id, record_json, record_hash
         FROM contract_semantic_continuities WHERE continuity_id = ?`,
      ).get(continuity.continuityId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain contract semantic continuity");
      }
      const stored = parseContractSemanticContinuity(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("contract semantic continuity identity is already bound elsewhere");
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
      const currentIsRetainedTerminal =
        (validated.status === "PASS" || validated.status === "FAILED") &&
        validated.deepLane.status !== "PENDING" &&
        validated.deepLane.status !== "RUNNING";
      this.#database
        .prepare(
          `DELETE FROM search_lease_records
           WHERE lease_id IN (
             SELECT lease_id FROM search_lease_records
             WHERE lease_id <> ?
               AND status IN ('PASS', 'FAILED')
               AND COALESCE(
                 json_extract(record_json, '$.deepLane.status'),
                 'NOT_RUN'
               ) NOT IN ('PENDING', 'RUNNING')
             ORDER BY rowid DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(
          validated.lease.leaseId,
          Math.max(0, retentionLimit - (currentIsRetainedTerminal ? 1 : 0)),
        );
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

  public loadSemanticReviewRecordsByIds(
    reviewIds: readonly Hash[],
  ): readonly SemanticReviewRecord[] {
    this.#assertOpen();
    const ids = Object.freeze([...new Set(reviewIds)].sort());
    if (ids.length > 512 || ids.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(String(item)))) {
      throw new Error("semantic review identity lookup is invalid or unbounded");
    }
    if (ids.length === 0) return Object.freeze([]);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(
        `SELECT review_id, opportunity_id, record_json, record_hash
         FROM semantic_review_records
         WHERE review_id IN (${placeholders})
         ORDER BY rowid DESC`,
      )
      .all(...ids);
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

  public loadProbabilityEstimationJobRecordsByProposalIds(
    proposalIds: readonly Hash[],
  ): readonly ProbabilityEstimationJobRecord[] {
    this.#assertOpen();
    if (proposalIds.length === 0) return Object.freeze([]);
    if (proposalIds.length > 512 || new Set(proposalIds).size !== proposalIds.length ||
        proposalIds.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(item))) {
      throw new Error("probability estimation proposal lineage query is invalid or unbounded");
    }
    const placeholders = proposalIds.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM probability_estimation_jobs
         WHERE json_extract(record_json, '$.proposalId') IN (${placeholders})
         ORDER BY updated_at DESC, job_id DESC`,
      )
      .all(...proposalIds);
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

  public loadAgentExecutionSnapshot(): AgentExecutionSnapshot {
    this.#assertOpen();
    const load = <T>(
      table: string,
      idColumn: string,
      validator: (record: unknown) => T,
      identity: (record: T) => string,
      label: string,
    ): readonly T[] => Object.freeze(
      this.#database
        .prepare(
          `SELECT ${idColumn} AS record_id, record_json, record_hash
           FROM ${table} ORDER BY ${idColumn} ASC`,
        )
        .all()
        .map((row) => parseAgentExecutionRecord(row, identity, validator, label)),
    );
    const snapshot = emptyAgentExecutionSnapshot();
    const result = Object.freeze({
      ...snapshot,
      runtimeDefinitions: load(
        "agent_runtime_definitions",
        "runtime_definition_id",
        assertAgentRuntimeDefinition,
        (record: AgentRuntimeDefinition) => record.runtimeDefinitionId,
        "Agent runtime definition",
      ),
      credentialBindings: load(
        "credential_bindings",
        "credential_binding_id",
        assertCredentialBinding,
        (record: CredentialBinding) => record.credentialBindingId,
        "credential binding",
      ),
      modelProfiles: load(
        "model_profiles",
        "model_profile_id",
        assertModelProfile,
        (record: ModelProfile) => record.modelProfileId,
        "model profile",
      ),
      executionProfiles: load(
        "execution_profiles",
        "execution_profile_id",
        assertExecutionProfile,
        (record: ExecutionProfile) => record.executionProfileId,
        "execution profile",
      ),
      capabilityObservations: load(
        "execution_capability_observations",
        "observation_id",
        assertExecutionCapabilityObservation,
        (record: ExecutionCapabilityObservation) => record.observationId,
        "execution capability observation",
      ),
      workloadRoutes: load(
        "workload_routes",
        "workload_route_id",
        assertWorkloadRoute,
        (record: WorkloadRoute) => record.workloadRouteId,
        "workload route",
      ),
      tasks: load(
        "agent_tasks",
        "task_id",
        assertAgentTask,
        (record: AgentTask) => record.taskId,
        "Agent task",
      ),
      runs: load(
        "agent_runs",
        "run_id",
        assertAgentRun,
        (record: AgentRun) => record.runId,
        "Agent run",
      ),
      modelInvocations: load(
        "model_invocations",
        "invocation_id",
        assertModelInvocation,
        (record: ModelInvocation) => record.invocationId,
        "model invocation",
      ),
      toolEffects: load(
        "agent_tool_effects",
        "effect_id",
        assertAgentToolEffect,
        (record: AgentToolEffect) => record.effectId,
        "Agent tool effect",
      ),
      runArtifacts: load(
        "agent_run_artifacts",
        "artifact_id",
        assertAgentRunArtifact,
        (record: AgentRunArtifact) => record.artifactId,
        "Agent run artifact",
      ),
      runAnnotations: load(
        "agent_run_annotations",
        "annotation_id",
        assertAgentRunAnnotation,
        (record: AgentRunAnnotation) => record.annotationId,
        "Agent run annotation",
      ),
      campaigns: load(
        "agent_campaigns",
        "campaign_id",
        assertAgentCampaign,
        (record: AgentCampaign) => record.campaignId,
        "Agent campaign",
      ),
      resultSelections: load(
        "result_selections",
        "selection_id",
        assertResultSelection,
        (record: ResultSelection) => record.selectionId,
        "result selection",
      ),
    });
    const storedMemberships = this.#database
      .prepare(
        `SELECT campaign_id, task_id FROM agent_campaign_memberships
         ORDER BY campaign_id ASC, task_id ASC`,
      )
      .all()
      .map((row) => {
        const membership = row as Readonly<{
          campaign_id?: unknown;
          task_id?: unknown;
        }>;
        if (typeof membership.campaign_id !== "string" ||
            typeof membership.task_id !== "string") {
          throw new Error("SQLite Agent campaign membership is malformed");
        }
        return `${membership.campaign_id}:${membership.task_id}`;
      });
    const expectedMemberships = result.campaigns.flatMap((campaign) =>
      campaign.taskIds.map((taskId) => `${campaign.campaignId}:${taskId}`)
    ).sort();
    if (JSON.stringify(storedMemberships) !== JSON.stringify(expectedMemberships)) {
      throw new Error("SQLite Agent campaign membership does not match its campaign record");
    }
    return result;
  }

  public saveAgentExecutionBatch(batchInput: AgentExecutionBatch): void {
    this.#saveAgentExecutionBatch(
      batchInput,
      this.loadAgentExecutionSnapshot(),
    );
  }

  public saveAgentExecutionBatchAgainstSnapshot(
    batchInput: AgentExecutionBatch,
    existing: AgentExecutionSnapshot,
  ): void {
    this.#saveAgentExecutionBatch(batchInput, existing);
  }

  #saveAgentExecutionBatch(
    batchInput: AgentExecutionBatch,
    existing: AgentExecutionSnapshot,
  ): void {
    this.#assertOpen();
    const batch = Object.freeze({
      runtimeDefinitions: Object.freeze(
        (batchInput.runtimeDefinitions ?? []).map(assertAgentRuntimeDefinition),
      ),
      credentialBindings: Object.freeze(
        (batchInput.credentialBindings ?? []).map(assertCredentialBinding),
      ),
      modelProfiles: Object.freeze(
        (batchInput.modelProfiles ?? []).map(assertModelProfile),
      ),
      executionProfiles: Object.freeze(
        (batchInput.executionProfiles ?? []).map(assertExecutionProfile),
      ),
      capabilityObservations: Object.freeze(
        (batchInput.capabilityObservations ?? []).map(
          assertExecutionCapabilityObservation,
        ),
      ),
      workloadRoutes: Object.freeze(
        (batchInput.workloadRoutes ?? []).map(assertWorkloadRoute),
      ),
      tasks: Object.freeze((batchInput.tasks ?? []).map(assertAgentTask)),
      runs: Object.freeze((batchInput.runs ?? []).map(assertAgentRun)),
      modelInvocations: Object.freeze(
        (batchInput.modelInvocations ?? []).map(assertModelInvocation),
      ),
      toolEffects: Object.freeze(
        (batchInput.toolEffects ?? []).map(assertAgentToolEffect),
      ),
      runArtifacts: Object.freeze(
        (batchInput.runArtifacts ?? []).map(assertAgentRunArtifact),
      ),
      runAnnotations: Object.freeze(
        (batchInput.runAnnotations ?? []).map(assertAgentRunAnnotation),
      ),
      campaigns: Object.freeze(
        (batchInput.campaigns ?? []).map(assertAgentCampaign),
      ),
      resultSelections: Object.freeze(
        (batchInput.resultSelections ?? []).map(assertResultSelection),
      ),
    });
    const indexed = <T>(
      retained: readonly T[],
      incoming: readonly T[],
      identity: (record: T) => string,
      label: string,
    ): Map<string, T> => {
      const records = new Map(retained.map((record) => [identity(record), record] as const));
      const incomingIdentities = new Set<string>();
      for (const record of incoming) {
        const key = identity(record);
        if (incomingIdentities.has(key)) {
          throw new Error(`Agent execution batch repeats a ${label} identity`);
        }
        incomingIdentities.add(key);
        records.set(key, record);
      }
      return records;
    };
    const runtimes = indexed(
      existing.runtimeDefinitions,
      batch.runtimeDefinitions,
      (record) => record.runtimeDefinitionId,
      "runtime",
    );
    const credentials = indexed(
      existing.credentialBindings,
      batch.credentialBindings,
      (record) => record.credentialBindingId,
      "credential",
    );
    const models = indexed(
      existing.modelProfiles,
      batch.modelProfiles,
      (record) => record.modelProfileId,
      "model profile",
    );
    const profiles = indexed(
      existing.executionProfiles,
      batch.executionProfiles,
      (record) => record.executionProfileId,
      "execution profile",
    );
    indexed(
      existing.capabilityObservations,
      batch.capabilityObservations,
      (record) => record.observationId,
      "execution capability observation",
    );
    const tasks = indexed(existing.tasks, batch.tasks, (record) => record.taskId, "task");
    const runs = indexed(existing.runs, batch.runs, (record) => record.runId, "run");
    const invocations = indexed(
      existing.modelInvocations,
      batch.modelInvocations,
      (record) => record.invocationId,
      "model invocation",
    );
    const artifacts = indexed(
      existing.runArtifacts,
      batch.runArtifacts,
      (record) => record.artifactId,
      "run artifact",
    );

    for (const profile of batch.executionProfiles) {
      const runtime = runtimes.get(profile.runtimeDefinitionId);
      const credential = credentials.get(profile.credentialBindingId);
      const model = models.get(profile.modelProfileId);
      if (runtime === undefined || credential === undefined || model === undefined) {
        throw new Error("Execution profile references unavailable substrate records");
      }
      assertExecutionProfileCompatibility(runtime, credential, model);
    }
    for (const observation of batch.capabilityObservations) {
      if (!profiles.has(observation.executionProfileId)) {
        throw new Error(
          "Execution capability observation references an unavailable profile",
        );
      }
    }
    for (const route of batch.workloadRoutes) {
      if (!profiles.has(route.executionProfileId)) {
        throw new Error("Workload route references an unavailable execution profile");
      }
    }
    for (const run of batch.runs) {
      if (!tasks.has(run.taskId) || !profiles.has(run.executionProfileId)) {
        throw new Error("Agent run references unavailable task or execution profile");
      }
    }
    for (const invocation of batch.modelInvocations) {
      const run = runs.get(invocation.runId);
      const model = models.get(invocation.modelProfileId);
      const profile = run === undefined ? undefined : profiles.get(run.executionProfileId);
      if (run === undefined || model === undefined || profile === undefined ||
          profile.modelProfileId !== model.modelProfileId) {
        throw new Error("Model invocation references an incompatible run or model profile");
      }
    }
    for (const effect of batch.toolEffects) {
      if (!runs.has(effect.runId)) {
        throw new Error("Agent tool effect references an unavailable run");
      }
      if (effect.schemaVersion === "pmh.agent-tool-effect.v3") {
        const source = invocations.get(effect.sourceInvocationId);
        if (source === undefined || source.runId !== effect.runId) {
          throw new Error(
            "Agent tool effect references an unavailable or incompatible source invocation",
          );
        }
      }
    }
    for (const artifact of batch.runArtifacts) {
      const run = runs.get(artifact.runId);
      if (run === undefined) {
        throw new Error("Agent run artifact references an unavailable run");
      }
      if (Date.parse(artifact.createdAt) < Date.parse(run.createdAt)) {
        throw new Error("Agent run artifact predates its run");
      }
    }
    for (const annotation of batch.runAnnotations) {
      const run = runs.get(annotation.runId);
      if (run === undefined) {
        throw new Error("Agent run annotation references an unavailable run");
      }
      if (Date.parse(annotation.createdAt) < Date.parse(run.createdAt)) {
        throw new Error("Agent run annotation predates its run");
      }
    }
    const selectableArtifacts = new Set(
      [...artifacts.values()].map((artifact) => `${artifact.runId}:${artifact.contentHash}`),
    );
    for (const campaign of batch.campaigns) {
      if (!profiles.has(campaign.executionProfileId) ||
          campaign.taskIds.some((taskId) => !tasks.has(taskId))) {
        throw new Error("Agent campaign references unavailable tasks or execution profile");
      }
    }
    for (const selection of batch.resultSelections) {
      const run = runs.get(selection.runId);
      if (!tasks.has(selection.taskId) || run?.taskId !== selection.taskId) {
        throw new Error("Result selection references an incompatible task or run");
      }
      if (run.status !== "SUCCEEDED" || run.completedAt === null ||
          Date.parse(selection.selectedAt) < Date.parse(run.completedAt)) {
        throw new Error("Result selection requires a completed successful run");
      }
      if (!selectableArtifacts.has(`${selection.runId}:${selection.artifactHash}`)) {
        throw new Error("Result selection references an unavailable run artifact");
      }
    }

    const persist = (
      sql: string,
      values: readonly (string | number | null)[],
      table: string,
      idColumn: string,
      identity: string,
      record: unknown,
      label: string,
    ): void => {
      const recordJson = canonicalJson(record);
      const recordHash = hashCanonical(record);
      this.#database.prepare(sql).run(...values, recordJson, recordHash);
      const row = this.#database
        .prepare(`SELECT record_hash FROM ${table} WHERE ${idColumn} = ?`)
        .get(identity) as Readonly<{ record_hash?: unknown }> | undefined;
      if (row?.record_hash !== recordHash) {
        throw new Error(`${label} identity is already bound to another record`);
      }
    };

    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const record of batch.runtimeDefinitions) {
        persist(
          `INSERT INTO agent_runtime_definitions (
             runtime_definition_id, runtime_kind, record_json, record_hash
           ) VALUES (?, ?, ?, ?) ON CONFLICT(runtime_definition_id) DO NOTHING`,
          [record.runtimeDefinitionId, record.kind],
          "agent_runtime_definitions",
          "runtime_definition_id",
          record.runtimeDefinitionId,
          record,
          "Agent runtime definition",
        );
      }
      for (const record of batch.credentialBindings) {
        persist(
          `INSERT INTO credential_bindings (
             credential_binding_id, credential_kind, record_json, record_hash
           ) VALUES (?, ?, ?, ?) ON CONFLICT(credential_binding_id) DO NOTHING`,
          [record.credentialBindingId, record.kind],
          "credential_bindings",
          "credential_binding_id",
          record.credentialBindingId,
          record,
          "Credential binding",
        );
      }
      for (const record of batch.modelProfiles) {
        persist(
          `INSERT INTO model_profiles (
             model_profile_id, profile_key, revision, access_driver, model,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(model_profile_id) DO NOTHING`,
          [record.modelProfileId, record.profileKey, record.revision,
            record.accessDriver, record.model],
          "model_profiles",
          "model_profile_id",
          record.modelProfileId,
          record,
          "Model profile",
        );
      }
      for (const record of batch.executionProfiles) {
        persist(
          `INSERT INTO execution_profiles (
             execution_profile_id, profile_key, revision, runtime_definition_id,
             credential_binding_id, model_profile_id, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(execution_profile_id) DO NOTHING`,
          [record.executionProfileId, record.profileKey, record.revision,
            record.runtimeDefinitionId, record.credentialBindingId, record.modelProfileId],
          "execution_profiles",
          "execution_profile_id",
          record.executionProfileId,
          record,
          "Execution profile",
        );
      }
      for (const record of batch.capabilityObservations) {
        persist(
          `INSERT INTO execution_capability_observations (
             observation_id, execution_profile_id, outcome, observed_at,
             valid_until, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
          [record.observationId, record.executionProfileId, record.outcome,
            record.observedAt, record.validUntil],
          "execution_capability_observations",
          "observation_id",
          record.observationId,
          record,
          "Execution capability observation",
        );
      }
      for (const record of batch.workloadRoutes) {
        persist(
          `INSERT INTO workload_routes (
             workload_route_id, route_key, revision, task_kind,
             execution_profile_id, automatic_dispatch, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
           ON CONFLICT(workload_route_id) DO NOTHING`,
          [record.workloadRouteId, record.routeKey, record.revision,
            record.taskKind, record.executionProfileId],
          "workload_routes",
          "workload_route_id",
          record.workloadRouteId,
          record,
          "Workload route",
        );
      }
      for (const record of batch.tasks) {
        persist(
          `INSERT INTO agent_tasks (
             task_id, task_kind, priority, created_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(task_id) DO UPDATE SET
             priority = excluded.priority,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
          [record.taskId, record.kind, record.priority, record.createdAt],
          "agent_tasks",
          "task_id",
          record.taskId,
          record,
          "Agent task",
        );
      }
      for (const record of batch.campaigns) {
        persist(
          `INSERT INTO agent_campaigns (
             campaign_id, campaign_key, revision, execution_profile_id, status,
             created_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(campaign_id) DO NOTHING`,
          [record.campaignId, record.campaignKey, record.revision,
            record.executionProfileId, record.status, record.createdAt],
          "agent_campaigns",
          "campaign_id",
          record.campaignId,
          record,
          "Agent campaign",
        );
        for (const taskId of record.taskIds) {
          this.#database.prepare(
            `INSERT INTO agent_campaign_memberships (campaign_id, task_id)
             VALUES (?, ?) ON CONFLICT(campaign_id, task_id) DO NOTHING`,
          ).run(record.campaignId, taskId);
        }
      }
      for (const record of batch.runs) {
        persist(
          `INSERT INTO agent_runs (
             run_id, task_id, execution_profile_id, status, created_at, completed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(run_id) DO UPDATE SET
             status = excluded.status,
             completed_at = excluded.completed_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash
           WHERE agent_runs.status = 'PREPARED' AND excluded.status != 'PREPARED'`,
          [record.runId, record.taskId, record.executionProfileId, record.status,
            record.createdAt, record.completedAt],
          "agent_runs",
          "run_id",
          record.runId,
          record,
          "Agent run",
        );
      }
      for (const record of batch.modelInvocations) {
        persist(
          `INSERT INTO model_invocations (
             invocation_id, run_id, ordinal, model_profile_id, status, started_at,
             completed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(invocation_id) DO NOTHING`,
          [record.invocationId, record.runId, record.ordinal, record.modelProfileId,
            record.status, record.startedAt, record.completedAt],
          "model_invocations",
          "invocation_id",
          record.invocationId,
          record,
          "Model invocation",
        );
      }
      for (const record of batch.toolEffects) {
        persist(
          `INSERT INTO agent_tool_effects (
             effect_id, run_id, ordinal, status, occurred_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(effect_id) DO NOTHING`,
          [record.effectId, record.runId, record.ordinal, record.status, record.occurredAt],
          "agent_tool_effects",
          "effect_id",
          record.effectId,
          record,
          "Agent tool effect",
        );
      }
      for (const record of batch.runArtifacts) {
        persist(
          `INSERT INTO agent_run_artifacts (
             artifact_id, run_id, ordinal, kind, content_hash, created_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(artifact_id) DO NOTHING`,
          [record.artifactId, record.runId, record.ordinal, record.kind,
            record.contentHash, record.createdAt],
          "agent_run_artifacts",
          "artifact_id",
          record.artifactId,
          record,
          "Agent run artifact",
        );
      }
      for (const record of batch.runAnnotations) {
        persist(
          `INSERT INTO agent_run_annotations (
             annotation_id, run_id, category, created_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(annotation_id) DO NOTHING`,
          [record.annotationId, record.runId, record.category, record.createdAt],
          "agent_run_annotations",
          "annotation_id",
          record.annotationId,
          record,
          "Agent run annotation",
        );
      }
      for (const record of batch.resultSelections) {
        persist(
          `INSERT INTO result_selections (
             selection_id, task_id, run_id, selected_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(selection_id) DO NOTHING`,
          [record.selectionId, record.taskId, record.runId, record.selectedAt],
          "result_selections",
          "selection_id",
          record.selectionId,
          record,
          "Result selection",
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public saveAgentTaskAdditions(tasksInput: readonly AgentTask[]): void {
    this.#assertOpen();
    const tasks = tasksInput.map(assertAgentTask);
    if (new Set(tasks.map((task) => task.taskId)).size !== tasks.length) {
      throw new Error("Agent task additions repeat an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const task of tasks) {
        const recordJson = canonicalJson(task);
        const recordHash = hashCanonical(task);
        this.#database.prepare(
          `INSERT INTO agent_tasks (
             task_id, task_kind, priority, created_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(task_id) DO NOTHING`,
        ).run(
          task.taskId,
          task.kind,
          task.priority,
          task.createdAt,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT record_hash FROM agent_tasks WHERE task_id = ?`,
        ).get(task.taskId) as Readonly<{ record_hash?: unknown }> | undefined;
        if (row?.record_hash !== recordHash) {
          throw new Error("Agent task identity is already bound to another record");
        }
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMarketOntologyAgentProposals(
    limit: number,
  ): readonly MarketOntologyAgentProposal[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT proposal_id, record_json, record_hash
       FROM market_ontology_agent_proposals
       ORDER BY proposed_at DESC, proposal_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseMarketOntologyAgentProposal));
  }

  public saveMarketOntologyAgentProposals(
    proposalsInput: readonly MarketOntologyAgentProposal[],
  ): readonly MarketOntologyAgentProposal[] {
    this.#assertOpen();
    const proposals = Object.freeze(proposalsInput.map(assertMarketOntologyAgentProposal));
    if (new Set(proposals.map((item) => item.proposalId)).size !== proposals.length) {
      throw new Error("market ontology Agent proposal batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const proposal of proposals) {
        const run = this.#database.prepare(
          "SELECT run_id FROM agent_runs WHERE run_id = ?",
        ).get(proposal.sourceAgentRunId);
        if (run === undefined) {
          throw new Error("market ontology Agent proposal references an unavailable run");
        }
        const recordJson = canonicalJson(proposal);
        const recordHash = hashCanonical(proposal);
        this.#database.prepare(
          `INSERT INTO market_ontology_agent_proposals (
             proposal_id, ontology_identity, source_snapshot_identity,
             source_agent_run_id, proposal_kind, proposed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(proposal_id) DO NOTHING`,
        ).run(
          proposal.proposalId,
          proposal.ontologyIdentity,
          proposal.sourceSnapshotIdentity,
          proposal.sourceAgentRunId,
          proposal.kind,
          proposal.proposedAt,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT proposal_id, record_json, record_hash
           FROM market_ontology_agent_proposals WHERE proposal_id = ?`,
        ).get(proposal.proposalId);
        const stored = parseMarketOntologyAgentProposal(row);
        if (stored.proposalId !== proposal.proposalId ||
            hashCanonical(stored) !== recordHash) {
          throw new Error("proposalId is already bound to another ontology proposal");
        }
      }
      this.#database.exec("COMMIT");
      return proposals;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismProposals(
    limit: number,
  ): readonly WorldStateMechanismProposal[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT proposal_id, route_family_id, record_json, record_hash
       FROM world_state_mechanism_proposals
       ORDER BY proposed_at DESC, proposal_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldStateMechanismProposal));
  }

  public saveWorldStateMechanismProposals(
    proposalsInput: readonly WorldStateMechanismProposal[],
  ): readonly WorldStateMechanismProposal[] {
    this.#assertOpen();
    const proposals = Object.freeze(proposalsInput.map(assertWorldStateMechanismProposal));
    if (new Set(proposals.map((item) => item.proposalId)).size !== proposals.length) {
      throw new Error("world-state mechanism proposal batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const proposal of proposals) {
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(proposal.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (typeof runRow?.task_id !== "string") {
          throw new Error("world-state mechanism proposal references an unavailable run");
        }
        const revisionRow = this.#database.prepare(
          `SELECT revision_id, record_json, record_hash
           FROM ontology_search_issue_revisions WHERE revision_id = ?`,
        ).get(proposal.sourceIssueRevisionId);
        if (revisionRow === undefined) {
          throw new Error(
            "world-state mechanism proposal references an unavailable issue revision",
          );
        }
        const revision = parseOntologySearchIssueRevision(revisionRow);
        const assignedEvidence = new Map(revision.taskPayload.listingEvidence
          .map((item) => [item.node.listingRef, item]));
        const proposalBindings = [
          ...proposal.trigger.evidenceBindings,
          ...proposal.dependent.evidenceBindings,
        ];
        if (!this.#worldStateMechanismRunMatchesRevision(runRow.task_id, revision) ||
            proposal.ontologyIdentity !== revision.ontologyIdentity ||
            proposal.sourceSnapshotIdentity !== revision.sourceSnapshotIdentity ||
            !proposal.sourceRelationPatternIds.includes(revision.relationPatternId) ||
            !proposal.sourceTrailheadIds.some((item) => revision.trailheadIds.includes(item)) ||
            proposalBindings.some((binding) => {
              const evidence = assignedEvidence.get(binding.listingRef);
              return evidence === undefined || binding.title !== evidence.title ||
                binding.nodeId !== evidence.node.nodeId ||
                binding.worldFacetId !== evidence.node.worldFacet.facetId ||
                binding.sourceRawHash !== evidence.sourceRawHash ||
                binding.protocolIdentity !== evidence.protocolIdentity;
            })) {
          throw new Error(
            "world-state mechanism proposal is outside its assigned issue lineage",
          );
        }
        const routeFamilyId = worldStateMechanismRouteFamilyIdentity(proposal);
        const recordJson = canonicalJson(proposal);
        const recordHash = hashCanonical(proposal);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_proposals (
             proposal_id, route_family_id, ontology_identity,
             source_snapshot_identity, source_issue_revision_id,
             source_agent_run_id, proposed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(proposal_id) DO NOTHING`,
        ).run(
          proposal.proposalId,
          routeFamilyId,
          proposal.ontologyIdentity,
          proposal.sourceSnapshotIdentity,
          proposal.sourceIssueRevisionId,
          proposal.sourceAgentRunId,
          proposal.proposedAt,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT proposal_id, route_family_id, record_json, record_hash
           FROM world_state_mechanism_proposals WHERE proposal_id = ?`,
        ).get(proposal.proposalId);
        const stored = parseWorldStateMechanismProposal(row);
        if (stored.proposalId !== proposal.proposalId ||
            hashCanonical(stored) !== recordHash) {
          throw new Error(
            "proposalId is already bound to another world-state mechanism proposal",
          );
        }
      }
      this.#database.exec("COMMIT");
      return proposals;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismCounterexamples(
    limit: number,
  ): readonly WorldStateMechanismCounterexample[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT counterexample_id, target_route_family_id, record_json, record_hash
       FROM world_state_mechanism_counterexamples
       ORDER BY proposed_at DESC, counterexample_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldStateMechanismCounterexample));
  }

  public saveWorldStateMechanismCounterexamples(
    counterexamplesInput: readonly WorldStateMechanismCounterexample[],
  ): readonly WorldStateMechanismCounterexample[] {
    this.#assertOpen();
    const counterexamples = Object.freeze(counterexamplesInput
      .map(assertWorldStateMechanismCounterexample));
    if (new Set(counterexamples.map((item) => item.counterexampleId)).size !==
        counterexamples.length) {
      throw new Error("world-state mechanism counterexample batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const counterexample of counterexamples) {
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(counterexample.sourceAgentRunId) as
          Readonly<{ task_id?: unknown }> | undefined;
        const revisionRow = this.#database.prepare(
          `SELECT revision_id, record_json, record_hash
           FROM ontology_search_issue_revisions WHERE revision_id = ?`,
        ).get(counterexample.sourceIssueRevisionId);
        if (typeof runRow?.task_id !== "string" || revisionRow === undefined) {
          throw new Error(
            "world-state mechanism counterexample references unavailable run lineage",
          );
        }
        const revision = parseOntologySearchIssueRevision(revisionRow);
        const assignedEvidence = new Map(revision.taskPayload.listingEvidence
          .map((item) => [item.node.listingRef, item]));
        const lineageInvalid = !this.#worldStateMechanismRunMatchesRevision(
          runRow.task_id,
          revision,
        ) ||
          counterexample.ontologyIdentity !== revision.ontologyIdentity ||
          counterexample.sourceSnapshotIdentity !== revision.sourceSnapshotIdentity ||
          !counterexample.sourceRelationPatternIds.includes(revision.relationPatternId) ||
          !counterexample.sourceTrailheadIds.some((item) =>
            revision.trailheadIds.includes(item)
          ) || counterexample.evidenceBindings.some((binding) => {
            const evidence = assignedEvidence.get(binding.listingRef);
            return evidence === undefined || binding.title !== evidence.title ||
              binding.nodeId !== evidence.node.nodeId ||
              binding.worldFacetId !== evidence.node.worldFacet.facetId ||
              binding.sourceRawHash !== evidence.sourceRawHash ||
              binding.protocolIdentity !== evidence.protocolIdentity;
          });
        if (lineageInvalid) {
          throw new Error(
            "world-state mechanism counterexample is outside its assigned issue lineage",
          );
        }
        for (const proposalId of counterexample.targetProposalIds) {
          const targetRow = this.#database.prepare(
            `SELECT proposal_id, route_family_id, record_json, record_hash
             FROM world_state_mechanism_proposals WHERE proposal_id = ?`,
          ).get(proposalId);
          if (targetRow === undefined ||
              worldStateMechanismRouteFamilyIdentity(
                parseWorldStateMechanismProposal(targetRow),
              ) !== counterexample.targetRouteFamilyId) {
            throw new Error(
              "world-state mechanism counterexample target is unavailable or inconsistent",
            );
          }
        }
        const recordJson = canonicalJson(counterexample);
        const recordHash = hashCanonical(counterexample);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_counterexamples (
             counterexample_id, target_route_family_id, ontology_identity,
             source_snapshot_identity, source_issue_revision_id,
             source_agent_run_id, proposed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(counterexample_id) DO NOTHING`,
        ).run(
          counterexample.counterexampleId,
          counterexample.targetRouteFamilyId,
          counterexample.ontologyIdentity,
          counterexample.sourceSnapshotIdentity,
          counterexample.sourceIssueRevisionId,
          counterexample.sourceAgentRunId,
          counterexample.proposedAt,
          recordJson,
          recordHash,
        );
        const stored = parseWorldStateMechanismCounterexample(this.#database.prepare(
          `SELECT counterexample_id, target_route_family_id, record_json, record_hash
           FROM world_state_mechanism_counterexamples WHERE counterexample_id = ?`,
        ).get(counterexample.counterexampleId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error(
            "counterexampleId is already bound to another world-state mechanism record",
          );
        }
      }
      this.#database.exec("COMMIT");
      return counterexamples;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismAbstentions(
    limit: number,
  ): readonly WorldStateMechanismAbstention[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT abstention_id, record_json, record_hash
       FROM world_state_mechanism_abstentions
       ORDER BY proposed_at DESC, abstention_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldStateMechanismAbstention));
  }

  public saveWorldStateMechanismAbstentions(
    abstentionsInput: readonly WorldStateMechanismAbstention[],
  ): readonly WorldStateMechanismAbstention[] {
    this.#assertOpen();
    const abstentions = Object.freeze(abstentionsInput
      .map(assertWorldStateMechanismAbstention));
    if (new Set(abstentions.map((item) => item.abstentionId)).size !==
        abstentions.length) {
      throw new Error("world-state mechanism abstention batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const abstention of abstentions) {
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(abstention.sourceAgentRunId) as
          Readonly<{ task_id?: unknown }> | undefined;
        const revisionRow = this.#database.prepare(
          `SELECT revision_id, record_json, record_hash
           FROM ontology_search_issue_revisions WHERE revision_id = ?`,
        ).get(abstention.sourceIssueRevisionId);
        if (typeof runRow?.task_id !== "string" || revisionRow === undefined) {
          throw new Error("world-state mechanism abstention references unavailable lineage");
        }
        const revision = parseOntologySearchIssueRevision(revisionRow);
        const assignedEvidence = new Map(revision.taskPayload.listingEvidence
          .map((item) => [item.node.listingRef, item]));
        const lineageInvalid = !this.#worldStateMechanismRunMatchesRevision(
          runRow.task_id,
          revision,
        ) || abstention.ontologyIdentity !== revision.ontologyIdentity ||
          abstention.sourceSnapshotIdentity !== revision.sourceSnapshotIdentity ||
          !abstention.sourceRelationPatternIds.includes(revision.relationPatternId) ||
          !abstention.sourceTrailheadIds.some((item) => revision.trailheadIds.includes(item)) ||
          abstention.evidenceBindings.some((binding) => {
            const evidence = assignedEvidence.get(binding.listingRef);
            return evidence === undefined || binding.title !== evidence.title ||
              binding.nodeId !== evidence.node.nodeId ||
              binding.worldFacetId !== evidence.node.worldFacet.facetId ||
              binding.sourceRawHash !== evidence.sourceRawHash ||
              binding.protocolIdentity !== evidence.protocolIdentity;
          });
        if (lineageInvalid) {
          throw new Error("world-state mechanism abstention is outside its assigned issue lineage");
        }
        const recordJson = canonicalJson(abstention);
        const recordHash = hashCanonical(abstention);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_abstentions (
             abstention_id, ontology_identity, source_snapshot_identity,
             source_issue_revision_id, source_agent_run_id, proposed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(abstention_id) DO NOTHING`,
        ).run(
          abstention.abstentionId,
          abstention.ontologyIdentity,
          abstention.sourceSnapshotIdentity,
          abstention.sourceIssueRevisionId,
          abstention.sourceAgentRunId,
          abstention.proposedAt,
          recordJson,
          recordHash,
        );
        const stored = parseWorldStateMechanismAbstention(this.#database.prepare(
          `SELECT abstention_id, record_json, record_hash
           FROM world_state_mechanism_abstentions WHERE abstention_id = ?`,
        ).get(abstention.abstentionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("abstentionId is already bound to another mechanism record");
        }
      }
      this.#database.exec("COMMIT");
      return abstentions;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismSubjectBindingReviews(
    limit: number,
  ): readonly WorldStateMechanismSubjectBindingReview[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT review_id, route_family_id, record_json, record_hash
       FROM world_state_mechanism_subject_reviews
       ORDER BY reviewed_at DESC, review_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldStateMechanismSubjectBindingReview));
  }

  public loadWorldStateSubjectBindingResearchInputs(
    limit: number,
  ): readonly WorldStateSubjectBindingResearchInputRevision[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT revision_id, case_id, record_json, record_hash
       FROM world_state_subject_binding_research_inputs
       ORDER BY materialized_at DESC, revision_id DESC LIMIT ?`,
    ).all(limit).map(parseWorldStateSubjectBindingResearchInput));
  }

  public saveWorldStateSubjectBindingResearchInputs(
    inputsValue: readonly WorldStateSubjectBindingResearchInputRevision[],
  ): readonly WorldStateSubjectBindingResearchInputRevision[] {
    this.#assertOpen();
    const inputs = Object.freeze(inputsValue.map(assertWorldStateSubjectBindingResearchInput));
    if (new Set(inputs.map((item) => item.revisionId)).size !== inputs.length) {
      throw new Error("subject-binding research input batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const input of inputs) {
        for (const proposalId of input.sourceProposalIds) {
          const row = this.#database.prepare(
            `SELECT proposal_id, route_family_id, record_json, record_hash
             FROM world_state_mechanism_proposals WHERE proposal_id = ?`,
          ).get(proposalId);
          if (row === undefined || worldStateMechanismRouteFamilyIdentity(
            parseWorldStateMechanismProposal(row),
          ) !== input.routeFamilyId) {
            throw new Error("subject-binding research input references inconsistent proposal");
          }
        }
        const recordJson = canonicalJson(input);
        const recordHash = hashCanonical(input);
        this.#database.prepare(
          `INSERT INTO world_state_subject_binding_research_inputs (
             revision_id, case_id, route_family_id, materialized_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(revision_id) DO NOTHING`,
        ).run(input.revisionId, input.caseId, input.routeFamilyId, input.materializedAt,
          recordJson, recordHash);
        const stored = parseWorldStateSubjectBindingResearchInput(this.#database.prepare(
          `SELECT revision_id, case_id, record_json, record_hash
           FROM world_state_subject_binding_research_inputs WHERE revision_id = ?`,
        ).get(input.revisionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("revisionId is already bound to another subject-binding input");
        }
      }
      this.#database.exec("COMMIT");
      return inputs;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateSubjectBindingAssessments(
    limit: number,
  ): readonly WorldStateSubjectBindingAssessment[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT assessment_id, case_id, record_json, record_hash
       FROM world_state_subject_binding_assessments
       ORDER BY assessed_at DESC, assessment_id DESC LIMIT ?`,
    ).all(limit).map(parseWorldStateSubjectBindingAssessment));
  }

  public saveWorldStateSubjectBindingAssessments(
    values: readonly WorldStateSubjectBindingAssessment[],
  ): readonly WorldStateSubjectBindingAssessment[] {
    this.#assertOpen();
    const assessments = Object.freeze(values.map(assertWorldStateSubjectBindingAssessment));
    if (new Set(assessments.map((item) => item.assessmentId)).size !== assessments.length) {
      throw new Error("subject-binding assessment batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const assessment of assessments) {
        const inputRow = this.#database.prepare(
          `SELECT revision_id, case_id, record_json, record_hash
           FROM world_state_subject_binding_research_inputs WHERE revision_id = ?`,
        ).get(assessment.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(assessment.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("subject-binding assessment references unavailable lineage");
        }
        const researchInput = parseWorldStateSubjectBindingResearchInput(inputRow);
        if (!this.#worldStateSubjectBindingRunMatchesInput(runRow.task_id, researchInput) ||
            researchInput.caseId !== assessment.caseId ||
            researchInput.routeFamilyId !== assessment.routeFamilyId ||
            researchInput.sourceProposalIds.join("\n") !==
              assessment.sourceProposalIds.join("\n")) {
          throw new Error("subject-binding assessment is outside its exact input lineage");
        }
        const recordJson = canonicalJson(assessment);
        const recordHash = hashCanonical(assessment);
        this.#database.prepare(
          `INSERT INTO world_state_subject_binding_assessments (
             assessment_id, case_id, input_revision_id, source_agent_run_id,
             recommendation, assessed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(assessment_id) DO NOTHING`,
        ).run(assessment.assessmentId, assessment.caseId, assessment.inputRevisionId,
          assessment.sourceAgentRunId, assessment.recommendation, assessment.assessedAt,
          recordJson, recordHash);
        const stored = parseWorldStateSubjectBindingAssessment(this.#database.prepare(
          `SELECT assessment_id, case_id, record_json, record_hash
           FROM world_state_subject_binding_assessments WHERE assessment_id = ?`,
        ).get(assessment.assessmentId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("assessmentId is already bound to another subject-binding assessment");
        }
      }
      this.#database.exec("COMMIT");
      return assessments;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateSubjectBindingAbstentions(
    limit: number,
  ): readonly WorldStateSubjectBindingAbstention[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT abstention_id, case_id, record_json, record_hash
       FROM world_state_subject_binding_abstentions
       ORDER BY assessed_at DESC, abstention_id DESC LIMIT ?`,
    ).all(limit).map(parseWorldStateSubjectBindingAbstention));
  }

  public saveWorldStateSubjectBindingAbstentions(
    values: readonly WorldStateSubjectBindingAbstention[],
  ): readonly WorldStateSubjectBindingAbstention[] {
    this.#assertOpen();
    const abstentions = Object.freeze(values.map(assertWorldStateSubjectBindingAbstention));
    if (new Set(abstentions.map((item) => item.abstentionId)).size !== abstentions.length) {
      throw new Error("subject-binding abstention batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const abstention of abstentions) {
        const inputRow = this.#database.prepare(
          `SELECT revision_id, case_id, record_json, record_hash
           FROM world_state_subject_binding_research_inputs WHERE revision_id = ?`,
        ).get(abstention.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(abstention.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("subject-binding abstention references unavailable lineage");
        }
        const researchInput = parseWorldStateSubjectBindingResearchInput(inputRow);
        if (!this.#worldStateSubjectBindingRunMatchesInput(runRow.task_id, researchInput) ||
            researchInput.caseId !== abstention.caseId ||
            researchInput.routeFamilyId !== abstention.routeFamilyId ||
            researchInput.sourceProposalIds.join("\n") !== abstention.sourceProposalIds.join("\n")) {
          throw new Error("subject-binding abstention is outside its exact input lineage");
        }
        const recordJson = canonicalJson(abstention);
        const recordHash = hashCanonical(abstention);
        this.#database.prepare(
          `INSERT INTO world_state_subject_binding_abstentions (
             abstention_id, case_id, input_revision_id, source_agent_run_id,
             assessed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(abstention_id) DO NOTHING`,
        ).run(abstention.abstentionId, abstention.caseId, abstention.inputRevisionId,
          abstention.sourceAgentRunId, abstention.assessedAt, recordJson, recordHash);
        const stored = parseWorldStateSubjectBindingAbstention(this.#database.prepare(
          `SELECT abstention_id, case_id, record_json, record_hash
           FROM world_state_subject_binding_abstentions WHERE abstention_id = ?`,
        ).get(abstention.abstentionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("abstentionId is already bound to another subject-binding abstention");
        }
      }
      this.#database.exec("COMMIT");
      return abstentions;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismPrototypeInputs(
    limit: number,
  ): readonly WorldStateMechanismPrototypeInputRevision[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT revision_id, candidate_id, record_json, record_hash
       FROM world_state_mechanism_prototype_inputs
       ORDER BY materialized_at DESC, revision_id DESC LIMIT ?`,
    ).all(limit).map(parseWorldStateMechanismPrototypeInput));
  }

  public saveWorldStateMechanismPrototypeInputs(
    values: readonly WorldStateMechanismPrototypeInputRevision[],
  ): readonly WorldStateMechanismPrototypeInputRevision[] {
    this.#assertOpen();
    const inputs = Object.freeze(values.map(assertWorldStateMechanismPrototypeInput));
    if (new Set(inputs.map((item) => item.revisionId)).size !== inputs.length) {
      throw new Error("mechanism prototype input batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const input of inputs) {
        for (const route of input.memberRoutes) {
          for (const proposalId of route.sourceProposalIds) {
            const row = this.#database.prepare(
              `SELECT proposal_id, route_family_id, record_json, record_hash
               FROM world_state_mechanism_proposals WHERE proposal_id = ?`,
            ).get(proposalId);
            if (row === undefined || worldStateMechanismRouteFamilyIdentity(
              parseWorldStateMechanismProposal(row),
            ) !== route.routeFamilyId) {
              throw new Error("mechanism prototype input references inconsistent route proposal");
            }
          }
        }
        const recordJson = canonicalJson(input);
        const recordHash = hashCanonical(input);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_prototype_inputs (
             revision_id, candidate_id, materialized_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(revision_id) DO NOTHING`,
        ).run(input.revisionId, input.candidateId, input.materializedAt,
          recordJson, recordHash);
        const stored = parseWorldStateMechanismPrototypeInput(this.#database.prepare(
          `SELECT revision_id, candidate_id, record_json, record_hash
           FROM world_state_mechanism_prototype_inputs WHERE revision_id = ?`,
        ).get(input.revisionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("revisionId is already bound to another mechanism prototype input");
        }
      }
      this.#database.exec("COMMIT");
      return inputs;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismPrototypeProposals(
    limit: number,
  ): readonly WorldStateMechanismPrototypeProposal[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT prototype_id, candidate_id, record_json, record_hash
       FROM world_state_mechanism_prototypes
       ORDER BY proposed_at DESC, prototype_id DESC LIMIT ?`,
    ).all(limit).map(parseWorldStateMechanismPrototypeProposal));
  }

  public saveWorldStateMechanismPrototypeProposals(
    values: readonly WorldStateMechanismPrototypeProposal[],
  ): readonly WorldStateMechanismPrototypeProposal[] {
    this.#assertOpen();
    const proposals = Object.freeze(values.map(assertWorldStateMechanismPrototypeProposal));
    if (new Set(proposals.map((item) => item.prototypeId)).size !== proposals.length) {
      throw new Error("mechanism prototype proposal batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const proposal of proposals) {
        const inputRow = this.#database.prepare(
          `SELECT revision_id, candidate_id, record_json, record_hash
           FROM world_state_mechanism_prototype_inputs WHERE revision_id = ?`,
        ).get(proposal.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(proposal.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("mechanism prototype proposal references unavailable lineage");
        }
        const input = parseWorldStateMechanismPrototypeInput(inputRow);
        if (!this.#worldStateMechanismPrototypeRunMatchesInput(runRow.task_id, input) ||
            input.candidateId !== proposal.candidateId ||
            input.memberRouteFamilyIds.join("\n") !==
              proposal.memberRouteFamilyIds.join("\n") ||
            hashCanonical(input.signature) !== hashCanonical(proposal.invariantSignature)) {
          throw new Error("mechanism prototype proposal is outside its exact input lineage");
        }
        // Rebuild against the exact input so stored variable values cannot evade route grounding.
        const rebuilt = buildWorldStateMechanismPrototypeProposal({
          researchInput: input, sourceAgentRunId: proposal.sourceAgentRunId,
          label: proposal.label, invariantDescription: proposal.invariantDescription,
          variableSlots: proposal.variableSlots, searchSignals: proposal.searchSignals,
          transferTests: proposal.transferTests, counterScenarios: proposal.counterScenarios,
          rationale: proposal.rationale, proposedAt: proposal.proposedAt,
        });
        if (rebuilt.prototypeId !== proposal.prototypeId) {
          throw new Error("mechanism prototype proposal grounding is inconsistent");
        }
        const recordJson = canonicalJson(proposal);
        const recordHash = hashCanonical(proposal);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_prototypes (
             prototype_id, candidate_id, input_revision_id, source_agent_run_id,
             proposed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(prototype_id) DO NOTHING`,
        ).run(proposal.prototypeId, proposal.candidateId, proposal.inputRevisionId,
          proposal.sourceAgentRunId, proposal.proposedAt, recordJson, recordHash);
        const stored = parseWorldStateMechanismPrototypeProposal(this.#database.prepare(
          `SELECT prototype_id, candidate_id, record_json, record_hash
           FROM world_state_mechanism_prototypes WHERE prototype_id = ?`,
        ).get(proposal.prototypeId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("prototypeId is already bound to another proposal");
        }
      }
      this.#database.exec("COMMIT");
      return proposals;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismPrototypeAbstentions(
    limit: number,
  ): readonly WorldStateMechanismPrototypeAbstention[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT abstention_id, candidate_id, record_json, record_hash
       FROM world_state_mechanism_prototype_abstentions
       ORDER BY proposed_at DESC, abstention_id DESC LIMIT ?`,
    ).all(limit).map(parseWorldStateMechanismPrototypeAbstention));
  }

  public saveWorldStateMechanismPrototypeAbstentions(
    values: readonly WorldStateMechanismPrototypeAbstention[],
  ): readonly WorldStateMechanismPrototypeAbstention[] {
    this.#assertOpen();
    const abstentions = Object.freeze(values.map(assertWorldStateMechanismPrototypeAbstention));
    if (new Set(abstentions.map((item) => item.abstentionId)).size !== abstentions.length) {
      throw new Error("mechanism prototype abstention batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const abstention of abstentions) {
        const inputRow = this.#database.prepare(
          `SELECT revision_id, candidate_id, record_json, record_hash
           FROM world_state_mechanism_prototype_inputs WHERE revision_id = ?`,
        ).get(abstention.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(abstention.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("mechanism prototype abstention references unavailable lineage");
        }
        const input = parseWorldStateMechanismPrototypeInput(inputRow);
        if (!this.#worldStateMechanismPrototypeRunMatchesInput(runRow.task_id, input) ||
            input.candidateId !== abstention.candidateId ||
            input.memberRouteFamilyIds.join("\n") !==
              abstention.memberRouteFamilyIds.join("\n")) {
          throw new Error("mechanism prototype abstention is outside its exact input lineage");
        }
        const recordJson = canonicalJson(abstention);
        const recordHash = hashCanonical(abstention);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_prototype_abstentions (
             abstention_id, candidate_id, input_revision_id, source_agent_run_id,
             proposed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(abstention_id) DO NOTHING`,
        ).run(abstention.abstentionId, abstention.candidateId,
          abstention.inputRevisionId, abstention.sourceAgentRunId,
          abstention.proposedAt, recordJson, recordHash);
        const stored = parseWorldStateMechanismPrototypeAbstention(this.#database.prepare(
          `SELECT abstention_id, candidate_id, record_json, record_hash
           FROM world_state_mechanism_prototype_abstentions WHERE abstention_id = ?`,
        ).get(abstention.abstentionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("abstentionId is already bound to another mechanism prototype abstention");
        }
      }
      this.#database.exec("COMMIT");
      return abstentions;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationInputs(
    limit: number,
  ): readonly MechanismPrototypeExplorationInputRevision[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT input_revision_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_inputs
       ORDER BY materialized_at DESC, input_revision_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationInput));
  }

  public saveMechanismPrototypeExplorationInputs(
    values: readonly MechanismPrototypeExplorationInputRevision[],
  ): readonly MechanismPrototypeExplorationInputRevision[] {
    this.#assertOpen();
    const inputs = Object.freeze(values.map(assertMechanismPrototypeExplorationInputRevision));
    if (new Set(inputs.map((item) => item.inputRevisionId)).size !== inputs.length) {
      throw new Error("mechanism exploration input batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const input of inputs) {
        if (this.#database.prepare(
          `SELECT prototype_id FROM world_state_mechanism_prototypes
           WHERE prototype_id = ?`,
        ).get(input.prototypeId) === undefined) {
          throw new Error("mechanism exploration input prototype is unavailable");
        }
        const recordJson = canonicalJson(input);
        const recordHash = hashCanonical(input);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_inputs (
             input_revision_id, lens_id, prototype_id, semantic_input_identity,
             corpus_snapshot_identity, materialized_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(input_revision_id) DO NOTHING`,
        ).run(input.inputRevisionId, input.lensId, input.prototypeId,
          input.semanticInputIdentity, input.corpusSnapshotIdentity, input.materializedAt,
          recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationInput(this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(input.inputRevisionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("inputRevisionId is already bound to another exploration input");
        }
      }
      this.#database.exec("COMMIT");
      return inputs;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationTrailheads(
    limit: number,
  ): readonly MechanismPrototypeExplorationTrailhead[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT trailhead_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_trailheads
       ORDER BY proposed_at DESC, trailhead_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationTrailhead));
  }

  public saveMechanismPrototypeExplorationTrailheads(
    values: readonly MechanismPrototypeExplorationTrailhead[],
  ): readonly MechanismPrototypeExplorationTrailhead[] {
    this.#assertOpen();
    const trailheads = Object.freeze(values.map(assertMechanismPrototypeExplorationTrailhead));
    if (new Set(trailheads.map((item) => item.trailheadId)).size !== trailheads.length) {
      throw new Error("mechanism exploration trailhead batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const trailhead of trailheads) {
        const inputRow = this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(trailhead.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(trailhead.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("mechanism exploration trailhead references unavailable lineage");
        }
        const input = parseMechanismPrototypeExplorationInput(inputRow);
        if (!this.#mechanismPrototypeExplorationRunMatchesInput(runRow.task_id, input) ||
            input.lensId !== trailhead.lensId || input.prototypeId !== trailhead.prototypeId ||
            input.semanticInputIdentity !== trailhead.semanticInputIdentity ||
            input.axis !== trailhead.axis) {
          throw new Error("mechanism exploration trailhead is outside its exact input lineage");
        }
        const recordJson = canonicalJson(trailhead);
        const recordHash = hashCanonical(trailhead);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_trailheads (
             trailhead_id, lens_id, input_revision_id, source_agent_run_id,
             proposed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(trailhead_id) DO NOTHING`,
        ).run(trailhead.trailheadId, trailhead.lensId, trailhead.inputRevisionId,
          trailhead.sourceAgentRunId, trailhead.proposedAt, recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationTrailhead(this.#database.prepare(
          `SELECT trailhead_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_trailheads WHERE trailhead_id = ?`,
        ).get(trailhead.trailheadId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("trailheadId is already bound to another exploration result");
        }
      }
      this.#database.exec("COMMIT");
      return trailheads;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationExhaustions(
    limit: number,
  ): readonly MechanismPrototypeExplorationExhaustion[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT exhaustion_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_exhaustions
       ORDER BY proposed_at DESC, exhaustion_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationExhaustion));
  }

  public saveMechanismPrototypeExplorationExhaustions(
    values: readonly MechanismPrototypeExplorationExhaustion[],
  ): readonly MechanismPrototypeExplorationExhaustion[] {
    this.#assertOpen();
    const exhaustions = Object.freeze(values.map(assertMechanismPrototypeExplorationExhaustion));
    if (new Set(exhaustions.map((item) => item.exhaustionId)).size !== exhaustions.length) {
      throw new Error("mechanism exploration exhaustion batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const exhaustion of exhaustions) {
        const inputRow = this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(exhaustion.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(exhaustion.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("mechanism exploration exhaustion references unavailable lineage");
        }
        const input = parseMechanismPrototypeExplorationInput(inputRow);
        if (!this.#mechanismPrototypeExplorationRunMatchesInput(runRow.task_id, input) ||
            input.lensId !== exhaustion.lensId || input.prototypeId !== exhaustion.prototypeId ||
            input.semanticInputIdentity !== exhaustion.semanticInputIdentity ||
            input.axis !== exhaustion.axis) {
          throw new Error("mechanism exploration exhaustion is outside its exact input lineage");
        }
        const recordJson = canonicalJson(exhaustion);
        const recordHash = hashCanonical(exhaustion);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_exhaustions (
             exhaustion_id, lens_id, input_revision_id, source_agent_run_id,
             proposed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(exhaustion_id) DO NOTHING`,
        ).run(exhaustion.exhaustionId, exhaustion.lensId, exhaustion.inputRevisionId,
          exhaustion.sourceAgentRunId, exhaustion.proposedAt, recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationExhaustion(this.#database.prepare(
          `SELECT exhaustion_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_exhaustions WHERE exhaustion_id = ?`,
        ).get(exhaustion.exhaustionId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("exhaustionId is already bound to another exploration result");
        }
      }
      this.#database.exec("COMMIT");
      return exhaustions;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationRoleSearchObservations(
    limit: number,
  ): readonly MechanismPrototypeExplorationRoleSearchObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT observation_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_role_search_observations
       ORDER BY captured_at DESC, observation_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationRoleSearchObservation));
  }

  public saveMechanismPrototypeExplorationRoleSearchObservations(
    values: readonly MechanismPrototypeExplorationRoleSearchObservation[],
  ): readonly MechanismPrototypeExplorationRoleSearchObservation[] {
    this.#assertOpen();
    const observations = Object.freeze(values
      .map(assertMechanismPrototypeExplorationRoleSearchObservation));
    if (new Set(observations.map((item) => item.observationId)).size !==
        observations.length) {
      throw new Error("mechanism exploration role-search batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const observation of observations) {
        const inputRow = this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(observation.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(observation.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("mechanism exploration role-search references unavailable lineage");
        }
        const input = parseMechanismPrototypeExplorationInput(inputRow);
        if (!this.#mechanismPrototypeExplorationRunMatchesInput(runRow.task_id, input) ||
            input.lensId !== observation.lensId ||
            input.prototypeId !== observation.prototypeId ||
            input.semanticInputIdentity !== observation.semanticInputIdentity ||
            input.axis !== observation.axis ||
            input.corpusSnapshotIdentity !== observation.result.snapshotIdentity) {
          throw new Error("mechanism exploration role-search is outside its exact input lineage");
        }
        const recordJson = canonicalJson(observation);
        const recordHash = hashCanonical(observation);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_role_search_observations (
             observation_id, lens_id, input_revision_id, source_agent_run_id,
             captured_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        ).run(observation.observationId, observation.lensId, observation.inputRevisionId,
          observation.sourceAgentRunId, observation.capturedAt, recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationRoleSearchObservation(
          this.#database.prepare(
            `SELECT observation_id, lens_id, record_json, record_hash
             FROM mechanism_prototype_exploration_role_search_observations
             WHERE observation_id = ?`,
          ).get(observation.observationId),
        );
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("observationId is already bound to another role-search observation");
        }
      }
      this.#database.exec("COMMIT");
      return observations;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationFlatSearchObservations(
    limit: number,
  ): readonly MechanismPrototypeExplorationFlatSearchObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT observation_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_flat_search_observations
       ORDER BY captured_at DESC, observation_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationFlatSearchObservation));
  }

  public saveMechanismPrototypeExplorationFlatSearchObservations(
    values: readonly MechanismPrototypeExplorationFlatSearchObservation[],
  ): readonly MechanismPrototypeExplorationFlatSearchObservation[] {
    this.#assertOpen();
    const observations = Object.freeze(values
      .map(assertMechanismPrototypeExplorationFlatSearchObservation));
    if (new Set(observations.map((item) => item.observationId)).size !==
        observations.length) {
      throw new Error("mechanism exploration flat-search batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const observation of observations) {
        const inputRow = this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(observation.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(observation.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        if (inputRow === undefined || typeof runRow?.task_id !== "string") {
          throw new Error("mechanism exploration flat-search references unavailable lineage");
        }
        const input = parseMechanismPrototypeExplorationInput(inputRow);
        if (!this.#mechanismPrototypeExplorationRunMatchesInput(runRow.task_id, input) ||
            input.lensId !== observation.lensId ||
            input.prototypeId !== observation.prototypeId ||
            input.semanticInputIdentity !== observation.semanticInputIdentity ||
            input.axis !== observation.axis ||
            input.corpusSnapshotIdentity !== observation.result.snapshotIdentity) {
          throw new Error("mechanism exploration flat-search is outside its exact input lineage");
        }
        const recordJson = canonicalJson(observation);
        const recordHash = hashCanonical(observation);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_flat_search_observations (
             observation_id, lens_id, input_revision_id, source_agent_run_id,
             captured_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        ).run(observation.observationId, observation.lensId, observation.inputRevisionId,
          observation.sourceAgentRunId, observation.capturedAt, recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationFlatSearchObservation(
          this.#database.prepare(
            `SELECT observation_id, lens_id, record_json, record_hash
             FROM mechanism_prototype_exploration_flat_search_observations
             WHERE observation_id = ?`,
          ).get(observation.observationId),
        );
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("observationId is already bound to another flat-search observation");
        }
      }
      this.#database.exec("COMMIT");
      return observations;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationActionObservations(
    limit: number,
  ): readonly MechanismPrototypeExplorationActionObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT observation_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_action_observations
       ORDER BY captured_at DESC, observation_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationActionObservation));
  }

  public saveMechanismPrototypeExplorationActionObservations(
    values: readonly MechanismPrototypeExplorationActionObservation[],
  ): readonly MechanismPrototypeExplorationActionObservation[] {
    this.#assertOpen();
    const observations = Object.freeze(values
      .map(assertMechanismPrototypeExplorationActionObservation));
    if (new Set(observations.map((item) => item.observationId)).size !==
        observations.length) {
      throw new Error("mechanism exploration action batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const observation of observations) {
        const inputRow = this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(observation.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(observation.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        const prototypeRow = this.#database.prepare(
          `SELECT prototype_id, candidate_id, record_json, record_hash
           FROM world_state_mechanism_prototypes WHERE prototype_id = ?`,
        ).get(observation.prototypeId);
        if (inputRow === undefined || typeof runRow?.task_id !== "string" ||
            prototypeRow === undefined) {
          throw new Error("mechanism exploration action references unavailable lineage");
        }
        const input = parseMechanismPrototypeExplorationInput(inputRow);
        const prototype = parseWorldStateMechanismPrototypeProposal(prototypeRow);
        const expectedText = observation.action === "COUNTER_SCENARIO_ACTIVATED"
          ? prototype.counterScenarios[observation.ordinal - 1]
          : prototype.transferTests[observation.ordinal - 1];
        if (!this.#mechanismPrototypeExplorationRunMatchesInput(runRow.task_id, input) ||
            input.lensId !== observation.lensId ||
            input.prototypeId !== observation.prototypeId ||
            input.semanticInputIdentity !== observation.semanticInputIdentity ||
            input.axis !== observation.axis || expectedText !== observation.exactText) {
          throw new Error("mechanism exploration action is outside its exact input lineage");
        }
        const recordJson = canonicalJson(observation);
        const recordHash = hashCanonical(observation);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_action_observations (
             observation_id, lens_id, input_revision_id, source_agent_run_id,
             captured_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        ).run(observation.observationId, observation.lensId, observation.inputRevisionId,
          observation.sourceAgentRunId, observation.capturedAt, recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationActionObservation(
          this.#database.prepare(
            `SELECT observation_id, lens_id, record_json, record_hash
             FROM mechanism_prototype_exploration_action_observations
             WHERE observation_id = ?`,
          ).get(observation.observationId),
        );
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("observationId is already bound to another exploration action");
        }
      }
      this.#database.exec("COMMIT");
      return observations;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadMechanismPrototypeExplorationStepObservations(
    limit: number,
  ): readonly MechanismPrototypeExplorationStepObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    return Object.freeze(this.#database.prepare(
      `SELECT observation_id, lens_id, record_json, record_hash
       FROM mechanism_prototype_exploration_step_observations
       ORDER BY observed_at DESC, observation_id DESC LIMIT ?`,
    ).all(limit).map(parseMechanismPrototypeExplorationStepObservation));
  }

  public saveMechanismPrototypeExplorationStepObservations(
    values: readonly MechanismPrototypeExplorationStepObservation[],
  ): readonly MechanismPrototypeExplorationStepObservation[] {
    this.#assertOpen();
    const observations = Object.freeze(values
      .map(assertMechanismPrototypeExplorationStepObservation));
    if (new Set(observations.map((item) => item.observationId)).size !==
        observations.length) {
      throw new Error("mechanism exploration step batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const observation of observations) {
        const inputRow = this.#database.prepare(
          `SELECT input_revision_id, lens_id, record_json, record_hash
           FROM mechanism_prototype_exploration_inputs WHERE input_revision_id = ?`,
        ).get(observation.inputRevisionId);
        const runRow = this.#database.prepare(
          "SELECT task_id FROM agent_runs WHERE run_id = ?",
        ).get(observation.sourceAgentRunId) as Readonly<{ task_id?: unknown }> | undefined;
        const invocationRow = this.#database.prepare(
          `SELECT run_id FROM model_invocations WHERE invocation_id = ?`,
        ).get(observation.sourceInvocationId) as Readonly<{ run_id?: unknown }> | undefined;
        const effectRow = this.#database.prepare(
          `SELECT effect_id, run_id, ordinal, status, record_json, record_hash
           FROM agent_tool_effects WHERE effect_id = ?`,
        ).get(observation.sourceEffectId) as Readonly<Record<string, unknown>> | undefined;
        const effect = effectRow === undefined
          ? null
          : parseAgentExecutionRecord(
              Object.freeze({
                record_id: effectRow.effect_id,
                record_json: effectRow.record_json,
                record_hash: effectRow.record_hash,
              }),
              (record: AgentToolEffect) => record.effectId,
              assertAgentToolEffect,
              "Agent tool effect",
            );
        if (inputRow === undefined || typeof runRow?.task_id !== "string" ||
            invocationRow?.run_id !== observation.sourceAgentRunId ||
            effect?.runId !== observation.sourceAgentRunId ||
            effect.ordinal !== observation.effectOrdinal ||
            effect.toolName !== observation.toolName ||
            effect.status !== observation.status ||
            effect.schemaVersion !== "pmh.agent-tool-effect.v3" ||
            effect.sourceInvocationId !== observation.sourceInvocationId) {
          throw new Error("mechanism exploration step references unavailable effect lineage");
        }
        const input = parseMechanismPrototypeExplorationInput(inputRow);
        if (!this.#mechanismPrototypeExplorationRunMatchesInput(runRow.task_id, input) ||
            input.lensId !== observation.lensId ||
            input.prototypeId !== observation.prototypeId ||
            input.semanticInputIdentity !== observation.semanticInputIdentity ||
            input.axis !== observation.axis) {
          throw new Error("mechanism exploration step is outside its exact input lineage");
        }
        const recordJson = canonicalJson(observation);
        const recordHash = hashCanonical(observation);
        this.#database.prepare(
          `INSERT INTO mechanism_prototype_exploration_step_observations (
             observation_id, lens_id, input_revision_id, source_agent_run_id,
             source_invocation_id, source_effect_id, effect_ordinal, observed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        ).run(observation.observationId, observation.lensId, observation.inputRevisionId,
          observation.sourceAgentRunId, observation.sourceInvocationId,
          observation.sourceEffectId, observation.effectOrdinal, observation.observedAt,
          recordJson, recordHash);
        const stored = parseMechanismPrototypeExplorationStepObservation(
          this.#database.prepare(
            `SELECT observation_id, lens_id, record_json, record_hash
             FROM mechanism_prototype_exploration_step_observations
             WHERE observation_id = ?`,
          ).get(observation.observationId),
        );
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("observationId is already bound to another exploration step");
        }
      }
      this.#database.exec("COMMIT");
      return observations;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public saveWorldStateMechanismSubjectBindingReviews(
    reviewsInput: readonly WorldStateMechanismSubjectBindingReview[],
  ): readonly WorldStateMechanismSubjectBindingReview[] {
    this.#assertOpen();
    const reviews = Object.freeze(reviewsInput
      .map(assertWorldStateMechanismSubjectBindingReview));
    if (new Set(reviews.map((item) => item.reviewId)).size !== reviews.length) {
      throw new Error("world-state mechanism subject review batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const review of reviews) {
        for (const proposalId of review.sourceProposalIds) {
          const proposalRow = this.#database.prepare(
            `SELECT proposal_id, route_family_id, record_json, record_hash
             FROM world_state_mechanism_proposals WHERE proposal_id = ?`,
          ).get(proposalId);
          if (proposalRow === undefined ||
              worldStateMechanismRouteFamilyIdentity(
                parseWorldStateMechanismProposal(proposalRow),
              ) !== review.routeFamilyId) {
            throw new Error(
              "world-state mechanism subject review target is unavailable or inconsistent",
            );
          }
        }
        const recordJson = canonicalJson(review);
        const recordHash = hashCanonical(review);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_subject_reviews (
             review_id, route_family_id, decision, reviewed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(review_id) DO NOTHING`,
        ).run(
          review.reviewId,
          review.routeFamilyId,
          review.decision,
          review.reviewedAt,
          recordJson,
          recordHash,
        );
        const stored = parseWorldStateMechanismSubjectBindingReview(this.#database.prepare(
          `SELECT review_id, route_family_id, record_json, record_hash
           FROM world_state_mechanism_subject_reviews WHERE review_id = ?`,
        ).get(review.reviewId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("reviewId is already bound to another subject binding review");
        }
      }
      this.#database.exec("COMMIT");
      return reviews;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismObservations(
    limit: number,
  ): readonly WorldStateMechanismObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT observation_id, route_family_id, membership_identity,
              record_json, record_hash
       FROM world_state_mechanism_observations
       ORDER BY observed_at DESC, observation_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldStateMechanismObservation));
  }

  public saveWorldStateMechanismObservations(
    observationsInput: readonly WorldStateMechanismObservation[],
  ): readonly WorldStateMechanismObservation[] {
    this.#assertOpen();
    const observations = Object.freeze(observationsInput
      .map(assertWorldStateMechanismObservation));
    if (new Set(observations.map((item) => item.observationId)).size !==
        observations.length) {
      throw new Error("world-state mechanism observation batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const observation of observations) {
        if (this.#database.prepare(
          `SELECT proposal_id FROM world_state_mechanism_proposals
           WHERE route_family_id = ? LIMIT 1`,
        ).get(observation.routeFamilyId) === undefined) {
          throw new Error("world-state mechanism observation route is unavailable");
        }
        if (observation.subjectBindingReviewId !== null && this.#database.prepare(
          `SELECT review_id FROM world_state_mechanism_subject_reviews
           WHERE review_id = ? AND route_family_id = ?`,
        ).get(observation.subjectBindingReviewId, observation.routeFamilyId) === undefined) {
          throw new Error("world-state mechanism observation subject review is unavailable");
        }
        const recordJson = canonicalJson(observation);
        const recordHash = hashCanonical(observation);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_observations (
             observation_id, route_family_id, membership_identity,
             source_snapshot_identity, subject_binding_review_id,
             status, observed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(observation_id) DO NOTHING`,
        ).run(
          observation.observationId,
          observation.routeFamilyId,
          observation.membershipIdentity,
          observation.sourceSnapshotIdentity,
          observation.subjectBindingReviewId,
          observation.status,
          observation.observedAt,
          recordJson,
          recordHash,
        );
        const stored = parseWorldStateMechanismObservation(this.#database.prepare(
          `SELECT observation_id, route_family_id, membership_identity,
                  record_json, record_hash
           FROM world_state_mechanism_observations WHERE observation_id = ?`,
        ).get(observation.observationId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("observationId is already bound to another mechanism observation");
        }
      }
      this.#database.exec("COMMIT");
      return observations;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldStateMechanismWakes(
    limit: number,
  ): readonly WorldStateMechanismWake[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT wake_id, route_family_id, work_item_id, record_json, record_hash
       FROM world_state_mechanism_wakes
       ORDER BY observed_at DESC, wake_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldStateMechanismWake));
  }

  public saveWorldStateMechanismWakes(
    wakesInput: readonly WorldStateMechanismWake[],
  ): readonly WorldStateMechanismWake[] {
    this.#assertOpen();
    const wakes = Object.freeze(wakesInput.map(assertWorldStateMechanismWake));
    if (new Set(wakes.map((item) => item.wakeId)).size !== wakes.length) {
      throw new Error("world-state mechanism wake batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const wake of wakes) {
        for (const observationId of [
          wake.previousObservationId,
          wake.currentObservationId,
        ]) {
          if (this.#database.prepare(
            `SELECT observation_id FROM world_state_mechanism_observations
             WHERE observation_id = ? AND route_family_id = ?`,
          ).get(observationId, wake.routeFamilyId) === undefined) {
            throw new Error("world-state mechanism wake observation is unavailable");
          }
        }
        const recordJson = canonicalJson(wake);
        const recordHash = hashCanonical(wake);
        this.#database.prepare(
          `INSERT INTO world_state_mechanism_wakes (
             wake_id, route_family_id, previous_observation_id,
             current_observation_id, work_item_id, observed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(wake_id) DO NOTHING`,
        ).run(
          wake.wakeId,
          wake.routeFamilyId,
          wake.previousObservationId,
          wake.currentObservationId,
          wake.workItem.workItemId,
          wake.observedAt,
          recordJson,
          recordHash,
        );
        const stored = parseWorldStateMechanismWake(this.#database.prepare(
          `SELECT wake_id, route_family_id, work_item_id, record_json, record_hash
           FROM world_state_mechanism_wakes WHERE wake_id = ?`,
        ).get(wake.wakeId));
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("wakeId is already bound to another mechanism wake");
        }
      }
      this.#database.exec("COMMIT");
      return wakes;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadOntologySearchIssueRevisions(
    limit: number,
  ): readonly OntologySearchIssueRevision[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT revision_id, record_json, record_hash
       FROM ontology_search_issue_revisions
       ORDER BY materialized_at DESC, revision_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseOntologySearchIssueRevision));
  }

  public loadOntologySearchIssueRevision(
    revisionId: Hash,
  ): OntologySearchIssueRevision | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      `SELECT revision_id, record_json, record_hash
       FROM ontology_search_issue_revisions
       WHERE revision_id = ?`,
    ).get(revisionId);
    return row === undefined ? null : parseOntologySearchIssueRevision(row);
  }

  public saveOntologySearchIssueRevisions(
    revisionsInput: readonly OntologySearchIssueRevision[],
  ): readonly OntologySearchIssueRevision[] {
    this.#assertOpen();
    const revisions = Object.freeze(revisionsInput.map(assertOntologySearchIssueRevision));
    if (new Set(revisions.map((item) => item.revisionId)).size !== revisions.length) {
      throw new Error("ontology search issue revision batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const revision of revisions) {
        if (this.#database.prepare(
          "SELECT task_id FROM agent_tasks WHERE task_id = ?",
        ).get(revision.task.taskId) === undefined) {
          throw new Error("ontology search issue revision references an unavailable task");
        }
        const recordJson = canonicalJson(revision);
        const recordHash = hashCanonical(revision);
        this.#database.prepare(
          `INSERT INTO ontology_search_issue_revisions (
             revision_id, issue_id, relation_pattern_id, ontology_identity,
             source_snapshot_identity, task_id, materialized_at,
             campaign_eligible, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(revision_id) DO NOTHING`,
        ).run(
          revision.revisionId,
          revision.issueId,
          revision.relationPatternId,
          revision.ontologyIdentity,
          revision.sourceSnapshotIdentity,
          revision.task.taskId,
          revision.materializedAt,
          revision.campaignEligible ? 1 : 0,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT revision_id, record_json, record_hash
           FROM ontology_search_issue_revisions WHERE revision_id = ?`,
        ).get(revision.revisionId);
        const stored = parseOntologySearchIssueRevision(row);
        if (stored.revisionId !== revision.revisionId ||
            hashCanonical(stored) !== recordHash) {
          throw new Error("revisionId is already bound to another ontology search issue");
        }
      }
      this.#database.prepare(
        `DELETE FROM ontology_search_issue_revisions
         WHERE revision_id IN (
           SELECT revision.revision_id
           FROM ontology_search_issue_revisions AS revision
           WHERE NOT EXISTS (
             SELECT 1
             FROM agent_campaigns AS campaign,
                  json_each(campaign.record_json, '$.selectionBinding.taskBindings') AS binding
             WHERE json_extract(binding.value, '$.inputRevisionKind') =
                     'ONTOLOGY_SEARCH_ISSUE'
               AND json_extract(binding.value, '$.inputRevisionId') = revision.revision_id
           )
           ORDER BY materialized_at DESC, revision_id DESC LIMIT -1 OFFSET ?
         )`,
      ).run(MAX_RETAINED_ONTOLOGY_SEARCH_REVISIONS);
      this.#database.exec("COMMIT");
      return revisions;
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
         ORDER BY
           CASE status
             WHEN 'PENDING' THEN 0
             WHEN 'LEASED' THEN 0
             WHEN 'RETRY_WAIT' THEN 0
             WHEN 'BLOCKED_EVIDENCE' THEN 0
             ELSE 1
           END,
           priority DESC, next_attempt_at, job_id
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseSemanticReviewJobRecord));
  }

  public loadSemanticReviewJobRecordsByProposalIds(
    proposalIds: readonly Hash[],
  ): readonly SemanticReviewJobRecord[] {
    this.#assertOpen();
    if (proposalIds.length === 0) return Object.freeze([]);
    if (proposalIds.length > 512 || new Set(proposalIds).size !== proposalIds.length ||
        proposalIds.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(item))) {
      throw new Error("semantic review proposal lineage query is invalid or unbounded");
    }
    const placeholders = proposalIds.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM semantic_review_jobs
         WHERE json_extract(record_json, '$.proposalId') IN (${placeholders})
         ORDER BY updated_at DESC, job_id DESC`,
      )
      .all(...proposalIds);
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

  public loadOfficialSourceDiscoveryJobRecords(
    limit: number,
  ): readonly OfficialSourceDiscoveryJobRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM official_source_discovery_jobs
         ORDER BY updated_at DESC, job_id DESC
         LIMIT ?`,
      )
      .all(limit);
    return Object.freeze(rows.map(parseOfficialSourceDiscoveryJobRecord));
  }

  public loadOfficialSourceDiscoveryJobRecordsByRequirementIds(
    requirementIds: readonly Hash[],
  ): readonly OfficialSourceDiscoveryJobRecord[] {
    this.#assertOpen();
    const ids = Object.freeze([...new Set(requirementIds)].sort());
    if (ids.length > 512 || ids.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(String(item)))) {
      throw new Error("official source requirement lookup is invalid or unbounded");
    }
    if (ids.length === 0) return Object.freeze([]);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM official_source_discovery_jobs
         WHERE EXISTS (
           SELECT 1
           FROM json_each(COALESCE(
             json_extract(record_json, '$.task.requirementIds'),
             json_array(json_extract(record_json, '$.requirementId'))
           )) AS requirement
           WHERE requirement.value IN (${placeholders})
         )
         ORDER BY updated_at DESC, job_id DESC`,
      )
      .all(...ids);
    return Object.freeze(rows.map(parseOfficialSourceDiscoveryJobRecord));
  }

  public saveOfficialSourceDiscoveryJobRecord(
    recordInput: OfficialSourceDiscoveryJobRecord,
    retentionLimit: number,
  ): OfficialSourceDiscoveryJobRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const record = assertOfficialSourceDiscoveryJobRecord(recordInput);
    const recordJson = canonicalJson(record);
    const recordHash = hashCanonical(record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO official_source_discovery_jobs (
             job_id, status, priority_tier, next_attempt_at, updated_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             status = excluded.status,
             priority_tier = excluded.priority_tier,
             next_attempt_at = excluded.next_attempt_at,
             updated_at = excluded.updated_at,
             record_json = excluded.record_json,
             record_hash = excluded.record_hash`,
        )
        .run(
          record.jobId,
          record.status,
          record.priorityTier,
          record.nextAttemptAt,
          record.updatedAt,
          recordJson,
          recordHash,
        );
      this.#database
        .prepare(
          `DELETE FROM official_source_discovery_jobs
           WHERE job_id IN (
             SELECT job_id FROM official_source_discovery_jobs
             ORDER BY updated_at DESC, job_id DESC
             LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const row = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM official_source_discovery_jobs WHERE job_id = ?`,
        )
        .get(record.jobId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain the official source discovery job");
      }
      const stored = parseOfficialSourceDiscoveryJobRecord(row);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("jobId is already bound to another official source discovery job");
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

  public loadEvidenceAcquisitionJobRecordsByRequirementIds(
    requirementIds: readonly Hash[],
  ): readonly EvidenceAcquisitionJobRecord[] {
    this.#assertOpen();
    const ids = Object.freeze([...new Set(requirementIds)].sort());
    if (ids.length > 512 || ids.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(String(item)))) {
      throw new Error("evidence acquisition requirement lookup is invalid or unbounded");
    }
    if (ids.length === 0) return Object.freeze([]);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM evidence_acquisition_jobs
         WHERE EXISTS (
           SELECT 1 FROM json_each(record_json, '$.requirementIds') AS requirement
           WHERE requirement.value IN (${placeholders})
         )
         ORDER BY updated_at DESC, job_id DESC`,
      )
      .all(...ids);
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
         ) AND NOT EXISTS (
           SELECT 1 FROM rule_evidence_claim_records
           WHERE rule_evidence_claim_records.document_id =
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

  public loadRetainedEvidenceDocumentCaptures(): readonly EvidenceDocumentCapture[] {
    this.#assertOpen();
    const observationRows = this.#database
      .prepare(
        `SELECT observation_id, acquisition_job_id, document_id, record_json, record_hash
         FROM evidence_document_observations ORDER BY observation_id ASC`,
      )
      .all();
    const documentRows = this.#database
      .prepare(
        `SELECT document_id, record_json, record_hash, raw_bytes
         FROM evidence_documents ORDER BY document_id ASC`,
      )
      .all();
    const extractionRows = this.#database
      .prepare(
        `SELECT extraction_id, document_id, record_json, record_hash, extracted_text
         FROM evidence_document_texts ORDER BY extraction_id ASC`,
      )
      .all();
    if (observationRows.length > 10_000 || documentRows.length > 10_000 ||
        extractionRows.length > 10_000) {
      throw new Error("retained evidence capture migration input exceeds its batch bound");
    }
    const documents = new Map(documentRows.map((row) => {
      const document = parseEvidenceDocument(row);
      return [document.record.documentId, document] as const;
    }));
    const extractionsByDocument = new Map<Hash, ReturnType<typeof parseEvidenceDocumentText>[]>();
    for (const row of extractionRows) {
      const extraction = parseEvidenceDocumentText(row);
      const retained = extractionsByDocument.get(extraction.record.documentId) ?? [];
      retained.push(extraction);
      extractionsByDocument.set(extraction.record.documentId, retained);
    }
    const captures: EvidenceDocumentCapture[] = [];
    for (const row of observationRows) {
      const stored = parseEvidenceDocumentObservation(row);
      const observation = stored.observation;
      const document = documents.get(observation.documentId);
      if (document === undefined) {
        throw new Error("retained evidence observation lost its document");
      }
      for (const extraction of extractionsByDocument.get(observation.documentId) ?? []) {
        captures.push(assertEvidenceDocumentCapture(Object.freeze({
          status: observation.httpStatus === 304 ? "NOT_MODIFIED" as const : "CAPTURED" as const,
          observation,
          document,
          extraction,
        })));
      }
    }
    return Object.freeze(captures);
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

  public loadRuleEvidenceClaimJobRecordsByRequirementIds(
    requirementIds: readonly Hash[],
  ): readonly RuleEvidenceClaimJobRecord[] {
    this.#assertOpen();
    const ids = Object.freeze([...new Set(requirementIds)].sort());
    if (ids.length > 512 || ids.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(String(item)))) {
      throw new Error("rule evidence requirement lookup is invalid or unbounded");
    }
    if (ids.length === 0) return Object.freeze([]);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(
        `SELECT job_id, record_json, record_hash
         FROM rule_evidence_claim_jobs
         WHERE json_extract(record_json, '$.requirementId') IN (${placeholders})
         ORDER BY updated_at DESC, job_id DESC`,
      )
      .all(...ids);
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

  public saveRuleEvidenceClaimJobRecords(
    recordInputs: readonly RuleEvidenceClaimJobRecord[],
    retentionLimit: number,
  ): readonly RuleEvidenceClaimJobRecord[] {
    this.#assertOpen();
    assertLimit(retentionLimit);
    if (recordInputs.length < 1 || recordInputs.length > retentionLimit) {
      throw new Error("SQLite rule evidence claim job batch is empty or unbounded");
    }
    const records = recordInputs.map(assertRuleEvidenceClaimJobRecord);
    if (new Set(records.map((record) => record.jobId)).size !== records.length) {
      throw new Error("SQLite rule evidence claim job batch repeats a job identity");
    }
    const rows = records.map((record) => Object.freeze({
      record,
      recordJson: canonicalJson(record),
      recordHash: hashCanonical(record),
    }));
    const upsert = this.#database.prepare(
      `INSERT INTO rule_evidence_claim_jobs (
         job_id, status, next_attempt_at, updated_at, record_json, record_hash
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(job_id) DO UPDATE SET
         status = excluded.status,
         next_attempt_at = excluded.next_attempt_at,
         updated_at = excluded.updated_at,
         record_json = excluded.record_json,
         record_hash = excluded.record_hash`,
    );
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const { record, recordJson, recordHash } of rows) {
        upsert.run(
          record.jobId,
          record.status,
          record.nextAttemptAt,
          record.updatedAt,
          recordJson,
          recordHash,
        );
      }
      this.#database
        .prepare(
          `DELETE FROM rule_evidence_claim_jobs
           WHERE job_id IN (
             SELECT job_id FROM rule_evidence_claim_jobs
             ORDER BY updated_at DESC, job_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(retentionLimit);
      const retained = this.#database
        .prepare(
          `SELECT job_id, record_json, record_hash
           FROM rule_evidence_claim_jobs
           ORDER BY updated_at DESC, job_id DESC LIMIT ?`,
        )
        .all(retentionLimit)
        .map(parseRuleEvidenceClaimJobRecord);
      const retainedById = new Map(retained.map((record) => [record.jobId, record] as const));
      for (const { record, recordHash } of rows) {
        const stored = retainedById.get(record.jobId);
        if (stored === undefined || hashCanonical(stored) !== recordHash) {
          throw new Error("SQLite rule evidence claim job batch changed during persistence");
        }
      }
      this.#database.exec("COMMIT");
      return Object.freeze(retained);
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  #verifyRuleEvidenceClaimExtraction(record: RuleEvidenceClaimRecord): void {
    if (isCatalogRuleEvidenceClaimRecord(record)) {
      throw new Error("catalog rule evidence claim requires catalog verification");
    }
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
    if (isCatalogRuleEvidenceClaim(record.claim)) {
      throw new Error("catalog rule evidence claim is stored in the wrong table");
    }
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
    if (isCatalogRuleEvidenceClaimRecord(record)) {
      throw new Error("catalog rule evidence claim requires its dedicated store");
    }
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
        isCatalogRuleEvidenceClaimRecord(stored) ||
        isCatalogRuleEvidenceClaimRecord(record)
      ) {
        throw new Error("catalog rule evidence claim is stored in the wrong table");
      }
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

  #verifyCatalogRuleEvidenceClaim(
    record: CatalogRuleEvidenceClaimRecord,
  ): void {
    const row = this.#database.prepare(
      `SELECT artifact_id, catalog_observation_id, record_json, record_hash
       FROM catalog_contract_text_evidence WHERE artifact_id = ?`,
    ).get(record.sourceArtifactId);
    if (row === undefined) {
      throw new Error("SQLite catalog rule evidence claim lost its text artifact");
    }
    const evidence = parseCatalogContractTextEvidence(row);
    if (record.textArtifactId !== evidence.textHash) {
      throw new Error("SQLite catalog rule evidence claim text identity is inconsistent");
    }
    if (record.claim === null) return;
    if (record.claim.schemaVersion === "pmh.rule-evidence-claim.v4") {
      const continuityRow = this.#database.prepare(
        `SELECT continuity_id, record_json, record_hash
         FROM contract_semantic_continuities WHERE continuity_id = ?`,
      ).get(record.claim.continuityId);
      if (continuityRow === undefined) {
        throw new Error("SQLite catalog rule evidence claim lost its continuity artifact");
      }
      const continuity = parseContractSemanticContinuity(continuityRow);
      if (
        continuity.currentCatalogTextArtifactId !== record.sourceArtifactId ||
        continuity.contractSemanticIdentity !== record.claim.contractSemanticIdentity ||
        continuity.rulesTextHash !== record.textArtifactId
      ) throw new Error("SQLite catalog rule evidence continuity lineage mismatch");
    }
    if (
      record.claim.sourceRawHash !== evidence.sourceRawHash ||
      record.claim.textHash !== evidence.textHash ||
      record.claim.listingRef !== evidence.listingRef ||
      record.claim.observationId !== evidence.catalogObservationId ||
      record.claim.citations.some((citation) =>
        evidence.text.slice(citation.start, citation.end) !== citation.quote
      )
    ) throw new Error("SQLite catalog rule evidence citation lineage mismatch");
  }

  public loadCatalogRuleEvidenceClaimRecords(
    limit: number,
  ): readonly CatalogRuleEvidenceClaimRecord[] {
    this.#assertOpen();
    assertLimit(limit);
    const records = this.#database.prepare(
      `SELECT interpretation_id, requirement_id, source_artifact_id,
              text_artifact_id, record_json, record_hash
       FROM catalog_rule_evidence_claim_records
       ORDER BY completed_at DESC, interpretation_id DESC LIMIT ?`,
    ).all(limit).map(parseCatalogRuleEvidenceClaimRecord);
    for (const record of records) this.#verifyCatalogRuleEvidenceClaim(record);
    return Object.freeze(records);
  }

  public saveCatalogRuleEvidenceClaimRecord(
    recordInput: CatalogRuleEvidenceClaimRecord,
    retentionLimit: number,
  ): CatalogRuleEvidenceClaimRecord {
    this.#assertOpen();
    assertLimit(retentionLimit);
    const record = assertRuleEvidenceClaimRecord(recordInput);
    if (
      !isCatalogRuleEvidenceClaimRecord(record) ||
      record.status === "RUNNING" || record.completedAt === null
    ) throw new Error("SQLite cannot persist this catalog rule evidence claim");
    this.#verifyCatalogRuleEvidenceClaim(record);
    const recordJson = canonicalJson(record);
    const recordHash = hashCanonical(record);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(
        `INSERT INTO catalog_rule_evidence_claim_records (
           interpretation_id, requirement_id, source_artifact_id,
           text_artifact_id, status, completed_at, record_json, record_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(interpretation_id) DO UPDATE SET
           status = excluded.status,
           completed_at = excluded.completed_at,
           record_json = excluded.record_json,
           record_hash = excluded.record_hash
         WHERE catalog_rule_evidence_claim_records.status = 'FAILED'`,
      ).run(
        record.interpretationId,
        record.requirementId,
        record.sourceArtifactId,
        record.textArtifactId,
        record.status,
        record.completedAt,
        recordJson,
        recordHash,
      );
      this.#database.prepare(
        `DELETE FROM catalog_rule_evidence_claim_records
         WHERE interpretation_id IN (
           SELECT interpretation_id FROM catalog_rule_evidence_claim_records
           ORDER BY completed_at DESC, interpretation_id DESC LIMIT -1 OFFSET ?
         )`,
      ).run(retentionLimit);
      const row = this.#database.prepare(
        `SELECT interpretation_id, requirement_id, source_artifact_id,
                text_artifact_id, record_json, record_hash
         FROM catalog_rule_evidence_claim_records WHERE interpretation_id = ?`,
      ).get(record.interpretationId);
      if (row === undefined) {
        throw new Error("SQLite failed to retain catalog rule evidence claim");
      }
      const stored = parseCatalogRuleEvidenceClaimRecord(row);
      this.#verifyCatalogRuleEvidenceClaim(stored);
      if (hashCanonical(stored) !== recordHash) {
        throw new Error("SQLite catalog rule evidence claim identity is already bound");
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

  public loadRelationDiscoveryTaskRevisions(
    limit: number,
  ): readonly RelationDiscoveryTaskRevision[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT revision_id, record_json, record_hash
       FROM relation_discovery_task_revisions
       ORDER BY materialized_at DESC, revision_id DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseRelationDiscoveryTaskRevision));
  }

  public loadRelationDiscoveryTaskRevisionsForTaskIds(
    taskIdsInput: readonly Hash[],
  ): readonly RelationDiscoveryTaskRevision[] {
    this.#assertOpen();
    const taskIds = [...new Set(taskIdsInput)].sort();
    if (taskIds.some((taskId) => !/^sha256:[0-9a-f]{64}$/u.test(String(taskId)))) {
      throw new Error("relation discovery task revision lookup contains an invalid task id");
    }
    const statement = this.#database.prepare(
      `SELECT revision_id, record_json, record_hash
       FROM relation_discovery_task_revisions
       WHERE task_id = ?
       ORDER BY materialized_at DESC, revision_id DESC`,
    );
    const revisions = taskIds.flatMap((taskId) =>
      statement.all(taskId).map(parseRelationDiscoveryTaskRevision)
    );
    return Object.freeze([...new Map(revisions.map((item) =>
      [item.revisionId, item] as const
    )).values()].sort((left, right) =>
      right.materializedAt.localeCompare(left.materializedAt) ||
      right.revisionId.localeCompare(left.revisionId)
    ));
  }

  public loadRelationDiscoveryTaskRevision(
    revisionId: Hash,
  ): RelationDiscoveryTaskRevision | null {
    this.#assertOpen();
    if (!/^sha256:[0-9a-f]{64}$/u.test(String(revisionId))) {
      throw new Error("relation discovery task revision lookup contains an invalid revision id");
    }
    const row = this.#database.prepare(
      `SELECT revision_id, record_json, record_hash
       FROM relation_discovery_task_revisions
       WHERE revision_id = ?`,
    ).get(revisionId);
    return row === undefined ? null : parseRelationDiscoveryTaskRevision(row);
  }

  public loadRelationDiscoveryCorpus(snapshotIdentity: Hash): MarketCorpusSnapshot | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      `SELECT snapshot_identity, record_json, record_hash
       FROM relation_discovery_corpora WHERE snapshot_identity = ?`,
    ).get(snapshotIdentity);
    return row === undefined ? null : parseRelationDiscoveryCorpus(row);
  }

  public saveRelationDiscoveryCorpus(corpusInput: MarketCorpusSnapshot): MarketCorpusSnapshot {
    this.#assertOpen();
    const corpus = assertMarketCorpusSnapshot(corpusInput);
    const recordJson = canonicalJson(corpus);
    const recordHash = hashCanonical(corpus);
    const retainedAt = [...corpus.listings]
      .map((item) => item.sourceReceivedAt)
      .sort()
      .at(-1) ?? "1970-01-01T00:00:00.000Z";
    this.#database.prepare(
      `INSERT INTO relation_discovery_corpora (
         snapshot_identity, source_set_identity, listing_count, retained_at,
         record_json, record_hash
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(snapshot_identity) DO NOTHING`,
    ).run(
      corpus.snapshotIdentity,
      corpus.sourceSetIdentity,
      corpus.listingCount,
      retainedAt,
      recordJson,
      recordHash,
    );
    const row = this.#database.prepare(
      `SELECT snapshot_identity, record_json, record_hash
       FROM relation_discovery_corpora WHERE snapshot_identity = ?`,
    ).get(corpus.snapshotIdentity);
    const stored = parseRelationDiscoveryCorpus(row);
    if (hashCanonical(stored) !== recordHash) {
      throw new Error("snapshotIdentity is already bound to another relation discovery corpus");
    }
    return stored;
  }

  public saveRelationDiscoveryTaskRevisions(
    revisionsInput: readonly RelationDiscoveryTaskRevision[],
  ): readonly RelationDiscoveryTaskRevision[] {
    this.#assertOpen();
    const revisions = Object.freeze(revisionsInput.map(assertRelationDiscoveryTaskRevision));
    if (new Set(revisions.map((item) => item.revisionId)).size !== revisions.length) {
      throw new Error("relation discovery task revision batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const revision of revisions) {
        if (this.#database.prepare(
          "SELECT task_id FROM agent_tasks WHERE task_id = ?",
        ).get(revision.task.taskId) === undefined) {
          throw new Error("relation discovery task revision references an unavailable task");
        }
        const recordJson = canonicalJson(revision);
        const recordHash = hashCanonical(revision);
        this.#database.prepare(
          `INSERT INTO relation_discovery_task_revisions (
             revision_id, work_item_id, work_artifact_hash,
             source_corpus_snapshot_identity, task_id, materialized_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(revision_id) DO NOTHING`,
        ).run(
          revision.revisionId,
          revision.workItemId,
          revision.workArtifactHash,
          revision.sourceCorpusSnapshotIdentity,
          revision.task.taskId,
          revision.materializedAt,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT revision_id, record_json, record_hash
           FROM relation_discovery_task_revisions WHERE revision_id = ?`,
        ).get(revision.revisionId);
        const stored = parseRelationDiscoveryTaskRevision(row);
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("revisionId is already bound to another relation discovery task");
        }
      }
      this.#database.exec("COMMIT");
      return revisions;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadRelationDiscoveryFindings(limit: number): readonly RelationDiscoveryFinding[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT finding_id, record_json, record_hash
       FROM relation_discovery_findings
       ORDER BY recorded_at DESC, finding_id DESC
       LIMIT ?`,
    ).all(limit);
    const corpusByIdentity = new Map<Hash, MarketCorpusSnapshot>();
    return Object.freeze(rows.map((row) => {
      const finding = parseRelationDiscoveryFinding(row);
      let corpus = corpusByIdentity.get(finding.sourceCorpusSnapshotIdentity) ?? null;
      if (corpus === null) {
        corpus = this.loadRelationDiscoveryCorpus(finding.sourceCorpusSnapshotIdentity);
        if (corpus !== null) {
          corpusByIdentity.set(finding.sourceCorpusSnapshotIdentity, corpus);
        }
      }
      if (corpus === null) {
        throw new Error("SQLite relation discovery finding lost its retained corpus");
      }
      return verifyRelationDiscoveryFindingEvidenceAgainstVerifiedCorpus(finding, corpus);
    }));
  }

  public loadRelationDiscoveryFindingsForAdmission(): readonly RelationDiscoveryFinding[] {
    this.#assertOpen();
    const rows = this.#database.prepare(
      `SELECT finding_id, record_json, record_hash
       FROM relation_discovery_findings
       ORDER BY recorded_at ASC, finding_id ASC`,
    ).all();
    const corpusByIdentity = new Map<Hash, MarketCorpusSnapshot>();
    return Object.freeze(rows.map((row) => {
      const finding = parseRelationDiscoveryFinding(row);
      let corpus = corpusByIdentity.get(finding.sourceCorpusSnapshotIdentity) ?? null;
      if (corpus === null) {
        corpus = this.loadRelationDiscoveryCorpus(finding.sourceCorpusSnapshotIdentity);
        if (corpus !== null) {
          corpusByIdentity.set(finding.sourceCorpusSnapshotIdentity, corpus);
        }
      }
      if (corpus === null) {
        throw new Error("SQLite semantic admission finding lost its retained corpus");
      }
      return verifyRelationDiscoveryFindingEvidenceAgainstVerifiedCorpus(finding, corpus);
    }));
  }

  public loadStandingOntologyRouteSourceFindings(): readonly RelationDiscoveryFinding[] {
    this.#assertOpen();
    const rows = this.#database.prepare(
      `SELECT finding_id, record_json, record_hash
       FROM relation_discovery_findings
       WHERE finding_kind = 'ONTOLOGY_ROUTE'
          OR (finding_kind = 'RELATION_HYPOTHESIS' AND
              json_extract(record_json, '$.relationKind') = 'RELATED')
       ORDER BY recorded_at DESC, finding_id DESC`,
    ).all();
    const corpusByIdentity = new Map<Hash, MarketCorpusSnapshot>();
    return Object.freeze(rows.map((row) => {
      const finding = parseRelationDiscoveryFinding(row);
      let corpus = corpusByIdentity.get(finding.sourceCorpusSnapshotIdentity) ?? null;
      if (corpus === null) {
        corpus = this.loadRelationDiscoveryCorpus(finding.sourceCorpusSnapshotIdentity);
        if (corpus !== null) {
          corpusByIdentity.set(finding.sourceCorpusSnapshotIdentity, corpus);
        }
      }
      if (corpus === null) {
        throw new Error("SQLite standing ontology route source lost its retained corpus");
      }
      return verifyRelationDiscoveryFindingEvidenceAgainstVerifiedCorpus(finding, corpus);
    }));
  }

  public saveRelationDiscoveryFindings(
    findingsInput: readonly RelationDiscoveryFinding[],
  ): readonly RelationDiscoveryFinding[] {
    this.#assertOpen();
    const findings = Object.freeze(findingsInput.map((input) => {
      const finding = assertRelationDiscoveryFinding(input);
      const corpus = this.loadRelationDiscoveryCorpus(finding.sourceCorpusSnapshotIdentity);
      if (corpus === null) {
        throw new Error("relation discovery finding references an unavailable corpus");
      }
      return verifyRelationDiscoveryFindingEvidence(finding, corpus);
    }));
    if (new Set(findings.map((item) => item.findingId)).size !== findings.length) {
      throw new Error("relation discovery finding batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const finding of findings) {
        const lineage = this.#database.prepare(
          `SELECT revision_id FROM relation_discovery_task_revisions
           WHERE task_id = ? AND work_item_id = ? AND work_artifact_hash = ?
             AND source_corpus_snapshot_identity = ?
           LIMIT 1`,
        ).get(
          finding.sourceTaskId,
          finding.workItemId,
          finding.workArtifactHash,
          finding.sourceCorpusSnapshotIdentity,
        );
        const run = this.#database.prepare(
          `SELECT run_id FROM agent_runs WHERE run_id = ? AND task_id = ?`,
        ).get(finding.sourceAgentRunId, finding.sourceTaskId);
        if (lineage === undefined || run === undefined) {
          throw new Error("relation discovery finding references unavailable immutable lineage");
        }
        const recordJson = canonicalJson(finding);
        const recordHash = hashCanonical(finding);
        this.#database.prepare(
          `INSERT INTO relation_discovery_findings (
             finding_id, work_item_id, source_task_id, source_agent_run_id,
             source_corpus_snapshot_identity, finding_kind, recorded_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(finding_id) DO NOTHING`,
        ).run(
          finding.findingId,
          finding.workItemId,
          finding.sourceTaskId,
          finding.sourceAgentRunId,
          finding.sourceCorpusSnapshotIdentity,
          finding.kind,
          finding.recordedAt,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT finding_id, record_json, record_hash
           FROM relation_discovery_findings WHERE finding_id = ?`,
        ).get(finding.findingId);
        const stored = parseRelationDiscoveryFinding(row);
        if (hashCanonical(stored) !== recordHash) {
          throw new Error("findingId is already bound to another relation discovery finding");
        }
      }
      this.#database.exec("COMMIT");
      return findings;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadStandingOntologyRouteObservationEpisodes(
    routeFamilyIdsInput?: readonly Hash[],
  ): readonly StandingOntologyRouteObservationEpisode[] {
    this.#assertOpen();
    const routeFamilyIds = routeFamilyIdsInput === undefined
      ? null
      : [...new Set(routeFamilyIdsInput)].sort();
    if (routeFamilyIds?.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(item))) {
      throw new Error("standing route episode lookup contains an invalid family id");
    }
    if (routeFamilyIds?.length === 0) return Object.freeze([]);
    const rows = routeFamilyIds === null
      ? this.#database.prepare(
          `SELECT episode_id, record_json, record_hash
           FROM standing_ontology_route_observation_episodes
           ORDER BY observed_at, episode_id`,
        ).all()
      : routeFamilyIds.flatMap((routeFamilyId) => this.#database.prepare(
          `SELECT episode_id, record_json, record_hash
           FROM standing_ontology_route_observation_episodes
           WHERE route_family_id = ?
           ORDER BY observed_at, episode_id`,
        ).all(routeFamilyId));
    return Object.freeze(rows.map(parseStandingOntologyRouteObservationEpisode));
  }

  public saveStandingOntologyRouteObservationEpisodes(
    episodesInput: readonly StandingOntologyRouteObservationEpisode[],
  ): readonly StandingOntologyRouteObservationEpisode[] {
    this.#assertOpen();
    const episodes = Object.freeze(episodesInput.map(
      assertStandingOntologyRouteObservationEpisode,
    ));
    if (new Set(episodes.map((item) => item.episodeId)).size !== episodes.length) {
      throw new Error("standing route observation episode batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const episode of episodes) {
        const previousRow = episode.previousEpisodeId === null
          ? null
          : this.#database.prepare(
              `SELECT episode_id, record_json, record_hash
               FROM standing_ontology_route_observation_episodes
               WHERE episode_id = ? AND route_family_id = ?`,
            ).get(episode.previousEpisodeId, episode.routeFamilyId);
        if (episode.previousEpisodeId !== null && previousRow === undefined) {
          throw new Error("standing route observation episode lost its prior transition");
        }
        if (previousRow !== null && previousRow !== undefined &&
            parseStandingOntologyRouteObservationEpisode(previousRow).observedAt >
              episode.observedAt) {
          throw new Error("standing route observation episode predates its prior transition");
        }
        const existingChild = this.#database.prepare(
          `SELECT episode_id FROM standing_ontology_route_observation_episodes
           WHERE route_family_id = ? AND IFNULL(previous_episode_id, '') = IFNULL(?, '')`,
        ).get(episode.routeFamilyId, episode.previousEpisodeId);
        if (existingChild !== undefined &&
            (existingChild as Readonly<{ episode_id: string }>).episode_id !== episode.episodeId) {
          throw new Error("standing route observation history cannot fork");
        }
        const recordJson = canonicalJson(episode);
        const recordHash = hashCanonical(episode);
        this.#database.prepare(
          `INSERT INTO standing_ontology_route_observation_episodes (
             episode_id, route_family_id, family_observation_id,
             previous_episode_id, observed_at, state, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(episode_id) DO NOTHING`,
        ).run(
          episode.episodeId,
          episode.routeFamilyId,
          episode.familyObservationId,
          episode.previousEpisodeId,
          episode.observedAt,
          episode.state,
          recordJson,
          recordHash,
        );
        const row = this.#database.prepare(
          `SELECT episode_id, record_json, record_hash
           FROM standing_ontology_route_observation_episodes WHERE episode_id = ?`,
        ).get(episode.episodeId);
        if (row === undefined ||
            hashCanonical(parseStandingOntologyRouteObservationEpisode(row)) !== recordHash) {
          throw new Error("episodeId is already bound to another route observation episode");
        }
      }
      this.#database.exec("COMMIT");
      return episodes;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldPredicateArtifacts(limit: number): readonly WorldPredicateArtifact[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT artifact_hash, predicate_id, record_json, record_hash
       FROM world_predicate_artifacts
       ORDER BY proposed_at DESC, artifact_hash DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldPredicateArtifact));
  }

  public saveWorldPredicateArtifacts(
    artifactsInput: readonly WorldPredicateArtifact[],
  ): readonly WorldPredicateArtifact[] {
    this.#assertOpen();
    const artifacts = Object.freeze(artifactsInput.map(assertWorldPredicateArtifact));
    if (new Set(artifacts.map((item) => item.artifactHash)).size !== artifacts.length) {
      throw new Error("world predicate artifact batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const artifact of artifacts) {
        this.#database.prepare(
          `INSERT INTO world_predicate_artifacts (
             artifact_hash, predicate_id, epistemic_posture, proposed_at,
             record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(artifact_hash) DO NOTHING`,
        ).run(
          artifact.artifactHash, artifact.predicateId, artifact.epistemicPosture,
          artifact.proposedAt, canonicalJson(artifact), artifact.artifactHash,
        );
        const row = this.#database.prepare(
          `SELECT artifact_hash, predicate_id, record_json, record_hash
           FROM world_predicate_artifacts WHERE artifact_hash = ?`,
        ).get(artifact.artifactHash);
        if (parseWorldPredicateArtifact(row).artifactHash !== artifact.artifactHash) {
          throw new Error("world predicate artifact identity collision");
        }
      }
      this.#database.exec("COMMIT");
      return artifacts;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSettlementProjections(limit: number): readonly SettlementProjection[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT artifact_hash, projection_id, record_json, record_hash
       FROM settlement_projections
       ORDER BY observed_at DESC, artifact_hash DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseSettlementProjection));
  }

  public saveSettlementProjections(
    projectionsInput: readonly SettlementProjection[],
  ): readonly SettlementProjection[] {
    this.#assertOpen();
    const projections = Object.freeze(projectionsInput.map(assertSettlementProjection));
    if (new Set(projections.map((item) => item.artifactHash)).size !== projections.length) {
      throw new Error("settlement projection batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const projection of projections) {
        for (const binding of projection.predicateBindings) {
          const predicate = this.#database.prepare(
            `SELECT artifact_hash FROM world_predicate_artifacts
             WHERE artifact_hash = ? AND predicate_id = ?`,
          ).get(binding.predicateArtifactHash, binding.predicateId);
          if (predicate === undefined) {
            throw new Error("settlement projection references an unavailable predicate revision");
          }
        }
        this.#database.prepare(
          `INSERT INTO settlement_projections (
             artifact_hash, projection_id, listing_ref, compiler_admission,
             observed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(artifact_hash) DO NOTHING`,
        ).run(
          projection.artifactHash, projection.projectionId, projection.listing.listingRef,
          projection.compilerAdmission, projection.observedAt,
          canonicalJson(projection), projection.artifactHash,
        );
        const row = this.#database.prepare(
          `SELECT artifact_hash, projection_id, record_json, record_hash
           FROM settlement_projections WHERE artifact_hash = ?`,
        ).get(projection.artifactHash);
        if (parseSettlementProjection(row).artifactHash !== projection.artifactHash) {
          throw new Error("settlement projection artifact identity collision");
        }
      }
      this.#database.exec("COMMIT");
      return projections;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadSettlementProjectionObservations(
    limit: number,
  ): readonly SettlementProjectionObservation[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT artifact_hash, observation_id, record_json, record_hash
       FROM settlement_projection_observations
       ORDER BY observed_at DESC, artifact_hash DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseSettlementProjectionObservation));
  }

  public saveSettlementProjectionObservations(
    observationsInput: readonly SettlementProjectionObservation[],
  ): readonly SettlementProjectionObservation[] {
    this.#assertOpen();
    const observations = Object.freeze(observationsInput.map(
      assertSettlementProjectionObservation,
    ));
    if (new Set(observations.map((item) => item.artifactHash)).size !== observations.length) {
      throw new Error("settlement projection observation batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const item of observations) {
        this.#database.prepare(
          `INSERT INTO settlement_projection_observations (
             artifact_hash, observation_id, listing_ref, disposition,
             observed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(artifact_hash) DO NOTHING`,
        ).run(item.artifactHash, item.observationId, item.listingRef, item.disposition,
          item.observedAt, canonicalJson(item), item.artifactHash);
        const row = this.#database.prepare(
          `SELECT artifact_hash, observation_id, record_json, record_hash
           FROM settlement_projection_observations WHERE artifact_hash = ?`,
        ).get(item.artifactHash);
        if (parseSettlementProjectionObservation(row).artifactHash !== item.artifactHash) {
          throw new Error("settlement projection observation identity collision");
        }
      }
      this.#database.exec("COMMIT");
      return observations;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldRelationExperiments(limit: number): readonly WorldRelationExperiment[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT artifact_hash, experiment_id, record_json, record_hash
       FROM world_relation_experiments
       ORDER BY closed_at DESC, artifact_hash DESC
       LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldRelationExperiment));
  }

  public saveWorldRelationExperiments(
    experimentsInput: readonly WorldRelationExperiment[],
  ): readonly WorldRelationExperiment[] {
    this.#assertOpen();
    const experiments = Object.freeze(experimentsInput.map(assertWorldRelationExperiment));
    if (new Set(experiments.map((item) => item.artifactHash)).size !== experiments.length) {
      throw new Error("world relation experiment batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const experiment of experiments) {
        const run = this.#database.prepare(
          "SELECT run_id FROM agent_runs WHERE run_id = ?",
        ).get(experiment.sourceAgentRunId);
        if (run === undefined) {
          throw new Error("world relation experiment references an unavailable Agent run");
        }
        const availablePredicates = new Set((this.#database.prepare(
          `SELECT DISTINCT predicate_id FROM world_predicate_artifacts
           WHERE predicate_id IN (${experiment.predicateIds.map(() => "?").join(",")})`,
        ).all(...experiment.predicateIds) as unknown as readonly Readonly<{ predicate_id: string }>[])
          .map((item) => item.predicate_id));
        if (experiment.predicateIds.some((item) => !availablePredicates.has(item))) {
          throw new Error("world relation experiment references unavailable predicates");
        }
        if (experiment.inspectedProjectionIds.length > 0) {
          const availableProjections = new Set((this.#database.prepare(
            `SELECT DISTINCT projection_id FROM settlement_projections
             WHERE projection_id IN (${experiment.inspectedProjectionIds.map(() => "?").join(",")})`,
          ).all(...experiment.inspectedProjectionIds) as unknown as readonly Readonly<{ projection_id: string }>[])
            .map((item) => item.projection_id));
          if (experiment.inspectedProjectionIds.some((item) => !availableProjections.has(item))) {
            throw new Error("world relation experiment references unavailable projections");
          }
        }
        this.#database.prepare(
          `INSERT INTO world_relation_experiments (
             artifact_hash, experiment_id, relation_kind, terminal_disposition,
             source_agent_run_id, closed_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(artifact_hash) DO NOTHING`,
        ).run(
          experiment.artifactHash, experiment.experimentId, experiment.relationKind,
          experiment.terminalDisposition, experiment.sourceAgentRunId,
          experiment.closedAt, canonicalJson(experiment), experiment.artifactHash,
        );
        const row = this.#database.prepare(
          `SELECT artifact_hash, experiment_id, record_json, record_hash
           FROM world_relation_experiments WHERE artifact_hash = ?`,
        ).get(experiment.artifactHash);
        if (parseWorldRelationExperiment(row).artifactHash !== experiment.artifactHash) {
          throw new Error("world relation experiment artifact identity collision");
        }
      }
      this.#database.exec("COMMIT");
      return experiments;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  public loadWorldRelationExperimentCorpus(
    snapshotIdentity: Hash,
  ): MarketCorpusSnapshot | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      `SELECT snapshot_identity, source_set_identity, listing_count,
              record_json AS corpus_json, record_hash AS corpus_hash
       FROM world_relation_experiment_corpora WHERE snapshot_identity = ?`,
    ).get(snapshotIdentity);
    return row === undefined ? null : parseSearchLeaseCorpus(row);
  }

  public saveWorldRelationExperimentCorpus(
    corpusInput: MarketCorpusSnapshot,
  ): MarketCorpusSnapshot {
    this.#assertOpen();
    const corpus = assertMarketCorpusSnapshot(corpusInput);
    const recordJson = canonicalJson(corpus);
    const recordHash = hashCanonical(corpus);
    const retainedAt = [...corpus.listings].map((item) => item.sourceReceivedAt)
      .sort().at(-1) ?? "1970-01-01T00:00:00.000Z";
    this.#database.prepare(
      `INSERT INTO world_relation_experiment_corpora (
         snapshot_identity, source_set_identity, listing_count, retained_at,
         record_json, record_hash
       ) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(snapshot_identity) DO NOTHING`,
    ).run(corpus.snapshotIdentity, corpus.sourceSetIdentity, corpus.listingCount,
      retainedAt, recordJson, recordHash);
    const stored = this.loadWorldRelationExperimentCorpus(corpus.snapshotIdentity);
    if (stored === null || hashCanonical(stored) !== recordHash) {
      throw new Error("world relation experiment corpus identity collision");
    }
    return stored;
  }

  public loadWorldRelationExperimentInputs(
    limit: number,
  ): readonly WorldRelationExperimentInputRevision[] {
    this.#assertOpen();
    assertLimit(limit);
    const rows = this.#database.prepare(
      `SELECT input_revision_id, record_json, record_hash
       FROM world_relation_experiment_inputs
       ORDER BY materialized_at DESC, input_revision_id DESC LIMIT ?`,
    ).all(limit);
    return Object.freeze(rows.map(parseWorldRelationExperimentInput));
  }

  public loadWorldRelationExperimentInput(
    inputRevisionId: Hash,
  ): WorldRelationExperimentInputRevision | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      `SELECT input_revision_id, record_json, record_hash
       FROM world_relation_experiment_inputs WHERE input_revision_id = ?`,
    ).get(inputRevisionId);
    return row === undefined ? null : parseWorldRelationExperimentInput(row);
  }

  public saveWorldRelationExperimentInputs(
    inputsRaw: readonly WorldRelationExperimentInputRevision[],
  ): readonly WorldRelationExperimentInputRevision[] {
    this.#assertOpen();
    const inputs = Object.freeze(inputsRaw.map(assertWorldRelationExperimentInputRevision));
    if (new Set(inputs.map((item) => item.inputRevisionId)).size !== inputs.length) {
      throw new Error("world relation experiment input batch repeats an identity");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const input of inputs) {
        if (this.loadWorldRelationExperimentCorpus(input.corpusSnapshotIdentity) === null) {
          throw new Error("world relation experiment input references an unavailable corpus");
        }
        for (const predicate of input.frontier.predicates) {
          if (this.#database.prepare(
            `SELECT artifact_hash FROM world_predicate_artifacts
             WHERE artifact_hash = ? AND predicate_id = ?`,
          ).get(predicate.artifactHash, predicate.predicateId) === undefined) {
            throw new Error("world relation experiment input references an unavailable predicate");
          }
        }
        for (const artifactHash of input.settlementProjectionArtifactHashes) {
          if (this.#database.prepare(
            "SELECT artifact_hash FROM settlement_projections WHERE artifact_hash = ?",
          ).get(artifactHash) === undefined) {
            throw new Error("world relation experiment input references an unavailable projection");
          }
        }
        for (const artifactHash of input.priorExperimentArtifactHashes) {
          if (this.#database.prepare(
            "SELECT artifact_hash FROM world_relation_experiments WHERE artifact_hash = ?",
          ).get(artifactHash) === undefined) {
            throw new Error("world relation experiment input references unavailable prior memory");
          }
        }
        const recordJson = canonicalJson(input);
        const recordHash = hashCanonical(input);
        this.#database.prepare(
          `INSERT INTO world_relation_experiment_inputs (
             input_revision_id, semantic_input_identity, frontier_id,
             corpus_snapshot_identity, materialized_at, record_json, record_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(input_revision_id) DO NOTHING`,
        ).run(input.inputRevisionId, input.semanticInputIdentity,
          input.frontier.frontierId, input.corpusSnapshotIdentity,
          input.materializedAt, recordJson, recordHash);
        const stored = this.loadWorldRelationExperimentInput(input.inputRevisionId);
        if (stored === null || hashCanonical(stored) !== recordHash) {
          throw new Error("world relation experiment input identity collision");
        }
      }
      this.#database.exec("COMMIT");
      return inputs;
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
