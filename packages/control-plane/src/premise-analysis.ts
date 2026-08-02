import { createDeepSeek, type DeepSeekProviderSettings } from "@ai-sdk/deepseek";
import { generateText, jsonSchema, stepCountIs, tool } from "ai";
import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketRelationProposal } from "./market-archaeologist.js";
import {
  assertPremiseBearingRelationArtifact,
  assertSemanticPremiseArtifact,
  bindSemanticExpressionTokens,
  buildPremiseBearingRelationArtifact,
  buildSemanticPremiseArtifact,
  type PremiseBearingRelationArtifact,
  type SemanticExpressionTokenDraft,
  type SemanticPremiseArtifact,
  type SemanticPremiseDraft,
} from "./semantic-premise.js";
import {
  assertSemanticReviewRecord,
  type SemanticReviewRecord,
} from "./semantic-review.js";
import {
  assertSemanticConstraintArtifact,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MODEL_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/u;
const PREMISE_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/u;
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_MAX_OUTPUT_TOKENS = 1_800;
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_RETENTION_LIMIT = 250;
const MAX_STEPS = 16;
const MAX_PREMISES = 8;
const ANALYSIS_KEYS = Object.freeze([
  "analysisId", "artifactHash", "authority", "certificateAuthority", "completedAt",
  "evidenceScopeIdentity", "executionAuthority", "interpreter", "premises", "proposalId",
  "relation", "schemaVersion", "semanticConstraint", "semanticDecisionAuthority",
  "semanticReviewArtifactHash", "trace",
]);
const INTERPRETER_KEYS = Object.freeze([
  "identity", "model", "provider", "role", "transport",
]);
const TRACE_KEYS = Object.freeze([
  "maximumSteps", "premiseEffectCount", "rejectedEffectCount", "submittedEffectHash",
  "terminalEffectEndsLoop", "wholeResponseSchemaParsing",
]);
const RECORD_KEYS = Object.freeze([
  "analysis", "analysisId", "completedAt", "diagnostic", "evidenceScopeIdentity",
  "interpreterIdentity", "model", "proposalId", "semanticReviewArtifactHash", "startedAt",
  "status",
]);

export type PremiseAnalysisArtifact = Readonly<{
  schemaVersion: "pmh.premise-analysis.v1";
  analysisId: Hash;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  evidenceScopeIdentity: Hash;
  semanticConstraint: SemanticConstraintArtifact;
  premises: readonly SemanticPremiseArtifact[];
  relation: PremiseBearingRelationArtifact;
  interpreter: Readonly<{
    identity: Hash;
    transport: "VERCEL_AI_SDK";
    provider: "deepseek";
    model: string;
    role: "SEMANTIC_PREMISE_ANALYST";
  }>;
  trace: Readonly<{
    maximumSteps: 16;
    premiseEffectCount: number;
    rejectedEffectCount: number;
    submittedEffectHash: Hash;
    wholeResponseSchemaParsing: false;
    terminalEffectEndsLoop: true;
  }>;
  completedAt: string;
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type PremiseAnalysisRecord = Readonly<{
  analysisId: Hash;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  evidenceScopeIdentity: Hash;
  interpreterIdentity: Hash;
  model: string;
  status: "RUNNING" | "PASS" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  diagnostic: string | null;
  analysis: PremiseAnalysisArtifact | null;
}>;

export interface PremiseAnalysisRecordStore {
  readonly premiseAnalysisStorage: OperationalStorageProjection<"analysisId">;
  loadPremiseAnalysisRecords(limit: number): readonly PremiseAnalysisRecord[];
  savePremiseAnalysisRecord(
    record: PremiseAnalysisRecord,
    retentionLimit: number,
  ): PremiseAnalysisRecord;
}

export type PremiseAnalysisDeskProjection = Readonly<{
  schemaVersion: "pmh.premise-analysis-desk.v1";
  configured: boolean;
  model: string;
  interpreterIdentity: Hash;
  status: "IDLE" | "RUNNING" | "NEEDS_KEY";
  activeCount: number;
  runCount: number;
  passCount: number;
  failedCount: number;
  exactEligibleCount: number;
  researchOnlyCount: number;
  concurrencyLimit: number;
  records: readonly PremiseAnalysisRecord[];
  storage: OperationalStorageProjection<"analysisId">;
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

type PremiseAnalysisModelInput = Readonly<{
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
}>;

type PremiseAnalysisModelResult = Readonly<{
  premises: readonly SemanticPremiseArtifact[];
  relation: PremiseBearingRelationArtifact;
  trace: Readonly<{
    premiseEffectCount: number;
    rejectedEffectCount: number;
    submittedEffectHash: Hash;
  }>;
}>;

export interface PremiseAnalysisModelPort {
  analyze(input: PremiseAnalysisModelInput): Promise<PremiseAnalysisModelResult>;
}

export type PremiseAnalysisFetchLike = NonNullable<DeepSeekProviderSettings["fetch"]>;

type PremiseToolInput = SemanticPremiseDraft & Readonly<{ premiseKey: string }>;
type SubmitToolInput = Readonly<{ tokens: readonly SemanticExpressionTokenDraft[] }>;

const premiseToolSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "premiseKey", "proposition", "kind", "truthPosture", "binding",
    "evidenceClaimIds", "rationale", "counterexample",
  ],
  properties: {
    premiseKey: { type: "string", pattern: "^[a-z][a-z0-9_-]{0,63}$" },
    proposition: { type: "string", minLength: 1, maxLength: 1_000 },
    kind: {
      type: "string",
      enum: ["SETTLEMENT_INTRINSIC", "TRADED_OUTCOME", "CAUSAL_HYPOTHESIS"],
    },
    truthPosture: {
      type: "string",
      enum: ["PROVEN_IN_SCOPE", "TRADED_VARIABLE", "UNRESOLVED", "CONTRADICTED"],
    },
    binding: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "listingRef", "truthValue"],
          properties: {
            kind: { const: "LISTING_TRUTH" },
            listingRef: { type: "string", minLength: 1, maxLength: 500 },
            truthValue: { type: "boolean" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind"],
          properties: { kind: { const: "NONE" } },
        },
      ],
    },
    evidenceClaimIds: {
      type: "array",
      maxItems: 20,
      items: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    },
    rationale: { type: "string", minLength: 1, maxLength: 2_000 },
    counterexample: {
      type: "object",
      additionalProperties: false,
      required: ["attempted", "result", "narrative"],
      properties: {
        attempted: { const: true },
        result: { type: "string", enum: ["FOUND", "NOT_FOUND", "INCONCLUSIVE"] },
        narrative: { type: "string", minLength: 1, maxLength: 2_000 },
      },
    },
  },
} as const);

const tokenSchema = Object.freeze({
  oneOf: [
    {
      type: "object", additionalProperties: false,
      required: ["op", "listingRef", "equals"],
      properties: {
        op: { const: "LISTING" },
        listingRef: { type: "string", minLength: 1, maxLength: 500 },
        equals: { type: "boolean" },
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["op", "premiseKey"],
      properties: {
        op: { const: "PREMISE" },
        premiseKey: { type: "string", pattern: "^[a-z][a-z0-9_-]{0,63}$" },
      },
    },
    ...["NOT", "AND", "OR", "IMPLIES"].map((op) => ({
      type: "object" as const,
      additionalProperties: false,
      required: ["op"],
      properties: { op: { const: op } },
    })),
  ],
} as const);

const submitToolSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["tokens"],
  properties: {
    tokens: { type: "array", minItems: 3, maxItems: 32, items: tokenSchema },
  },
} as const);

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function compactDiagnostic(value: unknown): string {
  return (value instanceof Error ? value.message : String(value))
    .trim().replace(/\s+/gu, " ").slice(0, 500) || "premise analysis failed";
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");
}

function interpreterIdentity(model: string): Hash {
  return hashCanonical({
    schemaVersion: "pmh.premise-analysis-interpreter.v1",
    transport: "VERCEL_AI_SDK",
    provider: "deepseek",
    model,
    role: "SEMANTIC_PREMISE_ANALYST",
    toolProtocol: "RECORDED_PREMISES_POSTFIX_RELATION_TERMINAL_EFFECT",
    maximumSteps: MAX_STEPS,
  });
}

function validatedInput(input: PremiseAnalysisModelInput) {
  const review = assertSemanticReviewRecord(input.review);
  const report = review.report;
  if (
    review.status !== "PASS" || report === null ||
    report.input.proposalId !== input.proposal.proposalId ||
    report.result.semanticConstraint === undefined ||
    report.input.listingEvidence.length < 2 || report.input.listingEvidence.length > 4 ||
    report.input.listingEvidence.map((item) => item.listingRef).join("\n") !==
      input.proposal.listingRefs.join("\n") ||
    report.result.semanticConstraint.evidenceCorpusSnapshotIdentity !==
      review.corpusSnapshotIdentity
  ) throw new Error("premise analysis requires one passed scoped semantic constraint");
  return Object.freeze({ proposal: input.proposal, review, report });
}

function analysisId(input: PremiseAnalysisModelInput, identity: Hash): Hash {
  const validated = validatedInput(input);
  return hashCanonical({
    schemaVersion: "pmh.premise-analysis-run.v1",
    proposalId: validated.proposal.proposalId,
    semanticReviewArtifactHash: validated.report.artifactHash,
    evidenceScopeIdentity: validated.review.corpusSnapshotIdentity,
    interpreterIdentity: identity,
  });
}

export class DeepSeekPremiseAnalysisModelPort implements PremiseAnalysisModelPort {
  readonly #fetcher: PremiseAnalysisFetchLike | undefined;

  public constructor(
    private readonly model: string,
    private readonly apiKey: string,
    private readonly maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    fetcher?: PremiseAnalysisFetchLike,
  ) {
    this.#fetcher = fetcher;
    if (
      apiKey.trim() === "" || !MODEL_PATTERN.test(model) ||
      !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 512 ||
      maxOutputTokens > 4_096 || !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1_000 || timeoutMs > 600_000
    ) throw new Error("premise analysis model configuration is invalid");
  }

  public async analyze(input: PremiseAnalysisModelInput): Promise<PremiseAnalysisModelResult> {
    const validated = validatedInput(input);
    const constraint = validated.report.result.semanticConstraint!;
    const listingBindings = validated.report.input.listingEvidence.map((item) => ({
      listingRef: item.listingRef,
      listingHash: item.listingHash,
    }));
    const availableClaimIds = Object.freeze(
      (validated.report.input.evidenceClaims ?? []).map((claim) => claim.claimId),
    );
    const premisesByKey = new Map<string, SemanticPremiseArtifact>();
    let rejectedEffectCount = 0;
    let submitted: PremiseBearingRelationArtifact | null = null;
    let submittedEffectHash: Hash | null = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const provider = createDeepSeek({
        apiKey: this.apiKey.trim(),
        ...(this.#fetcher === undefined ? {} : { fetch: this.#fetcher }),
      });
      await generateText({
        model: provider(this.model),
        maxOutputTokens: this.maxOutputTokens,
        maxRetries: 0,
        abortSignal: controller.signal,
        toolChoice: "required",
        stopWhen: [() => submitted !== null, stepCountIs(MAX_STEPS)],
        tools: {
          record_hidden_premise: tool({
            description:
              "Record one explicit hidden premise needed by the proposed settlement relation. " +
              "Bind it to an offered listing truth or leave a causal hypothesis unbound.",
            inputSchema: jsonSchema<PremiseToolInput>(premiseToolSchema),
            execute: async (raw) => {
              try {
                if (!PREMISE_KEY_PATTERN.test(raw.premiseKey)) {
                  throw new Error("premise key is invalid");
                }
                const artifact = buildSemanticPremiseArtifact({
                  proposalId: validated.proposal.proposalId,
                  evidenceScopeIdentity: validated.review.corpusSnapshotIdentity,
                  draft: raw,
                  listings: listingBindings,
                  availableEvidenceClaimIds: availableClaimIds,
                });
                const existing = premisesByKey.get(raw.premiseKey);
                if (existing !== undefined && existing.premiseId !== artifact.premiseId) {
                  throw new Error("premise key is already bound to a different proposition");
                }
                premisesByKey.set(raw.premiseKey, artifact);
                return Object.freeze({
                  accepted: true,
                  premiseKey: raw.premiseKey,
                  premiseId: artifact.premiseId,
                  exactStateAuthority: artifact.exactStateAuthority,
                  semanticDecisionAuthority: false,
                  certificateAuthority: false,
                  executionAuthority: false,
                });
              } catch (error) {
                rejectedEffectCount += 1;
                return Object.freeze({
                  accepted: false,
                  diagnostic: compactDiagnostic(error),
                  semanticDecisionAuthority: false,
                  certificateAuthority: false,
                  executionAuthority: false,
                });
              }
            },
          }),
          submit_premise_relation: tool({
            description:
              "Submit one postfix boolean expression over recorded premise keys and exact listing truths. " +
              "This terminal effect is advisory and must match the retained truth table.",
            inputSchema: jsonSchema<SubmitToolInput>(submitToolSchema),
            execute: async (raw) => {
              try {
                if (premisesByKey.size < 1) throw new Error("record a hidden premise first");
                const premiseIdsByKey = Object.fromEntries(
                  [...premisesByKey].map(([key, premise]) => [key, premise.premiseId]),
                );
                const expression = bindSemanticExpressionTokens({
                  tokens: raw.tokens,
                  listingRefs: constraint.listingRefs,
                  premiseIdsByKey,
                });
                const relation = buildPremiseBearingRelationArtifact({
                  constraint,
                  premises: [...premisesByKey.values()],
                  expression,
                });
                submitted = relation;
                submittedEffectHash = hashCanonical({
                  schemaVersion: "pmh.premise-analysis-terminal-effect.v1",
                  premiseIds: relation.premiseIds,
                  relationId: relation.relationId,
                });
                return Object.freeze({
                  accepted: true,
                  relationId: relation.relationId,
                  classification: relation.classification,
                  exactCompilerAdmission: relation.exactCompilerAdmission,
                  blocker: relation.blocker,
                  semanticDecisionAuthority: false,
                  certificateAuthority: false,
                  executionAuthority: false,
                  effectHash: submittedEffectHash,
                });
              } catch (error) {
                rejectedEffectCount += 1;
                return Object.freeze({
                  accepted: false,
                  diagnostic: compactDiagnostic(error),
                  semanticDecisionAuthority: false,
                  certificateAuthority: false,
                  executionAuthority: false,
                });
              }
            },
          }),
        },
        system:
          "You audit one prediction-market semantic review for hidden premises. " +
          "A premise is any fact needed before a joint truth state can be called impossible. " +
          "Record each premise with record_hidden_premise. SETTLEMENT_INTRINSIC means an exact " +
          "offered market truth entails it; TRADED_OUTCOME means another offered market truth " +
          "is the condition; CAUSAL_HYPOTHESIS is an unbound world story and must remain " +
          "UNRESOLVED or CONTRADICTED. Never invent a listing, evidence claim, observation, " +
          "URL, or hash. Then call submit_premise_relation with a postfix expression: emit " +
          "LISTING/PREMISE leaves first, then NOT/AND/OR/IMPLIES operators. The exact expression " +
          "must be true for every FEASIBLE retained state and false for every IMPOSSIBLE state. " +
          "A rejected tool effect is diagnostic feedback; correct it and continue. Do not estimate " +
          "profitability, certify a relation, or propose trading action.",
        prompt: JSON.stringify({
          schemaVersion: "pmh.premise-analysis-input.v1",
          proposal: validated.proposal,
          review: {
            semanticReviewArtifactHash: validated.report.artifactHash,
            evidenceScopeIdentity: validated.review.corpusSnapshotIdentity,
            relationConclusion: validated.report.result.relationConclusion,
            rationale: validated.report.result.rationale,
            assessments: validated.report.result.assessments,
            counterexamples: validated.report.result.counterexamples,
            missingEvidence: validated.report.result.missingEvidence,
            semanticConstraint: constraint,
            listingEvidence: validated.report.input.listingEvidence,
            ruleEvidenceClaims: validated.report.input.evidenceClaims ?? [],
          },
        }),
        providerOptions: {
          deepseek: { thinking: { type: "disabled" }, strictJsonSchema: false },
        },
      });
      if (submitted === null || submittedEffectHash === null) {
        throw new Error("premise analyst completed without an accepted terminal relation effect");
      }
      return Object.freeze({
        premises: Object.freeze([...premisesByKey.values()].sort(
          (left, right) => left.premiseId.localeCompare(right.premiseId),
        )),
        relation: submitted,
        trace: Object.freeze({
          premiseEffectCount: premisesByKey.size,
          rejectedEffectCount,
          submittedEffectHash,
        }),
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error("premise analysis timed out");
      throw new Error(`premise analysis failed: ${compactDiagnostic(error)}`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildAnalysis(input: Readonly<{
  analysisId: Hash;
  review: SemanticReviewRecord;
  model: string;
  interpreterIdentity: Hash;
  result: PremiseAnalysisModelResult;
  completedAt: string;
}>): PremiseAnalysisArtifact {
  const review = assertSemanticReviewRecord(input.review);
  const report = review.report!;
  const premises = Object.freeze(input.result.premises.map(assertSemanticPremiseArtifact));
  const relation = assertPremiseBearingRelationArtifact(input.result.relation);
  const semanticConstraint = assertSemanticConstraintArtifact(
    report.result.semanticConstraint,
  );
  if (
    !isIso(input.completedAt) || premises.length < 1 || premises.length > MAX_PREMISES ||
    relation.proposalId !== review.proposalId ||
    relation.semanticConstraintArtifactHash !== report.result.semanticConstraint?.artifactHash ||
    relation.premiseIds.join("\n") !== premises.map((item) => item.premiseId).sort().join("\n") ||
    premises.some((item) =>
      item.proposalId !== review.proposalId ||
      item.evidenceScopeIdentity !== review.corpusSnapshotIdentity
    )
  ) throw new Error("premise analysis result lineage is inconsistent");
  const body = Object.freeze({
    schemaVersion: "pmh.premise-analysis.v1" as const,
    analysisId: input.analysisId,
    proposalId: review.proposalId,
    semanticReviewArtifactHash: report.artifactHash,
    evidenceScopeIdentity: review.corpusSnapshotIdentity,
    semanticConstraint,
    premises,
    relation,
    interpreter: Object.freeze({
      identity: input.interpreterIdentity,
      transport: "VERCEL_AI_SDK" as const,
      provider: "deepseek" as const,
      model: input.model,
      role: "SEMANTIC_PREMISE_ANALYST" as const,
    }),
    trace: Object.freeze({
      maximumSteps: MAX_STEPS as 16,
      premiseEffectCount: input.result.trace.premiseEffectCount,
      rejectedEffectCount: input.result.trace.rejectedEffectCount,
      submittedEffectHash: input.result.trace.submittedEffectHash,
      wholeResponseSchemaParsing: false as const,
      terminalEffectEndsLoop: true as const,
    }),
    completedAt: input.completedAt,
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertPremiseAnalysisArtifact(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertPremiseAnalysisArtifact(value: unknown): PremiseAnalysisArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("premise analysis artifact is malformed");
  }
  const artifact = value as PremiseAnalysisArtifact;
  const { artifactHash, ...body } = artifact;
  if (
    !exactKeys(artifact, ANALYSIS_KEYS) ||
    artifact.schemaVersion !== "pmh.premise-analysis.v1" ||
    !HASH_PATTERN.test(String(artifact.analysisId)) ||
    !HASH_PATTERN.test(String(artifact.proposalId)) ||
    !HASH_PATTERN.test(String(artifact.semanticReviewArtifactHash)) ||
    !HASH_PATTERN.test(String(artifact.evidenceScopeIdentity)) ||
    !Array.isArray(artifact.premises) || artifact.premises.length < 1 ||
    artifact.premises.length > MAX_PREMISES ||
    !HASH_PATTERN.test(String(artifact.interpreter?.identity)) ||
    artifact.interpreter.transport !== "VERCEL_AI_SDK" ||
    artifact.interpreter.provider !== "deepseek" ||
    !MODEL_PATTERN.test(artifact.interpreter.model) ||
    artifact.interpreter.role !== "SEMANTIC_PREMISE_ANALYST" ||
    artifact.trace.maximumSteps !== MAX_STEPS ||
    artifact.trace.premiseEffectCount !== artifact.premises.length ||
    !Number.isSafeInteger(artifact.trace.rejectedEffectCount) ||
    artifact.trace.rejectedEffectCount < 0 ||
    !HASH_PATTERN.test(String(artifact.trace.submittedEffectHash)) ||
    artifact.trace.wholeResponseSchemaParsing !== false ||
    artifact.trace.terminalEffectEndsLoop !== true ||
    !isIso(artifact.completedAt) || artifact.authority !== "PROPOSE_ONLY" ||
    artifact.semanticDecisionAuthority !== false || artifact.certificateAuthority !== false ||
    artifact.executionAuthority !== false || !HASH_PATTERN.test(String(artifactHash)) ||
    artifactHash !== hashCanonical(body)
  ) throw new Error("premise analysis artifact violates its bounded authority contract");
  if (
    !exactKeys(artifact.interpreter, INTERPRETER_KEYS) ||
    !exactKeys(artifact.trace, TRACE_KEYS)
  ) throw new Error("premise analysis artifact contains extended interpreter or trace data");
  const semanticConstraint = assertSemanticConstraintArtifact(artifact.semanticConstraint);
  const premises = artifact.premises.map(assertSemanticPremiseArtifact);
  const relation = assertPremiseBearingRelationArtifact(artifact.relation);
  const rebuiltRelation = buildPremiseBearingRelationArtifact({
    constraint: semanticConstraint,
    premises,
    expression: relation.expression,
  });
  const expectedInterpreterIdentity = interpreterIdentity(artifact.interpreter.model);
  const expectedAnalysisId = hashCanonical({
    schemaVersion: "pmh.premise-analysis-run.v1",
    proposalId: artifact.proposalId,
    semanticReviewArtifactHash: artifact.semanticReviewArtifactHash,
    evidenceScopeIdentity: artifact.evidenceScopeIdentity,
    interpreterIdentity: artifact.interpreter.identity,
  });
  const expectedEffectHash = hashCanonical({
    schemaVersion: "pmh.premise-analysis-terminal-effect.v1",
    premiseIds: relation.premiseIds,
    relationId: relation.relationId,
  });
  if (
    new Set(premises.map((item) => item.premiseId)).size !== premises.length ||
    premises.some((item) =>
      item.proposalId !== artifact.proposalId ||
      item.evidenceScopeIdentity !== artifact.evidenceScopeIdentity
    ) ||
    relation.proposalId !== artifact.proposalId ||
    relation.evidenceScopeIdentity !== artifact.evidenceScopeIdentity ||
    semanticConstraint.proposalId !== artifact.proposalId ||
    semanticConstraint.evidenceCorpusSnapshotIdentity !== artifact.evidenceScopeIdentity ||
    relation.semanticConstraintArtifactHash !== semanticConstraint.artifactHash ||
    rebuiltRelation.artifactHash !== relation.artifactHash ||
    relation.premiseIds.join("\n") !== premises.map((item) => item.premiseId).sort().join("\n") ||
    artifact.interpreter.identity !== expectedInterpreterIdentity ||
    artifact.analysisId !== expectedAnalysisId ||
    artifact.trace.submittedEffectHash !== expectedEffectHash
  ) throw new Error("premise analysis artifact lineage is inconsistent");
  return Object.freeze(artifact);
}

export function assertPremiseAnalysisRecord(value: unknown): PremiseAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("premise analysis record is malformed");
  }
  const record = value as PremiseAnalysisRecord;
  const running = record.status === "RUNNING";
  const passed = record.status === "PASS";
  if (
    !exactKeys(record, RECORD_KEYS) ||
    !HASH_PATTERN.test(String(record.analysisId)) || !HASH_PATTERN.test(String(record.proposalId)) ||
    !HASH_PATTERN.test(String(record.semanticReviewArtifactHash)) ||
    !HASH_PATTERN.test(String(record.evidenceScopeIdentity)) ||
    !HASH_PATTERN.test(String(record.interpreterIdentity)) || !MODEL_PATTERN.test(record.model) ||
    !["RUNNING", "PASS", "FAILED"].includes(record.status) || !isIso(record.startedAt) ||
    (running !== (record.completedAt === null)) ||
    (record.completedAt !== null && !isIso(record.completedAt)) ||
    (running && (record.diagnostic !== null || record.analysis !== null)) ||
    (passed && (record.diagnostic !== null || record.analysis === null)) ||
    (record.status === "FAILED" &&
      (typeof record.diagnostic !== "string" || record.diagnostic.trim() === "" ||
        record.analysis !== null))
  ) throw new Error("premise analysis record violates its contract");
  if (record.analysis !== null) {
    const artifact = assertPremiseAnalysisArtifact(record.analysis);
    if (
      artifact.analysisId !== record.analysisId || artifact.proposalId !== record.proposalId ||
      artifact.semanticReviewArtifactHash !== record.semanticReviewArtifactHash ||
      artifact.evidenceScopeIdentity !== record.evidenceScopeIdentity ||
      artifact.interpreter.identity !== record.interpreterIdentity ||
      artifact.interpreter.model !== record.model || artifact.completedAt !== record.completedAt
    ) throw new Error("premise analysis record artifact lineage is inconsistent");
  }
  return Object.freeze(record);
}

export class PremiseAnalysisNotConfiguredError extends Error {}
export class PremiseAnalysisBusyError extends Error {}

export class PremiseAnalysisDesk {
  readonly #records: PremiseAnalysisRecord[];
  readonly #active = new Map<Hash, Promise<PremiseAnalysisRecord>>();
  public readonly interpreterIdentity: Hash;

  public constructor(
    private readonly analyst: PremiseAnalysisModelPort | null,
    public readonly model: string,
    private readonly retentionLimit = DEFAULT_RETENTION_LIMIT,
    private readonly store?: PremiseAnalysisRecordStore,
    public readonly concurrencyLimit = 3,
  ) {
    if (
      !MODEL_PATTERN.test(model) || !Number.isSafeInteger(retentionLimit) || retentionLimit < 1 ||
      !Number.isSafeInteger(concurrencyLimit) || concurrencyLimit < 1 || concurrencyLimit > 8
    ) throw new Error("premise analysis desk configuration is invalid");
    this.interpreterIdentity = interpreterIdentity(model);
    this.#records = [...(store?.loadPremiseAnalysisRecords(retentionLimit) ?? [])]
      .map(assertPremiseAnalysisRecord);
  }

  public idFor(proposal: MarketRelationProposal, review: SemanticReviewRecord): Hash {
    return analysisId({ proposal, review }, this.interpreterIdentity);
  }

  public begin(
    proposal: MarketRelationProposal,
    review: SemanticReviewRecord,
  ): Readonly<{ promise: Promise<PremiseAnalysisRecord>; idempotentReplay: boolean }> {
    if (this.analyst === null) {
      throw new PremiseAnalysisNotConfiguredError("premise analysis requires DEEPSEEK_API_KEY");
    }
    const validated = validatedInput({ proposal, review });
    const id = this.idFor(proposal, review);
    const active = this.#active.get(id);
    if (active !== undefined) return Object.freeze({ promise: active, idempotentReplay: true });
    const existing = this.#records.find((item) => item.analysisId === id);
    if (existing !== undefined && existing.status !== "FAILED") {
      return Object.freeze({ promise: Promise.resolve(existing), idempotentReplay: true });
    }
    if (this.#active.size >= this.concurrencyLimit) {
      throw new PremiseAnalysisBusyError("premise analysis concurrency limit is active");
    }
    const startedAt = new Date().toISOString();
    const running: PremiseAnalysisRecord = Object.freeze({
      analysisId: id,
      proposalId: proposal.proposalId,
      semanticReviewArtifactHash: validated.report.artifactHash,
      evidenceScopeIdentity: validated.review.corpusSnapshotIdentity,
      interpreterIdentity: this.interpreterIdentity,
      model: this.model,
      status: "RUNNING",
      startedAt,
      completedAt: null,
      diagnostic: null,
      analysis: null,
    });
    this.#replace(running);
    const promise = this.analyst.analyze({ proposal, review: validated.review }).then(
      (result): PremiseAnalysisRecord => {
        const completedAt = new Date().toISOString();
        const analysis = buildAnalysis({
          analysisId: id,
          review: validated.review,
          model: this.model,
          interpreterIdentity: this.interpreterIdentity,
          result,
          completedAt,
        });
        return Object.freeze({
          ...running,
          status: "PASS" as const,
          completedAt,
          analysis,
        });
      },
      (error: unknown): PremiseAnalysisRecord => Object.freeze({
        ...running,
        status: "FAILED" as const,
        completedAt: new Date().toISOString(),
        diagnostic: compactDiagnostic(error),
      }),
    ).then((record) => {
      const stored = this.#replace(record);
      this.#active.delete(id);
      return stored;
    });
    this.#active.set(id, promise);
    return Object.freeze({ promise, idempotentReplay: false });
  }

  #replace(record: PremiseAnalysisRecord): PremiseAnalysisRecord {
    const valid = assertPremiseAnalysisRecord(record);
    const stored = valid.status === "RUNNING"
      ? valid
      : this.store?.savePremiseAnalysisRecord(valid, this.retentionLimit) ?? valid;
    const index = this.#records.findIndex((item) => item.analysisId === stored.analysisId);
    if (index >= 0) this.#records.splice(index, 1);
    this.#records.unshift(stored);
    if (this.#records.length > this.retentionLimit) this.#records.length = this.retentionLimit;
    return stored;
  }

  public projection(): PremiseAnalysisDeskProjection {
    const records = Object.freeze([...this.#records]);
    return Object.freeze({
      schemaVersion: "pmh.premise-analysis-desk.v1",
      configured: this.analyst !== null,
      model: this.model,
      interpreterIdentity: this.interpreterIdentity,
      status: this.analyst === null ? "NEEDS_KEY" : this.#active.size > 0 ? "RUNNING" : "IDLE",
      activeCount: this.#active.size,
      runCount: records.length,
      passCount: records.filter((item) => item.status === "PASS").length,
      failedCount: records.filter((item) => item.status === "FAILED").length,
      exactEligibleCount: records.filter((item) =>
        item.analysis?.relation.exactCompilerAdmission === "ELIGIBLE"
      ).length,
      researchOnlyCount: records.filter((item) =>
        item.analysis?.relation.exactCompilerAdmission === "RESEARCH_ONLY"
      ).length,
      concurrencyLimit: this.concurrencyLimit,
      records,
      storage: this.store?.premiseAnalysisStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "analysisId" as const,
      }),
      authority: "PROPOSE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: Object.freeze({
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}

export function createPremiseAnalysisDesk(
  environment: Readonly<Record<string, string | undefined>>,
  options: Readonly<{
    analyst?: PremiseAnalysisModelPort;
    store?: PremiseAnalysisRecordStore;
    retentionLimit?: number;
  }> = {},
): PremiseAnalysisDesk {
  const model = environment.PMH_PREMISE_ANALYSIS_MODEL?.trim() || DEFAULT_MODEL;
  const key = environment.DEEPSEEK_API_KEY?.trim() ?? "";
  const concurrency = boundedInteger(
    environment.PMH_PREMISE_ANALYSIS_CONCURRENCY,
    3,
    1,
    8,
    "PMH_PREMISE_ANALYSIS_CONCURRENCY",
  );
  const maxOutputTokens = boundedInteger(
    environment.PMH_PREMISE_ANALYSIS_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    512,
    4_096,
    "PMH_PREMISE_ANALYSIS_MAX_OUTPUT_TOKENS",
  );
  const timeoutMs = boundedInteger(
    environment.PMH_PREMISE_ANALYSIS_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    1_000,
    600_000,
    "PMH_PREMISE_ANALYSIS_TIMEOUT_MS",
  );
  const analyst = options.analyst ?? (key === "" ? null : new DeepSeekPremiseAnalysisModelPort(
    model,
    key,
    maxOutputTokens,
    timeoutMs,
  ));
  return new PremiseAnalysisDesk(
    analyst,
    model,
    options.retentionLimit ?? DEFAULT_RETENTION_LIMIT,
    options.store,
    concurrency,
  );
}
