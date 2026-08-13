import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertMarketCorpusSnapshot,
  searchMarketCorpus,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import {
  assertRelationDiscoveryFinding,
  ontologyRouteListingEvidenceHash,
  type RelationDiscoveryFinding,
  type RelationDiscoveryRouteLayer,
} from "./relation-discovery-agent-tools.js";
import {
  assertRelationDiscoveryTaskRevision,
  relationDiscoveryRevisionWorkItem,
  type RelationDiscoveryTaskRevision,
} from "./relation-discovery-work.js";
import {
  assertMarketOntologySnapshot,
  type MarketOntologyListingNode,
  type MarketOntologySnapshot,
} from "./market-ontology.js";
import {
  assertOntologyRelationWorkItem,
  extendOntologyRelationWorkProjection,
  type OntologyRelationWorkItem,
  type OntologyRelationWorkProjection,
} from "./ontology-relation-work.js";
import type { AgentExecutionSnapshot } from "./agent-execution-substrate.js";
import type { RelationDiscoveryProposalCompilation } from
  "./relation-discovery-semantic-bridge.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_ROUTE_MEMBERS = 24;

export type StandingOntologyRoute = Readonly<{
  schemaVersion: "pmh.standing-ontology-route.v1";
  routeId: Hash;
  sourceDisposition: "NATIVE_ROUTE_EFFECT" | "LEGACY_RELATED_FINDING";
  routeLayer: RelationDiscoveryRouteLayer;
  searchSignals: readonly string[];
  searchFields: readonly ("title" | "description" | "rulesText")[];
  sourceWorkItemId: Hash;
  sourceWorkArtifactHash: Hash;
  sourceTaskRevisionId: Hash;
  sourceTaskId: Hash;
  sourceAgentRunId: Hash;
  sourceAgentRunIds: readonly Hash[];
  sourceFindingId: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  sourceProposalIds: readonly Hash[];
  sourceIssueIds: readonly Hash[];
  sourceIssueRevisionIds: readonly Hash[];
  sourceOntologyIdentities: readonly Hash[];
  sourceSnapshotIdentities: readonly Hash[];
  sourceRelationPatternIds: readonly Hash[];
  sourceTrailheadIds: readonly Hash[];
  sourceSelectionLanes: OntologyRelationWorkItem["sourceSelectionLanes"];
  baselineListingRefs: readonly string[];
  baselineListingEvidenceHashes: readonly Hash[];
  baselineMembershipIdentity: Hash;
  statement: string;
  rationale: string;
  falsifiers: readonly string[];
  priority: 1 | 2 | 3 | 4 | 5;
  recordedAt: string;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteObservationState =
  | "QUIESCENT"
  | "EXPANDED"
  | "CHANGED"
  | "CONTRACTED"
  | "BLOCKED_TOO_BROAD";

export type StandingOntologyRouteObservation = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-observation.v1";
  observationId: Hash;
  routeId: Hash;
  currentCorpusSnapshotIdentity: Hash;
  state: StandingOntologyRouteObservationState;
  currentListingRefs: readonly string[];
  currentListingEvidenceHashes: readonly Hash[];
  currentMembershipIdentity: Hash | null;
  addedListingRefs: readonly string[];
  removedListingRefs: readonly string[];
  changedListingRefs: readonly string[];
  matchCount: number;
  truncated: boolean;
  followupEligible: boolean;
  authority: "ROUTE_NOVELTY_OBSERVATION_ONLY";
  modelInvocationAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteFamily = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-family.v1";
  routeFamilyId: Hash;
  routeLayer: RelationDiscoveryRouteLayer;
  canonicalSearchSignals: readonly string[];
  searchFields: readonly ("title" | "description" | "rulesText")[];
  representativeRouteId: Hash;
  sourceRouteIds: readonly Hash[];
  sourceFindingIds: readonly Hash[];
  sourceTaskIds: readonly Hash[];
  authoringRunIds: readonly Hash[];
  sourceAgentRunIds: readonly Hash[];
  sourceCount: number;
  nativeSourceCount: number;
  legacySourceCount: number;
  baselineMembershipIdentities: readonly Hash[];
  baselineDisagreement: boolean;
  firstRecordedAt: string;
  lastRecordedAt: string;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteFamilyObservation = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-family-observation.v1";
  observationId: Hash;
  routeFamilyId: Hash;
  baselineRouteId: Hash;
  currentCorpusSnapshotIdentity: Hash;
  state: StandingOntologyRouteObservationState;
  currentListingRefs: readonly string[];
  currentListingEvidenceHashes: readonly Hash[];
  currentMembershipIdentity: Hash | null;
  addedListingRefs: readonly string[];
  removedListingRefs: readonly string[];
  changedListingRefs: readonly string[];
  matchCount: number;
  truncated: boolean;
  followupEligible: boolean;
  authority: "ROUTE_NOVELTY_OBSERVATION_ONLY";
  modelInvocationAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteObservationEpisode = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-observation-episode.v1";
  episodeId: Hash;
  routeFamilyId: Hash;
  familyObservationId: Hash;
  previousEpisodeId: Hash | null;
  observedAt: string;
  sourceCorpusSnapshotIdentity: Hash;
  state: StandingOntologyRouteObservationState;
  membershipIdentity: Hash | null;
  currentListingRefs: readonly string[];
  addedListingRefs: readonly string[];
  removedListingRefs: readonly string[];
  changedListingRefs: readonly string[];
  followupEligible: boolean;
  authority: "DURABLE_ROUTE_LIFECYCLE_EVIDENCE_ONLY";
  modelInvocationAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface StandingOntologyRouteObservationEpisodeStore {
  readonly standingOntologyRouteObservationEpisodeStorage:
    OperationalStorageProjection<"episodeId">;
  loadStandingOntologyRouteObservationEpisodes(
    routeFamilyIds?: readonly Hash[],
  ): readonly StandingOntologyRouteObservationEpisode[];
  saveStandingOntologyRouteObservationEpisodes(
    episodes: readonly StandingOntologyRouteObservationEpisode[],
  ): readonly StandingOntologyRouteObservationEpisode[];
}

export type BlockedStandingOntologyRoute = Readonly<{
  schemaVersion: "pmh.blocked-standing-ontology-route.v1";
  blockedRouteId: Hash;
  sourceFindingId: Hash;
  sourceTaskId: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  reason:
    | "EXACT_TASK_REVISION_UNAVAILABLE"
    | "SOURCE_CORPUS_UNAVAILABLE"
    | "LEGACY_ROUTE_LAYER_UNSUPPORTED"
    | "NO_GROUNDED_BOUNDED_LITERAL_QUERY";
  diagnostic: string;
  authority: "RETAINED_ROUTING_FAILURE_ONLY";
  executionAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteProjection = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-projection.v1";
  projectionIdentity: Hash;
  currentCorpusSnapshotIdentity: Hash;
  routeCount: number;
  nativeRouteCount: number;
  legacyRouteCount: number;
  blockedRouteCount: number;
  quietRouteCount: number;
  expandedRouteCount: number;
  changedRouteCount: number;
  contractedRouteCount: number;
  broadRouteCount: number;
  followupEligibleRouteCount: number;
  familyCount: number;
  corroboratedFamilyCount: number;
  baselineDisagreementFamilyCount: number;
  followupEligibleFamilyCount: number;
  routes: readonly Readonly<{
    route: StandingOntologyRoute;
    observation: StandingOntologyRouteObservation;
  }>[];
  families: readonly Readonly<{
    family: StandingOntologyRouteFamily;
    observation: StandingOntologyRouteFamilyObservation;
  }>[];
  blockedRoutes: readonly BlockedStandingOntologyRoute[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  automaticDispatch: false;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteFollowup = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-followup.v2";
  followupId: Hash;
  routeFamilyId: Hash;
  sourceRouteIds: readonly Hash[];
  sourceObservationId: Hash;
  observationMembershipIdentity: Hash;
  workItem: OntologyRelationWorkItem;
  authority: "RELATION_SEARCH_PROPOSAL_ONLY";
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteUsage = Readonly<{
  runCount: number;
  invocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  unknownInputInvocationCount: number;
  unknownOutputInvocationCount: number;
  unknownReasoningInvocationCount: number;
}>;

export type StandingOntologyRouteFamilyValue = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-family-value.v2";
  valueId: Hash;
  routeFamilyId: Hash;
  observedAt: string;
  currentState: StandingOntologyRouteObservationState;
  quietDurationMs: string | null;
  totalQuietDurationMs: string;
  firstObservedAt: string | null;
  lastTransitionAt: string | null;
  observationEpisodeCount: number;
  sourceCount: number;
  observedWakeCount: number;
  creationUsage: StandingOntologyRouteUsage;
  followupUsage: StandingOntologyRouteUsage;
  followupWorkItemIds: readonly Hash[];
  followupRunIds: readonly Hash[];
  positiveFindingIds: readonly Hash[];
  counterexampleIds: readonly Hash[];
  semanticProposalIds: readonly Hash[];
  semanticReviewJobIds: readonly Hash[];
  semanticReviewPassCount: number;
  probabilityJobIds: readonly Hash[];
  opportunityIds: readonly string[];
  valueStage:
    | "QUIET_MEMORY"
    | "WAKE_UNATTEMPTED"
    | "WAKE_ATTEMPTED"
    | "NEGATIVE_EVIDENCE"
    | "POSITIVE_FINDING"
    | "SEMANTICALLY_REVIEWED"
    | "PROBABILITY_RESEARCH"
    | "OPPORTUNITY_PROGRESS";
  authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY";
  causalClaim: false;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingOntologyRouteValueProjection = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-value-projection.v2";
  projectionIdentity: Hash;
  observedAt: string;
  familyCount: number;
  totalCreationUsage: StandingOntologyRouteUsage;
  totalFollowupUsage: StandingOntologyRouteUsage;
  values: readonly StandingOntologyRouteFamilyValue[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY";
  causalClaim: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function compact(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function canonicalSignal(value: string): string {
  return compact(value).normalize("NFKC").toLocaleLowerCase("en-US");
}

function routeFamilyIdentity(route: Pick<StandingOntologyRoute,
  "routeLayer" | "searchSignals" | "searchFields">): Hash {
  return hashCanonical({
    schemaVersion: "pmh.standing-ontology-route-family-identity.v1",
    routeLayer: route.routeLayer,
    canonicalSearchSignals: [...new Set(route.searchSignals.map(canonicalSignal))].sort(),
    searchFields: [...new Set(route.searchFields)].sort(),
  });
}

function orderedStandingOntologyRouteObservationHistory(
  episodesInput: readonly StandingOntologyRouteObservationEpisode[],
  routeFamilyId: Hash,
): readonly StandingOntologyRouteObservationEpisode[] {
  const episodes = episodesInput.map(assertStandingOntologyRouteObservationEpisode)
    .filter((item) => item.routeFamilyId === routeFamilyId);
  if (episodes.length === 0) return Object.freeze([]);
  const byId = new Map(episodes.map((item) => [item.episodeId, item] as const));
  const roots = episodes.filter((item) => item.previousEpisodeId === null);
  if (roots.length !== 1) {
    throw new Error("standing route observation history has no unique root");
  }
  const childByParent = new Map<Hash, StandingOntologyRouteObservationEpisode>();
  for (const item of episodes) {
    if (item.previousEpisodeId === null) continue;
    if (!byId.has(item.previousEpisodeId)) {
      throw new Error("standing route observation history is incomplete");
    }
    if (childByParent.has(item.previousEpisodeId)) {
      throw new Error("standing route observation history cannot fork");
    }
    childByParent.set(item.previousEpisodeId, item);
  }
  const ordered: StandingOntologyRouteObservationEpisode[] = [];
  let current: StandingOntologyRouteObservationEpisode | undefined = roots[0];
  while (current !== undefined) {
    const previous = ordered.at(-1);
    if (previous !== undefined && previous.observedAt > current.observedAt) {
      throw new Error("standing route observation history moves backward in time");
    }
    ordered.push(current);
    current = childByParent.get(current.episodeId);
  }
  if (ordered.length !== episodes.length) {
    throw new Error("standing route observation history has no unique head");
  }
  return Object.freeze(ordered);
}

export function materializeStandingOntologyRouteObservationEpisodes(input: Readonly<{
  projection: StandingOntologyRouteProjection;
  priorEpisodes: readonly StandingOntologyRouteObservationEpisode[];
  observedAt: string;
}>): readonly StandingOntologyRouteObservationEpisode[] {
  const observedMs = Date.parse(input.observedAt);
  if (!Number.isFinite(observedMs) || new Date(observedMs).toISOString() !== input.observedAt) {
    throw new Error("standing route observation observedAt must be canonical ISO time");
  }
  const prior = input.priorEpisodes.map(assertStandingOntologyRouteObservationEpisode);
  return Object.freeze(input.projection.families.flatMap(({ family, observation }) => {
    const familyPrior = orderedStandingOntologyRouteObservationHistory(
      prior,
      family.routeFamilyId,
    );
    const previous = familyPrior.at(-1) ?? null;
    if (previous?.familyObservationId === observation.observationId) return [];
    const identity = Object.freeze({
      schemaVersion: "pmh.standing-ontology-route-observation-episode-identity.v1" as const,
      routeFamilyId: family.routeFamilyId,
      familyObservationId: observation.observationId,
      previousEpisodeId: previous?.episodeId ?? null,
    });
    const body = Object.freeze({
      schemaVersion: "pmh.standing-ontology-route-observation-episode.v1" as const,
      routeFamilyId: family.routeFamilyId,
      familyObservationId: observation.observationId,
      previousEpisodeId: previous?.episodeId ?? null,
      observedAt: input.observedAt,
      sourceCorpusSnapshotIdentity: observation.currentCorpusSnapshotIdentity,
      state: observation.state,
      membershipIdentity: observation.currentMembershipIdentity,
      currentListingRefs: observation.currentListingRefs,
      addedListingRefs: observation.addedListingRefs,
      removedListingRefs: observation.removedListingRefs,
      changedListingRefs: observation.changedListingRefs,
      followupEligible: observation.followupEligible,
      authority: "DURABLE_ROUTE_LIFECYCLE_EVIDENCE_ONLY" as const,
      modelInvocationAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return [assertStandingOntologyRouteObservationEpisode(Object.freeze({
      ...body,
      episodeId: hashCanonical(identity),
    }))];
  }).sort((left, right) => left.episodeId.localeCompare(right.episodeId)));
}

export function assertStandingOntologyRouteObservationEpisode(
  value: unknown,
): StandingOntologyRouteObservationEpisode {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("standing route observation episode is malformed");
  }
  const episode = value as StandingOntologyRouteObservationEpisode;
  const expectedId = hashCanonical({
    schemaVersion: "pmh.standing-ontology-route-observation-episode-identity.v1",
    routeFamilyId: episode.routeFamilyId,
    familyObservationId: episode.familyObservationId,
    previousEpisodeId: episode.previousEpisodeId,
  });
  const refs = [episode.currentListingRefs, episode.addedListingRefs,
    episode.removedListingRefs, episode.changedListingRefs];
  if (
    episode.schemaVersion !== "pmh.standing-ontology-route-observation-episode.v1" ||
    episode.episodeId !== expectedId ||
    ![episode.episodeId, episode.routeFamilyId, episode.familyObservationId,
      episode.sourceCorpusSnapshotIdentity].every((item) => HASH_PATTERN.test(String(item))) ||
    (episode.previousEpisodeId !== null &&
      !HASH_PATTERN.test(String(episode.previousEpisodeId))) ||
    new Date(episode.observedAt).toISOString() !== episode.observedAt ||
    !["QUIESCENT", "EXPANDED", "CHANGED", "CONTRACTED", "BLOCKED_TOO_BROAD"]
      .includes(episode.state) ||
    (episode.membershipIdentity !== null &&
      !HASH_PATTERN.test(String(episode.membershipIdentity))) ||
    refs.some((items) => !Array.isArray(items) || items.some((item) =>
      typeof item !== "string" || item.trim() === ""
    ) || new Set(items).size !== items.length) ||
    episode.followupEligible !== ["EXPANDED", "CHANGED"].includes(episode.state) ||
    episode.authority !== "DURABLE_ROUTE_LIFECYCLE_EVIDENCE_ONLY" ||
    episode.modelInvocationAuthority !== false || episode.campaignAuthority !== false ||
    episode.executionAuthority !== false || episode.externalWriteAuthority !== false ||
    episode.valueMovingAuthority !== false
  ) throw new Error("standing route observation episode violates its bounded contract");
  return Object.freeze(episode);
}

function uniqueHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

function membership(
  listingRefs: readonly string[],
  listingEvidenceHashes: readonly Hash[],
): Hash {
  return hashCanonical({
    schemaVersion: "pmh.ontology-route-membership.v1",
    listingRefs,
    listingEvidenceHashes,
  });
}

function lineageKey(value: Readonly<{
  taskId: Hash;
  workItemId: Hash;
  workArtifactHash: Hash;
  sourceCorpusSnapshotIdentity: Hash;
}>): string {
  return [value.taskId, value.workItemId, value.workArtifactHash,
    value.sourceCorpusSnapshotIdentity].join("\n");
}

function blocked(input: Omit<BlockedStandingOntologyRoute, "schemaVersion" |
  "blockedRouteId" | "authority" | "executionAuthority" | "valueMovingAuthority">):
  BlockedStandingOntologyRoute {
  const body = Object.freeze({
    schemaVersion: "pmh.blocked-standing-ontology-route.v1" as const,
    ...input,
    authority: "RETAINED_ROUTING_FAILURE_ONLY" as const,
    executionAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, blockedRouteId: hashCanonical(body) });
}

function legacyQuery(input: Readonly<{
  finding: Extract<RelationDiscoveryFinding, { kind: "RELATION_HYPOTHESIS" }>;
  revision: RelationDiscoveryTaskRevision;
  corpus: MarketCorpusSnapshot;
}>): Readonly<{
  routeLayer: RelationDiscoveryRouteLayer;
  searchSignals: readonly string[];
  searchFields: readonly ["title"];
  baselineListingRefs: readonly string[];
  baselineListingEvidenceHashes: readonly Hash[];
  baselineMembershipIdentity: Hash;
}> | null {
  const work = relationDiscoveryRevisionWorkItem(input.revision);
  if (work.kind !== "ENTITY_ALIAS_NEIGHBORHOOD") return null;
  const listingByRef = new Map(input.corpus.listings.map((item) => [item.listingRef, item]));
  const candidates = [...new Set(work.searchSignals.map(compact))].filter((signal) =>
    signal.length >= 3 && signal.length <= 160 && input.finding.listingRefs.every((ref) =>
      listingByRef.get(ref)?.title.toLocaleLowerCase("en-US")
        .includes(signal.toLocaleLowerCase("en-US")) === true
    )
  ).flatMap((signal) => {
    const result = searchMarketCorpus(input.corpus, {
      patterns: [signal],
      syntax: "LITERAL",
      mode: "ALL",
      fields: ["title"],
      limit: 50,
    });
    return result.truncated || result.matchCount > MAX_ROUTE_MEMBERS || result.matchCount < 2
      ? []
      : [{ signal, result }];
  }).sort((left, right) =>
    left.result.matchCount - right.result.matchCount ||
    right.signal.length - left.signal.length || left.signal.localeCompare(right.signal)
  );
  const selected = candidates[0];
  if (selected === undefined) return null;
  const baselineListings = Object.freeze(selected.result.hits.map((hit) =>
    listingByRef.get(hit.listingRef)!
  ));
  const baselineListingRefs = Object.freeze(baselineListings.map((item) => item.listingRef));
  if (!input.finding.listingRefs.every((ref) => baselineListingRefs.includes(ref))) return null;
  const baselineListingEvidenceHashes = Object.freeze(baselineListings.map(
    ontologyRouteListingEvidenceHash,
  ));
  return Object.freeze({
    routeLayer: "SUBJECT_REFERENCE" as const,
    searchSignals: Object.freeze([selected.signal]),
    searchFields: Object.freeze(["title"] as const),
    baselineListingRefs,
    baselineListingEvidenceHashes,
    baselineMembershipIdentity: membership(
      baselineListingRefs,
      baselineListingEvidenceHashes,
    ),
  });
}

export function assertStandingOntologyRoute(value: unknown): StandingOntologyRoute {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("standing ontology route is malformed");
  }
  const route = value as StandingOntologyRoute;
  const { routeId, ...body } = route;
  if (
    route.schemaVersion !== "pmh.standing-ontology-route.v1" ||
    !HASH_PATTERN.test(String(routeId)) || routeId !== hashCanonical(body) ||
    !["NATIVE_ROUTE_EFFECT", "LEGACY_RELATED_FINDING"].includes(route.sourceDisposition) ||
    !["SUBJECT_REFERENCE", "EVENT_REFERENCE", "SETTLEMENT_REFERENCE"].includes(route.routeLayer) ||
    !Array.isArray(route.searchSignals) || route.searchSignals.length < 1 ||
    route.searchSignals.length > 8 || route.searchSignals.some((item) =>
      typeof item !== "string" || item.trim() === "" || item.length > 160) ||
    new Set(route.searchSignals.map(canonicalSignal)).size !== route.searchSignals.length ||
    !Array.isArray(route.searchFields) || route.searchFields.length < 1 ||
    route.searchFields.some((item) =>
      !["title", "description", "rulesText"].includes(item)) ||
    new Set(route.searchFields).size !== route.searchFields.length ||
    (route.routeLayer === "SETTLEMENT_REFERENCE"
      ? route.searchFields.some((item) => !["description", "rulesText"].includes(item))
      : route.searchFields.length !== 1 || route.searchFields[0] !== "title") ||
    ![route.sourceWorkItemId, route.sourceWorkArtifactHash, route.sourceTaskRevisionId,
      route.sourceTaskId, route.sourceAgentRunId, route.sourceFindingId,
      route.sourceCorpusSnapshotIdentity, route.baselineMembershipIdentity]
      .every((item) => HASH_PATTERN.test(String(item))) ||
    [route.sourceAgentRunIds, route.sourceProposalIds, route.sourceIssueIds,
      route.sourceIssueRevisionIds, route.sourceOntologyIdentities,
      route.sourceSnapshotIdentities, route.sourceRelationPatternIds,
      route.sourceTrailheadIds].some((items) => !Array.isArray(items) ||
      items.some((item) => !HASH_PATTERN.test(String(item))) ||
      new Set(items).size !== items.length) ||
    route.sourceAgentRunIds.length === 0 || route.sourceProposalIds.length === 0 ||
    route.sourceOntologyIdentities.length === 0 || route.sourceSnapshotIdentities.length === 0 ||
    !Array.isArray(route.sourceSelectionLanes) ||
    route.sourceSelectionLanes.some((lane) =>
      !["CROSS_VENUE", "WORLD_DIVERGENCE", "SETTLEMENT_DIVERGENCE"].includes(lane)) ||
    new Set(route.sourceSelectionLanes).size !== route.sourceSelectionLanes.length ||
    !Array.isArray(route.baselineListingRefs) || route.baselineListingRefs.length < 2 ||
    route.baselineListingRefs.length > MAX_ROUTE_MEMBERS ||
    new Set(route.baselineListingRefs).size !== route.baselineListingRefs.length ||
    !Array.isArray(route.baselineListingEvidenceHashes) ||
    route.baselineListingEvidenceHashes.length !== route.baselineListingRefs.length ||
    membership(route.baselineListingRefs, route.baselineListingEvidenceHashes) !==
      route.baselineMembershipIdentity ||
    typeof route.statement !== "string" || route.statement.trim() === "" ||
    route.statement.length > 1_000 || typeof route.rationale !== "string" ||
    route.rationale.trim() === "" || route.rationale.length > 2_000 ||
    !Array.isArray(route.falsifiers) || route.falsifiers.length < 1 ||
    route.falsifiers.length > 12 || route.falsifiers.some((item) =>
      typeof item !== "string" || item.trim() === "" || item.length > 500) ||
    ![1, 2, 3, 4, 5].includes(route.priority) ||
    new Date(route.recordedAt).toISOString() !== route.recordedAt ||
    route.authority !== "SEARCH_ROUTING_ONLY" ||
    route.semanticDecisionAuthority !== false || route.probabilityAuthority !== false ||
    route.certificateAuthority !== false || route.executionAuthority !== false ||
    route.externalWriteAuthority !== false || route.valueMovingAuthority !== false
  ) throw new Error("standing ontology route violates its bounded contract");
  return Object.freeze(route);
}

function compileRoute(input: Readonly<{
  finding: RelationDiscoveryFinding;
  revision: RelationDiscoveryTaskRevision;
  corpus: MarketCorpusSnapshot;
}>): StandingOntologyRoute | null {
  const finding = assertRelationDiscoveryFinding(input.finding);
  const work = relationDiscoveryRevisionWorkItem(input.revision);
  const native = finding.kind === "ONTOLOGY_ROUTE" ? finding : null;
  const legacy = finding.kind === "RELATION_HYPOTHESIS" && finding.relationKind === "RELATED"
    ? legacyQuery({ finding, revision: input.revision, corpus: input.corpus })
    : null;
  const query = native ?? legacy;
  if (query === null) return null;
  const body = Object.freeze({
    schemaVersion: "pmh.standing-ontology-route.v1" as const,
    sourceDisposition: native === null
      ? "LEGACY_RELATED_FINDING" as const
      : "NATIVE_ROUTE_EFFECT" as const,
    routeLayer: query.routeLayer,
    searchSignals: query.searchSignals,
    searchFields: query.searchFields,
    sourceWorkItemId: finding.workItemId,
    sourceWorkArtifactHash: finding.workArtifactHash,
    sourceTaskRevisionId: input.revision.revisionId,
    sourceTaskId: finding.sourceTaskId,
    sourceAgentRunId: finding.sourceAgentRunId,
    sourceAgentRunIds: work.sourceAgentRunIds,
    sourceFindingId: finding.findingId,
    sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
    sourceProposalIds: work.sourceProposalIds,
    sourceIssueIds: work.sourceIssueIds,
    sourceIssueRevisionIds: work.sourceIssueRevisionIds,
    sourceOntologyIdentities: work.sourceOntologyIdentities,
    sourceSnapshotIdentities: work.sourceSnapshotIdentities,
    sourceRelationPatternIds: work.sourceRelationPatternIds,
    sourceTrailheadIds: work.sourceTrailheadIds,
    sourceSelectionLanes: work.sourceSelectionLanes,
    baselineListingRefs: query.baselineListingRefs,
    baselineListingEvidenceHashes: query.baselineListingEvidenceHashes,
    baselineMembershipIdentity: query.baselineMembershipIdentity,
    statement: finding.statement,
    rationale: finding.rationale,
    falsifiers: finding.falsifiers,
    priority: work.priority,
    recordedAt: finding.recordedAt,
    authority: "SEARCH_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertStandingOntologyRoute(Object.freeze({
    ...body,
    routeId: hashCanonical(body),
  }));
}

function observe(
  route: StandingOntologyRoute,
  currentCorpusInput: MarketCorpusSnapshot,
): StandingOntologyRouteObservation {
  const currentCorpus = assertMarketCorpusSnapshot(currentCorpusInput);
  const result = searchMarketCorpus(currentCorpus, {
    patterns: route.searchSignals,
    syntax: "LITERAL",
    mode: "ALL",
    fields: route.searchFields,
    limit: 50,
  });
  const broad = result.truncated || result.matchCount > MAX_ROUTE_MEMBERS;
  const byRef = new Map(currentCorpus.listings.map((item) => [item.listingRef, item]));
  const currentListingRefs = broad
    ? Object.freeze([] as string[])
    : Object.freeze(result.hits.map((item) => item.listingRef));
  const currentListingEvidenceHashes = broad
    ? Object.freeze([] as Hash[])
    : Object.freeze(currentListingRefs.map((ref) =>
        ontologyRouteListingEvidenceHash(byRef.get(ref)!)
      ));
  const currentMembershipIdentity = broad
    ? null
    : membership(currentListingRefs, currentListingEvidenceHashes);
  const baselineHashByRef = new Map(route.baselineListingRefs.map((ref, index) =>
    [ref, route.baselineListingEvidenceHashes[index]!] as const
  ));
  const currentHashByRef = new Map(currentListingRefs.map((ref, index) =>
    [ref, currentListingEvidenceHashes[index]!] as const
  ));
  const addedListingRefs = Object.freeze(currentListingRefs.filter((ref) =>
    !baselineHashByRef.has(ref)
  ));
  const removedListingRefs = Object.freeze(route.baselineListingRefs.filter((ref) =>
    !currentHashByRef.has(ref)
  ));
  const changedListingRefs = Object.freeze(currentListingRefs.filter((ref) =>
    baselineHashByRef.has(ref) && baselineHashByRef.get(ref) !== currentHashByRef.get(ref)
  ));
  const state: StandingOntologyRouteObservationState = broad
    ? "BLOCKED_TOO_BROAD"
    : addedListingRefs.length > 0
      ? "EXPANDED"
      : changedListingRefs.length > 0
        ? "CHANGED"
        : removedListingRefs.length > 0
          ? "CONTRACTED"
          : "QUIESCENT";
  const body = Object.freeze({
    schemaVersion: "pmh.standing-ontology-route-observation.v1" as const,
    routeId: route.routeId,
    currentCorpusSnapshotIdentity: currentCorpus.snapshotIdentity,
    state,
    currentListingRefs,
    currentListingEvidenceHashes,
    currentMembershipIdentity,
    addedListingRefs,
    removedListingRefs,
    changedListingRefs,
    matchCount: result.matchCount,
    truncated: result.truncated,
    followupEligible: state === "EXPANDED" || state === "CHANGED",
    authority: "ROUTE_NOVELTY_OBSERVATION_ONLY" as const,
    modelInvocationAuthority: false as const,
    campaignAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  const observationId = hashCanonical({
    schemaVersion: "pmh.standing-ontology-route-observation-identity.v1",
    routeId: route.routeId,
    state,
    currentMembershipIdentity,
    addedListingRefs,
    removedListingRefs,
    changedListingRefs,
  });
  return Object.freeze({ ...body, observationId });
}

function buildRouteFamilies(
  routes: readonly StandingOntologyRoute[],
  currentCorpus: MarketCorpusSnapshot,
): readonly Readonly<{
  family: StandingOntologyRouteFamily;
  observation: StandingOntologyRouteFamilyObservation;
}>[] {
  const grouped = new Map<Hash, StandingOntologyRoute[]>();
  for (const route of routes) {
    const familyId = routeFamilyIdentity(route);
    grouped.set(familyId, [...(grouped.get(familyId) ?? []), route]);
  }
  return Object.freeze([...grouped.entries()].map(([routeFamilyId, sources]) => {
    const sorted = [...sources].sort((left, right) =>
      left.recordedAt.localeCompare(right.recordedAt) || left.routeId.localeCompare(right.routeId)
    );
    const representative = sorted[0]!;
    const baselineMembershipIdentities = uniqueHashes(sorted.map((item) =>
      item.baselineMembershipIdentity
    ));
    const family = Object.freeze({
      schemaVersion: "pmh.standing-ontology-route-family.v1" as const,
      routeFamilyId,
      routeLayer: representative.routeLayer,
      canonicalSearchSignals: Object.freeze([
        ...new Set(representative.searchSignals.map(canonicalSignal)),
      ].sort()),
      searchFields: Object.freeze([...new Set(representative.searchFields)].sort()),
      representativeRouteId: representative.routeId,
      sourceRouteIds: uniqueHashes(sorted.map((item) => item.routeId)),
      sourceFindingIds: uniqueHashes(sorted.map((item) => item.sourceFindingId)),
      sourceTaskIds: uniqueHashes(sorted.map((item) => item.sourceTaskId)),
      authoringRunIds: uniqueHashes(sorted.map((item) => item.sourceAgentRunId)),
      sourceAgentRunIds: uniqueHashes(sorted.flatMap((item) => [
        ...item.sourceAgentRunIds,
        item.sourceAgentRunId,
      ])),
      sourceCount: sorted.length,
      nativeSourceCount: sorted.filter((item) =>
        item.sourceDisposition === "NATIVE_ROUTE_EFFECT"
      ).length,
      legacySourceCount: sorted.filter((item) =>
        item.sourceDisposition === "LEGACY_RELATED_FINDING"
      ).length,
      baselineMembershipIdentities,
      baselineDisagreement: baselineMembershipIdentities.length > 1,
      firstRecordedAt: sorted[0]!.recordedAt,
      lastRecordedAt: sorted.at(-1)!.recordedAt,
      authority: "SEARCH_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const routeObservation = observe(representative, currentCorpus);
    const observationBody = Object.freeze({
      schemaVersion: "pmh.standing-ontology-route-family-observation.v1" as const,
      routeFamilyId,
      baselineRouteId: representative.routeId,
      currentCorpusSnapshotIdentity: routeObservation.currentCorpusSnapshotIdentity,
      state: routeObservation.state,
      currentListingRefs: routeObservation.currentListingRefs,
      currentListingEvidenceHashes: routeObservation.currentListingEvidenceHashes,
      currentMembershipIdentity: routeObservation.currentMembershipIdentity,
      addedListingRefs: routeObservation.addedListingRefs,
      removedListingRefs: routeObservation.removedListingRefs,
      changedListingRefs: routeObservation.changedListingRefs,
      matchCount: routeObservation.matchCount,
      truncated: routeObservation.truncated,
      followupEligible: routeObservation.followupEligible,
      authority: "ROUTE_NOVELTY_OBSERVATION_ONLY" as const,
      modelInvocationAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const observationId = hashCanonical({
      schemaVersion: "pmh.standing-ontology-route-family-observation-identity.v1",
      routeFamilyId,
      state: observationBody.state,
      currentMembershipIdentity: observationBody.currentMembershipIdentity,
      addedListingRefs: observationBody.addedListingRefs,
      removedListingRefs: observationBody.removedListingRefs,
      changedListingRefs: observationBody.changedListingRefs,
    });
    return Object.freeze({
      family,
      observation: Object.freeze({ ...observationBody, observationId }),
    });
  }).sort((left, right) => left.family.routeFamilyId.localeCompare(
    right.family.routeFamilyId,
  )));
}

export function buildStandingOntologyRouteProjection(input: Readonly<{
  findings: readonly RelationDiscoveryFinding[];
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  loadCorpus: (snapshotIdentity: Hash) => MarketCorpusSnapshot | null;
  currentCorpus: MarketCorpusSnapshot;
}>): StandingOntologyRouteProjection {
  const currentCorpus = assertMarketCorpusSnapshot(input.currentCorpus);
  const revisions = new Map<string, RelationDiscoveryTaskRevision>();
  for (const candidate of input.taskRevisions) {
    const revision = assertRelationDiscoveryTaskRevision(candidate);
    const key = lineageKey({
      taskId: revision.task.taskId,
      workItemId: revision.workItemId,
      workArtifactHash: revision.workArtifactHash,
      sourceCorpusSnapshotIdentity: revision.sourceCorpusSnapshotIdentity,
    });
    const retained = revisions.get(key);
    if (retained !== undefined && retained.revisionId !== revision.revisionId) {
      throw new Error("standing ontology route task revision lineage is ambiguous");
    }
    revisions.set(key, revision);
  }
  const routes: StandingOntologyRoute[] = [];
  const routeIds = new Set<Hash>();
  const blockedRoutes: BlockedStandingOntologyRoute[] = [];
  const candidates = input.findings.map(assertRelationDiscoveryFinding).filter((finding) =>
    finding.kind === "ONTOLOGY_ROUTE" ||
    (finding.kind === "RELATION_HYPOTHESIS" && finding.relationKind === "RELATED")
  );
  for (const finding of candidates) {
    const revision = revisions.get(lineageKey({
      taskId: finding.sourceTaskId,
      workItemId: finding.workItemId,
      workArtifactHash: finding.workArtifactHash,
      sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
    }));
    if (revision === undefined) {
      blockedRoutes.push(blocked({
        sourceFindingId: finding.findingId,
        sourceTaskId: finding.sourceTaskId,
        sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
        reason: "EXACT_TASK_REVISION_UNAVAILABLE",
        diagnostic: "The route finding has no exact task/work/artifact/corpus revision",
      }));
      continue;
    }
    const corpus = input.loadCorpus(finding.sourceCorpusSnapshotIdentity);
    if (corpus === null) {
      blockedRoutes.push(blocked({
        sourceFindingId: finding.findingId,
        sourceTaskId: finding.sourceTaskId,
        sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
        reason: "SOURCE_CORPUS_UNAVAILABLE",
        diagnostic: "The route finding source corpus is unavailable",
      }));
      continue;
    }
    const work = relationDiscoveryRevisionWorkItem(revision);
    if (finding.kind !== "ONTOLOGY_ROUTE" && work.kind !== "ENTITY_ALIAS_NEIGHBORHOOD") {
      blockedRoutes.push(blocked({
        sourceFindingId: finding.findingId,
        sourceTaskId: finding.sourceTaskId,
        sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
        reason: "LEGACY_ROUTE_LAYER_UNSUPPORTED",
        diagnostic: "Legacy RELATED findings compile automatically only from entity-alias work",
      }));
      continue;
    }
    const route = compileRoute({ finding, revision, corpus });
    if (route === null) {
      blockedRoutes.push(blocked({
        sourceFindingId: finding.findingId,
        sourceTaskId: finding.sourceTaskId,
        sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
        reason: "NO_GROUNDED_BOUNDED_LITERAL_QUERY",
        diagnostic: "No work signal covered all inspected refs with 2-24 source-corpus members",
      }));
      continue;
    }
    if (!routeIds.has(route.routeId)) {
      routeIds.add(route.routeId);
      routes.push(route);
    }
  }
  routes.sort((left, right) => left.routeId.localeCompare(right.routeId));
  blockedRoutes.sort((left, right) => left.blockedRouteId.localeCompare(right.blockedRouteId));
  const observed = Object.freeze(routes.map((route) => Object.freeze({
    route,
    observation: observe(route, currentCorpus),
  })));
  const families = buildRouteFamilies(routes, currentCorpus);
  const body = Object.freeze({
    schemaVersion: "pmh.standing-ontology-route-projection.v1" as const,
    currentCorpusSnapshotIdentity: currentCorpus.snapshotIdentity,
    routeCount: observed.length,
    nativeRouteCount: observed.filter((item) =>
      item.route.sourceDisposition === "NATIVE_ROUTE_EFFECT"
    ).length,
    legacyRouteCount: observed.filter((item) =>
      item.route.sourceDisposition === "LEGACY_RELATED_FINDING"
    ).length,
    blockedRouteCount: blockedRoutes.length,
    quietRouteCount: observed.filter((item) => item.observation.state === "QUIESCENT").length,
    expandedRouteCount: observed.filter((item) => item.observation.state === "EXPANDED").length,
    changedRouteCount: observed.filter((item) => item.observation.state === "CHANGED").length,
    contractedRouteCount: observed.filter((item) => item.observation.state === "CONTRACTED").length,
    broadRouteCount: observed.filter((item) =>
      item.observation.state === "BLOCKED_TOO_BROAD"
    ).length,
    followupEligibleRouteCount: observed.filter((item) =>
      item.observation.followupEligible
    ).length,
    familyCount: families.length,
    corroboratedFamilyCount: families.filter((item) => item.family.sourceCount > 1).length,
    baselineDisagreementFamilyCount: families.filter((item) =>
      item.family.baselineDisagreement
    ).length,
    followupEligibleFamilyCount: families.filter((item) =>
      item.observation.followupEligible
    ).length,
    routes: observed,
    families,
    blockedRoutes: Object.freeze(blockedRoutes),
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    campaignsCreatedByRead: 0 as const,
    runsCreatedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "SEARCH_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}

function nodeBinding(node: MarketOntologyListingNode) {
  return Object.freeze({
    listingRef: node.listingRef,
    nodeId: node.nodeId,
    worldFacetId: node.worldFacet.facetId,
    settlementFacetId: node.settlementFacet.facetId,
    tradedFacetId: node.tradedFacet.facetId,
  });
}

export function materializeStandingOntologyRouteFollowups(input: Readonly<{
  projection: StandingOntologyRouteProjection;
  ontology: MarketOntologySnapshot;
}>): readonly StandingOntologyRouteFollowup[] {
  const ontology = assertMarketOntologySnapshot(input.ontology);
  if (ontology.sourceSnapshotIdentity !== input.projection.currentCorpusSnapshotIdentity) {
    throw new Error("standing ontology route follow-up ontology lineage is inconsistent");
  }
  const nodes = new Map(ontology.nodes.map((item) => [item.listingRef, item] as const));
  const routes = new Map(input.projection.routes.map((item) =>
    [item.route.routeId, item.route] as const
  ));
  return Object.freeze(input.projection.families.flatMap(({ family, observation }) => {
    if (!observation.followupEligible || observation.currentMembershipIdentity === null) return [];
    const sourceRoutes = family.sourceRouteIds.map((routeId) => {
      const route = routes.get(routeId);
      if (route === undefined) throw new Error("standing route family lost a source route");
      return route;
    });
    const route = routes.get(family.representativeRouteId);
    if (route === undefined) throw new Error("standing route family lost its baseline route");
    const selectedRefs = Object.freeze([...new Set([
      ...route.baselineListingRefs,
      ...observation.addedListingRefs,
      ...observation.changedListingRefs,
    ])].filter((ref) => observation.currentListingRefs.includes(ref)).sort());
    const selectedNodes = selectedRefs.flatMap((ref) => {
      const node = nodes.get(ref);
      return node === undefined ? [] : [node];
    });
    if (selectedNodes.length < 2) return [];
    const { searchScopeIdentity, workItemId } = standingOntologyRouteFollowupIdentity({
      routeFamilyId: family.routeFamilyId,
      observationMembershipIdentity: observation.currentMembershipIdentity,
    });
    const candidateRelationKinds = Object.freeze([
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "CONFLICTING",
    ] as const);
    const title = `Standing route wake · ${route.searchSignals.join(" · ")}`.slice(0, 240);
    const question = (
      `A standing ${route.routeLayer.toLowerCase().replace(/_/gu, " ")} route changed. ` +
      `Inspect the exact prior and novel members ${selectedRefs.join(", ")}. ` +
      `Test payoff-bearing relations ${candidateRelationKinds.join(", ")} and retain ` +
      `counterexamples. RELATED is already established as routing memory and cannot be ` +
      `submitted by this one-hop follow-up.`
    ).slice(0, 2_000);
    const sourceSelectionLanes = Object.freeze([...new Set(sourceRoutes.flatMap((item) =>
      item.sourceSelectionLanes
    ))].sort());
    const body = Object.freeze({
      schemaVersion: "pmh.ontology-relation-work.v1" as const,
      workItemId,
      searchScopeIdentity,
      kind: "STANDING_ROUTE_FOLLOWUP" as const,
      disposition: "RUNNABLE_RESEARCH" as const,
      sourceProposalIds: uniqueHashes(sourceRoutes.flatMap((item) => item.sourceProposalIds)),
      sourceAgentRunIds: family.sourceAgentRunIds,
      sourceIssueIds: uniqueHashes(sourceRoutes.flatMap((item) => item.sourceIssueIds)),
      sourceIssueRevisionIds: uniqueHashes(sourceRoutes.flatMap((item) =>
        item.sourceIssueRevisionIds
      )),
      sourceOntologyIdentities: uniqueHashes(sourceRoutes.flatMap((item) =>
        item.sourceOntologyIdentities
      )),
      sourceSnapshotIdentities: uniqueHashes(sourceRoutes.flatMap((item) =>
        item.sourceSnapshotIdentities
      )),
      sourceRelationPatternIds: uniqueHashes([
        ...sourceRoutes.flatMap((item) => item.sourceRelationPatternIds),
        family.routeFamilyId,
      ]),
      sourceTrailheadIds: uniqueHashes([
        ...sourceRoutes.flatMap((item) => item.sourceTrailheadIds),
        observation.currentMembershipIdentity,
      ]),
      sourceSelectionLanes: sourceSelectionLanes.length === 0
        ? Object.freeze(["WORLD_DIVERGENCE"] as const)
        : sourceSelectionLanes,
      sourceListingBindingCount: selectedNodes.length,
      seedListingBindings: Object.freeze(selectedNodes.slice(0, 32).map(nodeBinding)),
      seedListingBindingsTruncated: selectedNodes.length > 32,
      title,
      question,
      searchSignals: route.searchSignals,
      candidateRelationKinds,
      falsifiers: Object.freeze([...new Set(sourceRoutes.flatMap((item) =>
        item.falsifiers
      ))].sort().slice(0, 12)),
      priority: Math.max(...sourceRoutes.map((item) => item.priority)) as 1 | 2 | 3 | 4 | 5,
      firstProposedAt: family.firstRecordedAt,
      lastProposedAt: family.lastRecordedAt,
      campaignEligible: true as const,
      automaticDispatch: false as const,
      authority: "RELATION_SEARCH_PROPOSAL_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const workItem = assertOntologyRelationWorkItem(Object.freeze({
      ...body,
      artifactHash: hashCanonical(body),
    }));
    const followupBody = Object.freeze({
      schemaVersion: "pmh.standing-ontology-route-followup.v2" as const,
      routeFamilyId: family.routeFamilyId,
      sourceRouteIds: family.sourceRouteIds,
      sourceObservationId: observation.observationId,
      observationMembershipIdentity: observation.currentMembershipIdentity,
      workItem,
      authority: "RELATION_SEARCH_PROPOSAL_ONLY" as const,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return [Object.freeze({
      ...followupBody,
      followupId: hashCanonical(followupBody),
    })];
  }).sort((left, right) => left.followupId.localeCompare(right.followupId)));
}

export function standingOntologyRouteFollowupIdentity(input: Readonly<{
  routeFamilyId: Hash;
  observationMembershipIdentity: Hash;
}>): Readonly<{ searchScopeIdentity: Hash; workItemId: Hash }> {
  if (!HASH_PATTERN.test(input.routeFamilyId) ||
      !HASH_PATTERN.test(input.observationMembershipIdentity)) {
    throw new Error("standing route follow-up identity contains an invalid hash");
  }
  const searchScopeIdentity = hashCanonical({
    schemaVersion: "pmh.standing-ontology-route-followup-scope.v1",
    routeFamilyId: input.routeFamilyId,
    observationMembershipIdentity: input.observationMembershipIdentity,
  });
  return Object.freeze({
    searchScopeIdentity,
    workItemId: hashCanonical({
      schemaVersion: "pmh.ontology-relation-work-id.v1",
      searchScopeIdentity,
    }),
  });
}

export function extendOntologyRelationWorkWithStandingRouteFollowups(input: Readonly<{
  base: OntologyRelationWorkProjection;
  followups: readonly StandingOntologyRouteFollowup[];
}>): OntologyRelationWorkProjection {
  return extendOntologyRelationWorkProjection({
    base: input.base,
    additionalItems: input.followups.map((item) => item.workItem),
  });
}

function usageForRuns(
  execution: AgentExecutionSnapshot,
  runIdsInput: readonly Hash[],
): StandingOntologyRouteUsage {
  const runIds = new Set(runIdsInput);
  const invocations = execution.modelInvocations.filter((item) => runIds.has(item.runId));
  const sum = (field: "inputTokens" | "outputTokens" | "reasoningTokens") =>
    invocations.reduce((total, item) => total + BigInt(item[field] ?? "0"), 0n).toString();
  return Object.freeze({
    runCount: runIds.size,
    invocationCount: invocations.length,
    knownInputTokens: sum("inputTokens"),
    knownOutputTokens: sum("outputTokens"),
    knownReasoningTokens: sum("reasoningTokens"),
    unknownInputInvocationCount: invocations.filter((item) => item.inputTokens === null).length,
    unknownOutputInvocationCount: invocations.filter((item) => item.outputTokens === null).length,
    unknownReasoningInvocationCount: invocations.filter((item) =>
      item.reasoningTokens === null
    ).length,
  });
}

function sumUsage(items: readonly StandingOntologyRouteUsage[]): StandingOntologyRouteUsage {
  return Object.freeze({
    runCount: items.reduce((sum, item) => sum + item.runCount, 0),
    invocationCount: items.reduce((sum, item) => sum + item.invocationCount, 0),
    knownInputTokens: items.reduce((sum, item) =>
      sum + BigInt(item.knownInputTokens), 0n).toString(),
    knownOutputTokens: items.reduce((sum, item) =>
      sum + BigInt(item.knownOutputTokens), 0n).toString(),
    knownReasoningTokens: items.reduce((sum, item) =>
      sum + BigInt(item.knownReasoningTokens), 0n).toString(),
    unknownInputInvocationCount: items.reduce((sum, item) =>
      sum + item.unknownInputInvocationCount, 0),
    unknownOutputInvocationCount: items.reduce((sum, item) =>
      sum + item.unknownOutputInvocationCount, 0),
    unknownReasoningInvocationCount: items.reduce((sum, item) =>
      sum + item.unknownReasoningInvocationCount, 0),
  });
}

export function buildStandingOntologyRouteValueProjection(input: Readonly<{
  projection: StandingOntologyRouteProjection;
  followups: readonly StandingOntologyRouteFollowup[];
  episodes: readonly StandingOntologyRouteObservationEpisode[];
  execution: AgentExecutionSnapshot;
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  findings: readonly RelationDiscoveryFinding[];
  compilations: readonly RelationDiscoveryProposalCompilation[];
  semanticReviews: readonly Readonly<{
    jobId: Hash;
    proposalId: Hash;
    status: string;
  }>[];
  probabilityJobs: readonly Readonly<{
    jobId: Hash;
    proposalId: Hash;
  }>[];
  opportunities: readonly Readonly<{
    opportunityId: string;
  }>[];
  observedAt: string;
}>): StandingOntologyRouteValueProjection {
  const observedMs = Date.parse(input.observedAt);
  if (!Number.isFinite(observedMs) || new Date(observedMs).toISOString() !== input.observedAt) {
    throw new Error("standing route value observedAt must be canonical ISO time");
  }
  const values = Object.freeze(input.projection.families.map(({ family, observation }) => {
    const episodes = orderedStandingOntologyRouteObservationHistory(
      input.episodes,
      family.routeFamilyId,
    );
    const followups = input.followups.filter((item) =>
      item.routeFamilyId === family.routeFamilyId
    );
    const historicalFollowupWorkItemIds = episodes.flatMap((episode) =>
      episode.followupEligible && episode.membershipIdentity !== null
        ? [standingOntologyRouteFollowupIdentity({
            routeFamilyId: episode.routeFamilyId,
            observationMembershipIdentity: episode.membershipIdentity,
          }).workItemId]
        : []
    );
    const followupWorkItemIds = uniqueHashes([
      ...followups.map((item) => item.workItem.workItemId),
      ...historicalFollowupWorkItemIds,
    ]);
    const revisions = input.taskRevisions.filter((item) =>
      followupWorkItemIds.includes(item.workItemId)
    );
    const taskIds = new Set(revisions.map((item) => item.task.taskId));
    const followupRunIds = uniqueHashes(input.execution.runs.filter((item) =>
      taskIds.has(item.taskId)
    ).map((item) => item.runId));
    const followupRunIdSet = new Set(followupRunIds);
    const findings = input.findings.filter((item) =>
      followupWorkItemIds.includes(item.workItemId) && followupRunIdSet.has(item.sourceAgentRunId)
    );
    const positiveFindingIds = uniqueHashes(findings.filter((item) =>
      item.kind === "RELATION_HYPOTHESIS"
    ).map((item) => item.findingId));
    const counterexampleIds = uniqueHashes(findings.filter((item) =>
      item.kind === "COUNTEREXAMPLE"
    ).map((item) => item.findingId));
    const semanticProposalIds = uniqueHashes(input.compilations.filter((item) =>
      followupWorkItemIds.includes(item.origin.workItemId)
    ).map((item) => item.proposal.proposalId));
    const semanticReviews = input.semanticReviews.filter((item) =>
      semanticProposalIds.includes(item.proposalId)
    );
    const probabilityJobs = input.probabilityJobs.filter((item) =>
      semanticProposalIds.includes(item.proposalId)
    );
    const opportunityIds = Object.freeze(input.opportunities.map((item) =>
      item.opportunityId
    ).filter((opportunityId) => semanticProposalIds.some((proposalId) =>
      opportunityId === `ai:${proposalId}`
    )).sort());
    const creationUsage = usageForRuns(input.execution, family.authoringRunIds);
    const followupUsage = usageForRuns(input.execution, followupRunIds);
    const latestEpisode = episodes.at(-1) ?? null;
    const quietDurationMs = observation.state === "QUIESCENT"
      ? BigInt(Math.max(0, observedMs - Date.parse(
          latestEpisode?.state === "QUIESCENT"
            ? latestEpisode.observedAt
            : family.firstRecordedAt,
        ))).toString()
      : null;
    const totalQuietDurationMs = episodes.reduce((total, episode, index) => {
      if (episode.state !== "QUIESCENT") return total;
      const next = episodes[index + 1];
      const endMs = Math.min(observedMs, Date.parse(next?.observedAt ?? input.observedAt));
      return total + BigInt(Math.max(0, endMs - Date.parse(episode.observedAt)));
    }, 0n).toString();
    const valueStage = opportunityIds.length > 0
      ? "OPPORTUNITY_PROGRESS" as const
      : probabilityJobs.length > 0
        ? "PROBABILITY_RESEARCH" as const
        : semanticReviews.some((item) => item.status === "PASS")
          ? "SEMANTICALLY_REVIEWED" as const
          : positiveFindingIds.length > 0
            ? "POSITIVE_FINDING" as const
            : counterexampleIds.length > 0
              ? "NEGATIVE_EVIDENCE" as const
              : followupRunIds.length > 0
                ? "WAKE_ATTEMPTED" as const
                  : followupWorkItemIds.length > 0
                  ? "WAKE_UNATTEMPTED" as const
                  : "QUIET_MEMORY" as const;
    const body = Object.freeze({
      schemaVersion: "pmh.standing-ontology-route-family-value.v2" as const,
      routeFamilyId: family.routeFamilyId,
      observedAt: input.observedAt,
      currentState: observation.state,
      quietDurationMs,
      totalQuietDurationMs,
      firstObservedAt: episodes[0]?.observedAt ?? null,
      lastTransitionAt: latestEpisode?.observedAt ?? null,
      observationEpisodeCount: episodes.length,
      sourceCount: family.sourceCount,
      observedWakeCount: episodes.filter((item) => item.followupEligible).length,
      creationUsage,
      followupUsage,
      followupWorkItemIds,
      followupRunIds,
      positiveFindingIds,
      counterexampleIds,
      semanticProposalIds,
      semanticReviewJobIds: uniqueHashes(semanticReviews.map((item) => item.jobId)),
      semanticReviewPassCount: semanticReviews.filter((item) => item.status === "PASS").length,
      probabilityJobIds: uniqueHashes(probabilityJobs.map((item) => item.jobId)),
      opportunityIds,
      valueStage,
      authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY" as const,
      causalClaim: false as const,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    return Object.freeze({ ...body, valueId: hashCanonical(body) });
  }).sort((left, right) => left.routeFamilyId.localeCompare(right.routeFamilyId)));
  const body = Object.freeze({
    schemaVersion: "pmh.standing-ontology-route-value-projection.v2" as const,
    observedAt: input.observedAt,
    familyCount: values.length,
    totalCreationUsage: sumUsage(values.map((item) => item.creationUsage)),
    totalFollowupUsage: sumUsage(values.map((item) => item.followupUsage)),
    values,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY" as const,
    causalClaim: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
