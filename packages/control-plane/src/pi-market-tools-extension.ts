import { rename, writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const effectPath = process.env.PMH_MARKET_EFFECT_PATH;

export default function registerMarketResearchTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "submit_market_findings",
    label: "Submit market findings",
    description:
      "Submit bounded proposal-only Market Archaeologist findings as a controlled " +
      "external effect. Call once after searching and falsifying candidate relations.",
    parameters: Type.Object({
      summary: Type.String({ maxLength: 2_000 }),
      proposals: Type.Array(Type.Object({
        relationKind: Type.Union([
          Type.Literal("EQUIVALENT"), Type.Literal("IMPLIES"),
          Type.Literal("SUBSET"), Type.Literal("MUTUALLY_EXCLUSIVE"),
          Type.Literal("EXHAUSTIVE"), Type.Literal("CONDITIONAL"),
          Type.Literal("RELATED"), Type.Literal("CONFLICTING"),
        ]),
        listingRefs: Type.Array(Type.String({ maxLength: 500 }), {
          minItems: 2,
          maxItems: 8,
        }),
        statement: Type.String({ maxLength: 1_000 }),
        rationale: Type.String({ maxLength: 2_000 }),
        falsifiers: Type.Array(Type.String({ maxLength: 500 }), { maxItems: 12 }),
        evidenceRequirements: Type.Array(Type.Object({
          kind: Type.Union([
            Type.Literal("RESOLUTION_RULE"),
            Type.Literal("VOID_CANCELLATION"),
            Type.Literal("ORACLE_SOURCE"),
            Type.Literal("TIME_BOUNDARY"),
            Type.Literal("OUTCOME_MAPPING"),
            Type.Literal("VENUE_POLICY"),
            Type.Literal("FEE_SCHEDULE"),
            Type.Literal("QUOTE_DEPTH"),
          ]),
          listingRefs: Type.Array(Type.String({ maxLength: 500 }), {
            minItems: 1,
            maxItems: 8,
          }),
          claim: Type.String({ maxLength: 1_000 }),
          reason: Type.String({ maxLength: 1_000 }),
          satisfyingObservation: Type.String({ maxLength: 1_000 }),
          contradictingObservation: Type.String({ maxLength: 1_000 }),
          temporalPosture: Type.Union([
            Type.Literal("CURRENT"),
            Type.Literal("HISTORICAL_AT_SOURCE_OBSERVATION"),
          ]),
        }), { maxItems: 20 }),
      }), { maxItems: 5 }),
      missingEvidence: Type.Array(Type.String({ maxLength: 2_000 }), { maxItems: 30 }),
    }),
    execute: async (_toolCallId, params) => {
      if (effectPath === undefined || effectPath.trim() === "") {
        throw new Error("PMH_MARKET_EFFECT_PATH is not configured");
      }
      const temporaryEffectPath = `${effectPath}.tmp`;
      await writeFile(temporaryEffectPath, JSON.stringify(params), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryEffectPath, effectPath);
      return {
        content: [{
          type: "text" as const,
          text: "Findings accepted as a proposal-only effect. No review or execution authority was granted.",
        }],
        details: {
          proposalCount: params.proposals.length,
          proposalOnly: true,
          executionAuthority: false,
        },
      };
    },
  });
}
