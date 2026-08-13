import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildAgentRun,
  buildAgentTask,
  buildDefaultAgentRuntimePortfolio,
  buildModelInvocation,
  buildWorldStateMechanismFamilyScorecards,
  buildWorldStateMechanismProposal,
  compileConsolidatedWorldStateMechanismRoutes,
  defaultAiRuntimeConfiguration,
  emptyAgentExecutionSnapshot,
  type WorldStateSubjectBindingPromotionReadinessItem,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

describe("world-state mechanism family scorecards", () => {
  it("separates exact authoring and assessment cost without double counting shared runs", () => {
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const profile = portfolio.executionProfiles.find((item) =>
      item.profileKey === "subject-binding-codex-app-server"
    )!;
    const model = portfolio.modelProfiles.find((item) =>
      item.modelProfileId === profile.modelProfileId
    )!;
    const authoringTask = buildAgentTask({
      kind: "WORLD_STATE_MECHANISM_RESEARCH", protocol: "fixture-authoring-v1",
      inputArtifacts: [], taskPayload: { fixture: "authoring" },
      requestedEffectProtocol: "fixture-tools-v1", provenanceRef: "fixture:authoring",
      priority: 1, createdAt: NOW,
    });
    const assessmentTask = buildAgentTask({
      kind: "SUBJECT_BINDING_RESEARCH", protocol: "fixture-assessment-v1",
      inputArtifacts: [], taskPayload: { fixture: "assessment" },
      requestedEffectProtocol: "fixture-tools-v1", provenanceRef: "fixture:assessment",
      priority: 1, createdAt: NOW,
    });
    const authoringRun = buildAgentRun({ task: authoringTask, executionProfile: profile,
      runOrdinal: 1, authorization: { kind: "MANUAL", authorizationRef: "fixture:author",
        authorizedAt: NOW }, createdAt: NOW });
    const assessmentRun = buildAgentRun({ task: assessmentTask, executionProfile: profile,
      runOrdinal: 1, authorization: { kind: "MANUAL", authorizationRef: "fixture:assess",
        authorizedAt: NOW }, createdAt: NOW });
    const proposal = buildWorldStateMechanismProposal({
      ontologyIdentity: hashCanonical({ ontology: 1 }),
      sourceSnapshotIdentity: hashCanonical({ snapshot: 1 }),
      sourceIssueRevisionId: hashCanonical({ revision: 1 }),
      sourceAgentRunId: authoringRun.runId,
      sourceTrailheadIds: [hashCanonical({ trailhead: 1 })],
      sourceRelationPatternIds: [hashCanonical({ pattern: 1 })],
      subjectLabel: "Democratic Party", subjectAliases: ["Democratic Party"],
      subjectAmbiguityNotes: ["Party identity is not candidate identity."],
      trigger: { predicateLabel: "wins Iowa Senate seat", searchSignals: ["Iowa"],
        influence: "MAY_ENABLE_STATE", evidenceBindings: [{ listingRef: "a:iowa",
          title: "Democratic Party wins Iowa Senate seat", nodeId: hashCanonical({ n: 1 }),
          worldFacetId: hashCanonical({ f: 1 }), sourceRawHash: hashCanonical({ r: 1 }),
          protocolIdentity: "fixture:a:v1" }] },
      state: { dimension: "OFFICE_HOLDING", label: "party holds Iowa Senate seat" },
      dependent: { predicateLabel: "wins U.S. Senate control", searchSignals: ["Senate"],
        requirement: "STATE_INFLUENCES_LIKELIHOOD", evidenceBindings: [{
          listingRef: "b:senate", title: "Democratic Party wins U.S. Senate control",
          nodeId: hashCanonical({ n: 2 }), worldFacetId: hashCanonical({ f: 2 }),
          sourceRawHash: hashCanonical({ r: 2 }), protocolIdentity: "fixture:b:v1" }] },
      temporalPosture: "TRIGGER_OVERLAPS_DEPENDENT",
      counterScenarios: ["Iowa win and national loss", "Iowa loss and national win"],
      rationale: "The seat can influence but does not determine national control.", proposedAt: NOW,
    });
    const route = compileConsolidatedWorldStateMechanismRoutes([proposal])[0]!;
    const authorInvocation = buildModelInvocation({ run: authoringRun, modelProfile: model,
      ordinal: 1, status: "SUCCEEDED", startedAt: NOW, completedAt: NOW,
      inputTokens: "100", outputTokens: "10", reasoningTokens: "5",
      purpose: "PRIMARY_REASONING" });
    const assessmentInvocation = buildModelInvocation({ run: assessmentRun, modelProfile: model,
      ordinal: 1, status: "SUCCEEDED", startedAt: NOW, completedAt: NOW,
      inputTokens: "40", outputTokens: "4", reasoningTokens: "2",
      purpose: "PRIMARY_REASONING" });
    const readiness = {
      routeFamilyId: route.routeFamilyId, status: "READY_FOR_INDEPENDENT_PROMOTION",
      recommendation: "APPROVE", assessmentIds: [hashCanonical({ assessment: 1 })],
      abstentionIds: [], assessmentUsage: { runIds: [assessmentRun.runId] },
    } as unknown as WorldStateSubjectBindingPromotionReadinessItem;
    const execution = { ...emptyAgentExecutionSnapshot(),
      runtimeDefinitions: portfolio.runtimeDefinitions,
      credentialBindings: portfolio.credentialBindings,
      modelProfiles: portfolio.modelProfiles,
      executionProfiles: portfolio.executionProfiles,
      workloadRoutes: portfolio.workloadRoutes,
      tasks: [authoringTask, assessmentTask], runs: [authoringRun, assessmentRun],
      modelInvocations: [authorInvocation, assessmentInvocation] };
    const scorecard = buildWorldStateMechanismFamilyScorecards({ routes: [route],
      counterexamples: [], promotionReadiness: [readiness], reviews: [], observations: [],
      wakes: [], execution }).items[0]!;
    expect(scorecard).toMatchObject({
      frontier: "READY_FOR_PROMOTION", sharedAuthoringAssessmentRunCount: 0,
      evidence: { proposalCount: 1, counterScenarioCount: 2, assessmentCount: 1,
        assessmentRecommendation: "APPROVE", subjectBindingReviewCount: 0,
        latestObservationStatus: "UNOBSERVED" },
      authoringUsage: { sourceRunCount: 1, modelInvocationCount: 1,
        knownInputTokens: "100" },
      assessmentUsage: { sourceRunCount: 1, modelInvocationCount: 1,
        knownInputTokens: "40" },
      totalUsage: { sourceRunCount: 2, modelInvocationCount: 2,
        knownInputTokens: "140" },
      automaticDispatch: false, attentionPolicyAuthority: false,
    });
  });
});
