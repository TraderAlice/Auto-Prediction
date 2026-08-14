import { hashCanonical, type Hash } from "@pmh/domain";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UNSIGNED_INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/u;
const MAX_PREDICATES_PER_RELATION = 8;
const MAX_RELATION_ASSIGNMENTS = 16;

export const WORLD_PREDICATE_OPERATOR_KINDS = Object.freeze([
  "OCCURRENCE",
  "STATE_PRESENCE",
  "THRESHOLD",
  "MEMBERSHIP_OR_SELECTION",
  "PUBLIC_ACTION",
] as const);
export type WorldPredicateOperatorKind =
  (typeof WORLD_PREDICATE_OPERATOR_KINDS)[number];

export const WORLD_PREDICATE_EPISTEMIC_POSTURES = Object.freeze([
  "SEARCH_HYPOTHESIS_ONLY",
  "EVIDENCE_BOUND_PROPOSITION",
  "SETTLEMENT_BOUND_PREDICATE",
] as const);
export type WorldPredicateEpistemicPosture =
  (typeof WORLD_PREDICATE_EPISTEMIC_POSTURES)[number];

export type WorldPredicateSemanticCore = Readonly<{
  operatorKind: WorldPredicateOperatorKind;
  subjects: readonly Readonly<{
    canonicalLabel: string;
    entityType: "PERSON" | "ORGANIZATION" | "PLACE" | "ASSET" | "EVENT" | "OTHER";
  }>[];
  verbPhrase: string;
  timeScope: Readonly<{
    startsAt: string | null;
    endsAt: string | null;
    precision: "EXACT_INTERVAL" | "BOUNDED_INTERVAL" | "OPEN_INTERVAL" | "UNRESOLVED";
  }>;
  parameters: readonly Readonly<{
    name: string;
    value: string;
    unit: string | null;
  }>[];
  polarity: "POSITIVE" | "NEGATED";
}>;

export type WorldPredicateEvidenceBinding = Readonly<{
  listingRef: string;
  nodeId: Hash;
  worldFacetId: Hash;
  sourceRawHash: Hash;
  protocolIdentity: string;
}>;

export type WorldPredicateSupplementalEvidenceBinding = Readonly<{
  kind: "ENTITY_ROLE_ASSERTION";
  listingRef: string;
  assertionId: Hash;
  requirementId: Hash;
  sourceDocumentId: Hash;
  sourceRawHash: Hash;
  sourceTextHash: Hash;
}>;

export type WorldPredicateArtifact = Readonly<{
  schemaVersion: "pmh.world-predicate.v1";
  predicateId: Hash;
  artifactHash: Hash;
  semantic: WorldPredicateSemanticCore;
  observability: "DIRECTLY_OBSERVABLE" | "RULE_DEFINED" | "DERIVED" | "LATENT_HYPOTHESIS";
  epistemicPosture: WorldPredicateEpistemicPosture;
  evidenceBindings: readonly WorldPredicateEvidenceBinding[];
  supplementalEvidenceBindings?: readonly WorldPredicateSupplementalEvidenceBinding[];
  ambiguityNotes: readonly string[];
  counterworlds: readonly string[];
  source: Readonly<{
    sourceOntologyIdentities: readonly Hash[];
    sourceSnapshotIdentities: readonly Hash[];
    sourceAgentRunIds: readonly Hash[];
    sourceToolEffectIds: readonly Hash[];
  }>;
  proposedAt: string;
  authority: "WORLD_PREDICATE_RESEARCH_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type SettlementProjectionTruthState = Readonly<{
  stateId: string;
  truthByPredicateId: Readonly<Record<Hash, boolean>>;
  listingTruth: boolean | null;
  disposition: "RESOLVES" | "VOID_OR_REFUND" | "UNRESOLVED";
  rationale: string;
  ruleEvidenceHashes: readonly Hash[];
}>;

export type SettlementProjection = Readonly<{
  schemaVersion: "pmh.settlement-projection.v1";
  projectionId: Hash;
  artifactHash: Hash;
  listing: Readonly<{
    listingRef: string;
    listingHash: Hash;
    venueId: string;
    venueInstrumentId: string;
    protocolIdentity: string;
    sourceRawHash: Hash;
    sourceReceivedAt: string;
  }>;
  predicateIds: readonly Hash[];
  predicateBindings: readonly Readonly<{
    predicateId: Hash;
    predicateArtifactHash: Hash;
    epistemicPosture: WorldPredicateEpistemicPosture;
  }>[];
  truthStates: readonly SettlementProjectionTruthState[];
  mappingPosture: "TOTAL_EXACT" | "PARTIAL" | "AMBIGUOUS" | "VOIDABLE_OVERRIDE";
  ambiguityNotes: readonly string[];
  compilerAdmission: "EXACT_BINARY_ELIGIBLE" | "RESEARCH_ONLY";
  sourceAgentRunIds: readonly Hash[];
  sourceToolEffectIds: readonly Hash[];
  observedAt: string;
  compilerIdentity?: Hash;
  authority: "SETTLEMENT_MAPPING_RESEARCH_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export const WORLD_RELATION_KINDS = Object.freeze([
  "EQUIVALENT",
  "IMPLIES",
  "MUTUALLY_EXCLUSIVE",
  "TEMPORAL_PREREQUISITE",
  "STATE_MEDIATED_INHIBITION",
  "COMMON_CAUSE_DEPENDENCE",
  "UNRESOLVED_ASSOCIATION",
] as const);
export type WorldRelationKind = (typeof WORLD_RELATION_KINDS)[number];

export type WorldRelationAssignment = Readonly<{
  stateId: string;
  truthByPredicateId: Readonly<Record<Hash, boolean>>;
  rationale: string;
}>;

export type WorldRelationCounterworld = Readonly<{
  counterworldId: Hash;
  description: string;
  stateId: string;
  truthByPredicateId: Readonly<Record<Hash, boolean>>;
  result: "REJECTED" | "SURVIVES" | "INCONCLUSIVE";
  evidenceBindingHashes: readonly Hash[];
}>;

export type WorldRelationExperiment = Readonly<{
  schemaVersion: "pmh.world-relation-experiment.v1";
  experimentId: Hash;
  artifactHash: Hash;
  relationKind: WorldRelationKind;
  predicateIds: readonly Hash[];
  antecedentPredicateIds: readonly Hash[];
  consequentPredicateIds: readonly Hash[];
  latentPredicateIds: readonly Hash[];
  temporalPosture:
    | "ANTECEDENT_PRECEDES_CONSEQUENT"
    | "OVERLAPPING_INTERVALS"
    | "ORDER_UNRESOLVED";
  adverseAssignments: readonly WorldRelationAssignment[];
  searchNeighborhoods: readonly string[];
  inspectedProjectionIds: readonly Hash[];
  counterworlds: readonly WorldRelationCounterworld[];
  terminalDisposition:
    | "SUPPORTED_HARD"
    | "SUPPORTED_PROBABILISTIC"
    | "FALSIFIED"
    | "EXHAUSTED"
    | "UNRESOLVED";
  compilerBridge:
    | "HARD_TRUTH_TABLE_CANDIDATE"
    | "PROBABILISTIC_BOUND_CANDIDATE"
    | "RESEARCH_ONLY";
  rationale: string;
  sourceAgentRunId: Hash;
  sourceToolEffectIds: readonly Hash[];
  invocationIds: readonly Hash[];
  usage: Readonly<{
    inputTokens: string;
    outputTokens: string;
    reasoningTokens: string;
  }>;
  closedAt: string;
  authority: "WORLD_RELATION_RESEARCH_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldRelationCompilerBridge = Readonly<{
  admission:
    | "HARD_TRUTH_TABLE_CANDIDATE"
    | "PROBABILISTIC_BOUND_CANDIDATE"
    | "RESEARCH_ONLY";
  blockers: readonly (
    | "RELATION_NOT_SUPPORTED_HARD"
    | "RELATION_NOT_SUPPORTED_PROBABILISTIC"
    | "COUNTERWORLD_NOT_REJECTED"
    | "NON_SETTLEMENT_BOUND_PREDICATE"
    | "MISSING_SETTLEMENT_PROJECTION"
    | "NON_EXACT_SETTLEMENT_PROJECTION"
    | "MISSING_ADVERSE_ASSIGNMENT"
  )[];
  predicateIds: readonly Hash[];
  projectionIds: readonly Hash[];
  adverseStateIds: readonly string[];
  authority: "COMPILER_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
}>;

export interface WorldHistoryOntologyStore {
  readonly worldPredicateArtifactStorage:
    OperationalStorageProjection<"artifactHash">;
  readonly settlementProjectionStorage:
    OperationalStorageProjection<"artifactHash">;
  readonly worldRelationExperimentStorage:
    OperationalStorageProjection<"artifactHash">;
  loadWorldPredicateArtifacts(limit: number): readonly WorldPredicateArtifact[];
  saveWorldPredicateArtifacts(
    artifacts: readonly WorldPredicateArtifact[],
  ): readonly WorldPredicateArtifact[];
  loadSettlementProjections(limit: number): readonly SettlementProjection[];
  saveSettlementProjections(
    projections: readonly SettlementProjection[],
  ): readonly SettlementProjection[];
  loadWorldRelationExperiments(limit: number): readonly WorldRelationExperiment[];
  saveWorldRelationExperiments(
    experiments: readonly WorldRelationExperiment[],
  ): readonly WorldRelationExperiment[];
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const compact = value.trim().replace(/\s+/gu, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${label} must contain 1..${maximum} characters`);
  }
  return compact;
}

function iso(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) ||
      new Date(value).toISOString() !== value) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return value;
}

function hash(value: unknown, label: string): Hash {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${label} must be a sha256 identity`);
  }
  return value as Hash;
}

function hashes(value: unknown, label: string, maximum: number): readonly Hash[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} must be a bounded identity array`);
  }
  const normalized = value.map((item) => hash(item, label)).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} must contain unique identities`);
  }
  return Object.freeze(normalized);
}

function texts(value: unknown, label: string, maximum: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} must be a bounded text array`);
  }
  const normalized = value.map((item) => boundedText(item, label, 1_000));
  if (new Set(normalized.map((item) => item.toLowerCase())).size !== normalized.length) {
    throw new Error(`${label} must contain unique values`);
  }
  return Object.freeze(normalized);
}

function canonicalSemantic(input: WorldPredicateSemanticCore): WorldPredicateSemanticCore {
  if (!WORLD_PREDICATE_OPERATOR_KINDS.includes(input.operatorKind as never)) {
    throw new Error("world predicate operator kind is unsupported");
  }
  if (!Array.isArray(input.subjects) || input.subjects.length < 1 || input.subjects.length > 8) {
    throw new Error("world predicate requires 1..8 subjects");
  }
  const subjects = input.subjects.map((raw) => {
    const subject = record(raw, "world predicate subject");
    const canonicalLabel = boundedText(subject.canonicalLabel, "subject label", 300);
    if (!["PERSON", "ORGANIZATION", "PLACE", "ASSET", "EVENT", "OTHER"]
      .includes(String(subject.entityType))) {
      throw new Error("world predicate subject type is unsupported");
    }
    return Object.freeze({
      canonicalLabel,
      entityType: subject.entityType as WorldPredicateSemanticCore["subjects"][number]["entityType"],
    });
  }).sort((left, right) =>
    left.entityType.localeCompare(right.entityType) ||
    left.canonicalLabel.localeCompare(right.canonicalLabel)
  );
  const timeScope = record(input.timeScope, "world predicate time scope");
  if (!["EXACT_INTERVAL", "BOUNDED_INTERVAL", "OPEN_INTERVAL", "UNRESOLVED"]
    .includes(String(timeScope.precision))) {
    throw new Error("world predicate temporal precision is unsupported");
  }
  const startsAt = timeScope.startsAt === null ? null : iso(timeScope.startsAt, "time start");
  const endsAt = timeScope.endsAt === null ? null : iso(timeScope.endsAt, "time end");
  if (startsAt !== null && endsAt !== null && startsAt > endsAt) {
    throw new Error("world predicate time interval is inverted");
  }
  if (!Array.isArray(input.parameters) || input.parameters.length > 12) {
    throw new Error("world predicate parameters are malformed");
  }
  const parameters = input.parameters.map((raw) => {
    const parameter = record(raw, "world predicate parameter");
    return Object.freeze({
      name: boundedText(parameter.name, "parameter name", 120),
      value: boundedText(parameter.value, "parameter value", 300),
      unit: parameter.unit === null ? null : boundedText(parameter.unit, "parameter unit", 80),
    });
  }).sort((left, right) => left.name.localeCompare(right.name) || left.value.localeCompare(right.value));
  if (new Set(parameters.map((item) => `${item.name}\n${item.value}\n${item.unit}`)).size !== parameters.length) {
    throw new Error("world predicate parameters must be unique");
  }
  if (!["POSITIVE", "NEGATED"].includes(input.polarity)) {
    throw new Error("world predicate polarity is unsupported");
  }
  return Object.freeze({
    operatorKind: input.operatorKind,
    subjects: Object.freeze(subjects),
    verbPhrase: boundedText(input.verbPhrase, "world predicate verb phrase", 500),
    timeScope: Object.freeze({
      startsAt,
      endsAt,
      precision: timeScope.precision as WorldPredicateSemanticCore["timeScope"]["precision"],
    }),
    parameters: Object.freeze(parameters),
    polarity: input.polarity,
  });
}

function canonicalEvidenceBindings(
  input: readonly WorldPredicateEvidenceBinding[],
): readonly WorldPredicateEvidenceBinding[] {
  if (!Array.isArray(input) || input.length > 32) {
    throw new Error("world predicate evidence bindings are malformed");
  }
  const bindings = input.map((raw) => {
    const binding = record(raw, "world predicate evidence binding");
    return Object.freeze({
      listingRef: boundedText(binding.listingRef, "listing ref", 500),
      nodeId: hash(binding.nodeId, "ontology node identity"),
      worldFacetId: hash(binding.worldFacetId, "world facet identity"),
      sourceRawHash: hash(binding.sourceRawHash, "source raw hash"),
      protocolIdentity: boundedText(binding.protocolIdentity, "protocol identity", 300),
    });
  }).sort((left, right) => left.listingRef.localeCompare(right.listingRef));
  if (new Set(bindings.map((item) => item.listingRef)).size !== bindings.length) {
    throw new Error("world predicate evidence listing ref is duplicated");
  }
  return Object.freeze(bindings);
}

function canonicalSupplementalEvidenceBindings(
  input: readonly WorldPredicateSupplementalEvidenceBinding[] | undefined,
): readonly WorldPredicateSupplementalEvidenceBinding[] {
  if (input === undefined) return Object.freeze([]);
  if (!Array.isArray(input) || input.length > 16) {
    throw new Error("world predicate supplemental evidence bindings are malformed");
  }
  const bindings = input.map((raw) => {
    const binding = record(raw, "world predicate supplemental evidence binding");
    if (binding.kind !== "ENTITY_ROLE_ASSERTION") {
      throw new Error("world predicate supplemental evidence kind is unsupported");
    }
    return Object.freeze({ kind: "ENTITY_ROLE_ASSERTION" as const,
      listingRef: boundedText(binding.listingRef, "supplemental listing ref", 500),
      assertionId: hash(binding.assertionId, "entity-role assertion identity"),
      requirementId: hash(binding.requirementId, "entity-role requirement identity"),
      sourceDocumentId: hash(binding.sourceDocumentId, "entity-role source document"),
      sourceRawHash: hash(binding.sourceRawHash, "entity-role source raw hash"),
      sourceTextHash: hash(binding.sourceTextHash, "entity-role source text hash") });
  }).sort((left, right) => left.assertionId.localeCompare(right.assertionId));
  if (new Set(bindings.map((item) => item.assertionId)).size !== bindings.length) {
    throw new Error("world predicate supplemental evidence identity is duplicated");
  }
  return Object.freeze(bindings);
}

export function buildWorldPredicateArtifact(input: Readonly<{
  semantic: WorldPredicateSemanticCore;
  observability: WorldPredicateArtifact["observability"];
  epistemicPosture: WorldPredicateEpistemicPosture;
  evidenceBindings: readonly WorldPredicateEvidenceBinding[];
  supplementalEvidenceBindings?: readonly WorldPredicateSupplementalEvidenceBinding[];
  ambiguityNotes: readonly string[];
  counterworlds: readonly string[];
  source: WorldPredicateArtifact["source"];
  proposedAt: string;
}>): WorldPredicateArtifact {
  const semantic = canonicalSemantic(input.semantic);
  if (!["DIRECTLY_OBSERVABLE", "RULE_DEFINED", "DERIVED", "LATENT_HYPOTHESIS"]
    .includes(input.observability) ||
      !WORLD_PREDICATE_EPISTEMIC_POSTURES.includes(input.epistemicPosture)) {
    throw new Error("world predicate posture is unsupported");
  }
  const evidenceBindings = canonicalEvidenceBindings(input.evidenceBindings);
  const supplementalEvidenceBindings = canonicalSupplementalEvidenceBindings(
    input.supplementalEvidenceBindings,
  );
  if (input.epistemicPosture === "SETTLEMENT_BOUND_PREDICATE" && evidenceBindings.length === 0) {
    throw new Error("settlement-bound world predicate requires listing evidence");
  }
  if (input.epistemicPosture !== "SEARCH_HYPOTHESIS_ONLY" && evidenceBindings.length === 0) {
    throw new Error("evidence-bound world predicate requires evidence");
  }
  const source = Object.freeze({
    sourceOntologyIdentities: hashes(input.source.sourceOntologyIdentities, "source ontology identities", 32),
    sourceSnapshotIdentities: hashes(input.source.sourceSnapshotIdentities, "source snapshot identities", 32),
    sourceAgentRunIds: hashes(input.source.sourceAgentRunIds, "source Agent run identities", 32),
    sourceToolEffectIds: hashes(input.source.sourceToolEffectIds, "source tool effect identities", 128),
  });
  const body = Object.freeze({
    schemaVersion: "pmh.world-predicate.v1" as const,
    predicateId: hashCanonical({ schemaVersion: "pmh.world-predicate-semantic.v1", semantic }),
    semantic,
    observability: input.observability,
    epistemicPosture: input.epistemicPosture,
    evidenceBindings,
    ...(supplementalEvidenceBindings.length === 0 ? {} : {
      supplementalEvidenceBindings,
    }),
    ambiguityNotes: texts(input.ambiguityNotes, "predicate ambiguity notes", 16),
    counterworlds: texts(input.counterworlds, "predicate counterworlds", 16),
    source,
    proposedAt: iso(input.proposedAt, "predicate proposed time"),
    authority: "WORLD_PREDICATE_RESEARCH_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertWorldPredicateArtifact(value: unknown): WorldPredicateArtifact {
  const artifact = record(value, "world predicate artifact") as WorldPredicateArtifact;
  const { artifactHash, ...input } = artifact;
  const rebuilt = buildWorldPredicateArtifact(input);
  if (artifactHash !== rebuilt.artifactHash || artifact.predicateId !== rebuilt.predicateId) {
    throw new Error("world predicate identity does not match its canonical content");
  }
  return artifact;
}

function assignment(
  input: Readonly<Record<string, boolean>>,
  allowedPredicateIds: readonly Hash[],
): Readonly<{ stateId: string; truths: Readonly<Record<Hash, boolean>> }> {
  const actual = Object.keys(input).sort();
  if (actual.join("\n") !== [...allowedPredicateIds].sort().join("\n") ||
      Object.values(input).some((value) => typeof value !== "boolean")) {
    throw new Error("world assignment must bind every exact predicate once");
  }
  const truths = Object.freeze(Object.fromEntries(allowedPredicateIds.map((predicateId) => [
    predicateId,
    input[predicateId]!,
  ])) as Record<Hash, boolean>);
  return Object.freeze({
    stateId: allowedPredicateIds.map((predicateId) => truths[predicateId] ? "T" : "F").join(""),
    truths,
  });
}

function allStateIds(predicateCount: number): readonly string[] {
  return Object.freeze(Array.from({ length: 2 ** predicateCount }, (_, value) =>
    Array.from({ length: predicateCount }, (_unused, index) =>
      (value & (1 << (predicateCount - index - 1))) === 0 ? "F" : "T"
    ).join("")
  ));
}

export function buildSettlementProjection(input: Readonly<{
  listing: SettlementProjection["listing"];
  predicateArtifacts: readonly WorldPredicateArtifact[];
  predicateIds: readonly Hash[];
  truthStates: readonly Readonly<{
    truthByPredicateId: Readonly<Record<Hash, boolean>>;
    listingTruth: boolean | null;
    disposition: SettlementProjectionTruthState["disposition"];
    rationale: string;
    ruleEvidenceHashes: readonly Hash[];
  }>[];
  mappingPosture: SettlementProjection["mappingPosture"];
  ambiguityNotes: readonly string[];
  sourceAgentRunIds: readonly Hash[];
  sourceToolEffectIds: readonly Hash[];
  observedAt: string;
  compilerIdentity?: Hash;
}>): SettlementProjection {
  const predicateById = new Map(input.predicateArtifacts.map((item) => {
    const predicateArtifact = assertWorldPredicateArtifact(item);
    return [predicateArtifact.predicateId, predicateArtifact] as const;
  }));
  const predicateIds = hashes(input.predicateIds, "settlement predicate identities", 4);
  if (predicateIds.length < 1 || predicateIds.some((item) => !predicateById.has(item))) {
    throw new Error("settlement projection references an unavailable predicate");
  }
  const predicateBindings = Object.freeze(predicateIds.map((predicateId) => {
    const predicateArtifact = predicateById.get(predicateId)!;
    return Object.freeze({
      predicateId,
      predicateArtifactHash: predicateArtifact.artifactHash,
      epistemicPosture: predicateArtifact.epistemicPosture,
    });
  }));
  const listingInput = record(input.listing, "settlement projection listing");
  const listing = Object.freeze({
    listingRef: boundedText(listingInput.listingRef, "settlement listing ref", 500),
    listingHash: hash(listingInput.listingHash, "settlement listing hash"),
    venueId: boundedText(listingInput.venueId, "settlement venue", 120),
    venueInstrumentId: boundedText(listingInput.venueInstrumentId, "settlement instrument", 300),
    protocolIdentity: boundedText(listingInput.protocolIdentity, "settlement protocol", 300),
    sourceRawHash: hash(listingInput.sourceRawHash, "settlement raw source hash"),
    sourceReceivedAt: iso(listingInput.sourceReceivedAt, "settlement source receive time"),
  });
  if (!Array.isArray(input.truthStates) || input.truthStates.length < 1 ||
      input.truthStates.length > 2 ** predicateIds.length) {
    throw new Error("settlement projection truth state count is invalid");
  }
  const truthStates = input.truthStates.map((raw) => {
    const normalized = assignment(raw.truthByPredicateId, predicateIds);
    if ((raw.listingTruth !== null && typeof raw.listingTruth !== "boolean") ||
        !["RESOLVES", "VOID_OR_REFUND", "UNRESOLVED"].includes(raw.disposition) ||
        (raw.disposition === "RESOLVES" && raw.listingTruth === null) ||
        (raw.disposition !== "RESOLVES" && raw.listingTruth !== null)) {
      throw new Error("settlement projection truth disposition is malformed");
    }
    return Object.freeze({
      stateId: normalized.stateId,
      truthByPredicateId: normalized.truths,
      listingTruth: raw.listingTruth,
      disposition: raw.disposition,
      rationale: boundedText(raw.rationale, "settlement truth rationale", 2_000),
      ruleEvidenceHashes: hashes(raw.ruleEvidenceHashes, "settlement rule evidence hashes", 16),
    });
  }).sort((left, right) => left.stateId.localeCompare(right.stateId));
  if (new Set(truthStates.map((item) => item.stateId)).size !== truthStates.length) {
    throw new Error("settlement projection truth state is duplicated");
  }
  if (!["TOTAL_EXACT", "PARTIAL", "AMBIGUOUS", "VOIDABLE_OVERRIDE"].includes(input.mappingPosture)) {
    throw new Error("settlement projection mapping posture is unsupported");
  }
  const ambiguityNotes = texts(input.ambiguityNotes, "settlement ambiguity notes", 16);
  const exact = input.mappingPosture === "TOTAL_EXACT" &&
    predicateBindings.every((item) =>
      item.epistemicPosture === "SETTLEMENT_BOUND_PREDICATE"
    ) &&
    truthStates.map((item) => item.stateId).join("\n") ===
      [...allStateIds(predicateIds.length)].sort().join("\n") &&
    truthStates.every((item) =>
      item.disposition === "RESOLVES" && item.ruleEvidenceHashes.length > 0
    ) && ambiguityNotes.length === 0;
  const identityBody = Object.freeze({
    schemaVersion: "pmh.settlement-projection-identity.v1" as const,
    listingHash: listing.listingHash,
    predicateBindings,
    truthStates,
    mappingPosture: input.mappingPosture,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.settlement-projection.v1" as const,
    projectionId: hashCanonical(identityBody),
    listing,
    predicateIds,
    predicateBindings,
    truthStates: Object.freeze(truthStates),
    mappingPosture: input.mappingPosture,
    ambiguityNotes,
    compilerAdmission: exact ? "EXACT_BINARY_ELIGIBLE" as const : "RESEARCH_ONLY" as const,
    sourceAgentRunIds: hashes(input.sourceAgentRunIds, "settlement source runs", 32),
    sourceToolEffectIds: hashes(input.sourceToolEffectIds, "settlement source effects", 128),
    observedAt: iso(input.observedAt, "settlement observation time"),
    ...(input.compilerIdentity === undefined ? {} : {
      compilerIdentity: hash(input.compilerIdentity, "settlement compiler identity"),
    }),
    authority: "SETTLEMENT_MAPPING_RESEARCH_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertSettlementProjection(value: unknown): SettlementProjection {
  const artifact = record(value, "settlement projection") as SettlementProjection;
  const { artifactHash, ...body } = artifact;
  const predicateIds = hashes(artifact.predicateIds, "settlement predicate identities", 4);
  if (!Array.isArray(artifact.predicateBindings) ||
      artifact.predicateBindings.length !== predicateIds.length) {
    throw new Error("settlement projection predicate bindings are malformed");
  }
  const predicateBindings = artifact.predicateBindings.map((raw) => {
    const binding = record(raw, "settlement predicate binding");
    return Object.freeze({
      predicateId: hash(binding.predicateId, "settlement predicate identity"),
      predicateArtifactHash: hash(binding.predicateArtifactHash, "settlement predicate artifact"),
      epistemicPosture: binding.epistemicPosture as WorldPredicateEpistemicPosture,
    });
  });
  if (predicateBindings.map((item) => item.predicateId).join("\n") !== predicateIds.join("\n") ||
      predicateBindings.some((item) =>
        !WORLD_PREDICATE_EPISTEMIC_POSTURES.includes(item.epistemicPosture)
      )) {
    throw new Error("settlement projection predicate binding disagrees with its identity set");
  }
  if (!Array.isArray(artifact.truthStates) || artifact.truthStates.length < 1 ||
      artifact.truthStates.length > 2 ** predicateIds.length) {
    throw new Error("settlement projection truth states are malformed");
  }
  const stateIds = artifact.truthStates.map((state) => {
    const normalized = assignment(state.truthByPredicateId, predicateIds);
    if (normalized.stateId !== state.stateId ||
        !["RESOLVES", "VOID_OR_REFUND", "UNRESOLVED"].includes(state.disposition) ||
        (state.disposition === "RESOLVES") !== (typeof state.listingTruth === "boolean") ||
        !Array.isArray(state.ruleEvidenceHashes) ||
        state.ruleEvidenceHashes.some((item: unknown) => !HASH_PATTERN.test(String(item)))) {
      throw new Error("settlement projection truth state is malformed");
    }
    return state.stateId;
  }).sort();
  const exact = artifact.mappingPosture === "TOTAL_EXACT" &&
    predicateBindings.every((item) =>
      item.epistemicPosture === "SETTLEMENT_BOUND_PREDICATE"
    ) && stateIds.join("\n") === [...allStateIds(predicateIds.length)].sort().join("\n") &&
    artifact.truthStates.every((item) =>
      item.disposition === "RESOLVES" && item.ruleEvidenceHashes.length > 0
    ) && artifact.ambiguityNotes.length === 0;
  const expectedProjectionId = hashCanonical({
    schemaVersion: "pmh.settlement-projection-identity.v1",
    listingHash: artifact.listing.listingHash,
    predicateBindings: artifact.predicateBindings,
    truthStates: artifact.truthStates,
    mappingPosture: artifact.mappingPosture,
  });
  if (
    artifact.schemaVersion !== "pmh.settlement-projection.v1" ||
    artifact.projectionId !== expectedProjectionId ||
    artifactHash !== hashCanonical(body) ||
    artifact.compilerAdmission !== (exact ? "EXACT_BINARY_ELIGIBLE" : "RESEARCH_ONLY") ||
    artifact.authority !== "SETTLEMENT_MAPPING_RESEARCH_ONLY" ||
    artifact.semanticDecisionAuthority !== false || artifact.probabilityAuthority !== false ||
    artifact.certificateAuthority !== false || artifact.executionAuthority !== false ||
    artifact.externalWriteAuthority !== false || artifact.valueMovingAuthority !== false
    || (artifact.compilerIdentity !== undefined &&
      !HASH_PATTERN.test(artifact.compilerIdentity))
  ) {
    throw new Error("settlement projection identity does not match its canonical content");
  }
  return artifact;
}

function relationBridgeForTerminal(
  terminal: WorldRelationExperiment["terminalDisposition"],
): WorldRelationExperiment["compilerBridge"] {
  if (terminal === "SUPPORTED_HARD") return "HARD_TRUTH_TABLE_CANDIDATE";
  if (terminal === "SUPPORTED_PROBABILISTIC") return "PROBABILISTIC_BOUND_CANDIDATE";
  return "RESEARCH_ONLY";
}

export function buildWorldRelationExperiment(input: Readonly<{
  relationKind: WorldRelationKind;
  predicateArtifacts: readonly WorldPredicateArtifact[];
  antecedentPredicateIds: readonly Hash[];
  consequentPredicateIds: readonly Hash[];
  latentPredicateIds: readonly Hash[];
  temporalPosture: WorldRelationExperiment["temporalPosture"];
  adverseAssignments: readonly Readonly<{
    truthByPredicateId: Readonly<Record<Hash, boolean>>;
    rationale: string;
  }>[];
  searchNeighborhoods: readonly string[];
  inspectedProjectionIds: readonly Hash[];
  counterworlds: readonly Readonly<{
    description: string;
    truthByPredicateId: Readonly<Record<Hash, boolean>>;
    result: WorldRelationCounterworld["result"];
    evidenceBindingHashes: readonly Hash[];
  }>[];
  terminalDisposition: WorldRelationExperiment["terminalDisposition"];
  rationale: string;
  sourceAgentRunId: Hash;
  sourceToolEffectIds: readonly Hash[];
  invocationIds: readonly Hash[];
  usage: WorldRelationExperiment["usage"];
  closedAt: string;
}>): WorldRelationExperiment {
  if (!WORLD_RELATION_KINDS.includes(input.relationKind)) {
    throw new Error("world relation kind is unsupported");
  }
  const predicateIds = hashes(
    input.predicateArtifacts.map((item) => assertWorldPredicateArtifact(item).predicateId),
    "relation predicate identities",
    MAX_PREDICATES_PER_RELATION,
  );
  if (predicateIds.length < 2) throw new Error("world relation requires at least two predicates");
  const subsets = {
    antecedentPredicateIds: hashes(input.antecedentPredicateIds, "antecedent predicates", 4),
    consequentPredicateIds: hashes(input.consequentPredicateIds, "consequent predicates", 4),
    latentPredicateIds: hashes(input.latentPredicateIds, "latent predicates", 4),
  };
  if (subsets.antecedentPredicateIds.length < 1 || subsets.consequentPredicateIds.length < 1 ||
      Object.values(subsets).flat().some((item) => !predicateIds.includes(item))) {
    throw new Error("world relation role references an unavailable predicate");
  }
  if (!["ANTECEDENT_PRECEDES_CONSEQUENT", "OVERLAPPING_INTERVALS", "ORDER_UNRESOLVED"]
    .includes(input.temporalPosture)) {
    throw new Error("world relation temporal posture is unsupported");
  }
  if (!Array.isArray(input.adverseAssignments) ||
      input.adverseAssignments.length > MAX_RELATION_ASSIGNMENTS) {
    throw new Error("world relation adverse assignments are malformed");
  }
  const adverseAssignments = input.adverseAssignments.map((raw) => {
    const normalized = assignment(raw.truthByPredicateId, predicateIds);
    return Object.freeze({
      stateId: normalized.stateId,
      truthByPredicateId: normalized.truths,
      rationale: boundedText(raw.rationale, "adverse assignment rationale", 2_000),
    });
  }).sort((left, right) => left.stateId.localeCompare(right.stateId));
  if (new Set(adverseAssignments.map((item) => item.stateId)).size !== adverseAssignments.length) {
    throw new Error("world relation adverse state is duplicated");
  }
  if (!Array.isArray(input.counterworlds) || input.counterworlds.length > 16) {
    throw new Error("world relation counterworlds are malformed");
  }
  const counterworlds = input.counterworlds.map((raw) => {
    const normalized = assignment(raw.truthByPredicateId, predicateIds);
    if (!["REJECTED", "SURVIVES", "INCONCLUSIVE"].includes(raw.result)) {
      throw new Error("world relation counterworld result is unsupported");
    }
    const content = Object.freeze({
      description: boundedText(raw.description, "counterworld description", 2_000),
      stateId: normalized.stateId,
      truthByPredicateId: normalized.truths,
      result: raw.result,
      evidenceBindingHashes: hashes(raw.evidenceBindingHashes, "counterworld evidence", 32),
    });
    return Object.freeze({ ...content, counterworldId: hashCanonical(content) });
  }).sort((left, right) => left.counterworldId.localeCompare(right.counterworldId));
  if (new Set(counterworlds.map((item) => item.counterworldId)).size !== counterworlds.length) {
    throw new Error("world relation counterworld is duplicated");
  }
  if (!["SUPPORTED_HARD", "SUPPORTED_PROBABILISTIC", "FALSIFIED", "EXHAUSTED", "UNRESOLVED"]
    .includes(input.terminalDisposition)) {
    throw new Error("world relation terminal disposition is unsupported");
  }
  if (input.terminalDisposition === "SUPPORTED_HARD" &&
      counterworlds.some((item) => item.result !== "REJECTED")) {
    throw new Error("hard relation cannot retain a surviving or inconclusive counterworld");
  }
  if (["SUPPORTED_HARD", "SUPPORTED_PROBABILISTIC"].includes(input.terminalDisposition) &&
      adverseAssignments.length === 0) {
    throw new Error("supported relation requires at least one adverse assignment");
  }
  for (const value of Object.values(input.usage)) {
    if (!UNSIGNED_INTEGER_PATTERN.test(value)) throw new Error("world relation token usage is malformed");
  }
  const identityBody = Object.freeze({
    schemaVersion: "pmh.world-relation-experiment-identity.v1" as const,
    relationKind: input.relationKind,
    predicateIds,
    antecedentPredicateIds: subsets.antecedentPredicateIds,
    consequentPredicateIds: subsets.consequentPredicateIds,
    latentPredicateIds: subsets.latentPredicateIds,
    temporalPosture: input.temporalPosture,
    adverseAssignments,
    sourceAgentRunId: hash(input.sourceAgentRunId, "relation source Agent run"),
  });
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-experiment.v1" as const,
    experimentId: hashCanonical(identityBody),
    relationKind: input.relationKind,
    predicateIds,
    antecedentPredicateIds: subsets.antecedentPredicateIds,
    consequentPredicateIds: subsets.consequentPredicateIds,
    latentPredicateIds: subsets.latentPredicateIds,
    temporalPosture: input.temporalPosture,
    adverseAssignments: Object.freeze(adverseAssignments),
    searchNeighborhoods: texts(input.searchNeighborhoods, "relation search neighborhoods", 16),
    inspectedProjectionIds: hashes(input.inspectedProjectionIds, "inspected projection identities", 32),
    counterworlds: Object.freeze(counterworlds),
    terminalDisposition: input.terminalDisposition,
    compilerBridge: relationBridgeForTerminal(input.terminalDisposition),
    rationale: boundedText(input.rationale, "world relation rationale", 3_000),
    sourceAgentRunId: identityBody.sourceAgentRunId,
    sourceToolEffectIds: hashes(input.sourceToolEffectIds, "relation source effects", 128),
    invocationIds: hashes(input.invocationIds, "relation invocation identities", 128),
    usage: Object.freeze({ ...input.usage }),
    closedAt: iso(input.closedAt, "world relation close time"),
    authority: "WORLD_RELATION_RESEARCH_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertWorldRelationExperiment(value: unknown): WorldRelationExperiment {
  const artifact = record(value, "world relation experiment") as WorldRelationExperiment;
  const { artifactHash, ...body } = artifact;
  const expectedExperimentId = hashCanonical({
    schemaVersion: "pmh.world-relation-experiment-identity.v1",
    relationKind: artifact.relationKind,
    predicateIds: artifact.predicateIds,
    antecedentPredicateIds: artifact.antecedentPredicateIds,
    consequentPredicateIds: artifact.consequentPredicateIds,
    latentPredicateIds: artifact.latentPredicateIds,
    temporalPosture: artifact.temporalPosture,
    adverseAssignments: artifact.adverseAssignments,
    sourceAgentRunId: artifact.sourceAgentRunId,
  });
  if (
    artifact.schemaVersion !== "pmh.world-relation-experiment.v1" ||
    artifact.experimentId !== expectedExperimentId || artifactHash !== hashCanonical(body) ||
    artifact.compilerBridge !== relationBridgeForTerminal(artifact.terminalDisposition) ||
    artifact.authority !== "WORLD_RELATION_RESEARCH_ONLY" ||
    artifact.semanticDecisionAuthority !== false || artifact.probabilityAuthority !== false ||
    artifact.certificateAuthority !== false || artifact.executionAuthority !== false ||
    artifact.externalWriteAuthority !== false || artifact.valueMovingAuthority !== false
  ) {
    throw new Error("world relation experiment identity does not match canonical content");
  }
  return artifact;
}

export function inspectWorldRelationCompilerBridge(input: Readonly<{
  experiment: WorldRelationExperiment;
  predicates: readonly WorldPredicateArtifact[];
  projections: readonly SettlementProjection[];
}>): WorldRelationCompilerBridge {
  const experiment = assertWorldRelationExperiment(input.experiment);
  const predicates = input.predicates.map(assertWorldPredicateArtifact);
  const projections = input.projections.map(assertSettlementProjection);
  const predicateById = new Map(predicates.map((item) => [item.predicateId, item] as const));
  if (experiment.predicateIds.some((item) => !predicateById.has(item))) {
    throw new Error("compiler bridge is missing an experiment predicate artifact");
  }
  const blockers: WorldRelationCompilerBridge["blockers"][number][] = [];
  const hard = experiment.terminalDisposition === "SUPPORTED_HARD";
  const probabilistic = experiment.terminalDisposition === "SUPPORTED_PROBABILISTIC";
  if (!hard && !probabilistic) blockers.push("RELATION_NOT_SUPPORTED_HARD");
  if (!probabilistic) {
    if (experiment.counterworlds.some((item) => item.result !== "REJECTED")) {
      blockers.push("COUNTERWORLD_NOT_REJECTED");
    }
    if (predicates.some((item) => item.epistemicPosture !== "SETTLEMENT_BOUND_PREDICATE")) {
      blockers.push("NON_SETTLEMENT_BOUND_PREDICATE");
    }
    const covered = new Set(projections.flatMap((item) => item.predicateIds));
    if (experiment.predicateIds.some((item) => !covered.has(item))) {
      blockers.push("MISSING_SETTLEMENT_PROJECTION");
    }
    if (projections.some((item) => item.compilerAdmission !== "EXACT_BINARY_ELIGIBLE")) {
      blockers.push("NON_EXACT_SETTLEMENT_PROJECTION");
    }
  }
  if (probabilistic && experiment.adverseAssignments.length === 0) {
    blockers.push("MISSING_ADVERSE_ASSIGNMENT");
  }
  const admission = hard && blockers.length === 0
    ? "HARD_TRUTH_TABLE_CANDIDATE" as const
    : probabilistic && blockers.length === 0
      ? "PROBABILISTIC_BOUND_CANDIDATE" as const
      : "RESEARCH_ONLY" as const;
  return Object.freeze({
    admission,
    blockers: Object.freeze([...new Set(blockers)]),
    predicateIds: experiment.predicateIds,
    projectionIds: Object.freeze(projections.map((item) => item.projectionId).sort()),
    adverseStateIds: Object.freeze(experiment.adverseAssignments.map((item) => item.stateId).sort()),
    authority: "COMPILER_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
  });
}
