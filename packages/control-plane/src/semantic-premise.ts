import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertSemanticConstraintArtifact,
  inspectSemanticConstraintAdmission,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_PREMISES = 8;
const MAX_EXPRESSION_DEPTH = 6;
const MAX_EXPRESSION_LEAVES = 16;
const PREMISE_KEYS = Object.freeze([
  "artifactHash", "authority", "binding", "certificateAuthority", "counterexample",
  "evidenceClaimIds", "evidenceScopeIdentity", "exactStateAuthority", "executionAuthority",
  "kind", "premiseId", "proposalId", "proposition", "rationale", "schemaVersion",
  "semanticDecisionAuthority", "truthPosture",
]);
const RELATION_KEYS = Object.freeze([
  "artifactHash", "authority", "blocker", "certificateAuthority", "classification",
  "evaluatedStates", "evidenceScopeIdentity", "exactCompilerAdmission", "executionAuthority",
  "expression", "expressionMatchesStateSpace", "listingRefs", "premiseIds", "proposalId",
  "relationId", "schemaVersion", "semanticConstraintArtifactHash", "semanticDecisionAuthority",
]);

export type SemanticPremiseKind =
  | "SETTLEMENT_INTRINSIC"
  | "TRADED_OUTCOME"
  | "EXTERNAL_OBSERVATION"
  | "CAUSAL_HYPOTHESIS";

export type SemanticPremiseTruthPosture =
  | "PROVEN_IN_SCOPE"
  | "TRADED_VARIABLE"
  | "OBSERVED"
  | "UNRESOLVED"
  | "CONTRADICTED";

export type SemanticPremiseBinding =
  | Readonly<{
      kind: "LISTING_TRUTH";
      listingRef: string;
      listingHash: Hash;
      truthValue: boolean;
    }>
  | Readonly<{
      kind: "EXTERNAL_OBSERVATION";
      observationId: Hash;
      sourceRawHash: Hash;
      observedAt: string;
      truthValue: boolean;
    }>
  | Readonly<{ kind: "NONE" }>;

export type SemanticPremiseDraft = Readonly<{
  proposition: string;
  kind: SemanticPremiseKind;
  truthPosture: SemanticPremiseTruthPosture;
  binding:
    | Readonly<{ kind: "LISTING_TRUTH"; listingRef: string; truthValue: boolean }>
    | Readonly<{
        kind: "EXTERNAL_OBSERVATION";
        observationId: Hash;
        sourceRawHash: Hash;
        observedAt: string;
        truthValue: boolean;
      }>
    | Readonly<{ kind: "NONE" }>;
  evidenceClaimIds: readonly Hash[];
  rationale: string;
  counterexample: Readonly<{
    attempted: true;
    result: "FOUND" | "NOT_FOUND" | "INCONCLUSIVE";
    narrative: string;
  }>;
}>;

export type SemanticPremiseArtifact = Readonly<{
  schemaVersion: "pmh.semantic-premise.v1";
  premiseId: Hash;
  proposalId: Hash;
  evidenceScopeIdentity: Hash;
  proposition: string;
  kind: SemanticPremiseKind;
  truthPosture: SemanticPremiseTruthPosture;
  binding: SemanticPremiseBinding;
  evidenceClaimIds: readonly Hash[];
  rationale: string;
  counterexample: SemanticPremiseDraft["counterexample"];
  exactStateAuthority: "BOUND_LISTING_TRUTH" | "NONE";
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type SemanticBooleanExpression =
  | Readonly<{ op: "LISTING"; listingRef: string; equals: boolean }>
  | Readonly<{ op: "PREMISE"; premiseId: Hash }>
  | Readonly<{ op: "NOT"; operand: SemanticBooleanExpression }>
  | Readonly<{
      op: "AND" | "OR" | "IMPLIES";
      left: SemanticBooleanExpression;
      right: SemanticBooleanExpression;
    }>;

export type SemanticBooleanExpressionDraft =
  | Readonly<{ op: "LISTING"; listingRef: string; equals: boolean }>
  | Readonly<{ op: "PREMISE"; premiseKey: string }>
  | Readonly<{ op: "NOT"; operand: SemanticBooleanExpressionDraft }>
  | Readonly<{
      op: "AND" | "OR" | "IMPLIES";
      left: SemanticBooleanExpressionDraft;
      right: SemanticBooleanExpressionDraft;
    }>;

export type SemanticExpressionTokenDraft =
  | Readonly<{ op: "LISTING"; listingRef: string; equals: boolean }>
  | Readonly<{ op: "PREMISE"; premiseKey: string }>
  | Readonly<{ op: "NOT" | "AND" | "OR" | "IMPLIES" }>;

export type PremiseBearingRelationClassification =
  | "UNCONDITIONAL_HARD"
  | "CONDITIONAL_TRADED"
  | "CONDITIONAL_OBSERVED"
  | "CAUSAL_RESEARCH_ONLY";

export type PremiseBearingRelationArtifact = Readonly<{
  schemaVersion: "pmh.premise-bearing-relation.v1";
  relationId: Hash;
  proposalId: Hash;
  evidenceScopeIdentity: Hash;
  semanticConstraintArtifactHash: Hash;
  listingRefs: readonly string[];
  premiseIds: readonly Hash[];
  expression: SemanticBooleanExpression;
  classification: PremiseBearingRelationClassification;
  expressionMatchesStateSpace: boolean;
  evaluatedStates: readonly Readonly<{
    stateId: string;
    expressionValue: boolean | null;
    disposition: "FEASIBLE" | "IMPOSSIBLE" | "UNRESOLVED";
    matchesDisposition: boolean;
  }>[];
  exactCompilerAdmission: "ELIGIBLE" | "RESEARCH_ONLY";
  blocker:
    | null
    | "BASE_CONSTRAINT_RESEARCH_ONLY"
    | "PREMISE_RESEARCH_ONLY"
    | "EXPRESSION_UNRESOLVED"
    | "EXPRESSION_STATE_MISMATCH";
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");
}

function normalizeHashes(values: readonly Hash[], maximum: number): readonly Hash[] {
  if (
    !Array.isArray(values) || values.length > maximum ||
    values.some((value) => !HASH_PATTERN.test(String(value)))
  ) throw new Error("semantic premise evidence claim identities are malformed");
  const sorted = Object.freeze([...values].sort());
  if (new Set(sorted).size !== sorted.length) {
    throw new Error("semantic premise evidence claim identity is duplicated");
  }
  return sorted;
}

function normalizedBinding(input: Readonly<{
  draft: SemanticPremiseDraft;
  listings: readonly Readonly<{ listingRef: string; listingHash: Hash }>[];
}>): SemanticPremiseBinding {
  const binding = input.draft.binding;
  if (binding.kind === "LISTING_TRUTH") {
    const listing = input.listings.find((item) => item.listingRef === binding.listingRef);
    if (
      listing === undefined || !HASH_PATTERN.test(String(listing.listingHash)) ||
      typeof binding.truthValue !== "boolean"
    ) throw new Error("semantic premise listing binding is outside the evidence scope");
    return Object.freeze({
      kind: "LISTING_TRUTH",
      listingRef: listing.listingRef,
      listingHash: listing.listingHash,
      truthValue: binding.truthValue,
    });
  }
  if (binding.kind === "EXTERNAL_OBSERVATION") {
    if (
      !HASH_PATTERN.test(String(binding.observationId)) ||
      !HASH_PATTERN.test(String(binding.sourceRawHash)) ||
      !isIso(binding.observedAt) || typeof binding.truthValue !== "boolean"
    ) throw new Error("semantic premise external observation binding is malformed");
    return Object.freeze({ ...binding });
  }
  if (!exactKeys(binding, ["kind"]) || binding.kind !== "NONE") {
    throw new Error("semantic premise empty binding is malformed");
  }
  return Object.freeze({ kind: "NONE" });
}

function assertKindPostureBinding(
  kind: SemanticPremiseKind,
  posture: SemanticPremiseTruthPosture,
  binding: SemanticPremiseBinding,
  counterexample: SemanticPremiseDraft["counterexample"],
): void {
  const listingBound = binding.kind === "LISTING_TRUTH";
  if (
    (kind === "SETTLEMENT_INTRINSIC" &&
      (!listingBound || posture !== "PROVEN_IN_SCOPE" || counterexample.result !== "NOT_FOUND")) ||
    (kind === "TRADED_OUTCOME" &&
      (!listingBound || posture !== "TRADED_VARIABLE" || counterexample.result === "FOUND")) ||
    (kind === "EXTERNAL_OBSERVATION" &&
      (binding.kind !== "EXTERNAL_OBSERVATION" || posture !== "OBSERVED")) ||
    (kind === "CAUSAL_HYPOTHESIS" &&
      (binding.kind !== "NONE" || !["UNRESOLVED", "CONTRADICTED"].includes(posture))) ||
    (counterexample.result === "FOUND" && posture !== "CONTRADICTED") ||
    (posture === "CONTRADICTED" && counterexample.result !== "FOUND")
  ) throw new Error("semantic premise kind, truth posture, binding, and counterexample disagree");
}

export function buildSemanticPremiseArtifact(input: Readonly<{
  proposalId: Hash;
  evidenceScopeIdentity: Hash;
  draft: SemanticPremiseDraft;
  listings: readonly Readonly<{ listingRef: string; listingHash: Hash }>[];
  availableEvidenceClaimIds?: readonly Hash[];
}>): SemanticPremiseArtifact {
  const draft = input.draft;
  if (
    !HASH_PATTERN.test(String(input.proposalId)) ||
    !HASH_PATTERN.test(String(input.evidenceScopeIdentity)) ||
    !boundedText(draft.proposition, 1_000) ||
    !["SETTLEMENT_INTRINSIC", "TRADED_OUTCOME", "EXTERNAL_OBSERVATION", "CAUSAL_HYPOTHESIS"]
      .includes(draft.kind) ||
    !["PROVEN_IN_SCOPE", "TRADED_VARIABLE", "OBSERVED", "UNRESOLVED", "CONTRADICTED"]
      .includes(draft.truthPosture) ||
    !boundedText(draft.rationale, 2_000) ||
    draft.counterexample?.attempted !== true ||
    !["FOUND", "NOT_FOUND", "INCONCLUSIVE"].includes(draft.counterexample.result) ||
    !boundedText(draft.counterexample.narrative, 2_000)
  ) throw new Error("semantic premise draft violates its bounded contract");
  const evidenceClaimIds = normalizeHashes(draft.evidenceClaimIds, 20);
  const available = new Set(input.availableEvidenceClaimIds ?? []);
  if (evidenceClaimIds.some((claimId) => !available.has(claimId))) {
    throw new Error("semantic premise references an unavailable evidence claim");
  }
  const binding = normalizedBinding({ draft, listings: input.listings });
  assertKindPostureBinding(draft.kind, draft.truthPosture, binding, draft.counterexample);
  const identityBody = Object.freeze({
    schemaVersion: "pmh.semantic-premise-identity.v1",
    proposalId: input.proposalId,
    evidenceScopeIdentity: input.evidenceScopeIdentity,
    proposition: draft.proposition.trim(),
    kind: draft.kind,
    truthPosture: draft.truthPosture,
    binding,
    evidenceClaimIds,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-premise.v1" as const,
    premiseId: hashCanonical(identityBody),
    proposalId: input.proposalId,
    evidenceScopeIdentity: input.evidenceScopeIdentity,
    proposition: draft.proposition.trim(),
    kind: draft.kind,
    truthPosture: draft.truthPosture,
    binding,
    evidenceClaimIds,
    rationale: draft.rationale.trim(),
    counterexample: Object.freeze({
      attempted: true as const,
      result: draft.counterexample.result,
      narrative: draft.counterexample.narrative.trim(),
    }),
    exactStateAuthority: binding.kind === "LISTING_TRUTH"
      ? "BOUND_LISTING_TRUTH" as const
      : "NONE" as const,
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertSemanticPremiseArtifact(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertSemanticPremiseArtifact(value: unknown): SemanticPremiseArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("semantic premise artifact is malformed");
  }
  const artifact = value as SemanticPremiseArtifact;
  const { artifactHash, ...body } = artifact;
  if (
    !exactKeys(artifact, PREMISE_KEYS) ||
    artifact.schemaVersion !== "pmh.semantic-premise.v1" ||
    !HASH_PATTERN.test(String(artifact.premiseId)) ||
    !HASH_PATTERN.test(String(artifact.proposalId)) ||
    !HASH_PATTERN.test(String(artifact.evidenceScopeIdentity)) ||
    !boundedText(artifact.proposition, 1_000) ||
    !boundedText(artifact.rationale, 2_000) ||
    ![
      "SETTLEMENT_INTRINSIC", "TRADED_OUTCOME", "EXTERNAL_OBSERVATION",
      "CAUSAL_HYPOTHESIS",
    ].includes(artifact.kind) ||
    ![
      "PROVEN_IN_SCOPE", "TRADED_VARIABLE", "OBSERVED", "UNRESOLVED", "CONTRADICTED",
    ].includes(artifact.truthPosture) ||
    !["LISTING_TRUTH", "EXTERNAL_OBSERVATION", "NONE"].includes(artifact.binding?.kind) ||
    !["BOUND_LISTING_TRUTH", "NONE"].includes(artifact.exactStateAuthority) ||
    !Array.isArray(artifact.evidenceClaimIds) || artifact.evidenceClaimIds.length > 20 ||
    artifact.evidenceClaimIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    [...artifact.evidenceClaimIds].sort().join("\n") !== artifact.evidenceClaimIds.join("\n") ||
    new Set(artifact.evidenceClaimIds).size !== artifact.evidenceClaimIds.length ||
    artifact.authority !== "PROPOSE_ONLY" ||
    artifact.semanticDecisionAuthority !== false || artifact.certificateAuthority !== false ||
    artifact.executionAuthority !== false || !HASH_PATTERN.test(String(artifactHash)) ||
    artifactHash !== hashCanonical(body)
  ) throw new Error("semantic premise artifact violates its identity or authority contract");
  if (
    !exactKeys(artifact.counterexample, ["attempted", "narrative", "result"]) ||
    artifact.counterexample.attempted !== true ||
    !["FOUND", "NOT_FOUND", "INCONCLUSIVE"].includes(artifact.counterexample.result) ||
    !boundedText(artifact.counterexample.narrative, 2_000) ||
    (artifact.binding.kind === "LISTING_TRUTH" &&
      !exactKeys(artifact.binding, ["kind", "listingHash", "listingRef", "truthValue"])) ||
    (artifact.binding.kind === "EXTERNAL_OBSERVATION" &&
      !exactKeys(artifact.binding, [
        "kind", "observationId", "observedAt", "sourceRawHash", "truthValue",
      ])) ||
    (artifact.binding.kind === "NONE" && !exactKeys(artifact.binding, ["kind"]))
  ) throw new Error("semantic premise artifact contains an extended or malformed binding");
  assertKindPostureBinding(
    artifact.kind,
    artifact.truthPosture,
    artifact.binding,
    artifact.counterexample,
  );
  if (
    (artifact.binding.kind === "LISTING_TRUTH" &&
      (!boundedText(artifact.binding.listingRef, 500) ||
        !HASH_PATTERN.test(String(artifact.binding.listingHash)) ||
        typeof artifact.binding.truthValue !== "boolean")) ||
    (artifact.binding.kind === "EXTERNAL_OBSERVATION" &&
      (!HASH_PATTERN.test(String(artifact.binding.observationId)) ||
        !HASH_PATTERN.test(String(artifact.binding.sourceRawHash)) ||
        !isIso(artifact.binding.observedAt) || typeof artifact.binding.truthValue !== "boolean")) ||
    (artifact.exactStateAuthority === "BOUND_LISTING_TRUTH") !==
      (artifact.binding.kind === "LISTING_TRUTH")
  ) throw new Error("semantic premise artifact binding is malformed");
  const expectedId = hashCanonical({
    schemaVersion: "pmh.semantic-premise-identity.v1",
    proposalId: artifact.proposalId,
    evidenceScopeIdentity: artifact.evidenceScopeIdentity,
    proposition: artifact.proposition,
    kind: artifact.kind,
    truthPosture: artifact.truthPosture,
    binding: artifact.binding,
    evidenceClaimIds: artifact.evidenceClaimIds,
  });
  if (artifact.premiseId !== expectedId) {
    throw new Error("semantic premise artifact identity is inconsistent");
  }
  return Object.freeze(artifact);
}

function normalizedExpression(
  value: SemanticBooleanExpression,
  listingRefs: ReadonlySet<string>,
  premiseIds: ReadonlySet<Hash>,
  depth = 1,
  counter = { leaves: 0 },
): SemanticBooleanExpression {
  if (
    value === null || typeof value !== "object" || Array.isArray(value) ||
    depth > MAX_EXPRESSION_DEPTH
  ) throw new Error("premise relation expression is malformed or too deep");
  if (value.op === "LISTING") {
    counter.leaves += 1;
    if (
      !exactKeys(value, ["equals", "listingRef", "op"]) ||
      !listingRefs.has(value.listingRef) || typeof value.equals !== "boolean"
    ) throw new Error("premise relation listing expression is out of scope");
    return Object.freeze({ op: "LISTING", listingRef: value.listingRef, equals: value.equals });
  }
  if (value.op === "PREMISE") {
    counter.leaves += 1;
    if (!exactKeys(value, ["op", "premiseId"]) || !premiseIds.has(value.premiseId)) {
      throw new Error("premise relation premise expression is out of scope");
    }
    return Object.freeze({ op: "PREMISE", premiseId: value.premiseId });
  }
  if (value.op === "NOT") {
    if (!exactKeys(value, ["op", "operand"])) {
      throw new Error("premise relation NOT expression is malformed");
    }
    return Object.freeze({
      op: "NOT",
      operand: normalizedExpression(value.operand, listingRefs, premiseIds, depth + 1, counter),
    });
  }
  if (!["AND", "OR", "IMPLIES"].includes(value.op)) {
    throw new Error("premise relation expression operator is unsupported");
  }
  const binary = value as Extract<SemanticBooleanExpression, { left: unknown }>;
  if (!exactKeys(binary, ["left", "op", "right"])) {
    throw new Error("premise relation binary expression is malformed");
  }
  let left = normalizedExpression(binary.left, listingRefs, premiseIds, depth + 1, counter);
  let right = normalizedExpression(binary.right, listingRefs, premiseIds, depth + 1, counter);
  if (["AND", "OR"].includes(binary.op) && hashCanonical(right) < hashCanonical(left)) {
    [left, right] = [right, left];
  }
  return Object.freeze({ op: binary.op, left, right });
}

export function bindSemanticBooleanExpression(input: Readonly<{
  expression: SemanticBooleanExpressionDraft;
  listingRefs: readonly string[];
  premiseIdsByKey: Readonly<Record<string, Hash>>;
}>): SemanticBooleanExpression {
  const refs = new Set(input.listingRefs);
  const keys = new Set(Object.keys(input.premiseIdsByKey));
  const counter = { leaves: 0 };
  function bind(
    value: SemanticBooleanExpressionDraft,
    depth: number,
  ): SemanticBooleanExpression {
    if (
      value === null || typeof value !== "object" || Array.isArray(value) ||
      depth > MAX_EXPRESSION_DEPTH
    ) throw new Error("semantic expression draft is malformed or too deep");
    if (value.op === "LISTING") {
      counter.leaves += 1;
      if (
        !exactKeys(value, ["equals", "listingRef", "op"]) ||
        !refs.has(value.listingRef) || typeof value.equals !== "boolean"
      ) throw new Error("semantic expression draft listing is out of scope");
      return Object.freeze({ ...value });
    }
    if (value.op === "PREMISE") {
      counter.leaves += 1;
      const premiseId = input.premiseIdsByKey[value.premiseKey];
      if (
        !exactKeys(value, ["op", "premiseKey"]) || !keys.has(value.premiseKey) ||
        premiseId === undefined
      ) throw new Error("semantic expression draft premise key is out of scope");
      return Object.freeze({ op: "PREMISE", premiseId });
    }
    if (value.op === "NOT") {
      if (!exactKeys(value, ["op", "operand"])) {
        throw new Error("semantic expression draft NOT is malformed");
      }
      return Object.freeze({ op: "NOT", operand: bind(value.operand, depth + 1) });
    }
    if (!["AND", "OR", "IMPLIES"].includes(value.op)) {
      throw new Error("semantic expression draft operator is unsupported");
    }
    const binary = value as Extract<SemanticBooleanExpressionDraft, { left: unknown }>;
    if (!exactKeys(binary, ["left", "op", "right"])) {
      throw new Error("semantic expression draft binary node is malformed");
    }
    let left = bind(binary.left, depth + 1);
    let right = bind(binary.right, depth + 1);
    if (["AND", "OR"].includes(binary.op) && hashCanonical(right) < hashCanonical(left)) {
      [left, right] = [right, left];
    }
    return Object.freeze({ op: binary.op, left, right });
  }
  const bound = bind(input.expression, 1);
  if (counter.leaves < 2 || counter.leaves > MAX_EXPRESSION_LEAVES) {
    throw new Error("semantic expression draft leaf count is invalid");
  }
  return bound;
}

export function bindSemanticExpressionTokens(input: Readonly<{
  tokens: readonly SemanticExpressionTokenDraft[];
  listingRefs: readonly string[];
  premiseIdsByKey: Readonly<Record<string, Hash>>;
}>): SemanticBooleanExpression {
  if (!Array.isArray(input.tokens) || input.tokens.length < 3 || input.tokens.length > 32) {
    throw new Error("semantic expression token program is empty or unbounded");
  }
  const stack: SemanticBooleanExpressionDraft[] = [];
  for (const token of input.tokens) {
    if (token === null || typeof token !== "object" || Array.isArray(token)) {
      throw new Error("semantic expression token is malformed");
    }
    if (token.op === "LISTING") {
      if (!exactKeys(token, ["equals", "listingRef", "op"])) {
        throw new Error("semantic expression listing token is extended");
      }
      stack.push(Object.freeze({ ...token }));
      continue;
    }
    if (token.op === "PREMISE") {
      if (!exactKeys(token, ["op", "premiseKey"])) {
        throw new Error("semantic expression premise token is extended");
      }
      stack.push(Object.freeze({ ...token }));
      continue;
    }
    if (!exactKeys(token, ["op"])) {
      throw new Error("semantic expression operator token is extended");
    }
    if (token.op === "NOT") {
      const operand = stack.pop();
      if (operand === undefined) throw new Error("semantic expression NOT stack underflow");
      stack.push(Object.freeze({ op: "NOT", operand }));
      continue;
    }
    if (!["AND", "OR", "IMPLIES"].includes(token.op)) {
      throw new Error("semantic expression token operator is unsupported");
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) {
      throw new Error("semantic expression binary stack underflow");
    }
    stack.push(Object.freeze({ op: token.op, left, right }));
  }
  if (stack.length !== 1) throw new Error("semantic expression token program leaves extra values");
  return bindSemanticBooleanExpression({
    expression: stack[0]!,
    listingRefs: input.listingRefs,
    premiseIdsByKey: input.premiseIdsByKey,
  });
}

function evaluateExpression(
  expression: SemanticBooleanExpression,
  truths: Readonly<Record<string, boolean>>,
  premises: ReadonlyMap<Hash, SemanticPremiseArtifact>,
): boolean | null {
  if (expression.op === "LISTING") {
    const truth = truths[expression.listingRef];
    return truth === undefined ? null : truth === expression.equals;
  }
  if (expression.op === "PREMISE") {
    const premise = premises.get(expression.premiseId);
    if (premise?.binding.kind === "LISTING_TRUTH") {
      const truth = truths[premise.binding.listingRef];
      return truth === undefined ? null : truth === premise.binding.truthValue;
    }
    if (premise?.binding.kind === "EXTERNAL_OBSERVATION") {
      return premise.binding.truthValue;
    }
    return null;
  }
  if (expression.op === "NOT") {
    const value = evaluateExpression(expression.operand, truths, premises);
    return value === null ? null : !value;
  }
  const left = evaluateExpression(expression.left, truths, premises);
  const right = evaluateExpression(expression.right, truths, premises);
  if (left === null || right === null) return null;
  if (expression.op === "AND") return left && right;
  if (expression.op === "OR") return left || right;
  return !left || right;
}

function classification(
  premises: readonly SemanticPremiseArtifact[],
): PremiseBearingRelationClassification {
  if (premises.some((item) => item.kind === "CAUSAL_HYPOTHESIS")) {
    return "CAUSAL_RESEARCH_ONLY";
  }
  if (premises.some((item) => item.kind === "EXTERNAL_OBSERVATION")) {
    return "CONDITIONAL_OBSERVED";
  }
  if (premises.some((item) => item.kind === "TRADED_OUTCOME")) {
    return "CONDITIONAL_TRADED";
  }
  return "UNCONDITIONAL_HARD";
}

export function buildPremiseBearingRelationArtifact(input: Readonly<{
  constraint: SemanticConstraintArtifact;
  premises: readonly SemanticPremiseArtifact[];
  expression: SemanticBooleanExpression;
}>): PremiseBearingRelationArtifact {
  const constraint = assertSemanticConstraintArtifact(input.constraint);
  if (input.premises.length < 1 || input.premises.length > MAX_PREMISES) {
    throw new Error("premise-bearing relation premise set is empty or unbounded");
  }
  const premises = Object.freeze(input.premises.map(assertSemanticPremiseArtifact).sort(
    (left, right) => left.premiseId.localeCompare(right.premiseId),
  ));
  if (
    new Set(premises.map((item) => item.premiseId)).size !== premises.length ||
    premises.some((item) =>
      item.proposalId !== constraint.proposalId ||
      item.evidenceScopeIdentity !== constraint.evidenceCorpusSnapshotIdentity
    )
  ) throw new Error("premise-bearing relation premise lineage is inconsistent");
  const premiseById = new Map(premises.map((item) => [item.premiseId, item] as const));
  const leafCounter = { leaves: 0 };
  const expression = normalizedExpression(
    input.expression,
    new Set(constraint.listingRefs),
    new Set(premises.map((item) => item.premiseId)),
    1,
    leafCounter,
  );
  if (leafCounter.leaves < 2 || leafCounter.leaves > MAX_EXPRESSION_LEAVES) {
    throw new Error("premise-bearing relation expression leaf count is invalid");
  }
  const evaluatedStates = Object.freeze(constraint.truthTable.map((state) => {
    const expressionValue = evaluateExpression(expression, state.truthByListingRef, premiseById);
    const matchesDisposition = expressionValue !== null &&
      (state.disposition === "FEASIBLE" ? expressionValue :
        state.disposition === "IMPOSSIBLE" ? !expressionValue : false);
    return Object.freeze({
      stateId: state.stateId,
      expressionValue,
      disposition: state.disposition,
      matchesDisposition,
    });
  }).sort((left, right) => left.stateId.localeCompare(right.stateId)));
  const expressionMatchesStateSpace = evaluatedStates.length > 0 &&
    evaluatedStates.every((state) => state.matchesDisposition);
  const relationClassification = classification(premises);
  const constraintAdmission = inspectSemanticConstraintAdmission(constraint);
  const premiseResearchOnly = premises.some((item) =>
    !["SETTLEMENT_INTRINSIC", "TRADED_OUTCOME"].includes(item.kind) ||
    item.exactStateAuthority !== "BOUND_LISTING_TRUTH" ||
    item.counterexample.result !== "NOT_FOUND"
  );
  const blocker = constraintAdmission.status !== "ELIGIBLE"
    ? "BASE_CONSTRAINT_RESEARCH_ONLY" as const
    : premiseResearchOnly
      ? "PREMISE_RESEARCH_ONLY" as const
      : evaluatedStates.some((state) => state.expressionValue === null)
        ? "EXPRESSION_UNRESOLVED" as const
        : !expressionMatchesStateSpace
          ? "EXPRESSION_STATE_MISMATCH" as const
          : null;
  const exactCompilerAdmission = blocker === null ? "ELIGIBLE" as const : "RESEARCH_ONLY" as const;
  const relationIdentityBody = Object.freeze({
    schemaVersion: "pmh.premise-bearing-relation-identity.v1",
    proposalId: constraint.proposalId,
    evidenceScopeIdentity: constraint.evidenceCorpusSnapshotIdentity,
    semanticConstraintArtifactHash: constraint.artifactHash,
    listingRefs: constraint.listingRefs,
    premiseIds: premises.map((item) => item.premiseId),
    expression,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.premise-bearing-relation.v1" as const,
    relationId: hashCanonical(relationIdentityBody),
    proposalId: constraint.proposalId,
    evidenceScopeIdentity: constraint.evidenceCorpusSnapshotIdentity,
    semanticConstraintArtifactHash: constraint.artifactHash,
    listingRefs: Object.freeze([...constraint.listingRefs]),
    premiseIds: Object.freeze(premises.map((item) => item.premiseId)),
    expression,
    classification: relationClassification,
    expressionMatchesStateSpace,
    evaluatedStates,
    exactCompilerAdmission,
    blocker,
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertPremiseBearingRelationArtifact(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertPremiseBearingRelationArtifact(
  value: unknown,
): PremiseBearingRelationArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("premise-bearing relation artifact is malformed");
  }
  const artifact = value as PremiseBearingRelationArtifact;
  const { artifactHash, ...body } = artifact;
  if (
    !exactKeys(artifact, RELATION_KEYS) ||
    artifact.schemaVersion !== "pmh.premise-bearing-relation.v1" ||
    !HASH_PATTERN.test(String(artifact.relationId)) ||
    !HASH_PATTERN.test(String(artifact.proposalId)) ||
    !HASH_PATTERN.test(String(artifact.evidenceScopeIdentity)) ||
    !HASH_PATTERN.test(String(artifact.semanticConstraintArtifactHash)) ||
    !Array.isArray(artifact.listingRefs) || artifact.listingRefs.length < 2 ||
    artifact.listingRefs.length > 4 ||
    new Set(artifact.listingRefs).size !== artifact.listingRefs.length ||
    artifact.listingRefs.some((item) => !boundedText(item, 500)) ||
    !Array.isArray(artifact.premiseIds) || artifact.premiseIds.length < 1 ||
    artifact.premiseIds.length > MAX_PREMISES ||
    artifact.premiseIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    [...artifact.premiseIds].sort().join("\n") !== artifact.premiseIds.join("\n") ||
    new Set(artifact.premiseIds).size !== artifact.premiseIds.length ||
    !["UNCONDITIONAL_HARD", "CONDITIONAL_TRADED", "CONDITIONAL_OBSERVED", "CAUSAL_RESEARCH_ONLY"]
      .includes(artifact.classification) ||
    !["ELIGIBLE", "RESEARCH_ONLY"].includes(artifact.exactCompilerAdmission) ||
    ![
      null, "BASE_CONSTRAINT_RESEARCH_ONLY", "PREMISE_RESEARCH_ONLY",
      "EXPRESSION_UNRESOLVED", "EXPRESSION_STATE_MISMATCH",
    ].includes(artifact.blocker) ||
    !Array.isArray(artifact.evaluatedStates) || artifact.evaluatedStates.length < 1 ||
    artifact.evaluatedStates.length !== 2 ** artifact.listingRefs.length ||
    artifact.evaluatedStates.some((state) =>
      !exactKeys(state, ["disposition", "expressionValue", "matchesDisposition", "stateId"]) ||
      !/^[TF]+$/u.test(state.stateId) ||
      state.stateId.length !== artifact.listingRefs.length ||
      ![true, false, null].includes(state.expressionValue) ||
      !["FEASIBLE", "IMPOSSIBLE", "UNRESOLVED"].includes(state.disposition) ||
      typeof state.matchesDisposition !== "boolean"
    ) ||
    artifact.evaluatedStates.map((state) => state.stateId).join("\n") !==
      [...artifact.evaluatedStates].map((state) => state.stateId).sort().join("\n") ||
    new Set(artifact.evaluatedStates.map((state) => state.stateId)).size !==
      artifact.evaluatedStates.length ||
    artifact.expressionMatchesStateSpace !==
      artifact.evaluatedStates.every((state) => state.matchesDisposition) ||
    (artifact.exactCompilerAdmission === "ELIGIBLE") !== (artifact.blocker === null) ||
    artifact.authority !== "PROPOSE_ONLY" || artifact.semanticDecisionAuthority !== false ||
    artifact.certificateAuthority !== false || artifact.executionAuthority !== false ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body)
  ) throw new Error("premise-bearing relation artifact violates its contract");
  const expressionCounter = { leaves: 0 };
  const canonicalExpression = normalizedExpression(
    artifact.expression,
    new Set(artifact.listingRefs),
    new Set(artifact.premiseIds),
    1,
    expressionCounter,
  );
  if (
    expressionCounter.leaves < 2 || expressionCounter.leaves > MAX_EXPRESSION_LEAVES ||
    hashCanonical(canonicalExpression) !== hashCanonical(artifact.expression)
  ) throw new Error("premise-bearing relation expression is not canonical");
  const expectedId = hashCanonical({
    schemaVersion: "pmh.premise-bearing-relation-identity.v1",
    proposalId: artifact.proposalId,
    evidenceScopeIdentity: artifact.evidenceScopeIdentity,
    semanticConstraintArtifactHash: artifact.semanticConstraintArtifactHash,
    listingRefs: artifact.listingRefs,
    premiseIds: artifact.premiseIds,
    expression: artifact.expression,
  });
  if (artifact.relationId !== expectedId) {
    throw new Error("premise-bearing relation identity is inconsistent");
  }
  return Object.freeze(artifact);
}
