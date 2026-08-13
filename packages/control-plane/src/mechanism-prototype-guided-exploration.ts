import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertMarketCorpusSnapshot,
  searchMarketCorpus,
  type MarketCorpusSearchQuery,
  type MarketCorpusSearchResult,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import {
  assertMarketOntologySnapshot,
  marketOntologyPredicateFamiliesForText,
  type MarketOntologyPredicateFamily,
  type MarketOntologySnapshot,
  type MarketOntologyTrailhead,
} from "./market-ontology.js";
import { buildSearchScopeIdentity } from "./search-scope-identity.js";
import {
  buildAgentTask,
  type AgentExecutionSnapshot,
  type AgentTask,
} from "./agent-execution-substrate.js";
import type { OperationalStorageProjection } from "./types.js";
import {
  assertWorldStateMechanismPrototypeInput,
  assertWorldStateMechanismPrototypeProposal,
  type WorldStateMechanismPrototypeInputRevision,
  type WorldStateMechanismPrototypeProposal,
} from "./world-state-mechanism-prototype.js";
import { adjacentWorldStateProperNameToken } from
  "./world-state-mechanism-allocation.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SEEDS_PER_LENS = 8;
const ESTABLISHED_AT = "2026-08-13T00:00:00.000Z";

export const MECHANISM_PROTOTYPE_EXPLORATION_TASK_PROTOCOL =
  "MECHANISM_PROTOTYPE_EXPLORATION_TASK_V1" as const;
export const MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL =
  "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V2" as const;

export const MECHANISM_PROTOTYPE_EXPLORATION_AXES = Object.freeze([
  "AGGREGATE_INSTITUTION",
  "SUBJECT_AND_GEOGRAPHY",
  "SURFACE_DOMAIN",
  "COUNTEREXAMPLE_FRONTIER",
] as const);

export type MechanismPrototypeExplorationAxis =
  (typeof MECHANISM_PROTOTYPE_EXPLORATION_AXES)[number];

export type MechanismPrototypeExplorationSeed = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-seed.v1";
  seedId: Hash;
  sourceTrailheadId: Hash;
  listingRefs: readonly [string, string];
  listingTitleExcerpts: readonly [string, string];
  matchedPrototypeSignals: readonly string[];
  predicateFamilies: readonly MarketOntologyPredicateFamily[];
  changedFacets: MarketOntologyTrailhead["changedFacets"];
  selectionLane: MarketOntologyTrailhead["selectionLane"];
  axis: MechanismPrototypeExplorationAxis;
  lexicalScore: number;
  noveltyReasons: readonly string[];
  authority: "PROVIDER_FREE_EXPLORATION_SEED_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationCoverageMember = Readonly<{
  listingRef: string;
  semanticListingIdentity: Hash;
  inclusionReasons: readonly (
    | "DETERMINISTIC_SEED_MEMBER"
    | "PROTOTYPE_SIGNAL_MATCH"
    | "COMPONENT_AGGREGATE_ROLE_CUE"
    | "INSTITUTION_FRONTIER_CUE"
  )[];
}>;

export type MechanismPrototypeExplorationInputRevision = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-input.v1";
  inputRevisionId: Hash;
  lensId: Hash;
  prototypeId: Hash;
  sourcePrototypeInputRevisionId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  semanticInputIdentity: Hash;
  coverageScopeIdentity?: Hash;
  coverageMembers?: readonly MechanismPrototypeExplorationCoverageMember[];
  corpusSnapshotIdentity: Hash;
  corpusSemanticIdentity: Hash;
  sourceSetIdentity: Hash;
  ontologyIdentity: Hash;
  knownMemberRouteFamilyIds: readonly Hash[];
  excludedListingRefs: readonly string[];
  seedTrailheads: readonly MechanismPrototypeExplorationSeed[];
  materializedAt: string;
  inputBinding: "EXACT_CURRENT_CORPUS_OBSERVATION_WITH_PRICE_INDEPENDENT_SEMANTIC_IDENTITY";
  authority: "PROTOTYPE_GUIDED_SEARCH_INPUT_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationTaskContract = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-task.v1";
  lensId: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  objective: "SEARCH_EXACT_CORPUS_FOR_NOVEL_TRAILHEAD_OR_RETAIN_EXHAUSTION";
  inputBinding: "EXACT_EXPLORATION_INPUT_REVISION_REQUIRED";
  zeroSeedResearchEligible: true;
  authority: "PROTOTYPE_GUIDED_HEURISTIC_SEARCH_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationLens = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-lens.v1";
  lensId: Hash;
  prototype: WorldStateMechanismPrototypeProposal;
  sourcePrototypeInput: WorldStateMechanismPrototypeInputRevision;
  axis: MechanismPrototypeExplorationAxis;
  variationQuestion: string;
  currentInputRevision: MechanismPrototypeExplorationInputRevision;
  task: AgentTask;
  taskContract: MechanismPrototypeExplorationTaskContract;
  trailheadIds: readonly Hash[];
  exhaustionIds: readonly Hash[];
  retainedTrailheadIds: readonly Hash[];
  retainedExhaustionIds: readonly Hash[];
  retainedSemanticInputCount: number;
  uncoveredCoverageMemberCount: number;
  state: "UNEXPLORED" | "TRAILHEAD_RECORDED" | "EXHAUSTED" | "MIXED_RESULTS";
  campaignEligible: boolean;
  automaticDispatch: false;
  authority: "HEURISTIC_EXPLORATION_ASSIGNMENT_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationEvidenceBinding = Readonly<{
  listingRef: string;
  title: string;
  venueId: string;
  sourceRawHash: string;
  protocolIdentity: string;
  semanticListingIdentity: Hash;
}>;

export type MechanismPrototypeExplorationTrailhead = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-trailhead.v1";
  trailheadId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  evidenceBindings: readonly MechanismPrototypeExplorationEvidenceBinding[];
  structuralAnalogy: string;
  surfaceDifferences: readonly string[];
  appliedTransferTests: readonly string[];
  activatedCounterScenarios: readonly string[];
  searchSignals: readonly string[];
  noveltyAxisExplanation: string;
  rationale: string;
  searchedResultIds: readonly Hash[];
  proposedAt: string;
  authority: "PROTOTYPE_GUIDED_TRAILHEAD_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationExhaustion = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-exhaustion.v1";
  exhaustionId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  inspectedEvidenceBindings: readonly MechanismPrototypeExplorationEvidenceBinding[];
  searchedResultIds: readonly Hash[];
  searchedNeighborhoods: readonly string[];
  failedTransferTests: readonly string[];
  activatedCounterScenarios: readonly string[];
  reason: string;
  proposedAt: string;
  authority: "BOUNDED_PROTOTYPE_EXPLORATION_NEGATIVE_MEMORY_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface MechanismPrototypeExplorationStore {
  readonly mechanismPrototypeExplorationInputStorage:
    OperationalStorageProjection<"inputRevisionId">;
  readonly mechanismPrototypeExplorationTrailheadStorage:
    OperationalStorageProjection<"trailheadId">;
  readonly mechanismPrototypeExplorationExhaustionStorage:
    OperationalStorageProjection<"exhaustionId">;
  loadMechanismPrototypeExplorationInputs(limit: number):
    readonly MechanismPrototypeExplorationInputRevision[];
  saveMechanismPrototypeExplorationInputs(inputs:
    readonly MechanismPrototypeExplorationInputRevision[]):
    readonly MechanismPrototypeExplorationInputRevision[];
  loadMechanismPrototypeExplorationTrailheads(limit: number):
    readonly MechanismPrototypeExplorationTrailhead[];
  saveMechanismPrototypeExplorationTrailheads(trailheads:
    readonly MechanismPrototypeExplorationTrailhead[]):
    readonly MechanismPrototypeExplorationTrailhead[];
  loadMechanismPrototypeExplorationExhaustions(limit: number):
    readonly MechanismPrototypeExplorationExhaustion[];
  saveMechanismPrototypeExplorationExhaustions(exhaustions:
    readonly MechanismPrototypeExplorationExhaustion[]):
    readonly MechanismPrototypeExplorationExhaustion[];
}

export type MechanismPrototypeExplorationUsage = Readonly<{
  sourceRunIds: readonly Hash[];
  modelInvocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  unknownUsageInvocationCount: number;
}>;

export type MechanismPrototypeExplorationProjection = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-projection.v1";
  projectionIdentity: Hash;
  prototypeCount: number;
  lensCount: number;
  eligibleLensCount: number;
  attemptedLensCount: number;
  successfulLensCount: number;
  exhaustedLensCount: number;
  currentSemanticAttemptedLensCount: number;
  currentSemanticSuccessfulLensCount: number;
  currentSemanticExhaustedLensCount: number;
  seededLensCount: number;
  zeroSeedLensCount: number;
  seedCount: number;
  axisCounts: Readonly<Record<MechanismPrototypeExplorationAxis, number>>;
  usage: Readonly<{
    sourceRunCount: number;
    modelInvocationCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownUsageInvocationCount: number;
  }>;
  corpusSnapshotIdentity: Hash;
  corpusSemanticIdentity: Hash;
  lenses: readonly MechanismPrototypeExplorationLens[];
  effects: Readonly<{
    providerRequests: 0;
    modelInvocations: 0;
    runs: 0;
    campaigns: 0;
    dispatches: 0;
    externalWrites: 0;
    valueMovingActions: 0;
  }>;
}>;

function canonicalText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

function exactStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function exactHashes(values: readonly Hash[]): readonly Hash[] {
  const result = exactStrings(values);
  if (result.some((value) => !HASH_PATTERN.test(value))) {
    throw new Error("mechanism exploration lineage contains an invalid hash");
  }
  return result as readonly Hash[];
}

const COVERAGE_STOP_WORDS = new Set([
  "after", "before", "between", "control", "election", "holding", "influences",
  "market", "national", "office", "outcome", "party", "result", "state", "winner",
  "with", "will", "would",
]);

function coverageSignalTokens(
  prototype: WorldStateMechanismPrototypeProposal,
  sourceInput: WorldStateMechanismPrototypeInputRevision,
): readonly string[] {
  return exactStrings([
    ...prototype.searchSignals,
    ...prototype.variableSlots.flatMap((slot) => slot.values.map((item) => item.value)),
    ...sourceInput.memberRoutes.flatMap((route) => [
      ...route.canonicalRoute.canonicalSubjectLabels,
      ...route.canonicalRoute.canonicalTriggerSearchSignals,
      ...route.canonicalRoute.canonicalDependentSearchSignals,
    ]),
  ].flatMap((value) => canonicalText(value).split(/[^\p{L}\p{N}]+/gu))
    .filter((token) => token.length >= 4 && !COVERAGE_STOP_WORDS.has(token)));
}

function materializeCoverageMembers(input: Readonly<{
  corpus: MarketCorpusSnapshot;
  prototype: WorldStateMechanismPrototypeProposal;
  sourceInput: WorldStateMechanismPrototypeInputRevision;
  axis: MechanismPrototypeExplorationAxis;
  seeds: readonly MechanismPrototypeExplorationSeed[];
}>): readonly MechanismPrototypeExplorationCoverageMember[] {
  const seedRefs = new Set(input.seeds.flatMap((seed) => seed.listingRefs));
  const signalTokens = coverageSignalTokens(input.prototype, input.sourceInput);
  const sourceInstitutions = new Set(input.sourceInput.memberRoutes.flatMap((route) => [
    ...institutionFamilies(route.canonicalRoute.triggerPredicate),
    ...institutionFamilies(route.canonicalRoute.dependentPredicate),
  ]));
  return Object.freeze(input.corpus.listings.flatMap((listing) => {
    // A deterministic seed is already the narrowest provider-free neighborhood
    // admitted by this lens. Do not let broad lexical cues silently enlarge a
    // paid-search coverage scope around it.
    if (seedRefs.size > 0 && !seedRefs.has(listing.listingRef)) return [];
    const text = canonicalText([
      listing.title, listing.description, listing.rulesText ?? "",
      ...listing.outcomes.map((outcome) => outcome.label),
    ].join(" "));
    const signalMatches = signalTokens.filter((token) => text.includes(token));
    const roleCue = componentCue(listing.title) || aggregateCue(listing.title);
    const institutions = institutionFamilies(listing.title);
    const institutionFrontier = roleCue && (
      institutions.size === 0 || [...institutions].some((item) => !sourceInstitutions.has(item))
    );
    const reasons = exactStrings([
      ...(seedRefs.has(listing.listingRef) ? ["DETERMINISTIC_SEED_MEMBER"] : []),
      ...(signalMatches.length >= 1 ? ["PROTOTYPE_SIGNAL_MATCH"] : []),
      ...(input.axis === "SURFACE_DOMAIN" && roleCue
        ? ["COMPONENT_AGGREGATE_ROLE_CUE"] : []),
      ...((input.axis === "AGGREGATE_INSTITUTION" ||
          input.axis === "COUNTEREXAMPLE_FRONTIER") && institutionFrontier
        ? ["INSTITUTION_FRONTIER_CUE"] : []),
    ]) as MechanismPrototypeExplorationCoverageMember["inclusionReasons"];
    if (reasons.length === 0) return [];
    return [Object.freeze({
      listingRef: listing.listingRef,
      semanticListingIdentity: buildSearchScopeIdentity([listing]).semanticScopeIdentity,
      inclusionReasons: reasons,
    })];
  }).sort((left, right) => left.listingRef.localeCompare(right.listingRef)));
}

function assertExplorationSeed(value: unknown): MechanismPrototypeExplorationSeed {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration seed is malformed");
  }
  const seed = value as MechanismPrototypeExplorationSeed;
  const keys = Object.keys(seed).sort();
  const expected = [
    "schemaVersion", "seedId", "sourceTrailheadId", "listingRefs",
    "listingTitleExcerpts", "matchedPrototypeSignals", "predicateFamilies",
    "changedFacets", "selectionLane", "axis", "lexicalScore", "noveltyReasons",
    "authority", "semanticDecisionAuthority", "probabilityAuthority",
    "certificateAuthority", "executionAuthority", "externalWriteAuthority",
    "valueMovingAuthority",
  ].sort();
  const { seedId, ...body } = seed;
  if (
    keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
    seed.schemaVersion !== "pmh.mechanism-prototype-exploration-seed.v1" ||
    !HASH_PATTERN.test(String(seedId)) || seedId !== hashCanonical(body) ||
    !HASH_PATTERN.test(String(seed.sourceTrailheadId)) ||
    !Array.isArray(seed.listingRefs) || seed.listingRefs.length !== 2 ||
    new Set(seed.listingRefs).size !== 2 || seed.listingRefs.some((item) =>
      typeof item !== "string" || item.trim() === ""
    ) ||
    !Array.isArray(seed.listingTitleExcerpts) || seed.listingTitleExcerpts.length !== 2 ||
    seed.listingTitleExcerpts.some((item) => typeof item !== "string" || item.trim() === "") ||
    exactStrings(seed.matchedPrototypeSignals).join("\n") !==
      seed.matchedPrototypeSignals.join("\n") ||
    exactStrings(seed.predicateFamilies).join("\n") !== seed.predicateFamilies.join("\n") ||
    !MECHANISM_PROTOTYPE_EXPLORATION_AXES.includes(seed.axis) ||
    !Number.isSafeInteger(seed.lexicalScore) || seed.lexicalScore < 0 ||
    exactStrings(seed.noveltyReasons).join("\n") !== seed.noveltyReasons.join("\n") ||
    seed.authority !== "PROVIDER_FREE_EXPLORATION_SEED_ONLY" ||
    seed.semanticDecisionAuthority !== false || seed.probabilityAuthority !== false ||
    seed.certificateAuthority !== false || seed.executionAuthority !== false ||
    seed.externalWriteAuthority !== false || seed.valueMovingAuthority !== false
  ) throw new Error("mechanism exploration seed violates its bounded contract");
  return Object.freeze(seed);
}

function tokens(values: readonly string[]): ReadonlySet<string> {
  return new Set(values.flatMap((value) => canonicalText(value)
    .split(/[^\p{L}\p{N}]+/gu)
    .filter((item) => item.length >= 3)));
}

function latestSourceTime(corpus: MarketCorpusSnapshot): string {
  const latest = corpus.listings.map((item) => item.sourceReceivedAt).sort().at(-1) ??
    ESTABLISHED_AT;
  if (!Number.isFinite(Date.parse(latest)) || new Date(latest).toISOString() !== latest) {
    throw new Error("mechanism exploration corpus time is invalid");
  }
  return latest;
}

function knownListingRefs(input: WorldStateMechanismPrototypeInputRevision): readonly string[] {
  return exactStrings(input.memberRoutes.flatMap((route) => [
    ...route.triggerEvidenceBindings.map((item) => item.listingRef),
    ...route.dependentEvidenceBindings.map((item) => item.listingRef),
  ]));
}

function sourcePredicateFamilies(
  input: WorldStateMechanismPrototypeInputRevision,
): ReadonlySet<MarketOntologyPredicateFamily> {
  return new Set(input.memberRoutes.flatMap((route) => [
    ...marketOntologyPredicateFamiliesForText(route.canonicalRoute.triggerPredicate),
    ...marketOntologyPredicateFamiliesForText(route.canonicalRoute.dependentPredicate),
  ]));
}

function lensIdentity(
  prototype: WorldStateMechanismPrototypeProposal,
  axis: MechanismPrototypeExplorationAxis,
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.mechanism-prototype-exploration-lens-identity.v1",
    prototypeId: prototype.prototypeId,
    axis,
  });
}

function variationQuestion(axis: MechanismPrototypeExplorationAxis): string {
  if (axis === "AGGREGATE_INSTITUTION") {
    return "Keep the proposed component-to-aggregate posture, but vary the aggregate institution or chamber. Seek exact markets and test whether one component can affect, but neither necessitates nor suffices for, the aggregate outcome.";
  }
  if (axis === "SUBJECT_AND_GEOGRAPHY") {
    return "Vary the subject and component geography beyond every known member. Reject a mere wording clone and test whether the same role structure survives the new place and subject.";
  }
  if (axis === "SURFACE_DOMAIN") {
    return "Search outside the source election taxonomy for a structurally analogous component-to-aggregate mechanism. Prefer an analogy that changes predicate family and state where the prototype transfer breaks.";
  }
  return "Search first for exact markets that defeat one transfer test or activate a retained counter-scenario. A grounded negative result is preferable to forcing an analogy.";
}

function taskContract(input: Readonly<{
  lensId: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
}>): MechanismPrototypeExplorationTaskContract {
  return Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-task.v1" as const,
    lensId: input.lensId,
    prototypeId: input.prototypeId,
    axis: input.axis,
    objective: "SEARCH_EXACT_CORPUS_FOR_NOVEL_TRAILHEAD_OR_RETAIN_EXHAUSTION" as const,
    inputBinding: "EXACT_EXPLORATION_INPUT_REVISION_REQUIRED" as const,
    zeroSeedResearchEligible: true as const,
    authority: "PROTOTYPE_GUIDED_HEURISTIC_SEARCH_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}

function componentCue(title: string): boolean {
  return /\b(?:district|state (?:senate|house|election)|senate election|house district|primary|grand prix|race|match|game|round|heat|fixture)\b/iu
    .test(title);
}

function aggregateCue(title: string): boolean {
  return /\b(?:control (?:the )?(?:house|senate)|u\.?s\.? (?:house|senate) midterm winner|majority|constructors championship|overall championship|league champion|tournament champion|national champion)\b/iu
    .test(title);
}

function institutionFamilies(title: string): ReadonlySet<string> {
  const values: string[] = [];
  if (/\bsenate\b/iu.test(title)) values.push("SENATE");
  if (/\bhouse\b/iu.test(title)) values.push("HOUSE");
  if (/\bconstructors?\b|\bformula 1\b|\bf1\b/iu.test(title)) values.push("F1");
  if (/\b(?:league|mls|nba|nfl|mlb|nhl)\b/iu.test(title)) values.push("LEAGUE");
  if (/\b(?:tournament|cup)\b/iu.test(title)) values.push("TOURNAMENT");
  return new Set(values);
}

function buildSeed(input: Readonly<{
  trailhead: MarketOntologyTrailhead;
  ontology: MarketOntologySnapshot;
  prototype: WorldStateMechanismPrototypeProposal;
  sourceInput: WorldStateMechanismPrototypeInputRevision;
  axis: MechanismPrototypeExplorationAxis;
}>): MechanismPrototypeExplorationSeed | null {
  const excluded = new Set(knownListingRefs(input.sourceInput));
  if (input.trailhead.listingRefs.some((ref) => excluded.has(ref))) return null;
  const nodes = input.trailhead.listingRefs.map((ref) =>
    input.ontology.nodes.find((item) => item.listingRef === ref)
  );
  if (nodes.some((item) => item === undefined)) {
    throw new Error("mechanism exploration trailhead is absent from its ontology");
  }
  const predicateFamilies = exactStrings(nodes.flatMap((item) =>
    item!.worldFacet.predicateFamilies
  )) as readonly MarketOntologyPredicateFamily[];
  const sourceFamilies = sourcePredicateFamilies(input.sourceInput);
  const prototypeSignals = exactStrings([
    ...input.prototype.searchSignals,
    ...input.prototype.variableSlots.flatMap((slot) =>
      slot.values.map((item) => item.value)
    ),
  ]);
  const prototypeTokens = tokens(prototypeSignals);
  const titleTokens = tokens(input.trailhead.listingTitleExcerpts);
  const matchedPrototypeSignals = exactStrings(prototypeSignals.filter((signal) => {
    const signalTokens = [...tokens([signal])];
    return signalTokens.length > 0 && signalTokens.every((item) => titleTokens.has(item));
  }));
  const tokenOverlap = [...prototypeTokens].filter((item) => titleTokens.has(item)).length;
  const knownSubjects = tokens(input.sourceInput.memberRoutes.flatMap((route) =>
    route.canonicalRoute.canonicalSubjectLabels
  ));
  const sharedSubjectsAreNew = input.trailhead.sharedSubjectSignals.every((signal) =>
    !knownSubjects.has(canonicalText(signal))
  );
  const singleSignal = input.trailhead.sharedSubjectSignals.length === 1
    ? input.trailhead.sharedSubjectSignals[0]!
    : null;
  const properNeighbors = singleSignal === null ? []
    : input.trailhead.listingTitleExcerpts.map((title) =>
        adjacentWorldStateProperNameToken(title, singleSignal)
      );
  const singleSignalProperNameAmbiguity = singleSignal !== null &&
    properNeighbors.length === 2 && properNeighbors.every((item) => item !== null) &&
    properNeighbors[0] !== properNeighbors[1];
  const changesDomain = predicateFamilies.some((family) => !sourceFamilies.has(family));
  const aggregateLanguage = input.trailhead.listingTitleExcerpts.some((title) =>
    /\b(?:control|majority|champion|championship|winner|qualif|aggregate|overall)\b/iu.test(title)
  );
  const componentIndexes = input.trailhead.listingTitleExcerpts.flatMap((title, index) =>
    componentCue(title) ? [index] : []
  );
  const aggregateIndexes = input.trailhead.listingTitleExcerpts.flatMap((title, index) =>
    aggregateCue(title) ? [index] : []
  );
  const distinctComponentAggregateRoles = componentIndexes.some((componentIndex) =>
    aggregateIndexes.some((aggregateIndex) => aggregateIndex !== componentIndex)
  );
  const roleInstitutionAligned = componentIndexes.some((componentIndex) => {
    const componentFamilies = institutionFamilies(
      input.trailhead.listingTitleExcerpts[componentIndex]!,
    );
    return aggregateIndexes.some((aggregateIndex) => aggregateIndex !== componentIndex &&
      [...componentFamilies].some((family) => institutionFamilies(
        input.trailhead.listingTitleExcerpts[aggregateIndex]!,
      ).has(family))
    );
  });
  const hasElectionOrOffice = predicateFamilies.includes("ELECTION_OR_OFFICE");
  const hasFalsificationFacet = input.trailhead.changedFacets.some((facet) =>
    ["WORLD_PREDICATE", "OUTCOME_SPACE", "SETTLEMENT_EVIDENCE", "MECHANISM"]
      .includes(facet)
  );
  const eligible = !singleSignalProperNameAmbiguity &&
    distinctComponentAggregateRoles && (
    input.axis === "AGGREGATE_INSTITUTION"
    ? hasElectionOrOffice && aggregateLanguage && !changesDomain && roleInstitutionAligned
    : input.axis === "SUBJECT_AND_GEOGRAPHY"
    ? hasElectionOrOffice && sharedSubjectsAreNew && !changesDomain && roleInstitutionAligned
    : input.axis === "SURFACE_DOMAIN"
    ? changesDomain && input.trailhead.sharedSubjectSignals.length > 1
    : hasFalsificationFacet
  );
  if (!eligible) return null;
  const noveltyReasons = exactStrings([
    ...(sharedSubjectsAreNew ? ["shared subject signals are outside known members"] : []),
    ...(changesDomain ? ["predicate family differs from source routes"] : []),
    ...(aggregateLanguage ? ["titles expose a component or aggregate outcome cue"] : []),
    ...(distinctComponentAggregateRoles
      ? ["different titles expose component and aggregate roles"] : []),
    ...(roleInstitutionAligned
      ? ["component and aggregate titles name the same institution family"] : []),
    ...(hasFalsificationFacet ? ["pair changes a transfer-relevant world or settlement facet"] : []),
  ]);
  const axisBonus = input.axis === "SURFACE_DOMAIN" && changesDomain ? 3_000
    : input.axis === "SUBJECT_AND_GEOGRAPHY" && sharedSubjectsAreNew ? 2_500
    : input.axis === "COUNTEREXAMPLE_FRONTIER" && hasFalsificationFacet ? 2_000
    : input.axis === "AGGREGATE_INSTITUTION" && aggregateLanguage ? 1_500 : 0;
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-seed.v1" as const,
    sourceTrailheadId: input.trailhead.trailheadId,
    listingRefs: input.trailhead.listingRefs,
    listingTitleExcerpts: input.trailhead.listingTitleExcerpts,
    matchedPrototypeSignals,
    predicateFamilies,
    changedFacets: input.trailhead.changedFacets,
    selectionLane: input.trailhead.selectionLane,
    axis: input.axis,
    lexicalScore: input.trailhead.score + tokenOverlap * 500 +
      matchedPrototypeSignals.length * 750 + axisBonus,
    noveltyReasons,
    authority: "PROVIDER_FREE_EXPLORATION_SEED_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertExplorationSeed(Object.freeze({ ...body, seedId: hashCanonical(body) }));
}

function verifyPrototypeLineage(input: Readonly<{
  prototype: WorldStateMechanismPrototypeProposal;
  sourceInput: WorldStateMechanismPrototypeInputRevision;
}>): void {
  if (
    input.prototype.inputRevisionId !== input.sourceInput.revisionId ||
    input.prototype.candidateId !== input.sourceInput.candidateId ||
    input.prototype.memberRouteFamilyIds.join("\n") !==
      input.sourceInput.memberRouteFamilyIds.join("\n") ||
    hashCanonical(input.prototype.invariantSignature) !==
      hashCanonical(input.sourceInput.signature)
  ) {
    throw new Error("mechanism exploration prototype lineage is inconsistent");
  }
}

export function materializeMechanismPrototypeExplorationProjection(input: Readonly<{
  prototypes: readonly WorldStateMechanismPrototypeProposal[];
  prototypeInputs: readonly WorldStateMechanismPrototypeInputRevision[];
  explorationInputs?: readonly MechanismPrototypeExplorationInputRevision[];
  trailheads?: readonly MechanismPrototypeExplorationTrailhead[];
  exhaustions?: readonly MechanismPrototypeExplorationExhaustion[];
  execution?: AgentExecutionSnapshot;
  corpus: MarketCorpusSnapshot;
  ontology: MarketOntologySnapshot;
}>): MechanismPrototypeExplorationProjection {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const ontology = assertMarketOntologySnapshot(input.ontology);
  if (ontology.sourceSnapshotIdentity !== corpus.snapshotIdentity) {
    throw new Error("mechanism exploration ontology and corpus lineage differ");
  }
  const prototypes = input.prototypes.map(assertWorldStateMechanismPrototypeProposal);
  const sourceInputs = input.prototypeInputs.map(assertWorldStateMechanismPrototypeInput);
  const sourceByRevision = new Map(sourceInputs.map((item) => [item.revisionId, item] as const));
  const retainedTrailheads = (input.trailheads ?? [])
    .map(assertMechanismPrototypeExplorationTrailhead);
  const retainedExhaustions = (input.exhaustions ?? [])
    .map(assertMechanismPrototypeExplorationExhaustion);
  const retainedInputs = (input.explorationInputs ?? [])
    .map(assertMechanismPrototypeExplorationInputRevision);
  const retainedInputById = new Map(retainedInputs.map((item) =>
    [item.inputRevisionId, item] as const
  ));
  const corpusSemanticIdentity = buildSearchScopeIdentity(corpus.listings)
    .semanticScopeIdentity;
  const lenses = Object.freeze(prototypes.flatMap((prototype) => {
    const sourceInput = sourceByRevision.get(prototype.inputRevisionId);
    if (sourceInput === undefined) {
      throw new Error("mechanism exploration source prototype input is unavailable");
    }
    verifyPrototypeLineage({ prototype, sourceInput });
    return MECHANISM_PROTOTYPE_EXPLORATION_AXES.map((axis) => {
      const lensId = lensIdentity(prototype, axis);
      const seedTrailheads = Object.freeze(ontology.trailheads
        .flatMap((trailhead) => {
          const seed = buildSeed({ trailhead, ontology, prototype, sourceInput, axis });
          return seed === null ? [] : [seed];
        })
        .sort((left, right) => right.lexicalScore - left.lexicalScore ||
          left.seedId.localeCompare(right.seedId))
        .slice(0, MAX_SEEDS_PER_LENS));
      const excludedListingRefs = knownListingRefs(sourceInput);
      const coverageMembers = materializeCoverageMembers({
        corpus, prototype, sourceInput, axis, seeds: seedTrailheads,
      });
      const coverageScopeIdentity = hashCanonical({
        schemaVersion: "pmh.mechanism-prototype-exploration-coverage-scope.v1",
        lensId,
        axis,
        members: coverageMembers,
      });
      const semanticInputIdentity = hashCanonical({
        schemaVersion: "pmh.mechanism-prototype-exploration-semantic-input.v1",
        lensId,
        prototypeId: prototype.prototypeId,
        sourcePrototypeInputRevisionId: sourceInput.revisionId,
        coverageScopeIdentity,
        knownMemberRouteFamilyIds: sourceInput.memberRouteFamilyIds,
        excludedListingRefs,
        seedTrailheadIds: seedTrailheads.map((item) => item.seedId),
      });
      const revisionBody = Object.freeze({
        schemaVersion: "pmh.mechanism-prototype-exploration-input.v1" as const,
        lensId,
        prototypeId: prototype.prototypeId,
        sourcePrototypeInputRevisionId: sourceInput.revisionId,
        axis,
        semanticInputIdentity,
        coverageScopeIdentity,
        coverageMembers,
        corpusSnapshotIdentity: corpus.snapshotIdentity,
        corpusSemanticIdentity,
        sourceSetIdentity: corpus.sourceSetIdentity,
        ontologyIdentity: ontology.ontologyIdentity,
        knownMemberRouteFamilyIds: sourceInput.memberRouteFamilyIds,
        excludedListingRefs,
        seedTrailheads,
        materializedAt: latestSourceTime(corpus),
        inputBinding:
          "EXACT_CURRENT_CORPUS_OBSERVATION_WITH_PRICE_INDEPENDENT_SEMANTIC_IDENTITY" as const,
        authority: "PROTOTYPE_GUIDED_SEARCH_INPUT_ONLY" as const,
        semanticDecisionAuthority: false as const,
        probabilityAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        externalWriteAuthority: false as const,
        valueMovingAuthority: false as const,
      });
      const currentInputRevision = Object.freeze({
        ...revisionBody, inputRevisionId: hashCanonical(revisionBody),
      });
      const contract = taskContract({
        lensId, prototypeId: prototype.prototypeId, axis,
      });
      const task = buildAgentTask({
        kind: "MECHANISM_PROTOTYPE_EXPLORATION",
        protocol: MECHANISM_PROTOTYPE_EXPLORATION_TASK_PROTOCOL,
        inputArtifacts: [{
          kind: "MECHANISM_PROTOTYPE_EXPLORATION_LENS",
          artifactId: lensId,
          artifactHash: hashCanonical(contract),
        }],
        taskPayload: contract,
        requestedEffectProtocol: MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
        provenanceRef: `mechanism-prototype-exploration:${lensId}`,
        priority: axis === "SURFACE_DOMAIN" ? 550
          : axis === "AGGREGATE_INSTITUTION" ? 525
          : axis === "SUBJECT_AND_GEOGRAPHY" ? 500 : 475,
        createdAt: ESTABLISHED_AT,
      });
      const matchedTrailheadIds = exactHashes(retainedTrailheads.filter((item) =>
        item.lensId === lensId && item.prototypeId === prototype.prototypeId &&
        item.semanticInputIdentity === semanticInputIdentity
      ).map((item) => item.trailheadId));
      const matchedExhaustionIds = exactHashes(retainedExhaustions.filter((item) =>
        item.lensId === lensId && item.prototypeId === prototype.prototypeId &&
        item.semanticInputIdentity === semanticInputIdentity
      ).map((item) => item.exhaustionId));
      const retainedLensTrailheads = retainedTrailheads.filter((item) =>
        item.lensId === lensId && item.prototypeId === prototype.prototypeId
      );
      const retainedLensExhaustions = retainedExhaustions.filter((item) =>
        item.lensId === lensId && item.prototypeId === prototype.prototypeId
      );
      const retainedTrailheadIds = exactHashes(retainedLensTrailheads
        .map((item) => item.trailheadId));
      const retainedExhaustionIds = exactHashes(retainedLensExhaustions
        .map((item) => item.exhaustionId));
      const retainedSemanticInputCount = new Set([
        ...retainedLensTrailheads.map((item) => item.semanticInputIdentity),
        ...retainedLensExhaustions.map((item) => item.semanticInputIdentity),
      ]).size;
      const coveredSemanticListings = new Set([
        ...retainedLensTrailheads.flatMap((item) => {
          const retainedInput = retainedInputById.get(item.inputRevisionId);
          return retainedInput?.coverageMembers?.map((member) =>
            member.semanticListingIdentity
          ) ?? item.evidenceBindings.map((binding) => binding.semanticListingIdentity);
        }),
        ...retainedLensExhaustions.flatMap((item) => {
          const retainedInput = retainedInputById.get(item.inputRevisionId);
          return retainedInput?.coverageMembers?.map((member) =>
            member.semanticListingIdentity
          ) ?? item.inspectedEvidenceBindings.map((binding) =>
            binding.semanticListingIdentity
          );
        }),
      ]);
      const uncoveredCoverageMemberCount = coverageMembers.filter((member) =>
        !coveredSemanticListings.has(member.semanticListingIdentity)
      ).length;
      const historicallyAttempted = retainedTrailheadIds.length > 0 ||
        retainedExhaustionIds.length > 0;
      const campaignEligible = !historicallyAttempted || uncoveredCoverageMemberCount > 0;
      const state = campaignEligible ? "UNEXPLORED" as const
        : retainedTrailheadIds.length > 0 && retainedExhaustionIds.length > 0
        ? "MIXED_RESULTS" as const
        : retainedTrailheadIds.length > 0 ? "TRAILHEAD_RECORDED" as const
        : retainedExhaustionIds.length > 0 ? "EXHAUSTED" as const
        : "UNEXPLORED" as const;
      return Object.freeze({
        schemaVersion: "pmh.mechanism-prototype-exploration-lens.v1" as const,
        lensId,
        prototype,
        sourcePrototypeInput: sourceInput,
        axis,
        variationQuestion: variationQuestion(axis),
        currentInputRevision,
        task,
        taskContract: contract,
        trailheadIds: matchedTrailheadIds,
        exhaustionIds: matchedExhaustionIds,
        retainedTrailheadIds,
        retainedExhaustionIds,
        retainedSemanticInputCount,
        uncoveredCoverageMemberCount,
        state,
        campaignEligible,
        automaticDispatch: false as const,
        authority: "HEURISTIC_EXPLORATION_ASSIGNMENT_ONLY" as const,
        semanticDecisionAuthority: false as const,
        probabilityAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        externalWriteAuthority: false as const,
        valueMovingAuthority: false as const,
      });
    });
  }).sort((left, right) => left.lensId.localeCompare(right.lensId)));
  const axisCounts = Object.freeze(Object.fromEntries(
    MECHANISM_PROTOTYPE_EXPLORATION_AXES.map((axis) => [
      axis, lenses.filter((item) => item.axis === axis).length,
    ]),
  ) as Record<MechanismPrototypeExplorationAxis, number>);
  const sourceRunIds = exactHashes([
    ...retainedTrailheads.map((item) => item.sourceAgentRunId),
    ...retainedExhaustions.map((item) => item.sourceAgentRunId),
  ]);
  const sourceRuns = new Set(sourceRunIds);
  const invocations = (input.execution?.modelInvocations ?? []).filter((item) =>
    sourceRuns.has(item.runId)
  );
  const tokenSum = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, item) => total + BigInt(item[key] ?? "0"), 0n).toString();
  const usage = Object.freeze({
    sourceRunCount: sourceRunIds.length,
    modelInvocationCount: invocations.length,
    knownInputTokens: tokenSum("inputTokens"),
    knownOutputTokens: tokenSum("outputTokens"),
    knownReasoningTokens: tokenSum("reasoningTokens"),
    unknownUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
    ).length,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-projection.v1" as const,
    prototypeCount: prototypes.length,
    lensCount: lenses.length,
    eligibleLensCount: lenses.filter((item) => item.campaignEligible).length,
    attemptedLensCount: lenses.filter((item) =>
      item.retainedTrailheadIds.length > 0 || item.retainedExhaustionIds.length > 0
    ).length,
    successfulLensCount: lenses.filter((item) => item.retainedTrailheadIds.length > 0).length,
    exhaustedLensCount: lenses.filter((item) => item.retainedExhaustionIds.length > 0).length,
    currentSemanticAttemptedLensCount: lenses.filter((item) =>
      item.state !== "UNEXPLORED"
    ).length,
    currentSemanticSuccessfulLensCount: lenses.filter((item) =>
      item.state === "TRAILHEAD_RECORDED" || item.state === "MIXED_RESULTS"
    ).length,
    currentSemanticExhaustedLensCount: lenses.filter((item) =>
      item.state === "EXHAUSTED" || item.state === "MIXED_RESULTS"
    ).length,
    seededLensCount: lenses.filter((item) =>
      item.currentInputRevision.seedTrailheads.length > 0
    ).length,
    zeroSeedLensCount: lenses.filter((item) =>
      item.currentInputRevision.seedTrailheads.length === 0
    ).length,
    seedCount: lenses.reduce((sum, item) =>
      sum + item.currentInputRevision.seedTrailheads.length, 0
    ),
    axisCounts,
    usage,
    corpusSnapshotIdentity: corpus.snapshotIdentity,
    corpusSemanticIdentity,
    lenses,
    effects: Object.freeze({
      providerRequests: 0 as const,
      modelInvocations: 0 as const,
      runs: 0 as const,
      campaigns: 0 as const,
      dispatches: 0 as const,
      externalWrites: 0 as const,
      valueMovingActions: 0 as const,
    }),
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}

export function assertMechanismPrototypeExplorationInputRevision(
  value: unknown,
): MechanismPrototypeExplorationInputRevision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration input is malformed");
  }
  const revision = value as MechanismPrototypeExplorationInputRevision;
  const { inputRevisionId, ...body } = revision;
  if (
    revision.schemaVersion !== "pmh.mechanism-prototype-exploration-input.v1" ||
    !HASH_PATTERN.test(String(inputRevisionId)) || inputRevisionId !== hashCanonical(body) ||
    ![revision.lensId, revision.prototypeId, revision.sourcePrototypeInputRevisionId,
      revision.semanticInputIdentity, revision.corpusSnapshotIdentity,
      revision.corpusSemanticIdentity, revision.sourceSetIdentity,
      revision.ontologyIdentity].every((item) => HASH_PATTERN.test(String(item))) ||
    (revision.coverageScopeIdentity !== undefined &&
      !HASH_PATTERN.test(String(revision.coverageScopeIdentity))) ||
    (revision.coverageMembers !== undefined && (
      !Array.isArray(revision.coverageMembers) || revision.coverageMembers.some((member) =>
        !bounded(member.listingRef, 1_000) ||
        !HASH_PATTERN.test(String(member.semanticListingIdentity)) ||
        member.inclusionReasons.length < 1 || member.inclusionReasons.some((reason: string) =>
          !["DETERMINISTIC_SEED_MEMBER", "PROTOTYPE_SIGNAL_MATCH",
            "COMPONENT_AGGREGATE_ROLE_CUE", "INSTITUTION_FRONTIER_CUE"].includes(reason)
        )
      )
    )) ||
    !MECHANISM_PROTOTYPE_EXPLORATION_AXES.includes(revision.axis) ||
    exactHashes(revision.knownMemberRouteFamilyIds).join("\n") !==
      revision.knownMemberRouteFamilyIds.join("\n") ||
    exactStrings(revision.excludedListingRefs).join("\n") !==
      revision.excludedListingRefs.join("\n") ||
    !Array.isArray(revision.seedTrailheads) ||
    revision.seedTrailheads.length > MAX_SEEDS_PER_LENS ||
    revision.seedTrailheads.some((seedInput) => {
      const seed = assertExplorationSeed(seedInput);
      return seed.axis !== revision.axis ||
      seed.listingRefs.some((ref: string) => revision.excludedListingRefs.includes(ref))
    }) ||
    revision.inputBinding !==
      "EXACT_CURRENT_CORPUS_OBSERVATION_WITH_PRICE_INDEPENDENT_SEMANTIC_IDENTITY" ||
    revision.authority !== "PROTOTYPE_GUIDED_SEARCH_INPUT_ONLY" ||
    revision.semanticDecisionAuthority !== false || revision.probabilityAuthority !== false ||
    revision.certificateAuthority !== false || revision.executionAuthority !== false ||
    revision.externalWriteAuthority !== false || revision.valueMovingAuthority !== false
  ) throw new Error("mechanism exploration input violates its bounded contract");
  return Object.freeze(revision);
}

function bounded(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" &&
    value === value.trim().replace(/\s+/gu, " ") && value.length <= maximum;
}

function boundedTexts(
  values: readonly string[],
  minimum: number,
  maximum: number,
): readonly string[] {
  const result = exactStrings(values.map(canonicalText));
  if (result.length < minimum || result.length > maximum ||
      result.some((item) => !bounded(item, 500))) {
    throw new Error("mechanism exploration text set is invalid");
  }
  return result;
}

function exactTime(value: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error("mechanism exploration timestamp is invalid");
  }
  return value;
}

function semanticEvidenceBinding(
  corpus: MarketCorpusSnapshot,
  listingRef: string,
): MechanismPrototypeExplorationEvidenceBinding {
  const listing = corpus.listings.find((item) => item.listingRef === listingRef);
  if (listing === undefined) throw new Error("mechanism exploration listing is unknown");
  const semanticListingIdentity = buildSearchScopeIdentity([listing])
    .semanticScopeIdentity;
  return Object.freeze({
    listingRef,
    title: listing.title,
    venueId: listing.venueId,
    sourceRawHash: listing.sourceRawHash,
    protocolIdentity: listing.protocolIdentity,
    semanticListingIdentity,
  });
}

function validEvidenceBindings(value: unknown, minimum: number):
  value is readonly MechanismPrototypeExplorationEvidenceBinding[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= 8 &&
    new Set(value.map((item: MechanismPrototypeExplorationEvidenceBinding) =>
      item.listingRef
    )).size === value.length && value.every((item: MechanismPrototypeExplorationEvidenceBinding) =>
      bounded(item.listingRef, 500) && bounded(item.title, 500) &&
      bounded(item.venueId, 160) && HASH_PATTERN.test(item.sourceRawHash) &&
      bounded(item.protocolIdentity, 500) && HASH_PATTERN.test(item.semanticListingIdentity)
    );
}

function evidenceBindings(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  corpus: MarketCorpusSnapshot;
  listingRefs: readonly string[];
  inspectedListingRefs: ReadonlySet<string>;
  minimum: number;
}>): readonly MechanismPrototypeExplorationEvidenceBinding[] {
  const refs = exactStrings(input.listingRefs);
  if (refs.length < input.minimum || refs.length > 8 ||
      refs.some((ref) => input.researchInput.excludedListingRefs.includes(ref)) ||
      refs.some((ref) => !input.inspectedListingRefs.has(ref))) {
    throw new Error("mechanism exploration result must use inspected non-source listings");
  }
  return Object.freeze(refs.map((ref) => semanticEvidenceBinding(input.corpus, ref)));
}

export function buildMechanismPrototypeExplorationTrailhead(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  prototype: WorldStateMechanismPrototypeProposal;
  corpus: MarketCorpusSnapshot;
  sourceAgentRunId: Hash;
  inspectedListingRefs: ReadonlySet<string>;
  searchedResultIds: readonly Hash[];
  listingRefs: readonly string[];
  structuralAnalogy: string;
  surfaceDifferences: readonly string[];
  appliedTransferTests: readonly string[];
  activatedCounterScenarios: readonly string[];
  searchSignals: readonly string[];
  noveltyAxisExplanation: string;
  rationale: string;
  proposedAt: string;
}>): MechanismPrototypeExplorationTrailhead {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const prototype = assertWorldStateMechanismPrototypeProposal(input.prototype);
  if (prototype.prototypeId !== researchInput.prototypeId ||
      !HASH_PATTERN.test(input.sourceAgentRunId) ||
      !bounded(input.structuralAnalogy, 2_000) ||
      !bounded(input.noveltyAxisExplanation, 2_000) || !bounded(input.rationale, 2_000)) {
    throw new Error("mechanism exploration trailhead lineage or prose is invalid");
  }
  const bindings = evidenceBindings({
    researchInput, corpus: input.corpus, listingRefs: input.listingRefs,
    inspectedListingRefs: input.inspectedListingRefs, minimum: 2,
  });
  const appliedTransferTests = boundedTexts(input.appliedTransferTests, 1, 12);
  if (appliedTransferTests.some((test) => !prototype.transferTests.includes(test))) {
    throw new Error("mechanism exploration trailhead uses an unknown transfer test");
  }
  const activatedCounterScenarios = input.activatedCounterScenarios.length === 0
    ? Object.freeze([])
    : boundedTexts(input.activatedCounterScenarios, 1, 12);
  if (activatedCounterScenarios.some((item) => !prototype.counterScenarios.includes(item))) {
    throw new Error("mechanism exploration trailhead uses an unknown counter-scenario");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-trailhead.v1" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: prototype.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: input.sourceAgentRunId,
    evidenceBindings: bindings,
    structuralAnalogy: input.structuralAnalogy,
    surfaceDifferences: boundedTexts(input.surfaceDifferences, 1, 12),
    appliedTransferTests,
    activatedCounterScenarios,
    searchSignals: boundedTexts(input.searchSignals, 1, 12),
    noveltyAxisExplanation: input.noveltyAxisExplanation,
    rationale: input.rationale,
    searchedResultIds: exactHashes(input.searchedResultIds),
    proposedAt: exactTime(input.proposedAt),
    authority: "PROTOTYPE_GUIDED_TRAILHEAD_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertMechanismPrototypeExplorationTrailhead(Object.freeze({
    ...body, trailheadId: hashCanonical(body),
  }));
}

export function buildMechanismPrototypeExplorationExhaustion(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  prototype: WorldStateMechanismPrototypeProposal;
  corpus: MarketCorpusSnapshot;
  sourceAgentRunId: Hash;
  inspectedListingRefs: ReadonlySet<string>;
  searchedResultIds: readonly Hash[];
  inspectedListingRefsForResult: readonly string[];
  searchedNeighborhoods: readonly string[];
  failedTransferTests: readonly string[];
  activatedCounterScenarios: readonly string[];
  reason: string;
  proposedAt: string;
}>): MechanismPrototypeExplorationExhaustion {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const prototype = assertWorldStateMechanismPrototypeProposal(input.prototype);
  if (prototype.prototypeId !== researchInput.prototypeId ||
      !HASH_PATTERN.test(input.sourceAgentRunId) || !bounded(input.reason, 2_000)) {
    throw new Error("mechanism exploration exhaustion lineage or reason is invalid");
  }
  const failedTransferTests = boundedTexts(input.failedTransferTests, 1, 12);
  if (failedTransferTests.some((test) => !prototype.transferTests.includes(test))) {
    throw new Error("mechanism exploration exhaustion uses an unknown transfer test");
  }
  const activatedCounterScenarios = input.activatedCounterScenarios.length === 0
    ? Object.freeze([])
    : boundedTexts(input.activatedCounterScenarios, 1, 12);
  if (activatedCounterScenarios.some((item) => !prototype.counterScenarios.includes(item))) {
    throw new Error("mechanism exploration exhaustion uses an unknown counter-scenario");
  }
  const searchedResultIds = exactHashes(input.searchedResultIds);
  if (searchedResultIds.length === 0) {
    throw new Error("mechanism exploration exhaustion requires at least one exact search");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-exhaustion.v1" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: prototype.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: input.sourceAgentRunId,
    inspectedEvidenceBindings: evidenceBindings({
      researchInput, corpus: input.corpus,
      listingRefs: input.inspectedListingRefsForResult,
      inspectedListingRefs: input.inspectedListingRefs, minimum: 1,
    }),
    searchedResultIds,
    searchedNeighborhoods: boundedTexts(input.searchedNeighborhoods, 1, 12),
    failedTransferTests,
    activatedCounterScenarios,
    reason: input.reason,
    proposedAt: exactTime(input.proposedAt),
    authority: "BOUNDED_PROTOTYPE_EXPLORATION_NEGATIVE_MEMORY_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertMechanismPrototypeExplorationExhaustion(Object.freeze({
    ...body, exhaustionId: hashCanonical(body),
  }));
}

export function assertMechanismPrototypeExplorationTrailhead(
  value: unknown,
): MechanismPrototypeExplorationTrailhead {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration trailhead is malformed");
  }
  const item = value as MechanismPrototypeExplorationTrailhead;
  const { trailheadId, ...body } = item;
  if (
    item.schemaVersion !== "pmh.mechanism-prototype-exploration-trailhead.v1" ||
    !HASH_PATTERN.test(String(trailheadId)) || trailheadId !== hashCanonical(body) ||
    ![item.lensId, item.inputRevisionId, item.semanticInputIdentity, item.prototypeId,
      item.sourceAgentRunId].every((field) => HASH_PATTERN.test(String(field))) ||
    !MECHANISM_PROTOTYPE_EXPLORATION_AXES.includes(item.axis) ||
    !validEvidenceBindings(item.evidenceBindings, 2) ||
    !bounded(item.structuralAnalogy, 2_000) ||
    boundedTexts(item.surfaceDifferences, 1, 12).join("\n") !==
      item.surfaceDifferences.join("\n") ||
    boundedTexts(item.appliedTransferTests, 1, 12).join("\n") !==
      item.appliedTransferTests.join("\n") ||
    (item.activatedCounterScenarios.length > 0 &&
      boundedTexts(item.activatedCounterScenarios, 1, 12).join("\n") !==
        item.activatedCounterScenarios.join("\n")) ||
    boundedTexts(item.searchSignals, 1, 12).join("\n") !== item.searchSignals.join("\n") ||
    !bounded(item.noveltyAxisExplanation, 2_000) || !bounded(item.rationale, 2_000) ||
    exactHashes(item.searchedResultIds).join("\n") !== item.searchedResultIds.join("\n") ||
    exactTime(item.proposedAt) !== item.proposedAt ||
    item.authority !== "PROTOTYPE_GUIDED_TRAILHEAD_ROUTING_ONLY" ||
    item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
    item.certificateAuthority !== false || item.executionAuthority !== false ||
    item.externalWriteAuthority !== false || item.valueMovingAuthority !== false
  ) throw new Error("mechanism exploration trailhead violates its bounded contract");
  return Object.freeze(item);
}

export function assertMechanismPrototypeExplorationExhaustion(
  value: unknown,
): MechanismPrototypeExplorationExhaustion {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration exhaustion is malformed");
  }
  const item = value as MechanismPrototypeExplorationExhaustion;
  const { exhaustionId, ...body } = item;
  if (
    item.schemaVersion !== "pmh.mechanism-prototype-exploration-exhaustion.v1" ||
    !HASH_PATTERN.test(String(exhaustionId)) || exhaustionId !== hashCanonical(body) ||
    ![item.lensId, item.inputRevisionId, item.semanticInputIdentity, item.prototypeId,
      item.sourceAgentRunId].every((field) => HASH_PATTERN.test(String(field))) ||
    !MECHANISM_PROTOTYPE_EXPLORATION_AXES.includes(item.axis) ||
    !validEvidenceBindings(item.inspectedEvidenceBindings, 1) ||
    exactHashes(item.searchedResultIds).join("\n") !== item.searchedResultIds.join("\n") ||
    item.searchedResultIds.length < 1 ||
    boundedTexts(item.searchedNeighborhoods, 1, 12).join("\n") !==
      item.searchedNeighborhoods.join("\n") ||
    boundedTexts(item.failedTransferTests, 1, 12).join("\n") !==
      item.failedTransferTests.join("\n") ||
    (item.activatedCounterScenarios.length > 0 &&
      boundedTexts(item.activatedCounterScenarios, 1, 12).join("\n") !==
        item.activatedCounterScenarios.join("\n")) ||
    !bounded(item.reason, 2_000) || exactTime(item.proposedAt) !== item.proposedAt ||
    item.authority !== "BOUNDED_PROTOTYPE_EXPLORATION_NEGATIVE_MEMORY_ONLY" ||
    item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
    item.certificateAuthority !== false || item.executionAuthority !== false ||
    item.externalWriteAuthority !== false || item.valueMovingAuthority !== false
  ) throw new Error("mechanism exploration exhaustion violates its bounded contract");
  return Object.freeze(item);
}

export function searchMechanismPrototypeExplorationCorpus(input: Readonly<{
  corpus: MarketCorpusSnapshot;
  query: MarketCorpusSearchQuery;
}>): MarketCorpusSearchResult {
  return searchMarketCorpus(input.corpus, input.query);
}

export function mechanismPrototypeExplorationUsage(input: Readonly<{
  lensId: Hash;
  trailheads: readonly MechanismPrototypeExplorationTrailhead[];
  exhaustions: readonly MechanismPrototypeExplorationExhaustion[];
  execution: AgentExecutionSnapshot;
}>): MechanismPrototypeExplorationUsage {
  const sourceRunIds = exactHashes([
    ...input.trailheads.filter((item) => item.lensId === input.lensId)
      .map((item) => item.sourceAgentRunId),
    ...input.exhaustions.filter((item) => item.lensId === input.lensId)
      .map((item) => item.sourceAgentRunId),
  ]);
  const runIds = new Set(sourceRunIds);
  const invocations = input.execution.modelInvocations.filter((item) =>
    runIds.has(item.runId)
  );
  const sum = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, item) => total + BigInt(item[key] ?? "0"), 0n).toString();
  return Object.freeze({
    sourceRunIds,
    modelInvocationCount: invocations.length,
    knownInputTokens: sum("inputTokens"),
    knownOutputTokens: sum("outputTokens"),
    knownReasoningTokens: sum("reasoningTokens"),
    unknownUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
    ).length,
  });
}
