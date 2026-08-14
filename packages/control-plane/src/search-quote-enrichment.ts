import {
  formatFixed,
  hashBytes,
  hashCanonical,
  parseFixed,
  type Hash,
} from "@pmh/domain";
import {
  normalizeOpinionOrderbookBestAsk,
  OPINION_ORDERBOOK_PROTOCOL_IDENTITY,
} from "@pmh/venue-opinion";
import {
  GEMINI_EVENT_DETAIL_PROTOCOL_IDENTITY,
  geminiEventTickerFromInstrumentSymbol,
  normalizeGeminiEventDetailQuote,
} from "@pmh/venue-gemini";
import {
  buildMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";
import type { DiscoveryCatalogListing } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_RETENTION_LIMIT = 100;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/u;
const HASH = /^sha256:[0-9a-f]{64}$/u;

export type OpinionSearchQuoteObservationRecord = Readonly<{
  schemaVersion: "pmh.search-quote-observation.v1";
  observationId: Hash;
  listingRef: string;
  venueId: "opinion";
  venueInstrumentId: string;
  outcomeLabel: string;
  instrumentId: string;
  listingSourceRawHash: string;
  listingProtocolIdentity: string;
  protocolIdentity: typeof OPINION_ORDERBOOK_PROTOCOL_IDENTITY;
  sourceUrl: string;
  receivedAt: string;
  httpStatus: 200;
  contentType: string;
  rawHash: Hash;
  byteLength: string;
  nativeTimestamp: string;
  bestAsk: string;
  priceScale: string;
  acquisition: Readonly<{
    method: "GET";
    credentialsUsed: false;
    redirectPolicy: "ERROR";
    valueMovingOperation: false;
  }>;
  authority: "SEARCH_PRICE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type GeminiSearchQuoteObservationRecord = Readonly<{
  schemaVersion: "pmh.search-quote-observation.v2";
  observationId: Hash;
  listingRef: string;
  venueId: "gemini-predictions";
  venueInstrumentId: string;
  outcomeLabel: string;
  eventTicker: string;
  instrumentSymbol: string;
  listingSourceRawHash: string;
  listingProtocolIdentity: string;
  protocolIdentity: typeof GEMINI_EVENT_DETAIL_PROTOCOL_IDENTITY;
  sourceUrl: string;
  receivedAt: string;
  httpStatus: 200;
  contentType: string;
  rawHash: Hash;
  byteLength: string;
  bestAsk: string;
  priceScale: string;
  acquisition: Readonly<{
    method: "GET";
    credentialsUsed: false;
    redirectPolicy: "ERROR";
    valueMovingOperation: false;
  }>;
  authority: "SEARCH_PRICE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type SearchQuoteObservationRecord =
  | OpinionSearchQuoteObservationRecord
  | GeminiSearchQuoteObservationRecord;

export type StoredSearchQuoteObservation = Readonly<{
  record: SearchQuoteObservationRecord;
  bytes: Uint8Array;
}>;

export interface SearchQuoteObservationStore {
  readonly searchQuoteObservationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "observationId";
  }>;
  loadSearchQuoteObservations(
    limit: number,
  ): readonly StoredSearchQuoteObservation[];
  saveSearchQuoteObservation(
    observation: StoredSearchQuoteObservation,
    retentionLimit: number,
  ): StoredSearchQuoteObservation;
}

export type SearchQuoteEnrichmentResult = Readonly<{
  status: "NOT_REQUIRED" | "READY" | "PARTIAL" | "UNSUPPORTED" | "FAILED";
  requestedListingCount: number;
  attemptedOutcomeCount: number;
  enrichedOutcomeCount: number;
  listings: readonly DiscoveryCatalogListing[];
  observationIds: readonly Hash[];
  diagnostics: readonly string[];
  authority: "SEARCH_PRICE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    anonymousPublicGets: boolean;
    credentialsUsed: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type SearchQuoteEnrichmentProjection = Readonly<{
  schemaVersion: "pmh.search-quote-enrichment-desk.v1";
  mode: "ANONYMOUS_PUBLIC_GET";
  status: "IDLE" | "REFRESHING";
  runCount: number;
  readyCount: number;
  partialCount: number;
  failedCount: number;
  unsupportedCount: number;
  retainedObservationCount: number;
  timeoutMs: number;
  maxResponseBytes: number;
  retentionLimit: number;
  supportedVenues: readonly ["gemini-predictions", "opinion"];
  storage: SearchQuoteObservationStore["searchQuoteObservationStorage"];
  observations: readonly SearchQuoteObservationRecord[];
  authority: "SEARCH_PRICE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type SearchQuoteFetchLike = (
  input: string,
  init: Readonly<{
    method: "GET";
    credentials: "omit";
    redirect: "error";
    headers: Readonly<Record<string, string>>;
    signal: AbortSignal;
  }>,
) => Promise<Response>;

type SearchQuoteEnrichmentOptions = Readonly<{
  fetch?: SearchQuoteFetchLike;
  store?: SearchQuoteObservationStore;
  now?: () => number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  retentionLimit?: number;
}>;

function compactDiagnostic(value: unknown): string {
  const text = (value instanceof Error ? value.message : String(value))
    .replace(/\s+/gu, " ")
    .trim();
  return text.length <= 300 ? text : `${text.slice(0, 299)}…`;
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (
    declared !== null &&
    UNSIGNED_INTEGER.test(declared) &&
    BigInt(declared) > BigInt(maximumBytes)
  ) {
    throw new Error(`response exceeds ${maximumBytes} bytes`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new Error(`response exceeds ${maximumBytes} bytes`);
  }
  return bytes;
}

function copyStored(
  observation: StoredSearchQuoteObservation,
): StoredSearchQuoteObservation {
  return Object.freeze({
    record: observation.record,
    bytes: new Uint8Array(observation.bytes),
  });
}

export function verifyStoredSearchQuoteObservation(
  observation: StoredSearchQuoteObservation,
): StoredSearchQuoteObservation {
  const record = observation.record;
  if (
    record === null ||
    typeof record !== "object" ||
    !["pmh.search-quote-observation.v1", "pmh.search-quote-observation.v2"]
      .includes(record.schemaVersion) ||
    !HASH.test(String(record.observationId)) ||
    typeof record.listingRef !== "string" || record.listingRef === "" ||
    !["opinion", "gemini-predictions"].includes(record.venueId) ||
    typeof record.venueInstrumentId !== "string" || record.venueInstrumentId === "" ||
    typeof record.outcomeLabel !== "string" || record.outcomeLabel === "" ||
    !HASH.test(record.listingSourceRawHash) ||
    typeof record.listingProtocolIdentity !== "string" || record.listingProtocolIdentity === "" ||
    typeof record.sourceUrl !== "string" ||
    typeof record.receivedAt !== "string" ||
    record.httpStatus !== 200 ||
    typeof record.contentType !== "string" ||
    !HASH.test(record.rawHash) ||
    !UNSIGNED_INTEGER.test(record.byteLength) ||
    !DECIMAL.test(record.bestAsk) ||
    !UNSIGNED_INTEGER.test(record.priceScale) || BigInt(record.priceScale) <= 0n ||
    record.acquisition?.method !== "GET" ||
    record.acquisition.credentialsUsed !== false ||
    record.acquisition.redirectPolicy !== "ERROR" ||
    record.acquisition.valueMovingOperation !== false ||
    record.authority !== "SEARCH_PRICE_EVIDENCE_ONLY" ||
    record.semanticDecisionAuthority !== false ||
    record.simulationAuthority !== false ||
    record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    !(observation.bytes instanceof Uint8Array) ||
    observation.bytes.byteLength.toString() !== record.byteLength ||
    hashBytes(observation.bytes) !== record.rawHash
  ) throw new Error("search quote observation is malformed");
  try {
    const url = new URL(record.sourceUrl);
    if (url.protocol !== "https:" ||
        new Date(record.receivedAt).toISOString() !== record.receivedAt ||
        parseFixed(record.bestAsk, BigInt(record.priceScale)) > BigInt(record.priceScale)) {
      throw new Error("invalid source binding");
    }
    if (record.schemaVersion === "pmh.search-quote-observation.v1") {
      if (record.venueId !== "opinion" ||
          typeof record.instrumentId !== "string" ||
          !UNSIGNED_INTEGER.test(record.instrumentId) ||
          !UNSIGNED_INTEGER.test(record.nativeTimestamp) ||
          record.protocolIdentity !== OPINION_ORDERBOOK_PROTOCOL_IDENTITY ||
          url.hostname !== "openapi.opinion.trade" ||
          url.pathname !== "/openapi/token/orderbook" ||
          url.searchParams.get("token_id") !== record.instrumentId ||
          [...url.searchParams.keys()].some((key) => key !== "token_id")) {
        throw new Error("invalid Opinion source binding");
      }
    } else {
      if (record.venueId !== "gemini-predictions" ||
          record.protocolIdentity !== GEMINI_EVENT_DETAIL_PROTOCOL_IDENTITY ||
          record.instrumentSymbol !== record.venueInstrumentId ||
          geminiEventTickerFromInstrumentSymbol(record.instrumentSymbol) !==
            record.eventTicker || url.hostname !== "api.gemini.com" ||
          url.pathname !== `/v1/prediction-markets/events/${record.eventTicker}` ||
          url.search !== "") {
        throw new Error("invalid Gemini source binding");
      }
      const detail = normalizeGeminiEventDetailQuote(observation.bytes,
        record.instrumentSymbol);
      const nativeAsk = record.outcomeLabel.trim().toLowerCase() === "yes"
        ? detail.yesAsk : record.outcomeLabel.trim().toLowerCase() === "no"
          ? detail.noAsk : null;
      if (nativeAsk === null || parseFixed(nativeAsk, BigInt(record.priceScale)) !==
          parseFixed(record.bestAsk, BigInt(record.priceScale))) {
        throw new Error("Gemini quote does not match exact event detail bytes");
      }
    }
  } catch {
    throw new Error("search quote observation source binding is malformed");
  }
  const { observationId: _observationId, ...body } = record;
  if (hashCanonical(body) !== record.observationId) {
    throw new Error("search quote observation identity mismatch");
  }
  return copyStored(observation);
}

function resultEffects(anonymousPublicGets: boolean) {
  return Object.freeze({
    anonymousPublicGets,
    credentialsUsed: false as const,
    externalWrites: false as const,
    valueMovingActions: false as const,
    liveExecutionEnabled: false as const,
  });
}

export function applySearchQuoteObservations(
  listing: DiscoveryCatalogListing,
  observations: readonly SearchQuoteObservationRecord[],
): DiscoveryCatalogListing | null {
  const matching = observations.filter((record) =>
    record.listingRef === listing.listingRef &&
    record.venueInstrumentId === listing.venueInstrumentId &&
    record.listingSourceRawHash === listing.sourceRawHash &&
    record.listingProtocolIdentity === listing.protocolIdentity)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt) ||
      right.observationId.localeCompare(left.observationId));
  if (matching.length === 0) return null;
  const latestByOutcome = new Map<string, SearchQuoteObservationRecord>();
  for (const record of matching) {
    const key = record.outcomeLabel.trim().toLowerCase();
    if (!latestByOutcome.has(key)) latestByOutcome.set(key, record);
  }
  const used = [...latestByOutcome.values()].sort((left, right) =>
    left.observationId.localeCompare(right.observationId));
  return Object.freeze({ ...listing,
    outcomes: Object.freeze(listing.outcomes.map((outcome) => {
      const record = latestByOutcome.get(outcome.label.trim().toLowerCase());
      return Object.freeze({ ...outcome,
        indicativePrice: record?.bestAsk ?? outcome.indicativePrice });
    })),
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: used.map((item) => item.receivedAt).sort().at(-1)!,
    sourceRawHash: hashCanonical({ schemaVersion: "pmh.search-quote-overlay.v1",
      observationIds: used.map((item) => item.observationId) }),
    protocolIdentity: "search-quote-overlay.v1",
  });
}

export function buildSearchQuoteOverlayCorpus(input: Readonly<{
  semanticCorpus: MarketCorpusSnapshot;
  currentCorpus: MarketCorpusSnapshot;
  observations: readonly SearchQuoteObservationRecord[];
}>): MarketCorpusSnapshot {
  const currentListingByRef = new Map(input.currentCorpus.listings.map((item) =>
    [item.listingRef, item] as const));
  const listings = input.semanticCorpus.listings.flatMap((listing) => {
    const observedCurrent = currentListingByRef.get(listing.listingRef) ?? null;
    const current = observedCurrent !== null &&
        observedCurrent.venueId === listing.venueId &&
        observedCurrent.venueInstrumentId === listing.venueInstrumentId
      ? observedCurrent : null;
    const targeted = applySearchQuoteObservations(listing, input.observations);
    const selected = targeted !== null && (current === null ||
      targeted.sourceReceivedAt > current.sourceReceivedAt) ? targeted : current;
    return selected === null ? [] : [selected];
  });
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({
      schemaVersion: "pmh.search-quote-overlay-source-set.v1",
      currentCorpusSnapshotIdentity: input.currentCorpus.snapshotIdentity,
      semanticCorpusSnapshotIdentity: input.semanticCorpus.snapshotIdentity,
      observationIds: input.observations.map((item) => item.observationId).sort(),
    }),
    eligibleSourceCount: listings.length === 0 ? 0 : 1,
    excludedSourceCount: 0,
    listings,
  });
}

export class SearchQuoteEnrichmentDesk {
  readonly #fetch: SearchQuoteFetchLike;
  readonly #store: SearchQuoteObservationStore | undefined;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #retentionLimit: number;
  readonly #observations: StoredSearchQuoteObservation[];
  #active = 0;
  #runCount = 0;
  #readyCount = 0;
  #partialCount = 0;
  #failedCount = 0;
  #unsupportedCount = 0;

  public constructor(options: SearchQuoteEnrichmentOptions = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxResponseBytes =
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    if (
      !Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 || this.#timeoutMs > 30_000 ||
      !Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1_024 || this.#maxResponseBytes > 2_000_000 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 4 || this.#retentionLimit > 1_000
    ) throw new Error("search quote enrichment configuration is invalid or unbounded");
    this.#observations = [
      ...(this.#store?.loadSearchQuoteObservations(this.#retentionLimit) ?? []),
    ].map(verifyStoredSearchQuoteObservation);
  }

  public async enrich(
    listings: readonly DiscoveryCatalogListing[],
  ): Promise<SearchQuoteEnrichmentResult> {
    if (listings.length !== 2 || new Set(listings.map((item) => item.listingRef)).size !== 2) {
      throw new Error("search quote enrichment requires exactly two distinct listings");
    }
    const targets = listings.flatMap((listing, listingIndex) =>
      listing.outcomes.flatMap((outcome, outcomeIndex) => {
        const label = outcome.label.trim().toLowerCase();
        return outcome.indicativePrice === null &&
            ["yes", "no", "up", "down"].includes(label)
          ? [{ listing, listingIndex, outcome, outcomeIndex }]
          : [];
      }),
    );
    if (targets.length === 0) {
      return Object.freeze({
        status: "NOT_REQUIRED",
        requestedListingCount: listings.length,
        attemptedOutcomeCount: 0,
        enrichedOutcomeCount: 0,
        listings: Object.freeze([...listings]),
        observationIds: Object.freeze([]),
        diagnostics: Object.freeze([]),
        authority: "SEARCH_PRICE_EVIDENCE_ONLY",
        semanticDecisionAuthority: false,
        simulationAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
        effects: resultEffects(false),
      });
    }
    const supported = targets.filter(({ listing }) =>
      listing.venueId === "opinion" || listing.venueId === "gemini-predictions");
    if (supported.length === 0) {
      this.#unsupportedCount += 1;
      return Object.freeze({
        status: "UNSUPPORTED",
        requestedListingCount: listings.length,
        attemptedOutcomeCount: 0,
        enrichedOutcomeCount: 0,
        listings: Object.freeze([...listings]),
        observationIds: Object.freeze([]),
        diagnostics: Object.freeze(["Missing prices belong to unsupported anonymous-book venues."]),
        authority: "SEARCH_PRICE_EVIDENCE_ONLY",
        semanticDecisionAuthority: false,
        simulationAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
        effects: resultEffects(false),
      });
    }
    this.#runCount += 1;
    this.#active += 1;
    const enriched = listings.map((listing) => ({
      ...listing,
      outcomes: listing.outcomes.map((outcome) => ({ ...outcome })),
    }));
    const observationIds: Hash[] = [];
    const diagnostics: string[] = supported.length === targets.length
      ? []
      : ["Some missing prices belong to unsupported anonymous-book venues."];
    let enrichedOutcomeCount = 0;
    const geminiCaptures = new Map<string, Readonly<{
      bytes: Uint8Array;
      contentType: string;
      receivedAt: string;
      detail: ReturnType<typeof normalizeGeminiEventDetailQuote>;
    }>>();
    try {
      for (const target of supported) {
        try {
          if (target.listing.venueId === "gemini-predictions") {
            const priceScale = BigInt(target.listing.priceScale);
            if (priceScale <= 0n) throw new Error("leased listing scale is invalid");
            const eventTicker = geminiEventTickerFromInstrumentSymbol(
              target.listing.venueInstrumentId,
            );
            const sourceUrl = `https://api.gemini.com/v1/prediction-markets/events/${eventTicker}`;
            let capture = geminiCaptures.get(target.listing.listingRef);
            if (capture === undefined) {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
              let response: Response;
              try {
                response = await this.#fetch(sourceUrl, { method: "GET",
                  credentials: "omit", redirect: "error",
                  headers: Object.freeze({ accept: "application/json" }),
                  signal: controller.signal });
              } finally {
                clearTimeout(timeout);
              }
              if (response.status !== 200) {
                throw new Error(`Gemini event detail returned HTTP ${response.status}`);
              }
              const bytes = await readBoundedResponse(response, this.#maxResponseBytes);
              const detail = normalizeGeminiEventDetailQuote(bytes,
                target.listing.venueInstrumentId);
              if (detail.contractStatus.toLowerCase() !== "active" ||
                  detail.marketState?.toLowerCase() !== "open") {
                throw new Error("Gemini event detail contract is not active and open");
              }
              capture = Object.freeze({ bytes,
                contentType: response.headers.get("content-type") ??
                  "application/octet-stream",
                receivedAt: new Date(this.#now()).toISOString(), detail });
              geminiCaptures.set(target.listing.listingRef, capture);
            }
            const outcome = target.outcome.label.trim().toLowerCase();
            const nativeAsk = outcome === "yes" ? capture.detail.yesAsk
              : outcome === "no" ? capture.detail.noAsk : null;
            if (nativeAsk === null) throw new Error("Gemini event detail omits the ask");
            const bestAsk = formatFixed(parseFixed(nativeAsk, priceScale), priceScale);
            const body = Object.freeze({
              schemaVersion: "pmh.search-quote-observation.v2" as const,
              listingRef: target.listing.listingRef,
              venueId: "gemini-predictions" as const,
              venueInstrumentId: target.listing.venueInstrumentId,
              outcomeLabel: target.outcome.label, eventTicker,
              instrumentSymbol: target.listing.venueInstrumentId,
              listingSourceRawHash: target.listing.sourceRawHash,
              listingProtocolIdentity: target.listing.protocolIdentity,
              protocolIdentity: GEMINI_EVENT_DETAIL_PROTOCOL_IDENTITY,
              sourceUrl, receivedAt: capture.receivedAt, httpStatus: 200 as const,
              contentType: capture.contentType, rawHash: hashBytes(capture.bytes),
              byteLength: capture.bytes.byteLength.toString(), bestAsk,
              priceScale: priceScale.toString(),
              acquisition: Object.freeze({ method: "GET" as const,
                credentialsUsed: false as const, redirectPolicy: "ERROR" as const,
                valueMovingOperation: false as const }),
              authority: "SEARCH_PRICE_EVIDENCE_ONLY" as const,
              semanticDecisionAuthority: false as const,
              simulationAuthority: false as const,
              certificateAuthority: false as const,
              executionAuthority: false as const,
            });
            const stored = verifyStoredSearchQuoteObservation(Object.freeze({
              record: Object.freeze({ ...body, observationId: hashCanonical(body) }),
              bytes: capture.bytes,
            }));
            const persisted = this.#store?.saveSearchQuoteObservation(stored,
              this.#retentionLimit) ?? stored;
            this.#retain(persisted);
            const listing = enriched[target.listingIndex]!;
            listing.outcomes[target.outcomeIndex] = {
              ...listing.outcomes[target.outcomeIndex]!,
              indicativePrice: persisted.record.bestAsk,
            };
            observationIds.push(persisted.record.observationId);
            enrichedOutcomeCount += 1;
            continue;
          }
          if (!UNSIGNED_INTEGER.test(target.outcome.venueOutcomeId)) {
            throw new Error("Opinion outcome token id is invalid");
          }
          const priceScale = BigInt(target.listing.priceScale);
          const quantityScale = BigInt(target.listing.quantityScale);
          if (priceScale <= 0n || quantityScale <= 0n) {
            throw new Error("leased listing scales are invalid");
          }
          const sourceUrl = `https://openapi.opinion.trade/openapi/token/orderbook?token_id=${encodeURIComponent(target.outcome.venueOutcomeId)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
          let response: Response;
          try {
            response = await this.#fetch(sourceUrl, {
              method: "GET",
              credentials: "omit",
              redirect: "error",
              headers: Object.freeze({ accept: "application/json" }),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }
          if (response.status !== 200) {
            throw new Error(`Opinion orderbook returned HTTP ${response.status}`);
          }
          const bytes = await readBoundedResponse(response, this.#maxResponseBytes);
          const parsed = normalizeOpinionOrderbookBestAsk(
            bytes,
            target.outcome.venueOutcomeId,
            priceScale,
            quantityScale,
          );
          const receivedAt = new Date(this.#now()).toISOString();
          const body = Object.freeze({
            schemaVersion: "pmh.search-quote-observation.v1" as const,
            listingRef: target.listing.listingRef,
            venueId: "opinion" as const,
            venueInstrumentId: target.listing.venueInstrumentId,
            outcomeLabel: target.outcome.label,
            instrumentId: target.outcome.venueOutcomeId,
            listingSourceRawHash: target.listing.sourceRawHash,
            listingProtocolIdentity: target.listing.protocolIdentity,
            protocolIdentity: OPINION_ORDERBOOK_PROTOCOL_IDENTITY,
            sourceUrl,
            receivedAt,
            httpStatus: 200 as const,
            contentType: response.headers.get("content-type") ?? "application/octet-stream",
            rawHash: hashBytes(bytes),
            byteLength: bytes.byteLength.toString(),
            nativeTimestamp: parsed.nativeTimestamp,
            bestAsk: formatFixed(parsed.bestAsk, priceScale),
            priceScale: priceScale.toString(),
            acquisition: Object.freeze({
              method: "GET" as const,
              credentialsUsed: false as const,
              redirectPolicy: "ERROR" as const,
              valueMovingOperation: false as const,
            }),
            authority: "SEARCH_PRICE_EVIDENCE_ONLY" as const,
            semanticDecisionAuthority: false as const,
            simulationAuthority: false as const,
            certificateAuthority: false as const,
            executionAuthority: false as const,
          });
          const stored = verifyStoredSearchQuoteObservation(Object.freeze({
            record: Object.freeze({
              ...body,
              observationId: hashCanonical(body),
            }),
            bytes,
          }));
          const persisted = this.#store?.saveSearchQuoteObservation(
            stored,
            this.#retentionLimit,
          ) ?? stored;
          this.#retain(persisted);
          const listing = enriched[target.listingIndex]!;
          listing.outcomes[target.outcomeIndex] = {
            ...listing.outcomes[target.outcomeIndex]!,
            indicativePrice: persisted.record.bestAsk,
          };
          observationIds.push(persisted.record.observationId);
          enrichedOutcomeCount += 1;
        } catch (error) {
          diagnostics.push(
            `${target.listing.listingRef}/${target.outcome.label}: ${compactDiagnostic(error)}`,
          );
        }
      }
    } finally {
      this.#active -= 1;
    }
    const allTargetsSupported = supported.length === targets.length;
    const status = enrichedOutcomeCount === targets.length
      ? "READY" as const
      : enrichedOutcomeCount > 0
        ? "PARTIAL" as const
        : allTargetsSupported
          ? "FAILED" as const
          : "UNSUPPORTED" as const;
    if (status === "READY") this.#readyCount += 1;
    else if (status === "PARTIAL") this.#partialCount += 1;
    else if (status === "FAILED") this.#failedCount += 1;
    else this.#unsupportedCount += 1;
    return Object.freeze({
      status,
      requestedListingCount: listings.length,
      attemptedOutcomeCount: supported.length,
      enrichedOutcomeCount,
      listings: Object.freeze(enriched.map((listing) => Object.freeze({
        ...listing,
        outcomes: Object.freeze(listing.outcomes.map((outcome) =>
          Object.freeze({ ...outcome })
        )),
      }))),
      observationIds: Object.freeze(observationIds),
      diagnostics: Object.freeze(diagnostics.slice(0, 8)),
      authority: "SEARCH_PRICE_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: resultEffects(supported.length > 0),
    });
  }

  public projection(): SearchQuoteEnrichmentProjection {
    return Object.freeze({
      schemaVersion: "pmh.search-quote-enrichment-desk.v1",
      mode: "ANONYMOUS_PUBLIC_GET",
      status: this.#active > 0 ? "REFRESHING" : "IDLE",
      runCount: this.#runCount,
      readyCount: this.#readyCount,
      partialCount: this.#partialCount,
      failedCount: this.#failedCount,
      unsupportedCount: this.#unsupportedCount,
      retainedObservationCount: this.#observations.length,
      timeoutMs: this.#timeoutMs,
      maxResponseBytes: this.#maxResponseBytes,
      retentionLimit: this.#retentionLimit,
      supportedVenues: Object.freeze(["gemini-predictions", "opinion"] as const),
      storage: this.#store?.searchQuoteObservationStorage ?? Object.freeze({
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "observationId",
      }),
      observations: Object.freeze(this.#observations.map(({ record }) => record)),
      authority: "SEARCH_PRICE_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }

  #retain(observation: StoredSearchQuoteObservation): void {
    const existing = this.#observations.findIndex(
      (item) => item.record.observationId === observation.record.observationId,
    );
    if (existing >= 0) this.#observations.splice(existing, 1);
    this.#observations.unshift(copyStored(observation));
    this.#observations.splice(this.#retentionLimit);
  }
}
