import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertMechanismPrototypeExplorationInputRevision,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildAgentRun,
  activateAgentCampaign,
  buildMechanismPrototypeExplorationCampaignPreview,
  buildMechanismPrototypeExplorationPrototypeReferences,
  buildMechanismPrototypeExplorationExhaustion,
  buildPausedAgentCampaign,
  buildDefaultAgentRuntimePortfolio,
  defaultAiRuntimeConfiguration,
  resolveMechanismPrototypeExplorationCampaignInput,
  buildExecutionProfile,
  buildAgentRuntimeDefinition,
  buildCredentialBinding,
  buildModelProfile,
  buildWorldStateMechanismProposal,
  buildWorldStateMechanismPrototypeProposal,
  compileConsolidatedWorldStateMechanismRoutes,
  materializeMechanismPrototypeExplorationProjection,
  materializeWorldStateMechanismPrototypeResearchCases,
  MechanismPrototypeExplorationAgentToolHost,
  MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
  type DiscoveryCatalogListing,
  type WorldStateMechanismProposal,
} from "../src/index.js";

const NOW = "2026-08-13T10:28:18.396Z";
const hash = (value: string): Hash => hashCanonical({ value });

function mechanismProposal(input: Readonly<{
  party: string;
  state: string;
  run: string;
}>): WorldStateMechanismProposal {
  const triggerTitle = `${input.state} Senate Election Winner — ${input.party}`;
  const dependentTitle = `U.S Senate Midterm Winner — ${input.party}`;
  const binding = (role: string, title: string) => Object.freeze({
    listingRef: `source:${input.party}:${input.state}:${role}`
      .toLowerCase().replaceAll(" ", "-"),
    title,
    nodeId: hash(`node:${input.party}:${input.state}:${role}`),
    worldFacetId: hash(`facet:${input.party}:${input.state}:${role}`),
    sourceRawHash: hash(`raw:${input.party}:${input.state}:${role}`),
    protocolIdentity: "source-protocol-v1",
  });
  return buildWorldStateMechanismProposal({
    ontologyIdentity: hash(`ontology:${input.state}`),
    sourceSnapshotIdentity: hash(`snapshot:${input.state}`),
    sourceIssueRevisionId: hash(`revision:${input.state}`),
    sourceAgentRunId: hash(`run:${input.run}`),
    sourceTrailheadIds: [hash(`trailhead:${input.state}`)],
    sourceRelationPatternIds: [hash(`pattern:${input.state}`)],
    subjectLabel: input.party,
    subjectAliases: [input.party],
    subjectAmbiguityNotes: [],
    trigger: {
      predicateLabel: triggerTitle,
      searchSignals: [input.state, input.party],
      influence: "MAY_ENABLE_STATE",
      evidenceBindings: [binding("trigger", triggerTitle)],
    },
    state: { dimension: "OFFICE_HOLDING", label: `${input.party} holds ${input.state}` },
    dependent: {
      predicateLabel: dependentTitle,
      searchSignals: ["Senate", input.party],
      requirement: "STATE_INFLUENCES_LIKELIHOOD",
      evidenceBindings: [binding("dependent", dependentTitle)],
    },
    temporalPosture: "TRIGGER_OVERLAPS_DEPENDENT",
    counterScenarios: ["Other component outcomes can determine the aggregate state."],
    rationale: "One component contributes to an aggregate chamber outcome.",
    proposedAt: NOW,
  });
}

function acceptedPrototype() {
  const sourceInput = materializeWorldStateMechanismPrototypeResearchCases(
    compileConsolidatedWorldStateMechanismRoutes([
      mechanismProposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
      mechanismProposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
    ]),
  )[0]!.currentInputRevision;
  const prototype = buildWorldStateMechanismPrototypeProposal({
    researchInput: sourceInput,
    sourceAgentRunId: hash("prototype-run"),
    label: "One state Senate seat contributes to national Senate control",
    invariantDescription: "One component office-holding outcome influences, but neither necessitates nor suffices for, an aggregate control outcome.",
    variableSlots: [{
      name: "party subject",
      role: "SUBJECT",
      description: "The party whose component and aggregate outcomes are compared.",
      values: sourceInput.memberRoutes.map((route) => ({
        routeFamilyId: route.routeFamilyId,
        value: route.canonicalRoute.canonicalSubjectLabels[0]!,
      })),
    }],
    searchSignals: ["component seat", "aggregate control", "office holding"],
    transferTests: ["The component changes membership in the aggregate institution."],
    counterScenarios: ["Other component outcomes overwhelm this component result."],
    rationale: "The two source routes share a typed mechanism but retain distinct evidence.",
    proposedAt: NOW,
  });
  return { sourceInput, prototype };
}

function listing(input: Readonly<{
  ref: string;
  title: string;
  venue: string;
  receivedAt?: string;
  raw?: string;
  prices?: readonly [string, string];
}>): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef: input.ref,
    venueId: input.venue,
    venueInstrumentId: input.ref.split(":").slice(1).join(":"),
    title: input.title,
    description: input.title,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-12-31T00:00:00.000Z",
    rulesText: null,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: input.prices?.[0] ?? "0.4" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: input.prices?.[1] ?? "0.6" }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: input.receivedAt ?? "2026-08-13T11:00:00.000Z",
    sourceRawHash: hash(input.raw ?? input.ref),
    protocolIdentity: `protocol:${input.venue}:v1`,
  });
}

function corpus(version = 1) {
  const receivedAt = version === 1
    ? "2026-08-13T11:00:00.000Z"
    : "2026-08-13T12:00:00.000Z";
  const listings = [
    listing({
      ref: "venue-house:control", venue: "venue-house",
      title: "Will Democrats control the House after the 2026 election?",
      receivedAt, raw: `house-control-${version}`,
      prices: version === 1 ? ["0.4", "0.6"] : ["0.45", "0.55"],
    }),
    listing({
      ref: "venue-district:ny17", venue: "venue-district",
      title: "Will Democrats win the New York 17th House district?",
      receivedAt, raw: `house-seat-${version}`,
      prices: version === 1 ? ["0.7", "0.3"] : ["0.65", "0.35"],
    }),
    listing({
      ref: "venue-sport:constructors", venue: "venue-sport",
      title: "Will Scuderia Ferrari win the Formula 1 constructors championship?",
      receivedAt, raw: `sport-aggregate-${version}`,
      prices: version === 1 ? ["0.2", "0.8"] : ["0.25", "0.75"],
    }),
    listing({
      ref: "venue-race:italy", venue: "venue-race",
      title: "Will Scuderia Ferrari win the Italian Grand Prix race?",
      receivedAt, raw: `sport-component-${version}`,
      prices: version === 1 ? ["0.3", "0.7"] : ["0.35", "0.65"],
    }),
  ];
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hash("exploration-source-set"),
    eligibleSourceCount: 4,
    excludedSourceCount: 0,
    listings,
  });
}

describe("mechanism-prototype-guided exploration substrate", () => {
  it("materializes differentiated zero-authority search lenses from one prototype", () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const snapshot = corpus();
    const projection = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype],
      prototypeInputs: [sourceInput],
      corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    });

    expect(projection).toMatchObject({
      prototypeCount: 1,
      lensCount: 4,
      eligibleLensCount: 4,
      effects: {
        providerRequests: 0, modelInvocations: 0, runs: 0, campaigns: 0,
        dispatches: 0, externalWrites: 0, valueMovingActions: 0,
      },
    });
    expect(projection.lenses.map((item) => item.axis).sort()).toEqual([
      "AGGREGATE_INSTITUTION", "COUNTEREXAMPLE_FRONTIER",
      "SUBJECT_AND_GEOGRAPHY", "SURFACE_DOMAIN",
    ]);
    expect(projection.lenses.every((item) =>
      item.currentInputRevision.excludedListingRefs.every((ref) =>
        item.currentInputRevision.seedTrailheads.every((seed) =>
          !seed.listingRefs.includes(ref)
        )
      )
    )).toBe(true);
    expect(projection.lenses.find((item) => item.axis === "SURFACE_DOMAIN")
      ?.currentInputRevision.seedTrailheads.some((seed) =>
        seed.predicateFamilies.includes("SPORTS_RESULT")
      )).toBe(true);
    expect(projection.lenses.find((item) => item.axis === "AGGREGATE_INSTITUTION")
      ?.currentInputRevision.seedTrailheads.some((seed) =>
        seed.listingRefs.includes("venue-house:control")
      )).toBe(true);
    for (const lens of projection.lenses) {
      expect(assertMechanismPrototypeExplorationInputRevision(
        lens.currentInputRevision,
      )).toEqual(lens.currentInputRevision);
      expect(lens).toMatchObject({
        automaticDispatch: false,
        semanticDecisionAuthority: false,
        probabilityAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      });
    }
  });

  it("keeps semantic input stable across price and receive-time observations", () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const firstCorpus = corpus(1);
    const secondCorpus = corpus(2);
    const first = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: firstCorpus,
      ontology: buildMarketOntologySnapshot(firstCorpus),
    });
    const second = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: secondCorpus,
      ontology: buildMarketOntologySnapshot(secondCorpus),
    });

    expect(first.corpusSnapshotIdentity).not.toBe(second.corpusSnapshotIdentity);
    expect(first.corpusSemanticIdentity).toBe(second.corpusSemanticIdentity);
    for (const firstLens of first.lenses) {
      const secondLens = second.lenses.find((item) => item.lensId === firstLens.lensId)!;
      expect(firstLens.currentInputRevision.inputRevisionId)
        .not.toBe(secondLens.currentInputRevision.inputRevisionId);
      expect(firstLens.currentInputRevision.semanticInputIdentity)
        .toBe(secondLens.currentInputRevision.semanticInputIdentity);
    }
  });

  it("keeps completed coverage closed under unrelated semantic catalog additions", async () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const firstCorpus = corpus(1);
    const first = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: firstCorpus,
      ontology: buildMarketOntologySnapshot(firstCorpus),
    });
    const lens = first.lenses.find((item) => item.axis === "SURFACE_DOMAIN")!;
    const runtime = buildAgentRuntimeDefinition({ kind: "CODEX", version: "test" });
    const credential = buildCredentialBinding({ kind: "CODEX_OAUTH", logicalAccountRef: "test",
      resolverKind: "CODEX_AUTH_CACHE", resolverRef: "test" });
    const model = buildModelProfile({ profileKey: "test-history", revision: 1,
      accessDriver: "CODEX_RESPONSES", model: "gpt-5.6-terra",
      configuration: { schemaVersion: "pmh.codex-model-configuration.v1",
        reasoning: { effort: "high" }, responseStorage: false }, createdAt: NOW });
    const profile = buildExecutionProfile({ profileKey: "test-history", revision: 1,
      runtimeDefinition: runtime, credentialBinding: credential, modelProfile: model,
      toolProtocol: MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
      runBudget: { maximumModelInvocations: 8, maximumToolCalls: 24,
        maximumWallClockMs: 300_000, maximumInputTokens: "200000",
        maximumOutputTokens: "20000" }, createdAt: NOW });
    const run = buildAgentRun({ task: lens.task, executionProfile: profile, runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:history", authorizedAt: NOW },
      createdAt: NOW });
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, firstCorpus,
    );
    const search = await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "search_mechanism_exploration_corpus", input: {
        patterns: ["Scuderia Ferrari"], syntax: "LITERAL", mode: "ANY",
        fields: ["title"], venueIds: [], limit: 10,
      } });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "inspect_mechanism_exploration_listings",
      input: { listingRefs: ["venue-sport:constructors"] } });
    const exhaustion = buildMechanismPrototypeExplorationExhaustion({
      researchInput: lens.currentInputRevision, prototype, corpus: firstCorpus,
      sourceAgentRunId: run.runId,
      inspectedListingRefs: new Set(["venue-sport:constructors"]),
      inspectedListingRefsForResult: ["venue-sport:constructors"],
      searchedResultIds: [(search.output as { resultIdentity: Hash }).resultIdentity],
      searchedNeighborhoods: ["motorsport aggregate"],
      failedTransferTests: [prototype.transferTests[0]], activatedCounterScenarios: [],
      reason: "The inspected aggregate alone does not establish a component-to-aggregate pair.",
      proposedAt: NOW,
    });
    const unrelatedBase = corpus(2);
    const unrelatedCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: unrelatedBase.sourceSetIdentity,
      eligibleSourceCount: 5,
      excludedSourceCount: 0,
      listings: [...unrelatedBase.listings, listing({
        ref: "venue-culture:new-album", venue: "venue-culture",
        title: "Will Taylor Swift release a new album this year?",
        receivedAt: "2026-08-13T12:00:00.000Z",
      })],
    });
    const covered = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: unrelatedCorpus,
      ontology: buildMarketOntologySnapshot(unrelatedCorpus),
      explorationInputs: [lens.currentInputRevision],
      exhaustions: [exhaustion],
    });
    const coveredLens = covered.lenses.find((item) => item.lensId === lens.lensId)!;
    expect(search).toMatchObject({ status: "ACCEPTED" });
    expect(coveredLens.currentInputRevision.inputRevisionId)
      .not.toBe(lens.currentInputRevision.inputRevisionId);
    expect(coveredLens.currentInputRevision.coverageScopeIdentity)
      .toBe(lens.currentInputRevision.coverageScopeIdentity);
    expect(coveredLens).toMatchObject({
      state: "EXHAUSTED", campaignEligible: false,
      retainedSemanticInputCount: 1, retainedTrailheadIds: [],
      retainedExhaustionIds: [expect.stringMatching(/^sha256:/u)],
      uncoveredCoverageMemberCount: 0,
    });
    expect(covered).toMatchObject({
      attemptedLensCount: 1, exhaustedLensCount: 1,
      currentSemanticAttemptedLensCount: 1, currentSemanticExhaustedLensCount: 1,
    });

    const relevantCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: unrelatedBase.sourceSetIdentity,
      eligibleSourceCount: 4,
      excludedSourceCount: 0,
      listings: unrelatedBase.listings.map((item) =>
        item.listingRef !== "venue-sport:constructors" ? item : listing({
          ref: item.listingRef, venue: item.venueId,
          title: "Will Scuderia Ferrari win the 2026 Formula 1 constructors championship?",
          receivedAt: "2026-08-13T12:00:00.000Z",
        })
      ),
    });
    const reopened = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: relevantCorpus,
      ontology: buildMarketOntologySnapshot(relevantCorpus),
      explorationInputs: [lens.currentInputRevision], exhaustions: [exhaustion],
    });
    expect(reopened.lenses.find((item) => item.lensId === lens.lensId)).toMatchObject({
      state: "UNEXPLORED", campaignEligible: true, retainedSemanticInputCount: 1,
      uncoveredCoverageMemberCount: 1,
    });
  });

  it("retains pre-gate trailheads without letting them close a successor axis contract", () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const snapshot = corpus();
    const current = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    });
    const lens = current.lenses.find((item) => item.axis === "SURFACE_DOMAIN")!;
    const { axisContract: _removedContract, ...preGateBody } = lens.currentInputRevision;
    const { inputRevisionId: _oldInputId, ...preGateWithoutIdentity } = preGateBody;
    const preGateInput = Object.freeze({
      ...preGateWithoutIdentity,
      inputRevisionId: hashCanonical(preGateWithoutIdentity),
    });
    const preGateTrailheadBody = Object.freeze({
      schemaVersion: "pmh.mechanism-prototype-exploration-trailhead.v1" as const,
      lensId: lens.lensId,
      inputRevisionId: preGateInput.inputRevisionId,
      semanticInputIdentity: preGateInput.semanticInputIdentity,
      prototypeId: prototype.prototypeId,
      axis: lens.axis,
      sourceAgentRunId: hash("pre-gate-run"),
      evidenceBindings: Object.freeze(snapshot.listings.slice(2, 4).map((item) => Object.freeze({
        listingRef: item.listingRef, title: item.title, venueId: item.venueId,
        sourceRawHash: item.sourceRawHash, protocolIdentity: item.protocolIdentity,
        semanticListingIdentity: hashCanonical({ listing: item.listingRef }),
      }))),
      structuralAnalogy: "Historical pre-gate analogy.",
      surfaceDifferences: Object.freeze(["historical representation difference"]),
      appliedTransferTests: Object.freeze([prototype.transferTests[0]!]),
      activatedCounterScenarios: Object.freeze([]),
      searchSignals: Object.freeze(["historical"]),
      noveltyAxisExplanation: "Retained before axis admission existed.",
      rationale: "Historical evidence must remain visible but cannot close the new contract.",
      searchedResultIds: Object.freeze([hash("pre-gate-search")]),
      proposedAt: NOW,
      authority: "PROTOTYPE_GUIDED_TRAILHEAD_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
      certificateAuthority: false as const, executionAuthority: false as const,
      externalWriteAuthority: false as const, valueMovingAuthority: false as const,
    });
    const preGateTrailhead = Object.freeze({
      ...preGateTrailheadBody, trailheadId: hashCanonical(preGateTrailheadBody),
    });
    const replayed = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
      explorationInputs: [preGateInput], trailheads: [preGateTrailhead],
    });
    expect(replayed.lenses.find((item) => item.lensId === lens.lensId)).toMatchObject({
      state: "UNEXPLORED", campaignEligible: true,
      retainedTrailheadIds: [preGateTrailhead.trailheadId],
      retainedPreGateTrailheadCount: 1, retainedAssessedTrailheadCount: 0,
      latestRetainedAxisAssessment: null,
    });
  });

  it("fails closed when prototype source input lineage is unavailable", () => {
    const { prototype } = acceptedPrototype();
    const snapshot = corpus();
    expect(() => materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype],
      prototypeInputs: [],
      corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    })).toThrow("source prototype input is unavailable");
  });

  it("binds one paused campaign to an exact semantic input and never dispatches it", () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const snapshot = corpus();
    const projection = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    });
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "MECHANISM_PROTOTYPE_EXPLORATION"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const execution = {
      ...portfolio, campaigns: [], tasks: projection.lenses.map((item) => item.task),
      runs: [], modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
      resultSelections: [], capabilityObservations: [],
    };
    const preview = buildMechanismPrototypeExplorationCampaignPreview({
      lenses: projection.lenses,
      execution,
      capability: {
        schemaVersion: "pmh.execution-capability.v1", executionProfileId: profile.executionProfileId,
        runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH",
        accessDriver: "CODEX_RESPONSES", model: "gpt-5.6-terra",
        configured: true, credentialPresent: true, dispatchEligibility: "ELIGIBLE",
        diagnostic: "ready", observedAt: NOW, authority: "EXECUTION_CAPABILITY_ONLY",
        secretMaterialRetained: false, externalWriteAuthority: false,
        valueMovingAuthority: false,
      },
    });
    expect(preview).toMatchObject({
      taskIds: [expect.stringMatching(/^sha256:/u)], lensIds: [expect.stringMatching(/^sha256:/u)],
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE", creationEligible: true,
      dispatchEligible: false, automaticDispatch: false, providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
    });
    const selectedLens = projection.lenses.find((item) =>
      item.task.taskId === preview.taskIds[0]
    )!;
    expect(preview.selectionBinding.taskBindings[0]).toMatchObject({
      inputRevisionId: selectedLens.currentInputRevision.inputRevisionId,
      semanticInputIdentity: selectedLens.currentInputRevision.semanticInputIdentity,
      exactInputHash: hashCanonical(selectedLens.currentInputRevision),
    });
  });

  it("does not confuse an attempted run with durable semantic coverage", () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const snapshot = corpus();
    const projection = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    });
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "MECHANISM_PROTOTYPE_EXPLORATION"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const baseExecution = {
      ...portfolio, campaigns: [], tasks: projection.lenses.map((item) => item.task),
      runs: [], modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
      resultSelections: [], capabilityObservations: [],
    };
    const capability = {
      schemaVersion: "pmh.execution-capability.v1" as const,
      executionProfileId: profile.executionProfileId,
      runtimeKind: "CODEX" as const, credentialKind: "CODEX_OAUTH" as const,
      accessDriver: "CODEX_RESPONSES" as const, model: "gpt-5.6-terra",
      configured: true, credentialPresent: true, dispatchEligibility: "ELIGIBLE" as const,
      diagnostic: "ready", observedAt: NOW, authority: "EXECUTION_CAPABILITY_ONLY" as const,
      secretMaterialRetained: false, externalWriteAuthority: false, valueMovingAuthority: false,
    };
    const firstPreview = buildMechanismPrototypeExplorationCampaignPreview({
      lenses: projection.lenses, execution: baseExecution, capability,
    });
    const paused = buildPausedAgentCampaign({
      campaignKey: firstPreview.campaignKey, revision: 1,
      executionProfileId: profile.executionProfileId, taskIds: firstPreview.taskIds,
      schedule: firstPreview.schedule, budget: firstPreview.budget,
      selectionBinding: firstPreview.selectionBinding,
      taskRunPolicy: firstPreview.taskRunPolicy, createdAt: NOW,
    });
    const active = activateAgentCampaign(paused, "operator:attempt-test", NOW);
    const selected = projection.lenses.find((item) =>
      item.task.taskId === firstPreview.taskIds[0]
    )!;
    const interrupted = buildAgentRun({
      task: selected.task, executionProfile: profile, runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: NOW }, createdAt: NOW,
    });
    const retryPreview = buildMechanismPrototypeExplorationCampaignPreview({
      lenses: projection.lenses,
      execution: { ...baseExecution, campaigns: [active], runs: [interrupted] },
      capability,
    });
    expect(retryPreview.taskIds).toEqual(firstPreview.taskIds);
    expect(retryPreview.creationEligible).toBe(true);
  });

  it("resolves the campaign-retained input after the live corpus revision rotates", () => {
    const { sourceInput, prototype } = acceptedPrototype();
    const oldCorpus = corpus(1);
    const currentCorpus = corpus(2);
    const oldProjection = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: oldCorpus,
      ontology: buildMarketOntologySnapshot(oldCorpus),
    });
    const currentProjection = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: currentCorpus,
      ontology: buildMarketOntologySnapshot(currentCorpus),
    });
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "MECHANISM_PROTOTYPE_EXPLORATION"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const preview = buildMechanismPrototypeExplorationCampaignPreview({
      lenses: oldProjection.lenses,
      execution: { ...portfolio, campaigns: [], tasks: oldProjection.lenses.map((item) => item.task),
        runs: [], modelInvocations: [], toolEffects: [], runArtifacts: [], runAnnotations: [],
        resultSelections: [], capabilityObservations: [] },
      capability: {
        schemaVersion: "pmh.execution-capability.v1", executionProfileId: profile.executionProfileId,
        runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH",
        accessDriver: "CODEX_RESPONSES", model: "gpt-5.6-terra", configured: true,
        credentialPresent: true, dispatchEligibility: "ELIGIBLE", diagnostic: "ready",
        observedAt: NOW, authority: "EXECUTION_CAPABILITY_ONLY", secretMaterialRetained: false,
        externalWriteAuthority: false, valueMovingAuthority: false,
      },
    });
    const paused = buildPausedAgentCampaign({
      campaignKey: preview.campaignKey, revision: 1, executionProfileId: profile.executionProfileId,
      taskIds: preview.taskIds, schedule: preview.schedule, budget: preview.budget,
      selectionBinding: preview.selectionBinding, taskRunPolicy: preview.taskRunPolicy,
      createdAt: NOW,
    });
    const active = activateAgentCampaign(paused, "operator:exact-input-test", NOW);
    const oldLens = oldProjection.lenses.find((item) => item.task.taskId === preview.taskIds[0])!;
    const run = buildAgentRun({ task: oldLens.task, executionProfile: profile, runOrdinal: 1,
      authorization: { kind: "CAMPAIGN", campaign: active, authorizedAt: NOW }, createdAt: NOW });
    const resolved = resolveMechanismPrototypeExplorationCampaignInput({
      taskId: oldLens.task.taskId, run, campaigns: [active],
      currentLenses: currentProjection.lenses,
      loadInput: (revisionId) => revisionId === oldLens.currentInputRevision.inputRevisionId
        ? oldLens.currentInputRevision : null,
    });
    expect(resolved.inputRevisionId).toBe(oldLens.currentInputRevision.inputRevisionId);
    expect(resolved.inputRevisionId).not.toBe(currentProjection.lenses.find((item) =>
      item.lensId === oldLens.lensId
    )!.currentInputRevision.inputRevisionId);
  });
});

describe("mechanism-prototype exploration Agent tools", () => {
  function runtimeFixture(axis: "SURFACE_DOMAIN" | "SUBJECT_AND_GEOGRAPHY" = "SURFACE_DOMAIN") {
    const { sourceInput, prototype } = acceptedPrototype();
    const snapshot = corpus();
    const lens = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    }).lenses.find((item) => item.axis === axis)!;
    const runtime = buildAgentRuntimeDefinition({ kind: "CODEX", version: "test" });
    const credential = buildCredentialBinding({
      kind: "CODEX_OAUTH", logicalAccountRef: "test", resolverKind: "CODEX_AUTH_CACHE",
      resolverRef: "test",
    });
    const model = buildModelProfile({
      profileKey: "test", revision: 1, accessDriver: "CODEX_RESPONSES",
      model: "gpt-5.6-terra", configuration: {
        schemaVersion: "pmh.codex-model-configuration.v1",
        reasoning: { effort: "high" }, responseStorage: false,
      }, createdAt: NOW,
    });
    const profile = buildExecutionProfile({
      profileKey: "test-exploration", revision: 1, runtimeDefinition: runtime,
      credentialBinding: credential, modelProfile: model,
      toolProtocol: MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
      runBudget: {
        maximumModelInvocations: 8, maximumToolCalls: 24,
        maximumWallClockMs: 300_000, maximumInputTokens: "200000",
        maximumOutputTokens: "20000",
      }, createdAt: NOW,
    });
    const run = buildAgentRun({
      task: lens.task, executionProfile: profile, runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:test", authorizedAt: NOW },
      createdAt: NOW,
    });
    return { lens, prototype, snapshot, profile, run };
  }

  it("searches and inspects before retaining an exact routing-only trailhead", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    const references = buildMechanismPrototypeExplorationPrototypeReferences(prototype);
    expect(host.resultToolNames(lens.task.requestedEffectProtocol)).toEqual([
      "submit_mechanism_exploration_trailhead",
      "record_mechanism_exploration_exhaustion",
    ]);
    const search = await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "search_mechanism_exploration_corpus",
      input: {
        patterns: ["Scuderia Ferrari"], syntax: "LITERAL", mode: "ANY",
        fields: ["title"], venueIds: [], limit: 10,
      },
    });
    expect(search).toMatchObject({ status: "ACCEPTED" });
    await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "inspect_mechanism_exploration_listings",
      input: { listingRefs: ["venue-sport:constructors", "venue-race:italy"] },
    });
    const retained = await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "submit_mechanism_exploration_trailhead",
      input: {
        listingRefs: ["venue-sport:constructors", "venue-race:italy"],
        structuralAnalogy: "One race result may contribute points to an aggregate constructors championship.",
        surfaceDifferences: ["sports points replace office membership"],
        appliedTransferTestRefs: [references.transferTests[0]!.ref],
        activatedCounterScenarioRefs: [], searchSignals: ["race", "constructors championship"],
        noveltyAxisExplanation: "The surface domain changes from elections to motorsport.",
        rationale: "The exact pair merits separate semantic mechanism research.",
      },
    });
    expect(retained).toMatchObject({
      status: "ACCEPTED",
      output: { authority: "PROTOTYPE_GUIDED_TRAILHEAD_ROUTING_ONLY" },
    });
    expect(host.trailheads()[0]).toMatchObject({
      appliedTransferTests: [prototype.transferTests[0]],
      activatedCounterScenarios: [],
      axisAssessment: {
        requestedAxis: "SURFACE_DOMAIN",
        candidatePredicateFamilies: expect.arrayContaining(["SPORTS_RESULT"]),
        groundedAxisEvidenceSignals: ["SPORTS_RESULT"],
        observedNoveltyDimensions: expect.arrayContaining(["WORLD_DOMAIN"]),
        admissible: true,
        authority: "EXPLORATION_AXIS_ADMISSION_ONLY",
      },
    });
  });

  it("rejects cross-venue election parameter novelty from the world-domain lane", async () => {
    const { lens, prototype, profile, run } = runtimeFixture();
    const electionSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hash("cross-venue-election-source-set"),
      eligibleSourceCount: 2, excludedSourceCount: 0,
      listings: [
        listing({ ref: "venue-a:iowa-republican", venue: "venue-a",
          title: "Iowa Senate Election Winner — Republican Party" }),
        listing({ ref: "venue-b:senate-control-republican", venue: "venue-b",
          title: "Which party will control the U.S. Senate? — Republican Party" }),
      ],
    });
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, electionSnapshot,
    );
    const references = buildMechanismPrototypeExplorationPrototypeReferences(prototype);
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "search_mechanism_exploration_corpus", input: {
        patterns: ["Republican Party"], syntax: "LITERAL", mode: "ANY",
        fields: ["title"], venueIds: [], limit: 10,
      } });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "inspect_mechanism_exploration_listings", input: {
        listingRefs: ["venue-a:iowa-republican", "venue-b:senate-control-republican"],
      } });
    await expect(host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "submit_mechanism_exploration_trailhead", input: {
        listingRefs: ["venue-a:iowa-republican", "venue-b:senate-control-republican"],
        structuralAnalogy: "One state seat contributes to national chamber control.",
        surfaceDifferences: ["venues and state-party parameters differ"],
        appliedTransferTestRefs: [references.transferTests[0]!.ref],
        activatedCounterScenarioRefs: [], searchSignals: ["republican", "senate"],
        noveltyAxisExplanation: "Cross-venue election pair.",
        rationale: "Candidate remains in the election domain.",
      } })).rejects.toThrow(
        /does not satisfy SURFACE_DOMAIN.*CANDIDATE_PREDICATE_FAMILY_OUTSIDE_SOURCE.*ELECTION_OR_OFFICE/u,
      );
    expect(host.trailheads()).toEqual([]);
  });

  it("admits new geography as parameter novelty and rejects a known source geography", async () => {
    const { lens, prototype, profile, run } = runtimeFixture("SUBJECT_AND_GEOGRAPHY");
    const geographySnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hash("geography-axis-source-set"),
      eligibleSourceCount: 3, excludedSourceCount: 0,
      listings: [
        listing({ ref: "geo:georgia-seat", venue: "geo",
          title: "Georgia Senate Election Winner — Republican Party" }),
        listing({ ref: "geo:iowa-seat", venue: "geo",
          title: "Iowa Senate Election Winner — Republican Party" }),
        listing({ ref: "geo:senate-control", venue: "geo",
          title: "Which party will control the U.S. Senate? — Republican Party" }),
      ],
    });
    const references = buildMechanismPrototypeExplorationPrototypeReferences(prototype);
    const terminal = (listingRefs: readonly string[], host:
      MechanismPrototypeExplorationAgentToolHost) => host.execute({
        task: lens.task, run, executionProfile: profile,
        toolName: "submit_mechanism_exploration_trailhead", input: {
          listingRefs, structuralAnalogy: "One state seat contributes to chamber control.",
          surfaceDifferences: ["state parameter differs"],
          appliedTransferTestRefs: [references.transferTests[0]!.ref],
          activatedCounterScenarioRefs: [], searchSignals: ["state", "senate"],
          noveltyAxisExplanation: "Geography parameter changes.",
          rationale: "The role structure remains in the election domain.",
        },
      });
    const inspectPair = async (seatRef: string) => {
      const host = new MechanismPrototypeExplorationAgentToolHost(
        lens.currentInputRevision, prototype, geographySnapshot,
      );
      await host.execute({ task: lens.task, run, executionProfile: profile,
        toolName: "search_mechanism_exploration_corpus", input: {
          patterns: ["Senate"], syntax: "LITERAL", mode: "ANY",
          fields: ["title"], venueIds: [], limit: 10,
        } });
      await host.execute({ task: lens.task, run, executionProfile: profile,
        toolName: "inspect_mechanism_exploration_listings", input: {
          listingRefs: [seatRef, "geo:senate-control"],
        } });
      return host;
    };
    const knownHost = await inspectPair("geo:iowa-seat");
    await expect(terminal(["geo:iowa-seat", "geo:senate-control"], knownHost))
      .rejects.toThrow(/does not satisfy SUBJECT_AND_GEOGRAPHY/u);
    const novelHost = await inspectPair("geo:georgia-seat");
    await expect(terminal(["geo:georgia-seat", "geo:senate-control"], novelHost))
      .resolves.toMatchObject({ status: "ACCEPTED" });
    expect(novelHost.trailheads()[0]?.axisAssessment).toMatchObject({
      requestedAxis: "SUBJECT_AND_GEOGRAPHY",
      groundedAxisEvidenceSignals: ["georgia"],
      observedNoveltyDimensions: expect.arrayContaining(["SUBJECT_OR_GEOGRAPHY_PARAMETER"]),
    });
  });

  it("keeps scheduling coverage out of the compact reasoning view", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const expandedInput = Object.freeze({
      ...lens.currentInputRevision,
      coverageMembers: Object.freeze(Array.from({ length: 202 }, (_, index) => Object.freeze({
        listingRef: `coverage:${index}`,
        semanticListingIdentity: hash(`coverage:${index}`),
        inclusionReasons: Object.freeze(["PROTOTYPE_SIGNAL_MATCH" as const]),
      }))),
    });
    const host = new MechanismPrototypeExplorationAgentToolHost(
      expandedInput, prototype, snapshot,
    );
    const read = await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "read_mechanism_exploration_lens", input: {},
    });
    const serialized = JSON.stringify(read.output);
    expect(read).toMatchObject({
      status: "ACCEPTED",
      output: {
        schemaVersion: "pmh.mechanism-prototype-exploration-reasoning-view.v3",
        axisContract: {
          admissionRule: "CANDIDATE_PREDICATE_FAMILY_OUTSIDE_SOURCE",
          sourcePredicateFamilies: expect.arrayContaining(["ELECTION_OR_OFFICE"]),
          representationChangeAloneInsufficient: true,
        },
        coverage: { memberCount: 202, membersOmittedFromReasoningView: true },
        prototype: {
          transferTests: [{ ref: expect.stringMatching(/^sha256:/u), text: prototype.transferTests[0] }],
        },
        terminalReferencePolicy: "CITE_EXACT_FIRST_PARTY_REFS",
      },
    });
    expect(serialized).not.toContain("coverageMembers");
    expect(serialized.length).toBeLessThan(20_000);
    expect(JSON.stringify(expandedInput).length).toBeGreaterThan(serialized.length * 3);
  });

  it("rejects uninspected positives and empty-search exhaustion", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    const references = buildMechanismPrototypeExplorationPrototypeReferences(prototype);
    await expect(host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "submit_mechanism_exploration_trailhead",
      input: {
        listingRefs: ["venue-sport:constructors", "venue-race:italy"],
        structuralAnalogy: "Uninspected analogy.", surfaceDifferences: ["sports"],
        appliedTransferTestRefs: [references.transferTests[0]!.ref],
        activatedCounterScenarioRefs: [], searchSignals: ["sports"],
        noveltyAxisExplanation: "Cross-domain.", rationale: "Not inspected.",
      },
    })).rejects.toThrow(/inspected/u);
    await expect(host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "record_mechanism_exploration_exhaustion",
      input: {
        inspectedListingRefs: ["venue-sport:constructors"],
        searchedNeighborhoods: ["motorsport"],
        failedTransferTestRefs: [references.transferTests[0]!.ref],
        activatedCounterScenarioRefs: [], reason: "No exact analogy survived.",
      },
    })).rejects.toThrow(/inspected|search/u);
  });

  it("fails closed on foreign prototype references and materializes exact exhaustion prose", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    const references = buildMechanismPrototypeExplorationPrototypeReferences(prototype);
    await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "search_mechanism_exploration_corpus",
      input: { patterns: ["Scuderia Ferrari"], syntax: "LITERAL", mode: "ANY",
        fields: ["title"], venueIds: [], limit: 10 },
    });
    await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "inspect_mechanism_exploration_listings",
      input: { listingRefs: ["venue-sport:constructors"] },
    });
    const terminal = (failedTransferTestRefs: readonly string[]) => host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "record_mechanism_exploration_exhaustion",
      input: {
        inspectedListingRefs: ["venue-sport:constructors"],
        searchedNeighborhoods: ["motorsport aggregate"],
        failedTransferTestRefs,
        activatedCounterScenarioRefs: [],
        reason: "The inspected aggregate does not establish a component pair.",
      },
    });
    await expect(terminal([hash("foreign-prototype-test")]))
      .rejects.toThrow(/unknown transfer test reference/u);
    await expect(terminal([prototype.transferTests[0]!]))
      .rejects.toThrow(/references are invalid/u);
    await expect(terminal([references.transferTests[0]!.ref]))
      .resolves.toMatchObject({ status: "ACCEPTED" });
    expect(host.exhaustions()[0]?.failedTransferTests)
      .toEqual([prototype.transferTests[0]]);
  });
});
