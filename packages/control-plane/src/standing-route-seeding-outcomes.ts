import { hashCanonical, type Hash } from "@pmh/domain";
import { agentInputRevisionAnnotationMatches } from "./agent-input-revision-binding.js";
import type {
  AgentCampaign,
  AgentExecutionSnapshot,
  AgentRun,
  AgentSelectionBoundCampaign,
} from "./agent-execution-substrate.js";
import type {
  RelationDiscoveryFinding,
  RelationDiscoveryRouteLayer,
} from "./relation-discovery-agent-tools.js";
import type { RelationDiscoveryTaskRevision } from "./relation-discovery-work.js";
import type { StandingOntologyRouteProjection } from "./standing-ontology-routes.js";
import {
  STANDING_ROUTE_SEED_INPUT_REVISION_KIND,
  STANDING_ROUTE_SEED_SELECTION_PROTOCOL,
} from "./standing-route-seeding.js";

const TERMINAL_RUN_STATES = new Set<AgentRun["status"]>([
  "INTERRUPTED", "SUCCEEDED", "FAILED", "CANCELLED",
]);

export type StandingRouteSeedOutcomeStage =
  | "UNACTED"
  | "RUN_IN_FLIGHT"
  | "SPENT_WITHOUT_TERMINAL_EFFECT"
  | "COUNTEREXAMPLE_RETAINED"
  | "CONFLICTING_TERMINAL_EFFECTS"
  | "ROUTE_RETAINED";

export type StandingRouteSeedRunCost = Readonly<{
  runCount: number;
  terminalRunCount: number;
  modelInvocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownWallClockMs: string;
  incompleteUsageInvocationCount: number;
  incompleteWallClockRunCount: number;
}>;

export type StandingRouteSeedActionOutcome = Readonly<{
  schemaVersion: "pmh.standing-route-seed-action-outcome.v1";
  outcomeId: Hash;
  selectionIdentity: Hash;
  selectionActionRef: Hash;
  targetRouteLayer: RelationDiscoveryRouteLayer;
  taskId: Hash;
  inputRevisionId: Hash;
  directRunIds: readonly Hash[];
  routeFindingIds: readonly Hash[];
  counterexampleFindingIds: readonly Hash[];
  retainedRouteFamilyIds: readonly Hash[];
  stage: StandingRouteSeedOutcomeStage;
  acted: boolean;
  terminal: boolean;
  usefulNegativeMemory: boolean;
  directCost: StandingRouteSeedRunCost;
  authority: "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY";
  causalClaim: false;
  policyMutationAuthority: false;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingRouteSeedOutcomeProjection = Readonly<{
  schemaVersion: "pmh.standing-route-seed-outcome-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  campaignCount: number;
  selectedActionCount: number;
  actedActionCount: number;
  terminalActionCount: number;
  routeRetainedActionCount: number;
  usefulNegativeMemoryActionCount: number;
  conflictingTerminalEffectActionCount: number;
  outcomes: readonly StandingRouteSeedActionOutcome[];
  strata: readonly Readonly<{
    targetRouteLayer: RelationDiscoveryRouteLayer;
    selectedActionCount: number;
    actedActionCount: number;
    terminalActionCount: number;
    routeRetainedActionCount: number;
    usefulNegativeMemoryActionCount: number;
    conflictingTerminalEffectActionCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    terminalEvidenceMinimum: 3;
    yieldCostEstimateQualified: boolean;
  }>[];
  recurrenceQualification: Readonly<{
    representedLayerCount: number;
    qualifiedLayerCount: number;
    minimumTerminalActionsPerLayer: 3;
    yieldCostEvidenceSufficient: boolean;
    operatorActivationStillRequired: true;
  }>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function uniqueHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

function costForRuns(
  execution: AgentExecutionSnapshot,
  runIdsInput: readonly Hash[],
): StandingRouteSeedRunCost {
  const runIds = new Set(runIdsInput);
  const runs = execution.runs.filter((run) => runIds.has(run.runId));
  const invocations = execution.modelInvocations.filter((item) => runIds.has(item.runId));
  return Object.freeze({
    runCount: runs.length,
    terminalRunCount: runs.filter((run) => TERMINAL_RUN_STATES.has(run.status)).length,
    modelInvocationCount: invocations.length,
    knownInputTokens: invocations.reduce((sum, item) =>
      sum + BigInt(item.inputTokens ?? "0"), 0n).toString(),
    knownOutputTokens: invocations.reduce((sum, item) =>
      sum + BigInt(item.outputTokens ?? "0"), 0n).toString(),
    knownReasoningTokens: invocations.reduce((sum, item) =>
      sum + BigInt(item.reasoningTokens ?? "0"), 0n).toString(),
    knownWallClockMs: runs.reduce((sum, run) => run.completedAt === null
      ? sum
      : sum + BigInt(Math.max(0, Date.parse(run.completedAt) - Date.parse(run.createdAt))),
    0n).toString(),
    incompleteUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
    ).length,
    incompleteWallClockRunCount: runs.filter((run) => run.completedAt === null).length,
  });
}

export function buildStandingRouteSeedOutcomeProjection(input: Readonly<{
  execution: AgentExecutionSnapshot;
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  findings: readonly RelationDiscoveryFinding[];
  standingRoutes: StandingOntologyRouteProjection | null;
  observedAt: string;
}>): StandingRouteSeedOutcomeProjection {
  if (new Date(input.observedAt).toISOString() !== input.observedAt) {
    throw new Error("standing route seed outcome observedAt must be canonical ISO time");
  }
  const revisions = new Map(input.taskRevisions.map((item) =>
    [item.revisionId, item] as const
  ));
  const campaigns = input.execution.campaigns.filter((campaign): campaign is
    AgentSelectionBoundCampaign =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3") &&
    campaign.selectionBinding.selectionProtocol === STANDING_ROUTE_SEED_SELECTION_PROTOCOL);
  const actions = new Map<Hash, Readonly<{
    campaignIds: readonly Hash[];
    selectionIdentity: Hash;
    binding: AgentSelectionBoundCampaign["selectionBinding"]["taskBindings"][number];
  }>>();
  for (const campaign of campaigns) {
    for (const binding of campaign.selectionBinding.taskBindings) {
      const prior = actions.get(binding.selectionActionRef);
      actions.set(binding.selectionActionRef, Object.freeze({
        campaignIds: uniqueHashes([...(prior?.campaignIds ?? []), campaign.campaignId]),
        selectionIdentity: campaign.selectionBinding.selectionIdentity,
        binding,
      }));
    }
  }
  const outcomes = Object.freeze([...actions.values()].map((action) => {
    const revision = revisions.get(action.binding.inputRevisionId);
    if (revision === undefined || revision.schemaVersion !==
        "pmh.relation-discovery-task-revision.v4" ||
        revision.taskPayload.schemaVersion !== "pmh.relation-discovery-task.v4" ||
        action.binding.inputRevisionKind !== STANDING_ROUTE_SEED_INPUT_REVISION_KIND ||
        action.binding.taskId !== revision.task.taskId ||
        action.binding.selectionActionRef !==
          revision.taskPayload.researchIntent.selectionActionRef) {
      throw new Error("standing route seed outcome cannot resolve exact selected input");
    }
    const routeSeedPayload = revision.taskPayload;
    if (routeSeedPayload.schemaVersion !== "pmh.relation-discovery-task.v4") {
      throw new Error("standing route seed outcome lost its route-seed intent");
    }
    const campaignIds = new Set(action.campaignIds);
    const runs = input.execution.runs.filter((run) =>
      run.taskId === revision.task.taskId && run.authorization.campaignId !== null &&
      campaignIds.has(run.authorization.campaignId) &&
      input.execution.runAnnotations.some((annotation) =>
        annotation.runId === run.runId && agentInputRevisionAnnotationMatches({
          annotation,
          taskId: revision.task.taskId,
          revisionKind: "RELATION_DISCOVERY",
          revisionId: revision.revisionId,
          exactInputHash: hashCanonical(revision.taskPayload),
        })
      )
    );
    const runIds = uniqueHashes(runs.map((run) => run.runId));
    const runIdSet = new Set(runIds);
    const findings = input.findings.filter((finding) =>
      runIdSet.has(finding.sourceAgentRunId) && finding.sourceTaskId === revision.task.taskId
    );
    const routeFindingIds = uniqueHashes(findings.filter((finding) =>
      finding.kind === "ONTOLOGY_ROUTE" && finding.routeLayer ===
        routeSeedPayload.researchIntent.targetRouteLayer
    ).map((finding) => finding.findingId));
    const counterexampleFindingIds = uniqueHashes(findings.filter((finding) =>
      finding.kind === "COUNTEREXAMPLE"
    ).map((finding) => finding.findingId));
    const retainedRouteFamilyIds = uniqueHashes(input.standingRoutes?.families.flatMap(
      ({ family }) => family.authoringRunIds.some((runId) => runIdSet.has(runId))
        ? [family.routeFamilyId]
        : [],
    ) ?? []);
    const stage: StandingRouteSeedOutcomeStage = (retainedRouteFamilyIds.length > 0 ||
        routeFindingIds.length > 0) && counterexampleFindingIds.length > 0
      ? "CONFLICTING_TERMINAL_EFFECTS"
      : retainedRouteFamilyIds.length > 0 ||
        routeFindingIds.length > 0
      ? "ROUTE_RETAINED"
      : counterexampleFindingIds.length > 0
        ? "COUNTEREXAMPLE_RETAINED"
        : runs.some((run) => run.status === "PREPARED")
          ? "RUN_IN_FLIGHT"
          : runs.length > 0
            ? "SPENT_WITHOUT_TERMINAL_EFFECT"
            : "UNACTED";
    const body = Object.freeze({
      schemaVersion: "pmh.standing-route-seed-action-outcome.v1" as const,
      selectionIdentity: action.selectionIdentity,
      selectionActionRef: action.binding.selectionActionRef,
      targetRouteLayer: routeSeedPayload.researchIntent.targetRouteLayer,
      taskId: revision.task.taskId,
      inputRevisionId: revision.revisionId,
      directRunIds: runIds,
      routeFindingIds,
      counterexampleFindingIds,
      retainedRouteFamilyIds,
      stage,
      acted: runs.length > 0,
      terminal: stage === "ROUTE_RETAINED" || stage === "COUNTEREXAMPLE_RETAINED" ||
        stage === "CONFLICTING_TERMINAL_EFFECTS" ||
        (stage === "SPENT_WITHOUT_TERMINAL_EFFECT" && runs.every((run) =>
          TERMINAL_RUN_STATES.has(run.status)
        )),
      usefulNegativeMemory: stage === "COUNTEREXAMPLE_RETAINED",
      directCost: costForRuns(input.execution, runIds),
      authority: "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY" as const,
      causalClaim: false as const,
      policyMutationAuthority: false as const,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, outcomeId: hashCanonical(body) });
  }).sort((left, right) =>
    left.targetRouteLayer.localeCompare(right.targetRouteLayer) ||
    left.selectionActionRef.localeCompare(right.selectionActionRef)
  ));
  const layers = Object.freeze([
    "SUBJECT_REFERENCE", "EVENT_REFERENCE", "SETTLEMENT_REFERENCE",
  ] as const);
  const strata = Object.freeze(layers.flatMap((targetRouteLayer) => {
    const selected = outcomes.filter((item) => item.targetRouteLayer === targetRouteLayer);
    if (selected.length === 0) return [];
    const sum = (field: "knownInputTokens" | "knownOutputTokens" | "knownReasoningTokens") =>
      selected.reduce((total, item) => total + BigInt(item.directCost[field]), 0n).toString();
    const terminalActionCount = selected.filter((item) => item.terminal).length;
    return [Object.freeze({
      targetRouteLayer,
      selectedActionCount: selected.length,
      actedActionCount: selected.filter((item) => item.acted).length,
      terminalActionCount,
      routeRetainedActionCount: selected.filter((item) => item.stage === "ROUTE_RETAINED").length,
      usefulNegativeMemoryActionCount: selected.filter((item) =>
        item.usefulNegativeMemory
      ).length,
      conflictingTerminalEffectActionCount: selected.filter((item) =>
        item.stage === "CONFLICTING_TERMINAL_EFFECTS"
      ).length,
      knownInputTokens: sum("knownInputTokens"),
      knownOutputTokens: sum("knownOutputTokens"),
      knownReasoningTokens: sum("knownReasoningTokens"),
      terminalEvidenceMinimum: 3 as const,
      yieldCostEstimateQualified: terminalActionCount >= 3,
    })];
  }));
  const qualifiedLayerCount = strata.filter((item) => item.yieldCostEstimateQualified).length;
  const body = Object.freeze({
    schemaVersion: "pmh.standing-route-seed-outcome-projection.v1" as const,
    observedAt: input.observedAt,
    campaignCount: campaigns.length,
    selectedActionCount: outcomes.length,
    actedActionCount: outcomes.filter((item) => item.acted).length,
    terminalActionCount: outcomes.filter((item) => item.terminal).length,
    routeRetainedActionCount: outcomes.filter((item) => item.stage === "ROUTE_RETAINED").length,
    usefulNegativeMemoryActionCount: outcomes.filter((item) =>
      item.usefulNegativeMemory
    ).length,
    conflictingTerminalEffectActionCount: outcomes.filter((item) =>
      item.stage === "CONFLICTING_TERMINAL_EFFECTS"
    ).length,
    outcomes,
    strata,
    recurrenceQualification: Object.freeze({
      representedLayerCount: strata.length,
      qualifiedLayerCount,
      minimumTerminalActionsPerLayer: 3 as const,
      yieldCostEvidenceSufficient: strata.length === 3 && qualifiedLayerCount === 3,
      operatorActivationStillRequired: true as const,
    }),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
