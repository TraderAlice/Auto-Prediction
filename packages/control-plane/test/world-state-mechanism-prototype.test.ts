import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildWorldStateMechanismProposal,
  compileConsolidatedWorldStateMechanismRoutes,
  type WorldStateMechanismProposal,
} from "../src/world-state-mechanism.js";
import {
  assertWorldStateMechanismPrototypeProposal,
  buildWorldStateMechanismPrototypeAbstention,
  buildWorldStateMechanismPrototypeProposal,
  materializeWorldStateMechanismPrototypeResearchCases,
  worldStateMechanismPrototypeCandidateUsage,
} from "../src/world-state-mechanism-prototype.js";
import { buildWorldStateMechanismPrototypeCampaignPreview } from
  "../src/world-state-mechanism-prototype-campaign.js";
import { buildAgentRun, buildModelInvocation } from
  "../src/agent-execution-substrate.js";
import { buildDefaultAgentRuntimePortfolio } from "../src/agent-runtime-portfolio.js";
import { defaultAiRuntimeConfiguration } from "../src/ai-runtime-configuration.js";

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
      campaignEligible: true,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
    });
    expect(cases[0]!.currentInputRevision.memberRouteFamilyIds).toHaveLength(2);
    expect(cases[0]!.currentInputRevision.sourceAuthoringRunIds).toHaveLength(2);
    expect(cases[0]!.task.kind).toBe("MECHANISM_PROTOTYPE_RESEARCH");
  });

  it("retains a grounded parameterized proposal and closes only its exact input", () => {
    const researchCase = materializeWorldStateMechanismPrototypeResearchCases(
      compileConsolidatedWorldStateMechanismRoutes([
        proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
        proposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
      ]),
    )[0]!;
    const values = researchCase.currentInputRevision.memberRoutes.map((route) => ({
      routeFamilyId: route.routeFamilyId,
      value: route.canonicalRoute.canonicalSubjectLabels[0]!,
    }));
    const prototype = buildWorldStateMechanismPrototypeProposal({
      researchInput: researchCase.currentInputRevision,
      sourceAgentRunId: hash("prototype-run"),
      label: "Component outcome contributes to aggregate control",
      invariantDescription: "A component election changes one office-holding state that influences an aggregate control market.",
      variableSlots: [{
        name: "party",
        role: "SUBJECT",
        description: "The political party whose component and aggregate outcomes are compared.",
        values,
      }],
      searchSignals: ["component election", "aggregate control"],
      transferTests: ["Both markets resolve over the same aggregate membership count."],
      counterScenarios: ["Other component outcomes overwhelm this component result."],
      rationale: "The two concrete routes share a typed causal mechanism while preserving distinct subjects and states.",
      proposedAt: NOW,
    });
    expect(assertWorldStateMechanismPrototypeProposal(prototype)).toEqual(prototype);
    const closed = materializeWorldStateMechanismPrototypeResearchCases(
      researchCase.currentInputRevision.memberRoutes, [prototype], [],
    )[0]!;
    expect(closed).toMatchObject({
      state: "PROPOSED", campaignEligible: false, proposalIds: [prototype.prototypeId],
    });
  });

  it("rejects invented variable values and retains explicit negative memory", () => {
    const researchCase = materializeWorldStateMechanismPrototypeResearchCases(
      compileConsolidatedWorldStateMechanismRoutes([
        proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
        proposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
      ]),
    )[0]!;
    expect(() => buildWorldStateMechanismPrototypeProposal({
      researchInput: researchCase.currentInputRevision,
      sourceAgentRunId: hash("prototype-run"), label: "Invented abstraction",
      invariantDescription: "An invalid abstraction with values absent from evidence.",
      variableSlots: [{
        name: "party", role: "SUBJECT", description: "Invented values.",
        values: researchCase.currentInputRevision.memberRouteFamilyIds.map(
          (routeFamilyId, index) => ({ routeFamilyId, value: `Invented ${index}` }),
        ),
      }],
      searchSignals: ["invented"], transferTests: ["invented test"],
      counterScenarios: ["invented counter"], rationale: "Should fail grounding.",
      proposedAt: NOW,
    })).toThrow(/not grounded/u);
    const abstention = buildWorldStateMechanismPrototypeAbstention({
      researchInput: researchCase.currentInputRevision,
      sourceAgentRunId: hash("abstention-run"),
      reason: "Typed similarity does not yet prove one transferable semantic mechanism.",
      missingEvidence: ["A third independent route family"],
      incompatibleDimensions: ["The aggregate resolution units may differ"],
      counterScenarios: ["The apparent similarity is specific to party control markets"],
      proposedAt: NOW,
    });
    expect(materializeWorldStateMechanismPrototypeResearchCases(
      researchCase.currentInputRevision.memberRoutes, [], [abstention],
    )[0]).toMatchObject({
      state: "ABSTAINED", campaignEligible: false,
      abstentionIds: [abstention.abstentionId],
    });
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

  it("builds one paused exact-input campaign proposal without dispatch", () => {
    const cases = materializeWorldStateMechanismPrototypeResearchCases(
      compileConsolidatedWorldStateMechanismRoutes([
        proposal({ party: "Democratic Party", state: "Iowa", run: "iowa" }),
        proposal({ party: "Republican Party", state: "Alaska", run: "alaska" }),
      ]),
    );
    const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
    const workloadRoute = portfolio.workloadRoutes.find((item) =>
      item.taskKind === "MECHANISM_PROTOTYPE_RESEARCH"
    )!;
    const profile = portfolio.executionProfiles.find((item) =>
      item.executionProfileId === workloadRoute.executionProfileId
    )!;
    const preview = buildWorldStateMechanismPrototypeCampaignPreview({
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
      taskIds: [cases[0]!.task.taskId], candidateIds: [cases[0]!.candidateId],
      schedule: { kind: "MANUAL_ONLY", intervalMs: null },
      taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE",
      budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 8,
        maximumInputTokens: "200000" },
      creationEligible: true, dispatchEligible: true,
      automaticDispatch: false, semanticDecisionAuthority: false,
      providerRequestsStarted: 0, modelInvocationsStarted: 0,
    });
    expect(preview.selectionBinding.taskBindings[0]).toMatchObject({
      inputRevisionKind: "WORLD_STATE_MECHANISM_PROTOTYPE_INPUT",
      inputRevisionId: cases[0]!.currentInputRevision.revisionId,
      exactInputHash: hashCanonical(cases[0]!.currentInputRevision),
    });
  });
});
