import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildDiscoveryCatalogContext,
  buildExactDiscoveryCatalogContext,
  type DiscoveryContextRoutingFeedback,
} from "./catalog-discovery.js";
import { buildSearchScopeIdentity } from "./search-scope-identity.js";
import {
  isSearchSemanticFamily,
  type SearchSemanticFamily,
} from "./search-semantic-family.js";
import type {
  DiscoveryCatalogContext,
  DiscoveryCatalogContextSource,
  DiscoveryCatalogListing,
} from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_NEIGHBORHOODS = 64;
const MAX_SHARED_SIGNALS = 8;

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "before", "between", "could",
  "does", "from", "have", "into", "market", "more", "other", "over",
  "than", "that", "their", "there", "these", "they", "this", "those",
  "through", "under", "until", "what", "when", "where", "which", "while",
  "will", "with", "would", "yes", "no", "the", "and", "for", "are",
  "was", "were", "has", "had", "its", "his", "her", "who", "why",
  "utc", "close", "closes", "closing", "hourly", "daily", "weekly", "up",
  "down",
]);
const TEMPORAL_CORE_STOP_WORDS = new Set([
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december", "tomorrow", "today",
  "tonight", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug",
  "sep", "sept", "oct", "nov", "dec",
]);

const TEMPORAL_PATTERN = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|before|after|by|during|through|until|between|q[1-4]|20\d{2})\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/giu;
const NUMBER_PATTERN = /(?:^|\s)(?:\$|€|£)?-?\d+(?:\.\d+)?%?(?=\s|$)/gu;
const RANGE_PATTERN = /\b(?:between|under|below|above|over|at least|at most|or less|or more|range|exactly|other|none)\b/giu;
const CONTAINMENT_PATTERN = /\b(?:at least|at most|more than|less than|before|by|ever|any|all|win|wins|reach|reaches|exceed|exceeds|qualify|qualifies)\b/giu;
const IDENTITY_PATTERN = /\b(?:president|prime minister|nominee|candidate|office|leader|ceo|coach|team|party|replace|replacement|successor|succession|resign|resigns|removed|appointed|elected|winner)\b/giu;
const PHYSICAL_PATTERN = /\b(?:appear|appears|appearance|attend|attends|participate|participates|perform|performs|play|plays|travel|travels|visit|visits|live|livestream|stream|drink|drinks|eat|eats|shot|shooting|injured|hospitalized|dies|death|killed|location|speech|debate|game|match)\b/giu;
const INCAPACITY_PATTERN = /\b(?:shot|shooting|injured|dies|death|dead|killed|assassinated|incapacitated|hospitalized|removed|disqualified|resigns|resigned)\b/giu;
const SUCCESSION_PATTERN = /\b(?:replace|replacement|successor|succession|resign|resigns|resigned|removed|appointed|nominee|candidate|elected|president|prime minister|ceo)\b/giu;

export type SemanticFamilyRetrievalSelectionReason =
  | "FRESH_FAMILY_NEIGHBORHOOD"
  | "ROUTING_ATTEMPTED_FALLBACK"
  | "SEMANTIC_COMPLETED_FALLBACK"
  | "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK";

export type SemanticFamilyRetrievalPlan = Readonly<{
  schemaVersion: "pmh.semantic-family-retrieval.v1";
  algorithmVersion: "pmh.semantic-family-retrieval.v1";
  planIdentity: Hash;
  semanticFamily: SearchSemanticFamily;
  corpusIdentity: Hash;
  eligibleVenueIds: readonly string[];
  maxContextListings: number;
  neighborhoodCount: number;
  selectedNeighborhoodRank: number | null;
  selectionReason: SemanticFamilyRetrievalSelectionReason;
  anchorListingRefs: readonly string[];
  sharedSignals: readonly string[];
  score: number | null;
  selectedContextIdentity: Hash;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type SemanticFamilyCatalogSelection = Readonly<{
  catalogContext: DiscoveryCatalogContext;
  retrievalPlan: SemanticFamilyRetrievalPlan;
}>;

type Features = Readonly<{
  tokens: ReadonlySet<string>;
  temporal: readonly string[];
  numbers: readonly string[];
  range: readonly string[];
  containment: readonly string[];
  identity: readonly string[];
  physical: readonly string[];
  incapacity: readonly string[];
}>;

type Neighborhood = Readonly<{
  anchors: readonly [DiscoveryCatalogListing, DiscoveryCatalogListing];
  context: DiscoveryCatalogContext;
  score: number;
  sharedSignals: readonly string[];
}>;

function matches(text: string, pattern: RegExp): readonly string[] {
  return Object.freeze([
    ...new Set([...text.matchAll(pattern)].map((match) => match[0]!.trim().toLowerCase())),
  ].sort());
}

function tokens(text: string): ReadonlySet<string> {
  return new Set(
    text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) =>
        token.length >= 3 && !/^\d+$/u.test(token) && !STOP_WORDS.has(token)
          && !TEMPORAL_CORE_STOP_WORDS.has(token)
      ) ?? [],
  );
}

function features(listing: DiscoveryCatalogListing): Features {
  const title = listing.title.normalize("NFKC").toLowerCase();
  const cueText = `${title} ${listing.outcomes.map((outcome) => outcome.label).join(" ")} ${listing.closesAt ?? ""}`
    .normalize("NFKC")
    .toLowerCase();
  return Object.freeze({
    tokens: tokens(title),
    temporal: matches(cueText, TEMPORAL_PATTERN),
    numbers: matches(title.replace(/([%$€£])/gu, " $1"), NUMBER_PATTERN),
    range: matches(cueText, RANGE_PATTERN),
    containment: matches(cueText, CONTAINMENT_PATTERN),
    identity: matches(cueText, IDENTITY_PATTERN),
    physical: matches(cueText, PHYSICAL_PATTERN),
    incapacity: matches(cueText, INCAPACITY_PATTERN),
  });
}

function intersection(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return [...left].filter((item) => right.has(item));
}

function uncommonSharedTerms(
  left: Features,
  right: Features,
  documentFrequency: ReadonlyMap<string, number>,
  corpusSize: number,
): readonly string[] {
  const maximumFrequency = Math.max(8, Math.ceil(corpusSize / 5));
  return Object.freeze(intersection(left.tokens, right.tokens)
    .filter((term) => (documentFrequency.get(term) ?? corpusSize) <= maximumFrequency)
    .sort((a, b) =>
      (documentFrequency.get(a) ?? 0) - (documentFrequency.get(b) ?? 0) ||
      a.localeCompare(b)
    )
    .slice(0, MAX_SHARED_SIGNALS));
}

function differs(left: readonly string[], right: readonly string[]): boolean {
  return left.join("\n") !== right.join("\n");
}

function familyScore(
  family: SearchSemanticFamily,
  left: Features,
  right: Features,
  shared: readonly string[],
  distinctVenue: boolean,
): number | null {
  if (shared.length === 0) return null;
  const core = shared.length * 100 + (distinctVenue ? 12 : 0);
  switch (family) {
    case "TEMPORAL_IMPOSSIBILITY":
      if (left.temporal.length === 0 || right.temporal.length === 0) return null;
      if (
        left.incapacity.length + right.incapacity.length === 0 &&
        !(left.physical.length > 0 && right.physical.length > 0 &&
          differs(left.temporal, right.temporal))
      ) return null;
      return core + (differs(left.temporal, right.temporal) ? 45 : 10) +
        (left.incapacity.length + right.incapacity.length > 0 ? 35 : 0) +
        (left.physical.length > 0 && right.physical.length > 0 ? 25 : 0);
    case "EVENT_CONTAINMENT":
      if (
        left.containment.length + right.containment.length === 0 &&
        left.numbers.length + right.numbers.length === 0 &&
        !differs(left.temporal, right.temporal)
      ) return null;
      return core + 25 + (differs(left.numbers, right.numbers) ? 30 : 0) +
        (differs(left.temporal, right.temporal) ? 20 : 0);
    case "PARTITION_COMPLETENESS":
      if (
        shared.length < 2 ||
        left.range.length + right.range.length + left.numbers.length + right.numbers.length === 0
      ) return null;
      return core + 30 + (differs(left.numbers, right.numbers) ? 35 : 0) +
        (left.range.length + right.range.length > 0 ? 20 : 0);
    case "IDENTITY_SUCCESSION":
      if (
        left.identity.length + right.identity.length === 0 ||
        matches(
          `${[...left.tokens].join(" ")} ${[...right.tokens].join(" ")}`,
          SUCCESSION_PATTERN,
        ).length === 0
      ) return null;
      return core + 35 +
        (differs(left.identity, right.identity) ? 20 : 0) +
        (differs(left.temporal, right.temporal) ? 10 : 0);
    case "PHYSICAL_CO_OCCURRENCE":
      if (left.physical.length === 0 || right.physical.length === 0) return null;
      return core + 35 + (differs(left.temporal, right.temporal) ? 25 : 0) +
        (left.incapacity.length + right.incapacity.length > 0 ? 20 : 0);
  }
}

function selectionTier(
  context: DiscoveryCatalogContext,
  feedback: DiscoveryContextRoutingFeedback,
): 0 | 1 | 2 | 3 {
  const scope = buildSearchScopeIdentity(context.listings);
  const completed = feedback.completedSemanticScopeIdentities.includes(
    scope.semanticScopeIdentity,
  );
  const attempted = feedback.attemptedRoutingScopeIdentities.includes(
    scope.routingScopeIdentity,
  );
  return completed ? attempted ? 3 : 2 : attempted ? 1 : 0;
}

function boundedContext(
  source: DiscoveryCatalogContextSource,
  anchors: readonly [DiscoveryCatalogListing, DiscoveryCatalogListing],
  rankedRelated: readonly DiscoveryCatalogListing[],
  maximum: number,
): DiscoveryCatalogContext {
  let context = buildExactDiscoveryCatalogContext(source, anchors);
  const selected = [...anchors];
  for (const listing of rankedRelated) {
    if (selected.length >= maximum) break;
    try {
      const candidate = buildExactDiscoveryCatalogContext(source, [...selected, listing]);
      selected.push(listing);
      context = candidate;
    } catch {
      // A single verbose listing may cross the immutable context character cap.
    }
  }
  return context;
}

function withPlanIdentity(
  body: Omit<SemanticFamilyRetrievalPlan, "planIdentity">,
): SemanticFamilyRetrievalPlan {
  return Object.freeze({ ...body, planIdentity: hashCanonical(body) });
}

export function assertSemanticFamilyRetrievalPlan(
  value: unknown,
): SemanticFamilyRetrievalPlan {
  if (value === null || typeof value !== "object") {
    throw new Error("semantic family retrieval plan is malformed");
  }
  const plan = value as SemanticFamilyRetrievalPlan;
  const { planIdentity, ...body } = plan;
  if (
    plan.schemaVersion !== "pmh.semantic-family-retrieval.v1" ||
    plan.algorithmVersion !== "pmh.semantic-family-retrieval.v1" ||
    !HASH_PATTERN.test(String(planIdentity)) || planIdentity !== hashCanonical(body) ||
    !isSearchSemanticFamily(plan.semanticFamily) ||
    !HASH_PATTERN.test(String(plan.corpusIdentity)) ||
    !Array.isArray(plan.eligibleVenueIds) || plan.eligibleVenueIds.length < 1 ||
    plan.eligibleVenueIds.length > 25 ||
    new Set(plan.eligibleVenueIds).size !== plan.eligibleVenueIds.length ||
    plan.eligibleVenueIds.some((item) => typeof item !== "string" || item.trim() === "") ||
    !Number.isSafeInteger(plan.maxContextListings) || plan.maxContextListings < 2 ||
    plan.maxContextListings > 30 ||
    !Number.isSafeInteger(plan.neighborhoodCount) || plan.neighborhoodCount < 0 ||
    plan.neighborhoodCount > MAX_NEIGHBORHOODS ||
    (plan.selectedNeighborhoodRank !== null && (
      !Number.isSafeInteger(plan.selectedNeighborhoodRank) ||
      plan.selectedNeighborhoodRank < 1 ||
      plan.selectedNeighborhoodRank > plan.neighborhoodCount
    )) ||
    ![
      "FRESH_FAMILY_NEIGHBORHOOD", "ROUTING_ATTEMPTED_FALLBACK",
      "SEMANTIC_COMPLETED_FALLBACK", "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK",
    ].includes(plan.selectionReason) ||
    !Array.isArray(plan.anchorListingRefs) || plan.anchorListingRefs.length > 2 ||
    plan.anchorListingRefs.some((item) => typeof item !== "string" || item.trim() === "") ||
    !Array.isArray(plan.sharedSignals) || plan.sharedSignals.length > MAX_SHARED_SIGNALS ||
    plan.sharedSignals.some((item) => typeof item !== "string" || item.trim() === "") ||
    (plan.score !== null && (!Number.isSafeInteger(plan.score) || plan.score < 0)) ||
    !HASH_PATTERN.test(String(plan.selectedContextIdentity)) ||
    plan.authority !== "SEARCH_ROUTING_ONLY" ||
    plan.semanticDecisionAuthority !== false || plan.probabilityAuthority !== false ||
    plan.certificateAuthority !== false || plan.executionAuthority !== false ||
    (plan.neighborhoodCount === 0
      ? plan.selectedNeighborhoodRank !== null || plan.anchorListingRefs.length !== 0 ||
        plan.sharedSignals.length !== 0 || plan.score !== null ||
        plan.selectionReason !== "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK"
      : plan.selectedNeighborhoodRank === null || plan.anchorListingRefs.length !== 2 ||
        plan.sharedSignals.length === 0 || plan.score === null)
  ) throw new Error("semantic family retrieval plan violates its bounded contract");
  return Object.freeze(plan);
}

export function buildSemanticFamilyCatalogSelection(input: Readonly<{
  source: DiscoveryCatalogContextSource;
  corpusIdentity: Hash;
  listings: readonly DiscoveryCatalogListing[];
  question: string;
  eligibleVenueIds: readonly string[];
  semanticFamily: SearchSemanticFamily;
  maxContextListings: number;
  feedback: DiscoveryContextRoutingFeedback;
}>): SemanticFamilyCatalogSelection {
  if (!isSearchSemanticFamily(input.semanticFamily)) {
    throw new Error("semantic family retrieval family is invalid");
  }
  if (
    !Number.isSafeInteger(input.maxContextListings) || input.maxContextListings < 2 ||
    input.maxContextListings > 30
  ) throw new Error("semantic family retrieval context bound is invalid");
  const venueIds = Object.freeze([...new Set(input.eligibleVenueIds)].sort());
  if (venueIds.length === 0 || venueIds.length !== input.eligibleVenueIds.length) {
    throw new Error("semantic family retrieval venues must be non-empty and unique");
  }
  const allowedVenues = new Set(venueIds);
  const listings = input.listings.filter((listing) => allowedVenues.has(listing.venueId));
  const byRef = new Map(listings.map((listing) => [listing.listingRef, features(listing)]));
  const documentFrequency = new Map<string, number>();
  for (const value of byRef.values()) {
    for (const token of value.tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const raw: Readonly<{
    anchors: readonly [DiscoveryCatalogListing, DiscoveryCatalogListing];
    score: number;
    sharedSignals: readonly string[];
  }>[] = [];
  for (let leftIndex = 0; leftIndex < listings.length; leftIndex += 1) {
    const left = listings[leftIndex]!;
    const leftFeatures = byRef.get(left.listingRef)!;
    for (let rightIndex = leftIndex + 1; rightIndex < listings.length; rightIndex += 1) {
      const right = listings[rightIndex]!;
      const rightFeatures = byRef.get(right.listingRef)!;
      const sharedSignals = uncommonSharedTerms(
        leftFeatures,
        rightFeatures,
        documentFrequency,
        listings.length,
      );
      const score = familyScore(
        input.semanticFamily,
        leftFeatures,
        rightFeatures,
        sharedSignals,
        left.venueId !== right.venueId,
      );
      if (score !== null) raw.push(Object.freeze({
        anchors: Object.freeze([left, right]) as readonly [DiscoveryCatalogListing, DiscoveryCatalogListing],
        score,
        sharedSignals,
      }));
    }
  }
  const ranked = raw.sort((left, right) =>
    right.score - left.score ||
    left.anchors[0].listingRef.localeCompare(right.anchors[0].listingRef) ||
    left.anchors[1].listingRef.localeCompare(right.anchors[1].listingRef)
  ).slice(0, MAX_NEIGHBORHOODS);
  const neighborhoods: Neighborhood[] = ranked.map((item) => {
    const anchorTokens = new Set([
      ...byRef.get(item.anchors[0].listingRef)!.tokens,
      ...byRef.get(item.anchors[1].listingRef)!.tokens,
    ]);
    const related = listings
      .filter((listing) => !item.anchors.some((anchor) => anchor.listingRef === listing.listingRef))
      .map((listing) => ({
        listing,
        score: intersection(anchorTokens, byRef.get(listing.listingRef)!.tokens).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) =>
        right.score - left.score || left.listing.listingRef.localeCompare(right.listing.listingRef)
      )
      .map((entry) => entry.listing);
    return Object.freeze({
      ...item,
      context: boundedContext(input.source, item.anchors, related, input.maxContextListings),
    });
  });
  let selectedIndex = -1;
  let bestTier = 4;
  const seenSemanticScopes = new Set<Hash>();
  for (let index = 0; index < neighborhoods.length; index += 1) {
    const neighborhood = neighborhoods[index]!;
    const scope = buildSearchScopeIdentity(neighborhood.context.listings);
    if (seenSemanticScopes.has(scope.semanticScopeIdentity)) continue;
    seenSemanticScopes.add(scope.semanticScopeIdentity);
    const tier = selectionTier(neighborhood.context, input.feedback);
    if (tier === 0) {
      selectedIndex = index;
      bestTier = tier;
      break;
    }
    if (tier < bestTier) {
      selectedIndex = index;
      bestTier = tier;
    }
  }
  if (selectedIndex < 0) {
    const queryContext = buildDiscoveryCatalogContext(
      input.source,
      listings,
      input.question,
      venueIds,
    );
    const context = queryContext.listings.length <= input.maxContextListings
      ? queryContext
      : buildExactDiscoveryCatalogContext(
          input.source,
          queryContext.listings.slice(0, input.maxContextListings),
        );
    return Object.freeze({
      catalogContext: context,
      retrievalPlan: withPlanIdentity({
        schemaVersion: "pmh.semantic-family-retrieval.v1",
        algorithmVersion: "pmh.semantic-family-retrieval.v1",
        semanticFamily: input.semanticFamily,
        corpusIdentity: input.corpusIdentity,
        eligibleVenueIds: venueIds,
        maxContextListings: input.maxContextListings,
        neighborhoodCount: 0,
        selectedNeighborhoodRank: null,
        selectionReason: "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK",
        anchorListingRefs: Object.freeze([]),
        sharedSignals: Object.freeze([]),
        score: null,
        selectedContextIdentity: context.contextIdentity as Hash,
        authority: "SEARCH_ROUTING_ONLY",
        semanticDecisionAuthority: false,
        probabilityAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      }),
    });
  }
  const selected = neighborhoods[selectedIndex]!;
  const selectionReason = bestTier === 0
    ? "FRESH_FAMILY_NEIGHBORHOOD"
    : bestTier === 1
      ? "ROUTING_ATTEMPTED_FALLBACK"
      : "SEMANTIC_COMPLETED_FALLBACK";
  return Object.freeze({
    catalogContext: selected.context,
    retrievalPlan: withPlanIdentity({
      schemaVersion: "pmh.semantic-family-retrieval.v1",
      algorithmVersion: "pmh.semantic-family-retrieval.v1",
      semanticFamily: input.semanticFamily,
      corpusIdentity: input.corpusIdentity,
      eligibleVenueIds: venueIds,
      maxContextListings: input.maxContextListings,
      neighborhoodCount: neighborhoods.length,
      selectedNeighborhoodRank: selectedIndex + 1,
      selectionReason,
      anchorListingRefs: Object.freeze(selected.anchors.map((item) => item.listingRef)),
      sharedSignals: selected.sharedSignals,
      score: selected.score,
      selectedContextIdentity: selected.context.contextIdentity as Hash,
      authority: "SEARCH_ROUTING_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    }),
  });
}

export function semanticFamilyRetrievalBrief(
  plan: SemanticFamilyRetrievalPlan,
): string {
  assertSemanticFamilyRetrievalPlan(plan);
  if (plan.anchorListingRefs.length === 0) {
    return `Family retrieval found no deterministic ${plan.semanticFamily} neighborhood; inspect the bounded query fallback and abstain unless exact refs support a relation.`;
  }
  return `Retrieval trailhead only (not a semantic or probability judgment): ${plan.anchorListingRefs.join(" + ")} were colocated for ${plan.semanticFamily} by shared signals [${plan.sharedSignals.join(", ")}]. Explicitly test counterexamples before proposing any relation.`;
}
