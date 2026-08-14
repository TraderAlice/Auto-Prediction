import { hashCanonical, type Hash } from "@pmh/domain";
import { buildMarketOntologySnapshot } from "./market-ontology.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  compileSettlementProjections,
  type SettlementProjectionCompilation,
  type SettlementVenuePolicyEvidence,
} from "./settlement-projection-compiler.js";
import {
  buildWorldPredicateArtifact,
  type SettlementProjection,
  type WorldPredicateArtifact,
} from "./world-history-ontology.js";
import type { WorldRelationFrontierSeed } from
  "./world-history-ontology-adapter.js";

export type WorldRelationProjectionCoverageObservation = Readonly<{
  schemaVersion: "pmh.world-relation-projection-coverage-observation.v1";
  observationId: Hash;
  frontierArtifactHash: Hash;
  corpusSnapshotIdentity: Hash;
  listingRef: string;
  disposition:
    | "ALREADY_COVERED"
    | "TEXT_GROUNDED_PREDICATE_BOUND"
    | "ENTITY_ROLE_EVIDENCE_REQUIRED"
    | "OPPOSING_SUBJECT"
    | "NO_GROUNDED_PREDICATE";
  predicateId: Hash | null;
  predicateArtifactHash: Hash | null;
  projectionArtifactHash: Hash | null;
  rationale: string;
  authority: "PROJECTION_COVERAGE_RESEARCH_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldRelationProjectionCoverageCompilation = Readonly<{
  predicates: readonly WorldPredicateArtifact[];
  projections: readonly SettlementProjection[];
  settlement: SettlementProjectionCompilation;
  observations: readonly WorldRelationProjectionCoverageObservation[];
}>;

const STOP = new Set(["the", "which", "will", "party", "united", "states",
  "us", "u", "s", "a", "an", "of", "in", "for", "to", "and"]);

function tokens(value: string): readonly string[] {
  return Object.freeze([...new Set((value.normalize("NFKC").toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? []).map((token) => {
      if (["winner", "wins", "winning"].includes(token)) return "win";
      if (["controls", "controlled", "controlling"].includes(token)) return "control";
      if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
      return token;
    }).filter((token) => token.length >= 2 && !STOP.has(token)))].sort());
}

function eventTokens(predicate: WorldPredicateArtifact): readonly string[] {
  const subjects = new Set(subjectTokens(predicate));
  return tokens(predicate.semantic.verbPhrase).filter((token) => !subjects.has(token));
}

function subjectTokens(predicate: WorldPredicateArtifact): readonly string[] {
  return tokens(predicate.semantic.subjects.map((item) => item.canonicalLabel).join(" "));
}

function coverage(predicate: WorldPredicateArtifact, text: string): Readonly<{
  subject: boolean;
  eventCount: number;
  eventTotal: number;
  exact: boolean;
}> {
  const evidence = new Set(tokens(text));
  const subjects = subjectTokens(predicate);
  const events = eventTokens(predicate);
  const subject = subjects.length > 0 && subjects.every((item) => evidence.has(item));
  const eventCount = events.filter((item) => evidence.has(item)).length;
  return Object.freeze({ subject, eventCount, eventTotal: events.length,
    exact: subject && events.length >= 2 && eventCount === events.length });
}

function observation(input: Omit<WorldRelationProjectionCoverageObservation,
  "schemaVersion" | "observationId" | "authority" | "semanticDecisionAuthority" |
  "probabilityAuthority" | "certificateAuthority" | "executionAuthority" |
  "externalWriteAuthority" | "valueMovingAuthority"
>): WorldRelationProjectionCoverageObservation {
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-projection-coverage-observation.v1" as const,
    ...input,
    authority: "PROJECTION_COVERAGE_RESEARCH_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, observationId: hashCanonical(body) });
}

export function compileWorldRelationProjectionCoverage(input: Readonly<{
  frontier: WorldRelationFrontierSeed;
  corpus: MarketCorpusSnapshot;
  inspectedListingRefs: readonly string[];
  existingProjections: readonly SettlementProjection[];
  venuePolicyEvidence?: readonly SettlementVenuePolicyEvidence[];
}>): WorldRelationProjectionCoverageCompilation {
  const listingByRef = new Map(input.corpus.listings.map((item) =>
    [item.listingRef, item] as const));
  const ontology = buildMarketOntologySnapshot(input.corpus);
  const nodeByRef = new Map(ontology.nodes.map((item) => [item.listingRef, item] as const));
  const frontierPredicateIds = new Set(input.frontier.predicates.map((item) =>
    item.predicateId));
  const applicableExisting = input.existingProjections.filter((item) => {
    const listing = listingByRef.get(item.listing.listingRef);
    return listing !== undefined && item.listing.sourceRawHash === listing.sourceRawHash &&
      item.listing.protocolIdentity === listing.protocolIdentity &&
      item.predicateIds.some((predicateId) => frontierPredicateIds.has(predicateId));
  });
  const existingByRef = new Map(applicableExisting.map((item) =>
    [item.listing.listingRef, item] as const));
  const derivedPredicates: WorldPredicateArtifact[] = [];
  const drafts: Omit<WorldRelationProjectionCoverageObservation,
    "schemaVersion" | "observationId" | "authority" | "semanticDecisionAuthority" |
    "probabilityAuthority" | "certificateAuthority" | "executionAuthority" |
    "externalWriteAuthority" | "valueMovingAuthority">[] = [];
  for (const listingRef of [...new Set(input.inspectedListingRefs)].sort()) {
    const listing = listingByRef.get(listingRef);
    const existing = existingByRef.get(listingRef);
    const common = { frontierArtifactHash: input.frontier.artifactHash,
      corpusSnapshotIdentity: input.corpus.snapshotIdentity, listingRef };
    if (existing !== undefined) {
      drafts.push({ ...common, disposition: "ALREADY_COVERED",
        predicateId: existing.predicateIds[0] ?? null,
        predicateArtifactHash: existing.predicateBindings[0]?.predicateArtifactHash ?? null,
        projectionArtifactHash: existing.artifactHash,
        rationale: "The inspected listing already has a retained settlement projection." });
      continue;
    }
    if (listing === undefined) {
      drafts.push({ ...common, disposition: "NO_GROUNDED_PREDICATE", predicateId: null,
        predicateArtifactHash: null, projectionArtifactHash: null,
        rationale: "The inspected listing is unavailable in the exact retained corpus." });
      continue;
    }
    const text = `${listing.title} ${listing.description} ${listing.rulesText ?? ""}`;
    const scored = input.frontier.predicates.map((predicate) => ({ predicate,
      score: coverage(predicate, text) }));
    const exact = scored.filter((item) => item.score.exact);
    if (exact.length === 1) {
      const source = exact[0]!.predicate;
      const node = nodeByRef.get(listingRef)!;
      const evidenceBinding = { listingRef,
          nodeId: node.nodeId, worldFacetId: node.worldFacet.facetId,
          sourceRawHash: listing.sourceRawHash as Hash,
          protocolIdentity: listing.protocolIdentity };
      const evidenceBindings = [...new Map(
        [...source.evidenceBindings, evidenceBinding].map((item) =>
          [`${item.listingRef}:${item.nodeId}:${item.worldFacetId}`, item] as const),
      ).values()];
      const predicate = buildWorldPredicateArtifact({ ...source,
        evidenceBindings,
        source: { ...source.source,
          sourceSnapshotIdentities: [...new Set([
            ...source.source.sourceSnapshotIdentities, input.corpus.snapshotIdentity,
          ])].sort() },
        proposedAt: listing.sourceReceivedAt,
      });
      derivedPredicates.push(predicate);
      drafts.push({ ...common, disposition: "TEXT_GROUNDED_PREDICATE_BOUND",
        predicateId: predicate.predicateId, predicateArtifactHash: predicate.artifactHash,
        projectionArtifactHash: null,
        rationale: "The exact party subject and every normalized event token are present in retained contract text." });
      continue;
    }
    const roleDebt = scored.some((item) => !item.score.subject &&
      item.score.eventTotal >= 2 && item.score.eventCount === item.score.eventTotal);
    const opposing = /\b(?:democratic|republican)\s+party\b/iu.test(text) &&
      scored.every((item) => !item.score.subject);
    drafts.push({ ...common,
      disposition: opposing ? "OPPOSING_SUBJECT"
        : roleDebt ? "ENTITY_ROLE_EVIDENCE_REQUIRED" : "NO_GROUNDED_PREDICATE",
      predicateId: null, predicateArtifactHash: null, projectionArtifactHash: null,
      rationale: opposing
        ? "The contract names a different party subject from every frontier predicate."
        : roleDebt
          ? "The event anchors match, but retained text does not bind the named candidate to the frontier party subject."
          : "No frontier predicate is fully grounded by the inspected contract text.",
    });
  }
  const settlement = compileSettlementProjections({ corpus: input.corpus, ontology,
    predicates: derivedPredicates,
    ...(input.venuePolicyEvidence === undefined ? {} : {
      venuePolicyEvidence: input.venuePolicyEvidence,
    }) });
  const projectionByPredicate = new Map(settlement.projections.map((item) =>
    [`${item.listing.listingRef}:${item.predicateIds[0]}`, item] as const));
  const observations = drafts.map((draft) => {
    const projection = draft.predicateId === null ? undefined
      : projectionByPredicate.get(`${draft.listingRef}:${draft.predicateId}`);
    return observation({ ...draft,
      projectionArtifactHash: projection?.artifactHash ?? draft.projectionArtifactHash });
  });
  const projections = [...new Map([...applicableExisting, ...settlement.projections]
    .map((item) => [item.artifactHash, item] as const)).values()]
    .sort((left, right) => left.artifactHash.localeCompare(right.artifactHash));
  return Object.freeze({ predicates: Object.freeze(settlement.predicates),
    projections: Object.freeze(projections), settlement,
    observations: Object.freeze(observations) });
}
