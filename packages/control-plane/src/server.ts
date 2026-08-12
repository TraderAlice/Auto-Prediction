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
import { buildStudioProjectionInvalidation } from "./studio-projection-stream.js";
import {
  AiUsageLedger,
  type AiUsageEventStore,
} from "./ai-usage-ledger.js";
import {
  applyProposalEconomicPriority,
  buildProposalEconomicTriage,
  recoverBaseReviewPriority,
} from "./proposal-economic-triage.js";
import {
  deriveProposalDecisionNextGate,
  resolveProposalPremiseOutcome,
  resolveProposalReviewOutcome,
} from "./proposal-decision-dossier.js";
import { buildReviewAttentionProjection } from "./review-attention.js";
import { buildEvidenceDebtFrontier } from "./evidence-debt-frontier.js";
import { buildFailureBudgetFrontier } from "./failure-budget-frontier.js";
import { buildProbabilityEvidenceDebt } from "./probability-evidence-debt.js";
import { buildProbabilityCaseRepairQueue } from "./probability-case-challenge-queue.js";
import { buildProbabilitySemanticRepairProgress } from "./probability-semantic-repair-progress.js";
import { RealCandidatePreflightDesk } from "./real-candidate-preflight.js";
import {
  createMarketArchaeologistDesk,
  MarketArchaeologistBusyError,
  MarketArchaeologistDesk,
  MarketArchaeologistNotConfiguredError,
  type MarketArchaeologistRecordStore,
} from "./market-archaeologist.js";
import { selectCurrentSemanticEvidenceBundle } from "./semantic-review-scope.js";
import {
  buildMarketCorpusSnapshot,
  projectMarketCorpus,
  searchMarketCorpus,
  type MarketCorpusSnapshot,
  type MarketCorpusSearchQuery,
} from "./market-corpus.js";
import {
  buildMarketOntologySnapshot,
  projectMarketOntology,
} from "./market-ontology.js";
import {
  MarketOntologyAgentToolHost,
  type MarketOntologyAgentProposal,
  type MarketOntologyAgentProposalStore,
  type MarketOntologyNormalizationTaskPayload,
} from "./market-ontology-agent-tools.js";
import {
  buildOntologySearchYieldProjection,
  reconcileOntologySearchIssueRevisions,
  type OntologySearchIssueRevision,
  type OntologySearchIssueRevisionStore,
} from "./ontology-search-ecology.js";
import {
  buildOntologyAgentCampaignPreview,
  resolveOntologyAgentTaskRevision,
} from "./ontology-agent-campaign.js";
import { buildOntologyAllocationOutcomeProjection } from "./ontology-allocation-outcomes.js";
import { buildOntologyAttentionAllocation } from "./ontology-attention-allocation.js";
import {
  buildOntologyRelationWorkProjection,
  type OntologyRelationWorkProjection,
} from "./ontology-relation-work.js";
import {
  RelationDiscoveryAgentToolHost,
  type RelationDiscoveryFindingStore,
  type RelationDiscoveryPositiveFinding,
  type RelationDiscoveryTaskPayload,
} from "./relation-discovery-agent-tools.js";
import {
  reconcileRelationDiscoveryTaskRevisions,
  relationDiscoveryRevisionWorkItem,
  type RelationDiscoveryTaskRevision,
  type RelationDiscoveryTaskRevisionStore,
} from "./relation-discovery-work.js";
import { buildRelationDiscoveryCampaignPreview } from "./relation-discovery-campaign.js";
import {
  buildStandingRouteSeedCampaignPreview,
  migrateStandingRouteSeedCampaignPolicies,
  resolveRelationDiscoveryTaskRevision,
} from "./standing-route-seeding-campaign.js";
import { buildStandingRouteSeedOutcomeProjection } from
  "./standing-route-seeding-outcomes.js";
import {
  compileRelationDiscoveryFindingsForSemanticReview,
  relationDiscoveryReviewLane,
  selectRelationDiscoverySemanticReviewCompilations,
  type RelationDiscoveryProposalCompilation,
} from "./relation-discovery-semantic-bridge.js";
import {
  buildStandingOntologyRouteValueProjection,
  buildStandingOntologyRouteProjection,
  extendOntologyRelationWorkWithStandingRouteFollowups,
  materializeStandingOntologyRouteObservationEpisodes,
  materializeStandingOntologyRouteFollowups,
  type StandingOntologyRouteObservationEpisodeStore,
} from "./standing-ontology-routes.js";
import { buildResearchAttentionAllocation } from "./research-attention-allocation.js";
import {
  buildResearchActionTargetProjection,
  selectCurrentSemanticReviewRequirements,
  type ResearchActionTargetProjection,
} from "./research-action-targets.js";
import {
  buildResearchDecisionEpisode,
  buildResearchDecisionOutcomeProjection,
  researchDecisionEpisodeId,
  type ResearchDecisionEpisode,
  type ResearchDecisionEpisodeStore,
} from "./research-decision-outcomes.js";
import type { ResearchAttentionAllocationProjection } from "./research-attention-allocation.js";
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
  type SemanticReviewRecord,
  type SemanticReviewRecordStore,
} from "./semantic-review.js";
import { CodexAuthCacheCredentialProvider } from "./codex-oauth.js";
import {
  createProbabilityEstimationDesk,
  ProbabilityEstimationDesk,
  PROBABILITY_ESTIMATOR_ROLES,
  type ProbabilityEstimationRunStore,
  type ProbabilityEstimatorRole,
} from "./probability-estimation-agent.js";
import {
  buildProbabilityEstimationEvidenceContext,
  buildRetainedProbabilityEstimationEvidenceContext,
  parseProbabilityEstimationTickInterval,
  ProbabilityEstimationScheduler,
  type ProbabilityEstimationCandidate,
  type ProbabilityEstimationJobRecord,
  type ProbabilityEstimationSchedulerStore,
} from "./probability-estimation-scheduler.js";
import {
  buildProbabilitySearchOrigin,
  buildRelationDiscoveryProbabilitySearchOrigin,
} from "./probabilistic-semantic-arbitrage.js";
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
  type SemanticReviewAttributionSource,
  type SemanticReviewCandidate,
  type SemanticReviewJobRecord,
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
  createPremiseEvidenceRouter,
  type PremiseEvidenceRouterPort,
} from "./premise-evidence-router.js";
import {
  parsePremiseEvidenceRoutingTickInterval,
  PremiseEvidenceRoutingScheduler,
  type PremiseEvidenceRoutingCandidate,
  type PremiseEvidenceRoutingSchedulerStore,
} from "./premise-evidence-routing-scheduler.js";
import {
  buildPremiseRouteExpansionCandidate,
  derivePremiseRouteExpansionReviewLineage,
  parsePremiseRouteExpansionTickInterval,
  PremiseRouteExpansionScheduler,
  type PremiseRouteExpansionCandidate,
  type PremiseRouteExpansionSchedulerStore,
} from "./premise-route-expansion-scheduler.js";
import {
  EvidenceAcquisitionScheduler,
  parseEvidenceAcquisitionTickInterval,
  type EvidenceAcquisitionSchedulerStore,
} from "./evidence-acquisition-scheduler.js";
import { AiSdkOfficialSourceDiscoveryAgent } from "./official-source-discovery-agent.js";
import { officialSourceTaskRequirementIds } from "./official-source-discovery.js";
import {
  OfficialSourceDiscoveryScheduler,
  parseOfficialSourceDiscoveryTickInterval,
  type OfficialSourceDiscoveryAgentPort,
  type OfficialSourceDiscoverySchedulerStore,
} from "./official-source-discovery-scheduler.js";
import { EvidenceDocumentFetcher } from "./evidence-document.js";
import {
  excludeEvidenceRequirementLocators,
  rebaseEvidenceRequirementToCurrentListings,
  rebaseEvidenceRequirementsToRetainedLocatorCapabilities,
  type EvidenceRequirement,
} from "./evidence-requirement.js";
import {
  createRuleEvidenceClaimDesk,
  type RuleEvidenceInterpreterEngine,
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
import {
  AgentExecutionRegistry,
  activateAgentCampaign,
  buildPausedAgentCampaign,
  buildRuleEvidenceAgentTask,
  buildRuleEvidenceAgentTaskPayload,
  effectiveAgentCampaigns,
  pauseAgentCampaign,
  type AgentCampaign,
  type AgentExecutionSnapshot,
  type AgentExecutionStore,
  type AgentRun,
} from "./agent-execution-substrate.js";
import { buildDefaultAgentRuntimePortfolio } from "./agent-runtime-portfolio.js";
import {
  AgentCampaignDispatcher,
} from "./agent-campaign-dispatcher.js";
import {
  agentInputRevisionAnnotationMatches,
  buildAgentInputRevisionRunAnnotation,
} from "./agent-input-revision-binding.js";
import {
  AgentCredentialBroker,
  AgentExecutionCapabilityService,
  CodexOAuthCredentialResolver,
  EnvironmentCredentialResolver,
} from "./agent-runtime-adapter.js";
import {
  createPiCliAgentRuntimeAdapter,
} from "./agent-cli-runtime.js";
import { createCodexAppServerAgentRuntimeAdapter } from "./codex-app-server-runtime.js";
import { createInProcessAiSdkAgentRuntimeAdapter } from "./agent-in-process-runtime.js";
import { RuleEvidenceAgentToolHost } from "./rule-evidence-agent-tool-host.js";
import { buildRuleEvidenceAgentMigration } from "./rule-evidence-agent-migration.js";

const MAX_BODY_BYTES = 64 * 1024;

class DiscoveryScopeConflictError extends Error {}
class ResearchContextUnavailableError extends Error {}

function localStudioOrigin(request: IncomingMessage): string | undefined {
  const origin = request.headers.origin;
  if (origin === undefined) return undefined;
  try {
    const parsed = new URL(origin);
    const port = Number(parsed.port);
    if (
      parsed.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
      parsed.port.length === 0 ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65_535
    ) {
      return undefined;
    }
    return origin;
  } catch {
    return undefined;
  }
}

function localStudioCorsHeaders(
  request: IncomingMessage,
): Readonly<Record<string, string>> {
  const origin = localStudioOrigin(request);
  return origin === undefined
    ? Object.freeze({})
    : Object.freeze({
        "access-control-allow-origin": origin,
        vary: "origin",
      });
}

function writeJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...localStudioCorsHeaders(response.req),
    ...headers,
  });
  response.end(`${JSON.stringify(value)}\n`);
}

function requestAcceptsEtag(request: IncomingMessage, etag: string): boolean {
  const value = request.headers["if-none-match"];
  if (value === undefined) return false;
  const candidates = (Array.isArray(value) ? value.join(",") : value)
    .split(",")
    .map((item) => item.trim());
  return candidates.includes("*") || candidates.includes(etag);
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

function supportsPremiseEvidenceRoutingSchedulerRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & PremiseEvidenceRoutingSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<PremiseEvidenceRoutingSchedulerStore>;
  return candidate.premiseEvidenceRoutingJobStorage !== undefined &&
    typeof candidate.loadPremiseEvidenceRoutingJobRecords === "function" &&
    typeof candidate.savePremiseEvidenceRoutingJobRecord === "function";
}

function supportsPremiseRouteExpansionSchedulerRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & PremiseRouteExpansionSchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<PremiseRouteExpansionSchedulerStore>;
  return candidate.premiseRouteExpansionJobStorage !== undefined &&
    typeof candidate.loadPremiseRouteExpansionJobRecords === "function" &&
    typeof candidate.savePremiseRouteExpansionJobRecord === "function";
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

function supportsOfficialSourceDiscoveryRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & OfficialSourceDiscoverySchedulerStore {
  if (store === undefined) return false;
  const candidate = store as Partial<OfficialSourceDiscoverySchedulerStore>;
  return candidate.officialSourceDiscoveryJobStorage !== undefined &&
    typeof candidate.loadOfficialSourceDiscoveryJobRecords === "function" &&
    typeof candidate.saveOfficialSourceDiscoveryJobRecord === "function";
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

function supportsAgentExecution(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & AgentExecutionStore {
  if (store === undefined) return false;
  const candidate = store as Partial<AgentExecutionStore>;
  return candidate.agentExecutionStorage !== undefined &&
    typeof candidate.loadAgentExecutionSnapshot === "function" &&
    typeof candidate.saveAgentExecutionBatch === "function";
}

function supportsMarketOntologyAgentProposals(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & MarketOntologyAgentProposalStore {
  if (store === undefined) return false;
  const candidate = store as Partial<MarketOntologyAgentProposalStore>;
  return candidate.marketOntologyAgentProposalStorage !== undefined &&
    typeof candidate.loadMarketOntologyAgentProposals === "function" &&
    typeof candidate.saveMarketOntologyAgentProposals === "function";
}

function supportsOntologySearchIssueRevisions(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & OntologySearchIssueRevisionStore {
  if (store === undefined) return false;
  const candidate = store as Partial<OntologySearchIssueRevisionStore>;
  return candidate.ontologySearchIssueRevisionStorage !== undefined &&
    typeof candidate.loadOntologySearchIssueRevision === "function" &&
    typeof candidate.loadOntologySearchIssueRevisions === "function" &&
    typeof candidate.saveOntologySearchIssueRevisions === "function";
}

function supportsRelationDiscoveryRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & RelationDiscoveryTaskRevisionStore &
  RelationDiscoveryFindingStore {
  if (store === undefined) return false;
  const candidate = store as Partial<RelationDiscoveryTaskRevisionStore &
    RelationDiscoveryFindingStore>;
  return candidate.relationDiscoveryTaskRevisionStorage !== undefined &&
    candidate.relationDiscoveryCorpusStorage !== undefined &&
    candidate.relationDiscoveryFindingStorage !== undefined &&
    typeof candidate.loadRelationDiscoveryTaskRevisions === "function" &&
    typeof candidate.saveRelationDiscoveryTaskRevisions === "function" &&
    typeof candidate.loadRelationDiscoveryCorpus === "function" &&
    typeof candidate.saveRelationDiscoveryCorpus === "function" &&
    typeof candidate.loadRelationDiscoveryFindings === "function" &&
    typeof candidate.loadStandingOntologyRouteSourceFindings === "function" &&
    typeof candidate.loadRelationDiscoveryTaskRevisionsForTaskIds === "function" &&
    typeof candidate.saveRelationDiscoveryFindings === "function";
}

function supportsStandingOntologyRouteObservationEpisodes(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & StandingOntologyRouteObservationEpisodeStore {
  if (store === undefined) return false;
  const candidate = store as Partial<StandingOntologyRouteObservationEpisodeStore>;
  return candidate.standingOntologyRouteObservationEpisodeStorage !== undefined &&
    typeof candidate.loadStandingOntologyRouteObservationEpisodes === "function" &&
    typeof candidate.saveStandingOntologyRouteObservationEpisodes === "function";
}

function supportsResearchDecisionEpisodes(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & ResearchDecisionEpisodeStore {
  if (store === undefined) return false;
  const candidate = store as Partial<ResearchDecisionEpisodeStore> & Readonly<{
    researchDecisionEpisodeStorage?: unknown;
  }>;
  return candidate.researchDecisionEpisodeStorage !== undefined &&
    typeof candidate.loadResearchDecisionEpisodes === "function" &&
    typeof candidate.loadResearchDecisionEpisode === "function" &&
    typeof candidate.saveResearchDecisionEpisode === "function";
}

function parseAiRuntimeConfigurationUpdate(value: unknown): Readonly<{
  expectedRevision: number;
  provider: (typeof AI_RUNTIME_PROVIDERS)[number];
  codexModel: (typeof CODEX_RUNTIME_MODELS)[number];
  codexReasoningEffort: (typeof CODEX_REASONING_EFFORTS)[number];
  deepseekAutomationEnabled: boolean;
}> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI runtime configuration update must be an object");
  }
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  const expectedKeys = [
    "codexModel",
    "codexReasoningEffort",
    "deepseekAutomationEnabled",
    "expectedRevision",
    "provider",
  ];
  if (
    JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
    !Number.isSafeInteger(body.expectedRevision) ||
    !AI_RUNTIME_PROVIDERS.includes(body.provider as never) ||
    !CODEX_RUNTIME_MODELS.includes(body.codexModel as never) ||
    !CODEX_REASONING_EFFORTS.includes(body.codexReasoningEffort as never) ||
    typeof body.deepseekAutomationEnabled !== "boolean"
  ) {
    throw new Error("AI runtime configuration update is invalid");
  }
  return Object.freeze({
    expectedRevision: body.expectedRevision as number,
    provider: body.provider as (typeof AI_RUNTIME_PROVIDERS)[number],
    codexModel: body.codexModel as (typeof CODEX_RUNTIME_MODELS)[number],
    codexReasoningEffort:
      body.codexReasoningEffort as (typeof CODEX_REASONING_EFFORTS)[number],
    deepseekAutomationEnabled: body.deepseekAutomationEnabled,
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
  agentExecutionRegistry?: AgentExecutionRegistry;
  agentCampaignDispatcher?: AgentCampaignDispatcher;
  modelRuntimeFactory?: (configuration: AiRuntimeConfiguration) => DiscoveryModelRuntime;
  semanticReviewScheduler?: SemanticReviewScheduler;
  premiseAnalysisDesk?: ReturnType<typeof createPremiseAnalysisDesk>;
  premiseAnalysisScheduler?: PremiseAnalysisScheduler;
  premiseEvidenceRouter?: PremiseEvidenceRouterPort | null;
  premiseEvidenceRoutingScheduler?: PremiseEvidenceRoutingScheduler;
  premiseRouteExpansionScheduler?: PremiseRouteExpansionScheduler;
  officialSourceDiscoveryAgent?: OfficialSourceDiscoveryAgentPort | null;
  officialSourceDiscoveryScheduler?: OfficialSourceDiscoveryScheduler;
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
  const agentExecutionRegistry = options?.agentExecutionRegistry ??
    new AgentExecutionRegistry(
      supportsAgentExecution(options?.discoveryStore)
        ? options.discoveryStore
        : undefined,
    );
  const marketOntologyAgentProposalStore =
    supportsMarketOntologyAgentProposals(options?.discoveryStore)
      ? options.discoveryStore
      : null;
  const ontologySearchIssueRevisionStore =
    supportsOntologySearchIssueRevisions(options?.discoveryStore)
      ? options.discoveryStore
      : null;
  let ontologySearchIssueRevisions: readonly OntologySearchIssueRevision[] =
    ontologySearchIssueRevisionStore?.loadOntologySearchIssueRevisions(512) ?? [];
  const relationDiscoveryStore = supportsRelationDiscoveryRecords(options?.discoveryStore)
    ? options.discoveryStore
    : null;
  const standingRouteEpisodeStore =
    supportsStandingOntologyRouteObservationEpisodes(options?.discoveryStore)
      ? options.discoveryStore
      : null;
  const researchDecisionStore = supportsResearchDecisionEpisodes(options?.discoveryStore)
    ? options.discoveryStore
    : null;
  let inMemoryResearchDecisionEpisodes: readonly ResearchDecisionEpisode[] = Object.freeze([]);
  let relationDiscoveryTaskRevisions: readonly RelationDiscoveryTaskRevision[] =
    relationDiscoveryStore?.loadRelationDiscoveryTaskRevisions(512) ?? [];
  agentExecutionRegistry.importLegacyConfiguration(
    aiRuntimeConfigurationDesk.current(),
  );
  agentExecutionRegistry.saveBatch(buildDefaultAgentRuntimePortfolio(
    aiRuntimeConfigurationDesk.current(),
  ));
  const modelRuntimeFactory = options?.modelRuntimeFactory ??
    ((configuration: AiRuntimeConfiguration) => createDiscoveryModelRuntime(
      process.env,
      { usageRecorder: aiUsageLedger, runtimeConfiguration: configuration },
    ));
  let modelRuntime = options?.modelRuntime ??
    modelRuntimeFactory(aiRuntimeConfigurationDesk.current());
  const semanticReviewCodexCredential = new CodexAuthCacheCredentialProvider(process.env);
  const semanticReviewCodexCredentialProvider = Object.freeze({
    configured: () =>
      aiRuntimeConfigurationDesk.current().provider === "CODEX" &&
      modelRuntime.projection.configured &&
      semanticReviewCodexCredential.configured(),
    resolve: () => semanticReviewCodexCredential.resolve(),
  });
  const agentCredentialBroker = new AgentCredentialBroker([
    new EnvironmentCredentialResolver(process.env),
    new CodexOAuthCredentialResolver(semanticReviewCodexCredential),
  ]);
  const agentExecutionCapabilityService = new AgentExecutionCapabilityService(
    agentExecutionRegistry,
    agentCredentialBroker,
  );
  const discoveryExecutionProfile = () => {
    const snapshot = agentExecutionRegistry.snapshot();
    const route = [...snapshot.workloadRoutes]
      .filter((item) => item.taskKind === "DISCOVERY_SCOUT")
      .sort((left, right) => right.revision - left.revision)[0];
    if (route === undefined) {
      throw new Error("Discovery execution profile is blocked: workload route is unavailable");
    }
    const profile = snapshot.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    );
    if (profile === undefined) {
      throw new Error("Discovery execution profile is blocked: routed profile is unavailable");
    }
    return profile;
  };
  const assertDiscoveryDispatchEligible = (): void => {
    // An unconfigured pool contains only the first-party heuristic worker and
    // therefore has no model-spend path to authorize.
    if (!modelRuntime.projection.configured) return;
    agentExecutionCapabilityService.assertServiceDispatchEligible(
      discoveryExecutionProfile(),
    );
  };
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
      assertDispatchEligible: assertDiscoveryDispatchEligible,
      onRecordChange: () => publishSearchLeaseChange(),
      context: (
        question,
        venueIds,
        lens,
        snapshot,
        feedback,
        candidatePolicy,
        semanticFamily,
        discoveryMode,
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
                routingMode: discoveryMode === "HEURISTIC_EXPLORATION"
                  ? "HEURISTIC_FIRST"
                  : "QUERY_FIRST",
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
      deepEnabled: () =>
        aiRuntimeConfigurationDesk.current().deepseekAutomationEnabled,
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
      runtimeConfiguration: () => aiRuntimeConfigurationDesk.current(),
      codexCredentialProvider: semanticReviewCodexCredentialProvider,
      ...(supportsSemanticReviewRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const probabilityEstimationDesk =
    options?.probabilityEstimationDesk ??
    createProbabilityEstimationDesk(process.env, {
      usageRecorder: aiUsageLedger,
      runtimeConfiguration: () => aiRuntimeConfigurationDesk.current(),
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
      engineAllowed: (engine) =>
        engine.provider === "CODEX" ||
        aiRuntimeConfigurationDesk.current().deepseekAutomationEnabled,
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
  const premiseEvidenceRouter = options?.premiseEvidenceRouter === undefined
    ? createPremiseEvidenceRouter(process.env, { usageRecorder: aiUsageLedger })
    : options.premiseEvidenceRouter;
  const premiseEvidenceRoutingScheduler = options?.premiseEvidenceRoutingScheduler ??
    new PremiseEvidenceRoutingScheduler({
      router: premiseEvidenceRouter,
      tickIntervalMs: parsePremiseEvidenceRoutingTickInterval(process.env),
      concurrencyLimit: 2,
      maxRequestsPerTick: 2,
      ...(supportsPremiseEvidenceRoutingSchedulerRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const expansionArchaeologist = marketArchaeologistDesk.projection();
  const premiseRouteExpander = Object.freeze({
    configured: expansionArchaeologist.configured,
    model: expansionArchaeologist.model,
    expanderIdentity: hashCanonical({
      schemaVersion: "pmh.premise-route-expander.v2",
      engine: "PI_MARKET_ARCHAEOLOGIST",
      model: expansionArchaeologist.model,
      mode: "EXACT_TRADED_STATE_REBINDING",
    }),
    expand: async (candidate: PremiseRouteExpansionCandidate) => {
      const record = await marketArchaeologistDesk.begin(
        candidate.corpus,
        candidate.question,
        "SCHEDULE",
      ).promise;
      if (record.status !== "PASS" || record.report === null) {
        throw new Error(record.diagnostic ?? "traded-state expansion produced no report");
      }
      return Object.freeze({
        marketArchaeologistRunId: record.runId,
        reportArtifactHash: record.report.artifactHash,
        generatedProposalIds: Object.freeze(
          record.report.result.proposals.map((proposal) => proposal.proposalId),
        ),
      });
    },
  });
  const premiseRouteExpansionScheduler = options?.premiseRouteExpansionScheduler ??
    new PremiseRouteExpansionScheduler({
      expander: premiseRouteExpander,
      tickIntervalMs: parsePremiseRouteExpansionTickInterval(process.env),
      ...(supportsPremiseRouteExpansionSchedulerRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const officialSourceDiscoveryAgent = options?.officialSourceDiscoveryAgent ??
    new AiSdkOfficialSourceDiscoveryAgent(
      process.env,
      () => aiRuntimeConfigurationDesk.current(),
    );
  const officialSourceDiscoveryScheduler =
    options?.officialSourceDiscoveryScheduler ??
    new OfficialSourceDiscoveryScheduler({
      agent: officialSourceDiscoveryAgent,
      tickIntervalMs: parseOfficialSourceDiscoveryTickInterval(process.env),
      concurrencyLimit: 2,
      maxRequestsPerTick: 2,
      ...(supportsOfficialSourceDiscoveryRecords(options?.discoveryStore)
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
      runtimeConfiguration: () => aiRuntimeConfigurationDesk.current(),
      codexCredentialProvider: semanticReviewCodexCredentialProvider,
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
  const relationDiscoveryProposalCompilations = ():
    readonly RelationDiscoveryProposalCompilation[] => {
    if (relationDiscoveryStore === null) return Object.freeze([]);
    const findings = relationDiscoveryStore.loadRelationDiscoveryFindings(512)
      .filter((item): item is RelationDiscoveryPositiveFinding =>
        item.kind === "RELATION_HYPOTHESIS"
      );
    const revisions = relationDiscoveryStore.loadRelationDiscoveryTaskRevisions(512);
    return compileRelationDiscoveryFindingsForSemanticReview({
      findings,
      taskRevisions: revisions,
      loadCorpus: (snapshotIdentity) =>
        relationDiscoveryStore.loadRelationDiscoveryCorpus(snapshotIdentity),
    });
  };
  const semanticReviewJobsForProposalIds = (
    proposalIds: readonly Hash[],
  ) => supportsSemanticReviewSchedulerRecords(options?.discoveryStore) &&
      options.discoveryStore.loadSemanticReviewJobRecordsByProposalIds !== undefined
    ? options.discoveryStore.loadSemanticReviewJobRecordsByProposalIds(proposalIds)
    : semanticReviewScheduler.projection().jobs.filter((item) =>
        proposalIds.includes(item.proposalId)
      );
  const semanticReviewRecordsForIds = (
    reviewIds: readonly Hash[],
  ): readonly SemanticReviewRecord[] => supportsSemanticReviewRecords(options?.discoveryStore) &&
      options.discoveryStore.loadSemanticReviewRecordsByIds !== undefined
    ? options.discoveryStore.loadSemanticReviewRecordsByIds(reviewIds)
    : semanticReviewDesk.projection().records.filter((item) =>
        reviewIds.includes(item.reviewId)
      );
  const probabilityJobsForProposalIds = (
    proposalIds: readonly Hash[],
  ) => supportsProbabilityEstimationSchedulerRecords(options?.discoveryStore) &&
      options.discoveryStore.loadProbabilityEstimationJobRecordsByProposalIds !== undefined
    ? options.discoveryStore.loadProbabilityEstimationJobRecordsByProposalIds(proposalIds)
    : probabilityEstimationScheduler.projection().jobs.filter((item) =>
        proposalIds.includes(item.proposalId)
      );
  const officialSourceJobsForRequirementIds = (requirementIds: readonly Hash[]) =>
    supportsOfficialSourceDiscoveryRecords(options?.discoveryStore) &&
      options.discoveryStore.loadOfficialSourceDiscoveryJobRecordsByRequirementIds !== undefined
      ? options.discoveryStore.loadOfficialSourceDiscoveryJobRecordsByRequirementIds(requirementIds)
      : officialSourceDiscoveryScheduler.projection().jobs.filter((item) =>
          officialSourceTaskRequirementIds(item.task).some((requirementId) =>
            requirementIds.includes(requirementId)
          )
        );
  const acquisitionJobsForRequirementIds = (requirementIds: readonly Hash[]) =>
    supportsEvidenceAcquisitionRecords(options?.discoveryStore) &&
      options.discoveryStore.loadEvidenceAcquisitionJobRecordsByRequirementIds !== undefined
      ? options.discoveryStore.loadEvidenceAcquisitionJobRecordsByRequirementIds(requirementIds)
      : evidenceAcquisitionScheduler.projection().jobs.filter((item) =>
          item.requirementIds.some((requirementId) => requirementIds.includes(requirementId))
        );
  const claimJobsForRequirementIds = (requirementIds: readonly Hash[]) =>
    supportsRuleEvidenceClaimSchedulerRecords(options?.discoveryStore) &&
      options.discoveryStore.loadRuleEvidenceClaimJobRecordsByRequirementIds !== undefined
      ? options.discoveryStore.loadRuleEvidenceClaimJobRecordsByRequirementIds(requirementIds)
      : ruleEvidenceClaimScheduler.projection().jobs.filter((item) =>
          requirementIds.includes(item.requirementId)
        );
  const standingRouteProjection = (
    corpus: MarketCorpusSnapshot,
  ) => {
    if (relationDiscoveryStore === null) return null;
    const routeFindings = relationDiscoveryStore.loadStandingOntologyRouteSourceFindings();
    return buildStandingOntologyRouteProjection({
      findings: routeFindings,
      taskRevisions: relationDiscoveryStore.loadRelationDiscoveryTaskRevisionsForTaskIds(
        routeFindings.map((item) => item.sourceTaskId),
      ),
      loadCorpus: (snapshotIdentity) =>
        relationDiscoveryStore.loadRelationDiscoveryCorpus(snapshotIdentity),
      currentCorpus: corpus,
    });
  };
  const relationWorkWithStandingRoutes = (input: Readonly<{
    proposals: readonly MarketOntologyAgentProposal[];
    ontologyRevisions: readonly OntologySearchIssueRevision[];
    execution: AgentExecutionSnapshot;
    corpus?: MarketCorpusSnapshot;
  }>): OntologyRelationWorkProjection => {
    const base = buildOntologyRelationWorkProjection({
      proposals: input.proposals,
      revisions: input.ontologyRevisions,
      execution: input.execution,
    });
    if (relationDiscoveryStore === null) return base;
    const corpus = input.corpus ?? catalogObservationDesk.corpus();
    const routeProjection = standingRouteProjection(corpus);
    if (routeProjection === null) return base;
    const followups = materializeStandingOntologyRouteFollowups({
      projection: routeProjection,
      ontology: buildMarketOntologySnapshot(corpus),
    });
    return extendOntologyRelationWorkWithStandingRouteFollowups({ base, followups });
  };
  const currentResearchActionState = (): Readonly<{
    allocation: ResearchAttentionAllocationProjection;
    targets: ResearchActionTargetProjection;
  }> => {
    const proposals = marketOntologyAgentProposalStore
      ?.loadMarketOntologyAgentProposals(200) ?? [];
    const ontologyRevisions = ontologySearchIssueRevisionStore
      ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
    const execution = agentExecutionRegistry.snapshot();
    const relationWork = relationWorkWithStandingRoutes({
      proposals,
      ontologyRevisions,
      execution,
    });
    const taskRevisions = relationDiscoveryStore
      ?.loadRelationDiscoveryTaskRevisions(512) ?? relationDiscoveryTaskRevisions;
    const findings = relationDiscoveryStore?.loadRelationDiscoveryFindings(512) ?? [];
    const proposalCompilations = relationDiscoveryProposalCompilations();
    const proposalIds = Object.freeze([...new Set(proposalCompilations.map((item) =>
      item.proposal.proposalId
    ))].sort());
    const semanticReviewJobs = semanticReviewJobsForProposalIds(proposalIds);
    const latestSemanticJobByProposal = new Map<Hash, SemanticReviewJobRecord>();
    for (const job of semanticReviewJobs) {
      const retained = latestSemanticJobByProposal.get(job.proposalId);
      if (retained === undefined || job.updatedAt > retained.updatedAt ||
          (job.updatedAt === retained.updatedAt && job.jobId > retained.jobId)) {
        latestSemanticJobByProposal.set(job.proposalId, job);
      }
    }
    const latestReviewIds = Object.freeze([...latestSemanticJobByProposal.values()]
      .flatMap((item) => item.lastReviewId === null ? [] : [item.lastReviewId]).sort());
    const activeRequirements = selectCurrentSemanticReviewRequirements({
      semanticReviewJobs,
      semanticReviewRecords: semanticReviewRecordsForIds(latestReviewIds),
      currentRequirements: officialSourceDiscoveryScheduler.applyAdmissions(
        retainedEvidenceRequirements(),
      ),
    });
    const activeRequirementIds = Object.freeze(activeRequirements.map((item) =>
      item.requirementId
    ).sort());
    const observedAt = new Date(
      Math.floor(Date.now() / 3_600_000) * 3_600_000,
    ).toISOString();
    const allocation = buildResearchAttentionAllocation({
      observedAt,
      relationWork,
      taskRevisions,
      findings,
      proposalCompilations,
      semanticReviewJobs,
      probabilityJobs: probabilityJobsForProposalIds(proposalIds),
      execution,
    });
    const targets = buildResearchActionTargetProjection({
      allocation,
      proposalCompilations,
      semanticReviewJobs,
      activeRequirements,
      officialSourceJobs: officialSourceJobsForRequirementIds(activeRequirementIds),
      acquisitionJobs: acquisitionJobsForRequirementIds(activeRequirementIds),
      claimJobs: claimJobsForRequirementIds(activeRequirementIds),
    });
    return Object.freeze({ allocation, targets });
  };
  const loadResearchDecisionEpisodes = () => researchDecisionStore
    ?.loadResearchDecisionEpisodes(512) ?? inMemoryResearchDecisionEpisodes;
  const saveResearchDecisionEpisode = (episode: ResearchDecisionEpisode) => {
    if (researchDecisionStore !== null) {
      return researchDecisionStore.saveResearchDecisionEpisode(episode);
    }
    const retained = inMemoryResearchDecisionEpisodes.find((item) =>
      item.episodeId === episode.episodeId
    );
    if (retained !== undefined) {
      if (hashCanonical(retained) !== hashCanonical(episode)) {
        throw new Error("research decision episode identity is already bound elsewhere");
      }
      return retained;
    }
    inMemoryResearchDecisionEpisodes = Object.freeze([
      episode,
      ...inMemoryResearchDecisionEpisodes,
    ].slice(0, 512));
    return episode;
  };
  const baseSemanticReviewCandidates = (): readonly SemanticReviewCandidate[] => {
    const relationCompilations = relationDiscoveryProposalCompilations();
    const reviewableRelationCompilations =
      selectRelationDiscoverySemanticReviewCompilations(relationCompilations);
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
    const retainedReviewJobs = semanticReviewScheduler.projection().jobs;
    for (const inherited of derivePremiseRouteExpansionReviewLineage(
      premiseRouteExpansionScheduler.projection().jobs,
      retainedReviewJobs.map((job) => Object.freeze({
        proposalId: job.proposalId,
        issueIds: job.issueIds,
        priority: recoverBaseReviewPriority({
          issuePriorities: job.issueIds.flatMap((issueId) => {
            const issue = issues.get(issueId);
            return issue === undefined ? [] : [issue.priority];
          }),
          retainedJobPriority: job.priority,
        }),
      })),
    )) {
      const current = lineage.get(inherited.proposalId) ?? {
        issueIds: new Set<Hash>(),
        priority: 1 as const,
      };
      for (const issueId of inherited.issueIds) current.issueIds.add(issueId);
      if (inherited.priority > current.priority) current.priority = inherited.priority;
      lineage.set(inherited.proposalId, current);
    }
    for (const compilation of reviewableRelationCompilations) {
      const current = lineage.get(compilation.proposal.proposalId) ?? {
        issueIds: new Set<Hash>(),
        priority: 1 as const,
      };
      for (const issueId of compilation.origin.semanticReviewIssueIds) {
        current.issueIds.add(issueId);
      }
      if (compilation.priority > current.priority) current.priority = compilation.priority;
      lineage.set(compilation.proposal.proposalId, current);
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
    for (const compilation of reviewableRelationCompilations) {
      sources.set(compilation.proposal.proposalId, {
        proposal: compilation.proposal,
        proposalCorpusSnapshotIdentity: compilation.origin.sourceCorpusSnapshotIdentity,
        evidenceBundle: compilation.evidenceBundle,
      });
    }
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
          const retainedBundle = storedJobBundle?.schemaVersion ===
              "pmh.proposal-evidence-bundle.v2"
            ? storedJobBundle
            : reportBundles.get(proposal.proposalId) ?? null;
          const evidenceBundle = selectCurrentSemanticEvidenceBundle({
            proposal,
            retainedBundle,
            currentSnapshot,
            proposalCorpusSnapshotIdentity: record.corpusSnapshotIdentity,
          });
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
        const evidenceBundle = selectCurrentSemanticEvidenceBundle({
          proposal: bundle.proposal,
          retainedBundle: bundle,
          currentSnapshot,
          proposalCorpusSnapshotIdentity: job.proposalCorpusSnapshotIdentity,
        });
        sources.set(job.proposalId, {
          proposal: bundle.proposal,
          proposalCorpusSnapshotIdentity: job.proposalCorpusSnapshotIdentity,
          evidenceBundle,
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
  const semanticReviewCandidates = (
    baseCandidates: readonly SemanticReviewCandidate[] = baseSemanticReviewCandidates(),
  ): readonly SemanticReviewCandidate[] => {
    const records = ruleEvidenceClaimDesk.projection().records;
    const inputs = ruleEvidenceClaimInputs();
    const existingClaims = new Map(semanticReviewScheduler.projection().jobs.map((job) =>
      [job.proposalId, job.evidenceClaims ?? []] as const
    ));
    const candidates = baseCandidates.map((candidate) => {
      const proposalInputs = inputs.filter((input) =>
        input.requirement.proposalId === candidate.proposal.proposalId
      );
      const claims = proposalInputs.length === 0
        ? []
        : proposalInputs.flatMap((input) => {
            const record = records.filter((item) =>
              item.status === "PASS" && item.claim !== null &&
              item.requirementId === input.requirement.requirementId &&
              item.documentId === input.capture.document.record.documentId &&
              item.extractionId === input.capture.extraction.record.extractionId
            ).sort((left, right) =>
              String(right.completedAt).localeCompare(String(left.completedAt)) ||
              right.interpretationId.localeCompare(left.interpretationId)
            )[0];
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
  const premiseAnalysisCandidates = (
    semanticCandidates: readonly SemanticReviewCandidate[] = semanticReviewCandidates(),
  ): readonly PremiseAnalysisCandidate[] => {
    const proposals = new Map(
      semanticCandidates.map((candidate) =>
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
        reviewJob === undefined || admission === null ||
        admission.lane !== "AUTO_PREMISE_REVIEW"
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
  const premiseEvidenceRoutingCandidates = (
    semanticCandidates: readonly SemanticReviewCandidate[] = semanticReviewCandidates(),
  ):
    readonly PremiseEvidenceRoutingCandidate[] => {
    const sources = new Map(
      semanticCandidates.map((candidate) =>
        [candidate.proposal.proposalId, candidate] as const
      ),
    );
    const currentCorpus = catalogObservationDesk.corpus();
    return Object.freeze(premiseAnalysisScheduler.projection().jobs.flatMap((job) => {
      const source = sources.get(job.proposalId);
      if (
        source === undefined || job.status !== "PASS" ||
        job.schemaVersion !== "pmh.premise-analysis-job.v3" ||
        job.outcomeCapsule === undefined || job.outcomeCapsule.unboundPremiseCount < 1
      ) return [];
      const retainedListings = source.evidenceBundle?.listings ?? [];
      const listings = [...new Map([
        ...currentCorpus.listings.map((listing) => [listing.listingRef, listing] as const),
        ...retainedListings.map((listing) => [listing.listingRef, listing] as const),
      ]).values()];
      if (source.proposal.listingRefs.some((listingRef) =>
        !listings.some((listing) => listing.listingRef === listingRef)
      )) return [];
      const corpus = buildMarketCorpusSnapshot({
        sourceSetIdentity: hashCanonical({
          schemaVersion: "pmh.premise-evidence-routing-corpus-source.v1",
          currentSourceSetIdentity: currentCorpus.sourceSetIdentity,
          evidenceBundleId: source.evidenceBundle?.bundleId ?? null,
        }),
        eligibleSourceCount: currentCorpus.eligibleSourceCount,
        excludedSourceCount: currentCorpus.excludedSourceCount,
        listings,
      });
      return [Object.freeze({
        proposal: source.proposal,
        outcome: job.outcomeCapsule,
        corpus,
      })];
    }));
  };
  const premiseRouteExpansionCandidates = ():
    readonly PremiseRouteExpansionCandidate[] => {
    const currentCorpus = catalogObservationDesk.corpus();
    const retainedListingsByProposal = new Map<string, readonly import("./types.js").DiscoveryCatalogListing[]>();
    for (const reviewJob of semanticReviewScheduler.projection().jobs) {
      if (reviewJob.evidenceBundle === null || reviewJob.evidenceBundle === undefined) continue;
      const retained = retainedListingsByProposal.get(reviewJob.proposalId) ?? [];
      retainedListingsByProposal.set(reviewJob.proposalId, Object.freeze([
        ...new Map([
          ...retained.map((listing) => [listing.listingRef, listing] as const),
          ...reviewJob.evidenceBundle.listings.map((listing) =>
            [listing.listingRef, listing] as const
          ),
        ]).values(),
      ]));
    }
    const routeJobs = premiseEvidenceRoutingScheduler.projection().jobs;
    const currentRouterIdentity = [...routeJobs].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.jobId.localeCompare(left.jobId)
    )[0]?.routerIdentity;
    if (currentRouterIdentity === undefined) return Object.freeze([]);
    return Object.freeze(routeJobs.flatMap((sourceJob) => {
      if (
        sourceJob.routerIdentity !== currentRouterIdentity ||
        sourceJob.status !== "PASS" || sourceJob.route === null
      ) return [];
      const retained = retainedListingsByProposal.get(sourceJob.proposal.proposalId) ?? [];
      const availableCorpus = buildMarketCorpusSnapshot({
        sourceSetIdentity: hashCanonical({
          schemaVersion: "pmh.premise-route-expansion-available-source.v1",
          currentSourceSetIdentity: currentCorpus.sourceSetIdentity,
          sourceRoutingArtifactHash: sourceJob.route.artifactHash,
          retainedListingHashes: retained.map((listing) => hashCanonical(listing)).sort(),
        }),
        eligibleSourceCount: currentCorpus.eligibleSourceCount,
        excludedSourceCount: currentCorpus.excludedSourceCount,
        listings: [...new Map([
          ...currentCorpus.listings.map((listing) => [listing.listingRef, listing] as const),
          ...retained.map((listing) => [listing.listingRef, listing] as const),
        ]).values()],
      });
      return sourceJob.route.groups.flatMap((group) => {
        if (group.disposition !== "TRADED_STATE_CANDIDATE") return [];
        try {
          return [buildPremiseRouteExpansionCandidate({
            sourceJob,
            availableCorpus,
            routeGroupId: group.groupId,
          })];
        } catch {
          // The source route remains visible. Missing or oversized exact refs
          // cannot silently become a provider request.
          return [];
        }
      });
    }));
  };
  const probabilitySearchOriginByReview = new Map<Hash,
    ReturnType<typeof buildProbabilitySearchOrigin> | null>();
  const probabilityEvidenceContextByReview = new Map<Hash,
    import("./probability-estimation-scheduler.js").ProbabilityEstimationEvidenceContext>();
  const probabilityEvidenceContextByArtifact = new Map<Hash,
    import("./probability-estimation-scheduler.js").ProbabilityEstimationEvidenceContext | null>();
  const probabilityEstimationCandidates = (
    retainedAttribution?: SemanticReviewAttributionSource,
  ): readonly ProbabilityEstimationCandidate[] => {
    const reviews = semanticReviewDesk.projection().records.filter((review) =>
      review.status === "PASS" && review.report !== null &&
      review.report.result.semanticConstraint?.classification === "PROBABILISTIC_DEPENDENCE"
    );
    const liveJobs = semanticReviewScheduler.projection().jobs;
    let durableJobs: SemanticReviewAttributionSource["jobs"] | null =
      retainedAttribution?.jobs ?? null;
    const allDurableJobs = (): SemanticReviewAttributionSource["jobs"] => {
      durableJobs ??= semanticReviewScheduler.attributionSource().jobs;
      return durableJobs;
    };
    const missingReviews = reviews.filter((review) =>
      !probabilitySearchOriginByReview.has(review.reviewId) ||
      !probabilityEvidenceContextByReview.has(review.reviewId)
    );
    const issues = new Map(searchIssueScheduler.projection().issues.map((issue) =>
      [issue.issueId, issue] as const
    ));
    const relationOriginsByProposal = new Map<Hash, RelationDiscoveryProposalCompilation[]>();
    for (const compilation of relationDiscoveryProposalCompilations()) {
      const retained = relationOriginsByProposal.get(compilation.proposal.proposalId) ?? [];
      retained.push(compilation);
      relationOriginsByProposal.set(compilation.proposal.proposalId, retained);
    }
    const liveJobKeys = new Set(liveJobs.map((job) =>
      `${job.lastReviewId ?? "none"}\u0000${job.proposalId}`
    ));
    const needsDurableFallback = missingReviews.some((review) => {
      const proposalId = review.report!.result.semanticConstraint!.proposalId;
      return !liveJobKeys.has(`${review.reviewId}\u0000${proposalId}`);
    });
    const reviewJobs = needsDurableFallback
      ? allDurableJobs()
      : liveJobs;
    const jobsByReviewProposal = new Map<string, (typeof reviewJobs)[number][]>();
    for (const job of reviewJobs) {
      if (job.lastReviewId === null) continue;
      const key = `${job.lastReviewId}\u0000${job.proposalId}`;
      const matching = jobsByReviewProposal.get(key) ?? [];
      matching.push(job);
      jobsByReviewProposal.set(key, matching);
    }
    for (const review of missingReviews) {
      const constraint = review.report?.result.semanticConstraint;
      if (constraint === undefined) continue;
      const matchingJobs = jobsByReviewProposal.get(
        `${review.reviewId}\u0000${constraint.proposalId}`,
      ) ?? [];
      if (!probabilitySearchOriginByReview.has(review.reviewId)) {
        const issueIds = Object.freeze([...new Set(matchingJobs.flatMap((job) =>
          job.issueIds
        ))].sort());
        const semanticFamilies = Object.freeze([...new Set(issueIds.flatMap((issueId) => {
          const family = issues.get(issueId)?.familyDefinition?.semanticFamily;
          return family === undefined ? [] : [family];
        }))].sort());
        const relationOrigins = relationOriginsByProposal.get(constraint.proposalId)
          ?.map((item) => item.origin) ?? [];
        const searchOrigin = relationOrigins.length > 0
          ? buildRelationDiscoveryProbabilitySearchOrigin({ origins: relationOrigins })
          : issueIds.length === 0 || semanticFamilies.length === 0
            ? null
            : buildProbabilitySearchOrigin({ issueIds, semanticFamilies });
        probabilitySearchOriginByReview.set(review.reviewId, searchOrigin);
      }
      if (!probabilityEvidenceContextByReview.has(review.reviewId)) {
        const evidenceContext = matchingJobs.flatMap((job) => {
          const bundle = job.evidenceBundle;
          if (bundle?.schemaVersion !== "pmh.proposal-evidence-bundle.v2") return [];
          try {
            return [buildProbabilityEstimationEvidenceContext({
              review,
              listings: bundle.listings,
              sourceKind: "DURABLE_REVIEW_BUNDLE",
              sourceArtifactHash: bundle.bundleId,
            })];
          } catch {
            return [];
          }
        })[0] ?? null;
        if (evidenceContext !== null) {
          probabilityEvidenceContextByReview.set(review.reviewId, evidenceContext);
        }
      }
    }
    const reviewCandidates = reviews.map((review) => {
      const searchOrigin = probabilitySearchOriginByReview.get(review.reviewId) ?? null;
      const evidenceContext = probabilityEvidenceContextByReview.get(review.reviewId) ?? null;
      return Object.freeze({
        review,
        ...(searchOrigin === null ? {} : { searchOrigin }),
        ...(evidenceContext === null ? {} : { evidenceContext }),
      });
    });
    const activeArtifacts = new Set(reviewCandidates.flatMap((candidate) =>
      candidate.review.report === null ? [] : [candidate.review.report.artifactHash]
    ));
    const retainedLineages = new Map<Hash, ProbabilityEstimationJobRecord>();
    for (const job of probabilityEstimationScheduler.projection().jobs) {
      if (!activeArtifacts.has(job.semanticReviewArtifactHash) &&
        !retainedLineages.has(job.semanticReviewArtifactHash)) {
        retainedLineages.set(job.semanticReviewArtifactHash, job);
      }
    }
    const unresolvedLineages = [...retainedLineages.values()].filter((job) =>
      job.evidenceContext === undefined &&
      !probabilityEvidenceContextByArtifact.has(job.semanticReviewArtifactHash)
    );
    const retainedReviewJobs = unresolvedLineages.length === 0
      ? []
      : allDurableJobs();
    const retainedCandidates = [...retainedLineages.values()].flatMap((job) => {
      let evidenceContext = job.evidenceContext ??
        probabilityEvidenceContextByArtifact.get(job.semanticReviewArtifactHash) ?? null;
      if (evidenceContext === null &&
        !probabilityEvidenceContextByArtifact.has(job.semanticReviewArtifactHash)) {
        evidenceContext = retainedReviewJobs.flatMap((reviewJob) => {
          const bundle = reviewJob.proposalId === job.proposalId
            ? reviewJob.evidenceBundle
            : null;
          if (bundle?.schemaVersion !== "pmh.proposal-evidence-bundle.v2") return [];
          try {
            return [buildRetainedProbabilityEstimationEvidenceContext({
              semanticReviewArtifactHash: job.semanticReviewArtifactHash,
              semanticConstraint: job.semanticConstraint,
              evidenceScopeIdentity: job.evidenceScopeIdentity,
              listings: bundle.listings,
              sourceKind: "DURABLE_REVIEW_BUNDLE",
              sourceArtifactHash: bundle.bundleId,
            })];
          } catch {
            return [];
          }
        })[0] ?? null;
        if (evidenceContext !== null) {
          probabilityEvidenceContextByArtifact.set(
            job.semanticReviewArtifactHash,
            evidenceContext,
          );
        }
      }
      return evidenceContext === null ? [] : [Object.freeze({
        semanticReviewArtifactHash: job.semanticReviewArtifactHash,
        semanticConstraint: job.semanticConstraint,
        evidenceScopeIdentity: job.evidenceScopeIdentity,
        evidenceContext,
        ...(job.searchOrigin === undefined ? {} : { searchOrigin: job.searchOrigin }),
      })];
    });
    return Object.freeze([...retainedCandidates, ...reviewCandidates]);
  };
  const retainedEvidenceRequirements = (): readonly EvidenceRequirement[] => {
    const retained = [...new Map([
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
      ...probabilityEstimationDesk.projection().records.flatMap((record) =>
        (record.evidenceNeeds ?? []).flatMap((need) =>
          need.acquisitionRequirement === null ? [] : [need.acquisitionRequirement]
        )
      ),
      ...evidenceAcquisitionScheduler.projection().jobs.flatMap((job) =>
        job.requirements
      ),
    ].map((requirement) => [requirement.requirementId, requirement] as const)).values()];
    const currentByProposal = new Map(baseSemanticReviewCandidates().map((candidate) =>
      [candidate.proposal.proposalId, candidate] as const
    ));
    const currentListingByRef = new Map(catalogObservationDesk.corpus().listings.map(
      (listing) => [listing.listingRef, listing] as const,
    ));
    const rebased = retained.map((requirement) => {
      const current = currentByProposal.get(requirement.proposalId);
      if (current?.evidenceBundle?.schemaVersion ===
          "pmh.proposal-evidence-bundle.v2") {
        return rebaseEvidenceRequirementToCurrentListings(requirement, {
            proposalListingRefs: current.proposal.listingRefs,
            listings: current.evidenceBundle.listings,
          });
      }
      const retainedProposalRefs = requirement.schemaVersion ===
          "pmh.evidence-requirement.v2"
        ? requirement.proposalListingRefs
        : requirement.listingRefs;
      const scopedListings = retainedProposalRefs.flatMap((listingRef) => {
        const listing = currentListingByRef.get(listingRef);
        return listing === undefined ? [] : [listing];
      });
      return retainedProposalRefs.length >= 2 &&
          scopedListings.length === retainedProposalRefs.length
        ? rebaseEvidenceRequirementToCurrentListings(requirement, {
            listings: scopedListings,
          })
        : requirement;
    });
    const capabilityRebased =
      rebaseEvidenceRequirementsToRetainedLocatorCapabilities(rebased);
    const locatorByObservationId = new Map(evidenceAcquisitionScheduler.projection().jobs
      .flatMap((job) => job.lastObservationId === null
        ? []
        : [[job.lastObservationId, job.locatorIdentity] as const]));
    const noveltyKey = (requirement: EvidenceRequirement) => hashCanonical({
      proposalId: requirement.proposalId,
      kind: requirement.kind,
      listingRefs: requirement.listingRefs,
      claim: requirement.claim,
      reason: requirement.reason,
      satisfyingObservation: requirement.satisfyingObservation,
      contradictingObservation: requirement.contradictingObservation,
    });
    const excludedLocatorsByRequirement = new Map<Hash, Set<Hash>>();
    for (const record of semanticReviewDesk.projection().records) {
      if (record.status !== "PASS" || record.report === null) continue;
      const alreadyReviewedLocators = new Set((record.report.input.evidenceClaims ?? [])
        .flatMap((claim) => {
        const locator = locatorByObservationId.get(claim.observationId);
        return locator === undefined || locator === null ? [] : [locator];
      }));
      if (alreadyReviewedLocators.size === 0) continue;
      for (const requirement of record.report.result.evidenceRequirements ?? []) {
        const key = noveltyKey(requirement);
        const excluded = excludedLocatorsByRequirement.get(key) ?? new Set<Hash>();
        for (const locator of alreadyReviewedLocators) excluded.add(locator);
        excludedLocatorsByRequirement.set(key, excluded);
      }
    }
    const noveltyRouted = capabilityRebased.map((requirement) =>
      excludeEvidenceRequirementLocators(
        requirement,
        [...(excludedLocatorsByRequirement.get(noveltyKey(requirement)) ?? [])],
      )
    );
    return Object.freeze([...new Map(noveltyRouted.map((requirement) =>
      [requirement.requirementId, requirement] as const
    )).values()]);
  };
  const evidenceRequirements = (): readonly EvidenceRequirement[] =>
    officialSourceDiscoveryScheduler.applyAdmissions(retainedEvidenceRequirements());
  const ruleEvidenceClaimInputs = (): readonly RuleEvidenceClaimInput[] => Object.freeze(
    evidenceAcquisitionScheduler.projection().jobs.flatMap((job) => {
      if (job.status !== "CAPTURED") return [];
      const capture = evidenceAcquisitionScheduler.captureForJob(job.jobId);
      if (capture === null) return [];
      return job.requirements.map((requirement) => Object.freeze({ requirement, capture }));
    }),
  );
  const ruleEvidenceAgentInputsByTaskId = new Map<Hash, RuleEvidenceClaimInput>();
  const refreshRuleEvidenceAgentInputs = (): readonly RuleEvidenceClaimInput[] => {
    const inputs = ruleEvidenceClaimInputs();
    ruleEvidenceAgentInputsByTaskId.clear();
    for (const input of inputs) {
      ruleEvidenceAgentInputsByTaskId.set(buildRuleEvidenceAgentTask(input).taskId, input);
    }
    return inputs;
  };
  const reconcileRuleEvidenceAgentTasks = (): void => {
    agentExecutionRegistry.reconcileRuleEvidenceTasks(refreshRuleEvidenceAgentInputs());
  };
  const ruleEvidenceAgentInput = (taskId: Hash) =>
    ruleEvidenceAgentInputsByTaskId.get(taskId) ?? null;
  const ontologyAgentTaskRevision = (taskId: Hash, run: AgentRun) =>
    resolveOntologyAgentTaskRevision({
      taskId,
      run,
      campaigns: agentExecutionRegistry.snapshot().campaigns,
      currentRevisions: ontologySearchIssueRevisions,
      ...(ontologySearchIssueRevisionStore === null ? {} : {
        loadRevision: (revisionId: Hash) =>
          ontologySearchIssueRevisionStore.loadOntologySearchIssueRevision(revisionId),
      }),
    });
  const relationDiscoveryTaskRevision = (taskId: Hash, run: AgentRun) =>
    resolveRelationDiscoveryTaskRevision({
      taskId,
      run,
      campaigns: agentExecutionRegistry.snapshot().campaigns,
      currentRevisions: relationDiscoveryStore
        ?.loadRelationDiscoveryTaskRevisionsForTaskIds([taskId]) ??
        relationDiscoveryTaskRevisions,
      ...(relationDiscoveryStore === null ? {} : {
        loadRevision: (revisionId: Hash) => relationDiscoveryStore
          .loadRelationDiscoveryTaskRevision(revisionId),
      }),
    });
  const agentCampaignDispatcher = options?.agentCampaignDispatcher ??
    new AgentCampaignDispatcher({
      registry: agentExecutionRegistry,
      credentialBroker: agentCredentialBroker,
      capabilityService: agentExecutionCapabilityService,
      adapters: [
        createPiCliAgentRuntimeAdapter({ environment: process.env, timeoutMs: 300_000 }),
        createCodexAppServerAgentRuntimeAdapter({
          environment: process.env,
          turnTimeoutMs: 300_000,
        }),
        createInProcessAiSdkAgentRuntimeAdapter({ timeoutMs: 300_000 }),
      ],
      toolHost: (task, taskPayload, run) => {
        if (task.kind === "RULE_EVIDENCE_CLAIM") {
          return new RuleEvidenceAgentToolHost(ruleEvidenceAgentInput, (
            context,
            source,
            result,
          ) => {
            const snapshot = agentExecutionRegistry.snapshot();
            const profile = snapshot.executionProfiles.find((item) =>
              item.executionProfileId === context.executionProfile.executionProfileId
            );
            const model = profile === undefined ? undefined : snapshot.modelProfiles.find((item) =>
              item.modelProfileId === profile.modelProfileId
            );
            if (model === undefined) {
              throw new Error("Agent Rule Evidence model profile is unavailable");
            }
            const codex = model.accessDriver === "CODEX_RESPONSES";
            const configuration = model.configuration as Readonly<Record<string, unknown>>;
            const reasoning = configuration.reasoning as Readonly<Record<string, unknown>> | undefined;
            const engine: RuleEvidenceInterpreterEngine = Object.freeze({
              provider: codex ? "CODEX" : "DEEPSEEK",
              transport: "AGENT_RUNTIME",
              model: model.model,
              reasoningEffort: codex
                ? reasoning?.effort as RuleEvidenceInterpreterEngine["reasoningEffort"]
                : null,
              responseStorage: false,
            });
            const record = ruleEvidenceClaimDesk.retainAgentResult({
              requirement: source.requirement,
              capture: source.capture,
              engine,
              startedAt: context.run.createdAt,
              completedAt: new Date().toISOString(),
              result,
            });
            if (record.claim === null) {
              throw new Error("Agent Rule Evidence claim was not retained");
            }
            ruleEvidenceClaimScheduler.reconcile(ruleEvidenceClaimInputs());
            return Object.freeze({
              claimId: record.claim.claimId,
              artifactHash: record.claim.artifactHash,
            });
          });
        }
        if (task.kind === "ONTOLOGY_NORMALIZATION") {
          const revision = ontologyAgentTaskRevision(task.taskId, run);
          return revision.schemaVersion === "pmh.ontology-search-issue-revision.v2"
            ? MarketOntologyAgentToolHost.fromIssueRevision(
                revision.taskContract,
                revision.taskPayload,
                marketOntologyAgentProposalStore ?? undefined,
              )
            : MarketOntologyAgentToolHost.fromTaskPayload(
                revision.taskPayload,
                marketOntologyAgentProposalStore ?? undefined,
              );
        }
        if (task.kind === "RELATION_DISCOVERY") {
          const revision = relationDiscoveryTaskRevision(task.taskId, run);
          const corpus = relationDiscoveryStore?.loadRelationDiscoveryCorpus(
            revision.sourceCorpusSnapshotIdentity,
          ) ?? null;
          if (corpus === null) {
            throw new Error("retained relation discovery corpus is unavailable");
          }
          return new RelationDiscoveryAgentToolHost(
            revision.taskPayload,
            corpus,
            relationDiscoveryStore ?? undefined,
            relationDiscoveryRevisionWorkItem(revision),
          );
        }
        throw new Error("Agent task has no registered first-party tool host");
      },
      taskPayload: (task, run) => {
        if (task.kind === "RULE_EVIDENCE_CLAIM") {
          const input = ruleEvidenceAgentInput(task.taskId);
          if (input === null) throw new Error("retained Agent task input is unavailable");
          return buildRuleEvidenceAgentTaskPayload(input);
        }
        if (task.kind === "ONTOLOGY_NORMALIZATION") {
          const revision = ontologyAgentTaskRevision(task.taskId, run);
          return revision.schemaVersion === "pmh.ontology-search-issue-revision.v2"
            ? revision.taskContract
            : revision.taskPayload;
        }
        if (task.kind === "RELATION_DISCOVERY") {
          const revision = relationDiscoveryTaskRevision(task.taskId, run);
          return revision.taskPayload as RelationDiscoveryTaskPayload;
        }
        throw new Error("retained Agent task payload is unavailable");
      },
      runAnnotations: (task, run) => {
        if (task.kind === "ONTOLOGY_NORMALIZATION") {
          const revision = ontologyAgentTaskRevision(task.taskId, run);
          return Object.freeze([buildAgentInputRevisionRunAnnotation({
            task,
            run,
            revisionKind: "ONTOLOGY_SEARCH_ISSUE",
            revisionId: revision.revisionId,
            exactInput: revision.taskPayload,
          })]);
        }
        if (task.kind === "RELATION_DISCOVERY") {
          const revision = relationDiscoveryTaskRevision(task.taskId, run);
          return Object.freeze([buildAgentInputRevisionRunAnnotation({
            task,
            run,
            revisionKind: "RELATION_DISCOVERY",
            revisionId: revision.revisionId,
            exactInput: revision.taskPayload,
          })]);
        }
        return Object.freeze([]);
      },
    });
  const migrateLegacyRuleEvidenceAgentRuns = (): void => {
    const captureSource = options?.discoveryStore as Partial<{
      loadRetainedEvidenceDocumentCaptures(): readonly import("./evidence-document.js").EvidenceDocumentCapture[];
    }> | undefined;
    const migration = buildRuleEvidenceAgentMigration({
      snapshot: agentExecutionRegistry.snapshot(),
      jobs: ruleEvidenceClaimScheduler.projection().jobs,
      records: ruleEvidenceClaimDesk.projection().records,
      usageEvents: aiUsageLedger.events(),
      ...(captureSource?.loadRetainedEvidenceDocumentCaptures === undefined
        ? {}
        : { captures: captureSource.loadRetainedEvidenceDocumentCaptures() }),
      observedAt: new Date().toISOString(),
    });
    agentExecutionRegistry.saveBatch(migration.batch);
  };
  const synchronizeLifecycleSources = (): void => {
    opportunityLifecycleDesk.syncMarketArchaeologist(
      marketArchaeologistDesk.projection(),
    );
    opportunityLifecycleDesk.syncRealCandidate(
      realCandidatePreflightDesk.dispositionProjection(),
    );
  };
  type StartupReadinessPhase =
    | "STARTUP_GATE"
    | "DURABLE_RECOVERY"
    | "AGENT_RECONCILIATION"
    | "WAITING_FOR_PROJECTION"
    | "MATERIALIZING_PROJECTION"
    | "READY"
    | "FAILED";
  const startupStartedAtMs = Date.now();
  let startupPhaseStartedAtMs = startupStartedAtMs;
  const startupPhaseTimings: Array<Readonly<{
    phase: StartupReadinessPhase;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  }>> = [];
  const startupReconciliationTimings: Array<Readonly<{
    step: string;
    durationMs: number;
  }>> = [];
  let startupReadiness = Object.freeze({
    schemaVersion: "pmh.startup-readiness.v1" as const,
    status: "STARTING" as "STARTING" | "READY" | "FAILED",
    phase: "STARTUP_GATE" as StartupReadinessPhase,
    startedAt: new Date(startupStartedAtMs).toISOString(),
    phaseStartedAt: new Date(startupPhaseStartedAtMs).toISOString(),
    completedAt: null as string | null,
    elapsedMs: 0 as number,
    phaseElapsedMs: 0 as number,
    diagnostic: null as string | null,
    phaseTimings: Object.freeze([...startupPhaseTimings]),
    reconciliationTimings: Object.freeze([...startupReconciliationTimings]),
    projectionResource: "/api/v1/projection" as const,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  const transitionStartup = (
    phase: StartupReadinessPhase,
    status: "STARTING" | "READY" | "FAILED" = "STARTING",
    diagnostic: string | null = null,
  ): void => {
    const nowMs = Date.now();
    const completedPhaseElapsedMs = Math.max(0, nowMs - startupPhaseStartedAtMs);
    startupPhaseTimings.push(Object.freeze({
      phase: startupReadiness.phase,
      startedAt: new Date(startupPhaseStartedAtMs).toISOString(),
      completedAt: new Date(nowMs).toISOString(),
      durationMs: completedPhaseElapsedMs,
    }));
    startupPhaseStartedAtMs = nowMs;
    startupReadiness = Object.freeze({
      ...startupReadiness,
      status,
      phase,
      phaseStartedAt: new Date(nowMs).toISOString(),
      completedAt: status === "STARTING" ? null : new Date(nowMs).toISOString(),
      elapsedMs: Math.max(0, nowMs - startupStartedAtMs),
      phaseElapsedMs: status === "STARTING" ? 0 : completedPhaseElapsedMs,
      diagnostic,
      phaseTimings: Object.freeze([...startupPhaseTimings]),
    });
  };
  const startupReadinessProjection = () => {
    const nowMs = Date.now();
    return Object.freeze({
      ...startupReadiness,
      elapsedMs: startupReadiness.completedAt === null
        ? Math.max(0, nowMs - startupStartedAtMs)
        : startupReadiness.elapsedMs,
      phaseElapsedMs: startupReadiness.completedAt === null
        ? Math.max(0, nowMs - startupPhaseStartedAtMs)
        : startupReadiness.phaseElapsedMs,
      reconciliationTimings: Object.freeze([...startupReconciliationTimings]),
    });
  };
  const runStartupReconciliationStep = (step: string, action: () => void): void => {
    const startedAtMs = Date.now();
    action();
    startupReconciliationTimings.push(Object.freeze({
      step,
      durationMs: Math.max(0, Date.now() - startedAtMs),
    }));
  };
  const reconcileOntologySearchIssues = (): void => {
    if (ontologySearchIssueRevisionStore === null) return;
    const corpus = catalogObservationDesk.corpus();
    const ontology = buildMarketOntologySnapshot(corpus);
    const proposals = marketOntologyAgentProposalStore
      ?.loadMarketOntologyAgentProposals(200) ?? [];
    const retainedRevisions = ontologySearchIssueRevisionStore
      .loadOntologySearchIssueRevisions(512);
    const reconciliation = reconcileOntologySearchIssueRevisions({
      ontology,
      corpus,
      proposals,
      retainedRevisions,
    });
    const knownTaskIds = new Set(agentExecutionRegistry.snapshot().tasks
      .map((task) => task.taskId));
    const created = reconciliation.currentRevisions.filter((revision) =>
      reconciliation.createdRevisionIds.includes(revision.revisionId)
    );
    const newTasks = [...new Map(created
      .filter((revision) => !knownTaskIds.has(revision.task.taskId))
      .map((revision) => [revision.task.taskId, revision.task] as const)).values()];
    if (newTasks.length > 0) agentExecutionRegistry.saveBatch({ tasks: newTasks });
    if (created.length > 0) {
      ontologySearchIssueRevisionStore.saveOntologySearchIssueRevisions(created);
    }
    ontologySearchIssueRevisions = reconciliation.currentRevisions;
  };
  const reconcileRelationDiscoveryTasks = (): void => {
    if (relationDiscoveryStore === null) return;
    const corpus = catalogObservationDesk.corpus();
    const proposals = marketOntologyAgentProposalStore
      ?.loadMarketOntologyAgentProposals(200) ?? [];
    const retainedOntologyRevisions = ontologySearchIssueRevisionStore
      ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
    const routes = standingRouteProjection(corpus);
    relationDiscoveryStore.saveRelationDiscoveryCorpus(corpus);
    if (routes !== null && standingRouteEpisodeStore !== null) {
      const familyIds = routes.families.map((item) => item.family.routeFamilyId);
      const priorEpisodes = standingRouteEpisodeStore
        .loadStandingOntologyRouteObservationEpisodes(familyIds);
      const episodes = materializeStandingOntologyRouteObservationEpisodes({
        projection: routes,
        priorEpisodes,
        observedAt: new Date().toISOString(),
      });
      if (episodes.length > 0) {
        standingRouteEpisodeStore.saveStandingOntologyRouteObservationEpisodes(episodes);
      }
    }
    const relationWork = relationWorkWithStandingRoutes({
      proposals,
      ontologyRevisions: retainedOntologyRevisions,
      execution: agentExecutionRegistry.snapshot(),
      corpus,
    });
    const retainedRevisions = relationDiscoveryStore
      .loadRelationDiscoveryTaskRevisions(512);
    const reconciliation = reconcileRelationDiscoveryTaskRevisions({
      relationWork,
      corpus,
      retainedRevisions,
      loadRetainedCorpus: (snapshotIdentity) =>
        relationDiscoveryStore.loadRelationDiscoveryCorpus(snapshotIdentity),
    });
    const created = reconciliation.currentRevisions.filter((revision) =>
      reconciliation.createdRevisionIds.includes(revision.revisionId)
    );
    agentExecutionRegistry.saveBatch({ tasks: created.map((item) => item.task) });
    relationDiscoveryStore.saveRelationDiscoveryTaskRevisions(created);
    relationDiscoveryTaskRevisions = reconciliation.currentRevisions;
  };
  const migrateStandingRouteSeedCampaigns = (): void => {
    const campaigns = migrateStandingRouteSeedCampaignPolicies({
      campaigns: agentExecutionRegistry.snapshot().campaigns,
      observedAt: new Date().toISOString(),
    });
    if (campaigns.length > 0) agentExecutionRegistry.saveBatch({ campaigns });
  };
  const ready = (options?.startupGate ?? Promise.resolve()).then(async () => {
    transitionStartup("DURABLE_RECOVERY");
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
    transitionStartup("AGENT_RECONCILIATION");
    runStartupReconciliationStep("SYNCHRONIZE_LIFECYCLE_SOURCES", synchronizeLifecycleSources);
    runStartupReconciliationStep("RECONCILE_RULE_EVIDENCE_TASKS", reconcileRuleEvidenceAgentTasks);
    runStartupReconciliationStep("MIGRATE_LEGACY_RULE_EVIDENCE_RUNS", migrateLegacyRuleEvidenceAgentRuns);
    runStartupReconciliationStep("RECONCILE_ONTOLOGY_SEARCH_ISSUES", reconcileOntologySearchIssues);
    runStartupReconciliationStep(
      "RECONCILE_RELATION_DISCOVERY_TASKS",
      reconcileRelationDiscoveryTasks,
    );
    runStartupReconciliationStep(
      "MIGRATE_STANDING_ROUTE_SEED_CAMPAIGNS",
      migrateStandingRouteSeedCampaigns,
    );
    runStartupReconciliationStep(
      "RECOVER_PREPARED_AGENT_RUNS",
      () => { agentCampaignDispatcher.recoverPreparedRuns(); },
    );
    transitionStartup("WAITING_FOR_PROJECTION");
  });
  void ready.catch((error: unknown) => {
    transitionStartup(
      "FAILED",
      "FAILED",
      error instanceof Error ? error.message : "control-plane startup failed",
    );
  });

  const agentExecutionConsole = async () => {
    const snapshot = agentExecutionRegistry.snapshot();
    const effectiveCampaignIds = new Set(effectiveAgentCampaigns(snapshot.campaigns).map((item) =>
      item.campaignId
    ));
    const configurations = await Promise.all(snapshot.credentialBindings.map((binding) =>
      agentCredentialBroker.configuration(binding)
    ));
    const configurationById = new Map(configurations.map((item) =>
      [item.credentialBindingId, item] as const
    ));
    const capabilities = snapshot.executionProfiles.map((profile) => {
      const configuration = configurationById.get(profile.credentialBindingId);
      if (configuration === undefined) {
        throw new Error("Execution profile credential configuration is unavailable");
      }
      return agentExecutionCapabilityService.project(profile, configuration);
    });
    const orderedTasks = [...snapshot.tasks].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.taskId.localeCompare(right.taskId)
    );
    const orderedRuns = [...snapshot.runs].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.runId.localeCompare(right.runId)
    );
    const visibleRunIds = new Set(orderedRuns.slice(0, 250).map((run) => run.runId));
    const inputTokens = snapshot.modelInvocations.reduce(
      (total, item) => total + BigInt(item.inputTokens ?? "0"),
      0n,
    );
    const outputTokens = snapshot.modelInvocations.reduce(
      (total, item) => total + BigInt(item.outputTokens ?? "0"),
      0n,
    );
    const reasoningTokens = snapshot.modelInvocations.reduce(
      (total, item) => total + BigInt(item.reasoningTokens ?? "0"),
      0n,
    );
    const runsById = new Map(snapshot.runs.map((run) => [run.runId, run] as const));
    const tasksById = new Map(snapshot.tasks.map((task) => [task.taskId, task] as const));
    const profilesById = new Map(snapshot.executionProfiles.map((profile) =>
      [profile.executionProfileId, profile] as const
    ));
    const modelsById = new Map(snapshot.modelProfiles.map((profile) =>
      [profile.modelProfileId, profile] as const
    ));
    const runtimesById = new Map(snapshot.runtimeDefinitions.map((runtime) =>
      [runtime.runtimeDefinitionId, runtime] as const
    ));
    const usageBreakdown = new Map<string, {
      runtimeKind: string;
      model: string;
      taskKind: string;
      invocationCount: number;
      failedInvocationCount: number;
      inputTokens: bigint;
      outputTokens: bigint;
      reasoningTokens: bigint;
    }>();
    const dailyUsage = new Map<string, {
      invocationCount: number;
      inputTokens: bigint;
      outputTokens: bigint;
    }>();
    for (const invocation of snapshot.modelInvocations) {
      const run = runsById.get(invocation.runId);
      const task = run === undefined ? undefined : tasksById.get(run.taskId);
      const profile = run === undefined ? undefined : profilesById.get(run.executionProfileId);
      const model = profile === undefined ? undefined : modelsById.get(profile.modelProfileId);
      const runtime = profile === undefined ? undefined : runtimesById.get(
        profile.runtimeDefinitionId,
      );
      const identity = `${runtime?.kind ?? "UNKNOWN"}|${model?.model ?? "UNKNOWN"}|${task?.kind ?? "UNKNOWN"}`;
      const aggregate = usageBreakdown.get(identity) ?? {
        runtimeKind: runtime?.kind ?? "UNKNOWN",
        model: model?.model ?? "UNKNOWN",
        taskKind: task?.kind ?? "UNKNOWN",
        invocationCount: 0,
        failedInvocationCount: 0,
        inputTokens: 0n,
        outputTokens: 0n,
        reasoningTokens: 0n,
      };
      aggregate.invocationCount += 1;
      if (invocation.status !== "SUCCEEDED") aggregate.failedInvocationCount += 1;
      aggregate.inputTokens += BigInt(invocation.inputTokens ?? "0");
      aggregate.outputTokens += BigInt(invocation.outputTokens ?? "0");
      aggregate.reasoningTokens += BigInt(invocation.reasoningTokens ?? "0");
      usageBreakdown.set(identity, aggregate);
      const day = invocation.completedAt.slice(0, 10);
      const daily = dailyUsage.get(day) ?? {
        invocationCount: 0,
        inputTokens: 0n,
        outputTokens: 0n,
      };
      daily.invocationCount += 1;
      daily.inputTokens += BigInt(invocation.inputTokens ?? "0");
      daily.outputTokens += BigInt(invocation.outputTokens ?? "0");
      dailyUsage.set(day, daily);
    }
    return Object.freeze({
      schemaVersion: "pmh.agent-execution-console.v1" as const,
      summary: agentExecutionRegistry.projection(),
      runtimeDefinitions: snapshot.runtimeDefinitions,
      credentialBindings: snapshot.credentialBindings.map((binding) => Object.freeze({
        ...binding,
        configuration: configurations.find((item) =>
          item.credentialBindingId === binding.credentialBindingId
        ) ?? null,
      })),
      modelProfiles: snapshot.modelProfiles,
      executionProfiles: snapshot.executionProfiles,
      capabilities,
      workloadRoutes: snapshot.workloadRoutes,
      campaigns: snapshot.campaigns.map((campaign) => Object.freeze({
        ...campaign,
        superseded: !effectiveCampaignIds.has(campaign.campaignId),
        preview: campaign.status === "ACTIVE" && effectiveCampaignIds.has(campaign.campaignId)
          ? agentCampaignDispatcher.preview(campaign.campaignId)
          : null,
      })),
      tasks: Object.freeze(orderedTasks.slice(0, 250)),
      runs: Object.freeze(orderedRuns.slice(0, 250)),
      modelInvocations: Object.freeze(snapshot.modelInvocations.filter((item) =>
        visibleRunIds.has(item.runId)
      )),
      toolEffects: Object.freeze(snapshot.toolEffects.filter((item) =>
        visibleRunIds.has(item.runId)
      )),
      runArtifacts: Object.freeze(snapshot.runArtifacts.filter((item) =>
        visibleRunIds.has(item.runId)
      )),
      runAnnotations: Object.freeze(snapshot.runAnnotations.filter((item) =>
        visibleRunIds.has(item.runId)
      )),
      resultSelections: snapshot.resultSelections,
      usage: Object.freeze({
        invocationCount: snapshot.modelInvocations.length,
        inputTokens: inputTokens.toString(),
        outputTokens: outputTokens.toString(),
        reasoningTokens: reasoningTokens.toString(),
        incompleteTokenInvocationCount: snapshot.modelInvocations.filter((item) =>
          item.inputTokens === null || item.outputTokens === null
        ).length,
        currencyCost: null,
        currencyCostDiagnostic: "No immutable model-price schedule is retained for these runs.",
        byRuntimeModelPurpose: Object.freeze([...usageBreakdown.values()].map((item) =>
          Object.freeze({
            ...item,
            inputTokens: item.inputTokens.toString(),
            outputTokens: item.outputTokens.toString(),
            reasoningTokens: item.reasoningTokens.toString(),
          })
        ).sort((left, right) => {
          const leftTotal = BigInt(left.inputTokens) + BigInt(left.outputTokens);
          const rightTotal = BigInt(right.inputTokens) + BigInt(right.outputTokens);
          return rightTotal > leftTotal ? 1 : rightTotal < leftTotal ? -1 :
            left.model.localeCompare(right.model);
        })),
        byDay: Object.freeze([...dailyUsage.entries()].map(([day, item]) => Object.freeze({
          day,
          invocationCount: item.invocationCount,
          inputTokens: item.inputTokens.toString(),
          outputTokens: item.outputTokens.toString(),
        })).sort((left, right) => right.day.localeCompare(left.day))),
      }),
      incidentCounts: Object.freeze(Object.fromEntries(
        [...new Set(snapshot.runAnnotations.map((item) => item.category))]
          .sort()
          .map((category) => [
            category,
            snapshot.runAnnotations.filter((item) => item.category === category).length,
          ]),
      )),
      providerRequestsStartedByRead: 0 as const,
      credentialSecretTextRetained: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
  };
  const ontologyAgentCampaignPreview = async () => {
    const snapshot = agentExecutionRegistry.snapshot();
    const route = [...snapshot.workloadRoutes]
      .filter((item) => item.taskKind === "ONTOLOGY_NORMALIZATION")
      .sort((left, right) =>
        right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
      )[0];
    if (route === undefined) throw new Error("Ontology execution workload route is unavailable");
    const profile = snapshot.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    );
    if (profile === undefined) throw new Error("Ontology execution profile is unavailable");
    const binding = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (binding === undefined) throw new Error("Ontology credential binding is unavailable");
    const configuration = await agentCredentialBroker.configuration(binding);
    const proposals = marketOntologyAgentProposalStore
      ?.loadMarketOntologyAgentProposals(200) ?? [];
    const retainedRevisions = ontologySearchIssueRevisionStore
      ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
    const relationWork = buildOntologyRelationWorkProjection({
      proposals,
      revisions: retainedRevisions,
      execution: snapshot,
    });
    return buildOntologyAgentCampaignPreview({
      revisions: ontologySearchIssueRevisions,
      retainedRevisions,
      proposals,
      relationWork,
      execution: snapshot,
      capability: agentExecutionCapabilityService.project(profile, configuration),
    });
  };
  const ontologyAllocationOutcomes = () => {
    const execution = agentExecutionRegistry.snapshot();
    const selectedCampaigns = execution.campaigns.filter((campaign): campaign is Extract<
      AgentCampaign,
      { schemaVersion: "pmh.agent-campaign.v2" | "pmh.agent-campaign.v3" }
    > => (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3") &&
      campaign.selectionBinding.selectionProtocol === "ONTOLOGY_ATTENTION_ALLOCATION_V1"
    );
    const selectedCampaignIds = new Set(selectedCampaigns.map((item) => item.campaignId));
    const selectedBindings = selectedCampaigns.flatMap((item) =>
      item.selectionBinding.taskBindings
    );
    const directRunIds = new Set(execution.runs.filter((run) =>
      run.authorization.campaignId !== null &&
      selectedCampaignIds.has(run.authorization.campaignId) && selectedBindings.some((binding) =>
        binding.taskId === run.taskId && execution.runAnnotations.some((annotation) =>
          annotation.runId === run.runId && agentInputRevisionAnnotationMatches({
            annotation,
            taskId: binding.taskId,
            revisionKind: "ONTOLOGY_SEARCH_ISSUE",
            revisionId: binding.inputRevisionId,
            exactInputHash: binding.exactInputHash,
          })
        )
      )
    ).map((run) => run.runId));
    const ontologyProposals = (marketOntologyAgentProposalStore
      ?.loadMarketOntologyAgentProposals(512) ?? []).filter((proposal) =>
        directRunIds.has(proposal.sourceAgentRunId)
      );
    const retainedRevisions = ontologySearchIssueRevisionStore
      ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
    const relationWork = buildOntologyRelationWorkProjection({
      proposals: ontologyProposals,
      revisions: retainedRevisions,
      execution,
    });
    const relationWorkItemIds = new Set(relationWork.items.map((item) => item.workItemId));
    const relationTaskRevisions = (relationDiscoveryStore
      ?.loadRelationDiscoveryTaskRevisions(512) ?? relationDiscoveryTaskRevisions).filter((item) =>
        relationWorkItemIds.has(item.workItemId)
      );
    const relationRunIds = new Set(execution.runs.filter((run) =>
      relationTaskRevisions.some((revision) => run.taskId === revision.task.taskId &&
        execution.runAnnotations.some((annotation) =>
          annotation.runId === run.runId && agentInputRevisionAnnotationMatches({
            annotation,
            taskId: revision.task.taskId,
            revisionKind: "RELATION_DISCOVERY",
            revisionId: revision.revisionId,
            exactInputHash: hashCanonical(revision.taskPayload),
          })
        )
      )
    ).map((run) => run.runId));
    const relationFindings = (relationDiscoveryStore
      ?.loadRelationDiscoveryFindings(512) ?? []).filter((item) =>
        relationWorkItemIds.has(item.workItemId) && relationRunIds.has(item.sourceAgentRunId)
      );
    const relationCompilations = relationDiscoveryStore === null
      ? Object.freeze([])
      : compileRelationDiscoveryFindingsForSemanticReview({
          findings: relationFindings.filter((item): item is RelationDiscoveryPositiveFinding =>
            item.kind === "RELATION_HYPOTHESIS"
          ),
          taskRevisions: relationTaskRevisions,
          loadCorpus: (snapshotIdentity) =>
            relationDiscoveryStore.loadRelationDiscoveryCorpus(snapshotIdentity),
        });
    const semanticProposalIds = Object.freeze(relationCompilations.map((item) =>
      item.proposal.proposalId
    ));
    const semanticOpportunityIds = new Set(semanticProposalIds.map((proposalId) =>
      `ai:${proposalId}`
    ));
    const semanticReviews = semanticProposalIds.length === 0
      ? Object.freeze([])
      : semanticReviewJobsForProposalIds(semanticProposalIds).map((item) => Object.freeze({
          jobId: item.jobId,
          proposalId: item.proposalId,
          status: item.status,
          recommendation: item.recommendation,
          updatedAt: item.updatedAt,
        }));
    const probabilityJobs = semanticProposalIds.length === 0
      ? Object.freeze([])
      : probabilityJobsForProposalIds(semanticProposalIds).map((item) => Object.freeze({
          jobId: item.jobId,
          proposalId: item.proposalId,
          status: item.status,
          updatedAt: item.updatedAt,
        }));
    const opportunities = semanticProposalIds.length === 0
      ? Object.freeze([])
      : opportunityLifecycleDesk.projection().cases.filter((item) =>
          semanticOpportunityIds.has(item.opportunityId)
        ).map((item) => Object.freeze({
          opportunityId: item.opportunityId,
          state: item.state,
          updatedAt: item.events.map((event) => event.occurredAt).sort().at(-1) ??
            "1970-01-01T00:00:00.000Z",
        }));
    return buildOntologyAllocationOutcomeProjection({
      execution,
      ontologyProposals,
      relationWork,
      relationTaskRevisions,
      relationFindings,
      relationCompilations,
      semanticReviews,
      probabilityJobs,
      opportunities,
    });
  };
  const relationDiscoveryCampaignPreview = async () => {
    const snapshot = agentExecutionRegistry.snapshot();
    const route = [...snapshot.workloadRoutes]
      .filter((item) => item.taskKind === "RELATION_DISCOVERY")
      .sort((left, right) =>
        right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
      )[0];
    if (route === undefined) {
      throw new Error("Relation discovery workload route is unavailable");
    }
    const profile = snapshot.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    );
    if (profile === undefined) {
      throw new Error("Relation discovery execution profile is unavailable");
    }
    const binding = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (binding === undefined) {
      throw new Error("Relation discovery credential binding is unavailable");
    }
    const configuration = await agentCredentialBroker.configuration(binding);
    return buildRelationDiscoveryCampaignPreview({
      revisions: relationDiscoveryTaskRevisions,
      execution: snapshot,
      capability: agentExecutionCapabilityService.project(profile, configuration),
    });
  };
  const standingRouteSeedCampaignPreview = async () => {
    const snapshot = agentExecutionRegistry.snapshot();
    const route = [...snapshot.workloadRoutes]
      .filter((item) => item.taskKind === "RELATION_DISCOVERY")
      .sort((left, right) =>
        right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
      )[0];
    if (route === undefined) {
      throw new Error("Standing route seed workload route is unavailable");
    }
    const profile = snapshot.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    );
    if (profile === undefined) {
      throw new Error("Standing route seed execution profile is unavailable");
    }
    const binding = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (binding === undefined) {
      throw new Error("Standing route seed credential binding is unavailable");
    }
    const configuration = await agentCredentialBroker.configuration(binding);
    const corpus = catalogObservationDesk.corpus();
    return buildStandingRouteSeedCampaignPreview({
      revisions: relationDiscoveryStore
        ?.loadRelationDiscoveryTaskRevisions(512) ?? relationDiscoveryTaskRevisions,
      corpus,
      standingRoutes: standingRouteProjection(corpus),
      execution: snapshot,
      capability: agentExecutionCapabilityService.project(profile, configuration),
    });
  };
  const discoveryExecutionCapability = async () => {
    const snapshot = agentExecutionRegistry.snapshot();
    const route = [...snapshot.workloadRoutes]
      .filter((item) => item.taskKind === "DISCOVERY_SCOUT")
      .sort((left, right) => right.revision - left.revision)[0];
    if (route === undefined) {
      throw new Error("Discovery execution workload route is unavailable");
    }
    const profile = snapshot.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    );
    if (profile === undefined) {
      throw new Error("Discovery execution profile is unavailable");
    }
    const runtime = snapshot.runtimeDefinitions.find((item) =>
      item.runtimeDefinitionId === profile.runtimeDefinitionId
    );
    const model = snapshot.modelProfiles.find((item) =>
      item.modelProfileId === profile.modelProfileId
    );
    const binding = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (runtime === undefined || model === undefined || binding === undefined) {
      throw new Error("Discovery execution substrate is incomplete");
    }
    const configuration = await agentCredentialBroker.configuration(binding);
    return Object.freeze({
      schemaVersion: "pmh.discovery-execution-capability.v1" as const,
      workloadRoute: route,
      executionProfile: profile,
      runtime: Object.freeze({
        runtimeDefinitionId: runtime.runtimeDefinitionId,
        kind: runtime.kind,
        version: runtime.version,
      }),
      model: Object.freeze({
        modelProfileId: model.modelProfileId,
        accessDriver: model.accessDriver,
        model: model.model,
        configuration: model.configuration,
      }),
      capability: agentExecutionCapabilityService.project(profile, configuration),
      providerRequestsStarted: 0 as const,
      modelInvocationsStarted: 0 as const,
      credentialSecretTextRetained: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
  };
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
    const semanticReviewProjection = semanticReviewDesk.projection();
    const baseReviewCandidates = baseSemanticReviewCandidates();
    const semanticReviewAdmission = buildSemanticReviewAdmissionProjection(
      baseReviewCandidates.map((candidate) => candidate.proposal),
    );
    const economicTriageProjection = buildProposalEconomicTriage({
      candidates: baseReviewCandidates,
      corpus: catalogObservationDesk.corpus(),
    });
    const enrichedReviewCandidates = semanticReviewCandidates(baseReviewCandidates);
    semanticReviewScheduler.reconcile(
      enrichedReviewCandidates,
      semanticReviewProjection.records,
    );
    const probabilityCaseRepairQueue = buildProbabilityCaseRepairQueue({
      runs: probabilityEstimationDesk.projection().records,
    });
    semanticReviewScheduler.reconcileProbabilityCaseRepairs(
      probabilityCaseRepairQueue,
      semanticReviewProjection.records,
      probabilityEstimationScheduler.projection().jobs,
    );
    const semanticReviewAttributionSource = semanticReviewScheduler.attributionSource();
    probabilityEstimationScheduler.reconcile(
      probabilityEstimationCandidates(semanticReviewAttributionSource),
      catalogObservationDesk.corpus(),
    );
    premiseAnalysisScheduler.reconcile(premiseAnalysisCandidates(enrichedReviewCandidates));
    premiseEvidenceRoutingScheduler.reconcile(
      premiseEvidenceRoutingCandidates(enrichedReviewCandidates),
    );
    premiseRouteExpansionScheduler.reconcile(premiseRouteExpansionCandidates());
    const retainedCurrentEvidenceRequirements = retainedEvidenceRequirements();
    const currentEvidenceRequirements = officialSourceDiscoveryScheduler.applyAdmissions(
      retainedCurrentEvidenceRequirements,
    );
    evidenceAcquisitionScheduler.reconcile(currentEvidenceRequirements);
    ruleEvidenceClaimScheduler.reconcile(ruleEvidenceClaimInputs());
    const semanticReviewSchedulerProjection = semanticReviewScheduler.projection();
    const probabilitySemanticRepairProgress = buildProbabilitySemanticRepairProgress({
      queue: probabilityCaseRepairQueue,
      jobs: semanticReviewSchedulerProjection.jobs,
      reviews: semanticReviewDesk.projection().records,
    });
    const premiseAnalysisProjection = premiseAnalysisDesk.projection();
    const premiseAnalysisSchedulerProjection = premiseAnalysisScheduler.projection();
    const premiseEvidenceRoutingProjection = premiseEvidenceRoutingScheduler.projection();
    const premiseRouteExpansionProjection = premiseRouteExpansionScheduler.projection();
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
    const evidenceDebtFrontier = buildEvidenceDebtFrontier({
      jobs: evidenceAcquisitionProjection.jobs,
      activeRequirementIds: currentEvidenceRequirements.map((requirement) =>
        requirement.requirementId
      ),
      economicItems: economicTriageProjection.items,
      reviewItems: reviewAttention.items,
    });
    const tierByProposal = new Map(evidenceDebtFrontier.items.map((item) =>
      [item.proposalId, item.tier] as const
    ));
    officialSourceDiscoveryScheduler.reconcile(
      retainedCurrentEvidenceRequirements.map((requirement) => Object.freeze({
        requirement,
        priorityTier: tierByProposal.get(requirement.proposalId) ??
          "RETAINED_RESEARCH_DEBT",
      })),
    );
    const probabilityEvidenceDebt = buildProbabilityEvidenceDebt({
      runs: probabilityEstimationDesk.projection().records,
      estimatorJobs: probabilityEstimationScheduler.projection().jobs,
      acquisitionJobs: evidenceAcquisitionProjection.jobs,
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
      agentExecution: agentExecutionRegistry.projection(),
      semanticReviewAdmission,
      semanticReviewScheduler: semanticReviewSchedulerProjection,
      premiseAnalysis: premiseAnalysisProjection,
      premiseAnalysisScheduler: premiseAnalysisSchedulerProjection,
      premiseEvidenceRouting: premiseEvidenceRoutingProjection,
      premiseRouteExpansion: premiseRouteExpansionProjection,
      officialSourceDiscovery: officialSourceDiscoveryScheduler.projection(),
      evidenceAcquisition: evidenceAcquisitionProjection,
      evidenceDebtFrontier,
      probabilityEvidenceDebt,
      probabilityCaseRepairQueue,
      probabilitySemanticRepairProgress,
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
  type LiveProjectionSnapshot = Readonly<{
    revision: bigint;
    projection: Awaited<ReturnType<typeof liveProjection>>;
    etag: string;
  }>;
  let projectionRevision = 0n;
  let liveProjectionCache: LiveProjectionSnapshot | null = null;
  let liveProjectionBuild: Readonly<{
    revision: bigint;
    promise: Promise<LiveProjectionSnapshot>;
  }> | null = null;
  const liveProjectionSnapshot = (): Promise<LiveProjectionSnapshot> => {
    const revision = projectionRevision;
    if (
      liveProjectionCache !== null &&
      liveProjectionCache.revision === revision
    ) return Promise.resolve(liveProjectionCache);
    // A newer invalidation may arrive while the bounded view is still being
    // materialized. Reuse that in-flight snapshot instead of launching a
    // second full derivation; the next request advances to the latest revision.
    if (liveProjectionBuild !== null) return liveProjectionBuild.promise;
    let pending: Promise<LiveProjectionSnapshot>;
    pending = ready.then(() => {
      if (startupReadiness.status === "STARTING") {
        transitionStartup("MATERIALIZING_PROJECTION");
      }
      return liveProjection();
    }).then((current) => {
      const snapshot = Object.freeze({
        revision,
        projection: current,
        etag: `"${current.identity.viewHash}"`,
      });
      if (projectionRevision === revision) liveProjectionCache = snapshot;
      if (startupReadiness.status === "STARTING") {
        transitionStartup("READY", "READY");
      }
      return snapshot;
    }).catch((error: unknown) => {
      if (startupReadiness.status === "STARTING") {
        transitionStartup(
          "FAILED",
          "FAILED",
          error instanceof Error ? error.message : "Studio projection materialization failed",
        );
      }
      throw error;
    }).finally(() => {
      if (liveProjectionBuild?.promise === pending) liveProjectionBuild = null;
    });
    liveProjectionBuild = Object.freeze({ revision, promise: pending });
    return pending;
  };
  const proposalHandoff = async (proposalIds: readonly Hash[]) => {
    await ready;
    const archaeologist = marketArchaeologistDesk.projection();
    const reviewJobs = semanticReviewScheduler.attributionSource().jobs;
    const semanticReviews = semanticReviewDesk.projection();
    const lifecycle = opportunityLifecycleDesk.projection();
    const corpus = catalogObservationDesk.corpus();
    const reviewAttention = buildReviewAttentionProjection({
      archaeologist,
      semanticReviews: semanticReviews.records,
      semanticReviewJobs: reviewJobs,
      semanticDecisions: lifecycle.semanticDecisions,
      corpus,
    });
    const economicTriage = buildProposalEconomicTriage({
      candidates: baseSemanticReviewCandidates(),
      corpus,
    });
    const premiseJobsProjection = premiseAnalysisScheduler.projection();
    const proposals = new Map(
      archaeologist.records.flatMap((record) =>
        (record.report?.result.proposals ?? []).map((proposal) =>
          [proposal.proposalId, proposal] as const
        )
      ),
    );
    for (const job of reviewJobs) {
      const proposal = job.evidenceBundle?.schemaVersion ===
          "pmh.proposal-evidence-bundle.v2"
        ? job.evidenceBundle.proposal
        : null;
      if (proposal !== null && !proposals.has(proposal.proposalId)) {
        proposals.set(proposal.proposalId, proposal);
      }
    }
    const jobs = new Map(
      reviewJobs.map((job) => [job.proposalId, job] as const),
    );
    const jobsById = new Map(
      reviewJobs.map((job) => [job.jobId, job] as const),
    );
    const cases = new Map(
      lifecycle.cases.map((item) => [item.opportunityId, item] as const),
    );
    const attention = new Map(
      reviewAttention.items.map((item) => [item.proposalId, item] as const),
    );
    const economics = new Map(
      economicTriage.items.map((item) => [item.proposalId, item] as const),
    );
    const premiseJobs = new Map(
      premiseJobsProjection.jobs.map((item) => [item.proposalId, item] as const),
    );
    const items = Object.freeze(proposalIds.map((proposalId) => {
      const proposal = proposals.get(proposalId) ?? null;
      const job = jobs.get(proposalId) ?? null;
      const lifecycleCase = cases.get(`ai:${proposalId}`) ?? null;
      const operatorAttention = attention.get(proposalId) ?? null;
      const economicTriage = economics.get(proposalId) ?? null;
      const reviewOutcome = resolveProposalReviewOutcome(job, jobsById);
      const premiseJob = premiseJobs.get(proposalId) ?? null;
      const premiseOutcome = resolveProposalPremiseOutcome(premiseJob);
      const premiseAuditRequired = proposal === null ||
        classifySemanticReviewAdmission(proposal).lane === "AUTO_PREMISE_REVIEW";
      const nextGate = deriveProposalDecisionNextGate({
        reviewJob: job,
        reviewOutcome,
        premiseAuditRequired,
        premiseJob,
        premiseOutcome,
        attention: operatorAttention,
        lifecycleCase,
        economics: economicTriage,
      });
      return Object.freeze({
        proposalId,
        proposal: proposal === null ? null : Object.freeze({
          proposalId: proposal.proposalId,
          relationKind: proposal.relationKind,
          statement: proposal.statement,
          listingRefs: Object.freeze([...proposal.listingRefs]),
        }),
        reviewJob: job === null ? null : Object.freeze({
          schemaVersion: job.schemaVersion,
          jobId: job.jobId,
          status: job.status,
          attemptCount: job.attemptCount,
          maxAttempts: job.maxAttempts,
          duplicateOfJobId: job.duplicateOfJobId ?? null,
          issueIds: Object.freeze([...job.issueIds]),
          completedAt: job.completedAt,
          recommendation: job.recommendation,
          lastFailure: job.lastFailure ?? null,
        }),
        reviewOutcome,
        premiseJob: premiseJob === null ? null : Object.freeze({
          schemaVersion: premiseJob.schemaVersion,
          jobId: premiseJob.jobId,
          status: premiseJob.status,
          attemptCount: premiseJob.attemptCount,
          maxAttempts: premiseJob.maxAttempts,
          completedAt: premiseJob.completedAt,
          diagnostic: premiseJob.diagnostic,
          admissionLane: premiseJob.admissionLane ?? null,
        }),
        premiseOutcome,
        economicTriage: economicTriage === null ? null : Object.freeze({
          itemId: economicTriage.itemId,
          status: economicTriage.status,
          diagnostic: economicTriage.diagnostic,
          currentContractMatchCount: economicTriage.currentContractMatchCount,
          settlementStatus: economicTriage.settlementPosture.status,
          indicativeEconomics: economicTriage.indicativeEconomics,
        }),
        lifecycleCase: lifecycleCase === null ? null : Object.freeze({
          opportunityId: lifecycleCase.opportunityId,
          state: lifecycleCase.state,
          nextAction: lifecycleCase.nextAction,
          discoveryArtifactHash: lifecycleCase.discoveryArtifactHash,
        }),
        attention: operatorAttention === null ? null : Object.freeze({
          itemId: operatorAttention.itemId,
          operatorPosture: operatorAttention.operatorPosture,
          nextAction: operatorAttention.nextAction,
          relationConclusion: operatorAttention.relationConclusion,
          missingEvidenceCount: operatorAttention.missingEvidenceCount,
          counterexampleCount: operatorAttention.counterexampleCount,
        }),
        nextGate,
      });
    }));
    const body = Object.freeze({
      schemaVersion: "pmh.proposal-handoff.v3" as const,
      sourceStateHash: hashCanonical({
        proposalIds,
        archaeologistRuns: archaeologist.records.map((record) => Object.freeze({
          runId: record.runId,
          status: record.status,
          artifactHash: record.report?.artifactHash ?? null,
        })),
        reviewJobs: reviewJobs.map((job) => Object.freeze({
          jobId: job.jobId,
          status: job.status,
          attemptCount: job.attemptCount,
          completedAt: job.completedAt,
          outcomeHash: job.reviewOutcome?.outcomeHash ?? null,
        })),
        semanticReviews: semanticReviews.records.map((record) => Object.freeze({
          reviewId: record.reviewId,
          status: record.status,
          completedAt: record.completedAt,
          artifactHash: record.report?.artifactHash ?? null,
        })),
        lifecycleCases: lifecycle.cases.map((item) => Object.freeze({
          opportunityId: item.opportunityId,
          state: item.state,
          nextAction: item.nextAction,
        })),
        reviewAttentionContentHash: reviewAttention.contentHash,
        economicTriageContentHash: economicTriage.contentHash,
        premiseJobs: premiseJobsProjection.jobs.map((job) => Object.freeze({
          jobId: job.jobId,
          status: job.status,
          attemptCount: job.attemptCount,
          completedAt: job.completedAt,
          outcomeHash: job.outcomeCapsule?.outcomeHash ?? null,
        })),
        corpusSnapshotIdentity: corpus.snapshotIdentity,
      }),
      requestedProposalIds: Object.freeze([...proposalIds]),
      resolvedProposalCount: items.filter((item) => item.proposal !== null).length,
      reviewJobCount: items.filter((item) => item.reviewJob !== null).length,
      reviewOutcomeCount: items.filter((item) => item.reviewOutcome.outcome !== null).length,
      premiseJobCount: items.filter((item) => item.premiseJob !== null).length,
      premiseOutcomeCount: items.filter((item) => item.premiseOutcome.outcome !== null).length,
      premiseObligationCount: items.reduce(
        (sum, item) => sum + (item.premiseOutcome.outcome?.premiseCount ?? 0),
        0,
      ),
      recoveryPendingCount: items.filter((item) =>
        item.reviewOutcome.basis === "RECOVERY_PENDING"
      ).length,
      legacyDetailUnavailableCount: items.filter((item) =>
        item.reviewOutcome.basis === "LEGACY_DETAIL_UNAVAILABLE"
      ).length,
      economicTriageCount: items.filter((item) => item.economicTriage !== null).length,
      lifecycleCaseCount: items.filter((item) => item.lifecycleCase !== null).length,
      operatorAttentionCount: items.filter((item) => item.attention !== null).length,
      items,
      authority: "READ_ONLY_WORKFLOW_HANDOFF" as const,
      semanticDecisionAuthority: false as const,
      simulationAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    return Object.freeze({ ...body, contentHash: hashCanonical(body) });
  };

  let invalidationFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const flushProjectionInvalidation = (): void => {
    invalidationFlushTimer = null;
    const payload = `event: projection-invalidated\ndata: ${JSON.stringify(
      buildStudioProjectionInvalidation({
        revision: projectionRevision,
        emittedAt: new Date().toISOString(),
        reason: "STATE_CHANGED",
      }),
    )}\n\n`;
    for (const subscriber of subscribers) {
      if (subscriber.destroyed) {
        subscribers.delete(subscriber);
      } else {
        subscriber.write(payload);
      }
    }
  };
  const broadcastProjection = async (): Promise<void> => {
    await ready;
    synchronizeLifecycleSources();
    projectionRevision += 1n;
    if (subscribers.size === 0 || invalidationFlushTimer !== null) return;
    invalidationFlushTimer = setTimeout(flushProjectionInvalidation, 25);
    invalidationFlushTimer.unref();
  };
  const reconcileAfterAgentTaskCompletion = async (taskId: Hash): Promise<void> => {
    const task = agentExecutionRegistry.snapshot().tasks.find((item) => item.taskId === taskId);
    if (task?.kind === "RELATION_DISCOVERY") {
      try {
        reconcileRelationDiscoveryTasks();
      } catch {
        // Startup or the next catalog refresh retries durable route reconciliation.
      }
    }
    await broadcastProjection();
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

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://control-plane.local");
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...localStudioCorsHeaders(request),
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/readiness") {
      const readiness = startupReadinessProjection();
      writeJson(
        response,
        readiness.status === "READY" ? 200 : readiness.status === "FAILED" ? 503 : 202,
        readiness,
        { "cache-control": "no-store" },
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/discovery-execution-capability"
    ) {
      try {
        await ready;
        writeJson(
          response,
          200,
          await discoveryExecutionCapability(),
          { "cache-control": "no-store" },
        );
      } catch (error) {
        writeJson(response, 503, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "Discovery execution capability is unavailable",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
          credentialSecretTextRetained: false,
          externalWriteAuthority: false,
          valueMovingAuthority: false,
        });
      }
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
        agentExecution: agentExecutionRegistry.projection(),
        premiseAnalysis: premiseAnalysisDesk.projection(),
        premiseAnalysisScheduler: premiseAnalysisScheduler.projection(),
        premiseEvidenceRouting: premiseEvidenceRoutingScheduler.projection(),
        premiseRouteExpansion: premiseRouteExpansionScheduler.projection(),
        officialSourceDiscovery: officialSourceDiscoveryScheduler.projection(),
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
        const snapshot = await liveProjectionSnapshot();
        const headers = Object.freeze({
          "access-control-expose-headers": "etag, x-pmh-projection-revision",
          "cache-control": "no-cache, private",
          etag: snapshot.etag,
          "x-pmh-projection-revision": snapshot.revision.toString(),
        });
        if (requestAcceptsEtag(request, snapshot.etag)) {
          response.writeHead(304, {
            ...localStudioCorsHeaders(request),
            ...headers,
          });
          response.end();
        } else {
          writeJson(response, 200, snapshot.projection, headers);
        }
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
    if (request.method === "GET" && url.pathname === "/api/v1/proposal-handoff") {
      const rawIds = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
      const proposalIds = [...new Set(rawIds)];
      if (
        proposalIds.length === 0 || proposalIds.length > 5 ||
        proposalIds.some((item) => !/^sha256:[0-9a-f]{64}$/u.test(item))
      ) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: "ids must contain one to five unique sha256 proposal IDs",
          semanticDecisionAuthority: false,
          executionAuthority: false,
        });
        return;
      }
      const startedAt = performance.now();
      const handoff = await proposalHandoff(proposalIds as Hash[]);
      const elapsedMs = Math.max(0, performance.now() - startedAt);
      writeJson(response, 200, handoff, {
        "server-timing": `proposal-handoff;dur=${elapsedMs.toFixed(1)}`,
      });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/ai-runtime/configuration"
    ) {
      try {
        const update = parseAiRuntimeConfigurationUpdate(await readJson(request));
        const configuration = aiRuntimeConfigurationDesk.update(update);
        agentExecutionRegistry.importLegacyConfiguration(configuration);
        agentExecutionRegistry.saveBatch(buildDefaultAgentRuntimePortfolio(configuration));
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
          agentExecution: agentExecutionRegistry.projection(),
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
      url.pathname === "/api/v1/market-ontology/relation-work"
    ) {
      await ready;
      const proposals = marketOntologyAgentProposalStore
        ?.loadMarketOntologyAgentProposals(200) ?? [];
      const revisions = ontologySearchIssueRevisionStore
        ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
      writeJson(response, 200, relationWorkWithStandingRoutes({
        proposals,
        ontologyRevisions: revisions,
        execution: agentExecutionRegistry.snapshot(),
      }));
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/standing-routes"
    ) {
      await ready;
      const findings = relationDiscoveryStore
        ?.loadStandingOntologyRouteSourceFindings() ?? [];
      const taskRevisions = relationDiscoveryStore
        ?.loadRelationDiscoveryTaskRevisionsForTaskIds(
          findings.map((item) => item.sourceTaskId),
        ) ?? relationDiscoveryTaskRevisions;
      const projection = buildStandingOntologyRouteProjection({
        findings,
        taskRevisions,
        loadCorpus: (snapshotIdentity) => relationDiscoveryStore
          ?.loadRelationDiscoveryCorpus(snapshotIdentity) ?? null,
        currentCorpus: catalogObservationDesk.corpus(),
      });
      const followups = materializeStandingOntologyRouteFollowups({
        projection,
        ontology: buildMarketOntologySnapshot(catalogObservationDesk.corpus()),
      });
      const episodes = standingRouteEpisodeStore
        ?.loadStandingOntologyRouteObservationEpisodes(
          projection.families.map((item) => item.family.routeFamilyId),
        ) ?? Object.freeze([]);
      const execution = agentExecutionRegistry.snapshot();
      const findingsForValue = relationDiscoveryStore
        ?.loadRelationDiscoveryFindings(512) ?? [];
      const compilations = relationDiscoveryProposalCompilations();
      const proposalIds = compilations.map((item) => item.proposal.proposalId);
      const semanticReviews = proposalIds.length === 0
        ? Object.freeze([])
        : semanticReviewJobsForProposalIds(proposalIds).map((item) => Object.freeze({
            jobId: item.jobId,
            proposalId: item.proposalId,
            status: item.status,
          }));
      const probabilityJobs = proposalIds.length === 0
        ? Object.freeze([])
        : probabilityJobsForProposalIds(proposalIds).map((item) => Object.freeze({
            jobId: item.jobId,
            proposalId: item.proposalId,
          }));
      const proposalOpportunityIds = new Set(proposalIds.map((item) => `ai:${item}`));
      const opportunities = opportunityLifecycleDesk.projection().cases.filter((item) =>
        proposalOpportunityIds.has(item.opportunityId)
      ).map((item) => Object.freeze({ opportunityId: item.opportunityId }));
      const observedAt = new Date().toISOString();
      const value = buildStandingOntologyRouteValueProjection({
        projection,
        followups,
        episodes,
        execution,
        taskRevisions: relationDiscoveryStore
          ?.loadRelationDiscoveryTaskRevisions(512) ?? relationDiscoveryTaskRevisions,
        findings: findingsForValue,
        compilations,
        semanticReviews,
        probabilityJobs,
        opportunities,
        observedAt,
      });
      writeJson(response, 200, Object.freeze({
        ...projection,
        followupCount: followups.length,
        followups,
        observationEpisodeCount: episodes.length,
        observationEpisodes: episodes,
        value,
      }));
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/standing-routes/seed-outcomes"
    ) {
      await ready;
      const corpus = catalogObservationDesk.corpus();
      writeJson(response, 200, buildStandingRouteSeedOutcomeProjection({
        execution: agentExecutionRegistry.snapshot(),
        taskRevisions: relationDiscoveryStore
          ?.loadRelationDiscoveryTaskRevisions(512) ?? relationDiscoveryTaskRevisions,
        findings: relationDiscoveryStore?.loadRelationDiscoveryFindings(512) ?? [],
        standingRoutes: standingRouteProjection(corpus),
        observedAt: new Date().toISOString(),
      }));
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/relation-discovery"
    ) {
      await ready;
      const proposals = marketOntologyAgentProposalStore
        ?.loadMarketOntologyAgentProposals(200) ?? [];
      const ontologyRevisions = ontologySearchIssueRevisionStore
        ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
      const relationWork = relationWorkWithStandingRoutes({
        proposals,
        ontologyRevisions,
        execution: agentExecutionRegistry.snapshot(),
      });
      const taskRevisions = relationDiscoveryStore
        ?.loadRelationDiscoveryTaskRevisions(512) ?? relationDiscoveryTaskRevisions;
      const findings = relationDiscoveryStore?.loadRelationDiscoveryFindings(512) ?? [];
      const proposalCompilations = relationDiscoveryProposalCompilations();
      const reviewableCompilations =
        selectRelationDiscoverySemanticReviewCompilations(proposalCompilations);
      const routingOnlyCompilations = proposalCompilations.filter((item) =>
        relationDiscoveryReviewLane(item.proposal.relationKind) ===
          "ONTOLOGY_ROUTING_ONLY"
      );
      const proposalIds = Object.freeze([...new Set(proposalCompilations.map((item) =>
        item.proposal.proposalId
      ))].sort());
      const semanticReviewJobsByProposal = new Map<Hash, SemanticReviewJobRecord>();
      for (const job of semanticReviewJobsForProposalIds(proposalIds)) {
        const prior = semanticReviewJobsByProposal.get(job.proposalId);
        if (prior === undefined || job.updatedAt > prior.updatedAt ||
            (job.updatedAt === prior.updatedAt && job.jobId > prior.jobId)) {
          semanticReviewJobsByProposal.set(job.proposalId, job);
        }
      }
      const probabilityJobsByProposal = new Map<Hash, ProbabilityEstimationJobRecord[]>();
      for (const job of probabilityJobsForProposalIds(proposalIds)) {
        const retained = probabilityJobsByProposal.get(job.proposalId) ?? [];
        retained.push(job);
        probabilityJobsByProposal.set(job.proposalId, retained);
      }
      const execution = agentExecutionRegistry.snapshot();
      const latestByWork = new Map<Hash, RelationDiscoveryTaskRevision>();
      for (const revision of taskRevisions) {
        const prior = latestByWork.get(revision.workItemId);
        if (prior === undefined || revision.materializedAt > prior.materializedAt ||
            (revision.materializedAt === prior.materializedAt &&
              revision.revisionId > prior.revisionId)) {
          latestByWork.set(revision.workItemId, revision);
        }
      }
      const taskIds = new Set(taskRevisions.map((item) => item.task.taskId));
      const runs = execution.runs.filter((item) => taskIds.has(item.taskId));
      const runIds = new Set(runs.map((item) => item.runId));
      const invocations = execution.modelInvocations.filter((item) => runIds.has(item.runId));
      const sumUsage = (field: "inputTokens" | "outputTokens" | "reasoningTokens") =>
        invocations.reduce((sum, item) => sum + BigInt(item[field] ?? "0"), 0n).toString();
      const body = Object.freeze({
        schemaVersion: "pmh.relation-discovery-projection.v1" as const,
        projectionIdentity: "" as Hash,
        sourceWorkItemCount: relationWork.workItemCount,
        currentTaskRevisionCount: latestByWork.size,
        retainedTaskRevisionCount: taskRevisions.length,
        runCount: runs.length,
        modelInvocationCount: invocations.length,
        findingCount: findings.length,
        findingBearingRunCount: new Set(findings.map((item) => item.sourceAgentRunId)).size,
        succeededRunCount: runs.filter((item) => item.status === "SUCCEEDED").length,
        interruptedRunCount: runs.filter((item) => item.status === "INTERRUPTED").length,
        failedRunCount: runs.filter((item) => item.status === "FAILED").length,
        productiveInterruptedRunCount: new Set(findings.filter((finding) =>
          runs.some((run) => run.runId === finding.sourceAgentRunId &&
            run.status === "INTERRUPTED")
        ).map((item) => item.sourceAgentRunId)).size,
        positiveFindingCount: findings.filter((item) =>
          item.kind === "RELATION_HYPOTHESIS"
        ).length,
        ontologyRouteObservationCount: findings.filter((item) =>
          item.kind === "ONTOLOGY_ROUTE"
        ).length,
        counterexampleCount: findings.filter((item) => item.kind === "COUNTEREXAMPLE").length,
        semanticReviewCandidateCount: reviewableCompilations.length,
        semanticReviewConnectedCount: reviewableCompilations.filter((item) =>
          semanticReviewJobsByProposal.has(item.proposal.proposalId)
        ).length,
        ontologyRoutingOnlyFindingCount: routingOnlyCompilations.length,
        historicalRoutingReviewCount: routingOnlyCompilations.filter((item) =>
          semanticReviewJobsByProposal.has(item.proposal.proposalId)
        ).length,
        usage: Object.freeze({
          inputTokens: sumUsage("inputTokens"),
          outputTokens: sumUsage("outputTokens"),
          reasoningTokens: sumUsage("reasoningTokens"),
          unknownInputInvocationCount: invocations.filter((item) => item.inputTokens === null).length,
          unknownOutputInvocationCount: invocations.filter((item) => item.outputTokens === null).length,
          unknownReasoningInvocationCount: invocations.filter((item) =>
            item.reasoningTokens === null
          ).length,
        }),
        items: Object.freeze(relationWork.items.map((workItem) => {
          const revision = latestByWork.get(workItem.workItemId) ?? null;
          const workFindings = findings.filter((item) => item.workItemId === workItem.workItemId);
          const workTaskIds = new Set(taskRevisions.filter((item) =>
            item.workItemId === workItem.workItemId
          ).map((item) => item.task.taskId));
          const workCompilations = proposalCompilations.filter((item) =>
            item.origin.workItemId === workItem.workItemId
          );
          const reviewableWorkCompilations =
            selectRelationDiscoverySemanticReviewCompilations(workCompilations);
          const semanticReviews = Object.freeze(workCompilations.map((item) => {
            const job = semanticReviewJobsByProposal.get(item.proposal.proposalId) ?? null;
            return Object.freeze({
              compilationId: item.compilationId,
              reviewLane: relationDiscoveryReviewLane(item.proposal.relationKind),
              origin: item.origin,
              proposal: item.proposal,
              evidenceBundleId: item.evidenceBundle.bundleId,
              semanticReviewJobId: job?.jobId ?? null,
              semanticReviewStatus: job?.status ?? null,
              semanticReviewRecommendation: job?.recommendation ?? null,
              semanticConstraintClassification:
                job?.reviewOutcome?.semanticConstraint?.classification ?? null,
              semanticConstraintArtifactHash:
                job?.reviewOutcome?.semanticConstraint?.artifactHash ?? null,
              probabilityJobIds: Object.freeze(
                (probabilityJobsByProposal.get(item.proposal.proposalId) ?? [])
                  .map((probabilityJob) => probabilityJob.jobId).sort(),
              ),
            });
          }));
          const probabilityAdmittedReviews = semanticReviews.filter((item) =>
            item.reviewLane === "SEMANTIC_PAYOFF_REVIEW" &&
            item.semanticReviewStatus === "PASS" &&
            item.semanticConstraintClassification === "PROBABILISTIC_DEPENDENCE"
          );
          return Object.freeze({
            workItem,
            currentTaskRevision: revision,
            retainedTaskRevisionCount: workTaskIds.size,
            runCount: runs.filter((item) => workTaskIds.has(item.taskId)).length,
            findings: Object.freeze(workFindings),
            positiveFindingCount: workFindings.filter((item) =>
              item.kind === "RELATION_HYPOTHESIS"
            ).length,
            ontologyRouteObservationCount: workFindings.filter((item) =>
              item.kind === "ONTOLOGY_ROUTE"
            ).length,
            counterexampleCount: workFindings.filter((item) =>
              item.kind === "COUNTEREXAMPLE"
            ).length,
            ontologyRoutingOnlyFindingCount: workCompilations.length -
              reviewableWorkCompilations.length,
            semanticReviewCandidateCount: reviewableWorkCompilations.length,
            semanticReviews,
            downstreamSemanticReviewAttribution: workCompilations.length === 0
              ? "NO_POSITIVE_FINDING" as const
              : reviewableWorkCompilations.length === 0
                ? "ONTOLOGY_ROUTING_ONLY" as const
                : semanticReviews.some((item) =>
                    item.reviewLane === "SEMANTIC_PAYOFF_REVIEW" &&
                    item.semanticReviewJobId !== null
                  )
                ? "CONNECTED" as const
                : "CANDIDATE_READY" as const,
            downstreamProbabilityAttribution: workCompilations.length === 0
              ? "NO_POSITIVE_FINDING" as const
              : reviewableWorkCompilations.length === 0
                ? "NOT_APPLICABLE_ROUTING_ONLY" as const
                : semanticReviews.filter((item) =>
                    item.reviewLane === "SEMANTIC_PAYOFF_REVIEW"
                  ).every((item) => item.semanticReviewStatus !== "PASS")
                ? "AWAITING_SEMANTIC_REVIEW" as const
                : probabilityAdmittedReviews.length === 0
                  ? "SEMANTICALLY_NOT_ADMITTED" as const
                  : probabilityAdmittedReviews.some((item) =>
                    item.probabilityJobIds.length > 0
                  )
                    ? "CONNECTED" as const
                    : "CANDIDATE_READY" as const,
            downstreamOpportunityAttribution: "NOT_YET_CONNECTED" as const,
          });
        })),
        automaticDispatch: false as const,
        providerRequestsStartedByRead: 0 as const,
        modelInvocationsStartedByRead: 0 as const,
        authority: "RELATION_FINDING_PROPOSAL_ONLY" as const,
        semanticDecisionAuthority: false as const,
        probabilityAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        externalWriteAuthority: false as const,
        valueMovingAuthority: false as const,
      });
      const { projectionIdentity: _placeholder, ...identityBody } = body;
      writeJson(response, 200, Object.freeze({
        ...body,
        projectionIdentity: hashCanonical(identityBody),
      }));
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/research-attention-allocation"
    ) {
      await ready;
      writeJson(response, 200, currentResearchActionState().allocation);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/research-action-targets"
    ) {
      await ready;
      writeJson(response, 200, currentResearchActionState().targets);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/research-decision-outcomes"
    ) {
      await ready;
      const current = currentResearchActionState();
      writeJson(response, 200, buildResearchDecisionOutcomeProjection({
        observedAt: current.allocation.observedAt,
        episodes: loadResearchDecisionEpisodes(),
        allocation: current.allocation,
        targets: current.targets,
      }));
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/research-decisions"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).sort().join("|") !==
              "allocationActionId|allocationProjectionIdentity|captureRef|targetId") {
          throw new Error("research decision capture request is malformed");
        }
        const requestBody = body as Record<string, unknown>;
        const current = currentResearchActionState();
        if (requestBody.allocationProjectionIdentity !== current.allocation.projectionIdentity ||
            typeof requestBody.allocationActionId !== "string" ||
            typeof requestBody.targetId !== "string" ||
            typeof requestBody.captureRef !== "string") {
          throw new Error("research decision allocation is stale or malformed");
        }
        const episodeId = researchDecisionEpisodeId({
          allocationProjectionIdentity: current.allocation.projectionIdentity,
          allocationActionId: requestBody.allocationActionId as Hash,
          targetId: requestBody.targetId as Hash,
          captureRef: requestBody.captureRef,
        });
        const existing = researchDecisionStore?.loadResearchDecisionEpisode(episodeId) ??
          inMemoryResearchDecisionEpisodes.find((item) => item.episodeId === episodeId) ?? null;
        if (existing !== null) {
          writeJson(response, 200, Object.freeze({
            ok: true,
            idempotentReplay: true,
            episode: existing,
            localResearchLedgerWrites: 0,
            providerRequestsStarted: 0,
            modelInvocationsStarted: 0,
            fetchesStarted: 0,
            campaignsCreated: 0,
            runsCreated: 0,
            schedulerDispatchesStarted: 0,
          }));
          return;
        }
        const episode = saveResearchDecisionEpisode(buildResearchDecisionEpisode({
          allocation: current.allocation,
          targets: current.targets,
          allocationActionId: requestBody.allocationActionId as Hash,
          targetId: requestBody.targetId as Hash,
          capturedAt: new Date().toISOString(),
          captureRef: requestBody.captureRef,
        }));
        writeJson(response, 201, Object.freeze({
          ok: true,
          idempotentReplay: false,
          episode,
          localResearchLedgerWrites: 1,
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
          fetchesStarted: 0,
          campaignsCreated: 0,
          runsCreated: 0,
          schedulerDispatchesStarted: 0,
        }));
      } catch (error) {
        writeJson(response, 409, Object.freeze({
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "research decision could not be captured",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
          fetchesStarted: 0,
          campaignsCreated: 0,
          runsCreated: 0,
          schedulerDispatchesStarted: 0,
        }));
      }
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/allocation-outcomes"
    ) {
      await ready;
      writeJson(response, 200, ontologyAllocationOutcomes());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/search-ecology"
    ) {
      await ready;
      const proposals = marketOntologyAgentProposalStore
        ?.loadMarketOntologyAgentProposals(200) ?? [];
      const retainedRevisions = ontologySearchIssueRevisionStore
        ?.loadOntologySearchIssueRevisions(512) ?? ontologySearchIssueRevisions;
      const relationWork = buildOntologyRelationWorkProjection({
        proposals,
        revisions: retainedRevisions,
        execution: agentExecutionRegistry.snapshot(),
      });
      const yieldProjection = buildOntologySearchYieldProjection({
        revisions: ontologySearchIssueRevisions,
        proposals,
        execution: agentExecutionRegistry.snapshot(),
        relationWork,
      });
      const attention = buildOntologyAttentionAllocation({
        currentRevisions: ontologySearchIssueRevisions,
        retainedRevisions,
        proposals,
        execution: agentExecutionRegistry.snapshot(),
        relationWork,
      });
      const latestByIssue = new Map<Hash, OntologySearchIssueRevision>();
      for (const revision of ontologySearchIssueRevisions) {
        const current = latestByIssue.get(revision.issueId);
        if (current === undefined || revision.materializedAt > current.materializedAt ||
            (revision.materializedAt === current.materializedAt &&
              revision.revisionId > current.revisionId)) {
          latestByIssue.set(revision.issueId, revision);
        }
      }
      const issues = Object.freeze([...latestByIssue.values()]
        .sort((left, right) =>
          right.priority - left.priority || left.issueId.localeCompare(right.issueId)
        )
        .map((revision) => Object.freeze({
          issueId: revision.issueId,
          revisionId: revision.revisionId,
          relationPatternId: revision.relationPatternId,
          selectionLane: revision.selectionLane,
          coverageState: revision.coverageState,
          priority: revision.priority,
          campaignEligible: revision.campaignEligible,
          automaticDispatch: revision.automaticDispatch,
          taskId: revision.task.taskId,
          trailheadIds: revision.trailheadIds,
          representativePairs: revision.taskPayload.trailheads.slice(0, 3).map((item) =>
            Object.freeze({
              trailheadId: item.trailheadId,
              listingRefs: item.listingRefs,
              listingTitleExcerpts: item.listingTitleExcerpts,
              changedFacets: item.changedFacets,
            })
          ),
        })));
      writeJson(response, 200, Object.freeze({
        schemaVersion: "pmh.ontology-search-ecology.v2",
        yield: yieldProjection,
        attention,
        issues,
        storage: ontologySearchIssueRevisionStore?.ontologySearchIssueRevisionStorage ??
          Object.freeze({
            mode: "MEMORY" as const,
            durable: false,
            schemaVersion: 43,
            idempotencyKey: "revisionId" as const,
          }),
        automaticDispatch: false,
        providerRequestsStarted: 0,
        modelInvocationsStarted: 0,
        authority: "SEARCH_WORK_ASSIGNMENT_ONLY",
        semanticDecisionAuthority: false,
        probabilityAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      }));
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/premise-evidence-routing"
    ) {
      await ready;
      premiseAnalysisScheduler.reconcile(premiseAnalysisCandidates());
      premiseEvidenceRoutingScheduler.reconcile(premiseEvidenceRoutingCandidates());
      writeJson(response, 200, premiseEvidenceRoutingScheduler.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/premise-route-expansion"
    ) {
      await ready;
      premiseEvidenceRoutingScheduler.reconcile(premiseEvidenceRoutingCandidates());
      premiseRouteExpansionScheduler.reconcile(premiseRouteExpansionCandidates());
      writeJson(response, 200, premiseRouteExpansionScheduler.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/official-source-discovery"
    ) {
      await ready;
      officialSourceDiscoveryScheduler.reconcile(
        retainedEvidenceRequirements().map((requirement) => Object.freeze({
          requirement,
          priorityTier: "RETAINED_RESEARCH_DEBT" as const,
        })),
      );
      writeJson(response, 200, officialSourceDiscoveryScheduler.projection());
      return;
    }
    const officialSourceRunMatch = url.pathname.match(
      /^\/api\/v1\/official-source-discovery\/(sha256:[0-9a-f]{64})\/run$/u,
    );
    if (request.method === "POST" && officialSourceRunMatch !== null) {
      try {
        await ready;
        officialSourceDiscoveryScheduler.reconcile(
          retainedEvidenceRequirements().map((requirement) => Object.freeze({
            requirement,
            priorityTier: "RETAINED_RESEARCH_DEBT" as const,
          })),
        );
        const run = officialSourceDiscoveryScheduler.runJob(
          officialSourceRunMatch[1] as Hash,
        );
        void broadcastProjection();
        void run.then(() => {
          evidenceAcquisitionScheduler.reconcile(evidenceRequirements());
          return broadcastProjection();
        }, () => broadcastProjection());
        writeJson(response, 202, {
          ok: true,
          jobId: officialSourceRunMatch[1],
          status: "LEASED",
          executionAuthority: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "official source discovery run could not start",
          executionAuthority: false,
        });
      }
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
    const evidenceAcquisitionRunMatch = url.pathname.match(
      /^\/api\/v1\/evidence-acquisition\/(sha256:[0-9a-f]{64})\/run$/u,
    );
    if (request.method === "POST" && evidenceAcquisitionRunMatch !== null) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).length !== 0
        ) throw new Error("evidence acquisition run accepts only an empty object");
        const pending = evidenceAcquisitionScheduler.runJob(
          evidenceAcquisitionRunMatch[1] as Hash,
          evidenceRequirements(),
        );
        await broadcastProjection();
        const job = await pending;
        ruleEvidenceClaimScheduler.reconcile(ruleEvidenceClaimInputs());
        reconcileRuleEvidenceAgentTasks();
        await broadcastProjection();
        writeJson(response, job.status === "CAPTURED" ? 200 : 422, job);
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "evidence acquisition run could not start",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/evidence-debt-frontier"
    ) {
      writeJson(response, 200, (await projection()).ai.evidenceDebtFrontier);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/probability-evidence-debt"
    ) {
      writeJson(response, 200, (await projection()).ai.probabilityEvidenceDebt);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/probability-case-repairs"
    ) {
      writeJson(response, 200, (await projection()).ai.probabilityCaseRepairQueue);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/probability-semantic-repair-progress"
    ) {
      writeJson(response, 200, (await projection()).ai.probabilitySemanticRepairProgress);
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
    if (request.method === "GET" && url.pathname === "/api/v1/agent-execution") {
      writeJson(response, 200, await agentExecutionConsole());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/campaign-preview"
    ) {
      try {
        await ready;
        writeJson(response, 200, await ontologyAgentCampaignPreview());
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "ontology campaign preview is unavailable",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      }
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/relation-discovery/campaign-preview"
    ) {
      try {
        await ready;
        writeJson(response, 200, await relationDiscoveryCampaignPreview());
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "relation discovery campaign preview is unavailable",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      }
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/standing-routes/seed-campaign-preview"
    ) {
      try {
        await ready;
        writeJson(response, 200, await standingRouteSeedCampaignPreview());
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "standing route seed campaign preview is unavailable",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/market-ontology/standing-routes/seed-campaigns"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).length !== 0) {
          throw new Error("standing route seed campaign creation accepts an empty object only");
        }
        const preview = await standingRouteSeedCampaignPreview();
        if (!preview.creationEligible) throw new Error(preview.diagnostic);
        agentExecutionRegistry.saveBatch({
          tasks: preview.taskRevisions.map((revision) => revision.task),
        });
        relationDiscoveryStore?.saveRelationDiscoveryTaskRevisions(preview.taskRevisions);
        const latestRevision = agentExecutionRegistry.snapshot().campaigns
          .filter((item) => item.campaignKey === preview.campaignKey)
          .reduce((maximum, item) => Math.max(maximum, item.revision), 0);
        const campaign = buildPausedAgentCampaign({
          campaignKey: preview.campaignKey,
          revision: latestRevision + 1,
          executionProfileId: preview.executionProfile.executionProfileId,
          taskIds: preview.taskIds,
          schedule: preview.schedule,
          budget: preview.budget,
          selectionBinding: preview.selectionBinding,
          taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
          createdAt: new Date().toISOString(),
        });
        agentExecutionRegistry.saveBatch({ campaigns: [campaign] });
        await broadcastProjection();
        writeJson(response, 201, {
          ok: true,
          campaign,
          preview,
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "standing route seed campaign could not be created",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/relation-discovery/campaigns"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).length !== 0) {
          throw new Error("relation discovery campaign creation accepts an empty object only");
        }
        const preview = await relationDiscoveryCampaignPreview();
        if (!preview.creationEligible) throw new Error(preview.diagnostic);
        const latestRevision = agentExecutionRegistry.snapshot().campaigns
          .filter((item) => item.campaignKey === preview.campaignKey)
          .reduce((maximum, item) => Math.max(maximum, item.revision), 0);
        const campaign = buildPausedAgentCampaign({
          campaignKey: preview.campaignKey,
          revision: latestRevision + 1,
          executionProfileId: preview.executionProfile.executionProfileId,
          taskIds: preview.taskIds,
          schedule: preview.schedule,
          budget: preview.budget,
          selectionBinding: preview.selectionBinding,
          createdAt: new Date().toISOString(),
        });
        agentExecutionRegistry.saveBatch({ campaigns: [campaign] });
        await broadcastProjection();
        writeJson(response, 201, {
          ok: true,
          campaign,
          preview,
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "relation discovery campaign could not be created",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/market-ontology/campaigns"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).length !== 0) {
          throw new Error("ontology campaign creation accepts an empty object only");
        }
        const preview = await ontologyAgentCampaignPreview();
        if (!preview.creationEligible) throw new Error(preview.diagnostic);
        const latestRevision = agentExecutionRegistry.snapshot().campaigns
          .filter((item) => item.campaignKey === preview.campaignKey)
          .reduce((maximum, item) => Math.max(maximum, item.revision), 0);
        const campaign = buildPausedAgentCampaign({
          campaignKey: preview.campaignKey,
          revision: latestRevision + 1,
          executionProfileId: preview.executionProfile.executionProfileId,
          taskIds: preview.taskIds,
          schedule: preview.schedule,
          budget: preview.budget,
          selectionBinding: preview.selectionBinding,
          createdAt: new Date().toISOString(),
        });
        agentExecutionRegistry.saveBatch({ campaigns: [campaign] });
        await broadcastProjection();
        writeJson(response, 201, {
          ok: true,
          campaign,
          preview,
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message :
            "ontology campaign could not be created",
          providerRequestsStarted: 0,
          modelInvocationsStarted: 0,
        });
      }
      return;
    }
    const executionProfilePreflightMatch = url.pathname.match(
      /^\/api\/v1\/execution-profiles\/(sha256:[0-9a-f]{64})\/preflight$/u,
    );
    if (request.method === "POST" && executionProfilePreflightMatch !== null) {
      try {
        await ready;
        const profile = agentExecutionRegistry.snapshot().executionProfiles.find((item) =>
          item.executionProfileId === executionProfilePreflightMatch[1]
        );
        if (profile === undefined) throw new Error("Execution profile is unavailable");
        const capability = await agentExecutionCapabilityService.preflight(profile);
        await broadcastProjection();
        writeJson(response, 200, { ok: true, capability });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "capability preflight failed",
          inferenceRequestsStarted: 0,
          modelInvocationsStarted: 0,
          secretMaterialRetained: false,
        });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/agent-campaigns") {
      try {
        await ready;
        reconcileRuleEvidenceAgentTasks();
        const body = await readJson(request) as Record<string, unknown>;
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).sort().join("|") !==
              "budget|campaignKey|executionProfileId|schedule|taskIds") {
          throw new Error("paused campaign request is malformed");
        }
        const snapshot = agentExecutionRegistry.snapshot();
        const latestRevision = snapshot.campaigns
          .filter((item) => item.campaignKey === body.campaignKey)
          .reduce((maximum, item) => Math.max(maximum, item.revision), 0);
        const campaign = buildPausedAgentCampaign({
          campaignKey: body.campaignKey as string,
          revision: latestRevision + 1,
          executionProfileId: body.executionProfileId as Hash,
          taskIds: body.taskIds as readonly Hash[],
          schedule: body.schedule as Parameters<typeof buildPausedAgentCampaign>[0]["schedule"],
          budget: body.budget as Parameters<typeof buildPausedAgentCampaign>[0]["budget"],
          createdAt: new Date().toISOString(),
        });
        agentExecutionRegistry.saveBatch({ campaigns: [campaign] });
        await broadcastProjection();
        writeJson(response, 201, { ok: true, campaign, providerRequestsStarted: 0 });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "campaign could not be created",
          providerRequestsStarted: 0,
        });
      }
      return;
    }
    const campaignActivationMatch = url.pathname.match(
      /^\/api\/v1\/agent-campaigns\/(sha256:[0-9a-f]{64})\/activate$/u,
    );
    if (request.method === "POST" && campaignActivationMatch !== null) {
      try {
        await ready;
        const body = await readJson(request) as { activationRef?: unknown };
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).length !== 1 || typeof body.activationRef !== "string") {
          throw new Error("campaign activation requires exactly one activationRef");
        }
        const paused = effectiveAgentCampaigns(agentExecutionRegistry.snapshot().campaigns).find((item) =>
          item.campaignId === campaignActivationMatch[1]
        );
        if (paused === undefined) throw new Error("campaign is unavailable");
        const active = activateAgentCampaign(paused, body.activationRef, new Date().toISOString());
        agentExecutionRegistry.saveBatch({ campaigns: [active] });
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          campaign: active,
          preview: agentCampaignDispatcher.preview(active.campaignId),
          providerRequestsStarted: 0,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "campaign could not activate",
          providerRequestsStarted: 0,
        });
      }
      return;
    }
    const campaignDispatchMatch = url.pathname.match(
      /^\/api\/v1\/agent-campaigns\/(sha256:[0-9a-f]{64})\/dispatch$/u,
    );
    if (request.method === "POST" && campaignDispatchMatch !== null) {
      try {
        await ready;
        const dispatched = agentCampaignDispatcher.dispatchCampaign(
          campaignDispatchMatch[1] as Hash,
        );
        void broadcastProjection();
        for (const [index, completion] of dispatched.completions.entries()) {
          const taskId = dispatched.preparedRuns[index]?.taskId;
          if (taskId === undefined) continue;
          void completion.then(
            () => reconcileAfterAgentTaskCompletion(taskId),
            () => reconcileAfterAgentTaskCompletion(taskId),
          );
        }
        writeJson(response, 202, {
          ok: true,
          campaignId: dispatched.campaignId,
          preparedRunIds: dispatched.preparedRuns.map((run) => run.runId),
          preview: dispatched.preview,
          externalWriteAuthority: false,
          valueMovingAuthority: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "campaign dispatch failed",
          externalWriteAuthority: false,
          valueMovingAuthority: false,
        });
      }
      return;
    }
    const campaignPauseMatch = url.pathname.match(
      /^\/api\/v1\/agent-campaigns\/(sha256:[0-9a-f]{64})\/pause$/u,
    );
    if (request.method === "POST" && campaignPauseMatch !== null) {
      try {
        await ready;
        const active = effectiveAgentCampaigns(agentExecutionRegistry.snapshot().campaigns)
          .find((item) => item.campaignId === campaignPauseMatch[1]);
        if (active === undefined) throw new Error("campaign is unavailable or superseded");
        const paused = pauseAgentCampaign(active);
        agentExecutionRegistry.saveBatch({ campaigns: [paused] });
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          campaign: paused,
          providerRequestsStarted: 0,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "campaign could not pause",
          providerRequestsStarted: 0,
        });
      }
      return;
    }
    const manualAgentRunMatch = url.pathname.match(
      /^\/api\/v1\/agent-tasks\/(sha256:[0-9a-f]{64})\/runs$/u,
    );
    if (request.method === "POST" && manualAgentRunMatch !== null) {
      try {
        await ready;
        reconcileRuleEvidenceAgentTasks();
        const body = await readJson(request) as Record<string, unknown>;
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            !["PREVIEW", "EXECUTE"].includes(String(body.mode)) ||
            typeof body.executionProfileId !== "string" ||
            (body.mode === "EXECUTE" && typeof body.authorizationRef !== "string")) {
          throw new Error("manual Agent run request is malformed");
        }
        const preview = agentCampaignDispatcher.previewManual(
          manualAgentRunMatch[1] as Hash,
          body.executionProfileId as Hash,
        );
        if (body.mode === "PREVIEW") {
          writeJson(response, 200, { ok: true, preview });
        } else {
          const dispatched = agentCampaignDispatcher.dispatchManual(
            manualAgentRunMatch[1] as Hash,
            body.executionProfileId as Hash,
            body.authorizationRef as string,
          );
          void broadcastProjection();
          void dispatched.completion.then(
            () => reconcileAfterAgentTaskCompletion(dispatched.run.taskId),
            () => reconcileAfterAgentTaskCompletion(dispatched.run.taskId),
          );
          writeJson(response, 202, {
            ok: true,
            run: dispatched.run,
            preview,
            externalWriteAuthority: false,
            valueMovingAuthority: false,
          });
        }
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error ? error.message : "manual Agent run failed",
          externalWriteAuthority: false,
          valueMovingAuthority: false,
        });
      }
      return;
    }
    const ruleEvidenceClaimRunMatch = url.pathname.match(
      /^\/api\/v1\/rule-evidence-claims\/(sha256:[0-9a-f]{64})\/run$/u,
    );
    if (request.method === "POST" && ruleEvidenceClaimRunMatch !== null) {
      try {
        await ready;
        evidenceAcquisitionScheduler.reconcile(evidenceRequirements());
        const inputs = ruleEvidenceClaimInputs();
        agentExecutionRegistry.reconcileRuleEvidenceTasks(inputs);
        ruleEvidenceClaimScheduler.reconcile(inputs);
        if (aiRuntimeConfigurationDesk.current().provider !== ruleEvidenceClaimDesk.provider) {
          throw new Error(
            "rule evidence claim interpreter does not match the selected runtime provider",
          );
        }
        const run = ruleEvidenceClaimScheduler.runJob(
          ruleEvidenceClaimRunMatch[1] as Hash,
          inputs,
        );
        void broadcastProjection();
        void run.then(() => broadcastProjection(), () => broadcastProjection());
        writeJson(response, 202, {
          ok: true,
          jobId: ruleEvidenceClaimRunMatch[1],
          status: "LEASED",
          executionAuthority: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "rule evidence claim run could not start",
          executionAuthority: false,
        });
      }
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
    const probabilityCaseRetryMatch = url.pathname.match(
      /^\/api\/v1\/probability-estimation\/cases\/(sha256:[0-9a-f]{64})\/retries$/u,
    );
    if (request.method === "POST" && probabilityCaseRetryMatch !== null) {
      try {
        const jobs = probabilityEstimationScheduler.retryExhaustedCase(
          probabilityCaseRetryMatch[1] as Hash,
        );
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          caseIdentity: probabilityCaseRetryMatch[1],
          reopenedRoleCount: jobs.length,
          providerRequestStarted: false,
          semanticDecisionAuthority: false,
          executionAuthority: false,
        });
      } catch (error) {
        writeJson(response, 409, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "probability estimation case retry failed",
          providerRequestStarted: false,
          semanticDecisionAuthority: false,
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
    if (request.method === "GET" && url.pathname === "/api/v1/market-ontology") {
      await ready;
      writeJson(
        response,
        200,
        projectMarketOntology(buildMarketOntologySnapshot(catalogObservationDesk.corpus())),
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-ontology/agent-proposals"
    ) {
      const proposals = marketOntologyAgentProposalStore?.loadMarketOntologyAgentProposals(200) ?? [];
      writeJson(response, 200, Object.freeze({
        schemaVersion: "pmh.market-ontology-agent-proposal-ledger.v1",
        proposalCount: proposals.length,
        kindCounts: Object.freeze({
          entityAlias: proposals.filter((item) => item.kind === "ENTITY_ALIAS").length,
          worldProposition: proposals.filter((item) => item.kind === "WORLD_PROPOSITION").length,
          counterexample: proposals.filter((item) => item.kind === "COUNTEREXAMPLE").length,
        }),
        proposals,
        storage: marketOntologyAgentProposalStore?.marketOntologyAgentProposalStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 43,
          idempotencyKey: "proposalId" as const,
        }),
        authority: "PROPOSE_ONLY",
        semanticDecisionAuthority: false,
        probabilityAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      }));
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
      reconcileRelationDiscoveryTasks();
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
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/failure-budget-frontier"
    ) {
      await ready;
      const probability = probabilityEstimationScheduler.projection();
      const evaluatedAt = new Date(
        Math.floor(Date.now() / 60_000) * 60_000,
      ).toISOString();
      writeJson(response, 200, buildFailureBudgetFrontier({
        bounds: probability.bounds,
        jobs: probability.jobs,
        corpus: catalogObservationDesk.corpus(),
        evaluatedAt,
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
        ...localStudioCorsHeaders(request),
      });
      response.write(
        `event: projection-invalidated\ndata: ${JSON.stringify(
          buildStudioProjectionInvalidation({
            revision: projectionRevision,
            emittedAt: new Date().toISOString(),
            reason: "SUBSCRIBER_CONNECTED",
          }),
        )}\n\n`,
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
          discoveryMode?: unknown;
          family?: unknown;
        };
        const allowed = new Set([
          "title", "question", "lens", "venueIds", "cadenceMs", "priority", "enabled",
          "discoveryMode", "family",
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
          (input.discoveryMode !== undefined && input.discoveryMode !== "HEURISTIC_EXPLORATION" &&
            input.discoveryMode !== "CLAIM_MONITORING") ||
          (input.discoveryMode !== undefined && input.family === undefined) ||
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
          ...(input.discoveryMode === undefined
            ? {}
            : { discoveryMode: input.discoveryMode as NonNullable<CreateSearchIssueInput["discoveryMode"]> }),
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
      /^\/api\/v1\/proposals\/sha256:[0-9a-f]{64}\/semantic-review-detail-recovery$/u
        .test(url.pathname)
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).length !== 0
        ) throw new Error("semantic review detail recovery accepts only an empty object");
        const proposalId = url.pathname.split("/")[4] as Hash;
        const result = semanticReviewScheduler.requestOutcomeRecovery(proposalId);
        await broadcastProjection();
        writeJson(response, result.idempotentReplay ? 200 : 202, result);
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic: error instanceof Error
            ? error.message
            : "semantic review detail recovery failed",
          semanticDecisionAuthority: false,
          simulationAuthority: false,
          certificateAuthority: false,
          executionAuthority: false,
        });
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
        const scheduledSource = semanticReviewCandidates().find(
          ({ proposal }) => `ai:${proposal.proposalId}` === opportunityId,
        );
        const legacySource = marketArchaeologistDesk
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
        const source = scheduledSource ?? legacySource;
        if (source === undefined) {
          throw new Error("semantic review opportunity was not found");
        }
        const invocation = semanticReviewDesk.begin(
          opportunityId,
          source.proposal,
          catalogObservationDesk.corpus(),
          "proposalCorpusSnapshotIdentity" in source
            ? source.proposalCorpusSnapshotIdentity
            : source.corpusSnapshotIdentity,
          "evidenceBundle" in source ? source.evidenceBundle ?? undefined : undefined,
          "evidenceClaims" in source ? source.evidenceClaims ?? [] : [],
        );
        await broadcastProjection();
        const record = await invocation.promise;
        semanticReviewScheduler.reconcile(
          semanticReviewCandidates(),
          semanticReviewDesk.projection().records,
        );
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
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      if (response.headersSent || response.destroyed) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      writeJson(response, 500, {
        ok: false,
        diagnostic: error instanceof Error ? error.message : "request projection failed",
        executionAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      });
    });
  });
  let searchSchedulerTimer: ReturnType<typeof setInterval> | null = null;
  let searchIssueTimer: ReturnType<typeof setInterval> | null = null;
  let searchAttentionTimer: ReturnType<typeof setInterval> | null = null;
  let semanticReviewTimer: ReturnType<typeof setInterval> | null = null;
  let probabilityEstimationTimer: ReturnType<typeof setInterval> | null = null;
  let probabilityResolutionTimer: ReturnType<typeof setInterval> | null = null;
  let premiseAnalysisTimer: ReturnType<typeof setInterval> | null = null;
  let premiseEvidenceRoutingTimer: ReturnType<typeof setInterval> | null = null;
  let premiseRouteExpansionTimer: ReturnType<typeof setInterval> | null = null;
  let officialSourceDiscoveryTimer: ReturnType<typeof setInterval> | null = null;
  let evidenceAcquisitionTimer: ReturnType<typeof setInterval> | null = null;
  let ruleEvidenceClaimTimer: ReturnType<typeof setInterval> | null = null;
  let agentCampaignTimer: ReturnType<typeof setInterval> | null = null;
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
  const configuredAgentCampaignTickMs = process.env.PMH_AGENT_CAMPAIGN_TICK_MS;
  const agentCampaignTickMs = configuredAgentCampaignTickMs === undefined
    ? 1_000
    : Number(configuredAgentCampaignTickMs);
  if (!Number.isSafeInteger(agentCampaignTickMs) || agentCampaignTickMs < 0) {
    throw new Error("PMH_AGENT_CAMPAIGN_TICK_MS must be a non-negative integer");
  }
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
            reconcileRelationDiscoveryTasks();
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
        const runtime = aiRuntimeConfigurationDesk.current();
        if (runtime.provider === "DEEPSEEK" && !runtime.deepseekAutomationEnabled) return;
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
        reconcileRuleEvidenceAgentTasks();
        if (!aiRuntimeConfigurationDesk.current().deepseekAutomationEnabled) return;
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
  const premiseEvidenceRoutingTickMs = premiseEvidenceRoutingScheduler.tickIntervalMs;
  if (premiseEvidenceRoutingTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        if (!aiRuntimeConfigurationDesk.current().deepseekAutomationEnabled) return;
        try {
          premiseAnalysisScheduler.reconcile(premiseAnalysisCandidates());
          const runs = premiseEvidenceRoutingScheduler.tick(
            premiseEvidenceRoutingCandidates(),
          );
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) void run.then(() => broadcastProjection());
        } catch {
          // The next bounded tick retries persisted premise-evidence routing work.
        }
      };
      tick();
      premiseEvidenceRoutingTimer = setInterval(tick, premiseEvidenceRoutingTickMs);
      premiseEvidenceRoutingTimer.unref();
    });
  }
  const premiseRouteExpansionTickMs = premiseRouteExpansionScheduler.tickIntervalMs;
  if (premiseRouteExpansionTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        if (!aiRuntimeConfigurationDesk.current().deepseekAutomationEnabled) return;
        try {
          premiseEvidenceRoutingScheduler.reconcile(premiseEvidenceRoutingCandidates());
          const runs = premiseRouteExpansionScheduler.tick(
            premiseRouteExpansionCandidates(),
          );
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) {
            void run.then(() => {
              semanticReviewScheduler.reconcile(
                semanticReviewCandidates(),
                semanticReviewDesk.projection().records,
              );
              return broadcastProjection();
            });
          }
        } catch {
          // The next bounded tick retries exact-ref reformulation work.
        }
      };
      tick();
      premiseRouteExpansionTimer = setInterval(tick, premiseRouteExpansionTickMs);
      premiseRouteExpansionTimer.unref();
    });
  }
  const officialSourceDiscoveryTickMs = officialSourceDiscoveryScheduler.tickIntervalMs;
  if (officialSourceDiscoveryTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        void projection().then(() => {
          const runs = officialSourceDiscoveryScheduler.tick();
          if (runs.length === 0) return;
          void broadcastProjection();
          for (const run of runs) {
            void run.then(() => {
              evidenceAcquisitionScheduler.reconcile(evidenceRequirements());
              return broadcastProjection();
            }, () => broadcastProjection());
          }
        }).catch(() => undefined);
      };
      tick();
      officialSourceDiscoveryTimer = setInterval(tick, officialSourceDiscoveryTickMs);
      officialSourceDiscoveryTimer.unref();
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
  // Rule Evidence automatic spend now belongs exclusively to explicit active
  // Agent campaigns. The legacy provider-shaped scheduler remains readable and
  // manually callable during compatibility migration, but never owns a timer.
  const ruleEvidenceClaimTickMs = null;
  if (ruleEvidenceClaimTickMs !== null) {
    void ready.then(() => {
      const tick = () => {
        if (!aiRuntimeConfigurationDesk.current().deepseekAutomationEnabled) return;
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
  if (agentCampaignTickMs > 0) void ready.then(() => {
    const tickAgentCampaigns = () => {
      try {
        const dispatches = agentCampaignDispatcher.tick();
        if (dispatches.length === 0) return;
        void broadcastProjection();
        for (const dispatch of dispatches) {
          for (const [index, completion] of dispatch.completions.entries()) {
            const taskId = dispatch.preparedRuns[index]?.taskId;
            if (taskId === undefined) continue;
            void completion.then(
              () => reconcileAfterAgentTaskCompletion(taskId),
              () => reconcileAfterAgentTaskCompletion(taskId),
            );
          }
        }
      } catch {
        // A later bounded tick retries only campaigns that still retain authority.
      }
    };
    agentCampaignTimer = setInterval(tickAgentCampaigns, agentCampaignTickMs);
    agentCampaignTimer.unref();
  });
  server.once("close", () => {
    if (invalidationFlushTimer !== null) clearTimeout(invalidationFlushTimer);
    if (searchSchedulerTimer !== null) clearInterval(searchSchedulerTimer);
    if (searchIssueTimer !== null) clearInterval(searchIssueTimer);
    if (searchAttentionTimer !== null) clearInterval(searchAttentionTimer);
    if (semanticReviewTimer !== null) clearInterval(semanticReviewTimer);
    if (probabilityEstimationTimer !== null) clearInterval(probabilityEstimationTimer);
    if (probabilityResolutionTimer !== null) clearInterval(probabilityResolutionTimer);
    if (premiseAnalysisTimer !== null) clearInterval(premiseAnalysisTimer);
    if (premiseEvidenceRoutingTimer !== null) clearInterval(premiseEvidenceRoutingTimer);
    if (premiseRouteExpansionTimer !== null) clearInterval(premiseRouteExpansionTimer);
    if (officialSourceDiscoveryTimer !== null) clearInterval(officialSourceDiscoveryTimer);
    if (evidenceAcquisitionTimer !== null) clearInterval(evidenceAcquisitionTimer);
    if (ruleEvidenceClaimTimer !== null) clearInterval(ruleEvidenceClaimTimer);
    if (agentCampaignTimer !== null) clearInterval(agentCampaignTimer);
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
    premiseEvidenceRouter,
    premiseEvidenceRoutingScheduler,
    premiseRouteExpansionScheduler,
    officialSourceDiscoveryAgent,
    officialSourceDiscoveryScheduler,
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
