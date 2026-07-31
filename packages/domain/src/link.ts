import { z } from "zod";
import { hashCanonical, type Hash } from "./identity.js";

const HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const IdentifierSchema = z.string().trim().min(1);

export const EquivalenceGradeSchema = z.enum([
  "EXACT",
  "CONDITIONAL",
  "RELATED",
  "CONFLICTING",
  "UNREVIEWED",
]);

export const MarketLinkProposalSchema = z.object({
  id: IdentifierSchema,
  grade: z.literal("UNREVIEWED"),
  leftListingId: IdentifierSchema,
  rightListingId: IdentifierSchema,
  leftRuleHash: HashSchema,
  rightRuleHash: HashSchema,
  proposedOutcomeMapping: z.record(IdentifierSchema, IdentifierSchema).readonly(),
  differenceSummary: z.array(z.string().min(1)).readonly(),
  proposedAt: z.iso.datetime({ offset: true }),
  proposerIdentity: IdentifierSchema,
});

export const MarketLinkReviewSchema = z.object({
  id: IdentifierSchema,
  proposalHash: HashSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  grade: z.enum(["EXACT", "CONDITIONAL", "RELATED", "CONFLICTING"]),
  reviewerAuthority: IdentifierSchema,
  reviewedAt: z.iso.datetime({ offset: true }),
  leftRuleHash: HashSchema,
  rightRuleHash: HashSchema,
  outcomeMappingHash: HashSchema,
  timingAssessment: z.string().min(1),
  voidAssessment: z.string().min(1),
  resolutionSourceAssessment: z.string().min(1),
  rationale: z.string().min(1),
});

export type EquivalenceGrade = z.infer<typeof EquivalenceGradeSchema>;
export type MarketLinkProposal = z.infer<typeof MarketLinkProposalSchema>;
export type MarketLinkReview = z.infer<typeof MarketLinkReviewSchema>;

export function proposalHash(proposal: MarketLinkProposal): Hash {
  return hashCanonical(MarketLinkProposalSchema.parse(proposal));
}

export function marketLinkReviewHash(review: MarketLinkReview): Hash {
  return hashCanonical(MarketLinkReviewSchema.parse(review));
}

export function assertReviewBindsProposal(
  proposal: MarketLinkProposal,
  review: MarketLinkReview,
): void {
  const parsedProposal = MarketLinkProposalSchema.parse(proposal);
  const parsedReview = MarketLinkReviewSchema.parse(review);
  if (parsedReview.proposalHash !== proposalHash(parsedProposal)) {
    throw new Error("review does not bind the supplied proposal");
  }
  if (
    parsedReview.leftRuleHash !== parsedProposal.leftRuleHash ||
    parsedReview.rightRuleHash !== parsedProposal.rightRuleHash
  ) {
    throw new Error("review rule hashes do not match the proposal");
  }
  if (
    parsedReview.outcomeMappingHash !==
    hashCanonical(parsedProposal.proposedOutcomeMapping)
  ) {
    throw new Error("review outcome mapping does not match the proposal");
  }
  if (parsedReview.reviewerAuthority === parsedProposal.proposerIdentity) {
    throw new Error("market-link review must be independent of its proposer");
  }
  if (
    Date.parse(parsedReview.reviewedAt) < Date.parse(parsedProposal.proposedAt)
  ) {
    throw new Error("market-link review predates its proposal");
  }
}
