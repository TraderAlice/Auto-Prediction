export type AgentTaskRunCounts = Readonly<{
  taskCount: number;
  runCount: number;
  runnableCount: number;
}>;

export type AgentTaskRunTile = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

export function agentTaskRunTile(counts: AgentTaskRunCounts): AgentTaskRunTile {
  return {
    label: "Tasks",
    value: String(counts.taskCount),
    detail: `${counts.runnableCount} runnable · ${counts.runCount} runs`,
  };
}
