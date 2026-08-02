import { createDeepSeek, type DeepSeekProviderSettings } from "@ai-sdk/deepseek";
import {
  DEFAULT_DISCOVERY_AGENT_MAX_STEPS,
  DEFAULT_DISCOVERY_AGENT_MAX_TOOL_CALLS,
  MAX_DISCOVERY_AGENT_MAX_STEPS,
  MAX_DISCOVERY_AGENT_MAX_TOOL_CALLS,
  runAiSdkDiscoveryAgent,
} from "./discovery-agent.js";
import { AgenticModelDiscoveryWorker } from "./discovery.js";
import {
  configuredModelScoutRoles,
  modelScoutLens,
  modelScoutWorkerId,
} from "./model-scout.js";
import type {
  DiscoveryAgentPort,
  DiscoveryAgentRunResult,
  DiscoveryTask,
  ModelProviderProjection,
} from "./types.js";
import type { AiUsageRecorder } from "./ai-usage-ledger.js";

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_MAX_OUTPUT_TOKENS = 800;
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 300_000;
const MODEL_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;

export type DeepSeekFetchLike = NonNullable<DeepSeekProviderSettings["fetch"]>;

export type DeepSeekAiSdkAgentPortOptions = Readonly<{
  apiKey: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxSteps?: number;
  maxToolCalls?: number;
  fetcher?: DeepSeekFetchLike;
  usageRecorder?: AiUsageRecorder;
}>;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

export class DeepSeekAiSdkAgentPort implements DiscoveryAgentPort {
  readonly #apiKey: string;
  readonly #fetcher: DeepSeekFetchLike;
  readonly #usageRecorder: AiUsageRecorder | undefined;
  public readonly maxOutputTokens: number;
  public readonly timeoutMs: number;
  public readonly maxSteps: number;
  public readonly maxToolCalls: number;

  public constructor(options: DeepSeekAiSdkAgentPortOptions) {
    this.#apiKey = options.apiKey.trim();
    if (this.#apiKey === "") {
      throw new Error("DeepSeek AI SDK agent port requires an API key");
    }
    this.maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxSteps = options.maxSteps ?? DEFAULT_DISCOVERY_AGENT_MAX_STEPS;
    this.maxToolCalls =
      options.maxToolCalls ?? DEFAULT_DISCOVERY_AGENT_MAX_TOOL_CALLS;
    if (
      !Number.isSafeInteger(this.maxOutputTokens) ||
      this.maxOutputTokens < 128 || this.maxOutputTokens > 4_096
    ) {
      throw new Error("DeepSeek output-token budget must be from 128 to 4096");
    }
    if (
      !Number.isSafeInteger(this.timeoutMs) ||
      this.timeoutMs < 1_000 || this.timeoutMs > MAX_TIMEOUT_MS
    ) {
      throw new Error(
        `DeepSeek request timeout must be from 1000 to ${MAX_TIMEOUT_MS} ms`,
      );
    }
    if (
      !Number.isSafeInteger(this.maxSteps) || this.maxSteps < 1 ||
      this.maxSteps > MAX_DISCOVERY_AGENT_MAX_STEPS ||
      !Number.isSafeInteger(this.maxToolCalls) || this.maxToolCalls < 1 ||
      this.maxToolCalls > MAX_DISCOVERY_AGENT_MAX_TOOL_CALLS
    ) {
      throw new Error("DeepSeek agent loop budget is invalid or unbounded");
    }
    this.#fetcher = options.fetcher ?? fetch;
    this.#usageRecorder = options.usageRecorder;
  }

  public async run(input: {
    workerId: string;
    model: string;
    system: string;
    searchLens?: string;
    task: DiscoveryTask;
  }): Promise<DiscoveryAgentRunResult> {
    if (!MODEL_ID_PATTERN.test(input.model)) {
      throw new Error("DeepSeek discovery model ID is invalid");
    }
    let requestAttemptCount = 0;
    const provider = createDeepSeek({
      apiKey: this.#apiKey,
      fetch: async (request, init) => {
        requestAttemptCount += 1;
        return this.#fetcher(request, init);
      },
    });
    return runAiSdkDiscoveryAgent({
      provider: "DEEPSEEK",
      model: provider(input.model),
      modelId: input.model,
      workerId: input.workerId,
      system: input.system,
      ...(input.searchLens === undefined
        ? {}
        : { searchLens: input.searchLens }),
      task: input.task,
      maxOutputTokens: this.maxOutputTokens,
      timeoutMs: this.timeoutMs,
      maxSteps: this.maxSteps,
      maxToolCalls: this.maxToolCalls,
      requestAttemptCount: () => requestAttemptCount,
      ...(this.#usageRecorder === undefined ? {} : { usageRecorder: this.#usageRecorder }),
      providerOptions: {
        deepseek: {
          thinking: { type: "disabled" },
        },
      },
    });
  }
}

export type DeepSeekDiscoveryRuntime = Readonly<{
  projection: ModelProviderProjection;
  worker: AgenticModelDiscoveryWorker | null;
  workers: readonly AgenticModelDiscoveryWorker[];
}>;

export function createDeepSeekDiscoveryRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{
    fetcher?: DeepSeekFetchLike;
    usageRecorder?: AiUsageRecorder;
  }> = {},
): DeepSeekDiscoveryRuntime {
  const model = environment.PMH_DISCOVERY_MODEL?.trim() || DEFAULT_MODEL;
  if (!MODEL_ID_PATTERN.test(model)) {
    throw new Error("PMH_DISCOVERY_MODEL is invalid");
  }
  const maxOutputTokens = boundedInteger(
    environment.PMH_DISCOVERY_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    128,
    4_096,
    "PMH_DISCOVERY_MAX_OUTPUT_TOKENS",
  );
  const timeoutMs = boundedInteger(
    environment.PMH_DISCOVERY_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    1_000,
    MAX_TIMEOUT_MS,
    "PMH_DISCOVERY_TIMEOUT_MS",
  );
  const maxSteps = boundedInteger(
    environment.PMH_DISCOVERY_MAX_STEPS,
    DEFAULT_DISCOVERY_AGENT_MAX_STEPS,
    1,
    MAX_DISCOVERY_AGENT_MAX_STEPS,
    "PMH_DISCOVERY_MAX_STEPS",
  );
  const maxToolCalls = boundedInteger(
    environment.PMH_DISCOVERY_MAX_TOOL_CALLS,
    DEFAULT_DISCOVERY_AGENT_MAX_TOOL_CALLS,
    1,
    MAX_DISCOVERY_AGENT_MAX_TOOL_CALLS,
    "PMH_DISCOVERY_MAX_TOOL_CALLS",
  );
  const apiKey = environment.DEEPSEEK_API_KEY?.trim() ?? "";
  const workerRoles = configuredModelScoutRoles(
    environment.PMH_DISCOVERY_FANOUT,
  );
  const projection: ModelProviderProjection = Object.freeze({
    provider: "DEEPSEEK_CHAT_COMPLETIONS",
    transport: "VERCEL_AI_SDK",
    configured: apiKey !== "",
    credentialEnv: "DEEPSEEK_API_KEY",
    model,
    maxOutputTokens,
    timeoutMs,
    maxSteps,
    maxToolCalls,
    fanout: workerRoles.length,
    workerRoles,
    reasoningEffort: "disabled",
    responseStorage: "PROVIDER_POLICY",
    authority: "PROPOSE_ONLY",
  });
  const agentPort = apiKey === ""
    ? null
    : new DeepSeekAiSdkAgentPort({
        apiKey,
        maxOutputTokens,
        timeoutMs,
        maxSteps,
        maxToolCalls,
        ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
        ...(options.usageRecorder === undefined
          ? {}
          : { usageRecorder: options.usageRecorder }),
      });
  const workers = Object.freeze(
    agentPort === null
      ? []
      : workerRoles.map((role) =>
          new AgenticModelDiscoveryWorker(
            modelScoutWorkerId(role, workerRoles.length),
            model,
            agentPort,
            modelScoutLens(role),
          )
        ),
  );
  return Object.freeze({
    projection,
    worker: workers[0] ?? null,
    workers,
  });
}
