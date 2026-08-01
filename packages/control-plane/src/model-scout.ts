import type { ModelScoutRole } from "./types.js";

export const modelScoutRoles: readonly ModelScoutRole[] = Object.freeze([
  "EQUIVALENCE",
  "PARTITION",
  "MECHANISM",
  "SKEPTIC",
]);

const SEARCH_LENSES: Readonly<Record<ModelScoutRole, string>> = Object.freeze({
  EQUIVALENCE:
    "Look for claim-equivalence leads, then name threshold, timing, source, or resolution details that could disprove equivalence.",
  PARTITION:
    "Look for exhaustive or complementary outcome structures, including gaps, overlaps, void states, and non-exhaustive partitions.",
  MECHANISM:
    "Look for cross-venue mechanism leads whose economics may depend on depth, fees, complete-set routes, or settlement mechanics.",
  SKEPTIC:
    "Try to falsify superficially similar pairs; propose a lead only when concrete listing evidence survives the skeptical comparison.",
});

export function configuredModelScoutRoles(
  value: string | undefined,
): readonly ModelScoutRole[] {
  const fanout =
    value?.trim() === "" || value === undefined ? 1 : Number(value);
  if (!Number.isSafeInteger(fanout) || fanout < 1 || fanout > 4) {
    throw new Error("PMH_DISCOVERY_FANOUT must be an integer from 1 to 4");
  }
  return Object.freeze(modelScoutRoles.slice(0, fanout));
}

export function modelScoutLens(role: ModelScoutRole): string {
  return SEARCH_LENSES[role];
}

export function modelScoutWorkerId(
  role: ModelScoutRole,
  fanout: number,
): string {
  return fanout === 1
    ? "model-fast-lane"
    : `model-fast-lane-${role.toLowerCase()}`;
}
