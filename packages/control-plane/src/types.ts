import type { Hash } from "@pmh/domain";

export type DiscoveryCatalogContextSource =
  | "VERIFIED_FIXTURE_CATALOGS"
  | "QUALIFIED_LIVE_OBSERVATIONS";

export type DiscoveryCatalogMode =
  | "VERIFIED_FIXTURES"
  | "CURRENT_OBSERVATIONS";

export type DiscoveryEvidenceLocator = Readonly<{
  schemaVersion:
    | "pmh.discovery-evidence-locator.v1"
    | "pmh.discovery-evidence-locator.v2";
  locatorIdentity: Hash;
  role:
    | "CONTRACT_RULE_DOCUMENT"
    | "VENUE_RULE_DOCUMENT"
    | "OUTCOME_RESOLUTION_SOURCE";
  url: string;
  authority: "EVIDENCE_LOCATOR_ONLY";
  fetchAuthority: false;
}>;

export type DiscoveryCatalogListing = Readonly<{
  listingRef: string;
  venueId: string;
  venueInstrumentId: string;
  title: string;
  description: string;
  status: string;
  mechanism: string;
  closesAt: string | null;
  rulesText: string | null;
  rulesTextPosture?: "COMPLETE" | "TRUNCATED";
  rulesTextSourceCharacterCount?: number;
  evidenceLocators?: readonly DiscoveryEvidenceLocator[];
  outcomes: readonly Readonly<{
    venueOutcomeId: string;
    label: string;
    indicativePrice: string | null;
  }>[];
  priceScale: string;
  quantityScale: string;
  minPriceTick: string | null;
  sourceKind: "VERIFIED_FIXTURE" | "LIVE_OBSERVATION";
  sourceReceivedAt: string;
  sourceRawHash: string;
  protocolIdentity: string;
}>;

export type DiscoveryCatalogContext = Readonly<{
  schemaVersion: "pmh.discovery-catalog-context.v2";
  source: DiscoveryCatalogContextSource;
  contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY";
  contextIdentity: string;
  listings: readonly DiscoveryCatalogListing[];
}>;

export type DiscoveryCatalogProjection = Readonly<{
  mode: "VERIFIED_FIXTURE_CATALOGS";
  corpusIdentity: string;
  listingCount: number;
  venueCount: number;
  sourceFixtureCount: number;
  maxListingsPerTask: number;
}>;

export type DiscoveryTask = Readonly<{
  taskId: string;
  question: string;
  venueIds: readonly string[];
  maxHypotheses: number;
  deadlineEpochMs: number;
  catalogContext?: DiscoveryCatalogContext;
  searchAssignment?: Readonly<{
    lens: "EQUIVALENCE" | "IMPLICATION" | "PARTITION" | "MECHANISM";
    semanticFamily: import("./search-semantic-family.js").SearchSemanticFamily | null;
    sourceTrailheadIdentity: Hash | null;
    inspirationDepth: 0 | 1;
  }>;
}>;

export type DiscoveryRelationKind =
  | "EQUIVALENT"
  | "IMPLIES"
  | "SUBSET"
  | "MUTUALLY_EXCLUSIVE"
  | "EXHAUSTIVE"
  | "CONDITIONAL"
  | "RELATED"
  | "CONFLICTING";

export type OpportunityHypothesis = Readonly<{
  hypothesisId: string;
  workerId: string;
  thesis: string;
  strategyKind:
    | "COMPLETE_SET"
    | "EXHAUSTIVE_RANGE"
    | "SAME_CLAIM_CROSS_VENUE";
  relationKind?: DiscoveryRelationKind;
  venueIds: readonly string[];
  claimSearchTerms: readonly string[];
  listingRefs?: readonly string[];
  confidenceBps: number;
  authority: "PROPOSE_ONLY";
  reviewStatus: "UNREVIEWED";
}>;

export type DiscoveryFalsification = Readonly<{
  schemaVersion:
    | "pmh.discovery-falsification.v1"
    | "pmh.discovery-falsification.v2";
  falsificationId: Hash;
  findingIdentity?: Hash;
  workerId: string;
  taskId: string;
  claim: string;
  reason: string;
  relationKind?:
    | "EQUIVALENCE"
    | "IMPLICATION"
    | "MUTUAL_EXCLUSION"
    | "EXHAUSTIVENESS"
    | "MECHANISM";
  listingRefs: readonly string[];
  claimSearchTerms: readonly string[];
  authority: "SEARCH_NEGATIVE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type DiscoveryInspiration = Readonly<{
  schemaVersion: "pmh.discovery-inspiration.v1";
  inspirationId: Hash;
  contentIdentity: Hash;
  workerId: string;
  taskId: string;
  observation: string;
  listingRefs: readonly string[];
  searchSignals: readonly string[];
  sourceLens: "EQUIVALENCE" | "IMPLICATION" | "PARTITION" | "MECHANISM";
  sourceSemanticFamily: import("./search-semantic-family.js").SearchSemanticFamily | null;
  sourceTrailheadIdentity: Hash | null;
  suggestedLens: "EQUIVALENCE" | "IMPLICATION" | "PARTITION" | "MECHANISM";
  suggestedSemanticFamily: import("./search-semantic-family.js").SearchSemanticFamily | null;
  inspirationDepth: 0 | 1;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type DiscoveryWorkerReport = Readonly<{
  workerId: string;
  kind: "HEURISTIC" | "MODEL";
  costTier: "FREE" | "LOW";
  status: "PASS" | "FAILED";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  hypothesisCount: number;
  falsificationCount?: number;
  inspirationCount?: number;
  diagnostic: string | null;
  providerRequestAttemptCount?: number;
  providerFailureCategory?: import("./model-failure.js").ModelFailureCategory | null;
  agentTrace?: DiscoveryAgentTrace;
}>;

export type DiscoveryAgentToolName =
  | "search_catalog"
  | "inspect_listings"
  | "record_hypothesis"
  | "record_falsification"
  | "record_inspiration"
  | "complete_search"
  | "unknown_tool";

export type DiscoveryAgentEffectStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "IDEMPOTENT_REPLAY";

export type DiscoveryAgentEffectReason =
  | "CATALOG_RESULTS"
  | "LISTINGS_INSPECTED"
  | "HYPOTHESIS_RECORDED"
  | "FALSIFICATION_RECORDED"
  | "INSPIRATION_RECORDED"
  | "SEARCH_COMPLETED"
  | "INVALID_INPUT"
  | "INPUT_TOO_LARGE"
  | "OUT_OF_SCOPE"
  | "UNKNOWN_LISTING"
  | "INSPECTION_REQUIRED"
  | "SEARCH_REQUIRED"
  | "PROTOCOL_INVALID"
  | "DUPLICATE"
  | "PROPOSAL_LIMIT"
  | "TOOL_CALL_LIMIT"
  | "ALREADY_COMPLETED";

export type DiscoveryAgentEffect = Readonly<{
  ordinal: number;
  toolName: DiscoveryAgentToolName;
  status: DiscoveryAgentEffectStatus;
  reason: DiscoveryAgentEffectReason;
  inputIdentity: string;
  outputIdentity: string;
  listingRefs: readonly string[];
  hypothesisId: string | null;
  falsificationId?: Hash | null;
  inspirationId?: Hash | null;
}>;

export type DiscoveryAgentTerminationReason =
  | "EXPLICIT_COMPLETION"
  | "PROPOSAL_LIMIT"
  | "STEP_LIMIT"
  | "TOOL_CALL_LIMIT"
  | "MODEL_FINISHED"
  | "TIMEOUT"
  | "TASK_DEADLINE"
  | "PROVIDER_FAILURE"
  | "PROTOCOL_FAILURE";

export type DiscoveryAgentTrace = Readonly<{
  schemaVersion:
    | "pmh.discovery-agent-trace.v1"
    | "pmh.discovery-agent-trace.v2"
    | "pmh.discovery-agent-trace.v3"
    | "pmh.discovery-agent-trace.v4";
  protocol: "PMH_BOUNDED_TOOL_LOOP_V1";
  stepCount: number;
  providerRequestAttemptCount: number;
  toolCallCount: number;
  catalogReadCount: number;
  acceptedProposalCount: number;
  rejectedProposalCount: number;
  acceptedFalsificationCount?: number;
  rejectedFalsificationCount?: number;
  acceptedInspirationCount?: number;
  rejectedInspirationCount?: number;
  terminationReason: DiscoveryAgentTerminationReason;
  effects: readonly DiscoveryAgentEffect[];
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type DiscoveryAgentRunResult = Readonly<{
  hypotheses: readonly OpportunityHypothesis[];
  falsifications: readonly DiscoveryFalsification[];
  inspirations: readonly DiscoveryInspiration[];
  trace: DiscoveryAgentTrace;
}>;

export type DiscoveryRun = Readonly<{
  runId: string;
  taskId: string;
  startedAt: string;
  completedAt: string;
  workerIds: readonly string[];
  workerReports?: readonly DiscoveryWorkerReport[];
  hypotheses: readonly OpportunityHypothesis[];
  falsifications?: readonly DiscoveryFalsification[];
  inspirations?: readonly DiscoveryInspiration[];
  diagnostics: readonly string[];
  executionAuthority: false;
}>;

export type DiscoveryRunRecord = DiscoveryRun &
  Readonly<{
    question: string;
    venueIds: readonly string[];
    catalogContext?: DiscoveryCatalogContext;
    catalogContextRetained?: boolean;
    catalogContextIdentity?: string;
    catalogListingCount?: number;
    catalogContextSource?: DiscoveryCatalogContextSource;
  }>;

export type DiscoveryDeskProjection = Readonly<{
  retentionLimit: number;
  runCount: number;
  hypothesisCount: number;
  unreviewedCount: number;
  falsificationCount: number;
  inspirationCount: number;
  storage: OperationalStorageProjection;
  runs: readonly DiscoveryRunRecord[];
}>;

export type OperationalStorageProjection<
  TIdempotencyKey extends string = "taskId",
> = Readonly<{
  mode: "MEMORY" | "SQLITE_WAL";
  durable: boolean;
  schemaVersion: number;
  idempotencyKey: TIdempotencyKey;
}>;

export interface DiscoveryWorker {
  readonly workerId: string;
  readonly kind: "HEURISTIC" | "MODEL";
  readonly costTier: "FREE" | "LOW";
  discover(task: DiscoveryTask): Promise<readonly OpportunityHypothesis[]>;
  runWithTrace?(task: DiscoveryTask): Promise<DiscoveryAgentRunResult>;
}

export interface DiscoveryAgentPort {
  run(input: {
    workerId: string;
    model: string;
    system: string;
    searchLens?: string;
    task: DiscoveryTask;
  }): Promise<DiscoveryAgentRunResult>;
}

export type ModelProviderProjection = Readonly<{
  provider:
    | "OPENAI_RESPONSES"
    | "CODEX_RESPONSES"
    | "DEEPSEEK_CHAT_COMPLETIONS";
  transport: "VERCEL_AI_SDK";
  configured: boolean;
  credentialEnv: "OPENAI_API_KEY" | "DEEPSEEK_API_KEY" | "CODEX_OAUTH";
  model: string;
  maxOutputTokens: number;
  maxOutputTokensEnforced: boolean;
  timeoutMs: number;
  maxSteps: number;
  maxToolCalls: number;
  fanout: number;
  workerRoles: readonly ModelScoutRole[];
  reasoningEffort:
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max"
    | "disabled";
  responseStorage: false | "PROVIDER_POLICY";
  authority: "PROPOSE_ONLY";
}>;

export type ModelScoutRole =
  | "EQUIVALENCE"
  | "PARTITION"
  | "MECHANISM"
  | "SKEPTIC";

export type PiInvestigatorProjection = Readonly<{
  engine: "PI_CLI";
  configured: boolean;
  credentialEnv: "DEEPSEEK_API_KEY";
  provider: "deepseek";
  model: string;
  mode: "TEXT_ONE_SHOT";
  thinking: "high";
  tools: readonly ["read", "grep", "find", "ls"];
  sessionPersistence: false;
  timeoutMs: number;
  maxOutputBytes: number;
  authority: "PROPOSE_ONLY";
}>;

export type StudioBookProjection = Readonly<{
  bookId: string;
  venueId: string;
  venueName: string;
  instrumentId: string;
  lifecycle:
    | "EMPTY"
    | "SNAPSHOT_VALID"
    | "APPLYING_DELTAS"
    | "STALE"
    | "GAP_DETECTED"
    | "REBUILDING";
  generation: string;
  sequence: string | null;
  stateHash: string | null;
  evidenceHash: string;
  capturedAt: string;
  sequencePolicy:
    | "NATIVE_RANGE"
    | "FULL_SNAPSHOT_REBUILD"
    | "VERSIONED_SNAPSHOT_REBUILD";
  bestBid: string | null;
  bestAsk: string | null;
  spread: string | null;
  bidLevelCount: number;
  askLevelCount: number;
  bids: readonly Readonly<{ price: string; size: string }>[];
  asks: readonly Readonly<{ price: string; size: string }>[];
  diagnostic: string | null;
}>;

export type BookDeskProjection = Readonly<{
  mode: "FIXTURE_REPLAY";
  replayCount: number;
  books: readonly StudioBookProjection[];
}>;

export type StudioProjection = Readonly<{
  identity: Readonly<{
    schemaVersion: "pmh.studio-projection.v2";
    campaign: string;
    mode: "CONTROL_PLANE";
    view: "FULL" | "LIVE_BOUNDED";
    stateHash: string;
    viewHash: string;
  }>;
  projectionWindow: Readonly<{
    schemaVersion: "pmh.studio-projection-window.v1";
    mode: "FULL" | "LIVE_BOUNDED";
    sourceStateHash: string;
    collections: readonly Readonly<{
      path: string;
      totalCount: number;
      includedCount: number;
      limit: number;
      selection:
        | "ACTIVE_THEN_RETAINED_ORDER"
        | "RETAINED_ORDER"
        | "OMITTED_FROM_LIVE_VIEW"
        | "LINKED_TO_INCLUDED_CASES";
      fullResource: "/api/v1/projection?view=full";
    }>[];
    authority: "PRESENTATION_WINDOW_ONLY";
    historyDeleted: false;
  }>;
  system: Readonly<{
    lifecycle: "PRE_ALPHA";
    observedVenueFamilies: number;
    catalogAdapters: number;
    realtimeBookAdapters: number;
    inertOrderGateways: number;
    proofTests: number;
    liveExecutionEnabled: false;
    controlPlaneConnected: true;
  }>;
  ai: Readonly<{
    architecture: "AI_NATIVE_DISCOVERY";
    activeRuns: number;
    catalogContext: DiscoveryCatalogProjection;
    catalogObservation: import("./catalog-observation.js").CatalogObservationProjection;
    catalogRefreshScheduler: import("./catalog-refresh-scheduler.js").CatalogRefreshSchedulerProjection;
    opportunityRadar: import("./opportunity-radar.js").OpportunityRadarProjection;
    marketCorpus: import("./market-corpus.js").MarketCorpusProjection;
    marketArchaeologist: import("./market-archaeologist.js").MarketArchaeologistProjection;
    searchQuoteEnrichment: import("./search-quote-enrichment.js").SearchQuoteEnrichmentProjection;
    searchAttention: import("./search-attention-outbox.js").SearchAttentionProjection;
    searchLeaseScheduler: import("./search-lease-scheduler.js").SearchLeaseSchedulerProjection;
    searchIssueScheduler: import("./search-issue-scheduler.js").SearchIssueSchedulerProjection;
    searchOutcomeAttribution: import("./search-outcome-attribution.js").SearchOutcomeAttributionProjection;
    semanticReview: import("./semantic-review.js").SemanticReviewDeskProjection;
    probabilityEstimation: import("./probability-estimation-agent.js").ProbabilityEstimationDeskProjection;
    probabilityEstimationScheduler: import("./probability-estimation-scheduler.js").ProbabilityEstimationSchedulerProjection;
    probabilityCalibration: import("./probability-calibration-desk.js").ProbabilityCalibrationDeskProjection;
    probabilityResolutionAcquisition: import("./probability-resolution-acquisition.js").ProbabilityResolutionAcquisitionProjection;
    aiUsage: import("./ai-usage-ledger.js").AiUsageProjection;
    runtimeConfiguration: import("./ai-runtime-configuration.js").AiRuntimeConfigurationProjection;
    semanticReviewAdmission: import("./semantic-review-admission.js").SemanticReviewAdmissionProjection;
    semanticReviewScheduler: import("./semantic-review-scheduler.js").SemanticReviewSchedulerProjection;
    premiseAnalysis: import("./premise-analysis.js").PremiseAnalysisDeskProjection;
    premiseAnalysisScheduler: import("./premise-analysis-scheduler.js").PremiseAnalysisSchedulerProjection;
    premiseEvidenceRouting: import("./premise-evidence-routing-scheduler.js").PremiseEvidenceRoutingSchedulerProjection;
    premiseRouteExpansion: import("./premise-route-expansion-scheduler.js").PremiseRouteExpansionSchedulerProjection;
    evidenceAcquisition: import("./evidence-acquisition-scheduler.js").EvidenceAcquisitionSchedulerProjection;
    evidenceDebtFrontier: import("./evidence-debt-frontier.js").EvidenceDebtFrontierProjection;
    probabilityEvidenceDebt: import("./probability-evidence-debt.js").ProbabilityEvidenceDebtProjection;
    probabilityCaseRepairQueue: import("./probability-case-challenge-queue.js").ProbabilityCaseRepairQueue;
    probabilitySemanticRepairProgress: import("./probability-semantic-repair-progress.js").ProbabilitySemanticRepairProgressProjection;
    ruleEvidenceClaims: import("./rule-evidence-claim-scheduler.js").RuleEvidenceClaimSchedulerProjection;
    reviewAttention: import("./review-attention.js").ReviewAttentionProjection;
    proposalEconomicTriage: import("./proposal-economic-triage.js").ProposalEconomicTriageProjection;
    semanticRelationGraph: import("./semantic-relation-graph.js").SemanticRelationGraphProjection;
    modelProvider: ModelProviderProjection;
    investigator: PiInvestigatorProjection;
    investigationDesk: import("./investigation-desk.js").InvestigationDeskProjection;
    researchDesk: import("./research-case-desk.js").ResearchCaseDeskProjection;
    workers: readonly Readonly<{
      workerId: string;
      kind: "HEURISTIC" | "MODEL";
      costTier: "FREE" | "LOW";
      status: "READY" | "NEEDS_KEY" | "NEEDS_PROVIDER";
    }>[];
    promotionBoundary: string;
  }>;
  bookDesk: BookDeskProjection;
  opportunityLifecycle: import("./opportunity-lifecycle-desk.js").OpportunityLifecycleDeskProjection;
  relationPayoff: import("./relation-payoff.js").RelationPayoffProjection;
  simulationMaterializer: import("./anonymous-simulation-materializer.js").AnonymousSimulationMaterializerProjection;
  qualification: Readonly<{
    replayChaos: ReplayChaosReport;
    campaignEvidence: CampaignEvidenceBundle;
    reviewedCompilation: ReviewedCompilationEvidence;
    realCandidatePreflight: import("@pmh/evidence").RealCandidatePreflightEvidence | null;
    realCandidateDepth: import("@pmh/evidence").RealCandidateDepthEvidence | null;
    realCandidateDisposition: import("@pmh/evidence").RealCandidateDispositionEvidence | null;
    realCandidateRescreen: import("@pmh/evidence").RealCandidateRescreenEvidence | null;
    candidateWatch: import("./candidate-watch.js").CandidateWatchProjection;
  }>;
  discoveryDesk: DiscoveryDeskProjection;
  venues: readonly Readonly<{
    id: string;
    name: string;
    mechanism: string;
    stage: "DISCOVER" | "OBSERVE";
    health: number;
    color: string;
    protocolIdentity: string;
    capabilities: readonly string[];
    gatewayPosture: "ABSENT" | "INERT_DEMO" | "INERT_SANDBOX";
    liveExecutionEnabled: false;
  }>[];
  opportunities: readonly Readonly<{
    id: string;
    title: string;
    strategy: string;
    capital: string;
    floor: string;
    returnRate: string;
    expires: string;
    certificate: string;
    evidence: string;
    confidence: "EXACT";
    source: "SYNTHETIC_QUALIFICATION_FIXTURE";
  }>[];
  trace: readonly (readonly [string, "PASS" | "BLOCKED", string])[];
  capital: readonly Readonly<{
    venue: string;
    available: number;
    reserved: number;
    locked: number;
  }>[];
  capitalScope: "SYNTHETIC_QUALIFICATION_FIXTURE";
  payoffStates: readonly Readonly<{
    label: string;
    amount: string;
    height: number;
  }>[];
}>;
import type { ReplayChaosReport } from "@pmh/market-state";
import type { CampaignEvidenceBundle } from "./qualification.js";
import type { ReviewedCompilationEvidence } from "./reviewed-compilation.js";
