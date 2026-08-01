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
import { radarTriageTaskId } from "./opportunity-radar.js";
import { buildStudioProjection } from "./projection.js";
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
  parseSemanticReviewTickInterval,
  SemanticReviewScheduler,
  type SemanticReviewCandidate,
  type SemanticReviewSchedulerStore,
} from "./semantic-review-scheduler.js";
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
  SEARCH_LENSES,
  SearchLeaseBusyError,
  SearchLeaseScheduler,
  SearchLeaseUnavailableError,
  type SearchLeaseRecordStore,
  type SearchLens,
} from "./search-lease-scheduler.js";
import {
  parseSearchIssueTickInterval,
  SearchIssueScheduler,
  type SearchIssueRecordStore,
} from "./search-issue-scheduler.js";
import { buildSearchOutcomeAttribution } from "./search-outcome-attribution.js";
import {
  buildSemanticRelationGraph,
  searchSemanticGraphNeighborhood,
  type SemanticGraphSearchContext,
} from "./semantic-relation-graph.js";

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
  searchIssueScheduler?: SearchIssueScheduler;
  semanticReviewDesk?: SemanticReviewDesk;
  semanticReviewScheduler?: SemanticReviewScheduler;
  opportunityLifecycleDesk?: OpportunityLifecycleDesk;
  simulationMaterializerDesk?: AnonymousSimulationMaterializerDesk;
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
  const modelRuntime =
    options?.modelRuntime ?? createDiscoveryModelRuntime();
  const piRuntime = options?.piRuntime ?? createPiInvestigatorRuntime();
  const worker = new HeuristicDiscoveryWorker();
  const pool =
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
      ...(supportsMarketArchaeologistRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  let graphContextForLease:
    | ((snapshot: MarketCorpusSnapshot, lens: SearchLens) => SemanticGraphSearchContext)
    | undefined;
  const searchLeaseScheduler =
    options?.searchLeaseScheduler ??
    new SearchLeaseScheduler({
      intervalMs: parseSearchLeaseInterval(process.env),
      concurrencyLimit: 3,
      context: (question, venueIds, lens) => {
        const radarLead = lens === "EQUIVALENCE"
          ? catalogObservationDesk.radar().candidates[0]
          : undefined;
        return radarLead === undefined
          ? catalogObservationDesk.context(question, venueIds)
          : catalogObservationDesk.radarTriageScope(
              radarLead.candidateId,
            ).catalogContext;
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
  const semanticReviewDesk =
    options?.semanticReviewDesk ??
    createSemanticReviewDesk(process.env, {
      ...(supportsSemanticReviewRecords(options?.discoveryStore)
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
  const semanticGraph = (snapshot: MarketCorpusSnapshot) => {
    const archaeologist = marketArchaeologistDesk.projection();
    opportunityLifecycleDesk.syncMarketArchaeologist(archaeologist);
    const lifecycle = opportunityLifecycleDesk.projection();
    const semanticReviews = semanticReviewDesk.projection();
    const relationPayoff = deriveRelationPayoffProjection({
      archaeologist,
      semanticReviews: semanticReviews.records,
      semanticDecisions: lifecycle.semanticDecisions,
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
    const candidates = baseSemanticReviewCandidates();
    return applyProposalEconomicPriority(
      candidates,
      buildProposalEconomicTriage({
        candidates,
        corpus: catalogObservationDesk.corpus(),
      }),
    );
  };
  const realCandidateReady = realCandidatePreflightDesk.load();
  const ready = Promise.all([
    bookDesk.replay(),
    catalogDesk.load(),
    realCandidateReady,
    realCandidateReady.then(() => candidateWatchDesk.load()),
    ...(options?.refreshCatalogOnReady === true
      ? [catalogRefreshScheduler.runNow("STARTUP").promise]
      : []),
  ]).then(() => undefined);
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
    const economicTriageProjection = buildProposalEconomicTriage({
      candidates: baseReviewCandidates,
      corpus: catalogObservationDesk.corpus(),
    });
    semanticReviewScheduler.reconcile(
      applyProposalEconomicPriority(baseReviewCandidates, economicTriageProjection),
      semanticReviewProjection.records,
    );
    const semanticReviewSchedulerProjection = semanticReviewScheduler.projection();
    const lifecycleProjection = opportunityLifecycleDesk.projection();
    const searchLeaseProjection = searchLeaseScheduler.projection();
    const searchIssueProjection = searchIssueScheduler.projection();
    const materializerProjection = simulationMaterializerDesk.projection();
    const relationPayoff = deriveRelationPayoffProjection({
      archaeologist: archaeologistProjection,
      semanticReviews: semanticReviewProjection.records,
      semanticDecisions: lifecycleProjection.semanticDecisions,
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
    });
    const searchOutcomeAttribution = buildSearchOutcomeAttribution({
      issues: searchIssueProjection.issues,
      searchLeases: searchLeaseProjection.records,
      semanticReviewJobs: semanticReviewSchedulerProjection.jobs,
      semanticReviews: semanticReviewProjection.records,
      lifecycle: lifecycleProjection,
      materializations: materializerProjection.records,
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
      searchIssueScheduler: searchIssueProjection,
      searchOutcomeAttribution,
      semanticReview: semanticReviewProjection,
      semanticReviewScheduler: semanticReviewSchedulerProjection,
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

  const broadcastProjection = async (): Promise<void> => {
    const payload = `event: projection\ndata: ${JSON.stringify(
      await projection(),
    )}\n\n`;
    for (const subscriber of subscribers) {
      if (subscriber.destroyed) {
        subscribers.delete(subscriber);
      } else {
        subscriber.write(payload);
      }
    }
  };

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
        semanticRelationGraph: semanticGraph(catalogObservationDesk.corpus()),
        semanticReview: semanticReviewDesk.projection(),
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
      writeJson(response, 200, await projection());
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
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/semantic-reviews"
    ) {
      writeJson(response, 200, semanticReviewDesk.projection());
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
        `event: projection\ndata: ${JSON.stringify(await projection())}\n\n`,
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
        };
        const allowed = new Set([
          "title", "question", "lens", "venueIds", "cadenceMs", "priority", "enabled",
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
          (input.enabled !== undefined && typeof input.enabled !== "boolean")
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
  let semanticReviewTimer: ReturnType<typeof setInterval> | null = null;
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
        void run.then(() => broadcastProjection());
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
  server.once("close", () => {
    if (searchSchedulerTimer !== null) clearInterval(searchSchedulerTimer);
    if (searchIssueTimer !== null) clearInterval(searchIssueTimer);
    if (semanticReviewTimer !== null) clearInterval(semanticReviewTimer);
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
    searchIssueScheduler,
    semanticReviewDesk,
    semanticReviewScheduler,
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
  const { server, ready } = createControlPlane({
    discoveryStore,
    investigationStore: discoveryStore,
    refreshCatalogOnReady: true,
  });
  await ready;
  try {
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolveListen);
    });
    process.stdout.write(
      `control-plane http://${host}:${port} · ${discoveryStore.storage.mode}\n`,
    );
  } catch (error) {
    discoveryStore.close();
    throw error;
  }
}
