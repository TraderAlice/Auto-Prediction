import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { MarketOntologySnapshot } from "./market-ontology.js";
import type { DiscoveryCatalogListing } from "./types.js";
import type { OperationalStorageProjection } from "./types.js";
import {
  buildSettlementProjection,
  buildWorldPredicateArtifact,
  type SettlementProjection,
  type WorldPredicateArtifact,
} from "./world-history-ontology.js";

export const SETTLEMENT_PROJECTION_BLOCKERS = Object.freeze([
  "STALE_LISTING_EVIDENCE",
  "STALE_ONTOLOGY_NODE",
  "MULTIPLE_PREDICATES_FOR_LISTING",
  "NON_BINARY_OUTCOME_SPACE",
  "INCOMPLETE_RULE_EVIDENCE",
  "MISSING_RULE_EVIDENCE",
  "VOID_REFUND_OR_DISCRETION_OVERRIDE",
  "MISSING_AFFIRMATIVE_RESOLUTION_CLAUSE",
  "MISSING_NEGATIVE_RESOLUTION_CLAUSE",
  "PREDICATE_TERMS_NOT_GROUNDED",
] as const);
export type SettlementProjectionBlocker =
  (typeof SETTLEMENT_PROJECTION_BLOCKERS)[number];

export type SettlementProjectionObservation = Readonly<{
  schemaVersion: "pmh.settlement-projection-observation.v1";
  observationId: Hash;
  artifactHash: Hash;
  listingRef: string;
  listingHash: Hash | null;
  predicateIds: readonly Hash[];
  predicateArtifactHashes: readonly Hash[];
  settlementFacetId: Hash | null;
  disposition: "EXACT_PROJECTED" | "RESEARCH_ONLY_PROJECTED" | "BLOCKED";
  blockers: readonly SettlementProjectionBlocker[];
  projectionArtifactHash: Hash | null;
  observedAt: string;
  compiler: "FIRST_PARTY_CONSERVATIVE_BINARY_RULE_COMPILER_V1";
  authority: "SETTLEMENT_PROJECTION_OBSERVATION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type SettlementProjectionCompilation = Readonly<{
  predicates: readonly WorldPredicateArtifact[];
  projections: readonly SettlementProjection[];
  observations: readonly SettlementProjectionObservation[];
}>;

export interface SettlementProjectionObservationStore {
  readonly settlementProjectionObservationStorage:
    OperationalStorageProjection<"artifactHash">;
  loadSettlementProjectionObservations(
    limit: number,
  ): readonly SettlementProjectionObservation[];
  saveSettlementProjectionObservations(
    observations: readonly SettlementProjectionObservation[],
  ): readonly SettlementProjectionObservation[];
}

const VOID_OR_DISCRETION = /\b(?:void|voided|refund|refunded|cancel(?:led|ed)?|invalid|discretion|sole discretion|clarification|override)\b/iu;
const AFFIRMATIVE = /\b(?:resolve(?:s|d)?|settle(?:s|d)?)\s+(?:to\s+)?(?:the\s+)?["']?yes["']?\s+if\b/iu;
const NEGATIVE = /\botherwise\b[^.]{0,160}\b(?:no|resolve(?:s|d)?\s+(?:to\s+)?(?:the\s+)?["']?no)\b|\bresolve(?:s|d)?\s+(?:to\s+)?(?:the\s+)?["']?no["']?\s+(?:if|otherwise)\b/iu;
const STOP = new Set(["will", "would", "could", "does", "the", "and", "that", "this",
  "with", "from", "into", "than", "then", "have", "has", "had", "is", "are", "was",
  "were", "be", "been", "being", "on", "in", "at", "to", "of", "a", "an", "or"]);

function terms(value: string): readonly string[] {
  return Object.freeze([...new Set(value.normalize("NFKC").toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)?.filter((item) => item.length >= 3 && !STOP.has(item)) ?? [])]
    .sort());
}

function grounded(predicate: WorldPredicateArtifact, listing: DiscoveryCatalogListing): boolean {
  const required = terms([
    ...predicate.semantic.subjects.map((item) => item.canonicalLabel),
    predicate.semantic.verbPhrase,
    ...predicate.semantic.parameters.flatMap((item) => [item.name, item.value]),
  ].join(" "));
  const evidence = new Set(terms(`${listing.title} ${listing.rulesText ?? ""}`));
  return required.length > 0 && required.every((item) => evidence.has(item));
}

function exactBlockers(input: Readonly<{
  listing: DiscoveryCatalogListing;
  outcomeShape: string;
  predicate: WorldPredicateArtifact;
}>): readonly SettlementProjectionBlocker[] {
  const blockers: SettlementProjectionBlocker[] = [];
  if (input.outcomeShape !== "BINARY_YES_NO_LABELS") blockers.push("NON_BINARY_OUTCOME_SPACE");
  if (input.listing.rulesText === null || input.listing.rulesText.trim() === "") {
    blockers.push("MISSING_RULE_EVIDENCE");
  } else {
    if (input.listing.rulesTextPosture !== undefined &&
        input.listing.rulesTextPosture !== "COMPLETE") blockers.push("INCOMPLETE_RULE_EVIDENCE");
    if (VOID_OR_DISCRETION.test(input.listing.rulesText)) {
      blockers.push("VOID_REFUND_OR_DISCRETION_OVERRIDE");
    }
    if (!AFFIRMATIVE.test(input.listing.rulesText)) {
      blockers.push("MISSING_AFFIRMATIVE_RESOLUTION_CLAUSE");
    }
    if (!NEGATIVE.test(input.listing.rulesText)) {
      blockers.push("MISSING_NEGATIVE_RESOLUTION_CLAUSE");
    }
  }
  if (!grounded(input.predicate, input.listing)) blockers.push("PREDICATE_TERMS_NOT_GROUNDED");
  return Object.freeze([...new Set(blockers)].sort());
}

function observation(input: Omit<SettlementProjectionObservation,
  "schemaVersion" | "observationId" | "artifactHash" | "compiler" | "authority" |
  "semanticDecisionAuthority" | "probabilityAuthority" | "certificateAuthority" |
  "executionAuthority" | "externalWriteAuthority" | "valueMovingAuthority"
>): SettlementProjectionObservation {
  const identityBody = Object.freeze({
    schemaVersion: "pmh.settlement-projection-observation-identity.v1" as const,
    listingRef: input.listingRef,
    listingHash: input.listingHash,
    predicateArtifactHashes: input.predicateArtifactHashes,
    settlementFacetId: input.settlementFacetId,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.settlement-projection-observation.v1" as const,
    observationId: hashCanonical(identityBody),
    ...input,
    compiler: "FIRST_PARTY_CONSERVATIVE_BINARY_RULE_COMPILER_V1" as const,
    authority: "SETTLEMENT_PROJECTION_OBSERVATION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertSettlementProjectionObservation(
  value: unknown,
): SettlementProjectionObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("settlement projection observation is malformed");
  }
  const item = value as SettlementProjectionObservation;
  const { artifactHash, ...body } = item;
  const identityBody = Object.freeze({
    schemaVersion: "pmh.settlement-projection-observation-identity.v1" as const,
    listingRef: item.listingRef,
    listingHash: item.listingHash,
    predicateArtifactHashes: item.predicateArtifactHashes,
    settlementFacetId: item.settlementFacetId,
  });
  if (item.schemaVersion !== "pmh.settlement-projection-observation.v1" ||
      item.observationId !== hashCanonical(identityBody) ||
      artifactHash !== hashCanonical(body) ||
      !["EXACT_PROJECTED", "RESEARCH_ONLY_PROJECTED", "BLOCKED"].includes(item.disposition) ||
      item.blockers.some((blocker) => !SETTLEMENT_PROJECTION_BLOCKERS.includes(blocker)) ||
      item.compiler !== "FIRST_PARTY_CONSERVATIVE_BINARY_RULE_COMPILER_V1" ||
      item.authority !== "SETTLEMENT_PROJECTION_OBSERVATION_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("settlement projection observation violates its bounded contract");
  }
  return Object.freeze(item);
}

export function compileSettlementProjections(input: Readonly<{
  corpus: MarketCorpusSnapshot;
  ontology: MarketOntologySnapshot;
  predicates: readonly WorldPredicateArtifact[];
}>): SettlementProjectionCompilation {
  if (input.ontology.sourceSnapshotIdentity !== input.corpus.snapshotIdentity) {
    throw new Error("settlement projection compiler requires the exact ontology corpus");
  }
  const listingByRef = new Map(input.corpus.listings.map((item) => [item.listingRef, item]));
  const nodeByRef = new Map(input.ontology.nodes.map((item) => [item.listingRef, item]));
  const predicateByListing = new Map<string, WorldPredicateArtifact[]>();
  for (const predicate of input.predicates) {
    for (const binding of predicate.evidenceBindings) {
      predicateByListing.set(binding.listingRef,
        [...(predicateByListing.get(binding.listingRef) ?? []), predicate]);
    }
  }
  const predicates: WorldPredicateArtifact[] = [];
  const projections: SettlementProjection[] = [];
  const observations: SettlementProjectionObservation[] = [];
  for (const [listingRef, bound] of [...predicateByListing].sort(([left], [right]) =>
    left.localeCompare(right))) {
    const unique = [...new Map(bound.map((item) => [item.predicateId, item] as const)).values()]
      .sort((left, right) => left.predicateId.localeCompare(right.predicateId));
    const listing = listingByRef.get(listingRef);
    const node = nodeByRef.get(listingRef);
    const listingHash = listing === undefined ? null : hashCanonical(listing);
    const base = {
      listingRef, listingHash, predicateIds: Object.freeze(unique.map((item) => item.predicateId)),
      predicateArtifactHashes: Object.freeze(unique.map((item) => item.artifactHash).sort()),
      settlementFacetId: node?.settlementFacet.facetId ?? null,
      observedAt: listing?.sourceReceivedAt ?? unique.map((item) => item.proposedAt).sort().at(-1)!,
    };
    const structural: SettlementProjectionBlocker[] = [];
    if (listing === undefined) structural.push("STALE_LISTING_EVIDENCE");
    if (node === undefined) structural.push("STALE_ONTOLOGY_NODE");
    if (unique.length !== 1) structural.push("MULTIPLE_PREDICATES_FOR_LISTING");
    if (structural.length > 0 || listing === undefined || node === undefined || unique[0] === undefined) {
      observations.push(observation({ ...base, disposition: "BLOCKED",
        blockers: Object.freeze(structural.sort()), projectionArtifactHash: null }));
      continue;
    }
    const sourcePredicate = unique[0];
    const blockers = exactBlockers({ listing, outcomeShape: node.settlementFacet.outcomeShape,
      predicate: sourcePredicate });
    const ruleEvidenceHash = hashCanonical({
      rulesText: listing.rulesText,
      rulesTextPosture: listing.rulesTextPosture ?? null,
      rulesTextSourceCharacterCount: listing.rulesTextSourceCharacterCount ?? null,
      sourceRawHash: listing.sourceRawHash,
      protocolIdentity: listing.protocolIdentity,
    });
    const predicate = blockers.length === 0
      ? buildWorldPredicateArtifact({ ...sourcePredicate,
          observability: "RULE_DEFINED", epistemicPosture: "SETTLEMENT_BOUND_PREDICATE" })
      : sourcePredicate;
    predicates.push(predicate);
    const projection = buildSettlementProjection({
      listing: { listingRef, listingHash: hashCanonical(listing), venueId: listing.venueId,
        venueInstrumentId: listing.venueInstrumentId,
        protocolIdentity: listing.protocolIdentity,
        sourceRawHash: listing.sourceRawHash as Hash,
        sourceReceivedAt: listing.sourceReceivedAt },
      predicateArtifacts: [predicate], predicateIds: [predicate.predicateId],
      truthStates: blockers.length === 0 ? [
        { truthByPredicateId: { [predicate.predicateId]: false }, listingTruth: false,
          disposition: "RESOLVES", rationale: "The exact predicate is false; the explicit otherwise clause resolves No.",
          ruleEvidenceHashes: [ruleEvidenceHash] },
        { truthByPredicateId: { [predicate.predicateId]: true }, listingTruth: true,
          disposition: "RESOLVES", rationale: "The exact predicate is true; the explicit affirmative clause resolves Yes.",
          ruleEvidenceHashes: [ruleEvidenceHash] },
      ] : [
        { truthByPredicateId: { [predicate.predicateId]: false }, listingTruth: null,
          disposition: "UNRESOLVED", rationale: "The first-party compiler cannot prove the false-state settlement mapping.",
          ruleEvidenceHashes: [ruleEvidenceHash] },
        { truthByPredicateId: { [predicate.predicateId]: true }, listingTruth: null,
          disposition: "UNRESOLVED", rationale: "The first-party compiler cannot prove the true-state settlement mapping.",
          ruleEvidenceHashes: [ruleEvidenceHash] },
      ],
      mappingPosture: blockers.length === 0 ? "TOTAL_EXACT" :
        blockers.includes("VOID_REFUND_OR_DISCRETION_OVERRIDE") ? "VOIDABLE_OVERRIDE" : "AMBIGUOUS",
      ambiguityNotes: blockers.map((item) => item.replaceAll("_", " ").toLowerCase()),
      sourceAgentRunIds: predicate.source.sourceAgentRunIds,
      sourceToolEffectIds: predicate.source.sourceToolEffectIds,
      observedAt: listing.sourceReceivedAt,
    });
    projections.push(projection);
    observations.push(observation({ ...base,
      disposition: blockers.length === 0 ? "EXACT_PROJECTED" : "RESEARCH_ONLY_PROJECTED",
      blockers, projectionArtifactHash: projection.artifactHash }));
  }
  return Object.freeze({ predicates: Object.freeze(predicates),
    projections: Object.freeze(projections), observations: Object.freeze(observations) });
}
