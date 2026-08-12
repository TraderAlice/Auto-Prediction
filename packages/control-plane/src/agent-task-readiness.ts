import { type Hash } from "@pmh/domain";
import { type AgentTask } from "./agent-execution-substrate.js";

export type AgentTaskReadiness = Readonly<{
  status: "RUNNABLE" | "SUPERSEDED_INPUT" | "HISTORICAL_ONLY";
  diagnostic: string;
  successorTaskId: Hash | null;
}>;

export type AgentTaskReadinessIndex = Readonly<{
  currentTaskIds: ReadonlySet<Hash>;
  successorByInputFamily: ReadonlyMap<string, AgentTask>;
}>;

function inputFamily(task: AgentTask): string {
  return `${task.kind}\u0000${task.protocol}\u0000${task.provenanceRef}`;
}

export function buildAgentTaskReadinessIndex(
  currentTasks: readonly AgentTask[],
): AgentTaskReadinessIndex {
  const successorByInputFamily = new Map<string, AgentTask>();
  for (const task of currentTasks) successorByInputFamily.set(inputFamily(task), task);
  return Object.freeze({
    currentTaskIds: new Set(currentTasks.map((task) => task.taskId)),
    successorByInputFamily,
  });
}

export function inspectAgentTaskReadiness(
  task: AgentTask,
  index: AgentTaskReadinessIndex,
): AgentTaskReadiness {
  if (index.currentTaskIds.has(task.taskId)) {
    return Object.freeze({
      status: "RUNNABLE" as const,
      diagnostic: "Current exact task input and first-party tool host are available.",
      successorTaskId: null,
    });
  }
  const successor = index.successorByInputFamily.get(inputFamily(task));
  return successor === undefined
    ? Object.freeze({
        status: "HISTORICAL_ONLY" as const,
        diagnostic: "No current exact input resolver is retained for this audit task.",
        successorTaskId: null,
      })
    : Object.freeze({
        status: "SUPERSEDED_INPUT" as const,
        diagnostic: `Current successor ${successor.taskId} owns this input family.`,
        successorTaskId: successor.taskId,
      });
}
