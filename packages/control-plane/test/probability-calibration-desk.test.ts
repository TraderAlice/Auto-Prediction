import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildProbabilitySearchOrigin,
  buildProbabilisticSemanticBound,
  buildSemanticConstraintArtifact,
  ProbabilityCalibrationDesk,
  SqliteOperationalStore,
  type MarketRelationProposal,
  type ProbabilisticSemanticBoundArtifact,
} from "../src/index.js";

const listingRefs = ["venue-a:event-a", "venue-b:event-b"] as const;
const corpus = hashCanonical({ corpus: "calibration-desk" });
const proposalBody = Object.freeze({
  relationKind: "MUTUALLY_EXCLUSIVE" as const,
  listingRefs,
  statement: "The two retained outcomes are usually mutually exclusive.",
  rationale: "Retain a probabilistic relation for resolved-outcome calibration.",
  falsifiers: ["Both outcomes may still settle true."],
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
      attempted: true,
      result: "FOUND",
      narrative: "Both events can occur in an unusual state.",
      truths: [true, true],
    },
    truthTable: [
      [false, false], [false, true], [true, false], [true, true],
    ].map((truths) => ({
      truths,
      disposition: "FEASIBLE" as const,
      rationale: truths[0] && truths[1] ? "Adverse but possible." : "Ordinary state.",
      evidenceListingRefs: listingRefs,
    })),
    unresolvedEvidence: ["The adverse state needs a probability estimate."],
  },
});

function bound(tag: string, attributed = false): ProbabilisticSemanticBoundArtifact {
  return buildProbabilisticSemanticBound({
    semanticConstraint: constraint,
    adverseStateIds: ["TT"],
    estimates: [
      {
        estimator: "reference-class-worker",
        method: "REFERENCE_CLASS",
        lowerPpm: "20000",
        upperPpm: "50000",
        evidenceHashes: [hashCanonical({ reference: tag })],
        assumptions: ["The retained reference class applies."],
        completedAt: "2026-08-02T00:00:00.000Z",
        expiresAt: "2026-08-03T00:00:00.000Z",
      },
      {
        estimator: "causal-worker",
        method: "CAUSAL_MODEL",
        lowerPpm: "30000",
        upperPpm: "60000",
        evidenceHashes: [hashCanonical({ causal: tag })],
        assumptions: ["The retained causal mechanism applies."],
        completedAt: "2026-08-02T00:01:00.000Z",
        expiresAt: "2026-08-03T00:00:00.000Z",
      },
    ],
    counterScenarios: ["Both events settle true.", `cohort:${tag}`],
    ...(attributed ? {
      searchOrigin: buildProbabilitySearchOrigin({
        issueIds: [hashCanonical({ issue: tag })],
        semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
      }),
    } : {}),
  });
}

function evidence(tag: string, adverse = false, resolvedAt = "2026-08-02T06:00:00.000Z") {
  return listingRefs.map((listingRef) => ({
    listingRef,
    truthValue: adverse,
    resolvedAt,
    sourceRawHash: hashCanonical({ resolution: tag, listingRef }),
    protocolIdentity: `resolution:${listingRef}`,
  }));
}

describe("probability calibration desk", () => {
  it("records registered outcomes idempotently and exposes current calibration between milestones", () => {
    const bounds = [bound("one"), bound("two")];
    const desk = new ProbabilityCalibrationDesk({
      boundSource: () => bounds,
      now: () => "2026-08-03T00:00:00.000Z",
      minimumSampleSize: 2,
      snapshotInterval: 3,
    });
    expect(desk.projection()).toMatchObject({
      status: "EMPTY",
      registeredBoundCount: 2,
      pendingResolutionBoundCount: 2,
      observationCount: 0,
      snapshotCount: 0,
      nextSnapshotAtObservationCount: 1,
    });

    const first = desk.recordResolution({
      boundArtifactHash: bounds[0]!.artifactHash,
      resolutionEvidence: evidence("one"),
    });
    expect(first).toMatchObject({ idempotentReplay: false });
    expect(first.snapshot).not.toBeNull();
    expect(desk.recordResolution({
      boundArtifactHash: bounds[0]!.artifactHash,
      resolutionEvidence: evidence("one"),
    })).toMatchObject({ idempotentReplay: true });

    desk.recordResolution({
      boundArtifactHash: bounds[1]!.artifactHash,
      resolutionEvidence: evidence("two", true, "2026-08-02T07:00:00.000Z"),
    });
    expect(desk.projection()).toMatchObject({
      status: "MEASURED",
      observationCount: 2,
      adverseObservationCount: 1,
      snapshotCount: 1,
      measuredGroupCount: 2,
      insufficientGroupCount: 0,
      registeredObservedBoundCount: 2,
      pendingResolutionBoundCount: 0,
      nextSnapshotAtObservationCount: 3,
      executionAuthority: false,
    });
  });

  it("rejects unregistered, conflicting, and future-dated outcomes", () => {
    const registered = bound("registered");
    const desk = new ProbabilityCalibrationDesk({
      boundSource: () => [registered],
      now: () => "2026-08-03T00:00:00.000Z",
    });
    expect(() => desk.recordResolution({
      boundArtifactHash: bound("unknown").artifactHash,
      resolutionEvidence: evidence("unknown"),
    })).toThrow(/not uniquely registered/u);
    desk.recordResolution({
      boundArtifactHash: registered.artifactHash,
      resolutionEvidence: evidence("registered"),
    });
    expect(() => desk.recordResolution({
      boundArtifactHash: registered.artifactHash,
      resolutionEvidence: evidence("changed", true),
    })).toThrow(/different outcome/u);
    const futureBound = bound("future");
    const futureDesk = new ProbabilityCalibrationDesk({
      boundSource: () => [futureBound],
      now: () => "2026-08-03T00:00:00.000Z",
    });
    expect(() => futureDesk.recordResolution({
      boundArtifactHash: futureBound.artifactHash,
      resolutionEvidence: evidence("future", false, "2026-08-04T00:00:00.000Z"),
    })).toThrow(/future/u);
  });

  it("survives SQLite restart without duplicating observations or milestone snapshots", () => {
    const path = join(mkdtempSync(join(tmpdir(), "pmh-calibration-")), "state.sqlite");
    const registered = bound("durable", true);
    const firstStore = new SqliteOperationalStore(path);
    const firstDesk = new ProbabilityCalibrationDesk({
      boundSource: () => [registered],
      store: firstStore,
      now: () => "2026-08-03T00:00:00.000Z",
      snapshotInterval: 2,
    });
    const recorded = firstDesk.recordResolution({
      boundArtifactHash: registered.artifactHash,
      resolutionEvidence: evidence("durable"),
    });
    const currentHash = firstDesk.projection().currentArtifactHash;
    expect(recorded.snapshot?.artifactHash).toBe(currentHash);
    firstStore.close();

    const secondStore = new SqliteOperationalStore(path);
    const secondDesk = new ProbabilityCalibrationDesk({
      // The scheduler detail window may have rotated by settlement time. The
      // immutable registry must still admit idempotent historical replay.
      boundSource: () => [],
      store: secondStore,
      now: () => "2026-08-03T00:00:00.000Z",
      snapshotInterval: 2,
    });
    expect(secondDesk.projection()).toMatchObject({
      registeredAttributedBoundCount: 1,
      observationCount: 1,
      attributedObservationCount: 1,
      attributedGroupCount: 2,
      snapshotCount: 1,
      currentArtifactHash: currentHash,
      storage: {
        bounds: { mode: "SQLITE_WAL", durable: true, schemaVersion: 51 },
        observations: { mode: "SQLITE_WAL", durable: true, schemaVersion: 51 },
        snapshots: { mode: "SQLITE_WAL", durable: true, schemaVersion: 51 },
      },
    });
    expect(secondDesk.recordResolution({
      boundArtifactHash: registered.artifactHash,
      resolutionEvidence: evidence("durable"),
    })).toMatchObject({ idempotentReplay: true });
    expect(secondDesk.projection()).toMatchObject({ observationCount: 1, snapshotCount: 1 });
    secondStore.close();
  });
});
