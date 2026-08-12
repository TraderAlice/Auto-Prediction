import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  AgentExecutionSnapshot,
  ExecutionProfile,
  WorkloadRoute,
} from "./agent-execution-substrate.js";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type {
  OntologySearchIssueRevision,
} from "./ontology-search-ecology.js";
import {
  buildOntologyAttentionAllocation,
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
