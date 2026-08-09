import { hashCanonical, type Hash } from "@pmh/domain";
import type { OpportunityLifecycleState } from "@pmh/execution";
import type { SearchSemanticFamily } from "./search-semantic-family.js";

export const SEARCH_OUTCOME_STAGES = Object.freeze([
  "PROPOSED",
  "REVIEWED",
  "OPERATOR_ACCEPTED",
  "MATERIALIZED_READY",
  "POSITIVE_SIMULATION",
  "CERTIFIED",
  "SHADOW_OBSERVED",
] as const);

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type SearchOutcomeStage = (typeof SEARCH_OUTCOME_STAGES)[number];

type IssueSource = Readonly<{
  issueId: Hash;
  familyDefinition?: Readonly<{ semanticFamily: SearchSemanticFamily }>;
}>;

type LeaseSource = Readonly<{
  artifactHash: Hash;
  status: "ISSUED" | "PASS" | "FAILED";
  completedAt: string | null;
  lease: Readonly<{ issueId?: Hash | null }>;
  fastLane?: Readonly<{
    falsificationIds?: readonly string[];
    falsificationFindingIdentities?: readonly string[];
  }>;
  deepLane: Readonly<{
    status: "NOT_RUN" | "PENDING" | "RUNNING" | "PASS" | "FAILED";
    proposalIds: readonly string[];
  }>;
}>;

type ReviewSource = Readonly<{
  reviewId: Hash;
  proposalId: Hash;
  status: "RUNNING" | "PASS" | "FAILED";
  completedAt: string | null;
  report: Readonly<{
    artifactHash: Hash;
    result: Readonly<{ missingEvidence: readonly string[] }>;
  }> | null;
}>;

type ReviewJobSource = Readonly<{
  artifactHash: Hash;
  proposalId: Hash;
  issueIds: readonly Hash[];
}>;

type LifecycleSource = Readonly<{
  cases: readonly Readonly<{
    opportunityId: string;
    discoveryKind: "AI_RELATION_PROPOSAL" | "DETERMINISTIC_SEARCH_LEAD";
    discoveryArtifactHash: Hash;
    state: OpportunityLifecycleState;
  }>[];
  semanticDecisions: readonly Readonly<{
    decisionId: Hash;
    opportunityId: string;
    decision: "ACCEPT_FOR_SIMULATION" | "REJECT";
    decidedAt: string;
  }>[];
  simulationBundles: readonly Readonly<{
    artifactHash: Hash;
    opportunityId: string;
    status:
      | "POSITIVE_SIMULATED_FLOOR"
      | "NO_POSITIVE_SIMULATED_FLOOR"
      | "INCOMPLETE_LEG_SIMULATION"
      | "MODEL_CALIBRATION_REQUIRED";
  }>[];
  exactVerifications: readonly Readonly<{
    artifactHash: Hash;
    opportunityId: string;
    status: "CERTIFIED" | "REJECTED";
  }>[];
  shadowObservations: readonly Readonly<{
    artifactHash: Hash;
    opportunityId: string;
    observedAtEpochMs: string;
    status: "MATCHED_BOUNDS" | "DIVERGED";
  }>[];
}>;

type MaterializationSource = Readonly<{
  materializationId: Hash;
  opportunityId: string;
  completedAt: string;
  status: "READY" | "BLOCKED";
}>;

type EconomicTriageSource = Readonly<{
  contentHash: Hash;
  items: readonly Readonly<{
    proposalId: Hash;
    status:
      | "POSITIVE_GROSS_HINT"
      | "NON_POSITIVE_GROSS_HINT"
      | "PRICE_UNAVAILABLE"
      | "SETTLEMENT_INELIGIBLE"
      | "EVIDENCE_UNAVAILABLE"
      | "CURRENT_CONTRACT_MISMATCH"
      | "LISTING_SCOPE_UNSUPPORTED"
      | "RELATION_UNSUPPORTED";
  }>[];
}>;

export type SearchOutcomeAttributionInput = Readonly<{
  issues: readonly IssueSource[];
  searchLeases: readonly LeaseSource[];
  semanticReviewJobs?: readonly ReviewJobSource[];
  semanticReviews: readonly ReviewSource[];
  lifecycle: LifecycleSource;
  materializations: readonly MaterializationSource[];
  proposalEconomicTriage?: EconomicTriageSource;
}>;

export type SearchOutcomeIssueAttribution = Readonly<{
  issueId: Hash;
  leaseCount: number;
  proposalCount: number;
  falsificationCount: number;
  reviewedCount: number;
  operatorAcceptedCount: number;
  operatorRejectedCount: number;
  positiveGrossHintCount: number;
  nonPositiveGrossHintCount: number;
  economicUnavailableCount: number;
  materializedReadyCount: number;
  positiveSimulationCount: number;
  certifiedCount: number;
  shadowObservedCount: number;
  pendingReviewCount: number;
  pendingOperatorDecisionCount: number;
  materializationBlockedCount: number;
  simulationBlockedCount: number;
  exactRejectedCount: number;
  shadowDivergedCount: number;
  missingEvidenceCount: number;
  operatorAcceptanceRateBps: number | null;
}>;

export type SearchOutcomeFamilyAttribution = Readonly<{
  semanticFamily: SearchSemanticFamily;
  issueCount: number;
  leaseCount: number;
  proposalCount: number;
  falsificationCount: number;
  reviewedCount: number;
  operatorAcceptedCount: number;
  operatorRejectedCount: number;
  positiveGrossHintCount: number;
  nonPositiveGrossHintCount: number;
  economicUnavailableCount: number;
  materializedReadyCount: number;
  positiveSimulationCount: number;
  certifiedCount: number;
  shadowObservedCount: number;
  pendingReviewCount: number;
  pendingOperatorDecisionCount: number;
  materializationBlockedCount: number;
  simulationBlockedCount: number;
  exactRejectedCount: number;
  shadowDivergedCount: number;
  missingEvidenceCount: number;
  operatorAcceptanceRateBps: number | null;
}>;

export type SearchOutcomeAttributionProjection = Readonly<{
  schemaVersion: "pmh.search-outcome-attribution.v3";
  attributionIdentity: Hash;
  sourceSetIdentity: Hash;
  sourceArtifactCount: number;
  measurementBasis: "DISTINCT_FINDINGS_FROM_PASSED_ISSUE_LEASES";
  issueCount: number;
  familyCount: number;
  unclassifiedIssueCount: number;
  attributedLeaseCount: number;
  attributedProposalCount: number;
  attributedFalsificationCount: number;
  totalAiProposalCount: number;
  unattributedAiProposalCount: number;
  multiIssueProposalCount: number;
  multiFamilyProposalCount: number;
  invalidProposalReferenceCount: number;
  invalidFalsificationReferenceCount: number;
  lifecycleMissingCount: number;
  attributionCoverageBps: number | null;
  stages: readonly Readonly<{
    stage: SearchOutcomeStage;
    count: number;
  }>[];
  economics: Readonly<{
    positiveGrossHintCount: number;
    nonPositiveGrossHintCount: number;
    unavailableOrUnsupportedCount: number;
  }>;
  bottlenecks: Readonly<{
    pendingReviewCount: number;
    reviewFailedCount: number;
    pendingOperatorDecisionCount: number;
    materializationBlockedCount: number;
    simulationBlockedCount: number;
    exactRejectedCount: number;
    shadowDivergedCount: number;
    missingEvidenceCount: number;
  }>;
  byIssue: readonly SearchOutcomeIssueAttribution[];
  byFamily: readonly SearchOutcomeFamilyAttribution[];
  modelConfidenceUsed: false;
  authority: "DERIVED_RESEARCH_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type EvaluationContext = Readonly<{
  reviewsByProposal: ReadonlyMap<Hash, ReviewSource>;
  decisionsByProposal: ReadonlyMap<Hash, LifecycleSource["semanticDecisions"][number]>;
  casesByProposal: ReadonlyMap<Hash, LifecycleSource["cases"][number]>;
  materializationsByProposal: ReadonlyMap<Hash, readonly MaterializationSource[]>;
  simulationsByProposal: ReadonlyMap<Hash, readonly LifecycleSource["simulationBundles"][number][]>;
  exactByProposal: ReadonlyMap<Hash, readonly LifecycleSource["exactVerifications"][number][]>;
  latestShadowByProposal: ReadonlyMap<Hash, LifecycleSource["shadowObservations"][number]>;
  economicsByProposal: ReadonlyMap<Hash, EconomicTriageSource["items"][number]>;
}>;

type ProposalEvaluation = Readonly<{
  proposed: Set<Hash>;
  reviewed: Set<Hash>;
  reviewFailed: Set<Hash>;
  accepted: Set<Hash>;
  rejected: Set<Hash>;
  materializedReady: Set<Hash>;
  materializationBlocked: Set<Hash>;
  positiveSimulation: Set<Hash>;
  simulationBlocked: Set<Hash>;
  certified: Set<Hash>;
  exactRejected: Set<Hash>;
  shadowObserved: Set<Hash>;
  shadowDiverged: Set<Hash>;
  lifecycleMissing: Set<Hash>;
  positiveGrossHint: Set<Hash>;
  nonPositiveGrossHint: Set<Hash>;
  economicUnavailable: Set<Hash>;
  missingEvidenceCount: number;
}>;

function opportunityId(proposalId: Hash): string {
  return `ai:${proposalId}`;
}

function rateBps(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.floor((numerator * 10_000) / denominator);
}

function uniqueHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

function latestBy<T>(
  values: readonly T[],
  key: (value: T) => string,
  timestamp: (value: T) => string,
  identity: (value: T) => string,
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const current = result.get(key(value));
    if (
      current === undefined ||
      timestamp(value) > timestamp(current) ||
      (timestamp(value) === timestamp(current) && identity(value) > identity(current))
    ) {
      result.set(key(value), value);
    }
  }
  return result;
}

function groupByProposal<T extends { opportunityId: string }>(
  values: readonly T[],
  knownProposalIds: ReadonlySet<Hash>,
): ReadonlyMap<Hash, readonly T[]> {
  const result = new Map<Hash, T[]>();
  for (const value of values) {
    const proposalId = value.opportunityId.startsWith("ai:")
      ? value.opportunityId.slice(3) as Hash
      : null;
    if (proposalId === null || !knownProposalIds.has(proposalId)) continue;
    const existing = result.get(proposalId) ?? [];
    existing.push(value);
    result.set(proposalId, existing);
  }
  return result;
}

function evaluate(
  proposalIds: ReadonlySet<Hash>,
  context: EvaluationContext,
): ProposalEvaluation {
  const reviewed = new Set<Hash>();
  const reviewFailed = new Set<Hash>();
  const accepted = new Set<Hash>();
  const rejected = new Set<Hash>();
  const materializedReady = new Set<Hash>();
  const materializationBlocked = new Set<Hash>();
  const positiveSimulation = new Set<Hash>();
  const simulationBlocked = new Set<Hash>();
  const certified = new Set<Hash>();
  const exactRejected = new Set<Hash>();
  const shadowObserved = new Set<Hash>();
  const shadowDiverged = new Set<Hash>();
  const lifecycleMissing = new Set<Hash>();
  const positiveGrossHint = new Set<Hash>();
  const nonPositiveGrossHint = new Set<Hash>();
  const economicUnavailable = new Set<Hash>();
  let missingEvidenceCount = 0;

  for (const proposalId of proposalIds) {
    const review = context.reviewsByProposal.get(proposalId);
    if (review?.status === "PASS" && review.report !== null) {
      reviewed.add(proposalId);
      missingEvidenceCount += review.report.result.missingEvidence.length;
    } else if (review?.status === "FAILED") {
      reviewFailed.add(proposalId);
    }
    const decision = context.decisionsByProposal.get(proposalId);
    if (decision?.decision === "ACCEPT_FOR_SIMULATION") accepted.add(proposalId);
    if (decision?.decision === "REJECT") rejected.add(proposalId);

    const materializations = context.materializationsByProposal.get(proposalId) ?? [];
    if (materializations.some((item) => item.status === "READY")) {
      materializedReady.add(proposalId);
    }
    const latestMaterialization = [...materializations].sort(
      (left, right) => right.completedAt.localeCompare(left.completedAt),
    )[0];
    if (latestMaterialization?.status === "BLOCKED") materializationBlocked.add(proposalId);

    const simulations = context.simulationsByProposal.get(proposalId) ?? [];
    if (simulations.some((item) => item.status === "POSITIVE_SIMULATED_FLOOR")) {
      positiveSimulation.add(proposalId);
    }
    const lifecycleState = context.casesByProposal.get(proposalId)?.state;
    if (lifecycleState === "AWAITING_MODEL_CALIBRATION" || lifecycleState === "REJECTED_SIMULATION") {
      simulationBlocked.add(proposalId);
    }

    const exact = context.exactByProposal.get(proposalId) ?? [];
    if (exact.some((item) => item.status === "CERTIFIED")) certified.add(proposalId);
    if (!certified.has(proposalId) && exact.some((item) => item.status === "REJECTED")) {
      exactRejected.add(proposalId);
    }

    const shadow = context.latestShadowByProposal.get(proposalId);
    if (shadow !== undefined) {
      shadowObserved.add(proposalId);
      if (shadow.status === "DIVERGED") shadowDiverged.add(proposalId);
    }
    if (!context.casesByProposal.has(proposalId)) lifecycleMissing.add(proposalId);
    const economics = context.economicsByProposal.get(proposalId);
    if (economics?.status === "POSITIVE_GROSS_HINT") {
      positiveGrossHint.add(proposalId);
    } else if (economics?.status === "NON_POSITIVE_GROSS_HINT") {
      nonPositiveGrossHint.add(proposalId);
    } else {
      economicUnavailable.add(proposalId);
    }
  }

  return Object.freeze({
    proposed: new Set(proposalIds),
    reviewed,
    reviewFailed,
    accepted,
    rejected,
    materializedReady,
    materializationBlocked,
    positiveSimulation,
    simulationBlocked,
    certified,
    exactRejected,
    shadowObserved,
    shadowDiverged,
    lifecycleMissing,
    positiveGrossHint,
    nonPositiveGrossHint,
    economicUnavailable,
    missingEvidenceCount,
  });
}

function issueSummary(
  issueId: Hash,
  leaseCount: number,
  falsificationCount: number,
  evaluation: ProposalEvaluation,
): SearchOutcomeIssueAttribution {
  const decidedCount = evaluation.accepted.size + evaluation.rejected.size;
  return Object.freeze({
    issueId,
    leaseCount,
    proposalCount: evaluation.proposed.size,
    falsificationCount,
    reviewedCount: evaluation.reviewed.size,
    operatorAcceptedCount: evaluation.accepted.size,
    operatorRejectedCount: evaluation.rejected.size,
    positiveGrossHintCount: evaluation.positiveGrossHint.size,
    nonPositiveGrossHintCount: evaluation.nonPositiveGrossHint.size,
    economicUnavailableCount: evaluation.economicUnavailable.size,
    materializedReadyCount: evaluation.materializedReady.size,
    positiveSimulationCount: evaluation.positiveSimulation.size,
    certifiedCount: evaluation.certified.size,
    shadowObservedCount: evaluation.shadowObserved.size,
    pendingReviewCount: [...evaluation.proposed].filter(
      (proposalId) => !evaluation.reviewed.has(proposalId),
    ).length,
    pendingOperatorDecisionCount: [...evaluation.reviewed].filter(
      (proposalId) => !evaluation.accepted.has(proposalId) && !evaluation.rejected.has(proposalId),
    ).length,
    materializationBlockedCount: evaluation.materializationBlocked.size,
    simulationBlockedCount: evaluation.simulationBlocked.size,
    exactRejectedCount: evaluation.exactRejected.size,
    shadowDivergedCount: evaluation.shadowDiverged.size,
    missingEvidenceCount: evaluation.missingEvidenceCount,
    operatorAcceptanceRateBps: rateBps(evaluation.accepted.size, decidedCount),
  });
}

export function buildSearchOutcomeAttribution(
  input: SearchOutcomeAttributionInput,
): SearchOutcomeAttributionProjection {
  const issueIds = new Set(input.issues.map((issue) => issue.issueId));
  const familyByIssue = new Map(input.issues.flatMap((issue) =>
    issue.familyDefinition === undefined
      ? []
      : [[issue.issueId, issue.familyDefinition.semanticFamily] as const]
  ));
  const semanticFamilies = new Set(familyByIssue.values());
  const leases = input.searchLeases.filter(
    (record) => record.lease.issueId !== null && record.lease.issueId !== undefined &&
      issueIds.has(record.lease.issueId),
  );
  const passedLeases = leases.filter(
    (record) => record.status === "PASS" && record.deepLane.status === "PASS",
  );
  const fastPassedLeases = leases.filter((record) => record.status === "PASS");
  const proposalIssues = new Map<Hash, Set<Hash>>();
  const proposalsByIssue = new Map<Hash, Set<Hash>>(
    [...issueIds].map((issueId) => [issueId, new Set<Hash>()]),
  );
  let invalidProposalReferenceCount = 0;
  let invalidFalsificationReferenceCount = 0;
  const falsificationIssues = new Map<Hash, Set<Hash>>();
  const falsificationsByIssue = new Map<Hash, Set<Hash>>(
    [...issueIds].map((issueId) => [issueId, new Set<Hash>()]),
  );
  for (const lease of fastPassedLeases) {
    const issueId = lease.lease.issueId!;
    const values = lease.fastLane?.falsificationFindingIdentities ??
      lease.fastLane?.falsificationIds ?? [];
    for (const value of values) {
      if (!HASH_PATTERN.test(value)) {
        invalidFalsificationReferenceCount += 1;
        continue;
      }
      const falsificationId = value as Hash;
      falsificationsByIssue.get(issueId)!.add(falsificationId);
      const attribution = falsificationIssues.get(falsificationId) ?? new Set<Hash>();
      attribution.add(issueId);
      falsificationIssues.set(falsificationId, attribution);
    }
  }
  for (const lease of passedLeases) {
    const issueId = lease.lease.issueId!;
    for (const proposalIdValue of lease.deepLane.proposalIds) {
      if (!HASH_PATTERN.test(proposalIdValue)) {
        invalidProposalReferenceCount += 1;
        continue;
      }
      const proposalId = proposalIdValue as Hash;
      proposalsByIssue.get(issueId)!.add(proposalId);
      const attribution = proposalIssues.get(proposalId) ?? new Set<Hash>();
      attribution.add(issueId);
      proposalIssues.set(proposalId, attribution);
    }
  }
  for (const job of input.semanticReviewJobs ?? []) {
    for (const issueId of job.issueIds) {
      if (!issueIds.has(issueId)) continue;
      proposalsByIssue.get(issueId)!.add(job.proposalId);
      const attribution = proposalIssues.get(job.proposalId) ?? new Set<Hash>();
      attribution.add(issueId);
      proposalIssues.set(job.proposalId, attribution);
    }
  }
  const proposalsByFamily = new Map<SearchSemanticFamily, Set<Hash>>(
    [...semanticFamilies].map((family) => [family, new Set<Hash>()]),
  );
  const falsificationsByFamily = new Map<SearchSemanticFamily, Set<Hash>>(
    [...semanticFamilies].map((family) => [family, new Set<Hash>()]),
  );
  for (const [proposalId, attributedIssues] of proposalIssues) {
    for (const issueId of attributedIssues) {
      const family = familyByIssue.get(issueId);
      if (family !== undefined) proposalsByFamily.get(family)!.add(proposalId);
    }
  }
  for (const [falsificationId, attributedIssues] of falsificationIssues) {
    for (const issueId of attributedIssues) {
      const family = familyByIssue.get(issueId);
      if (family !== undefined) {
        falsificationsByFamily.get(family)!.add(falsificationId);
      }
    }
  }
  const attributedProposalIds = new Set(proposalIssues.keys());
  const aiProposalIds = new Set(input.lifecycle.cases
    .filter((item) => item.discoveryKind === "AI_RELATION_PROPOSAL")
    .map((item) => item.discoveryArtifactHash));
  const knownProposalIds = new Set([...attributedProposalIds, ...aiProposalIds]);

  const reviewsByProposal = latestBy(
    input.semanticReviews,
    (item) => item.proposalId,
    (item) => item.completedAt ?? "",
    (item) => item.reviewId,
  ) as ReadonlyMap<Hash, ReviewSource>;
  const decisionsByOpportunity = latestBy(
    input.lifecycle.semanticDecisions,
    (item) => item.opportunityId,
    (item) => item.decidedAt,
    (item) => item.decisionId,
  );
  const decisionsByProposal = new Map<Hash, LifecycleSource["semanticDecisions"][number]>();
  for (const proposalId of knownProposalIds) {
    const decision = decisionsByOpportunity.get(opportunityId(proposalId));
    if (decision !== undefined) decisionsByProposal.set(proposalId, decision);
  }
  const casesByProposal = new Map<Hash, LifecycleSource["cases"][number]>();
  for (const item of input.lifecycle.cases) {
    if (item.discoveryKind === "AI_RELATION_PROPOSAL") {
      casesByProposal.set(item.discoveryArtifactHash, item);
    }
  }
  const shadowByOpportunity = latestBy(
    input.lifecycle.shadowObservations,
    (item) => item.opportunityId,
    (item) => item.observedAtEpochMs.padStart(32, "0"),
    (item) => item.artifactHash,
  );
  const latestShadowByProposal = new Map<Hash, LifecycleSource["shadowObservations"][number]>();
  for (const proposalId of knownProposalIds) {
    const shadow = shadowByOpportunity.get(opportunityId(proposalId));
    if (shadow !== undefined) latestShadowByProposal.set(proposalId, shadow);
  }
  const context: EvaluationContext = Object.freeze({
    reviewsByProposal,
    decisionsByProposal,
    casesByProposal,
    materializationsByProposal: groupByProposal(input.materializations, knownProposalIds),
    simulationsByProposal: groupByProposal(input.lifecycle.simulationBundles, knownProposalIds),
    exactByProposal: groupByProposal(input.lifecycle.exactVerifications, knownProposalIds),
    latestShadowByProposal,
    economicsByProposal: new Map(
      (input.proposalEconomicTriage?.items ?? []).map((item) =>
        [item.proposalId, item] as const
      ),
    ),
  });
  const overall = evaluate(attributedProposalIds, context);
  const byIssue = Object.freeze([...issueIds].sort().map((issueId) => issueSummary(
    issueId,
    leases.filter((record) => record.lease.issueId === issueId).length,
    falsificationsByIssue.get(issueId)?.size ?? 0,
    evaluate(proposalsByIssue.get(issueId) ?? new Set<Hash>(), context),
  )));
  const byFamily = Object.freeze([...semanticFamilies].sort().map((semanticFamily) => {
    const familyIssueIds = new Set([...familyByIssue.entries()].flatMap(([issueId, family]) =>
      family === semanticFamily ? [issueId] : []
    ));
    const summary = issueSummary(
      [...familyIssueIds].sort()[0] ?? hashCanonical({ semanticFamily }),
      leases.filter((record) => record.lease.issueId !== null &&
        record.lease.issueId !== undefined && familyIssueIds.has(record.lease.issueId)).length,
      falsificationsByFamily.get(semanticFamily)?.size ?? 0,
      evaluate(proposalsByFamily.get(semanticFamily) ?? new Set<Hash>(), context),
    );
    const { issueId: _issueId, ...metrics } = summary;
    return Object.freeze({
      semanticFamily,
      issueCount: familyIssueIds.size,
      ...metrics,
    });
  }));
  const attributedOpportunityIds = new Set(
    [...attributedProposalIds].map(opportunityId),
  );
  const sourceArtifactHashes = uniqueHashes([
    ...leases.map((item) => item.artifactHash),
    ...(input.semanticReviewJobs ?? []).map((item) => item.artifactHash),
    ...input.lifecycle.cases
      .filter((item) => item.discoveryKind === "AI_RELATION_PROPOSAL")
      .map((item) => item.discoveryArtifactHash),
    ...input.semanticReviews
      .filter((item) => attributedProposalIds.has(item.proposalId))
      .map((item) => item.report?.artifactHash ?? item.reviewId),
    ...input.lifecycle.semanticDecisions
      .filter((item) => attributedOpportunityIds.has(item.opportunityId))
      .map((item) => item.decisionId),
    ...input.materializations
      .filter((item) => attributedOpportunityIds.has(item.opportunityId))
      .map((item) => item.materializationId),
    ...input.lifecycle.simulationBundles
      .filter((item) => attributedOpportunityIds.has(item.opportunityId))
      .map((item) => item.artifactHash),
    ...input.lifecycle.exactVerifications
      .filter((item) => attributedOpportunityIds.has(item.opportunityId))
      .map((item) => item.artifactHash),
    ...input.lifecycle.shadowObservations
      .filter((item) => attributedOpportunityIds.has(item.opportunityId))
      .map((item) => item.artifactHash),
    ...(input.proposalEconomicTriage === undefined
      ? []
      : [input.proposalEconomicTriage.contentHash]),
  ]);
  const stages = Object.freeze([
    Object.freeze({ stage: "PROPOSED" as const, count: overall.proposed.size }),
    Object.freeze({ stage: "REVIEWED" as const, count: overall.reviewed.size }),
    Object.freeze({ stage: "OPERATOR_ACCEPTED" as const, count: overall.accepted.size }),
    Object.freeze({ stage: "MATERIALIZED_READY" as const, count: overall.materializedReady.size }),
    Object.freeze({ stage: "POSITIVE_SIMULATION" as const, count: overall.positiveSimulation.size }),
    Object.freeze({ stage: "CERTIFIED" as const, count: overall.certified.size }),
    Object.freeze({ stage: "SHADOW_OBSERVED" as const, count: overall.shadowObserved.size }),
  ]);
  const bottlenecks = Object.freeze({
    pendingReviewCount: [...overall.proposed].filter(
      (proposalId) => !overall.reviewed.has(proposalId),
    ).length,
    reviewFailedCount: overall.reviewFailed.size,
    pendingOperatorDecisionCount: [...overall.reviewed].filter(
      (proposalId) => !overall.accepted.has(proposalId) && !overall.rejected.has(proposalId),
    ).length,
    materializationBlockedCount: overall.materializationBlocked.size,
    simulationBlockedCount: overall.simulationBlocked.size,
    exactRejectedCount: overall.exactRejected.size,
    shadowDivergedCount: overall.shadowDiverged.size,
    missingEvidenceCount: overall.missingEvidenceCount,
  });
  const economics = Object.freeze({
    positiveGrossHintCount: overall.positiveGrossHint.size,
    nonPositiveGrossHintCount: overall.nonPositiveGrossHint.size,
    unavailableOrUnsupportedCount: overall.economicUnavailable.size,
  });
  const issueDefinitionSetIdentity = hashCanonical([...input.issues]
    .map((issue) => Object.freeze({
      issueId: issue.issueId,
      semanticFamily: issue.familyDefinition?.semanticFamily ?? null,
    }))
    .sort((left, right) => left.issueId.localeCompare(right.issueId)));
  const body = Object.freeze({
    schemaVersion: "pmh.search-outcome-attribution.v3" as const,
    sourceSetIdentity: hashCanonical({ sourceArtifactHashes, issueDefinitionSetIdentity }),
    sourceArtifactCount: sourceArtifactHashes.length,
    measurementBasis: "DISTINCT_FINDINGS_FROM_PASSED_ISSUE_LEASES" as const,
    issueCount: issueIds.size,
    familyCount: semanticFamilies.size,
    unclassifiedIssueCount: input.issues.filter(
      (issue) => issue.familyDefinition === undefined,
    ).length,
    attributedLeaseCount: leases.length,
    attributedProposalCount: attributedProposalIds.size,
    attributedFalsificationCount: falsificationIssues.size,
    totalAiProposalCount: aiProposalIds.size,
    unattributedAiProposalCount: [...aiProposalIds].filter(
      (proposalId) => !attributedProposalIds.has(proposalId),
    ).length,
    multiIssueProposalCount: [...proposalIssues.values()].filter(
      (attribution) => attribution.size > 1,
    ).length,
    multiFamilyProposalCount: [...proposalIssues.values()].filter((attribution) =>
      new Set([...attribution].flatMap((issueId) => {
        const family = familyByIssue.get(issueId);
        return family === undefined ? [] : [family];
      })).size > 1
    ).length,
    invalidProposalReferenceCount,
    invalidFalsificationReferenceCount,
    lifecycleMissingCount: overall.lifecycleMissing.size,
    attributionCoverageBps: rateBps(
      [...aiProposalIds].filter((proposalId) => attributedProposalIds.has(proposalId)).length,
      aiProposalIds.size,
    ),
    stages,
    economics,
    bottlenecks,
    byIssue,
    byFamily,
    modelConfidenceUsed: false as const,
    authority: "DERIVED_RESEARCH_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, attributionIdentity: hashCanonical(body) });
}
