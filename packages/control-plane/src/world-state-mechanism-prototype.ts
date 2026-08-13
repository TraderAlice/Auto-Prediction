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

const ESTABLISHED_AT = "2026-08-13T00:00:00.000Z";

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
  state: "UNEXPLORED";
  campaignEligible: false;
  automaticDispatch: false;
  authority: "MECHANISM_PROTOTYPE_COMPARISON_CASE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

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
  return Object.freeze({ ...body, revisionId: hashCanonical(body) });
}

export function materializeWorldStateMechanismPrototypeResearchCases(
  routesInput: readonly ConsolidatedWorldStateMechanismRoute[],
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
      state: "UNEXPLORED" as const,
      campaignEligible: false as const,
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
