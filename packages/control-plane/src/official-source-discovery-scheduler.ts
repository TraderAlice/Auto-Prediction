import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertEvidenceRequirement,
  rebaseEvidenceRequirementToAdmittedLocator,
  type EvidenceRequirement,
} from "./evidence-requirement.js";
import {
  admitOfficialSourceCandidate,
  assertOfficialSourceDiscoveryTask,
  boundedOfficialSourceCandidates,
  buildOfficialSourceDiscoveryTasks,
  officialSourceTaskRequirementIds,
  type OfficialSourceAdmission,
  type OfficialSourceCandidate,
  type OfficialSourceCandidateDraft,
  type OfficialSourceDiscoveryTask,
} from "./official-source-discovery.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 500;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_REQUESTS_PER_TICK = 2;
const DEFAULT_LEASE_TIMEOUT_MS = 330_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const PRIORITY_RANK = Object.freeze({
  POSITIVE_GROSS_BLOCKER: 0,
  EVIDENCE_ESCALATION: 1,
  ACTIVE_TRIAGE_DEBT: 2,
  RETAINED_RESEARCH_DEBT: 3,
} as const);

export type OfficialSourceDiscoveryOutcome =
  | "PROPOSE_LOCATOR"
  | "NO_OFFICIAL_SOURCE_FOUND"
  | "ABSTAIN";

export type OfficialSourceDiscoveryAgentResult = Readonly<{
  outcome: OfficialSourceDiscoveryOutcome;
  candidates: readonly OfficialSourceCandidateDraft[];
  diagnostic: string;
  providerRequestCount: number;
  toolCallCount: number;
}>;

export interface OfficialSourceDiscoveryAgentPort {
  readonly configured: boolean;
  readonly agentIdentity: Hash;
  readonly provider: "CODEX" | "DEEPSEEK";
  readonly model: string;
  discover(task: OfficialSourceDiscoveryTask): Promise<OfficialSourceDiscoveryAgentResult>;
}

export type OfficialSourceDiscoveryJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "ADMITTED"
  | "NO_OFFICIAL_SOURCE_FOUND"
  | "ABSTAINED"
  | "EXHAUSTED";

export type OfficialSourceDiscoveryJobRecord = Readonly<{
  schemaVersion: "pmh.official-source-discovery-job.v1";
  jobId: Hash;
  task: OfficialSourceDiscoveryTask;
  taskId: Hash;
  requirementId: Hash;
  proposalId: Hash;
  agentIdentity: Hash;
  provider: "CODEX" | "DEEPSEEK";
  model: string;
  priorityTier: OfficialSourceDiscoveryTask["priorityTier"];
  status: OfficialSourceDiscoveryJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  outcome: OfficialSourceDiscoveryOutcome | null;
  candidates: readonly OfficialSourceCandidate[];
  admissions: readonly OfficialSourceAdmission[];
  admittedRequirement: EvidenceRequirement | null;
  providerRequestCount: number;
  toolCallCount: number;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "OFFICIAL_SOURCE_DISCOVERY_ORCHESTRATION_ONLY";
  fetchAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export interface OfficialSourceDiscoverySchedulerStore {
  readonly officialSourceDiscoveryJobStorage: OperationalStorageProjection<"jobId">;
  loadOfficialSourceDiscoveryJobRecords(
    limit: number,
  ): readonly OfficialSourceDiscoveryJobRecord[];
  loadOfficialSourceDiscoveryJobRecordsByRequirementIds?(
    requirementIds: readonly Hash[],
  ): readonly OfficialSourceDiscoveryJobRecord[];
  saveOfficialSourceDiscoveryJobRecord(
    record: OfficialSourceDiscoveryJobRecord,
    retentionLimit: number,
  ): OfficialSourceDiscoveryJobRecord;
}

export type OfficialSourceDiscoverySchedulerProjection = Readonly<{
  schemaVersion: "pmh.official-source-discovery-scheduler.v1";
  enabled: boolean;
  configured: boolean;
  status: "IDLE" | "RUNNING" | "NEEDS_PROVIDER";
  tickIntervalMs: number | null;
  concurrencyLimit: number;
  activeCount: number;
  dueCount: number;
  pendingCount: number;
  leasedCount: number;
  retryWaitCount: number;
  admittedCount: number;
  noSourceCount: number;
  abstainedCount: number;
  exhaustedCount: number;
  supersededCount: number;
  candidateCount: number;
  rejectedCandidateCount: number;
  providerRequestCount: number;
  toolCallCount: number;
  jobs: readonly OfficialSourceDiscoveryJobRecord[];
  storage: OperationalStorageProjection<"jobId">;
  authority: "OFFICIAL_SOURCE_DISCOVERY_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    anonymousOfficialReadsOnly: true;
    credentialsUsedForOfficialSources: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type SchedulerOptions = Readonly<{
  agent: OfficialSourceDiscoveryAgentPort | null;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: OfficialSourceDiscoverySchedulerStore;
  now?: () => number;
}>;

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function compactDiagnostic(value: unknown): string {
  return (value instanceof Error ? value.message : String(value))
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "official source discovery failed";
}

function withoutHash(
  record: OfficialSourceDiscoveryJobRecord,
): Omit<OfficialSourceDiscoveryJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withHash(
  body: Omit<OfficialSourceDiscoveryJobRecord, "artifactHash">,
): OfficialSourceDiscoveryJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertOfficialSourceDiscoveryJobRecord(
  value: unknown,
): OfficialSourceDiscoveryJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("official source discovery job is malformed");
  }
  const record = value as OfficialSourceDiscoveryJobRecord;
  const { artifactHash, ...body } = record;
  const task = assertOfficialSourceDiscoveryTask(record.task);
  const terminal = [
    "ADMITTED", "NO_OFFICIAL_SOURCE_FOUND", "ABSTAINED", "EXHAUSTED",
  ].includes(record.status);
  if (
    record.schemaVersion !== "pmh.official-source-discovery-job.v1" ||
    !HASH_PATTERN.test(String(record.jobId)) || record.jobId !== hashCanonical({
      schemaVersion: "pmh.official-source-discovery-job-id.v1",
      taskId: task.taskId,
      agentIdentity: record.agentIdentity,
    }) || record.taskId !== task.taskId || record.requirementId !== task.requirementId ||
    record.proposalId !== task.proposalId || !HASH_PATTERN.test(String(record.agentIdentity)) ||
    !["CODEX", "DEEPSEEK"].includes(record.provider) || !boundedText(record.model, 100) ||
    record.priorityTier !== task.priorityTier ||
    !["PENDING", "LEASED", "RETRY_WAIT", "ADMITTED", "NO_OFFICIAL_SOURCE_FOUND",
      "ABSTAINED", "EXHAUSTED"].includes(record.status) ||
    !Number.isSafeInteger(record.attemptCount) || record.attemptCount < 0 ||
    !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1 ||
    record.attemptCount > record.maxAttempts || !isIso(record.nextAttemptAt) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (record.status === "LEASED") !==
      (record.leasedAt !== null && record.leaseExpiresAt !== null) ||
    terminal !== (record.completedAt !== null) ||
    (record.status === "ADMITTED") !== (record.admittedRequirement !== null) ||
    (record.status === "ADMITTED" && !record.admissions.some((item) =>
      item.decision === "ADMITTED" && item.locator !== null
    )) ||
    (record.admittedRequirement !== null &&
      assertEvidenceRequirement(record.admittedRequirement).acquisitionRoute !== "DOCUMENT_LOCATOR") ||
    !Array.isArray(record.candidates) || record.candidates.length > 12 ||
    !Array.isArray(record.admissions) || record.admissions.length !== record.candidates.length ||
    !Number.isSafeInteger(record.providerRequestCount) || record.providerRequestCount < 0 ||
    !Number.isSafeInteger(record.toolCallCount) || record.toolCallCount < 0 ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    record.authority !== "OFFICIAL_SOURCE_DISCOVERY_ORCHESTRATION_ONLY" ||
    record.fetchAuthority !== false || record.semanticDecisionAuthority !== false ||
    record.certificateAuthority !== false || record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("official source discovery job violates its closed contract");
  return Object.freeze(record);
}

export class OfficialSourceDiscoveryScheduler {
  readonly #jobs: OfficialSourceDiscoveryJobRecord[];
  readonly #currentTaskIds = new Set<Hash>();
  readonly #active = new Map<Hash, Promise<OfficialSourceDiscoveryJobRecord>>();
  readonly #agent: OfficialSourceDiscoveryAgentPort | null;
  readonly #store: OfficialSourceDiscoverySchedulerStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #maxAttempts: number;
  readonly #maxRequestsPerTick: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SchedulerOptions) {
    this.#agent = options.agent;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.tickIntervalMs = options.tickIntervalMs ?? null;
    this.#concurrencyLimit = options.concurrencyLimit ?? 2;
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.#maxRequestsPerTick = options.maxRequestsPerTick ?? DEFAULT_MAX_REQUESTS_PER_TICK;
    this.#leaseTimeoutMs = options.leaseTimeoutMs ?? DEFAULT_LEASE_TIMEOUT_MS;
    this.#retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    if (
      this.#concurrencyLimit < 1 || this.#concurrencyLimit > 8 ||
      this.#maxAttempts < 1 || this.#maxAttempts > 5 ||
      this.#maxRequestsPerTick < 1 || this.#maxRequestsPerTick > 8 ||
      this.#leaseTimeoutMs < 1_000 || this.#retryDelayMs < 1_000 ||
      this.#retentionLimit < 10 || this.#retentionLimit > 5_000
    ) throw new Error("official source discovery scheduler configuration is invalid");
    this.#jobs = [...(
      this.#store?.loadOfficialSourceDiscoveryJobRecords(this.#retentionLimit) ?? []
    )].map(assertOfficialSourceDiscoveryJobRecord);
    this.#jobs.forEach((job) => this.#currentTaskIds.add(job.taskId));
    this.#recoverExpiredLeases();
  }

  public reconcile(input: readonly Readonly<{
    requirement: EvidenceRequirement;
    priorityTier: OfficialSourceDiscoveryTask["priorityTier"];
  }>[]): readonly OfficialSourceDiscoveryJobRecord[] {
    if (this.#agent === null) return Object.freeze([]);
    const created: OfficialSourceDiscoveryJobRecord[] = [];
    const tasks = buildOfficialSourceDiscoveryTasks(input);
    this.#currentTaskIds.clear();
    tasks.forEach((task) => this.#currentTaskIds.add(task.taskId));
    for (const task of tasks) {
      const jobId = hashCanonical({
        schemaVersion: "pmh.official-source-discovery-job-id.v1",
        taskId: task.taskId,
        agentIdentity: this.#agent.agentIdentity,
      });
      const existing = this.#jobs.find((job) => job.jobId === jobId);
      if (existing !== undefined) {
        const effectiveTask = PRIORITY_RANK[task.priorityTier] <
            PRIORITY_RANK[existing.priorityTier]
          ? task
          : existing.task;
        if (
          existing.task.taskHash !== effectiveTask.taskHash ||
          existing.priorityTier !== effectiveTask.priorityTier
        ) {
          const updatedAt = new Date(this.#now()).toISOString();
          this.#save(withHash({
            ...withoutHash(existing),
            task: effectiveTask,
            requirementId: effectiveTask.requirementId,
            proposalId: effectiveTask.proposalId,
            priorityTier: effectiveTask.priorityTier,
            updatedAt,
          }));
        }
        continue;
      }
      const now = new Date(this.#now()).toISOString();
      const record = withHash({
        schemaVersion: "pmh.official-source-discovery-job.v1",
        jobId,
        task,
        taskId: task.taskId,
        requirementId: task.requirementId,
        proposalId: task.proposalId,
        agentIdentity: this.#agent.agentIdentity,
        provider: this.#agent.provider,
        model: this.#agent.model,
        priorityTier: task.priorityTier,
        status: "PENDING",
        attemptCount: 0,
        maxAttempts: this.#maxAttempts,
        nextAttemptAt: now,
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: null,
        outcome: null,
        candidates: Object.freeze([]),
        admissions: Object.freeze([]),
        admittedRequirement: null,
        providerRequestCount: 0,
        toolCallCount: 0,
        diagnostic: null,
        createdAt: now,
        updatedAt: now,
        authority: "OFFICIAL_SOURCE_DISCOVERY_ORCHESTRATION_ONLY",
        fetchAuthority: false,
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      });
      created.push(this.#save(record));
    }
    return Object.freeze(created);
  }

  public applyAdmissions(
    requirementInputs: readonly EvidenceRequirement[],
  ): readonly EvidenceRequirement[] {
    const admittedByRequirement = new Map<Hash, OfficialSourceDiscoveryJobRecord[]>();
    for (const job of this.#jobs) {
      if (job.status !== "ADMITTED" || job.admittedRequirement === null) continue;
      for (const requirementId of officialSourceTaskRequirementIds(job.task)) {
        const jobs = admittedByRequirement.get(requirementId) ?? [];
        jobs.push(job);
        admittedByRequirement.set(requirementId, jobs);
      }
    }
    return Object.freeze(requirementInputs.map((input) => {
      const original = assertEvidenceRequirement(input);
      return (admittedByRequirement.get(original.requirementId) ?? [])
        .sort((left, right) => left.jobId.localeCompare(right.jobId))
        .reduce((requirement, job) => {
          const admission = job.admissions.find((item) =>
            item.decision === "ADMITTED" && item.locator !== null
          );
          return admission?.locator === null || admission === undefined ||
              admission.venueId === null || admission.protocolIdentity === null
            ? requirement
            : rebaseEvidenceRequirementToAdmittedLocator({
                requirement,
                venueId: admission.venueId,
                protocolIdentity: admission.protocolIdentity,
                locator: admission.locator,
              });
        }, original);
    }));
  }

  public tick(): readonly Promise<OfficialSourceDiscoveryJobRecord>[] {
    if (this.#agent === null || !this.#agent.configured) return Object.freeze([]);
    this.#recoverExpiredLeases();
    const now = this.#now();
    const due = this.#jobs.filter((job) =>
      job.agentIdentity === this.#agent!.agentIdentity &&
      this.#currentTaskIds.has(job.taskId) &&
      ["PENDING", "RETRY_WAIT"].includes(job.status) &&
      Date.parse(job.nextAttemptAt) <= now && !this.#active.has(job.jobId)
    ).sort((left, right) =>
      PRIORITY_RANK[left.priorityTier] - PRIORITY_RANK[right.priorityTier] ||
      left.nextAttemptAt.localeCompare(right.nextAttemptAt) ||
      left.jobId.localeCompare(right.jobId)
    );
    const capacity = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#maxRequestsPerTick,
    );
    return Object.freeze(due.slice(0, Math.max(0, capacity)).map((job) =>
      this.#dispatch(job)
    ));
  }

  public runJob(jobId: Hash): Promise<OfficialSourceDiscoveryJobRecord> {
    if (!HASH_PATTERN.test(String(jobId))) {
      throw new Error("official source discovery job identity is malformed");
    }
    if (this.#agent === null || !this.#agent.configured) {
      throw new Error("official source discovery Agent is not configured");
    }
    if (this.#active.size >= this.#concurrencyLimit) {
      throw new Error("official source discovery concurrency budget is full");
    }
    const job = this.#jobs.find((item) => item.jobId === jobId);
    if (job === undefined) throw new Error("official source discovery job was not found");
    if (job.agentIdentity !== this.#agent.agentIdentity) {
      throw new Error("official source discovery job belongs to a superseded Agent generation");
    }
    if (!this.#currentTaskIds.has(job.taskId)) {
      throw new Error("official source discovery job belongs to an inactive supply scope");
    }
    if (this.#active.has(jobId) || job.status === "LEASED") {
      throw new Error("official source discovery job is already running");
    }
    if (!["PENDING", "RETRY_WAIT"].includes(job.status)) {
      throw new Error(`official source discovery job is terminal: ${job.status}`);
    }
    return this.#dispatch(job);
  }

  #dispatch(job: OfficialSourceDiscoveryJobRecord): Promise<OfficialSourceDiscoveryJobRecord> {
    if (this.#agent === null) throw new Error("official source discovery Agent is unavailable");
    const nowMs = this.#now();
    const leased = this.#save(withHash({
      ...withoutHash(job),
      status: "LEASED",
      attemptCount: job.attemptCount + 1,
      leasedAt: new Date(nowMs).toISOString(),
      leaseExpiresAt: new Date(nowMs + this.#leaseTimeoutMs).toISOString(),
      updatedAt: new Date(nowMs).toISOString(),
      diagnostic: null,
    }));
    const promise = this.#agent.discover(leased.task).then((result) => {
      const completedAt = new Date(this.#now()).toISOString();
      const candidates = boundedOfficialSourceCandidates(leased.task, result.candidates);
      const admissions = Object.freeze(candidates.map((candidate) =>
        admitOfficialSourceCandidate({ task: leased.task, candidate, admittedAt: completedAt })
      ));
      const admitted = admissions.find((item) =>
        item.decision === "ADMITTED" && item.locator !== null &&
        item.venueId !== null && item.protocolIdentity !== null
      );
      const admittedRequirement = admitted === undefined || admitted.locator === null ||
          admitted.venueId === null || admitted.protocolIdentity === null
        ? null
        : rebaseEvidenceRequirementToAdmittedLocator({
            requirement: leased.task.requirement,
            venueId: admitted.venueId,
            protocolIdentity: admitted.protocolIdentity,
            locator: admitted.locator,
          });
      const status = admittedRequirement?.acquisitionRoute === "DOCUMENT_LOCATOR"
        ? "ADMITTED" as const
        : result.outcome === "NO_OFFICIAL_SOURCE_FOUND"
          ? "NO_OFFICIAL_SOURCE_FOUND" as const
          : "ABSTAINED" as const;
      return this.#save(withHash({
        ...withoutHash(leased),
        status,
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt,
        outcome: result.outcome,
        candidates,
        admissions,
        admittedRequirement,
        providerRequestCount: leased.providerRequestCount + result.providerRequestCount,
        toolCallCount: leased.toolCallCount + result.toolCallCount,
        diagnostic: compactDiagnostic(result.diagnostic),
        updatedAt: completedAt,
      }));
    }).catch((error: unknown) => {
      const now = new Date(this.#now()).toISOString();
      const exhausted = leased.attemptCount >= leased.maxAttempts;
      return this.#save(withHash({
        ...withoutHash(leased),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: exhausted
          ? now
          : new Date(this.#now() + this.#retryDelayMs).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? now : null,
        diagnostic: compactDiagnostic(error),
        updatedAt: now,
      }));
    }).finally(() => {
      this.#active.delete(job.jobId);
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #recoverExpiredLeases(): void {
    const now = this.#now();
    for (const job of [...this.#jobs]) {
      if (
        job.status !== "LEASED" || job.leaseExpiresAt === null ||
        Date.parse(job.leaseExpiresAt) > now || this.#active.has(job.jobId)
      ) continue;
      const exhausted = job.attemptCount >= job.maxAttempts;
      const at = new Date(now).toISOString();
      this.#save(withHash({
        ...withoutHash(job),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: exhausted ? at : new Date(now + this.#retryDelayMs).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? at : null,
        diagnostic: "official source discovery lease expired without a durable result",
        updatedAt: at,
      }));
    }
  }

  #save(recordInput: OfficialSourceDiscoveryJobRecord): OfficialSourceDiscoveryJobRecord {
    const record = assertOfficialSourceDiscoveryJobRecord(recordInput);
    const stored = this.#store?.saveOfficialSourceDiscoveryJobRecord(
      record,
      this.#retentionLimit,
    ) ?? record;
    const index = this.#jobs.findIndex((item) => item.jobId === stored.jobId);
    if (index === -1) this.#jobs.push(stored);
    else this.#jobs[index] = stored;
    this.#jobs.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.jobId.localeCompare(right.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) this.#jobs.length = this.#retentionLimit;
    return stored;
  }

  public awaitIdle(): Promise<readonly OfficialSourceDiscoveryJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): OfficialSourceDiscoverySchedulerProjection {
    const now = this.#now();
    const currentAgentIdentity = this.#agent?.agentIdentity ?? null;
    const jobs = Object.freeze(this.#jobs.filter((job) =>
      currentAgentIdentity !== null && job.agentIdentity === currentAgentIdentity &&
      this.#currentTaskIds.has(job.taskId)
    ));
    const count = (status: OfficialSourceDiscoveryJobStatus) =>
      jobs.filter((job) => job.status === status).length;
    return Object.freeze({
      schemaVersion: "pmh.official-source-discovery-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      configured: this.#agent?.configured ?? false,
      status: this.#agent?.configured !== true
        ? "NEEDS_PROVIDER"
        : this.#active.size > 0 ? "RUNNING" : "IDLE",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      dueCount: jobs.filter((job) =>
        ["PENDING", "RETRY_WAIT"].includes(job.status) && Date.parse(job.nextAttemptAt) <= now
      ).length,
      pendingCount: count("PENDING"),
      leasedCount: count("LEASED"),
      retryWaitCount: count("RETRY_WAIT"),
      admittedCount: count("ADMITTED"),
      noSourceCount: count("NO_OFFICIAL_SOURCE_FOUND"),
      abstainedCount: count("ABSTAINED"),
      exhaustedCount: count("EXHAUSTED"),
      supersededCount: this.#jobs.length - jobs.length,
      candidateCount: jobs.reduce((total, job) => total + job.candidates.length, 0),
      rejectedCandidateCount: jobs.reduce((total, job) =>
        total + job.admissions.filter((item) => item.decision === "REJECTED").length, 0
      ),
      providerRequestCount: jobs.reduce((total, job) => total + job.providerRequestCount, 0),
      toolCallCount: jobs.reduce((total, job) => total + job.toolCallCount, 0),
      jobs,
      storage: this.#store?.officialSourceDiscoveryJobStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 1,
        idempotencyKey: "jobId" as const,
      }),
      authority: "OFFICIAL_SOURCE_DISCOVERY_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false,
        anonymousOfficialReadsOnly: true,
        credentialsUsedForOfficialSources: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}

export function parseOfficialSourceDiscoveryTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_OFFICIAL_SOURCE_DISCOVERY_INTERVAL_MS?.trim();
  if (raw === undefined || raw === "" || raw === "0") return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 5_000 || parsed > 86_400_000) {
    throw new Error("PMH_OFFICIAL_SOURCE_DISCOVERY_INTERVAL_MS must be 0 or 5000..86400000");
  }
  return parsed;
}
