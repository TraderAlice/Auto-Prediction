import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertMarketCorpusSnapshot,
  assertMarketCorpusSearchResult,
  searchMarketCorpus,
  type MarketCorpusSearchHit,
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
  type AgentToolEffect,
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
import {
  assertWorldRelationEconomicAttention,
  type WorldRelationEconomicAttentionProjection,
} from "./world-relation-economic-attention.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SEEDS_PER_LENS = 8;
const ESTABLISHED_AT = "2026-08-13T00:00:00.000Z";

export const MECHANISM_PROTOTYPE_EXPLORATION_TASK_PROTOCOL =
  "MECHANISM_PROTOTYPE_EXPLORATION_TASK_V1" as const;
export const MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL =
  "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V15" as const;

export const MECHANISM_PROTOTYPE_EXPLORATION_AXES = Object.freeze([
  "AGGREGATE_INSTITUTION",
  "SUBJECT_AND_GEOGRAPHY",
  "SURFACE_DOMAIN",
  "COUNTEREXAMPLE_FRONTIER",
] as const);

export type MechanismPrototypeExplorationAxis =
  (typeof MECHANISM_PROTOTYPE_EXPLORATION_AXES)[number];

export type MechanismPrototypeExplorationNoveltyDimension =
  | "REPRESENTATION_SURFACE"
  | "SUBJECT_OR_GEOGRAPHY_PARAMETER"
  | "WORLD_DOMAIN"
  | "AGGREGATE_INSTITUTION"
  | "COUNTEREXAMPLE_PRESSURE";

export type MechanismPrototypeExplorationAxisContract = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-axis-contract.v1";
  contractId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  admissionRule:
    | "CANDIDATE_PREDICATE_FAMILY_OUTSIDE_SOURCE"
    | "GROUNDED_NON_SOURCE_PARAMETER_SIGNAL"
    | "CANDIDATE_INSTITUTION_OUTSIDE_SOURCE"
    | "COUNTER_SCENARIO_ACTIVATED";
  sourcePredicateFamilies: readonly MarketOntologyPredicateFamily[];
  sourceInstitutionFamilies: readonly string[];
  sourceParameterValues: readonly string[];
  representationChangeAloneInsufficient: true;
  unclassifiedWorldDomainInsufficient: true;
  authority: "EXPLORATION_AXIS_ADMISSIBILITY_ONLY";
  semanticDecisionAuthority: false;
}>;

export type MechanismPrototypeExplorationAxisAssessment = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-axis-assessment.v1";
  assessmentId: Hash;
  contractId: Hash;
  requestedAxis: MechanismPrototypeExplorationAxis;
  candidatePredicateFamilies: readonly MarketOntologyPredicateFamily[];
  candidateInstitutionFamilies: readonly string[];
  componentRoleListingRefs: readonly string[];
  aggregateRoleListingRefs: readonly string[];
  sharedComponentAggregateInstitutions: readonly string[];
  groundedAxisEvidenceSignals: readonly string[];
  observedNoveltyDimensions: readonly MechanismPrototypeExplorationNoveltyDimension[];
  admissible: true;
  diagnostic: string;
  authority: "EXPLORATION_AXIS_ADMISSION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
}>;

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
  schemaVersion: "pmh.mechanism-prototype-exploration-input.v1" |
    "pmh.mechanism-prototype-exploration-input.v2";
  inputRevisionId: Hash;
  lensId: Hash;
  prototypeId: Hash;
  sourcePrototypeInputRevisionId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  semanticInputIdentity: Hash;
  axisContract?: MechanismPrototypeExplorationAxisContract;
  coverageScopeIdentity?: Hash;
  coverageMembers?: readonly MechanismPrototypeExplorationCoverageMember[];
  corpusSnapshotIdentity: Hash;
  corpusSemanticIdentity: Hash;
  sourceSetIdentity: Hash;
  ontologyIdentity: Hash;
  knownMemberRouteFamilyIds: readonly Hash[];
  excludedListingRefs: readonly string[];
  seedTrailheads: readonly MechanismPrototypeExplorationSeed[];
  economicAttention?: WorldRelationEconomicAttentionProjection;
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
  retainedAssessedTrailheadCount: number;
  retainedPreGateTrailheadCount: number;
  latestRetainedAxisAssessment: MechanismPrototypeExplorationAxisAssessment | null;
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

export type MechanismPrototypeExplorationRoleSearchPair = Readonly<{
  componentListingRef: string;
  aggregateListingRef: string;
  groundedBridgeSignals: readonly string[];
  authority: "ROLE_QUALIFIED_PAIR_RETRIEVAL_ONLY";
  semanticDecisionAuthority: false;
}>;

export type MechanismPrototypeExplorationRoleSearchResult = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-role-search.v1";
  resultIdentity: Hash;
  snapshotIdentity: Hash;
  componentSearchResultIdentity: Hash;
  aggregateSearchResultIdentity: Hash;
  componentQuery: MarketCorpusSearchResult["query"];
  aggregateQuery: MarketCorpusSearchResult["query"];
  requestedBridgeSignals: readonly string[];
  rawComponentHitCount: number;
  rawAggregateHitCount: number;
  componentHits: readonly MarketCorpusSearchHit[];
  aggregateHits: readonly MarketCorpusSearchHit[];
  unclassifiedComponentListingRefs: readonly string[];
  unclassifiedAggregateListingRefs: readonly string[];
  pairCount: number;
  pairFrontierTruncated: boolean;
  pairs: readonly MechanismPrototypeExplorationRoleSearchPair[];
  authority: "ROLE_AWARE_SEARCH_EVIDENCE_ONLY";
  roleCueSemanticAuthority: false;
  bridgeSignalSubjectIdentityAuthority: false;
  semanticDecisionAuthority: false;
  executionAuthority: false;
}>;

export type MechanismPrototypeExplorationRoleSearchObservation = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-role-search-observation.v1";
  observationId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  capturedAt: string;
  result: MechanismPrototypeExplorationRoleSearchResult;
  authority: "DURABLE_ROLE_SEARCH_EVIDENCE_ONLY";
  roleCueSemanticAuthority: false;
  bridgeSignalSubjectIdentityAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationFlatSearchObservation = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-flat-search-observation.v1";
  observationId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  capturedAt: string;
  result: MarketCorpusSearchResult;
  authority: "DURABLE_FLAT_SEARCH_RETRIEVAL_EVIDENCE_ONLY";
  lexicalHitSemanticAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationActionObservation = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-action-observation.v1" |
    "pmh.mechanism-prototype-exploration-action-observation.v2";
  observationId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  capturedAt: string;
  action: "TRANSFER_TEST_APPLIED" | "TRANSFER_TEST_FAILED" |
    "COUNTER_SCENARIO_ACTIVATED" | "COUNTER_SCENARIO_FAILED";
  ordinal: number;
  exactText: string;
  authority: "DURABLE_PROTOTYPE_EXPLORATION_ACTION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export const MECHANISM_PROTOTYPE_EXPLORATION_HYPOTHESIS_DISPOSITIONS = Object.freeze([
  "SUPPORTED", "WEAKENED", "FALSIFIED", "UNRESOLVED",
] as const);

export type MechanismPrototypeExplorationHypothesis = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis.v1" |
    "pmh.mechanism-prototype-exploration-hypothesis.v2" |
    "pmh.mechanism-prototype-exploration-hypothesis.v3";
  hypothesisId: Hash;
  revision: number;
  status: "ACTIVE" | "CLOSED";
  testBinding: Readonly<{
    kind: "TRANSFER_TEST" | "COUNTER_SCENARIO";
    ordinal: number;
    handle: string;
    exactText: string;
  }>;
  materialVariation: string;
  predictedRoleStructure: string;
  supportingObservation: string;
  falsifyingObservation: string;
  searchNeighborhoods: readonly string[];
  revisionReason: string | null;
  disposition: (typeof MECHANISM_PROTOTYPE_EXPLORATION_HYPOTHESIS_DISPOSITIONS)[number] | null;
  observedSupport: readonly string[];
  observedFalsifiers: readonly string[];
  rationale: string | null;
  familyIntent?: "EXTEND" | "REPLICATE" | "DIFFERENT_TEST";
  priorFamilyId?: Hash | null;
  intentRationale?: string;
  reconnaissanceBinding?: Readonly<{
    roleSearchResultId: Hash;
    componentListingRef: string;
    aggregateListingRef: string;
  }>;
  authority: "AGENT_RESEARCH_HYPOTHESIS_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export function assertMechanismPrototypeExplorationHypothesis(
  value: unknown,
): MechanismPrototypeExplorationHypothesis {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration hypothesis is malformed");
  }
  const item = value as Readonly<Record<string, unknown>>;
  const binding = item.testBinding as Readonly<Record<string, unknown>> | undefined;
  const reconnaissance = item.reconnaissanceBinding as
    Readonly<Record<string, unknown>> | undefined;
  const strings = [item.materialVariation, item.predictedRoleStructure,
    item.supportingObservation, item.falsifyingObservation];
  const arrays = [item.searchNeighborhoods, item.observedSupport, item.observedFalsifiers];
  const isV11Hypothesis = item.familyIntent !== undefined || item.priorFamilyId !== undefined ||
    item.intentRationale !== undefined;
  if (!["pmh.mechanism-prototype-exploration-hypothesis.v1",
        "pmh.mechanism-prototype-exploration-hypothesis.v2",
        "pmh.mechanism-prototype-exploration-hypothesis.v3"]
      .includes(String(item.schemaVersion)) ||
      !HASH_PATTERN.test(String(item.hypothesisId)) ||
      !Number.isSafeInteger(item.revision) || Number(item.revision) < 1 ||
      !["ACTIVE", "CLOSED"].includes(String(item.status)) || binding === undefined ||
      !["TRANSFER_TEST", "COUNTER_SCENARIO"].includes(String(binding.kind)) ||
      !Number.isSafeInteger(binding.ordinal) || Number(binding.ordinal) < 1 ||
      typeof binding.handle !== "string" || binding.handle.length < 1 ||
      typeof binding.exactText !== "string" || binding.exactText.length < 1 ||
      strings.some((text) => typeof text !== "string" || text.length < 1 || text.length > 2_000) ||
      arrays.some((values) => !Array.isArray(values) || values.length > 12 ||
        values.some((text) => typeof text !== "string" || text.length < 1 || text.length > 500)) ||
      (item.revisionReason !== null && (typeof item.revisionReason !== "string" ||
        item.revisionReason.length < 1 || item.revisionReason.length > 2_000)) ||
      (item.status === "ACTIVE" ? item.disposition !== null || item.rationale !== null
        : !MECHANISM_PROTOTYPE_EXPLORATION_HYPOTHESIS_DISPOSITIONS
          .includes(item.disposition as never) || typeof item.rationale !== "string" ||
          item.rationale.length < 1 || item.rationale.length > 2_000) ||
      item.authority !== "AGENT_RESEARCH_HYPOTHESIS_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("mechanism exploration hypothesis is invalid");
  }
  if (isV11Hypothesis &&
      (!(["EXTEND", "REPLICATE", "DIFFERENT_TEST"] as const)
        .includes(item.familyIntent as never) ||
       (item.priorFamilyId !== null && !HASH_PATTERN.test(String(item.priorFamilyId))) ||
       typeof item.intentRationale !== "string" || item.intentRationale.length < 1 ||
       item.intentRationale.length > 2_000 ||
       (item.familyIntent === "DIFFERENT_TEST") !== (item.priorFamilyId === null))) {
    throw new Error("mechanism exploration hypothesis family intent is invalid");
  }
  if (item.schemaVersion === "pmh.mechanism-prototype-exploration-hypothesis.v2" &&
      !isV11Hypothesis) {
    throw new Error("mechanism exploration V2 hypothesis requires family intent");
  }
  if (item.schemaVersion === "pmh.mechanism-prototype-exploration-hypothesis.v3" &&
      (!isV11Hypothesis || reconnaissance === undefined ||
       Object.keys(reconnaissance).sort().join("|") !==
         "aggregateListingRef|componentListingRef|roleSearchResultId" ||
       !HASH_PATTERN.test(String(reconnaissance.roleSearchResultId)) ||
       typeof reconnaissance.componentListingRef !== "string" ||
       reconnaissance.componentListingRef.length < 1 ||
       reconnaissance.componentListingRef.length > 500 ||
       typeof reconnaissance.aggregateListingRef !== "string" ||
       reconnaissance.aggregateListingRef.length < 1 ||
       reconnaissance.aggregateListingRef.length > 500 ||
       reconnaissance.componentListingRef === reconnaissance.aggregateListingRef)) {
    throw new Error("mechanism exploration V3 hypothesis requires exact reconnaissance");
  }
  if (item.schemaVersion !== "pmh.mechanism-prototype-exploration-hypothesis.v3" &&
      reconnaissance !== undefined) {
    throw new Error("legacy mechanism exploration hypothesis cannot claim reconnaissance");
  }
  return value as MechanismPrototypeExplorationHypothesis;
}

export type MechanismPrototypeExplorationStepObservation = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-step-observation.v1" |
    "pmh.mechanism-prototype-exploration-step-observation.v2" |
    "pmh.mechanism-prototype-exploration-step-observation.v3";
  observationId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  sourceInvocationId: Hash;
  sourceEffectId: Hash;
  sourceToolCallId: string;
  effectOrdinal: number;
  toolName: string;
  status: "ACCEPTED" | "REJECTED";
  resultSummary: Readonly<{
    kind: "LENS_READ" | "DIALECT_ATLAS_READ" | "REPRESENTATION_ROLE_FEEDBACK_READ" |
      "DIRECTORY_BROWSE" | "FLAT_SEARCH" | "ROLE_SEARCH" | "INSPECTION" |
      "PROTOTYPE_ACTION" | "POSITIVE_TERMINAL" | "EXHAUSTION_TERMINAL" |
      "HYPOTHESIS_ACTION" | "OTHER";
    rawHitCount: number;
    qualifiedHitCount: number;
    pairCount: number;
    inspectedListingCount: number;
    acceptedActionCount: number;
    acceptedTerminalCount: number;
  }>;
  readinessAfter: Readonly<{
    positiveEligible: boolean;
    positiveMissingPrerequisites: readonly string[];
    exhaustionEligible: boolean;
    exhaustionMissingPrerequisites: readonly string[];
    searchedResultCount: number;
    roleSearchResultCount: number;
    rolePairCount: number;
    inspectedListingCount: number;
    inspectedRolePairCount: number;
    appliedTransferTestOrdinals: readonly number[];
    failedTransferTestOrdinals: readonly number[];
    activatedCounterScenarioOrdinals: readonly number[];
    failedCounterScenarioOrdinals?: readonly number[];
    activeHypothesis?: boolean;
    activeHypothesisTestBinding?: Readonly<{
      kind: "TRANSFER_TEST" | "COUNTER_SCENARIO";
      handle: string;
    }> | null;
    closedHypothesisCount?: number;
  }>;
  hypothesisEvent?: "OPENED" | "REVISED" | "CLOSED";
  hypothesisAfter?: MechanismPrototypeExplorationHypothesis;
  observedAt: string;
  authority: "DURABLE_EXPLORATION_EXPERIMENT_STEP_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationExperimentEpisode = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-experiment-episode.v1" |
    "pmh.mechanism-prototype-exploration-experiment-episode.v2";
  episodeId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  taskId: Hash;
  runStatus: Exclude<import("./agent-execution-substrate.js").AgentRun["status"], "PREPARED">;
  completedAt: string;
  ledgerCompleteness: "COMPLETE_EFFECT_LEDGER" | "PARTIAL_EFFECT_LEDGER";
  terminalOutcome: "TRAILHEAD" | "EXHAUSTION" | "NO_ACCEPTED_TERMINAL";
  firstPositiveEligibleEffectOrdinal: number | null;
  firstExhaustionEligibleEffectOrdinal: number | null;
  steps: readonly Readonly<{
    effectOrdinal: number;
    sourceEffectId: Hash;
    sourceInvocationId: Hash;
    invocationOrdinal: number;
    invocationPurpose: import("./agent-execution-substrate.js").ModelInvocationPurpose |
      "HISTORICAL_UNCLASSIFIED";
    invocationStatus: import("./agent-execution-substrate.js").ModelInvocation["status"];
    inputTokens: string | null;
    outputTokens: string | null;
    reasoningTokens: string | null;
    toolName: string;
    effectStatus: "ACCEPTED" | "REJECTED";
    resultSummary: MechanismPrototypeExplorationStepObservation["resultSummary"];
    readinessBefore: MechanismPrototypeExplorationStepObservation["readinessAfter"] | null;
    readinessAfter: MechanismPrototypeExplorationStepObservation["readinessAfter"];
    positiveBecameEligible: boolean;
    exhaustionBecameEligible: boolean;
    hypothesisEvent?: "OPENED" | "REVISED" | "CLOSED";
    hypothesisAfter?: MechanismPrototypeExplorationHypothesis;
  }>[];
  hypotheses?: readonly Readonly<{
    hypothesisId: Hash;
    revisions: readonly MechanismPrototypeExplorationHypothesis[];
    final: MechanismPrototypeExplorationHypothesis;
    openedEffectOrdinal: number;
    closedEffectOrdinal: number | null;
  }>[];
  yield: Readonly<{
    effectCount: number;
    acceptedEffectCount: number;
    rejectedEffectCount: number;
    searchEffectCount: number;
    rawHitCount: number;
    qualifiedHitCount: number;
    rolePairCount: number;
    inspectedListingCount: number;
    acceptedActionCount: number;
  }>;
  usage: Readonly<{
    invocationCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownUsageInvocationCount: number;
  }>;
  authority: "PROVIDER_FREE_EXPLORATION_EXPERIMENT_MEMORY_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationMemoryProjection = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-memory-projection.v5";
  projectionIdentity: Hash;
  retainedInputCount: number;
  retainedStepCount: number;
  episodeCount: number;
  completeEpisodeCount: number;
  interruptedOrFailedEpisodeCount: number;
  terminalOutcomeCounts: Readonly<{
    trailhead: number;
    exhaustion: number;
    noAcceptedTerminal: number;
  }>;
  usage: Readonly<{
    invocationCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownUsageInvocationCount: number;
  }>;
  episodes: readonly MechanismPrototypeExplorationExperimentEpisode[];
  hypothesisFamilyCount: number;
  hypothesisFamilies: readonly MechanismPrototypeExplorationHypothesisFamily[];
  hypothesisIntentRealizationCount: number;
  hypothesisIntentRealizations: readonly MechanismPrototypeExplorationHypothesisIntentRealization[];
  hypothesisIntentAttentionPortfolio: MechanismPrototypeExplorationHypothesisIntentAttentionPortfolio;
  currentCorpusAuthority: false;
  currentEligibilityAuthority: false;
  campaignAuthority: false;
  automaticDispatch: false;
  effects: Readonly<{
    providerRequests: 0;
    modelInvocations: 0;
    tasks: 0;
    campaigns: 0;
    dispatches: 0;
    writes: 0;
    externalWrites: 0;
    valueMovingActions: 0;
  }>;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationHypothesisIntentAttentionPortfolio = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-intent-attention-portfolio.v1";
  portfolioIdentity: Hash;
  evidenceThrough: string | null;
  observationCount: number;
  cohorts: readonly Readonly<{
    declaredIntent: "EXTEND" | "REPLICATE" | "DIFFERENT_TEST";
    posture: "COVERAGE_GAP" | "FRONTIER_EXPANSION" | "REPLICATION_CONTROL" |
      "STALLED_FRONTIER" | "COST_UNCERTAINTY";
    observationCount: number;
    comparableObservationCount: number;
    realizedObservationCount: number;
    stalledObservationCount: number;
    unmeasurableObservationCount: number;
    independentObservationCount: number;
    succeededTerminalCount: number;
    rejectedEffectCount: number;
    reportedNewListingRefCount: number;
    reportedNewPairRefCount: number;
    usage: Readonly<{
      invocationCount: number;
      knownInputTokens: string;
      knownOutputTokens: string;
      knownReasoningTokens: string;
      unknownUsageInvocationCount: number;
    }>;
    evidenceDebt: "NO_OBSERVATION" | "NO_COMPARABLE_OBSERVATION" |
      "NO_REALIZED_OBSERVATION" | "NONE";
    selectionReason: string;
    priorityOrdinal: number;
  }>[];
  firstObservationCandidateIntent: "EXTEND" | "REPLICATE" | "DIFFERENT_TEST";
  orderingPolicy: "OBSERVATION_DEBT_THEN_DISTINCT_PORTFOLIO_ROLE";
  scalarUtilityScoreUsed: false;
  proseSimilarityUsed: false;
  schedulingAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationHypothesisIntentRealization = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-intent-realization.v2";
  reportId: Hash;
  hypothesisId: Hash;
  episodeId: Hash;
  episodeCompletedAt: string;
  runStatus: MechanismPrototypeExplorationExperimentEpisode["runStatus"];
  terminalOutcome: MechanismPrototypeExplorationExperimentEpisode["terminalOutcome"];
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  declaredIntent: "EXTEND" | "REPLICATE" | "DIFFERENT_TEST";
  declaredPriorFamilyId: Hash | null;
  realizedClassification: "REALIZED_EXTENSION" | "REALIZED_REPLICATION" |
    "REALIZED_DIFFERENT_TEST" | "NO_EVIDENCE_FRONTIER_CHANGE" | "UNMEASURABLE";
  comparisonBasis: "DECLARED_PRIOR_FAMILY" | "SIBLING_EXACT_TEST_FAMILIES" | "NONE";
  referenceFamilyCount: number;
  current: Readonly<{
    semanticInputIdentity: Hash;
    sourceAgentRunId: Hash;
    roleSearchObservationCount: number;
    flatSearchObservationCount: number;
    listingRefCount: number;
    lexicalRetrievalListingRefCount: number;
    pairRefCount: number;
    listingSetHash: Hash;
    lexicalRetrievalListingSetHash: Hash;
    pairSetHash: Hash;
  }>;
  comparison: Readonly<{
    referenceHypothesisCount: number;
    referenceSemanticInputCount: number;
    referenceRunCount: number;
    referenceListingRefCount: number;
    referenceLexicalRetrievalListingRefCount: number;
    referencePairRefCount: number;
    overlappingListingRefCount: number;
    newListingRefCount: number;
    overlappingLexicalRetrievalListingRefCount: number;
    newLexicalRetrievalListingRefCount: number;
    overlappingPairRefCount: number;
    newPairRefCount: number;
    independentSemanticInput: boolean;
    independentRun: boolean;
  }>;
  yield: MechanismPrototypeExplorationHypothesisFamily["yield"];
  usage: MechanismPrototypeExplorationHypothesisFamily["usage"];
  lexicalRetrievalPosture:
    "FLAT_SEARCH_HITS_ARE_RETRIEVAL_COORDINATES_NOT_SEMANTIC_FRONTIER_EVIDENCE";
  identityBasis: "EXACT_EFFECT_WINDOW_AND_DURABLE_ROLE_AND_FLAT_SEARCH_COORDINATES";
  proseSimilarityUsed: false;
  schedulingAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export function classifyMechanismPrototypeExplorationHypothesisIntentRealization(
  input: Readonly<{
    declaredIntent: "EXTEND" | "REPLICATE" | "DIFFERENT_TEST";
    comparable: boolean;
    independentSemanticInput: boolean;
    independentRun: boolean;
    newListingRefCount: number;
    newPairRefCount: number;
  }>,
): MechanismPrototypeExplorationHypothesisIntentRealization["realizedClassification"] {
  if (![input.newListingRefCount, input.newPairRefCount].every((value) =>
    Number.isSafeInteger(value) && value >= 0
  )) throw new Error("hypothesis intent realization counts are invalid");
  if (!input.comparable) return "UNMEASURABLE";
  if (input.declaredIntent === "REPLICATE" && input.independentSemanticInput &&
      input.independentRun) return "REALIZED_REPLICATION";
  if (input.newListingRefCount + input.newPairRefCount === 0) {
    return "NO_EVIDENCE_FRONTIER_CHANGE";
  }
  if (input.declaredIntent === "EXTEND" && input.independentSemanticInput) {
    return "REALIZED_EXTENSION";
  }
  if (input.declaredIntent === "DIFFERENT_TEST") return "REALIZED_DIFFERENT_TEST";
  return "NO_EVIDENCE_FRONTIER_CHANGE";
}

export function buildMechanismPrototypeExplorationHypothesisIntentAttentionPortfolio(
  input: Readonly<{
    reports: readonly MechanismPrototypeExplorationHypothesisIntentRealization[];
    episodes: readonly MechanismPrototypeExplorationExperimentEpisode[];
  }>,
): MechanismPrototypeExplorationHypothesisIntentAttentionPortfolio {
  const intents = ["EXTEND", "REPLICATE", "DIFFERENT_TEST"] as const;
  const episodesById = new Map(input.episodes.map((episode) =>
    [episode.episodeId, episode] as const
  ));
  const sumTokens = (
    reports: readonly MechanismPrototypeExplorationHypothesisIntentRealization[],
    key: "knownInputTokens" | "knownOutputTokens" | "knownReasoningTokens",
  ) => reports.reduce((total, report) => total + BigInt(report.usage[key]), 0n).toString();
  const unsorted = intents.map((declaredIntent) => {
    const reports = input.reports.filter((report) => report.declaredIntent === declaredIntent);
    const comparable = reports.filter((report) => report.referenceFamilyCount > 0 &&
      report.current.roleSearchObservationCount + report.current.flatSearchObservationCount > 0);
    const realized = reports.filter((report) =>
      report.realizedClassification.startsWith("REALIZED_")
    );
    const stalled = reports.filter((report) =>
      report.realizedClassification === "NO_EVIDENCE_FRONTIER_CHANGE"
    );
    const unmeasurable = reports.filter((report) =>
      report.realizedClassification === "UNMEASURABLE"
    );
    const independent = reports.filter((report) =>
      report.comparison.independentSemanticInput && report.comparison.independentRun
    );
    const evidenceDebt = reports.length === 0 ? "NO_OBSERVATION" as const
      : comparable.length === 0 ? "NO_COMPARABLE_OBSERVATION" as const
        : realized.length === 0 ? "NO_REALIZED_OBSERVATION" as const : "NONE" as const;
    const posture = evidenceDebt === "NO_OBSERVATION" ? "COVERAGE_GAP" as const
      : evidenceDebt === "NO_COMPARABLE_OBSERVATION" ? "COST_UNCERTAINTY" as const
        : evidenceDebt === "NO_REALIZED_OBSERVATION" ? "STALLED_FRONTIER" as const
          : declaredIntent === "REPLICATE" ? "REPLICATION_CONTROL" as const
            : "FRONTIER_EXPANSION" as const;
    const selectionReason = evidenceDebt === "NO_OBSERVATION"
      ? "No exact retained observation exists for this intent."
      : evidenceDebt === "NO_COMPARABLE_OBSERVATION"
        ? "Retained observations lack an exact causal comparison baseline."
        : evidenceDebt === "NO_REALIZED_OBSERVATION"
          ? "Comparable observations have not yet realized their declared intent."
          : declaredIntent === "REPLICATE"
            ? "Retain as an independent control against one-off frontier discoveries."
            : "Retain as measured evidence-frontier expansion.";
    return Object.freeze({ declaredIntent, posture, observationCount: reports.length,
      comparableObservationCount: comparable.length, realizedObservationCount: realized.length,
      stalledObservationCount: stalled.length, unmeasurableObservationCount: unmeasurable.length,
      independentObservationCount: independent.length,
      succeededTerminalCount: reports.filter((report) => report.runStatus === "SUCCEEDED" &&
        report.terminalOutcome !== "NO_ACCEPTED_TERMINAL").length,
      rejectedEffectCount: reports.reduce((sum, report) => sum +
        (episodesById.get(report.episodeId)?.yield.rejectedEffectCount ?? 0), 0),
      reportedNewListingRefCount: comparable.reduce((sum, report) =>
        sum + report.comparison.newListingRefCount, 0),
      reportedNewPairRefCount: comparable.reduce((sum, report) =>
        sum + report.comparison.newPairRefCount, 0),
      usage: Object.freeze({ invocationCount: reports.reduce((sum, report) =>
        sum + report.usage.invocationCount, 0),
      knownInputTokens: sumTokens(reports, "knownInputTokens"),
      knownOutputTokens: sumTokens(reports, "knownOutputTokens"),
      knownReasoningTokens: sumTokens(reports, "knownReasoningTokens"),
      unknownUsageInvocationCount: reports.reduce((sum, report) =>
        sum + report.usage.unknownUsageInvocationCount, 0) }),
      evidenceDebt, selectionReason,
      debtRank: evidenceDebt === "NO_OBSERVATION" ? 0
        : evidenceDebt === "NO_COMPARABLE_OBSERVATION" ? 1
          : evidenceDebt === "NO_REALIZED_OBSERVATION" ? 2
            : declaredIntent === "DIFFERENT_TEST" ? 3
              : declaredIntent === "REPLICATE" ? 4 : 5,
    });
  });
  const cohorts = Object.freeze([...unsorted]
    .sort((left, right) => left.debtRank - right.debtRank ||
      left.declaredIntent.localeCompare(right.declaredIntent))
    .map(({ debtRank: _debtRank, ...cohort }, index) =>
      Object.freeze({ ...cohort, priorityOrdinal: index + 1 })
    ));
  const body = Object.freeze({
    schemaVersion:
      "pmh.mechanism-prototype-exploration-hypothesis-intent-attention-portfolio.v1" as const,
    evidenceThrough: input.reports.reduce<string | null>((latest, report) =>
      latest === null || report.episodeCompletedAt > latest ? report.episodeCompletedAt : latest,
    null),
    observationCount: input.reports.length,
    cohorts,
    firstObservationCandidateIntent: cohorts[0]!.declaredIntent,
    orderingPolicy: "OBSERVATION_DEBT_THEN_DISTINCT_PORTFOLIO_ROLE" as const,
    scalarUtilityScoreUsed: false as const, proseSimilarityUsed: false as const,
    schedulingAuthority: false as const, semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, portfolioIdentity: hashCanonical(body) });
}

export type MechanismPrototypeExplorationHypothesisFamily = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-family.v1";
  familyId: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  testBinding: MechanismPrototypeExplorationHypothesis["testBinding"];
  hypothesisCount: number;
  distinctRunCount: number;
  distinctSemanticInputCount: number;
  dispositionCounts: Readonly<Record<
    (typeof MECHANISM_PROTOTYPE_EXPLORATION_HYPOTHESIS_DISPOSITIONS)[number], number
  >>;
  selectionSignal: "FIRST_OBSERVATION" | "MIXED_EVIDENCE" |
    "REPLICATED_FALSIFICATION" | "REPLICATION_YIELD";
  recentExemplars: readonly Readonly<{
    hypothesisId: Hash;
    materialVariation: string;
    disposition: NonNullable<MechanismPrototypeExplorationHypothesis["disposition"]>;
    falsifyingObservation: string;
  }>[];
  yield: Readonly<{
    effectCount: number;
    searchEffectCount: number;
    rawHitCount: number;
    qualifiedHitCount: number;
    rolePairCount: number;
    inspectedListingCount: number;
  }>;
  usage: Readonly<{
    invocationCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    unknownUsageInvocationCount: number;
  }>;
  identityBasis: "EXACT_PROTOTYPE_AXIS_AND_TEST_BINDING";
  proseSimilarityUsed: false;
  schedulingAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type MechanismPrototypeExplorationRoleSearchBinding = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-role-search-binding.v1";
  resultIdentity: Hash;
  snapshotIdentity: Hash;
  componentQuery: MarketCorpusSearchResult["query"];
  aggregateQuery: MarketCorpusSearchResult["query"];
  requestedBridgeSignals: readonly string[];
  componentListingRef: string;
  aggregateListingRef: string;
  groundedBridgeSignals: readonly string[];
  rawComponentHitCount: number;
  rawAggregateHitCount: number;
  qualifiedComponentHitCount: number;
  qualifiedAggregateHitCount: number;
  pairCount: number;
  authority: "ROLE_SEARCH_LINEAGE_ONLY";
  semanticDecisionAuthority: false;
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
  axisAssessment?: MechanismPrototypeExplorationAxisAssessment;
  roleSearchBinding?: MechanismPrototypeExplorationRoleSearchBinding;
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
  schemaVersion: "pmh.mechanism-prototype-exploration-exhaustion.v1" |
    "pmh.mechanism-prototype-exploration-exhaustion.v2" |
    "pmh.mechanism-prototype-exploration-exhaustion.v3";
  exhaustionId: Hash;
  lensId: Hash;
  inputRevisionId: Hash;
  semanticInputIdentity: Hash;
  prototypeId: Hash;
  axis: MechanismPrototypeExplorationAxis;
  sourceAgentRunId: Hash;
  inspectedEvidenceBindings: readonly MechanismPrototypeExplorationEvidenceBinding[];
  searchedResultIds: readonly Hash[];
  roleSearchResultIds?: readonly Hash[];
  roleSearchSummaries?: readonly MechanismPrototypeExplorationRoleSearchSummary[];
  searchedNeighborhoods: readonly string[];
  failedTransferTests: readonly string[];
  failedCounterScenarios?: readonly string[];
  activatedCounterScenarios: readonly string[];
  negativeBasis?: "FAILED_PROTOTYPE_TEST" | "NO_AXIS_ADMISSIBLE_ROLE_PAIR";
  axisAdmissibleRolePairCount?: number;
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

export type MechanismPrototypeExplorationRoleSearchSummary = Readonly<{
  resultIdentity: Hash;
  rawComponentHitCount: number;
  rawAggregateHitCount: number;
  qualifiedComponentHitCount: number;
  qualifiedAggregateHitCount: number;
  pairCount: number;
}>;

export interface MechanismPrototypeExplorationStore {
  readonly mechanismPrototypeExplorationInputStorage:
    OperationalStorageProjection<"inputRevisionId">;
  readonly mechanismPrototypeExplorationTrailheadStorage:
    OperationalStorageProjection<"trailheadId">;
  readonly mechanismPrototypeExplorationExhaustionStorage:
    OperationalStorageProjection<"exhaustionId">;
  readonly mechanismPrototypeExplorationRoleSearchObservationStorage:
    OperationalStorageProjection<"observationId">;
  readonly mechanismPrototypeExplorationFlatSearchObservationStorage:
    OperationalStorageProjection<"observationId">;
  readonly mechanismPrototypeExplorationActionObservationStorage:
    OperationalStorageProjection<"observationId">;
  readonly mechanismPrototypeExplorationStepObservationStorage:
    OperationalStorageProjection<"observationId">;
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
  loadMechanismPrototypeExplorationRoleSearchObservations(limit: number):
    readonly MechanismPrototypeExplorationRoleSearchObservation[];
  saveMechanismPrototypeExplorationRoleSearchObservations(observations:
    readonly MechanismPrototypeExplorationRoleSearchObservation[]):
    readonly MechanismPrototypeExplorationRoleSearchObservation[];
  loadMechanismPrototypeExplorationFlatSearchObservations(limit: number):
    readonly MechanismPrototypeExplorationFlatSearchObservation[];
  saveMechanismPrototypeExplorationFlatSearchObservations(observations:
    readonly MechanismPrototypeExplorationFlatSearchObservation[]):
    readonly MechanismPrototypeExplorationFlatSearchObservation[];
  loadMechanismPrototypeExplorationActionObservations(limit: number):
    readonly MechanismPrototypeExplorationActionObservation[];
  saveMechanismPrototypeExplorationActionObservations(observations:
    readonly MechanismPrototypeExplorationActionObservation[]):
    readonly MechanismPrototypeExplorationActionObservation[];
  loadMechanismPrototypeExplorationStepObservations(limit: number):
    readonly MechanismPrototypeExplorationStepObservation[];
  saveMechanismPrototypeExplorationStepObservations(observations:
    readonly MechanismPrototypeExplorationStepObservation[]):
    readonly MechanismPrototypeExplorationStepObservation[];
}

export type MechanismPrototypeExplorationUsage = Readonly<{
  sourceRunIds: readonly Hash[];
  modelInvocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  unknownUsageInvocationCount: number;
  roleSearchResultCount: number;
  roleSearchRawHitCount: number;
  roleSearchQualifiedHitCount: number;
  roleSearchPairCount: number;
  inspectedEvidenceBindingCount: number;
  roleBoundTrailheadCount: number;
  roleAwareExhaustionCount: number;
  retainedActionObservationCount: number;
  resultRepairInvocationCount: number;
  resultRepairInputTokens: string;
}>;

export type MechanismPrototypeExplorationProjection = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-projection.v2";
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
    roleSearchResultCount: number;
    roleSearchRawHitCount: number;
    roleSearchQualifiedHitCount: number;
    roleSearchPairCount: number;
    inspectedEvidenceBindingCount: number;
    roleBoundTrailheadCount: number;
    roleAwareExhaustionCount: number;
    retainedActionObservationCount: number;
    retainedExperimentStepCount: number;
    experimentEpisodeCount: number;
    completeExperimentEpisodeCount: number;
    resultRepairInvocationCount: number;
    resultRepairInputTokens: string;
  }>;
  corpusSnapshotIdentity: Hash;
  corpusSemanticIdentity: Hash;
  experimentEpisodes: readonly MechanismPrototypeExplorationExperimentEpisode[];
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

function exactPredicateFamilies(
  values: readonly MarketOntologyPredicateFamily[],
): boolean {
  return exactStrings(values).join("\n") === values.join("\n") && values.every((value) =>
    ["ELECTION_OR_OFFICE", "APPOINTMENT_OR_DEPARTURE", "DEATH_OR_INCAPACITY",
      "PUBLIC_ACTION", "SPORTS_RESULT", "PRICE_OR_METRIC", "POLICY_OR_LEGAL",
      "CONFLICT_OR_DISRUPTION", "WEATHER_OR_NATURAL", "UNCLASSIFIED"].includes(value)
  );
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
    const roleCue = mechanismPrototypeExplorationComponentCue(listing.title) ||
      mechanismPrototypeExplorationAggregateCue(listing.title);
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

function buildExplorationAxisContract(input: Readonly<{
  axis: MechanismPrototypeExplorationAxis;
  sourceInput: WorldStateMechanismPrototypeInputRevision;
}>): MechanismPrototypeExplorationAxisContract {
  const sourcePredicateFamilyValues = exactStrings([
    ...sourcePredicateFamilies(input.sourceInput),
  ]) as readonly MarketOntologyPredicateFamily[];
  const sourceInstitutionFamilies = exactStrings(input.sourceInput.memberRoutes.flatMap((route) => [
    ...institutionFamilies(route.canonicalRoute.triggerPredicate),
    ...institutionFamilies(route.canonicalRoute.dependentPredicate),
  ]));
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-axis-contract.v1" as const,
    axis: input.axis,
    admissionRule: input.axis === "SURFACE_DOMAIN"
      ? "CANDIDATE_PREDICATE_FAMILY_OUTSIDE_SOURCE" as const
      : input.axis === "SUBJECT_AND_GEOGRAPHY"
      ? "GROUNDED_NON_SOURCE_PARAMETER_SIGNAL" as const
      : input.axis === "AGGREGATE_INSTITUTION"
      ? "CANDIDATE_INSTITUTION_OUTSIDE_SOURCE" as const
      : "COUNTER_SCENARIO_ACTIVATED" as const,
    sourcePredicateFamilies: sourcePredicateFamilyValues,
    sourceInstitutionFamilies,
    sourceParameterValues: exactStrings(inputSourceParameterValues(input.sourceInput)),
    representationChangeAloneInsufficient: true as const,
    unclassifiedWorldDomainInsufficient: true as const,
    authority: "EXPLORATION_AXIS_ADMISSIBILITY_ONLY" as const,
    semanticDecisionAuthority: false as const,
  });
  return Object.freeze({ ...body, contractId: hashCanonical(body) });
}

const AXIS_PARAMETER_STOP_WORDS = new Set([
  "after", "before", "control", "election", "house", "national", "party",
  "republican", "democratic", "senate", "state", "the", "united", "which",
  "will", "win", "winner",
]);

function candidateParameterSignals(
  bindings: readonly MechanismPrototypeExplorationEvidenceBinding[],
  sourceParameterValues: readonly string[],
): readonly string[] {
  const candidateTokens = exactStrings(bindings.flatMap((binding) =>
    canonicalText(binding.title).split(/[^\p{L}\p{N}]+/gu).filter((token) =>
      token.length >= 3 && !AXIS_PARAMETER_STOP_WORDS.has(token)
    )
  ));
  const sourceTokens = new Set(sourceParameterValues.flatMap((value) =>
    canonicalText(value).split(/[^\p{L}\p{N}]+/gu)
  ));
  return exactStrings(candidateTokens.filter((token) => !sourceTokens.has(token)));
}

function inputSourceParameterValues(
  sourceInput: WorldStateMechanismPrototypeInputRevision,
): readonly string[] {
  return sourceInput.memberRoutes.flatMap((route) => [
    ...route.canonicalRoute.canonicalSubjectLabels,
    ...route.canonicalRoute.canonicalTriggerSearchSignals,
    ...route.canonicalRoute.canonicalDependentSearchSignals,
    route.canonicalRoute.triggerPredicate,
    route.canonicalRoute.stateLabel,
    route.canonicalRoute.dependentPredicate,
  ]);
}

function assessExplorationAxis(input: Readonly<{
  contract: MechanismPrototypeExplorationAxisContract;
  bindings: readonly MechanismPrototypeExplorationEvidenceBinding[];
  activatedCounterScenarios: readonly string[];
}>): MechanismPrototypeExplorationAxisAssessment {
  const candidatePredicateFamilies = exactStrings(input.bindings.flatMap((binding) =>
    marketOntologyPredicateFamiliesForText(binding.title)
  )) as readonly MarketOntologyPredicateFamily[];
  const candidateInstitutionFamilies = exactStrings(input.bindings.flatMap((binding) =>
    [...institutionFamilies(binding.title)]
  ));
  const componentBindings = input.bindings.filter((binding) =>
    mechanismPrototypeExplorationComponentCue(binding.title)
  );
  const aggregateBindings = input.bindings.filter((binding) =>
    mechanismPrototypeExplorationAggregateCue(binding.title)
  );
  const componentRoleListingRefs = exactStrings(componentBindings.map((item) => item.listingRef));
  const aggregateRoleListingRefs = exactStrings(aggregateBindings.map((item) => item.listingRef));
  const distinctComponentAggregateRoles = componentBindings.some((component) =>
    aggregateBindings.some((aggregate) => aggregate.listingRef !== component.listingRef)
  );
  const componentInstitutions = new Set(componentBindings.flatMap((binding) =>
    [...institutionFamilies(binding.title)]
  ));
  const aggregateInstitutions = new Set(aggregateBindings.flatMap((binding) =>
    [...institutionFamilies(binding.title)]
  ));
  const sharedComponentAggregateInstitutions = exactStrings(
    [...componentInstitutions].filter((family) => aggregateInstitutions.has(family)),
  );
  const novelWorldFamilies = candidatePredicateFamilies.filter((family) =>
    family !== "UNCLASSIFIED" && !input.contract.sourcePredicateFamilies.includes(family)
  );
  const novelInstitutions = sharedComponentAggregateInstitutions.filter((family) =>
    !input.contract.sourceInstitutionFamilies.includes(family)
  );
  const parameterSignals = candidateParameterSignals(
    input.bindings, input.contract.sourceParameterValues,
  );
  const representationChanged = new Set(input.bindings.map((binding) =>
    `${binding.venueId}:${binding.protocolIdentity}`
  )).size > 1;
  const groundedAxisEvidenceSignals = input.contract.axis === "SURFACE_DOMAIN"
    ? distinctComponentAggregateRoles ? novelWorldFamilies : []
    : input.contract.axis === "AGGREGATE_INSTITUTION"
    ? novelInstitutions
    : input.contract.axis === "SUBJECT_AND_GEOGRAPHY"
    ? distinctComponentAggregateRoles ? parameterSignals : []
    : input.activatedCounterScenarios;
  const admissible = groundedAxisEvidenceSignals.length > 0;
  if (!admissible) {
    const observed = exactStrings([
      ...(representationChanged ? ["representation surface changed"] : []),
      ...(parameterSignals.length > 0
        ? [`non-source shared parameter signals: ${parameterSignals.join(", ")}`] : []),
      ...(candidatePredicateFamilies.length > 0
        ? [`candidate predicate families: ${candidatePredicateFamilies.join(", ")}`] : []),
      ...(candidateInstitutionFamilies.length > 0
        ? [`candidate institution families: ${candidateInstitutionFamilies.join(", ")}`] : []),
      ...(!distinctComponentAggregateRoles
        ? ["distinct component and aggregate listing roles were not grounded"] : []),
    ]);
    throw new Error(
      `mechanism exploration candidate does not satisfy ${input.contract.axis}: ${
        input.contract.admissionRule}; observed ${observed.join("; ") || "no grounded axis evidence"}`,
    );
  }
  const observedNoveltyDimensions = exactStrings([
    ...(representationChanged ? ["REPRESENTATION_SURFACE"] : []),
    ...(parameterSignals.length > 0 ? ["SUBJECT_OR_GEOGRAPHY_PARAMETER"] : []),
    ...(novelWorldFamilies.length > 0 ? ["WORLD_DOMAIN"] : []),
    ...(novelInstitutions.length > 0 ? ["AGGREGATE_INSTITUTION"] : []),
    ...(input.activatedCounterScenarios.length > 0 ? ["COUNTEREXAMPLE_PRESSURE"] : []),
  ]) as readonly MechanismPrototypeExplorationNoveltyDimension[];
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-axis-assessment.v1" as const,
    contractId: input.contract.contractId,
    requestedAxis: input.contract.axis,
    candidatePredicateFamilies,
    candidateInstitutionFamilies,
    componentRoleListingRefs,
    aggregateRoleListingRefs,
    sharedComponentAggregateInstitutions,
    groundedAxisEvidenceSignals,
    observedNoveltyDimensions,
    admissible: true as const,
    diagnostic: `${input.contract.axis} admitted by ${groundedAxisEvidenceSignals.join(", ")}`,
    authority: "EXPLORATION_AXIS_ADMISSION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
  });
  return Object.freeze({ ...body, assessmentId: hashCanonical(body) });
}

export function assessMechanismPrototypeExplorationCandidatePair(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  corpus: MarketCorpusSnapshot;
  listingRefs: readonly string[];
  activatedCounterScenarios: readonly string[];
}>): MechanismPrototypeExplorationAxisAssessment {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const refs = exactStrings(input.listingRefs);
  if (refs.length !== 2 || refs.some((ref) =>
    researchInput.excludedListingRefs.includes(ref)
  )) throw new Error("mechanism exploration candidate pair contains source listings");
  if (researchInput.axisContract === undefined) {
    throw new Error("mechanism exploration axis contract is unavailable");
  }
  return assessExplorationAxis({
    contract: researchInput.axisContract,
    bindings: refs.map((ref) => semanticEvidenceBinding(corpus, ref)),
    activatedCounterScenarios: input.activatedCounterScenarios,
  });
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

export function mechanismPrototypeExplorationComponentCue(title: string): boolean {
  return /\b(?:district|state (?:senate|house|election)|senate election|house district|primary|grand prix|race|match|game|round|heat|fixture)\b/iu
    .test(title);
}

export function mechanismPrototypeExplorationAggregateCue(title: string): boolean {
  return /\b(?:control(?:s|led)?\b.{0,40}\b(?:house|senate)|(?:house|senate)\b.{0,40}\bcontrol|u\.?s\.? (?:house|senate) midterm winner|majority|constructors championship|overall championship|league champion|tournament champion|national champion)\b/iu
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
    mechanismPrototypeExplorationComponentCue(title) ? [index] : []
  );
  const aggregateIndexes = input.trailhead.listingTitleExcerpts.flatMap((title, index) =>
    mechanismPrototypeExplorationAggregateCue(title) ? [index] : []
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
  roleSearchObservations?: readonly MechanismPrototypeExplorationRoleSearchObservation[];
  actionObservations?: readonly MechanismPrototypeExplorationActionObservation[];
  stepObservations?: readonly MechanismPrototypeExplorationStepObservation[];
  execution?: AgentExecutionSnapshot;
  corpus: MarketCorpusSnapshot;
  ontology: MarketOntologySnapshot;
  economicAttention?: WorldRelationEconomicAttentionProjection;
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
  const retainedRoleSearchObservations = (input.roleSearchObservations ?? [])
    .map(assertMechanismPrototypeExplorationRoleSearchObservation);
  const retainedActionObservations = (input.actionObservations ?? [])
    .map(assertMechanismPrototypeExplorationActionObservation);
  const retainedStepObservations = (input.stepObservations ?? [])
    .map(assertMechanismPrototypeExplorationStepObservation);
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
      const axisContract = buildExplorationAxisContract({ axis, sourceInput });
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
        axisContractId: axisContract.contractId,
        coverageScopeIdentity,
        knownMemberRouteFamilyIds: sourceInput.memberRouteFamilyIds,
        excludedListingRefs,
        seedTrailheadIds: seedTrailheads.map((item) => item.seedId),
      });
      const economicAttention = input.economicAttention === undefined ? undefined
        : assertWorldRelationEconomicAttention(input.economicAttention);
      const revisionBody = Object.freeze({
        schemaVersion: economicAttention === undefined
          ? "pmh.mechanism-prototype-exploration-input.v1" as const
          : "pmh.mechanism-prototype-exploration-input.v2" as const,
        lensId,
        prototypeId: prototype.prototypeId,
        sourcePrototypeInputRevisionId: sourceInput.revisionId,
        axis,
        semanticInputIdentity,
        axisContract,
        coverageScopeIdentity,
        coverageMembers,
        corpusSnapshotIdentity: corpus.snapshotIdentity,
        corpusSemanticIdentity,
        sourceSetIdentity: corpus.sourceSetIdentity,
        ontologyIdentity: ontology.ontologyIdentity,
        knownMemberRouteFamilyIds: sourceInput.memberRouteFamilyIds,
        excludedListingRefs,
        seedTrailheads,
        ...(economicAttention === undefined ? {} : { economicAttention }),
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
      const retainedAssessedTrailheads = retainedLensTrailheads.filter((item) =>
        item.axisAssessment !== undefined
      );
      const latestRetainedAxisAssessment = [...retainedAssessedTrailheads]
        .sort((left, right) => right.proposedAt.localeCompare(left.proposedAt) ||
          right.trailheadId.localeCompare(left.trailheadId))[0]?.axisAssessment ?? null;
      const coveredSemanticListings = new Set([
        ...retainedLensTrailheads.flatMap((item) => {
          const retainedInput = retainedInputById.get(item.inputRevisionId);
          if (retainedInput?.axisContract?.contractId !== axisContract.contractId) return [];
          return retainedInput?.coverageMembers?.map((member) =>
            member.semanticListingIdentity
          ) ?? [];
        }),
        ...retainedLensExhaustions.flatMap((item) => {
          const retainedInput = retainedInputById.get(item.inputRevisionId);
          if (retainedInput?.axisContract?.contractId !== axisContract.contractId) return [];
          return retainedInput?.coverageMembers?.map((member) =>
            member.semanticListingIdentity
          ) ?? [];
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
        retainedAssessedTrailheadCount: retainedAssessedTrailheads.length,
        retainedPreGateTrailheadCount:
          retainedLensTrailheads.length - retainedAssessedTrailheads.length,
        latestRetainedAxisAssessment,
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
    ...retainedRoleSearchObservations.map((item) => item.sourceAgentRunId),
    ...retainedActionObservations.map((item) => item.sourceAgentRunId),
    ...retainedStepObservations.map((item) => item.sourceAgentRunId),
  ]);
  const sourceRuns = new Set(sourceRunIds);
  const invocations = (input.execution?.modelInvocations ?? []).filter((item) =>
    sourceRuns.has(item.runId)
  );
  const repairInvocations = invocations.filter((item) =>
    (item.schemaVersion === "pmh.model-invocation.v3" ||
      item.schemaVersion === "pmh.model-invocation.v4") &&
    item.purpose === "RESULT_REPAIR"
  );
  const tokenSum = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, item) => total + BigInt(item[key] ?? "0"), 0n).toString();
  const roleSearchSummaries = [
    ...retainedRoleSearchObservations.map((item) => ({
      resultIdentity: item.result.resultIdentity,
      rawComponentHitCount: item.result.rawComponentHitCount,
      rawAggregateHitCount: item.result.rawAggregateHitCount,
      qualifiedComponentHitCount: item.result.componentHits.length,
      qualifiedAggregateHitCount: item.result.aggregateHits.length,
      pairCount: item.result.pairCount,
    })),
    ...retainedTrailheads.flatMap((item) => item.roleSearchBinding === undefined ? [] : [{
      resultIdentity: item.roleSearchBinding.resultIdentity,
      rawComponentHitCount: item.roleSearchBinding.rawComponentHitCount,
      rawAggregateHitCount: item.roleSearchBinding.rawAggregateHitCount,
      qualifiedComponentHitCount: item.roleSearchBinding.qualifiedComponentHitCount,
      qualifiedAggregateHitCount: item.roleSearchBinding.qualifiedAggregateHitCount,
      pairCount: item.roleSearchBinding.pairCount,
    }]),
    ...retainedExhaustions.flatMap((item) => item.roleSearchSummaries ?? []),
  ];
  const uniqueRoleSearchSummaries = [...new Map(roleSearchSummaries.map((item) =>
    [item.resultIdentity, item] as const
  )).values()];
  const experimentEpisodes = input.execution === undefined ? Object.freeze([]) :
    compileMechanismPrototypeExplorationExperimentEpisodes({
      inputs: retainedInputs,
      stepObservations: retainedStepObservations,
      execution: input.execution,
    }).slice(0, 32);
  const usage = Object.freeze({
    sourceRunCount: sourceRunIds.length,
    modelInvocationCount: invocations.length,
    knownInputTokens: tokenSum("inputTokens"),
    knownOutputTokens: tokenSum("outputTokens"),
    knownReasoningTokens: tokenSum("reasoningTokens"),
    unknownUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
    ).length,
    roleSearchResultCount: uniqueRoleSearchSummaries.length,
    roleSearchRawHitCount: uniqueRoleSearchSummaries.reduce((total, item) => total +
      item.rawComponentHitCount + item.rawAggregateHitCount, 0),
    roleSearchQualifiedHitCount: uniqueRoleSearchSummaries.reduce((total, item) => total +
      item.qualifiedComponentHitCount + item.qualifiedAggregateHitCount, 0),
    roleSearchPairCount: uniqueRoleSearchSummaries.reduce((total, item) =>
      total + item.pairCount, 0),
    inspectedEvidenceBindingCount: retainedTrailheads.reduce((total, item) =>
      total + item.evidenceBindings.length, 0) + retainedExhaustions.reduce((total, item) =>
      total + item.inspectedEvidenceBindings.length, 0),
    roleBoundTrailheadCount: retainedTrailheads.filter((item) =>
      item.roleSearchBinding !== undefined
    ).length,
    roleAwareExhaustionCount: retainedExhaustions.filter((item) =>
      (item.roleSearchSummaries?.length ?? 0) > 0
    ).length,
    retainedActionObservationCount: retainedActionObservations.length,
    retainedExperimentStepCount: retainedStepObservations.length,
    experimentEpisodeCount: experimentEpisodes.length,
    completeExperimentEpisodeCount: experimentEpisodes.filter((item) =>
      item.ledgerCompleteness === "COMPLETE_EFFECT_LEDGER"
    ).length,
    resultRepairInvocationCount: repairInvocations.length,
    resultRepairInputTokens: repairInvocations.reduce((total, item) =>
      total + BigInt(item.inputTokens ?? "0"), 0n).toString(),
  });
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-projection.v2" as const,
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
    experimentEpisodes,
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
    !["pmh.mechanism-prototype-exploration-input.v1",
      "pmh.mechanism-prototype-exploration-input.v2"].includes(revision.schemaVersion) ||
    !HASH_PATTERN.test(String(inputRevisionId)) || inputRevisionId !== hashCanonical(body) ||
    ![revision.lensId, revision.prototypeId, revision.sourcePrototypeInputRevisionId,
      revision.semanticInputIdentity, revision.corpusSnapshotIdentity,
      revision.corpusSemanticIdentity, revision.sourceSetIdentity,
      revision.ontologyIdentity].every((item) => HASH_PATTERN.test(String(item))) ||
    (revision.coverageScopeIdentity !== undefined &&
      !HASH_PATTERN.test(String(revision.coverageScopeIdentity))) ||
    (revision.axisContract !== undefined && (
      revision.axisContract.axis !== revision.axis ||
      revision.axisContract.contractId !== hashCanonical((({ contractId: _ignored, ...rest }) =>
        rest)(revision.axisContract)) ||
      !["CANDIDATE_PREDICATE_FAMILY_OUTSIDE_SOURCE",
        "GROUNDED_NON_SOURCE_PARAMETER_SIGNAL", "CANDIDATE_INSTITUTION_OUTSIDE_SOURCE",
        "COUNTER_SCENARIO_ACTIVATED"].includes(revision.axisContract.admissionRule) ||
      !exactPredicateFamilies(revision.axisContract.sourcePredicateFamilies) ||
      exactStrings(revision.axisContract.sourceInstitutionFamilies).join("\n") !==
        revision.axisContract.sourceInstitutionFamilies.join("\n") ||
      exactStrings(revision.axisContract.sourceParameterValues).join("\n") !==
        revision.axisContract.sourceParameterValues.join("\n") ||
      revision.axisContract.representationChangeAloneInsufficient !== true ||
      revision.axisContract.unclassifiedWorldDomainInsufficient !== true ||
      revision.axisContract.authority !== "EXPLORATION_AXIS_ADMISSIBILITY_ONLY" ||
      revision.axisContract.semanticDecisionAuthority !== false
    )) ||
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
    (revision.schemaVersion === "pmh.mechanism-prototype-exploration-input.v1"
      ? revision.economicAttention !== undefined
      : revision.economicAttention === undefined || (() => {
        try {
          assertWorldRelationEconomicAttention(revision.economicAttention);
          return false;
        } catch {
          return true;
        }
      })()) ||
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
  roleSearchBinding?: MechanismPrototypeExplorationRoleSearchBinding;
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
  const appliedTransferTests = input.appliedTransferTests.length === 0
    ? Object.freeze([]) : boundedTexts(input.appliedTransferTests, 1, 12);
  if (appliedTransferTests.some((test) => !prototype.transferTests.includes(test))) {
    throw new Error("mechanism exploration trailhead uses an unknown transfer test");
  }
  const activatedCounterScenarios = input.activatedCounterScenarios.length === 0
    ? Object.freeze([])
    : boundedTexts(input.activatedCounterScenarios, 1, 12);
  if (activatedCounterScenarios.some((item) => !prototype.counterScenarios.includes(item))) {
    throw new Error("mechanism exploration trailhead uses an unknown counter-scenario");
  }
  if (appliedTransferTests.length + activatedCounterScenarios.length === 0) {
    throw new Error("mechanism exploration trailhead requires a supported prototype test");
  }
  if (researchInput.axisContract === undefined) {
    throw new Error("mechanism exploration axis contract is unavailable");
  }
  const axisAssessment = assessMechanismPrototypeExplorationCandidatePair({
    researchInput,
    corpus: input.corpus,
    listingRefs: bindings.map((binding) => binding.listingRef),
    activatedCounterScenarios,
  });
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
    ...(input.roleSearchBinding === undefined ? {} : {
      roleSearchBinding: Object.freeze(input.roleSearchBinding),
    }),
    axisAssessment,
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
  roleSearchResultIds?: readonly Hash[];
  roleSearchSummaries?: readonly MechanismPrototypeExplorationRoleSearchSummary[];
  inspectedListingRefsForResult: readonly string[];
  searchedNeighborhoods: readonly string[];
  failedTransferTests: readonly string[];
  failedCounterScenarios?: readonly string[];
  activatedCounterScenarios: readonly string[];
  negativeBasis?: "FAILED_PROTOTYPE_TEST" | "NO_AXIS_ADMISSIBLE_ROLE_PAIR";
  axisAdmissibleRolePairCount?: number;
  reason: string;
  proposedAt: string;
}>): MechanismPrototypeExplorationExhaustion {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const prototype = assertWorldStateMechanismPrototypeProposal(input.prototype);
  if (prototype.prototypeId !== researchInput.prototypeId ||
      !HASH_PATTERN.test(input.sourceAgentRunId) || !bounded(input.reason, 2_000)) {
    throw new Error("mechanism exploration exhaustion lineage or reason is invalid");
  }
  const failedTransferTests = input.failedTransferTests.length === 0
    ? Object.freeze([]) : boundedTexts(input.failedTransferTests, 1, 12);
  if (failedTransferTests.some((test) => !prototype.transferTests.includes(test))) {
    throw new Error("mechanism exploration exhaustion uses an unknown transfer test");
  }
  const activatedCounterScenarios = input.activatedCounterScenarios.length === 0
    ? Object.freeze([])
    : boundedTexts(input.activatedCounterScenarios, 1, 12);
  if (activatedCounterScenarios.some((item) => !prototype.counterScenarios.includes(item))) {
    throw new Error("mechanism exploration exhaustion uses an unknown counter-scenario");
  }
  const failedCounterScenarios = (input.failedCounterScenarios ?? []).length === 0
    ? Object.freeze([]) : boundedTexts(input.failedCounterScenarios ?? [], 1, 12);
  const negativeBasis = input.negativeBasis ?? "FAILED_PROTOTYPE_TEST";
  const axisAdmissibleRolePairCount = input.axisAdmissibleRolePairCount ?? 0;
  if (!["FAILED_PROTOTYPE_TEST", "NO_AXIS_ADMISSIBLE_ROLE_PAIR"].includes(negativeBasis) ||
      !Number.isSafeInteger(axisAdmissibleRolePairCount) || axisAdmissibleRolePairCount < 0 ||
      failedCounterScenarios.some((item) => !prototype.counterScenarios.includes(item)) ||
      (negativeBasis === "FAILED_PROTOTYPE_TEST" &&
        failedTransferTests.length + failedCounterScenarios.length === 0) ||
      (negativeBasis === "NO_AXIS_ADMISSIBLE_ROLE_PAIR" &&
        (failedTransferTests.length + failedCounterScenarios.length !== 0 ||
         axisAdmissibleRolePairCount !== 0 ||
         (input.roleSearchResultIds?.length ?? 0) < 2))) {
    throw new Error("mechanism exploration exhaustion negative basis is unsupported");
  }
  const searchedResultIds = exactHashes(input.searchedResultIds);
  if (searchedResultIds.length === 0) {
    throw new Error("mechanism exploration exhaustion requires at least one exact search");
  }
  const body = Object.freeze({
    schemaVersion: input.negativeBasis === undefined
      ? "pmh.mechanism-prototype-exploration-exhaustion.v2" as const
      : "pmh.mechanism-prototype-exploration-exhaustion.v3" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: prototype.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: input.sourceAgentRunId,
    inspectedEvidenceBindings: input.negativeBasis === "NO_AXIS_ADMISSIBLE_ROLE_PAIR" &&
        input.inspectedListingRefsForResult.length === 0
      ? Object.freeze([])
      : evidenceBindings({
        researchInput, corpus: input.corpus,
        listingRefs: input.inspectedListingRefsForResult,
        inspectedListingRefs: input.inspectedListingRefs, minimum: 1,
      }),
    searchedResultIds,
    ...(input.roleSearchResultIds === undefined ? {} : {
      roleSearchResultIds: exactHashes(input.roleSearchResultIds),
    }),
    ...(input.roleSearchSummaries === undefined ? {} : {
      roleSearchSummaries: Object.freeze([...input.roleSearchSummaries]
        .sort((left, right) => left.resultIdentity.localeCompare(right.resultIdentity))),
    }),
    searchedNeighborhoods: boundedTexts(input.searchedNeighborhoods, 1, 12),
    failedTransferTests,
    failedCounterScenarios,
    activatedCounterScenarios,
    ...(input.negativeBasis === undefined ? {} : {
      negativeBasis,
      axisAdmissibleRolePairCount,
    }),
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
  const validAxisAssessment = item.axisAssessment === undefined || (() => {
    const { assessmentId, ...assessmentBody } = item.axisAssessment;
    return assessmentId === hashCanonical(assessmentBody) &&
      HASH_PATTERN.test(assessmentId) &&
      item.axisAssessment.requestedAxis === item.axis &&
      HASH_PATTERN.test(item.axisAssessment.contractId) &&
      item.axisAssessment.admissible === true &&
      exactPredicateFamilies(item.axisAssessment.candidatePredicateFamilies) &&
      exactStrings(item.axisAssessment.candidateInstitutionFamilies).join("\n") ===
        item.axisAssessment.candidateInstitutionFamilies.join("\n") &&
      exactStrings(item.axisAssessment.componentRoleListingRefs).join("\n") ===
        item.axisAssessment.componentRoleListingRefs.join("\n") &&
      exactStrings(item.axisAssessment.aggregateRoleListingRefs).join("\n") ===
        item.axisAssessment.aggregateRoleListingRefs.join("\n") &&
      exactStrings(item.axisAssessment.sharedComponentAggregateInstitutions).join("\n") ===
        item.axisAssessment.sharedComponentAggregateInstitutions.join("\n") &&
      exactStrings(item.axisAssessment.groundedAxisEvidenceSignals).join("\n") ===
        item.axisAssessment.groundedAxisEvidenceSignals.join("\n") &&
      exactStrings(item.axisAssessment.observedNoveltyDimensions).join("\n") ===
        item.axisAssessment.observedNoveltyDimensions.join("\n") &&
      item.axisAssessment.observedNoveltyDimensions.every((dimension) =>
        ["REPRESENTATION_SURFACE", "SUBJECT_OR_GEOGRAPHY_PARAMETER", "WORLD_DOMAIN",
          "AGGREGATE_INSTITUTION", "COUNTEREXAMPLE_PRESSURE"].includes(dimension)
      ) &&
      item.axisAssessment.groundedAxisEvidenceSignals.length > 0 &&
      bounded(item.axisAssessment.diagnostic, 2_000) &&
      item.axisAssessment.authority === "EXPLORATION_AXIS_ADMISSION_ONLY" &&
      item.axisAssessment.semanticDecisionAuthority === false &&
      item.axisAssessment.probabilityAuthority === false;
  })();
  const validRoleSearchBinding = item.roleSearchBinding === undefined || (
    item.roleSearchBinding.schemaVersion ===
      "pmh.mechanism-prototype-exploration-role-search-binding.v1" &&
    HASH_PATTERN.test(item.roleSearchBinding.resultIdentity) &&
    HASH_PATTERN.test(item.roleSearchBinding.snapshotIdentity) &&
    Array.isArray(item.roleSearchBinding.componentQuery.patterns) &&
    item.roleSearchBinding.componentQuery.patterns.length > 0 &&
    Array.isArray(item.roleSearchBinding.aggregateQuery.patterns) &&
    item.roleSearchBinding.aggregateQuery.patterns.length > 0 &&
    exactStrings(item.roleSearchBinding.requestedBridgeSignals).join("\n") ===
      item.roleSearchBinding.requestedBridgeSignals.join("\n") &&
    bounded(item.roleSearchBinding.componentListingRef, 500) &&
    bounded(item.roleSearchBinding.aggregateListingRef, 500) &&
    item.roleSearchBinding.componentListingRef !== item.roleSearchBinding.aggregateListingRef &&
    exactStrings(item.roleSearchBinding.groundedBridgeSignals).join("\n") ===
      item.roleSearchBinding.groundedBridgeSignals.join("\n") &&
    item.roleSearchBinding.groundedBridgeSignals.length > 0 &&
    [item.roleSearchBinding.rawComponentHitCount,
      item.roleSearchBinding.rawAggregateHitCount,
      item.roleSearchBinding.qualifiedComponentHitCount,
      item.roleSearchBinding.qualifiedAggregateHitCount,
      item.roleSearchBinding.pairCount].every((count) =>
      Number.isSafeInteger(count) && count >= 0
    ) && item.roleSearchBinding.pairCount > 0 &&
    item.roleSearchBinding.authority === "ROLE_SEARCH_LINEAGE_ONLY" &&
    item.roleSearchBinding.semanticDecisionAuthority === false
  );
  if (
    item.schemaVersion !== "pmh.mechanism-prototype-exploration-trailhead.v1" ||
    !HASH_PATTERN.test(String(trailheadId)) || trailheadId !== hashCanonical(body) ||
    ![item.lensId, item.inputRevisionId, item.semanticInputIdentity, item.prototypeId,
      item.sourceAgentRunId].every((field) => HASH_PATTERN.test(String(field))) ||
    !MECHANISM_PROTOTYPE_EXPLORATION_AXES.includes(item.axis) ||
    !validEvidenceBindings(item.evidenceBindings, 2) ||
    !validAxisAssessment || !validRoleSearchBinding ||
    !bounded(item.structuralAnalogy, 2_000) ||
    boundedTexts(item.surfaceDifferences, 1, 12).join("\n") !==
      item.surfaceDifferences.join("\n") ||
    (item.appliedTransferTests.length > 0 &&
      boundedTexts(item.appliedTransferTests, 1, 12).join("\n") !==
        item.appliedTransferTests.join("\n")) ||
    item.appliedTransferTests.length + item.activatedCounterScenarios.length === 0 ||
    (item.activatedCounterScenarios.length > 0 &&
      boundedTexts(item.activatedCounterScenarios, 1, 12).join("\n") !==
        item.activatedCounterScenarios.join("\n")) ||
    boundedTexts(item.searchSignals, 1, 12).join("\n") !== item.searchSignals.join("\n") ||
    !bounded(item.noveltyAxisExplanation, 2_000) || !bounded(item.rationale, 2_000) ||
    exactHashes(item.searchedResultIds).join("\n") !== item.searchedResultIds.join("\n") ||
    (item.roleSearchBinding !== undefined && (
      !item.searchedResultIds.includes(item.roleSearchBinding.resultIdentity) ||
      item.evidenceBindings.map((binding) => binding.listingRef).sort().join("\n") !==
        [item.roleSearchBinding.componentListingRef,
          item.roleSearchBinding.aggregateListingRef].sort().join("\n")
    )) ||
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
    !["pmh.mechanism-prototype-exploration-exhaustion.v1",
      "pmh.mechanism-prototype-exploration-exhaustion.v2",
      "pmh.mechanism-prototype-exploration-exhaustion.v3"]
      .includes(String(item.schemaVersion)) ||
    !HASH_PATTERN.test(String(exhaustionId)) || exhaustionId !== hashCanonical(body) ||
    ![item.lensId, item.inputRevisionId, item.semanticInputIdentity, item.prototypeId,
      item.sourceAgentRunId].every((field) => HASH_PATTERN.test(String(field))) ||
    !MECHANISM_PROTOTYPE_EXPLORATION_AXES.includes(item.axis) ||
    !validEvidenceBindings(item.inspectedEvidenceBindings,
      item.schemaVersion === "pmh.mechanism-prototype-exploration-exhaustion.v3" &&
        item.negativeBasis === "NO_AXIS_ADMISSIBLE_ROLE_PAIR" ? 0 : 1) ||
    exactHashes(item.searchedResultIds).join("\n") !== item.searchedResultIds.join("\n") ||
    (item.roleSearchResultIds !== undefined &&
      exactHashes(item.roleSearchResultIds).join("\n") !==
        item.roleSearchResultIds.join("\n")) ||
    (item.roleSearchSummaries !== undefined && (
      item.roleSearchSummaries.length === 0 ||
      item.roleSearchSummaries.map((summary) => summary.resultIdentity).join("\n") !==
        [...item.roleSearchSummaries].sort((left, right) =>
          left.resultIdentity.localeCompare(right.resultIdentity)
        ).map((summary) => summary.resultIdentity).join("\n") ||
      item.roleSearchSummaries.some((summary) =>
        !HASH_PATTERN.test(summary.resultIdentity) ||
        ![summary.rawComponentHitCount, summary.rawAggregateHitCount,
          summary.qualifiedComponentHitCount, summary.qualifiedAggregateHitCount,
          summary.pairCount].every((count) => Number.isSafeInteger(count) && count >= 0)
      )
    )) ||
    item.searchedResultIds.length < 1 ||
    boundedTexts(item.searchedNeighborhoods, 1, 12).join("\n") !==
      item.searchedNeighborhoods.join("\n") ||
    (item.failedTransferTests.length > 0 &&
      boundedTexts(item.failedTransferTests, 1, 12).join("\n") !==
        item.failedTransferTests.join("\n")) ||
    (item.schemaVersion === "pmh.mechanism-prototype-exploration-exhaustion.v2" &&
      (!Array.isArray(item.failedCounterScenarios) ||
       item.failedTransferTests.length + item.failedCounterScenarios.length === 0 ||
       (item.failedCounterScenarios.length > 0 &&
        boundedTexts(item.failedCounterScenarios, 1, 12).join("\n") !==
          item.failedCounterScenarios.join("\n")))) ||
    (item.schemaVersion === "pmh.mechanism-prototype-exploration-exhaustion.v3" && (
      !Array.isArray(item.failedCounterScenarios) ||
      !["FAILED_PROTOTYPE_TEST", "NO_AXIS_ADMISSIBLE_ROLE_PAIR"]
        .includes(String(item.negativeBasis)) ||
      !Number.isSafeInteger(item.axisAdmissibleRolePairCount) ||
      Number(item.axisAdmissibleRolePairCount) < 0 ||
      (item.failedCounterScenarios.length > 0 &&
        boundedTexts(item.failedCounterScenarios, 1, 12).join("\n") !==
          item.failedCounterScenarios.join("\n")) ||
      (item.negativeBasis === "FAILED_PROTOTYPE_TEST"
        ? item.failedTransferTests.length + item.failedCounterScenarios.length === 0
        : item.failedTransferTests.length + item.failedCounterScenarios.length !== 0 ||
          item.axisAdmissibleRolePairCount !== 0 ||
          (item.roleSearchResultIds?.length ?? 0) < 2 ||
          (item.roleSearchSummaries?.length ?? 0) < 2)
    )) ||
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

const ROLE_BRIDGE_STOP_WORDS = new Set([
  "after", "aggregate", "before", "champion", "championship", "component",
  "control", "district", "election", "final", "game", "grand", "house",
  "league", "market", "match", "national", "outcome", "party", "prix",
  "race", "round", "senate", "state", "team", "the", "tournament",
  "which", "will", "win", "winner", "wins", "yes",
]);

function roleBridgeTokens(title: string): readonly string[] {
  return exactStrings(canonicalText(title).split(/[^\p{L}\p{N}]+/gu).filter((token) =>
    token.length >= 3 && !ROLE_BRIDGE_STOP_WORDS.has(token) && !/^\d+$/u.test(token)
  ));
}

function literalSignalGrounded(title: string, signal: string): boolean {
  return canonicalText(title).includes(canonicalText(signal));
}

export function searchMechanismPrototypeExplorationRoles(input: Readonly<{
  corpus: MarketCorpusSnapshot;
  componentQuery: MarketCorpusSearchQuery;
  aggregateQuery: MarketCorpusSearchQuery;
  bridgeSignals?: readonly string[];
  pairLimit?: number;
}>): MechanismPrototypeExplorationRoleSearchResult {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const componentSearch = searchMarketCorpus(corpus, input.componentQuery);
  const aggregateSearch = searchMarketCorpus(corpus, input.aggregateQuery);
  const requestedBridgeSignals = exactStrings((input.bridgeSignals ?? []).map(canonicalText));
  if (requestedBridgeSignals.length > 12 || requestedBridgeSignals.some((signal) =>
    signal.length < 2 || signal.length > 160
  )) throw new Error("mechanism exploration bridge signals are invalid");
  const pairLimit = input.pairLimit ?? 24;
  if (!Number.isSafeInteger(pairLimit) || pairLimit < 1 || pairLimit > 50) {
    throw new Error("mechanism exploration pair limit is invalid");
  }
  const componentHits = Object.freeze(componentSearch.hits.filter((hit) =>
    mechanismPrototypeExplorationComponentCue(hit.title)
  ));
  const aggregateHits = Object.freeze(aggregateSearch.hits.filter((hit) =>
    mechanismPrototypeExplorationAggregateCue(hit.title)
  ));
  const unclassifiedComponentListingRefs = exactStrings(componentSearch.hits
    .filter((hit) => !mechanismPrototypeExplorationComponentCue(hit.title))
    .map((hit) => hit.listingRef));
  const unclassifiedAggregateListingRefs = exactStrings(aggregateSearch.hits
    .filter((hit) => !mechanismPrototypeExplorationAggregateCue(hit.title))
    .map((hit) => hit.listingRef));
  const candidates = componentHits.flatMap((component) => aggregateHits.flatMap((aggregate) => {
    if (component.listingRef === aggregate.listingRef) return [];
    const componentTokens = new Set(roleBridgeTokens(component.title));
    const aggregateTokens = new Set(roleBridgeTokens(aggregate.title));
    const implicitSignals = [...componentTokens].filter((signal) => aggregateTokens.has(signal));
    const explicitSignals = requestedBridgeSignals.filter((signal) =>
      literalSignalGrounded(component.title, signal) && literalSignalGrounded(aggregate.title, signal)
    );
    const groundedBridgeSignals = exactStrings([...explicitSignals, ...implicitSignals]);
    if (groundedBridgeSignals.length === 0) return [];
    return [Object.freeze({
      componentListingRef: component.listingRef,
      aggregateListingRef: aggregate.listingRef,
      groundedBridgeSignals,
      authority: "ROLE_QUALIFIED_PAIR_RETRIEVAL_ONLY" as const,
      semanticDecisionAuthority: false as const,
    })];
  })).sort((left, right) =>
    right.groundedBridgeSignals.length - left.groundedBridgeSignals.length ||
    left.componentListingRef.localeCompare(right.componentListingRef) ||
    left.aggregateListingRef.localeCompare(right.aggregateListingRef)
  );
  const pairs = Object.freeze(candidates.slice(0, pairLimit));
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-role-search.v1" as const,
    snapshotIdentity: corpus.snapshotIdentity,
    componentSearchResultIdentity: componentSearch.resultIdentity,
    aggregateSearchResultIdentity: aggregateSearch.resultIdentity,
    componentQuery: componentSearch.query,
    aggregateQuery: aggregateSearch.query,
    requestedBridgeSignals,
    rawComponentHitCount: componentSearch.matchCount,
    rawAggregateHitCount: aggregateSearch.matchCount,
    componentHits,
    aggregateHits,
    unclassifiedComponentListingRefs,
    unclassifiedAggregateListingRefs,
    pairCount: pairs.length,
    pairFrontierTruncated: candidates.length > pairs.length,
    pairs,
    authority: "ROLE_AWARE_SEARCH_EVIDENCE_ONLY" as const,
    roleCueSemanticAuthority: false as const,
    bridgeSignalSubjectIdentityAuthority: false as const,
    semanticDecisionAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, resultIdentity: hashCanonical(body) });
}

export function assertMechanismPrototypeExplorationRoleSearchResult(
  value: unknown,
): MechanismPrototypeExplorationRoleSearchResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration role-search result is malformed");
  }
  const item = value as Record<string, unknown>;
  const { resultIdentity, ...body } = item;
  if (!HASH_PATTERN.test(String(resultIdentity)) || hashCanonical(body) !== resultIdentity ||
      item.schemaVersion !== "pmh.mechanism-prototype-exploration-role-search.v1" ||
      !HASH_PATTERN.test(String(item.snapshotIdentity)) ||
      !HASH_PATTERN.test(String(item.componentSearchResultIdentity)) ||
      !HASH_PATTERN.test(String(item.aggregateSearchResultIdentity)) ||
      !Array.isArray(item.componentHits) || !Array.isArray(item.aggregateHits) ||
      !Array.isArray(item.unclassifiedComponentListingRefs) ||
      !Array.isArray(item.unclassifiedAggregateListingRefs) || !Array.isArray(item.pairs) ||
      !Number.isSafeInteger(item.rawComponentHitCount) ||
      !Number.isSafeInteger(item.rawAggregateHitCount) ||
      !Number.isSafeInteger(item.pairCount) || item.pairCount !== item.pairs.length ||
      item.authority !== "ROLE_AWARE_SEARCH_EVIDENCE_ONLY" ||
      item.roleCueSemanticAuthority !== false ||
      item.bridgeSignalSubjectIdentityAuthority !== false ||
      item.semanticDecisionAuthority !== false || item.executionAuthority !== false) {
    throw new Error("mechanism exploration role-search result identity is invalid");
  }
  return value as MechanismPrototypeExplorationRoleSearchResult;
}

export function buildMechanismPrototypeExplorationRoleSearchObservation(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  capturedAt: string;
  result: MechanismPrototypeExplorationRoleSearchResult;
}>): MechanismPrototypeExplorationRoleSearchObservation {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const result = assertMechanismPrototypeExplorationRoleSearchResult(input.result);
  if (!HASH_PATTERN.test(input.sourceAgentRunId) ||
      input.sourceToolCallId.trim().length < 1 || input.sourceToolCallId.length > 500 ||
      !Number.isFinite(Date.parse(input.capturedAt)) ||
      result.snapshotIdentity !== researchInput.corpusSnapshotIdentity) {
    throw new Error("mechanism exploration role-search observation lineage is invalid");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-role-search-observation.v1" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: researchInput.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: input.sourceAgentRunId,
    sourceToolCallId: input.sourceToolCallId,
    capturedAt: input.capturedAt,
    result,
    authority: "DURABLE_ROLE_SEARCH_EVIDENCE_ONLY" as const,
    roleCueSemanticAuthority: false as const,
    bridgeSignalSubjectIdentityAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, observationId: hashCanonical(body) });
}

export function assertMechanismPrototypeExplorationRoleSearchObservation(
  value: unknown,
): MechanismPrototypeExplorationRoleSearchObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration role-search observation is malformed");
  }
  const item = value as Record<string, unknown>;
  const { observationId, ...body } = item;
  const result = assertMechanismPrototypeExplorationRoleSearchResult(item.result);
  if (!HASH_PATTERN.test(String(observationId)) || hashCanonical(body) !== observationId ||
      item.schemaVersion !==
        "pmh.mechanism-prototype-exploration-role-search-observation.v1" ||
      !HASH_PATTERN.test(String(item.lensId)) ||
      !HASH_PATTERN.test(String(item.inputRevisionId)) ||
      !HASH_PATTERN.test(String(item.semanticInputIdentity)) ||
      !HASH_PATTERN.test(String(item.prototypeId)) ||
      !HASH_PATTERN.test(String(item.sourceAgentRunId)) ||
      typeof item.sourceToolCallId !== "string" || item.sourceToolCallId.length < 1 ||
      item.sourceToolCallId.length > 500 || typeof item.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(item.capturedAt)) ||
      result.snapshotIdentity === undefined ||
      item.authority !== "DURABLE_ROLE_SEARCH_EVIDENCE_ONLY" ||
      item.roleCueSemanticAuthority !== false ||
      item.bridgeSignalSubjectIdentityAuthority !== false ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("mechanism exploration role-search observation identity is invalid");
  }
  return value as MechanismPrototypeExplorationRoleSearchObservation;
}

export function buildMechanismPrototypeExplorationFlatSearchObservation(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  capturedAt: string;
  result: MarketCorpusSearchResult;
}>): MechanismPrototypeExplorationFlatSearchObservation {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const result = assertMarketCorpusSearchResult(input.result);
  if (!HASH_PATTERN.test(input.sourceAgentRunId) ||
      input.sourceToolCallId.trim().length < 1 || input.sourceToolCallId.length > 500 ||
      !Number.isFinite(Date.parse(input.capturedAt)) ||
      result.snapshotIdentity !== researchInput.corpusSnapshotIdentity) {
    throw new Error("mechanism exploration flat-search observation lineage is invalid");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-flat-search-observation.v1" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: researchInput.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: input.sourceAgentRunId,
    sourceToolCallId: input.sourceToolCallId,
    capturedAt: input.capturedAt,
    result,
    authority: "DURABLE_FLAT_SEARCH_RETRIEVAL_EVIDENCE_ONLY" as const,
    lexicalHitSemanticAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, observationId: hashCanonical(body) });
}

export function assertMechanismPrototypeExplorationFlatSearchObservation(
  value: unknown,
): MechanismPrototypeExplorationFlatSearchObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration flat-search observation is malformed");
  }
  const item = value as MechanismPrototypeExplorationFlatSearchObservation;
  const { observationId, ...body } = item;
  let result: MarketCorpusSearchResult;
  try { result = assertMarketCorpusSearchResult(item.result); } catch {
    throw new Error("mechanism exploration flat-search observation identity is invalid");
  }
  if (!HASH_PATTERN.test(String(observationId)) || hashCanonical(body) !== observationId ||
      item.schemaVersion !==
        "pmh.mechanism-prototype-exploration-flat-search-observation.v1" ||
      !HASH_PATTERN.test(String(item.lensId)) ||
      !HASH_PATTERN.test(String(item.inputRevisionId)) ||
      !HASH_PATTERN.test(String(item.semanticInputIdentity)) ||
      !HASH_PATTERN.test(String(item.prototypeId)) ||
      !HASH_PATTERN.test(String(item.sourceAgentRunId)) ||
      typeof item.sourceToolCallId !== "string" || item.sourceToolCallId.length < 1 ||
      item.sourceToolCallId.length > 500 || !Number.isFinite(Date.parse(item.capturedAt)) ||
      result.snapshotIdentity === undefined ||
      item.authority !== "DURABLE_FLAT_SEARCH_RETRIEVAL_EVIDENCE_ONLY" ||
      item.lexicalHitSemanticAuthority !== false || item.semanticDecisionAuthority !== false ||
      item.probabilityAuthority !== false || item.certificateAuthority !== false ||
      item.executionAuthority !== false || item.externalWriteAuthority !== false ||
      item.valueMovingAuthority !== false) {
    throw new Error("mechanism exploration flat-search observation identity is invalid");
  }
  return Object.freeze(item);
}

export function buildMechanismPrototypeExplorationActionObservation(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  sourceAgentRunId: Hash;
  sourceToolCallId: string;
  capturedAt: string;
  action: MechanismPrototypeExplorationActionObservation["action"];
  ordinal: number;
  exactText: string;
}>): MechanismPrototypeExplorationActionObservation {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  if (!HASH_PATTERN.test(input.sourceAgentRunId) ||
      input.sourceToolCallId.trim().length < 1 || input.sourceToolCallId.length > 500 ||
      !Number.isFinite(Date.parse(input.capturedAt)) ||
      !Number.isSafeInteger(input.ordinal) || input.ordinal < 1 || input.ordinal > 100 ||
      input.exactText.trim().length < 1 || input.exactText.length > 2_000) {
    throw new Error("mechanism exploration action observation lineage is invalid");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-action-observation.v2" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: researchInput.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: input.sourceAgentRunId,
    sourceToolCallId: input.sourceToolCallId,
    capturedAt: input.capturedAt,
    action: input.action,
    ordinal: input.ordinal,
    exactText: input.exactText,
    authority: "DURABLE_PROTOTYPE_EXPLORATION_ACTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, observationId: hashCanonical(body) });
}

export function assertMechanismPrototypeExplorationActionObservation(
  value: unknown,
): MechanismPrototypeExplorationActionObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration action observation is malformed");
  }
  const item = value as Record<string, unknown>;
  const { observationId, ...body } = item;
  if (!HASH_PATTERN.test(String(observationId)) || hashCanonical(body) !== observationId ||
      !["pmh.mechanism-prototype-exploration-action-observation.v1",
        "pmh.mechanism-prototype-exploration-action-observation.v2"]
        .includes(String(item.schemaVersion)) ||
      !HASH_PATTERN.test(String(item.lensId)) || !HASH_PATTERN.test(String(item.inputRevisionId)) ||
      !HASH_PATTERN.test(String(item.semanticInputIdentity)) ||
      !HASH_PATTERN.test(String(item.prototypeId)) ||
      !HASH_PATTERN.test(String(item.sourceAgentRunId)) ||
      typeof item.sourceToolCallId !== "string" || item.sourceToolCallId.length < 1 ||
      item.sourceToolCallId.length > 500 || typeof item.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(item.capturedAt)) ||
      !["TRANSFER_TEST_APPLIED", "TRANSFER_TEST_FAILED", "COUNTER_SCENARIO_ACTIVATED",
        "COUNTER_SCENARIO_FAILED"]
        .includes(String(item.action)) || !Number.isSafeInteger(item.ordinal) ||
      (item.action === "COUNTER_SCENARIO_FAILED" && item.schemaVersion !==
        "pmh.mechanism-prototype-exploration-action-observation.v2") ||
      Number(item.ordinal) < 1 || typeof item.exactText !== "string" ||
      item.exactText.length < 1 || item.exactText.length > 2_000 ||
      item.authority !== "DURABLE_PROTOTYPE_EXPLORATION_ACTION_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("mechanism exploration action observation identity is invalid");
  }
  return value as MechanismPrototypeExplorationActionObservation;
}

export function buildMechanismPrototypeExplorationStepObservation(input: Readonly<{
  researchInput: MechanismPrototypeExplorationInputRevision;
  effect: AgentToolEffect;
  sourceToolCallId: string;
  readinessAfter: MechanismPrototypeExplorationStepObservation["readinessAfter"];
  resultSummary: MechanismPrototypeExplorationStepObservation["resultSummary"];
  hypothesisEvent?: MechanismPrototypeExplorationStepObservation["hypothesisEvent"];
  hypothesisAfter?: MechanismPrototypeExplorationHypothesis;
}>): MechanismPrototypeExplorationStepObservation {
  const researchInput = assertMechanismPrototypeExplorationInputRevision(input.researchInput);
  const effect = input.effect;
  if (effect.schemaVersion !== "pmh.agent-tool-effect.v3" ||
      effect.runId.trim() === "" || effect.toolName.trim() === "" ||
      input.sourceToolCallId.trim() === "") {
    throw new Error("mechanism exploration step requires an exact V3 effect lineage");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-step-observation.v3" as const,
    lensId: researchInput.lensId,
    inputRevisionId: researchInput.inputRevisionId,
    semanticInputIdentity: researchInput.semanticInputIdentity,
    prototypeId: researchInput.prototypeId,
    axis: researchInput.axis,
    sourceAgentRunId: effect.runId,
    sourceInvocationId: effect.sourceInvocationId,
    sourceEffectId: effect.effectId,
    sourceToolCallId: input.sourceToolCallId,
    effectOrdinal: effect.ordinal,
    toolName: effect.toolName,
    status: effect.status,
    resultSummary: input.resultSummary,
    readinessAfter: Object.freeze({
      ...input.readinessAfter,
      activeHypothesis: input.readinessAfter.activeHypothesis ?? false,
      activeHypothesisTestBinding: input.readinessAfter.activeHypothesisTestBinding ?? null,
      closedHypothesisCount: input.readinessAfter.closedHypothesisCount ?? 0,
      failedCounterScenarioOrdinals:
        input.readinessAfter.failedCounterScenarioOrdinals ?? Object.freeze([]),
    }),
    ...(input.hypothesisEvent === undefined ? {} : {
      hypothesisEvent: input.hypothesisEvent,
      hypothesisAfter: input.hypothesisAfter,
    }),
    observedAt: effect.occurredAt,
    authority: "DURABLE_EXPLORATION_EXPERIMENT_STEP_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertMechanismPrototypeExplorationStepObservation(Object.freeze({
    ...body, observationId: hashCanonical(body),
  }));
}

export function assertMechanismPrototypeExplorationStepObservation(
  value: unknown,
): MechanismPrototypeExplorationStepObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mechanism exploration step observation is malformed");
  }
  const item = value as Readonly<Record<string, unknown>>;
  const { observationId, ...body } = item;
  const readiness = item.readinessAfter as Readonly<Record<string, unknown>> | undefined;
  const summary = item.resultSummary as Readonly<Record<string, unknown>> | undefined;
  const ordinalLists = readiness === undefined ? [] : [
    readiness.appliedTransferTestOrdinals, readiness.failedTransferTestOrdinals,
    readiness.activatedCounterScenarioOrdinals,
    ...(readiness.failedCounterScenarioOrdinals === undefined
      ? [] : [readiness.failedCounterScenarioOrdinals]),
  ];
  if (!HASH_PATTERN.test(String(observationId)) || hashCanonical(body) !== observationId ||
      !["pmh.mechanism-prototype-exploration-step-observation.v1",
        "pmh.mechanism-prototype-exploration-step-observation.v2",
        "pmh.mechanism-prototype-exploration-step-observation.v3"]
        .includes(String(item.schemaVersion)) ||
      !HASH_PATTERN.test(String(item.lensId)) ||
      !HASH_PATTERN.test(String(item.inputRevisionId)) ||
      !HASH_PATTERN.test(String(item.semanticInputIdentity)) ||
      !HASH_PATTERN.test(String(item.prototypeId)) ||
      !HASH_PATTERN.test(String(item.sourceAgentRunId)) ||
      !HASH_PATTERN.test(String(item.sourceInvocationId)) ||
      !HASH_PATTERN.test(String(item.sourceEffectId)) ||
      typeof item.sourceToolCallId !== "string" || item.sourceToolCallId.length < 1 ||
      !Number.isSafeInteger(item.effectOrdinal) || Number(item.effectOrdinal) < 1 ||
      typeof item.toolName !== "string" || item.toolName.length < 1 ||
      !["ACCEPTED", "REJECTED"].includes(String(item.status)) ||
      summary === undefined || ![
        "LENS_READ", "DIALECT_ATLAS_READ", "REPRESENTATION_ROLE_FEEDBACK_READ",
        "DIRECTORY_BROWSE", "FLAT_SEARCH", "ROLE_SEARCH", "INSPECTION",
        "PROTOTYPE_ACTION", "POSITIVE_TERMINAL", "EXHAUSTION_TERMINAL",
        "HYPOTHESIS_ACTION", "OTHER",
      ].includes(String(summary.kind)) || [
        summary.rawHitCount, summary.qualifiedHitCount, summary.pairCount,
        summary.inspectedListingCount, summary.acceptedActionCount,
        summary.acceptedTerminalCount,
      ].some((count) => !Number.isSafeInteger(count) || Number(count) < 0) ||
      readiness === undefined || typeof readiness.positiveEligible !== "boolean" ||
      !Array.isArray(readiness.positiveMissingPrerequisites) ||
      typeof readiness.exhaustionEligible !== "boolean" ||
      !Array.isArray(readiness.exhaustionMissingPrerequisites) ||
      [readiness.searchedResultCount, readiness.roleSearchResultCount,
        readiness.rolePairCount, readiness.inspectedListingCount,
        readiness.inspectedRolePairCount].some((count) =>
        !Number.isSafeInteger(count) || Number(count) < 0
      ) || ordinalLists.some((list) => !Array.isArray(list) || list.some((ordinal) =>
        !Number.isSafeInteger(ordinal) || Number(ordinal) < 1
      )) || typeof item.observedAt !== "string" ||
      !Number.isFinite(Date.parse(item.observedAt)) ||
      item.authority !== "DURABLE_EXPLORATION_EXPERIMENT_STEP_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("mechanism exploration step observation identity is invalid");
  }
  if (["pmh.mechanism-prototype-exploration-step-observation.v2",
    "pmh.mechanism-prototype-exploration-step-observation.v3"].includes(
      String(item.schemaVersion)
    ) &&
      (typeof readiness?.activeHypothesis !== "boolean" ||
       !Number.isSafeInteger(readiness.closedHypothesisCount) ||
       Number(readiness.closedHypothesisCount) < 0 ||
       (item.hypothesisEvent === undefined) !== (item.hypothesisAfter === undefined) ||
       (item.hypothesisEvent !== undefined &&
        !["OPENED", "REVISED", "CLOSED"].includes(String(item.hypothesisEvent))))) {
    throw new Error("mechanism exploration V2 hypothesis step is invalid");
  }
  if (item.schemaVersion === "pmh.mechanism-prototype-exploration-step-observation.v3") {
    const activeBinding = readiness?.activeHypothesisTestBinding;
    if ((readiness?.activeHypothesis === true) !== (activeBinding !== null) ||
        (activeBinding !== null && (typeof activeBinding !== "object" ||
          Array.isArray(activeBinding) ||
          !["TRANSFER_TEST", "COUNTER_SCENARIO"].includes(String(
            (activeBinding as Readonly<Record<string, unknown>>).kind
          )) || typeof (activeBinding as Readonly<Record<string, unknown>>).handle !== "string" ||
          String((activeBinding as Readonly<Record<string, unknown>>).handle).length < 1))) {
      throw new Error("mechanism exploration V3 active hypothesis binding is invalid");
    }
  }
  if (item.hypothesisAfter !== undefined) {
    assertMechanismPrototypeExplorationHypothesis(item.hypothesisAfter);
  }
  return value as MechanismPrototypeExplorationStepObservation;
}

export function compileMechanismPrototypeExplorationExperimentEpisodes(input: Readonly<{
  inputs: readonly MechanismPrototypeExplorationInputRevision[];
  stepObservations: readonly MechanismPrototypeExplorationStepObservation[];
  execution: AgentExecutionSnapshot;
}>): readonly MechanismPrototypeExplorationExperimentEpisode[] {
  const inputs = new Map(input.inputs.map((item) => {
    const validated = assertMechanismPrototypeExplorationInputRevision(item);
    return [validated.inputRevisionId, validated] as const;
  }));
  const steps = input.stepObservations.map(
    assertMechanismPrototypeExplorationStepObservation,
  );
  const effectsByRun = new Map<string, AgentToolEffect[]>();
  for (const effect of input.execution.toolEffects) {
    const retained = effectsByRun.get(effect.runId) ?? [];
    retained.push(effect);
    effectsByRun.set(effect.runId, retained);
  }
  const invocationsById = new Map(input.execution.modelInvocations.map((item) =>
    [item.invocationId, item] as const
  ));
  const invocationsByRun = new Map<string, typeof input.execution.modelInvocations[number][]>();
  for (const invocation of input.execution.modelInvocations) {
    const retained = invocationsByRun.get(invocation.runId) ?? [];
    retained.push(invocation);
    invocationsByRun.set(invocation.runId, retained);
  }
  const stepsByRun = new Map<string, MechanismPrototypeExplorationStepObservation[]>();
  for (const step of steps) {
    const retained = stepsByRun.get(step.sourceAgentRunId) ?? [];
    retained.push(step);
    stepsByRun.set(step.sourceAgentRunId, retained);
  }
  const episodes = input.execution.runs.flatMap((run) => {
    if (run.status === "PREPARED" || run.completedAt === null) return [];
    const runSteps = [...(stepsByRun.get(run.runId) ?? [])]
      .sort((left, right) => left.effectOrdinal - right.effectOrdinal);
    if (runSteps.length === 0) return [];
    const first = runSteps[0]!;
    const researchInput = inputs.get(first.inputRevisionId);
    if (researchInput === undefined || runSteps.some((step) =>
      step.inputRevisionId !== first.inputRevisionId ||
      step.lensId !== first.lensId || step.prototypeId !== first.prototypeId ||
      step.semanticInputIdentity !== first.semanticInputIdentity || step.axis !== first.axis
    )) throw new Error("mechanism exploration episode crosses input lineage");
    const effects = [...(effectsByRun.get(run.runId) ?? [])]
      .sort((left, right) => left.ordinal - right.ordinal);
    const effectById = new Map(effects.map((effect) => [effect.effectId, effect] as const));
    const ordinals = new Set<number>();
    let priorReadiness: MechanismPrototypeExplorationStepObservation["readinessAfter"] |
      null = null;
    const episodeSteps = Object.freeze(runSteps.map((step) => {
      const effect = effectById.get(step.sourceEffectId);
      const invocation = invocationsById.get(step.sourceInvocationId);
      if (effect === undefined || invocation === undefined ||
          effect.runId !== run.runId || effect.ordinal !== step.effectOrdinal ||
          effect.toolName !== step.toolName || effect.status !== step.status ||
          effect.schemaVersion !== "pmh.agent-tool-effect.v3" ||
          effect.sourceInvocationId !== invocation.invocationId ||
          invocation.runId !== run.runId || ordinals.has(step.effectOrdinal)) {
        throw new Error("mechanism exploration episode step lineage is inconsistent");
      }
      ordinals.add(step.effectOrdinal);
      const before = priorReadiness;
      const after = step.readinessAfter;
      const compiled = Object.freeze({
        effectOrdinal: step.effectOrdinal,
        sourceEffectId: step.sourceEffectId,
        sourceInvocationId: step.sourceInvocationId,
        invocationOrdinal: invocation.ordinal,
        invocationPurpose: invocation.schemaVersion === "pmh.model-invocation.v3" ||
            invocation.schemaVersion === "pmh.model-invocation.v4"
          ? invocation.purpose : "HISTORICAL_UNCLASSIFIED" as const,
        invocationStatus: invocation.status,
        inputTokens: invocation.inputTokens,
        outputTokens: invocation.outputTokens,
        reasoningTokens: invocation.reasoningTokens,
        toolName: step.toolName,
        effectStatus: step.status,
        resultSummary: step.resultSummary,
        readinessBefore: before,
        readinessAfter: after,
        positiveBecameEligible: after.positiveEligible && !(before?.positiveEligible ?? false),
        exhaustionBecameEligible: after.exhaustionEligible &&
          !(before?.exhaustionEligible ?? false),
        ...(step.hypothesisEvent === undefined ? {} : {
          hypothesisEvent: step.hypothesisEvent,
          hypothesisAfter: step.hypothesisAfter,
        }),
      });
      priorReadiness = after;
      return compiled;
    }));
    const runInvocations = [...(invocationsByRun.get(run.runId) ?? [])]
      .sort((left, right) => left.ordinal - right.ordinal);
    const tokenSum = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
      runInvocations.reduce((total, item) => total + BigInt(item[key] ?? "0"), 0n)
        .toString();
    const exactEffectLedger = effects.length === episodeSteps.length && effects.every(
      (effect, index) => effect.effectId === episodeSteps[index]?.sourceEffectId,
    );
    const positiveTerminal = episodeSteps.some((step) =>
      step.effectStatus === "ACCEPTED" && step.resultSummary.kind === "POSITIVE_TERMINAL"
    );
    const exhaustionTerminal = episodeSteps.some((step) =>
      step.effectStatus === "ACCEPTED" && step.resultSummary.kind === "EXHAUSTION_TERMINAL"
    );
    if (positiveTerminal && exhaustionTerminal) {
      throw new Error("mechanism exploration episode has competing accepted terminals");
    }
    const hypothesisRevisions = episodeSteps.flatMap((step) =>
      step.hypothesisAfter === undefined ? [] : [Object.freeze({
        effectOrdinal: step.effectOrdinal, hypothesis: step.hypothesisAfter,
      })]
    );
    const hypotheses = Object.freeze([...new Set(hypothesisRevisions.map((item) =>
      item.hypothesis.hypothesisId
    ))].map((hypothesisId) => {
      const history = hypothesisRevisions.filter((item) =>
        item.hypothesis.hypothesisId === hypothesisId
      );
      const revisions = Object.freeze(history.map((item) => item.hypothesis));
      const final = revisions.at(-1)!;
      if (history.some((item, index) => item.hypothesis.revision !== index + 1) ||
          history[0]?.hypothesis.status !== "ACTIVE" ||
          (final.status === "CLOSED" && final.disposition === null)) {
        throw new Error("mechanism exploration hypothesis lifecycle is inconsistent");
      }
      return Object.freeze({ hypothesisId, revisions, final,
        openedEffectOrdinal: history[0]!.effectOrdinal,
        closedEffectOrdinal: final.status === "CLOSED"
          ? history.at(-1)!.effectOrdinal : null });
    }));
    const episodeSchemaVersion = hypotheses.length === 0
      ? "pmh.mechanism-prototype-exploration-experiment-episode.v1" as const
      : "pmh.mechanism-prototype-exploration-experiment-episode.v2" as const;
    const body = Object.freeze({
      schemaVersion: episodeSchemaVersion,
      lensId: first.lensId,
      inputRevisionId: first.inputRevisionId,
      semanticInputIdentity: first.semanticInputIdentity,
      prototypeId: first.prototypeId,
      axis: first.axis,
      sourceAgentRunId: run.runId,
      taskId: run.taskId,
      runStatus: run.status,
      completedAt: run.completedAt,
      ledgerCompleteness: exactEffectLedger
        ? "COMPLETE_EFFECT_LEDGER" as const : "PARTIAL_EFFECT_LEDGER" as const,
      terminalOutcome: positiveTerminal ? "TRAILHEAD" as const
        : exhaustionTerminal ? "EXHAUSTION" as const : "NO_ACCEPTED_TERMINAL" as const,
      firstPositiveEligibleEffectOrdinal: episodeSteps.find((step) =>
        step.positiveBecameEligible
      )?.effectOrdinal ?? null,
      firstExhaustionEligibleEffectOrdinal: episodeSteps.find((step) =>
        step.exhaustionBecameEligible
      )?.effectOrdinal ?? null,
      steps: episodeSteps,
      ...(hypotheses.length === 0 ? {} : { hypotheses }),
      yield: Object.freeze({
        effectCount: episodeSteps.length,
        acceptedEffectCount: episodeSteps.filter((step) =>
          step.effectStatus === "ACCEPTED").length,
        rejectedEffectCount: episodeSteps.filter((step) =>
          step.effectStatus === "REJECTED").length,
        searchEffectCount: episodeSteps.filter((step) =>
          step.resultSummary.kind === "FLAT_SEARCH" ||
          step.resultSummary.kind === "ROLE_SEARCH").length,
        rawHitCount: episodeSteps.reduce((total, step) =>
          total + step.resultSummary.rawHitCount, 0),
        qualifiedHitCount: episodeSteps.reduce((total, step) =>
          total + step.resultSummary.qualifiedHitCount, 0),
        rolePairCount: episodeSteps.reduce((total, step) =>
          total + step.resultSummary.pairCount, 0),
        inspectedListingCount: episodeSteps.reduce((total, step) =>
          total + step.resultSummary.inspectedListingCount, 0),
        acceptedActionCount: episodeSteps.reduce((total, step) =>
          total + step.resultSummary.acceptedActionCount, 0),
      }),
      usage: Object.freeze({
        invocationCount: runInvocations.length,
        knownInputTokens: tokenSum("inputTokens"),
        knownOutputTokens: tokenSum("outputTokens"),
        knownReasoningTokens: tokenSum("reasoningTokens"),
        unknownUsageInvocationCount: runInvocations.filter((item) =>
          item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
        ).length,
      }),
      authority: "PROVIDER_FREE_EXPLORATION_EXPERIMENT_MEMORY_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return [Object.freeze({ ...body, episodeId: hashCanonical(body) })];
  });
  return Object.freeze(episodes.sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt) ||
    left.episodeId.localeCompare(right.episodeId)
  ));
}

export function buildMechanismPrototypeExplorationMemoryProjection(input: Readonly<{
  inputs: readonly MechanismPrototypeExplorationInputRevision[];
  stepObservations: readonly MechanismPrototypeExplorationStepObservation[];
  roleSearchObservations?: readonly MechanismPrototypeExplorationRoleSearchObservation[];
  flatSearchObservations?: readonly MechanismPrototypeExplorationFlatSearchObservation[];
  execution: AgentExecutionSnapshot;
  episodeLimit?: number;
}>): MechanismPrototypeExplorationMemoryProjection {
  const retainedInputs = input.inputs.map(
    assertMechanismPrototypeExplorationInputRevision,
  );
  const retainedSteps = input.stepObservations.map(
    assertMechanismPrototypeExplorationStepObservation,
  );
  const retainedRoleSearchObservations = (input.roleSearchObservations ?? []).map(
    assertMechanismPrototypeExplorationRoleSearchObservation,
  );
  const retainedFlatSearchObservations = (input.flatSearchObservations ?? []).map(
    assertMechanismPrototypeExplorationFlatSearchObservation,
  );
  const episodeLimit = input.episodeLimit ?? 32;
  if (!Number.isSafeInteger(episodeLimit) || episodeLimit < 1 || episodeLimit > 512) {
    throw new Error("mechanism exploration memory episode limit is invalid");
  }
  const episodes = compileMechanismPrototypeExplorationExperimentEpisodes({
    inputs: retainedInputs,
    stepObservations: retainedSteps,
    execution: input.execution,
  }).slice(0, episodeLimit);
  const familyMembers = episodes.flatMap((episode) => (episode.hypotheses ?? [])
    .flatMap((hypothesis) => hypothesis.final.status !== "CLOSED" ||
        hypothesis.final.disposition === null ? [] : [Object.freeze({ episode, hypothesis })]));
  const familyKeys = [...new Set(familyMembers.map(({ episode, hypothesis }) =>
    hashCanonical(Object.freeze({
      schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-family-identity.v1",
      prototypeId: episode.prototypeId, axis: episode.axis,
      testBinding: hypothesis.final.testBinding,
    }))
  ))];
  const hypothesisFamilies: readonly MechanismPrototypeExplorationHypothesisFamily[] =
    Object.freeze(familyKeys.map((familyId) => {
      const members = familyMembers.filter(({ episode, hypothesis }) => hashCanonical(
        Object.freeze({
          schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-family-identity.v1",
          prototypeId: episode.prototypeId, axis: episode.axis,
          testBinding: hypothesis.final.testBinding,
        })) === familyId);
      const first = members[0]!;
      const spans = members.map(({ episode, hypothesis }) => {
        const steps = episode.steps.filter((step) =>
          step.effectOrdinal >= hypothesis.openedEffectOrdinal &&
          step.effectOrdinal <= (hypothesis.closedEffectOrdinal ?? step.effectOrdinal)
        );
        const invocationIds = new Set(steps.map((step) => step.sourceInvocationId));
        const uniqueInvocationSteps = steps.filter((step) => {
          if (!invocationIds.has(step.sourceInvocationId)) return false;
          invocationIds.delete(step.sourceInvocationId);
          return true;
        });
        return Object.freeze({ steps, invocations: uniqueInvocationSteps });
      });
      const dispositions = members.map(({ hypothesis }) => hypothesis.final.disposition!);
      const count = (value: typeof dispositions[number]) =>
        dispositions.filter((item) => item === value).length;
      const dispositionCounts = Object.freeze({ SUPPORTED: count("SUPPORTED"),
        WEAKENED: count("WEAKENED"), FALSIFIED: count("FALSIFIED"),
        UNRESOLVED: count("UNRESOLVED") });
      const sumTokens = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
        spans.flatMap((span) => span.invocations).reduce((total, step) =>
          total + BigInt(step[key] ?? "0"), 0n).toString();
      const body = Object.freeze({
        schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-family.v1" as const,
        familyId, prototypeId: first.episode.prototypeId, axis: first.episode.axis,
        testBinding: first.hypothesis.final.testBinding,
        hypothesisCount: members.length,
        distinctRunCount: new Set(members.map(({ episode }) => episode.sourceAgentRunId)).size,
        distinctSemanticInputCount: new Set(members.map(({ episode }) =>
          episode.semanticInputIdentity)).size,
        dispositionCounts,
        selectionSignal: members.length === 1 ? "FIRST_OBSERVATION" as const
          : dispositionCounts.FALSIFIED === members.length
            ? "REPLICATED_FALSIFICATION" as const
            : dispositionCounts.SUPPORTED + dispositionCounts.WEAKENED > 0 &&
                dispositionCounts.FALSIFIED > 0
              ? "MIXED_EVIDENCE" as const : "REPLICATION_YIELD" as const,
        recentExemplars: Object.freeze(members.slice(0, 4).map(({ hypothesis }) =>
          Object.freeze({ hypothesisId: hypothesis.hypothesisId,
            materialVariation: hypothesis.final.materialVariation,
            disposition: hypothesis.final.disposition!,
            falsifyingObservation: hypothesis.final.falsifyingObservation }))
        ),
        yield: Object.freeze({
          effectCount: spans.reduce((n, span) => n + span.steps.length, 0),
          searchEffectCount: spans.reduce((n, span) => n + span.steps.filter((step) =>
            step.resultSummary.kind === "FLAT_SEARCH" ||
            step.resultSummary.kind === "ROLE_SEARCH").length, 0),
          rawHitCount: spans.flatMap((span) => span.steps).reduce((n, step) =>
            n + step.resultSummary.rawHitCount, 0),
          qualifiedHitCount: spans.flatMap((span) => span.steps).reduce((n, step) =>
            n + step.resultSummary.qualifiedHitCount, 0),
          rolePairCount: spans.flatMap((span) => span.steps).reduce((n, step) =>
            n + step.resultSummary.pairCount, 0),
          inspectedListingCount: spans.flatMap((span) => span.steps).reduce((n, step) =>
            n + step.resultSummary.inspectedListingCount, 0),
        }),
        usage: Object.freeze({
          invocationCount: spans.reduce((n, span) => n + span.invocations.length, 0),
          knownInputTokens: sumTokens("inputTokens"),
          knownOutputTokens: sumTokens("outputTokens"),
          knownReasoningTokens: sumTokens("reasoningTokens"),
          unknownUsageInvocationCount: spans.flatMap((span) => span.invocations)
            .filter((step) => step.inputTokens === null || step.outputTokens === null ||
              step.reasoningTokens === null).length,
        }),
        identityBasis: "EXACT_PROTOTYPE_AXIS_AND_TEST_BINDING" as const,
        proseSimilarityUsed: false as const, schedulingAuthority: false as const,
        semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
        executionAuthority: false as const, externalWriteAuthority: false as const,
        valueMovingAuthority: false as const,
      });
      return body;
    }).sort((left, right) => right.hypothesisCount - left.hypothesisCount ||
      left.familyId.localeCompare(right.familyId)));
  const familyIdOf = (episode: MechanismPrototypeExplorationExperimentEpisode,
    hypothesis: NonNullable<MechanismPrototypeExplorationExperimentEpisode["hypotheses"]>[number]) =>
    hashCanonical(Object.freeze({
      schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-family-identity.v1",
      prototypeId: episode.prototypeId, axis: episode.axis,
      testBinding: hypothesis.final.testBinding,
    }));
  const exactCoordinates = (member: typeof familyMembers[number]) => {
    const end = member.hypothesis.closedEffectOrdinal ?? member.hypothesis.openedEffectOrdinal;
    const callIds = new Set(retainedSteps.filter((step) =>
      step.sourceAgentRunId === member.episode.sourceAgentRunId &&
      step.effectOrdinal >= member.hypothesis.openedEffectOrdinal && step.effectOrdinal <= end
    ).map((step) => step.sourceToolCallId));
    const observations = retainedRoleSearchObservations.filter((observation) =>
      observation.sourceAgentRunId === member.episode.sourceAgentRunId &&
      callIds.has(observation.sourceToolCallId)
    );
    const flatObservations = retainedFlatSearchObservations.filter((observation) =>
      observation.sourceAgentRunId === member.episode.sourceAgentRunId &&
      callIds.has(observation.sourceToolCallId)
    );
    const listingRefs = [...new Set(observations.flatMap((observation) => [
      ...observation.result.componentHits.map((hit) => hit.listingRef),
      ...observation.result.aggregateHits.map((hit) => hit.listingRef),
    ]))].sort();
    const pairRefs = [...new Set(observations.flatMap((observation) =>
      observation.result.pairs.map((pair) =>
        `${pair.componentListingRef}\u0000${pair.aggregateListingRef}`
      )))].sort();
    const lexicalRetrievalListingRefs = [...new Set(flatObservations.flatMap((observation) =>
      observation.result.hits.map((hit) => hit.listingRef)
    ))].sort();
    const steps = member.episode.steps.filter((step) =>
      step.effectOrdinal >= member.hypothesis.openedEffectOrdinal &&
      step.effectOrdinal <= end
    );
    const invocations = [...new Map(steps.map((step) =>
      [step.sourceInvocationId, step] as const
    )).values()];
    const sumTokens = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
      invocations.reduce((total, step) => total + BigInt(step[key] ?? "0"), 0n).toString();
    return Object.freeze({ observations, flatObservations, listingRefs,
      lexicalRetrievalListingRefs, pairRefs, steps, invocations,
      usage: Object.freeze({ invocationCount: invocations.length,
        knownInputTokens: sumTokens("inputTokens"), knownOutputTokens: sumTokens("outputTokens"),
        knownReasoningTokens: sumTokens("reasoningTokens"),
        unknownUsageInvocationCount: invocations.filter((step) => step.inputTokens === null ||
          step.outputTokens === null || step.reasoningTokens === null).length }),
      yield: Object.freeze({ effectCount: steps.length,
        searchEffectCount: steps.filter((step) => step.resultSummary.kind === "FLAT_SEARCH" ||
          step.resultSummary.kind === "ROLE_SEARCH").length,
        rawHitCount: steps.reduce((sum, step) => sum + step.resultSummary.rawHitCount, 0),
        qualifiedHitCount: steps.reduce((sum, step) =>
          sum + step.resultSummary.qualifiedHitCount, 0),
        rolePairCount: steps.reduce((sum, step) => sum + step.resultSummary.pairCount, 0),
        inspectedListingCount: steps.reduce((sum, step) =>
          sum + step.resultSummary.inspectedListingCount, 0) }),
    });
  };
  const hypothesisIntentRealizations = Object.freeze(familyMembers.flatMap((member) => {
    const hypothesis = member.hypothesis.final;
    if (!["pmh.mechanism-prototype-exploration-hypothesis.v2",
      "pmh.mechanism-prototype-exploration-hypothesis.v3"]
      .includes(hypothesis.schemaVersion) ||
        hypothesis.familyIntent === undefined) return [];
    const currentFamilyId = familyIdOf(member.episode, member.hypothesis);
    const referenceMembers = familyMembers.filter((candidate) => {
      if (candidate.hypothesis.hypothesisId === member.hypothesis.hypothesisId) return false;
      if (candidate.episode.completedAt >= member.episode.completedAt) return false;
      const candidateFamilyId = familyIdOf(candidate.episode, candidate.hypothesis);
      return hypothesis.familyIntent === "DIFFERENT_TEST"
        ? candidate.episode.prototypeId === member.episode.prototypeId &&
          candidate.episode.axis === member.episode.axis && candidateFamilyId !== currentFamilyId
        : candidateFamilyId === hypothesis.priorFamilyId;
    });
    const current = exactCoordinates(member);
    const references = referenceMembers.map(exactCoordinates);
    const referenceListingRefs = new Set(references.flatMap((item) => item.listingRefs));
    const referenceLexicalRetrievalListingRefs = new Set(references.flatMap((item) =>
      item.lexicalRetrievalListingRefs
    ));
    const referencePairRefs = new Set(references.flatMap((item) => item.pairRefs));
    const overlappingListingRefCount = current.listingRefs.filter((ref) =>
      referenceListingRefs.has(ref)).length;
    const newListingRefCount = current.listingRefs.length - overlappingListingRefCount;
    const overlappingLexicalRetrievalListingRefCount =
      current.lexicalRetrievalListingRefs.filter((ref) =>
        referenceLexicalRetrievalListingRefs.has(ref)).length;
    const newLexicalRetrievalListingRefCount = current.lexicalRetrievalListingRefs.length -
      overlappingLexicalRetrievalListingRefCount;
    const overlappingPairRefCount = current.pairRefs.filter((ref) =>
      referencePairRefs.has(ref)).length;
    const newPairRefCount = current.pairRefs.length - overlappingPairRefCount;
    const independentSemanticInput = referenceMembers.length > 0 && referenceMembers.every(
      (candidate) => candidate.episode.semanticInputIdentity !==
        member.episode.semanticInputIdentity,
    );
    const independentRun = referenceMembers.length > 0 && referenceMembers.every((candidate) =>
      candidate.episode.sourceAgentRunId !== member.episode.sourceAgentRunId
    );
    const comparable = referenceMembers.length > 0 &&
      current.observations.length + current.flatObservations.length > 0 &&
      references.some((item) => item.observations.length + item.flatObservations.length > 0);
    const realizedClassification =
      classifyMechanismPrototypeExplorationHypothesisIntentRealization({
        declaredIntent: hypothesis.familyIntent, comparable,
        independentSemanticInput, independentRun, newListingRefCount, newPairRefCount,
      });
    const referenceFamilyIds = new Set(referenceMembers.map((candidate) =>
      familyIdOf(candidate.episode, candidate.hypothesis)));
    const body = Object.freeze({
      schemaVersion: "pmh.mechanism-prototype-exploration-hypothesis-intent-realization.v2" as const,
      hypothesisId: member.hypothesis.hypothesisId, episodeId: member.episode.episodeId,
      episodeCompletedAt: member.episode.completedAt, runStatus: member.episode.runStatus,
      terminalOutcome: member.episode.terminalOutcome,
      prototypeId: member.episode.prototypeId, axis: member.episode.axis,
      declaredIntent: hypothesis.familyIntent,
      declaredPriorFamilyId: hypothesis.priorFamilyId ?? null,
      realizedClassification,
      comparisonBasis: hypothesis.familyIntent === "DIFFERENT_TEST"
        ? "SIBLING_EXACT_TEST_FAMILIES" as const
        : hypothesis.priorFamilyId === null ? "NONE" as const
          : "DECLARED_PRIOR_FAMILY" as const,
      referenceFamilyCount: referenceFamilyIds.size,
      current: Object.freeze({ semanticInputIdentity: member.episode.semanticInputIdentity,
        sourceAgentRunId: member.episode.sourceAgentRunId,
        roleSearchObservationCount: current.observations.length,
        flatSearchObservationCount: current.flatObservations.length,
        listingRefCount: current.listingRefs.length, pairRefCount: current.pairRefs.length,
        lexicalRetrievalListingRefCount: current.lexicalRetrievalListingRefs.length,
        listingSetHash: hashCanonical(current.listingRefs),
        lexicalRetrievalListingSetHash: hashCanonical(current.lexicalRetrievalListingRefs),
        pairSetHash: hashCanonical(current.pairRefs) }),
      comparison: Object.freeze({ referenceHypothesisCount: referenceMembers.length,
        referenceSemanticInputCount: new Set(referenceMembers.map((candidate) =>
          candidate.episode.semanticInputIdentity)).size,
        referenceRunCount: new Set(referenceMembers.map((candidate) =>
          candidate.episode.sourceAgentRunId)).size,
        referenceListingRefCount: referenceListingRefs.size,
        referenceLexicalRetrievalListingRefCount: referenceLexicalRetrievalListingRefs.size,
        referencePairRefCount: referencePairRefs.size,
        overlappingListingRefCount, newListingRefCount,
        overlappingLexicalRetrievalListingRefCount, newLexicalRetrievalListingRefCount,
        overlappingPairRefCount, newPairRefCount,
        independentSemanticInput, independentRun }),
      yield: current.yield, usage: current.usage,
      lexicalRetrievalPosture:
        "FLAT_SEARCH_HITS_ARE_RETRIEVAL_COORDINATES_NOT_SEMANTIC_FRONTIER_EVIDENCE" as const,
      identityBasis:
        "EXACT_EFFECT_WINDOW_AND_DURABLE_ROLE_AND_FLAT_SEARCH_COORDINATES" as const,
      proseSimilarityUsed: false as const, schedulingAuthority: false as const,
      semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
      executionAuthority: false as const, externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return [Object.freeze({ ...body, reportId: hashCanonical(body) })];
  }).sort((left, right) => right.episodeCompletedAt.localeCompare(left.episodeCompletedAt) ||
    left.reportId.localeCompare(right.reportId)));
  const hypothesisIntentAttentionPortfolio =
    buildMechanismPrototypeExplorationHypothesisIntentAttentionPortfolio({
      reports: hypothesisIntentRealizations,
      episodes,
    });
  const sum = (key: "knownInputTokens" | "knownOutputTokens" |
    "knownReasoningTokens") => episodes.reduce((total, episode) =>
      total + BigInt(episode.usage[key]), 0n
    ).toString();
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-memory-projection.v5" as const,
    retainedInputCount: retainedInputs.length,
    retainedStepCount: retainedSteps.length,
    episodeCount: episodes.length,
    completeEpisodeCount: episodes.filter((episode) =>
      episode.ledgerCompleteness === "COMPLETE_EFFECT_LEDGER"
    ).length,
    interruptedOrFailedEpisodeCount: episodes.filter((episode) =>
      episode.runStatus !== "SUCCEEDED"
    ).length,
    terminalOutcomeCounts: Object.freeze({
      trailhead: episodes.filter((episode) => episode.terminalOutcome === "TRAILHEAD").length,
      exhaustion: episodes.filter((episode) => episode.terminalOutcome === "EXHAUSTION").length,
      noAcceptedTerminal: episodes.filter((episode) =>
        episode.terminalOutcome === "NO_ACCEPTED_TERMINAL"
      ).length,
    }),
    usage: Object.freeze({
      invocationCount: episodes.reduce((total, episode) =>
        total + episode.usage.invocationCount, 0),
      knownInputTokens: sum("knownInputTokens"),
      knownOutputTokens: sum("knownOutputTokens"),
      knownReasoningTokens: sum("knownReasoningTokens"),
      unknownUsageInvocationCount: episodes.reduce((total, episode) =>
        total + episode.usage.unknownUsageInvocationCount, 0),
    }),
    episodes,
    hypothesisFamilyCount: hypothesisFamilies.length,
    hypothesisFamilies,
    hypothesisIntentRealizationCount: hypothesisIntentRealizations.length,
    hypothesisIntentRealizations,
    hypothesisIntentAttentionPortfolio,
    currentCorpusAuthority: false as const,
    currentEligibilityAuthority: false as const,
    campaignAuthority: false as const,
    automaticDispatch: false as const,
    effects: Object.freeze({
      providerRequests: 0 as const,
      modelInvocations: 0 as const,
      tasks: 0 as const,
      campaigns: 0 as const,
      dispatches: 0 as const,
      writes: 0 as const,
      externalWrites: 0 as const,
      valueMovingActions: 0 as const,
    }),
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}

export function mechanismPrototypeExplorationUsage(input: Readonly<{
  lensId: Hash;
  trailheads: readonly MechanismPrototypeExplorationTrailhead[];
  exhaustions: readonly MechanismPrototypeExplorationExhaustion[];
  roleSearchObservations?: readonly MechanismPrototypeExplorationRoleSearchObservation[];
  actionObservations?: readonly MechanismPrototypeExplorationActionObservation[];
  execution: AgentExecutionSnapshot;
}>): MechanismPrototypeExplorationUsage {
  const observations = (input.roleSearchObservations ?? [])
    .map(assertMechanismPrototypeExplorationRoleSearchObservation)
    .filter((item) => item.lensId === input.lensId);
  const actionObservations = (input.actionObservations ?? [])
    .map(assertMechanismPrototypeExplorationActionObservation)
    .filter((item) => item.lensId === input.lensId);
  const sourceRunIds = exactHashes([
    ...input.trailheads.filter((item) => item.lensId === input.lensId)
      .map((item) => item.sourceAgentRunId),
    ...input.exhaustions.filter((item) => item.lensId === input.lensId)
      .map((item) => item.sourceAgentRunId),
    ...observations.map((item) => item.sourceAgentRunId),
    ...actionObservations.map((item) => item.sourceAgentRunId),
  ]);
  const runIds = new Set(sourceRunIds);
  const invocations = input.execution.modelInvocations.filter((item) =>
    runIds.has(item.runId)
  );
  const repairInvocations = invocations.filter((item) =>
    (item.schemaVersion === "pmh.model-invocation.v3" ||
      item.schemaVersion === "pmh.model-invocation.v4") &&
    item.purpose === "RESULT_REPAIR"
  );
  const sum = (key: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, item) => total + BigInt(item[key] ?? "0"), 0n).toString();
  const trailheads = input.trailheads.filter((item) => item.lensId === input.lensId);
  const exhaustions = input.exhaustions.filter((item) => item.lensId === input.lensId);
  const summaries = [
    ...observations.map((item) => ({
      resultIdentity: item.result.resultIdentity,
      rawComponentHitCount: item.result.rawComponentHitCount,
      rawAggregateHitCount: item.result.rawAggregateHitCount,
      qualifiedComponentHitCount: item.result.componentHits.length,
      qualifiedAggregateHitCount: item.result.aggregateHits.length,
      pairCount: item.result.pairCount,
    })),
    ...trailheads.flatMap((item) => item.roleSearchBinding === undefined ? [] : [{
      resultIdentity: item.roleSearchBinding.resultIdentity,
      rawComponentHitCount: item.roleSearchBinding.rawComponentHitCount,
      rawAggregateHitCount: item.roleSearchBinding.rawAggregateHitCount,
      qualifiedComponentHitCount: item.roleSearchBinding.qualifiedComponentHitCount,
      qualifiedAggregateHitCount: item.roleSearchBinding.qualifiedAggregateHitCount,
      pairCount: item.roleSearchBinding.pairCount,
    }]),
    ...exhaustions.flatMap((item) => item.roleSearchSummaries ?? []),
  ];
  const uniqueSummaries = [...new Map(summaries.map((item) =>
    [item.resultIdentity, item] as const
  )).values()];
  return Object.freeze({
    sourceRunIds,
    modelInvocationCount: invocations.length,
    knownInputTokens: sum("inputTokens"),
    knownOutputTokens: sum("outputTokens"),
    knownReasoningTokens: sum("reasoningTokens"),
    unknownUsageInvocationCount: invocations.filter((item) =>
      item.inputTokens === null || item.outputTokens === null || item.reasoningTokens === null
    ).length,
    roleSearchResultCount: uniqueSummaries.length,
    roleSearchRawHitCount: uniqueSummaries.reduce((total, item) => total +
      item.rawComponentHitCount + item.rawAggregateHitCount, 0),
    roleSearchQualifiedHitCount: uniqueSummaries.reduce((total, item) => total +
      item.qualifiedComponentHitCount + item.qualifiedAggregateHitCount, 0),
    roleSearchPairCount: uniqueSummaries.reduce((total, item) => total + item.pairCount, 0),
    inspectedEvidenceBindingCount: trailheads.reduce((total, item) =>
      total + item.evidenceBindings.length, 0) + exhaustions.reduce((total, item) =>
      total + item.inspectedEvidenceBindings.length, 0),
    roleBoundTrailheadCount: trailheads.filter((item) =>
      item.roleSearchBinding !== undefined
    ).length,
    roleAwareExhaustionCount: exhaustions.filter((item) =>
      (item.roleSearchSummaries?.length ?? 0) > 0
    ).length,
    retainedActionObservationCount: actionObservations.length,
    resultRepairInvocationCount: repairInvocations.length,
    resultRepairInputTokens: repairInvocations.reduce((total, item) =>
      total + BigInt(item.inputTokens ?? "0"), 0n).toString(),
  });
}
