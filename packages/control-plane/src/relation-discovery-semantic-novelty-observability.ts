import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentExecutionSnapshot, AgentToolEffect } from
  "./agent-execution-substrate.js";
import type { RelationDiscoveryFinding } from "./relation-discovery-agent-tools.js";
import {
  classifyRelationDiscoverySemanticNovelty,
  type RelationDiscoveryNoveltyClassification,
  type RelationDiscoverySemanticNoveltyDecision,
} from "./relation-discovery-semantic-novelty.js";

export type RelationDiscoverySemanticNoveltyRejection = Readonly<{
  effectId: Hash;
  runId: Hash;
  toolName: string;
  classification: "REDUNDANT_SEARCH_MEMORY" | "REDUNDANT_PAYOFF_EVIDENCE";
  overlapFindingIds: readonly Hash[];
  integrity: "EXACT" | "MALFORMED_DIAGNOSTIC";
  occurredAt: string;
}>;

export type RelationDiscoverySemanticNoveltyProjection = Readonly<{
  schemaVersion: "pmh.relation-discovery-semantic-novelty-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  retainedFindingCount: number;
  retainedDecisionCount: number;
  acceptedDecisionCount: number;
  novelSearchRouteCount: number;
  novelPayoffEvidenceCount: number;
  incomparablePayoffEvidenceCount: number;
  historicalRedundantRetainedCount: number;
  redundantSearchMemoryRejectionCount: number;
  redundantPayoffEvidenceRejectionCount: number;
  exactRejectionCount: number;
  admissionAffectedRunCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
  acceptedDecisions: readonly RelationDiscoverySemanticNoveltyDecision[];
  rejections: readonly RelationDiscoverySemanticNoveltyRejection[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_SEMANTIC_ADMISSION_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const DIAGNOSTIC = /^semantic novelty admission rejected (REDUNDANT_SEARCH_MEMORY|REDUNDANT_PAYOFF_EVIDENCE); overlap finding ids: (.+)$/u;
const HASH = /^sha256:[0-9a-f]{64}$/u;

function parseRejection(effect: AgentToolEffect):
  RelationDiscoverySemanticNoveltyRejection | null {
  if (effect.schemaVersion !== "pmh.agent-tool-effect.v2" ||
      effect.status !== "REJECTED" || effect.diagnostic === null ||
      !["record_relation_hypothesis", "record_relation_counterexample",
        "record_ontology_route"].includes(effect.toolName) ||
      !effect.diagnostic.startsWith("semantic novelty admission rejected ")) {
    return null;
  }
  const match = effect.diagnostic.match(DIAGNOSTIC);
  const classification = match?.[1] as
    "REDUNDANT_SEARCH_MEMORY" | "REDUNDANT_PAYOFF_EVIDENCE" | undefined;
  const ids = match?.[2] === "none" ? [] : (match?.[2]?.split(",") ?? []);
  const exact = classification !== undefined && ids.length > 0 && ids.every((id) =>
    HASH.test(id)
  );
  return Object.freeze({
    effectId: effect.effectId,
    runId: effect.runId,
    toolName: effect.toolName,
    classification: classification ?? "REDUNDANT_PAYOFF_EVIDENCE",
    overlapFindingIds: Object.freeze(exact ? ids as Hash[] : []),
    integrity: exact ? "EXACT" as const : "MALFORMED_DIAGNOSTIC" as const,
    occurredAt: effect.occurredAt,
  });
}

function acceptedDecisions(
  findingsInput: readonly RelationDiscoveryFinding[],
): readonly RelationDiscoverySemanticNoveltyDecision[] {
  const prior: RelationDiscoveryFinding[] = [];
  const decisions: RelationDiscoverySemanticNoveltyDecision[] = [];
  const findings = [...findingsInput].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt) ||
    left.findingId.localeCompare(right.findingId)
  );
  for (const finding of findings) {
    decisions.push(classifyRelationDiscoverySemanticNovelty({
      candidate: finding,
      retainedFindings: prior,
    }));
    prior.push(finding);
  }
  return Object.freeze(decisions);
}

function count(
  decisions: readonly RelationDiscoverySemanticNoveltyDecision[],
  classification: RelationDiscoveryNoveltyClassification,
): number {
  return decisions.filter((item) => item.classification === classification).length;
}

export function buildRelationDiscoverySemanticNoveltyProjection(input: Readonly<{
  observedAt: string;
  findings: readonly RelationDiscoveryFinding[];
  execution: AgentExecutionSnapshot;
}>): RelationDiscoverySemanticNoveltyProjection {
  const decisions = acceptedDecisions(input.findings);
  const rejections = Object.freeze(input.execution.toolEffects.map(parseRejection)
    .filter((item): item is RelationDiscoverySemanticNoveltyRejection => item !== null)
    .sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) ||
      left.effectId.localeCompare(right.effectId)
    ));
  const affectedRunIds = new Set<Hash>([
    ...rejections.map((item) => item.runId),
    ...input.findings.map((item) => item.sourceAgentRunId),
  ]);
  const invocations = input.execution.modelInvocations.filter((item) =>
    affectedRunIds.has(item.runId)
  );
  const sum = (field: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, invocation) =>
      total + BigInt(invocation[field] ?? "0"), 0n
    );
  const knownInputTokens = sum("inputTokens");
  const knownOutputTokens = sum("outputTokens");
  const knownReasoningTokens = sum("reasoningTokens");
  const recentDecisions = Object.freeze([...decisions].reverse().slice(0, 24));
  const body = Object.freeze({
    schemaVersion: "pmh.relation-discovery-semantic-novelty-projection.v1" as const,
    observedAt: input.observedAt,
    retainedFindingCount: input.findings.length,
    retainedDecisionCount: decisions.length,
    acceptedDecisionCount: decisions.filter((item) => item.admitted).length,
    novelSearchRouteCount: count(decisions, "NOVEL_SEARCH_ROUTE"),
    novelPayoffEvidenceCount: count(decisions, "NOVEL_PAYOFF_EVIDENCE"),
    incomparablePayoffEvidenceCount: count(decisions, "INCOMPARABLE_PAYOFF_EVIDENCE"),
    historicalRedundantRetainedCount:
      count(decisions, "REDUNDANT_SEARCH_MEMORY") +
      count(decisions, "REDUNDANT_PAYOFF_EVIDENCE"),
    redundantSearchMemoryRejectionCount: rejections.filter((item) =>
      item.classification === "REDUNDANT_SEARCH_MEMORY"
    ).length,
    redundantPayoffEvidenceRejectionCount: rejections.filter((item) =>
      item.classification === "REDUNDANT_PAYOFF_EVIDENCE"
    ).length,
    exactRejectionCount: rejections.filter((item) => item.integrity === "EXACT").length,
    admissionAffectedRunCount: affectedRunIds.size,
    knownInputTokens: knownInputTokens.toString(),
    knownOutputTokens: knownOutputTokens.toString(),
    knownReasoningTokens: knownReasoningTokens.toString(),
    knownTotalTokens: (knownInputTokens + knownOutputTokens + knownReasoningTokens).toString(),
    incompleteUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null ||
      item.reasoningTokens === null
    ).length,
    acceptedDecisions: Object.freeze(recentDecisions.filter((item) => item.admitted)),
    rejections: Object.freeze(rejections.slice(0, 24)),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_SEMANTIC_ADMISSION_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
