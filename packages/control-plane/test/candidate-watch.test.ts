import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CandidateWatchDesk,
  candidateWatchSources,
  RealCandidatePreflightDesk,
  type CandidateWatchFetchLike,
  type CandidateWatchVenueId,
} from "../src/index.js";

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
});
