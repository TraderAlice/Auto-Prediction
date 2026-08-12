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
  createCodexAppServerAgentRuntimeAdapter,
  executePreparedAgentRun,
  type AgentToolHost,
  type CodexAppServerConnection,
  type CodexAppServerInbound,
  type CodexAppServerRequestId,
} from "../src/index.js";

const NOW_MS = Date.parse("2026-08-12T07:00:00.000Z");

class FakeConnection implements CodexAppServerConnection {
  public readonly requests: Array<Readonly<{ method: string; params: unknown }>> = [];
  public readonly responses: Array<Readonly<{
    id: CodexAppServerRequestId;
    result: unknown;
  }>> = [];
  public closed = false;
  readonly #events: CodexAppServerInbound[];
  #turnOrdinal = 0;

  public constructor(events: readonly CodexAppServerInbound[]) {
    this.#events = [...events];
  }

  public async request(method: string, params: unknown): Promise<unknown> {
    this.requests.push(Object.freeze({ method, params }));
    if (method === "thread/start") return {
      thread: { id: "thread:test" },
      model: "gpt-5.6-terra",
      modelProvider: "openai",
    };
    if (method === "turn/start") {
      this.#turnOrdinal += 1;
      return { turn: { id: this.#turnOrdinal === 1 ? "turn:test" : "turn:recovery" } };
    }
    if (method === "turn/interrupt") return {};
    throw new Error(`unexpected fake request: ${method}`);
  }

  public notify(): void {}

  public respond(id: CodexAppServerRequestId, result: unknown): void {
    this.responses.push(Object.freeze({ id, result }));
  }

  public async nextInbound(): Promise<CodexAppServerInbound> {
    const next = this.#events.shift();
    if (next === undefined) throw new Error("fake Codex app-server event queue is empty");
    return next;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

function fixture(events: readonly CodexAppServerInbound[]) {
  const payload = Object.freeze({
    schemaVersion: "test.ontology-task.v1",
    evidenceRef: hashCanonical({ evidence: "bounded" }),
  });
  const task = buildAgentTask({
    kind: "ONTOLOGY_NORMALIZATION",
    protocol: "MARKET_ONTOLOGY_NORMALIZATION_TASK_V1",
    inputArtifacts: [],
    taskPayload: payload,
    requestedEffectProtocol: "TEST_ONTOLOGY_TOOLS_V1",
    provenanceRef: "test:codex-app-server",
    priority: 100,
    createdAt: new Date(NOW_MS).toISOString(),
  });
  const runtime = buildAgentRuntimeDefinition({
    kind: "CODEX",
    version: "codex-app-server-v2:test",
  });
  const credential = buildCredentialBinding({
    kind: "CODEX_OAUTH",
    logicalAccountRef: "codex-oauth:test",
    resolverKind: "CODEX_AUTH_CACHE",
    resolverRef: "codex-auth-cache:test",
  });
  const model = buildModelProfile({
    profileKey: "codex-app-server-terra-test",
    revision: 1,
    accessDriver: "CODEX_RESPONSES",
    model: "gpt-5.6-terra",
    configuration: {
      schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort: "high" },
      responseStorage: false,
    },
    createdAt: new Date(NOW_MS).toISOString(),
  });
  const profile = buildExecutionProfile({
    profileKey: "codex-app-server-terra-test",
    revision: 1,
    runtimeDefinition: runtime,
    credentialBinding: credential,
    modelProfile: model,
    toolProtocol: "TEST_ONTOLOGY_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 4,
      maximumToolCalls: 4,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "10000",
      maximumOutputTokens: "2000",
    },
    createdAt: new Date(NOW_MS).toISOString(),
  });
  const run = buildAgentRun({
    task,
    executionProfile: profile,
    runOrdinal: 1,
    authorization: {
      kind: "MANUAL",
      authorizationRef: "operator:test",
      authorizedAt: new Date(NOW_MS).toISOString(),
    },
    createdAt: new Date(NOW_MS).toISOString(),
  });
  const connection = new FakeConnection(events);
  const adapter = createCodexAppServerAgentRuntimeAdapter({
    connectionFactory: async () => connection,
  });
  const broker = new AgentCredentialBroker([{
    resolverKind: "CODEX_AUTH_CACHE",
    resolve: async () => Object.freeze({
      kind: "CODEX_OAUTH" as const,
      accessToken: "test-access-token",
      accountId: "test-account",
      expiresAt: "2026-08-13T10:00:00.000Z",
    }),
  }]);
  const toolHost: AgentToolHost = {
    manifest: () => Object.freeze([Object.freeze({
      name: "record_counterexample",
      description: "Retain one bounded counterexample.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string" } },
      },
    })]),
    resultToolNames: () => Object.freeze(["record_counterexample"]),
    execute: async (context) => Object.freeze({
      status: "ACCEPTED" as const,
      output: Object.freeze({ retained: true, reason: context.input }),
    }),
  };
  return { payload, task, runtime, credential, model, profile, run, connection, adapter, broker, toolHost };
}

describe("Codex app-server Agent runtime", () => {
  it("executes native dynamic tools and retains usage through the generic long loop", async () => {
    const work = fixture([
      {
        method: "item/tool/call",
        id: 101,
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          callId: "call:counterexample:1",
          tool: "record_counterexample",
          arguments: { reason: "The predicates differ." },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          tokenUsage: {
            last: { inputTokens: 120, outputTokens: 30, reasoningOutputTokens: 12 },
          },
        },
      },
      {
        method: "rawResponse/completed",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          responseId: "response:1",
          usage: { inputTokens: 120, outputTokens: 30, reasoningOutputTokens: 12 },
        },
      },
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:test",
            status: "completed",
            items: [{ type: "agentMessage", text: "Counterexample retained." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          tokenUsage: {
            last: { inputTokens: 80, outputTokens: 20, reasoningOutputTokens: 5 },
          },
        },
      },
    ]);

    const result = await executePreparedAgentRun({
      run: work.run,
      task: work.task,
      taskPayload: work.payload,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: work.profile,
      adapter: work.adapter,
      credentialBroker: work.broker,
      toolHost: work.toolHost,
    });

    expect(result.run.status).toBe("SUCCEEDED");
    expect(result.modelInvocations).toHaveLength(1);
    expect(result.modelInvocations.map((item) => [item.inputTokens, item.outputTokens]))
      .toEqual([["120", "30"]]);
    expect(result.toolEffects).toHaveLength(1);
    expect(result.toolEffects[0]).toMatchObject({
      toolName: "record_counterexample",
      status: "ACCEPTED",
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(work.connection.responses).toEqual([{
      id: 101,
      result: {
        contentItems: [{
          type: "inputText",
          text: expect.stringContaining('"status":"ACCEPTED"'),
        }],
        success: true,
      },
    }]);
    expect(work.connection.requests[0]).toMatchObject({
      method: "thread/start",
      params: {
        model: "gpt-5.6-terra",
        allowProviderModelFallback: false,
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true,
        environments: [],
        dynamicTools: [{ name: "record_counterexample" }],
      },
    });
    expect(work.connection.requests[1]).toMatchObject({
      method: "turn/start",
      params: { model: "gpt-5.6-terra", effort: "high" },
    });
    expect(work.connection.closed).toBe(true);
  });

  it("fails closed when Codex starts a built-in command", async () => {
    const work = fixture([{
      method: "item/started",
      params: {
        threadId: "thread:test",
        turnId: "turn:test",
        item: { type: "commandExecution", id: "command:1", command: "pwd" },
      },
    }]);

    const result = await executePreparedAgentRun({
      run: work.run,
      task: work.task,
      taskPayload: work.payload,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: work.profile,
      adapter: work.adapter,
      credentialBroker: work.broker,
      toolHost: work.toolHost,
    });

    expect(result.run.status).toBe("FAILED");
    expect(result.modelInvocations[0]).toMatchObject({
      status: "FAILED",
      failureCategory: "UNDECLARED_RUNTIME_TOOL",
    });
    expect(result.toolEffects).toHaveLength(0);
    expect(work.connection.closed).toBe(true);
  });

  it("recovers one diagnostic-only completion in the same thread through a result tool", async () => {
    const work = fixture([
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:test",
            status: "completed",
            items: [{ type: "agentMessage", text: "The evidence appears contradictory." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          tokenUsage: { last: { inputTokens: 40, outputTokens: 10, reasoningOutputTokens: 4 } },
        },
      },
      {
        method: "item/tool/call",
        id: 301,
        params: {
          threadId: "thread:test",
          turnId: "turn:recovery",
          callId: "call:counterexample:recovery",
          tool: "record_counterexample",
          arguments: { reason: "The retained predicates differ." },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:recovery",
          tokenUsage: { last: { inputTokens: 50, outputTokens: 12, reasoningOutputTokens: 5 } },
        },
      },
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:recovery",
            status: "completed",
            items: [{ type: "agentMessage", text: "Counterexample retained." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:recovery",
          tokenUsage: { last: { inputTokens: 30, outputTokens: 5, reasoningOutputTokens: 1 } },
        },
      },
    ]);

    const result = await executePreparedAgentRun({
      run: work.run,
      task: work.task,
      taskPayload: work.payload,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: work.profile,
      adapter: work.adapter,
      credentialBroker: work.broker,
      toolHost: work.toolHost,
    });

    expect(result.run.status).toBe("SUCCEEDED");
    expect(result.modelInvocations).toHaveLength(2);
    expect(result.toolEffects).toEqual([expect.objectContaining({
      toolName: "record_counterexample",
      status: "ACCEPTED",
    })]);
    expect(work.connection.requests.filter((item) => item.method === "turn/start"))
      .toHaveLength(2);
    expect(work.connection.requests[2]).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread:test",
        input: [{ text: expect.stringContaining("Call exactly one declared result tool") }],
      },
    });
    expect(work.connection.closed).toBe(true);
  });

  it("fails closed after a second diagnostic-only completion", async () => {
    const work = fixture([
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:test",
            status: "completed",
            items: [{ type: "agentMessage", text: "I found no safe conclusion." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          tokenUsage: { last: { inputTokens: 40, outputTokens: 10, reasoningOutputTokens: 4 } },
        },
      },
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:recovery",
            status: "completed",
            items: [{ type: "agentMessage", text: "I still found no safe conclusion." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:recovery",
          tokenUsage: { last: { inputTokens: 44, outputTokens: 11, reasoningOutputTokens: 5 } },
        },
      },
    ]);

    const result = await executePreparedAgentRun({
      run: work.run,
      task: work.task,
      taskPayload: work.payload,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: work.profile,
      adapter: work.adapter,
      credentialBroker: work.broker,
      toolHost: work.toolHost,
    });

    expect(result.run).toMatchObject({
      status: "FAILED",
      terminalDiagnostic: "runtime completed without an accepted result effect",
    });
    expect(result.modelInvocations).toHaveLength(2);
    expect(result.toolEffects).toHaveLength(0);
    expect(work.connection.requests.filter((item) => item.method === "turn/start"))
      .toHaveLength(2);
    expect(work.connection.closed).toBe(true);
  });

  it("does not treat diagnostic final text as success after a rejected result tool", async () => {
    const work = fixture([
      {
        method: "item/tool/call",
        id: 202,
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          callId: "call:counterexample:rejected",
          tool: "record_counterexample",
          arguments: { reason: "Insufficient retained evidence." },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          tokenUsage: { last: { inputTokens: 40, outputTokens: 10, reasoningOutputTokens: 4 } },
        },
      },
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:test",
            status: "completed",
            items: [{ type: "agentMessage", text: "I could not retain the result." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:test",
          tokenUsage: { last: { inputTokens: 20, outputTokens: 5, reasoningOutputTokens: 2 } },
        },
      },
      {
        method: "turn/completed",
        params: {
          threadId: "thread:test",
          turn: {
            id: "turn:recovery",
            status: "completed",
            items: [{ type: "agentMessage", text: "I still could not retain the result." }],
          },
        },
      },
      {
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread:test",
          turnId: "turn:recovery",
          tokenUsage: { last: { inputTokens: 22, outputTokens: 6, reasoningOutputTokens: 2 } },
        },
      },
    ]);
    const rejectedHost: AgentToolHost = {
      ...work.toolHost,
      execute: async () => Object.freeze({
        status: "REJECTED" as const,
        output: Object.freeze({
          diagnostic: "reason must quote the retained source text",
        }),
      }),
    };

    const result = await executePreparedAgentRun({
      run: work.run,
      task: work.task,
      taskPayload: work.payload,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: work.profile,
      adapter: work.adapter,
      credentialBroker: work.broker,
      toolHost: rejectedHost,
    });

    expect(result.run).toMatchObject({
      status: "FAILED",
      terminalDiagnostic: "runtime completed without an accepted result effect",
    });
    expect(result.toolEffects).toEqual([
      expect.objectContaining({
        schemaVersion: "pmh.agent-tool-effect.v2",
        status: "REJECTED",
        diagnostic: "reason must quote the retained source text",
      }),
    ]);
    expect(result.runArtifacts).toHaveLength(0);
  });
});
