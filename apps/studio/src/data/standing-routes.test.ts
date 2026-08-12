import { describe, expect, it } from "vitest";
import {
  parseStandingRouteDesk,
  parseStandingRouteWorkspace,
} from "./standing-routes";

const usage = Object.freeze({
  runCount: 1,
  invocationCount: 2,
  knownInputTokens: "100",
  knownOutputTokens: "20",
  knownReasoningTokens: "5",
  unknownInputInvocationCount: 0,
  unknownOutputInvocationCount: 0,
  unknownReasoningInvocationCount: 0,
});

function fixture() {
  const familyId = `sha256:${"1".repeat(64)}`;
  return {
    schemaVersion: "pmh.standing-ontology-route-projection.v1",
    projectionIdentity: `sha256:${"2".repeat(64)}`,
    currentCorpusSnapshotIdentity: `sha256:${"3".repeat(64)}`,
    routeCount: 1,
    familyCount: 1,
    corroboratedFamilyCount: 0,
    baselineDisagreementFamilyCount: 0,
    followupEligibleFamilyCount: 0,
    followupCount: 0,
    observationEpisodeCount: 1,
    families: [{
      family: {
        routeFamilyId: familyId,
        routeLayer: "SUBJECT_REFERENCE",
        canonicalSearchSignals: ["Lula"],
        searchFields: ["title"],
        sourceRouteIds: [],
        sourceFindingIds: [],
        authoringRunIds: [],
        sourceCount: 1,
        nativeSourceCount: 0,
        legacySourceCount: 1,
        baselineDisagreement: false,
        firstRecordedAt: "2026-08-12T10:00:00.000Z",
        lastRecordedAt: "2026-08-12T10:00:00.000Z",
      },
      observation: {
        observationId: `sha256:${"4".repeat(64)}`,
        state: "QUIESCENT",
        currentListingRefs: ["gemini:lula"],
        addedListingRefs: [],
        removedListingRefs: [],
        changedListingRefs: [],
        followupEligible: false,
      },
    }],
    observationEpisodes: [{
      episodeId: `sha256:${"5".repeat(64)}`,
      routeFamilyId: familyId,
      previousEpisodeId: null,
      observedAt: "2026-08-12T10:00:00.000Z",
      state: "QUIESCENT",
      currentListingRefs: ["gemini:lula"],
      addedListingRefs: [],
      removedListingRefs: [],
      changedListingRefs: [],
      followupEligible: false,
    }],
    value: {
      schemaVersion: "pmh.standing-ontology-route-value-projection.v2",
      observedAt: "2026-08-12T11:00:00.000Z",
      familyCount: 1,
      totalCreationUsage: usage,
      totalFollowupUsage: { ...usage, runCount: 0, invocationCount: 0 },
      values: [{
        valueId: `sha256:${"6".repeat(64)}`,
        routeFamilyId: familyId,
        currentState: "QUIESCENT",
        quietDurationMs: "3600000",
        totalQuietDurationMs: "3600000",
        firstObservedAt: "2026-08-12T10:00:00.000Z",
        lastTransitionAt: "2026-08-12T10:00:00.000Z",
        observationEpisodeCount: 1,
        sourceCount: 1,
        observedWakeCount: 0,
        creationUsage: usage,
        followupUsage: { ...usage, runCount: 0, invocationCount: 0 },
        followupWorkItemIds: [],
        followupRunIds: [],
        positiveFindingIds: [],
        counterexampleIds: [],
        semanticProposalIds: [],
        semanticReviewJobIds: [],
        semanticReviewPassCount: 0,
        probabilityJobIds: [],
        opportunityIds: [],
        valueStage: "QUIET_MEMORY",
      }],
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      automaticDispatch: false,
      authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY",
      causalClaim: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    },
    selection: {
      schemaVersion: "pmh.standing-route-family-selection-projection.v1",
      familyCount: 1,
      adoptCount: 0,
      holdCount: 1,
      retireCount: 0,
      quietReviewHorizonMs: "604800000",
      unproductiveWakeMinimum: 3,
      selections: [{
        selectionId: "sha256:selection",
        routeFamilyId: "sha256:family",
        recommendation: "HOLD",
        reason: "HOLD_AWAITING_FIRST_WAKE",
        rationale: "No wake yet.",
        missingObservation: "A first wake.",
        nextReviewTrigger: "First wake or seven days.",
        seedConflictCount: 0,
        cleanSeedCount: 0,
        observedWakeCount: 0,
        attemptedFollowupRunCount: 0,
      }],
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
      writesStartedByRead: 0,
      automaticMutation: false,
      automaticDispatch: false,
      authority: "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY",
    },
    providerRequestsStartedByRead: 0,
    modelInvocationsStartedByRead: 0,
    campaignsCreatedByRead: 0,
    runsCreatedByRead: 0,
    automaticDispatch: false,
    authority: "SEARCH_ROUTING_ONLY",
    semanticDecisionAuthority: false,
    probabilityAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  };
}

describe("standing route desk contract", () => {
  it("accepts a bounded lifecycle projection", () => {
    expect(parseStandingRouteDesk(fixture())).toMatchObject({
      familyCount: 1,
      observationEpisodeCount: 1,
      value: { familyCount: 1 },
    });
  });

  it("rejects read-side Agent activity", () => {
    expect(() => parseStandingRouteDesk({
      ...fixture(),
      modelInvocationsStartedByRead: 1,
    })).toThrow("bounded read contract");
  });
});

function seedOutcomes() {
  return {
    schemaVersion: "pmh.standing-route-seed-outcome-projection.v1",
    projectionIdentity: `sha256:${"7".repeat(64)}`,
    observedAt: "2026-08-13T10:00:00.000Z",
    campaignCount: 0,
    selectedActionCount: 0,
    actedActionCount: 0,
    terminalActionCount: 0,
    routeRetainedActionCount: 0,
    usefulNegativeMemoryActionCount: 0,
    conflictingTerminalEffectActionCount: 0,
    strata: [],
    recurrenceQualification: {
      representedLayerCount: 0,
      qualifiedLayerCount: 0,
      minimumTerminalActionsPerLayer: 3,
      yieldCostEvidenceSufficient: false,
      operatorActivationStillRequired: true,
    },
    providerRequestsStartedByRead: 0,
    modelInvocationsStartedByRead: 0,
    campaignsCreatedByRead: 0,
    runsCreatedByRead: 0,
    writesStartedByRead: 0,
    automaticDispatch: false,
    authority: "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY",
  };
}

function workspace() {
  const desk = fixture();
  const outcomes = seedOutcomes();
  return {
    schemaVersion: "pmh.standing-route-workspace.v1",
    workspaceIdentity: `sha256:${"8".repeat(64)}`,
    sourceProjectionRevision: "14",
    routeProjectionIdentity: desk.projectionIdentity,
    seedOutcomeProjectionIdentity: outcomes.projectionIdentity,
    seedPreviewIdentity: null,
    materializedAt: "2026-08-13T10:00:00.000Z",
    desk,
    seedPortfolio: {
      preview: { status: "UNAVAILABLE", diagnostic: "no relation route" },
      outcomes,
    },
    providerRequestsStartedByRead: 0,
    modelInvocationsStartedByRead: 0,
    campaignsCreatedByRead: 0,
    runsCreatedByRead: 0,
    writesStartedByRead: 0,
    automaticDispatch: false,
    authority: "DERIVED_ROUTE_WORKSPACE_ONLY",
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  };
}

describe("standing route workspace contract", () => {
  it("keeps an unavailable seed preview local to the seed desk", () => {
    expect(parseStandingRouteWorkspace(workspace())).toMatchObject({
      desk: { familyCount: 1 },
      seedPortfolio: { preview: { status: "UNAVAILABLE" } },
    });
  });

  it("rejects mismatched child projection lineage", () => {
    expect(() => parseStandingRouteWorkspace({
      ...workspace(),
      seedOutcomeProjectionIdentity: `sha256:${"9".repeat(64)}`,
    })).toThrow("projection identity lineage");
  });

  it("rejects read-side writes", () => {
    expect(() => parseStandingRouteWorkspace({
      ...workspace(),
      writesStartedByRead: 1,
    })).toThrow("bounded read contract");
  });
});
