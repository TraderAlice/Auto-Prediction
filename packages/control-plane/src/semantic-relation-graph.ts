import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketArchaeologistProjection, MarketRelationKind } from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { AnonymousSimulationMaterializerProjection } from "./anonymous-simulation-materializer.js";
import type { OpportunityLifecycleDeskProjection } from "./opportunity-lifecycle-desk.js";
import type { RelationPayoffProjection } from "./relation-payoff.js";
import type { SearchLeaseSchedulerProjection, SearchLens } from "./search-lease-scheduler.js";
import type { SemanticReviewDeskProjection } from "./semantic-review.js";
import type { DiscoveryDeskProjection } from "./types.js";

export type SemanticFeedbackCode =
  | "DUPLICATE"
  | "AGENT_FALSIFIED"
  | "SEMANTIC_REJECTED"
  | "MISSING_RULE"
  | "NO_DEPTH"
  | "FEE_OR_MODEL_BLOCK"
  | "EXACT_REJECTED"
  | "CERTIFIED"
  | "SHADOW_DIVERGENCE"
  | "SHADOW_MATCHED";

export type SemanticRelationGraphListingNode = Readonly<{
  nodeId: Hash;
  listingRef: string;
  venueId: string;
  venueInstrumentId: string;
  title: string;
  claimNodeId: Hash;
  timeWindowNodeId: Hash;
  resolutionBindingNodeId: Hash;
  closesAt: string | null;
  sourceReceivedAt: string;
  sourceRawHash: string;
  protocolIdentity: string;
}>;

export type SemanticRelationGraphRelation = Readonly<{
  edgeId: Hash;
  proposalId: Hash;
  opportunityId: string;
  relationKind: MarketRelationKind;
  statement: string;
  listingRefs: readonly string[];
  falsifiers: readonly string[];
  proposalArtifactHash: Hash;
  reviewArtifactHash: Hash | null;
  reviewRecommendation: "REJECT" | "ESCALATE" | "ACCEPT_FOR_RESEARCH_SIMULATION" | null;
  exactDecision: "UNREVIEWED" | "ACCEPT_FOR_SIMULATION" | "REJECT";
  counterexamples: readonly string[];
  missingEvidence: readonly string[];
  latestEvidenceAt: string;
  authority: "HYPOTHESIS_AND_REVIEW_EVIDENCE_ONLY";
  executionAuthority: false;
}>;

export type SemanticRelationGraphFeedback = Readonly<{
  feedbackId: Hash;
  code: SemanticFeedbackCode;
  sourceArtifactHash: Hash;
  sourceKind:
    | "SEARCH_LEASE"
    | "DISCOVERY_FALSIFICATION"
    | "SEMANTIC_REVIEW"
    | "RESEARCH_DECISION"
    | "ANONYMOUS_MATERIALIZATION"
    | "LIFECYCLE_EVENT"
    | "EXACT_VERIFICATION"
    | "SHADOW_MARKET_OBSERVATION";
  opportunityId: string | null;
  proposalId: Hash | null;
  listingRefs: readonly string[];
  observedAt: string;
  detail: string;
  authority: "SEARCH_EVIDENCE_ONLY";
  executionAuthority: false;
}>;

export type SemanticGraphSearchContext = Readonly<{
  schemaVersion: "pmh.semantic-graph-search-context.v1";
  graphIdentity: Hash;
  neighborhoodIdentity: Hash;
  lens: SearchLens;
  relationCount: number;
  feedbackCount: number;
  items: readonly Readonly<{
    proposalId: Hash | null;
    relationKind: MarketRelationKind | null;
    listingRefs: readonly string[];
    outcomeCodes: readonly SemanticFeedbackCode[];
    summary: string;
  }>[];
  searchBrief: string;
  priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS";
  modelConfidenceUsed: false;
  authority: "SEARCH_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  executionAuthority: false;
}>;

export type SemanticRelationGraphProjection = Readonly<{
  schemaVersion: "pmh.semantic-relation-graph.v1";
  graphIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  sourceArtifactHashes: readonly Hash[];
  listingCount: number;
  claimNodeCount: number;
  timeWindowNodeCount: number;
  resolutionBindingNodeCount: number;
  relationCount: number;
  feedbackCount: number;
  listings: readonly SemanticRelationGraphListingNode[];
  relations: readonly SemanticRelationGraphRelation[];
  feedback: readonly SemanticRelationGraphFeedback[];
  empiricalOutcomes: readonly Readonly<{
    code: SemanticFeedbackCode;
    count: number;
    latestObservedAt: string | null;
  }>[];
  priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS";
  modelConfidenceUsed: false;
  authority: "DERIVED_RESEARCH_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type GraphInput = Readonly<{
  corpus: MarketCorpusSnapshot;
  archaeologist: MarketArchaeologistProjection;
  searchLeases: SearchLeaseSchedulerProjection;
  semanticReviews: SemanticReviewDeskProjection;
  lifecycle: OpportunityLifecycleDeskProjection;
  relationPayoff: RelationPayoffProjection;
  materializations: AnonymousSimulationMaterializerProjection;
  discoveryDesk?: DiscoveryDeskProjection;
}>;

const FEEDBACK_CODES: readonly SemanticFeedbackCode[] = Object.freeze([
  "DUPLICATE",
  "AGENT_FALSIFIED",
  "SEMANTIC_REJECTED",
  "MISSING_RULE",
  "NO_DEPTH",
  "FEE_OR_MODEL_BLOCK",
  "EXACT_REJECTED",
  "CERTIFIED",
  "SHADOW_DIVERGENCE",
  "SHADOW_MATCHED",
]);

function compact(value: string, maximum = 240): string {
  const text = value.trim().replace(/\s+/gu, " ");
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1).trimEnd()}…`;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function feedback(value: Omit<SemanticRelationGraphFeedback, "feedbackId" | "authority" | "executionAuthority">): SemanticRelationGraphFeedback {
  const body = Object.freeze({
    ...value,
    listingRefs: uniqueSorted(value.listingRefs),
    detail: compact(value.detail),
    authority: "SEARCH_EVIDENCE_ONLY" as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, feedbackId: hashCanonical(body) });
}

function proposalArtifactHash(proposal: Readonly<{
  proposalId: Hash;
  relationKind: MarketRelationKind;
  listingRefs: readonly string[];
  statement: string;
  rationale: string;
  falsifiers: readonly string[];
  authority: "PROPOSE_ONLY";
  reviewStatus: "UNREVIEWED";
  executionAuthority: false;
}>): Hash {
  const { proposalId: _proposalId, ...body } = proposal;
  return hashCanonical(body);
}

export function buildSemanticRelationGraph(input: GraphInput): SemanticRelationGraphProjection {
  const listingRefs = new Set(input.corpus.listings.map((item) => item.listingRef));
  const listings = Object.freeze([...input.corpus.listings]
    .sort((left, right) => left.listingRef.localeCompare(right.listingRef))
    .map((item) => {
      const claimNodeId = hashCanonical({
        schemaVersion: "pmh.claim-evidence-node.v1",
        listingRef: item.listingRef,
        title: item.title,
        description: item.description,
      });
      const timeWindowNodeId = hashCanonical({
        schemaVersion: "pmh.time-window-evidence-node.v1",
        listingRef: item.listingRef,
        closesAt: item.closesAt,
      });
      const resolutionBindingNodeId = hashCanonical({
        schemaVersion: "pmh.resolution-binding-evidence-node.v1",
        listingRef: item.listingRef,
        rulesText: item.rulesText,
        protocolIdentity: item.protocolIdentity,
        sourceRawHash: item.sourceRawHash,
      });
      const body = Object.freeze({
        listingRef: item.listingRef,
        venueId: item.venueId,
        venueInstrumentId: item.venueInstrumentId,
        title: item.title,
        claimNodeId,
        timeWindowNodeId,
        resolutionBindingNodeId,
        closesAt: item.closesAt,
        sourceReceivedAt: item.sourceReceivedAt,
        sourceRawHash: item.sourceRawHash,
        protocolIdentity: item.protocolIdentity,
      });
      return Object.freeze({ ...body, nodeId: hashCanonical(body) });
    }));

  const proposalById = new Map<Hash, {
    proposal: NonNullable<MarketArchaeologistProjection["records"][number]["report"]>["result"]["proposals"][number];
    completedAt: string;
  }>();
  for (const record of input.archaeologist.records) {
    if (record.status !== "PASS" || record.report === null) continue;
    for (const proposal of record.report.result.proposals) {
      if (proposal.listingRefs.every((item) => listingRefs.has(item))) {
        proposalById.set(proposal.proposalId, { proposal, completedAt: record.report.completedAt });
      }
    }
  }

  const relations = Object.freeze([...proposalById.values()].map(({ proposal, completedAt }) => {
    const opportunityId = `ai:${proposal.proposalId}`;
    const review = input.semanticReviews.records.find(
      (item) => item.proposalId === proposal.proposalId && item.status === "PASS" && item.report !== null,
    );
    const decision = input.lifecycle.semanticDecisions.find((item) => item.opportunityId === opportunityId);
    const report = review?.report ?? null;
    const body = Object.freeze({
      proposalId: proposal.proposalId,
      opportunityId,
      relationKind: proposal.relationKind,
      statement: compact(proposal.statement, 500),
      listingRefs: uniqueSorted(proposal.listingRefs),
      falsifiers: Object.freeze([...proposal.falsifiers]),
      proposalArtifactHash: proposalArtifactHash(proposal),
      reviewArtifactHash: report?.artifactHash ?? null,
      reviewRecommendation: report?.result.recommendation ?? null,
      exactDecision: decision?.decision ?? "UNREVIEWED" as const,
      counterexamples: Object.freeze([...(report?.result.counterexamples ?? [])]),
      missingEvidence: Object.freeze([...(report?.result.missingEvidence ?? [])]),
      latestEvidenceAt: decision?.decidedAt ?? report?.completedAt ?? completedAt,
      authority: "HYPOTHESIS_AND_REVIEW_EVIDENCE_ONLY" as const,
      executionAuthority: false as const,
    });
    return Object.freeze({ ...body, edgeId: hashCanonical(body) });
  }).sort((left, right) => left.proposalId.localeCompare(right.proposalId)));

  const feedbackItems: SemanticRelationGraphFeedback[] = [];
  for (const record of input.searchLeases.records) {
    if (record.lineage.duplicateOfLeaseId !== null) {
      feedbackItems.push(feedback({
        code: "DUPLICATE",
        sourceArtifactHash: record.artifactHash,
        sourceKind: "SEARCH_LEASE",
        opportunityId: null,
        proposalId: null,
        listingRefs: record.fastLane.candidateListingRefs,
        observedAt: record.completedAt ?? record.lease.issuedAt,
        detail: `Candidate signature duplicates lease ${record.lineage.duplicateOfLeaseId}.`,
      }));
    }
  }
  const seenFalsifications = new Set<Hash>();
  for (const run of input.discoveryDesk?.runs ?? []) {
    for (const falsification of run.falsifications ?? []) {
      const findingIdentity = falsification.findingIdentity ??
        falsification.falsificationId;
      if (seenFalsifications.has(findingIdentity)) continue;
      seenFalsifications.add(findingIdentity);
      feedbackItems.push(feedback({
        code: "AGENT_FALSIFIED",
        sourceArtifactHash: falsification.falsificationId,
        sourceKind: "DISCOVERY_FALSIFICATION",
        opportunityId: null,
        proposalId: null,
        listingRefs: falsification.listingRefs,
        observedAt: run.completedAt,
        detail: `${falsification.relationKind ?? "UNSPECIFIED_RELATION"}: ${falsification.claim} Rejected because: ${falsification.reason}`,
      }));
    }
  }
  for (const relation of relations) {
    const review = input.semanticReviews.records.find((item) => item.proposalId === relation.proposalId)?.report;
    const decision = input.lifecycle.semanticDecisions.find((item) => item.opportunityId === relation.opportunityId);
    if (decision?.decision === "REJECT") {
      feedbackItems.push(feedback({
        code: "SEMANTIC_REJECTED",
        sourceArtifactHash: decision.decisionId,
        sourceKind: "RESEARCH_DECISION",
        opportunityId: relation.opportunityId,
        proposalId: relation.proposalId,
        listingRefs: relation.listingRefs,
        observedAt: decision.decidedAt,
        detail: decision.rationale,
      }));
    }
    for (const gap of review?.result.missingEvidence ?? []) {
      feedbackItems.push(feedback({
        code: "MISSING_RULE",
        sourceArtifactHash: review!.artifactHash,
        sourceKind: "SEMANTIC_REVIEW",
        opportunityId: relation.opportunityId,
        proposalId: relation.proposalId,
        listingRefs: relation.listingRefs,
        observedAt: review!.completedAt,
        detail: gap,
      }));
    }
  }
  for (const record of input.materializations.records) {
    if (record.status !== "BLOCKED") continue;
    const relation = relations.find((item) => item.opportunityId === record.opportunityId);
    const blockers = uniqueSorted(record.legs.flatMap((leg) => leg.blocker === null ? [] : [leg.blocker]));
    const feeOrModel = blockers.some((item) => item.includes("FEE") || item.includes("MODEL"));
    feedbackItems.push(feedback({
      code: feeOrModel ? "FEE_OR_MODEL_BLOCK" : "NO_DEPTH",
      sourceArtifactHash: record.materializationId,
      sourceKind: "ANONYMOUS_MATERIALIZATION",
      opportunityId: record.opportunityId,
      proposalId: relation?.proposalId ?? null,
      listingRefs: relation?.listingRefs ?? [],
      observedAt: record.completedAt,
      detail: record.diagnostic ?? (blockers.join(", ") || "Anonymous market-state materialization was blocked."),
    }));
  }
  for (const opportunity of input.lifecycle.cases) {
    const relation = relations.find((item) => item.opportunityId === opportunity.opportunityId);
    for (const event of opportunity.events) {
      if (event.kind === "MODEL_CALIBRATION_REQUIRED" && event.artifactHash !== null) {
        feedbackItems.push(feedback({
          code: "FEE_OR_MODEL_BLOCK",
          sourceArtifactHash: event.artifactHash,
          sourceKind: "LIFECYCLE_EVENT",
          opportunityId: opportunity.opportunityId,
          proposalId: relation?.proposalId ?? null,
          listingRefs: relation?.listingRefs ?? [],
          observedAt: event.occurredAt,
          detail: event.detail,
        }));
      }
    }
  }
  for (const exact of input.lifecycle.exactVerifications) {
    const relation = relations.find((item) => item.opportunityId === exact.opportunityId);
    feedbackItems.push(feedback({
      code: exact.status === "CERTIFIED" ? "CERTIFIED" : "EXACT_REJECTED",
      sourceArtifactHash: exact.artifactHash,
      sourceKind: "EXACT_VERIFICATION",
      opportunityId: exact.opportunityId,
      proposalId: relation?.proposalId ?? null,
      listingRefs: relation?.listingRefs ?? [],
      observedAt: input.lifecycle.cases.find((item) => item.opportunityId === exact.opportunityId)?.events.at(-1)?.occurredAt ?? "1970-01-01T00:00:00.000Z",
      detail: exact.diagnostic ?? (exact.status === "CERTIFIED" ? "First-party exact verification issued a certificate." : "First-party exact verification rejected the candidate."),
    }));
  }
  for (const shadow of input.lifecycle.shadowObservations) {
    const relation = relations.find((item) => item.opportunityId === shadow.opportunityId);
    const diverged = shadow.status === "DIVERGED";
    feedbackItems.push(feedback({
      code: diverged ? "SHADOW_DIVERGENCE" : "SHADOW_MATCHED",
      sourceArtifactHash: shadow.artifactHash,
      sourceKind: "SHADOW_MARKET_OBSERVATION",
      opportunityId: shadow.opportunityId,
      proposalId: relation?.proposalId ?? null,
      listingRefs: relation?.listingRefs ?? [],
      observedAt: new Date(Number(BigInt(shadow.observedAtEpochMs))).toISOString(),
      detail: diverged
        ? `Fresh public-market shadow evidence diverged: ${shadow.reasons.join(", ")}.`
        : `Fresh public-market evidence remained inside certificate intent bounds across ${shadow.changedStateCount} changed state bindings.`,
    }));
  }

  const graphFeedback = Object.freeze(feedbackItems.sort((left, right) =>
    right.observedAt.localeCompare(left.observedAt) || left.feedbackId.localeCompare(right.feedbackId),
  ));
  const sourceArtifactHashes = uniqueSorted([
    input.corpus.snapshotIdentity,
    ...relations.flatMap((item) => [item.proposalArtifactHash, ...(item.reviewArtifactHash === null ? [] : [item.reviewArtifactHash])]),
    ...graphFeedback.map((item) => item.sourceArtifactHash),
    ...input.relationPayoff.qualifications.map((item) => item.artifactHash),
  ]) as readonly Hash[];
  const empiricalOutcomes = Object.freeze(FEEDBACK_CODES.map((code) => {
    const matching = graphFeedback.filter((item) => item.code === code);
    return Object.freeze({
      code,
      count: matching.length,
      latestObservedAt: matching[0]?.observedAt ?? null,
    });
  }));
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-relation-graph.v1" as const,
    sourceSnapshotIdentity: input.corpus.snapshotIdentity,
    sourceArtifactHashes,
    listingCount: listings.length,
    claimNodeCount: new Set(listings.map((item) => item.claimNodeId)).size,
    timeWindowNodeCount: new Set(listings.map((item) => item.timeWindowNodeId)).size,
    resolutionBindingNodeCount: new Set(listings.map((item) => item.resolutionBindingNodeId)).size,
    relationCount: relations.length,
    feedbackCount: graphFeedback.length,
    listings,
    relations,
    feedback: graphFeedback,
    empiricalOutcomes,
    priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS" as const,
    modelConfidenceUsed: false as const,
    authority: "DERIVED_RESEARCH_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({ externalWrites: false as const, valueMovingActions: false as const, liveExecutionEnabled: false as const }),
  });
  return Object.freeze({ ...body, graphIdentity: hashCanonical(body) });
}

const LENS_RELATIONS: Readonly<Record<SearchLens, readonly MarketRelationKind[]>> = Object.freeze({
  EQUIVALENCE: Object.freeze(["EQUIVALENT", "RELATED", "CONFLICTING"] as const),
  IMPLICATION: Object.freeze(["IMPLIES", "SUBSET", "CONDITIONAL"] as const),
  PARTITION: Object.freeze(["MUTUALLY_EXCLUSIVE", "EXHAUSTIVE"] as const),
  MECHANISM: Object.freeze(["CONFLICTING", "RELATED", "CONDITIONAL", "EQUIVALENT"] as const),
});

export function searchSemanticGraphNeighborhood(
  graph: SemanticRelationGraphProjection,
  lens: SearchLens,
  limit = 6,
): SemanticGraphSearchContext {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12) {
    throw new Error("semantic graph neighborhood limit must be from 1 to 12");
  }
  const eligibleRelations = graph.relations.filter((item) => LENS_RELATIONS[lens].includes(item.relationKind));
  const relationItems = eligibleRelations.map((relation) => {
    const outcomes = graph.feedback.filter((item) => item.proposalId === relation.proposalId);
    return {
      relation,
      outcomes,
      empiricalCount: outcomes.length,
      latestAt: outcomes[0]?.observedAt ?? relation.latestEvidenceAt,
    };
  }).sort((left, right) =>
    right.empiricalCount - left.empiricalCount ||
    right.latestAt.localeCompare(left.latestAt) ||
    left.relation.proposalId.localeCompare(right.relation.proposalId),
  );
  const items = Object.freeze(relationItems.slice(0, limit).map(({ relation, outcomes }) => Object.freeze({
    proposalId: relation.proposalId,
    relationKind: relation.relationKind,
    listingRefs: relation.listingRefs,
    outcomeCodes: uniqueSorted(outcomes.map((item) => item.code)) as readonly SemanticFeedbackCode[],
    summary: compact(`${relation.statement}${outcomes.length === 0 ? "" : ` Prior outcomes: ${uniqueSorted(outcomes.map((item) => item.code)).join(", ")}.`}`, 300),
  })));
  const globalFeedback = graph.feedback.filter((item) => item.proposalId === null).slice(0, Math.max(0, limit - items.length));
  const allItems = Object.freeze([
    ...items,
    ...globalFeedback.map((item) => Object.freeze({
      proposalId: null,
      relationKind: null,
      listingRefs: item.listingRefs,
      outcomeCodes: Object.freeze([item.code]),
      summary: compact(item.detail, 300),
    })),
  ]);
  const neighborhoodBody = Object.freeze({ graphIdentity: graph.graphIdentity, lens, items: allItems });
  const refs = uniqueSorted(allItems.flatMap((item) => item.listingRefs)).slice(0, 4);
  const codes = uniqueSorted(allItems.flatMap((item) => item.outcomeCodes)).slice(0, 4);
  const searchBrief = allItems.length === 0
    ? "No prior relation neighborhood exists; explore the raw corpus for a new grounded relation."
    : compact(`Revisit graph refs ${refs.join(", ") || "none"}; use prior outcomes ${codes.join(", ") || "none"} as falsification evidence, not as semantic truth.`, 300);
  return Object.freeze({
    schemaVersion: "pmh.semantic-graph-search-context.v1",
    graphIdentity: graph.graphIdentity,
    neighborhoodIdentity: hashCanonical(neighborhoodBody),
    lens,
    relationCount: eligibleRelations.length,
    feedbackCount: allItems.reduce((sum, item) => sum + item.outcomeCodes.length, 0),
    items: allItems,
    searchBrief,
    priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS",
    modelConfidenceUsed: false,
    authority: "SEARCH_EVIDENCE_ONLY",
    semanticDecisionAuthority: false,
    executionAuthority: false,
  });
}
