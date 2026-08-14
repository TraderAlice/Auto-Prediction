import { hashCanonical, type Hash } from "@pmh/domain";
import type { WorldRelationShadowTradeHypothesis } from
  "./world-relation-shadow-hypothesis.js";
import type { WorldRelationShadowRouteAction } from
  "./world-relation-shadow-routing.js";

const HASH = /^sha256:[0-9a-f]{64}$/u;
const INTEGER = /^-?[0-9]+$/u;

export type WorldRelationEconomicMemory = Readonly<{
  schemaVersion: "pmh.world-relation-economic-memory.v1";
  memoryId: Hash;
  sourceExperimentArtifactHash: Hash;
  sourceInputRevisionId: Hash;
  sourceFrontierArtifactHash: Hash;
  sourceHypothesisId: Hash;
  quoteCorpusSnapshotIdentity: Hash;
  adverseWorldStateId: string;
  adverseListingStateId: string;
  routeAction: WorldRelationShadowRouteAction["action"];
  totalIndicativeCostUnits: string | null;
  commonPriceScale: string | null;
  grossFailureBudgetUnits: string | null;
  breakEvenAdverseProbabilityUpperPpm: string | null;
  blockers: readonly string[];
  quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH";
  memoryPosture: "TERMINAL_ECONOMIC_RESEARCH_MEMORY";
  authority: "AGENT_REASONING_INPUT_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function exactStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export function buildWorldRelationEconomicMemory(input: Readonly<{
  hypothesis: WorldRelationShadowTradeHypothesis;
  routeAction: WorldRelationShadowRouteAction;
  sourceFrontierArtifactHash: Hash;
}>): WorldRelationEconomicMemory {
  if (input.routeAction.hypothesisId !== input.hypothesis.hypothesisId) {
    throw new Error("world relation economic memory requires an exact route action");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-economic-memory.v1" as const,
    sourceExperimentArtifactHash: input.hypothesis.sourceExperimentArtifactHash,
    sourceInputRevisionId: input.hypothesis.sourceInputRevisionId,
    sourceFrontierArtifactHash: input.sourceFrontierArtifactHash,
    sourceHypothesisId: input.hypothesis.hypothesisId,
    quoteCorpusSnapshotIdentity: input.hypothesis.quoteCorpusSnapshotIdentity,
    adverseWorldStateId: input.hypothesis.adverseWorldStateId,
    adverseListingStateId: input.hypothesis.adverseListingStateId,
    routeAction: input.routeAction.action,
    totalIndicativeCostUnits: input.hypothesis.payoffShape.totalIndicativeCostUnits,
    commonPriceScale: input.hypothesis.payoffShape.commonPriceScale,
    grossFailureBudgetUnits: input.hypothesis.payoffShape.grossFailureBudgetUnits,
    breakEvenAdverseProbabilityUpperPpm:
      input.hypothesis.payoffShape.breakEvenAdverseProbabilityUpperPpm,
    blockers: exactStrings(input.hypothesis.blockers),
    quotePosture: input.hypothesis.quotePosture,
    memoryPosture: "TERMINAL_ECONOMIC_RESEARCH_MEMORY" as const,
    authority: "AGENT_REASONING_INPUT_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, memoryId: hashCanonical(body) });
}

export function assertWorldRelationEconomicMemory(
  value: unknown,
): WorldRelationEconomicMemory {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("world relation economic memory is malformed");
  }
  const memory = value as WorldRelationEconomicMemory;
  const { memoryId, ...body } = memory;
  const monetary = [memory.totalIndicativeCostUnits, memory.commonPriceScale,
    memory.grossFailureBudgetUnits, memory.breakEvenAdverseProbabilityUpperPpm];
  if (memory.schemaVersion !== "pmh.world-relation-economic-memory.v1" ||
      !HASH.test(String(memoryId)) || memoryId !== hashCanonical(body) ||
      ![memory.sourceExperimentArtifactHash, memory.sourceInputRevisionId,
        memory.sourceFrontierArtifactHash, memory.sourceHypothesisId,
        memory.quoteCorpusSnapshotIdentity]
        .every((item) => HASH.test(String(item))) ||
      !/^(?:[TF]{2,4})?$/u.test(memory.adverseListingStateId) ||
      (memory.adverseListingStateId === "") !==
        memory.blockers.includes("INSPECTED_LISTINGS_LACK_SETTLEMENT_PROJECTIONS") ||
      !/^[TF]{2,8}$/u.test(memory.adverseWorldStateId) ||
      monetary.some((item) => item !== null && !INTEGER.test(item)) ||
      memory.blockers.join("\n") !== exactStrings(memory.blockers).join("\n") ||
      !["RETIRE_NON_POSITIVE_MARGIN", "ACQUIRE_PROJECTION_COVERAGE",
        "ACQUIRE_SETTLEMENT_EVIDENCE",
        "ESTIMATE_ADVERSE_PROBABILITY", "HOLD_RESEARCH_ONLY"]
        .includes(memory.routeAction) ||
      memory.quotePosture !== "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH" ||
      memory.memoryPosture !== "TERMINAL_ECONOMIC_RESEARCH_MEMORY" ||
      memory.authority !== "AGENT_REASONING_INPUT_ONLY" ||
      memory.semanticDecisionAuthority !== false || memory.probabilityAuthority !== false ||
      memory.certificateAuthority !== false || memory.executionAuthority !== false ||
      memory.externalWriteAuthority !== false || memory.valueMovingAuthority !== false) {
    throw new Error("world relation economic memory violates its bounded contract");
  }
  return Object.freeze(memory);
}
