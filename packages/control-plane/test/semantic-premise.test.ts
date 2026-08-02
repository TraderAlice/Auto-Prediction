import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertPremiseBearingRelationArtifact,
  buildPremiseBearingRelationArtifact,
  bindSemanticBooleanExpression,
  bindSemanticExpressionTokens,
  buildSemanticConstraintArtifact,
  buildSemanticPremiseArtifact,
  type MarketRelationProposal,
  type SemanticConstraintDraft,
} from "../src/index.js";

const proposalScope = hashCanonical({ scope: "semantic-premise" });
const refs = ["market:shot", "market:cola", "market:fatal"] as const;
const proposalBody = {
  relationKind: "CONDITIONAL" as const,
  listingRefs: refs,
  statement: "A fatal August shooting excludes a September personal livestream.",
  rationale: "The fatality premise must be explicit and settlement-bound.",
  falsifiers: ["A non-fatal shooting followed by a September livestream."],
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
};
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({ proposalScope, ...proposalBody }),
});
const listings = refs.map((listingRef) => Object.freeze({
  listingRef,
  listingHash: hashCanonical({ listingRef }),
}));
const ruleEvidence = listings.map((item) => ({
  ...item,
  sourceRawHash: hashCanonical({ rules: item.listingRef }),
  protocolIdentity: `protocol:${item.listingRef}`,
}));

function constraint(): ReturnType<typeof buildSemanticConstraintArtifact> {
  const states: SemanticConstraintDraft["truthTable"] = [];
  for (let value = 0; value < 8; value += 1) {
    const truths = [Boolean(value & 4), Boolean(value & 2), Boolean(value & 1)];
    const allowed = !truths[2] || !truths[1];
    states.push({
      truths,
      disposition: allowed ? "FEASIBLE" : "IMPOSSIBLE",
      rationale: allowed
        ? "Fatality is absent or the later livestream is absent."
        : "Fatality and a later personal livestream cannot both occur.",
      evidenceListingRefs: [...refs],
    });
  }
  return buildSemanticConstraintArtifact({
    proposal,
    proposalCorpusSnapshotIdentity: proposalScope,
    evidenceCorpusSnapshotIdentity: proposalScope,
    draft: {
      classification: "HARD_SETTLEMENT_CONSTRAINT",
      relationKind: "CONDITIONAL",
      assumptions: [],
      counterexampleAttempt: {
        attempted: true,
        result: "NOT_FOUND",
        narrative: "The fatality and later-live joint state was challenged and rejected.",
        truths: [true, true, true],
      },
      truthTable: states,
      unresolvedEvidence: [],
    },
    listingEvidence: ruleEvidence,
  });
}

function premise(kind: "SETTLEMENT_INTRINSIC" | "TRADED_OUTCOME") {
  return buildSemanticPremiseArtifact({
    proposalId: proposal.proposalId,
    evidenceScopeIdentity: proposalScope,
    listings,
    draft: {
      proposition: "The August shooting is fatal or prevents a September appearance.",
      kind,
      truthPosture: kind === "SETTLEMENT_INTRINSIC" ? "PROVEN_IN_SCOPE" : "TRADED_VARIABLE",
      binding: {
        kind: "LISTING_TRUTH",
        listingRef: "market:fatal",
        truthValue: true,
      },
      evidenceClaimIds: [],
      rationale: "The premise is bound to the exact fatality market truth value.",
      counterexample: {
        attempted: true,
        result: "NOT_FOUND",
        narrative: "No world makes the bound fatality outcome true while the premise is false.",
      },
    },
  });
}

describe("premise-bearing semantic relations", () => {
  it("admits a traded premise only when its expression matches every exact state", () => {
    const traded = premise("TRADED_OUTCOME");
    const artifact = buildPremiseBearingRelationArtifact({
      constraint: constraint(),
      premises: [traded],
      expression: {
        op: "IMPLIES",
        left: { op: "PREMISE", premiseId: traded.premiseId },
        right: { op: "NOT", operand: { op: "LISTING", listingRef: "market:cola", equals: true } },
      },
    });

    expect(artifact).toMatchObject({
      classification: "CONDITIONAL_TRADED",
      expressionMatchesStateSpace: true,
      exactCompilerAdmission: "ELIGIBLE",
      blocker: null,
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(artifact.evaluatedStates).toHaveLength(8);
    expect(() => assertPremiseBearingRelationArtifact(artifact)).not.toThrow();
  });

  it("keeps an unbound causal fatality story research-only", () => {
    const causal = buildSemanticPremiseArtifact({
      proposalId: proposal.proposalId,
      evidenceScopeIdentity: proposalScope,
      listings,
      draft: {
        proposition: "Any August shooting is assumed fatal.",
        kind: "CAUSAL_HYPOTHESIS",
        truthPosture: "UNRESOLVED",
        binding: { kind: "NONE" },
        evidenceClaimIds: [],
        rationale: "The shooting market does not require fatality.",
        counterexample: {
          attempted: true,
          result: "INCONCLUSIVE",
          narrative: "A non-fatal shooting followed by recovery remains possible.",
        },
      },
    });
    const artifact = buildPremiseBearingRelationArtifact({
      constraint: constraint(),
      premises: [causal],
      expression: {
        op: "IMPLIES",
        left: { op: "PREMISE", premiseId: causal.premiseId },
        right: { op: "NOT", operand: { op: "LISTING", listingRef: "market:cola", equals: true } },
      },
    });

    expect(artifact).toMatchObject({
      classification: "CAUSAL_RESEARCH_ONLY",
      exactCompilerAdmission: "RESEARCH_ONLY",
      blocker: "PREMISE_RESEARCH_ONLY",
    });
    expect(artifact.evaluatedStates.every((state) => state.expressionValue === null)).toBe(true);
  });

  it("rejects a premise expression that disagrees with the retained truth table", () => {
    const intrinsic = premise("SETTLEMENT_INTRINSIC");
    const artifact = buildPremiseBearingRelationArtifact({
      constraint: constraint(),
      premises: [intrinsic],
      expression: {
        op: "AND",
        left: { op: "PREMISE", premiseId: intrinsic.premiseId },
        right: { op: "LISTING", listingRef: "market:cola", equals: true },
      },
    });

    expect(artifact).toMatchObject({
      expressionMatchesStateSpace: false,
      exactCompilerAdmission: "RESEARCH_ONLY",
      blocker: "EXPRESSION_STATE_MISMATCH",
    });
  });

  it("rejects cross-scope premise rebinding and rehashed authority escalation", () => {
    const traded = premise("TRADED_OUTCOME");
    const artifact = buildPremiseBearingRelationArtifact({
      constraint: constraint(),
      premises: [traded],
      expression: {
        op: "IMPLIES",
        left: { op: "PREMISE", premiseId: traded.premiseId },
        right: { op: "NOT", operand: { op: "LISTING", listingRef: "market:cola", equals: true } },
      },
    });
    const tampered = { ...artifact, certificateAuthority: true };
    const { artifactHash: _oldHash, ...body } = tampered;
    expect(() => assertPremiseBearingRelationArtifact({
      ...tampered,
      artifactHash: hashCanonical(body),
    })).toThrow(/contract/);
    expect(() => buildPremiseBearingRelationArtifact({
      constraint: constraint(),
      premises: [{ ...traded, evidenceScopeIdentity: hashCanonical({ other: true }) }],
      expression: artifact.expression,
    })).toThrow(/identity|lineage|contract/);
    const invalidPremiseBody = {
      ...traded,
      kind: "INVENTED_KIND",
      artifactHash: undefined,
    };
    const { artifactHash: _undefinedHash, ...invalidPremiseWithoutHash } = invalidPremiseBody;
    expect(() => buildPremiseBearingRelationArtifact({
      constraint: constraint(),
      premises: [{
        ...invalidPremiseWithoutHash,
        artifactHash: hashCanonical(invalidPremiseWithoutHash),
      } as typeof traded],
      expression: artifact.expression,
    })).toThrow(/contract/);
    const { artifactHash: _relationHash, ...relationBody } = artifact;
    const invalidRelationBody = { ...relationBody, blocker: "INVENTED_BLOCKER" };
    expect(() => assertPremiseBearingRelationArtifact({
      ...invalidRelationBody,
      artifactHash: hashCanonical(invalidRelationBody),
    })).toThrow(/contract/);
  });

  it("binds model-local premise keys into canonical content identities", () => {
    const traded = premise("TRADED_OUTCOME");
    const bound = bindSemanticBooleanExpression({
      listingRefs: refs,
      premiseIdsByKey: { fatality: traded.premiseId },
      expression: {
        op: "IMPLIES",
        left: { op: "PREMISE", premiseKey: "fatality" },
        right: { op: "NOT", operand: { op: "LISTING", listingRef: "market:cola", equals: true } },
      },
    });

    expect(bound).toMatchObject({
      op: "IMPLIES",
      left: { op: "PREMISE", premiseId: traded.premiseId },
    });
    expect(() => bindSemanticBooleanExpression({
      listingRefs: refs,
      premiseIdsByKey: { fatality: traded.premiseId },
      expression: {
        op: "IMPLIES",
        left: { op: "PREMISE", premiseKey: "invented" },
        right: { op: "LISTING", listingRef: "market:cola", equals: false },
      },
    })).toThrow(/out of scope/);
    expect(bindSemanticExpressionTokens({
      listingRefs: refs,
      premiseIdsByKey: { fatality: traded.premiseId },
      tokens: [
        { op: "PREMISE", premiseKey: "fatality" },
        { op: "LISTING", listingRef: "market:cola", equals: true },
        { op: "NOT" },
        { op: "IMPLIES" },
      ],
    })).toEqual(bound);
  });
});
