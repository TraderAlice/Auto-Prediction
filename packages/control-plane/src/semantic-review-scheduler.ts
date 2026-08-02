import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProposalEvidenceBundle,
  type DurableProposalEvidenceBundle,
  type MarketRelationProposal,
  type ProposalEvidenceBundle,
} from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  SemanticReviewBusyError,
  SemanticReviewDesk,
  SemanticReviewNotConfiguredError,
  type SemanticReviewRecord,
  type SemanticReviewRecommendation,
} from "./semantic-review.js";
import type { OperationalStorageProjection } from "./types.js";
import { classifySemanticReviewAdmission } from "./semantic-review-admission.js";
import { deriveSemanticReviewScope } from "./semantic-review-scope.js";
import {
  assertRuleEvidenceClaim,
  type RuleEvidenceClaim,
} from "./rule-evidence-claim.js";

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
  | "RESEARCH_ONLY"
  | "DUPLICATE_SCOPE"
  | "PASS"
  | "EXHAUSTED";

export type SemanticReviewJobRecord = Readonly<{
  schemaVersion: "pmh.semantic-review-job.v1" | "pmh.semantic-review-job.v2";
  jobId: Hash;
  opportunityId: string;
  proposalId: Hash;
  proposalCorpusSnapshotIdentity: Hash;
  evidenceBundle?: ProposalEvidenceBundle | null;
  evidenceClaims?: readonly RuleEvidenceClaim[];
  reviewScopeIdentity?: Hash | null;
  duplicateOfJobId?: Hash | null;
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
  evidenceBundle: DurableProposalEvidenceBundle | null;
  evidenceClaims?: readonly RuleEvidenceClaim[];
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
  researchOnlyCount: number;
  duplicateScopeCount: number;
  scopedJobCount: number;
  uniqueReviewScopeCount: number;
  historicalRedundantPassCount: number;
  bundledJobCount: number;
  capturedOriginalJobCount: number;
  rebasedJobCount: number;
  legacyEvidenceDebtCount: number;
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

function researchOnlyDiagnostic(
  candidate: SemanticReviewCandidate,
): string {
  const admission = classifySemanticReviewAdmission(candidate.proposal);
  return admission.reason === "NON_COMPILABLE_RELATION"
    ? `${candidate.proposal.relationKind} is retained for research but is not a current automatic payoff-compiler relation`
    : admission.reason === "LISTING_ARITY_UNSUPPORTED"
      ? `${candidate.proposal.listingRefs.length} listing refs are retained for research but the automatic payoff compiler requires exactly two`
      : "duplicate listing refs cannot enter automatic semantic review";
}

function semanticReviewJobId(proposalId: Hash): Hash {
  return hashCanonical({
    schemaVersion: "pmh.semantic-review-job-id.v1",
    proposalId,
  });
}

function duplicateScopeDiagnostic(canonicalJobId: Hash): string {
  return `Unchanged contract-semantic review scope is owned by ${canonicalJobId}; automatic reviewer request withheld`;
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

function withoutJobHashAndClaims(
  record: SemanticReviewJobRecord,
): Omit<SemanticReviewJobRecord, "artifactHash" | "evidenceClaims"> {
  const {
    artifactHash: _artifactHash,
    evidenceClaims: _evidenceClaims,
    ...body
  } = record;
  return body;
}

export function assertSemanticReviewJobRecord(value: unknown): SemanticReviewJobRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored semantic review job is malformed");
  }
  const record = value as SemanticReviewJobRecord;
  const terminal = record.status === "PASS" || record.status === "EXHAUSTED" ||
    record.status === "RESEARCH_ONLY" || record.status === "DUPLICATE_SCOPE";
  const leased = record.status === "LEASED";
  const evidenceBundle = record.evidenceBundle ?? null;
  const evidenceClaims = record.evidenceClaims ?? [];
  const reviewScopeIdentity = record.reviewScopeIdentity ?? null;
  const duplicateOfJobId = record.duplicateOfJobId ?? null;
  if (
    !["pmh.semantic-review-job.v1", "pmh.semantic-review-job.v2"]
      .includes(record.schemaVersion) ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    record.jobId !== semanticReviewJobId(record.proposalId) ||
    record.opportunityId !== `ai:${record.proposalId}` ||
    !HASH_PATTERN.test(String(record.proposalId)) ||
    !HASH_PATTERN.test(String(record.proposalCorpusSnapshotIdentity)) ||
    (evidenceBundle !== null && (
      assertProposalEvidenceBundle(evidenceBundle).proposalId !== record.proposalId ||
      evidenceBundle.proposalCorpusSnapshotIdentity !== record.proposalCorpusSnapshotIdentity
    )) ||
    (record.schemaVersion === "pmh.semantic-review-job.v1" &&
      record.evidenceClaims !== undefined) ||
    (record.schemaVersion === "pmh.semantic-review-job.v2" && (
      !Array.isArray(record.evidenceClaims) || evidenceClaims.length < 1 ||
      evidenceClaims.length > 100 ||
      evidenceBundle?.schemaVersion !== "pmh.proposal-evidence-bundle.v2"
    )) ||
    new Set(evidenceClaims.map((claim) => claim.requirementId)).size !==
      evidenceClaims.length ||
    evidenceClaims.map(assertRuleEvidenceClaim).some((claim) =>
      claim.proposalId !== record.proposalId
    ) ||
    (record.reviewScopeIdentity !== undefined &&
      evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2" &&
      reviewScopeIdentity !== deriveSemanticReviewScope(
        evidenceBundle.proposal,
        evidenceBundle,
        evidenceClaims,
      ).scopeIdentity) ||
    (reviewScopeIdentity !== null &&
      !HASH_PATTERN.test(String(reviewScopeIdentity))) ||
    (duplicateOfJobId !== null &&
      (!HASH_PATTERN.test(String(duplicateOfJobId)) || duplicateOfJobId === record.jobId)) ||
    !Array.isArray(record.issueIds) || record.issueIds.length === 0 ||
    record.issueIds.length > 20 ||
    record.issueIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    new Set(record.issueIds).size !== record.issueIds.length ||
    ![1, 2, 3, 4, 5].includes(record.priority) ||
    ![
      "PENDING", "LEASED", "RETRY_WAIT", "BLOCKED_EVIDENCE", "RESEARCH_ONLY",
      "DUPLICATE_SCOPE", "PASS", "EXHAUSTED",
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
    (record.status === "RESEARCH_ONLY" && (
      record.lastReviewId !== null || record.recommendation !== null ||
      !boundedText(record.diagnostic, 500)
    )) ||
    (record.status === "DUPLICATE_SCOPE" && (
      reviewScopeIdentity === null || duplicateOfJobId === null ||
      record.lastReviewId !== null || record.recommendation !== null ||
      !boundedText(record.diagnostic, 500)
    )) ||
    (record.status !== "DUPLICATE_SCOPE" && duplicateOfJobId !== null) ||
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
    const existingByProposal = new Map(
      this.#jobs.map((job) => [job.proposalId, job] as const),
    );
    const sortedCandidates = [...candidates].sort((left, right) =>
      left.proposal.proposalId.localeCompare(right.proposal.proposalId)
    );
    const scopesByProposal = new Map(sortedCandidates.map((candidate) => [
      candidate.proposal.proposalId,
      deriveSemanticReviewScope(
        candidate.proposal,
        candidate.evidenceBundle,
        candidate.evidenceClaims ?? [],
      ),
    ] as const));
    const passedReviews = reviews.filter((review) =>
      review.status === "PASS" && review.report !== null
    );
    for (const job of [...this.#jobs]) {
      if (job.status === "PASS") continue;
      const review = passedReviews.find((item) =>
        item.proposalId === job.proposalId &&
        (job.schemaVersion === "pmh.semantic-review-job.v2"
          ? item.corpusSnapshotIdentity === job.reviewScopeIdentity &&
            item.report?.schemaVersion === "pmh.semantic-review-report.v4"
          : item.report?.schemaVersion !== "pmh.semantic-review-report.v4")
      );
      if (review !== undefined) {
        const completed = this.#completeFromReview(job, review);
        existingByProposal.set(job.proposalId, completed);
      }
    }
    const passedByProposal = new Map(sortedCandidates.flatMap((candidate) => {
      const scopeIdentity = scopesByProposal.get(candidate.proposal.proposalId)?.scopeIdentity;
      const enriched = (candidate.evidenceClaims?.length ?? 0) > 0;
      const review = passedReviews.find((item) =>
        item.proposalId === candidate.proposal.proposalId &&
        (enriched
          ? item.corpusSnapshotIdentity === scopeIdentity &&
            item.report?.schemaVersion === "pmh.semantic-review-report.v4"
          : item.report?.schemaVersion !== "pmh.semantic-review-report.v4")
      );
      return review === undefined
        ? []
        : [[candidate.proposal.proposalId, review] as const];
    }));
    const canonicalProposalByScope = new Map<Hash, Hash>();
    const scopedGroups = new Map<Hash, SemanticReviewCandidate[]>();
    for (const candidate of sortedCandidates) {
      const scopeIdentity = scopesByProposal.get(candidate.proposal.proposalId)?.scopeIdentity;
      if (scopeIdentity === null || scopeIdentity === undefined) continue;
      const group = scopedGroups.get(scopeIdentity) ?? [];
      group.push(candidate);
      scopedGroups.set(scopeIdentity, group);
    }
    for (const [scopeIdentity, group] of scopedGroups) {
      const canonical = [...group].sort((left, right) => {
        const leftJob = existingByProposal.get(left.proposal.proposalId);
        const rightJob = existingByProposal.get(right.proposal.proposalId);
        const rank = (candidate: SemanticReviewCandidate, job?: SemanticReviewJobRecord) =>
          passedByProposal.has(candidate.proposal.proposalId) || job?.status === "PASS" ? 0
            : job?.status === "LEASED" ? 1
              : job !== undefined && job.status !== "DUPLICATE_SCOPE" ? 2
                : 3;
        return rank(left, leftJob) - rank(right, rightJob) ||
          (leftJob?.createdAt ?? "9999").localeCompare(rightJob?.createdAt ?? "9999") ||
          left.proposal.proposalId.localeCompare(right.proposal.proposalId);
      })[0];
      if (canonical !== undefined) {
        canonicalProposalByScope.set(scopeIdentity, canonical.proposal.proposalId);
      }
    }
    for (const candidate of sortedCandidates) {
      const proposalId = candidate.proposal.proposalId;
      const jobId = semanticReviewJobId(proposalId);
      const existing = this.#jobs.find((job) => job.jobId === jobId);
      const issueIds = Object.freeze([...new Set(candidate.issueIds)].sort());
      const evidenceClaims = candidate.evidenceClaims === undefined
        ? undefined
        : Object.freeze(candidate.evidenceClaims.map(assertRuleEvidenceClaim));
      const review = passedByProposal.get(proposalId);
      const automatic = classifySemanticReviewAdmission(candidate.proposal).lane ===
        "AUTO_ARBITRAGE_REVIEW";
      const reviewScopeIdentity = scopesByProposal.get(proposalId)?.scopeIdentity ?? null;
      const canonicalProposalId = reviewScopeIdentity === null
        ? proposalId
        : canonicalProposalByScope.get(reviewScopeIdentity) ?? proposalId;
      const duplicateOfJobId = automatic && canonicalProposalId !== proposalId &&
        review === undefined && existing?.status !== "PASS"
        ? semanticReviewJobId(canonicalProposalId)
        : null;
      if (existing === undefined) {
        this.#saveJob(withJobHash({
          schemaVersion: evidenceClaims === undefined || evidenceClaims.length === 0
            ? "pmh.semantic-review-job.v1"
            : "pmh.semantic-review-job.v2",
          jobId,
          opportunityId: `ai:${proposalId}`,
          proposalId,
          proposalCorpusSnapshotIdentity: candidate.proposalCorpusSnapshotIdentity,
          evidenceBundle: candidate.evidenceBundle,
          ...(evidenceClaims === undefined || evidenceClaims.length === 0
            ? {}
            : { evidenceClaims }),
          reviewScopeIdentity,
          duplicateOfJobId,
          issueIds,
          priority: candidate.priority,
          status: review !== undefined
            ? "PASS"
            : !automatic
              ? "RESEARCH_ONLY"
              : duplicateOfJobId !== null
                ? "DUPLICATE_SCOPE"
                : "PENDING",
          attemptCount: 0,
          maxAttempts: this.#maxAttempts,
          nextAttemptAt: now,
          leasedAt: null,
          leaseExpiresAt: null,
          completedAt: review?.completedAt ??
            (!automatic || duplicateOfJobId !== null ? now : null),
          lastReviewId: review?.reviewId ?? null,
          recommendation: review?.report?.result.recommendation ?? null,
          diagnostic: review !== undefined
            ? null
            : !automatic
              ? researchOnlyDiagnostic(candidate)
              : duplicateOfJobId !== null
                ? duplicateScopeDiagnostic(duplicateOfJobId)
                : null,
          createdAt: now,
          updatedAt: now,
        }));
        continue;
      }
      const scopeChanged = (existing.reviewScopeIdentity ?? null) !== reviewScopeIdentity;
      if (scopeChanged && existing.status !== "LEASED" && review === undefined) {
        this.#saveJob(withJobHash({
          ...(evidenceClaims === undefined || evidenceClaims.length === 0
            ? withoutJobHashAndClaims(existing)
            : this.#withoutJobHash(existing)),
          schemaVersion: evidenceClaims === undefined || evidenceClaims.length === 0
            ? "pmh.semantic-review-job.v1"
            : "pmh.semantic-review-job.v2",
          evidenceBundle: candidate.evidenceBundle ?? existing.evidenceBundle ?? null,
          ...(evidenceClaims === undefined || evidenceClaims.length === 0
            ? {}
            : { evidenceClaims }),
          reviewScopeIdentity,
          duplicateOfJobId,
          issueIds,
          priority: candidate.priority,
          status: !automatic
            ? "RESEARCH_ONLY"
            : duplicateOfJobId === null ? "PENDING" : "DUPLICATE_SCOPE",
          attemptCount: 0,
          nextAttemptAt: now,
          leasedAt: null,
          leaseExpiresAt: null,
          completedAt: !automatic || duplicateOfJobId !== null ? now : null,
          lastReviewId: null,
          recommendation: null,
          diagnostic: !automatic
            ? researchOnlyDiagnostic(candidate)
            : duplicateOfJobId === null ? null : duplicateScopeDiagnostic(duplicateOfJobId),
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
        !automatic && existing.status !== "PASS" &&
        existing.status !== "LEASED" && existing.status !== "RESEARCH_ONLY"
      ) {
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(existing),
          reviewScopeIdentity,
          duplicateOfJobId: null,
          status: "RESEARCH_ONLY",
          completedAt: now,
          lastReviewId: null,
          recommendation: null,
          diagnostic: researchOnlyDiagnostic(candidate),
          leasedAt: null,
          leaseExpiresAt: null,
          updatedAt: now,
        }));
        continue;
      }
      if (
        automatic && duplicateOfJobId === null &&
        existing.status === "DUPLICATE_SCOPE"
      ) {
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(existing),
          reviewScopeIdentity,
          duplicateOfJobId: null,
          status: "PENDING",
          completedAt: null,
          lastReviewId: null,
          recommendation: null,
          diagnostic: null,
          nextAttemptAt: now,
          updatedAt: now,
        }));
        continue;
      }
      if (
        duplicateOfJobId !== null && existing.status !== "PASS" &&
        existing.status !== "LEASED" && existing.status !== "DUPLICATE_SCOPE"
      ) {
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(existing),
          reviewScopeIdentity,
          duplicateOfJobId,
          status: "DUPLICATE_SCOPE",
          completedAt: now,
          lastReviewId: null,
          recommendation: null,
          diagnostic: duplicateScopeDiagnostic(duplicateOfJobId),
          leasedAt: null,
          leaseExpiresAt: null,
          updatedAt: now,
        }));
        continue;
      }
      if (
        existing.issueIds.join("\n") !== issueIds.join("\n") ||
        existing.priority !== candidate.priority ||
        (candidate.evidenceBundle !== null &&
          (existing.evidenceBundle?.bundleId ?? null) !== candidate.evidenceBundle.bundleId) ||
        (existing.reviewScopeIdentity ?? null) !== reviewScopeIdentity ||
        (existing.duplicateOfJobId ?? null) !== duplicateOfJobId
      ) {
        this.#saveJob(withJobHash({
          ...this.#withoutJobHash(existing),
          issueIds,
          priority: candidate.priority,
          evidenceBundle: candidate.evidenceBundle ?? existing.evidenceBundle ?? null,
          ...(evidenceClaims === undefined || evidenceClaims.length === 0
            ? {}
            : { schemaVersion: "pmh.semantic-review-job.v2" as const, evidenceClaims }),
          reviewScopeIdentity,
          duplicateOfJobId,
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
    const candidateByProposal = this.#candidateByProposal(candidates);
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
    const storedBundle = job.evidenceBundle ?? null;
    const evidenceBundle = storedBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2"
      ? storedBundle
      : candidate.evidenceBundle;
    const evidenceClaims = job.evidenceClaims ?? candidate.evidenceClaims ?? [];
    const missingListingRefs = evidenceBundle === null || evidenceBundle === undefined
      ? candidate.proposal.listingRefs.filter(
        (listingRef) => !snapshot.listings.some((listing) => listing.listingRef === listingRef),
      )
      : [];
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
        evidenceBundle ?? undefined,
        evidenceClaims,
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
        (record) => record.proposalId === job.proposalId && record.status === "PASS" &&
          (job.schemaVersion === "pmh.semantic-review-job.v2"
            ? record.corpusSnapshotIdentity === job.reviewScopeIdentity &&
              record.report?.schemaVersion === "pmh.semantic-review-report.v4"
            : record.report?.schemaVersion !== "pmh.semantic-review-report.v4"),
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

  #candidateByProposal(
    candidates: readonly SemanticReviewCandidate[],
  ): Map<Hash, SemanticReviewCandidate> {
    const byProposal = new Map(
      candidates.map((candidate) => [candidate.proposal.proposalId, candidate] as const),
    );
    for (const job of this.#jobs) {
      const bundle = job.evidenceBundle ?? null;
      if (
        bundle?.schemaVersion !== "pmh.proposal-evidence-bundle.v2" ||
        job.status === "RESEARCH_ONLY" || job.status === "DUPLICATE_SCOPE" ||
        byProposal.has(job.proposalId)
      ) continue;
      byProposal.set(job.proposalId, Object.freeze({
        proposal: bundle.proposal,
        proposalCorpusSnapshotIdentity: job.proposalCorpusSnapshotIdentity,
        evidenceBundle: bundle,
        ...(job.evidenceClaims === undefined ? {} : { evidenceClaims: job.evidenceClaims }),
        issueIds: job.issueIds,
        priority: job.priority,
      }));
    }
    return byProposal;
  }

  #reconcileEvidenceAvailability(
    candidates: readonly SemanticReviewCandidate[],
    snapshot: MarketCorpusSnapshot,
  ): void {
    const candidateByProposal = this.#candidateByProposal(candidates);
    const availableRefs = new Set(snapshot.listings.map((listing) => listing.listingRef));
    for (const job of this.#jobs.filter((item) => item.status === "BLOCKED_EVIDENCE")) {
      const candidate = candidateByProposal.get(job.proposalId);
      if (
        candidate === undefined ||
        (((job.evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2"
          ? job.evidenceBundle
          : candidate.evidenceBundle) ?? null) === null &&
          candidate.proposal.listingRefs.some((listingRef) => !availableRefs.has(listingRef)))
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
    if (
      (job.schemaVersion === "pmh.semantic-review-job.v2" && (
        review.report.schemaVersion !== "pmh.semantic-review-report.v4" ||
        review.corpusSnapshotIdentity !== job.reviewScopeIdentity
      )) ||
      (job.schemaVersion === "pmh.semantic-review-job.v1" &&
        review.report.schemaVersion === "pmh.semantic-review-report.v4")
    ) throw new Error("semantic review completion belongs to another evidence scope");
    const completed = this.#saveJob(withJobHash({
      ...this.#withoutJobHash(job),
      duplicateOfJobId: null,
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
      schemaVersion: "pmh.semantic-review-notification-dedupe.v2",
      jobId: job.jobId,
      kind,
      lastReviewId: job.lastReviewId,
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
    const scopedJobs = jobs.filter((job) =>
      (job.reviewScopeIdentity ?? null) !== null
    );
    const passedByScope = new Map<Hash, number>();
    for (const job of scopedJobs.filter((item) => item.status === "PASS")) {
      const scopeIdentity = job.reviewScopeIdentity as Hash;
      passedByScope.set(scopeIdentity, (passedByScope.get(scopeIdentity) ?? 0) + 1);
    }
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
      researchOnlyCount: jobs.filter((job) => job.status === "RESEARCH_ONLY").length,
      duplicateScopeCount: jobs.filter((job) => job.status === "DUPLICATE_SCOPE").length,
      scopedJobCount: scopedJobs.length,
      uniqueReviewScopeCount: new Set(
        scopedJobs.map((job) => job.reviewScopeIdentity as Hash),
      ).size,
      historicalRedundantPassCount: [...passedByScope.values()].reduce(
        (sum, count) => sum + Math.max(0, count - 1),
        0,
      ),
      bundledJobCount: jobs.filter(
        (job) => job.evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2",
      ).length,
      capturedOriginalJobCount: jobs.filter(
        (job) => job.evidenceBundle?.schemaVersion ===
          "pmh.proposal-evidence-bundle.v2" &&
          job.evidenceBundle.captureKind === "PROPOSAL_CORPUS",
      ).length,
      rebasedJobCount: jobs.filter(
        (job) => job.evidenceBundle?.schemaVersion ===
          "pmh.proposal-evidence-bundle.v2" &&
          job.evidenceBundle.captureKind === "EXACT_CURRENT_REBASE",
      ).length,
      legacyEvidenceDebtCount: jobs.filter(
        (job) => job.status === "BLOCKED_EVIDENCE" &&
          job.evidenceBundle?.schemaVersion !== "pmh.proposal-evidence-bundle.v2",
      ).length,
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
