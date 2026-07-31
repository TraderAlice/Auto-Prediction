import { describe, expect, it } from "vitest";
import {
  createOpenAiDiscoveryRuntime,
  OpenAiResponsesModelPort,
  StructuredModelDiscoveryWorker,
  type DiscoveryTask,
} from "../src/index.js";

const task: DiscoveryTask = {
  taskId: "task:model-port",
  question: "Could these rain markets express the same claim?",
  venueIds: ["kalshi", "polymarket-global"],
  maxHypotheses: 3,
  deadlineEpochMs: Date.now() + 60_000,
};

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

describe("budgeted OpenAI Responses model port", () => {
  it("stays disabled without a key and publishes only non-secret posture", () => {
    const runtime = createOpenAiDiscoveryRuntime({});
    expect(runtime.worker).toBeNull();
    expect(runtime.projection).toEqual({
      provider: "OPENAI_RESPONSES",
      configured: false,
      credentialEnv: "OPENAI_API_KEY",
      model: "gpt-5.4-mini",
      maxOutputTokens: 800,
      timeoutMs: 8_000,
      reasoningEffort: "minimal",
      responseStorage: false,
      authority: "PROPOSE_ONLY",
    });
    expect(JSON.stringify(runtime)).not.toContain("apiKey");
  });

  it("sends one strict, non-stored, token-bounded Responses request", async () => {
    let endpoint = "";
    let request: RequestInit | undefined;
    const port = new OpenAiResponsesModelPort({
      apiKey: "test-only-key",
      maxOutputTokens: 512,
      timeoutMs: 2_500,
      async fetcher(input, init) {
        endpoint = String(input);
        request = init;
        return completedResponse({
          hypotheses: [
            {
              thesis: "The listings may encode one rainfall threshold.",
              strategyKind: "SAME_CLAIM_CROSS_VENUE",
              venueIds: ["kalshi", "polymarket-global"],
              claimSearchTerms: ["rain", "threshold"],
              confidenceBps: 6_500,
            },
          ],
        });
      },
    });
    const worker = new StructuredModelDiscoveryWorker(
      "model-fast-lane",
      "gpt-5.4-mini",
      port,
    );
    const hypotheses = await worker.discover(task);
    expect(endpoint).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(request?.headers).get("authorization")).toBe(
      "Bearer test-only-key",
    );
    const body = JSON.parse(String(request?.body)) as {
      model: string;
      store: boolean;
      max_output_tokens: number;
      reasoning: { effort: string };
      instructions: string;
      text: {
        format: {
          type: string;
          strict: boolean;
          schema: { additionalProperties: boolean };
        };
      };
      tools?: unknown;
    };
    expect(body).toMatchObject({
      model: "gpt-5.4-mini",
      store: false,
      max_output_tokens: 512,
      reasoning: { effort: "minimal" },
      text: {
        format: {
          type: "json_schema",
          strict: true,
          schema: { additionalProperties: false },
        },
      },
    });
    expect(body.instructions).toContain("unverified search lead");
    expect(body.tools).toBeUndefined();
    expect(hypotheses[0]).toMatchObject({
      workerId: "model-fast-lane",
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
  });

  it("rejects out-of-scope model venues before they enter the inbox", async () => {
    const port = new OpenAiResponsesModelPort({
      apiKey: "test-only-key",
      async fetcher() {
        return completedResponse({
          hypotheses: [
            {
              thesis: "A model invented another venue.",
              strategyKind: "SAME_CLAIM_CROSS_VENUE",
              venueIds: ["kalshi", "invented-venue"],
              claimSearchTerms: ["rain"],
              confidenceBps: 9_000,
            },
          ],
        });
      },
    });
    const worker = new StructuredModelDiscoveryWorker(
      "model-fast-lane",
      "gpt-5.4-mini",
      port,
    );
    await expect(worker.discover(task)).rejects.toThrow(/out-of-scope/);
  });

  it("fails closed on refusal, incomplete output, and HTTP errors", async () => {
    let expiredRequestSent = false;
    const expiredPort = new OpenAiResponsesModelPort({
      apiKey: "test-only-key",
      async fetcher() {
        expiredRequestSent = true;
        return completedResponse({ hypotheses: [] });
      },
    });
    await expect(
      expiredPort.completeStructured({
        model: "gpt-5.4-mini",
        schemaVersion: "pmh.discovery-output.v1",
        system: "Propose only.",
        task: { ...task, deadlineEpochMs: Date.now() - 1 },
      }),
    ).rejects.toThrow(/deadline has expired/);
    expect(expiredRequestSent).toBe(false);

    const refusalPort = new OpenAiResponsesModelPort({
      apiKey: "test-only-key",
      async fetcher() {
        return Response.json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: "cannot comply" }],
            },
          ],
        });
      },
    });
    await expect(
      refusalPort.completeStructured({
        model: "gpt-5.4-mini",
        schemaVersion: "pmh.discovery-output.v1",
        system: "Propose only.",
        task,
      }),
    ).rejects.toThrow(/refused/);

    const incompletePort = new OpenAiResponsesModelPort({
      apiKey: "test-only-key",
      async fetcher() {
        return Response.json({ status: "incomplete", output: [] });
      },
    });
    await expect(
      incompletePort.completeStructured({
        model: "gpt-5.4-mini",
        schemaVersion: "pmh.discovery-output.v1",
        system: "Propose only.",
        task,
      }),
    ).rejects.toThrow(/incomplete/);

    const failingPort = new OpenAiResponsesModelPort({
      apiKey: "do-not-leak-this-key",
      async fetcher() {
        return new Response("upstream detail", { status: 401 });
      },
    });
    let diagnostic = "";
    try {
      await failingPort.completeStructured({
        model: "gpt-5.4-mini",
        schemaVersion: "pmh.discovery-output.v1",
        system: "Propose only.",
        task,
      });
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error);
    }
    expect(diagnostic).toBe("OpenAI Responses request failed (HTTP 401)");
    expect(diagnostic).not.toContain("do-not-leak-this-key");
    expect(diagnostic).not.toContain("upstream detail");
  });

  it("validates environment budgets before creating a worker", () => {
    expect(() =>
      createOpenAiDiscoveryRuntime({
        OPENAI_API_KEY: "test-only-key",
        PMH_DISCOVERY_MAX_OUTPUT_TOKENS: "999999",
      }),
    ).toThrow(/PMH_DISCOVERY_MAX_OUTPUT_TOKENS/);
    const runtime = createOpenAiDiscoveryRuntime({
      OPENAI_API_KEY: "test-only-key",
      PMH_DISCOVERY_MODEL: "gpt-5.4-nano",
      PMH_DISCOVERY_MAX_OUTPUT_TOKENS: "256",
      PMH_DISCOVERY_TIMEOUT_MS: "3000",
    });
    expect(runtime.worker).not.toBeNull();
    expect(runtime.projection).toMatchObject({
      configured: true,
      model: "gpt-5.4-nano",
      maxOutputTokens: 256,
      timeoutMs: 3_000,
    });
    expect(JSON.stringify(runtime)).not.toContain("test-only-key");
  });
});
