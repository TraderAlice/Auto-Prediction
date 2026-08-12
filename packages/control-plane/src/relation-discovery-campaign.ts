import { hashCanonical, type Hash } from "@pmh/domain";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type {
  AgentCampaign,
  AgentCampaignSelectionBinding,
  AgentSelectionBoundCampaign,
  AgentExecutionSnapshot,
  ExecutionProfile,
  WorkloadRoute,
} from "./agent-execution-substrate.js";
import {
  assertAgentCampaignSelectionBinding,
  effectiveAgentCampaigns,
  migrateAgentCampaignToEvolvingMembership,
  reviseAgentCampaignMembership,
} from "./agent-execution-substrate.js";
import type { ResearchAttentionAllocationProjection } from
  "./research-attention-allocation.js";
import type { RelationDiscoveryTaskRevision } from "./relation-discovery-work.js";

export const RELATION_DISCOVERY_SELECTION_PROTOCOL =
  "RELATION_DISCOVERY_SELECTION_V1" as const;
export const RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL =
  "RESEARCH_ATTENTION_RELATION_SELECTION_V1" as const;
export const RELATION_DISCOVERY_INPUT_REVISION_KIND =
  "RELATION_DISCOVERY" as const;

const WORK_PROVENANCE_PREFIX = "relation-work:";

export type RelationDiscoveryCampaignPreview = Readonly<{
  schemaVersion: "pmh.relation-discovery-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  workItemIds: readonly Hash[];
  taskIds: readonly Hash[];
  allocationProjectionIdentity: Hash;
  allocationPolicyIdentity: Hash;
  allocationActionIds: readonly Hash[];
  selectionBinding: AgentCampaignSelectionBinding;
  preparedCampaignIds: readonly Hash[];
  intentCampaignId: Hash | null;
  omittedEligibleWorkItemCount: number;
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 12;
    maximumInputTokens: "300000";
    maximumOutputTokens: "30000";
    maximumWallClockMs: 600000;
  }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResearchAttentionRelationSelection = Readonly<{
  workItemIds: readonly Hash[];
  taskIds: readonly Hash[];
  allocationProjectionIdentity: Hash;
  allocationPolicyIdentity: Hash;
  allocationActionIds: readonly Hash[];
  selectionBinding: AgentCampaignSelectionBinding;
}>;

function latestRoute(snapshot: AgentExecutionSnapshot): WorkloadRoute {
  const route = [...snapshot.workloadRoutes]
    .filter((item) => item.taskKind === "RELATION_DISCOVERY")
    .sort((left, right) =>
      right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
    )[0];
  if (route === undefined) throw new Error("relation discovery workload route is unavailable");
  return route;
}

function attemptedWorkIds(execution: AgentExecutionSnapshot): ReadonlySet<string> {
  const attemptedTaskIds = new Set(execution.runs.map((item) => item.taskId));
  return new Set(execution.tasks.flatMap((task) =>
    attemptedTaskIds.has(task.taskId) && task.provenanceRef.startsWith(WORK_PROVENANCE_PREFIX)
      ? [task.provenanceRef.slice(WORK_PROVENANCE_PREFIX.length)]
      : []
  ));
}

export function selectRelationDiscoveryCampaignTasks(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  execution: AgentExecutionSnapshot;
}>): readonly RelationDiscoveryTaskRevision[] {
  const latestByWork = new Map<Hash, RelationDiscoveryTaskRevision>();
  for (const revision of input.revisions) {
    if (revision.schemaVersion === "pmh.relation-discovery-task-revision.v4") continue;
    const prior = latestByWork.get(revision.workItemId);
    if (prior === undefined || revision.materializedAt > prior.materializedAt ||
        (revision.materializedAt === prior.materializedAt &&
          revision.revisionId > prior.revisionId)) {
      latestByWork.set(revision.workItemId, revision);
    }
  }
  const attempted = attemptedWorkIds(input.execution);
  return Object.freeze([...latestByWork.values()]
    .filter((item) => item.campaignEligible && !attempted.has(item.workItemId))
    .sort((left, right) =>
      right.task.priority - left.task.priority || left.workItemId.localeCompare(right.workItemId)
    )
    .slice(0, 1));
}

export function reconcileResearchAttentionRelationCampaignMembership(input: Readonly<{
  execution: AgentExecutionSnapshot;
  selectionBinding: AgentCampaignSelectionBinding;
}>): readonly AgentCampaign[] {
  const current = effectiveAgentCampaigns(input.execution.campaigns).filter(
    (campaign): campaign is AgentSelectionBoundCampaign =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol ===
      RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL &&
    campaign.selectionBinding.selectionPolicyIdentity ===
      input.selectionBinding.selectionPolicyIdentity,
  );
  if (current.length === 0) return Object.freeze([]);
  if (current.length > 1) {
    throw new Error("research-attention relation policy has multiple active lineages");
  }
  const evolving = current[0]!.schemaVersion === "pmh.agent-campaign.v4"
    ? current[0]!
    : migrateAgentCampaignToEvolvingMembership(current[0]!);
  if (hashCanonical(evolving.selectionBinding) === hashCanonical(input.selectionBinding)) {
    return evolving === current[0] ? Object.freeze([]) : Object.freeze([evolving]);
  }
  const revised = reviseAgentCampaignMembership(evolving, input.selectionBinding);
  return Object.freeze(evolving === current[0] ? [revised] : [evolving, revised]);
}

export function materializeResearchAttentionRelationSelection(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  allocation: ResearchAttentionAllocationProjection;
}>): ResearchAttentionRelationSelection {
  const revisionByTask = new Map(input.revisions.filter((item) =>
    item.schemaVersion !== "pmh.relation-discovery-task-revision.v4"
  ).map((item) => [item.task.taskId, item] as const));
  const actions = Object.freeze(input.allocation.portfolio.filter((action) =>
    action.dispatchableByRelationCampaign && action.taskId !== null
  ).slice(0, 1));
  const selected = Object.freeze(actions.map((action) => {
    const revision = revisionByTask.get(action.taskId!);
    if (revision === undefined || revision.workItemId !== action.workItemId) {
      throw new Error("research attention action has no exact relation task revision");
    }
    return revision;
  }));
  const selectionPolicy = Object.freeze({
    schemaVersion: "pmh.research-attention-relation-selection-policy.v1" as const,
    allocationPolicyIdentity: input.allocation.policy.policyIdentity,
    maximumPortfolioSize: 1 as const,
    dispatchableActionsOnly: true as const,
  });
  const selectionPolicyIdentity = hashCanonical(selectionPolicy);
  const selectionIdentity = hashCanonical({
    schemaVersion: "pmh.research-attention-relation-selection.v1",
    allocationPolicyIdentity: input.allocation.policy.policyIdentity,
    actionIds: actions.map((item) => item.actionId),
    taskRevisionIds: selected.map((item) => item.revisionId),
  });
  const selectionBinding = assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL,
    selectionIdentity,
    selectionPolicyIdentity,
    taskBindings: Object.freeze(selected.map((revision, index) => Object.freeze({
      taskId: revision.task.taskId,
      workFamilyRef: `relation-work:${revision.workItemId}`,
      selectionActionRef: actions[index]!.actionId,
      selectionActionKind: actions[index]!.kind,
      inputRevisionKind: RELATION_DISCOVERY_INPUT_REVISION_KIND,
      inputRevisionId: revision.revisionId,
      exactInputHash: hashCanonical(revision.taskPayload),
      semanticInputIdentity: revision.schemaVersion ===
        "pmh.relation-discovery-task-revision.v1"
        ? revision.sourceCorpusSnapshotIdentity
        : revision.researchInputIdentity,
    })).sort((left, right) => left.taskId.localeCompare(right.taskId))),
  }));
  return Object.freeze({
    workItemIds: Object.freeze(selected.map((item) => item.workItemId)),
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    allocationProjectionIdentity: input.allocation.projectionIdentity,
    allocationPolicyIdentity: input.allocation.policy.policyIdentity,
    allocationActionIds: Object.freeze(actions.map((item) => item.actionId)),
    selectionBinding,
  });
}

export function buildRelationDiscoveryCampaignPreview(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
  allocation: ResearchAttentionAllocationProjection;
}>): RelationDiscoveryCampaignPreview {
  const workloadRoute = latestRoute(input.execution);
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined ||
      executionProfile.toolPolicy.protocol !== "RELATION_DISCOVERY_AGENT_TOOLS_V1") {
    throw new Error("relation discovery execution profile is unavailable or incompatible");
  }
  if (input.capability.executionProfileId !== executionProfile.executionProfileId) {
    throw new Error("relation discovery capability lineage is inconsistent");
  }
  const materialized = materializeResearchAttentionRelationSelection(input);
  const selectionBinding = materialized.selectionBinding;
  const selectionIdentity = selectionBinding.selectionIdentity;
  const effectiveIntent = effectiveAgentCampaigns(input.execution.campaigns).find((campaign) =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol ===
      RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL &&
    campaign.selectionBinding.selectionPolicyIdentity ===
      selectionBinding.selectionPolicyIdentity
  ) ?? null;
  const preparedCampaignIds = Object.freeze(input.execution.campaigns.filter((campaign) =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol ===
      RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL &&
    campaign.selectionBinding.selectionIdentity === selectionIdentity
  ).map((item) => item.campaignId).sort());
  const body = Object.freeze({
    schemaVersion: "pmh.relation-discovery-campaign-preview.v1" as const,
    campaignKey: effectiveIntent?.campaignKey ??
      `research-attention-relation-${selectionBinding.selectionPolicyIdentity.slice("sha256:".length, 23)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    ...materialized,
    preparedCampaignIds,
    intentCampaignId: effectiveIntent?.campaignId ?? null,
    omittedEligibleWorkItemCount: input.allocation.omittedActionableFamilyCount,
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 12 as const,
      maximumInputTokens: "300000" as const,
      maximumOutputTokens: "30000" as const,
      maximumWallClockMs: 600_000 as const,
    }),
    creationEligible: materialized.taskIds.length > 0 && effectiveIntent === null &&
      preparedCampaignIds.length === 0,
    dispatchEligible: materialized.taskIds.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: materialized.taskIds.length === 0
      ? "The research-attention portfolio has no dispatchable relation action"
      : effectiveIntent !== null
        ? "The current research-attention relation intent already exists"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
        ? input.capability.diagnostic
        : "One unattempted relation-neighborhood task is ready for explicit activation",
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    automaticDispatch: false as const,
    authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
