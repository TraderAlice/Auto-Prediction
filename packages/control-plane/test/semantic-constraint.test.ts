import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertSemanticConstraintArtifact,
  buildSemanticConstraintArtifact,
  inspectSemanticConstraintAdmission,
  type MarketRelationProposal,
  type SemanticConstraintDraft,
} from "../src/index.js";

const corpus = hashCanonical({ corpus: "semantic-constraint" });
const listingRefs = ["venue-a:august-event", "venue-b:september-live"] as const;
const proposalBody = {
  relationKind: "MUTUALLY_EXCLUSIVE" as const,
  listingRefs,
  statement: "The August event prevents the September live appearance.",
  rationale: "Candidate temporal exclusion for adversarial review.",
  falsifiers: ["The August event is non-fatal and the person later appears live."],
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
};
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({ corpusSnapshotIdentity: corpus, ...proposalBody }),
});
const evidence = listingRefs.map((listingRef) => ({
  listingRef,
  listingHash: hashCanonical({ listingRef }),
  sourceRawHash: hashCanonical({ rules: listingRef }),
  protocolIdentity: `protocol:${listingRef}`,
}));

function draft(
  classification: SemanticConstraintDraft["classification"],
  ttDisposition: "FEASIBLE" | "IMPOSSIBLE",
  result: "FOUND" | "NOT_FOUND",
): SemanticConstraintDraft {
  return {
    classification,
    relationKind: "MUTUALLY_EXCLUSIVE",
    assumptions: classification === "HARD_SETTLEMENT_CONSTRAINT"
      ? []
      : ["A shooting is assumed fatal, but the supplied rule does not say so."],
    counterexampleAttempt: {
      attempted: true,
      result,
      narrative: result === "FOUND"
        ? "A non-fatal August shooting and a September live cola appearance can both settle Yes."
        : "Tried the both-true state; explicit death before September makes a personal live appearance impossible.",
      truths: [true, true],
    },
    truthTable: [
      { truths: [false, false], disposition: "FEASIBLE", rationale: "Neither may occur.", evidenceListingRefs: [...listingRefs] },
      { truths: [false, true], disposition: "FEASIBLE", rationale: "Only the later appearance may occur.", evidenceListingRefs: [...listingRefs] },
      { truths: [true, false], disposition: "FEASIBLE", rationale: "Only the August event may occur.", evidenceListingRefs: [...listingRefs] },
      { truths: [true, true], disposition: ttDisposition, rationale: "The disputed joint state.", evidenceListingRefs: [...listingRefs] },
    ],
    unresolvedEvidence: classification === "HARD_SETTLEMENT_CONSTRAINT"
      ? []
      : ["The shooting contract does not require death."],
  };
}

describe("semantic constraint proof objects", () => {
  it("downgrades the shooting/cola example when a non-fatal counterexample survives", () => {
    const artifact = buildSemanticConstraintArtifact({
      proposal,
      proposalCorpusSnapshotIdentity: corpus,
      evidenceCorpusSnapshotIdentity: corpus,
      draft: draft("PROBABILISTIC_DEPENDENCE", "FEASIBLE", "FOUND"),
      listingEvidence: evidence,
    });

    expect(artifact).toMatchObject({
      classification: "PROBABILISTIC_DEPENDENCE",
      exactCompilerAdmission: "RESEARCH_ONLY",
      counterexampleAttempt: { result: "FOUND", stateId: "TT" },
    });
    expect(inspectSemanticConstraintAdmission(artifact).blocker).toBe(
      "NOT_HARD_CONSTRAINT",
    );
  });

  it("admits a hash-bound complete matrix for explicit fatality versus later live appearance", () => {
    const artifact = buildSemanticConstraintArtifact({
      proposal,
      proposalCorpusSnapshotIdentity: corpus,
      evidenceCorpusSnapshotIdentity: corpus,
      draft: draft("HARD_SETTLEMENT_CONSTRAINT", "IMPOSSIBLE", "NOT_FOUND"),
      listingEvidence: evidence,
    });

    expect(artifact).toMatchObject({
      schemaVersion: "pmh.semantic-constraint-proposal.v3",
      exactCompilerAdmission: "ELIGIBLE",
      authority: "PROPOSE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(artifact.truthTable).toHaveLength(4);
    expect(() => assertSemanticConstraintArtifact(artifact)).not.toThrow();
  });

  it("requires rule citations on impossible states without rewriting v2 replay", () => {
    const input = draft("HARD_SETTLEMENT_CONSTRAINT", "IMPOSSIBLE", "NOT_FOUND");
    const artifact = buildSemanticConstraintArtifact({
      proposal,
      proposalCorpusSnapshotIdentity: corpus,
      evidenceCorpusSnapshotIdentity: corpus,
      draft: {
        ...input,
        truthTable: input.truthTable.map((state) =>
          state.disposition === "IMPOSSIBLE"
            ? { ...state, evidenceListingRefs: [] }
            : state
        ),
      },
      listingEvidence: evidence,
    });

    expect(artifact.exactCompilerAdmission).toBe("RESEARCH_ONLY");
    expect(inspectSemanticConstraintAdmission(artifact)).toMatchObject({
      blocker: "MISSING_STATE_RULE_EVIDENCE",
    });

    const { artifactHash: _currentHash, ...currentBody } = artifact;
    const legacyBody = {
      ...currentBody,
      schemaVersion: "pmh.semantic-constraint-proposal.v2" as const,
      exactCompilerAdmission: "ELIGIBLE" as const,
    };
    const legacy = { ...legacyBody, artifactHash: hashCanonical(legacyBody) };
    expect(() => assertSemanticConstraintArtifact(legacy)).not.toThrow();
  });

  it("keeps a hard-looking matrix research-only when fatality is only a prose assumption", () => {
    const input = draft("HARD_SETTLEMENT_CONSTRAINT", "IMPOSSIBLE", "NOT_FOUND");
    const artifact = buildSemanticConstraintArtifact({
      proposal,
      proposalCorpusSnapshotIdentity: corpus,
      evidenceCorpusSnapshotIdentity: corpus,
      draft: {
        ...input,
        assumptions: ["The August event is assumed fatal even though the market only says shooting."],
      },
      listingEvidence: evidence,
    });

    expect(artifact).toMatchObject({
      exactCompilerAdmission: "RESEARCH_ONLY",
      assumptions: ["The August event is assumed fatal even though the market only says shooting."],
    });
    expect(inspectSemanticConstraintAdmission(artifact)).toMatchObject({
      blocker: "UNVERIFIED_ASSUMPTION",
    });
  });

  it("replays historical v1 assumption semantics without rewriting the artifact", () => {
    const current = buildSemanticConstraintArtifact({
      proposal,
      proposalCorpusSnapshotIdentity: corpus,
      evidenceCorpusSnapshotIdentity: corpus,
      draft: {
        ...draft("HARD_SETTLEMENT_CONSTRAINT", "IMPOSSIBLE", "NOT_FOUND"),
        assumptions: ["Historical prose assumption."],
      },
      listingEvidence: evidence,
    });
    const { artifactHash: _currentHash, ...currentBody } = current;
    const legacyBody = {
      ...currentBody,
      schemaVersion: "pmh.semantic-constraint-proposal.v1" as const,
      exactCompilerAdmission: "ELIGIBLE" as const,
    };
    const legacy = {
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    };

    expect(() => assertSemanticConstraintArtifact(legacy)).not.toThrow();
    expect(inspectSemanticConstraintAdmission(legacy)).toMatchObject({
      status: "ELIGIBLE",
      blocker: null,
    });
  });

  it("rejects rehashed authority escalation", () => {
    const artifact = buildSemanticConstraintArtifact({
      proposal,
      proposalCorpusSnapshotIdentity: corpus,
      evidenceCorpusSnapshotIdentity: corpus,
      draft: draft("HARD_SETTLEMENT_CONSTRAINT", "IMPOSSIBLE", "NOT_FOUND"),
      listingEvidence: evidence,
    });
    const tampered = { ...artifact, certificateAuthority: true };
    const { artifactHash: _oldHash, ...body } = tampered;
    expect(() => assertSemanticConstraintArtifact({
      ...tampered,
      artifactHash: hashCanonical(body),
    })).toThrow(/authority/);
  });
});
