import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildWorldStateMechanismProposal,
  buildWorldStateMechanismSubjectBindingReview,
  buildAgentRun,
  buildWorldStateSubjectBindingAbstention,
  buildWorldStateSubjectBindingAssessment,
  buildWorldStateSubjectBindingCampaignPreview,
  buildWorldStateSubjectBindingPromotionReadiness,
  buildDefaultAgentRuntimePortfolio,
  buildModelInvocation,
  compileConsolidatedWorldStateMechanismRoutes,
  materializeWorldStateSubjectBindingResearchCases,
  defaultAiRuntimeConfiguration,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

function proposal(extraCounterScenario?: string) {
  return buildWorldStateMechanismProposal({
    ontologyIdentity: hashCanonical({ ontology: 1 }),
    sourceSnapshotIdentity: hashCanonical({ snapshot: 1 }),
    sourceIssueRevisionId: hashCanonical({ revision: 1 }),
    sourceAgentRunId: hashCanonical({ run: 1 }),
    sourceTrailheadIds: [hashCanonical({ trailhead: 1 })],
    sourceRelationPatternIds: [hashCanonical({ pattern: 1 })],
    subjectLabel: "Democratic Party",
    subjectAliases: ["Democratic Party"],
    subjectAmbiguityNotes: [
      "The state-level nominee and national party organization are distinct objects.",
    ],
    trigger: {
      predicateLabel: "Iowa Senate election winner — Democratic Party",
      searchSignals: ["Iowa", "Democratic Party"],
      influence: "MAY_ENABLE_STATE",
      evidenceBindings: [{
        listingRef: "venue:iowa-dem",
        title: "Iowa Senate election winner — Democratic Party",
        nodeId: hashCanonical({ node: "iowa" }),
        worldFacetId: hashCanonical({ facet: "iowa" }),
        sourceRawHash: hashCanonical({ raw: "iowa" }),
        protocolIdentity: "protocol:venue:v1",
      }],
    },
    state: { dimension: "OFFICE_HOLDING", label: "Democratic Party holds Iowa Senate seat" },
    dependent: {
      predicateLabel: "U.S Senate midterm winner — Democratic Party",
      searchSignals: ["U.S Senate", "Democratic Party"],
      requirement: "STATE_INFLUENCES_LIKELIHOOD",
      evidenceBindings: [{
        listingRef: "venue:national-dem",
        title: "U.S Senate midterm winner — Democratic Party",
        nodeId: hashCanonical({ node: "national" }),
        worldFacetId: hashCanonical({ facet: "national" }),
        sourceRawHash: hashCanonical({ raw: "national" }),
        protocolIdentity: "protocol:venue:v1",
      }],
    },
    temporalPosture: "TRIGGER_OVERLAPS_DEPENDENT",
    counterScenarios: [
      "Democrats win Iowa but fail to control the national chamber.",
      ...(extraCounterScenario === undefined ? [] : [extraCounterScenario]),
    ],
    rationale: "A state seat contributes to but does not determine chamber control.",
    proposedAt: NOW,
  });
}

describe("world-state subject-binding research", () => {
  it("materializes a restart-stable case and rotates only for evidence changes", () => {
    const first = proposal();
    const route = compileConsolidatedWorldStateMechanismRoutes([first])[0]!;
    const a = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [first], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    const replay = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [first], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    expect(replay).toEqual(a);
    expect(a).toMatchObject({
      state: "UNEXPLORED",
      campaignEligible: true,
      task: {
        kind: "SUBJECT_BINDING_RESEARCH",
        protocol: "WORLD_STATE_SUBJECT_BINDING_TASK_V1",
        requestedEffectProtocol: "WORLD_STATE_SUBJECT_BINDING_TOOLS_V1",
      },
    });

    const second = proposal("Democrats control the chamber without the Iowa seat.");
    const changedRoute = compileConsolidatedWorldStateMechanismRoutes([first, second])[0]!;
    const changed = materializeWorldStateSubjectBindingResearchCases({
      routes: [changedRoute], proposals: [first, second], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    expect(changed.caseId).toBe(a.caseId);
    expect(changed.currentInputRevision.revisionId)
      .not.toBe(a.currentInputRevision.revisionId);

    const oldAssessment = buildWorldStateSubjectBindingAssessment({
      researchInput: a.currentInputRevision,
      sourceAgentRunId: hashCanonical({ run: "old-revision-review" }),
      recommendation: "APPROVE", supportedLabels: ["democratic party"], rejectedLabels: [],
      evidenceFindings: [{
        role: "CROSS_ROLE", listingRefs: ["venue:iowa-dem", "venue:national-dem"],
        finding: "The prior exact input used one party label across both roles.",
      }], counterexamples: ["A future proposal may add identity-relevant evidence."],
      rationale: "This assessment is exact-revision bound.", assessedAt: NOW,
    });
    const changedWithOldAssessment = materializeWorldStateSubjectBindingResearchCases({
      routes: [changedRoute], proposals: [first, second], assessments: [oldAssessment],
      abstentions: [], reviews: [],
    })[0]!;
    expect(changedWithOldAssessment).toMatchObject({
      state: "UNEXPLORED", campaignEligible: true, assessmentIds: [],
    });
  });

  it("keeps an Agent assessment separate from promoted review authority", () => {
    const source = proposal();
    const route = compileConsolidatedWorldStateMechanismRoutes([source])[0]!;
    const unexplored = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    const assessment = buildWorldStateSubjectBindingAssessment({
      researchInput: unexplored.currentInputRevision,
      sourceAgentRunId: hashCanonical({ run: "independent-review" }),
      recommendation: "APPROVE",
      supportedLabels: ["democratic party"],
      rejectedLabels: [],
      evidenceFindings: [{
        role: "CROSS_ROLE",
        listingRefs: ["venue:iowa-dem", "venue:national-dem"],
        finding: "Both contracts use the party label as the outcome subject.",
      }],
      counterexamples: [
        "A state nominee is not identical to the national party organization.",
      ],
      rationale: "The route may use the party as a routing subject, subject to independent promotion.",
      assessedAt: NOW,
    });
    const assessed = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [assessment], abstentions: [], reviews: [],
    })[0]!;
    expect(assessed).toMatchObject({
      state: "ASSESSED", campaignEligible: false, promotionAuthority: false,
      assessmentIds: [assessment.assessmentId], reviewIds: [],
    });

    const review = buildWorldStateMechanismSubjectBindingReview({
      route, decision: "APPROVED", approvedLabels: ["democratic party"],
      rejectedLabels: [], rationale: "Independent policy promoted the retained assessment.",
      reviewerRef: `subject-binding-assessment:${assessment.assessmentId}`,
      reviewedAt: NOW,
    });
    const reviewed = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [assessment], abstentions: [],
      reviews: [review],
    })[0]!;
    expect(reviewed).toMatchObject({ state: "REVIEWED", reviewIds: [review.reviewId] });
  });

  it("routes sufficient independent evidence to promotion without granting review authority", () => {
    const source = proposal();
    const route = compileConsolidatedWorldStateMechanismRoutes([source])[0]!;
    const unexplored = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    const assessment = buildWorldStateSubjectBindingAssessment({
      researchInput: unexplored.currentInputRevision,
      sourceAgentRunId: hashCanonical({ run: "independent-promotion-evidence" }),
      recommendation: "APPROVE",
      supportedLabels: ["democratic party"],
      rejectedLabels: [],
      evidenceFindings: [
        { role: "TRIGGER", listingRefs: ["venue:iowa-dem"],
          finding: "The Iowa contract names the party as its outcome subject." },
        { role: "DEPENDENT", listingRefs: ["venue:national-dem"],
          finding: "The national contract names the party as its outcome subject." },
        { role: "CROSS_ROLE", listingRefs: ["venue:iowa-dem", "venue:national-dem"],
          finding: "Both exact roles name the same party subject." },
      ],
      counterexamples: ["The state nominee and national organization remain distinct objects."],
      rationale: "This supports routing-only party identity, not the mechanism relation.",
      assessedAt: NOW,
    });
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const executionProfile = portfolio.executionProfiles.find((item) =>
      item.profileKey === "subject-binding-codex-app-server"
    )!;
    const modelProfile = portfolio.modelProfiles.find((item) =>
      item.modelProfileId === executionProfile.modelProfileId
    )!;
    const assessmentRun = buildAgentRun({
      task: unexplored.task,
      executionProfile,
      runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:readiness-cost-test",
        authorizedAt: NOW },
      createdAt: NOW,
    });
    const invocation = buildModelInvocation({
      run: assessmentRun, modelProfile, ordinal: 1, status: "SUCCEEDED",
      startedAt: NOW, completedAt: NOW, inputTokens: "1200", outputTokens: "80",
      reasoningTokens: "30", purpose: "PRIMARY_REASONING",
    });
    const assessmentWithExactRun = buildWorldStateSubjectBindingAssessment({
      researchInput: unexplored.currentInputRevision,
      sourceAgentRunId: assessmentRun.runId,
      recommendation: assessment.recommendation,
      supportedLabels: assessment.supportedLabels,
      rejectedLabels: assessment.rejectedLabels,
      evidenceFindings: assessment.evidenceFindings,
      counterexamples: assessment.counterexamples,
      rationale: assessment.rationale,
      assessedAt: assessment.assessedAt,
    });
    const exactAssessed = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [assessmentWithExactRun],
      abstentions: [], reviews: [],
    });
    const readiness = buildWorldStateSubjectBindingPromotionReadiness({
      cases: exactAssessed, assessments: [assessmentWithExactRun], abstentions: [], reviews: [],
      execution: {
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        capabilityObservations: [], workloadRoutes: portfolio.workloadRoutes,
        tasks: [unexplored.task], runs: [assessmentRun], modelInvocations: [invocation],
        toolEffects: [], runArtifacts: [],
        runAnnotations: [], campaigns: [], resultSelections: [],
      },
    });

    expect(readiness).toMatchObject({
      readyCount: 1,
      heldCount: 0,
      reviewerPolicyConfigured: false,
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
      automaticPromotion: false,
      promotionAuthority: false,
      items: [{
        status: "READY_FOR_INDEPENDENT_PROMOTION",
        approvingAssessmentId: assessmentWithExactRun.assessmentId,
        recommendation: "APPROVE",
        assessmentUsage: {
          runIds: [assessmentRun.runId], runCount: 1, invocationCount: 1,
          inputTokens: "1200", outputTokens: "80", reasoningTokens: "30",
          unknownUsageInvocationCount: 0,
        },
        checks: {
          exactInputBound: true,
          independentFromAuthoring: true,
          candidateLabelsCovered: true,
          triggerEvidencePresent: true,
          dependentEvidencePresent: true,
          crossRoleEvidencePresent: true,
          counterexamplesPresent: true,
          noConflictingAssessment: true,
          exactReviewAbsent: true,
        },
      }],
    });
  });

  it("holds same-author approval and invalidates reviews after proposal-set change", () => {
    const first = proposal();
    const route = compileConsolidatedWorldStateMechanismRoutes([first])[0]!;
    const unexplored = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [first], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    const sameAuthor = buildWorldStateSubjectBindingAssessment({
      researchInput: unexplored.currentInputRevision,
      sourceAgentRunId: first.sourceAgentRunId,
      recommendation: "APPROVE", supportedLabels: ["democratic party"], rejectedLabels: [],
      evidenceFindings: [
        { role: "TRIGGER", listingRefs: ["venue:iowa-dem"], finding: "Trigger label." },
        { role: "DEPENDENT", listingRefs: ["venue:national-dem"], finding: "Dependent label." },
        { role: "CROSS_ROLE", listingRefs: ["venue:iowa-dem", "venue:national-dem"],
          finding: "Same label." },
      ],
      counterexamples: ["The organizations may differ."],
      rationale: "The author cannot approve its own routing identity.", assessedAt: NOW,
    });
    const current = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [first], assessments: [sameAuthor], abstentions: [], reviews: [],
    });
    expect(buildWorldStateSubjectBindingPromotionReadiness({
      cases: current, assessments: [sameAuthor], abstentions: [], reviews: [],
      execution: {
        runtimeDefinitions: [], credentialBindings: [], modelProfiles: [],
        executionProfiles: [], capabilityObservations: [], workloadRoutes: [],
        tasks: [], runs: [], modelInvocations: [], toolEffects: [], runArtifacts: [],
        runAnnotations: [], campaigns: [], resultSelections: [],
      },
    }).items[0]?.status).toBe("HOLD_NONINDEPENDENT_ASSESSMENT");

    const oldReview = buildWorldStateMechanismSubjectBindingReview({
      route, decision: "APPROVED", approvedLabels: ["democratic party"], rejectedLabels: [],
      rationale: "Review covered the original exact proposal set.",
      reviewerRef: "operator:fixture", reviewedAt: NOW,
    });
    const second = proposal("Democrats may control the chamber through other seats.");
    const changedRoute = compileConsolidatedWorldStateMechanismRoutes([first, second])[0]!;
    const changed = materializeWorldStateSubjectBindingResearchCases({
      routes: [changedRoute], proposals: [first, second], assessments: [], abstentions: [],
      reviews: [oldReview],
    })[0]!;
    expect(changed).toMatchObject({ state: "UNEXPLORED", reviewIds: [] });
  });

  it("retains evidence gaps as terminal negative memory", () => {
    const source = proposal();
    const route = compileConsolidatedWorldStateMechanismRoutes([source])[0]!;
    const unexplored = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    const abstention = buildWorldStateSubjectBindingAbstention({
      researchInput: unexplored.currentInputRevision,
      sourceAgentRunId: hashCanonical({ run: "binding-abstention" }),
      evidenceFindings: [{
        role: "CROSS_ROLE",
        listingRefs: ["venue:iowa-dem", "venue:national-dem"],
        finding: "The titles alone do not define the legal party object used by each venue.",
      }],
      missingEvidence: ["Controlling venue definitions for party-labelled outcomes"],
      counterexamples: ["One contract may resolve from a nominee while another resolves from chamber control."],
      rationale: "Exact titles are insufficient to approve the cross-role identity.",
      assessedAt: NOW,
    });
    const retained = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [], abstentions: [abstention], reviews: [],
    })[0]!;
    expect(retained).toMatchObject({
      state: "ABSTAINED", campaignEligible: false,
      abstentionIds: [abstention.abstentionId], reviewIds: [],
    });
  });

  it("builds a one-case manual campaign with immutable input binding", () => {
    const source = proposal();
    const route = compileConsolidatedWorldStateMechanismRoutes([source])[0]!;
    const cases = materializeWorldStateSubjectBindingResearchCases({
      routes: [route], proposals: [source], assessments: [], abstentions: [], reviews: [],
    });
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const workloadRoute = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "SUBJECT_BINDING_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === workloadRoute.executionProfileId
    )!;
    const preview = buildWorldStateSubjectBindingCampaignPreview({
      cases,
      execution: {
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        workloadRoutes: portfolio.workloadRoutes,
        capabilityObservations: [], campaigns: [], tasks: cases.map((item) => item.task),
        runs: [], modelInvocations: [], toolEffects: [], runArtifacts: [],
        runAnnotations: [], resultSelections: [],
      },
      capability: {
        schemaVersion: "pmh.execution-capability.v1",
        executionProfileId: profile.executionProfileId,
        runtimeKind: "CODEX", credentialKind: "CODEX_OAUTH",
        accessDriver: "CODEX_RESPONSES", model: "gpt-5.6-terra",
        configured: true, credentialPresent: true, dispatchEligibility: "ELIGIBLE",
        diagnostic: "ready", observedAt: NOW,
        authority: "EXECUTION_CAPABILITY_ONLY", secretMaterialRetained: false,
        externalWriteAuthority: false, valueMovingAuthority: false,
      },
    });
    expect(preview).toMatchObject({
      taskIds: [cases[0]!.task.taskId], caseIds: [cases[0]!.caseId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 6,
        maximumInputTokens: "100000" },
      creationEligible: true, dispatchEligible: true,
      automaticDispatch: false, promotionAuthority: false,
      providerRequestsStarted: 0, modelInvocationsStarted: 0,
    });
    expect(preview.selectionBinding.taskBindings[0]).toMatchObject({
      inputRevisionKind: "WORLD_STATE_SUBJECT_BINDING_INPUT",
      inputRevisionId: cases[0]!.currentInputRevision.revisionId,
      exactInputHash: hashCanonical(cases[0]!.currentInputRevision),
    });
  });
});
