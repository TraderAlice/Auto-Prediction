import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertEvidenceDocumentCapture,
  type EvidenceDocumentCapture,
} from "./evidence-document.js";
import {
  assertEvidenceRequirement,
  type EvidenceRequirement,
} from "./evidence-requirement.js";
import {
  assertRuleEvidenceClaimRecord,
  RuleEvidenceClaimBusyError,
  RuleEvidenceClaimDesk,
  RuleEvidenceClaimNotConfiguredError,
  type RuleEvidenceClaimRecord,
} from "./rule-evidence-claim.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 2_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_REQUESTS_PER_TICK = 3;
const DEFAULT_LEASE_TIMEOUT_MS = 330_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const JOB_KEYS = Object.freeze([
  "artifactHash", "attemptCount", "authority", "certificateAuthority", "completedAt",
  "createdAt", "diagnostic", "documentId", "documentRawHash", "executionAuthority",
  "extractionId", "extractionTextHash", "interpreterIdentity", "jobId", "lastClaimId",
  "leaseExpiresAt", "leasedAt", "maxAttempts", "nextAttemptAt", "observationId",
  "productionReviewAuthority", "proposalId", "providerRequestAuthority", "requirement",
  "requirementId", "schemaVersion", "semanticDecisionAuthority", "status",
  "updatedAt",
]);

export type RuleEvidenceClaimJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "PASS"
  | "EXHAUSTED";

export type RuleEvidenceClaimInput = Readonly<{
  requirement: EvidenceRequirement;
  capture: EvidenceDocumentCapture;
}>;

export type RuleEvidenceClaimJobRecord = Readonly<{
  schemaVersion: "pmh.rule-evidence-claim-job.v1" | "pmh.rule-evidence-claim-job.v2";
  jobId: Hash;
  requirementId: Hash;
  proposalId: Hash;
  requirement: EvidenceRequirement;
  observationId: Hash;
  documentId: Hash;
  extractionId: Hash;
  documentRawHash: Hash;
  extractionTextHash: Hash;
  interpreterIdentity: Hash;
  status: RuleEvidenceClaimJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  lastClaimId: Hash | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "ADVISORY_EVIDENCE_INTERPRETATION_ORCHESTRATION_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  productionReviewAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export interface RuleEvidenceClaimSchedulerStore {
  readonly ruleEvidenceClaimJobStorage: OperationalStorageProjection<"jobId">;
  loadRuleEvidenceClaimJobRecords(limit: number): readonly RuleEvidenceClaimJobRecord[];
  loadRuleEvidenceClaimJobRecordsByRequirementIds?(
    requirementIds: readonly Hash[],
  ): readonly RuleEvidenceClaimJobRecord[];
  saveRuleEvidenceClaimJobRecord(
    record: RuleEvidenceClaimJobRecord,
    retentionLimit: number,
  ): RuleEvidenceClaimJobRecord;
  saveRuleEvidenceClaimJobRecords?(
    records: readonly RuleEvidenceClaimJobRecord[],
    retentionLimit: number,
  ): readonly RuleEvidenceClaimJobRecord[];
}

export type RuleEvidenceClaimSchedulerProjection = Readonly<{
  schemaVersion: "pmh.rule-evidence-claim-scheduler.v2";
  enabled: boolean;
  configured: boolean;
  status: "IDLE" | "RUNNING" | "NEEDS_KEY";
  currentInterpreterIdentity: Hash;
  currentJobCount: number;
  legacyJobCount: number;
  historicalPassedCount: number;
  tickIntervalMs: number | null;
  concurrencyLimit: number;
  activeCount: number;
  dueCount: number;
  pendingCount: number;
  leasedCount: number;
  interruptedLeaseCount: number;
  retryWaitCount: number;
  passedCount: number;
  exhaustedCount: number;
  supportedCount: number;
  contradictedCount: number;
  inconclusiveCount: number;
  budget: Readonly<{
    basis: "PROVIDER_ATTEMPTS";
    maxAttemptsPerJob: number;
    maxRequestsPerTick: number;
    providerAttemptsStarted: number;
  }>;
  jobs: readonly RuleEvidenceClaimJobRecord[];
  storage: OperationalStorageProjection<"jobId">;
  authority: "ADVISORY_EVIDENCE_INTERPRETATION_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function ruleEvidenceInterpretationSupplyLineage(input: RuleEvidenceClaimInput): Hash {
  return hashCanonical({
    schemaVersion: "pmh.rule-evidence-interpretation-supply.v1",
    requirementId: input.requirement.requirementId,
    proposalId: input.requirement.proposalId,
    documentId: input.capture.document.record.documentId,
    extractionId: input.capture.extraction.record.extractionId,
    documentRawHash: input.capture.document.record.rawHash,
    extractionTextHash: input.capture.extraction.record.textHash,
  });
}

function storedRuleEvidenceInterpretationSupplyLineage(
  record: RuleEvidenceClaimJobRecord,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.rule-evidence-interpretation-supply.v1",
    requirementId: record.requirementId,
    proposalId: record.proposalId,
    documentId: record.documentId,
    extractionId: record.extractionId,
    documentRawHash: record.documentRawHash,
    extractionTextHash: record.extractionTextHash,
  });
}

type SchedulerOptions = Readonly<{
  desk: RuleEvidenceClaimDesk;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: RuleEvidenceClaimSchedulerStore;
  now?: () => number;
}>;

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === keys.join("\n");
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
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "rule evidence claim job failed";
}

function withoutHash(
  record: RuleEvidenceClaimJobRecord,
): Omit<RuleEvidenceClaimJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withHash(
  body: Omit<RuleEvidenceClaimJobRecord, "artifactHash">,
): RuleEvidenceClaimJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function validateInput(input: RuleEvidenceClaimInput): RuleEvidenceClaimInput {
  const requirement = assertEvidenceRequirement(input.requirement);
  const capture = assertEvidenceDocumentCapture(input.capture);
  if (
    requirement.acquisitionScopeIdentity !== capture.observation.acquisitionScopeIdentity ||
    !requirement.eligibleLocators.some((binding) =>
      binding.locator.locatorIdentity === capture.observation.locatorIdentity
    ) ||
    capture.document.record.documentId !== capture.observation.documentId ||
    capture.extraction.record.documentId !== capture.document.record.documentId
  ) throw new Error("rule evidence claim scheduler input lineage is inconsistent");
  return Object.freeze({ requirement, capture });
}

export function assertRuleEvidenceClaimJobRecord(
  value: unknown,
): RuleEvidenceClaimJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored rule evidence claim job is malformed");
  }
  const record = value as RuleEvidenceClaimJobRecord;
  const leased = record.status === "LEASED";
  const terminal = record.status === "PASS" || record.status === "EXHAUSTED";
  const requirement = assertEvidenceRequirement(record.requirement);
  const { artifactHash, ...body } = record;
  if (
    !exactKeys(record, JOB_KEYS) ||
    !["pmh.rule-evidence-claim-job.v1", "pmh.rule-evidence-claim-job.v2"]
      .includes(record.schemaVersion) ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    record.jobId !== hashCanonical({
      schemaVersion: "pmh.rule-evidence-interpretation-run.v1",
      requirementId: record.requirementId,
      documentId: record.documentId,
      extractionId: record.extractionId,
      interpreterIdentity: record.interpreterIdentity,
    }) ||
    !HASH_PATTERN.test(String(record.requirementId)) ||
    requirement.requirementId !== record.requirementId ||
    requirement.proposalId !== record.proposalId ||
    !HASH_PATTERN.test(String(record.proposalId)) ||
    !HASH_PATTERN.test(String(record.observationId)) ||
    !HASH_PATTERN.test(String(record.documentId)) ||
    !HASH_PATTERN.test(String(record.extractionId)) ||
    !HASH_PATTERN.test(String(record.documentRawHash)) ||
    !HASH_PATTERN.test(String(record.extractionTextHash)) ||
    !HASH_PATTERN.test(String(record.interpreterIdentity)) ||
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
    (record.status === "PASS" !== (record.lastClaimId !== null)) ||
    (record.lastClaimId !== null && (
      !HASH_PATTERN.test(String(record.lastClaimId)) ||
      (record.schemaVersion === "pmh.rule-evidence-claim-job.v1" &&
        record.lastClaimId !== record.jobId)
    )) ||
    (record.status === "PASS" && record.diagnostic !== null) ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    Date.parse(record.updatedAt) < Date.parse(record.createdAt) ||
    record.authority !== "ADVISORY_EVIDENCE_INTERPRETATION_ORCHESTRATION_ONLY" ||
    record.providerRequestAuthority !== false || record.semanticDecisionAuthority !== false ||
    record.productionReviewAuthority !== false || record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored rule evidence claim job violates its bounded authority contract");
  return Object.freeze({ ...record, requirement });
}

export class RuleEvidenceClaimScheduler {
  readonly #jobs: RuleEvidenceClaimJobRecord[];
  readonly #active = new Map<Hash, Promise<RuleEvidenceClaimJobRecord>>();
  readonly #desk: RuleEvidenceClaimDesk;
  readonly #store: RuleEvidenceClaimSchedulerStore | undefined;
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
      (this.tickIntervalMs !== null && (
        !Number.isSafeInteger(this.tickIntervalMs) ||
        this.tickIntervalMs < 1_000 || this.tickIntervalMs > 60_000
      )) ||
      !Number.isSafeInteger(this.#concurrencyLimit) ||
      this.#concurrencyLimit < 1 || this.#concurrencyLimit > 8 ||
      !Number.isSafeInteger(this.#maxAttempts) || this.#maxAttempts < 1 ||
      this.#maxAttempts > 10 || !Number.isSafeInteger(this.#maxRequestsPerTick) ||
      this.#maxRequestsPerTick < 1 || this.#maxRequestsPerTick > 8 ||
      !Number.isSafeInteger(this.#leaseTimeoutMs) || this.#leaseTimeoutMs < 1_000 ||
      this.#leaseTimeoutMs > 600_000 || !Number.isSafeInteger(this.#retryDelayMs) ||
      this.#retryDelayMs < 1_000 || this.#retryDelayMs > 86_400_000 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 10 ||
      this.#retentionLimit > 5_000
    ) throw new Error("rule evidence claim scheduler configuration is invalid or unbounded");
    this.#jobs = [...(
      this.#store?.loadRuleEvidenceClaimJobRecords(this.#retentionLimit) ?? []
    )].map(assertRuleEvidenceClaimJobRecord);
  }

  public reconcile(inputs: readonly RuleEvidenceClaimInput[]): void {
    const existingById = new Map(this.#jobs.map((job) => [job.jobId, job] as const));
    const existingByInterpretationSupply = new Map<Hash, RuleEvidenceClaimJobRecord>();
    for (const job of [...this.#jobs].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.jobId.localeCompare(left.jobId)
    )) {
      const lineage = storedRuleEvidenceInterpretationSupplyLineage(job);
      if (!existingByInterpretationSupply.has(lineage)) {
        existingByInterpretationSupply.set(lineage, job);
      }
    }
    const validated = [...new Map(inputs.map((raw) => {
      const input = validateInput(raw);
      const currentJobId = this.#desk.interpretationIdFor(
        input.requirement,
        input.capture,
      );
      const equivalent = existingByInterpretationSupply.get(
        ruleEvidenceInterpretationSupplyLineage(input),
      );
      const existing = existingById.get(currentJobId) ?? equivalent;
      const jobId = existing?.jobId ?? currentJobId;
      if (existing !== undefined && (
        existing.requirementId !== input.requirement.requirementId ||
        existing.proposalId !== input.requirement.proposalId ||
        existing.documentId !== input.capture.document.record.documentId ||
        existing.extractionId !== input.capture.extraction.record.extractionId ||
        existing.documentRawHash !== input.capture.document.record.rawHash ||
        existing.extractionTextHash !== input.capture.extraction.record.textHash
      )) throw new Error("retained rule evidence claim input no longer matches its job lineage");
      return [jobId, input] as const;
    })).entries()].sort(([left], [right]) => left.localeCompare(right));
    if (validated.length > this.#retentionLimit) {
      throw new Error("active rule evidence claim inputs exceed the durable retention bound");
    }
    const completedByInterpretationSupply = new Map<Hash, RuleEvidenceClaimRecord>();
    for (const record of this.#desk.projection().records
      .filter((item) =>
        item.status === "PASS" && item.claim !== null &&
        !("sourceKind" in item)
      )
      .sort((left, right) =>
        String(right.completedAt).localeCompare(String(left.completedAt)) ||
        right.interpretationId.localeCompare(left.interpretationId)
      )) {
      const claim = record.claim!;
      if (claim.schemaVersion === "pmh.rule-evidence-claim.v3") continue;
      const lineage = hashCanonical({
        schemaVersion: "pmh.rule-evidence-interpretation-supply.v1",
        requirementId: claim.requirementId,
        proposalId: claim.proposalId,
        documentId: claim.documentId,
        extractionId: claim.extractionId,
        documentRawHash: claim.documentRawHash,
        extractionTextHash: claim.extractionTextHash,
      });
      if (!completedByInterpretationSupply.has(lineage)) {
        completedByInterpretationSupply.set(lineage, record);
      }
    }
    const newJobs: RuleEvidenceClaimJobRecord[] = [];
    const timestamp = new Date(this.#now()).toISOString();
    for (const [jobId, input] of validated) {
      const existing = existingById.get(jobId);
      const completed = completedByInterpretationSupply.get(
        ruleEvidenceInterpretationSupplyLineage(input),
      );
      if (existing === undefined) {
        newJobs.push(withHash({
          schemaVersion: completed === undefined || completed.interpretationId === jobId
            ? "pmh.rule-evidence-claim-job.v1"
            : "pmh.rule-evidence-claim-job.v2",
          jobId,
          requirementId: input.requirement.requirementId,
          proposalId: input.requirement.proposalId,
          requirement: input.requirement,
          observationId: input.capture.observation.observationId,
          documentId: input.capture.document.record.documentId,
          extractionId: input.capture.extraction.record.extractionId,
          documentRawHash: input.capture.document.record.rawHash,
          extractionTextHash: input.capture.extraction.record.textHash,
          interpreterIdentity: this.#desk.interpreterIdentity,
          status: completed === undefined ? "PENDING" : "PASS",
          attemptCount: 0,
          maxAttempts: this.#maxAttempts,
          nextAttemptAt: timestamp,
          leasedAt: null,
          leaseExpiresAt: null,
          completedAt: completed?.completedAt ?? null,
          lastClaimId: completed?.claim?.claimId ?? null,
          diagnostic: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          authority: "ADVISORY_EVIDENCE_INTERPRETATION_ORCHESTRATION_ONLY",
          providerRequestAuthority: false,
          semanticDecisionAuthority: false,
          productionReviewAuthority: false,
          certificateAuthority: false,
          executionAuthority: false,
        }));
        continue;
      }
      if (completed !== undefined && existing.status !== "PASS") {
        this.#complete(existing, completed);
      }
    }
    if (newJobs.length > 0) {
      if (this.#store?.saveRuleEvidenceClaimJobRecords !== undefined) {
        const retained = this.#store.saveRuleEvidenceClaimJobRecords(
          Object.freeze(newJobs),
          this.#retentionLimit,
        );
        this.#jobs.length = 0;
        this.#jobs.push(...retained.map(assertRuleEvidenceClaimJobRecord));
      } else {
        for (const job of newJobs) this.#saveJob(job);
      }
    }
  }

  public tick(inputs: readonly RuleEvidenceClaimInput[]): readonly Promise<RuleEvidenceClaimJobRecord>[] {
    this.reconcile(inputs);
    if (
      this.tickIntervalMs === null || !this.#desk.projection().configured
    ) return Object.freeze([]);
    const available = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#desk.concurrencyLimit - this.#desk.projection().activeCount,
      this.#maxRequestsPerTick,
    );
    if (available <= 0) return Object.freeze([]);
    const inputByJob = new Map(inputs.map((raw) => {
      const input = validateInput(raw);
      return [this.#desk.interpretationIdFor(input.requirement, input.capture), input] as const;
    }));
    const now = this.#now();
    const due = this.#jobs.filter((job) =>
      ["PENDING", "RETRY_WAIT"].includes(job.status) &&
      Date.parse(job.nextAttemptAt) <= now && !this.#active.has(job.jobId) &&
      inputByJob.has(job.jobId)
    ).sort((left, right) =>
      Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt) ||
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    ).slice(0, available);
    return Object.freeze(due.map((job) => this.#dispatch(job, inputByJob.get(job.jobId)!)));
  }

  public runJob(
    jobId: Hash,
    inputs: readonly RuleEvidenceClaimInput[],
  ): Promise<RuleEvidenceClaimJobRecord> {
    if (!HASH_PATTERN.test(String(jobId))) {
      throw new Error("rule evidence claim job identity is malformed");
    }
    if (!this.#desk.projection().configured) {
      throw new Error("rule evidence claim interpreter is not configured");
    }
    if (
      this.#active.size >= this.#concurrencyLimit ||
      this.#desk.projection().activeCount >= this.#desk.concurrencyLimit
    ) throw new Error("rule evidence claim concurrency budget is full");
    const job = this.#jobs.find((item) => item.jobId === jobId);
    if (job === undefined) throw new Error("rule evidence claim job was not found");
    if (job.interpreterIdentity !== this.#desk.interpreterIdentity) {
      throw new Error("rule evidence claim job belongs to a superseded interpreter generation");
    }
    if (this.#active.has(jobId) || job.status === "LEASED") {
      throw new Error("rule evidence claim job is already running");
    }
    if (!["PENDING", "RETRY_WAIT"].includes(job.status)) {
      throw new Error(`rule evidence claim job is terminal: ${job.status}`);
    }
    const input = inputs.map(validateInput).find((candidate) =>
      this.#desk.interpretationIdFor(candidate.requirement, candidate.capture) === jobId
    );
    if (input === undefined) {
      throw new Error("rule evidence claim input is no longer active");
    }
    return this.#dispatch(job, input);
  }

  #dispatch(
    job: RuleEvidenceClaimJobRecord,
    input: RuleEvidenceClaimInput,
  ): Promise<RuleEvidenceClaimJobRecord> {
    const startedAt = this.#now();
    const leased = this.#saveJob(withHash({
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
      invocation = this.#desk.begin(input.requirement, input.capture);
    } catch (error) {
      const expectedCapacity = error instanceof RuleEvidenceClaimBusyError ||
        error instanceof RuleEvidenceClaimNotConfiguredError;
      return Promise.resolve(this.#saveJob(withHash({
        ...withoutHash(leased),
        status: "PENDING",
        attemptCount: expectedCapacity ? job.attemptCount : leased.attemptCount,
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
      return this.#saveJob(withHash({
        ...withoutHash(leased),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * leased.attemptCount,
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        diagnostic: compactDiagnostic(record.diagnostic ?? "rule evidence claim failed"),
        updatedAt: new Date(now).toISOString(),
      }));
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #complete(
    job: RuleEvidenceClaimJobRecord,
    recordInput: RuleEvidenceClaimRecord,
  ): RuleEvidenceClaimJobRecord {
    const record = assertRuleEvidenceClaimRecord(recordInput);
    if (
      record.status !== "PASS" || record.claim === null ||
      record.requirementId !== job.requirementId ||
      "sourceKind" in record || record.documentId !== job.documentId ||
      record.extractionId !== job.extractionId ||
      record.completedAt === null
    ) throw new Error("rule evidence claim completion lineage is inconsistent");
    return this.#saveJob(withHash({
      ...withoutHash(job),
      schemaVersion: record.interpretationId === job.jobId
        ? job.schemaVersion
        : "pmh.rule-evidence-claim-job.v2",
      status: "PASS",
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt: record.completedAt,
      lastClaimId: record.claim.claimId,
      diagnostic: null,
      updatedAt: record.completedAt,
    }));
  }

  #saveJob(recordInput: RuleEvidenceClaimJobRecord): RuleEvidenceClaimJobRecord {
    const valid = assertRuleEvidenceClaimJobRecord(recordInput);
    const stored = this.#store?.saveRuleEvidenceClaimJobRecord(
      valid,
      this.#retentionLimit,
    ) ?? valid;
    const index = this.#jobs.findIndex((item) => item.jobId === stored.jobId);
    if (index >= 0) this.#jobs.splice(index, 1);
    this.#jobs.push(stored);
    this.#jobs.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.jobId.localeCompare(left.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) this.#jobs.length = this.#retentionLimit;
    return stored;
  }

  public awaitIdle(): Promise<readonly RuleEvidenceClaimJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): RuleEvidenceClaimSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const deskProjection = this.#desk.projection();
    const records = new Map(deskProjection.records.map((record) =>
      [record.interpretationId, record] as const
    ));
    const currentJobs = jobs.filter((job) =>
      job.interpreterIdentity === deskProjection.interpreterIdentity
    );
    const dispositions = currentJobs.flatMap((job) => {
      const claim = job.lastClaimId === null ? null : records.get(job.lastClaimId)?.claim;
      return claim === null || claim === undefined ? [] : [claim.disposition];
    });
    const configured = deskProjection.configured;
    const now = this.#now();
    return Object.freeze({
      schemaVersion: "pmh.rule-evidence-claim-scheduler.v2",
      enabled: this.tickIntervalMs !== null,
      configured,
      status: !configured ? "NEEDS_KEY" : this.#active.size === 0 ? "IDLE" : "RUNNING",
      currentInterpreterIdentity: deskProjection.interpreterIdentity,
      currentJobCount: currentJobs.length,
      legacyJobCount: jobs.length - currentJobs.length,
      historicalPassedCount: jobs.filter((job) => job.status === "PASS").length,
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      dueCount: currentJobs.filter((job) =>
        ["PENDING", "RETRY_WAIT"].includes(job.status) &&
        Date.parse(job.nextAttemptAt) <= now
      ).length,
      pendingCount: currentJobs.filter((job) => job.status === "PENDING").length,
      leasedCount: currentJobs.filter((job) => job.status === "LEASED").length,
      interruptedLeaseCount: jobs.filter((job) =>
        job.status === "LEASED" && job.leaseExpiresAt !== null &&
        Date.parse(job.leaseExpiresAt) <= now && !this.#active.has(job.jobId)
      ).length,
      retryWaitCount: currentJobs.filter((job) => job.status === "RETRY_WAIT").length,
      passedCount: currentJobs.filter((job) => job.status === "PASS").length,
      exhaustedCount: currentJobs.filter((job) => job.status === "EXHAUSTED").length,
      supportedCount: dispositions.filter((item) => item === "SUPPORTS").length,
      contradictedCount: dispositions.filter((item) => item === "CONTRADICTS").length,
      inconclusiveCount: dispositions.filter((item) => item === "INCONCLUSIVE").length,
      budget: Object.freeze({
        basis: "PROVIDER_ATTEMPTS" as const,
        maxAttemptsPerJob: this.#maxAttempts,
        maxRequestsPerTick: this.#maxRequestsPerTick,
        providerAttemptsStarted: jobs.reduce((sum, job) => sum + job.attemptCount, 0),
      }),
      jobs,
      storage: this.#store?.ruleEvidenceClaimJobStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "jobId" as const,
      }),
      authority: "ADVISORY_EVIDENCE_INTERPRETATION_ORCHESTRATION_ONLY",
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

export function parseRuleEvidenceClaimTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_EVIDENCE_CLAIM_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error("PMH_EVIDENCE_CLAIM_TICK_MS must be 0 or an integer from 1000 to 60000");
  }
  return value;
}
