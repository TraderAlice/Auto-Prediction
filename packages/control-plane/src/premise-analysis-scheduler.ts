import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketRelationProposal } from "./market-archaeologist.js";
import {
  assertPremiseAnalysisRecord,
  PremiseAnalysisBusyError,
  PremiseAnalysisDesk,
  PremiseAnalysisNotConfiguredError,
  type PremiseAnalysisRecord,
} from "./premise-analysis.js";
import { assertSemanticReviewRecord, type SemanticReviewRecord } from "./semantic-review.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 500;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_REQUESTS_PER_TICK = 3;
const DEFAULT_LEASE_TIMEOUT_MS = 330_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const JOB_KEYS_V1 = Object.freeze([
  "analysisId", "artifactHash", "attemptCount", "authority", "certificateAuthority",
  "completedAt", "createdAt", "diagnostic", "evidenceScopeIdentity", "executionAuthority",
  "exactCompilerAdmission", "interpreterIdentity", "jobId", "lastAnalysisArtifactHash",
  "leasedAt", "leaseExpiresAt", "maxAttempts", "nextAttemptAt", "proposalId",
  "providerRequestAuthority", "schemaVersion", "semanticDecisionAuthority",
  "semanticReviewArtifactHash", "status", "updatedAt",
]);
const JOB_KEYS_V2 = Object.freeze([
  ...JOB_KEYS_V1,
  "admissionLane", "issueIds", "semanticReviewJobId",
]);
const NOTIFICATION_KEYS = Object.freeze([
  "artifactHash", "createdAt", "dedupeIdentity", "jobId", "kind", "notificationId",
  "proposalId", "readAt", "schemaVersion", "status", "summary", "title",
]);

export type PremiseAnalysisJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "PASS"
  | "EXHAUSTED";

export type PremiseAnalysisCandidate = Readonly<{
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
  semanticReviewJobId: Hash;
  issueIds: readonly Hash[];
  admissionLane: "AUTO_ARBITRAGE_REVIEW" | "AUTO_PREMISE_REVIEW";
}>;

export type PremiseAnalysisJobRecord = Readonly<{
  schemaVersion: "pmh.premise-analysis-job.v1" | "pmh.premise-analysis-job.v2";
  jobId: Hash;
  analysisId: Hash;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  evidenceScopeIdentity: Hash;
  interpreterIdentity: Hash;
  semanticReviewJobId?: Hash;
  issueIds?: readonly Hash[];
  admissionLane?: "AUTO_ARBITRAGE_REVIEW" | "AUTO_PREMISE_REVIEW";
  status: PremiseAnalysisJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  lastAnalysisArtifactHash: Hash | null;
  exactCompilerAdmission: "ELIGIBLE" | "RESEARCH_ONLY" | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type PremiseAnalysisNotificationRecord = Readonly<{
  schemaVersion: "pmh.premise-analysis-notification.v1";
  notificationId: Hash;
  dedupeIdentity: Hash;
  jobId: Hash;
  proposalId: Hash;
  kind: "EXACT_RELATION_READY" | "RESEARCH_RELATION_RETAINED" | "JOB_EXHAUSTED";
  status: "UNREAD" | "READ";
  title: string;
  summary: string;
  createdAt: string;
  readAt: string | null;
  artifactHash: Hash;
}>;

export interface PremiseAnalysisSchedulerStore {
  readonly premiseAnalysisJobStorage: OperationalStorageProjection<"jobId">;
  readonly premiseAnalysisNotificationStorage: OperationalStorageProjection<"notificationId">;
  loadPremiseAnalysisJobRecords(limit: number): readonly PremiseAnalysisJobRecord[];
  savePremiseAnalysisJobRecord(
    record: PremiseAnalysisJobRecord,
    retentionLimit: number,
  ): PremiseAnalysisJobRecord;
  loadPremiseAnalysisNotificationRecords(
    limit: number,
  ): readonly PremiseAnalysisNotificationRecord[];
  savePremiseAnalysisNotificationRecord(
    record: PremiseAnalysisNotificationRecord,
    retentionLimit: number,
  ): PremiseAnalysisNotificationRecord;
}

export type PremiseAnalysisSchedulerProjection = Readonly<{
  schemaVersion: "pmh.premise-analysis-scheduler.v2";
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
  passedCount: number;
  exhaustedCount: number;
  exactEligibleCount: number;
  researchOnlyCount: number;
  attributedJobCount: number;
  legacyAttributionDebtCount: number;
  unreadNotificationCount: number;
  budget: Readonly<{
    basis: "PROVIDER_ATTEMPTS";
    maxAttemptsPerJob: number;
    maxRequestsPerTick: number;
    providerAttemptsStarted: number;
  }>;
  jobs: readonly PremiseAnalysisJobRecord[];
  notifications: readonly PremiseAnalysisNotificationRecord[];
  storage: OperationalStorageProjection<"jobId">;
  notificationStorage: OperationalStorageProjection<"notificationId">;
  authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY";
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
  desk: PremiseAnalysisDesk;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: PremiseAnalysisSchedulerStore;
  now?: () => number;
}>;

function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function compactDiagnostic(value: unknown): string {
  return (value instanceof Error ? value.message : String(value))
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "premise analysis job failed";
}

function withoutHash(
  record: PremiseAnalysisJobRecord,
): Omit<PremiseAnalysisJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withHash(
  body: Omit<PremiseAnalysisJobRecord, "artifactHash">,
): PremiseAnalysisJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withoutNotificationHash(
  record: PremiseAnalysisNotificationRecord,
): Omit<PremiseAnalysisNotificationRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withNotificationHash(
  body: Omit<PremiseAnalysisNotificationRecord, "artifactHash">,
): PremiseAnalysisNotificationRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertPremiseAnalysisJobRecord(value: unknown): PremiseAnalysisJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored premise analysis job is malformed");
  }
  const record = value as PremiseAnalysisJobRecord;
  const leased = record.status === "LEASED";
  const terminal = record.status === "PASS" || record.status === "EXHAUSTED";
  const { artifactHash, ...body } = record;
  if (
    !["pmh.premise-analysis-job.v1", "pmh.premise-analysis-job.v2"]
      .includes(record.schemaVersion) ||
    !exactKeys(record, record.schemaVersion === "pmh.premise-analysis-job.v1"
      ? JOB_KEYS_V1
      : JOB_KEYS_V2) ||
    !HASH_PATTERN.test(String(record.jobId)) || record.jobId !== record.analysisId ||
    !HASH_PATTERN.test(String(record.analysisId)) || !HASH_PATTERN.test(String(record.proposalId)) ||
    !HASH_PATTERN.test(String(record.semanticReviewArtifactHash)) ||
    !HASH_PATTERN.test(String(record.evidenceScopeIdentity)) ||
    !HASH_PATTERN.test(String(record.interpreterIdentity)) ||
    (record.schemaVersion === "pmh.premise-analysis-job.v1" && (
      record.semanticReviewJobId !== undefined || record.issueIds !== undefined ||
      record.admissionLane !== undefined
    )) ||
    (record.schemaVersion === "pmh.premise-analysis-job.v2" && (
      !HASH_PATTERN.test(String(record.semanticReviewJobId)) ||
      record.semanticReviewJobId !== hashCanonical({
        schemaVersion: "pmh.semantic-review-job-id.v1",
        proposalId: record.proposalId,
      }) ||
      !Array.isArray(record.issueIds) || record.issueIds.length < 1 ||
      record.issueIds.length > 20 || new Set(record.issueIds).size !== record.issueIds.length ||
      record.issueIds.some((item) => !HASH_PATTERN.test(String(item))) ||
      !["AUTO_ARBITRAGE_REVIEW", "AUTO_PREMISE_REVIEW"].includes(
        String(record.admissionLane),
      )
    )) ||
    record.analysisId !== hashCanonical({
      schemaVersion: "pmh.premise-analysis-run.v1",
      proposalId: record.proposalId,
      semanticReviewArtifactHash: record.semanticReviewArtifactHash,
      evidenceScopeIdentity: record.evidenceScopeIdentity,
      interpreterIdentity: record.interpreterIdentity,
    }) ||
    !["PENDING", "LEASED", "RETRY_WAIT", "PASS", "EXHAUSTED"].includes(record.status) ||
    !Number.isSafeInteger(record.attemptCount) || record.attemptCount < 0 ||
    !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1 ||
    record.maxAttempts > 10 || record.attemptCount > record.maxAttempts ||
    !isIso(record.nextAttemptAt) ||
    leased !== (record.leasedAt !== null && record.leaseExpiresAt !== null) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    terminal !== (record.completedAt !== null) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (record.status === "PASS") !== (record.lastAnalysisArtifactHash !== null) ||
    (record.lastAnalysisArtifactHash !== null &&
      !HASH_PATTERN.test(String(record.lastAnalysisArtifactHash))) ||
    (record.status === "PASS") !== (record.exactCompilerAdmission !== null) ||
    (record.exactCompilerAdmission !== null &&
      !["ELIGIBLE", "RESEARCH_ONLY"].includes(record.exactCompilerAdmission)) ||
    (record.status === "PASS" && record.diagnostic !== null) ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    Date.parse(record.updatedAt) < Date.parse(record.createdAt) ||
    record.authority !== "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY" ||
    record.providerRequestAuthority !== false || record.semanticDecisionAuthority !== false ||
    record.certificateAuthority !== false || record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored premise analysis job violates its bounded authority contract");
  return Object.freeze(record);
}

export function assertPremiseAnalysisNotificationRecord(
  value: unknown,
): PremiseAnalysisNotificationRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored premise analysis notification is malformed");
  }
  const record = value as PremiseAnalysisNotificationRecord;
  const { artifactHash, ...body } = record;
  if (
    !exactKeys(record, NOTIFICATION_KEYS) ||
    record.schemaVersion !== "pmh.premise-analysis-notification.v1" ||
    !HASH_PATTERN.test(String(record.notificationId)) ||
    !HASH_PATTERN.test(String(record.dedupeIdentity)) ||
    !HASH_PATTERN.test(String(record.jobId)) || !HASH_PATTERN.test(String(record.proposalId)) ||
    !["EXACT_RELATION_READY", "RESEARCH_RELATION_RETAINED", "JOB_EXHAUSTED"]
      .includes(record.kind) ||
    !["UNREAD", "READ"].includes(record.status) ||
    !boundedText(record.title, 160) || !boundedText(record.summary, 500) ||
    !isIso(record.createdAt) || (record.readAt !== null && !isIso(record.readAt)) ||
    (record.status === "UNREAD" ? record.readAt !== null : record.readAt === null) ||
    record.notificationId !== hashCanonical({
      schemaVersion: "pmh.premise-analysis-notification-id.v1",
      dedupeIdentity: record.dedupeIdentity,
    }) ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored premise analysis notification violates its bounded contract");
  return Object.freeze(record);
}

export class PremiseAnalysisScheduler {
  readonly #jobs: PremiseAnalysisJobRecord[];
  readonly #notifications: PremiseAnalysisNotificationRecord[];
  readonly #active = new Map<Hash, Promise<PremiseAnalysisJobRecord>>();
  readonly #desk: PremiseAnalysisDesk;
  readonly #store: PremiseAnalysisSchedulerStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #maxAttempts: number;
  readonly #maxRequestsPerTick: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SchedulerOptions) {
    this.#desk = options.desk;
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
      (this.tickIntervalMs !== null && (!Number.isSafeInteger(this.tickIntervalMs) ||
        this.tickIntervalMs < 1_000 || this.tickIntervalMs > 60_000)) ||
      !Number.isSafeInteger(this.#concurrencyLimit) || this.#concurrencyLimit < 1 ||
      this.#concurrencyLimit > 8 || !Number.isSafeInteger(this.#maxAttempts) ||
      this.#maxAttempts < 1 || this.#maxAttempts > 10 ||
      !Number.isSafeInteger(this.#maxRequestsPerTick) || this.#maxRequestsPerTick < 1 ||
      this.#maxRequestsPerTick > 8 || !Number.isSafeInteger(this.#leaseTimeoutMs) ||
      this.#leaseTimeoutMs < 1_000 || this.#leaseTimeoutMs > 900_000 ||
      !Number.isSafeInteger(this.#retryDelayMs) || this.#retryDelayMs < 1_000 ||
      this.#retryDelayMs > 86_400_000 || !Number.isSafeInteger(this.#retentionLimit) ||
      this.#retentionLimit < 10
    ) throw new Error("premise analysis scheduler configuration is invalid or unbounded");
    this.#jobs = [...(
      this.#store?.loadPremiseAnalysisJobRecords(this.#retentionLimit) ?? []
    )].map(assertPremiseAnalysisJobRecord);
    this.#notifications = [...(
      this.#store?.loadPremiseAnalysisNotificationRecords(this.#retentionLimit) ?? []
    )].map(assertPremiseAnalysisNotificationRecord);
    for (const job of this.#jobs) {
      if (job.status === "PASS") {
        this.#notify(
          job,
          job.exactCompilerAdmission === "ELIGIBLE"
            ? "EXACT_RELATION_READY"
            : "RESEARCH_RELATION_RETAINED",
        );
      } else if (job.status === "EXHAUSTED") {
        this.#notify(job, "JOB_EXHAUSTED");
      }
    }
  }

  public reconcile(candidates: readonly PremiseAnalysisCandidate[]): void {
    const validated = [...new Map(candidates.map((candidate) => {
      const review = assertSemanticReviewRecord(candidate.review);
      if (
        candidate.semanticReviewJobId !== hashCanonical({
          schemaVersion: "pmh.semantic-review-job-id.v1",
          proposalId: candidate.proposal.proposalId,
        }) || !Array.isArray(candidate.issueIds) || candidate.issueIds.length < 1 ||
        candidate.issueIds.length > 20 || new Set(candidate.issueIds).size !==
          candidate.issueIds.length ||
        candidate.issueIds.some((item) => !HASH_PATTERN.test(String(item))) ||
        !["AUTO_ARBITRAGE_REVIEW", "AUTO_PREMISE_REVIEW"].includes(candidate.admissionLane)
      ) throw new Error("premise analysis candidate attribution is malformed");
      const jobId = this.#desk.idFor(candidate.proposal, review);
      return [jobId, Object.freeze({
        proposal: candidate.proposal,
        review,
        semanticReviewJobId: candidate.semanticReviewJobId,
        issueIds: Object.freeze([...candidate.issueIds]),
        admissionLane: candidate.admissionLane,
      })] as const;
    })).entries()].sort(([left], [right]) => left.localeCompare(right));
    const completedById = new Map(this.#desk.projection().records.map((record) =>
      [record.analysisId, record] as const
    ));
    const timestamp = new Date(this.#now()).toISOString();
    for (const [jobId, candidate] of validated) {
      const report = candidate.review.report!;
      let existing = this.#jobs.find((job) => job.jobId === jobId);
      const completed = completedById.get(jobId);
      if (existing?.schemaVersion === "pmh.premise-analysis-job.v1") {
        existing = this.#save(withHash({
          ...withoutHash(existing),
          schemaVersion: "pmh.premise-analysis-job.v2",
          semanticReviewJobId: candidate.semanticReviewJobId,
          issueIds: Object.freeze([...candidate.issueIds].sort()),
          admissionLane: candidate.admissionLane,
          updatedAt: timestamp,
        }));
      }
      if (existing === undefined) {
        const analysis = completed?.status === "PASS" ? completed.analysis : null;
        const created = this.#save(withHash({
          schemaVersion: "pmh.premise-analysis-job.v2",
          jobId,
          analysisId: jobId,
          proposalId: candidate.proposal.proposalId,
          semanticReviewArtifactHash: report.artifactHash,
          evidenceScopeIdentity: candidate.review.corpusSnapshotIdentity,
          interpreterIdentity: this.#desk.interpreterIdentity,
          semanticReviewJobId: candidate.semanticReviewJobId,
          issueIds: Object.freeze([...candidate.issueIds].sort()),
          admissionLane: candidate.admissionLane,
          status: analysis === null ? "PENDING" : "PASS",
          attemptCount: 0,
          maxAttempts: this.#maxAttempts,
          nextAttemptAt: timestamp,
          leasedAt: null,
          leaseExpiresAt: null,
          completedAt: analysis?.completedAt ?? null,
          lastAnalysisArtifactHash: analysis?.artifactHash ?? null,
          exactCompilerAdmission: analysis?.relation.exactCompilerAdmission ?? null,
          diagnostic: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY",
          providerRequestAuthority: false,
          semanticDecisionAuthority: false,
          certificateAuthority: false,
          executionAuthority: false,
        }));
        if (analysis !== null) {
          this.#notify(
            created,
            analysis.relation.exactCompilerAdmission === "ELIGIBLE"
              ? "EXACT_RELATION_READY"
              : "RESEARCH_RELATION_RETAINED",
          );
        }
      } else if (completed?.status === "PASS" && existing.status !== "PASS") {
        this.#complete(existing, completed);
      }
    }
    this.#recoverExpiredLeases();
  }

  public tick(
    candidates: readonly PremiseAnalysisCandidate[],
  ): readonly Promise<PremiseAnalysisJobRecord>[] {
    this.reconcile(candidates);
    if (this.tickIntervalMs === null || !this.#desk.projection().configured) {
      return Object.freeze([]);
    }
    const available = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#desk.concurrencyLimit - this.#desk.projection().activeCount,
      this.#maxRequestsPerTick,
    );
    if (available <= 0) return Object.freeze([]);
    const candidateByJob = new Map(candidates.map((candidate) => [
      this.#desk.idFor(candidate.proposal, candidate.review), candidate,
    ] as const));
    const now = this.#now();
    const due = this.#jobs.filter((job) =>
      ["PENDING", "RETRY_WAIT"].includes(job.status) &&
      Date.parse(job.nextAttemptAt) <= now && !this.#active.has(job.jobId) &&
      candidateByJob.has(job.jobId)
    ).sort((left, right) =>
      Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt) ||
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    ).slice(0, available);
    return Object.freeze(due.map((job) => this.#dispatch(job, candidateByJob.get(job.jobId)!)));
  }

  #dispatch(
    job: PremiseAnalysisJobRecord,
    candidate: PremiseAnalysisCandidate,
  ): Promise<PremiseAnalysisJobRecord> {
    const startedAt = this.#now();
    const leased = this.#save(withHash({
      ...withoutHash(job),
      status: "LEASED",
      attemptCount: job.attemptCount + 1,
      leasedAt: new Date(startedAt).toISOString(),
      leaseExpiresAt: new Date(startedAt + this.#leaseTimeoutMs).toISOString(),
      diagnostic: null,
      updatedAt: new Date(startedAt).toISOString(),
    }));
    let invocation;
    try {
      invocation = this.#desk.begin(candidate.proposal, candidate.review);
    } catch (error) {
      const capacity = error instanceof PremiseAnalysisBusyError ||
        error instanceof PremiseAnalysisNotConfiguredError;
      return Promise.resolve(this.#save(withHash({
        ...withoutHash(leased),
        status: "PENDING",
        attemptCount: capacity ? job.attemptCount : leased.attemptCount,
        leasedAt: null,
        leaseExpiresAt: null,
        diagnostic: compactDiagnostic(error),
        updatedAt: new Date(this.#now()).toISOString(),
      })));
    }
    const promise = invocation.promise.then((record) => {
      this.#active.delete(job.jobId);
      if (record.status === "PASS") return this.#complete(leased, record);
      const now = Math.max(this.#now(), startedAt);
      const exhausted = leased.attemptCount >= leased.maxAttempts;
      const completed = this.#save(withHash({
        ...withoutHash(leased),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * leased.attemptCount,
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        diagnostic: compactDiagnostic(record.diagnostic ?? "premise analysis failed"),
        updatedAt: new Date(now).toISOString(),
      }));
      if (exhausted) this.#notify(completed, "JOB_EXHAUSTED");
      return completed;
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #complete(
    job: PremiseAnalysisJobRecord,
    input: PremiseAnalysisRecord,
  ): PremiseAnalysisJobRecord {
    const record = assertPremiseAnalysisRecord(input);
    if (
      record.status !== "PASS" || record.analysis === null ||
      record.analysisId !== job.analysisId || record.proposalId !== job.proposalId ||
      record.semanticReviewArtifactHash !== job.semanticReviewArtifactHash ||
      record.evidenceScopeIdentity !== job.evidenceScopeIdentity ||
      record.interpreterIdentity !== job.interpreterIdentity || record.completedAt === null
    ) throw new Error("premise analysis job completion lineage is inconsistent");
    const completed = this.#save(withHash({
      ...withoutHash(job),
      status: "PASS",
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt: record.completedAt,
      lastAnalysisArtifactHash: record.analysis.artifactHash,
      exactCompilerAdmission: record.analysis.relation.exactCompilerAdmission,
      diagnostic: null,
      updatedAt: record.completedAt,
    }));
    this.#notify(
      completed,
      completed.exactCompilerAdmission === "ELIGIBLE"
        ? "EXACT_RELATION_READY"
        : "RESEARCH_RELATION_RETAINED",
    );
    return completed;
  }

  #recoverExpiredLeases(): void {
    const now = this.#now();
    for (const job of this.#jobs.filter((item) =>
      item.status === "LEASED" && item.leaseExpiresAt !== null &&
      Date.parse(item.leaseExpiresAt) <= now && !this.#active.has(item.jobId)
    )) {
      const completed = this.#desk.projection().records.find((record) =>
        record.analysisId === job.analysisId && record.status === "PASS"
      );
      if (completed !== undefined) {
        this.#complete(job, completed);
        continue;
      }
      const exhausted = job.attemptCount >= job.maxAttempts;
      const recovered = this.#save(withHash({
        ...withoutHash(job),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * Math.max(1, job.attemptCount),
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        diagnostic: exhausted
          ? "premise analysis lease expired after provider budget exhaustion"
          : "premise analysis lease expired before a durable result was observed",
        updatedAt: new Date(now).toISOString(),
      }));
      if (exhausted) this.#notify(recovered, "JOB_EXHAUSTED");
    }
  }

  #notify(
    job: PremiseAnalysisJobRecord,
    kind: PremiseAnalysisNotificationRecord["kind"],
  ): void {
    const dedupeIdentity = hashCanonical({
      schemaVersion: "pmh.premise-analysis-notification-dedupe.v1",
      jobId: job.jobId,
      kind,
      lastAnalysisArtifactHash: job.lastAnalysisArtifactHash,
    });
    if (this.#notifications.some((item) => item.dedupeIdentity === dedupeIdentity)) return;
    const createdAt = job.completedAt ?? new Date(this.#now()).toISOString();
    this.#saveNotification(withNotificationHash({
      schemaVersion: "pmh.premise-analysis-notification.v1",
      notificationId: hashCanonical({
        schemaVersion: "pmh.premise-analysis-notification-id.v1",
        dedupeIdentity,
      }),
      dedupeIdentity,
      jobId: job.jobId,
      proposalId: job.proposalId,
      kind,
      status: "UNREAD",
      title: kind === "EXACT_RELATION_READY"
        ? "Exact premise relation is ready"
        : kind === "RESEARCH_RELATION_RETAINED"
          ? "Premise-dependent relation retained"
          : "Premise analysis exhausted",
      summary: kind === "EXACT_RELATION_READY"
        ? "All hidden premises and joint truth states replayed successfully; deterministic payoff compilation may now evaluate this relation."
        : kind === "RESEARCH_RELATION_RETAINED"
          ? "The Agent found a meaningful semantic dependency, but an unverified or causal premise still blocks exact arbitrage admission."
          : compactDiagnostic(job.diagnostic ?? "Premise-analysis attempts were exhausted."),
      createdAt,
      readAt: null,
    }));
  }

  public acknowledge(notificationId: Hash): PremiseAnalysisNotificationRecord {
    const notification = this.#notifications.find((item) =>
      item.notificationId === notificationId
    );
    if (notification === undefined) throw new Error("premise analysis notification was not found");
    if (notification.status === "READ") return notification;
    return this.#saveNotification(withNotificationHash({
      ...withoutNotificationHash(notification),
      status: "READ",
      readAt: new Date(this.#now()).toISOString(),
    }));
  }

  #save(input: PremiseAnalysisJobRecord): PremiseAnalysisJobRecord {
    const valid = assertPremiseAnalysisJobRecord(input);
    const stored = this.#store?.savePremiseAnalysisJobRecord(
      valid,
      this.#retentionLimit,
    ) ?? valid;
    const index = this.#jobs.findIndex((item) => item.jobId === stored.jobId);
    if (index >= 0) this.#jobs.splice(index, 1);
    this.#jobs.push(stored);
    this.#jobs.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) this.#jobs.length = this.#retentionLimit;
    return stored;
  }

  #saveNotification(
    input: PremiseAnalysisNotificationRecord,
  ): PremiseAnalysisNotificationRecord {
    const valid = assertPremiseAnalysisNotificationRecord(input);
    const stored = this.#store?.savePremiseAnalysisNotificationRecord(
      valid,
      this.#retentionLimit,
    ) ?? valid;
    const index = this.#notifications.findIndex((item) =>
      item.notificationId === stored.notificationId
    );
    if (index >= 0) this.#notifications.splice(index, 1);
    this.#notifications.unshift(stored);
    if (this.#notifications.length > this.#retentionLimit) {
      this.#notifications.length = this.#retentionLimit;
    }
    return stored;
  }

  public awaitIdle(): Promise<readonly PremiseAnalysisJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): PremiseAnalysisSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const notifications = Object.freeze([...this.#notifications]);
    const configured = this.#desk.projection().configured;
    const now = this.#now();
    return Object.freeze({
      schemaVersion: "pmh.premise-analysis-scheduler.v2",
      enabled: this.tickIntervalMs !== null,
      configured,
      status: !configured ? "NEEDS_KEY" : this.#active.size > 0 ? "RUNNING" : "IDLE",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      dueCount: jobs.filter((job) =>
        ["PENDING", "RETRY_WAIT"].includes(job.status) &&
        Date.parse(job.nextAttemptAt) <= now
      ).length,
      pendingCount: jobs.filter((job) => job.status === "PENDING").length,
      leasedCount: jobs.filter((job) => job.status === "LEASED").length,
      retryWaitCount: jobs.filter((job) => job.status === "RETRY_WAIT").length,
      passedCount: jobs.filter((job) => job.status === "PASS").length,
      exhaustedCount: jobs.filter((job) => job.status === "EXHAUSTED").length,
      exactEligibleCount: jobs.filter((job) => job.exactCompilerAdmission === "ELIGIBLE").length,
      researchOnlyCount: jobs.filter((job) =>
        job.exactCompilerAdmission === "RESEARCH_ONLY"
      ).length,
      attributedJobCount: jobs.filter((job) => job.schemaVersion === "pmh.premise-analysis-job.v2").length,
      legacyAttributionDebtCount: jobs.filter((job) =>
        job.schemaVersion === "pmh.premise-analysis-job.v1"
      ).length,
      unreadNotificationCount: notifications.filter((item) => item.status === "UNREAD").length,
      budget: Object.freeze({
        basis: "PROVIDER_ATTEMPTS" as const,
        maxAttemptsPerJob: this.#maxAttempts,
        maxRequestsPerTick: this.#maxRequestsPerTick,
        providerAttemptsStarted: jobs.reduce((sum, job) => sum + job.attemptCount, 0),
      }),
      jobs,
      notifications,
      storage: this.#store?.premiseAnalysisJobStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "jobId" as const,
      }),
      notificationStorage: this.#store?.premiseAnalysisNotificationStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "notificationId" as const,
      }),
      authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY",
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

export function parsePremiseAnalysisTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_PREMISE_ANALYSIS_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error("PMH_PREMISE_ANALYSIS_TICK_MS must be 0 or an integer from 1000 to 60000");
  }
  return value;
}
