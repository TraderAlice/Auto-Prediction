import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AiUsageLedger,
  assertAiUsageEvent,
  type AiUsageEvent,
  type AiUsageEventStore,
} from "../src/ai-usage-ledger.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

class MemoryStore implements AiUsageEventStore {
  readonly #events = new Map<string, AiUsageEvent>();
  public readonly aiUsageStorage = Object.freeze({
    mode: "MEMORY" as const,
    durable: false,
    schemaVersion: 61,
    idempotencyKey: "eventId" as const,
  });
  loadAiUsageEvents() { return [...this.#events.values()]; }
  saveAiUsageEvent(event: AiUsageEvent) { this.#events.set(event.eventId, event); }
}

describe("AI usage ledger", () => {
  it("separates token structure and aggregates purpose, role, model, outcome, and time", () => {
    const ledger = new AiUsageLedger();
    ledger.record({
      occurredAt: "2026-08-02T10:15:00.000Z",
      durationMs: 1_400,
      purpose: "DISCOVERY_FAST",
      role: "SKEPTIC",
      provider: "DEEPSEEK",
      model: "deepseek-v4-flash",
      transport: "VERCEL_AI_SDK",
      operationIdentity: "search-issue:alpha",
      outcome: "SUCCEEDED",
      durableEffect: true,
      providerRequestCount: 3,
      usage: {
        inputTokens: 120,
        outputTokens: 40,
        totalTokens: 160,
        inputTokenDetails: { cacheReadTokens: 80, cacheWriteTokens: 5 },
        outputTokenDetails: { reasoningTokens: 12 },
      },
    });
    ledger.record({
      occurredAt: "2026-08-02T11:05:00.000Z",
      durationMs: 200,
      purpose: "DISCOVERY_FAST",
      role: "SKEPTIC",
      provider: "DEEPSEEK",
      model: "deepseek-v4-flash",
      transport: "VERCEL_AI_SDK",
      operationIdentity: "search-issue:beta",
      outcome: "FAILED",
      durableEffect: false,
      providerRequestCount: 1,
    });

    const projection = ledger.projection();
    expect(projection.eventCount).toBe(2);
    expect(projection.coverage).toEqual({ complete: 1, partial: 0, unavailable: 1 });
    expect(projection.totals.tokens).toMatchObject({
      inputTokens: "120",
      outputTokens: "40",
      reasoningTokens: "12",
      cacheReadTokens: "80",
      cacheWriteTokens: "5",
      totalTokens: "160",
    });
    expect(projection.byPurpose[0]).toMatchObject({
      key: "DISCOVERY_FAST",
      invocationCount: "2",
      durableEffectCount: "1",
    });
    expect(projection.hourly).toHaveLength(2);
    expect(projection.daily).toHaveLength(1);
    expect(projection.promptTextRetained).toBe(false);
    expect(projection.outputTextRetained).toBe(false);
    expect(Object.keys(projection.recentEvents[0]!)).not.toContain("prompt");
    expect(Object.keys(projection.recentEvents[0]!)).not.toContain("output");
  });

  it("marks Pi invocations partial without inventing token counts", () => {
    const ledger = new AiUsageLedger();
    const event = ledger.record({
      occurredAt: "2026-08-02T10:15:00.000Z",
      durationMs: 9_000,
      purpose: "PI_INVESTIGATION",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      transport: "PI_CLI",
      operationIdentity: "task:pi-one",
      outcome: "SUCCEEDED",
      durableEffect: true,
      providerRequestCount: null,
    });
    expect(event.coverage).toBe("PARTIAL");
    expect(event.tokens).toEqual({
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: null,
    });
  });

  it("restores exact events without double counting and rejects tampering", () => {
    const store = new MemoryStore();
    const first = new AiUsageLedger(20, store);
    const event = first.record({
      occurredAt: "2026-08-02T10:15:00.000Z",
      durationMs: 50,
      purpose: "SEMANTIC_REVIEW",
      provider: "DEEPSEEK",
      model: "deepseek-v4-flash",
      transport: "VERCEL_AI_SDK",
      operationIdentity: "proposal:one",
      outcome: "SUCCEEDED",
      durableEffect: true,
      usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
    });
    expect(new AiUsageLedger(20, store).projection().totals.tokens.totalTokens).toBe("12");
    expect(() => assertAiUsageEvent({
      ...event,
      tokens: { ...event.tokens, totalTokens: "999" },
    })).toThrow("hash mismatch");
  });

  it("replays a durable SQLite ledger exactly after restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-ai-usage-"));
    const path = join(directory, "operations.sqlite");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const first = new AiUsageLedger(20, firstStore);
      first.record({
        occurredAt: "2026-08-02T12:00:00.000Z",
        durationMs: 1_000,
        purpose: "PREMISE_EVIDENCE_ROUTING",
        role: "PREMISE_EVIDENCE_ROUTER",
        provider: "DEEPSEEK",
        model: "deepseek-v4-flash",
        transport: "VERCEL_AI_SDK",
        operationIdentity: "constraint:durable",
        outcome: "SUCCEEDED",
        durableEffect: true,
        providerRequestCount: 2,
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
      });
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const restored = new AiUsageLedger(20, secondStore).projection();
      expect(restored.eventCount).toBe(1);
      expect(restored.totals.tokens.totalTokens).toBe("60");
      expect(restored.byPurpose[0]?.key).toBe("PREMISE_EVIDENCE_ROUTING");
      expect(restored.storage).toMatchObject({
        mode: "SQLITE_WAL",
        durable: true,
        schemaVersion: 61,
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
