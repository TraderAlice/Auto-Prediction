import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  AgentCampaign,
  AgentCampaignSelectionTaskBinding,
  AgentExecutionSnapshot,
  AgentRun,
  AgentSelectionBoundCampaign,
} from "./agent-execution-substrate.js";
import { agentInputRevisionAnnotationMatches } from "./agent-input-revision-binding.js";
import type { MarketOntologyAgentProposal } from "./market-ontology-agent-tools.js";
import type { OntologyRelationWorkProjection } from "./ontology-relation-work.js";
import type { RelationDiscoveryFinding } from "./relation-discovery-agent-tools.js";
import type { RelationDiscoveryProposalCompilation } from "./relation-discovery-semantic-bridge.js";
import type { RelationDiscoveryTaskRevision } from "./relation-discovery-work.js";

const ONTOLOGY_ATTENTION_SELECTION_PROTOCOL =
  "ONTOLOGY_ATTENTION_ALLOCATION_V1" as const;
const TERMINAL_RUN_STATES = new Set<AgentRun["status"]>([
  "INTERRUPTED", "SUCCEEDED", "FAILED", "CANCELLED",
]);
const OUTCOME_STAGES = Object.freeze([
  "UNACTED",
  "ONTOLOGY_RUN_IN_FLIGHT",
  "SPENT_WITHOUT_ONTOLOGY_OUTPUT",
  "ONTOLOGY_NEGATIVE_MEMORY",
  "ONTOLOGY_PROPOSAL_RETAINED",
  "RELATION_WORK_READY",
  "RELATION_RESEARCH_IN_FLIGHT",
  "RELATION_RESEARCH_ATTEMPTED",
  "RELATION_NEGATIVE_MEMORY",
  "RELATION_HYPOTHESIS_RETAINED",
  "SEMANTICALLY_REVIEWED",
  "SEMANTICALLY_ADMITTED",
  "PROBABILITY_RESEARCH",
  "OPPORTUNITY_LIFECYCLE",
] as const);

export type OntologyAllocationOutcomeStage = (typeof OUTCOME_STAGES)[number];

export type OntologyAllocationRunCost = Readonly<{
  runCount: number;
  terminalRunCount: number;
  modelInvocationCount: number;
  toolEffectCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownWallClockMs: string;
  unknownInputInvocationCount: number;
  unknownOutputInvocationCount: number;
  unknownReasoningInvocationCount: number;
  incompleteWallClockRunCount: number;
  usageComplete: boolean;
}>;

export type OntologyAllocationActionOutcome = Readonly<{
  schemaVersion: "pmh.ontology-allocation-action-outcome.v1";
  outcomeId: Hash;
  episodeId: Hash;
  selectionActionRef: Hash;
  selectionActionKind: string;
  workFamilyRef: string;
  taskId: Hash;
  inputRevisionId: Hash;
  exactInputHash: Hash;
  semanticInputIdentity: Hash;
  stage: OntologyAllocationOutcomeStage;
  acted: boolean;
  terminal: boolean;
  usefulNegativeMemory: boolean;
  directRunIds: readonly Hash[];
  ontologyProposalIds: readonly Hash[];
  ontologyCounterexampleIds: readonly Hash[];
  relationWorkItemIds: readonly Hash[];
  relationRunIds: readonly Hash[];
  relationPositiveFindingIds: readonly Hash[];
  relationCounterexampleIds: readonly Hash[];
  semanticProposalIds: readonly Hash[];
  semanticReviewJobIds: readonly Hash[];
  probabilityJobIds: readonly Hash[];
  opportunityIds: readonly string[];
  directCost: OntologyAllocationRunCost;
  connectedDownstreamCost: OntologyAllocationRunCost;
  downstreamAttribution:
    | "NO_DOWNSTREAM_LINEAGE"
    | "EXCLUSIVE_LINEAGE"
    | "SHARED_LINEAGE_NON_CAUSAL";
  diagnostic: string;
  authority: "DESCRIPTIVE_ONTOLOGY_ALLOCATION_ATTRIBUTION_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  automaticDispatch: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type OntologyAllocationCampaignOutcome = Readonly<{
  schemaVersion: "pmh.ontology-allocation-campaign-outcome.v1";
  episodeId: Hash;
  campaignKey: string;
  campaignRevisionIds: readonly Hash[];
  currentCampaignId: Hash;
  currentCampaignRevision: number;
  currentStatus: AgentCampaign["status"];
  selectionIdentity: Hash;
  selectionPolicyIdentity: Hash;
  executionProfileId: Hash;
  actionCount: number;
  actedActionCount: number;
  terminalActionCount: number;
  actionOutcomes: readonly OntologyAllocationActionOutcome[];
  authority: "DESCRIPTIVE_ONTOLOGY_ALLOCATION_ATTRIBUTION_ONLY";
  automaticDispatch: false;
  policyMutationAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type OntologyAllocationOutcomeStratum = Readonly<{
  selectionActionKind: string;
  selectedActionCount: number;
  actedActionCount: number;
  terminalActionCount: number;
  ontologyOutputActionCount: number;
  usefulNegativeMemoryActionCount: number;
  downstreamRelationActionCount: number;
  semanticallyReviewedActionCount: number;
  probabilityOrOpportunityActionCount: number;
  directKnownInputTokens: string;
  directKnownOutputTokens: string;
  directKnownReasoningTokens: string;
  incompleteDirectUsageActionCount: number;
  terminalEvidenceMinimum: 3;
  yieldCostEstimateQualified: boolean;
}>;

export type OntologyAllocationOutcomeProjection = Readonly<{
  schemaVersion: "pmh.ontology-allocation-outcome-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  campaignEpisodeCount: number;
  selectedActionCount: number;
  actedActionCount: number;
  terminalActionCount: number;
  stageCounts: Readonly<Record<OntologyAllocationOutcomeStage, number>>;
  strata: readonly OntologyAllocationOutcomeStratum[];
  recurrenceQualification: Readonly<{
    representedStratumCount: number;
    qualifiedStratumCount: number;
    minimumTerminalActionsPerStratum: 3;
    yieldCostEvidenceSufficient: boolean;
    operatorActivationStillRequired: true;
  }>;
  campaigns: readonly OntologyAllocationCampaignOutcome[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_ONTOLOGY_ALLOCATION_ATTRIBUTION_ONLY";
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

type SemanticReviewLineage = Readonly<{
  jobId: Hash;
  proposalId: Hash;
  status: string;
  recommendation: string | null;
  updatedAt: string;
}>;

type ProbabilityLineage = Readonly<{
  jobId: Hash;
  proposalId: Hash;
  status: string;
  updatedAt: string;
}>;

type OpportunityLineage = Readonly<{
  opportunityId: string;
  state: string;
  updatedAt: string;
}>;

function uniqueHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function costForRuns(
  execution: AgentExecutionSnapshot,
  runIdsInput: readonly Hash[],
): OntologyAllocationRunCost {
  const runIds = new Set(runIdsInput);
  const runs = execution.runs.filter((run) => runIds.has(run.runId));
  const invocations = execution.modelInvocations.filter((item) => runIds.has(item.runId));
  const knownWallClockMs = runs.reduce<bigint>((total, run) => {
    if (run.completedAt === null) return total;
    return total + BigInt(Math.max(0, Date.parse(run.completedAt) - Date.parse(run.createdAt)));
  }, 0n);
  const incompleteWallClockRunCount = runs.filter((run) => run.completedAt === null).length;
  const unknownInputInvocationCount = invocations.filter((item) =>
    item.inputTokens === null
  ).length;
  const unknownOutputInvocationCount = invocations.filter((item) =>
    item.outputTokens === null
  ).length;
  const unknownReasoningInvocationCount = invocations.filter((item) =>
    item.reasoningTokens === null
  ).length;
  return Object.freeze({
    runCount: runs.length,
    terminalRunCount: runs.filter((run) => TERMINAL_RUN_STATES.has(run.status)).length,
    modelInvocationCount: invocations.length,
    toolEffectCount: execution.toolEffects.filter((item) => runIds.has(item.runId)).length,
    knownInputTokens: invocations.reduce((total, item) =>
      total + BigInt(item.inputTokens ?? "0"), 0n).toString(),
    knownOutputTokens: invocations.reduce((total, item) =>
      total + BigInt(item.outputTokens ?? "0"), 0n).toString(),
    knownReasoningTokens: invocations.reduce((total, item) =>
      total + BigInt(item.reasoningTokens ?? "0"), 0n).toString(),
    knownWallClockMs: knownWallClockMs.toString(),
    unknownInputInvocationCount,
    unknownOutputInvocationCount,
    unknownReasoningInvocationCount,
    incompleteWallClockRunCount,
    usageComplete: unknownInputInvocationCount === 0 &&
      unknownOutputInvocationCount === 0 && unknownReasoningInvocationCount === 0 &&
      incompleteWallClockRunCount === 0,
  });
}

function actionStage(input: Readonly<{
  directRuns: readonly AgentRun[];
  ontologyPositiveCount: number;
  ontologyCounterexampleCount: number;
  relationRunnableWorkCount: number;
  relationNegativeWorkCount: number;
  relationRuns: readonly AgentRun[];
  relationPositiveCount: number;
  relationCounterexampleCount: number;
  semanticReviews: readonly SemanticReviewLineage[];
  probabilityCount: number;
  opportunityCount: number;
}>): OntologyAllocationOutcomeStage {
  if (input.opportunityCount > 0) return "OPPORTUNITY_LIFECYCLE";
  if (input.probabilityCount > 0) return "PROBABILITY_RESEARCH";
  if (input.semanticReviews.some((item) =>
    item.recommendation === "ACCEPT_FOR_RESEARCH_SIMULATION"
  )) return "SEMANTICALLY_ADMITTED";
  if (input.semanticReviews.some((item) => item.recommendation !== null)) {
    return "SEMANTICALLY_REVIEWED";
  }
  if (input.relationPositiveCount > 0) return "RELATION_HYPOTHESIS_RETAINED";
  if (input.relationCounterexampleCount > 0) return "RELATION_NEGATIVE_MEMORY";
  if (input.relationRuns.some((run) => run.status === "PREPARED")) {
    return "RELATION_RESEARCH_IN_FLIGHT";
  }
  if (input.relationRuns.length > 0) return "RELATION_RESEARCH_ATTEMPTED";
  if (input.relationRunnableWorkCount > 0) return "RELATION_WORK_READY";
  if (input.relationNegativeWorkCount > 0) return "RELATION_NEGATIVE_MEMORY";
  if (input.ontologyPositiveCount > 0) return "ONTOLOGY_PROPOSAL_RETAINED";
  if (input.ontologyCounterexampleCount > 0) return "ONTOLOGY_NEGATIVE_MEMORY";
  if (input.directRuns.some((run) => run.status === "PREPARED")) {
    return "ONTOLOGY_RUN_IN_FLIGHT";
  }
  if (input.directRuns.length > 0) return "SPENT_WITHOUT_ONTOLOGY_OUTPUT";
  return "UNACTED";
}

function latestCampaign(campaigns: readonly AgentCampaign[]): AgentCampaign {
  return [...campaigns].sort((left, right) =>
    right.revision - left.revision || right.campaignId.localeCompare(left.campaignId)
  )[0]!;
}

function episodeIdentity(campaign: AgentSelectionBoundCampaign): Hash {
  return hashCanonical({
    schemaVersion: "pmh.ontology-allocation-campaign-episode-identity.v1",
    campaignKey: campaign.campaignKey,
    executionProfileId: campaign.executionProfileId,
    selectionBinding: campaign.selectionBinding,
  });
}

function actionOutcome(input: Readonly<{
  episodeId: Hash;
  binding: AgentCampaignSelectionTaskBinding;
  campaignIds: ReadonlySet<Hash>;
  execution: AgentExecutionSnapshot;
  ontologyProposals: readonly MarketOntologyAgentProposal[];
  relationWork: OntologyRelationWorkProjection;
  relationTaskRevisions: readonly RelationDiscoveryTaskRevision[];
  relationFindings: readonly RelationDiscoveryFinding[];
  relationCompilations: readonly RelationDiscoveryProposalCompilation[];
  semanticReviews: readonly SemanticReviewLineage[];
  probabilityJobs: readonly ProbabilityLineage[];
  opportunities: readonly OpportunityLineage[];
}>): OntologyAllocationActionOutcome {
  const directRuns = input.execution.runs.filter((run) =>
    run.taskId === input.binding.taskId && run.authorization.campaignId !== null &&
    input.campaignIds.has(run.authorization.campaignId) &&
    input.execution.runAnnotations.some((annotation) =>
      annotation.runId === run.runId && agentInputRevisionAnnotationMatches({
        annotation,
        taskId: input.binding.taskId,
        revisionKind: "ONTOLOGY_SEARCH_ISSUE",
        revisionId: input.binding.inputRevisionId,
        exactInputHash: input.binding.exactInputHash,
      })
    )
  );
  const directRunIds = new Set(directRuns.map((run) => run.runId));
  const ontologyProposals = input.ontologyProposals.filter((proposal) =>
    directRunIds.has(proposal.sourceAgentRunId)
  );
  const ontologyProposalIds = new Set(ontologyProposals.map((item) => item.proposalId));
  const relationItems = input.relationWork.items.filter((item) =>
    item.sourceProposalIds.some((proposalId) => ontologyProposalIds.has(proposalId))
  );
  const relationWorkIds = new Set(relationItems.map((item) => item.workItemId));
  const relationRevisions = input.relationTaskRevisions.filter((revision) =>
    relationWorkIds.has(revision.workItemId)
  );
  const relationRuns = input.execution.runs.filter((run) =>
    relationRevisions.some((revision) => run.taskId === revision.task.taskId &&
      input.execution.runAnnotations.some((annotation) =>
        annotation.runId === run.runId && agentInputRevisionAnnotationMatches({
          annotation,
          taskId: revision.task.taskId,
          revisionKind: "RELATION_DISCOVERY",
          revisionId: revision.revisionId,
          exactInputHash: hashCanonical(revision.taskPayload),
        })
      )
    )
  );
  const relationRunIds = new Set(relationRuns.map((run) => run.runId));
  const relationFindings = input.relationFindings.filter((finding) =>
    relationWorkIds.has(finding.workItemId) && relationRunIds.has(finding.sourceAgentRunId)
  );
  const findingIds = new Set(relationFindings.map((item) => item.findingId));
  const compilations = input.relationCompilations.filter((item) =>
    findingIds.has(item.origin.relationDiscoveryFindingId)
  );
  const semanticProposalIds = new Set(compilations.map((item) => item.proposal.proposalId));
  const semanticReviews = input.semanticReviews.filter((item) =>
    semanticProposalIds.has(item.proposalId)
  );
  const probabilityJobs = input.probabilityJobs.filter((item) =>
    semanticProposalIds.has(item.proposalId)
  );
  const opportunityIds = new Set([...semanticProposalIds].map((proposalId) =>
    `ai:${proposalId}`
  ));
  const opportunities = input.opportunities.filter((item) =>
    opportunityIds.has(item.opportunityId)
  );
  const ontologyPositive = ontologyProposals.filter((item) => item.kind !== "COUNTEREXAMPLE");
  const ontologyCounterexamples = ontologyProposals.filter((item) =>
    item.kind === "COUNTEREXAMPLE"
  );
  const relationPositive = relationFindings.filter((item) =>
    item.kind === "RELATION_HYPOTHESIS"
  );
  const relationCounterexamples = relationFindings.filter((item) =>
    item.kind === "COUNTEREXAMPLE"
  );
  const stage = actionStage({
    directRuns,
    ontologyPositiveCount: ontologyPositive.length,
    ontologyCounterexampleCount: ontologyCounterexamples.length,
    relationRunnableWorkCount: relationItems.filter((item) =>
      item.disposition === "RUNNABLE_RESEARCH"
    ).length,
    relationNegativeWorkCount: relationItems.filter((item) =>
      item.disposition === "NEGATIVE_EVIDENCE_ONLY"
    ).length,
    relationRuns,
    relationPositiveCount: relationPositive.length,
    relationCounterexampleCount: relationCounterexamples.length,
    semanticReviews,
    probabilityCount: probabilityJobs.length,
    opportunityCount: opportunities.length,
  });
  const sharedLineage = relationItems.some((item) => item.sourceProposalIds.some((proposalId) =>
    !ontologyProposalIds.has(proposalId)
  ));
  const terminal = directRuns.length > 0 && directRuns.every((run) =>
    TERMINAL_RUN_STATES.has(run.status)
  );
  const usefulNegativeMemory = ontologyCounterexamples.length > 0 ||
    relationCounterexamples.length > 0 || relationItems.some((item) =>
      item.disposition === "NEGATIVE_EVIDENCE_ONLY"
    );
  const diagnostic = stage === "UNACTED"
    ? "The selected exact input has no campaign-authorized run."
    : stage === "SPENT_WITHOUT_ONTOLOGY_OUTPUT"
      ? "The campaign spent Agent attention but retained no ontology proposal or counterexample."
      : stage === "ONTOLOGY_NEGATIVE_MEMORY" || stage === "RELATION_NEGATIVE_MEMORY"
        ? "The lineage retained a counterexample as useful negative search memory."
        : stage === "OPPORTUNITY_LIFECYCLE"
          ? "A connected semantic proposal entered the local opportunity lifecycle."
          : `The furthest retained lineage stage is ${stage.toLowerCase().replaceAll("_", " ")}.`;
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-allocation-action-outcome.v1" as const,
    episodeId: input.episodeId,
    selectionActionRef: input.binding.selectionActionRef,
    selectionActionKind: input.binding.selectionActionKind,
    workFamilyRef: input.binding.workFamilyRef,
    taskId: input.binding.taskId,
    inputRevisionId: input.binding.inputRevisionId,
    exactInputHash: input.binding.exactInputHash,
    semanticInputIdentity: input.binding.semanticInputIdentity,
    stage,
    acted: directRuns.length > 0,
    terminal,
    usefulNegativeMemory,
    directRunIds: uniqueHashes([...directRunIds]),
    ontologyProposalIds: uniqueHashes(ontologyPositive.map((item) => item.proposalId)),
    ontologyCounterexampleIds: uniqueHashes(ontologyCounterexamples.map((item) => item.proposalId)),
    relationWorkItemIds: uniqueHashes(relationItems.map((item) => item.workItemId)),
    relationRunIds: uniqueHashes([...relationRunIds]),
    relationPositiveFindingIds: uniqueHashes(relationPositive.map((item) => item.findingId)),
    relationCounterexampleIds: uniqueHashes(relationCounterexamples.map((item) => item.findingId)),
    semanticProposalIds: uniqueHashes([...semanticProposalIds]),
    semanticReviewJobIds: uniqueHashes(semanticReviews.map((item) => item.jobId)),
    probabilityJobIds: uniqueHashes(probabilityJobs.map((item) => item.jobId)),
    opportunityIds: uniqueStrings(opportunities.map((item) => item.opportunityId)),
    directCost: costForRuns(input.execution, [...directRunIds]),
    connectedDownstreamCost: costForRuns(input.execution, [...relationRunIds]),
    downstreamAttribution: relationItems.length === 0
      ? "NO_DOWNSTREAM_LINEAGE" as const
      : sharedLineage
        ? "SHARED_LINEAGE_NON_CAUSAL" as const
        : "EXCLUSIVE_LINEAGE" as const,
    diagnostic,
    authority: "DESCRIPTIVE_ONTOLOGY_ALLOCATION_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    automaticDispatch: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, outcomeId: hashCanonical(body) });
}

export function buildOntologyAllocationOutcomeProjection(input: Readonly<{
  execution: AgentExecutionSnapshot;
  ontologyProposals: readonly MarketOntologyAgentProposal[];
  relationWork: OntologyRelationWorkProjection;
  relationTaskRevisions: readonly RelationDiscoveryTaskRevision[];
  relationFindings: readonly RelationDiscoveryFinding[];
  relationCompilations: readonly RelationDiscoveryProposalCompilation[];
  semanticReviews: readonly SemanticReviewLineage[];
  probabilityJobs: readonly ProbabilityLineage[];
  opportunities: readonly OpportunityLineage[];
}>): OntologyAllocationOutcomeProjection {
  const selectedCampaigns = input.execution.campaigns.filter((campaign): campaign is
    AgentSelectionBoundCampaign =>
    (campaign.schemaVersion === "pmh.agent-campaign.v2" ||
      campaign.schemaVersion === "pmh.agent-campaign.v3" ||
      campaign.schemaVersion === "pmh.agent-campaign.v4") &&
    campaign.selectionBinding.selectionProtocol === ONTOLOGY_ATTENTION_SELECTION_PROTOCOL);
  const grouped = new Map<Hash, readonly (typeof selectedCampaigns)[number][]>();
  for (const campaign of selectedCampaigns) {
    const id = episodeIdentity(campaign);
    grouped.set(id, Object.freeze([...(grouped.get(id) ?? []), campaign]));
  }
  const campaigns = Object.freeze([...grouped.entries()].map(([episodeId, revisions]) => {
    const current = latestCampaign(revisions);
    if (current.schemaVersion !== "pmh.agent-campaign.v2" &&
        current.schemaVersion !== "pmh.agent-campaign.v3" &&
        current.schemaVersion !== "pmh.agent-campaign.v4") {
      throw new Error("ontology allocation campaign episode lost its selection binding");
    }
    const campaignIds = new Set(revisions.map((item) => item.campaignId));
    const actionOutcomes = Object.freeze(current.selectionBinding.taskBindings.map((binding) =>
      actionOutcome({
        episodeId,
        binding,
        campaignIds,
        ...input,
      })
    ).sort((left, right) => left.selectionActionRef.localeCompare(right.selectionActionRef)));
    return Object.freeze({
      schemaVersion: "pmh.ontology-allocation-campaign-outcome.v1" as const,
      episodeId,
      campaignKey: current.campaignKey,
      campaignRevisionIds: uniqueHashes(revisions.map((item) => item.campaignId)),
      currentCampaignId: current.campaignId,
      currentCampaignRevision: current.revision,
      currentStatus: current.status,
      selectionIdentity: current.selectionBinding.selectionIdentity,
      selectionPolicyIdentity: current.selectionBinding.selectionPolicyIdentity,
      executionProfileId: current.executionProfileId,
      actionCount: actionOutcomes.length,
      actedActionCount: actionOutcomes.filter((item) => item.acted).length,
      terminalActionCount: actionOutcomes.filter((item) => item.terminal).length,
      actionOutcomes,
      authority: "DESCRIPTIVE_ONTOLOGY_ALLOCATION_ATTRIBUTION_ONLY" as const,
      automaticDispatch: false as const,
      policyMutationAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
  }).sort((left, right) =>
    left.campaignKey.localeCompare(right.campaignKey) || left.episodeId.localeCompare(right.episodeId)
  ));
  const actions = campaigns.flatMap((campaign) => campaign.actionOutcomes);
  const kinds = [...new Set(actions.map((action) => action.selectionActionKind))].sort();
  const strata = Object.freeze(kinds.map((kind) => {
    const members = actions.filter((action) => action.selectionActionKind === kind);
    const directKnownInputTokens = members.reduce((total, item) =>
      total + BigInt(item.directCost.knownInputTokens), 0n).toString();
    const directKnownOutputTokens = members.reduce((total, item) =>
      total + BigInt(item.directCost.knownOutputTokens), 0n).toString();
    const directKnownReasoningTokens = members.reduce((total, item) =>
      total + BigInt(item.directCost.knownReasoningTokens), 0n).toString();
    const terminalActionCount = members.filter((item) => item.terminal).length;
    return Object.freeze({
      selectionActionKind: kind,
      selectedActionCount: members.length,
      actedActionCount: members.filter((item) => item.acted).length,
      terminalActionCount,
      ontologyOutputActionCount: members.filter((item) =>
        item.ontologyProposalIds.length + item.ontologyCounterexampleIds.length > 0
      ).length,
      usefulNegativeMemoryActionCount: members.filter((item) =>
        item.usefulNegativeMemory
      ).length,
      downstreamRelationActionCount: members.filter((item) =>
        item.relationWorkItemIds.length > 0
      ).length,
      semanticallyReviewedActionCount: members.filter((item) =>
        item.semanticReviewJobIds.length > 0
      ).length,
      probabilityOrOpportunityActionCount: members.filter((item) =>
        item.probabilityJobIds.length > 0 || item.opportunityIds.length > 0
      ).length,
      directKnownInputTokens,
      directKnownOutputTokens,
      directKnownReasoningTokens,
      incompleteDirectUsageActionCount: members.filter((item) =>
        !item.directCost.usageComplete
      ).length,
      terminalEvidenceMinimum: 3 as const,
      yieldCostEstimateQualified: terminalActionCount >= 3,
    });
  }));
  // Keep the projection identity scoped to the selected episodes and their
  // connected lineage. Unrelated Agent activity must not make a historical
  // allocation outcome appear to have changed.
  const connectedRunIds = new Set(actions.flatMap((item) => [
    ...item.directRunIds,
    ...item.relationRunIds,
  ]));
  const connectedOntologyProposalIds = new Set(actions.flatMap((item) => [
    ...item.ontologyProposalIds,
    ...item.ontologyCounterexampleIds,
  ]));
  const connectedRelationWorkItemIds = new Set(actions.flatMap((item) =>
    item.relationWorkItemIds
  ));
  const connectedRelationFindingIds = new Set(actions.flatMap((item) => [
    ...item.relationPositiveFindingIds,
    ...item.relationCounterexampleIds,
  ]));
  const connectedSemanticReviewJobIds = new Set(actions.flatMap((item) =>
    item.semanticReviewJobIds
  ));
  const connectedProbabilityJobIds = new Set(actions.flatMap((item) =>
    item.probabilityJobIds
  ));
  const connectedOpportunityIds = new Set(actions.flatMap((item) =>
    item.opportunityIds
  ));
  const observedTimes = [
    ...selectedCampaigns.flatMap((item) => [item.createdAt, item.activatedAt].filter(
      (value): value is string => value !== null
    )),
    ...input.execution.runs.filter((item) => connectedRunIds.has(item.runId)).flatMap((item) =>
      [item.createdAt, item.completedAt].filter((value): value is string => value !== null)
    ),
    ...input.ontologyProposals.filter((item) =>
      connectedOntologyProposalIds.has(item.proposalId)
    ).map((item) => item.proposedAt),
    ...input.relationWork.items.filter((item) =>
      connectedRelationWorkItemIds.has(item.workItemId)
    ).flatMap((item) => [item.firstProposedAt, item.lastProposedAt]),
    ...input.relationTaskRevisions.filter((item) =>
      connectedRelationWorkItemIds.has(item.workItemId)
    ).map((item) => item.materializedAt),
    ...input.relationFindings.filter((item) =>
      connectedRelationFindingIds.has(item.findingId)
    ).map((item) => item.recordedAt),
    ...input.semanticReviews.filter((item) =>
      connectedSemanticReviewJobIds.has(item.jobId)
    ).map((item) => item.updatedAt),
    ...input.probabilityJobs.filter((item) =>
      connectedProbabilityJobIds.has(item.jobId)
    ).map((item) => item.updatedAt),
    ...input.opportunities.filter((item) =>
      connectedOpportunityIds.has(item.opportunityId)
    ).map((item) => item.updatedAt),
  ].sort();
  const qualifiedStratumCount = strata.filter((item) =>
    item.yieldCostEstimateQualified
  ).length;
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-allocation-outcome-projection.v1" as const,
    observedAt: observedTimes.at(-1) ?? "1970-01-01T00:00:00.000Z",
    campaignEpisodeCount: campaigns.length,
    selectedActionCount: actions.length,
    actedActionCount: actions.filter((item) => item.acted).length,
    terminalActionCount: actions.filter((item) => item.terminal).length,
    stageCounts: Object.freeze(Object.fromEntries(OUTCOME_STAGES.map((stage) => [
      stage,
      actions.filter((item) => item.stage === stage).length,
    ]))) as Readonly<Record<OntologyAllocationOutcomeStage, number>>,
    strata,
    recurrenceQualification: Object.freeze({
      representedStratumCount: strata.length,
      qualifiedStratumCount,
      minimumTerminalActionsPerStratum: 3 as const,
      yieldCostEvidenceSufficient: strata.length > 0 && qualifiedStratumCount === strata.length,
      operatorActivationStillRequired: true as const,
    }),
    campaigns,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_ONTOLOGY_ALLOCATION_ATTRIBUTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
