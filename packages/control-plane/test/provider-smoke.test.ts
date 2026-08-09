import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import { runOpenAiProviderSmoke } from "../src/index.js";
import {
  openAiToolResponse,
  proposalInput,
} from "./model-agent-fixtures.js";

const SMOKE_LISTING_REF =
  "gemini-predictions:GEMI-WXHIGH-BOS-2608010359-80TO81";
const SMOKE_LISTING_REFS = Object.freeze([
  SMOKE_LISTING_REF,
  "gemini-predictions:GEMI-WXHIGH-BOS-2608010359-82TO83",
]);

describe("OpenAI provider qualification smoke", () => {
  it("qualifies the production adapter with a hash-bound multi-step trace", async () => {
    const secret = "test-only-provider-smoke-key";
    const bodies: Record<string, unknown>[] = [];
    const report = await runOpenAiProviderSmoke({
      environment: {
        OPENAI_API_KEY: secret,
        PMH_DISCOVERY_TIMEOUT_MS: "3000",
      },
      async fetcher(input, init) {
        expect(String(input)).toBe("https://api.openai.com/v1/responses");
        expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${secret}`);
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        const ordinal = bodies.length;
        if (ordinal === 1) {
          return openAiToolResponse(
            "inspect_listings",
            { listingRefs: SMOKE_LISTING_REFS },
            ordinal,
          );
        }
        if (ordinal === 2) {
          return openAiToolResponse(
            "record_hypothesis",
            proposalInput(SMOKE_LISTING_REFS),
            ordinal,
          );
        }
        return openAiToolResponse(
          "complete_search",
          { reason: "Provider qualification complete." },
          ordinal,
        );
      },
    });

    expect(bodies).toHaveLength(3);
    expect(bodies.every((body) => body.store === false)).toBe(true);
    expect(report).toMatchObject({
      schemaVersion: "pmh.model-provider-smoke.v3",
      status: "PASS",
      provider: {
        configured: true,
        model: "gpt-5.6-luna",
        transport: "VERCEL_AI_SDK",
        responseStorage: false,
        authority: "PROPOSE_ONLY",
      },
      task: {
        venueIds: ["gemini-predictions"],
        catalogListingCount: 6,
      },
      result: {
        workerId: "model-fast-lane",
        hypothesisCount: 1,
        diagnostics: [],
        agentTrace: {
          stepCount: 3,
          providerRequestAttemptCount: 3,
          catalogReadCount: 1,
          terminationReason: "EXPLICIT_COMPLETION",
        },
        executionAuthority: false,
      },
      effects: {
        providerRequests: 3,
        modelSteps: 3,
        toolCalls: 3,
        catalogReads: 1,
        responseStorage: false,
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    const { artifactHash, ...body } = report;
    expect(artifactHash).toBe(hashCanonical(body));
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it("fails before any request when the key is absent", async () => {
    let requestCount = 0;
    await expect(runOpenAiProviderSmoke({
      environment: {},
      async fetcher() {
        requestCount += 1;
        return openAiToolResponse("complete_search", { reason: "Done." }, 1);
      },
    })).rejects.toThrow("OPENAI_API_KEY is required for provider smoke qualification");
    expect(requestCount).toBe(0);
  });
});
