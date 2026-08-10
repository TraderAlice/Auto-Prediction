import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProbabilityEstimationRunRecord,
  assertProbabilityEvidenceNeed,
  type ProbabilityEstimationRunRecord,
  type ProbabilityEstimatorRole,
  type ProbabilityEvidenceNeed,
} from "./probability-estimation-agent.js";
import type {
  ProbabilityEstimationJobRecord,
} from "./probability-estimation-scheduler.js";
import type {
  EvidenceAcquisitionJobRecord,
} from "./evidence-acquisition-scheduler.js";

const DEFAULT_LIMIT = 200;

export type ProbabilityEvidenceDebtStatus =
  | "EVIDENCE_CAPTURED"
  | "ACQUISITION_IN_PROGRESS"
  | "ACQUISITION_READY"
  | "ACQUISITION_ROUTE_MISSING"
  | "EXTERNAL_SOURCE_POLICY_REQUIRED";

export type ProbabilityEvidenceDebtItem = Readonly<{
  debtId: Hash;
  needId: Hash;
  needIds: readonly Hash[];
  proposalId: Hash;
  semanticConstraintArtifactHash: Hash;
  kind: ProbabilityEvidenceNeed["kind"];
  listingRefs: readonly string[];
  adverseStateIds: readonly string[];
  question: string;
  questionVariants: readonly string[];
  reason: string;
  reasonVariants: readonly string[];
  satisfyingObservation: string;
  contradictingObservation: string;
  temporalPosture: ProbabilityEvidenceNeed["temporalPosture"];
  route: ProbabilityEvidenceNeed["route"];
  status: ProbabilityEvidenceDebtStatus;
  blocking: boolean;
  runIds: readonly Hash[];
  caseIdentities: readonly Hash[];
  roles: readonly ProbabilityEstimatorRole[];
  engines: readonly string[];
  acquisitionRequirementIds: readonly Hash[];
  acquisitionJobIds: readonly Hash[];
  authority: "RESEARCH_PRIORITY_ONLY";
  fetchAuthority: false;
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type ProbabilityEvidenceDebtProjection = Readonly<{
  schemaVersion: "pmh.probability-evidence-debt.v1";
  contentHash: Hash;
  sourceRunCount: number;
  sourceNeedCount: number;
  itemCount: number;
  blockingItemCount: number;
  counts: Readonly<Record<ProbabilityEvidenceDebtStatus, number>>;
  items: readonly ProbabilityEvidenceDebtItem[];
  rankingContract: "BLOCKING_THEN_ROUTE_POSTURE_THEN_NEED_ID";
  authority: "RESEARCH_PRIORITY_ONLY";
  fetchAuthority: false;
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type DebtOccurrence = Readonly<{
  need: ProbabilityEvidenceNeed;
  run: ProbabilityEstimationRunRecord;
  blocking: boolean;
}>;

function engineLabel(run: ProbabilityEstimationRunRecord): string {
  return run.engine === undefined
    ? `DEEPSEEK/${run.model}`
    : `${run.engine.provider}/${run.engine.model}/${run.engine.reasoningEffort ?? "none"}`;
}

function routeStatus(
  needs: readonly ProbabilityEvidenceNeed[],
  jobs: readonly EvidenceAcquisitionJobRecord[],
): ProbabilityEvidenceDebtStatus {
  const first = needs[0]!;
  if (first.route !== "EVIDENCE_ACQUISITION") {
    return "EXTERNAL_SOURCE_POLICY_REQUIRED";
  }
  const requirementIds = needs.flatMap((need) =>
    need.acquisitionRequirement === null
      ? []
      : [need.acquisitionRequirement.requirementId]
  );
  if (requirementIds.length > 0 && requirementIds.every((requirementId) =>
    jobs.some((job) => job.status === "CAPTURED" &&
      job.requirements.some((requirement) => requirement.requirementId === requirementId))
  )) return "EVIDENCE_CAPTURED";
  if (jobs.some((job) => ["PENDING", "LEASED", "RETRY_WAIT"].includes(job.status))) {
    return "ACQUISITION_IN_PROGRESS";
  }
  if (needs.some((need) =>
    need.acquisitionRequirement?.acquisitionRoute === "UNSUPPORTED"
  ) ||
    jobs.some((job) => job.status === "UNSUPPORTED")) {
    return "ACQUISITION_ROUTE_MISSING";
  }
  return "ACQUISITION_READY";
}

function debtGroupId(need: ProbabilityEvidenceNeed): Hash {
  return hashCanonical({
    schemaVersion: "pmh.probability-evidence-debt-group-id.v1",
    proposalId: need.proposalId,
    semanticConstraintArtifactHash: need.semanticConstraintArtifactHash,
    kind: need.kind,
    listingRefs: need.listingRefs,
    adverseStateIds: need.adverseStateIds,
    temporalPosture: need.temporalPosture,
    route: need.route,
  });
}

const STATUS_RANK: Readonly<Record<ProbabilityEvidenceDebtStatus, number>> =
  Object.freeze({
    ACQUISITION_READY: 0,
    ACQUISITION_IN_PROGRESS: 1,
    ACQUISITION_ROUTE_MISSING: 2,
    EXTERNAL_SOURCE_POLICY_REQUIRED: 3,
    EVIDENCE_CAPTURED: 4,
  });

export function buildProbabilityEvidenceDebt(input: Readonly<{
  runs: readonly ProbabilityEstimationRunRecord[];
  estimatorJobs: readonly ProbabilityEstimationJobRecord[];
  acquisitionJobs: readonly EvidenceAcquisitionJobRecord[];
  limit?: number;
}>): ProbabilityEvidenceDebtProjection {
  const limit = input.limit ?? DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error("probability evidence debt limit is invalid or unbounded");
  }
  const runs = input.runs.map(assertProbabilityEstimationRunRecord);
  const occurrences = runs.flatMap((run) => (run.evidenceNeeds ?? []).map((rawNeed) => {
    const need = assertProbabilityEvidenceNeed(rawNeed);
    return Object.freeze({
      need,
      run,
      blocking: run.blockingEvidenceNeedIds?.includes(need.needId) ?? false,
    }) satisfies DebtOccurrence;
  }));
  const byNeed = new Map<Hash, DebtOccurrence[]>();
  for (const occurrence of occurrences) {
    const groupIdentity = debtGroupId(occurrence.need);
    const group = byNeed.get(groupIdentity) ?? [];
    group.push(occurrence);
    byNeed.set(groupIdentity, group);
  }
  const caseByRunId = new Map(input.estimatorJobs.flatMap((job) =>
    job.lastRunId === null ? [] : [[job.lastRunId, job.caseIdentity] as const]
  ));
  const items = [...byNeed.values()].map((group) => {
    const first = group[0]!;
    const need = first.need;
    const needs = Object.freeze([...new Map(group.map((occurrence) =>
      [occurrence.need.needId, occurrence.need] as const
    )).values()].sort((left, right) => left.needId.localeCompare(right.needId)));
    const requirementIds = Object.freeze([...new Set(needs.flatMap((candidate) =>
      candidate.acquisitionRequirement === null
        ? []
        : [candidate.acquisitionRequirement.requirementId]
    ))].sort()) as readonly Hash[];
    const acquisitionJobs = input.acquisitionJobs.filter((job) =>
      job.requirements.some((requirement) =>
        requirementIds.includes(requirement.requirementId)
      )
    );
    const questionVariants = Object.freeze([...new Set(needs.map((candidate) =>
      candidate.question
    ))].sort());
    const reasonVariants = Object.freeze([...new Set(needs.map((candidate) =>
      candidate.reason
    ))].sort());
    const body = Object.freeze({
      needId: need.needId,
      needIds: Object.freeze(needs.map((candidate) => candidate.needId)),
      proposalId: need.proposalId,
      semanticConstraintArtifactHash: need.semanticConstraintArtifactHash,
      kind: need.kind,
      listingRefs: need.listingRefs,
      adverseStateIds: need.adverseStateIds,
      question: need.question,
      questionVariants,
      reason: need.reason,
      reasonVariants,
      satisfyingObservation: need.satisfyingObservation,
      contradictingObservation: need.contradictingObservation,
      temporalPosture: need.temporalPosture,
      route: need.route,
      status: routeStatus(needs, acquisitionJobs),
      blocking: group.some((occurrence) => occurrence.blocking),
      runIds: Object.freeze([...new Set(group.map((occurrence) =>
        occurrence.run.runId
      ))].sort()) as readonly Hash[],
      caseIdentities: Object.freeze([...new Set(group.flatMap((occurrence) => {
        const caseIdentity = caseByRunId.get(occurrence.run.runId);
        return caseIdentity === undefined ? [] : [caseIdentity];
      }))].sort()) as readonly Hash[],
      roles: Object.freeze([...new Set(group.map((occurrence) =>
        occurrence.run.role
      ))].sort()) as readonly ProbabilityEstimatorRole[],
      engines: Object.freeze([...new Set(group.map((occurrence) =>
        engineLabel(occurrence.run)
      ))].sort()),
      acquisitionRequirementIds: requirementIds,
      acquisitionJobIds: Object.freeze(acquisitionJobs.map((job) => job.jobId).sort()),
      authority: "RESEARCH_PRIORITY_ONLY" as const,
      fetchAuthority: false as const,
      providerRequestAuthority: false as const,
      semanticDecisionAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    return Object.freeze({
      ...body,
      debtId: debtGroupId(need),
    });
  }).sort((left, right) =>
    Number(right.blocking) - Number(left.blocking) ||
    STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
    left.debtId.localeCompare(right.debtId)
  ).slice(0, limit);
  const counts: Record<ProbabilityEvidenceDebtStatus, number> = {
    EVIDENCE_CAPTURED: 0,
    ACQUISITION_IN_PROGRESS: 0,
    ACQUISITION_READY: 0,
    ACQUISITION_ROUTE_MISSING: 0,
    EXTERNAL_SOURCE_POLICY_REQUIRED: 0,
  };
  for (const item of items) counts[item.status] += 1;
  const content = Object.freeze({
    schemaVersion: "pmh.probability-evidence-debt.v1" as const,
    sourceRunCount: runs.length,
    sourceNeedCount: occurrences.length,
    itemCount: items.length,
    blockingItemCount: items.filter((item) => item.blocking).length,
    counts: Object.freeze(counts),
    items: Object.freeze(items),
    rankingContract: "BLOCKING_THEN_ROUTE_POSTURE_THEN_NEED_ID" as const,
    authority: "RESEARCH_PRIORITY_ONLY" as const,
    fetchAuthority: false as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      providerRequests: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...content, contentHash: hashCanonical(content) });
}

export function emptyProbabilityEvidenceDebt(): ProbabilityEvidenceDebtProjection {
  return buildProbabilityEvidenceDebt({ runs: [], estimatorJobs: [], acquisitionJobs: [] });
}
