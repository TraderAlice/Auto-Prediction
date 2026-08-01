export type DiscoveryCatalogContextSource =
  | "VERIFIED_FIXTURE_CATALOGS"
  | "QUALIFIED_LIVE_OBSERVATIONS";

export type DiscoveryCatalogMode =
  | "VERIFIED_FIXTURES"
  | "CURRENT_OBSERVATIONS";

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
  outcomes: readonly Readonly<{
    label: string;
    indicativePrice: string | null;
  }>[];
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
}>;

export type OpportunityHypothesis = Readonly<{
  hypothesisId: string;
  workerId: string;
  thesis: string;
  strategyKind:
    | "COMPLETE_SET"
    | "EXHAUSTIVE_RANGE"
    | "SAME_CLAIM_CROSS_VENUE";
  venueIds: readonly string[];
  claimSearchTerms: readonly string[];
  listingRefs?: readonly string[];
  confidenceBps: number;
  authority: "PROPOSE_ONLY";
  reviewStatus: "UNREVIEWED";
}>;

export type DiscoveryRun = Readonly<{
  runId: string;
  taskId: string;
  startedAt: string;
  completedAt: string;
  workerIds: readonly string[];
  hypotheses: readonly OpportunityHypothesis[];
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
}

export interface AiModelPort {
  completeStructured(input: {
    model: string;
    schemaVersion: "pmh.discovery-output.v1";
    system: string;
    task: DiscoveryTask;
  }): Promise<unknown>;
}

export type ModelProviderProjection = Readonly<{
  provider: "OPENAI_RESPONSES" | "DEEPSEEK_CHAT_COMPLETIONS";
  transport: "DIRECT_HTTP" | "VERCEL_AI_SDK";
  configured: boolean;
  credentialEnv: "OPENAI_API_KEY" | "DEEPSEEK_API_KEY";
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  reasoningEffort: "minimal" | "disabled";
  responseStorage: false | "PROVIDER_POLICY";
  authority: "PROPOSE_ONLY";
}>;

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
    schemaVersion: "pmh.studio-projection.v1";
    campaign: string;
    mode: "CONTROL_PLANE";
    stateHash: string;
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
    architecture: "SCOUT_THEN_VERIFY";
    activeRuns: number;
    catalogContext: DiscoveryCatalogProjection;
    catalogObservation: import("./catalog-observation.js").CatalogObservationProjection;
    opportunityRadar: import("./opportunity-radar.js").OpportunityRadarProjection;
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
  qualification: Readonly<{
    replayChaos: ReplayChaosReport;
    campaignEvidence: CampaignEvidenceBundle;
    reviewedCompilation: ReviewedCompilationEvidence;
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
