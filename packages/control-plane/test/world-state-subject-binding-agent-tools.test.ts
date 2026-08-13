import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildAgentRun,
  buildDefaultAgentRuntimePortfolio,
  buildWorldStateMechanismProposal,
  compileConsolidatedWorldStateMechanismRoutes,
  defaultAiRuntimeConfiguration,
  materializeWorldStateSubjectBindingResearchCases,
  WorldStateSubjectBindingAgentToolHost,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

function fixture() {
  const proposal = buildWorldStateMechanismProposal({
    ontologyIdentity: hashCanonical({ ontology: 1 }),
    sourceSnapshotIdentity: hashCanonical({ snapshot: 1 }),
    sourceIssueRevisionId: hashCanonical({ revision: 1 }),
    sourceAgentRunId: hashCanonical({ authoringRun: 1 }),
    sourceTrailheadIds: [hashCanonical({ trailhead: 1 })],
    sourceRelationPatternIds: [hashCanonical({ pattern: 1 })],
    subjectLabel: "Democratic Party", subjectAliases: ["Democratic Party"],
    subjectAmbiguityNotes: ["State candidate and national party are distinct objects."],
    trigger: {
      predicateLabel: "Iowa Senate election winner — Democratic Party",
      searchSignals: ["Iowa", "Democratic Party"], influence: "MAY_ENABLE_STATE",
      evidenceBindings: [{
        listingRef: "venue:iowa", title: "Iowa Senate election winner — Democratic Party",
        nodeId: hashCanonical({ node: 1 }), worldFacetId: hashCanonical({ facet: 1 }),
        sourceRawHash: hashCanonical({ raw: 1 }), protocolIdentity: "protocol:venue:v1",
      }],
    },
    state: { dimension: "OFFICE_HOLDING", label: "Democrats hold the Iowa seat" },
    dependent: {
      predicateLabel: "U.S Senate midterm winner — Democratic Party",
      searchSignals: ["U.S Senate", "Democratic Party"],
      requirement: "STATE_INFLUENCES_LIKELIHOOD",
      evidenceBindings: [{
        listingRef: "venue:national", title: "U.S Senate midterm winner — Democratic Party",
        nodeId: hashCanonical({ node: 2 }), worldFacetId: hashCanonical({ facet: 2 }),
        sourceRawHash: hashCanonical({ raw: 2 }), protocolIdentity: "protocol:venue:v1",
      }],
    },
    temporalPosture: "TRIGGER_OVERLAPS_DEPENDENT",
    counterScenarios: ["Democrats win Iowa but fail to control the national chamber."],
    rationale: "A state seat contributes to but does not determine chamber control.",
    proposedAt: NOW,
  });
  const route = compileConsolidatedWorldStateMechanismRoutes([proposal])[0]!;
  const researchCase = materializeWorldStateSubjectBindingResearchCases({
    routes: [route], proposals: [proposal], assessments: [], abstentions: [], reviews: [],
  })[0]!;
  const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
  const workloadRoute = portfolio.workloadRoutes.find((item) =>
    item.taskKind === "SUBJECT_BINDING_RESEARCH"
  )!;
  const profile = portfolio.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  )!;
  const run = buildAgentRun({
    task: researchCase.task, executionProfile: profile, runOrdinal: 1,
    authorization: { kind: "MANUAL", authorizationRef: "operator:test", authorizedAt: NOW },
    createdAt: NOW,
  });
  const saved: unknown[] = [];
  const store = {
    worldStateSubjectBindingResearchInputStorage: {
      mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "revisionId",
    },
    worldStateSubjectBindingAssessmentStorage: {
      mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "assessmentId",
    },
    worldStateSubjectBindingAbstentionStorage: {
      mode: "MEMORY", durable: false, schemaVersion: 1, idempotencyKey: "abstentionId",
    },
    loadWorldStateSubjectBindingResearchInputs: () => [researchCase.currentInputRevision],
    saveWorldStateSubjectBindingResearchInputs: (values: unknown[]) => values,
    loadWorldStateSubjectBindingAssessments: () => [],
    saveWorldStateSubjectBindingAssessments: (values: unknown[]) => { saved.push(...values); return values; },
    loadWorldStateSubjectBindingAbstentions: () => [],
    saveWorldStateSubjectBindingAbstentions: (values: unknown[]) => { saved.push(...values); return values; },
  } as never;
  const host = new WorldStateSubjectBindingAgentToolHost(
    researchCase.currentInputRevision, store,
  );
  return { researchCase, profile, run, host, saved };
}

describe("world-state subject-binding Agent tools", () => {
  it("exposes exact evidence and only terminal result tools", async () => {
    const work = fixture();
    expect(work.host.resultToolNames("WORLD_STATE_SUBJECT_BINDING_TOOLS_V1")).toEqual([
      "submit_subject_binding_assessment", "record_subject_binding_abstention",
    ]);
    const result = await work.host.execute({
      run: work.run, task: work.researchCase.task, executionProfile: work.profile,
      callId: "read:1", toolName: "read_subject_binding_case", input: {},
    });
    expect(result).toMatchObject({
      status: "ACCEPTED",
      output: { authority: "SUBJECT_BINDING_RESEARCH_INPUT_ONLY" },
    });
    expect(work.saved).toHaveLength(0);
  });

  it("retains an assessment without promotion authority", async () => {
    const work = fixture();
    const result = await work.host.execute({
      run: work.run, task: work.researchCase.task, executionProfile: work.profile,
      callId: "assessment:1", toolName: "submit_subject_binding_assessment",
      input: {
        recommendation: "APPROVE", supportedLabels: ["democratic party"],
        rejectedLabels: [], evidenceFindings: [{
          role: "CROSS_ROLE", listingRefs: ["venue:iowa", "venue:national"],
          finding: "Both contracts use the party-labelled outcome as the route subject.",
        }], counterexamples: ["State candidate and national party organization differ."],
        rationale: "The bounded route can use the party identity only after separate promotion.",
      },
    });
    expect(result).toMatchObject({
      status: "ACCEPTED",
      output: {
        authority: "SUBJECT_BINDING_ASSESSMENT_EVIDENCE_ONLY",
        independentPromotionRequired: true,
      },
    });
    expect(work.saved).toHaveLength(1);
    expect(work.saved[0]).toMatchObject({
      sourceAgentRunId: work.run.runId,
      semanticRelationAuthority: false,
      probabilityAuthority: false,
      executionAuthority: false,
    });
  });

  it("rejects findings outside the exact input evidence", async () => {
    const work = fixture();
    await expect(work.host.execute({
      run: work.run, task: work.researchCase.task, executionProfile: work.profile,
      callId: "assessment:outside", toolName: "submit_subject_binding_assessment",
      input: {
        recommendation: "APPROVE", supportedLabels: ["democratic party"],
        rejectedLabels: [], evidenceFindings: [{
          role: "CROSS_ROLE", listingRefs: ["venue:outside"],
          finding: "Out of scope on purpose.",
        }], counterexamples: ["A namesake exists."], rationale: "Exercise rejection.",
      },
    })).rejects.toThrow("outside exact input evidence");
    expect(work.saved).toHaveLength(0);
  });
});
