import { describe, expect, it } from "vitest";
import {
  createOpenAiDiscoveryRuntime,
  OpenAiSdkAgentPort,
} from "../src/index.js";
import {
  agentTask,
  openAiToolResponse,
  openAiRawToolResponse,
  proposalInput,
  TEST_LISTING_REF,
} from "./model-agent-fixtures.js";

describe("Vercel AI SDK OpenAI Responses discovery agent", () => {
  it("stays disabled without a key and publishes bounded non-secret posture", () => {
    const runtime = createOpenAiDiscoveryRuntime({});
    expect(runtime.worker).toBeNull();
    expect(runtime.projection).toEqual({
      provider: "OPENAI_RESPONSES",
      transport: "VERCEL_AI_SDK",
      configured: false,
      credentialEnv: "OPENAI_API_KEY",
      model: "gpt-5.6-luna",
      maxOutputTokens: 800,
      timeoutMs: 300_000,
      maxSteps: 8,
      maxToolCalls: 24,
      fanout: 1,
      workerRoles: ["EQUIVALENCE"],
      reasoningEffort: "minimal",
      responseStorage: false,
      authority: "PROPOSE_ONLY",
    });
    expect(JSON.stringify(runtime)).not.toContain("apiKey");
  });

  it("runs native tools, returns validation as a tool result, and recovers", async () => {
    const bodies: Record<string, unknown>[] = [];
    const port = new OpenAiSdkAgentPort({
      apiKey: "test-only-key",
      maxOutputTokens: 512,
      timeoutMs: 3_000,
      async fetcher(input, init) {
        expect(String(input)).toBe("https://api.openai.com/v1/responses");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer test-only-key",
        );
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        const ordinal = bodies.length;
        if (ordinal === 1) {
          return openAiRawToolResponse(
            "inspect_listings",
            "not-json",
            ordinal,
          );
        }
        if (ordinal === 2) {
          return openAiToolResponse(
            "inspect_listings",
            { listingRefs: [TEST_LISTING_REF] },
            ordinal,
          );
        }
        if (ordinal === 3) {
          return openAiToolResponse("record_hypothesis", proposalInput(), ordinal);
        }
        return openAiToolResponse(
          "complete_search",
          { reason: "Recovered from rejected input and recorded a grounded lead." },
          ordinal,
        );
      },
    });
    const result = await port.run({
      workerId: "model-fast-lane",
      model: "gpt-5.6-luna",
      system: "Propose only.",
      task: agentTask,
    });

    expect(bodies).toHaveLength(4);
    expect(bodies[0]).toMatchObject({
      model: "gpt-5.6-luna",
      store: false,
      max_output_tokens: 512,
      reasoning: { effort: "minimal" },
      tool_choice: "required",
      parallel_tool_calls: false,
    });
    expect(bodies[0]).toHaveProperty("tools");
    expect(bodies[0]).not.toHaveProperty("text.format");
    expect(result.hypotheses).toHaveLength(1);
    expect(result.trace).toMatchObject({
      stepCount: 4,
      providerRequestAttemptCount: 4,
      toolCallCount: 4,
      catalogReadCount: 1,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    expect(result.trace.effects.map((effect) => [effect.toolName, effect.status]))
      .toEqual([
        ["inspect_listings", "REJECTED"],
        ["inspect_listings", "ACCEPTED"],
        ["record_hypothesis", "ACCEPTED"],
        ["complete_search", "ACCEPTED"],
      ]);
    expect(result.trace.effects[0]).toMatchObject({ reason: "INVALID_INPUT" });
  });

  it("fails before transport on an expired task", async () => {
    let requestSent = false;
    const port = new OpenAiSdkAgentPort({
      apiKey: "test-only-key",
      async fetcher() {
        requestSent = true;
        return openAiToolResponse("complete_search", { reason: "Done." }, 1);
      },
    });
    await expect(port.run({
      workerId: "model-fast-lane",
      model: "gpt-5.6-luna",
      system: "Propose only.",
      task: { ...agentTask, deadlineEpochMs: Date.now() - 1 },
    })).rejects.toMatchObject({ category: "TASK_DEADLINE", requestAttemptCount: 0 });
    expect(requestSent).toBe(false);
  });

  it("classifies HTTP and protocol failures without leaking provider bodies", async () => {
    for (const [response, category, terminationReason] of [
      [new Response("sensitive auth detail", { status: 401 }), "REJECTED_PROVIDER", "PROVIDER_FAILURE"],
      [new Response("sensitive temporary detail", { status: 503 }), "RETRYABLE_PROVIDER", "PROVIDER_FAILURE"],
      [new Response("sensitive malformed detail", {
        status: 200,
        headers: { "content-type": "application/json" },
      }), "INVALID_PROVIDER_OUTPUT", "PROTOCOL_FAILURE"],
    ] as const) {
      const port = new OpenAiSdkAgentPort({
        apiKey: "do-not-leak-this-key",
        async fetcher() {
          return response.clone();
        },
      });
      let failure: unknown;
      try {
        await port.run({
          workerId: "model-fast-lane",
          model: "gpt-5.6-luna",
          system: "Propose only.",
          task: agentTask,
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        category,
        requestAttemptCount: 1,
        agentTrace: { terminationReason },
      });
      const diagnostic = failure instanceof Error ? failure.message : String(failure);
      expect(diagnostic).not.toContain("sensitive");
      expect(diagnostic).not.toContain("do-not-leak-this-key");
    }
  });

  it("validates model, token, total-time, and loop budgets", () => {
    expect(() => createOpenAiDiscoveryRuntime({
      OPENAI_API_KEY: "test-only-key",
      PMH_DISCOVERY_MAX_OUTPUT_TOKENS: "999999",
    })).toThrow(/PMH_DISCOVERY_MAX_OUTPUT_TOKENS/);
    const runtime = createOpenAiDiscoveryRuntime({
      OPENAI_API_KEY: "test-only-key",
      PMH_DISCOVERY_MODEL: "gpt-5.6-terra",
      PMH_DISCOVERY_MAX_OUTPUT_TOKENS: "256",
      PMH_DISCOVERY_TIMEOUT_MS: "300000",
      PMH_DISCOVERY_MAX_STEPS: "20",
      PMH_DISCOVERY_MAX_TOOL_CALLS: "64",
    });
    expect(runtime.projection).toMatchObject({
      configured: true,
      model: "gpt-5.6-terra",
      maxOutputTokens: 256,
      timeoutMs: 300_000,
      maxSteps: 20,
      maxToolCalls: 64,
    });
    expect(JSON.stringify(runtime)).not.toContain("test-only-key");
    expect(() => createOpenAiDiscoveryRuntime({ PMH_DISCOVERY_TIMEOUT_MS: "300001" }))
      .toThrow(/PMH_DISCOVERY_TIMEOUT_MS/);
    expect(() => createOpenAiDiscoveryRuntime({ PMH_DISCOVERY_MAX_STEPS: "21" }))
      .toThrow(/PMH_DISCOVERY_MAX_STEPS/);
    expect(() => createOpenAiDiscoveryRuntime({ PMH_DISCOVERY_MAX_TOOL_CALLS: "65" }))
      .toThrow(/PMH_DISCOVERY_MAX_TOOL_CALLS/);
  });
});
