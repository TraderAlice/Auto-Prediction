import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { hashCanonical } from "@pmh/domain";
import { ReplayBookDesk } from "./book-desk.js";
import { FixtureCatalogDiscoveryDesk } from "./catalog-discovery.js";
import {
  CatalogObservationDesk,
  RadarCandidateUnavailableError,
  type CatalogObservationStore,
} from "./catalog-observation.js";
import {
  CandidateWatchDesk,
  type CandidateWatchStore,
} from "./candidate-watch.js";
import { DiscoveryPool, HeuristicDiscoveryWorker } from "./discovery.js";
import {
  createDiscoveryModelRuntime,
  type DiscoveryModelRuntime,
} from "./model-runtime.js";
import {
  createPiInvestigatorRuntime,
  type PiInvestigatorRuntime,
} from "./pi-investigator.js";
import {
  InvestigationBusyError,
  InvestigationDesk,
  InvestigationNotConfiguredError,
  InvestigationScopeConflictError,
  type InvestigationRecordStore,
} from "./investigation-desk.js";
import {
  DiscoveryLedger,
  projectDiscoveryRunRecord,
  type DiscoveryRunStore,
} from "./discovery-ledger.js";
import { radarTriageTaskId } from "./opportunity-radar.js";
import { buildStudioProjection } from "./projection.js";
import { RealCandidatePreflightDesk } from "./real-candidate-preflight.js";
import {
  createMarketArchaeologistDesk,
  MarketArchaeologistBusyError,
  MarketArchaeologistDesk,
  MarketArchaeologistNotConfiguredError,
  type MarketArchaeologistRecordStore,
} from "./market-archaeologist.js";
import {
  projectMarketCorpus,
  searchMarketCorpus,
  type MarketCorpusSearchQuery,
} from "./market-corpus.js";
import type {
  DiscoveryCatalogMode,
  DiscoveryRunRecord,
  DiscoveryTask,
} from "./types.js";
import { OpportunityLifecycleDesk } from "./opportunity-lifecycle-desk.js";

const MAX_BODY_BYTES = 64 * 1024;

class DiscoveryScopeConflictError extends Error {}
class ResearchContextUnavailableError extends Error {}

function writeJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "http://localhost:5173",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes =
      typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    length += bytes.byteLength;
    if (length > MAX_BODY_BYTES) {
      throw new Error("request body exceeds 64 KiB");
    }
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readRadarCandidateId(request: IncomingMessage): Promise<string> {
  const body = await readJson(request);
  if (
    body === null ||
    typeof body !== "object" ||
    typeof (body as { candidateId?: unknown }).candidateId !== "string" ||
    Object.keys(body).length !== 1
  ) {
    throw new RadarCandidateUnavailableError(
      "radar action requires exactly one candidateId",
    );
  }
  return (body as { candidateId: string }).candidateId;
}

async function readResearchTaskId(request: IncomingMessage): Promise<string> {
  const body = await readJson(request);
  if (
    body === null ||
    typeof body !== "object" ||
    typeof (body as { taskId?: unknown }).taskId !== "string" ||
    Object.keys(body).length !== 1 ||
    (body as { taskId: string }).taskId.trim() === ""
  ) {
    throw new ResearchContextUnavailableError(
      "research case investigation requires exactly one taskId",
    );
  }
  return (body as { taskId: string }).taskId;
}

function parseDiscoveryTask(
  value: unknown,
  catalogDesk: FixtureCatalogDiscoveryDesk,
  catalogObservationDesk: CatalogObservationDesk,
  deadlineMs = 10_000,
): DiscoveryTask {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as { question?: unknown }).question !== "string" ||
    !Array.isArray((value as { venueIds?: unknown }).venueIds)
  ) {
    throw new Error("discovery request requires question and venueIds");
  }
  const rawVenueIds = (value as { venueIds: unknown[] }).venueIds;
  const rawTaskId = (value as { taskId?: unknown }).taskId;
  const rawCatalogMode = (value as { catalogMode?: unknown }).catalogMode;
  if (
    rawVenueIds.some((item) => typeof item !== "string") ||
    (rawTaskId !== undefined && typeof rawTaskId !== "string") ||
    (rawCatalogMode !== undefined && typeof rawCatalogMode !== "string")
  ) {
    throw new Error("discovery taskId, catalogMode, and venueIds must be strings");
  }
  const question = (value as { question: string }).question
    .trim()
    .replace(/\s+/g, " ");
  const venueIds = [
    ...new Set(
      rawVenueIds
        .map((item) => item as string)
        .map((item) => item.trim())
        .filter((item) => item !== ""),
    ),
  ].sort();
  const now = Date.now();
  const suppliedTaskId =
    typeof rawTaskId === "string"
      ? rawTaskId.trim()
      : undefined;
  const catalogMode =
    (rawCatalogMode ?? "VERIFIED_FIXTURES") as DiscoveryCatalogMode;
  if (
    question === "" ||
    question.length > 500 ||
    venueIds.length === 0 ||
    venueIds.length > 25 ||
    venueIds.some((item) => item.length > 256) ||
    suppliedTaskId === "" ||
    (suppliedTaskId?.length ?? 0) > 256 ||
    (catalogMode !== "VERIFIED_FIXTURES" &&
      catalogMode !== "CURRENT_OBSERVATIONS")
  ) {
    throw new Error("discovery request is empty or exceeds bounded input limits");
  }
  const catalogContext =
    catalogMode === "CURRENT_OBSERVATIONS"
      ? catalogObservationDesk.context(question, venueIds)
      : catalogDesk.context(question, venueIds);
  return {
    taskId:
      suppliedTaskId ??
      `task:${hashCanonical({
        question,
        venueIds,
        catalogContextIdentity: catalogContext.contextIdentity,
      }).slice(7)}`,
    question,
    venueIds,
    maxHypotheses: 10,
    deadlineEpochMs: now + deadlineMs,
    catalogContext,
  };
}

function taskScopeHash(task: DiscoveryTask): string {
  return hashCanonical({
    question: task.question,
    venueIds: task.venueIds,
    maxHypotheses: task.maxHypotheses,
    catalogContextIdentity: task.catalogContext?.contextIdentity ?? null,
    catalogContextSource: task.catalogContext?.source ?? null,
  });
}

function recordMatchesTask(
  record: DiscoveryRunRecord,
  task: DiscoveryTask,
): boolean {
  return (
    record.question === task.question &&
    record.venueIds.length === task.venueIds.length &&
    record.venueIds.every((item, index) => item === task.venueIds[index]) &&
    (record.catalogContextIdentity ?? null) ===
      (task.catalogContext?.contextIdentity ?? null) &&
    (record.catalogContextSource ?? "VERIFIED_FIXTURE_CATALOGS") ===
      (task.catalogContext?.source ?? "VERIFIED_FIXTURE_CATALOGS")
  );
}

function supportsInvestigationRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & InvestigationRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<InvestigationRecordStore>;
  return (
    candidate.investigationStorage !== undefined &&
    typeof candidate.loadInvestigations === "function" &&
    typeof candidate.saveInvestigation === "function"
  );
}

function supportsCatalogObservations(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & CatalogObservationStore {
  if (store === undefined) return false;
  const candidate = store as Partial<CatalogObservationStore>;
  return (
    candidate.catalogObservationStorage !== undefined &&
    typeof candidate.loadCatalogObservations === "function" &&
    typeof candidate.saveCatalogObservation === "function"
  );
}

function supportsCandidateWatch(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & CandidateWatchStore {
  if (store === undefined) return false;
  const candidate = store as Partial<CandidateWatchStore>;
  return (
    candidate.candidateBookObservationStorage !== undefined &&
    typeof candidate.loadCandidateBookObservations === "function" &&
    typeof candidate.saveCandidateBookObservation === "function" &&
    candidate.candidateWatchRefreshStorage !== undefined &&
    typeof candidate.loadCandidateWatchRefreshes === "function" &&
    typeof candidate.saveCandidateWatchRefresh === "function"
  );
}

function supportsMarketArchaeologistRecords(
  store: DiscoveryRunStore | undefined,
): store is DiscoveryRunStore & MarketArchaeologistRecordStore {
  if (store === undefined) return false;
  const candidate = store as Partial<MarketArchaeologistRecordStore>;
  return (
    candidate.marketArchaeologistStorage !== undefined &&
    typeof candidate.loadMarketArchaeologistRecords === "function" &&
    typeof candidate.saveMarketArchaeologistRecord === "function"
  );
}

export function createControlPlane(options?: {
  bookDesk?: ReplayBookDesk;
  catalogDesk?: FixtureCatalogDiscoveryDesk;
  catalogObservationDesk?: CatalogObservationDesk;
  refreshCatalogOnReady?: boolean;
  discoveryLedger?: DiscoveryLedger;
  discoveryStore?: DiscoveryRunStore;
  discoveryPool?: DiscoveryPool;
  modelRuntime?: DiscoveryModelRuntime;
  piRuntime?: PiInvestigatorRuntime;
  investigationDesk?: InvestigationDesk;
  investigationStore?: InvestigationRecordStore;
  realCandidatePreflightDesk?: RealCandidatePreflightDesk;
  candidateWatchDesk?: CandidateWatchDesk;
  marketArchaeologistDesk?: MarketArchaeologistDesk;
  opportunityLifecycleDesk?: OpportunityLifecycleDesk;
}) {
  if (
    options?.discoveryLedger !== undefined &&
    options.discoveryStore !== undefined
  ) {
    throw new Error("provide either discoveryLedger or discoveryStore, not both");
  }
  if (
    options?.investigationDesk !== undefined &&
    options.investigationStore !== undefined
  ) {
    throw new Error(
      "provide either investigationDesk or investigationStore, not both",
    );
  }
  const modelRuntime =
    options?.modelRuntime ?? createDiscoveryModelRuntime();
  const piRuntime = options?.piRuntime ?? createPiInvestigatorRuntime();
  const worker = new HeuristicDiscoveryWorker();
  const pool =
    options?.discoveryPool ??
    new DiscoveryPool([
      worker,
      ...modelRuntime.workers,
    ]);
  const bookDesk = options?.bookDesk ?? new ReplayBookDesk();
  const catalogDesk = options?.catalogDesk ?? new FixtureCatalogDiscoveryDesk();
  const catalogObservationDesk =
    options?.catalogObservationDesk ??
    new CatalogObservationDesk({
      ...(supportsCatalogObservations(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const discoveryLedger =
    options?.discoveryLedger ?? new DiscoveryLedger(25, options?.discoveryStore);
  const investigationDesk =
    options?.investigationDesk ??
    new InvestigationDesk(
      piRuntime.investigator,
      10,
      options?.investigationStore ??
        (supportsInvestigationRecords(options?.discoveryStore)
          ? options.discoveryStore
          : undefined),
    );
  const realCandidatePreflightDesk =
    options?.realCandidatePreflightDesk ?? new RealCandidatePreflightDesk();
  const candidateWatchDesk =
    options?.candidateWatchDesk ??
    new CandidateWatchDesk({
      evidenceDesk: realCandidatePreflightDesk,
      ...(supportsCandidateWatch(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const marketArchaeologistDesk =
    options?.marketArchaeologistDesk ??
    createMarketArchaeologistDesk(process.env, {
      ...(supportsMarketArchaeologistRecords(options?.discoveryStore)
        ? { store: options.discoveryStore }
        : {}),
    });
  const opportunityLifecycleDesk =
    options?.opportunityLifecycleDesk ?? new OpportunityLifecycleDesk();
  const realCandidateReady = realCandidatePreflightDesk.load();
  const ready = Promise.all([
    bookDesk.replay(),
    catalogDesk.load(),
    realCandidateReady,
    realCandidateReady.then(() => candidateWatchDesk.load()),
    ...(options?.refreshCatalogOnReady === true
      ? [catalogObservationDesk.refresh()]
      : []),
  ]).then(() => undefined);
  const subscribers = new Set<ServerResponse>();
  const pendingRuns = new Map<
    string,
    Readonly<{
      scopeHash: string;
      promise: Promise<DiscoveryRunRecord>;
    }>
  >();
  let activeRuns = 0;
  const projection = async () => {
    await ready;
    const archaeologistProjection = marketArchaeologistDesk.projection();
    const realCandidateDisposition =
      realCandidatePreflightDesk.dispositionProjection();
    opportunityLifecycleDesk.syncMarketArchaeologist(archaeologistProjection);
    opportunityLifecycleDesk.syncRealCandidate(realCandidateDisposition);
    return buildStudioProjection({
      workers: pool.workers,
      activeRuns,
      modelProvider: modelRuntime.projection,
      investigator: piRuntime.projection,
      investigationDesk: investigationDesk.projection(),
      catalogContext: catalogDesk.projection(),
      catalogObservation: catalogObservationDesk.projection(),
      opportunityRadar: catalogObservationDesk.radar(),
      marketCorpus: projectMarketCorpus(catalogObservationDesk.corpus()),
      marketArchaeologist: archaeologistProjection,
      opportunityLifecycle: opportunityLifecycleDesk.projection(),
      bookDesk: bookDesk.projection(),
      discoveryDesk: discoveryLedger.projection(),
      realCandidatePreflight: realCandidatePreflightDesk.projection(),
      realCandidateDepth: realCandidatePreflightDesk.depthProjection(),
      realCandidateDisposition,
      realCandidateRescreen: realCandidatePreflightDesk.rescreenProjection(),
      candidateWatch: candidateWatchDesk.projection(),
    });
  };

  const broadcastProjection = async (): Promise<void> => {
    const payload = `event: projection\ndata: ${JSON.stringify(
      await projection(),
    )}\n\n`;
    for (const subscriber of subscribers) {
      if (subscriber.destroyed) {
        subscribers.delete(subscriber);
      } else {
        subscriber.write(payload);
      }
    }
  };

  const invokeDiscovery = async (
    task: DiscoveryTask,
  ): Promise<
    Readonly<{ record: DiscoveryRunRecord; idempotentReplay: boolean }>
  > => {
    const existing = discoveryLedger.findByTaskId(task.taskId);
    if (existing !== undefined) {
      if (!recordMatchesTask(existing, task)) {
        throw new DiscoveryScopeConflictError(
          "taskId is already bound to another discovery scope",
        );
      }
      return Object.freeze({ record: existing, idempotentReplay: true });
    }
    const scopeHash = taskScopeHash(task);
    const pending = pendingRuns.get(task.taskId);
    if (pending !== undefined) {
      if (pending.scopeHash !== scopeHash) {
        throw new DiscoveryScopeConflictError(
          "taskId is already running with another discovery scope",
        );
      }
      return Object.freeze({
        record: await pending.promise,
        idempotentReplay: true,
      });
    }
    const promise = (async (): Promise<DiscoveryRunRecord> => {
      activeRuns += 1;
      try {
        await broadcastProjection();
        const run = await pool.run(task);
        return discoveryLedger.record(task, run);
      } finally {
        activeRuns -= 1;
        await broadcastProjection();
      }
    })();
    pendingRuns.set(task.taskId, { scopeHash, promise });
    try {
      return Object.freeze({
        record: await promise,
        idempotentReplay: false,
      });
    } finally {
      if (pendingRuns.get(task.taskId)?.promise === promise) {
        pendingRuns.delete(task.taskId);
      }
    }
  };

  const retainedDiscoveryTask = (
    taskId: string,
    deadlineMs: number,
  ): DiscoveryTask => {
    const record = discoveryLedger.findByTaskId(taskId);
    if (record === undefined || record.catalogContext === undefined) {
      throw new ResearchContextUnavailableError(
        "research task has no retained exact catalog context",
      );
    }
    return Object.freeze({
      taskId: record.taskId,
      question: record.question,
      venueIds: record.venueIds,
      maxHypotheses: 10,
      deadlineEpochMs: Date.now() + deadlineMs,
      catalogContext: record.catalogContext,
    });
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://control-plane.local");
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "http://localhost:5173",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/health") {
      await ready;
      const discoveryDesk = discoveryLedger.projection();
      writeJson(response, 200, {
        ok: true,
        liveExecutionEnabled: false,
        retainedDiscoveryRuns: discoveryDesk.runCount,
        operationalStorage: discoveryDesk.storage,
        modelProvider: modelRuntime.projection,
        investigator: piRuntime.projection,
        investigationDesk: investigationDesk.projection(),
        catalogContext: catalogDesk.projection(),
        catalogObservation: catalogObservationDesk.projection(),
        opportunityRadar: catalogObservationDesk.radar(),
        marketCorpus: projectMarketCorpus(catalogObservationDesk.corpus()),
        marketArchaeologist: marketArchaeologistDesk.projection(),
        realCandidatePreflight: realCandidatePreflightDesk.projection(),
        realCandidateDepth: realCandidatePreflightDesk.depthProjection(),
        realCandidateDisposition:
          realCandidatePreflightDesk.dispositionProjection(),
        realCandidateRescreen: realCandidatePreflightDesk.rescreenProjection(),
        candidateWatch: candidateWatchDesk.projection(),
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/projection") {
      writeJson(response, 200, await projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/books") {
      await ready;
      writeJson(response, 200, bookDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/catalog/observations"
    ) {
      writeJson(response, 200, catalogObservationDesk.projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/radar") {
      await ready;
      writeJson(response, 200, catalogObservationDesk.radar());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/market-corpus") {
      await ready;
      writeJson(
        response,
        200,
        projectMarketCorpus(catalogObservationDesk.corpus()),
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/market-corpus/search"
    ) {
      try {
        await ready;
        writeJson(
          response,
          200,
          searchMarketCorpus(
            catalogObservationDesk.corpus(),
            (await readJson(request)) as MarketCorpusSearchQuery,
          ),
        );
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "market corpus search failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/catalog/observations/refresh"
    ) {
      const pending = catalogObservationDesk.refresh();
      await broadcastProjection();
      const result = await pending;
      await broadcastProjection();
      writeJson(response, result.status === "READY" ? 200 : 207, result);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/qualification"
    ) {
      const current = await projection();
      writeJson(response, 200, current.qualification);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/candidate-watch"
    ) {
      await ready;
      writeJson(response, 200, candidateWatchDesk.projection());
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/candidate-watch/refresh"
    ) {
      await ready;
      const pending = candidateWatchDesk.refresh();
      await broadcastProjection();
      const result = await pending;
      await broadcastProjection();
      writeJson(response, result.status === "READY" ? 200 : 207, result);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      writeJson(response, 200, discoveryLedger.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/investigations"
    ) {
      writeJson(response, 200, investigationDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/market-archaeologist"
    ) {
      writeJson(response, 200, marketArchaeologistDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/research-cases/review-intake"
    ) {
      const caseId = url.searchParams.get("caseId")?.trim() ?? "";
      const current = await projection();
      const researchCase = current.ai.researchDesk.cases.find(
        (item) => item.caseId === caseId,
      );
      if (researchCase === undefined) {
        writeJson(response, 404, {
          ok: false,
          diagnostic: "research case was not found",
          executionAuthority: false,
        });
      } else if (researchCase.reviewIntake === undefined ||
        researchCase.reviewIntake === null) {
        writeJson(response, 409, {
          ok: false,
          caseId,
          diagnostic:
            "research case lacks the retained scout and passed investigation bindings required for a review intake packet",
          executionAuthority: false,
        });
      } else {
        writeJson(response, 200, researchCase.reviewIntake);
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": "http://localhost:5173",
      });
      response.write(
        `event: projection\ndata: ${JSON.stringify(await projection())}\n\n`,
      );
      subscribers.add(response);
      const heartbeat = setInterval(() => {
        response.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
      }, 15_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(response);
      });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/books/replay"
    ) {
      try {
        const books = await bookDesk.replay();
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          effects: {
            externalWrites: false,
            valueMovingActions: false,
            liveExecutionEnabled: false,
          },
          bookDesk: books,
        });
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "book replay failed",
          effects: {
            externalWrites: false,
            valueMovingActions: false,
            liveExecutionEnabled: false,
          },
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      try {
        await ready;
        const task = parseDiscoveryTask(
          await readJson(request),
          catalogDesk,
          catalogObservationDesk,
        );
        const invocation = await invokeDiscovery(task);
        writeJson(response, 200, {
          ...projectDiscoveryRunRecord(invocation.record),
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(response, error instanceof DiscoveryScopeConflictError ? 409 : 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "discovery run failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/market-archaeologist/runs"
    ) {
      try {
        await ready;
        const body = await readJson(request);
        if (
          body === null ||
          typeof body !== "object" ||
          typeof (body as { question?: unknown }).question !== "string" ||
          Object.keys(body).length !== 1
        ) {
          throw new Error("Market Archaeologist run requires exactly one question");
        }
        const question = (body as { question: string }).question
          .trim()
          .replace(/\s+/gu, " ");
        if (question === "" || question.length > 1_000) {
          throw new Error("Market Archaeologist question exceeds bounded input limits");
        }
        const invocation = marketArchaeologistDesk.begin(
          catalogObservationDesk.corpus(),
          question,
        );
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof MarketArchaeologistNotConfiguredError
            ? 503
            : error instanceof MarketArchaeologistBusyError
              ? 409
              : 400,
          {
            ok: false,
            diagnostic:
              error instanceof Error
                ? error.message
                : "Market Archaeologist run failed",
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/radar/triage"
    ) {
      try {
        await ready;
        const scope = catalogObservationDesk.radarTriageScope(
          await readRadarCandidateId(request),
        );
        const task: DiscoveryTask = Object.freeze({
          taskId: scope.candidate.triageTaskId,
          question: scope.question,
          venueIds: scope.venueIds,
          maxHypotheses: 10,
          deadlineEpochMs: Date.now() + 10_000,
          catalogContext: scope.catalogContext,
        });
        const invocation = await invokeDiscovery(task);
        writeJson(response, 200, {
          ...projectDiscoveryRunRecord(invocation.record),
          radarCandidateId: scope.candidate.candidateId,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        writeJson(
          response,
          error instanceof RadarCandidateUnavailableError ||
            error instanceof DiscoveryScopeConflictError
            ? 409
            : 400,
          {
            ok: false,
            diagnostic:
              error instanceof Error ? error.message : "radar triage failed",
            executionAuthority: false,
          },
        );
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/radar/investigate"
    ) {
      try {
        await ready;
        const candidateId = await readRadarCandidateId(request);
        const task = retainedDiscoveryTask(
          radarTriageTaskId(candidateId),
          piRuntime.projection.timeoutMs + 2_000,
        );
        const invocation = investigationDesk.begin(task);
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          radarCandidateId: candidateId,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        const status =
          error instanceof RadarCandidateUnavailableError ||
          error instanceof ResearchContextUnavailableError ||
          error instanceof InvestigationBusyError ||
          error instanceof InvestigationScopeConflictError
            ? 409
            : error instanceof InvestigationNotConfiguredError
              ? 503
              : 500;
        writeJson(response, status, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "radar investigation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/research-cases/investigate"
    ) {
      try {
        await ready;
        const task = retainedDiscoveryTask(
          await readResearchTaskId(request),
          piRuntime.projection.timeoutMs + 2_000,
        );
        const invocation = investigationDesk.begin(task);
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        const status =
          error instanceof ResearchContextUnavailableError ||
          error instanceof InvestigationBusyError ||
          error instanceof InvestigationScopeConflictError
            ? 409
            : error instanceof InvestigationNotConfiguredError
              ? 503
              : 500;
        writeJson(response, status, {
          ok: false,
          diagnostic:
            error instanceof Error
              ? error.message
              : "research case investigation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/investigations"
    ) {
      let task: DiscoveryTask;
      try {
        await ready;
        task = parseDiscoveryTask(
          await readJson(request),
          catalogDesk,
          catalogObservationDesk,
          piRuntime.projection.timeoutMs + 2_000,
        );
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "investigation failed",
          executionAuthority: false,
        });
        return;
      }

      try {
        const invocation = investigationDesk.begin(task);
        await broadcastProjection();
        const record = await invocation.promise;
        await broadcastProjection();
        writeJson(response, record.status === "PASS" ? 200 : 422, {
          ...record,
          idempotentReplay: invocation.idempotentReplay,
        });
      } catch (error) {
        const status =
          error instanceof InvestigationNotConfiguredError
            ? 503
            : error instanceof InvestigationBusyError ||
                error instanceof InvestigationScopeConflictError
              ? 409
              : 500;
        writeJson(response, status, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "investigation failed",
          executionAuthority: false,
        });
      }
      return;
    }
    writeJson(response, 404, {
      ok: false,
      diagnostic: "route not found",
    });
  });
  let archaeologyScheduler: ReturnType<typeof setInterval> | null = null;
  const archaeologyIntervalMs = marketArchaeologistDesk.schedulerIntervalMs;
  if (archaeologyIntervalMs !== null) {
    void ready.then(() => {
      archaeologyScheduler = setInterval(() => {
        const snapshot = catalogObservationDesk.corpus();
        if (!marketArchaeologistDesk.shouldSchedule(snapshot)) return;
        try {
          const invocation = marketArchaeologistDesk.begin(
            snapshot,
            "Search the changed market corpus for cross-venue semantic relationships that could create exact payoff constraints. Prefer non-obvious implication, subset, exclusion, and exhaustive structures; identify falsifiers and missing rule evidence.",
            "SCHEDULE",
          );
          void broadcastProjection();
          void invocation.promise.then(() => broadcastProjection());
        } catch {
          // A later interval retries only when the desk can make progress.
        }
      }, archaeologyIntervalMs);
      archaeologyScheduler.unref();
    });
  }
  server.once("close", () => {
    if (archaeologyScheduler !== null) clearInterval(archaeologyScheduler);
    discoveryLedger.close();
  });
  return {
    server,
    pool,
    bookDesk,
    catalogDesk,
    catalogObservationDesk,
    discoveryLedger,
    investigationDesk,
    piRuntime,
    realCandidatePreflightDesk,
    candidateWatchDesk,
    marketArchaeologistDesk,
    opportunityLifecycleDesk,
    projection,
    ready,
  };
}

export async function startControlPlane(
  port = 4_100,
  host = "127.0.0.1",
  databasePath =
    process.env.PMH_STATE_DB ??
    resolve(import.meta.dirname, "../../../.data/control-plane.sqlite"),
): Promise<void> {
  const { SqliteOperationalStore } = await import("./operational-store.js");
  const discoveryStore = new SqliteOperationalStore(databasePath);
  const { server, ready } = createControlPlane({
    discoveryStore,
    investigationStore: discoveryStore,
    refreshCatalogOnReady: true,
  });
  await ready;
  try {
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolveListen);
    });
    process.stdout.write(
      `control-plane http://${host}:${port} · ${discoveryStore.storage.mode}\n`,
    );
  } catch (error) {
    discoveryStore.close();
    throw error;
  }
}
