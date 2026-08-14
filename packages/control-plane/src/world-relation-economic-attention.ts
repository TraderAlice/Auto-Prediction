import { hashCanonical, type Hash } from "@pmh/domain";
import type { WorldRelationFrontierSeed } from
  "./world-history-ontology-adapter.js";
import {
  assertWorldRelationEconomicMemory,
  type WorldRelationEconomicMemory,
} from "./world-relation-economic-memory.js";

export type WorldRelationEconomicAttentionObservation = Readonly<{
  memoryId: Hash;
  sourceFrontierArtifactHash: Hash;
  relationKind: WorldRelationFrontierSeed["relationKind"];
  predicateSummaries: readonly string[];
  routeAction: WorldRelationEconomicMemory["routeAction"];
  grossFailureBudgetPpm: string | null;
  selectionSignal:
    | "DIVERSIFY_FROM_NON_POSITIVE_CONSTRUCTION"
    | "INCOMPLETE_CONSTRUCTION_NEEDS_COVERAGE"
    | "SETTLEMENT_DEBT_AFTER_POSITIVE_SCREEN"
    | "PROBABILITY_DEBT_AFTER_POSITIVE_SCREEN"
    | "HOLD_UNQUALIFIED_RESEARCH";
}>;

export type WorldRelationEconomicAttentionProjection = Readonly<{
  schemaVersion: "pmh.world-relation-economic-attention.v1";
  projectionIdentity: Hash;
  observationCount: number;
  retiredConstructionCount: number;
  incompleteConstructionCount: number;
  positiveScreenCount: number;
  observations: readonly WorldRelationEconomicAttentionObservation[];
  recommendedMutation:
    | "DIVERSIFY_SEMANTIC_DOMAIN"
    | "REPAIR_POSITIVE_SCREEN_EVIDENCE"
    | "SEEK_FIRST_ECONOMIC_OBSERVATION";
  recommendationRationale: string;
  priceIsSemanticTruth: false;
  schedulingAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function predicateSummary(frontier: WorldRelationFrontierSeed): readonly string[] {
  return Object.freeze(frontier.predicates.map((predicate) =>
    `${predicate.semantic.subjects.map((subject) => subject.canonicalLabel).join(", ")} ${predicate.semantic.verbPhrase}`
      .trim()
  ).sort());
}

function budgetPpm(memory: WorldRelationEconomicMemory): string | null {
  if (memory.grossFailureBudgetUnits === null || memory.commonPriceScale === null ||
      BigInt(memory.commonPriceScale) <= 0n) return null;
  return (BigInt(memory.grossFailureBudgetUnits) * 1_000_000n /
    BigInt(memory.commonPriceScale)).toString();
}

export function buildWorldRelationEconomicAttention(input: Readonly<{
  memories: readonly WorldRelationEconomicMemory[];
  frontiers: readonly WorldRelationFrontierSeed[];
}>): WorldRelationEconomicAttentionProjection {
  const frontierByArtifactHash = new Map(input.frontiers.map((frontier) =>
    [frontier.artifactHash, frontier] as const));
  const observations = Object.freeze(input.memories
    .map(assertWorldRelationEconomicMemory)
    .flatMap((memory) => {
      const frontier = frontierByArtifactHash.get(memory.sourceFrontierArtifactHash);
      if (frontier === undefined) return [];
      const selectionSignal = memory.routeAction === "RETIRE_NON_POSITIVE_MARGIN"
        ? "DIVERSIFY_FROM_NON_POSITIVE_CONSTRUCTION" as const
        : memory.routeAction === "ACQUIRE_PROJECTION_COVERAGE"
          ? "INCOMPLETE_CONSTRUCTION_NEEDS_COVERAGE" as const
          : memory.routeAction === "ACQUIRE_SETTLEMENT_EVIDENCE"
            ? "SETTLEMENT_DEBT_AFTER_POSITIVE_SCREEN" as const
            : memory.routeAction === "ESTIMATE_ADVERSE_PROBABILITY"
              ? "PROBABILITY_DEBT_AFTER_POSITIVE_SCREEN" as const
              : "HOLD_UNQUALIFIED_RESEARCH" as const;
      return [Object.freeze({ memoryId: memory.memoryId,
        sourceFrontierArtifactHash: memory.sourceFrontierArtifactHash,
        relationKind: frontier.relationKind,
        predicateSummaries: predicateSummary(frontier),
        routeAction: memory.routeAction,
        grossFailureBudgetPpm: budgetPpm(memory), selectionSignal })];
    })
    .sort((left, right) => left.memoryId.localeCompare(right.memoryId))
    .slice(0, 16));
  const retiredConstructionCount = observations.filter((item) =>
    item.selectionSignal === "DIVERSIFY_FROM_NON_POSITIVE_CONSTRUCTION").length;
  const incompleteConstructionCount = observations.filter((item) =>
    item.selectionSignal === "INCOMPLETE_CONSTRUCTION_NEEDS_COVERAGE").length;
  const positiveScreenCount = observations.filter((item) =>
    item.selectionSignal === "SETTLEMENT_DEBT_AFTER_POSITIVE_SCREEN" ||
    item.selectionSignal === "PROBABILITY_DEBT_AFTER_POSITIVE_SCREEN").length;
  const recommendedMutation = positiveScreenCount > 0
    ? "REPAIR_POSITIVE_SCREEN_EVIDENCE" as const
    : retiredConstructionCount > 0
      ? "DIVERSIFY_SEMANTIC_DOMAIN" as const
      : "SEEK_FIRST_ECONOMIC_OBSERVATION" as const;
  const recommendationRationale = recommendedMutation === "REPAIR_POSITIVE_SCREEN_EVIDENCE"
    ? "At least one complete construction passed the indicative economic screen; preserve its semantic shape while repairing exact downstream evidence."
    : recommendedMutation === "DIVERSIFY_SEMANTIC_DOMAIN"
      ? "Observed complete constructions include a non-positive complement budget; vary the semantic domain or relation shape instead of cloning the retired frontier."
      : "No complete economically observed construction exists; seek a relation that can reach a two-leg quote screen.";
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-economic-attention.v1" as const,
    observationCount: observations.length,
    retiredConstructionCount,
    incompleteConstructionCount,
    positiveScreenCount,
    observations,
    recommendedMutation,
    recommendationRationale,
    priceIsSemanticTruth: false as const,
    schedulingAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}

export function assertWorldRelationEconomicAttention(
  value: unknown,
): WorldRelationEconomicAttentionProjection {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("world relation economic attention is malformed");
  }
  const item = value as WorldRelationEconomicAttentionProjection;
  const { projectionIdentity, ...body } = item;
  const retiredConstructionCount = item.observations.filter((observation) =>
    observation.selectionSignal === "DIVERSIFY_FROM_NON_POSITIVE_CONSTRUCTION").length;
  const incompleteConstructionCount = item.observations.filter((observation) =>
    observation.selectionSignal === "INCOMPLETE_CONSTRUCTION_NEEDS_COVERAGE").length;
  const positiveScreenCount = item.observations.filter((observation) =>
    observation.selectionSignal === "SETTLEMENT_DEBT_AFTER_POSITIVE_SCREEN" ||
    observation.selectionSignal === "PROBABILITY_DEBT_AFTER_POSITIVE_SCREEN").length;
  const expectedRecommendation = positiveScreenCount > 0
    ? "REPAIR_POSITIVE_SCREEN_EVIDENCE"
    : retiredConstructionCount > 0
      ? "DIVERSIFY_SEMANTIC_DOMAIN"
      : "SEEK_FIRST_ECONOMIC_OBSERVATION";
  if (item.schemaVersion !== "pmh.world-relation-economic-attention.v1" ||
      projectionIdentity !== hashCanonical(body) ||
      item.observationCount !== item.observations.length ||
      item.retiredConstructionCount !== retiredConstructionCount ||
      item.incompleteConstructionCount !== incompleteConstructionCount ||
      item.positiveScreenCount !== positiveScreenCount ||
      item.observations.length > 16 ||
      item.observations.some((observation) =>
        !/^sha256:[0-9a-f]{64}$/u.test(observation.memoryId) ||
        !/^sha256:[0-9a-f]{64}$/u.test(observation.sourceFrontierArtifactHash) ||
        observation.predicateSummaries.length < 1 ||
        observation.predicateSummaries.some((summary) => summary.length > 1_000) ||
        (observation.grossFailureBudgetPpm !== null &&
          !/^-?[0-9]+$/u.test(observation.grossFailureBudgetPpm))) ||
      item.recommendedMutation !== expectedRecommendation ||
      typeof item.recommendationRationale !== "string" ||
      item.recommendationRationale.length < 1 || item.recommendationRationale.length > 1_000 ||
      item.priceIsSemanticTruth !== false || item.schedulingAuthority !== false ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("world relation economic attention violates its bounded contract");
  }
  return Object.freeze(item);
}
