import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketRelationKind, MarketRelationProposal } from "./market-archaeologist.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_EXACT_LISTINGS = 4;

export type SemanticConstraintClass =
  | "HARD_SETTLEMENT_CONSTRAINT"
  | "PROBABILISTIC_DEPENDENCE"
  | "TEXTUAL_RELATEDNESS";

export type SemanticTruthDisposition = "FEASIBLE" | "IMPOSSIBLE" | "UNRESOLVED";

export type SemanticConstraintTruthState = Readonly<{
  stateId: string;
  truthByListingRef: Readonly<Record<string, boolean>>;
  disposition: SemanticTruthDisposition;
  rationale: string;
  evidenceListingRefs: readonly string[];
}>;

export type SemanticCounterexampleAttempt = Readonly<{
  attempted: true;
  result: "FOUND" | "NOT_FOUND" | "INCONCLUSIVE";
  narrative: string;
  stateId: string | null;
}>;

export type SemanticConstraintArtifact = Readonly<{
  schemaVersion:
    | "pmh.semantic-constraint-proposal.v1"
    | "pmh.semantic-constraint-proposal.v2";
  artifactHash: Hash;
  proposalId: Hash;
  proposalCorpusSnapshotIdentity: Hash;
  evidenceCorpusSnapshotIdentity: Hash;
  classification: SemanticConstraintClass;
  relationKind: MarketRelationKind;
  listingRefs: readonly string[];
  assumptions: readonly string[];
  counterexampleAttempt: SemanticCounterexampleAttempt;
  truthTable: readonly SemanticConstraintTruthState[];
  unresolvedEvidence: readonly string[];
  ruleEvidence: readonly Readonly<{
    listingRef: string;
    listingHash: Hash;
    sourceRawHash: Hash;
    protocolIdentity: string;
  }>[];
  exactCompilerAdmission: "ELIGIBLE" | "RESEARCH_ONLY";
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type SemanticConstraintDraft = Readonly<{
  classification: SemanticConstraintClass;
  relationKind: MarketRelationKind;
  assumptions: readonly string[];
  counterexampleAttempt: Readonly<{
    attempted: boolean;
    result: "FOUND" | "NOT_FOUND" | "INCONCLUSIVE";
    narrative: string;
    truths?: readonly boolean[] | null;
  }>;
  truthTable: readonly Readonly<{
    truths: readonly boolean[];
    disposition: SemanticTruthDisposition;
    rationale: string;
    evidenceListingRefs: readonly string[];
  }>[];
  unresolvedEvidence: readonly string[];
}>;

export type SemanticConstraintAdmission = Readonly<{
  status: "ELIGIBLE" | "RESEARCH_ONLY";
  blocker:
    | null
    | "NOT_HARD_CONSTRAINT"
    | "LISTING_ARITY_UNSUPPORTED"
    | "COUNTEREXAMPLE_SURVIVED"
    | "INCOMPLETE_STATE_SPACE"
    | "NO_FEASIBLE_STATE"
    | "NO_FORBIDDEN_STATE"
    | "UNVERIFIED_ASSUMPTION"
    | "MISSING_RULE_EVIDENCE";
  diagnostic: string | null;
}>;

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function boundedTextArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): value is readonly string[] {
  return Array.isArray(value) && value.length <= maximumItems &&
    value.every((item) => boundedText(item, maximumLength));
}

function stateId(truths: readonly boolean[]): string {
  return truths.map((truth) => truth ? "T" : "F").join("");
}

function allStateIds(listingCount: number): readonly string[] {
  return Object.freeze(
    Array.from({ length: 2 ** listingCount }, (_, value) =>
      stateId(Array.from(
        { length: listingCount },
        (_unused, index) => (value & (1 << (listingCount - index - 1))) !== 0,
      )),
    ),
  );
}

export function inspectSemanticConstraintAdmission(
  artifact: Pick<
    SemanticConstraintArtifact,
    | "schemaVersion"
    | "classification"
    | "listingRefs"
    | "counterexampleAttempt"
    | "truthTable"
    | "assumptions"
    | "unresolvedEvidence"
    | "ruleEvidence"
  >,
): SemanticConstraintAdmission {
  if (artifact.classification !== "HARD_SETTLEMENT_CONSTRAINT") {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "NOT_HARD_CONSTRAINT",
      diagnostic: "Probabilistic dependence and textual relatedness cannot enter the exact payoff compiler.",
    });
  }
  if (artifact.listingRefs.length < 2 || artifact.listingRefs.length > MAX_EXACT_LISTINGS) {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "LISTING_ARITY_UNSUPPORTED",
      diagnostic: `Exact semantic state spaces currently require 2–${MAX_EXACT_LISTINGS} binary listings.`,
    });
  }
  if (artifact.counterexampleAttempt.result !== "NOT_FOUND") {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "COUNTEREXAMPLE_SURVIVED",
      diagnostic: "A found or inconclusive counterexample prevents exact semantic admission.",
    });
  }
  const expected = allStateIds(artifact.listingRefs.length);
  const received = artifact.truthTable.map((state) => state.stateId).sort();
  if (
    artifact.truthTable.some((state) => state.disposition === "UNRESOLVED") ||
    received.join(",") !== [...expected].sort().join(",")
  ) {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "INCOMPLETE_STATE_SPACE",
      diagnostic: "Every joint truth state must be classified feasible or impossible before exact compilation.",
    });
  }
  if (!artifact.truthTable.some((state) => state.disposition === "IMPOSSIBLE")) {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "NO_FORBIDDEN_STATE",
      diagnostic: "The proposed relation forbids no joint settlement state and yields no hard payoff constraint.",
    });
  }
  if (!artifact.truthTable.some((state) => state.disposition === "FEASIBLE")) {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "NO_FEASIBLE_STATE",
      diagnostic: "A settlement constraint cannot classify every joint state as impossible.",
    });
  }
  if (
    artifact.schemaVersion === "pmh.semantic-constraint-proposal.v2" &&
    artifact.assumptions.length > 0
  ) {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "UNVERIFIED_ASSUMPTION",
      diagnostic:
        "Free-form assumptions are not settlement evidence. Bind the premise to market rules, another traded outcome, or retain it as research-only.",
    });
  }
  if (
    artifact.unresolvedEvidence.length > 0 ||
    artifact.ruleEvidence.length !== artifact.listingRefs.length
  ) {
    return Object.freeze({
      status: "RESEARCH_ONLY",
      blocker: "MISSING_RULE_EVIDENCE",
      diagnostic: "Exact semantic admission requires complete rule evidence and no unresolved evidence item.",
    });
  }
  return Object.freeze({ status: "ELIGIBLE", blocker: null, diagnostic: null });
}

export function buildSemanticConstraintArtifact(input: {
  proposal: MarketRelationProposal;
  proposalCorpusSnapshotIdentity: Hash;
  evidenceCorpusSnapshotIdentity: Hash;
  draft: SemanticConstraintDraft;
  listingEvidence: readonly Readonly<{
    listingRef: string;
    listingHash: Hash;
    sourceRawHash: string;
    protocolIdentity: string;
  }>[];
}): SemanticConstraintArtifact {
  const { proposal, draft } = input;
  if (
    !HASH_PATTERN.test(input.proposalCorpusSnapshotIdentity) ||
    !HASH_PATTERN.test(input.evidenceCorpusSnapshotIdentity) ||
    !boundedTextArray(draft.assumptions, 20, 1_000) ||
    !boundedTextArray(draft.unresolvedEvidence, 30, 2_000) ||
    draft.counterexampleAttempt.attempted !== true ||
    !["FOUND", "NOT_FOUND", "INCONCLUSIVE"].includes(draft.counterexampleAttempt.result) ||
    !boundedText(draft.counterexampleAttempt.narrative, 2_000) ||
    !Array.isArray(draft.truthTable) || draft.truthTable.length > 2 ** MAX_EXACT_LISTINGS
  ) {
    throw new Error("semantic constraint draft violates its bounded contract");
  }
  const listingRefs = Object.freeze([...proposal.listingRefs]);
  const allowedRefs = new Set(listingRefs);
  const seenStates = new Set<string>();
  const truthTable = Object.freeze(draft.truthTable.map((raw) => {
    if (
      !Array.isArray(raw.truths) || raw.truths.length !== listingRefs.length ||
      raw.truths.some((truth: unknown) => typeof truth !== "boolean") ||
      !["FEASIBLE", "IMPOSSIBLE", "UNRESOLVED"].includes(raw.disposition) ||
      !boundedText(raw.rationale, 2_000) ||
      !boundedTextArray(raw.evidenceListingRefs, listingRefs.length, 500) ||
      raw.evidenceListingRefs.some((listingRef: string) => !allowedRefs.has(listingRef))
    ) {
      throw new Error("semantic constraint truth state is malformed");
    }
    const id = stateId(raw.truths);
    if (seenStates.has(id)) throw new Error("semantic constraint truth state is duplicated");
    seenStates.add(id);
    return Object.freeze({
      stateId: id,
      truthByListingRef: Object.freeze(Object.fromEntries(
        listingRefs.map((listingRef, index) => [listingRef, raw.truths[index]!] as const),
      )),
      disposition: raw.disposition,
      rationale: raw.rationale.trim(),
      evidenceListingRefs: Object.freeze([...raw.evidenceListingRefs]),
    });
  }));
  const evidenceByRef = new Map(
    input.listingEvidence.map((item) => [item.listingRef, item] as const),
  );
  const ruleEvidence = Object.freeze(listingRefs.map((listingRef) => {
    const evidence = evidenceByRef.get(listingRef);
    if (
      evidence === undefined || !HASH_PATTERN.test(evidence.listingHash) ||
      !HASH_PATTERN.test(evidence.sourceRawHash) ||
      !boundedText(evidence.protocolIdentity, 1_000)
    ) {
      throw new Error("semantic constraint is missing hash-bound listing evidence");
    }
    return Object.freeze({
      listingRef,
      listingHash: evidence.listingHash,
      sourceRawHash: evidence.sourceRawHash as Hash,
      protocolIdentity: evidence.protocolIdentity,
    });
  }));
  const attemptedTruths = draft.counterexampleAttempt.truths;
  if (
    attemptedTruths !== undefined && attemptedTruths !== null &&
    (attemptedTruths.length !== listingRefs.length ||
      attemptedTruths.some((truth) => typeof truth !== "boolean"))
  ) {
    throw new Error("semantic counterexample state is malformed");
  }
  const counterexampleAttempt = Object.freeze({
    attempted: true as const,
    result: draft.counterexampleAttempt.result,
    narrative: draft.counterexampleAttempt.narrative.trim(),
    stateId: attemptedTruths === undefined || attemptedTruths === null
      ? null
      : stateId(attemptedTruths),
  });
  const admission = inspectSemanticConstraintAdmission({
    schemaVersion: "pmh.semantic-constraint-proposal.v2",
    classification: draft.classification,
    listingRefs,
    counterexampleAttempt,
    truthTable,
    assumptions: draft.assumptions,
    unresolvedEvidence: draft.unresolvedEvidence,
    ruleEvidence,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-constraint-proposal.v2" as const,
    proposalId: proposal.proposalId,
    proposalCorpusSnapshotIdentity: input.proposalCorpusSnapshotIdentity,
    evidenceCorpusSnapshotIdentity: input.evidenceCorpusSnapshotIdentity,
    classification: draft.classification,
    relationKind: draft.relationKind,
    listingRefs,
    assumptions: Object.freeze(draft.assumptions.map((item) => item.trim())),
    counterexampleAttempt,
    truthTable,
    unresolvedEvidence: Object.freeze(draft.unresolvedEvidence.map((item) => item.trim())),
    ruleEvidence,
    exactCompilerAdmission: admission.status,
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return assertSemanticConstraintArtifact(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertSemanticConstraintArtifact(value: unknown): SemanticConstraintArtifact {
  if (value === null || typeof value !== "object") {
    throw new Error("semantic constraint artifact is malformed");
  }
  const artifact = value as SemanticConstraintArtifact;
  const { artifactHash, ...body } = artifact;
  if (
    ![
      "pmh.semantic-constraint-proposal.v1",
      "pmh.semantic-constraint-proposal.v2",
    ].includes(artifact.schemaVersion) ||
    !HASH_PATTERN.test(artifactHash) || artifactHash !== hashCanonical(body) ||
    !HASH_PATTERN.test(artifact.proposalId) ||
    !HASH_PATTERN.test(artifact.proposalCorpusSnapshotIdentity) ||
    !HASH_PATTERN.test(artifact.evidenceCorpusSnapshotIdentity) ||
    !["HARD_SETTLEMENT_CONSTRAINT", "PROBABILISTIC_DEPENDENCE", "TEXTUAL_RELATEDNESS"]
      .includes(artifact.classification) ||
    artifact.authority !== "PROPOSE_ONLY" ||
    artifact.semanticDecisionAuthority !== false ||
    artifact.certificateAuthority !== false ||
    artifact.executionAuthority !== false ||
    artifact.effects.externalWrites !== false ||
    artifact.effects.valueMovingActions !== false ||
    artifact.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("semantic constraint artifact violates its authority or identity contract");
  }
  if (
    !Array.isArray(artifact.listingRefs) || artifact.listingRefs.length < 2 ||
    artifact.listingRefs.length > 8 || new Set(artifact.listingRefs).size !== artifact.listingRefs.length ||
    !boundedTextArray(artifact.listingRefs, 8, 500) ||
    !boundedTextArray(artifact.assumptions, 20, 1_000) ||
    !boundedTextArray(artifact.unresolvedEvidence, 30, 2_000) ||
    artifact.counterexampleAttempt.attempted !== true ||
    !["FOUND", "NOT_FOUND", "INCONCLUSIVE"].includes(artifact.counterexampleAttempt.result) ||
    !boundedText(artifact.counterexampleAttempt.narrative, 2_000) ||
    (artifact.counterexampleAttempt.stateId !== null &&
      !/^[TF]+$/u.test(artifact.counterexampleAttempt.stateId)) ||
    !Array.isArray(artifact.truthTable) || artifact.truthTable.length > 2 ** MAX_EXACT_LISTINGS ||
    !Array.isArray(artifact.ruleEvidence) ||
    artifact.ruleEvidence.length !== artifact.listingRefs.length
  ) {
    throw new Error("semantic constraint artifact violates its bounded contract");
  }
  const refs = new Set(artifact.listingRefs);
  const stateIds = new Set<string>();
  for (const state of artifact.truthTable) {
    const expectedStateId = stateId(
      artifact.listingRefs.map((listingRef) => state.truthByListingRef[listingRef]!),
    );
    if (
      stateIds.has(state.stateId) || state.stateId !== expectedStateId ||
      Object.keys(state.truthByListingRef).length !== artifact.listingRefs.length ||
      Object.values(state.truthByListingRef).some((truth) => typeof truth !== "boolean") ||
      !["FEASIBLE", "IMPOSSIBLE", "UNRESOLVED"].includes(state.disposition) ||
      !boundedText(state.rationale, 2_000) ||
      !boundedTextArray(state.evidenceListingRefs, artifact.listingRefs.length, 500) ||
      state.evidenceListingRefs.some((listingRef: string) => !refs.has(listingRef))
    ) throw new Error("semantic constraint artifact contains a malformed truth state");
    stateIds.add(state.stateId);
  }
  for (const evidence of artifact.ruleEvidence) {
    if (
      !refs.has(evidence.listingRef) || !HASH_PATTERN.test(evidence.listingHash) ||
      !HASH_PATTERN.test(evidence.sourceRawHash) ||
      !boundedText(evidence.protocolIdentity, 1_000)
    ) throw new Error("semantic constraint artifact contains malformed rule evidence");
  }
  if (
    new Set(artifact.ruleEvidence.map((evidence) => evidence.listingRef)).size !==
      artifact.listingRefs.length ||
    artifact.ruleEvidence.map((evidence) => evidence.listingRef).join("\n") !==
      artifact.listingRefs.join("\n")
  ) throw new Error("semantic constraint artifact rule evidence does not cover its listings");
  const admission = inspectSemanticConstraintAdmission(artifact);
  if (artifact.exactCompilerAdmission !== admission.status) {
    throw new Error("semantic constraint artifact admission is inconsistent");
  }
  return artifact;
}
