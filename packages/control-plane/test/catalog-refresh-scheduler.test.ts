import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CatalogObservationDesk,
  CatalogRefreshScheduler,
  catalogObservationSources,
  parseCatalogRefreshInterval,
} from "../src/index.js";

const source = catalogObservationSources.find(
  (candidate) => candidate.venueId === "polymarket-global",
);
if (source === undefined) throw new Error("missing Polymarket test source");

async function fixtureResponse(): Promise<Response> {
  const bytes = await readFile(
    resolve(
      import.meta.dirname,
      "../../../projects/fixtures/polymarket-global/2026-07-31/polymarket-catalog.json",
    ),
  );
  return new Response(new Uint8Array(bytes).buffer, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("catalog refresh scheduler", () => {
  it("parses only an explicit cadence inside the catalog freshness margin", () => {
    expect(parseCatalogRefreshInterval({})).toBeNull();
    expect(parseCatalogRefreshInterval({ PMH_CATALOG_REFRESH_INTERVAL_MS: "0" })).toBeNull();
    expect(
      parseCatalogRefreshInterval({ PMH_CATALOG_REFRESH_INTERVAL_MS: "300000" }),
    ).toBe(300_000);
    expect(() =>
      parseCatalogRefreshInterval({ PMH_CATALOG_REFRESH_INTERVAL_MS: "59999" }),
    ).toThrow(/60000 to 600000/);
    expect(() =>
      parseCatalogRefreshInterval({ PMH_CATALOG_REFRESH_INTERVAL_MS: "900000" }),
    ).toThrow(/60000 to 600000/);
  });

  it("advances immutable corpora on cadence and reports degraded refreshes", async () => {
    let nowMs = Date.parse("2026-08-01T03:15:00.000Z");
    let fail = false;
    const desk = new CatalogObservationDesk({
      sources: [source],
      now: () => nowMs,
      fetcher: async () =>
        fail
          ? new Response("unavailable", { status: 503 })
          : fixtureResponse(),
    });
    const scheduler = new CatalogRefreshScheduler({
      desk,
      intervalMs: 300_000,
      now: () => nowMs,
    });

    const first = scheduler.tick();
    expect(first?.coalesced).toBe(false);
    const firstResult = await first?.promise;
    expect(firstResult?.catalog.status).toBe("READY");
    expect(scheduler.projection()).toMatchObject({
      enabled: true,
      status: "IDLE",
      nextRefreshAt: "2026-08-01T03:20:00.000Z",
      lastTrigger: "SCHEDULE",
      lastResult: "READY",
      runCount: 1,
      readyCount: 1,
      degradedCount: 0,
      failedCount: 0,
      latestSnapshotIdentity: firstResult?.snapshotIdentity,
      effects: { anonymousPublicGets: true, modelCalls: false },
    });
    expect(scheduler.tick()).toBeNull();

    nowMs += 300_000;
    fail = true;
    const second = scheduler.tick();
    const secondResult = await second?.promise;
    expect(secondResult?.catalog).toMatchObject({
      status: "DEGRADED",
      healthySourceCount: 0,
      contextQualification: { status: "INELIGIBLE" },
    });
    expect(secondResult?.snapshotIdentity).not.toBe(firstResult?.snapshotIdentity);
    expect(scheduler.projection()).toMatchObject({
      lastResult: "DEGRADED",
      runCount: 2,
      readyCount: 1,
      degradedCount: 1,
      failedCount: 0,
    });
  });

  it("coalesces operator and timer requests into one bounded refresh", async () => {
    let releaseFetch: (() => void) | undefined;
    const gate = new Promise<void>((resolveGate) => {
      releaseFetch = resolveGate;
    });
    let fetchCount = 0;
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: async () => {
        fetchCount += 1;
        await gate;
        return fixtureResponse();
      },
    });
    const scheduler = new CatalogRefreshScheduler({ desk, intervalMs: 300_000 });

    const operator = scheduler.runNow("OPERATOR");
    const timer = scheduler.runNow("SCHEDULE");
    expect(operator.coalesced).toBe(false);
    expect(timer.coalesced).toBe(true);
    expect(timer.promise).toBe(operator.promise);
    expect(scheduler.projection().status).toBe("REFRESHING");

    releaseFetch?.();
    await Promise.all([operator.promise, timer.promise]);
    expect(fetchCount).toBe(1);
    expect(scheduler.projection()).toMatchObject({
      status: "IDLE",
      runCount: 1,
      lastTrigger: "OPERATOR",
    });
  });
});
