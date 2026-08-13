import {
  buildAgentRuntimeDefinition,
  buildCredentialBinding,
  buildExecutionProfile,
  buildModelProfile,
  buildWorkloadRoute,
  type AgentExecutionBatch,
} from "./agent-execution-substrate.js";
import type { AiRuntimeConfiguration } from "./ai-runtime-configuration.js";

const RELATION_DISCOVERY_EXECUTION_PROTOCOL_REVISION = 2;
const RULE_EVIDENCE_APP_SERVER_RESULT_PROTOCOL_REVISION = 6;
const ONTOLOGY_MECHANISM_EXECUTION_PROTOCOL_REVISION = 2;
const WORLD_STATE_MECHANISM_RESEARCH_EXECUTION_REVISION = 1;
const SUBJECT_BINDING_RESEARCH_EXECUTION_REVISION = 1;
const MECHANISM_PROTOTYPE_RESEARCH_EXECUTION_REVISION = 1;
const MECHANISM_PROTOTYPE_EXPLORATION_EXECUTION_REVISION = 11;

export function buildDefaultAgentRuntimePortfolio(
  configuration: AiRuntimeConfiguration,
): AgentExecutionBatch {
  const createdAt = configuration.updatedAt;
  const pi = buildAgentRuntimeDefinition({ kind: "PI", version: "pi-cli-v1" });
  const codex = buildAgentRuntimeDefinition({
    kind: "CODEX",
    version: "codex-app-server-v2:0.147",
  });
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
    // The app-server final message is diagnostic-only. A durable rule-evidence
    // result must come from an accepted first-party submit tool, so preserve
    // earlier profiles and runs under a successor execution revision.
    revision: configuration.revision * 1_000 +
      RULE_EVIDENCE_APP_SERVER_RESULT_PROTOCOL_REVISION,
    profileKey: "rule-evidence-codex-app-server",
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
    routeKey: "rule-evidence-default-app-server-v6",
    revision: configuration.revision * 1_000 +
      RULE_EVIDENCE_APP_SERVER_RESULT_PROTOCOL_REVISION,
    taskKind: "RULE_EVIDENCE_CLAIM",
    executionProfileId: selected.executionProfileId,
    updatedAt: createdAt,
  });
  const ontologyCommon = {
    revision: configuration.revision * 1_000 +
      ONTOLOGY_MECHANISM_EXECUTION_PROTOCOL_REVISION,
    toolProtocol: "MARKET_ONTOLOGY_AGENT_TOOLS_V2",
    runBudget: {
      maximumModelInvocations: 8,
      maximumToolCalls: 24,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "200000",
      maximumOutputTokens: "20000",
    },
    createdAt,
  } as const;
  const ontologyCodexAppServer = buildExecutionProfile({
    ...ontologyCommon,
    profileKey: "ontology-codex-app-server",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
  });
  const ontologyPiCodex = buildExecutionProfile({
    ...ontologyCommon,
    profileKey: "ontology-pi-codex",
    runtimeDefinition: pi,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
  });
  const ontologyRoute = buildWorkloadRoute({
    routeKey: "ontology-normalization-default",
    revision: configuration.revision * 1_000 +
      ONTOLOGY_MECHANISM_EXECUTION_PROTOCOL_REVISION,
    taskKind: "ONTOLOGY_NORMALIZATION",
    executionProfileId: ontologyCodexAppServer.executionProfileId,
    updatedAt: createdAt,
  });
  const worldStateMechanismResearch = buildExecutionProfile({
    revision: configuration.revision * 1_000 +
      WORLD_STATE_MECHANISM_RESEARCH_EXECUTION_REVISION,
    profileKey: "world-state-mechanism-codex-app-server",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
    toolProtocol: "WORLD_STATE_MECHANISM_RESEARCH_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 8,
      maximumToolCalls: 24,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "200000",
      maximumOutputTokens: "20000",
    },
    createdAt,
  });
  const worldStateMechanismRoute = buildWorkloadRoute({
    routeKey: "world-state-mechanism-research-default",
    revision: configuration.revision * 1_000 +
      WORLD_STATE_MECHANISM_RESEARCH_EXECUTION_REVISION,
    taskKind: "WORLD_STATE_MECHANISM_RESEARCH",
    executionProfileId: worldStateMechanismResearch.executionProfileId,
    updatedAt: createdAt,
  });
  const subjectBindingResearch = buildExecutionProfile({
    revision: configuration.revision * 1_000 +
      SUBJECT_BINDING_RESEARCH_EXECUTION_REVISION,
    profileKey: "subject-binding-codex-app-server",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
    toolProtocol: "WORLD_STATE_SUBJECT_BINDING_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 6,
      maximumToolCalls: 16,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "100000",
      maximumOutputTokens: "10000",
    },
    createdAt,
  });
  const subjectBindingRoute = buildWorkloadRoute({
    routeKey: "subject-binding-research-default",
    revision: configuration.revision * 1_000 +
      SUBJECT_BINDING_RESEARCH_EXECUTION_REVISION,
    taskKind: "SUBJECT_BINDING_RESEARCH",
    executionProfileId: subjectBindingResearch.executionProfileId,
    updatedAt: createdAt,
  });
  const mechanismPrototypeResearch = buildExecutionProfile({
    revision: configuration.revision * 1_000 +
      MECHANISM_PROTOTYPE_RESEARCH_EXECUTION_REVISION,
    profileKey: "mechanism-prototype-codex-app-server",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
    toolProtocol: "WORLD_STATE_MECHANISM_PROTOTYPE_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 8,
      maximumToolCalls: 24,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "200000",
      maximumOutputTokens: "20000",
    },
    createdAt,
  });
  const mechanismPrototypeRoute = buildWorkloadRoute({
    routeKey: "mechanism-prototype-research-default",
    revision: configuration.revision * 1_000 +
      MECHANISM_PROTOTYPE_RESEARCH_EXECUTION_REVISION,
    taskKind: "MECHANISM_PROTOTYPE_RESEARCH",
    executionProfileId: mechanismPrototypeResearch.executionProfileId,
    updatedAt: createdAt,
  });
  const mechanismPrototypeExploration = buildExecutionProfile({
    revision: configuration.revision * 1_000 +
      MECHANISM_PROTOTYPE_EXPLORATION_EXECUTION_REVISION,
    profileKey: "mechanism-prototype-exploration-codex-app-server",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
    toolProtocol: "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V9",
    runBudget: {
      maximumModelInvocations: 12,
      maximumToolCalls: 32,
      // The exploration loop may span several independently bounded model
      // turns. Codex app-server still caps each turn at five minutes.
      maximumWallClockMs: 600_000,
      maximumInputTokens: "300000",
      maximumOutputTokens: "20000",
    },
    createdAt,
  });
  const mechanismPrototypeExplorationRoute = buildWorkloadRoute({
    routeKey: "mechanism-prototype-exploration-default",
    revision: configuration.revision * 1_000 +
      MECHANISM_PROTOTYPE_EXPLORATION_EXECUTION_REVISION,
    taskKind: "MECHANISM_PROTOTYPE_EXPLORATION",
    executionProfileId: mechanismPrototypeExploration.executionProfileId,
    updatedAt: createdAt,
  });
  const relationDiscoveryCodexAppServer = buildExecutionProfile({
    // Relation-discovery policy evolves independently from the operator's
    // provider setting. Preserve the old immutable profile whenever its
    // budget or tool contract changes.
    revision: configuration.revision * 1_000 +
      RELATION_DISCOVERY_EXECUTION_PROTOCOL_REVISION,
    profileKey: "relation-discovery-codex-app-server",
    runtimeDefinition: codex,
    credentialBinding: codexCredential,
    modelProfile: codexModel,
    toolProtocol: "RELATION_DISCOVERY_AGENT_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 12,
      maximumToolCalls: 32,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "300000",
      maximumOutputTokens: "30000",
    },
    createdAt,
  });
  const relationDiscoveryRoute = buildWorkloadRoute({
    routeKey: "relation-discovery-default",
    revision: configuration.revision * 1_000 +
      RELATION_DISCOVERY_EXECUTION_PROTOCOL_REVISION,
    taskKind: "RELATION_DISCOVERY",
    executionProfileId: relationDiscoveryCodexAppServer.executionProfileId,
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
      ontologyCodexAppServer,
      ontologyPiCodex,
      worldStateMechanismResearch,
      subjectBindingResearch,
      mechanismPrototypeResearch,
      mechanismPrototypeExploration,
      relationDiscoveryCodexAppServer,
    ]),
    workloadRoutes: Object.freeze([
      route,
      ontologyRoute,
      worldStateMechanismRoute,
      subjectBindingRoute,
      mechanismPrototypeRoute,
      mechanismPrototypeExplorationRoute,
      relationDiscoveryRoute,
    ]),
  });
}
