import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  createDeepSeekDiscoveryRuntime,
  createDiscoveryModelRuntime,
  DeepSeekAiSdkAgentPort,
  AiUsageLedger,
  runModelProviderSmoke,
} from "../src/index.js";
import {
  agentTask,
  deepSeekRawToolResponse,
  deepSeekToolResponse,
  proposalInput,
  scriptedToolCall,
  TEST_LISTING_REF,
} from "./model-agent-fixtures.js";

const SMOKE_LISTING_REF =
  "gemini-predictions:GEMI-WXHIGH-BOS-2608010359-80TO81";

describe("Vercel AI SDK DeepSeek discovery agent", () => {
  it("defaults to bounded DeepSeek V4 Flash agent runs", () => {
    const runtime = createDiscoveryModelRuntime({});
    expect(runtime.worker).toBeNull();
    expect(runtime.projection).toEqual({
      provider: "DEEPSEEK_CHAT_COMPLETIONS",
      transport: "VERCEL_AI_SDK",
      configured: false,
      credentialEnv: "DEEPSEEK_API_KEY",
      model: "deepseek-v4-flash",
      maxOutputTokens: 800,
      maxOutputTokensEnforced: true,
      timeoutMs: 300_000,
      maxSteps: 8,
      maxToolCalls: 24,
      fanout: 1,
      workerRoles: ["EQUIVALENCE"],
      reasoningEffort: "disabled",
      responseStorage: "PROVIDER_POLICY",
      authority: "PROPOSE_ONLY",
    });
  });

  it("creates bounded specialized agent fan-out", async () => {
    let requestCount = 0;
    const requestBodies: string[] = [];
    const runtime = createDeepSeekDiscoveryRuntime(
      {
        DEEPSEEK_API_KEY: "test-only-deepseek-key",
        PMH_DISCOVERY_FANOUT: "3",
      },
      {
        async fetcher(_input, init) {
          requestCount += 1;
          const body = String(init?.body);
          requestBodies.push(body);
          const hasReadResult = body.includes("CATALOG_RESULTS");
          return deepSeekToolResponse(
            hasReadResult ? "complete_search" : "search_catalog",
            hasReadResult
              ? { reason: "No grounded lead under this assigned lens." }
              : { terms: ["temperature", "boston"] },
            requestCount,
          );
        },
      },
    );
    expect(runtime.projection).toMatchObject({
      fanout: 3,
      workerRoles: ["EQUIVALENCE", "PARTITION", "MECHANISM"],
    });
    expect(runtime.workers.map((worker) => worker.workerId)).toEqual([
      "model-fast-lane-equivalence",
      "model-fast-lane-partition",
      "model-fast-lane-mechanism",
    ]);
    await Promise.all(runtime.workers.map((worker) => worker.discover(agentTask)));
    expect(requestCount).toBe(6);
    expect(requestBodies.join(" ")).toContain("Search lens");
    expect(() => createDeepSeekDiscoveryRuntime({ PMH_DISCOVERY_FANOUT: "5" }))
      .toThrow(/PMH_DISCOVERY_FANOUT/);
  });

  it("uses native tools across steps and never requests response_format", async () => {
    const secret = "test-only-deepseek-key";
    const bodies: Record<string, unknown>[] = [];
    const usageLedger = new AiUsageLedger();
    const runtime = createDeepSeekDiscoveryRuntime(
      {
        DEEPSEEK_API_KEY: secret,
        PMH_DISCOVERY_TIMEOUT_MS: "3000",
      },
      {
        usageRecorder: usageLedger,
        async fetcher(input, init) {
          expect(String(input)).toBe("https://api.deepseek.com/chat/completions");
          expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${secret}`);
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          const call = scriptedToolCall(bodies.length);
          return deepSeekToolResponse(call.name, call.input, bodies.length);
        },
      },
    );
    const result = await runtime.worker!.runWithTrace(agentTask);

    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toMatchObject({
      model: "deepseek-v4-flash",
      max_tokens: 800,
      thinking: { type: "disabled" },
      tool_choice: "required",
    });
    expect(bodies[0]).toHaveProperty("tools");
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(JSON.stringify(bodies[0])).toContain("untrusted data");
    expect(JSON.stringify(bodies)).toContain("confidenceBps");
    expect(result.hypotheses[0]).toMatchObject({
      workerId: "model-fast-lane",
      listingRefs: [TEST_LISTING_REF],
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
    expect(result.trace).toMatchObject({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 3,
      catalogReadCount: 1,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(JSON.stringify(runtime)).not.toContain(secret);
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      totals: {
        invocationCount: "1",
        durableEffectCount: "1",
        tokens: { inputTokens: "300", outputTokens: "60", totalTokens: "360" },
      },
      byRole: [{ key: "EQUIVALENCE", invocationCount: "1" }],
    });
  });

  it("repairs syntactically malformed tool JSON at the tool boundary", async () => {
    let requestCount = 0;
    const port = new DeepSeekAiSdkAgentPort({
      apiKey: "test-only-deepseek-key",
      async fetcher() {
        requestCount += 1;
        if (requestCount === 1) {
          return deepSeekRawToolResponse(
            "inspect_listings",
            `{listingRefs:['${TEST_LISTING_REF}',],}`,
            requestCount,
          );
        }
        const call = requestCount === 2
          ? { name: "record_hypothesis", input: proposalInput() }
          : { name: "complete_search", input: { reason: "Qualified." } };
        return deepSeekToolResponse(call.name, call.input, requestCount);
      },
    });

    const result = await port.run({
      workerId: "model-fast-lane",
      model: "deepseek-v4-flash",
      system: "Propose only.",
      task: agentTask,
    });

    expect(result.trace).toMatchObject({
      stepCount: 3,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    expect(result.trace.effects.map((effect) => effect.reason)).toEqual([
      "LISTINGS_INSPECTED",
      "HYPOTHESIS_RECORDED",
      "SEARCH_COMPLETED",
    ]);
  });

  it("routes a disproved relation through the negative-effect tool", async () => {
    const first = agentTask.catalogContext!.listings[0]!;
    const second = Object.freeze({
      ...first,
      listingRef: "venue-b:boston-threshold",
      venueId: "venue-b",
      venueInstrumentId: "boston-threshold",
      title: "Boston high at least 80°F",
      sourceRawHash: `sha256:${"b".repeat(64)}`,
      protocolIdentity: "fixture:venue-b:boston-threshold",
    });
    const contextBody = Object.freeze({
      schemaVersion: "pmh.discovery-catalog-context.v2" as const,
      source: "VERIFIED_FIXTURE_CATALOGS" as const,
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
      listings: Object.freeze([first, second]),
    });
    const task = Object.freeze({
      ...agentTask,
      taskId: "task:deepseek-falsification",
      venueIds: Object.freeze(["gemini-predictions", "venue-b"]),
      catalogContext: Object.freeze({
        ...contextBody,
        contextIdentity: hashCanonical(contextBody),
      }),
    });
    const refs = task.catalogContext.listings.map((item) => item.listingRef);
    let requestCount = 0;
    const port = new DeepSeekAiSdkAgentPort({
      apiKey: "test-only-deepseek-key",
      async fetcher() {
        requestCount += 1;
        const call = requestCount === 1
          ? { name: "inspect_listings", input: { listingRefs: refs } }
          : requestCount === 2
            ? {
                name: "record_falsification",
                input: {
                  claim: "The interval and threshold contracts are equivalent.",
                  reason: "80-81°F excludes temperatures above 81°F; at-least-80°F includes them.",
                  relationKind: "EQUIVALENCE",
                  listingRefs: refs,
                  claimSearchTerms: ["Boston temperature", "80°F"],
                },
              }
            : { name: "complete_search", input: { reason: "Relation disproved." } };
        return deepSeekToolResponse(call.name, call.input, requestCount);
      },
    });

    const result = await port.run({
      workerId: "model-fast-lane",
      model: "deepseek-v4-flash",
      system: "Propose only.",
      task,
    });

    expect(result.hypotheses).toEqual([]);
    expect(result.falsifications).toHaveLength(1);
    expect(result.trace).toMatchObject({
      schemaVersion: "pmh.discovery-agent-trace.v3",
      acceptedProposalCount: 0,
      acceptedFalsificationCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    expect(result.trace.effects.map((effect) => effect.toolName)).toEqual([
      "inspect_listings",
      "record_falsification",
      "complete_search",
    ]);
  });

  it("keeps OpenAI on the same native agent transport", () => {
    const runtime = createDiscoveryModelRuntime({ PMH_DISCOVERY_PROVIDER: "openai" });
    expect(runtime.projection).toMatchObject({
      provider: "OPENAI_RESPONSES",
      transport: "VERCEL_AI_SDK",
      configured: false,
    });
    expect(() => createDiscoveryModelRuntime({ PMH_DISCOVERY_PROVIDER: "invented" }))
      .toThrow(/must be deepseek, codex, or openai/);
  });

  it("classifies provider and malformed-output failures without body retention", async () => {
    for (const [response, category] of [
      [new Response("sensitive upstream detail", { status: 503 }), "RETRYABLE_PROVIDER"],
      [new Response("sensitive malformed response", {
        status: 200,
        headers: { "content-type": "application/json" },
      }), "INVALID_PROVIDER_OUTPUT"],
    ] as const) {
      const usageLedger = new AiUsageLedger();
      const port = new DeepSeekAiSdkAgentPort({
        apiKey: "test-only-deepseek-key",
        usageRecorder: usageLedger,
        async fetcher() {
          return response.clone();
        },
      });
      let failure: unknown;
      try {
        await port.run({
          workerId: "model-fast-lane",
          model: "deepseek-v4-flash",
          system: "Propose only.",
          task: agentTask,
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ category, requestAttemptCount: 1 });
      expect(failure).toHaveProperty("agentTrace.terminationReason",
        category === "INVALID_PROVIDER_OUTPUT" ? "PROTOCOL_FAILURE" : "PROVIDER_FAILURE");
      expect(failure instanceof Error ? failure.message : String(failure))
        .not.toContain("sensitive");
      expect(usageLedger.projection()).toMatchObject({
        eventCount: 1,
        coverage: { unavailable: 1 },
        byOutcome: [{ key: "FAILED", invocationCount: "1" }],
      });
    }
  });

  it("validates total-time and loop budgets", () => {
    expect(createDeepSeekDiscoveryRuntime({
      DEEPSEEK_API_KEY: "test-only-deepseek-key",
      PMH_DISCOVERY_TIMEOUT_MS: "300000",
      PMH_DISCOVERY_MAX_STEPS: "20",
      PMH_DISCOVERY_MAX_TOOL_CALLS: "64",
    }).projection).toMatchObject({ timeoutMs: 300_000, maxSteps: 20, maxToolCalls: 64 });
    expect(() => createDeepSeekDiscoveryRuntime({ PMH_DISCOVERY_TIMEOUT_MS: "300001" }))
      .toThrow(/PMH_DISCOVERY_TIMEOUT_MS/);
    expect(() => createDeepSeekDiscoveryRuntime({ PMH_DISCOVERY_MAX_STEPS: "21" }))
      .toThrow(/PMH_DISCOVERY_MAX_STEPS/);
    expect(() => createDeepSeekDiscoveryRuntime({ PMH_DISCOVERY_MAX_TOOL_CALLS: "65" }))
      .toThrow(/PMH_DISCOVERY_MAX_TOOL_CALLS/);
  });

  it("qualifies DeepSeek with a multi-step provider-neutral smoke", async () => {
    let requestCount = 0;
    const report = await runModelProviderSmoke({
      environment: {
        DEEPSEEK_API_KEY: "test-only-deepseek-key",
        PMH_DISCOVERY_TIMEOUT_MS: "3000",
      },
      async deepSeekFetcher() {
        requestCount += 1;
        const call = requestCount === 1
          ? { name: "inspect_listings", input: { listingRefs: [SMOKE_LISTING_REF] } }
          : requestCount === 2
            ? { name: "record_hypothesis", input: proposalInput(SMOKE_LISTING_REF) }
            : { name: "complete_search", input: { reason: "Qualified." } };
        return deepSeekToolResponse(call.name, call.input, requestCount);
      },
    });
    expect(report).toMatchObject({
      schemaVersion: "pmh.model-provider-smoke.v3",
      status: "PASS",
      result: {
        hypothesisCount: 1,
        diagnostics: [],
        agentTrace: { stepCount: 3, catalogReadCount: 1 },
        executionAuthority: false,
      },
      effects: {
        providerRequests: 3,
        modelSteps: 3,
        toolCalls: 3,
        catalogReads: 1,
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
  });
});
