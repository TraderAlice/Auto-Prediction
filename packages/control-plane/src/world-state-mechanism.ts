import { hashCanonical, type Hash } from "@pmh/domain";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_ROLE_BINDINGS = 4;
const MAX_SUBJECT_ALIASES = 8;
const MAX_SEARCH_SIGNALS = 6;
const MAX_COUNTER_SCENARIOS = 12;
const MAX_AMBIGUITY_NOTES = 8;

export const WORLD_STATE_DIMENSIONS = Object.freeze([
  "EXISTENCE",
  "PHYSICAL_CAPABILITY",
  "LEGAL_ELIGIBILITY",
  "OFFICE_HOLDING",
  "OPERATIONAL_AVAILABILITY",
  "POSSESSION",
  "LOCATION",
  "WILLINGNESS",
] as const);

export type WorldStateDimension = (typeof WORLD_STATE_DIMENSIONS)[number];

export const WORLD_STATE_TRIGGER_INFLUENCES = Object.freeze([
  "MAY_DEGRADE_STATE",
  "MAY_ENABLE_STATE",
  "MAY_TERMINATE_STATE",
] as const);

export type WorldStateTriggerInfluence =
  (typeof WORLD_STATE_TRIGGER_INFLUENCES)[number];

export const WORLD_STATE_DEPENDENT_REQUIREMENTS = Object.freeze([
  "REQUIRES_STATE_PRESENT",
  "REQUIRES_STATE_ABSENT",
  "STATE_INFLUENCES_LIKELIHOOD",
] as const);

export type WorldStateDependentRequirement =
  (typeof WORLD_STATE_DEPENDENT_REQUIREMENTS)[number];

export const WORLD_STATE_TEMPORAL_POSTURES = Object.freeze([
  "TRIGGER_PRECEDES_DEPENDENT",
  "TRIGGER_OVERLAPS_DEPENDENT",
  "ORDER_UNCERTAIN",
] as const);

export type WorldStateTemporalPosture =
  (typeof WORLD_STATE_TEMPORAL_POSTURES)[number];

export type WorldStateMechanismEvidenceBinding = Readonly<{
  listingRef: string;
  title: string;
  nodeId: Hash;
  worldFacetId: Hash;
  sourceRawHash: Hash;
  protocolIdentity: string;
}>;

export type WorldStateMechanismProposal = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-proposal.v1";
  proposalId: Hash;
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  sourceIssueRevisionId: Hash;
  sourceAgentRunId: Hash;
  sourceTrailheadIds: readonly Hash[];
  sourceRelationPatternIds: readonly Hash[];
  subjectLabel: string;
  subjectAliases: readonly string[];
  subjectAmbiguityNotes: readonly string[];
  trigger: Readonly<{
    predicateLabel: string;
    searchSignals: readonly string[];
    influence: WorldStateTriggerInfluence;
    evidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  }>;
  state: Readonly<{
    dimension: WorldStateDimension;
    label: string;
  }>;
  dependent: Readonly<{
    predicateLabel: string;
    searchSignals: readonly string[];
    requirement: WorldStateDependentRequirement;
    evidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  }>;
  temporalPosture: WorldStateTemporalPosture;
  counterScenarios: readonly string[];
  rationale: string;
  proposedAt: string;
  authority: "WORLD_STATE_SEARCH_ROUTING_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismCounterexample = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-counterexample.v1";
  counterexampleId: Hash;
  targetRouteFamilyId: Hash;
  targetProposalIds: readonly Hash[];
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  sourceIssueRevisionId: Hash;
  sourceAgentRunId: Hash;
  sourceTrailheadIds: readonly Hash[];
  sourceRelationPatternIds: readonly Hash[];
  evidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  scenario: string;
  reason: string;
  searchSignals: readonly string[];
  proposedAt: string;
  authority: "WORLD_STATE_MECHANISM_FALSIFICATION_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingWorldStateMechanismRoute = Readonly<{
  schemaVersion: "pmh.standing-world-state-mechanism-route.v1";
  routeId: Hash;
  routeFamilyId: Hash;
  sourceProposalId: Hash;
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  sourceIssueRevisionId: Hash;
  sourceAgentRunId: Hash;
  sourceTrailheadIds: readonly Hash[];
  sourceRelationPatternIds: readonly Hash[];
  canonicalSubjectLabels: readonly string[];
  triggerPredicate: string;
  canonicalTriggerSearchSignals: readonly string[];
  triggerInfluence: WorldStateTriggerInfluence;
  stateDimension: WorldStateDimension;
  stateLabel: string;
  dependentPredicate: string;
  canonicalDependentSearchSignals: readonly string[];
  dependentRequirement: WorldStateDependentRequirement;
  temporalPosture: WorldStateTemporalPosture;
  baselineTriggerListingRefs: readonly string[];
  baselineDependentListingRefs: readonly string[];
  counterScenarios: readonly string[];
  rationale: string;
  proposedAt: string;
  authority: "WORLD_STATE_SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismAdmission = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-admission.v1";
  proposalId: Hash;
  routeFamilyId: Hash;
  classification:
    | "NOVEL_MECHANISM_FAMILY"
    | "CORROBORATING_MECHANISM_EVIDENCE"
    | "CORROBORATING_COUNTER_SCENARIO"
    | "REDUNDANT_MECHANISM_MEMORY";
  admitted: boolean;
  overlappingProposalIds: readonly Hash[];
  newEvidenceBindingCount: number;
  newCounterScenarioCount: number;
  authority: "SEMANTIC_MEMORY_ADMISSION_ONLY";
  providerRequests: 0;
  modelInvocations: 0;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ConsolidatedWorldStateMechanismRoute = Readonly<{
  schemaVersion: "pmh.consolidated-world-state-mechanism-route.v1";
  routeId: Hash;
  routeFamilyId: Hash;
  canonicalRoute: StandingWorldStateMechanismRoute;
  sourceProposalIds: readonly Hash[];
  sourceAgentRunIds: readonly Hash[];
  triggerEvidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  dependentEvidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  counterScenarios: readonly string[];
  rationaleVariants: readonly string[];
  firstProposedAt: string;
  lastProposedAt: string;
  authority: "CONSOLIDATED_WORLD_STATE_SEARCH_ROUTING_ONLY";
  providerRequests: 0;
  modelInvocations: 0;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface WorldStateMechanismProposalStore {
  readonly worldStateMechanismProposalStorage:
    OperationalStorageProjection<"proposalId">;
  loadWorldStateMechanismProposals(
    limit: number,
  ): readonly WorldStateMechanismProposal[];
  saveWorldStateMechanismProposals(
    proposals: readonly WorldStateMechanismProposal[],
  ): readonly WorldStateMechanismProposal[];
}

export interface WorldStateMechanismCounterexampleStore {
  readonly worldStateMechanismCounterexampleStorage:
    OperationalStorageProjection<"counterexampleId">;
  loadWorldStateMechanismCounterexamples(
    limit: number,
  ): readonly WorldStateMechanismCounterexample[];
  saveWorldStateMechanismCounterexamples(
    counterexamples: readonly WorldStateMechanismCounterexample[],
  ): readonly WorldStateMechanismCounterexample[];
}

type ProposalInput = Readonly<Omit<WorldStateMechanismProposal,
  "schemaVersion" | "proposalId" | "authority" |
  "semanticDecisionAuthority" | "probabilityAuthority" |
  "certificateAuthority" | "executionAuthority" |
  "externalWriteAuthority" | "valueMovingAuthority">>;

type CounterexampleInput = Readonly<Omit<WorldStateMechanismCounterexample,
  "schemaVersion" | "counterexampleId" | "authority" |
  "semanticDecisionAuthority" | "probabilityAuthority" |
  "certificateAuthority" | "executionAuthority" |
  "externalWriteAuthority" | "valueMovingAuthority">>;

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) =>
    key === canonical[index]
  );
}

function object(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;
}

function canonicalText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" &&
    value === value.trim().replace(/\s+/gu, " ") && value.length <= maximum;
}

function boundedTexts(
  value: unknown,
  minimum: number,
  maximum: number,
  maximumCharacters: number,
): value is readonly string[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum &&
    value.every((item) => boundedText(item, maximumCharacters)) &&
    new Set(value.map(canonicalText)).size === value.length;
}

function sortedUniqueHashes(value: unknown, minimum: number, maximum: number): value is Hash[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum &&
    value.every((item) => typeof item === "string" && HASH_PATTERN.test(item)) &&
    new Set(value).size === value.length && [...value].sort().join("\n") === value.join("\n");
}

function isCanonicalIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function assertBinding(value: unknown): WorldStateMechanismEvidenceBinding {
  const binding = object(value);
  if (binding === null || !exactKeys(binding, [
    "listingRef", "title", "nodeId", "worldFacetId", "sourceRawHash",
    "protocolIdentity",
  ]) || !boundedText(binding.listingRef, 500) || !boundedText(binding.title, 1_000) ||
      ![binding.nodeId, binding.worldFacetId, binding.sourceRawHash]
        .every((item) => typeof item === "string" && HASH_PATTERN.test(item)) ||
      !boundedText(binding.protocolIdentity, 500)) {
    throw new Error("world-state mechanism evidence binding is malformed");
  }
  return Object.freeze(binding as WorldStateMechanismEvidenceBinding);
}

function assertRole(value: unknown, role: "trigger" | "dependent"):
  WorldStateMechanismProposal["trigger"] | WorldStateMechanismProposal["dependent"] {
  const record = object(value);
  const roleField = role === "trigger" ? "influence" : "requirement";
  if (record === null || !exactKeys(record, [
    "predicateLabel", "searchSignals", roleField, "evidenceBindings",
  ]) || !boundedText(record.predicateLabel, 500) ||
      !boundedTexts(record.searchSignals, 1, MAX_SEARCH_SIGNALS, 160) ||
      !Array.isArray(record.evidenceBindings) || record.evidenceBindings.length < 1 ||
      record.evidenceBindings.length > MAX_ROLE_BINDINGS ||
      (role === "trigger"
        ? !WORLD_STATE_TRIGGER_INFLUENCES.includes(record.influence as never)
        : !WORLD_STATE_DEPENDENT_REQUIREMENTS.includes(record.requirement as never))) {
    throw new Error(`world-state mechanism ${role} role is malformed`);
  }
  const bindings = Object.freeze(record.evidenceBindings.map(assertBinding));
  if (new Set(bindings.map((item) => item.listingRef)).size !== bindings.length) {
    throw new Error(`world-state mechanism ${role} role repeats listing evidence`);
  }
  const signals = record.searchSignals as readonly string[];
  if (signals.some((signal) => !bindings.some((binding) =>
    canonicalText(binding.title).includes(canonicalText(signal))
  ))) {
    throw new Error(`world-state mechanism ${role} signal is not title-grounded`);
  }
  return Object.freeze({ ...record, evidenceBindings: bindings }) as
    WorldStateMechanismProposal["trigger"] | WorldStateMechanismProposal["dependent"];
}

export function assertWorldStateMechanismProposal(
  value: unknown,
): WorldStateMechanismProposal {
  const proposal = object(value);
  if (proposal === null || !exactKeys(proposal, [
    "schemaVersion", "proposalId", "ontologyIdentity", "sourceSnapshotIdentity",
    "sourceIssueRevisionId", "sourceAgentRunId", "sourceTrailheadIds",
    "sourceRelationPatternIds", "subjectLabel", "subjectAliases",
    "subjectAmbiguityNotes", "trigger", "state", "dependent", "temporalPosture",
    "counterScenarios", "rationale", "proposedAt", "authority",
    "semanticDecisionAuthority", "probabilityAuthority", "certificateAuthority",
    "executionAuthority", "externalWriteAuthority", "valueMovingAuthority",
  ]) || proposal.schemaVersion !== "pmh.world-state-mechanism-proposal.v1" ||
      ![proposal.proposalId, proposal.ontologyIdentity, proposal.sourceSnapshotIdentity,
        proposal.sourceIssueRevisionId, proposal.sourceAgentRunId]
        .every((item) => typeof item === "string" && HASH_PATTERN.test(item)) ||
      !sortedUniqueHashes(proposal.sourceTrailheadIds, 1, 16) ||
      !sortedUniqueHashes(proposal.sourceRelationPatternIds, 1, 16) ||
      !boundedText(proposal.subjectLabel, 160) ||
      !boundedTexts(proposal.subjectAliases, 1, MAX_SUBJECT_ALIASES, 160) ||
      !boundedTexts(proposal.subjectAmbiguityNotes, 0, MAX_AMBIGUITY_NOTES, 500) ||
      !WORLD_STATE_TEMPORAL_POSTURES.includes(proposal.temporalPosture as never) ||
      !boundedTexts(proposal.counterScenarios, 1, MAX_COUNTER_SCENARIOS, 500) ||
      !boundedText(proposal.rationale, 2_000) || !isCanonicalIso(proposal.proposedAt) ||
      proposal.authority !== "WORLD_STATE_SEARCH_ROUTING_PROPOSAL_ONLY" ||
      proposal.semanticDecisionAuthority !== false || proposal.probabilityAuthority !== false ||
      proposal.certificateAuthority !== false || proposal.executionAuthority !== false ||
      proposal.externalWriteAuthority !== false || proposal.valueMovingAuthority !== false) {
    throw new Error("world-state mechanism proposal violates its bounded contract");
  }
  const state = object(proposal.state);
  if (state === null || !exactKeys(state, ["dimension", "label"]) ||
      !WORLD_STATE_DIMENSIONS.includes(state.dimension as never) ||
      !boundedText(state.label, 160)) {
    throw new Error("world-state mechanism state is malformed");
  }
  const trigger = assertRole(proposal.trigger, "trigger") as
    WorldStateMechanismProposal["trigger"];
  const dependent = assertRole(proposal.dependent, "dependent") as
    WorldStateMechanismProposal["dependent"];
  const triggerRefs = new Set(trigger.evidenceBindings.map((item) => item.listingRef));
  if (dependent.evidenceBindings.some((item) => triggerRefs.has(item.listingRef))) {
    throw new Error("world-state mechanism roles must bind distinct listings");
  }
  const subjectLabels = [proposal.subjectLabel as string,
    ...(proposal.subjectAliases as readonly string[])].map(canonicalText);
  const everyBinding = [...trigger.evidenceBindings, ...dependent.evidenceBindings];
  if (everyBinding.some((binding) => !subjectLabels.some((label) =>
    canonicalText(binding.title).includes(label)
  ))) {
    throw new Error("world-state mechanism subject is not grounded in every role binding");
  }
  const { proposalId, ...body } = proposal as unknown as WorldStateMechanismProposal;
  if (proposalId !== hashCanonical(body)) {
    throw new Error("world-state mechanism proposal identity is inconsistent");
  }
  return Object.freeze({ ...proposal, trigger, state: Object.freeze(state), dependent }) as
    WorldStateMechanismProposal;
}

export function buildWorldStateMechanismProposal(
  input: ProposalInput,
): WorldStateMechanismProposal {
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-proposal.v1" as const,
    ...input,
    authority: "WORLD_STATE_SEARCH_ROUTING_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateMechanismProposal(Object.freeze({
    ...body,
    proposalId: hashCanonical(body),
  }));
}

export function assertWorldStateMechanismCounterexample(
  value: unknown,
): WorldStateMechanismCounterexample {
  const counterexample = object(value);
  if (counterexample === null || !exactKeys(counterexample, [
    "schemaVersion", "counterexampleId", "targetRouteFamilyId", "targetProposalIds",
    "ontologyIdentity", "sourceSnapshotIdentity", "sourceIssueRevisionId",
    "sourceAgentRunId", "sourceTrailheadIds", "sourceRelationPatternIds",
    "evidenceBindings", "scenario", "reason", "searchSignals", "proposedAt",
    "authority", "semanticDecisionAuthority", "probabilityAuthority",
    "certificateAuthority", "executionAuthority", "externalWriteAuthority",
    "valueMovingAuthority",
  ]) || counterexample.schemaVersion !== "pmh.world-state-mechanism-counterexample.v1" ||
      ![counterexample.counterexampleId, counterexample.targetRouteFamilyId,
        counterexample.ontologyIdentity, counterexample.sourceSnapshotIdentity,
        counterexample.sourceIssueRevisionId, counterexample.sourceAgentRunId]
        .every((item) => typeof item === "string" && HASH_PATTERN.test(item)) ||
      !sortedUniqueHashes(counterexample.targetProposalIds, 1, 32) ||
      !sortedUniqueHashes(counterexample.sourceTrailheadIds, 1, 16) ||
      !sortedUniqueHashes(counterexample.sourceRelationPatternIds, 1, 16) ||
      !Array.isArray(counterexample.evidenceBindings) ||
      counterexample.evidenceBindings.length < 1 ||
      counterexample.evidenceBindings.length > MAX_ROLE_BINDINGS ||
      !boundedText(counterexample.scenario, 800) ||
      !boundedText(counterexample.reason, 2_000) ||
      !boundedTexts(counterexample.searchSignals, 1, MAX_SEARCH_SIGNALS, 160) ||
      !isCanonicalIso(counterexample.proposedAt) ||
      counterexample.authority !==
        "WORLD_STATE_MECHANISM_FALSIFICATION_PROPOSAL_ONLY" ||
      counterexample.semanticDecisionAuthority !== false ||
      counterexample.probabilityAuthority !== false ||
      counterexample.certificateAuthority !== false ||
      counterexample.executionAuthority !== false ||
      counterexample.externalWriteAuthority !== false ||
      counterexample.valueMovingAuthority !== false) {
    throw new Error("world-state mechanism counterexample violates its bounded contract");
  }
  const evidenceBindings = Object.freeze(counterexample.evidenceBindings.map(assertBinding));
  if (new Set(evidenceBindings.map((item) => item.listingRef)).size !==
      evidenceBindings.length) {
    throw new Error("world-state mechanism counterexample repeats listing evidence");
  }
  if ((counterexample.searchSignals as readonly string[]).some((signal) =>
    !evidenceBindings.some((binding) =>
      canonicalText(binding.title).includes(canonicalText(signal))
    ))) {
    throw new Error("world-state mechanism counterexample signal is not title-grounded");
  }
  const { counterexampleId, ...body } = counterexample as unknown as
    WorldStateMechanismCounterexample;
  if (counterexampleId !== hashCanonical(body)) {
    throw new Error("world-state mechanism counterexample identity is inconsistent");
  }
  return Object.freeze({ ...counterexample, evidenceBindings }) as
    WorldStateMechanismCounterexample;
}

export function buildWorldStateMechanismCounterexample(
  input: CounterexampleInput,
): WorldStateMechanismCounterexample {
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-counterexample.v1" as const,
    ...input,
    authority: "WORLD_STATE_MECHANISM_FALSIFICATION_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateMechanismCounterexample(Object.freeze({
    ...body,
    counterexampleId: hashCanonical(body),
  }));
}

function canonicalList(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map(canonicalText))].sort());
}

function evidenceBindingIdentity(binding: WorldStateMechanismEvidenceBinding): Hash {
  return hashCanonical({
    listingRef: binding.listingRef,
    nodeId: binding.nodeId,
    worldFacetId: binding.worldFacetId,
    sourceRawHash: binding.sourceRawHash,
    protocolIdentity: binding.protocolIdentity,
  });
}

export function assessWorldStateMechanismAdmission(input: Readonly<{
  candidate: WorldStateMechanismProposal;
  retained: readonly WorldStateMechanismProposal[];
}>): WorldStateMechanismAdmission {
  const candidate = assertWorldStateMechanismProposal(input.candidate);
  const retained = input.retained.map(assertWorldStateMechanismProposal);
  const routeFamilyId = worldStateMechanismRouteFamilyIdentity(candidate);
  const overlapping = retained.filter((proposal) =>
    worldStateMechanismRouteFamilyIdentity(proposal) === routeFamilyId
  );
  const knownEvidence = new Set(overlapping.flatMap((proposal) => [
    ...proposal.trigger.evidenceBindings,
    ...proposal.dependent.evidenceBindings,
  ]).map(evidenceBindingIdentity));
  const candidateEvidence = [...candidate.trigger.evidenceBindings,
    ...candidate.dependent.evidenceBindings];
  const newEvidenceBindingCount = candidateEvidence.filter((binding) =>
    !knownEvidence.has(evidenceBindingIdentity(binding))
  ).length;
  const knownCounters = new Set(overlapping.flatMap((proposal) =>
    proposal.counterScenarios.map(canonicalText)
  ));
  const newCounterScenarioCount = candidate.counterScenarios.filter((scenario) =>
    !knownCounters.has(canonicalText(scenario))
  ).length;
  const classification = overlapping.length === 0
    ? "NOVEL_MECHANISM_FAMILY" as const
    : newEvidenceBindingCount > 0
    ? "CORROBORATING_MECHANISM_EVIDENCE" as const
    : newCounterScenarioCount > 0
    ? "CORROBORATING_COUNTER_SCENARIO" as const
    : "REDUNDANT_MECHANISM_MEMORY" as const;
  return Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-admission.v1" as const,
    proposalId: candidate.proposalId,
    routeFamilyId,
    classification,
    admitted: classification !== "REDUNDANT_MECHANISM_MEMORY",
    overlappingProposalIds: Object.freeze(overlapping
      .map((item) => item.proposalId).sort()),
    newEvidenceBindingCount,
    newCounterScenarioCount,
    authority: "SEMANTIC_MEMORY_ADMISSION_ONLY" as const,
    providerRequests: 0 as const,
    modelInvocations: 0 as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}

export function worldStateMechanismRouteFamilyIdentity(
  proposalInput: WorldStateMechanismProposal,
): Hash {
  const proposal = assertWorldStateMechanismProposal(proposalInput);
  return hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-route-family-identity.v1",
    canonicalSubjectLabels: canonicalList([
      proposal.subjectLabel, ...proposal.subjectAliases,
    ]),
    triggerPredicate: canonicalText(proposal.trigger.predicateLabel),
    canonicalTriggerSearchSignals: canonicalList(proposal.trigger.searchSignals),
    triggerInfluence: proposal.trigger.influence,
    stateDimension: proposal.state.dimension,
    stateLabel: canonicalText(proposal.state.label),
    dependentPredicate: canonicalText(proposal.dependent.predicateLabel),
    canonicalDependentSearchSignals: canonicalList(proposal.dependent.searchSignals),
    dependentRequirement: proposal.dependent.requirement,
    temporalPosture: proposal.temporalPosture,
  });
}

export function compileStandingWorldStateMechanismRoute(
  proposalInput: WorldStateMechanismProposal,
): StandingWorldStateMechanismRoute {
  const proposal = assertWorldStateMechanismProposal(proposalInput);
  const routeFamilyId = worldStateMechanismRouteFamilyIdentity(proposal);
  const body = Object.freeze({
    schemaVersion: "pmh.standing-world-state-mechanism-route.v1" as const,
    routeFamilyId,
    sourceProposalId: proposal.proposalId,
    ontologyIdentity: proposal.ontologyIdentity,
    sourceSnapshotIdentity: proposal.sourceSnapshotIdentity,
    sourceIssueRevisionId: proposal.sourceIssueRevisionId,
    sourceAgentRunId: proposal.sourceAgentRunId,
    sourceTrailheadIds: proposal.sourceTrailheadIds,
    sourceRelationPatternIds: proposal.sourceRelationPatternIds,
    canonicalSubjectLabels: canonicalList([
      proposal.subjectLabel, ...proposal.subjectAliases,
    ]),
    triggerPredicate: canonicalText(proposal.trigger.predicateLabel),
    canonicalTriggerSearchSignals: canonicalList(proposal.trigger.searchSignals),
    triggerInfluence: proposal.trigger.influence,
    stateDimension: proposal.state.dimension,
    stateLabel: canonicalText(proposal.state.label),
    dependentPredicate: canonicalText(proposal.dependent.predicateLabel),
    canonicalDependentSearchSignals: canonicalList(proposal.dependent.searchSignals),
    dependentRequirement: proposal.dependent.requirement,
    temporalPosture: proposal.temporalPosture,
    baselineTriggerListingRefs: Object.freeze(proposal.trigger.evidenceBindings
      .map((item) => item.listingRef).sort()),
    baselineDependentListingRefs: Object.freeze(proposal.dependent.evidenceBindings
      .map((item) => item.listingRef).sort()),
    counterScenarios: proposal.counterScenarios,
    rationale: proposal.rationale,
    proposedAt: proposal.proposedAt,
    authority: "WORLD_STATE_SEARCH_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, routeId: hashCanonical(body) });
}

export function compileConsolidatedWorldStateMechanismRoutes(
  proposalsInput: readonly WorldStateMechanismProposal[],
): readonly ConsolidatedWorldStateMechanismRoute[] {
  const proposals = proposalsInput.map(assertWorldStateMechanismProposal);
  const byFamily = new Map<Hash, WorldStateMechanismProposal[]>();
  for (const proposal of proposals) {
    const familyId = worldStateMechanismRouteFamilyIdentity(proposal);
    const family = byFamily.get(familyId) ?? [];
    family.push(proposal);
    byFamily.set(familyId, family);
  }
  return Object.freeze([...byFamily.entries()].map(([routeFamilyId, family]) => {
    const ordered = [...family].sort((left, right) =>
      left.proposedAt.localeCompare(right.proposedAt) ||
      left.proposalId.localeCompare(right.proposalId)
    );
    const canonicalRoute = compileStandingWorldStateMechanismRoute(ordered[0]!);
    const uniqueBindings = (
      values: readonly WorldStateMechanismEvidenceBinding[],
    ): readonly WorldStateMechanismEvidenceBinding[] => Object.freeze([
      ...new Map(values.map((binding) => [evidenceBindingIdentity(binding), binding])).values(),
    ].sort((left, right) =>
      evidenceBindingIdentity(left).localeCompare(evidenceBindingIdentity(right))
    ));
    const body = Object.freeze({
      schemaVersion: "pmh.consolidated-world-state-mechanism-route.v1" as const,
      routeFamilyId,
      canonicalRoute,
      sourceProposalIds: Object.freeze(ordered.map((item) => item.proposalId).sort()),
      sourceAgentRunIds: Object.freeze([...new Set(ordered
        .map((item) => item.sourceAgentRunId))].sort()),
      triggerEvidenceBindings: uniqueBindings(ordered.flatMap((item) =>
        item.trigger.evidenceBindings
      )),
      dependentEvidenceBindings: uniqueBindings(ordered.flatMap((item) =>
        item.dependent.evidenceBindings
      )),
      counterScenarios: Object.freeze([...new Map(ordered.flatMap((item) =>
        item.counterScenarios).map((scenario) => [canonicalText(scenario), scenario])).values()]
        .sort((left, right) => canonicalText(left).localeCompare(canonicalText(right)))),
      rationaleVariants: Object.freeze([...new Set(ordered
        .map((item) => item.rationale))].sort()),
      firstProposedAt: ordered[0]!.proposedAt,
      lastProposedAt: ordered.at(-1)!.proposedAt,
      authority: "CONSOLIDATED_WORLD_STATE_SEARCH_ROUTING_ONLY" as const,
      providerRequests: 0 as const,
      modelInvocations: 0 as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, routeId: hashCanonical(body) });
  }).sort((left, right) => left.routeFamilyId.localeCompare(right.routeFamilyId)));
}
