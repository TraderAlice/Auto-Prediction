import { hashCanonical, type Hash } from "@pmh/domain";
import {
  corpusDialectTitleForms,
  type CorpusDialectTitleForm,
} from "./corpus-dialect-atlas.js";
import type { MarketCorpusSnapshot, MarketCorpusSearchResult } from "./market-corpus.js";
import { marketOntologyPredicateFamiliesForText,
  type MarketOntologyPredicateFamily } from "./market-ontology.js";
import {
  assertMechanismPrototypeExplorationRoleSearchObservation,
  type MechanismPrototypeExplorationRoleSearchObservation,
} from "./mechanism-prototype-guided-exploration.js";

const MAX_GAPS = 16;
const MAX_EXACT_REFS = 12;

export type RepresentationRoleCoverageGap = Readonly<{
  gapId: Hash;
  classification: "SOURCE_ABSENT" | "ONTOLOGY_BLIND_SPOT" | "BRIDGE_GAP" |
    "OBSERVATION_INSUFFICIENT";
  role: "COMPONENT" | "AGGREGATE" | "PAIR_BRIDGE";
  recommendedAction: "ACQUIRE_SOURCE" | "MUTATE_ROLE_ONTOLOGY" |
    "INVESTIGATE_BRIDGE" | "OBSERVE_MORE";
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  sourceSnapshotIdentity: Hash;
  capturedAt: string;
  query: MarketCorpusSearchResult["query"] | null;
  counterpartQuery: MarketCorpusSearchResult["query"] | null;
  rawHitCount: number;
  classifiedHitCount: number;
  unclassifiedHitCount: number;
  pairCount: number;
  exactListingRefs: readonly string[];
  currentCorpusResolvedRefCount: number;
  observedPredicateFamilies: readonly MarketOntologyPredicateFamily[];
  observedTitleForms: readonly CorpusDialectTitleForm[];
  evidenceScope: "EXACT_QUERY_ON_RETAINED_CORPUS_SNAPSHOT";
  diagnosisAuthority: "BOUNDED_REPRESENTATION_FEEDBACK_ONLY";
  lexicalPresenceSemanticAuthority: false;
  roleMutationAuthority: false;
  acquisitionAuthority: false;
  schedulingAuthority: false;
  semanticDecisionAuthority: false;
}>;

export type RepresentationRoleCoverageFeedback = Readonly<{
  schemaVersion: "pmh.representation-role-coverage-feedback.v1";
  feedbackIdentity: Hash;
  currentCorpusSnapshotIdentity: Hash;
  currentCorpusListingCount: number;
  retainedObservationCount: number;
  sourceSnapshotIdentities: readonly Hash[];
  gapCount: number;
  classificationCounts: Readonly<Record<RepresentationRoleCoverageGap["classification"], number>>;
  gaps: readonly RepresentationRoleCoverageGap[];
  taxonomy: Readonly<{
    sourceAbsent: "NO_LEXICAL_HIT_IN_THE_EXACT_QUERY_SCOPE";
    ontologyBlindSpot: "LEXICAL_HITS_EXIST_BUT_FIRST_PARTY_ROLE_CUES_REJECT_ALL";
    bridgeGap: "BOTH_ROLES_CLASSIFY_BUT_NO_EXACT_SHARED_SIGNAL_PAIR_EXISTS";
    observationInsufficient: "OBSERVATION_DOES_NOT_ISOLATE_ONE_CAUSE";
  }>;
  ontologicalPosture:
    "SEARCH_FAILURE_IS_CAUSALLY_TYPED_NOT_PROOF_THAT_A_MARKET_OR_RELATION_DOES_NOT_EXIST";
  authority: "PROVIDER_FREE_REPRESENTATION_DIAGNOSTIC_ONLY";
  automaticMutation: false;
  automaticAcquisition: false;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function compileGap(input: Readonly<{
  corpus: MarketCorpusSnapshot;
  observation: MechanismPrototypeExplorationRoleSearchObservation;
  role: RepresentationRoleCoverageGap["role"];
  classification: RepresentationRoleCoverageGap["classification"];
  query: MarketCorpusSearchResult["query"] | null;
  counterpartQuery: MarketCorpusSearchResult["query"] | null;
  rawHitCount: number;
  classifiedHitCount: number;
  refs: readonly string[];
}>): RepresentationRoleCoverageGap {
  const refs = Object.freeze([...new Set(input.refs)].sort().slice(0, MAX_EXACT_REFS));
  const listings = refs.flatMap((ref) => {
    const listing = input.corpus.listings.find((candidate) => candidate.listingRef === ref);
    return listing === undefined ? [] : [listing];
  });
  const observedPredicateFamilies = Object.freeze([...new Set(listings.flatMap((listing) =>
    marketOntologyPredicateFamiliesForText(listing.title)
  ))].sort()) as readonly MarketOntologyPredicateFamily[];
  const observedTitleForms = Object.freeze([...new Set(listings.flatMap((listing) =>
    corpusDialectTitleForms(listing.title)
  ))].sort()) as readonly CorpusDialectTitleForm[];
  const recommendedAction = input.classification === "SOURCE_ABSENT"
    ? "ACQUIRE_SOURCE" as const
    : input.classification === "ONTOLOGY_BLIND_SPOT"
      ? "MUTATE_ROLE_ONTOLOGY" as const
      : input.classification === "BRIDGE_GAP"
        ? "INVESTIGATE_BRIDGE" as const : "OBSERVE_MORE" as const;
  const body = Object.freeze({
    classification: input.classification,
    role: input.role,
    recommendedAction,
    sourceAgentRunId: input.observation.sourceAgentRunId,
    sourceToolCallId: input.observation.sourceToolCallId,
    sourceSnapshotIdentity: input.observation.result.snapshotIdentity,
    capturedAt: input.observation.capturedAt,
    query: input.query,
    counterpartQuery: input.counterpartQuery,
    rawHitCount: input.rawHitCount,
    classifiedHitCount: input.classifiedHitCount,
    unclassifiedHitCount: refs.length,
    pairCount: input.observation.result.pairCount,
    exactListingRefs: refs,
    currentCorpusResolvedRefCount: listings.length,
    observedPredicateFamilies,
    observedTitleForms,
    evidenceScope: "EXACT_QUERY_ON_RETAINED_CORPUS_SNAPSHOT" as const,
    diagnosisAuthority: "BOUNDED_REPRESENTATION_FEEDBACK_ONLY" as const,
    lexicalPresenceSemanticAuthority: false as const,
    roleMutationAuthority: false as const,
    acquisitionAuthority: false as const,
    schedulingAuthority: false as const,
    semanticDecisionAuthority: false as const,
  });
  return Object.freeze({ ...body, gapId: hashCanonical(body) });
}

export function buildRepresentationRoleCoverageFeedback(input: Readonly<{
  corpus: MarketCorpusSnapshot;
  roleSearchObservations: readonly MechanismPrototypeExplorationRoleSearchObservation[];
}>): RepresentationRoleCoverageFeedback {
  const observations = input.roleSearchObservations
    .map(assertMechanismPrototypeExplorationRoleSearchObservation)
    .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt) ||
      left.observationId.localeCompare(right.observationId));
  const gaps = observations.flatMap((observation) => {
    const result = observation.result;
    const roleGaps: RepresentationRoleCoverageGap[] = [];
    const pushRole = (
      role: "COMPONENT" | "AGGREGATE",
      query: MarketCorpusSearchResult["query"],
      counterpartQuery: MarketCorpusSearchResult["query"],
      rawHitCount: number,
      classifiedHitCount: number,
      refs: readonly string[],
    ) => {
      const classification = rawHitCount === 0
        ? "SOURCE_ABSENT" as const
        : classifiedHitCount === 0 && refs.length > 0
          ? "ONTOLOGY_BLIND_SPOT" as const : null;
      if (classification !== null) roleGaps.push(compileGap({ corpus: input.corpus,
        observation, role, classification, query, counterpartQuery, rawHitCount,
        classifiedHitCount, refs }));
    };
    pushRole("COMPONENT", result.componentQuery, result.aggregateQuery,
      result.rawComponentHitCount, result.componentHits.length,
      result.unclassifiedComponentListingRefs);
    pushRole("AGGREGATE", result.aggregateQuery, result.componentQuery,
      result.rawAggregateHitCount, result.aggregateHits.length,
      result.unclassifiedAggregateListingRefs);
    if (result.componentHits.length > 0 && result.aggregateHits.length > 0 &&
        result.pairCount === 0) {
      roleGaps.push(compileGap({ corpus: input.corpus, observation, role: "PAIR_BRIDGE",
        classification: "BRIDGE_GAP", query: result.componentQuery,
        counterpartQuery: result.aggregateQuery,
        rawHitCount: result.rawComponentHitCount + result.rawAggregateHitCount,
        classifiedHitCount: result.componentHits.length + result.aggregateHits.length,
        refs: [...result.componentHits.map((hit) => hit.listingRef),
          ...result.aggregateHits.map((hit) => hit.listingRef)] }));
    }
    return roleGaps;
  });
  const retained = Object.freeze(gaps.slice(0, MAX_GAPS));
  const count = (classification: RepresentationRoleCoverageGap["classification"]) =>
    retained.filter((gap) => gap.classification === classification).length;
  const body = Object.freeze({
    schemaVersion: "pmh.representation-role-coverage-feedback.v1" as const,
    currentCorpusSnapshotIdentity: input.corpus.snapshotIdentity,
    currentCorpusListingCount: input.corpus.listingCount,
    retainedObservationCount: observations.length,
    sourceSnapshotIdentities: Object.freeze([...new Set(observations.map((observation) =>
      observation.result.snapshotIdentity
    ))].sort()),
    gapCount: retained.length,
    classificationCounts: Object.freeze({ SOURCE_ABSENT: count("SOURCE_ABSENT"),
      ONTOLOGY_BLIND_SPOT: count("ONTOLOGY_BLIND_SPOT"),
      BRIDGE_GAP: count("BRIDGE_GAP"),
      OBSERVATION_INSUFFICIENT: count("OBSERVATION_INSUFFICIENT") }),
    gaps: retained,
    taxonomy: Object.freeze({
      sourceAbsent: "NO_LEXICAL_HIT_IN_THE_EXACT_QUERY_SCOPE" as const,
      ontologyBlindSpot:
        "LEXICAL_HITS_EXIST_BUT_FIRST_PARTY_ROLE_CUES_REJECT_ALL" as const,
      bridgeGap: "BOTH_ROLES_CLASSIFY_BUT_NO_EXACT_SHARED_SIGNAL_PAIR_EXISTS" as const,
      observationInsufficient: "OBSERVATION_DOES_NOT_ISOLATE_ONE_CAUSE" as const,
    }),
    ontologicalPosture:
      "SEARCH_FAILURE_IS_CAUSALLY_TYPED_NOT_PROOF_THAT_A_MARKET_OR_RELATION_DOES_NOT_EXIST" as const,
    authority: "PROVIDER_FREE_REPRESENTATION_DIAGNOSTIC_ONLY" as const,
    automaticMutation: false as const, automaticAcquisition: false as const,
    automaticDispatch: false as const, semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const, certificateAuthority: false as const,
    executionAuthority: false as const, externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, feedbackIdentity: hashCanonical(body) });
}
