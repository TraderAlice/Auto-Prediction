import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  RelationDiscoveryFinding,
  RelationDiscoveryRouteObservation,
} from "./relation-discovery-agent-tools.js";

export type RelationDiscoveryNoveltyClassification =
  | "NOVEL_SEARCH_ROUTE"
  | "NOVEL_PAYOFF_EVIDENCE"
  | "REDUNDANT_SEARCH_MEMORY"
  | "REDUNDANT_PAYOFF_EVIDENCE"
  | "INCOMPARABLE_PAYOFF_EVIDENCE";

export type RelationDiscoverySemanticNoveltyDecision = Readonly<{
  schemaVersion: "pmh.relation-discovery-semantic-novelty-decision.v1";
  decisionId: Hash;
  candidateFindingId: Hash;
  classification: RelationDiscoveryNoveltyClassification;
  semanticDomain: "SEARCH_MEMORY" | "PAYOFF_RESEARCH";
  candidateCoverageIdentity: Hash;
  candidateExactContentIdentity: Hash | null;
  overlapFindingIds: readonly Hash[];
  overlapCoverageIdentities: readonly Hash[];
  overlapTruncated: boolean;
  admitted: boolean;
  noveltyAuthority: "EXACT_STRUCTURED_COVERAGE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type RelationDiscoverySemanticCoverageSummaryItem = Readonly<{
  semanticDomain: "SEARCH_MEMORY" | "PAYOFF_RESEARCH";
  coverageIdentity: Hash;
  findingIds: readonly Hash[];
  routeQuery: Readonly<{
    canonicalSearchSignals: readonly string[];
    searchFields: readonly ("title" | "description" | "rulesText")[];
  }> | null;
  payoffSkeleton: Readonly<{
    kind: "RELATION_HYPOTHESIS" | "COUNTEREXAMPLE";
    relationKind: string | null;
    listingRefs: readonly string[];
  }> | null;
}>;

export type RelationDiscoverySemanticCoverageSummary = Readonly<{
  schemaVersion: "pmh.relation-discovery-semantic-coverage-summary.v1";
  retainedFindingCount: number;
  matchingCoverageCount: number;
  returnedCoverageCount: number;
  truncated: boolean;
  completeAdmissionCheckStillRequired: true;
  items: readonly RelationDiscoverySemanticCoverageSummaryItem[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  authority: "AGENT_SEARCH_GUIDANCE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function canonicalText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) =>
    left.localeCompare(right)
  ));
}

export function relationDiscoverySearchCoverageIdentity(
  finding: RelationDiscoveryRouteObservation,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.relation-discovery-search-coverage.v1",
    canonicalSearchSignals: uniqueSorted(finding.searchSignals.map(canonicalText)),
    searchFields: uniqueSorted(finding.searchFields),
  });
}

export function relationDiscoveryPayoffSkeleton(
  finding: Exclude<RelationDiscoveryFinding, { kind: "ONTOLOGY_ROUTE" }>,
): Readonly<{
  kind: "RELATION_HYPOTHESIS" | "COUNTEREXAMPLE";
  relationKind: string | null;
  listingRefs: readonly string[];
}> {
  return Object.freeze({
    kind: finding.kind,
    relationKind: finding.kind === "RELATION_HYPOTHESIS"
      ? finding.relationKind
      : finding.rejectedRelationKind,
    listingRefs: uniqueSorted(finding.listingRefs),
  });
}

export function relationDiscoveryPayoffCoverageIdentity(
  finding: Exclude<RelationDiscoveryFinding, { kind: "ONTOLOGY_ROUTE" }>,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.relation-discovery-payoff-coverage.v1",
    ...relationDiscoveryPayoffSkeleton(finding),
  });
}

export function relationDiscoveryPayoffExactContentIdentity(
  finding: Exclude<RelationDiscoveryFinding, { kind: "ONTOLOGY_ROUTE" }>,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.relation-discovery-payoff-exact-content.v1",
    coverageIdentity: relationDiscoveryPayoffCoverageIdentity(finding),
    statement: canonicalText(finding.statement),
    rationale: canonicalText(finding.rationale),
    falsifiers: uniqueSorted(finding.falsifiers.map(canonicalText)),
  });
}

function decision(input: Readonly<{
  candidate: RelationDiscoveryFinding;
  classification: RelationDiscoveryNoveltyClassification;
  semanticDomain: "SEARCH_MEMORY" | "PAYOFF_RESEARCH";
  candidateCoverageIdentity: Hash;
  candidateExactContentIdentity: Hash | null;
  overlaps: readonly RelationDiscoveryFinding[];
}>): RelationDiscoverySemanticNoveltyDecision {
  const overlapFindingIds = Object.freeze(uniqueSorted(input.overlaps.map((item) =>
    item.findingId
  )).slice(0, 8) as Hash[]);
  const overlapCoverageIdentities = Object.freeze(uniqueSorted(input.overlaps.map((item) =>
    item.kind === "ONTOLOGY_ROUTE"
      ? relationDiscoverySearchCoverageIdentity(item)
      : relationDiscoveryPayoffCoverageIdentity(item)
  )).slice(0, 8) as Hash[]);
  const body = Object.freeze({
    schemaVersion: "pmh.relation-discovery-semantic-novelty-decision.v1" as const,
    candidateFindingId: input.candidate.findingId,
    classification: input.classification,
    semanticDomain: input.semanticDomain,
    candidateCoverageIdentity: input.candidateCoverageIdentity,
    candidateExactContentIdentity: input.candidateExactContentIdentity,
    overlapFindingIds,
    overlapCoverageIdentities,
    overlapTruncated: new Set(input.overlaps.map((item) => item.findingId)).size > 8,
    admitted: input.classification !== "REDUNDANT_SEARCH_MEMORY" &&
      input.classification !== "REDUNDANT_PAYOFF_EVIDENCE",
    noveltyAuthority: "EXACT_STRUCTURED_COVERAGE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, decisionId: hashCanonical(body) });
}

export function classifyRelationDiscoverySemanticNovelty(input: Readonly<{
  candidate: RelationDiscoveryFinding;
  retainedFindings: readonly RelationDiscoveryFinding[];
}>): RelationDiscoverySemanticNoveltyDecision {
  if (input.candidate.kind === "ONTOLOGY_ROUTE") {
    const coverageIdentity = relationDiscoverySearchCoverageIdentity(input.candidate);
    const overlaps = input.retainedFindings.filter((item) =>
      item.kind === "ONTOLOGY_ROUTE" &&
      relationDiscoverySearchCoverageIdentity(item) === coverageIdentity
    );
    return decision({
      candidate: input.candidate,
      classification: overlaps.length === 0
        ? "NOVEL_SEARCH_ROUTE"
        : "REDUNDANT_SEARCH_MEMORY",
      semanticDomain: "SEARCH_MEMORY",
      candidateCoverageIdentity: coverageIdentity,
      candidateExactContentIdentity: null,
      overlaps,
    });
  }

  const coverageIdentity = relationDiscoveryPayoffCoverageIdentity(input.candidate);
  const exactContentIdentity = relationDiscoveryPayoffExactContentIdentity(input.candidate);
  const skeletonOverlaps = input.retainedFindings.filter((item) =>
    item.kind !== "ONTOLOGY_ROUTE" &&
    relationDiscoveryPayoffCoverageIdentity(item) === coverageIdentity
  );
  const exactOverlaps = skeletonOverlaps.filter((item) =>
    item.kind !== "ONTOLOGY_ROUTE" &&
    relationDiscoveryPayoffExactContentIdentity(item) === exactContentIdentity
  );
  return decision({
    candidate: input.candidate,
    classification: exactOverlaps.length > 0
      ? "REDUNDANT_PAYOFF_EVIDENCE"
      : skeletonOverlaps.length > 0
        ? "INCOMPARABLE_PAYOFF_EVIDENCE"
        : "NOVEL_PAYOFF_EVIDENCE",
    semanticDomain: "PAYOFF_RESEARCH",
    candidateCoverageIdentity: coverageIdentity,
    candidateExactContentIdentity: exactContentIdentity,
    overlaps: exactOverlaps.length > 0 ? exactOverlaps : skeletonOverlaps,
  });
}

export function buildRelationDiscoverySemanticCoverageSummary(input: Readonly<{
  retainedFindings: readonly RelationDiscoveryFinding[];
  seedListingRefs: readonly string[];
  searchSignals: readonly string[];
  limit?: number;
}>): RelationDiscoverySemanticCoverageSummary {
  const limit = input.limit ?? 32;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64) {
    throw new Error("semantic coverage summary limit must be between 1 and 64");
  }
  const seeds = new Set(input.seedListingRefs);
  const signals = new Set(input.searchSignals.map(canonicalText));
  const relevant = input.retainedFindings.filter((finding) =>
    finding.listingRefs.some((ref) => seeds.has(ref)) ||
    (finding.kind === "ONTOLOGY_ROUTE" && finding.searchSignals.some((signal) =>
      signals.has(canonicalText(signal))
    ))
  );
  const grouped = new Map<Hash, RelationDiscoveryFinding[]>();
  for (const finding of relevant) {
    const identity = finding.kind === "ONTOLOGY_ROUTE"
      ? relationDiscoverySearchCoverageIdentity(finding)
      : relationDiscoveryPayoffCoverageIdentity(finding);
    grouped.set(identity, [...(grouped.get(identity) ?? []), finding]);
  }
  const entries = [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const items = Object.freeze(entries.slice(0, limit).map(([coverageIdentity, findings]) => {
    const representative = findings[0]!;
    return Object.freeze({
      semanticDomain: representative.kind === "ONTOLOGY_ROUTE"
        ? "SEARCH_MEMORY" as const
        : "PAYOFF_RESEARCH" as const,
      coverageIdentity,
      findingIds: Object.freeze(uniqueSorted(findings.map((item) => item.findingId)) as Hash[]),
      routeQuery: representative.kind === "ONTOLOGY_ROUTE" ? Object.freeze({
        canonicalSearchSignals: uniqueSorted(representative.searchSignals.map(canonicalText)),
        searchFields: uniqueSorted(representative.searchFields) as readonly (
          "title" | "description" | "rulesText"
        )[],
      }) : null,
      payoffSkeleton: representative.kind === "ONTOLOGY_ROUTE"
        ? null
        : relationDiscoveryPayoffSkeleton(representative),
    });
  }));
  return Object.freeze({
    schemaVersion: "pmh.relation-discovery-semantic-coverage-summary.v1" as const,
    retainedFindingCount: input.retainedFindings.length,
    matchingCoverageCount: entries.length,
    returnedCoverageCount: items.length,
    truncated: entries.length > items.length,
    completeAdmissionCheckStillRequired: true as const,
    items,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    authority: "AGENT_SEARCH_GUIDANCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}
