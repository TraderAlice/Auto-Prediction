import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import { verifyRawFixture, type VerifiedRawFixture } from "@pmh/evidence";
import type { NormalizedCatalogListing } from "@pmh/protocol";
import { normalizeGeminiCatalog, geminiManifest } from "@pmh/venue-gemini";
import { normalizeKalshiCatalog, kalshiManifest } from "@pmh/venue-kalshi";
import {
  limitlessManifest,
  normalizeLimitlessCatalog,
} from "@pmh/venue-limitless";
import { normalizeMyriadCatalog, myriadManifest } from "@pmh/venue-myriad";
import { normalizeOpinionCatalog, opinionManifest } from "@pmh/venue-opinion";
import {
  normalizePolymarketCatalog,
  polymarketManifest,
} from "@pmh/venue-polymarket";
import {
  buildDiscoveryCatalogContext,
  MAX_LISTINGS_PER_TASK,
  toDiscoveryCatalogListing,
} from "./catalog-discovery.js";
import {
  buildOpportunityRadar,
  type OpportunityRadarCandidate,
  type OpportunityRadarProjection,
} from "./opportunity-radar.js";
import type {
  DiscoveryCatalogContext,
  DiscoveryCatalogListing,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_RETENTION_PER_SOURCE = 5;
const DEFAULT_CONTEXT_MAX_AGE_MS = 15 * 60 * 1_000;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const OBSERVATION_ID_PATTERN = /^catalog-observation:[0-9a-f]{64}$/;
const BYTE_LENGTH_PATTERN = /^(?:0|[1-9]\d*)$/;

export type CatalogObservationRecord = Readonly<{
  schemaVersion: "pmh.catalog-observation.v1";
  observationId: string;
  venueId: string;
  protocolIdentity: string;
  sourceUrl: string;
  receivedAt: string;
  httpStatus: 200;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  rawHash: Hash;
  byteLength: string;
  listingCount: number;
  listingIdentity: Hash;
  acquisition: Readonly<{
    method: "GET";
    credentialsUsed: false;
    valueMovingOperation: false;
  }>;
}>;

export type StoredCatalogObservation = Readonly<{
  record: CatalogObservationRecord;
  bytes: Uint8Array;
}>;

export interface CatalogObservationStore {
  readonly catalogObservationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "observationId";
  }>;
  loadCatalogObservations(limit: number): readonly StoredCatalogObservation[];
  saveCatalogObservation(
    observation: StoredCatalogObservation,
    retentionLimit: number,
  ): StoredCatalogObservation;
}

export type CatalogObservationSourceProjection = Readonly<{
  venueId: string;
  protocolIdentity: string;
  sourceUrl: string;
  status: "NEVER_REFRESHED" | "CURRENT" | "STALE_AFTER_FAILURE" | "FAILED";
  lastAttemptAt: string | null;
  receivedAt: string | null;
  httpStatus: number | null;
  rawHash: Hash | null;
  byteLength: string | null;
  listingCount: number;
  diagnostic: string | null;
  credentialsUsed: false;
  contextEligible: boolean;
  freshUntil: string | null;
}>;

export type CatalogObservationProjection = Readonly<{
  mode: "ANONYMOUS_PUBLIC_GET";
  status: "IDLE" | "REFRESHING" | "READY" | "DEGRADED";
  promotion: "OBSERVE_ONLY";
  contextQualification: Readonly<{
    status: "ELIGIBLE" | "PARTIAL" | "INELIGIBLE";
    eligibleSourceCount: number;
    maxAgeMs: number;
    maxListingsPerTask: number;
    requiresExplicitRequest: true;
    defaultMode: "VERIFIED_FIXTURES";
    authority: "PROPOSE_ONLY";
  }>;
  currentSetIdentity: Hash;
  sourceCount: number;
  healthySourceCount: number;
  listingCount: number;
  timeoutMs: number;
  maxResponseBytes: number;
  storage: CatalogObservationStore["catalogObservationStorage"];
  sources: readonly CatalogObservationSourceProjection[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type CatalogFetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export type CatalogObservationSource = Readonly<{
  venueId: string;
  protocolIdentity: string;
  sourceUrl: string;
  decode: (fixture: VerifiedRawFixture) => readonly NormalizedCatalogListing[];
}>;

export class RadarCandidateUnavailableError extends Error {}

export type RadarTriageScope = Readonly<{
  candidate: OpportunityRadarCandidate;
  question: string;
  venueIds: readonly string[];
  catalogContext: DiscoveryCatalogContext;
}>;

export const catalogObservationSources: readonly CatalogObservationSource[] =
  Object.freeze([
    {
      venueId: polymarketManifest.venueId,
      protocolIdentity: polymarketManifest.protocolIdentity,
      sourceUrl:
        "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20",
      decode: normalizePolymarketCatalog,
    },
    {
      venueId: kalshiManifest.venueId,
      protocolIdentity: kalshiManifest.protocolIdentity,
      sourceUrl:
        "https://external-api.kalshi.com/trade-api/v2/markets?limit=20&status=open",
      decode: normalizeKalshiCatalog,
    },
    {
      venueId: geminiManifest.venueId,
      protocolIdentity: geminiManifest.protocolIdentity,
      sourceUrl:
        "https://api.gemini.com/v1/prediction-markets/events?status=active&limit=5",
      decode: normalizeGeminiCatalog,
    },
    {
      venueId: opinionManifest.venueId,
      protocolIdentity: opinionManifest.protocolIdentity,
      sourceUrl:
        "https://openapi.opinion.trade/openapi/market?status=activated&limit=20",
      decode: normalizeOpinionCatalog,
    },
    {
      venueId: myriadManifest.venueId,
      protocolIdentity: myriadManifest.protocolIdentity,
      sourceUrl:
        "https://api-v2.myriadprotocol.com/markets?page=1&limit=20&state=open",
      decode: normalizeMyriadCatalog,
    },
    {
      venueId: limitlessManifest.venueId,
      protocolIdentity: limitlessManifest.protocolIdentity,
      sourceUrl: "https://api.limitless.exchange/markets/active?limit=20",
      decode: normalizeLimitlessCatalog,
    },
  ]);

type SourceState = {
  source: CatalogObservationSource;
  latest: StoredCatalogObservation | null;
  listings: readonly DiscoveryCatalogListing[];
  lastAttemptAt: string | null;
  diagnostic: string | null;
};

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function compactDiagnostic(value: string, limit = 500): string {
  const compacted = value.trim().replace(/\s+/gu, " ");
  return compacted.length <= limit
    ? compacted
    : `${compacted.slice(0, limit - 1).trimEnd()}…`;
}

function assertRecord(value: unknown): asserts value is CatalogObservationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("catalog observation record is malformed");
  }
  const record = value as Partial<CatalogObservationRecord>;
  if (
    record.schemaVersion !== "pmh.catalog-observation.v1" ||
    typeof record.observationId !== "string" ||
    !OBSERVATION_ID_PATTERN.test(record.observationId) ||
    typeof record.venueId !== "string" ||
    record.venueId === "" ||
    typeof record.protocolIdentity !== "string" ||
    record.protocolIdentity === "" ||
    typeof record.sourceUrl !== "string" ||
    typeof record.receivedAt !== "string" ||
    record.httpStatus !== 200 ||
    typeof record.contentType !== "string" ||
    record.contentType === "" ||
    (record.etag !== null && typeof record.etag !== "string") ||
    (record.lastModified !== null && typeof record.lastModified !== "string") ||
    typeof record.rawHash !== "string" ||
    !HASH_PATTERN.test(record.rawHash) ||
    typeof record.byteLength !== "string" ||
    !BYTE_LENGTH_PATTERN.test(record.byteLength) ||
    !Number.isSafeInteger(record.listingCount) ||
    (record.listingCount ?? -1) < 0 ||
    typeof record.listingIdentity !== "string" ||
    !HASH_PATTERN.test(record.listingIdentity) ||
    record.acquisition === null ||
    typeof record.acquisition !== "object" ||
    record.acquisition.method !== "GET" ||
    record.acquisition.credentialsUsed !== false ||
    record.acquisition.valueMovingOperation !== false
  ) {
    throw new Error("catalog observation record is malformed");
  }
  try {
    new URL(record.sourceUrl);
    if (new Date(record.receivedAt).toISOString() !== record.receivedAt) {
      throw new Error("invalid timestamp");
    }
  } catch {
    throw new Error("catalog observation record is malformed");
  }
  const { observationId: _observationId, ...body } = record;
  const expected = `catalog-observation:${hashCanonical(body).slice(7)}`;
  if (record.observationId !== expected) {
    throw new Error("catalog observation record identity mismatch");
  }
}

export function verifyStoredCatalogObservation(
  observation: StoredCatalogObservation,
): StoredCatalogObservation {
  assertRecord(observation.record);
  if (
    hashBytes(observation.bytes) !== observation.record.rawHash ||
    BigInt(observation.bytes.byteLength) !== BigInt(observation.record.byteLength)
  ) {
    throw new Error("catalog observation raw payload identity mismatch");
  }
  return Object.freeze({
    record: Object.freeze(observation.record),
    bytes: new Uint8Array(observation.bytes),
  });
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const advertised = response.headers.get("content-length");
  if (advertised !== null && BigInt(advertised) > BigInt(maximumBytes)) {
    throw new Error(`response exceeds ${maximumBytes} byte limit`);
  }
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      throw new Error(`response exceeds ${maximumBytes} byte limit`);
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function buildFixture(
  source: CatalogObservationSource,
  receivedAt: string,
  response: Response,
  bytes: Uint8Array,
): VerifiedRawFixture {
  const rawHash = hashBytes(bytes);
  return verifyRawFixture(bytes, {
    schemaVersion: "pmh.raw-fixture.v1",
    name: `${source.venueId}-catalog-observation`,
    venue: source.venueId,
    protocolVersion: source.protocolIdentity,
    sourceUrl: source.sourceUrl,
    fetchedAt: receivedAt,
    httpStatus: response.status,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    rawHash,
    byteLength: bytes.byteLength.toString(),
    acquisition: {
      method: "GET",
      credentialsUsed: false,
      valueMovingOperation: false,
    },
  });
}

function memoryStorage(): CatalogObservationStore["catalogObservationStorage"] {
  return Object.freeze({
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "observationId",
  });
}

export class CatalogObservationDesk {
  readonly #fetcher: CatalogFetchLike;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #retentionLimit: number;
  readonly #contextMaxAgeMs: number;
  readonly #store: CatalogObservationStore | undefined;
  readonly #states: Map<string, SourceState>;
  #refreshing: Promise<CatalogObservationProjection> | null = null;

  public constructor(options: Readonly<{
    fetcher?: CatalogFetchLike;
    now?: () => number;
    timeoutMs?: number;
    maxResponseBytes?: number;
    retentionLimit?: number;
    contextMaxAgeMs?: number;
    store?: CatalogObservationStore;
    sources?: readonly CatalogObservationSource[];
  }> = {}) {
    this.#fetcher = options.fetcher ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxResponseBytes =
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.#retentionLimit =
      options.retentionLimit ?? DEFAULT_RETENTION_PER_SOURCE;
    this.#contextMaxAgeMs =
      options.contextMaxAgeMs ?? DEFAULT_CONTEXT_MAX_AGE_MS;
    assertPositiveInteger(this.#timeoutMs, "catalog observation timeout");
    assertPositiveInteger(
      this.#maxResponseBytes,
      "catalog observation response limit",
    );
    assertPositiveInteger(this.#retentionLimit, "catalog observation retention");
    assertPositiveInteger(
      this.#contextMaxAgeMs,
      "catalog observation context maximum age",
    );
    this.#store = options.store;
    const sources = options.sources ?? catalogObservationSources;
    if (new Set(sources.map((source) => source.venueId)).size !== sources.length) {
      throw new Error("catalog observation sources must have unique venue IDs");
    }
    this.#states = new Map(
      sources.map((source) => [
        source.venueId,
        {
          source,
          latest: null,
          listings: Object.freeze([]),
          lastAttemptAt: null,
          diagnostic: null,
        },
      ]),
    );
    for (const stored of this.#store?.loadCatalogObservations(
      this.#retentionLimit * Math.max(1, this.#states.size),
    ) ?? []) {
      const verified = verifyStoredCatalogObservation(stored);
      const state = this.#states.get(verified.record.venueId);
      if (state === undefined || state.latest !== null) continue;
      if (
        verified.record.protocolIdentity !== state.source.protocolIdentity ||
        verified.record.sourceUrl !== state.source.sourceUrl
      ) {
        throw new Error("stored catalog observation source identity mismatch");
      }
      const fixture = buildFixture(
        state.source,
        verified.record.receivedAt,
        new Response(new Uint8Array(verified.bytes).buffer, {
          status: verified.record.httpStatus,
          headers: {
            "content-type": verified.record.contentType,
            ...(verified.record.etag === null
              ? {}
              : { etag: verified.record.etag }),
            ...(verified.record.lastModified === null
              ? {}
              : { "last-modified": verified.record.lastModified }),
          },
        }),
        verified.bytes,
      );
      const listings = state.source.decode(fixture);
      if (
        listings.length !== verified.record.listingCount ||
        hashCanonical(listings) !== verified.record.listingIdentity
      ) {
        throw new Error("stored catalog observation normalization mismatch");
      }
      state.latest = verified;
      state.listings = Object.freeze(
        listings.map((listing) =>
          toDiscoveryCatalogListing(listing, {
            kind: "LIVE_OBSERVATION",
            receivedAt: verified.record.receivedAt,
          }),
        ),
      );
      state.lastAttemptAt = verified.record.receivedAt;
    }
  }

  public refresh(): Promise<CatalogObservationProjection> {
    if (this.#refreshing !== null) return this.#refreshing;
    const operation = Promise.all(
      [...this.#states.values()].map((state) => this.#refreshSource(state)),
    ).then(
      () => {
        this.#refreshing = null;
        return this.projection();
      },
      (error: unknown) => {
        this.#refreshing = null;
        throw error;
      },
    );
    this.#refreshing = operation;
    return this.#refreshing;
  }

  async #refreshSource(state: SourceState): Promise<void> {
    const attemptedAt = new Date(this.#now()).toISOString();
    state.lastAttemptAt = attemptedAt;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(state.source.sourceUrl, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        headers: {
          accept: "application/json",
          "user-agent": "prediction-market-harness/0.0 research",
        },
        signal: controller.signal,
      });
      if (response.status !== 200) {
        throw new Error(`anonymous catalog GET returned HTTP ${response.status}`);
      }
      const bytes = await readBoundedResponse(response, this.#maxResponseBytes);
      const fixture = buildFixture(state.source, attemptedAt, response, bytes);
      const listings = state.source.decode(fixture);
      const recordBody = Object.freeze({
        schemaVersion: "pmh.catalog-observation.v1" as const,
        venueId: state.source.venueId,
        protocolIdentity: state.source.protocolIdentity,
        sourceUrl: state.source.sourceUrl,
        receivedAt: attemptedAt,
        httpStatus: 200 as const,
        contentType: fixture.metadata.contentType,
        etag: fixture.metadata.etag,
        lastModified: fixture.metadata.lastModified,
        rawHash: fixture.rawHash,
        byteLength: fixture.metadata.byteLength,
        listingCount: listings.length,
        listingIdentity: hashCanonical(listings),
        acquisition: Object.freeze({
          method: "GET" as const,
          credentialsUsed: false as const,
          valueMovingOperation: false as const,
        }),
      });
      const observation = verifyStoredCatalogObservation({
        record: {
          ...recordBody,
          observationId:
            `catalog-observation:${hashCanonical(recordBody).slice(7)}`,
        },
        bytes,
      });
      state.latest =
        this.#store?.saveCatalogObservation(
          observation,
          this.#retentionLimit,
        ) ?? observation;
      state.listings = Object.freeze(
        listings.map((listing) =>
          toDiscoveryCatalogListing(listing, {
            kind: "LIVE_OBSERVATION",
            receivedAt: state.latest?.record.receivedAt ?? attemptedAt,
          }),
        ),
      );
      state.diagnostic = null;
    } catch (error) {
      state.diagnostic = controller.signal.aborted
        ? `anonymous catalog GET timed out after ${this.#timeoutMs} ms`
        : error instanceof Error
          ? compactDiagnostic(error.message)
          : "anonymous catalog GET failed";
    } finally {
      clearTimeout(timeout);
    }
  }

  public context(
    question: string,
    venueIds: readonly string[],
  ): DiscoveryCatalogContext {
    const requested = [...new Set(venueIds)];
    const now = this.#now();
    if (requested.length === 0 || requested.length !== venueIds.length) {
      throw new Error("live catalog context requires unique venue IDs");
    }
    const states = requested.map((venueId) => {
      const state = this.#states.get(venueId);
      if (state === undefined) {
        throw new Error(`live catalog source ${venueId} is not registered`);
      }
      const eligibility = this.#contextEligibility(state, now);
      if (!eligibility.eligible) {
        throw new Error(
          `live catalog source ${venueId} is not context eligible: ${eligibility.reason}`,
        );
      }
      return state;
    });
    return buildDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      states.flatMap((state) => state.listings),
      question,
      requested,
    );
  }

  public radar(): OpportunityRadarProjection {
    const now = this.#now();
    const states = [...this.#states.values()].sort((left, right) =>
      left.source.venueId.localeCompare(right.source.venueId),
    );
    const eligibleStates = states.filter(
      (state) => this.#contextEligibility(state, now).eligible,
    );
    const sourceSetIdentity = hashCanonical(
      eligibleStates.map((state) => ({
        venueId: state.source.venueId,
        rawHash: state.latest?.record.rawHash ?? null,
        listingCount: state.latest?.record.listingCount ?? 0,
      })),
    );
    return buildOpportunityRadar({
      sourceSetIdentity,
      observedListingCount: states.reduce(
        (total, state) => total + state.listings.length,
        0,
      ),
      eligibleSourceCount: eligibleStates.length,
      excludedSourceCount: states.length - eligibleStates.length,
      listings: eligibleStates.flatMap((state) => state.listings),
    });
  }

  public radarTriageScope(candidateId: string): RadarTriageScope {
    if (!/^radar-candidate:[0-9a-f]{64}$/u.test(candidateId)) {
      throw new RadarCandidateUnavailableError("radar candidate ID is invalid");
    }
    const radar = this.radar();
    const candidate = radar.candidates.find(
      (item) => item.candidateId === candidateId,
    );
    if (candidate === undefined) {
      throw new RadarCandidateUnavailableError(
        "radar candidate is no longer present in the fresh source set",
      );
    }
    const listingRefs = candidate.listings.map((listing) => listing.listingRef);
    const requestedRefs = new Set(listingRefs);
    const listings = [...this.#states.values()]
      .flatMap((state) => state.listings)
      .filter((listing) => requestedRefs.has(listing.listingRef))
      .sort((left, right) => left.listingRef.localeCompare(right.listingRef));
    if (
      listings.length !== listingRefs.length ||
      listings.some((listing, index) => listing.listingRef !== listingRefs[index])
    ) {
      throw new RadarCandidateUnavailableError(
        "radar candidate listings are no longer available",
      );
    }
    const venueIds = Object.freeze(
      [...new Set(listings.map((listing) => listing.venueId))].sort(),
    );
    const subject = candidate.sharedTerms
      .filter((term) => term !== "up" && term !== "down")
      .join(" ");
    const timeframe = candidate.timeframe?.toLowerCase() ?? "bounded";
    const question =
      `${(subject === "" ? candidate.sharedTerms.join(" ") : subject).toUpperCase()} ` +
      `${timeframe}: do these listings define the exact same claim and payout ` +
      "partition? Treat matching titles and times as search evidence, not proof.";
    const catalogContext = buildDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      listings,
      question,
      venueIds,
    );
    if (
      catalogContext.listings.length !== listings.length ||
      catalogContext.listings.some(
        (listing, index) => listing.listingRef !== listings[index]?.listingRef,
      )
    ) {
      throw new RadarCandidateUnavailableError(
        "radar candidate could not produce an exact bounded context",
      );
    }
    return Object.freeze({
      candidate,
      question,
      venueIds,
      catalogContext,
    });
  }

  #contextEligibility(
    state: SourceState,
    now: number,
  ): Readonly<{ eligible: boolean; reason: string; freshUntil: string | null }> {
    const receivedAt = state.latest?.record.receivedAt;
    if (receivedAt === undefined || state.listings.length === 0) {
      return { eligible: false, reason: "no successful non-empty observation", freshUntil: null };
    }
    const freshUntilMs = Date.parse(receivedAt) + this.#contextMaxAgeMs;
    const freshUntil = new Date(freshUntilMs).toISOString();
    if (state.diagnostic !== null) {
      return { eligible: false, reason: "latest refresh failed", freshUntil };
    }
    if (now > freshUntilMs) {
      return { eligible: false, reason: "last observation is stale", freshUntil };
    }
    return { eligible: true, reason: "qualified", freshUntil };
  }

  public projection(): CatalogObservationProjection {
    const now = this.#now();
    const sources = Object.freeze(
      [...this.#states.values()]
        .sort((left, right) =>
          left.source.venueId.localeCompare(right.source.venueId),
        )
        .map((state): CatalogObservationSourceProjection => {
          const record = state.latest?.record ?? null;
          const eligibility = this.#contextEligibility(state, now);
          return Object.freeze({
            venueId: state.source.venueId,
            protocolIdentity: state.source.protocolIdentity,
            sourceUrl: state.source.sourceUrl,
            status:
              state.diagnostic === null
                ? record === null
                  ? "NEVER_REFRESHED"
                  : "CURRENT"
                : record === null
                  ? "FAILED"
                  : "STALE_AFTER_FAILURE",
            lastAttemptAt: state.lastAttemptAt,
            receivedAt: record?.receivedAt ?? null,
            httpStatus: record?.httpStatus ?? null,
            rawHash: record?.rawHash ?? null,
            byteLength: record?.byteLength ?? null,
            listingCount: record?.listingCount ?? 0,
            diagnostic: state.diagnostic,
            credentialsUsed: false,
            contextEligible: eligibility.eligible,
            freshUntil: eligibility.freshUntil,
          });
        }),
    );
    const healthySourceCount = sources.filter(
      (source) => source.status === "CURRENT",
    ).length;
    const eligibleSourceCount = sources.filter(
      (source) => source.contextEligible,
    ).length;
    const status =
      this.#refreshing !== null
        ? "REFRESHING"
        : sources.every((source) => source.status === "NEVER_REFRESHED")
          ? "IDLE"
          : healthySourceCount === sources.length
            ? "READY"
            : "DEGRADED";
    return Object.freeze({
      mode: "ANONYMOUS_PUBLIC_GET",
      status,
      promotion: "OBSERVE_ONLY",
      contextQualification: Object.freeze({
        status:
          eligibleSourceCount === sources.length && sources.length > 0
            ? "ELIGIBLE"
            : eligibleSourceCount > 0
              ? "PARTIAL"
              : "INELIGIBLE",
        eligibleSourceCount,
        maxAgeMs: this.#contextMaxAgeMs,
        maxListingsPerTask: MAX_LISTINGS_PER_TASK,
        requiresExplicitRequest: true,
        defaultMode: "VERIFIED_FIXTURES",
        authority: "PROPOSE_ONLY",
      }),
      currentSetIdentity: hashCanonical(
        sources.map((source) => ({
          venueId: source.venueId,
          rawHash: source.rawHash,
          listingCount: source.listingCount,
        })),
      ),
      sourceCount: sources.length,
      healthySourceCount,
      listingCount: sources.reduce(
        (total, source) => total + source.listingCount,
        0,
      ),
      timeoutMs: this.#timeoutMs,
      maxResponseBytes: this.#maxResponseBytes,
      storage: this.#store?.catalogObservationStorage ?? memoryStorage(),
      sources,
      effects: Object.freeze({
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}
