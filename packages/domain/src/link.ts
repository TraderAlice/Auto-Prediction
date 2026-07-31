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

export function assertReviewBindsProposal(
  proposal: MarketLinkProposal,
  review: MarketLinkReview,
): void {
  if (review.proposalHash !== proposalHash(proposal)) {
    throw new Error("review does not bind the supplied proposal");
  }
  if (
    review.leftRuleHash !== proposal.leftRuleHash ||
    review.rightRuleHash !== proposal.rightRuleHash
  ) {
    throw new Error("review rule hashes do not match the proposal");
  }
}
