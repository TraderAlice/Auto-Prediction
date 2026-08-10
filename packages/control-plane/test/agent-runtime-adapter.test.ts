import { hashCanonical } from "@pmh/domain";
import { describe, expect, it, vi } from "vitest";
import {
  AgentCredentialBroker,
  buildAgentRun,
  buildAgentRuntimeDefinition,
  buildAgentTask,
  buildCredentialBinding,
  buildExecutionProfile,
  buildModelProfile,
  CodexAgentRuntimeAdapter,
  CodexOAuthCredentialResolver,
  EnvironmentCredentialResolver,
  executePreparedAgentRun,
  InProcessAgentRuntimeAdapter,
  PiAgentRuntimeAdapter,
  type AgentRuntimeAdapter,
  type AgentRuntimeKind,
  type AgentRuntimeSession,
  type CredentialBinding,
  type ModelProfile,
} from "../src/index.js";

const NOW = "2026-08-10T12:00:00.000Z";
const NEXT = "2026-08-10T12:00:01.000Z";
const LATER = "2026-08-10T12:00:02.000Z";
const PAYLOAD = Object.freeze({ requirementId: "requirement:test", documentId: "document:test" });
const DEEPSEEK_SECRET = "test-only-deepseek-secret";
const CODEX_SECRET = "test-only-codex-secret";

function task() {
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: [{
      kind: "EVIDENCE_REQUIREMENT",
      artifactId: "requirement:test",
      artifactHash: hashCanonical({ requirement: "test" }),
    }],
    taskPayload: PAYLOAD,
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: "rule-evidence:test",
    priority: 10,
    createdAt: NOW,
  });
}

function codexCredential(): CredentialBinding {
  return buildCredentialBinding({
    kind: "CODEX_OAUTH",
    logicalAccountRef: "codex-oauth:test",
    resolverKind: "CODEX_AUTH_CACHE",
    resolverRef: "codex-auth-cache:test",
  });
}

function deepSeekCredential(): CredentialBinding {
  return buildCredentialBinding({
    kind: "DEEPSEEK_API_KEY",
    logicalAccountRef: "deepseek-api-key:test",
    resolverKind: "ENVIRONMENT",
    resolverRef: "env:DEEPSEEK_API_KEY",
  });
}

function codexModel(): ModelProfile {
  return buildModelProfile({
    profileKey: "codex-terra-test",
    revision: 1,
    accessDriver: "CODEX_RESPONSES",
    model: "gpt-5.6-terra",
    configuration: {
      schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort: "high" },
      responseStorage: false,
    },
    createdAt: NOW,
  });
}

function deepSeekModel(): ModelProfile {
  return buildModelProfile({
    profileKey: "deepseek-flash-test",
    revision: 1,
    accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
    model: "deepseek-v4-flash",
    configuration: {
      schemaVersion: "pmh.deepseek-flash-model-configuration.v1",
      thinking: { mode: "enabled" },
      responseStorage: false,
    },
    createdAt: NOW,
  });
}

function broker(): AgentCredentialBroker {
  return new AgentCredentialBroker([
    new EnvironmentCredentialResolver({ DEEPSEEK_API_KEY: DEEPSEEK_SECRET }),
    new CodexOAuthCredentialResolver({
      configured: () => true,
      resolve: async () => ({
        accessToken: CODEX_SECRET,
        accountId: "account:test",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    }),
  ]);
}

function adapterFor(
  kind: AgentRuntimeKind,
  factory: () => Promise<AgentRuntimeSession>,
): AgentRuntimeAdapter {
  if (kind === "PI") return new PiAgentRuntimeAdapter(factory);
  if (kind === "CODEX") return new CodexAgentRuntimeAdapter(factory);
  return new InProcessAgentRuntimeAdapter(factory);
}

function execution(input: Readonly<{
  kind: AgentRuntimeKind;
  credential: CredentialBinding;
  model: ModelProfile;
  maximumModelInvocations?: number;
  adapter: AgentRuntimeAdapter;
}>) {
  const work = task();
  const runtime = buildAgentRuntimeDefinition({ kind: input.kind, version: `${input.kind}-test-v1` });
  const profile = buildExecutionProfile({
    profileKey: `${input.kind.toLowerCase()}-test`,
    revision: 1,
    runtimeDefinition: runtime,
    credentialBinding: input.credential,
    modelProfile: input.model,
    toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: input.maximumModelInvocations ?? 4,
      maximumToolCalls: 4,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "1000",
      maximumOutputTokens: "1000",
    },
    createdAt: NOW,
  });
  const run = buildAgentRun({
    task: work,
    executionProfile: profile,
    runOrdinal: 1,
    authorization: {
      kind: "MANUAL",
      authorizationRef: "operator:test",
      authorizedAt: NOW,
    },
    createdAt: NOW,
  });
  return {
    run,
    task: work,
    taskPayload: PAYLOAD,
    runtimeDefinition: runtime,
    credentialBinding: input.credential,
    modelProfile: input.model,
    executionProfile: profile,
    adapter: input.adapter,
    credentialBroker: broker(),
  } as const;
}

function twoTurnSession(captureResults: (value: unknown) => void): AgentRuntimeSession {
  let turn = 0;
  return {
    advance: async (results) => {
      turn += 1;
      if (turn === 1) return {
        invocation: {
          status: "SUCCEEDED" as const,
          startedAt: NOW,
          completedAt: NEXT,
          inputTokens: "100",
          outputTokens: "20",
          reasoningTokens: "5",
          failureCategory: null,
        },
        toolCalls: [{
          callId: "call:submit:1",
          toolName: "submit_rule_evidence_claim",
          input: { disposition: "SUPPORTS", quote: "unverified model quote" },
        }],
        completed: false,
        finalArtifact: null,
      };
      captureResults(results);
      return {
        invocation: {
          status: "SUCCEEDED" as const,
          startedAt: NEXT,
          completedAt: LATER,
          inputTokens: "120",
          outputTokens: "30",
          reasoningTokens: "8",
          failureCategory: null,
        },
        toolCalls: [],
        completed: true,
        finalArtifact: { disposition: "INCONCLUSIVE", retainedEffectCount: results.length },
      };
    },
  };
}

describe("Agent runtime adapters", () => {
  it("resolves logical credentials just in time and projects readiness without secrets", async () => {
    const credentials = broker();
    const codex = codexCredential();
    const deepseek = deepSeekCredential();
    await expect(credentials.resolve(codex)).resolves.toMatchObject({
      kind: "CODEX_OAUTH",
      accessToken: CODEX_SECRET,
      accountId: "account:test",
    });
    await expect(credentials.resolve(deepseek)).resolves.toEqual({
      kind: "DEEPSEEK_API_KEY",
      apiKey: DEEPSEEK_SECRET,
    });
    const readiness = await Promise.all([
      credentials.readiness(codex),
      credentials.readiness(deepseek),
    ]);
    expect(readiness.every((item) => item.status === "READY")).toBe(true);
    expect(JSON.stringify(readiness)).not.toContain(CODEX_SECRET);
    expect(JSON.stringify(readiness)).not.toContain(DEEPSEEK_SECRET);

    const unavailable = new AgentCredentialBroker([
      new EnvironmentCredentialResolver({}),
    ]);
    const status = await unavailable.readiness(deepseek);
    expect(status).toMatchObject({ status: "UNAVAILABLE", secretMaterialRetained: false });
    expect(status.diagnostic).toBe("credential unavailable");
  });

  for (const candidate of [
    { kind: "PI" as const, credential: codexCredential(), model: codexModel() },
    { kind: "PI" as const, credential: deepSeekCredential(), model: deepSeekModel() },
    { kind: "CODEX" as const, credential: codexCredential(), model: codexModel() },
    { kind: "HARNESS_IN_PROCESS" as const, credential: codexCredential(), model: codexModel() },
    { kind: "HARNESS_IN_PROCESS" as const, credential: deepSeekCredential(), model: deepSeekModel() },
  ]) {
    it(`runs ${candidate.kind} with ${candidate.credential.kind} and ${candidate.model.accessDriver} through one tool loop`, async () => {
      let openedCredentialKind = "";
      let observedToolResults: unknown = null;
      const adapter = adapterFor(candidate.kind, async () =>
        twoTurnSession((value) => { observedToolResults = value; })
      );
      const originalOpen = adapter.open.bind(adapter);
      const open = vi.spyOn(adapter, "open").mockImplementation(async (context) => {
        openedCredentialKind = context.credential.kind;
        return originalOpen(context);
      });
      const input = execution({ ...candidate, adapter });
      const result = await executePreparedAgentRun({
        ...input,
        toolHost: {
          execute: async () => ({
            status: "REJECTED",
            output: { diagnostic: "quote offsets do not match retained bytes" },
          }),
        },
        now: () => Date.parse(LATER),
      });

      expect(open).toHaveBeenCalledOnce();
      expect(openedCredentialKind).toBe(candidate.credential.kind);
      expect(result).toMatchObject({
        run: { status: "SUCCEEDED" },
        runtimeKind: candidate.kind,
        credentialBindingId: candidate.credential.credentialBindingId,
        secretMaterialRetained: false,
      });
      expect(result.modelInvocations).toHaveLength(2);
      expect(result.toolEffects).toHaveLength(1);
      expect(result.toolEffects[0]).toMatchObject({
        status: "REJECTED",
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      });
      expect(observedToolResults).toEqual([{
        callId: "call:submit:1",
        status: "REJECTED",
        output: { diagnostic: "quote offsets do not match retained bytes" },
      }]);
      expect(result.finalArtifactHash).toBe(hashCanonical({
        disposition: "INCONCLUSIVE",
        retainedEffectCount: 1,
      }));
      expect(JSON.stringify(result)).not.toContain(CODEX_SECRET);
      expect(JSON.stringify(result)).not.toContain(DEEPSEEK_SECRET);
    });
  }

  it("stops a long loop before the next model call when the invocation budget is exhausted", async () => {
    const cancel = vi.fn(async () => undefined);
    let advances = 0;
    const adapter = new InProcessAgentRuntimeAdapter(async () => ({
      cancel,
      advance: async () => {
        advances += 1;
        return {
          invocation: {
            status: "SUCCEEDED" as const,
            startedAt: NOW,
            completedAt: NEXT,
            inputTokens: "10",
            outputTokens: "10",
            reasoningTokens: null,
            failureCategory: null,
          },
          toolCalls: [{ callId: "call:one", toolName: "inspect_evidence", input: {} }],
          completed: false,
          finalArtifact: null,
        };
      },
    }));
    const input = execution({
      kind: "HARNESS_IN_PROCESS",
      credential: codexCredential(),
      model: codexModel(),
      maximumModelInvocations: 1,
      adapter,
    });
    const result = await executePreparedAgentRun({
      ...input,
      toolHost: { execute: async () => ({ status: "ACCEPTED", output: { ok: true } }) },
      now: () => Date.parse(NEXT),
    });
    expect(advances).toBe(1);
    expect(cancel).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      run: { status: "INTERRUPTED", terminalDiagnostic: "model invocation budget exhausted" },
      modelInvocations: [{ ordinal: 1 }],
      toolEffects: [{ ordinal: 1, status: "ACCEPTED" }],
    });
  });

  it("fails before credential resolution when the task payload or adapter lineage is wrong", async () => {
    const wrongAdapter = new PiAgentRuntimeAdapter(async () => twoTurnSession(() => undefined));
    const input = execution({
      kind: "HARNESS_IN_PROCESS",
      credential: codexCredential(),
      model: codexModel(),
      adapter: wrongAdapter,
    });
    await expect(executePreparedAgentRun({
      ...input,
      taskPayload: { different: true },
      toolHost: { execute: async () => ({ status: "ACCEPTED", output: {} }) },
    })).rejects.toThrow(/adapter kind/);

    const correctAdapter = new InProcessAgentRuntimeAdapter(async () =>
      twoTurnSession(() => undefined)
    );
    await expect(executePreparedAgentRun({
      ...input,
      adapter: correctAdapter,
      taskPayload: { different: true },
      toolHost: { execute: async () => ({ status: "ACCEPTED", output: {} }) },
    })).rejects.toThrow(/task payload/);
  });
});
