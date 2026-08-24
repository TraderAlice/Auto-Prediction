import { createOpenAI, type OpenAIProviderSettings } from "@ai-sdk/openai";
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
import type {
  CodexReasoningEffort,
  CodexRuntimeModel,
} from "./ai-runtime-configuration.js";
import {
  CodexAuthCacheCredentialProvider,
  type CodexOAuthCredentialProvider,
} from "./codex-oauth.js";
import { CodexAppServerAgentPort } from "./codex-app-server-model.js";
import {
  createCodexAppServerConnectionFactory,
  type CodexAppServerConnectionFactory,
} from "./codex-app-server-transport.js";

const DEFAULT_MAX_OUTPUT_TOKENS = 800;
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 300_000;
const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";

export type CodexFetchLike = NonNullable<OpenAIProviderSettings["fetch"]>;

/**
 * How the discovery loop reaches the Codex model with the ChatGPT OAuth cache.
 *
 * - `APP_SERVER` (default) drives a local `codex app-server --stdio` process,
 *   the sanctioned first-party client that the ChatGPT subscription accepts.
 * - `RESPONSES` calls `chatgpt.com/backend-api/codex/responses` directly with
 *   a third-party originator; the service currently rejects that route for
 *   subscription OAuth (HTTP 403), so it remains only as an explicit opt-in.
 */
export type CodexDiscoveryTransport = "APP_SERVER" | "RESPONSES";

export const DEFAULT_CODEX_DISCOVERY_TRANSPORT: CodexDiscoveryTransport = "APP_SERVER";

export function resolveCodexDiscoveryTransport(
  environment: Readonly<Record<string, string | undefined>>,
  explicit?: CodexDiscoveryTransport,
): CodexDiscoveryTransport {
  if (explicit !== undefined) return explicit;
  const raw = environment.PMH_CODEX_DISCOVERY_TRANSPORT?.trim().toUpperCase().replaceAll("-", "_");
  if (raw === undefined || raw === "") return DEFAULT_CODEX_DISCOVERY_TRANSPORT;
  if (raw === "APP_SERVER" || raw === "RESPONSES") return raw;
  throw new Error("PMH_CODEX_DISCOVERY_TRANSPORT must be app-server or responses");
}

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

export class CodexAiSdkAgentPort implements DiscoveryAgentPort {
  public constructor(
    private readonly model: CodexRuntimeModel,
    private readonly reasoningEffort: CodexReasoningEffort,
    private readonly credentialProvider: CodexOAuthCredentialProvider,
    public readonly maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    public readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    public readonly maxSteps = DEFAULT_DISCOVERY_AGENT_MAX_STEPS,
    public readonly maxToolCalls = DEFAULT_DISCOVERY_AGENT_MAX_TOOL_CALLS,
    private readonly fetcher: CodexFetchLike = fetch,
    private readonly usageRecorder?: AiUsageRecorder,
  ) {
    if (
      !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 128 ||
      maxOutputTokens > 4_096 || !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS ||
      !Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      maxSteps > MAX_DISCOVERY_AGENT_MAX_STEPS ||
      !Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1 ||
      maxToolCalls > MAX_DISCOVERY_AGENT_MAX_TOOL_CALLS
    ) {
      throw new Error("Codex agent loop configuration is invalid or unbounded");
    }
  }

  public async run(input: {
    workerId: string;
    model: string;
    system: string;
    searchLens?: string;
    task: DiscoveryTask;
  }): Promise<DiscoveryAgentRunResult> {
    const credential = await this.credentialProvider.resolve();
    let requestAttemptCount = 0;
    const provider = createOpenAI({
      apiKey: credential.accessToken,
      baseURL: CODEX_BASE_URL,
      headers: {
        "chatgpt-account-id": credential.accountId,
        originator: "prediction-market-harness",
        "OpenAI-Beta": "responses=experimental",
      },
      fetch: async (request, init) => {
        requestAttemptCount += 1;
        return this.fetcher(request, init);
      },
    });
    return runAiSdkDiscoveryAgent({
      provider: "CODEX",
      model: provider.responses(this.model),
      modelId: this.model,
      workerId: input.workerId,
      system: input.system,
      ...(input.searchLens === undefined ? {} : { searchLens: input.searchLens }),
      task: input.task,
      maxOutputTokens: this.maxOutputTokens,
      timeoutMs: this.timeoutMs,
      maxSteps: this.maxSteps,
      maxToolCalls: this.maxToolCalls,
      requestAttemptCount: () => requestAttemptCount,
      ...(this.usageRecorder === undefined ? {} : { usageRecorder: this.usageRecorder }),
      providerOptions: {
        openai: {
          store: false,
          reasoningEffort: this.reasoningEffort,
          reasoningSummary: null,
          strictJsonSchema: false,
          parallelToolCalls: false,
        },
      },
      streamResponses: true,
      omitMaxOutputTokens: true,
    });
  }
}

export type CodexDiscoveryRuntime = Readonly<{
  projection: ModelProviderProjection;
  worker: AgenticModelDiscoveryWorker | null;
  workers: readonly AgenticModelDiscoveryWorker[];
}>;

export function createCodexDiscoveryRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{
    model: CodexRuntimeModel;
    reasoningEffort: CodexReasoningEffort;
    credentialProvider?: CodexOAuthCredentialProvider;
    fetcher?: CodexFetchLike;
    usageRecorder?: AiUsageRecorder;
    transport?: CodexDiscoveryTransport;
    appServerConnectionFactory?: CodexAppServerConnectionFactory;
    appServerCommand?: string;
    appServerCwd?: string;
  }>,
): CodexDiscoveryRuntime {
  const transport = resolveCodexDiscoveryTransport(environment, options.transport);
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
  const credentialProvider = options.credentialProvider ??
    new CodexAuthCacheCredentialProvider(environment);
  const configured = credentialProvider.configured();
  const workerRoles = configuredModelScoutRoles(environment.PMH_DISCOVERY_FANOUT);
  const projection: ModelProviderProjection = Object.freeze({
    provider: "CODEX_RESPONSES",
    transport: transport === "APP_SERVER" ? "CODEX_APP_SERVER" : "VERCEL_AI_SDK",
    configured,
    credentialEnv: "CODEX_OAUTH",
    model: options.model,
    maxOutputTokens,
    maxOutputTokensEnforced: false,
    timeoutMs,
    maxSteps,
    maxToolCalls,
    fanout: workerRoles.length,
    workerRoles,
    reasoningEffort: options.reasoningEffort,
    responseStorage: false,
    authority: "PROPOSE_ONLY",
  });
  const agentPort: DiscoveryAgentPort | null = !configured
    ? null
    : transport === "APP_SERVER"
      ? new CodexAppServerAgentPort(
          options.model,
          options.reasoningEffort,
          options.appServerConnectionFactory ??
            createCodexAppServerConnectionFactory({
              cwd: options.appServerCwd ?? process.cwd(),
              environment,
              requestTimeoutMs: Math.min(timeoutMs, 30_000),
              ...(options.appServerCommand === undefined
                ? {}
                : { command: options.appServerCommand }),
            }),
          timeoutMs,
          maxSteps,
          maxToolCalls,
          options.usageRecorder,
        )
      : new CodexAiSdkAgentPort(
          options.model,
          options.reasoningEffort,
          credentialProvider,
          maxOutputTokens,
          timeoutMs,
          maxSteps,
          maxToolCalls,
          options.fetcher,
          options.usageRecorder,
        );
  const workers = Object.freeze(agentPort === null ? [] : workerRoles.map((role) =>
    new AgenticModelDiscoveryWorker(
      modelScoutWorkerId(role, workerRoles.length),
      options.model,
      agentPort,
      modelScoutLens(role),
    )
  ));
  return Object.freeze({ projection, worker: workers[0] ?? null, workers });
}
