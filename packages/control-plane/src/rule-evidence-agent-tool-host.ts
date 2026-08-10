import { type Hash } from "@pmh/domain";
import {
  ruleEvidencePassageIdentity,
  validateRuleEvidenceClaimDraft,
  type RuleEvidenceClaimModelInput,
} from "./rule-evidence-claim.js";
import type {
  AgentRuntimeToolDefinition,
  AgentToolHost,
  AgentToolHostContext,
} from "./agent-runtime-adapter.js";

const MAX_READ_CHARACTERS = 4_000;
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
        length: { type: "integer", minimum: 1, maximum: MAX_READ_CHARACTERS },
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
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export class RuleEvidenceAgentToolHost implements AgentToolHost {
  readonly #runs = new Map<Hash, RunState>();

  public constructor(
    private readonly resolveInput: (taskId: Hash) => RuleEvidenceClaimModelInput | null,
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
    const source = this.resolveInput(context.task.taskId);
    if (source === null) {
      return Object.freeze({
        status: "REJECTED",
        output: { diagnostic: "retained Rule Evidence input is unavailable" },
      });
    }
    const state = this.#runs.get(context.run.runId) ?? {
      inspected: new Map<Hash, Readonly<{ start: number; end: number }>>(),
      inspectionCount: 0,
    };
    this.#runs.set(context.run.runId, state);
    const text = source.capture.extraction.text;
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
            source.capture.extraction.record.extractionId,
            start,
            end,
          );
          state.inspected.set(passageId, Object.freeze({ start, end }));
          matches.push(Object.freeze({ passageId, start, end, text: text.slice(start, end) }));
          cursor = found + Math.max(1, needle.length);
        }
        state.inspectionCount += 1;
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
            (length as number) < 1 || (length as number) > MAX_READ_CHARACTERS) {
          throw new Error("read range is invalid");
        }
        const end = Math.min(text.length, (start as number) + (length as number));
        const passageId = ruleEvidencePassageIdentity(
          source.capture.extraction.record.extractionId,
          start as number,
          end,
        );
        state.inspected.set(passageId, Object.freeze({ start: start as number, end }));
        state.inspectionCount += 1;
        return Object.freeze({
          status: "ACCEPTED",
          output: Object.freeze({ passageId, start, end, text: text.slice(start as number, end) }),
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
        this.#runs.delete(context.run.runId);
        return Object.freeze({
          status: "ACCEPTED",
          output: Object.freeze({
            accepted: true,
            requirementId: source.requirement.requirementId,
            documentId: source.capture.document.record.documentId,
            extractionId: source.capture.extraction.record.extractionId,
            draft,
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
