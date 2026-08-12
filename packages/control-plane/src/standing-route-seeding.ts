import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentExecutionSnapshot } from "./agent-execution-substrate.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import type { RelationDiscoveryRouteLayer } from "./relation-discovery-agent-tools.js";
import {
  assertRelationDiscoveryTaskRevision,
  relationDiscoveryRevisionWorkItem,
  type RelationDiscoveryTaskRevision,
} from "./relation-discovery-work.js";
import type { StandingOntologyRouteProjection } from "./standing-ontology-routes.js";

export const STANDING_ROUTE_SEED_SELECTION_PROTOCOL =
  "STANDING_ROUTE_SEED_SELECTION_V1" as const;
export const STANDING_ROUTE_SEED_INPUT_REVISION_KIND =
  "RELATION_DISCOVERY_ROUTE_SEED" as const;

export type StandingRouteSeedCandidate = Readonly<{
  schemaVersion: "pmh.standing-route-seed-candidate.v1";
  selectionActionRef: Hash;
  targetRouteLayer: RelationDiscoveryRouteLayer;
  sourceTaskRevisionId: Hash;
  sourceTaskId: Hash;
  workItemId: Hash;
  workArtifactHash: Hash;
  researchInputIdentity: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  selectionReason:
    | "ENTITY_ALIAS_SUBJECT_FIT"
    | "WORLD_PROPOSITION_EVENT_FIT"
    | "SETTLEMENT_DIVERGENCE_FIT";
  expectedSearchFields: readonly ("title" | "description" | "rulesText")[];
  sourceSelectionLanes: readonly (
    "CROSS_VENUE" | "WORLD_DIVERGENCE" | "SETTLEMENT_DIVERGENCE"
  )[];
  sourcePriority: 1 | 2 | 3 | 4 | 5;
  seedListingEvidenceCount: number;
  existingEquivalentRouteFamilyIds: readonly Hash[];
  attemptedExactIntent: boolean;
  eligibility: "SELECTABLE" | "HELD_EXISTING_ROUTE" | "HELD_ALREADY_ATTEMPTED" |
    "HELD_INSUFFICIENT_SETTLEMENT_EVIDENCE";
  authority: "ROUTE_SEED_SELECTION_ONLY";
  modelInvocationAuthority: false;
  campaignAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StandingRouteSeedSelectionProjection = Readonly<{
  schemaVersion: "pmh.standing-route-seed-selection.v1";
  selectionIdentity: Hash;
  policyIdentity: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  consideredCandidateCount: number;
  selectableCandidateCount: number;
  selectedCandidateCount: number;
  heldCandidateCount: number;
  unusedLayers: readonly RelationDiscoveryRouteLayer[];
  candidates: readonly StandingRouteSeedCandidate[];
  selected: readonly StandingRouteSeedCandidate[];
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  campaignsCreated: 0;
  runsCreated: 0;
  automaticDispatch: false;
  authority: "ROUTE_SEED_SELECTION_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const LAYER_ORDER: readonly RelationDiscoveryRouteLayer[] = Object.freeze([
  "SUBJECT_REFERENCE", "EVENT_REFERENCE", "SETTLEMENT_REFERENCE",
]);

function ordinaryCurrentRevisions(
  revisions: readonly RelationDiscoveryTaskRevision[],
): readonly RelationDiscoveryTaskRevision[] {
  const latest = new Map<Hash, RelationDiscoveryTaskRevision>();
  for (const input of revisions) {
    const revision = assertRelationDiscoveryTaskRevision(input);
    if (revision.schemaVersion === "pmh.relation-discovery-task-revision.v4") continue;
    const prior = latest.get(revision.workItemId);
    if (prior === undefined || revision.materializedAt > prior.materializedAt ||
        (revision.materializedAt === prior.materializedAt &&
          revision.revisionId > prior.revisionId)) {
      latest.set(revision.workItemId, revision);
    }
  }
  return Object.freeze([...latest.values()]);
}

function candidateLayer(
  revision: RelationDiscoveryTaskRevision,
): Readonly<{
  layer: RelationDiscoveryRouteLayer;
  reason: StandingRouteSeedCandidate["selectionReason"];
  fields: StandingRouteSeedCandidate["expectedSearchFields"];
}> | null {
  const work = relationDiscoveryRevisionWorkItem(revision);
  if (work.kind === "ENTITY_ALIAS_NEIGHBORHOOD") {
    return Object.freeze({
      layer: "SUBJECT_REFERENCE" as const,
      reason: "ENTITY_ALIAS_SUBJECT_FIT" as const,
      fields: Object.freeze(["title"] as const),
    });
  }
  if (work.kind !== "WORLD_PROPOSITION_NEIGHBORHOOD") return null;
  return work.sourceSelectionLanes.includes("SETTLEMENT_DIVERGENCE")
    ? Object.freeze({
        layer: "SETTLEMENT_REFERENCE" as const,
        reason: "SETTLEMENT_DIVERGENCE_FIT" as const,
        fields: Object.freeze(["description", "rulesText"] as const),
      })
    : Object.freeze({
        layer: "EVENT_REFERENCE" as const,
        reason: "WORLD_PROPOSITION_EVENT_FIT" as const,
        fields: Object.freeze(["title"] as const),
      });
}

export function buildStandingRouteSeedSelection(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  corpus: MarketCorpusSnapshot;
  standingRoutes: StandingOntologyRouteProjection | null;
  execution: AgentExecutionSnapshot;
}>): StandingRouteSeedSelectionProjection {
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const byListingRef = new Map(corpus.listings.map((item) => [item.listingRef, item]));
  const attemptedTaskIds = new Set(input.execution.runs.map((run) => run.taskId));
  const retainedActionRefs = new Set(input.execution.campaigns.flatMap((campaign) =>
    campaign.schemaVersion === "pmh.agent-campaign.v2" &&
      campaign.selectionBinding.selectionProtocol === STANDING_ROUTE_SEED_SELECTION_PROTOCOL
      ? campaign.selectionBinding.taskBindings.map((binding) => binding.selectionActionRef)
      : []
  ));
  const attemptedActionRefs = new Set([
    ...retainedActionRefs,
    ...input.revisions.flatMap((revisionInput) => {
    const revision = assertRelationDiscoveryTaskRevision(revisionInput);
    return revision.schemaVersion === "pmh.relation-discovery-task-revision.v4" &&
      revision.taskPayload.schemaVersion === "pmh.relation-discovery-task.v4" &&
      attemptedTaskIds.has(revision.task.taskId)
      ? [revision.taskPayload.researchIntent.selectionActionRef]
      : [];
    }),
  ]);
  const routes = input.standingRoutes?.routes ?? [];
  const familyByRoute = new Map(input.standingRoutes?.families.flatMap(({ family }) =>
    family.sourceRouteIds.map((routeId) => [routeId, family.routeFamilyId] as const)
  ) ?? []);
  const candidates = ordinaryCurrentRevisions(input.revisions).flatMap((revision) => {
    const fit = candidateLayer(revision);
    if (fit === null) return [];
    const work = relationDiscoveryRevisionWorkItem(revision);
    if (work.disposition !== "RUNNABLE_RESEARCH" || !work.campaignEligible ||
        work.kind === "STANDING_ROUTE_FOLLOWUP") return [];
    const actionBody = Object.freeze({
      schemaVersion: "pmh.standing-route-seed-selection-action.v1" as const,
      targetRouteLayer: fit.layer,
      sourceTaskRevisionId: revision.revisionId,
      workItemId: revision.workItemId,
      workArtifactHash: revision.workArtifactHash,
      researchInputIdentity: revision.schemaVersion ===
        "pmh.relation-discovery-task-revision.v1"
        ? revision.sourceCorpusSnapshotIdentity
        : revision.researchInputIdentity,
    });
    const selectionActionRef = hashCanonical(actionBody);
    const equivalentRouteFamilyIds = Object.freeze([...new Set(routes.flatMap(({ route }) =>
      route.routeLayer === fit.layer && route.sourceWorkItemId === revision.workItemId
        ? [familyByRoute.get(route.routeId)].filter((item): item is Hash => item !== undefined)
        : []
    ))].sort());
    const seedListings = work.seedListingBindings.flatMap((binding) => {
      const listing = byListingRef.get(binding.listingRef);
      return listing === undefined ? [] : [listing];
    });
    const seedListingEvidenceCount = seedListings.filter((listing) => fit.fields.some((field) =>
      field === "rulesText"
        ? (listing.rulesText ?? "").trim() !== ""
        : listing[field].trim() !== ""
    )).length;
    const attemptedExactIntent = attemptedActionRefs.has(selectionActionRef);
    const eligibility: StandingRouteSeedCandidate["eligibility"] =
      equivalentRouteFamilyIds.length > 0
        ? "HELD_EXISTING_ROUTE"
        : attemptedExactIntent
          ? "HELD_ALREADY_ATTEMPTED"
          : fit.layer === "SETTLEMENT_REFERENCE" && seedListingEvidenceCount === 0
            ? "HELD_INSUFFICIENT_SETTLEMENT_EVIDENCE"
            : "SELECTABLE";
    return [Object.freeze({
      schemaVersion: "pmh.standing-route-seed-candidate.v1" as const,
      selectionActionRef,
      targetRouteLayer: fit.layer,
      sourceTaskRevisionId: revision.revisionId,
      sourceTaskId: revision.task.taskId,
      workItemId: revision.workItemId,
      workArtifactHash: revision.workArtifactHash,
      researchInputIdentity: actionBody.researchInputIdentity,
      sourceCorpusSnapshotIdentity: revision.sourceCorpusSnapshotIdentity,
      selectionReason: fit.reason,
      expectedSearchFields: fit.fields,
      sourceSelectionLanes: work.sourceSelectionLanes,
      sourcePriority: work.priority,
      seedListingEvidenceCount,
      existingEquivalentRouteFamilyIds: equivalentRouteFamilyIds,
      attemptedExactIntent,
      eligibility,
      authority: "ROUTE_SEED_SELECTION_ONLY" as const,
      modelInvocationAuthority: false as const,
      campaignAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    })];
  }).sort((left, right) =>
    LAYER_ORDER.indexOf(left.targetRouteLayer) - LAYER_ORDER.indexOf(right.targetRouteLayer) ||
    right.sourcePriority - left.sourcePriority ||
    right.seedListingEvidenceCount - left.seedListingEvidenceCount ||
    left.workItemId.localeCompare(right.workItemId)
  );
  const selected = Object.freeze(LAYER_ORDER.flatMap((layer) =>
    candidates.find((candidate) => candidate.targetRouteLayer === layer &&
      candidate.eligibility === "SELECTABLE") ?? []
  ));
  const policy = Object.freeze({
    schemaVersion: "pmh.standing-route-seed-selection-policy.v1" as const,
    maximumCandidatesPerLayer: 1 as const,
    maximumPortfolioSize: 3 as const,
    layerOrder: LAYER_ORDER,
    preserveUnusedCapacity: true as const,
    excludeExistingEquivalentRoute: true as const,
    excludeAttemptedExactIntent: true as const,
    settlementEvidenceRequired: true as const,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.standing-route-seed-selection.v1" as const,
    policyIdentity: hashCanonical(policy),
    sourceCorpusSnapshotIdentity: corpus.snapshotIdentity,
    consideredCandidateCount: candidates.length,
    selectableCandidateCount: candidates.filter((item) => item.eligibility === "SELECTABLE").length,
    selectedCandidateCount: selected.length,
    heldCandidateCount: candidates.filter((item) => item.eligibility !== "SELECTABLE").length,
    unusedLayers: Object.freeze(LAYER_ORDER.filter((layer) =>
      !selected.some((item) => item.targetRouteLayer === layer)
    )),
    candidates: Object.freeze(candidates),
    selected,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    campaignsCreated: 0 as const,
    runsCreated: 0 as const,
    automaticDispatch: false as const,
    authority: "ROUTE_SEED_SELECTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, selectionIdentity: hashCanonical(body) });
}
