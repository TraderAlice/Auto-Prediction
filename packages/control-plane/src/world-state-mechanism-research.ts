import { hashCanonical, type Hash } from "@pmh/domain";
import { buildAgentTask, type AgentExecutionSnapshot, type AgentTask } from "./agent-execution-substrate.js";
import type { OntologySearchIssueRevision } from "./ontology-search-ecology.js";
import {
  WORLD_STATE_MECHANISM_RESEARCH_TASK_PROTOCOL,
  WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
} from "./market-ontology-agent-tools.js";
import type {
  WorldStateMechanismAbstention,
  WorldStateMechanismCounterexample,
  WorldStateMechanismProposal,
} from "./world-state-mechanism.js";

const ESTABLISHED_AT = "2026-08-13T00:00:00.000Z";

export type WorldStateMechanismResearchTaskContract = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-research-task.v1";
  mechanismIssueId: Hash;
  sourceOntologyIssueId: Hash;
  relationPatternId: Hash;
  selectionLane: OntologySearchIssueRevision["selectionLane"];
  objective: "PROPOSE_FALSIFY_OR_ABSTAIN_FROM_EVIDENCE_BOUND_WORLD_STATE_MECHANISM";
  inputBinding: "EXACT_ONTOLOGY_INPUT_BOUND_BY_CAMPAIGN_SELECTION";
  authority: "WORLD_STATE_MECHANISM_RESEARCH_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismResearchAssignment = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-research-assignment.v1";
  assignmentId: Hash;
  mechanismIssueId: Hash;
  sourceRevisionId: Hash;
  sourceOntologyIssueId: Hash;
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  relationPatternId: Hash;
  selectionLane: OntologySearchIssueRevision["selectionLane"];
  task: AgentTask;
  taskContract: WorldStateMechanismResearchTaskContract;
  coverageState: "UNEXPLORED" | "PROPOSED" | "ABSTAINED" | "FALSIFIED" | "MIXED";
  matchedProposalIds: readonly Hash[];
  matchedCounterexampleIds: readonly Hash[];
  matchedAbstentionIds: readonly Hash[];
  campaignEligible: boolean;
  automaticDispatch: false;
  priority: 3 | 4 | 5;
  materializedAt: string;
  authority: "MECHANISM_RESEARCH_WORK_ASSIGNMENT_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function priority(lane: OntologySearchIssueRevision["selectionLane"]): 3 | 4 | 5 {
  if (lane === "WORLD_DIVERGENCE") return 5;
  if (lane === "CROSS_VENUE") return 4;
  return 3;
}

export function mechanismResearchSemanticInputIdentity(
  revision: OntologySearchIssueRevision,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-research-input.v1",
    sourceOntologyIssueId: revision.issueId,
    ontologyIdentity: revision.ontologyIdentity,
    sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
    relationPatternId: revision.relationPatternId,
    trailheadIds: revision.trailheadIds,
    exactTaskPayloadHash: hashCanonical(revision.taskPayload),
  });
}

export function worldStateMechanismResearchIssueIdentity(
  revision: Pick<OntologySearchIssueRevision,
    "issueId" | "relationPatternId" | "selectionLane">,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-research-issue.v1",
    sourceOntologyIssueId: revision.issueId,
    relationPatternId: revision.relationPatternId,
    selectionLane: revision.selectionLane,
  });
}

export function materializeWorldStateMechanismResearchAssignments(input: Readonly<{
  revisions: readonly OntologySearchIssueRevision[];
  proposals: readonly WorldStateMechanismProposal[];
  counterexamples: readonly WorldStateMechanismCounterexample[];
  abstentions: readonly WorldStateMechanismAbstention[];
}>): readonly WorldStateMechanismResearchAssignment[] {
  return Object.freeze(input.revisions.map((revision) => {
    const mechanismIssueId = worldStateMechanismResearchIssueIdentity(revision);
    const taskContract = Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-research-task.v1" as const,
      mechanismIssueId,
      sourceOntologyIssueId: revision.issueId,
      relationPatternId: revision.relationPatternId,
      selectionLane: revision.selectionLane,
      objective: "PROPOSE_FALSIFY_OR_ABSTAIN_FROM_EVIDENCE_BOUND_WORLD_STATE_MECHANISM" as const,
      inputBinding: "EXACT_ONTOLOGY_INPUT_BOUND_BY_CAMPAIGN_SELECTION" as const,
      authority: "WORLD_STATE_MECHANISM_RESEARCH_PROPOSAL_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const task = buildAgentTask({
      kind: "WORLD_STATE_MECHANISM_RESEARCH",
      protocol: WORLD_STATE_MECHANISM_RESEARCH_TASK_PROTOCOL,
      inputArtifacts: [{
        kind: "WORLD_STATE_MECHANISM_RESEARCH_CONTRACT",
        artifactId: mechanismIssueId,
        artifactHash: hashCanonical(taskContract),
      }],
      taskPayload: taskContract,
      requestedEffectProtocol: WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
      provenanceRef: `world-state-mechanism-issue:${mechanismIssueId}`,
      priority: priority(revision.selectionLane) * 100,
      createdAt: ESTABLISHED_AT,
    });
    const matchesRevision = (item: { sourceIssueRevisionId: Hash }): boolean =>
      item.sourceIssueRevisionId === revision.revisionId;
    const proposals = input.proposals.filter(matchesRevision);
    const counterexamples = input.counterexamples.filter(matchesRevision);
    const abstentions = input.abstentions.filter(matchesRevision);
    const resultKinds = [proposals.length > 0, counterexamples.length > 0, abstentions.length > 0]
      .filter(Boolean).length;
    const coverageState = resultKinds > 1 ? "MIXED" as const
      : proposals.length > 0 ? "PROPOSED" as const
      : counterexamples.length > 0 ? "FALSIFIED" as const
      : abstentions.length > 0 ? "ABSTAINED" as const
      : "UNEXPLORED" as const;
    const body = Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-research-assignment.v1" as const,
      mechanismIssueId,
      sourceRevisionId: revision.revisionId,
      sourceOntologyIssueId: revision.issueId,
      ontologyIdentity: revision.ontologyIdentity,
      sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
      relationPatternId: revision.relationPatternId,
      selectionLane: revision.selectionLane,
      task,
      taskContract,
      coverageState,
      matchedProposalIds: Object.freeze(proposals.map((item) => item.proposalId).sort()),
      matchedCounterexampleIds: Object.freeze(counterexamples
        .map((item) => item.counterexampleId).sort()),
      matchedAbstentionIds: Object.freeze(abstentions.map((item) => item.abstentionId).sort()),
      campaignEligible: coverageState === "UNEXPLORED",
      automaticDispatch: false as const,
      priority: priority(revision.selectionLane),
      materializedAt: revision.materializedAt,
      authority: "MECHANISM_RESEARCH_WORK_ASSIGNMENT_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, assignmentId: hashCanonical(body) });
  }).sort((left, right) =>
    Number(right.campaignEligible) - Number(left.campaignEligible) ||
    right.priority - left.priority ||
    left.mechanismIssueId.localeCompare(right.mechanismIssueId)
  ));
}

export type WorldStateMechanismResearchYield = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-research-yield.v1";
  projectionIdentity: Hash;
  eligibleCount: number;
  attemptedCount: number;
  proposedCount: number;
  abstainedCount: number;
  falsifiedCount: number;
  runCount: number;
  modelInvocationCount: number;
  acceptedResultCount: number;
  usage: Readonly<{ inputTokens: string; outputTokens: string; reasoningTokens: string }>;
  outcomeStrata: readonly Readonly<{
    outcome: "PROPOSAL" | "FALSIFIER" | "ABSTENTION" |
      "NO_ACCEPTED_RESULT" | "MIXED_ACCEPTED_RESULT";
    runCount: number;
    modelInvocationCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownUsageInvocationCount: number;
  }>[];
  authority: "DERIVED_MECHANISM_RESEARCH_EVIDENCE_ONLY";
}>;

export function buildWorldStateMechanismResearchYield(input: Readonly<{
  assignments: readonly WorldStateMechanismResearchAssignment[];
  execution: AgentExecutionSnapshot;
}>): WorldStateMechanismResearchYield {
  const taskIds = new Set(input.assignments.map((item) => item.task.taskId));
  const runs = input.execution.runs.filter((item) => taskIds.has(item.taskId));
  const runIds = new Set(runs.map((item) => item.runId));
  const invocations = input.execution.modelInvocations.filter((item) => runIds.has(item.runId));
  const acceptedResults = input.execution.toolEffects.filter((item) =>
    runIds.has(item.runId) && item.status === "ACCEPTED" && [
      "propose_world_state_mechanism",
      "record_world_state_mechanism_counterexample",
      "record_world_state_mechanism_abstention",
    ].includes(item.toolName)
  );
  const attemptedTasks = new Set(runs.map((item) => item.taskId));
  const outcome = (runId: Hash): WorldStateMechanismResearchYield["outcomeStrata"][number]["outcome"] => {
    const names = new Set(acceptedResults.filter((item) => item.runId === runId)
      .map((item) => item.toolName));
    if (names.size > 1) return "MIXED_ACCEPTED_RESULT";
    if (names.has("propose_world_state_mechanism")) return "PROPOSAL";
    if (names.has("record_world_state_mechanism_counterexample")) return "FALSIFIER";
    if (names.has("record_world_state_mechanism_abstention")) return "ABSTENTION";
    return "NO_ACCEPTED_RESULT";
  };
  const outcomeKinds = [
    "PROPOSAL", "FALSIFIER", "ABSTENTION", "NO_ACCEPTED_RESULT", "MIXED_ACCEPTED_RESULT",
  ] as const;
  const outcomeStrata = Object.freeze(outcomeKinds.map((kind) => {
    const outcomeRuns = runs.filter((run) => outcome(run.runId) === kind);
    const outcomeRunIds = new Set(outcomeRuns.map((run) => run.runId));
    const outcomeInvocations = invocations.filter((item) => outcomeRunIds.has(item.runId));
    return Object.freeze({
      outcome: kind,
      runCount: outcomeRuns.length,
      modelInvocationCount: outcomeInvocations.length,
      knownInputTokens: outcomeInvocations.reduce((sum, item) =>
        sum + BigInt(item.inputTokens ?? "0"), 0n).toString(),
      knownOutputTokens: outcomeInvocations.reduce((sum, item) =>
        sum + BigInt(item.outputTokens ?? "0"), 0n).toString(),
      knownReasoningTokens: outcomeInvocations.reduce((sum, item) =>
        sum + BigInt(item.reasoningTokens ?? "0"), 0n).toString(),
      unknownUsageInvocationCount: outcomeInvocations.filter((item) =>
        item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
      ).length,
    });
  }));
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-research-yield.v1" as const,
    eligibleCount: input.assignments.filter((item) => item.campaignEligible).length,
    attemptedCount: input.assignments.filter((item) => attemptedTasks.has(item.task.taskId)).length,
    proposedCount: input.assignments.filter((item) => item.matchedProposalIds.length > 0).length,
    abstainedCount: input.assignments.filter((item) => item.matchedAbstentionIds.length > 0).length,
    falsifiedCount: input.assignments.filter((item) =>
      item.matchedCounterexampleIds.length > 0
    ).length,
    runCount: runs.length,
    modelInvocationCount: invocations.length,
    acceptedResultCount: acceptedResults.length,
    usage: Object.freeze({
      inputTokens: invocations.reduce((sum, item) =>
        sum + BigInt(item.inputTokens ?? "0"), 0n).toString(),
      outputTokens: invocations.reduce((sum, item) =>
        sum + BigInt(item.outputTokens ?? "0"), 0n).toString(),
      reasoningTokens: invocations.reduce((sum, item) =>
        sum + BigInt(item.reasoningTokens ?? "0"), 0n).toString(),
    }),
    outcomeStrata,
    authority: "DERIVED_MECHANISM_RESEARCH_EVIDENCE_ONLY" as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
