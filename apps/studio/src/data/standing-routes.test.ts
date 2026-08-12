import { describe, expect, it } from "vitest";
import { parseStandingRouteDesk } from "./standing-routes";

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
