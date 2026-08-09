import { hashCanonical, type Hash } from "@pmh/domain";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/u;

export type StudioProjectionInvalidation = Readonly<{
  schemaVersion: "pmh.studio-projection-invalidation.v1";
  invalidationHash: Hash;
  revision: string;
  emittedAt: string;
  reason: "STATE_CHANGED" | "SUBSCRIBER_CONNECTED";
  projectionResource: "/api/v1/projection";
  projectionView: "LIVE_BOUNDED";
  refreshRequired: true;
  sourceStateHashKnown: false;
  authority: "PRESENTATION_INVALIDATION_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export function buildStudioProjectionInvalidation(input: Readonly<{
  revision: bigint | number | string;
  emittedAt: string;
  reason: StudioProjectionInvalidation["reason"];
}>): StudioProjectionInvalidation {
  const revision = String(input.revision);
  const emittedAt = new Date(input.emittedAt).toISOString();
  if (!UNSIGNED_INTEGER.test(revision) || BigInt(revision) < 0n) {
    throw new Error("Studio projection invalidation revision is invalid");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.studio-projection-invalidation.v1" as const,
    revision,
    emittedAt,
    reason: input.reason,
    projectionResource: "/api/v1/projection" as const,
    projectionView: "LIVE_BOUNDED" as const,
    refreshRequired: true as const,
    sourceStateHashKnown: false as const,
    authority: "PRESENTATION_INVALIDATION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertStudioProjectionInvalidation(Object.freeze({
    ...body,
    invalidationHash: hashCanonical(body),
  }));
}

export function assertStudioProjectionInvalidation(
  value: unknown,
): StudioProjectionInvalidation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Studio projection invalidation is malformed");
  }
  const invalidation = value as StudioProjectionInvalidation;
  const { invalidationHash, ...body } = invalidation;
  if (
    invalidation.schemaVersion !== "pmh.studio-projection-invalidation.v1" ||
    !HASH_PATTERN.test(String(invalidationHash)) ||
    invalidationHash !== hashCanonical(body) ||
    !UNSIGNED_INTEGER.test(String(invalidation.revision)) ||
    BigInt(invalidation.revision) < 0n ||
    new Date(invalidation.emittedAt).toISOString() !== invalidation.emittedAt ||
    !["STATE_CHANGED", "SUBSCRIBER_CONNECTED"].includes(invalidation.reason) ||
    invalidation.projectionResource !== "/api/v1/projection" ||
    invalidation.projectionView !== "LIVE_BOUNDED" ||
    invalidation.refreshRequired !== true ||
    invalidation.sourceStateHashKnown !== false ||
    invalidation.authority !== "PRESENTATION_INVALIDATION_ONLY" ||
    invalidation.semanticDecisionAuthority !== false ||
    invalidation.certificateAuthority !== false ||
    invalidation.executionAuthority !== false
  ) {
    throw new Error("Studio projection invalidation violates its transport contract");
  }
  return invalidation;
}
