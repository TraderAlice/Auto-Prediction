import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketRelationProposal } from "./market-archaeologist.js";
import {
  assertMarketCorpusSnapshot,
  buildMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import {
  assertPremiseEvidenceRoutingArtifact,
  type PremiseEvidenceRouteGroup,
  type PremiseEvidenceRoutingArtifact,
} from "./premise-evidence-router.js";
import {
  assertPremiseEvidenceRoutingJobRecord,
  type PremiseEvidenceRoutingJobRecord,
} from "./premise-evidence-routing-scheduler.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 250;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_REQUESTS_PER_TICK = 1;
const DEFAULT_LEASE_TIMEOUT_MS = 330_000;
const DEFAULT_RETRY_DELAY_MS = 60_000;
const MAX_EXPANSION_LISTINGS = 8;
const JOB_KEYS = Object.freeze([
  "candidateListingRefs", "artifactHash", "attemptCount", "authority",
  "certificateAuthority", "completedAt", "corpus", "createdAt", "diagnostic",
  "executionAuthority", "expanderIdentity", "generatedProposalIds", "jobId",
  "leaseExpiresAt", "leasedAt", "marketArchaeologistRunId", "maxAttempts",
  "nextAttemptAt", "premises", "productionReviewAuthority", "proposalCount",
  "providerRequestAuthority", "question", "reportArtifactHash", "routeGroupId",
  "schemaVersion", "semanticDecisionAuthority", "simulationAuthority",
  "sourceProposal", "sourceRoute", "status", "updatedAt",
]);

export type PremiseRouteExpansionJobStatus =
  | "PENDING"
  | "LEASED"
  | "RETRY_WAIT"
  | "PASS"
  | "EXHAUSTED";

export type PremiseRouteExpansionCandidate = Readonly<{
  sourceProposal: MarketRelationProposal;
  sourceRoute: PremiseEvidenceRoutingArtifact;
  routeGroup: PremiseEvidenceRouteGroup;
  premises: readonly Readonly<{ premiseId: Hash; proposition: string }>[];
  candidateListingRefs: readonly string[];
  corpus: MarketCorpusSnapshot;
  question: string;
}>;

export type PremiseRouteExpansionResult = Readonly<{
  marketArchaeologistRunId: Hash;
  reportArtifactHash: Hash;
  generatedProposalIds: readonly Hash[];
}>;

export interface PremiseRouteExpanderPort {
  readonly configured: boolean;
  readonly model: string;
  readonly expanderIdentity: Hash;
  expand(candidate: PremiseRouteExpansionCandidate): Promise<PremiseRouteExpansionResult>;
}

export type PremiseRouteExpansionJobRecord = Readonly<{
  schemaVersion: "pmh.premise-route-expansion-job.v1";
  jobId: Hash;
  sourceProposal: MarketRelationProposal;
  sourceRoute: PremiseEvidenceRoutingArtifact;
  routeGroupId: Hash;
  premises: readonly Readonly<{ premiseId: Hash; proposition: string }>[];
  candidateListingRefs: readonly string[];
  corpus: MarketCorpusSnapshot;
  question: string;
  expanderIdentity: Hash;
  status: PremiseRouteExpansionJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  marketArchaeologistRunId: Hash | null;
  reportArtifactHash: Hash | null;
  generatedProposalIds: readonly Hash[];
  proposalCount: number;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  authority: "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  productionReviewAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export interface PremiseRouteExpansionSchedulerStore {
  readonly premiseRouteExpansionJobStorage: OperationalStorageProjection<"jobId">;
  loadPremiseRouteExpansionJobRecords(
    limit: number,
  ): readonly PremiseRouteExpansionJobRecord[];
  savePremiseRouteExpansionJobRecord(
    record: PremiseRouteExpansionJobRecord,
    retentionLimit: number,
  ): PremiseRouteExpansionJobRecord;
}

export type PremiseRouteExpansionSchedulerProjection = Readonly<{
  schemaVersion: "pmh.premise-route-expansion-scheduler.v1";
  enabled: boolean;
  configured: boolean;
  model: string;
  status: "IDLE" | "RUNNING" | "NEEDS_KEY";
  tickIntervalMs: number | null;
  concurrencyLimit: 1;
  activeCount: number;
  dueCount: number;
  pendingCount: number;
  leasedCount: number;
  retryWaitCount: number;
  passedCount: number;
  exhaustedCount: number;
  zeroProposalCount: number;
  proposalYieldJobCount: number;
  generatedProposalCount: number;
  candidateListingCount: number;
  budget: Readonly<{
    basis: "PROVIDER_ATTEMPTS";
    maxAttemptsPerJob: number;
    maxRequestsPerTick: 1;
    providerAttemptsStarted: number;
  }>;
  jobs: readonly PremiseRouteExpansionJobRecord[];
  storage: OperationalStorageProjection<"jobId">;
  authority: "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type PremiseRouteExpansionReviewLineage = Readonly<{
  proposalId: Hash;
  issueIds: readonly Hash[];
  priority: 1 | 2 | 3 | 4 | 5;
}>;

type SchedulerOptions = Readonly<{
  expander: PremiseRouteExpanderPort;
  tickIntervalMs?: number | null;
  maxAttempts?: number;
  leaseTimeoutMs?: number;
  retryDelayMs?: number;
  retentionLimit?: number;
  store?: PremiseRouteExpansionSchedulerStore;
  now?: () => number;
}>;

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function compactDiagnostic(value: unknown): string {
  return (value instanceof Error ? value.message : String(value))
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "premise route expansion failed";
}

function assertProposal(value: MarketRelationProposal): MarketRelationProposal {
  if (
    value === null || typeof value !== "object" ||
    !HASH_PATTERN.test(String(value.proposalId)) ||
    !["EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "RELATED", "CONFLICTING"].includes(value.relationKind) ||
    !Array.isArray(value.listingRefs) || value.listingRefs.length < 2 ||
    value.listingRefs.length > MAX_EXPANSION_LISTINGS ||
    new Set(value.listingRefs).size !== value.listingRefs.length ||
    value.listingRefs.some((item) => !boundedText(item, 500)) ||
    !boundedText(value.statement, 2_000) || !boundedText(value.rationale, 4_000) ||
    !Array.isArray(value.falsifiers) || value.falsifiers.length > 12 ||
    value.falsifiers.some((item) => !boundedText(item, 1_000)) ||
    value.authority !== "PROPOSE_ONLY" || value.reviewStatus !== "UNREVIEWED" ||
    value.executionAuthority !== false
  ) throw new Error("premise route expansion proposal is malformed");
  return value;
}

function routeGroup(
  route: PremiseEvidenceRoutingArtifact,
  groupId: Hash,
): PremiseEvidenceRouteGroup {
  const group = route.groups.find((item) => item.groupId === groupId);
  if (
    group === undefined || group.disposition !== "TRADED_STATE_CANDIDATE" ||
    group.nextAction !== "EXPAND_RELATION_SCOPE" ||
    group.exactAdmissionPotential !== "POTENTIAL_AFTER_REVIEW" ||
    group.candidateListingRefs.length < 1
  ) throw new Error("premise route expansion group is not actionable");
  return group;
}

function expansionQuestion(input: Readonly<{
  proposal: MarketRelationProposal;
  group: PremiseEvidenceRouteGroup;
  premises: readonly Readonly<{ premiseId: Hash; proposition: string }>[];
  candidateListingRefs: readonly string[];
}>): string {
  return [
    "Reformulate one prediction-market relation after binding a hidden premise to candidate traded state.",
    `Original relation (${input.proposal.relationKind}): ${input.proposal.statement}`,
    `Original rationale: ${input.proposal.rationale}`,
    `Hidden premise obligations: ${input.premises.map((item) => item.proposition).join(" | ")}`,
    `Router evidence question: ${input.group.evidenceQuestion}`,
    `Candidate traded-state listing refs (they may already belong to the source relation): ${input.candidateListingRefs.join(", ")}`,
    "Inspect every exact MarketFS listing. Prefer a counterexample. Submit a new proposal only if binding the hidden premise to the candidate traded state materially changes the relation's state interpretation or state space, and the settlement logic supports a precise relation over 2-8 exact refs. Do not merely restate the source thesis. Zero proposals is a valid result.",
  ].join("\n");
}

export function buildPremiseRouteExpansionCandidate(input: Readonly<{
  sourceJob: PremiseEvidenceRoutingJobRecord;
  availableCorpus: MarketCorpusSnapshot;
  routeGroupId: Hash;
}>): PremiseRouteExpansionCandidate {
  const sourceJob = assertPremiseEvidenceRoutingJobRecord(input.sourceJob);
  const available = assertMarketCorpusSnapshot(input.availableCorpus);
  if (sourceJob.status !== "PASS" || sourceJob.route === null) {
    throw new Error("premise route expansion requires a passing source route");
  }
  const route = assertPremiseEvidenceRoutingArtifact(sourceJob.route);
  const group = routeGroup(route, input.routeGroupId);
  const proposal = assertProposal(sourceJob.proposal);
  const candidateListingRefs = Object.freeze([...group.candidateListingRefs]);
  const listingRefs = Object.freeze([...new Set([
    ...proposal.listingRefs,
    ...candidateListingRefs,
  ])].sort());
  if (
    candidateListingRefs.length < 1 || listingRefs.length > MAX_EXPANSION_LISTINGS ||
    listingRefs.some((ref) => !available.listings.some((item) => item.listingRef === ref))
  ) throw new Error("premise route expansion corpus is unavailable or unbounded");
  const premises = Object.freeze(group.premiseIds.map((premiseId) => {
    const obligation = sourceJob.outcome.obligations.find((item) =>
      item.premiseId === premiseId
    );
    if (obligation === undefined) throw new Error("premise route expansion lost its obligation");
    return Object.freeze({ premiseId, proposition: obligation.proposition });
  }));
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({
      schemaVersion: "pmh.premise-route-expansion-corpus-source.v1",
      sourceRoutingArtifactHash: route.artifactHash,
      routeGroupId: group.groupId,
      availableSourceSetIdentity: available.sourceSetIdentity,
    }),
    eligibleSourceCount: available.eligibleSourceCount,
    excludedSourceCount: available.excludedSourceCount,
    listings: listingRefs.map((ref) =>
      available.listings.find((item) => item.listingRef === ref)!
    ),
  });
  return Object.freeze({
    sourceProposal: proposal,
    sourceRoute: route,
    routeGroup: group,
    premises,
    candidateListingRefs,
    corpus,
    question: expansionQuestion({ proposal, group, premises, candidateListingRefs }),
  });
}

function expansionJobId(input: Readonly<{
  sourceRouteArtifactHash: Hash;
  routeGroupId: Hash;
  expanderIdentity: Hash;
}>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.premise-route-expansion-scope.v1",
    ...input,
  });
}

function withoutHash(
  record: PremiseRouteExpansionJobRecord,
): Omit<PremiseRouteExpansionJobRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withHash(
  body: Omit<PremiseRouteExpansionJobRecord, "artifactHash">,
): PremiseRouteExpansionJobRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertPremiseRouteExpansionJobRecord(
  value: unknown,
): PremiseRouteExpansionJobRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored premise route expansion job is malformed");
  }
  const record = value as PremiseRouteExpansionJobRecord;
  const { artifactHash, ...body } = record;
  const proposal = assertProposal(record.sourceProposal);
  const route = assertPremiseEvidenceRoutingArtifact(record.sourceRoute);
  const group = routeGroup(route, record.routeGroupId);
  const corpus = assertMarketCorpusSnapshot(record.corpus);
  const terminal = record.status === "PASS" || record.status === "EXHAUSTED";
  const leased = record.status === "LEASED";
  const expectedRefs = [...new Set([
    ...proposal.listingRefs,
    ...record.candidateListingRefs,
  ])].sort();
  if (
    !exactKeys(record, JOB_KEYS) ||
    record.schemaVersion !== "pmh.premise-route-expansion-job.v1" ||
    !HASH_PATTERN.test(String(record.jobId)) ||
    record.jobId !== expansionJobId({
      sourceRouteArtifactHash: route.artifactHash,
      routeGroupId: group.groupId,
      expanderIdentity: record.expanderIdentity,
    }) || proposal.proposalId !== route.proposalId ||
    !Array.isArray(record.premises) || record.premises.length !== group.premiseIds.length ||
    record.premises.some((item, index) =>
      item === null || typeof item !== "object" ||
      item.premiseId !== group.premiseIds[index] || !boundedText(item.proposition, 2_000)
    ) || !Array.isArray(record.candidateListingRefs) || record.candidateListingRefs.length < 1 ||
    record.candidateListingRefs.join("\n") !== group.candidateListingRefs.join("\n") ||
    expectedRefs.join("\n") !== corpus.listings.map((item) =>
      item.listingRef
    ).sort().join("\n") || !boundedText(record.question, 8_000) ||
    !HASH_PATTERN.test(String(record.expanderIdentity)) ||
    !["PENDING", "LEASED", "RETRY_WAIT", "PASS", "EXHAUSTED"].includes(record.status) ||
    !Number.isSafeInteger(record.attemptCount) || record.attemptCount < 0 ||
    !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1 ||
    record.maxAttempts > 10 || record.attemptCount > record.maxAttempts ||
    !isIso(record.nextAttemptAt) || leased !== (record.leasedAt !== null &&
      record.leaseExpiresAt !== null) ||
    (record.leasedAt !== null && !isIso(record.leasedAt)) ||
    (record.leaseExpiresAt !== null && !isIso(record.leaseExpiresAt)) ||
    terminal !== (record.completedAt !== null) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (record.status === "PASS") !== (record.marketArchaeologistRunId !== null &&
      record.reportArtifactHash !== null) ||
    (record.marketArchaeologistRunId !== null &&
      !HASH_PATTERN.test(String(record.marketArchaeologistRunId))) ||
    (record.reportArtifactHash !== null && !HASH_PATTERN.test(String(record.reportArtifactHash))) ||
    !Array.isArray(record.generatedProposalIds) ||
    record.generatedProposalIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    new Set(record.generatedProposalIds).size !== record.generatedProposalIds.length ||
    record.proposalCount !== record.generatedProposalIds.length ||
    (record.status !== "PASS" && record.proposalCount !== 0) ||
    (record.status === "PASS" && record.diagnostic !== null) ||
    (record.diagnostic !== null && !boundedText(record.diagnostic, 500)) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    Date.parse(record.updatedAt) < Date.parse(record.createdAt) ||
    record.authority !== "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY" ||
    record.providerRequestAuthority !== false || record.semanticDecisionAuthority !== false ||
    record.productionReviewAuthority !== false || record.simulationAuthority !== false ||
    record.certificateAuthority !== false || record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("stored premise route expansion job violates its bounded contract");
  return Object.freeze({ ...record, sourceProposal: proposal, sourceRoute: route, corpus });
}

export class PremiseRouteExpansionScheduler {
  readonly #jobs: PremiseRouteExpansionJobRecord[];
  readonly #active = new Map<Hash, Promise<PremiseRouteExpansionJobRecord>>();
  readonly #expander: PremiseRouteExpanderPort;
  readonly #store: PremiseRouteExpansionSchedulerStore | undefined;
  readonly #now: () => number;
  readonly #maxAttempts: number;
  readonly #leaseTimeoutMs: number;
  readonly #retryDelayMs: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SchedulerOptions) {
    this.#expander = options.expander;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.tickIntervalMs = options.tickIntervalMs ?? null;
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.#leaseTimeoutMs = options.leaseTimeoutMs ?? DEFAULT_LEASE_TIMEOUT_MS;
    this.#retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    if (
      (this.tickIntervalMs !== null && (!Number.isSafeInteger(this.tickIntervalMs) ||
        this.tickIntervalMs < 1_000 || this.tickIntervalMs > 60_000)) ||
      !Number.isSafeInteger(this.#maxAttempts) || this.#maxAttempts < 1 ||
      this.#maxAttempts > 10 || !Number.isSafeInteger(this.#leaseTimeoutMs) ||
      this.#leaseTimeoutMs < 10_000 || this.#leaseTimeoutMs > 900_000 ||
      !Number.isSafeInteger(this.#retryDelayMs) || this.#retryDelayMs < 1_000 ||
      this.#retryDelayMs > 86_400_000 || !Number.isSafeInteger(this.#retentionLimit) ||
      this.#retentionLimit < 10
    ) throw new Error("premise route expansion scheduler configuration is invalid");
    this.#jobs = [...(
      this.#store?.loadPremiseRouteExpansionJobRecords(this.#retentionLimit) ?? []
    )].map(assertPremiseRouteExpansionJobRecord);
    this.#recoverExpiredLeases();
  }

  public reconcile(candidates: readonly PremiseRouteExpansionCandidate[]): void {
    const timestamp = new Date(this.#now()).toISOString();
    for (const candidate of candidates) {
      const route = assertPremiseEvidenceRoutingArtifact(candidate.sourceRoute);
      const group = routeGroup(route, candidate.routeGroup.groupId);
      const jobId = expansionJobId({
        sourceRouteArtifactHash: route.artifactHash,
        routeGroupId: group.groupId,
        expanderIdentity: this.#expander.expanderIdentity,
      });
      if (this.#jobs.some((job) => job.jobId === jobId)) continue;
      this.#save(withHash({
        schemaVersion: "pmh.premise-route-expansion-job.v1",
        jobId,
        sourceProposal: candidate.sourceProposal,
        sourceRoute: route,
        routeGroupId: group.groupId,
        premises: candidate.premises,
        candidateListingRefs: candidate.candidateListingRefs,
        corpus: candidate.corpus,
        question: candidate.question,
        expanderIdentity: this.#expander.expanderIdentity,
        status: "PENDING",
        attemptCount: 0,
        maxAttempts: this.#maxAttempts,
        nextAttemptAt: timestamp,
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: null,
        marketArchaeologistRunId: null,
        reportArtifactHash: null,
        generatedProposalIds: Object.freeze([]),
        proposalCount: 0,
        diagnostic: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        authority: "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY",
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
    candidates: readonly PremiseRouteExpansionCandidate[],
  ): readonly Promise<PremiseRouteExpansionJobRecord>[] {
    this.reconcile(candidates);
    if (this.tickIntervalMs === null || !this.#expander.configured || this.#active.size > 0) {
      return Object.freeze([]);
    }
    const now = this.#now();
    const due = this.#jobs.filter((job) =>
      (job.status === "PENDING" || job.status === "RETRY_WAIT") &&
      Date.parse(job.nextAttemptAt) <= now && !this.#active.has(job.jobId)
    ).sort((left, right) =>
      Date.parse(left.nextAttemptAt) - Date.parse(right.nextAttemptAt) ||
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    ).slice(0, DEFAULT_MAX_REQUESTS_PER_TICK);
    return Object.freeze(due.map((job) => this.#dispatch(job)));
  }

  #dispatch(job: PremiseRouteExpansionJobRecord): Promise<PremiseRouteExpansionJobRecord> {
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
    const group = routeGroup(leased.sourceRoute, leased.routeGroupId);
    const candidate: PremiseRouteExpansionCandidate = Object.freeze({
      sourceProposal: leased.sourceProposal,
      sourceRoute: leased.sourceRoute,
      routeGroup: group,
      premises: leased.premises,
      candidateListingRefs: leased.candidateListingRefs,
      corpus: leased.corpus,
      question: leased.question,
    });
    const promise = this.#expander.expand(candidate).then((result) => {
      this.#active.delete(job.jobId);
      if (
        !HASH_PATTERN.test(String(result.marketArchaeologistRunId)) ||
        !HASH_PATTERN.test(String(result.reportArtifactHash)) ||
        !Array.isArray(result.generatedProposalIds) ||
        result.generatedProposalIds.some((item) => !HASH_PATTERN.test(String(item))) ||
        new Set(result.generatedProposalIds).size !== result.generatedProposalIds.length
      ) throw new Error("premise route expansion result is malformed");
      const completedAt = new Date(Math.max(this.#now(), startedAt)).toISOString();
      return this.#save(withHash({
        ...withoutHash(leased),
        status: "PASS",
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt,
        marketArchaeologistRunId: result.marketArchaeologistRunId,
        reportArtifactHash: result.reportArtifactHash,
        generatedProposalIds: Object.freeze([...result.generatedProposalIds].sort()),
        proposalCount: result.generatedProposalIds.length,
        diagnostic: null,
        updatedAt: completedAt,
      }));
    }).catch((error) => {
      this.#active.delete(job.jobId);
      const now = Math.max(this.#now(), startedAt);
      const exhausted = leased.attemptCount >= leased.maxAttempts;
      return this.#save(withHash({
        ...withoutHash(leased),
        status: exhausted ? "EXHAUSTED" : "RETRY_WAIT",
        nextAttemptAt: new Date(exhausted
          ? now
          : now + this.#retryDelayMs * leased.attemptCount).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        marketArchaeologistRunId: null,
        reportArtifactHash: null,
        generatedProposalIds: Object.freeze([]),
        proposalCount: 0,
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
        nextAttemptAt: new Date(exhausted
          ? now
          : now + this.#retryDelayMs * Math.max(1, job.attemptCount)).toISOString(),
        leasedAt: null,
        leaseExpiresAt: null,
        completedAt: exhausted ? new Date(now).toISOString() : null,
        diagnostic: exhausted
          ? "premise route expansion lease expired after provider budget exhaustion"
          : "premise route expansion lease expired before a durable result was observed",
        updatedAt: new Date(now).toISOString(),
      }));
    }
  }

  #save(record: PremiseRouteExpansionJobRecord): PremiseRouteExpansionJobRecord {
    const valid = assertPremiseRouteExpansionJobRecord(record);
    const stored = this.#store?.savePremiseRouteExpansionJobRecord(
      valid,
      this.#retentionLimit,
    ) ?? valid;
    const index = this.#jobs.findIndex((item) => item.jobId === stored.jobId);
    if (index >= 0) this.#jobs.splice(index, 1);
    this.#jobs.push(stored);
    this.#jobs.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId)
    );
    if (this.#jobs.length > this.#retentionLimit) {
      this.#jobs.splice(0, this.#jobs.length - this.#retentionLimit);
    }
    return stored;
  }

  public awaitIdle(): Promise<readonly PremiseRouteExpansionJobRecord[]> {
    return Promise.all([...this.#active.values()]);
  }

  public projection(): PremiseRouteExpansionSchedulerProjection {
    const jobs = Object.freeze([...this.#jobs]);
    const configured = this.#expander.configured;
    const now = this.#now();
    return Object.freeze({
      schemaVersion: "pmh.premise-route-expansion-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      configured,
      model: this.#expander.model,
      status: !configured ? "NEEDS_KEY" : this.#active.size > 0 ? "RUNNING" : "IDLE",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: 1,
      activeCount: this.#active.size,
      dueCount: jobs.filter((job) =>
        (job.status === "PENDING" || job.status === "RETRY_WAIT") &&
        Date.parse(job.nextAttemptAt) <= now
      ).length,
      pendingCount: jobs.filter((job) => job.status === "PENDING").length,
      leasedCount: jobs.filter((job) => job.status === "LEASED").length,
      retryWaitCount: jobs.filter((job) => job.status === "RETRY_WAIT").length,
      passedCount: jobs.filter((job) => job.status === "PASS").length,
      exhaustedCount: jobs.filter((job) => job.status === "EXHAUSTED").length,
      zeroProposalCount: jobs.filter((job) => job.status === "PASS" &&
        job.proposalCount === 0).length,
      proposalYieldJobCount: jobs.filter((job) => job.status === "PASS" &&
        job.proposalCount > 0).length,
      generatedProposalCount: jobs.reduce((sum, job) => sum + job.proposalCount, 0),
      candidateListingCount: jobs.reduce((sum, job) =>
        sum + job.candidateListingRefs.length, 0),
      budget: Object.freeze({
        basis: "PROVIDER_ATTEMPTS" as const,
        maxAttemptsPerJob: this.#maxAttempts,
        maxRequestsPerTick: 1 as const,
        providerAttemptsStarted: jobs.reduce((sum, job) => sum + job.attemptCount, 0),
      }),
      jobs,
      storage: this.#store?.premiseRouteExpansionJobStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "jobId" as const,
      }),
      authority: "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY",
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

export function derivePremiseRouteExpansionReviewLineage(
  jobs: readonly PremiseRouteExpansionJobRecord[],
  sourceLineage: readonly PremiseRouteExpansionReviewLineage[],
): readonly PremiseRouteExpansionReviewLineage[] {
  const sources = new Map(sourceLineage.map((item) => [item.proposalId, item] as const));
  const inherited = new Map<Hash, {
    issueIds: Set<Hash>;
    priority: 1 | 2 | 3 | 4 | 5;
  }>();
  for (const rawJob of jobs) {
    const job = assertPremiseRouteExpansionJobRecord(rawJob);
    if (job.status !== "PASS") continue;
    const source = sources.get(job.sourceProposal.proposalId);
    for (const proposalId of job.generatedProposalIds) {
      const current = inherited.get(proposalId) ?? {
        issueIds: new Set<Hash>(),
        priority: 1 as const,
      };
      for (const issueId of source?.issueIds ?? []) current.issueIds.add(issueId);
      if (source !== undefined && source.priority > current.priority) {
        current.priority = source.priority;
      }
      inherited.set(proposalId, current);
    }
  }
  return Object.freeze([...inherited.entries()].map(([proposalId, item]) => Object.freeze({
    proposalId,
    issueIds: Object.freeze([...item.issueIds].sort()),
    priority: item.priority,
  })).sort((left, right) => left.proposalId.localeCompare(right.proposalId)));
}

export function parsePremiseRouteExpansionTickInterval(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number | null {
  const raw = environment.PMH_PREMISE_ROUTE_EXPANSION_TICK_MS?.trim() ?? "";
  if (raw === "") return null;
  const parsed = Number(raw);
  if (parsed === 0) return null;
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 60_000) {
    throw new Error(
      "PMH_PREMISE_ROUTE_EXPANSION_TICK_MS must be 0 or an integer from 1000 to 60000",
    );
  }
  return parsed;
}
