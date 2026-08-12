import { hashCanonical, type Hash } from "@pmh/domain";
import type { StudioProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type StudioProjectionSnapshot = Readonly<{
  schemaVersion: "pmh.studio-projection-snapshot.v1";
  projection: StudioProjection;
  projectionViewHash: Hash;
  sourceProjectionRevision: string;
  materializedAt: string;
  authority: "DERIVED_PRESENTATION_CACHE_ONLY";
  providerRequestsStartedByCache: 0;
  modelInvocationsStartedByCache: 0;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
  snapshotHash: Hash;
}>;

export interface StudioProjectionSnapshotStore {
  loadStudioProjectionSnapshot(): StudioProjectionSnapshot | null;
  saveStudioProjectionSnapshot(
    snapshot: StudioProjectionSnapshot,
  ): StudioProjectionSnapshot;
}

function canonicalIso(value: unknown): value is string {
  return typeof value === "string" && new Date(value).toISOString() === value;
}

function liveProjectionViewHash(projection: StudioProjection): Hash {
  const { identity: _identity, ...viewState } = projection;
  return hashCanonical(viewState);
}

export function assertStudioProjectionSnapshot(
  value: unknown,
): StudioProjectionSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Studio projection snapshot is malformed");
  }
  const snapshot = value as StudioProjectionSnapshot;
  const projection = snapshot.projection;
  if (projection === null || typeof projection !== "object" ||
      projection.identity?.schemaVersion !== "pmh.studio-projection.v2" ||
      projection.identity.mode !== "CONTROL_PLANE" ||
      projection.identity.view !== "LIVE_BOUNDED" ||
      projection.projectionWindow?.schemaVersion !== "pmh.studio-projection-window.v1" ||
      projection.projectionWindow.mode !== "LIVE_BOUNDED" ||
      projection.projectionWindow.authority !== "PRESENTATION_WINDOW_ONLY" ||
      projection.projectionWindow.historyDeleted !== false ||
      !HASH_PATTERN.test(String(projection.identity.stateHash)) ||
      !HASH_PATTERN.test(String(projection.identity.viewHash)) ||
      projection.projectionWindow.sourceStateHash !== projection.identity.stateHash ||
      projection.identity.viewHash !== liveProjectionViewHash(projection)) {
    throw new Error("Studio projection snapshot does not contain a valid bounded view");
  }
  const { snapshotHash, ...body } = snapshot;
  if (
    snapshot.schemaVersion !== "pmh.studio-projection-snapshot.v1" ||
    snapshot.projectionViewHash !== projection.identity.viewHash ||
    !/^(?:0|[1-9]\d*)$/u.test(String(snapshot.sourceProjectionRevision)) ||
    !canonicalIso(snapshot.materializedAt) ||
    snapshot.authority !== "DERIVED_PRESENTATION_CACHE_ONLY" ||
    snapshot.providerRequestsStartedByCache !== 0 ||
    snapshot.modelInvocationsStartedByCache !== 0 ||
    snapshot.externalWriteAuthority !== false ||
    snapshot.valueMovingAuthority !== false ||
    !HASH_PATTERN.test(String(snapshotHash)) ||
    snapshotHash !== hashCanonical(body)
  ) throw new Error("Studio projection snapshot violates its cache contract");
  return Object.freeze(snapshot);
}

export function buildStudioProjectionSnapshot(input: Readonly<{
  projection: StudioProjection;
  sourceProjectionRevision: bigint;
  materializedAt: string;
}>): StudioProjectionSnapshot {
  const body = Object.freeze({
    schemaVersion: "pmh.studio-projection-snapshot.v1" as const,
    projection: input.projection,
    projectionViewHash: input.projection.identity.viewHash as Hash,
    sourceProjectionRevision: input.sourceProjectionRevision.toString(),
    materializedAt: input.materializedAt,
    authority: "DERIVED_PRESENTATION_CACHE_ONLY" as const,
    providerRequestsStartedByCache: 0 as const,
    modelInvocationsStartedByCache: 0 as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertStudioProjectionSnapshot(Object.freeze({
    ...body,
    snapshotHash: hashCanonical(body),
  }));
}

export function supportsStudioProjectionSnapshots(
  value: unknown,
): value is StudioProjectionSnapshotStore {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<StudioProjectionSnapshotStore>;
  return typeof candidate.loadStudioProjectionSnapshot === "function" &&
    typeof candidate.saveStudioProjectionSnapshot === "function";
}
