import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildAgentRun,
  buildDefaultAgentRuntimePortfolio,
  buildWorldStateMechanismProposal,
  compileConsolidatedWorldStateMechanismRoutes,
  defaultAiRuntimeConfiguration,
  materializeWorldStateMechanismPrototypeResearchCases,
  WorldStateMechanismPrototypeAgentToolHost,
} from "../src/index.js";

const NOW = "2026-08-13T12:00:00.000Z";

function fixture() {
  const proposal = (party: string, place: string, ordinal: number) =>
    buildWorldStateMechanismProposal({
      ontologyIdentity: hashCanonical({ ontology: ordinal }),
      sourceSnapshotIdentity: hashCanonical({ snapshot: ordinal }),
      sourceIssueRevisionId: hashCanonical({ revision: ordinal }),
      sourceAgentRunId: hashCanonical({ authoringRun: ordinal }),
      sourceTrailheadIds: [hashCanonical({ trailhead: ordinal })],
      sourceRelationPatternIds: [hashCanonical({ pattern: ordinal })],
      subjectLabel: party, subjectAliases: [party], subjectAmbiguityNotes: [],
      trigger: {
        predicateLabel: `${place} Senate winner — ${party}`,
        searchSignals: [place, party], influence: "MAY_ENABLE_STATE",
        evidenceBindings: [{
          listingRef: `venue:${place}:trigger`, title: `${place} Senate winner — ${party}`,
          nodeId: hashCanonical({ node: ordinal, role: 1 }),
          worldFacetId: hashCanonical({ facet: ordinal, role: 1 }),
          sourceRawHash: hashCanonical({ raw: ordinal, role: 1 }),
          protocolIdentity: "protocol:fixture:v1",
        }],
      },
      state: { dimension: "OFFICE_HOLDING", label: `${party} holds ${place}` },
      dependent: {
        predicateLabel: `U.S. Senate control — ${party}`,
        searchSignals: ["U.S. Senate", party],
        requirement: "STATE_INFLUENCES_LIKELIHOOD",
        evidenceBindings: [{
          listingRef: `venue:${place}:dependent`,
          title: `U.S. Senate control — ${party}`,
          nodeId: hashCanonical({ node: ordinal, role: 2 }),
          worldFacetId: hashCanonical({ facet: ordinal, role: 2 }),
          sourceRawHash: hashCanonical({ raw: ordinal, role: 2 }),
          protocolIdentity: "protocol:fixture:v1",
        }],
      },
      temporalPosture: "TRIGGER_OVERLAPS_DEPENDENT",
      counterScenarios: ["Other seats determine control."],
      rationale: "One component result influences the aggregate state.", proposedAt: NOW,
    });
  const concreteProposals = [
    proposal("Democratic Party", "Iowa", 1),
    proposal("Republican Party", "Alaska", 2),
  ];
  const researchCase = materializeWorldStateMechanismPrototypeResearchCases(
    compileConsolidatedWorldStateMechanismRoutes(concreteProposals),
  )[0]!;
  const portfolio = buildDefaultAgentRuntimePortfolio(defaultAiRuntimeConfiguration(NOW));
  const route = portfolio.workloadRoutes.find((item) =>
    item.taskKind === "MECHANISM_PROTOTYPE_RESEARCH"
  )!;
  const profile = portfolio.executionProfiles.find((item) =>
    item.executionProfileId === route.executionProfileId
  )!;
  const run = buildAgentRun({
    task: researchCase.task, executionProfile: profile, runOrdinal: 1,
    authorization: { kind: "MANUAL", authorizationRef: "operator:test", authorizedAt: NOW },
    createdAt: NOW,
  });
  return { researchCase, profile, run };
}

describe("world-state mechanism prototype Agent tools", () => {
  it("exposes exact route enums and accepts a grounded proposal", async () => {
    const { researchCase, profile, run } = fixture();
    const host = new WorldStateMechanismPrototypeAgentToolHost(
      researchCase.currentInputRevision,
    );
    expect(JSON.stringify(host.manifest(researchCase.task.requestedEffectProtocol)))
      .toContain(researchCase.currentInputRevision.memberRouteFamilyIds[0]!);
    const output = await host.execute({
      task: researchCase.task, run, executionProfile: profile,
      toolName: "submit_mechanism_prototype",
      input: {
        label: "Component result influences aggregate state",
        invariantDescription: "A component office result changes a state variable that influences an aggregate outcome.",
        variableSlots: [{
          name: "party", role: "SUBJECT", description: "The party shared by each route.",
          values: researchCase.currentInputRevision.memberRoutes.map((route) => ({
            routeFamilyId: route.routeFamilyId,
            value: route.canonicalRoute.canonicalSubjectLabels[0],
          })),
        }],
        searchSignals: ["component result", "aggregate state"],
        transferTests: ["The component changes the aggregate membership count."],
        counterScenarios: ["Other components dominate the aggregate result."],
        rationale: "Every value is grounded in the exact routes.",
      },
    });
    expect(output).toMatchObject({ status: "ACCEPTED" });
    expect(host.proposals()).toHaveLength(1);
  });

  it("rejects invented grounding and retains a terminal abstention", async () => {
    const { researchCase, profile, run } = fixture();
    const host = new WorldStateMechanismPrototypeAgentToolHost(
      researchCase.currentInputRevision,
    );
    await expect(host.execute({
      task: researchCase.task, run, executionProfile: profile,
      toolName: "submit_mechanism_prototype",
      input: {
        label: "Invented", invariantDescription: "Invented abstraction.",
        variableSlots: [{
          name: "party", role: "SUBJECT", description: "Invented.",
          values: researchCase.currentInputRevision.memberRouteFamilyIds.map(
            (routeFamilyId, index) => ({ routeFamilyId, value: `Invented ${index}` }),
          ),
        }],
        searchSignals: ["invented"], transferTests: ["invented"],
        counterScenarios: ["invented"], rationale: "invented",
      },
    })).rejects.toThrow(/not grounded/u);
    const result = await host.execute({
      task: researchCase.task, run, executionProfile: profile,
      toolName: "record_mechanism_prototype_abstention",
      input: {
        reason: "Two routes are insufficient to establish transferability.",
        missingEvidence: ["A third independent route"],
        incompatibleDimensions: ["Aggregate resolution units may differ"],
        counterScenarios: ["Similarity may be election-specific"],
      },
    });
    expect(result).toMatchObject({ status: "ACCEPTED" });
    expect(host.abstentions()).toHaveLength(1);
  });

  it("fails closed on another task lineage", async () => {
    const { researchCase, profile, run } = fixture();
    const host = new WorldStateMechanismPrototypeAgentToolHost(
      researchCase.currentInputRevision,
    );
    await expect(host.execute({
      task: { ...researchCase.task, kind: "SUBJECT_BINDING_RESEARCH" },
      run, executionProfile: profile,
      toolName: "read_mechanism_prototype_candidate", input: {},
    })).rejects.toThrow(/lineage/u);
  });

});
