import {
  hashBytes,
  hashCanonical,
  parseFixed,
  type Hash,
} from "@pmh/domain";
import type { OpportunitySimulationPlan } from "@pmh/execution";
import { parseJsonWithNumberLexemes } from "@pmh/protocol";
import type { ResearchRelationPayoffQualification } from "./relation-payoff.js";
import { parseOpportunitySimulationIntake } from "./simulation-intake.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_MAX_SNAPSHOT_SKEW_MS = 5_000;
const DEFAULT_RETENTION_LIMIT = 25;
const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)$/u;

export type AnonymousMaterializationBlocker =
  | "UNSUPPORTED_ANONYMOUS_BOOK"
  | "BOOK_ACQUISITION_FAILED"
  | "BOOK_INSTRUMENT_MISMATCH"
  | "BOOK_SCHEMA_INVALID"
  | "FEE_ACQUISITION_FAILED"
  | "ORDER_QUANTITY_UNSUPPORTED"
  | "DYNAMIC_FEE_MODEL_UNSUPPORTED"
  | "NON_ZERO_CURVED_FEE_UNSUPPORTED"
  | "INCOMPATIBLE_PORTFOLIO_SCALE"
  | "SNAPSHOT_SKEW_EXCEEDED"
  | "SIMULATION_INTAKE_REJECTED";

const ANONYMOUS_MATERIALIZATION_BLOCKERS =
  new Set<AnonymousMaterializationBlocker>([
    "UNSUPPORTED_ANONYMOUS_BOOK",
    "BOOK_ACQUISITION_FAILED",
    "BOOK_INSTRUMENT_MISMATCH",
    "BOOK_SCHEMA_INVALID",
    "FEE_ACQUISITION_FAILED",
    "ORDER_QUANTITY_UNSUPPORTED",
    "DYNAMIC_FEE_MODEL_UNSUPPORTED",
    "NON_ZERO_CURVED_FEE_UNSUPPORTED",
    "INCOMPATIBLE_PORTFOLIO_SCALE",
    "SNAPSHOT_SKEW_EXCEEDED",
    "SIMULATION_INTAKE_REJECTED",
  ]);

export type AnonymousMaterializationSourceRecord = Readonly<{
  sourceId: Hash;
  kind: "BOOK" | "FEE";
  venueId: string;
  instrumentId: string;
  protocolIdentity: string;
  sourceUrl: string;
  receivedAt: string;
  httpStatus: 200;
  contentType: string;
  rawHash: Hash;
  byteLength: string;
  nativeGeneration: string | null;
  acquisition: Readonly<{
    method: "GET";
    credentialsUsed: false;
    valueMovingOperation: false;
  }>;
}>;

export type AnonymousMaterializationLeg = Readonly<{
  legId: string;
  venueId: string;
  instrumentId: string;
  outcome: "TRUE" | "FALSE";
  status: "READY" | "BLOCKED";
  blocker: AnonymousMaterializationBlocker | null;
  diagnostic: string | null;
  bookSourceId: Hash | null;
  feeSourceId: Hash | null;
  askLevelCount: number;
  feeModel:
    | "COLLATERAL_RATE_V1"
    | "BINARY_PRICE_CURVE_V1"
    | "BINARY_THETA_ORDER_BOUND_V1"
    | null;
  feeQualification: "EXACT" | "REQUIRES_MATCH_CALIBRATION" | null;
}>;

export type AnonymousSimulationMaterializationRecord = Readonly<{
  schemaVersion: "pmh.anonymous-simulation-materialization.v1";
  materializationId: Hash;
  opportunityId: string;
  relationConstraintHash: Hash;
  semanticDecisionId: Hash;
  portfolioId: Hash;
  requestedQuantity: string;
  attemptedAt: string;
  completedAt: string;
  status: "READY" | "BLOCKED";
  diagnostic: string | null;
  legs: readonly AnonymousMaterializationLeg[];
  sources: readonly AnonymousMaterializationSourceRecord[];
  authority: "ANONYMOUS_RESEARCH_MATERIALIZER";
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type StoredAnonymousMaterializationSource = Readonly<{
  record: AnonymousMaterializationSourceRecord;
  bytes: Uint8Array;
}>;

export type AnonymousSimulationMaterializationResult = Readonly<{
  record: AnonymousSimulationMaterializationRecord;
  plan: OpportunitySimulationPlan | null;
  rawSources: readonly StoredAnonymousMaterializationSource[];
}>;

export type AnonymousSimulationMaterializerProjection = Readonly<{
  schemaVersion: "pmh.anonymous-simulation-materializer-desk.v1";
  mode: "ANONYMOUS_PUBLIC_GET";
  status: "IDLE" | "REFRESHING" | "READY" | "BLOCKED";
  runCount: number;
  readyCount: number;
  blockedCount: number;
  retentionLimit: number;
  timeoutMs: number;
  maxResponseBytes: number;
  maxSnapshotSkewMs: number;
  retainedRawSourceCount: number;
  storage: Readonly<{
    mode: "MEMORY" | "SQLITE_WAL";
    durable: boolean;
    schemaVersion: number;
    idempotencyKey: "materializationId";
  }>;
  records: readonly AnonymousSimulationMaterializationRecord[];
  authority: "ANONYMOUS_RESEARCH_MATERIALIZER";
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type StoredAnonymousSimulationMaterialization = Readonly<{
  record: AnonymousSimulationMaterializationRecord;
  rawSources: readonly StoredAnonymousMaterializationSource[];
}>;

export interface AnonymousSimulationMaterializationStore {
  readonly anonymousSimulationMaterializationStorage: AnonymousSimulationMaterializerProjection["storage"];
  loadAnonymousSimulationMaterializations(
    limit: number,
  ): readonly StoredAnonymousSimulationMaterialization[];
  saveAnonymousSimulationMaterialization(
    value: StoredAnonymousSimulationMaterialization,
    retentionLimit: number,
  ): StoredAnonymousSimulationMaterialization;
}

export type AnonymousMaterializerFetchLike = (
  input: string,
  init: Readonly<{
    method: "GET";
    credentials: "omit";
    redirect: "error";
    headers: Readonly<Record<string, string>>;
    signal: AbortSignal;
  }>,
) => Promise<Response>;

type ListingBinding =
  ResearchRelationPayoffQualification["listingBindings"][number];
type Portfolio = ResearchRelationPayoffQualification["portfolios"][number];
type PortfolioLeg = Portfolio["legs"][number];

type MaterializedRequest = Readonly<{
  leg: AnonymousMaterializationLeg;
  sources: readonly StoredAnonymousMaterializationSource[];
  request: Readonly<Record<string, unknown>> | null;
}>;

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function compactDiagnostic(value: string): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length <= 500 ? compact : `${compact.slice(0, 499)}…`;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (
    declared !== null &&
    UNSIGNED_DECIMAL.test(declared) &&
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

function sourceRecord(input: {
  kind: "BOOK" | "FEE";
  venueId: string;
  instrumentId: string;
  protocolIdentity: string;
  sourceUrl: string;
  receivedAt: string;
  response: Response;
  bytes: Uint8Array;
  nativeGeneration: string | null;
}): StoredAnonymousMaterializationSource {
  const body = Object.freeze({
    kind: input.kind,
    venueId: input.venueId,
    instrumentId: input.instrumentId,
    protocolIdentity: input.protocolIdentity,
    sourceUrl: input.sourceUrl,
    receivedAt: input.receivedAt,
    httpStatus: 200 as const,
    contentType:
      input.response.headers.get("content-type") ?? "application/octet-stream",
    rawHash: hashBytes(input.bytes),
    byteLength: input.bytes.byteLength.toString(),
    nativeGeneration: input.nativeGeneration,
    acquisition: Object.freeze({
      method: "GET" as const,
      credentialsUsed: false as const,
      valueMovingOperation: false as const,
    }),
  });
  return Object.freeze({
    record: Object.freeze({ ...body, sourceId: hashCanonical(body) }),
    bytes: input.bytes,
  });
}

function withNativeGeneration(
  source: StoredAnonymousMaterializationSource,
  nativeGeneration: string | null,
): StoredAnonymousMaterializationSource {
  const { sourceId: _sourceId, ...body } = source.record;
  const rebound = Object.freeze({ ...body, nativeGeneration });
  return Object.freeze({
    record: Object.freeze({ ...rebound, sourceId: hashCanonical(rebound) }),
    bytes: source.bytes,
  });
}

function copyStoredSource(
  source: StoredAnonymousMaterializationSource,
): StoredAnonymousMaterializationSource {
  if (hashBytes(source.bytes) !== source.record.rawHash) {
    throw new Error("retained anonymous source bytes do not match their content hash");
  }
  return Object.freeze({
    record: source.record,
    bytes: new Uint8Array(source.bytes),
  });
}

function isHash(value: unknown): value is Hash {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

export function verifyStoredAnonymousMaterializationSource(
  source: StoredAnonymousMaterializationSource,
): StoredAnonymousMaterializationSource {
  const record = source.record;
  const acquisition =
    record !== null && typeof record === "object"
      ? (record as { acquisition?: unknown }).acquisition
      : undefined;
  if (
    record === null ||
    typeof record !== "object" ||
    !isHash(record.sourceId) ||
    (record.kind !== "BOOK" && record.kind !== "FEE") ||
    typeof record.venueId !== "string" ||
    record.venueId === "" ||
    typeof record.instrumentId !== "string" ||
    record.instrumentId === "" ||
    typeof record.protocolIdentity !== "string" ||
    record.protocolIdentity === "" ||
    typeof record.sourceUrl !== "string" ||
    typeof record.receivedAt !== "string" ||
    record.httpStatus !== 200 ||
    typeof record.contentType !== "string" ||
    !isHash(record.rawHash) ||
    !UNSIGNED_DECIMAL.test(record.byteLength) ||
    (record.nativeGeneration !== null &&
      typeof record.nativeGeneration !== "string") ||
    acquisition === null ||
    typeof acquisition !== "object" ||
    (acquisition as { method?: unknown }).method !== "GET" ||
    (acquisition as { credentialsUsed?: unknown }).credentialsUsed !== false ||
    (acquisition as { valueMovingOperation?: unknown }).valueMovingOperation !==
      false ||
    !(source.bytes instanceof Uint8Array) ||
    source.bytes.byteLength.toString() !== record.byteLength ||
    hashBytes(source.bytes) !== record.rawHash
  ) {
    throw new Error("anonymous materialization source is malformed");
  }
  try {
    const parsed = new URL(record.sourceUrl);
    if (
      parsed.protocol !== "https:" ||
      new Date(record.receivedAt).toISOString() !== record.receivedAt
    ) {
      throw new Error("invalid source binding");
    }
  } catch {
    throw new Error("anonymous materialization source binding is malformed");
  }
  const { sourceId: _sourceId, ...body } = record;
  if (hashCanonical(body) !== record.sourceId) {
    throw new Error("anonymous materialization source identity mismatch");
  }
  return copyStoredSource(source);
}

export function assertAnonymousSimulationMaterializationRecord(
  value: unknown,
): AnonymousSimulationMaterializationRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("anonymous simulation materialization record is malformed");
  }
  const record = value as Partial<AnonymousSimulationMaterializationRecord>;
  if (
    record.schemaVersion !== "pmh.anonymous-simulation-materialization.v1" ||
    !isHash(record.materializationId) ||
    typeof record.opportunityId !== "string" ||
    record.opportunityId === "" ||
    !isHash(record.relationConstraintHash) ||
    !isHash(record.semanticDecisionId) ||
    !isHash(record.portfolioId) ||
    typeof record.requestedQuantity !== "string" ||
    !UNSIGNED_DECIMAL.test(record.requestedQuantity) ||
    BigInt(record.requestedQuantity) <= 0n ||
    typeof record.attemptedAt !== "string" ||
    typeof record.completedAt !== "string" ||
    (record.status !== "READY" && record.status !== "BLOCKED") ||
    (record.diagnostic !== null && typeof record.diagnostic !== "string") ||
    !Array.isArray(record.legs) ||
    record.legs.length < 2 ||
    record.legs.length > 20 ||
    !Array.isArray(record.sources) ||
    record.sources.length > 80 ||
    record.authority !== "ANONYMOUS_RESEARCH_MATERIALIZER" ||
    record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    record.effects?.externalWrites !== false ||
    record.effects.valueMovingActions !== false ||
    record.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("anonymous simulation materialization record is malformed");
  }
  try {
    if (
      new Date(record.attemptedAt).toISOString() !== record.attemptedAt ||
      new Date(record.completedAt).toISOString() !== record.completedAt ||
      Date.parse(record.completedAt) < Date.parse(record.attemptedAt)
    ) {
      throw new Error("invalid time");
    }
  } catch {
    throw new Error("anonymous simulation materialization time is malformed");
  }
  const projectedSources = record.sources;
  if (
    new Set(record.legs.map((leg) => leg.legId)).size !== record.legs.length ||
    new Set(record.sources.map((source) => source.sourceId)).size !==
      record.sources.length ||
    record.legs.some(
      (leg) =>
        typeof leg.legId !== "string" ||
        leg.legId === "" ||
        typeof leg.venueId !== "string" ||
        leg.venueId === "" ||
        typeof leg.instrumentId !== "string" ||
        leg.instrumentId === "" ||
        (leg.outcome !== "TRUE" && leg.outcome !== "FALSE") ||
        (leg.status !== "READY" && leg.status !== "BLOCKED") ||
        (leg.blocker !== null &&
          !ANONYMOUS_MATERIALIZATION_BLOCKERS.has(leg.blocker)) ||
        !Number.isSafeInteger(leg.askLevelCount) ||
        leg.askLevelCount < 0 ||
        (leg.bookSourceId !== null && !isHash(leg.bookSourceId)) ||
        (leg.feeSourceId !== null && !isHash(leg.feeSourceId)) ||
        (leg.feeModel !== null &&
          leg.feeModel !== "COLLATERAL_RATE_V1" &&
          leg.feeModel !== "BINARY_PRICE_CURVE_V1" &&
          leg.feeModel !== "BINARY_THETA_ORDER_BOUND_V1") ||
        (leg.feeQualification !== null &&
          leg.feeQualification !== "EXACT" &&
          leg.feeQualification !== "REQUIRES_MATCH_CALIBRATION") ||
        (leg.status === "READY" &&
          (leg.blocker !== null ||
            leg.diagnostic !== null ||
            leg.bookSourceId === null ||
            leg.feeSourceId === null ||
            leg.askLevelCount < 1 ||
            leg.feeModel === null ||
            leg.feeQualification === null)) ||
        (leg.status === "BLOCKED" &&
          (leg.blocker === null ||
            typeof leg.diagnostic !== "string" ||
            leg.diagnostic === "")) ||
        (leg.feeModel === "COLLATERAL_RATE_V1" &&
          leg.feeQualification !== "EXACT") ||
        (leg.feeModel === "BINARY_PRICE_CURVE_V1" &&
          leg.feeQualification !== "REQUIRES_MATCH_CALIBRATION") ||
        (leg.feeModel === "BINARY_THETA_ORDER_BOUND_V1" &&
          leg.feeQualification !== "EXACT") ||
        ((leg.feeModel === null) !== (leg.feeQualification === null)),
    ) ||
    record.sources.some(
      (source) =>
        !isHash(source.sourceId) ||
        !isHash(source.rawHash) ||
        source.acquisition?.credentialsUsed !== false ||
        source.acquisition.valueMovingOperation !== false,
    ) ||
    record.legs.some((leg) => {
      const book = projectedSources.find(
        (source) => source.sourceId === leg.bookSourceId,
      );
      const fee = projectedSources.find(
        (source) => source.sourceId === leg.feeSourceId,
      );
      return (
        (leg.bookSourceId !== null &&
          (book?.kind !== "BOOK" ||
            book.venueId !== leg.venueId ||
            book.instrumentId !== leg.instrumentId)) ||
        (leg.feeSourceId !== null &&
          (fee?.kind !== "FEE" ||
            fee.venueId !== leg.venueId ||
            fee.instrumentId !== leg.instrumentId))
      );
    }) ||
    (record.status === "READY" && record.diagnostic !== null) ||
    (record.status === "BLOCKED" &&
      (typeof record.diagnostic !== "string" || record.diagnostic === "")) ||
    (record.status === "READY") !==
      record.legs.every((leg) => leg.status === "READY")
  ) {
    throw new Error("anonymous simulation materialization contract is malformed");
  }
  const { materializationId: _materializationId, ...body } =
    record as AnonymousSimulationMaterializationRecord;
  if (hashCanonical(body) !== record.materializationId) {
    throw new Error("anonymous simulation materialization identity mismatch");
  }
  return Object.freeze(record as AnonymousSimulationMaterializationRecord);
}

export function verifyStoredAnonymousSimulationMaterialization(
  value: StoredAnonymousSimulationMaterialization,
): StoredAnonymousSimulationMaterialization {
  const record = assertAnonymousSimulationMaterializationRecord(value.record);
  const sources = Object.freeze(
    value.rawSources.map(verifyStoredAnonymousMaterializationSource),
  );
  const expected = [...record.sources.map((source) => source.sourceId)].sort();
  const actual = [...sources.map((source) => source.record.sourceId)].sort();
  if (
    expected.length !== actual.length ||
    expected.some((sourceId, index) => sourceId !== actual[index]) ||
    sources.some((source) => {
      const projected = record.sources.find(
        (candidate) => candidate.sourceId === source.record.sourceId,
      );
      return (
        projected === undefined ||
        hashCanonical(projected) !== hashCanonical(source.record)
      );
    })
  ) {
    throw new Error("anonymous materialization record/raw-source binding mismatch");
  }
  return Object.freeze({ record, rawSources: sources });
}

function blockedLeg(input: {
  leg: PortfolioLeg;
  binding: ListingBinding;
  instrumentId: string;
  blocker: AnonymousMaterializationBlocker;
  diagnostic: string;
  sources?: readonly StoredAnonymousMaterializationSource[];
  askLevelCount?: number;
}): MaterializedRequest {
  const sources = input.sources ?? Object.freeze([]);
  return Object.freeze({
    leg: Object.freeze({
      legId: input.leg.legId,
      venueId: input.binding.venueId,
      instrumentId: input.instrumentId,
      outcome: input.leg.outcome,
      status: "BLOCKED" as const,
      blocker: input.blocker,
      diagnostic: compactDiagnostic(input.diagnostic),
      bookSourceId:
        sources.find((source) => source.record.kind === "BOOK")?.record
          .sourceId ?? null,
      feeSourceId:
        sources.find((source) => source.record.kind === "FEE")?.record
          .sourceId ?? null,
      askLevelCount: input.askLevelCount ?? 0,
      feeModel: null,
      feeQualification: null,
    }),
    sources,
    request: null,
  });
}

function decode(bytes: Uint8Array): unknown {
  return parseJsonWithNumberLexemes(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
}

function outcomeInstrument(
  leg: PortfolioLeg,
  binding: ListingBinding,
): string {
  return leg.outcome === "TRUE"
    ? binding.trueOutcome.venueOutcomeId
    : binding.falseOutcome.venueOutcomeId;
}

function bookUrl(binding: ListingBinding, instrumentId: string): string | null {
  if (binding.venueId === "polymarket-global") {
    return `https://clob.polymarket.com/book?token_id=${encodeURIComponent(instrumentId)}`;
  }
  if (binding.venueId === "limitless") {
    return `https://api.limitless.exchange/markets/${encodeURIComponent(binding.venueInstrumentId)}/orderbook`;
  }
  if (binding.venueId === "polymarket-us") {
    return `https://gateway.polymarket.us/v1/markets/${encodeURIComponent(binding.venueInstrumentId)}/book`;
  }
  return null;
}

function feeUrl(binding: ListingBinding, marketId: string | null): string | null {
  if (binding.venueId === "polymarket-global") {
    return marketId === null
      ? null
      : `https://clob.polymarket.com/clob-markets/${encodeURIComponent(marketId)}`;
  }
  if (binding.venueId === "polymarket-us") {
    return `https://gateway.polymarket.us/v1/market/slug/${encodeURIComponent(binding.venueInstrumentId)}`;
  }
  return null;
}

function parsePolymarketUsBook(input: {
  binding: ListingBinding;
  instrumentId: string;
  outcome: "TRUE" | "FALSE";
  bytes: Uint8Array;
  rawHash: Hash;
}): ReturnType<typeof parseBook> {
  const root = object(decode(input.bytes), "Polymarket US anonymous book");
  const raw = object(root.marketData, "book.marketData");
  const marketSlug = string(raw.marketSlug, "book.marketData.marketSlug");
  if (marketSlug !== input.binding.venueInstrumentId) {
    throw new Error(
      `book instrument ${marketSlug} does not match ${input.binding.venueInstrumentId}`,
    );
  }
  if (raw.state !== "MARKET_STATE_OPEN") {
    throw new Error("Polymarket US book is not open");
  }
  const sourceSide = input.outcome === "TRUE" ? "offers" : "bids";
  const candidates = raw[sourceSide];
  if (!Array.isArray(candidates) || candidates.length > 10_000) {
    throw new Error(`book.${sourceSide} must be a bounded array`);
  }
  const priceScale = BigInt(input.binding.priceScale);
  const quantityScale = BigInt(input.binding.quantityScale);
  const tick = input.binding.minPriceTick === null
    ? null
    : BigInt(input.binding.minPriceTick);
  const levels = Object.freeze(candidates.map((candidate, index) => {
    const level = object(candidate, `book.${sourceSide}[${index}]`);
    const px = object(level.px, `book.${sourceSide}[${index}].px`);
    if (px.currency !== "USD") {
      throw new Error(`book.${sourceSide}[${index}].px.currency is not USD`);
    }
    const priceLexeme = string(px.value, `book.${sourceSide}[${index}].px.value`);
    const quantityLexeme = string(level.qty, `book.${sourceSide}[${index}].qty`);
    const longPrice = parseFixed(priceLexeme, priceScale);
    const price = input.outcome === "TRUE" ? longPrice : priceScale - longPrice;
    const quantity = parseFixed(quantityLexeme, quantityScale);
    if (
      longPrice <= 0n ||
      longPrice >= priceScale ||
      price <= 0n ||
      price >= priceScale ||
      quantity <= 0n ||
      (tick !== null && (longPrice % tick !== 0n || price % tick !== 0n))
    ) {
      throw new Error(`book.${sourceSide}[${index}] violates the fixed-point contract`);
    }
    return Object.freeze({
      price: price.toString(),
      quantity: quantity.toString(),
      levelIdentity: hashCanonical({
        rawHash: input.rawHash,
        sourceSide: sourceSide === "offers" ? "YES_OFFER" : "YES_BID",
        normalizedOutcome: input.outcome,
        transform: input.outcome === "TRUE" ? "IDENTITY" : "ONE_MINUS_BID",
        index,
        priceLexeme,
        quantityLexeme,
      }),
    });
  }));
  return Object.freeze({
    nativeGeneration: string(raw.transactTime, "book.marketData.transactTime"),
    marketId: marketSlug,
    levels,
  });
}

function parseBook(input: {
  binding: ListingBinding;
  instrumentId: string;
  outcome: "TRUE" | "FALSE";
  bytes: Uint8Array;
  rawHash: Hash;
}): Readonly<{
  nativeGeneration: string | null;
  marketId: string | null;
  levels: readonly Readonly<{
    price: string;
    quantity: string;
    levelIdentity: Hash;
  }>[];
}> {
  if (input.binding.venueId === "polymarket-us") {
    return parsePolymarketUsBook(input);
  }
  const raw = object(decode(input.bytes), "anonymous book");
  const boundInstrument =
    input.binding.venueId === "polymarket-global"
      ? string(raw.asset_id, "book.asset_id")
      : string(raw.tokenId, "book.tokenId");
  if (boundInstrument !== input.instrumentId) {
    throw new Error(
      `book instrument ${boundInstrument} does not match ${input.instrumentId}`,
    );
  }
  if (!Array.isArray(raw.asks) || raw.asks.length > 10_000) {
    throw new Error("book asks must be a bounded array");
  }
  const priceScale = BigInt(input.binding.priceScale);
  const quantityScale = BigInt(input.binding.quantityScale);
  const tick =
    input.binding.minPriceTick === null
      ? null
      : BigInt(input.binding.minPriceTick);
  const levels = Object.freeze(
    raw.asks.map((candidate, index) => {
      const level = object(candidate, `book.asks[${index}]`);
      if (
        input.binding.venueId === "limitless" &&
        level.side !== undefined &&
        level.side !== "SELL"
      ) {
        throw new Error(`book.asks[${index}] has the wrong side`);
      }
      const priceLexeme = string(level.price, `book.asks[${index}].price`);
      const quantityLexeme = string(level.size, `book.asks[${index}].size`);
      const price = parseFixed(priceLexeme, priceScale);
      const quantity =
        input.binding.venueId === "limitless"
          ? UNSIGNED_DECIMAL.test(quantityLexeme)
            ? BigInt(quantityLexeme)
            : (() => {
                throw new Error(`book.asks[${index}].size is not a base-unit integer`);
              })()
          : parseFixed(quantityLexeme, quantityScale);
      if (
        price < 0n ||
        price > priceScale ||
        quantity <= 0n ||
        (tick !== null && price % tick !== 0n)
      ) {
        throw new Error(`book.asks[${index}] violates the fixed-point contract`);
      }
      return Object.freeze({
        price: price.toString(),
        quantity: quantity.toString(),
        levelIdentity: hashCanonical({
          rawHash: input.rawHash,
          side: "ASK",
          index,
          priceLexeme,
          quantityLexeme,
        }),
      });
    }),
  );
  const nativeGeneration =
    input.binding.venueId === "polymarket-global"
      ? string(raw.hash, "book.hash")
      : null;
  const marketId =
    input.binding.venueId === "polymarket-global"
      ? string(raw.market, "book.market")
      : null;
  return Object.freeze({ nativeGeneration, marketId, levels });
}

function parsePolymarketFee(input: {
  bytes: Uint8Array;
  binding: ListingBinding;
  instrumentId: string;
  rawHash: Hash;
  protocolIdentity: string;
}): Readonly<{
  wire: Readonly<Record<string, unknown>>;
  model: "COLLATERAL_RATE_V1" | "BINARY_PRICE_CURVE_V1";
  qualification: "EXACT" | "REQUIRES_MATCH_CALIBRATION";
}> {
  const raw = object(decode(input.bytes), "Polymarket CLOB market info");
  if (!Array.isArray(raw.t) || raw.t.length < 2 || raw.t.length > 64) {
    throw new Error("Polymarket CLOB market info has no bounded token set");
  }
  const tokenIds = raw.t.map((candidate, index) =>
    string(object(candidate, `fee.t[${index}]`).t, `fee.t[${index}].t`),
  );
  if (!tokenIds.includes(input.instrumentId)) {
    throw new Error("Polymarket fee evidence does not bind the outcome token");
  }
  const priceScale = BigInt(input.binding.priceScale);
  const reportedTick = parseFixed(string(raw.mts, "fee.mts"), priceScale);
  if (
    input.binding.minPriceTick !== null &&
    reportedTick !== BigInt(input.binding.minPriceTick)
  ) {
    throw new Error("Polymarket fee evidence reports another price tick");
  }
  const scheduleHash = hashCanonical({
    protocolIdentity: input.protocolIdentity,
    rawHash: input.rawHash,
    instrumentId: input.instrumentId,
    builderCodeApplied: false,
  });
  if (raw.fd === null) {
    return Object.freeze({
      model: "COLLATERAL_RATE_V1" as const,
      qualification: "EXACT" as const,
      wire: Object.freeze({
        model: "COLLATERAL_RATE_V1",
        rate: "0",
        rateScale: "1",
        flat: "0",
        scheduleHash,
      }),
    });
  }
  const details = object(raw.fd, "fee.fd");
  const rate = parseFixed(string(details.r, "fee.fd.r"), priceScale);
  const exponent = string(details.e, "fee.fd.e");
  if (rate < 0n || rate >= priceScale || exponent !== "1" || details.to !== true) {
    throw new Error(
      "Polymarket fee curve rate, exponent, or taker-only posture is unsupported",
    );
  }
  const feePrecisionScale = 100_000n;
  if (priceScale % feePrecisionScale !== 0n) {
    throw new Error("Polymarket fee precision cannot bind the collateral scale");
  }
  return Object.freeze({
    model: "BINARY_PRICE_CURVE_V1" as const,
    qualification: "REQUIRES_MATCH_CALIBRATION" as const,
    wire: Object.freeze({
      model: "BINARY_PRICE_CURVE_V1",
      rate: rate.toString(),
      rateScale: priceScale.toString(),
      exponent: "1",
      roundingQuantum: (priceScale / feePrecisionScale).toString(),
      scheduleHash,
    }),
  });
}

function roundRationalToQuantumHalfEven(
  numerator: bigint,
  denominator: bigint,
  quantum: bigint,
): bigint {
  if (numerator < 0n || denominator <= 0n || quantum <= 0n) {
    throw new Error("banker's rounding requires a non-negative rational and positive quantum");
  }
  const quantumDenominator = denominator * quantum;
  const quotient = numerator / quantumDenominator;
  const remainder = numerator % quantumDenominator;
  const comparison = remainder * 2n - quantumDenominator;
  const roundedUnits = comparison < 0n
    ? quotient
    : comparison > 0n
      ? quotient + 1n
      : quotient % 2n === 0n
        ? quotient
        : quotient + 1n;
  return roundedUnits * quantum;
}

function parsePolymarketUsFee(input: {
  bytes: Uint8Array;
  binding: ListingBinding;
  instrumentId: string;
  rawHash: Hash;
  bookRawHash: Hash;
  protocolIdentity: string;
  levels: readonly Readonly<{ price: string; quantity: string; levelIdentity: Hash }>[];
  requestedQuantity: string;
}): Readonly<{
  wire: Readonly<Record<string, unknown>>;
  model: "BINARY_THETA_ORDER_BOUND_V1";
  qualification: "EXACT";
}> {
  const root = object(decode(input.bytes), "Polymarket US market detail");
  const market = object(root.market, "fee.market");
  const slug = string(market.slug, "fee.market.slug");
  if (slug !== input.binding.venueInstrumentId) {
    throw new Error("Polymarket US fee evidence reports another market slug");
  }
  if (
    market.active !== true ||
    market.closed !== false ||
    market.archived !== false ||
    market.status !== "MARKET_STATUS_OPEN"
  ) {
    throw new Error("Polymarket US fee evidence is not for an open market");
  }
  const priceScale = BigInt(input.binding.priceScale);
  const quantityScale = BigInt(input.binding.quantityScale);
  const requestedQuantity = BigInt(input.requestedQuantity);
  const tick = parseFixed(
    string(market.orderPriceMinTickSize, "fee.market.orderPriceMinTickSize"),
    priceScale,
  );
  if (
    input.binding.minPriceTick === null ||
    tick !== BigInt(input.binding.minPriceTick)
  ) {
    throw new Error("Polymarket US fee evidence reports another price tick");
  }
  const minimumQuantity = parseFixed(
    string(market.minimumTradeQty, "fee.market.minimumTradeQty"),
    quantityScale,
  );
  if (minimumQuantity <= 0n || requestedQuantity % minimumQuantity !== 0n) {
    throw new Error("Polymarket US requested quantity is not aligned to minimumTradeQty");
  }
  if (!Array.isArray(market.marketSides) || market.marketSides.length !== 2) {
    throw new Error("Polymarket US fee evidence has no binary side binding");
  }
  const sides = market.marketSides.map((candidate, index) => {
    const side = object(candidate, `fee.market.marketSides[${index}]`);
    return Object.freeze({
      id: string(side.id, `fee.market.marketSides[${index}].id`),
      identifier: string(
        side.identifier,
        `fee.market.marketSides[${index}].identifier`,
      ),
      description: string(
        side.description,
        `fee.market.marketSides[${index}].description`,
      ),
      long: side.long,
    });
  });
  const trueSide = sides.find((side) => side.id === input.binding.trueOutcome.venueOutcomeId);
  const falseSide = sides.find((side) => side.id === input.binding.falseOutcome.venueOutcomeId);
  if (
    trueSide === undefined ||
    falseSide === undefined ||
    trueSide.long !== true ||
    falseSide.long !== false ||
    trueSide.identifier !== slug ||
    falseSide.identifier !== slug ||
    trueSide.description.trim().toLowerCase() !== "yes" ||
    falseSide.description.trim().toLowerCase() !== "no"
  ) {
    throw new Error("Polymarket US fee evidence changed the bound Yes/No side mapping");
  }
  const thetaScale = priceScale;
  const theta = parseFixed(
    string(market.feeCoefficient, "fee.market.feeCoefficient"),
    thetaScale,
  );
  if (theta < 0n || theta >= thetaScale) {
    throw new Error("Polymarket US theta fee coefficient is outside [0, 1)");
  }
  if (priceScale % 100n !== 0n) {
    throw new Error("Polymarket US collateral scale cannot represent one cent");
  }
  const feeQuantum = priceScale / 100n;
  const sorted = [...input.levels].sort((left, right) => {
    const leftPrice = BigInt(left.price);
    const rightPrice = BigInt(right.price);
    return leftPrice === rightPrice
      ? left.levelIdentity.localeCompare(right.levelIdentity)
      : leftPrice < rightPrice
        ? -1
        : 1;
  });
  let remaining = requestedQuantity;
  let cumulativeNumerator = 0n;
  for (const level of sorted) {
    if (remaining === 0n) break;
    const quantity = BigInt(level.quantity);
    const fillQuantity = quantity < remaining ? quantity : remaining;
    const price = BigInt(level.price);
    cumulativeNumerator +=
      fillQuantity * theta * price * (priceScale - price);
    remaining -= fillQuantity;
  }
  const cumulativeDenominator = quantityScale * thetaScale * priceScale;
  const feeBound = roundRationalToQuantumHalfEven(
    cumulativeNumerator,
    cumulativeDenominator,
    feeQuantum,
  );
  const scheduleHash = hashCanonical({
    protocolIdentity: input.protocolIdentity,
    rulesIdentity: "polymarket-us-theta-bankers-cumulative-cap:2026-07-01",
    marketRawHash: input.rawHash,
    bookRawHash: input.bookRawHash,
    slug,
    instrumentId: input.instrumentId,
    requestedQuantity,
    theta,
    thetaScale,
    feeQuantum,
    rounding: "HALF_TO_EVEN",
    cumulativeOrderCap: true,
  });
  return Object.freeze({
    model: "BINARY_THETA_ORDER_BOUND_V1",
    qualification: "EXACT",
    wire: Object.freeze({
      model: "COLLATERAL_RATE_V1",
      rate: "0",
      rateScale: "1",
      flat: feeBound.toString(),
      scheduleHash,
    }),
  });
}

function finalizeRecord(
  body: Omit<AnonymousSimulationMaterializationRecord, "materializationId">,
): AnonymousSimulationMaterializationRecord {
  return Object.freeze({ ...body, materializationId: hashCanonical(body) });
}

export class AnonymousSimulationMaterializerDesk {
  readonly #fetcher: AnonymousMaterializerFetchLike;
  readonly #now: () => Date;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxSnapshotSkewMs: number;
  readonly #retentionLimit: number;
  readonly #store: AnonymousSimulationMaterializationStore | undefined;
  #refreshing = false;
  #records: AnonymousSimulationMaterializationRecord[] = [];
  #rawSources = new Map<Hash, StoredAnonymousMaterializationSource>();

  public constructor(options?: {
    fetcher?: AnonymousMaterializerFetchLike;
    now?: () => Date;
    timeoutMs?: number;
    maxResponseBytes?: number;
    maxSnapshotSkewMs?: number;
    retentionLimit?: number;
    store?: AnonymousSimulationMaterializationStore;
  }) {
    this.#fetcher = options?.fetcher ?? fetch;
    this.#now = options?.now ?? (() => new Date());
    this.#timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxResponseBytes =
      options?.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.#maxSnapshotSkewMs =
      options?.maxSnapshotSkewMs ?? DEFAULT_MAX_SNAPSHOT_SKEW_MS;
    this.#retentionLimit = options?.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    this.#store = options?.store;
    assertPositiveInteger(this.#timeoutMs, "materializer timeout");
    assertPositiveInteger(this.#maxResponseBytes, "materializer response cap");
    assertPositiveInteger(this.#maxSnapshotSkewMs, "materializer snapshot skew");
    assertPositiveInteger(this.#retentionLimit, "materializer retention");
    const restored =
      this.#store?.loadAnonymousSimulationMaterializations(
        this.#retentionLimit,
      ) ?? [];
    for (const stored of restored.map(
      verifyStoredAnonymousSimulationMaterialization,
    )) {
      this.#records.push(stored.record);
      for (const source of stored.rawSources) {
        this.#rawSources.set(source.record.sourceId, source);
      }
    }
  }

  async #get(
    input: Readonly<{
      kind: "BOOK" | "FEE";
      venueId: string;
      instrumentId: string;
      protocolIdentity: string;
      sourceUrl: string;
    }>,
  ): Promise<StoredAnonymousMaterializationSource> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(input.sourceUrl, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        headers: Object.freeze({
          accept: "application/json",
          "user-agent": "prediction-market-harness/0.0 anonymous-materializer",
        }),
        signal: controller.signal,
      });
      if (response.status !== 200) {
        throw new Error(`anonymous GET returned HTTP ${response.status}`);
      }
      const bytes = await readBoundedResponse(response, this.#maxResponseBytes);
      return sourceRecord({
        ...input,
        receivedAt: this.#now().toISOString(),
        response,
        bytes,
        nativeGeneration: null,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async #materializeLeg(
    leg: PortfolioLeg,
    binding: ListingBinding,
    requestedQuantity: string,
  ): Promise<MaterializedRequest> {
    const instrumentId = outcomeInstrument(leg, binding);
    const sourceUrl = bookUrl(binding, instrumentId);
    if (sourceUrl === null) {
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: "UNSUPPORTED_ANONYMOUS_BOOK",
        diagnostic: `${binding.venueId} has no qualified anonymous outcome-book adapter`,
      });
    }
    let bookSource: StoredAnonymousMaterializationSource;
    try {
      bookSource = await this.#get({
        kind: "BOOK",
        venueId: binding.venueId,
        instrumentId,
        protocolIdentity:
          binding.venueId === "polymarket-global"
            ? "clob-book-rest:2026-08-01"
            : binding.venueId === "polymarket-us"
              ? "gateway-market-book-v1:2026-08-02"
              : "api-v1-orderbook:2026-08-01",
        sourceUrl,
      });
    } catch (error) {
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: "BOOK_ACQUISITION_FAILED",
        diagnostic: error instanceof Error ? error.message : "book acquisition failed",
      });
    }
    let book: ReturnType<typeof parseBook>;
    try {
      book = parseBook({
        binding,
        instrumentId,
        outcome: leg.outcome,
        bytes: bookSource.bytes,
        rawHash: bookSource.record.rawHash,
      });
      bookSource = withNativeGeneration(bookSource, book.nativeGeneration);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "book schema is invalid";
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: diagnostic.includes("does not match")
          ? "BOOK_INSTRUMENT_MISMATCH"
          : "BOOK_SCHEMA_INVALID",
        diagnostic,
        sources: Object.freeze([bookSource]),
      });
    }
    if (binding.venueId === "limitless") {
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: "DYNAMIC_FEE_MODEL_UNSUPPORTED",
        diagnostic:
          "Limitless taker fees vary with execution price, but the published table does not define an exact function that can be qualified",
        sources: Object.freeze([bookSource]),
        askLevelCount: book.levels.length,
      });
    }
    const polymarketFeeUrl = feeUrl(binding, book.marketId);
    if (polymarketFeeUrl === null) {
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: "FEE_ACQUISITION_FAILED",
        diagnostic: "Polymarket book did not expose a condition identity",
        sources: Object.freeze([bookSource]),
        askLevelCount: book.levels.length,
      });
    }
    let feeSource: StoredAnonymousMaterializationSource;
    try {
      feeSource = await this.#get({
        kind: "FEE",
        venueId: binding.venueId,
        instrumentId,
        protocolIdentity:
          binding.venueId === "polymarket-us"
            ? "gateway-market-detail-v1:2026-08-02"
            : "clob-market-info-rest:2026-08-01",
        sourceUrl: polymarketFeeUrl,
      });
    } catch (error) {
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: "FEE_ACQUISITION_FAILED",
        diagnostic: error instanceof Error ? error.message : "fee acquisition failed",
        sources: Object.freeze([bookSource]),
        askLevelCount: book.levels.length,
      });
    }
    let feeSchedule:
      | ReturnType<typeof parsePolymarketFee>
      | ReturnType<typeof parsePolymarketUsFee>;
    try {
      feeSchedule = binding.venueId === "polymarket-us"
        ? parsePolymarketUsFee({
            bytes: feeSource.bytes,
            binding,
            instrumentId,
            rawHash: feeSource.record.rawHash,
            bookRawHash: bookSource.record.rawHash,
            protocolIdentity: feeSource.record.protocolIdentity,
            levels: book.levels,
            requestedQuantity,
          })
        : parsePolymarketFee({
            bytes: feeSource.bytes,
            binding,
            instrumentId,
            rawHash: feeSource.record.rawHash,
            protocolIdentity: feeSource.record.protocolIdentity,
          });
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "fee schema is invalid";
      return blockedLeg({
        leg,
        binding,
        instrumentId,
        blocker: diagnostic.includes("minimumTradeQty")
          ? "ORDER_QUANTITY_UNSUPPORTED"
          : "FEE_ACQUISITION_FAILED",
        diagnostic,
        sources: Object.freeze([bookSource, feeSource]),
        askLevelCount: book.levels.length,
      });
    }
    const sources = Object.freeze([bookSource, feeSource]);
    const observedAtEpochMs = BigInt(
      Date.parse(bookSource.record.receivedAt),
    ).toString();
    return Object.freeze({
      leg: Object.freeze({
        legId: leg.legId,
        venueId: binding.venueId,
        instrumentId,
        outcome: leg.outcome,
        status: "READY" as const,
        blocker: null,
        diagnostic: null,
        bookSourceId: bookSource.record.sourceId,
        feeSourceId: feeSource.record.sourceId,
        askLevelCount: book.levels.length,
        feeModel: feeSchedule.model,
        feeQualification: feeSchedule.qualification,
      }),
      sources,
      request: Object.freeze({
        model: "CLOB_TAKER_V1",
        venueId: binding.venueId,
        instrumentId,
        side: "BUY",
        fillPolicy: "FILL_OR_KILL",
        requestedQuantity,
        quantityScale: binding.quantityScale,
        collateralScale: binding.priceScale,
        levels: book.levels,
        fee: feeSchedule.wire,
        bookStateHash: hashCanonical({
          protocolIdentity: bookSource.record.protocolIdentity,
          rawHash: bookSource.record.rawHash,
          nativeGeneration: book.nativeGeneration,
        }),
        observedAtEpochMs,
      }),
    });
  }

  public async materialize(input: {
    qualification: ResearchRelationPayoffQualification;
    portfolioId: string;
    requestedQuantity: string;
  }): Promise<AnonymousSimulationMaterializationResult> {
    if (this.#refreshing) {
      throw new Error("anonymous simulation materializer is already refreshing");
    }
    if (
      input.qualification.status !== "SIMULATION_TEMPLATE_READY" ||
      !UNSIGNED_DECIMAL.test(input.requestedQuantity) ||
      BigInt(input.requestedQuantity) <= 0n
    ) {
      throw new Error("materialization requires a ready template and positive base-unit quantity");
    }
    const portfolio = input.qualification.portfolios.find(
      (candidate) => candidate.portfolioId === input.portfolioId,
    );
    if (portfolio === undefined) {
      throw new Error("materialization portfolio is not qualified");
    }
    this.#refreshing = true;
    const attemptedAt = this.#now().toISOString();
    try {
      const results = await Promise.all(
        portfolio.legs.map((leg) => {
          const binding = input.qualification.listingBindings.find(
            (candidate) => candidate.listingRef === leg.listingRef,
          );
          if (binding === undefined) {
            throw new Error(`materialization has no listing binding for ${leg.listingRef}`);
          }
          return this.#materializeLeg(leg, binding, input.requestedQuantity);
        }),
      );
      const sources = Object.freeze(results.flatMap((result) => result.sources));
      const receiveTimes = sources.map((source) =>
        Date.parse(source.record.receivedAt),
      );
      const skew =
        receiveTimes.length < 2
          ? 0
          : Math.max(...receiveTimes) - Math.min(...receiveTimes);
      let legs = Object.freeze(results.map((result) => result.leg));
      const fixedPointContracts = new Set(
        portfolio.legs.map((leg) => {
          const binding = input.qualification.listingBindings.find(
            (candidate) => candidate.listingRef === leg.listingRef,
          )!;
          return `${binding.quantityScale}:${binding.priceScale}`;
        }),
      );
      if (
        fixedPointContracts.size !== 1 &&
        legs.every((leg) => leg.status === "READY")
      ) {
        legs = Object.freeze(
          legs.map((leg) =>
            Object.freeze({
              ...leg,
              status: "BLOCKED" as const,
              blocker: "INCOMPATIBLE_PORTFOLIO_SCALE" as const,
              diagnostic:
                "the current portfolio simulator requires equal quantity and collateral scales across every leg",
            }),
          ),
        );
      }
      if (skew > this.#maxSnapshotSkewMs && legs.every((leg) => leg.status === "READY")) {
        legs = Object.freeze(
          legs.map((leg) =>
            Object.freeze({
              ...leg,
              status: "BLOCKED" as const,
              blocker: "SNAPSHOT_SKEW_EXCEEDED" as const,
              diagnostic: `source receive-time skew ${skew} ms exceeds ${this.#maxSnapshotSkewMs} ms`,
            }),
          ),
        );
      }
      let plan: OpportunitySimulationPlan | null = null;
      let intakeDiagnostic: string | null = null;
      if (legs.every((leg) => leg.status === "READY")) {
        try {
          plan = parseOpportunitySimulationIntake(
            {
              opportunityId: input.qualification.opportunityId,
              portfolioId: portfolio.portfolioId,
              legs: portfolio.legs.map((leg) => ({
                legId: leg.legId,
                request: results.find((result) => result.leg.legId === leg.legId)!
                  .request,
              })),
            },
            input.qualification,
          );
        } catch (error) {
          intakeDiagnostic =
            error instanceof Error ? error.message : "simulation intake rejected";
          legs = Object.freeze(
            legs.map((leg) =>
              Object.freeze({
                ...leg,
                status: "BLOCKED" as const,
                blocker: "SIMULATION_INTAKE_REJECTED" as const,
                diagnostic: compactDiagnostic(intakeDiagnostic!),
              }),
            ),
          );
        }
      }
      const status = legs.every((leg) => leg.status === "READY")
        ? ("READY" as const)
        : ("BLOCKED" as const);
      const completedAt = this.#now().toISOString();
      const body = Object.freeze({
        schemaVersion: "pmh.anonymous-simulation-materialization.v1" as const,
        opportunityId: input.qualification.opportunityId,
        relationConstraintHash: input.qualification.artifactHash,
        semanticDecisionId: input.qualification.semanticDecisionId,
        portfolioId: portfolio.portfolioId,
        requestedQuantity: input.requestedQuantity,
        attemptedAt,
        completedAt,
        status,
        diagnostic:
          status === "READY"
            ? null
            : intakeDiagnostic ??
              legs
                .filter((leg) => leg.diagnostic !== null)
                .map((leg) => `${leg.legId}: ${leg.diagnostic}`)
                .join(" | "),
        legs,
        sources: Object.freeze(sources.map((source) => source.record)),
        authority: "ANONYMOUS_RESEARCH_MATERIALIZER" as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        effects: Object.freeze({
          externalWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      });
      const record = finalizeRecord(body);
      const persisted =
        this.#store?.saveAnonymousSimulationMaterialization(
          { record, rawSources: sources },
          this.#retentionLimit,
        ) ?? { record, rawSources: sources };
      const verified = verifyStoredAnonymousSimulationMaterialization(persisted);
      this.#records = [
        verified.record,
        ...this.#records.filter(
          (candidate) =>
            candidate.materializationId !== verified.record.materializationId,
        ),
      ].slice(0, this.#retentionLimit);
      for (const source of sources) {
        this.#rawSources.set(source.record.sourceId, copyStoredSource(source));
      }
      const retainedIds = new Set(
        this.#records.flatMap((item) =>
          item.sources.map((source) => source.sourceId),
        ),
      );
      for (const sourceId of this.#rawSources.keys()) {
        if (!retainedIds.has(sourceId)) this.#rawSources.delete(sourceId);
      }
      return Object.freeze({
        record: verified.record,
        plan,
        rawSources: verified.rawSources,
      });
    } finally {
      this.#refreshing = false;
    }
  }

  public rawSource(
    sourceId: Hash,
  ): StoredAnonymousMaterializationSource | undefined {
    const source = this.#rawSources.get(sourceId);
    return source === undefined ? undefined : copyStoredSource(source);
  }

  public projection(): AnonymousSimulationMaterializerProjection {
    const latest = this.#records[0];
    return Object.freeze({
      schemaVersion: "pmh.anonymous-simulation-materializer-desk.v1",
      mode: "ANONYMOUS_PUBLIC_GET",
      status: this.#refreshing
        ? "REFRESHING"
        : latest?.status ?? "IDLE",
      runCount: this.#records.length,
      readyCount: this.#records.filter((record) => record.status === "READY")
        .length,
      blockedCount: this.#records.filter((record) => record.status === "BLOCKED")
        .length,
      retentionLimit: this.#retentionLimit,
      timeoutMs: this.#timeoutMs,
      maxResponseBytes: this.#maxResponseBytes,
      maxSnapshotSkewMs: this.#maxSnapshotSkewMs,
      retainedRawSourceCount: this.#rawSources.size,
      storage:
        this.#store?.anonymousSimulationMaterializationStorage ??
        Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "materializationId" as const,
        }),
      records: Object.freeze(this.#records),
      authority: "ANONYMOUS_RESEARCH_MATERIALIZER",
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}
