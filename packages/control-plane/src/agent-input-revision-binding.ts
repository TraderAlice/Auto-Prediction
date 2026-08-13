import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildAgentRunAnnotation,
  type AgentRun,
  type AgentRunAnnotation,
  type AgentTask,
} from "./agent-execution-substrate.js";

export const AGENT_INPUT_REVISION_ANNOTATION_CATEGORY =
  "INPUT_REVISION_BINDING" as const;

export type AgentInputRevisionKind =
  | "ONTOLOGY_SEARCH_ISSUE"
  | "WORLD_STATE_SUBJECT_BINDING_INPUT"
  | "RELATION_DISCOVERY";

export function agentInputRevisionSourceRecordRef(
  kind: AgentInputRevisionKind,
  revisionId: Hash,
): string {
  return kind === "ONTOLOGY_SEARCH_ISSUE"
    ? `ontology-search-issue-revision:${revisionId}`
    : kind === "WORLD_STATE_SUBJECT_BINDING_INPUT"
    ? `world-state-subject-binding-input:${revisionId}`
    : `relation-discovery-task-revision:${revisionId}`;
}

export function agentInputRevisionBindingFacts(input: Readonly<{
  taskId: Hash;
  revisionKind: AgentInputRevisionKind;
  revisionId: Hash;
  exactInputHash: Hash;
}>): Readonly<{
  schemaVersion: "pmh.agent-run-input-revision-binding.v1";
  taskId: Hash;
  revisionKind: AgentInputRevisionKind;
  revisionId: Hash;
  exactInputHash: Hash;
}> {
  return Object.freeze({
    schemaVersion: "pmh.agent-run-input-revision-binding.v1",
    ...input,
  });
}

export function buildAgentInputRevisionRunAnnotation(input: Readonly<{
  task: AgentTask;
  run: AgentRun;
  revisionKind: AgentInputRevisionKind;
  revisionId: Hash;
  exactInput: unknown;
}>): AgentRunAnnotation {
  if (input.run.taskId !== input.task.taskId) {
    throw new Error("Agent input revision binding task lineage is inconsistent");
  }
  const facts = agentInputRevisionBindingFacts({
    taskId: input.task.taskId,
    revisionKind: input.revisionKind,
    revisionId: input.revisionId,
    exactInputHash: hashCanonical(input.exactInput),
  });
  return buildAgentRunAnnotation({
    run: input.run,
    category: AGENT_INPUT_REVISION_ANNOTATION_CATEGORY,
    sourceRecordRef: agentInputRevisionSourceRecordRef(
      input.revisionKind,
      input.revisionId,
    ),
    observedFacts: facts,
    note: input.revisionKind === "ONTOLOGY_SEARCH_ISSUE"
      ? "Prepared ontology run is bound to this exact retained input revision."
      : input.revisionKind === "WORLD_STATE_SUBJECT_BINDING_INPUT"
      ? "Prepared subject-binding run is bound to this exact retained input revision."
      : "Prepared relation run is bound to this exact retained input revision.",
    createdAt: input.run.createdAt,
  });
}

export function agentInputRevisionAnnotationMatches(input: Readonly<{
  annotation: AgentRunAnnotation;
  taskId: Hash;
  revisionKind: AgentInputRevisionKind;
  revisionId: Hash;
  exactInputHash: Hash;
}>): boolean {
  const facts = agentInputRevisionBindingFacts({
    taskId: input.taskId,
    revisionKind: input.revisionKind,
    revisionId: input.revisionId,
    exactInputHash: input.exactInputHash,
  });
  return input.annotation.category === AGENT_INPUT_REVISION_ANNOTATION_CATEGORY &&
    input.annotation.sourceRecordRef === agentInputRevisionSourceRecordRef(
      input.revisionKind,
      input.revisionId,
    ) &&
    input.annotation.observedFactsHash === hashCanonical(facts);
}
