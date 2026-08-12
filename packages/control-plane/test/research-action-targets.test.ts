import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildResearchActionTargetProjection,
  selectCurrentSemanticReviewRequirements,
  type EvidenceAcquisitionJobRecord,
  type EvidenceRequirement,
  type OfficialSourceDiscoveryJobRecord,
  type RelationDiscoveryProposalCompilation,
  type ResearchAttentionAllocationAction,
  type ResearchAttentionAllocationProjection,
  type RuleEvidenceClaimJobRecord,
  type SemanticReviewRecord,
  type SemanticReviewJobRecord,
} from "../src/index.js";

const WORK_ID = hashCanonical({ work: "lafc" });
const PROPOSAL_ID = hashCanonical({ proposal: "lafc" });
const REVIEW_OLD = hashCanonical({ review: "old" });
const REVIEW_NEW = hashCanonical({ review: "new" });

function requirement(
  label: string,
  acquisitionRoute: EvidenceRequirement["acquisitionRoute"],
): EvidenceRequirement {
  return {
    schemaVersion: "pmh.evidence-requirement.v2",
    requirementId: hashCanonical({ requirement: label }),
    proposalId: PROPOSAL_ID,
    kind: "RESOLUTION_RULE",
    acquisitionRoute,
  } as unknown as EvidenceRequirement;
}

function allocationAction(
  kind: ResearchAttentionAllocationAction["kind"],
  taskId: Hash | null = null,
): ResearchAttentionAllocationAction {
  const body = {
    schemaVersion: "pmh.research-attention-allocation-action.v1" as const,
    lane: kind === "EXPLORE_NEW_FAMILY" ? "EXPLORATION" as const :
      "FALSIFICATION_OR_DEBT" as const,
    kind,
    workItemId: WORK_ID,
    scorecardId: hashCanonical({ scorecard: kind }),
    taskId,
    targetArtifactRefs: Object.freeze([REVIEW_NEW]),
    valueStage: kind === "EXPLORE_NEW_FAMILY" ? "UNATTEMPTED" as const :
      "SEMANTICALLY_REVIEWED" as const,
    diagnostic: `attention:${kind}`,
    dispatchableByRelationCampaign: kind === "EXPLORE_NEW_FAMILY",
    authority: "ATTENTION_PROPOSAL_ONLY" as const,
    modelInvocationAuthority: false as const,
    campaignAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  return Object.freeze({ ...body, actionId: hashCanonical(body) });
}

function allocation(
  action: ResearchAttentionAllocationAction,
): ResearchAttentionAllocationProjection {
  return {
    projectionIdentity: hashCanonical({ allocation: action.actionId }),
    portfolio: Object.freeze([action]),
  } as unknown as ResearchAttentionAllocationProjection;
}

function compilation(): RelationDiscoveryProposalCompilation {
  return {
    compilationId: hashCanonical({ compilation: PROPOSAL_ID }),
    origin: { workItemId: WORK_ID },
    proposal: { proposalId: PROPOSAL_ID },
  } as unknown as RelationDiscoveryProposalCompilation;
}

function review(jobId: Hash, updatedAt: string): SemanticReviewJobRecord {
  return {
    jobId,
    proposalId: PROPOSAL_ID,
    updatedAt,
  } as unknown as SemanticReviewJobRecord;
}

function officialJob(input: Readonly<{
  label: string;
  requirement: EvidenceRequirement;
  taskLabel: string;
  status: OfficialSourceDiscoveryJobRecord["status"];
  updatedAt: string;
  providerRequestCount?: number;
  toolCallCount?: number;
}>): OfficialSourceDiscoveryJobRecord {
  const taskId = hashCanonical({ officialTask: input.taskLabel });
  return {
    jobId: hashCanonical({ officialJob: input.label }),
    task: {
      schemaVersion: "pmh.official-source-discovery-task.v1",
      taskId,
      requirement: input.requirement,
      requirementId: input.requirement.requirementId,
      proposalId: PROPOSAL_ID,
    },
    taskId,
    requirementId: input.requirement.requirementId,
    proposalId: PROPOSAL_ID,
    status: input.status,
    updatedAt: input.updatedAt,
    providerRequestCount: input.providerRequestCount ?? 0,
    toolCallCount: input.toolCallCount ?? 0,
  } as unknown as OfficialSourceDiscoveryJobRecord;
}

function acquisitionJob(input: Readonly<{
  requirement: EvidenceRequirement;
  status: EvidenceAcquisitionJobRecord["status"];
  updatedAt: string;
  totalAttemptCount?: number;
}>): EvidenceAcquisitionJobRecord {
  return {
    jobId: hashCanonical({ acquisition: input.status, updatedAt: input.updatedAt }),
    requirementIds: Object.freeze([input.requirement.requirementId]),
    status: input.status,
    totalAttemptCount: input.totalAttemptCount ?? 0,
    updatedAt: input.updatedAt,
    lastObservationId: input.status === "CAPTURED"
      ? hashCanonical({ observation: input.requirement.requirementId })
      : null,
  } as unknown as EvidenceAcquisitionJobRecord;
}

function claimJob(input: Readonly<{
  requirement: EvidenceRequirement;
  status: RuleEvidenceClaimJobRecord["status"];
  updatedAt: string;
}>): RuleEvidenceClaimJobRecord {
  return {
    jobId: hashCanonical({ claim: input.status, updatedAt: input.updatedAt }),
    requirementId: input.requirement.requirementId,
    proposalId: PROPOSAL_ID,
    status: input.status,
    attemptCount: 1,
    updatedAt: input.updatedAt,
    lastClaimId: input.status === "PASS" ? hashCanonical({ claim: "result" }) : null,
  } as unknown as RuleEvidenceClaimJobRecord;
}

function build(input: Readonly<{
  action?: ResearchAttentionAllocationAction;
  requirements?: readonly EvidenceRequirement[];
  officialJobs?: readonly OfficialSourceDiscoveryJobRecord[];
  acquisitionJobs?: readonly EvidenceAcquisitionJobRecord[];
  claimJobs?: readonly RuleEvidenceClaimJobRecord[];
  semanticJobs?: readonly SemanticReviewJobRecord[];
}>) {
  const action = input.action ?? allocationAction("ADVANCE_RESEARCH_DEBT");
  return buildResearchActionTargetProjection({
    allocation: allocation(action),
    proposalCompilations: action.kind === "EXPLORE_NEW_FAMILY" ? [] : [compilation()],
    semanticReviewJobs: input.semanticJobs ?? [
      review(REVIEW_NEW, "2026-08-12T12:00:00.000Z"),
      review(REVIEW_OLD, "2026-08-11T12:00:00.000Z"),
    ],
    activeRequirements: input.requirements ?? [],
    officialSourceJobs: input.officialJobs ?? [],
    acquisitionJobs: input.acquisitionJobs ?? [],
    claimJobs: input.claimJobs ?? [],
  });
}

describe("exact research-action target resolution", () => {
  it("blocks the retained LAFC-style source task and preserves exact negative cost", () => {
    const debt = requirement("lafc-resolution", "UNSUPPORTED");
    const abstained = officialJob({
      label: "lafc-abstention",
      requirement: debt,
      taskLabel: "same-source-surface",
      status: "ABSTAINED",
      updatedAt: "2026-08-12T12:00:00.000Z",
      providerRequestCount: 4,
      toolCallCount: 3,
    });
    const result = build({ requirements: [debt], officialJobs: [abstained] });

    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]).toMatchObject({
      workItemId: WORK_ID,
      proposalId: PROPOSAL_ID,
      semanticReviewJobId: REVIEW_NEW,
      requirementId: debt.requirementId,
      requirementKind: "RESOLUTION_RULE",
      acquisitionRoute: "UNSUPPORTED",
      downstreamSystem: "OFFICIAL_SOURCE_DISCOVERY",
      state: "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH",
      sourceTaskId: abstained.taskId,
      currentJobId: abstained.jobId,
      currentJobStatus: "ABSTAINED",
      retainedCost: {
        providerRequestCount: 4,
        toolCallCount: 3,
        fetchAttemptCount: 0,
        interpretationAttemptCount: 0,
      },
      manualOperation: { available: false, kind: "NONE", targetId: null },
      noveltyGate: "NEW_OFFICIAL_SOURCE_TASK_IDENTITY",
      automaticDispatch: false,
      providerRequestAuthority: false,
      valueMovingAuthority: false,
    });
    expect(result.targets[0]!.priorNegativeJobIds).toEqual([abstained.jobId]);
    expect(result).toMatchObject({
      blockedNegativeSearchCount: 1,
      readyCount: 0,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      fetchesStartedByRead: 0,
      schedulerDispatchesStartedByRead: 0,
    });
  });

  it("reopens negative source debt only for a changed task identity", () => {
    const debt = requirement("changed-source-surface", "UNSUPPORTED");
    const prior = officialJob({
      label: "old-negative",
      requirement: debt,
      taskLabel: "old-task",
      status: "NO_OFFICIAL_SOURCE_FOUND",
      updatedAt: "2026-08-11T12:00:00.000Z",
      providerRequestCount: 2,
      toolCallCount: 1,
    });
    const successor = officialJob({
      label: "new-pending",
      requirement: debt,
      taskLabel: "new-task",
      status: "PENDING",
      updatedAt: "2026-08-12T12:00:00.000Z",
    });
    const result = build({ requirements: [debt], officialJobs: [successor, prior] });

    expect(result.targets[0]).toMatchObject({
      state: "READY_OFFICIAL_SOURCE_DISCOVERY",
      sourceTaskId: successor.taskId,
      currentJobId: successor.jobId,
      manualOperation: {
        available: true,
        kind: "OFFICIAL_SOURCE_DISCOVERY_JOB",
        targetId: successor.jobId,
      },
      noveltyGate: "NEW_OFFICIAL_SOURCE_TASK_IDENTITY",
      retainedCost: { providerRequestCount: 2, toolCallCount: 1 },
    });
    expect(result.targets[0]!.priorNegativeJobIds).toEqual([prior.jobId]);
  });

  it("does not reopen the same task merely because a new Agent generation made a job", () => {
    const debt = requirement("same-task", "UNSUPPORTED");
    const prior = officialJob({
      label: "old-agent-negative",
      requirement: debt,
      taskLabel: "unchanged-task",
      status: "ABSTAINED",
      updatedAt: "2026-08-11T12:00:00.000Z",
      providerRequestCount: 3,
    });
    const replacementAgent = officialJob({
      label: "new-agent-pending",
      requirement: debt,
      taskLabel: "unchanged-task",
      status: "PENDING",
      updatedAt: "2026-08-12T12:00:00.000Z",
    });
    const result = build({ requirements: [debt], officialJobs: [replacementAgent, prior] });

    expect(result.targets[0]).toMatchObject({
      state: "BLOCKED_BY_NEGATIVE_SOURCE_SEARCH",
      currentJobId: prior.jobId,
      sourceTaskId: prior.taskId,
      retainedCost: { providerRequestCount: 3 },
      manualOperation: { available: false },
    });
  });

  it("routes captured evidence to interpretation and a passed claim back to review", () => {
    const debt = requirement("captured-rule", "DOCUMENT_LOCATOR");
    const captured = acquisitionJob({
      requirement: debt,
      status: "CAPTURED",
      updatedAt: "2026-08-12T10:00:00.000Z",
      totalAttemptCount: 2,
    });
    const pending = claimJob({
      requirement: debt,
      status: "PENDING",
      updatedAt: "2026-08-12T11:00:00.000Z",
    });
    const ready = build({ requirements: [debt], acquisitionJobs: [captured], claimJobs: [pending] });
    expect(ready.targets[0]).toMatchObject({
      state: "READY_RULE_INTERPRETATION",
      downstreamSystem: "RULE_EVIDENCE_INTERPRETATION",
      retainedCost: { fetchAttemptCount: 2, interpretationAttemptCount: 1 },
      manualOperation: { available: true, targetId: pending.jobId },
    });

    const passed = claimJob({
      requirement: debt,
      status: "PASS",
      updatedAt: "2026-08-12T12:00:00.000Z",
    });
    const reviewReady = build({
      requirements: [debt],
      acquisitionJobs: [captured],
      claimJobs: [pending, passed],
    });
    expect(reviewReady.targets[0]).toMatchObject({
      state: "REVIEW_REENTRY_READY",
      downstreamSystem: "SEMANTIC_REVIEW",
      currentJobId: passed.jobId,
      manualOperation: { available: false },
    });
  });

  it("resolves an unattempted exploration action directly without downstream debt", () => {
    const taskId = hashCanonical({ task: "new-family" });
    const action = allocationAction("EXPLORE_NEW_FAMILY", taskId);
    const result = build({ action, semanticJobs: [] });

    expect(result.targets[0]).toMatchObject({
      state: "READY_RELATION_DISCOVERY",
      downstreamSystem: "RELATION_DISCOVERY",
      sourceTaskId: taskId,
      manualOperation: {
        available: true,
        kind: "RELATION_DISCOVERY_TASK",
        targetId: taskId,
      },
      automaticDispatch: false,
    });
  });

  it("selects only requirement intents re-emitted by the latest durable review", () => {
    const historical = {
      ...requirement("historical-requirement", "DOCUMENT_LOCATOR"),
      claim: "Historical mapping debt",
    } as EvidenceRequirement;
    const latestRaw = {
      ...requirement("latest-review-identity", "UNSUPPORTED"),
      claim: "Current controlling source debt",
    } as EvidenceRequirement;
    const latestRebased = {
      ...latestRaw,
      requirementId: hashCanonical({ requirement: "latest-rebased-identity" }),
    } as EvidenceRequirement;
    const historicalJob = {
      ...review(REVIEW_OLD, "2026-08-11T12:00:00.000Z"),
      lastReviewId: REVIEW_OLD,
    } as SemanticReviewJobRecord;
    const latestJob = {
      ...review(REVIEW_NEW, "2026-08-12T12:00:00.000Z"),
      lastReviewId: REVIEW_NEW,
    } as SemanticReviewJobRecord;
    const record = (
      reviewId: Hash,
      emitted: EvidenceRequirement,
    ): SemanticReviewRecord => ({
      reviewId,
      proposalId: PROPOSAL_ID,
      status: "PASS",
      report: { result: { evidenceRequirements: [emitted] } },
    } as unknown as SemanticReviewRecord);

    expect(selectCurrentSemanticReviewRequirements({
      semanticReviewJobs: [latestJob, historicalJob],
      semanticReviewRecords: [record(REVIEW_OLD, historical), record(REVIEW_NEW, latestRaw)],
      currentRequirements: [historical, latestRebased],
    })).toEqual([latestRebased]);
  });
});
