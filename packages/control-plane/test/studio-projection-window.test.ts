import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildLiveStudioProjection,
  buildStudioProjection,
  LIVE_PROJECTION_LIMITS,
  type StudioProjection,
} from "../src/index.js";

type ReviewJob = StudioProjection["ai"]["semanticReviewScheduler"]["jobs"][number];
type LifecycleCase = StudioProjection["opportunityLifecycle"]["cases"][number];
type GraphListing = StudioProjection["ai"]["semanticRelationGraph"]["listings"][number];

function reidentifyFull(candidate: StudioProjection): StudioProjection {
  const { identity: _identity, projectionWindow: _window, ...state } = candidate;
  const stateHash = hashCanonical(state);
  const projectionWindow = Object.freeze({
    schemaVersion: "pmh.studio-projection-window.v1" as const,
    mode: "FULL" as const,
    sourceStateHash: stateHash,
    collections: Object.freeze([]),
    authority: "PRESENTATION_WINDOW_ONLY" as const,
    historyDeleted: false as const,
  });
  const viewState = Object.freeze({ projectionWindow, ...state });
  return Object.freeze({
    identity: Object.freeze({
      schemaVersion: "pmh.studio-projection.v2" as const,
      campaign: candidate.identity.campaign,
      mode: "CONTROL_PLANE" as const,
      view: "FULL" as const,
      stateHash,
      viewHash: hashCanonical(viewState),
    }),
    ...viewState,
  });
}

function fixtureFullProjection(): StudioProjection {
  const base = buildStudioProjection({ workers: [], activeRuns: 0 });
  const beyond = (limit: number) => limit + 5;
  const jobs = Array.from({ length: LIVE_PROJECTION_LIMITS.semanticReviewJobs + 5 }, (_, index) => ({
    jobId: `sha256:${String(index).padStart(64, "0")}`,
    opportunityId: `opportunity:${index}`,
    status: index === LIVE_PROJECTION_LIMITS.semanticReviewJobs + 4 ? "LEASED" : "PASS",
  } as ReviewJob));
  const cases = Array.from({ length: LIVE_PROJECTION_LIMITS.lifecycleCases + 5 }, (_, index) => ({
    opportunityId: `opportunity:${index}`,
    nextAction: index % 2 === 0 ? "REVIEW" : "NONE",
  } as unknown as LifecycleCase));
  const listings = Array.from({ length: 40 }, (_, index) => ({
    listingRef: `venue:listing:${index}`,
  } as GraphListing));
  const fake = <T>(count: number, value: (index: number) => T): readonly T[] =>
    Object.freeze(Array.from({ length: count }, (_, index) => value(index)));

  return reidentifyFull({
    ...base,
    ai: {
      ...base.ai,
      semanticReviewScheduler: {
        ...base.ai.semanticReviewScheduler,
        jobs,
        notifications: fake(beyond(LIVE_PROJECTION_LIMITS.semanticReviewNotifications),
          (index) => ({ status: index === 20 ? "UNREAD" : "READ", index }) as unknown as
            typeof base.ai.semanticReviewScheduler.notifications[number]),
      },
      semanticReview: {
        ...base.ai.semanticReview,
        records: fake(beyond(LIVE_PROJECTION_LIMITS.semanticReviews),
          (index) => ({ status: index === 34 ? "RUNNING" : "PASS", opportunityId: `opportunity:${index}` }) as unknown as
            typeof base.ai.semanticReview.records[number]),
      },
      searchLeaseScheduler: {
        ...base.ai.searchLeaseScheduler,
        records: fake(beyond(LIVE_PROJECTION_LIMITS.searchLeases),
          (index) => ({ status: index === 12 ? "ISSUED" : "PASS", index }) as unknown as
            typeof base.ai.searchLeaseScheduler.records[number]),
      },
      marketArchaeologist: {
        ...base.ai.marketArchaeologist,
        records: fake(beyond(LIVE_PROJECTION_LIMITS.marketArchaeologistRuns),
          (index) => ({ status: index === 8 ? "RUNNING" : "PASS", index }) as unknown as
            typeof base.ai.marketArchaeologist.records[number]),
      },
      proposalEconomicTriage: {
        ...base.ai.proposalEconomicTriage,
        items: fake(beyond(LIVE_PROJECTION_LIMITS.economicTriageItems),
          (index) => ({ index }) as unknown as
            typeof base.ai.proposalEconomicTriage.items[number]),
      },
      semanticReviewAdmission: {
        ...base.ai.semanticReviewAdmission,
        candidates: fake(beyond(LIVE_PROJECTION_LIMITS.semanticReviewAdmissionCandidates),
          (index) => ({ index }) as unknown as
            typeof base.ai.semanticReviewAdmission.candidates[number]),
      },
      reviewAttention: {
        ...base.ai.reviewAttention,
        items: fake(beyond(LIVE_PROJECTION_LIMITS.reviewAttentionItems),
          (index) => ({ index }) as unknown as
            typeof base.ai.reviewAttention.items[number]),
      },
      evidenceAcquisition: {
        ...base.ai.evidenceAcquisition,
        jobs: fake(beyond(LIVE_PROJECTION_LIMITS.evidenceAcquisitionJobs),
          (index) => ({ status: index === 16 ? "LEASED" : "CAPTURED", index }) as unknown as
            typeof base.ai.evidenceAcquisition.jobs[number]),
      },
      searchAttention: {
        ...base.ai.searchAttention,
        messages: fake(beyond(LIVE_PROJECTION_LIMITS.searchAttentionMessages),
          (index) => ({ index }) as unknown as typeof base.ai.searchAttention.messages[number]),
        deliveries: fake(beyond(LIVE_PROJECTION_LIMITS.searchAttentionDeliveries),
          (index) => ({ status: index === 16 ? "PENDING" : "DELIVERED", index }) as unknown as
            typeof base.ai.searchAttention.deliveries[number]),
      },
      searchIssueScheduler: {
        ...base.ai.searchIssueScheduler,
        notifications: fake(beyond(LIVE_PROJECTION_LIMITS.searchIssueNotifications),
          (index) => ({ status: index === 16 ? "UNREAD" : "READ", index }) as unknown as
            typeof base.ai.searchIssueScheduler.notifications[number]),
      },
      investigationDesk: {
        ...base.ai.investigationDesk,
        records: fake(beyond(LIVE_PROJECTION_LIMITS.investigationRecords),
          (index) => ({ status: index === 8 ? "RUNNING" : "PASS", index }) as unknown as
            typeof base.ai.investigationDesk.records[number]),
      },
      researchDesk: {
        ...base.ai.researchDesk,
        cases: fake(beyond(LIVE_PROJECTION_LIMITS.researchCases),
          (index) => ({ status: index === 16 ? "INVESTIGATING" : "NO_LEADS", index }) as unknown as
            typeof base.ai.researchDesk.cases[number]),
      },
      semanticRelationGraph: {
        ...base.ai.semanticRelationGraph,
        listingCount: listings.length,
        listings,
        relations: fake(beyond(LIVE_PROJECTION_LIMITS.graphRelations),
          (index) => ({ index }) as unknown as
            typeof base.ai.semanticRelationGraph.relations[number]),
        feedback: fake(beyond(LIVE_PROJECTION_LIMITS.graphFeedback),
          (index) => ({ index }) as unknown as
            typeof base.ai.semanticRelationGraph.feedback[number]),
      },
    },
    opportunityLifecycle: {
      ...base.opportunityLifecycle,
      caseCount: cases.length,
      cases,
    },
    discoveryDesk: {
      ...base.discoveryDesk,
      runs: fake(beyond(LIVE_PROJECTION_LIMITS.discoveryRuns),
        (index) => ({ completedAt: index === 12 ? null : "2026-08-02T00:00:00.000Z", index }) as unknown as
          typeof base.discoveryDesk.runs[number]),
    },
  });
}

describe("live Studio projection window", () => {
  it("keeps active records ahead of retained history and identifies every omission", () => {
    const full = fixtureFullProjection();
    const live = buildLiveStudioProjection(full);

    expect(live.identity).toMatchObject({
      schemaVersion: "pmh.studio-projection.v2",
      view: "LIVE_BOUNDED",
      stateHash: full.identity.stateHash,
    });
    expect(live.identity.viewHash).not.toBe(full.identity.viewHash);
    expect(live.projectionWindow).toMatchObject({
      mode: "LIVE_BOUNDED",
      sourceStateHash: full.identity.stateHash,
      historyDeleted: false,
    });
    expect(live.ai.semanticReviewScheduler.jobs).toHaveLength(
      LIVE_PROJECTION_LIMITS.semanticReviewJobs,
    );
    expect(live.ai.semanticReviewScheduler.jobs[0]?.status).toBe("LEASED");
    expect(live.ai.semanticRelationGraph.listings).toEqual([]);
    expect(live.ai.semanticRelationGraph.listingCount).toBe(40);
    expect(live.opportunityLifecycle.cases).toHaveLength(
      LIVE_PROJECTION_LIMITS.lifecycleCases,
    );
    expect(live.projectionWindow.collections).toContainEqual({
      path: "ai.semanticReviewScheduler.jobs",
      totalCount: LIVE_PROJECTION_LIMITS.semanticReviewJobs + 5,
      includedCount: LIVE_PROJECTION_LIMITS.semanticReviewJobs,
      limit: LIVE_PROJECTION_LIMITS.semanticReviewJobs,
      selection: "ACTIVE_THEN_RETAINED_ORDER",
      fullResource: "/api/v1/projection?view=full",
    });
    expect(live.projectionWindow.collections).toContainEqual({
      path: "ai.semanticRelationGraph.listings",
      totalCount: 40,
      includedCount: 0,
      limit: 0,
      selection: "OMITTED_FROM_LIVE_VIEW",
      fullResource: "/api/v1/projection?view=full",
    });
    const fixedWindows = Object.freeze([
      ["ai.semanticReviewScheduler.jobs", LIVE_PROJECTION_LIMITS.semanticReviewJobs],
      ["ai.semanticReviewScheduler.notifications", LIVE_PROJECTION_LIMITS.semanticReviewNotifications],
      ["ai.semanticReview.records", LIVE_PROJECTION_LIMITS.semanticReviews],
      ["ai.searchLeaseScheduler.records", LIVE_PROJECTION_LIMITS.searchLeases],
      ["ai.marketArchaeologist.records", LIVE_PROJECTION_LIMITS.marketArchaeologistRuns],
      ["opportunityLifecycle.cases", LIVE_PROJECTION_LIMITS.lifecycleCases],
      ["ai.proposalEconomicTriage.items", LIVE_PROJECTION_LIMITS.economicTriageItems],
      ["ai.semanticReviewAdmission.candidates", LIVE_PROJECTION_LIMITS.semanticReviewAdmissionCandidates],
      ["ai.reviewAttention.items", LIVE_PROJECTION_LIMITS.reviewAttentionItems],
      ["ai.evidenceAcquisition.jobs", LIVE_PROJECTION_LIMITS.evidenceAcquisitionJobs],
      ["ai.searchAttention.messages", LIVE_PROJECTION_LIMITS.searchAttentionMessages],
      ["ai.searchAttention.deliveries", LIVE_PROJECTION_LIMITS.searchAttentionDeliveries],
      ["ai.searchIssueScheduler.notifications", LIVE_PROJECTION_LIMITS.searchIssueNotifications],
      ["discoveryDesk.runs", LIVE_PROJECTION_LIMITS.discoveryRuns],
      ["ai.investigationDesk.records", LIVE_PROJECTION_LIMITS.investigationRecords],
      ["ai.researchDesk.cases", LIVE_PROJECTION_LIMITS.researchCases],
      ["ai.semanticRelationGraph.listings", LIVE_PROJECTION_LIMITS.graphListings],
      ["ai.semanticRelationGraph.relations", LIVE_PROJECTION_LIMITS.graphRelations],
      ["ai.semanticRelationGraph.feedback", LIVE_PROJECTION_LIMITS.graphFeedback],
    ] as const);
    for (const [path, limit] of fixedWindows) {
      const record = live.projectionWindow.collections.find((item) => item.path === path);
      expect(record, path).toBeDefined();
      expect(record!.totalCount, path).toBeGreaterThan(limit);
      expect(record!.includedCount, path).toBe(limit);
      expect(record!.limit, path).toBe(limit);
    }
    expect(full.ai.semanticReviewScheduler.jobs).toHaveLength(
      LIVE_PROJECTION_LIMITS.semanticReviewJobs + 5,
    );
    expect(() => buildLiveStudioProjection(live)).toThrow(
      "requires a full source projection",
    );
  });

  it("changes both source and live identities when retained source state changes", () => {
    const first = fixtureFullProjection();
    const changed = reidentifyFull({
      ...first,
      ai: {
        ...first.ai,
        semanticRelationGraph: {
          ...first.ai.semanticRelationGraph,
          listingCount: first.ai.semanticRelationGraph.listingCount + 1,
        },
      },
    });

    const firstLive = buildLiveStudioProjection(first);
    const changedLive = buildLiveStudioProjection(changed);
    expect(changed.identity.stateHash).not.toBe(first.identity.stateHash);
    expect(changedLive.projectionWindow.sourceStateHash).toBe(changed.identity.stateHash);
    expect(changedLive.identity.viewHash).not.toBe(firstLive.identity.viewHash);
  });
});
