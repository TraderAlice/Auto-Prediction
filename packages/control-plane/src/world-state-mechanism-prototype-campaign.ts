import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertAgentCampaignSelectionBinding,
  type AgentCampaign,
  type AgentCampaignSelectionBinding,
  type AgentExecutionSnapshot,
  type AgentRun,
  type ExecutionProfile,
  type WorkloadRoute,
} from "./agent-execution-substrate.js";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type {
  WorldStateMechanismPrototypeInputRevision,
  WorldStateMechanismPrototypeResearchCase,
} from "./world-state-mechanism-prototype.js";

export const WORLD_STATE_MECHANISM_PROTOTYPE_SELECTION_PROTOCOL =
  "WORLD_STATE_MECHANISM_PROTOTYPE_SELECTION_V1" as const;

export type WorldStateMechanismPrototypeCampaignPreview = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-prototype-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskIds: readonly Hash[];
  candidateIds: readonly Hash[];
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE";
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 8;
    maximumInputTokens: "200000";
    maximumOutputTokens: "20000";
    maximumWallClockMs: 600000;
  }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
}>;

function semanticInputIdentity(input: WorldStateMechanismPrototypeInputRevision): Hash {
  return hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-prototype-semantic-input.v1",
    candidateId: input.candidateId,
    signature: input.signature,
    memberRouteFamilyIds: input.memberRouteFamilyIds,
    memberRouteIds: input.memberRouteIds,
    sourceProposalIds: input.sourceProposalIds,
    memberRoutes: input.memberRoutes,
  });
}

export function buildWorldStateMechanismPrototypeCampaignSelectionBinding(
  cases: readonly WorldStateMechanismPrototypeResearchCase[],
): AgentCampaignSelectionBinding {
  const taskBindings = Object.freeze(cases.map((item) => Object.freeze({
    taskId: item.task.taskId,
    workFamilyRef: `world-state-mechanism-prototype-candidate:${item.candidateId}`,
    selectionActionRef: item.currentInputRevision.revisionId,
    selectionActionKind: "RESEARCH_WORLD_STATE_MECHANISM_PROTOTYPE",
    inputRevisionKind: "WORLD_STATE_MECHANISM_PROTOTYPE_INPUT",
    inputRevisionId: item.currentInputRevision.revisionId,
    exactInputHash: hashCanonical(item.currentInputRevision),
    semanticInputIdentity: semanticInputIdentity(item.currentInputRevision),
  })).sort((left, right) => left.taskId.localeCompare(right.taskId)));
  return assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: WORLD_STATE_MECHANISM_PROTOTYPE_SELECTION_PROTOCOL,
    selectionIdentity: hashCanonical(taskBindings),
    selectionPolicyIdentity: hashCanonical({
      schemaVersion: "pmh.world-state-mechanism-prototype-selection-policy.v1",
      maximumTasks: 1,
      exactMultiRouteInputRequired: true,
      automaticDispatch: false,
    }),
    taskBindings,
  }));
}

export function resolveWorldStateMechanismPrototypeCampaignInput(input: Readonly<{
  taskId: Hash;
  run: AgentRun;
  campaigns: readonly AgentCampaign[];
  currentCases: readonly WorldStateMechanismPrototypeResearchCase[];
  loadInput?: (revisionId: Hash) => WorldStateMechanismPrototypeInputRevision | null;
}>): WorldStateMechanismPrototypeInputRevision {
  const current = input.currentCases.find((item) => item.task.taskId === input.taskId);
  if (input.run.authorization.kind !== "CAMPAIGN") {
    if (current === undefined) throw new Error("mechanism prototype current case is unavailable");
    return input.loadInput?.(current.currentInputRevision.revisionId) ??
      current.currentInputRevision;
  }
  const campaign = input.campaigns.find((item) =>
    item.campaignId === input.run.authorization.campaignId
  );
  if (campaign === undefined || campaign.schemaVersion === "pmh.agent-campaign.v1" ||
      campaign.selectionBinding.selectionProtocol !==
        WORLD_STATE_MECHANISM_PROTOTYPE_SELECTION_PROTOCOL) {
    throw new Error("mechanism prototype campaign has no immutable selection binding");
  }
  const binding = campaign.selectionBinding.taskBindings.find((item) =>
    item.taskId === input.taskId
  );
  if (binding === undefined ||
      binding.inputRevisionKind !== "WORLD_STATE_MECHANISM_PROTOTYPE_INPUT") {
    throw new Error("mechanism prototype campaign exact input binding is unavailable");
  }
  const retained = input.loadInput?.(binding.inputRevisionId) ?? null;
  if (retained === null || binding.exactInputHash !== hashCanonical(retained) ||
      binding.semanticInputIdentity !== semanticInputIdentity(retained) ||
      binding.workFamilyRef !==
        `world-state-mechanism-prototype-candidate:${retained.candidateId}`) {
    throw new Error("mechanism prototype campaign exact input binding cannot be resolved");
  }
  return retained;
}

export function buildWorldStateMechanismPrototypeCampaignPreview(input: Readonly<{
  cases: readonly WorldStateMechanismPrototypeResearchCase[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): WorldStateMechanismPrototypeCampaignPreview {
  const workloadRoute = [...input.execution.workloadRoutes]
    .filter((item) => item.taskKind === "MECHANISM_PROTOTYPE_RESEARCH")
    .sort((left, right) => right.revision - left.revision)[0];
  if (workloadRoute === undefined) {
    throw new Error("mechanism prototype workload route is unavailable");
  }
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined || executionProfile.toolPolicy.protocol !==
      "WORLD_STATE_MECHANISM_PROTOTYPE_TOOLS_V1") {
    throw new Error("mechanism prototype execution profile is unavailable");
  }
  const selected = input.cases.filter((item) => item.campaignEligible).slice(0, 1);
  const selectionBinding = buildWorldStateMechanismPrototypeCampaignSelectionBinding(selected);
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-prototype-campaign-preview.v1" as const,
    campaignKey: `world-state-mechanism-prototype-${selectionBinding.selectionIdentity.slice(7)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    selectionBinding,
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    candidateIds: Object.freeze(selected.map((item) => item.candidateId)),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE" as const,
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 8 as const,
      maximumInputTokens: "200000" as const,
      maximumOutputTokens: "20000" as const,
      maximumWallClockMs: 600_000 as const,
    }),
    creationEligible: selected.length > 0,
    dispatchEligible: selected.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: selected.length === 0
      ? "No unexplored mechanism prototype candidate is eligible"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
      ? input.capability.diagnostic
      : "One exact multi-route mechanism candidate awaits explicit campaign activation",
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    automaticDispatch: false as const,
    semanticDecisionAuthority: false as const,
    authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
