import { hashCanonical, type Hash } from "@pmh/domain";
import {
  emptyProbabilityCaseRepairQueue,
  type ProbabilityCaseRepairItem,
  type ProbabilityCaseRepairQueue,
} from "./probability-case-challenge-queue.js";
/*
 * The progress projection intentionally observes scheduler/review artifacts;
 * it never dispatches either lane. Runtime imports remain limited to pure
 * validators and the empty queue constructor.
 */
import type {
  ProbabilityEstimatorRole,
} from "./probability-estimation-agent.js";
import { MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS } from "./probability-semantic-repair.js";
import type {
  SemanticReviewJobRecord,
  SemanticReviewJobStatus,
} from "./semantic-review-scheduler.js";
import {
  assertSemanticReviewRecord,
  type SemanticReviewEngine,
  type SemanticReviewRecommendation,
  type SemanticReviewRecord,
} from "./semantic-review.js";

export type ProbabilitySemanticRepairProgressStatus =
  | "OPEN"
  | "REVIEW_PENDING"
  | "REVIEW_RUNNING"
  | "REPAIRED"
  | "REDUCED_TO_RESEARCH"
  | "REJECTED"
  | "MANUAL_ATTENTION";

export type ProbabilitySemanticRepairProgressItem = Readonly<{
  repairId: Hash;
  proposalId: Hash;
  sourceSemanticReviewArtifactHash: Hash;
  sourceSemanticConstraintArtifactHash: Hash;
  interpretationArtifactHash: Hash;
  status: ProbabilitySemanticRepairProgressStatus;
  nextAction:
    | "ENQUEUE_SEMANTIC_REVIEW"
    | "WAIT_FOR_SEMANTIC_REVIEW"
    | "REENTER_PROBABILITY_ESTIMATION"
    | "INSPECT_RESEARCH_REDUCTION"
    | "NO_FURTHER_PROBABILITY_WORK"
    | "MANUAL_REVIEW_REQUIRED";
  generation: number;
  admission: "AUTOMATIC_MULTI_ROLE" | "MANUAL_SINGLE_ROLE" | "MANUAL_GENERATION_LIMIT";
  requestId: Hash | null;
  jobId: Hash | null;
  jobStatus: SemanticReviewJobStatus | null;
  successorReviewId: Hash | null;
  successorSemanticConstraintArtifactHash: Hash | null;
  recommendation: SemanticReviewRecommendation | null;
  engine: SemanticReviewEngine | null;
  diagnostic: string | null;
  kind: ProbabilityCaseRepairItem["kind"];
  stateIds: readonly string[];
  listingRefs: readonly string[];
  roles: readonly ProbabilityEstimatorRole[];
  challengeIds: readonly Hash[];
  explanation: string;
  observedConflicts: readonly string[];
  authority: "SEMANTIC_REPAIR_OBSERVATION_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  executionAuthority: false;
}>;

export type ProbabilitySemanticRepairProgressProjection = Readonly<{
  schemaVersion: "pmh.probability-semantic-repair-progress.v1";
  contentHash: Hash;
  sourceItemCount: number;
  sourceChallengeCount: number;
  openCount: number;
  pendingCount: number;
  runningCount: number;
  repairedCount: number;
  reducedToResearchCount: number;
  rejectedCount: number;
  manualAttentionCount: number;
  items: readonly ProbabilitySemanticRepairProgressItem[];
  authority: "SEMANTIC_REPAIR_OBSERVATION_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function newestReview(
  item: ProbabilityCaseRepairItem,
  reviews: readonly SemanticReviewRecord[],
): SemanticReviewRecord | undefined {
  return reviews.filter((review) =>
    review.status === "PASS" && review.report !== null &&
    review.repairRequest?.repairId === item.repairId
  ).sort((left, right) =>
    (right.repairRequest?.generation ?? 0) - (left.repairRequest?.generation ?? 0) ||
    String(right.completedAt).localeCompare(String(left.completedAt))
  )[0];
}

function activeJob(
  item: ProbabilityCaseRepairItem,
  jobs: readonly SemanticReviewJobRecord[],
): SemanticReviewJobRecord | undefined {
  return jobs.filter((job) => job.repairRequest?.repairId === item.repairId)
    .sort((left, right) =>
      (right.repairRequest?.generation ?? 0) - (left.repairRequest?.generation ?? 0) ||
      right.updatedAt.localeCompare(left.updatedAt)
    )[0];
}

function terminalPosture(
  recommendation: SemanticReviewRecommendation,
): Readonly<{
  status: ProbabilitySemanticRepairProgressStatus;
  nextAction: ProbabilitySemanticRepairProgressItem["nextAction"];
}> {
  if (recommendation === "ACCEPT_FOR_RESEARCH_SIMULATION") return Object.freeze({
    status: "REPAIRED" as const,
    nextAction: "REENTER_PROBABILITY_ESTIMATION" as const,
  });
  if (recommendation === "REJECT") return Object.freeze({
    status: "REJECTED" as const,
    nextAction: "NO_FURTHER_PROBABILITY_WORK" as const,
  });
  return Object.freeze({
    status: "REDUCED_TO_RESEARCH" as const,
    nextAction: "INSPECT_RESEARCH_REDUCTION" as const,
  });
}

function progressItem(
  item: ProbabilityCaseRepairItem,
  jobs: readonly SemanticReviewJobRecord[],
  reviews: readonly SemanticReviewRecord[],
): ProbabilitySemanticRepairProgressItem {
  const sourceReview = reviews.find((review) =>
    review.report?.artifactHash === item.sourceSemanticReviewArtifactHash
  );
  const completed = newestReview(item, reviews);
  const job = activeJob(item, jobs);
  const generation = completed?.repairRequest?.generation ??
    job?.repairRequest?.generation ??
    (sourceReview?.repairRequest?.generation ?? 0) + 1;
  const admission = generation > MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS
    ? "MANUAL_GENERATION_LIMIT" as const
    : item.roles.length < 2
      ? "MANUAL_SINGLE_ROLE" as const
      : "AUTOMATIC_MULTI_ROLE" as const;
  let status: ProbabilitySemanticRepairProgressStatus;
  let nextAction: ProbabilitySemanticRepairProgressItem["nextAction"];
  if (completed?.report !== null && completed?.report !== undefined) {
    ({ status, nextAction } = terminalPosture(completed.report.result.recommendation));
  } else if (admission !== "AUTOMATIC_MULTI_ROLE") {
    status = "MANUAL_ATTENTION";
    nextAction = "MANUAL_REVIEW_REQUIRED";
  } else if (job?.status === "LEASED") {
    status = "REVIEW_RUNNING";
    nextAction = "WAIT_FOR_SEMANTIC_REVIEW";
  } else if (job !== undefined && ["PENDING", "RETRY_WAIT"].includes(job.status)) {
    status = "REVIEW_PENDING";
    nextAction = "WAIT_FOR_SEMANTIC_REVIEW";
  } else if (job !== undefined && [
    "EXHAUSTED", "BLOCKED_EVIDENCE", "RESEARCH_ONLY", "DUPLICATE_SCOPE",
  ].includes(job.status)) {
    status = "MANUAL_ATTENTION";
    nextAction = "MANUAL_REVIEW_REQUIRED";
  } else {
    status = "OPEN";
    nextAction = "ENQUEUE_SEMANTIC_REVIEW";
  }
  return Object.freeze({
    repairId: item.repairId,
    proposalId: item.proposalId,
    sourceSemanticReviewArtifactHash: item.sourceSemanticReviewArtifactHash,
    sourceSemanticConstraintArtifactHash: item.semanticConstraintArtifactHash,
    interpretationArtifactHash: item.interpretationArtifactHash,
    status,
    nextAction,
    generation,
    admission,
    requestId: completed?.repairRequest?.requestId ?? job?.repairRequest?.requestId ?? null,
    jobId: job?.jobId ?? null,
    jobStatus: job?.status ?? null,
    successorReviewId: completed?.reviewId ?? null,
    successorSemanticConstraintArtifactHash:
      completed?.report?.result.semanticConstraint?.artifactHash ?? null,
    recommendation: completed?.report?.result.recommendation ?? job?.recommendation ?? null,
    engine: completed?.engine ?? null,
    diagnostic: job?.diagnostic ?? completed?.diagnostic ?? null,
    kind: item.kind,
    stateIds: item.stateIds,
    listingRefs: item.listingRefs,
    roles: item.roles,
    challengeIds: item.challengeIds,
    explanation: item.explanation,
    observedConflicts: item.observedConflicts,
    authority: "SEMANTIC_REPAIR_OBSERVATION_ONLY" as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityCertificateAuthority: false as const,
    executionAuthority: false as const,
  });
}

export function buildProbabilitySemanticRepairProgress(input: Readonly<{
  queue: ProbabilityCaseRepairQueue;
  jobs: readonly SemanticReviewJobRecord[];
  reviews: readonly SemanticReviewRecord[];
}>): ProbabilitySemanticRepairProgressProjection {
  const reviews = input.reviews.map(assertSemanticReviewRecord);
  const items = Object.freeze(input.queue.items.map((item) =>
    progressItem(item, input.jobs, reviews)
  ));
  const content = Object.freeze({
    schemaVersion: "pmh.probability-semantic-repair-progress.v1" as const,
    sourceItemCount: input.queue.itemCount,
    sourceChallengeCount: input.queue.sourceChallengeCount,
    openCount: items.filter((item) => item.status === "OPEN").length,
    pendingCount: items.filter((item) => item.status === "REVIEW_PENDING").length,
    runningCount: items.filter((item) => item.status === "REVIEW_RUNNING").length,
    repairedCount: items.filter((item) => item.status === "REPAIRED").length,
    reducedToResearchCount: items.filter((item) =>
      item.status === "REDUCED_TO_RESEARCH"
    ).length,
    rejectedCount: items.filter((item) => item.status === "REJECTED").length,
    manualAttentionCount: items.filter((item) => item.status === "MANUAL_ATTENTION").length,
    items,
    authority: "SEMANTIC_REPAIR_OBSERVATION_ONLY" as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityCertificateAuthority: false as const,
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

export function emptyProbabilitySemanticRepairProgress(): ProbabilitySemanticRepairProgressProjection {
  return buildProbabilitySemanticRepairProgress({
    queue: emptyProbabilityCaseRepairQueue(),
    jobs: [],
    reviews: [],
  });
}
