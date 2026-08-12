import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { DiscoveryCatalogListing } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SUBJECT_SIGNALS = 6;
const MAX_PREDICATE_FAMILIES = 6;
const MAX_TEMPORAL_SIGNALS = 8;
const MAX_PARAMETER_SIGNALS = 8;
const MAX_CLUSTER_LISTINGS = 40;
const MAX_CLUSTERS = 512;
const MAX_TRAILHEADS = 128;
const MAX_PAIR_CANDIDATES = 12_000;
const MAX_PAIR_CANDIDATES_PER_CLUSTER = 48;
const MAX_TRAILHEADS_PER_TOPIC = 2;
const MAX_TRAILHEADS_PER_SIGNAL = 8;
const MAX_TRAILHEADS_PER_RELATION_PATTERN = 3;
const MAX_SINGLE_SIGNAL_WORLD_TRAILHEADS = 4;
const MAX_TITLE_EXCERPT_CHARACTERS = 240;

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "all", "also", "among", "and",
  "any", "are", "before", "between", "both", "could", "does", "during",
  "each", "either", "event", "events", "from", "have", "into", "its",
  "market", "markets", "more", "none", "other", "outcome", "over", "per",
  "prediction", "resolve", "resolves", "settle", "settles", "than", "that",
  "their", "there", "these", "they", "this", "those", "through", "under",
  "until", "upon", "what", "when", "where", "whether", "which", "while",
  "who", "will", "with", "would", "yes", "the", "for", "not", "was",
  "were", "has", "had", "his", "her", "you", "your", "our", "out",
  "close", "closes", "closing", "open", "price", "above", "below", "under",
  "least", "most", "exactly", "before", "after", "during", "winner", "wins",
  "win", "occur", "occurs", "happen", "happens", "make", "become", "remain",
  "publicly", "public", "official", "officially", "calendar", "year", "month",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "today", "tomorrow",
  "how", "get", "gets", "getting", "high", "reg", "time",
]);

const PREDICATE_PATTERNS = Object.freeze([
  ["ELECTION_OR_OFFICE", /\b(?:elect|elected|election|nominee|nomination|president|prime minister|governor|mayor|control (?:the )?(?:house|senate)|speaker)\b/iu],
  ["APPOINTMENT_OR_DEPARTURE", /\b(?:appoint|appointed|appointment|resign|resigns|resigned|leave|leaves|depart|departed|removed|fired|successor|replace|replaced)\b/iu],
  ["DEATH_OR_INCAPACITY", /\b(?:die|dies|death|dead|killed|assassinated|shot|shooting|injured|hospitalized|incapacitated)\b/iu],
  ["PUBLIC_ACTION", /\b(?:appear|attend|debate|drink|eat|livestream|stream|speech|travel|visit|perform|play|announce|say|post|tweet)\b/iu],
  ["SPORTS_RESULT", /\b(?:champion|championship|cup|league|tournament|game|match|score|playoff|final|award|rookie|cy young|mvp|ufc|nba|nfl|mlb|mls)\b/iu],
  ["PRICE_OR_METRIC", /\b(?:price|index|average|rate|inflation|cpi|gdp|unemployment|temperature|rainfall|calls|volume|percent|percentage|bitcoin|btc|ethereum|eth)\b/iu],
  ["POLICY_OR_LEGAL", /\b(?:law|bill|ban|tariff|sanction|ceasefire|treaty|court|convict|indict|approve|approval|regulation|rate cut|rate hike)\b/iu],
  ["CONFLICT_OR_DISRUPTION", /\b(?:war|attack|invade|invasion|strike|shutdown|cancel|canceled|cancelled|postpone|postponed|abandon|abandoned)\b/iu],
  ["WEATHER_OR_NATURAL", /\b(?:weather|temperature|rain|rainfall|snow|storm|hurricane|earthquake|wildfire)\b/iu],
] as const);

const TEMPORAL_PATTERN = /\b(?:20\d{2}|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|today|tomorrow|tonight|before|after|by|during|through|until|between)\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/giu;
const PARAMETER_PATTERN = /(?:\$|€|£)?-?\d+(?:[.,]\d+)*(?:%|bps)?/gu;

export type MarketOntologyPredicateFamily =
  | "ELECTION_OR_OFFICE"
  | "APPOINTMENT_OR_DEPARTURE"
  | "DEATH_OR_INCAPACITY"
  | "PUBLIC_ACTION"
  | "SPORTS_RESULT"
  | "PRICE_OR_METRIC"
  | "POLICY_OR_LEGAL"
  | "CONFLICT_OR_DISRUPTION"
  | "WEATHER_OR_NATURAL"
  | "UNCLASSIFIED";

export type MarketOntologyWorldFacet = Readonly<{
  facetId: Hash;
  listingRef: string;
  subjectSignals: readonly string[];
  predicateFamilies: readonly MarketOntologyPredicateFamily[];
  temporalSignals: readonly string[];
  parameterSignals: readonly string[];
  extractionPosture: "BOUNDED_LEXICAL_ROUTING_HYPOTHESIS";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
}>;

export type MarketOntologySettlementFacet = Readonly<{
  facetId: Hash;
  listingRef: string;
  venueId: string;
  venueInstrumentId: string;
  protocolIdentity: string;
  sourceRawHash: string;
  sourceReceivedAt: string;
  closeBoundary: string | null;
  closeBoundaryPosture: "VENUE_CLOSE_ONLY_NOT_INFERRED_RESOLUTION";
  rulesEvidencePosture: "ABSENT" | "PRESENT_COMPLETE" | "PRESENT_TRUNCATED";
  locatorRoles: readonly string[];
  outcomeShape:
    | "BINARY_YES_NO_LABELS"
    | "TWO_OUTCOME_OTHER_LABELS"
    | "RANGE_LIKE_LABELS"
    | "CATEGORICAL_LABELS";
  outcomeLabels: readonly string[];
  authority: "SETTLEMENT_EVIDENCE_ROUTING_ONLY";
  certificateAuthority: false;
}>;

export type MarketOntologyTradedFacet = Readonly<{
  facetId: Hash;
  listingRef: string;
  mechanism: string;
  marketStatus: string;
  priceScale: string;
  quantityScale: string;
  minPriceTick: string | null;
  indicativePriceStrings: readonly Readonly<{
    venueOutcomeId: string;
    value: string | null;
  }>[];
  pricedOutcomeCount: number;
  pricePosture: "INDICATIVE_VENUE_STRINGS_NOT_WORLD_PROBABILITY";
  feePosture: "NOT_IN_ONTOLOGY_SOURCE";
  depthPosture: "NOT_IN_ONTOLOGY_SOURCE";
  authority: "TRADED_STATE_OBSERVATION_ONLY";
}>;

export type MarketOntologyListingNode = Readonly<{
  nodeId: Hash;
  listingRef: string;
  worldFacet: MarketOntologyWorldFacet;
  settlementFacet: MarketOntologySettlementFacet;
  tradedFacet: MarketOntologyTradedFacet;
}>;

export type MarketOntologyWorldCluster = Readonly<{
  clusterId: Hash;
  subjectSignal: string;
  sourceListingCount: number;
  listingRefs: readonly string[];
  worldFacetIds: readonly Hash[];
  venueIds: readonly string[];
  predicateFamilies: readonly MarketOntologyPredicateFamily[];
  authority: "WORLD_REFERENCE_ROUTING_HYPOTHESIS_ONLY";
  samplingPosture: "RARE_SIGNAL_WITH_VENUE_DIVERSE_BOUNDED_REPRESENTATIVES";
  semanticDecisionAuthority: false;
}>;

export type MarketOntologyChangedFacet =
  | "WORLD_PREDICATE"
  | "WORLD_TIME_SCOPE"
  | "WORLD_PARAMETER"
  | "SETTLEMENT_EVIDENCE"
  | "OUTCOME_SPACE"
  | "VENUE"
  | "MECHANISM"
  | "PRICE_OBSERVATION";

export type MarketOntologyTrailhead = Readonly<{
  trailheadId: Hash;
  listingRefs: readonly [string, string];
  listingTitleExcerpts: readonly [string, string];
  relationPatternId: Hash;
  sharedSubjectSignals: readonly string[];
  changedFacets: readonly MarketOntologyChangedFacet[];
  selectionLane:
    | "CROSS_VENUE"
    | "WORLD_DIVERGENCE"
    | "SETTLEMENT_DIVERGENCE";
  score: number;
  searchQuestion: string;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type MarketOntologySnapshot = Readonly<{
  schemaVersion: "pmh.market-ontology.v1";
  algorithmVersion: "pmh.market-ontology.lexical.v2";
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  listingCount: number;
  worldFacetCount: number;
  settlementFacetCount: number;
  tradedFacetCount: number;
  clusterCount: number;
  trailheadCount: number;
  relationPatternCount: number;
  trailheadLaneCounts: Readonly<{
    crossVenue: number;
    worldDivergence: number;
    settlementDivergence: number;
  }>;
  listingsWithoutSubjectSignals: number;
  nodes: readonly MarketOntologyListingNode[];
  clusters: readonly MarketOntologyWorldCluster[];
  trailheads: readonly MarketOntologyTrailhead[];
  ontologicalPosition:
    "WORLD_PROPOSITION_SETTLEMENT_CONTRACT_AND_TRADED_STATE_ARE_DISTINCT";
  priceInterpretation:
    "TRADED_PAYOFF_VALUATION_OBSERVATION_NOT_CERTIFIED_WORLD_PROBABILITY";
  authority: "DERIVED_SEARCH_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type MarketOntologyProjection = Omit<
  MarketOntologySnapshot,
  "nodes" | "clusters" | "trailheads"
> & Readonly<{
  clusters: readonly MarketOntologyWorldCluster[];
  trailheads: readonly MarketOntologyTrailhead[];
  projectionWindow: Readonly<{
    includedClusterCount: number;
    includedTrailheadCount: number;
    selection: "RARE_WORLD_SIGNALS_AND_DIVERGENCE_COVERAGE_TRAILHEADS";
    historyDeleted: false;
  }>;
}>;

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function canonicalIdentityMatches(
  value: Readonly<Record<string, unknown>>,
  identityField: string,
): boolean {
  const identity = value[identityField];
  if (!HASH_PATTERN.test(String(identity))) return false;
  const body = { ...value };
  delete body[identityField];
  return identity === hashCanonical(body);
}

function normalizedTokens(value: string): readonly string[] {
  return uniqueSorted(value.normalize("NFKC").toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length >= 3 &&
      !/^\d+$/u.test(token) &&
      !/^(?:\d{1,2}(?:am|pm)|edt|est|cst|cdt|mst|mdt|pst|pdt|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/u.test(token) &&
      !STOP_WORDS.has(token)) ?? []);
}

function matchedSignals(value: string, pattern: RegExp, maximum: number): readonly string[] {
  return Object.freeze([...new Set([...value.matchAll(pattern)]
    .map((match) => match[0]!.trim().toLowerCase()))].sort().slice(0, maximum));
}

function predicateFamilies(listing: DiscoveryCatalogListing): readonly MarketOntologyPredicateFamily[] {
  const text = listing.title.normalize("NFKC");
  const matches = PREDICATE_PATTERNS.flatMap(([family, pattern]) =>
    pattern.test(text) ? [family] : []
  ).slice(0, MAX_PREDICATE_FAMILIES);
  return Object.freeze(matches.length === 0 ? ["UNCLASSIFIED"] : matches);
}

function outcomeShape(listing: DiscoveryCatalogListing): MarketOntologySettlementFacet["outcomeShape"] {
  const labels = listing.outcomes.map((outcome) => outcome.label.trim().toLowerCase());
  if (labels.length === 2 && labels.includes("yes") && labels.includes("no")) {
    return "BINARY_YES_NO_LABELS";
  }
  if (labels.some((label) => /\b(?:under|below|above|over|between|or less|or more|range)\b|\d/iu.test(label))) {
    return "RANGE_LIKE_LABELS";
  }
  return labels.length === 2 ? "TWO_OUTCOME_OTHER_LABELS" : "CATEGORICAL_LABELS";
}

function rulesEvidencePosture(listing: DiscoveryCatalogListing): MarketOntologySettlementFacet["rulesEvidencePosture"] {
  if (listing.rulesText === null || listing.rulesText.trim() === "") return "ABSENT";
  return listing.rulesTextPosture === "TRUNCATED" ? "PRESENT_TRUNCATED" : "PRESENT_COMPLETE";
}

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function changedFacets(
  left: MarketOntologyListingNode,
  right: MarketOntologyListingNode,
): readonly MarketOntologyChangedFacet[] {
  const values: MarketOntologyChangedFacet[] = [];
  if (!same(left.worldFacet.predicateFamilies, right.worldFacet.predicateFamilies)) values.push("WORLD_PREDICATE");
  if (!same(left.worldFacet.temporalSignals, right.worldFacet.temporalSignals)) values.push("WORLD_TIME_SCOPE");
  if (!same(left.worldFacet.parameterSignals, right.worldFacet.parameterSignals)) values.push("WORLD_PARAMETER");
  if (
    left.settlementFacet.rulesEvidencePosture !== right.settlementFacet.rulesEvidencePosture ||
    !same(left.settlementFacet.locatorRoles, right.settlementFacet.locatorRoles) ||
    left.settlementFacet.protocolIdentity !== right.settlementFacet.protocolIdentity ||
    left.settlementFacet.closeBoundary !== right.settlementFacet.closeBoundary
  ) values.push("SETTLEMENT_EVIDENCE");
  if (
    left.settlementFacet.outcomeShape !== right.settlementFacet.outcomeShape ||
    !same(left.settlementFacet.outcomeLabels, right.settlementFacet.outcomeLabels)
  ) values.push("OUTCOME_SPACE");
  if (left.settlementFacet.venueId !== right.settlementFacet.venueId) values.push("VENUE");
  if (left.tradedFacet.mechanism !== right.tradedFacet.mechanism) values.push("MECHANISM");
  if (!same(
    left.tradedFacet.indicativePriceStrings.map((item) => `${item.venueOutcomeId}:${item.value ?? ""}`),
    right.tradedFacet.indicativePriceStrings.map((item) => `${item.venueOutcomeId}:${item.value ?? ""}`),
  )) values.push("PRICE_OBSERVATION");
  return Object.freeze(values);
}

function trailheadQuestion(
  titles: readonly [string, string],
  shared: readonly string[],
  changed: readonly MarketOntologyChangedFacet[],
): string {
  return `Inspect exact contracts "${titles[0]}" and "${titles[1]}" sharing world-reference signals [${shared.join(", ")}] while facets differ [${changed.join(", ")}]. Determine whether the difference is world semantics, settlement rules, traded state, or no grounded relation; test counterexamples before proposing anything.`;
}

const WORLD_DIVERGENCE_FACETS = new Set<MarketOntologyChangedFacet>([
  "WORLD_PREDICATE",
  "WORLD_TIME_SCOPE",
  "WORLD_PARAMETER",
]);

const SETTLEMENT_DIVERGENCE_FACETS = new Set<MarketOntologyChangedFacet>([
  "SETTLEMENT_EVIDENCE",
  "OUTCOME_SPACE",
  "MECHANISM",
]);

function selectionLane(
  changed: readonly MarketOntologyChangedFacet[],
): MarketOntologyTrailhead["selectionLane"] {
  if (changed.includes("VENUE")) return "CROSS_VENUE";
  if (changed.some((facet) => WORLD_DIVERGENCE_FACETS.has(facet))) {
    return "WORLD_DIVERGENCE";
  }
  return "SETTLEMENT_DIVERGENCE";
}

function trailheadScore(input: Readonly<{
  changed: readonly MarketOntologyChangedFacet[];
  sharedSubjectSignals: readonly string[];
  documentFrequency: ReadonlyMap<string, number>;
  listingCount: number;
}>): number {
  const rarity = input.sharedSubjectSignals.reduce((score, signal) => {
    const frequency = input.documentFrequency.get(signal) ?? input.listingCount;
    return score + Math.round(Math.log2((input.listingCount + 1) / (frequency + 1)) * 100);
  }, 0);
  const worldDivergence = input.changed.filter((facet) => WORLD_DIVERGENCE_FACETS.has(facet)).length;
  const settlementDivergence = input.changed.filter((facet) => SETTLEMENT_DIVERGENCE_FACETS.has(facet)).length;
  return rarity +
    Math.max(0, input.sharedSubjectSignals.length - 1) * 1_500 +
    (input.changed.includes("VENUE") ? 5_000 : 0) +
    worldDivergence * 2_000 +
    settlementDivergence * 1_000 +
    (input.changed.includes("OUTCOME_SPACE") ? 750 : 0);
}

function relationPatternId(
  titleExcerpts: readonly [string, string],
  sharedSubjectSignals: readonly string[],
): Hash {
  const shared = new Set(sharedSubjectSignals);
  const patterns = titleExcerpts.map((title) => normalizedTokens(title)
    .filter((token) => !shared.has(token))
    .join(" "))
    .sort();
  return hashCanonical(Object.freeze({ patterns }));
}

export function buildMarketOntologySnapshot(
  corpus: MarketCorpusSnapshot,
): MarketOntologySnapshot {
  const listingsByRef = new Map(corpus.listings.map((listing) => [listing.listingRef, listing]));
  const documentFrequency = new Map<string, number>();
  const tokensByRef = new Map<string, readonly string[]>();
  for (const listing of corpus.listings) {
    // The venue title is the closest catalog-level observation of the world
    // proposition. Description/rules prose belongs to settlement evidence and
    // must not silently redefine the world facet.
    const values = normalizedTokens(listing.title);
    tokensByRef.set(listing.listingRef, values);
    for (const token of values) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  const maximumSubjectFrequency = Math.max(12, Math.ceil(corpus.listingCount / 20));
  const nodes = Object.freeze([...corpus.listings]
    .sort((left, right) => left.listingRef.localeCompare(right.listingRef))
    .map((listing) => {
      const subjectSignals = Object.freeze([...(tokensByRef.get(listing.listingRef) ?? [])]
        .filter((token) => (documentFrequency.get(token) ?? corpus.listingCount) <= maximumSubjectFrequency)
        .sort((left, right) =>
          (documentFrequency.get(left) ?? corpus.listingCount) -
            (documentFrequency.get(right) ?? corpus.listingCount) || left.localeCompare(right)
        )
        .slice(0, MAX_SUBJECT_SIGNALS));
      const worldBody = Object.freeze({
        listingRef: listing.listingRef,
        subjectSignals,
        predicateFamilies: predicateFamilies(listing),
        temporalSignals: matchedSignals(listing.title, TEMPORAL_PATTERN, MAX_TEMPORAL_SIGNALS),
        parameterSignals: matchedSignals(listing.title, PARAMETER_PATTERN, MAX_PARAMETER_SIGNALS),
        extractionPosture: "BOUNDED_LEXICAL_ROUTING_HYPOTHESIS" as const,
        semanticDecisionAuthority: false as const,
        probabilityAuthority: false as const,
      });
      const settlementBody = Object.freeze({
        listingRef: listing.listingRef,
        venueId: listing.venueId,
        venueInstrumentId: listing.venueInstrumentId,
        protocolIdentity: listing.protocolIdentity,
        sourceRawHash: listing.sourceRawHash,
        sourceReceivedAt: listing.sourceReceivedAt,
        closeBoundary: listing.closesAt,
        closeBoundaryPosture: "VENUE_CLOSE_ONLY_NOT_INFERRED_RESOLUTION" as const,
        rulesEvidencePosture: rulesEvidencePosture(listing),
        locatorRoles: uniqueSorted((listing.evidenceLocators ?? []).map((item) => item.role)),
        outcomeShape: outcomeShape(listing),
        outcomeLabels: Object.freeze(listing.outcomes.map((outcome) => outcome.label)),
        authority: "SETTLEMENT_EVIDENCE_ROUTING_ONLY" as const,
        certificateAuthority: false as const,
      });
      const indicativePriceStrings = Object.freeze(listing.outcomes.map((outcome) => Object.freeze({
        venueOutcomeId: outcome.venueOutcomeId,
        value: outcome.indicativePrice,
      })));
      const tradedBody = Object.freeze({
        listingRef: listing.listingRef,
        mechanism: listing.mechanism,
        marketStatus: listing.status,
        priceScale: listing.priceScale,
        quantityScale: listing.quantityScale,
        minPriceTick: listing.minPriceTick,
        indicativePriceStrings,
        pricedOutcomeCount: indicativePriceStrings.filter((item) => item.value !== null).length,
        pricePosture: "INDICATIVE_VENUE_STRINGS_NOT_WORLD_PROBABILITY" as const,
        feePosture: "NOT_IN_ONTOLOGY_SOURCE" as const,
        depthPosture: "NOT_IN_ONTOLOGY_SOURCE" as const,
        authority: "TRADED_STATE_OBSERVATION_ONLY" as const,
      });
      const worldFacet = Object.freeze({ ...worldBody, facetId: hashCanonical(worldBody) });
      const settlementFacet = Object.freeze({ ...settlementBody, facetId: hashCanonical(settlementBody) });
      const tradedFacet = Object.freeze({ ...tradedBody, facetId: hashCanonical(tradedBody) });
      const body = Object.freeze({ listingRef: listing.listingRef, worldFacet, settlementFacet, tradedFacet });
      return Object.freeze({ ...body, nodeId: hashCanonical(body) });
    }));

  const nodesBySignal = new Map<string, MarketOntologyListingNode[]>();
  const nodesByRef = new Map(nodes.map((node) => [node.listingRef, node]));
  for (const node of nodes) {
    for (const signal of node.worldFacet.subjectSignals) {
      const values = nodesBySignal.get(signal) ?? [];
      values.push(node);
      nodesBySignal.set(signal, values);
    }
  }
  const clusters = Object.freeze([...nodesBySignal.entries()]
    .filter(([, values]) => values.length >= 2)
    .map(([subjectSignal, values]) => {
      const sorted = [...values].sort((left, right) => left.listingRef.localeCompare(right.listingRef));
      const byVenue = new Map<string, MarketOntologyListingNode[]>();
      for (const node of sorted) {
        const venueNodes = byVenue.get(node.settlementFacet.venueId) ?? [];
        venueNodes.push(node);
        byVenue.set(node.settlementFacet.venueId, venueNodes);
      }
      const representatives: MarketOntologyListingNode[] = [];
      let venueOffset = 0;
      while (representatives.length < Math.min(sorted.length, MAX_CLUSTER_LISTINGS)) {
        let added = false;
        for (const venueId of [...byVenue.keys()].sort()) {
          const candidate = byVenue.get(venueId)?.[venueOffset];
          if (candidate === undefined) continue;
          representatives.push(candidate);
          added = true;
          if (representatives.length >= MAX_CLUSTER_LISTINGS) break;
        }
        if (!added) break;
        venueOffset += 1;
      }
      representatives.sort((left, right) => left.listingRef.localeCompare(right.listingRef));
      const body = Object.freeze({
        subjectSignal,
        sourceListingCount: sorted.length,
        listingRefs: Object.freeze(representatives.map((item) => item.listingRef)),
        worldFacetIds: Object.freeze(representatives.map((item) => item.worldFacet.facetId)),
        venueIds: uniqueSorted(sorted.map((item) => item.settlementFacet.venueId)),
        predicateFamilies: uniqueSorted(sorted.flatMap((item) => item.worldFacet.predicateFamilies)) as readonly MarketOntologyPredicateFamily[],
        authority: "WORLD_REFERENCE_ROUTING_HYPOTHESIS_ONLY" as const,
        samplingPosture: "RARE_SIGNAL_WITH_VENUE_DIVERSE_BOUNDED_REPRESENTATIVES" as const,
        semanticDecisionAuthority: false as const,
      });
      return Object.freeze({ ...body, clusterId: hashCanonical(body) });
    })
    .sort((left, right) =>
      left.sourceListingCount - right.sourceListingCount ||
      right.venueIds.length - left.venueIds.length ||
      right.predicateFamilies.length - left.predicateFamilies.length ||
      left.subjectSignal.localeCompare(right.subjectSignal)
    )
    .slice(0, MAX_CLUSTERS));

  type PairCandidate = Readonly<{
    pair: readonly [MarketOntologyListingNode, MarketOntologyListingNode];
    changed: readonly MarketOntologyChangedFacet[];
    sharedSubjectSignals: readonly string[];
    score: number;
  }>;
  const pairs = new Map<string, PairCandidate>();
  for (const cluster of clusters) {
    if (pairs.size >= MAX_PAIR_CANDIDATES) break;
    const clusterNodes = cluster.listingRefs.map((ref) => nodesByRef.get(ref)!);
    const clusterCandidates: PairCandidate[] = [];
    for (let leftIndex = 0; leftIndex < clusterNodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < clusterNodes.length; rightIndex += 1) {
        const left = clusterNodes[leftIndex]!;
        const right = clusterNodes[rightIndex]!;
        const changed = changedFacets(left, right);
        const meaningfulChanged = changed.filter((facet) => facet !== "PRICE_OBSERVATION");
        if (meaningfulChanged.length === 0) continue;
        const sharedSubjectSignals = uniqueSorted(left.worldFacet.subjectSignals.filter((signal) =>
          right.worldFacet.subjectSignals.includes(signal)
        ));
        const lane = selectionLane(changed);
        if (
          lane === "WORLD_DIVERGENCE" &&
          sharedSubjectSignals.length === 1 &&
          (documentFrequency.get(sharedSubjectSignals[0]!) ?? 0) < 3
        ) continue;
        clusterCandidates.push(Object.freeze({
          pair: Object.freeze([left, right]) as readonly [
            MarketOntologyListingNode,
            MarketOntologyListingNode,
          ],
          changed,
          sharedSubjectSignals,
          score: trailheadScore({
            changed,
            sharedSubjectSignals,
            documentFrequency,
            listingCount: corpus.listingCount,
          }),
        }));
      }
    }
    clusterCandidates.sort((left, right) => right.score - left.score ||
      `${left.pair[0].listingRef}\n${left.pair[1].listingRef}`.localeCompare(
        `${right.pair[0].listingRef}\n${right.pair[1].listingRef}`,
      ));
    for (const candidate of clusterCandidates.slice(0, MAX_PAIR_CANDIDATES_PER_CLUSTER)) {
      const key = `${candidate.pair[0].listingRef}\n${candidate.pair[1].listingRef}`;
      const existing = pairs.get(key);
      if (existing === undefined || candidate.score > existing.score) pairs.set(key, candidate);
      if (pairs.size >= MAX_PAIR_CANDIDATES) break;
    }
  }
  const rankedTrailheads = [...pairs.values()].map((candidate) => {
    const [left, right] = candidate.pair;
    const titleExcerpts = Object.freeze([
      listingsByRef.get(left.listingRef)!.title.slice(0, MAX_TITLE_EXCERPT_CHARACTERS),
      listingsByRef.get(right.listingRef)!.title.slice(0, MAX_TITLE_EXCERPT_CHARACTERS),
    ]) as readonly [string, string];
    const body = Object.freeze({
      listingRefs: Object.freeze([left.listingRef, right.listingRef]) as readonly [string, string],
      listingTitleExcerpts: titleExcerpts,
      relationPatternId: relationPatternId(titleExcerpts, candidate.sharedSubjectSignals),
      sharedSubjectSignals: candidate.sharedSubjectSignals,
      changedFacets: candidate.changed,
      selectionLane: selectionLane(candidate.changed),
      score: candidate.score,
      searchQuestion: trailheadQuestion(titleExcerpts, candidate.sharedSubjectSignals, candidate.changed),
      authority: "SEARCH_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    return Object.freeze({ ...body, trailheadId: hashCanonical(body) });
  }).sort((left, right) => {
    const laneRank = { CROSS_VENUE: 0, WORLD_DIVERGENCE: 1, SETTLEMENT_DIVERGENCE: 2 } as const;
    return laneRank[left.selectionLane] - laneRank[right.selectionLane] ||
      right.score - left.score || left.trailheadId.localeCompare(right.trailheadId);
  });
  const selectedTrailheads: MarketOntologyTrailhead[] = [];
  const topicCounts = new Map<string, number>();
  const signalCounts = new Map<string, number>();
  const relationPatternCounts = new Map<Hash, number>();
  const laneTargets: Readonly<Record<MarketOntologyTrailhead["selectionLane"], number>> = Object.freeze({
    CROSS_VENUE: 48,
    WORLD_DIVERGENCE: 48,
    SETTLEMENT_DIVERGENCE: 32,
  });
  const trySelect = (trailhead: MarketOntologyTrailhead, enforceLaneTarget: boolean): boolean => {
    if (selectedTrailheads.includes(trailhead)) return false;
    if (enforceLaneTarget && selectedTrailheads.filter((item) =>
      item.selectionLane === trailhead.selectionLane
    ).length >= laneTargets[trailhead.selectionLane]) return false;
    const topic = trailhead.sharedSubjectSignals.join("\u0000");
    if ((topicCounts.get(topic) ?? 0) >= MAX_TRAILHEADS_PER_TOPIC) return false;
    if ((relationPatternCounts.get(trailhead.relationPatternId) ?? 0) >=
      MAX_TRAILHEADS_PER_RELATION_PATTERN) return false;
    if (
      trailhead.selectionLane === "WORLD_DIVERGENCE" &&
      trailhead.sharedSubjectSignals.length === 1 &&
      selectedTrailheads.filter((item) =>
        item.selectionLane === "WORLD_DIVERGENCE" &&
        item.sharedSubjectSignals.length === 1
      ).length >= MAX_SINGLE_SIGNAL_WORLD_TRAILHEADS
    ) return false;
    if (trailhead.sharedSubjectSignals.some((signal) =>
      (signalCounts.get(signal) ?? 0) >= MAX_TRAILHEADS_PER_SIGNAL
    )) return false;
    selectedTrailheads.push(trailhead);
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    relationPatternCounts.set(
      trailhead.relationPatternId,
      (relationPatternCounts.get(trailhead.relationPatternId) ?? 0) + 1,
    );
    for (const signal of trailhead.sharedSubjectSignals) {
      signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1);
    }
    return true;
  };
  for (const lane of ["CROSS_VENUE", "WORLD_DIVERGENCE", "SETTLEMENT_DIVERGENCE"] as const) {
    for (const trailhead of rankedTrailheads) {
      if (trailhead.selectionLane === lane) trySelect(trailhead, true);
      if (selectedTrailheads.filter((item) => item.selectionLane === lane).length >= laneTargets[lane]) break;
    }
  }
  for (const trailhead of rankedTrailheads) {
    trySelect(trailhead, false);
    if (selectedTrailheads.length >= MAX_TRAILHEADS) break;
  }
  const trailheads = Object.freeze(selectedTrailheads);
  const trailheadLaneCounts = Object.freeze({
    crossVenue: trailheads.filter((item) => item.selectionLane === "CROSS_VENUE").length,
    worldDivergence: trailheads.filter((item) => item.selectionLane === "WORLD_DIVERGENCE").length,
    settlementDivergence: trailheads.filter((item) => item.selectionLane === "SETTLEMENT_DIVERGENCE").length,
  });

  const body = Object.freeze({
    schemaVersion: "pmh.market-ontology.v1" as const,
    algorithmVersion: "pmh.market-ontology.lexical.v2" as const,
    sourceSnapshotIdentity: corpus.snapshotIdentity,
    listingCount: nodes.length,
    worldFacetCount: nodes.length,
    settlementFacetCount: nodes.length,
    tradedFacetCount: nodes.length,
    clusterCount: clusters.length,
    trailheadCount: trailheads.length,
    relationPatternCount: new Set(trailheads.map((item) => item.relationPatternId)).size,
    trailheadLaneCounts,
    listingsWithoutSubjectSignals: nodes.filter((item) => item.worldFacet.subjectSignals.length === 0).length,
    nodes,
    clusters,
    trailheads,
    ontologicalPosition: "WORLD_PROPOSITION_SETTLEMENT_CONTRACT_AND_TRADED_STATE_ARE_DISTINCT" as const,
    priceInterpretation: "TRADED_PAYOFF_VALUATION_OBSERVATION_NOT_CERTIFIED_WORLD_PROBABILITY" as const,
    authority: "DERIVED_SEARCH_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      providerRequests: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, ontologyIdentity: hashCanonical(body) });
}

export function assertMarketOntologySnapshot(value: unknown): MarketOntologySnapshot {
  if (value === null || typeof value !== "object") throw new Error("market ontology is malformed");
  const ontology = value as MarketOntologySnapshot;
  const { ontologyIdentity, ...body } = ontology;
  if (
    ontology.schemaVersion !== "pmh.market-ontology.v1" ||
    ontology.algorithmVersion !== "pmh.market-ontology.lexical.v2" ||
    !HASH_PATTERN.test(String(ontologyIdentity)) || ontologyIdentity !== hashCanonical(body) ||
    !HASH_PATTERN.test(String(ontology.sourceSnapshotIdentity)) ||
    !Array.isArray(ontology.nodes) || ontology.nodes.length !== ontology.listingCount ||
    ontology.worldFacetCount !== ontology.listingCount ||
    ontology.settlementFacetCount !== ontology.listingCount ||
    ontology.tradedFacetCount !== ontology.listingCount ||
    !Array.isArray(ontology.clusters) || ontology.clusters.length !== ontology.clusterCount ||
    !Array.isArray(ontology.trailheads) || ontology.trailheads.length !== ontology.trailheadCount ||
    ontology.relationPatternCount !== new Set(
      ontology.trailheads.map((item) => item.relationPatternId),
    ).size ||
    ontology.trailheadLaneCounts?.crossVenue !== ontology.trailheads.filter((item) =>
      item.selectionLane === "CROSS_VENUE"
    ).length ||
    ontology.trailheadLaneCounts?.worldDivergence !== ontology.trailheads.filter((item) =>
      item.selectionLane === "WORLD_DIVERGENCE"
    ).length ||
    ontology.trailheadLaneCounts?.settlementDivergence !== ontology.trailheads.filter((item) =>
      item.selectionLane === "SETTLEMENT_DIVERGENCE"
    ).length ||
    ontology.listingCount > 5_000 || ontology.clusterCount > MAX_CLUSTERS ||
    ontology.trailheadCount > MAX_TRAILHEADS ||
    new Set(ontology.nodes.map((item) => item.listingRef)).size !== ontology.nodes.length ||
    ontology.nodes.some((item) =>
      !canonicalIdentityMatches(item as unknown as Readonly<Record<string, unknown>>, "nodeId") ||
      !canonicalIdentityMatches(item.worldFacet as unknown as Readonly<Record<string, unknown>>, "facetId") ||
      !canonicalIdentityMatches(item.settlementFacet as unknown as Readonly<Record<string, unknown>>, "facetId") ||
      !canonicalIdentityMatches(item.tradedFacet as unknown as Readonly<Record<string, unknown>>, "facetId") ||
      item.worldFacet.extractionPosture !== "BOUNDED_LEXICAL_ROUTING_HYPOTHESIS" ||
      item.worldFacet.subjectSignals.length > MAX_SUBJECT_SIGNALS ||
      item.worldFacet.semanticDecisionAuthority !== false ||
      item.worldFacet.probabilityAuthority !== false ||
      item.settlementFacet.closeBoundaryPosture !== "VENUE_CLOSE_ONLY_NOT_INFERRED_RESOLUTION" ||
      item.settlementFacet.certificateAuthority !== false ||
      item.tradedFacet.pricePosture !== "INDICATIVE_VENUE_STRINGS_NOT_WORLD_PROBABILITY"
    ) ||
    ontology.clusters.some((item) =>
      !canonicalIdentityMatches(item as unknown as Readonly<Record<string, unknown>>, "clusterId") ||
      !Number.isSafeInteger(item.sourceListingCount) ||
      item.sourceListingCount < item.listingRefs.length ||
      item.listingRefs.length < 2 || item.listingRefs.length > MAX_CLUSTER_LISTINGS ||
      item.authority !== "WORLD_REFERENCE_ROUTING_HYPOTHESIS_ONLY" ||
      item.samplingPosture !== "RARE_SIGNAL_WITH_VENUE_DIVERSE_BOUNDED_REPRESENTATIVES" ||
      item.semanticDecisionAuthority !== false
    ) ||
    ontology.trailheads.some((item) =>
      !canonicalIdentityMatches(item as unknown as Readonly<Record<string, unknown>>, "trailheadId") ||
      item.listingRefs.length !== 2 || item.listingTitleExcerpts.length !== 2 ||
      item.listingTitleExcerpts.some((title: string) => title.length > MAX_TITLE_EXCERPT_CHARACTERS) ||
      item.relationPatternId !== relationPatternId(
        item.listingTitleExcerpts,
        item.sharedSubjectSignals,
      ) ||
      item.sharedSubjectSignals.length === 0 || item.changedFacets.length === 0 ||
      !(["CROSS_VENUE", "WORLD_DIVERGENCE", "SETTLEMENT_DIVERGENCE"] as const)
        .includes(item.selectionLane) ||
      item.authority !== "SEARCH_ROUTING_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false
    ) ||
    ontology.ontologicalPosition !== "WORLD_PROPOSITION_SETTLEMENT_CONTRACT_AND_TRADED_STATE_ARE_DISTINCT" ||
    ontology.priceInterpretation !== "TRADED_PAYOFF_VALUATION_OBSERVATION_NOT_CERTIFIED_WORLD_PROBABILITY" ||
    ontology.authority !== "DERIVED_SEARCH_EVIDENCE_ONLY" ||
    ontology.semanticDecisionAuthority !== false || ontology.probabilityAuthority !== false ||
    ontology.certificateAuthority !== false || ontology.executionAuthority !== false ||
    ontology.effects?.providerRequests !== false || ontology.effects?.externalWrites !== false ||
    ontology.effects?.valueMovingActions !== false || ontology.effects?.liveExecutionEnabled !== false
  ) throw new Error("market ontology violates its bounded authority contract");
  return Object.freeze(ontology);
}

export function projectMarketOntology(
  ontology: MarketOntologySnapshot,
): MarketOntologyProjection {
  assertMarketOntologySnapshot(ontology);
  const { nodes: _nodes, clusters, trailheads, ...summary } = ontology;
  const includedClusters = Object.freeze(clusters.slice(0, 24));
  const includedTrailheads = Object.freeze([
    ...trailheads.filter((item) => item.selectionLane === "CROSS_VENUE").slice(0, 24),
    ...trailheads.filter((item) => item.selectionLane === "WORLD_DIVERGENCE").slice(0, 24),
    ...trailheads.filter((item) => item.selectionLane === "SETTLEMENT_DIVERGENCE").slice(0, 16),
  ]);
  return Object.freeze({
    ...summary,
    clusters: includedClusters,
    trailheads: includedTrailheads,
    projectionWindow: Object.freeze({
      includedClusterCount: includedClusters.length,
      includedTrailheadCount: includedTrailheads.length,
      selection: "RARE_WORLD_SIGNALS_AND_DIVERGENCE_COVERAGE_TRAILHEADS" as const,
      historyDeleted: false as const,
    }),
  });
}
