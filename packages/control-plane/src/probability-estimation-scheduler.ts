import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  assertProbabilityEstimationRunRecord,
  ProbabilityEstimationDesk,
  PROBABILITY_ESTIMATOR_ROLES,
  type ProbabilityEstimationRunRecord,
  type ProbabilityEstimatorRole,
} from "./probability-estimation-agent.js";
import {
  assertProbabilisticSemanticBound,
  buildProbabilisticSemanticBound,
  type ProbabilisticSemanticBoundArtifact,
} from "./probabilistic-semantic-arbitrage.js";
import {
  assertSemanticConstraintArtifact,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";
import { assertSemanticReviewRecord, type SemanticReviewRecord } from "./semantic-review.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 750;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_REQUESTS_PER_TICK = 3;
const DEFAULT_LEASE_TIMEOUT_MS = 330_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;

export type ProbabilityEstimationJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "BLOCKED_EVIDENCE"
  | "PASS"
  | "ABSTAINED"
  | "EXHAUSTED";

export type ProbabilityAdverseStateDerivation = Readonly<{
  status: "SUPPORTED" | "UNSUPPORTED";
  adverseStateIds: readonly string[];
  diagnostic: string | null;
}>;

export type ProbabilityEstimationCandidate = Readonly<{
  review: SemanticReviewRecord;
}>;

export type ProbabilityEstimationJobRecord = Readonly<{
  schemaVersion: "pmh.probability-estimation-job.v1";
  jobId: Hash;
  caseIdentity: Hash;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  semanticConstraintArtifactHash: Hash;
  semanticConstraint: SemanticConstraintArtifact;
  evidenceScopeIdentity: Hash;
  adverseStateIds: readonly string[];
  role: ProbabilityEstimatorRole;
  model: string;
  status: ProbabilityEstimationJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  lastRunId: Hash | null;
  lastEstimateIdentity: Hash | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "ESTIMATION_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  hardArbitrageAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type ProbabilityEstimationNotificationRecord = Readonly<{
  schemaVersion: "pmh.probability-estimation-notification.v1";
  notificationId: Hash;
  dedupeIdentity: Hash;
  caseIdentity: Hash;
  proposalId: Hash;
  kind: "BOUND_READY" | "ESTIMATION_ABSTAINED" | "ESTIMATION_EXHAUSTED";
  status: "UNREAD" | "READ";
  boundArtifactHash: Hash | null;
  title: string;
  summary: string;
  createdAt: string;
  readAt: string | null;
  artifactHash: Hash;
}>;

export interface ProbabilityEstimationSchedulerStore {
  readonly probabilityEstimationJobStorage: OperationalStorageProjection<"jobId">;
  readonly probabilityEstimationNotificationStorage:
    OperationalStorageProjection<"notificationId">;
  loadProbabilityEstimationJobRecords(limit: number): readonly ProbabilityEstimationJobRecord[];
  saveProbabilityEstimationJobRecord(
    record: ProbabilityEstimationJobRecord,
    retentionLimit: number,
  ): ProbabilityEstimationJobRecord;
  loadProbabilityEstimationNotificationRecords(
    limit: number,
  ): readonly ProbabilityEstimationNotificationRecord[];
  saveProbabilityEstimationNotificationRecord(
    record: ProbabilityEstimationNotificationRecord,
    retentionLimit: number,
  ): ProbabilityEstimationNotificationRecord;
}

export type ProbabilityEstimationSchedulerProjection = Readonly<{
  schemaVersion: "pmh.probability-estimation-scheduler.v1";
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
  abstainedCount: number;
  exhaustedCount: number;
  caseCount: number;
  boundReadyCount: number;
  freshBoundCount: number;
  unsupportedCandidateCount: number;
  unreadNotificationCount: number;
  budget: Readonly<{
    basis: "PROVIDER_ATTEMPTS";
    maxAttemptsPerRole: number;
    maxRequestsPerTick: number;
    providerAttemptsStarted: number;
  }>;
  jobs: readonly ProbabilityEstimationJobRecord[];
  bounds: readonly ProbabilisticSemanticBoundArtifact[];
  notifications: readonly ProbabilityEstimationNotificationRecord[];
  storage: Readonly<{
    jobs: OperationalStorageProjection<"jobId">;
    notifications: OperationalStorageProjection<"notificationId">;
  }>;
  authority: "ESTIMATION_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  hardArbitrageAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type SchedulerOptions = Readonly<{
  desk: ProbabilityEstimationDesk;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: ProbabilityEstimationSchedulerStore;
  now?: () => number;
}>;

function isIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function compactDiagnostic(value: unknown): string {
  return (value instanceof Error ? value.message : String(value))
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "probability estimation job failed";
}

function truthCount(stateId: string): number {
  return [...stateId].filter((value) => value === "T").length;
}

export function deriveProbabilityAdverseStates(
  constraintInput: SemanticConstraintArtifact,
): ProbabilityAdverseStateDerivation {
  const constraint = assertSemanticConstraintArtifact(constraintInput);
  const states = constraint.truthTable.map((state) => state.stateId);
  if (
    constraint.classification !== "PROBABILISTIC_DEPENDENCE" ||
    constraint.listingRefs.length < 2 || constraint.listingRefs.length > 4
  ) return Object.freeze({
    status: "UNSUPPORTED",
    adverseStateIds: Object.freeze([]),
    diagnostic: "Probability scheduling requires a complete 2–4 listing probabilistic constraint.",
  });
  let adverse: readonly string[];
  switch (constraint.relationKind) {
    case "MUTUALLY_EXCLUSIVE":
      adverse = states.filter((stateId) => truthCount(stateId) > 1);
      break;
    case "EXHAUSTIVE":
      adverse = states.filter((stateId) => truthCount(stateId) === 0);
      break;
    case "EQUIVALENT":
      adverse = states.filter((stateId) =>
        truthCount(stateId) !== 0 && truthCount(stateId) !== constraint.listingRefs.length
      );
      break;
    case "IMPLIES":
    case "SUBSET":
      adverse = constraint.listingRefs.length === 2 && states.includes("TF") ? ["TF"] : [];
      break;
    case "CONDITIONAL":
      adverse = constraint.counterexampleAttempt.stateId !== null &&
          states.includes(constraint.counterexampleAttempt.stateId)
        ? [constraint.counterexampleAttempt.stateId]
        : [];
      break;
    default:
      adverse = [];
  }
  const feasible = Object.freeze([...new Set(adverse.filter((stateId) =>
    constraint.truthTable.find((state) => state.stateId === stateId)?.disposition !== "IMPOSSIBLE"
  ))].sort());
  if (feasible.length === 0 || feasible.length >= states.length) return Object.freeze({
    status: "UNSUPPORTED",
    adverseStateIds: Object.freeze([]),
    diagnostic: `${constraint.relationKind} does not identify a bounded adverse joint-state set.`,
  });
  return Object.freeze({ status: "SUPPORTED", adverseStateIds: feasible, diagnostic: null });
}

function caseIdentity(input: Readonly<{
  semanticReviewArtifactHash: Hash;
  semanticConstraintArtifactHash: Hash;
  evidenceScopeIdentity: Hash;
  adverseStateIds: readonly string[];
  model: string;
}>): Hash {
  return hashCanonical({ schemaVersion: "pmh.probability-estimation-case-id.v1", ...input });
}

function jobId(caseId: Hash, role: ProbabilityEstimatorRole): Hash {
  return hashCanonical({
    schemaVersion: "pmh.probability-estimation-job-id.v1",
    caseIdentity: caseId,
    role,
  });
}

function withoutHash(
  record: ProbabilityEstimationJobRecord,
): Omit<ProbabilityEstimationJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withHash(
  body: Omit<ProbabilityEstimationJobRecord, "artifactHash">,
): ProbabilityEstimationJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withoutNotificationHash(
  record: ProbabilityEstimationNotificationRecord,
): Omit<ProbabilityEstimationNotificationRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withNotificationHash(
  body: Omit<ProbabilityEstimationNotificationRecord, "artifactHash">,
): ProbabilityEstimationNotificationRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertProbabilityEstimationJobRecord(
  value: unknown,
): ProbabilityEstimationJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored probability estimation job is malformed");
  }
  const record = value as ProbabilityEstimationJobRecord;
  const { artifactHash, ...body } = record;
  const constraint = assertSemanticConstraintArtifact(record.semanticConstraint);
  const terminal = ["PASS", "ABSTAINED", "EXHAUSTED"].includes(record.status);
  const leased = record.status === "LEASED";
  const expectedCaseIdentity = caseIdentity({
    semanticReviewArtifactHash: record.semanticReviewArtifactHash,
    semanticConstraintArtifactHash: record.semanticConstraintArtifactHash,
    evidenceScopeIdentity: record.evidenceScopeIdentity,
    adverseStateIds: record.adverseStateIds,
    model: record.model,
  });
  if (
    record.schemaVersion !== "pmh.probability-estimation-job.v1" ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    record.jobId !== jobId(record.caseIdentity, record.role) ||
    !HASH_PATTERN.test(String(record.caseIdentity)) ||
    record.caseIdentity !== expectedCaseIdentity ||
    record.proposalId !== constraint.proposalId ||
    record.semanticConstraintArtifactHash !== constraint.artifactHash ||
    constraint.classification !== "PROBABILISTIC_DEPENDENCE" ||
    !HASH_PATTERN.test(String(record.semanticReviewArtifactHash)) ||
    !HASH_PATTERN.test(String(record.evidenceScopeIdentity)) ||
    !Array.isArray(record.adverseStateIds) || record.adverseStateIds.length < 1 ||
    new Set(record.adverseStateIds).size !== record.adverseStateIds.length ||
    [...record.adverseStateIds].sort().join("\n") !== record.adverseStateIds.join("\n") ||
    record.adverseStateIds.some((stateId) =>
      constraint.truthTable.find((state) => state.stateId === stateId) === undefined
    ) ||
    !PROBABILITY_ESTIMATOR_ROLES.includes(record.role) ||
    !boundedText(record.model, 100) ||
    ![
      "PENDING", "LEASED", "RETRY_WAIT", "BLOCKED_EVIDENCE", "PASS",
      "ABSTAINED", "EXHAUSTED",
    ].includes(record.status) ||
    !Number.isSafeInteger(record.attemptCount) || record.attemptCount < 0 ||
    !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1 ||
    record.maxAttempts > 10 || record.attemptCount > record.maxAttempts ||
    !isIso(record.nextAttemptAt) ||
    leased !== (record.leasedAt !== null && record.leaseExpiresAt !== null) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    terminal !== (record.completedAt !== null) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (["PASS", "ABSTAINED"].includes(record.status) && record.lastRunId === null) ||
    (["PENDING", "RETRY_WAIT", "BLOCKED_EVIDENCE", "EXHAUSTED"].includes(
      record.status,
    ) && record.lastRunId !== null) ||
    (record.lastRunId !== null && !HASH_PATTERN.test(String(record.lastRunId))) ||
    ((record.status === "PASS") !== (record.lastEstimateIdentity !== null)) ||
    (record.lastEstimateIdentity !== null &&
      !HASH_PATTERN.test(String(record.lastEstimateIdentity))) ||
    (record.status === "PASS" && record.diagnostic !== null) ||
    (record.status === "ABSTAINED" && !boundedText(record.diagnostic, 500)) ||
    (record.status === "BLOCKED_EVIDENCE" && !boundedText(record.diagnostic, 500)) ||
    (record.status === "EXHAUSTED" && !boundedText(record.diagnostic, 500)) ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    Date.parse(record.updatedAt) < Date.parse(record.createdAt) ||
    record.authority !== "ESTIMATION_ORCHESTRATION_ONLY" ||
    record.semanticDecisionAuthority !== false ||
    record.probabilityCertificateAuthority !== false ||
    record.hardArbitrageAuthority !== false || record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored probability estimation job violates its bounded contract");
  return Object.freeze(record);
}

export function assertProbabilityEstimationNotificationRecord(
  value: unknown,
): ProbabilityEstimationNotificationRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored probability estimation notification is malformed");
  }
  const record = value as ProbabilityEstimationNotificationRecord;
  const { artifactHash, ...body } = record;
  if (
    record.schemaVersion !== "pmh.probability-estimation-notification.v1" ||
    !HASH_PATTERN.test(String(record.notificationId)) ||
    !HASH_PATTERN.test(String(record.dedupeIdentity)) ||
    !HASH_PATTERN.test(String(record.caseIdentity)) ||
    !HASH_PATTERN.test(String(record.proposalId)) ||
    !["BOUND_READY", "ESTIMATION_ABSTAINED", "ESTIMATION_EXHAUSTED"]
      .includes(record.kind) ||
    !["UNREAD", "READ"].includes(record.status) ||
    ((record.kind === "BOUND_READY") !== (record.boundArtifactHash !== null)) ||
    (record.boundArtifactHash !== null && !HASH_PATTERN.test(record.boundArtifactHash)) ||
    !boundedText(record.title, 160) || !boundedText(record.summary, 500) ||
    !isIso(record.createdAt) || (record.readAt !== null && !isIso(record.readAt)) ||
    (record.status === "UNREAD" ? record.readAt !== null : record.readAt === null) ||
    record.notificationId !== hashCanonical({
      schemaVersion: "pmh.probability-estimation-notification-id.v1",
      dedupeIdentity: record.dedupeIdentity,
    }) ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored probability estimation notification violates its bounded contract");
  return Object.freeze(record);
}

function exactReviewedCorpusAvailable(
  constraint: SemanticConstraintArtifact,
  snapshot: MarketCorpusSnapshot,
): boolean {
  return constraint.ruleEvidence.every((evidence) => {
    const listing = snapshot.listings.find((item) => item.listingRef === evidence.listingRef);
    return listing !== undefined && hashCanonical(listing) === evidence.listingHash;
  });
}

export class ProbabilityEstimationScheduler {
  readonly #jobs: ProbabilityEstimationJobRecord[];
  readonly #notifications: ProbabilityEstimationNotificationRecord[];
  readonly #active = new Map<Hash, Promise<ProbabilityEstimationJobRecord>>();
  readonly #desk: ProbabilityEstimationDesk;
  readonly #store: ProbabilityEstimationSchedulerStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #maxAttempts: number;
  readonly #maxRequestsPerTick: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #retentionLimit: number;
  #unsupportedCandidateCount = 0;
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
    ) throw new Error("probability estimation scheduler configuration is invalid or unbounded");
    this.#jobs = [...(
      this.#store?.loadProbabilityEstimationJobRecords(this.#retentionLimit) ?? []
    )].map(assertProbabilityEstimationJobRecord);
    this.#notifications = [...(
      this.#store?.loadProbabilityEstimationNotificationRecords(this.#retentionLimit) ?? []
    )].map(assertProbabilityEstimationNotificationRecord);
  }

  public reconcile(
    candidatesInput: readonly ProbabilityEstimationCandidate[],
    snapshot: MarketCorpusSnapshot,
  ): void {
    const model = this.#desk.projection().model;
    const candidates = [...new Map(candidatesInput.flatMap((candidate) => {
      const review = assertSemanticReviewRecord(candidate.review);
      const constraint = review.report?.result.semanticConstraint;
      if (
        review.status !== "PASS" || review.report === null || constraint === undefined ||
        constraint.classification !== "PROBABILISTIC_DEPENDENCE"
      ) return [];
      return [[review.report.artifactHash, Object.freeze({ review })] as const];
    })).values()].sort((left, right) =>
      left.review.report!.artifactHash.localeCompare(right.review.report!.artifactHash)
    );
    this.#unsupportedCandidateCount = 0;
    const now = new Date(this.#now()).toISOString();
    const runById = new Map(this.#desk.projection().records.map((record) =>
      [record.runId, assertProbabilityEstimationRunRecord(record)] as const
    ));
    for (const candidate of candidates) {
      const review = candidate.review;
      const report = review.report!;
      const constraint = report.result.semanticConstraint!;
      const derived = deriveProbabilityAdverseStates(constraint);
      if (derived.status === "UNSUPPORTED") {
        this.#unsupportedCandidateCount += 1;
        continue;
      }
      const exactEvidence = exactReviewedCorpusAvailable(constraint, snapshot);
      const caseId = caseIdentity({
        semanticReviewArtifactHash: report.artifactHash,
        semanticConstraintArtifactHash: constraint.artifactHash,
        evidenceScopeIdentity: review.corpusSnapshotIdentity,
        adverseStateIds: derived.adverseStateIds,
        model,
      });
      for (const role of PROBABILITY_ESTIMATOR_ROLES) {
        const id = jobId(caseId, role);
        let job = this.#jobs.find((item) => item.jobId === id);
        if (job === undefined) {
          job = this.#save(withHash({
            schemaVersion: "pmh.probability-estimation-job.v1",
            jobId: id,
            caseIdentity: caseId,
            proposalId: constraint.proposalId,
            semanticReviewArtifactHash: report.artifactHash,
            semanticConstraintArtifactHash: constraint.artifactHash,
            semanticConstraint: constraint,
            evidenceScopeIdentity: review.corpusSnapshotIdentity,
            adverseStateIds: derived.adverseStateIds,
            role,
            model,
            status: exactEvidence ? "PENDING" : "BLOCKED_EVIDENCE",
            attemptCount: 0,
            maxAttempts: this.#maxAttempts,
            nextAttemptAt: now,
            leasedAt: null,
            leaseExpiresAt: null,
            completedAt: null,
            lastRunId: null,
            lastEstimateIdentity: null,
            diagnostic: exactEvidence
              ? null
              : "the exact reviewed listing corpus is not present in the current snapshot",
            createdAt: now,
            updatedAt: now,
            authority: "ESTIMATION_ORCHESTRATION_ONLY",
            semanticDecisionAuthority: false,
            probabilityCertificateAuthority: false,
            hardArbitrageAuthority: false,
            executionAuthority: false,
          }));
        }
        if (job.lastRunId !== null) {
          const run = runById.get(job.lastRunId);
          if (run !== undefined && ["PASS", "ABSTAINED", "FAILED"].includes(run.status)) {
            job = this.#completeFromRun(job, run);
          }
        }
        if (job.status === "BLOCKED_EVIDENCE" && exactEvidence) {
          this.#save(withHash({
            ...withoutHash(job),
            status: "PENDING",
            diagnostic: null,
            nextAttemptAt: now,
            updatedAt: now,
          }));
        } else if (
          !exactEvidence && ["PENDING", "RETRY_WAIT"].includes(job.status)
        ) {
          this.#save(withHash({
            ...withoutHash(job),
            status: "BLOCKED_EVIDENCE",
            diagnostic: "the exact reviewed listing corpus is not present in the current snapshot",
            updatedAt: now,
          }));
        }
      }
    }
    this.#recoverExpiredLeases();
    this.#syncCaseNotifications();
  }

  public tick(
    candidates: readonly ProbabilityEstimationCandidate[],
    snapshot: MarketCorpusSnapshot,
  ): readonly Promise<ProbabilityEstimationJobRecord>[] {
    this.reconcile(candidates, snapshot);
    if (this.tickIntervalMs === null || !this.#desk.projection().configured) {
      return Object.freeze([]);
    }
    const available = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#maxRequestsPerTick,
    );
    if (available <= 0) return Object.freeze([]);
    const candidateByReview = new Map(candidates.flatMap((candidate) => {
      const report = candidate.review.report;
      return report === null ? [] : [[report.artifactHash, candidate] as const];
    }));
    const now = this.#now();
    const due = this.#jobs.filter((job) =>
      ["PENDING", "RETRY_WAIT"].includes(job.status) &&
      Date.parse(job.nextAttemptAt) <= now && !this.#active.has(job.jobId) &&
      candidateByReview.has(job.semanticReviewArtifactHash)
    ).sort((left, right) =>
      Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt) ||
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    ).slice(0, available);
    return Object.freeze(due.map((job) => this.#dispatch(
      job,
      candidateByReview.get(job.semanticReviewArtifactHash)!,
      snapshot,
    )));
  }

  #dispatch(
    job: ProbabilityEstimationJobRecord,
    candidate: ProbabilityEstimationCandidate,
    snapshot: MarketCorpusSnapshot,
  ): Promise<ProbabilityEstimationJobRecord> {
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
      invocation = this.#desk.begin(
        candidate.review,
        snapshot,
        leased.adverseStateIds,
        leased.role,
      );
    } catch (error) {
      const capacity = /requires DEEPSEEK_API_KEY|concurrency limit/u.test(compactDiagnostic(error));
      return Promise.resolve(this.#save(withHash({
        ...withoutHash(leased),
        status: capacity ? "PENDING" : leased.attemptCount >= leased.maxAttempts
          ? "EXHAUSTED"
          : "RETRY_WAIT",
        attemptCount: capacity ? job.attemptCount : leased.attemptCount,
        nextAttemptAt: new Date(
          this.#now() + (capacity ? 0 : this.#retryDelayMs * leased.attemptCount),
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: capacity || leased.attemptCount < leased.maxAttempts
          ? null
          : new Date(this.#now()).toISOString(),
        diagnostic: compactDiagnostic(error),
        updatedAt: new Date(this.#now()).toISOString(),
      })));
    }
    const withRun = this.#save(withHash({
      ...withoutHash(leased),
      lastRunId: invocation.runId,
    }));
    const promise = invocation.promise.then((run) => {
      this.#active.delete(job.jobId);
      const attached = this.#save(withHash({
        ...withoutHash(withRun),
        lastRunId: run.runId,
      }));
      const completed = this.#completeFromRun(attached, run);
      this.#syncCaseNotifications();
      return completed;
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #completeFromRun(
    job: ProbabilityEstimationJobRecord,
    input: ProbabilityEstimationRunRecord,
  ): ProbabilityEstimationJobRecord {
    const run = assertProbabilityEstimationRunRecord(input);
    if (
      run.semanticReviewArtifactHash !== job.semanticReviewArtifactHash ||
      run.semanticConstraintArtifactHash !== job.semanticConstraintArtifactHash ||
      run.evidenceScopeIdentity !== job.evidenceScopeIdentity || run.role !== job.role ||
      run.model !== job.model || run.adverseStateIds.join("\n") !== job.adverseStateIds.join("\n")
    ) throw new Error("probability estimation job completion lineage is inconsistent");
    if (run.status === "RUNNING") return job;
    const timestamp = run.completedAt ?? new Date(this.#now()).toISOString();
    if (run.status === "PASS" || run.status === "ABSTAINED") {
      if (job.status === run.status && job.lastRunId === run.runId) return job;
      return this.#save(withHash({
        ...withoutHash(job),
        status: run.status,
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: timestamp,
        lastRunId: run.runId,
        lastEstimateIdentity: run.estimate?.estimateIdentity ?? null,
        diagnostic: run.status === "PASS" ? null : run.diagnostic,
        updatedAt: timestamp,
      }));
    }
    const exhausted = job.attemptCount >= job.maxAttempts;
    return this.#save(withHash({
      ...withoutHash(job),
      status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
      nextAttemptAt: new Date(
        exhausted ? Date.parse(timestamp) : Date.parse(timestamp) +
          this.#retryDelayMs * Math.max(1, job.attemptCount),
      ).toISOString(),
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt: exhausted ? timestamp : null,
      lastRunId: null,
      lastEstimateIdentity: null,
      diagnostic: compactDiagnostic(run.diagnostic ?? "probability estimation failed"),
      updatedAt: timestamp,
    }));
  }

  #recoverExpiredLeases(): void {
    const now = this.#now();
    const runById = new Map(this.#desk.projection().records.map((record) =>
      [record.runId, record] as const
    ));
    for (const job of this.#jobs.filter((item) =>
      item.status === "LEASED" && item.leaseExpiresAt !== null &&
      Date.parse(item.leaseExpiresAt) <= now && !this.#active.has(item.jobId)
    )) {
      const run = job.lastRunId === null ? undefined : runById.get(job.lastRunId);
      if (run !== undefined && run.status !== "RUNNING") {
        this.#completeFromRun(job, run);
        continue;
      }
      const exhausted = job.attemptCount >= job.maxAttempts;
      this.#save(withHash({
        ...withoutHash(job),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * Math.max(1, job.attemptCount),
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        lastRunId: null,
        lastEstimateIdentity: null,
        diagnostic: exhausted
          ? "probability estimation lease expired after provider budget exhaustion"
          : "probability estimation lease expired before a durable result was observed",
        updatedAt: new Date(now).toISOString(),
      }));
    }
  }

  #bounds(): readonly ProbabilisticSemanticBoundArtifact[] {
    const runById = new Map(this.#desk.projection().records.map((record) =>
      [record.runId, record] as const
    ));
    const byCase = new Map<Hash, ProbabilityEstimationJobRecord[]>();
    for (const job of this.#jobs) {
      const group = byCase.get(job.caseIdentity) ?? [];
      group.push(job);
      byCase.set(job.caseIdentity, group);
    }
    return Object.freeze([...byCase.values()].flatMap((jobs) => {
      const passingRuns = jobs.flatMap((job) => {
        if (job.status !== "PASS" || job.lastRunId === null) return [];
        const run = runById.get(job.lastRunId);
        return run?.status === "PASS" && run.estimate !== null ? [run] : [];
      });
      if (passingRuns.length < 2) return [];
      const first = jobs[0]!;
      const bound = buildProbabilisticSemanticBound({
        semanticConstraint: first.semanticConstraint,
        adverseStateIds: first.adverseStateIds,
        estimates: passingRuns.map((run) => run.estimate!),
        counterScenarios: [...new Set(passingRuns.flatMap((run) =>
          run.counterScenarios.map((scenario) => scenario.narrative)
        ))],
      });
      return [assertProbabilisticSemanticBound(bound)];
    }).sort((left, right) => right.validFrom.localeCompare(left.validFrom) ||
      left.artifactHash.localeCompare(right.artifactHash)));
  }

  #syncCaseNotifications(): void {
    const boundsByCase = new Map(this.#bounds().map((bound) => {
      const job = this.#jobs.find((item) =>
        item.semanticConstraintArtifactHash === bound.semanticConstraintArtifactHash &&
        item.adverseStateIds.join("\n") === bound.adverseStateIds.join("\n")
      );
      return job === undefined ? [] : [job.caseIdentity, bound] as const;
    }).filter((item): item is readonly [Hash, ProbabilisticSemanticBoundArtifact] =>
      item.length === 2
    ));
    const caseIds = [...new Set(this.#jobs.map((job) => job.caseIdentity))];
    for (const id of caseIds) {
      const jobs = this.#jobs.filter((job) => job.caseIdentity === id);
      const bound = boundsByCase.get(id);
      if (bound !== undefined) {
        this.#notify(jobs[0]!, "BOUND_READY", bound);
        continue;
      }
      if (jobs.length !== PROBABILITY_ESTIMATOR_ROLES.length ||
        jobs.some((job) => !["PASS", "ABSTAINED", "EXHAUSTED"].includes(job.status))) continue;
      this.#notify(
        jobs[0]!,
        jobs.some((job) => job.status === "ABSTAINED")
          ? "ESTIMATION_ABSTAINED"
          : "ESTIMATION_EXHAUSTED",
        null,
      );
    }
  }

  #notify(
    job: ProbabilityEstimationJobRecord,
    kind: ProbabilityEstimationNotificationRecord["kind"],
    bound: ProbabilisticSemanticBoundArtifact | null,
  ): void {
    const dedupeIdentity = hashCanonical({
      schemaVersion: "pmh.probability-estimation-notification-dedupe.v1",
      caseIdentity: job.caseIdentity,
      kind,
      boundArtifactHash: bound?.artifactHash ?? null,
    });
    if (this.#notifications.some((item) => item.dedupeIdentity === dedupeIdentity)) return;
    const createdAt = new Date(this.#now()).toISOString();
    this.#saveNotification(withNotificationHash({
      schemaVersion: "pmh.probability-estimation-notification.v1",
      notificationId: hashCanonical({
        schemaVersion: "pmh.probability-estimation-notification-id.v1",
        dedupeIdentity,
      }),
      dedupeIdentity,
      caseIdentity: job.caseIdentity,
      proposalId: job.proposalId,
      kind,
      status: "UNREAD",
      boundArtifactHash: bound?.artifactHash ?? null,
      title: kind === "BOUND_READY"
        ? "Probabilistic semantic bound ready"
        : kind === "ESTIMATION_ABSTAINED"
          ? "Probability estimators abstained"
          : "Probability estimation exhausted",
      summary: kind === "BOUND_READY"
        ? `${bound!.estimates.length} independent roles bound adverse states ${bound!.adverseStateIds.join("+")} at no more than ${bound!.epsilonPpm} ppm; price and risk compilation may now evaluate the case.`
        : kind === "ESTIMATION_ABSTAINED"
          ? "Fewer than two independent roles could support a numeric interval; the semantic opportunity remains retained without a fabricated probability."
          : "Fewer than two independent roles completed within the bounded provider-attempt budget.",
      createdAt,
      readAt: null,
    }));
  }

  public acknowledge(notificationId: Hash): ProbabilityEstimationNotificationRecord {
    const notification = this.#notifications.find((item) =>
      item.notificationId === notificationId
    );
    if (notification === undefined) throw new Error("probability estimation notification was not found");
    if (notification.status === "READ") return notification;
    return this.#saveNotification(withNotificationHash({
      ...withoutNotificationHash(notification),
      status: "READ",
      readAt: new Date(this.#now()).toISOString(),
    }));
  }

  #save(input: ProbabilityEstimationJobRecord): ProbabilityEstimationJobRecord {
    const valid = assertProbabilityEstimationJobRecord(input);
    const stored = this.#store?.saveProbabilityEstimationJobRecord(
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
    input: ProbabilityEstimationNotificationRecord,
  ): ProbabilityEstimationNotificationRecord {
    const valid = assertProbabilityEstimationNotificationRecord(input);
    const stored = this.#store?.saveProbabilityEstimationNotificationRecord(
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

  public awaitIdle(): Promise<readonly ProbabilityEstimationJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): ProbabilityEstimationSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const bounds = this.#bounds();
    const notifications = Object.freeze([...this.#notifications]);
    const configured = this.#desk.projection().configured;
    const now = this.#now();
    return Object.freeze({
      schemaVersion: "pmh.probability-estimation-scheduler.v1",
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
      blockedEvidenceCount: jobs.filter((job) => job.status === "BLOCKED_EVIDENCE").length,
      passedCount: jobs.filter((job) => job.status === "PASS").length,
      abstainedCount: jobs.filter((job) => job.status === "ABSTAINED").length,
      exhaustedCount: jobs.filter((job) => job.status === "EXHAUSTED").length,
      caseCount: new Set(jobs.map((job) => job.caseIdentity)).size,
      boundReadyCount: bounds.length,
      freshBoundCount: bounds.filter((bound) =>
        Date.parse(bound.validFrom) <= now && now < Date.parse(bound.expiresAt)
      ).length,
      unsupportedCandidateCount: this.#unsupportedCandidateCount,
      unreadNotificationCount: notifications.filter((item) => item.status === "UNREAD").length,
      budget: Object.freeze({
        basis: "PROVIDER_ATTEMPTS" as const,
        maxAttemptsPerRole: this.#maxAttempts,
        maxRequestsPerTick: this.#maxRequestsPerTick,
        providerAttemptsStarted: jobs.reduce((sum, job) => sum + job.attemptCount, 0),
      }),
      jobs,
      bounds,
      notifications,
      storage: Object.freeze({
        jobs: this.#store?.probabilityEstimationJobStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "jobId" as const,
        }),
        notifications: this.#store?.probabilityEstimationNotificationStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "notificationId" as const,
        }),
      }),
      authority: "ESTIMATION_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      probabilityCertificateAuthority: false,
      hardArbitrageAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }
}

export function parseProbabilityEstimationTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_PROBABILITY_ESTIMATION_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error(
      "PMH_PROBABILITY_ESTIMATION_TICK_MS must be 0 or an integer from 1000 to 60000",
    );
  }
  return value;
}
