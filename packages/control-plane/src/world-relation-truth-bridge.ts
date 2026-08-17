import { hashCanonical, type Hash } from "@pmh/domain";
import type { SemanticConstraintDraft } from "./semantic-constraint.js";
import {
  assertSettlementProjection,
  assertWorldPredicateArtifact,
  assertWorldRelationExperiment,
  type SettlementProjection,
  type WorldPredicateArtifact,
  type WorldRelationExperiment,
} from "./world-history-ontology.js";

export type WorldRelationTruthBridgeBlocker =
  | "RELATION_NOT_COMPILER_ELIGIBLE"
  | "MISSING_PREDICATE_ARTIFACT"
  | "MISSING_SETTLEMENT_PROJECTION"
  | "NON_EXACT_SETTLEMENT_PROJECTION"
  | "PROJECTION_LISTING_DUPLICATED"
  | "PROJECTION_STATE_UNRESOLVED"
  | "LATENT_STATE_COLLAPSE"
  | "NO_ADVERSE_LISTING_STATE";

export type WorldRelationListingTruthState = Readonly<{
  stateId: string;
  truthByListingRef: Readonly<Record<string, boolean>>;
  disposition: "FEASIBLE" | "IMPOSSIBLE" | "ADVERSE" | "MIXED";
  adverseWorldCount: number;
  nonAdverseWorldCount: number;
  sourceWorldStateIds: readonly string[];
}>;

export type WorldRelationTruthBridge = Readonly<{
  schemaVersion: "pmh.world-relation-truth-bridge.v1";
  bridgeIdentity: Hash;
  sourceExperimentId: Hash;
  sourceExperimentArtifactHash: Hash;
  predicateIds: readonly Hash[];
  projectionIds: readonly Hash[];
  listingRefs: readonly string[];
  listingTruthStates: readonly WorldRelationListingTruthState[];
  collapsedListingStates: readonly Readonly<{
    stateId: string;
    adverseWorldCount: number;
    nonAdverseWorldCount: number;
  }>[];
  admission:
    | "HARD_SEMANTIC_CONSTRAINT_DRAFT"
    | "PROBABILITY_BOUND_DRAFT"
    | "RESEARCH_ONLY";
  blockers: readonly WorldRelationTruthBridgeBlocker[];
  semanticConstraintDraft: SemanticConstraintDraft | null;
  probabilityBoundDraft: Readonly<{ adverseStateIds: readonly string[] }> | null;
  authority: "COMPILER_INPUT_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

function allTruthAssignments(ids: readonly string[]): readonly Readonly<Record<string, boolean>>[] {
  return Object.freeze(Array.from({ length: 2 ** ids.length }, (_, value) =>
    Object.freeze(Object.fromEntries(ids.map((id, index) => [
      id,
      (value & (1 << (ids.length - index - 1))) !== 0,
    ])))
  ));
}

function stateId(ids: readonly string[], truths: Readonly<Record<string, boolean>>): string {
  return ids.map((id) => truths[id] ? "T" : "F").join("");
}

function projectionTruth(
  projection: SettlementProjection,
  worldTruth: Readonly<Record<string, boolean>>,
): boolean | null {
  const projectionStateId = stateId(projection.predicateIds, worldTruth);
  const state = projection.truthStates.find((item) => item.stateId === projectionStateId);
  return state?.disposition === "RESOLVES" ? state.listingTruth : null;
}

function relationKind(experiment: WorldRelationExperiment): SemanticConstraintDraft["relationKind"] {
  if (experiment.relationKind === "EQUIVALENT") return "EQUIVALENT";
  if (experiment.relationKind === "IMPLIES" ||
      experiment.relationKind === "TEMPORAL_PREREQUISITE") return "IMPLIES";
  if (experiment.relationKind === "MUTUALLY_EXCLUSIVE") return "MUTUALLY_EXCLUSIVE";
  if (experiment.relationKind === "STATE_MEDIATED_INHIBITION" ||
      experiment.relationKind === "COMMON_CAUSE_DEPENDENCE") return "CONDITIONAL";
  return "RELATED";
}

export function compileWorldRelationTruthBridge(input: Readonly<{
  experiment: WorldRelationExperiment;
  predicates: readonly WorldPredicateArtifact[];
  projections: readonly SettlementProjection[];
}>): WorldRelationTruthBridge {
  const experiment = assertWorldRelationExperiment(input.experiment);
  const predicates = input.predicates.map(assertWorldPredicateArtifact);
  const projections = input.projections.map(assertSettlementProjection)
    .sort((left, right) => left.listing.listingRef.localeCompare(right.listing.listingRef));
  const predicateById = new Map(predicates.map((item) => [item.predicateId, item] as const));
  const blockers: WorldRelationTruthBridgeBlocker[] = [];
  if (experiment.predicateIds.some((item) => !predicateById.has(item))) {
    blockers.push("MISSING_PREDICATE_ARTIFACT");
  }
  if (!["SUPPORTED_HARD", "SUPPORTED_PROBABILISTIC"]
    .includes(experiment.terminalDisposition)) {
    blockers.push("RELATION_NOT_COMPILER_ELIGIBLE");
  }
  const coveredPredicateIds = new Set(projections.flatMap((item) => item.predicateIds));
  const observablePredicateIds = experiment.predicateIds.filter((item) =>
    !experiment.latentPredicateIds.includes(item)
  );
  if (observablePredicateIds.some((item) => !coveredPredicateIds.has(item))) {
    blockers.push("MISSING_SETTLEMENT_PROJECTION");
  }
  if (projections.some((item) => item.compilerAdmission !== "EXACT_BINARY_ELIGIBLE")) {
    blockers.push("NON_EXACT_SETTLEMENT_PROJECTION");
  }
  const listingRefs = Object.freeze(projections.map((item) => item.listing.listingRef));
  if (new Set(listingRefs).size !== listingRefs.length) {
    blockers.push("PROJECTION_LISTING_DUPLICATED");
  }

  const adverseWorlds = new Set(experiment.adverseAssignments.map((item) => item.stateId));
  const bucket = new Map<string, {
    truths: Readonly<Record<string, boolean>>;
    adverse: number;
    nonAdverse: number;
    worldIds: string[];
  }>();
  if (!blockers.includes("MISSING_PREDICATE_ARTIFACT")) {
    for (const worldTruth of allTruthAssignments(experiment.predicateIds)) {
      const listingTruthPairs = projections.map((projection) => [
        projection.listing.listingRef,
        projectionTruth(projection, worldTruth),
      ] as const);
      if (listingTruthPairs.some((pair) => pair[1] === null)) {
        blockers.push("PROJECTION_STATE_UNRESOLVED");
        continue;
      }
      const listingTruth = Object.freeze(Object.fromEntries(listingTruthPairs) as Record<string, boolean>);
      const listingStateId = stateId(listingRefs, listingTruth);
      const worldStateId = stateId(experiment.predicateIds, worldTruth);
      const retained = bucket.get(listingStateId) ?? {
        truths: listingTruth,
        adverse: 0,
        nonAdverse: 0,
        worldIds: [],
      };
      if (adverseWorlds.has(worldStateId)) retained.adverse += 1;
      else retained.nonAdverse += 1;
      retained.worldIds.push(worldStateId);
      bucket.set(listingStateId, retained);
    }
  }
  const listingTruthStates = Object.freeze([...bucket.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([listingStateId, item]) => Object.freeze({
      stateId: listingStateId,
      truthByListingRef: item.truths,
      disposition: item.adverse > 0 && item.nonAdverse > 0
        ? "MIXED" as const
        : item.adverse > 0
          ? experiment.terminalDisposition === "SUPPORTED_HARD"
            ? "IMPOSSIBLE" as const
            : "ADVERSE" as const
          : "FEASIBLE" as const,
      adverseWorldCount: item.adverse,
      nonAdverseWorldCount: item.nonAdverse,
      sourceWorldStateIds: Object.freeze(item.worldIds.sort()),
    })));
  const collapsedListingStates = Object.freeze(listingTruthStates
    .filter((item) => item.adverseWorldCount > 0 && item.nonAdverseWorldCount > 0)
    .map((item) => Object.freeze({
      stateId: item.stateId,
      adverseWorldCount: item.adverseWorldCount,
      nonAdverseWorldCount: item.nonAdverseWorldCount,
    })));
  if (collapsedListingStates.length > 0) blockers.push("LATENT_STATE_COLLAPSE");
  const adverseStateIds = Object.freeze(listingTruthStates
    .filter((item) => item.adverseWorldCount > 0 && item.nonAdverseWorldCount === 0)
    .map((item) => item.stateId));
  if (adverseStateIds.length === 0) blockers.push("NO_ADVERSE_LISTING_STATE");
  const uniqueBlockers = Object.freeze([...new Set(blockers)]);

  const hard = experiment.terminalDisposition === "SUPPORTED_HARD" &&
    uniqueBlockers.length === 0;
  const probabilistic = experiment.terminalDisposition === "SUPPORTED_PROBABILISTIC" &&
    uniqueBlockers.length === 0;
  const semanticConstraintDraft: SemanticConstraintDraft | null = hard
    ? Object.freeze({
        classification: "HARD_SETTLEMENT_CONSTRAINT" as const,
        relationKind: relationKind(experiment),
        assumptions: Object.freeze([]),
        counterexampleAttempt: Object.freeze({
          attempted: true as const,
          result: "NOT_FOUND" as const,
          narrative: "Every retained counterworld was rejected in the source world-relation experiment.",
          truths: null,
        }),
        truthTable: Object.freeze(listingTruthStates.map((item) => Object.freeze({
          truths: Object.freeze(listingRefs.map((listingRef) =>
            item.truthByListingRef[listingRef]!
          )),
          disposition: item.disposition === "IMPOSSIBLE"
            ? "IMPOSSIBLE" as const
            : "FEASIBLE" as const,
          rationale: item.disposition === "IMPOSSIBLE"
            ? "The admitted hard world relation rejects every world mapped to this listing state."
            : "At least one relation-consistent world maps to this listing state.",
          evidenceListingRefs: item.disposition === "IMPOSSIBLE" ? listingRefs : Object.freeze([]),
        }))),
        unresolvedEvidence: Object.freeze([]),
      })
    : null;
  const probabilityBoundDraft = probabilistic
    ? Object.freeze({ adverseStateIds })
    : null;
  const admission = hard
    ? "HARD_SEMANTIC_CONSTRAINT_DRAFT" as const
    : probabilistic
      ? "PROBABILITY_BOUND_DRAFT" as const
      : "RESEARCH_ONLY" as const;
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-truth-bridge.v1" as const,
    sourceExperimentId: experiment.experimentId,
    sourceExperimentArtifactHash: experiment.artifactHash,
    predicateIds: experiment.predicateIds,
    projectionIds: Object.freeze(projections.map((item) => item.projectionId)),
    listingRefs,
    listingTruthStates,
    collapsedListingStates,
    admission,
    blockers: uniqueBlockers,
    semanticConstraintDraft,
    probabilityBoundDraft,
    authority: "COMPILER_INPUT_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, bridgeIdentity: hashCanonical(body) });
}
