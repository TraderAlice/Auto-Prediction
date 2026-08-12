import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  AgentCampaign,
  AgentCampaignSelectionBinding,
  AgentExecutionSnapshot,
  AgentRun,
  ExecutionProfile,
  WorkloadRoute,
} from "./agent-execution-substrate.js";
import { assertAgentCampaignSelectionBinding } from "./agent-execution-substrate.js";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type {
  OntologySearchIssueRevision,
} from "./ontology-search-ecology.js";
import {
  buildOntologyAttentionAllocation,
  ontologyIssueResearchInputIdentity,
  type OntologyAttentionAllocationProjection,
} from "./ontology-attention-allocation.js";
import type { MarketOntologyAgentProposal } from "./market-ontology-agent-tools.js";
import type { OntologyRelationWorkProjection } from "./ontology-relation-work.js";
export type OntologyAgentCampaignPreview = Readonly<{
  schemaVersion: "pmh.ontology-agent-campaign-preview.v2";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  allocation: OntologyAttentionAllocationProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskIds: readonly Hash[];
  issueIds: readonly Hash[];
  selectedLaneCounts: Readonly<{
    crossVenue: number;
    worldDivergence: number;
    settlementDivergence: number;
  }>;
  omittedEligibleIssueCount: number;
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 12;
    maximumInputTokens: "300000";
    maximumOutputTokens: "30000";
    maximumWallClockMs: 900000;
  }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const ONTOLOGY_ATTENTION_SELECTION_PROTOCOL =
  "ONTOLOGY_ATTENTION_ALLOCATION_V1" as const;
const ONTOLOGY_INPUT_REVISION_KIND = "ONTOLOGY_SEARCH_ISSUE" as const;

export function buildOntologyCampaignSelectionBinding(input: Readonly<{
  allocation: OntologyAttentionAllocationProjection;
  revisions: readonly OntologySearchIssueRevision[];
}>): AgentCampaignSelectionBinding {
  const byRevision = new Map(input.revisions.map((revision) =>
    [revision.revisionId, revision] as const
  ));
  return assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: ONTOLOGY_ATTENTION_SELECTION_PROTOCOL,
    selectionIdentity: input.allocation.projectionIdentity,
    selectionPolicyIdentity: input.allocation.policy.policyIdentity,
    taskBindings: Object.freeze(input.allocation.portfolio.map((action) => {
      const revision = byRevision.get(action.revisionId);
      if (revision === undefined || revision.issueId !== action.issueId ||
          revision.task.taskId !== action.taskId) {
        throw new Error("ontology allocation action has no exact selected revision");
      }
      return Object.freeze({
        taskId: action.taskId,
        workFamilyRef: `ontology-issue:${action.issueId}`,
        selectionActionRef: action.actionId,
        selectionActionKind: action.kind,
        inputRevisionKind: ONTOLOGY_INPUT_REVISION_KIND,
        inputRevisionId: action.revisionId,
        exactInputHash: hashCanonical(revision.taskPayload),
        semanticInputIdentity: ontologyIssueResearchInputIdentity(revision),
      });
    }).sort((left, right) => left.taskId.localeCompare(right.taskId))),
  }));
}

export function resolveOntologyAgentTaskRevision(input: Readonly<{
  taskId: Hash;
  run: AgentRun;
  campaigns: readonly AgentCampaign[];
  currentRevisions: readonly OntologySearchIssueRevision[];
  loadRevision?: (revisionId: Hash) => OntologySearchIssueRevision | null;
}>): OntologySearchIssueRevision {
  const latest = [...input.currentRevisions]
    .filter((revision) => revision.task.taskId === input.taskId)
    .sort((left, right) =>
      right.materializedAt.localeCompare(left.materializedAt) ||
      right.revisionId.localeCompare(left.revisionId)
    )[0] ?? null;
  if (input.run.authorization.kind !== "CAMPAIGN") {
    if (latest === null) throw new Error("retained ontology task input is unavailable");
    return latest;
  }
  const campaign = input.campaigns.find((item) =>
    item.campaignId === input.run.authorization.campaignId
  );
  if (campaign === undefined) throw new Error("ontology run campaign is unavailable");
  if (campaign.schemaVersion !== "pmh.agent-campaign.v2" ||
      campaign.selectionBinding.selectionProtocol !== ONTOLOGY_ATTENTION_SELECTION_PROTOCOL) {
    throw new Error("ontology campaign has no immutable attention allocation binding");
  }
  const binding = campaign.selectionBinding.taskBindings.find((item) =>
    item.taskId === input.taskId
  );
  if (binding === undefined || binding.inputRevisionKind !== ONTOLOGY_INPUT_REVISION_KIND) {
    throw new Error("ontology campaign has no exact task input binding");
  }
  const revision = input.loadRevision?.(binding.inputRevisionId) ??
    input.currentRevisions.find((item) => item.revisionId === binding.inputRevisionId) ?? null;
  if (revision === null || revision.task.taskId !== input.taskId ||
      binding.workFamilyRef !== `ontology-issue:${revision.issueId}` ||
      binding.exactInputHash !== hashCanonical(revision.taskPayload) ||
      binding.semanticInputIdentity !== ontologyIssueResearchInputIdentity(revision)) {
    throw new Error("ontology campaign exact task input binding cannot be resolved");
  }
  return revision;
}

function latestOntologyRoute(snapshot: AgentExecutionSnapshot): WorkloadRoute {
  const route = [...snapshot.workloadRoutes]
    .filter((item) => item.taskKind === "ONTOLOGY_NORMALIZATION")
    .sort((left, right) =>
      right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
    )[0];
  if (route === undefined) throw new Error("ontology workload route is unavailable");
  return route;
}

export function selectOntologyCampaignIssues(input: Readonly<{
  revisions: readonly OntologySearchIssueRevision[];
  retainedRevisions?: readonly OntologySearchIssueRevision[];
  proposals?: readonly MarketOntologyAgentProposal[];
  relationWork?: OntologyRelationWorkProjection;
  execution: AgentExecutionSnapshot;
}>): readonly OntologySearchIssueRevision[] {
  const allocation = buildOntologyAttentionAllocation({
    currentRevisions: input.revisions,
    retainedRevisions: input.retainedRevisions ?? input.revisions,
    proposals: input.proposals ?? [],
    execution: input.execution,
    ...(input.relationWork === undefined ? {} : { relationWork: input.relationWork }),
  });
  return revisionsForAllocation(input.revisions, allocation);
}

function revisionsForAllocation(
  revisions: readonly OntologySearchIssueRevision[],
  allocation: OntologyAttentionAllocationProjection,
): readonly OntologySearchIssueRevision[] {
  const byIssue = new Map(revisions.map((revision) =>
    [revision.issueId, revision] as const
  ));
  return Object.freeze(allocation.portfolio.flatMap((action) => {
    const revision = byIssue.get(action.issueId);
    return revision === undefined ? [] : [revision];
  }));
}

export function buildOntologyAgentCampaignPreview(input: Readonly<{
  revisions: readonly OntologySearchIssueRevision[];
  retainedRevisions?: readonly OntologySearchIssueRevision[];
  proposals?: readonly MarketOntologyAgentProposal[];
  relationWork?: OntologyRelationWorkProjection;
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): OntologyAgentCampaignPreview {
  const workloadRoute = latestOntologyRoute(input.execution);
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined) {
    throw new Error("ontology workload execution profile is unavailable");
  }
  if (executionProfile.toolPolicy.protocol !== "MARKET_ONTOLOGY_AGENT_TOOLS_V1") {
    throw new Error("ontology workload route has the wrong tool protocol");
  }
  if (input.capability.executionProfileId !== executionProfile.executionProfileId) {
    throw new Error("ontology campaign capability lineage is inconsistent");
  }
  const allocation = buildOntologyAttentionAllocation({
    currentRevisions: input.revisions,
    retainedRevisions: input.retainedRevisions ?? input.revisions,
    proposals: input.proposals ?? [],
    execution: input.execution,
    ...(input.relationWork === undefined ? {} : { relationWork: input.relationWork }),
  });
  const selected = revisionsForAllocation(input.revisions, allocation);
  const selectionBinding = buildOntologyCampaignSelectionBinding({
    allocation,
    revisions: selected,
  });
  const eligibleCount = allocation.actionableIssueCount;
  const sourceOntologyIdentity = selected[0]?.ontologyIdentity ??
    input.revisions[0]?.ontologyIdentity ?? null;
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-agent-campaign-preview.v2" as const,
    campaignKey: sourceOntologyIdentity === null
      ? "ontology-search-empty"
      : `ontology-search-${allocation.projectionIdentity.slice("sha256:".length)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    allocation,
    selectionBinding,
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    issueIds: Object.freeze(selected.map((item) => item.issueId)),
    selectedLaneCounts: Object.freeze({
      crossVenue: selected.filter((item) => item.selectionLane === "CROSS_VENUE").length,
      worldDivergence: selected.filter((item) =>
        item.selectionLane === "WORLD_DIVERGENCE"
      ).length,
      settlementDivergence: selected.filter((item) =>
        item.selectionLane === "SETTLEMENT_DIVERGENCE"
      ).length,
    }),
    omittedEligibleIssueCount: Math.max(0, eligibleCount - selected.length),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 12 as const,
      maximumInputTokens: "300000" as const,
      maximumOutputTokens: "30000" as const,
      maximumWallClockMs: 900_000 as const,
    }),
    creationEligible: selected.length > 0,
    dispatchEligible: selected.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: selected.length === 0
      ? "No unattempted ontology search issue is eligible"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
        ? input.capability.diagnostic
        : `${selected.length} attention-allocated ontology tasks are ready for explicit campaign activation`,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
