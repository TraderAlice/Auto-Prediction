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
import {
  assertPremiseAnalysisArtifact,
  type PremiseAnalysisArtifact,
  type PremiseAnalysisRecord,
} from "./premise-analysis.js";

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
    | "PREMISE_ANALYSIS_UNAVAILABLE"
    | "PREMISE_RELATION_RESEARCH_ONLY"
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
  schemaVersion:
    | "pmh.research-relation-payoff.v1"
    | "pmh.research-relation-payoff.v2"
    | "pmh.research-relation-payoff.v3";
  semanticConstraintArtifactHash?: Hash;
  semanticConstraint?: SemanticConstraintArtifact;
  premiseBearingRelationArtifactHash?: Hash;
  premiseAnalysis?: PremiseAnalysisArtifact;
  artifactHash: Hash;
  opportunityId: string;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  semanticDecisionId: Hash;
  relationKind: MarketRelationKind;
  status: "SIMULATION_TEMPLATE_READY" | "BLOCKED";
  diagnostic: string | null;
  listingBindings: readonly Readonly<{
    position: "LEFT" | "RIGHT" | number;
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

function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");
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
  premiseAnalysis?: PremiseAnalysisArtifact;
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
    input.proposal.listingRefs.length < 2 || input.proposal.listingRefs.length > 4 ||
    new Set(input.proposal.listingRefs).size !== input.proposal.listingRefs.length
  ) {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "LISTING_ARITY_UNSUPPORTED",
      diagnostic: "The exact payoff compiler requires 2–4 distinct binary listings.",
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
  const requiresPremiseAudit = input.proposal.listingRefs.length > 2 ||
    conclusion === "CONDITIONAL";
  if (requiresPremiseAudit && input.premiseAnalysis === undefined) {
    return Object.freeze({
      status: "BLOCKED",
      relationKind: conclusion,
      blocker: "PREMISE_ANALYSIS_UNAVAILABLE",
      diagnostic: "A 3–4 listing or conditional relation requires a scope-bound hidden-premise audit before payoff compilation.",
    });
  }
  if (input.premiseAnalysis !== undefined) {
    const analysis = assertPremiseAnalysisArtifact(input.premiseAnalysis);
    if (
      analysis.proposalId !== input.proposal.proposalId ||
      analysis.semanticReviewArtifactHash !== review.report.artifactHash ||
      analysis.evidenceScopeIdentity !== review.corpusSnapshotIdentity ||
      analysis.semanticConstraint.artifactHash !== constraint.artifactHash
    ) throw new Error("relation payoff premise analysis lineage is stale");
    if (analysis.relation.exactCompilerAdmission !== "ELIGIBLE") {
      return Object.freeze({
        status: "BLOCKED",
        relationKind: conclusion,
        blocker: "PREMISE_RELATION_RESEARCH_ONLY",
        diagnostic: `The premise-bearing relation remains research-only: ${analysis.relation.blocker ?? "unresolved premise"}.`,
      });
    }
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
  premiseAnalysis?: PremiseAnalysisArtifact;
}): Omit<ResearchRelationPayoffQualification, "artifactHash"> {
  const report = input.review.report!;
  const evidenceByRef = new Map(
    report.input.listingEvidence.map((item) => [item.listingRef, item] as const),
  );
  const listingBindings = Object.freeze(input.proposal.listingRefs.map((listingRef, position) => {
    const evidence = evidenceByRef.get(listingRef);
    const outcomes = canonicalOutcomePair(evidence?.outcomes ?? []);
    if (evidence === undefined || outcomes === null) {
      throw new Error("relation compiler evidence or outcome truth mapping is unavailable");
    }
    return Object.freeze({
      position,
      listingRef,
      listingHash: evidence.listingHash,
      venueId: evidence.venueId!,
      venueInstrumentId: evidence.venueInstrumentId!,
      priceScale: evidence.priceScale!,
      quantityScale: evidence.quantityScale!,
      minPriceTick: evidence.minPriceTick!,
      trueOutcome: outcomes.trueOutcome,
      falseOutcome: outcomes.falseOutcome,
    });
  }));
  const states = Object.freeze(input.constraint.truthTable
    .filter((state) => state.disposition === "FEASIBLE")
    .map((state) => Object.freeze({
      stateId: state.stateId,
      truthByListingRef: state.truthByListingRef,
    })));
  if (states.length === 0) throw new Error("relation compiler has no feasible settlement state");
  type Action = "NONE" | "TRUE" | "FALSE";
  const actions = ["NONE", "TRUE", "FALSE"] as const satisfies readonly Action[];
  const guaranteed = Array.from(
    { length: 3 ** listingBindings.length - 1 },
    (_, offset) => offset + 1,
  ).flatMap((encoded) => {
      let cursor = encoded;
      const selected = listingBindings.map(() => {
        const action = actions[cursor % 3]!;
        cursor = Math.floor(cursor / 3);
        return action;
      });
      const legs = Object.freeze(selected.flatMap((outcome, index) =>
        outcome === "NONE" ? [] : [Object.freeze({
          legId: `listing-${index}`,
          listingRef: listingBindings[index]!.listingRef,
          outcome,
        })]
      ));
      const payoutUnitsByStateBigInt = Object.freeze(
        Object.fromEntries(
          states.map((state) => [
            state.stateId,
            legs.reduce((sum, leg) =>
              sum + payoutFor(state.truthByListingRef[leg.listingRef]!, leg.outcome), 0n
            ),
          ]),
        ),
      );
      const payoutValues = Object.values(payoutUnitsByStateBigInt);
      const minimumPayoutUnits = payoutValues.reduce(
        (minimum, value) => value < minimum ? value : minimum,
      );
      if (minimumPayoutUnits < 1n) return [];
      const label = legs.map((leg) => {
        const position = listingBindings.find((item) => item.listingRef === leg.listingRef)!.position;
        return `${position + 1}:${leg.outcome}`;
      }).join(" + ");
      const payoutUnitsByState = Object.freeze(Object.fromEntries(
        Object.entries(payoutUnitsByStateBigInt).map(([state, payout]) => [state, payout.toString()]),
      ));
      const identityBody = {
        schemaVersion: "pmh.relation-payoff-portfolio.v3",
        relation: input.relation,
        semanticDecisionId: input.decision.decisionId,
        semanticConstraintArtifactHash: input.constraint.artifactHash,
        premiseBearingRelationArtifactHash: input.premiseAnalysis?.relation.artifactHash ?? null,
        label,
        legs,
        payoutUnitsByState,
      };
      return [Object.freeze({
        portfolioId: hashCanonical(identityBody),
        label,
        legs,
        payoutUnitsByState,
        minimumPayoutUnits: minimumPayoutUnits.toString(),
      })];
    });
  const portfolios = Object.freeze(guaranteed.filter((candidate) => {
    const candidateLegs = new Set(candidate.legs.map((leg) =>
      `${leg.listingRef}\u0000${leg.outcome}`
    ));
    return !guaranteed.some((other) =>
      other.legs.length < candidate.legs.length && other.legs.every((leg) =>
        candidateLegs.has(`${leg.listingRef}\u0000${leg.outcome}`)
      )
    );
  }).sort((left, right) =>
    left.legs.length - right.legs.length || left.portfolioId.localeCompare(right.portfolioId)
  ));
  if (portfolios.length === 0) {
    throw new Error("compiled relation portfolio does not preserve one payout unit");
  }
  return Object.freeze({
    schemaVersion: "pmh.research-relation-payoff.v3" as const,
    semanticConstraintArtifactHash: input.constraint.artifactHash,
    semanticConstraint: input.constraint,
    ...(input.premiseAnalysis === undefined
      ? {}
      : {
          premiseBearingRelationArtifactHash: input.premiseAnalysis.relation.artifactHash,
          premiseAnalysis: input.premiseAnalysis,
        }),
    opportunityId: input.opportunityId,
    proposalId: input.proposal.proposalId,
    semanticReviewArtifactHash: report.artifactHash,
    semanticDecisionId: input.decision.decisionId,
    relationKind: input.relation,
    status: "SIMULATION_TEMPLATE_READY" as const,
    diagnostic: null,
    listingBindings,
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
  premiseAnalysis?: PremiseAnalysisArtifact;
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
    ...(input.premiseAnalysis === undefined ? {} : { premiseAnalysis: input.premiseAnalysis }),
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
      ...(input.premiseAnalysis === undefined ? {} : { premiseAnalysis: input.premiseAnalysis }),
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
  const v3 = artifact.schemaVersion === "pmh.research-relation-payoff.v3";
  if (
    ![
      "pmh.research-relation-payoff.v1",
      "pmh.research-relation-payoff.v2",
      "pmh.research-relation-payoff.v3",
    ]
      .includes(artifact.schemaVersion) ||
    !HASH_PATTERN.test(artifactHash) ||
    artifactHash !== hashCanonical(body) ||
    artifact.opportunityId.trim() === "" ||
    !HASH_PATTERN.test(artifact.proposalId) ||
    !HASH_PATTERN.test(artifact.semanticReviewArtifactHash) ||
    !HASH_PATTERN.test(artifact.semanticDecisionId) ||
    ![
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
      "CONDITIONAL", "RELATED", "CONFLICTING",
    ].includes(artifact.relationKind) ||
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
      ? (v3
          ? artifact.listingBindings.length < 2 || artifact.listingBindings.length > 4 ||
            artifact.canonicalStates.length < 1 ||
            artifact.canonicalStates.length >= 2 ** artifact.listingBindings.length ||
            artifact.portfolios.length > 3 ** artifact.listingBindings.length - 1
          : artifact.listingBindings.length !== 2 ||
            artifact.canonicalStates.length < 2 || artifact.canonicalStates.length > 3) ||
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
    ["pmh.research-relation-payoff.v2", "pmh.research-relation-payoff.v3"]
      .includes(artifact.schemaVersion) &&
    (!HASH_PATTERN.test(String(artifact.semanticConstraintArtifactHash)) ||
      artifact.portfolios.some((portfolio) =>
        typeof portfolio.minimumPayoutUnits !== "string" ||
        !/^[1-9]\d*$/u.test(portfolio.minimumPayoutUnits) ||
        Object.values(portfolio.payoutUnitsByState).some((payout) =>
          typeof payout !== "string" || !/^\d+$/u.test(payout)
        )
      ))
  ) throw new Error("research relation payoff v2 violates bigint serialization");
  if (v3 && ready) {
    const expectedTopLevelKeys = [
      "artifactHash", "authority", "canonicalStates", "certificateAuthority", "diagnostic",
      "effects", "executionAuthority", "listingBindings", "opportunityId", "portfolios",
      "proposalId", "relationKind", "schemaVersion", "semanticConstraint",
      "semanticConstraintArtifactHash", "semanticDecisionId", "semanticReviewArtifactHash",
      "status", "verifierEligible",
      ...(artifact.premiseAnalysis === undefined
        ? []
        : ["premiseAnalysis", "premiseBearingRelationArtifactHash"]),
    ];
    if (
      !exactKeys(artifact, expectedTopLevelKeys) ||
      !exactKeys(artifact.effects, [
        "externalWrites", "liveExecutionEnabled", "valueMovingActions",
      ])
    ) throw new Error("research relation payoff v3 contains extended data");
    const semanticConstraint = assertSemanticConstraintArtifact(artifact.semanticConstraint);
    const refs = artifact.listingBindings.map((binding, position) => {
      if (
        !exactKeys(binding, [
          "falseOutcome", "listingHash", "listingRef", "minPriceTick", "position",
          "priceScale", "quantityScale", "trueOutcome", "venueId", "venueInstrumentId",
        ]) ||
        !exactKeys(binding.trueOutcome, ["label", "venueOutcomeId"]) ||
        !exactKeys(binding.falseOutcome, ["label", "venueOutcomeId"]) ||
        binding.position !== position || !boundedText(binding.listingRef, 500) ||
        !HASH_PATTERN.test(String(binding.listingHash)) ||
        !boundedText(binding.venueId, 200) || !boundedText(binding.venueInstrumentId, 500) ||
        !/^[1-9]\d*$/u.test(binding.priceScale) || !/^[1-9]\d*$/u.test(binding.quantityScale) ||
        (binding.minPriceTick !== null && !/^\d+(?:\.\d+)?$/u.test(binding.minPriceTick)) ||
        !boundedText(binding.trueOutcome?.venueOutcomeId, 500) ||
        !boundedText(binding.trueOutcome?.label, 200) ||
        !boundedText(binding.falseOutcome?.venueOutcomeId, 500) ||
        !boundedText(binding.falseOutcome?.label, 200)
      ) throw new Error("research relation payoff v3 listing binding is malformed");
      return binding.listingRef;
    });
    if (new Set(refs).size !== refs.length) {
      throw new Error("research relation payoff v3 listing binding is duplicated");
    }
    if (
      semanticConstraint.artifactHash !== artifact.semanticConstraintArtifactHash ||
      semanticConstraint.proposalId !== artifact.proposalId ||
      semanticConstraint.listingRefs.join("\n") !== refs.join("\n")
    ) throw new Error("research relation payoff v3 semantic constraint lineage is stale");
    const premiseAnalysis = artifact.premiseAnalysis === undefined
      ? undefined
      : assertPremiseAnalysisArtifact(artifact.premiseAnalysis);
    if (
      premiseAnalysis === undefined
        ? artifact.premiseBearingRelationArtifactHash !== undefined
        : !HASH_PATTERN.test(String(artifact.premiseBearingRelationArtifactHash)) ||
          artifact.premiseBearingRelationArtifactHash !==
            premiseAnalysis.relation.artifactHash ||
          premiseAnalysis.proposalId !== artifact.proposalId ||
          premiseAnalysis.semanticReviewArtifactHash !== artifact.semanticReviewArtifactHash ||
          premiseAnalysis.semanticConstraint.artifactHash !== semanticConstraint.artifactHash ||
          premiseAnalysis.relation.exactCompilerAdmission !== "ELIGIBLE"
    ) throw new Error("research relation payoff v3 premise binding is malformed or stale");
    if (
      (refs.length > 2 || artifact.relationKind === "CONDITIONAL") &&
      premiseAnalysis === undefined
    ) throw new Error("research relation payoff v3 is missing its required premise audit");
    const stateIds = new Set<string>();
    for (const state of artifact.canonicalStates) {
      if (
        !exactKeys(state, ["stateId", "truthByListingRef"]) ||
        !/^[TF]+$/u.test(state.stateId) || state.stateId.length !== refs.length ||
        stateIds.has(state.stateId) ||
        Object.keys(state.truthByListingRef).sort().join("\n") !== [...refs].sort().join("\n") ||
        refs.some((ref) => typeof state.truthByListingRef[ref] !== "boolean") ||
        state.stateId !== refs.map((ref) => state.truthByListingRef[ref] ? "T" : "F").join("")
      ) throw new Error("research relation payoff v3 canonical state is malformed");
      stateIds.add(state.stateId);
    }
    const expectedStates = semanticConstraint.truthTable
      .filter((state) => state.disposition === "FEASIBLE")
      .map((state) => ({ stateId: state.stateId, truthByListingRef: state.truthByListingRef }));
    if (
      hashCanonical(expectedStates) !== hashCanonical(artifact.canonicalStates) ||
      artifact.canonicalStates.map((state) => state.stateId).join("\n") !==
        [...artifact.canonicalStates].map((state) => state.stateId).sort().join("\n")
    ) throw new Error("research relation payoff v3 feasible state replay is inconsistent");
    const portfolioIds = new Set<Hash>();
    for (const portfolio of artifact.portfolios) {
      if (
        !exactKeys(portfolio, [
          "label", "legs", "minimumPayoutUnits", "payoutUnitsByState", "portfolioId",
        ]) ||
        !HASH_PATTERN.test(String(portfolio.portfolioId)) || !boundedText(portfolio.label, 1_000) ||
        portfolioIds.has(portfolio.portfolioId) ||
        portfolio.legs.length < 1 || portfolio.legs.length > refs.length ||
        new Set(portfolio.legs.map((leg) => leg.listingRef)).size !== portfolio.legs.length ||
        portfolio.legs.some((leg) =>
          !exactKeys(leg, ["legId", "listingRef", "outcome"]) ||
          !boundedText(leg.legId, 100) || !refs.includes(leg.listingRef) ||
          !["TRUE", "FALSE"].includes(leg.outcome)
        ) ||
        new Set(portfolio.legs.map((leg) => leg.legId)).size !== portfolio.legs.length ||
        Object.keys(portfolio.payoutUnitsByState).sort().join("\n") !==
          [...stateIds].sort().join("\n")
      ) throw new Error("research relation payoff v3 portfolio binding is malformed");
      portfolioIds.add(portfolio.portfolioId);
      const recomputed = artifact.canonicalStates.map((state) =>
        portfolio.legs.reduce((sum, leg) =>
          sum + payoutFor(state.truthByListingRef[leg.listingRef]!, leg.outcome), 0n
        )
      );
      if (
        recomputed.some((payout, index) =>
          portfolio.payoutUnitsByState[artifact.canonicalStates[index]!.stateId] !==
            payout.toString()
        ) ||
        portfolio.minimumPayoutUnits !== recomputed.reduce(
          (minimum, payout) => payout < minimum ? payout : minimum,
        ).toString() ||
        portfolio.portfolioId !== hashCanonical({
          schemaVersion: "pmh.relation-payoff-portfolio.v3",
          relation: artifact.relationKind,
          semanticDecisionId: artifact.semanticDecisionId,
          semanticConstraintArtifactHash: artifact.semanticConstraintArtifactHash,
          premiseBearingRelationArtifactHash:
            artifact.premiseBearingRelationArtifactHash ?? null,
          label: portfolio.label,
          legs: portfolio.legs,
          payoutUnitsByState: portfolio.payoutUnitsByState,
        })
      ) throw new Error("research relation payoff v3 portfolio replay is inconsistent");
    }
    for (const candidate of artifact.portfolios) {
      const legs = new Set(candidate.legs.map((leg) => `${leg.listingRef}\u0000${leg.outcome}`));
      if (artifact.portfolios.some((other) =>
        other.legs.length < candidate.legs.length && other.legs.every((leg) =>
          legs.has(`${leg.listingRef}\u0000${leg.outcome}`)
        )
      )) throw new Error("research relation payoff v3 retains a dominated portfolio");
    }
  }
  return artifact;
}

export function buildRelationPayoffProjection(
  inputs: readonly Readonly<{
    opportunityId: string;
    proposal: MarketRelationProposal;
    review: SemanticReviewRecord;
    decision: ResearchSemanticDecision;
    premiseAnalysis?: PremiseAnalysisArtifact;
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
  premiseAnalyses?: readonly PremiseAnalysisRecord[];
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
    const premiseAnalysis = input.premiseAnalyses?.find((item) =>
      item.status === "PASS" && item.analysis !== null &&
      item.semanticReviewArtifactHash === decision.semanticReviewArtifactHash
    )?.analysis ?? undefined;
    return proposal === undefined || review === undefined
      ? []
      : [{
          opportunityId: decision.opportunityId,
          proposal,
          review,
          decision,
          ...(premiseAnalysis === undefined ? {} : { premiseAnalysis }),
        }];
  });
  return buildRelationPayoffProjection(compilableInputs, accepted.length);
}
