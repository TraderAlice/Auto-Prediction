import { hashCanonical, type Hash } from "@pmh/domain";
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
  type AgentRun,
  type AgentRunArtifact,
  type AgentRuntimeDefinition,
  type AgentRuntimeKind,
  type AgentTask,
  type AgentToolEffect,
  type CredentialBinding,
  type ExecutionProfile,
  type ModelInvocation,
  type ModelProfile,
} from "./agent-execution-substrate.js";
import type {
  CodexOAuthCredential,
  CodexOAuthCredentialProvider,
} from "./codex-oauth.js";

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/u;
const MAX_TOOL_CALLS_PER_TURN = 64;

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

export type CredentialReadiness = Readonly<{
  credentialBindingId: Hash;
  kind: CredentialBinding["kind"];
  status: "READY" | "UNAVAILABLE";
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

  public async readiness(bindingInput: CredentialBinding): Promise<CredentialReadiness> {
    const binding = assertCredentialBinding(bindingInput);
    try {
      await this.resolve(binding);
      return Object.freeze({
        credentialBindingId: binding.credentialBindingId,
        kind: binding.kind,
        status: "READY" as const,
        diagnostic: null,
        secretMaterialRetained: false as const,
      });
    } catch (error) {
      return Object.freeze({
        credentialBindingId: binding.credentialBindingId,
        kind: binding.kind,
        status: "UNAVAILABLE" as const,
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

export type AgentRuntimeTurn = Readonly<{
  invocation: Readonly<{
    status: ModelInvocation["status"];
    startedAt: string;
    completedAt: string;
    inputTokens: string | null;
    outputTokens: string | null;
    reasoningTokens: string | null;
    failureCategory: string | null;
  }>;
  toolCalls: readonly AgentRuntimeToolCall[];
  completed: boolean;
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
  advance(toolResults: readonly AgentRuntimeToolResult[]): Promise<AgentRuntimeTurn>;
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
  execute(context: AgentToolHostContext): Promise<Readonly<{
    status: "ACCEPTED" | "REJECTED";
    output: unknown;
  }>>;
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
  const invocations: ModelInvocation[] = [];
  const effects: AgentToolEffect[] = [];
  const artifacts: AgentRunArtifact[] = [];
  let totalInputTokens = 0n;
  let totalOutputTokens = 0n;
  let lastInvocationCompletedAt = valid.run.createdAt;
  let session: AgentRuntimeSession | undefined;
  let toolResults: readonly AgentRuntimeToolResult[] = Object.freeze([]);
  const seenToolCallIds = new Set<string>();

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
    if (new Set(toolManifest.map((definition) => definition.name)).size !== toolManifest.length) {
      throw new Error("Agent tool manifest repeats a tool name");
    }
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

      const turn = await session.advance(toolResults);
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
      });
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
          return finish("FAILED", "runtime completed without a final artifact", null);
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
            output: Object.freeze({ diagnostic: redactedDiagnostic(error, "tool rejected") }),
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
          occurredAt: turn.invocation.completedAt,
        });
        effects.push(effect);
        await input.onProgress?.(Object.freeze({
          toolEffects: Object.freeze([effect]),
        }));
        nextResults.push(Object.freeze({
          callId,
          status: result.status,
          output: result.output,
        }));
      }
      toolResults = Object.freeze(nextResults);
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
