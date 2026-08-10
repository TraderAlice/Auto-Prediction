import { access, readFile } from "node:fs/promises";
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
  createCodexCliAgentRuntimeAdapter,
  createPiCliAgentRuntimeAdapter,
  EnvironmentCredentialResolver,
  executePreparedAgentRun,
  type AgentCliProcessRequest,
  type AgentCliProcessResult,
  type AgentCliProcessRunner,
  type AgentRuntimeKind,
  type CredentialBinding,
  type ModelProfile,
} from "../src/index.js";

const NOW = "2026-08-10T12:00:00.000Z";
const NEXT = "2026-08-10T12:00:01.000Z";
const LATER = "2026-08-10T12:00:02.000Z";
const CODEX_SECRET = "test-only-codex-oauth-token";
const DEEPSEEK_SECRET = "test-only-deepseek-api-key";
const TOOL_MANIFEST = [{
  name: "inspect_evidence",
  description: "Inspect retained evidence bytes",
  inputSchema: { type: "object" },
}] as const;

function processResult(stdout: string, ordinal: number): AgentCliProcessResult {
  return Object.freeze({
    exitCode: 0,
    stdout,
    stderr: "",
    startedAt: ordinal === 1 ? NOW : NEXT,
    completedAt: ordinal === 1 ? NEXT : LATER,
    timedOut: false,
    outputLimitExceeded: false,
  });
}

function piTurn(action: unknown, input = 10, output = 4): string {
  return JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "text", text: JSON.stringify(action) }],
      usage: { input, output, reasoning: 2 },
    },
  });
}

function codexTurn(threadId: string, action: unknown): string {
  return [
    JSON.stringify({ type: "thread.started", thread_id: threadId }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: JSON.stringify(action) },
    }),
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 12, output_tokens: 5, reasoning_output_tokens: 3 },
    }),
  ].join("\n");
}

function codexCredential(): CredentialBinding {
  return buildCredentialBinding({
    kind: "CODEX_OAUTH",
    logicalAccountRef: "codex-oauth:test",
    resolverKind: "CODEX_AUTH_CACHE",
    resolverRef: "codex-auth-cache:test",
  });
}

function deepSeekCredential(): CredentialBinding {
  return buildCredentialBinding({
    kind: "DEEPSEEK_API_KEY",
    logicalAccountRef: "deepseek:test",
    resolverKind: "ENVIRONMENT",
    resolverRef: "env:DEEPSEEK_API_KEY",
  });
}

function codexModel(): ModelProfile {
  return buildModelProfile({
    profileKey: "codex-terra-cli-test",
    revision: 1,
    accessDriver: "CODEX_RESPONSES",
    model: "gpt-5.6-terra",
    configuration: {
      schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort: "high" },
      responseStorage: false,
    },
    createdAt: NOW,
  });
}

function deepSeekModel(): ModelProfile {
  return buildModelProfile({
    profileKey: "deepseek-cli-test",
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

function execution(input: Readonly<{
  kind: AgentRuntimeKind;
  credential: CredentialBinding;
  model: ModelProfile;
  adapter: ReturnType<typeof createPiCliAgentRuntimeAdapter> |
    ReturnType<typeof createCodexCliAgentRuntimeAdapter>;
}>) {
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
    provenanceRef: "cli-runtime:test",
    priority: 1,
    createdAt: NOW,
  });
  const runtimeDefinition = buildAgentRuntimeDefinition({
    kind: input.kind,
    version: `${input.kind.toLowerCase()}-cli-test-v1`,
  });
  const executionProfile = buildExecutionProfile({
    profileKey: `${input.kind.toLowerCase()}-cli-test`,
    revision: 1,
    runtimeDefinition,
    credentialBinding: input.credential,
    modelProfile: input.model,
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
    credentialBinding: input.credential,
    modelProfile: input.model,
    executionProfile,
    adapter: input.adapter,
    credentialBroker: new AgentCredentialBroker([
      new EnvironmentCredentialResolver({ DEEPSEEK_API_KEY: DEEPSEEK_SECRET }),
      new CodexOAuthCredentialResolver({
        configured: () => true,
        resolve: async () => ({
          accessToken: CODEX_SECRET,
          accountId: "account:test",
          expiresAt: "2099-01-01T00:00:00.000Z",
          idToken: "test-only-id-token",
          refreshToken: "test-only-refresh-token",
        }),
      }),
    ]),
  } as const;
}

const toolHost = {
  manifest: () => TOOL_MANIFEST,
  execute: async () => ({ status: "ACCEPTED" as const, output: { bytes: "evidence" } }),
};

describe("production Agent CLI runtime drivers", () => {
  it("runs Pi with DeepSeek through a bounded two-turn first-party tool loop", async () => {
    const requests: AgentCliProcessRequest[] = [];
    const runner: AgentCliProcessRunner = async (request) => {
      requests.push(request);
      const ordinal = requests.length;
      return processResult(ordinal === 1
        ? piTurn({
            kind: "tool_call",
            calls: [{ callId: "call:inspect", toolName: "inspect_evidence", input: {} }],
          })
        : piTurn({ kind: "complete", artifact: { disposition: "INCONCLUSIVE" } }), ordinal);
    };
    const adapter = createPiCliAgentRuntimeAdapter({ runner, command: "pi-test" });
    const result = await executePreparedAgentRun({
      ...execution({ kind: "PI", credential: deepSeekCredential(), model: deepSeekModel(), adapter }),
      toolHost,
      now: () => Date.parse(LATER),
    });

    expect(result.run.status).toBe("SUCCEEDED");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.args).toContain("--no-tools");
    expect(requests[0]?.args).toContain("deepseek");
    expect(requests[0]?.environment.DEEPSEEK_API_KEY).toBe(DEEPSEEK_SECRET);
    expect(requests[1]?.args[requests[1].args.length - 1]).toContain("First-party tool results");
    expect(JSON.stringify(result)).not.toContain(DEEPSEEK_SECRET);
  });

  it("injects Codex OAuth into an isolated Pi home and removes it after completion", async () => {
    let runtimeDirectory = "";
    let authText = "";
    const runner: AgentCliProcessRunner = async (request) => {
      runtimeDirectory = request.environment.PI_CODING_AGENT_DIR ?? "";
      authText = await readFile(`${runtimeDirectory}/auth.json`, "utf8");
      return processResult(piTurn({ kind: "complete", artifact: { ok: true } }), 1);
    };
    const adapter = createPiCliAgentRuntimeAdapter({ runner, command: "pi-test" });
    const result = await executePreparedAgentRun({
      ...execution({ kind: "PI", credential: codexCredential(), model: codexModel(), adapter }),
      toolHost,
      now: () => Date.parse(NEXT),
    });

    expect(authText).toContain(CODEX_SECRET);
    expect(authText).toContain("openai-codex");
    await expect(access(runtimeDirectory)).rejects.toThrow();
    expect(JSON.stringify(result)).not.toContain(CODEX_SECRET);
  });

  it("resumes one isolated Codex thread while retaining only first-party tool effects", async () => {
    const requests: AgentCliProcessRequest[] = [];
    let runtimeDirectory = "";
    let authText = "";
    let schemaText = "";
    const runner: AgentCliProcessRunner = async (request) => {
      requests.push(request);
      runtimeDirectory = request.environment.CODEX_HOME ?? "";
      authText = await readFile(`${runtimeDirectory}/auth.json`, "utf8");
      schemaText = await readFile(`${runtimeDirectory}/runtime-action.schema.json`, "utf8");
      const ordinal = requests.length;
      return processResult(codexTurn("thread:test", ordinal === 1
        ? {
            kind: "tool_call",
            calls: [{ callId: "call:inspect", toolName: "inspect_evidence", input: {} }],
          }
        : { kind: "complete", artifact: { finding: "bounded" } }), ordinal);
    };
    const adapter = createCodexCliAgentRuntimeAdapter({ runner, command: "codex-test" });
    const result = await executePreparedAgentRun({
      ...execution({ kind: "CODEX", credential: codexCredential(), model: codexModel(), adapter }),
      toolHost,
      now: () => Date.parse(LATER),
    });

    expect(result.run.status).toBe("SUCCEEDED");
    expect(requests[0]?.args).toEqual(expect.arrayContaining([
      "exec", "--json", "--ignore-user-config", "--ignore-rules", "--sandbox", "read-only",
    ]));
    expect(requests[1]?.args.slice(0, 2)).toEqual(["exec", "resume"]);
    expect(requests[1]?.args).toContain("thread:test");
    expect(authText).toContain(CODEX_SECRET);
    expect(schemaText).toContain("tool_call");
    await expect(access(runtimeDirectory)).rejects.toThrow();
    expect(JSON.stringify(result)).not.toContain(CODEX_SECRET);
  });

  it("fails closed when a CLI runtime reports an undeclared built-in tool", async () => {
    const runner: AgentCliProcessRunner = async () => processResult([
      JSON.stringify({ type: "thread.started", thread_id: "thread:unsafe" }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "command_execution", command: "forbidden" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: JSON.stringify({ kind: "complete", artifact: {} }) },
      }),
    ].join("\n"), 1);
    const adapter = createCodexCliAgentRuntimeAdapter({ runner, command: "codex-test" });
    const result = await executePreparedAgentRun({
      ...execution({ kind: "CODEX", credential: codexCredential(), model: codexModel(), adapter }),
      toolHost,
      now: () => Date.parse(NEXT),
    });

    expect(result.run).toMatchObject({ status: "FAILED", terminalDiagnostic: "model invocation failed" });
    expect(result.modelInvocations[0]).toMatchObject({
      status: "FAILED",
      failureCategory: "UNDECLARED_RUNTIME_TOOL",
    });
    expect(result.toolEffects).toHaveLength(0);
  });
});
