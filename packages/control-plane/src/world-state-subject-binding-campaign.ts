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
import {
  worldStateSubjectBindingResearchCaseIdentity,
  type WorldStateSubjectBindingResearchCase,
  type WorldStateSubjectBindingResearchInputRevision,
} from "./world-state-subject-binding-research.js";

export const WORLD_STATE_SUBJECT_BINDING_SELECTION_PROTOCOL =
  "WORLD_STATE_SUBJECT_BINDING_SELECTION_V1" as const;

export type WorldStateSubjectBindingCampaignPreview = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskIds: readonly Hash[];
  caseIds: readonly Hash[];
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE";
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 6;
    maximumInputTokens: "100000";
    maximumOutputTokens: "10000";
    maximumWallClockMs: 600000;
  }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  promotionAuthority: false;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
}>;

function semanticInputIdentity(input: WorldStateSubjectBindingResearchInputRevision): Hash {
  return hashCanonical({
    schemaVersion: "pmh.world-state-subject-binding-semantic-input.v1",
    caseId: input.caseId,
    routeFamilyId: input.routeFamilyId,
    sourceProposalIds: input.sourceProposalIds,
    candidateLabels: input.candidateLabels,
    ambiguityNotes: input.ambiguityNotes,
    triggerEvidenceBindings: input.triggerEvidenceBindings,
    dependentEvidenceBindings: input.dependentEvidenceBindings,
    counterScenarios: input.counterScenarios,
  });
}

export function buildWorldStateSubjectBindingCampaignSelectionBinding(
  cases: readonly WorldStateSubjectBindingResearchCase[],
): AgentCampaignSelectionBinding {
  const taskBindings = Object.freeze(cases.map((item) => Object.freeze({
    taskId: item.task.taskId,
    workFamilyRef: `world-state-subject-binding-case:${item.caseId}`,
    selectionActionRef: item.currentInputRevision.revisionId,
    selectionActionKind: "RESEARCH_WORLD_STATE_SUBJECT_BINDING",
    inputRevisionKind: "WORLD_STATE_SUBJECT_BINDING_INPUT",
    inputRevisionId: item.currentInputRevision.revisionId,
    exactInputHash: hashCanonical(item.currentInputRevision),
    semanticInputIdentity: semanticInputIdentity(item.currentInputRevision),
  })).sort((left, right) => left.taskId.localeCompare(right.taskId)));
  return assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: WORLD_STATE_SUBJECT_BINDING_SELECTION_PROTOCOL,
    selectionIdentity: hashCanonical(taskBindings),
    selectionPolicyIdentity: hashCanonical({
      schemaVersion: "pmh.world-state-subject-binding-selection-policy.v1",
      maximumTasks: 1,
      independentAuthoringAndPromotion: true,
      automaticDispatch: false,
    }),
    taskBindings,
  }));
}

export function resolveWorldStateSubjectBindingCampaignInput(input: Readonly<{
  taskId: Hash;
  run: AgentRun;
  campaigns: readonly AgentCampaign[];
  currentCases: readonly WorldStateSubjectBindingResearchCase[];
  loadInput?: (revisionId: Hash) => WorldStateSubjectBindingResearchInputRevision | null;
}>): WorldStateSubjectBindingResearchInputRevision {
  const current = input.currentCases.find((item) => item.task.taskId === input.taskId);
  if (input.run.authorization.kind !== "CAMPAIGN") {
    if (current === undefined) throw new Error("subject-binding current case is unavailable");
    return input.loadInput?.(current.currentInputRevision.revisionId) ??
      current.currentInputRevision;
  }
  const campaign = input.campaigns.find((item) =>
    item.campaignId === input.run.authorization.campaignId
  );
  if (campaign === undefined || campaign.schemaVersion === "pmh.agent-campaign.v1" ||
      campaign.selectionBinding.selectionProtocol !==
        WORLD_STATE_SUBJECT_BINDING_SELECTION_PROTOCOL) {
    throw new Error("subject-binding campaign has no immutable selection binding");
  }
  const binding = campaign.selectionBinding.taskBindings.find((item) =>
    item.taskId === input.taskId
  );
  if (binding === undefined ||
      binding.inputRevisionKind !== "WORLD_STATE_SUBJECT_BINDING_INPUT") {
    throw new Error("subject-binding campaign exact input binding is unavailable");
  }
  const retained = input.loadInput?.(binding.inputRevisionId) ?? null;
  if (retained === null || binding.exactInputHash !== hashCanonical(retained) ||
      binding.semanticInputIdentity !== semanticInputIdentity(retained) ||
      binding.workFamilyRef !==
        `world-state-subject-binding-case:${worldStateSubjectBindingResearchCaseIdentity(
          retained.routeFamilyId,
        )}`) {
    throw new Error("subject-binding campaign exact input binding cannot be resolved");
  }
  return retained;
}

export function buildWorldStateSubjectBindingCampaignPreview(input: Readonly<{
  cases: readonly WorldStateSubjectBindingResearchCase[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): WorldStateSubjectBindingCampaignPreview {
  const workloadRoute = [...input.execution.workloadRoutes]
    .filter((item) => item.taskKind === "SUBJECT_BINDING_RESEARCH")
    .sort((left, right) => right.revision - left.revision)[0];
  if (workloadRoute === undefined) throw new Error("subject-binding workload route is unavailable");
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined || executionProfile.toolPolicy.protocol !==
      "WORLD_STATE_SUBJECT_BINDING_TOOLS_V1") {
    throw new Error("subject-binding execution profile is unavailable");
  }
  const selected = input.cases.filter((item) => item.campaignEligible).slice(0, 1);
  const selectionBinding = buildWorldStateSubjectBindingCampaignSelectionBinding(selected);
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-subject-binding-campaign-preview.v1" as const,
    campaignKey: `world-state-subject-binding-${selectionBinding.selectionIdentity.slice(7)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    selectionBinding,
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    caseIds: Object.freeze(selected.map((item) => item.caseId)),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE" as const,
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 6 as const,
      maximumInputTokens: "100000" as const,
      maximumOutputTokens: "10000" as const,
      maximumWallClockMs: 600_000 as const,
    }),
    creationEligible: selected.length > 0,
    dispatchEligible: selected.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: selected.length === 0
      ? "No unexplored subject-binding case is eligible"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
      ? input.capability.diagnostic
      : "One exact subject-binding case awaits explicit campaign activation",
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    automaticDispatch: false as const,
    promotionAuthority: false as const,
    authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
