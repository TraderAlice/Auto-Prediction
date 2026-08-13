import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildAgentTask,
  type AgentExecutionSnapshot,
  type AgentTask,
} from "./agent-execution-substrate.js";
import type {
  ConsolidatedWorldStateMechanismRoute,
  WorldStateDependentRequirement,
  WorldStateDimension,
  WorldStateTemporalPosture,
  WorldStateTriggerInfluence,
} from "./world-state-mechanism.js";
import type { OperationalStorageProjection } from "./types.js";

const ESTABLISHED_AT = "2026-08-13T00:00:00.000Z";
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export const WORLD_STATE_MECHANISM_PROTOTYPE_TASK_PROTOCOL =
  "WORLD_STATE_MECHANISM_PROTOTYPE_TASK_V1" as const;
export const WORLD_STATE_MECHANISM_PROTOTYPE_TOOL_PROTOCOL =
  "WORLD_STATE_MECHANISM_PROTOTYPE_TOOLS_V1" as const;

export type WorldStateMechanismPrototypeSignature = Readonly<{
  triggerInfluence: WorldStateTriggerInfluence;
  stateDimension: WorldStateDimension;
  dependentRequirement: WorldStateDependentRequirement;
  temporalPosture: WorldStateTemporalPosture;
}>;

export type WorldStateMechanismPrototypeTaskContract = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-prototype-task.v1";
  candidateId: Hash;
  signature: WorldStateMechanismPrototypeSignature;
  objective: "PROPOSE_OR_ABSTAIN_FROM_PARAMETERIZED_MECHANISM_PROTOTYPE";
  inputBinding: "EXACT_PROTOTYPE_CANDIDATE_INPUT_REQUIRED";
  minimumIndependentRouteFamilies: 2;
  minimumIndependentAuthoringRuns: 2;
  authority: "MECHANISM_PROTOTYPE_RESEARCH_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismPrototypeInputRevision = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-prototype-input.v1";
  revisionId: Hash;
  candidateId: Hash;
  signature: WorldStateMechanismPrototypeSignature;
  memberRouteFamilyIds: readonly Hash[];
  memberRouteIds: readonly Hash[];
  sourceProposalIds: readonly Hash[];
  sourceAuthoringRunIds: readonly Hash[];
  memberRoutes: readonly ConsolidatedWorldStateMechanismRoute[];
  materializedAt: string;
  structuralCompatibilityAuthority: "TYPED_COMPARISON_CANDIDATE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismPrototypeResearchCase = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-prototype-research-case.v1";
  candidateId: Hash;
  currentInputRevision: WorldStateMechanismPrototypeInputRevision;
  task: AgentTask;
  taskContract: WorldStateMechanismPrototypeTaskContract;
  proposalIds: readonly Hash[];
  abstentionIds: readonly Hash[];
  state: "UNEXPLORED" | "PROPOSED" | "ABSTAINED";
  campaignEligible: boolean;
  automaticDispatch: false;
  authority: "MECHANISM_PROTOTYPE_COMPARISON_CASE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismPrototypeVariableSlot = Readonly<{
  name: string;
  role: "SUBJECT" | "TRIGGER" | "STATE" | "DEPENDENT";
  description: string;
  values: readonly Readonly<{ routeFamilyId: Hash; value: string }>[];
}>;

export type WorldStateMechanismPrototypeProposal = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-prototype-proposal.v1";
  prototypeId: Hash;
  candidateId: Hash;
  inputRevisionId: Hash;
  sourceAgentRunId: Hash;
  memberRouteFamilyIds: readonly Hash[];
  invariantSignature: WorldStateMechanismPrototypeSignature;
  label: string;
  invariantDescription: string;
  variableSlots: readonly WorldStateMechanismPrototypeVariableSlot[];
  searchSignals: readonly string[];
  transferTests: readonly string[];
  counterScenarios: readonly string[];
  rationale: string;
  proposedAt: string;
  authority: "PARAMETERIZED_MECHANISM_PROTOTYPE_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismPrototypeAbstention = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-prototype-abstention.v1";
  abstentionId: Hash;
  candidateId: Hash;
  inputRevisionId: Hash;
  sourceAgentRunId: Hash;
  memberRouteFamilyIds: readonly Hash[];
  reason: string;
  missingEvidence: readonly string[];
  incompatibleDimensions: readonly string[];
  counterScenarios: readonly string[];
  proposedAt: string;
  authority: "EVIDENCE_BOUND_MECHANISM_PROTOTYPE_ABSTENTION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface WorldStateMechanismPrototypeStore {
  readonly worldStateMechanismPrototypeInputStorage:
    OperationalStorageProjection<"revisionId">;
  readonly worldStateMechanismPrototypeProposalStorage:
    OperationalStorageProjection<"prototypeId">;
  readonly worldStateMechanismPrototypeAbstentionStorage:
    OperationalStorageProjection<"abstentionId">;
  loadWorldStateMechanismPrototypeInputs(limit: number):
    readonly WorldStateMechanismPrototypeInputRevision[];
  saveWorldStateMechanismPrototypeInputs(inputs:
    readonly WorldStateMechanismPrototypeInputRevision[]):
    readonly WorldStateMechanismPrototypeInputRevision[];
  loadWorldStateMechanismPrototypeProposals(limit: number):
    readonly WorldStateMechanismPrototypeProposal[];
  saveWorldStateMechanismPrototypeProposals(proposals:
    readonly WorldStateMechanismPrototypeProposal[]):
    readonly WorldStateMechanismPrototypeProposal[];
  loadWorldStateMechanismPrototypeAbstentions(limit: number):
    readonly WorldStateMechanismPrototypeAbstention[];
  saveWorldStateMechanismPrototypeAbstentions(abstentions:
    readonly WorldStateMechanismPrototypeAbstention[]):
    readonly WorldStateMechanismPrototypeAbstention[];
}

export type WorldStateMechanismPrototypeCandidateUsage = Readonly<{
  sourceRunIds: readonly Hash[];
  retainedSourceRunCount: number;
  missingSourceRunCount: number;
  modelInvocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  unknownUsageInvocationCount: number;
}>;

function signature(route: ConsolidatedWorldStateMechanismRoute):
  WorldStateMechanismPrototypeSignature {
  return Object.freeze({
    triggerInfluence: route.canonicalRoute.triggerInfluence,
    stateDimension: route.canonicalRoute.stateDimension,
    dependentRequirement: route.canonicalRoute.dependentRequirement,
    temporalPosture: route.canonicalRoute.temporalPosture,
  });
}

function canonicalText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" &&
    value === value.trim().replace(/\s+/gu, " ") && value.length <= maximum;
}

function canonicalTexts(values: readonly string[], minimum: number, maximum: number):
  readonly string[] {
  const result = [...new Set(values.map(canonicalText))].sort();
  if (result.length < minimum || result.length > maximum ||
      result.some((item) => !boundedText(item, 500))) {
    throw new Error("mechanism prototype text set is invalid");
  }
  return Object.freeze(result);
}

function canonicalIso(value: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error("mechanism prototype timestamp is invalid");
  }
  return value;
}

function exactHashes(values: readonly Hash[], minimum = 1): readonly Hash[] {
  const result = [...new Set(values)].sort();
  if (result.length < minimum || result.some((item) => !HASH_PATTERN.test(item))) {
    throw new Error("mechanism prototype lineage hashes are invalid");
  }
  return Object.freeze(result);
}

function object(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} is malformed`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  name: string,
): void {
  if (Object.keys(value).sort().join("\n") !== [...expected].sort().join("\n")) {
    throw new Error(`${name} contains unknown or missing fields`);
  }
}

function validSignature(value: unknown): value is WorldStateMechanismPrototypeSignature {
  const item = object(value, "mechanism prototype signature");
  exactKeys(item, [
    "triggerInfluence", "stateDimension", "dependentRequirement", "temporalPosture",
  ], "mechanism prototype signature");
  return ["MAY_DEGRADE_STATE", "MAY_ENABLE_STATE", "MAY_TERMINATE_STATE"]
      .includes(String(item.triggerInfluence)) &&
    ["EXISTENCE", "PHYSICAL_CAPABILITY", "LEGAL_ELIGIBILITY", "OFFICE_HOLDING",
      "OPERATIONAL_AVAILABILITY", "POSSESSION", "LOCATION", "WILLINGNESS"]
      .includes(String(item.stateDimension)) &&
    ["REQUIRES_STATE_PRESENT", "REQUIRES_STATE_ABSENT", "STATE_INFLUENCES_LIKELIHOOD"]
      .includes(String(item.dependentRequirement)) &&
    ["TRIGGER_PRECEDES_DEPENDENT", "TRIGGER_OVERLAPS_DEPENDENT", "ORDER_UNCERTAIN"]
      .includes(String(item.temporalPosture));
}

function sameSignature(
  left: WorldStateMechanismPrototypeSignature,
  right: WorldStateMechanismPrototypeSignature,
): boolean {
  return left.triggerInfluence === right.triggerInfluence &&
    left.stateDimension === right.stateDimension &&
    left.dependentRequirement === right.dependentRequirement &&
    left.temporalPosture === right.temporalPosture;
}

function validAuthorityBoundary(item: Readonly<Record<string, unknown>>): boolean {
  return item.semanticDecisionAuthority === false && item.probabilityAuthority === false &&
    item.certificateAuthority === false && item.executionAuthority === false &&
    item.externalWriteAuthority === false && item.valueMovingAuthority === false;
}

export function assertWorldStateMechanismPrototypeInput(
  value: unknown,
): WorldStateMechanismPrototypeInputRevision {
  const item = object(value, "mechanism prototype input");
  exactKeys(item, [
    "schemaVersion", "revisionId", "candidateId", "signature", "memberRouteFamilyIds",
    "memberRouteIds", "sourceProposalIds", "sourceAuthoringRunIds", "memberRoutes",
    "materializedAt", "structuralCompatibilityAuthority", "semanticDecisionAuthority",
    "probabilityAuthority", "certificateAuthority", "executionAuthority",
    "externalWriteAuthority", "valueMovingAuthority",
  ], "mechanism prototype input");
  const typed = item as unknown as WorldStateMechanismPrototypeInputRevision;
  const { revisionId, ...body } = typed;
  if (typed.schemaVersion !== "pmh.world-state-mechanism-prototype-input.v1" ||
      !HASH_PATTERN.test(String(revisionId)) || revisionId !== hashCanonical(body) ||
      !validSignature(typed.signature) ||
      typed.candidateId !== worldStateMechanismPrototypeCandidateIdentity(typed.signature) ||
      exactHashes(typed.memberRouteFamilyIds, 2).join("\n") !==
        typed.memberRouteFamilyIds.join("\n") ||
      exactHashes(typed.memberRouteIds, 2).join("\n") !== typed.memberRouteIds.join("\n") ||
      exactHashes(typed.sourceProposalIds, 2).join("\n") !==
        typed.sourceProposalIds.join("\n") ||
      exactHashes(typed.sourceAuthoringRunIds, 2).join("\n") !==
        typed.sourceAuthoringRunIds.join("\n") ||
      !Array.isArray(typed.memberRoutes) ||
      typed.memberRoutes.length !== typed.memberRouteFamilyIds.length ||
      typed.memberRoutes.some((route, index) =>
        route.routeFamilyId !== typed.memberRouteFamilyIds[index] ||
        !typed.memberRouteIds.includes(route.routeId) ||
        !sameSignature(signature(route), typed.signature)
      ) || canonicalIso(typed.materializedAt) !== typed.materializedAt ||
      typed.structuralCompatibilityAuthority !== "TYPED_COMPARISON_CANDIDATE_ONLY" ||
      !validAuthorityBoundary(item)) {
    throw new Error("mechanism prototype input is invalid");
  }
  return Object.freeze(typed);
}

function routeRoleText(
  route: ConsolidatedWorldStateMechanismRoute,
  role: WorldStateMechanismPrototypeVariableSlot["role"],
): readonly string[] {
  return role === "SUBJECT" ? route.canonicalRoute.canonicalSubjectLabels
    : role === "TRIGGER" ? [
      route.canonicalRoute.triggerPredicate,
      ...route.canonicalRoute.canonicalTriggerSearchSignals,
    ]
    : role === "STATE" ? [route.canonicalRoute.stateLabel]
    : [
      route.canonicalRoute.dependentPredicate,
      ...route.canonicalRoute.canonicalDependentSearchSignals,
    ];
}

function buildVariableSlot(input: Readonly<{
  slot: WorldStateMechanismPrototypeVariableSlot;
  researchInput: WorldStateMechanismPrototypeInputRevision;
}>): WorldStateMechanismPrototypeVariableSlot {
  if (!boundedText(input.slot.name, 100) ||
      !["SUBJECT", "TRIGGER", "STATE", "DEPENDENT"].includes(input.slot.role) ||
      !boundedText(input.slot.description, 500)) {
    throw new Error("mechanism prototype variable slot is malformed");
  }
  const values = [...input.slot.values].sort((left, right) =>
    left.routeFamilyId.localeCompare(right.routeFamilyId)
  );
  if (values.length !== input.researchInput.memberRouteFamilyIds.length ||
      values.some((item, index) =>
        item.routeFamilyId !== input.researchInput.memberRouteFamilyIds[index] ||
        !boundedText(item.value, 500)
      ) || new Set(values.map((item) => item.routeFamilyId)).size !== values.length ||
      new Set(values.map((item) => canonicalText(item.value))).size < 2) {
    throw new Error("mechanism prototype variable slot must vary across every member route");
  }
  for (const value of values) {
    const route = input.researchInput.memberRoutes.find((item) =>
      item.routeFamilyId === value.routeFamilyId
    )!;
    if (!routeRoleText(route, input.slot.role).some((text) =>
      canonicalText(text).includes(canonicalText(value.value))
    )) {
      throw new Error("mechanism prototype variable value is not grounded in its route role");
    }
  }
  return Object.freeze({
    name: canonicalText(input.slot.name),
    role: input.slot.role,
    description: input.slot.description,
    values: Object.freeze(values.map((item) => Object.freeze(item))),
  });
}

export function buildWorldStateMechanismPrototypeProposal(input: Readonly<{
  researchInput: WorldStateMechanismPrototypeInputRevision;
  sourceAgentRunId: Hash;
  label: string;
  invariantDescription: string;
  variableSlots: readonly WorldStateMechanismPrototypeVariableSlot[];
  searchSignals: readonly string[];
  transferTests: readonly string[];
  counterScenarios: readonly string[];
  rationale: string;
  proposedAt: string;
}>): WorldStateMechanismPrototypeProposal {
  if (!HASH_PATTERN.test(input.sourceAgentRunId) || !boundedText(input.label, 240) ||
      !boundedText(input.invariantDescription, 1_000) ||
      input.variableSlots.length < 1 || input.variableSlots.length > 12 ||
      !boundedText(input.rationale, 2_000)) {
    throw new Error("mechanism prototype proposal is malformed");
  }
  const variableSlots = Object.freeze(input.variableSlots.map((slot) =>
    buildVariableSlot({ slot, researchInput: input.researchInput })
  ).sort((left, right) => left.name.localeCompare(right.name)));
  if (new Set(variableSlots.map((item) => item.name)).size !== variableSlots.length) {
    throw new Error("mechanism prototype proposal repeats a variable slot");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-prototype-proposal.v1" as const,
    candidateId: input.researchInput.candidateId,
    inputRevisionId: input.researchInput.revisionId,
    sourceAgentRunId: input.sourceAgentRunId,
    memberRouteFamilyIds: input.researchInput.memberRouteFamilyIds,
    invariantSignature: input.researchInput.signature,
    label: input.label,
    invariantDescription: input.invariantDescription,
    variableSlots,
    searchSignals: canonicalTexts(input.searchSignals, 1, 12),
    transferTests: canonicalTexts(input.transferTests, 1, 12),
    counterScenarios: canonicalTexts(input.counterScenarios, 1, 12),
    rationale: input.rationale,
    proposedAt: canonicalIso(input.proposedAt),
    authority: "PARAMETERIZED_MECHANISM_PROTOTYPE_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, prototypeId: hashCanonical(body) });
}

export function buildWorldStateMechanismPrototypeAbstention(input: Readonly<{
  researchInput: WorldStateMechanismPrototypeInputRevision;
  sourceAgentRunId: Hash;
  reason: string;
  missingEvidence: readonly string[];
  incompatibleDimensions: readonly string[];
  counterScenarios: readonly string[];
  proposedAt: string;
}>): WorldStateMechanismPrototypeAbstention {
  if (!HASH_PATTERN.test(input.sourceAgentRunId) || !boundedText(input.reason, 2_000)) {
    throw new Error("mechanism prototype abstention is malformed");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-prototype-abstention.v1" as const,
    candidateId: input.researchInput.candidateId,
    inputRevisionId: input.researchInput.revisionId,
    sourceAgentRunId: input.sourceAgentRunId,
    memberRouteFamilyIds: input.researchInput.memberRouteFamilyIds,
    reason: input.reason,
    missingEvidence: canonicalTexts(input.missingEvidence, 1, 12),
    incompatibleDimensions: canonicalTexts(input.incompatibleDimensions, 1, 12),
    counterScenarios: canonicalTexts(input.counterScenarios, 1, 12),
    proposedAt: canonicalIso(input.proposedAt),
    authority: "EVIDENCE_BOUND_MECHANISM_PROTOTYPE_ABSTENTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, abstentionId: hashCanonical(body) });
}

export function assertWorldStateMechanismPrototypeProposal(value: unknown):
  WorldStateMechanismPrototypeProposal {
  const item = object(value, "mechanism prototype proposal");
  exactKeys(item, [
    "schemaVersion", "prototypeId", "candidateId", "inputRevisionId",
    "sourceAgentRunId", "memberRouteFamilyIds", "invariantSignature", "label",
    "invariantDescription", "variableSlots", "searchSignals", "transferTests",
    "counterScenarios", "rationale", "proposedAt", "authority",
    "semanticDecisionAuthority", "probabilityAuthority", "certificateAuthority",
    "executionAuthority", "externalWriteAuthority", "valueMovingAuthority",
  ], "mechanism prototype proposal");
  const proposal = item as unknown as WorldStateMechanismPrototypeProposal;
  const { prototypeId, ...body } = proposal;
  if (proposal.schemaVersion !== "pmh.world-state-mechanism-prototype-proposal.v1" ||
      !HASH_PATTERN.test(String(prototypeId)) || prototypeId !== hashCanonical(body) ||
      ![proposal.candidateId, proposal.inputRevisionId, proposal.sourceAgentRunId]
        .every((field) => HASH_PATTERN.test(String(field))) ||
      !validSignature(proposal.invariantSignature) ||
      proposal.candidateId !==
        worldStateMechanismPrototypeCandidateIdentity(proposal.invariantSignature) ||
      exactHashes(proposal.memberRouteFamilyIds, 2).join("\n") !==
        proposal.memberRouteFamilyIds.join("\n") || !boundedText(proposal.label, 240) ||
      !boundedText(proposal.invariantDescription, 1_000) ||
      !Array.isArray(proposal.variableSlots) || proposal.variableSlots.length < 1 ||
      proposal.variableSlots.length > 12 || proposal.variableSlots.some((slot) => {
        const slotItem = object(slot, "mechanism prototype variable slot");
        exactKeys(slotItem, ["name", "role", "description", "values"],
          "mechanism prototype variable slot");
        return !boundedText(slot.name, 100) || canonicalText(slot.name) !== slot.name ||
          !["SUBJECT", "TRIGGER", "STATE", "DEPENDENT"].includes(slot.role) ||
          !boundedText(slot.description, 500) || !Array.isArray(slot.values) ||
          slot.values.length !== proposal.memberRouteFamilyIds.length ||
          slot.values.some((entry: Readonly<{ routeFamilyId: Hash; value: string }>, index: number) => {
            const entryItem = object(entry, "mechanism prototype variable value");
            exactKeys(entryItem, ["routeFamilyId", "value"],
              "mechanism prototype variable value");
            return entry.routeFamilyId !== proposal.memberRouteFamilyIds[index] ||
              !boundedText(entry.value, 500);
          }) || new Set(slot.values.map(
            (entry: Readonly<{ routeFamilyId: Hash; value: string }>) =>
              canonicalText(entry.value),
          )).size < 2;
      }) || new Set(proposal.variableSlots.map((slot) => slot.name)).size !==
        proposal.variableSlots.length ||
      canonicalTexts(proposal.searchSignals, 1, 12).join("\n") !==
        proposal.searchSignals.join("\n") ||
      canonicalTexts(proposal.transferTests, 1, 12).join("\n") !==
        proposal.transferTests.join("\n") ||
      canonicalTexts(proposal.counterScenarios, 1, 12).join("\n") !==
        proposal.counterScenarios.join("\n") || !boundedText(proposal.rationale, 2_000) ||
      canonicalIso(proposal.proposedAt) !== proposal.proposedAt ||
      proposal.authority !== "PARAMETERIZED_MECHANISM_PROTOTYPE_PROPOSAL_ONLY" ||
      !validAuthorityBoundary(item)) {
    throw new Error("mechanism prototype proposal violates its authority or identity");
  }
  return proposal;
}

export function assertWorldStateMechanismPrototypeAbstention(value: unknown):
  WorldStateMechanismPrototypeAbstention {
  const item = object(value, "mechanism prototype abstention");
  exactKeys(item, [
    "schemaVersion", "abstentionId", "candidateId", "inputRevisionId",
    "sourceAgentRunId", "memberRouteFamilyIds", "reason", "missingEvidence",
    "incompatibleDimensions", "counterScenarios", "proposedAt", "authority",
    "semanticDecisionAuthority", "probabilityAuthority", "certificateAuthority",
    "executionAuthority", "externalWriteAuthority", "valueMovingAuthority",
  ], "mechanism prototype abstention");
  const abstention = item as unknown as WorldStateMechanismPrototypeAbstention;
  const { abstentionId, ...body } = abstention;
  if (abstention.schemaVersion !== "pmh.world-state-mechanism-prototype-abstention.v1" ||
      !HASH_PATTERN.test(String(abstentionId)) || abstentionId !== hashCanonical(body) ||
      ![abstention.candidateId, abstention.inputRevisionId, abstention.sourceAgentRunId]
        .every((field) => HASH_PATTERN.test(String(field))) ||
      exactHashes(abstention.memberRouteFamilyIds, 2).join("\n") !==
        abstention.memberRouteFamilyIds.join("\n") || !boundedText(abstention.reason, 2_000) ||
      canonicalTexts(abstention.missingEvidence, 1, 12).join("\n") !==
        abstention.missingEvidence.join("\n") ||
      canonicalTexts(abstention.incompatibleDimensions, 1, 12).join("\n") !==
        abstention.incompatibleDimensions.join("\n") ||
      canonicalTexts(abstention.counterScenarios, 1, 12).join("\n") !==
        abstention.counterScenarios.join("\n") ||
      canonicalIso(abstention.proposedAt) !== abstention.proposedAt ||
      abstention.authority !== "EVIDENCE_BOUND_MECHANISM_PROTOTYPE_ABSTENTION_ONLY" ||
      !validAuthorityBoundary(item)) {
    throw new Error("mechanism prototype abstention violates its authority or identity");
  }
  return abstention;
}

export function worldStateMechanismPrototypeCandidateIdentity(
  value: WorldStateMechanismPrototypeSignature,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-prototype-candidate-identity.v1",
    ...value,
  });
}

export function buildWorldStateMechanismPrototypeTaskContract(
  value: WorldStateMechanismPrototypeSignature,
): WorldStateMechanismPrototypeTaskContract {
  return Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-prototype-task.v1" as const,
    candidateId: worldStateMechanismPrototypeCandidateIdentity(value),
    signature: value,
    objective: "PROPOSE_OR_ABSTAIN_FROM_PARAMETERIZED_MECHANISM_PROTOTYPE" as const,
    inputBinding: "EXACT_PROTOTYPE_CANDIDATE_INPUT_REQUIRED" as const,
    minimumIndependentRouteFamilies: 2 as const,
    minimumIndependentAuthoringRuns: 2 as const,
    authority: "MECHANISM_PROTOTYPE_RESEARCH_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}

function buildInput(
  memberRoutesInput: readonly ConsolidatedWorldStateMechanismRoute[],
): WorldStateMechanismPrototypeInputRevision {
  const memberRoutes = Object.freeze([...memberRoutesInput].sort((left, right) =>
    left.routeFamilyId.localeCompare(right.routeFamilyId)
  ));
  const candidateSignature = signature(memberRoutes[0]!);
  const candidateId = worldStateMechanismPrototypeCandidateIdentity(candidateSignature);
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-prototype-input.v1" as const,
    candidateId,
    signature: candidateSignature,
    memberRouteFamilyIds: Object.freeze(memberRoutes.map((item) => item.routeFamilyId)),
    memberRouteIds: Object.freeze(memberRoutes.map((item) => item.routeId).sort()),
    sourceProposalIds: Object.freeze([...new Set(memberRoutes.flatMap((item) =>
      item.sourceProposalIds))].sort()),
    sourceAuthoringRunIds: Object.freeze([...new Set(memberRoutes.flatMap((item) =>
      item.sourceAgentRunIds))].sort()),
    memberRoutes,
    materializedAt: [...memberRoutes].sort((left, right) =>
      left.lastProposedAt.localeCompare(right.lastProposedAt)
    ).at(-1)!.lastProposedAt,
    structuralCompatibilityAuthority: "TYPED_COMPARISON_CANDIDATE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateMechanismPrototypeInput(Object.freeze({
    ...body, revisionId: hashCanonical(body),
  }));
}

export function materializeWorldStateMechanismPrototypeResearchCases(
  routesInput: readonly ConsolidatedWorldStateMechanismRoute[],
  proposalsInput: readonly WorldStateMechanismPrototypeProposal[] = [],
  abstentionsInput: readonly WorldStateMechanismPrototypeAbstention[] = [],
): readonly WorldStateMechanismPrototypeResearchCase[] {
  const byCandidate = new Map<Hash, ConsolidatedWorldStateMechanismRoute[]>();
  for (const route of routesInput) {
    const candidateId = worldStateMechanismPrototypeCandidateIdentity(signature(route));
    const members = byCandidate.get(candidateId) ?? [];
    members.push(route);
    byCandidate.set(candidateId, members);
  }
  return Object.freeze([...byCandidate.entries()].flatMap(([candidateId, members]) => {
    const routeFamilies = new Set(members.map((item) => item.routeFamilyId));
    const authoringRuns = new Set(members.flatMap((item) => item.sourceAgentRunIds));
    if (routeFamilies.size < 2 || authoringRuns.size < 2) return [];
    const currentInputRevision = buildInput(members);
    const proposals = proposalsInput.filter((item) =>
      item.candidateId === candidateId &&
      item.inputRevisionId === currentInputRevision.revisionId
    );
    const abstentions = abstentionsInput.filter((item) =>
      item.candidateId === candidateId &&
      item.inputRevisionId === currentInputRevision.revisionId
    );
    const state = proposals.length > 0 ? "PROPOSED" as const
      : abstentions.length > 0 ? "ABSTAINED" as const : "UNEXPLORED" as const;
    const taskContract = buildWorldStateMechanismPrototypeTaskContract(
      currentInputRevision.signature,
    );
    const task = buildAgentTask({
      kind: "MECHANISM_PROTOTYPE_RESEARCH",
      protocol: WORLD_STATE_MECHANISM_PROTOTYPE_TASK_PROTOCOL,
      inputArtifacts: [{
        kind: "WORLD_STATE_MECHANISM_PROTOTYPE_CANDIDATE",
        artifactId: candidateId,
        artifactHash: hashCanonical(taskContract),
      }],
      taskPayload: taskContract,
      requestedEffectProtocol: WORLD_STATE_MECHANISM_PROTOTYPE_TOOL_PROTOCOL,
      provenanceRef: `world-state-mechanism-prototype-candidate:${candidateId}`,
      priority: 500,
      createdAt: ESTABLISHED_AT,
    });
    return [Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-prototype-research-case.v1" as const,
      candidateId,
      currentInputRevision,
      task,
      taskContract,
      proposalIds: exactHashes(proposals.map((item) => item.prototypeId), 0),
      abstentionIds: exactHashes(abstentions.map((item) => item.abstentionId), 0),
      state,
      campaignEligible: state === "UNEXPLORED",
      automaticDispatch: false as const,
      authority: "MECHANISM_PROTOTYPE_COMPARISON_CASE_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    })];
  }).sort((left, right) => left.candidateId.localeCompare(right.candidateId)));
}

export function worldStateMechanismPrototypeCandidateUsage(input: Readonly<{
  researchCase: WorldStateMechanismPrototypeResearchCase;
  execution: AgentExecutionSnapshot;
}>): WorldStateMechanismPrototypeCandidateUsage {
  const sourceRunIds = input.researchCase.currentInputRevision.sourceAuthoringRunIds;
  const requested = new Set(sourceRunIds);
  const retained = new Set(input.execution.runs.filter((item) => requested.has(item.runId))
    .map((item) => item.runId));
  const invocations = input.execution.modelInvocations.filter((item) =>
    retained.has(item.runId)
  );
  const sum = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, item) => total + BigInt(item[key] ?? "0"), 0n).toString();
  return Object.freeze({
    sourceRunIds,
    retainedSourceRunCount: retained.size,
    missingSourceRunCount: sourceRunIds.length - retained.size,
    modelInvocationCount: invocations.length,
    knownInputTokens: sum("inputTokens"),
    knownOutputTokens: sum("outputTokens"),
    knownReasoningTokens: sum("reasoningTokens"),
    unknownUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null ||
      item.reasoningTokens === null
    ).length,
  });
}
