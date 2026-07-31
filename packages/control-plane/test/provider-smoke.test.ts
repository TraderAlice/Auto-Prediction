import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import { runOpenAiProviderSmoke } from "../src/index.js";

function completedResponse(payload: unknown): Response {
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(payload),
          },
        ],
      },
    ],
  });
}

describe("OpenAI provider qualification smoke", () => {
  it("runs the production adapter once and emits a hash-bound secret-free report", async () => {
    const secret = "test-only-provider-smoke-key";
    let requestCount = 0;
    let endpoint = "";
    let authorization = "";
    let requestStore: unknown;
    const report = await runOpenAiProviderSmoke({
      environment: {
        OPENAI_API_KEY: secret,
        PMH_DISCOVERY_TIMEOUT_MS: "3000",
      },
      async fetcher(input, init) {
        requestCount += 1;
        endpoint = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        const body = JSON.parse(String(init?.body)) as {
          store: unknown;
          input: readonly {
            content: readonly { text: string }[];
          }[];
        };
        requestStore = body.store;
        const task = JSON.parse(body.input[0]!.content[0]!.text) as {
          catalogContext: {
            listings: readonly { listingRef: string; venueId: string }[];
          };
        };
        const listing = task.catalogContext.listings[0]!;
        return completedResponse({
          hypotheses: [
            {
              thesis: "One verified fixture listing merits human review.",
              strategyKind: "COMPLETE_SET",
              venueIds: [listing.venueId],
              claimSearchTerms: ["temperature", "boston"],
              listingRefs: [listing.listingRef],
              confidenceBps: 5_500,
            },
          ],
        });
      },
    });

    expect(requestCount).toBe(1);
    expect(endpoint).toBe("https://api.openai.com/v1/responses");
    expect(authorization).toBe(`Bearer ${secret}`);
    expect(requestStore).toBe(false);
    expect(report).toMatchObject({
      schemaVersion: "pmh.model-provider-smoke.v2",
      status: "PASS",
      provider: {
        configured: true,
        model: "gpt-5.6-luna",
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
        executionAuthority: false,
      },
      effects: {
        providerRequests: 1,
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
    await expect(
      runOpenAiProviderSmoke({
        environment: {},
        async fetcher() {
          requestCount += 1;
          return completedResponse({ hypotheses: [] });
        },
      }),
    ).rejects.toThrow(
      "OPENAI_API_KEY is required for provider smoke qualification",
    );
    expect(requestCount).toBe(0);
  });
});
