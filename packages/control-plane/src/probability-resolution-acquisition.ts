import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import { verifyRawFixture, type VerifiedRawFixture } from "@pmh/evidence";
import { decodePolymarketBinaryResolution, polymarketManifest } from "@pmh/venue-polymarket";
import {
  decodePolymarketUsBinarySettlement,
  polymarketUsManifest,
} from "@pmh/venue-polymarket-us";
import type { ProbabilisticSemanticBoundArtifact } from "./probabilistic-semantic-arbitrage.js";
import type { ProbabilityCalibrationRecordResult } from "./probability-calibration-desk.js";
import type { ProbabilityResolutionEvidence } from "./probability-calibration.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 86_400_000;

export type ProbabilityResolutionCaptureStatus =
  | "UNRESOLVED" | "RESOLVED" | "RESOLUTION_TIME_UNAVAILABLE"
  | "CONFLICT" | "HTTP_ERROR" | "UNSUPPORTED";

export type ProbabilityResolutionCapture = Readonly<{
  schemaVersion: "pmh.probability-resolution-capture.v1";
  artifactHash: Hash;
  listingRef: string;
  venueId: string;
  venueInstrumentId: string;
  sourceUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  sourceRawHash: Hash;
  byteLength: string;
  protocolIdentity: string;
  status: ProbabilityResolutionCaptureStatus;
  truthValue: boolean | null;
  resolvedAt: string | null;
  resolutionTimeBasis: "VENUE_REPORTED_CLOSED_TIME" |
    "UNAVAILABLE_FROM_ANONYMOUS_SETTLEMENT_ENDPOINT" | null;
  diagnostic: string | null;
  authority: "ANONYMOUS_RESOLUTION_EVIDENCE_ONLY";
  executionAuthority: false;
  effects: Readonly<{
    anonymousPublicGets: true;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export interface ProbabilityResolutionCaptureStore {
  readonly probabilityResolutionCaptureStorage: OperationalStorageProjection<"artifactHash">;
  readonly probabilityResolutionSourceStorage: OperationalStorageProjection<"rawHash">;
  loadProbabilityResolutionCaptures(limit: number): readonly ProbabilityResolutionCapture[];
  saveProbabilityResolutionCapture(
    capture: ProbabilityResolutionCapture,
    rawBytes: Uint8Array,
  ): ProbabilityResolutionCapture;
  loadProbabilityResolutionSource(rawHash: Hash): Uint8Array | null;
}

export interface ProbabilityCalibrationResolutionSink {
  pendingBounds(): readonly ProbabilisticSemanticBoundArtifact[];
  recordResolution(input: Readonly<{
    boundArtifactHash: Hash;
    resolutionEvidence: readonly ProbabilityResolutionEvidence[];
  }>): ProbabilityCalibrationRecordResult;
}

export type ProbabilityResolutionAcquisitionProjection = Readonly<{
  schemaVersion: "pmh.probability-resolution-acquisition.v1";
  enabled: boolean;
  status: "DISABLED" | "IDLE" | "POLLING";
  intervalMs: number | null;
  timeoutMs: number;
  maxResponseBytes: number;
  nextPollAt: string | null;
  pendingBoundCount: number;
  pendingListingCount: number;
  capturedListingCount: number;
  resolvedListingCount: number;
  timeUnavailableListingCount: number;
  conflictListingCount: number;
  unsupportedListingCount: number;
  unresolvedListingCount: number;
  httpErrorListingCount: number;
  autoRecordedBoundCount: number;
  runCount: number;
  failedRequestCount: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDiagnostic: string | null;
  captures: readonly ProbabilityResolutionCapture[];
  storage: Readonly<{
    captures: OperationalStorageProjection<"artifactHash">;
    sources: OperationalStorageProjection<"rawHash">;
  }>;
  authority: "ANONYMOUS_RESOLUTION_ORCHESTRATION_ONLY";
  probabilityCertificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    anonymousPublicGets: true;
    modelCalls: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

const MEMORY_CAPTURE_STORAGE = Object.freeze({
  mode: "MEMORY" as const, durable: false, schemaVersion: 0,
  idempotencyKey: "artifactHash" as const,
});
const MEMORY_SOURCE_STORAGE = Object.freeze({
  mode: "MEMORY" as const, durable: false, schemaVersion: 0,
  idempotencyKey: "rawHash" as const,
});

function canonicalIso(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return value;
}

function boundedText(value: string, label: string, maximum = 500): string {
  const compact = value.trim().replace(/\s+/gu, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${label} must be non-empty and at most ${maximum} characters`);
  }
  return compact;
}

export function buildProbabilityResolutionCapture(
  input: Omit<ProbabilityResolutionCapture, "schemaVersion" | "artifactHash" | "authority" |
    "executionAuthority" | "effects">,
): ProbabilityResolutionCapture {
  const body = Object.freeze({
    schemaVersion: "pmh.probability-resolution-capture.v1" as const,
    listingRef: boundedText(input.listingRef, "resolution listing ref", 300),
    venueId: boundedText(input.venueId, "resolution venue", 100),
    venueInstrumentId: boundedText(input.venueInstrumentId, "resolution instrument", 240),
    sourceUrl: new URL(input.sourceUrl).toString(),
    fetchedAt: canonicalIso(input.fetchedAt, "resolution fetch time"),
    httpStatus: input.httpStatus,
    contentType: boundedText(input.contentType, "resolution content type", 200),
    sourceRawHash: input.sourceRawHash,
    byteLength: input.byteLength,
    protocolIdentity: boundedText(input.protocolIdentity, "resolution protocol", 240),
    status: input.status,
    truthValue: input.truthValue,
    resolvedAt: input.resolvedAt,
    resolutionTimeBasis: input.resolutionTimeBasis,
    diagnostic: input.diagnostic,
    authority: "ANONYMOUS_RESOLUTION_EVIDENCE_ONLY" as const,
    executionAuthority: false as const,
    effects: Object.freeze({ anonymousPublicGets: true as const, externalWrites: false as const,
      valueMovingActions: false as const, liveExecutionEnabled: false as const }),
  });
  return assertProbabilityResolutionCapture(Object.freeze({
    ...body, artifactHash: hashCanonical(body),
  }));
}

export function assertProbabilityResolutionCapture(value: unknown): ProbabilityResolutionCapture {
  if (value === null || typeof value !== "object") {
    throw new Error("probability resolution capture is malformed");
  }
  const item = value as ProbabilityResolutionCapture;
  const statuses: readonly ProbabilityResolutionCaptureStatus[] = [
    "UNRESOLVED", "RESOLVED", "RESOLUTION_TIME_UNAVAILABLE", "CONFLICT",
    "HTTP_ERROR", "UNSUPPORTED",
  ];
  if (item.schemaVersion !== "pmh.probability-resolution-capture.v1" ||
    !HASH_PATTERN.test(item.artifactHash) || !HASH_PATTERN.test(item.sourceRawHash) ||
    !Number.isSafeInteger(item.httpStatus) || item.httpStatus < 100 || item.httpStatus > 599 ||
    !/^(0|[1-9][0-9]*)$/u.test(item.byteLength) || !statuses.includes(item.status) ||
    item.executionAuthority !== false || item.authority !== "ANONYMOUS_RESOLUTION_EVIDENCE_ONLY" ||
    item.effects?.anonymousPublicGets !== true || item.effects.externalWrites !== false ||
    item.effects.valueMovingActions !== false || item.effects.liveExecutionEnabled !== false) {
    throw new Error("probability resolution capture is invalid");
  }
  boundedText(item.listingRef, "resolution listing ref", 300);
  boundedText(item.venueId, "resolution venue", 100);
  boundedText(item.venueInstrumentId, "resolution instrument", 240);
  boundedText(item.contentType, "resolution content type", 200);
  boundedText(item.protocolIdentity, "resolution protocol", 240);
  new URL(item.sourceUrl);
  canonicalIso(item.fetchedAt, "resolution fetch time");
  if (item.diagnostic !== null) boundedText(item.diagnostic, "resolution diagnostic", 500);
  if (item.status === "RESOLVED") {
    if (typeof item.truthValue !== "boolean" || item.resolvedAt === null ||
      item.resolutionTimeBasis !== "VENUE_REPORTED_CLOSED_TIME") {
      throw new Error("resolved probability capture lacks qualified outcome evidence");
    }
    canonicalIso(item.resolvedAt, "resolution time");
  } else if (item.status === "RESOLUTION_TIME_UNAVAILABLE") {
    if (typeof item.truthValue !== "boolean" || item.resolvedAt !== null ||
      item.resolutionTimeBasis !== "UNAVAILABLE_FROM_ANONYMOUS_SETTLEMENT_ENDPOINT") {
      throw new Error("untimed probability capture is invalid");
    }
  } else if (item.truthValue !== null || item.resolvedAt !== null ||
    item.resolutionTimeBasis !== null) {
    throw new Error("non-resolution capture must not carry outcome evidence");
  }
  const { artifactHash: _artifactHash, ...body } = item;
  if (hashCanonical(body) !== item.artifactHash) {
    throw new Error("probability resolution capture does not replay");
  }
  return item;
}

function splitListingRef(listingRef: string) {
  const separator = listingRef.indexOf(":");
  if (separator <= 0 || separator === listingRef.length - 1) {
    throw new Error("probability resolution listing ref is malformed");
  }
  return Object.freeze({
    venueId: listingRef.slice(0, separator),
    venueInstrumentId: listingRef.slice(separator + 1),
  });
}

function sourceFor(listingRef: string) {
  const parsed = splitListingRef(listingRef);
  if (parsed.venueId === polymarketManifest.venueId && /^\d+$/u.test(parsed.venueInstrumentId)) {
    return Object.freeze({ ...parsed,
      sourceUrl: `https://gamma-api.polymarket.com/markets/${parsed.venueInstrumentId}`,
      protocolIdentity: polymarketManifest.protocolIdentity });
  }
  if (parsed.venueId === polymarketUsManifest.venueId) {
    return Object.freeze({ ...parsed,
      sourceUrl: `https://gateway.polymarket.us/v1/markets/${encodeURIComponent(parsed.venueInstrumentId)}/settlement`,
      protocolIdentity: polymarketUsManifest.protocolIdentity });
  }
  return null;
}

function fixtureFromResponse(input: Readonly<{
  bytes: Uint8Array; venueId: string; protocolIdentity: string; sourceUrl: string;
  fetchedAt: string; status: number; contentType: string;
}>): VerifiedRawFixture {
  return verifyRawFixture(input.bytes, {
    schemaVersion: "pmh.raw-fixture.v1", name: "anonymous-probability-resolution",
    venue: input.venueId, protocolVersion: input.protocolIdentity,
    sourceUrl: input.sourceUrl, fetchedAt: input.fetchedAt, httpStatus: input.status,
    contentType: input.contentType, etag: null, lastModified: null,
    rawHash: hashBytes(input.bytes), byteLength: String(input.bytes.byteLength),
    acquisition: { method: "GET", credentialsUsed: false, valueMovingOperation: false },
  });
}

export class ProbabilityResolutionAcquisitionScheduler {
  readonly #sink: ProbabilityCalibrationResolutionSink;
  readonly #store: ProbabilityResolutionCaptureStore | undefined;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #maxRequestsPerRun: number;
  readonly #captureLimit: number;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #captures: ProbabilityResolutionCapture[];
  readonly #memoryRaw = new Map<Hash, Uint8Array>();
  readonly intervalMs: number | null;
  #active: Promise<void> | null = null;
  #nextPollAtMs: number | null;
  #runCount = 0;
  #failedRequestCount = 0;
  #autoRecordedBoundCount = 0;
  #lastStartedAt: string | null = null;
  #lastCompletedAt: string | null = null;
  #lastDiagnostic: string | null = null;

  public constructor(options: Readonly<{
    sink: ProbabilityCalibrationResolutionSink; store?: ProbabilityResolutionCaptureStore;
    fetch?: typeof fetch; now?: () => number; intervalMs?: number | null;
    maxRequestsPerRun?: number; captureLimit?: number;
    timeoutMs?: number; maxResponseBytes?: number;
  }>) {
    this.#sink = options.sink;
    this.#store = options.store;
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? Date.now;
    this.intervalMs = options.intervalMs ?? 300_000;
    if (this.intervalMs !== null && (!Number.isSafeInteger(this.intervalMs) ||
      this.intervalMs < MIN_INTERVAL_MS || this.intervalMs > MAX_INTERVAL_MS)) {
      throw new Error("probability resolution interval is invalid");
    }
    this.#maxRequestsPerRun = options.maxRequestsPerRun ?? 16;
    this.#captureLimit = options.captureLimit ?? 100_000;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
    if (!Number.isSafeInteger(this.#maxRequestsPerRun) || this.#maxRequestsPerRun < 1 ||
      this.#maxRequestsPerRun > 100 || !Number.isSafeInteger(this.#captureLimit) ||
      this.#captureLimit < 1 || this.#captureLimit > 1_000_000) {
      throw new Error("probability resolution acquisition limits are invalid");
    }
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 ||
      this.#timeoutMs > 60_000 || !Number.isSafeInteger(this.#maxResponseBytes) ||
      this.#maxResponseBytes < 1_024 || this.#maxResponseBytes > 10_000_000) {
      throw new Error("probability resolution response policy is invalid");
    }
    const loaded = options.store?.loadProbabilityResolutionCaptures(this.#captureLimit + 1) ?? [];
    if (loaded.length > this.#captureLimit) {
      throw new Error("probability resolution capture storage exceeds its configured limit");
    }
    this.#captures = loaded.map(assertProbabilityResolutionCapture);
    this.#sort();
    this.#nextPollAtMs = this.intervalMs === null ? null : this.#now();
    this.#recordCompletedBounds();
  }

  public tick(): Promise<void> | null {
    if (this.intervalMs === null || this.#nextPollAtMs === null ||
      this.#now() < this.#nextPollAtMs) return null;
    if (this.#actionableListingRefs().length === 0) {
      this.#nextPollAtMs = this.#now() + this.intervalMs;
      return null;
    }
    return this.runNow();
  }

  public runNow(): Promise<void> {
    if (this.#active !== null) return this.#active;
    const startedAt = this.#now();
    this.#lastStartedAt = new Date(startedAt).toISOString();
    if (this.intervalMs !== null) this.#nextPollAtMs = startedAt + this.intervalMs;
    const refs = this.#actionableListingRefs().slice(0, this.#maxRequestsPerRun);
    const promise = Promise.all(refs.map(async (ref) => {
      try { await this.#poll(ref); } catch (error) {
        this.#failedRequestCount += 1;
        this.#lastDiagnostic = error instanceof Error ? error.message : "resolution request failed";
      }
    })).then(() => {
      this.#recordCompletedBounds();
      this.#runCount += 1;
      this.#lastCompletedAt = new Date(this.#now()).toISOString();
    }).finally(() => { this.#active = null; });
    this.#active = promise;
    return promise;
  }

  public rawSource(rawHash: Hash): Uint8Array | null {
    const stored = this.#store?.loadProbabilityResolutionSource(rawHash) ??
      this.#memoryRaw.get(rawHash) ?? null;
    if (stored === null) return null;
    if (hashBytes(stored) !== rawHash) throw new Error("probability resolution raw source hash mismatch");
    return stored.slice();
  }

  public projection(): ProbabilityResolutionAcquisitionProjection {
    const bounds = this.#sink.pendingBounds();
    const pendingRefs = new Set(bounds.flatMap((bound) => bound.listingRefs));
    const latest = [...this.#latestByListing().values()].filter((item) => pendingRefs.has(item.listingRef));
    const count = (status: ProbabilityResolutionCaptureStatus) => latest.filter((item) => item.status === status).length;
    return Object.freeze({
      schemaVersion: "pmh.probability-resolution-acquisition.v1" as const,
      enabled: this.intervalMs !== null,
      status: this.#active !== null ? "POLLING" as const : this.intervalMs === null ? "DISABLED" as const : "IDLE" as const,
      intervalMs: this.intervalMs,
      timeoutMs: this.#timeoutMs,
      maxResponseBytes: this.#maxResponseBytes,
      nextPollAt: this.#nextPollAtMs === null ? null : new Date(this.#nextPollAtMs).toISOString(),
      pendingBoundCount: bounds.length, pendingListingCount: pendingRefs.size,
      capturedListingCount: latest.length, resolvedListingCount: count("RESOLVED"),
      timeUnavailableListingCount: count("RESOLUTION_TIME_UNAVAILABLE"),
      conflictListingCount: count("CONFLICT"), unsupportedListingCount: count("UNSUPPORTED"),
      unresolvedListingCount: count("UNRESOLVED"), httpErrorListingCount: count("HTTP_ERROR"),
      autoRecordedBoundCount: this.#autoRecordedBoundCount, runCount: this.#runCount,
      failedRequestCount: this.#failedRequestCount, lastStartedAt: this.#lastStartedAt,
      lastCompletedAt: this.#lastCompletedAt, lastDiagnostic: this.#lastDiagnostic,
      captures: Object.freeze(this.#captures.slice(0, 100)),
      storage: Object.freeze({ captures: this.#store?.probabilityResolutionCaptureStorage ?? MEMORY_CAPTURE_STORAGE,
        sources: this.#store?.probabilityResolutionSourceStorage ?? MEMORY_SOURCE_STORAGE }),
      authority: "ANONYMOUS_RESOLUTION_ORCHESTRATION_ONLY" as const,
      probabilityCertificateAuthority: false as const, executionAuthority: false as const,
      effects: Object.freeze({ anonymousPublicGets: true as const, modelCalls: false as const,
        externalWrites: false as const, valueMovingActions: false as const, liveExecutionEnabled: false as const }),
    });
  }

  async #poll(listingRef: string): Promise<void> {
    const source = sourceFor(listingRef);
    if (source === null) {
      const { venueId, venueInstrumentId } = splitListingRef(listingRef);
      const bytes = new Uint8Array();
      this.#retain(buildProbabilityResolutionCapture({ listingRef, venueId, venueInstrumentId,
        sourceUrl: "https://invalid.local/unsupported-resolution-source",
        fetchedAt: new Date(this.#now()).toISOString(), httpStatus: 404,
        contentType: "application/octet-stream", sourceRawHash: hashBytes(bytes), byteLength: "0",
        protocolIdentity: "unsupported:anonymous-resolution", status: "UNSUPPORTED",
        truthValue: null, resolvedAt: null, resolutionTimeBasis: null,
        diagnostic: "venue has no qualified anonymous resolution adapter" }), bytes);
      return;
    }
    const response = await this.#fetch(source.sourceUrl, {
      method: "GET", headers: { accept: "application/json" }, redirect: "error",
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    const bytes = await readBoundedResponse(response, this.#maxResponseBytes);
    const fetchedAt = new Date(this.#now()).toISOString();
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const fixture = fixtureFromResponse({ bytes, venueId: source.venueId,
      protocolIdentity: source.protocolIdentity, sourceUrl: source.sourceUrl,
      fetchedAt, status: response.status, contentType });
    let status: ProbabilityResolutionCaptureStatus = "HTTP_ERROR";
    let truthValue: boolean | null = null;
    let resolvedAt: string | null = null;
    let resolutionTimeBasis: ProbabilityResolutionCapture["resolutionTimeBasis"] = null;
    let diagnostic: string | null = response.ok ? null : `anonymous endpoint returned HTTP ${response.status}`;
    if (response.ok && source.venueId === polymarketManifest.venueId) {
      const resolution = decodePolymarketBinaryResolution(fixture, source.venueInstrumentId);
      status = resolution === null ? "UNRESOLVED" : "RESOLVED";
      truthValue = resolution?.truthValue ?? null;
      resolvedAt = resolution?.resolvedAt ?? null;
      resolutionTimeBasis = resolution === null ? null : "VENUE_REPORTED_CLOSED_TIME";
    } else if (response.ok && source.venueId === polymarketUsManifest.venueId) {
      const resolution = decodePolymarketUsBinarySettlement(fixture, source.venueInstrumentId);
      status = "RESOLUTION_TIME_UNAVAILABLE";
      truthValue = resolution.truthValue;
      resolutionTimeBasis = resolution.resolutionTimeBasis;
      diagnostic = "exact payout captured; anonymous settlement endpoint supplies no qualified resolution time";
    }
    const previous = this.#latestByListing().get(listingRef);
    if (previous !== undefined && ["RESOLVED", "RESOLUTION_TIME_UNAVAILABLE"].includes(previous.status) &&
      truthValue !== null && previous.truthValue !== truthValue) {
      status = "CONFLICT"; truthValue = null; resolvedAt = null; resolutionTimeBasis = null;
      diagnostic = "anonymous venue payout conflicts with an earlier retained terminal outcome";
    }
    this.#retain(buildProbabilityResolutionCapture({ listingRef, venueId: source.venueId,
      venueInstrumentId: source.venueInstrumentId, sourceUrl: source.sourceUrl, fetchedAt,
      httpStatus: response.status, contentType, sourceRawHash: fixture.rawHash,
      byteLength: String(bytes.byteLength), protocolIdentity: source.protocolIdentity,
      status, truthValue, resolvedAt, resolutionTimeBasis, diagnostic }), bytes);
  }

  #retain(capture: ProbabilityResolutionCapture, rawBytes: Uint8Array): void {
    if (hashBytes(rawBytes) !== capture.sourceRawHash || BigInt(rawBytes.byteLength) !== BigInt(capture.byteLength)) {
      throw new Error("probability resolution raw source does not match capture");
    }
    if (this.#captures.some((item) => item.artifactHash === capture.artifactHash)) return;
    if (this.#captures.length >= this.#captureLimit) throw new Error("probability resolution capture limit reached");
    this.#store?.saveProbabilityResolutionCapture(capture, rawBytes);
    if (this.#store === undefined) this.#memoryRaw.set(capture.sourceRawHash, rawBytes.slice());
    this.#captures.push(capture); this.#sort();
  }

  #latestByListing(): Map<string, ProbabilityResolutionCapture> {
    const result = new Map<string, ProbabilityResolutionCapture>();
    for (const capture of this.#captures) if (!result.has(capture.listingRef)) result.set(capture.listingRef, capture);
    return result;
  }

  #actionableListingRefs(): string[] {
    const terminal = new Set([
      "RESOLVED", "RESOLUTION_TIME_UNAVAILABLE", "CONFLICT", "UNSUPPORTED",
    ]);
    const latest = this.#latestByListing();
    return [...new Set(this.#sink.pendingBounds().flatMap((bound) => bound.listingRefs))]
      .filter((ref) => !terminal.has(latest.get(ref)?.status ?? ""))
      .sort();
  }

  #recordCompletedBounds(): void {
    const latest = this.#latestByListing();
    for (const bound of this.#sink.pendingBounds()) {
      const captures = bound.listingRefs.map((ref) => latest.get(ref));
      if (captures.some((item) => item?.status !== "RESOLVED")) continue;
      const result = this.#sink.recordResolution({ boundArtifactHash: bound.artifactHash,
        resolutionEvidence: Object.freeze(captures.map((capture, index) => Object.freeze({
          listingRef: bound.listingRefs[index]!, truthValue: capture!.truthValue!,
          resolvedAt: capture!.resolvedAt!, sourceRawHash: capture!.sourceRawHash,
          protocolIdentity: capture!.protocolIdentity,
        }))) });
      if (!result.idempotentReplay) this.#autoRecordedBoundCount += 1;
    }
  }

  #sort(): void {
    this.#captures.sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt) ||
      right.artifactHash.localeCompare(left.artifactHash));
  }
}

async function readBoundedResponse(response: Response, maximum: number): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/u.test(declared) && BigInt(declared) > BigInt(maximum)) {
    throw new Error("anonymous resolution response exceeds the byte limit");
  }
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Error("anonymous resolution response exceeds the byte limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function parseProbabilityResolutionInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_PROBABILITY_RESOLUTION_INTERVAL_MS?.trim();
  if (raw === "0") return null;
  if (raw === undefined || raw === "") return 300_000;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < MIN_INTERVAL_MS || value > MAX_INTERVAL_MS) {
    throw new Error(`PMH_PROBABILITY_RESOLUTION_INTERVAL_MS must be 0 or an integer from ${MIN_INTERVAL_MS} to ${MAX_INTERVAL_MS}`);
  }
  return value;
}
