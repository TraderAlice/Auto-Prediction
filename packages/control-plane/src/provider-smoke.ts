import { hashCanonical } from "@pmh/domain";
import { FixtureCatalogDiscoveryDesk } from "./catalog-discovery.js";
import { DiscoveryPool } from "./discovery.js";
import {
  createOpenAiDiscoveryRuntime,
  type OpenAiFetchLike,
} from "./openai-model.js";
import type { ModelProviderProjection, OpportunityHypothesis } from "./types.js";

const SMOKE_QUESTION = "Highest temperature in Boston on July 31, 2026?";
const SMOKE_VENUES = Object.freeze(["gemini-predictions"]);

export type OpenAiProviderSmokeReport = Readonly<{
  schemaVersion: "pmh.openai-provider-smoke.v1";
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
    responseStorage: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: string;
}>;

export async function runOpenAiProviderSmoke(
  options: Readonly<{
    environment?: Readonly<Record<string, string | undefined>>;
    fetcher?: OpenAiFetchLike;
    now?: () => number;
  }> = {},
): Promise<OpenAiProviderSmokeReport> {
  const now = options.now ?? Date.now;
  const runtime = createOpenAiDiscoveryRuntime(
    options.environment ?? process.env,
    options.fetcher === undefined ? {} : { fetcher: options.fetcher },
  );
  if (runtime.worker === null) {
    throw new Error(
      "OPENAI_API_KEY is required for provider smoke qualification",
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
    schemaVersion: "pmh.openai-provider-smoke.v1" as const,
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
      responseStorage: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
