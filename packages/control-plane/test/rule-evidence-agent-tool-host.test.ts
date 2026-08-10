import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildAgentRun,
  buildAgentTask,
  buildDefaultAgentRuntimePortfolio,
  RuleEvidenceAgentToolHost,
  type AiRuntimeConfiguration,
  type RuleEvidenceClaimModelInput,
} from "../src/index.js";

const NOW = "2026-08-10T15:00:00.000Z";

describe("Rule Evidence first-party Agent tool host", () => {
  it("requires retained reads and resolves passage citations outside the model", async () => {
    const configuration: AiRuntimeConfiguration = {
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 1,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: NOW,
    };
    const portfolio = buildDefaultAgentRuntimePortfolio(configuration);
    const profile = portfolio.executionProfiles!.find((item) =>
      item.profileKey === "rule-evidence-codex-agent"
    )!;
    const task = buildAgentTask({
      kind: "RULE_EVIDENCE_CLAIM",
      protocol: "RULE_EVIDENCE_TASK_V1",
      inputArtifacts: [],
      taskPayload: { fixture: true },
      requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
      provenanceRef: "fixture:rule-evidence-tools",
      priority: 1,
      createdAt: NOW,
    });
    const run = buildAgentRun({
      task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: { kind: "MANUAL", authorizationRef: "operator:fixture", authorizedAt: NOW },
      createdAt: NOW,
    });
    const text = "Official rule: cancellation makes this contract resolve No.";
    const source = {
      requirement: { requirementId: hashCanonical({ requirement: 1 }) },
      capture: {
        document: { record: { documentId: hashCanonical({ document: 1 }) } },
        extraction: {
          text,
          record: { extractionId: hashCanonical({ extraction: 1 }) },
        },
      },
    } as unknown as RuleEvidenceClaimModelInput;
    const host = new RuleEvidenceAgentToolHost((taskId) =>
      taskId === task.taskId ? source : null
    );
    const base = {
      run,
      task,
      executionProfile: profile,
      callId: "fixture-call",
    } as const;
    const early = await host.execute({
      ...base,
      toolName: "submit_rule_evidence_claim",
      input: {
        disposition: "SUPPORTS",
        rationale: "The official text settles cancellation.",
        citations: [],
        unresolvedEvidence: [],
      },
    });
    expect(early).toMatchObject({ status: "REJECTED" });

    const read = await host.execute({
      ...base,
      callId: "read-call",
      toolName: "read_evidence_text",
      input: { start: 0, length: text.length },
    });
    expect(read.status).toBe("ACCEPTED");
    const passageId = (read.output as { passageId: string }).passageId;
    const submitted = await host.execute({
      ...base,
      callId: "submit-call",
      toolName: "submit_rule_evidence_claim",
      input: {
        disposition: "SUPPORTS",
        rationale: "The official text settles cancellation.",
        citations: [{ passageId }],
        unresolvedEvidence: [],
      },
    });
    expect(submitted).toMatchObject({
      status: "ACCEPTED",
      output: {
        accepted: true,
        advisoryOnly: true,
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
        draft: {
          disposition: "SUPPORTS",
          citations: [{ start: 0, end: text.length, quote: text }],
        },
      },
    });
  });
});
