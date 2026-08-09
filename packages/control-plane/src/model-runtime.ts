import {
  createDeepSeekDiscoveryRuntime,
  type DeepSeekDiscoveryRuntime,
  type DeepSeekFetchLike,
} from "./deepseek-model.js";
import {
  createOpenAiDiscoveryRuntime,
  type OpenAiDiscoveryRuntime,
  type OpenAiFetchLike,
} from "./openai-model.js";
import type { AiUsageRecorder } from "./ai-usage-ledger.js";
import {
  createCodexDiscoveryRuntime,
  type CodexDiscoveryRuntime,
  type CodexFetchLike,
} from "./codex-model.js";
import type { CodexOAuthCredentialProvider } from "./codex-oauth.js";
import type { AiRuntimeConfiguration } from "./ai-runtime-configuration.js";

export type DiscoveryModelRuntime =
  | DeepSeekDiscoveryRuntime
  | OpenAiDiscoveryRuntime
  | CodexDiscoveryRuntime;

export function createDiscoveryModelRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{
    deepSeekFetcher?: DeepSeekFetchLike;
    openAiFetcher?: OpenAiFetchLike;
    codexFetcher?: CodexFetchLike;
    codexCredentialProvider?: CodexOAuthCredentialProvider;
    runtimeConfiguration?: AiRuntimeConfiguration;
    usageRecorder?: AiUsageRecorder;
  }> = {},
): DiscoveryModelRuntime {
  const provider = options.runtimeConfiguration?.provider.toLowerCase() ??
    environment.PMH_DISCOVERY_PROVIDER?.trim().toLowerCase() ?? "deepseek";
  if (provider === "deepseek") {
    return createDeepSeekDiscoveryRuntime(
      environment,
      {
        ...(options.deepSeekFetcher === undefined
          ? {}
          : { fetcher: options.deepSeekFetcher }),
        ...(options.usageRecorder === undefined
          ? {}
          : { usageRecorder: options.usageRecorder }),
      },
    );
  }
  if (provider === "openai") {
    return createOpenAiDiscoveryRuntime(
      environment,
      {
        ...(options.openAiFetcher === undefined
          ? {}
          : { fetcher: options.openAiFetcher }),
        ...(options.usageRecorder === undefined
          ? {}
          : { usageRecorder: options.usageRecorder }),
      },
    );
  }
  if (provider === "codex") {
    const configuration = options.runtimeConfiguration;
    return createCodexDiscoveryRuntime(environment, {
      model: configuration?.codexModel ?? "gpt-5.6-luna",
      reasoningEffort: configuration?.codexReasoningEffort ?? "low",
      ...(options.codexFetcher === undefined
        ? {}
        : { fetcher: options.codexFetcher }),
      ...(options.codexCredentialProvider === undefined
        ? {}
        : { credentialProvider: options.codexCredentialProvider }),
      ...(options.usageRecorder === undefined
        ? {}
        : { usageRecorder: options.usageRecorder }),
    });
  }
  throw new Error("PMH_DISCOVERY_PROVIDER must be deepseek, codex, or openai");
}
