import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { hashCanonical, type Hash } from "@pmh/domain";
import { runOpportunitySimulation } from "@pmh/execution";
import { ReplayBookDesk } from "./book-desk.js";
import { FixtureCatalogDiscoveryDesk } from "./catalog-discovery.js";
import {
  CatalogObservationDesk,
  RadarCandidateUnavailableError,
  type CatalogObservationStore,
} from "./catalog-observation.js";
import {
  CatalogRefreshScheduler,
  parseCatalogRefreshInterval,
} from "./catalog-refresh-scheduler.js";
import {
  CandidateWatchDesk,
  type CandidateWatchStore,
} from "./candidate-watch.js";
import { DiscoveryPool, HeuristicDiscoveryWorker } from "./discovery.js";
import {
  createDiscoveryModelRuntime,
  type DiscoveryModelRuntime,
} from "./model-runtime.js";
import {
  createPiInvestigatorRuntime,
  type PiInvestigatorRuntime,
} from "./pi-investigator.js";
import {
  InvestigationBusyError,
  InvestigationDesk,
  InvestigationNotConfiguredError,
  InvestigationScopeConflictError,
  type InvestigationRecordStore,
} from "./investigation-desk.js";
import {
  DiscoveryLedger,
  projectDiscoveryRunRecord,
  type DiscoveryRunStore,
} from "./discovery-ledger.js";
import {
  orderRadarCandidatesForSearch,
  radarTriageTaskId,
} from "./opportunity-radar.js";
import { buildStudioProjection } from "./projection.js";
import { buildLiveStudioProjection } from "./studio-projection-window.js";
import {
  AiUsageLedger,
  type AiUsageEventStore,
} from "./ai-usage-ledger.js";
import {
  applyProposalEconomicPriority,
  buildProposalEconomicTriage,
  recoverBaseReviewPriority,
} from "./proposal-economic-triage.js";
import { buildReviewAttentionProjection } from "./review-attention.js";
import { RealCandidatePreflightDesk } from "./real-candidate-preflight.js";
import {
  buildProposalEvidenceBundle,
  createMarketArchaeologistDesk,
  MarketArchaeologistBusyError,
  MarketArchaeologistDesk,
  MarketArchaeologistNotConfiguredError,
  type MarketArchaeologistRecordStore,
} from "./market-archaeologist.js";
import {
  projectMarketCorpus,
  searchMarketCorpus,
  type MarketCorpusSnapshot,
  type MarketCorpusSearchQuery,
} from "./market-corpus.js";
import type {
  DiscoveryCatalogMode,
  DiscoveryRunRecord,
  DiscoveryTask,
} from "./types.js";
import { OpportunityLifecycleDesk } from "./opportunity-lifecycle-desk.js";
import {
  createSemanticReviewDesk,
  SemanticReviewBusyError,
  SemanticReviewDesk,
  SemanticReviewNotConfiguredError,
  type SemanticReviewRecordStore,
} from "./semantic-review.js";
import {
  createProbabilityEstimationDesk,
  ProbabilityEstimationDesk,
  PROBABILITY_ESTIMATOR_ROLES,
  type ProbabilityEstimationRunStore,
  type ProbabilityEstimatorRole,
} from "./probability-estimation-agent.js";
import {
  parseProbabilityEstimationTickInterval,
  ProbabilityEstimationScheduler,
  type ProbabilityEstimationCandidate,
  type ProbabilityEstimationSchedulerStore,
} from "./probability-estimation-scheduler.js";
import {
  ProbabilityCalibrationDesk,
  type ProbabilityCalibrationStore,
} from "./probability-calibration-desk.js";
import type { ProbabilityResolutionEvidence } from "./probability-calibration.js";
import {
  parseProbabilityResolutionInterval,
  ProbabilityResolutionAcquisitionScheduler,
  type ProbabilityResolutionCaptureStore,
} from "./probability-resolution-acquisition.js";
import {
  parseSemanticReviewTickInterval,
  SemanticReviewScheduler,
  type SemanticReviewCandidate,
  type SemanticReviewSchedulerStore,
} from "./semantic-review-scheduler.js";
import {
  createPremiseAnalysisDesk,
  type PremiseAnalysisRecordStore,
} from "./premise-analysis.js";
import {
  parsePremiseAnalysisTickInterval,
  PremiseAnalysisScheduler,
  type PremiseAnalysisCandidate,
  type PremiseAnalysisSchedulerStore,
} from "./premise-analysis-scheduler.js";
import {
  EvidenceAcquisitionScheduler,
  parseEvidenceAcquisitionTickInterval,
  type EvidenceAcquisitionSchedulerStore,
} from "./evidence-acquisition-scheduler.js";
import { EvidenceDocumentFetcher } from "./evidence-document.js";
import type { EvidenceRequirement } from "./evidence-requirement.js";
import {
  createRuleEvidenceClaimDesk,
  type RuleEvidenceClaimRecordStore,
} from "./rule-evidence-claim.js";
import {
  parseRuleEvidenceClaimTickInterval,
  RuleEvidenceClaimScheduler,
  type RuleEvidenceClaimInput,
  type RuleEvidenceClaimSchedulerStore,
} from "./rule-evidence-claim-scheduler.js";
import {
  buildSemanticReviewAdmissionProjection,
  classifySemanticReviewAdmission,
} from "./semantic-review-admission.js";
import { deriveRelationPayoffProjection } from "./relation-payoff.js";
import { parseOpportunitySimulationIntake } from "./simulation-intake.js";
import type { OpportunityLifecycleJournalStore } from "./opportunity-lifecycle-desk.js";
import {
  AnonymousSimulationMaterializerDesk,
  type AnonymousSimulationMaterializationStore,
} from "./anonymous-simulation-materializer.js";
import { verifyMaterializedOpportunity } from "./exact-promotion.js";
import {
  parseSearchLeaseInterval,
  parseSearchLeaseStageBudget,
  SEARCH_LENSES,
  SearchLeaseBusyError,
  SearchLeaseScheduler,
  SearchLeaseUnavailableError,
  type SearchLeaseRecordStore,
  type SearchLens,
} from "./search-lease-scheduler.js";
import {
  SearchQuoteEnrichmentDesk,
  type SearchQuoteObservationStore,
} from "./search-quote-enrichment.js";
import {
  parseSearchIssueTickInterval,
  SearchIssueScheduler,
  type CreateSearchIssueInput,
  type SearchIssueRecordStore,
} from "./search-issue-scheduler.js";
import {
  buildSemanticFamilyCatalogSelection,
  type SemanticFamilyRetrievalPlan,
} from "./semantic-family-retrieval.js";
import {
  parseSearchAttentionWebhook,
  SearchAttentionOutbox,
  type SearchAttentionStore,
} from "./search-attention-outbox.js";
import { buildSearchOutcomeAttribution } from "./search-outcome-attribution.js";
import {
  buildSemanticRelationGraph,
  searchSemanticGraphNeighborhood,
  type SemanticGraphSearchContext,
} from "./semantic-relation-graph.js";
import {
  AiRuntimeConfigurationConflictError,
  AiRuntimeConfigurationDesk,
  AI_RUNTIME_PROVIDERS,
  CODEX_REASONING_EFFORTS,
  CODEX_RUNTIME_MODELS,
  type AiRuntimeConfiguration,
  type AiRuntimeConfigurationStore,
} from "./ai-runtime-configuration.js";

const MAX_BODY_BYTES = 64 * 1024;

class DiscoveryScopeConflictError extends Error {}
class ResearchContextUnavailableError extends Error {}

function writeJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "http://localhost:5173",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes =
      typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    length += bytes.byteLength;
    if (length > MAX_BODY_BYTES) {
      throw new Error("request body exceeds 64 KiB");
    }
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readRadarCandidateId(request: IncomingMessage): Promise<string> {
  const body = await readJson(request);
  if (
    body === null ||
    typeof body !== "object" ||
    typeof (body as { candidateId?: unknown }).candidateId !== "string" ||
    Object.keys(body).length !== 1
  ) {
    throw new RadarCandidateUnavailableError(
      "radar action requires exactly one candidateId",
    );
  }
  return (body as { candidateId: string }).candidateId;
}

async function readResearchTaskId(request: IncomingMessage): Promise<string> {
  const body = await readJson(request);
  if (
    body === null ||
    typeof body !== "object" ||
    typeof (body as { taskId?: unknown }).taskId !== "string" ||
    Object.keys(body).length !== 1 ||
    (body as { taskId: string }).taskId.trim() === ""
  ) {
    throw new ResearchContextUnavailableError(
      "research case investigation requires exactly one taskId",
    );
  }
  return (body as { taskId: string }).taskId;
}

function parseDiscoveryTask(
  value: unknown,
  catalogDesk: FixtureCatalogDiscoveryDesk,
  catalogObservationDesk: CatalogObservationDesk,
  deadlineMs = 10_000,
): DiscoveryTask {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as { question?: unknown }).question !== "string" ||
    !Array.isArray((value as { venueIds?: unknown }).venueIds)
  ) {
    throw new Error("discovery request requires question and venueIds");
  }
  const rawVenueIds = (value as { venueIds: unknown[] }).venueIds;
  const rawTaskId = (value as { taskId?: unknown }).taskId;
  const rawCatalogMode = (value as { catalogMode?: unknown }).catalogMode;
  if (
    rawVenueIds.some((item) => typeof item !== "string") ||
    (rawTaskId !== undefined && typeof rawTaskId !== "string") ||
    (rawCatalogMode !== undefined && typeof rawCatalogMode !== "string")
  ) {
    throw new Error("discovery taskId, catalogMode, and venueIds must be strings");
  }
  const question = (value as { question: string }).question
    .trim()
    .replace(/\s+/g, " ");
  const venueIds = [
    ...new Set(
      rawVenueIds
        .map((item) => item as string)
        .map((item) => item.trim())
        .filter((item) => item !== ""),
    ),
  ].sort();
  const now = Date.now();
  const suppliedTaskId =
    typeof rawTaskId === "string"
      ? rawTaskId.trim()
      : undefined;
  const catalogMode =
    (rawCatalogMode ?? "VERIFIED_FIXTURES") as DiscoveryCatalogMode;
  if (
    question === "" ||
    question.length > 500 ||
    venueIds.length === 0 ||
    venueIds.length > 25 ||
    venueIds.some((item) => item.length > 256) ||
    suppliedTaskId === "" ||
    (suppliedTaskId?.length ?? 0) > 256 ||
    (catalogMode !== "VERIFIED_FIXTURES" &&
      catalogMode !== "CURRENT_OBSERVATIONS")
  ) {
    throw new Error("discovery request is empty or exceeds bounded input limits");
  }
  const catalogContext =
    catalogMode === "CURRENT_OBSERVATIONS"
      ? catalogObservationDesk.context(question, venueIds)
      : catalogDesk.context(question, venueIds);
  return {
    taskId:
      suppliedTaskId ??
      `task:${hashCanonical({
        question,
        venueIds,
        catalogContextIdentity: catalogContext.contextIdentity,
      }).slice(7)}`,
    question,
    venueIds,
    maxHypotheses: 10,
    deadlineEpochMs: now + deadlineMs,
    catalogContext,
  };
}

function taskScopeHash(task: DiscoveryTask): string {
  return hashCanonical({
    question: task.question,
    venueIds: task.venueIds,
    maxHypotheses: task.maxHypotheses,
    catalogContextIdentity: task.catalogContext?.contextIdentity ?? null,
    catalogContextSource: task.catalogContext?.source ?? null,
  });
}

function recordMatchesTask(
  record: DiscoveryRunRecord,
  task: DiscoveryTask,
): boolean {
  return (
    record.question === task.question &&
    record.venueIds.length === task.venueIds.length &&
    record.venueIds.every((item, index) => item === task.venueIds[index]) &&
    (record.catalogContextIdentity ?? null) ===
      (task.catalogContext?.contextIdentity ?? null) &&
    (record.catalogContextSource ?? "VERIFIED_FIXTURE_CATALOGS") ===
      (task.catalogContext?.source ?? "VERIFIED_FIXTURE_CATALOGS")
  );
}

function supportsInvestigationRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & InvestigationRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<InvestigationRecordStore>;
  return (
    candidate.investigationStorage !== undefined &&
    typeof candidate.loadInvestigations === "function" &&
    typeof candidate.saveInvestigation === "function"
  );
}

function supportsCatalogObservations(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & CatalogObservationStore {
  if (store === undefined) return false;
  const candidate = store as Partial<CatalogObservationStore>;
  return (
    candidate.catalogObservationStorage !== undefined &&
    typeof candidate.loadCatalogObservations === "function" &&
    typeof candidate.saveCatalogObservation === "function"
  );
}

function supportsCandidateWatch(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & CandidateWatchStore {
  if (store === undefined) return false;
  const candidate = store as Partial<CandidateWatchStore>;
  return (
    candidate.candidateBookObservationStorage !== undefined &&
    typeof candidate.loadCandidateBookObservations === "function" &&
    typeof candidate.saveCandidateBookObservation === "function" &&
    candidate.candidateWatchRefreshStorage !== undefined &&
    typeof candidate.loadCandidateWatchRefreshes === "function" &&
    typeof candidate.saveCandidateWatchRefresh === "function"
  );
}

function supportsMarketArchaeologistRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & MarketArchaeologistRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<MarketArchaeologistRecordStore>;
  return (
    candidate.marketArchaeologistStorage !== undefined &&
    typeof candidate.loadMarketArchaeologistRecords === "function" &&
    typeof candidate.saveMarketArchaeologistRecord === "function"
  );
}

function supportsSearchLeaseRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & SearchLeaseRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<SearchLeaseRecordStore>;
  return (
    candidate.searchLeaseStorage !== undefined &&
    candidate.searchLeaseCorpusStorage !== undefined &&
    typeof candidate.loadSearchLeaseRecords === "function" &&
    typeof candidate.saveSearchLeaseRecord === "function" &&
    typeof candidate.saveSearchLeaseCorpus === "function" &&
    typeof candidate.loadSearchLeaseCorpus === "function" &&
    typeof candidate.hasSearchLeaseCorpus === "function" &&
    typeof candidate.countSearchLeaseCorpora === "function"
  );
}

function supportsSearchIssueRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & SearchIssueRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<SearchIssueRecordStore>;
  return (
    candidate.searchIssueStorage !== undefined &&
    candidate.searchNotificationStorage !== undefined &&
    typeof candidate.loadSearchIssueRecords === "function" &&
    typeof candidate.saveSearchIssueRecord === "function" &&
    typeof candidate.loadSearchNotificationRecords === "function" &&
    typeof candidate.saveSearchNotificationRecord === "function"
  );
}

function supportsSemanticReviewRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & SemanticReviewRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<SemanticReviewRecordStore>;
  return (
    candidate.semanticReviewStorage !== undefined &&
    typeof candidate.loadSemanticReviewRecords === "function" &&
    typeof candidate.saveSemanticReviewRecord === "function"
  );
}

function supportsProbabilityEstimationRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & ProbabilityEstimationRunStore {
  if (store === undefined) return false;
  const candidate = store as Partial<ProbabilityEstimationRunStore>;
  return candidate.probabilityEstimationStorage !== undefined &&
    typeof candidate.loadProbabilityEstimationRunRecords === "function" &&
    typeof candidate.saveProbabilityEstimationRunRecord === "function";
}

function supportsProbabilityEstimationSchedulerRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & ProbabilityEstimationSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<ProbabilityEstimationSchedulerStore>;
  return candidate.probabilityEstimationJobStorage !== undefined &&
    candidate.probabilityEstimationNotificationStorage !== undefined &&
    typeof candidate.loadProbabilityEstimationJobRecords === "function" &&
    typeof candidate.saveProbabilityEstimationJobRecord === "function" &&
    typeof candidate.loadProbabilityEstimationNotificationRecords === "function" &&
    typeof candidate.saveProbabilityEstimationNotificationRecord === "function";
}

function supportsProbabilityCalibrationRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & ProbabilityCalibrationStore {
  if (store === undefined) return false;
  const candidate = store as Partial<ProbabilityCalibrationStore>;
  return candidate.probabilityCalibrationBoundStorage !== undefined &&
    candidate.probabilityCalibrationObservationStorage !== undefined &&
    candidate.probabilityCalibrationSnapshotStorage !== undefined &&
    typeof candidate.loadProbabilityCalibrationBounds === "function" &&
    typeof candidate.saveProbabilityCalibrationBound === "function" &&
    typeof candidate.loadProbabilityCalibrationObservations === "function" &&
    typeof candidate.saveProbabilityCalibrationObservation === "function" &&
    typeof candidate.loadProbabilityCalibrationSnapshots === "function" &&
    typeof candidate.saveProbabilityCalibrationSnapshot === "function";
}

function supportsProbabilityResolutionCaptures(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & ProbabilityResolutionCaptureStore {
  if (store === undefined) return false;
  const candidate = store as Partial<ProbabilityResolutionCaptureStore>;
  return candidate.probabilityResolutionCaptureStorage !== undefined &&
    candidate.probabilityResolutionSourceStorage !== undefined &&
    typeof candidate.loadProbabilityResolutionCaptures === "function" &&
    typeof candidate.saveProbabilityResolutionCapture === "function" &&
    typeof candidate.loadProbabilityResolutionSource === "function";
}

function supportsSemanticReviewSchedulerRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & SemanticReviewSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<SemanticReviewSchedulerStore>;
  return (
    candidate.semanticReviewJobStorage !== undefined &&
    candidate.semanticReviewNotificationStorage !== undefined &&
    typeof candidate.loadSemanticReviewJobRecords === "function" &&
    typeof candidate.saveSemanticReviewJobRecord === "function" &&
    typeof candidate.loadSemanticReviewNotificationRecords === "function" &&
    typeof candidate.saveSemanticReviewNotificationRecord === "function"
  );
}

function supportsPremiseAnalysisRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & PremiseAnalysisRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<PremiseAnalysisRecordStore>;
  return candidate.premiseAnalysisStorage !== undefined &&
    typeof candidate.loadPremiseAnalysisRecords === "function" &&
    typeof candidate.savePremiseAnalysisRecord === "function";
}

function supportsPremiseAnalysisSchedulerRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & PremiseAnalysisSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<PremiseAnalysisSchedulerStore>;
  return candidate.premiseAnalysisJobStorage !== undefined &&
    candidate.premiseAnalysisNotificationStorage !== undefined &&
    typeof candidate.loadPremiseAnalysisJobRecords === "function" &&
    typeof candidate.savePremiseAnalysisJobRecord === "function" &&
    typeof candidate.loadPremiseAnalysisNotificationRecords === "function" &&
    typeof candidate.savePremiseAnalysisNotificationRecord === "function";
}

function supportsEvidenceAcquisitionRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & EvidenceAcquisitionSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<EvidenceAcquisitionSchedulerStore>;
  return (
    candidate.evidenceAcquisitionJobStorage !== undefined &&
    candidate.evidenceDocumentStorage !== undefined &&
    candidate.evidenceDocumentTextStorage !== undefined &&
    candidate.evidenceDocumentObservationStorage !== undefined &&
    typeof candidate.loadEvidenceAcquisitionJobRecords === "function" &&
    typeof candidate.saveEvidenceAcquisitionJobRecord === "function" &&
    typeof candidate.loadEvidenceDocumentCapture === "function" &&
    typeof candidate.saveEvidenceAcquisitionCompletion === "function"
  );
}

function supportsRuleEvidenceClaimRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & RuleEvidenceClaimRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<RuleEvidenceClaimRecordStore>;
  return candidate.ruleEvidenceClaimStorage !== undefined &&
    typeof candidate.loadRuleEvidenceClaimRecords === "function" &&
    typeof candidate.saveRuleEvidenceClaimRecord === "function";
}

function supportsRuleEvidenceClaimSchedulerRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & RuleEvidenceClaimSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<RuleEvidenceClaimSchedulerStore>;
  return candidate.ruleEvidenceClaimJobStorage !== undefined &&
    typeof candidate.loadRuleEvidenceClaimJobRecords === "function" &&
    typeof candidate.saveRuleEvidenceClaimJobRecord === "function";
}

function supportsOpportunityLifecycleJournals(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & OpportunityLifecycleJournalStore {
  if (store === undefined) return false;
  const candidate = store as Partial<OpportunityLifecycleJournalStore>;
  return (
    candidate.opportunityLifecycleStorage !== undefined &&
    typeof candidate.loadOpportunityLifecycleJournals === "function" &&
    typeof candidate.saveOpportunityLifecycleJournal === "function"
  );
}

function supportsAnonymousSimulationMaterializations(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & AnonymousSimulationMaterializationStore {
  if (store === undefined) return false;
  const candidate = store as Partial<AnonymousSimulationMaterializationStore>;
  return (
    candidate.anonymousSimulationMaterializationStorage !== undefined &&
    typeof candidate.loadAnonymousSimulationMaterializations === "function" &&
    typeof candidate.saveAnonymousSimulationMaterialization === "function"
  );
}

function supportsSearchQuoteObservations(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & SearchQuoteObservationStore {
  if (store === undefined) return false;
  const candidate = store as Partial<SearchQuoteObservationStore>;
  return (
    candidate.searchQuoteObservationStorage !== undefined &&
    typeof candidate.loadSearchQuoteObservations === "function" &&
    typeof candidate.saveSearchQuoteObservation === "function"
  );
}

function supportsSearchAttentionRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & SearchAttentionStore {
  if (store === undefined) return false;
  const candidate = store as Partial<SearchAttentionStore>;
  return (
    candidate.searchAttentionMessageStorage !== undefined &&
    candidate.searchAttentionDeliveryStorage !== undefined &&
    typeof candidate.loadSearchAttentionMessages === "function" &&
    typeof candidate.saveSearchAttentionMessage === "function" &&
    typeof candidate.loadSearchAttentionDeliveries === "function" &&
    typeof candidate.saveSearchAttentionDelivery === "function"
  );
}

function supportsAiUsageEvents(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & AiUsageEventStore {
  if (store === undefined) return false;
  const candidate = store as Partial<AiUsageEventStore>;
  return candidate.aiUsageStorage !== undefined &&
    typeof candidate.loadAiUsageEvents === "function" &&
    typeof candidate.saveAiUsageEvent === "function";
}

function supportsAiRuntimeConfiguration(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & AiRuntimeConfigurationStore {
  if (store === undefined) return false;
  const candidate = store as Partial<AiRuntimeConfigurationStore>;
  return candidate.aiRuntimeConfigurationStorage !== undefined &&
    typeof candidate.loadAiRuntimeConfiguration === "function" &&
    typeof candidate.saveAiRuntimeConfiguration === "function";
}

function parseAiRuntimeConfigurationUpdate(value: unknown): Readonly<{
  expectedRevision: number;
  provider: (typeof AI_RUNTIME_PROVIDERS)[number];
  codexModel: (typeof CODEX_RUNTIME_MODELS)[number];
  codexReasoningEffort: (typeof CODEX_REASONING_EFFORTS)[number];
}> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI runtime configuration update must be an object");
  }
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  const expectedKeys = [
    "codexModel",
    "codexReasoningEffort",
    "expectedRevision",
    "provider",
  ];
  if (
    JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
    !Number.isSafeInteger(body.expectedRevision) ||
    !AI_RUNTIME_PROVIDERS.includes(body.provider as never) ||
    !CODEX_RUNTIME_MODELS.includes(body.codexModel as never) ||
    !CODEX_REASONING_EFFORTS.includes(body.codexReasoningEffort as never)
  ) {
    throw new Error("AI runtime configuration update is invalid");
  }
  return Object.freeze({
    expectedRevision: body.expectedRevision as number,
    provider: body.provider as (typeof AI_RUNTIME_PROVIDERS)[number],
    codexModel: body.codexModel as (typeof CODEX_RUNTIME_MODELS)[number],
    codexReasoningEffort:
      body.codexReasoningEffort as (typeof CODEX_REASONING_EFFORTS)[number],
  });
}

function parseProbabilityCalibrationResolution(value: unknown): Readonly<{
  boundArtifactHash: Hash;
  resolutionEvidence: readonly ProbabilityResolutionEvidence[];
}> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probability calibration resolution request is malformed");
  }
  const body = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(body).sort()) !==
      JSON.stringify(["boundArtifactHash", "resolutionEvidence"]) ||
    typeof body.boundArtifactHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(body.boundArtifactHash) ||
    !Array.isArray(body.resolutionEvidence) ||
    body.resolutionEvidence.length < 1 || body.resolutionEvidence.length > 16
  ) throw new Error("probability calibration resolution request is invalid");
  const resolutionEvidence = Object.freeze(body.resolutionEvidence.map((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("probability calibration resolution evidence is malformed");
    }
    const item = value as Record<string, unknown>;
    if (
      JSON.stringify(Object.keys(item).sort()) !== JSON.stringify([
        "listingRef", "protocolIdentity", "resolvedAt", "sourceRawHash", "truthValue",
      ]) ||
      typeof item.listingRef !== "string" || typeof item.truthValue !== "boolean" ||
      typeof item.resolvedAt !== "string" || typeof item.sourceRawHash !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(item.sourceRawHash) ||
      typeof item.protocolIdentity !== "string"
    ) throw new Error("probability calibration resolution evidence is invalid");
    return Object.freeze({
      listingRef: item.listingRef,
      truthValue: item.truthValue,
      resolvedAt: item.resolvedAt,
      sourceRawHash: item.sourceRawHash as Hash,
      protocolIdentity: item.protocolIdentity,
    });
  }));
  return Object.freeze({
    boundArtifactHash: body.boundArtifactHash as Hash,
    resolutionEvidence,
  });
}

export function createControlPlane(options?: {
  bookDesk?: ReplayBookDesk;
  catalogDesk?: FixtureCatalogDiscoveryDesk;
  catalogObservationDesk?: CatalogObservationDesk;
  catalogRefreshScheduler?: CatalogRefreshScheduler;
  refreshCatalogOnReady?: boolean;
  discoveryLedger?: DiscoveryLedger;
  discoveryStore?: DiscoveryRunStore;
  discoveryPool?: DiscoveryPool;
  modelRuntime?: DiscoveryModelRuntime;
  piRuntime?: PiInvestigatorRuntime;
  investigationDesk?: InvestigationDesk;
  investigationStore?: InvestigationRecordStore;
  realCandidatePreflightDesk?: RealCandidatePreflightDesk;
  candidateWatchDesk?: CandidateWatchDesk;
  marketArchaeologistDesk?: MarketArchaeologistDesk;
  searchLeaseScheduler?: SearchLeaseScheduler;
  searchQuoteEnrichmentDesk?: SearchQuoteEnrichmentDesk;
  searchIssueScheduler?: SearchIssueScheduler;
  searchAttentionOutbox?: SearchAttentionOutbox;
  semanticReviewDesk?: SemanticReviewDesk;
  probabilityEstimationDesk?: ProbabilityEstimationDesk;
  probabilityEstimationScheduler?: ProbabilityEstimationScheduler;
  probabilityCalibrationDesk?: ProbabilityCalibrationDesk;
  probabilityResolutionAcquisitionScheduler?: ProbabilityResolutionAcquisitionScheduler;
  aiUsageLedger?: AiUsageLedger;
  aiRuntimeConfigurationDesk?: AiRuntimeConfigurationDesk;
  modelRuntimeFactory?: (configuration: AiRuntimeConfiguration) => DiscoveryModelRuntime;
  semanticReviewScheduler?: SemanticReviewScheduler;
  premiseAnalysisDesk?: ReturnType<typeof createPremiseAnalysisDesk>;
  premiseAnalysisScheduler?: PremiseAnalysisScheduler;
  evidenceAcquisitionScheduler?: EvidenceAcquisitionScheduler;
  ruleEvidenceClaimDesk?: ReturnType<typeof createRuleEvidenceClaimDesk>;
  ruleEvidenceClaimScheduler?: RuleEvidenceClaimScheduler;
  opportunityLifecycleDesk?: OpportunityLifecycleDesk;
  simulationMaterializerDesk?: AnonymousSimulationMaterializerDesk;
  /**
   * Production startup supplies an unresolved gate until the HTTP listener owns
   * its port. This keeps losing dev-watch or replica processes read-only: they
   * cannot refresh catalogs, resume Pi work, or start timers before bind wins.
   */
  startupGate?: Promise<void>;
}) {
  if (
    options?.discoveryLedger !== undefined &&
    options.discoveryStore !== undefined
  ) {
    throw new Error("provide either discoveryLedger or discoveryStore, not both");
  }
  if (
    options?.investigationDesk !== undefined &&
    options.investigationStore !== undefined
  ) {
    throw new Error(
      "provide either investigationDesk or investigationStore, not both",
    );
  }
  const aiUsageLedger = options?.aiUsageLedger ?? new AiUsageLedger(
    200,
    supportsAiUsageEvents(options?.discoveryStore)
      ? options.discoveryStore
      : undefined,
  );
  const aiRuntimeConfigurationDesk = options?.aiRuntimeConfigurationDesk ??
    new AiRuntimeConfigurationDesk(
      process.env,
      supportsAiRuntimeConfiguration(options?.discoveryStore)
        ? options.discoveryStore
        : undefined,
    );
  const modelRuntimeFactory = options?.modelRuntimeFactory ??
    ((configuration: AiRuntimeConfiguration) => createDiscoveryModelRuntime(
      process.env,
      { usageRecorder: aiUsageLedger, runtimeConfiguration: configuration },
    ));
  let modelRuntime = options?.modelRuntime ??
    modelRuntimeFactory(aiRuntimeConfigurationDesk.current());
  const piRuntime = options?.piRuntime ?? createPiInvestigatorRuntime(process.env, {
    usageRecorder: aiUsageLedger,
  });
  const worker = new HeuristicDiscoveryWorker();
  let pool =
    options?.discoveryPool ??
    new DiscoveryPool([
      worker,
      ...modelRuntime.workers,
    ]);
  const bookDesk = options?.bookDesk ?? new ReplayBookDesk();
  const catalogDesk = options?.catalogDesk ?? new FixtureCatalogDiscoveryDesk();
  const catalogObservationDesk =
    options?.catalogObservationDesk ??
    new CatalogObservationDesk({
      ...(supportsCatalogObservations(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const catalogRefreshScheduler =
    options?.catalogRefreshScheduler ??
    new CatalogRefreshScheduler({
      desk: catalogObservationDesk,
      intervalMs: parseCatalogRefreshInterval(process.env),
    });
  const discoveryLedger =
    options?.discoveryLedger ?? new DiscoveryLedger(25, options?.discoveryStore);
  const investigationDesk =
    options?.investigationDesk ??
    new InvestigationDesk(
      piRuntime.investigator,
      10,
      options?.investigationStore ??
        (supportsInvestigationRecords(options?.discoveryStore)
          ? options.discoveryStore
          : undefined),
    );
  const realCandidatePreflightDesk =
    options?.realCandidatePreflightDesk ?? new RealCandidatePreflightDesk();
  const candidateWatchDesk =
    options?.candidateWatchDesk ??
    new CandidateWatchDesk({
      evidenceDesk: realCandidatePreflightDesk,
      ...(supportsCandidateWatch(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const marketArchaeologistDesk =
    options?.marketArchaeologistDesk ??
    createMarketArchaeologistDesk(process.env, {
      usageRecorder: aiUsageLedger,
      ...(supportsMarketArchaeologistRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const searchQuoteEnrichmentDesk =
    options?.searchQuoteEnrichmentDesk ??
    new SearchQuoteEnrichmentDesk({
      ...(supportsSearchQuoteObservations(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  let graphContextForLease:
    | ((snapshot: MarketCorpusSnapshot, lens: SearchLens) => SemanticGraphSearchContext)
    | undefined;
  let publishSearchLeaseChange: () => void = () => undefined;
  const searchLeaseStageBudget = parseSearchLeaseStageBudget(process.env, {
    fastDeadlineMs: modelRuntime.projection.timeoutMs,
    deepDeadlineMs: piRuntime.projection.timeoutMs,
  });
  const searchLeaseScheduler =
    options?.searchLeaseScheduler ??
    new SearchLeaseScheduler({
      intervalMs: parseSearchLeaseInterval(process.env),
      concurrencyLimit: 3,
      registeredVenueIds: catalogObservationDesk.registeredVenueIds(),
      ...searchLeaseStageBudget,
      onRecordChange: () => publishSearchLeaseChange(),
      context: (
        question,
        venueIds,
        lens,
        snapshot,
        feedback,
        candidatePolicy,
        semanticFamily,
      ) => {
        const minimumEligibleVenueCount =
          semanticFamily !== null ||
            (lens === "PARTITION" && candidatePolicy?.requireDistinctVenues !== true)
            ? 1
            : 2;
        let retrievalPlan: SemanticFamilyRetrievalPlan | undefined;
        const selection = catalogObservationDesk.resilientContext(
          venueIds,
          minimumEligibleVenueCount,
          (eligibleVenueIds) => {
            if (semanticFamily !== null) {
              const familySelection = buildSemanticFamilyCatalogSelection({
                source: "QUALIFIED_LIVE_OBSERVATIONS",
                corpusIdentity: snapshot.snapshotIdentity,
                listings: snapshot.listings,
                question,
                eligibleVenueIds,
                semanticFamily,
                maxContextListings: candidatePolicy?.maxCorpusListings ?? 30,
                feedback,
              });
              retrievalPlan = familySelection.retrievalPlan;
              return familySelection.catalogContext;
            }
            if (lens === "EQUIVALENCE") {
              if (candidatePolicy?.candidateSelection === "MODEL_HYPOTHESIS") {
                try {
                  return catalogObservationDesk.radarSearchContext(
                    eligibleVenueIds,
                    feedback,
                  );
                } catch (error) {
                  if (!(error instanceof RadarCandidateUnavailableError)) throw error;
                }
              }
              const allowedVenues = new Set(eligibleVenueIds);
              const candidates = orderRadarCandidatesForSearch(
                catalogObservationDesk.radar().candidates.filter((candidate) =>
                  candidate.listings.every((listing) =>
                    allowedVenues.has(listing.venueId)
                  )
                ),
                feedback,
              );
              for (const candidate of candidates) {
                try {
                  return catalogObservationDesk.radarTriageScope(
                    candidate.candidateId,
                  ).catalogContext;
                } catch (error) {
                  if (!(error instanceof RadarCandidateUnavailableError)) throw error;
                }
              }
            }
            return catalogObservationDesk.rotatingContext(
              question,
              eligibleVenueIds,
              feedback,
            );
          },
        );
        return retrievalPlan === undefined
          ? selection
          : Object.freeze({ ...selection, retrievalPlan });
      },
      graphContext: (snapshot, lens) => {
        if (graphContextForLease === undefined) {
          throw new Error("semantic relation graph is not initialized");
        }
        return graphContextForLease(snapshot, lens);
      },
      runFast: async (task, maxModelRequests) => {
        const existing = discoveryLedger.findByTaskId(task.taskId);
        if (existing !== undefined) return existing;
        return discoveryLedger.record(
          task,
          await pool.run(task, { maxModelWorkers: maxModelRequests }),
        );
      },
      enrichPrices: (listings) => searchQuoteEnrichmentDesk.enrich(listings),
      ...(marketArchaeologistDesk.projection().configured
        ? {
            runDeep: async (snapshot, question) => {
              const record = await marketArchaeologistDesk.begin(
                snapshot,
                question,
                "SCHEDULE",
              ).promise;
              return Object.freeze({
                runId: record.runId,
                status: record.status === "PASS" ? "PASS" as const : "FAILED" as const,
                proposalIds: Object.freeze(
                  record.report?.result.proposals.map((item) => item.proposalId) ?? [],
                ),
                proposalDetails: Object.freeze(
                  record.report?.result.proposals.map((item) => Object.freeze({
                    proposalId: item.proposalId,
                    relationKind: item.relationKind,
                    listingRefs: Object.freeze([...item.listingRefs]),
                  })) ?? [],
                ),
                evidenceGaps: Object.freeze(
                  record.report?.result.missingEvidence ?? [],
                ),
                diagnostic: record.diagnostic,
              });
            },
          }
        : {}),
      ...(supportsSearchLeaseRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const searchIssueScheduler =
    options?.searchIssueScheduler ??
    new SearchIssueScheduler({
      leaseScheduler: searchLeaseScheduler,
      tickIntervalMs: parseSearchIssueTickInterval(process.env),
      concurrencyLimit: 3,
      ...(supportsSearchIssueRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const searchAttentionOutbox =
    options?.searchAttentionOutbox ??
    new SearchAttentionOutbox({
      webhookUrl: parseSearchAttentionWebhook(process.env),
      ...(supportsSearchAttentionRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const semanticReviewDesk =
    options?.semanticReviewDesk ??
    createSemanticReviewDesk(process.env, {
      usageRecorder: aiUsageLedger,
      ...(supportsSemanticReviewRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const probabilityEstimationDesk =
    options?.probabilityEstimationDesk ??
    createProbabilityEstimationDesk(process.env, {
      usageRecorder: aiUsageLedger,
      ...(supportsProbabilityEstimationRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const probabilityEstimationScheduler =
    options?.probabilityEstimationScheduler ??
    new ProbabilityEstimationScheduler({
      desk: probabilityEstimationDesk,
      tickIntervalMs: parseProbabilityEstimationTickInterval(process.env),
      concurrencyLimit: 3,
      maxRequestsPerTick: 3,
      ...(supportsProbabilityEstimationSchedulerRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const probabilityCalibrationDesk = options?.probabilityCalibrationDesk ??
    new ProbabilityCalibrationDesk({
      boundSource: () => probabilityEstimationScheduler.projection().bounds,
      ...(supportsProbabilityCalibrationRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const probabilityResolutionAcquisitionScheduler =
    options?.probabilityResolutionAcquisitionScheduler ??
    new ProbabilityResolutionAcquisitionScheduler({
      sink: probabilityCalibrationDesk,
      intervalMs: parseProbabilityResolutionInterval(process.env),
      ...(supportsProbabilityResolutionCaptures(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const semanticReviewScheduler =
    options?.semanticReviewScheduler ??
    new SemanticReviewScheduler({
      reviewDesk: semanticReviewDesk,
      tickIntervalMs: parseSemanticReviewTickInterval(process.env),
      concurrencyLimit: 3,
      maxRequestsPerTick: 3,
      ...(supportsSemanticReviewSchedulerRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const premiseAnalysisDesk = options?.premiseAnalysisDesk ??
    createPremiseAnalysisDesk(process.env, {
      usageRecorder: aiUsageLedger,
      ...(supportsPremiseAnalysisRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const premiseAnalysisScheduler = options?.premiseAnalysisScheduler ??
    new PremiseAnalysisScheduler({
      desk: premiseAnalysisDesk,
      tickIntervalMs: parsePremiseAnalysisTickInterval(process.env),
      concurrencyLimit: 3,
      maxRequestsPerTick: 3,
      ...(supportsPremiseAnalysisSchedulerRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const evidenceAcquisitionScheduler =
    options?.evidenceAcquisitionScheduler ??
    new EvidenceAcquisitionScheduler({
      fetcher: new EvidenceDocumentFetcher({
        trustClashFakeIp: process.env.PMH_EVIDENCE_TRUST_CLASH_FAKE_IP === "1",
      }),
      tickIntervalMs: parseEvidenceAcquisitionTickInterval(process.env),
      concurrencyLimit: 3,
      maxRequestsPerTick: 3,
      ...(supportsEvidenceAcquisitionRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const ruleEvidenceClaimDesk = options?.ruleEvidenceClaimDesk ??
    createRuleEvidenceClaimDesk(process.env, {
      usageRecorder: aiUsageLedger,
      ...(supportsRuleEvidenceClaimRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const ruleEvidenceClaimScheduler = options?.ruleEvidenceClaimScheduler ??
    new RuleEvidenceClaimScheduler({
      desk: ruleEvidenceClaimDesk,
      tickIntervalMs: parseRuleEvidenceClaimTickInterval(process.env),
      concurrencyLimit: 3,
      maxRequestsPerTick: 3,
      ...(supportsRuleEvidenceClaimSchedulerRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const opportunityLifecycleDesk =
    options?.opportunityLifecycleDesk ??
    new OpportunityLifecycleDesk(
      undefined,
      supportsOpportunityLifecycleJournals(options?.discoveryStore)
        ? options.discoveryStore
        : undefined,
    );
  const simulationMaterializerDesk =
    options?.simulationMaterializerDesk ??
    new AnonymousSimulationMaterializerDesk({
      ...(supportsAnonymousSimulationMaterializations(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const relationPayoffProposalAttributions = () => {
    const issues = new Map(searchIssueScheduler.projection().issues.map((issue) =>
      [issue.issueId, issue] as const
    ));
    return Object.freeze(semanticReviewScheduler.projection().jobs.flatMap((job) => {
      if (job.issueIds.length === 0) return [];
      const semanticFamilies = Object.freeze([...new Set(job.issueIds.flatMap((issueId) => {
        const family = issues.get(issueId)?.familyDefinition?.semanticFamily;
        return family === undefined ? [] : [family];
      }))].sort());
      return [Object.freeze({
        proposalId: job.proposalId,
        issueIds: Object.freeze([...job.issueIds].sort()),
        semanticFamilies,
      })];
    }));
  };
  const semanticGraph = (snapshot: MarketCorpusSnapshot) => {
    const archaeologist = marketArchaeologistDesk.projection();
    opportunityLifecycleDesk.syncMarketArchaeologist(archaeologist);
    const lifecycle = opportunityLifecycleDesk.projection();
    const semanticReviews = semanticReviewDesk.projection();
    const relationPayoff = deriveRelationPayoffProjection({
      archaeologist,
      semanticReviews: semanticReviews.records,
      semanticDecisions: lifecycle.semanticDecisions,
      premiseAnalyses: premiseAnalysisDesk.projection().records,
      proposalAttributions: relationPayoffProposalAttributions(),
    });
    return buildSemanticRelationGraph({
      corpus: snapshot,
      archaeologist,
      searchLeases: searchLeaseScheduler.projection(),
      semanticReviews,
      lifecycle,
      relationPayoff,
      materializations: simulationMaterializerDesk.projection(),
    });
  };
  graphContextForLease = (snapshot, lens) =>
    searchSemanticGraphNeighborhood(semanticGraph(snapshot), lens);
  const baseSemanticReviewCandidates = (): readonly SemanticReviewCandidate[] => {
    const issues = new Map(
      searchIssueScheduler.projection().issues.map((issue) => [issue.issueId, issue] as const),
    );
    const lineage = new Map<Hash, { issueIds: Set<Hash>; priority: 1 | 2 | 3 | 4 | 5 }>();
    for (const lease of searchLeaseScheduler.projection().records) {
      const issueId = lease.lease.issueId;
      if (
        lease.status !== "PASS" || lease.deepLane.status !== "PASS" ||
        issueId === null || issueId === undefined
      ) continue;
      const issue = issues.get(issueId);
      if (issue === undefined) continue;
      for (const proposalId of lease.deepLane.proposalIds) {
        const key = proposalId as Hash;
        const current = lineage.get(key) ?? { issueIds: new Set<Hash>(), priority: 1 as const };
        current.issueIds.add(issueId);
        if (issue.priority > current.priority) current.priority = issue.priority;
        lineage.set(key, current);
      }
    }
    for (const job of semanticReviewScheduler.projection().jobs) {
      const current = lineage.get(job.proposalId);
      const issueIds = new Set<Hash>(current?.issueIds ?? []);
      for (const issueId of job.issueIds) issueIds.add(issueId);
      const issuePriorities = [...issueIds].flatMap((issueId) => {
        const issue = issues.get(issueId);
        return issue === undefined ? [] : [issue.priority];
      });
      lineage.set(job.proposalId, {
        issueIds,
        // A retained job stores effective priority. Re-derive the base from its
        // issue lineage so a current-price boost cannot compound across ticks.
        priority: recoverBaseReviewPriority({
          issuePriorities,
          retainedJobPriority: current?.priority ?? job.priority,
        }),
      });
    }
    const sources = new Map<Hash, {
      proposal: SemanticReviewCandidate["proposal"];
      proposalCorpusSnapshotIdentity: Hash;
      evidenceBundle: SemanticReviewCandidate["evidenceBundle"];
    }>();
    const currentSnapshot = catalogObservationDesk.corpus();
    const jobsByProposal = new Map(
      semanticReviewScheduler.projection().jobs.map((job) => [job.proposalId, job] as const),
    );
    for (const record of marketArchaeologistDesk.projection().records) {
      if (record.status !== "PASS" || record.report === null) continue;
      const reportBundles = new Map(
        (record.report.result.proposalEvidenceBundles ?? []).flatMap(
          (bundle) => bundle.schemaVersion === "pmh.proposal-evidence-bundle.v2"
            ? [[bundle.proposalId, bundle] as const]
            : [],
        ),
      );
      for (const proposal of record.report.result.proposals) {
        if (!sources.has(proposal.proposalId)) {
          const storedJobBundle = jobsByProposal.get(proposal.proposalId)?.evidenceBundle;
          let evidenceBundle =
            reportBundles.get(proposal.proposalId) ??
            (storedJobBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2"
              ? storedJobBundle
              : null) ??
            null;
          if (
            evidenceBundle === null &&
            proposal.listingRefs.every((listingRef) =>
              currentSnapshot.listings.some((listing) => listing.listingRef === listingRef)
            )
          ) {
            evidenceBundle = buildProposalEvidenceBundle(
              proposal,
              currentSnapshot,
              record.corpusSnapshotIdentity,
            );
          }
          sources.set(proposal.proposalId, {
            proposal,
            proposalCorpusSnapshotIdentity: record.corpusSnapshotIdentity,
            evidenceBundle,
          });
        }
      }
    }
    for (const job of semanticReviewScheduler.projection().jobs) {
      const bundle = job.evidenceBundle ?? null;
      if (
        bundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2" &&
        !sources.has(job.proposalId)
      ) {
        sources.set(job.proposalId, {
          proposal: bundle.proposal,
          proposalCorpusSnapshotIdentity: job.proposalCorpusSnapshotIdentity,
          evidenceBundle: bundle,
        });
      }
    }
    return Object.freeze([...lineage.entries()].flatMap(([proposalId, item]) => {
      const source = sources.get(proposalId);
      return source === undefined ? [] : [Object.freeze({
        ...source,
        issueIds: Object.freeze([...item.issueIds].sort()),
        priority: item.priority,
      })];
    }).sort((left, right) =>
      right.priority - left.priority ||
      left.proposal.proposalId.localeCompare(right.proposal.proposalId)
    ));
  };
  const semanticReviewCandidates = (): readonly SemanticReviewCandidate[] => {
    const recordsById = new Map(ruleEvidenceClaimDesk.projection().records.map((record) =>
      [record.interpretationId, record] as const
    ));
    const inputs = ruleEvidenceClaimInputs();
    const existingClaims = new Map(semanticReviewScheduler.projection().jobs.map((job) =>
      [job.proposalId, job.evidenceClaims ?? []] as const
    ));
    const candidates = baseSemanticReviewCandidates().map((candidate) => {
      const proposalInputs = inputs.filter((input) =>
        input.requirement.proposalId === candidate.proposal.proposalId
      );
      const claims = proposalInputs.length === 0
        ? []
        : proposalInputs.flatMap((input) => {
            const id = ruleEvidenceClaimDesk.interpretationIdFor(
              input.requirement,
              input.capture,
            );
            const record = recordsById.get(id);
            return record?.status === "PASS" && record.claim !== null ? [record.claim] : [];
          });
      const completeCurrentSet = proposalInputs.length > 0 &&
        claims.length === proposalInputs.length;
      const retainedClaims = completeCurrentSet
        ? claims
        : existingClaims.get(candidate.proposal.proposalId) ?? [];
      return Object.freeze({
        ...candidate,
        ...(retainedClaims.length === 0
          ? {}
          : { evidenceClaims: Object.freeze(retainedClaims) }),
      });
    });
    return applyProposalEconomicPriority(
      candidates,
      buildProposalEconomicTriage({
        candidates,
        corpus: catalogObservationDesk.corpus(),
      }),
    );
  };
  const premiseAnalysisCandidates = (): readonly PremiseAnalysisCandidate[] => {
    const proposals = new Map(
      semanticReviewCandidates().map((candidate) =>
        [candidate.proposal.proposalId, candidate.proposal] as const
      ),
    );
    const reviewJobs = new Map(semanticReviewScheduler.projection().jobs.flatMap((job) =>
      job.status === "PASS" && job.lastReviewId !== null
        ? [[job.lastReviewId, job] as const]
        : []
    ));
    return Object.freeze(semanticReviewDesk.projection().records.flatMap((review) => {
      const proposal = proposals.get(review.proposalId);
      const reviewJob = reviewJobs.get(review.reviewId);
      const admission = proposal === undefined
        ? null
        : classifySemanticReviewAdmission(proposal);
      if (
        proposal === undefined || review.status !== "PASS" || review.report === null ||
        review.report.result.semanticConstraint === undefined ||
        proposal.listingRefs.length < 2 || proposal.listingRefs.length > 4 ||
        reviewJob === undefined || admission === null || admission.lane === "RESEARCH_ONLY"
      ) return [];
      return [Object.freeze({
        proposal,
        review,
        semanticReviewJobId: reviewJob.jobId,
        issueIds: reviewJob.issueIds,
        admissionLane: admission.lane,
      })];
    }).sort((left, right) =>
      left.review.completedAt!.localeCompare(right.review.completedAt!) ||
      left.review.reviewId.localeCompare(right.review.reviewId)
    ));
  };
  const probabilityEstimationCandidates = (): readonly ProbabilityEstimationCandidate[] =>
    Object.freeze(semanticReviewDesk.projection().records.flatMap((review) =>
      review.status === "PASS" && review.report !== null &&
          review.report.result.semanticConstraint?.classification === "PROBABILISTIC_DEPENDENCE"
        ? [Object.freeze({ review })]
        : []
    ));
  const evidenceRequirements = (): readonly EvidenceRequirement[] => Object.freeze([
    ...marketArchaeologistDesk.projection().records.flatMap((record) =>
      record.status === "PASS" && record.report !== null
        ? record.report.result.evidenceRequirements ?? []
        : []
    ),
    ...semanticReviewDesk.projection().records.flatMap((record) =>
      record.status === "PASS" && record.report !== null
        ? record.report.result.evidenceRequirements ?? []
        : []
    ),
  ].filter((requirement, index, all) =>
    all.findIndex((candidate) => candidate.requirementId === requirement.requirementId) === index
  ));
  const ruleEvidenceClaimInputs = (): readonly RuleEvidenceClaimInput[] => Object.freeze(
    evidenceAcquisitionScheduler.projection().jobs.flatMap((job) => {
      if (job.status !== "CAPTURED") return [];
      const capture = evidenceAcquisitionScheduler.captureForJob(job.jobId);
      if (capture === null) return [];
      return job.requirements.map((requirement) => Object.freeze({ requirement, capture }));
    }),
  );
  const ready = (options?.startupGate ?? Promise.resolve()).then(async () => {
    const realCandidateReady = realCandidatePreflightDesk.load();
    await Promise.all([
      bookDesk.replay(),
      catalogDesk.load(),
      realCandidateReady,
      realCandidateReady.then(() => candidateWatchDesk.load()),
      ...(options?.refreshCatalogOnReady === true
        ? [catalogRefreshScheduler.runNow("STARTUP").promise]
        : []),
    ]);
  });
  const subscribers = new Set<ServerResponse>();
  const pendingRuns = new Map<
    string,
    Readonly<{
      scopeHash: string;
      promise: Promise<DiscoveryRunRecord>;
    }>
  >();
  let activeRuns = 0;
  const projection = async () => {
    await ready;
    const archaeologistProjection = marketArchaeologistDesk.projection();
    const realCandidateDisposition =
      realCandidatePreflightDesk.dispositionProjection();
    opportunityLifecycleDesk.syncMarketArchaeologist(archaeologistProjection);
    opportunityLifecycleDesk.syncRealCandidate(realCandidateDisposition);
    const semanticReviewProjection = semanticReviewDesk.projection();
    const baseReviewCandidates = baseSemanticReviewCandidates();
    const semanticReviewAdmission = buildSemanticReviewAdmissionProjection(
      baseReviewCandidates.map((candidate) => candidate.proposal),
    );
    const economicTriageProjection = buildProposalEconomicTriage({
      candidates: baseReviewCandidates,
      corpus: catalogObservationDesk.corpus(),
    });
    semanticReviewScheduler.reconcile(
      semanticReviewCandidates(),
      semanticReviewProjection.records,
    );
    probabilityEstimationScheduler.reconcile(
      probabilityEstimationCandidates(),
      catalogObservationDesk.corpus(),
    );
    premiseAnalysisScheduler.reconcile(premiseAnalysisCandidates());
    evidenceAcquisitionScheduler.reconcile(evidenceRequirements());
    ruleEvidenceClaimScheduler.reconcile(ruleEvidenceClaimInputs());
    const semanticReviewSchedulerProjection = semanticReviewScheduler.projection();
    const semanticReviewAttributionSource = semanticReviewScheduler.attributionSource();
    const premiseAnalysisProjection = premiseAnalysisDesk.projection();
    const premiseAnalysisSchedulerProjection = premiseAnalysisScheduler.projection();
    const evidenceAcquisitionProjection = evidenceAcquisitionScheduler.projection();
    const ruleEvidenceClaimProjection = ruleEvidenceClaimScheduler.projection();
    const lifecycleProjection = opportunityLifecycleDesk.projection();
    const searchLeaseProjection = searchLeaseScheduler.projection();
    const searchIssueProjection = searchIssueScheduler.projection();
    const materializerProjection = simulationMaterializerDesk.projection();
    const relationPayoff = deriveRelationPayoffProjection({
      archaeologist: archaeologistProjection,
      semanticReviews: semanticReviewProjection.records,
      semanticDecisions: lifecycleProjection.semanticDecisions,
      premiseAnalyses: premiseAnalysisProjection.records,
      proposalAttributions: relationPayoffProposalAttributions(),
    });
    const reviewAttention = buildReviewAttentionProjection({
      archaeologist: archaeologistProjection,
      semanticReviews: semanticReviewProjection.records,
      semanticReviewJobs: semanticReviewSchedulerProjection.jobs,
      semanticDecisions: lifecycleProjection.semanticDecisions,
      corpus: catalogObservationDesk.corpus(),
    });
    const semanticRelationGraph = buildSemanticRelationGraph({
      corpus: catalogObservationDesk.corpus(),
      archaeologist: archaeologistProjection,
      searchLeases: searchLeaseProjection,
      semanticReviews: semanticReviewProjection,
      lifecycle: lifecycleProjection,
      relationPayoff,
      materializations: materializerProjection,
      discoveryDesk: discoveryLedger.projection(),
    });
    const searchOutcomeAttribution = buildSearchOutcomeAttribution({
      issues: searchIssueProjection.issues,
      searchLeases: searchLeaseProjection.records,
      semanticReviewJobSource: semanticReviewAttributionSource,
      semanticReviews: semanticReviewProjection.records,
      lifecycle: lifecycleProjection,
      materializations: materializerProjection.records,
      proposalEconomicTriage: economicTriageProjection,
    });
    return buildStudioProjection({
      workers: pool.workers,
      activeRuns,
      modelProvider: modelRuntime.projection,
      investigator: piRuntime.projection,
      investigationDesk: investigationDesk.projection(),
      catalogContext: catalogDesk.projection(),
      catalogObservation: catalogObservationDesk.projection(),
      catalogRefreshScheduler: catalogRefreshScheduler.projection(),
      opportunityRadar: catalogObservationDesk.radar(),
      marketCorpus: projectMarketCorpus(catalogObservationDesk.corpus()),
      marketArchaeologist: archaeologistProjection,
      searchLeaseScheduler: searchLeaseProjection,
      searchQuoteEnrichment: searchQuoteEnrichmentDesk.projection(),
      searchAttention: searchAttentionOutbox.projection(),
      searchIssueScheduler: searchIssueProjection,
      searchOutcomeAttribution,
      semanticReview: semanticReviewProjection,
      probabilityEstimation: probabilityEstimationDesk.projection(),
      probabilityEstimationScheduler: probabilityEstimationScheduler.projection(),
      probabilityCalibration: probabilityCalibrationDesk.projection(),
      probabilityResolutionAcquisition: probabilityResolutionAcquisitionScheduler.projection(),
      aiUsage: aiUsageLedger.projection(),
      runtimeConfiguration: aiRuntimeConfigurationDesk.projection(),
      semanticReviewAdmission,
      semanticReviewScheduler: semanticReviewSchedulerProjection,
      premiseAnalysis: premiseAnalysisProjection,
      premiseAnalysisScheduler: premiseAnalysisSchedulerProjection,
      evidenceAcquisition: evidenceAcquisitionProjection,
      ruleEvidenceClaims: ruleEvidenceClaimProjection,
      reviewAttention,
      proposalEconomicTriage: economicTriageProjection,
      semanticRelationGraph,
      opportunityLifecycle: lifecycleProjection,
      relationPayoff,
      simulationMaterializer: materializerProjection,
      bookDesk: bookDesk.projection(),
      discoveryDesk: discoveryLedger.projection(),
      realCandidatePreflight: realCandidatePreflightDesk.projection(),
      realCandidateDepth: realCandidatePreflightDesk.depthProjection(),
      realCandidateDisposition,
      realCandidateRescreen: realCandidatePreflightDesk.rescreenProjection(),
      candidateWatch: candidateWatchDesk.projection(),
    });
  };
  const liveProjection = async () => buildLiveStudioProjection(await projection());

  const broadcastProjection = async (): Promise<void> => {
    const payload = `event: projection\ndata: ${JSON.stringify(
      await liveProjection(),
    )}\n\n`;
    for (const subscriber of subscribers) {
      if (subscriber.destroyed) {
        subscribers.delete(subscriber);
      } else {
        subscriber.write(payload);
      }
    }
  };
  publishSearchLeaseChange = () => {
    void broadcastProjection();
  };
  void ready.then(() => {
    for (const promise of searchLeaseScheduler.resumeDeepWork()) {
      void promise.then(
        () => broadcastProjection(),
        () => broadcastProjection(),
      );
    }
  });

  const invokeDiscovery = async (
    task: DiscoveryTask,
  ): Promise<
    Readonly<{ record: DiscoveryRunRecord; idempotentReplay: boolean }>
  > => {
    const existing = discoveryLedger.findByTaskId(task.taskId);
    if (existing !== undefined) {
      if (!recordMatchesTask(existing, task)) {
        throw new DiscoveryScopeConflictError(
          "taskId is already bound to another discovery scope",
        );
      }
      return Object.freeze({ record: existing, idempotentReplay: true });
    }
    const scopeHash = taskScopeHash(task);
    const pending = pendingRuns.get(task.taskId);
    if (pending !== undefined) {
      if (pending.scopeHash !== scopeHash) {
        throw new DiscoveryScopeConflictError(
          "taskId is already running with another discovery scope",
        );
      }
      return Object.freeze({
        record: await pending.promise,
        idempotentReplay: true,
      });
    }
    const promise = (async (): Promise<DiscoveryRunRecord> => {
      activeRuns += 1;
      try {
        await broadcastProjection();
        const run = await pool.run(task);
        return discoveryLedger.record(task, run);
      } finally {
        activeRuns -= 1;
        await broadcastProjection();
      }
    })();
    pendingRuns.set(task.taskId, { scopeHash, promise });
    try {
      return Object.freeze({
        record: await promise,
        idempotentReplay: false,
      });
    } finally {
      if (pendingRuns.get(task.taskId)?.promise === promise) {
        pendingRuns.delete(task.taskId);
      }
    }
  };

  const retainedDiscoveryTask = (
    taskId: string,
    deadlineMs: number,
  ): DiscoveryTask => {
    const record = discoveryLedger.findByTaskId(taskId);
    if (record === undefined || record.catalogContext === undefined) {
      throw new ResearchContextUnavailableError(
        "research task has no retained exact catalog context",
      );
    }
    return Object.freeze({
      taskId: record.taskId,
      question: record.question,
      venueIds: record.venueIds,
      maxHypotheses: 10,
      deadlineEpochMs: Date.now() + deadlineMs,
      catalogContext: record.catalogContext,
    });
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://control-plane.local");
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "http://localhost:5173",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/health") {
      await ready;
      const discoveryDesk = discoveryLedger.projection();
      writeJson(response, 200, {
        ok: true,
        liveExecutionEnabled: false,
        retainedDiscoveryRuns: discoveryDesk.runCount,
        operationalStorage: discoveryDesk.storage,
        modelProvider: modelRuntime.projection,
        investigator: piRuntime.projection,
        investigationDesk: investigationDesk.projection(),
        catalogContext: catalogDesk.projection(),
        catalogObservation: catalogObservationDesk.projection(),
        catalogRefreshScheduler: catalogRefreshScheduler.projection(),
        opportunityRadar: catalogObservationDesk.radar(),
        marketCorpus: projectMarketCorpus(catalogObservationDesk.corpus()),
        marketArchaeologist: marketArchaeologistDesk.projection(),
        searchQuoteEnrichment: searchQuoteEnrichmentDesk.projection(),
        searchAttention: searchAttentionOutbox.projection(),
        semanticRelationGraph: semanticGraph(catalogObservationDesk.corpus()),
        semanticReview: semanticReviewDesk.projection(),
        probabilityEstimation: probabilityEstimationDesk.projection(),
        probabilityEstimationScheduler: probabilityEstimationScheduler.projection(),
        probabilityCalibration: probabilityCalibrationDesk.projection(),
        probabilityResolutionAcquisition: probabilityResolutionAcquisitionScheduler.projection(),
        aiUsage: aiUsageLedger.projection(),
        runtimeConfiguration: aiRuntimeConfigurationDesk.projection(),
        premiseAnalysis: premiseAnalysisDesk.projection(),
        premiseAnalysisScheduler: premiseAnalysisScheduler.projection(),
        evidenceAcquisition: evidenceAcquisitionScheduler.projection(),
        ruleEvidenceClaims: ruleEvidenceClaimScheduler.projection(),
        semanticReviewAdmission: buildSemanticReviewAdmissionProjection(
          baseSemanticReviewCandidates().map((candidate) => candidate.proposal),
        ),
        opportunityLifecycle: opportunityLifecycleDesk.projection(),
        realCandidatePreflight: realCandidatePreflightDesk.projection(),
        realCandidateDepth: realCandidatePreflightDesk.depthProjection(),
        realCandidateDisposition:
          realCandidatePreflightDesk.dispositionProjection(),
        realCandidateRescreen: realCandidatePreflightDesk.rescreenProjection(),
        candidateWatch: candidateWatchDesk.projection(),
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/projection") {
      const view = url.searchParams.get("view") ?? "live";
      if (view === "live") {
        writeJson(response, 200, await liveProjection());
      } else if (view === "full") {
        writeJson(response, 200, await projection());
      } else {
        writeJson(response, 400, {
          ok: false,
          diagnostic: "projection view must be live or full",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/ai-runtime/configuration"
    ) {
      try {
        const update = parseAiRuntimeConfigurationUpdate(await readJson(request));
        const configuration = aiRuntimeConfigurationDesk.update(update);
        if (options?.modelRuntime === undefined) {
          modelRuntime = modelRuntimeFactory(configuration);
          if (options?.discoveryPool === undefined) {
            pool = new DiscoveryPool([
              worker,
              ...modelRuntime.workers,
            ]);
          }
        }
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          runtimeConfiguration: aiRuntimeConfigurationDesk.projection(),
          modelProvider: modelRuntime.projection,
          executionAuthority: false,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof AiRuntimeConfigurationConflictError ? 409 : 400,
          {
            ok: false,
            diagnostic: error instanceof Error ? error.message : "configuration update failed",
            runtimeConfiguration: aiRuntimeConfigurationDesk.projection(),
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/search-outcome-attribution"
    ) {
      const current = await projection();
      writeJson(response, 200, current.ai.searchOutcomeAttribution);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/probability-calibration"
    ) {
      await ready;
      writeJson(response, 200, probabilityCalibrationDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/probability-resolution-acquisition"
    ) {
      await ready;
      writeJson(response, 200, probabilityResolutionAcquisitionScheduler.projection());
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/probability-resolution-acquisition/runs"
    ) {
      try {
        await ready;
        await probabilityResolutionAcquisitionScheduler.runNow();
        await broadcastProjection();
        writeJson(response, 200, Object.freeze({
          ok: true,
          probabilityResolutionAcquisition:
            probabilityResolutionAcquisitionScheduler.projection(),
          probabilityCalibration: probabilityCalibrationDesk.projection(),
          executionAuthority: false as const,
        }));
      } catch (error) {
        writeJson(response, 502, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "resolution acquisition failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/probability-calibration/observations"
    ) {
      try {
        await ready;
        const result = probabilityCalibrationDesk.recordResolution(
          parseProbabilityCalibrationResolution(await readJson(request)),
        );
        await broadcastProjection();
        writeJson(response, result.idempotentReplay ? 200 : 201, Object.freeze({
          ok: true,
          ...result,
          probabilityCalibration: probabilityCalibrationDesk.projection(),
          executionAuthority: false as const,
        }));
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "probability calibration resolution failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/semantic-review-admission"
    ) {
      const current = await projection();
      writeJson(response, 200, current.ai.semanticReviewAdmission);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/semantic-review-scheduler"
    ) {
      await ready;
      semanticReviewScheduler.reconcile(
        semanticReviewCandidates(),
        semanticReviewDesk.projection().records,
      );
      writeJson(response, 200, semanticReviewScheduler.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/premise-analysis"
    ) {
      await ready;
      premiseAnalysisScheduler.reconcile(premiseAnalysisCandidates());
      writeJson(response, 200, Object.freeze({
        desk: premiseAnalysisDesk.projection(),
        scheduler: premiseAnalysisScheduler.projection(),
      }));
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/evidence-acquisition"
    ) {
      await ready;
      evidenceAcquisitionScheduler.reconcile(evidenceRequirements());
      writeJson(response, 200, evidenceAcquisitionScheduler.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/rule-evidence-claims"
    ) {
      await ready;
      evidenceAcquisitionScheduler.reconcile(evidenceRequirements());
      ruleEvidenceClaimScheduler.reconcile(ruleEvidenceClaimInputs());
      writeJson(response, 200, ruleEvidenceClaimScheduler.projection());
      return;
    }
    const reviewNotificationAckMatch = url.pathname.match(
      /^\/api\/v1\/semantic-review-notifications\/(sha256:[0-9a-f]{64})\/acknowledgements$/u,
    );
    if (request.method === "POST" && reviewNotificationAckMatch !== null) {
      try {
        const notification = semanticReviewScheduler.acknowledge(
          reviewNotificationAckMatch[1] as Hash,
        );
        await broadcastProjection();
        writeJson(response, 200, notification);
      } catch (error) {
        writeJson(response, 404, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "semantic review notification acknowledgement failed",
          executionAuthority: false,
        });
      }
      return;
    }
    const premiseNotificationAckMatch = url.pathname.match(
      /^\/api\/v1\/premise-analysis-notifications\/(sha256:[0-9a-f]{64})\/acknowledgements$/u,
    );
    if (request.method === "POST" && premiseNotificationAckMatch !== null) {
      try {
        const notification = premiseAnalysisScheduler.acknowledge(
          premiseNotificationAckMatch[1] as Hash,
        );
        await broadcastProjection();
        writeJson(response, 200, notification);
      } catch (error) {
        writeJson(response, 404, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "premise analysis notification acknowledgement failed",
          executionAuthority: false,
        });
      }
      return;
    }
    const probabilityNotificationAckMatch = url.pathname.match(
      /^\/api\/v1\/probability-estimation-notifications\/(sha256:[0-9a-f]{64})\/acknowledgements$/u,
    );
    if (request.method === "POST" && probabilityNotificationAckMatch !== null) {
      try {
        const notification = probabilityEstimationScheduler.acknowledge(
          probabilityNotificationAckMatch[1] as Hash,
        );
        await broadcastProjection();
        writeJson(response, 200, notification);
      } catch (error) {
        writeJson(response, 404, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "probability estimation notification acknowledgement failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/books") {
      await ready;
      writeJson(response, 200, bookDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/catalog/observations"
    ) {
      writeJson(response, 200, catalogObservationDesk.projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/radar") {
      await ready;
      writeJson(response, 200, catalogObservationDesk.radar());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/market-corpus") {
      await ready;
      writeJson(
        response,
        200,
        projectMarketCorpus(catalogObservationDesk.corpus()),
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/semantic-relation-graph"
    ) {
      await ready;
      writeJson(response, 200, semanticGraph(catalogObservationDesk.corpus()));
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/opportunity-lifecycle/materializations"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          typeof (body as { opportunityId?: unknown }).opportunityId !== "string" ||
          typeof (body as { portfolioId?: unknown }).portfolioId !== "string" ||
          typeof (body as { requestedQuantity?: unknown }).requestedQuantity !== "string" ||
          Object.keys(body).length !== 3
        ) {
          throw new Error(
            "materialization requires exactly opportunityId, portfolioId, and requestedQuantity",
          );
        }
        const archaeologist = marketArchaeologistDesk.projection();
        const semanticReviews = semanticReviewDesk.projection();
        const lifecycle = opportunityLifecycleDesk.projection();
        const relationPayoff = deriveRelationPayoffProjection({
          archaeologist,
          semanticReviews: semanticReviews.records,
          semanticDecisions: lifecycle.semanticDecisions,
          premiseAnalyses: premiseAnalysisDesk.projection().records,
          proposalAttributions: relationPayoffProposalAttributions(),
        });
        const opportunityId = (body as { opportunityId: string }).opportunityId.trim();
        const qualification = relationPayoff.qualifications.find(
          (item) => item.opportunityId === opportunityId,
        );
        if (qualification === undefined) {
          throw new Error(
            "a compiled, research-accepted relation is required first",
          );
        }
        const result = await simulationMaterializerDesk.materialize({
          qualification,
          portfolioId: (body as { portfolioId: string }).portfolioId,
          requestedQuantity: (body as { requestedQuantity: string }).requestedQuantity,
        });
        let summary = null;
        let exactVerification = null;
        if (result.plan !== null) {
          const bundle = runOpportunitySimulation(result.plan);
          opportunityLifecycleDesk.recordOpportunitySimulation(
            opportunityId,
            bundle,
          );
          summary =
            opportunityLifecycleDesk
              .projection()
              .simulationBundles.find(
                (item) => item.artifactHash === bundle.artifactHash,
              ) ?? null;
          if (bundle.status === "POSITIVE_SIMULATED_FLOOR") {
            const exact = verifyMaterializedOpportunity({
              qualification,
              materialization: result.record,
              bundle,
              nowEpochMs: BigInt(Date.now()),
            });
            opportunityLifecycleDesk.recordExactVerification(
              opportunityId,
              exact,
            );
            exactVerification =
              opportunityLifecycleDesk
                .projection()
                .exactVerifications.find(
                  (item) => item.artifactHash === exact.artifactHash,
                ) ?? null;
          }
        }
        await broadcastProjection();
        writeJson(response, 200, {
          materialization: result.record,
          simulation: summary,
          exactVerification,
          lifecycle:
            opportunityLifecycleDesk
              .projection()
              .cases.find((item) => item.opportunityId === opportunityId) ?? null,
          certificateAuthority:
            exactVerification?.status === "CERTIFIED"
              ? "FIRST_PARTY_EXACT_VERIFIER"
              : false,
          executionAuthority: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic:
            error instanceof Error
              ? error.message
              : "anonymous simulation materialization failed",
          certificateAuthority: false,
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/opportunity-lifecycle/shadow-decisions"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          typeof (body as { opportunityId?: unknown }).opportunityId !==
            "string" ||
          !["APPROVE_SHADOW", "REJECT"].includes(
            (body as { decision?: unknown }).decision as string,
          ) ||
          Object.keys(body).length !== 2
        ) {
          throw new Error(
            "shadow decision requires exactly opportunityId and APPROVE_SHADOW or REJECT",
          );
        }
        const opportunityId = (
          body as { opportunityId: string }
        ).opportunityId.trim();
        const lifecycle = opportunityLifecycleDesk.recordShadowDecision(
          opportunityId,
          (body as { decision: "APPROVE_SHADOW" | "REJECT" }).decision,
        );
        const shadow =
          opportunityLifecycleDesk
            .projection()
            .shadowRuns.find(
              (item) => item.opportunityId === opportunityId,
            ) ?? null;
        await broadcastProjection();
        writeJson(response, 200, {
          lifecycle,
          shadow,
          productionApprovalAccepted: false,
          executionAuthority: false,
          liveExecutionEnabled: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "shadow decision failed",
          productionApprovalAccepted: false,
          executionAuthority: false,
          liveExecutionEnabled: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/opportunity-lifecycle/shadow-observations"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          typeof (body as { opportunityId?: unknown }).opportunityId !== "string" ||
          typeof (body as { portfolioId?: unknown }).portfolioId !== "string" ||
          typeof (body as { requestedQuantity?: unknown }).requestedQuantity !== "string" ||
          Object.keys(body).length !== 3
        ) {
          throw new Error(
            "shadow observation requires exactly opportunityId, portfolioId, and requestedQuantity",
          );
        }
        const opportunityId = (body as { opportunityId: string }).opportunityId.trim();
        const archaeologist = marketArchaeologistDesk.projection();
        const semanticReviews = semanticReviewDesk.projection();
        const lifecycle = opportunityLifecycleDesk.projection();
        const relationPayoff = deriveRelationPayoffProjection({
          archaeologist,
          semanticReviews: semanticReviews.records,
          semanticDecisions: lifecycle.semanticDecisions,
          premiseAnalyses: premiseAnalysisDesk.projection().records,
          proposalAttributions: relationPayoffProposalAttributions(),
        });
        const qualification = relationPayoff.qualifications.find(
          (item) => item.opportunityId === opportunityId,
        );
        if (
          qualification === undefined ||
          !lifecycle.cases.some(
            (item) =>
              item.opportunityId === opportunityId &&
              item.state === "SHADOW_COMPLETE",
          )
        ) {
          throw new Error(
            "a compiled opportunity with completed bound shadow is required first",
          );
        }
        const result = await simulationMaterializerDesk.materialize({
          qualification,
          portfolioId: (body as { portfolioId: string }).portfolioId,
          requestedQuantity: (body as { requestedQuantity: string }).requestedQuantity,
        });
        const observation = result.plan === null
          ? null
          : opportunityLifecycleDesk.recordShadowMarketObservation(
              opportunityId,
              runOpportunitySimulation(result.plan),
              result.record.materializationId,
            );
        await broadcastProjection();
        writeJson(response, 200, {
          materialization: result.record,
          observation,
          source: "ANONYMOUS_PUBLIC_MARKET_EVIDENCE",
          actualOrderObserved: false,
          gatewayCalls: 0,
          executionAuthority: false,
          liveExecutionEnabled: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "shadow observation failed",
          actualOrderObserved: false,
          gatewayCalls: 0,
          executionAuthority: false,
          liveExecutionEnabled: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/opportunity-lifecycle/simulations"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        const archaeologist = marketArchaeologistDesk.projection();
        const semanticReviews = semanticReviewDesk.projection();
        const lifecycle = opportunityLifecycleDesk.projection();
        const relationPayoff = deriveRelationPayoffProjection({
          archaeologist,
          semanticReviews: semanticReviews.records,
          semanticDecisions: lifecycle.semanticDecisions,
          premiseAnalyses: premiseAnalysisDesk.projection().records,
          proposalAttributions: relationPayoffProposalAttributions(),
        });
        const opportunityId =
          body !== null &&
          typeof body === "object" &&
          typeof (body as { opportunityId?: unknown }).opportunityId ===
            "string"
            ? (body as { opportunityId: string }).opportunityId.trim()
            : "";
        const qualification = relationPayoff.qualifications.find(
          (item) => item.opportunityId === opportunityId,
        );
        if (qualification === undefined) {
          throw new Error(
            "a compiled, research-accepted relation is required first",
          );
        }
        const plan = parseOpportunitySimulationIntake(body, qualification);
        const bundle = runOpportunitySimulation(plan);
        opportunityLifecycleDesk.recordOpportunitySimulation(
          opportunityId,
          bundle,
        );
        const summary = opportunityLifecycleDesk
          .projection()
          .simulationBundles.find(
            (item) => item.artifactHash === bundle.artifactHash,
          );
        await broadcastProjection();
        writeJson(response, 200, {
          simulation: summary,
          lifecycle: opportunityLifecycleDesk
            .projection()
            .cases.find((item) => item.opportunityId === opportunityId),
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic:
            error instanceof Error
              ? error.message
              : "opportunity simulation failed",
          certificateAuthority: false,
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/market-corpus/search"
    ) {
      try {
        await ready;
        writeJson(
          response,
          200,
          searchMarketCorpus(
            catalogObservationDesk.corpus(),
            (await readJson(request)) as MarketCorpusSearchQuery,
          ),
        );
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "market corpus search failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/catalog/observations/refresh"
    ) {
      const pending = catalogRefreshScheduler.runNow("OPERATOR").promise;
      await broadcastProjection();
      const result = await pending;
      await broadcastProjection();
      tickSearchIssues();
      writeJson(
        response,
        result.catalog.status === "READY" ? 200 : 207,
        result.catalog,
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/qualification"
    ) {
      const current = await projection();
      writeJson(response, 200, current.qualification);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/candidate-watch"
    ) {
      await ready;
      writeJson(response, 200, candidateWatchDesk.projection());
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/candidate-watch/refresh"
    ) {
      await ready;
      const pending = candidateWatchDesk.refresh();
      await broadcastProjection();
      const result = await pending;
      await broadcastProjection();
      writeJson(response, result.status === "READY" ? 200 : 207, result);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      writeJson(response, 200, discoveryLedger.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/investigations"
    ) {
      writeJson(response, 200, investigationDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-archaeologist"
    ) {
      writeJson(response, 200, marketArchaeologistDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/search-leases"
    ) {
      writeJson(response, 200, searchLeaseScheduler.projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/search-attention") {
      writeJson(response, 200, searchAttentionOutbox.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/semantic-reviews"
    ) {
      writeJson(response, 200, semanticReviewDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/probability-estimation"
    ) {
      await ready;
      probabilityEstimationScheduler.reconcile(
        probabilityEstimationCandidates(),
        catalogObservationDesk.corpus(),
      );
      writeJson(response, 200, Object.freeze({
        desk: probabilityEstimationDesk.projection(),
        scheduler: probabilityEstimationScheduler.projection(),
      }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/ai-usage") {
      writeJson(response, 200, aiUsageLedger.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/research-cases/review-intake"
    ) {
      const caseId = url.searchParams.get("caseId")?.trim() ?? "";
      const current = await projection();
      const researchCase = current.ai.researchDesk.cases.find(
        (item) => item.caseId === caseId,
      );
      if (researchCase === undefined) {
        writeJson(response, 404, {
          ok: false,
          diagnostic: "research case was not found",
          executionAuthority: false,
        });
      } else if (researchCase.reviewIntake === undefined ||
        researchCase.reviewIntake === null) {
        writeJson(response, 409, {
          ok: false,
          caseId,
          diagnostic:
            "research case lacks the retained scout and passed investigation bindings required for a review intake packet",
          executionAuthority: false,
        });
      } else {
        writeJson(response, 200, researchCase.reviewIntake);
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": "http://localhost:5173",
      });
      response.write(
        `event: projection\ndata: ${JSON.stringify(await liveProjection())}\n\n`,
      );
      subscribers.add(response);
      const heartbeat = setInterval(() => {
        response.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
      }, 15_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(response);
      });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/books/replay"
    ) {
      try {
        const books = await bookDesk.replay();
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          effects: {
            externalWrites: false,
            valueMovingActions: false,
            liveExecutionEnabled: false,
          },
          bookDesk: books,
        });
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "book replay failed",
          effects: {
            externalWrites: false,
            valueMovingActions: false,
            liveExecutionEnabled: false,
          },
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      try {
        await ready;
        const task = parseDiscoveryTask(
          await readJson(request),
          catalogDesk,
          catalogObservationDesk,
          modelRuntime.projection.timeoutMs + 2_000,
        );
        const invocation = await invokeDiscovery(task);
        writeJson(response, 200, {
          ...projectDiscoveryRunRecord(invocation.record),
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(response, error instanceof DiscoveryScopeConflictError ? 409 : 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "discovery run failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/search-issues"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("search issue request must be an object");
        }
        const input = body as {
          title?: unknown;
          question?: unknown;
          lens?: unknown;
          venueIds?: unknown;
          cadenceMs?: unknown;
          priority?: unknown;
          enabled?: unknown;
          family?: unknown;
        };
        const allowed = new Set([
          "title", "question", "lens", "venueIds", "cadenceMs", "priority", "enabled", "family",
        ]);
        if (
          Object.keys(input).some((key) => !allowed.has(key)) ||
          typeof input.title !== "string" ||
          typeof input.question !== "string" ||
          typeof input.lens !== "string" ||
          !SEARCH_LENSES.includes(input.lens as SearchLens) ||
          typeof input.cadenceMs !== "number" ||
          (input.venueIds !== undefined &&
            (!Array.isArray(input.venueIds) ||
              input.venueIds.some((item) => typeof item !== "string"))) ||
          (input.priority !== undefined &&
            (typeof input.priority !== "number" || ![1, 2, 3, 4, 5].includes(input.priority))) ||
          (input.enabled !== undefined && typeof input.enabled !== "boolean") ||
          (input.family !== undefined &&
            (input.family === null || typeof input.family !== "object" || Array.isArray(input.family)))
        ) {
          throw new Error("search issue fields are invalid or unbounded");
        }
        const issue = searchIssueScheduler.create({
          title: input.title,
          question: input.question,
          lens: input.lens as SearchLens,
          cadenceMs: input.cadenceMs,
          venueIds: (input.venueIds as readonly string[] | undefined) ?? [],
          priority: (input.priority as 1 | 2 | 3 | 4 | 5 | undefined) ?? 3,
          ...(input.enabled === undefined ? {} : { enabled: input.enabled as boolean }),
          ...(input.family === undefined
            ? {}
            : { family: input.family as NonNullable<CreateSearchIssueInput["family"]> }),
        });
        await broadcastProjection();
        writeJson(response, 201, issue);
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "search issue creation failed",
        });
      }
      return;
    }
    const searchIssueRunMatch = url.pathname.match(
      /^\/api\/v1\/search-issues\/(sha256:[0-9a-f]{64})\/runs$/u,
    );
    if (request.method === "POST" && searchIssueRunMatch !== null) {
      try {
        await ready;
        const invocation = searchIssueScheduler.runNow(
          searchIssueRunMatch[1] as Hash,
          catalogObservationDesk.corpus(),
        );
        await broadcastProjection();
        const record = await invocation.promise;
        await searchAttentionOutbox.tick(
          searchIssueScheduler.projection().issues,
          searchLeaseScheduler.projection().records,
        );
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(response, error instanceof SearchLeaseBusyError ? 409 : 400, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "search issue run failed",
        });
      }
      return;
    }
    const searchIssueEnabledMatch = url.pathname.match(
      /^\/api\/v1\/search-issues\/(sha256:[0-9a-f]{64})\/enabled$/u,
    );
    if (request.method === "POST" && searchIssueEnabledMatch !== null) {
      try {
        const body = await readJson(request);
        if (
          body === null || typeof body !== "object" || Array.isArray(body) ||
          typeof (body as { enabled?: unknown }).enabled !== "boolean" ||
          Object.keys(body).length !== 1
        ) {
          throw new Error("search issue enabled update requires exactly one boolean");
        }
        const issue = searchIssueScheduler.setEnabled(
          searchIssueEnabledMatch[1] as Hash,
          (body as { enabled: boolean }).enabled,
        );
        await broadcastProjection();
        writeJson(response, 200, issue);
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "search issue update failed",
        });
      }
      return;
    }
    const notificationAckMatch = url.pathname.match(
      /^\/api\/v1\/search-notifications\/(sha256:[0-9a-f]{64})\/acknowledgements$/u,
    );
    if (request.method === "POST" && notificationAckMatch !== null) {
      try {
        const notification = searchIssueScheduler.acknowledge(
          notificationAckMatch[1] as Hash,
        );
        await broadcastProjection();
        writeJson(response, 200, notification);
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "notification acknowledgement failed",
        });
      }
      return;
    }
    const attentionAckMatch = url.pathname.match(
      /^\/api\/v1\/search-attention-deliveries\/(sha256:[0-9a-f]{64})\/acknowledgements$/u,
    );
    if (request.method === "POST" && attentionAckMatch !== null) {
      try {
        const delivery = searchAttentionOutbox.acknowledgeInApp(
          attentionAckMatch[1] as Hash,
        );
        await broadcastProjection();
        writeJson(response, 200, delivery);
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "attention acknowledgement failed",
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/search-leases/runs"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("search lease request must be an object");
        }
        const keys = Object.keys(body);
        const rawLens = (body as { lens?: unknown }).lens;
        if (
          keys.some((key) => key !== "lens") ||
          keys.length > 1 ||
          (rawLens !== undefined &&
            (typeof rawLens !== "string" ||
              !SEARCH_LENSES.includes(rawLens as SearchLens)))
        ) {
          throw new Error("search lease request accepts only an optional valid lens");
        }
        const invocation = searchLeaseScheduler.begin(
          catalogObservationDesk.corpus(),
          rawLens as SearchLens | undefined,
          "OPERATOR",
        );
        await broadcastProjection();
        const record = await invocation.promise;
        probabilityEstimationScheduler.reconcile(
          probabilityEstimationCandidates(),
          catalogObservationDesk.corpus(),
        );
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof SearchLeaseBusyError ? 409
            : error instanceof SearchLeaseUnavailableError ? 409
              : 400,
          {
            ok: false,
            diagnostic: error instanceof Error ? error.message : "search lease failed",
            semanticDecisionAuthority: false,
            certificateAuthority: false,
            executionAuthority: false,
          },
        );
      }
      return;
    }
    const deepRetryMatch = url.pathname.match(
      /^\/api\/v1\/search-leases\/(sha256:[0-9a-f]{64})\/deep-retries$/u,
    );
    if (request.method === "POST" && deepRetryMatch !== null) {
      try {
        await ready;
        const invocation = searchLeaseScheduler.retryDeep(
          deepRetryMatch[1] as Hash,
        );
        await broadcastProjection();
        void invocation.promise
          .then(() => broadcastProjection())
          .catch(() => broadcastProjection());
        const record = searchLeaseScheduler.projection().records.find(
          (item) => item.lease.leaseId === deepRetryMatch[1],
        );
        writeJson(response, invocation.idempotentReplay ? 200 : 202, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof SearchLeaseUnavailableError ? 409 : 400,
          {
            ok: false,
            diagnostic: error instanceof Error
              ? error.message
              : "deep retry failed",
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/market-archaeologist/runs"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          typeof (body as { question?: unknown }).question !== "string" ||
          Object.keys(body).length !== 1
        ) {
          throw new Error("Market Archaeologist run requires exactly one question");
        }
        const question = (body as { question: string }).question
          .trim()
          .replace(/\s+/gu, " ");
        if (question === "" || question.length > 1_000) {
          throw new Error("Market Archaeologist question exceeds bounded input limits");
        }
        const invocation = marketArchaeologistDesk.begin(
          catalogObservationDesk.corpus(),
          question,
        );
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof MarketArchaeologistNotConfiguredError
            ? 503
            : error instanceof MarketArchaeologistBusyError
              ? 409
              : 400,
          {
            ok: false,
            diagnostic:
              error instanceof Error
                ? error.message
                : "Market Archaeologist run failed",
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/semantic-reviews/runs"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          typeof (body as { opportunityId?: unknown }).opportunityId !==
            "string" ||
          Object.keys(body).length !== 1
        ) {
          throw new Error("semantic review requires exactly one opportunityId");
        }
        const opportunityId = (
          body as { opportunityId: string }
        ).opportunityId.trim();
        const source = marketArchaeologistDesk
          .projection()
          .records.flatMap((record) =>
            record.status === "PASS" && record.report !== null
              ? record.report.result.proposals.map((proposal) => ({
                  proposal,
                  corpusSnapshotIdentity: record.corpusSnapshotIdentity,
                }))
              : [],
          )
          .find(
            ({ proposal }) => `ai:${proposal.proposalId}` === opportunityId,
          );
        if (source === undefined) {
          throw new Error("semantic review opportunity was not found");
        }
        const invocation = semanticReviewDesk.begin(
          opportunityId,
          source.proposal,
          catalogObservationDesk.corpus(),
          source.corpusSnapshotIdentity,
        );
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof SemanticReviewNotConfiguredError
            ? 503
            : error instanceof SemanticReviewBusyError
              ? 409
              : 400,
          {
            ok: false,
            diagnostic:
              error instanceof Error ? error.message : "semantic review failed",
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/probability-estimation/runs"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("probability estimation request is malformed");
        }
        const raw = body as {
          semanticReviewArtifactHash?: unknown;
          adverseStateIds?: unknown;
          role?: unknown;
        };
        if (
          Object.keys(body).sort().join("\n") !==
            ["adverseStateIds", "role", "semanticReviewArtifactHash"].sort().join("\n") ||
          typeof raw.semanticReviewArtifactHash !== "string" ||
          !Array.isArray(raw.adverseStateIds) ||
          raw.adverseStateIds.some((item) => typeof item !== "string") ||
          !PROBABILITY_ESTIMATOR_ROLES.includes(raw.role as ProbabilityEstimatorRole)
        ) throw new Error("probability estimation requires review hash, adverse states, and role");
        const review = semanticReviewDesk.projection().records.find((record) =>
          record.report?.artifactHash === raw.semanticReviewArtifactHash
        );
        if (review === undefined) throw new Error("probabilistic semantic review was not found");
        const invocation = probabilityEstimationDesk.begin(
          review,
          catalogObservationDesk.corpus(),
          raw.adverseStateIds as string[],
          raw.role as ProbabilityEstimatorRole,
        );
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" || record.status === "ABSTAINED" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "probability estimation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/opportunity-lifecycle/semantic-decisions"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          typeof (body as { opportunityId?: unknown }).opportunityId !==
            "string" ||
          typeof (body as { decision?: unknown }).decision !== "string" ||
          typeof (body as { rationale?: unknown }).rationale !== "string" ||
          Object.keys(body).length !== 3
        ) {
          throw new Error(
            "semantic decision requires opportunityId, decision, and rationale",
          );
        }
        const input = body as {
          opportunityId: string;
          decision: string;
          rationale: string;
        };
        if (
          input.decision !== "ACCEPT_FOR_SIMULATION" &&
          input.decision !== "REJECT"
        ) {
          throw new Error("semantic decision is invalid");
        }
        const review = semanticReviewDesk.findPassedForOpportunity(
          input.opportunityId.trim(),
        );
        if (review === undefined) {
          throw new Error("a passed advisory review is required first");
        }
        const decision =
          opportunityLifecycleDesk.recordResearchSemanticDecision(
            input.opportunityId.trim(),
            review,
            input.decision,
            input.rationale,
          );
        await broadcastProjection();
        writeJson(response, 200, {
          decision,
          lifecycle: opportunityLifecycleDesk
            .projection()
            .cases.find(
              (item) => item.opportunityId === input.opportunityId.trim(),
            ),
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "semantic decision failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/radar/triage"
    ) {
      try {
        await ready;
        const scope = catalogObservationDesk.radarTriageScope(
          await readRadarCandidateId(request),
        );
        const task: DiscoveryTask = Object.freeze({
          taskId: scope.candidate.triageTaskId,
          question: scope.question,
          venueIds: scope.venueIds,
          maxHypotheses: 10,
          deadlineEpochMs: Date.now() + 10_000,
          catalogContext: scope.catalogContext,
        });
        const invocation = await invokeDiscovery(task);
        writeJson(response, 200, {
          ...projectDiscoveryRunRecord(invocation.record),
          radarCandidateId: scope.candidate.candidateId,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof RadarCandidateUnavailableError ||
            error instanceof DiscoveryScopeConflictError
            ? 409
            : 400,
          {
            ok: false,
            diagnostic:
              error instanceof Error ? error.message : "radar triage failed",
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/radar/investigate"
    ) {
      try {
        await ready;
        const candidateId = await readRadarCandidateId(request);
        const task = retainedDiscoveryTask(
          radarTriageTaskId(candidateId),
          piRuntime.projection.timeoutMs + 2_000,
        );
        const invocation = investigationDesk.begin(task);
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          radarCandidateId: candidateId,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        const status =
          error instanceof RadarCandidateUnavailableError ||
          error instanceof ResearchContextUnavailableError ||
          error instanceof InvestigationBusyError ||
          error instanceof InvestigationScopeConflictError
            ? 409
            : error instanceof InvestigationNotConfiguredError
              ? 503
              : 500;
        writeJson(response, status, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "radar investigation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/research-cases/investigate"
    ) {
      try {
        await ready;
        const task = retainedDiscoveryTask(
          await readResearchTaskId(request),
          piRuntime.projection.timeoutMs + 2_000,
        );
        const invocation = investigationDesk.begin(task);
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        const status =
          error instanceof ResearchContextUnavailableError ||
          error instanceof InvestigationBusyError ||
          error instanceof InvestigationScopeConflictError
            ? 409
            : error instanceof InvestigationNotConfiguredError
              ? 503
              : 500;
        writeJson(response, status, {
          ok: false,
          diagnostic:
            error instanceof Error
              ? error.message
              : "research case investigation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/investigations"
    ) {
      let task: DiscoveryTask;
      try {
        await ready;
        task = parseDiscoveryTask(
          await readJson(request),
          catalogDesk,
          catalogObservationDesk,
          piRuntime.projection.timeoutMs + 2_000,
        );
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "investigation failed",
          executionAuthority: false,
        });
        return;
      }

      try {
        const invocation = investigationDesk.begin(task);
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        const status =
          error instanceof InvestigationNotConfiguredError
            ? 503
            : error instanceof InvestigationBusyError ||
                error instanceof InvestigationScopeConflictError
              ? 409
              : 500;
        writeJson(response, status, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "investigation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    writeJson(response, 404, {
      ok: false,
      diagnostic: "route not found",
    });
  });
  let searchSchedulerTimer: ReturnType<typeof setInterval> | null = null;
  let searchIssueTimer: ReturnType<typeof setInterval> | null = null;
  let searchAttentionTimer: ReturnType<typeof setInterval> | null = null;
  let semanticReviewTimer: ReturnType<typeof setInterval> | null = null;
  let probabilityEstimationTimer: ReturnType<typeof setInterval> | null = null;
  let probabilityResolutionTimer: ReturnType<typeof setInterval> | null = null;
  let premiseAnalysisTimer: ReturnType<typeof setInterval> | null = null;
  let evidenceAcquisitionTimer: ReturnType<typeof setInterval> | null = null;
  let ruleEvidenceClaimTimer: ReturnType<typeof setInterval> | null = null;
  let catalogRefreshTimer: ReturnType<typeof setInterval> | null = null;
  const searchIntervalMs = searchLeaseScheduler.intervalMs;
  if (searchIntervalMs !== null && searchIssueScheduler.tickIntervalMs === null) {
    void ready.then(() => {
      searchSchedulerTimer = setInterval(() => {
        const snapshot = catalogObservationDesk.corpus();
        if (!searchLeaseScheduler.shouldSchedule(snapshot)) return;
        try {
          const invocation = searchLeaseScheduler.begin(
            snapshot,
            undefined,
            "SCHEDULE",
          );
          void broadcastProjection();
          void invocation.promise.then(() => broadcastProjection());
        } catch {
          // A later interval retries only when the desk can make progress.
        }
      }, searchIntervalMs);
      searchSchedulerTimer.unref();
    });
  }
  const tickSearchIssues = () => {
    if (catalogRefreshScheduler.refreshing) return;
    try {
      const runs = searchIssueScheduler.tick(catalogObservationDesk.corpus());
      if (runs.length === 0) return;
      void broadcastProjection();
      for (const run of runs) {
        void run.then(async () => {
          await searchAttentionOutbox.tick(
            searchIssueScheduler.projection().issues,
            searchLeaseScheduler.projection().records,
          );
          await broadcastProjection();
        });
      }
    } catch {
      // The next bounded tick retries due issues after capacity becomes available.
    }
  };
  const searchIssueTickMs = searchIssueScheduler.tickIntervalMs;
  if (searchIssueTickMs !== null) {
    void ready.then(() => {
      tickSearchIssues();
      searchIssueTimer = setInterval(tickSearchIssues, searchIssueTickMs);
      searchIssueTimer.unref();
    });
  }
  const tickSearchAttention = () => {
    void searchAttentionOutbox.tick(
      searchIssueScheduler.projection().issues,
      searchLeaseScheduler.projection().records,
    ).then(
      (changed) => changed ? broadcastProjection() : undefined,
      () => undefined,
    );
  };
  void ready.then(() => {
    tickSearchAttention();
    searchAttentionTimer = setInterval(tickSearchAttention, 60_000);
    searchAttentionTimer.unref();
  });
  if (catalogRefreshScheduler.intervalMs !== null) {
    void ready.then(() => {
      const tickCatalogRefresh = () => {
        const invocation = catalogRefreshScheduler.tick();
        if (invocation === null) return;
        void broadcastProjection();
        void invocation.promise.then(
          () => {
            void broadcastProjection();
            tickSearchIssues();
          },
          () => broadcastProjection(),
        );
      };
      catalogRefreshTimer = setInterval(
        tickCatalogRefresh,
        Math.min(catalogRefreshScheduler.intervalMs ?? 5_000, 5_000),
      );
      catalogRefreshTimer.unref();
    });
  }
  const semanticReviewTickMs = semanticReviewScheduler.tickIntervalMs;
  if (semanticReviewTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        try {
          const runs = semanticReviewScheduler.tick(
            semanticReviewCandidates(),
            catalogObservationDesk.corpus(),
          );
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) {
            void run.then(() => broadcastProjection());
          }
        } catch {
          // The next bounded tick retries durable jobs when capacity is available.
        }
      };
      tick();
      semanticReviewTimer = setInterval(tick, semanticReviewTickMs);
      semanticReviewTimer.unref();
    });
  }
  const probabilityEstimationTickMs = probabilityEstimationScheduler.tickIntervalMs;
  if (probabilityEstimationTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        try {
          const runs = probabilityEstimationScheduler.tick(
            probabilityEstimationCandidates(),
            catalogObservationDesk.corpus(),
          );
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) void run.then(() => broadcastProjection());
        } catch {
          // The next bounded tick retries persisted role-estimation work.
        }
      };
      tick();
      probabilityEstimationTimer = setInterval(tick, probabilityEstimationTickMs);
      probabilityEstimationTimer.unref();
    });
  }
  const probabilityResolutionTickMs = probabilityResolutionAcquisitionScheduler.intervalMs;
  if (probabilityResolutionTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        try {
          const run = probabilityResolutionAcquisitionScheduler.tick();
          if (run === null) return;
          void broadcastProjection();
          void run.then(() => broadcastProjection(), () => broadcastProjection());
        } catch {
          // The next bounded tick retries anonymous resolution acquisition.
        }
      };
      tick();
      probabilityResolutionTimer = setInterval(tick, probabilityResolutionTickMs);
      probabilityResolutionTimer.unref();
    });
  }
  const premiseAnalysisTickMs = premiseAnalysisScheduler.tickIntervalMs;
  if (premiseAnalysisTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        try {
          const runs = premiseAnalysisScheduler.tick(premiseAnalysisCandidates());
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) void run.then(() => broadcastProjection());
        } catch {
          // The next bounded tick retries persisted premise-audit work.
        }
      };
      tick();
      premiseAnalysisTimer = setInterval(tick, premiseAnalysisTickMs);
      premiseAnalysisTimer.unref();
    });
  }
  const evidenceAcquisitionTickMs = evidenceAcquisitionScheduler.tickIntervalMs;
  if (evidenceAcquisitionTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        try {
          const runs = evidenceAcquisitionScheduler.tick(evidenceRequirements());
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) void run.then(() => broadcastProjection());
        } catch {
          // The next bounded tick retries persisted acquisition work.
        }
      };
      tick();
      evidenceAcquisitionTimer = setInterval(tick, evidenceAcquisitionTickMs);
      evidenceAcquisitionTimer.unref();
    });
  }
  const ruleEvidenceClaimTickMs = ruleEvidenceClaimScheduler.tickIntervalMs;
  if (ruleEvidenceClaimTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        try {
          const runs = ruleEvidenceClaimScheduler.tick(ruleEvidenceClaimInputs());
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) void run.then(() => broadcastProjection());
        } catch {
          // The next bounded tick retries persisted interpretation work.
        }
      };
      tick();
      ruleEvidenceClaimTimer = setInterval(tick, ruleEvidenceClaimTickMs);
      ruleEvidenceClaimTimer.unref();
    });
  }
  server.once("close", () => {
    if (searchSchedulerTimer !== null) clearInterval(searchSchedulerTimer);
    if (searchIssueTimer !== null) clearInterval(searchIssueTimer);
    if (searchAttentionTimer !== null) clearInterval(searchAttentionTimer);
    if (semanticReviewTimer !== null) clearInterval(semanticReviewTimer);
    if (probabilityEstimationTimer !== null) clearInterval(probabilityEstimationTimer);
    if (probabilityResolutionTimer !== null) clearInterval(probabilityResolutionTimer);
    if (premiseAnalysisTimer !== null) clearInterval(premiseAnalysisTimer);
    if (evidenceAcquisitionTimer !== null) clearInterval(evidenceAcquisitionTimer);
    if (ruleEvidenceClaimTimer !== null) clearInterval(ruleEvidenceClaimTimer);
    if (catalogRefreshTimer !== null) clearInterval(catalogRefreshTimer);
    discoveryLedger.close();
  });
  return {
    server,
    pool,
    bookDesk,
    catalogDesk,
    catalogObservationDesk,
    catalogRefreshScheduler,
    discoveryLedger,
    investigationDesk,
    piRuntime,
    realCandidatePreflightDesk,
    candidateWatchDesk,
    marketArchaeologistDesk,
    searchLeaseScheduler,
    searchQuoteEnrichmentDesk,
    searchIssueScheduler,
    searchAttentionOutbox,
    semanticReviewDesk,
    probabilityEstimationDesk,
    probabilityEstimationScheduler,
    probabilityCalibrationDesk,
    probabilityResolutionAcquisitionScheduler,
    aiUsageLedger,
    semanticReviewScheduler,
    premiseAnalysisDesk,
    premiseAnalysisScheduler,
    evidenceAcquisitionScheduler,
    ruleEvidenceClaimDesk,
    ruleEvidenceClaimScheduler,
    opportunityLifecycleDesk,
    projection,
    ready,
  };
}

export async function startControlPlane(
  port = 4_100,
  host = "127.0.0.1",
  databasePath =
    process.env.PMH_STATE_DB ??
    resolve(import.meta.dirname, "../../../.data/control-plane.sqlite"),
): Promise<void> {
  const { SqliteOperationalStore } = await import("./operational-store.js");
  const discoveryStore = new SqliteOperationalStore(databasePath);
  let releaseStartup: (() => void) | undefined;
  const startupGate = new Promise<void>((resolveStartup) => {
    releaseStartup = resolveStartup;
  });
  const { server, ready } = createControlPlane({
    discoveryStore,
    investigationStore: discoveryStore,
    refreshCatalogOnReady: true,
    startupGate,
  });
  try {
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolveListen);
    });
    releaseStartup?.();
    await ready;
    process.stdout.write(
      `control-plane http://${host}:${port} · ${discoveryStore.storage.mode}\n`,
    );
  } catch (error) {
    if (server.listening) {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
    discoveryStore.close();
    throw error;
  }
}
