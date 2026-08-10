import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertSemanticConstraintArtifact,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";
import type { DiscoveryCatalogListing } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type ProbabilityTruthOutcome = Readonly<{
  venueOutcomeId: string;
  label: string;
}>;

export type ProbabilityStateTruthAssignment = Readonly<{
  ordinal: number;
  listingRef: string;
  venueId: string;
  title: string;
  truth: boolean;
  selectedOutcome: ProbabilityTruthOutcome | null;
  mappingPosture: "EXACT_BINARY_LABEL" | "AMBIGUOUS_OUTCOME_MAPPING";
}>;

export type ProbabilityAdverseStateInterpretation = Readonly<{
  schemaVersion: "pmh.probability-adverse-state-interpretation.v1";
  artifactHash: Hash;
  proposalId: Hash;
  semanticConstraintArtifactHash: Hash;
  evidenceContextIdentity: Hash;
  relationKind: SemanticConstraintArtifact["relationKind"];
  listingRefs: readonly string[];
  adverseStateIds: readonly string[];
  states: readonly Readonly<{
    stateId: string;
    disposition: "FEASIBLE" | "IMPOSSIBLE" | "UNRESOLVED";
    rationale: string;
    evidenceListingRefs: readonly string[];
    assignments: readonly ProbabilityStateTruthAssignment[];
    claimedByCounterexample: boolean;
  }>[];
  counterexampleAttempt: SemanticConstraintArtifact["counterexampleAttempt"];
  outcomeMappingPosture: "EXACT_BINARY_LABELS" | "AMBIGUOUS";
  authority: "CASE_INTERPRETATION_ONLY";
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  executionAuthority: false;
}>;

function compactOutcome(
  listing: DiscoveryCatalogListing,
  truth: boolean,
): Readonly<{
  selectedOutcome: ProbabilityTruthOutcome | null;
  mappingPosture: ProbabilityStateTruthAssignment["mappingPosture"];
}> {
  const accepted = truth ? new Set(["yes", "up"]) : new Set(["no", "down"]);
  const matches = listing.outcomes.filter((outcome) =>
    accepted.has(outcome.label.trim().toLowerCase())
  );
  if (matches.length !== 1) return Object.freeze({
    selectedOutcome: null,
    mappingPosture: "AMBIGUOUS_OUTCOME_MAPPING" as const,
  });
  return Object.freeze({
    selectedOutcome: Object.freeze({
      venueOutcomeId: matches[0]!.venueOutcomeId,
      label: matches[0]!.label,
    }),
    mappingPosture: "EXACT_BINARY_LABEL" as const,
  });
}

function withoutHash(
  artifact: ProbabilityAdverseStateInterpretation,
): Omit<ProbabilityAdverseStateInterpretation, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = artifact;
  return body;
}

export function assertProbabilityAdverseStateInterpretation(
  value: unknown,
): ProbabilityAdverseStateInterpretation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probability adverse-state interpretation is malformed");
  }
  const artifact = value as ProbabilityAdverseStateInterpretation;
  const body = withoutHash(artifact);
  if (
    artifact.schemaVersion !== "pmh.probability-adverse-state-interpretation.v1" ||
    !HASH_PATTERN.test(String(artifact.artifactHash)) ||
    artifact.artifactHash !== hashCanonical(body) ||
    !HASH_PATTERN.test(String(artifact.proposalId)) ||
    !HASH_PATTERN.test(String(artifact.semanticConstraintArtifactHash)) ||
    !HASH_PATTERN.test(String(artifact.evidenceContextIdentity)) ||
    !Array.isArray(artifact.listingRefs) || artifact.listingRefs.length < 2 ||
    artifact.listingRefs.length > 4 ||
    new Set(artifact.listingRefs).size !== artifact.listingRefs.length ||
    !Array.isArray(artifact.adverseStateIds) || artifact.adverseStateIds.length < 1 ||
    new Set(artifact.adverseStateIds).size !== artifact.adverseStateIds.length ||
    artifact.adverseStateIds.join("\n") !== [...artifact.adverseStateIds].sort().join("\n") ||
    !Array.isArray(artifact.states) ||
    artifact.states.length !== artifact.adverseStateIds.length ||
    artifact.states.some((state, stateIndex) =>
      state.stateId !== artifact.adverseStateIds[stateIndex] ||
      !["FEASIBLE", "IMPOSSIBLE", "UNRESOLVED"].includes(state.disposition) ||
      typeof state.rationale !== "string" || state.rationale.trim() === "" ||
      state.rationale.length > 2_000 ||
      !Array.isArray(state.evidenceListingRefs) ||
      !Array.isArray(state.assignments) ||
      state.assignments.length !== artifact.listingRefs.length ||
      state.assignments.some((assignment: ProbabilityStateTruthAssignment, index: number) =>
        assignment.ordinal !== index ||
        assignment.listingRef !== artifact.listingRefs[index] ||
        assignment.truth !== (state.stateId[index] === "T") ||
        typeof assignment.venueId !== "string" || assignment.venueId.trim() === "" ||
        typeof assignment.title !== "string" || assignment.title.trim() === "" ||
        !["EXACT_BINARY_LABEL", "AMBIGUOUS_OUTCOME_MAPPING"]
          .includes(assignment.mappingPosture) ||
        (assignment.mappingPosture === "EXACT_BINARY_LABEL") !==
          (assignment.selectedOutcome !== null)
      )
    ) ||
    artifact.outcomeMappingPosture !==
      (artifact.states.some((state) => state.assignments.some(
        (assignment: ProbabilityStateTruthAssignment) =>
        assignment.mappingPosture === "AMBIGUOUS_OUTCOME_MAPPING"
      )) ? "AMBIGUOUS" : "EXACT_BINARY_LABELS") ||
    artifact.authority !== "CASE_INTERPRETATION_ONLY" ||
    artifact.semanticDecisionAuthority !== false ||
    artifact.probabilityCertificateAuthority !== false ||
    artifact.executionAuthority !== false
  ) throw new Error("probability adverse-state interpretation violates its bounded contract");
  return Object.freeze(artifact);
}

export function buildProbabilityAdverseStateInterpretation(input: Readonly<{
  semanticConstraint: SemanticConstraintArtifact;
  evidenceContextIdentity: Hash;
  listings: readonly DiscoveryCatalogListing[];
  adverseStateIds: readonly string[];
}>): ProbabilityAdverseStateInterpretation {
  const constraint = assertSemanticConstraintArtifact(input.semanticConstraint);
  const adverseStateIds = Object.freeze([...new Set(input.adverseStateIds)].sort());
  if (
    !HASH_PATTERN.test(String(input.evidenceContextIdentity)) ||
    adverseStateIds.length !== input.adverseStateIds.length ||
    input.listings.length !== constraint.listingRefs.length ||
    input.listings.some((listing, index) =>
      listing.listingRef !== constraint.listingRefs[index]
    )
  ) throw new Error("probability interpretation input lineage is inconsistent");
  const states = Object.freeze(adverseStateIds.map((stateId) => {
    const state = constraint.truthTable.find((candidate) => candidate.stateId === stateId);
    if (state === undefined || state.disposition === "IMPOSSIBLE") {
      throw new Error("probability interpretation requires feasible adverse states");
    }
    const assignments = Object.freeze(input.listings.map((listing, ordinal) => {
      const outcome = compactOutcome(listing, stateId[ordinal] === "T");
      return Object.freeze({
        ordinal,
        listingRef: listing.listingRef,
        venueId: listing.venueId,
        title: listing.title,
        truth: stateId[ordinal] === "T",
        selectedOutcome: outcome.selectedOutcome,
        mappingPosture: outcome.mappingPosture,
      });
    }));
    return Object.freeze({
      stateId,
      disposition: state.disposition,
      rationale: state.rationale,
      evidenceListingRefs: Object.freeze([...state.evidenceListingRefs]),
      assignments,
      claimedByCounterexample: constraint.counterexampleAttempt.stateId === stateId,
    });
  }));
  const body = Object.freeze({
    schemaVersion: "pmh.probability-adverse-state-interpretation.v1" as const,
    proposalId: constraint.proposalId,
    semanticConstraintArtifactHash: constraint.artifactHash,
    evidenceContextIdentity: input.evidenceContextIdentity,
    relationKind: constraint.relationKind,
    listingRefs: Object.freeze([...constraint.listingRefs]),
    adverseStateIds,
    states,
    counterexampleAttempt: constraint.counterexampleAttempt,
    outcomeMappingPosture: states.some((state) => state.assignments.some((assignment) =>
      assignment.mappingPosture === "AMBIGUOUS_OUTCOME_MAPPING"
    )) ? "AMBIGUOUS" as const : "EXACT_BINARY_LABELS" as const,
    authority: "CASE_INTERPRETATION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityCertificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertProbabilityAdverseStateInterpretation(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertProbabilityInterpretationLineage(input: Readonly<{
  interpretation: ProbabilityAdverseStateInterpretation;
  semanticConstraint: SemanticConstraintArtifact;
  evidenceContextIdentity: Hash;
  listings: readonly DiscoveryCatalogListing[];
  adverseStateIds: readonly string[];
}>): ProbabilityAdverseStateInterpretation {
  const interpretation = assertProbabilityAdverseStateInterpretation(input.interpretation);
  const expected = buildProbabilityAdverseStateInterpretation({
    semanticConstraint: input.semanticConstraint,
    evidenceContextIdentity: input.evidenceContextIdentity,
    listings: input.listings,
    adverseStateIds: input.adverseStateIds,
  });
  if (interpretation.artifactHash !== expected.artifactHash) {
    throw new Error("probability adverse-state interpretation lineage is inconsistent");
  }
  return interpretation;
}
