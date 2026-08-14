import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import {
  assertEvidenceDocumentCapture,
  type EvidenceDocumentCapture,
} from "./evidence-document.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { MarketOntologySnapshot } from "./market-ontology.js";
import type { DiscoveryCatalogListing } from "./types.js";
import type { OperationalStorageProjection } from "./types.js";
import {
  assertWorldRelationEntityRoleAssertion,
  type WorldRelationEntityRoleAssertion,
} from "./world-relation-entity-role-evidence.js";
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

export type SettlementVenuePolicyEvidence = Readonly<{
  schemaVersion: "pmh.settlement-venue-policy-evidence.v1";
  evidenceId: Hash;
  venueId: string;
  protocolIdentity: string;
  locatorIdentity: Hash;
  documentId: Hash;
  extractionId: Hash;
  rawHash: Hash;
  textHash: Hash;
  text: string;
  extractionStatus: "EXTRACTED" | "TRUNCATED";
  receivedAt: string;
  authority: "RETAINED_FIRST_PARTY_DOCUMENT_EXTRACTION";
  semanticDecisionAuthority: false;
  executionAuthority: false;
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
const VENUE_SETTLEMENT_DISCRETION = /\b(?:prior\s+to\s+settlement[\s\S]{0,800}(?:sole|full)\s+discretion|(?:sole|full)\s+discretion[\s\S]{0,800}(?:settlement|final\s+outcome)|full\s+discretion\s+in\s+reviewing\s+markets)\b/iu;
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

function grounded(predicate: WorldPredicateArtifact, listing: DiscoveryCatalogListing,
  assertions: readonly WorldRelationEntityRoleAssertion[]): boolean {
  const required = terms([
    ...predicate.semantic.subjects.map((item) => item.canonicalLabel),
    predicate.semantic.verbPhrase,
    ...predicate.semantic.parameters.flatMap((item) => [item.name, item.value]),
  ].join(" "));
  const evidence = new Set(terms(`${listing.title} ${listing.rulesText ?? ""}`));
  if (required.length > 0 && required.every((item) => evidence.has(item))) return true;
  const subjects = new Set(terms(predicate.semantic.subjects
    .map((item) => item.canonicalLabel).join(" ")));
  const eventTerms = required.filter((item) => !subjects.has(item));
  return eventTerms.length >= 2 && eventTerms.every((item) => evidence.has(item)) &&
    (predicate.supplementalEvidenceBindings ?? []).some((binding) => {
      if (binding.kind !== "ENTITY_ROLE_ASSERTION" ||
          binding.listingRef !== listing.listingRef) return false;
      return assertions.map(assertWorldRelationEntityRoleAssertion).some((assertion) =>
        assertion.assertionId === binding.assertionId &&
        assertion.requirementId === binding.requirementId &&
        assertion.source.documentId === binding.sourceDocumentId &&
        assertion.source.rawHash === binding.sourceRawHash &&
        assertion.source.textHash === binding.sourceTextHash &&
        assertion.disposition === "SUPPORTED" &&
        predicate.semantic.subjects.some((subject) =>
          subject.entityType === "ORGANIZATION" &&
          subject.canonicalLabel.toLowerCase() ===
            assertion.organizationLabel.toLowerCase()));
    });
}

function exactBlockers(input: Readonly<{
  listing: DiscoveryCatalogListing;
  outcomeShape: string;
  predicate: WorldPredicateArtifact;
  venuePolicyEvidence: readonly SettlementVenuePolicyEvidence[];
  entityRoleAssertions: readonly WorldRelationEntityRoleAssertion[];
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
  if (input.venuePolicyEvidence.some((item) => VENUE_SETTLEMENT_DISCRETION.test(item.text))) {
    blockers.push("VOID_REFUND_OR_DISCRETION_OVERRIDE");
  }
  if (!grounded(input.predicate, input.listing, input.entityRoleAssertions)) {
    blockers.push("PREDICATE_TERMS_NOT_GROUNDED");
  }
  return Object.freeze([...new Set(blockers)].sort());
}

function venuePolicyEvidenceIdentity(input: Omit<SettlementVenuePolicyEvidence,
  "schemaVersion" | "evidenceId" | "authority" | "semanticDecisionAuthority" |
  "executionAuthority" | "text"
>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.settlement-venue-policy-evidence-identity.v1",
    ...input,
  });
}

function assertSettlementVenuePolicyEvidence(
  value: SettlementVenuePolicyEvidence,
): SettlementVenuePolicyEvidence {
  const { schemaVersion, evidenceId, authority, semanticDecisionAuthority,
    executionAuthority, text, ...identity } = value;
  if (
    schemaVersion !== "pmh.settlement-venue-policy-evidence.v1" ||
    evidenceId !== venuePolicyEvidenceIdentity(identity) ||
    value.textHash !== hashBytes(new TextEncoder().encode(text)) ||
    authority !== "RETAINED_FIRST_PARTY_DOCUMENT_EXTRACTION" ||
    semanticDecisionAuthority !== false || executionAuthority !== false
  ) throw new Error("settlement venue policy evidence violates its bounded contract");
  return Object.freeze(value);
}

export function settlementVenuePolicyEvidenceFromCaptures(
  captures: readonly EvidenceDocumentCapture[],
): readonly SettlementVenuePolicyEvidence[] {
  const evidence = new Map<Hash, SettlementVenuePolicyEvidence>();
  for (const input of captures) {
    const capture = assertEvidenceDocumentCapture(input);
    if (capture.document.record.role !== "VENUE_RULE_DOCUMENT") continue;
    const identity = Object.freeze({
      venueId: capture.document.record.venueId,
      protocolIdentity: capture.document.record.protocolIdentity,
      locatorIdentity: capture.document.record.locatorIdentity,
      documentId: capture.document.record.documentId,
      extractionId: capture.extraction.record.extractionId,
      rawHash: capture.document.record.rawHash,
      textHash: capture.extraction.record.textHash,
      extractionStatus: capture.extraction.record.status,
      receivedAt: capture.observation.receivedAt,
    });
    const item = assertSettlementVenuePolicyEvidence(Object.freeze({
      schemaVersion: "pmh.settlement-venue-policy-evidence.v1" as const,
      evidenceId: venuePolicyEvidenceIdentity(identity),
      ...identity,
      text: capture.extraction.text,
      authority: "RETAINED_FIRST_PARTY_DOCUMENT_EXTRACTION" as const,
      semanticDecisionAuthority: false as const,
      executionAuthority: false as const,
    }));
    const prior = evidence.get(item.evidenceId);
    if (prior === undefined || item.receivedAt > prior.receivedAt) evidence.set(item.evidenceId, item);
  }
  return Object.freeze([...evidence.values()].sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId)));
}

function matchingVenuePolicyEvidence(input: Readonly<{
  listing: DiscoveryCatalogListing;
  evidence: readonly SettlementVenuePolicyEvidence[];
}>): readonly SettlementVenuePolicyEvidence[] {
  const locators = new Set((input.listing.evidenceLocators ?? [])
    .filter((item) => item.role === "VENUE_RULE_DOCUMENT")
    .map((item) => item.locatorIdentity));
  const latestByLocator = new Map<Hash, SettlementVenuePolicyEvidence>();
  for (const candidateInput of input.evidence) {
    const candidate = assertSettlementVenuePolicyEvidence(candidateInput);
    if (candidate.venueId !== input.listing.venueId ||
        candidate.protocolIdentity !== input.listing.protocolIdentity ||
        !locators.has(candidate.locatorIdentity)) continue;
    const prior = latestByLocator.get(candidate.locatorIdentity);
    if (prior === undefined || candidate.receivedAt > prior.receivedAt ||
        (candidate.receivedAt === prior.receivedAt &&
          candidate.evidenceId > prior.evidenceId)) {
      latestByLocator.set(candidate.locatorIdentity, candidate);
    }
  }
  return Object.freeze([...latestByLocator.values()].sort((left, right) =>
    left.locatorIdentity.localeCompare(right.locatorIdentity)));
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
  venuePolicyEvidence?: readonly SettlementVenuePolicyEvidence[];
  entityRoleAssertions?: readonly WorldRelationEntityRoleAssertion[];
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
    const venuePolicyEvidence = matchingVenuePolicyEvidence({
      listing,
      evidence: input.venuePolicyEvidence ?? [],
    });
    const blockers = exactBlockers({ listing, outcomeShape: node.settlementFacet.outcomeShape,
      predicate: sourcePredicate, venuePolicyEvidence,
      entityRoleAssertions: input.entityRoleAssertions ?? [] });
    const ruleEvidenceHash = hashCanonical({
      rulesText: listing.rulesText,
      rulesTextPosture: listing.rulesTextPosture ?? null,
      rulesTextSourceCharacterCount: listing.rulesTextSourceCharacterCount ?? null,
      sourceRawHash: listing.sourceRawHash,
      protocolIdentity: listing.protocolIdentity,
    });
    const ruleEvidenceHashes = Object.freeze([
      ruleEvidenceHash,
      ...venuePolicyEvidence.map((item) => item.textHash),
      ...(sourcePredicate.supplementalEvidenceBindings ?? []).flatMap((item) =>
        [item.assertionId, item.sourceDocumentId, item.sourceRawHash, item.sourceTextHash]),
    ].sort());
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
          ruleEvidenceHashes },
        { truthByPredicateId: { [predicate.predicateId]: true }, listingTruth: true,
          disposition: "RESOLVES", rationale: "The exact predicate is true; the explicit affirmative clause resolves Yes.",
          ruleEvidenceHashes },
      ] : [
        { truthByPredicateId: { [predicate.predicateId]: false }, listingTruth: null,
          disposition: "UNRESOLVED", rationale: "The first-party compiler cannot prove the false-state settlement mapping.",
          ruleEvidenceHashes },
        { truthByPredicateId: { [predicate.predicateId]: true }, listingTruth: null,
          disposition: "UNRESOLVED", rationale: "The first-party compiler cannot prove the true-state settlement mapping.",
          ruleEvidenceHashes },
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
