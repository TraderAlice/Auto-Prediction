import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildDiscoveryCatalogContext,
  buildExactDiscoveryCatalogContext,
  type DiscoveryContextRoutingFeedback,
} from "./catalog-discovery.js";
import { buildSearchScopeIdentity } from "./search-scope-identity.js";
import { buildMarketCorpusSnapshot } from "./market-corpus.js";
import {
  buildMarketOntologySnapshot,
  type MarketOntologyChangedFacet,
} from "./market-ontology.js";
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
const MAX_QUERY_SIGNALS = 8;

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
  | "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD"
  | "ROUTING_ATTEMPTED_FALLBACK"
  | "SEMANTIC_COMPLETED_FALLBACK"
  | "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK"
  | "NO_FAMILY_NEIGHBORHOOD_CORPUS_SAMPLE"
  | "NO_FAMILY_NEIGHBORHOOD_HEURISTIC_TRAILHEAD"
  | "NO_COHERENT_HEURISTIC_TRAILHEAD";

export type SemanticFamilyRoutingMode = "HEURISTIC_FIRST" | "QUERY_FIRST";

export type RareSeedDiscoveryTrailhead = Readonly<{
  schemaVersion: "pmh.heuristic-discovery-trailhead.v1";
  trailheadIdentity: Hash;
  kind: "RARE_SEED_NEIGHBORHOOD";
  seedListingRef: string;
  seedTitle?: string;
  relatedListingRefs: readonly string[];
  seedSignals: readonly string[];
  score: number;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type OntologyDiscoveryTrailhead = Readonly<{
  schemaVersion: "pmh.heuristic-discovery-trailhead.v2";
  trailheadIdentity: Hash;
  kind: "ONTOLOGY_DIVERGENCE";
  sourceOntologyIdentity: Hash;
  ontologyTrailheadId: Hash;
  anchorListingRefs: readonly [string, string];
  sharedSubjectSignals: readonly string[];
  changedFacets: readonly MarketOntologyChangedFacet[];
  searchQuestion: string;
  score: number;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type HeuristicDiscoveryTrailhead =
  | RareSeedDiscoveryTrailhead
  | OntologyDiscoveryTrailhead;

export type SemanticFamilyRetrievalPlan = Readonly<{
  schemaVersion: "pmh.semantic-family-retrieval.v1";
  algorithmVersion:
    | "pmh.semantic-family-retrieval.v1"
    | "pmh.semantic-family-retrieval.v2"
    | "pmh.semantic-family-retrieval.v3"
    | "pmh.semantic-family-retrieval.v4"
    | "pmh.semantic-family-retrieval.v5"
    | "pmh.semantic-family-retrieval.v6";
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
  querySignals?: readonly string[];
  queryScore?: number | null;
  routingMode?: SemanticFamilyRoutingMode;
  sampleListingRefs?: readonly string[];
  heuristicTrailhead?: HeuristicDiscoveryTrailhead | null;
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
  querySignals: readonly string[];
  queryScore: number | null;
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

function relevantQueryTerms(
  question: string,
  anchors: readonly [DiscoveryCatalogListing, DiscoveryCatalogListing],
  byRef: ReadonlyMap<string, Features>,
  documentFrequency: ReadonlyMap<string, number>,
  corpusSize: number,
): readonly string[] {
  const anchorTokens = new Set([
    ...byRef.get(anchors[0].listingRef)!.tokens,
    ...byRef.get(anchors[1].listingRef)!.tokens,
  ]);
  const maximumFrequency = Math.max(8, Math.ceil(corpusSize / 5));
  return Object.freeze([...tokens(question)]
    .filter((term) =>
      anchorTokens.has(term) &&
      (documentFrequency.get(term) ?? corpusSize) <= maximumFrequency
    )
    .sort((left, right) =>
      (documentFrequency.get(left) ?? corpusSize) -
        (documentFrequency.get(right) ?? corpusSize) ||
      left.localeCompare(right)
    )
    .slice(0, MAX_QUERY_SIGNALS));
}

function queryRoutingScore(
  signals: readonly string[],
  documentFrequency: ReadonlyMap<string, number>,
  corpusSize: number,
): number | null {
  if (signals.length === 0) return null;
  return signals.length * 100 + signals.reduce(
    (score, signal) => score + Math.max(1, corpusSize - (documentFrequency.get(signal) ?? corpusSize)),
    0,
  );
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
      if (shared.length < 2) return null;
      return core + 10 +
        (left.range.length + right.range.length + left.numbers.length + right.numbers.length > 0
          ? 20
          : 0) +
        (differs(left.numbers, right.numbers) ? 35 : 0) +
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

type HeuristicTrailheadSelection = Readonly<{
  context: DiscoveryCatalogContext;
  trailhead: HeuristicDiscoveryTrailhead;
}>;

function familyCueScore(family: SearchSemanticFamily, value: Features): number {
  switch (family) {
    case "TEMPORAL_IMPOSSIBILITY":
      return value.temporal.length * 4 + value.physical.length * 5 +
        value.incapacity.length * 8;
    case "EVENT_CONTAINMENT":
      return value.containment.length * 6 + value.numbers.length * 5 +
        value.temporal.length * 3;
    case "PARTITION_COMPLETENESS":
      return value.range.length * 7 + value.numbers.length * 5;
    case "IDENTITY_SUCCESSION":
      return value.identity.length * 7 + value.temporal.length * 2;
    case "PHYSICAL_CO_OCCURRENCE":
      return value.physical.length * 7 + value.temporal.length * 3 +
        value.incapacity.length * 5;
  }
}

function heuristicSeedSignals(
  value: Features,
  documentFrequency: ReadonlyMap<string, number>,
): readonly string[] {
  return Object.freeze([...value.tokens]
    .sort((left, right) =>
      (documentFrequency.get(left) ?? 0) - (documentFrequency.get(right) ?? 0) ||
      left.localeCompare(right)
    )
    .slice(0, MAX_SHARED_SIGNALS));
}

type HeuristicDiscoveryTrailheadBody =
  | Omit<RareSeedDiscoveryTrailhead, "trailheadIdentity">
  | Omit<OntologyDiscoveryTrailhead, "trailheadIdentity">;

function withTrailheadIdentity(
  body: HeuristicDiscoveryTrailheadBody,
): HeuristicDiscoveryTrailhead {
  return Object.freeze({ ...body, trailheadIdentity: hashCanonical(body) });
}

function buildOntologyTrailhead(
  source: DiscoveryCatalogContextSource,
  corpusIdentity: Hash,
  listings: readonly DiscoveryCatalogListing[],
  maximum: number,
  feedback: DiscoveryContextRoutingFeedback,
): HeuristicTrailheadSelection | null {
  if (listings.length < 2) return null;
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: corpusIdentity,
    eligibleSourceCount: new Set(listings.map((item) => item.venueId)).size,
    excludedSourceCount: 0,
    listings,
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const byRef = new Map(listings.map((item) => [item.listingRef, item]));
  const variants = ontology.trailheads.flatMap((trailhead) => {
    const anchors = trailhead.listingRefs.map((ref) => byRef.get(ref))
      .filter((item): item is DiscoveryCatalogListing => item !== undefined);
    if (anchors.length !== 2) return [];
    let context = buildExactDiscoveryCatalogContext(source, anchors);
    const shared = new Set(trailhead.sharedSubjectSignals);
    const related = ontology.nodes
      .filter((node) => !trailhead.listingRefs.includes(node.listingRef) &&
        node.worldFacet.subjectSignals.some((signal) => shared.has(signal)))
      .sort((left, right) => left.listingRef.localeCompare(right.listingRef));
    const selected = [...anchors];
    for (const node of related) {
      if (selected.length >= maximum) break;
      const listing = byRef.get(node.listingRef);
      if (listing === undefined) continue;
      try {
        const candidate = buildExactDiscoveryCatalogContext(source, [...selected, listing]);
        selected.push(listing);
        context = candidate;
      } catch {
        // Skip a verbose listing rather than crossing the immutable context cap.
      }
    }
    const body = Object.freeze({
      schemaVersion: "pmh.heuristic-discovery-trailhead.v2" as const,
      kind: "ONTOLOGY_DIVERGENCE" as const,
      sourceOntologyIdentity: ontology.ontologyIdentity,
      ontologyTrailheadId: trailhead.trailheadId,
      anchorListingRefs: trailhead.listingRefs,
      sharedSubjectSignals: trailhead.sharedSubjectSignals,
      changedFacets: trailhead.changedFacets,
      searchQuestion: trailhead.searchQuestion,
      score: trailhead.score,
      authority: "SEARCH_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    return [Object.freeze({
      context,
      trailhead: withTrailheadIdentity(body),
    })];
  });
  if (variants.length === 0) return null;
  return variants.sort((left, right) =>
    selectionTier(left.context, feedback) - selectionTier(right.context, feedback) ||
    right.trailhead.score - left.trailhead.score ||
    left.trailhead.trailheadIdentity.localeCompare(right.trailhead.trailheadIdentity)
  )[0]!;
}

function buildHeuristicTrailhead(
  source: DiscoveryCatalogContextSource,
  listings: readonly DiscoveryCatalogListing[],
  maximum: number,
  semanticFamily: SearchSemanticFamily,
  byRef: ReadonlyMap<string, Features>,
  documentFrequency: ReadonlyMap<string, number>,
  feedback: DiscoveryContextRoutingFeedback,
): HeuristicTrailheadSelection | null {
  const rarityScore = (listing: DiscoveryCatalogListing): number => {
    const listingFeatures = byRef.get(listing.listingRef)!;
    const total = [...listingFeatures.tokens].reduce(
      (score, token) => score + Math.max(1, listings.length -
        (documentFrequency.get(token) ?? listings.length)),
      0,
    );
    return Math.floor(total / Math.max(1, listingFeatures.tokens.size));
  };
  const seedScore = (listing: DiscoveryCatalogListing): number =>
    familyCueScore(semanticFamily, byRef.get(listing.listingRef)!) * 10_000 +
      rarityScore(listing);
  const rankedSeeds = [...listings].sort((left, right) =>
    seedScore(right) - seedScore(left) ||
    left.listingRef.localeCompare(right.listingRef)
  );
  const variants: HeuristicTrailheadSelection[] = [];
  for (const seed of rankedSeeds.slice(0, Math.min(16, rankedSeeds.length))) {
    const seedFeatures = byRef.get(seed.listingRef)!;
    const related = listings
      .filter((listing) => listing.listingRef !== seed.listingRef)
      .map((listing) => {
        const listingFeatures = byRef.get(listing.listingRef)!;
        const shared = intersection(seedFeatures.tokens, listingFeatures.tokens);
        const sharedScore = shared.reduce(
          (score, token) => score + Math.max(1, listings.length -
            (documentFrequency.get(token) ?? listings.length)),
          0,
        );
        return Object.freeze({
          listing,
          sharedScore,
          score: sharedScore * 100 +
            Math.min(familyCueScore(semanticFamily, listingFeatures), 50) * 10 +
            (listing.venueId === seed.venueId ? 0 : 25),
        });
      })
      .filter((item) => item.sharedScore > 0)
      .sort((left, right) =>
        right.score - left.score ||
        left.listing.listingRef.localeCompare(right.listing.listingRef)
      );
    if (related.length === 0) continue;
    const selected = [seed];
    let context = buildExactDiscoveryCatalogContext(source, selected);
    for (const { listing } of related) {
      if (selected.length >= maximum) break;
      try {
        const candidate = buildExactDiscoveryCatalogContext(source, [...selected, listing]);
        selected.push(listing);
        context = candidate;
      } catch {
        // Skip a verbose listing rather than crossing the immutable context cap.
      }
    }
    if (selected.length < 2 || variants.some((item) =>
      item.context.contextIdentity === context.contextIdentity
    )) continue;
    const seedSignals = heuristicSeedSignals(seedFeatures, documentFrequency);
    if (seedSignals.length === 0) continue;
    const body = Object.freeze({
      schemaVersion: "pmh.heuristic-discovery-trailhead.v1" as const,
      kind: "RARE_SEED_NEIGHBORHOOD" as const,
      seedListingRef: seed.listingRef,
      seedTitle: seed.title.slice(0, 300),
      relatedListingRefs: Object.freeze(selected.slice(1).map((item) => item.listingRef)),
      seedSignals,
      score: seedScore(seed) + related.slice(0, selected.length - 1).reduce(
        (sum, item) => sum + item.score,
        0,
      ),
      authority: "SEARCH_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    variants.push(Object.freeze({
      context,
      trailhead: withTrailheadIdentity(body),
    }));
  }
  if (variants.length === 0) return null;
  return variants.reduce((best, candidate) =>
    selectionTier(candidate.context, feedback) < selectionTier(best.context, feedback)
      ? candidate
      : best
  );
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

function validHeuristicTrailhead(value: unknown): value is HeuristicDiscoveryTrailhead {
  if (value === null || typeof value !== "object") return false;
  const trailhead = value as HeuristicDiscoveryTrailhead;
  const { trailheadIdentity, ...body } = trailhead;
  const common =
    HASH_PATTERN.test(String(trailheadIdentity)) &&
    trailheadIdentity === hashCanonical(body) &&
    Number.isSafeInteger(trailhead.score) && trailhead.score > 0 &&
    trailhead.authority === "SEARCH_ROUTING_ONLY" &&
    trailhead.semanticDecisionAuthority === false &&
    trailhead.probabilityAuthority === false &&
    trailhead.certificateAuthority === false &&
    trailhead.executionAuthority === false;
  if (!common) return false;
  if (trailhead.schemaVersion === "pmh.heuristic-discovery-trailhead.v1" &&
    trailhead.kind === "RARE_SEED_NEIGHBORHOOD") {
    return typeof trailhead.seedListingRef === "string" &&
      trailhead.seedListingRef.trim() !== "" &&
      (trailhead.seedTitle === undefined || (
        typeof trailhead.seedTitle === "string" && trailhead.seedTitle.trim() !== "" &&
        trailhead.seedTitle.length <= 300
      )) &&
      Array.isArray(trailhead.relatedListingRefs) &&
      trailhead.relatedListingRefs.length >= 1 &&
      trailhead.relatedListingRefs.length <= 29 &&
      new Set(trailhead.relatedListingRefs).size === trailhead.relatedListingRefs.length &&
      !trailhead.relatedListingRefs.includes(trailhead.seedListingRef) &&
      trailhead.relatedListingRefs.every((item) =>
        typeof item === "string" && item.trim() !== ""
      ) &&
      Array.isArray(trailhead.seedSignals) && trailhead.seedSignals.length >= 1 &&
      trailhead.seedSignals.length <= MAX_SHARED_SIGNALS &&
      new Set(trailhead.seedSignals).size === trailhead.seedSignals.length &&
      trailhead.seedSignals.every((item) => typeof item === "string" && item.trim() !== "");
  }
  if (trailhead.schemaVersion === "pmh.heuristic-discovery-trailhead.v2" &&
    trailhead.kind === "ONTOLOGY_DIVERGENCE") {
    return HASH_PATTERN.test(String(trailhead.sourceOntologyIdentity)) &&
      HASH_PATTERN.test(String(trailhead.ontologyTrailheadId)) &&
      Array.isArray(trailhead.anchorListingRefs) && trailhead.anchorListingRefs.length === 2 &&
      new Set(trailhead.anchorListingRefs).size === 2 &&
      trailhead.anchorListingRefs.every((item) => typeof item === "string" && item.trim() !== "") &&
      Array.isArray(trailhead.sharedSubjectSignals) &&
      trailhead.sharedSubjectSignals.length >= 1 &&
      trailhead.sharedSubjectSignals.length <= MAX_SHARED_SIGNALS &&
      Array.isArray(trailhead.changedFacets) && trailhead.changedFacets.length >= 1 &&
      trailhead.changedFacets.length <= 8 &&
      typeof trailhead.searchQuestion === "string" &&
      trailhead.searchQuestion.length >= 1 && trailhead.searchQuestion.length <= 1_000;
  }
  return false;
}

export function assertSemanticFamilyRetrievalPlan(
  value: unknown,
): SemanticFamilyRetrievalPlan {
  if (value === null || typeof value !== "object") {
    throw new Error("semantic family retrieval plan is malformed");
  }
  const plan = value as SemanticFamilyRetrievalPlan;
  const { planIdentity, ...body } = plan;
  const isV1 = plan.algorithmVersion === "pmh.semantic-family-retrieval.v1";
  const isV2 = plan.algorithmVersion === "pmh.semantic-family-retrieval.v2";
  const isV3 = plan.algorithmVersion === "pmh.semantic-family-retrieval.v3";
  const isV4 = plan.algorithmVersion === "pmh.semantic-family-retrieval.v4";
  const isV5 = plan.algorithmVersion === "pmh.semantic-family-retrieval.v5";
  const isV6 = plan.algorithmVersion === "pmh.semantic-family-retrieval.v6";
  const querySignals = plan.querySignals ?? [];
  const queryScore = plan.queryScore ?? null;
  const sampleListingRefs = plan.sampleListingRefs ?? [];
  const heuristicTrailhead = plan.heuristicTrailhead ?? null;
  if (
    plan.schemaVersion !== "pmh.semantic-family-retrieval.v1" ||
    (!isV1 && !isV2 && !isV3 && !isV4 && !isV5 && !isV6) ||
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
      "FRESH_FAMILY_NEIGHBORHOOD", "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD",
      "ROUTING_ATTEMPTED_FALLBACK",
      "SEMANTIC_COMPLETED_FALLBACK", "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK",
      "NO_FAMILY_NEIGHBORHOOD_CORPUS_SAMPLE",
      "NO_FAMILY_NEIGHBORHOOD_HEURISTIC_TRAILHEAD",
      "NO_COHERENT_HEURISTIC_TRAILHEAD",
    ].includes(plan.selectionReason) ||
    !Array.isArray(plan.anchorListingRefs) || plan.anchorListingRefs.length > 2 ||
    plan.anchorListingRefs.some((item) => typeof item !== "string" || item.trim() === "") ||
    !Array.isArray(plan.sharedSignals) || plan.sharedSignals.length > MAX_SHARED_SIGNALS ||
    plan.sharedSignals.some((item) => typeof item !== "string" || item.trim() === "") ||
    (plan.score !== null && (!Number.isSafeInteger(plan.score) || plan.score < 0)) ||
    (isV1 && (
      plan.querySignals !== undefined || plan.queryScore !== undefined ||
      plan.routingMode !== undefined || plan.sampleListingRefs !== undefined ||
      plan.heuristicTrailhead !== undefined
    )) ||
    (isV2 && (
      !Array.isArray(plan.querySignals) || querySignals.length > MAX_QUERY_SIGNALS ||
      querySignals.some((item) => typeof item !== "string" || item.trim() === "") ||
      (queryScore !== null && (!Number.isSafeInteger(queryScore) || queryScore < 1)) ||
      ((querySignals.length === 0) !== (queryScore === null)) ||
      ((plan.selectionReason === "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD") !==
        (querySignals.length > 0))
    )) ||
    (isV2 && (
      plan.routingMode !== undefined || plan.sampleListingRefs !== undefined ||
      plan.heuristicTrailhead !== undefined
    )) ||
    (isV3 && (
      (plan.routingMode !== "HEURISTIC_FIRST" && plan.routingMode !== "QUERY_FIRST") ||
      !Array.isArray(plan.querySignals) || querySignals.length > MAX_QUERY_SIGNALS ||
      querySignals.some((item) => typeof item !== "string" || item.trim() === "") ||
      (queryScore !== null && (!Number.isSafeInteger(queryScore) || queryScore < 1)) ||
      ((querySignals.length === 0) !== (queryScore === null)) ||
      (plan.routingMode === "HEURISTIC_FIRST" && (
        querySignals.length !== 0 || queryScore !== null ||
        plan.selectionReason === "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD"
      )) ||
      (plan.routingMode === "QUERY_FIRST" &&
        ((plan.selectionReason === "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD") !==
          (querySignals.length > 0))) ||
      !Array.isArray(plan.sampleListingRefs) || sampleListingRefs.length > 30 ||
      new Set(sampleListingRefs).size !== sampleListingRefs.length ||
      sampleListingRefs.some((item) => typeof item !== "string" || item.trim() === "")
    )) ||
    (isV3 && plan.heuristicTrailhead !== undefined) ||
    ((isV4 || isV5 || isV6) && (
      (plan.routingMode !== "HEURISTIC_FIRST" && plan.routingMode !== "QUERY_FIRST") ||
      !Array.isArray(plan.querySignals) || querySignals.length > MAX_QUERY_SIGNALS ||
      querySignals.some((item) => typeof item !== "string" || item.trim() === "") ||
      (queryScore !== null && (!Number.isSafeInteger(queryScore) || queryScore < 1)) ||
      ((querySignals.length === 0) !== (queryScore === null)) ||
      (plan.routingMode === "HEURISTIC_FIRST" && (
        querySignals.length !== 0 || queryScore !== null ||
        plan.selectionReason === "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD"
      )) ||
      (plan.routingMode === "QUERY_FIRST" &&
        ((plan.selectionReason === "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD") !==
          (querySignals.length > 0))) ||
      plan.sampleListingRefs !== undefined ||
      (heuristicTrailhead !== null && !validHeuristicTrailhead(heuristicTrailhead)) ||
      (plan.neighborhoodCount === 0 && (
        plan.routingMode === "QUERY_FIRST"
          ? plan.selectionReason !== "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK" ||
            heuristicTrailhead !== null
          : plan.selectionReason === "NO_FAMILY_NEIGHBORHOOD_HEURISTIC_TRAILHEAD"
            ? heuristicTrailhead === null
            : plan.selectionReason === "NO_COHERENT_HEURISTIC_TRAILHEAD"
              ? heuristicTrailhead !== null
              : true
      ))
    )) ||
    !HASH_PATTERN.test(String(plan.selectedContextIdentity)) ||
    plan.authority !== "SEARCH_ROUTING_ONLY" ||
    plan.semanticDecisionAuthority !== false || plan.probabilityAuthority !== false ||
    plan.certificateAuthority !== false || plan.executionAuthority !== false ||
    (plan.neighborhoodCount === 0
      ? plan.selectedNeighborhoodRank !== null || plan.anchorListingRefs.length !== 0 ||
        plan.sharedSignals.length !== 0 || plan.score !== null ||
        ((isV2 || isV3 || isV4 || isV5 || isV6) &&
          (querySignals.length !== 0 || queryScore !== null)) ||
        (isV3 && (
          plan.selectionReason === "NO_FAMILY_NEIGHBORHOOD_CORPUS_SAMPLE"
            ? sampleListingRefs.length === 0
            : sampleListingRefs.length !== 0
        )) ||
        ![
          "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK",
          "NO_FAMILY_NEIGHBORHOOD_CORPUS_SAMPLE",
          "NO_FAMILY_NEIGHBORHOOD_HEURISTIC_TRAILHEAD",
          "NO_COHERENT_HEURISTIC_TRAILHEAD",
        ].includes(plan.selectionReason)
      : plan.selectedNeighborhoodRank === null || plan.anchorListingRefs.length !== 2 ||
        plan.sharedSignals.length === 0 || plan.score === null ||
        (isV3 && sampleListingRefs.length !== 0) ||
        (isV4 && heuristicTrailhead !== null))
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
  routingMode?: SemanticFamilyRoutingMode;
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
  const routingMode = input.routingMode ?? "QUERY_FIRST";
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
    querySignals: readonly string[];
    queryScore: number | null;
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
      if (score !== null) {
        const anchors = Object.freeze([left, right]) as readonly [
          DiscoveryCatalogListing,
          DiscoveryCatalogListing,
        ];
        const querySignals = routingMode === "QUERY_FIRST"
          ? relevantQueryTerms(
              input.question,
              anchors,
              byRef,
              documentFrequency,
              listings.length,
            )
          : Object.freeze([]);
        raw.push(Object.freeze({
          anchors,
          score,
          sharedSignals,
          querySignals,
          queryScore: queryRoutingScore(querySignals, documentFrequency, listings.length),
        }));
      }
    }
  }
  const ranked = raw.sort((left, right) =>
    (right.queryScore ?? 0) - (left.queryScore ?? 0) ||
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
  const queryRelevantIndexes = neighborhoods
    .map((item, index) => ({ index, score: item.queryScore ?? 0 }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.index);
  // QUERY_FIRST is the operator-authored monitoring lane. Once a bounded
  // family-valid neighborhood wins the query ranking, completed-scope
  // feedback must not silently replace the assignment with a less coherent
  // fresh pair. HEURISTIC_FIRST retains scope rotation for open exploration.
  const selectionIndexes = queryRelevantIndexes.length > 0
    ? [queryRelevantIndexes[0]!]
    : neighborhoods.map((_, index) => index);
  for (const index of selectionIndexes) {
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
    const ontologySelection = routingMode === "HEURISTIC_FIRST"
      ? buildOntologyTrailhead(
          input.source,
          input.corpusIdentity,
          listings,
          input.maxContextListings,
          input.feedback,
        )
      : null;
    const heuristicSelection = routingMode === "HEURISTIC_FIRST"
      ? ontologySelection ?? buildHeuristicTrailhead(
          input.source,
          listings,
          input.maxContextListings,
          input.semanticFamily,
          byRef,
          documentFrequency,
          input.feedback,
        )
      : null;
    const fallbackContext = routingMode === "QUERY_FIRST"
      ? buildDiscoveryCatalogContext(input.source, listings, input.question, venueIds)
      : heuristicSelection?.context ?? buildExactDiscoveryCatalogContext(
          input.source,
          listings.slice(0, input.maxContextListings),
        );
    const context = fallbackContext.listings.length <= input.maxContextListings
      ? fallbackContext
      : buildExactDiscoveryCatalogContext(
          input.source,
          fallbackContext.listings.slice(0, input.maxContextListings),
        );
    return Object.freeze({
      catalogContext: context,
      retrievalPlan: withPlanIdentity({
        schemaVersion: "pmh.semantic-family-retrieval.v1",
        algorithmVersion: "pmh.semantic-family-retrieval.v6",
        semanticFamily: input.semanticFamily,
        corpusIdentity: input.corpusIdentity,
        eligibleVenueIds: venueIds,
        maxContextListings: input.maxContextListings,
        neighborhoodCount: 0,
        selectedNeighborhoodRank: null,
        selectionReason: routingMode === "QUERY_FIRST"
          ? "NO_FAMILY_NEIGHBORHOOD_QUERY_FALLBACK"
          : heuristicSelection === null
            ? "NO_COHERENT_HEURISTIC_TRAILHEAD"
            : "NO_FAMILY_NEIGHBORHOOD_HEURISTIC_TRAILHEAD",
        anchorListingRefs: Object.freeze([]),
        sharedSignals: Object.freeze([]),
        score: null,
        querySignals: Object.freeze([]),
        queryScore: null,
        routingMode,
        heuristicTrailhead: heuristicSelection?.trailhead ?? null,
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
  const selectionReason = selected.querySignals.length > 0
    ? "QUERY_RELEVANT_FAMILY_NEIGHBORHOOD"
    : bestTier === 0
      ? "FRESH_FAMILY_NEIGHBORHOOD"
      : bestTier === 1
        ? "ROUTING_ATTEMPTED_FALLBACK"
        : "SEMANTIC_COMPLETED_FALLBACK";
  return Object.freeze({
    catalogContext: selected.context,
    retrievalPlan: withPlanIdentity({
      schemaVersion: "pmh.semantic-family-retrieval.v1",
      algorithmVersion: "pmh.semantic-family-retrieval.v6",
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
      querySignals: selected.querySignals,
      queryScore: selected.queryScore,
      routingMode,
      heuristicTrailhead: null,
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
    if (
      (plan.algorithmVersion === "pmh.semantic-family-retrieval.v4" ||
        plan.algorithmVersion === "pmh.semantic-family-retrieval.v5" ||
        plan.algorithmVersion === "pmh.semantic-family-retrieval.v6") &&
      plan.heuristicTrailhead !== null && plan.heuristicTrailhead !== undefined
    ) {
      if (plan.heuristicTrailhead.kind === "ONTOLOGY_DIVERGENCE") {
        return `Ontology trailhead only (not a semantic or probability judgment): exact refs ${plan.heuristicTrailhead.anchorListingRefs.join(" + ")} share world-reference signals [${plan.heuristicTrailhead.sharedSubjectSignals.join(", ")}] while facets differ [${plan.heuristicTrailhead.changedFacets.join(", ")}]. Inspect world proposition, settlement contract, and traded state separately; test counterexamples before proposing anything.`;
      }
      return `Heuristic trailhead only (not a semantic or probability judgment): seed ${plan.heuristicTrailhead.seedListingRef} with ${plan.heuristicTrailhead.relatedListingRefs.length} related refs from rare signals [${plan.heuristicTrailhead.seedSignals.join(", ")}]. Form a claim only after inspecting exact refs; abstain when no relation is grounded.`;
    }
    if (
      (plan.algorithmVersion === "pmh.semantic-family-retrieval.v4" ||
        plan.algorithmVersion === "pmh.semantic-family-retrieval.v5" ||
        plan.algorithmVersion === "pmh.semantic-family-retrieval.v6") &&
      plan.selectionReason === "NO_COHERENT_HEURISTIC_TRAILHEAD"
    ) {
      return `No coherent ${plan.semanticFamily} heuristic trailhead qualified; inspect the bounded context only for negative evidence and abstain rather than inventing a relation.`;
    }
    return plan.algorithmVersion === "pmh.semantic-family-retrieval.v3" &&
        plan.routingMode === "HEURISTIC_FIRST"
      ? `No deterministic ${plan.semanticFamily} neighborhood qualified. Inspect the ${plan.sampleListingRefs?.length ?? 0}-listing rarity sample for an unexpected relation; form a claim only after reading exact refs, and abstain when none is grounded.`
      : `Family retrieval found no deterministic ${plan.semanticFamily} neighborhood; inspect the bounded query fallback and abstain unless exact refs support a relation.`;
  }
  const queryTrail = (plan.algorithmVersion === "pmh.semantic-family-retrieval.v2" ||
      plan.algorithmVersion === "pmh.semantic-family-retrieval.v3" ||
      plan.algorithmVersion === "pmh.semantic-family-retrieval.v4" ||
      plan.algorithmVersion === "pmh.semantic-family-retrieval.v5" ||
      plan.algorithmVersion === "pmh.semantic-family-retrieval.v6") &&
      (plan.querySignals?.length ?? 0) > 0
    ? ` and matched issue signals [${plan.querySignals!.join(", ")}]`
    : "";
  return `Retrieval trailhead only (not a semantic or probability judgment): ${plan.anchorListingRefs.join(" + ")} were colocated for ${plan.semanticFamily} by shared signals [${plan.sharedSignals.join(", ")}]${queryTrail}. Explicitly test counterexamples before proposing any relation.`;
}
