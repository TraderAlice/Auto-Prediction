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
  venues: readonly Readonly<{
    id: string;
    name: string;
    mechanism: string;
    stage: "DISCOVER";
    health: number;
    color: string;
    protocolIdentity: string;
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
  }>[];
  trace: readonly (readonly [string, "PASS" | "BLOCKED", string])[];
  capital: readonly Readonly<{
    venue: string;
    available: number;
    reserved: number;
    locked: number;
  }>[];
  payoffStates: readonly Readonly<{ label: string; value: number }>[];
}>;
