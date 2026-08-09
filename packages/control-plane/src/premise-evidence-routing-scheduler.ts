import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketRelationProposal } from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  assertPremiseAnalysisOutcomeCapsule,
  type PremiseAnalysisOutcomeCapsule,
} from "./premise-analysis-scheduler.js";
import {
  assertPremiseEvidenceRoutingArtifact,
  premiseEvidenceCorpusIdentity,
  premiseEvidenceRoutingId,
  type PremiseEvidenceRouterPort,
  type PremiseEvidenceRoutingArtifact,
} from "./premise-evidence-router.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 500;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_REQUESTS_PER_TICK = 2;
const DEFAULT_LEASE_TIMEOUT_MS = 330_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const JOB_KEYS = Object.freeze([
  "artifactHash", "attemptCount", "authority", "certificateAuthority", "completedAt",
  "corpusIdentity", "createdAt", "diagnostic", "executionAuthority", "jobId",
  "leaseExpiresAt", "leasedAt", "maxAttempts", "nextAttemptAt", "outcome",
  "productionReviewAuthority", "proposal", "providerRequestAuthority", "route",
  "routerIdentity", "schemaVersion", "semanticDecisionAuthority", "simulationAuthority",
  "status", "updatedAt",
]);

export type PremiseEvidenceRoutingJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "PASS"
  | "EXHAUSTED";

export type PremiseEvidenceRoutingCandidate = Readonly<{
  proposal: MarketRelationProposal;
  outcome: PremiseAnalysisOutcomeCapsule;
  corpus: MarketCorpusSnapshot;
}>;

export type PremiseEvidenceRoutingJobRecord = Readonly<{
  schemaVersion: "pmh.premise-evidence-routing-job.v1";
  jobId: Hash;
  proposal: MarketRelationProposal;
  outcome: PremiseAnalysisOutcomeCapsule;
  corpusIdentity: Hash;
  routerIdentity: Hash;
  status: PremiseEvidenceRoutingJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  route: PremiseEvidenceRoutingArtifact | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  productionReviewAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export interface PremiseEvidenceRoutingSchedulerStore {
  readonly premiseEvidenceRoutingJobStorage: OperationalStorageProjection<"jobId">;
  loadPremiseEvidenceRoutingJobRecords(
    limit: number,
  ): readonly PremiseEvidenceRoutingJobRecord[];
  savePremiseEvidenceRoutingJobRecord(
    record: PremiseEvidenceRoutingJobRecord,
    retentionLimit: number,
  ): PremiseEvidenceRoutingJobRecord;
}

export type PremiseEvidenceRoutingSchedulerProjection = Readonly<{
  schemaVersion: "pmh.premise-evidence-routing-scheduler.v1";
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
  supersededCount: number;
  sourcePremiseCount: number;
  routeGroupCount: number;
  derivedGroupCount: number;
  tradedStateGroupCount: number;
  ruleEvidenceGroupCount: number;
  externalResearchGroupCount: number;
  counterexampleGroupCount: number;
  unresolvedGroupCount: number;
  exactPotentialGroupCount: number;
  budget: Readonly<{
    basis: "PROVIDER_ATTEMPTS";
    maxAttemptsPerJob: number;
    maxRequestsPerTick: number;
    providerAttemptsStarted: number;
  }>;
  jobs: readonly PremiseEvidenceRoutingJobRecord[];
  storage: OperationalStorageProjection<"jobId">;
  authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY";
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
  router: PremiseEvidenceRouterPort | null;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: PremiseEvidenceRoutingSchedulerStore;
  now?: () => number;
}>;

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
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
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "premise evidence routing failed";
}

function assertProposal(value: MarketRelationProposal): MarketRelationProposal {
  if (
    value === null || typeof value !== "object" ||
    !HASH_PATTERN.test(String(value.proposalId)) ||
    !["EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "RELATED", "CONFLICTING"].includes(value.relationKind) ||
    !Array.isArray(value.listingRefs) || value.listingRefs.length < 2 ||
    value.listingRefs.length > 12 || new Set(value.listingRefs).size !== value.listingRefs.length ||
    value.listingRefs.some((item) => !boundedText(item, 500)) ||
    !boundedText(value.statement, 2_000) || !boundedText(value.rationale, 4_000) ||
    !Array.isArray(value.falsifiers) || value.falsifiers.length > 12 ||
    value.falsifiers.some((item) => !boundedText(item, 1_000)) ||
    value.authority !== "PROPOSE_ONLY" || value.reviewStatus !== "UNREVIEWED" ||
    value.executionAuthority !== false
  ) throw new Error("premise evidence routing proposal is malformed");
  return value;
}

function withoutHash(
  record: PremiseEvidenceRoutingJobRecord,
): Omit<PremiseEvidenceRoutingJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withHash(
  body: Omit<PremiseEvidenceRoutingJobRecord, "artifactHash">,
): PremiseEvidenceRoutingJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertPremiseEvidenceRoutingJobRecord(
  value: unknown,
): PremiseEvidenceRoutingJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("premise evidence routing job is malformed");
  }
  const record = value as PremiseEvidenceRoutingJobRecord;
  const { artifactHash, ...body } = record;
  const proposal = assertProposal(record.proposal);
  const outcome = assertPremiseAnalysisOutcomeCapsule(record.outcome);
  const route = record.route === null ? null : assertPremiseEvidenceRoutingArtifact(record.route);
  const validStatus = ["PENDING", "LEASED", "RETRY_WAIT", "PASS", "EXHAUSTED"]
    .includes(record.status);
  if (
    !exactKeys(record, JOB_KEYS) ||
    record.schemaVersion !== "pmh.premise-evidence-routing-job.v1" ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    !HASH_PATTERN.test(String(record.corpusIdentity)) ||
    !HASH_PATTERN.test(String(record.routerIdentity)) ||
    proposal.proposalId !== outcome.proposalId || outcome.unboundPremiseCount < 1 ||
    record.jobId !== premiseEvidenceRoutingId({
      proposalId: proposal.proposalId,
      outcomeHash: outcome.outcomeHash,
      corpusIdentity: record.corpusIdentity,
      routerIdentity: record.routerIdentity,
    }) || !validStatus || !Number.isSafeInteger(record.attemptCount) ||
    record.attemptCount < 0 || !Number.isSafeInteger(record.maxAttempts) ||
    record.maxAttempts < 1 || record.attemptCount > record.maxAttempts ||
    !isIso(record.nextAttemptAt) || !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (record.status === "LEASED") !== (record.leasedAt !== null && record.leaseExpiresAt !== null) ||
    (["PASS", "EXHAUSTED"].includes(record.status) !== (record.completedAt !== null)) ||
    (record.status === "PASS") !== (route !== null) ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    (route !== null && (
      route.routingId !== record.jobId || route.proposalId !== proposal.proposalId ||
      route.outcomeHash !== outcome.outcomeHash ||
      route.analysisArtifactHash !== outcome.analysisArtifactHash ||
      route.corpusIdentity !== record.corpusIdentity ||
      route.router.identity !== record.routerIdentity
    )) || record.authority !== "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY" ||
    record.providerRequestAuthority !== false || record.semanticDecisionAuthority !== false ||
    record.productionReviewAuthority !== false || record.simulationAuthority !== false ||
    record.certificateAuthority !== false || record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored premise evidence routing job violates its bounded contract");
  return Object.freeze(record);
}

export class PremiseEvidenceRoutingScheduler {
  readonly #jobs: PremiseEvidenceRoutingJobRecord[];
  readonly #active = new Map<Hash, Promise<PremiseEvidenceRoutingJobRecord>>();
  readonly #router: PremiseEvidenceRouterPort | null;
  readonly #store: PremiseEvidenceRoutingSchedulerStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #maxAttempts: number;
  readonly #maxRequestsPerTick: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SchedulerOptions) {
    this.#router = options.router;
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
    ) throw new Error("premise evidence routing scheduler configuration is invalid");
    this.#jobs = [...(
      this.#store?.loadPremiseEvidenceRoutingJobRecords(this.#retentionLimit) ?? []
    )].map(assertPremiseEvidenceRoutingJobRecord);
    this.#recoverExpiredLeases();
  }

  public reconcile(candidates: readonly PremiseEvidenceRoutingCandidate[]): void {
    if (this.#router === null) return;
    const timestamp = new Date(this.#now()).toISOString();
    for (const candidate of candidates) {
      const proposal = assertProposal(candidate.proposal);
      const outcome = assertPremiseAnalysisOutcomeCapsule(candidate.outcome);
      if (proposal.proposalId !== outcome.proposalId || outcome.unboundPremiseCount < 1) continue;
      const corpusIdentity = premiseEvidenceCorpusIdentity(candidate.corpus);
      const scopedJobs = this.#jobs.filter((job) =>
        job.proposal.proposalId === proposal.proposalId &&
        job.outcome.outcomeHash === outcome.outcomeHash &&
        job.routerIdentity === this.#router!.routerIdentity
      );
      // A route is an evidence plan for a bounded premise outcome, not a live
      // market-data subscription. Catalog growth may make a future manual or
      // policy refresh useful, but it must not silently spend another provider
      // budget every time the global corpus identity changes.
      if (scopedJobs.some((job) => job.status === "PASS" || job.status === "EXHAUSTED")) {
        continue;
      }
      if (scopedJobs.some((job) => job.corpusIdentity === corpusIdentity)) {
        continue;
      }
      const existing = [...scopedJobs].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.jobId.localeCompare(left.jobId)
      )[0];
      if (existing !== undefined) {
        if (existing.status !== "LEASED" && existing.corpusIdentity !== corpusIdentity) {
          const jobId = premiseEvidenceRoutingId({
            proposalId: proposal.proposalId,
            outcomeHash: outcome.outcomeHash,
            corpusIdentity,
            routerIdentity: this.#router.routerIdentity,
          });
          this.#save(withHash({
            schemaVersion: "pmh.premise-evidence-routing-job.v1",
            jobId,
            proposal,
            outcome,
            corpusIdentity,
            routerIdentity: this.#router.routerIdentity,
            status: "PENDING",
            attemptCount: 0,
            maxAttempts: this.#maxAttempts,
            nextAttemptAt: timestamp,
            leasedAt: null,
            leaseExpiresAt: null,
            completedAt: null,
            route: null,
            diagnostic: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY",
            providerRequestAuthority: false,
            semanticDecisionAuthority: false,
            productionReviewAuthority: false,
            simulationAuthority: false,
            certificateAuthority: false,
            executionAuthority: false,
          }));
        }
        continue;
      }
      const jobId = premiseEvidenceRoutingId({
        proposalId: proposal.proposalId,
        outcomeHash: outcome.outcomeHash,
        corpusIdentity,
        routerIdentity: this.#router.routerIdentity,
      });
      this.#save(withHash({
        schemaVersion: "pmh.premise-evidence-routing-job.v1",
        jobId,
        proposal,
        outcome,
        corpusIdentity,
        routerIdentity: this.#router.routerIdentity,
        status: "PENDING",
        attemptCount: 0,
        maxAttempts: this.#maxAttempts,
        nextAttemptAt: timestamp,
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: null,
        route: null,
        diagnostic: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY",
        providerRequestAuthority: false,
        semanticDecisionAuthority: false,
        productionReviewAuthority: false,
        simulationAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      }));
    }
    this.#recoverExpiredLeases();
  }

  public tick(
    candidates: readonly PremiseEvidenceRoutingCandidate[],
  ): readonly Promise<PremiseEvidenceRoutingJobRecord>[] {
    this.reconcile(candidates);
    if (this.tickIntervalMs === null || this.#router === null || !this.#router.configured) {
      return Object.freeze([]);
    }
    const available = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#maxRequestsPerTick,
    );
    if (available <= 0) return Object.freeze([]);
    const candidateByJob = new Map<Hash, PremiseEvidenceRoutingCandidate>();
    for (const candidate of candidates) {
      if (candidate.outcome.unboundPremiseCount < 1) continue;
      const corpusIdentity = premiseEvidenceCorpusIdentity(candidate.corpus);
      const scopedJobs = this.#jobs.filter((job) =>
        job.proposal.proposalId === candidate.proposal.proposalId &&
        job.outcome.outcomeHash === candidate.outcome.outcomeHash &&
        job.routerIdentity === this.#router!.routerIdentity
      );
      if (scopedJobs.some((job) => job.status === "PASS" || job.status === "EXHAUSTED")) {
        continue;
      }
      const current = [...scopedJobs].filter((job) =>
        job.corpusIdentity === corpusIdentity &&
        (job.status === "PENDING" || job.status === "RETRY_WAIT" || job.status === "LEASED")
      ).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.jobId.localeCompare(left.jobId)
      )[0];
      if (current !== undefined) candidateByJob.set(current.jobId, candidate);
    }
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
    job: PremiseEvidenceRoutingJobRecord,
    candidate: PremiseEvidenceRoutingCandidate,
  ): Promise<PremiseEvidenceRoutingJobRecord> {
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
    const promise = this.#router!.route(candidate).then((input) => {
      this.#active.delete(job.jobId);
      const route = assertPremiseEvidenceRoutingArtifact(input);
      if (
        route.routingId !== leased.jobId || route.proposalId !== leased.proposal.proposalId ||
        route.outcomeHash !== leased.outcome.outcomeHash ||
        route.analysisArtifactHash !== leased.outcome.analysisArtifactHash ||
        route.corpusIdentity !== leased.corpusIdentity ||
        route.router.identity !== leased.routerIdentity
      ) throw new Error("premise evidence route completion lineage is inconsistent");
      return this.#save(withHash({
        ...withoutHash(leased),
        status: "PASS",
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: route.completedAt,
        route,
        diagnostic: null,
        updatedAt: route.completedAt,
      }));
    }).catch((error) => {
      this.#active.delete(job.jobId);
      const now = Math.max(this.#now(), startedAt);
      const exhausted = leased.attemptCount >= leased.maxAttempts;
      return this.#save(withHash({
        ...withoutHash(leased),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * leased.attemptCount,
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        route: null,
        diagnostic: compactDiagnostic(error),
        updatedAt: new Date(now).toISOString(),
      }));
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #recoverExpiredLeases(): void {
    const now = this.#now();
    for (const job of this.#jobs.filter((item) =>
      item.status === "LEASED" && item.leaseExpiresAt !== null &&
      Date.parse(item.leaseExpiresAt) <= now && !this.#active.has(item.jobId)
    )) {
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
        route: null,
        diagnostic: exhausted
          ? "premise evidence routing lease expired after provider budget exhaustion"
          : "premise evidence routing lease expired before a durable result was observed",
        updatedAt: new Date(now).toISOString(),
      }));
    }
  }

  #save(input: PremiseEvidenceRoutingJobRecord): PremiseEvidenceRoutingJobRecord {
    const valid = assertPremiseEvidenceRoutingJobRecord(input);
    const stored = this.#store?.savePremiseEvidenceRoutingJobRecord(
      valid,
      this.#retentionLimit,
    ) ?? valid;
    const index = this.#jobs.findIndex((item) => item.jobId === stored.jobId);
    if (index >= 0) this.#jobs.splice(index, 1);
    this.#jobs.push(stored);
    this.#jobs.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) this.#jobs.splice(0, this.#jobs.length - this.#retentionLimit);
    return stored;
  }

  public awaitIdle(): Promise<readonly PremiseEvidenceRoutingJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): PremiseEvidenceRoutingSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const latestByScope = new Map<string, PremiseEvidenceRoutingJobRecord>();
    for (const job of jobs.filter((item) =>
      this.#router !== null && item.routerIdentity === this.#router.routerIdentity
    )) {
      const key = job.proposal.proposalId;
      const current = latestByScope.get(key);
      if (current === undefined) {
        latestByScope.set(key, job);
        continue;
      }
      if (current.outcome.outcomeHash === job.outcome.outcomeHash) {
        const priority = (status: PremiseEvidenceRoutingJobStatus): number =>
          status === "PASS" ? 3 : status === "EXHAUSTED" ? 2 : 1;
        if (priority(current.status) < priority(job.status)) latestByScope.set(key, job);
        else if (priority(current.status) === priority(job.status) &&
          current.createdAt < job.createdAt) {
          latestByScope.set(key, job);
        }
        continue;
      }
      if (current.createdAt < job.createdAt) latestByScope.set(key, job);
    }
    const currentJobs = [...latestByScope.values()];
    const groups = currentJobs.flatMap((job) => job.route?.groups ?? []);
    const configured = this.#router?.configured ?? false;
    const now = this.#now();
    const count = (disposition: string): number => groups.filter((group) =>
      group.disposition === disposition
    ).length;
    return Object.freeze({
      schemaVersion: "pmh.premise-evidence-routing-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      configured,
      status: !configured ? "NEEDS_KEY" : this.#active.size > 0 ? "RUNNING" : "IDLE",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      dueCount: currentJobs.filter((job) => ["PENDING", "RETRY_WAIT"].includes(job.status) &&
        Date.parse(job.nextAttemptAt) <= now).length,
      pendingCount: currentJobs.filter((job) => job.status === "PENDING").length,
      leasedCount: currentJobs.filter((job) => job.status === "LEASED").length,
      retryWaitCount: currentJobs.filter((job) => job.status === "RETRY_WAIT").length,
      passedCount: currentJobs.filter((job) => job.status === "PASS").length,
      exhaustedCount: currentJobs.filter((job) => job.status === "EXHAUSTED").length,
      supersededCount: jobs.length - currentJobs.length,
      sourcePremiseCount: currentJobs.filter((job) => job.status === "PASS")
        .reduce((sum, job) => sum + job.outcome.unboundPremiseCount, 0),
      routeGroupCount: groups.length,
      derivedGroupCount: count("DERIVED_RESTATEMENT"),
      tradedStateGroupCount: count("TRADED_STATE_CANDIDATE"),
      ruleEvidenceGroupCount: count("CONTRACT_RULE_EVIDENCE"),
      externalResearchGroupCount: count("EXTERNAL_FACT_RESEARCH"),
      counterexampleGroupCount: count("COUNTEREXAMPLE_CANDIDATE"),
      unresolvedGroupCount: count("UNRESOLVED"),
      exactPotentialGroupCount: groups.filter((group) =>
        group.exactAdmissionPotential === "POTENTIAL_AFTER_REVIEW"
      ).length,
      budget: Object.freeze({
        basis: "PROVIDER_ATTEMPTS" as const,
        maxAttemptsPerJob: this.#maxAttempts,
        maxRequestsPerTick: this.#maxRequestsPerTick,
        providerAttemptsStarted: jobs.reduce((sum, job) => sum + job.attemptCount, 0),
      }),
      jobs,
      storage: this.#store?.premiseEvidenceRoutingJobStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "jobId" as const,
      }),
      authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY",
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

export function parsePremiseEvidenceRoutingTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_PREMISE_EVIDENCE_ROUTING_TICK_MS?.trim() ?? "";
  if (raw === "") return 15_000;
  if (raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error(
      "PMH_PREMISE_EVIDENCE_ROUTING_TICK_MS must be 0 or an integer from 1000 to 60000",
    );
  }
  return value;
}
