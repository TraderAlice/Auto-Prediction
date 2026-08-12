import { hashCanonical, type Hash } from "@pmh/domain";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import {
  buildPausedAgentCampaign,
  effectiveAgentCampaigns,
  assertAgentCampaignSelectionBinding,
  migrateAgentCampaignToEvolvingMembership,
  reviseAgentCampaignMembership,
  type AgentCampaign,
  type AgentCampaignSelectionBinding,
  type AgentSelectionBoundCampaign,
  type AgentExecutionSnapshot,
  type AgentRun,
  type ExecutionProfile,
  type WorkloadRoute,
} from "./agent-execution-substrate.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  materializeStandingRouteSeedTaskRevisions,
  type RelationDiscoveryTaskRevision,
} from "./relation-discovery-work.js";
import type { StandingOntologyRouteProjection } from "./standing-ontology-routes.js";
import {
  buildStandingRouteSeedSelection,
  STANDING_ROUTE_SEED_INPUT_REVISION_KIND,
  STANDING_ROUTE_SEED_SELECTION_PROTOCOL,
  type StandingRouteSeedSelectionProjection,
} from "./standing-route-seeding.js";
import {
  RELATION_DISCOVERY_INPUT_REVISION_KIND,
  RELATION_DISCOVERY_SELECTION_PROTOCOL,
  RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL,
} from "./relation-discovery-campaign.js";

export function migrateStandingRouteSeedCampaignPolicies(input: Readonly<{
  campaigns: readonly AgentCampaign[];
  observedAt: string;
}>): readonly AgentCampaign[] {
  if (new Date(input.observedAt).toISOString() !== input.observedAt) {
    throw new Error("standing route seed campaign migration time must be canonical ISO");
  }
  return Object.freeze(effectiveAgentCampaigns(input.campaigns).flatMap((campaign) => {
    if ((campaign.schemaVersion !== "pmh.agent-campaign.v2" &&
        campaign.schemaVersion !== "pmh.agent-campaign.v3" &&
        campaign.schemaVersion !== "pmh.agent-campaign.v4") ||
        campaign.selectionBinding.selectionProtocol !==
          STANDING_ROUTE_SEED_SELECTION_PROTOCOL ||
        campaign.schemaVersion === "pmh.agent-campaign.v4") return [];
    return [migrateAgentCampaignToEvolvingMembership(campaign)];
  }));
}

export function reconcileStandingRouteSeedCampaignMembership(input: Readonly<{
  execution: AgentExecutionSnapshot;
  selectionBinding: AgentCampaignSelectionBinding;
}>): readonly AgentCampaign[] {
  const matching = effectiveAgentCampaigns(input.execution.campaigns).filter(
    (campaign): campaign is AgentSelectionBoundCampaign =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol === STANDING_ROUTE_SEED_SELECTION_PROTOCOL &&
    campaign.selectionBinding.selectionPolicyIdentity ===
      input.selectionBinding.selectionPolicyIdentity,
  );
  if (matching.length === 0) return Object.freeze([]);
  if (matching.length > 1) {
    throw new Error("standing route seed membership policy has multiple active lineages");
  }
  const current = matching[0]!;
  const evolving = current.schemaVersion === "pmh.agent-campaign.v4"
    ? current
    : migrateAgentCampaignToEvolvingMembership(current);
  const lineageCampaignIds = new Set(input.execution.campaigns.filter((campaign) =>
    campaign.campaignKey === current.campaignKey
  ).map((campaign) => campaign.campaignId));
  const attemptedTaskIds = new Set(input.execution.runs.filter((run) =>
    run.authorization.campaignId !== null &&
    lineageCampaignIds.has(run.authorization.campaignId)
  ).map((run) => run.taskId));
  const nextByWorkFamily = new Map(input.selectionBinding.taskBindings.map((binding) =>
    [binding.workFamilyRef, binding] as const
  ));
  const retained = evolving.selectionBinding.taskBindings.filter((binding) =>
    !attemptedTaskIds.has(binding.taskId) && !nextByWorkFamily.has(binding.workFamilyRef)
  );
  const taskBindings = Object.freeze([...retained, ...nextByWorkFamily.values()]
    .sort((left, right) => left.taskId.localeCompare(right.taskId)));
  const selectionIdentity = hashCanonical({
    schemaVersion: "pmh.agent-campaign-membership-selection.v1",
    selectionProtocol: input.selectionBinding.selectionProtocol,
    selectionPolicyIdentity: input.selectionBinding.selectionPolicyIdentity,
    taskBindings,
  });
  const merged = assertAgentCampaignSelectionBinding(Object.freeze({
    ...input.selectionBinding,
    selectionIdentity,
    taskBindings,
  }));
  const unchanged = hashCanonical(merged) === hashCanonical(evolving.selectionBinding);
  if (unchanged) return current === evolving ? Object.freeze([]) : Object.freeze([evolving]);
  return Object.freeze(current === evolving
    ? [reviseAgentCampaignMembership(evolving, merged)]
    : [evolving, reviseAgentCampaignMembership(evolving, merged)]);
}

export type StandingRouteSeedCampaignPreview = Readonly<{
  schemaVersion: "pmh.standing-route-seed-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  selection: StandingRouteSeedSelectionProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  taskIds: readonly Hash[];
  preparedCampaignIds: readonly Hash[];
  intentCampaignId: Hash | null;
  membershipRevisionEligible: boolean;
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 24;
    maximumInputTokens: "600000";
    maximumOutputTokens: "60000";
    maximumWallClockMs: 900000;
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

export type StandingRouteSeedCampaignMaterialization = Readonly<{
  campaignKey: string;
  selection: StandingRouteSeedSelectionProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  taskIds: readonly Hash[];
  preparedCampaignIds: readonly Hash[];
  intentCampaignId: Hash | null;
}>;

function latestRelationRoute(snapshot: AgentExecutionSnapshot): WorkloadRoute {
  const route = [...snapshot.workloadRoutes]
    .filter((item) => item.taskKind === "RELATION_DISCOVERY")
    .sort((left, right) =>
      right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
    )[0];
  if (route === undefined) throw new Error("relation discovery workload route is unavailable");
  return route;
}

export function materializeStandingRouteSeedCampaignMembership(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  corpus: MarketCorpusSnapshot;
  standingRoutes: StandingOntologyRouteProjection | null;
  execution: AgentExecutionSnapshot;
}>): StandingRouteSeedCampaignMaterialization {
  const selection = buildStandingRouteSeedSelection(input);
  const candidates = materializeStandingRouteSeedTaskRevisions({
    selectionIdentity: selection.selectionIdentity,
    candidates: selection.selected,
    sourceRevisions: input.revisions,
    corpus: input.corpus,
  });
  const retainedByTask = new Map(input.revisions.filter((revision) =>
    revision.schemaVersion === "pmh.relation-discovery-task-revision.v4"
  ).sort((left, right) =>
    left.materializedAt.localeCompare(right.materializedAt) ||
    left.revisionId.localeCompare(right.revisionId)
  ).map((revision) => [revision.task.taskId, revision] as const));
  const taskRevisions = Object.freeze(candidates.map((candidate) =>
    retainedByTask.get(candidate.task.taskId) ?? candidate
  ));
  const byAction = new Map(selection.selected.map((candidate) =>
    [candidate.selectionActionRef, candidate] as const
  ));
  const selectionBinding = assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: STANDING_ROUTE_SEED_SELECTION_PROTOCOL,
    selectionIdentity: selection.selectionIdentity,
    selectionPolicyIdentity: selection.policyIdentity,
    taskBindings: Object.freeze(taskRevisions.map((revision) => {
      if (revision.schemaVersion !== "pmh.relation-discovery-task-revision.v4" ||
          revision.taskPayload.schemaVersion !== "pmh.relation-discovery-task.v4") {
        throw new Error("standing route seed task materialized with the wrong protocol");
      }
      const candidate = byAction.get(
        revision.taskPayload.researchIntent.selectionActionRef,
      );
      if (candidate === undefined || candidate.workItemId !== revision.workItemId ||
          candidate.targetRouteLayer !==
            revision.taskPayload.researchIntent.targetRouteLayer) {
        throw new Error("standing route seed selection has no exact task revision");
      }
      return Object.freeze({
        taskId: revision.task.taskId,
        workFamilyRef: `standing-route-layer:${candidate.targetRouteLayer}`,
        selectionActionRef: candidate.selectionActionRef,
        selectionActionKind: candidate.targetRouteLayer,
        inputRevisionKind: STANDING_ROUTE_SEED_INPUT_REVISION_KIND,
        inputRevisionId: revision.revisionId,
        exactInputHash: hashCanonical(revision.taskPayload),
        semanticInputIdentity: revision.researchInputIdentity,
      });
    }).sort((left, right) => left.taskId.localeCompare(right.taskId))),
  }));
  const preparedCampaignIds = Object.freeze(input.execution.campaigns.filter((campaign) =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol ===
      STANDING_ROUTE_SEED_SELECTION_PROTOCOL &&
    campaign.selectionBinding.selectionIdentity === selection.selectionIdentity
  ).map((campaign) => campaign.campaignId).sort());
  const intentCampaign = effectiveAgentCampaigns(input.execution.campaigns).find((campaign) =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol === STANDING_ROUTE_SEED_SELECTION_PROTOCOL &&
    campaign.selectionBinding.selectionPolicyIdentity === selection.policyIdentity
  ) ?? null;
  return Object.freeze({
    campaignKey: intentCampaign?.campaignKey ??
      `standing-route-seed-${selection.policyIdentity.slice("sha256:".length)}`,
    selection,
    selectionBinding,
    taskRevisions,
    taskIds: Object.freeze(taskRevisions.map((item) => item.task.taskId)),
    preparedCampaignIds,
    intentCampaignId: intentCampaign?.campaignId ?? null,
  });
}

export function buildStandingRouteSeedCampaignPreview(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  corpus: MarketCorpusSnapshot;
  standingRoutes: StandingOntologyRouteProjection | null;
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): StandingRouteSeedCampaignPreview {
  const workloadRoute = latestRelationRoute(input.execution);
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined ||
      executionProfile.toolPolicy.protocol !== "RELATION_DISCOVERY_AGENT_TOOLS_V1") {
    throw new Error("standing route seed execution profile is unavailable or incompatible");
  }
  if (input.capability.executionProfileId !== executionProfile.executionProfileId) {
    throw new Error("standing route seed capability lineage is inconsistent");
  }
  const materialized = materializeStandingRouteSeedCampaignMembership(input);
  const { selection, selectionBinding, taskRevisions, taskIds, preparedCampaignIds } =
    materialized;
  const intentCampaignId = materialized.intentCampaignId;
  const membershipRevisions = intentCampaignId === null
    ? Object.freeze([])
    : reconcileStandingRouteSeedCampaignMembership({
        execution: input.execution,
        selectionBinding,
      });
  const membershipRevisionEligible = membershipRevisions.length > 0;
  const body = Object.freeze({
    schemaVersion: "pmh.standing-route-seed-campaign-preview.v1" as const,
    campaignKey: materialized.campaignKey,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    selection,
    selectionBinding,
    taskRevisions,
    taskIds,
    preparedCampaignIds,
    intentCampaignId,
    membershipRevisionEligible,
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 24 as const,
      maximumInputTokens: "600000" as const,
      maximumOutputTokens: "60000" as const,
      maximumWallClockMs: 900_000 as const,
    }),
    creationEligible: taskRevisions.length > 0 && preparedCampaignIds.length === 0 &&
      intentCampaignId === null,
    dispatchEligible: taskRevisions.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: taskRevisions.length === 0
      ? "No differentiated unattempted standing-route seed is eligible"
      : membershipRevisionEligible
        ? "New exact members are available inside the retained standing-route intent"
      : intentCampaignId !== null
        ? "The current standing-route intent already retains this exact membership"
      : preparedCampaignIds.length > 0
        ? "The current standing-route seed selection is already retained as a paused campaign"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
        ? input.capability.diagnostic
        : `${taskRevisions.length} layer-specific standing-route seeds are ready for explicit activation`,
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

export function resolveRelationDiscoveryTaskRevision(input: Readonly<{
  taskId: Hash;
  run: AgentRun;
  campaigns: readonly AgentCampaign[];
  currentRevisions: readonly RelationDiscoveryTaskRevision[];
  loadRevision?: (revisionId: Hash) => RelationDiscoveryTaskRevision | null;
}>): RelationDiscoveryTaskRevision {
  const latest = [...input.currentRevisions]
    .filter((revision) => revision.task.taskId === input.taskId)
    .sort((left, right) =>
      right.materializedAt.localeCompare(left.materializedAt) ||
      right.revisionId.localeCompare(left.revisionId)
    )[0] ?? null;
  if (input.run.authorization.kind !== "CAMPAIGN") {
    if (latest === null) throw new Error("retained relation task input is unavailable");
    return latest;
  }
  const campaign = input.campaigns.find((item) =>
    item.campaignId === input.run.authorization.campaignId
  );
  if (campaign === undefined) throw new Error("relation run campaign is unavailable");
  if (campaign.schemaVersion !== "pmh.agent-campaign.v2" &&
      campaign.schemaVersion !== "pmh.agent-campaign.v3" &&
      campaign.schemaVersion !== "pmh.agent-campaign.v4") {
    if (latest === null) throw new Error("retained relation task input is unavailable");
    return latest;
  }
  const routeSeed = campaign.selectionBinding.selectionProtocol ===
    STANDING_ROUTE_SEED_SELECTION_PROTOCOL;
  const ordinary = campaign.selectionBinding.selectionProtocol ===
    RELATION_DISCOVERY_SELECTION_PROTOCOL ||
    campaign.selectionBinding.selectionProtocol ===
      RESEARCH_ATTENTION_RELATION_SELECTION_PROTOCOL;
  if (!routeSeed && !ordinary) {
    if (latest === null) throw new Error("retained relation task input is unavailable");
    return latest;
  }
  const binding = campaign.selectionBinding.taskBindings.find((item) =>
    item.taskId === input.taskId
  );
  const expectedKind = routeSeed
    ? STANDING_ROUTE_SEED_INPUT_REVISION_KIND
    : RELATION_DISCOVERY_INPUT_REVISION_KIND;
  if (binding === undefined || binding.inputRevisionKind !== expectedKind) {
    throw new Error("relation campaign has no exact task input binding");
  }
  const revision = input.loadRevision?.(binding.inputRevisionId) ??
    input.currentRevisions.find((item) => item.revisionId === binding.inputRevisionId) ?? null;
  const semanticInputIdentity = revision?.schemaVersion ===
    "pmh.relation-discovery-task-revision.v1"
    ? revision.sourceCorpusSnapshotIdentity
    : revision?.researchInputIdentity;
  if (revision === null || revision.task.taskId !== input.taskId ||
      binding.exactInputHash !== hashCanonical(revision.taskPayload) ||
      binding.semanticInputIdentity !== semanticInputIdentity) {
    throw new Error("relation campaign exact task input binding cannot be resolved");
  }
  if (routeSeed) {
    if (revision.schemaVersion !== "pmh.relation-discovery-task-revision.v4" ||
        revision.taskPayload.schemaVersion !== "pmh.relation-discovery-task.v4" ||
        binding.workFamilyRef !==
          `standing-route-layer:${revision.taskPayload.researchIntent.targetRouteLayer}` ||
        binding.selectionActionRef !==
          revision.taskPayload.researchIntent.selectionActionRef) {
      throw new Error("standing route seed exact task input binding cannot be resolved");
    }
  } else if (revision.schemaVersion === "pmh.relation-discovery-task-revision.v4" ||
      binding.workFamilyRef !== `relation-work:${revision.workItemId}`) {
    throw new Error("ordinary relation exact task input binding cannot be resolved");
  }
  return revision;
}
