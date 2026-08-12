import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  activateAgentCampaign,
  buildDefaultAgentRuntimePortfolio,
  buildAgentRun,
  buildAgentTask,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildOntologyAgentCampaignPreview,
  buildPausedAgentCampaign,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  materializeOntologySearchIssueRevisions,
  resolveOntologyAgentTaskRevision,
  selectOntologyCampaignIssues,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const NOW = "2026-08-12T07:00:00.000Z";

function listing(
  listingRef: string,
  title: string,
  outcomes = ["Yes", "No"],
): DiscoveryCatalogListing {
  const venueId = listingRef.split(":")[0]!;
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":")[1]!,
    title,
    description: title,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2028-12-31T00:00:00.000Z",
    rulesText: "Resolves from the named official source.",
    outcomes: Object.freeze(outcomes.map((label, index) => Object.freeze({
      venueOutcomeId: String(index),
      label,
      indicativePrice: index === 0 ? "400000000000000000" : "600000000000000000",
    }))),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: NOW,
    sourceRawHash: hashCanonical({ listingRef, title, outcomes }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-campaign-test" }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-b:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-a:kelly-nominee", "Will Mark Kelly win the 2028 Democratic nomination?"),
      listing(
        "venue-a:kelly-office",
        "Which office will Mark Kelly hold in 2028?",
        ["President", "Senator", "Neither"],
      ),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({
    corpus,
    ontology,
    proposals: [],
  });
  const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(
    { PMH_DISCOVERY_PROVIDER: "codex" },
    () => Date.parse(NOW),
  ));
  const execution = Object.freeze({
    ...emptyAgentExecutionSnapshot(),
    ...portfolio,
  });
  const route = execution.workloadRoutes.find((item) =>
    item.taskKind === "ONTOLOGY_NORMALIZATION"
  )!;
  const profile = execution.executionProfiles.find((item) =>
    item.executionProfileId === route.executionProfileId
  )!;
  return { revisions, execution, profile };
}

describe("ontology Agent campaign selection", () => {
  it("selects a small differentiated unattempted portfolio without starting a provider", () => {
    const work = fixture();
    const selected = selectOntologyCampaignIssues(work);
    const preview = buildOntologyAgentCampaignPreview({
      ...work,
      capability: {
        executionProfileId: work.profile.executionProfileId,
        configurationStatus: "CONFIGURED",
        runtimeStatus: "AVAILABLE",
        serviceCapability: "USABLE",
        dispatchEligibility: "ELIGIBLE",
        diagnostic: "Codex app-server account is usable",
        observation: null,
        inferenceRequestsStarted: 0,
        modelInvocationsStarted: 0,
        secretMaterialRetained: false,
      },
    });

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(4);
    expect(new Set(selected.map((item) => item.selectionLane)).size)
      .toBe(Math.min(3, new Set(work.revisions.map((item) => item.selectionLane)).size));
    expect(preview).toMatchObject({
      taskIds: selected.map((item) => item.task.taskId),
      allocation: {
        schemaVersion: "pmh.ontology-attention-allocation.v1",
        portfolio: selected.map((item) => ({
          issueId: item.issueId,
          taskId: item.task.taskId,
        })),
        providerRequestsStartedByRead: 0,
        modelInvocationsStartedByRead: 0,
      },
      selectionBinding: {
        schemaVersion: "pmh.agent-campaign-selection-binding.v1",
        selectionProtocol: "ONTOLOGY_ATTENTION_ALLOCATION_V1",
        selectionIdentity: preview.allocation.projectionIdentity,
        selectionPolicyIdentity: preview.allocation.policy.policyIdentity,
      },
      creationEligible: true,
      dispatchEligible: true,
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      budget: {
        maximumConcurrentRuns: 1,
        maximumModelInvocations: 12,
      },
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
      authority: "CAMPAIGN_PROPOSAL_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(preview.selectionBinding.taskBindings).toHaveLength(selected.length);
    expect(preview.selectionBinding.taskBindings).toEqual(
      [...preview.selectionBinding.taskBindings].sort((left, right) =>
        left.taskId.localeCompare(right.taskId)
      ),
    );
    expect(preview.previewIdentity).toMatch(/^sha256:/u);
  });

  it("resolves campaign execution from the exact retained allocation revision", () => {
    const work = fixture();
    const preview = buildOntologyAgentCampaignPreview({
      ...work,
      capability: {
        executionProfileId: work.profile.executionProfileId,
        configurationStatus: "CONFIGURED",
        runtimeStatus: "AVAILABLE",
        serviceCapability: "USABLE",
        dispatchEligibility: "ELIGIBLE",
        diagnostic: "Codex app-server account is usable",
        observation: null,
        inferenceRequestsStarted: 0,
        modelInvocationsStarted: 0,
        secretMaterialRetained: false,
      },
    });
    const paused = buildPausedAgentCampaign({
      campaignKey: preview.campaignKey,
      revision: 1,
      executionProfileId: preview.executionProfile.executionProfileId,
      taskIds: preview.taskIds,
      schedule: preview.schedule,
      budget: preview.budget,
      selectionBinding: preview.selectionBinding,
      createdAt: NOW,
    });
    const active = activateAgentCampaign(
      paused,
      "operator:ontology-binding-test",
      "2026-08-12T07:01:00.000Z",
    );
    const binding = preview.selectionBinding.taskBindings[0]!;
    const selected = work.revisions.find((item) =>
      item.revisionId === binding.inputRevisionId
    )!;
    const run = buildAgentRun({
      task: selected.task,
      executionProfile: work.profile,
      runOrdinal: 1,
      authorization: {
        kind: "CAMPAIGN",
        campaign: active,
        authorizedAt: "2026-08-12T07:01:00.000Z",
      },
      createdAt: "2026-08-12T07:01:00.000Z",
    });

    expect(resolveOntologyAgentTaskRevision({
      taskId: selected.task.taskId,
      run,
      campaigns: [active],
      currentRevisions: [],
      loadRevision: (revisionId) => revisionId === selected.revisionId ? selected : null,
    })).toEqual(selected);
    expect(active).toMatchObject({
      schemaVersion: "pmh.agent-campaign.v2",
      selectionBinding: preview.selectionBinding,
    });
  });

  it("rejects legacy ontology campaigns that cannot prove their selected input", () => {
    const work = fixture();
    const selected = work.revisions[0]!;
    const paused = buildPausedAgentCampaign({
      campaignKey: "legacy-ontology-campaign",
      revision: 1,
      executionProfileId: work.profile.executionProfileId,
      taskIds: [selected.task.taskId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      budget: {
        maximumConcurrentRuns: 1,
        maximumModelInvocations: 1,
        maximumInputTokens: "1000",
        maximumOutputTokens: "1000",
        maximumWallClockMs: 60_000,
      },
      createdAt: NOW,
    });
    const active = activateAgentCampaign(
      paused,
      "operator:legacy-test",
      "2026-08-12T07:01:00.000Z",
    );
    const run = buildAgentRun({
      task: selected.task,
      executionProfile: work.profile,
      runOrdinal: 1,
      authorization: {
        kind: "CAMPAIGN",
        campaign: active,
        authorizedAt: "2026-08-12T07:01:00.000Z",
      },
      createdAt: "2026-08-12T07:01:00.000Z",
    });

    expect(() => resolveOntologyAgentTaskRevision({
      taskId: selected.task.taskId,
      run,
      campaigns: [active],
      currentRevisions: work.revisions,
    })).toThrow(/no immutable attention allocation binding/iu);
  });

  it("keeps a campaign proposal non-dispatchable until preflight is usable", () => {
    const work = fixture();
    const preview = buildOntologyAgentCampaignPreview({
      ...work,
      capability: {
        executionProfileId: work.profile.executionProfileId,
        configurationStatus: "CONFIGURED",
        runtimeStatus: "AVAILABLE",
        serviceCapability: "UNVERIFIED",
        dispatchEligibility: "BLOCKED",
        diagnostic: "run a capability preflight before dispatch",
        observation: null,
        inferenceRequestsStarted: 0,
        modelInvocationsStarted: 0,
        secretMaterialRetained: false,
      },
    });

    expect(preview.creationEligible).toBe(true);
    expect(preview.dispatchEligible).toBe(false);
    expect(preview.diagnostic).toMatch(/preflight/iu);
  });

  it("does not retry an issue merely because a new ontology snapshot changed its task ID", () => {
    const work = fixture();
    const attempted = work.revisions[0]!;
    const historicalTask = buildAgentTask({
      kind: "ONTOLOGY_NORMALIZATION",
      protocol: "MARKET_ONTOLOGY_NORMALIZATION_TASK_V1",
      inputArtifacts: [],
      taskPayload: { schemaVersion: "historical-ontology-task.v1" },
      requestedEffectProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V1",
      provenanceRef: `ontology-issue:${attempted.issueId}`,
      priority: attempted.priority,
      createdAt: "2026-08-11T07:00:00.000Z",
    });
    expect(historicalTask.taskId).not.toBe(attempted.task.taskId);
    const run = buildAgentRun({
      task: historicalTask,
      executionProfile: work.profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:test",
        authorizedAt: "2026-08-11T07:00:00.000Z",
      },
      createdAt: "2026-08-11T07:00:00.000Z",
    });
    const selected = selectOntologyCampaignIssues({
      revisions: work.revisions,
      execution: Object.freeze({
        ...work.execution,
        tasks: Object.freeze([historicalTask]),
        runs: Object.freeze([run]),
      }),
    });

    expect(selected.some((item) => item.issueId === attempted.issueId)).toBe(false);
  });
});
