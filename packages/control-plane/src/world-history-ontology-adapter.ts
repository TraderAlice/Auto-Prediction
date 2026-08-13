import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  MarketOntologyWorldPropositionProposal,
} from "./market-ontology-agent-tools.js";
import type { MarketOntologySnapshot } from "./market-ontology.js";
import type { WorldStateMechanismProposal } from "./world-state-mechanism.js";
import {
  buildWorldPredicateArtifact,
  type WorldPredicateArtifact,
  type WorldPredicateEvidenceBinding,
  type WorldPredicateOperatorKind,
  type WorldRelationKind,
} from "./world-history-ontology.js";

export type WorldRelationFrontierSeed = Readonly<{
  schemaVersion: "pmh.world-relation-frontier-seed.v1";
  frontierId: Hash;
  artifactHash: Hash;
  predicates: readonly WorldPredicateArtifact[];
  relationKind: WorldRelationKind;
  antecedentPredicateIds: readonly Hash[];
  consequentPredicateIds: readonly Hash[];
  latentPredicateIds: readonly Hash[];
  temporalPosture:
    | "ANTECEDENT_PRECEDES_CONSEQUENT"
    | "OVERLAPPING_INTERVALS"
    | "ORDER_UNRESOLVED";
  searchNeighborhoods: readonly string[];
  counterworlds: readonly string[];
  rationale: string;
  sourceMechanismProposalId: Hash;
  sourceAgentRunId: Hash;
  disposition: "UNTESTED_RELATION_FRONTIER";
  authority: "RELATION_EXPERIMENT_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function operatorFor(value: string): WorldPredicateOperatorKind {
  if (/\b(?:appear|attend|debate|drink|eat|livestream|stream|speech|travel|visit|perform|say|post|tweet)\b/iu
    .test(value)) return "PUBLIC_ACTION";
  if (/\b(?:state|able|ability|alive|dead|incapacitated|eligible|holding|available|possession|located|willing)\b/iu
    .test(value)) return "STATE_PRESENCE";
  if (/\b(?:above|below|under|over|at least|at most|exceed|less than|more than)\b|\d/iu
    .test(value)) return "THRESHOLD";
  if (/\b(?:winner|selected|member|nominee|elected|appointed)\b/iu.test(value)) {
    return "MEMBERSHIP_OR_SELECTION";
  }
  return "OCCURRENCE";
}

function subjectEntityType(value: string): "PERSON" | "ORGANIZATION" | "PLACE" | "OTHER" {
  if (/\b(?:party|team|company|organization|government|senate|house|court)\b/iu.test(value)) {
    return "ORGANIZATION";
  }
  if (/\b(?:state|country|city|county|district)\b/iu.test(value)) return "PLACE";
  return "PERSON";
}

function predicate(input: Readonly<{
  subjects: readonly string[];
  verbPhrase: string;
  operatorKind?: WorldPredicateOperatorKind;
  parameters?: readonly Readonly<{ name: string; value: string; unit: string | null }>[];
  evidenceBindings: readonly WorldPredicateEvidenceBinding[];
  ambiguityNotes: readonly string[];
  counterworlds: readonly string[];
  ontologyIdentity: Hash;
  snapshotIdentity: Hash;
  sourceAgentRunId: Hash;
  proposedAt: string;
}>): WorldPredicateArtifact {
  return buildWorldPredicateArtifact({
    semantic: {
      operatorKind: input.operatorKind ?? operatorFor(input.verbPhrase),
      subjects: input.subjects.map((canonicalLabel) => ({
        canonicalLabel,
        entityType: subjectEntityType(canonicalLabel),
      })),
      verbPhrase: input.verbPhrase,
      timeScope: { startsAt: null, endsAt: null, precision: "UNRESOLVED" },
      parameters: input.parameters ?? [],
      polarity: "POSITIVE",
    },
    observability: input.evidenceBindings.length === 0
      ? "LATENT_HYPOTHESIS"
      : "DERIVED",
    epistemicPosture: input.evidenceBindings.length === 0
      ? "SEARCH_HYPOTHESIS_ONLY"
      : "EVIDENCE_BOUND_PROPOSITION",
    evidenceBindings: input.evidenceBindings,
    ambiguityNotes: input.ambiguityNotes,
    counterworlds: input.counterworlds,
    source: {
      sourceOntologyIdentities: [input.ontologyIdentity],
      sourceSnapshotIdentities: [input.snapshotIdentity],
      sourceAgentRunIds: [input.sourceAgentRunId],
      sourceToolEffectIds: [],
    },
    proposedAt: input.proposedAt,
  });
}

export function adaptMarketOntologyWorldProposition(input: Readonly<{
  proposal: MarketOntologyWorldPropositionProposal;
  ontology: MarketOntologySnapshot;
}>): WorldPredicateArtifact {
  const proposal = input.proposal;
  if (proposal.kind !== "WORLD_PROPOSITION" ||
      proposal.ontologyIdentity !== input.ontology.ontologyIdentity ||
      proposal.sourceSnapshotIdentity !== input.ontology.sourceSnapshotIdentity) {
    throw new Error("world proposition adapter received mismatched ontology lineage");
  }
  const nodeByRef = new Map(input.ontology.nodes.map((item) => [item.listingRef, item] as const));
  const evidenceBindings = proposal.listingBindings.map((binding) => {
    const node = nodeByRef.get(binding.listingRef);
    if (node === undefined || node.nodeId !== binding.nodeId ||
        node.worldFacet.facetId !== binding.worldFacetId ||
        node.settlementFacet.facetId !== binding.settlementFacetId ||
        node.tradedFacet.facetId !== binding.tradedFacetId) {
      throw new Error("world proposition adapter listing binding is stale");
    }
    return Object.freeze({
      listingRef: node.listingRef,
      nodeId: node.nodeId,
      worldFacetId: node.worldFacet.facetId,
      sourceRawHash: node.settlementFacet.sourceRawHash as Hash,
      protocolIdentity: node.settlementFacet.protocolIdentity,
    });
  });
  return predicate({
    subjects: proposal.subjectLabels,
    verbPhrase: proposal.predicate,
    parameters: [
      ...(proposal.timeScope === null ? [] : [{
        name: "legacy_time_scope",
        value: proposal.timeScope,
        unit: null,
      }]),
      ...proposal.parameters.map((value, index) => ({
        name: `legacy_parameter_${index + 1}`,
        value,
        unit: null,
      })),
    ],
    evidenceBindings,
    ambiguityNotes: proposal.ambiguityNotes,
    counterworlds: proposal.falsifiers,
    ontologyIdentity: proposal.ontologyIdentity,
    snapshotIdentity: proposal.sourceSnapshotIdentity,
    sourceAgentRunId: proposal.sourceAgentRunId,
    proposedAt: proposal.proposedAt,
  });
}

function mechanismEvidence(
  bindings: WorldStateMechanismProposal["trigger"]["evidenceBindings"],
): readonly WorldPredicateEvidenceBinding[] {
  return Object.freeze(bindings.map((item) => Object.freeze({
    listingRef: item.listingRef,
    nodeId: item.nodeId,
    worldFacetId: item.worldFacetId,
    sourceRawHash: item.sourceRawHash,
    protocolIdentity: item.protocolIdentity,
  })));
}

function relationKind(proposal: WorldStateMechanismProposal): WorldRelationKind {
  if (proposal.trigger.influence === "MAY_DEGRADE_STATE" &&
      proposal.dependent.requirement === "REQUIRES_STATE_PRESENT") {
    return "STATE_MEDIATED_INHIBITION";
  }
  if (proposal.trigger.influence === "MAY_ENABLE_STATE" &&
      proposal.dependent.requirement === "REQUIRES_STATE_PRESENT") {
    return "TEMPORAL_PREREQUISITE";
  }
  return "COMMON_CAUSE_DEPENDENCE";
}

export function adaptWorldStateMechanismProposal(
  proposal: WorldStateMechanismProposal,
): WorldRelationFrontierSeed {
  const common = {
    subjects: [proposal.subjectLabel],
    ontologyIdentity: proposal.ontologyIdentity,
    snapshotIdentity: proposal.sourceSnapshotIdentity,
    sourceAgentRunId: proposal.sourceAgentRunId,
    proposedAt: proposal.proposedAt,
  } as const;
  const trigger = predicate({
    ...common,
    verbPhrase: proposal.trigger.predicateLabel,
    evidenceBindings: mechanismEvidence(proposal.trigger.evidenceBindings),
    ambiguityNotes: proposal.subjectAmbiguityNotes,
    counterworlds: proposal.counterScenarios,
  });
  const state = predicate({
    ...common,
    verbPhrase: `${proposal.state.dimension.toLowerCase().replaceAll("_", " ")}: ${proposal.state.label}`,
    operatorKind: "STATE_PRESENCE",
    evidenceBindings: [],
    ambiguityNotes: proposal.subjectAmbiguityNotes,
    counterworlds: proposal.counterScenarios,
  });
  const dependent = predicate({
    ...common,
    verbPhrase: proposal.dependent.predicateLabel,
    evidenceBindings: mechanismEvidence(proposal.dependent.evidenceBindings),
    ambiguityNotes: proposal.subjectAmbiguityNotes,
    counterworlds: proposal.counterScenarios,
  });
  const relation = relationKind(proposal);
  const temporalPosture = proposal.temporalPosture === "TRIGGER_PRECEDES_DEPENDENT"
    ? "ANTECEDENT_PRECEDES_CONSEQUENT" as const
    : proposal.temporalPosture === "TRIGGER_OVERLAPS_DEPENDENT"
      ? "OVERLAPPING_INTERVALS" as const
      : "ORDER_UNRESOLVED" as const;
  const identityBody = Object.freeze({
    schemaVersion: "pmh.world-relation-frontier-identity.v1" as const,
    relationKind: relation,
    antecedentPredicateIds: [trigger.predicateId],
    consequentPredicateIds: [dependent.predicateId],
    latentPredicateIds: [state.predicateId],
    temporalPosture,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-frontier-seed.v1" as const,
    frontierId: hashCanonical(identityBody),
    predicates: Object.freeze([trigger, state, dependent]),
    relationKind: relation,
    antecedentPredicateIds: Object.freeze([trigger.predicateId]),
    consequentPredicateIds: Object.freeze([dependent.predicateId]),
    latentPredicateIds: Object.freeze([state.predicateId]),
    temporalPosture,
    searchNeighborhoods: Object.freeze([
      ...proposal.trigger.searchSignals,
      ...proposal.dependent.searchSignals,
    ]),
    counterworlds: Object.freeze([...proposal.counterScenarios]),
    rationale: proposal.rationale,
    sourceMechanismProposalId: proposal.proposalId,
    sourceAgentRunId: proposal.sourceAgentRunId,
    disposition: "UNTESTED_RELATION_FRONTIER" as const,
    authority: "RELATION_EXPERIMENT_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
