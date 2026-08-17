import { hashCanonical, type Hash } from "@pmh/domain";
import type { OperationalStorageProjection } from "./types.js";

const HASH = /^sha256:[0-9a-f]{64}$/u;

export type WorldRelationTerminalCounterworld = Readonly<{
  description: string;
  truthByPredicateId: Readonly<Record<Hash, boolean>>;
  outcome: "REJECTED" | "SURVIVES" | "INCONCLUSIVE";
  outcomeDescription: string;
}>;

export type WorldRelationExperimentCheckpoint = Readonly<{
  schemaVersion: "pmh.world-relation-experiment-checkpoint.v1";
  checkpointId: Hash;
  inputRevisionId: Hash;
  frontierId: Hash;
  frontierArtifactHash: Hash;
  corpusSnapshotIdentity: Hash;
  sourceAgentRunId: Hash;
  sourceToolEffectIds: readonly Hash[];
  invocationIds: readonly Hash[];
  usage: Readonly<{
    inputTokens: string;
    outputTokens: string;
    reasoningTokens: string;
  }>;
  searchNeighborhoods: readonly string[];
  inspectedListingRefs: readonly string[];
  counterworld: WorldRelationTerminalCounterworld | null;
  terminalDisposition:
    | "SUPPORTED_HARD"
    | "SUPPORTED_PROBABILISTIC"
    | "FALSIFIED"
    | "EXHAUSTED"
    | "UNRESOLVED";
  rationale: string;
  closedAt: string;
  authority: "FIRST_PARTY_REPLAYABLE_TOOL_HOST_STATE";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface WorldRelationExperimentCheckpointStore {
  readonly worldRelationExperimentCheckpointStorage:
    OperationalStorageProjection<"checkpointId">;
  loadWorldRelationExperimentCheckpoints(
    limit: number,
  ): readonly WorldRelationExperimentCheckpoint[];
  saveWorldRelationExperimentCheckpoints(
    checkpoints: readonly WorldRelationExperimentCheckpoint[],
  ): readonly WorldRelationExperimentCheckpoint[];
}

const exact = <T extends string>(values: readonly T[]): readonly T[] =>
  Object.freeze([...new Set(values)].sort());

function token(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`${label} must be a canonical non-negative integer string`);
  }
  return value;
}

function bounded(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 ||
      value.length > maximum) {
    throw new Error(`${label} must contain 1..${maximum} canonical characters`);
  }
  return value;
}

export function buildWorldRelationExperimentCheckpoint(input: Omit<
  WorldRelationExperimentCheckpoint,
  "schemaVersion" | "checkpointId" | "authority" |
  "semanticDecisionAuthority" | "probabilityAuthority" | "certificateAuthority" |
  "executionAuthority" | "externalWriteAuthority" | "valueMovingAuthority"
>): WorldRelationExperimentCheckpoint {
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-experiment-checkpoint.v1" as const,
    ...input,
    sourceToolEffectIds: exact(input.sourceToolEffectIds),
    invocationIds: exact(input.invocationIds),
    searchNeighborhoods: exact(input.searchNeighborhoods),
    inspectedListingRefs: exact(input.inspectedListingRefs),
    authority: "FIRST_PARTY_REPLAYABLE_TOOL_HOST_STATE" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldRelationExperimentCheckpoint(Object.freeze({
    ...body,
    checkpointId: hashCanonical(body),
  }));
}

export function assertWorldRelationExperimentCheckpoint(
  value: unknown,
): WorldRelationExperimentCheckpoint {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("world relation experiment checkpoint is malformed");
  }
  const checkpoint = value as WorldRelationExperimentCheckpoint;
  const { checkpointId, ...body } = checkpoint;
  const hashes = [checkpointId, checkpoint.inputRevisionId, checkpoint.frontierId,
    checkpoint.frontierArtifactHash, checkpoint.corpusSnapshotIdentity,
    checkpoint.sourceAgentRunId, ...checkpoint.sourceToolEffectIds,
    ...checkpoint.invocationIds];
  const validDisposition = ["SUPPORTED_HARD", "SUPPORTED_PROBABILISTIC", "FALSIFIED",
    "EXHAUSTED", "UNRESOLVED"].includes(checkpoint.terminalDisposition);
  const counterworld = checkpoint.counterworld;
  const counterworldValid = counterworld === null || (
    bounded(counterworld.description, "counterworld description", 2_000) !== "" &&
    bounded(counterworld.outcomeDescription, "counterworld outcome description", 2_000) !== "" &&
    ["REJECTED", "SURVIVES", "INCONCLUSIVE"].includes(counterworld.outcome) &&
    Object.entries(counterworld.truthByPredicateId).every(([key, item]) =>
      HASH.test(key) && typeof item === "boolean")
  );
  if (checkpoint.schemaVersion !== "pmh.world-relation-experiment-checkpoint.v1" ||
      hashes.some((item) => !HASH.test(String(item))) ||
      checkpointId !== hashCanonical(body) ||
      checkpoint.sourceToolEffectIds.join("\n") !==
        exact(checkpoint.sourceToolEffectIds).join("\n") ||
      checkpoint.invocationIds.join("\n") !== exact(checkpoint.invocationIds).join("\n") ||
      checkpoint.searchNeighborhoods.join("\n") !==
        exact(checkpoint.searchNeighborhoods).join("\n") ||
      checkpoint.inspectedListingRefs.join("\n") !==
        exact(checkpoint.inspectedListingRefs).join("\n") ||
      checkpoint.searchNeighborhoods.some((item) =>
        typeof item !== "string" || item.length < 1 || item.length > 6_000) ||
      checkpoint.inspectedListingRefs.some((item) =>
        typeof item !== "string" || item.length < 1 || item.length > 500) ||
      !counterworldValid || !validDisposition ||
      (checkpoint.terminalDisposition !== "EXHAUSTED" && counterworld === null) ||
      (checkpoint.terminalDisposition === "SUPPORTED_HARD" &&
        counterworld?.outcome !== "REJECTED") ||
      (checkpoint.terminalDisposition === "SUPPORTED_PROBABILISTIC" &&
        counterworld?.outcome === "REJECTED") ||
      bounded(checkpoint.rationale, "checkpoint rationale", 3_000) === "" ||
      token(checkpoint.usage.inputTokens, "checkpoint input tokens") === "" ||
      token(checkpoint.usage.outputTokens, "checkpoint output tokens") === "" ||
      token(checkpoint.usage.reasoningTokens, "checkpoint reasoning tokens") === "" ||
      !Number.isFinite(Date.parse(checkpoint.closedAt)) ||
      new Date(checkpoint.closedAt).toISOString() !== checkpoint.closedAt ||
      checkpoint.authority !== "FIRST_PARTY_REPLAYABLE_TOOL_HOST_STATE" ||
      checkpoint.semanticDecisionAuthority !== false ||
      checkpoint.probabilityAuthority !== false ||
      checkpoint.certificateAuthority !== false ||
      checkpoint.executionAuthority !== false ||
      checkpoint.externalWriteAuthority !== false ||
      checkpoint.valueMovingAuthority !== false) {
    throw new Error("world relation experiment checkpoint violates its bounded contract");
  }
  return Object.freeze(checkpoint);
}
