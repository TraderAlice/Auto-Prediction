import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import {
  activeDiscoveryToolNames,
  DEFAULT_DISCOVERY_AGENT_MAX_STEPS,
  DEFAULT_DISCOVERY_AGENT_MAX_TOOL_CALLS,
  DISCOVERY_AGENT_TOOL_MANIFEST,
  DiscoveryAgentSession,
  discoveryAgentInstructions,
  discoveryAgentPrompt,
  discoveryLoopShouldStop,
  discoveryTerminationReason,
  discoveryToolJsonSchema,
  discoveryUsageRole,
  executeDiscoveryTool,
  MAX_DISCOVERY_AGENT_MAX_STEPS,
  MAX_DISCOVERY_AGENT_MAX_TOOL_CALLS,
  type DiscoveryLoopBudget,
} from "./discovery-agent.js";
import { ModelRequestFailure, type ModelFailureCategory } from "./model-failure.js";
import type { AiUsageRecorder } from "./ai-usage-ledger.js";
import type {
  CodexReasoningEffort,
  CodexRuntimeModel,
} from "./ai-runtime-configuration.js";
import type {
  CodexAppServerConnection,
  CodexAppServerConnectionFactory,
  CodexAppServerRequestId,
} from "./codex-app-server-transport.js";
import type {
  DiscoveryAgentPort,
  DiscoveryAgentRunResult,
  DiscoveryAgentTerminationReason,
  DiscoveryTask,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 300_000;
const INTERRUPT_TIMEOUT_MS = 2_000;
const MAX_DIAGNOSTIC_CHARACTERS = 500;

/**
 * Built-in Codex effects that the discovery loop never authorizes. The thread
 * is opened read-only and ephemeral, and the developer instructions forbid
 * them, but a model attempt still fails the run closed instead of being
 * silently tolerated.
 */
const UNDECLARED_ITEM_TYPES = new Set([
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "collabAgentToolCall",
  "subAgentActivity",
  "webSearch",
  "imageView",
  "sleep",
  "imageGeneration",
]);

type TokenTotals = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
};

type PendingToolCall = Readonly<{
  requestId: CodexAppServerRequestId;
  callId: string;
  toolName: string;
  input: unknown;
}>;

class DiscoveryLoopFailure extends Error {
  public constructor(
    public readonly category: ModelFailureCategory,
    public readonly terminationReason: DiscoveryAgentTerminationReason,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message, options);
    this.name = "DiscoveryLoopFailure";
  }
}

function object(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscoveryLoopFailure(
      "INVALID_PROVIDER_OUTPUT",
      "PROTOCOL_FAILURE",
      `${name} is malformed`,
    );
  }
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DiscoveryLoopFailure(
      "INVALID_PROVIDER_OUTPUT",
      "PROTOCOL_FAILURE",
      `${name} is malformed`,
    );
  }
  return value;
}

function countedTokens(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function addTokens(current: number | null, observed: number | null): number | null {
  if (observed === null) return current;
  return (current ?? 0) + observed;
}

function boundedErrorNotification(params: Readonly<Record<string, unknown>>): string {
  const candidate = params.error !== null && typeof params.error === "object" &&
      !Array.isArray(params.error)
    ? params.error as Readonly<Record<string, unknown>>
    : params;
  const code = typeof candidate.code === "number" || typeof candidate.code === "string"
    ? String(candidate.code).slice(0, 80)
    : "unknown";
  const message = typeof candidate.message === "string"
    ? candidate.message.replace(/\s+/gu, " ").trim().slice(0, 350)
    : "no diagnostic message";
  return `code=${code}; message=${message}`.slice(0, MAX_DIAGNOSTIC_CHARACTERS);
}

function providerFailureCategory(diagnostic: string): ModelFailureCategory {
  return /\b(401|403|451|unauthori[sz]ed|forbidden)\b/iu.test(diagnostic)
    ? "REJECTED_PROVIDER"
    : "RETRYABLE_PROVIDER";
}

/**
 * Runs the bounded discovery tool loop through a local `codex app-server`
 * process instead of calling the Codex Responses endpoint directly. The
 * app-server is the sanctioned first-party OAuth client, so the ChatGPT
 * subscription credential is accepted there while direct transports with a
 * third-party originator are rejected. The loop contract, tool surface, and
 * effect authority are shared with the AI SDK transport through
 * `DiscoveryAgentSession`; only the model transport differs.
 */
export class CodexAppServerAgentPort implements DiscoveryAgentPort {
  public constructor(
    private readonly model: CodexRuntimeModel,
    private readonly reasoningEffort: CodexReasoningEffort,
    private readonly connectionFactory: CodexAppServerConnectionFactory,
    public readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    public readonly maxSteps = DEFAULT_DISCOVERY_AGENT_MAX_STEPS,
    public readonly maxToolCalls = DEFAULT_DISCOVERY_AGENT_MAX_TOOL_CALLS,
    private readonly usageRecorder?: AiUsageRecorder,
  ) {
    if (
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS ||
      !Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      maxSteps > MAX_DISCOVERY_AGENT_MAX_STEPS ||
      !Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1 ||
      maxToolCalls > MAX_DISCOVERY_AGENT_MAX_TOOL_CALLS
    ) {
      throw new Error("Codex app-server agent loop configuration is invalid or unbounded");
    }
  }

  public async run(input: {
    workerId: string;
    model: string;
    system: string;
    searchLens?: string;
    task: DiscoveryTask;
  }): Promise<DiscoveryAgentRunResult> {
    if (input.model !== this.model) {
      throw new Error("Codex app-server discovery worker model does not match its port");
    }
    const remainingMs = input.task.deadlineEpochMs - Date.now();
    if (remainingMs <= 0) {
      throw new ModelRequestFailure("CODEX", "TASK_DEADLINE", 0);
    }
    const totalTimeoutMs = Math.min(this.timeoutMs, remainingMs);
    const deadlineBound = remainingMs <= this.timeoutMs;
    const startedAtMs = Date.now();
    const deadlineAtMs = startedAtMs + totalTimeoutMs;
    const session = new DiscoveryAgentSession(
      input.workerId,
      input.task,
      this.maxToolCalls,
    );
    const totals: TokenTotals = { inputTokens: null, outputTokens: null, reasoningTokens: null };
    // A step is one model response that carried a tool call or ended the turn,
    // matching the AI SDK loop where every step is a required tool call. The
    // app-server also reports usage for commentary-only responses; those count
    // as provider requests but do not consume the step budget.
    let stepCount = 0;
    let responseCount = 0;
    let toolCallCount = 0;
    let terminationReason: DiscoveryAgentTerminationReason | null = null;
    let threadId: string | null = null;
    let turnId: string | null = null;
    let turnSettled = false;
    let pending: PendingToolCall | null = null;
    let connection: CodexAppServerConnection | null = null;
    let directory: string | null = null;
    const remaining = () => Math.max(1, deadlineAtMs - Date.now());
    const budget = (): DiscoveryLoopBudget => Object.freeze({
      session,
      task: input.task,
      stepCount,
      maxSteps: this.maxSteps,
      maxToolCalls: this.maxToolCalls,
    });
    const respondToPending = async (): Promise<void> => {
      if (pending === null || connection === null) return;
      const call = pending;
      pending = null;
      toolCallCount += 1;
      const surface = activeDiscoveryToolNames(session, input.task);
      // Calls outside the legal surface are still session effects: they consume
      // the bounded budget and stay in the durable trace as protocol evidence.
      const result = (surface.activeTools as readonly string[]).includes(call.toolName)
        ? executeDiscoveryTool(session, call.toolName, call.input)
        : session.rejectOutsideSurface(call.toolName, call.input, surface.activeTools);
      connection.respond(call.requestId, {
        contentItems: [{ type: "inputText", text: JSON.stringify(result) }],
        success: true,
      });
    };
    const recordUsage = (
      outcome: "SUCCEEDED" | "TIMED_OUT" | "FAILED",
      durableEffect: boolean,
    ): void => {
      this.usageRecorder?.record({
        durationMs: Math.max(0, Date.now() - startedAtMs),
        purpose: "DISCOVERY_FAST",
        role: discoveryUsageRole(input.workerId),
        provider: "CODEX",
        model: this.model,
        transport: "AGENT_RUNTIME",
        operationIdentity: hashCanonical({
          schemaVersion: "pmh.ai-usage-operation.v1",
          taskId: input.task.taskId,
        }),
        outcome,
        durableEffect,
        providerRequestCount: responseCount,
        usage: totals.inputTokens === null && totals.outputTokens === null
          ? null
          : {
              ...(totals.inputTokens === null ? {} : { inputTokens: totals.inputTokens }),
              ...(totals.outputTokens === null ? {} : { outputTokens: totals.outputTokens }),
              ...(totals.inputTokens === null || totals.outputTokens === null
                ? {}
                : { totalTokens: totals.inputTokens + totals.outputTokens }),
              ...(totals.reasoningTokens === null
                ? {}
                : { outputTokenDetails: { reasoningTokens: totals.reasoningTokens } }),
            },
      });
    };
    try {
      directory = await mkdtemp(join(tmpdir(), "pmh-codex-discovery-"));
      connection = await this.connectionFactory();
      const thread = object(
        object(await connection.request("thread/start", {
          model: this.model,
          allowProviderModelFallback: false,
          cwd: directory,
          runtimeWorkspaceRoots: [directory],
          approvalPolicy: "never",
          sandbox: "read-only",
          ephemeral: true,
          environments: [],
          developerInstructions: [
            discoveryAgentInstructions(input.system, input.searchLens),
            "Only the client-hosted dynamic tools declared on this thread are authorized.",
            "Never use built-in shell, file, MCP, web, image, subagent, or waiting tools.",
          ].join(" "),
          dynamicTools: DISCOVERY_AGENT_TOOL_MANIFEST.map((definition) => ({
            type: "function",
            name: definition.name,
            description: definition.description,
            inputSchema: discoveryToolJsonSchema(definition),
          })),
        }, remaining()), "Codex app-server thread response").thread,
        "Codex app-server thread",
      );
      threadId = text(thread.id, "Codex app-server thread ID");
      const turn = object(
        object(await connection.request("turn/start", {
          threadId,
          input: [{
            type: "text",
            text: discoveryAgentPrompt({
              task: input.task,
              session,
              maxSteps: this.maxSteps,
              maxToolCalls: this.maxToolCalls,
              totalTimeoutMs,
            }),
            text_elements: [],
          }],
          model: this.model,
          effort: this.reasoningEffort,
          approvalPolicy: "never",
          environments: [],
        }, remaining()), "Codex app-server turn response").turn,
        "Codex app-server turn",
      );
      turnId = text(turn.id, "Codex app-server turn ID");
      while (terminationReason === null) {
        const inbound = await connection.nextInbound(remaining());
        const params: Readonly<Record<string, unknown>> = inbound.params === undefined
          ? Object.freeze({})
          : object(inbound.params, "Codex app-server event params");
        if (typeof params.threadId === "string" && params.threadId !== threadId) {
          throw new DiscoveryLoopFailure(
            "INVALID_PROVIDER_OUTPUT",
            "PROTOCOL_FAILURE",
            "Codex app-server thread identity changed",
          );
        }
        if (typeof params.turnId === "string" && params.turnId !== turnId) {
          throw new DiscoveryLoopFailure(
            "INVALID_PROVIDER_OUTPUT",
            "PROTOCOL_FAILURE",
            "Codex app-server turn identity changed",
          );
        }
        if (inbound.method === "item/tool/call") {
          if (inbound.id === undefined) {
            throw new DiscoveryLoopFailure(
              "INVALID_PROVIDER_OUTPUT",
              "PROTOCOL_FAILURE",
              "Codex app-server dynamic tool request has no request ID",
            );
          }
          // A second dynamic call before the usage boundary means the model
          // batched tool calls; settle the earlier one so no request starves.
          await respondToPending();
          pending = Object.freeze({
            requestId: inbound.id,
            callId: text(params.callId, "Codex app-server tool call ID"),
            toolName: text(params.tool, "Codex app-server tool name"),
            input: params.arguments,
          });
          continue;
        }
        if (inbound.method === "thread/tokenUsage/updated") {
          const tokenUsage = params.tokenUsage;
          if (tokenUsage !== null && typeof tokenUsage === "object" && !Array.isArray(tokenUsage)) {
            const last = (tokenUsage as Readonly<Record<string, unknown>>).last;
            if (last !== null && typeof last === "object" && !Array.isArray(last)) {
              const breakdown = last as Readonly<Record<string, unknown>>;
              totals.inputTokens = addTokens(totals.inputTokens, countedTokens(breakdown.inputTokens));
              totals.outputTokens = addTokens(totals.outputTokens, countedTokens(breakdown.outputTokens));
              totals.reasoningTokens = addTokens(
                totals.reasoningTokens,
                countedTokens(breakdown.reasoningOutputTokens),
              );
            }
          }
          responseCount += 1;
          if (pending !== null) {
            stepCount += 1;
            await respondToPending();
          }
          if (discoveryLoopShouldStop(budget())) {
            terminationReason = discoveryTerminationReason(budget());
          }
          continue;
        }
        if (inbound.method === "item/started" || inbound.method === "item/completed") {
          const item = object(params.item, "Codex app-server item");
          if (UNDECLARED_ITEM_TYPES.has(String(item.type))) {
            throw new DiscoveryLoopFailure(
              "INVALID_MODEL_OUTPUT",
              "PROTOCOL_FAILURE",
              "Codex app-server attempted a built-in effect outside the discovery tool manifest",
            );
          }
          continue;
        }
        if (inbound.method === "turn/completed") {
          const completedTurn = object(params.turn, "Codex app-server completed turn");
          if (text(completedTurn.id, "Codex app-server completed turn ID") !== turnId) {
            throw new DiscoveryLoopFailure(
              "INVALID_PROVIDER_OUTPUT",
              "PROTOCOL_FAILURE",
              "Codex app-server completed turn identity changed",
            );
          }
          const status = String(completedTurn.status);
          if (status !== "completed" && status !== "interrupted") {
            throw new DiscoveryLoopFailure(
              "RETRYABLE_PROVIDER",
              "PROVIDER_FAILURE",
              `Codex app-server turn did not complete (status=${status.slice(0, 40)})`,
            );
          }
          turnSettled = true;
          // A call still pending here was abandoned by the server together
          // with its turn: its result could never reach the model, so it is
          // dropped rather than executed as a session effect.
          pending = null;
          stepCount += 1;
          terminationReason = discoveryTerminationReason(budget());
          continue;
        }
        if (inbound.method === "error") {
          if (params.willRetry === true) continue;
          const diagnostic = boundedErrorNotification(params);
          throw new DiscoveryLoopFailure(
            providerFailureCategory(diagnostic),
            "PROVIDER_FAILURE",
            `Codex app-server emitted an error notification: ${diagnostic}`,
          );
        }
        if (inbound.id !== undefined) {
          throw new DiscoveryLoopFailure(
            "INVALID_PROVIDER_OUTPUT",
            "PROTOCOL_FAILURE",
            `Codex app-server requested an undeclared method: ${inbound.method.slice(0, 80)}`,
          );
        }
      }
      recordUsage(
        "SUCCEEDED",
        session.acceptedProposalCount > 0 ||
          session.acceptedFalsificationCount > 0 ||
          session.acceptedInspirationCount > 0,
      );
      return session.finish({
        stepCount,
        providerRequestAttemptCount: responseCount,
        toolCallCount,
        terminationReason,
      });
    } catch (error) {
      const timedOut = error instanceof Error && /timed out/iu.test(error.message) &&
        !(error instanceof DiscoveryLoopFailure);
      const failure: Readonly<{
        category: ModelFailureCategory;
        terminationReason: DiscoveryAgentTerminationReason;
      }> = timedOut
        ? Object.freeze({
            category: deadlineBound ? "TASK_DEADLINE" as const : "TIMEOUT" as const,
            terminationReason: deadlineBound ? "TASK_DEADLINE" as const : "TIMEOUT" as const,
          })
        : error instanceof DiscoveryLoopFailure
          ? Object.freeze({ category: error.category, terminationReason: error.terminationReason })
          : Object.freeze({
              category: "NETWORK_OR_UNKNOWN" as const,
              terminationReason: "PROVIDER_FAILURE" as const,
            });
      const partial = session.finish({
        stepCount,
        providerRequestAttemptCount: responseCount,
        toolCallCount,
        terminationReason: failure.terminationReason,
      });
      recordUsage(timedOut ? "TIMED_OUT" : "FAILED", false);
      throw new ModelRequestFailure("CODEX", failure.category, Math.min(responseCount, 20), {
        cause: error,
        agentTrace: partial.trace,
      });
    } finally {
      if (connection !== null) {
        if (threadId !== null && turnId !== null && !turnSettled) {
          await connection.request("turn/interrupt", { threadId, turnId }, INTERRUPT_TIMEOUT_MS)
            .catch(() => undefined);
        }
        await connection.close().catch(() => undefined);
      }
      if (directory !== null) {
        await rm(directory, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }
}
