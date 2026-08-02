import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  MarketArchaeologistProjection,
  MarketRelationKind,
  MarketRelationProposal,
} from "./market-archaeologist.js";
import {
  assertResearchSemanticDecision,
  type ResearchSemanticDecision,
} from "./opportunity-lifecycle-desk.js";
import {
  assertSemanticReviewRecord,
  type SemanticReviewRecord,
} from "./semantic-review.js";
import {
  assertSemanticConstraintArtifact,
  inspectSemanticConstraintAdmission,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const COMPILABLE_RELATIONS = Object.freeze([
  "EQUIVALENT",
  "IMPLIES",
  "SUBSET",
  "MUTUALLY_EXCLUSIVE",
  "EXHAUSTIVE",
] as const);

export type CompilableRelation = (typeof COMPILABLE_RELATIONS)[number];

export type RelationPayoffReadiness = Readonly<{
  status: "READY" | "BLOCKED";
  relationKind: MarketRelationKind;
  blocker:
    | null
    | "LISTING_ARITY_UNSUPPORTED"
    | "RELATION_CHANGED"
    | "RELATION_UNSUPPORTED"
    | "SEMANTIC_CONSTRAINT_UNAVAILABLE"
    | "SEMANTIC_CONSTRAINT_RESEARCH_ONLY"
    | "TRADING_BINDING_UNAVAILABLE";
  diagnostic: string | null;
}>;

export type RelationTruthState = Readonly<{
  stateId: string;
  truthByListingRef: Readonly<Record<string, boolean>>;
}>;

export type RelationPayoffPortfolio = Readonly<{
  portfolioId: Hash;
  label: string;
  legs: readonly Readonly<{
    legId: string;
    listingRef: string;
    outcome: "TRUE" | "FALSE";
  }>[];
  payoutUnitsByState: Readonly<Record<string, number | string>>;
  minimumPayoutUnits: number | string;
}>;

export type ResearchRelationPayoffQualification = Readonly<{
  schemaVersion: "pmh.research-relation-payoff.v1" | "pmh.research-relation-payoff.v2";
  semanticConstraintArtifactHash?: Hash;
  artifactHash: Hash;
  opportunityId: string;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  semanticDecisionId: Hash;
  relationKind: MarketRelationKind;
  status: "SIMULATION_TEMPLATE_READY" | "BLOCKED";
  diagnostic: string | null;
  listingBindings: readonly Readonly<{
    position: "LEFT" | "RIGHT";
    listingRef: string;
    listingHash: Hash;
    venueId: string;
    venueInstrumentId: string;
    priceScale: string;
    quantityScale: string;
    minPriceTick: string | null;
    trueOutcome: Readonly<{ venueOutcomeId: string; label: string }>;
    falseOutcome: Readonly<{ venueOutcomeId: string; label: string }>;
  }>[];
  canonicalStates: readonly RelationTruthState[];
  portfolios: readonly RelationPayoffPortfolio[];
  authority: "DETERMINISTIC_RESEARCH_COMPILER";
  verifierEligible: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type RelationPayoffProjection = Readonly<{
  schemaVersion: "pmh.relation-payoff-desk.v1";
  qualificationCount: number;
  sourceDecisionCount: number;
  unresolvedInputCount: number;
  readyCount: number;
  blockedCount: number;
  qualifications: readonly ResearchRelationPayoffQualification[];
  supportedRelations: readonly CompilableRelation[];
  arithmetic: "SYMBOLIC_INTEGER_PAYOUT_UNITS";
  authority: "DETERMINISTIC_RESEARCH_COMPILER";
  verifierEligible: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function allowedTruths(
  relation: CompilableRelation,
): readonly Readonly<{ left: boolean; right: boolean }>[] {
  const all = Object.freeze([
    Object.freeze({ left: false, right: false }),
    Object.freeze({ left: false, right: true }),
    Object.freeze({ left: true, right: false }),
    Object.freeze({ left: true, right: true }),
  ]);
  switch (relation) {
    case "EQUIVALENT":
      return all.filter((state) => state.left === state.right);
    case "IMPLIES":
    case "SUBSET":
      return all.filter((state) => !state.left || state.right);
    case "MUTUALLY_EXCLUSIVE":
      return all.filter((state) => !state.left || !state.right);
    case "EXHAUSTIVE":
      return all.filter((state) => state.left || state.right);
  }
}

export function relationPortfolioOutcomes(
  relation: CompilableRelation,
): readonly Readonly<{
  label: string;
  left: "TRUE" | "FALSE";
  right: "TRUE" | "FALSE";
}>[] {
  switch (relation) {
    case "EQUIVALENT":
      return Object.freeze([
        Object.freeze({ label: "Left true + right false", left: "TRUE", right: "FALSE" }),
        Object.freeze({ label: "Left false + right true", left: "FALSE", right: "TRUE" }),
      ]);
    case "IMPLIES":
    case "SUBSET":
      return Object.freeze([
        Object.freeze({ label: "Left false + right true", left: "FALSE", right: "TRUE" }),
      ]);
    case "MUTUALLY_EXCLUSIVE":
      return Object.freeze([
        Object.freeze({ label: "Left false + right false", left: "FALSE", right: "FALSE" }),
      ]);
    case "EXHAUSTIVE":
      return Object.freeze([
        Object.freeze({ label: "Left true + right true", left: "TRUE", right: "TRUE" }),
      ]);
  }
}

export function inspectRelationPayoffReadiness(input: {
  opportunityId: string;
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
}): RelationPayoffReadiness {
  const review = assertSemanticReviewRecord(input.review);
  if (
    input.opportunityId !== `ai:${input.proposal.proposalId}` ||
    review.status !== "PASS" ||
    review.report === null ||
    review.opportunityId !== input.opportunityId ||
    review.proposalId !== input.proposal.proposalId
  ) {
    throw new Error("relation payoff readiness input is stale or incomplete");
  }
  const conclusion = review.report.result.relationConclusion;
  if (
    input.proposal.listingRefs.length !== 2 ||
    new Set(input.proposal.listingRefs).size !== 2
  ) {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "LISTING_ARITY_UNSUPPORTED",
      diagnostic: "Only a two-listing binary relation has a deterministic payoff template.",
    });
  }
  if (conclusion !== input.proposal.relationKind) {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "RELATION_CHANGED",
      diagnostic: "The reviewer changed the relation kind; an operator-authored exact scope is required.",
    });
  }
  const constraint = review.report.result.semanticConstraint;
  if (constraint === undefined) {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "SEMANTIC_CONSTRAINT_UNAVAILABLE",
      diagnostic: "The retained review predates the explicit semantic state matrix; rerun review with the Agent tool protocol.",
    });
  }
  const admission = inspectSemanticConstraintAdmission(
    assertSemanticConstraintArtifact(constraint),
  );
  if (admission.status !== "ELIGIBLE") {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "SEMANTIC_CONSTRAINT_RESEARCH_ONLY",
      diagnostic: admission.diagnostic,
    });
  }
  const bindingDiagnostic = tradingBindingDiagnostic(input.proposal, review);
  if (bindingDiagnostic !== null) {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "TRADING_BINDING_UNAVAILABLE",
      diagnostic: bindingDiagnostic,
    });
  }
  return Object.freeze({
    status: "READY",
    relationKind: conclusion,
    blocker: null,
    diagnostic: null,
  });
}

function payoutFor(
  truth: boolean,
  outcome: "TRUE" | "FALSE",
): bigint {
  return truth === (outcome === "TRUE") ? 1n : 0n;
}

function canonicalOutcomePair(
  outcomes: readonly Readonly<{ venueOutcomeId: string; label: string }>[],
): Readonly<{
  trueOutcome: Readonly<{ venueOutcomeId: string; label: string }>;
  falseOutcome: Readonly<{ venueOutcomeId: string; label: string }>;
}> | null {
  const trueOutcome = outcomes.find((outcome) =>
    ["yes", "up"].includes(outcome.label.trim().toLowerCase()),
  );
  const falseOutcome = outcomes.find((outcome) =>
    ["no", "down"].includes(outcome.label.trim().toLowerCase()),
  );
  return trueOutcome === undefined || falseOutcome === undefined
    ? null
    : Object.freeze({ trueOutcome, falseOutcome });
}

function tradingBindingDiagnostic(
  proposal: MarketRelationProposal,
  review: SemanticReviewRecord,
): string | null {
  const evidence = review.report!.input.listingEvidence;
  for (const listingRef of proposal.listingRefs) {
    const listing = evidence.find((item) => item.listingRef === listingRef);
    if (
      listing === undefined ||
      listing.venueId === undefined ||
      listing.venueInstrumentId === undefined ||
      listing.outcomes === undefined ||
      listing.priceScale === undefined ||
      listing.quantityScale === undefined ||
      listing.minPriceTick === undefined
    ) {
      return "The retained review predates outcome-instrument and fixed-point bindings; rerun review on the current corpus.";
    }
    if (canonicalOutcomePair(listing.outcomes) === null) {
      return "The binary outcomes are not a canonical Yes/No or Up/Down pair; an operator-authored truth mapping is required.";
    }
  }
  return null;
}

function compileReadyBody(input: {
  opportunityId: string;
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
  decision: ResearchSemanticDecision;
  relation: MarketRelationKind;
  constraint: SemanticConstraintArtifact;
}): Omit<ResearchRelationPayoffQualification, "artifactHash"> {
  const report = input.review.report!;
  const [leftRef, rightRef] = input.proposal.listingRefs;
  if (leftRef === undefined || rightRef === undefined) {
    throw new Error("binary relation compiler requires two listing references");
  }
  const evidenceByRef = new Map(
    report.input.listingEvidence.map((item) => [item.listingRef, item] as const),
  );
  const leftEvidence = evidenceByRef.get(leftRef);
  const rightEvidence = evidenceByRef.get(rightRef);
  if (leftEvidence === undefined || rightEvidence === undefined) {
    throw new Error("relation compiler evidence does not cover both listings");
  }
  const leftOutcomes = canonicalOutcomePair(leftEvidence.outcomes!);
  const rightOutcomes = canonicalOutcomePair(rightEvidence.outcomes!);
  if (leftOutcomes === null || rightOutcomes === null) {
    throw new Error("relation compiler outcome truth mapping is unavailable");
  }
  const states = Object.freeze(input.constraint.truthTable
    .filter((state) => state.disposition === "FEASIBLE")
    .map((state) => Object.freeze({
      stateId: state.stateId,
      truthByListingRef: state.truthByListingRef,
    })));
  const outcomePairs = Object.freeze([
    Object.freeze({ label: "Left true + right true", left: "TRUE" as const, right: "TRUE" as const }),
    Object.freeze({ label: "Left true + right false", left: "TRUE" as const, right: "FALSE" as const }),
    Object.freeze({ label: "Left false + right true", left: "FALSE" as const, right: "TRUE" as const }),
    Object.freeze({ label: "Left false + right false", left: "FALSE" as const, right: "FALSE" as const }),
  ]);
  const portfolios = Object.freeze(
    outcomePairs.flatMap((portfolio) => {
      const legs = Object.freeze([
        Object.freeze({ legId: "left", listingRef: leftRef, outcome: portfolio.left }),
        Object.freeze({ legId: "right", listingRef: rightRef, outcome: portfolio.right }),
      ]);
      const payoutUnitsByStateBigInt = Object.freeze(
        Object.fromEntries(
          states.map((state) => [
            state.stateId,
            payoutFor(state.truthByListingRef[leftRef]!, portfolio.left) +
              payoutFor(state.truthByListingRef[rightRef]!, portfolio.right),
          ]),
        ),
      );
      const payoutValues = Object.values(payoutUnitsByStateBigInt);
      const minimumPayoutUnits = payoutValues.reduce(
        (minimum, value) => value < minimum ? value : minimum,
      );
      if (minimumPayoutUnits < 1n) return [];
      const payoutUnitsByState = Object.freeze(Object.fromEntries(
        Object.entries(payoutUnitsByStateBigInt).map(([state, payout]) => [state, payout.toString()]),
      ));
      const identityBody = {
        relation: input.relation,
        semanticDecisionId: input.decision.decisionId,
        label: portfolio.label,
        legs,
        payoutUnitsByState,
      };
      return Object.freeze({
        portfolioId: hashCanonical(identityBody),
        label: portfolio.label,
        legs,
        payoutUnitsByState,
        minimumPayoutUnits: minimumPayoutUnits.toString(),
      });
    }),
  );
  if (portfolios.length === 0) {
    throw new Error("compiled relation portfolio does not preserve one payout unit");
  }
  return Object.freeze({
    schemaVersion: "pmh.research-relation-payoff.v2" as const,
    semanticConstraintArtifactHash: input.constraint.artifactHash,
    opportunityId: input.opportunityId,
    proposalId: input.proposal.proposalId,
    semanticReviewArtifactHash: report.artifactHash,
    semanticDecisionId: input.decision.decisionId,
    relationKind: input.relation,
    status: "SIMULATION_TEMPLATE_READY" as const,
    diagnostic: null,
    listingBindings: Object.freeze([
      Object.freeze({
        position: "LEFT" as const,
        listingRef: leftRef,
        listingHash: leftEvidence.listingHash,
        venueId: leftEvidence.venueId!,
        venueInstrumentId: leftEvidence.venueInstrumentId!,
        priceScale: leftEvidence.priceScale!,
        quantityScale: leftEvidence.quantityScale!,
        minPriceTick: leftEvidence.minPriceTick!,
        trueOutcome: leftOutcomes.trueOutcome,
        falseOutcome: leftOutcomes.falseOutcome,
      }),
      Object.freeze({
        position: "RIGHT" as const,
        listingRef: rightRef,
        listingHash: rightEvidence.listingHash,
        venueId: rightEvidence.venueId!,
        venueInstrumentId: rightEvidence.venueInstrumentId!,
        priceScale: rightEvidence.priceScale!,
        quantityScale: rightEvidence.quantityScale!,
        minPriceTick: rightEvidence.minPriceTick!,
        trueOutcome: rightOutcomes.trueOutcome,
        falseOutcome: rightOutcomes.falseOutcome,
      }),
    ]),
    canonicalStates: states,
    portfolios,
    authority: "DETERMINISTIC_RESEARCH_COMPILER" as const,
    verifierEligible: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
}

function blockedBody(input: {
  opportunityId: string;
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
  decision: ResearchSemanticDecision;
  diagnostic: string;
}): Omit<ResearchRelationPayoffQualification, "artifactHash"> {
  return Object.freeze({
    schemaVersion: "pmh.research-relation-payoff.v1" as const,
    opportunityId: input.opportunityId,
    proposalId: input.proposal.proposalId,
    semanticReviewArtifactHash: input.review.report!.artifactHash,
    semanticDecisionId: input.decision.decisionId,
    relationKind: input.review.report!.result.relationConclusion,
    status: "BLOCKED" as const,
    diagnostic: input.diagnostic,
    listingBindings: Object.freeze([]),
    canonicalStates: Object.freeze([]),
    portfolios: Object.freeze([]),
    authority: "DETERMINISTIC_RESEARCH_COMPILER" as const,
    verifierEligible: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
}

export function compileResearchRelationPayoff(input: {
  opportunityId: string;
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
  decision: ResearchSemanticDecision;
}): ResearchRelationPayoffQualification {
  const review = assertSemanticReviewRecord(input.review);
  const decision = assertResearchSemanticDecision(input.decision);
  if (
    input.opportunityId !== `ai:${input.proposal.proposalId}` ||
    review.status !== "PASS" ||
    review.report === null ||
    review.opportunityId !== input.opportunityId ||
    review.proposalId !== input.proposal.proposalId ||
    decision.opportunityId !== input.opportunityId ||
    decision.semanticReviewArtifactHash !== review.report.artifactHash ||
    decision.decision !== "ACCEPT_FOR_SIMULATION"
  ) {
    throw new Error("relation payoff compiler input is stale or not accepted");
  }
  let body: Omit<ResearchRelationPayoffQualification, "artifactHash">;
  const readiness = inspectRelationPayoffReadiness({
    opportunityId: input.opportunityId,
    proposal: input.proposal,
    review,
  });
  if (readiness.status === "BLOCKED") {
    body = blockedBody({
      ...input,
      review,
      decision,
      diagnostic: readiness.diagnostic!,
    });
  } else {
    const constraint = review.report.result.semanticConstraint;
    if (constraint === undefined) {
      throw new Error("ready relation payoff input lost its semantic constraint");
    }
    body = compileReadyBody({
      ...input,
      review,
      decision,
      relation: readiness.relationKind,
      constraint: assertSemanticConstraintArtifact(constraint),
    });
  }
  return assertResearchRelationPayoff({ ...body, artifactHash: hashCanonical(body) });
}

export function assertResearchRelationPayoff(
  value: unknown,
): ResearchRelationPayoffQualification {
  if (value === null || typeof value !== "object") {
    throw new Error("research relation payoff qualification is malformed");
  }
  const artifact = value as ResearchRelationPayoffQualification;
  const { artifactHash, ...body } = artifact;
  const ready = artifact.status === "SIMULATION_TEMPLATE_READY";
  if (
    !["pmh.research-relation-payoff.v1", "pmh.research-relation-payoff.v2"]
      .includes(artifact.schemaVersion) ||
    !HASH_PATTERN.test(artifactHash) ||
    artifactHash !== hashCanonical(body) ||
    artifact.opportunityId.trim() === "" ||
    !HASH_PATTERN.test(artifact.proposalId) ||
    !HASH_PATTERN.test(artifact.semanticReviewArtifactHash) ||
    !HASH_PATTERN.test(artifact.semanticDecisionId) ||
    !["SIMULATION_TEMPLATE_READY", "BLOCKED"].includes(artifact.status) ||
    artifact.authority !== "DETERMINISTIC_RESEARCH_COMPILER" ||
    artifact.verifierEligible !== false ||
    artifact.certificateAuthority !== false ||
    artifact.executionAuthority !== false ||
    artifact.effects.externalWrites !== false ||
    artifact.effects.valueMovingActions !== false ||
    artifact.effects.liveExecutionEnabled !== false ||
    (ready ? artifact.diagnostic !== null : !boundedText(artifact.diagnostic, 500)) ||
    (ready
      ? artifact.listingBindings.length !== 2 ||
        artifact.canonicalStates.length < 2 ||
        artifact.canonicalStates.length > 3 ||
        artifact.portfolios.length < 1 ||
        artifact.portfolios.some((item) => {
          try {
            return BigInt(item.minimumPayoutUnits) < 1n;
          } catch {
            return true;
          }
        })
      : artifact.listingBindings.length !== 0 ||
        artifact.canonicalStates.length !== 0 ||
        artifact.portfolios.length !== 0)
  ) {
    throw new Error("research relation payoff qualification violates its contract");
  }
  if (
    artifact.schemaVersion === "pmh.research-relation-payoff.v2" &&
    (!HASH_PATTERN.test(String(artifact.semanticConstraintArtifactHash)) ||
      artifact.portfolios.some((portfolio) =>
        typeof portfolio.minimumPayoutUnits !== "string" ||
        !/^[1-9]\d*$/u.test(portfolio.minimumPayoutUnits) ||
        Object.values(portfolio.payoutUnitsByState).some((payout) =>
          typeof payout !== "string" || !/^\d+$/u.test(payout)
        )
      ))
  ) throw new Error("research relation payoff v2 violates bigint serialization");
  return artifact;
}

export function buildRelationPayoffProjection(
  inputs: readonly Readonly<{
    opportunityId: string;
    proposal: MarketRelationProposal;
    review: SemanticReviewRecord;
    decision: ResearchSemanticDecision;
  }>[],
  sourceDecisionCount = inputs.length,
): RelationPayoffProjection {
  const qualifications = Object.freeze(
    inputs
      .map(compileResearchRelationPayoff)
      .sort((left, right) => left.opportunityId.localeCompare(right.opportunityId)),
  );
  return Object.freeze({
    schemaVersion: "pmh.relation-payoff-desk.v1",
    qualificationCount: qualifications.length,
    sourceDecisionCount,
    unresolvedInputCount: sourceDecisionCount - qualifications.length,
    readyCount: qualifications.filter((item) => item.status === "SIMULATION_TEMPLATE_READY").length,
    blockedCount: qualifications.filter((item) => item.status === "BLOCKED").length,
    qualifications,
    supportedRelations: COMPILABLE_RELATIONS,
    arithmetic: "SYMBOLIC_INTEGER_PAYOUT_UNITS",
    authority: "DETERMINISTIC_RESEARCH_COMPILER",
    verifierEligible: false,
    certificateAuthority: false,
    executionAuthority: false,
    effects: Object.freeze({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    }),
  });
}

export function deriveRelationPayoffProjection(input: {
  archaeologist: MarketArchaeologistProjection;
  semanticReviews: readonly SemanticReviewRecord[];
  semanticDecisions: readonly ResearchSemanticDecision[];
}): RelationPayoffProjection {
  const accepted = input.semanticDecisions.filter(
    (decision) => decision.decision === "ACCEPT_FOR_SIMULATION",
  );
  const proposals = input.archaeologist.records.flatMap((record) =>
    record.status === "PASS" && record.report !== null
      ? record.report.result.proposals
      : [],
  );
  const compilableInputs = accepted.flatMap((decision) => {
    const proposalId = decision.opportunityId.startsWith("ai:")
      ? decision.opportunityId.slice(3)
      : "";
    const proposal = proposals.find((item) => item.proposalId === proposalId);
    const review = input.semanticReviews.find(
      (item) =>
        item.report?.artifactHash === decision.semanticReviewArtifactHash,
    );
    return proposal === undefined || review === undefined
      ? []
      : [{ opportunityId: decision.opportunityId, proposal, review, decision }];
  });
  return buildRelationPayoffProjection(compilableInputs, accepted.length);
}
