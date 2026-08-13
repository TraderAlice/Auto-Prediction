import { hashCanonical, type Hash } from "@pmh/domain";
import { accessSync, constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertAgentRun,
  assertAgentRuntimeDefinition,
  assertAgentTask,
  assertCredentialBinding,
  assertExecutionProfile,
  assertExecutionProfileCompatibility,
  assertModelProfile,
  buildAgentToolEffect,
  buildAgentRunArtifact,
  buildModelInvocation,
  completeAgentRun,
  buildExecutionCapabilityObservation,
  type AgentExecutionRegistry,
  type AgentRun,
  type AgentRunArtifact,
  type AgentRuntimeDefinition,
  type AgentRuntimeKind,
  type AgentTask,
  type AgentToolEffect,
  type CredentialBinding,
  type ExecutionProfile,
  type ExecutionCapabilityObservation,
  type ModelInvocation,
  type ModelProfile,
} from "./agent-execution-substrate.js";
import type {
  CodexOAuthCredential,
  CodexOAuthCredentialProvider,
} from "./codex-oauth.js";
import { probeCodexAppServerAccount } from "./codex-app-server-transport.js";

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/u;
const MAX_TOOL_CALLS_PER_TURN = 64;

function installedRuntime(kind: AgentRuntimeKind): boolean {
  if (kind === "HARNESS_IN_PROCESS") return true;
  if (kind === "PI") {
    try {
      accessSync(
        resolve(import.meta.dirname, "../node_modules/.bin/pi"),
        fsConstants.X_OK,
      );
      return true;
    } catch {
      return false;
    }
  }
  const result = spawnSync("codex", ["--version"], {
    timeout: 2_000,
    stdio: "ignore",
  });
  return result.status === 0;
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be text`);
  const compact = value.trim();
  if (!IDENTIFIER_PATTERN.test(compact)) throw new Error(`${name} is invalid`);
  return compact;
}

function boundedText(value: unknown, name: string, maximum = 500): string {
  if (typeof value !== "string") throw new Error(`${name} must be text`);
  const compact = value.trim().replace(/\s+/gu, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${name} must be non-empty and bounded`);
  }
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

function tokenCount(value: string | null, name: string): bigint | null {
  if (value === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`${name} must be a non-negative integer string or null`);
  }
  return BigInt(value);
}

function redactedDiagnostic(value: unknown, fallback: string): string {
  if (!(value instanceof Error)) return fallback;
  const category = value.name.trim().replace(/[^a-zA-Z0-9._:-]+/gu, "_").slice(0, 80);
  return category === "" || category === "Error" ? fallback : `${fallback}:${category}`;
}

function boundedToolDiagnostic(value: unknown): string {
  const source = typeof value === "string" ? value : value instanceof Error
    ? value.message
    : "tool rejected";
  const contentHashes: string[] = [];
  const protectedSource = source.replace(/sha256:[0-9a-f]{64}/gu, (hash) => {
    const index = contentHashes.push(hash) - 1;
    return `[pmh-content-hash-${index}]`;
  });
  const scrubbed = protectedSource.trim()
    .replace(/https?:\/\/\S+/giu, "[url]")
    .replace(/[A-Za-z0-9_+/=-]{48,}/gu, "[opaque]")
    .replace(/\s+/gu, " ");
  const message = contentHashes.reduce((current, hash, index) =>
    current.replaceAll(`[pmh-content-hash-${index}]`, hash), scrubbed
  ).slice(0, 900);
  return message === "" ? redactedDiagnostic(value, "tool rejected") : message;
}

export type ResolvedAgentCredential = Readonly<
  | {
      kind: "CODEX_OAUTH";
      accessToken: string;
      accountId: string;
      expiresAt: string;
      idToken?: string;
      refreshToken?: string;
    }
  | {
      kind: "DEEPSEEK_API_KEY";
      apiKey: string;
    }
>;

export type CredentialConfiguration = Readonly<{
  credentialBindingId: Hash;
  kind: CredentialBinding["kind"];
  status: "CONFIGURED" | "MISSING";
  diagnostic: string | null;
  secretMaterialRetained: false;
}>;

export interface AgentCredentialResolver {
  readonly resolverKind: CredentialBinding["resolverKind"];
  resolve(binding: CredentialBinding): Promise<ResolvedAgentCredential>;
}

export class EnvironmentCredentialResolver implements AgentCredentialResolver {
  public readonly resolverKind = "ENVIRONMENT" as const;

  public constructor(
    private readonly environment: Readonly<Record<string, string | undefined>> = process.env,
  ) {}

  public async resolve(bindingInput: CredentialBinding): Promise<ResolvedAgentCredential> {
    const binding = assertCredentialBinding(bindingInput);
    if (binding.resolverKind !== this.resolverKind || binding.kind !== "DEEPSEEK_API_KEY") {
      throw new Error("environment resolver cannot resolve this credential binding");
    }
    const match = /^env:([A-Z][A-Z0-9_]*)$/u.exec(binding.resolverRef);
    if (match === null) throw new Error("environment credential resolver ref is invalid");
    const apiKey = this.environment[match[1]!]?.trim() ?? "";
    if (apiKey === "") throw new Error("environment credential is unavailable");
    return Object.freeze({ kind: "DEEPSEEK_API_KEY" as const, apiKey });
  }
}

export class CodexOAuthCredentialResolver implements AgentCredentialResolver {
  public readonly resolverKind = "CODEX_AUTH_CACHE" as const;

  public constructor(private readonly provider: CodexOAuthCredentialProvider) {}

  public async resolve(bindingInput: CredentialBinding): Promise<ResolvedAgentCredential> {
    const binding = assertCredentialBinding(bindingInput);
    if (binding.resolverKind !== this.resolverKind || binding.kind !== "CODEX_OAUTH") {
      throw new Error("Codex OAuth resolver cannot resolve this credential binding");
    }
    const credential: CodexOAuthCredential = await this.provider.resolve();
    return Object.freeze({
      kind: "CODEX_OAUTH" as const,
      accessToken: credential.accessToken,
      accountId: credential.accountId,
      expiresAt: credential.expiresAt,
      ...(credential.idToken === undefined ? {} : { idToken: credential.idToken }),
      ...(credential.refreshToken === undefined
        ? {}
        : { refreshToken: credential.refreshToken }),
    });
  }
}

export class AgentCredentialBroker {
  readonly #resolvers: ReadonlyMap<CredentialBinding["resolverKind"], AgentCredentialResolver>;

  public constructor(resolvers: readonly AgentCredentialResolver[]) {
    const byKind = new Map<CredentialBinding["resolverKind"], AgentCredentialResolver>();
    for (const resolver of resolvers) {
      if (byKind.has(resolver.resolverKind)) {
        throw new Error("Agent credential resolver kind is registered more than once");
      }
      byKind.set(resolver.resolverKind, resolver);
    }
    this.#resolvers = byKind;
  }

  public async configuration(
    bindingInput: CredentialBinding,
  ): Promise<CredentialConfiguration> {
    const binding = assertCredentialBinding(bindingInput);
    try {
      await this.resolve(binding);
      return Object.freeze({
        credentialBindingId: binding.credentialBindingId,
        kind: binding.kind,
        status: "CONFIGURED" as const,
        diagnostic: null,
        secretMaterialRetained: false as const,
      });
    } catch (error) {
      return Object.freeze({
        credentialBindingId: binding.credentialBindingId,
        kind: binding.kind,
        status: "MISSING" as const,
        diagnostic: redactedDiagnostic(error, "credential unavailable"),
        secretMaterialRetained: false as const,
      });
    }
  }

  public async resolve(bindingInput: CredentialBinding): Promise<ResolvedAgentCredential> {
    const binding = assertCredentialBinding(bindingInput);
    const resolver = this.#resolvers.get(binding.resolverKind);
    if (resolver === undefined) throw new Error("credential resolver is not registered");
    const resolved = await resolver.resolve(binding);
    if (resolved.kind !== binding.kind) {
      throw new Error("credential resolver returned the wrong credential kind");
    }
    if (
      (resolved.kind === "DEEPSEEK_API_KEY" && resolved.apiKey.trim() === "") ||
      (resolved.kind === "CODEX_OAUTH" && (
        resolved.accessToken.trim() === "" || resolved.accountId.trim() === "" ||
        !Number.isFinite(Date.parse(resolved.expiresAt))
      ))
    ) throw new Error("credential resolver returned malformed secret material");
    return resolved;
  }
}

export type ExecutionCapabilityProjection = Readonly<{
  executionProfileId: Hash;
  configurationStatus: CredentialConfiguration["status"];
  runtimeStatus: "AVAILABLE" | "UNAVAILABLE";
  serviceCapability: "USABLE" | "REJECTED" | "TRANSIENT_FAILURE" | "UNVERIFIED" | "STALE";
  dispatchEligibility: "ELIGIBLE" | "BLOCKED";
  diagnostic: string;
  observation: ExecutionCapabilityObservation | null;
  inferenceRequestsStarted: 0;
  modelInvocationsStarted: 0;
  secretMaterialRetained: false;
}>;

type CapabilityFetch = (
  input: string,
  init: Readonly<Record<string, unknown>>,
) => Promise<Readonly<{ status: number; ok: boolean }>>;

export class AgentExecutionCapabilityService {
  readonly #runtimeAvailability: ReadonlyMap<Hash, boolean>;

  public constructor(
    private readonly registry: AgentExecutionRegistry,
    private readonly credentialBroker: AgentCredentialBroker,
    private readonly fetcher: CapabilityFetch = fetch as CapabilityFetch,
    private readonly now: () => number = Date.now,
    private readonly validityMs = 15 * 60_000,
    runtimeAvailable: (kind: AgentRuntimeKind) => boolean = installedRuntime,
  ) {
    this.#runtimeAvailability = new Map(
      registry.snapshot().runtimeDefinitions.map((runtime) => [
        runtime.runtimeDefinitionId,
        runtimeAvailable(runtime.kind),
      ] as const),
    );
  }

  public latestObservation(
    executionProfileId: Hash,
  ): ExecutionCapabilityObservation | null {
    return [...this.registry.snapshot().capabilityObservations]
      .filter((item) => item.executionProfileId === executionProfileId)
      .sort((left, right) =>
        right.observedAt.localeCompare(left.observedAt) ||
        right.observationId.localeCompare(left.observationId)
      )[0] ?? null;
  }

  public project(
    profileInput: ExecutionProfile,
    configuration: CredentialConfiguration,
  ): ExecutionCapabilityProjection {
    const profile = assertExecutionProfile(profileInput);
    const snapshot = this.registry.snapshot();
    const binding = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (binding === undefined) throw new Error("Execution profile credential is unavailable");
    const runtimeAvailable = this.#runtimeAvailability.get(profile.runtimeDefinitionId) === true;
    const observation = this.latestObservation(profile.executionProfileId);
    const stale = observation !== null && Date.parse(observation.validUntil) <= this.now();
    const serviceCapability = stale
      ? "STALE" as const
      : observation === null || observation.outcome === "UNSUPPORTED_PROBE" ||
          observation.outcome === "CONFIGURATION_MISSING"
        ? "UNVERIFIED" as const
        : observation.outcome === "USABLE"
          ? "USABLE" as const
          : observation.outcome === "AUTH_REJECTED"
            ? "REJECTED" as const
            : "TRANSIENT_FAILURE" as const;
    const freshObservation = observation !== null && !stale;
    const serviceEligible = freshObservation && (
      observation.outcome === "USABLE" ||
      (binding.kind !== "CODEX_OAUTH" && observation.outcome === "UNSUPPORTED_PROBE")
    );
    const dispatchEligibility = !runtimeAvailable || configuration.status === "MISSING" ||
        !serviceEligible
      ? "BLOCKED" as const
      : "ELIGIBLE" as const;
    return Object.freeze({
      executionProfileId: profile.executionProfileId,
      configurationStatus: configuration.status,
      runtimeStatus: runtimeAvailable ? "AVAILABLE" as const : "UNAVAILABLE" as const,
      serviceCapability,
      dispatchEligibility,
      diagnostic: !runtimeAvailable
        ? "Agent runtime is not installed"
        : configuration.status === "MISSING"
        ? configuration.diagnostic ?? "credential configuration is missing"
        : observation?.diagnostic ?? "run a capability preflight before dispatch",
      observation,
      inferenceRequestsStarted: 0 as const,
      modelInvocationsStarted: 0 as const,
      secretMaterialRetained: false as const,
    });
  }

  public async preflight(profileInput: ExecutionProfile): Promise<ExecutionCapabilityProjection> {
    const profile = assertExecutionProfile(profileInput);
    const snapshot = this.registry.snapshot();
    const binding = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    const runtime = snapshot.runtimeDefinitions.find((item) =>
      item.runtimeDefinitionId === profile.runtimeDefinitionId
    );
    const model = snapshot.modelProfiles.find((item) =>
      item.modelProfileId === profile.modelProfileId
    );
    if (binding === undefined || runtime === undefined || model === undefined) {
      throw new Error("Execution profile substrate is incomplete");
    }
    const configuration = await this.credentialBroker.configuration(binding);
    const observedAt = new Date(this.now()).toISOString();
    const validUntil = new Date(this.now() + this.validityMs).toISOString();
    let outcome: ExecutionCapabilityObservation["outcome"];
    let probeKind: ExecutionCapabilityObservation["probeKind"];
    let diagnostic: string;
    if (this.#runtimeAvailability.get(runtime.runtimeDefinitionId) !== true) {
      outcome = "UNSUPPORTED_PROBE";
      probeKind = "CONFIGURATION_ONLY";
      diagnostic = `${runtime.kind} runtime is not installed`;
    } else if (configuration.status === "MISSING") {
      outcome = "CONFIGURATION_MISSING";
      probeKind = "CONFIGURATION_ONLY";
      diagnostic = configuration.diagnostic ?? "credential configuration is missing";
    } else if (binding.kind !== "CODEX_OAUTH") {
      outcome = "UNSUPPORTED_PROBE";
      probeKind = "CONFIGURATION_ONLY";
      diagnostic = "credential is configured; no zero-inference service probe is defined";
    } else if (runtime.kind === "CODEX" &&
        runtime.version.startsWith("codex-app-server-v2")) {
      probeKind = "CODEX_APP_SERVER_ACCOUNT";
      try {
        const probe = await probeCodexAppServerAccount({
          cwd: resolve(import.meta.dirname, "../../.."),
          environment: process.env,
          timeoutMs: 10_000,
        });
        outcome = probe.usable ? "USABLE" : "AUTH_REJECTED";
        diagnostic = probe.diagnostic;
      } catch (error) {
        outcome = "TRANSIENT_FAILURE";
        diagnostic = redactedDiagnostic(error, "Codex app-server account probe failed");
      }
    } else {
      probeKind = "CODEX_USAGE";
      const credential = await this.credentialBroker.resolve(binding);
      if (credential.kind !== "CODEX_OAUTH") {
        throw new Error("Codex capability probe resolved the wrong credential kind");
      }
      const originator = runtime.kind === "PI"
        ? "pi"
        : runtime.kind === "CODEX"
          ? "codex_cli_rs"
          : "prediction-market-harness";
      const userAgent = runtime.kind === "PI" ? "pi" : originator;
      try {
        const response = await this.fetcher("https://chatgpt.com/backend-api/codex/usage", {
          method: "GET",
          headers: Object.freeze({
            authorization: `Bearer ${credential.accessToken}`,
            "chatgpt-account-id": credential.accountId,
            originator,
            "user-agent": userAgent,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) {
          outcome = "USABLE";
          diagnostic = `${runtime.kind}/${model.accessDriver} accepted the non-inference probe`;
        } else if ([401, 403, 451].includes(response.status)) {
          outcome = "AUTH_REJECTED";
          diagnostic = `${runtime.kind}/${model.accessDriver} rejected the non-inference probe (HTTP ${response.status})`;
        } else {
          outcome = "TRANSIENT_FAILURE";
          diagnostic = `${runtime.kind}/${model.accessDriver} probe returned HTTP ${response.status}`;
        }
      } catch (error) {
        outcome = "TRANSIENT_FAILURE";
        diagnostic = redactedDiagnostic(error, `${runtime.kind}/${model.accessDriver} probe failed`);
      }
    }
    const observation = buildExecutionCapabilityObservation({
      executionProfile: profile,
      outcome,
      probeKind,
      observedAt,
      validUntil,
      diagnostic,
    });
    this.registry.saveBatch({ capabilityObservations: [observation] });
    return this.project(profile, configuration);
  }

  public async assertDispatchEligible(profileInput: ExecutionProfile): Promise<void> {
    const profile = assertExecutionProfile(profileInput);
    const binding = this.registry.snapshot().credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (binding === undefined) throw new Error("Execution profile credential is unavailable");
    if (this.#runtimeAvailability.get(profile.runtimeDefinitionId) !== true) {
      throw new Error("Execution profile is blocked: Agent runtime is not installed");
    }
    const configuration = await this.credentialBroker.configuration(binding);
    const projection = this.project(profile, configuration);
    if (projection.dispatchEligibility !== "ELIGIBLE") {
      throw new Error(`Execution profile is blocked: ${projection.diagnostic}`);
    }
  }

  public assertServiceDispatchEligible(profileInput: ExecutionProfile): void {
    const profile = assertExecutionProfile(profileInput);
    const binding = this.registry.snapshot().credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    );
    if (binding === undefined) throw new Error("Execution profile credential is unavailable");
    if (this.#runtimeAvailability.get(profile.runtimeDefinitionId) !== true) {
      throw new Error("Execution profile is blocked: Agent runtime is not installed");
    }
    const observation = this.latestObservation(profile.executionProfileId);
    if (observation === null) {
      throw new Error("Execution profile is blocked: run a capability preflight first");
    }
    if (Date.parse(observation.validUntil) <= this.now()) {
      throw new Error("Execution profile is blocked: capability preflight is stale");
    }
    const accepted = observation.outcome === "USABLE" ||
      (binding.kind !== "CODEX_OAUTH" && observation.outcome === "UNSUPPORTED_PROBE");
    if (!accepted) {
      throw new Error(`Execution profile is blocked: ${observation.diagnostic}`);
    }
  }
}

export type AgentRuntimeToolCall = Readonly<{
  callId: string;
  toolName: string;
  input: unknown;
}>;

export type AgentRuntimeToolResult = Readonly<{
  callId: string;
  status: "ACCEPTED" | "REJECTED";
  output: unknown;
}>;

export type AgentRuntimeInvocationPurpose =
  | "PRIMARY_REASONING"
  | "TOOL_CONTINUATION"
  | "RESULT_REPAIR";

export type AgentRuntimeResultRejection = Readonly<{
  toolName: string;
  diagnostic: string;
}>;

export type AgentRuntimeTurn = Readonly<{
  invocation: Readonly<{
    status: ModelInvocation["status"];
    startedAt: string;
    completedAt: string;
    inputTokens: string | null;
    outputTokens: string | null;
    reasoningTokens: string | null;
    failureCategory: string | null;
    diagnostic?: string | null;
    runtimeRecovery?: Readonly<{
      kind: "TRANSIENT_ERROR_NOTIFICATION";
      notificationCount: number;
      lastDiagnostic: string;
    }> | null;
  }>;
  toolCalls: readonly AgentRuntimeToolCall[];
  completed: boolean;
  completionAuthority?: "RESULT_TOOL" | "DIAGNOSTIC_ONLY";
  finalArtifact: unknown | null;
}>;

export type AgentRuntimeOpenContext = Readonly<{
  run: AgentRun;
  task: AgentTask;
  taskPayload: unknown;
  runtimeDefinition: AgentRuntimeDefinition;
  executionProfile: ExecutionProfile;
  modelProfile: ModelProfile;
  credential: ResolvedAgentCredential;
  toolManifest: readonly AgentRuntimeToolDefinition[];
}>;

export type AgentRuntimeToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema: unknown;
}>;

export interface AgentRuntimeSession {
  advance(
    toolResults: readonly AgentRuntimeToolResult[],
    budget?: Readonly<{ maximumWaitMs: number }>,
  ): Promise<AgentRuntimeTurn>;
  settleAcceptedResult?(toolResults: readonly AgentRuntimeToolResult[]): Promise<void>;
  prepareCompletionRecovery?(input: Readonly<{
    attemptOrdinal: number;
    resultToolNames: readonly string[];
    recentResultRejections: readonly AgentRuntimeResultRejection[];
  }>): Promise<void>;
  cancel?(): Promise<void>;
}

export interface AgentRuntimeAdapter {
  readonly kind: AgentRuntimeKind;
  open(context: AgentRuntimeOpenContext): Promise<AgentRuntimeSession>;
}

export type AgentRuntimeSessionFactory = (
  context: AgentRuntimeOpenContext,
) => Promise<AgentRuntimeSession>;

abstract class FactoryBackedAgentRuntimeAdapter implements AgentRuntimeAdapter {
  public abstract readonly kind: AgentRuntimeKind;

  public constructor(private readonly factory: AgentRuntimeSessionFactory) {}

  public open(context: AgentRuntimeOpenContext): Promise<AgentRuntimeSession> {
    return this.factory(context);
  }
}

export class PiAgentRuntimeAdapter extends FactoryBackedAgentRuntimeAdapter {
  public readonly kind = "PI" as const;
}

export class CodexAgentRuntimeAdapter extends FactoryBackedAgentRuntimeAdapter {
  public readonly kind = "CODEX" as const;
}

export class InProcessAgentRuntimeAdapter extends FactoryBackedAgentRuntimeAdapter {
  public readonly kind = "HARNESS_IN_PROCESS" as const;
}

export type AgentToolHostContext = Readonly<{
  run: AgentRun;
  task: AgentTask;
  executionProfile: ExecutionProfile;
  callId: string;
  toolName: string;
  input: unknown;
}>;

export interface AgentToolHost {
  manifest(toolProtocol: string): readonly AgentRuntimeToolDefinition[];
  resultToolNames?(toolProtocol: string): readonly string[];
  execute(context: AgentToolHostContext): Promise<Readonly<{
    status: "ACCEPTED" | "REJECTED";
    output: unknown;
  }>>;
  observeEffect?(input: Readonly<{
    context: AgentToolHostContext;
    result: Readonly<{ status: "ACCEPTED" | "REJECTED"; output: unknown }>;
    effect: AgentToolEffect;
  }>): Promise<void> | void;
}

export type AgentRuntimeExecutionResult = Readonly<{
  run: AgentRun;
  modelInvocations: readonly ModelInvocation[];
  toolEffects: readonly AgentToolEffect[];
  runArtifacts: readonly AgentRunArtifact[];
  finalArtifactHash: Hash | null;
  runtimeKind: AgentRuntimeKind;
  credentialBindingId: Hash;
  secretMaterialRetained: false;
}>;

export type ExecutePreparedAgentRunInput = Readonly<{
  run: AgentRun;
  task: AgentTask;
  taskPayload: unknown;
  runtimeDefinition: AgentRuntimeDefinition;
  credentialBinding: CredentialBinding;
  modelProfile: ModelProfile;
  executionProfile: ExecutionProfile;
  adapter: AgentRuntimeAdapter;
  credentialBroker: AgentCredentialBroker;
  toolHost: AgentToolHost;
  now?: () => number;
  beforeModelInvocation?: (state: Readonly<{
    run: AgentRun;
    completedInvocationCount: number;
    inputTokens: string;
    outputTokens: string;
    elapsedMs: number;
  }>) => Promise<void> | void;
  onProgress?: (batch: Readonly<{
    modelInvocations?: readonly ModelInvocation[];
    toolEffects?: readonly AgentToolEffect[];
  }>) => Promise<void> | void;
}>;

function validateExecutionInput(input: ExecutePreparedAgentRunInput): Readonly<{
  run: AgentRun;
  task: AgentTask;
  runtime: AgentRuntimeDefinition;
  credential: CredentialBinding;
  model: ModelProfile;
  profile: ExecutionProfile;
}> {
  const run = assertAgentRun(input.run);
  const task = assertAgentTask(input.task);
  const runtime = assertAgentRuntimeDefinition(input.runtimeDefinition);
  const credential = assertCredentialBinding(input.credentialBinding);
  const model = assertModelProfile(input.modelProfile);
  const profile = assertExecutionProfile(input.executionProfile);
  assertExecutionProfileCompatibility(runtime, credential, model);
  if (run.status !== "PREPARED") throw new Error("Agent runtime requires a prepared run");
  if (run.taskId !== task.taskId || run.executionProfileId !== profile.executionProfileId) {
    throw new Error("Agent runtime run lineage is inconsistent");
  }
  if (
    profile.runtimeDefinitionId !== runtime.runtimeDefinitionId ||
    profile.credentialBindingId !== credential.credentialBindingId ||
    profile.modelProfileId !== model.modelProfileId
  ) throw new Error("Agent runtime execution profile lineage is inconsistent");
  if (input.adapter.kind !== runtime.kind) {
    throw new Error("Agent runtime adapter kind does not match the execution profile");
  }
  if (hashCanonical(input.taskPayload) !== task.taskPayloadHash) {
    throw new Error("Agent runtime task payload does not match its retained hash");
  }
  return Object.freeze({ run, task, runtime, credential, model, profile });
}

export async function executePreparedAgentRun(
  input: ExecutePreparedAgentRunInput,
): Promise<AgentRuntimeExecutionResult> {
  const valid = validateExecutionInput(input);
  const now = input.now ?? Date.now;
  const startedAt = now();
  const deadlineAtMs = startedAt + valid.profile.runBudget.maximumWallClockMs;
  const invocations: ModelInvocation[] = [];
  const effects: AgentToolEffect[] = [];
  const artifacts: AgentRunArtifact[] = [];
  let totalInputTokens = 0n;
  let totalOutputTokens = 0n;
  let lastInvocationCompletedAt = valid.run.createdAt;
  let session: AgentRuntimeSession | undefined;
  let toolResults: readonly AgentRuntimeToolResult[] = Object.freeze([]);
  const seenToolCallIds = new Set<string>();
  let completionRecoveryAttemptCount = 0;
  let activeRepairAttemptOrdinal: number | null = null;
  let nextInvocationPurpose: AgentRuntimeInvocationPurpose = "PRIMARY_REASONING";
  let nextInvocationRepairContext: Readonly<{
    attemptOrdinal: number;
    rejectedResultEffectIds: readonly Hash[];
  }> | null = null;

  const finish = (
    status: Exclude<AgentRun["status"], "PREPARED">,
    diagnostic: string | null,
    finalArtifactHash: Hash | null,
  ): AgentRuntimeExecutionResult => Object.freeze({
    run: completeAgentRun(
      valid.run,
      status,
      new Date(Math.max(startedAt, now())).toISOString(),
      diagnostic,
    ),
    modelInvocations: Object.freeze(invocations),
    toolEffects: Object.freeze(effects),
    runArtifacts: Object.freeze(artifacts),
    finalArtifactHash,
    runtimeKind: valid.runtime.kind,
    credentialBindingId: valid.credential.credentialBindingId,
    secretMaterialRetained: false as const,
  });

  try {
    const credential = await input.credentialBroker.resolve(valid.credential);
    const toolManifest = Object.freeze(input.toolHost
      .manifest(valid.profile.toolPolicy.protocol)
      .map((definition) => Object.freeze({
        name: identifier(definition.name, "Agent tool manifest name"),
        description: boundedText(
          definition.description,
          "Agent tool manifest description",
        ),
        inputSchema: definition.inputSchema,
      })));
    const explicitResultToolPolicy = input.toolHost.resultToolNames !== undefined;
    const resultToolNames = Object.freeze((input.toolHost.resultToolNames?.(
      valid.profile.toolPolicy.protocol,
    ) ?? toolManifest.map((tool) => tool.name))
      .map((name) => identifier(name, "Agent result tool name")));
    if (new Set(toolManifest.map((definition) => definition.name)).size !== toolManifest.length) {
      throw new Error("Agent tool manifest repeats a tool name");
    }
    if (
      new Set(resultToolNames).size !== resultToolNames.length ||
      resultToolNames.some((name) => !toolManifest.some((tool) => tool.name === name))
    ) throw new Error("Agent result tool policy is missing or outside the manifest");
    session = await input.adapter.open(Object.freeze({
      run: valid.run,
      task: valid.task,
      taskPayload: input.taskPayload,
      runtimeDefinition: valid.runtime,
      executionProfile: valid.profile,
      modelProfile: valid.model,
      credential,
      toolManifest,
    }));

    while (true) {
      if (now() - startedAt >= valid.profile.runBudget.maximumWallClockMs) {
        await session.cancel?.();
        return finish("INTERRUPTED", "run wall-clock budget exhausted", null);
      }
      if (invocations.length >= valid.profile.runBudget.maximumModelInvocations) {
        await session.cancel?.();
        return finish("INTERRUPTED", "model invocation budget exhausted", null);
      }
      const maximumInput = tokenCount(
        valid.profile.runBudget.maximumInputTokens,
        "Maximum input tokens",
      );
      const maximumOutput = tokenCount(
        valid.profile.runBudget.maximumOutputTokens,
        "Maximum output tokens",
      );
      if (
        (maximumInput !== null && totalInputTokens >= maximumInput) ||
        (maximumOutput !== null && totalOutputTokens >= maximumOutput)
      ) {
        await session.cancel?.();
        return finish("INTERRUPTED", "token budget exhausted", null);
      }

      await input.beforeModelInvocation?.(Object.freeze({
        run: valid.run,
        completedInvocationCount: invocations.length,
        inputTokens: totalInputTokens.toString(),
        outputTokens: totalOutputTokens.toString(),
        elapsedMs: Math.max(0, now() - startedAt),
      }));

      const invocationPurpose = nextInvocationPurpose;
      const turn = await session.advance(toolResults, Object.freeze({
        maximumWaitMs: Math.max(1, deadlineAtMs - now()),
      }));
      const ordinal = invocations.length + 1;
      const invocationStartedAt = canonicalIso(
        turn.invocation.startedAt,
        "Runtime invocation startedAt",
      );
      const invocationCompletedAt = canonicalIso(
        turn.invocation.completedAt,
        "Runtime invocation completedAt",
      );
      if (
        Date.parse(invocationStartedAt) < Date.parse(lastInvocationCompletedAt) ||
        Date.parse(invocationCompletedAt) > now()
      ) throw new Error("runtime invocation chronology is inconsistent");
      const invocation = buildModelInvocation({
        run: valid.run,
        modelProfile: valid.model,
        ordinal,
        status: turn.invocation.status,
        startedAt: invocationStartedAt,
        completedAt: invocationCompletedAt,
        inputTokens: turn.invocation.inputTokens,
        outputTokens: turn.invocation.outputTokens,
        reasoningTokens: turn.invocation.reasoningTokens,
        failureCategory: turn.invocation.failureCategory,
        diagnostic: turn.invocation.diagnostic ?? null,
        purpose: invocationPurpose,
        repairContext: nextInvocationRepairContext,
        runtimeRecovery: turn.invocation.runtimeRecovery ?? null,
      });
      nextInvocationRepairContext = null;
      invocations.push(invocation);
      await input.onProgress?.(Object.freeze({
        modelInvocations: Object.freeze([invocation]),
      }));
      lastInvocationCompletedAt = invocation.completedAt;
      totalInputTokens += tokenCount(invocation.inputTokens, "Invocation input tokens") ?? 0n;
      totalOutputTokens += tokenCount(invocation.outputTokens, "Invocation output tokens") ?? 0n;

      const maximumInputAfter = tokenCount(
        valid.profile.runBudget.maximumInputTokens,
        "Maximum input tokens",
      );
      const maximumOutputAfter = tokenCount(
        valid.profile.runBudget.maximumOutputTokens,
        "Maximum output tokens",
      );
      if (
        (maximumInputAfter !== null && totalInputTokens > maximumInputAfter) ||
        (maximumOutputAfter !== null && totalOutputTokens > maximumOutputAfter)
      ) {
        await session.cancel?.();
        return finish("INTERRUPTED", "token budget exceeded by model invocation", null);
      }

      if (turn.invocation.status !== "SUCCEEDED") {
        await session.cancel?.();
        return finish(
          turn.invocation.status === "CANCELLED" ? "CANCELLED" :
            turn.invocation.status === "TIMED_OUT" ? "INTERRUPTED" : "FAILED",
          `model invocation ${turn.invocation.status.toLowerCase()}`,
          null,
        );
      }
      if (turn.toolCalls.length > MAX_TOOL_CALLS_PER_TURN) {
        await session.cancel?.();
        return finish("FAILED", "runtime emitted an unbounded tool batch", null);
      }
      if (turn.completed && turn.toolCalls.length > 0) {
        await session.cancel?.();
        return finish("FAILED", "runtime completed while tool calls were unresolved", null);
      }
      if (turn.completed) {
        if (turn.finalArtifact === null) {
          await session.cancel?.();
          return finish("FAILED", "runtime completed without a final artifact", null);
        }
        const acceptedResultEffect = effects.some((effect) =>
          effect.status === "ACCEPTED" && resultToolNames.includes(effect.toolName)
        );
        if (
          !valid.profile.toolPolicy.freeTextResultAuthority &&
          (turn.completionAuthority ?? "RESULT_TOOL") !== "RESULT_TOOL" &&
          !acceptedResultEffect
        ) {
          if (session.prepareCompletionRecovery !== undefined) {
            const maximumInputForRecovery = tokenCount(
              valid.profile.runBudget.maximumInputTokens,
              "Maximum input tokens",
            );
            const maximumOutputForRecovery = tokenCount(
              valid.profile.runBudget.maximumOutputTokens,
              "Maximum output tokens",
            );
            const recoveryBudgetDiagnostic = now() - startedAt >=
                valid.profile.runBudget.maximumWallClockMs
              ? "run wall-clock budget exhausted"
              : invocations.length >= valid.profile.runBudget.maximumModelInvocations
                ? "model invocation budget exhausted"
                : (maximumInputForRecovery !== null &&
                    totalInputTokens >= maximumInputForRecovery) ||
                    (maximumOutputForRecovery !== null &&
                      totalOutputTokens >= maximumOutputForRecovery)
                  ? "token budget exhausted"
                  : effects.length >= valid.profile.runBudget.maximumToolCalls
                    ? "tool-call budget exhausted"
                    : null;
            if (recoveryBudgetDiagnostic !== null) {
              await session.cancel?.();
              return finish("INTERRUPTED", recoveryBudgetDiagnostic, null);
            }
            completionRecoveryAttemptCount += 1;
            activeRepairAttemptOrdinal = completionRecoveryAttemptCount;
            const recentResultRejections = Object.freeze(effects.filter((effect) =>
              effect.status === "REJECTED" && resultToolNames.includes(effect.toolName)
            ).slice(-4).map((effect) => Object.freeze({
              toolName: effect.toolName,
              diagnostic: effect.schemaVersion === "pmh.agent-tool-effect.v2" ||
                  effect.schemaVersion === "pmh.agent-tool-effect.v3"
                ? effect.diagnostic ?? "first-party result validation rejected the call"
                : "first-party result validation rejected the call",
            })));
            await session.prepareCompletionRecovery(Object.freeze({
              attemptOrdinal: completionRecoveryAttemptCount,
              resultToolNames,
              recentResultRejections,
            }));
            toolResults = Object.freeze([]);
            nextInvocationPurpose = "RESULT_REPAIR";
            nextInvocationRepairContext = Object.freeze({
              attemptOrdinal: activeRepairAttemptOrdinal,
              rejectedResultEffectIds: Object.freeze(effects.filter((effect) =>
                effect.status === "REJECTED" && resultToolNames.includes(effect.toolName)
              ).slice(-4).map((effect) => effect.effectId)),
            });
            continue;
          }
          await session.cancel?.();
          return finish("FAILED", "runtime completed without an accepted result effect", null);
        }
        const finalArtifactHash = hashCanonical(turn.finalArtifact);
        artifacts.push(buildAgentRunArtifact({
          run: valid.run,
          ordinal: artifacts.length + 1,
          kind: "RUNTIME_FINAL",
          contentHash: finalArtifactHash,
          sourceArtifactRef: null,
          createdAt: turn.invocation.completedAt,
        }));
        await session.cancel?.();
        return finish("SUCCEEDED", null, finalArtifactHash);
      }
      if (turn.finalArtifact !== null || turn.toolCalls.length === 0) {
        await session.cancel?.();
        return finish("FAILED", "runtime turn did not request tools or complete", null);
      }
      if (effects.length + turn.toolCalls.length > valid.profile.runBudget.maximumToolCalls) {
        await session.cancel?.();
        return finish("INTERRUPTED", "tool-call budget exhausted", null);
      }
      const nextResults: AgentRuntimeToolResult[] = [];
      for (const call of turn.toolCalls) {
        const callId = identifier(call.callId, "Runtime tool call ID");
        if (seenToolCallIds.has(callId)) {
          await session.cancel?.();
          return finish("FAILED", "runtime repeated a tool call identity", null);
        }
        seenToolCallIds.add(callId);
        const toolName = identifier(call.toolName, "Runtime tool name");
        if (!toolManifest.some((definition) => definition.name === toolName)) {
          await session.cancel?.();
          return finish("FAILED", "runtime requested a tool outside its manifest", null);
        }
        let result: Awaited<ReturnType<AgentToolHost["execute"]>>;
        try {
          result = await input.toolHost.execute(Object.freeze({
            run: valid.run,
            task: valid.task,
            executionProfile: valid.profile,
            callId,
            toolName,
            input: call.input,
          }));
        } catch (error) {
          result = Object.freeze({
            status: "REJECTED" as const,
            output: Object.freeze({ diagnostic: boundedToolDiagnostic(error) }),
          });
        }
        const effect = buildAgentToolEffect({
          run: valid.run,
          ordinal: effects.length + 1,
          toolProtocol: valid.profile.toolPolicy.protocol,
          toolName,
          status: result.status,
          canonicalInput: call.input,
          canonicalOutput: result.output,
          sourceInvocation: invocation,
          diagnostic: result.status === "REJECTED" && result.output !== null &&
              typeof result.output === "object" &&
              typeof (result.output as { diagnostic?: unknown }).diagnostic === "string"
            ? boundedToolDiagnostic((result.output as { diagnostic: string }).diagnostic)
            : null,
          occurredAt: turn.invocation.completedAt,
        });
        effects.push(effect);
        await input.onProgress?.(Object.freeze({
          toolEffects: Object.freeze([effect]),
        }));
        await input.toolHost.observeEffect?.(Object.freeze({
          context: Object.freeze({
            run: valid.run,
            task: valid.task,
            executionProfile: valid.profile,
            callId,
            toolName,
            input: call.input,
          }),
          result,
          effect,
        }));
        if (explicitResultToolPolicy && effect.status === "ACCEPTED" &&
            resultToolNames.includes(effect.toolName)) {
          await session.settleAcceptedResult?.(Object.freeze([Object.freeze({
            callId,
            status: result.status,
            output: result.output,
          })]));
          artifacts.push(buildAgentRunArtifact({
            run: valid.run,
            ordinal: artifacts.length + 1,
            kind: "RESULT_TOOL_FINAL",
            contentHash: effect.canonicalOutputHash,
            sourceArtifactRef: `agent-tool-effect:${effect.effectId}`,
            createdAt: effect.occurredAt,
          }));
          await session.cancel?.();
          return finish("SUCCEEDED", null, effect.canonicalOutputHash);
        }
        nextResults.push(Object.freeze({
          callId,
          status: result.status,
          output: result.output,
        }));
      }
      toolResults = Object.freeze(nextResults);
      const rejectedDeclaredResult = effects.slice(-turn.toolCalls.length).some((effect) =>
        effect.status === "REJECTED" && resultToolNames.includes(effect.toolName)
      );
      const acceptedNonResult = effects.slice(-turn.toolCalls.length).some((effect) =>
        effect.status === "ACCEPTED" && !resultToolNames.includes(effect.toolName)
      );
      if (rejectedDeclaredResult) {
        completionRecoveryAttemptCount += 1;
        activeRepairAttemptOrdinal = completionRecoveryAttemptCount;
      } else if (acceptedNonResult) {
        // Repair describes the immediate response to a rejected result, not
        // every later turn in the run. A productive first-party state change
        // closes that episode; a future rejected result opens a new one.
        activeRepairAttemptOrdinal = null;
      }
      nextInvocationPurpose = activeRepairAttemptOrdinal === null
        ? "TOOL_CONTINUATION"
        : "RESULT_REPAIR";
      nextInvocationRepairContext = activeRepairAttemptOrdinal === null
        ? null
        : Object.freeze({
            attemptOrdinal: activeRepairAttemptOrdinal,
            rejectedResultEffectIds: Object.freeze(effects.filter((effect) =>
              effect.status === "REJECTED" && resultToolNames.includes(effect.toolName)
            ).slice(-4).map((effect) => effect.effectId)),
          });
    }
  } catch (error) {
    try {
      await session?.cancel?.();
    } catch {
      // Cancellation is best-effort; terminal state remains explicit below.
    }
    return error instanceof Error && error.name === "AgentCampaignBudgetExhausted"
      ? finish("INTERRUPTED", "campaign budget exhausted", null)
      : finish("FAILED", redactedDiagnostic(error, "runtime adapter failed"), null);
  }
}
