import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentExecutionSnapshot, AgentRun } from "./agent-execution-substrate.js";
import type { RelationDiscoveryFinding } from "./relation-discovery-agent-tools.js";
import type { OntologyRelationWorkItem, OntologyRelationWorkProjection } from "./ontology-relation-work.js";
import type { ProbabilityEstimationJobRecord } from "./probability-estimation-scheduler.js";
import {
  relationDiscoveryReviewLane,
  selectRelationDiscoverySemanticReviewCompilations,
  type RelationDiscoveryProposalCompilation,
} from "./relation-discovery-semantic-bridge.js";
import type { RelationDiscoveryTaskRevision } from "./relation-discovery-work.js";
import type { SemanticReviewJobRecord } from "./semantic-review-scheduler.js";

const MINIMUM_RECHECK_COOLDOWN_MS = 86_400_000;
const PORTFOLIO_CAPS = Object.freeze({
  exploration: 4,
  falsificationOrDebt: 2,
  changedEvidenceRecheck: 1,
  ontologyMutation: 1,
  total: 8,
} as const);

export type ResearchAttentionValueStage =
  | "UNATTEMPTED"
  | "ATTEMPTED"
  | "NEGATIVE_EVIDENCE"
  | "POSITIVE_FINDING"
  | "SEMANTICALLY_REVIEWED"
  | "SEMANTICALLY_ADMITTED"
  | "PROBABILITY_RESEARCH";

export type ResearchAttentionActionKind =
  | "EXPLORE_NEW_FAMILY"
  | "RECHECK_CHANGED_EVIDENCE"
  | "FALSIFY_RELATION"
  | "ADVANCE_RESEARCH_DEBT"
  | "EXPAND_REVIEWED_NEIGHBORHOOD"
  | "PROPOSE_ONTOLOGY_MUTATION"
  | "HOLD";

export type ResearchAttentionNoveltyReason =
  | "NEW_STABLE_FAMILY"
  | "WORK_ARTIFACT_CHANGED"
  | "CORPUS_REVISION_ONLY"
  | "DOWNSTREAM_RESEARCH_DEBT"
  | "MISSING_COUNTEREXAMPLE"
  | "PORTFOLIO_EXHAUSTED"
  | "NO_BOUNDED_NOVELTY";

export type ResearchAttentionLane =
  | "EXPLORATION"
  | "FALSIFICATION_OR_DEBT"
  | "CHANGED_EVIDENCE_RECHECK"
  | "ONTOLOGY_MUTATION"
  | "HOLD";

export type ResearchAttentionFamilyScorecard = Readonly<{
  schemaVersion: "pmh.research-attention-family-scorecard.v1";
  scorecardId: Hash;
  workItemId: Hash;
  workArtifactHash: Hash;
  workKind: OntologyRelationWorkItem["kind"];
  workPriority: OntologyRelationWorkItem["priority"];
  sourceSelectionLanes: OntologyRelationWorkItem["sourceSelectionLanes"];
  currentTaskRevisionId: Hash | null;
  currentTaskId: Hash | null;
  currentTaskAttempted: boolean;
  retainedTaskRevisionCount: number;
  attemptedTaskRevisionCount: number;
  runIds: readonly Hash[];
  runCount: number;
  terminalRunCount: number;
  succeededRunCount: number;
  failedRunCount: number;
  interruptedRunCount: number;
  productiveInterruptedRunCount: number;
  successfulWithoutAcceptedResultCount: number;
  acceptedToolEffectCount: number;
  rejectedToolEffectCount: number;
  acceptedResultToolEffectCount: number;
  positiveFindingIds: readonly Hash[];
  counterexampleIds: readonly Hash[];
  positiveFindingCount: number;
  ontologyRouteObservationCount: number;
  counterexampleCount: number;
  noFindingTerminalRunCount: number;
  ontologyRoutingOnlyFindingCount: number;
  semanticReviewCandidateCount: number;
  semanticReviewConnectedCount: number;
  semanticReviewPassCount: number;
  semanticPayoffReviewPassCount: number;
  semanticReviewJobIds: readonly Hash[];
  semanticClassificationCounts: Readonly<{
    hardSettlementConstraint: number;
    probabilisticDependence: number;
    textualRelatedness: number;
  }>;
  probabilityJobCount: number;
  probabilityJobIds: readonly Hash[];
  usage: Readonly<{
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownInputInvocationCount: number;
    unknownOutputInvocationCount: number;
    unknownReasoningInvocationCount: number;
    knownWallClockMs: string;
    incompleteWallClockRunCount: number;
    incompleteUsagePenalized: boolean;
  }>;
  valueStage: ResearchAttentionValueStage;
  nextActionKind: ResearchAttentionActionKind;
  nextActionLane: ResearchAttentionLane;
  nextActionEligible: boolean;
  directRelationTaskId: Hash | null;
  noveltyReason: Exclude<ResearchAttentionNoveltyReason, "PORTFOLIO_EXHAUSTED">;
  diagnostic: string;
  downstreamOpportunityAttribution: "NOT_YET_CONNECTED";
  authority: "DERIVED_RESEARCH_EVIDENCE_ONLY";
  modelConfidenceAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResearchAttentionAllocationAction = Readonly<{
  schemaVersion: "pmh.research-attention-allocation-action.v2";
  actionId: Hash;
  lane: Exclude<ResearchAttentionLane, "HOLD">;
  kind: Exclude<ResearchAttentionActionKind, "HOLD">;
  workItemId: Hash | null;
  scorecardId: Hash | null;
  taskId: Hash | null;
  targetArtifactRefs: readonly Hash[];
  valueStage: ResearchAttentionValueStage | "PORTFOLIO_EXHAUSTED";
  noveltyReason: ResearchAttentionNoveltyReason;
  diagnostic: string;
  dispatchableByRelationCampaign: boolean;
  authority: "ATTENTION_PROPOSAL_ONLY";
  modelInvocationAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResearchAttentionAllocationProjection = Readonly<{
  schemaVersion: "pmh.research-attention-allocation.v1";
  projectionIdentity: Hash;
  observedAt: string;
  policy: Readonly<{
    schemaVersion: "pmh.research-attention-policy.v1";
    policyIdentity: Hash;
    minimumRecheckCooldownMs: 86400000;
    portfolioCaps: typeof PORTFOLIO_CAPS;
    automaticDispatch: false;
    modelConfidenceAuthority: false;
  }>;
  familyCount: number;
  actionableFamilyCount: number;
  heldFamilyCount: number;
  families: readonly ResearchAttentionFamilyScorecard[];
  portfolio: readonly ResearchAttentionAllocationAction[];
  laneCounts: Readonly<{
    exploration: number;
    falsificationOrDebt: number;
    changedEvidenceRecheck: number;
    ontologyMutation: number;
  }>;
  omittedActionableFamilyCount: number;
  recurrenceQualification: Readonly<{
    terminalRelationRunCount: number;
    attemptedStableFamilyCount: number;
    independentlyReviewedPositiveFindingCount: number;
    usageComplete: boolean;
    noveltyGateImplemented: true;
    evidenceThresholdSatisfied: boolean;
    operatorActivationStillRequired: true;
  }>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  automaticDispatch: false;
  authority: "ATTENTION_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function latestRevision(
  workItemId: Hash,
  revisions: readonly RelationDiscoveryTaskRevision[],
): RelationDiscoveryTaskRevision | null {
  return revisions.filter((item) => item.workItemId === workItemId &&
    item.schemaVersion !== "pmh.relation-discovery-task-revision.v4"
  ).sort((left, right) =>
    right.materializedAt.localeCompare(left.materializedAt) ||
    right.revisionId.localeCompare(left.revisionId)
  )[0] ?? null;
}

function terminal(run: AgentRun): boolean {
  return ["INTERRUPTED", "SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status);
}

function elapsedMs(run: AgentRun): bigint | null {
  if (run.completedAt === null) return null;
  const elapsed = Date.parse(run.completedAt) - Date.parse(run.createdAt);
  return Number.isFinite(elapsed) && elapsed >= 0 ? BigInt(elapsed) : null;
}

function valueStage(input: Readonly<{
  runs: readonly AgentRun[];
  positiveFindingCount: number;
  counterexampleCount: number;
  semanticJobs: readonly SemanticReviewJobRecord[];
  probabilityJobCount: number;
}>): ResearchAttentionValueStage {
  if (input.probabilityJobCount > 0) return "PROBABILITY_RESEARCH";
  const passed = input.semanticJobs.filter((item) => item.status === "PASS");
  if (passed.some((item) => ["HARD_SETTLEMENT_CONSTRAINT", "PROBABILISTIC_DEPENDENCE"]
    .includes(item.reviewOutcome?.semanticConstraint?.classification ?? ""))) {
    return "SEMANTICALLY_ADMITTED";
  }
  if (passed.length > 0) return "SEMANTICALLY_REVIEWED";
  if (input.positiveFindingCount > 0) return "POSITIVE_FINDING";
  if (input.counterexampleCount > 0) return "NEGATIVE_EVIDENCE";
  if (input.runs.length > 0) return "ATTEMPTED";
  return "UNATTEMPTED";
}

function newestRun(runs: readonly AgentRun[]): AgentRun | null {
  return [...runs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.runId.localeCompare(left.runId)
  )[0] ?? null;
}

function actionFor(input: Readonly<{
  workItem: OntologyRelationWorkItem;
  currentRevision: RelationDiscoveryTaskRevision | null;
  attemptedRevisions: readonly RelationDiscoveryTaskRevision[];
  runs: readonly AgentRun[];
  positiveFindingCount: number;
  counterexampleCount: number;
  semanticJobs: readonly SemanticReviewJobRecord[];
  observedAt: string;
}>): Pick<ResearchAttentionFamilyScorecard,
  "nextActionKind" | "nextActionLane" | "nextActionEligible" |
  "directRelationTaskId" | "noveltyReason" | "diagnostic"> {
  const currentAttempted = input.currentRevision !== null && input.runs.some((run) =>
    run.taskId === input.currentRevision!.task.taskId
  );
  if (input.runs.length === 0 && input.currentRevision !== null) {
    return {
      nextActionKind: "EXPLORE_NEW_FAMILY",
      nextActionLane: "EXPLORATION",
      nextActionEligible: true,
      directRelationTaskId: input.currentRevision.task.taskId,
      noveltyReason: "NEW_STABLE_FAMILY",
      diagnostic: "No retained attempt exists for this stable work family",
    };
  }
  const passed = input.semanticJobs.filter((item) => item.status === "PASS");
  if (passed.some((item) =>
    item.reviewOutcome?.semanticConstraint?.classification === "TEXTUAL_RELATEDNESS" ||
    item.recommendation === "ESCALATE"
  )) {
    return {
      nextActionKind: "ADVANCE_RESEARCH_DEBT",
      nextActionLane: "FALSIFICATION_OR_DEBT",
      nextActionEligible: true,
      directRelationTaskId: null,
      noveltyReason: "DOWNSTREAM_RESEARCH_DEBT",
      diagnostic: "Independent review narrowed the gap; relation rediscovery would duplicate work",
    };
  }
  if (input.positiveFindingCount > 0 && input.counterexampleCount === 0 && passed.length === 0) {
    return {
      nextActionKind: "FALSIFY_RELATION",
      nextActionLane: "FALSIFICATION_OR_DEBT",
      nextActionEligible: true,
      directRelationTaskId: null,
      noveltyReason: "MISSING_COUNTEREXAMPLE",
      diagnostic: "A positive finding exists without retained counterexample evidence",
    };
  }
  if (input.currentRevision !== null && !currentAttempted && input.attemptedRevisions.length > 0) {
    const prior = [...input.attemptedRevisions].sort((left, right) =>
      right.materializedAt.localeCompare(left.materializedAt) ||
      right.revisionId.localeCompare(left.revisionId)
    )[0]!;
    if (prior.workArtifactHash !== input.currentRevision.workArtifactHash) {
      const last = newestRun(input.runs);
      const cooldownElapsed = last?.completedAt !== null && last?.completedAt !== undefined &&
        Date.parse(input.observedAt) - Date.parse(last.completedAt) >= MINIMUM_RECHECK_COOLDOWN_MS;
      return cooldownElapsed
        ? {
            nextActionKind: "RECHECK_CHANGED_EVIDENCE",
            nextActionLane: "CHANGED_EVIDENCE_RECHECK",
            nextActionEligible: true,
            directRelationTaskId: input.currentRevision.task.taskId,
            noveltyReason: "WORK_ARTIFACT_CHANGED",
            diagnostic: "The stable family has a changed work artifact and the recheck cooldown elapsed",
          }
        : {
            nextActionKind: "HOLD",
            nextActionLane: "HOLD",
            nextActionEligible: false,
            directRelationTaskId: null,
            noveltyReason: "WORK_ARTIFACT_CHANGED",
            diagnostic: "Changed work evidence exists, but the bounded recheck cooldown has not elapsed",
          };
    }
    return {
      nextActionKind: "HOLD",
      nextActionLane: "HOLD",
      nextActionEligible: false,
      directRelationTaskId: null,
      noveltyReason: "CORPUS_REVISION_ONLY",
      diagnostic: "Only the corpus/task revision changed; that alone cannot justify another model spend",
    };
  }
  return {
    nextActionKind: "HOLD",
    nextActionLane: "HOLD",
    nextActionEligible: false,
    directRelationTaskId: null,
    noveltyReason: "NO_BOUNDED_NOVELTY",
    diagnostic: "No bounded next action differs enough from retained work",
  };
}

function compareScorecards(
  left: ResearchAttentionFamilyScorecard,
  right: ResearchAttentionFamilyScorecard,
): number {
  const priority = right.workPriority - left.workPriority;
  if (priority !== 0) return priority;
  const leftCost = BigInt(left.usage.knownInputTokens);
  const rightCost = BigInt(right.usage.knownInputTokens);
  if (leftCost !== rightCost) return leftCost < rightCost ? -1 : 1;
  return left.workItemId.localeCompare(right.workItemId);
}

function allocationAction(
  scorecard: ResearchAttentionFamilyScorecard,
): ResearchAttentionAllocationAction {
  if (!scorecard.nextActionEligible || scorecard.nextActionKind === "HOLD" ||
      scorecard.nextActionLane === "HOLD") {
    throw new Error("held scorecards cannot become allocation actions");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.research-attention-allocation-action.v2" as const,
    lane: scorecard.nextActionLane,
    kind: scorecard.nextActionKind,
    workItemId: scorecard.workItemId,
    scorecardId: scorecard.scorecardId,
    taskId: scorecard.directRelationTaskId,
    targetArtifactRefs: scorecard.nextActionKind === "ADVANCE_RESEARCH_DEBT"
      ? scorecard.semanticReviewJobIds
      : scorecard.directRelationTaskId === null
        ? Object.freeze([...scorecard.positiveFindingIds, ...scorecard.counterexampleIds])
        : Object.freeze([scorecard.directRelationTaskId]),
    valueStage: scorecard.valueStage,
    noveltyReason: scorecard.noveltyReason,
    diagnostic: scorecard.diagnostic,
    dispatchableByRelationCampaign: scorecard.directRelationTaskId !== null &&
      scorecard.nextActionKind === "EXPLORE_NEW_FAMILY",
    authority: "ATTENTION_PROPOSAL_ONLY" as const,
    modelInvocationAuthority: false as const,
    campaignAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, actionId: hashCanonical(body) });
}

function mutationAction(observedAt: string): ResearchAttentionAllocationAction {
  const body = Object.freeze({
    schemaVersion: "pmh.research-attention-allocation-action.v2" as const,
    lane: "ONTOLOGY_MUTATION" as const,
    kind: "PROPOSE_ONTOLOGY_MUTATION" as const,
    workItemId: null,
    scorecardId: null,
    taskId: null,
    targetArtifactRefs: Object.freeze([]),
    valueStage: "PORTFOLIO_EXHAUSTED" as const,
    noveltyReason: "PORTFOLIO_EXHAUSTED" as const,
    diagnostic: `All retained relation families were exhausted as of ${observedAt}; propose a materially different ontology search thesis`,
    dispatchableByRelationCampaign: false,
    authority: "ATTENTION_PROPOSAL_ONLY" as const,
    modelInvocationAuthority: false as const,
    campaignAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, actionId: hashCanonical(body) });
}

export function buildResearchAttentionAllocation(input: Readonly<{
  observedAt: string;
  relationWork: OntologyRelationWorkProjection;
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  findings: readonly RelationDiscoveryFinding[];
  proposalCompilations: readonly RelationDiscoveryProposalCompilation[];
  semanticReviewJobs: readonly SemanticReviewJobRecord[];
  probabilityJobs: readonly ProbabilityEstimationJobRecord[];
  execution: AgentExecutionSnapshot;
}>): ResearchAttentionAllocationProjection {
  if (new Date(input.observedAt).toISOString() !== input.observedAt) {
    throw new Error("research attention observedAt must be a canonical ISO timestamp");
  }
  const tasks = new Map(input.execution.tasks.map((item) => [item.taskId, item] as const));
  const runsByWork = new Map<Hash, AgentRun[]>();
  const revisionsByTask = new Map(input.taskRevisions.map((item) =>
    [item.task.taskId, item] as const
  ));
  for (const run of input.execution.runs) {
    const revision = revisionsByTask.get(run.taskId);
    if (revision?.schemaVersion === "pmh.relation-discovery-task-revision.v4") continue;
    if (revision === undefined || !tasks.has(run.taskId)) continue;
    const retained = runsByWork.get(revision.workItemId) ?? [];
    retained.push(run);
    runsByWork.set(revision.workItemId, retained);
  }
  const findingsByRun = new Map<Hash, RelationDiscoveryFinding[]>();
  for (const finding of input.findings) {
    const retained = findingsByRun.get(finding.sourceAgentRunId) ?? [];
    retained.push(finding);
    findingsByRun.set(finding.sourceAgentRunId, retained);
  }
  const semanticJobByProposal = new Map<Hash, SemanticReviewJobRecord>();
  for (const job of input.semanticReviewJobs) {
    const retained = semanticJobByProposal.get(job.proposalId);
    if (retained === undefined || job.updatedAt.localeCompare(retained.updatedAt) > 0 ||
      (job.updatedAt === retained.updatedAt && job.jobId.localeCompare(retained.jobId) > 0)) {
      semanticJobByProposal.set(job.proposalId, job);
    }
  }
  const probabilityJobsByProposal = new Map<Hash, ProbabilityEstimationJobRecord[]>();
  for (const job of input.probabilityJobs) {
    const retained = probabilityJobsByProposal.get(job.proposalId) ?? [];
    retained.push(job);
    probabilityJobsByProposal.set(job.proposalId, retained);
  }
  const families = Object.freeze(input.relationWork.items.map((workItem) => {
    const revisions = input.taskRevisions.filter((item) =>
      item.workItemId === workItem.workItemId &&
      item.schemaVersion !== "pmh.relation-discovery-task-revision.v4"
    );
    const currentRevision = latestRevision(workItem.workItemId, revisions);
    const runs = Object.freeze(runsByWork.get(workItem.workItemId) ?? []);
    const runIds = new Set(runs.map((item) => item.runId));
    const invocations = input.execution.modelInvocations.filter((item) => runIds.has(item.runId));
    const effects = input.execution.toolEffects.filter((item) => runIds.has(item.runId));
    const findings = input.findings.filter((item) => item.workItemId === workItem.workItemId);
    const compilations = input.proposalCompilations.filter((item) =>
      item.origin.workItemId === workItem.workItemId
    );
    const reviewableCompilations = selectRelationDiscoverySemanticReviewCompilations(
      compilations,
    );
    const ontologyRoutingOnlyFindingCount = compilations.filter((item) =>
      relationDiscoveryReviewLane(item.proposal.relationKind) === "ONTOLOGY_ROUTING_ONLY"
    ).length;
    const proposalIds = Object.freeze([...new Set(compilations.map((item) =>
      item.proposal.proposalId
    ))].sort());
    const reviewableProposalIds = new Set(reviewableCompilations.map((item) =>
      item.proposal.proposalId
    ));
    const semanticJobs = Object.freeze(proposalIds.flatMap((proposalId) => {
      const job = semanticJobByProposal.get(proposalId);
      return job === undefined ? [] : [job];
    }));
    const reviewableSemanticJobs = Object.freeze(semanticJobs.filter((job) =>
      reviewableProposalIds.has(job.proposalId)
    ));
    const probabilityJobs = proposalIds.flatMap((proposalId) =>
      probabilityJobsByProposal.get(proposalId) ?? []
    );
    const attemptedTaskIds = new Set(runs.map((item) => item.taskId));
    const attemptedRevisions = revisions.filter((item) => attemptedTaskIds.has(item.task.taskId));
    const productiveInterruptedRunIds = new Set(findings.filter((finding) =>
      runs.some((run) => run.runId === finding.sourceAgentRunId && run.status === "INTERRUPTED")
    ).map((finding) => finding.sourceAgentRunId));
    const positiveFindingCount = findings.filter((item) => item.kind === "RELATION_HYPOTHESIS").length;
    const ontologyRouteObservationCount = findings.filter((item) =>
      item.kind === "ONTOLOGY_ROUTE"
    ).length;
    const counterexampleCount = findings.filter((item) => item.kind === "COUNTEREXAMPLE").length;
    const action = actionFor({
      workItem,
      currentRevision,
      attemptedRevisions,
      runs,
      positiveFindingCount,
      counterexampleCount,
      semanticJobs: reviewableSemanticJobs,
      observedAt: input.observedAt,
    });
    const knownWallClock = runs.map(elapsedMs).filter((item): item is bigint => item !== null)
      .reduce((sum, item) => sum + item, 0n);
    const acceptedResultRunIds = new Set(findings.map((item) => item.sourceAgentRunId));
    const classification = semanticJobs.map((item) =>
      item.reviewOutcome?.semanticConstraint?.classification ?? null
    );
    const body = Object.freeze({
      schemaVersion: "pmh.research-attention-family-scorecard.v1" as const,
      workItemId: workItem.workItemId,
      workArtifactHash: workItem.artifactHash,
      workKind: workItem.kind,
      workPriority: workItem.priority,
      sourceSelectionLanes: workItem.sourceSelectionLanes,
      currentTaskRevisionId: currentRevision?.revisionId ?? null,
      currentTaskId: currentRevision?.task.taskId ?? null,
      currentTaskAttempted: currentRevision === null ? false : attemptedTaskIds.has(currentRevision.task.taskId),
      retainedTaskRevisionCount: revisions.length,
      attemptedTaskRevisionCount: attemptedRevisions.length,
      runIds: Object.freeze(runs.map((item) => item.runId).sort()),
      runCount: runs.length,
      terminalRunCount: runs.filter(terminal).length,
      succeededRunCount: runs.filter((item) => item.status === "SUCCEEDED").length,
      failedRunCount: runs.filter((item) => ["FAILED", "CANCELLED"].includes(item.status)).length,
      interruptedRunCount: runs.filter((item) => item.status === "INTERRUPTED").length,
      productiveInterruptedRunCount: productiveInterruptedRunIds.size,
      successfulWithoutAcceptedResultCount: runs.filter((item) =>
        item.status === "SUCCEEDED" && !acceptedResultRunIds.has(item.runId)
      ).length,
      acceptedToolEffectCount: effects.filter((item) => item.status === "ACCEPTED").length,
      rejectedToolEffectCount: effects.filter((item) => item.status === "REJECTED").length,
      acceptedResultToolEffectCount: effects.filter((item) =>
        item.status === "ACCEPTED" &&
        ["record_relation_hypothesis", "record_ontology_route",
          "record_relation_counterexample"].includes(item.toolName)
      ).length,
      positiveFindingIds: Object.freeze(findings.filter((item) =>
        item.kind === "RELATION_HYPOTHESIS"
      ).map((item) => item.findingId).sort()),
      counterexampleIds: Object.freeze(findings.filter((item) =>
        item.kind === "COUNTEREXAMPLE"
      ).map((item) => item.findingId).sort()),
      positiveFindingCount,
      ontologyRouteObservationCount,
      counterexampleCount,
      noFindingTerminalRunCount: runs.filter((run) =>
        terminal(run) && (findingsByRun.get(run.runId)?.length ?? 0) === 0
      ).length,
      ontologyRoutingOnlyFindingCount,
      semanticReviewCandidateCount: reviewableCompilations.length,
      semanticReviewConnectedCount: semanticJobs.length,
      semanticReviewPassCount: semanticJobs.filter((item) => item.status === "PASS").length,
      semanticPayoffReviewPassCount: reviewableSemanticJobs.filter((item) =>
        item.status === "PASS"
      ).length,
      semanticReviewJobIds: Object.freeze(semanticJobs.map((item) => item.jobId).sort()),
      semanticClassificationCounts: Object.freeze({
        hardSettlementConstraint: classification.filter((item) => item === "HARD_SETTLEMENT_CONSTRAINT").length,
        probabilisticDependence: classification.filter((item) => item === "PROBABILISTIC_DEPENDENCE").length,
        textualRelatedness: classification.filter((item) => item === "TEXTUAL_RELATEDNESS").length,
      }),
      probabilityJobCount: probabilityJobs.length,
      probabilityJobIds: Object.freeze(probabilityJobs.map((item) => item.jobId).sort()),
      usage: Object.freeze({
        knownInputTokens: invocations.reduce((sum, item) =>
          sum + BigInt(item.inputTokens ?? "0"), 0n).toString(),
        knownOutputTokens: invocations.reduce((sum, item) =>
          sum + BigInt(item.outputTokens ?? "0"), 0n).toString(),
        knownReasoningTokens: invocations.reduce((sum, item) =>
          sum + BigInt(item.reasoningTokens ?? "0"), 0n).toString(),
        unknownInputInvocationCount: invocations.filter((item) => item.inputTokens === null).length,
        unknownOutputInvocationCount: invocations.filter((item) => item.outputTokens === null).length,
        unknownReasoningInvocationCount: invocations.filter((item) => item.reasoningTokens === null).length,
        knownWallClockMs: knownWallClock.toString(),
        incompleteWallClockRunCount: runs.filter((item) => elapsedMs(item) === null).length,
        incompleteUsagePenalized: invocations.some((item) =>
          item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
        ) || runs.some((item) => elapsedMs(item) === null),
      }),
      valueStage: valueStage({ runs, positiveFindingCount, counterexampleCount, semanticJobs,
        probabilityJobCount: probabilityJobs.length }),
      ...action,
      downstreamOpportunityAttribution: "NOT_YET_CONNECTED" as const,
      authority: "DERIVED_RESEARCH_EVIDENCE_ONLY" as const,
      modelConfidenceAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, scorecardId: hashCanonical(body) });
  }).sort((left, right) => left.workItemId.localeCompare(right.workItemId)));

  const take = (lane: ResearchAttentionLane, maximum: number) => families
    .filter((item) => item.nextActionEligible && item.nextActionLane === lane)
    .sort(compareScorecards).slice(0, maximum).map(allocationAction);
  const exploration = take("EXPLORATION", PORTFOLIO_CAPS.exploration);
  const falsificationOrDebt = take("FALSIFICATION_OR_DEBT", PORTFOLIO_CAPS.falsificationOrDebt);
  const recheck = take("CHANGED_EVIDENCE_RECHECK", PORTFOLIO_CAPS.changedEvidenceRecheck);
  const candidateCount = families.filter((item) => item.nextActionEligible).length;
  const shouldMutate = families.length > 0 && families.every((item) => item.runCount > 0) &&
    candidateCount === 0;
  const mutation = shouldMutate ? [mutationAction(input.observedAt)] : [];
  const portfolio = Object.freeze([
    ...exploration,
    ...falsificationOrDebt,
    ...recheck,
    ...mutation,
  ].slice(0, PORTFOLIO_CAPS.total));
  const policyBody = Object.freeze({
    schemaVersion: "pmh.research-attention-policy.v1" as const,
    minimumRecheckCooldownMs: MINIMUM_RECHECK_COOLDOWN_MS as 86400000,
    portfolioCaps: PORTFOLIO_CAPS,
    automaticDispatch: false as const,
    modelConfidenceAuthority: false as const,
  });
  const policy = Object.freeze({ ...policyBody, policyIdentity: hashCanonical(policyBody) });
  const allInvocations = families.reduce((sum, item) => sum +
    item.usage.unknownInputInvocationCount + item.usage.unknownOutputInvocationCount +
    item.usage.unknownReasoningInvocationCount, 0);
  const terminalRelationRunCount = families.reduce((sum, item) => sum + item.terminalRunCount, 0);
  const attemptedStableFamilyCount = families.filter((item) => item.runCount > 0).length;
  const independentlyReviewedPositiveFindingCount = families.reduce((sum, item) =>
    sum + Math.min(item.positiveFindingCount, item.semanticPayoffReviewPassCount), 0
  );
  const recurrenceEvidence = terminalRelationRunCount >= 12 && attemptedStableFamilyCount >= 4 &&
    independentlyReviewedPositiveFindingCount >= 2 && allInvocations === 0 &&
    families.every((item) => item.usage.incompleteWallClockRunCount === 0);
  const body = Object.freeze({
    schemaVersion: "pmh.research-attention-allocation.v1" as const,
    observedAt: input.observedAt,
    policy,
    familyCount: families.length,
    actionableFamilyCount: candidateCount,
    heldFamilyCount: families.filter((item) => !item.nextActionEligible).length,
    families,
    portfolio,
    laneCounts: Object.freeze({
      exploration: exploration.length,
      falsificationOrDebt: falsificationOrDebt.length,
      changedEvidenceRecheck: recheck.length,
      ontologyMutation: mutation.length,
    }),
    omittedActionableFamilyCount: Math.max(0, candidateCount -
      exploration.length - falsificationOrDebt.length - recheck.length),
    recurrenceQualification: Object.freeze({
      terminalRelationRunCount,
      attemptedStableFamilyCount,
      independentlyReviewedPositiveFindingCount,
      usageComplete: allInvocations === 0 && families.every((item) =>
        item.usage.incompleteWallClockRunCount === 0
      ),
      noveltyGateImplemented: true as const,
      evidenceThresholdSatisfied: recurrenceEvidence,
      operatorActivationStillRequired: true as const,
    }),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "ATTENTION_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
