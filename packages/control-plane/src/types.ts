export type DiscoveryTask = Readonly<{
  taskId: string;
  question: string;
  venueIds: readonly string[];
  maxHypotheses: number;
  deadlineEpochMs: number;
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
  }>;

export type DiscoveryDeskProjection = Readonly<{
  retentionLimit: number;
  runCount: number;
  hypothesisCount: number;
  unreviewedCount: number;
  storage: OperationalStorageProjection;
  runs: readonly DiscoveryRunRecord[];
}>;

export type OperationalStorageProjection = Readonly<{
  mode: "MEMORY" | "SQLITE_WAL";
  durable: boolean;
  schemaVersion: number;
  idempotencyKey: "taskId";
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
    workers: readonly Readonly<{
      workerId: string;
      kind: "HEURISTIC" | "MODEL";
      costTier: "FREE" | "LOW";
      status: "READY" | "NEEDS_PROVIDER";
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
