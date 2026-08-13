import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  AgentExecutionSnapshot,
  AgentRun,
  AgentToolEffect,
  ModelInvocation,
} from "./agent-execution-substrate.js";

export type AgentResultRepairRunIntegrity =
  | "EXACT"
  | "MISSING_REJECTED_EFFECT"
  | "NON_REJECTED_EFFECT_REFERENCE"
  | "NON_SEQUENTIAL_ATTEMPTS";

export type AgentResultRepairRun = Readonly<{
  schemaVersion: "pmh.agent-result-repair-run.v1";
  runId: Hash;
  taskId: Hash;
  runStatus: AgentRun["status"];
  completedAt: string | null;
  repairInvocationCount: number;
  repairAttemptCount: number;
  rejectedResultEffectCount: number;
  acceptedAfterRepair: boolean;
  acceptedResultEffectId: Hash | null;
  budgetTerminated: boolean;
  integrity: AgentResultRepairRunIntegrity;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
  diagnostic: string;
}>;

export type AgentResultRepairProjection = Readonly<{
  schemaVersion: "pmh.agent-result-repair-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  repairRunCount: number;
  repairInvocationCount: number;
  rejectedResultEffectCount: number;
  acceptedAfterRepairRunCount: number;
  budgetTerminatedRepairRunCount: number;
  otherTerminalRepairRunCount: number;
  inFlightRepairRunCount: number;
  exactRepairRunCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
  historicalUnclassifiedInvocationCount: number;
  unlinkedRejectedEffectCount: number;
  runs: readonly AgentResultRepairRun[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_AGENT_REPAIR_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const BUDGET_TERMINATIONS = new Set([
  "campaign budget exhausted",
  "model invocation budget exhausted",
  "run wall-clock budget exhausted",
  "token budget exhausted",
  "token budget exceeded by model invocation",
  "tool-call budget exhausted",
]);

function repairInvocations(
  invocations: readonly ModelInvocation[],
): readonly Extract<ModelInvocation, {
  schemaVersion: "pmh.model-invocation.v3" | "pmh.model-invocation.v4";
}>[] {
  return invocations.filter((invocation): invocation is Extract<ModelInvocation, {
    schemaVersion: "pmh.model-invocation.v3" | "pmh.model-invocation.v4";
  }> => (invocation.schemaVersion === "pmh.model-invocation.v3" ||
      invocation.schemaVersion === "pmh.model-invocation.v4") &&
    invocation.purpose === "RESULT_REPAIR");
}

function sumKnown(
  invocations: readonly ModelInvocation[],
  field: "inputTokens" | "outputTokens" | "reasoningTokens",
): bigint {
  return invocations.reduce((total, invocation) =>
    total + BigInt(invocation[field] ?? "0"), 0n
  );
}

function acceptedResultEffect(
  runId: Hash,
  effects: ReadonlyMap<Hash, AgentToolEffect>,
  snapshot: AgentExecutionSnapshot,
): AgentToolEffect | null {
  const artifacts = snapshot.runArtifacts.filter((artifact) =>
    artifact.runId === runId && artifact.kind === "RESULT_TOOL_FINAL" &&
    artifact.sourceArtifactRef?.startsWith("agent-tool-effect:")
  ).sort((left, right) => right.ordinal - left.ordinal);
  for (const artifact of artifacts) {
    const effectId = artifact.sourceArtifactRef!.slice("agent-tool-effect:".length) as Hash;
    const effect = effects.get(effectId);
    if (effect?.runId === runId && effect.status === "ACCEPTED") return effect;
  }
  return null;
}

function repairRun(
  run: AgentRun,
  invocations: readonly ModelInvocation[],
  effectsById: ReadonlyMap<Hash, AgentToolEffect>,
  snapshot: AgentExecutionSnapshot,
): AgentResultRepairRun | null {
  const repairs = [...repairInvocations(invocations)].sort((left, right) =>
    left.ordinal - right.ordinal
  );
  if (repairs.length === 0) return null;
  const attempts = repairs.map((invocation) => invocation.repairContext!.attemptOrdinal);
  const uniqueAttempts = [...new Set(attempts)];
  const effectIds = [...new Set(repairs.flatMap((invocation) =>
    invocation.repairContext!.rejectedResultEffectIds
  ))].sort() as Hash[];
  let integrity: AgentResultRepairRunIntegrity = "EXACT";
  if (uniqueAttempts.some((attempt, index) => attempt !== index + 1)) {
    integrity = "NON_SEQUENTIAL_ATTEMPTS";
  }
  for (const effectId of effectIds) {
    const effect = effectsById.get(effectId);
    if (effect === undefined || effect.runId !== run.runId) {
      integrity = "MISSING_REJECTED_EFFECT";
      break;
    }
    if (effect.status !== "REJECTED") integrity = "NON_REJECTED_EFFECT_REFERENCE";
  }
  const accepted = acceptedResultEffect(run.runId, effectsById, snapshot);
  const knownInputTokens = sumKnown(repairs, "inputTokens");
  const knownOutputTokens = sumKnown(repairs, "outputTokens");
  const knownReasoningTokens = sumKnown(repairs, "reasoningTokens");
  const knownTotalTokens = knownInputTokens + knownOutputTokens + knownReasoningTokens;
  const incompleteUsageInvocationCount = repairs.filter((invocation) =>
    invocation.inputTokens === null || invocation.outputTokens === null ||
    invocation.reasoningTokens === null
  ).length;
  const budgetTerminated = run.status === "INTERRUPTED" &&
    run.terminalDiagnostic !== null && BUDGET_TERMINATIONS.has(run.terminalDiagnostic);
  const acceptedAfterRepair = run.status === "SUCCEEDED" && accepted !== null;
  const diagnostic = integrity !== "EXACT"
    ? `Repair lineage is ${integrity.toLowerCase().replaceAll("_", " ")}.`
    : acceptedAfterRepair
      ? "A first-party rejected result was repaired to an accepted result effect."
      : budgetTerminated
        ? `Repair stopped at the configured boundary: ${run.terminalDiagnostic}.`
        : run.status === "PREPARED"
          ? "Repair evidence is retained while the run remains in flight."
          : `Repair ended with run status ${run.status}.`;
  return Object.freeze({
    schemaVersion: "pmh.agent-result-repair-run.v1" as const,
    runId: run.runId,
    taskId: run.taskId,
    runStatus: run.status,
    completedAt: run.completedAt,
    repairInvocationCount: repairs.length,
    repairAttemptCount: uniqueAttempts.length,
    rejectedResultEffectCount: effectIds.length,
    acceptedAfterRepair,
    acceptedResultEffectId: accepted?.effectId ?? null,
    budgetTerminated,
    integrity,
    knownInputTokens: knownInputTokens.toString(),
    knownOutputTokens: knownOutputTokens.toString(),
    knownReasoningTokens: knownReasoningTokens.toString(),
    knownTotalTokens: knownTotalTokens.toString(),
    incompleteUsageInvocationCount,
    diagnostic,
  });
}

export function buildAgentResultRepairProjection(input: Readonly<{
  observedAt: string;
  execution: AgentExecutionSnapshot;
}>): AgentResultRepairProjection {
  const effectsById = new Map(input.execution.toolEffects.map((effect) =>
    [effect.effectId, effect] as const
  ));
  const invocationsByRun = new Map<Hash, ModelInvocation[]>();
  for (const invocation of input.execution.modelInvocations) {
    invocationsByRun.set(invocation.runId, [
      ...(invocationsByRun.get(invocation.runId) ?? []), invocation,
    ]);
  }
  const runs = input.execution.runs.map((run) => repairRun(
    run,
    invocationsByRun.get(run.runId) ?? [],
    effectsById,
    input.execution,
  )).filter((run): run is AgentResultRepairRun => run !== null)
    .sort((left, right) =>
      (right.completedAt ?? "9999").localeCompare(left.completedAt ?? "9999") ||
      left.runId.localeCompare(right.runId)
    );
  const linkedRejectedEffectIds = new Set(runs.flatMap((run) => {
    const invocations = repairInvocations(invocationsByRun.get(run.runId) ?? []);
    return invocations.flatMap((invocation) =>
      invocation.repairContext!.rejectedResultEffectIds
    );
  }));
  const sumRunTokens = (field: "knownInputTokens" | "knownOutputTokens" |
    "knownReasoningTokens" | "knownTotalTokens") => runs.reduce((total, run) =>
      total + BigInt(run[field]), 0n
    );
  const body = Object.freeze({
    schemaVersion: "pmh.agent-result-repair-projection.v1" as const,
    observedAt: input.observedAt,
    repairRunCount: runs.length,
    repairInvocationCount: runs.reduce((total, run) =>
      total + run.repairInvocationCount, 0),
    rejectedResultEffectCount: linkedRejectedEffectIds.size,
    acceptedAfterRepairRunCount: runs.filter((run) => run.acceptedAfterRepair).length,
    budgetTerminatedRepairRunCount: runs.filter((run) => run.budgetTerminated).length,
    otherTerminalRepairRunCount: runs.filter((run) =>
      run.runStatus !== "PREPARED" && !run.acceptedAfterRepair && !run.budgetTerminated
    ).length,
    inFlightRepairRunCount: runs.filter((run) => run.runStatus === "PREPARED").length,
    exactRepairRunCount: runs.filter((run) => run.integrity === "EXACT").length,
    knownInputTokens: sumRunTokens("knownInputTokens").toString(),
    knownOutputTokens: sumRunTokens("knownOutputTokens").toString(),
    knownReasoningTokens: sumRunTokens("knownReasoningTokens").toString(),
    knownTotalTokens: sumRunTokens("knownTotalTokens").toString(),
    incompleteUsageInvocationCount: runs.reduce((total, run) =>
      total + run.incompleteUsageInvocationCount, 0),
    historicalUnclassifiedInvocationCount: input.execution.modelInvocations.filter(
      (invocation) => invocation.schemaVersion !== "pmh.model-invocation.v3" &&
        invocation.schemaVersion !== "pmh.model-invocation.v4",
    ).length,
    unlinkedRejectedEffectCount: input.execution.toolEffects.filter((effect) =>
      effect.status === "REJECTED" && !linkedRejectedEffectIds.has(effect.effectId)
    ).length,
    runs: Object.freeze(runs),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_AGENT_REPAIR_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({
    projectionIdentity: hashCanonical(body),
    ...body,
  });
}
