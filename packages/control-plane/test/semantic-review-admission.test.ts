import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  assertSemanticReviewAdmissionRecord,
  buildSemanticReviewAdmissionProjection,
  classifySemanticReviewAdmission,
  type MarketRelationKind,
  type MarketRelationProposal,
} from "../src/index.js";

function proposal(
  key: string,
  relationKind: MarketRelationKind,
  listingRefs: readonly string[] = ["alpha:yes", "beta:yes"],
): MarketRelationProposal {
  return Object.freeze({
    proposalId: hashCanonical({ proposal: key }),
    relationKind,
    listingRefs: Object.freeze([...listingRefs]),
    statement: `${key} statement`,
    rationale: `${key} rationale`,
    falsifiers: Object.freeze([]),
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  });
}

describe("semantic review admission", () => {
  it("admits exact two-listing compilable relations without granting authority", () => {
    const admission = classifySemanticReviewAdmission(
      proposal("equivalent", "EQUIVALENT"),
    );
    expect(admission).toMatchObject({
      lane: "AUTO_ARBITRAGE_REVIEW",
      reason: "TWO_LISTING_COMPILABLE_RELATION",
      manualReviewAvailable: true,
      modelConfidenceUsed: false,
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(admission.artifactHash).toMatch(/^sha256:/u);
  });

  it("keeps non-compilable relations and unsupported arity research-only", () => {
    expect(classifySemanticReviewAdmission(
      proposal("related", "RELATED"),
    )).toMatchObject({ lane: "RESEARCH_ONLY", reason: "NON_COMPILABLE_RELATION" });
    expect(classifySemanticReviewAdmission(
      proposal("partition", "EXHAUSTIVE", ["a:yes", "b:yes", "c:yes"]),
    )).toMatchObject({ lane: "RESEARCH_ONLY", reason: "LISTING_ARITY_UNSUPPORTED" });
    expect(classifySemanticReviewAdmission(
      proposal("duplicate", "IMPLIES", ["a:yes", "a:yes"]),
    )).toMatchObject({ lane: "RESEARCH_ONLY", reason: "DUPLICATE_LISTING_REF" });
  });

  it("projects a deduplicated deterministic admission funnel", () => {
    const proposals = [
      proposal("implication", "IMPLIES"),
      proposal("related", "RELATED"),
      proposal("partition", "EXHAUSTIVE", ["a:yes", "b:yes", "c:yes"]),
    ];
    const left = buildSemanticReviewAdmissionProjection(proposals);
    const right = buildSemanticReviewAdmissionProjection([...proposals].reverse());
    expect(left).toEqual(right);
    expect(left).toMatchObject({
      candidateCount: 3,
      autoReviewCount: 1,
      researchOnlyCount: 2,
      autoReviewRateBps: 3_333,
      countsByReason: {
        TWO_LISTING_COMPILABLE_RELATION: 1,
        NON_COMPILABLE_RELATION: 1,
        LISTING_ARITY_UNSUPPORTED: 1,
        DUPLICATE_LISTING_REF: 0,
      },
      modelConfidenceUsed: false,
      authority: "AUTOMATIC_REVIEW_ADMISSION_ONLY",
    });
    expect(left.contentHash).toMatch(/^sha256:/u);
  });

  it("rejects a tampered admission record", () => {
    const valid = classifySemanticReviewAdmission(proposal("tamper", "SUBSET"));
    expect(() => assertSemanticReviewAdmissionRecord({
      ...valid,
      lane: "RESEARCH_ONLY",
    })).toThrow(/contract|inconsistent/u);
  });
});
