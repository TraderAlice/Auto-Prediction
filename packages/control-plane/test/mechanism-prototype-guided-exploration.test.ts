import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertMechanismPrototypeExplorationInputRevision,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildCorpusDialectAtlas,
  buildRepresentationRoleCoverageFeedback,
  buildAgentRun,
  completeAgentRun,
  buildModelInvocation,
  buildAgentToolEffect,
  activateAgentCampaign,
  buildMechanismPrototypeExplorationCampaignPreview,
  buildMechanismPrototypeExplorationPrototypeReferences,
  buildMechanismPrototypeExplorationExhaustion,
  buildMechanismPrototypeExplorationFlatSearchObservation,
  buildMechanismPrototypeExplorationRoleSearchObservation,
  buildMechanismPrototypeExplorationStepObservation,
  compileMechanismPrototypeExplorationExperimentEpisodes,
  buildMechanismPrototypeExplorationMemoryProjection,
  buildMechanismPrototypeExplorationHypothesisIntentAttentionPortfolio,
  classifyMechanismPrototypeExplorationHypothesisIntentRealization,
  buildPausedAgentCampaign,
  buildDefaultAgentRuntimePortfolio,
  defaultAiRuntimeConfiguration,
  resolveMechanismPrototypeExplorationCampaignInput,
  searchMechanismPrototypeExplorationRoles,
  searchMechanismPrototypeExplorationCorpus,
  SqliteOperationalStore,
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
  assertMechanismPrototypeExplorationActionReadiness,
  MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
  type DiscoveryCatalogListing,
  type MechanismPrototypeExplorationActionObservation,
  type MechanismPrototypeExplorationFlatSearchObservation,
  type MechanismPrototypeExplorationRoleSearchObservation,
  type MechanismPrototypeExplorationStore,
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
  const mechanismProposals = [
    mechanismProposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
    mechanismProposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
  ];
  const sourceInput = materializeWorldStateMechanismPrototypeResearchCases(
    compileConsolidatedWorldStateMechanismRoutes(mechanismProposals),
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
  return { sourceInput, prototype, mechanismProposals };
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
  it("causally distinguishes role-ontology blindness, scoped absence, and bridge gaps", () => {
    const { sourceInput, prototype, mechanismProposals } = acceptedPrototype();
    const snapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hash("feedback-source"), eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: [
        listing({ ref: "opinion:a-vs-b", venue: "opinion", title: "Baltimore vs Buffalo" }),
        listing({ ref: "sports:race", venue: "sports", title: "Will Baltimore win the Italian Grand Prix race?" }),
        listing({ ref: "sports:championship", venue: "sports", title: "Will McLaren win the Formula 1 constructors championship?" }),
      ],
    });
    const lens = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype], prototypeInputs: [sourceInput], corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    }).lenses[0]!;
    const observe = (call: string, result: ReturnType<typeof searchMechanismPrototypeExplorationRoles>) =>
      buildMechanismPrototypeExplorationRoleSearchObservation({
        researchInput: lens.currentInputRevision, sourceAgentRunId: hash(`run:${call}`),
        sourceToolCallId: call, capturedAt: NOW, result,
      });
    const blind = observe("blind", searchMechanismPrototypeExplorationRoles({ corpus: snapshot,
      componentQuery: { patterns: ["vs"], fields: ["title"] },
      aggregateQuery: { patterns: ["constructors championship"], fields: ["title"] },
      bridgeSignals: ["Baltimore"] }));
    const absent = observe("absent", searchMechanismPrototypeExplorationRoles({ corpus: snapshot,
      componentQuery: { patterns: ["nonexistent lacrosse"] },
      aggregateQuery: { patterns: ["constructors championship"] },
      bridgeSignals: ["Ferrari"] }));
    const bridge = observe("bridge", searchMechanismPrototypeExplorationRoles({ corpus: snapshot,
      componentQuery: { patterns: ["Italian Grand Prix"] },
      aggregateQuery: { patterns: ["constructors championship"] },
      bridgeSignals: ["unshared subject"] }));
    const feedback = buildRepresentationRoleCoverageFeedback({ corpus: snapshot,
      roleSearchObservations: [blind, absent, bridge] });
    expect(feedback).toMatchObject({ retainedObservationCount: 3,
      classificationCounts: { SOURCE_ABSENT: 1, ONTOLOGY_BLIND_SPOT: 1,
        BRIDGE_GAP: 1, OBSERVATION_INSUFFICIENT: 0 },
      automaticMutation: false, automaticAcquisition: false, automaticDispatch: false,
      semanticDecisionAuthority: false, executionAuthority: false });
    expect(feedback.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: "ONTOLOGY_BLIND_SPOT", role: "COMPONENT",
        recommendedAction: "MUTATE_ROLE_ONTOLOGY", rawHitCount: 1,
        classifiedHitCount: 0, exactListingRefs: ["opinion:a-vs-b"],
        observedTitleForms: ["VERSUS"], lexicalPresenceSemanticAuthority: false }),
      expect.objectContaining({ classification: "SOURCE_ABSENT", role: "COMPONENT",
        recommendedAction: "ACQUIRE_SOURCE", rawHitCount: 0 }),
      expect.objectContaining({ classification: "BRIDGE_GAP", role: "PAIR_BRIDGE",
        recommendedAction: "INVESTIGATE_BRIDGE", pairCount: 0 }),
    ]));
  });

  it("materializes differentiated zero-authority search lenses from one prototype", () => {
    const { sourceInput, prototype, mechanismProposals } = acceptedPrototype();
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
      budget: { maximumModelInvocations: 16, maximumInputTokens: "500000" },
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
  it("prioritizes an unobserved intent without collapsing portfolio roles to a score", () => {
    const report = (declaredIntent: "REPLICATE" | "DIFFERENT_TEST",
      classification: "REALIZED_REPLICATION" | "REALIZED_DIFFERENT_TEST") => Object.freeze({
      schemaVersion:
        "pmh.mechanism-prototype-exploration-hypothesis-intent-realization.v2" as const,
      reportId: hash(`report:${declaredIntent}`), hypothesisId: hash(`hypothesis:${declaredIntent}`),
      episodeId: hash(`episode:${declaredIntent}`), episodeCompletedAt: NOW,
      runStatus: "SUCCEEDED" as const, terminalOutcome: "EXHAUSTION" as const,
      prototypeId: hash("prototype"), axis: "SURFACE_DOMAIN" as const,
      declaredIntent, declaredPriorFamilyId: hash("family"),
      realizedClassification: classification,
      comparisonBasis: "DECLARED_PRIOR_FAMILY" as const, referenceFamilyCount: 1,
      current: Object.freeze({ semanticInputIdentity: hash(`input:${declaredIntent}`),
        sourceAgentRunId: hash(`run:${declaredIntent}`), roleSearchObservationCount: 1,
        flatSearchObservationCount: 0, listingRefCount: 1,
        lexicalRetrievalListingRefCount: 0, pairRefCount: 0,
        listingSetHash: hash("listings"), lexicalRetrievalListingSetHash: hash("flat-listings"),
        pairSetHash: hash("pairs") }),
      comparison: Object.freeze({ referenceHypothesisCount: 1,
        referenceSemanticInputCount: 1, referenceRunCount: 1,
        referenceListingRefCount: 1, referenceLexicalRetrievalListingRefCount: 0,
        referencePairRefCount: 0,
        overlappingListingRefCount: 0, newListingRefCount: 1,
        overlappingLexicalRetrievalListingRefCount: 0,
        newLexicalRetrievalListingRefCount: 0,
        overlappingPairRefCount: 0, newPairRefCount: 0,
        independentSemanticInput: true, independentRun: true }),
      yield: Object.freeze({ effectCount: 5, searchEffectCount: 1, rawHitCount: 10,
        qualifiedHitCount: 1, rolePairCount: 0, inspectedListingCount: 1 }),
      usage: Object.freeze({ invocationCount: 5, knownInputTokens: "1000",
        knownOutputTokens: "100", knownReasoningTokens: "50",
        unknownUsageInvocationCount: 0 }),
      lexicalRetrievalPosture:
        "FLAT_SEARCH_HITS_ARE_RETRIEVAL_COORDINATES_NOT_SEMANTIC_FRONTIER_EVIDENCE" as const,
      identityBasis:
        "EXACT_EFFECT_WINDOW_AND_DURABLE_ROLE_AND_FLAT_SEARCH_COORDINATES" as const,
      proseSimilarityUsed: false as const, schedulingAuthority: false as const,
      semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
      executionAuthority: false as const, externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    const portfolio = buildMechanismPrototypeExplorationHypothesisIntentAttentionPortfolio({
      reports: [report("REPLICATE", "REALIZED_REPLICATION"),
        report("DIFFERENT_TEST", "REALIZED_DIFFERENT_TEST")],
      episodes: [],
    });
    expect(portfolio).toMatchObject({
      firstObservationCandidateIntent: "EXTEND", scalarUtilityScoreUsed: false,
      schedulingAuthority: false, semanticDecisionAuthority: false,
      cohorts: [
        { declaredIntent: "EXTEND", posture: "COVERAGE_GAP", observationCount: 0,
          evidenceDebt: "NO_OBSERVATION", priorityOrdinal: 1 },
        { declaredIntent: "DIFFERENT_TEST", posture: "FRONTIER_EXPANSION",
          evidenceDebt: "NONE", priorityOrdinal: 2 },
        { declaredIntent: "REPLICATE", posture: "REPLICATION_CONTROL",
          evidenceDebt: "NONE", priorityOrdinal: 3 },
      ],
    });
  });

  it("distinguishes independent replication from a zero-frontier extension", () => {
    expect(classifyMechanismPrototypeExplorationHypothesisIntentRealization({
      declaredIntent: "REPLICATE", comparable: true, independentSemanticInput: true,
      independentRun: true, newListingRefCount: 0, newPairRefCount: 0,
    })).toBe("REALIZED_REPLICATION");
    expect(classifyMechanismPrototypeExplorationHypothesisIntentRealization({
      declaredIntent: "EXTEND", comparable: true, independentSemanticInput: true,
      independentRun: true, newListingRefCount: 0, newPairRefCount: 0,
    })).toBe("NO_EVIDENCE_FRONTIER_CHANGE");
    expect(classifyMechanismPrototypeExplorationHypothesisIntentRealization({
      declaredIntent: "DIFFERENT_TEST", comparable: false, independentSemanticInput: true,
      independentRun: true, newListingRefCount: 2, newPairRefCount: 1,
    })).toBe("UNMEASURABLE");
  });

  function runtimeFixture(axis: "SURFACE_DOMAIN" | "SUBJECT_AND_GEOGRAPHY" = "SURFACE_DOMAIN") {
    const { sourceInput, prototype, mechanismProposals } = acceptedPrototype();
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
    return { lens, prototype, mechanismProposals, snapshot, runtime, credential, profile, model, run };
  }

  async function openHypothesis(input: Readonly<{
    host: MechanismPrototypeExplorationAgentToolHost;
    lens: ReturnType<typeof runtimeFixture>["lens"];
    run: ReturnType<typeof runtimeFixture>["run"];
    profile: ReturnType<typeof runtimeFixture>["profile"];
    suffix: string;
    prototypeTestHandle?: string;
  }>) {
    return input.host.execute({ task: input.lens.task, run: input.run,
      executionProfile: input.profile, callId: `hypothesis:${input.suffix}:open`,
      toolName: "open_exploration_hypothesis", input: {
        hypothesisChoice: `${input.prototypeTestHandle ?? "transfer-test:1"}|DIFFERENT_TEST|NEW`,
        intentRationale: "No exact prior family exists for this bounded fixture test.",
        materialVariation: "Move the component/aggregate mechanism into the searched neighborhood.",
        predictedRoleStructure: "A bounded component outcome and a distinct aggregate dependent coexist.",
        supportingObservation: "An inspected role-qualified pair survives the transfer test.",
        falsifyingObservation: "Search finds only parallel alternatives or one role is absent.",
        searchNeighborhoods: ["assigned exact corpus"],
      } });
  }

  async function closeHypothesis(input: Readonly<{
    host: MechanismPrototypeExplorationAgentToolHost;
    lens: ReturnType<typeof runtimeFixture>["lens"];
    run: ReturnType<typeof runtimeFixture>["run"];
    profile: ReturnType<typeof runtimeFixture>["profile"];
    suffix: string;
  }>) {
    return input.host.execute({ task: input.lens.task, run: input.run,
      executionProfile: input.profile, callId: `hypothesis:${input.suffix}:close`,
      toolName: "close_exploration_hypothesis", input: {
        disposition: "UNRESOLVED", observedSupport: [],
        observedFalsifiers: ["bounded fixture observation"],
        rationale: "Close the bounded research hypothesis without semantic admission.",
      } });
  }

  it("routes completion recovery through the exact hypothesis state machine", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    const protocol = lens.task.requestedEffectProtocol;
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "read_mechanism_exploration_context",
    ]);
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "recovery:lens", toolName: "read_mechanism_exploration_context", input: {} });
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "open_exploration_hypothesis",
    ]);
    await openHypothesis({ host, lens, run, profile, suffix: "recovery" });
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "search_mechanism_exploration_roles", "search_mechanism_exploration_corpus",
    ]);
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "recovery:search", toolName: "search_mechanism_exploration_corpus", input: {
        patterns: ["Scuderia Ferrari"], syntax: "LITERAL", mode: "ANY",
        fields: ["title"], venueIds: [], limit: 10,
      } });
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "inspect_mechanism_exploration_listings",
    ]);
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "recovery:inspect", toolName: "inspect_mechanism_exploration_listings",
      input: { listingRefs: ["venue-sport:constructors"] } });
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "record_active_prototype_test_outcome",
    ]);
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "recovery:fail", toolName: "record_active_prototype_test_outcome",
      input: { outcome: "FAILED" } });
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "close_exploration_hypothesis",
    ]);
    await closeHypothesis({ host, lens, run, profile, suffix: "recovery" });
    expect(host.completionRecoveryToolNames(protocol)).toEqual([
      "record_mechanism_exploration_exhaustion",
    ]);
    expect(host.resultToolNames(protocol)).toEqual([
      "submit_mechanism_exploration_trailhead",
      "record_mechanism_exploration_exhaustion",
    ]);
  });

  it("compiles exact ordered effects into a causal experiment episode", () => {
    const { lens, profile, model, run } = runtimeFixture();
    const invocation = buildModelInvocation({
      run, modelProfile: model, ordinal: 1, status: "SUCCEEDED",
      startedAt: NOW, completedAt: "2026-08-13T10:28:28.396Z",
      inputTokens: "1200", outputTokens: "80", reasoningTokens: "20",
      purpose: "PRIMARY_REASONING",
    });
    const readiness = (overrides: Partial<{
      exhaustionEligible: boolean; failedTransferTestOrdinals: readonly number[];
    }> = {}) => Object.freeze({
      positiveEligible: false, positiveMissingPrerequisites: [
        "ROLE_SEARCH_PAIR", "INSPECTED_ROLE_PAIR", "SUPPORTED_PROTOTYPE_TEST",
      ],
      exhaustionEligible: overrides.exhaustionEligible ?? false,
      exhaustionMissingPrerequisites: overrides.exhaustionEligible
        ? [] : ["FAILED_PROTOTYPE_TEST"],
      searchedResultCount: 1, roleSearchResultCount: 0, rolePairCount: 0,
      inspectedListingCount: 1, inspectedRolePairCount: 0,
      appliedTransferTestOrdinals: [],
      failedTransferTestOrdinals: overrides.failedTransferTestOrdinals ?? [],
      activatedCounterScenarioOrdinals: [],
    });
    const definitions = [
      { toolName: "search_mechanism_exploration_corpus", kind: "FLAT_SEARCH" as const,
        readiness: readiness(), summary: { rawHitCount: 4, qualifiedHitCount: 4,
          pairCount: 0, inspectedListingCount: 0, acceptedActionCount: 0,
          acceptedTerminalCount: 0 } },
      { toolName: "inspect_mechanism_exploration_listings", kind: "INSPECTION" as const,
        readiness: readiness(), summary: { rawHitCount: 0, qualifiedHitCount: 0,
          pairCount: 0, inspectedListingCount: 1, acceptedActionCount: 0,
          acceptedTerminalCount: 0 } },
      { toolName: "record_active_prototype_test_outcome", kind: "PROTOTYPE_ACTION" as const,
        readiness: readiness({ exhaustionEligible: true, failedTransferTestOrdinals: [1] }),
        summary: { rawHitCount: 0, qualifiedHitCount: 0, pairCount: 0,
          inspectedListingCount: 0, acceptedActionCount: 1, acceptedTerminalCount: 0 } },
      { toolName: "record_mechanism_exploration_exhaustion",
        kind: "EXHAUSTION_TERMINAL" as const,
        readiness: readiness({ exhaustionEligible: true, failedTransferTestOrdinals: [1] }),
        summary: { rawHitCount: 0, qualifiedHitCount: 0, pairCount: 0,
          inspectedListingCount: 0, acceptedActionCount: 0, acceptedTerminalCount: 1 } },
    ];
    const effects = definitions.map((definition, index) => buildAgentToolEffect({
      run, ordinal: index + 1, toolProtocol: MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
      toolName: definition.toolName, status: "ACCEPTED", canonicalInput: {},
      canonicalOutput: definition.summary, sourceInvocation: invocation,
      occurredAt: `2026-08-13T10:28:${30 + index}.396Z`,
    }));
    const steps = effects.map((effect, index) =>
      buildMechanismPrototypeExplorationStepObservation({
        researchInput: lens.currentInputRevision, effect,
        sourceToolCallId: `call:${index + 1}`,
        readinessAfter: definitions[index]!.readiness,
        resultSummary: Object.freeze({ kind: definitions[index]!.kind,
          ...definitions[index]!.summary }),
      })
    );
    const completed = completeAgentRun(run, "SUCCEEDED",
      "2026-08-13T10:28:40.396Z", null);
    const episodes = compileMechanismPrototypeExplorationExperimentEpisodes({
      inputs: [lens.currentInputRevision], stepObservations: steps,
      execution: { runtimeDefinitions: [], credentialBindings: [], modelProfiles: [model],
        executionProfiles: [profile], capabilityObservations: [], workloadRoutes: [], tasks: [],
        runs: [completed], modelInvocations: [invocation], toolEffects: effects,
        runArtifacts: [], runAnnotations: [], campaigns: [], resultSelections: [] },
    });
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      sourceAgentRunId: run.runId, runStatus: "SUCCEEDED",
      ledgerCompleteness: "COMPLETE_EFFECT_LEDGER", terminalOutcome: "EXHAUSTION",
      firstPositiveEligibleEffectOrdinal: null, firstExhaustionEligibleEffectOrdinal: 3,
      yield: { effectCount: 4, acceptedEffectCount: 4, rejectedEffectCount: 0,
        searchEffectCount: 1, rawHitCount: 4, qualifiedHitCount: 4,
        inspectedListingCount: 1, acceptedActionCount: 1 },
      usage: { invocationCount: 1, knownInputTokens: "1200",
        knownOutputTokens: "80", knownReasoningTokens: "20" },
      authority: "PROVIDER_FREE_EXPLORATION_EXPERIMENT_MEMORY_ONLY",
      semanticDecisionAuthority: false, valueMovingAuthority: false,
    });
    expect(episodes[0]!.steps[2]).toMatchObject({
      effectOrdinal: 3, invocationPurpose: "PRIMARY_REASONING",
      exhaustionBecameEligible: true,
    });
    const memory = buildMechanismPrototypeExplorationMemoryProjection({
      inputs: [lens.currentInputRevision], stepObservations: steps,
      execution: { runtimeDefinitions: [], credentialBindings: [], modelProfiles: [model],
        executionProfiles: [profile], capabilityObservations: [], workloadRoutes: [], tasks: [],
        runs: [completed], modelInvocations: [invocation], toolEffects: effects,
        runArtifacts: [], runAnnotations: [], campaigns: [], resultSelections: [] },
    });
    expect(memory).toMatchObject({
      retainedInputCount: 1, retainedStepCount: 4, episodeCount: 1,
      completeEpisodeCount: 1, interruptedOrFailedEpisodeCount: 0,
      terminalOutcomeCounts: { trailhead: 0, exhaustion: 1, noAcceptedTerminal: 0 },
      usage: { invocationCount: 1, knownInputTokens: "1200" },
      currentCorpusAuthority: false, currentEligibilityAuthority: false,
      campaignAuthority: false, automaticDispatch: false,
      effects: { providerRequests: 0, modelInvocations: 0, tasks: 0,
        campaigns: 0, dispatches: 0, writes: 0, externalWrites: 0,
        valueMovingActions: 0 },
    });
    expect(memory.episodes[0]!.episodeId).toBe(episodes[0]!.episodeId);
  });

  it("retains a revisable falsifiable hypothesis in exact post-effect steps", async () => {
    const { lens, prototype, snapshot, profile, model, run } = runtimeFixture();
    const steps: MechanismPrototypeExplorationStepObservation[] = [];
    const storage = <K extends string>(idempotencyKey: K) => Object.freeze({
      mode: "MEMORY" as const, durable: false, schemaVersion: 62, idempotencyKey,
    });
    const store: MechanismPrototypeExplorationStore = {
      mechanismPrototypeExplorationInputStorage: storage("inputRevisionId"),
      mechanismPrototypeExplorationTrailheadStorage: storage("trailheadId"),
      mechanismPrototypeExplorationExhaustionStorage: storage("exhaustionId"),
      mechanismPrototypeExplorationRoleSearchObservationStorage: storage("observationId"),
      mechanismPrototypeExplorationFlatSearchObservationStorage: storage("observationId"),
      mechanismPrototypeExplorationActionObservationStorage: storage("observationId"),
      mechanismPrototypeExplorationStepObservationStorage: storage("observationId"),
      loadMechanismPrototypeExplorationInputs: () => [], saveMechanismPrototypeExplorationInputs: (v) => v,
      loadMechanismPrototypeExplorationTrailheads: () => [], saveMechanismPrototypeExplorationTrailheads: (v) => v,
      loadMechanismPrototypeExplorationExhaustions: () => [], saveMechanismPrototypeExplorationExhaustions: (v) => v,
      loadMechanismPrototypeExplorationRoleSearchObservations: () => [], saveMechanismPrototypeExplorationRoleSearchObservations: (v) => v,
      loadMechanismPrototypeExplorationFlatSearchObservations: () => [], saveMechanismPrototypeExplorationFlatSearchObservations: (v) => v,
      loadMechanismPrototypeExplorationActionObservations: () => [], saveMechanismPrototypeExplorationActionObservations: (v) => v,
      loadMechanismPrototypeExplorationStepObservations: () => steps,
      saveMechanismPrototypeExplorationStepObservations: (v) => { steps.push(...v); return v; },
    };
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot, store,
    );
    const calls = [
      { callId: "hypothesis:open", toolName: "open_exploration_hypothesis", input: {
        hypothesisChoice: "transfer-test:1|DIFFERENT_TEST|NEW",
        intentRationale: "No exact prior family exists for this fixture.",
        materialVariation: "Transfer into sports.",
        predictedRoleStructure: "Race component and championship aggregate.",
        supportingObservation: "A role-qualified inspected pair.",
        falsifyingObservation: "Only parallel winner alternatives.",
        searchNeighborhoods: ["motorsport"] } },
      { callId: "hypothesis:revise", toolName: "revise_exploration_hypothesis", input: {
        materialVariation: "Transfer into team-season sports.",
        predictedRoleStructure: "Game component and season aggregate.",
        supportingObservation: "A shared team with distinct temporal scopes.",
        falsifyingObservation: "Contracts settle the same event.",
        searchNeighborhoods: ["team games", "season winners"],
        revisionReason: "Reconnaissance suggests time scope is the material axis." } },
      { callId: "hypothesis:close", toolName: "close_exploration_hypothesis", input: {
        disposition: "FALSIFIED", observedSupport: [],
        observedFalsifiers: ["all retrieved markets were parallel alternatives"],
        rationale: "The predicted component/aggregate role split was absent." } },
    ] as const;
    const effects: AgentToolEffect[] = [];
    const invocations = calls.map((call, index) => buildModelInvocation({ run,
      modelProfile: model, ordinal: index + 1, status: "SUCCEEDED", startedAt: NOW,
      completedAt: NOW, inputTokens: "100", outputTokens: "20", reasoningTokens: "5",
      purpose: "PRIMARY_REASONING" }));
    for (const [index, call] of calls.entries()) {
      const result = await host.execute({ task: lens.task, run, executionProfile: profile,
        ...call });
      expect(result.status).toBe("ACCEPTED");
      const effect = buildAgentToolEffect({ run, ordinal: index + 1,
        toolProtocol: MECHANISM_PROTOTYPE_EXPLORATION_TOOL_PROTOCOL,
        toolName: call.toolName, status: result.status, canonicalInput: call.input,
        canonicalOutput: result.output, sourceInvocation: invocations[index]!, occurredAt: NOW });
      effects.push(effect);
      host.observeEffect({ context: { task: lens.task, run, executionProfile: profile,
        ...call }, result, effect });
    }
    expect(steps.map((step) => step.hypothesisEvent)).toEqual(["OPENED", "REVISED", "CLOSED"]);
    expect(steps[2]).toMatchObject({ resultSummary: { kind: "HYPOTHESIS_ACTION" },
      readinessAfter: { activeHypothesis: false, closedHypothesisCount: 1 },
      hypothesisAfter: { revision: 3, status: "CLOSED", disposition: "FALSIFIED",
        semanticDecisionAuthority: false } });
    const episode = compileMechanismPrototypeExplorationExperimentEpisodes({
      inputs: [lens.currentInputRevision], stepObservations: steps,
      execution: { runtimeDefinitions: [], credentialBindings: [], modelProfiles: [model],
        executionProfiles: [profile], capabilityObservations: [], workloadRoutes: [], tasks: [],
        runs: [completeAgentRun(run, "SUCCEEDED", NOW, null)], modelInvocations: invocations,
        toolEffects: effects, runArtifacts: [], runAnnotations: [], campaigns: [],
        resultSelections: [] },
    })[0]!;
    expect(episode).toMatchObject({
      schemaVersion: "pmh.mechanism-prototype-exploration-experiment-episode.v2",
      hypotheses: [{ revisions: [{ revision: 1 }, { revision: 2 }, { revision: 3 }],
        final: { disposition: "FALSIFIED" }, openedEffectOrdinal: 1,
        closedEffectOrdinal: 3 }], usage: { knownInputTokens: "300" },
    });
    const memory = buildMechanismPrototypeExplorationMemoryProjection({
      inputs: [lens.currentInputRevision], stepObservations: steps,
      execution: { runtimeDefinitions: [], credentialBindings: [], modelProfiles: [model],
        executionProfiles: [profile], capabilityObservations: [], workloadRoutes: [], tasks: [],
        runs: [completeAgentRun(run, "SUCCEEDED", NOW, null)], modelInvocations: invocations,
        toolEffects: effects, runArtifacts: [], runAnnotations: [], campaigns: [],
        resultSelections: [] },
    });
    expect(memory).toMatchObject({ hypothesisFamilyCount: 1,
      hypothesisFamilies: [{ axis: "SURFACE_DOMAIN", hypothesisCount: 1,
        distinctRunCount: 1, distinctSemanticInputCount: 1,
        dispositionCounts: { SUPPORTED: 0, WEAKENED: 0, FALSIFIED: 1, UNRESOLVED: 0 },
        selectionSignal: "FIRST_OBSERVATION",
        yield: { effectCount: 3, searchEffectCount: 0 },
        usage: { invocationCount: 3, knownInputTokens: "300" },
        identityBasis: "EXACT_PROTOTYPE_AXIS_AND_TEST_BINDING",
        proseSimilarityUsed: false, schedulingAuthority: false,
        semanticDecisionAuthority: false, valueMovingAuthority: false }] });
    const family = memory.hypothesisFamilies[0]!;
    const nextHost = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot, undefined, [family],
      memory.hypothesisIntentAttentionPortfolio,
    );
    const lensRead = await nextHost.execute({ task: lens.task, run,
      executionProfile: profile, callId: "lens:attention",
      toolName: "read_mechanism_exploration_context", input: {} });
    expect(lensRead).toMatchObject({ status: "ACCEPTED", output: {
      hypothesisIntentAttention: {
        portfolioIdentity: memory.hypothesisIntentAttentionPortfolio.portfolioIdentity,
        firstObservationCandidateIntent: "EXTEND",
        recommendationPolicy: "DESCRIPTIVE_OBSERVATION_DEBT_NOT_REQUIRED_INTENT",
        schedulingAuthority: false, semanticDecisionAuthority: false,
        executionAuthority: false,
      },
    } });
    expect((lensRead.output as { hypothesisIntentAttention: {
      cohorts: readonly unknown[] } }).hypothesisIntentAttention.cohorts).toEqual(
      expect.arrayContaining([expect.objectContaining({ declaredIntent: "EXTEND",
        posture: "COVERAGE_GAP", observationCount: 0,
        evidenceDebt: "NO_OBSERVATION", knownInputTokens: "0" })]),
    );
    await expect(nextHost.execute({ task: lens.task, run, executionProfile: profile,
      callId: "hypothesis:duplicate", toolName: "open_exploration_hypothesis", input: {
        hypothesisChoice: "transfer-test:1|DIFFERENT_TEST|NEW",
        intentRationale: "Pretend this exact test is new.",
        materialVariation: "Paraphrase the same transfer.",
        predictedRoleStructure: "Same component and aggregate.",
        supportingObservation: "Same support.", falsifyingObservation: "Same falsifier.",
        searchNeighborhoods: ["same neighborhood"],
      } })).resolves.toMatchObject({ status: "REJECTED", output: {
        diagnostic: expect.stringMatching(/no prior family/u),
      } });
    await expect(nextHost.execute({ task: lens.task, run, executionProfile: profile,
      callId: "hypothesis:extend", toolName: "open_exploration_hypothesis", input: {
        hypothesisChoice: `transfer-test:1|EXTEND|${family.familyId}`,
        intentRationale: "Extend the exact family into a new settlement-time neighborhood.",
        materialVariation: "Change temporal scope while retaining the exact test.",
        predictedRoleStructure: "Component resolves earlier than aggregate.",
        supportingObservation: "Distinct time scopes and shared subject.",
        falsifyingObservation: "The contracts resolve the same event and time.",
        searchNeighborhoods: ["earlier component", "later aggregate"],
      } })).resolves.toMatchObject({ status: "ACCEPTED", output: { status: "ACTIVE" } });
  });

  it("searches and inspects before retaining an exact routing-only trailhead", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    const manifest = host.manifest(lens.task.requestedEffectProtocol);
    expect(manifest.map((tool) => tool.name)).toEqual([
      "read_mechanism_exploration_context",
    ]);
    expect(host.manifestRefreshPolicy(lens.task.requestedEffectProtocol))
      .toBe("AFTER_ACCEPTED_EFFECT");
    expect(manifest.map((tool) => tool.name)).not.toEqual(expect.arrayContaining([
      "read_corpus_dialect_atlas", "mark_transfer_test_1_applied",
      "mark_transfer_test_1_failed", "activate_counter_scenario_1",
    ]));
    expect(host.resultToolNames(lens.task.requestedEffectProtocol)).toEqual([
      "submit_mechanism_exploration_trailhead",
      "record_mechanism_exploration_exhaustion",
    ]);
    const search = await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "search_mechanism_exploration_roles",
      input: {
        component: { patterns: ["race"], syntax: "LITERAL", mode: "ANY",
          fields: ["title"], venueIds: [], limit: 10 },
        aggregate: { patterns: ["constructors championship"], syntax: "LITERAL",
          mode: "ANY", fields: ["title"], venueIds: [], limit: 10 },
        bridgeSignals: ["Scuderia Ferrari"], pairLimit: 10,
      },
    });
    expect(search).toMatchObject({ status: "ACCEPTED", output: {
      rawComponentHitCount: 1, rawAggregateHitCount: 1, pairCount: 1,
      pairs: [{ componentListingRef: "venue-race:italy",
        aggregateListingRef: "venue-sport:constructors",
        groundedBridgeSignals: expect.arrayContaining(["scuderia ferrari"]) }],
      semanticDecisionAuthority: false,
      readiness: {
        searchedResultCount: 1, roleSearchResultCount: 1, rolePairCount: 1,
        inspectedListingCount: 0, inspectedRolePairCount: 0,
        positive: { eligible: false,
          missingPrerequisites: ["INSPECTED_ROLE_PAIR", "SUPPORTED_PROTOTYPE_TEST",
            "CLOSED_HYPOTHESIS"] },
        exhaustion: { eligible: false,
          missingPrerequisites: ["INSPECTED_LISTING", "FAILED_PROTOTYPE_TEST",
            "CLOSED_HYPOTHESIS"] },
        prescriptiveSearchAuthority: false, semanticDecisionAuthority: false,
      },
    } });
    assertMechanismPrototypeExplorationActionReadiness(
      (search.output as { readiness: unknown }).readiness,
    );
    const roleSearchResultId = (search.output as { resultIdentity: Hash }).resultIdentity;
    await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "inspect_mechanism_exploration_listings",
      input: { listingRefs: ["venue-sport:constructors", "venue-race:italy"] },
    });
    await openHypothesis({ host, lens, run, profile, suffix: "trailhead" });
    const applied = await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "record_active_prototype_test_outcome", input: { outcome: "SUPPORTED" } });
    expect(applied).toMatchObject({ output: { readiness: {
      appliedTransferTestOrdinals: [1], inspectedRolePairCount: 1,
      positive: { eligible: false, missingPrerequisites: ["CLOSED_HYPOTHESIS"] },
      exhaustion: { eligible: false,
        missingPrerequisites: ["FAILED_PROTOTYPE_TEST", "CLOSED_HYPOTHESIS"] },
    } } });
    const closed = await closeHypothesis({ host, lens, run, profile, suffix: "trailhead" });
    expect(closed).toMatchObject({ output: { readiness: {
      positive: { eligible: true, missingPrerequisites: [] },
    } } });
    const retained = await host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "submit_mechanism_exploration_trailhead",
      input: {
        roleSearchResultId, componentListingRef: "venue-race:italy",
        aggregateListingRef: "venue-sport:constructors",
        structuralAnalogy: "One race result may contribute points to an aggregate constructors championship.",
        surfaceDifferences: ["sports points replace office membership"], searchSignals: ["race", "constructors championship"],
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
      roleSearchBinding: {
        resultIdentity: roleSearchResultId,
        componentListingRef: "venue-race:italy",
        aggregateListingRef: "venue-sport:constructors",
        groundedBridgeSignals: expect.arrayContaining(["scuderia ferrari"]),
        semanticDecisionAuthority: false,
      },
    });
  });

  it("rejects parallel alternatives and returns only role-grounded bridge pairs", () => {
    const snapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hash("role-search-source-set"), eligibleSourceCount: 2,
      excludedSourceCount: 0, listings: [
        listing({ ref: "sports:baltimore", venue: "sports",
          title: "AFC Championship Winner — Baltimore" }),
        listing({ ref: "sports:buffalo", venue: "sports",
          title: "AFC Championship Winner — Buffalo" }),
        listing({ ref: "race:italy", venue: "race",
          title: "Will Scuderia Ferrari win the Italian Grand Prix race?" }),
        listing({ ref: "f1:constructors", venue: "f1",
          title: "Will Scuderia Ferrari win the Formula 1 constructors championship?" }),
      ],
    });
    const result = searchMechanismPrototypeExplorationRoles({
      corpus: snapshot,
      componentQuery: { patterns: ["race", "AFC Championship"], syntax: "LITERAL",
        mode: "ANY", fields: ["title"], limit: 10 },
      aggregateQuery: { patterns: ["constructors championship", "AFC Championship"],
        syntax: "LITERAL", mode: "ANY", fields: ["title"], limit: 10 },
      bridgeSignals: ["Scuderia Ferrari"], pairLimit: 10,
    });
    expect(result).toMatchObject({
      rawComponentHitCount: 3, rawAggregateHitCount: 3,
      componentHits: [{ listingRef: "race:italy" }],
      aggregateHits: [{ listingRef: "f1:constructors" }],
      unclassifiedComponentListingRefs: ["sports:baltimore", "sports:buffalo"],
      unclassifiedAggregateListingRefs: ["sports:baltimore", "sports:buffalo"],
      pairCount: 1,
      pairs: [{ componentListingRef: "race:italy",
        aggregateListingRef: "f1:constructors",
        groundedBridgeSignals: expect.arrayContaining(["scuderia ferrari"]) }],
      roleCueSemanticAuthority: false,
      bridgeSignalSubjectIdentityAuthority: false,
    });
  });

  it("persists each accepted role and flat search before any terminal result exists", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const observations: MechanismPrototypeExplorationRoleSearchObservation[] = [];
    const flatObservations: MechanismPrototypeExplorationFlatSearchObservation[] = [];
    const actionObservations: MechanismPrototypeExplorationActionObservation[] = [];
    const storage = <K extends string>(idempotencyKey: K) => Object.freeze({
      mode: "MEMORY" as const, durable: false, schemaVersion: 62, idempotencyKey,
    });
    const store: MechanismPrototypeExplorationStore = {
      mechanismPrototypeExplorationInputStorage: storage("inputRevisionId"),
      mechanismPrototypeExplorationTrailheadStorage: storage("trailheadId"),
      mechanismPrototypeExplorationExhaustionStorage: storage("exhaustionId"),
      mechanismPrototypeExplorationRoleSearchObservationStorage: storage("observationId"),
      mechanismPrototypeExplorationFlatSearchObservationStorage: storage("observationId"),
      mechanismPrototypeExplorationActionObservationStorage: storage("observationId"),
      mechanismPrototypeExplorationStepObservationStorage: storage("observationId"),
      loadMechanismPrototypeExplorationInputs: () => [],
      saveMechanismPrototypeExplorationInputs: (values) => values,
      loadMechanismPrototypeExplorationTrailheads: () => [],
      saveMechanismPrototypeExplorationTrailheads: (values) => values,
      loadMechanismPrototypeExplorationExhaustions: () => [],
      saveMechanismPrototypeExplorationExhaustions: (values) => values,
      loadMechanismPrototypeExplorationRoleSearchObservations: () => observations,
      saveMechanismPrototypeExplorationRoleSearchObservations: (values) => {
        observations.push(...values);
        return values;
      },
      loadMechanismPrototypeExplorationFlatSearchObservations: () => flatObservations,
      saveMechanismPrototypeExplorationFlatSearchObservations: (values) => {
        flatObservations.push(...values);
        return values;
      },
      loadMechanismPrototypeExplorationActionObservations: () => actionObservations,
      saveMechanismPrototypeExplorationActionObservations: (values) => {
        actionObservations.push(...values);
        return values;
      },
      loadMechanismPrototypeExplorationStepObservations: () => [],
      saveMechanismPrototypeExplorationStepObservations: (values) => values,
    };
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot, store,
    );
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "role-search:1", toolName: "search_mechanism_exploration_roles", input: {
        component: { patterns: ["race"], syntax: "LITERAL", mode: "ANY",
          fields: ["title"], venueIds: [], limit: 10 },
        aggregate: { patterns: ["constructors championship"], syntax: "LITERAL",
          mode: "ANY", fields: ["title"], venueIds: [], limit: 10 },
        bridgeSignals: ["Scuderia Ferrari"], pairLimit: 10,
      } });
    expect(host.trailheads()).toEqual([]);
    expect(host.exhaustions()).toEqual([]);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      lensId: lens.lensId,
      inputRevisionId: lens.currentInputRevision.inputRevisionId,
      sourceAgentRunId: run.runId,
      sourceToolCallId: "role-search:1",
      capturedAt: run.createdAt,
      result: { pairCount: 1 },
      authority: "DURABLE_ROLE_SEARCH_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
    await openHypothesis({ host, lens, run, profile, suffix: "persisted-action" });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "action:1", toolName: "record_active_prototype_test_outcome",
      input: { outcome: "SUPPORTED" } });
    expect(actionObservations).toHaveLength(1);
    expect(actionObservations[0]).toMatchObject({
      lensId: lens.lensId,
      inputRevisionId: lens.currentInputRevision.inputRevisionId,
      sourceAgentRunId: run.runId,
      sourceToolCallId: "action:1",
      action: "TRANSFER_TEST_APPLIED",
      ordinal: 1,
      exactText: prototype.transferTests[0],
      authority: "DURABLE_PROTOTYPE_EXPLORATION_ACTION_ONLY",
      semanticDecisionAuthority: false,
    });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "flat-search:1", toolName: "search_mechanism_exploration_corpus", input: {
        patterns: ["Ferrari"], syntax: "LITERAL", mode: "ANY",
        fields: ["title"], venueIds: [], limit: 10,
      } });
    expect(flatObservations).toHaveLength(1);
    expect(flatObservations[0]).toMatchObject({
      sourceAgentRunId: run.runId, sourceToolCallId: "flat-search:1",
      result: { query: { patterns: ["Ferrari"] }, hits: expect.any(Array) },
      authority: "DURABLE_FLAT_SEARCH_RETRIEVAL_EVIDENCE_ONLY",
      lexicalHitSemanticAuthority: false, semanticDecisionAuthority: false,
    });
    const interruptedProjection = materializeMechanismPrototypeExplorationProjection({
      prototypes: [prototype],
      prototypeInputs: [lens.sourcePrototypeInput],
      explorationInputs: [lens.currentInputRevision],
      roleSearchObservations: observations,
      actionObservations,
      execution: { runtimeDefinitions: [], credentialBindings: [], modelProfiles: [],
        executionProfiles: [], capabilityObservations: [], workloadRoutes: [], tasks: [],
        runs: [run], modelInvocations: [], toolEffects: [], runArtifacts: [],
        runAnnotations: [], campaigns: [], resultSelections: [] },
      corpus: snapshot,
      ontology: buildMarketOntologySnapshot(snapshot),
    });
    expect(interruptedProjection.usage).toMatchObject({
      sourceRunCount: 1, roleSearchResultCount: 1,
      roleSearchRawHitCount: 2, roleSearchQualifiedHitCount: 2, roleSearchPairCount: 1,
      retainedActionObservationCount: 1,
    });
  });

  it("restores exact flat-search retrieval coordinates across SQLite restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "pmh-flat-search-"));
    const databasePath = join(directory, "control-plane.sqlite");
    try {
      const { lens, prototype, snapshot, runtime, credential, profile, model, run } = runtimeFixture();
      const result = searchMechanismPrototypeExplorationCorpus({ corpus: snapshot,
        query: { patterns: ["Ferrari"], syntax: "LITERAL", mode: "ANY",
          fields: ["title"], limit: 10 } });
      const observation = buildMechanismPrototypeExplorationFlatSearchObservation({
        researchInput: lens.currentInputRevision, sourceAgentRunId: run.runId,
        sourceToolCallId: "flat:durable", capturedAt: run.createdAt, result,
      });
      const first = new SqliteOperationalStore(databasePath);
      first.saveAgentExecutionBatch({ runtimeDefinitions: [runtime],
        credentialBindings: [credential], modelProfiles: [model],
        executionProfiles: [profile], tasks: [lens.task], runs: [run] });
      first.close();
      const seed = new DatabaseSync(databasePath);
      seed.prepare(`INSERT INTO world_state_mechanism_prototype_inputs (
        revision_id, candidate_id, materialized_at, record_json, record_hash
      ) VALUES (?, ?, ?, ?, ?)`)
        .run(lens.sourcePrototypeInput.revisionId, lens.sourcePrototypeInput.candidateId,
          lens.sourcePrototypeInput.materializedAt, JSON.stringify(lens.sourcePrototypeInput),
          hashCanonical(lens.sourcePrototypeInput));
      seed.prepare(`INSERT INTO world_state_mechanism_prototypes (
        prototype_id, candidate_id, input_revision_id, source_agent_run_id,
        proposed_at, record_json, record_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(prototype.prototypeId, prototype.candidateId, lens.sourcePrototypeInput.revisionId,
          run.runId, prototype.proposedAt, JSON.stringify(prototype), hashCanonical(prototype));
      seed.close();
      const persisted = new SqliteOperationalStore(databasePath);
      persisted.saveMechanismPrototypeExplorationInputs([lens.currentInputRevision]);
      expect(persisted.saveMechanismPrototypeExplorationFlatSearchObservations([observation]))
        .toEqual([observation]);
      persisted.close();
      const reopened = new SqliteOperationalStore(databasePath);
      expect(reopened.loadMechanismPrototypeExplorationFlatSearchObservations(10))
        .toEqual([observation]);
      expect(reopened.mechanismPrototypeExplorationFlatSearchObservationStorage)
        .toMatchObject({ mode: "SQLITE_WAL", durable: true, schemaVersion: 62,
          idempotencyKey: "observationId" });
      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
    const roleSearch = await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "search_mechanism_exploration_roles", input: {
        component: { patterns: ["Iowa Senate Election"], syntax: "LITERAL", mode: "ANY",
          fields: ["title"], venueIds: [], limit: 10 },
        aggregate: { patterns: ["control"], syntax: "LITERAL", mode: "ANY",
          fields: ["title"], venueIds: [], limit: 10 },
        bridgeSignals: ["Republican Party"], pairLimit: 10,
      } });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "inspect_mechanism_exploration_listings", input: {
        listingRefs: ["venue-a:iowa-republican", "venue-b:senate-control-republican"],
      } });
    await openHypothesis({ host, lens, run, profile, suffix: "surface-axis" });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "record_active_prototype_test_outcome", input: { outcome: "SUPPORTED" } });
    await closeHypothesis({ host, lens, run, profile, suffix: "surface-axis" });
    await expect(host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "submit_mechanism_exploration_trailhead", input: {
        roleSearchResultId: (roleSearch.output as { resultIdentity: Hash }).resultIdentity,
        componentListingRef: "venue-a:iowa-republican",
        aggregateListingRef: "venue-b:senate-control-republican",
        structuralAnalogy: "One state seat contributes to national chamber control.",
        surfaceDifferences: ["venues and state-party parameters differ"], searchSignals: ["republican", "senate"],
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
    const terminal = (seatRef: string, roleSearchResultId: Hash, host:
      MechanismPrototypeExplorationAgentToolHost) => host.execute({
        task: lens.task, run, executionProfile: profile,
        toolName: "submit_mechanism_exploration_trailhead", input: {
          roleSearchResultId, componentListingRef: seatRef,
          aggregateListingRef: "geo:senate-control",
          structuralAnalogy: "One state seat contributes to chamber control.",
          surfaceDifferences: ["state parameter differs"], searchSignals: ["state", "senate"],
          noveltyAxisExplanation: "Geography parameter changes.",
          rationale: "The role structure remains in the election domain.",
        },
      });
    const inspectPair = async (seatRef: string) => {
      const host = new MechanismPrototypeExplorationAgentToolHost(
        lens.currentInputRevision, prototype, geographySnapshot,
      );
      const roleSearch = await host.execute({ task: lens.task, run, executionProfile: profile,
        toolName: "search_mechanism_exploration_roles", input: {
          component: { patterns: [seatRef.includes("iowa") ? "Iowa" : "Georgia"],
            syntax: "LITERAL", mode: "ANY", fields: ["title"], venueIds: [], limit: 10 },
          aggregate: { patterns: ["control"], syntax: "LITERAL", mode: "ANY",
            fields: ["title"], venueIds: [], limit: 10 },
          bridgeSignals: ["Republican Party"], pairLimit: 10,
        } });
      await host.execute({ task: lens.task, run, executionProfile: profile,
        toolName: "inspect_mechanism_exploration_listings", input: {
          listingRefs: [seatRef, "geo:senate-control"],
        } });
      await openHypothesis({ host, lens, run, profile,
        suffix: seatRef.replace(/[^a-z]/gu, "-") });
      await host.execute({ task: lens.task, run, executionProfile: profile,
        toolName: "record_active_prototype_test_outcome", input: { outcome: "SUPPORTED" } });
      await closeHypothesis({ host, lens, run, profile,
        suffix: seatRef.replace(/[^a-z]/gu, "-") });
      return { host, roleSearchResultId:
        (roleSearch.output as { resultIdentity: Hash }).resultIdentity };
    };
    const known = await inspectPair("geo:iowa-seat");
    await expect(terminal("geo:iowa-seat", known.roleSearchResultId, known.host))
      .rejects.toThrow(/does not satisfy SUBJECT_AND_GEOGRAPHY/u);
    const novel = await inspectPair("geo:georgia-seat");
    await expect(terminal("geo:georgia-seat", novel.roleSearchResultId, novel.host))
      .resolves.toMatchObject({ status: "ACCEPTED" });
    expect(novel.host.trailheads()[0]?.axisAssessment).toMatchObject({
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
      toolName: "read_mechanism_exploration_context", input: {},
    });
    const serialized = JSON.stringify(read.output);
    expect(read).toMatchObject({
      status: "ACCEPTED",
      output: {
        schemaVersion: "pmh.mechanism-prototype-exploration-reasoning-view.v7",
        axisContract: {
          admissionRule: "CANDIDATE_PREDICATE_FAMILY_OUTSIDE_SOURCE",
          sourcePredicateFamilies: expect.arrayContaining(["ELECTION_OR_OFFICE"]),
          representationChangeAloneInsufficient: true,
        },
        coverage: { memberCount: 202, membersOmittedFromReasoningView: true },
        corpusDialectAtlas: {
          atlasIdentity: buildCorpusDialectAtlas(snapshot).atlasIdentity,
          listingCount: snapshot.listingCount,
          venueCount: 4,
          semanticDecisionAuthority: false,
          schedulingAuthority: false,
          executionAuthority: false,
        },
        prototype: {
          transferTests: [{ handle: "transfer-test:1", text: prototype.transferTests[0] }],
          activeTestOutcomeTool: "record_active_prototype_test_outcome",
        },
        terminalReferencePolicy: "FIRST_PARTY_ACTION_TOOLS_ACCUMULATE_EXACT_SELECTIONS",
      },
    });
    expect(serialized).not.toContain("coverageMembers");
    expect(serialized).toContain("predicateNeighborhoods");
    expect(serialized.length).toBeLessThan(30_000);
    expect(JSON.stringify(expandedInput).length).toBeGreaterThan(serialized.length * 3);
  });

  it("returns the exact corpus-dialect atlas in the single bounded context read", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    const first = await host.execute({ task: lens.task, run, executionProfile: profile,
      callId: "context:first", toolName: "read_mechanism_exploration_context", input: {} });
    expect(first).toMatchObject({ status: "ACCEPTED", output: {
      schemaVersion: "pmh.mechanism-prototype-exploration-reasoning-view.v7",
      corpusDialectAtlas: {
        detailedAtlas: {
          schemaVersion: "pmh.corpus-dialect-atlas.v1",
          sourceSnapshotIdentity: snapshot.snapshotIdentity,
          listingCount: snapshot.listingCount,
          venueCount: 4,
          predicateNeighborhoods: expect.arrayContaining([
            expect.objectContaining({ predicateFamily: "SPORTS_RESULT",
              componentRoleCueCount: 0, aggregateRoleCueCount: 1,
              exemplars: expect.arrayContaining([
                expect.objectContaining({ listingRef: "venue-sport:constructors",
                  title: expect.stringContaining("constructors championship") }),
              ]),
            }),
          ]),
        },
      },
      authority: "COMPACT_PROTOTYPE_GUIDED_REASONING_INPUT_ONLY",
    } });
    const repeated = await host.execute({ task: lens.task, run,
      executionProfile: profile, callId: "context:repeat",
      toolName: "read_mechanism_exploration_context", input: {} });
    expect(repeated).toMatchObject({ status: "ACCEPTED", output: {
      schemaVersion: "pmh.mechanism-prototype-exploration-context-reference.v1",
      inputRevisionId: lens.currentInputRevision.inputRevisionId,
      authority: "COMPACT_PROTOTYPE_GUIDED_REASONING_INPUT_REFERENCE_ONLY",
    } });
  });

  it("rejects uninspected positives and empty-search exhaustion", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
    await openHypothesis({ host, lens, run, profile, suffix: "invalid-terminal" });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "record_active_prototype_test_outcome", input: { outcome: "FAILED" } });
    await closeHypothesis({ host, lens, run, profile, suffix: "invalid-terminal" });
    await expect(host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "submit_mechanism_exploration_trailhead",
      input: {
        roleSearchResultId: hash("unsearched-role-result"),
        componentListingRef: "venue-race:italy",
        aggregateListingRef: "venue-sport:constructors",
        structuralAnalogy: "Uninspected analogy.", surfaceDifferences: ["sports"], searchSignals: ["sports"],
        noveltyAxisExplanation: "Cross-domain.", rationale: "Not inspected.",
      },
    })).resolves.toMatchObject({ status: "REJECTED", output: {
      diagnostic: expect.stringMatching(/prior exact role-search pair/u),
      readiness: { positive: { eligible: false,
        missingPrerequisites: expect.arrayContaining(["ROLE_SEARCH_PAIR"]) } },
    } });
    await expect(host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "record_mechanism_exploration_exhaustion",
      input: {
        searchedNeighborhoods: ["motorsport"], reason: "No exact analogy survived.",
      },
    })).rejects.toThrow(/inspected|search/u);
  });

  it("binds outcomes to the active exact prototype test without caller ordinals", async () => {
    const { lens, prototype, snapshot, profile, run } = runtimeFixture();
    const host = new MechanismPrototypeExplorationAgentToolHost(
      lens.currentInputRevision, prototype, snapshot,
    );
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
    await expect(host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "record_active_prototype_test_outcome", input: { outcome: "FAILED" } }))
      .resolves.toMatchObject({ status: "REJECTED", output: {
        diagnostic: "prototype outcome requires an active falsifiable hypothesis",
      } });
    await openHypothesis({ host, lens, run, profile, suffix: "exhaustion" });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "record_active_prototype_test_outcome", input: { outcome: "FAILED" } });
    await closeHypothesis({ host, lens, run, profile, suffix: "exhaustion" });
    await openHypothesis({ host, lens, run, profile, suffix: "counter-scenario",
      prototypeTestHandle: "counter-scenario:1" });
    await host.execute({ task: lens.task, run, executionProfile: profile,
      toolName: "record_active_prototype_test_outcome", input: { outcome: "SUPPORTED" } });
    await closeHypothesis({ host, lens, run, profile, suffix: "counter-scenario" });
    const terminal = () => host.execute({
      task: lens.task, run, executionProfile: profile,
      toolName: "record_mechanism_exploration_exhaustion",
      input: {
        searchedNeighborhoods: ["motorsport aggregate"],
        reason: "The inspected aggregate does not establish a component pair.",
      },
    });
    await expect(terminal())
      .resolves.toMatchObject({ status: "ACCEPTED" });
    expect(host.exhaustions()[0]?.failedTransferTests)
      .toEqual([prototype.transferTests[0]]);
    expect(host.exhaustions()[0]?.activatedCounterScenarios)
      .toEqual([prototype.counterScenarios[0]]);
  });
});
