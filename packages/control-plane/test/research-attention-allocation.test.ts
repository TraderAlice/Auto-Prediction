import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildAgentTask,
  buildResearchAttentionAllocation,
  emptyAgentExecutionSnapshot,
  type AgentExecutionSnapshot,
  type AgentRun,
  type MarketRelationKind,
  type OntologyRelationWorkItem,
  type OntologyRelationWorkProjection,
  type RelationDiscoveryFinding,
  type RelationDiscoveryProposalCompilation,
  type RelationDiscoveryTaskRevision,
  type SemanticReviewJobRecord,
} from "../src/index.js";

const OBSERVED_AT = "2026-08-12T12:00:00.000Z";

function work(label: string, priority: 1 | 2 | 3 | 4 | 5): OntologyRelationWorkItem {
  return {
    workItemId: hashCanonical({ work: label }),
    artifactHash: hashCanonical({ artifact: label }),
    kind: "WORLD_PROPOSITION_NEIGHBORHOOD",
    priority,
    sourceSelectionLanes: Object.freeze(["WORLD_DIVERGENCE"]),
  } as unknown as OntologyRelationWorkItem;
}

function projection(items: readonly OntologyRelationWorkItem[]): OntologyRelationWorkProjection {
  return { items } as unknown as OntologyRelationWorkProjection;
}

function revision(
  item: OntologyRelationWorkItem,
  label: string,
  materializedAt: string,
  artifactHash = item.artifactHash,
): RelationDiscoveryTaskRevision {
  const task = buildAgentTask({
    kind: "RELATION_DISCOVERY",
    protocol: "RELATION_DISCOVERY_TASK_V1",
    inputArtifacts: [{
      kind: "RELATION_WORK",
      artifactId: item.workItemId,
      artifactHash,
    }],
    taskPayload: { label, workItemId: item.workItemId, artifactHash },
    requestedEffectProtocol: "RELATION_DISCOVERY_AGENT_TOOLS_V1",
    provenanceRef: `relation-work:${item.workItemId}`,
    priority: item.priority * 100,
    createdAt: materializedAt,
  });
  return {
    revisionId: hashCanonical({ revision: label, taskId: task.taskId }),
    workItemId: item.workItemId,
    workArtifactHash: artifactHash,
    materializedAt,
    task,
  } as unknown as RelationDiscoveryTaskRevision;
}

function run(
  taskId: Hash,
  label: string,
  status: AgentRun["status"],
  createdAt = "2026-08-10T10:00:00.000Z",
  completedAt: string | null = "2026-08-10T10:10:00.000Z",
): AgentRun {
  return Object.freeze({
    schemaVersion: "pmh.agent-run.v1",
    runId: hashCanonical({ run: label }),
    taskId,
    executionProfileId: hashCanonical({ profile: "attention-test" }),
    runOrdinal: 1,
    authorization: Object.freeze({
      kind: "MANUAL",
      authorizationRef: "operator:attention-test",
      campaignId: null,
      authorizedAt: createdAt,
    }),
    status,
    createdAt,
    completedAt,
    terminalDiagnostic: null,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  });
}

function finding(
  item: OntologyRelationWorkItem,
  sourceRun: AgentRun,
  label: string,
  kind: RelationDiscoveryFinding["kind"],
): RelationDiscoveryFinding {
  return {
    findingId: hashCanonical({ finding: label }),
    workItemId: item.workItemId,
    sourceAgentRunId: sourceRun.runId,
    kind,
  } as unknown as RelationDiscoveryFinding;
}

function compilation(
  item: OntologyRelationWorkItem,
  label: string,
  relationKind: MarketRelationKind = "IMPLIES",
): RelationDiscoveryProposalCompilation {
  return {
    compilationId: hashCanonical({ compilation: label }),
    origin: { workItemId: item.workItemId },
    proposal: { proposalId: hashCanonical({ proposal: label }), relationKind },
  } as unknown as RelationDiscoveryProposalCompilation;
}

function semanticPass(
  candidate: RelationDiscoveryProposalCompilation,
  classification: "HARD_SETTLEMENT_CONSTRAINT" | "PROBABILISTIC_DEPENDENCE" |
    "TEXTUAL_RELATEDNESS",
  updatedAt = "2026-08-10T11:00:00.000Z",
): SemanticReviewJobRecord {
  return {
    jobId: hashCanonical({ semanticJob: candidate.proposal.proposalId, classification, updatedAt }),
    proposalId: candidate.proposal.proposalId,
    status: "PASS",
    recommendation: classification === "TEXTUAL_RELATEDNESS" ? "ESCALATE" : "ACCEPT",
    reviewOutcome: { semanticConstraint: { classification } },
    updatedAt,
  } as unknown as SemanticReviewJobRecord;
}

function execution(input: Readonly<{
  revisions: readonly RelationDiscoveryTaskRevision[];
  runs?: readonly AgentRun[];
  invocations?: AgentExecutionSnapshot["modelInvocations"];
  effects?: AgentExecutionSnapshot["toolEffects"];
}>): AgentExecutionSnapshot {
  return Object.freeze({
    ...emptyAgentExecutionSnapshot(),
    tasks: Object.freeze(input.revisions.map((item) => item.task)),
    runs: Object.freeze([...(input.runs ?? [])]),
    modelInvocations: Object.freeze([...(input.invocations ?? [])]),
    toolEffects: Object.freeze([...(input.effects ?? [])]),
  });
}

describe("persistent research-attention allocation", () => {
  it("routes semantic debt away from relation rediscovery and explores a new family", () => {
    const lafc = work("lafc", 5);
    const newFamily = work("new-family", 4);
    const lafcRevision = revision(lafc, "lafc-r1", "2026-08-10T09:00:00.000Z");
    const newRevision = revision(newFamily, "new-r1", "2026-08-12T09:00:00.000Z");
    const lafcRun = run(lafcRevision.task.taskId, "lafc", "INTERRUPTED");
    const hypothesis = finding(lafc, lafcRun, "positive", "RELATION_HYPOTHESIS");
    const counterexample = finding(lafc, lafcRun, "negative", "COUNTEREXAMPLE");
    const candidate = compilation(lafc, "lafc");
    const invocations: AgentExecutionSnapshot["modelInvocations"] = Object.freeze([
      {
        schemaVersion: "pmh.model-invocation.v1",
        invocationId: hashCanonical({ invocation: 1 }),
        runId: lafcRun.runId,
        ordinal: 1,
        accessDriver: "OPENAI_CODEX_OAUTH",
        modelProfileId: hashCanonical({ model: "terra" }),
        status: "SUCCEEDED",
        startedAt: "2026-08-10T10:00:00.000Z",
        completedAt: "2026-08-10T10:05:00.000Z",
        inputTokens: "1000",
        outputTokens: "100",
        reasoningTokens: "50",
        failureCategory: null,
        responseStorage: false,
      },
    ]);
    const effects: AgentExecutionSnapshot["toolEffects"] = Object.freeze([
      {
        schemaVersion: "pmh.agent-tool-effect.v1",
        effectId: hashCanonical({ effect: 1 }),
        runId: lafcRun.runId,
        ordinal: 1,
        toolProtocol: "RELATION_DISCOVERY_AGENT_TOOLS_V1",
        toolName: "record_relation_hypothesis",
        status: "ACCEPTED",
        canonicalInputHash: hashCanonical({ input: 1 }),
        canonicalOutputHash: hypothesis.findingId,
        occurredAt: "2026-08-10T10:05:00.000Z",
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      },
    ]);
    const result = buildResearchAttentionAllocation({
      observedAt: OBSERVED_AT,
      relationWork: projection([lafc, newFamily]),
      taskRevisions: [lafcRevision, newRevision],
      findings: [hypothesis, counterexample],
      proposalCompilations: [candidate],
      semanticReviewJobs: [semanticPass(candidate, "TEXTUAL_RELATEDNESS")],
      probabilityJobs: [],
      execution: execution({ revisions: [lafcRevision, newRevision], runs: [lafcRun],
        invocations, effects }),
    });

    const lafcCard = result.families.find((item) => item.workItemId === lafc.workItemId)!;
    expect(lafcCard).toMatchObject({
      productiveInterruptedRunCount: 1,
      positiveFindingCount: 1,
      counterexampleCount: 1,
      semanticReviewPassCount: 1,
      valueStage: "SEMANTICALLY_REVIEWED",
      nextActionKind: "ADVANCE_RESEARCH_DEBT",
      nextActionLane: "FALSIFICATION_OR_DEBT",
      directRelationTaskId: null,
      usage: {
        knownInputTokens: "1000",
        knownOutputTokens: "100",
        knownReasoningTokens: "50",
        knownWallClockMs: "600000",
        incompleteUsagePenalized: false,
      },
    });
    expect(result.portfolio.map((item) => [item.kind, item.dispatchableByRelationCampaign]))
      .toEqual([
        ["EXPLORE_NEW_FAMILY", true],
        ["ADVANCE_RESEARCH_DEBT", false],
      ]);
    expect(result.portfolio[1]!.targetArtifactRefs).toEqual([lafcCard.semanticReviewJobIds[0]]);
    expect(result).toMatchObject({
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      campaignsCreatedByRead: 0,
      runsCreatedByRead: 0,
      automaticDispatch: false,
      executionAuthority: false,
      valueMovingAuthority: false,
    });
  });

  it("gives successful free text zero finding yield and proposes mutation only after exhaustion", () => {
    const item = work("free-text-only", 3);
    const current = revision(item, "r1", "2026-08-10T09:00:00.000Z");
    const completed = run(current.task.taskId, "free-text", "SUCCEEDED");
    const result = buildResearchAttentionAllocation({
      observedAt: OBSERVED_AT,
      relationWork: projection([item]),
      taskRevisions: [current],
      findings: [],
      proposalCompilations: [],
      semanticReviewJobs: [],
      probabilityJobs: [],
      execution: execution({ revisions: [current], runs: [completed] }),
    });

    expect(result.families[0]).toMatchObject({
      successfulWithoutAcceptedResultCount: 1,
      noFindingTerminalRunCount: 1,
      positiveFindingCount: 0,
      valueStage: "ATTEMPTED",
      nextActionKind: "HOLD",
    });
    expect(result.portfolio).toHaveLength(1);
    expect(result.portfolio[0]).toMatchObject({
      lane: "ONTOLOGY_MUTATION",
      kind: "PROPOSE_ONTOLOGY_MUTATION",
      workItemId: null,
      taskId: null,
      targetArtifactRefs: [],
      dispatchableByRelationCampaign: false,
    });
  });

  it("uses only the latest semantic-review state for each proposal", () => {
    const item = work("latest-semantic-review", 4);
    const current = revision(item, "r1", "2026-08-10T09:00:00.000Z");
    const completed = run(current.task.taskId, "latest-review", "SUCCEEDED");
    const hypothesis = finding(item, completed, "latest-positive", "RELATION_HYPOTHESIS");
    const counterexample = finding(item, completed, "latest-negative", "COUNTEREXAMPLE");
    const candidate = compilation(item, "latest-review");
    const result = buildResearchAttentionAllocation({
      observedAt: OBSERVED_AT,
      relationWork: projection([item]),
      taskRevisions: [current],
      findings: [hypothesis, counterexample],
      proposalCompilations: [candidate, candidate],
      semanticReviewJobs: [
        semanticPass(candidate, "HARD_SETTLEMENT_CONSTRAINT", "2026-08-11T12:00:00.000Z"),
        semanticPass(candidate, "TEXTUAL_RELATEDNESS", "2026-08-10T12:00:00.000Z"),
      ],
      probabilityJobs: [],
      execution: execution({ revisions: [current], runs: [completed] }),
    });

    expect(result.families[0]).toMatchObject({
      semanticReviewCandidateCount: 2,
      ontologyRoutingOnlyFindingCount: 0,
      semanticReviewConnectedCount: 1,
      semanticReviewPassCount: 1,
      semanticPayoffReviewPassCount: 1,
      semanticClassificationCounts: {
        hardSettlementConstraint: 1,
        probabilisticDependence: 0,
        textualRelatedness: 0,
      },
      valueStage: "SEMANTICALLY_ADMITTED",
      nextActionKind: "HOLD",
    });
    expect(result.recurrenceQualification.independentlyReviewedPositiveFindingCount).toBe(1);
  });

  it("retains entity routing memory without counting it as semantic payoff review supply", () => {
    const item = work("routing-only", 4);
    const current = revision(item, "r1", "2026-08-10T09:00:00.000Z");
    const completed = run(current.task.taskId, "routing-only", "SUCCEEDED");
    const hypothesis = finding(item, completed, "routing-positive", "RELATION_HYPOTHESIS");
    const counterexample = finding(item, completed, "routing-negative", "COUNTEREXAMPLE");
    const routingMemory = compilation(item, "routing-only", "RELATED");
    const result = buildResearchAttentionAllocation({
      observedAt: OBSERVED_AT,
      relationWork: projection([item]),
      taskRevisions: [current],
      findings: [hypothesis, counterexample],
      proposalCompilations: [routingMemory],
      semanticReviewJobs: [semanticPass(routingMemory, "TEXTUAL_RELATEDNESS")],
      probabilityJobs: [],
      execution: execution({ revisions: [current], runs: [completed] }),
    });

    expect(result.families[0]).toMatchObject({
      positiveFindingCount: 1,
      ontologyRoutingOnlyFindingCount: 1,
      semanticReviewCandidateCount: 0,
      semanticReviewConnectedCount: 1,
      semanticReviewPassCount: 1,
      semanticPayoffReviewPassCount: 0,
      valueStage: "SEMANTICALLY_REVIEWED",
      nextActionKind: "HOLD",
    });
    expect(result.recurrenceQualification.independentlyReviewedPositiveFindingCount).toBe(0);
  });

  it("permits one cooled-down work-artifact recheck but rejects corpus-hash churn", () => {
    const changed = work("changed", 5);
    const churn = work("churn", 4);
    const changedOld = revision(changed, "changed-old", "2026-08-09T09:00:00.000Z",
      hashCanonical({ artifact: "changed-old" }));
    const changedNew = revision(changed, "changed-new", "2026-08-12T09:00:00.000Z",
      hashCanonical({ artifact: "changed-new" }));
    const churnOld = revision(churn, "churn-old", "2026-08-09T09:00:00.000Z");
    const churnNew = revision(churn, "churn-new", "2026-08-12T09:00:00.000Z");
    const changedRun = run(changedOld.task.taskId, "changed-old", "FAILED");
    const churnRun = run(churnOld.task.taskId, "churn-old", "FAILED");
    const unknownInvocation: AgentExecutionSnapshot["modelInvocations"][number] = {
      schemaVersion: "pmh.model-invocation.v1",
      invocationId: hashCanonical({ invocation: "unknown" }),
      runId: changedRun.runId,
      ordinal: 1,
      accessDriver: "OPENAI_CODEX_OAUTH",
      modelProfileId: hashCanonical({ model: "terra" }),
      status: "FAILED",
      startedAt: changedRun.createdAt,
      completedAt: changedRun.completedAt!,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      failureCategory: "TRANSIENT_PROVIDER",
      responseStorage: false,
    };
    const revisions = [changedOld, changedNew, churnOld, churnNew];
    const result = buildResearchAttentionAllocation({
      observedAt: OBSERVED_AT,
      relationWork: projection([changed, churn]),
      taskRevisions: revisions,
      findings: [],
      proposalCompilations: [],
      semanticReviewJobs: [],
      probabilityJobs: [],
      execution: execution({ revisions, runs: [changedRun, churnRun],
        invocations: [unknownInvocation] }),
    });

    expect(result.families.find((item) => item.workItemId === changed.workItemId))
      .toMatchObject({
        nextActionKind: "RECHECK_CHANGED_EVIDENCE",
        nextActionEligible: true,
        noveltyReason: "WORK_ARTIFACT_CHANGED",
        usage: { incompleteUsagePenalized: true },
      });
    expect(result.families.find((item) => item.workItemId === churn.workItemId))
      .toMatchObject({
        nextActionKind: "HOLD",
        nextActionEligible: false,
        noveltyReason: "CORPUS_REVISION_ONLY",
      });
    expect(result.portfolio.map((item) => item.kind))
      .toEqual(["RECHECK_CHANGED_EVIDENCE"]);
    expect(result.portfolio[0]!.dispatchableByRelationCampaign).toBe(false);
    expect(result.recurrenceQualification.usageComplete).toBe(false);
  });

  it("caps exploration deterministically and retains omitted demand", () => {
    const items = [1, 2, 3, 4, 5].map((index) => work(`explore-${index}`,
      index === 1 ? 5 : 4));
    const revisions = items.map((item, index) =>
      revision(item, `explore-${index}`, "2026-08-12T09:00:00.000Z")
    );
    const input = {
      observedAt: OBSERVED_AT,
      relationWork: projection(items),
      taskRevisions: revisions,
      findings: [],
      proposalCompilations: [],
      semanticReviewJobs: [],
      probabilityJobs: [],
      execution: execution({ revisions }),
    } as const;
    const first = buildResearchAttentionAllocation(input);
    const replay = buildResearchAttentionAllocation(input);

    expect(first.laneCounts.exploration).toBe(4);
    expect(first.omittedActionableFamilyCount).toBe(1);
    expect(first.portfolio[0]!.workItemId).toBe(items[0]!.workItemId);
    expect(replay).toEqual(first);
    expect(replay.projectionIdentity).toBe(first.projectionIdentity);
  });
});
