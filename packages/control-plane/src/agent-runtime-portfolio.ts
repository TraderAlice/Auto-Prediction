import {
  buildAgentRuntimeDefinition,
  buildCredentialBinding,
  buildExecutionProfile,
  buildModelProfile,
  buildWorkloadRoute,
  type AgentExecutionBatch,
} from "./agent-execution-substrate.js";
import type { AiRuntimeConfiguration } from "./ai-runtime-configuration.js";

export function buildDefaultAgentRuntimePortfolio(
  configuration: AiRuntimeConfiguration,
): AgentExecutionBatch {
  const createdAt = configuration.updatedAt;
  const pi = buildAgentRuntimeDefinition({ kind: "PI", version: "pi-cli-v1" });
  const codex = buildAgentRuntimeDefinition({ kind: "CODEX", version: "codex-cli-v1" });
  const inProcess = buildAgentRuntimeDefinition({
    kind: "HARNESS_IN_PROCESS",
    version: "ai-sdk-loop-v1",
  });
  const codexCredential = buildCredentialBinding({
    kind: "CODEX_OAUTH",
    logicalAccountRef: "codex-oauth:default",
    resolverKind: "CODEX_AUTH_CACHE",
    resolverRef: "codex-auth-cache:default",
  });
  const deepSeekCredential = buildCredentialBinding({
    kind: "DEEPSEEK_API_KEY",
    logicalAccountRef: "deepseek-api-key:default",
    resolverKind: "ENVIRONMENT",
    resolverRef: "env:DEEPSEEK_API_KEY",
  });
  const codexModel = buildModelProfile({
    profileKey: "operator-codex-model",
    revision: configuration.revision,
    accessDriver: "CODEX_RESPONSES",
    model: configuration.codexModel,
    configuration: {
      schemaVersion: "pmh.codex-model-configuration.v1",
      reasoning: { effort: configuration.codexReasoningEffort },
      responseStorage: false,
    },
    createdAt,
  });
  const deepSeekModel = buildModelProfile({
    profileKey: "operator-deepseek-flash-model",
    revision: configuration.revision,
    accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
    model: "deepseek-v4-flash",
    configuration: {
      schemaVersion: "pmh.deepseek-flash-model-configuration.v1",
      thinking: { mode: "disabled" },
      responseStorage: false,
    },
    createdAt,
  });
  const common = {
    revision: configuration.revision,
    toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 20,
      maximumToolCalls: 80,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "500000",
      maximumOutputTokens: "50000",
    },
    createdAt,
  } as const;
  const piCodex = buildExecutionProfile({
    ...common,
    profileKey: "rule-evidence-pi-codex",
    runtimeDefinition: pi,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
  });
  const piDeepSeek = buildExecutionProfile({
    ...common,
    profileKey: "rule-evidence-pi-deepseek",
    runtimeDefinition: pi,
    credentialBinding: deepSeekCredential,
    modelProfile: deepSeekModel,
  });
  const codexAgent = buildExecutionProfile({
    ...common,
    profileKey: "rule-evidence-codex-agent",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
  });
  const inProcessCodex = buildExecutionProfile({
    ...common,
    profileKey: "rule-evidence-in-process-codex",
    runtimeDefinition: inProcess,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
  });
  const inProcessDeepSeek = buildExecutionProfile({
    ...common,
    profileKey: "rule-evidence-in-process-deepseek",
    runtimeDefinition: inProcess,
    credentialBinding: deepSeekCredential,
    modelProfile: deepSeekModel,
  });
  const selected = configuration.provider === "CODEX" ? codexAgent : piDeepSeek;
  const route = buildWorkloadRoute({
    routeKey: "rule-evidence-default",
    revision: configuration.revision,
    taskKind: "RULE_EVIDENCE_CLAIM",
    executionProfileId: selected.executionProfileId,
    updatedAt: createdAt,
  });
  return Object.freeze({
    runtimeDefinitions: Object.freeze([pi, codex, inProcess]),
    credentialBindings: Object.freeze([codexCredential, deepSeekCredential]),
    modelProfiles: Object.freeze([codexModel, deepSeekModel]),
    executionProfiles: Object.freeze([
      piCodex,
      piDeepSeek,
      codexAgent,
      inProcessCodex,
      inProcessDeepSeek,
    ]),
    workloadRoutes: Object.freeze([route]),
  });
}
