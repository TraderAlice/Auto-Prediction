import { describe, expect, it } from "vitest";
import {
  CodexAppServerAgentPort,
  codexCredentialForTest,
  createCodexDiscoveryRuntime,
  ModelRequestFailure,
  type AiUsageRecorder,
  type CodexAppServerConnection,
  type CodexAppServerInbound,
  type CodexAppServerRequestId,
  type DiscoveryTask,
} from "../src/index.js";
import { agentTask, proposalInput, TEST_LISTING_REFS } from "./model-agent-fixtures.js";

const THREAD_ID = "thread:discovery";
const TURN_ID = "turn:discovery";
const SYSTEM = "Propose market-search hypotheses only.";

class FakeConnection implements CodexAppServerConnection {
  public readonly requests: Array<Readonly<{ method: string; params: unknown }>> = [];
  public readonly responses: Array<Readonly<{
    id: CodexAppServerRequestId;
    result: Readonly<Record<string, unknown>>;
  }>> = [];
  public readonly inboundTimeouts: number[] = [];
  public closed = false;
  public inboundFailure: Error | null = null;
  readonly #events: CodexAppServerInbound[];

  public constructor(events: readonly CodexAppServerInbound[]) {
    this.#events = [...events];
  }

  public async request(method: string, params: unknown): Promise<unknown> {
    this.requests.push(Object.freeze({ method, params }));
    if (method === "thread/start") return { thread: { id: THREAD_ID } };
    if (method === "turn/start") return { turn: { id: TURN_ID } };
    if (method === "turn/interrupt") return {};
    throw new Error(`unexpected fake request: ${method}`);
  }

  public notify(): void {}

  public respond(id: CodexAppServerRequestId, result: unknown): void {
    this.responses.push(Object.freeze({
      id,
      result: result as Readonly<Record<string, unknown>>,
    }));
  }

  public async nextInbound(timeoutMs?: number): Promise<CodexAppServerInbound> {
    if (timeoutMs !== undefined) this.inboundTimeouts.push(timeoutMs);
    if (this.inboundFailure !== null) throw this.inboundFailure;
    const next = this.#events.shift();
    if (next === undefined) throw new Error("fake Codex app-server event queue is empty");
    return next;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

function toolCall(
  id: number,
  tool: string,
  args: unknown,
  ids: Readonly<{ threadId?: string; turnId?: string }> = {},
): CodexAppServerInbound {
  return Object.freeze({
    method: "item/tool/call",
    id,
    params: {
      threadId: ids.threadId ?? THREAD_ID,
      turnId: ids.turnId ?? TURN_ID,
      callId: `call-${id}`,
      tool,
      arguments: args,
    },
  });
}

function usage(inputTokens: number, outputTokens: number): CodexAppServerInbound {
  return Object.freeze({
    method: "thread/tokenUsage/updated",
    params: {
      threadId: THREAD_ID,
      turnId: TURN_ID,
      tokenUsage: { last: { inputTokens, outputTokens, reasoningOutputTokens: 1 } },
    },
  });
}

function turnCompleted(status = "completed"): CodexAppServerInbound {
  return Object.freeze({
    method: "turn/completed",
    params: { threadId: THREAD_ID, turn: { id: TURN_ID, status, items: [] } },
  });
}

function errorNotification(
  message: string,
  willRetry: boolean,
  code: number | string = "unknown",
): CodexAppServerInbound {
  return Object.freeze({
    method: "error",
    params: { threadId: THREAD_ID, turnId: TURN_ID, willRetry, error: { code, message } },
  });
}

function respondedResult(connection: FakeConnection, ordinal: number): Record<string, unknown> {
  const response = connection.responses[ordinal];
  const items = response?.result.contentItems as readonly { text: string }[];
  return JSON.parse(items[0]!.text) as Record<string, unknown>;
}

function recorder() {
  const events: Array<Parameters<AiUsageRecorder["record"]>[0]> = [];
  const usageRecorder: AiUsageRecorder = {
    record(event) {
      events.push(event);
    },
  } as AiUsageRecorder;
  return { events, usageRecorder };
}

function port(
  connection: FakeConnection,
  options: Readonly<{
    effort?: "medium" | "high";
    timeoutMs?: number;
    maxSteps?: number;
    maxToolCalls?: number;
    usageRecorder?: AiUsageRecorder;
  }> = {},
): CodexAppServerAgentPort {
  return new CodexAppServerAgentPort(
    "gpt-5.6-terra",
    options.effort ?? "medium",
    async () => connection,
    options.timeoutMs ?? 3_000,
    options.maxSteps ?? 8,
    options.maxToolCalls ?? 24,
    options.usageRecorder,
  );
}

function runInput(task: DiscoveryTask = agentTask, searchLens?: string) {
  return {
    workerId: "model-fast-lane",
    model: "gpt-5.6-terra",
    system: SYSTEM,
    ...(searchLens === undefined ? {} : { searchLens }),
    task,
  };
}

async function failureOf(promise: Promise<unknown>): Promise<ModelRequestFailure> {
  try {
    await promise;
  } catch (error) {
    if (ModelRequestFailure.isInstance(error)) return error;
    throw error;
  }
  throw new Error("expected the run to fail");
}

const HAPPY_PATH = Object.freeze([
  toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
  usage(100, 10),
  toolCall(2, "record_hypothesis", proposalInput()),
  usage(120, 20),
  toolCall(3, "complete_search", { reason: "Grounded lead recorded." }),
  usage(130, 5),
]);

describe("Codex app-server discovery agent port", () => {
  it("drives the bounded tool loop through app-server dynamic tools", async () => {
    const connection = new FakeConnection(HAPPY_PATH);
    const { events, usageRecorder } = recorder();

    const result = await port(connection, { effort: "high", usageRecorder })
      .run(runInput(agentTask, "EQUIVALENCE"));

    expect(result.hypotheses).toHaveLength(1);
    expect(result.trace).toMatchObject({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 3,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
      executionAuthority: false,
    });
    const threadStart = connection.requests.find((item) => item.method === "thread/start");
    expect(threadStart?.params).toMatchObject({
      model: "gpt-5.6-terra",
      approvalPolicy: "never",
      sandbox: "read-only",
      ephemeral: true,
      allowProviderModelFallback: false,
    });
    const threadParams = threadStart?.params as Readonly<{
      developerInstructions: string;
      dynamicTools: readonly Readonly<{ name: string; type: string }>[];
    }>;
    expect(threadParams.developerInstructions).toContain("bounded tool loop");
    expect(threadParams.developerInstructions).toContain("Search lens: EQUIVALENCE");
    expect(threadParams.dynamicTools.map((tool) => tool.name)).toEqual([
      "search_catalog",
      "inspect_listings",
      "record_hypothesis",
      "record_falsification",
      "record_inspiration",
      "complete_search",
    ]);
    expect(threadParams.dynamicTools.every((tool) => tool.type === "function")).toBe(true);
    const turnStart = connection.requests.find((item) => item.method === "turn/start");
    expect(turnStart?.params).toMatchObject({
      threadId: THREAD_ID,
      model: "gpt-5.6-terra",
      effort: "high",
      approvalPolicy: "never",
    });
    const prompt = (turnStart?.params as Readonly<{ input: readonly { text: string }[] }>)
      .input[0]!.text;
    expect(JSON.parse(prompt)).toMatchObject({
      protocol: "PMH_BOUNDED_TOOL_LOOP_V1",
      taskId: agentTask.taskId,
      budgets: { maxSteps: 8, maxToolCalls: 24 },
    });
    expect(connection.responses.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(respondedResult(connection, 0)).toMatchObject({ status: "ACCEPTED" });
    expect(respondedResult(connection, 1)).toMatchObject({ status: "ACCEPTED" });
    expect(respondedResult(connection, 2)).toMatchObject({
      status: "ACCEPTED",
      reason: "SEARCH_COMPLETED",
    });
    expect(connection.requests.some((item) => item.method === "turn/interrupt")).toBe(true);
    expect(connection.closed).toBe(true);
    expect(connection.inboundTimeouts.every((value) => value >= 1 && value <= 3_000)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      purpose: "DISCOVERY_FAST",
      role: "EQUIVALENCE",
      provider: "CODEX",
      model: "gpt-5.6-terra",
      transport: "AGENT_RUNTIME",
      outcome: "SUCCEEDED",
      durableEffect: true,
      providerRequestCount: 3,
      usage: { inputTokens: 350, outputTokens: 35, totalTokens: 385 },
    });
  });

  it("retains calls outside the legal surface as rejected session effects", async () => {
    const connection = new FakeConnection([
      toolCall(1, "record_hypothesis", proposalInput()),
      usage(50, 5),
      toolCall(2, "not_a_discovery_tool", { anything: true }),
      usage(55, 5),
      toolCall(3, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(60, 5),
      toolCall(4, "record_hypothesis", proposalInput()),
      usage(70, 5),
      toolCall(5, "complete_search", { reason: "Done." }),
      usage(80, 5),
    ]);

    const result = await port(connection).run(runInput());

    expect(respondedResult(connection, 0)).toMatchObject({
      status: "REJECTED",
      reason: "PROTOCOL_INVALID",
      guidance: expect.stringContaining("search_catalog, inspect_listings"),
    });
    expect(respondedResult(connection, 1)).toMatchObject({
      status: "REJECTED",
      reason: "PROTOCOL_INVALID",
    });
    expect(result.trace).toMatchObject({
      toolCallCount: 5,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    // Every call, legal or not, is a retained effect that consumed budget.
    expect(result.trace.effects).toHaveLength(5);
    expect(result.trace.effects.map((effect) => [effect.toolName, effect.status])).toEqual([
      ["record_hypothesis", "REJECTED"],
      ["unknown_tool", "REJECTED"],
      ["inspect_listings", "ACCEPTED"],
      ["record_hypothesis", "ACCEPTED"],
      ["complete_search", "ACCEPTED"],
    ]);
  });

  it("settles a batched dynamic call before the next one arrives", async () => {
    const connection = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      toolCall(2, "record_hypothesis", proposalInput()),
      usage(100, 10),
      toolCall(3, "complete_search", { reason: "Done." }),
      usage(100, 10),
    ]);

    const result = await port(connection).run(runInput());

    expect(connection.responses.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(respondedResult(connection, 1)).toMatchObject({ status: "ACCEPTED" });
    expect(result.trace).toMatchObject({
      stepCount: 2,
      toolCallCount: 3,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
    });
  });

  it("finishes as MODEL_FINISHED when the turn completes without a tool call", async () => {
    const connection = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(100, 10),
      usage(90, 30),
      turnCompleted(),
    ]);

    const result = await port(connection).run(runInput());

    expect(result.trace).toMatchObject({
      stepCount: 2,
      providerRequestAttemptCount: 2,
      toolCallCount: 1,
      terminationReason: "MODEL_FINISHED",
    });
    expect(connection.requests.some((item) => item.method === "turn/interrupt")).toBe(false);
    expect(connection.closed).toBe(true);
  });

  it("returns an empty result when the model only writes text", async () => {
    const connection = new FakeConnection([usage(40, 20), turnCompleted()]);

    const result = await port(connection).run(runInput());

    expect(result.hypotheses).toHaveLength(0);
    expect(result.trace).toMatchObject({
      stepCount: 1,
      toolCallCount: 0,
      terminationReason: "MODEL_FINISHED",
    });
    expect(connection.responses).toHaveLength(0);
  });

  it("drops a call the server abandoned with its completed turn", async () => {
    const connection = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(100, 10),
      toolCall(2, "record_hypothesis", proposalInput()),
      turnCompleted(),
    ]);

    const result = await port(connection).run(runInput());

    expect(connection.responses.map((item) => item.id)).toEqual([1]);
    expect(result.trace).toMatchObject({
      toolCallCount: 1,
      acceptedProposalCount: 0,
      terminationReason: "MODEL_FINISHED",
    });
  });

  it("labels the step, tool-call, and proposal budgets like the AI SDK loop", async () => {
    const stepLimited = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(10, 1),
      toolCall(2, "record_falsification", { claim: "x" }),
      usage(10, 1),
    ]);
    await expect(port(stepLimited, { maxSteps: 2 }).run(runInput()))
      .resolves.toMatchObject({ trace: { stepCount: 2, terminationReason: "STEP_LIMIT" } });
    expect(stepLimited.requests.some((item) => item.method === "turn/interrupt")).toBe(true);

    const toolLimited = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(10, 1),
      toolCall(2, "record_falsification", { claim: "x" }),
      usage(10, 1),
    ]);
    await expect(port(toolLimited, { maxToolCalls: 2 }).run(runInput()))
      .resolves.toMatchObject({ trace: { toolCallCount: 2, terminationReason: "TOOL_CALL_LIMIT" } });

    const proposalLimited = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(10, 1),
      toolCall(2, "record_hypothesis", proposalInput()),
      usage(10, 1),
    ]);
    await expect(port(proposalLimited).run(runInput({ ...agentTask, maxHypotheses: 1 })))
      .resolves.toMatchObject({
        trace: { acceptedProposalCount: 1, terminationReason: "PROPOSAL_LIMIT" },
      });
  });

  it("fails closed with a retained partial trace on an unclassified transport error", async () => {
    // The fake queue drains after the first usage boundary; the next wait
    // throws a plain error that is neither a timeout nor a loop failure.
    const connection = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(100, 10),
    ]);
    const { events, usageRecorder } = recorder();

    const failure = await failureOf(port(connection, { usageRecorder }).run(runInput()));

    expect(failure.provider).toBe("CODEX");
    expect(failure.category).toBe("NETWORK_OR_UNKNOWN");
    expect(failure.agentTrace).toMatchObject({
      toolCallCount: 1,
      terminationReason: "PROVIDER_FAILURE",
    });
    expect(events[0]).toMatchObject({ outcome: "FAILED", durableEffect: false });
    expect(connection.requests.some((item) => item.method === "turn/interrupt")).toBe(true);
    expect(connection.closed).toBe(true);
  });

  it("classifies an app-server wait timeout as TIMEOUT or TASK_DEADLINE", async () => {
    const quiet = new FakeConnection([]);
    quiet.inboundFailure = new Error("Codex app-server event wait timed out");
    await expect(port(quiet).run(runInput()))
      .rejects.toMatchObject({ provider: "CODEX", category: "TIMEOUT" });

    const deadlineBound = new FakeConnection([]);
    deadlineBound.inboundFailure = new Error("Codex app-server event wait timed out");
    const nearDeadline = { ...agentTask, deadlineEpochMs: Date.now() + 1_500 };
    const failure = await failureOf(port(deadlineBound).run(runInput(nearDeadline)));
    expect(failure.category).toBe("TASK_DEADLINE");
    expect(failure.agentTrace?.terminationReason).toBe("TASK_DEADLINE");

    const expired = { ...agentTask, deadlineEpochMs: Date.now() - 1 };
    const untouched = new FakeConnection([]);
    await expect(port(untouched).run(runInput(expired)))
      .rejects.toMatchObject({ category: "TASK_DEADLINE", requestAttemptCount: 0 });
    expect(untouched.requests).toHaveLength(0);
  });

  it("tolerates retrying error notifications and fails closed on terminal ones", async () => {
    const retried = new FakeConnection([
      errorNotification("Reconnecting... 1/5", true),
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }),
      usage(10, 1),
      usage(10, 1),
      turnCompleted(),
    ]);
    await expect(port(retried).run(runInput()))
      .resolves.toMatchObject({ trace: { toolCallCount: 1, terminationReason: "MODEL_FINISHED" } });

    const rejected = new FakeConnection([
      errorNotification("Unauthorized: token rejected (HTTP 403)", false, 403),
    ]);
    const rejection = await failureOf(port(rejected).run(runInput()));
    expect(rejection.category).toBe("REJECTED_PROVIDER");
    expect(rejection.agentTrace?.terminationReason).toBe("PROVIDER_FAILURE");

    const transient = new FakeConnection([errorNotification("upstream hiccup", false, 500)]);
    await expect(port(transient).run(runInput()))
      .rejects.toMatchObject({ category: "RETRYABLE_PROVIDER" });

    const failedTurn = new FakeConnection([turnCompleted("failed")]);
    await expect(port(failedTurn).run(runInput()))
      .rejects.toMatchObject({ category: "RETRYABLE_PROVIDER" });
    expect(failedTurn.requests.some((item) => item.method === "turn/interrupt")).toBe(true);
  });

  it("fails closed on protocol violations and undeclared built-in effects", async () => {
    const builtIn = new FakeConnection([
      Object.freeze({
        method: "item/started",
        params: { threadId: THREAD_ID, turnId: TURN_ID, item: { type: "commandExecution" } },
      }),
    ]);
    await expect(port(builtIn).run(runInput()))
      .rejects.toMatchObject({ provider: "CODEX", category: "INVALID_MODEL_OUTPUT" });
    expect(builtIn.closed).toBe(true);

    const foreignThread = new FakeConnection([
      toolCall(1, "inspect_listings", { listingRefs: TEST_LISTING_REFS }, {
        threadId: "thread:other",
      }),
    ]);
    await expect(port(foreignThread).run(runInput()))
      .rejects.toMatchObject({ category: "INVALID_PROVIDER_OUTPUT" });
    expect(foreignThread.responses).toHaveLength(0);

    const undeclaredRequest = new FakeConnection([
      Object.freeze({ method: "item/approval/request", id: 9, params: { threadId: THREAD_ID } }),
    ]);
    await expect(port(undeclaredRequest).run(runInput()))
      .rejects.toMatchObject({ category: "INVALID_PROVIDER_OUTPUT" });
    expect(undeclaredRequest.responses).toHaveLength(0);
  });

  it("refuses a worker whose declared model differs from the port", async () => {
    const connection = new FakeConnection([]);
    await expect(port(connection).run({ ...runInput(), model: "gpt-5.6-luna" }))
      .rejects.toThrow(/model does not match/u);
    expect(connection.requests).toHaveLength(0);
  });

  it("is the default Codex discovery transport and publishes it without the credential", async () => {
    const secret = "test-only-codex-oauth-token";
    const connection = new FakeConnection(HAPPY_PATH);
    const runtime = createCodexDiscoveryRuntime({}, {
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      credentialProvider: codexCredentialForTest(secret, "account-test-only"),
      appServerConnectionFactory: async () => connection,
    });
    expect(runtime.projection).toMatchObject({
      provider: "CODEX_RESPONSES",
      transport: "CODEX_APP_SERVER",
      configured: true,
      credentialEnv: "CODEX_OAUTH",
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      authority: "PROPOSE_ONLY",
    });
    expect(JSON.stringify(runtime)).not.toContain(secret);
    const result = await runtime.worker!.runWithTrace(agentTask);
    expect(result.trace).toMatchObject({
      toolCallCount: 3,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    expect(JSON.stringify(connection.requests)).not.toContain(secret);
  });

  it("keeps the direct Responses transport as an explicit opt-in", () => {
    expect(createCodexDiscoveryRuntime({ PMH_CODEX_DISCOVERY_TRANSPORT: "responses" }, {
      model: "gpt-5.6-luna",
      reasoningEffort: "low",
      credentialProvider: codexCredentialForTest("secret", "account-test-only"),
    }).projection.transport).toBe("VERCEL_AI_SDK");
    expect(() => createCodexDiscoveryRuntime({ PMH_CODEX_DISCOVERY_TRANSPORT: "sockets" }, {
      model: "gpt-5.6-luna",
      reasoningEffort: "low",
    })).toThrow(/PMH_CODEX_DISCOVERY_TRANSPORT/u);
  });
});
