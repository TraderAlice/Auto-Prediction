import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  AgentExecutionSnapshot,
  AgentToolEffect,
  ModelInvocation,
} from "./agent-execution-substrate.js";

const ONTOLOGY_TASK_PROTOCOLS = new Set([
  "MARKET_ONTOLOGY_NORMALIZATION_TASK_V1",
  "MARKET_ONTOLOGY_NORMALIZATION_TASK_V2",
  "MARKET_ONTOLOGY_NORMALIZATION_TASK_V3",
]);

const EVIDENCE_TOOLS = new Set([
  "list_assigned_ontology_trailheads",
  "read_ontology_trailhead_evidence",
]);
const ORDINARY_RESULT_TOOLS = new Set([
  "propose_entity_alias",
  "propose_world_proposition",
  "record_ontology_counterexample",
]);
const MECHANISM_INSPECTION_TOOLS = new Set([
  "list_world_state_mechanism_coverage",
]);
const MECHANISM_RESULT_TOOLS = new Set([
  "propose_world_state_mechanism",
  "record_world_state_mechanism_counterexample",
]);

export type OntologyAgentIntentStratum =
  | "EVIDENCE_INSPECTION"
  | "ORDINARY_ONTOLOGY_RESULT"
  | "MECHANISM_MEMORY_INSPECTION"
  | "MECHANISM_RESULT"
  | "RESULT_REPAIR"
  | "MIXED_TOOL_INTENT"
  | "NO_RETAINED_TOOL_EFFECT"
  | "HISTORICAL_UNLINKED";

export type OntologyAgentIntentCostStratum = Readonly<{
  stratum: OntologyAgentIntentStratum;
  invocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
}>;

export type OntologyAgentIntentCostProjection = Readonly<{
  schemaVersion: "pmh.ontology-agent-intent-cost-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  ontologyRunCount: number;
  ontologyInvocationCount: number;
  exactLinkedInvocationCount: number;
  historicalUnlinkedInvocationCount: number;
  unlinkedHistoricalEffectCount: number;
  invalidExactLineageEffectCount: number;
  acceptedOrdinaryResultCallCount: number;
  rejectedOrdinaryResultCallCount: number;
  mechanismInspectionCallCount: number;
  acceptedMechanismResultCallCount: number;
  rejectedMechanismResultCallCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
  totalsReconcile: true;
  strata: readonly OntologyAgentIntentCostStratum[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_ONTOLOGY_AGENT_INTENT_COST_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const STRATA = Object.freeze([
  "EVIDENCE_INSPECTION",
  "ORDINARY_ONTOLOGY_RESULT",
  "MECHANISM_MEMORY_INSPECTION",
  "MECHANISM_RESULT",
  "RESULT_REPAIR",
  "MIXED_TOOL_INTENT",
  "NO_RETAINED_TOOL_EFFECT",
  "HISTORICAL_UNLINKED",
] as const satisfies readonly OntologyAgentIntentStratum[]);

function sum(
  invocations: readonly ModelInvocation[],
  field: "inputTokens" | "outputTokens" | "reasoningTokens",
): bigint {
  return invocations.reduce((total, invocation) =>
    total + BigInt(invocation[field] ?? "0"), 0n
  );
}

function intentFor(
  invocation: ModelInvocation,
  effects: readonly AgentToolEffect[],
  runHasHistoricalUnlinkedEffects: boolean,
): OntologyAgentIntentStratum {
  if (invocation.schemaVersion === "pmh.model-invocation.v3" &&
      invocation.purpose === "RESULT_REPAIR") return "RESULT_REPAIR";
  if (effects.length === 0) {
    return runHasHistoricalUnlinkedEffects
      ? "HISTORICAL_UNLINKED"
      : "NO_RETAINED_TOOL_EFFECT";
  }
  const categories = new Set(effects.map((effect) =>
    EVIDENCE_TOOLS.has(effect.toolName) ? "EVIDENCE_INSPECTION" as const
      : ORDINARY_RESULT_TOOLS.has(effect.toolName) ? "ORDINARY_ONTOLOGY_RESULT" as const
        : MECHANISM_INSPECTION_TOOLS.has(effect.toolName)
          ? "MECHANISM_MEMORY_INSPECTION" as const
          : MECHANISM_RESULT_TOOLS.has(effect.toolName) ? "MECHANISM_RESULT" as const
            : "MIXED_TOOL_INTENT" as const
  ));
  return categories.size === 1 ? [...categories][0]! : "MIXED_TOOL_INTENT";
}

export function buildOntologyAgentIntentCostProjection(input: Readonly<{
  observedAt: string;
  execution: AgentExecutionSnapshot;
}>): OntologyAgentIntentCostProjection {
  const ontologyTaskIds = new Set(input.execution.tasks.filter((task) =>
    task.kind === "ONTOLOGY_NORMALIZATION" && ONTOLOGY_TASK_PROTOCOLS.has(task.protocol)
  ).map((task) => task.taskId));
  const runs = input.execution.runs.filter((run) => ontologyTaskIds.has(run.taskId));
  const runIds = new Set(runs.map((run) => run.runId));
  const invocations = input.execution.modelInvocations.filter((invocation) =>
    runIds.has(invocation.runId)
  );
  const effects = input.execution.toolEffects.filter((effect) => runIds.has(effect.runId));
  const invocationById = new Map(invocations.map((invocation) =>
    [invocation.invocationId, invocation] as const
  ));
  const linkedEffectsByInvocation = new Map<Hash, AgentToolEffect[]>();
  for (const effect of effects) {
    if (effect.schemaVersion !== "pmh.agent-tool-effect.v3") continue;
    const source = invocationById.get(effect.sourceInvocationId);
    if (source === undefined || source.runId !== effect.runId) continue;
    linkedEffectsByInvocation.set(effect.sourceInvocationId, [
      ...(linkedEffectsByInvocation.get(effect.sourceInvocationId) ?? []), effect,
    ]);
  }
  const runsWithHistoricalEffects = new Set(effects.filter((effect) =>
    effect.schemaVersion !== "pmh.agent-tool-effect.v3"
  ).map((effect) => effect.runId));
  const invocationsByStratum = new Map<OntologyAgentIntentStratum, ModelInvocation[]>(
    STRATA.map((stratum) => [stratum, []]),
  );
  for (const invocation of invocations) {
    const linked = linkedEffectsByInvocation.get(invocation.invocationId) ?? [];
    const stratum = intentFor(
      invocation,
      linked,
      linked.length === 0 && runsWithHistoricalEffects.has(invocation.runId),
    );
    invocationsByStratum.get(stratum)!.push(invocation);
  }
  const strata = Object.freeze(STRATA.map((stratum) => {
    const members = invocationsByStratum.get(stratum)!;
    const knownInputTokens = sum(members, "inputTokens");
    const knownOutputTokens = sum(members, "outputTokens");
    const knownReasoningTokens = sum(members, "reasoningTokens");
    return Object.freeze({
      stratum,
      invocationCount: members.length,
      knownInputTokens: knownInputTokens.toString(),
      knownOutputTokens: knownOutputTokens.toString(),
      knownReasoningTokens: knownReasoningTokens.toString(),
      knownTotalTokens: (knownInputTokens + knownOutputTokens + knownReasoningTokens).toString(),
      incompleteUsageInvocationCount: members.filter((invocation) =>
        invocation.inputTokens === null || invocation.outputTokens === null ||
        invocation.reasoningTokens === null
      ).length,
    });
  }));
  const knownInputTokens = sum(invocations, "inputTokens");
  const knownOutputTokens = sum(invocations, "outputTokens");
  const knownReasoningTokens = sum(invocations, "reasoningTokens");
  const linkedInvocationIds = new Set(linkedEffectsByInvocation.keys());
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-agent-intent-cost-projection.v1" as const,
    observedAt: input.observedAt,
    ontologyRunCount: runs.length,
    ontologyInvocationCount: invocations.length,
    exactLinkedInvocationCount: invocations.filter((invocation) =>
      linkedInvocationIds.has(invocation.invocationId)
    ).length,
    historicalUnlinkedInvocationCount: invocationsByStratum.get("HISTORICAL_UNLINKED")!.length,
    unlinkedHistoricalEffectCount: effects.filter((effect) =>
      effect.schemaVersion !== "pmh.agent-tool-effect.v3"
    ).length,
    invalidExactLineageEffectCount: effects.filter((effect) => {
      if (effect.schemaVersion !== "pmh.agent-tool-effect.v3") return false;
      const source = invocationById.get(effect.sourceInvocationId);
      return source === undefined || source.runId !== effect.runId;
    }).length,
    acceptedOrdinaryResultCallCount: effects.filter((effect) =>
      ORDINARY_RESULT_TOOLS.has(effect.toolName) && effect.status === "ACCEPTED"
    ).length,
    rejectedOrdinaryResultCallCount: effects.filter((effect) =>
      ORDINARY_RESULT_TOOLS.has(effect.toolName) && effect.status === "REJECTED"
    ).length,
    mechanismInspectionCallCount: effects.filter((effect) =>
      MECHANISM_INSPECTION_TOOLS.has(effect.toolName)
    ).length,
    acceptedMechanismResultCallCount: effects.filter((effect) =>
      MECHANISM_RESULT_TOOLS.has(effect.toolName) && effect.status === "ACCEPTED"
    ).length,
    rejectedMechanismResultCallCount: effects.filter((effect) =>
      MECHANISM_RESULT_TOOLS.has(effect.toolName) && effect.status === "REJECTED"
    ).length,
    knownInputTokens: knownInputTokens.toString(),
    knownOutputTokens: knownOutputTokens.toString(),
    knownReasoningTokens: knownReasoningTokens.toString(),
    knownTotalTokens: (knownInputTokens + knownOutputTokens + knownReasoningTokens).toString(),
    incompleteUsageInvocationCount: invocations.filter((invocation) =>
      invocation.inputTokens === null || invocation.outputTokens === null ||
      invocation.reasoningTokens === null
    ).length,
    totalsReconcile: true as const,
    strata,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_ONTOLOGY_AGENT_INTENT_COST_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
