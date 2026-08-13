import { hashCanonical, type Hash } from "@pmh/domain";
import { assertAgentCampaignSelectionBinding, type AgentCampaign, type AgentCampaignSelectionBinding, type AgentExecutionSnapshot, type AgentRun, type ExecutionProfile, type WorkloadRoute } from "./agent-execution-substrate.js";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type { OntologySearchIssueRevision } from "./ontology-search-ecology.js";
import {
  buildWorldStateMechanismAllocation,
  type WorldStateMechanismAllocationProjection,
} from "./world-state-mechanism-allocation.js";
import { mechanismResearchSemanticInputIdentity, type WorldStateMechanismResearchAssignment } from "./world-state-mechanism-research.js";

export const WORLD_STATE_MECHANISM_SELECTION_PROTOCOL =
  "WORLD_STATE_MECHANISM_RESEARCH_SELECTION_V1" as const;

export type WorldStateMechanismCampaignPreview = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  allocation: WorldStateMechanismAllocationProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskIds: readonly Hash[];
  mechanismIssueIds: readonly Hash[];
  omittedEligibleIssueCount: number;
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 8;
    maximumInputTokens: "200000";
    maximumOutputTokens: "20000";
    maximumWallClockMs: 900000;
  }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
}>;

export function buildWorldStateMechanismCampaignSelectionBinding(input: Readonly<{
  assignments: readonly WorldStateMechanismResearchAssignment[];
  revisions: readonly OntologySearchIssueRevision[];
  allocation?: WorldStateMechanismAllocationProjection;
}>): AgentCampaignSelectionBinding {
  const revisions = new Map(input.revisions.map((item) => [item.revisionId, item] as const));
  const bindings = input.assignments.map((assignment) => {
    const revision = revisions.get(assignment.sourceRevisionId);
    if (revision === undefined) throw new Error("mechanism assignment source revision is unavailable");
    return Object.freeze({
      taskId: assignment.task.taskId,
      workFamilyRef: `world-state-mechanism-issue:${assignment.mechanismIssueId}`,
      selectionActionRef: input.allocation?.selectedActions.find((item) =>
        item.assignmentId === assignment.assignmentId
      )?.actionId ?? assignment.assignmentId,
      selectionActionKind: "RESEARCH_WORLD_STATE_MECHANISM",
      inputRevisionKind: "ONTOLOGY_SEARCH_ISSUE",
      inputRevisionId: revision.revisionId,
      exactInputHash: hashCanonical(revision.taskPayload),
      semanticInputIdentity: mechanismResearchSemanticInputIdentity(revision),
    });
  }).sort((left, right) => left.taskId.localeCompare(right.taskId));
  return assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: WORLD_STATE_MECHANISM_SELECTION_PROTOCOL,
    selectionIdentity: input.allocation?.projectionIdentity ?? hashCanonical(bindings),
    selectionPolicyIdentity: input.allocation?.policy.policyIdentity ?? hashCanonical({
      schemaVersion: "pmh.world-state-mechanism-selection-policy.v1",
      maximumTasks: 8,
      oneRunPerExactInput: true,
      automaticDispatch: false,
    }),
    taskBindings: Object.freeze(bindings),
  }));
}

export function resolveWorldStateMechanismTaskRevision(input: Readonly<{
  taskId: Hash;
  run: AgentRun;
  campaigns: readonly AgentCampaign[];
  assignments: readonly WorldStateMechanismResearchAssignment[];
  currentRevisions: readonly OntologySearchIssueRevision[];
  loadRevision?: (revisionId: Hash) => OntologySearchIssueRevision | null;
}>): OntologySearchIssueRevision {
  const assignment = input.assignments.find((item) => item.task.taskId === input.taskId);
  if (assignment === undefined) throw new Error("mechanism research assignment is unavailable");
  if (input.run.authorization.kind !== "CAMPAIGN") {
    const revision = input.loadRevision?.(assignment.sourceRevisionId) ??
      input.currentRevisions.find((item) => item.revisionId === assignment.sourceRevisionId);
    if (revision === undefined) throw new Error("mechanism research exact input is unavailable");
    return revision;
  }
  const campaign = input.campaigns.find((item) =>
    item.campaignId === input.run.authorization.campaignId
  );
  if (campaign === undefined || campaign.schemaVersion === "pmh.agent-campaign.v1" ||
      campaign.selectionBinding.selectionProtocol !== WORLD_STATE_MECHANISM_SELECTION_PROTOCOL) {
    throw new Error("mechanism campaign has no immutable selection binding");
  }
  const binding = campaign.selectionBinding.taskBindings.find((item) =>
    item.taskId === input.taskId
  );
  if (binding === undefined || binding.inputRevisionKind !== "ONTOLOGY_SEARCH_ISSUE") {
    throw new Error("mechanism campaign exact input binding is unavailable");
  }
  const revision = input.loadRevision?.(binding.inputRevisionId) ??
    input.currentRevisions.find((item) => item.revisionId === binding.inputRevisionId);
  if (revision === undefined || binding.exactInputHash !== hashCanonical(revision.taskPayload) ||
      binding.semanticInputIdentity !== mechanismResearchSemanticInputIdentity(revision) ||
      binding.workFamilyRef !== `world-state-mechanism-issue:${assignment.mechanismIssueId}`) {
    throw new Error("mechanism campaign exact input binding cannot be resolved");
  }
  return revision;
}

export function buildWorldStateMechanismCampaignPreview(input: Readonly<{
  assignments: readonly WorldStateMechanismResearchAssignment[];
  revisions: readonly OntologySearchIssueRevision[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): WorldStateMechanismCampaignPreview {
  const route = [...input.execution.workloadRoutes]
    .filter((item) => item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH")
    .sort((left, right) => right.revision - left.revision)[0];
  if (route === undefined) throw new Error("mechanism research workload route is unavailable");
  const profile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === route.executionProfileId
  );
  if (profile === undefined || profile.toolPolicy.protocol !==
      "WORLD_STATE_MECHANISM_RESEARCH_TOOLS_V1") {
    throw new Error("mechanism research execution profile is unavailable");
  }
  const allocation = buildWorldStateMechanismAllocation({
    assignments: input.assignments,
    revisions: input.revisions,
  });
  const assignments = new Map(input.assignments.map((item) => [item.assignmentId, item] as const));
  const selected = allocation.selectedActions.map((item) => {
    const assignment = assignments.get(item.assignmentId);
    if (assignment === undefined) throw new Error("mechanism allocation assignment is unavailable");
    return assignment;
  });
  const selectionBinding = buildWorldStateMechanismCampaignSelectionBinding({
    assignments: selected,
    revisions: input.revisions,
    allocation,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-campaign-preview.v1" as const,
    campaignKey: `world-state-mechanism-${selectionBinding.selectionIdentity.slice(7)}`,
    workloadRoute: route,
    executionProfile: profile,
    capability: input.capability,
    allocation,
    selectionBinding,
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    mechanismIssueIds: Object.freeze(selected.map((item) => item.mechanismIssueId)),
    omittedEligibleIssueCount: Math.max(0, allocation.eligibleCount - selected.length),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 8 as const,
      maximumInputTokens: "200000" as const,
      maximumOutputTokens: "20000" as const,
      maximumWallClockMs: 900_000 as const,
    }),
    creationEligible: selected.length > 0,
    dispatchEligible: selected.length > 0 && input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: selected.length === 0
      ? allocation.eligibleCount === 0
        ? "No mechanism issue has an unexplored exact ontology input revision"
        : "No unexplored input satisfies the structural mechanism suitability policy"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
      ? input.capability.diagnostic
      : `${selected.length} mechanism research tasks await explicit campaign activation`,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
