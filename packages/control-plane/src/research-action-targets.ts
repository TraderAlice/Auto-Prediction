import { hashCanonical, type Hash } from "@pmh/domain";
import type { EvidenceAcquisitionJobRecord } from "./evidence-acquisition-scheduler.js";
import type { EvidenceRequirement, EvidenceRequirementKind } from "./evidence-requirement.js";
import { officialSourceTaskRequirementIds } from "./official-source-discovery.js";
import type { OfficialSourceDiscoveryJobRecord } from "./official-source-discovery-scheduler.js";
import type { RelationDiscoveryProposalCompilation } from "./relation-discovery-semantic-bridge.js";
import type {
  ResearchAttentionAllocationAction,
  ResearchAttentionAllocationProjection,
} from "./research-attention-allocation.js";
import type { RuleEvidenceClaimJobRecord } from "./rule-evidence-claim-scheduler.js";
import type { SemanticReviewRecord } from "./semantic-review.js";
import type { SemanticReviewJobRecord } from "./semantic-review-scheduler.js";

const MAX_TARGETS_PER_ACTION = 20;
const NEGATIVE_SOURCE_STATUSES = Object.freeze([
  "ABSTAINED",
  "NO_OFFICIAL_SOURCE_FOUND",
  "EXHAUSTED",
] as const);

export type ResearchActionTargetState =
  | "READY_RELATION_DISCOVERY"
  | "READY_OFFICIAL_SOURCE_DISCOVERY"
  | "OFFICIAL_SOURCE_DISCOVERY_IN_FLIGHT"
  | "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH"
  | "READY_EVIDENCE_ACQUISITION"
  | "EVIDENCE_ACQUISITION_IN_FLIGHT"
  | "READY_RULE_INTERPRETATION"
  | "RULE_INTERPRETATION_IN_FLIGHT"
  | "REVIEW_REENTRY_READY"
  | "REQUIREMENT_SATISFIED"
  | "NEEDS_BOUNDED_REQUIREMENT"
  | "HOLD";

export type ResearchActionDownstreamSystem =
  | "RELATION_DISCOVERY"
  | "RELATION_FALSIFICATION"
  | "OFFICIAL_SOURCE_DISCOVERY"
  | "EVIDENCE_ACQUISITION"
  | "RULE_EVIDENCE_INTERPRETATION"
  | "SEMANTIC_REVIEW"
  | "ONTOLOGY_DESIGN"
  | "UNRESOLVED";

export type ResearchActionManualOperation = Readonly<{
  available: boolean;
  kind:
    | "RELATION_DISCOVERY_TASK"
    | "OFFICIAL_SOURCE_DISCOVERY_JOB"
    | "EVIDENCE_ACQUISITION_JOB"
    | "RULE_EVIDENCE_CLAIM_JOB"
    | "NONE";
  targetId: Hash | null;
}>;

export type ResearchActionTarget = Readonly<{
  schemaVersion: "pmh.research-action-target.v1";
  targetId: Hash;
  allocationActionId: Hash;
  allocationActionKind: ResearchAttentionAllocationAction["kind"];
  workItemId: Hash | null;
  proposalId: Hash | null;
  semanticReviewJobId: Hash | null;
  requirementId: Hash | null;
  requirementKind: EvidenceRequirementKind | null;
  acquisitionRoute: EvidenceRequirement["acquisitionRoute"] | null;
  downstreamSystem: ResearchActionDownstreamSystem;
  state: ResearchActionTargetState;
  sourceTaskId: Hash | null;
  currentJobId: Hash | null;
  currentJobStatus: string | null;
  priorNegativeJobIds: readonly Hash[];
  exactArtifactRefs: readonly Hash[];
  retainedCost: Readonly<{
    providerRequestCount: number;
    toolCallCount: number;
    fetchAttemptCount: number;
    interpretationAttemptCount: number;
  }>;
  manualOperation: ResearchActionManualOperation;
  noveltyGate:
    | "NOT_REQUIRED"
    | "NEW_OFFICIAL_SOURCE_TASK_IDENTITY"
    | "NEW_ALLOWED_OFFICIAL_SURFACE_OR_OPERATOR_SOURCE"
    | "STRUCTURED_REQUIREMENT_REQUIRED"
    | "DOWNSTREAM_TARGET_NOT_MATERIALIZED";
  diagnostic: string;
  authority: "RESEARCH_ROUTING_PROPOSAL_ONLY";
  automaticDispatch: false;
  modelInvocationAuthority: false;
  providerRequestAuthority: false;
  fetchAuthority: false;
  campaignAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResearchActionTargetProjection = Readonly<{
  schemaVersion: "pmh.research-action-target-projection.v1";
  projectionIdentity: Hash;
  allocationProjectionIdentity: Hash;
  selectedActionCount: number;
  targetCount: number;
  readyCount: number;
  inFlightCount: number;
  blockedNegativeSearchCount: number;
  unresolvedCount: number;
  truncatedActionCount: number;
  targets: readonly ResearchActionTarget[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  fetchesStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  schedulerDispatchesStartedByRead: 0;
  automaticDispatch: false;
  authority: "RESEARCH_ROUTING_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

type TargetBody = Omit<ResearchActionTarget, "targetId">;

function newest<T extends Readonly<{ updatedAt: string; jobId: Hash }>>(
  items: readonly T[],
): T | null {
  return [...items].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) || right.jobId.localeCompare(left.jobId)
  )[0] ?? null;
}

function requirementIntent(requirement: EvidenceRequirement): Hash {
  return hashCanonical({
    proposalId: requirement.proposalId,
    origin: requirement.origin,
    kind: requirement.kind,
    listingRefs: requirement.listingRefs,
    claim: requirement.claim,
    reason: requirement.reason,
    satisfyingObservation: requirement.satisfyingObservation,
    contradictingObservation: requirement.contradictingObservation,
    temporalPosture: requirement.temporalPosture,
  });
}

export function selectCurrentSemanticReviewRequirements(input: Readonly<{
  semanticReviewJobs: readonly SemanticReviewJobRecord[];
  semanticReviewRecords: readonly SemanticReviewRecord[];
  currentRequirements: readonly EvidenceRequirement[];
}>): readonly EvidenceRequirement[] {
  const latestJobByProposal = new Map<Hash, SemanticReviewJobRecord>();
  for (const job of input.semanticReviewJobs) {
    const retained = latestJobByProposal.get(job.proposalId);
    if (retained === undefined || job.updatedAt.localeCompare(retained.updatedAt) > 0 ||
      (job.updatedAt === retained.updatedAt && job.jobId.localeCompare(retained.jobId) > 0)) {
      latestJobByProposal.set(job.proposalId, job);
    }
  }
  const recordById = new Map(input.semanticReviewRecords.map((item) =>
    [item.reviewId, item] as const
  ));
  const intentByProposal = new Map<Hash, Set<Hash>>();
  for (const [proposalId, job] of latestJobByProposal) {
    const record = job.lastReviewId === null ? null : recordById.get(job.lastReviewId) ?? null;
    const requirements = record?.status === "PASS" && record.report !== null
      ? record.report.result.evidenceRequirements ?? []
      : [];
    intentByProposal.set(proposalId, new Set(requirements.map(requirementIntent)));
  }
  return Object.freeze(input.currentRequirements.filter((requirement) =>
    intentByProposal.get(requirement.proposalId)?.has(requirementIntent(requirement)) === true
  ).sort((left, right) => left.requirementId.localeCompare(right.requirementId)));
}

function uniqueHashes(items: readonly (Hash | null | undefined)[]): readonly Hash[] {
  return Object.freeze([...new Set(items.filter((item): item is Hash => item != null))].sort());
}

function manual(
  available: boolean,
  kind: ResearchActionManualOperation["kind"],
  targetId: Hash | null,
): ResearchActionManualOperation {
  return Object.freeze({ available, kind, targetId });
}

function target(body: TargetBody): ResearchActionTarget {
  return Object.freeze({ ...body, targetId: hashCanonical(body) });
}

function base(input: Readonly<{
  action: ResearchAttentionAllocationAction;
  proposalId?: Hash | null;
  semanticReviewJobId?: Hash | null;
  requirement?: EvidenceRequirement | null;
}>): Pick<TargetBody,
  "schemaVersion" | "allocationActionId" | "allocationActionKind" | "workItemId" |
  "proposalId" | "semanticReviewJobId" | "requirementId" | "requirementKind" |
  "acquisitionRoute" | "authority" | "automaticDispatch" |
  "modelInvocationAuthority" | "providerRequestAuthority" | "fetchAuthority" |
  "campaignAuthority" | "semanticDecisionAuthority" | "certificateAuthority" |
  "executionAuthority" | "externalWriteAuthority" | "valueMovingAuthority"> {
  return Object.freeze({
    schemaVersion: "pmh.research-action-target.v1" as const,
    allocationActionId: input.action.actionId,
    allocationActionKind: input.action.kind,
    workItemId: input.action.workItemId,
    proposalId: input.proposalId ?? null,
    semanticReviewJobId: input.semanticReviewJobId ?? null,
    requirementId: input.requirement?.requirementId ?? null,
    requirementKind: input.requirement?.kind ?? null,
    acquisitionRoute: input.requirement?.acquisitionRoute ?? null,
    authority: "RESEARCH_ROUTING_PROPOSAL_ONLY" as const,
    automaticDispatch: false as const,
    modelInvocationAuthority: false as const,
    providerRequestAuthority: false as const,
    fetchAuthority: false as const,
    campaignAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}

function unresolvedTarget(input: Readonly<{
  action: ResearchAttentionAllocationAction;
  proposalId?: Hash | null;
  semanticReviewJobId?: Hash | null;
  downstreamSystem: ResearchActionDownstreamSystem;
  state?: "NEEDS_BOUNDED_REQUIREMENT" | "HOLD";
  noveltyGate: TargetBody["noveltyGate"];
  diagnostic: string;
}>): ResearchActionTarget {
  return target({
    ...base(input),
    downstreamSystem: input.downstreamSystem,
    state: input.state ?? "HOLD",
    sourceTaskId: null,
    currentJobId: null,
    currentJobStatus: null,
    priorNegativeJobIds: Object.freeze([]),
    exactArtifactRefs: uniqueHashes([
      ...input.action.targetArtifactRefs,
      input.proposalId,
      input.semanticReviewJobId,
    ]),
    retainedCost: Object.freeze({
      providerRequestCount: 0,
      toolCallCount: 0,
      fetchAttemptCount: 0,
      interpretationAttemptCount: 0,
    }),
    manualOperation: manual(false, "NONE", null),
    noveltyGate: input.noveltyGate,
    diagnostic: input.diagnostic,
  });
}

function resolveInterpretation(input: Readonly<{
  action: ResearchAttentionAllocationAction;
  proposalId: Hash;
  semanticReviewJobId: Hash | null;
  requirement: EvidenceRequirement;
  acquisition: EvidenceAcquisitionJobRecord;
  claimJobs: readonly RuleEvidenceClaimJobRecord[];
}>): ResearchActionTarget {
  const claim = newest(input.claimJobs.filter((item) =>
    item.requirementId === input.requirement.requirementId
  ));
  const shared = {
    ...base(input),
    sourceTaskId: null,
    priorNegativeJobIds: Object.freeze([]),
    exactArtifactRefs: uniqueHashes([
      ...input.action.targetArtifactRefs,
      input.proposalId,
      input.semanticReviewJobId,
      input.requirement.requirementId,
      input.acquisition.jobId,
      claim?.jobId,
      claim?.lastClaimId,
    ]),
    retainedCost: Object.freeze({
      providerRequestCount: 0,
      toolCallCount: 0,
      fetchAttemptCount: input.acquisition.totalAttemptCount,
      interpretationAttemptCount: claim?.attemptCount ?? 0,
    }),
  } as const;
  if (claim === null || ["PENDING", "RETRY_WAIT"].includes(claim.status)) {
    return target({
      ...shared,
      downstreamSystem: "RULE_EVIDENCE_INTERPRETATION",
      state: "READY_RULE_INTERPRETATION",
      currentJobId: claim?.jobId ?? null,
      currentJobStatus: claim?.status ?? null,
      manualOperation: manual(claim !== null, "RULE_EVIDENCE_CLAIM_JOB", claim?.jobId ?? null),
      noveltyGate: claim === null ? "DOWNSTREAM_TARGET_NOT_MATERIALIZED" : "NOT_REQUIRED",
      diagnostic: claim === null
        ? "Evidence is captured but no current interpretation job is materialized"
        : "Captured evidence has a current interpretation job ready for bounded manual work",
    });
  }
  if (claim.status === "LEASED") {
    return target({
      ...shared,
      downstreamSystem: "RULE_EVIDENCE_INTERPRETATION",
      state: "RULE_INTERPRETATION_IN_FLIGHT",
      currentJobId: claim.jobId,
      currentJobStatus: claim.status,
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "NOT_REQUIRED",
      diagnostic: "The exact captured-evidence interpretation job is already leased",
    });
  }
  if (claim.status === "PASS") {
    return target({
      ...shared,
      downstreamSystem: "SEMANTIC_REVIEW",
      state: "REVIEW_REENTRY_READY",
      currentJobId: claim.jobId,
      currentJobStatus: claim.status,
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "DOWNSTREAM_TARGET_NOT_MATERIALIZED",
      diagnostic: "A terminal evidence claim exists; independent semantic review is the successor",
    });
  }
  return target({
    ...shared,
    downstreamSystem: "RULE_EVIDENCE_INTERPRETATION",
    state: "HOLD",
    currentJobId: claim.jobId,
    currentJobStatus: claim.status,
    manualOperation: manual(false, "NONE", null),
    noveltyGate: "NEW_ALLOWED_OFFICIAL_SURFACE_OR_OPERATOR_SOURCE",
    diagnostic: "Interpretation exhausted; repeating the same captured evidence is not novel",
  });
}

function resolveAcquisition(input: Readonly<{
  action: ResearchAttentionAllocationAction;
  proposalId: Hash;
  semanticReviewJobId: Hash | null;
  requirement: EvidenceRequirement;
  acquisitionJobs: readonly EvidenceAcquisitionJobRecord[];
  claimJobs: readonly RuleEvidenceClaimJobRecord[];
}>): ResearchActionTarget {
  const acquisition = newest(input.acquisitionJobs.filter((item) =>
    item.requirementIds.includes(input.requirement.requirementId)
  ));
  if (acquisition?.status === "CAPTURED") {
    return resolveInterpretation({ ...input, acquisition });
  }
  const shared = {
    ...base(input),
    downstreamSystem: "EVIDENCE_ACQUISITION" as const,
    sourceTaskId: null,
    currentJobId: acquisition?.jobId ?? null,
    currentJobStatus: acquisition?.status ?? null,
    priorNegativeJobIds: Object.freeze([]),
    exactArtifactRefs: uniqueHashes([
      ...input.action.targetArtifactRefs,
      input.proposalId,
      input.semanticReviewJobId,
      input.requirement.requirementId,
      acquisition?.jobId,
      acquisition?.lastObservationId,
    ]),
    retainedCost: Object.freeze({
      providerRequestCount: 0,
      toolCallCount: 0,
      fetchAttemptCount: acquisition?.totalAttemptCount ?? 0,
      interpretationAttemptCount: 0,
    }),
  } as const;
  if (acquisition === null) {
    return target({
      ...shared,
      state: "HOLD",
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "DOWNSTREAM_TARGET_NOT_MATERIALIZED",
      diagnostic: "The requirement is routable but no current acquisition job is materialized",
    });
  }
  if (["PENDING", "RETRY_WAIT", "STALE"].includes(acquisition.status)) {
    return target({
      ...shared,
      state: "READY_EVIDENCE_ACQUISITION",
      manualOperation: manual(true, "EVIDENCE_ACQUISITION_JOB", acquisition.jobId),
      noveltyGate: "NOT_REQUIRED",
      diagnostic: "The exact anonymous evidence-acquisition job is ready for bounded manual work",
    });
  }
  if (acquisition.status === "LEASED") {
    return target({
      ...shared,
      state: "EVIDENCE_ACQUISITION_IN_FLIGHT",
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "NOT_REQUIRED",
      diagnostic: "The exact evidence-acquisition job is already leased",
    });
  }
  return target({
    ...shared,
    state: "HOLD",
    manualOperation: manual(false, "NONE", null),
    noveltyGate: "NEW_ALLOWED_OFFICIAL_SURFACE_OR_OPERATOR_SOURCE",
    diagnostic: `Evidence acquisition is ${acquisition.status.toLowerCase()}; duplicate work is held`,
  });
}

function resolveUnsupported(input: Readonly<{
  action: ResearchAttentionAllocationAction;
  proposalId: Hash;
  semanticReviewJobId: Hash | null;
  requirement: EvidenceRequirement;
  officialJobs: readonly OfficialSourceDiscoveryJobRecord[];
}>): ResearchActionTarget {
  const matching = input.officialJobs.filter((item) =>
    officialSourceTaskRequirementIds(item.task).includes(input.requirement.requirementId)
  );
  const current = newest(matching);
  const negatives = Object.freeze(matching.filter((item) =>
    (NEGATIVE_SOURCE_STATUSES as readonly string[]).includes(item.status)
  ).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) || right.jobId.localeCompare(left.jobId)
  ));
  const sameTaskNegative = current === null ? null : negatives.find((item) =>
    item.taskId === current.taskId
  ) ?? null;
  const authoritativeJob = sameTaskNegative ?? current ?? negatives[0] ?? null;
  const shared = {
    ...base(input),
    downstreamSystem: "OFFICIAL_SOURCE_DISCOVERY" as const,
    sourceTaskId: authoritativeJob?.taskId ?? null,
    currentJobId: authoritativeJob?.jobId ?? null,
    currentJobStatus: authoritativeJob?.status ?? null,
    priorNegativeJobIds: uniqueHashes(negatives.map((item) => item.jobId)),
    exactArtifactRefs: uniqueHashes([
      ...input.action.targetArtifactRefs,
      input.proposalId,
      input.semanticReviewJobId,
      input.requirement.requirementId,
      authoritativeJob?.taskId,
      authoritativeJob?.jobId,
      ...negatives.map((item) => item.jobId),
    ]),
    retainedCost: Object.freeze({
      providerRequestCount: negatives.reduce((sum, item) => sum + item.providerRequestCount, 0),
      toolCallCount: negatives.reduce((sum, item) => sum + item.toolCallCount, 0),
      fetchAttemptCount: 0,
      interpretationAttemptCount: 0,
    }),
  } as const;
  if (sameTaskNegative !== null || (current !== null &&
      (NEGATIVE_SOURCE_STATUSES as readonly string[]).includes(current.status))) {
    return target({
      ...shared,
      state: "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH",
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "NEW_OFFICIAL_SOURCE_TASK_IDENTITY",
      diagnostic: "The same official-source task already ended with negative evidence; elapsed time is not retry novelty",
    });
  }
  if (current === null) {
    return target({
      ...shared,
      state: "HOLD",
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "DOWNSTREAM_TARGET_NOT_MATERIALIZED",
      diagnostic: "Unsupported source debt has no current official-source discovery job",
    });
  }
  if (["PENDING", "RETRY_WAIT"].includes(current.status)) {
    return target({
      ...shared,
      state: "READY_OFFICIAL_SOURCE_DISCOVERY",
      manualOperation: manual(true, "OFFICIAL_SOURCE_DISCOVERY_JOB", current.jobId),
      noveltyGate: negatives.length === 0 ? "NOT_REQUIRED" : "NEW_OFFICIAL_SOURCE_TASK_IDENTITY",
      diagnostic: negatives.length === 0
        ? "The exact official-source discovery job is ready for bounded manual work"
        : "A changed source-discovery task is ready and prior negative work remains retained",
    });
  }
  if (current.status === "LEASED") {
    return target({
      ...shared,
      state: "OFFICIAL_SOURCE_DISCOVERY_IN_FLIGHT",
      manualOperation: manual(false, "NONE", null),
      noveltyGate: "NOT_REQUIRED",
      diagnostic: "The exact official-source discovery job is already leased",
    });
  }
  return target({
    ...shared,
    state: current.status === "ADMITTED" ? "REQUIREMENT_SATISFIED" : "HOLD",
    manualOperation: manual(false, "NONE", null),
    noveltyGate: current.status === "ADMITTED"
      ? "NOT_REQUIRED"
      : "NEW_ALLOWED_OFFICIAL_SURFACE_OR_OPERATOR_SOURCE",
    diagnostic: current.status === "ADMITTED"
      ? "Official-source discovery admitted a locator; the unsupported requirement is superseded"
      : `Official-source discovery is ${current.status.toLowerCase()}`,
  });
}

function directActionTarget(action: ResearchAttentionAllocationAction): ResearchActionTarget {
  if (action.kind === "EXPLORE_NEW_FAMILY" && action.taskId !== null) {
    return target({
      ...base({ action }),
      downstreamSystem: "RELATION_DISCOVERY",
      state: "READY_RELATION_DISCOVERY",
      sourceTaskId: action.taskId,
      currentJobId: null,
      currentJobStatus: null,
      priorNegativeJobIds: Object.freeze([]),
      exactArtifactRefs: uniqueHashes([...action.targetArtifactRefs, action.taskId]),
      retainedCost: Object.freeze({
        providerRequestCount: 0,
        toolCallCount: 0,
        fetchAttemptCount: 0,
        interpretationAttemptCount: 0,
      }),
      manualOperation: manual(true, "RELATION_DISCOVERY_TASK", action.taskId),
      noveltyGate: "NOT_REQUIRED",
      diagnostic: action.diagnostic,
    });
  }
  if (action.kind === "PROPOSE_ONTOLOGY_MUTATION") {
    return unresolvedTarget({
      action,
      downstreamSystem: "ONTOLOGY_DESIGN",
      noveltyGate: "DOWNSTREAM_TARGET_NOT_MATERIALIZED",
      diagnostic: "Ontology mutation remains a proposition until a bounded mutation specimen exists",
    });
  }
  return unresolvedTarget({
    action,
    downstreamSystem: action.kind === "FALSIFY_RELATION"
      ? "RELATION_FALSIFICATION"
      : "UNRESOLVED",
    state: "NEEDS_BOUNDED_REQUIREMENT",
    noveltyGate: "STRUCTURED_REQUIREMENT_REQUIRED",
    diagnostic: "The selected action has no materialized downstream task contract",
  });
}

export function buildResearchActionTargetProjection(input: Readonly<{
  allocation: ResearchAttentionAllocationProjection;
  proposalCompilations: readonly RelationDiscoveryProposalCompilation[];
  semanticReviewJobs: readonly SemanticReviewJobRecord[];
  activeRequirements: readonly EvidenceRequirement[];
  officialSourceJobs: readonly OfficialSourceDiscoveryJobRecord[];
  acquisitionJobs: readonly EvidenceAcquisitionJobRecord[];
  claimJobs: readonly RuleEvidenceClaimJobRecord[];
}>): ResearchActionTargetProjection {
  const latestReviewByProposal = new Map<Hash, SemanticReviewJobRecord>();
  for (const job of input.semanticReviewJobs) {
    const retained = latestReviewByProposal.get(job.proposalId);
    if (retained === undefined || job.updatedAt.localeCompare(retained.updatedAt) > 0 ||
      (job.updatedAt === retained.updatedAt && job.jobId.localeCompare(retained.jobId) > 0)) {
      latestReviewByProposal.set(job.proposalId, job);
    }
  }
  const proposalsByWork = new Map<Hash, Hash[]>();
  for (const compilation of input.proposalCompilations) {
    const retained = proposalsByWork.get(compilation.origin.workItemId) ?? [];
    if (!retained.includes(compilation.proposal.proposalId)) {
      retained.push(compilation.proposal.proposalId);
    }
    proposalsByWork.set(compilation.origin.workItemId, retained);
  }
  const requirementsByProposal = new Map<Hash, EvidenceRequirement[]>();
  for (const requirement of input.activeRequirements) {
    const retained = requirementsByProposal.get(requirement.proposalId) ?? [];
    retained.push(requirement);
    requirementsByProposal.set(requirement.proposalId, retained);
  }
  let truncatedActionCount = 0;
  const targets = Object.freeze(input.allocation.portfolio.flatMap((action) => {
    if (action.kind !== "ADVANCE_RESEARCH_DEBT" || action.workItemId === null) {
      return [directActionTarget(action)];
    }
    const proposalIds = Object.freeze([...(proposalsByWork.get(action.workItemId) ?? [])].sort());
    if (proposalIds.length === 0) {
      return [unresolvedTarget({
        action,
        downstreamSystem: "UNRESOLVED",
        state: "NEEDS_BOUNDED_REQUIREMENT",
        noveltyGate: "STRUCTURED_REQUIREMENT_REQUIRED",
        diagnostic: "Research debt has no retained relation proposal lineage",
      })];
    }
    const resolved = proposalIds.flatMap((proposalId) => {
      const review = latestReviewByProposal.get(proposalId) ?? null;
      const requirements = Object.freeze([...(requirementsByProposal.get(proposalId) ?? [])]
        .sort((left, right) => left.requirementId.localeCompare(right.requirementId)));
      if (requirements.length === 0) {
        return [unresolvedTarget({
          action,
          proposalId,
          semanticReviewJobId: review?.jobId ?? null,
          downstreamSystem: "UNRESOLVED",
          state: "NEEDS_BOUNDED_REQUIREMENT",
          noveltyGate: "STRUCTURED_REQUIREMENT_REQUIRED",
          diagnostic: "The latest reviewed proposal has no active structured evidence requirement",
        })];
      }
      return requirements.map((requirement) => requirement.acquisitionRoute === "UNSUPPORTED"
        ? resolveUnsupported({
            action,
            proposalId,
            semanticReviewJobId: review?.jobId ?? null,
            requirement,
            officialJobs: input.officialSourceJobs,
          })
        : resolveAcquisition({
            action,
            proposalId,
            semanticReviewJobId: review?.jobId ?? null,
            requirement,
            acquisitionJobs: input.acquisitionJobs,
            claimJobs: input.claimJobs,
          })
      );
    });
    if (resolved.length > MAX_TARGETS_PER_ACTION) truncatedActionCount += 1;
    return resolved.slice(0, MAX_TARGETS_PER_ACTION);
  }).sort((left, right) =>
    left.allocationActionId.localeCompare(right.allocationActionId) ||
    (left.requirementId ?? "").localeCompare(right.requirementId ?? "") ||
    left.targetId.localeCompare(right.targetId)
  ));
  const readyStates: readonly ResearchActionTargetState[] = Object.freeze([
    "READY_RELATION_DISCOVERY",
    "READY_OFFICIAL_SOURCE_DISCOVERY",
    "READY_EVIDENCE_ACQUISITION",
    "READY_RULE_INTERPRETATION",
    "REVIEW_REENTRY_READY",
  ]);
  const inFlightStates: readonly ResearchActionTargetState[] = Object.freeze([
    "OFFICIAL_SOURCE_DISCOVERY_IN_FLIGHT",
    "EVIDENCE_ACQUISITION_IN_FLIGHT",
    "RULE_INTERPRETATION_IN_FLIGHT",
  ]);
  const body = Object.freeze({
    schemaVersion: "pmh.research-action-target-projection.v1" as const,
    allocationProjectionIdentity: input.allocation.projectionIdentity,
    selectedActionCount: input.allocation.portfolio.length,
    targetCount: targets.length,
    readyCount: targets.filter((item) => readyStates.includes(item.state)).length,
    inFlightCount: targets.filter((item) => inFlightStates.includes(item.state)).length,
    blockedNegativeSearchCount: targets.filter((item) =>
      item.state === "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH"
    ).length,
    unresolvedCount: targets.filter((item) =>
      ["NEEDS_BOUNDED_REQUIREMENT", "HOLD"].includes(item.state)
    ).length,
    truncatedActionCount,
    targets,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    fetchesStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    schedulerDispatchesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "RESEARCH_ROUTING_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
