import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildAgentTask,
  type AgentExecutionSnapshot,
  type AgentTask,
} from "./agent-execution-substrate.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import {
  assertMarketOntologyNormalizationTaskPayload,
  createMarketOntologyNormalizationTaskPayloadBuilder,
  MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL,
  MARKET_ONTOLOGY_NORMALIZATION_TASK_PROTOCOL,
  type MarketOntologyAgentProposal,
  type MarketOntologyNormalizationTaskPayload,
} from "./market-ontology-agent-tools.js";
import {
  assertMarketOntologySnapshot,
  type MarketOntologySnapshot,
  type MarketOntologyTrailhead,
} from "./market-ontology.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_MATERIALIZED_ISSUES = 64;
const MAX_TRAILHEADS_PER_ISSUE = 8;
const LANE_TARGETS = Object.freeze({
  CROSS_VENUE: 24,
  WORLD_DIVERGENCE: 24,
  SETTLEMENT_DIVERGENCE: 16,
} as const);

export type OntologySearchCoverageState =
  | "UNEXPLORED"
  | "PROPOSAL_RECORDED"
  | "COUNTEREXAMPLE_RECORDED"
  | "MIXED_EVIDENCE";

export type OntologySearchIssueRevision = Readonly<{
  schemaVersion: "pmh.ontology-search-issue-revision.v1";
  revisionId: Hash;
  issueId: Hash;
  relationPatternId: Hash;
  selectionLane: MarketOntologyTrailhead["selectionLane"];
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  trailheadIds: readonly Hash[];
  task: AgentTask;
  taskPayload: MarketOntologyNormalizationTaskPayload;
  coverageState: OntologySearchCoverageState;
  matchedProposalIds: readonly Hash[];
  priority: 1 | 2 | 3 | 4 | 5;
  campaignEligible: boolean;
  automaticDispatch: false;
  materializedAt: string;
  authority: "SEARCH_WORK_ASSIGNMENT_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface OntologySearchIssueRevisionStore {
  readonly ontologySearchIssueRevisionStorage:
    OperationalStorageProjection<"revisionId">;
  loadOntologySearchIssueRevisions(limit: number): readonly OntologySearchIssueRevision[];
  saveOntologySearchIssueRevisions(
    revisions: readonly OntologySearchIssueRevision[],
  ): readonly OntologySearchIssueRevision[];
}

function lanePriority(
  lane: MarketOntologyTrailhead["selectionLane"],
): 3 | 4 | 5 {
  if (lane === "WORLD_DIVERGENCE") return 5;
  if (lane === "CROSS_VENUE") return 4;
  return 3;
}

function materializedAt(ontology: MarketOntologySnapshot): string {
  const latest = ontology.nodes.map((item) => item.settlementFacet.sourceReceivedAt)
    .sort().at(-1);
  if (latest === undefined || !Number.isFinite(Date.parse(latest))) {
    throw new Error("ontology search issue source time is unavailable");
  }
  return latest;
}

function coverageState(
  proposals: readonly MarketOntologyAgentProposal[],
): OntologySearchCoverageState {
  const counterexample = proposals.some((item) => item.kind === "COUNTEREXAMPLE");
  const positive = proposals.some((item) => item.kind !== "COUNTEREXAMPLE");
  if (counterexample && positive) return "MIXED_EVIDENCE";
  if (counterexample) return "COUNTEREXAMPLE_RECORDED";
  if (positive) return "PROPOSAL_RECORDED";
  return "UNEXPLORED";
}

export function materializeOntologySearchIssueRevisions(input: Readonly<{
  ontology: MarketOntologySnapshot;
  corpus: MarketCorpusSnapshot;
  proposals: readonly MarketOntologyAgentProposal[];
}>): readonly OntologySearchIssueRevision[] {
  const ontology = assertMarketOntologySnapshot(input.ontology);
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  if (ontology.sourceSnapshotIdentity !== corpus.snapshotIdentity) {
    throw new Error("ontology search issue materialization corpus lineage is inconsistent");
  }
  const buildTaskPayload = createMarketOntologyNormalizationTaskPayloadBuilder({
    ontology,
    corpus,
  });
  const proposalsByTrailhead = new Map<Hash, MarketOntologyAgentProposal[]>();
  for (const proposal of input.proposals) {
    for (const trailheadId of proposal.sourceTrailheadIds) {
      const values = proposalsByTrailhead.get(trailheadId) ?? [];
      values.push(proposal);
      proposalsByTrailhead.set(trailheadId, values);
    }
  }
  const trailheadsByLaneAndPattern = new Map<string, MarketOntologyTrailhead[]>();
  for (const trailhead of ontology.trailheads) {
    const key = `${trailhead.selectionLane}:${trailhead.relationPatternId}`;
    const values = trailheadsByLaneAndPattern.get(key) ?? [];
    values.push(trailhead);
    trailheadsByLaneAndPattern.set(key, values);
  }
  const rankedGroups = [...trailheadsByLaneAndPattern.values()].map((trailheads) => {
    const patternId = trailheads[0]!.relationPatternId;
    const lane = trailheads[0]!.selectionLane;
    const matched = Object.freeze([...new Map(trailheads
      .flatMap((item) => proposalsByTrailhead.get(item.trailheadId) ?? [])
      .map((item) => [item.proposalId, item] as const)).values()]
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId)));
    const state = coverageState(matched);
    return Object.freeze({ patternId, trailheads, matched, state, lane });
  }).sort((left, right) =>
    (left.state === "UNEXPLORED" ? 0 : 1) - (right.state === "UNEXPLORED" ? 0 : 1) ||
    lanePriority(right.lane) - lanePriority(left.lane) ||
    Math.max(...right.trailheads.map((item) => item.score)) -
      Math.max(...left.trailheads.map((item) => item.score)) ||
    left.patternId.localeCompare(right.patternId)
  );
  const selectedGroups = Object.freeze(([
    ...rankedGroups.filter((item) => item.lane === "CROSS_VENUE")
      .slice(0, LANE_TARGETS.CROSS_VENUE),
    ...rankedGroups.filter((item) => item.lane === "WORLD_DIVERGENCE")
      .slice(0, LANE_TARGETS.WORLD_DIVERGENCE),
    ...rankedGroups.filter((item) => item.lane === "SETTLEMENT_DIVERGENCE")
      .slice(0, LANE_TARGETS.SETTLEMENT_DIVERGENCE),
  ]).slice(0, MAX_MATERIALIZED_ISSUES));
  const selectedKeys = new Set(selectedGroups.map((item) => `${item.lane}:${item.patternId}`));
  const groups = Object.freeze([
    ...selectedGroups,
    ...rankedGroups.filter((item) => !selectedKeys.has(`${item.lane}:${item.patternId}`)),
  ].slice(0, MAX_MATERIALIZED_ISSUES));
  if (groups.length === 0) return Object.freeze([]);
  const sourceTime = materializedAt(ontology);

  return Object.freeze(groups.map((group) => {
    const selectedTrailheads = Object.freeze([...group.trailheads]
      .sort((left, right) => right.score - left.score ||
        left.trailheadId.localeCompare(right.trailheadId))
      .slice(0, MAX_TRAILHEADS_PER_ISSUE));
    const taskPayload = buildTaskPayload(
      selectedTrailheads.map((item) => item.trailheadId),
    );
    const issueId = hashCanonical(Object.freeze({
      schemaVersion: "pmh.ontology-search-issue.v1",
      relationPatternId: group.patternId,
      selectionLane: group.lane,
      objective: taskPayload.objective,
    }));
    const task = buildAgentTask({
      kind: "ONTOLOGY_NORMALIZATION",
      protocol: MARKET_ONTOLOGY_NORMALIZATION_TASK_PROTOCOL,
      inputArtifacts: [{
        kind: "MARKET_ONTOLOGY",
        artifactId: ontology.ontologyIdentity,
        artifactHash: ontology.ontologyIdentity,
      }],
      taskPayload,
      requestedEffectProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL,
      provenanceRef: `ontology-issue:${issueId}`,
      priority: lanePriority(group.lane) * 100,
      createdAt: sourceTime,
    });
    const body = Object.freeze({
      schemaVersion: "pmh.ontology-search-issue-revision.v1" as const,
      issueId,
      relationPatternId: group.patternId,
      selectionLane: group.lane,
      ontologyIdentity: ontology.ontologyIdentity,
      sourceSnapshotIdentity: ontology.sourceSnapshotIdentity,
      trailheadIds: taskPayload.trailheadIds,
      task,
      taskPayload,
      coverageState: group.state,
      matchedProposalIds: Object.freeze(group.matched.map((item) => item.proposalId)),
      priority: lanePriority(group.lane),
      campaignEligible: group.state === "UNEXPLORED",
      automaticDispatch: false as const,
      materializedAt: sourceTime,
      authority: "SEARCH_WORK_ASSIGNMENT_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, revisionId: hashCanonical(body) });
  }));
}

export function assertOntologySearchIssueRevision(
  value: unknown,
): OntologySearchIssueRevision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ontology search issue revision is malformed");
  }
  const revision = value as OntologySearchIssueRevision;
  assertMarketOntologyNormalizationTaskPayload(revision.taskPayload);
  const { revisionId, ...body } = revision;
  if (
    revision.schemaVersion !== "pmh.ontology-search-issue-revision.v1" ||
    !HASH_PATTERN.test(String(revisionId)) || revisionId !== hashCanonical(body) ||
    !HASH_PATTERN.test(String(revision.issueId)) ||
    !HASH_PATTERN.test(String(revision.relationPatternId)) ||
    !HASH_PATTERN.test(String(revision.ontologyIdentity)) ||
    !HASH_PATTERN.test(String(revision.sourceSnapshotIdentity)) ||
    !Array.isArray(revision.trailheadIds) || revision.trailheadIds.length === 0 ||
    revision.trailheadIds.length > MAX_TRAILHEADS_PER_ISSUE ||
    revision.task.kind !== "ONTOLOGY_NORMALIZATION" ||
    revision.task.taskPayloadHash !== hashCanonical(revision.taskPayload) ||
    revision.taskPayload.ontologyIdentity !== revision.ontologyIdentity ||
    revision.taskPayload.sourceSnapshotIdentity !== revision.sourceSnapshotIdentity ||
    revision.task.requestedEffectProtocol !== MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL ||
    !["UNEXPLORED", "PROPOSAL_RECORDED", "COUNTEREXAMPLE_RECORDED", "MIXED_EVIDENCE"]
      .includes(revision.coverageState) ||
    revision.campaignEligible !== (revision.coverageState === "UNEXPLORED") ||
    revision.automaticDispatch !== false ||
    !Number.isFinite(Date.parse(revision.materializedAt)) ||
    revision.authority !== "SEARCH_WORK_ASSIGNMENT_ONLY" ||
    revision.semanticDecisionAuthority !== false || revision.probabilityAuthority !== false ||
    revision.certificateAuthority !== false || revision.executionAuthority !== false ||
    revision.externalWriteAuthority !== false || revision.valueMovingAuthority !== false
  ) throw new Error("ontology search issue revision violates its bounded contract");
  return revision;
}

export type OntologySearchYieldProjection = Readonly<{
  schemaVersion: "pmh.ontology-search-yield.v1";
  projectionIdentity: Hash;
  issueCount: number;
  campaignEligibleIssueCount: number;
  attemptedIssueCount: number;
  proposalCoveredIssueCount: number;
  counterexampleCoveredIssueCount: number;
  relationPatternCoverageBps: number | null;
  runCount: number;
  succeededRunCount: number;
  failedOrInterruptedRunCount: number;
  modelInvocationCount: number;
  acceptedToolEffectCount: number;
  rejectedToolEffectCount: number;
  proposalCounts: Readonly<{
    entityAlias: number;
    worldProposition: number;
    counterexample: number;
  }>;
  usage: Readonly<{
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownInputInvocationCount: number;
    unknownOutputInvocationCount: number;
    unknownReasoningInvocationCount: number;
  }>;
  downstreamOpportunityAttribution: "NOT_YET_CONNECTED";
  byIssue: readonly Readonly<{
    issueId: Hash;
    revisionId: Hash;
    relationPatternId: Hash;
    selectionLane: MarketOntologyTrailhead["selectionLane"];
    coverageState: OntologySearchCoverageState;
    runCount: number;
    proposalCount: number;
    counterexampleCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
  }>[];
  authority: "DERIVED_RESEARCH_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export function buildOntologySearchYieldProjection(input: Readonly<{
  revisions: readonly OntologySearchIssueRevision[];
  proposals: readonly MarketOntologyAgentProposal[];
  execution: AgentExecutionSnapshot;
}>): OntologySearchYieldProjection {
  const latestByIssue = new Map<Hash, OntologySearchIssueRevision>();
  for (const raw of input.revisions) {
    const revision = assertOntologySearchIssueRevision(raw);
    const current = latestByIssue.get(revision.issueId);
    if (current === undefined || revision.materializedAt > current.materializedAt ||
        (revision.materializedAt === current.materializedAt &&
          revision.revisionId > current.revisionId)) latestByIssue.set(revision.issueId, revision);
  }
  const revisions = Object.freeze([...latestByIssue.values()].sort((left, right) =>
    right.priority - left.priority || left.issueId.localeCompare(right.issueId)
  ));
  const runIdsByTask = new Map<Hash, Set<Hash>>();
  for (const run of input.execution.runs) {
    const ids = runIdsByTask.get(run.taskId) ?? new Set<Hash>();
    ids.add(run.runId);
    runIdsByTask.set(run.taskId, ids);
  }
  const byIssue = Object.freeze(revisions.map((revision) => {
    const runIds = runIdsByTask.get(revision.task.taskId) ?? new Set<Hash>();
    const invocations = input.execution.modelInvocations.filter((item) => runIds.has(item.runId));
    const proposals = input.proposals.filter((item) =>
      item.sourceRelationPatternIds.includes(revision.relationPatternId)
    );
    return Object.freeze({
      issueId: revision.issueId,
      revisionId: revision.revisionId,
      relationPatternId: revision.relationPatternId,
      selectionLane: revision.selectionLane,
      coverageState: coverageState(proposals),
      runCount: runIds.size,
      proposalCount: proposals.filter((item) => item.kind !== "COUNTEREXAMPLE").length,
      counterexampleCount: proposals.filter((item) => item.kind === "COUNTEREXAMPLE").length,
      knownInputTokens: invocations.reduce((sum, item) =>
        sum + BigInt(item.inputTokens ?? "0"), 0n).toString(),
      knownOutputTokens: invocations.reduce((sum, item) =>
        sum + BigInt(item.outputTokens ?? "0"), 0n).toString(),
    });
  }));
  const taskIds = new Set(revisions.map((item) => item.task.taskId));
  const runs = input.execution.runs.filter((item) => taskIds.has(item.taskId));
  const runIds = new Set(runs.map((item) => item.runId));
  const invocations = input.execution.modelInvocations.filter((item) => runIds.has(item.runId));
  const effects = input.execution.toolEffects.filter((item) => runIds.has(item.runId));
  const patternIds = new Set(revisions.map((item) => item.relationPatternId));
  const proposals = input.proposals.filter((item) =>
    item.sourceRelationPatternIds.some((id) => patternIds.has(id))
  );
  const coveredPatterns = new Set(proposals.flatMap((item) => item.sourceRelationPatternIds)
    .filter((id) => patternIds.has(id)));
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-search-yield.v1" as const,
    issueCount: revisions.length,
    campaignEligibleIssueCount: revisions.filter((item) => item.campaignEligible).length,
    attemptedIssueCount: byIssue.filter((item) => item.runCount > 0).length,
    proposalCoveredIssueCount: byIssue.filter((item) => item.proposalCount > 0).length,
    counterexampleCoveredIssueCount: byIssue.filter((item) => item.counterexampleCount > 0).length,
    relationPatternCoverageBps: revisions.length === 0
      ? null
      : Math.floor((coveredPatterns.size * 10_000) / revisions.length),
    runCount: runs.length,
    succeededRunCount: runs.filter((item) => item.status === "SUCCEEDED").length,
    failedOrInterruptedRunCount: runs.filter((item) =>
      ["FAILED", "INTERRUPTED", "CANCELLED"].includes(item.status)
    ).length,
    modelInvocationCount: invocations.length,
    acceptedToolEffectCount: effects.filter((item) => item.status === "ACCEPTED").length,
    rejectedToolEffectCount: effects.filter((item) => item.status === "REJECTED").length,
    proposalCounts: Object.freeze({
      entityAlias: proposals.filter((item) => item.kind === "ENTITY_ALIAS").length,
      worldProposition: proposals.filter((item) => item.kind === "WORLD_PROPOSITION").length,
      counterexample: proposals.filter((item) => item.kind === "COUNTEREXAMPLE").length,
    }),
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
    }),
    downstreamOpportunityAttribution: "NOT_YET_CONNECTED" as const,
    byIssue,
    authority: "DERIVED_RESEARCH_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      providerRequests: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
