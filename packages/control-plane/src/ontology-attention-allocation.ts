import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  AgentExecutionSnapshot,
  AgentRun,
} from "./agent-execution-substrate.js";
import {
  assertMarketOntologyAgentProposal,
  type MarketOntologyAgentProposal,
} from "./market-ontology-agent-tools.js";
import {
  assertOntologySearchIssueRevision,
  type OntologySearchIssueRevision,
} from "./ontology-search-ecology.js";
import type { OntologyRelationWorkProjection } from "./ontology-relation-work.js";
import {
  AGENT_INPUT_REVISION_ANNOTATION_CATEGORY,
  agentInputRevisionAnnotationMatches,
  agentInputRevisionSourceRecordRef,
} from "./agent-input-revision-binding.js";

const ISSUE_PROVENANCE_PREFIX = "ontology-issue:";
const INPUT_REVISION_REF_PREFIX = "ontology-search-issue-revision:";
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const PORTFOLIO_CAPS = Object.freeze({
  evidenceRich: 2,
  ambiguityProbe: 1,
  changedInputRecheck: 1,
  total: 4,
} as const);

export type OntologyAttentionAmbiguityPosture =
  | "EVIDENCE_RICH"
  | "SINGLE_SIGNAL"
  | "AGGREGATE_TITLE"
  | "MIXED_AMBIGUITY";

export type OntologyAttentionActionKind =
  | "EXPLOIT_EVIDENCE_RICH_ISSUE"
  | "PROBE_AMBIGUOUS_ISSUE"
  | "RECHECK_CHANGED_INPUT"
  | "ADVANCE_DOWNSTREAM"
  | "HOLD_NEGATIVE_MEMORY"
  | "HOLD_NO_NOVELTY";

export type OntologyAttentionIssueScorecard = Readonly<{
  schemaVersion: "pmh.ontology-attention-issue-scorecard.v1";
  scorecardId: Hash;
  issueId: Hash;
  currentRevisionId: Hash;
  currentTaskId: Hash;
  currentResearchInputIdentity: Hash;
  retainedRevisionCount: number;
  selectionLane: OntologySearchIssueRevision["selectionLane"];
  trailheadCount: number;
  maximumTrailheadScore: number;
  maximumSharedSignalCount: number;
  singleSignalTrailheadCount: number;
  aggregateTitleTrailheadCount: number;
  ambiguityPosture: OntologyAttentionAmbiguityPosture;
  runIds: readonly Hash[];
  runCount: number;
  terminalRunCount: number;
  failedOrInterruptedRunCount: number;
  inputBoundRunCount: number;
  unboundRunCount: number;
  attemptedRevisionIds: readonly Hash[];
  attemptedResearchInputIdentities: readonly Hash[];
  currentInputAttempted: boolean;
  proposalCounts: Readonly<{
    entityAlias: number;
    worldProposition: number;
    counterexample: number;
  }>;
  downstreamRelationWorkCount: number;
  downstreamRunnableWorkCount: number;
  downstreamNegativeMemoryCount: number;
  usage: Readonly<{
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownInputInvocationCount: number;
    unknownOutputInvocationCount: number;
    unknownReasoningInvocationCount: number;
    knownWallClockMs: string;
    incompleteWallClockRunCount: number;
  }>;
  nextActionKind: OntologyAttentionActionKind;
  nextActionEligible: boolean;
  noveltyReason:
    | "UNATTEMPTED_EVIDENCE_RICH"
    | "UNATTEMPTED_AMBIGUITY_PROBE"
    | "MATERIAL_INPUT_CHANGED"
    | "PROPOSAL_HAS_DOWNSTREAM_WORK"
    | "COUNTEREXAMPLE_NEGATIVE_MEMORY"
    | "ATTEMPT_INPUT_UNBOUND"
    | "NO_MATERIAL_NOVELTY";
  diagnostic: string;
  authority: "ONTOLOGY_ATTENTION_EVIDENCE_ONLY";
  structuralHeuristicSemanticAuthority: false;
  modelConfidenceAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  valueMovingAuthority: false;
}>;

export type OntologyAttentionAllocationAction = Readonly<{
  schemaVersion: "pmh.ontology-attention-allocation-action.v1";
  actionId: Hash;
  issueId: Hash;
  scorecardId: Hash;
  kind:
    | "EXPLOIT_EVIDENCE_RICH_ISSUE"
    | "PROBE_AMBIGUOUS_ISSUE"
    | "RECHECK_CHANGED_INPUT";
  taskId: Hash;
  revisionId: Hash;
  selectionLane: OntologySearchIssueRevision["selectionLane"];
  ambiguityPosture: OntologyAttentionAmbiguityPosture;
  diagnostic: string;
  authority: "ONTOLOGY_ATTENTION_PROPOSAL_ONLY";
  modelInvocationAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type OntologyAttentionAllocationProjection = Readonly<{
  schemaVersion: "pmh.ontology-attention-allocation.v1";
  projectionIdentity: Hash;
  observedAt: string;
  policy: Readonly<{
    schemaVersion: "pmh.ontology-attention-policy.v1";
    policyIdentity: Hash;
    portfolioCaps: typeof PORTFOLIO_CAPS;
    structuralAmbiguitySemanticAuthority: false;
    automaticDispatch: false;
  }>;
  issueCount: number;
  actionableIssueCount: number;
  heldIssueCount: number;
  scorecards: readonly OntologyAttentionIssueScorecard[];
  portfolio: readonly OntologyAttentionAllocationAction[];
  laneCounts: Readonly<{
    evidenceRich: number;
    ambiguityProbe: number;
    changedInputRecheck: number;
  }>;
  omittedActionableIssueCount: number;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  automaticDispatch: false;
  authority: "ONTOLOGY_ATTENTION_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function terminal(run: AgentRun): boolean {
  return ["INTERRUPTED", "SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status);
}

function wallClockMs(run: AgentRun): bigint | null {
  if (run.completedAt === null) return null;
  const elapsed = Date.parse(run.completedAt) - Date.parse(run.createdAt);
  return Number.isFinite(elapsed) && elapsed >= 0 ? BigInt(elapsed) : null;
}

function aggregateTitle(title: string): boolean {
  return /^(?:yes|no)\s/iu.test(title.trim()) ||
    (title.match(/(?:^|,)\s*(?:yes|no)\s/giu)?.length ?? 0) >= 2;
}

export function ontologyIssueResearchInputIdentity(
  revision: OntologySearchIssueRevision,
): Hash {
  const payload = revision.taskPayload;
  return hashCanonical(Object.freeze({
    schemaVersion: "pmh.ontology-issue-research-input.v1",
    issueId: revision.issueId,
    trailheads: payload.trailheads.map((trailhead) => Object.freeze({
      listingRefs: trailhead.listingRefs,
      listingTitleExcerpts: trailhead.listingTitleExcerpts,
      sharedSubjectSignals: trailhead.sharedSubjectSignals,
      changedFacets: trailhead.changedFacets,
      selectionLane: trailhead.selectionLane,
      searchQuestion: trailhead.searchQuestion,
    })),
    listingEvidence: payload.listingEvidence.map((listing) => Object.freeze({
      listingRef: listing.listingRef,
      title: listing.title,
      descriptionExcerpt: listing.descriptionExcerpt,
      rulesTextExcerpt: listing.rulesTextExcerpt,
      outcomes: listing.outcomes.map((outcome) => Object.freeze({
        venueOutcomeId: outcome.venueOutcomeId,
        label: outcome.label,
      })),
      closesAt: listing.closesAt,
      protocolIdentity: listing.protocolIdentity,
      worldFacet: Object.freeze({
        subjectSignals: listing.node.worldFacet.subjectSignals,
        predicateFamilies: listing.node.worldFacet.predicateFamilies,
        temporalSignals: listing.node.worldFacet.temporalSignals,
        parameterSignals: listing.node.worldFacet.parameterSignals,
      }),
      settlementFacet: Object.freeze({
        venueId: listing.node.settlementFacet.venueId,
        venueInstrumentId: listing.node.settlementFacet.venueInstrumentId,
        protocolIdentity: listing.node.settlementFacet.protocolIdentity,
        closeBoundary: listing.node.settlementFacet.closeBoundary,
        rulesEvidencePosture: listing.node.settlementFacet.rulesEvidencePosture,
        locatorRoles: listing.node.settlementFacet.locatorRoles,
        outcomeShape: listing.node.settlementFacet.outcomeShape,
        outcomeLabels: listing.node.settlementFacet.outcomeLabels,
      }),
      tradedFacet: Object.freeze({
        mechanism: listing.node.tradedFacet.mechanism,
        priceScale: listing.node.tradedFacet.priceScale,
        quantityScale: listing.node.tradedFacet.quantityScale,
        minPriceTick: listing.node.tradedFacet.minPriceTick,
      }),
    })),
  }));
}

function latestByIssue(
  revisions: readonly OntologySearchIssueRevision[],
): readonly OntologySearchIssueRevision[] {
  const latest = new Map<Hash, OntologySearchIssueRevision>();
  for (const revision of revisions) {
    const current = latest.get(revision.issueId);
    if (current === undefined || revision.materializedAt > current.materializedAt ||
        (revision.materializedAt === current.materializedAt &&
          revision.revisionId > current.revisionId)) latest.set(revision.issueId, revision);
  }
  return Object.freeze([...latest.values()].sort((left, right) =>
    left.issueId.localeCompare(right.issueId)
  ));
}

function issueIdsByTask(execution: AgentExecutionSnapshot): ReadonlyMap<Hash, Hash> {
  return new Map(execution.tasks.flatMap((task) => {
    if (!task.provenanceRef.startsWith(ISSUE_PROVENANCE_PREFIX)) return [];
    const issueId = task.provenanceRef.slice(ISSUE_PROVENANCE_PREFIX.length) as Hash;
    return HASH_PATTERN.test(issueId) ? [[task.taskId, issueId] as const] : [];
  }));
}

function ambiguityPosture(input: Readonly<{
  singleSignalTrailheadCount: number;
  aggregateTitleTrailheadCount: number;
}>): OntologyAttentionAmbiguityPosture {
  if (input.singleSignalTrailheadCount > 0 && input.aggregateTitleTrailheadCount > 0) {
    return "MIXED_AMBIGUITY";
  }
  if (input.aggregateTitleTrailheadCount > 0) return "AGGREGATE_TITLE";
  if (input.singleSignalTrailheadCount > 0) return "SINGLE_SIGNAL";
  return "EVIDENCE_RICH";
}

function chooseLaneDiverse(
  scorecards: readonly OntologyAttentionIssueScorecard[],
  maximum: number,
): readonly OntologyAttentionIssueScorecard[] {
  const selected: OntologyAttentionIssueScorecard[] = [];
  for (const scorecard of scorecards) {
    if (selected.length >= maximum) break;
    if (selected.length === 0 || !selected.some((item) =>
      item.selectionLane === scorecard.selectionLane
    )) selected.push(scorecard);
  }
  for (const scorecard of scorecards) {
    if (selected.length >= maximum) break;
    if (!selected.some((item) => item.issueId === scorecard.issueId)) selected.push(scorecard);
  }
  return Object.freeze(selected);
}

export function buildOntologyAttentionAllocation(input: Readonly<{
  currentRevisions: readonly OntologySearchIssueRevision[];
  retainedRevisions: readonly OntologySearchIssueRevision[];
  proposals: readonly MarketOntologyAgentProposal[];
  execution: AgentExecutionSnapshot;
  relationWork?: OntologyRelationWorkProjection;
}>): OntologyAttentionAllocationProjection {
  const currentRevisions = latestByIssue(input.currentRevisions
    .map(assertOntologySearchIssueRevision));
  const retainedRevisions = input.retainedRevisions.map(assertOntologySearchIssueRevision);
  const proposals = input.proposals.map(assertMarketOntologyAgentProposal);
  const retainedById = new Map(retainedRevisions.map((revision) =>
    [revision.revisionId, revision] as const
  ));
  const retainedByIssue = new Map<Hash, OntologySearchIssueRevision[]>();
  for (const revision of retainedRevisions) {
    const values = retainedByIssue.get(revision.issueId) ?? [];
    values.push(revision);
    retainedByIssue.set(revision.issueId, values);
  }
  const issueByTask = issueIdsByTask(input.execution);
  const runsByIssue = new Map<Hash, AgentRun[]>();
  const issueByRun = new Map<Hash, Hash>();
  for (const run of input.execution.runs) {
    const issueId = issueByTask.get(run.taskId);
    if (issueId === undefined) continue;
    const values = runsByIssue.get(issueId) ?? [];
    values.push(run);
    runsByIssue.set(issueId, values);
    issueByRun.set(run.runId, issueId);
  }
  const proposalsByIssue = new Map<Hash, MarketOntologyAgentProposal[]>();
  for (const proposal of proposals) {
    const issueId = issueByRun.get(proposal.sourceAgentRunId);
    if (issueId === undefined) continue;
    const values = proposalsByIssue.get(issueId) ?? [];
    values.push(proposal);
    proposalsByIssue.set(issueId, values);
  }
  const revisionIdsByRun = new Map<Hash, Hash[]>();
  for (const annotation of input.execution.runAnnotations) {
    if (annotation.category !== AGENT_INPUT_REVISION_ANNOTATION_CATEGORY ||
        !annotation.sourceRecordRef.startsWith(INPUT_REVISION_REF_PREFIX)) continue;
    const revisionId = annotation.sourceRecordRef.slice(INPUT_REVISION_REF_PREFIX.length) as Hash;
    const revision = retainedById.get(revisionId);
    const run = input.execution.runs.find((item) => item.runId === annotation.runId);
    if (!HASH_PATTERN.test(revisionId) || revision === undefined || run === undefined ||
        issueByTask.get(run.taskId) !== revision.issueId ||
        revision.task.taskId !== run.taskId ||
        annotation.sourceRecordRef !== agentInputRevisionSourceRecordRef(
          "ONTOLOGY_SEARCH_ISSUE",
          revisionId,
        ) || !agentInputRevisionAnnotationMatches({
          annotation,
          taskId: run.taskId,
          revisionKind: "ONTOLOGY_SEARCH_ISSUE",
          revisionId,
          exactInputHash: hashCanonical(revision.taskPayload),
        })) continue;
    const values = revisionIdsByRun.get(annotation.runId) ?? [];
    values.push(revisionId);
    revisionIdsByRun.set(annotation.runId, values);
  }
  // Pre-binding historical positive runs can still be assigned to the exact
  // retained snapshot named by their accepted proposal. No-result historical
  // attempts remain explicitly unbound.
  for (const proposal of proposals) {
    if (revisionIdsByRun.has(proposal.sourceAgentRunId)) continue;
    const issueId = issueByRun.get(proposal.sourceAgentRunId);
    if (issueId === undefined) continue;
    const revision = (retainedByIssue.get(issueId) ?? []).find((item) =>
      item.sourceSnapshotIdentity === proposal.sourceSnapshotIdentity
    );
    if (revision !== undefined) revisionIdsByRun.set(proposal.sourceAgentRunId, [revision.revisionId]);
  }

  const scorecards = Object.freeze(currentRevisions.map((revision) => {
    const retained = retainedByIssue.get(revision.issueId) ?? [revision];
    const runs = Object.freeze([...(runsByIssue.get(revision.issueId) ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.runId.localeCompare(right.runId)
    ));
    const runIds = new Set(runs.map((run) => run.runId));
    const invocations = input.execution.modelInvocations.filter((item) => runIds.has(item.runId));
    const proposals = proposalsByIssue.get(revision.issueId) ?? [];
    const relationItems = input.relationWork?.items.filter((item) =>
      item.sourceIssueIds.includes(revision.issueId)
    ) ?? [];
    const singleSignalTrailheadCount = revision.taskPayload.trailheads.filter((trailhead) =>
      trailhead.sharedSubjectSignals.length === 1
    ).length;
    const aggregateTitleTrailheadCount = revision.taskPayload.trailheads.filter((trailhead) =>
      trailhead.listingTitleExcerpts.some(aggregateTitle)
    ).length;
    const posture = ambiguityPosture({
      singleSignalTrailheadCount,
      aggregateTitleTrailheadCount,
    });
    const attemptedRevisionIds = Object.freeze([...new Set(runs.flatMap((run) =>
      revisionIdsByRun.get(run.runId) ?? []
    ))].sort()) as readonly Hash[];
    const attemptedResearchInputIdentities = Object.freeze([...new Set(attemptedRevisionIds
      .flatMap((revisionId) => {
        const attempted = retainedById.get(revisionId);
        return attempted === undefined ? [] : [ontologyIssueResearchInputIdentity(attempted)];
      }))].sort()) as readonly Hash[];
    const currentResearchInputIdentity = ontologyIssueResearchInputIdentity(revision);
    const currentInputAttempted = attemptedResearchInputIdentities
      .includes(currentResearchInputIdentity);
    const positiveProposalCount = proposals.filter((item) => item.kind !== "COUNTEREXAMPLE").length;
    const counterexampleCount = proposals.filter((item) => item.kind === "COUNTEREXAMPLE").length;
    let action: Pick<OntologyAttentionIssueScorecard,
      "nextActionKind" | "nextActionEligible" | "noveltyReason" | "diagnostic">;
    if (positiveProposalCount > 0 || relationItems.some((item) =>
      item.disposition === "RUNNABLE_RESEARCH"
    )) {
      action = {
        nextActionKind: "ADVANCE_DOWNSTREAM",
        nextActionEligible: false,
        noveltyReason: "PROPOSAL_HAS_DOWNSTREAM_WORK",
        diagnostic: "Accepted ontology output already has a downstream relation-work path",
      };
    } else if (counterexampleCount > 0) {
      action = {
        nextActionKind: "HOLD_NEGATIVE_MEMORY",
        nextActionEligible: false,
        noveltyReason: "COUNTEREXAMPLE_NEGATIVE_MEMORY",
        diagnostic: "Retained counterexample is useful negative memory; no material recheck input is named",
      };
    } else if (runs.length === 0) {
      action = posture === "EVIDENCE_RICH" ? {
        nextActionKind: "EXPLOIT_EVIDENCE_RICH_ISSUE",
        nextActionEligible: true,
        noveltyReason: "UNATTEMPTED_EVIDENCE_RICH",
        diagnostic: "Unattempted issue has multiple grounded signals and no aggregate-title warning",
      } : {
        nextActionKind: "PROBE_AMBIGUOUS_ISSUE",
        nextActionEligible: true,
        noveltyReason: "UNATTEMPTED_AMBIGUITY_PROBE",
        diagnostic: "Unattempted ambiguity is retained as a bounded probe, not treated as semantic truth",
      };
    } else if (attemptedRevisionIds.length === 0) {
      action = {
        nextActionKind: "HOLD_NO_NOVELTY",
        nextActionEligible: false,
        noveltyReason: "ATTEMPT_INPUT_UNBOUND",
        diagnostic: "Historical attempt has no exact input binding; another run cannot claim input novelty",
      };
    } else if (!currentInputAttempted) {
      action = {
        nextActionKind: "RECHECK_CHANGED_INPUT",
        nextActionEligible: true,
        noveltyReason: "MATERIAL_INPUT_CHANGED",
        diagnostic: "Current purpose-specific research input differs from every exactly bound attempt",
      };
    } else {
      action = {
        nextActionKind: "HOLD_NO_NOVELTY",
        nextActionEligible: false,
        noveltyReason: "NO_MATERIAL_NOVELTY",
        diagnostic: "The current purpose-specific research input already has an attributed attempt",
      };
    }
    const elapsed = runs.map(wallClockMs);
    const body = Object.freeze({
      schemaVersion: "pmh.ontology-attention-issue-scorecard.v1" as const,
      issueId: revision.issueId,
      currentRevisionId: revision.revisionId,
      currentTaskId: revision.task.taskId,
      currentResearchInputIdentity,
      retainedRevisionCount: retained.length,
      selectionLane: revision.selectionLane,
      trailheadCount: revision.taskPayload.trailheads.length,
      maximumTrailheadScore: Math.max(...revision.taskPayload.trailheads.map((item) => item.score)),
      maximumSharedSignalCount: Math.max(...revision.taskPayload.trailheads
        .map((item) => item.sharedSubjectSignals.length)),
      singleSignalTrailheadCount,
      aggregateTitleTrailheadCount,
      ambiguityPosture: posture,
      runIds: Object.freeze(runs.map((run) => run.runId)),
      runCount: runs.length,
      terminalRunCount: runs.filter(terminal).length,
      failedOrInterruptedRunCount: runs.filter((run) =>
        ["FAILED", "INTERRUPTED", "CANCELLED"].includes(run.status)
      ).length,
      inputBoundRunCount: runs.filter((run) => (revisionIdsByRun.get(run.runId)?.length ?? 0) > 0).length,
      unboundRunCount: runs.filter((run) => !revisionIdsByRun.has(run.runId)).length,
      attemptedRevisionIds,
      attemptedResearchInputIdentities,
      currentInputAttempted,
      proposalCounts: Object.freeze({
        entityAlias: proposals.filter((item) => item.kind === "ENTITY_ALIAS").length,
        worldProposition: proposals.filter((item) => item.kind === "WORLD_PROPOSITION").length,
        counterexample: counterexampleCount,
      }),
      downstreamRelationWorkCount: relationItems.length,
      downstreamRunnableWorkCount: relationItems.filter((item) =>
        item.disposition === "RUNNABLE_RESEARCH"
      ).length,
      downstreamNegativeMemoryCount: relationItems.filter((item) =>
        item.disposition === "NEGATIVE_EVIDENCE_ONLY"
      ).length,
      usage: Object.freeze({
        knownInputTokens: invocations.reduce((sum, item) =>
          sum + BigInt(item.inputTokens ?? "0"), 0n).toString(),
        knownOutputTokens: invocations.reduce((sum, item) =>
          sum + BigInt(item.outputTokens ?? "0"), 0n).toString(),
        knownReasoningTokens: invocations.reduce((sum, item) =>
          sum + BigInt(item.reasoningTokens ?? "0"), 0n).toString(),
        unknownInputInvocationCount: invocations.filter((item) => item.inputTokens === null).length,
        unknownOutputInvocationCount: invocations.filter((item) => item.outputTokens === null).length,
        unknownReasoningInvocationCount: invocations.filter((item) => item.reasoningTokens === null).length,
        knownWallClockMs: elapsed.reduce<bigint>(
          (sum, value) => sum + (value ?? 0n),
          0n,
        ).toString(),
        incompleteWallClockRunCount: elapsed.filter((value) => value === null).length,
      }),
      ...action,
      authority: "ONTOLOGY_ATTENTION_EVIDENCE_ONLY" as const,
      structuralHeuristicSemanticAuthority: false as const,
      modelConfidenceAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, scorecardId: hashCanonical(body) });
  }));

  const ranking = (left: OntologyAttentionIssueScorecard,
    right: OntologyAttentionIssueScorecard): number => {
    const structural =
      right.downstreamRunnableWorkCount - left.downstreamRunnableWorkCount ||
      right.maximumSharedSignalCount - left.maximumSharedSignalCount ||
      left.aggregateTitleTrailheadCount - right.aggregateTitleTrailheadCount ||
      left.singleSignalTrailheadCount - right.singleSignalTrailheadCount ||
      right.maximumTrailheadScore - left.maximumTrailheadScore;
    if (structural !== 0) return structural;
    const leftUnknown = left.usage.unknownInputInvocationCount +
      left.usage.unknownOutputInvocationCount + left.usage.unknownReasoningInvocationCount;
    const rightUnknown = right.usage.unknownInputInvocationCount +
      right.usage.unknownOutputInvocationCount + right.usage.unknownReasoningInvocationCount;
    if (leftUnknown !== rightUnknown) return leftUnknown - rightUnknown;
    const leftTokens = BigInt(left.usage.knownInputTokens);
    const rightTokens = BigInt(right.usage.knownInputTokens);
    if (leftTokens !== rightTokens) return leftTokens < rightTokens ? -1 : 1;
    return left.issueId.localeCompare(right.issueId);
  };
  const evidenceRich = scorecards.filter((item) =>
    item.nextActionKind === "EXPLOIT_EVIDENCE_RICH_ISSUE" && item.nextActionEligible
  ).sort(ranking);
  const ambiguity = scorecards.filter((item) =>
    item.nextActionKind === "PROBE_AMBIGUOUS_ISSUE" && item.nextActionEligible
  ).sort((left, right) =>
    left.aggregateTitleTrailheadCount - right.aggregateTitleTrailheadCount ||
    ranking(left, right)
  );
  const rechecks = scorecards.filter((item) =>
    item.nextActionKind === "RECHECK_CHANGED_INPUT" && item.nextActionEligible
  ).sort(ranking);
  const selected = Object.freeze([
    ...chooseLaneDiverse(evidenceRich, PORTFOLIO_CAPS.evidenceRich),
    ...ambiguity.slice(0, PORTFOLIO_CAPS.ambiguityProbe),
    ...rechecks.slice(0, PORTFOLIO_CAPS.changedInputRecheck),
  ].slice(0, PORTFOLIO_CAPS.total));
  const portfolio = Object.freeze(selected.map((scorecard) => {
    const kind = scorecard.nextActionKind as OntologyAttentionAllocationAction["kind"];
    const body = Object.freeze({
      schemaVersion: "pmh.ontology-attention-allocation-action.v1" as const,
      issueId: scorecard.issueId,
      scorecardId: scorecard.scorecardId,
      kind,
      taskId: scorecard.currentTaskId,
      revisionId: scorecard.currentRevisionId,
      selectionLane: scorecard.selectionLane,
      ambiguityPosture: scorecard.ambiguityPosture,
      diagnostic: scorecard.diagnostic,
      authority: "ONTOLOGY_ATTENTION_PROPOSAL_ONLY" as const,
      modelInvocationAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, actionId: hashCanonical(body) });
  }));
  const policyBody = Object.freeze({
    schemaVersion: "pmh.ontology-attention-policy.v1" as const,
    portfolioCaps: PORTFOLIO_CAPS,
    structuralAmbiguitySemanticAuthority: false as const,
    automaticDispatch: false as const,
  });
  const policy = Object.freeze({ ...policyBody, policyIdentity: hashCanonical(policyBody) });
  const actionableIssueCount = scorecards.filter((item) => item.nextActionEligible).length;
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-attention-allocation.v1" as const,
    observedAt: currentRevisions.map((item) => item.materializedAt).sort().at(-1) ??
      "1970-01-01T00:00:00.000Z",
    policy,
    issueCount: scorecards.length,
    actionableIssueCount,
    heldIssueCount: scorecards.length - actionableIssueCount,
    scorecards,
    portfolio,
    laneCounts: Object.freeze({
      evidenceRich: portfolio.filter((item) =>
        item.kind === "EXPLOIT_EVIDENCE_RICH_ISSUE"
      ).length,
      ambiguityProbe: portfolio.filter((item) =>
        item.kind === "PROBE_AMBIGUOUS_ISSUE"
      ).length,
      changedInputRecheck: portfolio.filter((item) =>
        item.kind === "RECHECK_CHANGED_INPUT"
      ).length,
    }),
    omittedActionableIssueCount: Math.max(0, actionableIssueCount - portfolio.length),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "ONTOLOGY_ATTENTION_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
