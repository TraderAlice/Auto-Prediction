import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentTask } from "./agent-execution-substrate.js";
import {
  buildRelationDiscoveryAgentTask,
  buildRelationDiscoveryTaskPayload,
  assertRelationDiscoveryTaskPayload,
  type RelationDiscoveryTaskPayload,
} from "./relation-discovery-agent-tools.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import type { OntologyRelationWorkProjection } from "./ontology-relation-work.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type RelationDiscoveryTaskRevision = Readonly<{
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

export interface RelationDiscoveryTaskRevisionStore {
  readonly relationDiscoveryTaskRevisionStorage:
    OperationalStorageProjection<"revisionId">;
  loadRelationDiscoveryTaskRevisions(limit: number): readonly RelationDiscoveryTaskRevision[];
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
  const payload = assertRelationDiscoveryTaskPayload(revision.taskPayload);
  const task = buildRelationDiscoveryAgentTask({
    payload,
    createdAt: revision.task.createdAt,
  });
  const { revisionId, ...body } = revision;
  if (
    revision.schemaVersion !== "pmh.relation-discovery-task-revision.v1" ||
    ![revisionId, revision.workItemId, revision.workArtifactHash,
      revision.sourceCorpusSnapshotIdentity].every((id) => HASH_PATTERN.test(String(id))) ||
    revisionId !== hashCanonical(body) || task.taskId !== revision.task.taskId ||
    hashCanonical(task) !== hashCanonical(revision.task) ||
    revision.workItemId !== payload.workItem.workItemId ||
    revision.workArtifactHash !== payload.workItem.artifactHash ||
    revision.sourceCorpusSnapshotIdentity !== payload.sourceCorpusSnapshotIdentity ||
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

export function materializeRelationDiscoveryTaskRevisions(input: Readonly<{
  relationWork: OntologyRelationWorkProjection;
  corpus: MarketCorpusSnapshot;
}>): readonly RelationDiscoveryTaskRevision[] {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const runnable = input.relationWork.items.filter((item) =>
    item.disposition === "RUNNABLE_RESEARCH" && item.campaignEligible
  );
  if (runnable.length === 0) return Object.freeze([]);
  const materializedAt = [...corpus.listings].map((item) => item.sourceReceivedAt)
    .sort().at(-1);
  if (materializedAt === undefined) {
    throw new Error("relation discovery source time is unavailable");
  }
  canonicalIso(materializedAt, "relation discovery materializedAt");
  return Object.freeze(runnable.map((workItem) => {
      const taskPayload = buildRelationDiscoveryTaskPayload({ workItem, corpus });
      const task = buildRelationDiscoveryAgentTask({ payload: taskPayload, createdAt: materializedAt });
      const body = Object.freeze({
        schemaVersion: "pmh.relation-discovery-task-revision.v1" as const,
        workItemId: workItem.workItemId,
        workArtifactHash: workItem.artifactHash,
        sourceCorpusSnapshotIdentity: corpus.snapshotIdentity,
        task,
        taskPayload,
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
