import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type {
  DiscoveryCatalogContext,
  DiscoveryRunRecord,
  DiscoveryTask,
  OperationalStorageProjection,
  OpportunityHypothesis,
} from "./types.js";
import type { SemanticGraphSearchContext } from "./semantic-relation-graph.js";

const ALGORITHM_VERSION = "pmh.ai-search-leases.v1";
const DEFAULT_RETENTION_LIMIT = 40;
const DEFAULT_DEADLINE_MS = 300_000;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const READ_ONLY_TOOLS = Object.freeze(["read", "grep", "find", "ls"] as const);

export const SEARCH_LENSES = Object.freeze([
  "EQUIVALENCE",
  "IMPLICATION",
  "PARTITION",
  "MECHANISM",
] as const);

export type SearchLens = (typeof SEARCH_LENSES)[number];

export type SearchLease = Readonly<{
  schemaVersion: "pmh.search-lease.v1";
  leaseId: Hash;
  algorithmVersion: typeof ALGORITHM_VERSION;
  snapshotIdentity: Hash;
  sourceSetIdentity: Hash;
  lens: SearchLens;
  thesis: string;
  noveltyTargets: readonly string[];
  scope: Readonly<{
    venueIds: readonly string[];
    closesAtMin: string | null;
    closesAtMax: string | null;
  }>;
  budget: Readonly<{
    maxFastModelRequests: number;
    maxPiInvocations: 0 | 1;
    maxHypotheses: number;
    deadlineMs: number;
  }>;
  issuedAt: string;
  deadlineAt: string;
  graphContext?: SemanticGraphSearchContext | null;
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type SearchLeaseFastLane = Readonly<{
  status: "NOT_RUN" | "PASS" | "FAILED";
  taskId: string;
  runId: string | null;
  workerIds: readonly string[];
  modelRequestCount: number;
  hypothesisIds: readonly string[];
  candidateListingRefs: readonly string[];
  diagnostic: string | null;
}>;

export type SearchLeaseDeepLane = Readonly<{
  status: "NOT_RUN" | "PASS" | "FAILED";
  reason:
    | "PENDING_FAST_LANE"
    | "NO_CANDIDATES"
    | "NOT_MULTI_LISTING"
    | "DUPLICATE"
    | "PI_DISABLED"
    | "NOVEL_MULTI_LISTING"
    | "NOVEL_MULTI_VENUE";
  runId: string | null;
  proposalIds: readonly string[];
  evidenceGaps: readonly string[];
  diagnostic: string | null;
  permittedTools: readonly ["read", "grep", "find", "ls"];
  toolExecutionTraceStored: false;
}>;

export type SearchLeaseRecord = Readonly<{
  schemaVersion: "pmh.search-lease-record.v1";
  lease: SearchLease;
  trigger: "OPERATOR" | "SCHEDULE";
  status: "ISSUED" | "PASS" | "FAILED";
  completedAt: string | null;
  diagnostic: string | null;
  fastLane: SearchLeaseFastLane;
  deepLane: SearchLeaseDeepLane;
  lineage: Readonly<{
    predecessorLeaseId: Hash | null;
    duplicateOfLeaseId: Hash | null;
    noveltySignature: Hash | null;
  }>;
  outcome: Readonly<{
    novelCandidate: boolean;
    hypothesisCount: number;
    proposalCount: number;
    evidenceGapCount: number;
  }>;
  trace: Readonly<{
    querySummary: string;
    chainOfThoughtStored: false;
  }>;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: Hash;
}>;

export interface SearchLeaseRecordStore {
  readonly searchLeaseStorage: OperationalStorageProjection<"leaseId">;
  loadSearchLeaseRecords(limit: number): readonly SearchLeaseRecord[];
  saveSearchLeaseRecord(
    record: SearchLeaseRecord,
    retentionLimit: number,
  ): SearchLeaseRecord;
}

export type SearchLeaseDeepResult = Readonly<{
  runId: string;
  status: "PASS" | "FAILED";
  proposalIds: readonly string[];
  evidenceGaps: readonly string[];
  diagnostic: string | null;
}>;

export type SearchLeaseSchedulerProjection = Readonly<{
  schemaVersion: "pmh.search-lease-scheduler.v1";
  algorithmVersion: typeof ALGORITHM_VERSION;
  enabled: boolean;
  configured: Readonly<{ fastLane: boolean; deepLane: boolean }>;
  status: "IDLE" | "RUNNING";
  intervalMs: number | null;
  retentionLimit: number;
  lensOrder: readonly SearchLens[];
  budget: SearchLease["budget"];
  runCount: number;
  passCount: number;
  failedCount: number;
  issuedCount: number;
  duplicateCount: number;
  piEscalationCount: number;
  storage: OperationalStorageProjection<"leaseId">;
  records: readonly SearchLeaseRecord[];
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: SearchLease["effects"];
}>;

type SearchLeaseOptions = Readonly<{
  intervalMs?: number | null;
  maxFastModelRequests?: number;
  maxPiInvocations?: 0 | 1;
  maxHypotheses?: number;
  deadlineMs?: number;
  retentionLimit?: number;
  store?: SearchLeaseRecordStore;
  context: (
    question: string,
    venueIds: readonly string[],
    lens: SearchLens,
    snapshot: MarketCorpusSnapshot,
  ) => DiscoveryCatalogContext;
  graphContext?: (
    snapshot: MarketCorpusSnapshot,
    lens: SearchLens,
  ) => SemanticGraphSearchContext;
  runFast: (
    task: DiscoveryTask,
    maxModelRequests: number,
  ) => Promise<DiscoveryRunRecord>;
  runDeep?: (
    snapshot: MarketCorpusSnapshot,
    question: string,
  ) => Promise<SearchLeaseDeepResult>;
  now?: () => number;
}>;

const LENS_SPEC: Readonly<Record<SearchLens, Readonly<{
  thesis: string;
  noveltyTargets: readonly string[];
  question: string;
}>>> = Object.freeze({
  EQUIVALENCE: Object.freeze({
    thesis: "Find differently worded listings that may resolve to the same claim.",
    noveltyTargets: Object.freeze(["cross-venue aliases", "rule-text mismatch", "resolution-source mismatch"]),
    question: "Find cross-venue listings that may encode the same real-world claim despite different wording. Ground every hypothesis in listing refs. Treat title similarity as search evidence only and surface rule, date, oracle, or void-policy mismatches.",
  }),
  IMPLICATION: Object.freeze({
    thesis: "Find claims where one outcome logically implies or is a subset of another.",
    noveltyTargets: Object.freeze(["subset", "one-way implication", "nested time window"]),
    question: "Find grounded cross-venue implication or subset structures, including nested thresholds and time windows. Do not assume converse implication. Return exact listing refs and identify the facts that could falsify the relationship.",
  }),
  PARTITION: Object.freeze({
    thesis: "Find outcomes that may form mutually exclusive or exhaustive payoff partitions.",
    noveltyTargets: Object.freeze(["mutual exclusion", "exhaustive range", "complete set"]),
    question: "Find grounded groups of listings that may be mutually exclusive or exhaustive partitions of one event. Check boundary gaps, overlaps, cancellation, and catch-all outcomes. Return exact listing refs; do not claim completeness from labels alone.",
  }),
  MECHANISM: Object.freeze({
    thesis: "Find apparent semantic matches whose market mechanisms create divergent payoffs.",
    noveltyTargets: Object.freeze(["oracle divergence", "void divergence", "timing divergence", "mechanism divergence"]),
    question: "Find cross-venue listings that look related but may diverge because of oracle, close time, settlement, void, denomination, or mechanism rules. Ground hypotheses in exact listing refs and state the missing rule evidence.",
  }),
});

function compactDiagnostic(value: unknown): string {
  const text = (value instanceof Error ? value.message : String(value))
    .trim()
    .replace(/\s+/gu, " ") || "search lease failed";
  return text.length <= 500 ? text : `${text.slice(0, 499).trimEnd()}…`;
}

function isIso(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function withArtifactHash(
  body: Omit<SearchLeaseRecord, "artifactHash">,
): SearchLeaseRecord {
  return deepFreeze({ ...body, artifactHash: hashCanonical(body) });
}

function withoutArtifactHash(
  record: SearchLeaseRecord,
): Omit<SearchLeaseRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

export function assertSearchLeaseRecord(value: unknown): SearchLeaseRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored search lease record is malformed");
  }
  const record = value as SearchLeaseRecord;
  const { artifactHash, ...body } = record;
  const lease = record.lease;
  const expectedLeaseId = lease === undefined ? "" : hashCanonical({
    schemaVersion: "pmh.search-lease-id.v1",
    algorithmVersion: ALGORITHM_VERSION,
    snapshotIdentity: lease.snapshotIdentity,
    lens: lease.lens,
  });
  const validHashOrNull = (item: unknown) =>
    item === null || HASH_PATTERN.test(String(item));
  const nonEmptyStrings = (items: unknown, limit: number) =>
    Array.isArray(items) && items.length <= limit &&
    items.every((item) => typeof item === "string" && item.trim() !== "");
  const graphContext = lease?.graphContext;
  const graphItemsValid = graphContext === undefined || graphContext === null ||
    graphContext.items.every((item) =>
      (item.proposalId === null || HASH_PATTERN.test(String(item.proposalId))) &&
      (item.relationKind === null || [
        "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE",
        "EXHAUSTIVE", "CONDITIONAL", "RELATED", "CONFLICTING",
      ].includes(item.relationKind)) &&
      nonEmptyStrings(item.listingRefs, 20) &&
      new Set(item.listingRefs).size === item.listingRefs.length &&
      Array.isArray(item.outcomeCodes) && item.outcomeCodes.length <= 9 &&
      item.outcomeCodes.every((code) => [
        "DUPLICATE", "SEMANTIC_REJECTED", "MISSING_RULE", "NO_DEPTH",
        "FEE_OR_MODEL_BLOCK", "EXACT_REJECTED", "CERTIFIED",
        "SHADOW_DIVERGENCE", "SHADOW_MATCHED",
      ].includes(code)) &&
      item.summary.trim() !== "" && item.summary.length <= 300
    );
  const graphContextValid = graphContext === undefined || graphContext === null || (
    graphContext.schemaVersion === "pmh.semantic-graph-search-context.v1" &&
    HASH_PATTERN.test(String(graphContext.graphIdentity)) &&
    HASH_PATTERN.test(String(graphContext.neighborhoodIdentity)) &&
    graphContext.lens === lease.lens &&
    Number.isSafeInteger(graphContext.relationCount) && graphContext.relationCount >= 0 &&
    Number.isSafeInteger(graphContext.feedbackCount) && graphContext.feedbackCount >= 0 &&
    Array.isArray(graphContext.items) && graphContext.items.length <= 12 &&
    graphItemsValid &&
    graphContext.neighborhoodIdentity === hashCanonical({
      graphIdentity: graphContext.graphIdentity,
      lens: graphContext.lens,
      items: graphContext.items,
    }) &&
    graphContext.searchBrief.trim() !== "" && graphContext.searchBrief.length <= 300 &&
    graphContext.priorityBasis === "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS" &&
    graphContext.modelConfidenceUsed === false &&
    graphContext.authority === "SEARCH_EVIDENCE_ONLY" &&
    graphContext.semanticDecisionAuthority === false &&
    graphContext.executionAuthority === false
  );
  if (
    record.schemaVersion !== "pmh.search-lease-record.v1" ||
    lease?.schemaVersion !== "pmh.search-lease.v1" ||
    lease.algorithmVersion !== ALGORITHM_VERSION ||
    !HASH_PATTERN.test(String(lease.leaseId)) ||
    lease.leaseId !== expectedLeaseId ||
    !HASH_PATTERN.test(String(lease.snapshotIdentity)) ||
    !HASH_PATTERN.test(String(lease.sourceSetIdentity)) ||
    !SEARCH_LENSES.includes(lease.lens) ||
    !isIso(lease.issuedAt) ||
    !isIso(lease.deadlineAt) ||
    Date.parse(lease.deadlineAt) < Date.parse(lease.issuedAt) ||
    Date.parse(lease.deadlineAt) - Date.parse(lease.issuedAt) !== lease.budget.deadlineMs ||
    lease.thesis.trim() === "" || lease.thesis.length > 500 ||
    !nonEmptyStrings(lease.noveltyTargets, 12) ||
    !nonEmptyStrings(lease.scope?.venueIds, 25) ||
    new Set(lease.scope.venueIds).size !== lease.scope.venueIds.length ||
    lease.authority !== "PROPOSE_ONLY" ||
    lease.semanticDecisionAuthority !== false ||
    lease.certificateAuthority !== false ||
    lease.executionAuthority !== false ||
    !graphContextValid ||
    !Number.isSafeInteger(lease.budget.maxFastModelRequests) ||
    lease.budget.maxFastModelRequests < 0 ||
    lease.budget.maxFastModelRequests > 4 ||
    (lease.budget.maxPiInvocations !== 0 && lease.budget.maxPiInvocations !== 1) ||
    !Number.isSafeInteger(lease.budget.maxHypotheses) ||
    lease.budget.maxHypotheses < 1 || lease.budget.maxHypotheses > 20 ||
    !Number.isSafeInteger(lease.budget.deadlineMs) ||
    lease.budget.deadlineMs < 10_000 || lease.budget.deadlineMs > 600_000 ||
    (record.status !== "ISSUED" && record.status !== "PASS" && record.status !== "FAILED") ||
    (record.status === "ISSUED" ? record.completedAt !== null : !isIso(record.completedAt)) ||
    (record.completedAt !== null && Date.parse(record.completedAt) < Date.parse(lease.issuedAt)) ||
    (record.trigger !== "OPERATOR" && record.trigger !== "SCHEDULE") ||
    record.fastLane.taskId !== `search-lease:${lease.leaseId.slice(7)}` ||
    !nonEmptyStrings(record.fastLane.workerIds, 16) ||
    !nonEmptyStrings(record.fastLane.hypothesisIds, lease.budget.maxHypotheses) ||
    !nonEmptyStrings(record.fastLane.candidateListingRefs, 100) ||
    !Number.isSafeInteger(record.fastLane.modelRequestCount) ||
    record.fastLane.modelRequestCount < 0 ||
    (record.fastLane.status !== "NOT_RUN" && record.fastLane.status !== "PASS" && record.fastLane.status !== "FAILED") ||
    (record.deepLane.status !== "NOT_RUN" && record.deepLane.status !== "PASS" && record.deepLane.status !== "FAILED") ||
    !([
      "PENDING_FAST_LANE",
      "NO_CANDIDATES",
      "NOT_MULTI_LISTING",
      "DUPLICATE",
      "PI_DISABLED",
      "NOVEL_MULTI_LISTING",
      "NOVEL_MULTI_VENUE",
    ] as const).includes(record.deepLane.reason) ||
    !READ_ONLY_TOOLS.every((tool, index) => record.deepLane.permittedTools[index] === tool) ||
    record.deepLane.permittedTools.length !== READ_ONLY_TOOLS.length ||
    !nonEmptyStrings(record.deepLane.proposalIds, 5) ||
    !nonEmptyStrings(record.deepLane.evidenceGaps, 20) ||
    !validHashOrNull(record.lineage.predecessorLeaseId) ||
    !validHashOrNull(record.lineage.duplicateOfLeaseId) ||
    !validHashOrNull(record.lineage.noveltySignature) ||
    !Number.isSafeInteger(record.outcome.hypothesisCount) ||
    !Number.isSafeInteger(record.outcome.proposalCount) ||
    !Number.isSafeInteger(record.outcome.evidenceGapCount) ||
    record.outcome.hypothesisCount < 0 ||
    record.outcome.proposalCount < 0 ||
    record.outcome.evidenceGapCount < 0 ||
    (record.status !== "ISSUED" &&
      (record.outcome.hypothesisCount !== record.fastLane.hypothesisIds.length ||
        record.outcome.proposalCount !== record.deepLane.proposalIds.length ||
        record.outcome.evidenceGapCount !== record.deepLane.evidenceGaps.length)) ||
    (record.status === "ISSUED" &&
      (record.fastLane.status !== "NOT_RUN" ||
        record.deepLane.reason !== "PENDING_FAST_LANE" ||
        record.outcome.hypothesisCount !== 0 ||
        record.outcome.proposalCount !== 0)) ||
    record.trace.querySummary.trim() === "" || record.trace.querySummary.length > 500 ||
    record.semanticDecisionAuthority !== false ||
    record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    record.trace?.chainOfThoughtStored !== false ||
    record.deepLane?.toolExecutionTraceStored !== false ||
    record.fastLane?.modelRequestCount > lease.budget.maxFastModelRequests ||
    record.outcome?.hypothesisCount > lease.budget.maxHypotheses ||
    record.outcome?.proposalCount > 5 ||
    record.effects?.externalWrites !== false ||
    record.effects?.valueMovingActions !== false ||
    record.effects?.liveExecutionEnabled !== false ||
    !HASH_PATTERN.test(String(artifactHash)) ||
    artifactHash !== hashCanonical(body)
  ) {
    throw new Error("stored search lease record violates its bounded authority contract");
  }
  return deepFreeze(record);
}

function candidateSignature(hypotheses: readonly OpportunityHypothesis[]): Hash | null {
  const grounded = hypotheses
    .filter((item) => (item.listingRefs?.length ?? 0) > 0)
    .map((item) => ({
      strategyKind: item.strategyKind,
      listingRefs: [...(item.listingRefs ?? [])].sort(),
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return grounded.length === 0 ? null : hashCanonical(grounded);
}

function hasMultiListingCandidate(
  hypotheses: readonly OpportunityHypothesis[],
): boolean {
  return hypotheses.some(
    (item) => (item.listingRefs?.length ?? 0) >= 2,
  );
}

function scopeFor(snapshot: MarketCorpusSnapshot): SearchLease["scope"] {
  const closes = snapshot.listings
    .map((listing) => listing.closesAt)
    .filter((value): value is string => value !== null)
    .sort();
  return Object.freeze({
    venueIds: Object.freeze([...new Set(snapshot.listings.map((item) => item.venueId))].sort()),
    closesAtMin: closes[0] ?? null,
    closesAtMax: closes.at(-1) ?? null,
  });
}

export class SearchLeaseBusyError extends Error {}
export class SearchLeaseUnavailableError extends Error {}

export class SearchLeaseScheduler {
  readonly #records: SearchLeaseRecord[];
  readonly #budget: SearchLease["budget"];
  readonly #retentionLimit: number;
  readonly #store: SearchLeaseRecordStore | undefined;
  readonly #context: SearchLeaseOptions["context"];
  readonly #runFast: SearchLeaseOptions["runFast"];
  readonly #runDeep: SearchLeaseOptions["runDeep"] | undefined;
  readonly #graphContext: SearchLeaseOptions["graphContext"] | undefined;
  readonly #now: () => number;
  #active: Promise<SearchLeaseRecord> | null = null;

  public readonly intervalMs: number | null;

  public constructor(options: SearchLeaseOptions) {
    this.intervalMs = options.intervalMs ?? null;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    this.#store = options.store;
    this.#context = options.context;
    this.#runFast = options.runFast;
    this.#runDeep = options.runDeep;
    this.#graphContext = options.graphContext;
    this.#now = options.now ?? Date.now;
    this.#budget = Object.freeze({
      maxFastModelRequests: options.maxFastModelRequests ?? 1,
      maxPiInvocations: options.maxPiInvocations ?? 1,
      maxHypotheses: options.maxHypotheses ?? 8,
      deadlineMs: options.deadlineMs ?? DEFAULT_DEADLINE_MS,
    });
    if (
      (this.intervalMs !== null &&
        (!Number.isSafeInteger(this.intervalMs) || this.intervalMs < 60_000 || this.intervalMs > 86_400_000)) ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 4 ||
      !Number.isSafeInteger(this.#budget.maxFastModelRequests) ||
      this.#budget.maxFastModelRequests < 0 || this.#budget.maxFastModelRequests > 4 ||
      (this.#budget.maxPiInvocations !== 0 && this.#budget.maxPiInvocations !== 1) ||
      !Number.isSafeInteger(this.#budget.maxHypotheses) ||
      this.#budget.maxHypotheses < 1 || this.#budget.maxHypotheses > 20 ||
      !Number.isSafeInteger(this.#budget.deadlineMs) ||
      this.#budget.deadlineMs < 10_000 || this.#budget.deadlineMs > 600_000
    ) {
      throw new Error("search lease scheduler configuration is invalid or unbounded");
    }
    this.#records = [
      ...(this.#store?.loadSearchLeaseRecords(this.#retentionLimit) ?? []),
    ].map(assertSearchLeaseRecord);
  }

  public shouldSchedule(snapshot: MarketCorpusSnapshot): boolean {
    return this.intervalMs !== null && this.#active === null &&
      snapshot.listingCount > 0 && this.#nextLens(snapshot) !== null;
  }

  public begin(
    snapshot: MarketCorpusSnapshot,
    lens?: SearchLens,
    trigger: "OPERATOR" | "SCHEDULE" = "OPERATOR",
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    if (snapshot.listingCount === 0) {
      throw new SearchLeaseUnavailableError("search lease requires a non-empty qualified corpus");
    }
    const selectedLens = lens ?? this.#nextLens(snapshot);
    if (selectedLens === null) {
      throw new SearchLeaseUnavailableError("all search lenses are complete for this corpus snapshot");
    }
    if (!SEARCH_LENSES.includes(selectedLens)) {
      throw new SearchLeaseUnavailableError("search lease lens is invalid");
    }
    const leaseId = hashCanonical({
      schemaVersion: "pmh.search-lease-id.v1",
      algorithmVersion: ALGORITHM_VERSION,
      snapshotIdentity: snapshot.snapshotIdentity,
      lens: selectedLens,
    });
    const existing = this.#records.find((record) => record.lease.leaseId === leaseId);
    if (existing !== undefined && existing.status !== "ISSUED") {
      return Object.freeze({ promise: Promise.resolve(existing), idempotentReplay: true });
    }
    if (this.#active !== null) {
      throw new SearchLeaseBusyError("another search lease is already active");
    }
    const spec = LENS_SPEC[selectedLens];
    let issued = existing;
    if (issued === undefined) {
      const issuedAtMs = this.#now();
      const predecessorLeaseId = this.#records.find(
        (record) => record.lease.snapshotIdentity === snapshot.snapshotIdentity,
      )?.lease.leaseId ?? null;
      const scope = scopeFor(snapshot);
      const graphContext = this.#graphContext?.(snapshot, selectedLens) ?? null;
      const querySummary = graphContext === null
        ? spec.question
        : `${spec.question} Graph neighborhood: ${graphContext.searchBrief}`.slice(0, 500);
      const lease: SearchLease = deepFreeze({
        schemaVersion: "pmh.search-lease.v1" as const,
        leaseId,
        algorithmVersion: ALGORITHM_VERSION,
        snapshotIdentity: snapshot.snapshotIdentity,
        sourceSetIdentity: snapshot.sourceSetIdentity,
        lens: selectedLens,
        thesis: spec.thesis,
        noveltyTargets: spec.noveltyTargets,
        scope,
        budget: this.#budget,
        issuedAt: new Date(issuedAtMs).toISOString(),
        deadlineAt: new Date(issuedAtMs + this.#budget.deadlineMs).toISOString(),
        graphContext,
        authority: "PROPOSE_ONLY" as const,
        semanticDecisionAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          externalWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      });
      issued = withArtifactHash({
        schemaVersion: "pmh.search-lease-record.v1",
        lease,
        trigger,
        status: "ISSUED",
        completedAt: null,
        diagnostic: null,
        fastLane: Object.freeze({
          status: "NOT_RUN",
          taskId: `search-lease:${leaseId.slice(7)}`,
          runId: null,
          workerIds: Object.freeze([]),
          modelRequestCount: 0,
          hypothesisIds: Object.freeze([]),
          candidateListingRefs: Object.freeze([]),
          diagnostic: null,
        }),
        deepLane: Object.freeze({
          status: "NOT_RUN",
          reason: "PENDING_FAST_LANE",
          runId: null,
          proposalIds: Object.freeze([]),
          evidenceGaps: Object.freeze([]),
          diagnostic: null,
          permittedTools: READ_ONLY_TOOLS,
          toolExecutionTraceStored: false,
        }),
        lineage: Object.freeze({ predecessorLeaseId, duplicateOfLeaseId: null, noveltySignature: null }),
        outcome: Object.freeze({ novelCandidate: false, hypothesisCount: 0, proposalCount: 0, evidenceGapCount: 0 }),
        trace: Object.freeze({ querySummary, chainOfThoughtStored: false }),
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
        effects: lease.effects,
      });
      issued = this.#persist(issued);
    }
    const promise = this.#execute(snapshot, issued).then((record) => {
      this.#active = null;
      return record;
    });
    this.#active = promise;
    return Object.freeze({ promise, idempotentReplay: false });
  }

  async #execute(
    snapshot: MarketCorpusSnapshot,
    issued: SearchLeaseRecord,
  ): Promise<SearchLeaseRecord> {
    try {
      const context = this.#context(
        issued.trace.querySummary,
        issued.lease.scope.venueIds,
        issued.lease.lens,
        snapshot,
      );
      const task: DiscoveryTask = Object.freeze({
        taskId: issued.fastLane.taskId,
        question: issued.trace.querySummary,
        venueIds: issued.lease.scope.venueIds,
        maxHypotheses: issued.lease.budget.maxHypotheses,
        deadlineEpochMs: Date.parse(issued.lease.deadlineAt),
        catalogContext: context,
      });
      const run = await this.#runFast(task, issued.lease.budget.maxFastModelRequests);
      const modelRequestCount = run.workerReports?.filter((report) => report.kind === "MODEL").length ?? 0;
      if (modelRequestCount > issued.lease.budget.maxFastModelRequests) {
        throw new Error("fast lane exceeded its model request budget");
      }
      const signature = candidateSignature(run.hypotheses);
      const duplicate = signature === null ? undefined : this.#records.find(
        (record) =>
          record.status === "PASS" &&
          record.lease.leaseId !== issued.lease.leaseId &&
          record.lineage.noveltySignature === signature,
      );
      const listingRefs = Object.freeze([...new Set(
        run.hypotheses.flatMap((item) => item.listingRefs ?? []),
      )].sort());
      const fastLane: SearchLeaseFastLane = Object.freeze({
        status: "PASS",
        taskId: task.taskId,
        runId: run.runId,
        workerIds: Object.freeze([...run.workerIds]),
        modelRequestCount,
        hypothesisIds: Object.freeze(run.hypotheses.map((item) => item.hypothesisId)),
        candidateListingRefs: listingRefs,
        diagnostic: run.diagnostics.length === 0 ? null : compactDiagnostic(run.diagnostics.join("; ")),
      });
      let deepLane: SearchLeaseDeepLane;
      if (signature === null) {
        deepLane = this.#skippedDeep("NO_CANDIDATES");
      } else if (!hasMultiListingCandidate(run.hypotheses)) {
        deepLane = this.#skippedDeep("NOT_MULTI_LISTING");
      } else if (duplicate !== undefined) {
        deepLane = this.#skippedDeep("DUPLICATE");
      } else if (issued.lease.budget.maxPiInvocations === 0 || this.#runDeep === undefined) {
        deepLane = this.#skippedDeep("PI_DISABLED");
      } else {
        const deepQuestion = [
          issued.lease.thesis,
          `Inspect these fast-lane candidates: ${listingRefs.join(", ")}.`,
          ...(issued.lease.graphContext === null || issued.lease.graphContext === undefined
            ? []
            : [`Prior content-addressed graph evidence: ${issued.lease.graphContext.searchBrief}`]),
          "Use the whole immutable MarketFS snapshot to find corroborating or falsifying rule evidence. Return proposals only; do not make a semantic approval or trading decision.",
        ].join(" ").slice(0, 1_000);
        const result = await this.#runDeep(snapshot, deepQuestion);
        deepLane = Object.freeze({
          status: result.status,
          reason: "NOVEL_MULTI_LISTING",
          runId: result.runId,
          proposalIds: Object.freeze([...result.proposalIds].slice(0, 5)),
          evidenceGaps: Object.freeze([...result.evidenceGaps].slice(0, 20)),
          diagnostic: result.diagnostic,
          permittedTools: READ_ONLY_TOOLS,
          toolExecutionTraceStored: false,
        });
      }
      const completedAt = new Date(Math.max(this.#now(), Date.parse(issued.lease.issuedAt))).toISOString();
      return this.#persist(withArtifactHash({
        ...withoutArtifactHash(issued),
        status: deepLane.status === "FAILED" ? "FAILED" : "PASS",
        completedAt,
        diagnostic: deepLane.status === "FAILED" ? deepLane.diagnostic ?? "deep search failed" : null,
        fastLane,
        deepLane,
        lineage: Object.freeze({
          ...issued.lineage,
          duplicateOfLeaseId: duplicate?.lease.leaseId ?? null,
          noveltySignature: signature,
        }),
        outcome: Object.freeze({
          novelCandidate: signature !== null && duplicate === undefined,
          hypothesisCount: run.hypotheses.length,
          proposalCount: deepLane.proposalIds.length,
          evidenceGapCount: deepLane.evidenceGaps.length,
        }),
      }));
    } catch (error) {
      const diagnostic = compactDiagnostic(error);
      return this.#persist(withArtifactHash({
        ...withoutArtifactHash(issued),
        status: "FAILED",
        completedAt: new Date(Math.max(this.#now(), Date.parse(issued.lease.issuedAt))).toISOString(),
        diagnostic,
        fastLane: Object.freeze({ ...issued.fastLane, status: "FAILED", diagnostic }),
        deepLane: this.#skippedDeep("PENDING_FAST_LANE"),
      }));
    }
  }

  #skippedDeep(reason: SearchLeaseDeepLane["reason"]): SearchLeaseDeepLane {
    return Object.freeze({
      status: "NOT_RUN",
      reason,
      runId: null,
      proposalIds: Object.freeze([]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
      permittedTools: READ_ONLY_TOOLS,
      toolExecutionTraceStored: false,
    });
  }

  #nextLens(snapshot: MarketCorpusSnapshot): SearchLens | null {
    const resumable = this.#records.find(
      (record) =>
        record.status === "ISSUED" &&
        record.lease.snapshotIdentity === snapshot.snapshotIdentity,
    );
    if (resumable !== undefined) return resumable.lease.lens;
    return SEARCH_LENSES.find(
      (lens) => !this.#records.some(
        (record) => record.lease.snapshotIdentity === snapshot.snapshotIdentity && record.lease.lens === lens,
      ),
    ) ?? null;
  }

  #persist(record: SearchLeaseRecord): SearchLeaseRecord {
    const validated = assertSearchLeaseRecord(record);
    const stored = this.#store?.saveSearchLeaseRecord(validated, this.#retentionLimit) ?? validated;
    const index = this.#records.findIndex((item) => item.lease.leaseId === stored.lease.leaseId);
    if (index >= 0) this.#records.splice(index, 1);
    this.#records.unshift(stored);
    if (this.#records.length > this.#retentionLimit) this.#records.length = this.#retentionLimit;
    return stored;
  }

  public projection(): SearchLeaseSchedulerProjection {
    const records = Object.freeze([...this.#records]);
    return Object.freeze({
      schemaVersion: "pmh.search-lease-scheduler.v1",
      algorithmVersion: ALGORITHM_VERSION,
      enabled: this.intervalMs !== null,
      configured: Object.freeze({ fastLane: true, deepLane: this.#runDeep !== undefined }),
      status: this.#active === null ? "IDLE" : "RUNNING",
      intervalMs: this.intervalMs,
      retentionLimit: this.#retentionLimit,
      lensOrder: SEARCH_LENSES,
      budget: this.#budget,
      runCount: records.filter((record) => record.status !== "ISSUED").length,
      passCount: records.filter((record) => record.status === "PASS").length,
      failedCount: records.filter((record) => record.status === "FAILED").length,
      issuedCount: records.filter((record) => record.status === "ISSUED").length,
      duplicateCount: records.filter((record) => record.lineage.duplicateOfLeaseId !== null).length,
      piEscalationCount: records.filter((record) => record.deepLane.runId !== null).length,
      storage: this.#store?.searchLeaseStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false as const,
        schemaVersion: 0,
        idempotencyKey: "leaseId" as const,
      }),
      records,
      authority: "PROPOSE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({ externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false }),
    });
  }
}

export function parseSearchLeaseInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_SEARCH_LEASE_INTERVAL_MS?.trim() ||
    environment.PMH_ARCHAEOLOGIST_INTERVAL_MS?.trim() || "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 60_000 || value > 86_400_000) {
    throw new Error("PMH_SEARCH_LEASE_INTERVAL_MS must be 0 or an integer from 60000 to 86400000");
  }
  return value;
}
