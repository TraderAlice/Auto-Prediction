import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  SEARCH_LENSES,
  isSearchCandidatePolicy,
  isGroundedNovelCandidate,
  SearchLeaseBusyError,
  SearchLeaseScheduler,
  type SearchLeaseRecord,
  type SearchLens,
  type SearchCandidatePolicy,
  type ProviderFailureCategory,
  providerTelemetryFor,
} from "./search-lease-scheduler.js";
import type { SemanticPremiseKind } from "./semantic-premise.js";
import type { OperationalStorageProjection } from "./types.js";
import {
  SEARCH_SEMANTIC_FAMILIES,
  type SearchSemanticFamily,
} from "./search-semantic-family.js";

export {
  SEARCH_SEMANTIC_FAMILIES,
  type SearchSemanticFamily,
} from "./search-semantic-family.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_RETENTION_LIMIT = 100;

export type SearchIssueFamilyDefinition = Readonly<{
  schemaVersion: "pmh.search-issue-family-definition.v1";
  semanticFamily: SearchSemanticFamily;
  intendedRelationKinds: readonly import("./market-archaeologist.js").MarketRelationKind[];
  falsifiers: readonly string[];
  expectedListingCount: Readonly<{ minimum: 2 | 3 | 4; maximum: 2 | 3 | 4 }>;
  maxCorpusListings: number;
  acceptablePremiseKinds: readonly SemanticPremiseKind[];
  definitionIdentity: Hash;
}>;

export type SearchIssueRecord = Readonly<{
  schemaVersion: "pmh.search-issue.v1" | "pmh.search-issue.v2";
  issueId: Hash;
  definitionIdentity?: Hash;
  familyDefinition?: SearchIssueFamilyDefinition;
  defaultKey?: string;
  supersededByIssueId?: Hash | null;
  candidatePolicy?: SearchCandidatePolicy | null;
  title: string;
  question: string;
  lens: SearchLens;
  venueIds: readonly string[];
  cadenceMs: number;
  priority: 1 | 2 | 3 | 4 | 5;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastLeaseId: Hash | null;
  runCount: number;
  passCount: number;
  failedCount: number;
  artifactHash: Hash;
}>;

export type SearchNotificationRecord = Readonly<{
  schemaVersion: "pmh.search-notification.v1";
  notificationId: Hash;
  dedupeIdentity: Hash;
  issueId: Hash;
  leaseId: Hash;
  kind: "NOVEL_CANDIDATE" | "FALSIFICATION_RECORDED" | "RUN_FAILED";
  status: "UNREAD" | "READ";
  title: string;
  summary: string;
  createdAt: string;
  readAt: string | null;
  artifactHash: Hash;
}>;

export interface SearchIssueRecordStore {
  readonly searchIssueStorage: OperationalStorageProjection<"issueId">;
  readonly searchNotificationStorage: OperationalStorageProjection<"notificationId">;
  loadSearchIssueRecords(limit: number): readonly SearchIssueRecord[];
  saveSearchIssueRecord(record: SearchIssueRecord): SearchIssueRecord;
  loadSearchNotificationRecords(limit: number): readonly SearchNotificationRecord[];
  saveSearchNotificationRecord(
    record: SearchNotificationRecord,
    retentionLimit: number,
  ): SearchNotificationRecord;
}

export type SearchIssueSchedulerProjection = Readonly<{
  schemaVersion: "pmh.search-issue-scheduler.v1";
  enabled: boolean;
  status: "IDLE" | "RUNNING";
  tickIntervalMs: number | null;
  concurrencyLimit: number;
  familyConcurrencyLimit: number;
  activeCount: number;
  issueCount: number;
  enabledIssueCount: number;
  defaultManagedIssueCount: number;
  supersededIssueCount: number;
  dueIssueCount: number;
  unreadNotificationCount: number;
  performance: Readonly<{
    measurementWindow: "RETAINED_TERMINAL_LEASES";
    retainedLeaseLimit: number;
    terminalLeaseCount: number;
    novelCandidateCount: number;
    duplicateCount: number;
    piEscalationCount: number;
    deepPendingCount: number;
    deepPassCount: number;
    deepFailedCount: number;
    deepRetryCount: number;
    preservedFastResultCount: number;
    expiredRecoveryCount: number;
    economicGateRequiredCount: number;
    economicGatePositiveCount: number;
    economicGateBlockedCount: number;
    piAvoidedCount: number;
    modelSelectionRequiredCount: number;
    modelSelectedCandidateCount: number;
    modelSelectionMissCount: number;
    quoteEnrichmentAttemptCount: number;
    quoteEnrichmentReadyCount: number;
    quoteEnrichmentPartialCount: number;
    quoteEnrichmentFailedCount: number;
    quoteEnrichmentRescuedGateCount: number;
    quoteObservationCount: number;
    exactSemanticScopeCount: number;
    semanticScopeRevisitCount: number;
    noLeadSemanticScopeCount: number;
    boundedSemanticScopeCount: number;
    boundedScopeRevisitCount: number;
    noLeadBoundedScopeCount: number;
    hypothesisCount: number;
    falsificationCount: number;
    proposalCount: number;
    evidenceGapCount: number;
    coverageManifestCount: number;
    degradedContextCount: number;
    degradedPassCount: number;
    insufficientCoverageFailureCount: number;
    omittedVenueCount: number;
    familyRetrievalLeaseCount: number;
    familyRetrievalNeighborhoodCount: number;
    familyRetrievalFallbackCount: number;
    agentTraceLeaseCount: number;
    agentRunCount: number;
    agentStepCount: number;
    agentToolCallCount: number;
    agentCatalogReadCount: number;
    agentAcceptedProposalEffectCount: number;
    agentRejectedProposalEffectCount: number;
    agentAcceptedFalsificationEffectCount: number;
    agentRejectedFalsificationEffectCount: number;
    agentExplicitCompletionCount: number;
    agentBudgetTerminationCount: number;
    agentFailureTerminationCount: number;
    providerRequestAttemptCount: number;
    providerFailureCount: number;
    providerFailureRateBps: number | null;
    providerNativeTelemetryLeaseCount: number;
    providerLegacyDerivedLeaseCount: number;
    providerFailuresByCategory: readonly Readonly<{
      category: ProviderFailureCategory;
      count: number;
    }>[];
    novelCandidateRateBps: number | null;
    duplicateRateBps: number | null;
    piEscalationRateBps: number | null;
    economicGatePositiveRateBps: number | null;
    byIssue: readonly Readonly<{
      issueId: Hash;
      terminalLeaseCount: number;
      novelCandidateCount: number;
      duplicateCount: number;
      piEscalationCount: number;
      familyRetrievalLeaseCount: number;
      familyRetrievalNeighborhoodCount: number;
      familyRetrievalFallbackCount: number;
      deepPendingCount: number;
      deepPassCount: number;
      deepFailedCount: number;
      deepRetryCount: number;
      preservedFastResultCount: number;
      expiredRecoveryCount: number;
      economicGateRequiredCount: number;
      economicGatePositiveCount: number;
      economicGateBlockedCount: number;
      piAvoidedCount: number;
      modelSelectionRequiredCount: number;
      modelSelectedCandidateCount: number;
      modelSelectionMissCount: number;
      quoteEnrichmentAttemptCount: number;
      quoteEnrichmentReadyCount: number;
      quoteEnrichmentPartialCount: number;
      quoteEnrichmentFailedCount: number;
      quoteEnrichmentRescuedGateCount: number;
      quoteObservationCount: number;
      exactSemanticScopeCount: number;
      semanticScopeRevisitCount: number;
      noLeadSemanticScopeCount: number;
      boundedSemanticScopeCount: number;
      boundedScopeRevisitCount: number;
      noLeadBoundedScopeCount: number;
      hypothesisCount: number;
      falsificationCount: number;
      proposalCount: number;
      evidenceGapCount: number;
      coverageManifestCount: number;
      degradedContextCount: number;
      degradedPassCount: number;
      insufficientCoverageFailureCount: number;
      omittedVenueCount: number;
      agentTraceLeaseCount: number;
      agentRunCount: number;
      agentStepCount: number;
      agentToolCallCount: number;
      agentCatalogReadCount: number;
      agentAcceptedProposalEffectCount: number;
      agentRejectedProposalEffectCount: number;
      agentAcceptedFalsificationEffectCount: number;
      agentRejectedFalsificationEffectCount: number;
      agentExplicitCompletionCount: number;
      agentBudgetTerminationCount: number;
      agentFailureTerminationCount: number;
      providerRequestAttemptCount: number;
      providerFailureCount: number;
      providerFailureRateBps: number | null;
      providerNativeTelemetryLeaseCount: number;
      providerLegacyDerivedLeaseCount: number;
      providerFailuresByCategory: readonly Readonly<{
        category: ProviderFailureCategory;
        count: number;
      }>[];
    }>[];
    byFamily: readonly Readonly<{
      semanticFamily: SearchSemanticFamily;
      issueCount: number;
      terminalLeaseCount: number;
      novelCandidateCount: number;
      proposalCount: number;
      falsificationCount: number;
      providerRequestAttemptCount: number;
      providerFailureCount: number;
      providerFailureRateBps: number | null;
      agentToolCallCount: number;
      piEscalationCount: number;
      familyRetrievalLeaseCount: number;
      familyRetrievalNeighborhoodCount: number;
      familyRetrievalFallbackCount: number;
    }>[];
  }>;
  issues: readonly SearchIssueRecord[];
  notifications: readonly SearchNotificationRecord[];
  storage: Readonly<{
    issues: OperationalStorageProjection<"issueId">;
    notifications: OperationalStorageProjection<"notificationId">;
  }>;
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

export type CreateSearchIssueInput = Readonly<{
  title: string;
  question: string;
  lens: SearchLens;
  family?: Readonly<{
    semanticFamily: SearchSemanticFamily;
    intendedRelationKinds: readonly import("./market-archaeologist.js").MarketRelationKind[];
    falsifiers: readonly string[];
    expectedListingCount: Readonly<{ minimum: 2 | 3 | 4; maximum: 2 | 3 | 4 }>;
    maxCorpusListings: number;
    acceptablePremiseKinds: readonly SemanticPremiseKind[];
  }>;
  venueIds?: readonly string[];
  cadenceMs: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  enabled?: boolean;
}>;

type SearchIssueSchedulerOptions = Readonly<{
  leaseScheduler: SearchLeaseScheduler;
  tickIntervalMs?: number | null;
  concurrencyLimit?: number;
  familyConcurrencyLimit?: number;
  retentionLimit?: number;
  store?: SearchIssueRecordStore;
  seedDefaults?: boolean;
  now?: () => number;
}>;

function isIso(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

function ratioBps(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.floor((numerator * 10_000) / denominator);
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");
}

const PREMISE_KINDS = Object.freeze([
  "SETTLEMENT_INTRINSIC",
  "TRADED_OUTCOME",
  "EXTERNAL_OBSERVATION",
  "CAUSAL_HYPOTHESIS",
] as const satisfies readonly SemanticPremiseKind[]);

function withFamilyDefinitionIdentity(
  input: Omit<SearchIssueFamilyDefinition, "schemaVersion" | "definitionIdentity">,
): SearchIssueFamilyDefinition {
  const body = Object.freeze({
    schemaVersion: "pmh.search-issue-family-definition.v1" as const,
    semanticFamily: input.semanticFamily,
    intendedRelationKinds: Object.freeze([...input.intendedRelationKinds]),
    falsifiers: Object.freeze([...input.falsifiers]),
    expectedListingCount: Object.freeze({ ...input.expectedListingCount }),
    maxCorpusListings: input.maxCorpusListings,
    acceptablePremiseKinds: Object.freeze([...input.acceptablePremiseKinds]),
  });
  return Object.freeze({ ...body, definitionIdentity: hashCanonical(body) });
}

export function assertSearchIssueFamilyDefinition(
  value: unknown,
): SearchIssueFamilyDefinition {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("search issue family definition is malformed");
  }
  const definition = value as SearchIssueFamilyDefinition;
  const { definitionIdentity, ...body } = definition;
  if (
    !exactKeys(definition, [
      "acceptablePremiseKinds", "definitionIdentity", "expectedListingCount", "falsifiers",
      "intendedRelationKinds", "maxCorpusListings", "schemaVersion", "semanticFamily",
    ]) ||
    definition.schemaVersion !== "pmh.search-issue-family-definition.v1" ||
    !SEARCH_SEMANTIC_FAMILIES.includes(definition.semanticFamily) ||
    !Array.isArray(definition.intendedRelationKinds) ||
    definition.intendedRelationKinds.length < 1 ||
    definition.intendedRelationKinds.length > 8 ||
    new Set(definition.intendedRelationKinds).size !== definition.intendedRelationKinds.length ||
    definition.intendedRelationKinds.some((kind) => ![
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "RELATED", "CONFLICTING",
    ].includes(kind)) ||
    !Array.isArray(definition.falsifiers) || definition.falsifiers.length < 1 ||
    definition.falsifiers.length > 8 ||
    definition.falsifiers.some((item) => !boundedText(item, 240)) ||
    new Set(definition.falsifiers).size !== definition.falsifiers.length ||
    definition.expectedListingCount === null ||
    typeof definition.expectedListingCount !== "object" ||
    !exactKeys(definition.expectedListingCount, ["maximum", "minimum"]) ||
    ![2, 3, 4].includes(definition.expectedListingCount.minimum) ||
    ![2, 3, 4].includes(definition.expectedListingCount.maximum) ||
    definition.expectedListingCount.minimum > definition.expectedListingCount.maximum ||
    !Number.isSafeInteger(definition.maxCorpusListings) ||
    definition.maxCorpusListings < definition.expectedListingCount.maximum ||
    definition.maxCorpusListings > 30 ||
    !Array.isArray(definition.acceptablePremiseKinds) ||
    definition.acceptablePremiseKinds.length < 1 ||
    definition.acceptablePremiseKinds.length > PREMISE_KINDS.length ||
    new Set(definition.acceptablePremiseKinds).size !==
      definition.acceptablePremiseKinds.length ||
    definition.acceptablePremiseKinds.some((kind) => !PREMISE_KINDS.includes(kind)) ||
    !HASH_PATTERN.test(String(definitionIdentity)) ||
    definitionIdentity !== hashCanonical(body)
  ) throw new Error("search issue family definition violates its bounded contract");
  return Object.freeze(definition);
}

function issueDefinitionIdentity(input: Readonly<{
  title: string;
  question: string;
  lens: SearchLens;
  venueIds: readonly string[];
  cadenceMs: number;
  priority: 1 | 2 | 3 | 4 | 5;
  candidatePolicy: SearchCandidatePolicy | null;
  familyDefinition: SearchIssueFamilyDefinition;
}>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.search-issue-definition.v1",
    title: input.title,
    question: input.question,
    lens: input.lens,
    venueIds: input.venueIds,
    cadenceMs: input.cadenceMs,
    priority: input.priority,
    candidatePolicy: input.candidatePolicy,
    familyDefinitionIdentity: input.familyDefinition.definitionIdentity,
  });
}

function summarizeLeasePerformance(records: readonly SearchLeaseRecord[]): Readonly<{
  terminalLeaseCount: number;
  novelCandidateCount: number;
  duplicateCount: number;
  piEscalationCount: number;
  deepPendingCount: number;
  deepPassCount: number;
  deepFailedCount: number;
  deepRetryCount: number;
  preservedFastResultCount: number;
  expiredRecoveryCount: number;
  economicGateRequiredCount: number;
  economicGatePositiveCount: number;
  economicGateBlockedCount: number;
  piAvoidedCount: number;
  modelSelectionRequiredCount: number;
  modelSelectedCandidateCount: number;
  modelSelectionMissCount: number;
  quoteEnrichmentAttemptCount: number;
  quoteEnrichmentReadyCount: number;
  quoteEnrichmentPartialCount: number;
  quoteEnrichmentFailedCount: number;
  quoteEnrichmentRescuedGateCount: number;
  quoteObservationCount: number;
  exactSemanticScopeCount: number;
  semanticScopeRevisitCount: number;
  noLeadSemanticScopeCount: number;
  boundedSemanticScopeCount: number;
  boundedScopeRevisitCount: number;
  noLeadBoundedScopeCount: number;
  hypothesisCount: number;
  falsificationCount: number;
  proposalCount: number;
  evidenceGapCount: number;
  coverageManifestCount: number;
  degradedContextCount: number;
  degradedPassCount: number;
  insufficientCoverageFailureCount: number;
  omittedVenueCount: number;
  familyRetrievalLeaseCount: number;
  familyRetrievalNeighborhoodCount: number;
  familyRetrievalFallbackCount: number;
  agentTraceLeaseCount: number;
  agentRunCount: number;
  agentStepCount: number;
  agentToolCallCount: number;
  agentCatalogReadCount: number;
  agentAcceptedProposalEffectCount: number;
  agentRejectedProposalEffectCount: number;
  agentAcceptedFalsificationEffectCount: number;
  agentRejectedFalsificationEffectCount: number;
  agentExplicitCompletionCount: number;
  agentBudgetTerminationCount: number;
  agentFailureTerminationCount: number;
  providerRequestAttemptCount: number;
  providerFailureCount: number;
  providerFailureRateBps: number | null;
  providerNativeTelemetryLeaseCount: number;
  providerLegacyDerivedLeaseCount: number;
  providerFailuresByCategory: readonly Readonly<{
    category: ProviderFailureCategory;
    count: number;
  }>[];
}> {
  const expiredRecoveryCount = records.filter(
    (record) => record.outcome.stage === "RECOVERY_EXPIRED",
  ).length;
  records = records.filter(
    (record) => record.outcome.stage !== "RECOVERY_EXPIRED",
  );
  const agentTelemetry = records.flatMap((record) =>
    record.fastLane.agentTelemetry === undefined
      ? []
      : [record.fastLane.agentTelemetry]
  );
  const coverageRecords = records.filter(
    (record) => record.fastLane.corpusCoverage !== undefined,
  );
  const degradedRecords = coverageRecords.filter(
    (record) => record.fastLane.corpusCoverage?.status === "DEGRADED",
  );
  const terminationCount = (reasons: readonly string[]) =>
    agentTelemetry.reduce(
      (sum, telemetry) => sum + telemetry.terminationReasons.reduce(
        (reasonSum, item) => reasonSum + (reasons.includes(item.reason) ? item.count : 0),
        0,
      ),
      0,
    );
  const providerTelemetry = records.map(providerTelemetryFor);
  const providerRequestAttemptCount = providerTelemetry.reduce(
    (sum, telemetry) => sum + telemetry.requestAttemptCount,
    0,
  );
  const providerFailures = providerTelemetry.flatMap(
    (telemetry) => telemetry.failureCategories,
  );
  const providerFailureCategoriesForRate = new Set<ProviderFailureCategory>([
    "TIMEOUT",
    "RETRYABLE_PROVIDER",
    "REJECTED_PROVIDER",
    "INVALID_PROVIDER_OUTPUT",
    "NETWORK_OR_UNKNOWN",
    "UNTYPED",
  ]);
  const attributableProviderFailures = providerFailures.filter((category) =>
    providerFailureCategoriesForRate.has(category)
  );
  const providerFailureCategories = [
    "TIMEOUT",
    "TASK_DEADLINE",
    "RETRYABLE_PROVIDER",
    "REJECTED_PROVIDER",
    "INVALID_PROVIDER_OUTPUT",
    "INVALID_MODEL_OUTPUT",
    "NETWORK_OR_UNKNOWN",
    "UNTYPED",
  ] as const satisfies readonly ProviderFailureCategory[];
  const exactScopes = records.filter(
    (record) => record.fastLane.semanticScope?.kind === "EXACT_PAIR",
  );
  const uniqueSemanticScopes = new Set(
    exactScopes.map(
      (record) =>
        `${record.lease.issueId ?? "unassigned"}:` +
        record.fastLane.semanticScope!.semanticScopeIdentity,
    ),
  );
  const boundedScopes = records.filter(
    (record) => record.fastLane.semanticScope?.kind === "BOUNDED_CONTEXT",
  );
  const uniqueBoundedScopes = new Set(
    boundedScopes.map(
      (record) =>
        `${record.lease.issueId ?? "unassigned"}:` +
        record.fastLane.semanticScope!.semanticScopeIdentity,
    ),
  );
  const noLeadReasons = [
    "NO_CANDIDATES",
    "NOT_MULTI_LISTING",
    "NO_POLICY_MATCH",
  ];
  const modelSelectionRecords = records.filter(
    (record) =>
      record.lease.candidatePolicy?.candidateSelection === "MODEL_HYPOTHESIS",
  );
  const modelSelectedRecords = modelSelectionRecords.filter((record) =>
    record.fastLane.candidateListingRefs.length ===
      record.lease.candidatePolicy?.exactListingRefCount
  );
  const quoteEnrichmentRecords = records.filter((record) => {
    const status = record.fastLane.economicGate?.quoteEnrichment?.status;
    return status !== undefined && status !== "NOT_RUN" && status !== "NOT_REQUIRED";
  });
  return Object.freeze({
    terminalLeaseCount: records.length,
    novelCandidateCount: records.filter(isGroundedNovelCandidate).length,
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
      (sum, record) => sum + Math.max(0, (record.deepLane.attempts?.length ?? 0) - 1),
      0,
    ),
    preservedFastResultCount: records.filter((record) =>
      record.status === "PASS" && record.fastLane.status === "PASS" &&
      record.deepLane.status === "FAILED"
    ).length,
    expiredRecoveryCount,
    economicGateRequiredCount: records.filter(
      (record) => record.fastLane.economicGate?.required === true,
    ).length,
    economicGatePositiveCount: records.filter(
      (record) => record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT",
    ).length,
    economicGateBlockedCount: records.filter(
      (record) => record.fastLane.economicGate?.required === true &&
        record.fastLane.economicGate.status !== "NOT_RUN" &&
        record.fastLane.economicGate.status !== "POSITIVE_GROSS_HINT",
    ).length,
    piAvoidedCount: records.filter(
      (record) => record.deepLane.reason === "ECONOMIC_GATE_BLOCKED" &&
        record.deepLane.runId === null,
    ).length,
    modelSelectionRequiredCount: modelSelectionRecords.length,
    modelSelectedCandidateCount: modelSelectedRecords.length,
    modelSelectionMissCount:
      modelSelectionRecords.length - modelSelectedRecords.length,
    quoteEnrichmentAttemptCount: quoteEnrichmentRecords.length,
    quoteEnrichmentReadyCount: quoteEnrichmentRecords.filter((record) =>
      record.fastLane.economicGate?.quoteEnrichment?.status === "READY"
    ).length,
    quoteEnrichmentPartialCount: quoteEnrichmentRecords.filter((record) =>
      record.fastLane.economicGate?.quoteEnrichment?.status === "PARTIAL"
    ).length,
    quoteEnrichmentFailedCount: quoteEnrichmentRecords.filter((record) => {
      const status = record.fastLane.economicGate?.quoteEnrichment?.status;
      return status === "FAILED" || status === "UNSUPPORTED";
    }).length,
    quoteEnrichmentRescuedGateCount: quoteEnrichmentRecords.filter((record) =>
      record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT" ||
      record.fastLane.economicGate?.status === "NON_POSITIVE_GROSS_HINT"
    ).length,
    quoteObservationCount: quoteEnrichmentRecords.reduce(
      (sum, record) => sum +
        (record.fastLane.economicGate?.quoteEnrichment?.observationIds.length ?? 0),
      0,
    ),
    exactSemanticScopeCount: uniqueSemanticScopes.size,
    semanticScopeRevisitCount: exactScopes.length - uniqueSemanticScopes.size,
    noLeadSemanticScopeCount: exactScopes.filter((record) =>
      noLeadReasons.includes(record.deepLane.reason)
    ).length,
    boundedSemanticScopeCount: uniqueBoundedScopes.size,
    boundedScopeRevisitCount: boundedScopes.length - uniqueBoundedScopes.size,
    noLeadBoundedScopeCount: boundedScopes.filter((record) =>
      noLeadReasons.includes(record.deepLane.reason)
    ).length,
    hypothesisCount: records.reduce((sum, record) => sum + record.outcome.hypothesisCount, 0),
    falsificationCount: records.reduce(
      (sum, record) => sum + (record.outcome.falsificationCount ?? 0),
      0,
    ),
    proposalCount: records.reduce((sum, record) => sum + record.outcome.proposalCount, 0),
    evidenceGapCount: records.reduce((sum, record) => sum + record.outcome.evidenceGapCount, 0),
    coverageManifestCount: coverageRecords.length,
    degradedContextCount: degradedRecords.length,
    degradedPassCount: degradedRecords.filter(
      (record) => record.status === "PASS",
    ).length,
    insufficientCoverageFailureCount: coverageRecords.filter((record) => {
      const coverage = record.fastLane.corpusCoverage!;
      return record.status === "FAILED" &&
        (coverage.eligibleVenueIds.length < coverage.minimumEligibleVenueCount ||
          coverage.contextVenueIds.length < coverage.minimumEligibleVenueCount);
    }).length,
    omittedVenueCount: degradedRecords.reduce(
      (sum, record) =>
        sum + (record.fastLane.corpusCoverage?.omittedSources.length ?? 0),
      0,
    ),
    familyRetrievalLeaseCount: records.filter(
      (record) => record.fastLane.retrievalPlan !== undefined,
    ).length,
    familyRetrievalNeighborhoodCount: records.reduce(
      (sum, record) => sum + (record.fastLane.retrievalPlan?.neighborhoodCount ?? 0),
      0,
    ),
    familyRetrievalFallbackCount: records.filter(
      (record) => record.fastLane.retrievalPlan?.selectionReason ===
        "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK",
    ).length,
    agentTraceLeaseCount: agentTelemetry.length,
    agentRunCount: agentTelemetry.reduce((sum, item) => sum + item.agentRunCount, 0),
    agentStepCount: agentTelemetry.reduce((sum, item) => sum + item.stepCount, 0),
    agentToolCallCount: agentTelemetry.reduce((sum, item) => sum + item.toolCallCount, 0),
    agentCatalogReadCount: agentTelemetry.reduce((sum, item) => sum + item.catalogReadCount, 0),
    agentAcceptedProposalEffectCount: agentTelemetry.reduce(
      (sum, item) => sum + item.acceptedProposalEffectCount,
      0,
    ),
    agentRejectedProposalEffectCount: agentTelemetry.reduce(
      (sum, item) => sum + item.rejectedProposalEffectCount,
      0,
    ),
    agentAcceptedFalsificationEffectCount: agentTelemetry.reduce(
      (sum, item) => sum + (item.acceptedFalsificationEffectCount ?? 0),
      0,
    ),
    agentRejectedFalsificationEffectCount: agentTelemetry.reduce(
      (sum, item) => sum + (item.rejectedFalsificationEffectCount ?? 0),
      0,
    ),
    agentExplicitCompletionCount: terminationCount(["EXPLICIT_COMPLETION"]),
    agentBudgetTerminationCount: terminationCount([
      "PROPOSAL_LIMIT", "STEP_LIMIT", "TOOL_CALL_LIMIT",
    ]),
    agentFailureTerminationCount: terminationCount([
      "TIMEOUT", "TASK_DEADLINE", "PROVIDER_FAILURE", "PROTOCOL_FAILURE",
    ]),
    providerRequestAttemptCount,
    providerFailureCount: attributableProviderFailures.length,
    providerFailureRateBps: ratioBps(
      attributableProviderFailures.length,
      providerRequestAttemptCount,
    ),
    providerNativeTelemetryLeaseCount: providerTelemetry.filter(
      (telemetry) => telemetry.evidenceSource === "NATIVE_WORKER_REPORTS",
    ).length,
    providerLegacyDerivedLeaseCount: providerTelemetry.filter(
      (telemetry) => telemetry.evidenceSource === "LEGACY_DERIVED",
    ).length,
    providerFailuresByCategory: Object.freeze(providerFailureCategories.map(
      (category) => Object.freeze({
        category,
        count: providerFailures.filter((failure) => failure === category).length,
      }),
    )),
  });
}

function hashRecord<T extends { artifactHash: Hash }>(record: T): Hash {
  const { artifactHash: _artifactHash, ...body } = record;
  return hashCanonical(body);
}

function withIssueHash(
  body: Omit<SearchIssueRecord, "artifactHash">,
): SearchIssueRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withNotificationHash(
  body: Omit<SearchNotificationRecord, "artifactHash">,
): SearchNotificationRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertSearchIssueRecord(value: unknown): SearchIssueRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored search issue is malformed");
  }
  const record = value as SearchIssueRecord;
  const candidatePolicy = record.candidatePolicy;
  const candidatePolicyValid = candidatePolicy === undefined || candidatePolicy === null ||
    isSearchCandidatePolicy(candidatePolicy);
  const v2 = record.schemaVersion === "pmh.search-issue.v2";
  const managementValid = record.defaultKey === undefined
    ? record.supersededByIssueId === undefined
    : v2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.defaultKey) &&
      record.defaultKey.length <= 80 &&
      (record.supersededByIssueId === null || (
        HASH_PATTERN.test(String(record.supersededByIssueId)) &&
        record.supersededByIssueId !== record.issueId &&
        record.enabled === false
      ));
  let familyValid = !v2 && record.definitionIdentity === undefined &&
    record.familyDefinition === undefined;
  if (v2) {
    try {
      const familyDefinition = assertSearchIssueFamilyDefinition(record.familyDefinition);
      familyValid = candidatePolicy !== undefined && candidatePolicy !== null &&
        HASH_PATTERN.test(String(record.definitionIdentity)) &&
        record.definitionIdentity === issueDefinitionIdentity({
          title: record.title,
          question: record.question,
          lens: record.lens,
          venueIds: record.venueIds,
          cadenceMs: record.cadenceMs,
          priority: record.priority,
          candidatePolicy,
          familyDefinition,
        }) &&
        record.issueId === hashCanonical({
          schemaVersion: "pmh.search-issue-id.v2",
          definitionIdentity: record.definitionIdentity,
        }) &&
        candidatePolicy.allowedRelationKinds.join("\n") ===
          familyDefinition.intendedRelationKinds.join("\n") &&
        candidatePolicy.minimumListingRefCount ===
          familyDefinition.expectedListingCount.minimum &&
        candidatePolicy.maximumListingRefCount ===
          familyDefinition.expectedListingCount.maximum &&
        candidatePolicy.maxCorpusListings === familyDefinition.maxCorpusListings;
    } catch {
      familyValid = false;
    }
  }
  if (
    !["pmh.search-issue.v1", "pmh.search-issue.v2"].includes(record.schemaVersion) ||
    !HASH_PATTERN.test(String(record.issueId)) ||
    !boundedText(record.title, 120) ||
    !boundedText(record.question, 1_000) ||
    !candidatePolicyValid ||
    !familyValid ||
    !managementValid ||
    !SEARCH_LENSES.includes(record.lens) ||
    !Array.isArray(record.venueIds) || record.venueIds.length > 25 ||
    record.venueIds.some((item) => !boundedText(item, 100)) ||
    new Set(record.venueIds).size !== record.venueIds.length ||
    !Number.isSafeInteger(record.cadenceMs) ||
    record.cadenceMs < 60_000 || record.cadenceMs > 604_800_000 ||
    ![1, 2, 3, 4, 5].includes(record.priority) ||
    typeof record.enabled !== "boolean" ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) || !isIso(record.nextRunAt) ||
    (record.lastStartedAt !== null && !isIso(record.lastStartedAt)) ||
    (record.lastCompletedAt !== null && !isIso(record.lastCompletedAt)) ||
    (record.lastLeaseId !== null && !HASH_PATTERN.test(String(record.lastLeaseId))) ||
    !Number.isSafeInteger(record.runCount) || record.runCount < 0 ||
    !Number.isSafeInteger(record.passCount) || record.passCount < 0 ||
    !Number.isSafeInteger(record.failedCount) || record.failedCount < 0 ||
    record.passCount + record.failedCount !== record.runCount ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashRecord(record)
  ) {
    throw new Error("stored search issue violates its bounded contract");
  }
  return Object.freeze(record);
}

export function assertSearchNotificationRecord(
  value: unknown,
): SearchNotificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored search notification is malformed");
  }
  const record = value as SearchNotificationRecord;
  if (
    record.schemaVersion !== "pmh.search-notification.v1" ||
    !HASH_PATTERN.test(String(record.notificationId)) ||
    !HASH_PATTERN.test(String(record.dedupeIdentity)) ||
    !HASH_PATTERN.test(String(record.issueId)) ||
    !HASH_PATTERN.test(String(record.leaseId)) ||
    (record.kind !== "NOVEL_CANDIDATE" &&
      record.kind !== "FALSIFICATION_RECORDED" &&
      record.kind !== "RUN_FAILED") ||
    (record.status !== "UNREAD" && record.status !== "READ") ||
    !boundedText(record.title, 160) || !boundedText(record.summary, 500) ||
    !isIso(record.createdAt) ||
    (record.readAt !== null && !isIso(record.readAt)) ||
    (record.status === "UNREAD" ? record.readAt !== null : record.readAt === null) ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    record.artifactHash !== hashRecord(record)
  ) {
    throw new Error("stored search notification violates its bounded contract");
  }
  return Object.freeze(record);
}

const DEFAULT_ISSUES = Object.freeze([
  Object.freeze({
    key: "settlement-qualified-two-leg-parity",
    title: "Settlement-qualified two-leg parity",
    lens: "EQUIVALENCE" as const,
    cadenceMs: 15 * 60_000,
    priority: 5 as const,
    question: "Find exactly two current OPEN/ACTIVE binary listings for the same payout claim with explicit settlement paths. Require exact refs, compatible outcome mappings, close windows, resolution sources, void rules, and indicative prices. Reject RELATED, trading-only/non-settlement, or wider-scope candidates. Require a deterministic positive gross catalog hint before deep investigation. Fees, depth, fillability, latency, and executable profit remain unproven. Return no hypothesis unless current contracts ground the pair.",
    candidatePolicy: Object.freeze({
      allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
      exactListingRefCount: 2,
      requirePositiveGrossHint: true,
      candidateSelection: "MODEL_HYPOTHESIS" as const,
      requireDistinctVenues: true,
    }),
  }),
  Object.freeze({
    key: "cross-venue-equivalence",
    title: "Cross-venue same claim",
    lens: "EQUIVALENCE" as const,
    cadenceMs: 15 * 60_000,
    priority: 5 as const,
    question: "Search all venues for differently worded listings that may resolve to the same real-world claim. Verify event identity, time window, outcome mapping, resolution source, and void policy; aggressively falsify title similarity.",
  }),
  Object.freeze({
    key: "logical-implication",
    title: "Implication and subset chains",
    lens: "IMPLICATION" as const,
    cadenceMs: 20 * 60_000,
    priority: 4 as const,
    question: "Search for grounded one-way implications, subsets, nested thresholds, prerequisite events, and nested time windows. State the forbidden truth assignments and do not assume the converse.",
  }),
  Object.freeze({
    key: "outcome-partitions",
    title: "Mutual exclusion and partitions",
    lens: "PARTITION" as const,
    cadenceMs: 30 * 60_000,
    priority: 3 as const,
    question: "Search for groups of markets that may be mutually exclusive or exhaustive. Test missing outcomes, boundary overlap, cancellation, postponement, and catch-all handling before proposing a partition.",
  }),
  Object.freeze({
    key: "mechanism-conflicts",
    title: "Mechanism and oracle conflicts",
    lens: "MECHANISM" as const,
    cadenceMs: 30 * 60_000,
    priority: 2 as const,
    question: "Search for apparent semantic matches whose oracle, close time, tie rule, settlement, cancellation, denomination, or market mechanism can produce divergent payouts.",
  }),
]);

const DEFAULT_FAMILY_ISSUES = Object.freeze([
  Object.freeze({
    key: "temporal-impossibility-v1",
    title: "Temporal impossibility",
    lens: "IMPLICATION" as const,
    cadenceMs: 20 * 60_000,
    priority: 5 as const,
    question: "Find contracts where one settled outcome would make a later required appearance, publication, certification, office-holding, or personal act impossible. Separate logical impossibility from merely reduced likelihood.",
    family: Object.freeze({
      semanticFamily: "TEMPORAL_IMPOSSIBILITY" as const,
      intendedRelationKinds: Object.freeze([
        "MUTUALLY_EXCLUSIVE", "IMPLIES", "CONDITIONAL", "CONFLICTING",
      ] as const),
      falsifiers: Object.freeze([
        "the earlier event need not prevent the later act",
        "the later contract permits a proxy, recording, postponement, or changed identity",
        "the settlement windows overlap differently than the titles imply",
      ]),
      expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 4 as const }),
      maxCorpusListings: 18,
      acceptablePremiseKinds: Object.freeze([
        "SETTLEMENT_INTRINSIC", "TRADED_OUTCOME", "EXTERNAL_OBSERVATION", "CAUSAL_HYPOTHESIS",
      ] as const),
    }),
  }),
  Object.freeze({
    key: "event-containment-v1",
    title: "Event containment",
    lens: "IMPLICATION" as const,
    cadenceMs: 20 * 60_000,
    priority: 4 as const,
    question: "Find narrower contracts that may imply broader contracts across thresholds, deadlines, jurisdictions, or outcome definitions. Search for counterexamples caused by wording, timing, or void rules.",
    family: Object.freeze({
      semanticFamily: "EVENT_CONTAINMENT" as const,
      intendedRelationKinds: Object.freeze(["IMPLIES", "SUBSET", "CONDITIONAL"] as const),
      falsifiers: Object.freeze([
        "the narrow event can resolve yes while the broad event resolves no",
        "different deadlines or geographic scopes break containment",
        "cancellation, tie, or void treatment creates divergent payouts",
      ]),
      expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 4 as const }),
      maxCorpusListings: 18,
      acceptablePremiseKinds: Object.freeze([
        "SETTLEMENT_INTRINSIC", "TRADED_OUTCOME", "EXTERNAL_OBSERVATION",
      ] as const),
    }),
  }),
  Object.freeze({
    key: "partition-completeness-v1",
    title: "Partition completeness",
    lens: "PARTITION" as const,
    cadenceMs: 30 * 60_000,
    priority: 4 as const,
    question: "Find two-to-four contracts that may form an exhaustive or mutually exclusive partition. Explicitly test omitted other outcomes, boundaries, ties, cancellation, and postponement.",
    family: Object.freeze({
      semanticFamily: "PARTITION_COMPLETENESS" as const,
      intendedRelationKinds: Object.freeze([
        "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE", "CONDITIONAL",
      ] as const),
      falsifiers: Object.freeze([
        "a missing other, tie, cancellation, or no-contest outcome exists",
        "numeric or temporal boundaries overlap or leave a gap",
        "venue-specific void rules prevent a shared state partition",
      ]),
      expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 4 as const }),
      maxCorpusListings: 20,
      acceptablePremiseKinds: Object.freeze([
        "SETTLEMENT_INTRINSIC", "TRADED_OUTCOME",
      ] as const),
    }),
  }),
  Object.freeze({
    key: "identity-succession-v1",
    title: "Identity and succession",
    lens: "MECHANISM" as const,
    cadenceMs: 45 * 60_000,
    priority: 3 as const,
    question: "Find contracts whose apparent shared subject can change through succession, substitution, nomination, team composition, office-holder changes, or asset renaming before settlement.",
    family: Object.freeze({
      semanticFamily: "IDENTITY_SUCCESSION" as const,
      intendedRelationKinds: Object.freeze([
        "EQUIVALENT", "IMPLIES", "CONDITIONAL", "CONFLICTING",
      ] as const),
      falsifiers: Object.freeze([
        "the contracts bind an office or team rather than the same natural person",
        "substitution or succession is allowed before settlement",
        "venue resolution sources freeze identity at different timestamps",
      ]),
      expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 4 as const }),
      maxCorpusListings: 18,
      acceptablePremiseKinds: Object.freeze([
        "SETTLEMENT_INTRINSIC", "EXTERNAL_OBSERVATION", "CAUSAL_HYPOTHESIS",
      ] as const),
    }),
  }),
  Object.freeze({
    key: "physical-co-occurrence-v1",
    title: "Physical co-occurrence",
    lens: "IMPLICATION" as const,
    cadenceMs: 45 * 60_000,
    priority: 3 as const,
    question: "Find participation, location, performance, or public-appearance contracts whose co-occurrence may be impossible only under explicit timing, identity, travel, or physical-capability premises.",
    family: Object.freeze({
      semanticFamily: "PHYSICAL_CO_OCCURRENCE" as const,
      intendedRelationKinds: Object.freeze([
        "MUTUALLY_EXCLUSIVE", "CONDITIONAL", "RELATED", "CONFLICTING",
      ] as const),
      falsifiers: Object.freeze([
        "both acts can occur at different times inside the settlement windows",
        "remote, recorded, proxy, or partial participation satisfies one contract",
        "the claimed physical limitation is causal rather than settlement-intrinsic",
      ]),
      expectedListingCount: Object.freeze({ minimum: 2 as const, maximum: 4 as const }),
      maxCorpusListings: 18,
      acceptablePremiseKinds: Object.freeze([
        "TRADED_OUTCOME", "EXTERNAL_OBSERVATION", "CAUSAL_HYPOTHESIS",
      ] as const),
    }),
  }),
]);

function searchQuestionForIssue(issue: SearchIssueRecord): string {
  if (issue.schemaVersion !== "pmh.search-issue.v2" || issue.familyDefinition === undefined) {
    return issue.question;
  }
  const family = issue.familyDefinition;
  const issueTopic = issue.question.length <= 240
    ? issue.question
    : `${issue.question.slice(0, 239)}…`;
  return [
    `Issue topic: ${issueTopic}`,
    `Semantic family ${family.semanticFamily}.`,
    `Return ${family.expectedListingCount.minimum}-${family.expectedListingCount.maximum} exact listing refs and only ${family.intendedRelationKinds.join("/")} relations.`,
    `Try to falsify first: ${family.falsifiers.join("; ")}.`,
    `Premises retained for research may be ${family.acceptablePremiseKinds.join("/")}.`,
  ].join(" ").slice(0, 500);
}

export class SearchIssueScheduler {
  readonly #issues: SearchIssueRecord[];
  readonly #notifications: SearchNotificationRecord[];
  readonly #active = new Map<Hash, Promise<SearchLeaseRecord>>();
  readonly #leaseScheduler: SearchLeaseScheduler;
  readonly #store: SearchIssueRecordStore | undefined;
  readonly #now: () => number;
  readonly #concurrencyLimit: number;
  readonly #familyConcurrencyLimit: number;
  readonly #retentionLimit: number;
  public readonly tickIntervalMs: number | null;

  public constructor(options: SearchIssueSchedulerOptions) {
    this.#leaseScheduler = options.leaseScheduler;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.#concurrencyLimit = options.concurrencyLimit ?? 3;
    this.#familyConcurrencyLimit = options.familyConcurrencyLimit ?? 1;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    this.tickIntervalMs = options.tickIntervalMs ?? null;
    if (
      !Number.isSafeInteger(this.#concurrencyLimit) ||
      this.#concurrencyLimit < 1 || this.#concurrencyLimit > 8 ||
      !Number.isSafeInteger(this.#familyConcurrencyLimit) ||
      this.#familyConcurrencyLimit < 1 || this.#familyConcurrencyLimit > 4 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 10 ||
      (this.tickIntervalMs !== null &&
        (!Number.isSafeInteger(this.tickIntervalMs) ||
          this.tickIntervalMs < 1_000 || this.tickIntervalMs > 60_000))
    ) {
      throw new Error("search issue scheduler configuration is invalid or unbounded");
    }
    this.#issues = [
      ...(this.#store?.loadSearchIssueRecords(this.#retentionLimit) ?? []),
    ].map(assertSearchIssueRecord);
    this.#notifications = [
      ...(this.#store?.loadSearchNotificationRecords(this.#retentionLimit) ?? []),
    ].map(assertSearchNotificationRecord);
    if (options.seedDefaults !== false) {
      const now = this.#now();
      for (const template of DEFAULT_ISSUES) {
        const defaultIssue = this.#defaultIssue(template, now);
        if (!this.#issues.some((issue) => issue.issueId === defaultIssue.issueId)) {
          this.#saveIssue(defaultIssue);
        } else if (
          defaultIssue.candidatePolicy !== undefined &&
          hashCanonical(this.#issues.find((issue) =>
            issue.issueId === defaultIssue.issueId
          )?.candidatePolicy ?? null) !== hashCanonical(defaultIssue.candidatePolicy)
        ) {
          const existing = this.#issues.find((issue) => issue.issueId === defaultIssue.issueId)!;
          this.#saveIssue(withIssueHash({
            ...this.#withoutIssueHash(existing),
            candidatePolicy: defaultIssue.candidatePolicy,
          }));
        }
      }
      for (const template of DEFAULT_FAMILY_ISSUES) {
        const candidate = this.#familyIssue(template, now);
        const existing = this.#issues.find((issue) => issue.issueId === candidate.issueId);
        const current = this.#saveIssue(withIssueHash({
          ...this.#withoutIssueHash(existing ?? candidate),
          defaultKey: template.key,
          supersededByIssueId: null,
          ...(existing === undefined ? {} : { updatedAt: existing.updatedAt }),
        }));
        for (const issue of [...this.#issues]) {
          if (issue.issueId === current.issueId) continue;
          const managedRevision = issue.defaultKey === template.key || (
            issue.defaultKey === undefined &&
            issue.schemaVersion === "pmh.search-issue.v2" &&
            issue.title === current.title &&
            issue.question === current.question &&
            issue.lens === current.lens &&
            issue.cadenceMs === current.cadenceMs &&
            issue.venueIds.length === 0 &&
            issue.familyDefinition?.semanticFamily ===
              current.familyDefinition?.semanticFamily &&
            issue.familyDefinition?.definitionIdentity ===
              current.familyDefinition?.definitionIdentity
          );
          if (!managedRevision || (
            issue.defaultKey === template.key &&
            issue.supersededByIssueId === current.issueId &&
            issue.enabled === false
          )) continue;
          this.#saveIssue(withIssueHash({
            ...this.#withoutIssueHash(issue),
            defaultKey: template.key,
            supersededByIssueId: current.issueId,
            enabled: false,
            updatedAt: new Date(now).toISOString(),
          }));
        }
      }
    }
  }

  #defaultIssue(
    template: (typeof DEFAULT_ISSUES)[number],
    now: number,
  ): SearchIssueRecord {
    const timestamp = new Date(now).toISOString();
    const issueId = hashCanonical({
      schemaVersion: "pmh.default-search-issue-id.v1",
      key: template.key,
    });
    return withIssueHash({
      schemaVersion: "pmh.search-issue.v1",
      issueId,
      ...("candidatePolicy" in template
        ? { candidatePolicy: template.candidatePolicy }
        : {}),
      title: template.title,
      question: template.question,
      lens: template.lens,
      venueIds: Object.freeze([]),
      cadenceMs: template.cadenceMs,
      priority: template.priority,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextRunAt: timestamp,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastLeaseId: null,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
    });
  }

  #familyIssue(
    template: (typeof DEFAULT_FAMILY_ISSUES)[number],
    now: number,
  ): SearchIssueRecord {
    return this.#buildFamilyIssue({
      title: template.title,
      question: template.question,
      lens: template.lens,
      family: template.family,
      cadenceMs: template.cadenceMs,
      priority: template.priority,
      enabled: true,
    }, now);
  }

  #buildFamilyIssue(
    input: CreateSearchIssueInput & Required<Pick<CreateSearchIssueInput, "family">>,
    now: number,
  ): SearchIssueRecord {
    const title = input.title.trim().replace(/\s+/gu, " ");
    const question = input.question.trim().replace(/\s+/gu, " ");
    const venueIds = Object.freeze([...(input.venueIds ?? [])].map((item) => item.trim()).sort());
    const priority = input.priority ?? 3;
    const familyDefinition = assertSearchIssueFamilyDefinition(withFamilyDefinitionIdentity({
      semanticFamily: input.family.semanticFamily,
      intendedRelationKinds: input.family.intendedRelationKinds,
      falsifiers: input.family.falsifiers.map((item) => item.trim().replace(/\s+/gu, " ")),
      expectedListingCount: input.family.expectedListingCount,
      maxCorpusListings: input.family.maxCorpusListings,
      acceptablePremiseKinds: input.family.acceptablePremiseKinds,
    }));
    const candidatePolicy: SearchCandidatePolicy = Object.freeze({
      allowedRelationKinds: familyDefinition.intendedRelationKinds,
      minimumListingRefCount: familyDefinition.expectedListingCount.minimum,
      maximumListingRefCount: familyDefinition.expectedListingCount.maximum,
      maxCorpusListings: familyDefinition.maxCorpusListings,
      candidateSelection: "MODEL_HYPOTHESIS" as const,
    });
    const definitionIdentity = issueDefinitionIdentity({
      title,
      question,
      lens: input.lens,
      venueIds,
      cadenceMs: input.cadenceMs,
      priority,
      candidatePolicy,
      familyDefinition,
    });
    const issueId = hashCanonical({
      schemaVersion: "pmh.search-issue-id.v2",
      definitionIdentity,
    });
    const existing = this.#issues.find((issue) => issue.issueId === issueId);
    if (existing !== undefined) return existing;
    const timestamp = new Date(now).toISOString();
    return withIssueHash({
      schemaVersion: "pmh.search-issue.v2",
      issueId,
      definitionIdentity,
      familyDefinition,
      candidatePolicy,
      title,
      question,
      lens: input.lens,
      venueIds,
      cadenceMs: input.cadenceMs,
      priority,
      enabled: input.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextRunAt: timestamp,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastLeaseId: null,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
    });
  }

  public create(input: CreateSearchIssueInput): SearchIssueRecord {
    if (input.family !== undefined) {
      return this.#saveIssue(this.#buildFamilyIssue(
        input as CreateSearchIssueInput & Required<Pick<CreateSearchIssueInput, "family">>,
        this.#now(),
      ));
    }
    const title = input.title.trim().replace(/\s+/gu, " ");
    const question = input.question.trim().replace(/\s+/gu, " ");
    const venueIds = Object.freeze([...(input.venueIds ?? [])].map((item) => item.trim()).sort());
    const now = this.#now();
    const timestamp = new Date(now).toISOString();
    const issueId = hashCanonical({
      schemaVersion: "pmh.search-issue-id.v1",
      title,
      question,
      createdAt: timestamp,
    });
    return this.#saveIssue(withIssueHash({
      schemaVersion: "pmh.search-issue.v1",
      issueId,
      title,
      question,
      lens: input.lens,
      venueIds,
      cadenceMs: input.cadenceMs,
      priority: input.priority ?? 3,
      enabled: input.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextRunAt: timestamp,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastLeaseId: null,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
    }));
  }

  public setEnabled(issueId: Hash, enabled: boolean): SearchIssueRecord {
    const issue = this.#requireIssue(issueId);
    if (enabled && issue.supersededByIssueId !== undefined &&
      issue.supersededByIssueId !== null) {
      throw new Error("superseded default search issue cannot be re-enabled");
    }
    const timestamp = new Date(this.#now()).toISOString();
    return this.#saveIssue(withIssueHash({
      ...this.#withoutIssueHash(issue),
      enabled,
      updatedAt: timestamp,
      nextRunAt: enabled ? timestamp : issue.nextRunAt,
    }));
  }

  public runNow(
    issueId: Hash,
    snapshot: MarketCorpusSnapshot,
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    return this.#dispatch(this.#requireIssue(issueId), snapshot, "OPERATOR");
  }

  public tick(snapshot: MarketCorpusSnapshot): readonly Promise<SearchLeaseRecord>[] {
    if (this.tickIntervalMs === null || snapshot.listingCount === 0) return Object.freeze([]);
    const now = this.#now();
    const abandonedRecords = [
      ...this.#leaseScheduler.failExpiredIssued(),
      ...this.#leaseScheduler.failIssuedForUnavailableSnapshots(snapshot),
    ];
    for (const abandoned of abandonedRecords) {
      const issueId = abandoned.lease.issueId;
      if (issueId === undefined || issueId === null ||
        !this.#issues.some((issue) => issue.issueId === issueId)) continue;
      this.#complete(issueId, abandoned);
      const issue = this.#requireIssue(issueId);
      this.#saveIssue(withIssueHash({
        ...this.#withoutIssueHash(issue),
        nextRunAt: new Date(now).toISOString(),
      }));
    }
    const available = this.#concurrencyLimit - this.#active.size;
    if (available <= 0) return Object.freeze([]);
    const rankedDue = this.#issues
      .filter((issue) =>
        issue.enabled &&
        (Date.parse(issue.nextRunAt) <= now || this.#hasIssuedLease(issue)) &&
        !this.#active.has(issue.issueId),
      )
      .sort((left, right) =>
        right.priority - left.priority ||
        Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt) ||
        left.issueId.localeCompare(right.issueId),
      );
    const due: SearchIssueRecord[] = [];
    const selectedByFamily = new Map<string, number>();
    const activeByFamily = new Map<string, number>();
    for (const issueId of this.#active.keys()) {
      const activeIssue = this.#issues.find((issue) => issue.issueId === issueId);
      if (activeIssue === undefined) continue;
      const key = this.#familyKey(activeIssue);
      activeByFamily.set(key, (activeByFamily.get(key) ?? 0) + 1);
    }
    for (const issue of rankedDue) {
      if (due.length >= available) break;
      const key = this.#familyKey(issue);
      if (
        (activeByFamily.get(key) ?? 0) + (selectedByFamily.get(key) ?? 0) >=
          this.#familyConcurrencyLimit
      ) continue;
      due.push(issue);
      selectedByFamily.set(key, (selectedByFamily.get(key) ?? 0) + 1);
    }
    const promises: Promise<SearchLeaseRecord>[] = [];
    for (const issue of due) {
      try {
        promises.push(this.#dispatch(issue, snapshot, "SCHEDULE").promise);
      } catch (error) {
        if (error instanceof SearchLeaseBusyError) break;
        throw error;
      }
    }
    return Object.freeze(promises);
  }

  #hasIssuedLease(issue: SearchIssueRecord): boolean {
    return this.#leaseScheduler.projection().records.some((record) =>
      record.status === "ISSUED" &&
      record.lease.issueId === issue.issueId,
    );
  }

  #familyKey(issue: SearchIssueRecord): string {
    return issue.familyDefinition?.semanticFamily ?? `UNFAMILIED:${issue.issueId}`;
  }

  #dispatch(
    issue: SearchIssueRecord,
    snapshot: MarketCorpusSnapshot,
    trigger: "OPERATOR" | "SCHEDULE",
  ): Readonly<{ promise: Promise<SearchLeaseRecord>; idempotentReplay: boolean }> {
    const active = this.#active.get(issue.issueId);
    if (active !== undefined) {
      return Object.freeze({ promise: active, idempotentReplay: true });
    }
    if (this.#active.size >= this.#concurrencyLimit) {
      throw new SearchLeaseBusyError("search issue concurrency limit is active");
    }
    const familyKey = this.#familyKey(issue);
    const activeFamilyCount = [...this.#active.keys()].filter((issueId) => {
      const activeIssue = this.#issues.find((item) => item.issueId === issueId);
      return activeIssue !== undefined && this.#familyKey(activeIssue) === familyKey;
    }).length;
    if (activeFamilyCount >= this.#familyConcurrencyLimit) {
      throw new SearchLeaseBusyError("search issue family concurrency limit is active");
    }
    const invocation = this.#leaseScheduler.resumeIssued(issue.issueId) ??
      this.#leaseScheduler.begin(
        snapshot,
        issue.lens,
        trigger,
        Object.freeze({
          issueId: issue.issueId,
          question: searchQuestionForIssue(issue),
          venueIds: issue.venueIds,
          ...(issue.familyDefinition === undefined
            ? {}
            : { semanticFamily: issue.familyDefinition.semanticFamily }),
          ...(issue.candidatePolicy === undefined
            ? {}
            : { candidatePolicy: issue.candidatePolicy }),
        }),
      );
    const startedAtMs = this.#now();
    this.#saveIssue(withIssueHash({
      ...this.#withoutIssueHash(issue),
      updatedAt: new Date(startedAtMs).toISOString(),
      nextRunAt: new Date(startedAtMs + issue.cadenceMs).toISOString(),
      lastStartedAt: new Date(startedAtMs).toISOString(),
    }));
    const promise = invocation.promise.then((record) => {
      this.#active.delete(issue.issueId);
      this.#complete(issue.issueId, record);
      return record;
    });
    this.#active.set(issue.issueId, promise);
    return Object.freeze({ promise, idempotentReplay: invocation.idempotentReplay });
  }

  #complete(issueId: Hash, lease: SearchLeaseRecord): void {
    const issue = this.#requireIssue(issueId);
    const alreadyCounted = issue.lastLeaseId === lease.lease.leaseId;
    const recoveryOnly = lease.outcome.stage === "RECOVERY_EXPIRED";
    const completedAt = lease.completedAt ?? new Date(this.#now()).toISOString();
    this.#saveIssue(withIssueHash({
      ...this.#withoutIssueHash(issue),
      updatedAt: completedAt,
      lastCompletedAt: completedAt,
      lastLeaseId: lease.lease.leaseId,
      runCount: issue.runCount + (alreadyCounted || recoveryOnly ? 0 : 1),
      passCount: issue.passCount + (!alreadyCounted && !recoveryOnly && lease.status === "PASS" ? 1 : 0),
      failedCount: issue.failedCount + (!alreadyCounted && !recoveryOnly && lease.status === "FAILED" ? 1 : 0),
    }));
    if (lease.status === "FAILED" && !recoveryOnly) {
      this.#notify(issue, lease, "RUN_FAILED", lease.lease.leaseId,
        lease.diagnostic ?? "Scheduled search failed before producing a bounded result.");
    } else if (
      isGroundedNovelCandidate(lease) &&
      lease.lineage.noveltySignature !== null
    ) {
      this.#notify(
        issue,
        lease,
        "NOVEL_CANDIDATE",
        lease.lineage.noveltySignature,
        lease.outcome.stage === "FAST_COMPLETE"
          ? `${lease.outcome.hypothesisCount} fast-lane candidate${lease.outcome.hypothesisCount === 1 ? "" : "s"} retained; the independent pi investigation is queued.`
          : `${lease.outcome.hypothesisCount} fast-lane candidate${lease.outcome.hypothesisCount === 1 ? "" : "s"}; ${lease.outcome.proposalCount} grounded deep proposal${lease.outcome.proposalCount === 1 ? "" : "s"}; ${lease.outcome.evidenceGapCount} evidence gap${lease.outcome.evidenceGapCount === 1 ? "" : "s"}.`,
      );
    } else if ((lease.fastLane.falsificationIds?.length ?? 0) > 0) {
      const falsificationIds = Object.freeze([
        ...(lease.fastLane.falsificationFindingIdentities ??
          lease.fastLane.falsificationIds!),
      ].sort());
      this.#notify(
        issue,
        lease,
        "FALSIFICATION_RECORDED",
        hashCanonical({ schemaVersion: "pmh.search-falsification-notice.v1", falsificationIds }),
        `${falsificationIds.length} inspected relation${falsificationIds.length === 1 ? " was" : "s were"} retained as negative search evidence; no proposal or Pi work was created.`,
      );
    }
  }

  #notify(
    issue: SearchIssueRecord,
    lease: SearchLeaseRecord,
    kind: SearchNotificationRecord["kind"],
    dedupeSource: Hash,
    summary: string,
  ): void {
    const dedupeIdentity = hashCanonical({
      schemaVersion: "pmh.search-notification-dedupe.v1",
      kind,
      dedupeSource,
    });
    if (this.#notifications.some((item) => item.dedupeIdentity === dedupeIdentity)) return;
    const createdAt = lease.completedAt ?? new Date(this.#now()).toISOString();
    const notificationId = hashCanonical({
      schemaVersion: "pmh.search-notification-id.v1",
      dedupeIdentity,
    });
    this.#saveNotification(withNotificationHash({
      schemaVersion: "pmh.search-notification.v1",
      notificationId,
      dedupeIdentity,
      issueId: issue.issueId,
      leaseId: lease.lease.leaseId,
      kind,
      status: "UNREAD",
      title: kind === "NOVEL_CANDIDATE"
        ? `${issue.title}: new candidate`
        : kind === "FALSIFICATION_RECORDED"
          ? `${issue.title}: relation falsified`
          : `${issue.title}: search failed`,
      summary: summary.slice(0, 500),
      createdAt,
      readAt: null,
    }));
  }

  public acknowledge(notificationId: Hash): SearchNotificationRecord {
    const notification = this.#notifications.find((item) => item.notificationId === notificationId);
    if (notification === undefined) throw new Error("search notification was not found");
    if (notification.status === "READ") return notification;
    return this.#saveNotification(withNotificationHash({
      ...this.#withoutNotificationHash(notification),
      status: "READ",
      readAt: new Date(this.#now()).toISOString(),
    }));
  }

  #requireIssue(issueId: Hash): SearchIssueRecord {
    const issue = this.#issues.find((item) => item.issueId === issueId);
    if (issue === undefined) throw new Error("search issue was not found");
    return issue;
  }

  #withoutIssueHash(record: SearchIssueRecord): Omit<SearchIssueRecord, "artifactHash"> {
    const { artifactHash: _artifactHash, ...body } = record;
    return body;
  }

  #withoutNotificationHash(
    record: SearchNotificationRecord,
  ): Omit<SearchNotificationRecord, "artifactHash"> {
    const { artifactHash: _artifactHash, ...body } = record;
    return body;
  }

  #saveIssue(record: SearchIssueRecord): SearchIssueRecord {
    const valid = assertSearchIssueRecord(record);
    const stored = this.#store?.saveSearchIssueRecord(valid) ?? valid;
    const index = this.#issues.findIndex((item) => item.issueId === stored.issueId);
    if (index >= 0) this.#issues.splice(index, 1);
    this.#issues.push(stored);
    this.#issues.sort((left, right) =>
      right.priority - left.priority || left.createdAt.localeCompare(right.createdAt),
    );
    return stored;
  }

  #saveNotification(record: SearchNotificationRecord): SearchNotificationRecord {
    const valid = assertSearchNotificationRecord(record);
    const stored = this.#store?.saveSearchNotificationRecord(valid, this.#retentionLimit) ?? valid;
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

  public projection(): SearchIssueSchedulerProjection {
    const now = this.#now();
    const issues = Object.freeze([...this.#issues]);
    const notifications = Object.freeze([...this.#notifications]);
    const leaseProjection = this.#leaseScheduler.projection();
    const terminalIssueLeases = leaseProjection.records.filter(
      (record) => record.status !== "ISSUED" && record.lease.issueId !== null &&
        record.lease.issueId !== undefined,
    );
    const performance = summarizeLeasePerformance(terminalIssueLeases);
    return Object.freeze({
      schemaVersion: "pmh.search-issue-scheduler.v1",
      enabled: this.tickIntervalMs !== null,
      status: this.#active.size === 0 ? "IDLE" : "RUNNING",
      tickIntervalMs: this.tickIntervalMs,
      concurrencyLimit: this.#concurrencyLimit,
      familyConcurrencyLimit: this.#familyConcurrencyLimit,
      activeCount: this.#active.size,
      issueCount: issues.length,
      enabledIssueCount: issues.filter((item) => item.enabled).length,
      defaultManagedIssueCount: issues.filter((item) => item.defaultKey !== undefined).length,
      supersededIssueCount: issues.filter(
        (item) => item.supersededByIssueId !== undefined && item.supersededByIssueId !== null,
      ).length,
      dueIssueCount: issues.filter(
        (item) => item.enabled && !this.#active.has(item.issueId) && (
          Date.parse(item.nextRunAt) <= now ||
          this.#leaseScheduler.projection().records.some((record) =>
            record.status === "ISSUED" && record.lease.issueId === item.issueId,
          )
        ),
      ).length,
      unreadNotificationCount: notifications.filter((item) => item.status === "UNREAD").length,
      performance: Object.freeze({
        measurementWindow: "RETAINED_TERMINAL_LEASES" as const,
        retainedLeaseLimit: leaseProjection.retentionLimit,
        ...performance,
        novelCandidateRateBps: ratioBps(
          performance.novelCandidateCount,
          performance.terminalLeaseCount,
        ),
        duplicateRateBps: ratioBps(
          performance.duplicateCount,
          performance.terminalLeaseCount,
        ),
      piEscalationRateBps: ratioBps(
        performance.piEscalationCount,
        performance.terminalLeaseCount,
      ),
      economicGatePositiveRateBps: ratioBps(
        performance.economicGatePositiveCount,
        performance.economicGateRequiredCount,
      ),
        byIssue: Object.freeze(issues.map((issue) => Object.freeze({
          issueId: issue.issueId,
          ...summarizeLeasePerformance(terminalIssueLeases.filter(
            (record) => record.lease.issueId === issue.issueId,
          )),
        }))),
        byFamily: Object.freeze(SEARCH_SEMANTIC_FAMILIES.flatMap((semanticFamily) => {
          const familyIssueIds = new Set(issues.flatMap((issue) =>
            issue.familyDefinition?.semanticFamily === semanticFamily
              ? [issue.issueId]
              : []
          ));
          if (familyIssueIds.size === 0) return [];
          const summary = summarizeLeasePerformance(terminalIssueLeases.filter(
            (record) => record.lease.issueId !== null &&
              record.lease.issueId !== undefined && familyIssueIds.has(record.lease.issueId),
          ));
          return [Object.freeze({
            semanticFamily,
            issueCount: familyIssueIds.size,
            terminalLeaseCount: summary.terminalLeaseCount,
            novelCandidateCount: summary.novelCandidateCount,
            proposalCount: summary.proposalCount,
            falsificationCount: summary.falsificationCount,
            providerRequestAttemptCount: summary.providerRequestAttemptCount,
            providerFailureCount: summary.providerFailureCount,
            providerFailureRateBps: summary.providerFailureRateBps,
            agentToolCallCount: summary.agentToolCallCount,
            piEscalationCount: summary.piEscalationCount,
            familyRetrievalLeaseCount: summary.familyRetrievalLeaseCount,
            familyRetrievalNeighborhoodCount: summary.familyRetrievalNeighborhoodCount,
            familyRetrievalFallbackCount: summary.familyRetrievalFallbackCount,
          })];
        })),
      }),
      issues,
      notifications,
      storage: Object.freeze({
        issues: this.#store?.searchIssueStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "issueId" as const,
        }),
        notifications: this.#store?.searchNotificationStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "notificationId" as const,
        }),
      }),
      authority: "PROPOSE_ONLY",
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

export function parseSearchIssueTickInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_SEARCH_ISSUE_TICK_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error("PMH_SEARCH_ISSUE_TICK_MS must be 0 or an integer from 1000 to 60000");
  }
  return value;
}
