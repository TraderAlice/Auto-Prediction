import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertCatalogContextCoverage,
  CatalogContextCoverageError,
  type CatalogContextCoverage,
  type CatalogContextSelection,
} from "./catalog-observation.js";
import {
  calculateTwoListingIndicativeEconomics,
  type CanonicalIndicativeEconomics,
} from "./indicative-relation-economics.js";
import { buildExactDiscoveryCatalogContext } from "./catalog-discovery.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import type {
  DiscoveryCatalogContext,
  DiscoveryRunRecord,
  DiscoveryTask,
  OperationalStorageProjection,
  OpportunityHypothesis,
} from "./types.js";
import type { MarketRelationKind } from "./market-archaeologist.js";
import {
  COMPILABLE_RELATIONS,
  type CompilableRelation,
} from "./relation-payoff.js";
import type { SemanticGraphSearchContext } from "./semantic-relation-graph.js";
import {
  buildSearchScopeIdentity,
  type SearchScopeIdentity,
} from "./search-scope-identity.js";
import type { SearchQuoteEnrichmentResult } from "./search-quote-enrichment.js";
import {
  MODEL_FAILURE_CATEGORIES,
  type ModelFailureCategory,
} from "./model-failure.js";
import {
  assertSemanticFamilyRetrievalPlan,
  semanticFamilyRetrievalBrief,
  type SemanticFamilyRetrievalPlan,
} from "./semantic-family-retrieval.js";
import {
  isSearchSemanticFamily,
  type SearchSemanticFamily,
} from "./search-semantic-family.js";
import type { SearchDiscoveryMode } from "./search-issue-scheduler.js";

const SEARCH_LEASE_ALGORITHM_VERSIONS = Object.freeze([
  "pmh.ai-search-leases.v1",
  "pmh.ai-search-leases.v2",
  "pmh.ai-search-leases.v3",
  "pmh.ai-search-leases.v4",
  "pmh.ai-search-leases.v5",
  "pmh.ai-search-leases.v6",
  "pmh.ai-search-leases.v7",
] as const);
const ALGORITHM_VERSION = "pmh.ai-search-leases.v7" as const;
const DEFAULT_RETENTION_LIMIT = 40;
const DEFAULT_FAST_DEADLINE_MS = 300_000;
const DEFAULT_DEEP_DEADLINE_MS = 300_000;
const DEFAULT_ORCHESTRATION_GRACE_MS = 5_000;
const DEFAULT_MAX_DEEP_ATTEMPTS = 3;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/u;
const READ_ONLY_TOOLS = Object.freeze(["read", "grep", "find", "ls"] as const);

function hasStagedLaneContractVersion(version: SearchLeaseAlgorithmVersion): boolean {
  return version === "pmh.ai-search-leases.v5" ||
    version === "pmh.ai-search-leases.v6" ||
    version === "pmh.ai-search-leases.v7";
}

export const SEARCH_LENSES = Object.freeze([
  "EQUIVALENCE",
  "IMPLICATION",
  "PARTITION",
  "MECHANISM",
] as const);

export type SearchLens = (typeof SEARCH_LENSES)[number];
export type SearchLeaseAlgorithmVersion =
  (typeof SEARCH_LEASE_ALGORITHM_VERSIONS)[number];

export type SearchCandidatePolicy = Readonly<{
  allowedRelationKinds: readonly MarketRelationKind[];
  exactListingRefCount?: number;
  minimumListingRefCount?: number;
  maximumListingRefCount?: number;
  maxCorpusListings?: number;
  requirePositiveGrossHint?: boolean;
  candidateSelection?: "EXACT_CONTEXT" | "MODEL_HYPOTHESIS";
  requireDistinctVenues?: boolean;
}>;

function candidatePolicyListingBounds(
  policy: SearchCandidatePolicy,
): Readonly<{ minimum: number; maximum: number }> {
  if (policy.exactListingRefCount !== undefined) {
    return Object.freeze({
      minimum: policy.exactListingRefCount,
      maximum: policy.exactListingRefCount,
    });
  }
  return Object.freeze({
    minimum: policy.minimumListingRefCount ?? 2,
    maximum: policy.maximumListingRefCount ?? 4,
  });
}

function candidatePolicyListingCountMatches(
  policy: SearchCandidatePolicy,
  count: number,
): boolean {
  const bounds = candidatePolicyListingBounds(policy);
  return count >= bounds.minimum && count <= bounds.maximum;
}

export function isSearchCandidatePolicy(value: unknown): value is SearchCandidatePolicy {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const policy = value as SearchCandidatePolicy;
  const exact = policy.exactListingRefCount;
  const minimum = policy.minimumListingRefCount;
  const maximum = policy.maximumListingRefCount;
  const rangeValid = exact === undefined
    ? Number.isSafeInteger(minimum) && Number.isSafeInteger(maximum) &&
      minimum! >= 2 && maximum! <= 4 && minimum! <= maximum!
    : Number.isSafeInteger(exact) && exact >= 2 && exact <= 8 &&
      minimum === undefined && maximum === undefined;
  return (
    Array.isArray(policy.allowedRelationKinds) &&
    policy.allowedRelationKinds.length > 0 &&
    policy.allowedRelationKinds.length <= 8 &&
    new Set(policy.allowedRelationKinds).size === policy.allowedRelationKinds.length &&
    policy.allowedRelationKinds.every((kind) => [
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "RELATED", "CONFLICTING",
    ].includes(kind)) &&
    rangeValid &&
    (policy.maxCorpusListings === undefined || (
      Number.isSafeInteger(policy.maxCorpusListings) &&
      policy.maxCorpusListings >= candidatePolicyListingBounds(policy).maximum &&
      policy.maxCorpusListings <= 30
    )) &&
    (policy.requirePositiveGrossHint === undefined ||
      typeof policy.requirePositiveGrossHint === "boolean") &&
    (policy.candidateSelection === undefined ||
      policy.candidateSelection === "EXACT_CONTEXT" ||
      policy.candidateSelection === "MODEL_HYPOTHESIS") &&
    (policy.requireDistinctVenues === undefined ||
      typeof policy.requireDistinctVenues === "boolean") &&
    (policy.requirePositiveGrossHint !== true || (
      exact === 2 &&
      policy.allowedRelationKinds.length === 1 &&
      COMPILABLE_RELATIONS.includes(
        policy.allowedRelationKinds[0] as CompilableRelation,
      )
    ))
  );
}

export type SearchLeaseEconomicGate = Readonly<{
  required: boolean;
  status:
    | "NOT_RUN"
    | "NOT_REQUIRED"
    | "POSITIVE_GROSS_HINT"
    | "NON_POSITIVE_GROSS_HINT"
    | "PRICE_UNAVAILABLE"
    | "LISTING_SCOPE_UNSUPPORTED"
    | "RELATION_UNSUPPORTED";
  listingRefs: readonly string[];
  portfolioLabel: string | null;
  indicativeCostBpsCeil: string | null;
  grossEdgeBpsFloor: string | null;
  diagnostic: string | null;
  quoteEnrichment?: Readonly<{
    status:
      | "NOT_RUN"
      | "NOT_REQUIRED"
      | SearchQuoteEnrichmentResult["status"];
    attemptedOutcomeCount: number;
    enrichedOutcomeCount: number;
    observationIds: readonly Hash[];
    diagnostic: string | null;
    source: "CATALOG_ONLY" | "CATALOG_PLUS_ANONYMOUS_PUBLIC_BOOKS";
    authority: "SEARCH_PRICE_EVIDENCE_ONLY";
    semanticDecisionAuthority: false;
    simulationAuthority: false;
    certificateAuthority: false;
    executionAuthority: false;
  }>;
  feesIncluded: false;
  depthIncluded: false;
  executable: false;
  authority: "SEARCH_ESCALATION_HINT_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type SearchLease = Readonly<{
  schemaVersion: "pmh.search-lease.v1";
  leaseId: Hash;
  algorithmVersion: SearchLeaseAlgorithmVersion;
  snapshotIdentity: Hash;
  sourceSetIdentity: Hash;
  issueId?: Hash | null;
  discoveryMode?: SearchDiscoveryMode | null;
  semanticFamily?: SearchSemanticFamily | null;
  candidatePolicy?: SearchCandidatePolicy | null;
  lens: SearchLens;
  thesis: string;
  noveltyTargets: readonly string[];
  scope: Readonly<{
    venueIds: readonly string[];
    closesAtMin: string | null;
    closesAtMax: string | null;
  }>;
  budget: Readonly<{
    maxFastModelRequests: number;
    maxPiInvocations: 0 | 1;
    maxHypotheses: number;
    deadlineMs: number;
    fastDeadlineMs?: number;
    deepDeadlineMs?: number;
    orchestrationGraceMs?: number;
    maxDeepAttempts?: number;
  }>;
  issuedAt: string;
  deadlineAt: string;
  graphContext?: SemanticGraphSearchContext | null;
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

export type SearchLeaseFastLane = Readonly<{
  status: "NOT_RUN" | "PASS" | "FAILED";
  taskId: string;
  runId: string | null;
  workerIds: readonly string[];
  modelRequestCount: number;
  providerTelemetry?: SearchLeaseProviderTelemetry;
  agentTelemetry?: SearchLeaseAgentTelemetry;
  corpusCoverage?: CatalogContextCoverage;
  retrievalPlan?: SemanticFamilyRetrievalPlan;
  hypothesisIds: readonly string[];
  falsificationIds?: readonly Hash[];
  falsificationFindingIdentities?: readonly Hash[];
  candidateListingRefs: readonly string[];
  semanticScope?: SearchScopeIdentity;
  economicGate?: SearchLeaseEconomicGate;
  diagnostic: string | null;
  completedAt?: string | null;
}>;

export type ProviderFailureCategory = ModelFailureCategory | "UNTYPED";

export type SearchLeaseProviderTelemetry = Readonly<{
  schemaVersion: "pmh.provider-attempt-telemetry.v1";
  requestAttemptCount: number;
  failureCategories: readonly ProviderFailureCategory[];
}>;

export type SearchLeaseProviderTelemetryProjection =
  SearchLeaseProviderTelemetry & Readonly<{
    evidenceSource: "NATIVE_WORKER_REPORTS" | "LEGACY_DERIVED";
  }>;

export type SearchLeaseAgentTelemetry = Readonly<{
  schemaVersion: "pmh.discovery-agent-telemetry.v1";
  agentRunCount: number;
  stepCount: number;
  toolCallCount: number;
  catalogReadCount: number;
  acceptedProposalEffectCount: number;
  rejectedProposalEffectCount: number;
  acceptedFalsificationEffectCount?: number;
  rejectedFalsificationEffectCount?: number;
  terminationReasons: readonly Readonly<{
    reason: import("./types.js").DiscoveryAgentTerminationReason;
    count: number;
  }>[];
}>;

export type SearchLeaseDeepAttempt = Readonly<{
  attemptId: Hash;
  attemptNumber: number;
  inputIdentity: Hash;
  status: "RUNNING" | "PASS" | "FAILED";
  startedAt: string;
  deadlineAt: string;
  completedAt: string | null;
  runId: string | null;
  proposalIds: readonly string[];
  evidenceGaps: readonly string[];
  diagnostic: string | null;
}>;

export type SearchLeaseDeepLane = Readonly<{
  status: "NOT_RUN" | "PENDING" | "RUNNING" | "PASS" | "FAILED";
  reason:
    | "PENDING_FAST_LANE"
    | "PENDING_DEEP_LANE"
    | "NO_CANDIDATES"
    | "NOT_MULTI_LISTING"
    | "DUPLICATE"
    | "ECONOMIC_GATE_BLOCKED"
    | "PI_DISABLED"
    | "NO_POLICY_MATCH"
    | "NOVEL_MULTI_LISTING"
    | "NOVEL_MULTI_VENUE";
  runId: string | null;
  proposalIds: readonly string[];
  evidenceGaps: readonly string[];
  diagnostic: string | null;
  inputIdentity?: Hash | null;
  attempts?: readonly SearchLeaseDeepAttempt[];
  completedAt?: string | null;
  permittedTools: readonly ["read", "grep", "find", "ls"];
  toolExecutionTraceStored: false;
}>;

export type SearchLeaseRecord = Readonly<{
  schemaVersion: "pmh.search-lease-record.v1";
  lease: SearchLease;
  trigger: "OPERATOR" | "SCHEDULE";
  status: "ISSUED" | "PASS" | "FAILED";
  completedAt: string | null;
  diagnostic: string | null;
  fastLane: SearchLeaseFastLane;
  deepLane: SearchLeaseDeepLane;
  lineage: Readonly<{
    predecessorLeaseId: Hash | null;
    duplicateOfLeaseId: Hash | null;
    noveltySignature: Hash | null;
  }>;
  outcome: Readonly<{
    novelCandidate: boolean;
    hypothesisCount: number;
    falsificationCount?: number;
    proposalCount: number;
    evidenceGapCount: number;
    stage?:
      | "FAST_PENDING"
      | "FAST_FAILED"
      | "RECOVERY_EXPIRED"
      | "FAST_COMPLETE"
      | "DEEP_COMPLETE"
      | "DEEP_UNAVAILABLE";
  }>;
  trace: Readonly<{
    querySummary: string;
    chainOfThoughtStored: false;
  }>;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: Hash;
}>;

export interface SearchLeaseRecordStore {
  readonly searchLeaseStorage: OperationalStorageProjection<"leaseId">;
  readonly searchLeaseCorpusStorage: OperationalStorageProjection<"snapshotIdentity">;
  loadSearchLeaseRecords(limit: number): readonly SearchLeaseRecord[];
  saveSearchLeaseRecord(
    record: SearchLeaseRecord,
    retentionLimit: number,
  ): SearchLeaseRecord;
  saveSearchLeaseCorpus(snapshot: MarketCorpusSnapshot): MarketCorpusSnapshot;
  loadSearchLeaseCorpus(snapshotIdentity: Hash): MarketCorpusSnapshot | null;
  hasSearchLeaseCorpus(snapshotIdentity: Hash): boolean;
  countSearchLeaseCorpora(): number;
}

export type SearchLeaseDeepResult = Readonly<{
  runId: string;
  status: "PASS" | "FAILED";
  proposalIds: readonly string[];
  proposalDetails?: readonly Readonly<{
    proposalId: string;
    relationKind: MarketRelationKind;
    listingRefs: readonly string[];
  }>[];
  evidenceGaps: readonly string[];
  diagnostic: string | null;
}>;

export type SearchLeaseSchedulerProjection = Readonly<{
  schemaVersion: "pmh.search-lease-scheduler.v1";
  algorithmVersion: typeof ALGORITHM_VERSION;
  enabled: boolean;
  configured: Readonly<{ fastLane: boolean; deepLane: boolean }>;
  status: "IDLE" | "RUNNING";
  activeCount: number;
  activeFastCount: number;
  activeDeepCount: number;
  queuedDeepCount: number;
  concurrencyLimit: number;
  deepConcurrencyLimit: number;
  intervalMs: number | null;
  retentionLimit: number;
  lensOrder: readonly SearchLens[];
  budget: SearchLease["budget"];
  runCount: number;
  passCount: number;
  failedCount: number;
  issuedCount: number;
  duplicateCount: number;
  piEscalationCount: number;
  deepPendingCount: number;
  deepPassCount: number;
  deepFailedCount: number;
  deepRetryCount: number;
  preservedFastResultCount: number;
  expiredRecoveryCount: number;
  retainedCorpusCount: number;
  recoverableIssuedCount: number;
  missingCorpusIssuedCount: number;
  storage: OperationalStorageProjection<"leaseId">;
  corpusStorage: OperationalStorageProjection<"snapshotIdentity">;
  records: readonly SearchLeaseRecord[];
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: SearchLease["effects"];
}>;

export type SearchLeaseContextFeedback = Readonly<{
  issueId: Hash | null;
  completedSemanticScopeIdentities: readonly Hash[];
  attemptedRoutingScopeIdentities: readonly Hash[];
  authority: "SEARCH_ROUTING_ONLY";
}>;

export type SearchLeaseContextSelection = CatalogContextSelection & Readonly<{
  retrievalPlan?: SemanticFamilyRetrievalPlan;
}>;

type SearchLeaseOptions = Readonly<{
  intervalMs?: number | null;
  maxFastModelRequests?: number;
  maxPiInvocations?: 0 | 1;
  maxHypotheses?: number;
  deadlineMs?: number;
  fastDeadlineMs?: number;
  deepDeadlineMs?: number;
  orchestrationGraceMs?: number;
  maxDeepAttempts?: number;
  retentionLimit?: number;
  concurrencyLimit?: number;
  deepConcurrencyLimit?: number;
  registeredVenueIds?: readonly string[];
  store?: SearchLeaseRecordStore;
  context: (
    question: string,
    venueIds: readonly string[],
    lens: SearchLens,
    snapshot: MarketCorpusSnapshot,
    feedback: SearchLeaseContextFeedback,
    candidatePolicy: SearchCandidatePolicy | null,
    semanticFamily: SearchSemanticFamily | null,
    discoveryMode: SearchDiscoveryMode | null,
  ) => DiscoveryCatalogContext | SearchLeaseContextSelection;
  graphContext?: (
    snapshot: MarketCorpusSnapshot,
    lens: SearchLens,
  ) => SemanticGraphSearchContext;
  runFast: (
    task: DiscoveryTask,
    maxModelRequests: number,
  ) => Promise<DiscoveryRunRecord>;
  runDeep?: (
    snapshot: MarketCorpusSnapshot,
    question: string,
  ) => Promise<SearchLeaseDeepResult>;
  enrichPrices?: (
    listings: DiscoveryCatalogContext["listings"],
  ) => Promise<SearchQuoteEnrichmentResult>;
  now?: () => number;
  onRecordChange?: (record: SearchLeaseRecord) => void;
}>;

export type SearchLeaseIssueInput = Readonly<{
  issueId: Hash;
  question: string;
  venueIds: readonly string[];
  discoveryMode?: SearchDiscoveryMode;
  semanticFamily?: SearchSemanticFamily | null;
  candidatePolicy?: SearchCandidatePolicy | null;
}>;

const LENS_SPEC: Readonly<Record<SearchLens, Readonly<{
  thesis: string;
  noveltyTargets: readonly string[];
  question: string;
}>>> = Object.freeze({
  EQUIVALENCE: Object.freeze({
    thesis: "Find differently worded listings that may resolve to the same claim.",
    noveltyTargets: Object.freeze(["cross-venue aliases", "rule-text mismatch", "resolution-source mismatch"]),
    question: "Find cross-venue listings that may encode the same real-world claim despite different wording. Ground every hypothesis in listing refs. Treat title similarity as search evidence only and surface rule, date, oracle, or void-policy mismatches.",
  }),
  IMPLICATION: Object.freeze({
    thesis: "Find claims where one outcome logically implies or is a subset of another.",
    noveltyTargets: Object.freeze(["subset", "one-way implication", "nested time window"]),
    question: "Find grounded cross-venue implication or subset structures, including nested thresholds and time windows. Do not assume converse implication. Return exact listing refs and identify the facts that could falsify the relationship.",
  }),
  PARTITION: Object.freeze({
    thesis: "Find outcomes that may form mutually exclusive or exhaustive payoff partitions.",
    noveltyTargets: Object.freeze(["mutual exclusion", "exhaustive range", "complete set"]),
    question: "Find grounded groups of listings that may be mutually exclusive or exhaustive partitions of one event. Check boundary gaps, overlaps, cancellation, and catch-all outcomes. Return exact listing refs; do not claim completeness from labels alone.",
  }),
  MECHANISM: Object.freeze({
    thesis: "Find apparent semantic matches whose market mechanisms create divergent payoffs.",
    noveltyTargets: Object.freeze(["oracle divergence", "void divergence", "timing divergence", "mechanism divergence"]),
    question: "Find cross-venue listings that look related but may diverge because of oracle, close time, settlement, void, denomination, or mechanism rules. Ground hypotheses in exact listing refs and state the missing rule evidence.",
  }),
});

function compactDiagnostic(value: unknown): string {
  const text = (value instanceof Error ? value.message : String(value))
    .trim()
    .replace(/\s+/gu, " ") || "search lease failed";
  return text.length <= 500 ? text : `${text.slice(0, 499).trimEnd()}…`;
}

function pendingEconomicGate(policy?: SearchCandidatePolicy | null): SearchLeaseEconomicGate {
  return Object.freeze({
    required: policy?.requirePositiveGrossHint === true,
    status: "NOT_RUN" as const,
    listingRefs: Object.freeze([]),
    portfolioLabel: null,
    indicativeCostBpsCeil: null,
    grossEdgeBpsFloor: null,
    diagnostic: null,
    feesIncluded: false as const,
    depthIncluded: false as const,
    executable: false as const,
    authority: "SEARCH_ESCALATION_HINT_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
}

function completedEconomicGate(input: Readonly<{
  policy: SearchCandidatePolicy | null | undefined;
  listingRefs: readonly string[];
  context: DiscoveryCatalogContext;
  currentListings?: DiscoveryCatalogContext["listings"];
  enrichment?: SearchQuoteEnrichmentResult;
}>): SearchLeaseEconomicGate {
  const base = pendingEconomicGate(input.policy);
  const listingRefs = Object.freeze([...new Set(input.listingRefs)].sort());
  if (!base.required) {
    return Object.freeze({ ...base, status: "NOT_REQUIRED", listingRefs });
  }
  if (listingRefs.length !== 2) {
    return Object.freeze({
      ...base,
      status: "LISTING_SCOPE_UNSUPPORTED",
      listingRefs,
      diagnostic: "The positive-gross gate requires exactly two distinct fast-lane listing references.",
    });
  }
  const relation = input.policy?.allowedRelationKinds[0];
  if (
    relation === undefined ||
    !COMPILABLE_RELATIONS.includes(relation as CompilableRelation)
  ) {
    return Object.freeze({
      ...base,
      status: "RELATION_UNSUPPORTED",
      listingRefs,
      diagnostic: "The positive-gross gate requires one canonical compilable relation.",
    });
  }
  const economics: CanonicalIndicativeEconomics =
    calculateTwoListingIndicativeEconomics({
      listingRefs,
      relation: relation as CompilableRelation,
      currentListings: new Map(
        (input.currentListings ?? input.context.listings).map((listing) =>
          [listing.listingRef, listing] as const
        ),
      ),
    });
  const enrichment = input.enrichment;
  const quoteEnrichment = Object.freeze({
    status: enrichment?.status ?? (
      economics.status === "PRICE_UNAVAILABLE" ? "NOT_RUN" : "NOT_REQUIRED"
    ),
    attemptedOutcomeCount: enrichment?.attemptedOutcomeCount ?? 0,
    enrichedOutcomeCount: enrichment?.enrichedOutcomeCount ?? 0,
    observationIds: Object.freeze([...(enrichment?.observationIds ?? [])]),
    diagnostic: enrichment === undefined || enrichment.diagnostics.length === 0
      ? null
      : compactDiagnostic(enrichment.diagnostics.join("; ")),
    source: enrichment === undefined
      ? "CATALOG_ONLY" as const
      : "CATALOG_PLUS_ANONYMOUS_PUBLIC_BOOKS" as const,
    authority: "SEARCH_PRICE_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({
    ...base,
    status: economics.status,
    listingRefs,
    portfolioLabel: economics.portfolioLabel,
    indicativeCostBpsCeil: economics.indicativeCostBpsCeil,
    grossEdgeBpsFloor: economics.grossEdgeBpsFloor,
    diagnostic: economics.status === "POSITIVE_GROSS_HINT"
      ? enrichment === undefined
        ? "Current catalog indications leave a positive gross search hint before fees and depth."
        : "Catalog prices plus retained anonymous public best asks leave a positive gross search hint before fees and common depth."
      : economics.status === "NON_POSITIVE_GROSS_HINT"
        ? enrichment === undefined
          ? "Current catalog indications leave no positive gross search hint before fees and depth."
          : "Catalog prices plus retained anonymous public best asks leave no positive gross search hint before fees and common depth."
        : enrichment === undefined
          ? "Canonical current catalog prices are unavailable or malformed."
          : quoteEnrichment.diagnostic ??
            "Anonymous public quote enrichment did not produce a complete canonical price pair.",
    quoteEnrichment,
  });
}

function economicGateValid(
  gate: SearchLeaseEconomicGate | undefined,
  policy: SearchCandidatePolicy | null | undefined,
): boolean {
  if (gate === undefined) return true;
  const enrichment = gate.quoteEnrichment;
  const enrichmentValid = enrichment === undefined || (
    [
      "NOT_RUN", "NOT_REQUIRED", "READY", "PARTIAL", "UNSUPPORTED", "FAILED",
    ].includes(enrichment.status) &&
    Number.isSafeInteger(enrichment.attemptedOutcomeCount) &&
    enrichment.attemptedOutcomeCount >= 0 && enrichment.attemptedOutcomeCount <= 4 &&
    Number.isSafeInteger(enrichment.enrichedOutcomeCount) &&
    enrichment.enrichedOutcomeCount >= 0 &&
    enrichment.enrichedOutcomeCount <= enrichment.attemptedOutcomeCount &&
    Array.isArray(enrichment.observationIds) &&
    enrichment.observationIds.length === enrichment.enrichedOutcomeCount &&
    new Set(enrichment.observationIds).size === enrichment.observationIds.length &&
    enrichment.observationIds.every((item) => HASH_PATTERN.test(String(item))) &&
    (enrichment.diagnostic === null ||
      (typeof enrichment.diagnostic === "string" && enrichment.diagnostic.length <= 500)) &&
    (enrichment.source === "CATALOG_ONLY" ||
      enrichment.source === "CATALOG_PLUS_ANONYMOUS_PUBLIC_BOOKS") &&
    enrichment.authority === "SEARCH_PRICE_EVIDENCE_ONLY" &&
    enrichment.semanticDecisionAuthority === false &&
    enrichment.simulationAuthority === false &&
    enrichment.certificateAuthority === false &&
    enrichment.executionAuthority === false &&
    (enrichment.status === "NOT_RUN" || enrichment.status === "NOT_REQUIRED"
      ? enrichment.attemptedOutcomeCount === 0 &&
        enrichment.enrichedOutcomeCount === 0 &&
        enrichment.observationIds.length === 0 &&
        enrichment.source === "CATALOG_ONLY"
      : enrichment.source === "CATALOG_PLUS_ANONYMOUS_PUBLIC_BOOKS")
  );
  return (
    enrichmentValid &&
    gate.required === (policy?.requirePositiveGrossHint === true) &&
    [
      "NOT_RUN", "NOT_REQUIRED", "POSITIVE_GROSS_HINT",
      "NON_POSITIVE_GROSS_HINT", "PRICE_UNAVAILABLE",
      "LISTING_SCOPE_UNSUPPORTED", "RELATION_UNSUPPORTED",
    ].includes(gate.status) &&
    Array.isArray(gate.listingRefs) && gate.listingRefs.length <= 20 &&
    new Set(gate.listingRefs).size === gate.listingRefs.length &&
    gate.listingRefs.every((item) => typeof item === "string" && item.trim() !== "") &&
    [gate.indicativeCostBpsCeil, gate.grossEdgeBpsFloor].every(
      (item) => item === null ||
        (typeof item === "string" && INTEGER_PATTERN.test(item)),
    ) &&
    (gate.portfolioLabel === null ||
      (typeof gate.portfolioLabel === "string" && gate.portfolioLabel.length <= 200)) &&
    (gate.diagnostic === null ||
      (typeof gate.diagnostic === "string" && gate.diagnostic.length <= 500)) &&
    gate.feesIncluded === false && gate.depthIncluded === false &&
    gate.executable === false &&
    gate.authority === "SEARCH_ESCALATION_HINT_ONLY" &&
    gate.semanticDecisionAuthority === false &&
    gate.simulationAuthority === false && gate.certificateAuthority === false &&
    gate.executionAuthority === false &&
    (gate.status !== "POSITIVE_GROSS_HINT" ||
      (gate.grossEdgeBpsFloor !== null && BigInt(gate.grossEdgeBpsFloor) > 0n)) &&
    (gate.status !== "NON_POSITIVE_GROSS_HINT" ||
      (gate.grossEdgeBpsFloor !== null && BigInt(gate.grossEdgeBpsFloor) <= 0n))
  );
}

function semanticScopeValid(scope: SearchScopeIdentity | undefined): boolean {
  if (scope === undefined) return true;
  return (
    HASH_PATTERN.test(scope.semanticScopeIdentity) &&
    HASH_PATTERN.test(scope.routingScopeIdentity) &&
    Array.isArray(scope.listingRefs) &&
    scope.listingRefs.length > 0 &&
    scope.listingRefs.length <= 30 &&
    new Set(scope.listingRefs).size === scope.listingRefs.length &&
    scope.listingRefs.every((item) =>
      typeof item === "string" && item.trim() !== ""
    ) &&
    scope.kind === (scope.listingRefs.length === 2
      ? "EXACT_PAIR"
      : "BOUNDED_CONTEXT") &&
    scope.priceIndependentSemanticIdentity === true &&
    scope.authority === "SEARCH_ROUTING_ONLY"
  );
}

function corpusCoverageValid(
  coverage: CatalogContextCoverage | undefined,
  requestedVenueIds: readonly string[],
  fastLaneStatus: SearchLeaseFastLane["status"],
  algorithmVersion: SearchLeaseAlgorithmVersion,
): boolean {
  if (coverage === undefined) return true;
  try {
    const validated = assertCatalogContextCoverage(
      coverage,
      requestedVenueIds,
    );
    return fastLaneStatus !== "PASS" || (
      validated.eligibleVenueIds.length >= validated.minimumEligibleVenueCount &&
      validated.contextVenueIds.length >= (
        algorithmVersion === "pmh.ai-search-leases.v3"
          ? validated.minimumEligibleVenueCount
          : 1
      )
    );
  } catch {
    return false;
  }
}

function isIso(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function withArtifactHash(
  body: Omit<SearchLeaseRecord, "artifactHash">,
): SearchLeaseRecord {
  return deepFreeze({ ...body, artifactHash: hashCanonical(body) });
}

function withoutArtifactHash(
  record: SearchLeaseRecord,
): Omit<SearchLeaseRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function inferLegacyFailureCategory(
  diagnostic: string | null,
): ProviderFailureCategory | null {
  const value = diagnostic?.toLowerCase() ?? "";
  if (value === "") return null;
  if (value.includes("timed out") || value.includes("timeout")) return "TIMEOUT";
  if (
    value.includes("model hypothesis") || value.includes("out-of-scope") ||
    value.includes("structured output") || value.includes("model output")
  ) return "INVALID_MODEL_OUTPUT";
  if (
    value.includes("deepseek") || value.includes("openai") ||
    value.includes("model request") || value.includes("model worker")
  ) return "UNTYPED";
  return null;
}

export function providerTelemetryFor(
  record: SearchLeaseRecord,
): SearchLeaseProviderTelemetryProjection {
  const telemetry = record.fastLane.providerTelemetry;
  if (telemetry !== undefined) {
    return Object.freeze({
      ...telemetry,
      evidenceSource: "NATIVE_WORKER_REPORTS",
    });
  }
  const failure = record.fastLane.status === "PASS"
    ? inferLegacyFailureCategory(record.fastLane.diagnostic)
    : null;
  return Object.freeze({
    schemaVersion: "pmh.provider-attempt-telemetry.v1",
    requestAttemptCount: record.fastLane.modelRequestCount,
    failureCategories: Object.freeze(failure === null ? [] : [failure]),
    evidenceSource: "LEGACY_DERIVED",
  });
}

export function assertSearchLeaseRecord(value: unknown): SearchLeaseRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored search lease record is malformed");
  }
  const record = value as SearchLeaseRecord;
  const { artifactHash, ...body } = record;
  const lease = record.lease;
  const expectedLeaseId = lease === undefined ? "" : hashCanonical(
    lease.issueId === undefined || lease.issueId === null
      ? {
          schemaVersion: "pmh.search-lease-id.v1",
          algorithmVersion: lease.algorithmVersion,
          snapshotIdentity: lease.snapshotIdentity,
          lens: lease.lens,
        }
      : {
          schemaVersion: "pmh.search-lease-id.v2",
          algorithmVersion: lease.algorithmVersion,
          snapshotIdentity: lease.snapshotIdentity,
          lens: lease.lens,
          issueId: lease.issueId,
        },
  );
  const validHashOrNull = (item: unknown) =>
    item === null || HASH_PATTERN.test(String(item));
  const nonEmptyStrings = (items: unknown, limit: number) =>
    Array.isArray(items) && items.length <= limit &&
    items.every((item) => typeof item === "string" && item.trim() !== "");
  const graphContext = lease?.graphContext;
  const graphItemsValid = graphContext === undefined || graphContext === null ||
    graphContext.items.every((item) =>
      (item.proposalId === null || HASH_PATTERN.test(String(item.proposalId))) &&
      (item.relationKind === null || [
        "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE",
        "EXHAUSTIVE", "CONDITIONAL", "RELATED", "CONFLICTING",
      ].includes(item.relationKind)) &&
      nonEmptyStrings(item.listingRefs, 20) &&
      new Set(item.listingRefs).size === item.listingRefs.length &&
      Array.isArray(item.outcomeCodes) && item.outcomeCodes.length <= 9 &&
      item.outcomeCodes.every((code) => [
        "DUPLICATE", "AGENT_FALSIFIED", "SEMANTIC_REJECTED", "MISSING_RULE", "NO_DEPTH",
        "FEE_OR_MODEL_BLOCK", "EXACT_REJECTED", "CERTIFIED",
        "SHADOW_DIVERGENCE", "SHADOW_MATCHED",
      ].includes(code)) &&
      item.summary.trim() !== "" && item.summary.length <= 300
    );
  const graphContextValid = graphContext === undefined || graphContext === null || (
    graphContext.schemaVersion === "pmh.semantic-graph-search-context.v1" &&
    HASH_PATTERN.test(String(graphContext.graphIdentity)) &&
    HASH_PATTERN.test(String(graphContext.neighborhoodIdentity)) &&
    graphContext.lens === lease.lens &&
    Number.isSafeInteger(graphContext.relationCount) && graphContext.relationCount >= 0 &&
    Number.isSafeInteger(graphContext.feedbackCount) && graphContext.feedbackCount >= 0 &&
    Array.isArray(graphContext.items) && graphContext.items.length <= 12 &&
    graphItemsValid &&
    graphContext.neighborhoodIdentity === hashCanonical({
      graphIdentity: graphContext.graphIdentity,
      lens: graphContext.lens,
      items: graphContext.items,
    }) &&
    graphContext.searchBrief.trim() !== "" && graphContext.searchBrief.length <= 300 &&
    graphContext.priorityBasis === "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS" &&
    graphContext.modelConfidenceUsed === false &&
    graphContext.authority === "SEARCH_EVIDENCE_ONLY" &&
    graphContext.semanticDecisionAuthority === false &&
    graphContext.executionAuthority === false
  );
  const candidatePolicy = lease.candidatePolicy;
  const providerTelemetry = record.fastLane?.providerTelemetry;
  const providerTelemetryValid = providerTelemetry === undefined || (
    providerTelemetry.schemaVersion === "pmh.provider-attempt-telemetry.v1" &&
    Number.isSafeInteger(providerTelemetry.requestAttemptCount) &&
    providerTelemetry.requestAttemptCount >= 0 &&
    providerTelemetry.requestAttemptCount <= 80 &&
    Array.isArray(providerTelemetry.failureCategories) &&
    providerTelemetry.failureCategories.length <= 4 &&
    providerTelemetry.failureCategories.every((category) =>
      category === "UNTYPED" ||
      MODEL_FAILURE_CATEGORIES.includes(category as ModelFailureCategory)
    )
  );
  const agentTelemetry = record.fastLane?.agentTelemetry;
  const agentTelemetryValid = agentTelemetry === undefined || (
    agentTelemetry.schemaVersion === "pmh.discovery-agent-telemetry.v1" &&
    Number.isSafeInteger(agentTelemetry.agentRunCount) &&
    agentTelemetry.agentRunCount >= 0 && agentTelemetry.agentRunCount <= 4 &&
    Number.isSafeInteger(agentTelemetry.stepCount) &&
    agentTelemetry.stepCount >= 0 && agentTelemetry.stepCount <= 80 &&
    Number.isSafeInteger(agentTelemetry.toolCallCount) &&
    agentTelemetry.toolCallCount >= 0 && agentTelemetry.toolCallCount <= 256 &&
    Number.isSafeInteger(agentTelemetry.catalogReadCount) &&
    agentTelemetry.catalogReadCount >= 0 &&
    agentTelemetry.catalogReadCount <= agentTelemetry.toolCallCount &&
    Number.isSafeInteger(agentTelemetry.acceptedProposalEffectCount) &&
    agentTelemetry.acceptedProposalEffectCount >= 0 &&
    agentTelemetry.acceptedProposalEffectCount <= 80 &&
    Number.isSafeInteger(agentTelemetry.rejectedProposalEffectCount) &&
    agentTelemetry.rejectedProposalEffectCount >= 0 &&
    agentTelemetry.rejectedProposalEffectCount <= 256 &&
    (agentTelemetry.acceptedFalsificationEffectCount === undefined ||
      (Number.isSafeInteger(agentTelemetry.acceptedFalsificationEffectCount) &&
        agentTelemetry.acceptedFalsificationEffectCount >= 0 &&
        agentTelemetry.acceptedFalsificationEffectCount <= 80)) &&
    (agentTelemetry.rejectedFalsificationEffectCount === undefined ||
      (Number.isSafeInteger(agentTelemetry.rejectedFalsificationEffectCount) &&
        agentTelemetry.rejectedFalsificationEffectCount >= 0 &&
        agentTelemetry.rejectedFalsificationEffectCount <= 256)) &&
    Array.isArray(agentTelemetry.terminationReasons) &&
    agentTelemetry.terminationReasons.length <= 9 &&
    new Set(agentTelemetry.terminationReasons.map((item) => item.reason)).size ===
      agentTelemetry.terminationReasons.length &&
    agentTelemetry.terminationReasons.every((item) =>
      [
        "EXPLICIT_COMPLETION", "PROPOSAL_LIMIT", "STEP_LIMIT",
        "TOOL_CALL_LIMIT", "MODEL_FINISHED", "TIMEOUT", "TASK_DEADLINE",
        "PROVIDER_FAILURE", "PROTOCOL_FAILURE",
      ].includes(item.reason) && Number.isSafeInteger(item.count) &&
      item.count > 0 && item.count <= 4
    ) &&
    agentTelemetry.terminationReasons.reduce((sum, item) => sum + item.count, 0) ===
      agentTelemetry.agentRunCount
  );
  const candidatePolicyValid = candidatePolicy === undefined || candidatePolicy === null ||
    isSearchCandidatePolicy(candidatePolicy);
  const hasStagedLaneContract = lease?.algorithmVersion === "pmh.ai-search-leases.v5" ||
    lease?.algorithmVersion === "pmh.ai-search-leases.v6" ||
    lease?.algorithmVersion === "pmh.ai-search-leases.v7";
  const discoveryMode = lease?.discoveryMode;
  const discoveryModeValid = lease?.algorithmVersion === "pmh.ai-search-leases.v7"
    ? lease.issueId === undefined || lease.issueId === null
      ? discoveryMode === null
      : discoveryMode === "HEURISTIC_EXPLORATION" || discoveryMode === "CLAIM_MONITORING"
    : discoveryMode === undefined;
  const semanticFamily = lease?.semanticFamily;
  const semanticFamilyValid = semanticFamily === undefined || semanticFamily === null ||
    isSearchSemanticFamily(semanticFamily);
  const retrievalPlan = record.fastLane?.retrievalPlan;
  let retrievalPlanValid = retrievalPlan === undefined;
  if (retrievalPlan !== undefined) {
    try {
      const validated = assertSemanticFamilyRetrievalPlan(retrievalPlan);
      retrievalPlanValid = semanticFamily !== undefined && semanticFamily !== null &&
        validated.semanticFamily === semanticFamily &&
        validated.corpusIdentity === lease.snapshotIdentity &&
        (validated.algorithmVersion !== "pmh.semantic-family-retrieval.v3" ||
          validated.routingMode === (discoveryMode === "HEURISTIC_EXPLORATION"
            ? "HEURISTIC_FIRST"
            : "QUERY_FIRST"));
    } catch {
      retrievalPlanValid = false;
    }
  }
  const attempts: readonly SearchLeaseDeepAttempt[] =
    record.deepLane?.attempts ?? [];
  const deepInputIdentity = record.deepLane?.inputIdentity ?? null;
  const expectedDeepInputIdentity = lease === undefined ||
      record.lineage?.noveltySignature === null ||
      record.lineage?.noveltySignature === undefined
    ? null
    : hashCanonical({
        schemaVersion: "pmh.search-deep-input.v1",
        leaseId: lease.leaseId,
        snapshotIdentity: lease.snapshotIdentity,
        sourceSetIdentity: lease.sourceSetIdentity,
        question: record.trace?.querySummary,
        thesis: lease.thesis,
        listingRefs: [...(record.fastLane?.candidateListingRefs ?? [])].sort(),
        noveltySignature: record.lineage.noveltySignature,
        candidatePolicy: lease.candidatePolicy ?? null,
        graphNeighborhoodIdentity: lease.graphContext?.neighborhoodIdentity ?? null,
      });
  const deepAttemptsValid = Array.isArray(attempts) && attempts.length <= 5 &&
    attempts.every((attempt, index) =>
      HASH_PATTERN.test(String(attempt.attemptId)) &&
      attempt.attemptNumber === index + 1 &&
      attempt.inputIdentity === deepInputIdentity &&
      attempt.attemptId === hashCanonical({
        schemaVersion: "pmh.search-deep-attempt-id.v1",
        leaseId: lease?.leaseId,
        inputIdentity: attempt.inputIdentity,
        attemptNumber: attempt.attemptNumber,
      }) &&
      (attempt.status === "RUNNING" || attempt.status === "PASS" ||
        attempt.status === "FAILED") &&
      isIso(attempt.startedAt) && isIso(attempt.deadlineAt) &&
      Date.parse(attempt.deadlineAt) > Date.parse(attempt.startedAt) &&
      (!hasStagedLaneContract || Date.parse(attempt.deadlineAt) - Date.parse(attempt.startedAt) ===
        lease.budget.deepDeadlineMs) &&
      (attempt.completedAt === null ||
        (isIso(attempt.completedAt) &&
          Date.parse(attempt.completedAt) >= Date.parse(attempt.startedAt))) &&
      (attempt.status === "RUNNING" ? attempt.completedAt === null :
        attempt.completedAt !== null) &&
      (attempt.runId === null || HASH_PATTERN.test(String(attempt.runId))) &&
      nonEmptyStrings(attempt.proposalIds, 5) &&
      attempt.proposalIds.every((proposalId: string) => HASH_PATTERN.test(proposalId)) &&
      nonEmptyStrings(attempt.evidenceGaps, 20) &&
      (attempt.diagnostic === null ||
        (typeof attempt.diagnostic === "string" && attempt.diagnostic.length <= 500))
    ) && attempts.filter((attempt) => attempt.status === "RUNNING").length <= 1 &&
    (attempts.findIndex((attempt) => attempt.status === "RUNNING") < 0 ||
      attempts.at(-1)?.status === "RUNNING");
  const expectedStage = record.status === "ISSUED"
    ? "FAST_PENDING"
    : record.status === "FAILED"
      ? record.outcome.stage === "RECOVERY_EXPIRED"
        ? "RECOVERY_EXPIRED"
        : "FAST_FAILED"
      : record.deepLane.status === "PENDING" || record.deepLane.status === "RUNNING"
        ? "FAST_COMPLETE"
        : record.deepLane.status === "FAILED"
          ? "DEEP_UNAVAILABLE"
          : "DEEP_COMPLETE";
  const stagedLaneValid = !hasStagedLaneContract || (
    record.outcome.stage === expectedStage &&
    isIso(record.fastLane.completedAt) === (record.fastLane.status !== "NOT_RUN") &&
    record.fastLane.completedAt === record.completedAt &&
    deepAttemptsValid &&
    attempts.length <= (lease.budget.maxDeepAttempts ?? 0) &&
    (deepInputIdentity === null || deepInputIdentity === expectedDeepInputIdentity) &&
    (record.deepLane.status === "PENDING" || record.deepLane.status === "RUNNING" ||
      record.deepLane.status === "PASS" || record.deepLane.status === "FAILED"
      ? deepInputIdentity !== null && record.lineage.noveltySignature !== null
      : true) &&
    (record.deepLane.status === "RUNNING"
      ? attempts.at(-1)?.status === "RUNNING"
      : true) &&
    (record.deepLane.status === "PASS" || record.deepLane.status === "FAILED"
      ? attempts.at(-1)?.status === record.deepLane.status &&
        record.deepLane.completedAt === attempts.at(-1)?.completedAt &&
        record.deepLane.runId === attempts.at(-1)?.runId &&
        hashCanonical(record.deepLane.proposalIds) ===
          hashCanonical(attempts.at(-1)?.proposalIds) &&
        hashCanonical(record.deepLane.evidenceGaps) ===
          hashCanonical(attempts.at(-1)?.evidenceGaps) &&
        record.deepLane.diagnostic === attempts.at(-1)?.diagnostic
      : record.deepLane.completedAt === null)
  );
  if (
    record.schemaVersion !== "pmh.search-lease-record.v1" ||
    lease?.schemaVersion !== "pmh.search-lease.v1" ||
    !SEARCH_LEASE_ALGORITHM_VERSIONS.includes(lease.algorithmVersion) ||
    !HASH_PATTERN.test(String(lease.leaseId)) ||
    lease.leaseId !== expectedLeaseId ||
    !HASH_PATTERN.test(String(lease.snapshotIdentity)) ||
    !HASH_PATTERN.test(String(lease.sourceSetIdentity)) ||
    (lease.issueId !== undefined && lease.issueId !== null &&
      !HASH_PATTERN.test(String(lease.issueId))) ||
    !SEARCH_LENSES.includes(lease.lens) ||
    !isIso(lease.issuedAt) ||
    !isIso(lease.deadlineAt) ||
    Date.parse(lease.deadlineAt) < Date.parse(lease.issuedAt) ||
    Date.parse(lease.deadlineAt) - Date.parse(lease.issuedAt) !== lease.budget.deadlineMs ||
    lease.thesis.trim() === "" || lease.thesis.length > 500 ||
    !nonEmptyStrings(lease.noveltyTargets, 12) ||
    !nonEmptyStrings(lease.scope?.venueIds, 25) ||
    new Set(lease.scope.venueIds).size !== lease.scope.venueIds.length ||
    lease.authority !== "PROPOSE_ONLY" ||
    lease.semanticDecisionAuthority !== false ||
    lease.certificateAuthority !== false ||
    lease.executionAuthority !== false ||
    !graphContextValid ||
    !candidatePolicyValid ||
    !discoveryModeValid ||
    !semanticFamilyValid ||
    !providerTelemetryValid ||
    !agentTelemetryValid ||
    !retrievalPlanValid ||
    !stagedLaneValid ||
    !corpusCoverageValid(
      record.fastLane.corpusCoverage,
      lease.scope.venueIds,
      record.fastLane.status,
      lease.algorithmVersion,
    ) ||
    !semanticScopeValid(record.fastLane.semanticScope) ||
    !economicGateValid(record.fastLane.economicGate, candidatePolicy) ||
    !Number.isSafeInteger(lease.budget.maxFastModelRequests) ||
    lease.budget.maxFastModelRequests < 0 ||
    lease.budget.maxFastModelRequests > 4 ||
    (lease.budget.maxPiInvocations !== 0 && lease.budget.maxPiInvocations !== 1) ||
    !Number.isSafeInteger(lease.budget.maxHypotheses) ||
    lease.budget.maxHypotheses < 1 || lease.budget.maxHypotheses > 20 ||
    !Number.isSafeInteger(lease.budget.deadlineMs) ||
    lease.budget.deadlineMs < 10_000 || lease.budget.deadlineMs > 1_200_000 ||
    (hasStagedLaneContract && (
      !Number.isSafeInteger(lease.budget.fastDeadlineMs) ||
      lease.budget.fastDeadlineMs! < 10_000 || lease.budget.fastDeadlineMs! > 600_000 ||
      !Number.isSafeInteger(lease.budget.deepDeadlineMs) ||
      lease.budget.deepDeadlineMs! < 10_000 || lease.budget.deepDeadlineMs! > 600_000 ||
      !Number.isSafeInteger(lease.budget.orchestrationGraceMs) ||
      lease.budget.orchestrationGraceMs! < 0 ||
      lease.budget.orchestrationGraceMs! > 60_000 ||
      !Number.isSafeInteger(lease.budget.maxDeepAttempts) ||
      lease.budget.maxDeepAttempts! < 1 || lease.budget.maxDeepAttempts! > 5 ||
      lease.budget.deadlineMs !== lease.budget.fastDeadlineMs! +
        (lease.budget.maxPiInvocations === 0 ? 0 : lease.budget.deepDeadlineMs!) +
        lease.budget.orchestrationGraceMs!
    )) ||
    (record.status !== "ISSUED" && record.status !== "PASS" && record.status !== "FAILED") ||
    (record.status === "ISSUED" ? record.completedAt !== null : !isIso(record.completedAt)) ||
    (record.completedAt !== null && Date.parse(record.completedAt) < Date.parse(lease.issuedAt)) ||
    (record.trigger !== "OPERATOR" && record.trigger !== "SCHEDULE") ||
    record.fastLane.taskId !== `search-lease:${lease.leaseId.slice(7)}` ||
    !nonEmptyStrings(record.fastLane.workerIds, 16) ||
    !nonEmptyStrings(record.fastLane.hypothesisIds, lease.budget.maxHypotheses) ||
    (record.fastLane.falsificationIds !== undefined &&
      (!nonEmptyStrings(record.fastLane.falsificationIds, 256) ||
        record.fastLane.falsificationIds.some((item) => !HASH_PATTERN.test(item)))) ||
    (record.fastLane.falsificationFindingIdentities !== undefined &&
      (!nonEmptyStrings(record.fastLane.falsificationFindingIdentities, 256) ||
        record.fastLane.falsificationFindingIdentities.some(
          (item) => !HASH_PATTERN.test(item)
        ))) ||
    (record.fastLane.falsificationFindingIdentities !== undefined &&
      record.fastLane.falsificationIds === undefined) ||
    (record.fastLane.falsificationIds !== undefined &&
      record.fastLane.falsificationFindingIdentities !== undefined &&
      record.fastLane.falsificationIds.length !==
        record.fastLane.falsificationFindingIdentities!.length) ||
    !nonEmptyStrings(record.fastLane.candidateListingRefs, 100) ||
    !Number.isSafeInteger(record.fastLane.modelRequestCount) ||
    record.fastLane.modelRequestCount < 0 ||
    (record.fastLane.status !== "NOT_RUN" && record.fastLane.status !== "PASS" && record.fastLane.status !== "FAILED") ||
    !["NOT_RUN", "PENDING", "RUNNING", "PASS", "FAILED"].includes(record.deepLane.status) ||
    !([
      "PENDING_FAST_LANE",
      "PENDING_DEEP_LANE",
      "NO_CANDIDATES",
      "NOT_MULTI_LISTING",
      "DUPLICATE",
      "ECONOMIC_GATE_BLOCKED",
      "PI_DISABLED",
      "NO_POLICY_MATCH",
      "NOVEL_MULTI_LISTING",
      "NOVEL_MULTI_VENUE",
    ] as const).includes(record.deepLane.reason) ||
    !READ_ONLY_TOOLS.every((tool, index) => record.deepLane.permittedTools[index] === tool) ||
    record.deepLane.permittedTools.length !== READ_ONLY_TOOLS.length ||
    !nonEmptyStrings(record.deepLane.proposalIds, 5) ||
    !nonEmptyStrings(record.deepLane.evidenceGaps, 20) ||
    !validHashOrNull(record.lineage.predecessorLeaseId) ||
    !validHashOrNull(record.lineage.duplicateOfLeaseId) ||
    !validHashOrNull(record.lineage.noveltySignature) ||
    !Number.isSafeInteger(record.outcome.hypothesisCount) ||
    (record.outcome.falsificationCount !== undefined &&
      (!Number.isSafeInteger(record.outcome.falsificationCount) ||
        record.outcome.falsificationCount < 0)) ||
    !Number.isSafeInteger(record.outcome.proposalCount) ||
    !Number.isSafeInteger(record.outcome.evidenceGapCount) ||
    record.outcome.hypothesisCount < 0 ||
    record.outcome.proposalCount < 0 ||
    record.outcome.evidenceGapCount < 0 ||
    (record.status !== "ISSUED" &&
      (record.outcome.hypothesisCount !== record.fastLane.hypothesisIds.length ||
        (record.outcome.falsificationCount !== undefined &&
          record.outcome.falsificationCount !==
            (record.fastLane.falsificationIds?.length ?? 0)) ||
        record.outcome.proposalCount !== record.deepLane.proposalIds.length ||
        record.outcome.evidenceGapCount !== record.deepLane.evidenceGaps.length)) ||
    (record.status === "ISSUED" &&
      (record.fastLane.status !== "NOT_RUN" ||
        record.deepLane.reason !== "PENDING_FAST_LANE" ||
        record.outcome.hypothesisCount !== 0 ||
        record.outcome.proposalCount !== 0)) ||
    record.trace.querySummary.trim() === "" || record.trace.querySummary.length > 500 ||
    record.semanticDecisionAuthority !== false ||
    record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    record.trace?.chainOfThoughtStored !== false ||
    record.deepLane?.toolExecutionTraceStored !== false ||
    record.fastLane?.modelRequestCount > lease.budget.maxFastModelRequests ||
    record.outcome?.hypothesisCount > lease.budget.maxHypotheses ||
    record.outcome?.proposalCount > 5 ||
    record.effects?.externalWrites !== false ||
    record.effects?.valueMovingActions !== false ||
    record.effects?.liveExecutionEnabled !== false ||
    !HASH_PATTERN.test(String(artifactHash)) ||
    artifactHash !== hashCanonical(body)
  ) {
    throw new Error("stored search lease record violates its bounded authority contract");
  }
  return deepFreeze(record);
}

function candidateSignature(hypotheses: readonly OpportunityHypothesis[]): Hash | null {
  const grounded = hypotheses
    .filter((item) => (item.listingRefs?.length ?? 0) > 0)
    .map((item) => ({
      strategyKind: item.strategyKind,
      listingRefs: [...(item.listingRefs ?? [])].sort(),
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return grounded.length === 0 ? null : hashCanonical(grounded);
}

export function hasGroundedMultiListingRefs(
  listingRefs: readonly string[],
): boolean {
  return listingRefs.length >= 2 &&
    new Set(listingRefs).size === listingRefs.length;
}

function hasGroundedMultiListingCandidate(
  hypotheses: readonly OpportunityHypothesis[],
): boolean {
  return hypotheses.some(
    (item) => hasGroundedMultiListingRefs(item.listingRefs ?? []),
  );
}

export function isGroundedNovelCandidate(
  record: SearchLeaseRecord,
): boolean {
  return record.outcome.novelCandidate &&
    record.deepLane.reason !== "NOT_MULTI_LISTING" &&
    hasGroundedMultiListingRefs(record.fastLane.candidateListingRefs);
}

function scopeFor(
  snapshot: MarketCorpusSnapshot,
  requestedVenueIds?: readonly string[],
  registeredVenueIds?: readonly string[],
): SearchLease["scope"] {
  const availableVenueIds = new Set(snapshot.listings.map((item) => item.venueId));
  const registered = registeredVenueIds === undefined
    ? null
    : [...new Set(registeredVenueIds)].sort();
  const venueIds = requestedVenueIds === undefined || requestedVenueIds.length === 0
    ? registered ?? [...availableVenueIds].sort()
    : [...new Set(requestedVenueIds)].sort();
  const allowedVenueIds = new Set(registered ?? availableVenueIds);
  if (venueIds.some((venueId) => !allowedVenueIds.has(venueId))) {
    throw new SearchLeaseUnavailableError("search issue references an unavailable venue");
  }
  const closes = snapshot.listings
    .filter((listing) => venueIds.includes(listing.venueId))
    .map((listing) => listing.closesAt)
    .filter((value): value is string => value !== null)
    .sort();
  return Object.freeze({
    venueIds: Object.freeze(venueIds),
    closesAtMin: closes[0] ?? null,
    closesAtMax: closes.at(-1) ?? null,
  });
}

function boundCatalogContextForPolicy(
  context: DiscoveryCatalogContext,
  policy: SearchCandidatePolicy | null | undefined,
): DiscoveryCatalogContext {
  const maximum = policy?.maxCorpusListings;
  if (maximum === undefined || context.listings.length <= maximum) return context;
  const firstByVenue = new Set<string>();
  const requiredRefs = new Set<string>();
  for (const listing of context.listings) {
    if (firstByVenue.has(listing.venueId)) continue;
    firstByVenue.add(listing.venueId);
    requiredRefs.add(listing.listingRef);
  }
  if (requiredRefs.size > maximum) {
    throw new SearchLeaseUnavailableError(
      "candidate corpus limit cannot retain one listing per represented venue",
    );
  }
  const selectedRefs = new Set(requiredRefs);
  for (const listing of context.listings) {
    if (selectedRefs.size >= maximum) break;
    selectedRefs.add(listing.listingRef);
  }
  return buildExactDiscoveryCatalogContext(
    context.source,
    context.listings.filter((listing) => selectedRefs.has(listing.listingRef)),
  );
}

export class SearchLeaseBusyError extends Error {}
export class SearchLeaseUnavailableError extends Error {}

export class SearchLeaseScheduler {
  readonly #records: SearchLeaseRecord[];
  readonly #budget: SearchLease["budget"];
  readonly #retentionLimit: number;
  readonly #store: SearchLeaseRecordStore | undefined;
  readonly #context: SearchLeaseOptions["context"];
  readonly #runFast: SearchLeaseOptions["runFast"];
  readonly #runDeep: SearchLeaseOptions["runDeep"] | undefined;
  readonly #enrichPrices: SearchLeaseOptions["enrichPrices"] | undefined;
  readonly #graphContext: SearchLeaseOptions["graphContext"] | undefined;
  readonly #now: () => number;
  readonly #active = new Map<Hash, Promise<SearchLeaseRecord>>();
  readonly #activeDeep = new Map<Hash, Promise<SearchLeaseRecord>>();
  readonly #queuedDeep = new Map<Hash, Promise<SearchLeaseRecord>>();
  readonly #corpora = new Map<Hash, MarketCorpusSnapshot>();
  readonly #activeNovelty = new Map<Hash, Hash>();
  readonly #concurrencyLimit: number;
  readonly #deepConcurrencyLimit: number;
  readonly #registeredVenueIds: readonly string[] | undefined;
  readonly #onRecordChange: ((record: SearchLeaseRecord) => void) | undefined;

  public readonly intervalMs: number | null;

  public constructor(options: SearchLeaseOptions) {
    this.intervalMs = options.intervalMs ?? null;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    this.#store = options.store;
    this.#context = options.context;
    this.#runFast = options.runFast;
    this.#runDeep = options.runDeep;
    this.#enrichPrices = options.enrichPrices;
    this.#graphContext = options.graphContext;
    this.#now = options.now ?? Date.now;
    this.#concurrencyLimit = options.concurrencyLimit ?? 1;
    this.#deepConcurrencyLimit = options.deepConcurrencyLimit ?? 1;
    this.#registeredVenueIds = options.registeredVenueIds === undefined
      ? undefined
      : Object.freeze([...options.registeredVenueIds].sort());
    const maxPiInvocations = options.maxPiInvocations ?? 1;
    const fastDeadlineMs = options.fastDeadlineMs ?? options.deadlineMs ??
      DEFAULT_FAST_DEADLINE_MS;
    const deepDeadlineMs = options.deepDeadlineMs ?? DEFAULT_DEEP_DEADLINE_MS;
    const orchestrationGraceMs = options.orchestrationGraceMs ??
      DEFAULT_ORCHESTRATION_GRACE_MS;
    const maxDeepAttempts = options.maxDeepAttempts ?? DEFAULT_MAX_DEEP_ATTEMPTS;
    this.#budget = Object.freeze({
      maxFastModelRequests: options.maxFastModelRequests ?? 1,
      maxPiInvocations,
      maxHypotheses: options.maxHypotheses ?? 8,
      deadlineMs: fastDeadlineMs +
        (maxPiInvocations === 0 ? 0 : deepDeadlineMs) + orchestrationGraceMs,
      fastDeadlineMs,
      deepDeadlineMs,
      orchestrationGraceMs,
      maxDeepAttempts,
    });
    this.#onRecordChange = options.onRecordChange;
    if (
      (this.intervalMs !== null &&
        (!Number.isSafeInteger(this.intervalMs) || this.intervalMs < 60_000 || this.intervalMs > 86_400_000)) ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 4 ||
      !Number.isSafeInteger(this.#concurrencyLimit) ||
      this.#concurrencyLimit < 1 || this.#concurrencyLimit > 8 ||
      !Number.isSafeInteger(this.#deepConcurrencyLimit) ||
      this.#deepConcurrencyLimit < 1 || this.#deepConcurrencyLimit > 8 ||
      !Number.isSafeInteger(this.#budget.maxFastModelRequests) ||
      this.#budget.maxFastModelRequests < 0 || this.#budget.maxFastModelRequests > 4 ||
      (this.#budget.maxPiInvocations !== 0 && this.#budget.maxPiInvocations !== 1) ||
      !Number.isSafeInteger(this.#budget.maxHypotheses) ||
      this.#budget.maxHypotheses < 1 || this.#budget.maxHypotheses > 20 ||
      !Number.isSafeInteger(this.#budget.deadlineMs) ||
      this.#budget.deadlineMs < 10_000 || this.#budget.deadlineMs > 1_200_000 ||
      !Number.isSafeInteger(this.#budget.fastDeadlineMs) ||
      this.#budget.fastDeadlineMs! < 10_000 || this.#budget.fastDeadlineMs! > 600_000 ||
      !Number.isSafeInteger(this.#budget.deepDeadlineMs) ||
      this.#budget.deepDeadlineMs! < 10_000 || this.#budget.deepDeadlineMs! > 600_000 ||
      !Number.isSafeInteger(this.#budget.orchestrationGraceMs) ||
      this.#budget.orchestrationGraceMs! < 0 ||
      this.#budget.orchestrationGraceMs! > 60_000 ||
      !Number.isSafeInteger(this.#budget.maxDeepAttempts) ||
      this.#budget.maxDeepAttempts! < 1 || this.#budget.maxDeepAttempts! > 5 ||
      (this.#registeredVenueIds !== undefined && (
        this.#registeredVenueIds.length === 0 ||
        this.#registeredVenueIds.length > 25 ||
        new Set(this.#registeredVenueIds).size !== this.#registeredVenueIds.length ||
        this.#registeredVenueIds.some(
          (item) => typeof item !== "string" || item.trim() === "",
        )
      ))
    ) {
      throw new Error("search lease scheduler configuration is invalid or unbounded");
    }
    this.#records = [
      ...(this.#store?.loadSearchLeaseRecords(this.#retentionLimit) ?? []),
    ].map(assertSearchLeaseRecord);
  }

  public shouldSchedule(snapshot: MarketCorpusSnapshot): boolean {
    return this.intervalMs !== null && this.#active.size < this.#concurrencyLimit &&
      snapshot.listingCount > 0 && this.#nextLens(snapshot) !== null;
  }

  public failIssuedForUnavailableSnapshots(
    snapshot: MarketCorpusSnapshot,
  ): readonly SearchLeaseRecord[] {
    const failed: SearchLeaseRecord[] = [];
    for (const record of this.#records.filter((item) =>
      item.status === "ISSUED" &&
      item.lease.issueId !== undefined &&
      item.lease.issueId !== null &&
      item.lease.snapshotIdentity !== snapshot.snapshotIdentity &&
      this.#store?.hasSearchLeaseCorpus(item.lease.snapshotIdentity) !== true &&
      !this.#active.has(item.lease.leaseId),
    )) {
      const diagnostic = "issued search lease snapshot is no longer available after restart";
      const completedAt = new Date(
        Math.max(this.#now(), Date.parse(record.lease.issuedAt)),
      ).toISOString();
      failed.push(this.#persist(withArtifactHash({
        ...withoutArtifactHash(record),
        status: "FAILED",
        completedAt,
        diagnostic,
        fastLane: Object.freeze({
          ...record.fastLane,
          status: "FAILED",
          diagnostic,
          ...(hasStagedLaneContractVersion(record.lease.algorithmVersion)
            ? { completedAt }
            : {}),
        }),
        deepLane: this.#skippedDeep("PENDING_FAST_LANE"),
        outcome: Object.freeze({
          ...record.outcome,
          ...(hasStagedLaneContractVersion(record.lease.algorithmVersion)
            ? { stage: "FAST_FAILED" as const }
            : {}),
        }),
      })));
    }
    return Object.freeze(failed);
  }

  public failExpiredIssued(): readonly SearchLeaseRecord[] {
    const failed: SearchLeaseRecord[] = [];
    for (const record of this.#records.filter((item) =>
      item.status === "ISSUED" &&
      Date.parse(item.lease.deadlineAt) <= this.#now() &&
      !this.#active.has(item.lease.leaseId)
    )) {
      const diagnostic =
        "issued search lease expired before a lane started; no provider work was attempted";
      const completedAt = new Date(
        Math.max(this.#now(), Date.parse(record.lease.issuedAt)),
      ).toISOString();
      failed.push(this.#persist(withArtifactHash({
        ...withoutArtifactHash(record),
        status: "FAILED",
        completedAt,
        diagnostic,
        fastLane: Object.freeze({
          ...record.fastLane,
          status: "FAILED" as const,
          diagnostic,
          ...(hasStagedLaneContractVersion(record.lease.algorithmVersion)
            ? { completedAt }
            : {}),
        }),
        deepLane: this.#skippedDeep("PENDING_FAST_LANE"),
        outcome: Object.freeze({
          ...record.outcome,
          stage: "RECOVERY_EXPIRED" as const,
        }),
      })));
    }
    return Object.freeze(failed);
  }

  public resumeIssued(
    issueId: Hash,
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> | null {
    const issued = this.#records.find((record) =>
      record.status === "ISSUED" && record.lease.issueId === issueId
    );
    if (issued === undefined) return null;
    const active = this.#active.get(issued.lease.leaseId);
    if (active !== undefined) {
      return Object.freeze({ promise: active, idempotentReplay: true });
    }
    const snapshot = this.#store?.loadSearchLeaseCorpus(
      issued.lease.snapshotIdentity,
    ) ?? null;
    if (snapshot === null) return null;
    return this.#launch(snapshot, issued);
  }

  public begin(
    snapshot: MarketCorpusSnapshot,
    lens?: SearchLens,
    trigger: "OPERATOR" | "SCHEDULE" = "OPERATOR",
    issue?: SearchLeaseIssueInput,
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    snapshot = assertMarketCorpusSnapshot(snapshot);
    if (snapshot.listingCount === 0) {
      throw new SearchLeaseUnavailableError("search lease requires a non-empty qualified corpus");
    }
    const selectedLens = lens ?? this.#nextLens(snapshot);
    if (selectedLens === null) {
      throw new SearchLeaseUnavailableError("all search lenses are complete for this corpus snapshot");
    }
    if (!SEARCH_LENSES.includes(selectedLens)) {
      throw new SearchLeaseUnavailableError("search lease lens is invalid");
    }
    const leaseId = hashCanonical(
      issue === undefined
        ? {
            schemaVersion: "pmh.search-lease-id.v1",
            algorithmVersion: ALGORITHM_VERSION,
            snapshotIdentity: snapshot.snapshotIdentity,
            lens: selectedLens,
          }
        : {
            schemaVersion: "pmh.search-lease-id.v2",
            algorithmVersion: ALGORITHM_VERSION,
            snapshotIdentity: snapshot.snapshotIdentity,
            lens: selectedLens,
            issueId: issue.issueId,
          },
    );
    const existing = this.#records.find((record) => record.lease.leaseId === leaseId);
    if (existing !== undefined && existing.status !== "ISSUED") {
      return Object.freeze({ promise: Promise.resolve(existing), idempotentReplay: true });
    }
    const active = this.#active.get(leaseId);
    if (active !== undefined) {
      return Object.freeze({ promise: active, idempotentReplay: true });
    }
    if (this.#active.size >= this.#concurrencyLimit) {
      throw new SearchLeaseBusyError("search lease concurrency limit is active");
    }
    const spec = LENS_SPEC[selectedLens];
    let issued = existing;
    if (issued === undefined) {
      const issuedAtMs = this.#now();
      const predecessorLeaseId = this.#records.find(
        (record) => record.lease.snapshotIdentity === snapshot.snapshotIdentity,
      )?.lease.leaseId ?? null;
      const scope = scopeFor(
        snapshot,
        issue?.venueIds,
        this.#registeredVenueIds,
      );
      const graphContext = this.#graphContext?.(snapshot, selectedLens) ?? null;
      const baseQuestion = issue?.question ?? spec.question;
      const querySummary = (
        graphContext === null
          ? baseQuestion
          : `${baseQuestion} Graph neighborhood: ${graphContext.searchBrief}`
      ).slice(0, 500);
      const lease: SearchLease = deepFreeze({
        schemaVersion: "pmh.search-lease.v1" as const,
        leaseId,
        algorithmVersion: ALGORITHM_VERSION,
        snapshotIdentity: snapshot.snapshotIdentity,
        sourceSetIdentity: snapshot.sourceSetIdentity,
        issueId: issue?.issueId ?? null,
        discoveryMode: issue === undefined
          ? null
          : issue.discoveryMode ?? "CLAIM_MONITORING",
        ...(issue?.semanticFamily === undefined
          ? {}
          : { semanticFamily: issue.semanticFamily }),
        ...(issue?.candidatePolicy === undefined
          ? {}
          : { candidatePolicy: issue.candidatePolicy }),
        lens: selectedLens,
        thesis: spec.thesis,
        noveltyTargets: spec.noveltyTargets,
        scope,
        budget: this.#budget,
        issuedAt: new Date(issuedAtMs).toISOString(),
        deadlineAt: new Date(issuedAtMs + this.#budget.deadlineMs).toISOString(),
        graphContext,
        authority: "PROPOSE_ONLY" as const,
        semanticDecisionAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          externalWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      });
      issued = withArtifactHash({
        schemaVersion: "pmh.search-lease-record.v1",
        lease,
        trigger,
        status: "ISSUED",
        completedAt: null,
        diagnostic: null,
        fastLane: Object.freeze({
          status: "NOT_RUN",
          taskId: `search-lease:${leaseId.slice(7)}`,
          runId: null,
          workerIds: Object.freeze([]),
          modelRequestCount: 0,
          providerTelemetry: Object.freeze({
            schemaVersion: "pmh.provider-attempt-telemetry.v1" as const,
            requestAttemptCount: 0,
            failureCategories: Object.freeze([]),
          }),
          hypothesisIds: Object.freeze([]),
          falsificationIds: Object.freeze([]),
          falsificationFindingIdentities: Object.freeze([]),
          candidateListingRefs: Object.freeze([]),
          economicGate: pendingEconomicGate(issue?.candidatePolicy),
          diagnostic: null,
          completedAt: null,
        }),
        deepLane: Object.freeze({
          status: "NOT_RUN",
          reason: "PENDING_FAST_LANE",
          runId: null,
          proposalIds: Object.freeze([]),
          evidenceGaps: Object.freeze([]),
          diagnostic: null,
          inputIdentity: null,
          attempts: Object.freeze([]),
          completedAt: null,
          permittedTools: READ_ONLY_TOOLS,
          toolExecutionTraceStored: false,
        }),
        lineage: Object.freeze({ predecessorLeaseId, duplicateOfLeaseId: null, noveltySignature: null }),
        outcome: Object.freeze({
          novelCandidate: false,
          hypothesisCount: 0,
          falsificationCount: 0,
          proposalCount: 0,
          evidenceGapCount: 0,
          stage: "FAST_PENDING" as const,
        }),
        trace: Object.freeze({ querySummary, chainOfThoughtStored: false }),
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
        effects: lease.effects,
      });
      this.#store?.saveSearchLeaseCorpus(snapshot);
      this.#corpora.set(snapshot.snapshotIdentity, snapshot);
      issued = this.#persist(issued);
    }
    return this.#launch(snapshot, issued);
  }

  #launch(
    snapshot: MarketCorpusSnapshot,
    issued: SearchLeaseRecord,
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    if (
      snapshot.snapshotIdentity !== issued.lease.snapshotIdentity ||
      snapshot.sourceSetIdentity !== issued.lease.sourceSetIdentity
    ) {
      throw new SearchLeaseUnavailableError(
        "retained search lease corpus does not match issued scope",
      );
    }
    const active = this.#active.get(issued.lease.leaseId);
    if (active !== undefined) {
      return Object.freeze({ promise: active, idempotentReplay: true });
    }
    if (this.#active.size >= this.#concurrencyLimit) {
      throw new SearchLeaseBusyError("search lease concurrency limit is active");
    }
    const promise = this.#execute(snapshot, issued).finally(() => {
      this.#active.delete(issued.lease.leaseId);
    });
    this.#active.set(issued.lease.leaseId, promise);
    return Object.freeze({ promise, idempotentReplay: false });
  }

  async #execute(
    snapshot: MarketCorpusSnapshot,
    issued: SearchLeaseRecord,
  ): Promise<SearchLeaseRecord> {
    let selectedRetrievalPlan: SemanticFamilyRetrievalPlan | undefined;
    try {
      const contextResult = this.#context(
        issued.trace.querySummary,
        issued.lease.scope.venueIds,
        issued.lease.lens,
        snapshot,
        this.#contextFeedback(issued),
        issued.lease.candidatePolicy ?? null,
        issued.lease.semanticFamily ?? null,
        issued.lease.discoveryMode ?? null,
      );
      const unboundedContext = "catalogContext" in contextResult
        ? contextResult.catalogContext
        : contextResult;
      const context = boundCatalogContextForPolicy(
        unboundedContext,
        issued.lease.candidatePolicy,
      );
      const corpusCoverage = "catalogContext" in contextResult
        ? assertCatalogContextCoverage(
            contextResult.coverage,
            issued.lease.scope.venueIds,
          )
        : undefined;
      selectedRetrievalPlan = "catalogContext" in contextResult
        ? contextResult.retrievalPlan
        : undefined;
      if (
        selectedRetrievalPlan !== undefined &&
        selectedRetrievalPlan.selectedContextIdentity !== context.contextIdentity
      ) {
        throw new Error("semantic family retrieval plan does not bind the bounded context");
      }
      if (corpusCoverage !== undefined) {
        const actualContextVenueIds = Object.freeze([
          ...new Set(context.listings.map((listing) => listing.venueId)),
        ].sort());
        if (
          actualContextVenueIds.join("\n") !==
            corpusCoverage.contextVenueIds.join("\n") ||
          corpusCoverage.eligibleVenueIds.length <
            corpusCoverage.minimumEligibleVenueCount ||
          corpusCoverage.contextVenueIds.length <
            corpusCoverage.minimumEligibleVenueCount
        ) {
          throw new CatalogContextCoverageError(
            "bounded catalog context does not satisfy its coverage manifest",
            corpusCoverage,
          );
        }
      }
      const semanticScope = buildSearchScopeIdentity(context.listings);
      const taskVenueIds = corpusCoverage?.contextVenueIds ??
        issued.lease.scope.venueIds;
      const retrievalBrief = selectedRetrievalPlan === undefined
        ? ""
        : semanticFamilyRetrievalBrief(selectedRetrievalPlan).slice(0, 220);
      const taskQuestion = retrievalBrief === ""
        ? issued.trace.querySummary
        : `${issued.trace.querySummary.slice(0, 499 - retrievalBrief.length)} ${retrievalBrief}`;
      const task: DiscoveryTask = Object.freeze({
        taskId: issued.fastLane.taskId,
        question: taskQuestion,
        venueIds: taskVenueIds,
        maxHypotheses: issued.lease.budget.maxHypotheses,
        deadlineEpochMs: Date.parse(issued.lease.issuedAt) +
          (issued.lease.budget.fastDeadlineMs ?? issued.lease.budget.deadlineMs),
        catalogContext: context,
      });
      const run = await this.#runFast(task, issued.lease.budget.maxFastModelRequests);
      const modelReports = run.workerReports?.filter((report) => report.kind === "MODEL") ?? [];
      const modelRequestCount = modelReports.length;
      if (modelRequestCount > issued.lease.budget.maxFastModelRequests) {
        throw new Error("fast lane exceeded its model request budget");
      }
      const providerTelemetry: SearchLeaseProviderTelemetry = Object.freeze({
        schemaVersion: "pmh.provider-attempt-telemetry.v1",
        requestAttemptCount: modelReports.reduce(
          (sum, report) => sum + (report.providerRequestAttemptCount ?? 1),
          0,
        ),
        failureCategories: Object.freeze(modelReports.reduce<ProviderFailureCategory[]>(
          (failures, report) => {
            if (report.status === "FAILED") {
              failures.push(report.providerFailureCategory ?? "UNTYPED");
            }
            return failures;
          },
          [],
        )),
      });
      const agentTraces = modelReports.flatMap((report) =>
        report.agentTrace === undefined ? [] : [report.agentTrace]
      );
      const terminationReasons = [
        "EXPLICIT_COMPLETION", "PROPOSAL_LIMIT", "STEP_LIMIT",
        "TOOL_CALL_LIMIT", "MODEL_FINISHED", "TIMEOUT", "TASK_DEADLINE",
        "PROVIDER_FAILURE", "PROTOCOL_FAILURE",
      ] as const;
      const agentTelemetry: SearchLeaseAgentTelemetry = Object.freeze({
        schemaVersion: "pmh.discovery-agent-telemetry.v1",
        agentRunCount: agentTraces.length,
        stepCount: agentTraces.reduce((sum, trace) => sum + trace.stepCount, 0),
        toolCallCount: agentTraces.reduce((sum, trace) => sum + trace.toolCallCount, 0),
        catalogReadCount: agentTraces.reduce((sum, trace) => sum + trace.catalogReadCount, 0),
        acceptedProposalEffectCount: agentTraces.reduce(
          (sum, trace) => sum + trace.acceptedProposalCount,
          0,
        ),
        rejectedProposalEffectCount: agentTraces.reduce(
          (sum, trace) => sum + trace.rejectedProposalCount,
          0,
        ),
        acceptedFalsificationEffectCount: agentTraces.reduce(
          (sum, trace) => sum + (trace.acceptedFalsificationCount ?? 0),
          0,
        ),
        rejectedFalsificationEffectCount: agentTraces.reduce(
          (sum, trace) => sum + (trace.rejectedFalsificationCount ?? 0),
          0,
        ),
        terminationReasons: Object.freeze(terminationReasons.flatMap((reason) => {
          const count = agentTraces.filter((trace) => trace.terminationReason === reason).length;
          return count === 0 ? [] : [Object.freeze({ reason, count })];
        })),
      });
      const hypothesisSignature = candidateSignature(run.hypotheses);
      const groundedCandidateHypotheses = run.hypotheses.filter((hypothesis) =>
        hasGroundedMultiListingRefs(hypothesis.listingRefs ?? [])
      );
      const groundedCandidateSignature = candidateSignature(
        groundedCandidateHypotheses,
      );
      const policy = issued.lease.candidatePolicy;
      const candidateSelection = policy?.candidateSelection ?? "EXACT_CONTEXT";
      const contextListingRefs = Object.freeze(
        context.listings.map((item) => item.listingRef).sort(),
      );
      const contextVenueByRef = new Map(
        context.listings.map((item) => [item.listingRef, item.venueId] as const),
      );
      const meetsPolicyScope = (refs: readonly string[]) =>
        policy !== undefined && policy !== null &&
        candidatePolicyListingCountMatches(policy, refs.length) &&
        new Set(refs).size === refs.length &&
        refs.every((listingRef) => contextVenueByRef.has(listingRef)) &&
        (policy.requireDistinctVenues !== true ||
          new Set(refs.map((listingRef) => contextVenueByRef.get(listingRef))).size ===
            refs.length);
      const modelWorkerIds = new Set(
        run.workerReports
          ?.filter((report) => report.kind === "MODEL" && report.status === "PASS")
          .map((report) => report.workerId) ?? [],
      );
      const selectedModelHypothesis = candidateSelection === "MODEL_HYPOTHESIS"
        ? run.hypotheses.find((hypothesis) =>
            modelWorkerIds.has(hypothesis.workerId) &&
            meetsPolicyScope(hypothesis.listingRefs ?? [])
          ) ?? null
        : null;
      const exactPolicyContext =
        policy !== undefined &&
        policy !== null &&
        candidateSelection === "EXACT_CONTEXT" &&
        meetsPolicyScope(contextListingRefs)
          ? contextListingRefs
          : null;
      const hypothesisListingRefs = Object.freeze([...new Set(
        run.hypotheses.flatMap((item) => item.listingRefs ?? []),
      )].sort());
      const groundedCandidateListingRefs = Object.freeze([...new Set(
        groundedCandidateHypotheses.flatMap((item) => item.listingRefs ?? []),
      )].sort());
      const listingRefs = exactPolicyContext ??
        (selectedModelHypothesis === null
          ? policy === undefined || policy === null
            ? groundedCandidateListingRefs.length === 0
              ? hypothesisListingRefs
              : groundedCandidateListingRefs
            : Object.freeze([])
          : Object.freeze([...(selectedModelHypothesis.listingRefs ?? [])].sort()));
      const signature = policy === undefined || policy === null
        ? groundedCandidateSignature
        : exactPolicyContext !== null && hypothesisSignature !== null
          ? hashCanonical({
              schemaVersion: "pmh.search-candidate-signature.v2",
              allowedRelationKinds: [...policy.allowedRelationKinds].sort(),
              listingRefs,
            })
          : selectedModelHypothesis !== null
            ? hashCanonical({
                schemaVersion: "pmh.search-candidate-signature.v3",
                selection: "MODEL_HYPOTHESIS",
                allowedRelationKinds: [...policy.allowedRelationKinds].sort(),
                listingRefs,
              })
            : null;
      const duplicate = signature === null ? undefined : this.#records.find(
        (record) =>
          record.status === "PASS" &&
          record.lease.leaseId !== issued.lease.leaseId &&
          record.lineage.noveltySignature === signature,
      );
      const activeDuplicateLeaseId = signature === null
        ? undefined
        : this.#activeNovelty.get(signature);
      const duplicateLeaseId = duplicate?.lease.leaseId ?? activeDuplicateLeaseId ?? null;
      let economicGate = listingRefs.length === 0
        ? pendingEconomicGate(issued.lease.candidatePolicy)
        : completedEconomicGate({
            policy: issued.lease.candidatePolicy,
            listingRefs,
            context,
          });
      if (
        economicGate.required &&
        economicGate.status === "PRICE_UNAVAILABLE" &&
        this.#enrichPrices !== undefined &&
        listingRefs.length === 2
      ) {
        const selectedListings = listingRefs.flatMap((listingRef) => {
          const listing = context.listings.find((item) => item.listingRef === listingRef);
          return listing === undefined ? [] : [listing];
        });
        if (selectedListings.length === 2) {
          const enrichment = await this.#enrichPrices(selectedListings);
          economicGate = completedEconomicGate({
            policy: issued.lease.candidatePolicy,
            listingRefs,
            context,
            currentListings: enrichment.listings,
            enrichment,
          });
        }
      }
      const fastCompletedAt = new Date(
        Math.max(this.#now(), Date.parse(issued.lease.issuedAt)),
      ).toISOString();
      const fastLane: SearchLeaseFastLane = Object.freeze({
        status: "PASS",
        taskId: task.taskId,
        runId: run.runId,
        workerIds: Object.freeze([...run.workerIds]),
        modelRequestCount,
        providerTelemetry,
        agentTelemetry,
        ...(corpusCoverage === undefined ? {} : { corpusCoverage }),
        ...(selectedRetrievalPlan === undefined
          ? {}
          : { retrievalPlan: selectedRetrievalPlan }),
        hypothesisIds: Object.freeze(run.hypotheses.map((item) => item.hypothesisId)),
        falsificationIds: Object.freeze(
          (run.falsifications ?? []).map((item) => item.falsificationId),
        ),
        falsificationFindingIdentities: Object.freeze(
          (run.falsifications ?? []).map((item) =>
            item.findingIdentity ?? item.falsificationId
          ),
        ),
        candidateListingRefs: listingRefs,
        semanticScope,
        economicGate,
        diagnostic: run.diagnostics.length === 0 ? null : compactDiagnostic(run.diagnostics.join("; ")),
        completedAt: fastCompletedAt,
      });
      let deepLane: SearchLeaseDeepLane;
      if (
        (policy === undefined || policy === null) &&
        hypothesisSignature !== null &&
        !hasGroundedMultiListingCandidate(run.hypotheses)
      ) {
        deepLane = this.#skippedDeep("NOT_MULTI_LISTING");
      } else if (signature === null) {
        deepLane = this.#skippedDeep("NO_CANDIDATES");
      } else if (listingRefs.length < 2) {
        deepLane = this.#skippedDeep("NOT_MULTI_LISTING");
      } else if (
        fastLane.economicGate?.required === true &&
        fastLane.economicGate.status !== "POSITIVE_GROSS_HINT"
      ) {
        deepLane = this.#skippedDeep(
          "ECONOMIC_GATE_BLOCKED",
          fastLane.economicGate.diagnostic,
        );
      } else if (duplicateLeaseId !== null) {
        deepLane = this.#skippedDeep("DUPLICATE");
      } else if (issued.lease.budget.maxPiInvocations === 0 || this.#runDeep === undefined) {
        deepLane = this.#skippedDeep("PI_DISABLED");
      } else {
        const inputIdentity = this.#deepInputIdentity(issued, listingRefs, signature);
        deepLane = Object.freeze({
          status: "PENDING" as const,
          reason: "PENDING_DEEP_LANE" as const,
          runId: null,
          proposalIds: Object.freeze([]),
          evidenceGaps: Object.freeze([]),
          diagnostic: null,
          inputIdentity,
          attempts: Object.freeze([]),
          completedAt: null,
          permittedTools: READ_ONLY_TOOLS,
          toolExecutionTraceStored: false as const,
        });
      }
      const checkpoint = this.#persist(withArtifactHash({
        ...withoutArtifactHash(issued),
        status: "PASS",
        completedAt: fastCompletedAt,
        diagnostic: null,
        fastLane,
        deepLane,
        lineage: Object.freeze({
          ...issued.lineage,
          duplicateOfLeaseId:
            deepLane.reason === "ECONOMIC_GATE_BLOCKED" ? null : duplicateLeaseId,
          noveltySignature:
            deepLane.reason === "ECONOMIC_GATE_BLOCKED" ? null : signature,
        }),
        outcome: Object.freeze({
          novelCandidate: signature !== null && duplicateLeaseId === null &&
            deepLane.reason !== "ECONOMIC_GATE_BLOCKED" &&
            hasGroundedMultiListingRefs(listingRefs),
          hypothesisCount: run.hypotheses.length,
          falsificationCount: run.falsifications?.length ?? 0,
          proposalCount: deepLane.proposalIds.length,
          evidenceGapCount: deepLane.evidenceGaps.length,
          stage: deepLane.status === "PENDING"
            ? "FAST_COMPLETE" as const
            : "DEEP_COMPLETE" as const,
        }),
      }));
      if (
        checkpoint.deepLane.status === "PENDING" &&
        checkpoint.lineage.noveltySignature !== null
      ) {
        void this.#launchDeep(snapshot, checkpoint).catch(() => undefined);
      }
      return checkpoint;
    } catch (error) {
      const diagnostic = compactDiagnostic(error);
      const corpusCoverage = error instanceof CatalogContextCoverageError
        ? assertCatalogContextCoverage(
            error.coverage,
            issued.lease.scope.venueIds,
          )
        : issued.fastLane.corpusCoverage;
      const completedAt = new Date(
        Math.max(this.#now(), Date.parse(issued.lease.issuedAt)),
      ).toISOString();
      return this.#persist(withArtifactHash({
        ...withoutArtifactHash(issued),
        status: "FAILED",
        completedAt,
        diagnostic,
        fastLane: Object.freeze({
          ...issued.fastLane,
          ...(corpusCoverage === undefined ? {} : { corpusCoverage }),
          ...(selectedRetrievalPlan === undefined
            ? {}
            : { retrievalPlan: selectedRetrievalPlan }),
          status: "FAILED",
          diagnostic,
          completedAt,
        }),
        deepLane: this.#skippedDeep("PENDING_FAST_LANE"),
        outcome: Object.freeze({
          ...issued.outcome,
          stage: "FAST_FAILED" as const,
        }),
      }));
    }
  }

  #deepInputIdentity(
    issued: SearchLeaseRecord,
    listingRefs: readonly string[],
    noveltySignature: Hash,
  ): Hash {
    return hashCanonical({
      schemaVersion: "pmh.search-deep-input.v1",
      leaseId: issued.lease.leaseId,
      snapshotIdentity: issued.lease.snapshotIdentity,
      sourceSetIdentity: issued.lease.sourceSetIdentity,
      question: issued.trace.querySummary,
      thesis: issued.lease.thesis,
      listingRefs: [...listingRefs].sort(),
      noveltySignature,
      candidatePolicy: issued.lease.candidatePolicy ?? null,
      graphNeighborhoodIdentity:
        issued.lease.graphContext?.neighborhoodIdentity ?? null,
    });
  }

  #deepQuestion(record: SearchLeaseRecord): string {
    return [
      record.lease.thesis,
      `Search assignment: ${record.trace.querySummary}`,
      `Inspect these fast-lane candidates: ${record.fastLane.candidateListingRefs.join(", ")}.`,
      "Use the whole immutable MarketFS snapshot to find corroborating or falsifying rule evidence. Obey any exact candidate arity and relation exclusions in the search assignment. Return proposals only; do not make a semantic approval or trading decision.",
      ...(record.lease.graphContext === null || record.lease.graphContext === undefined
        ? []
        : [`Prior content-addressed graph evidence: ${record.lease.graphContext.searchBrief}`]),
    ].join(" ").slice(0, 1_000);
  }

  #launchDeep(
    snapshot: MarketCorpusSnapshot,
    record: SearchLeaseRecord,
  ): Promise<SearchLeaseRecord> {
    const active = this.#activeDeep.get(record.lease.leaseId);
    if (active !== undefined) return active;
    const queued = this.#queuedDeep.get(record.lease.leaseId);
    if (queued !== undefined) return queued;
    if (record.deepLane.status === "PASS") return Promise.resolve(record);
    if (record.deepLane.status !== "PENDING") {
      return Promise.reject(new SearchLeaseUnavailableError(
        "search lease deep stage is not pending",
      ));
    }
    if (this.#runDeep === undefined) {
      return Promise.reject(new SearchLeaseUnavailableError(
        "pi deep investigation is not configured",
      ));
    }
    if (this.#activeDeep.size >= this.#deepConcurrencyLimit) {
      const waitForSlot = Promise.race([...this.#activeDeep.values()]).then(
        () => undefined,
        () => undefined,
      ).then(() => {
        this.#queuedDeep.delete(record.lease.leaseId);
        const latest = this.#records.find(
          (item) => item.lease.leaseId === record.lease.leaseId,
        ) ?? record;
        return this.#launchDeep(snapshot, latest);
      });
      this.#queuedDeep.set(record.lease.leaseId, waitForSlot);
      return waitForSlot;
    }
    if (
      snapshot.snapshotIdentity !== record.lease.snapshotIdentity ||
      snapshot.sourceSetIdentity !== record.lease.sourceSetIdentity
    ) {
      return Promise.reject(new SearchLeaseUnavailableError(
        "retained deep-stage corpus does not match the fast checkpoint",
      ));
    }
    const signature = record.lineage.noveltySignature;
    if (signature === null || record.deepLane.inputIdentity === null ||
      record.deepLane.inputIdentity === undefined) {
      return Promise.reject(new SearchLeaseUnavailableError(
        "search lease deep stage is missing its immutable input identity",
      ));
    }
    const otherLeaseId = this.#activeNovelty.get(signature);
    if (otherLeaseId !== undefined && otherLeaseId !== record.lease.leaseId) {
      const duplicate = this.#persist(withArtifactHash({
        ...withoutArtifactHash(record),
        deepLane: this.#skippedDeep("DUPLICATE"),
        lineage: Object.freeze({
          ...record.lineage,
          duplicateOfLeaseId: otherLeaseId,
        }),
        outcome: Object.freeze({
          ...record.outcome,
          novelCandidate: false,
          stage: "DEEP_COMPLETE" as const,
        }),
      }));
      return Promise.resolve(duplicate);
    }
    this.#activeNovelty.set(signature, record.lease.leaseId);
    const promise = this.#executeDeep(snapshot, record).finally(() => {
      this.#activeDeep.delete(record.lease.leaseId);
      if (this.#activeNovelty.get(signature) === record.lease.leaseId) {
        this.#activeNovelty.delete(signature);
      }
    });
    this.#activeDeep.set(record.lease.leaseId, promise);
    return promise;
  }

  async #executeDeep(
    snapshot: MarketCorpusSnapshot,
    checkpoint: SearchLeaseRecord,
  ): Promise<SearchLeaseRecord> {
    if (this.#runDeep === undefined) {
      return this.#persist(withArtifactHash({
        ...withoutArtifactHash(checkpoint),
        deepLane: this.#skippedDeep("PI_DISABLED"),
        outcome: Object.freeze({
          ...checkpoint.outcome,
          stage: "DEEP_UNAVAILABLE" as const,
        }),
      }));
    }
    const attempts = [...(checkpoint.deepLane.attempts ?? [])];
    const attemptNumber = attempts.length + 1;
    const maxAttempts = checkpoint.lease.budget.maxDeepAttempts ?? 1;
    if (attemptNumber > maxAttempts) {
      throw new SearchLeaseUnavailableError(
        "search lease deep retry budget is exhausted",
      );
    }
    const startedAtMs = Math.max(this.#now(), Date.parse(checkpoint.lease.issuedAt));
    const startedAt = new Date(startedAtMs).toISOString();
    const deadlineAt = new Date(
      startedAtMs +
        (checkpoint.lease.budget.deepDeadlineMs ?? checkpoint.lease.budget.deadlineMs),
    ).toISOString();
    const inputIdentity = checkpoint.deepLane.inputIdentity!;
    const attemptId = hashCanonical({
      schemaVersion: "pmh.search-deep-attempt-id.v1",
      leaseId: checkpoint.lease.leaseId,
      inputIdentity,
      attemptNumber,
    });
    const runningAttempt: SearchLeaseDeepAttempt = Object.freeze({
      attemptId,
      attemptNumber,
      inputIdentity,
      status: "RUNNING",
      startedAt,
      deadlineAt,
      completedAt: null,
      runId: null,
      proposalIds: Object.freeze([]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    });
    const running = this.#persist(withArtifactHash({
      ...withoutArtifactHash(checkpoint),
      deepLane: Object.freeze({
        ...checkpoint.deepLane,
        status: "RUNNING" as const,
        attempts: Object.freeze([...attempts, runningAttempt]),
      }),
    }));

    let result: SearchLeaseDeepResult;
    try {
      result = await this.#runDeep(snapshot, this.#deepQuestion(running));
    } catch (error) {
      result = Object.freeze({
        runId: attemptId,
        status: "FAILED" as const,
        proposalIds: Object.freeze([]),
        evidenceGaps: Object.freeze([]),
        diagnostic: compactDiagnostic(error),
      });
    }
    const policy = running.lease.candidatePolicy;
    const listingRefs = running.fastLane.candidateListingRefs;
    const filteredProposalIds = policy === undefined || policy === null
      ? [...result.proposalIds].slice(0, 5)
      : (result.proposalDetails ?? [])
        .filter((proposal) =>
          policy.allowedRelationKinds.includes(proposal.relationKind) &&
          candidatePolicyListingCountMatches(policy, proposal.listingRefs.length) &&
          proposal.listingRefs.every((listingRef) => listingRefs.includes(listingRef))
        )
        .map((proposal) => proposal.proposalId)
        .filter((proposalId, index, values) => values.indexOf(proposalId) === index)
        .slice(0, 5);
    const proposalIds = result.status === "PASS"
      ? filteredProposalIds
      : [];
    const policyDiagnostic = policy !== undefined && policy !== null &&
        result.status === "PASS" && proposalIds.length === 0
      ? `${result.proposalIds.length} deep proposal${result.proposalIds.length === 1 ? "" : "s"} retained as research evidence; none matched the issue candidate policy.`
      : null;
    const completedAt = new Date(
      Math.max(this.#now(), startedAtMs),
    ).toISOString();
    const completedAttempt: SearchLeaseDeepAttempt = Object.freeze({
      ...runningAttempt,
      status: result.status,
      completedAt,
      runId: result.runId,
      proposalIds: Object.freeze(proposalIds),
      evidenceGaps: Object.freeze([...result.evidenceGaps].slice(0, 20)),
      diagnostic: result.diagnostic ?? policyDiagnostic,
    });
    const deepLane: SearchLeaseDeepLane = Object.freeze({
      status: result.status,
      reason: policyDiagnostic === null ? "NOVEL_MULTI_LISTING" : "NO_POLICY_MATCH",
      runId: result.runId,
      proposalIds: completedAttempt.proposalIds,
      evidenceGaps: completedAttempt.evidenceGaps,
      diagnostic: completedAttempt.diagnostic,
      inputIdentity,
      attempts: Object.freeze([...attempts, completedAttempt]),
      completedAt,
      permittedTools: READ_ONLY_TOOLS,
      toolExecutionTraceStored: false,
    });
    return this.#persist(withArtifactHash({
      ...withoutArtifactHash(running),
      status: "PASS",
      diagnostic: null,
      deepLane,
      outcome: Object.freeze({
        ...running.outcome,
        proposalCount: deepLane.proposalIds.length,
        evidenceGapCount: deepLane.evidenceGaps.length,
        stage: result.status === "PASS"
          ? "DEEP_COMPLETE" as const
          : "DEEP_UNAVAILABLE" as const,
      }),
    }));
  }

  public awaitDeep(leaseId: Hash): Promise<SearchLeaseRecord> {
    const active = this.#activeDeep.get(leaseId);
    if (active !== undefined) return active;
    const queued = this.#queuedDeep.get(leaseId);
    if (queued !== undefined) return queued;
    const record = this.#records.find((item) => item.lease.leaseId === leaseId);
    if (record === undefined) {
      return Promise.reject(new SearchLeaseUnavailableError(
        "search lease was not found",
      ));
    }
    return Promise.resolve(record);
  }

  public retryDeep(
    leaseId: Hash,
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    if (this.#runDeep === undefined) {
      throw new SearchLeaseUnavailableError("pi deep investigation is not configured");
    }
    const active = this.#activeDeep.get(leaseId);
    if (active !== undefined) {
      return Object.freeze({ promise: active, idempotentReplay: true });
    }
    const queued = this.#queuedDeep.get(leaseId);
    if (queued !== undefined) {
      return Object.freeze({ promise: queued, idempotentReplay: true });
    }
    const record = this.#records.find((item) => item.lease.leaseId === leaseId);
    if (record === undefined || record.status !== "PASS") {
      throw new SearchLeaseUnavailableError("search lease fast checkpoint is unavailable");
    }
    if (record.deepLane.status === "PASS") {
      return Object.freeze({ promise: Promise.resolve(record), idempotentReplay: true });
    }
    if (record.deepLane.status !== "FAILED") {
      throw new SearchLeaseUnavailableError("search lease deep stage is not retryable");
    }
    if (
      !hasStagedLaneContractVersion(record.lease.algorithmVersion) ||
      record.deepLane.inputIdentity === null ||
      record.deepLane.inputIdentity === undefined
    ) {
      throw new SearchLeaseUnavailableError(
        "historical deep failures do not have a retryable immutable input",
      );
    }
    const maxAttempts = record.lease.budget.maxDeepAttempts ?? 1;
    if ((record.deepLane.attempts?.length ?? 0) >= maxAttempts) {
      throw new SearchLeaseUnavailableError("search lease deep retry budget is exhausted");
    }
    const snapshot = this.#corpora.get(record.lease.snapshotIdentity) ??
      this.#store?.loadSearchLeaseCorpus(record.lease.snapshotIdentity) ?? null;
    if (snapshot === null) {
      throw new SearchLeaseUnavailableError("retained deep-stage corpus is unavailable");
    }
    const pending = this.#persist(withArtifactHash({
      ...withoutArtifactHash(record),
      deepLane: Object.freeze({
        ...record.deepLane,
        status: "PENDING" as const,
        reason: "PENDING_DEEP_LANE" as const,
        runId: null,
        proposalIds: Object.freeze([]),
        evidenceGaps: Object.freeze([]),
        diagnostic: null,
        completedAt: null,
      }),
      outcome: Object.freeze({
        ...record.outcome,
        proposalCount: 0,
        evidenceGapCount: 0,
        stage: "FAST_COMPLETE" as const,
      }),
    }));
    return Object.freeze({
      promise: this.#launchDeep(snapshot, pending),
      idempotentReplay: false,
    });
  }

  public resumeDeepWork(): readonly Promise<SearchLeaseRecord>[] {
    if (this.#runDeep === undefined) return Object.freeze([]);
    const promises: Promise<SearchLeaseRecord>[] = [];
    for (const original of [...this.#records]) {
      if (original.status !== "PASS" ||
        (original.deepLane.status !== "PENDING" &&
          original.deepLane.status !== "RUNNING")) continue;
      const snapshot = this.#corpora.get(original.lease.snapshotIdentity) ??
        this.#store?.loadSearchLeaseCorpus(
        original.lease.snapshotIdentity,
      ) ?? null;
      if (snapshot === null) continue;
      let record = original;
      if (record.deepLane.status === "RUNNING") {
        const attempts = [...(record.deepLane.attempts ?? [])];
        const last = attempts.at(-1);
        if (last === undefined || last.status !== "RUNNING") continue;
        const interruptedAt = new Date(
          Math.max(this.#now(), Date.parse(last.startedAt)),
        ).toISOString();
        attempts[attempts.length - 1] = Object.freeze({
          ...last,
          status: "FAILED" as const,
          completedAt: interruptedAt,
          diagnostic: "deep investigation was interrupted by process restart",
        });
        record = this.#persist(withArtifactHash({
          ...withoutArtifactHash(record),
          deepLane: Object.freeze({
            ...record.deepLane,
            status: "FAILED" as const,
            diagnostic: "deep investigation was interrupted by process restart",
            attempts: Object.freeze(attempts),
            completedAt: interruptedAt,
          }),
          outcome: Object.freeze({
            ...record.outcome,
            stage: "DEEP_UNAVAILABLE" as const,
          }),
        }));
        if ((record.deepLane.attempts?.length ?? 0) >=
          (record.lease.budget.maxDeepAttempts ?? 1)) continue;
        record = this.#persist(withArtifactHash({
          ...withoutArtifactHash(record),
          deepLane: Object.freeze({
            ...record.deepLane,
            status: "PENDING" as const,
            reason: "PENDING_DEEP_LANE" as const,
            runId: null,
            proposalIds: Object.freeze([]),
            evidenceGaps: Object.freeze([]),
            diagnostic: null,
            completedAt: null,
          }),
          outcome: Object.freeze({
            ...record.outcome,
            proposalCount: 0,
            evidenceGapCount: 0,
            stage: "FAST_COMPLETE" as const,
          }),
        }));
      }
      promises.push(this.#launchDeep(snapshot, record));
    }
    return Object.freeze(promises);
  }

  #skippedDeep(
    reason: SearchLeaseDeepLane["reason"],
    diagnostic: string | null = null,
  ): SearchLeaseDeepLane {
    return Object.freeze({
      status: "NOT_RUN",
      reason,
      runId: null,
      proposalIds: Object.freeze([]),
      evidenceGaps: Object.freeze([]),
      diagnostic,
      inputIdentity: null,
      attempts: Object.freeze([]),
      completedAt: null,
      permittedTools: READ_ONLY_TOOLS,
      toolExecutionTraceStored: false,
    });
  }

  #contextFeedback(issued: SearchLeaseRecord): SearchLeaseContextFeedback {
    const issueId = issued.lease.issueId ?? null;
    if (issueId === null) {
      return Object.freeze({
        issueId,
        completedSemanticScopeIdentities: Object.freeze([]),
        attemptedRoutingScopeIdentities: Object.freeze([]),
        authority: "SEARCH_ROUTING_ONLY" as const,
      });
    }
    const terminalScopes = this.#records.filter((record) =>
      record.lease.issueId === issueId &&
      record.lease.leaseId !== issued.lease.leaseId &&
      record.status === "PASS" &&
      record.fastLane.semanticScope !== undefined
    );
    const completedReasons = new Set<SearchLeaseDeepLane["reason"]>([
      "NO_CANDIDATES",
      "NOT_MULTI_LISTING",
      "DUPLICATE",
      "NO_POLICY_MATCH",
      "NOVEL_MULTI_LISTING",
      "NOVEL_MULTI_VENUE",
    ]);
    return Object.freeze({
      issueId,
      completedSemanticScopeIdentities: Object.freeze([
        ...new Set(
          terminalScopes
            .filter((record) => completedReasons.has(record.deepLane.reason))
            .map((record) => record.fastLane.semanticScope!.semanticScopeIdentity),
        ),
      ].sort()),
      attemptedRoutingScopeIdentities: Object.freeze([
        ...new Set(
          terminalScopes.map(
            (record) => record.fastLane.semanticScope!.routingScopeIdentity,
          ),
        ),
      ].sort()),
      authority: "SEARCH_ROUTING_ONLY" as const,
    });
  }

  #nextLens(snapshot: MarketCorpusSnapshot): SearchLens | null {
    const resumable = this.#records.find(
      (record) =>
        record.lease.algorithmVersion === ALGORITHM_VERSION &&
        record.status === "ISSUED" &&
        (record.lease.issueId === undefined || record.lease.issueId === null) &&
        record.lease.snapshotIdentity === snapshot.snapshotIdentity,
    );
    if (resumable !== undefined) return resumable.lease.lens;
    return SEARCH_LENSES.find(
      (lens) => !this.#records.some(
        (record) =>
          record.lease.algorithmVersion === ALGORITHM_VERSION &&
          (record.lease.issueId === undefined || record.lease.issueId === null) &&
          record.lease.snapshotIdentity === snapshot.snapshotIdentity &&
          record.lease.lens === lens,
      ),
    ) ?? null;
  }

  #persist(record: SearchLeaseRecord): SearchLeaseRecord {
    const validated = assertSearchLeaseRecord(record);
    const stored = this.#store?.saveSearchLeaseRecord(validated, this.#retentionLimit) ?? validated;
    const index = this.#records.findIndex((item) => item.lease.leaseId === stored.lease.leaseId);
    if (index >= 0) this.#records.splice(index, 1);
    this.#records.unshift(stored);
    if (this.#records.length > this.#retentionLimit) {
      const protectedIds = new Set(this.#records.filter((item) =>
        item.status === "ISSUED" || item.deepLane.status === "PENDING" ||
        item.deepLane.status === "RUNNING"
      ).map((item) => item.lease.leaseId));
      let terminalSlots = Math.max(0, this.#retentionLimit - protectedIds.size);
      const retained = this.#records.filter((item) => {
        if (protectedIds.has(item.lease.leaseId)) return true;
        if (terminalSlots <= 0) return false;
        terminalSlots -= 1;
        return true;
      });
      this.#records.splice(0, this.#records.length, ...retained);
    }
    this.#onRecordChange?.(stored);
    return stored;
  }

  public projection(): SearchLeaseSchedulerProjection {
    const records = Object.freeze([...this.#records]);
    const issued = records.filter((record) => record.status === "ISSUED");
    const activeLeaseIds = new Set([
      ...this.#active.keys(),
      ...this.#activeDeep.keys(),
      ...this.#queuedDeep.keys(),
    ]);
    const recoverableIssuedCount = issued.filter((record) =>
      this.#store?.hasSearchLeaseCorpus(record.lease.snapshotIdentity) === true
    ).length;
    return Object.freeze({
      schemaVersion: "pmh.search-lease-scheduler.v1",
      algorithmVersion: ALGORITHM_VERSION,
      enabled: this.intervalMs !== null,
      configured: Object.freeze({ fastLane: true, deepLane: this.#runDeep !== undefined }),
      status: this.#active.size === 0 && this.#activeDeep.size === 0 &&
          this.#queuedDeep.size === 0
        ? "IDLE"
        : "RUNNING",
      activeCount: activeLeaseIds.size,
      activeFastCount: this.#active.size,
      activeDeepCount: this.#activeDeep.size,
      queuedDeepCount: this.#queuedDeep.size,
      concurrencyLimit: this.#concurrencyLimit,
      deepConcurrencyLimit: this.#deepConcurrencyLimit,
      intervalMs: this.intervalMs,
      retentionLimit: this.#retentionLimit,
      lensOrder: SEARCH_LENSES,
      budget: this.#budget,
      runCount: records.filter((record) =>
        record.status !== "ISSUED" && record.outcome.stage !== "RECOVERY_EXPIRED"
      ).length,
      passCount: records.filter((record) => record.status === "PASS").length,
      failedCount: records.filter((record) =>
        record.status === "FAILED" && record.outcome.stage !== "RECOVERY_EXPIRED"
      ).length,
      issuedCount: records.filter((record) => record.status === "ISSUED").length,
      duplicateCount: records.filter((record) => record.lineage.duplicateOfLeaseId !== null).length,
      piEscalationCount: records.reduce(
        (sum, record) => sum + Math.max(
          record.deepLane.attempts?.length ?? 0,
          record.deepLane.runId === null ? 0 : 1,
        ),
        0,
      ),
      deepPendingCount: records.filter((record) =>
        record.deepLane.status === "PENDING" || record.deepLane.status === "RUNNING"
      ).length,
      deepPassCount: records.filter((record) => record.deepLane.status === "PASS").length,
      deepFailedCount: records.filter((record) => record.deepLane.status === "FAILED").length,
      deepRetryCount: records.reduce(
        (sum, record) => sum + Math.max(0, (record.deepLane.attempts?.length ?? 1) - 1),
        0,
      ),
      preservedFastResultCount: records.filter((record) =>
        record.status === "PASS" && record.fastLane.status === "PASS" &&
        record.deepLane.status === "FAILED"
      ).length,
      expiredRecoveryCount: records.filter(
        (record) => record.outcome.stage === "RECOVERY_EXPIRED",
      ).length,
      retainedCorpusCount: this.#store?.countSearchLeaseCorpora() ?? 0,
      recoverableIssuedCount,
      missingCorpusIssuedCount: issued.length - recoverableIssuedCount,
      storage: this.#store?.searchLeaseStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false as const,
        schemaVersion: 0,
        idempotencyKey: "leaseId" as const,
      }),
      corpusStorage: this.#store?.searchLeaseCorpusStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false as const,
        schemaVersion: 0,
        idempotencyKey: "snapshotIdentity" as const,
      }),
      records,
      authority: "PROPOSE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({ externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false }),
    });
  }
}

export function parseSearchLeaseInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_SEARCH_LEASE_INTERVAL_MS?.trim() ||
    environment.PMH_ARCHAEOLOGIST_INTERVAL_MS?.trim() || "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 60_000 || value > 86_400_000) {
    throw new Error("PMH_SEARCH_LEASE_INTERVAL_MS must be 0 or an integer from 60000 to 86400000");
  }
  return value;
}

export function parseSearchLeaseStageBudget(
  environment: Readonly<Record<string, string | undefined>>,
  fallback: Readonly<{ fastDeadlineMs: number; deepDeadlineMs: number }>,
): Readonly<{
  fastDeadlineMs: number;
  deepDeadlineMs: number;
  orchestrationGraceMs: number;
  maxDeepAttempts: number;
}> {
  const integer = (
    name: string,
    fallbackValue: number,
    minimum: number,
    maximum: number,
  ) => {
    const raw = environment[name]?.trim() ?? "";
    const value = raw === "" ? fallbackValue : Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
    }
    return value;
  };
  return Object.freeze({
    // These are derived from the actual provider/process runtimes so the lease
    // cannot advertise a deadline that the worker itself does not honor.
    fastDeadlineMs: fallback.fastDeadlineMs,
    deepDeadlineMs: fallback.deepDeadlineMs,
    orchestrationGraceMs: integer(
      "PMH_SEARCH_ORCHESTRATION_GRACE_MS",
      DEFAULT_ORCHESTRATION_GRACE_MS,
      0,
      60_000,
    ),
    maxDeepAttempts: integer(
      "PMH_SEARCH_DEEP_MAX_ATTEMPTS",
      DEFAULT_MAX_DEEP_ATTEMPTS,
      1,
      5,
    ),
  });
}
