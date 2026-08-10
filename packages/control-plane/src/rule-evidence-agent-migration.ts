import { hashCanonical, type Hash } from "@pmh/domain";
import {
  CODEX_REASONING_EFFORTS,
  CODEX_RUNTIME_MODELS,
  type CodexReasoningEffort,
} from "./ai-runtime-configuration.js";
import type { AiUsageEvent } from "./ai-usage-ledger.js";
import {
  buildAgentRun,
  buildAgentRunAnnotation,
  buildAgentRunArtifact,
  buildAgentRuntimeDefinition,
  buildAgentTask,
  buildAgentToolEffect,
  buildCredentialBinding,
  buildExecutionProfile,
  buildModelInvocation,
  buildModelProfile,
  completeAgentRun,
  type AgentExecutionBatch,
  type AgentExecutionSnapshot,
  type AgentRun,
  type AgentTask,
  type ExecutionProfile,
  type ModelProfile,
} from "./agent-execution-substrate.js";
import {
  CURRENT_RULE_EVIDENCE_INTERPRETER_PROTOCOL,
  ruleEvidenceInterpreterIdentity,
  type RuleEvidenceClaimRecord,
  type RuleEvidenceInterpreterEngine,
  type RuleEvidenceInterpreterProtocol,
} from "./rule-evidence-claim.js";
import type { RuleEvidenceClaimJobRecord } from "./rule-evidence-claim-scheduler.js";
import type { EvidenceDocumentCapture } from "./evidence-document.js";

const LEGACY_PROTOCOLS = Object.freeze([
  "LEGACY_V1",
  "RANGE_CITATIONS_V2",
  "CAVEATED_RANGE_CITATIONS_V3",
  "FORCED_TERMINAL_V4",
  "PASSAGE_HANDLES_V5",
] as const satisfies readonly RuleEvidenceInterpreterProtocol[]);

type ResolvedLegacyEngine = Readonly<{
  engine: RuleEvidenceInterpreterEngine;
  protocol: RuleEvidenceInterpreterProtocol;
}>;

export type RuleEvidenceAgentMigrationReport = Readonly<{
  terminalJobCount: number;
  attemptBearingJobCount: number;
  migratedTaskCount: number;
  legacyInputGapTaskCount: number;
  pendingTaskOnlyCount: number;
  migratedRunCount: number;
  migratedInvocationCount: number;
  migratedToolEffectCount: number;
  migratedArtifactCount: number;
  migratedAnnotationCount: number;
  representedProviderRequestCount: string;
  attributionGapCount: number;
  unmappedTerminalJobCount: number;
  unmappedRunJobCount: number;
  unmappedUsageEventCount: number;
  providerRequestsStarted: 0;
}>;

export type RuleEvidenceAgentMigration = Readonly<{
  batch: AgentExecutionBatch;
  report: RuleEvidenceAgentMigrationReport;
}>;

function deepSeekEngine(model = "deepseek-v4-flash"): RuleEvidenceInterpreterEngine {
  return Object.freeze({
    provider: "DEEPSEEK" as const,
    transport: "VERCEL_AI_SDK" as const,
    model,
    reasoningEffort: null,
    responseStorage: false as const,
  });
}

function codexEngine(model: string, effort: CodexReasoningEffort): RuleEvidenceInterpreterEngine {
  return Object.freeze({
    provider: "CODEX" as const,
    transport: "VERCEL_AI_SDK" as const,
    model,
    reasoningEffort: effort,
    responseStorage: false as const,
  });
}

function resolveEngine(
  job: RuleEvidenceClaimJobRecord,
  record: RuleEvidenceClaimRecord | undefined,
): ResolvedLegacyEngine | null {
  const model = record?.model ?? "deepseek-v4-flash";
  for (const protocol of LEGACY_PROTOCOLS) {
    const engine = deepSeekEngine(model);
    if (ruleEvidenceInterpreterIdentity(engine, protocol) === job.interpreterIdentity) {
      return Object.freeze({ engine, protocol });
    }
  }
  const deepseek = deepSeekEngine(model);
  if (ruleEvidenceInterpreterIdentity(
    deepseek,
    CURRENT_RULE_EVIDENCE_INTERPRETER_PROTOCOL,
  ) === job.interpreterIdentity) {
    return Object.freeze({
      engine: deepseek,
      protocol: CURRENT_RULE_EVIDENCE_INTERPRETER_PROTOCOL,
    });
  }
  for (const codexModel of CODEX_RUNTIME_MODELS) {
    if (record !== undefined && record.model !== codexModel) continue;
    for (const effort of CODEX_REASONING_EFFORTS) {
      const engine = codexEngine(codexModel, effort);
      if (ruleEvidenceInterpreterIdentity(
        engine,
        CURRENT_RULE_EVIDENCE_INTERPRETER_PROTOCOL,
      ) === job.interpreterIdentity) {
        return Object.freeze({
          engine,
          protocol: CURRENT_RULE_EVIDENCE_INTERPRETER_PROTOCOL,
        });
      }
    }
  }
  return null;
}

function taskForJob(
  tasks: readonly AgentTask[],
  job: RuleEvidenceClaimJobRecord,
): AgentTask | null {
  return tasks.find((task) => task.kind === "RULE_EVIDENCE_CLAIM" &&
    task.inputArtifacts.some((artifact) =>
      artifact.kind === "EVIDENCE_REQUIREMENT" && artifact.artifactId === job.requirementId
    ) && task.inputArtifacts.some((artifact) =>
      ["EVIDENCE_OBSERVATION", "LEGACY_EVIDENCE_OBSERVATION_IDENTITY"].includes(
        artifact.kind,
      ) && artifact.artifactId === job.observationId
    ) && task.inputArtifacts.some((artifact) =>
      artifact.kind === "EVIDENCE_DOCUMENT" && artifact.artifactId === job.documentId &&
      artifact.artifactHash === job.documentRawHash
    ) && task.inputArtifacts.some((artifact) =>
      artifact.kind === "EVIDENCE_EXTRACTION" && artifact.artifactId === job.extractionId &&
      artifact.artifactHash === job.extractionTextHash
    )) ?? null;
}

function taskFromLegacyJob(
  job: RuleEvidenceClaimJobRecord,
  capture: EvidenceDocumentCapture,
): AgentTask | null {
  if (
    capture.observation.observationId !== job.observationId ||
    capture.observation.acquisitionScopeIdentity !== job.requirement.acquisitionScopeIdentity ||
    capture.document.record.documentId !== job.documentId ||
    capture.document.record.rawHash !== job.documentRawHash ||
    capture.extraction.record.extractionId !== job.extractionId ||
    capture.extraction.record.textHash !== job.extractionTextHash
  ) return null;
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_V1",
    inputArtifacts: Object.freeze([
      Object.freeze({
        kind: "EVIDENCE_REQUIREMENT",
        artifactId: job.requirementId,
        artifactHash: hashCanonical(job.requirement),
      }),
      Object.freeze({
        kind: "EVIDENCE_OBSERVATION",
        artifactId: job.observationId,
        artifactHash: hashCanonical(capture.observation),
      }),
      Object.freeze({
        kind: "EVIDENCE_DOCUMENT",
        artifactId: job.documentId,
        artifactHash: job.documentRawHash,
      }),
      Object.freeze({
        kind: "EVIDENCE_EXTRACTION",
        artifactId: job.extractionId,
        artifactHash: job.extractionTextHash,
      }),
    ]),
    taskPayload: Object.freeze({
      requirementId: job.requirementId,
      proposalId: job.proposalId,
      requirementKind: job.requirement.kind,
      temporalPosture: job.requirement.temporalPosture,
      acquisitionScopeIdentity: job.requirement.acquisitionScopeIdentity,
      observationId: job.observationId,
      documentId: job.documentId,
      documentRawHash: job.documentRawHash,
      extractionId: job.extractionId,
      extractionTextHash: job.extractionTextHash,
    }),
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: `rule-evidence:${job.requirementId}`,
    priority: 0,
    createdAt: capture.observation.receivedAt,
  });
}

function taskFromLegacyGap(job: RuleEvidenceClaimJobRecord): AgentTask {
  return buildAgentTask({
    kind: "RULE_EVIDENCE_CLAIM",
    protocol: "RULE_EVIDENCE_TASK_LEGACY_GAP_V1",
    inputArtifacts: Object.freeze([
      Object.freeze({
        kind: "EVIDENCE_REQUIREMENT",
        artifactId: job.requirementId,
        artifactHash: hashCanonical(job.requirement),
      }),
      Object.freeze({
        kind: "LEGACY_EVIDENCE_OBSERVATION_IDENTITY",
        artifactId: job.observationId,
        artifactHash: hashCanonical({
          observationId: job.observationId,
          contentRetained: false,
        }),
      }),
      Object.freeze({
        kind: "EVIDENCE_DOCUMENT",
        artifactId: job.documentId,
        artifactHash: job.documentRawHash,
      }),
      Object.freeze({
        kind: "EVIDENCE_EXTRACTION",
        artifactId: job.extractionId,
        artifactHash: job.extractionTextHash,
      }),
    ]),
    taskPayload: Object.freeze({
      requirementId: job.requirementId,
      proposalId: job.proposalId,
      requirementKind: job.requirement.kind,
      temporalPosture: job.requirement.temporalPosture,
      acquisitionScopeIdentity: job.requirement.acquisitionScopeIdentity,
      observationId: job.observationId,
      documentId: job.documentId,
      documentRawHash: job.documentRawHash,
      extractionId: job.extractionId,
      extractionTextHash: job.extractionTextHash,
      observationContentRetained: false,
    }),
    requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
    provenanceRef: `rule-evidence:${job.requirementId}`,
    priority: 0,
    createdAt: job.createdAt,
  });
}

function profileKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._:/-]+/gu, "-").slice(0, 150);
}

function engineKey(resolved: ResolvedLegacyEngine): string {
  return profileKey([
    resolved.engine.provider,
    resolved.engine.model,
    resolved.engine.reasoningEffort ?? "no-effort",
    resolved.protocol,
  ].join("-"));
}

function createProfile(
  resolved: ResolvedLegacyEngine,
  createdAt: string,
): Readonly<{
  runtimeDefinition: ReturnType<typeof buildAgentRuntimeDefinition>;
  credentialBinding: ReturnType<typeof buildCredentialBinding>;
  modelProfile: ModelProfile;
  executionProfile: ExecutionProfile;
}> {
  const runtimeDefinition = buildAgentRuntimeDefinition({
    kind: "HARNESS_IN_PROCESS",
    version: "legacy-rule-evidence-ai-sdk-loop-v1",
  });
  const key = engineKey(resolved);
  const credentialBinding = resolved.engine.provider === "CODEX"
    ? buildCredentialBinding({
        kind: "CODEX_OAUTH",
        logicalAccountRef: "legacy-codex-oauth-unretained",
        resolverKind: "CODEX_AUTH_CACHE",
        resolverRef: "codex-auth-cache:legacy-unretained",
      })
    : buildCredentialBinding({
        kind: "DEEPSEEK_API_KEY",
        logicalAccountRef: "legacy-deepseek-api-key-unretained",
        resolverKind: "ENVIRONMENT",
        resolverRef: "env:DEEPSEEK_API_KEY",
      });
  const modelProfile = resolved.engine.provider === "CODEX"
    ? buildModelProfile({
        profileKey: `legacy-rule-evidence-model-${key}`,
        revision: 1,
        accessDriver: "CODEX_RESPONSES",
        model: resolved.engine.model,
        configuration: {
          schemaVersion: "pmh.codex-model-configuration.v1",
          reasoning: { effort: resolved.engine.reasoningEffort! },
          responseStorage: false,
        },
        createdAt,
      })
    : buildModelProfile({
        profileKey: `legacy-rule-evidence-model-${key}`,
        revision: 1,
        accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
        model: resolved.engine.model,
        configuration: {
          schemaVersion: "pmh.deepseek-flash-model-configuration.v1",
          thinking: { mode: "disabled" },
          responseStorage: false,
        },
        createdAt,
      });
  const executionProfile = buildExecutionProfile({
    profileKey: `legacy-rule-evidence-execution-${key}`,
    revision: 1,
    runtimeDefinition,
    credentialBinding,
    modelProfile,
    toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
    runBudget: {
      maximumModelInvocations: 10,
      maximumToolCalls: 200,
      maximumWallClockMs: 600_000,
      maximumInputTokens: null,
      maximumOutputTokens: null,
    },
    createdAt,
  });
  return Object.freeze({ runtimeDefinition, credentialBinding, modelProfile, executionProfile });
}

function terminalTime(job: RuleEvidenceClaimJobRecord): string {
  return job.completedAt ?? job.leaseExpiresAt ?? job.updatedAt;
}

function historicalRunStartedAt(
  job: RuleEvidenceClaimJobRecord,
  record: RuleEvidenceClaimRecord | undefined,
): string {
  return [job.createdAt, job.leasedAt, record?.startedAt, terminalTime(job)]
    .filter((value): value is string => value !== null && value !== undefined)
    .sort()[0]!;
}

function eventRequirementId(event: AiUsageEvent): Hash | null {
  const match = /^requirement:(sha256:[0-9a-f]{64})$/u.exec(event.operationIdentity);
  return match?.[1] as Hash | undefined ?? null;
}

function eventMatchesEngine(event: AiUsageEvent, engine: RuleEvidenceInterpreterEngine): boolean {
  return event.model === engine.model && event.provider.toUpperCase() === engine.provider;
}

function eventStatus(event: AiUsageEvent): "SUCCEEDED" | "FAILED" | "TIMED_OUT" {
  if (event.outcome === "TIMED_OUT") return "TIMED_OUT";
  if (event.outcome === "FAILED") return "FAILED";
  return "SUCCEEDED";
}

function eventStartedAt(event: AiUsageEvent, run: AgentRun): string {
  const duration = BigInt(event.durationMs);
  const occurredAt = Date.parse(event.occurredAt);
  const boundedDuration = duration > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(duration);
  return new Date(Math.max(Date.parse(run.createdAt), occurredAt - boundedDuration)).toISOString();
}

function requestCount(event: AiUsageEvent): bigint {
  return event.providerRequestCount === null ? 1n : BigInt(event.providerRequestCount);
}

export function buildRuleEvidenceAgentMigration(input: Readonly<{
  snapshot: AgentExecutionSnapshot;
  jobs: readonly RuleEvidenceClaimJobRecord[];
  records: readonly RuleEvidenceClaimRecord[];
  usageEvents: readonly AiUsageEvent[];
  captures?: readonly EvidenceDocumentCapture[];
  observedAt: string;
}>): RuleEvidenceAgentMigration {
  const observedAtMs = Date.parse(input.observedAt);
  if (!Number.isFinite(observedAtMs) || new Date(observedAtMs).toISOString() !== input.observedAt) {
    throw new Error("Rule Evidence migration observedAt must be a canonical ISO timestamp");
  }
  const records = new Map(input.records.map((record) => [record.interpretationId, record] as const));
  const captures = new Map((input.captures ?? []).map((capture) => [
    `${capture.observation.observationId}:${capture.document.record.documentId}:` +
      capture.extraction.record.extractionId,
    capture,
  ] as const));
  const tasksById = new Map(input.snapshot.tasks.map((task) => [task.taskId, task] as const));
  let legacyInputGapTaskCount = 0;
  for (const job of input.jobs) {
    if (taskForJob([...tasksById.values()], job) !== null) continue;
    const capture = captures.get(`${job.observationId}:${job.documentId}:${job.extractionId}`);
    const task = capture === undefined
      ? taskFromLegacyGap(job)
      : taskFromLegacyJob(job, capture) ?? taskFromLegacyGap(job);
    if (task.protocol === "RULE_EVIDENCE_TASK_LEGACY_GAP_V1") {
      legacyInputGapTaskCount += 1;
    }
    tasksById.set(task.taskId, task);
  }
  const migratedTasks = Object.freeze([...tasksById.values()].filter((task) =>
    !input.snapshot.tasks.some((retained) => retained.taskId === task.taskId)
  ));
  const usageEvents = input.usageEvents.filter((event) => event.purpose === "RULE_EVIDENCE_CLAIM");
  const terminalJobs = input.jobs.filter((job) =>
    job.status === "PASS" || job.status === "EXHAUSTED" ||
    (job.status === "LEASED" && job.leaseExpiresAt !== null &&
      Date.parse(job.leaseExpiresAt) <= observedAtMs)
  );
  const runJobs = input.jobs.filter((job) => terminalJobs.includes(job) ||
    (job.status === "RETRY_WAIT" && job.attemptCount > 0)
  ).sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
    left.jobId.localeCompare(right.jobId));
  const pendingTaskOnlyCount = input.jobs.length - runJobs.length;
  const resolvedJobs = runJobs.flatMap((job) => {
    const task = taskForJob([...tasksById.values()], job);
    const record = records.get(job.jobId);
    const resolved = resolveEngine(job, record);
    return task === null || resolved === null
      ? []
      : [Object.freeze({ job, task, record, resolved })];
  });
  const resolvedJobIds = new Set(resolvedJobs.map((item) => item.job.jobId));
  const unmappedTerminalJobCount = terminalJobs.filter((job) =>
    !resolvedJobIds.has(job.jobId)
  ).length;
  const unmappedRunJobCount = runJobs.length - resolvedJobs.length;
  const earliestByEngine = new Map<string, string>();
  for (const item of resolvedJobs) {
    const key = engineKey(item.resolved);
    const current = earliestByEngine.get(key);
    const runStartedAt = historicalRunStartedAt(item.job, item.record);
    if (current === undefined || runStartedAt < current) {
      earliestByEngine.set(key, runStartedAt);
    }
  }
  const profiles = new Map([...earliestByEngine].map(([key, createdAt]) => {
    const resolved = resolvedJobs.find((item) => engineKey(item.resolved) === key)!.resolved;
    const candidate = createProfile(resolved, createdAt);
    return [key, Object.freeze({
      runtimeDefinition: input.snapshot.runtimeDefinitions.find((record) =>
        record.runtimeDefinitionId === candidate.runtimeDefinition.runtimeDefinitionId
      ) ?? candidate.runtimeDefinition,
      credentialBinding: input.snapshot.credentialBindings.find((record) =>
        record.credentialBindingId === candidate.credentialBinding.credentialBindingId
      ) ?? candidate.credentialBinding,
      modelProfile: input.snapshot.modelProfiles.find((record) =>
        record.modelProfileId === candidate.modelProfile.modelProfileId
      ) ?? candidate.modelProfile,
      executionProfile: input.snapshot.executionProfiles.find((record) =>
        record.executionProfileId === candidate.executionProfile.executionProfileId
      ) ?? candidate.executionProfile,
    })] as const;
  }));
  const runtimeDefinitions = new Map<Hash, ReturnType<typeof buildAgentRuntimeDefinition>>();
  const credentialBindings = new Map<Hash, ReturnType<typeof buildCredentialBinding>>();
  const modelProfiles = new Map<Hash, ModelProfile>();
  const executionProfiles = new Map<Hash, ExecutionProfile>();
  for (const profile of profiles.values()) {
    runtimeDefinitions.set(profile.runtimeDefinition.runtimeDefinitionId, profile.runtimeDefinition);
    credentialBindings.set(profile.credentialBinding.credentialBindingId, profile.credentialBinding);
    modelProfiles.set(profile.modelProfile.modelProfileId, profile.modelProfile);
    executionProfiles.set(profile.executionProfile.executionProfileId, profile.executionProfile);
  }
  const jobsByTask = new Map<Hash, typeof resolvedJobs>();
  for (const item of resolvedJobs) {
    const retained = jobsByTask.get(item.task.taskId) ?? [];
    retained.push(item);
    jobsByTask.set(item.task.taskId, retained);
  }
  for (const retained of jobsByTask.values()) retained.sort((left, right) =>
    left.job.createdAt.localeCompare(right.job.createdAt) || left.job.jobId.localeCompare(right.job.jobId)
  );
  const assignmentByEvent = new Map<Hash, (typeof resolvedJobs)[number]>();
  for (const event of usageEvents) {
    const requirementId = eventRequirementId(event);
    if (requirementId === null) continue;
    const candidates = resolvedJobs.filter((item) =>
      item.job.requirementId === requirementId && eventMatchesEngine(event, item.resolved.engine) &&
      Date.parse(event.occurredAt) >= Date.parse(
        historicalRunStartedAt(item.job, item.record),
      ) &&
      Date.parse(event.occurredAt) <= Date.parse(terminalTime(item.job))
    ).sort((left, right) => right.job.createdAt.localeCompare(left.job.createdAt));
    if (candidates[0] !== undefined) assignmentByEvent.set(event.eventId, candidates[0]);
  }
  const runs: AgentRun[] = [];
  const invocations: ReturnType<typeof buildModelInvocation>[] = [];
  const toolEffects: ReturnType<typeof buildAgentToolEffect>[] = [];
  const runArtifacts: ReturnType<typeof buildAgentRunArtifact>[] = [];
  const runAnnotations: ReturnType<typeof buildAgentRunAnnotation>[] = [];
  let representedProviderRequests = 0n;
  let attributionGapCount = 0;
  for (const item of resolvedJobs) {
    const profile = profiles.get(engineKey(item.resolved))!;
    const ordinal = jobsByTask.get(item.task.taskId)!.indexOf(item) + 1;
    const runStartedAt = historicalRunStartedAt(item.job, item.record);
    const prepared = buildAgentRun({
      task: item.task,
      executionProfile: profile.executionProfile,
      runOrdinal: ordinal,
      authorization: {
        kind: "LEGACY_IMPORT",
        authorizationRef: "legacy-rule-evidence-migration-v1",
        authorizedAt: runStartedAt,
      },
      createdAt: runStartedAt,
    });
    const completion = terminalTime(item.job);
    const status = item.job.status === "PASS" ? "SUCCEEDED" as const :
      item.job.status === "EXHAUSTED" ? "FAILED" as const : "INTERRUPTED" as const;
    const completed = completeAgentRun(
      prepared,
      status,
      completion,
      status === "SUCCEEDED" ? null : status === "FAILED"
        ? "legacy Rule Evidence job exhausted"
        : item.job.status === "RETRY_WAIT"
          ? "legacy Rule Evidence retry wait imported without retry authorization"
          : "legacy Rule Evidence lease expired without a retained terminal outcome",
    );
    runs.push(completed);
    const assignedEvents = usageEvents.filter((event) =>
      assignmentByEvent.get(event.eventId) === item
    ).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) ||
      left.eventId.localeCompare(right.eventId));
    assignedEvents.forEach((event, eventIndex) => {
      const requests = requestCount(event);
      representedProviderRequests += requests;
      invocations.push(buildModelInvocation({
        run: prepared,
        modelProfile: profile.modelProfile,
        ordinal: eventIndex + 1,
        status: eventStatus(event),
        startedAt: eventStartedAt(event, prepared),
        completedAt: event.occurredAt,
        inputTokens: event.tokens.inputTokens,
        outputTokens: event.tokens.outputTokens,
        reasoningTokens: event.tokens.reasoningTokens,
        failureCategory: eventStatus(event) === "SUCCEEDED"
          ? null
          : eventStatus(event) === "TIMED_OUT" ? "LEGACY_TIMEOUT" : "LEGACY_REQUEST_FAILED",
      }));
      if (requests !== 1n || event.coverage !== "COMPLETE") {
        attributionGapCount += 1;
        runAnnotations.push(buildAgentRunAnnotation({
          run: completed,
          category: "LEGACY_ATTRIBUTION_GAP",
          sourceRecordRef: `ai-usage-event:${event.eventId}`,
          observedFacts: event,
          note: requests !== 1n
            ? "The retained usage event aggregates multiple provider requests; request-level timing and token allocation are unavailable."
            : "The retained usage event has incomplete token coverage; missing token fields were not inferred.",
          createdAt: completion,
        }));
      }
      if (item.resolved.engine.provider === "CODEX" && event.outcome !== "SUCCEEDED") {
        runAnnotations.push(buildAgentRunAnnotation({
          run: completed,
          category: "INCIDENT_FAILED_CODEX_REQUEST",
          sourceRecordRef: `ai-usage-event:${event.eventId}`,
          observedFacts: event,
          note: "Retained incident evidence records a failed Codex-backed Rule Evidence request; migration does not retry it.",
          createdAt: completion,
        }));
      }
    });
    if (assignedEvents.length === 0 && item.record !== undefined &&
        item.record.completedAt !== null) {
      invocations.push(buildModelInvocation({
        run: prepared,
        modelProfile: profile.modelProfile,
        ordinal: 1,
        status: item.record.status === "PASS" ? "SUCCEEDED" : "FAILED",
        startedAt: item.record.startedAt,
        completedAt: item.record.completedAt,
        failureCategory: item.record.status === "PASS" ? null : "LEGACY_REQUEST_FAILED",
      }));
      representedProviderRequests += 1n;
      attributionGapCount += 1;
      runAnnotations.push(buildAgentRunAnnotation({
        run: completed,
        category: "LEGACY_ATTRIBUTION_GAP",
        sourceRecordRef: `rule-evidence-record:${item.record.interpretationId}`,
        observedFacts: item.record,
        note: "A terminal legacy model record exists without a retained usage event; token usage was not inferred.",
        createdAt: completion,
      }));
    }
    if (item.job.attemptCount > Math.max(1, assignedEvents.length)) {
      attributionGapCount += 1;
      runAnnotations.push(buildAgentRunAnnotation({
        run: completed,
        category: "LEGACY_ATTRIBUTION_GAP",
        sourceRecordRef: `rule-evidence-job:${item.job.jobId}`,
        observedFacts: {
          attemptCount: item.job.attemptCount,
          retainedUsageEventCount: assignedEvents.length,
        },
        note: "The legacy job retained only aggregate attempt count; missing attempt timestamps, outcomes, and token usage were not fabricated.",
        createdAt: completion,
      }));
    }
    if (item.job.status === "PASS" && item.record?.claim !== null &&
        item.record?.claim !== undefined) {
      const effect = buildAgentToolEffect({
        run: prepared,
        ordinal: 1,
        toolProtocol: "RULE_EVIDENCE_TOOLS_V1",
        toolName: "submit_rule_evidence_claim",
        status: "ACCEPTED",
        canonicalInput: item.record.claim,
        canonicalOutput: {
          legacyStatus: "PASS",
          claimId: item.record.claim.claimId,
          retainedArtifactHash: item.record.claim.artifactHash,
        },
        occurredAt: item.record.claim.completedAt,
      });
      toolEffects.push(effect);
      runArtifacts.push(buildAgentRunArtifact({
        run: completed,
        ordinal: 1,
        kind: "LEGACY_RULE_EVIDENCE_CLAIM",
        contentHash: item.record.claim.artifactHash,
        sourceArtifactRef: `rule-evidence-claim:${item.record.claim.claimId}`,
        createdAt: item.record.claim.completedAt,
      }));
    } else if (item.job.status === "PASS") {
      attributionGapCount += 1;
      runAnnotations.push(buildAgentRunAnnotation({
        run: completed,
        category: "LEGACY_ARTIFACT_NOT_RETAINED",
        sourceRecordRef: `rule-evidence-job:${item.job.jobId}`,
        observedFacts: {
          status: item.job.status,
          lastClaimId: item.job.lastClaimId,
          jobArtifactHash: item.job.artifactHash,
        },
        note: "The job proves a historical PASS, but the claim body is outside the retained record window; no result artifact was reconstructed from its job hash.",
        createdAt: completion,
      }));
    }
    runAnnotations.push(buildAgentRunAnnotation({
      run: completed,
      category: "LEGACY_STATUS_PROJECTION",
      sourceRecordRef: `rule-evidence-job:${item.job.jobId}`,
      observedFacts: item.job,
      note: "This run is a provider-free projection of the retained legacy scheduler record and carries LEGACY_IMPORT authorization only.",
      createdAt: completion,
    }));
    if (item.job.status === "LEASED") {
      runAnnotations.push(buildAgentRunAnnotation({
        run: completed,
        category: "INTERRUPTED_LEGACY_LEASE",
        sourceRecordRef: `rule-evidence-job:${item.job.jobId}`,
        observedFacts: {
          leasedAt: item.job.leasedAt,
          leaseExpiresAt: item.job.leaseExpiresAt,
          attemptCount: item.job.attemptCount,
        },
        note: "The retained lease expired before migration and remains interrupted; it was not converted into retry work.",
        createdAt: completion,
      }));
    }
    if (item.job.status === "RETRY_WAIT") {
      runAnnotations.push(buildAgentRunAnnotation({
        run: completed,
        category: "LEGACY_RETRY_WAIT_INTERRUPTED",
        sourceRecordRef: `rule-evidence-job:${item.job.jobId}`,
        observedFacts: {
          attemptCount: item.job.attemptCount,
          nextAttemptAt: item.job.nextAttemptAt,
          diagnostic: item.job.diagnostic,
        },
        note: "The legacy job retained failed attempts and retry eligibility; migration records the attempt-bearing run as interrupted but grants no retry authorization.",
        createdAt: completion,
      }));
    }
    if (item.task.protocol === "RULE_EVIDENCE_TASK_LEGACY_GAP_V1") {
      attributionGapCount += 1;
      runAnnotations.push(buildAgentRunAnnotation({
        run: completed,
        category: "LEGACY_INPUT_ARTIFACT_GAP",
        sourceRecordRef: `rule-evidence-job:${item.job.jobId}`,
        observedFacts: {
          observationId: item.job.observationId,
          documentId: item.job.documentId,
          extractionId: item.job.extractionId,
          documentRawHash: item.job.documentRawHash,
          extractionTextHash: item.job.extractionTextHash,
        },
        note: "The legacy job retains artifact identities and hashes, but the observation/document capture is outside the retained window; missing bytes and observation metadata were not reconstructed.",
        createdAt: completion,
      }));
    }
  }
  const mappedUsageIds = new Set(assignmentByEvent.keys());
  return Object.freeze({
    batch: Object.freeze({
      runtimeDefinitions: Object.freeze([...runtimeDefinitions.values()]),
      credentialBindings: Object.freeze([...credentialBindings.values()]),
      modelProfiles: Object.freeze([...modelProfiles.values()]),
      executionProfiles: Object.freeze([...executionProfiles.values()]),
      tasks: migratedTasks,
      runs: Object.freeze(runs),
      modelInvocations: Object.freeze(invocations),
      toolEffects: Object.freeze(toolEffects),
      runArtifacts: Object.freeze(runArtifacts),
      runAnnotations: Object.freeze(runAnnotations),
    }),
    report: Object.freeze({
      terminalJobCount: terminalJobs.length,
      attemptBearingJobCount: runJobs.length,
      migratedTaskCount: migratedTasks.length,
      legacyInputGapTaskCount,
      pendingTaskOnlyCount,
      migratedRunCount: runs.length,
      migratedInvocationCount: invocations.length,
      migratedToolEffectCount: toolEffects.length,
      migratedArtifactCount: runArtifacts.length,
      migratedAnnotationCount: runAnnotations.length,
      representedProviderRequestCount: representedProviderRequests.toString(),
      attributionGapCount,
      unmappedTerminalJobCount,
      unmappedRunJobCount,
      unmappedUsageEventCount: usageEvents.filter((event) =>
        !mappedUsageIds.has(event.eventId)
      ).length,
      providerRequestsStarted: 0 as const,
    }),
  });
}
