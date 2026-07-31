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

export type DiscoveryModelRuntime =
  | DeepSeekDiscoveryRuntime
  | OpenAiDiscoveryRuntime;

export function createDiscoveryModelRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{
    deepSeekFetcher?: DeepSeekFetchLike;
    openAiFetcher?: OpenAiFetchLike;
  }> = {},
): DiscoveryModelRuntime {
  const provider = environment.PMH_DISCOVERY_PROVIDER?.trim().toLowerCase() ||
    "deepseek";
  if (provider === "deepseek") {
    return createDeepSeekDiscoveryRuntime(
      environment,
      options.deepSeekFetcher === undefined
        ? {}
        : { fetcher: options.deepSeekFetcher },
    );
  }
  if (provider === "openai") {
    return createOpenAiDiscoveryRuntime(
      environment,
      options.openAiFetcher === undefined
        ? {}
        : { fetcher: options.openAiFetcher },
    );
  }
  throw new Error("PMH_DISCOVERY_PROVIDER must be deepseek or openai");
}
