import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CatalogObservationDesk,
  catalogObservationSources,
  type CatalogFetchLike,
} from "../src/index.js";

const fixtureNames: Readonly<Record<string, string>> = {
  "polymarket-global": "polymarket-catalog",
  kalshi: "kalshi-catalog",
  "gemini-predictions": "gemini-binary-catalog",
  opinion: "opinion-catalog",
  myriad: "myriad-amm-catalog",
  limitless: "limitless-catalog",
};

function fixtureFetcher(options: Readonly<{ failVenue?: string }> = {}):
  CatalogFetchLike {
  return async (input, init) => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.sourceUrl === input,
    );
    if (source === undefined) return new Response(null, { status: 404 });
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    if (source.venueId === options.failVenue) {
      return new Response("unavailable", { status: 503 });
    }
    const fixtureName = fixtureNames[source.venueId];
    if (fixtureName === undefined) return new Response(null, { status: 404 });
    const bytes = await readFile(
      resolve(
        import.meta.dirname,
        `../../../projects/fixtures/${source.venueId}/2026-07-31/${fixtureName}.json`,
      ),
    );
    return new Response(new Uint8Array(bytes).buffer, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("anonymous catalog observation desk", () => {
  it("content-addresses bounded public GET responses without promoting them", async () => {
    const desk = new CatalogObservationDesk({
      fetcher: fixtureFetcher(),
      now: () => Date.parse("2026-08-01T03:15:00.000Z"),
    });
    expect(desk.projection()).toMatchObject({
      status: "IDLE",
      listingCount: 0,
      promotion: "OBSERVE_ONLY",
    });
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      mode: "ANONYMOUS_PUBLIC_GET",
      status: "READY",
      promotion: "OBSERVE_ONLY",
      sourceCount: 6,
      healthySourceCount: 6,
      storage: { mode: "MEMORY", durable: false },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.listingCount).toBeGreaterThan(0);
    expect(projection.currentSetIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(
      projection.sources.every(
        (source) =>
          source.status === "CURRENT" &&
          source.rawHash?.startsWith("sha256:") === true &&
          source.credentialsUsed === false &&
          source.receivedAt === "2026-08-01T03:15:00.000Z",
      ),
    ).toBe(true);
  });

  it("isolates source failure and retains the last content-addressed success", async () => {
    let fail = false;
    const stableFetcher = fixtureFetcher();
    const desk = new CatalogObservationDesk({
      fetcher: async (input, init) => {
        const source = catalogObservationSources.find(
          (candidate) => candidate.sourceUrl === input,
        );
        if (fail && source?.venueId === "kalshi") {
          return new Response("unavailable", { status: 503 });
        }
        return stableFetcher(input, init);
      },
      now: () => Date.parse("2026-08-01T03:16:00.000Z"),
    });
    const ready = await desk.refresh();
    const prior = ready.sources.find((source) => source.venueId === "kalshi");
    fail = true;
    const degraded = await desk.refresh();
    expect(degraded.status).toBe("DEGRADED");
    expect(degraded.sources.find((source) => source.venueId === "kalshi")).toMatchObject({
      status: "STALE_AFTER_FAILURE",
      rawHash: prior?.rawHash,
      listingCount: prior?.listingCount,
      diagnostic: "anonymous catalog GET returned HTTP 503",
    });
    expect(degraded.healthySourceCount).toBe(5);
  });

  it("rejects a response before decoding when it crosses the byte cap", async () => {
    const source = catalogObservationSources[0];
    if (source === undefined) throw new Error("missing test source");
    const desk = new CatalogObservationDesk({
      sources: [source],
      maxResponseBytes: 8,
      fetcher: async () =>
        new Response("0123456789", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      status: "DEGRADED",
      listingCount: 0,
      healthySourceCount: 0,
    });
    expect(projection.sources[0]).toMatchObject({
      status: "FAILED",
      diagnostic: "response exceeds 8 byte limit",
    });
  });
});
