import { describe, expect, it } from "vitest";
import {
  codexCredentialForTest,
  createCodexDiscoveryRuntime,
} from "../src/index.js";
import {
  agentTask,
  openAiToolResponse,
  scriptedToolCall,
} from "./model-agent-fixtures.js";

describe("Vercel AI SDK Codex OAuth discovery agent", () => {
  it("publishes readiness without exposing the OAuth credential", () => {
    const secret = "test-only-codex-oauth-token";
    const runtime = createCodexDiscoveryRuntime({}, {
      model: "gpt-5.6-luna",
      reasoningEffort: "medium",
      credentialProvider: codexCredentialForTest(secret, "account-test-only"),
    });
    expect(runtime.projection).toEqual({
      provider: "CODEX_RESPONSES",
      transport: "VERCEL_AI_SDK",
      configured: true,
      credentialEnv: "CODEX_OAUTH",
      model: "gpt-5.6-luna",
      maxOutputTokens: 800,
      timeoutMs: 300_000,
      maxSteps: 8,
      maxToolCalls: 24,
      fanout: 1,
      workerRoles: ["EQUIVALENCE"],
      reasoningEffort: "medium",
      responseStorage: false,
      authority: "PROPOSE_ONLY",
    });
    expect(JSON.stringify(runtime)).not.toContain(secret);
  });

  it("uses the Codex Responses transport with account routing and selected effort", async () => {
    const secret = "test-only-codex-oauth-token";
    const bodies: Record<string, unknown>[] = [];
    const runtime = createCodexDiscoveryRuntime(
      { PMH_DISCOVERY_TIMEOUT_MS: "3000" },
      {
        model: "gpt-5.6-terra",
        reasoningEffort: "high",
        credentialProvider: codexCredentialForTest(secret, "account-test-only"),
        async fetcher(input, init) {
          expect(String(input)).toBe("https://chatgpt.com/backend-api/codex/responses");
          const headers = new Headers(init?.headers);
          expect(headers.get("authorization")).toBe(`Bearer ${secret}`);
          expect(headers.get("chatgpt-account-id")).toBe("account-test-only");
          expect(headers.get("openai-beta")).toBe("responses=experimental");
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          const call = scriptedToolCall(bodies.length);
          return openAiToolResponse(call.name, call.input, bodies.length);
        },
      },
    );

    const result = await runtime.worker!.runWithTrace(agentTask);
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      max_output_tokens: 800,
      reasoning: { effort: "high" },
      tool_choice: "required",
      parallel_tool_calls: false,
    });
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(result.trace).toMatchObject({
      providerRequestAttemptCount: 3,
      toolCallCount: 3,
      acceptedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
      executionAuthority: false,
    });
  });
});
