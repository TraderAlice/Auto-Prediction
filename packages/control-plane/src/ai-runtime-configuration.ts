import type { OperationalStorageProjection } from "./types.js";

export const AI_RUNTIME_PROVIDERS = Object.freeze(["DEEPSEEK", "CODEX"] as const);
export const CODEX_RUNTIME_MODELS = Object.freeze([
  "gpt-5.6-luna",
  "gpt-5.6-terra",
] as const);
export const CODEX_REASONING_EFFORTS = Object.freeze([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const);

export type AiRuntimeProvider = (typeof AI_RUNTIME_PROVIDERS)[number];
export type CodexRuntimeModel = (typeof CODEX_RUNTIME_MODELS)[number];
export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

export type AiRuntimeConfiguration = Readonly<{
  schemaVersion: "pmh.ai-runtime-configuration.v2";
  revision: number;
  provider: AiRuntimeProvider;
  codexModel: CodexRuntimeModel;
  codexReasoningEffort: CodexReasoningEffort;
  deepseekAutomationEnabled: boolean;
  updatedAt: string;
}>;

export type AiRuntimeConfigurationProjection = Readonly<{
  configuration: AiRuntimeConfiguration;
  availableProviders: typeof AI_RUNTIME_PROVIDERS;
  availableCodexModels: typeof CODEX_RUNTIME_MODELS;
  availableCodexReasoningEfforts: typeof CODEX_REASONING_EFFORTS;
  storage: OperationalStorageProjection<"singleton">;
  credentialTextRetained: false;
  executionAuthority: false;
}>;

export interface AiRuntimeConfigurationStore {
  readonly aiRuntimeConfigurationStorage: OperationalStorageProjection<"singleton">;
  loadAiRuntimeConfiguration(): AiRuntimeConfiguration | null;
  saveAiRuntimeConfiguration(configuration: AiRuntimeConfiguration): AiRuntimeConfiguration;
}

function canonicalIso(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("AI runtime configuration updatedAt must be canonical ISO time");
  }
  return value;
}

export function assertAiRuntimeConfiguration(
  value: unknown,
): AiRuntimeConfiguration {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI runtime configuration is invalid");
  }
  const configuration = value as AiRuntimeConfiguration;
  if (
    configuration.schemaVersion !== "pmh.ai-runtime-configuration.v2" ||
    !Number.isSafeInteger(configuration.revision) ||
    configuration.revision < 1 ||
    !AI_RUNTIME_PROVIDERS.includes(configuration.provider) ||
    !CODEX_RUNTIME_MODELS.includes(configuration.codexModel) ||
    !CODEX_REASONING_EFFORTS.includes(configuration.codexReasoningEffort) ||
    typeof configuration.deepseekAutomationEnabled !== "boolean"
  ) {
    throw new Error("AI runtime configuration is invalid");
  }
  canonicalIso(configuration.updatedAt);
  return configuration;
}

export function migrateAiRuntimeConfiguration(
  value: unknown,
): AiRuntimeConfiguration {
  if (
    value !== null && typeof value === "object" && !Array.isArray(value) &&
    (value as { schemaVersion?: unknown }).schemaVersion ===
      "pmh.ai-runtime-configuration.v1"
  ) {
    const legacy = value as Readonly<{
      revision: number;
      provider: AiRuntimeProvider;
      codexModel: CodexRuntimeModel;
      codexReasoningEffort: CodexReasoningEffort;
      updatedAt: string;
    }>;
    if (
      !Number.isSafeInteger(legacy.revision) || legacy.revision < 1 ||
      !AI_RUNTIME_PROVIDERS.includes(legacy.provider) ||
      !CODEX_RUNTIME_MODELS.includes(legacy.codexModel) ||
      !CODEX_REASONING_EFFORTS.includes(legacy.codexReasoningEffort)
    ) throw new Error("AI runtime configuration is invalid");
    canonicalIso(legacy.updatedAt);
    return Object.freeze({
      schemaVersion: "pmh.ai-runtime-configuration.v2" as const,
      revision: legacy.revision,
      provider: legacy.provider,
      codexModel: legacy.codexModel,
      codexReasoningEffort: legacy.codexReasoningEffort,
      deepseekAutomationEnabled: false,
      updatedAt: legacy.updatedAt,
    });
  }
  return assertAiRuntimeConfiguration(value);
}

export function defaultAiRuntimeConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now: () => number = Date.now,
): AiRuntimeConfiguration {
  const rawProvider = environment.PMH_DISCOVERY_PROVIDER?.trim().toLowerCase();
  const provider: AiRuntimeProvider = rawProvider === "deepseek"
    ? "DEEPSEEK"
    : "CODEX";
  const rawModel = environment.PMH_CODEX_MODEL?.trim() ??
    (provider === "CODEX" ? environment.PMH_DISCOVERY_MODEL?.trim() : undefined);
  const codexModel = CODEX_RUNTIME_MODELS.find((item) => item === rawModel) ??
    "gpt-5.6-terra";
  const rawEffort = environment.PMH_CODEX_REASONING_EFFORT?.trim().toLowerCase();
  const codexReasoningEffort = CODEX_REASONING_EFFORTS.find(
    (item) => item === rawEffort,
  ) ?? "high";
  return Object.freeze({
    schemaVersion: "pmh.ai-runtime-configuration.v2",
    revision: 1,
    provider,
    codexModel,
    codexReasoningEffort,
    deepseekAutomationEnabled:
      environment.PMH_DEEPSEEK_AUTOMATION_ENABLED?.trim() === "1",
    updatedAt: new Date(now()).toISOString(),
  });
}

export class AiRuntimeConfigurationConflictError extends Error {}

export class AiRuntimeConfigurationDesk {
  #configuration: AiRuntimeConfiguration;

  public constructor(
    environment: Readonly<Record<string, string | undefined>> = process.env,
    private readonly store?: AiRuntimeConfigurationStore,
    private readonly now: () => number = Date.now,
  ) {
    const stored = store?.loadAiRuntimeConfiguration() ?? null;
    this.#configuration = stored ?? defaultAiRuntimeConfiguration(environment, now);
    assertAiRuntimeConfiguration(this.#configuration);
    if (store !== undefined && stored === null) {
      this.#configuration = store.saveAiRuntimeConfiguration(this.#configuration);
    }
  }

  public current(): AiRuntimeConfiguration {
    return this.#configuration;
  }

  public update(input: Readonly<{
    expectedRevision: number;
    provider: AiRuntimeProvider;
    codexModel: CodexRuntimeModel;
    codexReasoningEffort: CodexReasoningEffort;
    deepseekAutomationEnabled: boolean;
  }>): AiRuntimeConfiguration {
    if (input.expectedRevision !== this.#configuration.revision) {
      throw new AiRuntimeConfigurationConflictError(
        "AI runtime configuration revision is stale",
      );
    }
    if (
      !AI_RUNTIME_PROVIDERS.includes(input.provider) ||
      !CODEX_RUNTIME_MODELS.includes(input.codexModel) ||
      !CODEX_REASONING_EFFORTS.includes(input.codexReasoningEffort) ||
      typeof input.deepseekAutomationEnabled !== "boolean"
    ) {
      throw new Error("AI runtime configuration update is invalid");
    }
    const next = Object.freeze({
      schemaVersion: "pmh.ai-runtime-configuration.v2" as const,
      revision: this.#configuration.revision + 1,
      provider: input.provider,
      codexModel: input.codexModel,
      codexReasoningEffort: input.codexReasoningEffort,
      deepseekAutomationEnabled: input.deepseekAutomationEnabled,
      updatedAt: new Date(this.now()).toISOString(),
    });
    this.#configuration = this.store?.saveAiRuntimeConfiguration(next) ?? next;
    return this.#configuration;
  }

  public projection(): AiRuntimeConfigurationProjection {
    return Object.freeze({
      configuration: this.#configuration,
      availableProviders: AI_RUNTIME_PROVIDERS,
      availableCodexModels: CODEX_RUNTIME_MODELS,
      availableCodexReasoningEfforts: CODEX_REASONING_EFFORTS,
      storage: this.store?.aiRuntimeConfigurationStorage ?? Object.freeze({
        mode: "MEMORY" as const,
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "singleton" as const,
      }),
      credentialTextRetained: false,
      executionAuthority: false,
    });
  }
}
