import { hashCanonical } from "@pmh/domain";
import type { StudioProjection } from "./types.js";

const FULL_RESOURCE = "/api/v1/projection?view=full" as const;

export const LIVE_PROJECTION_LIMITS = Object.freeze({
  semanticReviewJobs: 16,
  semanticReviewNotifications: 12,
  semanticReviews: 32,
  probabilityEstimationRuns: 32,
  probabilityEstimationJobs: 32,
  probabilityEstimationBounds: 12,
  probabilityEstimationNotifications: 12,
  probabilityCalibrationObservations: 20,
  probabilityCalibrationSnapshots: 12,
  probabilityResolutionCaptures: 20,
  aiUsageEvents: 48,
  searchLeases: 8,
  marketArchaeologistRuns: 4,
  lifecycleCases: 32,
  economicTriageItems: 8,
  semanticReviewAdmissionCandidates: 8,
  reviewAttentionItems: 8,
  evidenceAcquisitionJobs: 12,
  searchAttentionMessages: 12,
  searchAttentionDeliveries: 12,
  searchIssueNotifications: 12,
  discoveryRuns: 8,
  investigationRecords: 4,
  researchCases: 12,
  graphListings: 0,
  graphRelations: 16,
  graphFeedback: 16,
} as const);

type WindowSelection = StudioProjection["projectionWindow"]["collections"][number]["selection"];
type WindowRecord = StudioProjection["projectionWindow"]["collections"][number];

function retainedWindow<T>(
  values: readonly T[],
  limit: number,
  isActive?: (value: T) => boolean,
): readonly T[] {
  if (limit === 0) return Object.freeze([]);
  if (values.length <= limit) return values;
  if (isActive === undefined) return Object.freeze(values.slice(0, limit));
  const active = values.filter(isActive);
  const retained = values.filter((value) => !isActive(value));
  return Object.freeze([...active, ...retained].slice(0, limit));
}

export function buildLiveStudioProjection(full: StudioProjection): StudioProjection {
  if (full.identity.view !== "FULL" || full.projectionWindow.mode !== "FULL") {
    throw new Error("live Studio projection requires a full source projection");
  }

  const windows: WindowRecord[] = [];
  const window = <T>(
    path: string,
    values: readonly T[],
    limit: number,
    selection: WindowSelection,
    isActive?: (value: T) => boolean,
  ): readonly T[] => {
    const included = selection === "OMITTED_FROM_LIVE_VIEW"
      ? Object.freeze([] as T[])
      : retainedWindow(values, limit, isActive);
    windows.push(Object.freeze({
      path,
      totalCount: values.length,
      includedCount: included.length,
      limit,
      selection,
      fullResource: FULL_RESOURCE,
    }));
    return included;
  };

  const reviewJobs = window(
    "ai.semanticReviewScheduler.jobs",
    full.ai.semanticReviewScheduler.jobs,
    LIVE_PROJECTION_LIMITS.semanticReviewJobs,
    "ACTIVE_THEN_RETAINED_ORDER",
    (job) => ["PENDING", "LEASED", "RETRY_WAIT", "BLOCKED_EVIDENCE"].includes(job.status),
  );
  const selectedOpportunityIds = new Set(reviewJobs.map((job) => job.opportunityId));
  const lifecycleCases = window(
    "opportunityLifecycle.cases",
    full.opportunityLifecycle.cases,
    LIVE_PROJECTION_LIMITS.lifecycleCases,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => selectedOpportunityIds.has(record.opportunityId) || record.nextAction !== "NONE",
  );
  for (const record of lifecycleCases) selectedOpportunityIds.add(record.opportunityId);

  const semanticReviews = window(
    "ai.semanticReview.records",
    full.ai.semanticReview.records,
    LIVE_PROJECTION_LIMITS.semanticReviews,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status === "RUNNING" || selectedOpportunityIds.has(record.opportunityId),
  );
  const probabilityEstimationRuns = window(
    "ai.probabilityEstimation.records",
    full.ai.probabilityEstimation.records,
    LIVE_PROJECTION_LIMITS.probabilityEstimationRuns,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status === "RUNNING",
  );
  const probabilityEstimationJobs = window(
    "ai.probabilityEstimationScheduler.jobs",
    full.ai.probabilityEstimationScheduler.jobs,
    LIVE_PROJECTION_LIMITS.probabilityEstimationJobs,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => ["PENDING", "LEASED", "RETRY_WAIT", "BLOCKED_EVIDENCE"].includes(
      record.status,
    ),
  );
  const probabilityEstimationBounds = window(
    "ai.probabilityEstimationScheduler.bounds",
    full.ai.probabilityEstimationScheduler.bounds,
    LIVE_PROJECTION_LIMITS.probabilityEstimationBounds,
    "RETAINED_ORDER",
  );
  const probabilityEstimationNotifications = window(
    "ai.probabilityEstimationScheduler.notifications",
    full.ai.probabilityEstimationScheduler.notifications,
    LIVE_PROJECTION_LIMITS.probabilityEstimationNotifications,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status === "UNREAD",
  );
  const probabilityCalibrationObservations = window(
    "ai.probabilityCalibration.observations",
    full.ai.probabilityCalibration.observations,
    LIVE_PROJECTION_LIMITS.probabilityCalibrationObservations,
    "RETAINED_ORDER",
  );
  const probabilityCalibrationSnapshots = window(
    "ai.probabilityCalibration.snapshots",
    full.ai.probabilityCalibration.snapshots,
    LIVE_PROJECTION_LIMITS.probabilityCalibrationSnapshots,
    "RETAINED_ORDER",
  );
  const probabilityResolutionCaptures = window(
    "ai.probabilityResolutionAcquisition.captures",
    full.ai.probabilityResolutionAcquisition.captures,
    LIVE_PROJECTION_LIMITS.probabilityResolutionCaptures,
    "RETAINED_ORDER",
  );
  const aiUsageEvents = window(
    "ai.aiUsage.recentEvents",
    full.ai.aiUsage.recentEvents,
    LIVE_PROJECTION_LIMITS.aiUsageEvents,
    "RETAINED_ORDER",
  );
  const searchLeases = window(
    "ai.searchLeaseScheduler.records",
    full.ai.searchLeaseScheduler.records,
    LIVE_PROJECTION_LIMITS.searchLeases,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status === "ISSUED",
  );
  const archaeologyRuns = window(
    "ai.marketArchaeologist.records",
    full.ai.marketArchaeologist.records,
    LIVE_PROJECTION_LIMITS.marketArchaeologistRuns,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status === "RUNNING",
  );
  const evidenceJobs = window(
    "ai.evidenceAcquisition.jobs",
    full.ai.evidenceAcquisition.jobs,
    LIVE_PROJECTION_LIMITS.evidenceAcquisitionJobs,
    "ACTIVE_THEN_RETAINED_ORDER",
    (job) => ["PENDING", "LEASED", "RETRY_WAIT", "STALE"].includes(job.status),
  );
  const attentionMessages = window(
    "ai.searchAttention.messages",
    full.ai.searchAttention.messages,
    LIVE_PROJECTION_LIMITS.searchAttentionMessages,
    "RETAINED_ORDER",
  );
  const attentionDeliveries = window(
    "ai.searchAttention.deliveries",
    full.ai.searchAttention.deliveries,
    LIVE_PROJECTION_LIMITS.searchAttentionDeliveries,
    "ACTIVE_THEN_RETAINED_ORDER",
    (delivery) => delivery.status === "PENDING" || delivery.status === "RETRY_WAIT",
  );
  const issueNotifications = window(
    "ai.searchIssueScheduler.notifications",
    full.ai.searchIssueScheduler.notifications,
    LIVE_PROJECTION_LIMITS.searchIssueNotifications,
    "ACTIVE_THEN_RETAINED_ORDER",
    (notification) => notification.status === "UNREAD",
  );
  const reviewNotifications = window(
    "ai.semanticReviewScheduler.notifications",
    full.ai.semanticReviewScheduler.notifications,
    LIVE_PROJECTION_LIMITS.semanticReviewNotifications,
    "ACTIVE_THEN_RETAINED_ORDER",
    (notification) => notification.status === "UNREAD",
  );
  const discoveryRuns = window(
    "discoveryDesk.runs",
    full.discoveryDesk.runs,
    LIVE_PROJECTION_LIMITS.discoveryRuns,
    "ACTIVE_THEN_RETAINED_ORDER",
    (run) => run.completedAt === undefined || run.completedAt === null,
  );
  const investigationRecords = window(
    "ai.investigationDesk.records",
    full.ai.investigationDesk.records,
    LIVE_PROJECTION_LIMITS.investigationRecords,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status === "RUNNING",
  );
  const researchCases = window(
    "ai.researchDesk.cases",
    full.ai.researchDesk.cases,
    LIVE_PROJECTION_LIMITS.researchCases,
    "ACTIVE_THEN_RETAINED_ORDER",
    (record) => record.status !== "NO_LEADS",
  );
  const economicItems = window(
    "ai.proposalEconomicTriage.items",
    full.ai.proposalEconomicTriage.items,
    LIVE_PROJECTION_LIMITS.economicTriageItems,
    "RETAINED_ORDER",
  );
  const admissionCandidates = window(
    "ai.semanticReviewAdmission.candidates",
    full.ai.semanticReviewAdmission.candidates,
    LIVE_PROJECTION_LIMITS.semanticReviewAdmissionCandidates,
    "RETAINED_ORDER",
  );
  const reviewAttentionItems = window(
    "ai.reviewAttention.items",
    full.ai.reviewAttention.items,
    LIVE_PROJECTION_LIMITS.reviewAttentionItems,
    "RETAINED_ORDER",
  );
  const graphListings = window(
    "ai.semanticRelationGraph.listings",
    full.ai.semanticRelationGraph.listings,
    LIVE_PROJECTION_LIMITS.graphListings,
    "OMITTED_FROM_LIVE_VIEW",
  );
  const graphRelations = window(
    "ai.semanticRelationGraph.relations",
    full.ai.semanticRelationGraph.relations,
    LIVE_PROJECTION_LIMITS.graphRelations,
    "RETAINED_ORDER",
  );
  const graphFeedback = window(
    "ai.semanticRelationGraph.feedback",
    full.ai.semanticRelationGraph.feedback,
    LIVE_PROJECTION_LIMITS.graphFeedback,
    "RETAINED_ORDER",
  );

  const visibleOpportunityIds = new Set(lifecycleCases.map((record) => record.opportunityId));
  const linkedLifecycleWindow = <T extends Readonly<{ opportunityId: string }>>(
    path: string,
    values: readonly T[],
  ): readonly T[] => {
    const included = Object.freeze(values.filter(
      (record) => visibleOpportunityIds.has(record.opportunityId),
    ));
    windows.push(Object.freeze({
      path,
      totalCount: values.length,
      includedCount: included.length,
      limit: lifecycleCases.length,
      selection: "LINKED_TO_INCLUDED_CASES" as const,
      fullResource: FULL_RESOURCE,
    }));
    return included;
  };
  const compactLifecycle = Object.freeze({
    ...full.opportunityLifecycle,
    cases: lifecycleCases,
    semanticDecisions: linkedLifecycleWindow(
      "opportunityLifecycle.semanticDecisions",
      full.opportunityLifecycle.semanticDecisions,
    ),
    simulationBundles: linkedLifecycleWindow(
      "opportunityLifecycle.simulationBundles",
      full.opportunityLifecycle.simulationBundles,
    ),
    exactVerifications: linkedLifecycleWindow(
      "opportunityLifecycle.exactVerifications",
      full.opportunityLifecycle.exactVerifications,
    ),
    shadowRuns: linkedLifecycleWindow(
      "opportunityLifecycle.shadowRuns",
      full.opportunityLifecycle.shadowRuns,
    ),
    shadowObservations: linkedLifecycleWindow(
      "opportunityLifecycle.shadowObservations",
      full.opportunityLifecycle.shadowObservations,
    ),
  });

  const projectionWindow = Object.freeze({
    schemaVersion: "pmh.studio-projection-window.v1" as const,
    mode: "LIVE_BOUNDED" as const,
    sourceStateHash: full.identity.stateHash,
    collections: Object.freeze(windows),
    authority: "PRESENTATION_WINDOW_ONLY" as const,
    historyDeleted: false as const,
  });
  const { identity: _identity, projectionWindow: _sourceWindow, ...fullState } = full;
  const viewState = Object.freeze({
    ...fullState,
    projectionWindow,
    ai: Object.freeze({
      ...full.ai,
      marketArchaeologist: Object.freeze({ ...full.ai.marketArchaeologist, records: archaeologyRuns }),
      searchLeaseScheduler: Object.freeze({ ...full.ai.searchLeaseScheduler, records: searchLeases }),
      searchAttention: Object.freeze({
        ...full.ai.searchAttention,
        messages: attentionMessages,
        deliveries: attentionDeliveries,
      }),
      searchIssueScheduler: Object.freeze({
        ...full.ai.searchIssueScheduler,
        notifications: issueNotifications,
      }),
      semanticReview: Object.freeze({ ...full.ai.semanticReview, records: semanticReviews }),
      probabilityEstimation: Object.freeze({
        ...full.ai.probabilityEstimation,
        records: probabilityEstimationRuns,
      }),
      probabilityEstimationScheduler: Object.freeze({
        ...full.ai.probabilityEstimationScheduler,
        jobs: probabilityEstimationJobs,
        bounds: probabilityEstimationBounds,
        notifications: probabilityEstimationNotifications,
      }),
      probabilityCalibration: Object.freeze({
        ...full.ai.probabilityCalibration,
        observations: probabilityCalibrationObservations,
        snapshots: probabilityCalibrationSnapshots,
      }),
      probabilityResolutionAcquisition: Object.freeze({
        ...full.ai.probabilityResolutionAcquisition,
        captures: probabilityResolutionCaptures,
      }),
      aiUsage: Object.freeze({ ...full.ai.aiUsage, recentEvents: aiUsageEvents }),
      semanticReviewAdmission: Object.freeze({
        ...full.ai.semanticReviewAdmission,
        candidates: admissionCandidates,
      }),
      semanticReviewScheduler: Object.freeze({
        ...full.ai.semanticReviewScheduler,
        jobs: reviewJobs,
        notifications: reviewNotifications,
      }),
      evidenceAcquisition: Object.freeze({ ...full.ai.evidenceAcquisition, jobs: evidenceJobs }),
      reviewAttention: Object.freeze({ ...full.ai.reviewAttention, items: reviewAttentionItems }),
      proposalEconomicTriage: Object.freeze({
        ...full.ai.proposalEconomicTriage,
        items: economicItems,
      }),
      semanticRelationGraph: Object.freeze({
        ...full.ai.semanticRelationGraph,
        listings: graphListings,
        relations: graphRelations,
        feedback: graphFeedback,
      }),
      investigationDesk: Object.freeze({ ...full.ai.investigationDesk, records: investigationRecords }),
      researchDesk: Object.freeze({ ...full.ai.researchDesk, cases: researchCases }),
    }),
    opportunityLifecycle: compactLifecycle,
    discoveryDesk: Object.freeze({ ...full.discoveryDesk, runs: discoveryRuns }),
  });

  return Object.freeze({
    identity: Object.freeze({
      ...full.identity,
      view: "LIVE_BOUNDED" as const,
      viewHash: hashCanonical(viewState),
    }),
    ...viewState,
  });
}
