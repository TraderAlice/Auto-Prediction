import { hashCanonical, type Hash } from "@pmh/domain";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type {
  AgentExecutionSnapshot,
  ExecutionProfile,
  WorkloadRoute,
} from "./agent-execution-substrate.js";
import type { RelationDiscoveryTaskRevision } from "./relation-discovery-work.js";

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

export function buildRelationDiscoveryCampaignPreview(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
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
  const selected = selectRelationDiscoveryCampaignTasks(input);
  const attempted = attemptedWorkIds(input.execution);
  const eligibleCount = new Set(input.revisions.filter((item) =>
    item.campaignEligible && !attempted.has(item.workItemId)
  ).map((item) => item.workItemId)).size;
  const body = Object.freeze({
    schemaVersion: "pmh.relation-discovery-campaign-preview.v1" as const,
    campaignKey: selected.length === 0
      ? "relation-discovery-empty"
      : `relation-discovery-${selected[0]!.workItemId.slice("sha256:".length, 23)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    workItemIds: Object.freeze(selected.map((item) => item.workItemId)),
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    omittedEligibleWorkItemCount: Math.max(0, eligibleCount - selected.length),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 12 as const,
      maximumInputTokens: "300000" as const,
      maximumOutputTokens: "30000" as const,
      maximumWallClockMs: 600_000 as const,
    }),
    creationEligible: selected.length > 0,
    dispatchEligible: selected.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: selected.length === 0
      ? "No unattempted stable relation work is eligible"
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
