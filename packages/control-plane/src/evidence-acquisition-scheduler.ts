import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertEvidenceDocumentCapture,
  type EvidenceDocumentCapture,
  type EvidenceDocumentFetchPolicy,
  type EvidenceDocumentFetcher,
} from "./evidence-document.js";
import {
  assertEvidenceRequirement,
  EVIDENCE_REQUIREMENT_KINDS,
  type EvidenceRequirement,
  type EvidenceRequirementKind,
} from "./evidence-requirement.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 250;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_REQUESTS_PER_TICK = 3;
const DEFAULT_LEASE_TIMEOUT_MS = 150_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const DEFAULT_FRESH_FOR_MS = 86_400_000;
const MAX_REQUIREMENTS_PER_JOB = 100;
const JOB_V1_KEYS = Object.freeze([
  "acquisitionScopeIdentity", "artifactHash", "attemptCount", "authority", "capturedAt",
  "certificateAuthority", "conditionalReuseCount", "createdAt", "diagnostic",
  "executionAuthority", "fetchAuthority",
  "httpStatus", "jobId", "kind", "lastDocumentId", "lastExtractionId",
  "lastObservationId", "leaseExpiresAt", "leasedAt", "locatorIdentity", "maxAttempts",
  "nextAttemptAt", "nextRefreshAt", "policyIdentity", "proposalIds",
  "providerRequestAuthority", "requirementIds", "requirements", "schemaVersion",
  "semanticDecisionAuthority", "status", "temporalPosture", "totalAttemptCount", "updatedAt",
]);
const JOB_V2_KEYS = Object.freeze([...JOB_V1_KEYS, "captureRequirementId"].sort());

export type EvidenceAcquisitionJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "CAPTURED"
  | "STALE"
  | "UNSUPPORTED"
  | "EXHAUSTED";

export type EvidenceAcquisitionJobRecord = Readonly<{
  schemaVersion: "pmh.evidence-acquisition-job.v1" | "pmh.evidence-acquisition-job.v2";
  jobId: Hash;
  acquisitionScopeIdentity: Hash;
  requirements: readonly EvidenceRequirement[];
  requirementIds: readonly Hash[];
  proposalIds: readonly Hash[];
  kind: EvidenceRequirementKind;
  temporalPosture: EvidenceRequirement["temporalPosture"];
  locatorIdentity: Hash | null;
  policyIdentity: Hash | null;
  status: EvidenceAcquisitionJobStatus;
  attemptCount: number;
  totalAttemptCount: number;
  conditionalReuseCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  capturedAt: string | null;
  nextRefreshAt: string | null;
  lastObservationId: Hash | null;
  lastDocumentId: Hash | null;
  lastExtractionId: Hash | null;
  captureRequirementId?: Hash | null;
  httpStatus: 200 | 304 | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY";
  fetchAuthority: false;
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export interface EvidenceAcquisitionSchedulerStore {
  readonly evidenceAcquisitionJobStorage: OperationalStorageProjection<"jobId">;
  readonly evidenceDocumentStorage: OperationalStorageProjection<"documentId">;
  readonly evidenceDocumentTextStorage: OperationalStorageProjection<"extractionId">;
  readonly evidenceDocumentObservationStorage: OperationalStorageProjection<"observationId">;
  loadEvidenceAcquisitionJobRecords(limit: number): readonly EvidenceAcquisitionJobRecord[];
  loadEvidenceAcquisitionJobRecordsByRequirementIds?(
    requirementIds: readonly Hash[],
  ): readonly EvidenceAcquisitionJobRecord[];
  saveEvidenceAcquisitionJobRecord(
    record: EvidenceAcquisitionJobRecord,
    retentionLimit: number,
  ): EvidenceAcquisitionJobRecord;
  loadEvidenceDocumentCapture(jobId: Hash): EvidenceDocumentCapture | null;
  saveEvidenceAcquisitionCompletion(
    record: EvidenceAcquisitionJobRecord,
    capture: EvidenceDocumentCapture,
    retentionLimit: number,
  ): Readonly<{ record: EvidenceAcquisitionJobRecord; capture: EvidenceDocumentCapture }>;
}

export type EvidenceAcquisitionSchedulerProjection = Readonly<{
  schemaVersion: "pmh.evidence-acquisition-scheduler.v1";
  enabled: boolean;
  status: "IDLE" | "RUNNING";
  tickIntervalMs: number | null;
  concurrencyLimit: number;
  activeCount: number;
  dueCount: number;
  pendingCount: number;
  leasedCount: number;
  retryWaitCount: number;
  capturedCount: number;
  staleCount: number;
  unsupportedCount: number;
  exhaustedCount: number;
  requirementCount: number;
  coalescedRequirementCount: number;
  conditionalReuseCount: number;
  sourceSpecificity: Readonly<{
    contractDetailCount: number;
    venuePolicyCount: number;
    legacyGenericCount: number;
    withoutLocatorCount: number;
  }>;
  requirementScope: Readonly<{
    proposalScopedCount: number;
    legacyCount: number;
  }>;
  budget: Readonly<{
    basis: "FETCH_ATTEMPTS";
    maxAttemptsPerJob: number;
    maxRequestsPerTick: number;
    fetchAttemptsStarted: number;
  }>;
  jobs: readonly EvidenceAcquisitionJobRecord[];
  storage: Readonly<{
    jobs: OperationalStorageProjection<"jobId">;
    documents: OperationalStorageProjection<"documentId">;
    text: OperationalStorageProjection<"extractionId">;
    observations: OperationalStorageProjection<"observationId">;
  }>;
  authority: "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    anonymousReadsOnly: true;
    credentialsUsed: false;
    providerRequests: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type EvidenceSourceSpecificity =
  | "CONTRACT_DETAIL"
  | "VENUE_POLICY"
  | "LEGACY_GENERIC"
  | "WITHOUT_LOCATOR";

function evidenceSourceSpecificity(
  job: EvidenceAcquisitionJobRecord,
): EvidenceSourceSpecificity {
  if (job.locatorIdentity === null) return "WITHOUT_LOCATOR";
  const locator = job.requirements.flatMap((requirement) =>
    requirement.eligibleLocators
  ).find((binding) => binding.locator.locatorIdentity === job.locatorIdentity)?.locator;
  if (locator === undefined) return "WITHOUT_LOCATOR";
  if (locator.role === "VENUE_RULE_DOCUMENT") return "VENUE_POLICY";
  if (locator.role !== "CONTRACT_RULE_DOCUMENT") return "WITHOUT_LOCATOR";
  if (
    locator.url === "https://www.cftc.gov/filings/orgrules/rules0519263672.docx"
  ) return "LEGACY_GENERIC";
  return "CONTRACT_DETAIL";
}

type SchedulerOptions = Readonly<{
  fetcher: EvidenceDocumentFetcher;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  maxAttempts?: number;
  maxRequestsPerTick?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  freshForMs?: number;
  retentionLimit?: number;
  store?: EvidenceAcquisitionSchedulerStore;
  now?: () => number;
}>;

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === keys.join("\n");
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function compactDiagnostic(value: unknown): string {
  return (value instanceof Error ? value.message : String(value))
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "evidence acquisition failed";
}

function jobId(acquisitionScopeIdentity: Hash): Hash {
  return hashCanonical({
    schemaVersion: "pmh.evidence-acquisition-job-id.v1",
    acquisitionScopeIdentity,
  });
}

function sortedUnique(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));
}

function requirementEvolutionIdentity(requirement: EvidenceRequirement): Hash {
  return hashCanonical({
    schemaVersion: "pmh.evidence-requirement-evolution.v1",
    acquisitionScopeIdentity: requirement.acquisitionScopeIdentity,
    origin: requirement.origin,
    proposalId: requirement.proposalId,
    kind: requirement.kind,
    listingRefs: requirement.listingRefs,
    claim: requirement.claim,
    reason: requirement.reason,
    satisfyingObservation: requirement.satisfyingObservation,
    contradictingObservation: requirement.contradictingObservation,
    temporalPosture: requirement.temporalPosture,
  });
}

function latestRequirementGenerations(
  requirements: readonly EvidenceRequirement[],
): readonly EvidenceRequirement[] {
  const latest = new Map<Hash, EvidenceRequirement>();
  for (const requirement of requirements) {
    const identity = requirementEvolutionIdentity(requirement);
    const retained = latest.get(identity);
    if (
      retained === undefined ||
      retained.schemaVersion === "pmh.evidence-requirement.v1" &&
        requirement.schemaVersion === "pmh.evidence-requirement.v2"
    ) latest.set(identity, requirement);
  }
  return Object.freeze([...latest.values()].sort((left, right) =>
    left.requirementId.localeCompare(right.requirementId)
  ));
}

function withHash(
  body: Omit<EvidenceAcquisitionJobRecord, "artifactHash">,
): EvidenceAcquisitionJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withoutHash(
  record: EvidenceAcquisitionJobRecord,
): Omit<EvidenceAcquisitionJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function linkedCaptureFields(record: EvidenceAcquisitionJobRecord): boolean {
  const values = [
    record.capturedAt,
    record.lastObservationId,
    record.lastDocumentId,
    record.lastExtractionId,
    record.httpStatus,
  ];
  return values.every((value) => value === null) || values.every((value) => value !== null);
}

export function assertEvidenceAcquisitionJobRecord(
  value: unknown,
): EvidenceAcquisitionJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored evidence acquisition job is malformed");
  }
  const record = value as EvidenceAcquisitionJobRecord;
  const leased = record.status === "LEASED";
  const hasCapture = record.capturedAt !== null;
  const expectedKeys = record.schemaVersion === "pmh.evidence-acquisition-job.v1"
    ? JOB_V1_KEYS
    : record.schemaVersion === "pmh.evidence-acquisition-job.v2"
      ? JOB_V2_KEYS
      : null;
  if (
    expectedKeys === null ||
    !exactKeys(record, expectedKeys) ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    !HASH_PATTERN.test(String(record.acquisitionScopeIdentity)) ||
    record.jobId !== jobId(record.acquisitionScopeIdentity) ||
    !Array.isArray(record.requirements) || record.requirements.length < 1 ||
    record.requirements.length > MAX_REQUIREMENTS_PER_JOB ||
    !Array.isArray(record.requirementIds) || record.requirementIds.length < 1 ||
    !Array.isArray(record.proposalIds) || record.proposalIds.length < 1 ||
    !(EVIDENCE_REQUIREMENT_KINDS as readonly string[]).includes(record.kind) ||
    !["CURRENT", "HISTORICAL_AT_SOURCE_OBSERVATION"].includes(record.temporalPosture) ||
    !["PENDING", "LEASED", "RETRY_WAIT", "CAPTURED", "STALE", "UNSUPPORTED", "EXHAUSTED"]
      .includes(record.status) ||
    !Number.isSafeInteger(record.attemptCount) || record.attemptCount < 0 ||
    !Number.isSafeInteger(record.totalAttemptCount) || record.totalAttemptCount < 0 ||
    record.totalAttemptCount > 1_000_000_000 || record.attemptCount > record.totalAttemptCount ||
    !Number.isSafeInteger(record.conditionalReuseCount) || record.conditionalReuseCount < 0 ||
    record.conditionalReuseCount > record.totalAttemptCount ||
    !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1 ||
    record.maxAttempts > 10 || record.attemptCount > record.maxAttempts ||
    !isIso(record.nextAttemptAt) ||
    leased !== (record.leasedAt !== null && record.leaseExpiresAt !== null) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    !linkedCaptureFields(record) ||
    (record.schemaVersion === "pmh.evidence-acquisition-job.v2" && (
      hasCapture !== (record.captureRequirementId !== null) ||
      record.captureRequirementId !== null &&
        !HASH_PATTERN.test(String(record.captureRequirementId))
    )) ||
    (record.capturedAt !== null && !isIso(record.capturedAt)) ||
    (record.nextRefreshAt !== null && !isIso(record.nextRefreshAt)) ||
    (record.httpStatus !== null && record.httpStatus !== 200 && record.httpStatus !== 304) ||
    (record.status === "CAPTURED" && !hasCapture) ||
    (record.status === "STALE" && !hasCapture) ||
    (hasCapture && record.temporalPosture === "CURRENT" && record.nextRefreshAt === null) ||
    (record.temporalPosture === "HISTORICAL_AT_SOURCE_OBSERVATION" &&
      record.nextRefreshAt !== null) ||
    (record.status === "UNSUPPORTED" && (
      record.locatorIdentity !== null || record.policyIdentity !== null ||
      record.attemptCount !== 0 || hasCapture
    )) ||
    (record.status !== "UNSUPPORTED" && (
      !HASH_PATTERN.test(String(record.locatorIdentity)) ||
      !HASH_PATTERN.test(String(record.policyIdentity))
    )) ||
    (record.status === "CAPTURED" && record.diagnostic !== null) ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    Date.parse(record.updatedAt) < Date.parse(record.createdAt) ||
    record.authority !== "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY" ||
    record.fetchAuthority !== false || record.providerRequestAuthority !== false ||
    record.semanticDecisionAuthority !== false || record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashCanonical(withoutHash(record))
  ) throw new Error("stored evidence acquisition job violates its bounded authority contract");

  const requirements = record.requirements.map(assertEvidenceRequirement);
  const requirementIds = sortedUnique(requirements.map((item) => item.requirementId));
  const proposalIds = sortedUnique(requirements.map((item) => item.proposalId));
  if (
    requirementIds.join("\n") !== record.requirementIds.join("\n") ||
    proposalIds.join("\n") !== record.proposalIds.join("\n") ||
    requirements.some((item) =>
      item.acquisitionScopeIdentity !== record.acquisitionScopeIdentity ||
      item.kind !== record.kind || item.temporalPosture !== record.temporalPosture
    ) ||
    record.locatorIdentity !== null && requirements.some((item) =>
      !item.eligibleLocators.some((binding) =>
        binding.locator.locatorIdentity === record.locatorIdentity
      )
    )
  ) throw new Error("stored evidence acquisition job lineage is inconsistent");
  return Object.freeze({ ...record, requirements: Object.freeze(requirements) });
}

export class EvidenceAcquisitionScheduler {
  readonly #jobs: EvidenceAcquisitionJobRecord[];
  readonly #captures = new Map<Hash, EvidenceDocumentCapture>();
  readonly #active = new Map<Hash, Promise<EvidenceAcquisitionJobRecord>>();
  readonly #fetcher: EvidenceDocumentFetcher;
  readonly #store: EvidenceAcquisitionSchedulerStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #maxAttempts: number;
  readonly #maxRequestsPerTick: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #freshForMs: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SchedulerOptions) {
    this.#fetcher = options.fetcher;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.tickIntervalMs = options.tickIntervalMs ?? null;
    this.#concurrencyLimit = options.concurrencyLimit ?? 3;
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.#maxRequestsPerTick = options.maxRequestsPerTick ?? DEFAULT_MAX_REQUESTS_PER_TICK;
    this.#leaseTimeoutMs = options.leaseTimeoutMs ?? DEFAULT_LEASE_TIMEOUT_MS;
    this.#retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.#freshForMs = options.freshForMs ?? DEFAULT_FRESH_FOR_MS;
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
      !Number.isSafeInteger(this.#freshForMs) ||
      this.#freshForMs < 1_000 || this.#freshForMs > 2_592_000_000 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 10
    ) throw new Error("evidence acquisition scheduler configuration is invalid or unbounded");
    this.#jobs = [...(
      this.#store?.loadEvidenceAcquisitionJobRecords(this.#retentionLimit) ?? []
    )].map(assertEvidenceAcquisitionJobRecord);
    for (const job of this.#jobs) {
      const capture = this.#store?.loadEvidenceDocumentCapture(job.jobId) ?? null;
      if (capture !== null) this.#bindCapture(job, capture);
      else if (job.lastObservationId !== null) {
        throw new Error("evidence acquisition job lost its retained capture");
      }
    }
  }

  #select(requirement: EvidenceRequirement): Readonly<{
    locatorIdentity: Hash;
    policyIdentity: Hash;
  }> | null {
    if (requirement.acquisitionRoute !== "DOCUMENT_LOCATOR") return null;
    const bindings = [...requirement.eligibleLocators].sort((left, right) => {
      const roleRank = (role: typeof left.locator.role): number =>
        requirement.kind === "ORACLE_SOURCE" && role === "OUTCOME_RESOLUTION_SOURCE"
          ? 0
          : requirement.kind === "ORACLE_SOURCE" && role === "CONTRACT_RULE_DOCUMENT"
          ? 1
          : 0;
      return roleRank(left.locator.role) - roleRank(right.locator.role) ||
        left.locator.locatorIdentity.localeCompare(right.locator.locatorIdentity);
    });
    for (const binding of bindings) {
      let policy: EvidenceDocumentFetchPolicy | null;
      try {
        policy = this.#fetcher.policyFor(
          requirement,
          binding.locator.locatorIdentity,
        );
      } catch {
        // Locator text may originate in untrusted venue or model evidence. A
        // policy violation makes this route unsupported; it must not make a
        // projection or scheduler reconciliation fatal.
        continue;
      }
      if (policy !== null) return Object.freeze({
        locatorIdentity: binding.locator.locatorIdentity,
        policyIdentity: policy.policyIdentity,
      });
    }
    return null;
  }

  public reconcile(inputs: readonly EvidenceRequirement[]): void {
    const requirements = [...new Map(inputs.map((input) => {
      const requirement = assertEvidenceRequirement(input);
      return [requirement.requirementId, requirement] as const;
    })).values()].sort((left, right) => left.requirementId.localeCompare(right.requirementId));
    const byScope = new Map<Hash, EvidenceRequirement[]>();
    for (const requirement of requirements) {
      const group = byScope.get(requirement.acquisitionScopeIdentity) ?? [];
      group.push(requirement);
      byScope.set(requirement.acquisitionScopeIdentity, group);
    }
    for (const [scope, additions] of byScope) {
      const current = this.#jobs.find((item) => item.acquisitionScopeIdentity === scope);
      const merged = latestRequirementGenerations([...new Map([
        ...(current?.requirements ?? []), ...additions,
      ].map((item) => [item.requirementId, item] as const)).values()]
        .sort((left, right) => left.requirementId.localeCompare(right.requirementId)));
      if (merged.length > MAX_REQUIREMENTS_PER_JOB) {
        throw new Error("evidence acquisition scope exceeds its retained requirement bound");
      }
      const selected = this.#select(merged[0]!);
      const timestamp = new Date(this.#now()).toISOString();
      if (current === undefined) {
        this.#saveJob(withHash({
          schemaVersion: "pmh.evidence-acquisition-job.v2",
          jobId: jobId(scope),
          acquisitionScopeIdentity: scope,
          requirements: Object.freeze(merged),
          requirementIds: sortedUnique(merged.map((item) => item.requirementId)),
          proposalIds: sortedUnique(merged.map((item) => item.proposalId)),
          kind: merged[0]!.kind,
          temporalPosture: merged[0]!.temporalPosture,
          locatorIdentity: selected?.locatorIdentity ?? null,
          policyIdentity: selected?.policyIdentity ?? null,
          status: selected === null ? "UNSUPPORTED" : "PENDING",
          attemptCount: 0,
          totalAttemptCount: 0,
          conditionalReuseCount: 0,
          maxAttempts: this.#maxAttempts,
          nextAttemptAt: timestamp,
          leasedAt: null,
          leaseExpiresAt: null,
          capturedAt: null,
          nextRefreshAt: null,
          lastObservationId: null,
          lastDocumentId: null,
          lastExtractionId: null,
          captureRequirementId: null,
          httpStatus: null,
          diagnostic: selected === null
            ? "no first-party document acquisition policy admits this evidence scope"
            : null,
          createdAt: timestamp,
          updatedAt: timestamp,
          authority: "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY",
          fetchAuthority: false,
          providerRequestAuthority: false,
          semanticDecisionAuthority: false,
          certificateAuthority: false,
          executionAuthority: false,
        }));
        continue;
      }
      const routeChanged = selected === null
        ? current.locatorIdentity !== null || current.policyIdentity !== null
        : current.locatorIdentity !== selected.locatorIdentity ||
          current.policyIdentity !== selected.policyIdentity;
      if (
        routeChanged && (
          current.capturedAt === null || current.temporalPosture === "CURRENT"
        )
      ) {
        this.#captures.delete(current.jobId);
        this.#saveJob(withHash({
          ...withoutHash(current),
          schemaVersion: "pmh.evidence-acquisition-job.v2",
          requirements: Object.freeze(merged),
          requirementIds: sortedUnique(merged.map((item) => item.requirementId)),
          proposalIds: sortedUnique(merged.map((item) => item.proposalId)),
          locatorIdentity: selected?.locatorIdentity ?? null,
          policyIdentity: selected?.policyIdentity ?? null,
          status: selected === null ? "UNSUPPORTED" : "PENDING",
          attemptCount: 0,
          nextAttemptAt: timestamp,
          leasedAt: null,
          leaseExpiresAt: null,
          capturedAt: null,
          nextRefreshAt: null,
          lastObservationId: null,
          lastDocumentId: null,
          lastExtractionId: null,
          captureRequirementId: null,
          httpStatus: null,
          diagnostic: selected === null
            ? "no first-party document acquisition policy admits this evidence scope"
            : null,
          updatedAt: timestamp,
        }));
        continue;
      }
      let status = current.status;
      let diagnostic = current.diagnostic;
      let locatorIdentity = current.locatorIdentity;
      let policyIdentity = current.policyIdentity;
      if (current.status === "UNSUPPORTED" && selected !== null) {
        status = "PENDING";
        diagnostic = null;
        locatorIdentity = selected.locatorIdentity;
        policyIdentity = selected.policyIdentity;
      } else if (
        current.status === "CAPTURED" && current.temporalPosture === "CURRENT" &&
        current.nextRefreshAt !== null && Date.parse(current.nextRefreshAt) <= this.#now()
      ) {
        status = "STALE";
      }
      if (
        merged.map((item) => item.requirementId).join("\n") !==
          current.requirementIds.join("\n") ||
        current.schemaVersion !== "pmh.evidence-acquisition-job.v2" ||
        status !== current.status || diagnostic !== current.diagnostic ||
        locatorIdentity !== current.locatorIdentity || policyIdentity !== current.policyIdentity
      ) this.#saveJob(withHash({
        ...withoutHash(current),
        schemaVersion: "pmh.evidence-acquisition-job.v2",
        requirements: Object.freeze(merged),
        requirementIds: sortedUnique(merged.map((item) => item.requirementId)),
        proposalIds: sortedUnique(merged.map((item) => item.proposalId)),
        locatorIdentity,
        policyIdentity,
        captureRequirementId: current.schemaVersion ===
            "pmh.evidence-acquisition-job.v2"
          ? current.captureRequirementId ?? null
          : this.#captures.get(current.jobId)?.observation.requirementId ?? null,
        status,
        diagnostic,
        updatedAt: timestamp,
      }));
    }
    this.#recoverExpiredLeases();
  }

  public tick(
    requirements: readonly EvidenceRequirement[],
  ): readonly Promise<EvidenceAcquisitionJobRecord>[] {
    this.reconcile(requirements);
    if (this.tickIntervalMs === null) return Object.freeze([]);
    const now = this.#now();
    const available = Math.min(
      this.#concurrencyLimit - this.#active.size,
      this.#maxRequestsPerTick,
    );
    if (available <= 0) return Object.freeze([]);
    const due = this.#jobs.filter((job) =>
      ["PENDING", "RETRY_WAIT", "STALE"].includes(job.status) &&
      Date.parse(job.nextAttemptAt) <= now && !this.#active.has(job.jobId)
    ).sort((left, right) =>
      Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt) ||
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    ).slice(0, available);
    return Object.freeze(due.map((job) => this.#dispatch(job)));
  }

  public runJob(
    jobId: Hash,
    requirements: readonly EvidenceRequirement[],
  ): Promise<EvidenceAcquisitionJobRecord> {
    this.reconcile(requirements);
    const job = this.#jobs.find((item) => item.jobId === jobId);
    if (job === undefined) throw new Error("evidence acquisition job was not found");
    const active = this.#active.get(job.jobId);
    if (active !== undefined) return active;
    if (!["PENDING", "RETRY_WAIT", "STALE"].includes(job.status)) {
      throw new Error(`evidence acquisition job is not runnable from ${job.status}`);
    }
    return this.#dispatch(job);
  }

  #dispatch(job: EvidenceAcquisitionJobRecord): Promise<EvidenceAcquisitionJobRecord> {
    if (job.locatorIdentity === null || job.policyIdentity === null) {
      throw new Error("evidence acquisition job has no admitted locator");
    }
    const requirement = job.requirements.find((item) =>
      item.eligibleLocators.some((binding) =>
        binding.locator.locatorIdentity === job.locatorIdentity
      )
    );
    if (requirement === undefined) {
      throw new Error("evidence acquisition job lost its locator lineage");
    }
    const startedAt = this.#now();
    const leased = this.#saveJob(withHash({
      ...withoutHash(job),
      status: "LEASED",
      attemptCount: job.attemptCount + 1,
      totalAttemptCount: job.totalAttemptCount + 1,
      leasedAt: new Date(startedAt).toISOString(),
      leaseExpiresAt: new Date(startedAt + this.#leaseTimeoutMs).toISOString(),
      diagnostic: null,
      updatedAt: new Date(startedAt).toISOString(),
    }));
    const previousCandidate = this.#captures.get(job.jobId);
    const previous = previousCandidate !== undefined &&
        previousCandidate.document.record.policyIdentity === job.policyIdentity &&
        previousCandidate.document.record.locatorIdentity === job.locatorIdentity
      ? previousCandidate
      : undefined;
    const promise = this.#fetcher.capture({
      requirement,
      locatorIdentity: job.locatorIdentity,
      ...(previous === undefined ? {} : { previous }),
    }).then((captureInput) => {
      this.#active.delete(job.jobId);
      const capture = assertEvidenceDocumentCapture(captureInput);
      const capturedAt = capture.observation.receivedAt;
      const current = this.#jobs.find((item) => item.jobId === job.jobId) ?? leased;
      const completed = withHash({
        ...withoutHash(current),
        schemaVersion: "pmh.evidence-acquisition-job.v2",
        status: "CAPTURED",
        attemptCount: 0,
        conditionalReuseCount: current.conditionalReuseCount +
          (capture.observation.httpStatus === 304 ? 1 : 0),
        nextAttemptAt: capturedAt,
        leasedAt: null,
        leaseExpiresAt: null,
        capturedAt,
        nextRefreshAt: current.temporalPosture === "CURRENT"
          ? new Date(Date.parse(capturedAt) + this.#freshForMs).toISOString()
          : null,
        lastObservationId: capture.observation.observationId,
        lastDocumentId: capture.document.record.documentId,
        lastExtractionId: capture.extraction.record.extractionId,
        captureRequirementId: requirement.requirementId,
        httpStatus: capture.observation.httpStatus,
        diagnostic: null,
        updatedAt: capturedAt,
      });
      return this.#complete(completed, capture);
    }).catch((error: unknown) => {
      this.#active.delete(job.jobId);
      const now = Math.max(this.#now(), startedAt);
      const current = this.#jobs.find((item) => item.jobId === job.jobId) ?? leased;
      const exhausted = current.attemptCount >= current.maxAttempts;
      return this.#saveJob(withHash({
        ...withoutHash(current),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * current.attemptCount,
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        diagnostic: compactDiagnostic(error),
        updatedAt: new Date(now).toISOString(),
      }));
    });
    this.#active.set(job.jobId, promise);
    return promise;
  }

  #complete(
    record: EvidenceAcquisitionJobRecord,
    capture: EvidenceDocumentCapture,
  ): EvidenceAcquisitionJobRecord {
    const validRecord = assertEvidenceAcquisitionJobRecord(record);
    const validCapture = assertEvidenceDocumentCapture(capture);
    const stored = this.#store?.saveEvidenceAcquisitionCompletion(
      validRecord,
      validCapture,
      this.#retentionLimit,
    ) ?? Object.freeze({ record: validRecord, capture: validCapture });
    this.#bindCapture(stored.record, stored.capture);
    this.#replaceJob(stored.record);
    return stored.record;
  }

  #bindCapture(
    job: EvidenceAcquisitionJobRecord,
    captureInput: EvidenceDocumentCapture,
  ): void {
    const capture = assertEvidenceDocumentCapture(captureInput);
    if (
      job.lastObservationId !== capture.observation.observationId ||
      job.lastDocumentId !== capture.document.record.documentId ||
      job.lastExtractionId !== capture.extraction.record.extractionId ||
      job.httpStatus !== capture.observation.httpStatus ||
      job.acquisitionScopeIdentity !== capture.observation.acquisitionScopeIdentity ||
      !(job.schemaVersion === "pmh.evidence-acquisition-job.v2"
        ? job.captureRequirementId === capture.observation.requirementId
        : job.requirementIds.includes(capture.observation.requirementId) ||
          job.requirements.some((requirement) =>
            requirement.schemaVersion === "pmh.evidence-requirement.v2"
          )) ||
      job.locatorIdentity !== capture.observation.locatorIdentity ||
      job.policyIdentity !== capture.observation.policyIdentity
    ) throw new Error("evidence acquisition capture does not match its job lineage");
    this.#captures.set(job.jobId, capture);
  }

  #recoverExpiredLeases(): void {
    const now = this.#now();
    for (const job of this.#jobs.filter((item) =>
      item.status === "LEASED" && item.leaseExpiresAt !== null &&
      Date.parse(item.leaseExpiresAt) <= now && !this.#active.has(item.jobId)
    )) {
      const exhausted = job.attemptCount >= job.maxAttempts;
      this.#saveJob(withHash({
        ...withoutHash(job),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(
          exhausted ? now : now + this.#retryDelayMs * Math.max(1, job.attemptCount),
        ).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        diagnostic: exhausted
          ? "evidence acquisition lease expired after the fetch budget was exhausted"
          : "evidence acquisition lease expired before a durable capture was observed",
        updatedAt: new Date(now).toISOString(),
      }));
    }
  }

  #replaceJob(recordInput: EvidenceAcquisitionJobRecord): EvidenceAcquisitionJobRecord {
    const record = assertEvidenceAcquisitionJobRecord(recordInput);
    const index = this.#jobs.findIndex((item) => item.jobId === record.jobId);
    if (index >= 0) this.#jobs.splice(index, 1);
    this.#jobs.push(record);
    this.#jobs.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.jobId.localeCompare(left.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) {
      const removed = this.#jobs.splice(this.#retentionLimit);
      for (const item of removed) this.#captures.delete(item.jobId);
    }
    return record;
  }

  #saveJob(recordInput: EvidenceAcquisitionJobRecord): EvidenceAcquisitionJobRecord {
    const record = assertEvidenceAcquisitionJobRecord(recordInput);
    const stored = this.#store?.saveEvidenceAcquisitionJobRecord(
      record,
      this.#retentionLimit,
    ) ?? record;
    return this.#replaceJob(stored);
  }

  public captureForJob(jobIdInput: Hash): EvidenceDocumentCapture | null {
    return this.#captures.get(jobIdInput) ?? null;
  }

  public awaitIdle(): Promise<readonly EvidenceAcquisitionJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): EvidenceAcquisitionSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const sourceSpecificities = jobs.map(evidenceSourceSpecificity);
    const now = this.#now();
    const memory = <Key extends string>(idempotencyKey: Key) => Object.freeze({
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey,
    });
    return Object.freeze({
      schemaVersion: "pmh.evidence-acquisition-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      status: this.#active.size === 0 ? "IDLE" : "RUNNING",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      activeCount: this.#active.size,
      dueCount: jobs.filter((job) =>
        ["PENDING", "RETRY_WAIT", "STALE"].includes(job.status) &&
        Date.parse(job.nextAttemptAt) <= now
      ).length,
      pendingCount: jobs.filter((job) => job.status === "PENDING").length,
      leasedCount: jobs.filter((job) => job.status === "LEASED").length,
      retryWaitCount: jobs.filter((job) => job.status === "RETRY_WAIT").length,
      capturedCount: jobs.filter((job) => job.status === "CAPTURED").length,
      staleCount: jobs.filter((job) => job.status === "STALE").length,
      unsupportedCount: jobs.filter((job) => job.status === "UNSUPPORTED").length,
      exhaustedCount: jobs.filter((job) => job.status === "EXHAUSTED").length,
      requirementCount: jobs.reduce((sum, job) => sum + job.requirementIds.length, 0),
      coalescedRequirementCount: jobs.reduce(
        (sum, job) => sum + Math.max(0, job.requirementIds.length - 1),
        0,
      ),
      conditionalReuseCount: jobs.reduce((sum, job) => sum + job.conditionalReuseCount, 0),
      sourceSpecificity: Object.freeze({
        contractDetailCount: sourceSpecificities.filter(
          (specificity) => specificity === "CONTRACT_DETAIL",
        ).length,
        venuePolicyCount: sourceSpecificities.filter(
          (specificity) => specificity === "VENUE_POLICY",
        ).length,
        legacyGenericCount: sourceSpecificities.filter(
          (specificity) => specificity === "LEGACY_GENERIC",
        ).length,
        withoutLocatorCount: sourceSpecificities.filter(
          (specificity) => specificity === "WITHOUT_LOCATOR",
        ).length,
      }),
      requirementScope: Object.freeze({
        proposalScopedCount: jobs.reduce((sum, job) =>
          sum + job.requirements.filter((requirement) =>
            requirement.schemaVersion === "pmh.evidence-requirement.v2"
          ).length, 0),
        legacyCount: jobs.reduce((sum, job) =>
          sum + job.requirements.filter((requirement) =>
            requirement.schemaVersion === "pmh.evidence-requirement.v1"
          ).length, 0),
      }),
      budget: Object.freeze({
        basis: "FETCH_ATTEMPTS" as const,
        maxAttemptsPerJob: this.#maxAttempts,
        maxRequestsPerTick: this.#maxRequestsPerTick,
        fetchAttemptsStarted: jobs.reduce((sum, job) => sum + job.totalAttemptCount, 0),
      }),
      jobs,
      storage: Object.freeze({
        jobs: this.#store?.evidenceAcquisitionJobStorage ?? memory("jobId"),
        documents: this.#store?.evidenceDocumentStorage ?? memory("documentId"),
        text: this.#store?.evidenceDocumentTextStorage ?? memory("extractionId"),
        observations: this.#store?.evidenceDocumentObservationStorage ??
          memory("observationId"),
      }),
      authority: "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false,
        anonymousReadsOnly: true,
        credentialsUsed: false,
        providerRequests: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}

export function parseEvidenceAcquisitionTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_EVIDENCE_ACQUISITION_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error(
      "PMH_EVIDENCE_ACQUISITION_TICK_MS must be 0 or an integer from 1000 to 60000",
    );
  }
  return value;
}
