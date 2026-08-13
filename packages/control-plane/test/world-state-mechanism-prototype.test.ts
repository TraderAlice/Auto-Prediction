import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildWorldStateMechanismProposal,
  compileConsolidatedWorldStateMechanismRoutes,
  type WorldStateMechanismProposal,
} from "../src/world-state-mechanism.js";
import {
  materializeWorldStateMechanismPrototypeResearchCases,
  worldStateMechanismPrototypeCandidateUsage,
} from "../src/world-state-mechanism-prototype.js";
import { buildAgentRun, buildModelInvocation } from
  "../src/agent-execution-substrate.js";
import { buildDefaultAgentRuntimePortfolio } from "../src/agent-runtime-portfolio.js";

const NOW = "2026-08-13T10:28:18.396Z";
const hash = (value: string): Hash => hashCanonical({ value });

function proposal(input: Readonly<{
  party: string;
  state: string;
  run: string;
  influence?: WorldStateMechanismProposal["trigger"]["influence"];
}>): WorldStateMechanismProposal {
  const triggerTitle = `${input.state} Senate Election Winner — ${input.party}`;
  const dependentTitle = `U.S Senate Midterm Winner — ${input.party}`;
  const binding = (role: string, title: string) => Object.freeze({
    listingRef: `venue:${input.party}:${input.state}:${role}`.toLowerCase().replaceAll(" ", "-"),
    title,
    nodeId: hash(`node:${input.party}:${input.state}:${role}`),
    worldFacetId: hash(`facet:${input.party}:${input.state}:${role}`),
    sourceRawHash: hash(`raw:${input.party}:${input.state}`),
    protocolIdentity: "fixture-v1",
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
      influence: input.influence ?? "MAY_ENABLE_STATE",
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

describe("world-state mechanism prototype candidate substrate", () => {
  it("groups independent typed-compatible routes without merging concrete families", () => {
    const routes = compileConsolidatedWorldStateMechanismRoutes([
      proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
      proposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
    ]);
    const cases = materializeWorldStateMechanismPrototypeResearchCases(routes);
    expect(routes).toHaveLength(2);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      state: "UNEXPLORED",
      campaignEligible: false,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
    });
    expect(cases[0]!.currentInputRevision.memberRouteFamilyIds).toHaveLength(2);
    expect(cases[0]!.currentInputRevision.sourceAuthoringRunIds).toHaveLength(2);
    expect(cases[0]!.task.kind).toBe("MECHANISM_PROTOTYPE_RESEARCH");
  });

  it("does not create a candidate from one family or one authoring run", () => {
    const one = proposal({ party: "Democratic Party", state: "Iowa", run: "same" });
    expect(materializeWorldStateMechanismPrototypeResearchCases(
      compileConsolidatedWorldStateMechanismRoutes([one]),
    )).toEqual([]);
    const routes = compileConsolidatedWorldStateMechanismRoutes([
      one,
      proposal({ party: "Republican Party", state: "Alaska", run: "same" }),
    ]);
    expect(materializeWorldStateMechanismPrototypeResearchCases(routes)).toEqual([]);
  });

  it("keeps incompatible typed postures in separate comparison candidates", () => {
    const routes = compileConsolidatedWorldStateMechanismRoutes([
      proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
      proposal({
        party: "Republican Party", state: "Alaska", run: "alaska",
        influence: "MAY_TERMINATE_STATE",
      }),
    ]);
    expect(materializeWorldStateMechanismPrototypeResearchCases(routes)).toEqual([]);
  });

  it("is invariant to route input order", () => {
    const routes = compileConsolidatedWorldStateMechanismRoutes([
      proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
      proposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
    ]);
    const forward = materializeWorldStateMechanismPrototypeResearchCases(routes)[0]!;
    const reverse = materializeWorldStateMechanismPrototypeResearchCases(
      [...routes].reverse(),
    )[0]!;
    expect(reverse).toEqual(forward);
  });

  it("attributes exact retained authoring usage without inventing missing tokens", () => {
    const proposals = [
      proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
      proposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
    ];
    const researchCase = materializeWorldStateMechanismPrototypeResearchCases(
      compileConsolidatedWorldStateMechanismRoutes(proposals),
    )[0]!;
    const portfolio = buildDefaultAgentRuntimePortfolio({
      schemaVersion: "pmh.ai-runtime-configuration.v1",
      revision: 1,
      provider: "CODEX",
      runtime: "CODEX",
      credential: "CODEX_OAUTH",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      timeoutMs: 300000,
      updatedAt: NOW,
    });
    const profile = portfolio.executionProfiles.find((item) =>
      item.profileKey === "world-state-mechanism-codex-app-server"
    )!;
    const task = researchCase.task;
    const run = buildAgentRun({
      task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "fixture", authorizedAt: NOW },
      createdAt: NOW,
    });
    // Candidate source runs intentionally differ from this prototype task run;
    // only exact sourceAuthoringRunIds may contribute cost.
    const invocation = buildModelInvocation({
      run,
      modelProfile: portfolio.modelProfiles.find((item) =>
        item.modelProfileId === profile.modelProfileId
      )!,
      ordinal: 1,
      purpose: "PRIMARY_REASONING",
      startedAt: NOW,
      completedAt: NOW,
      status: "SUCCEEDED",
      inputTokens: "99",
      outputTokens: "7",
      reasoningTokens: "3",
      failureCategory: null,
      diagnostic: null,
    });
    expect(worldStateMechanismPrototypeCandidateUsage({
      researchCase,
      execution: {
        schemaVersion: "pmh.agent-execution-snapshot.v1",
        runtimeDefinitions: portfolio.runtimeDefinitions,
        credentialBindings: portfolio.credentialBindings,
        modelProfiles: portfolio.modelProfiles,
        executionProfiles: portfolio.executionProfiles,
        workloadRoutes: portfolio.workloadRoutes,
        tasks: [task], campaigns: [], runs: [run], modelInvocations: [invocation],
        toolEffects: [], runArtifacts: [], resultSelections: [], runAnnotations: [],
        capabilityObservations: [],
      },
    })).toMatchObject({
      retainedSourceRunCount: 0,
      missingSourceRunCount: 2,
      modelInvocationCount: 0,
      knownInputTokens: "0",
    });
  });
});
