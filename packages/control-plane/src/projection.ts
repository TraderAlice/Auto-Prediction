import { hashCanonical } from "@pmh/domain";
import type {
  RealCandidateDepthEvidence,
  RealCandidateDispositionEvidence,
  RealCandidatePreflightEvidence,
  RealCandidateRescreenEvidence,
} from "@pmh/evidence";
import { runReplayChaosSuite } from "@pmh/market-state";
import { geminiManifest } from "@pmh/venue-gemini";
import { kalshiManifest } from "@pmh/venue-kalshi";
import { limitlessManifest } from "@pmh/venue-limitless";
import { myriadManifest } from "@pmh/venue-myriad";
import { opinionManifest } from "@pmh/venue-opinion";
import { polymarketManifest } from "@pmh/venue-polymarket";
import { polymarketUsManifest } from "@pmh/venue-polymarket-us";
import { assertManifest } from "@pmh/protocol";
import type {
  BookDeskProjection,
  DiscoveryDeskProjection,
  DiscoveryCatalogProjection,
  DiscoveryWorker,
  ModelProviderProjection,
  PiInvestigatorProjection,
  StudioProjection,
} from "./types.js";
import type { InvestigationDeskProjection } from "./investigation-desk.js";
import { modelScoutWorkerId } from "./model-scout.js";
import type { CatalogObservationProjection } from "./catalog-observation.js";
import type { CatalogRefreshSchedulerProjection } from "./catalog-refresh-scheduler.js";
import type { CandidateWatchProjection } from "./candidate-watch.js";
import type { OpportunityRadarProjection } from "./opportunity-radar.js";
import type { MarketCorpusProjection } from "./market-corpus.js";
import type { MarketArchaeologistProjection } from "./market-archaeologist.js";
import type { SearchLeaseSchedulerProjection } from "./search-lease-scheduler.js";
import type { SearchQuoteEnrichmentProjection } from "./search-quote-enrichment.js";
import type { SearchIssueSchedulerProjection } from "./search-issue-scheduler.js";
import type { SearchAttentionProjection } from "./search-attention-outbox.js";
import {
  buildSearchOutcomeAttribution,
  type SearchOutcomeAttributionProjection,
} from "./search-outcome-attribution.js";
import {
  OpportunityLifecycleDesk,
  type OpportunityLifecycleDeskProjection,
} from "./opportunity-lifecycle-desk.js";
import type { SemanticReviewDeskProjection } from "./semantic-review.js";
import {
  buildSemanticReviewAdmissionProjection,
  type SemanticReviewAdmissionProjection,
} from "./semantic-review-admission.js";
import type { SemanticReviewSchedulerProjection } from "./semantic-review-scheduler.js";
import { buildSemanticRelationGraph, type SemanticRelationGraphProjection } from "./semantic-relation-graph.js";
import type { AnonymousSimulationMaterializerProjection } from "./anonymous-simulation-materializer.js";
import { emptyReviewAttentionProjection, type ReviewAttentionProjection } from "./review-attention.js";
import { emptyProposalEconomicTriage, type ProposalEconomicTriageProjection } from "./proposal-economic-triage.js";
import {
  buildRelationPayoffProjection,
  type RelationPayoffProjection,
} from "./relation-payoff.js";
import { buildCampaignEvidence } from "./qualification.js";
import { buildReviewedCompilationEvidence } from "./reviewed-compilation.js";
import { buildResearchCaseDesk } from "./research-case-desk.js";

const presentation = {
  "polymarket-global": ["CLOB · CTF", 98, "#7ef0c1"],
  "polymarket-us": ["CLOB · US DCM", 95, "#58d5ff"],
  kalshi: ["CLOB · Centralized", 96, "#8ea9ff"],
  "gemini-predictions": ["CLOB · Combo", 99, "#84c8ff"],
  opinion: ["CLOB · Outcome token", 92, "#d4a8ff"],
  myriad: ["AMM · Multi-chain", 94, "#ffc78e"],
  limitless: ["CLOB · Socket.IO", 97, "#ff9f84"],
} as const;

const gatewayPostures = {
  kalshi: "INERT_DEMO",
  "gemini-predictions": "INERT_SANDBOX",
} as const;

const manifests = [
  polymarketManifest,
  polymarketUsManifest,
  kalshiManifest,
  geminiManifest,
  limitlessManifest,
  opinionManifest,
  myriadManifest,
].map(assertManifest);

function formatFixed(value: string, scale: string, signed = false): string {
  const amount = BigInt(value);
  const units = BigInt(scale);
  const cents = (amount * 100n) / units;
  const sign = cents < 0n ? "-" : signed && cents > 0n ? "+" : "";
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}$${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function titleCaseStage(value: string): string {
  return value
    .toLowerCase()
    .split(/[_-]/)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function buildStudioProjection(input: {
  workers: readonly DiscoveryWorker[];
  activeRuns: number;
  catalogContext?: DiscoveryCatalogProjection;
  catalogObservation?: CatalogObservationProjection;
  catalogRefreshScheduler?: CatalogRefreshSchedulerProjection;
  opportunityRadar?: OpportunityRadarProjection;
  marketCorpus?: MarketCorpusProjection;
  marketArchaeologist?: MarketArchaeologistProjection;
  searchLeaseScheduler?: SearchLeaseSchedulerProjection;
  searchQuoteEnrichment?: SearchQuoteEnrichmentProjection;
  searchIssueScheduler?: SearchIssueSchedulerProjection;
  searchAttention?: SearchAttentionProjection;
  searchOutcomeAttribution?: SearchOutcomeAttributionProjection;
  semanticReview?: SemanticReviewDeskProjection;
  semanticReviewAdmission?: SemanticReviewAdmissionProjection;
  semanticReviewScheduler?: SemanticReviewSchedulerProjection;
  reviewAttention?: ReviewAttentionProjection;
  proposalEconomicTriage?: ProposalEconomicTriageProjection;
  semanticRelationGraph?: SemanticRelationGraphProjection;
  opportunityLifecycle?: OpportunityLifecycleDeskProjection;
  relationPayoff?: RelationPayoffProjection;
  simulationMaterializer?: AnonymousSimulationMaterializerProjection;
  modelProvider?: ModelProviderProjection;
  investigator?: PiInvestigatorProjection;
  investigationDesk?: InvestigationDeskProjection;
  bookDesk?: BookDeskProjection;
  discoveryDesk?: DiscoveryDeskProjection;
  realCandidatePreflight?: RealCandidatePreflightEvidence;
  realCandidateDepth?: RealCandidateDepthEvidence;
  realCandidateDisposition?: RealCandidateDispositionEvidence;
  realCandidateRescreen?: RealCandidateRescreenEvidence;
  candidateWatch?: CandidateWatchProjection;
}): StudioProjection {
  const bookDesk = input.bookDesk ?? {
    mode: "FIXTURE_REPLAY" as const,
    replayCount: 0,
    books: [],
  };
  const replayChaos = runReplayChaosSuite();
  const modelProvider = input.modelProvider ?? {
    provider: "DEEPSEEK_CHAT_COMPLETIONS" as const,
    transport: "VERCEL_AI_SDK" as const,
    configured: false,
    credentialEnv: "DEEPSEEK_API_KEY" as const,
    model: "deepseek-v4-flash",
    maxOutputTokens: 800,
    timeoutMs: 300_000,
    maxSteps: 8,
    maxToolCalls: 24,
    fanout: 1,
    workerRoles: ["EQUIVALENCE" as const],
    reasoningEffort: "disabled" as const,
    responseStorage: "PROVIDER_POLICY" as const,
    authority: "PROPOSE_ONLY" as const,
  };
  const catalogContext = input.catalogContext ?? {
    mode: "VERIFIED_FIXTURE_CATALOGS" as const,
    corpusIdentity: hashCanonical({ listings: [], sourceFixtureHashes: [] }),
    listingCount: 0,
    venueCount: 0,
    sourceFixtureCount: 0,
    maxListingsPerTask: 30,
  };
  const catalogObservation = input.catalogObservation ?? {
    mode: "ANONYMOUS_PUBLIC_GET" as const,
    status: "IDLE" as const,
    promotion: "OBSERVE_ONLY" as const,
    contextQualification: {
      status: "INELIGIBLE" as const,
      eligibleSourceCount: 0,
      maxAgeMs: 15 * 60 * 1_000,
      maxListingsPerTask: 30,
      requiresExplicitRequest: true as const,
      defaultMode: "VERIFIED_FIXTURES" as const,
      authority: "PROPOSE_ONLY" as const,
    },
    currentSetIdentity: hashCanonical([]),
    sourceCount: 0,
    healthySourceCount: 0,
    listingCount: 0,
    timeoutMs: 10_000,
    maxResponseBytes: 2_000_000,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "observationId" as const,
    },
    sources: [],
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const catalogRefreshScheduler = input.catalogRefreshScheduler ?? {
    schemaVersion: "pmh.catalog-refresh-scheduler.v1" as const,
    enabled: false,
    status: "DISABLED" as const,
    intervalMs: null,
    nextRefreshAt: null,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastTrigger: null,
    lastResult: null,
    latestSnapshotIdentity: null,
    runCount: 0,
    readyCount: 0,
    degradedCount: 0,
    failedCount: 0,
    effects: {
      anonymousPublicGets: true as const,
      modelCalls: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const investigator = input.investigator ?? {
    engine: "PI_CLI" as const,
    configured: false,
    credentialEnv: "DEEPSEEK_API_KEY" as const,
    provider: "deepseek" as const,
    model: "deepseek-v4-flash",
    mode: "TEXT_ONE_SHOT" as const,
    thinking: "high" as const,
    tools: ["read", "grep", "find", "ls"] as const,
    sessionPersistence: false as const,
    timeoutMs: 300_000,
    maxOutputBytes: 2_000_000,
    authority: "PROPOSE_ONLY" as const,
  };
  const opportunityRadar = input.opportunityRadar ?? {
    algorithmVersion: "pmh.opportunity-radar.semantic-rotation-v3" as const,
    sourceSetIdentity: hashCanonical([]),
    observedListingCount: 0,
    eligibleSourceCount: 0,
    excludedSourceCount: 0,
    candidateCount: 0,
    candidates: [],
    scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE" as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const marketCorpus = input.marketCorpus ?? {
    schemaVersion: "pmh.market-corpus.v1" as const,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    sourceSetIdentity: hashCanonical([]),
    snapshotIdentity: hashCanonical({ listings: [] }),
    eligibleSourceCount: 0,
    excludedSourceCount: 0,
    listingCount: 0,
    authority: "OBSERVE_ONLY" as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const marketArchaeologist = input.marketArchaeologist ?? {
    schemaVersion: "pmh.market-archaeologist-desk.v1" as const,
    configured: false,
    model: "deepseek-v4-flash",
    status: "NEEDS_KEY" as const,
    activeCount: 0,
    concurrencyLimit: 1,
    runCount: 0,
    passCount: 0,
    failedCount: 0,
    retentionLimit: 10,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "runId" as const,
    },
    scheduler: {
      enabled: false,
      intervalMs: null,
      changedCorpusOnly: true as const,
      lastAttemptedSnapshotIdentity: null,
    },
    records: [],
    authority: "PROPOSE_ONLY" as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const searchLeaseScheduler = input.searchLeaseScheduler ?? {
    schemaVersion: "pmh.search-lease-scheduler.v1" as const,
    algorithmVersion: "pmh.ai-search-leases.v3" as const,
    enabled: false,
    configured: { fastLane: true, deepLane: false },
    status: "IDLE" as const,
    activeCount: 0,
    concurrencyLimit: 1,
    intervalMs: null,
    retentionLimit: 40,
    lensOrder: ["EQUIVALENCE", "IMPLICATION", "PARTITION", "MECHANISM"] as const,
    budget: {
      maxFastModelRequests: 1,
      maxPiInvocations: 1 as const,
      maxHypotheses: 8,
      deadlineMs: 300_000,
    },
    runCount: 0,
    passCount: 0,
    failedCount: 0,
    issuedCount: 0,
    duplicateCount: 0,
    piEscalationCount: 0,
    retainedCorpusCount: 0,
    recoverableIssuedCount: 0,
    missingCorpusIssuedCount: 0,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "leaseId" as const,
    },
    corpusStorage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "snapshotIdentity" as const,
    },
    records: [],
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const searchIssueScheduler = input.searchIssueScheduler ?? {
    schemaVersion: "pmh.search-issue-scheduler.v1" as const,
    enabled: false,
    status: "IDLE" as const,
    tickIntervalMs: null,
    concurrencyLimit: 3,
    activeCount: 0,
    issueCount: 0,
    enabledIssueCount: 0,
    dueIssueCount: 0,
    unreadNotificationCount: 0,
    performance: {
      measurementWindow: "RETAINED_TERMINAL_LEASES" as const,
      retainedLeaseLimit: 40,
      terminalLeaseCount: 0,
      novelCandidateCount: 0,
      duplicateCount: 0,
      piEscalationCount: 0,
      economicGateRequiredCount: 0,
      economicGatePositiveCount: 0,
      economicGateBlockedCount: 0,
      piAvoidedCount: 0,
      modelSelectionRequiredCount: 0,
      modelSelectedCandidateCount: 0,
      modelSelectionMissCount: 0,
      quoteEnrichmentAttemptCount: 0,
      quoteEnrichmentReadyCount: 0,
      quoteEnrichmentPartialCount: 0,
      quoteEnrichmentFailedCount: 0,
      quoteEnrichmentRescuedGateCount: 0,
      quoteObservationCount: 0,
      exactSemanticScopeCount: 0,
      semanticScopeRevisitCount: 0,
      noLeadSemanticScopeCount: 0,
      boundedSemanticScopeCount: 0,
      boundedScopeRevisitCount: 0,
      noLeadBoundedScopeCount: 0,
      hypothesisCount: 0,
      proposalCount: 0,
      evidenceGapCount: 0,
      coverageManifestCount: 0,
      degradedContextCount: 0,
      degradedPassCount: 0,
      insufficientCoverageFailureCount: 0,
      omittedVenueCount: 0,
      agentTraceLeaseCount: 0,
      agentRunCount: 0,
      agentStepCount: 0,
      agentToolCallCount: 0,
      agentCatalogReadCount: 0,
      agentAcceptedProposalEffectCount: 0,
      agentRejectedProposalEffectCount: 0,
      agentExplicitCompletionCount: 0,
      agentBudgetTerminationCount: 0,
      agentFailureTerminationCount: 0,
      providerRequestAttemptCount: 0,
      providerFailureCount: 0,
      providerFailureRateBps: null,
      providerNativeTelemetryLeaseCount: 0,
      providerLegacyDerivedLeaseCount: 0,
      providerFailuresByCategory: [],
      novelCandidateRateBps: null,
      duplicateRateBps: null,
      piEscalationRateBps: null,
      economicGatePositiveRateBps: null,
      byIssue: [],
    },
    issues: [],
    notifications: [],
    storage: {
      issues: {
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "issueId" as const,
      },
      notifications: {
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "notificationId" as const,
      },
    },
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const searchOutcomeAttribution = input.searchOutcomeAttribution ??
    buildSearchOutcomeAttribution({
      issues: [],
      searchLeases: [],
      semanticReviews: [],
      lifecycle: {
        cases: [],
        semanticDecisions: [],
        simulationBundles: [],
        exactVerifications: [],
        shadowObservations: [],
      },
      materializations: [],
    });
  const semanticReview = input.semanticReview ?? {
    schemaVersion: "pmh.semantic-review-desk.v1" as const,
    configured: false,
    model: "deepseek-v4-flash",
    status: "NEEDS_KEY" as const,
    runCount: 0,
    passCount: 0,
    failedCount: 0,
    activeCount: 0,
    concurrencyLimit: 3,
    retentionLimit: 50,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "reviewId" as const,
    },
    records: [],
    authority: "ADVISORY_ONLY" as const,
    independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER" as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const semanticReviewScheduler = input.semanticReviewScheduler ?? {
    schemaVersion: "pmh.semantic-review-scheduler.v1" as const,
    enabled: false,
    configured: false,
    status: "NEEDS_KEY" as const,
    tickIntervalMs: null,
    concurrencyLimit: 3,
    activeCount: 0,
    dueCount: 0,
    pendingCount: 0,
    leasedCount: 0,
    retryWaitCount: 0,
    blockedEvidenceCount: 0,
    researchOnlyCount: 0,
    duplicateScopeCount: 0,
    scopedJobCount: 0,
    uniqueReviewScopeCount: 0,
    historicalRedundantPassCount: 0,
    bundledJobCount: 0,
    capturedOriginalJobCount: 0,
    rebasedJobCount: 0,
    legacyEvidenceDebtCount: 0,
    passedCount: 0,
    exhaustedCount: 0,
    unreadNotificationCount: 0,
    budget: {
      basis: "REQUEST_ATTEMPTS" as const,
      maxAttemptsPerJob: 3,
      maxRequestsPerTick: 3,
      requestAttemptsStarted: 0,
    },
    jobs: [],
    notifications: [],
    storage: {
      jobs: {
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "jobId" as const,
      },
      notifications: {
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "notificationId" as const,
      },
    },
    authority: "ADVISORY_ORCHESTRATION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const semanticRelationGraph = input.semanticRelationGraph ?? buildSemanticRelationGraph({
    corpus: {
      ...marketCorpus,
      listings: [],
    },
    archaeologist: marketArchaeologist,
    searchLeases: searchLeaseScheduler,
    semanticReviews: semanticReview,
    lifecycle: input.opportunityLifecycle ?? new OpportunityLifecycleDesk().projection(),
    relationPayoff: input.relationPayoff ?? buildRelationPayoffProjection([]),
    materializations: input.simulationMaterializer ?? {
      schemaVersion: "pmh.anonymous-simulation-materializer-desk.v1",
      mode: "ANONYMOUS_PUBLIC_GET",
      status: "IDLE",
      runCount: 0,
      readyCount: 0,
      blockedCount: 0,
      retentionLimit: 25,
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000,
      maxSnapshotSkewMs: 5_000,
      retainedRawSourceCount: 0,
      storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "materializationId" },
      records: [],
      authority: "ANONYMOUS_RESEARCH_MATERIALIZER",
      certificateAuthority: false,
      executionAuthority: false,
      effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
    },
  });
  const investigationDesk = input.investigationDesk ?? {
    retentionLimit: 10,
    activeCount: 0 as const,
    runCount: 0,
    passCount: 0,
    failedCount: 0,
    storage: {
      mode: "MEMORY" as const,
      durable: false as const,
      schemaVersion: 0,
      idempotencyKey: "taskId+catalogContextIdentity" as const,
    },
    records: [],
  };
  const discoveryDesk = input.discoveryDesk ?? {
    retentionLimit: 25,
    runCount: 0,
    hypothesisCount: 0,
    unreviewedCount: 0,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "taskId" as const,
    },
    runs: [],
  };
  const researchDesk = buildResearchCaseDesk(discoveryDesk, investigationDesk);
  const candidateWatch = input.candidateWatch ?? {
    schemaVersion: "pmh.candidate-watch.v1" as const,
    mode: "ANONYMOUS_PUBLIC_GET" as const,
    status: "IDLE" as const,
    authority: "OBSERVE_AND_SCREEN_ONLY" as const,
    candidateClaimIdentity: hashCanonical({ candidate: "unloaded" }),
    canonicalTitle: "Candidate watch unavailable",
    boundSnapshotIdentity: hashCanonical({ books: [] }),
    latestRefreshId: null,
    observationSetIdentity: hashCanonical([]),
    changedVenueCount: 0,
    retentionPerSource: 10,
    refreshRetentionLimit: 25,
    timeoutMs: 10_000,
    maxResponseBytes: 1_000_000,
    storage: {
      mode: "MEMORY" as const,
      durable: false as const,
      schemaVersion: 0,
      idempotencyKey: "observationId" as const,
    },
    refreshStorage: {
      mode: "MEMORY" as const,
      durable: false as const,
      schemaVersion: 0,
      idempotencyKey: "refreshId" as const,
    },
    decision: null,
    refreshHistory: [],
    sources: [],
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const reviewedCompilation = buildReviewedCompilationEvidence();
  const compiledCapital = Object.entries(
    reviewedCompilation.certificate.capitalRequiredByVenue,
  );
  const totalCapital = compiledCapital.reduce(
    (total, [, amount]) => total + BigInt(amount),
    0n,
  );
  const worstCase = BigInt(
    reviewedCompilation.certificate.worstCaseAfterFees,
  );
  const returnBps = totalCapital === 0n ? 0n : (worstCase * 10_000n) / totalCapital;
  const state = {
    system: {
      lifecycle: "PRE_ALPHA" as const,
      observedVenueFamilies: 8,
      catalogAdapters: manifests.filter((manifest) =>
        manifest.capabilities.some(
          (capability) =>
            capability.capability === "MARKET_CATALOG" &&
            capability.implemented,
        ),
      ).length,
      realtimeBookAdapters: manifests.filter((manifest) =>
        manifest.capabilities.some(
          (capability) =>
            capability.capability === "REALTIME_BOOK" &&
            capability.implemented,
        ),
      ).length,
      inertOrderGateways: manifests.filter((manifest) =>
        manifest.capabilities.some(
          (capability) =>
            capability.capability === "ORDER_GATEWAY" &&
            capability.implemented,
        ),
      ).length,
      proofTests: 340,
      liveExecutionEnabled: false as const,
      controlPlaneConnected: true as const,
    },
    ai: {
      architecture: "AI_NATIVE_DISCOVERY" as const,
      activeRuns: input.activeRuns,
      catalogContext,
      catalogObservation,
      catalogRefreshScheduler,
      opportunityRadar,
      marketCorpus,
      marketArchaeologist,
      searchLeaseScheduler,
      searchQuoteEnrichment: input.searchQuoteEnrichment ?? {
        schemaVersion: "pmh.search-quote-enrichment-desk.v1" as const,
        mode: "ANONYMOUS_PUBLIC_GET" as const,
        status: "IDLE" as const,
        runCount: 0,
        readyCount: 0,
        partialCount: 0,
        failedCount: 0,
        unsupportedCount: 0,
        retainedObservationCount: 0,
        timeoutMs: 10_000,
        maxResponseBytes: 1_000_000,
        retentionLimit: 100,
        supportedVenues: Object.freeze(["opinion"] as const),
        storage: Object.freeze({
          mode: "MEMORY" as const,
          durable: false as const,
          schemaVersion: 0,
          idempotencyKey: "observationId" as const,
        }),
        observations: Object.freeze([]),
        authority: "SEARCH_PRICE_EVIDENCE_ONLY" as const,
        semanticDecisionAuthority: false as const,
        simulationAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          externalWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      },
      searchAttention: input.searchAttention ?? {
        schemaVersion: "pmh.search-attention-outbox.v1" as const,
        status: "IDLE" as const,
        digestWindowMs: 3_600_000,
        activationAt: new Date(0).toISOString(),
        retentionLimit: 100,
        messageCount: 0,
        digestCount: 0,
        immediateCount: 0,
        unreadInAppCount: 0,
        pendingDeliveryCount: 0,
        retryWaitCount: 0,
        deliveredWebhookCount: 0,
        deadLetterCount: 0,
        channels: Object.freeze({
          inApp: Object.freeze({ configured: true as const }),
          webhookJson: Object.freeze({
            configured: false,
            destinationStored: false as const,
            destinationProjected: false as const,
            cutoverPolicy: "PROCESS_ACTIVATION_NO_HISTORY_REPLAY" as const,
          }),
        }),
        messages: Object.freeze([]),
        deliveries: Object.freeze([]),
        storage: Object.freeze({
          messages: Object.freeze({
            mode: "MEMORY" as const,
            durable: false,
            schemaVersion: 0,
            idempotencyKey: "messageId" as const,
          }),
          deliveries: Object.freeze({
            mode: "MEMORY" as const,
            durable: false,
            schemaVersion: 0,
            idempotencyKey: "deliveryId" as const,
          }),
        }),
        authority: "ATTENTION_ROUTING_ONLY" as const,
        semanticDecisionAuthority: false as const,
        simulationAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          externalWrites: false,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      },
      searchIssueScheduler,
      searchOutcomeAttribution,
      semanticReview,
      semanticReviewAdmission: input.semanticReviewAdmission ??
        buildSemanticReviewAdmissionProjection([]),
      semanticReviewScheduler,
      reviewAttention: input.reviewAttention ?? emptyReviewAttentionProjection(),
      proposalEconomicTriage: input.proposalEconomicTriage ?? emptyProposalEconomicTriage(),
      semanticRelationGraph,
      modelProvider,
      investigator,
      investigationDesk,
      researchDesk,
      workers: [
        ...input.workers.map((worker) => ({
          workerId: worker.workerId,
          kind: worker.kind,
          costTier: worker.costTier,
          status: "READY" as const,
        })),
        ...(input.workers.some((worker) => worker.kind === "MODEL")
          ? []
          : modelProvider.workerRoles.map((role) => ({
              workerId: modelScoutWorkerId(role, modelProvider.fanout),
              kind: "MODEL" as const,
              costTier: "LOW" as const,
              status: modelProvider.configured
                ? ("NEEDS_PROVIDER" as const)
                : ("NEEDS_KEY" as const),
            }))),
      ],
      promotionBoundary:
        "AI proposes only; independent exact verification is the sole certificate authority.",
    },
    bookDesk,
    opportunityLifecycle:
      input.opportunityLifecycle ?? new OpportunityLifecycleDesk().projection(),
    relationPayoff:
      input.relationPayoff ?? buildRelationPayoffProjection([]),
    simulationMaterializer:
      input.simulationMaterializer ?? {
        schemaVersion: "pmh.anonymous-simulation-materializer-desk.v1" as const,
        mode: "ANONYMOUS_PUBLIC_GET" as const,
        status: "IDLE" as const,
        runCount: 0,
        readyCount: 0,
        blockedCount: 0,
        retentionLimit: 25,
        timeoutMs: 10_000,
        maxResponseBytes: 1_000_000,
        maxSnapshotSkewMs: 5_000,
        retainedRawSourceCount: 0,
        storage: Object.freeze({
          mode: "MEMORY" as const,
          durable: false as const,
          schemaVersion: 0,
          idempotencyKey: "materializationId" as const,
        }),
        records: Object.freeze([]),
        authority: "ANONYMOUS_RESEARCH_MATERIALIZER" as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          externalWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      },
    qualification: {
      replayChaos,
      campaignEvidence: buildCampaignEvidence(bookDesk, replayChaos),
      reviewedCompilation,
      realCandidatePreflight: input.realCandidatePreflight ?? null,
      realCandidateDepth: input.realCandidateDepth ?? null,
      realCandidateDisposition: input.realCandidateDisposition ?? null,
      realCandidateRescreen: input.realCandidateRescreen ?? null,
      candidateWatch,
    },
    discoveryDesk,
    venues: manifests
      .map((manifest) => {
        const details =
          presentation[manifest.venueId as keyof typeof presentation];
        if (details === undefined) {
          throw new Error(`missing presentation for ${manifest.venueId}`);
        }
        return {
          id: manifest.venueId,
          name: manifest.displayName.replace(" Prediction Markets", ""),
          mechanism: details[0],
          stage: manifest.capabilities.some(
            (capability) =>
              capability.capability === "REALTIME_BOOK" &&
              capability.qualification.includes("OBSERVE"),
          )
            ? ("OBSERVE" as const)
            : ("DISCOVER" as const),
          health: details[1],
          color: details[2],
          protocolIdentity: manifest.protocolIdentity,
          capabilities: manifest.capabilities
            .filter((capability) => capability.implemented)
            .map((capability) => capability.capability),
          gatewayPosture:
            gatewayPostures[
              manifest.venueId as keyof typeof gatewayPostures
            ] ?? ("ABSENT" as const),
          liveExecutionEnabled: false as const,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
    opportunities: [
      {
        id: "opp:synthetic-reviewed-binary-pair",
        title: "Synthetic binary-pair qualification",
        strategy: `Reviewed complete set · ${reviewedCompilation.certificate.legCount} fixture venues`,
        capital: formatFixed(
          totalCapital.toString(),
          reviewedCompilation.certificate.quantityScale,
        ),
        floor: formatFixed(
          reviewedCompilation.certificate.worstCaseAfterFees,
          reviewedCompilation.certificate.quantityScale,
          true,
        ),
        returnRate: `+${returnBps / 100n}.${String(returnBps % 100n).padStart(2, "0")}%`,
        expires: "fixture-bound",
        certificate: reviewedCompilation.certificate.id,
        evidence: `${reviewedCompilation.stages.flatMap((stage) => stage.evidenceHashes).length} hash-bound inputs`,
        confidence: "EXACT" as const,
        source: "SYNTHETIC_QUALIFICATION_FIXTURE" as const,
      },
    ],
    trace: reviewedCompilation.stages.map(
      (stage) =>
        [titleCaseStage(stage.stage), stage.status, stage.detail] as const,
    ),
    capital: compiledCapital.map(([venue]) => ({
      venue: titleCaseStage(venue),
      available: 0,
      reserved: 100,
      locked: 0,
    })),
    capitalScope: "SYNTHETIC_QUALIFICATION_FIXTURE" as const,
    payoffStates: Object.entries(
      reviewedCompilation.certificate.payoffByResolution,
    ).map(([label, amount]) => ({
      label: label.toUpperCase(),
      amount: formatFixed(
        amount,
        reviewedCompilation.certificate.quantityScale,
        true,
      ),
      height: 80,
    })),
  };
  return Object.freeze({
    identity: {
      schemaVersion: "pmh.studio-projection.v1" as const,
      campaign: "architecture-qualification",
      mode: "CONTROL_PLANE" as const,
      stateHash: hashCanonical(state),
    },
    ...state,
  });
}
