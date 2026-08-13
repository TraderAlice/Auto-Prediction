import { hashCanonical, type Hash } from "@pmh/domain";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertWorldStateMechanismProposal,
  assessWorldStateMechanismAdmission,
  buildAgentRun,
  buildDefaultAgentRuntimePortfolio,
  buildMarketCorpusSnapshot,
  buildMarketOntologySnapshot,
  buildWorldStateMechanismProposal,
  buildWorldStateMechanismPrototypeAbstention,
  buildWorldStateMechanismCounterexample,
  buildWorldStateMechanismSubjectBindingReview,
  buildWorldStateSubjectBindingAbstention,
  buildWorldStateSubjectBindingAssessment,
  buildWorldStateSubjectBindingResearchInput,
  compileConsolidatedWorldStateMechanismRoutes,
  compileStandingWorldStateMechanismRoute,
  defaultAiRuntimeConfiguration,
  materializeOntologySearchIssueRevisions,
  materializeWorldStateSubjectBindingResearchCases,
  materializeWorldStateMechanismPrototypeResearchCases,
  observeWorldStateMechanismRoutes,
  SqliteOperationalStore,
  worldStateMechanismRouteFamilyIdentity,
  type DiscoveryCatalogListing,
  type WorldStateMechanismEvidenceBinding,
  type WorldStateMechanismProposal,
} from "../src/index.js";

const NOW = "2026-08-13T02:00:00.000Z";
const AFTER = "2026-08-13T02:00:01.000Z";

function hash(label: string): Hash {
  return hashCanonical({ label });
}

function binding(listingRef: string, title: string): WorldStateMechanismEvidenceBinding {
  return Object.freeze({
    listingRef,
    title,
    nodeId: hash(`node:${listingRef}`),
    worldFacetId: hash(`world:${listingRef}`),
    sourceRawHash: hash(`raw:${listingRef}`),
    protocolIdentity: `protocol:${listingRef.split(":")[0]}:v1`,
  });
}

function listing(listingRef: string, title: string): DiscoveryCatalogListing {
  const [venueId, venueInstrumentId] = listingRef.split(":") as [string, string];
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId,
    title,
    description: title,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: "Resolves from the named official source.",
    outcomes: Object.freeze([
      Object.freeze({
        venueOutcomeId: "yes",
        label: "Yes",
        indicativePrice: "400000000000000000",
      }),
      Object.freeze({
        venueOutcomeId: "no",
        label: "No",
        indicativePrice: "600000000000000000",
      }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: NOW,
    sourceRawHash: hash(`raw:${listingRef}`),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function mechanism(
  overrides: Partial<Parameters<typeof buildWorldStateMechanismProposal>[0]> = {},
): WorldStateMechanismProposal {
  return buildWorldStateMechanismProposal({
    ontologyIdentity: hash("ontology:trump"),
    sourceSnapshotIdentity: hash("snapshot:trump"),
    sourceIssueRevisionId: hash("issue-revision:trump"),
    sourceAgentRunId: hash("run:trump"),
    sourceTrailheadIds: [hash("trailhead:trump")],
    sourceRelationPatternIds: [hash("pattern:trump")],
    subjectLabel: "Donald Trump",
    subjectAliases: ["Donald Trump", "Trump"],
    subjectAmbiguityNotes: ["The title must refer to the same individual, not a brand."],
    trigger: {
      predicateLabel: "is shot during August",
      searchSignals: ["shot"],
      influence: "MAY_DEGRADE_STATE",
      evidenceBindings: [binding(
        "venue-a:trump-shot-august",
        "Will Donald Trump be shot during August?",
      )],
    },
    state: {
      dimension: "PHYSICAL_CAPABILITY",
      label: "able to appear personally in public",
    },
    dependent: {
      predicateLabel: "personally livestreams drinking cola during September",
      searchSignals: ["livestream", "drinking cola"],
      requirement: "REQUIRES_STATE_PRESENT",
      evidenceBindings: [binding(
        "venue-b:trump-cola-september",
        "Will Trump personally livestream drinking cola during September?",
      )],
    },
    temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
    counterScenarios: [
      "A non-fatal shooting allows recovery before the September livestream.",
      "A prerecorded or proxy appearance may satisfy one venue but not personal performance.",
    ],
    rationale: "The later act may depend on physical capability after the earlier event.",
    proposedAt: NOW,
    ...overrides,
  });
}

describe("world-state mechanism routes", () => {
  it("retains the shooting/public-appearance mechanism as routing-only memory", () => {
    const proposal = mechanism();
    const route = compileStandingWorldStateMechanismRoute(proposal);
    expect(proposal).toMatchObject({
      schemaVersion: "pmh.world-state-mechanism-proposal.v1",
      state: { dimension: "PHYSICAL_CAPABILITY" },
      trigger: { influence: "MAY_DEGRADE_STATE" },
      dependent: { requirement: "REQUIRES_STATE_PRESENT" },
      temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
      authority: "WORLD_STATE_SEARCH_ROUTING_PROPOSAL_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(route).toMatchObject({
      schemaVersion: "pmh.standing-world-state-mechanism-route.v1",
      sourceProposalId: proposal.proposalId,
      canonicalSubjectLabels: ["donald trump", "trump"],
      triggerPredicate: "is shot during august",
      canonicalTriggerSearchSignals: ["shot"],
      dependentPredicate: "personally livestreams drinking cola during september",
      canonicalDependentSearchSignals: ["drinking cola", "livestream"],
      baselineTriggerListingRefs: ["venue-a:trump-shot-august"],
      baselineDependentListingRefs: ["venue-b:trump-cola-september"],
      counterScenarios: expect.arrayContaining([
        expect.stringContaining("non-fatal shooting"),
        expect.stringContaining("prerecorded or proxy"),
      ]),
      authority: "WORLD_STATE_SEARCH_ROUTING_ONLY",
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(route.routeFamilyId).toBe(worldStateMechanismRouteFamilyIdentity(proposal));
    expect(JSON.stringify(route)).not.toContain("epsilon");
    expect(JSON.stringify(route)).not.toContain("price");
  });

  it("consolidates corroborating evidence but rotates directional ontology changes", () => {
    const original = mechanism();
    const corroborating = mechanism({
      sourceAgentRunId: hash("run:corroborating"),
      trigger: {
        ...original.trigger,
        evidenceBindings: [binding(
          "venue-c:trump-shot-august",
          "Will Trump be shot during August?",
        )],
      },
      dependent: {
        ...original.dependent,
        evidenceBindings: [binding(
          "venue-d:trump-cola-september",
          "Will Donald Trump personally livestream drinking cola during September?",
        )],
      },
      counterScenarios: ["Recovery remains possible."],
      rationale: "Independent venue evidence proposes the same search mechanism.",
    });
    expect(corroborating.proposalId).not.toBe(original.proposalId);
    expect(worldStateMechanismRouteFamilyIdentity(corroborating))
      .toBe(worldStateMechanismRouteFamilyIdentity(original));

    const reversed = mechanism({
      trigger: {
        predicateLabel: original.dependent.predicateLabel,
        searchSignals: original.dependent.searchSignals,
        influence: "MAY_ENABLE_STATE",
        evidenceBindings: original.dependent.evidenceBindings,
      },
      dependent: {
        predicateLabel: original.trigger.predicateLabel,
        searchSignals: original.trigger.searchSignals,
        requirement: "STATE_INFLUENCES_LIKELIHOOD",
        evidenceBindings: original.trigger.evidenceBindings,
      },
    });
    const otherDimension = mechanism({
      state: { dimension: "EXISTENCE", label: "alive" },
    });
    const uncertainOrder = mechanism({ temporalPosture: "ORDER_UNCERTAIN" });
    for (const changed of [reversed, otherDimension, uncertainOrder]) {
      expect(worldStateMechanismRouteFamilyIdentity(changed))
        .not.toBe(worldStateMechanismRouteFamilyIdentity(original));
    }

    expect(assessWorldStateMechanismAdmission({
      candidate: original,
      retained: [],
    })).toMatchObject({
      classification: "NOVEL_MECHANISM_FAMILY",
      admitted: true,
      providerRequests: 0,
      modelInvocations: 0,
    });
    expect(assessWorldStateMechanismAdmission({
      candidate: corroborating,
      retained: [original],
    })).toMatchObject({
      classification: "CORROBORATING_MECHANISM_EVIDENCE",
      admitted: true,
      newEvidenceBindingCount: 2,
    });
    const redundant = mechanism({
      sourceAgentRunId: hash("run:redundant"),
      rationale: "Different prose cannot buy another identical mechanism memory slot.",
    });
    expect(assessWorldStateMechanismAdmission({
      candidate: redundant,
      retained: [original],
    })).toMatchObject({
      classification: "REDUNDANT_MECHANISM_MEMORY",
      admitted: false,
      overlappingProposalIds: [original.proposalId],
      newEvidenceBindingCount: 0,
      newCounterScenarioCount: 0,
    });
    const newCounter = mechanism({
      sourceAgentRunId: hash("run:new-counter"),
      counterScenarios: [
        ...original.counterScenarios,
        "The trigger contract could resolve yes for an incident after the dependent act.",
      ],
    });
    expect(assessWorldStateMechanismAdmission({
      candidate: newCounter,
      retained: [original],
    })).toMatchObject({
      classification: "CORROBORATING_COUNTER_SCENARIO",
      admitted: true,
      newCounterScenarioCount: 1,
    });

    const consolidated = compileConsolidatedWorldStateMechanismRoutes([
      corroborating,
      original,
      newCounter,
    ]);
    expect(consolidated).toHaveLength(1);
    expect(consolidated[0]).toMatchObject({
      routeFamilyId: worldStateMechanismRouteFamilyIdentity(original),
      sourceProposalIds: expect.arrayContaining([
        original.proposalId,
        corroborating.proposalId,
        newCounter.proposalId,
      ]),
      authority: "CONSOLIDATED_WORLD_STATE_SEARCH_ROUTING_ONLY",
      providerRequests: 0,
      modelInvocations: 0,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(consolidated[0]!.triggerEvidenceBindings).toHaveLength(2);
    expect(consolidated[0]!.dependentEvidenceBindings).toHaveLength(2);
    expect(consolidated[0]!.counterScenarios).toHaveLength(4);
  });

  it("rejects ungrounded, overlapping, ambiguous, and authority-expanding inputs", () => {
    const original = mechanism();
    expect(() => mechanism({
      trigger: { ...original.trigger, searchSignals: ["hospitalized"] },
    })).toThrow("trigger signal is not title-grounded");
    expect(() => mechanism({
      dependent: {
        ...original.dependent,
        predicateLabel: original.trigger.predicateLabel,
        searchSignals: original.trigger.searchSignals,
        evidenceBindings: original.trigger.evidenceBindings,
      },
    })).toThrow("roles must bind distinct listings");
    expect(() => mechanism({
      subjectLabel: "Another Person",
      subjectAliases: ["Someone Else"],
    })).toThrow("subject is not grounded");
    expect(() => mechanism({ counterScenarios: [] })).toThrow("bounded contract");

    const { proposalId: _proposalId, ...body } = original;
    const expandedBody = { ...body, probabilityPpm: "900000" };
    expect(() => assertWorldStateMechanismProposal({
      ...expandedBody,
      proposalId: hashCanonical(expandedBody),
    })).toThrow("bounded contract");
  });

  it("rejects tampering with exact evidence and canonical identity", () => {
    const original = mechanism();
    expect(() => assertWorldStateMechanismProposal({
      ...original,
      subjectLabel: "Donald J. Trump",
    })).toThrow("identity is inconsistent");
    const { proposalId: _proposalId, ...body } = original;
    const tamperedTrigger = {
      ...body.trigger,
      evidenceBindings: [{
        ...body.trigger.evidenceBindings[0]!,
        title: "Will an unrelated person be shot during August?",
      }],
    };
    const tamperedBody = { ...body, trigger: tamperedTrigger };
    expect(() => assertWorldStateMechanismProposal({
      ...tamperedBody,
      proposalId: hashCanonical(tamperedBody),
    })).toThrow("subject is not grounded");
  });

  it("persists exact assigned mechanism evidence across SQLite restart", () => {
    const triggerRef = "venue-a:trump-shot-august";
    const dependentRef = "venue-b:trump-cola-september";
    const corpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hash("source:world-state-mechanism"),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: [
        listing(triggerRef, "Will Donald Trump be shot during August?"),
        listing(
          dependentRef,
          "Will Trump personally livestream drinking cola during September?",
        ),
      ],
    });
    const ontology = buildMarketOntologySnapshot(corpus);
    const revisions = materializeOntologySearchIssueRevisions({
      ontology,
      corpus,
      proposals: [],
    });
    const revision = revisions.find((item) => {
      const refs = new Set(item.taskPayload.listingEvidence.map((entry) => entry.listingRef));
      return refs.has(triggerRef) && refs.has(dependentRef);
    });
    expect(revision).toBeDefined();
    const assigned = revision!;
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(
      { PMH_DISCOVERY_PROVIDER: "codex" },
      () => Date.parse(NOW),
    ));
    const route = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "ONTOLOGY_NORMALIZATION"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === route.executionProfileId
    )!;
    const run = buildAgentRun({
      task: assigned.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:world-state-mechanism-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const evidenceByRef = new Map(assigned.taskPayload.listingEvidence
      .map((entry) => [entry.listingRef, entry]));
    const exactBinding = (listingRef: string): WorldStateMechanismEvidenceBinding => {
      const evidence = evidenceByRef.get(listingRef)!;
      return Object.freeze({
        listingRef,
        title: evidence.title,
        nodeId: evidence.node.nodeId,
        worldFacetId: evidence.node.worldFacet.facetId,
        sourceRawHash: evidence.sourceRawHash as Hash,
        protocolIdentity: evidence.protocolIdentity,
      });
    };
    const proposal = mechanism({
      ontologyIdentity: assigned.ontologyIdentity,
      sourceSnapshotIdentity: assigned.sourceSnapshotIdentity,
      sourceIssueRevisionId: assigned.revisionId,
      sourceAgentRunId: run.runId,
      sourceTrailheadIds: [assigned.trailheadIds[0]!],
      sourceRelationPatternIds: [assigned.relationPatternId],
      trigger: {
        ...mechanism().trigger,
        evidenceBindings: [exactBinding(triggerRef)],
      },
      dependent: {
        ...mechanism().dependent,
        evidenceBindings: [exactBinding(dependentRef)],
      },
    });
    const counterexample = buildWorldStateMechanismCounterexample({
      targetRouteFamilyId: worldStateMechanismRouteFamilyIdentity(proposal),
      targetProposalIds: [proposal.proposalId],
      ontologyIdentity: assigned.ontologyIdentity,
      sourceSnapshotIdentity: assigned.sourceSnapshotIdentity,
      sourceIssueRevisionId: assigned.revisionId,
      sourceAgentRunId: run.runId,
      sourceTrailheadIds: [assigned.trailheadIds[0]!],
      sourceRelationPatternIds: [assigned.relationPatternId],
      evidenceBindings: [exactBinding(dependentRef)],
      scenario: "A prerecorded stream could satisfy venue wording without a live appearance.",
      reason: "The proposed physical-capability dependency may not bind prerecorded media.",
      searchSignals: ["livestream"],
      proposedAt: NOW,
    });
    const secondMechanismRun = buildAgentRun({
      task: assigned.task,
      executionProfile: profile,
      runOrdinal: 2,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:world-state-mechanism-test-second-route",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const {
      schemaVersion: _proposalSchema, proposalId: _proposalId,
      authority: _proposalAuthority,
      semanticDecisionAuthority: _semanticAuthority,
      probabilityAuthority: _probabilityAuthority,
      certificateAuthority: _certificateAuthority,
      executionAuthority: _executionAuthority,
      externalWriteAuthority: _externalWriteAuthority,
      valueMovingAuthority: _valueMovingAuthority,
      ...proposalInput
    } = proposal;
    const secondProposal = buildWorldStateMechanismProposal({
      ...proposalInput,
      sourceAgentRunId: secondMechanismRun.runId,
      state: {
        dimension: proposal.state.dimension,
        label: "physically capable of a personal public performance",
      },
    });
    const consolidated = compileConsolidatedWorldStateMechanismRoutes([proposal])[0]!;
    const prototypeCase = materializeWorldStateMechanismPrototypeResearchCases(
      compileConsolidatedWorldStateMechanismRoutes([proposal, secondProposal]),
    )[0]!;
    const prototypeRoute = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "MECHANISM_PROTOTYPE_RESEARCH"
    )!;
    const prototypeProfile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === prototypeRoute.executionProfileId
    )!;
    const prototypeRun = buildAgentRun({
      task: prototypeCase.task,
      executionProfile: prototypeProfile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL", authorizationRef: "operator:prototype-test", authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const prototypeAbstention = buildWorldStateMechanismPrototypeAbstention({
      researchInput: prototypeCase.currentInputRevision,
      sourceAgentRunId: prototypeRun.runId,
      reason: "Two differently worded state labels from one evidence pair do not prove transferability.",
      missingEvidence: ["A route from a distinct market pair"],
      incompatibleDimensions: ["The two routes share the same underlying evidence"],
      counterScenarios: ["The apparent prototype is only a wording variant"],
      proposedAt: NOW,
    });
    const subjectReview = buildWorldStateMechanismSubjectBindingReview({
      route: consolidated,
      decision: "APPROVED",
      approvedLabels: ["Donald Trump", "Trump"],
      rejectedLabels: [],
      rationale: "Both exact title labels refer to the same named individual in this fixture.",
      reviewerRef: "operator:world-state-mechanism-test",
      reviewedAt: NOW,
    });
    const subjectBindingInput = buildWorldStateSubjectBindingResearchInput({
      route: consolidated,
      proposals: [proposal],
    });
    const subjectBindingCase = materializeWorldStateSubjectBindingResearchCases({
      routes: [consolidated], proposals: [proposal], assessments: [], abstentions: [],
      reviews: [],
    })[0]!;
    const subjectBindingRoute = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "SUBJECT_BINDING_RESEARCH"
    )!;
    const subjectBindingProfile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === subjectBindingRoute.executionProfileId
    )!;
    const subjectBindingRun = buildAgentRun({
      task: subjectBindingCase.task,
      executionProfile: subjectBindingProfile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:subject-binding-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const subjectBindingAssessment = buildWorldStateSubjectBindingAssessment({
      researchInput: subjectBindingInput,
      sourceAgentRunId: subjectBindingRun.runId,
      recommendation: "APPROVE",
      supportedLabels: ["donald trump", "trump"],
      rejectedLabels: [],
      evidenceFindings: [{
        role: "CROSS_ROLE",
        listingRefs: [dependentRef, triggerRef].sort(),
        finding: "Both exact fixture titles name the same individual.",
      }],
      counterexamples: ["A namesake could make the surface labels ambiguous."],
      rationale: "The exact fixture evidence supports a shared routing subject.",
      assessedAt: NOW,
    });
    const subjectBindingAbstention = buildWorldStateSubjectBindingAbstention({
      researchInput: subjectBindingInput,
      sourceAgentRunId: subjectBindingRun.runId,
      evidenceFindings: [{
        role: "CROSS_ROLE",
        listingRefs: [dependentRef, triggerRef].sort(),
        finding: "Titles alone do not supply an official identity definition.",
      }],
      missingEvidence: ["Official subject definitions"],
      counterexamples: ["A namesake could make the surface labels ambiguous."],
      rationale: "A stricter review policy could retain an evidence gap.",
      assessedAt: NOW,
    });
    const observation = observeWorldStateMechanismRoutes({
      routes: [consolidated],
      ontology,
      listingTitles: new Map(corpus.listings.map((item) => [item.listingRef, item.title])),
      subjectBindingReviews: [subjectReview],
      priorObservations: [],
      issueRevisions: revisions,
      observedAt: NOW,
    }).observations[0]!;
    const laterCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hash("source:world-state-mechanism:later"),
      eligibleSourceCount: 3,
      excludedSourceCount: 0,
      listings: [
        ...corpus.listings,
        listing(
          "venue-c:trump-appearance-october",
          "Will Donald Trump appear in person at an event during October?",
        ),
      ],
    });
    const laterOntology = buildMarketOntologySnapshot(laterCorpus);
    const laterObservation = observeWorldStateMechanismRoutes({
      routes: [consolidated],
      ontology: laterOntology,
      listingTitles: new Map(laterCorpus.listings
        .map((item) => [item.listingRef, item.title])),
      subjectBindingReviews: [subjectReview],
      priorObservations: [observation],
      issueRevisions: revisions,
      observedAt: AFTER,
    });
    expect(laterObservation.wakes).toHaveLength(1);
    const wake = laterObservation.wakes[0]!;
    const directory = mkdtempSync(join(tmpdir(), "pmh-world-state-mechanism-"));
    const databasePath = join(directory, "operational.sqlite");
    try {
      const store = new SqliteOperationalStore(databasePath);
      store.saveAgentExecutionBatch({
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        workloadRoutes: portfolio.workloadRoutes,
        tasks: [assigned.task, subjectBindingCase.task, prototypeCase.task],
        runs: [run, secondMechanismRun, subjectBindingRun, prototypeRun],
      });
      store.saveOntologySearchIssueRevisions([assigned]);
      expect(store.saveWorldStateMechanismProposals([proposal, secondProposal]))
        .toEqual([proposal, secondProposal]);
      expect(store.saveWorldStateMechanismProposals([proposal])).toEqual([proposal]);
      expect(store.saveWorldStateMechanismPrototypeInputs([
        prototypeCase.currentInputRevision,
      ])).toEqual([prototypeCase.currentInputRevision]);
      expect(store.saveWorldStateMechanismPrototypeAbstentions([prototypeAbstention]))
        .toEqual([prototypeAbstention]);
      expect(store.saveWorldStateMechanismCounterexamples([counterexample]))
        .toEqual([counterexample]);
      expect(store.saveWorldStateMechanismSubjectBindingReviews([subjectReview]))
        .toEqual([subjectReview]);
      expect(store.saveWorldStateSubjectBindingResearchInputs([subjectBindingInput]))
        .toEqual([subjectBindingInput]);
      expect(store.saveWorldStateSubjectBindingResearchInputs([subjectBindingInput]))
        .toEqual([subjectBindingInput]);
      expect(store.saveWorldStateSubjectBindingAssessments([subjectBindingAssessment]))
        .toEqual([subjectBindingAssessment]);
      expect(store.saveWorldStateSubjectBindingAbstentions([subjectBindingAbstention]))
        .toEqual([subjectBindingAbstention]);
      expect(store.saveWorldStateMechanismSubjectBindingReviews([subjectReview]))
        .toEqual([subjectReview]);
      expect(store.saveWorldStateMechanismObservations([
        observation,
        laterObservation.observations[0]!,
      ])).toEqual([observation, laterObservation.observations[0]!]);
      expect(store.saveWorldStateMechanismWakes([wake])).toEqual([wake]);
      expect(store.saveWorldStateMechanismWakes([wake])).toEqual([wake]);
      expect(store.saveWorldStateMechanismCounterexamples([counterexample]))
        .toEqual([counterexample]);
      expect(store.worldStateMechanismProposalStorage).toMatchObject({
        durable: true,
        schemaVersion: 55,
        idempotencyKey: "proposalId",
      });
      expect(store.worldStateSubjectBindingResearchInputStorage).toMatchObject({
        durable: true,
        schemaVersion: 55,
        idempotencyKey: "revisionId",
      });
      store.close();

      const reopened = new SqliteOperationalStore(databasePath);
      expect(reopened.loadWorldStateMechanismProposals(10)
        .map((item) => item.proposalId).sort()).toEqual([
          secondProposal.proposalId, proposal.proposalId,
        ].sort());
      expect(reopened.loadWorldStateMechanismPrototypeInputs(10))
        .toEqual([prototypeCase.currentInputRevision]);
      expect(reopened.loadWorldStateMechanismPrototypeAbstentions(10))
        .toEqual([prototypeAbstention]);
      expect(reopened.loadWorldStateMechanismCounterexamples(10))
        .toEqual([counterexample]);
      expect(reopened.loadWorldStateMechanismSubjectBindingReviews(10))
        .toEqual([subjectReview]);
      expect(reopened.loadWorldStateSubjectBindingResearchInputs(10))
        .toEqual([subjectBindingInput]);
      expect(reopened.loadWorldStateSubjectBindingAssessments(10))
        .toEqual([subjectBindingAssessment]);
      expect(reopened.loadWorldStateSubjectBindingAbstentions(10))
        .toEqual([subjectBindingAbstention]);
      expect(reopened.loadWorldStateMechanismObservations(10)).toEqual([
        laterObservation.observations[0]!,
        observation,
      ]);
      expect(reopened.loadWorldStateMechanismWakes(10)).toEqual([wake]);
      expect(() => reopened.saveWorldStateMechanismProposals([mechanism()]))
        .toThrow("unavailable run");
      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
