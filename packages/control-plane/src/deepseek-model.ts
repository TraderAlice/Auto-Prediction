import { createDeepSeek, type DeepSeekProviderSettings } from "@ai-sdk/deepseek";
import { generateText, jsonSchema, Output } from "ai";
import { StructuredModelDiscoveryWorker } from "./discovery.js";
import { discoveryOutputSchema } from "./openai-model.js";
import type {
  AiModelPort,
  DiscoveryTask,
  ModelProviderProjection,
} from "./types.js";

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_MAX_OUTPUT_TOKENS = 800;
const DEFAULT_TIMEOUT_MS = 8_000;
const MODEL_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;

type DiscoveryModelPayload = Readonly<{
  hypotheses: readonly Readonly<{
    thesis: string;
    strategyKind:
      | "COMPLETE_SET"
      | "EXHAUSTIVE_RANGE"
      | "SAME_CLAIM_CROSS_VENUE";
    venueIds: readonly string[];
    claimSearchTerms: readonly string[];
    listingRefs: readonly string[];
    confidenceBps: number;
  }>[];
}>;

export type DeepSeekFetchLike = NonNullable<DeepSeekProviderSettings["fetch"]>;

export type DeepSeekAiSdkModelPortOptions = Readonly<{
  apiKey: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fetcher?: DeepSeekFetchLike;
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

export class DeepSeekAiSdkModelPort implements AiModelPort {
  readonly #apiKey: string;
  readonly #fetcher: DeepSeekFetchLike | undefined;
  public readonly maxOutputTokens: number;
  public readonly timeoutMs: number;

  public constructor(options: DeepSeekAiSdkModelPortOptions) {
    this.#apiKey = options.apiKey.trim();
    if (this.#apiKey === "") {
      throw new Error("DeepSeek AI SDK model port requires an API key");
    }
    this.maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(this.maxOutputTokens) ||
      this.maxOutputTokens < 128 ||
      this.maxOutputTokens > 4_096
    ) {
      throw new Error("DeepSeek output-token budget must be from 128 to 4096");
    }
    if (
      !Number.isSafeInteger(this.timeoutMs) ||
      this.timeoutMs < 1_000 ||
      this.timeoutMs > 30_000
    ) {
      throw new Error("DeepSeek request timeout must be from 1000 to 30000 ms");
    }
    this.#fetcher = options.fetcher;
  }

  public async completeStructured(input: {
    model: string;
    schemaVersion: "pmh.discovery-output.v1";
    system: string;
    task: DiscoveryTask;
  }): Promise<unknown> {
    if (!MODEL_ID_PATTERN.test(input.model)) {
      throw new Error("DeepSeek model ID is invalid");
    }
    const remainingMs = input.task.deadlineEpochMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error("DeepSeek AI SDK task deadline has expired");
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(this.timeoutMs, remainingMs),
    );
    try {
      const provider = createDeepSeek({
        apiKey: this.#apiKey,
        ...(this.#fetcher === undefined ? {} : { fetch: this.#fetcher }),
      });
      const result = await generateText({
        model: provider(input.model),
        maxOutputTokens: this.maxOutputTokens,
        maxRetries: 0,
        abortSignal: controller.signal,
        system:
          `${input.system} Treat every result as an unverified search lead. ` +
          "Use only venue IDs and listingRefs supplied by the task catalog " +
          "context. Return no hypothesis when the context has no grounded " +
          "candidate. Return one JSON object and do not call tools.",
        prompt: JSON.stringify({
          schemaVersion: input.schemaVersion,
          question: input.task.question,
          venueIds: input.task.venueIds,
          maxHypotheses: input.task.maxHypotheses,
          catalogContext: input.task.catalogContext ?? null,
        }),
        output: Output.object({
          name: "pmh_discovery_output",
          description: "Grounded, proposal-only prediction-market hypotheses",
          schema: jsonSchema<DiscoveryModelPayload>(discoveryOutputSchema),
        }),
        providerOptions: {
          deepseek: {
            thinking: { type: "disabled" },
            strictJsonSchema: false,
          },
        },
      });
      return result.output;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("DeepSeek AI SDK request timed out");
      }
      throw new Error("DeepSeek AI SDK request failed", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type DeepSeekDiscoveryRuntime = Readonly<{
  projection: ModelProviderProjection;
  worker: StructuredModelDiscoveryWorker | null;
}>;

export function createDeepSeekDiscoveryRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{ fetcher?: DeepSeekFetchLike }> = {},
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
    30_000,
    "PMH_DISCOVERY_TIMEOUT_MS",
  );
  const apiKey = environment.DEEPSEEK_API_KEY?.trim() ?? "";
  const projection: ModelProviderProjection = Object.freeze({
    provider: "DEEPSEEK_CHAT_COMPLETIONS",
    transport: "VERCEL_AI_SDK",
    configured: apiKey !== "",
    credentialEnv: "DEEPSEEK_API_KEY",
    model,
    maxOutputTokens,
    timeoutMs,
    reasoningEffort: "disabled",
    responseStorage: "PROVIDER_POLICY",
    authority: "PROPOSE_ONLY",
  });
  return Object.freeze({
    projection,
    worker:
      apiKey === ""
        ? null
        : new StructuredModelDiscoveryWorker(
            "model-fast-lane",
            model,
            new DeepSeekAiSdkModelPort({
              apiKey,
              maxOutputTokens,
              timeoutMs,
              ...(options.fetcher === undefined
                ? {}
                : { fetcher: options.fetcher }),
            }),
          ),
  });
}
