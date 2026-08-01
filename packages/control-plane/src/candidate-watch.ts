import { randomUUID } from "node:crypto";
import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import { verifyRawFixture, type VerifiedRawFixture } from "@pmh/evidence";
import { parseJsonWithNumberLexemes } from "@pmh/protocol";
import { RealCandidatePreflightDesk } from "./real-candidate-preflight.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_RETENTION_PER_SOURCE = 10;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const OBSERVATION_ID_PATTERN = /^candidate-book-observation:[0-9a-f]{64}$/u;
const REFRESH_ID_PATTERN = /^candidate-watch-refresh:[0-9a-f]{64}$/u;
const BYTE_LENGTH_PATTERN = /^(?:0|[1-9]\d*)$/u;

export type CandidateWatchVenueId = "limitless" | "polymarket-global";

export type CandidateWatchSource = Readonly<{
  venueId: CandidateWatchVenueId;
  fixtureName: string;
  protocolIdentity: string;
  sourceUrl: string;
}>;

export const candidateWatchSources: readonly CandidateWatchSource[] =
  Object.freeze([
    Object.freeze({
      venueId: "polymarket-global" as const,
      fixtureName: "polymarket-trump-out-2027-book-watch",
      protocolIdentity: "clob-book-rest:2026-08-01",
      sourceUrl:
        "https://clob.polymarket.com/book?token_id=59252515735652674747158950210016502214756531287333895140318848923768750410355",
    }),
    Object.freeze({
      venueId: "limitless" as const,
      fixtureName: "limitless-trump-out-2027-book-watch",
      protocolIdentity: "api-v1-orderbook:2026-08-01",
      sourceUrl:
        "https://api.limitless.exchange/markets/trump-out-as-president-before-2027-1768933068297/orderbook",
    }),
  ]);

export type CandidateBookObservationRecord = Readonly<{
  schemaVersion: "pmh.candidate-book-observation.v1";
  observationId: string;
  refreshId: string;
  candidateClaimIdentity: Hash;
  venueId: CandidateWatchVenueId;
  protocolIdentity: string;
  sourceUrl: string;
  receivedAt: string;
  httpStatus: 200;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  rawHash: Hash;
  byteLength: string;
  nativeGeneration: string | null;
  acquisition: Readonly<{
    method: "GET";
    credentialsUsed: false;
    valueMovingOperation: false;
  }>;
}>;

export type StoredCandidateBookObservation = Readonly<{
  record: CandidateBookObservationRecord;
  bytes: Uint8Array;
}>;

export interface CandidateBookObservationStore {
  readonly candidateBookObservationStorage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "observationId";
  }>;
  loadCandidateBookObservations(
    limit: number,
  ): readonly StoredCandidateBookObservation[];
  saveCandidateBookObservation(
    observation: StoredCandidateBookObservation,
    retentionLimit: number,
  ): StoredCandidateBookObservation;
}

export type CandidateWatchFetchLike = (
  input: string,
  init: Readonly<{
    method: "GET";
    credentials: "omit";
    redirect: "error";
    headers: Readonly<Record<string, string>>;
    signal: AbortSignal;
  }>,
) => Promise<Response>;

export type CandidateWatchDecision =
  | Readonly<{
      status: "UNCHANGED_BOUND_SNAPSHOT";
      changedVenueIds: readonly CandidateWatchVenueId[];
      snapshotIdentity: Hash;
      depthArtifactHash: Hash;
      dispositionArtifactHash: Hash;
      grossFloorBeforeFees: string;
      postFeeFloorUpperBound: string;
      priorDecisionReused: true;
      reviewRequired: false;
      independentReviewInvoked: false;
      verifierInvoked: false;
      arbitrageVerified: false;
    }>
  | Readonly<{
      status: "REJECTED_ECONOMICS";
      changedVenueIds: readonly CandidateWatchVenueId[];
      snapshotIdentity: Hash;
      depthArtifactHash: Hash;
      dispositionArtifactHash: Hash;
      grossFloorBeforeFees: string;
      postFeeFloorUpperBound: string;
      priorDecisionReused: false;
      reviewRequired: false;
      independentReviewInvoked: false;
      verifierInvoked: false;
      arbitrageVerified: false;
    }>
  | Readonly<{
      status: "POSITIVE_GROSS_REQUIRES_QUALIFICATION";
      changedVenueIds: readonly CandidateWatchVenueId[];
      snapshotIdentity: Hash;
      depthArtifactHash: Hash;
      dispositionArtifactHash: null;
      grossFloorBeforeFees: string;
      postFeeFloorUpperBound: null;
      priorDecisionReused: false;
      reviewRequired: true;
      independentReviewInvoked: false;
      verifierInvoked: false;
      arbitrageVerified: false;
    }>;

export type CandidateWatchProjection = Readonly<{
  schemaVersion: "pmh.candidate-watch.v1";
  mode: "ANONYMOUS_PUBLIC_GET";
  status: "IDLE" | "REFRESHING" | "READY" | "DEGRADED";
  authority: "OBSERVE_AND_SCREEN_ONLY";
  candidateClaimIdentity: Hash;
  canonicalTitle: string;
  boundSnapshotIdentity: Hash;
  latestRefreshId: string | null;
  observationSetIdentity: Hash;
  changedVenueCount: number;
  retentionPerSource: number;
  timeoutMs: number;
  maxResponseBytes: number;
  storage: CandidateBookObservationStore["candidateBookObservationStorage"];
  decision: CandidateWatchDecision | null;
  sources: readonly Readonly<{
    venueId: CandidateWatchVenueId;
    protocolIdentity: string;
    sourceUrl: string;
    status: "NEVER_REFRESHED" | "CURRENT" | "FAILED" | "STALE_AFTER_FAILURE";
    lastAttemptAt: string | null;
    refreshId: string | null;
    receivedAt: string | null;
    rawHash: Hash | null;
    byteLength: string | null;
    nativeGeneration: string | null;
    changedFromBound: boolean | null;
    diagnostic: string | null;
    credentialsUsed: false;
  }>[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type SourceState = {
  source: CandidateWatchSource;
  latest: StoredCandidateBookObservation | null;
  lastAttemptAt: string | null;
  diagnostic: string | null;
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function nativeGeneration(
  venueId: CandidateWatchVenueId,
  bytes: Uint8Array,
): string | null {
  const decoded = parseJsonWithNumberLexemes(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error(`${venueId} book payload is not an object`);
  }
  if (venueId === "limitless") return null;
  const hash = (decoded as { hash?: unknown }).hash;
  if (typeof hash !== "string" || hash === "") {
    throw new Error("Polymarket book payload has no native generation");
  }
  return hash;
}

function assertRecord(
  value: unknown,
): asserts value is CandidateBookObservationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("candidate book observation record is malformed");
  }
  const record = value as Partial<CandidateBookObservationRecord>;
  if (
    record.schemaVersion !== "pmh.candidate-book-observation.v1" ||
    typeof record.observationId !== "string" ||
    !OBSERVATION_ID_PATTERN.test(record.observationId) ||
    typeof record.refreshId !== "string" ||
    !REFRESH_ID_PATTERN.test(record.refreshId) ||
    typeof record.candidateClaimIdentity !== "string" ||
    !HASH_PATTERN.test(record.candidateClaimIdentity) ||
    (record.venueId !== "limitless" &&
      record.venueId !== "polymarket-global") ||
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
    (record.nativeGeneration !== null &&
      typeof record.nativeGeneration !== "string") ||
    record.acquisition === null ||
    typeof record.acquisition !== "object" ||
    record.acquisition.method !== "GET" ||
    record.acquisition.credentialsUsed !== false ||
    record.acquisition.valueMovingOperation !== false
  ) {
    throw new Error("candidate book observation record is malformed");
  }
  try {
    new URL(record.sourceUrl);
    if (new Date(record.receivedAt).toISOString() !== record.receivedAt) {
      throw new Error("invalid timestamp");
    }
  } catch {
    throw new Error("candidate book observation record is malformed");
  }
  const { observationId: _observationId, ...body } = record;
  if (
    record.observationId !==
    `candidate-book-observation:${hashCanonical(body).slice(7)}`
  ) {
    throw new Error("candidate book observation record identity mismatch");
  }
}

export function verifyStoredCandidateBookObservation(
  observation: StoredCandidateBookObservation,
): StoredCandidateBookObservation {
  assertRecord(observation.record);
  if (
    hashBytes(observation.bytes) !== observation.record.rawHash ||
    BigInt(observation.bytes.byteLength) !==
      BigInt(observation.record.byteLength) ||
    nativeGeneration(observation.record.venueId, observation.bytes) !==
      observation.record.nativeGeneration
  ) {
    throw new Error("candidate book observation raw payload identity mismatch");
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

function compactDiagnostic(value: string, limit = 500): string {
  const compacted = value.trim().replace(/\s+/gu, " ");
  return compacted.length <= limit
    ? compacted
    : `${compacted.slice(0, limit - 1).trimEnd()}…`;
}

function memoryStorage(): CandidateBookObservationStore["candidateBookObservationStorage"] {
  return Object.freeze({
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "observationId",
  });
}

export class CandidateWatchDesk {
  readonly #evidenceDesk: RealCandidatePreflightDesk;
  readonly #fetcher: CandidateWatchFetchLike;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #retentionLimit: number;
  readonly #store: CandidateBookObservationStore | undefined;
  readonly #states: Map<CandidateWatchVenueId, SourceState>;
  #loaded = false;
  #refreshing: Promise<CandidateWatchProjection> | null = null;

  public constructor(options: Readonly<{
    evidenceDesk: RealCandidatePreflightDesk;
    fetcher?: CandidateWatchFetchLike;
    now?: () => number;
    timeoutMs?: number;
    maxResponseBytes?: number;
    retentionLimit?: number;
    store?: CandidateBookObservationStore;
    sources?: readonly CandidateWatchSource[];
  }>) {
    this.#evidenceDesk = options.evidenceDesk;
    this.#fetcher = options.fetcher ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxResponseBytes =
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.#retentionLimit =
      options.retentionLimit ?? DEFAULT_RETENTION_PER_SOURCE;
    assertPositiveInteger(this.#timeoutMs, "candidate watch timeout");
    assertPositiveInteger(
      this.#maxResponseBytes,
      "candidate watch response limit",
    );
    assertPositiveInteger(
      this.#retentionLimit,
      "candidate watch retention",
    );
    this.#store = options.store;
    const sources = options.sources ?? candidateWatchSources;
    if (
      sources.length !== 2 ||
      new Set(sources.map((source) => source.venueId)).size !== sources.length
    ) {
      throw new Error("candidate watch requires unique Polymarket and Limitless sources");
    }
    this.#states = new Map(
      sources.map((source) => [
        source.venueId,
        { source, latest: null, lastAttemptAt: null, diagnostic: null },
      ]),
    );
    for (const stored of this.#store?.loadCandidateBookObservations(
      this.#retentionLimit * sources.length,
    ) ?? []) {
      const verified = verifyStoredCandidateBookObservation(stored);
      const state = this.#states.get(verified.record.venueId);
      if (state === undefined || state.latest !== null) continue;
      if (
        verified.record.protocolIdentity !== state.source.protocolIdentity ||
        verified.record.sourceUrl !== state.source.sourceUrl
      ) {
        throw new Error("stored candidate book source identity mismatch");
      }
      state.latest = verified;
      state.lastAttemptAt = verified.record.receivedAt;
    }
  }

  public load(): CandidateWatchProjection {
    // This also proves the underlying immutable evidence desk is ready.
    this.#evidenceDesk.rescreenProjection();
    this.#loaded = true;
    return this.projection();
  }

  public refresh(): Promise<CandidateWatchProjection> {
    if (!this.#loaded) {
      return Promise.reject(new Error("candidate watch evidence is not loaded"));
    }
    if (this.#refreshing !== null) return this.#refreshing;
    const attemptedAt = new Date(this.#now()).toISOString();
    const refreshId =
      `candidate-watch-refresh:${hashCanonical({
        candidateClaimIdentity:
          this.#evidenceDesk.rescreenProjection().claimIdentity,
        attemptedAt,
        refreshNonce: randomUUID(),
      }).slice(7)}`;
    const operation = Promise.all(
      [...this.#states.values()].map((state) =>
        this.#refreshSource(state, attemptedAt, refreshId),
      ),
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
    return operation;
  }

  async #refreshSource(
    state: SourceState,
    attemptedAt: string,
    refreshId: string,
  ): Promise<void> {
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
          "user-agent": "prediction-market-harness/0.0 candidate-watch",
        },
        signal: controller.signal,
      });
      if (response.status !== 200) {
        throw new Error(
          `anonymous candidate book GET returned HTTP ${response.status}`,
        );
      }
      const bytes = await readBoundedResponse(response, this.#maxResponseBytes);
      const generation = nativeGeneration(state.source.venueId, bytes);
      const body = Object.freeze({
        schemaVersion: "pmh.candidate-book-observation.v1" as const,
        refreshId,
        candidateClaimIdentity:
          this.#evidenceDesk.rescreenProjection().claimIdentity,
        venueId: state.source.venueId,
        protocolIdentity: state.source.protocolIdentity,
        sourceUrl: state.source.sourceUrl,
        receivedAt: attemptedAt,
        httpStatus: 200 as const,
        contentType:
          response.headers.get("content-type") ?? "application/octet-stream",
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        rawHash: hashBytes(bytes),
        byteLength: bytes.byteLength.toString(),
        nativeGeneration: generation,
        acquisition: Object.freeze({
          method: "GET" as const,
          credentialsUsed: false as const,
          valueMovingOperation: false as const,
        }),
      });
      const observation = verifyStoredCandidateBookObservation({
        record: {
          ...body,
          observationId:
            `candidate-book-observation:${hashCanonical(body).slice(7)}`,
        },
        bytes,
      });
      state.latest =
        this.#store?.saveCandidateBookObservation(
          observation,
          this.#retentionLimit,
        ) ?? observation;
      state.diagnostic = null;
    } catch (error) {
      state.diagnostic = controller.signal.aborted
        ? `anonymous candidate book GET timed out after ${this.#timeoutMs} ms`
        : error instanceof Error
          ? compactDiagnostic(error.message)
          : "anonymous candidate book GET failed";
    } finally {
      clearTimeout(timeout);
    }
  }

  #fixture(
    state: SourceState,
    observation: StoredCandidateBookObservation,
  ): VerifiedRawFixture {
    const record = observation.record;
    return verifyRawFixture(observation.bytes, {
      schemaVersion: "pmh.raw-fixture.v1",
      name: state.source.fixtureName,
      venue: record.venueId,
      protocolVersion: record.protocolIdentity,
      sourceUrl: record.sourceUrl,
      fetchedAt: record.receivedAt,
      httpStatus: record.httpStatus,
      contentType: record.contentType,
      etag: record.etag,
      lastModified: record.lastModified,
      rawHash: record.rawHash,
      byteLength: record.byteLength,
      acquisition: record.acquisition,
    });
  }

  #decision(
    states: readonly SourceState[],
    snapshotIdentity: Hash,
  ): CandidateWatchDecision | null {
    const refreshIds = new Set(
      states.map((state) => state.latest?.record.refreshId),
    );
    if (
      states.some(
        (state) => state.latest === null || state.diagnostic !== null,
      ) ||
      refreshIds.size !== 1 ||
      refreshIds.has(undefined)
    ) {
      return null;
    }
    const baseline = this.#evidenceDesk.rescreenProjection();
    const changedVenueIds = Object.freeze(
      states.flatMap((state): CandidateWatchVenueId[] => {
        const current = state.latest?.record;
        const bound = baseline.currentSnapshot.books.find(
          (book) => book.venueId === state.source.venueId,
        );
        if (current === undefined || bound === undefined) {
          throw new Error("candidate watch baseline book binding is missing");
        }
        return current.rawHash !== bound.sourceFixtureHash ||
          current.nativeGeneration !== bound.venueGeneration
          ? [state.source.venueId]
          : [];
      }),
    );
    if (changedVenueIds.length === 0) {
      const disposition = this.#evidenceDesk.dispositionProjection();
      const depth = this.#evidenceDesk.depthProjection();
      return Object.freeze({
        status: "UNCHANGED_BOUND_SNAPSHOT" as const,
        changedVenueIds,
        snapshotIdentity,
        depthArtifactHash: depth.artifactHash,
        dispositionArtifactHash: disposition.artifactHash,
        grossFloorBeforeFees: depth.grossFloorBeforeFees,
        postFeeFloorUpperBound: disposition.postFeeFloorUpperBound,
        priorDecisionReused: true as const,
        reviewRequired: false as const,
        independentReviewInvoked: false as const,
        verifierInvoked: false as const,
        arbitrageVerified: false as const,
      });
    }
    const polymarket = this.#states.get("polymarket-global");
    const limitless = this.#states.get("limitless");
    if (polymarket === undefined || limitless === undefined) {
      throw new Error("candidate watch venue source is missing");
    }
    if (polymarket.latest === null || limitless.latest === null) return null;
    const screen = this.#evidenceDesk.screenBooks({
      polymarketBook: this.#fixture(polymarket, polymarket.latest),
      limitlessBook: this.#fixture(limitless, limitless.latest),
      bookFixtureNames: {
        polymarket: polymarket.source.fixtureName,
        limitless: limitless.source.fixtureName,
      },
    });
    if (screen.disposition === null) {
      return Object.freeze({
        status: "POSITIVE_GROSS_REQUIRES_QUALIFICATION" as const,
        changedVenueIds,
        snapshotIdentity,
        depthArtifactHash: screen.depth.artifactHash,
        dispositionArtifactHash: null,
        grossFloorBeforeFees: screen.depth.grossFloorBeforeFees,
        postFeeFloorUpperBound: null,
        priorDecisionReused: false as const,
        reviewRequired: true as const,
        independentReviewInvoked: false as const,
        verifierInvoked: false as const,
        arbitrageVerified: false as const,
      });
    }
    return Object.freeze({
      status: "REJECTED_ECONOMICS" as const,
      changedVenueIds,
      snapshotIdentity,
      depthArtifactHash: screen.depth.artifactHash,
      dispositionArtifactHash: screen.disposition.artifactHash,
      grossFloorBeforeFees: screen.depth.grossFloorBeforeFees,
      postFeeFloorUpperBound: screen.disposition.postFeeFloorUpperBound,
      priorDecisionReused: false as const,
      reviewRequired: false as const,
      independentReviewInvoked: false as const,
      verifierInvoked: false as const,
      arbitrageVerified: false as const,
    });
  }

  public projection(): CandidateWatchProjection {
    if (!this.#loaded) {
      throw new Error("candidate watch evidence is not loaded");
    }
    const baseline = this.#evidenceDesk.rescreenProjection();
    const states = [...this.#states.values()].sort((left, right) =>
      left.source.venueId.localeCompare(right.source.venueId),
    );
    const observationSetIdentity = hashCanonical(
      states.map((state) => ({
        venueId: state.source.venueId,
        refreshId: state.latest?.record.refreshId ?? null,
        rawHash: state.latest?.record.rawHash ?? null,
        nativeGeneration: state.latest?.record.nativeGeneration ?? null,
      })),
    );
    const decision = this.#decision(states, observationSetIdentity);
    const sources = Object.freeze(
      states.map((state) => {
        const record = state.latest?.record ?? null;
        const bound = baseline.currentSnapshot.books.find(
          (book) => book.venueId === state.source.venueId,
        );
        const changedFromBound =
          record === null || bound === undefined
            ? null
            : record.rawHash !== bound.sourceFixtureHash ||
              record.nativeGeneration !== bound.venueGeneration;
        return Object.freeze({
          venueId: state.source.venueId,
          protocolIdentity: state.source.protocolIdentity,
          sourceUrl: state.source.sourceUrl,
          status:
            state.diagnostic === null
              ? record === null
                ? ("NEVER_REFRESHED" as const)
                : ("CURRENT" as const)
              : record === null
                ? ("FAILED" as const)
                : ("STALE_AFTER_FAILURE" as const),
          lastAttemptAt: state.lastAttemptAt,
          refreshId: record?.refreshId ?? null,
          receivedAt: record?.receivedAt ?? null,
          rawHash: record?.rawHash ?? null,
          byteLength: record?.byteLength ?? null,
          nativeGeneration: record?.nativeGeneration ?? null,
          changedFromBound,
          diagnostic: state.diagnostic,
          credentialsUsed: false as const,
        });
      }),
    );
    const latestRefreshIds = new Set(
      sources.map((source) => source.refreshId).filter((id) => id !== null),
    );
    const latestRefreshId =
      sources.every((source) => source.refreshId !== null) &&
      latestRefreshIds.size === 1
        ? sources[0]?.refreshId ?? null
        : null;
    const status =
      this.#refreshing !== null
        ? ("REFRESHING" as const)
        : sources.every((source) => source.status === "NEVER_REFRESHED")
          ? ("IDLE" as const)
          : decision === null
            ? ("DEGRADED" as const)
            : ("READY" as const);
    return Object.freeze({
      schemaVersion: "pmh.candidate-watch.v1" as const,
      mode: "ANONYMOUS_PUBLIC_GET" as const,
      status,
      authority: "OBSERVE_AND_SCREEN_ONLY" as const,
      candidateClaimIdentity: baseline.claimIdentity,
      canonicalTitle: baseline.canonicalTitle,
      boundSnapshotIdentity: baseline.currentSnapshot.bookSnapshotIdentity,
      latestRefreshId,
      observationSetIdentity,
      changedVenueCount: decision?.changedVenueIds.length ?? 0,
      retentionPerSource: this.#retentionLimit,
      timeoutMs: this.#timeoutMs,
      maxResponseBytes: this.#maxResponseBytes,
      storage:
        this.#store?.candidateBookObservationStorage ?? memoryStorage(),
      decision,
      sources,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }
}
