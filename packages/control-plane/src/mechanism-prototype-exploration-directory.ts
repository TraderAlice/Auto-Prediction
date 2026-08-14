import { hashCanonical, type Hash } from "@pmh/domain";
import {
  marketOntologyPredicateFamiliesForText,
  type MarketOntologyPredicateFamily,
} from "./market-ontology.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  mechanismPrototypeExplorationAggregateCue,
  mechanismPrototypeExplorationComponentCue,
  type MechanismPrototypeExplorationInputRevision,
} from "./mechanism-prototype-guided-exploration.js";

export type MechanismPrototypeExplorationDirectoryEntry = Readonly<{
  listingRef: string;
  venueId: string;
  title: string;
  predicateFamilies: readonly MarketOntologyPredicateFamily[];
  componentRoleCue: boolean;
  aggregateRoleCue: boolean;
  outsideSourcePredicateFamily: boolean;
}>;

export type MechanismPrototypeExplorationDirectoryPage = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-directory-page.v1";
  pageIdentity: Hash;
  inputRevisionId: Hash;
  coverageScopeIdentity: Hash | null;
  offset: number;
  limit: number;
  totalEntryCount: number;
  nextOffset: number | null;
  entries: readonly MechanismPrototypeExplorationDirectoryEntry[];
  representedVenueCount: number;
  representedPredicateFamilyCount: number;
  samplingPolicy:
    "ROUND_ROBIN_PREDICATE_FAMILY_AND_VENUE_NON_SOURCE_FAMILIES_FIRST";
  authority: "EXACT_COVERAGE_DIRECTORY_QUERY_INSPIRATION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  schedulingAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function annotatedEntries(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  corpus: MarketCorpusSnapshot;
}>): readonly MechanismPrototypeExplorationDirectoryEntry[] {
  const sourceFamilies = new Set(input.researchInput.axisContract?.sourcePredicateFamilies ?? []);
  const coverageRefs = new Set((input.researchInput.coverageMembers ?? [])
    .map((member) => member.listingRef));
  const excludedRefs = new Set(input.researchInput.excludedListingRefs);
  return Object.freeze(input.corpus.listings
    .filter((listing) => coverageRefs.has(listing.listingRef) &&
      !excludedRefs.has(listing.listingRef))
    .map((listing) => {
      const predicateFamilies = marketOntologyPredicateFamiliesForText(listing.title);
      return Object.freeze({
        listingRef: listing.listingRef,
        venueId: listing.venueId,
        title: listing.title.slice(0, 240),
        predicateFamilies,
        componentRoleCue: mechanismPrototypeExplorationComponentCue(listing.title),
        aggregateRoleCue: mechanismPrototypeExplorationAggregateCue(listing.title),
        outsideSourcePredicateFamily: predicateFamilies.some((family) =>
          !sourceFamilies.has(family)
        ),
      });
    }));
}

function diversityOrder(
  entries: readonly MechanismPrototypeExplorationDirectoryEntry[],
): readonly MechanismPrototypeExplorationDirectoryEntry[] {
  const buckets = new Map<string, MechanismPrototypeExplorationDirectoryEntry[]>();
  for (const entry of entries) {
    const primaryFamily = entry.predicateFamilies[0] ?? "UNCLASSIFIED";
    const key = `${entry.outsideSourcePredicateFamily ? "0" : "1"}|${primaryFamily}|${entry.venueId}`;
    const members = buckets.get(key) ?? [];
    members.push(entry);
    buckets.set(key, members);
  }
  for (const members of buckets.values()) {
    members.sort((left, right) => left.listingRef.localeCompare(right.listingRef));
  }
  const ordered: MechanismPrototypeExplorationDirectoryEntry[] = [];
  const keys = [...buckets.keys()].sort();
  for (let depth = 0; ordered.length < entries.length; depth += 1) {
    let added = false;
    for (const key of keys) {
      const entry = buckets.get(key)?.[depth];
      if (entry === undefined) continue;
      ordered.push(entry);
      added = true;
    }
    if (!added) break;
  }
  return Object.freeze(ordered);
}

export function browseMechanismPrototypeExplorationDirectory(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  corpus: MarketCorpusSnapshot;
  offset: number;
  limit: number;
}>): MechanismPrototypeExplorationDirectoryPage {
  if (!Number.isSafeInteger(input.offset) || input.offset < 0 ||
      !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 24) {
    throw new Error("mechanism exploration directory page bounds are invalid");
  }
  const ordered = diversityOrder(annotatedEntries(input));
  const entries = Object.freeze(ordered.slice(input.offset, input.offset + input.limit));
  const nextOffset = input.offset + entries.length < ordered.length
    ? input.offset + entries.length : null;
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-directory-page.v1" as const,
    inputRevisionId: input.researchInput.inputRevisionId,
    coverageScopeIdentity: input.researchInput.coverageScopeIdentity ?? null,
    offset: input.offset,
    limit: input.limit,
    totalEntryCount: ordered.length,
    nextOffset,
    entries,
    representedVenueCount: new Set(entries.map((entry) => entry.venueId)).size,
    representedPredicateFamilyCount: new Set(entries.flatMap((entry) =>
      entry.predicateFamilies)).size,
    samplingPolicy:
      "ROUND_ROBIN_PREDICATE_FAMILY_AND_VENUE_NON_SOURCE_FAMILIES_FIRST" as const,
    authority: "EXACT_COVERAGE_DIRECTORY_QUERY_INSPIRATION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    schedulingAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, pageIdentity: hashCanonical(body) });
}
