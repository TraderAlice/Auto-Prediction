import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashCanonical } from "@pmh/domain";
import { describe, expect, it, vi } from "vitest";
import {
  buildProbabilisticSemanticBound,
  buildSemanticConstraintArtifact,
  ProbabilityCalibrationDesk,
  ProbabilityResolutionAcquisitionScheduler,
  SqliteOperationalStore,
  type MarketRelationProposal,
} from "../src/index.js";

function bound(listingRefs: readonly [string, string], tag: string) {
  const corpus = hashCanonical({ corpus: tag });
  const proposalBody = Object.freeze({
    relationKind: "MUTUALLY_EXCLUSIVE" as const,
    listingRefs,
    statement: "The retained outcomes are usually mutually exclusive.",
    rationale: "Retain a probabilistic relation for settlement calibration.",
    falsifiers: ["Both outcomes may settle true."],
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  });
  const proposal: MarketRelationProposal = Object.freeze({
    ...proposalBody,
    proposalId: hashCanonical({ corpusSnapshotIdentity: corpus, ...proposalBody }),
  });
  const constraint = buildSemanticConstraintArtifact({
    proposal,
    proposalCorpusSnapshotIdentity: corpus,
    evidenceCorpusSnapshotIdentity: corpus,
    listingEvidence: listingRefs.map((listingRef) => ({
      listingRef,
      listingHash: hashCanonical({ listingRef }),
      sourceRawHash: hashCanonical({ rules: listingRef }),
      protocolIdentity: `protocol:${listingRef}`,
    })),
    draft: {
      classification: "PROBABILISTIC_DEPENDENCE",
      relationKind: "MUTUALLY_EXCLUSIVE",
      assumptions: ["The events are causally related."],
      counterexampleAttempt: {
        attempted: true, result: "FOUND",
        narrative: "Both events can occur in an unusual state.", truths: [true, true],
      },
      truthTable: [
        [false, false], [false, true], [true, false], [true, true],
      ].map((truths) => ({
        truths, disposition: "FEASIBLE" as const,
        rationale: truths[0] && truths[1] ? "Adverse but possible." : "Ordinary state.",
        evidenceListingRefs: listingRefs,
      })),
      unresolvedEvidence: ["The adverse state needs a probability estimate."],
    },
  });
  return buildProbabilisticSemanticBound({
    semanticConstraint: constraint,
    adverseStateIds: ["TT"],
    estimates: ["REFERENCE_CLASS", "CAUSAL_MODEL"].map((method, index) => ({
      estimator: `worker-${index}`,
      method: method as "REFERENCE_CLASS" | "CAUSAL_MODEL",
      lowerPpm: "20000", upperPpm: "60000",
      evidenceHashes: [hashCanonical({ tag, method })],
      assumptions: ["The retained estimate applies."],
      completedAt: `2026-08-02T00:0${index}:00.000Z`,
      expiresAt: "2026-08-03T00:00:00.000Z",
    })),
    counterScenarios: ["Both events settle true.", `cohort:${tag}`],
  });
}

function globalPayload(id: string, truthValue: boolean) {
  return JSON.stringify({
    id, closed: true, closedTime: "2026-08-09 08:49:42+00",
    umaResolutionStatus: "resolved", outcomes: "[\"Yes\",\"No\"]",
    outcomePrices: truthValue ? "[\"1\",\"0\"]" : "[\"0\",\"1\"]",
    clobTokenIds: `[\"yes-${id}\",\"no-${id}\"]`,
  });
}

describe("anonymous probability resolution acquisition", () => {
  it("auto-records only fully timed Global payouts and preserves their raw bytes", async () => {
    const registered = bound(["polymarket-global:41", "polymarket-global:42"], "global");
    const desk = new ProbabilityCalibrationDesk({
      boundSource: () => [registered],
      now: () => "2026-08-10T00:00:00.000Z",
    });
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const id = String(url).split("/").at(-1)!;
      return new Response(globalPayload(id, id === "41"), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const scheduler = new ProbabilityResolutionAcquisitionScheduler({
      sink: desk, fetch: fetcher, now: () => Date.parse("2026-08-10T00:00:00.000Z"),
      intervalMs: 300_000,
    });
    await scheduler.runNow();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(desk.projection()).toMatchObject({ observationCount: 1, pendingResolutionBoundCount: 0 });
    expect(scheduler.projection()).toMatchObject({
      pendingBoundCount: 0, autoRecordedBoundCount: 1, failedRequestCount: 0,
      executionAuthority: false,
    });
    const capture = scheduler.projection().captures[0]!;
    expect(capture).toMatchObject({ status: "RESOLVED", resolutionTimeBasis: "VENUE_REPORTED_CLOSED_TIME" });
    expect(new TextDecoder().decode(scheduler.rawSource(capture.sourceRawHash)!)).toContain(capture.venueInstrumentId);
  });

  it("retains exact US payouts but blocks calibration when the endpoint has no resolution time", async () => {
    const registered = bound(["polymarket-us:market-a", "polymarket-us:market-b"], "us");
    const desk = new ProbabilityCalibrationDesk({
      boundSource: () => [registered],
      now: () => "2026-08-10T00:00:00.000Z",
    });
    const scheduler = new ProbabilityResolutionAcquisitionScheduler({
      sink: desk,
      fetch: async (url) => new Response(JSON.stringify({
        slug: decodeURIComponent(String(url).split("/").at(-2)!), settlement: 1,
      }), { status: 200, headers: { "content-type": "application/json" } }),
      now: () => Date.parse("2026-08-10T00:00:00.000Z"),
    });
    await scheduler.runNow();

    expect(desk.projection()).toMatchObject({ observationCount: 0, pendingResolutionBoundCount: 1 });
    expect(scheduler.projection()).toMatchObject({
      timeUnavailableListingCount: 2,
      resolvedListingCount: 0,
      autoRecordedBoundCount: 0,
    });
    expect(scheduler.projection().captures.every((item) =>
      item.status === "RESOLUTION_TIME_UNAVAILABLE" && item.resolvedAt === null)).toBe(true);
  });

  it("replays content-addressed captures after restart and detects raw-byte tampering", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "pmh-resolution-")), "state.sqlite");
    const registered = bound(["polymarket-us:market-a", "polymarket-us:market-b"], "durable-us");
    const firstStore = new SqliteOperationalStore(path);
    const firstDesk = new ProbabilityCalibrationDesk({ boundSource: () => [registered], store: firstStore });
    const fetcher = vi.fn<typeof fetch>(async (url) => new Response(JSON.stringify({
      slug: decodeURIComponent(String(url).split("/").at(-2)!), settlement: 0,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const first = new ProbabilityResolutionAcquisitionScheduler({ sink: firstDesk, store: firstStore, fetch: fetcher });
    await first.runNow();
    const rawHash = first.projection().captures[0]!.sourceRawHash;
    firstStore.close();

    const secondStore = new SqliteOperationalStore(path);
    const secondDesk = new ProbabilityCalibrationDesk({ boundSource: () => [], store: secondStore });
    const second = new ProbabilityResolutionAcquisitionScheduler({ sink: secondDesk, store: secondStore, fetch: fetcher });
    await second.runNow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(second.projection()).toMatchObject({
      timeUnavailableListingCount: 2,
      storage: { captures: { durable: true, schemaVersion: 33 }, sources: { durable: true, schemaVersion: 33 } },
    });
    expect(second.rawSource(rawHash)).not.toBeNull();
    secondStore.close();

    const database = new DatabaseSync(path);
    database.prepare("UPDATE probability_resolution_sources SET raw_bytes = ? WHERE raw_hash = ?")
      .run(new TextEncoder().encode("tampered"), rawHash);
    database.close();
    const thirdStore = new SqliteOperationalStore(path);
    expect(() => thirdStore.loadProbabilityResolutionSource(rawHash)).toThrow(/identity mismatch/u);
    thirdStore.close();
  });

  it("fails a request without retaining partial evidence when the response exceeds its byte policy", async () => {
    const registered = bound(["polymarket-global:41", "polymarket-global:42"], "oversized");
    const desk = new ProbabilityCalibrationDesk({ boundSource: () => [registered] });
    const scheduler = new ProbabilityResolutionAcquisitionScheduler({
      sink: desk,
      fetch: async () => new Response("x".repeat(1_025), {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "1025" },
      }),
      maxRequestsPerRun: 1,
      maxResponseBytes: 1_024,
    });
    await scheduler.runNow();
    expect(scheduler.projection()).toMatchObject({
      failedRequestCount: 1,
      capturedListingCount: 0,
      lastDiagnostic: "anonymous resolution response exceeds the byte limit",
    });
    expect(desk.projection()).toMatchObject({ observationCount: 0, pendingResolutionBoundCount: 1 });
  });
});
