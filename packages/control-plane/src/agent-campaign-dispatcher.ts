import { type Hash } from "@pmh/domain";
import {
  AgentExecutionRegistry,
  assertAgentCampaign,
  buildAgentRun,
  completeAgentRun,
  effectiveAgentCampaigns,
  type AgentCampaign,
  type AgentExecutionSnapshot,
  type AgentRun,
  type AgentRunAnnotation,
  type AgentTask,
  type CredentialBinding,
  type ExecutionProfile,
  type ModelProfile,
} from "./agent-execution-substrate.js";
import {
  executePreparedAgentRun,
  type AgentCredentialBroker,
  type AgentExecutionCapabilityService,
  type AgentRuntimeAdapter,
  type AgentToolHost,
} from "./agent-runtime-adapter.js";

function canonicalIso(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) throw new Error("dispatcher clock is invalid");
  return new Date(milliseconds).toISOString();
}

function tokens(value: string | null): bigint {
  return value === null ? 0n : BigInt(value);
}

function campaignRuns(snapshot: AgentExecutionSnapshot, campaignId: Hash): readonly AgentRun[] {
  return snapshot.runs.filter((run) => run.authorization.campaignId === campaignId);
}

function totalWallClockMs(runs: readonly AgentRun[], now: number): number {
  return runs.reduce((total, run) => total + Math.max(
    0,
    Date.parse(run.completedAt ?? canonicalIso(now)) - Date.parse(run.createdAt),
  ), 0);
}

export type AgentCampaignDispatchPreview = Readonly<{
  campaignId: Hash;
  status: AgentCampaign["status"];
  configuredTaskCount: number;
  dispatchableTaskCount: number;
  activeRunCount: number;
  maximumImmediateFanout: number;
  consumedModelInvocations: number;
  remainingModelInvocations: number;
  consumedInputTokens: string;
  remainingInputTokens: string | null;
  consumedOutputTokens: string;
  remainingOutputTokens: string | null;
  consumedWallClockMs: number;
  remainingWallClockMs: number;
  providerRequestsStarted: 0;
}>;

export type AgentCampaignDispatchResult = Readonly<{
  campaignId: Hash;
  preparedRuns: readonly AgentRun[];
  completions: readonly Promise<AgentRun>[];
  preview: AgentCampaignDispatchPreview;
}>;

export type ManualAgentDispatchPreview = Readonly<{
  task: AgentTask;
  executionProfile: ExecutionProfile;
  nextRunOrdinal: number;
  maximumModelInvocations: number;
  maximumInputTokens: string | null;
  maximumOutputTokens: string | null;
  maximumWallClockMs: number;
  providerRequestsStarted: 0;
}>;

export type AgentCampaignDispatcherOptions = Readonly<{
  registry: AgentExecutionRegistry;
  credentialBroker: AgentCredentialBroker;
  capabilityService?: AgentExecutionCapabilityService;
  adapters: readonly AgentRuntimeAdapter[];
  toolHost: AgentToolHost | ((
    task: AgentTask,
    taskPayload: unknown,
    run: AgentRun,
  ) => AgentToolHost);
  taskPayload: (task: AgentTask, run: AgentRun) => unknown;
  runAnnotations?: (
    task: AgentTask,
    run: AgentRun,
  ) => readonly AgentRunAnnotation[];
  now?: () => number;
}>;

class AgentCampaignBudgetExhausted extends Error {
  public constructor() {
    super("campaign budget exhausted");
    this.name = "AgentCampaignBudgetExhausted";
  }
}

export class AgentCampaignDispatcher {
  readonly #registry: AgentExecutionRegistry;
  readonly #credentialBroker: AgentCredentialBroker;
  readonly #capabilityService: AgentExecutionCapabilityService | undefined;
  readonly #adapters: ReadonlyMap<string, AgentRuntimeAdapter>;
  readonly #toolHost: (
    task: AgentTask,
    taskPayload: unknown,
    run: AgentRun,
  ) => AgentToolHost;
  readonly #taskPayload: (task: AgentTask, run: AgentRun) => unknown;
  readonly #runAnnotations: (
    task: AgentTask,
    run: AgentRun,
  ) => readonly AgentRunAnnotation[];
  readonly #now: () => number;
  readonly #active = new Map<Hash, Promise<AgentRun>>();
  readonly #reservedInvocations = new Map<Hash, number>();
  readonly #dispatchingCampaigns = new Set<Hash>();

  public constructor(options: AgentCampaignDispatcherOptions) {
    this.#registry = options.registry;
    this.#credentialBroker = options.credentialBroker;
    this.#capabilityService = options.capabilityService;
    this.#toolHost = typeof options.toolHost === "function"
      ? options.toolHost
      : () => options.toolHost as AgentToolHost;
    this.#taskPayload = options.taskPayload;
    this.#runAnnotations = options.runAnnotations ?? (() => Object.freeze([]));
    this.#now = options.now ?? Date.now;
    const adapters = new Map<string, AgentRuntimeAdapter>();
    for (const adapter of options.adapters) {
      if (adapters.has(adapter.kind)) {
        throw new Error("Agent runtime adapter kind is registered more than once");
      }
      adapters.set(adapter.kind, adapter);
    }
    this.#adapters = adapters;
  }

  public recoverPreparedRuns(observedAt = canonicalIso(this.#now())): readonly AgentRun[] {
    const recovered = this.#registry.snapshot().runs
      .filter((run) => run.status === "PREPARED")
      .map((run) => completeAgentRun(
        run,
        "INTERRUPTED",
        observedAt,
        "prepared run recovered after dispatcher restart; no retry authority inferred",
      ));
    if (recovered.length > 0) this.#registry.saveBatch({ runs: recovered });
    return Object.freeze(recovered);
  }

  public preview(campaignId: Hash): AgentCampaignDispatchPreview {
    const snapshot = this.#registry.snapshot();
    const campaign = snapshot.campaigns.find((item) => item.campaignId === campaignId);
    if (campaign === undefined) throw new Error("Agent campaign is unavailable");
    if (!effectiveAgentCampaigns(snapshot.campaigns).some((item) =>
      item.campaignId === campaignId
    )) throw new Error("Agent campaign revision is superseded");
    return this.#preview(assertAgentCampaign(campaign), snapshot);
  }

  public previewManual(taskId: Hash, executionProfileId: Hash): ManualAgentDispatchPreview {
    const snapshot = this.#registry.snapshot();
    const task = snapshot.tasks.find((item) => item.taskId === taskId);
    if (task === undefined) throw new Error("Agent task is unavailable");
    const profile = this.#executionProfile(snapshot, executionProfileId);
    return Object.freeze({
      task,
      executionProfile: profile,
      nextRunOrdinal: snapshot.runs.filter((run) => run.taskId === taskId).length + 1,
      maximumModelInvocations: profile.runBudget.maximumModelInvocations,
      maximumInputTokens: profile.runBudget.maximumInputTokens,
      maximumOutputTokens: profile.runBudget.maximumOutputTokens,
      maximumWallClockMs: profile.runBudget.maximumWallClockMs,
      providerRequestsStarted: 0 as const,
    });
  }

  public dispatchManual(
    taskId: Hash,
    executionProfileId: Hash,
    authorizationRef: string,
  ): Readonly<{ run: AgentRun; completion: Promise<AgentRun> }> {
    const preview = this.previewManual(taskId, executionProfileId);
    this.#capabilityService?.assertServiceDispatchEligible(preview.executionProfile);
    const now = canonicalIso(this.#now());
    const run = buildAgentRun({
      task: preview.task,
      executionProfile: preview.executionProfile,
      runOrdinal: preview.nextRunOrdinal,
      authorization: { kind: "MANUAL", authorizationRef, authorizedAt: now },
      createdAt: now,
    });
    this.#registry.saveBatch({
      runs: [run],
      runAnnotations: this.#runAnnotations(preview.task, run),
    });
    const completion = this.#execute(null, run, preview.task, preview.executionProfile);
    this.#active.set(run.runId, completion);
    void completion.then(
      () => this.#active.delete(run.runId),
      () => this.#active.delete(run.runId),
    );
    return Object.freeze({ run, completion });
  }

  public dispatchCampaign(campaignId: Hash): AgentCampaignDispatchResult {
    if (this.#dispatchingCampaigns.has(campaignId)) {
      throw new Error("Agent campaign dispatch is already being planned");
    }
    this.#dispatchingCampaigns.add(campaignId);
    try {
      const initial = this.#registry.snapshot();
      const campaign = initial.campaigns.find((item) => item.campaignId === campaignId);
      if (campaign === undefined) throw new Error("Agent campaign is unavailable");
      const validCampaign = assertAgentCampaign(campaign);
      if (!effectiveAgentCampaigns(initial.campaigns).some((item) =>
        item.campaignId === validCampaign.campaignId
      )) throw new Error("Agent campaign revision is superseded");
      if (validCampaign.status !== "ACTIVE") {
        throw new Error("Paused Agent campaign cannot dispatch work");
      }
      const preview = this.#preview(validCampaign, initial);
      if (preview.maximumImmediateFanout < 1) {
        return Object.freeze({
          campaignId,
          preparedRuns: Object.freeze([]),
          completions: Object.freeze([]),
          preview,
        });
      }
      const activeTaskIds = new Set([...this.#active.keys()].flatMap((runId) => {
        const run = this.#registry.snapshot().runs.find((item) => item.runId === runId);
        return run === undefined ? [] : [run.taskId];
      }));
      const tasks = validCampaign.taskIds.flatMap((taskId) => {
        const task = initial.tasks.find((item) => item.taskId === taskId);
        return task === undefined || activeTaskIds.has(taskId) ? [] : [task];
      }).slice(0, preview.maximumImmediateFanout);
      const preparedRuns: AgentRun[] = [];
      const completions: Promise<AgentRun>[] = [];
      for (const task of tasks) {
        const snapshot = this.#registry.snapshot();
        const profile = this.#executionProfile(snapshot, validCampaign.executionProfileId);
        this.#capabilityService?.assertServiceDispatchEligible(profile);
        const runOrdinal = snapshot.runs.filter((run) => run.taskId === task.taskId).length + 1;
        const now = canonicalIso(this.#now());
        const run = buildAgentRun({
          task,
          executionProfile: profile,
          runOrdinal,
          authorization: { kind: "CAMPAIGN", campaign: validCampaign, authorizedAt: now },
          createdAt: now,
        });
        this.#registry.saveBatch({
          runs: [run],
          runAnnotations: this.#runAnnotations(task, run),
        });
        preparedRuns.push(run);
        const completion = this.#execute(validCampaign, run, task, profile);
        this.#active.set(run.runId, completion);
        void completion.then(
          () => this.#active.delete(run.runId),
          () => this.#active.delete(run.runId),
        );
        completions.push(completion);
      }
      return Object.freeze({
        campaignId,
        preparedRuns: Object.freeze(preparedRuns),
        completions: Object.freeze(completions),
        preview,
      });
    } finally {
      this.#dispatchingCampaigns.delete(campaignId);
    }
  }

  public tick(): readonly AgentCampaignDispatchResult[] {
    const now = this.#now();
    return Object.freeze(effectiveAgentCampaigns(this.#registry.snapshot().campaigns)
      .flatMap((campaign) => {
      if (campaign.status !== "ACTIVE" || campaign.schedule.kind !== "INTERVAL") return [];
      const latest = campaignRuns(this.#registry.snapshot(), campaign.campaignId)
        .map((run) => Date.parse(run.createdAt))
        .sort((left, right) => right - left)[0] ?? Date.parse(campaign.activatedAt!);
      return latest + campaign.schedule.intervalMs! > now
        ? []
        : [this.dispatchCampaign(campaign.campaignId)];
      }));
  }

  #preview(campaign: AgentCampaign, snapshot: AgentExecutionSnapshot): AgentCampaignDispatchPreview {
    const runs = campaignRuns(snapshot, campaign.campaignId);
    const runIds = new Set(runs.map((run) => run.runId));
    const invocations = snapshot.modelInvocations.filter((item) => runIds.has(item.runId));
    const activeRunCount = runs.filter((run) => run.status === "PREPARED").length;
    const input = invocations.reduce((total, item) => total + tokens(item.inputTokens), 0n);
    const output = invocations.reduce((total, item) => total + tokens(item.outputTokens), 0n);
    const maximumInput = campaign.budget.maximumInputTokens === null
      ? null
      : BigInt(campaign.budget.maximumInputTokens);
    const maximumOutput = campaign.budget.maximumOutputTokens === null
      ? null
      : BigInt(campaign.budget.maximumOutputTokens);
    const consumedWallClockMs = totalWallClockMs(runs, this.#now());
    const remainingModelInvocations = Math.max(
      0,
      campaign.budget.maximumModelInvocations - invocations.length -
        (this.#reservedInvocations.get(campaign.campaignId) ?? 0),
    );
    const tokenOpen = (maximumInput === null || input < maximumInput) &&
      (maximumOutput === null || output < maximumOutput);
    const wallClockOpen = consumedWallClockMs < campaign.budget.maximumWallClockMs;
    const concurrencyOpen = Math.max(
      0,
      campaign.budget.maximumConcurrentRuns - activeRunCount,
    );
    const dispatchableTaskCount = campaign.taskIds.filter((taskId) =>
      snapshot.tasks.some((task) => task.taskId === taskId)
    ).length;
    return Object.freeze({
      campaignId: campaign.campaignId,
      status: campaign.status,
      configuredTaskCount: campaign.taskIds.length,
      dispatchableTaskCount,
      activeRunCount,
      maximumImmediateFanout: campaign.status === "ACTIVE" && remainingModelInvocations > 0 &&
          tokenOpen && wallClockOpen
        ? Math.min(concurrencyOpen, dispatchableTaskCount)
        : 0,
      consumedModelInvocations: invocations.length,
      remainingModelInvocations,
      consumedInputTokens: input.toString(),
      remainingInputTokens: maximumInput === null
        ? null
        : (maximumInput > input ? maximumInput - input : 0n).toString(),
      consumedOutputTokens: output.toString(),
      remainingOutputTokens: maximumOutput === null
        ? null
        : (maximumOutput > output ? maximumOutput - output : 0n).toString(),
      consumedWallClockMs,
      remainingWallClockMs: Math.max(
        0,
        campaign.budget.maximumWallClockMs - consumedWallClockMs,
      ),
      providerRequestsStarted: 0 as const,
    });
  }

  #executionProfile(snapshot: AgentExecutionSnapshot, id: Hash): ExecutionProfile {
    const profile = snapshot.executionProfiles.find((item) => item.executionProfileId === id);
    if (profile === undefined) throw new Error("Campaign execution profile is unavailable");
    return profile;
  }

  async #execute(
    campaign: AgentCampaign | null,
    run: AgentRun,
    task: AgentTask,
    profile: ExecutionProfile,
  ): Promise<AgentRun> {
    const snapshot = this.#registry.snapshot();
    const runtime = snapshot.runtimeDefinitions.find((item) =>
      item.runtimeDefinitionId === profile.runtimeDefinitionId
    );
    const credential = snapshot.credentialBindings.find((item) =>
      item.credentialBindingId === profile.credentialBindingId
    ) as CredentialBinding | undefined;
    const model = snapshot.modelProfiles.find((item) =>
      item.modelProfileId === profile.modelProfileId
    ) as ModelProfile | undefined;
    const adapter = runtime === undefined ? undefined : this.#adapters.get(runtime.kind);
    if (runtime === undefined || credential === undefined || model === undefined || adapter === undefined) {
      const failed = completeAgentRun(
        run,
        "FAILED",
        canonicalIso(this.#now()),
        "campaign execution dependency unavailable",
      );
      this.#registry.saveBatch({ runs: [failed] });
      return failed;
    }
    let result: Awaited<ReturnType<typeof executePreparedAgentRun>>;
    try {
      const taskPayload = this.#taskPayload(task, run);
      result = await executePreparedAgentRun({
        run,
        task,
        taskPayload,
        runtimeDefinition: runtime,
        credentialBinding: credential,
        modelProfile: model,
        executionProfile: profile,
        adapter,
        credentialBroker: this.#credentialBroker,
        toolHost: this.#toolHost(task, taskPayload, run),
        now: this.#now,
        ...(campaign === null ? {} : {
          beforeModelInvocation: () => {
            const preview = this.#preview(campaign, this.#registry.snapshot());
            if (preview.remainingModelInvocations < 1 ||
                preview.remainingWallClockMs < 1 ||
                preview.remainingInputTokens === "0" ||
                preview.remainingOutputTokens === "0") {
              throw new AgentCampaignBudgetExhausted();
            }
            this.#reservedInvocations.set(
              campaign.campaignId,
              (this.#reservedInvocations.get(campaign.campaignId) ?? 0) + 1,
            );
          },
        }),
        onProgress: (batch) => {
          if (campaign !== null && (batch.modelInvocations?.length ?? 0) > 0) {
            this.#reservedInvocations.set(
              campaign.campaignId,
              Math.max(0, (this.#reservedInvocations.get(campaign.campaignId) ?? 0) - 1),
            );
          }
          this.#registry.saveBatch(batch);
        },
      });
    } catch {
      const failed = completeAgentRun(
        run,
        "FAILED",
        canonicalIso(this.#now()),
        "campaign dispatcher failed before runtime completion",
      );
      this.#registry.saveBatch({ runs: [failed] });
      return failed;
    } finally {
      if (campaign !== null) {
        this.#reservedInvocations.set(campaign.campaignId, Math.max(
          0,
          (this.#reservedInvocations.get(campaign.campaignId) ?? 0) - 1,
        ));
      }
    }
    this.#registry.saveBatch({
      runs: [result.run],
      modelInvocations: result.modelInvocations,
      toolEffects: result.toolEffects,
      runArtifacts: result.runArtifacts,
    });
    return result.run;
  }
}
