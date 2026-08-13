import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildWorldStateMechanismCampaignPreview,
  buildWorldStateMechanismResearchYield,
  defaultAiRuntimeConfiguration,
  materializeOntologySearchIssueRevisions,
  materializeWorldStateMechanismResearchAssignments,
  MarketOntologyAgentToolHost,
  WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

function listing(ref: string, title: string): DiscoveryCatalogListing {
  const [venueId, venueInstrumentId] = ref.split(":") as [string, string];
  return Object.freeze({
    listingRef: ref, venueId, venueInstrumentId, title, description: title,
    status: "OPEN", mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-10-01T00:00:00.000Z", rulesText: "Official resolution.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "400000000000000000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "600000000000000000" }),
    ]),
    priceScale: "1000000000000000000", quantityScale: "1000000000000000000",
    minPriceTick: "1", sourceKind: "LIVE_OBSERVATION", sourceReceivedAt: NOW,
    sourceRawHash: hashCanonical({ ref }), protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ fixture: "mechanism-research" }),
    eligibleSourceCount: 2, excludedSourceCount: 0,
    listings: [
      listing("a:trump-shot", "Will Trump be shot during August?"),
      listing("b:trump-cola", "Will Trump livestream drinking cola during September?"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const revisions = materializeOntologySearchIssueRevisions({
    ontology, corpus, proposals: [],
  });
  const assignments = materializeWorldStateMechanismResearchAssignments({
    revisions, proposals: [], counterexamples: [], abstentions: [],
  });
  return { corpus, ontology, revisions, assignments };
}

describe("world-state mechanism research role", () => {
  it("materializes stable role tasks from exact ontology inputs", () => {
    const first = fixture();
    const second = materializeWorldStateMechanismResearchAssignments({
      revisions: first.revisions, proposals: [], counterexamples: [], abstentions: [],
    });
    expect(first.assignments.length).toBeGreaterThan(0);
    expect(second).toEqual(first.assignments);
    expect(first.assignments[0]).toMatchObject({
      coverageState: "UNEXPLORED",
      campaignEligible: true,
      automaticDispatch: false,
      task: {
        kind: "WORLD_STATE_MECHANISM_RESEARCH",
        requestedEffectProtocol: WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL,
      },
    });
  });

  it("cannot terminate through ordinary normalization results", () => {
    const work = fixture();
    const assignment = work.assignments[0]!;
    const revision = work.revisions.find((item) =>
      item.revisionId === assignment.sourceRevisionId
    )!;
    const emptyStore = {
      worldStateMechanismProposalStorage: { mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "proposalId" },
      loadWorldStateMechanismProposals: () => [],
      saveWorldStateMechanismProposals: (values: readonly never[]) => values,
    } as never;
    const host = MarketOntologyAgentToolHost.fromMechanismResearchRevision(
      assignment.taskContract,
      revision.taskPayload,
      emptyStore,
      {
        worldStateMechanismCounterexampleStorage: { mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "counterexampleId" },
        loadWorldStateMechanismCounterexamples: () => [],
        saveWorldStateMechanismCounterexamples: (values) => values,
      },
      {
        worldStateMechanismAbstentionStorage: { mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "abstentionId" },
        loadWorldStateMechanismAbstentions: () => [],
        saveWorldStateMechanismAbstentions: (values) => values,
      },
      revision.revisionId,
    );
    const manifestNames = host.manifest(WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL)
      .map((item) => item.name);
    expect(manifestNames).toEqual(expect.arrayContaining([
      "list_assigned_ontology_trailheads",
      "read_ontology_trailhead_evidence",
      "list_world_state_mechanism_coverage",
      "propose_world_state_mechanism",
      "record_world_state_mechanism_counterexample",
      "record_world_state_mechanism_abstention",
    ]));
    expect(manifestNames).not.toEqual(expect.arrayContaining([
      "propose_entity_alias", "propose_world_proposition", "record_ontology_counterexample",
    ]));
    expect(host.resultToolNames(WORLD_STATE_MECHANISM_RESEARCH_TOOL_PROTOCOL)).toEqual([
      "propose_world_state_mechanism",
      "record_world_state_mechanism_counterexample",
      "record_world_state_mechanism_abstention",
    ]);
  });

  it("builds an independently budgeted manual campaign and honest zero baseline", () => {
    const work = fixture();
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "WORLD_STATE_MECHANISM_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const execution = {
      runtimeDefinitions: portfolio.runtimeDefinitions,
      credentialBindings: portfolio.credentialBindings,
      modelProfiles: portfolio.modelProfiles,
      executionProfiles: portfolio.executionProfiles,
      workloadRoutes: portfolio.workloadRoutes,
      campaigns: [], tasks: work.assignments.map((item) => item.task), runs: [],
      modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
      resultSelections: [],
    };
    const capability = {
      schemaVersion: "pmh.execution-capability.v1", executionProfileId: profile.executionProfileId,
      runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH", accessDriver: "CODEX_RESPONSES",
      model: "gpt-5.6-terra", configured: true, credentialPresent: true,
      dispatchEligibility: "ELIGIBLE", diagnostic: "ready", observedAt: NOW,
      authority: "EXECUTION_CAPABILITY_ONLY", secretMaterialRetained: false,
      externalWriteAuthority: false, valueMovingAuthority: false,
    } as const;
    const preview = buildWorldStateMechanismCampaignPreview({
      assignments: work.assignments, revisions: work.revisions, execution, capability,
    });
    expect(preview).toMatchObject({
      schedule: { kind: "MANUAL_ONLY" },
      budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 8 },
      creationEligible: true,
      dispatchEligible: true,
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
    });
    expect(buildWorldStateMechanismResearchYield({
      assignments: work.assignments, execution,
    })).toMatchObject({
      eligibleCount: work.assignments.length,
      attemptedCount: 0, proposedCount: 0, abstainedCount: 0, falsifiedCount: 0,
      runCount: 0, modelInvocationCount: 0,
      usage: { inputTokens: "0", outputTokens: "0", reasoningTokens: "0" },
    });
  });
});
