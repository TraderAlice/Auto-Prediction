import { hashCanonical } from "@pmh/domain";
import { FixtureCatalogDiscoveryDesk } from "./catalog-discovery.js";
import { DiscoveryPool } from "./discovery.js";
import type { DeepSeekFetchLike } from "./deepseek-model.js";
import {
  createDiscoveryModelRuntime,
} from "./model-runtime.js";
import {
  type OpenAiFetchLike,
} from "./openai-model.js";
import type { ModelProviderProjection, OpportunityHypothesis } from "./types.js";

const SMOKE_QUESTION = "Highest temperature in Boston on July 31, 2026?";
const SMOKE_VENUES = Object.freeze(["gemini-predictions"]);

export type ModelProviderSmokeReport = Readonly<{
  schemaVersion: "pmh.model-provider-smoke.v2";
  status: "PASS";
  startedAt: string;
  completedAt: string;
  provider: ModelProviderProjection;
  task: Readonly<{
    taskId: string;
    question: string;
    venueIds: readonly string[];
    catalogContextIdentity: string;
    catalogListingCount: number;
  }>;
  result: Readonly<{
    workerId: string;
    hypothesisCount: number;
    hypotheses: readonly Pick<
      OpportunityHypothesis,
      | "hypothesisId"
      | "thesis"
      | "strategyKind"
      | "venueIds"
      | "listingRefs"
      | "confidenceBps"
      | "authority"
      | "reviewStatus"
    >[];
    diagnostics: readonly string[];
    executionAuthority: false;
  }>;
  effects: Readonly<{
    providerRequests: 1;
    responseStorage: ModelProviderProjection["responseStorage"];
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: string;
}>;

export async function runModelProviderSmoke(
  options: Readonly<{
    environment?: Readonly<Record<string, string | undefined>>;
    deepSeekFetcher?: DeepSeekFetchLike;
    openAiFetcher?: OpenAiFetchLike;
    now?: () => number;
  }> = {},
): Promise<ModelProviderSmokeReport> {
  const now = options.now ?? Date.now;
  const runtime = createDiscoveryModelRuntime(
    options.environment ?? process.env,
    {
      ...(options.deepSeekFetcher === undefined
        ? {}
        : { deepSeekFetcher: options.deepSeekFetcher }),
      ...(options.openAiFetcher === undefined
        ? {}
        : { openAiFetcher: options.openAiFetcher }),
    },
  );
  if (runtime.worker === null) {
    throw new Error(
      `${runtime.projection.credentialEnv} is required for provider smoke qualification`,
    );
  }

  const catalog = new FixtureCatalogDiscoveryDesk();
  await catalog.load();
  const catalogContext = catalog.context(SMOKE_QUESTION, SMOKE_VENUES);
  const startedAtMs = now();
  const taskId = `task:provider-smoke:${hashCanonical({
    question: SMOKE_QUESTION,
    venueIds: SMOKE_VENUES,
    catalogContextIdentity: catalogContext.contextIdentity,
    model: runtime.projection.model,
  }).slice(7, 23)}`;
  const run = await new DiscoveryPool([runtime.worker], now).run({
    taskId,
    question: SMOKE_QUESTION,
    venueIds: SMOKE_VENUES,
    maxHypotheses: 3,
    deadlineEpochMs: startedAtMs + runtime.projection.timeoutMs + 2_000,
    catalogContext,
  });
  if (run.diagnostics.length > 0) {
    throw new Error(`provider smoke failed: ${run.diagnostics.join("; ")}`);
  }

  const body = Object.freeze({
    schemaVersion: "pmh.model-provider-smoke.v2" as const,
    status: "PASS" as const,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    provider: runtime.projection,
    task: Object.freeze({
      taskId,
      question: SMOKE_QUESTION,
      venueIds: SMOKE_VENUES,
      catalogContextIdentity: catalogContext.contextIdentity,
      catalogListingCount: catalogContext.listings.length,
    }),
    result: Object.freeze({
      workerId: runtime.worker.workerId,
      hypothesisCount: run.hypotheses.length,
      hypotheses: Object.freeze(
        run.hypotheses.map((hypothesis) =>
          Object.freeze({
            hypothesisId: hypothesis.hypothesisId,
            thesis: hypothesis.thesis,
            strategyKind: hypothesis.strategyKind,
            venueIds: hypothesis.venueIds,
            listingRefs: hypothesis.listingRefs ?? Object.freeze([]),
            confidenceBps: hypothesis.confidenceBps,
            authority: hypothesis.authority,
            reviewStatus: hypothesis.reviewStatus,
          }),
        ),
      ),
      diagnostics: run.diagnostics,
      executionAuthority: false as const,
    }),
    effects: Object.freeze({
      providerRequests: 1 as const,
      responseStorage: runtime.projection.responseStorage,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export type OpenAiProviderSmokeReport = ModelProviderSmokeReport;

export function runOpenAiProviderSmoke(
  options: Readonly<{
    environment?: Readonly<Record<string, string | undefined>>;
    fetcher?: OpenAiFetchLike;
    now?: () => number;
  }> = {},
): Promise<OpenAiProviderSmokeReport> {
  return runModelProviderSmoke({
    environment: {
      ...(options.environment ?? process.env),
      PMH_DISCOVERY_PROVIDER: "openai",
    },
    ...(options.fetcher === undefined
      ? {}
      : { openAiFetcher: options.fetcher }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
}
