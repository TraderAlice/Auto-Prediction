import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildWorldStateMechanismProposal,
  buildWorldStateMechanismSubjectBindingReview,
  buildWorldStateSubjectBindingAbstention,
  buildWorldStateSubjectBindingAssessment,
  compileConsolidatedWorldStateMechanismRoutes,
  materializeWorldStateSubjectBindingResearchCases,
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
    expect(a).toMatchObject({ state: "UNEXPLORED", campaignEligible: true, task: null });

    const second = proposal("Democrats control the chamber without the Iowa seat.");
    const changedRoute = compileConsolidatedWorldStateMechanismRoutes([first, second])[0]!;
    const changed = materializeWorldStateSubjectBindingResearchCases({
      routes: [changedRoute], proposals: [first, second], assessments: [], abstentions: [], reviews: [],
    })[0]!;
    expect(changed.caseId).toBe(a.caseId);
    expect(changed.currentInputRevision.revisionId)
      .not.toBe(a.currentInputRevision.revisionId);
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
});
