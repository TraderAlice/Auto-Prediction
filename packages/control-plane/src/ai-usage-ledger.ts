import { randomUUID } from "node:crypto";
import { hashCanonical, type Hash } from "@pmh/domain";
import type { OperationalStorageProjection } from "./types.js";

export const AI_USAGE_PURPOSES = Object.freeze([
  "DISCOVERY_FAST",
  "SEMANTIC_REVIEW",
  "RULE_EVIDENCE_CLAIM",
  "PREMISE_ANALYSIS",
  "PREMISE_EVIDENCE_ROUTING",
  "PROBABILITY_ESTIMATION",
  "PI_INVESTIGATION",
  "PI_MARKET_ARCHAEOLOGY",
] as const);

export type AiUsagePurpose = (typeof AI_USAGE_PURPOSES)[number];
export type AiUsageOutcome =
  | "SUCCEEDED"
  | "ABSTAINED"
  | "FAILED"
  | "TIMED_OUT";
export type AiUsageCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";

export type AiTokenBreakdown = Readonly<{
  inputTokens: string | null;
  outputTokens: string | null;
  reasoningTokens: string | null;
  cacheReadTokens: string | null;
  cacheWriteTokens: string | null;
  totalTokens: string | null;
}>;

export type AiUsageEvent = Readonly<{
  schemaVersion: "pmh.ai-usage-event.v1";
  eventId: Hash;
  occurredAt: string;
  durationMs: string;
  purpose: AiUsagePurpose;
  role: string | null;
  provider: string;
  model: string;
  transport: "VERCEL_AI_SDK" | "PI_CLI";
  operationIdentity: string;
  outcome: AiUsageOutcome;
  durableEffect: boolean;
  coverage: AiUsageCoverage;
  invocationCount: "1";
  providerRequestCount: string | null;
  tokens: AiTokenBreakdown;
  artifactHash: Hash;
}>;

export type AiUsageEventDraft = Readonly<{
  occurredAt?: string;
  durationMs: number;
  purpose: AiUsagePurpose;
  role?: string | null;
  provider: string;
  model: string;
  transport: "VERCEL_AI_SDK" | "PI_CLI";
  operationIdentity: string;
  outcome: AiUsageOutcome;
  durableEffect: boolean;
  providerRequestCount?: number | null;
  usage?: AiSdkUsageLike | null;
}>;

export type AiSdkUsageLike = Readonly<{
  inputTokens?: number | undefined;
  inputTokenDetails?: Readonly<{
    noCacheTokens?: number | undefined;
    cacheReadTokens?: number | undefined;
    cacheWriteTokens?: number | undefined;
  }> | undefined;
  outputTokens?: number | undefined;
  outputTokenDetails?: Readonly<{
    textTokens?: number | undefined;
    reasoningTokens?: number | undefined;
  }> | undefined;
  totalTokens?: number | undefined;
}>;

export interface AiUsageRecorder {
  record(draft: AiUsageEventDraft): AiUsageEvent;
}

export interface AiUsageEventStore {
  readonly aiUsageStorage: OperationalStorageProjection<"eventId">;
  loadAiUsageEvents(): readonly AiUsageEvent[];
  saveAiUsageEvent(event: AiUsageEvent): void;
}

type AggregateDimension = "PURPOSE" | "ROLE" | "MODEL" | "OUTCOME";

export type AiUsageAggregate = Readonly<{
  dimension: AggregateDimension;
  key: string;
  invocationCount: string;
  durableEffectCount: string;
  completeCount: string;
  partialCount: string;
  unavailableCount: string;
  tokens: AiTokenBreakdown;
}>;

export type AiUsageTimeBucket = Readonly<{
  bucket: string;
  invocationCount: string;
  durableEffectCount: string;
  tokens: AiTokenBreakdown;
}>;

export type AiUsageProjection = Readonly<{
  schemaVersion: "pmh.ai-usage-ledger.v1";
  eventCount: number;
  coverage: Readonly<{
    complete: number;
    partial: number;
    unavailable: number;
  }>;
  totals: AiUsageAggregate;
  byPurpose: readonly AiUsageAggregate[];
  byRole: readonly AiUsageAggregate[];
  byModel: readonly AiUsageAggregate[];
  byOutcome: readonly AiUsageAggregate[];
  hourly: readonly AiUsageTimeBucket[];
  daily: readonly AiUsageTimeBucket[];
  recentEvents: readonly AiUsageEvent[];
  storage: OperationalStorageProjection<"eventId">;
  promptTextRetained: false;
  outputTextRetained: false;
  currencyCostEstimated: false;
}>;

const EMPTY_TOKENS: AiTokenBreakdown = Object.freeze({
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  totalTokens: null,
});

function integerString(value: number | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("AI usage token values must be non-negative safe integers");
  }
  return String(value);
}

function boundedText(value: string, name: string, maximum = 180): string {
  const compact = value.trim().replace(/\s+/g, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${name} must be non-empty and at most ${maximum} characters`);
  }
  return compact;
}

function tokensFromUsage(usage: AiSdkUsageLike | null | undefined): AiTokenBreakdown {
  if (usage === undefined || usage === null) return EMPTY_TOKENS;
  return Object.freeze({
    inputTokens: integerString(usage.inputTokens),
    outputTokens: integerString(usage.outputTokens),
    reasoningTokens: integerString(usage.outputTokenDetails?.reasoningTokens),
    cacheReadTokens: integerString(usage.inputTokenDetails?.cacheReadTokens),
    cacheWriteTokens: integerString(usage.inputTokenDetails?.cacheWriteTokens),
    totalTokens: integerString(usage.totalTokens),
  });
}

function coverageFor(tokens: AiTokenBreakdown, transport: AiUsageEvent["transport"]): AiUsageCoverage {
  const known = Object.values(tokens).filter((value) => value !== null).length;
  if (known === 0) return transport === "PI_CLI" ? "PARTIAL" : "UNAVAILABLE";
  return tokens.inputTokens !== null && tokens.outputTokens !== null &&
      tokens.totalTokens !== null
    ? "COMPLETE"
    : "PARTIAL";
}

function parseIso(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("AI usage occurredAt must be a canonical ISO timestamp");
  }
  return value;
}

function tokenValue(value: string | null): bigint | null {
  if (value === null) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("AI usage token string is invalid");
  return BigInt(value);
}

export function assertAiUsageEvent(value: AiUsageEvent): AiUsageEvent {
  if (value.schemaVersion !== "pmh.ai-usage-event.v1") {
    throw new Error("AI usage event schema is unsupported");
  }
  parseIso(value.occurredAt);
  tokenValue(value.durationMs);
  if (!AI_USAGE_PURPOSES.includes(value.purpose)) throw new Error("AI usage purpose is invalid");
  if (!["SUCCEEDED", "ABSTAINED", "FAILED", "TIMED_OUT"].includes(value.outcome)) {
    throw new Error("AI usage outcome is invalid");
  }
  if (!["COMPLETE", "PARTIAL", "UNAVAILABLE"].includes(value.coverage)) {
    throw new Error("AI usage coverage is invalid");
  }
  boundedText(value.provider, "AI usage provider");
  boundedText(value.model, "AI usage model");
  boundedText(value.operationIdentity, "AI usage operation identity", 240);
  if (value.role !== null) boundedText(value.role, "AI usage role");
  if (value.invocationCount !== "1") throw new Error("AI usage invocation count must be one");
  if (value.providerRequestCount !== null) tokenValue(value.providerRequestCount);
  Object.values(value.tokens).forEach(tokenValue);
  const expectedCoverage = coverageFor(value.tokens, value.transport);
  if (expectedCoverage !== value.coverage) throw new Error("AI usage coverage is inconsistent");
  const { artifactHash: _artifactHash, ...body } = value;
  if (hashCanonical(body) !== value.artifactHash) throw new Error("AI usage artifact hash mismatch");
  return value;
}

function addNullable(left: string | null, right: string | null): string | null {
  if (left === null && right === null) return null;
  return String((left === null ? 0n : BigInt(left)) + (right === null ? 0n : BigInt(right)));
}

function addTokens(left: AiTokenBreakdown, right: AiTokenBreakdown): AiTokenBreakdown {
  return Object.freeze({
    inputTokens: addNullable(left.inputTokens, right.inputTokens),
    outputTokens: addNullable(left.outputTokens, right.outputTokens),
    reasoningTokens: addNullable(left.reasoningTokens, right.reasoningTokens),
    cacheReadTokens: addNullable(left.cacheReadTokens, right.cacheReadTokens),
    cacheWriteTokens: addNullable(left.cacheWriteTokens, right.cacheWriteTokens),
    totalTokens: addNullable(left.totalTokens, right.totalTokens),
  });
}

function aggregate(
  events: readonly AiUsageEvent[],
  dimension: AggregateDimension,
  key: string,
): AiUsageAggregate {
  let tokens = EMPTY_TOKENS;
  for (const event of events) tokens = addTokens(tokens, event.tokens);
  return Object.freeze({
    dimension,
    key,
    invocationCount: String(events.length),
    durableEffectCount: String(events.filter((event) => event.durableEffect).length),
    completeCount: String(events.filter((event) => event.coverage === "COMPLETE").length),
    partialCount: String(events.filter((event) => event.coverage === "PARTIAL").length),
    unavailableCount: String(events.filter((event) => event.coverage === "UNAVAILABLE").length),
    tokens,
  });
}

function grouped(
  events: readonly AiUsageEvent[],
  dimension: AggregateDimension,
  keyFor: (event: AiUsageEvent) => string,
): readonly AiUsageAggregate[] {
  const groups = new Map<string, AiUsageEvent[]>();
  for (const event of events) {
    const key = keyFor(event);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return Object.freeze([...groups].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => aggregate(group, dimension, key)));
}

function timeBuckets(
  events: readonly AiUsageEvent[],
  granularity: "HOUR" | "DAY",
  limit: number,
): readonly AiUsageTimeBucket[] {
  const groups = new Map<string, AiUsageEvent[]>();
  for (const event of events) {
    const key = granularity === "HOUR"
      ? `${event.occurredAt.slice(0, 13)}:00:00.000Z`
      : `${event.occurredAt.slice(0, 10)}T00:00:00.000Z`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return Object.freeze([...groups].sort(([left], [right]) => right.localeCompare(left))
    .slice(0, limit).reverse().map(([bucket, group]) => {
      const total = aggregate(group, "OUTCOME", bucket);
      return Object.freeze({
        bucket,
        invocationCount: total.invocationCount,
        durableEffectCount: total.durableEffectCount,
        tokens: total.tokens,
      });
    }));
}

export class AiUsageLedger implements AiUsageRecorder {
  readonly #events: AiUsageEvent[];
  readonly #sessionIdentity = hashCanonical({
    schemaVersion: "pmh.ai-usage-observer-session.v1",
    nonce: randomUUID(),
  });
  #ordinal = 0;

  public constructor(
    private readonly retentionLimit = 200,
    private readonly store?: AiUsageEventStore,
  ) {
    if (!Number.isSafeInteger(retentionLimit) || retentionLimit < 1 || retentionLimit > 10_000) {
      throw new Error("AI usage retention limit must be from 1 through 10000");
    }
    this.#events = [...(store?.loadAiUsageEvents() ?? []).map(assertAiUsageEvent)]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  }

  public record(draft: AiUsageEventDraft): AiUsageEvent {
    if (!Number.isSafeInteger(draft.durationMs) || draft.durationMs < 0) {
      throw new Error("AI usage duration must be a non-negative safe integer");
    }
    if (draft.providerRequestCount !== undefined && draft.providerRequestCount !== null &&
      (!Number.isSafeInteger(draft.providerRequestCount) || draft.providerRequestCount < 0)) {
      throw new Error("AI usage provider request count must be a non-negative safe integer");
    }
    const occurredAt = parseIso(draft.occurredAt ?? new Date().toISOString());
    const tokens = tokensFromUsage(draft.usage);
    const ordinal = ++this.#ordinal;
    const eventId = hashCanonical({
      schemaVersion: "pmh.ai-usage-event-id.v1",
      observerSessionIdentity: this.#sessionIdentity,
      ordinal,
      occurredAt,
      purpose: draft.purpose,
      operationIdentity: draft.operationIdentity,
    });
    const body = Object.freeze({
      schemaVersion: "pmh.ai-usage-event.v1" as const,
      eventId,
      occurredAt,
      durationMs: String(draft.durationMs),
      purpose: draft.purpose,
      role: draft.role === undefined || draft.role === null
        ? null
        : boundedText(draft.role, "AI usage role"),
      provider: boundedText(draft.provider, "AI usage provider"),
      model: boundedText(draft.model, "AI usage model"),
      transport: draft.transport,
      operationIdentity: boundedText(
        draft.operationIdentity,
        "AI usage operation identity",
        240,
      ),
      outcome: draft.outcome,
      durableEffect: draft.durableEffect,
      coverage: coverageFor(tokens, draft.transport),
      invocationCount: "1" as const,
      providerRequestCount: integerString(draft.providerRequestCount),
      tokens,
    });
    const event = assertAiUsageEvent(Object.freeze({
      ...body,
      artifactHash: hashCanonical(body),
    }));
    this.#events.push(event);
    this.store?.saveAiUsageEvent(event);
    return event;
  }

  public projection(): AiUsageProjection {
    const events = Object.freeze([...this.#events]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)));
    const recentEvents = Object.freeze(events.slice(-this.retentionLimit).reverse());
    const storage = this.store?.aiUsageStorage ?? Object.freeze({
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "eventId" as const,
    });
    return Object.freeze({
      schemaVersion: "pmh.ai-usage-ledger.v1",
      eventCount: events.length,
      coverage: Object.freeze({
        complete: events.filter((event) => event.coverage === "COMPLETE").length,
        partial: events.filter((event) => event.coverage === "PARTIAL").length,
        unavailable: events.filter((event) => event.coverage === "UNAVAILABLE").length,
      }),
      totals: aggregate(events, "PURPOSE", "ALL"),
      byPurpose: grouped(events, "PURPOSE", (event) => event.purpose),
      byRole: grouped(events, "ROLE", (event) => event.role ?? "UNSPECIFIED"),
      byModel: grouped(events, "MODEL", (event) => `${event.provider}/${event.model}`),
      byOutcome: grouped(events, "OUTCOME", (event) => event.outcome),
      hourly: timeBuckets(events, "HOUR", 48),
      daily: timeBuckets(events, "DAY", 30),
      recentEvents,
      storage,
      promptTextRetained: false,
      outputTextRetained: false,
      currencyCostEstimated: false,
    });
  }
}
