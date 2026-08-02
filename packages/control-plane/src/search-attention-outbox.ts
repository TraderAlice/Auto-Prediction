import { canonicalJson, hashCanonical, type Hash } from "@pmh/domain";
import type { SearchIssueRecord } from "./search-issue-scheduler.js";
import {
  isGroundedNovelCandidate,
  type SearchLeaseRecord,
} from "./search-lease-scheduler.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_DIGEST_WINDOW_MS = 3_600_000;
const DIGEST_CLOSE_GRACE_MS = 60_000;
const DEFAULT_RETENTION_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64_000;
const DEFAULT_MAX_DELIVERIES_PER_TICK = 4;
const RETRY_DELAYS_MS = Object.freeze([60_000, 300_000] as const);

export type SearchAttentionSeverity = "ROUTINE" | "WATCH" | "ACTION" | "DEGRADED";

export type SearchAttentionIssueMetrics = Readonly<{
  issueId: Hash;
  scanCount: number;
  passCount: number;
  failedCount: number;
  novelCandidateCount: number;
  proposalCount: number;
  piEscalationCount: number;
  economicPositiveCount: number;
  economicBlockedCount: number;
  quoteRescuedCount: number;
}>;

export type SearchAttentionMessageRecord = Readonly<{
  schemaVersion: "pmh.search-attention-message.v1";
  messageId: Hash;
  dedupeIdentity: Hash;
  kind: "HOURLY_DIGEST" | "ACTION_CANDIDATE" | "ISSUE_DEGRADED";
  severity: SearchAttentionSeverity;
  occurredAt: string;
  windowStart: string;
  windowEnd: string;
  issueIds: readonly Hash[];
  sourceLeaseIds: readonly Hash[];
  metrics: Readonly<{
    scanCount: number;
    passCount: number;
    failedCount: number;
    novelCandidateCount: number;
    proposalCount: number;
    piEscalationCount: number;
    economicPositiveCount: number;
    economicBlockedCount: number;
    quoteRescuedCount: number;
    byIssue: readonly SearchAttentionIssueMetrics[];
  }>;
  title: string;
  summary: string;
  authority: "ATTENTION_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type SearchAttentionDeliveryRecord = Readonly<{
  schemaVersion: "pmh.search-attention-delivery.v1";
  deliveryId: Hash;
  messageId: Hash;
  channel: "IN_APP" | "WEBHOOK_JSON";
  status: "PENDING" | "RETRY_WAIT" | "DELIVERED" | "ACKNOWLEDGED" | "DEAD_LETTER";
  attemptCount: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  lastHttpStatus: number | null;
  diagnostic: string | null;
  createdAt: string;
  updatedAt: string;
  destinationStored: false;
  valueMovingOperation: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export interface SearchAttentionStore {
  readonly searchAttentionMessageStorage: OperationalStorageProjection<"messageId">;
  readonly searchAttentionDeliveryStorage: OperationalStorageProjection<"deliveryId">;
  loadSearchAttentionMessages(limit: number): readonly SearchAttentionMessageRecord[];
  saveSearchAttentionMessage(
    record: SearchAttentionMessageRecord,
    retentionLimit: number,
  ): SearchAttentionMessageRecord;
  loadSearchAttentionDeliveries(limit: number): readonly SearchAttentionDeliveryRecord[];
  saveSearchAttentionDelivery(
    record: SearchAttentionDeliveryRecord,
    retentionLimit: number,
  ): SearchAttentionDeliveryRecord;
}

export type SearchAttentionProjection = Readonly<{
  schemaVersion: "pmh.search-attention-outbox.v1";
  status: "IDLE" | "DELIVERING";
  digestWindowMs: number;
  activationAt: string;
  retentionLimit: number;
  messageCount: number;
  digestCount: number;
  immediateCount: number;
  unreadInAppCount: number;
  pendingDeliveryCount: number;
  retryWaitCount: number;
  deliveredWebhookCount: number;
  deadLetterCount: number;
  channels: Readonly<{
    inApp: Readonly<{ configured: true }>;
    webhookJson: Readonly<{
      configured: boolean;
      destinationStored: false;
      destinationProjected: false;
      cutoverPolicy: "PROCESS_ACTIVATION_NO_HISTORY_REPLAY";
    }>;
  }>;
  messages: readonly SearchAttentionMessageRecord[];
  deliveries: readonly SearchAttentionDeliveryRecord[];
  storage: Readonly<{
    messages: OperationalStorageProjection<"messageId">;
    deliveries: OperationalStorageProjection<"deliveryId">;
  }>;
  authority: "ATTENTION_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: boolean;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type SearchAttentionFetchLike = (
  input: string,
  init: Readonly<{
    method: "POST";
    credentials: "omit";
    redirect: "error";
    headers: Readonly<Record<string, string>>;
    body: string;
    signal: AbortSignal;
  }>,
) => Promise<Response>;

type SearchAttentionOutboxOptions = Readonly<{
  store?: SearchAttentionStore;
  now?: () => number;
  fetch?: SearchAttentionFetchLike;
  webhookUrl?: string | null;
  digestWindowMs?: number;
  retentionLimit?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxDeliveriesPerTick?: number;
}>;

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function compactDiagnostic(value: unknown): string {
  const text = (value instanceof Error ? value.message : String(value))
    .replace(/\s+/gu, " ")
    .trim();
  return text.length <= 300 ? text : `${text.slice(0, 299)}…`;
}

function messageHashBody(
  record: SearchAttentionMessageRecord,
): Omit<SearchAttentionMessageRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function deliveryHashBody(
  record: SearchAttentionDeliveryRecord,
): Omit<SearchAttentionDeliveryRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

function withMessageHash(
  body: Omit<SearchAttentionMessageRecord, "artifactHash">,
): SearchAttentionMessageRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function withDeliveryHash(
  body: Omit<SearchAttentionDeliveryRecord, "artifactHash">,
): SearchAttentionDeliveryRecord {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function assertIssueMetrics(value: SearchAttentionIssueMetrics): void {
  if (!HASH.test(value.issueId) || [
    value.scanCount,
    value.passCount,
    value.failedCount,
    value.novelCandidateCount,
    value.proposalCount,
    value.piEscalationCount,
    value.economicPositiveCount,
    value.economicBlockedCount,
    value.quoteRescuedCount,
  ].some((count) => !validCount(count))) {
    throw new Error("search attention issue metrics are malformed");
  }
}

export function assertSearchAttentionMessage(
  record: SearchAttentionMessageRecord,
): SearchAttentionMessageRecord {
  if (record === null || typeof record !== "object") {
    throw new Error("search attention message is malformed");
  }
  const metrics = record.metrics;
  if (
    metrics === null || typeof metrics !== "object" ||
    record.schemaVersion !== "pmh.search-attention-message.v1" ||
    !HASH.test(record.messageId) || !HASH.test(record.dedupeIdentity) ||
    !["HOURLY_DIGEST", "ACTION_CANDIDATE", "ISSUE_DEGRADED"].includes(record.kind) ||
    !["ROUTINE", "WATCH", "ACTION", "DEGRADED"].includes(record.severity) ||
    !isIso(record.occurredAt) || !isIso(record.windowStart) || !isIso(record.windowEnd) ||
    Date.parse(record.windowStart) >= Date.parse(record.windowEnd) ||
    Date.parse(record.occurredAt) < Date.parse(record.windowStart) ||
    Date.parse(record.occurredAt) > Date.parse(record.windowEnd) ||
    record.issueIds.length < 1 || record.issueIds.length > 40 ||
    new Set(record.issueIds).size !== record.issueIds.length ||
    record.issueIds.some((id) => !HASH.test(id)) ||
    record.sourceLeaseIds.length < 1 || record.sourceLeaseIds.length > 40 ||
    new Set(record.sourceLeaseIds).size !== record.sourceLeaseIds.length ||
    record.sourceLeaseIds.some((id) => !HASH.test(id)) ||
    [metrics.scanCount, metrics.passCount, metrics.failedCount,
      metrics.novelCandidateCount, metrics.proposalCount,
      metrics.piEscalationCount, metrics.economicPositiveCount,
      metrics.economicBlockedCount, metrics.quoteRescuedCount]
      .some((count) => !validCount(count)) ||
    metrics.byIssue.length < 1 || metrics.byIssue.length > 40 ||
    !boundedText(record.title, 200) || !boundedText(record.summary, 1_000) ||
    record.authority !== "ATTENTION_ROUTING_ONLY" ||
    record.semanticDecisionAuthority !== false || record.simulationAuthority !== false ||
    record.certificateAuthority !== false || record.executionAuthority !== false ||
    !HASH.test(record.artifactHash)
  ) throw new Error("search attention message is malformed");
  metrics.byIssue.forEach(assertIssueMetrics);
  if (
    hashCanonical(messageHashBody(record)) !== record.artifactHash ||
    record.messageId !== hashCanonical({
      schemaVersion: "pmh.search-attention-message-id.v1",
      dedupeIdentity: record.dedupeIdentity,
    })
  ) throw new Error("search attention message identity mismatch");
  return record;
}

export function assertSearchAttentionDelivery(
  record: SearchAttentionDeliveryRecord,
): SearchAttentionDeliveryRecord {
  if (
    record === null || typeof record !== "object" ||
    record.schemaVersion !== "pmh.search-attention-delivery.v1" ||
    !HASH.test(record.deliveryId) || !HASH.test(record.messageId) ||
    !["IN_APP", "WEBHOOK_JSON"].includes(record.channel) ||
    !["PENDING", "RETRY_WAIT", "DELIVERED", "ACKNOWLEDGED", "DEAD_LETTER"]
      .includes(record.status) ||
    !validCount(record.attemptCount) || record.attemptCount > 3 ||
    !isIso(record.nextAttemptAt) ||
    (record.lastAttemptAt !== null && !isIso(record.lastAttemptAt)) ||
    (record.deliveredAt !== null && !isIso(record.deliveredAt)) ||
    (record.acknowledgedAt !== null && !isIso(record.acknowledgedAt)) ||
    (record.lastHttpStatus !== null &&
      (!Number.isSafeInteger(record.lastHttpStatus) || record.lastHttpStatus < 100 || record.lastHttpStatus > 599)) ||
    (record.diagnostic !== null && record.diagnostic.length > 300) ||
    !isIso(record.createdAt) || !isIso(record.updatedAt) ||
    record.destinationStored !== false || record.valueMovingOperation !== false ||
    record.executionAuthority !== false || !HASH.test(record.artifactHash)
  ) throw new Error("search attention delivery is malformed");
  if (
    record.channel === "IN_APP" && record.attemptCount !== 0 ||
    record.status === "ACKNOWLEDGED" && record.acknowledgedAt === null ||
    record.status === "DELIVERED" && record.deliveredAt === null ||
    hashCanonical(deliveryHashBody(record)) !== record.artifactHash ||
    record.deliveryId !== hashCanonical({
      schemaVersion: "pmh.search-attention-delivery-id.v1",
      messageId: record.messageId,
      channel: record.channel,
    })
  ) throw new Error("search attention delivery identity mismatch");
  return record;
}

function metricsFor(issueId: Hash, records: readonly SearchLeaseRecord[]): SearchAttentionIssueMetrics {
  return Object.freeze({
    issueId,
    scanCount: records.length,
    passCount: records.filter((record) => record.status === "PASS").length,
    failedCount: records.filter((record) => record.status === "FAILED").length,
    novelCandidateCount: records.filter(isGroundedNovelCandidate).length,
    proposalCount: records.reduce((sum, record) => sum + record.outcome.proposalCount, 0),
    piEscalationCount: records.filter((record) => record.deepLane.runId !== null).length,
    economicPositiveCount: records.filter((record) =>
      record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT"
    ).length,
    economicBlockedCount: records.filter((record) =>
      record.deepLane.reason === "ECONOMIC_GATE_BLOCKED"
    ).length,
    quoteRescuedCount: records.filter((record) => {
      const enrichment = record.fastLane.economicGate?.quoteEnrichment;
      return enrichment !== undefined && enrichment.status === "READY" &&
        record.fastLane.economicGate?.status !== "PRICE_UNAVAILABLE";
    }).length,
  });
}

function aggregateMetrics(records: readonly SearchLeaseRecord[]) {
  const issueIds = [...new Set(records.flatMap((record) =>
    record.lease.issueId === null || record.lease.issueId === undefined
      ? [] : [record.lease.issueId]
  ))].sort();
  const byIssue = Object.freeze(issueIds.map((issueId) =>
    metricsFor(issueId, records.filter((record) => record.lease.issueId === issueId))
  ));
  return Object.freeze({
    scanCount: records.length,
    passCount: records.filter((record) => record.status === "PASS").length,
    failedCount: records.filter((record) => record.status === "FAILED").length,
    novelCandidateCount: records.filter(isGroundedNovelCandidate).length,
    proposalCount: records.reduce((sum, record) => sum + record.outcome.proposalCount, 0),
    piEscalationCount: records.filter((record) => record.deepLane.runId !== null).length,
    economicPositiveCount: records.filter((record) =>
      record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT"
    ).length,
    economicBlockedCount: records.filter((record) =>
      record.deepLane.reason === "ECONOMIC_GATE_BLOCKED"
    ).length,
    quoteRescuedCount: records.filter((record) => {
      const enrichment = record.fastLane.economicGate?.quoteEnrichment;
      return enrichment !== undefined && enrichment.status === "READY" &&
        record.fastLane.economicGate?.status !== "PRICE_UNAVAILABLE";
    }).length,
    byIssue,
  });
}

function terminalRecords(records: readonly SearchLeaseRecord[]): readonly SearchLeaseRecord[] {
  return records.filter((record) =>
    record.status !== "ISSUED" && record.completedAt !== null &&
    record.lease.issueId !== null && record.lease.issueId !== undefined
  ).sort((left, right) =>
    left.completedAt!.localeCompare(right.completedAt!) ||
    left.lease.leaseId.localeCompare(right.lease.leaseId)
  );
}

function createMessage(input: Omit<SearchAttentionMessageRecord,
  "schemaVersion" | "messageId" | "artifactHash" | "authority" |
  "semanticDecisionAuthority" | "simulationAuthority" |
  "certificateAuthority" | "executionAuthority">): SearchAttentionMessageRecord {
  const body = Object.freeze({
    schemaVersion: "pmh.search-attention-message.v1" as const,
    messageId: hashCanonical({
      schemaVersion: "pmh.search-attention-message-id.v1",
      dedupeIdentity: input.dedupeIdentity,
    }),
    ...input,
    authority: "ATTENTION_ROUTING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertSearchAttentionMessage(withMessageHash(body));
}

function validateWebhookUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const url = new URL(raw);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
    url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new Error("search attention webhook must be HTTPS or loopback HTTP without userinfo or fragment");
  }
  return url.toString();
}

async function readBounded(response: Response, maximum: number): Promise<void> {
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/u.test(declared) && BigInt(declared) > BigInt(maximum)) {
    throw new Error(`webhook response exceeds ${maximum} bytes`);
  }
  if (response.body === null) return;
  const reader = response.body.getReader();
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return;
      received += chunk.value.byteLength;
      if (received > maximum) {
        await reader.cancel();
        throw new Error(`webhook response exceeds ${maximum} bytes`);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class SearchAttentionOutbox {
  readonly #store: SearchAttentionStore | undefined;
  readonly #now: () => number;
  readonly #fetch: SearchAttentionFetchLike;
  readonly #webhookUrl: string | null;
  readonly #digestWindowMs: number;
  readonly #retentionLimit: number;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxDeliveriesPerTick: number;
  readonly #activationMs: number;
  readonly #messages: SearchAttentionMessageRecord[];
  readonly #deliveries: SearchAttentionDeliveryRecord[];
  #active: Promise<boolean> | null = null;

  public constructor(options: SearchAttentionOutboxOptions = {}) {
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#webhookUrl = validateWebhookUrl(options.webhookUrl);
    this.#digestWindowMs = options.digestWindowMs ?? DEFAULT_DIGEST_WINDOW_MS;
    this.#retentionLimit = options.retentionLimit ?? DEFAULT_RETENTION_LIMIT;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.#maxDeliveriesPerTick = options.maxDeliveriesPerTick ?? DEFAULT_MAX_DELIVERIES_PER_TICK;
    this.#activationMs = this.#now();
    if (
      !Number.isSafeInteger(this.#digestWindowMs) || this.#digestWindowMs < 300_000 ||
      this.#digestWindowMs > 86_400_000 || 86_400_000 % this.#digestWindowMs !== 0 ||
      !Number.isSafeInteger(this.#retentionLimit) || this.#retentionLimit < 10 || this.#retentionLimit > 1_000 ||
      !Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 || this.#timeoutMs > 30_000 ||
      !Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1_024 ||
      this.#maxResponseBytes > 1_000_000 ||
      !Number.isSafeInteger(this.#maxDeliveriesPerTick) || this.#maxDeliveriesPerTick < 1 ||
      this.#maxDeliveriesPerTick > 16
    ) throw new Error("search attention outbox configuration is invalid or unbounded");
    this.#messages = [...(this.#store?.loadSearchAttentionMessages(this.#retentionLimit) ?? [])]
      .map(assertSearchAttentionMessage);
    this.#deliveries = [...(this.#store?.loadSearchAttentionDeliveries(this.#retentionLimit * 2) ?? [])]
      .map(assertSearchAttentionDelivery);
    for (const message of this.#messages) this.#ensureInApp(message);
    this.#sort();
  }

  public tick(
    issues: readonly SearchIssueRecord[],
    leaseRecords: readonly SearchLeaseRecord[],
  ): Promise<boolean> {
    if (this.#active !== null) return this.#active;
    this.#active = this.#run(issues, terminalRecords(leaseRecords)).finally(() => {
      this.#active = null;
    });
    return this.#active;
  }

  async #run(
    issues: readonly SearchIssueRecord[],
    records: readonly SearchLeaseRecord[],
  ): Promise<boolean> {
    const before = hashCanonical({
      messages: this.#messages.map((message) => message.artifactHash),
      deliveries: this.#deliveries.map((delivery) => delivery.artifactHash),
    });
    const knownIssues = new Set(issues.map((issue) => issue.issueId));
    const bounded = records.filter((record) => knownIssues.has(record.lease.issueId!));
    this.#materializeDigests(bounded);
    this.#materializeImmediate(bounded);
    if (this.#webhookUrl !== null) this.#enqueueWebhookDeliveries();
    await this.#drainWebhook();
    return before !== hashCanonical({
      messages: this.#messages.map((message) => message.artifactHash),
      deliveries: this.#deliveries.map((delivery) => delivery.artifactHash),
    });
  }

  #materializeDigests(records: readonly SearchLeaseRecord[]): void {
    const now = this.#now();
    const windows = new Map<number, SearchLeaseRecord[]>();
    for (const record of records) {
      const completed = Date.parse(record.completedAt!);
      const start = Math.floor(completed / this.#digestWindowMs) * this.#digestWindowMs;
      if (start + this.#digestWindowMs + DIGEST_CLOSE_GRACE_MS > now) continue;
      const values = windows.get(start) ?? [];
      values.push(record);
      windows.set(start, values);
    }
    for (const [start, values] of windows) {
      const windowStart = new Date(start).toISOString();
      const windowEnd = new Date(start + this.#digestWindowMs).toISOString();
      if (this.#messages.some((message) =>
        message.kind === "HOURLY_DIGEST" &&
        message.windowStart === windowStart && message.windowEnd === windowEnd
      )) continue;
      const sorted = [...values].sort((left, right) =>
        left.lease.leaseId.localeCompare(right.lease.leaseId)
      );
      const sourceLeaseIds = Object.freeze(sorted.map((record) => record.lease.leaseId));
      const metrics = aggregateMetrics(sorted);
      const dedupeIdentity = hashCanonical({
        schemaVersion: "pmh.search-attention-digest-dedupe.v1",
        windowStart,
        windowEnd,
      });
      const severity: SearchAttentionSeverity = sorted.some((record) =>
        isGroundedNovelCandidate(record) && record.outcome.proposalCount > 0 &&
        record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT"
      )
        ? "ACTION"
        : metrics.novelCandidateCount > 0 || metrics.proposalCount > 0 ||
            metrics.piEscalationCount > 0 || metrics.failedCount > 0
          ? "WATCH" : "ROUTINE";
      this.#saveMessage(createMessage({
        dedupeIdentity,
        kind: "HOURLY_DIGEST",
        severity,
        occurredAt: windowEnd,
        windowStart,
        windowEnd,
        issueIds: Object.freeze(metrics.byIssue.map((item) => item.issueId)),
        sourceLeaseIds,
        metrics,
        title: "Scheduled search hourly digest",
        summary: `${metrics.scanCount} scans · ${metrics.novelCandidateCount} novel · ${metrics.proposalCount} proposals · ${metrics.piEscalationCount} pi · ${metrics.economicBlockedCount} economic blocks · ${metrics.failedCount} failures.`,
      }));
    }
  }

  #materializeImmediate(records: readonly SearchLeaseRecord[]): void {
    for (const record of records) {
      if (
        isGroundedNovelCandidate(record) && record.outcome.proposalCount > 0 &&
        record.fastLane.economicGate?.status === "POSITIVE_GROSS_HINT"
      ) {
        const occurredAt = record.completedAt!;
        const issueId = record.lease.issueId!;
        const metrics = aggregateMetrics([record]);
        this.#saveMessage(createMessage({
          dedupeIdentity: hashCanonical({
            schemaVersion: "pmh.search-attention-action-dedupe.v1",
            leaseId: record.lease.leaseId,
          }),
          kind: "ACTION_CANDIDATE",
          severity: "ACTION",
          occurredAt,
          windowStart: record.lease.issuedAt,
          windowEnd: occurredAt,
          issueIds: Object.freeze([issueId]),
          sourceLeaseIds: Object.freeze([record.lease.leaseId]),
          metrics,
          title: "Positive grounded search candidate",
          summary: `${record.outcome.proposalCount} grounded proposal${record.outcome.proposalCount === 1 ? "" : "s"} passed the deterministic positive gross search gate; semantic review, fees, depth, and execution remain unproven.`,
        }));
      }
    }
    const issueIds = [...new Set(records.map((record) => record.lease.issueId!))].sort();
    for (const issueId of issueIds) {
      let streak: SearchLeaseRecord[] = [];
      for (const record of records.filter((item) => item.lease.issueId === issueId)) {
        if (record.status === "PASS") {
          streak = [];
          continue;
        }
        streak.push(record);
        if (streak.length !== 3) continue;
        const occurredAt = record.completedAt!;
        const metrics = aggregateMetrics(streak);
        this.#saveMessage(createMessage({
          dedupeIdentity: hashCanonical({
            schemaVersion: "pmh.search-attention-degraded-dedupe.v1",
            issueId,
            thirdLeaseId: record.lease.leaseId,
          }),
          kind: "ISSUE_DEGRADED",
          severity: "DEGRADED",
          occurredAt,
          windowStart: streak[0]!.lease.issuedAt,
          windowEnd: occurredAt,
          issueIds: Object.freeze([issueId]),
          sourceLeaseIds: Object.freeze(streak.map((item) => item.lease.leaseId)),
          metrics,
          title: "Scheduled search issue degraded",
          summary: "The same issue failed three consecutive retained leases; search continues on later ticks, but operator attention is warranted.",
        }));
      }
    }
  }

  #saveMessage(message: SearchAttentionMessageRecord): SearchAttentionMessageRecord {
    const existing = this.#messages.find((item) => item.messageId === message.messageId);
    if (existing !== undefined) {
      if (existing.artifactHash !== message.artifactHash) {
        throw new Error("search attention message identity is already bound");
      }
      return existing;
    }
    const stored = this.#store?.saveSearchAttentionMessage(message, this.#retentionLimit) ?? message;
    this.#messages.push(assertSearchAttentionMessage(stored));
    this.#ensureInApp(stored);
    this.#sort();
    return stored;
  }

  #ensureInApp(message: SearchAttentionMessageRecord): void {
    const deliveryId = this.#deliveryId(message.messageId, "IN_APP");
    if (this.#deliveries.some((item) => item.deliveryId === deliveryId)) return;
    this.#saveDelivery(withDeliveryHash({
      schemaVersion: "pmh.search-attention-delivery.v1",
      deliveryId,
      messageId: message.messageId,
      channel: "IN_APP",
      status: "DELIVERED",
      attemptCount: 0,
      nextAttemptAt: message.occurredAt,
      lastAttemptAt: null,
      deliveredAt: message.occurredAt,
      acknowledgedAt: null,
      lastHttpStatus: null,
      diagnostic: null,
      createdAt: message.occurredAt,
      updatedAt: message.occurredAt,
      destinationStored: false,
      valueMovingOperation: false,
      executionAuthority: false,
    }));
  }

  #enqueueWebhookDeliveries(): void {
    for (const message of this.#messages) {
      if (Date.parse(message.occurredAt) <= this.#activationMs) continue;
      const deliveryId = this.#deliveryId(message.messageId, "WEBHOOK_JSON");
      if (this.#deliveries.some((item) => item.deliveryId === deliveryId)) continue;
      this.#saveDelivery(withDeliveryHash({
        schemaVersion: "pmh.search-attention-delivery.v1",
        deliveryId,
        messageId: message.messageId,
        channel: "WEBHOOK_JSON",
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: message.occurredAt,
        lastAttemptAt: null,
        deliveredAt: null,
        acknowledgedAt: null,
        lastHttpStatus: null,
        diagnostic: null,
        createdAt: message.occurredAt,
        updatedAt: message.occurredAt,
        destinationStored: false,
        valueMovingOperation: false,
        executionAuthority: false,
      }));
    }
  }

  async #drainWebhook(): Promise<void> {
    if (this.#webhookUrl === null) return;
    const due = this.#deliveries.filter((delivery) =>
      delivery.channel === "WEBHOOK_JSON" &&
      ["PENDING", "RETRY_WAIT"].includes(delivery.status) &&
      Date.parse(delivery.nextAttemptAt) <= this.#now()
    ).sort((left, right) =>
      left.nextAttemptAt.localeCompare(right.nextAttemptAt) ||
      left.deliveryId.localeCompare(right.deliveryId)
    ).slice(0, this.#maxDeliveriesPerTick);
    for (const delivery of due) await this.#deliver(delivery);
  }

  async #deliver(delivery: SearchAttentionDeliveryRecord): Promise<void> {
    const message = this.#messages.find((item) => item.messageId === delivery.messageId);
    if (message === undefined) throw new Error("search attention delivery message is missing");
    const attemptedAt = new Date(this.#now()).toISOString();
    const attemptCount = delivery.attemptCount + 1;
    let httpStatus: number | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
      let response: Response;
      try {
        response = await this.#fetch(this.#webhookUrl!, {
          method: "POST",
          credentials: "omit",
          redirect: "error",
          headers: Object.freeze({
            accept: "application/json",
            "content-type": "application/json",
            "idempotency-key": delivery.deliveryId,
          }),
          body: canonicalJson(Object.freeze({
            schemaVersion: "pmh.search-attention-webhook.v1",
            deliveryId: delivery.deliveryId,
            message,
            sentAt: attemptedAt,
          })),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      httpStatus = response.status;
      await readBounded(response, this.#maxResponseBytes);
      if (response.status < 200 || response.status > 299) {
        throw new Error(`webhook returned HTTP ${response.status}`);
      }
      this.#saveDelivery(withDeliveryHash({
        ...deliveryHashBody(delivery),
        status: "DELIVERED",
        attemptCount,
        nextAttemptAt: attemptedAt,
        lastAttemptAt: attemptedAt,
        deliveredAt: attemptedAt,
        lastHttpStatus: httpStatus,
        diagnostic: null,
        updatedAt: attemptedAt,
      }));
    } catch (error) {
      const dead = attemptCount >= 3;
      this.#saveDelivery(withDeliveryHash({
        ...deliveryHashBody(delivery),
        status: dead ? "DEAD_LETTER" : "RETRY_WAIT",
        attemptCount,
        nextAttemptAt: new Date(
          this.#now() + (RETRY_DELAYS_MS[attemptCount - 1] ?? 0),
        ).toISOString(),
        lastAttemptAt: attemptedAt,
        lastHttpStatus: httpStatus,
        diagnostic: compactDiagnostic(error),
        updatedAt: attemptedAt,
      }));
    }
  }

  public acknowledgeInApp(deliveryId: Hash): SearchAttentionDeliveryRecord {
    const delivery = this.#deliveries.find((item) => item.deliveryId === deliveryId);
    if (delivery === undefined || delivery.channel !== "IN_APP") {
      throw new Error("in-app attention delivery was not found");
    }
    if (delivery.status === "ACKNOWLEDGED") return delivery;
    if (delivery.status !== "DELIVERED") throw new Error("in-app attention delivery is not delivered");
    const acknowledgedAt = new Date(this.#now()).toISOString();
    return this.#saveDelivery(withDeliveryHash({
      ...deliveryHashBody(delivery),
      status: "ACKNOWLEDGED",
      acknowledgedAt,
      updatedAt: acknowledgedAt,
    }));
  }

  #deliveryId(messageId: Hash, channel: SearchAttentionDeliveryRecord["channel"]): Hash {
    return hashCanonical({
      schemaVersion: "pmh.search-attention-delivery-id.v1",
      messageId,
      channel,
    });
  }

  #saveDelivery(delivery: SearchAttentionDeliveryRecord): SearchAttentionDeliveryRecord {
    const valid = assertSearchAttentionDelivery(delivery);
    const stored = this.#store?.saveSearchAttentionDelivery(
      valid,
      this.#retentionLimit * 2,
    ) ?? valid;
    const index = this.#deliveries.findIndex((item) => item.deliveryId === stored.deliveryId);
    if (index >= 0) this.#deliveries.splice(index, 1);
    this.#deliveries.push(assertSearchAttentionDelivery(stored));
    this.#sort();
    return stored;
  }

  #sort(): void {
    this.#messages.sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) || right.messageId.localeCompare(left.messageId)
    );
    this.#messages.splice(this.#retentionLimit);
    this.#deliveries.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.deliveryId.localeCompare(left.deliveryId)
    );
    this.#deliveries.splice(this.#retentionLimit * 2);
  }

  public projection(): SearchAttentionProjection {
    const digestByWindow = new Map<string, SearchAttentionMessageRecord>();
    const immediate: SearchAttentionMessageRecord[] = [];
    for (const message of this.#messages) {
      if (message.kind !== "HOURLY_DIGEST") {
        immediate.push(message);
        continue;
      }
      const key = `${message.windowStart}:${message.windowEnd}`;
      const existing = digestByWindow.get(key);
      if (existing === undefined ||
        message.metrics.scanCount > existing.metrics.scanCount ||
        message.metrics.scanCount === existing.metrics.scanCount &&
          message.messageId.localeCompare(existing.messageId) > 0) {
        digestByWindow.set(key, message);
      }
    }
    const messages = Object.freeze([...immediate, ...digestByWindow.values()].sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) || right.messageId.localeCompare(left.messageId)
    ));
    const visibleIds = new Set(messages.map((message) => message.messageId));
    const deliveries = Object.freeze(this.#deliveries.filter((delivery) =>
      visibleIds.has(delivery.messageId)
    ));
    return Object.freeze({
      schemaVersion: "pmh.search-attention-outbox.v1",
      status: this.#active === null ? "IDLE" : "DELIVERING",
      digestWindowMs: this.#digestWindowMs,
      activationAt: new Date(this.#activationMs).toISOString(),
      retentionLimit: this.#retentionLimit,
      messageCount: messages.length,
      digestCount: messages.filter((item) => item.kind === "HOURLY_DIGEST").length,
      immediateCount: messages.filter((item) => item.kind !== "HOURLY_DIGEST").length,
      unreadInAppCount: deliveries.filter((item) =>
        item.channel === "IN_APP" && item.status === "DELIVERED"
      ).length,
      pendingDeliveryCount: deliveries.filter((item) => item.status === "PENDING").length,
      retryWaitCount: deliveries.filter((item) => item.status === "RETRY_WAIT").length,
      deliveredWebhookCount: deliveries.filter((item) =>
        item.channel === "WEBHOOK_JSON" && item.status === "DELIVERED"
      ).length,
      deadLetterCount: deliveries.filter((item) => item.status === "DEAD_LETTER").length,
      channels: Object.freeze({
        inApp: Object.freeze({ configured: true as const }),
        webhookJson: Object.freeze({
          configured: this.#webhookUrl !== null,
          destinationStored: false as const,
          destinationProjected: false as const,
          cutoverPolicy: "PROCESS_ACTIVATION_NO_HISTORY_REPLAY" as const,
        }),
      }),
      messages,
      deliveries,
      storage: Object.freeze({
        messages: this.#store?.searchAttentionMessageStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "messageId" as const,
        }),
        deliveries: this.#store?.searchAttentionDeliveryStorage ?? Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "deliveryId" as const,
        }),
      }),
      authority: "ATTENTION_ROUTING_ONLY",
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: this.#webhookUrl !== null,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}

export function parseSearchAttentionWebhook(
  environment: Readonly<Record<string, string | undefined>>,
): string | null {
  return validateWebhookUrl(environment.PMH_SEARCH_ATTENTION_WEBHOOK_URL);
}
