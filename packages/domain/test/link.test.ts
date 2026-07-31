import { describe, expect, it } from "vitest";
import {
  assertReviewBindsProposal,
  hashCanonical,
  marketLinkReviewHash,
  proposalHash,
  type MarketLinkProposal,
  type MarketLinkReview,
} from "../src/index.js";

const proposal: MarketLinkProposal = {
  id: "link:fixture-a-b",
  grade: "UNREVIEWED",
  leftListingId: "listing:fixture-a",
  rightListingId: "listing:fixture-b",
  leftRuleHash: hashCanonical({ rule: "a" }),
  rightRuleHash: hashCanonical({ rule: "b" }),
  proposedOutcomeMapping: { no: "no", yes: "yes" },
  differenceSummary: ["Qualification fixture only."],
  proposedAt: "2026-07-31T00:00:00.000Z",
  proposerIdentity: "fixture-scout",
};

function review(
  overrides: Partial<MarketLinkReview> = {},
): MarketLinkReview {
  return {
    id: "review:fixture-a-b",
    proposalHash: proposalHash(proposal),
    decision: "ACCEPT",
    grade: "EXACT",
    reviewerAuthority: "qualification-reviewer",
    reviewedAt: "2026-07-31T00:01:00.000Z",
    leftRuleHash: proposal.leftRuleHash,
    rightRuleHash: proposal.rightRuleHash,
    outcomeMappingHash: hashCanonical(proposal.proposedOutcomeMapping),
    timingAssessment: "Identical synthetic close time.",
    voidAssessment: "Identical synthetic void rule.",
    resolutionSourceAssessment: "Identical synthetic source.",
    rationale: "Accepted for architecture qualification only.",
    ...overrides,
  };
}

describe("market-link review binding", () => {
  it("binds the proposal, both rules, the mapping, and independent authority", () => {
    expect(() => assertReviewBindsProposal(proposal, review())).not.toThrow();
    expect(marketLinkReviewHash(review())).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects a substituted outcome mapping", () => {
    expect(() =>
      assertReviewBindsProposal(
        { ...proposal, proposedOutcomeMapping: { no: "yes", yes: "no" } },
        review(),
      ),
    ).toThrow(/proposal|mapping/);
  });

  it("rejects self-review", () => {
    expect(() =>
      assertReviewBindsProposal(
        proposal,
        review({ reviewerAuthority: proposal.proposerIdentity }),
      ),
    ).toThrow(/independent/);
  });

  it("rejects a review timestamp before the proposal", () => {
    expect(() =>
      assertReviewBindsProposal(
        proposal,
        review({ reviewedAt: "2026-07-30T23:59:59.000Z" }),
      ),
    ).toThrow(/predates/);
  });
});
