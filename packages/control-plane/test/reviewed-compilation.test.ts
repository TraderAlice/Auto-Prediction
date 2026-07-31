import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildReviewedCompilationEvidence,
  buildReviewedCompilationFixture,
  compileReviewedHypothesis,
} from "../src/index.js";

function compile(
  overrides: Partial<Parameters<typeof compileReviewedHypothesis>[0]> = {},
) {
  const fixture = buildReviewedCompilationFixture();
  return compileReviewedHypothesis({
    hypothesis: fixture.hypothesis,
    hypothesisReview: fixture.hypothesisReview,
    marketLinks: fixture.marketLinks,
    candidateTemplate: fixture.candidateTemplate,
    capitalLimits: fixture.capitalLimits,
    currentState: fixture.currentState,
    ...overrides,
  });
}

describe("reviewed hypothesis compilation", () => {
  it("binds independent review, compiles capital-bounded legs, and certifies exactly", () => {
    const artifact = compile();
    expect(artifact.certificate.legs.map((leg) => leg.quantity)).toEqual([
      200_000_000n,
      200_000_000n,
    ]);
    expect(artifact.certificate.worstCaseAfterFees).toBe(20_000_000n);
    expect(artifact.certificate.payoffByResolution).toEqual({
      no: 20_000_000n,
      yes: 20_000_000n,
    });
    expect(artifact.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
    expect(artifact.artifactHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("emits deterministic JSON-safe qualification evidence", () => {
    const first = buildReviewedCompilationEvidence();
    const second = buildReviewedCompilationEvidence();
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      scope: "SYNTHETIC_ARCHITECTURE_QUALIFICATION",
      status: "PASS",
      certificate: {
        worstCaseAfterFees: "20000000",
        legCount: 2,
        resolutionStateCount: 2,
      },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(() => JSON.stringify(first)).not.toThrow();
  });

  it("matches the checked-in immutable qualification artifact", async () => {
    const artifactPath = resolve(
      import.meta.dirname,
      "../../../projects/campaigns/architecture-qualification/reviewed-compilation.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(buildReviewedCompilationEvidence()).toEqual(expected);
  });

  it("rejects a worker that reviews its own hypothesis", () => {
    const fixture = buildReviewedCompilationFixture();
    expect(() =>
      compile({
        hypothesisReview: {
          ...fixture.hypothesisReview,
          reviewerAuthority: fixture.hypothesis.workerId,
        },
      }),
    ).toThrow(/independent/);
  });

  it("rejects a review that omits or substitutes market-link evidence", () => {
    const fixture = buildReviewedCompilationFixture();
    expect(() =>
      compile({
        hypothesisReview: {
          ...fixture.hypothesisReview,
          marketLinkReviewHashes: [hashCanonical({ forged: true })],
        },
      }),
    ).toThrow(/exact market-link set/);
  });

  it("rejects non-exact or rejected semantic links", () => {
    const fixture = buildReviewedCompilationFixture();
    const [link] = fixture.marketLinks;
    expect(link).toBeDefined();
    expect(() =>
      compile({
        marketLinks: [
          {
            proposal: link!.proposal,
            review: { ...link!.review, grade: "CONDITIONAL" },
          },
        ],
      }),
    ).toThrow(/accepted exact/);
  });

  it("rejects candidate listings or venues outside the reviewed graph", () => {
    const fixture = buildReviewedCompilationFixture();
    expect(() =>
      compile({
        candidateTemplate: {
          ...fixture.candidateTemplate,
          legs: [
            {
              ...fixture.candidateTemplate.legs[0]!,
              venueId: "fixture-unreviewed",
            },
            fixture.candidateTemplate.legs[1]!,
          ],
        },
      }),
    ).toThrow(/venue outside/);
  });

  it("rejects candidate rules or partitions that differ from reviewed links", () => {
    const fixture = buildReviewedCompilationFixture();
    expect(() =>
      compile({
        candidateTemplate: {
          ...fixture.candidateTemplate,
          legs: [
            {
              ...fixture.candidateTemplate.legs[0]!,
              listingRuleHash: hashCanonical({ substituted: "rule" }),
            },
            fixture.candidateTemplate.legs[1]!,
          ],
        },
      }),
    ).toThrow(/rule identity differs/);

    expect(() =>
      compile({
        candidateTemplate: {
          ...fixture.candidateTemplate,
          resolutionStateIds: ["yes", "no", "void"],
        },
      }),
    ).toThrow(/exact partition/);
  });

  it("rejects stale book identity after deterministic compilation", () => {
    const fixture = buildReviewedCompilationFixture();
    const changedBooks = new Map(fixture.currentState.bookStateHashByListingId);
    changedBooks.set(
      fixture.candidateTemplate.legs[0]!.listingId,
      hashCanonical({ changed: "book-state" }),
    );
    expect(() =>
      compile({
        currentState: {
          ...fixture.currentState,
          bookStateHashByListingId: changedBooks,
        },
      }),
    ).toThrow(/book state identity changed/);
  });

  it("rejects a candidate whose conservative floor is not profitable", () => {
    const fixture = buildReviewedCompilationFixture();
    const expensive = {
      ...fixture.candidateTemplate,
      legs: fixture.candidateTemplate.legs.map((leg, index) => ({
        ...leg,
        unitPrice: index === 0 ? 60_000_000n : 50_000_000n,
        maxQuantity: 100_000_000n,
      })),
    };
    expect(() => compile({ candidateTemplate: expensive })).toThrow(
      /strictly positive/,
    );
  });
});
