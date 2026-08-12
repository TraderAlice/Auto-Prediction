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

const MAX_CAMPAIGN_TASKS = 3;
const ONTOLOGY_ISSUE_PROVENANCE_PREFIX = "ontology-issue:";

export type OntologyAgentCampaignPreview = Readonly<{
  schemaVersion: "pmh.ontology-agent-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
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

function attemptedOntologyIssueIds(execution: AgentExecutionSnapshot): ReadonlySet<string> {
  const attemptedTaskIds = new Set(execution.runs.map((item) => item.taskId));
  return new Set(execution.tasks.flatMap((task) =>
    attemptedTaskIds.has(task.taskId) &&
      task.provenanceRef.startsWith(ONTOLOGY_ISSUE_PROVENANCE_PREFIX)
      ? [task.provenanceRef.slice(ONTOLOGY_ISSUE_PROVENANCE_PREFIX.length)]
      : []
  ));
}

export function selectOntologyCampaignIssues(input: Readonly<{
  revisions: readonly OntologySearchIssueRevision[];
  execution: AgentExecutionSnapshot;
}>): readonly OntologySearchIssueRevision[] {
  const attemptedIssueIds = attemptedOntologyIssueIds(input.execution);
  const eligible = [...input.revisions]
    .filter((item) => item.campaignEligible && !attemptedIssueIds.has(item.issueId))
    .sort((left, right) =>
      right.priority - left.priority ||
      left.relationPatternId.localeCompare(right.relationPatternId) ||
      left.issueId.localeCompare(right.issueId)
    );
  const selected: OntologySearchIssueRevision[] = [];
  for (const lane of [
    "WORLD_DIVERGENCE",
    "SETTLEMENT_DIVERGENCE",
    "CROSS_VENUE",
  ] as const) {
    const issue = eligible.find((item) => item.selectionLane === lane);
    if (issue !== undefined) selected.push(issue);
  }
  for (const issue of eligible) {
    if (selected.length >= MAX_CAMPAIGN_TASKS) break;
    if (!selected.some((item) => item.issueId === issue.issueId)) selected.push(issue);
  }
  return Object.freeze(selected.slice(0, MAX_CAMPAIGN_TASKS));
}

export function buildOntologyAgentCampaignPreview(input: Readonly<{
  revisions: readonly OntologySearchIssueRevision[];
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
  const selected = selectOntologyCampaignIssues(input);
  const attemptedIssueIds = attemptedOntologyIssueIds(input.execution);
  const eligibleCount = input.revisions.filter((item) =>
    item.campaignEligible && !attemptedIssueIds.has(item.issueId)
  ).length;
  const sourceOntologyIdentity = selected[0]?.ontologyIdentity ??
    input.revisions[0]?.ontologyIdentity ?? null;
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-agent-campaign-preview.v1" as const,
    campaignKey: sourceOntologyIdentity === null
      ? "ontology-search-empty"
      : `ontology-search-${sourceOntologyIdentity.slice("sha256:".length, 23)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
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
        : "Three lane-diverse ontology tasks are ready for explicit campaign activation",
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
