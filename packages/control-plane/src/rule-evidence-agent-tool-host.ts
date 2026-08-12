import { hashCanonical, type Hash } from "@pmh/domain";
import {
  ruleEvidencePassageIdentity,
  validateRuleEvidenceClaimDraft,
  type RuleEvidenceClaimModelResult,
} from "./rule-evidence-claim.js";
import {
  validateRuleEvidenceTextInput,
  type RuleEvidenceTextInput,
  type ValidatedRuleEvidenceTextInput,
} from "./rule-evidence-text-source.js";
import type {
  AgentRuntimeToolDefinition,
  AgentToolHost,
  AgentToolHostContext,
} from "./agent-runtime-adapter.js";

const MAX_READ_CHARACTERS = 4_000;
const MAX_REQUESTED_READ_CHARACTERS = 1_000_000;
const MAX_MATCHES = 5;

const MANIFEST: readonly AgentRuntimeToolDefinition[] = Object.freeze([
  Object.freeze({
    name: "search_evidence_text",
    description: "Search retained evidence for a literal phrase and return bounded exact ranges.",
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string", minLength: 1, maxLength: 120 } },
    }),
  }),
  Object.freeze({
    name: "read_evidence_text",
    description: "Read one bounded exact character range from retained evidence.",
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: ["start", "length"],
      properties: {
        start: { type: "integer", minimum: 0 },
        length: { type: "integer", minimum: 1, maximum: MAX_REQUESTED_READ_CHARACTERS },
      },
    }),
  }),
  Object.freeze({
    name: "submit_rule_evidence_claim",
    description: "Submit an advisory claim using passage IDs previously returned by a text tool.",
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: ["disposition", "rationale", "citations", "unresolvedEvidence"],
      properties: {
        disposition: { type: "string", enum: ["SUPPORTS", "CONTRADICTS", "INCONCLUSIVE"] },
        rationale: { type: "string", minLength: 1, maxLength: 2_000 },
        citations: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["passageId"],
            properties: { passageId: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" } },
          },
        },
        unresolvedEvidence: {
          type: "array",
          maxItems: 8,
          items: { type: "string", minLength: 1, maxLength: 1_000 },
        },
      },
    }),
  }),
]);

type RunState = {
  inspected: Map<Hash, Readonly<{ start: number; end: number }>>;
  inspectionCount: number;
  searchEffectCount: number;
  readEffectCount: number;
};

type RetainRuleEvidenceAgentResult = (
  context: AgentToolHostContext,
  source: ValidatedRuleEvidenceTextInput,
  result: RuleEvidenceClaimModelResult,
) => Promise<Readonly<{ claimId: Hash; artifactHash: Hash }>> | Readonly<{
  claimId: Hash;
  artifactHash: Hash;
}>;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export class RuleEvidenceAgentToolHost implements AgentToolHost {
  public resultToolNames(toolProtocol: string): readonly string[] {
    if (toolProtocol !== "RULE_EVIDENCE_TOOLS_V1") {
      throw new Error("rule evidence tool protocol is unsupported");
    }
    return Object.freeze(["submit_rule_evidence_claim"]);
  }

  readonly #runs = new Map<Hash, RunState>();

  public constructor(
    private readonly resolveInput: (
      taskId: Hash,
    ) => ValidatedRuleEvidenceTextInput | RuleEvidenceTextInput | null,
    private readonly retainResult?: RetainRuleEvidenceAgentResult,
  ) {}

  public manifest(toolProtocol: string): readonly AgentRuntimeToolDefinition[] {
    if (toolProtocol !== "RULE_EVIDENCE_TOOLS_V1") return Object.freeze([]);
    return MANIFEST;
  }

  public async execute(context: AgentToolHostContext): Promise<Readonly<{
    status: "ACCEPTED" | "REJECTED";
    output: unknown;
  }>> {
    if (context.executionProfile.toolPolicy.protocol !== "RULE_EVIDENCE_TOOLS_V1") {
      return Object.freeze({ status: "REJECTED", output: { diagnostic: "tool protocol unavailable" } });
    }
    const rawSource = this.resolveInput(context.task.taskId);
    if (rawSource === null) {
      return Object.freeze({
        status: "REJECTED",
        output: { diagnostic: "retained Rule Evidence input is unavailable" },
      });
    }
    const source = "source" in rawSource
      ? rawSource
      : validateRuleEvidenceTextInput(rawSource);
    const state = this.#runs.get(context.run.runId) ?? {
      inspected: new Map<Hash, Readonly<{ start: number; end: number }>>(),
      inspectionCount: 0,
      searchEffectCount: 0,
      readEffectCount: 0,
    };
    this.#runs.set(context.run.runId, state);
    const text = source.source.text;
    try {
      if (context.toolName === "search_evidence_text") {
        const input = object(context.input);
        const query = typeof input?.query === "string" ? input.query.trim() : "";
        if (query === "" || query.length > 120) throw new Error("search query is invalid");
        const matches: Array<Readonly<{ passageId: Hash; start: number; end: number; text: string }>> = [];
        const lower = text.toLocaleLowerCase("en-US");
        const needle = query.toLocaleLowerCase("en-US");
        let cursor = 0;
        while (matches.length < MAX_MATCHES) {
          const found = lower.indexOf(needle, cursor);
          if (found < 0) break;
          const start = Math.max(0, found - 240);
          const end = Math.min(text.length, found + query.length + 240);
          const passageId = ruleEvidencePassageIdentity(
            source.source.textArtifactId,
            start,
            end,
          );
          state.inspected.set(passageId, Object.freeze({ start, end }));
          matches.push(Object.freeze({ passageId, start, end, text: text.slice(start, end) }));
          cursor = found + Math.max(1, needle.length);
        }
        state.inspectionCount += 1;
        state.searchEffectCount += 1;
        return Object.freeze({
          status: "ACCEPTED",
          output: Object.freeze({ query, matches: Object.freeze(matches), truncated: matches.length === MAX_MATCHES }),
        });
      }
      if (context.toolName === "read_evidence_text") {
        const input = object(context.input);
        const start = input?.start;
        const length = input?.length;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) ||
            (start as number) < 0 || (start as number) >= text.length ||
            (length as number) < 1 || (length as number) > MAX_REQUESTED_READ_CHARACTERS) {
          throw new Error(
            `read range is invalid: received start=${String(start)}, length=${String(length)}; ` +
            `valid start is 0..${Math.max(0, text.length - 1)} and valid length is ` +
            `1..${MAX_REQUESTED_READ_CHARACTERS}`,
          );
        }
        const returnedLength = Math.min(length as number, MAX_READ_CHARACTERS);
        const end = Math.min(text.length, (start as number) + returnedLength);
        const passageId = ruleEvidencePassageIdentity(
          source.source.textArtifactId,
          start as number,
          end,
        );
        state.inspected.set(passageId, Object.freeze({ start: start as number, end }));
        state.inspectionCount += 1;
        state.readEffectCount += 1;
        return Object.freeze({
          status: "ACCEPTED",
          output: Object.freeze({
            passageId,
            start,
            end,
            requestedLength: length,
            truncated: end < (start as number) + (length as number),
            text: text.slice(start as number, end),
          }),
        });
      }
      if (context.toolName === "submit_rule_evidence_claim") {
        if (state.inspectionCount < 1) throw new Error("inspect retained evidence before submission");
        const input = object(context.input);
        if (input === null || !Array.isArray(input.citations) ||
            !Array.isArray(input.unresolvedEvidence)) throw new Error("claim submission is malformed");
        const citations = input.citations.map((value) => {
          const citation = object(value);
          const passageId = citation?.passageId as Hash | undefined;
          const range = passageId === undefined ? undefined : state.inspected.get(passageId);
          if (range === undefined) throw new Error("citation passage was not returned by a text tool");
          return Object.freeze({
            start: range.start,
            end: range.end,
            quote: text.slice(range.start, range.end),
          });
        });
        const draft = validateRuleEvidenceClaimDraft({
          disposition: input.disposition,
          rationale: input.rationale,
          citations,
          unresolvedEvidence: input.unresolvedEvidence,
        }, text);
        const submittedEffectHash = hashCanonical({
          requirementId: source.requirement.requirementId,
          sourceKind: source.source.kind,
          sourceArtifactId: source.source.sourceArtifactId,
          textArtifactId: source.source.textArtifactId,
          draft,
        });
        const retained = await this.retainResult?.(context, source, Object.freeze({
          draft,
          trace: Object.freeze({
            searchEffectCount: state.searchEffectCount,
            readEffectCount: state.readEffectCount,
            submittedEffectHash,
          }),
        }));
        this.#runs.delete(context.run.runId);
        return Object.freeze({
          status: "ACCEPTED",
          output: Object.freeze({
            accepted: true,
            requirementId: source.requirement.requirementId,
            sourceKind: source.source.kind,
            sourceArtifactId: source.source.sourceArtifactId,
            textArtifactId: source.source.textArtifactId,
            draft,
            submittedEffectHash,
            claimId: retained?.claimId ?? null,
            claimArtifactHash: retained?.artifactHash ?? null,
            advisoryOnly: true,
            semanticDecisionAuthority: false,
            certificateAuthority: false,
            executionAuthority: false,
          }),
        });
      }
      throw new Error("tool is outside the Rule Evidence manifest");
    } catch (error) {
      return Object.freeze({
        status: "REJECTED",
        output: Object.freeze({
          diagnostic: error instanceof Error ? error.message : "tool input rejected",
        }),
      });
    }
  }
}
