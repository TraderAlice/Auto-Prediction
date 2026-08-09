export const SEARCH_SEMANTIC_FAMILIES = Object.freeze([
  "TEMPORAL_IMPOSSIBILITY",
  "EVENT_CONTAINMENT",
  "PARTITION_COMPLETENESS",
  "IDENTITY_SUCCESSION",
  "PHYSICAL_CO_OCCURRENCE",
] as const);

export type SearchSemanticFamily = (typeof SEARCH_SEMANTIC_FAMILIES)[number];

export function isSearchSemanticFamily(
  value: unknown,
): value is SearchSemanticFamily {
  return typeof value === "string" &&
    SEARCH_SEMANTIC_FAMILIES.includes(value as SearchSemanticFamily);
}
