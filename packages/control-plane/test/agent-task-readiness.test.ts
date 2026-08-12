import { describe, expect, it } from "vitest";
import {
  buildAgentTask,
  buildAgentTaskReadinessIndex,
  inspectAgentTaskReadiness,
} from "../src/index.js";

function task(protocol: string, payload: unknown, createdAt: string) {
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol,
    inputArtifacts: [],
    taskPayload: payload,
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: "rule-evidence:fixture",
    priority: 1,
    createdAt,
  });
}

describe("Agent task readiness", () => {
  it("distinguishes a current task, its exact-family predecessor and audit-only work", () => {
    const predecessor = task("RULE_EVIDENCE_TASK_V3", { revision: 1 }, "2026-08-13T00:00:00.000Z");
    const current = task("RULE_EVIDENCE_TASK_V3", { revision: 2 }, "2026-08-13T01:00:00.000Z");
    const parallelProtocol = task("RULE_EVIDENCE_TASK_V1", { document: true }, "2026-08-13T00:30:00.000Z");
    const index = buildAgentTaskReadinessIndex([current]);

    expect(inspectAgentTaskReadiness(current, index)).toMatchObject({
      status: "RUNNABLE",
      successorTaskId: null,
    });
    expect(inspectAgentTaskReadiness(predecessor, index)).toMatchObject({
      status: "SUPERSEDED_INPUT",
      successorTaskId: current.taskId,
    });
    expect(inspectAgentTaskReadiness(parallelProtocol, index)).toMatchObject({
      status: "HISTORICAL_ONLY",
      successorTaskId: null,
    });
  });
});
