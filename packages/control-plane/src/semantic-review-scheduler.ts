import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketRelationProposal } from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  SemanticReviewBusyError,
  SemanticReviewDesk,
  SemanticReviewNotConfiguredError,
  type SemanticReviewRecord,
  type SemanticReviewRecommendation,
} from "./semantic-review.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 250;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_REQUESTS_PER_TICK = 3;
const DEFAULT_LEASE_TIMEOUT_MS = 150_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;

export type SemanticReviewJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "BLOCKED_EVIDENCE"
  | "PASS"
  | "EXHAUSTED";

export type SemanticReviewJobRecord = Readonly<{
  schemaVersion: "pmh.semantic-review-job.v1";
  jobId: Hash;
  opportunityId: string;
  proposalId: Hash;
  proposalCorpusSnapshotIdentity: Hash;
  issueIds: readonly Hash[];
  priority: 1 | 2 | 3 | 4 | 5;
  status: SemanticReviewJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  lastReviewId: Hash | null;
  recommendation: SemanticReviewRecommendation | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  artifactHash: Hash;
}>;

export type SemanticReviewNotificationRecord = Readonly<{
  schemaVersion: "pmh.semantic-review-notification.v1";
  notificationId: Hash;
  dedupeIdentity: Hash;
  jobId: Hash;
  opportunityId: string;
  kind: "REVIEW_COMPLETE" | "REVIEW_ESCALATED" | "JOB_EXHAUSTED";
  status: "UNREAD" | "READ";
  title: string;
  summary: string;
  createdAt: string;
  readAt: string | null;
  artifactHash: Hash;
}>;

export interface SemanticReviewSchedulerStore {
  readonly semanticReviewJobStorage: OperationalStorageProjection<"jobId">;
  readonly semanticReviewNotificationStorage: OperationalStorageProjection<"notificationId">;
  loadSemanticReviewJobRecords(limit: number): readonly SemanticReviewJobRecord[];
  saveSemanticReviewJobRecord(record: SemanticReviewJobRecord): SemanticReviewJobRecord;
  loadSemanticReviewNotificationRecords(
    limit: number,
  ): readonly SemanticReviewNotificationRecord[];
  saveSemanticReviewNotificationRecord(
    record: SemanticReviewNotificationRecord,
    retentionLimit: number,
  ): SemanticReviewNotificationRecord;
}

export type SemanticReviewCandidate = Readonly<{
  proposal: MarketRelationProposal;
  proposalCorpusSnapshotIdentity: Hash;
  issueIds: readonly Hash[];
  priority: 1 | 2 | 3 | 4 | 5;
}>;

export type SemanticReviewSchedulerProjection = Readonly<{
  schemaVersion: "pmh.semantic-review-scheduler.v1";
  enabled: boolean;
  configured: boolean;
  status: "IDLE" | "RUNNING" | "NEEDS_KEY";
  tickIntervalMs: number | null;
  concurrencyLimit: number;
  activeCount: number;
  dueCount: number;
  pendingCount: number;
  leasedCount: number;
  retryWaitCount: number;
  blockedEvidenceCount: number;
  passedCount: number;
  exhaustedCount: number;
  unreadNotificationCount: number;
  budget: Readonly<{
    basis: "REQUEST_ATTEMPTS";
    maxAttemptsPerJob: number;
    maxRequestsPerTick: number;
    requestAttemptsStarted: number;
  }>;
  jobs: readonly SemanticReviewJobRecord[];
  notifications: readonly SemanticReviewNotificationRecord[];
  storage: Readonly<{
    jobs: OperationalStorageProjection<"jobId">;
    notifications: OperationalStorageProjection<"notificationId">;
  }>;
  authority: "ADVISORY_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type SchedulerOptions = Readonly<{
  reviewDesk: SemanticReviewDesk;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: SemanticReviewSchedulerStore;
  now?: () => number;
}>;

function isIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function boundedText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

function compactDiagnostic(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 500) || "semantic review failed";
}

function withJobHash(
  body: Omit<SemanticReviewJobRecord, "artifactHash">,
): SemanticReviewJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withNotificationHash(
  body: Omit<SemanticReviewNotificationRecord, "artifactHash">,
): SemanticReviewNotificationRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertSemanticReviewJobRecord(value: unknown): SemanticReviewJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored semantic review job is malformed");
  }
  const record = value as SemanticReviewJobRecord;
  const terminal = record.status === "PASS" || record.status === "EXHAUSTED";
  const leased = record.status === "LEASED";
  if (
    record.schemaVersion !== "pmh.semantic-review-job.v1" ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    record.jobId !== hashCanonical({
      schemaVersion: "pmh.semantic-review-job-id.v1",
      proposalId: record.proposalId,
    }) ||
    record.opportunityId !== `ai:${record.proposalId}` ||
    !HASH_PATTERN.test(String(record.proposalId)) ||
    !HASH_PATTERN.test(String(record.proposalCorpusSnapshotIdentity)) ||
    !Array.isArray(record.issueIds) || record.issueIds.length === 0 ||
    record.issueIds.length > 20 ||
    record.issueIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    new Set(record.issueIds).size !== record.issueIds.length ||
    ![1, 2, 3, 4, 5].includes(record.priority) ||
    ![
      "PENDING", "LEASED", "RETRY_WAIT", "BLOCKED_EVIDENCE", "PASS", "EXHAUSTED",
    ].includes(record.status) ||
    !Number.isSafeInteger(record.attemptCount) || record.attemptCount < 0 ||
    !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1 ||
    record.maxAttempts > 10 || record.attemptCount > record.maxAttempts ||
    !isIso(record.nextAttemptAt) ||
    (leased !== (record.leasedAt !== null && record.leaseExpiresAt !== null)) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    (terminal !== (record.completedAt !== null)) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (record.lastReviewId !== null && !HASH_PATTERN.test(String(record.lastReviewId))) ||
    (record.recommendation !== null && ![
      "REJECT", "ESCALATE", "ACCEPT_FOR_RESEARCH_SIMULATION",
    ].includes(record.recommendation)) ||
    (record.status === "PASS" && (record.lastReviewId === null || record.recommendation === null)) ||
    (record.diagnostic !== null && (!boundedText(record.diagnostic, 500))) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashCanonical((({ artifactHash: _hash, ...body }) => body)(record))
  ) {
    throw new Error("stored semantic review job violates its bounded contract");
  }
  return Object.freeze(record);
}

export function assertSemanticReviewNotificationRecord(
  value: unknown,
): SemanticReviewNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored semantic review notification is malformed");
  }
  const record = value as SemanticReviewNotificationRecord;
  if (
    record.schemaVersion !== "pmh.semantic-review-notification.v1" ||
    !HASH_PATTERN.test(String(record.notificationId)) ||
    !HASH_PATTERN.test(String(record.dedupeIdentity)) ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    !boundedText(record.opportunityId, 160) ||
    !["REVIEW_COMPLETE", "REVIEW_ESCALATED", "JOB_EXHAUSTED"].includes(record.kind) ||
    !["UNREAD", "READ"].includes(record.status) ||
    !boundedText(record.title, 160) || !boundedText(record.summary, 500) ||
    !isIso(record.createdAt) ||
    (record.readAt !== null && !isIso(record.readAt)) ||
    (record.status === "UNREAD" ? record.readAt !== null : record.readAt === null) ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashCanonical((({ artifactHash: _hash, ...body }) => body)(record))
  ) {
    throw new Error("stored semantic review notification violates its bounded contract");
  }
  return Object.freeze(record);
}

export class SemanticReviewScheduler {
  readonly #jobs: SemanticReviewJobRecord[];
  readonly #notifications: SemanticReviewNotificationRecord[];
  readonly #active = new Map<Hash, Promise<SemanticReviewJobRecord>>();
  readonly #reviewDesk: SemanticReviewDesk;
  readonly #store: SemanticReviewSchedulerStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #maxAttempts: number;
  readonly #maxRequestsPerTick: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SchedulerOptions) {
    this.#reviewDesk = options.reviewDesk;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.tickIntervalMs = options.tickIntervalMs ?? null;
    this.#concurrencyLimit = options.concurrencyLimit ?? 3;
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.#maxRequestsPerTick = options.maxRequestsPerTick ?? DEFAULT_MAX_REQUESTS_PER_TICK;
    this.#leaseTimeoutMs = options.leaseTimeoutMs ?? DEFAULT_LEASE_TIMEOUT_MS;
    this.#retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    if (
      (this.tickIntervalMs !== null && (
        !Number.isSafeInteger(this.tickIntervalMs) ||
        this.tickIntervalMs < 1_000 || this.tickIntervalMs > 60_000
      )) ||
      !Number.isSafeInteger(this.#concurrencyLimit) ||
      this.#concurrencyLimit < 1 || this.#concurrencyLimit > 8 ||
      !Number.isSafeInteger(this.#maxAttempts) ||
      this.#maxAttempts < 1 || this.#maxAttempts > 10 ||
      !Number.isSafeInteger(this.#maxRequestsPerTick) ||
      this.#maxRequestsPerTick < 1 || this.#maxRequestsPerTick > 8 ||
      !Number.isSafeInteger(this.#leaseTimeoutMs) ||
      this.#leaseTimeoutMs < 1_000 || this.#leaseTimeoutMs > 600_000 ||
      !Number.isSafeInteger(this.#retryDelayMs) ||
      this.#retryDelayMs < 1_000 || this.#retryDelayMs > 86_400_000 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 10
    ) {
      throw new Error("semantic review scheduler configuration is invalid or unbounded");
    }
    this.#jobs = [
      ...(this.#store?.loadSemanticReviewJobRecords(this.#retentionLimit) ?? []),
    ].map(assertSemanticReviewJobRecord);
    this.#notifications = [
      ...(this.#store?.loadSemanticReviewNotificationRecords(this.#retentionLimit) ?? []),
    ].map(assertSemanticReviewNotificationRecord);
  }

  public reconcile(
    candidates: readonly SemanticReviewCandidate[],
    reviews: readonly SemanticReviewRecord[],
  ): void {
    const now = new Date(this.#now()).toISOString();
    const passedByProposal = new Map(
      reviews.filter((review) => review.status === "PASS" && review.report !== null)
        .map((review) => [review.proposalId, review] as const),
    );
    for (const job of [...this.#jobs]) {
      const review = passedByProposal.get(job.proposalId);
      if (review !== undefined && job.status !== "PASS") {
        this.#completeFromReview(job, review);
      }
    }
    for (const candidate of [...candidates].sort((left, right) =>
      left.proposal.proposalId.localeCompare(right.proposal.proposalId)
    )) {
      const proposalId = candidate.proposal.proposalId;
      const jobId = hashCanonical({
        schemaVersion: "pmh.semantic-review-job-id.v1",
        proposalId,
      });
      const existing = this.#jobs.find((job) => job.jobId === jobId);
      const issueIds = Object.freeze([...new Set(candidate.issueIds)].sort());
      const review = passedByProposal.get(proposalId);
      if (existing === undefined) {
        this.#saveJob(withJobHash({
          schemaVersion: "pmh.semantic-review-job.v1",
          jobId,
          opportunityId: `ai:${proposalId}`,
          proposalId,
          proposalCorpusSnapshotIdentity: candidate.proposalCorpusSnapshotIdentity,
          issueIds,
          priority: candidate.priority,
          status: review === undefined ? "PENDING" : "PASS",
          attemptCount: 0,
          maxAttempts: this.#maxAttempts,
          nextAttemptAt: now,
          leasedAt: null,
          leaseExpiresAt: null,
          completedAt: review?.completedAt ?? null,
          lastReviewId: review?.reviewId ?? null,
          recommendation: review?.report?.result.recommendation ?? null,
          diagnostic: null,
          createdAt: now,
          updatedAt: now,
        }));
        continue;
      }
      if (
        existing.status === "EXHAUSTED" &&
        existing.attemptCount === 0 &&
        existing.diagnostic?.includes("proposal exceeds the current corpus") === true
      ) {
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(existing),
          status: "BLOCKED_EVIDENCE",
          completedAt: null,
          updatedAt: now,
        }));
        continue;
      }
      if (review !== undefined && existing.status !== "PASS") {
        this.#completeFromReview(existing, review);
        continue;
      }
      if (
        existing.issueIds.join("\n") !== issueIds.join("\n") ||
        existing.priority !== candidate.priority
      ) {
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(existing),
          issueIds,
          priority: candidate.priority,
          updatedAt: now,
        }));
      }
    }
    this.#recoverExpiredLeases();
  }

  public tick(
    candidates: readonly SemanticReviewCandidate[],
    snapshot: MarketCorpusSnapshot,
  ): readonly Promise<SemanticReviewJobRecord>[] {
    this.reconcile(candidates, this.#reviewDesk.projection().records);
    if (this.tickIntervalMs === null || snapshot.listingCount === 0) return Object.freeze([]);
    this.#reconcileEvidenceAvailability(candidates, snapshot);
    if (!this.#reviewDesk.projection().configured) return Object.freeze([]);
    const available = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#reviewDesk.projection().concurrencyLimit - this.#reviewDesk.projection().activeCount,
      this.#maxRequestsPerTick,
    );
    if (available <= 0) return Object.freeze([]);
    const now = this.#now();
    const candidateByProposal = new Map(
      candidates.map((candidate) => [candidate.proposal.proposalId, candidate] as const),
    );
    const due = this.#jobs
      .filter((job) =>
        (job.status === "PENDING" || job.status === "RETRY_WAIT") &&
        Date.parse(job.nextAttemptAt) <= now &&
        !this.#active.has(job.jobId) &&
        candidateByProposal.has(job.proposalId),
      )
      .sort((left, right) =>
        right.priority - left.priority ||
        Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt) ||
        left.jobId.localeCompare(right.jobId),
      )
      .slice(0, available);
    return Object.freeze(due.map((job) =>
      this.#dispatch(job, candidateByProposal.get(job.proposalId)!, snapshot)
    ));
  }

  #dispatch(
    job: SemanticReviewJobRecord,
    candidate: SemanticReviewCandidate,
    snapshot: MarketCorpusSnapshot,
  ): Promise<SemanticReviewJobRecord> {
    const missingListingRefs = candidate.proposal.listingRefs.filter(
      (listingRef) => !snapshot.listings.some((listing) => listing.listingRef === listingRef),
    );
    if (missingListingRefs.length > 0) {
      return Promise.resolve(this.#blockForEvidence(job, missingListingRefs));
    }
    const startedAtMs = this.#now();
    const leased = this.#saveJob(withJobHash({
      ...this.#withoutJobHash(job),
      status: "LEASED",
      attemptCount: job.attemptCount + 1,
      leasedAt: new Date(startedAtMs).toISOString(),
      leaseExpiresAt: new Date(startedAtMs + this.#leaseTimeoutMs).toISOString(),
      completedAt: null,
      diagnostic: null,
      updatedAt: new Date(startedAtMs).toISOString(),
    }));
    let invocation;
    try {
      invocation = this.#reviewDesk.begin(
        leased.opportunityId,
        candidate.proposal,
        snapshot,
        candidate.proposalCorpusSnapshotIdentity,
      );
    } catch (error) {
      const reverted = this.#saveJob(withJobHash({
        ...this.#withoutJobHash(leased),
        status: "PENDING",
        attemptCount: job.attemptCount,
        leasedAt: null,
        leaseExpiresAt: null,
        diagnostic: compactDiagnostic(
          error instanceof Error ? error.message : "semantic review dispatch failed",
        ),
        updatedAt: new Date(this.#now()).toISOString(),
      }));
      if (
        error instanceof SemanticReviewBusyError ||
        error instanceof SemanticReviewNotConfiguredError
      ) return Promise.resolve(reverted);
      return Promise.resolve(this.#blockForEvidence(
        reverted,
        [],
        reverted.diagnostic ?? "semantic review dispatch scope is unavailable",
      ));
    }
    const promise = invocation.promise.then((review) => {
      this.#active.delete(job.jobId);
      if (review.status === "PASS" && review.report !== null) {
        return this.#completeFromReview(leased, review);
      }
      if (leased.attemptCount >= leased.maxAttempts) {
        return this.#exhaust(leased, review.diagnostic ?? "semantic review attempt failed");
      }
      const updatedAtMs = this.#now();
      return this.#saveJob(withJobHash({
        ...this.#withoutJobHash(leased),
        status: "RETRY_WAIT",
        nextAttemptAt: new Date(
          updatedAtMs + this.#retryDelayMs * leased.attemptCount,
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        lastReviewId: review.reviewId,
        diagnostic: compactDiagnostic(review.diagnostic ?? "semantic review attempt failed"),
        updatedAt: new Date(updatedAtMs).toISOString(),
      }));
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #recoverExpiredLeases(): void {
    const now = this.#now();
    for (const job of this.#jobs.filter((item) =>
      item.status === "LEASED" &&
      item.leaseExpiresAt !== null &&
      Date.parse(item.leaseExpiresAt) <= now &&
      !this.#active.has(item.jobId)
    )) {
      const review = this.#reviewDesk.projection().records.find(
        (record) => record.proposalId === job.proposalId && record.status === "PASS",
      );
      if (review !== undefined) {
        this.#completeFromReview(job, review);
      } else if (job.attemptCount >= job.maxAttempts) {
        this.#exhaust(job, "semantic review lease expired after the request budget was exhausted");
      } else {
        const timestamp = new Date(now).toISOString();
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(job),
          status: "RETRY_WAIT",
          nextAttemptAt: new Date(now + this.#retryDelayMs * job.attemptCount).toISOString(),
          leasedAt: null,
          leaseExpiresAt: null,
          diagnostic: "semantic review lease expired before a durable result was observed",
          updatedAt: timestamp,
        }));
      }
    }
  }

  #reconcileEvidenceAvailability(
    candidates: readonly SemanticReviewCandidate[],
    snapshot: MarketCorpusSnapshot,
  ): void {
    const candidateByProposal = new Map(
      candidates.map((candidate) => [candidate.proposal.proposalId, candidate] as const),
    );
    const availableRefs = new Set(snapshot.listings.map((listing) => listing.listingRef));
    for (const job of this.#jobs.filter((item) => item.status === "BLOCKED_EVIDENCE")) {
      const candidate = candidateByProposal.get(job.proposalId);
      if (
        candidate === undefined ||
        candidate.proposal.listingRefs.some((listingRef) => !availableRefs.has(listingRef))
      ) continue;
      const updatedAt = new Date(this.#now()).toISOString();
      this.#saveJob(withJobHash({
        ...this.#withoutJobHash(job),
        status: "PENDING",
        nextAttemptAt: updatedAt,
        diagnostic: null,
        updatedAt,
      }));
    }
  }

  #blockForEvidence(
    job: SemanticReviewJobRecord,
    missingListingRefs: readonly string[],
    diagnostic?: string,
  ): SemanticReviewJobRecord {
    const updatedAt = new Date(this.#now()).toISOString();
    const detail = diagnostic ?? (
      missingListingRefs.length === 0
        ? "semantic review evidence is unavailable"
        : `current corpus is missing ${missingListingRefs.length} proposal listing reference${
            missingListingRefs.length === 1 ? "" : "s"
          }`
    );
    return this.#saveJob(withJobHash({
      ...this.#withoutJobHash(job),
      status: "BLOCKED_EVIDENCE",
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt: null,
      diagnostic: compactDiagnostic(detail),
      updatedAt,
    }));
  }

  #completeFromReview(
    job: SemanticReviewJobRecord,
    review: SemanticReviewRecord,
  ): SemanticReviewJobRecord {
    if (review.status !== "PASS" || review.report === null || review.completedAt === null) {
      throw new Error("semantic review job requires a passing durable review");
    }
    const completed = this.#saveJob(withJobHash({
      ...this.#withoutJobHash(job),
      status: "PASS",
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt: review.completedAt,
      lastReviewId: review.reviewId,
      recommendation: review.report.result.recommendation,
      diagnostic: null,
      updatedAt: review.completedAt,
    }));
    this.#notify(completed, review.report.result.recommendation === "ESCALATE"
      ? "REVIEW_ESCALATED"
      : "REVIEW_COMPLETE");
    return completed;
  }

  #exhaust(job: SemanticReviewJobRecord, diagnostic: string): SemanticReviewJobRecord {
    const completedAt = new Date(this.#now()).toISOString();
    const exhausted = this.#saveJob(withJobHash({
      ...this.#withoutJobHash(job),
      status: "EXHAUSTED",
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt,
      diagnostic: compactDiagnostic(diagnostic),
      updatedAt: completedAt,
    }));
    this.#notify(exhausted, "JOB_EXHAUSTED");
    return exhausted;
  }

  #notify(
    job: SemanticReviewJobRecord,
    kind: SemanticReviewNotificationRecord["kind"],
  ): void {
    const dedupeIdentity = hashCanonical({
      schemaVersion: "pmh.semantic-review-notification-dedupe.v1",
      jobId: job.jobId,
      kind,
    });
    if (this.#notifications.some((item) => item.dedupeIdentity === dedupeIdentity)) return;
    const createdAt = job.completedAt ?? new Date(this.#now()).toISOString();
    const notificationId = hashCanonical({
      schemaVersion: "pmh.semantic-review-notification-id.v1",
      dedupeIdentity,
    });
    const recommendation = job.recommendation?.replaceAll("_", " ").toLowerCase();
    this.#saveNotification(withNotificationHash({
      schemaVersion: "pmh.semantic-review-notification.v1",
      notificationId,
      dedupeIdentity,
      jobId: job.jobId,
      opportunityId: job.opportunityId,
      kind,
      status: "UNREAD",
      title: kind === "JOB_EXHAUSTED"
        ? "Semantic review exhausted"
        : kind === "REVIEW_ESCALATED"
          ? "Semantic review needs escalation"
          : "Semantic review completed",
      summary: kind === "JOB_EXHAUSTED"
        ? compactDiagnostic(job.diagnostic ?? "Review attempts were exhausted.")
        : `Advisory reviewer returned ${recommendation ?? "a result"}; an operator decision is still required.`,
      createdAt,
      readAt: null,
    }));
  }

  public acknowledge(notificationId: Hash): SemanticReviewNotificationRecord {
    const notification = this.#notifications.find((item) => item.notificationId === notificationId);
    if (notification === undefined) throw new Error("semantic review notification was not found");
    if (notification.status === "READ") return notification;
    return this.#saveNotification(withNotificationHash({
      ...this.#withoutNotificationHash(notification),
      status: "READ",
      readAt: new Date(this.#now()).toISOString(),
    }));
  }

  #withoutJobHash(record: SemanticReviewJobRecord): Omit<SemanticReviewJobRecord, "artifactHash"> {
    const { artifactHash: _artifactHash, ...body } = record;
    return body;
  }

  #withoutNotificationHash(
    record: SemanticReviewNotificationRecord,
  ): Omit<SemanticReviewNotificationRecord, "artifactHash"> {
    const { artifactHash: _artifactHash, ...body } = record;
    return body;
  }

  #saveJob(record: SemanticReviewJobRecord): SemanticReviewJobRecord {
    const valid = assertSemanticReviewJobRecord(record);
    const stored = this.#store?.saveSemanticReviewJobRecord(valid) ?? valid;
    const index = this.#jobs.findIndex((item) => item.jobId === stored.jobId);
    if (index >= 0) this.#jobs.splice(index, 1);
    this.#jobs.push(stored);
    this.#jobs.sort((left, right) =>
      right.priority - left.priority || left.createdAt.localeCompare(right.createdAt) ||
      left.jobId.localeCompare(right.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) this.#jobs.length = this.#retentionLimit;
    return stored;
  }

  #saveNotification(
    record: SemanticReviewNotificationRecord,
  ): SemanticReviewNotificationRecord {
    const valid = assertSemanticReviewNotificationRecord(record);
    const stored = this.#store?.saveSemanticReviewNotificationRecord(
      valid,
      this.#retentionLimit,
    ) ?? valid;
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

  public projection(): SemanticReviewSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const notifications = Object.freeze([...this.#notifications]);
    const now = this.#now();
    const configured = this.#reviewDesk.projection().configured;
    return Object.freeze({
      schemaVersion: "pmh.semantic-review-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      configured,
      status: !configured ? "NEEDS_KEY" : this.#active.size === 0 ? "IDLE" : "RUNNING",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      dueCount: jobs.filter((job) =>
        (job.status === "PENDING" || job.status === "RETRY_WAIT") &&
        Date.parse(job.nextAttemptAt) <= now
      ).length,
      pendingCount: jobs.filter((job) => job.status === "PENDING").length,
      leasedCount: jobs.filter((job) => job.status === "LEASED").length,
      retryWaitCount: jobs.filter((job) => job.status === "RETRY_WAIT").length,
      blockedEvidenceCount: jobs.filter((job) => job.status === "BLOCKED_EVIDENCE").length,
      passedCount: jobs.filter((job) => job.status === "PASS").length,
      exhaustedCount: jobs.filter((job) => job.status === "EXHAUSTED").length,
      unreadNotificationCount: notifications.filter((item) => item.status === "UNREAD").length,
      budget: Object.freeze({
        basis: "REQUEST_ATTEMPTS" as const,
        maxAttemptsPerJob: this.#maxAttempts,
        maxRequestsPerTick: this.#maxRequestsPerTick,
        requestAttemptsStarted: jobs.reduce((sum, job) => sum + job.attemptCount, 0),
      }),
      jobs,
      notifications,
      storage: Object.freeze({
        jobs: this.#store?.semanticReviewJobStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "jobId" as const,
        }),
        notifications: this.#store?.semanticReviewNotificationStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "notificationId" as const,
        }),
      }),
      authority: "ADVISORY_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }
}

export function parseSemanticReviewTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_SEMANTIC_REVIEW_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error("PMH_SEMANTIC_REVIEW_TICK_MS must be 0 or an integer from 1000 to 60000");
  }
  return value;
}
