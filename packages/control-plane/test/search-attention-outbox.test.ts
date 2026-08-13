import { hashCanonical, type Hash } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import {
  SearchAttentionOutbox,
  SqliteOperationalStore,
  type SearchIssueRecord,
  type SearchLeaseRecord,
} from "../src/index.js";

function issue(key: string): SearchIssueRecord {
  const issueId = hashCanonical({ issue: key });
  return { issueId } as SearchIssueRecord;
}

function lease(input: {
  key: string;
  issueId: Hash;
  completedAt: string;
  status?: "PASS" | "FAILED";
  novel?: boolean;
  proposals?: number;
  pi?: boolean;
  gate?: "POSITIVE_GROSS_HINT" | "NON_POSITIVE_GROSS_HINT" | "PRICE_UNAVAILABLE";
  quoteReady?: boolean;
  candidateListingRefs?: readonly string[];
  deepReason?: SearchLeaseRecord["deepLane"]["reason"];
  deepStatus?: SearchLeaseRecord["deepLane"]["status"];
  deepDiagnostic?: string;
  degradedOmissions?: number;
}): SearchLeaseRecord {
  const status = input.status ?? "PASS";
  return {
    status,
    completedAt: input.completedAt,
    lease: {
      issueId: input.issueId,
      leaseId: hashCanonical({ lease: input.key }),
      issuedAt: new Date(Date.parse(input.completedAt) - 60_000).toISOString(),
    },
    outcome: {
      novelCandidate: input.novel ?? false,
      proposalCount: input.proposals ?? 0,
      hypothesisCount: input.novel ? 1 : 0,
      evidenceGapCount: 0,
    },
    deepLane: {
      status: input.deepStatus ?? "NOT_RUN",
      runId: input.pi ? hashCanonical({ pi: input.key }) : null,
      reason: input.deepReason ??
        (input.gate === "NON_POSITIVE_GROSS_HINT"
          ? "ECONOMIC_GATE_BLOCKED"
          : input.novel
            ? "NOVEL_MULTI_LISTING"
            : "NO_CANDIDATES"),
      diagnostic: input.deepDiagnostic ?? null,
      completedAt: input.deepStatus === "FAILED" ? input.completedAt : null,
      attempts: input.deepStatus === "FAILED" ? [{
        attemptId: hashCanonical({ attempt: input.key }),
      }] : [],
    },
    fastLane: {
      status: status === "PASS" ? "PASS" : "FAILED",
      completedAt: input.completedAt,
      candidateListingRefs: input.candidateListingRefs ??
        (input.novel ? ["venue-a:candidate", "venue-b:candidate"] : []),
      economicGate: input.gate === undefined ? null : {
        status: input.gate,
        quoteEnrichment: input.quoteReady ? { status: "READY" } : undefined,
      },
      corpusCoverage: input.degradedOmissions === undefined
        ? undefined
        : {
            status: "DEGRADED",
            omittedSources: Array.from(
              { length: input.degradedOmissions },
              (_, index) => ({ venueId: `venue-omitted-${index}` }),
            ),
          },
    },
  } as unknown as SearchLeaseRecord;
}

describe("search attention outbox", () => {
  it("routes a deep failure separately while preserving the successful fast scan", async () => {
    const focused = issue("deep-unavailable");
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T01:05:00.000Z"),
    });
    const record = lease({
      key: "deep-unavailable",
      issueId: focused.issueId,
      completedAt: "2026-08-02T01:01:00.000Z",
      status: "PASS",
      novel: true,
      deepStatus: "FAILED",
      deepDiagnostic: "market archaeologist timed out",
    });

    await outbox.tick([focused], [record]);

    expect(outbox.projection().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "DEEP_UNAVAILABLE",
        severity: "WATCH",
        title: "Fast search preserved; deep investigation unavailable",
        summary: expect.stringContaining("market archaeologist timed out"),
      }),
    ]));
    expect(outbox.projection().messages.some(
      (message) => message.kind === "ISSUE_DEGRADED",
    )).toBe(false);
  });

  it("persists and restores a deep-unavailable alert through SQLite", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-deep-attention-"));
    const path = join(directory, "control-plane.sqlite");
    const focused = issue("deep-unavailable-sqlite");
    const now = () => Date.parse("2026-08-02T01:05:00.000Z");
    const record = lease({
      key: "deep-unavailable-sqlite",
      issueId: focused.issueId,
      completedAt: "2026-08-02T01:01:00.000Z",
      status: "PASS",
      novel: true,
      deepStatus: "FAILED",
      deepDiagnostic: "pi attempt timed out",
    });

    try {
      const firstStore = new SqliteOperationalStore(path);
      const first = new SearchAttentionOutbox({ store: firstStore, now });
      await first.tick([focused], [record]);
      expect(first.projection().messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "DEEP_UNAVAILABLE",
          severity: "WATCH",
        }),
      ]));
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const second = new SearchAttentionOutbox({ store: secondStore, now });
      expect(second.projection()).toMatchObject({
        messageCount: 1,
        immediateCount: 1,
      });
      expect(second.projection().messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "DEEP_UNAVAILABLE" }),
      ]));
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps a legacy single-listing novelty record but excludes it from digest yield", async () => {
    const legacy = issue("legacy-single-ref");
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T01:05:00.000Z"),
    });
    const record = lease({
      key: "legacy-single-ref",
      issueId: legacy.issueId,
      completedAt: "2026-08-02T00:10:00.000Z",
      novel: true,
      candidateListingRefs: ["venue-a:single"],
      deepReason: "NOT_MULTI_LISTING",
    });

    await outbox.tick([legacy], [record]);

    expect(record.outcome.novelCandidate).toBe(true);
    expect(outbox.projection().messages[0]).toMatchObject({
      kind: "HOURLY_DIGEST",
      severity: "ROUTINE",
      metrics: {
        scanCount: 1,
        novelCandidateCount: 0,
        proposalCount: 0,
      },
    });
  });

  it("materializes one idempotent closed-window digest across concurrent issues", async () => {
    const alpha = issue("alpha");
    const beta = issue("beta");
    const records = [
      lease({
        key: "alpha-1",
        issueId: alpha.issueId,
        completedAt: "2026-08-02T00:10:00.000Z",
        novel: true,
        proposals: 2,
        pi: true,
      }),
      lease({
        key: "beta-1",
        issueId: beta.issueId,
        completedAt: "2026-08-02T00:20:00.000Z",
        gate: "NON_POSITIVE_GROSS_HINT",
        quoteReady: true,
        degradedOmissions: 1,
      }),
    ];
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T01:05:00.000Z"),
    });

    await expect(outbox.tick([alpha, beta], records)).resolves.toBe(true);
    await expect(outbox.tick([alpha, beta], [...records].reverse())).resolves.toBe(false);
    await expect(outbox.tick([alpha, beta], [
      ...records,
      lease({
        key: "late-alpha",
        issueId: alpha.issueId,
        completedAt: "2026-08-02T00:59:30.000Z",
        novel: true,
        proposals: 1,
      }),
    ])).resolves.toBe(false);

    const projection = outbox.projection();
    expect(projection).toMatchObject({
      messageCount: 1,
      digestCount: 1,
      immediateCount: 0,
      unreadInAppCount: 1,
      channels: { webhookJson: { configured: false } },
      effects: { externalWrites: false, valueMovingActions: false },
    });
    expect(projection.messages[0]).toMatchObject({
      kind: "HOURLY_DIGEST",
      severity: "WATCH",
      windowStart: "2026-08-02T00:00:00.000Z",
      windowEnd: "2026-08-02T01:00:00.000Z",
      metrics: {
        scanCount: 2,
        novelCandidateCount: 1,
        proposalCount: 2,
        piEscalationCount: 1,
        economicBlockedCount: 1,
        quoteRescuedCount: 1,
        degradedContextCount: 1,
        omittedVenueCount: 1,
      },
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.messages[0]!.metrics.byIssue.map((item) => item.issueId).sort())
      .toEqual([alpha.issueId, beta.issueId].sort());
  });

  it("sends only a post-activation positive grounded candidate immediately", async () => {
    let nowMs = Date.parse("2026-08-02T01:00:00.000Z");
    const focused = issue("focused");
    const fetcher = vi.fn(async () => new Response("ok", { status: 200 }));
    const outbox = new SearchAttentionOutbox({
      now: () => nowMs,
      webhookUrl: "https://notify.example.test/search",
      fetch: fetcher,
    });
    const historical = lease({
      key: "historical-action",
      issueId: focused.issueId,
      completedAt: "2026-08-02T00:30:00.000Z",
      novel: true,
      proposals: 1,
      gate: "POSITIVE_GROSS_HINT",
    });
    nowMs = Date.parse("2026-08-02T01:02:00.000Z");
    const current = lease({
      key: "current-action",
      issueId: focused.issueId,
      completedAt: "2026-08-02T01:01:00.000Z",
      novel: true,
      proposals: 2,
      gate: "POSITIVE_GROSS_HINT",
    });

    await outbox.tick([focused], [historical, current]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://notify.example.test/search");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      headers: expect.objectContaining({
        "content-type": "application/json",
        "idempotency-key": expect.stringMatching(/^sha256:/u),
      }),
    });
    expect(JSON.parse(init.body)).toMatchObject({
      schemaVersion: "pmh.search-attention-webhook.v1",
      message: {
        kind: "ACTION_CANDIDATE",
        severity: "ACTION",
        sourceLeaseIds: [current.lease.leaseId],
        semanticDecisionAuthority: false,
        executionAuthority: false,
      },
    });
    expect(outbox.projection()).toMatchObject({
      immediateCount: 2,
      deliveredWebhookCount: 1,
      pendingDeliveryCount: 0,
      channels: {
        webhookJson: {
          configured: true,
          destinationStored: false,
          destinationProjected: false,
          cutoverPolicy: "PROCESS_ACTIVATION_NO_HISTORY_REPLAY",
        },
      },
    });
    expect(JSON.stringify(outbox.projection())).not.toContain("notify.example.test");
  });

  it("does not compose ACTION severity from unrelated proposal and price records", async () => {
    const semantic = issue("semantic-only");
    const priced = issue("priced-only");
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T01:05:00.000Z"),
    });
    await outbox.tick([semantic, priced], [
      lease({
        key: "semantic-only",
        issueId: semantic.issueId,
        completedAt: "2026-08-02T00:10:00.000Z",
        novel: true,
        proposals: 1,
      }),
      lease({
        key: "priced-only",
        issueId: priced.issueId,
        completedAt: "2026-08-02T00:20:00.000Z",
        gate: "POSITIVE_GROSS_HINT",
      }),
    ]);

    expect(outbox.projection()).toMatchObject({ immediateCount: 0 });
    expect(outbox.projection().messages[0]).toMatchObject({
      kind: "HOURLY_DIGEST",
      severity: "WATCH",
    });
  });

  it("keeps a digest bounded when more than eight issues share a window", async () => {
    const issues = Array.from({ length: 9 }, (_, index) => issue(`many-${index}`));
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T01:05:00.000Z"),
    });
    await expect(outbox.tick(issues, issues.map((item, index) => lease({
      key: `many-${index}`,
      issueId: item.issueId,
      completedAt: `2026-08-02T00:${String(index + 1).padStart(2, "0")}:00.000Z`,
    })))).resolves.toBe(true);

    expect(outbox.projection().messages[0]!.metrics.byIssue).toHaveLength(9);
  });

  it("emits one degraded alert on the third consecutive failure and resets after a pass", async () => {
    const scheduled = issue("degraded");
    const records = [1, 2, 3, 4].map((value) => lease({
      key: `failed-${value}`,
      issueId: scheduled.issueId,
      completedAt: `2026-08-02T01:0${value}:00.000Z`,
      status: "FAILED",
    }));
    records.push(lease({
      key: "recovered",
      issueId: scheduled.issueId,
      completedAt: "2026-08-02T01:05:00.000Z",
    }));
    records.push(...[5, 6, 7].map((value, index) => lease({
      key: `failed-${value}`,
      issueId: scheduled.issueId,
      completedAt: `2026-08-02T01:0${index + 6}:00.000Z`,
      status: "FAILED",
    })));
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T01:20:00.000Z"),
    });

    await outbox.tick([scheduled], records);
    await outbox.tick([scheduled], records);

    const degraded = outbox.projection().messages.filter((message) =>
      message.kind === "ISSUE_DEGRADED"
    );
    expect(degraded).toHaveLength(2);
    expect(degraded.map((message) => message.sourceLeaseIds.length)).toEqual([3, 3]);
    expect(outbox.projection().unreadInAppCount).toBe(2);
  });

  it("retries webhook failures twice and then retains a dead letter", async () => {
    let nowMs = Date.parse("2026-08-02T01:00:00.000Z");
    const focused = issue("retry");
    const fetcher = vi.fn(async () => new Response("no", { status: 503 }));
    const outbox = new SearchAttentionOutbox({
      now: () => nowMs,
      webhookUrl: "https://notify.example.test/search",
      fetch: fetcher,
    });
    const record = lease({
      key: "retry-action",
      issueId: focused.issueId,
      completedAt: "2026-08-02T01:01:00.000Z",
      novel: true,
      proposals: 1,
      gate: "POSITIVE_GROSS_HINT",
    });
    nowMs = Date.parse("2026-08-02T01:02:00.000Z");
    await outbox.tick([focused], [record]);
    expect(outbox.projection()).toMatchObject({ retryWaitCount: 1, deadLetterCount: 0 });
    nowMs += 60_000;
    await outbox.tick([focused], [record]);
    expect(outbox.projection()).toMatchObject({ retryWaitCount: 1, deadLetterCount: 0 });
    nowMs += 300_000;
    await outbox.tick([focused], [record]);
    expect(outbox.projection()).toMatchObject({ retryWaitCount: 0, deadLetterCount: 1 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("stops reading an oversized webhook response and retains a retry", async () => {
    let nowMs = Date.parse("2026-08-02T01:00:00.000Z");
    const focused = issue("oversized-response");
    const outbox = new SearchAttentionOutbox({
      now: () => nowMs,
      webhookUrl: "https://notify.example.test/search",
      maxResponseBytes: 1_024,
      fetch: async () => new Response(new Uint8Array(1_025), { status: 200 }),
    });
    nowMs = Date.parse("2026-08-02T01:02:00.000Z");
    await outbox.tick([focused], [lease({
      key: "oversized-response",
      issueId: focused.issueId,
      completedAt: "2026-08-02T01:01:00.000Z",
      novel: true,
      proposals: 1,
      gate: "POSITIVE_GROSS_HINT",
    })]);

    expect(outbox.projection()).toMatchObject({ retryWaitCount: 1 });
    expect(outbox.projection().deliveries.find((item) => item.channel === "WEBHOOK_JSON"))
      .toMatchObject({
        status: "RETRY_WAIT",
        lastHttpStatus: 200,
        diagnostic: "webhook response exceeds 1024 bytes",
      });
  });

  it("acknowledges only the in-app delivery without mutating the message", async () => {
    const alpha = issue("ack");
    const outbox = new SearchAttentionOutbox({
      now: () => Date.parse("2026-08-02T02:00:00.000Z"),
    });
    await outbox.tick([alpha], [lease({
      key: "ack-scan",
      issueId: alpha.issueId,
      completedAt: "2026-08-02T00:30:00.000Z",
    })]);
    const before = outbox.projection();
    const delivery = before.deliveries.find((item) => item.channel === "IN_APP")!;
    const messageHash = before.messages[0]!.artifactHash;

    outbox.acknowledgeInApp(delivery.deliveryId);

    expect(outbox.projection()).toMatchObject({ unreadInAppCount: 0 });
    expect(outbox.projection().messages[0]!.artifactHash).toBe(messageHash);
    expect(outbox.projection().deliveries.find((item) => item.deliveryId === delivery.deliveryId))
      .toMatchObject({ status: "ACKNOWLEDGED", acknowledgedAt: expect.any(String) });
  });

  it("restores hash-verified messages, deliveries, and acknowledgement after restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-attention-outbox-"));
    const path = join(directory, "control-plane.sqlite");
    const alpha = issue("restart");
    const now = () => Date.parse("2026-08-02T02:00:00.000Z");
    try {
      const firstStore = new SqliteOperationalStore(path);
      const first = new SearchAttentionOutbox({ store: firstStore, now });
      await first.tick([alpha], [lease({
        key: "restart-scan",
        issueId: alpha.issueId,
        completedAt: "2026-08-02T00:30:00.000Z",
      })]);
      const expected = first.projection();
      expect(expected.storage).toMatchObject({
        messages: { durable: true, schemaVersion: 60 },
        deliveries: { durable: true, schemaVersion: 60 },
      });
      firstStore.close();

      const legacy = new DatabaseSync(path);
      legacy.exec("PRAGMA user_version = 17");
      legacy.close();

      const secondStore = new SqliteOperationalStore(path);
      const second = new SearchAttentionOutbox({ store: secondStore, now });
      expect(second.projection()).toMatchObject({
        messageCount: 1,
        unreadInAppCount: 1,
      });
      await second.tick([alpha], [lease({
        key: "restart-scan",
        issueId: alpha.issueId,
        completedAt: "2026-08-02T00:30:00.000Z",
      })]);
      expect(second.projection()).toMatchObject({ messageCount: 1, unreadInAppCount: 1 });
      const delivery = second.projection().deliveries[0]!;
      second.acknowledgeInApp(delivery.deliveryId);
      secondStore.close();

      const thirdStore = new SqliteOperationalStore(path);
      const third = new SearchAttentionOutbox({ store: thirdStore, now });
      expect(third.projection()).toMatchObject({ messageCount: 1, unreadInAppCount: 0 });
      expect(third.projection().deliveries[0]).toMatchObject({ status: "ACKNOWLEDGED" });
      thirdStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps a legacy immediate message immutable when new derived metrics appear", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-attention-legacy-"));
    const path = join(directory, "control-plane.sqlite");
    const scheduled = issue("legacy-degraded");
    const records = [1, 2, 3].map((value) => lease({
      key: `legacy-failed-${value}`,
      issueId: scheduled.issueId,
      completedAt: `2026-08-02T01:0${value}:00.000Z`,
      status: "FAILED",
      degradedOmissions: 1,
    }));
    try {
      const materializer = new SearchAttentionOutbox({
        now: () => Date.parse("2026-08-02T01:20:00.000Z"),
      });
      await materializer.tick([scheduled], records);
      const current = materializer.projection().messages.find(
        (message) => message.kind === "ISSUE_DEGRADED",
      )!;
      const { artifactHash: _artifactHash, ...currentBody } = current;
      const byIssue = current.metrics.byIssue.map((item) => {
        const {
          degradedContextCount: _degradedContextCount,
          omittedVenueCount: _omittedVenueCount,
          ...legacy
        } = item;
        return Object.freeze(legacy);
      });
      const {
        degradedContextCount: _degradedContextCount,
        omittedVenueCount: _omittedVenueCount,
        ...legacyMetricCounts
      } = current.metrics;
      const legacyBody = Object.freeze({
        ...currentBody,
        metrics: Object.freeze({
          ...legacyMetricCounts,
          byIssue: Object.freeze(byIssue),
        }),
      });
      const legacy = Object.freeze({
        ...legacyBody,
        artifactHash: hashCanonical(legacyBody),
      });
      const store = new SqliteOperationalStore(path);
      store.saveSearchAttentionMessage(legacy, 100);
      const restored = new SearchAttentionOutbox({
        store,
        now: () => Date.parse("2026-08-02T01:20:00.000Z"),
      });

      await expect(restored.tick([scheduled], records)).resolves.toBe(false);
      expect(restored.projection().messages).toEqual([legacy]);
      store.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
