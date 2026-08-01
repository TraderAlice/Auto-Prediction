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

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const COMPILABLE_RELATIONS = Object.freeze([
  "EQUIVALENT",
  "IMPLIES",
  "SUBSET",
  "MUTUALLY_EXCLUSIVE",
  "EXHAUSTIVE",
] as const);

type CompilableRelation = (typeof COMPILABLE_RELATIONS)[number];

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
  payoutUnitsByState: Readonly<Record<string, number>>;
  minimumPayoutUnits: number;
}>;

export type ResearchRelationPayoffQualification = Readonly<{
  schemaVersion: "pmh.research-relation-payoff.v1";
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

function portfolioOutcomes(
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

function payoutFor(
  truth: boolean,
  outcome: "TRUE" | "FALSE",
): number {
  return truth === (outcome === "TRUE") ? 1 : 0;
}

function compileReadyBody(input: {
  opportunityId: string;
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
  decision: ResearchSemanticDecision;
  relation: CompilableRelation;
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
  const states = Object.freeze(
    allowedTruths(input.relation).map((truth) => {
      const stateId = `${truth.left ? "T" : "F"}${truth.right ? "T" : "F"}`;
      return Object.freeze({
        stateId,
        truthByListingRef: Object.freeze({
          [leftRef]: truth.left,
          [rightRef]: truth.right,
        }),
      });
    }),
  );
  const portfolios = Object.freeze(
    portfolioOutcomes(input.relation).map((portfolio) => {
      const legs = Object.freeze([
        Object.freeze({ legId: "left", listingRef: leftRef, outcome: portfolio.left }),
        Object.freeze({ legId: "right", listingRef: rightRef, outcome: portfolio.right }),
      ]);
      const payoutUnitsByState = Object.freeze(
        Object.fromEntries(
          states.map((state) => [
            state.stateId,
            payoutFor(state.truthByListingRef[leftRef]!, portfolio.left) +
              payoutFor(state.truthByListingRef[rightRef]!, portfolio.right),
          ]),
        ),
      );
      const minimumPayoutUnits = Math.min(...Object.values(payoutUnitsByState));
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
        minimumPayoutUnits,
      });
    }),
  );
  if (portfolios.some((portfolio) => portfolio.minimumPayoutUnits < 1)) {
    throw new Error("compiled relation portfolio does not preserve one payout unit");
  }
  return Object.freeze({
    schemaVersion: "pmh.research-relation-payoff.v1" as const,
    opportunityId: input.opportunityId,
    proposalId: input.proposal.proposalId,
    semanticReviewArtifactHash: report.artifactHash,
    semanticDecisionId: input.decision.decisionId,
    relationKind: input.relation,
    status: "SIMULATION_TEMPLATE_READY" as const,
    diagnostic: null,
    listingBindings: Object.freeze([
      Object.freeze({ position: "LEFT" as const, listingRef: leftRef, listingHash: leftEvidence.listingHash }),
      Object.freeze({ position: "RIGHT" as const, listingRef: rightRef, listingHash: rightEvidence.listingHash }),
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
  const conclusion = review.report.result.relationConclusion;
  if (
    input.proposal.listingRefs.length !== 2 ||
    new Set(input.proposal.listingRefs).size !== 2
  ) {
    body = blockedBody({
      ...input,
      review,
      decision,
      diagnostic: "Only a two-listing binary relation has a deterministic payoff template.",
    });
  } else if (conclusion !== input.proposal.relationKind) {
    body = blockedBody({
      ...input,
      review,
      decision,
      diagnostic: "The reviewer changed the relation kind; an operator-authored exact scope is required.",
    });
  } else if (!COMPILABLE_RELATIONS.includes(conclusion as CompilableRelation)) {
    body = blockedBody({
      ...input,
      review,
      decision,
      diagnostic: `${conclusion} has research value but does not define a canonical payoff partition.`,
    });
  } else {
    body = compileReadyBody({
      ...input,
      review,
      decision,
      relation: conclusion as CompilableRelation,
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
    artifact.schemaVersion !== "pmh.research-relation-payoff.v1" ||
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
        artifact.portfolios.some((item) => item.minimumPayoutUnits < 1)
      : artifact.listingBindings.length !== 0 ||
        artifact.canonicalStates.length !== 0 ||
        artifact.portfolios.length !== 0)
  ) {
    throw new Error("research relation payoff qualification violates its contract");
  }
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
