import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertMarketOntologySnapshot,
  marketOntologyPredicateFamiliesForText,
  type MarketOntologyListingNode,
  type MarketOntologyPredicateFamily,
  type MarketOntologySnapshot,
} from "./market-ontology.js";
import type { MarketOntologyListingBinding } from "./market-ontology-agent-tools.js";
import {
  assertOntologySearchIssueRevision,
  type OntologySearchIssueRevision,
} from "./ontology-search-ecology.js";
import {
  assertOntologyRelationWorkItem,
  type OntologyRelationWorkItem,
} from "./ontology-relation-work.js";
import type { OperationalStorageProjection } from "./types.js";
import type {
  ConsolidatedWorldStateMechanismRoute,
} from "./world-state-mechanism.js";

const MAX_ROLE_MEMBERS = 8;

export type WorldStateMechanismSubjectBindingReview = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-subject-binding-review.v1";
  reviewId: Hash;
  routeFamilyId: Hash;
  sourceProposalIds: readonly Hash[];
  decision: "APPROVED" | "REJECTED" | "NEEDS_EVIDENCE";
  approvedLabels: readonly string[];
  rejectedLabels: readonly string[];
  rationale: string;
  reviewerRef: string;
  reviewedAt: string;
  authority: "SUBJECT_BINDING_REVIEW_ONLY";
  semanticRelationAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export function worldStateMechanismSubjectBindingReviewCoversRoute(
  review: WorldStateMechanismSubjectBindingReview,
  route: Pick<ConsolidatedWorldStateMechanismRoute, "routeFamilyId" | "sourceProposalIds">,
): boolean {
  return review.routeFamilyId === route.routeFamilyId &&
    [...new Set(review.sourceProposalIds)].sort().join("\n") ===
      [...new Set(route.sourceProposalIds)].sort().join("\n");
}

export type WorldStateMechanismRoleMembership = Readonly<{
  role: "TRIGGER" | "DEPENDENT";
  listingRef: string;
  title: string;
  nodeId: Hash;
  worldFacetId: Hash;
  sourceRawHash: Hash;
  protocolIdentity: string;
  matchedSubjectLabel: string;
  predicateFamilies: readonly MarketOntologyPredicateFamily[];
  temporalSignals: readonly string[];
}>;

export type WorldStateMechanismObservation = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-observation.v1";
  observationId: Hash;
  routeFamilyId: Hash;
  routeId: Hash;
  ontologyIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  subjectBindingReviewId: Hash | null;
  status:
    | "OBSERVED"
    | "BLOCKED_SUBJECT_BINDING"
    | "BROAD_ROLE_MEMBERSHIP"
    | "NO_TIME_COMPATIBLE_PAIR";
  triggerMembers: readonly WorldStateMechanismRoleMembership[];
  dependentMembers: readonly WorldStateMechanismRoleMembership[];
  compatiblePairs: readonly Readonly<{
    triggerListingRef: string;
    dependentListingRef: string;
  }>[];
  membershipIdentity: Hash;
  observedAt: string;
  authority: "WORLD_STATE_MECHANISM_OBSERVATION_ONLY";
  providerRequests: 0;
  modelInvocations: 0;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateMechanismWake = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-wake.v1";
  wakeId: Hash;
  routeFamilyId: Hash;
  previousObservationId: Hash;
  currentObservationId: Hash;
  newTriggerListingRefs: readonly string[];
  newDependentListingRefs: readonly string[];
  workItem: OntologyRelationWorkItem;
  observedAt: string;
  authority: "RELATION_RESEARCH_SUPPLY_ONLY";
  providerRequests: 0;
  modelInvocations: 0;
  campaignActivationAuthority: false;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface WorldStateMechanismObservationStore {
  readonly worldStateMechanismObservationStorage:
    OperationalStorageProjection<"observationId">;
  loadWorldStateMechanismObservations(
    limit: number,
  ): readonly WorldStateMechanismObservation[];
  saveWorldStateMechanismObservations(
    observations: readonly WorldStateMechanismObservation[],
  ): readonly WorldStateMechanismObservation[];
}

export interface WorldStateMechanismWakeStore {
  readonly worldStateMechanismWakeStorage: OperationalStorageProjection<"wakeId">;
  loadWorldStateMechanismWakes(limit: number): readonly WorldStateMechanismWake[];
  saveWorldStateMechanismWakes(
    wakes: readonly WorldStateMechanismWake[],
  ): readonly WorldStateMechanismWake[];
}

export interface WorldStateMechanismSubjectBindingReviewStore {
  readonly worldStateMechanismSubjectBindingReviewStorage:
    OperationalStorageProjection<"reviewId">;
  loadWorldStateMechanismSubjectBindingReviews(
    limit: number,
  ): readonly WorldStateMechanismSubjectBindingReview[];
  saveWorldStateMechanismSubjectBindingReviews(
    reviews: readonly WorldStateMechanismSubjectBindingReview[],
  ): readonly WorldStateMechanismSubjectBindingReview[];
}

function canonicalText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

function canonicalTexts(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map(canonicalText))].sort());
}

function canonicalIso(value: string, name: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`${name} must be a canonical ISO timestamp`);
  }
  return value;
}

function object(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  name: string,
): void {
  const keys = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (keys.length !== canonical.length || keys.some((key, index) =>
    key !== canonical[index]
  )) throw new Error(`${name} contains unknown or missing fields`);
}

function hashArray(value: unknown, minimum = 0): value is readonly Hash[] {
  return Array.isArray(value) && value.length >= minimum &&
    value.every((item) => typeof item === "string" && /^sha256:[0-9a-f]{64}$/u.test(item)) &&
    new Set(value).size === value.length &&
    [...value].sort().join("\n") === value.join("\n");
}

export function assertWorldStateMechanismSubjectBindingReview(
  value: unknown,
): WorldStateMechanismSubjectBindingReview {
  const review = object(value, "world-state mechanism subject binding review");
  exactKeys(review, [
    "schemaVersion", "reviewId", "routeFamilyId", "sourceProposalIds", "decision",
    "approvedLabels", "rejectedLabels", "rationale", "reviewerRef", "reviewedAt",
    "authority", "semanticRelationAuthority", "probabilityAuthority",
    "certificateAuthority", "executionAuthority", "externalWriteAuthority",
    "valueMovingAuthority",
  ], "world-state mechanism subject binding review");
  const typed = review as unknown as WorldStateMechanismSubjectBindingReview;
  const { reviewId, ...body } = typed;
  if (typed.schemaVersion !== "pmh.world-state-mechanism-subject-binding-review.v1" ||
      !/^sha256:[0-9a-f]{64}$/u.test(String(reviewId)) || reviewId !== hashCanonical(body) ||
      !/^sha256:[0-9a-f]{64}$/u.test(String(typed.routeFamilyId)) ||
      !hashArray(typed.sourceProposalIds, 1) ||
      !["APPROVED", "REJECTED", "NEEDS_EVIDENCE"].includes(typed.decision) ||
      !Array.isArray(typed.approvedLabels) || !Array.isArray(typed.rejectedLabels) ||
      typed.approvedLabels.some((item) => typeof item !== "string" || item !== canonicalText(item)) ||
      typed.rejectedLabels.some((item) => typeof item !== "string" || item !== canonicalText(item)) ||
      new Set(typed.approvedLabels).size !== typed.approvedLabels.length ||
      new Set(typed.rejectedLabels).size !== typed.rejectedLabels.length ||
      typed.approvedLabels.some((item) => typed.rejectedLabels.includes(item)) ||
      (typed.decision === "APPROVED") !== (typed.approvedLabels.length > 0) ||
      typeof typed.rationale !== "string" || typed.rationale.trim() === "" ||
      typed.rationale.length > 2_000 || typeof typed.reviewerRef !== "string" ||
      typed.reviewerRef.trim() === "" || typed.reviewerRef.length > 240 ||
      canonicalIso(typed.reviewedAt, "subject binding reviewedAt") !== typed.reviewedAt ||
      typed.authority !== "SUBJECT_BINDING_REVIEW_ONLY" ||
      typed.semanticRelationAuthority !== false || typed.probabilityAuthority !== false ||
      typed.certificateAuthority !== false || typed.executionAuthority !== false ||
      typed.externalWriteAuthority !== false || typed.valueMovingAuthority !== false) {
    throw new Error("world-state mechanism subject binding review is invalid");
  }
  return Object.freeze(typed);
}

function assertRoleMembership(value: unknown): WorldStateMechanismRoleMembership {
  const member = object(value, "world-state mechanism role membership");
  exactKeys(member, [
    "role", "listingRef", "title", "nodeId", "worldFacetId", "sourceRawHash",
    "protocolIdentity", "matchedSubjectLabel", "predicateFamilies", "temporalSignals",
  ], "world-state mechanism role membership");
  const typed = member as unknown as WorldStateMechanismRoleMembership;
  if (!["TRIGGER", "DEPENDENT"].includes(typed.role) ||
      [typed.listingRef, typed.title, typed.protocolIdentity, typed.matchedSubjectLabel]
        .some((item) => typeof item !== "string" || item.trim() === "") ||
      ![typed.nodeId, typed.worldFacetId, typed.sourceRawHash].every((item) =>
        /^sha256:[0-9a-f]{64}$/u.test(String(item))
      ) || !Array.isArray(typed.predicateFamilies) ||
      typed.predicateFamilies.length === 0 || !Array.isArray(typed.temporalSignals) ||
      typed.temporalSignals.some((item) => typeof item !== "string")) {
    throw new Error("world-state mechanism role membership is invalid");
  }
  return Object.freeze(typed);
}

export function assertWorldStateMechanismObservation(
  value: unknown,
): WorldStateMechanismObservation {
  const observation = object(value, "world-state mechanism observation");
  exactKeys(observation, [
    "schemaVersion", "observationId", "routeFamilyId", "routeId", "ontologyIdentity",
    "sourceSnapshotIdentity", "subjectBindingReviewId", "status", "triggerMembers",
    "dependentMembers", "compatiblePairs", "membershipIdentity", "observedAt",
    "authority", "providerRequests", "modelInvocations", "automaticDispatch",
    "semanticDecisionAuthority", "probabilityAuthority", "certificateAuthority",
    "executionAuthority", "externalWriteAuthority", "valueMovingAuthority",
  ], "world-state mechanism observation");
  const typed = observation as unknown as WorldStateMechanismObservation;
  const { observationId, ...body } = typed;
  const triggerMembers = Array.isArray(typed.triggerMembers)
    ? typed.triggerMembers.map(assertRoleMembership) : [];
  const dependentMembers = Array.isArray(typed.dependentMembers)
    ? typed.dependentMembers.map(assertRoleMembership) : [];
  const compatiblePairs = Array.isArray(typed.compatiblePairs)
    ? typed.compatiblePairs.map((value) => {
        const pair = object(value, "world-state mechanism compatible pair");
        exactKeys(pair, ["triggerListingRef", "dependentListingRef"],
          "world-state mechanism compatible pair");
        if (typeof pair.triggerListingRef !== "string" ||
            typeof pair.dependentListingRef !== "string") {
          throw new Error("world-state mechanism compatible pair is invalid");
        }
        return Object.freeze({
          triggerListingRef: pair.triggerListingRef,
          dependentListingRef: pair.dependentListingRef,
        });
      }) : [];
  const membershipIdentity = hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-membership.v1",
    routeFamilyId: typed.routeFamilyId,
    subjectBindingReviewId: typed.subjectBindingReviewId,
    triggerListingRefs: triggerMembers.map((item) => item.listingRef),
    dependentListingRefs: dependentMembers.map((item) => item.listingRef),
    compatiblePairs,
    broad: typed.status === "BROAD_ROLE_MEMBERSHIP",
  });
  if (typed.schemaVersion !== "pmh.world-state-mechanism-observation.v1" ||
      ![observationId, typed.routeFamilyId, typed.routeId, typed.ontologyIdentity,
        typed.sourceSnapshotIdentity, typed.membershipIdentity].every((item) =>
        /^sha256:[0-9a-f]{64}$/u.test(String(item))
      ) || observationId !== hashCanonical(body) ||
      typed.membershipIdentity !== membershipIdentity ||
      typed.subjectBindingReviewId !== null &&
        !/^sha256:[0-9a-f]{64}$/u.test(String(typed.subjectBindingReviewId)) ||
      !["OBSERVED", "BLOCKED_SUBJECT_BINDING", "BROAD_ROLE_MEMBERSHIP",
        "NO_TIME_COMPATIBLE_PAIR"].includes(typed.status) ||
      triggerMembers.length > MAX_ROLE_MEMBERS || dependentMembers.length > MAX_ROLE_MEMBERS ||
      triggerMembers.some((item) => item.role !== "TRIGGER") ||
      dependentMembers.some((item) => item.role !== "DEPENDENT") ||
      new Set(triggerMembers.map((item) => item.listingRef)).size !== triggerMembers.length ||
      new Set(dependentMembers.map((item) => item.listingRef)).size !== dependentMembers.length ||
      compatiblePairs.some((pair) => !triggerMembers.some((item) =>
        item.listingRef === pair.triggerListingRef
      ) || !dependentMembers.some((item) => item.listingRef === pair.dependentListingRef)) ||
      canonicalIso(typed.observedAt, "mechanism observation observedAt") !== typed.observedAt ||
      typed.authority !== "WORLD_STATE_MECHANISM_OBSERVATION_ONLY" ||
      typed.providerRequests !== 0 || typed.modelInvocations !== 0 ||
      typed.automaticDispatch !== false || typed.semanticDecisionAuthority !== false ||
      typed.probabilityAuthority !== false || typed.certificateAuthority !== false ||
      typed.executionAuthority !== false || typed.externalWriteAuthority !== false ||
      typed.valueMovingAuthority !== false) {
    throw new Error("world-state mechanism observation is invalid");
  }
  return Object.freeze({
    ...typed,
    triggerMembers: Object.freeze(triggerMembers),
    dependentMembers: Object.freeze(dependentMembers),
    compatiblePairs: Object.freeze(compatiblePairs),
  });
}

export function assertWorldStateMechanismWake(value: unknown): WorldStateMechanismWake {
  const wake = object(value, "world-state mechanism wake");
  exactKeys(wake, [
    "schemaVersion", "wakeId", "routeFamilyId", "previousObservationId",
    "currentObservationId", "newTriggerListingRefs", "newDependentListingRefs",
    "workItem", "observedAt", "authority", "providerRequests", "modelInvocations",
    "campaignActivationAuthority", "automaticDispatch", "semanticDecisionAuthority",
    "probabilityAuthority", "certificateAuthority", "executionAuthority",
    "externalWriteAuthority", "valueMovingAuthority",
  ], "world-state mechanism wake");
  const typed = wake as unknown as WorldStateMechanismWake;
  const { wakeId, ...body } = typed;
  const workItem = assertOntologyRelationWorkItem(typed.workItem);
  if (typed.schemaVersion !== "pmh.world-state-mechanism-wake.v1" ||
      ![wakeId, typed.routeFamilyId, typed.previousObservationId,
        typed.currentObservationId].every((item) =>
        /^sha256:[0-9a-f]{64}$/u.test(String(item))
      ) || wakeId !== hashCanonical(body) ||
      !Array.isArray(typed.newTriggerListingRefs) ||
      !Array.isArray(typed.newDependentListingRefs) ||
      [...typed.newTriggerListingRefs, ...typed.newDependentListingRefs]
        .some((item) => typeof item !== "string" || item.trim() === "") ||
      typed.newTriggerListingRefs.length + typed.newDependentListingRefs.length === 0 ||
      canonicalIso(typed.observedAt, "mechanism wake observedAt") !== typed.observedAt ||
      typed.authority !== "RELATION_RESEARCH_SUPPLY_ONLY" ||
      typed.providerRequests !== 0 || typed.modelInvocations !== 0 ||
      typed.campaignActivationAuthority !== false || typed.automaticDispatch !== false ||
      typed.semanticDecisionAuthority !== false || typed.probabilityAuthority !== false ||
      typed.certificateAuthority !== false || typed.executionAuthority !== false ||
      typed.externalWriteAuthority !== false || typed.valueMovingAuthority !== false ||
      workItem.kind !== "STANDING_ROUTE_FOLLOWUP" ||
      workItem.disposition !== "RUNNABLE_RESEARCH") {
    throw new Error("world-state mechanism wake is invalid");
  }
  return Object.freeze({ ...typed, workItem });
}

export function buildWorldStateMechanismSubjectBindingReview(input: Readonly<{
  route: ConsolidatedWorldStateMechanismRoute;
  decision: WorldStateMechanismSubjectBindingReview["decision"];
  approvedLabels: readonly string[];
  rejectedLabels: readonly string[];
  rationale: string;
  reviewerRef: string;
  reviewedAt: string;
}>): WorldStateMechanismSubjectBindingReview {
  const approvedLabels = canonicalTexts(input.approvedLabels);
  const rejectedLabels = canonicalTexts(input.rejectedLabels);
  const routeLabels = new Set(input.route.canonicalRoute.canonicalSubjectLabels);
  if (approvedLabels.some((label) => !routeLabels.has(label)) ||
      rejectedLabels.some((label) => !routeLabels.has(label)) ||
      approvedLabels.some((label) => rejectedLabels.includes(label)) ||
      input.decision === "APPROVED" && approvedLabels.length === 0 ||
      input.decision !== "APPROVED" && approvedLabels.length > 0 ||
      input.rationale.trim() === "" || input.rationale.length > 2_000 ||
      input.reviewerRef.trim() === "" || input.reviewerRef.length > 240) {
    throw new Error("world-state mechanism subject binding review is invalid");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-mechanism-subject-binding-review.v1" as const,
    routeFamilyId: input.route.routeFamilyId,
    sourceProposalIds: input.route.sourceProposalIds,
    decision: input.decision,
    approvedLabels,
    rejectedLabels,
    rationale: input.rationale.trim().replace(/\s+/gu, " "),
    reviewerRef: input.reviewerRef.trim(),
    reviewedAt: canonicalIso(input.reviewedAt, "subject binding reviewedAt"),
    authority: "SUBJECT_BINDING_REVIEW_ONLY" as const,
    semanticRelationAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateMechanismSubjectBindingReview(Object.freeze({
    ...body,
    reviewId: hashCanonical(body),
  }));
}

function titleContainsLabel(title: string, label: string): boolean {
  const haystack = ` ${canonicalText(title).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const needle = canonicalText(label).replace(/[^\p{L}\p{N}]+/gu, " ");
  return needle !== "" && haystack.includes(` ${needle} `);
}

const MONTH_RANK = new Map([
  ["january", 1], ["february", 2], ["march", 3], ["april", 4],
  ["may", 5], ["june", 6], ["july", 7], ["august", 8],
  ["september", 9], ["october", 10], ["november", 11], ["december", 12],
]);

function temporalRanks(signals: readonly string[]): readonly number[] {
  const years = signals.flatMap((signal) => {
    const match = signal.match(/\b20\d{2}\b/u);
    return match === null ? [] : [Number(match[0])];
  });
  const months = signals.flatMap((signal) => {
    const rank = MONTH_RANK.get(canonicalText(signal));
    return rank === undefined ? [] : [rank];
  });
  if (years.length > 0 && months.length > 0) {
    return Object.freeze(years.flatMap((year) => months.map((month) => year * 12 + month)));
  }
  if (years.length > 0) return Object.freeze(years.map((year) => year * 12));
  return Object.freeze(months);
}

function timeCompatible(
  route: ConsolidatedWorldStateMechanismRoute,
  trigger: WorldStateMechanismRoleMembership,
  dependent: WorldStateMechanismRoleMembership,
): boolean {
  if (route.canonicalRoute.temporalPosture === "ORDER_UNCERTAIN") return true;
  const triggerRanks = temporalRanks(trigger.temporalSignals);
  const dependentRanks = temporalRanks(dependent.temporalSignals);
  if (triggerRanks.length === 0 || dependentRanks.length === 0) return false;
  return route.canonicalRoute.temporalPosture === "TRIGGER_PRECEDES_DEPENDENT"
    ? triggerRanks.some((left) => dependentRanks.some((right) => left <= right))
    : triggerRanks.some((left) => dependentRanks.some((right) => left === right));
}

function roleMembers(input: Readonly<{
  role: WorldStateMechanismRoleMembership["role"];
  route: ConsolidatedWorldStateMechanismRoute;
  nodes: readonly Readonly<{ node: MarketOntologyListingNode; title: string }>[];
  approvedLabels: readonly string[];
}>): readonly WorldStateMechanismRoleMembership[] {
  const predicateText = input.role === "TRIGGER"
    ? `${input.route.canonicalRoute.triggerPredicate} ${
      input.route.canonicalRoute.canonicalTriggerSearchSignals.join(" ")}`
    : `${input.route.canonicalRoute.dependentPredicate} ${
      input.route.canonicalRoute.canonicalDependentSearchSignals.join(" ")}`;
  const expectedFamilies = new Set(marketOntologyPredicateFamiliesForText(predicateText));
  const boundedExpectedFamilies = new Set([...expectedFamilies].filter((family) =>
    family !== "UNCLASSIFIED"
  ));
  const exactSearchSignals = (input.role === "TRIGGER"
    ? input.route.canonicalRoute.canonicalTriggerSearchSignals
    : input.route.canonicalRoute.canonicalDependentSearchSignals).map(canonicalText);
  return Object.freeze(input.nodes.flatMap(({ node, title }) => {
    const matchedSubjectLabel = input.approvedLabels.find((label) =>
      titleContainsLabel(title, label)
    );
    const familyMatch = node.worldFacet.predicateFamilies.some((family) =>
      family !== "UNCLASSIFIED" && boundedExpectedFamilies.has(family)
    );
    const normalizedTitle = canonicalText(title);
    const exactSignalMatch = exactSearchSignals.some((signal) =>
      signal !== "" && normalizedTitle.includes(signal)
    );
    return matchedSubjectLabel === undefined || (!familyMatch && !exactSignalMatch)
      ? []
      : [Object.freeze({
          role: input.role,
          listingRef: node.listingRef,
          title,
          nodeId: node.nodeId,
          worldFacetId: node.worldFacet.facetId,
          sourceRawHash: node.settlementFacet.sourceRawHash as Hash,
          protocolIdentity: node.settlementFacet.protocolIdentity,
          matchedSubjectLabel,
          predicateFamilies: node.worldFacet.predicateFamilies,
          temporalSignals: node.worldFacet.temporalSignals,
        })];
  }).sort((left, right) => left.listingRef.localeCompare(right.listingRef)));
}

function membership(
  role: WorldStateMechanismRoleMembership["role"],
  route: ConsolidatedWorldStateMechanismRoute,
  ontology: MarketOntologySnapshot,
  titlesByRef: ReadonlyMap<string, string>,
  approvedLabels: readonly string[],
): readonly WorldStateMechanismRoleMembership[] {
  const nodes = ontology.nodes.map((node) => Object.freeze({
    node,
    title: titlesByRef.get(node.listingRef) ?? "",
  }));
  return roleMembers({ role, route, nodes, approvedLabels });
}

function listingBinding(node: MarketOntologyListingNode): MarketOntologyListingBinding {
  return Object.freeze({
    listingRef: node.listingRef,
    nodeId: node.nodeId,
    worldFacetId: node.worldFacet.facetId,
    settlementFacetId: node.settlementFacet.facetId,
    tradedFacetId: node.tradedFacet.facetId,
  });
}

function mechanismWorkItem(input: Readonly<{
  route: ConsolidatedWorldStateMechanismRoute;
  observation: WorldStateMechanismObservation;
  ontology: MarketOntologySnapshot;
  revisions: readonly OntologySearchIssueRevision[];
}>): OntologyRelationWorkItem {
  const revisions = input.revisions.filter((revision) =>
    input.route.sourceIssueRevisionIds.includes(revision.revisionId)
  );
  const nodesByRef = new Map(input.ontology.nodes.map((node) => [node.listingRef, node]));
  const seedRefs = [...new Set(input.observation.compatiblePairs.flatMap((pair) =>
    [pair.triggerListingRef, pair.dependentListingRef]
  ))].sort();
  const seedListingBindings = Object.freeze(seedRefs.map((ref) =>
    listingBinding(nodesByRef.get(ref)!)
  ));
  const searchScopeIdentity = hashCanonical({
    schemaVersion: "pmh.world-state-mechanism-relation-scope.v1",
    routeFamilyId: input.route.routeFamilyId,
    membershipIdentity: input.observation.membershipIdentity,
  });
  const workItemId = hashCanonical({
    schemaVersion: "pmh.ontology-relation-work-id.v1",
    searchScopeIdentity,
  });
  const sourceTimes = [input.route.firstProposedAt, input.route.lastProposedAt].sort();
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-relation-work.v1" as const,
    workItemId,
    searchScopeIdentity,
    kind: "STANDING_ROUTE_FOLLOWUP" as const,
    disposition: "RUNNABLE_RESEARCH" as const,
    sourceProposalIds: input.route.sourceProposalIds,
    sourceAgentRunIds: input.route.sourceAgentRunIds,
    sourceIssueIds: Object.freeze([...new Set(revisions.map((item) => item.issueId))].sort()),
    sourceIssueRevisionIds: input.route.sourceIssueRevisionIds,
    sourceOntologyIdentities: input.route.sourceOntologyIdentities,
    sourceSnapshotIdentities: input.route.sourceSnapshotIdentities,
    sourceRelationPatternIds: input.route.sourceRelationPatternIds,
    sourceTrailheadIds: input.route.sourceTrailheadIds,
    sourceSelectionLanes: Object.freeze([...new Set(revisions
      .map((item) => item.selectionLane))].sort()),
    sourceListingBindingCount: seedListingBindings.length,
    seedListingBindings,
    seedListingBindingsTruncated: false,
    title: `Mechanism wake · ${input.route.canonicalRoute.canonicalSubjectLabels[0]}`
      .slice(0, 240),
    question: (
      `Inspect the exact trigger/dependent pairs supplied by world-state mechanism ${
        input.route.routeFamilyId}. Determine whether any candidate relation is ` +
      `IMPLIES, MUTUALLY_EXCLUSIVE, CONDITIONAL, or CONFLICTING under exact venue ` +
      `rules. The mechanism is routing-only; enumerate its counter-scenarios and do ` +
      `not assume causality, probability, or arbitrage.`
    ).slice(0, 2_000),
    searchSignals: Object.freeze([...new Set([
      ...input.route.canonicalRoute.canonicalSubjectLabels,
      ...input.route.canonicalRoute.canonicalTriggerSearchSignals,
      ...input.route.canonicalRoute.canonicalDependentSearchSignals,
      input.route.canonicalRoute.stateLabel,
    ])].slice(0, 24)),
    candidateRelationKinds: Object.freeze([
      "IMPLIES", "MUTUALLY_EXCLUSIVE", "CONDITIONAL", "CONFLICTING",
    ] as const),
    falsifiers: Object.freeze(input.route.counterScenarios.slice(0, 24)
      .map((item) => item.slice(0, 240))),
    priority: 5 as const,
    firstProposedAt: sourceTimes[0]!,
    lastProposedAt: sourceTimes.at(-1)!,
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
  return assertOntologyRelationWorkItem(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function observeWorldStateMechanismRoutes(input: Readonly<{
  routes: readonly ConsolidatedWorldStateMechanismRoute[];
  ontology: MarketOntologySnapshot;
  listingTitles: ReadonlyMap<string, string>;
  subjectBindingReviews: readonly WorldStateMechanismSubjectBindingReview[];
  priorObservations: readonly WorldStateMechanismObservation[];
  issueRevisions: readonly OntologySearchIssueRevision[];
  observedAt: string;
}>): Readonly<{
  observations: readonly WorldStateMechanismObservation[];
  wakes: readonly WorldStateMechanismWake[];
  providerRequests: 0;
  modelInvocations: 0;
  campaigns: 0;
  runs: 0;
  dispatches: 0;
  externalWrites: 0;
  valueMovingActions: 0;
}> {
  const ontology = assertMarketOntologySnapshot(input.ontology);
  const observedAt = canonicalIso(input.observedAt, "mechanism observation observedAt");
  const priorObservations = input.priorObservations
    .map(assertWorldStateMechanismObservation);
  const revisions = input.issueRevisions.map(assertOntologySearchIssueRevision);
  const observations: WorldStateMechanismObservation[] = [];
  const wakes: WorldStateMechanismWake[] = [];
  for (const route of input.routes) {
    const review = [...input.subjectBindingReviews]
      .filter((item) => worldStateMechanismSubjectBindingReviewCoversRoute(item, route))
      .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt) ||
        right.reviewId.localeCompare(left.reviewId))[0] ?? null;
    // A newly selected review establishes its own baseline. It must not turn
    // pre-review catalog contents or a changed alias policy into a false wake.
    const previous = priorObservations.filter((item) =>
      item.routeFamilyId === route.routeFamilyId &&
      item.subjectBindingReviewId === (review?.reviewId ?? null)
    ).sort((left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.observationId.localeCompare(right.observationId)
    ).at(-1);
    const approvedLabels = review?.decision === "APPROVED" ? review.approvedLabels : [];
    const triggerMembers = membership(
      "TRIGGER", route, ontology, input.listingTitles, approvedLabels,
    );
    const dependentMembers = membership(
      "DEPENDENT", route, ontology, input.listingTitles, approvedLabels,
    );
    const broad = triggerMembers.length > MAX_ROLE_MEMBERS ||
      dependentMembers.length > MAX_ROLE_MEMBERS;
    const boundedTriggers = Object.freeze(triggerMembers.slice(0, MAX_ROLE_MEMBERS));
    const boundedDependents = Object.freeze(dependentMembers.slice(0, MAX_ROLE_MEMBERS));
    const compatiblePairs = Object.freeze(broad ? [] : boundedTriggers.flatMap((trigger) =>
      boundedDependents.flatMap((dependent) =>
        trigger.listingRef !== dependent.listingRef && timeCompatible(route, trigger, dependent)
          ? [Object.freeze({
              triggerListingRef: trigger.listingRef,
              dependentListingRef: dependent.listingRef,
            })]
          : []
      )
    ));
    const membershipIdentity = hashCanonical({
      schemaVersion: "pmh.world-state-mechanism-membership.v1",
      routeFamilyId: route.routeFamilyId,
      subjectBindingReviewId: review?.reviewId ?? null,
      triggerListingRefs: boundedTriggers.map((item) => item.listingRef),
      dependentListingRefs: boundedDependents.map((item) => item.listingRef),
      compatiblePairs,
      broad,
    });
    const status = review?.decision !== "APPROVED"
      ? "BLOCKED_SUBJECT_BINDING" as const
      : broad
      ? "BROAD_ROLE_MEMBERSHIP" as const
      : compatiblePairs.length === 0
      ? "NO_TIME_COMPATIBLE_PAIR" as const
      : "OBSERVED" as const;
    const body = Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-observation.v1" as const,
      routeFamilyId: route.routeFamilyId,
      routeId: route.routeId,
      ontologyIdentity: ontology.ontologyIdentity,
      sourceSnapshotIdentity: ontology.sourceSnapshotIdentity,
      subjectBindingReviewId: review?.reviewId ?? null,
      status,
      triggerMembers: boundedTriggers,
      dependentMembers: boundedDependents,
      compatiblePairs,
      membershipIdentity,
      observedAt,
      authority: "WORLD_STATE_MECHANISM_OBSERVATION_ONLY" as const,
      providerRequests: 0 as const,
      modelInvocations: 0 as const,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const observation = assertWorldStateMechanismObservation(Object.freeze({
      ...body,
      observationId: hashCanonical(body),
    }));
    // A catalog refresh is not itself a new mechanism observation. Retain the
    // first baseline and later semantic transitions, while leaving unchanged
    // route/review/status/membership state bound to its original evidence
    // snapshot. Historical duplicates remain valid evidence and need no rewrite.
    if (previous !== undefined &&
        previous.routeId === observation.routeId &&
        previous.subjectBindingReviewId === observation.subjectBindingReviewId &&
        previous.status === observation.status &&
        previous.membershipIdentity === observation.membershipIdentity) continue;
    observations.push(observation);
    if (previous === undefined || previous.status !== "OBSERVED" ||
        previous.membershipIdentity === membershipIdentity ||
        observation.status !== "OBSERVED") continue;
    const previousTriggerRefs = new Set(previous.triggerMembers.map((item) => item.listingRef));
    const previousDependentRefs = new Set(previous.dependentMembers.map((item) => item.listingRef));
    const newTriggerListingRefs = Object.freeze(observation.triggerMembers
      .map((item) => item.listingRef).filter((ref) => !previousTriggerRefs.has(ref)).sort());
    const newDependentListingRefs = Object.freeze(observation.dependentMembers
      .map((item) => item.listingRef).filter((ref) => !previousDependentRefs.has(ref)).sort());
    if (newTriggerListingRefs.length === 0 && newDependentListingRefs.length === 0) continue;
    const workItem = mechanismWorkItem({ route, observation, ontology, revisions });
    const wakeBody = Object.freeze({
      schemaVersion: "pmh.world-state-mechanism-wake.v1" as const,
      routeFamilyId: route.routeFamilyId,
      previousObservationId: previous.observationId,
      currentObservationId: observation.observationId,
      newTriggerListingRefs,
      newDependentListingRefs,
      workItem,
      observedAt,
      authority: "RELATION_RESEARCH_SUPPLY_ONLY" as const,
      providerRequests: 0 as const,
      modelInvocations: 0 as const,
      campaignActivationAuthority: false as const,
      automaticDispatch: false as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    wakes.push(assertWorldStateMechanismWake(Object.freeze({
      ...wakeBody,
      wakeId: hashCanonical(wakeBody),
    })));
  }
  return Object.freeze({
    observations: Object.freeze(observations),
    wakes: Object.freeze(wakes),
    providerRequests: 0 as const,
    modelInvocations: 0 as const,
    campaigns: 0 as const,
    runs: 0 as const,
    dispatches: 0 as const,
    externalWrites: 0 as const,
    valueMovingActions: 0 as const,
  });
}
