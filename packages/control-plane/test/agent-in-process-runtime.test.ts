import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  AgentCredentialBroker,
  buildAgentRun,
  buildAgentRuntimeDefinition,
  buildAgentTask,
  buildCredentialBinding,
  buildExecutionProfile,
  buildModelProfile,
  CodexOAuthCredentialResolver,
  createInProcessAiSdkAgentRuntimeAdapter,
  EnvironmentCredentialResolver,
  executePreparedAgentRun,
  type CredentialBinding,
  type InProcessAiSdkTurnRequest,
  type InProcessAiSdkTurnResult,
  type InProcessAiSdkTurnRunner,
  type ModelProfile,
} from "../src/index.js";

const NOW = "2026-08-10T12:00:00.000Z";
const NEXT = "2026-08-10T12:00:01.000Z";
const LATER = "2026-08-10T12:00:02.000Z";
const CODEX_SECRET = "in-process-test-codex-token";
const DEEPSEEK_SECRET = "in-process-test-deepseek-key";
const TOOL_MANIFEST = [{
  name: "inspect_evidence",
  description: "Inspect retained evidence bytes",
  inputSchema: { type: "object" },
}] as const;

function credential(kind: "CODEX_OAUTH" | "DEEPSEEK_API_KEY"): CredentialBinding {
  return kind === "CODEX_OAUTH"
    ? buildCredentialBinding({
        kind,
        logicalAccountRef: "codex-oauth:test",
        resolverKind: "CODEX_AUTH_CACHE",
        resolverRef: "codex-auth-cache:test",
      })
    : buildCredentialBinding({
        kind,
        logicalAccountRef: "deepseek:test",
        resolverKind: "ENVIRONMENT",
        resolverRef: "env:DEEPSEEK_API_KEY",
      });
}

function model(kind: "CODEX_OAUTH" | "DEEPSEEK_API_KEY"): ModelProfile {
  return kind === "CODEX_OAUTH"
    ? buildModelProfile({
        profileKey: "in-process-terra-test",
        revision: 1,
        accessDriver: "CODEX_RESPONSES",
        model: "gpt-5.6-terra",
        configuration: {
          schemaVersion: "pmh.codex-model-configuration.v1",
          reasoning: { effort: "high" },
          responseStorage: false,
        },
        createdAt: NOW,
      })
    : buildModelProfile({
        profileKey: "in-process-deepseek-test",
        revision: 1,
        accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
        model: "deepseek-v4-flash",
        configuration: {
          schemaVersion: "pmh.deepseek-flash-model-configuration.v1",
          thinking: { mode: "enabled" },
          responseStorage: false,
        },
        createdAt: NOW,
      });
}

function execution(
  selectedCredential: CredentialBinding,
  selectedModel: ModelProfile,
  runner: InProcessAiSdkTurnRunner,
) {
  const task = buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: [{
      kind: "EVIDENCE_REQUIREMENT",
      artifactId: "requirement:test",
      artifactHash: hashCanonical({ requirement: "test" }),
    }],
    taskPayload: { requirementId: "requirement:test" },
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: "in-process:test",
    priority: 1,
    createdAt: NOW,
  });
  const runtimeDefinition = buildAgentRuntimeDefinition({
    kind: "HARNESS_IN_PROCESS",
    version: "ai-sdk-v7-test",
  });
  const executionProfile = buildExecutionProfile({
    profileKey: "in-process-test",
    revision: 1,
    runtimeDefinition,
    credentialBinding: selectedCredential,
    modelProfile: selectedModel,
    toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 4,
      maximumToolCalls: 4,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "1000",
      maximumOutputTokens: "1000",
    },
    createdAt: NOW,
  });
  return {
    run: buildAgentRun({
      task,
      executionProfile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    }),
    task,
    taskPayload: { requirementId: "requirement:test" },
    runtimeDefinition,
    credentialBinding: selectedCredential,
    modelProfile: selectedModel,
    executionProfile,
    adapter: createInProcessAiSdkAgentRuntimeAdapter({ runner }),
    credentialBroker: new AgentCredentialBroker([
      new EnvironmentCredentialResolver({ DEEPSEEK_API_KEY: DEEPSEEK_SECRET }),
      new CodexOAuthCredentialResolver({
        configured: () => true,
        resolve: async () => ({
          accessToken: CODEX_SECRET,
          accountId: "account:test",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
      }),
    ]),
  } as const;
}

function successfulTurn(
  ordinal: number,
  toolCalls: InProcessAiSdkTurnResult["toolCalls"],
): InProcessAiSdkTurnResult {
  return Object.freeze({
    status: "SUCCEEDED",
    startedAt: ordinal === 1 ? NOW : NEXT,
    completedAt: ordinal === 1 ? NEXT : LATER,
    inputTokens: "20",
    outputTokens: "5",
    reasoningTokens: "2",
    failureCategory: null,
    toolCalls,
  });
}

describe("in-process Vercel AI SDK runtime", () => {
  for (const kind of ["CODEX_OAUTH", "DEEPSEEK_API_KEY"] as const) {
    it(`runs ${kind} as a model supply behind one provider-neutral tool loop`, async () => {
      const requests: InProcessAiSdkTurnRequest[] = [];
      const runner: InProcessAiSdkTurnRunner = async (request) => {
        requests.push(request);
        return requests.length === 1
          ? successfulTurn(1, [{
              callId: "call:inspect",
              toolName: "inspect_evidence",
              input: { documentId: "document:test" },
            }])
          : successfulTurn(2, [{
              callId: "call:complete",
              toolName: "complete_agent_run",
              input: { artifact: { disposition: "INCONCLUSIVE" } },
            }]);
      };
      const result = await executePreparedAgentRun({
        ...execution(credential(kind), model(kind), runner),
        toolHost: {
          manifest: () => TOOL_MANIFEST,
          execute: async () => ({
            status: "REJECTED",
            output: { diagnostic: "requested bytes are outside the retained capture" },
          }),
        },
        now: () => Date.parse(LATER),
      });

      expect(result.run.status).toBe("SUCCEEDED");
      expect(requests).toHaveLength(2);
      expect(requests[0]?.modelProfile.accessDriver).toBe(
        kind === "CODEX_OAUTH" ? "CODEX_RESPONSES" : "DEEPSEEK_OPENAI_COMPATIBLE",
      );
      expect(requests[0]?.maximumOutputTokens).toBe(1000);
      expect(requests[1]?.prompt).toContain("requested bytes are outside the retained capture");
      expect(requests[1]?.prompt).toContain("REJECTED");
      expect(result.toolEffects).toHaveLength(1);
      expect(result.finalArtifactHash).toBe(hashCanonical({ disposition: "INCONCLUSIVE" }));
      expect(JSON.stringify(result)).not.toContain(CODEX_SECRET);
      expect(JSON.stringify(result)).not.toContain(DEEPSEEK_SECRET);
    });
  }

  it("fails closed when completion is mixed with a domain effect", async () => {
    const runner: InProcessAiSdkTurnRunner = async () => successfulTurn(1, [{
      callId: "call:inspect",
      toolName: "inspect_evidence",
      input: {},
    }, {
      callId: "call:complete",
      toolName: "complete_agent_run",
      input: { artifact: {} },
    }]);
    const result = await executePreparedAgentRun({
      ...execution(credential("CODEX_OAUTH"), model("CODEX_OAUTH"), runner),
      toolHost: {
        manifest: () => TOOL_MANIFEST,
        execute: async () => ({ status: "ACCEPTED", output: {} }),
      },
      now: () => Date.parse(NEXT),
    });

    expect(result.run.status).toBe("FAILED");
    expect(result.run.terminalDiagnostic).toBe("runtime adapter failed");
    expect(result.toolEffects).toHaveLength(0);
  });

  it("projects a model timeout as an interrupted run without fabricating usage", async () => {
    const runner: InProcessAiSdkTurnRunner = async () => Object.freeze({
      status: "TIMED_OUT",
      startedAt: NOW,
      completedAt: NEXT,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      failureCategory: "AI_SDK_TIMEOUT",
      toolCalls: Object.freeze([]),
    });
    const result = await executePreparedAgentRun({
      ...execution(credential("DEEPSEEK_API_KEY"), model("DEEPSEEK_API_KEY"), runner),
      toolHost: {
        manifest: () => TOOL_MANIFEST,
        execute: async () => ({ status: "ACCEPTED", output: {} }),
      },
      now: () => Date.parse(NEXT),
    });

    expect(result.run).toMatchObject({
      status: "INTERRUPTED",
      terminalDiagnostic: "model invocation timed_out",
    });
    expect(result.modelInvocations[0]).toMatchObject({
      status: "TIMED_OUT",
      failureCategory: "AI_SDK_TIMEOUT",
      inputTokens: null,
      outputTokens: null,
    });
  });
});
