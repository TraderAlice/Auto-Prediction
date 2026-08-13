import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertAgentCampaignSelectionBinding,
  buildAgentTask,
  type AgentCampaignSelectionBinding,
  type AgentExecutionSnapshot,
  type AgentTask,
  type ExecutionProfile,
  type WorkloadRoute,
} from "./agent-execution-substrate.js";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import { buildSearchScopeIdentity } from "./search-scope-identity.js";
import {
  assertSettlementProjection,
  assertWorldRelationExperiment,
  type SettlementProjection,
  type WorldRelationExperiment,
} from "./world-history-ontology.js";
import type { WorldRelationFrontierSeed } from
  "./world-history-ontology-adapter.js";
import { WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL } from
  "./world-relation-agent-tools.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH = /^sha256:[0-9a-f]{64}$/u;
export const WORLD_RELATION_EXPERIMENT_TASK_PROTOCOL =
  "WORLD_RELATION_EXPERIMENT_TASK_V1" as const;
export const WORLD_RELATION_EXPERIMENT_SELECTION_PROTOCOL =
  "WORLD_RELATION_EXPERIMENT_SELECTION_V1" as const;

export type WorldRelationExperimentInputRevision = Readonly<{
  schemaVersion: "pmh.world-relation-experiment-input.v1";
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  frontier: WorldRelationFrontierSeed;
  corpusSnapshotIdentity: Hash;
  corpusSemanticIdentity: Hash;
  sourceSetIdentity: Hash;
  settlementProjectionArtifactHashes: readonly Hash[];
  priorExperimentArtifactHashes: readonly Hash[];
  materializedAt: string;
  inputBinding: "EXACT_FRONTIER_CORPUS_PROJECTIONS_AND_NEGATIVE_MEMORY";
  authority: "WORLD_RELATION_EXPERIMENT_INPUT_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldRelationExperimentTaskPayload = Readonly<{
  schemaVersion: "pmh.world-relation-experiment-task.v1";
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  frontierId: Hash;
  corpusSnapshotIdentity: Hash;
  objective: "FALSIFY_OR_BOUND_ONE_WORLD_RELATION_FRONTIER";
  terminalAuthority: "RESEARCH_MEMORY_ONLY";
  automaticDispatch: false;
}>;

export type WorldRelationExperimentAssignment = Readonly<{
  inputRevision: WorldRelationExperimentInputRevision;
  taskPayload: WorldRelationExperimentTaskPayload;
  task: AgentTask;
  corpus: MarketCorpusSnapshot;
  projections: readonly SettlementProjection[];
  priorExperiments: readonly WorldRelationExperiment[];
}>;

export type WorldRelationExperimentCampaignPreview = Readonly<{
  schemaVersion: "pmh.world-relation-experiment-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  inputRevisionIds: readonly Hash[];
  frontierIds: readonly Hash[];
  taskIds: readonly Hash[];
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE";
  budget: Readonly<{ maximumConcurrentRuns: 1; maximumModelInvocations: 12;
    maximumInputTokens: "300000"; maximumOutputTokens: "30000";
    maximumWallClockMs: 600000 }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
}>;

export interface WorldRelationExperimentInputStore {
  readonly worldRelationExperimentInputStorage:
    OperationalStorageProjection<"inputRevisionId">;
  readonly worldRelationExperimentCorpusStorage:
    OperationalStorageProjection<"snapshotIdentity">;
  loadWorldRelationExperimentInputs(
    limit: number,
  ): readonly WorldRelationExperimentInputRevision[];
  loadWorldRelationExperimentInput(
    inputRevisionId: Hash,
  ): WorldRelationExperimentInputRevision | null;
  saveWorldRelationExperimentInputs(
    inputs: readonly WorldRelationExperimentInputRevision[],
  ): readonly WorldRelationExperimentInputRevision[];
  loadWorldRelationExperimentCorpus(
    snapshotIdentity: Hash,
  ): MarketCorpusSnapshot | null;
  saveWorldRelationExperimentCorpus(
    corpus: MarketCorpusSnapshot,
  ): MarketCorpusSnapshot;
}

function exactHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

function latestObservation(corpus: MarketCorpusSnapshot): string {
  return [...corpus.listings].map((item) => item.sourceReceivedAt).sort().at(-1) ??
    "1970-01-01T00:00:00.000Z";
}

export function buildWorldRelationExperimentAssignment(input: Readonly<{
  frontier: WorldRelationFrontierSeed;
  corpus: MarketCorpusSnapshot;
  projections?: readonly SettlementProjection[];
  priorExperiments?: readonly WorldRelationExperiment[];
}>): WorldRelationExperimentAssignment {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const projections = Object.freeze((input.projections ?? [])
    .map(assertSettlementProjection)
    .filter((item) => input.frontier.predicates.some((predicate) =>
      item.predicateIds.includes(predicate.predicateId)
    )).sort((left, right) => left.artifactHash.localeCompare(right.artifactHash)));
  const predicateIds = new Set(input.frontier.predicates.map((item) => item.predicateId));
  const priorExperiments = Object.freeze((input.priorExperiments ?? [])
    .map(assertWorldRelationExperiment)
    .filter((item) => item.predicateIds.some((predicateId) => predicateIds.has(predicateId)))
    .sort((left, right) => right.closedAt.localeCompare(left.closedAt) ||
      right.artifactHash.localeCompare(left.artifactHash)).slice(0, 8));
  const corpusSemanticIdentity = buildSearchScopeIdentity(corpus.listings)
    .semanticScopeIdentity;
  const semanticInputIdentity = hashCanonical({
    schemaVersion: "pmh.world-relation-experiment-semantic-input.v1",
    frontierId: input.frontier.frontierId,
    corpusSemanticIdentity,
    settlementProjectionIds: exactHashes(projections.map((item) => item.projectionId)),
    priorTerminalMemory: priorExperiments.map((item) => ({
      experimentId: item.experimentId,
      terminalDisposition: item.terminalDisposition,
      counterworldResults: item.counterworlds.map((counterworld) => counterworld.result),
    })),
  });
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-experiment-input.v1" as const,
    semanticInputIdentity,
    frontier: input.frontier,
    corpusSnapshotIdentity: corpus.snapshotIdentity,
    corpusSemanticIdentity,
    sourceSetIdentity: corpus.sourceSetIdentity,
    settlementProjectionArtifactHashes: exactHashes(projections.map((item) => item.artifactHash)),
    priorExperimentArtifactHashes: exactHashes(priorExperiments.map((item) => item.artifactHash)),
    materializedAt: latestObservation(corpus),
    inputBinding: "EXACT_FRONTIER_CORPUS_PROJECTIONS_AND_NEGATIVE_MEMORY" as const,
    authority: "WORLD_RELATION_EXPERIMENT_INPUT_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const,
  });
  const inputRevision = Object.freeze({ ...body, inputRevisionId: hashCanonical(body) });
  const taskPayload = worldRelationExperimentTaskPayload(inputRevision);
  const task = buildWorldRelationExperimentTask(inputRevision);
  return Object.freeze({ inputRevision, taskPayload, task, corpus, projections,
    priorExperiments });
}

export function worldRelationExperimentTaskPayload(
  input: WorldRelationExperimentInputRevision,
): WorldRelationExperimentTaskPayload {
  const revision = assertWorldRelationExperimentInputRevision(input);
  return Object.freeze({
    schemaVersion: "pmh.world-relation-experiment-task.v1" as const,
    inputRevisionId: revision.inputRevisionId,
    semanticInputIdentity: revision.semanticInputIdentity,
    frontierId: revision.frontier.frontierId,
    corpusSnapshotIdentity: revision.corpusSnapshotIdentity,
    objective: "FALSIFY_OR_BOUND_ONE_WORLD_RELATION_FRONTIER" as const,
    terminalAuthority: "RESEARCH_MEMORY_ONLY" as const,
    automaticDispatch: false as const,
  });
}

export function buildWorldRelationExperimentTask(
  input: WorldRelationExperimentInputRevision,
): AgentTask {
  const revision = assertWorldRelationExperimentInputRevision(input);
  const taskPayload = worldRelationExperimentTaskPayload(revision);
  return buildAgentTask({
    kind: "WORLD_RELATION_EXPERIMENT",
    protocol: WORLD_RELATION_EXPERIMENT_TASK_PROTOCOL,
    inputArtifacts: [{ kind: "WORLD_RELATION_FRONTIER",
      artifactId: revision.frontier.frontierId, artifactHash: revision.frontier.artifactHash },
    { kind: "MARKET_CORPUS", artifactId: revision.corpusSnapshotIdentity,
      artifactHash: revision.corpusSnapshotIdentity },
    ...revision.settlementProjectionArtifactHashes.map((artifactHash) => ({
      kind: "SETTLEMENT_PROJECTION", artifactId: artifactHash, artifactHash,
    }))],
    taskPayload,
    requestedEffectProtocol: WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL,
    provenanceRef: `world-relation-semantic:${revision.semanticInputIdentity.slice(7)}`,
    priority: revision.priorExperimentArtifactHashes.length === 0 ? 650 : 550,
    createdAt: revision.materializedAt,
  });
}

export function assertWorldRelationExperimentInputRevision(
  value: unknown,
): WorldRelationExperimentInputRevision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("world relation experiment input is malformed");
  }
  const revision = value as WorldRelationExperimentInputRevision;
  const { inputRevisionId, ...body } = revision;
  if (revision.schemaVersion !== "pmh.world-relation-experiment-input.v1" ||
      !HASH.test(String(inputRevisionId)) || inputRevisionId !== hashCanonical(body) ||
      ![revision.semanticInputIdentity, revision.frontier.frontierId,
        revision.frontier.artifactHash, revision.corpusSnapshotIdentity,
        revision.corpusSemanticIdentity, revision.sourceSetIdentity]
        .every((item) => HASH.test(String(item))) ||
      revision.settlementProjectionArtifactHashes.join("\n") !==
        exactHashes(revision.settlementProjectionArtifactHashes).join("\n") ||
      revision.priorExperimentArtifactHashes.join("\n") !==
        exactHashes(revision.priorExperimentArtifactHashes).join("\n") ||
      !Number.isFinite(Date.parse(revision.materializedAt)) ||
      new Date(revision.materializedAt).toISOString() !== revision.materializedAt ||
      revision.inputBinding !== "EXACT_FRONTIER_CORPUS_PROJECTIONS_AND_NEGATIVE_MEMORY" ||
      revision.authority !== "WORLD_RELATION_EXPERIMENT_INPUT_ONLY" ||
      revision.semanticDecisionAuthority !== false || revision.probabilityAuthority !== false ||
      revision.certificateAuthority !== false || revision.executionAuthority !== false ||
      revision.externalWriteAuthority !== false || revision.valueMovingAuthority !== false) {
    throw new Error("world relation experiment input violates its bounded contract");
  }
  return Object.freeze(revision);
}

export function selectWorldRelationExperimentAssignments(input: Readonly<{
  assignments: readonly WorldRelationExperimentAssignment[];
  execution: AgentExecutionSnapshot;
}>): readonly WorldRelationExperimentAssignment[] {
  const attempted = new Set(input.execution.runs.filter((item) => item.status !== "PREPARED")
    .flatMap((run) => input.execution.tasks.filter((task) => task.taskId === run.taskId)
      .map((task) => task.provenanceRef)));
  return Object.freeze([...input.assignments]
    .filter((item) => !attempted.has(item.task.provenanceRef))
    .sort((left, right) => right.task.priority - left.task.priority ||
      left.inputRevision.semanticInputIdentity.localeCompare(
        right.inputRevision.semanticInputIdentity
      )).slice(0, 1));
}

export function buildWorldRelationExperimentSelectionBinding(
  assignments: readonly WorldRelationExperimentAssignment[],
): AgentCampaignSelectionBinding {
  const policy = Object.freeze({
    schemaVersion: "pmh.world-relation-experiment-selection-policy.v1",
    maximumTasksPerCampaign: 1,
    maximumConcurrentRuns: 1,
    oncePerExactInput: true,
    automaticDispatch: false,
  });
  const bindings = assignments.map((item) => Object.freeze({
    taskId: item.task.taskId,
    workFamilyRef: `world-relation-frontier:${item.inputRevision.frontier.frontierId}`,
    selectionActionRef: item.inputRevision.inputRevisionId,
    selectionActionKind: "FALSIFY_WORLD_RELATION_FRONTIER",
    inputRevisionKind: "WORLD_RELATION_EXPERIMENT_INPUT",
    inputRevisionId: item.inputRevision.inputRevisionId,
    exactInputHash: hashCanonical(item.inputRevision),
    semanticInputIdentity: item.inputRevision.semanticInputIdentity,
  })).sort((left, right) => left.taskId.localeCompare(right.taskId));
  return assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: WORLD_RELATION_EXPERIMENT_SELECTION_PROTOCOL,
    selectionIdentity: hashCanonical(bindings),
    selectionPolicyIdentity: hashCanonical(policy),
    taskBindings: Object.freeze(bindings),
  }));
}

export function buildWorldRelationExperimentCampaignPreview(input: Readonly<{
  assignments: readonly WorldRelationExperimentAssignment[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): WorldRelationExperimentCampaignPreview {
  const workloadRoute = [...input.execution.workloadRoutes]
    .filter((item) => item.taskKind === "WORLD_RELATION_EXPERIMENT")
    .sort((left, right) => right.revision - left.revision ||
      right.updatedAt.localeCompare(left.updatedAt))[0];
  if (workloadRoute === undefined) {
    throw new Error("world relation experiment workload route is unavailable");
  }
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined || executionProfile.toolPolicy.protocol !==
      WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL) {
    throw new Error("world relation experiment execution profile is unavailable");
  }
  if (input.capability.executionProfileId !== executionProfile.executionProfileId) {
    throw new Error("world relation experiment capability lineage is inconsistent");
  }
  const selected = selectWorldRelationExperimentAssignments({
    assignments: input.assignments, execution: input.execution,
  });
  const selectionBinding = buildWorldRelationExperimentSelectionBinding(selected);
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-experiment-campaign-preview.v1" as const,
    campaignKey: `world-relation-experiment-${selectionBinding.selectionIdentity.slice(7, 27)}`,
    workloadRoute, executionProfile, capability: input.capability, selectionBinding,
    inputRevisionIds: Object.freeze(selected.map((item) => item.inputRevision.inputRevisionId)),
    frontierIds: Object.freeze(selected.map((item) => item.inputRevision.frontier.frontierId)),
    taskIds: Object.freeze(selected.map((item) => item.task.taskId)),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE" as const,
    budget: Object.freeze({ maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 12 as const, maximumInputTokens: "300000" as const,
      maximumOutputTokens: "30000" as const, maximumWallClockMs: 600000 as const }),
    creationEligible: selected.length > 0,
    dispatchEligible: selected.length > 0 &&
      input.capability.dispatchEligibility === "ELIGIBLE",
    diagnostic: selected.length === 0
      ? "No unattempted world-relation semantic input is eligible"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
        ? input.capability.diagnostic
        : "One exact world-relation experiment awaits explicit campaign activation",
    providerRequestsStarted: 0 as const, modelInvocationsStarted: 0 as const,
    automaticDispatch: false as const, authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
