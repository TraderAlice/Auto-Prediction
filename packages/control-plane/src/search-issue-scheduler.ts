import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  SEARCH_LENSES,
  SearchLeaseBusyError,
  SearchLeaseScheduler,
  type SearchLeaseRecord,
  type SearchLens,
  type SearchCandidatePolicy,
} from "./search-lease-scheduler.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 100;

export type SearchIssueRecord = Readonly<{
  schemaVersion: "pmh.search-issue.v1";
  issueId: Hash;
  candidatePolicy?: SearchCandidatePolicy | null;
  title: string;
  question: string;
  lens: SearchLens;
  venueIds: readonly string[];
  cadenceMs: number;
  priority: 1 | 2 | 3 | 4 | 5;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastLeaseId: Hash | null;
  runCount: number;
  passCount: number;
  failedCount: number;
  artifactHash: Hash;
}>;

export type SearchNotificationRecord = Readonly<{
  schemaVersion: "pmh.search-notification.v1";
  notificationId: Hash;
  dedupeIdentity: Hash;
  issueId: Hash;
  leaseId: Hash;
  kind: "NOVEL_CANDIDATE" | "RUN_FAILED";
  status: "UNREAD" | "READ";
  title: string;
  summary: string;
  createdAt: string;
  readAt: string | null;
  artifactHash: Hash;
}>;

export interface SearchIssueRecordStore {
  readonly searchIssueStorage: OperationalStorageProjection<"issueId">;
  readonly searchNotificationStorage: OperationalStorageProjection<"notificationId">;
  loadSearchIssueRecords(limit: number): readonly SearchIssueRecord[];
  saveSearchIssueRecord(record: SearchIssueRecord): SearchIssueRecord;
  loadSearchNotificationRecords(limit: number): readonly SearchNotificationRecord[];
  saveSearchNotificationRecord(
    record: SearchNotificationRecord,
    retentionLimit: number,
  ): SearchNotificationRecord;
}

export type SearchIssueSchedulerProjection = Readonly<{
  schemaVersion: "pmh.search-issue-scheduler.v1";
  enabled: boolean;
  status: "IDLE" | "RUNNING";
  tickIntervalMs: number | null;
  concurrencyLimit: number;
  activeCount: number;
  issueCount: number;
  enabledIssueCount: number;
  dueIssueCount: number;
  unreadNotificationCount: number;
  performance: Readonly<{
    measurementWindow: "RETAINED_TERMINAL_LEASES";
    retainedLeaseLimit: number;
    terminalLeaseCount: number;
    novelCandidateCount: number;
    duplicateCount: number;
    piEscalationCount: number;
    economicGateRequiredCount: number;
    economicGatePositiveCount: number;
    economicGateBlockedCount: number;
    piAvoidedCount: number;
    modelSelectionRequiredCount: number;
    modelSelectedCandidateCount: number;
    modelSelectionMissCount: number;
    exactSemanticScopeCount: number;
    semanticScopeRevisitCount: number;
    noLeadSemanticScopeCount: number;
    boundedSemanticScopeCount: number;
    boundedScopeRevisitCount: number;
    noLeadBoundedScopeCount: number;
    hypothesisCount: number;
    proposalCount: number;
    evidenceGapCount: number;
    novelCandidateRateBps: number | null;
    duplicateRateBps: number | null;
    piEscalationRateBps: number | null;
    economicGatePositiveRateBps: number | null;
    byIssue: readonly Readonly<{
      issueId: Hash;
      terminalLeaseCount: number;
      novelCandidateCount: number;
      duplicateCount: number;
      piEscalationCount: number;
      economicGateRequiredCount: number;
      economicGatePositiveCount: number;
      economicGateBlockedCount: number;
      piAvoidedCount: number;
      modelSelectionRequiredCount: number;
      modelSelectedCandidateCount: number;
      modelSelectionMissCount: number;
      exactSemanticScopeCount: number;
      semanticScopeRevisitCount: number;
      noLeadSemanticScopeCount: number;
      boundedSemanticScopeCount: number;
      boundedScopeRevisitCount: number;
      noLeadBoundedScopeCount: number;
      hypothesisCount: number;
      proposalCount: number;
      evidenceGapCount: number;
    }>[];
  }>;
  issues: readonly SearchIssueRecord[];
  notifications: readonly SearchNotificationRecord[];
  storage: Readonly<{
    issues: OperationalStorageProjection<"issueId">;
    notifications: OperationalStorageProjection<"notificationId">;
  }>;
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

export type CreateSearchIssueInput = Readonly<{
  title: string;
  question: string;
  lens: SearchLens;
  venueIds?: readonly string[];
  cadenceMs: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  enabled?: boolean;
}>;

type SearchIssueSchedulerOptions = Readonly<{
  leaseScheduler: SearchLeaseScheduler;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  retentionLimit?: number;
  store?: SearchIssueRecordStore;
  seedDefaults?: boolean;
  now?: () => number;
}>;

function isIso(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

function ratioBps(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.floor((numerator * 10_000) / denominator);
}

function summarizeLeasePerformance(records: readonly SearchLeaseRecord[]): Readonly<{
  terminalLeaseCount: number;
  novelCandidateCount: number;
  duplicateCount: number;
  piEscalationCount: number;
  economicGateRequiredCount: number;
  economicGatePositiveCount: number;
  economicGateBlockedCount: number;
  piAvoidedCount: number;
  modelSelectionRequiredCount: number;
  modelSelectedCandidateCount: number;
  modelSelectionMissCount: number;
  exactSemanticScopeCount: number;
  semanticScopeRevisitCount: number;
  noLeadSemanticScopeCount: number;
  boundedSemanticScopeCount: number;
  boundedScopeRevisitCount: number;
  noLeadBoundedScopeCount: number;
  hypothesisCount: number;
  proposalCount: number;
  evidenceGapCount: number;
}> {
  const exactScopes = records.filter(
    (record) => record.fastLane.semanticScope?.kind === "EXACT_PAIR",
  );
  const uniqueSemanticScopes = new Set(
    exactScopes.map(
      (record) =>
        `${record.lease.issueId ?? "unassigned"}:` +
        record.fastLane.semanticScope!.semanticScopeIdentity,
    ),
  );
  const boundedScopes = records.filter(
    (record) => record.fastLane.semanticScope?.kind === "BOUNDED_CONTEXT",
  );
  const uniqueBoundedScopes = new Set(
    boundedScopes.map(
      (record) =>
        `${record.lease.issueId ?? "unassigned"}:` +
        record.fastLane.semanticScope!.semanticScopeIdentity,
    ),
  );
  const noLeadReasons = [
    "NO_CANDIDATES",
    "NOT_MULTI_LISTING",
    "NO_POLICY_MATCH",
  ];
  const modelSelectionRecords = records.filter(
    (record) =>
      record.lease.candidatePolicy?.candidateSelection === "MODEL_HYPOTHESIS",
  );
  const modelSelectedRecords = modelSelectionRecords.filter((record) =>
    record.fastLane.candidateListingRefs.length ===
      record.lease.candidatePolicy?.exactListingRefCount
  );
  return Object.freeze({
    terminalLeaseCount: records.length,
    novelCandidateCount: records.filter((record) => record.outcome.novelCandidate).length,
    duplicateCount: records.filter((record) => record.lineage.duplicateOfLeaseId !== null).length,
    piEscalationCount: records.filter((record) => record.deepLane.runId !== null).length,
    economicGateRequiredCount: records.filter(
      (record) => record.fastLane.economicGate?.required === true,
    ).length,
    economicGatePositiveCount: records.filter(
      (record) => record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT",
    ).length,
    economicGateBlockedCount: records.filter(
      (record) => record.fastLane.economicGate?.required === true &&
        record.fastLane.economicGate.status !== "NOT_RUN" &&
        record.fastLane.economicGate.status !== "POSITIVE_GROSS_HINT",
    ).length,
    piAvoidedCount: records.filter(
      (record) => record.deepLane.reason === "ECONOMIC_GATE_BLOCKED" &&
        record.deepLane.runId === null,
    ).length,
    modelSelectionRequiredCount: modelSelectionRecords.length,
    modelSelectedCandidateCount: modelSelectedRecords.length,
    modelSelectionMissCount:
      modelSelectionRecords.length - modelSelectedRecords.length,
    exactSemanticScopeCount: uniqueSemanticScopes.size,
    semanticScopeRevisitCount: exactScopes.length - uniqueSemanticScopes.size,
    noLeadSemanticScopeCount: exactScopes.filter((record) =>
      noLeadReasons.includes(record.deepLane.reason)
    ).length,
    boundedSemanticScopeCount: uniqueBoundedScopes.size,
    boundedScopeRevisitCount: boundedScopes.length - uniqueBoundedScopes.size,
    noLeadBoundedScopeCount: boundedScopes.filter((record) =>
      noLeadReasons.includes(record.deepLane.reason)
    ).length,
    hypothesisCount: records.reduce((sum, record) => sum + record.outcome.hypothesisCount, 0),
    proposalCount: records.reduce((sum, record) => sum + record.outcome.proposalCount, 0),
    evidenceGapCount: records.reduce((sum, record) => sum + record.outcome.evidenceGapCount, 0),
  });
}

function hashRecord<T extends { artifactHash: Hash }>(record: T): Hash {
  const { artifactHash: _artifactHash, ...body } = record;
  return hashCanonical(body);
}

function withIssueHash(
  body: Omit<SearchIssueRecord, "artifactHash">,
): SearchIssueRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withNotificationHash(
  body: Omit<SearchNotificationRecord, "artifactHash">,
): SearchNotificationRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertSearchIssueRecord(value: unknown): SearchIssueRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored search issue is malformed");
  }
  const record = value as SearchIssueRecord;
  const candidatePolicy = record.candidatePolicy;
  const candidatePolicyValid = candidatePolicy === undefined || candidatePolicy === null || (
    Array.isArray(candidatePolicy.allowedRelationKinds) &&
    candidatePolicy.allowedRelationKinds.length > 0 &&
    candidatePolicy.allowedRelationKinds.length <= 8 &&
    new Set(candidatePolicy.allowedRelationKinds).size === candidatePolicy.allowedRelationKinds.length &&
    candidatePolicy.allowedRelationKinds.every((kind) => [
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "RELATED", "CONFLICTING",
    ].includes(kind)) &&
    Number.isSafeInteger(candidatePolicy.exactListingRefCount) &&
    candidatePolicy.exactListingRefCount >= 2 &&
    candidatePolicy.exactListingRefCount <= 8 &&
    (candidatePolicy.requirePositiveGrossHint === undefined ||
      typeof candidatePolicy.requirePositiveGrossHint === "boolean") &&
    (candidatePolicy.candidateSelection === undefined ||
      candidatePolicy.candidateSelection === "EXACT_CONTEXT" ||
      candidatePolicy.candidateSelection === "MODEL_HYPOTHESIS") &&
    (candidatePolicy.requireDistinctVenues === undefined ||
      typeof candidatePolicy.requireDistinctVenues === "boolean") &&
    (candidatePolicy.requirePositiveGrossHint !== true ||
      (candidatePolicy.exactListingRefCount === 2 &&
        candidatePolicy.allowedRelationKinds.length === 1 &&
        ["EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE"]
          .includes(candidatePolicy.allowedRelationKinds[0] ?? "")))
  );
  if (
    record.schemaVersion !== "pmh.search-issue.v1" ||
    !HASH_PATTERN.test(String(record.issueId)) ||
    !boundedText(record.title, 120) ||
    !boundedText(record.question, 1_000) ||
    !candidatePolicyValid ||
    !SEARCH_LENSES.includes(record.lens) ||
    !Array.isArray(record.venueIds) || record.venueIds.length > 25 ||
    record.venueIds.some((item) => !boundedText(item, 100)) ||
    new Set(record.venueIds).size !== record.venueIds.length ||
    !Number.isSafeInteger(record.cadenceMs) ||
    record.cadenceMs < 60_000 || record.cadenceMs > 604_800_000 ||
    ![1, 2, 3, 4, 5].includes(record.priority) ||
    typeof record.enabled !== "boolean" ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) || !isIso(record.nextRunAt) ||
    (record.lastStartedAt !== null && !isIso(record.lastStartedAt)) ||
    (record.lastCompletedAt !== null && !isIso(record.lastCompletedAt)) ||
    (record.lastLeaseId !== null && !HASH_PATTERN.test(String(record.lastLeaseId))) ||
    !Number.isSafeInteger(record.runCount) || record.runCount < 0 ||
    !Number.isSafeInteger(record.passCount) || record.passCount < 0 ||
    !Number.isSafeInteger(record.failedCount) || record.failedCount < 0 ||
    record.passCount + record.failedCount !== record.runCount ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashRecord(record)
  ) {
    throw new Error("stored search issue violates its bounded contract");
  }
  return Object.freeze(record);
}

export function assertSearchNotificationRecord(
  value: unknown,
): SearchNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored search notification is malformed");
  }
  const record = value as SearchNotificationRecord;
  if (
    record.schemaVersion !== "pmh.search-notification.v1" ||
    !HASH_PATTERN.test(String(record.notificationId)) ||
    !HASH_PATTERN.test(String(record.dedupeIdentity)) ||
    !HASH_PATTERN.test(String(record.issueId)) ||
    !HASH_PATTERN.test(String(record.leaseId)) ||
    (record.kind !== "NOVEL_CANDIDATE" && record.kind !== "RUN_FAILED") ||
    (record.status !== "UNREAD" && record.status !== "READ") ||
    !boundedText(record.title, 160) || !boundedText(record.summary, 500) ||
    !isIso(record.createdAt) ||
    (record.readAt !== null && !isIso(record.readAt)) ||
    (record.status === "UNREAD" ? record.readAt !== null : record.readAt === null) ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashRecord(record)
  ) {
    throw new Error("stored search notification violates its bounded contract");
  }
  return Object.freeze(record);
}

const DEFAULT_ISSUES = Object.freeze([
  Object.freeze({
    key: "settlement-qualified-two-leg-parity",
    title: "Settlement-qualified two-leg parity",
    lens: "EQUIVALENCE" as const,
    cadenceMs: 15 * 60_000,
    priority: 5 as const,
    question: "Find exactly two current OPEN/ACTIVE binary listings for the same payout claim with explicit settlement paths. Require exact refs, compatible outcome mappings, close windows, resolution sources, void rules, and indicative prices. Reject RELATED, trading-only/non-settlement, or wider-scope candidates. Require a deterministic positive gross catalog hint before deep investigation. Fees, depth, fillability, latency, and executable profit remain unproven. Return no hypothesis unless current contracts ground the pair.",
    candidatePolicy: Object.freeze({
      allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
      exactListingRefCount: 2,
      requirePositiveGrossHint: true,
      candidateSelection: "MODEL_HYPOTHESIS" as const,
      requireDistinctVenues: true,
    }),
  }),
  Object.freeze({
    key: "cross-venue-equivalence",
    title: "Cross-venue same claim",
    lens: "EQUIVALENCE" as const,
    cadenceMs: 15 * 60_000,
    priority: 5 as const,
    question: "Search all venues for differently worded listings that may resolve to the same real-world claim. Verify event identity, time window, outcome mapping, resolution source, and void policy; aggressively falsify title similarity.",
  }),
  Object.freeze({
    key: "logical-implication",
    title: "Implication and subset chains",
    lens: "IMPLICATION" as const,
    cadenceMs: 20 * 60_000,
    priority: 4 as const,
    question: "Search for grounded one-way implications, subsets, nested thresholds, prerequisite events, and nested time windows. State the forbidden truth assignments and do not assume the converse.",
  }),
  Object.freeze({
    key: "outcome-partitions",
    title: "Mutual exclusion and partitions",
    lens: "PARTITION" as const,
    cadenceMs: 30 * 60_000,
    priority: 3 as const,
    question: "Search for groups of markets that may be mutually exclusive or exhaustive. Test missing outcomes, boundary overlap, cancellation, postponement, and catch-all handling before proposing a partition.",
  }),
  Object.freeze({
    key: "mechanism-conflicts",
    title: "Mechanism and oracle conflicts",
    lens: "MECHANISM" as const,
    cadenceMs: 30 * 60_000,
    priority: 2 as const,
    question: "Search for apparent semantic matches whose oracle, close time, tie rule, settlement, cancellation, denomination, or market mechanism can produce divergent payouts.",
  }),
]);

export class SearchIssueScheduler {
  readonly #issues: SearchIssueRecord[];
  readonly #notifications: SearchNotificationRecord[];
  readonly #active = new Map<Hash, Promise<SearchLeaseRecord>>();
  readonly #leaseScheduler: SearchLeaseScheduler;
  readonly #store: SearchIssueRecordStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SearchIssueSchedulerOptions) {
    this.#leaseScheduler = options.leaseScheduler;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.#concurrencyLimit = options.concurrencyLimit ?? 3;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    this.tickIntervalMs = options.tickIntervalMs ?? null;
    if (
      !Number.isSafeInteger(this.#concurrencyLimit) ||
      this.#concurrencyLimit < 1 || this.#concurrencyLimit > 8 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 10 ||
      (this.tickIntervalMs !== null &&
        (!Number.isSafeInteger(this.tickIntervalMs) ||
          this.tickIntervalMs < 1_000 || this.tickIntervalMs > 60_000))
    ) {
      throw new Error("search issue scheduler configuration is invalid or unbounded");
    }
    this.#issues = [
      ...(this.#store?.loadSearchIssueRecords(this.#retentionLimit) ?? []),
    ].map(assertSearchIssueRecord);
    this.#notifications = [
      ...(this.#store?.loadSearchNotificationRecords(this.#retentionLimit) ?? []),
    ].map(assertSearchNotificationRecord);
    if (options.seedDefaults !== false) {
      const now = this.#now();
      for (const template of DEFAULT_ISSUES) {
        const defaultIssue = this.#defaultIssue(template, now);
        if (!this.#issues.some((issue) => issue.issueId === defaultIssue.issueId)) {
          this.#saveIssue(defaultIssue);
        } else if (
          defaultIssue.candidatePolicy !== undefined &&
          hashCanonical(this.#issues.find((issue) =>
            issue.issueId === defaultIssue.issueId
          )?.candidatePolicy ?? null) !== hashCanonical(defaultIssue.candidatePolicy)
        ) {
          const existing = this.#issues.find((issue) => issue.issueId === defaultIssue.issueId)!;
          this.#saveIssue(withIssueHash({
            ...this.#withoutIssueHash(existing),
            candidatePolicy: defaultIssue.candidatePolicy,
          }));
        }
      }
    }
  }

  #defaultIssue(
    template: (typeof DEFAULT_ISSUES)[number],
    now: number,
  ): SearchIssueRecord {
    const timestamp = new Date(now).toISOString();
    const issueId = hashCanonical({
      schemaVersion: "pmh.default-search-issue-id.v1",
      key: template.key,
    });
    return withIssueHash({
      schemaVersion: "pmh.search-issue.v1",
      issueId,
      ...("candidatePolicy" in template
        ? { candidatePolicy: template.candidatePolicy }
        : {}),
      title: template.title,
      question: template.question,
      lens: template.lens,
      venueIds: Object.freeze([]),
      cadenceMs: template.cadenceMs,
      priority: template.priority,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextRunAt: timestamp,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastLeaseId: null,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
    });
  }

  public create(input: CreateSearchIssueInput): SearchIssueRecord {
    const title = input.title.trim().replace(/\s+/gu, " ");
    const question = input.question.trim().replace(/\s+/gu, " ");
    const venueIds = Object.freeze([...(input.venueIds ?? [])].map((item) => item.trim()).sort());
    const now = this.#now();
    const timestamp = new Date(now).toISOString();
    const issueId = hashCanonical({
      schemaVersion: "pmh.search-issue-id.v1",
      title,
      question,
      createdAt: timestamp,
    });
    return this.#saveIssue(withIssueHash({
      schemaVersion: "pmh.search-issue.v1",
      issueId,
      title,
      question,
      lens: input.lens,
      venueIds,
      cadenceMs: input.cadenceMs,
      priority: input.priority ?? 3,
      enabled: input.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextRunAt: timestamp,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastLeaseId: null,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
    }));
  }

  public setEnabled(issueId: Hash, enabled: boolean): SearchIssueRecord {
    const issue = this.#requireIssue(issueId);
    const timestamp = new Date(this.#now()).toISOString();
    return this.#saveIssue(withIssueHash({
      ...this.#withoutIssueHash(issue),
      enabled,
      updatedAt: timestamp,
      nextRunAt: enabled ? timestamp : issue.nextRunAt,
    }));
  }

  public runNow(
    issueId: Hash,
    snapshot: MarketCorpusSnapshot,
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    return this.#dispatch(this.#requireIssue(issueId), snapshot, "OPERATOR");
  }

  public tick(snapshot: MarketCorpusSnapshot): readonly Promise<SearchLeaseRecord>[] {
    if (this.tickIntervalMs === null || snapshot.listingCount === 0) return Object.freeze([]);
    const now = this.#now();
    for (const abandoned of this.#leaseScheduler.failIssuedForUnavailableSnapshots(snapshot)) {
      const issueId = abandoned.lease.issueId;
      if (issueId === undefined || issueId === null ||
        !this.#issues.some((issue) => issue.issueId === issueId)) continue;
      this.#complete(issueId, abandoned);
      const issue = this.#requireIssue(issueId);
      this.#saveIssue(withIssueHash({
        ...this.#withoutIssueHash(issue),
        nextRunAt: new Date(now).toISOString(),
      }));
    }
    const available = this.#concurrencyLimit - this.#active.size;
    if (available <= 0) return Object.freeze([]);
    const due = this.#issues
      .filter((issue) =>
        issue.enabled &&
        (Date.parse(issue.nextRunAt) <= now || this.#hasIssuedLease(issue)) &&
        !this.#active.has(issue.issueId),
      )
      .sort((left, right) =>
        right.priority - left.priority ||
        Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt) ||
        left.issueId.localeCompare(right.issueId),
      )
      .slice(0, available);
    const promises: Promise<SearchLeaseRecord>[] = [];
    for (const issue of due) {
      try {
        promises.push(this.#dispatch(issue, snapshot, "SCHEDULE").promise);
      } catch (error) {
        if (error instanceof SearchLeaseBusyError) break;
        throw error;
      }
    }
    return Object.freeze(promises);
  }

  #hasIssuedLease(issue: SearchIssueRecord): boolean {
    return this.#leaseScheduler.projection().records.some((record) =>
      record.status === "ISSUED" &&
      record.lease.issueId === issue.issueId,
    );
  }

  #dispatch(
    issue: SearchIssueRecord,
    snapshot: MarketCorpusSnapshot,
    trigger: "OPERATOR" | "SCHEDULE",
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    const active = this.#active.get(issue.issueId);
    if (active !== undefined) {
      return Object.freeze({ promise: active, idempotentReplay: true });
    }
    if (this.#active.size >= this.#concurrencyLimit) {
      throw new SearchLeaseBusyError("search issue concurrency limit is active");
    }
    const invocation = this.#leaseScheduler.resumeIssued(issue.issueId) ??
      this.#leaseScheduler.begin(
        snapshot,
        issue.lens,
        trigger,
        Object.freeze({
          issueId: issue.issueId,
          question: issue.question,
          venueIds: issue.venueIds,
          ...(issue.candidatePolicy === undefined
            ? {}
            : { candidatePolicy: issue.candidatePolicy }),
        }),
      );
    const startedAtMs = this.#now();
    this.#saveIssue(withIssueHash({
      ...this.#withoutIssueHash(issue),
      updatedAt: new Date(startedAtMs).toISOString(),
      nextRunAt: new Date(startedAtMs + issue.cadenceMs).toISOString(),
      lastStartedAt: new Date(startedAtMs).toISOString(),
    }));
    const promise = invocation.promise.then((record) => {
      this.#active.delete(issue.issueId);
      this.#complete(issue.issueId, record);
      return record;
    });
    this.#active.set(issue.issueId, promise);
    return Object.freeze({ promise, idempotentReplay: invocation.idempotentReplay });
  }

  #complete(issueId: Hash, lease: SearchLeaseRecord): void {
    const issue = this.#requireIssue(issueId);
    const alreadyCounted = issue.lastLeaseId === lease.lease.leaseId;
    const completedAt = lease.completedAt ?? new Date(this.#now()).toISOString();
    this.#saveIssue(withIssueHash({
      ...this.#withoutIssueHash(issue),
      updatedAt: completedAt,
      lastCompletedAt: completedAt,
      lastLeaseId: lease.lease.leaseId,
      runCount: issue.runCount + (alreadyCounted ? 0 : 1),
      passCount: issue.passCount + (!alreadyCounted && lease.status === "PASS" ? 1 : 0),
      failedCount: issue.failedCount + (!alreadyCounted && lease.status === "FAILED" ? 1 : 0),
    }));
    if (lease.status === "FAILED") {
      this.#notify(issue, lease, "RUN_FAILED", lease.lease.leaseId,
        lease.diagnostic ?? "Scheduled search failed before producing a bounded result.");
    } else if (lease.outcome.novelCandidate && lease.lineage.noveltySignature !== null) {
      this.#notify(
        issue,
        lease,
        "NOVEL_CANDIDATE",
        lease.lineage.noveltySignature,
        `${lease.outcome.hypothesisCount} fast-lane candidate${lease.outcome.hypothesisCount === 1 ? "" : "s"}; ${lease.outcome.proposalCount} grounded deep proposal${lease.outcome.proposalCount === 1 ? "" : "s"}; ${lease.outcome.evidenceGapCount} evidence gap${lease.outcome.evidenceGapCount === 1 ? "" : "s"}.`,
      );
    }
  }

  #notify(
    issue: SearchIssueRecord,
    lease: SearchLeaseRecord,
    kind: SearchNotificationRecord["kind"],
    dedupeSource: Hash,
    summary: string,
  ): void {
    const dedupeIdentity = hashCanonical({
      schemaVersion: "pmh.search-notification-dedupe.v1",
      kind,
      dedupeSource,
    });
    if (this.#notifications.some((item) => item.dedupeIdentity === dedupeIdentity)) return;
    const createdAt = lease.completedAt ?? new Date(this.#now()).toISOString();
    const notificationId = hashCanonical({
      schemaVersion: "pmh.search-notification-id.v1",
      dedupeIdentity,
    });
    this.#saveNotification(withNotificationHash({
      schemaVersion: "pmh.search-notification.v1",
      notificationId,
      dedupeIdentity,
      issueId: issue.issueId,
      leaseId: lease.lease.leaseId,
      kind,
      status: "UNREAD",
      title: kind === "NOVEL_CANDIDATE"
        ? `${issue.title}: new candidate`
        : `${issue.title}: search failed`,
      summary: summary.slice(0, 500),
      createdAt,
      readAt: null,
    }));
  }

  public acknowledge(notificationId: Hash): SearchNotificationRecord {
    const notification = this.#notifications.find((item) => item.notificationId === notificationId);
    if (notification === undefined) throw new Error("search notification was not found");
    if (notification.status === "READ") return notification;
    return this.#saveNotification(withNotificationHash({
      ...this.#withoutNotificationHash(notification),
      status: "READ",
      readAt: new Date(this.#now()).toISOString(),
    }));
  }

  #requireIssue(issueId: Hash): SearchIssueRecord {
    const issue = this.#issues.find((item) => item.issueId === issueId);
    if (issue === undefined) throw new Error("search issue was not found");
    return issue;
  }

  #withoutIssueHash(record: SearchIssueRecord): Omit<SearchIssueRecord, "artifactHash"> {
    const { artifactHash: _artifactHash, ...body } = record;
    return body;
  }

  #withoutNotificationHash(
    record: SearchNotificationRecord,
  ): Omit<SearchNotificationRecord, "artifactHash"> {
    const { artifactHash: _artifactHash, ...body } = record;
    return body;
  }

  #saveIssue(record: SearchIssueRecord): SearchIssueRecord {
    const valid = assertSearchIssueRecord(record);
    const stored = this.#store?.saveSearchIssueRecord(valid) ?? valid;
    const index = this.#issues.findIndex((item) => item.issueId === stored.issueId);
    if (index >= 0) this.#issues.splice(index, 1);
    this.#issues.push(stored);
    this.#issues.sort((left, right) =>
      right.priority - left.priority || left.createdAt.localeCompare(right.createdAt),
    );
    return stored;
  }

  #saveNotification(record: SearchNotificationRecord): SearchNotificationRecord {
    const valid = assertSearchNotificationRecord(record);
    const stored = this.#store?.saveSearchNotificationRecord(valid, this.#retentionLimit) ?? valid;
    const index = this.#notifications.findIndex(
      (item) => item.notificationId === stored.notificationId,
    );
    if (index >= 0) this.#notifications.splice(index, 1);
    this.#notifications.unshift(stored);
    if (this.#notifications.length > this.#retentionLimit) {
      this.#notifications.length = this.#retentionLimit;
    }
    return stored;
  }

  public projection(): SearchIssueSchedulerProjection {
    const now = this.#now();
    const issues = Object.freeze([...this.#issues]);
    const notifications = Object.freeze([...this.#notifications]);
    const leaseProjection = this.#leaseScheduler.projection();
    const terminalIssueLeases = leaseProjection.records.filter(
      (record) => record.status !== "ISSUED" && record.lease.issueId !== null &&
        record.lease.issueId !== undefined,
    );
    const performance = summarizeLeasePerformance(terminalIssueLeases);
    return Object.freeze({
      schemaVersion: "pmh.search-issue-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      status: this.#active.size === 0 ? "IDLE" : "RUNNING",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      issueCount: issues.length,
      enabledIssueCount: issues.filter((item) => item.enabled).length,
      dueIssueCount: issues.filter(
        (item) => item.enabled && !this.#active.has(item.issueId) && (
          Date.parse(item.nextRunAt) <= now ||
          this.#leaseScheduler.projection().records.some((record) =>
            record.status === "ISSUED" && record.lease.issueId === item.issueId,
          )
        ),
      ).length,
      unreadNotificationCount: notifications.filter((item) => item.status === "UNREAD").length,
      performance: Object.freeze({
        measurementWindow: "RETAINED_TERMINAL_LEASES" as const,
        retainedLeaseLimit: leaseProjection.retentionLimit,
        ...performance,
        novelCandidateRateBps: ratioBps(
          performance.novelCandidateCount,
          performance.terminalLeaseCount,
        ),
        duplicateRateBps: ratioBps(
          performance.duplicateCount,
          performance.terminalLeaseCount,
        ),
      piEscalationRateBps: ratioBps(
        performance.piEscalationCount,
        performance.terminalLeaseCount,
      ),
      economicGatePositiveRateBps: ratioBps(
        performance.economicGatePositiveCount,
        performance.economicGateRequiredCount,
      ),
        byIssue: Object.freeze(issues.map((issue) => Object.freeze({
          issueId: issue.issueId,
          ...summarizeLeasePerformance(terminalIssueLeases.filter(
            (record) => record.lease.issueId === issue.issueId,
          )),
        }))),
      }),
      issues,
      notifications,
      storage: Object.freeze({
        issues: this.#store?.searchIssueStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "issueId" as const,
        }),
        notifications: this.#store?.searchNotificationStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "notificationId" as const,
        }),
      }),
      authority: "PROPOSE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}

export function parseSearchIssueTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_SEARCH_ISSUE_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error("PMH_SEARCH_ISSUE_TICK_MS must be 0 or an integer from 1000 to 60000");
  }
  return value;
}
