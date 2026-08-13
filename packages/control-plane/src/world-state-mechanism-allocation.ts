import { hashCanonical, type Hash } from "@pmh/domain";
import type { OntologySearchIssueRevision } from "./ontology-search-ecology.js";
import type { MarketOntologyTrailhead } from "./market-ontology.js";
import type { WorldStateMechanismResearchAssignment } from "./world-state-mechanism-research.js";

const PORTFOLIO_CAPS = Object.freeze({
  total: 8,
  perCanonicalSubject: 1,
  perRelationPattern: 1,
  perStructuralPattern: 2,
} as const);

export type WorldStateMechanismSuitabilitySignal =
  | "COHERENT_SHARED_SUBJECT"
  | "MULTI_SIGNAL_SUBJECT"
  | "WORLD_PREDICATE_DIVERGENCE"
  | "DISTINCT_ROLE_LANGUAGE"
  | "TEMPORAL_ORDERING_POTENTIAL"
  | "MULTI_VENUE_EVIDENCE"
  | "CORROBORATING_TRAILHEADS";

export type WorldStateMechanismSuitabilityHazard =
  | "NO_WORLD_PREDICATE_DIVERGENCE"
  | "SETTLEMENT_OR_TRADING_DIVERGENCE_ONLY"
  | "SAME_EVENT_INTERVAL_PATTERN"
  | "SHARED_SIGNALS_ARE_CONTRACT_ROLE_LANGUAGE"
  | "PARALLEL_OUTCOME_ALTERNATIVES"
  | "SINGLE_SIGNAL_SUBJECT_AMBIGUITY"
  | "AGGREGATE_TITLE_AMBIGUITY";

export type WorldStateMechanismAllocationDisposition =
  | "SELECTED_FOR_MECHANISM_RESEARCH"
  | "HELD_LOW_STRUCTURAL_SUITABILITY"
  | "HELD_PORTFOLIO_REDUNDANCY"
  | "COVERED_BY_EXACT_RESULT";

export type WorldStateMechanismSuitabilityVector = Readonly<{
  coherentTrailheadCount: number;
  predicateDivergentTrailheadCount: number;
  distinctRoleLanguageTrailheadCount: number;
  temporallyDivergentTrailheadCount: number;
  multiVenueTrailheadCount: number;
  multiSignalTrailheadCount: number;
  singleSignalAmbiguityCount: number;
  aggregateTitleCount: number;
  contractRoleOnlyTrailheadCount: number;
  maximumTrailheadScore: number;
}>;

export type WorldStateMechanismAllocationAction = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-allocation-action.v1";
  actionId: Hash;
  assignmentId: Hash;
  mechanismIssueId: Hash;
  taskId: Hash;
  sourceRevisionId: Hash;
  sourceOntologyIssueId: Hash;
  relationPatternId: Hash;
  selectionLane: OntologySearchIssueRevision["selectionLane"];
  canonicalSubjectKey: string;
  structuralPatternKey: string;
  representativeTitleExcerpts: readonly [string, string];
  structuralSuitability: "SUITABLE" | "LOW" | "COVERED";
  suitabilityVector: WorldStateMechanismSuitabilityVector;
  positiveSignals: readonly WorldStateMechanismSuitabilitySignal[];
  hazards: readonly WorldStateMechanismSuitabilityHazard[];
  disposition: WorldStateMechanismAllocationDisposition;
  diagnostic: string;
  authority: "MECHANISM_RESEARCH_ATTENTION_PROPOSAL_ONLY";
  structuralHeuristicSemanticAuthority: false;
  modelConfidenceAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismAllocationProjection = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-allocation.v1";
  projectionIdentity: Hash;
  observedAt: string;
  policy: Readonly<{
    schemaVersion: "pmh.world-state-mechanism-allocation-policy.v1";
    policyIdentity: Hash;
    portfolioCaps: typeof PORTFOLIO_CAPS;
    requiredEvidence: "SHARED_SUBJECT_AND_WORLD_PREDICATE_DIVERGENCE";
    structuralHeuristicSemanticAuthority: false;
    automaticDispatch: false;
  }>;
  eligibleCount: number;
  structurallySuitableCount: number;
  selectedCount: number;
  heldLowSuitabilityCount: number;
  heldPortfolioRedundancyCount: number;
  coveredCount: number;
  actions: readonly WorldStateMechanismAllocationAction[];
  selectedActions: readonly WorldStateMechanismAllocationAction[];
  holdReasonCounts: readonly Readonly<{
    reason: WorldStateMechanismSuitabilityHazard | "PORTFOLIO_REDUNDANCY";
    count: number;
  }>[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  automaticDispatch: false;
  authority: "MECHANISM_RESEARCH_ATTENTION_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

type Candidate = Readonly<{
  assignment: WorldStateMechanismResearchAssignment;
  revision: OntologySearchIssueRevision;
  canonicalSubjectKey: string;
  structuralPatternKey: string;
  representativeTitleExcerpts: readonly [string, string];
  vector: WorldStateMechanismSuitabilityVector;
  positiveSignals: readonly WorldStateMechanismSuitabilitySignal[];
  hazards: readonly WorldStateMechanismSuitabilityHazard[];
  suitable: boolean;
}>;

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function aggregateTitle(title: string): boolean {
  return /^(?:yes|no)\s/iu.test(title.trim()) ||
    (title.match(/(?:^|,)\s*(?:yes|no)\s/giu)?.length ?? 0) >= 2;
}

const ROLE_STOP_WORDS = new Set([
  "a", "an", "and", "at", "be", "by", "did", "do", "does", "for", "from", "in",
  "is", "it", "of", "on", "or", "the", "to", "will", "with", "yes", "no",
]);
const CONTRACT_ROLE_SIGNALS = new Set([
  "above", "below", "down", "exceed", "hourly", "market", "price", "under", "up",
]);

function tokens(value: string): readonly string[] {
  return value.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function worldRoleSignature(
  title: string,
  sharedSubjectSignals: readonly string[],
  temporalSignals: readonly string[],
  parameterSignals: readonly string[],
): string {
  const discarded = new Set([
    ...sharedSubjectSignals.flatMap(tokens),
    ...temporalSignals.flatMap(tokens),
    ...parameterSignals.flatMap(tokens),
  ]);
  return unique(tokens(title).filter((token) =>
    !ROLE_STOP_WORDS.has(token) && !discarded.has(token) && !/^\d+$/u.test(token)
  )).join("\u0000");
}

function adjacentProperNameToken(title: string, sharedSignal: string): string | null {
  const titleTokens = title.match(/[\p{L}\p{N}]+/gu) ?? [];
  const index = titleTokens.findIndex((token) =>
    token.toLocaleLowerCase("en-US") === sharedSignal.toLocaleLowerCase("en-US")
  );
  if (index < 0) return null;
  const candidates = [titleTokens[index - 1], titleTokens[index + 1]].filter(
    (token): token is string => token !== undefined,
  );
  return candidates.find((token) =>
    /^\p{Lu}[\p{L}\p{N}]*$/u.test(token) &&
    !ROLE_STOP_WORDS.has(token.toLocaleLowerCase("en-US")) &&
    token.toLocaleLowerCase("en-US") !== sharedSignal.toLocaleLowerCase("en-US")
  )?.toLocaleLowerCase("en-US") ?? null;
}

function outcomeTemplate(title: string): string | null {
  const parts = title.split(/\s+[—–-]\s+/u);
  return parts.length > 1 ? parts[0]!.trim().toLocaleLowerCase("en-US") : null;
}

function trailheadFacts(
  revision: OntologySearchIssueRevision,
  trailhead: MarketOntologyTrailhead,
) {
  const evidence = new Map(revision.taskPayload.listingEvidence.map((item) =>
    [item.listingRef, item] as const
  ));
  const left = evidence.get(trailhead.listingRefs[0]);
  const right = evidence.get(trailhead.listingRefs[1]);
  if (left === undefined || right === undefined) {
    throw new Error("mechanism suitability trailhead evidence is incomplete");
  }
  const shared = new Set(trailhead.sharedSubjectSignals);
  const onlyContractRoleSignals = trailhead.sharedSubjectSignals.every((item) =>
    CONTRACT_ROLE_SIGNALS.has(item.toLocaleLowerCase("en-US"))
  );
  const leftExclusive = left.node.worldFacet.subjectSignals.filter((item) => !shared.has(item));
  const rightExclusive = right.node.worldFacet.subjectSignals.filter((item) => !shared.has(item));
  const leftRole = worldRoleSignature(
    left.title,
    trailhead.sharedSubjectSignals,
    left.node.worldFacet.temporalSignals,
    left.node.worldFacet.parameterSignals,
  );
  const rightRole = worldRoleSignature(
    right.title,
    trailhead.sharedSubjectSignals,
    right.node.worldFacet.temporalSignals,
    right.node.worldFacet.parameterSignals,
  );
  const distinctRoleLanguage = leftRole.length > 0 && rightRole.length > 0 && leftRole !== rightRole;
  const predicateDivergent = trailhead.changedFacets.includes("WORLD_PREDICATE");
  const temporalDivergent = trailhead.changedFacets.includes("WORLD_TIME_SCOPE") ||
    left.node.worldFacet.temporalSignals.join("\u0000") !==
      right.node.worldFacet.temporalSignals.join("\u0000");
  const worldChanged = trailhead.changedFacets.some((item) =>
    item === "WORLD_PREDICATE" || item === "WORLD_TIME_SCOPE" || item === "WORLD_PARAMETER"
  );
  const leftTemplate = outcomeTemplate(left.title);
  const rightTemplate = outcomeTemplate(right.title);
  const sharedSignal = trailhead.sharedSubjectSignals[0];
  const leftProperNeighbor = sharedSignal === undefined ? null :
    adjacentProperNameToken(left.title, sharedSignal);
  const rightProperNeighbor = sharedSignal === undefined ? null :
    adjacentProperNameToken(right.title, sharedSignal);
  return Object.freeze({
    coherent: trailhead.sharedSubjectSignals.length > 0,
    predicateDivergent,
    distinctRoleLanguage,
    temporalDivergent,
    multiVenue: left.node.settlementFacet.venueId !== right.node.settlementFacet.venueId,
    multiSignal: trailhead.sharedSubjectSignals.length > 1,
    singleSignalAmbiguity: trailhead.sharedSubjectSignals.length === 1 &&
      leftExclusive.length > 0 && rightExclusive.length > 0 &&
      leftProperNeighbor !== null && rightProperNeighbor !== null &&
      leftProperNeighbor !== rightProperNeighbor,
    aggregate: trailhead.listingTitleExcerpts.some(aggregateTitle),
    onlyContractRoleSignals,
    parallelOutcomeAlternatives: leftTemplate !== null && leftTemplate === rightTemplate &&
      left.title !== right.title,
    settlementOrTradingOnly: !worldChanged,
    sameEventInterval: !predicateDivergent && temporalDivergent,
  });
}

function candidate(
  assignment: WorldStateMechanismResearchAssignment,
  revision: OntologySearchIssueRevision,
): Candidate {
  const assessed = revision.taskPayload.trailheads.map((trailhead) => Object.freeze({
    trailhead,
    facts: trailheadFacts(revision, trailhead),
  }));
  const representative = [...assessed].sort((left, right) =>
    Number(right.facts.predicateDivergent) - Number(left.facts.predicateDivergent) ||
    Number(right.facts.multiSignal) - Number(left.facts.multiSignal) ||
    Number(left.facts.singleSignalAmbiguity) - Number(right.facts.singleSignalAmbiguity) ||
    right.trailhead.score - left.trailhead.score ||
    left.trailhead.trailheadId.localeCompare(right.trailhead.trailheadId)
  )[0];
  if (representative === undefined) throw new Error("mechanism suitability input has no trailhead");
  const evidence = new Map(revision.taskPayload.listingEvidence.map((item) =>
    [item.listingRef, item] as const
  ));
  const structuralPatternKey = representative.trailhead.listingRefs.map((ref) => {
    const listing = evidence.get(ref);
    if (listing === undefined) throw new Error("mechanism structural pattern evidence is unavailable");
    return listing.node.worldFacet.predicateFamilies.join("+");
  }).sort().join("→");
  const vector = Object.freeze({
    coherentTrailheadCount: assessed.filter((item) => item.facts.coherent).length,
    predicateDivergentTrailheadCount: assessed.filter((item) =>
      item.facts.predicateDivergent
    ).length,
    distinctRoleLanguageTrailheadCount: assessed.filter((item) =>
      item.facts.distinctRoleLanguage
    ).length,
    temporallyDivergentTrailheadCount: assessed.filter((item) =>
      item.facts.temporalDivergent
    ).length,
    multiVenueTrailheadCount: assessed.filter((item) => item.facts.multiVenue).length,
    multiSignalTrailheadCount: assessed.filter((item) => item.facts.multiSignal).length,
    singleSignalAmbiguityCount: assessed.filter((item) =>
      item.facts.singleSignalAmbiguity
    ).length,
    aggregateTitleCount: assessed.filter((item) => item.facts.aggregate).length,
    contractRoleOnlyTrailheadCount: assessed.filter((item) =>
      item.facts.onlyContractRoleSignals
    ).length,
    maximumTrailheadScore: Math.max(...assessed.map((item) => item.trailhead.score)),
  });
  const positiveSignals = unique<WorldStateMechanismSuitabilitySignal>([
    ...(vector.coherentTrailheadCount > 0 ? ["COHERENT_SHARED_SUBJECT" as const] : []),
    ...(vector.multiSignalTrailheadCount > 0 ? ["MULTI_SIGNAL_SUBJECT" as const] : []),
    ...(vector.predicateDivergentTrailheadCount > 0 ?
      ["WORLD_PREDICATE_DIVERGENCE" as const] : []),
    ...(vector.distinctRoleLanguageTrailheadCount > 0 ?
      ["DISTINCT_ROLE_LANGUAGE" as const] : []),
    ...(vector.temporallyDivergentTrailheadCount > 0 ?
      ["TEMPORAL_ORDERING_POTENTIAL" as const] : []),
    ...(vector.multiVenueTrailheadCount > 0 ? ["MULTI_VENUE_EVIDENCE" as const] : []),
    ...(assessed.length > 1 ? ["CORROBORATING_TRAILHEADS" as const] : []),
  ]);
  const hazards = unique<WorldStateMechanismSuitabilityHazard>([
    ...(vector.predicateDivergentTrailheadCount === 0 ?
      ["NO_WORLD_PREDICATE_DIVERGENCE" as const] : []),
    ...(assessed.every((item) => item.facts.settlementOrTradingOnly) ?
      ["SETTLEMENT_OR_TRADING_DIVERGENCE_ONLY" as const] : []),
    ...(assessed.some((item) => item.facts.sameEventInterval) ?
      ["SAME_EVENT_INTERVAL_PATTERN" as const] : []),
    ...(vector.singleSignalAmbiguityCount > 0 ?
      ["SINGLE_SIGNAL_SUBJECT_AMBIGUITY" as const] : []),
    ...(vector.aggregateTitleCount > 0 ? ["AGGREGATE_TITLE_AMBIGUITY" as const] : []),
    ...(vector.contractRoleOnlyTrailheadCount > 0 ?
      ["SHARED_SIGNALS_ARE_CONTRACT_ROLE_LANGUAGE" as const] : []),
    ...(assessed.some((item) => item.facts.parallelOutcomeAlternatives) ?
      ["PARALLEL_OUTCOME_ALTERNATIVES" as const] : []),
  ]);
  return Object.freeze({
    assignment,
    revision,
    canonicalSubjectKey: representative.trailhead.sharedSubjectSignals.join("\u0000"),
    structuralPatternKey,
    representativeTitleExcerpts: representative.trailhead.listingTitleExcerpts,
    vector,
    positiveSignals,
    hazards,
    suitable: assignment.campaignEligible && vector.coherentTrailheadCount > 0 &&
      vector.predicateDivergentTrailheadCount > 0 &&
      vector.singleSignalAmbiguityCount === 0 && vector.aggregateTitleCount === 0 &&
      vector.contractRoleOnlyTrailheadCount === 0 &&
      !assessed.some((item) => item.facts.parallelOutcomeAlternatives),
  });
}

function rank(left: Candidate, right: Candidate): number {
  return Number(left.vector.singleSignalAmbiguityCount > 0) -
      Number(right.vector.singleSignalAmbiguityCount > 0) ||
    right.vector.multiSignalTrailheadCount - left.vector.multiSignalTrailheadCount ||
    right.vector.predicateDivergentTrailheadCount - left.vector.predicateDivergentTrailheadCount ||
    right.vector.temporallyDivergentTrailheadCount - left.vector.temporallyDivergentTrailheadCount ||
    right.vector.multiVenueTrailheadCount - left.vector.multiVenueTrailheadCount ||
    right.vector.coherentTrailheadCount - left.vector.coherentTrailheadCount ||
    right.vector.maximumTrailheadScore - left.vector.maximumTrailheadScore ||
    left.assignment.mechanismIssueId.localeCompare(right.assignment.mechanismIssueId);
}

function diagnostic(candidate: Candidate, disposition: WorldStateMechanismAllocationDisposition) {
  if (disposition === "COVERED_BY_EXACT_RESULT") {
    return "An exact proposal, falsifier, or abstention already covers this input revision";
  }
  if (disposition === "HELD_PORTFOLIO_REDUNDANCY") {
    return "Structurally suitable, but the bounded portfolio already covers this subject or relation pattern";
  }
  if (disposition === "SELECTED_FOR_MECHANISM_RESEARCH") {
    return "Shared-subject evidence and distinct world predicates justify bounded Agent mechanism research";
  }
  if (candidate.vector.predicateDivergentTrailheadCount === 0) {
    return "No retained trailhead distinguishes the world predicates; interval or contract variation is insufficient";
  }
  return "The retained exact input is too structurally ambiguous for this bounded mechanism campaign";
}

export function buildWorldStateMechanismAllocation(input: Readonly<{
  assignments: readonly WorldStateMechanismResearchAssignment[];
  revisions: readonly OntologySearchIssueRevision[];
}>): WorldStateMechanismAllocationProjection {
  const revisions = new Map(input.revisions.map((item) => [item.revisionId, item] as const));
  const candidates = input.assignments.map((assignment) => {
    const revision = revisions.get(assignment.sourceRevisionId);
    if (revision === undefined) throw new Error("mechanism allocation source revision is unavailable");
    return candidate(assignment, revision);
  });
  const selectedIds = new Set<Hash>();
  const selectedSubjects = new Map<string, number>();
  const selectedPatterns = new Map<Hash, number>();
  const selectedStructuralPatterns = new Map<string, number>();
  for (const item of candidates.filter((value) => value.suitable).sort(rank)) {
    if (selectedIds.size >= PORTFOLIO_CAPS.total) break;
    if ((selectedSubjects.get(item.canonicalSubjectKey) ?? 0) >=
        PORTFOLIO_CAPS.perCanonicalSubject ||
        (selectedPatterns.get(item.assignment.relationPatternId) ?? 0) >=
        PORTFOLIO_CAPS.perRelationPattern ||
        (selectedStructuralPatterns.get(item.structuralPatternKey) ?? 0) >=
        PORTFOLIO_CAPS.perStructuralPattern) continue;
    selectedIds.add(item.assignment.assignmentId);
    selectedSubjects.set(item.canonicalSubjectKey,
      (selectedSubjects.get(item.canonicalSubjectKey) ?? 0) + 1);
    selectedPatterns.set(item.assignment.relationPatternId,
      (selectedPatterns.get(item.assignment.relationPatternId) ?? 0) + 1);
    selectedStructuralPatterns.set(item.structuralPatternKey,
      (selectedStructuralPatterns.get(item.structuralPatternKey) ?? 0) + 1);
  }
  const actions = Object.freeze(candidates.map((item) => {
    const disposition: WorldStateMechanismAllocationDisposition =
      !item.assignment.campaignEligible ? "COVERED_BY_EXACT_RESULT" :
      !item.suitable ? "HELD_LOW_STRUCTURAL_SUITABILITY" :
      selectedIds.has(item.assignment.assignmentId) ? "SELECTED_FOR_MECHANISM_RESEARCH" :
      "HELD_PORTFOLIO_REDUNDANCY";
    const body = Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-allocation-action.v1" as const,
      assignmentId: item.assignment.assignmentId,
      mechanismIssueId: item.assignment.mechanismIssueId,
      taskId: item.assignment.task.taskId,
      sourceRevisionId: item.assignment.sourceRevisionId,
      sourceOntologyIssueId: item.assignment.sourceOntologyIssueId,
      relationPatternId: item.assignment.relationPatternId,
      selectionLane: item.assignment.selectionLane,
      canonicalSubjectKey: item.canonicalSubjectKey,
      structuralPatternKey: item.structuralPatternKey,
      representativeTitleExcerpts: item.representativeTitleExcerpts,
      structuralSuitability: !item.assignment.campaignEligible ? "COVERED" as const :
        item.suitable ? "SUITABLE" as const : "LOW" as const,
      suitabilityVector: item.vector,
      positiveSignals: item.positiveSignals,
      hazards: item.hazards,
      disposition,
      diagnostic: diagnostic(item, disposition),
      authority: "MECHANISM_RESEARCH_ATTENTION_PROPOSAL_ONLY" as const,
      structuralHeuristicSemanticAuthority: false as const,
      modelConfidenceAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, actionId: hashCanonical(body) });
  }).sort((left, right) => {
    const order: Record<WorldStateMechanismAllocationDisposition, number> = {
      SELECTED_FOR_MECHANISM_RESEARCH: 0,
      HELD_LOW_STRUCTURAL_SUITABILITY: 1,
      HELD_PORTFOLIO_REDUNDANCY: 2,
      COVERED_BY_EXACT_RESULT: 3,
    };
    return order[left.disposition] - order[right.disposition] ||
      left.mechanismIssueId.localeCompare(right.mechanismIssueId);
  }));
  const selectedActions = Object.freeze(actions.filter((item) =>
    item.disposition === "SELECTED_FOR_MECHANISM_RESEARCH"
  ));
  const reasonCounts = new Map<WorldStateMechanismSuitabilityHazard | "PORTFOLIO_REDUNDANCY", number>();
  for (const action of actions) {
    if (action.disposition === "HELD_LOW_STRUCTURAL_SUITABILITY") {
      for (const hazard of action.hazards) reasonCounts.set(hazard,
        (reasonCounts.get(hazard) ?? 0) + 1);
    } else if (action.disposition === "HELD_PORTFOLIO_REDUNDANCY") {
      reasonCounts.set("PORTFOLIO_REDUNDANCY", (reasonCounts.get("PORTFOLIO_REDUNDANCY") ?? 0) + 1);
    }
  }
  const policyBody = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-allocation-policy.v1" as const,
    portfolioCaps: PORTFOLIO_CAPS,
    requiredEvidence: "SHARED_SUBJECT_AND_WORLD_PREDICATE_DIVERGENCE" as const,
    structuralHeuristicSemanticAuthority: false as const,
    automaticDispatch: false as const,
  });
  const policy = Object.freeze({ ...policyBody, policyIdentity: hashCanonical(policyBody) });
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-allocation.v1" as const,
    observedAt: input.assignments.map((item) => item.materializedAt).sort().at(-1) ??
      "1970-01-01T00:00:00.000Z",
    policy,
    eligibleCount: input.assignments.filter((item) => item.campaignEligible).length,
    structurallySuitableCount: actions.filter((item) =>
      item.structuralSuitability === "SUITABLE"
    ).length,
    selectedCount: selectedActions.length,
    heldLowSuitabilityCount: actions.filter((item) =>
      item.disposition === "HELD_LOW_STRUCTURAL_SUITABILITY"
    ).length,
    heldPortfolioRedundancyCount: actions.filter((item) =>
      item.disposition === "HELD_PORTFOLIO_REDUNDANCY"
    ).length,
    coveredCount: actions.filter((item) => item.disposition === "COVERED_BY_EXACT_RESULT").length,
    actions,
    selectedActions,
    holdReasonCounts: Object.freeze([...reasonCounts.entries()].map(([reason, count]) =>
      Object.freeze({ reason, count })
    ).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "MECHANISM_RESEARCH_ATTENTION_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
