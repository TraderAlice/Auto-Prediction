import { hashCanonical, type Hash } from "@pmh/domain";
import type { AiRuntimeConfiguration } from "./ai-runtime-configuration.js";
import {
  assertEvidenceDocumentCapture,
  type EvidenceDocumentCapture,
} from "./evidence-document.js";
import {
  assertEvidenceRequirement,
  type EvidenceRequirement,
} from "./evidence-requirement.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/u;
const NON_NEGATIVE_INTEGER_PATTERN = /^(?:0|[1-9][0-9]*)$/u;
const BUILTIN_REGISTERED_AT = "1970-01-01T00:00:00.000Z";

export const AGENT_RUNTIME_KINDS = Object.freeze([
  "PI",
  "CODEX",
  "HARNESS_IN_PROCESS",
] as const);
export const MODEL_ACCESS_DRIVERS = Object.freeze([
  "CODEX_RESPONSES",
  "DEEPSEEK_OPENAI_COMPATIBLE",
] as const);
export const CREDENTIAL_BINDING_KINDS = Object.freeze([
  "CODEX_OAUTH",
  "DEEPSEEK_API_KEY",
] as const);
export const AGENT_TASK_KINDS = Object.freeze([
  "DISCOVERY_SCOUT",
  "SEMANTIC_REVIEW",
  "PROBABILITY_ESTIMATION",
  "PREMISE_ANALYSIS",
  "PREMISE_EVIDENCE_ROUTING",
  "OFFICIAL_SOURCE_DISCOVERY",
  "RULE_EVIDENCE_CLAIM",
  "PI_INVESTIGATION",
] as const);

export type AgentRuntimeKind = (typeof AGENT_RUNTIME_KINDS)[number];
export type ModelAccessDriver = (typeof MODEL_ACCESS_DRIVERS)[number];
export type CredentialBindingKind = (typeof CREDENTIAL_BINDING_KINDS)[number];
export type AgentTaskKind = (typeof AGENT_TASK_KINDS)[number];

export type AgentRuntimeDefinition = Readonly<{
  schemaVersion: "pmh.agent-runtime-definition.v1";
  runtimeDefinitionId: Hash;
  kind: AgentRuntimeKind;
  version: string;
  capabilities: Readonly<{
    sessions: boolean;
    resume: boolean;
    compaction: boolean;
    cancellation: boolean;
    toolEffects: true;
    supportedModelDrivers: readonly ModelAccessDriver[];
  }>;
  registeredAt: string;
}>;

export type CredentialBinding = Readonly<{
  schemaVersion: "pmh.credential-binding.v1";
  credentialBindingId: Hash;
  kind: CredentialBindingKind;
  logicalAccountRef: string;
  resolverKind: "CODEX_AUTH_CACHE" | "ENVIRONMENT";
  resolverRef: string;
  createdAt: string;
  secretMaterialRetained: false;
}>;

export type CodexModelConfiguration = Readonly<{
  schemaVersion: "pmh.codex-model-configuration.v1";
  reasoning: Readonly<{
    effort: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  }>;
  responseStorage: false;
}>;

export type DeepSeekFlashModelConfiguration = Readonly<{
  schemaVersion: "pmh.deepseek-flash-model-configuration.v1";
  thinking: Readonly<{
    mode: "disabled" | "enabled";
  }>;
  responseStorage: false;
}>;

export type ModelProfile = Readonly<{
  schemaVersion: "pmh.model-profile.v1";
  modelProfileId: Hash;
  profileKey: string;
  revision: number;
  accessDriver: ModelAccessDriver;
  model: string;
  configuration: CodexModelConfiguration | DeepSeekFlashModelConfiguration;
  capabilities: Readonly<{
    streaming: boolean;
    toolCalling: boolean;
    reasoning: boolean;
  }>;
  createdAt: string;
}>;

export type ExecutionProfile = Readonly<{
  schemaVersion: "pmh.execution-profile.v1";
  executionProfileId: Hash;
  profileKey: string;
  revision: number;
  runtimeDefinitionId: Hash;
  credentialBindingId: Hash;
  modelProfileId: Hash;
  toolPolicy: Readonly<{
    protocol: string;
    firstPartyValidation: true;
    freeTextResultAuthority: false;
  }>;
  runBudget: Readonly<{
    maximumModelInvocations: number;
    maximumToolCalls: number;
    maximumWallClockMs: number;
    maximumInputTokens: string | null;
    maximumOutputTokens: string | null;
  }>;
  createdAt: string;
}>;

export type AgentTaskArtifactRef = Readonly<{
  kind: string;
  artifactId: string;
  artifactHash: Hash;
}>;

export type AgentTask = Readonly<{
  schemaVersion: "pmh.agent-task.v1";
  taskId: Hash;
  kind: AgentTaskKind;
  protocol: string;
  inputArtifacts: readonly AgentTaskArtifactRef[];
  taskPayloadHash: Hash;
  requestedEffectProtocol: string;
  parentTaskId: Hash | null;
  provenanceRef: string;
  priority: number;
  authority: Readonly<{
    modelInvocations: false;
    externalWrites: false;
    semanticDecision: false;
    certificatePublication: false;
    valueMovingActions: false;
  }>;
  createdAt: string;
}>;

export type WorkloadRoute = Readonly<{
  schemaVersion: "pmh.workload-route.v1";
  workloadRouteId: Hash;
  routeKey: string;
  revision: number;
  taskKind: AgentTaskKind;
  executionProfileId: Hash;
  automaticDispatch: false;
  updatedAt: string;
}>;

export type AgentCampaign = Readonly<{
  schemaVersion: "pmh.agent-campaign.v1";
  campaignId: Hash;
  campaignKey: string;
  revision: number;
  status: "PAUSED" | "ACTIVE";
  executionProfileId: Hash;
  taskIds: readonly Hash[];
  schedule: Readonly<{
    kind: "MANUAL_ONLY" | "INTERVAL";
    intervalMs: number | null;
  }>;
  budget: Readonly<{
    maximumConcurrentRuns: number;
    maximumModelInvocations: number;
    maximumInputTokens: string | null;
    maximumOutputTokens: string | null;
    maximumWallClockMs: number;
  }>;
  activatedAt: string | null;
  activationRef: string | null;
  createdAt: string;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type AgentRunAuthorization = Readonly<{
  kind: "MANUAL" | "CAMPAIGN" | "LEGACY_IMPORT";
  authorizationRef: string;
  campaignId: Hash | null;
  authorizedAt: string;
}>;

export type AgentRun = Readonly<{
  schemaVersion: "pmh.agent-run.v1";
  runId: Hash;
  taskId: Hash;
  executionProfileId: Hash;
  runOrdinal: number;
  authorization: AgentRunAuthorization;
  status: "PREPARED" | "INTERRUPTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  createdAt: string;
  completedAt: string | null;
  terminalDiagnostic: string | null;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ModelInvocation = Readonly<{
  schemaVersion: "pmh.model-invocation.v1";
  invocationId: Hash;
  runId: Hash;
  ordinal: number;
  accessDriver: ModelAccessDriver;
  modelProfileId: Hash;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
  startedAt: string;
  completedAt: string;
  inputTokens: string | null;
  outputTokens: string | null;
  reasoningTokens: string | null;
  failureCategory: string | null;
  responseStorage: false;
}>;

export type AgentToolEffect = Readonly<{
  schemaVersion: "pmh.agent-tool-effect.v1";
  effectId: Hash;
  runId: Hash;
  ordinal: number;
  toolProtocol: string;
  toolName: string;
  status: "ACCEPTED" | "REJECTED";
  canonicalInputHash: Hash;
  canonicalOutputHash: Hash;
  occurredAt: string;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type AgentRunArtifact = Readonly<{
  schemaVersion: "pmh.agent-run-artifact.v1";
  artifactId: Hash;
  runId: Hash;
  ordinal: number;
  kind: string;
  contentHash: Hash;
  sourceArtifactRef: string | null;
  createdAt: string;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type AgentRunAnnotation = Readonly<{
  schemaVersion: "pmh.agent-run-annotation.v1";
  annotationId: Hash;
  runId: Hash;
  category: string;
  sourceRecordRef: string;
  observedFactsHash: Hash;
  note: string;
  createdAt: string;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type ResultSelection = Readonly<{
  schemaVersion: "pmh.result-selection.v1";
  selectionId: Hash;
  taskId: Hash;
  runId: Hash;
  artifactHash: Hash;
  rationale: string;
  selectedAt: string;
  selectionAuthorityRef: string;
  certificateAuthority: false;
  valueMovingAuthority: false;
}>;

export type AgentExecutionSnapshot = Readonly<{
  runtimeDefinitions: readonly AgentRuntimeDefinition[];
  credentialBindings: readonly CredentialBinding[];
  modelProfiles: readonly ModelProfile[];
  executionProfiles: readonly ExecutionProfile[];
  workloadRoutes: readonly WorkloadRoute[];
  tasks: readonly AgentTask[];
  runs: readonly AgentRun[];
  modelInvocations: readonly ModelInvocation[];
  toolEffects: readonly AgentToolEffect[];
  runArtifacts: readonly AgentRunArtifact[];
  runAnnotations: readonly AgentRunAnnotation[];
  campaigns: readonly AgentCampaign[];
  resultSelections: readonly ResultSelection[];
}>;

export type AgentExecutionBatch = Partial<AgentExecutionSnapshot>;

export type AgentExecutionRegistryProjection = Readonly<{
  schemaVersion: "pmh.agent-execution-registry.v1";
  runtimeDefinitionCount: number;
  credentialBindingCount: number;
  modelProfileCount: number;
  executionProfileCount: number;
  workloadRouteCount: number;
  taskCount: number;
  runCount: number;
  modelInvocationCount: number;
  runArtifactCount: number;
  runAnnotationCount: number;
  activeCampaignCount: number;
  automaticDispatchFromConfiguration: false;
  credentialSecretTextRetained: false;
  storage: OperationalStorageProjection<"recordId">;
}>;

export interface AgentExecutionStore {
  readonly agentExecutionStorage: OperationalStorageProjection<"recordId">;
  loadAgentExecutionSnapshot(): AgentExecutionSnapshot;
  saveAgentExecutionBatch(batch: AgentExecutionBatch): void;
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function boundedText(value: unknown, name: string, maximum = 200): string {
  if (typeof value !== "string") throw new Error(`${name} must be text`);
  const compact = value.trim().replace(/\s+/gu, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${name} must be non-empty and at most ${maximum} characters`);
  }
  return compact;
}

function identifier(value: unknown, name: string): string {
  const compact = boundedText(value, name, 160);
  if (!IDENTIFIER_PATTERN.test(compact)) throw new Error(`${name} is invalid`);
  return compact;
}

function canonicalIso(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be text`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${name} must be a canonical ISO timestamp`);
  }
  return value;
}

function hash(value: unknown, name: string): Hash {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${name} must be a canonical hash`);
  }
  return value as Hash;
}

function positiveInteger(value: unknown, name: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value as number;
}

function nonNegativeIntegerString(value: unknown, name: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !NON_NEGATIVE_INTEGER_PATTERN.test(value)) {
    throw new Error(`${name} must be a non-negative integer string or null`);
  }
  return value;
}

function assertHashIdentity(
  actual: unknown,
  body: unknown,
  name: string,
): Hash {
  const validated = hash(actual, name);
  if (validated !== hashCanonical(body)) throw new Error(`${name} is inconsistent`);
  return validated;
}

function sortedUnique<T>(
  values: readonly T[],
  identity: (value: T) => string,
): readonly T[] {
  const sorted = [...values].sort((left, right) =>
    identity(left).localeCompare(identity(right), "en")
  );
  if (new Set(sorted.map(identity)).size !== sorted.length) {
    throw new Error("Agent execution collection contains duplicate identities");
  }
  return Object.freeze(sorted);
}

const RUNTIME_DRIVERS: Readonly<Record<AgentRuntimeKind, readonly ModelAccessDriver[]>> =
  Object.freeze({
    PI: MODEL_ACCESS_DRIVERS,
    CODEX: Object.freeze(["CODEX_RESPONSES"] as const),
    HARNESS_IN_PROCESS: MODEL_ACCESS_DRIVERS,
  });

const MODEL_CREDENTIALS: Readonly<Record<ModelAccessDriver, CredentialBindingKind>> =
  Object.freeze({
    CODEX_RESPONSES: "CODEX_OAUTH",
    DEEPSEEK_OPENAI_COMPATIBLE: "DEEPSEEK_API_KEY",
  });

const CODEX_MODEL_EFFORTS = Object.freeze({
  "gpt-5.6-luna": Object.freeze(["none", "low", "medium", "high", "xhigh", "max"] as const),
  "gpt-5.6-terra": Object.freeze(["none", "low", "medium", "high", "xhigh", "max"] as const),
});

export function buildAgentRuntimeDefinition(input: Readonly<{
  kind: AgentRuntimeKind;
  version: string;
  capabilities?: Partial<AgentRuntimeDefinition["capabilities"]>;
  registeredAt?: string;
}>): AgentRuntimeDefinition {
  if (!AGENT_RUNTIME_KINDS.includes(input.kind)) throw new Error("Agent runtime kind is invalid");
  const version = identifier(input.version, "Agent runtime version");
  const supportedModelDrivers = sortedUnique(
    input.capabilities?.supportedModelDrivers ?? RUNTIME_DRIVERS[input.kind],
    (driver) => driver,
  );
  if (!supportedModelDrivers.every((driver) => MODEL_ACCESS_DRIVERS.includes(driver))) {
    throw new Error("Agent runtime declares an unsupported model driver");
  }
  const capabilities = Object.freeze({
    sessions: input.capabilities?.sessions ?? input.kind !== "HARNESS_IN_PROCESS",
    resume: input.capabilities?.resume ?? input.kind !== "HARNESS_IN_PROCESS",
    compaction: input.capabilities?.compaction ?? input.kind !== "HARNESS_IN_PROCESS",
    cancellation: input.capabilities?.cancellation ?? true,
    toolEffects: true as const,
    supportedModelDrivers,
  });
  const identity = Object.freeze({ kind: input.kind, version, capabilities });
  return assertAgentRuntimeDefinition(Object.freeze({
    schemaVersion: "pmh.agent-runtime-definition.v1" as const,
    runtimeDefinitionId: hashCanonical(identity),
    ...identity,
    registeredAt: canonicalIso(
      input.registeredAt ?? BUILTIN_REGISTERED_AT,
      "Agent runtime registeredAt",
    ),
  }));
}

export function assertAgentRuntimeDefinition(value: unknown): AgentRuntimeDefinition {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent runtime definition is malformed");
  }
  const record = value as AgentRuntimeDefinition;
  if (
    !exactKeys(record, [
      "schemaVersion", "runtimeDefinitionId", "kind", "version", "capabilities",
      "registeredAt",
    ]) ||
    record.schemaVersion !== "pmh.agent-runtime-definition.v1" ||
    !AGENT_RUNTIME_KINDS.includes(record.kind) ||
    record.capabilities === null || typeof record.capabilities !== "object" ||
    !exactKeys(record.capabilities, [
      "sessions", "resume", "compaction", "cancellation", "toolEffects",
      "supportedModelDrivers",
    ]) ||
    [record.capabilities.sessions, record.capabilities.resume,
      record.capabilities.compaction, record.capabilities.cancellation].some(
        (item) => typeof item !== "boolean",
      ) ||
    record.capabilities.toolEffects !== true ||
    !Array.isArray(record.capabilities.supportedModelDrivers) ||
    !record.capabilities.supportedModelDrivers.every((driver) =>
      MODEL_ACCESS_DRIVERS.includes(driver)
    )
  ) throw new Error("Agent runtime definition is invalid");
  const version = identifier(record.version, "Agent runtime version");
  const drivers = sortedUnique(record.capabilities.supportedModelDrivers, (driver) => driver);
  if (drivers.some((driver, index) => driver !== record.capabilities.supportedModelDrivers[index])) {
    throw new Error("Agent runtime model drivers must be canonical");
  }
  canonicalIso(record.registeredAt, "Agent runtime registeredAt");
  assertHashIdentity(record.runtimeDefinitionId, {
    kind: record.kind,
    version,
    capabilities: record.capabilities,
  }, "Agent runtime definition identity");
  return record;
}

export function buildCredentialBinding(input: Readonly<{
  kind: CredentialBindingKind;
  logicalAccountRef: string;
  resolverKind: CredentialBinding["resolverKind"];
  resolverRef: string;
  createdAt?: string;
}>): CredentialBinding {
  if (!CREDENTIAL_BINDING_KINDS.includes(input.kind)) {
    throw new Error("Credential binding kind is invalid");
  }
  const identity = Object.freeze({
    kind: input.kind,
    logicalAccountRef: identifier(input.logicalAccountRef, "Credential logical account ref"),
    resolverKind: input.resolverKind,
    resolverRef: identifier(input.resolverRef, "Credential resolver ref"),
  });
  return assertCredentialBinding(Object.freeze({
    schemaVersion: "pmh.credential-binding.v1" as const,
    credentialBindingId: hashCanonical(identity),
    ...identity,
    createdAt: canonicalIso(input.createdAt ?? BUILTIN_REGISTERED_AT, "Credential createdAt"),
    secretMaterialRetained: false as const,
  }));
}

export function assertCredentialBinding(value: unknown): CredentialBinding {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Credential binding is malformed");
  }
  const record = value as CredentialBinding;
  if (
    !exactKeys(record, [
      "schemaVersion", "credentialBindingId", "kind", "logicalAccountRef",
      "resolverKind", "resolverRef", "createdAt", "secretMaterialRetained",
    ]) ||
    record.schemaVersion !== "pmh.credential-binding.v1" ||
    !CREDENTIAL_BINDING_KINDS.includes(record.kind) ||
    !["CODEX_AUTH_CACHE", "ENVIRONMENT"].includes(record.resolverKind) ||
    record.secretMaterialRetained !== false
  ) throw new Error("Credential binding is invalid");
  const identity = {
    kind: record.kind,
    logicalAccountRef: identifier(record.logicalAccountRef, "Credential logical account ref"),
    resolverKind: record.resolverKind,
    resolverRef: identifier(record.resolverRef, "Credential resolver ref"),
  };
  canonicalIso(record.createdAt, "Credential createdAt");
  assertHashIdentity(record.credentialBindingId, identity, "Credential binding identity");
  return record;
}

function assertModelConfiguration(
  driver: ModelAccessDriver,
  model: string,
  value: unknown,
): CodexModelConfiguration | DeepSeekFlashModelConfiguration {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model configuration is malformed");
  }
  if (driver === "CODEX_RESPONSES") {
    const configuration = value as CodexModelConfiguration;
    const allowedEfforts = CODEX_MODEL_EFFORTS[model as keyof typeof CODEX_MODEL_EFFORTS];
    if (
      allowedEfforts === undefined ||
      !exactKeys(configuration, ["schemaVersion", "reasoning", "responseStorage"]) ||
      configuration.schemaVersion !== "pmh.codex-model-configuration.v1" ||
      configuration.reasoning === null || typeof configuration.reasoning !== "object" ||
      !exactKeys(configuration.reasoning, ["effort"]) ||
      !allowedEfforts.includes(configuration.reasoning.effort) ||
      configuration.responseStorage !== false
    ) throw new Error("Codex model configuration is invalid for the selected model");
    return configuration;
  }
  const configuration = value as DeepSeekFlashModelConfiguration;
  if (
    model !== "deepseek-v4-flash" ||
    !exactKeys(configuration, ["schemaVersion", "thinking", "responseStorage"]) ||
    configuration.schemaVersion !== "pmh.deepseek-flash-model-configuration.v1" ||
    configuration.thinking === null || typeof configuration.thinking !== "object" ||
    !exactKeys(configuration.thinking, ["mode"]) ||
    !["disabled", "enabled"].includes(configuration.thinking.mode) ||
    configuration.responseStorage !== false
  ) throw new Error("DeepSeek model configuration is invalid for the selected model");
  return configuration;
}

function modelConfigurationHasReasoning(
  driver: ModelAccessDriver,
  configuration: CodexModelConfiguration | DeepSeekFlashModelConfiguration,
): boolean {
  return driver === "CODEX_RESPONSES" ||
    (configuration as DeepSeekFlashModelConfiguration).thinking.mode === "enabled";
}

export function buildModelProfile(input: Readonly<{
  profileKey: string;
  revision: number;
  accessDriver: ModelAccessDriver;
  model: string;
  configuration: CodexModelConfiguration | DeepSeekFlashModelConfiguration;
  createdAt: string;
}>): ModelProfile {
  if (!MODEL_ACCESS_DRIVERS.includes(input.accessDriver)) {
    throw new Error("Model access driver is invalid");
  }
  const model = identifier(input.model, "Model identifier");
  const configuration = assertModelConfiguration(input.accessDriver, model, input.configuration);
  const capabilities = Object.freeze({
    streaming: true,
    toolCalling: true,
    reasoning: modelConfigurationHasReasoning(input.accessDriver, configuration),
  });
  const identity = Object.freeze({
    profileKey: identifier(input.profileKey, "Model profile key"),
    revision: positiveInteger(input.revision, "Model profile revision", Number.MAX_SAFE_INTEGER),
    accessDriver: input.accessDriver,
    model,
    configuration,
    capabilities,
  });
  return assertModelProfile(Object.freeze({
    schemaVersion: "pmh.model-profile.v1" as const,
    modelProfileId: hashCanonical(identity),
    ...identity,
    createdAt: canonicalIso(input.createdAt, "Model profile createdAt"),
  }));
}

export function assertModelProfile(value: unknown): ModelProfile {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model profile is malformed");
  }
  const record = value as ModelProfile;
  if (
    !exactKeys(record, [
      "schemaVersion", "modelProfileId", "profileKey", "revision", "accessDriver",
      "model", "configuration", "capabilities", "createdAt",
    ]) ||
    record.schemaVersion !== "pmh.model-profile.v1" ||
    !MODEL_ACCESS_DRIVERS.includes(record.accessDriver) ||
    record.capabilities === null || typeof record.capabilities !== "object" ||
    !exactKeys(record.capabilities, ["streaming", "toolCalling", "reasoning"]) ||
    [record.capabilities.streaming, record.capabilities.toolCalling,
      record.capabilities.reasoning].some((item) => typeof item !== "boolean")
  ) throw new Error("Model profile is invalid");
  const profileKey = identifier(record.profileKey, "Model profile key");
  const revision = positiveInteger(record.revision, "Model profile revision", Number.MAX_SAFE_INTEGER);
  const model = identifier(record.model, "Model identifier");
  const configuration = assertModelConfiguration(record.accessDriver, model, record.configuration);
  const reasoning = modelConfigurationHasReasoning(record.accessDriver, configuration);
  if (!record.capabilities.streaming || !record.capabilities.toolCalling ||
      record.capabilities.reasoning !== reasoning) {
    throw new Error("Model profile capabilities are inconsistent");
  }
  canonicalIso(record.createdAt, "Model profile createdAt");
  assertHashIdentity(record.modelProfileId, {
    profileKey,
    revision,
    accessDriver: record.accessDriver,
    model,
    configuration,
    capabilities: record.capabilities,
  }, "Model profile identity");
  return record;
}

function assertRunBudget(value: ExecutionProfile["runBudget"]): ExecutionProfile["runBudget"] {
  if (value === null || typeof value !== "object" ||
      !exactKeys(value, [
        "maximumModelInvocations", "maximumToolCalls", "maximumWallClockMs",
        "maximumInputTokens", "maximumOutputTokens",
      ])) throw new Error("Execution profile run budget is malformed");
  positiveInteger(value.maximumModelInvocations, "Maximum model invocations", 1_000);
  positiveInteger(value.maximumToolCalls, "Maximum tool calls", 10_000);
  positiveInteger(value.maximumWallClockMs, "Maximum wall-clock milliseconds", 86_400_000);
  nonNegativeIntegerString(value.maximumInputTokens, "Maximum input tokens");
  nonNegativeIntegerString(value.maximumOutputTokens, "Maximum output tokens");
  return value;
}

export function buildExecutionProfile(input: Readonly<{
  profileKey: string;
  revision: number;
  runtimeDefinition: AgentRuntimeDefinition;
  credentialBinding: CredentialBinding;
  modelProfile: ModelProfile;
  toolProtocol: string;
  runBudget: ExecutionProfile["runBudget"];
  createdAt: string;
}>): ExecutionProfile {
  const runtime = assertAgentRuntimeDefinition(input.runtimeDefinition);
  const credential = assertCredentialBinding(input.credentialBinding);
  const model = assertModelProfile(input.modelProfile);
  assertExecutionProfileCompatibility(runtime, credential, model);
  const identity = Object.freeze({
    profileKey: identifier(input.profileKey, "Execution profile key"),
    revision: positiveInteger(input.revision, "Execution profile revision", Number.MAX_SAFE_INTEGER),
    runtimeDefinitionId: runtime.runtimeDefinitionId,
    credentialBindingId: credential.credentialBindingId,
    modelProfileId: model.modelProfileId,
    toolPolicy: Object.freeze({
      protocol: identifier(input.toolProtocol, "Tool protocol"),
      firstPartyValidation: true as const,
      freeTextResultAuthority: false as const,
    }),
    runBudget: assertRunBudget(input.runBudget),
  });
  return assertExecutionProfile(Object.freeze({
    schemaVersion: "pmh.execution-profile.v1" as const,
    executionProfileId: hashCanonical(identity),
    ...identity,
    createdAt: canonicalIso(input.createdAt, "Execution profile createdAt"),
  }));
}

export function assertExecutionProfileCompatibility(
  runtimeInput: AgentRuntimeDefinition,
  credentialInput: CredentialBinding,
  modelInput: ModelProfile,
): void {
  const runtime = assertAgentRuntimeDefinition(runtimeInput);
  const credential = assertCredentialBinding(credentialInput);
  const model = assertModelProfile(modelInput);
  if (!runtime.capabilities.supportedModelDrivers.includes(model.accessDriver)) {
    throw new Error("Agent runtime does not support the selected model access driver");
  }
  if (MODEL_CREDENTIALS[model.accessDriver] !== credential.kind) {
    throw new Error("Credential binding is incompatible with the selected model profile");
  }
}

export function assertExecutionProfile(value: unknown): ExecutionProfile {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Execution profile is malformed");
  }
  const record = value as ExecutionProfile;
  if (
    !exactKeys(record, [
      "schemaVersion", "executionProfileId", "profileKey", "revision",
      "runtimeDefinitionId", "credentialBindingId", "modelProfileId", "toolPolicy",
      "runBudget", "createdAt",
    ]) ||
    record.schemaVersion !== "pmh.execution-profile.v1" ||
    record.toolPolicy === null || typeof record.toolPolicy !== "object" ||
    !exactKeys(record.toolPolicy, [
      "protocol", "firstPartyValidation", "freeTextResultAuthority",
    ]) ||
    record.toolPolicy.firstPartyValidation !== true ||
    record.toolPolicy.freeTextResultAuthority !== false
  ) throw new Error("Execution profile is invalid");
  const identity = {
    profileKey: identifier(record.profileKey, "Execution profile key"),
    revision: positiveInteger(record.revision, "Execution profile revision", Number.MAX_SAFE_INTEGER),
    runtimeDefinitionId: hash(record.runtimeDefinitionId, "Runtime definition ref"),
    credentialBindingId: hash(record.credentialBindingId, "Credential binding ref"),
    modelProfileId: hash(record.modelProfileId, "Model profile ref"),
    toolPolicy: {
      protocol: identifier(record.toolPolicy.protocol, "Tool protocol"),
      firstPartyValidation: true as const,
      freeTextResultAuthority: false as const,
    },
    runBudget: assertRunBudget(record.runBudget),
  };
  canonicalIso(record.createdAt, "Execution profile createdAt");
  assertHashIdentity(record.executionProfileId, identity, "Execution profile identity");
  return record;
}

export function buildAgentTask(input: Readonly<{
  kind: AgentTaskKind;
  protocol: string;
  inputArtifacts: readonly AgentTaskArtifactRef[];
  taskPayload: unknown;
  requestedEffectProtocol: string;
  parentTaskId?: Hash | null;
  provenanceRef: string;
  priority: number;
  createdAt: string;
}>): AgentTask {
  if (!AGENT_TASK_KINDS.includes(input.kind)) throw new Error("Agent task kind is invalid");
  if (!Number.isSafeInteger(input.priority) || input.priority < 0 || input.priority > 1_000) {
    throw new Error("Agent task priority is invalid");
  }
  const inputArtifacts = sortedUnique(input.inputArtifacts.map((artifact) => Object.freeze({
    kind: identifier(artifact.kind, "Task artifact kind"),
    artifactId: identifier(artifact.artifactId, "Task artifact ID"),
    artifactHash: hash(artifact.artifactHash, "Task artifact hash"),
  })), (artifact) => `${artifact.kind}:${artifact.artifactId}:${artifact.artifactHash}`);
  const identity = Object.freeze({
    kind: input.kind,
    protocol: identifier(input.protocol, "Agent task protocol"),
    inputArtifacts,
    taskPayloadHash: hashCanonical(input.taskPayload),
    requestedEffectProtocol: identifier(
      input.requestedEffectProtocol,
      "Requested effect protocol",
    ),
    parentTaskId: input.parentTaskId === undefined || input.parentTaskId === null
      ? null
      : hash(input.parentTaskId, "Parent task ID"),
    authority: Object.freeze({
      modelInvocations: false as const,
      externalWrites: false as const,
      semanticDecision: false as const,
      certificatePublication: false as const,
      valueMovingActions: false as const,
    }),
  });
  return assertAgentTask(Object.freeze({
    schemaVersion: "pmh.agent-task.v1" as const,
    taskId: hashCanonical(identity),
    ...identity,
    provenanceRef: identifier(input.provenanceRef, "Task provenance ref"),
    priority: input.priority,
    createdAt: canonicalIso(input.createdAt, "Agent task createdAt"),
  }));
}

export function buildRuleEvidenceAgentTask(input: Readonly<{
  requirement: EvidenceRequirement;
  capture: EvidenceDocumentCapture;
  priority?: number;
}>): AgentTask {
  const requirement = assertEvidenceRequirement(input.requirement);
  const capture = assertEvidenceDocumentCapture(input.capture);
  if (
    capture.observation.acquisitionScopeIdentity !== requirement.acquisitionScopeIdentity ||
    capture.observation.documentId !== capture.document.record.documentId ||
    capture.extraction.record.documentId !== capture.document.record.documentId ||
    capture.extraction.record.rawHash !== capture.document.record.rawHash
  ) throw new Error("Rule Evidence Agent task input lineage is inconsistent");
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: Object.freeze([
      Object.freeze({
        kind: "EVIDENCE_REQUIREMENT",
        artifactId: requirement.requirementId,
        artifactHash: hashCanonical(requirement),
      }),
      Object.freeze({
        kind: "EVIDENCE_OBSERVATION",
        artifactId: capture.observation.observationId,
        artifactHash: hashCanonical(capture.observation),
      }),
      Object.freeze({
        kind: "EVIDENCE_DOCUMENT",
        artifactId: capture.document.record.documentId,
        artifactHash: capture.document.record.rawHash,
      }),
      Object.freeze({
        kind: "EVIDENCE_EXTRACTION",
        artifactId: capture.extraction.record.extractionId,
        artifactHash: capture.extraction.record.textHash,
      }),
    ]),
    taskPayload: Object.freeze({
      requirementId: requirement.requirementId,
      proposalId: requirement.proposalId,
      requirementKind: requirement.kind,
      temporalPosture: requirement.temporalPosture,
      acquisitionScopeIdentity: requirement.acquisitionScopeIdentity,
      observationId: capture.observation.observationId,
      documentId: capture.document.record.documentId,
      documentRawHash: capture.document.record.rawHash,
      extractionId: capture.extraction.record.extractionId,
      extractionTextHash: capture.extraction.record.textHash,
    }),
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: `rule-evidence:${requirement.requirementId}`,
    priority: input.priority ?? 0,
    createdAt: capture.observation.receivedAt,
  });
}

export function assertAgentTask(value: unknown): AgentTask {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent task is malformed");
  }
  const record = value as AgentTask;
  if (
    !exactKeys(record, [
      "schemaVersion", "taskId", "kind", "protocol", "inputArtifacts",
      "taskPayloadHash", "requestedEffectProtocol", "parentTaskId", "provenanceRef",
      "priority", "authority", "createdAt",
    ]) ||
    record.schemaVersion !== "pmh.agent-task.v1" ||
    !AGENT_TASK_KINDS.includes(record.kind) ||
    !Array.isArray(record.inputArtifacts) ||
    record.authority === null || typeof record.authority !== "object" ||
    !exactKeys(record.authority, [
      "modelInvocations", "externalWrites", "semanticDecision",
      "certificatePublication", "valueMovingActions",
    ]) || Object.values(record.authority).some((item) => item !== false) ||
    !Number.isSafeInteger(record.priority) || record.priority < 0 || record.priority > 1_000
  ) throw new Error("Agent task is invalid");
  const inputArtifacts = sortedUnique(record.inputArtifacts.map((artifact) => {
    if (artifact === null || typeof artifact !== "object" ||
        !exactKeys(artifact, ["kind", "artifactId", "artifactHash"])) {
      throw new Error("Agent task artifact reference is invalid");
    }
    identifier(artifact.kind, "Task artifact kind");
    identifier(artifact.artifactId, "Task artifact ID");
    hash(artifact.artifactHash, "Task artifact hash");
    return artifact;
  }), (artifact) => `${artifact.kind}:${artifact.artifactId}:${artifact.artifactHash}`);
  if (inputArtifacts.some((artifact, index) => artifact !== record.inputArtifacts[index])) {
    throw new Error("Agent task artifact references must be canonical");
  }
  const identity = {
    kind: record.kind,
    protocol: identifier(record.protocol, "Agent task protocol"),
    inputArtifacts: record.inputArtifacts,
    taskPayloadHash: hash(record.taskPayloadHash, "Agent task payload hash"),
    requestedEffectProtocol: identifier(record.requestedEffectProtocol, "Requested effect protocol"),
    parentTaskId: record.parentTaskId === null ? null : hash(record.parentTaskId, "Parent task ID"),
    authority: record.authority,
  };
  identifier(record.provenanceRef, "Task provenance ref");
  canonicalIso(record.createdAt, "Agent task createdAt");
  assertHashIdentity(record.taskId, identity, "Agent task identity");
  return record;
}

export function buildWorkloadRoute(input: Readonly<{
  routeKey: string;
  revision: number;
  taskKind: AgentTaskKind;
  executionProfileId: Hash;
  updatedAt: string;
}>): WorkloadRoute {
  const identity = Object.freeze({
    routeKey: identifier(input.routeKey, "Workload route key"),
    revision: positiveInteger(input.revision, "Workload route revision", Number.MAX_SAFE_INTEGER),
    taskKind: input.taskKind,
    executionProfileId: hash(input.executionProfileId, "Execution profile ref"),
    automaticDispatch: false as const,
  });
  return assertWorkloadRoute(Object.freeze({
    schemaVersion: "pmh.workload-route.v1" as const,
    workloadRouteId: hashCanonical(identity),
    ...identity,
    updatedAt: canonicalIso(input.updatedAt, "Workload route updatedAt"),
  }));
}

export function assertWorkloadRoute(value: unknown): WorkloadRoute {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Workload route is malformed");
  }
  const record = value as WorkloadRoute;
  if (
    !exactKeys(record, [
      "schemaVersion", "workloadRouteId", "routeKey", "revision", "taskKind",
      "executionProfileId", "automaticDispatch", "updatedAt",
    ]) || record.schemaVersion !== "pmh.workload-route.v1" ||
    !AGENT_TASK_KINDS.includes(record.taskKind) || record.automaticDispatch !== false
  ) throw new Error("Workload route is invalid");
  const identity = {
    routeKey: identifier(record.routeKey, "Workload route key"),
    revision: positiveInteger(record.revision, "Workload route revision", Number.MAX_SAFE_INTEGER),
    taskKind: record.taskKind,
    executionProfileId: hash(record.executionProfileId, "Execution profile ref"),
    automaticDispatch: false as const,
  };
  canonicalIso(record.updatedAt, "Workload route updatedAt");
  assertHashIdentity(record.workloadRouteId, identity, "Workload route identity");
  return record;
}

export function assertAgentCampaign(value: unknown): AgentCampaign {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent campaign is malformed");
  }
  const record = value as AgentCampaign;
  if (
    !exactKeys(record, [
      "schemaVersion", "campaignId", "campaignKey", "revision", "status",
      "executionProfileId", "taskIds", "schedule", "budget", "activatedAt",
      "activationRef", "createdAt", "externalWriteAuthority", "valueMovingAuthority",
    ]) ||
    record.schemaVersion !== "pmh.agent-campaign.v1" ||
    !["PAUSED", "ACTIVE"].includes(record.status) ||
    record.externalWriteAuthority !== false || record.valueMovingAuthority !== false ||
    !Array.isArray(record.taskIds) ||
    record.schedule === null || typeof record.schedule !== "object" ||
    !exactKeys(record.schedule, ["kind", "intervalMs"]) ||
    record.budget === null || typeof record.budget !== "object" ||
    !exactKeys(record.budget, [
      "maximumConcurrentRuns", "maximumModelInvocations", "maximumInputTokens",
      "maximumOutputTokens", "maximumWallClockMs",
    ])
  ) throw new Error("Agent campaign is invalid");
  identifier(record.campaignKey, "Campaign key");
  positiveInteger(record.revision, "Campaign revision", Number.MAX_SAFE_INTEGER);
  hash(record.executionProfileId, "Campaign execution profile ref");
  const canonicalTaskIds = sortedUnique(
    record.taskIds.map((taskId) => hash(taskId, "Campaign task ID")),
    (taskId) => taskId,
  );
  if (canonicalTaskIds.some((taskId, index) => taskId !== record.taskIds[index])) {
    throw new Error("Agent campaign task membership must be canonical");
  }
  if (!["MANUAL_ONLY", "INTERVAL"].includes(record.schedule.kind) ||
      (record.schedule.kind === "MANUAL_ONLY" && record.schedule.intervalMs !== null) ||
      (record.schedule.kind === "INTERVAL" && (
        !Number.isSafeInteger(record.schedule.intervalMs) ||
        (record.schedule.intervalMs ?? 0) < 1_000
      ))) throw new Error("Agent campaign schedule is invalid");
  positiveInteger(record.budget.maximumConcurrentRuns, "Campaign concurrency", 64);
  positiveInteger(record.budget.maximumModelInvocations, "Campaign model invocations", 100_000);
  positiveInteger(record.budget.maximumWallClockMs, "Campaign wall-clock budget", 604_800_000);
  nonNegativeIntegerString(record.budget.maximumInputTokens, "Campaign input tokens");
  nonNegativeIntegerString(record.budget.maximumOutputTokens, "Campaign output tokens");
  canonicalIso(record.createdAt, "Campaign createdAt");
  if (record.status === "ACTIVE") {
    const activatedAt = canonicalIso(record.activatedAt, "Campaign activatedAt");
    identifier(record.activationRef, "Campaign activation ref");
    if (Date.parse(activatedAt) < Date.parse(record.createdAt)) {
      throw new Error("Campaign activation cannot precede creation");
    }
  } else if (record.activatedAt !== null || record.activationRef !== null) {
    throw new Error("Paused campaign cannot retain activation authority");
  }
  const { campaignId: _campaignId, ...body } = record;
  assertHashIdentity(record.campaignId, body, "Campaign identity");
  return record;
}

export function buildPausedAgentCampaign(input: Readonly<{
  campaignKey: string;
  revision: number;
  executionProfileId: Hash;
  taskIds: readonly Hash[];
  schedule: AgentCampaign["schedule"];
  budget: AgentCampaign["budget"];
  createdAt: string;
}>): AgentCampaign {
  const body = Object.freeze({
    schemaVersion: "pmh.agent-campaign.v1" as const,
    campaignKey: identifier(input.campaignKey, "Campaign key"),
    revision: positiveInteger(input.revision, "Campaign revision", Number.MAX_SAFE_INTEGER),
    status: "PAUSED" as const,
    executionProfileId: hash(input.executionProfileId, "Campaign execution profile ref"),
    taskIds: sortedUnique(input.taskIds.map((taskId) => hash(taskId, "Campaign task ID")), (id) => id),
    schedule: input.schedule,
    budget: input.budget,
    activatedAt: null,
    activationRef: null,
    createdAt: canonicalIso(input.createdAt, "Campaign createdAt"),
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertAgentCampaign(Object.freeze({ ...body, campaignId: hashCanonical(body) }));
}

export function activateAgentCampaign(
  campaignInput: AgentCampaign,
  activationRef: string,
  activatedAt: string,
): AgentCampaign {
  const campaign = assertAgentCampaign(campaignInput);
  if (campaign.status !== "PAUSED") throw new Error("Only a paused campaign can be activated");
  const body = Object.freeze({
    ...campaign,
    campaignId: undefined,
    revision: campaign.revision + 1,
    status: "ACTIVE" as const,
    activatedAt: canonicalIso(activatedAt, "Campaign activatedAt"),
    activationRef: identifier(activationRef, "Campaign activation ref"),
  });
  const { campaignId: _ignored, ...withoutUndefined } = body;
  return assertAgentCampaign(Object.freeze({
    ...withoutUndefined,
    campaignId: hashCanonical(withoutUndefined),
  }));
}

export function assertAgentRun(value: unknown): AgentRun {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent run is malformed");
  }
  const record = value as AgentRun;
  if (
    !exactKeys(record, [
      "schemaVersion", "runId", "taskId", "executionProfileId", "runOrdinal",
      "authorization", "status", "createdAt", "completedAt", "terminalDiagnostic",
      "externalWriteAuthority", "valueMovingAuthority",
    ]) || record.schemaVersion !== "pmh.agent-run.v1" ||
    !["PREPARED", "INTERRUPTED", "SUCCEEDED", "FAILED", "CANCELLED"].includes(record.status) ||
    record.externalWriteAuthority !== false || record.valueMovingAuthority !== false ||
    record.authorization === null || typeof record.authorization !== "object" ||
    !exactKeys(record.authorization, [
      "kind", "authorizationRef", "campaignId", "authorizedAt",
    ]) || !["MANUAL", "CAMPAIGN", "LEGACY_IMPORT"].includes(record.authorization.kind)
  ) throw new Error("Agent run is invalid");
  const identity = {
    taskId: hash(record.taskId, "Agent run task ID"),
    executionProfileId: hash(record.executionProfileId, "Agent run execution profile ID"),
    runOrdinal: positiveInteger(record.runOrdinal, "Agent run ordinal", Number.MAX_SAFE_INTEGER),
  };
  identifier(record.authorization.authorizationRef, "Run authorization ref");
  canonicalIso(record.authorization.authorizedAt, "Run authorizedAt");
  if ((record.authorization.kind === "CAMPAIGN") === (record.authorization.campaignId === null)) {
    throw new Error("Agent run authorization campaign binding is invalid");
  }
  if (record.authorization.campaignId !== null) {
    hash(record.authorization.campaignId, "Run authorization campaign ID");
  }
  canonicalIso(record.createdAt, "Agent run createdAt");
  if (Date.parse(record.authorization.authorizedAt) > Date.parse(record.createdAt)) {
    throw new Error("Agent run cannot precede its authorization");
  }
  if (record.status === "PREPARED") {
    if (record.completedAt !== null || record.terminalDiagnostic !== null) {
      throw new Error("Prepared Agent run cannot be terminal");
    }
  } else {
    const completedAt = canonicalIso(record.completedAt, "Agent run completedAt");
    if (Date.parse(completedAt) < Date.parse(record.createdAt)) {
      throw new Error("Agent run completion cannot precede creation");
    }
    if (record.terminalDiagnostic !== null) {
      boundedText(record.terminalDiagnostic, "Agent run terminal diagnostic", 500);
    }
  }
  assertHashIdentity(record.runId, identity, "Agent run identity");
  return record;
}

export function buildAgentRun(input: Readonly<{
  task: AgentTask;
  executionProfile: ExecutionProfile;
  runOrdinal: number;
  authorization: Readonly<
    | { kind: "MANUAL"; authorizationRef: string; authorizedAt: string }
    | { kind: "LEGACY_IMPORT"; authorizationRef: string; authorizedAt: string }
    | { kind: "CAMPAIGN"; campaign: AgentCampaign; authorizedAt: string }
  >;
  createdAt: string;
}>): AgentRun {
  const task = assertAgentTask(input.task);
  const profile = assertExecutionProfile(input.executionProfile);
  const runOrdinal = positiveInteger(input.runOrdinal, "Agent run ordinal", Number.MAX_SAFE_INTEGER);
  const authorization = input.authorization.kind !== "CAMPAIGN"
    ? Object.freeze({
        kind: input.authorization.kind,
        authorizationRef: identifier(
          input.authorization.authorizationRef,
          "Run authorization ref",
        ),
        campaignId: null,
        authorizedAt: canonicalIso(input.authorization.authorizedAt, "Run authorizedAt"),
      })
    : (() => {
        const campaign = assertAgentCampaign(input.authorization.campaign);
        if (campaign.status !== "ACTIVE") throw new Error("Paused campaign cannot authorize a run");
        if (campaign.executionProfileId !== profile.executionProfileId) {
          throw new Error("Campaign cannot authorize another execution profile");
        }
        if (!campaign.taskIds.includes(task.taskId)) {
          throw new Error("Campaign cannot authorize a task outside its membership");
        }
        return Object.freeze({
          kind: "CAMPAIGN" as const,
          authorizationRef: identifier(campaign.activationRef, "Run authorization ref"),
          campaignId: campaign.campaignId,
          authorizedAt: canonicalIso(input.authorization.authorizedAt, "Run authorizedAt"),
        });
      })();
  const identity = Object.freeze({
    taskId: task.taskId,
    executionProfileId: profile.executionProfileId,
    runOrdinal,
  });
  return assertAgentRun(Object.freeze({
    schemaVersion: "pmh.agent-run.v1" as const,
    runId: hashCanonical(identity),
    ...identity,
    authorization,
    status: "PREPARED" as const,
    createdAt: canonicalIso(input.createdAt, "Agent run createdAt"),
    completedAt: null,
    terminalDiagnostic: null,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  }));
}

export function completeAgentRun(
  runInput: AgentRun,
  status: Exclude<AgentRun["status"], "PREPARED">,
  completedAt: string,
  terminalDiagnostic: string | null,
): AgentRun {
  const run = assertAgentRun(runInput);
  if (run.status !== "PREPARED") throw new Error("Only a prepared Agent run can terminate");
  return assertAgentRun(Object.freeze({
    ...run,
    status,
    completedAt: canonicalIso(completedAt, "Agent run completedAt"),
    terminalDiagnostic: terminalDiagnostic === null
      ? null
      : boundedText(terminalDiagnostic, "Agent run terminal diagnostic", 500),
  }));
}

export function assertModelInvocation(value: unknown): ModelInvocation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model invocation is malformed");
  }
  const record = value as ModelInvocation;
  if (
    !exactKeys(record, [
      "schemaVersion", "invocationId", "runId", "ordinal", "accessDriver",
      "modelProfileId", "status", "startedAt", "completedAt", "inputTokens",
      "outputTokens", "reasoningTokens", "failureCategory", "responseStorage",
    ]) || record.schemaVersion !== "pmh.model-invocation.v1" ||
    !MODEL_ACCESS_DRIVERS.includes(record.accessDriver) ||
    !["SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED"].includes(record.status) ||
    record.responseStorage !== false
  ) throw new Error("Model invocation is invalid");
  const identity = {
    runId: hash(record.runId, "Model invocation run ID"),
    ordinal: positiveInteger(record.ordinal, "Model invocation ordinal", 100_000),
  };
  hash(record.modelProfileId, "Model invocation profile ID");
  canonicalIso(record.startedAt, "Model invocation startedAt");
  canonicalIso(record.completedAt, "Model invocation completedAt");
  if (Date.parse(record.completedAt) < Date.parse(record.startedAt)) {
    throw new Error("Model invocation completion cannot precede start");
  }
  nonNegativeIntegerString(record.inputTokens, "Model invocation input tokens");
  nonNegativeIntegerString(record.outputTokens, "Model invocation output tokens");
  nonNegativeIntegerString(record.reasoningTokens, "Model invocation reasoning tokens");
  if (record.failureCategory !== null) {
    identifier(record.failureCategory, "Model invocation failure category");
  }
  if (record.status === "SUCCEEDED" && record.failureCategory !== null) {
    throw new Error("Successful model invocation cannot have a failure category");
  }
  assertHashIdentity(record.invocationId, identity, "Model invocation identity");
  return record;
}

export function buildModelInvocation(input: Readonly<{
  run: AgentRun;
  modelProfile: ModelProfile;
  ordinal: number;
  status: ModelInvocation["status"];
  startedAt: string;
  completedAt: string;
  inputTokens?: string | null;
  outputTokens?: string | null;
  reasoningTokens?: string | null;
  failureCategory?: string | null;
}>): ModelInvocation {
  const run = assertAgentRun(input.run);
  const model = assertModelProfile(input.modelProfile);
  const identity = Object.freeze({
    runId: run.runId,
    ordinal: positiveInteger(input.ordinal, "Model invocation ordinal", 100_000),
  });
  return assertModelInvocation(Object.freeze({
    schemaVersion: "pmh.model-invocation.v1" as const,
    invocationId: hashCanonical(identity),
    ...identity,
    accessDriver: model.accessDriver,
    modelProfileId: model.modelProfileId,
    status: input.status,
    startedAt: canonicalIso(input.startedAt, "Model invocation startedAt"),
    completedAt: canonicalIso(input.completedAt, "Model invocation completedAt"),
    inputTokens: nonNegativeIntegerString(input.inputTokens ?? null, "Model invocation input tokens"),
    outputTokens: nonNegativeIntegerString(input.outputTokens ?? null, "Model invocation output tokens"),
    reasoningTokens: nonNegativeIntegerString(
      input.reasoningTokens ?? null,
      "Model invocation reasoning tokens",
    ),
    failureCategory: input.failureCategory === undefined || input.failureCategory === null
      ? null
      : identifier(input.failureCategory, "Model invocation failure category"),
    responseStorage: false as const,
  }));
}

export function assertAgentToolEffect(value: unknown): AgentToolEffect {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent tool effect is malformed");
  }
  const record = value as AgentToolEffect;
  if (
    !exactKeys(record, [
      "schemaVersion", "effectId", "runId", "ordinal", "toolProtocol", "toolName",
      "status", "canonicalInputHash", "canonicalOutputHash", "occurredAt",
      "semanticDecisionAuthority", "certificateAuthority", "externalWriteAuthority",
      "valueMovingAuthority",
    ]) || record.schemaVersion !== "pmh.agent-tool-effect.v1" ||
    !["ACCEPTED", "REJECTED"].includes(record.status) ||
    [record.semanticDecisionAuthority, record.certificateAuthority,
      record.externalWriteAuthority, record.valueMovingAuthority].some((item) => item !== false)
  ) throw new Error("Agent tool effect is invalid");
  const identity = {
    runId: hash(record.runId, "Agent tool effect run ID"),
    ordinal: positiveInteger(record.ordinal, "Agent tool effect ordinal", 100_000),
    toolProtocol: identifier(record.toolProtocol, "Agent tool protocol"),
    canonicalInputHash: hash(record.canonicalInputHash, "Agent tool input hash"),
  };
  identifier(record.toolName, "Agent tool name");
  hash(record.canonicalOutputHash, "Agent tool output hash");
  canonicalIso(record.occurredAt, "Agent tool effect occurredAt");
  assertHashIdentity(record.effectId, identity, "Agent tool effect identity");
  return record;
}

export function buildAgentToolEffect(input: Readonly<{
  run: AgentRun;
  ordinal: number;
  toolProtocol: string;
  toolName: string;
  status: AgentToolEffect["status"];
  canonicalInput: unknown;
  canonicalOutput: unknown;
  occurredAt: string;
}>): AgentToolEffect {
  const run = assertAgentRun(input.run);
  const identity = Object.freeze({
    runId: run.runId,
    ordinal: positiveInteger(input.ordinal, "Agent tool effect ordinal", 100_000),
    toolProtocol: identifier(input.toolProtocol, "Agent tool protocol"),
    canonicalInputHash: hashCanonical(input.canonicalInput),
  });
  return assertAgentToolEffect(Object.freeze({
    schemaVersion: "pmh.agent-tool-effect.v1" as const,
    effectId: hashCanonical(identity),
    ...identity,
    toolName: identifier(input.toolName, "Agent tool name"),
    status: input.status,
    canonicalOutputHash: hashCanonical(input.canonicalOutput),
    occurredAt: canonicalIso(input.occurredAt, "Agent tool effect occurredAt"),
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  }));
}

export function assertAgentRunArtifact(value: unknown): AgentRunArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent run artifact is malformed");
  }
  const record = value as AgentRunArtifact;
  if (
    !exactKeys(record, [
      "schemaVersion", "artifactId", "runId", "ordinal", "kind", "contentHash",
      "sourceArtifactRef", "createdAt", "semanticDecisionAuthority",
      "certificateAuthority", "externalWriteAuthority", "valueMovingAuthority",
    ]) || record.schemaVersion !== "pmh.agent-run-artifact.v1" ||
    [record.semanticDecisionAuthority, record.certificateAuthority,
      record.externalWriteAuthority, record.valueMovingAuthority].some((item) => item !== false)
  ) throw new Error("Agent run artifact is invalid");
  const identity = Object.freeze({
    runId: hash(record.runId, "Agent run artifact run ID"),
    ordinal: positiveInteger(record.ordinal, "Agent run artifact ordinal", 100_000),
    kind: identifier(record.kind, "Agent run artifact kind"),
    contentHash: hash(record.contentHash, "Agent run artifact content hash"),
    sourceArtifactRef: record.sourceArtifactRef === null
      ? null
      : boundedText(record.sourceArtifactRef, "Agent run artifact source ref", 500),
  });
  canonicalIso(record.createdAt, "Agent run artifact createdAt");
  assertHashIdentity(record.artifactId, identity, "Agent run artifact identity");
  return record;
}

export function buildAgentRunArtifact(input: Readonly<{
  run: AgentRun;
  ordinal: number;
  kind: string;
  contentHash: Hash;
  sourceArtifactRef?: string | null;
  createdAt: string;
}>): AgentRunArtifact {
  const run = assertAgentRun(input.run);
  const identity = Object.freeze({
    runId: run.runId,
    ordinal: positiveInteger(input.ordinal, "Agent run artifact ordinal", 100_000),
    kind: identifier(input.kind, "Agent run artifact kind"),
    contentHash: hash(input.contentHash, "Agent run artifact content hash"),
    sourceArtifactRef: input.sourceArtifactRef === undefined || input.sourceArtifactRef === null
      ? null
      : boundedText(input.sourceArtifactRef, "Agent run artifact source ref", 500),
  });
  return assertAgentRunArtifact(Object.freeze({
    schemaVersion: "pmh.agent-run-artifact.v1" as const,
    artifactId: hashCanonical(identity),
    ...identity,
    createdAt: canonicalIso(input.createdAt, "Agent run artifact createdAt"),
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  }));
}

export function assertAgentRunAnnotation(value: unknown): AgentRunAnnotation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent run annotation is malformed");
  }
  const record = value as AgentRunAnnotation;
  if (
    !exactKeys(record, [
      "schemaVersion", "annotationId", "runId", "category", "sourceRecordRef",
      "observedFactsHash", "note", "createdAt", "semanticDecisionAuthority",
      "certificateAuthority", "externalWriteAuthority", "valueMovingAuthority",
    ]) || record.schemaVersion !== "pmh.agent-run-annotation.v1" ||
    [record.semanticDecisionAuthority, record.certificateAuthority,
      record.externalWriteAuthority, record.valueMovingAuthority].some((item) => item !== false)
  ) throw new Error("Agent run annotation is invalid");
  const body = Object.freeze({
    schemaVersion: record.schemaVersion,
    runId: hash(record.runId, "Agent run annotation run ID"),
    category: identifier(record.category, "Agent run annotation category"),
    sourceRecordRef: boundedText(
      record.sourceRecordRef,
      "Agent run annotation source record ref",
      500,
    ),
    observedFactsHash: hash(
      record.observedFactsHash,
      "Agent run annotation observed facts hash",
    ),
    note: boundedText(record.note, "Agent run annotation note", 1_000),
    createdAt: canonicalIso(record.createdAt, "Agent run annotation createdAt"),
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  assertHashIdentity(record.annotationId, body, "Agent run annotation identity");
  return record;
}

export function buildAgentRunAnnotation(input: Readonly<{
  run: AgentRun;
  category: string;
  sourceRecordRef: string;
  observedFacts: unknown;
  note: string;
  createdAt: string;
}>): AgentRunAnnotation {
  const run = assertAgentRun(input.run);
  const body = Object.freeze({
    schemaVersion: "pmh.agent-run-annotation.v1" as const,
    runId: run.runId,
    category: identifier(input.category, "Agent run annotation category"),
    sourceRecordRef: boundedText(
      input.sourceRecordRef,
      "Agent run annotation source record ref",
      500,
    ),
    observedFactsHash: hashCanonical(input.observedFacts),
    note: boundedText(input.note, "Agent run annotation note", 1_000),
    createdAt: canonicalIso(input.createdAt, "Agent run annotation createdAt"),
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertAgentRunAnnotation(Object.freeze({
    ...body,
    annotationId: hashCanonical(body),
  }));
}

export function assertResultSelection(value: unknown): ResultSelection {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Result selection is malformed");
  }
  const record = value as ResultSelection;
  if (
    !exactKeys(record, [
      "schemaVersion", "selectionId", "taskId", "runId", "artifactHash", "rationale",
      "selectedAt", "selectionAuthorityRef", "certificateAuthority", "valueMovingAuthority",
    ]) || record.schemaVersion !== "pmh.result-selection.v1" ||
    record.certificateAuthority !== false || record.valueMovingAuthority !== false
  ) throw new Error("Result selection is invalid");
  const body = {
    schemaVersion: record.schemaVersion,
    taskId: hash(record.taskId, "Result selection task ID"),
    runId: hash(record.runId, "Result selection run ID"),
    artifactHash: hash(record.artifactHash, "Result selection artifact hash"),
    rationale: boundedText(record.rationale, "Result selection rationale", 500),
    selectedAt: canonicalIso(record.selectedAt, "Result selection selectedAt"),
    selectionAuthorityRef: identifier(record.selectionAuthorityRef, "Result selection authority ref"),
    certificateAuthority: false as const,
    valueMovingAuthority: false as const,
  };
  assertHashIdentity(record.selectionId, body, "Result selection identity");
  return record;
}

export function buildResultSelection(input: Readonly<{
  task: AgentTask;
  run: AgentRun;
  artifactHash: Hash;
  rationale: string;
  selectedAt: string;
  selectionAuthorityRef: string;
}>): ResultSelection {
  const task = assertAgentTask(input.task);
  const run = assertAgentRun(input.run);
  if (run.taskId !== task.taskId) throw new Error("Result selection run belongs to another task");
  if (run.status !== "SUCCEEDED") throw new Error("Only a successful run can be selected");
  const body = Object.freeze({
    schemaVersion: "pmh.result-selection.v1" as const,
    taskId: task.taskId,
    runId: run.runId,
    artifactHash: hash(input.artifactHash, "Result selection artifact hash"),
    rationale: boundedText(input.rationale, "Result selection rationale", 500),
    selectedAt: canonicalIso(input.selectedAt, "Result selection selectedAt"),
    selectionAuthorityRef: identifier(input.selectionAuthorityRef, "Result selection authority ref"),
    certificateAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertResultSelection(Object.freeze({
    ...body,
    selectionId: hashCanonical(body),
  }));
}

export function emptyAgentExecutionSnapshot(): AgentExecutionSnapshot {
  return Object.freeze({
    runtimeDefinitions: Object.freeze([]),
    credentialBindings: Object.freeze([]),
    modelProfiles: Object.freeze([]),
    executionProfiles: Object.freeze([]),
    workloadRoutes: Object.freeze([]),
    tasks: Object.freeze([]),
    runs: Object.freeze([]),
    modelInvocations: Object.freeze([]),
    toolEffects: Object.freeze([]),
    runArtifacts: Object.freeze([]),
    runAnnotations: Object.freeze([]),
    campaigns: Object.freeze([]),
    resultSelections: Object.freeze([]),
  });
}

export type LegacyAiConfigurationImport = Readonly<{
  runtimeDefinition: AgentRuntimeDefinition;
  credentialBinding: CredentialBinding;
  modelProfile: ModelProfile;
  executionProfile: ExecutionProfile;
  workloadRoute: WorkloadRoute;
  activeCampaignsCreated: 0;
  tasksCreated: 0;
  runsCreated: 0;
  modelInvocationsCreated: 0;
}>;

export function importLegacyAiRuntimeConfiguration(
  configuration: AiRuntimeConfiguration,
): LegacyAiConfigurationImport {
  const runtimeDefinition = buildAgentRuntimeDefinition({
    kind: "HARNESS_IN_PROCESS",
    version: "ai-sdk-loop-v1",
  });
  const codex = configuration.provider === "CODEX";
  const credentialBinding = buildCredentialBinding(codex
    ? {
        kind: "CODEX_OAUTH",
        logicalAccountRef: "codex-oauth:default",
        resolverKind: "CODEX_AUTH_CACHE",
        resolverRef: "codex-auth-cache:default",
      }
    : {
        kind: "DEEPSEEK_API_KEY",
        logicalAccountRef: "deepseek-api-key:default",
        resolverKind: "ENVIRONMENT",
        resolverRef: "env:DEEPSEEK_API_KEY",
      });
  const modelProfile = buildModelProfile(codex
    ? {
        profileKey: "legacy-discovery-model",
        revision: configuration.revision,
        accessDriver: "CODEX_RESPONSES",
        model: configuration.codexModel,
        configuration: Object.freeze({
          schemaVersion: "pmh.codex-model-configuration.v1" as const,
          reasoning: Object.freeze({ effort: configuration.codexReasoningEffort }),
          responseStorage: false as const,
        }),
        createdAt: configuration.updatedAt,
      }
    : {
        profileKey: "legacy-discovery-model",
        revision: configuration.revision,
        accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
        model: "deepseek-v4-flash",
        configuration: Object.freeze({
          schemaVersion: "pmh.deepseek-flash-model-configuration.v1" as const,
          thinking: Object.freeze({ mode: "disabled" as const }),
          responseStorage: false as const,
        }),
        createdAt: configuration.updatedAt,
      });
  const executionProfile = buildExecutionProfile({
    profileKey: "legacy-discovery-execution",
    revision: configuration.revision,
    runtimeDefinition,
    credentialBinding,
    modelProfile,
    toolProtocol: "DISCOVERY_AGENT_TOOLS_V2",
    runBudget: Object.freeze({
      maximumModelInvocations: 8,
      maximumToolCalls: 24,
      maximumWallClockMs: 300_000,
      maximumInputTokens: null,
      maximumOutputTokens: "800",
    }),
    createdAt: configuration.updatedAt,
  });
  const workloadRoute = buildWorkloadRoute({
    routeKey: "legacy-discovery-default",
    revision: configuration.revision,
    taskKind: "DISCOVERY_SCOUT",
    executionProfileId: executionProfile.executionProfileId,
    updatedAt: configuration.updatedAt,
  });
  return Object.freeze({
    runtimeDefinition,
    credentialBinding,
    modelProfile,
    executionProfile,
    workloadRoute,
    activeCampaignsCreated: 0 as const,
    tasksCreated: 0 as const,
    runsCreated: 0 as const,
    modelInvocationsCreated: 0 as const,
  });
}

export class AgentExecutionRegistry {
  #snapshot: AgentExecutionSnapshot;

  public constructor(private readonly store?: AgentExecutionStore) {
    this.#snapshot = store?.loadAgentExecutionSnapshot() ?? emptyAgentExecutionSnapshot();
  }

  public importLegacyConfiguration(
    configuration: AiRuntimeConfiguration,
  ): LegacyAiConfigurationImport {
    const imported = importLegacyAiRuntimeConfiguration(configuration);
    const batch: AgentExecutionBatch = {
      runtimeDefinitions: [imported.runtimeDefinition],
      credentialBindings: [imported.credentialBinding],
      modelProfiles: [imported.modelProfile],
      executionProfiles: [imported.executionProfile],
      workloadRoutes: [imported.workloadRoute],
    };
    this.store?.saveAgentExecutionBatch(batch);
    this.#snapshot = this.store?.loadAgentExecutionSnapshot() ?? mergeSnapshot(this.#snapshot, batch);
    return imported;
  }

  public reconcileRuleEvidenceTasks(
    inputs: readonly Readonly<{
      requirement: EvidenceRequirement;
      capture: EvidenceDocumentCapture;
      priority?: number;
    }>[],
  ): readonly AgentTask[] {
    const tasksById = new Map<Hash, AgentTask>();
    for (const input of inputs) {
      const task = buildRuleEvidenceAgentTask(input);
      const existing = tasksById.get(task.taskId);
      if (existing !== undefined && hashCanonical(existing) !== hashCanonical(task)) {
        throw new Error("Rule Evidence inputs bind one task identity to divergent metadata");
      }
      tasksById.set(task.taskId, task);
    }
    const tasks = Object.freeze([...tasksById.values()].sort((left, right) =>
      left.taskId.localeCompare(right.taskId, "en")
    ));
    const batch: AgentExecutionBatch = { tasks };
    this.store?.saveAgentExecutionBatch(batch);
    this.#snapshot = this.store?.loadAgentExecutionSnapshot() ??
      mergeSnapshot(this.#snapshot, batch);
    return tasks;
  }

  public snapshot(): AgentExecutionSnapshot {
    return this.#snapshot;
  }

  public saveBatch(batch: AgentExecutionBatch): AgentExecutionSnapshot {
    this.store?.saveAgentExecutionBatch(batch);
    this.#snapshot = this.store?.loadAgentExecutionSnapshot() ??
      mergeSnapshot(this.#snapshot, batch);
    return this.#snapshot;
  }

  public projection(): AgentExecutionRegistryProjection {
    return Object.freeze({
      schemaVersion: "pmh.agent-execution-registry.v1",
      runtimeDefinitionCount: this.#snapshot.runtimeDefinitions.length,
      credentialBindingCount: this.#snapshot.credentialBindings.length,
      modelProfileCount: this.#snapshot.modelProfiles.length,
      executionProfileCount: this.#snapshot.executionProfiles.length,
      workloadRouteCount: this.#snapshot.workloadRoutes.length,
      taskCount: this.#snapshot.tasks.length,
      runCount: this.#snapshot.runs.length,
      modelInvocationCount: this.#snapshot.modelInvocations.length,
      runArtifactCount: this.#snapshot.runArtifacts.length,
      runAnnotationCount: this.#snapshot.runAnnotations.length,
      activeCampaignCount: this.#snapshot.campaigns.filter((item) => item.status === "ACTIVE").length,
      automaticDispatchFromConfiguration: false,
      credentialSecretTextRetained: false,
      storage: this.store?.agentExecutionStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "recordId" as const,
      }),
    });
  }
}

function mergeById<T>(
  current: readonly T[],
  incoming: readonly T[] | undefined,
  identity: (record: T) => string,
): readonly T[] {
  const records = new Map(current.map((record) => [identity(record), record] as const));
  for (const record of incoming ?? []) {
    const key = identity(record);
    const existing = records.get(key);
    if (existing !== undefined && hashCanonical(existing) !== hashCanonical(record)) {
      throw new Error("Agent execution identity is already bound to another record");
    }
    records.set(key, record);
  }
  return Object.freeze([...records.values()].sort((left, right) =>
    identity(left).localeCompare(identity(right), "en")
  ));
}

function mergeSnapshot(
  current: AgentExecutionSnapshot,
  batch: AgentExecutionBatch,
): AgentExecutionSnapshot {
  return Object.freeze({
    runtimeDefinitions: mergeById(current.runtimeDefinitions, batch.runtimeDefinitions,
      (record) => record.runtimeDefinitionId),
    credentialBindings: mergeById(current.credentialBindings, batch.credentialBindings,
      (record) => record.credentialBindingId),
    modelProfiles: mergeById(current.modelProfiles, batch.modelProfiles,
      (record) => record.modelProfileId),
    executionProfiles: mergeById(current.executionProfiles, batch.executionProfiles,
      (record) => record.executionProfileId),
    workloadRoutes: mergeById(current.workloadRoutes, batch.workloadRoutes,
      (record) => record.workloadRouteId),
    tasks: mergeById(current.tasks, batch.tasks, (record) => record.taskId),
    runs: mergeById(current.runs, batch.runs, (record) => record.runId),
    modelInvocations: mergeById(current.modelInvocations, batch.modelInvocations,
      (record) => record.invocationId),
    toolEffects: mergeById(current.toolEffects, batch.toolEffects, (record) => record.effectId),
    runArtifacts: mergeById(current.runArtifacts, batch.runArtifacts,
      (record) => record.artifactId),
    runAnnotations: mergeById(current.runAnnotations, batch.runAnnotations,
      (record) => record.annotationId),
    campaigns: mergeById(current.campaigns, batch.campaigns, (record) => record.campaignId),
    resultSelections: mergeById(current.resultSelections, batch.resultSelections,
      (record) => record.selectionId),
  });
}
