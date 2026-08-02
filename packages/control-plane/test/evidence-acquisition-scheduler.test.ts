import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceRequirements,
  EvidenceAcquisitionScheduler,
  EvidenceDocumentFetcher,
  SqliteOperationalStore,
  type DiscoveryCatalogListing,
  type EvidenceAcquisitionJobRecord,
  type EvidenceDocumentFetchLike,
  type EvidenceRequirement,
} from "../src/index.js";

const publicResolver = async () => Object.freeze([
  Object.freeze({ address: "8.8.8.8", family: 4 as const }),
]);

function clock(start = "2026-08-02T00:00:00.000Z") {
  let current = Date.parse(start);
  return Object.freeze({
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  });
}

function listing(listingRef: string, locatorUrl?: string): DiscoveryCatalogListing {
  const locator = locatorUrl === undefined ? null : buildDiscoveryEvidenceLocator({
    venueId: "test-venue",
    protocolIdentity: "test-protocol:v1",
    role: "CONTRACT_RULE_DOCUMENT",
    url: locatorUrl,
  });
  if (locatorUrl !== undefined && locator === null) throw new Error("test locator failed");
  return Object.freeze({
    listingRef,
    venueId: "test-venue",
    venueInstrumentId: listingRef,
    title: `Will ${listingRef} happen?`,
    description: "A bounded acquisition scheduler fixture.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    ...(locator === null ? {} : { evidenceLocators: Object.freeze([locator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.6" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: "test-protocol:v1",
  });
}

function requirement(
  label: string,
  options: Readonly<{
    url?: string;
    kind?: "RESOLUTION_RULE" | "QUOTE_DEPTH";
    temporalPosture?: EvidenceRequirement["temporalPosture"];
  }> = {},
): EvidenceRequirement {
  const first = listing(`${label}:a`, options.url);
  const second = listing(`${label}:b`);
  return buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ proposal: label }),
    proposalListingRefs: [first.listingRef, second.listingRef],
    listings: [first, second],
    drafts: [Object.freeze({
      kind: options.kind ?? "RESOLUTION_RULE",
      listingRefs: Object.freeze([first.listingRef]),
      claim: "The official rule determines whether the disputed joint state exists.",
      reason: "The semantic constraint cannot be certified without official evidence.",
      satisfyingObservation: "The official text excludes the joint state.",
      contradictingObservation: "The official text permits the joint state.",
      temporalPosture: options.temporalPosture ?? "HISTORICAL_AT_SOURCE_OBSERVATION",
    })],
  })[0]!;
}

function fetcher(
  fetch: EvidenceDocumentFetchLike,
  now: () => number,
  options: Readonly<{ maxResponseBytes?: number }> = {},
): EvidenceDocumentFetcher {
  return new EvidenceDocumentFetcher({
    policies: [buildEvidenceDocumentFetchPolicy({
      venueId: "test-venue",
      protocolIdentity: "test-protocol:v1",
      role: "CONTRACT_RULE_DOCUMENT",
      allowedHostnames: ["rules.example.com"],
      allowedContentTypes: ["text/plain"],
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
    })],
    fetch,
    resolve: publicResolver,
    now,
  });
}

function rehash(
  record: EvidenceAcquisitionJobRecord,
  changes: Partial<Omit<EvidenceAcquisitionJobRecord, "artifactHash">>,
): EvidenceAcquisitionJobRecord {
  const { artifactHash: _artifactHash, ...prior } = record;
  const body = Object.freeze({ ...prior, ...changes });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

describe("durable evidence acquisition scheduler", () => {
  it("coalesces proposal-local requirements into one bounded anonymous fetch", async () => {
    const time = clock();
    const url = "https://rules.example.com/shared/rules.txt";
    const first = requirement("proposal-one", { url });
    const second = requirement("proposal-two", { url });
    expect(first.acquisitionScopeIdentity).toBe(second.acquisitionScopeIdentity);
    const read = vi.fn<EvidenceDocumentFetchLike>(async () =>
      new Response("Official shared settlement rule.", {
        status: 200,
        headers: { "content-type": "text/plain", etag: "\"shared-v1\"" },
      })
    );
    const scheduler = new EvidenceAcquisitionScheduler({
      fetcher: fetcher(read, time.now),
      tickIntervalMs: 1_000,
      now: time.now,
    });

    const work = scheduler.tick([first, second]);
    expect(work).toHaveLength(1);
    await Promise.all(work);

    expect(read).toHaveBeenCalledOnce();
    expect(scheduler.projection()).toMatchObject({
      status: "IDLE",
      capturedCount: 1,
      requirementCount: 2,
      coalescedRequirementCount: 1,
      unsupportedCount: 0,
      budget: { basis: "FETCH_ATTEMPTS", fetchAttemptsStarted: 1 },
      authority: "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        anonymousReadsOnly: true,
        credentialsUsed: false,
        providerRequests: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    const job = scheduler.projection().jobs[0]!;
    expect(job.requirementIds).toEqual([first.requirementId, second.requirementId].sort());
    expect(scheduler.captureForJob(job.jobId)?.extraction.text)
      .toBe("Official shared settlement rule.");
  });

  it("retains requirements that coalesce while the shared fetch is already leased", async () => {
    const time = clock();
    const url = "https://rules.example.com/in-flight/rules.txt";
    const first = requirement("in-flight-one", { url });
    const second = requirement("in-flight-two", { url });
    let release!: (response: Response) => void;
    const read = vi.fn<EvidenceDocumentFetchLike>(() => new Promise((resolve) => {
      release = resolve;
    }));
    const scheduler = new EvidenceAcquisitionScheduler({
      fetcher: fetcher(read, time.now), tickIntervalMs: 1_000, now: time.now,
    });

    const [active] = scheduler.tick([first]);
    expect(active).toBeDefined();
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect(scheduler.tick([first, second])).toEqual([]);
    release(new Response("Shared in-flight rule.", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    await active;

    expect(read).toHaveBeenCalledOnce();
    expect(scheduler.projection()).toMatchObject({
      requirementCount: 2,
      coalescedRequirementCount: 1,
      capturedCount: 1,
    });
    expect(scheduler.projection().jobs[0]!.requirementIds)
      .toEqual([first.requirementId, second.requirementId].sort());
  });

  it("retains unsupported routes without spending fetch or provider budget", () => {
    const time = clock();
    const unsupported = requirement("quote-depth", { kind: "QUOTE_DEPTH" });
    const read = vi.fn<EvidenceDocumentFetchLike>();
    const scheduler = new EvidenceAcquisitionScheduler({
      fetcher: fetcher(read, time.now), tickIntervalMs: 1_000, now: time.now,
    });

    expect(scheduler.tick([unsupported])).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    expect(scheduler.projection()).toMatchObject({
      unsupportedCount: 1,
      dueCount: 0,
      budget: { fetchAttemptsStarted: 0 },
    });
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "UNSUPPORTED",
      attemptCount: 0,
      locatorIdentity: null,
      policyIdentity: null,
    });
  });

  it("bounds transient retries and terminalizes the exhausted fetch budget", async () => {
    const time = clock();
    const input = requirement("retry", {
      url: "https://rules.example.com/retry/rules.txt",
    });
    const read = vi.fn<EvidenceDocumentFetchLike>(async () => {
      throw new Error("upstream timeout");
    });
    const scheduler = new EvidenceAcquisitionScheduler({
      fetcher: fetcher(read, time.now),
      tickIntervalMs: 1_000,
      maxAttempts: 2,
      retryDelayMs: 1_000,
      now: time.now,
    });

    await Promise.all(scheduler.tick([input]));
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "RETRY_WAIT", attemptCount: 1,
    });
    time.advance(1_000);
    await Promise.all(scheduler.tick([input]));
    expect(read).toHaveBeenCalledTimes(2);
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "EXHAUSTED", attemptCount: 2, diagnostic: "upstream timeout",
    });
  });

  it("marks current evidence stale and records conditional 304 reuse", async () => {
    const time = clock();
    const input = requirement("freshness", {
      url: "https://rules.example.com/current/rules.txt",
      temporalPosture: "CURRENT",
    });
    const headers: Readonly<Record<string, string>>[] = [];
    const read = vi.fn<EvidenceDocumentFetchLike>(async (_url, init) => {
      headers.push(init.headers);
      return headers.length === 1
        ? new Response("Current official rule.", {
            status: 200,
            headers: { "content-type": "text/plain", etag: "\"current-v1\"" },
          })
        : new Response(null, { status: 304 });
    });
    const scheduler = new EvidenceAcquisitionScheduler({
      fetcher: fetcher(read, time.now),
      tickIntervalMs: 1_000,
      freshForMs: 1_000,
      now: time.now,
    });

    await Promise.all(scheduler.tick([input]));
    const first = scheduler.projection().jobs[0]!;
    const firstDocumentId = first.lastDocumentId;
    time.advance(1_000);
    const refresh = scheduler.tick([input]);
    expect(refresh).toHaveLength(1);
    await Promise.all(refresh);

    expect(headers[1]).toMatchObject({ "if-none-match": "\"current-v1\"" });
    expect(scheduler.projection()).toMatchObject({
      capturedCount: 1,
      staleCount: 0,
      conditionalReuseCount: 1,
      budget: { fetchAttemptsStarted: 2 },
    });
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "CAPTURED", httpStatus: 304, lastDocumentId: firstDocumentId,
    });
    for (let index = 0; index < 2; index += 1) {
      time.advance(1_000);
      await Promise.all(scheduler.tick([input]));
    }
    expect(read).toHaveBeenCalledTimes(4);
    expect(scheduler.projection()).toMatchObject({
      capturedCount: 1,
      conditionalReuseCount: 3,
      budget: { fetchAttemptsStarted: 4 },
    });
    expect(scheduler.projection().jobs[0]).toMatchObject({
      attemptCount: 0,
      totalAttemptCount: 4,
    });
  });

  it("restores captures and recovers expired leases across SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-evidence-acquisition-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("restart", {
        url: "https://rules.example.com/restart/rules.txt",
      });
      const read = vi.fn<EvidenceDocumentFetchLike>(async () =>
        new Response("Durably retained official rule.", {
          status: 200,
          headers: { "content-type": "text/plain" },
        })
      );
      const firstStore = new SqliteOperationalStore(path);
      const firstScheduler = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(read, time.now),
        tickIntervalMs: 1_000,
        store: firstStore,
        now: time.now,
      });
      await Promise.all(firstScheduler.tick([input]));
      const captured = firstScheduler.projection().jobs[0]!;
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const restored = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(read, time.now),
        tickIntervalMs: 1_000,
        store: secondStore,
        now: time.now,
      });
      expect(restored.tick([input])).toEqual([]);
      expect(read).toHaveBeenCalledOnce();
      expect(restored.captureForJob(captured.jobId)?.extraction.text)
        .toBe("Durably retained official rule.");

      const other = requirement("expired", {
        url: "https://rules.example.com/expired/rules.txt",
      });
      restored.reconcile([input, other]);
      const pending = restored.projection().jobs.find((job) =>
        job.acquisitionScopeIdentity === other.acquisitionScopeIdentity
      )!;
      secondStore.saveEvidenceAcquisitionJobRecord(rehash(pending, {
        status: "LEASED",
        attemptCount: 1,
        totalAttemptCount: 1,
        leasedAt: new Date(time.now()).toISOString(),
        leaseExpiresAt: new Date(time.now() + 1_000).toISOString(),
        updatedAt: new Date(time.now()).toISOString(),
      }), 250);
      secondStore.close();

      time.advance(1_001);
      const thirdStore = new SqliteOperationalStore(path);
      const recovered = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(read, time.now),
        tickIntervalMs: 1_000,
        leaseTimeoutMs: 1_000,
        retryDelayMs: 1_000,
        store: thirdStore,
        now: time.now,
      });
      recovered.reconcile([input, other]);
      expect(recovered.projection().jobs.find((job) =>
        job.acquisitionScopeIdentity === other.acquisitionScopeIdentity
      )).toMatchObject({ status: "RETRY_WAIT", attemptCount: 1 });
      thirdStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains both immutable documents when a current official rule changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-evidence-version-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("changed", {
        url: "https://rules.example.com/changed/rules.txt",
        temporalPosture: "CURRENT",
      });
      let version = 0;
      const store = new SqliteOperationalStore(path);
      const scheduler = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(async () => {
          version += 1;
          return new Response(`Official rule version ${version}.`, {
            status: 200,
            headers: { "content-type": "text/plain", etag: `\"v${version}\"` },
          });
        }, time.now),
        tickIntervalMs: 1_000,
        freshForMs: 1_000,
        store,
        now: time.now,
      });
      await Promise.all(scheduler.tick([input]));
      const firstDocumentId = scheduler.projection().jobs[0]!.lastDocumentId;
      time.advance(1_000);
      await Promise.all(scheduler.tick([input]));
      const secondDocumentId = scheduler.projection().jobs[0]!.lastDocumentId;
      expect(secondDocumentId).not.toBe(firstDocumentId);
      store.close();

      const inspected = new DatabaseSync(path, { readOnly: true });
      expect(inspected.prepare("SELECT count(*) AS count FROM evidence_documents").get())
        .toEqual({ count: 2 });
      expect(inspected.prepare(
        "SELECT count(*) AS count FROM evidence_document_observations",
      ).get()).toEqual({ count: 2 });
      inspected.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("conditionally revalidates current evidence immediately after SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-evidence-revalidate-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("restart-current", {
        url: "https://rules.example.com/restart-current/rules.txt",
        temporalPosture: "CURRENT",
      });
      let callCount = 0;
      const read = vi.fn<EvidenceDocumentFetchLike>(async (_url, init) => {
        callCount += 1;
        if (callCount === 2) {
          expect(init.headers).toMatchObject({ "if-none-match": "\"restart-v1\"" });
          return new Response(null, { status: 304 });
        }
        return new Response("Restart-current official rule.", {
          status: 200,
          headers: { "content-type": "text/plain", etag: "\"restart-v1\"" },
        });
      });
      const firstStore = new SqliteOperationalStore(path);
      const first = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(read, time.now),
        tickIntervalMs: 1_000,
        freshForMs: 1_000,
        store: firstStore,
        now: time.now,
      });
      await Promise.all(first.tick([input]));
      const firstDocumentId = first.projection().jobs[0]!.lastDocumentId;
      firstStore.close();

      time.advance(1_000);
      const secondStore = new SqliteOperationalStore(path);
      const second = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(read, time.now),
        tickIntervalMs: 1_000,
        freshForMs: 1_000,
        store: secondStore,
        now: time.now,
      });
      const work = second.tick([input]);
      expect(work).toHaveLength(1);
      await Promise.all(work);
      expect(second.projection()).toMatchObject({
        capturedCount: 1,
        conditionalReuseCount: 1,
        budget: { fetchAttemptsStarted: 2 },
      });
      expect(second.projection().jobs[0]).toMatchObject({
        httpStatus: 304,
        lastDocumentId: firstDocumentId,
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves old observations but performs a full fetch after policy changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-evidence-policy-change-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("policy-change", {
        url: "https://rules.example.com/policy-change/rules.txt",
        temporalPosture: "CURRENT",
      });
      const firstRead = vi.fn<EvidenceDocumentFetchLike>(async () =>
        new Response("Official rule under policy one.", {
          status: 200,
          headers: { "content-type": "text/plain", etag: "\"policy-one\"" },
        })
      );
      const firstStore = new SqliteOperationalStore(path);
      const first = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(firstRead, time.now, { maxResponseBytes: 2_000_000 }),
        tickIntervalMs: 1_000,
        store: firstStore,
        now: time.now,
      });
      await Promise.all(first.tick([input]));
      const oldJob = first.projection().jobs[0]!;
      firstStore.close();

      time.advance(1);
      const secondRead = vi.fn<EvidenceDocumentFetchLike>(async (_url, init) => {
        expect(init.headers).not.toHaveProperty("if-none-match");
        expect(init.headers).not.toHaveProperty("if-modified-since");
        return new Response("Official rule under policy two.", {
          status: 200,
          headers: { "content-type": "text/plain", etag: "\"policy-two\"" },
        });
      });
      const secondStore = new SqliteOperationalStore(path);
      const second = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(secondRead, time.now, { maxResponseBytes: 1_000_000 }),
        tickIntervalMs: 1_000,
        store: secondStore,
        now: time.now,
      });
      const work = second.tick([input]);
      expect(work).toHaveLength(1);
      await Promise.all(work);
      const newJob = second.projection().jobs[0]!;
      expect(newJob).toMatchObject({
        status: "CAPTURED",
        attemptCount: 0,
        totalAttemptCount: 2,
        conditionalReuseCount: 0,
        httpStatus: 200,
      });
      expect(newJob.policyIdentity).not.toBe(oldJob.policyIdentity);
      expect(newJob.lastDocumentId).not.toBe(oldJob.lastDocumentId);
      expect(firstRead).toHaveBeenCalledOnce();
      expect(secondRead).toHaveBeenCalledOnce();
      secondStore.close();

      const inspected = new DatabaseSync(path, { readOnly: true });
      expect(inspected.prepare("SELECT count(*) AS count FROM evidence_documents").get())
        .toEqual({ count: 2 });
      expect(inspected.prepare(
        "SELECT count(*) AS count FROM evidence_document_observations",
      ).get()).toEqual({ count: 2 });
      inspected.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when retained raw evidence bytes are tampered", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-evidence-tamper-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("tamper", {
        url: "https://rules.example.com/tamper/rules.txt",
      });
      const store = new SqliteOperationalStore(path);
      const scheduler = new EvidenceAcquisitionScheduler({
        fetcher: fetcher(async () => new Response("Untampered rule.", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }), time.now),
        tickIntervalMs: 1_000,
        store,
        now: time.now,
      });
      await Promise.all(scheduler.tick([input]));
      store.close();

      const database = new DatabaseSync(path);
      database.prepare("UPDATE evidence_documents SET raw_bytes = ?")
        .run(new TextEncoder().encode("Tampered rule."));
      database.close();

      const reopened = new SqliteOperationalStore(path);
      expect(() => new EvidenceAcquisitionScheduler({
        fetcher: fetcher(vi.fn<EvidenceDocumentFetchLike>(), time.now),
        store: reopened,
        now: time.now,
      })).toThrow(/content identity/);
      reopened.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
