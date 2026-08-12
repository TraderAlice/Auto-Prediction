import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentTask } from "./agent-execution-substrate.js";
import {
  buildRelationDiscoveryAgentTask,
  buildRelationDiscoveryRouteSeedTaskPayload,
  buildRelationDiscoveryTaskPayload,
  buildRelationDiscoveryWorkContract,
  assertRelationDiscoveryTaskPayload,
  relationDiscoverySemanticListing,
  type RelationDiscoveryTaskPayload,
  type RelationDiscoveryRouteLayer,
} from "./relation-discovery-agent-tools.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import {
  assertOntologyRelationWorkItem,
  type OntologyRelationWorkItem,
  type OntologyRelationWorkProjection,
} from "./ontology-relation-work.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

type RelationDiscoveryTaskRevisionV1 = Readonly<{
  schemaVersion: "pmh.relation-discovery-task-revision.v1";
  revisionId: Hash;
  workItemId: Hash;
  workArtifactHash: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  task: AgentTask;
  taskPayload: RelationDiscoveryTaskPayload;
  campaignEligible: true;
  materializedAt: string;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

type RelationDiscoveryTaskRevisionV2 = Readonly<
  Omit<RelationDiscoveryTaskRevisionV1, "schemaVersion"> & {
    schemaVersion: "pmh.relation-discovery-task-revision.v2";
    researchInputIdentity: Hash;
  }
>;

type RelationDiscoveryTaskRevisionV3 = Readonly<
  Omit<RelationDiscoveryTaskRevisionV2, "schemaVersion"> & {
    schemaVersion: "pmh.relation-discovery-task-revision.v3";
    workItem: OntologyRelationWorkItem;
  }
>;

type RelationDiscoveryTaskRevisionV4 = Readonly<
  Omit<RelationDiscoveryTaskRevisionV3, "schemaVersion"> & {
    schemaVersion: "pmh.relation-discovery-task-revision.v4";
  }
>;

export type RelationDiscoveryTaskRevision =
  | RelationDiscoveryTaskRevisionV1
  | RelationDiscoveryTaskRevisionV2
  | RelationDiscoveryTaskRevisionV3
  | RelationDiscoveryTaskRevisionV4;

export type RelationDiscoveryTaskReconciliation = Readonly<{
  schemaVersion: "pmh.relation-discovery-task-reconciliation.v1";
  researchInputIdentity: Hash;
  currentRevisions: readonly RelationDiscoveryTaskRevision[];
  createdRevisionIds: readonly Hash[];
  reusedRevisionIds: readonly Hash[];
  missingRetainedCorpusRevisionIds: readonly Hash[];
  reconciliationIdentity: Hash;
  effects: Readonly<{
    providerRequests: 0;
    modelInvocations: 0;
    runs: 0;
    campaigns: 0;
    dispatches: 0;
    externalWrites: 0;
    valueMovingActions: 0;
  }>;
}>;

export interface RelationDiscoveryTaskRevisionStore {
  readonly relationDiscoveryTaskRevisionStorage:
    OperationalStorageProjection<"revisionId">;
  loadRelationDiscoveryTaskRevisions(limit: number): readonly RelationDiscoveryTaskRevision[];
  loadRelationDiscoveryTaskRevisionsForTaskIds(
    taskIds: readonly Hash[],
  ): readonly RelationDiscoveryTaskRevision[];
  loadRelationDiscoveryTaskRevision(
    revisionId: Hash,
  ): RelationDiscoveryTaskRevision | null;
  saveRelationDiscoveryTaskRevisions(
    revisions: readonly RelationDiscoveryTaskRevision[],
  ): readonly RelationDiscoveryTaskRevision[];
  readonly relationDiscoveryCorpusStorage:
    OperationalStorageProjection<"snapshotIdentity">;
  loadRelationDiscoveryCorpus(snapshotIdentity: Hash): MarketCorpusSnapshot | null;
  saveRelationDiscoveryCorpus(corpus: MarketCorpusSnapshot): MarketCorpusSnapshot;
}

function canonicalIso(value: unknown, name: string): string {
  if (typeof value !== "string" || new Date(value).toISOString() !== value) {
    throw new Error(`${name} must be a canonical ISO timestamp`);
  }
  return value;
}

export function assertRelationDiscoveryTaskRevision(
  value: unknown,
): RelationDiscoveryTaskRevision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("relation discovery task revision is malformed");
  }
  const revision = value as RelationDiscoveryTaskRevision;
  const record = value as Readonly<Record<string, unknown>>;
  const payload = assertRelationDiscoveryTaskPayload(revision.taskPayload);
  const task = buildRelationDiscoveryAgentTask({
    payload,
    createdAt: revision.task.createdAt,
  });
  const { revisionId, ...body } = revision;
  if (
    ![
      "pmh.relation-discovery-task-revision.v1",
      "pmh.relation-discovery-task-revision.v2",
      "pmh.relation-discovery-task-revision.v3",
      "pmh.relation-discovery-task-revision.v4",
    ].includes(revision.schemaVersion) ||
    ![revisionId, revision.workItemId, revision.workArtifactHash,
      revision.sourceCorpusSnapshotIdentity].every((id) => HASH_PATTERN.test(String(id))) ||
    (revision.schemaVersion !== "pmh.relation-discovery-task-revision.v1" &&
      !HASH_PATTERN.test(String(revision.researchInputIdentity))) ||
    (revision.schemaVersion === "pmh.relation-discovery-task-revision.v1" &&
      record.researchInputIdentity !== undefined) ||
    (revision.schemaVersion !== "pmh.relation-discovery-task-revision.v3" &&
      revision.schemaVersion !== "pmh.relation-discovery-task-revision.v4" &&
      record.workItem !== undefined) ||
    revisionId !== hashCanonical(body) || task.taskId !== revision.task.taskId ||
    hashCanonical(task) !== hashCanonical(revision.task) ||
    (revision.schemaVersion === "pmh.relation-discovery-task-revision.v3" ||
      revision.schemaVersion === "pmh.relation-discovery-task-revision.v4"
      ? revision.workItemId !== assertOntologyRelationWorkItem(revision.workItem).workItemId ||
        revision.workArtifactHash !== revision.workItem.artifactHash ||
        payload.schemaVersion !== (revision.schemaVersion ===
          "pmh.relation-discovery-task-revision.v3"
          ? "pmh.relation-discovery-task.v3"
          : "pmh.relation-discovery-task.v4") ||
        payload.workContract.workItemId !== revision.workItemId ||
        hashCanonical(buildRelationDiscoveryWorkContract(revision.workItem)) !==
          hashCanonical(payload.workContract)
      : payload.schemaVersion === "pmh.relation-discovery-task.v3" ||
        payload.schemaVersion === "pmh.relation-discovery-task.v4" ||
        revision.workItemId !== payload.workItem.workItemId ||
        revision.workArtifactHash !== payload.workItem.artifactHash) ||
    (revision.schemaVersion === "pmh.relation-discovery-task-revision.v1" &&
      (payload.schemaVersion !== "pmh.relation-discovery-task.v1" ||
        revision.sourceCorpusSnapshotIdentity !== payload.sourceCorpusSnapshotIdentity)) ||
    (revision.schemaVersion === "pmh.relation-discovery-task-revision.v2" &&
      payload.schemaVersion !== "pmh.relation-discovery-task.v2") ||
    revision.campaignEligible !== true ||
    canonicalIso(revision.materializedAt, "relation discovery materializedAt") !==
      revision.materializedAt ||
    revision.automaticDispatch !== false ||
    revision.semanticDecisionAuthority !== false || revision.probabilityAuthority !== false ||
    revision.certificateAuthority !== false || revision.executionAuthority !== false ||
    revision.externalWriteAuthority !== false || revision.valueMovingAuthority !== false
  ) throw new Error("relation discovery task revision violates its bounded contract");
  return Object.freeze(revision);
}

export function relationDiscoveryRevisionWorkItem(
  revisionInput: RelationDiscoveryTaskRevision,
): OntologyRelationWorkItem {
  const revision = assertRelationDiscoveryTaskRevision(revisionInput);
  if (revision.schemaVersion === "pmh.relation-discovery-task-revision.v3" ||
      revision.schemaVersion === "pmh.relation-discovery-task-revision.v4") {
    return revision.workItem;
  }
  const payload = revision.taskPayload;
  if (payload.schemaVersion === "pmh.relation-discovery-task.v3" ||
      payload.schemaVersion === "pmh.relation-discovery-task.v4") {
    throw new Error("legacy relation discovery revision lost its work item");
  }
  return payload.workItem;
}

export function relationDiscoveryResearchInputIdentity(
  corpusInput: MarketCorpusSnapshot,
): Hash {
  const corpus = assertMarketCorpusSnapshot(corpusInput);
  const listings = corpus.listings.map(relationDiscoverySemanticListing);
  return hashCanonical({
    schemaVersion: "pmh.relation-discovery-research-input.v1",
    contentPolicy: corpus.contentPolicy,
    listingCount: listings.length,
    listings,
  });
}

export function materializeRelationDiscoveryTaskRevisions(input: Readonly<{
  relationWork: OntologyRelationWorkProjection;
  corpus: MarketCorpusSnapshot;
}>): readonly RelationDiscoveryTaskRevision[] {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const runnable = input.relationWork.items.filter((item) =>
    item.disposition === "RUNNABLE_RESEARCH" && item.campaignEligible
  );
  if (runnable.length === 0) return Object.freeze([]);
  const researchInputIdentity = relationDiscoveryResearchInputIdentity(corpus);
  const materializedAt = [...corpus.listings].map((item) => item.sourceReceivedAt)
    .sort().at(-1);
  if (materializedAt === undefined) {
    throw new Error("relation discovery source time is unavailable");
  }
  canonicalIso(materializedAt, "relation discovery materializedAt");
  return Object.freeze(runnable.map((workItem) => {
      const taskPayload = buildRelationDiscoveryTaskPayload({ workItem });
      const task = buildRelationDiscoveryAgentTask({
        payload: taskPayload,
        createdAt: workItem.lastProposedAt,
      });
      const body = Object.freeze({
        schemaVersion: "pmh.relation-discovery-task-revision.v3" as const,
        workItemId: workItem.workItemId,
        workArtifactHash: workItem.artifactHash,
        sourceCorpusSnapshotIdentity: corpus.snapshotIdentity,
        researchInputIdentity,
        task,
        taskPayload,
        workItem,
        campaignEligible: true as const,
        materializedAt,
        automaticDispatch: false as const,
        semanticDecisionAuthority: false as const,
        probabilityAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        externalWriteAuthority: false as const,
        valueMovingAuthority: false as const,
      });
      return assertRelationDiscoveryTaskRevision(Object.freeze({
        ...body,
        revisionId: hashCanonical(body),
      }));
    })
    .sort((left, right) => left.workItemId.localeCompare(right.workItemId)));
}

export function materializeStandingRouteSeedTaskRevisions(input: Readonly<{
  selectionIdentity: Hash;
  candidates: readonly Readonly<{
    selectionActionRef: Hash;
    targetRouteLayer: RelationDiscoveryRouteLayer;
    sourceTaskRevisionId: Hash;
  }>[];
  sourceRevisions: readonly RelationDiscoveryTaskRevision[];
  corpus: MarketCorpusSnapshot;
}>): readonly RelationDiscoveryTaskRevision[] {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const sourceById = new Map(input.sourceRevisions.map((revisionInput) => {
    const revision = assertRelationDiscoveryTaskRevision(revisionInput);
    return [revision.revisionId, revision] as const;
  }));
  const materializedAt = [...corpus.listings].map((item) => item.sourceReceivedAt)
    .sort().at(-1);
  if (materializedAt === undefined) {
    throw new Error("standing route seed source time is unavailable");
  }
  canonicalIso(materializedAt, "standing route seed materializedAt");
  return Object.freeze(input.candidates.map((candidate) => {
    const source = sourceById.get(candidate.sourceTaskRevisionId);
    if (source === undefined || source.schemaVersion ===
        "pmh.relation-discovery-task-revision.v4") {
      throw new Error("standing route seed source revision is unavailable or recursive");
    }
    const workItem = relationDiscoveryRevisionWorkItem(source);
    const taskPayload = buildRelationDiscoveryRouteSeedTaskPayload({
      workItem,
      selectionIdentity: input.selectionIdentity,
      selectionActionRef: candidate.selectionActionRef,
      targetRouteLayer: candidate.targetRouteLayer,
    });
    const task = buildRelationDiscoveryAgentTask({
      payload: taskPayload,
      createdAt: workItem.lastProposedAt,
    });
    const body = Object.freeze({
      schemaVersion: "pmh.relation-discovery-task-revision.v4" as const,
      workItemId: workItem.workItemId,
      workArtifactHash: workItem.artifactHash,
      sourceCorpusSnapshotIdentity: corpus.snapshotIdentity,
      researchInputIdentity: relationDiscoveryResearchInputIdentity(corpus),
      task,
      taskPayload,
      workItem,
      campaignEligible: true as const,
      materializedAt,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return assertRelationDiscoveryTaskRevision(Object.freeze({
      ...body,
      revisionId: hashCanonical(body),
    }));
  }).sort((left, right) => left.task.taskId.localeCompare(right.task.taskId)));
}

export function reconcileRelationDiscoveryTaskRevisions(input: Readonly<{
  relationWork: OntologyRelationWorkProjection;
  corpus: MarketCorpusSnapshot;
  retainedRevisions: readonly RelationDiscoveryTaskRevision[];
  loadRetainedCorpus: (snapshotIdentity: Hash) => MarketCorpusSnapshot | null;
}>): RelationDiscoveryTaskReconciliation {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const researchInputIdentity = relationDiscoveryResearchInputIdentity(corpus);
  const candidates = materializeRelationDiscoveryTaskRevisions({
    relationWork: input.relationWork,
    corpus,
  });
  const retained = input.retainedRevisions.map(assertRelationDiscoveryTaskRevision);
  const missing = new Set<Hash>();
  const retainedIdentity = new Map<Hash, Hash | null>();
  const identityFor = (revision: RelationDiscoveryTaskRevision): Hash | null => {
    if (revision.schemaVersion !== "pmh.relation-discovery-task-revision.v1") {
      return revision.researchInputIdentity;
    }
    if (retainedIdentity.has(revision.revisionId)) {
      return retainedIdentity.get(revision.revisionId) ?? null;
    }
    const retainedCorpus = input.loadRetainedCorpus(
      revision.sourceCorpusSnapshotIdentity,
    );
    const identity = retainedCorpus === null
      ? null
      : relationDiscoveryResearchInputIdentity(retainedCorpus);
    retainedIdentity.set(revision.revisionId, identity);
    if (identity === null) missing.add(revision.revisionId);
    return identity;
  };
  const createdRevisionIds: Hash[] = [];
  const reusedRevisionIds: Hash[] = [];
  const currentRevisions = candidates.map((candidate) => {
    const sameWork = retained.filter((revision) =>
      revision.schemaVersion !== "pmh.relation-discovery-task-revision.v4" &&
      revision.workItemId === candidate.workItemId &&
      revision.workArtifactHash === candidate.workArtifactHash
    );
    const reusable = sameWork.find((revision) =>
      revision.schemaVersion !== "pmh.relation-discovery-task-revision.v1" &&
      identityFor(revision) === researchInputIdentity
    ) ?? sameWork.find((revision) =>
      revision.schemaVersion === "pmh.relation-discovery-task-revision.v1" &&
      identityFor(revision) === researchInputIdentity
    );
    if (reusable !== undefined) {
      reusedRevisionIds.push(reusable.revisionId);
      return reusable;
    }
    createdRevisionIds.push(candidate.revisionId);
    return candidate;
  }).sort((left, right) => left.workItemId.localeCompare(right.workItemId));
  const body = Object.freeze({
    schemaVersion: "pmh.relation-discovery-task-reconciliation.v1" as const,
    researchInputIdentity,
    currentRevisions: Object.freeze(currentRevisions),
    createdRevisionIds: Object.freeze(createdRevisionIds.sort()),
    reusedRevisionIds: Object.freeze(reusedRevisionIds.sort()),
    missingRetainedCorpusRevisionIds: Object.freeze([...missing].sort()),
    effects: Object.freeze({
      providerRequests: 0 as const,
      modelInvocations: 0 as const,
      runs: 0 as const,
      campaigns: 0 as const,
      dispatches: 0 as const,
      externalWrites: 0 as const,
      valueMovingActions: 0 as const,
    }),
  });
  return Object.freeze({
    ...body,
    reconciliationIdentity: hashCanonical(body),
  });
}
