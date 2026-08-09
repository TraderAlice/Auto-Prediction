import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CandidateWatchDesk,
  candidateWatchSources,
  RealCandidatePreflightDesk,
  type CandidateWatchFetchLike,
  type CandidateWatchStore,
  type CandidateWatchVenueId,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

const fixtureRoot = resolve(
  import.meta.dirname,
  "../../../projects/fixtures",
);

const boundFixtureNames: Readonly<Record<CandidateWatchVenueId, string>> = {
  "polymarket-global": "polymarket-trump-out-2027-book-rescreen-1",
  limitless: "limitless-trump-out-2027-book-rescreen-1",
};

async function bookBytes(
  venueId: CandidateWatchVenueId,
  name = boundFixtureNames[venueId],
): Promise<Uint8Array> {
  return readFile(resolve(fixtureRoot, venueId, "2026-08-01", `${name}.json`));
}

function fixtureFetcher(options: Readonly<{
  failVenue?: CandidateWatchVenueId;
  polymarketFixture?: string;
  limitlessRewrite?: (source: string) => string;
}> = {}): CandidateWatchFetchLike {
  return async (input, init) => {
    const source = candidateWatchSources.find(
      (candidate) => candidate.sourceUrl === input,
    );
    if (source === undefined) return new Response(null, { status: 404 });
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    if (source.venueId === options.failVenue) {
      return new Response("unavailable", { status: 503 });
    }
    let bytes = await bookBytes(
      source.venueId,
      source.venueId === "polymarket-global"
        ? options.polymarketFixture
        : undefined,
    );
    if (
      source.venueId === "limitless" &&
      options.limitlessRewrite !== undefined
    ) {
      bytes = new TextEncoder().encode(
        options.limitlessRewrite(new TextDecoder().decode(bytes)),
      );
    }
    return new Response(new Uint8Array(bytes).buffer, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

async function evidenceDesk(): Promise<RealCandidatePreflightDesk> {
  const desk = new RealCandidatePreflightDesk(fixtureRoot);
  await desk.load();
  return desk;
}

describe("candidate watch desk", () => {
  it("retains an unchanged anonymous refresh without inventing a new decision", async () => {
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher(),
      now: () => Date.parse("2026-08-01T06:10:00.000Z"),
    });
    expect(() => desk.projection()).toThrow(/not loaded/);
    expect(desk.load()).toMatchObject({
      status: "IDLE",
      authority: "OBSERVE_AND_SCREEN_ONLY",
      decision: null,
      storage: { mode: "MEMORY", durable: false },
    });
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      mode: "ANONYMOUS_PUBLIC_GET",
      status: "READY",
      latestRefreshId: expect.stringMatching(/^candidate-watch-refresh:/),
      changedVenueCount: 0,
      decision: {
        status: "UNCHANGED_BOUND_SNAPSHOT",
        changedVenueIds: [],
        grossFloorBeforeFees: "0",
        postFeeFloorUpperBound: "0",
        priorDecisionReused: true,
        reviewRequired: false,
        independentReviewInvoked: false,
        verifierInvoked: false,
        arbitrageVerified: false,
      },
      refreshHistory: [
        {
          status: "READY",
          refreshId: expect.stringMatching(/^candidate-watch-refresh:/),
          sources: [
            expect.objectContaining({ status: "SUCCESS" }),
            expect.objectContaining({ status: "SUCCESS" }),
          ],
        },
      ],
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(
      projection.sources.every(
        (source) =>
          source.status === "CURRENT" &&
          source.changedFromBound === false &&
          source.credentialsUsed === false &&
          source.receivedAt === "2026-08-01T06:10:00.000Z",
      ),
    ).toBe(true);
  });

  it("recomputes an economic rejection after a substantive book change", async () => {
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher({
        polymarketFixture: "polymarket-trump-out-2027-book",
      }),
      now: () => Date.parse("2026-08-01T06:11:00.000Z"),
    });
    desk.load();
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      status: "READY",
      changedVenueCount: 1,
      decision: {
        status: "REJECTED_ECONOMICS",
        changedVenueIds: ["polymarket-global"],
        grossFloorBeforeFees: "0",
        postFeeFloorUpperBound: "0",
        priorDecisionReused: false,
        reviewRequired: false,
        independentReviewInvoked: false,
        verifierInvoked: false,
        arbitrageVerified: false,
      },
    });
    expect(projection.decision?.depthArtifactHash).toMatch(/^sha256:/);
    expect(projection.decision?.dispositionArtifactHash).toMatch(/^sha256:/);
  });

  it("routes a newly positive gross screen to qualification without verification", async () => {
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher({
        limitlessRewrite: (source) =>
          source.replace('"price":0.07', '"price":0.08'),
      }),
      now: () => Date.parse("2026-08-01T06:12:00.000Z"),
    });
    desk.load();
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      status: "READY",
      changedVenueCount: 1,
      decision: {
        status: "POSITIVE_GROSS_REQUIRES_QUALIFICATION",
        changedVenueIds: ["limitless"],
        grossFloorBeforeFees: "5000000",
        postFeeFloorUpperBound: null,
        dispositionArtifactHash: null,
        priorDecisionReused: false,
        reviewRequired: true,
        independentReviewInvoked: false,
        verifierInvoked: false,
        arbitrageVerified: false,
      },
    });
  });

  it("never stitches a fresh source to the other venue's older refresh", async () => {
    let failLimitless = false;
    let nowMs = Date.parse("2026-08-01T06:13:00.000Z");
    const stable = fixtureFetcher();
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: async (input, init) => {
        const source = candidateWatchSources.find(
          (candidate) => candidate.sourceUrl === input,
        );
        if (failLimitless && source?.venueId === "limitless") {
          return new Response("unavailable", { status: 503 });
        }
        return stable(input, init);
      },
      now: () => nowMs,
    });
    desk.load();
    await expect(desk.refresh()).resolves.toMatchObject({ status: "READY" });
    failLimitless = true;
    const degraded = await desk.refresh();
    expect(degraded).toMatchObject({
      status: "DEGRADED",
      latestRefreshId: null,
      decision: null,
    });
    expect(
      degraded.sources.find((source) => source.venueId === "limitless"),
    ).toMatchObject({
      status: "STALE_AFTER_FAILURE",
      diagnostic: "anonymous candidate book GET returned HTTP 503",
    });
    expect(degraded.refreshHistory[0]).toMatchObject({
      status: "DEGRADED",
      decision: null,
      sources: expect.arrayContaining([
        expect.objectContaining({ venueId: "limitless", status: "FAILED" }),
        expect.objectContaining({
          venueId: "polymarket-global",
          status: "SUCCESS",
        }),
      ]),
    });
  });

  it("coalesces concurrent refreshes and rejects oversized responses", async () => {
    let calls = 0;
    const bytes = new TextEncoder().encode("0123456789");
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      maxResponseBytes: 8,
      fetcher: async () => {
        calls += 1;
        return new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    desk.load();
    const first = desk.refresh();
    const second = desk.refresh();
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({
      status: "DEGRADED",
      decision: null,
      sources: [
        expect.objectContaining({
          status: "FAILED",
          diagnostic: "response exceeds 8 byte limit",
        }),
        expect.objectContaining({
          status: "FAILED",
          diagnostic: "response exceeds 8 byte limit",
        }),
      ],
    });
    expect(calls).toBe(2);
  });

  it("restores the latest failed refresh instead of reviving stale READY books", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-watch-restart-"));
    tempDirectories.push(directory);
    const path = join(directory, "control-plane.sqlite");
    const stable = fixtureFetcher();
    let failAll = false;
    let nowMs = Date.parse("2026-08-01T06:40:00.000Z");
    const fetcher: CandidateWatchFetchLike = async (input, init) =>
      failAll
        ? new Response("unavailable", { status: 503 })
        : stable(input, init);

    const firstStore = new SqliteOperationalStore(path);
    const first = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher,
      now: () => nowMs,
      store: firstStore,
    });
    first.load();
    await expect(first.refresh()).resolves.toMatchObject({ status: "READY" });
    failAll = true;
    nowMs = Date.parse("2026-08-01T06:41:00.000Z");
    await expect(first.refresh()).resolves.toMatchObject({
      status: "DEGRADED",
      decision: null,
    });
    firstStore.close();

    const secondStore = new SqliteOperationalStore(path);
    const restored = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher,
      now: () => nowMs,
      store: secondStore,
    }).load();
    expect(restored).toMatchObject({
      status: "DEGRADED",
      decision: null,
      refreshStorage: {
        mode: "SQLITE_WAL",
        durable: true,
        schemaVersion: 29,
      },
      refreshHistory: [
        {
          status: "DEGRADED",
          attemptedAt: "2026-08-01T06:41:00.000Z",
        },
        { status: "READY" },
      ],
      sources: [
        expect.objectContaining({
          status: "STALE_AFTER_FAILURE",
          lastAttemptAt: "2026-08-01T06:41:00.000Z",
          diagnostic: "anonymous candidate book GET returned HTTP 503",
        }),
        expect.objectContaining({
          status: "STALE_AFTER_FAILURE",
          lastAttemptAt: "2026-08-01T06:41:00.000Z",
          diagnostic: "anonymous candidate book GET returned HTTP 503",
        }),
      ],
    });
    secondStore.close();
  });

  it("persists a screen-level diagnostic when both raw GETs succeeded", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-watch-screen-"));
    tempDirectories.push(directory);
    const path = join(directory, "control-plane.sqlite");
    const store = new SqliteOperationalStore(path);
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher({
        limitlessRewrite: () => '{"bids":"malformed","asks":[]}',
      }),
      now: () => Date.parse("2026-08-01T06:42:00.000Z"),
      store,
    });
    desk.load();
    const degraded = await desk.refresh();
    expect(degraded).toMatchObject({
      status: "DEGRADED",
      decision: null,
      sources: [
        expect.objectContaining({ status: "CURRENT", diagnostic: null }),
        expect.objectContaining({ status: "CURRENT", diagnostic: null }),
      ],
      refreshHistory: [
        {
          status: "DEGRADED",
          diagnostic: expect.any(String),
          sources: [
            expect.objectContaining({ status: "SUCCESS" }),
            expect.objectContaining({ status: "SUCCESS" }),
          ],
        },
      ],
    });
    store.close();

    const reopenedStore = new SqliteOperationalStore(path);
    const restored = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher(),
      store: reopenedStore,
    }).load();
    expect(restored).toMatchObject({
      status: "DEGRADED",
      decision: null,
      refreshHistory: [
        {
          status: "DEGRADED",
          diagnostic: degraded.refreshHistory[0]?.diagnostic,
        },
      ],
    });
    reopenedStore.close();
  });

  it("ignores raw observations left behind when journal persistence fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-watch-orphan-"));
    tempDirectories.push(directory);
    const path = join(directory, "control-plane.sqlite");
    const sqlite = new SqliteOperationalStore(path);
    let failJournal = false;
    const crashStore: CandidateWatchStore = {
      candidateBookObservationStorage:
        sqlite.candidateBookObservationStorage,
      candidateWatchRefreshStorage: sqlite.candidateWatchRefreshStorage,
      loadCandidateBookObservations: (limit) =>
        sqlite.loadCandidateBookObservations(limit),
      saveCandidateBookObservation: (observation, limit) =>
        sqlite.saveCandidateBookObservation(observation, limit),
      loadCandidateWatchRefreshes: (limit) =>
        sqlite.loadCandidateWatchRefreshes(limit),
      saveCandidateWatchRefresh: (record, limit) => {
        if (failJournal) throw new Error("simulated journal fsync failure");
        return sqlite.saveCandidateWatchRefresh(record, limit);
      },
    };
    let nowMs = Date.parse("2026-08-01T06:43:00.000Z");
    const desk = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher(),
      now: () => nowMs,
      store: crashStore,
    });
    desk.load();
    const committed = await desk.refresh();
    failJournal = true;
    nowMs = Date.parse("2026-08-01T06:44:00.000Z");
    await expect(desk.refresh()).rejects.toThrow(/journal fsync failure/);
    expect(desk.projection()).toMatchObject({
      status: "READY",
      latestRefreshId: committed.latestRefreshId,
      refreshHistory: [{ refreshId: committed.latestRefreshId }],
    });
    sqlite.close();

    const reopenedStore = new SqliteOperationalStore(path);
    const restored = new CandidateWatchDesk({
      evidenceDesk: await evidenceDesk(),
      fetcher: fixtureFetcher(),
      store: reopenedStore,
    }).load();
    expect(restored).toMatchObject({
      status: "READY",
      latestRefreshId: committed.latestRefreshId,
      refreshHistory: [{ refreshId: committed.latestRefreshId }],
      sources: [
        expect.objectContaining({ refreshId: committed.latestRefreshId }),
        expect.objectContaining({ refreshId: committed.latestRefreshId }),
      ],
    });
    reopenedStore.close();
  });
});
