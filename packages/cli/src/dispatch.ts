import { createCliEnvelope, type CliEnvelope } from "./envelope.js";
import {
  ControlPlaneRequestError,
  requestControlPlaneJson,
  type ControlPlaneClientOptions,
} from "./control-plane-client.js";
import { venueRegistry } from "./registry.js";

export const SUPPORTED_COMMANDS = Object.freeze([
  "help",
  "system status",
  "control status",
  "agent workspace",
  "agent target inspect <target-id>",
  "agent task inspect <task-id>",
  "agent task preview <task-id> <execution-profile-id>",
  "agent task execute <task-id> <execution-profile-id> <preview-ref> <authorization-ref>",
  "agent run inspect <run-id>",
  "venue list",
  "venue inspect <venue-id>",
] as const);

const COMMAND_CATALOG = Object.freeze([
  Object.freeze({
    command: "help",
    kind: "LOCAL_INSPECTION",
    description: "Discover this version's exact machine-readable command surface.",
    requiresControlPlane: false,
  }),
  Object.freeze({
    command: "system status",
    kind: "LOCAL_INSPECTION",
    description: "Inspect build-time venue coverage and the runtime boundary.",
    requiresControlPlane: false,
  }),
  Object.freeze({
    command: "control status",
    kind: "CONTROL_PLANE_READ",
    description: "Read startup readiness from the local control plane.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "agent workspace",
    kind: "CONTROL_PLANE_READ",
    description: "Read a compact routing view of Agent work and execution state.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "agent target inspect <target-id>",
    kind: "CONTROL_PLANE_READ",
    description: "Inspect one research-action target by exact target identity.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "agent task inspect <task-id>",
    kind: "CONTROL_PLANE_READ",
    description: "Inspect one Agent task, its readiness, and previewable profiles.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "agent task preview <task-id> <execution-profile-id>",
    kind: "CONTROL_PLANE_PREVIEW",
    description: "Preview a manual Agent run without creating a run or calling a model.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "agent task execute <task-id> <execution-profile-id> <preview-ref> <authorization-ref>",
    kind: "CONTROL_PLANE_RESEARCH_DISPATCH",
    description: "Dispatch or reuse a preview-bound manual research run. This is not live trading.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "agent run inspect <run-id>",
    kind: "CONTROL_PLANE_READ",
    description: "Inspect one Agent run and only the records bound to that run.",
    requiresControlPlane: true,
  }),
  Object.freeze({
    command: "venue list",
    kind: "LOCAL_INSPECTION",
    description: "List registered venue protocol identities.",
    requiresControlPlane: false,
  }),
  Object.freeze({
    command: "venue inspect <venue-id>",
    kind: "LOCAL_INSPECTION",
    description: "Inspect one validated venue capability manifest.",
    requiresControlPlane: false,
  }),
]);

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hashValue(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/u.test(value);
}

function invalidIdentityEnvelope(
  command: string,
  args: readonly string[],
  label: string,
): CliEnvelope {
  return createCliEnvelope({
    command,
    arguments: args,
    state: null,
    diagnostics: [{
      severity: "ERROR",
      code: "CLI_ARGUMENT_INVALID",
      message: `${label} must be an exact sha256 identity.`,
    }],
    allowedNextActions: ["agent workspace", "help"],
    ok: false,
  });
}

function invalidAuthorizationEnvelope(
  command: string,
  args: readonly string[],
): CliEnvelope {
  return createCliEnvelope({
    command,
    arguments: args,
    state: null,
    diagnostics: [{
      severity: "ERROR",
      code: "CLI_ARGUMENT_INVALID",
      message: "authorization-ref must be a bounded nonblank identifier.",
    }],
    allowedNextActions: ["agent workspace", "help"],
    ok: false,
  });
}

function authorizationRefValue(value: string): boolean {
  return value.trim() === value &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/u.test(value);
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function hasFalseTradingBoundary(value: JsonObject): boolean {
  return hasLiteralFalseAuthority(value, [
    "tradingExecutionAuthority",
    "externalWriteAuthority",
    "valueMovingAuthority",
    "liveExecutionEnabled",
  ]);
}

function previewExecuteCommand(
  taskId: string,
  executionProfileId: string,
  previewRef: string,
): string {
  return `agent task execute ${taskId} ${executionProfileId} ${previewRef} external-agent:${previewRef}`;
}

function malformedControlPlaneEnvelope(
  command: string,
  path: string,
  args: readonly string[] = [],
): CliEnvelope {
  return createCliEnvelope({
    command,
    arguments: args,
    state: null,
    diagnostics: [{
      severity: "ERROR",
      code: "CONTROL_PLANE_MALFORMED_RESPONSE",
      message: `Control plane returned an incompatible payload for ${path}.`,
    }],
    allowedNextActions: ["control status", "help"],
    ok: false,
  });
}

function controlPlaneFailure(
  command: string,
  error: unknown,
  args: readonly string[] = [],
): CliEnvelope {
  const diagnostic = error instanceof ControlPlaneRequestError
    ? error
    : new ControlPlaneRequestError(
      "CONTROL_PLANE_UNREACHABLE",
      error instanceof Error ? error.message : "Control-plane request failed.",
    );
  return createCliEnvelope({
    command,
    arguments: args,
    state: null,
    diagnostics: [{
      severity: "ERROR",
      code: diagnostic.code,
      message: diagnostic.message,
    }],
    allowedNextActions: ["control status", "help"],
    ok: false,
  });
}

function hasLiteralFalseAuthority(value: JsonObject, keys: readonly string[]): boolean {
  return keys.every((key) => value[key] === false);
}

function hasZeroOperatorReadEffects(value: JsonObject): boolean {
  return value.providerRequestsStartedByRead === 0 &&
    value.modelInvocationsStartedByRead === 0 &&
    value.fetchesStartedByRead === 0 &&
    value.writesStartedByRead === 0 &&
    value.runsCreatedByRead === 0 &&
    value.automaticDispatch === false &&
    hasLiteralFalseAuthority(value, [
      "semanticDecisionAuthority",
      "certificateAuthority",
      "executionAuthority",
      "externalWriteAuthority",
      "valueMovingAuthority",
    ]);
}

function validateAgentOperatorTarget(value: unknown, targetId: string) {
  const document = objectValue(value);
  const target = objectValue(document?.target);
  const allocationAction = document?.allocationAction === null
    ? null
    : objectValue(document?.allocationAction);
  const manualOperation = objectValue(target?.manualOperation);
  if (
    document?.schemaVersion !== "pmh.agent-operator-target.v1" ||
    target?.schemaVersion !== "pmh.research-action-target.v1" ||
    target.targetId !== targetId ||
    manualOperation === null ||
    typeof manualOperation.available !== "boolean" ||
    typeof manualOperation.kind !== "string" ||
    (manualOperation.kind === "RELATION_DISCOVERY_TASK" && (
      manualOperation.available !== true ||
      typeof manualOperation.targetId !== "string" ||
      manualOperation.targetId !== target.sourceTaskId
    )) ||
    !hasZeroOperatorReadEffects(document) ||
    !hasLiteralFalseAuthority(target, [
      "automaticDispatch",
      "modelInvocationAuthority",
      "providerRequestAuthority",
      "fetchAuthority",
      "campaignAuthority",
      "semanticDecisionAuthority",
      "certificateAuthority",
      "executionAuthority",
      "externalWriteAuthority",
      "valueMovingAuthority",
    ]) ||
    allocationAction === null ||
    (
      allocationAction.schemaVersion !== "pmh.research-attention-allocation-action.v2" ||
      allocationAction.actionId !== target.allocationActionId ||
      !hasLiteralFalseAuthority(allocationAction, [
        "modelInvocationAuthority",
        "campaignAuthority",
        "executionAuthority",
        "externalWriteAuthority",
        "valueMovingAuthority",
      ])
    )
  ) return null;
  return Object.freeze({ document, target, allocationAction, manualOperation });
}

function validateAgentOperatorTask(value: unknown, taskId: string) {
  const document = objectValue(value);
  const task = objectValue(document?.task);
  const readiness = objectValue(document?.readiness);
  const authority = objectValue(task?.authority);
  const profiles = Array.isArray(document?.compatibleExecutionProfiles)
    ? document.compatibleExecutionProfiles
    : null;
  const runs = Array.isArray(document?.runs) ? document.runs : null;
  if (
    document?.schemaVersion !== "pmh.agent-operator-task.v1" ||
    task?.schemaVersion !== "pmh.agent-task.v1" ||
    task.taskId !== taskId ||
    readiness === null ||
    !["RUNNABLE", "SUPERSEDED_INPUT", "HISTORICAL_ONLY"].includes(
      String(readiness.status),
    ) ||
    authority?.modelInvocations !== false ||
    authority.externalWrites !== false ||
    authority.semanticDecision !== false ||
    authority.certificatePublication !== false ||
    authority.valueMovingActions !== false ||
    !hasZeroOperatorReadEffects(document) ||
    profiles === null ||
    runs === null ||
    !profiles.every((item) => {
      const profile = objectValue(item);
      return profile !== null &&
        typeof profile.executionProfileId === "string" &&
        profile.automaticDispatch === false;
    })
  ) return null;
  return Object.freeze({
    document,
    task,
    readiness,
    compatibleExecutionProfiles: profiles.flatMap((item) => {
      const profile = objectValue(item);
      return profile === null || typeof profile.executionProfileId !== "string"
        ? []
        : [profile];
    }),
  });
}

function validateManualRunBinding(
  value: unknown,
  taskId: string,
  executionProfileId: string,
  taskPayloadHash: string | null,
  nextRunOrdinal: number | null,
) {
  const binding = objectValue(value);
  const budget = objectValue(binding?.runBudget);
  const previewRef = stringValue(binding?.previewRef);
  const revision = integerValue(binding?.executionProfileRevision);
  const boundOrdinal = integerValue(binding?.nextRunOrdinal);
  if (
    binding?.schemaVersion !== "pmh.agent-manual-run-preview-binding.v1" ||
    previewRef === null ||
    !hashValue(previewRef) ||
    binding.taskId !== taskId ||
    typeof binding.taskPayloadHash !== "string" ||
    !hashValue(binding.taskPayloadHash) ||
    (taskPayloadHash !== null && binding.taskPayloadHash !== taskPayloadHash) ||
    binding.executionProfileId !== executionProfileId ||
    revision === null ||
    revision < 1 ||
    boundOrdinal === null ||
    boundOrdinal < 1 ||
    (nextRunOrdinal !== null && boundOrdinal !== nextRunOrdinal) ||
    budget === null ||
    (integerValue(budget.maximumModelInvocations) ?? 0) < 1 ||
    (integerValue(budget.maximumToolCalls) ?? 0) < 1 ||
    (integerValue(budget.maximumWallClockMs) ?? 0) < 1 ||
    !(
      budget.maximumInputTokens === null ||
      (typeof budget.maximumInputTokens === "string" &&
        /^\d+$/u.test(budget.maximumInputTokens))
    ) ||
    !(
      budget.maximumOutputTokens === null ||
      (typeof budget.maximumOutputTokens === "string" &&
        /^\d+$/u.test(budget.maximumOutputTokens))
    )
  ) return null;
  return Object.freeze({ binding, previewRef, taskPayloadHash: binding.taskPayloadHash });
}

function validateManualRunPreview(
  value: unknown,
  taskId: string,
  executionProfileId: string,
) {
  const document = objectValue(value);
  const preview = objectValue(document?.preview);
  const task = objectValue(preview?.task);
  const executionProfile = objectValue(preview?.executionProfile);
  const authority = objectValue(task?.authority);
  const taskPayloadHash = stringValue(task?.taskPayloadHash);
  const nextRunOrdinal = integerValue(preview?.nextRunOrdinal);
  const bound = validateManualRunBinding(
    document?.binding,
    taskId,
    executionProfileId,
    taskPayloadHash,
    nextRunOrdinal,
  );
  const budget = objectValue(bound?.binding.runBudget);
  if (
    document?.ok !== true ||
    document.mode !== "PREVIEW" ||
    document.run !== undefined ||
    preview === null ||
    task?.schemaVersion !== "pmh.agent-task.v1" ||
    task.taskId !== taskId ||
    executionProfile?.schemaVersion !== "pmh.execution-profile.v1" ||
    executionProfile.executionProfileId !== executionProfileId ||
    (integerValue(executionProfile.revision) !== null &&
      integerValue(executionProfile.revision) !==
        integerValue(bound?.binding.executionProfileRevision)) ||
    preview.providerRequestsStarted !== 0 ||
    document.providerRequestsStarted !== 0 ||
    document.modelInvocationsStarted !== 0 ||
    document.writesStarted !== 0 ||
    document.runsCreated !== 0 ||
    document.executionAuthority !== false ||
    document.researchRunDispatchAuthorityConsumed !== false ||
    document.providerOrModelWorkMayStart !== false ||
    !hasFalseTradingBoundary(document) ||
    authority?.modelInvocations !== false ||
    authority.externalWrites !== false ||
    authority.semanticDecision !== false ||
    authority.certificatePublication !== false ||
    authority.valueMovingActions !== false ||
    bound === null ||
    budget === null ||
    (integerValue(preview.maximumModelInvocations) !== null &&
      integerValue(preview.maximumModelInvocations) !==
        integerValue(budget.maximumModelInvocations))
  ) return null;
  return Object.freeze({
    document,
    preview,
    task,
    executionProfile,
    binding: bound.binding,
    previewRef: bound.previewRef,
  });
}

function validateManualRun(value: unknown, taskId: string, executionProfileId: string) {
  const run = objectValue(value);
  const authorization = objectValue(run?.authorization);
  const runId = stringValue(run?.runId);
  if (
    run?.schemaVersion !== "pmh.agent-run.v1" ||
    runId === null ||
    !hashValue(runId) ||
    run.taskId !== taskId ||
    run.executionProfileId !== executionProfileId ||
    authorization?.kind !== "MANUAL" ||
    typeof authorization.authorizationRef !== "string" ||
    run.externalWriteAuthority !== false ||
    run.valueMovingAuthority !== false
  ) return null;
  return Object.freeze({ run, runId, authorizationRef: authorization.authorizationRef });
}

function validateManualRunExecute(
  value: unknown,
  status: number,
  taskId: string,
  executionProfileId: string,
  previewRef: string,
  authorizationRef: string,
) {
  const document = objectValue(value);
  const validatedRun = validateManualRun(document?.run, taskId, executionProfileId);
  if (
    document?.ok !== true ||
    document.mode !== "EXECUTE" ||
    document.previewRef !== previewRef ||
    validatedRun === null ||
    validatedRun.authorizationRef !== authorizationRef ||
    !hasLiteralFalseAuthority(document, [
      "semanticDecisionAuthority",
      "certificateAuthority",
    ]) ||
    !hasFalseTradingBoundary(document)
  ) return null;
  if (document.reused === true) {
    if (
      status !== 200 ||
      document.dispatchStartedByRequest !== false ||
      document.runCreatedByRequest !== false ||
      document.executionAuthority !== false ||
      document.researchRunDispatchAuthorityConsumed !== false ||
      document.providerOrModelWorkMayStart !== false
    ) return null;
    return Object.freeze({ document, run: validatedRun.run, runId: validatedRun.runId, reused: true as const });
  }
  if (document.reused !== false) return null;
  const bound = validateManualRunBinding(
    document.binding,
    taskId,
    executionProfileId,
    null,
    integerValue(objectValue(document.preview)?.nextRunOrdinal),
  );
  if (
    status !== 202 ||
    document.dispatchStartedByRequest !== true ||
    document.runCreatedByRequest !== true ||
    document.executionAuthority !== true ||
    document.researchRunDispatchAuthorityConsumed !== true ||
    document.providerOrModelWorkMayStart !== true ||
    bound === null ||
    bound.previewRef !== previewRef
  ) return null;
  return Object.freeze({
    document,
    run: validatedRun.run,
    runId: validatedRun.runId,
    reused: false as const,
  });
}

function runBoundCollection(
  document: JsonObject,
  itemsKey: string,
  countKey: string,
  truncatedKey: string,
  runId: string,
): boolean {
  const items = document[itemsKey];
  const count = integerValue(document[countKey]);
  const truncated = document[truncatedKey];
  if (!Array.isArray(items) || items.length > 32 || count === null || count < items.length ||
      typeof truncated !== "boolean") {
    return false;
  }
  if (truncated ? count <= items.length : count !== items.length) return false;
  return items.every((item) => {
    const record = objectValue(item);
    if (record?.runId !== runId) return false;
    for (const authority of [
      "semanticDecisionAuthority",
      "certificateAuthority",
      "externalWriteAuthority",
      "valueMovingAuthority",
    ]) {
      if (authority in record && record[authority] !== false) return false;
    }
    return !("responseStorage" in record && record.responseStorage !== false);
  });
}

function validateAgentOperatorRun(value: unknown, runId: string) {
  const document = objectValue(value);
  const run = objectValue(document?.run);
  const task = objectValue(document?.task);
  const executionProfile = objectValue(document?.executionProfile);
  const status = stringValue(run?.status);
  if (
    document?.schemaVersion !== "pmh.agent-operator-run.v1" ||
    run?.schemaVersion !== "pmh.agent-run.v1" ||
    run.runId !== runId ||
    run.externalWriteAuthority !== false ||
    run.valueMovingAuthority !== false ||
    task === null ||
    executionProfile === null ||
    task.taskId !== run.taskId ||
    typeof task.taskPayloadHash !== "string" ||
    !hashValue(task.taskPayloadHash) ||
    typeof run.taskId !== "string" ||
    !hashValue(run.taskId) ||
    executionProfile.executionProfileId !== run.executionProfileId ||
    (integerValue(executionProfile.revision) ?? 0) < 1 ||
    typeof run.executionProfileId !== "string" ||
    !hashValue(run.executionProfileId) ||
    status === null ||
    !["PREPARED", "INTERRUPTED", "SUCCEEDED", "FAILED", "CANCELLED"].includes(status) ||
    !hasZeroOperatorReadEffects(document) ||
    document.liveExecutionEnabled !== false ||
    document.tradingExecutionAuthority !== false ||
    !runBoundCollection(
      document, "modelInvocations", "modelInvocationCount", "modelInvocationsTruncated", runId,
    ) ||
    !runBoundCollection(
      document, "toolEffects", "toolEffectCount", "toolEffectsTruncated", runId,
    ) ||
    !runBoundCollection(
      document, "artifacts", "artifactCount", "artifactsTruncated", runId,
    ) ||
    !runBoundCollection(
      document, "annotations", "annotationCount", "annotationsTruncated", runId,
    ) ||
    !runBoundCollection(
      document, "resultSelections", "resultSelectionCount", "resultSelectionsTruncated", runId,
    )
  ) return null;
  return Object.freeze({
    document,
    run,
    taskId: run.taskId,
    status,
  });
}

function validateAgentOperatorWorkspace(value: unknown) {
  const workspace = objectValue(value);
  const execution = objectValue(workspace?.execution);
  const attention = objectValue(workspace?.attention);
  const targets = objectValue(workspace?.targets);
  const discoveryCycle = objectValue(workspace?.discoveryCycle);
  if (
    workspace?.schemaVersion !== "pmh.agent-operator-workspace.v1" ||
    execution?.schemaVersion !== "pmh.agent-execution-registry.v1" ||
    attention?.schemaVersion !== "pmh.research-attention-allocation.v1" ||
    targets?.schemaVersion !== "pmh.research-action-target-projection.v1" ||
    discoveryCycle?.schemaVersion !== "pmh.discovery-cycle.v1" ||
    execution.credentialSecretTextRetained !== false ||
    workspace.providerRequestsStartedByRead !== 0 ||
    workspace.modelInvocationsStartedByRead !== 0 ||
    workspace.writesStartedByRead !== 0 ||
    workspace.automaticDispatch !== false ||
    workspace.semanticDecisionAuthority !== false ||
    workspace.certificateAuthority !== false ||
    workspace.externalWriteAuthority !== false ||
    workspace.valueMovingAuthority !== false
  ) return null;
  return workspace;
}

function commandNotFound(argv: readonly string[]): CliEnvelope {
  return createCliEnvelope({
    command: argv.join(".") || "help",
    arguments: argv,
    state: null,
    diagnostics: [
      {
        severity: "ERROR",
        code: "CLI_COMMAND_NOT_FOUND",
        message: "Command is not implemented by this CLI schema version.",
      },
    ],
    allowedNextActions: SUPPORTED_COMMANDS,
    ok: false,
  });
}

export async function runCli(
  argv: readonly string[],
  options: ControlPlaneClientOptions = {},
): Promise<CliEnvelope> {
  const [namespace, action, venueId, ...extra] = argv;

  if (
    argv.length === 0 ||
    (namespace === "help" && action === undefined) ||
    (namespace === "--help" && action === undefined)
  ) {
    return createCliEnvelope({
      command: "help",
      arguments: [],
      state: {
        product: "Auto Prediction",
        interface: "pmh.cli.v1",
        controlPlaneUrl:
          options.baseUrl ?? process.env.PMH_CONTROL_PLANE_URL ??
          "http://127.0.0.1:4100",
        commands: COMMAND_CATALOG,
        environment: Object.freeze({
          PMH_CONTROL_PLANE_URL:
            "Optional HTTP(S) base URL; defaults to http://127.0.0.1:4100",
        }),
      },
      allowedNextActions: SUPPORTED_COMMANDS.filter((item) => item !== "help"),
      ok: true,
    });
  }

  if (namespace === "system" && action === "status" && venueId === undefined) {
    const venues = [...venueRegistry.values()];
    return createCliEnvelope({
      command: "system.status",
      arguments: [],
      state: {
        lifecycle: "PRE_ALPHA",
        venueAdapterCount: venues.length,
        catalogAdapterCount: venues.filter((venue) =>
          venue.capabilities.some(
            (capability) =>
              capability.capability === "MARKET_CATALOG" &&
              capability.implemented,
          ),
        ).length,
        realtimeBookAdapterCount: venues.filter((venue) =>
          venue.capabilities.some(
            (capability) =>
              capability.capability === "REALTIME_BOOK" &&
              capability.implemented,
          ),
        ).length,
        implementedCapabilities: venues.reduce(
          (total, venue) =>
            total +
            venue.capabilities.filter((capability) => capability.implemented)
              .length,
          0,
        ),
        liveExecutionEnabled: false,
        runtimeTarget: {
          node: ">=22.19",
          pnpm: "11.13.1",
        },
      },
      diagnostics: [
        {
          severity: "WARNING",
          code: "LIVE_EXECUTION_DISABLED",
          message: "The harness has no live-order authority.",
        },
      ],
      allowedNextActions: [
        "control status",
        "agent workspace",
        "venue list",
        "venue inspect <venue-id>",
      ],
      ok: true,
    });
  }

  if (namespace === "control" && action === "status" && venueId === undefined) {
    try {
      const result = await requestControlPlaneJson("/api/v1/readiness", {
        ...options,
        acceptedStatuses: [200, 202, 503],
      });
      const readiness = objectValue(result.value);
      if (
        readiness?.schemaVersion !== "pmh.startup-readiness.v1" ||
        !["STARTING", "READY", "FAILED"].includes(String(readiness.status)) ||
        readiness.externalWriteAuthority !== false ||
        readiness.valueMovingAuthority !== false
      ) return malformedControlPlaneEnvelope("control.status", "/api/v1/readiness");

      const ready = readiness.status === "READY";
      const diagnostics = ready ? [] : [{
        severity: readiness.status === "FAILED" ? "ERROR" as const : "WARNING" as const,
        code: readiness.status === "FAILED"
          ? "CONTROL_PLANE_STARTUP_FAILED"
          : "CONTROL_PLANE_STARTING",
        message: stringValue(readiness.diagnostic) ??
          `Control plane is ${String(readiness.status).toLowerCase()} in ${String(readiness.phase)}.`,
      }];
      return createCliEnvelope({
        command: "control.status",
        arguments: [],
        state: Object.freeze({
          schemaVersion: readiness.schemaVersion,
          controlPlaneUrl: result.baseUrl,
          status: readiness.status,
          phase: stringValue(readiness.phase),
          elapsedMs: numberValue(readiness.elapsedMs),
          phaseElapsedMs: numberValue(readiness.phaseElapsedMs),
          currentReconciliationStep:
            stringValue(readiness.currentReconciliationStep),
          diagnostic: stringValue(readiness.diagnostic),
          workspaceResource: "/api/v1/agent-workspace/routing",
          externalWriteAuthority: false as const,
          valueMovingAuthority: false as const,
        }),
        diagnostics,
        allowedNextActions: ready
          ? ["agent workspace", "help"]
          : ["control status", "help"],
        ok: ready,
      });
    } catch (error) {
      return controlPlaneFailure("control.status", error);
    }
  }

  if (namespace === "agent" && action === "workspace" && venueId === undefined) {
    try {
      const result = await requestControlPlaneJson(
        "/api/v1/agent-workspace/routing",
        options,
      );
      const workspace = validateAgentOperatorWorkspace(result.value);
      if (workspace === null) {
        return malformedControlPlaneEnvelope(
          "agent.workspace",
          "/api/v1/agent-workspace/routing",
        );
      }
      return createCliEnvelope({
        command: "agent.workspace",
        arguments: [],
        state: Object.freeze({ ...workspace, controlPlaneUrl: result.baseUrl }),
        allowedNextActions: ["control status", "agent workspace", "help"],
        ok: true,
      });
    } catch (error) {
      return controlPlaneFailure("agent.workspace", error);
    }
  }

  if (
    namespace === "agent" &&
    action === "target" &&
    venueId === "inspect" &&
    extra.length === 1 &&
    extra[0] !== undefined
  ) {
    const targetId = extra[0];
    if (!hashValue(targetId)) {
      return invalidIdentityEnvelope(
        "agent.target.inspect",
        [targetId],
        "target-id",
      );
    }
    const path = `/api/v1/agent-operator/targets/${targetId}` as `/${string}`;
    try {
      const result = await requestControlPlaneJson(path, options);
      const inspected = validateAgentOperatorTarget(result.value, targetId);
      if (inspected === null) {
        return malformedControlPlaneEnvelope("agent.target.inspect", path, [targetId]);
      }
      const linkedTaskId = inspected.manualOperation?.kind === "RELATION_DISCOVERY_TASK"
          && inspected.manualOperation.available === true
        ? stringValue(inspected.manualOperation.targetId)
        : null;
      return createCliEnvelope({
        command: "agent.target.inspect",
        arguments: [targetId],
        state: Object.freeze({
          ...inspected.document,
          controlPlaneUrl: result.baseUrl,
        }),
        allowedNextActions: Object.freeze([
          ...(linkedTaskId === null
            ? []
            : [`agent task inspect ${linkedTaskId}`]),
          "agent workspace",
          "help",
        ]),
        ok: true,
      });
    } catch (error) {
      return controlPlaneFailure("agent.target.inspect", error, [targetId]);
    }
  }

  if (
    namespace === "agent" &&
    action === "task" &&
    venueId === "inspect" &&
    extra.length === 1 &&
    extra[0] !== undefined
  ) {
    const taskId = extra[0];
    if (!hashValue(taskId)) {
      return invalidIdentityEnvelope("agent.task.inspect", [taskId], "task-id");
    }
    const path = `/api/v1/agent-operator/tasks/${taskId}` as `/${string}`;
    try {
      const result = await requestControlPlaneJson(path, options);
      const inspected = validateAgentOperatorTask(result.value, taskId);
      if (inspected === null) {
        return malformedControlPlaneEnvelope("agent.task.inspect", path, [taskId]);
      }
      const previewActions = inspected.readiness.status === "RUNNABLE"
        ? [...new Set(inspected.compatibleExecutionProfiles.map((profile) =>
            `agent task preview ${taskId} ${String(profile.executionProfileId)}`
          ))]
        : [];
      return createCliEnvelope({
        command: "agent.task.inspect",
        arguments: [taskId],
        state: Object.freeze({
          ...inspected.document,
          controlPlaneUrl: result.baseUrl,
        }),
        allowedNextActions: Object.freeze([
          ...previewActions,
          "agent workspace",
          "help",
        ]),
        ok: true,
      });
    } catch (error) {
      return controlPlaneFailure("agent.task.inspect", error, [taskId]);
    }
  }

  if (
    namespace === "agent" &&
    action === "task" &&
    venueId === "preview" &&
    extra.length === 2 &&
    extra[0] !== undefined &&
    extra[1] !== undefined
  ) {
    const taskId = extra[0];
    const executionProfileId = extra[1];
    if (!hashValue(taskId) || !hashValue(executionProfileId)) {
      return invalidIdentityEnvelope(
        "agent.task.preview",
        [taskId, executionProfileId],
        !hashValue(taskId) ? "task-id" : "execution-profile-id",
      );
    }
    const path = `/api/v1/agent-tasks/${taskId}/runs` as `/${string}`;
    try {
      const result = await requestControlPlaneJson(path, {
        ...options,
        method: "POST",
        body: Object.freeze({
          mode: "PREVIEW",
          executionProfileId,
        }),
      });
      const previewed = validateManualRunPreview(
        result.value,
        taskId,
        executionProfileId,
      );
      if (previewed === null) {
        return malformedControlPlaneEnvelope("agent.task.preview", path, [
          taskId,
          executionProfileId,
        ]);
      }
      return createCliEnvelope({
        command: "agent.task.preview",
        arguments: [taskId, executionProfileId],
        state: Object.freeze({
          mode: "PREVIEW" as const,
          ok: true as const,
          controlPlaneUrl: result.baseUrl,
          preview: previewed.preview,
          binding: previewed.binding,
          previewRef: previewed.previewRef,
          providerRequestsStarted: 0 as const,
          modelInvocationsStarted: 0 as const,
          writesStarted: 0 as const,
          runsCreated: 0 as const,
          executionAuthority: false as const,
          researchRunDispatchAuthorityConsumed: false as const,
          providerOrModelWorkMayStart: false as const,
          tradingExecutionAuthority: false as const,
          externalWriteAuthority: false as const,
          valueMovingAuthority: false as const,
          liveExecutionEnabled: false as const,
        }),
        allowedNextActions: Object.freeze([
          previewExecuteCommand(taskId, executionProfileId, previewed.previewRef),
          `agent task inspect ${taskId}`,
          "agent workspace",
          "help",
        ]),
        ok: true,
      });
    } catch (error) {
      return controlPlaneFailure("agent.task.preview", error, [
        taskId,
        executionProfileId,
      ]);
    }
  }

  if (
    namespace === "agent" &&
    action === "task" &&
    venueId === "execute" &&
    extra.length === 4 &&
    extra[0] !== undefined &&
    extra[1] !== undefined &&
    extra[2] !== undefined &&
    extra[3] !== undefined
  ) {
    const taskId = extra[0];
    const executionProfileId = extra[1];
    const previewRef = extra[2];
    const authorizationRef = extra[3];
    const args = [taskId, executionProfileId, previewRef, authorizationRef] as const;
    if (!hashValue(taskId) || !hashValue(executionProfileId) || !hashValue(previewRef)) {
      return invalidIdentityEnvelope(
        "agent.task.execute",
        args,
        !hashValue(taskId)
          ? "task-id"
          : !hashValue(executionProfileId)
            ? "execution-profile-id"
            : "preview-ref",
      );
    }
    if (!authorizationRefValue(authorizationRef)) {
      return invalidAuthorizationEnvelope("agent.task.execute", args);
    }
    const path = `/api/v1/agent-tasks/${taskId}/runs` as `/${string}`;
    try {
      const result = await requestControlPlaneJson(path, {
        ...options,
        method: "POST",
        acceptedStatuses: Object.freeze([200, 202]),
        body: Object.freeze({
          mode: "EXECUTE",
          executionProfileId,
          previewRef,
          authorizationRef,
        }),
      });
      const executed = validateManualRunExecute(
        result.value,
        result.status,
        taskId,
        executionProfileId,
        previewRef,
        authorizationRef,
      );
      if (executed === null) {
        return malformedControlPlaneEnvelope("agent.task.execute", path, args);
      }
      return createCliEnvelope({
        command: "agent.task.execute",
        arguments: args,
        state: Object.freeze({
          ...executed.document,
          controlPlaneUrl: result.baseUrl,
        }),
        allowedNextActions: Object.freeze([
          `agent run inspect ${executed.runId}`,
          "agent workspace",
          "help",
        ]),
        ok: true,
      });
    } catch (error) {
      return controlPlaneFailure("agent.task.execute", error, args);
    }
  }

  if (
    namespace === "agent" &&
    action === "run" &&
    venueId === "inspect" &&
    extra.length === 1 &&
    extra[0] !== undefined
  ) {
    const runId = extra[0];
    if (!hashValue(runId)) {
      return invalidIdentityEnvelope("agent.run.inspect", [runId], "run-id");
    }
    const path = `/api/v1/agent-operator/runs/${runId}` as `/${string}`;
    try {
      const result = await requestControlPlaneJson(path, options);
      const inspected = validateAgentOperatorRun(result.value, runId);
      if (inspected === null) {
        return malformedControlPlaneEnvelope("agent.run.inspect", path, [runId]);
      }
      return createCliEnvelope({
        command: "agent.run.inspect",
        arguments: [runId],
        state: Object.freeze({
          ...inspected.document,
          controlPlaneUrl: result.baseUrl,
        }),
        allowedNextActions: inspected.status === "PREPARED"
          ? Object.freeze([`agent run inspect ${runId}`])
          : Object.freeze([
              `agent task inspect ${inspected.taskId}`,
              "agent workspace",
              "help",
            ]),
        ok: true,
      });
    } catch (error) {
      return controlPlaneFailure("agent.run.inspect", error, [runId]);
    }
  }

  if (namespace === "venue" && action === "list" && venueId === undefined) {
    return createCliEnvelope({
      command: "venue.list",
      arguments: [],
      state: {
        venues: [...venueRegistry.values()]
          .map((manifest) => ({
            venueId: manifest.venueId,
            displayName: manifest.displayName,
            protocolIdentity: manifest.protocolIdentity,
            liveExecutionEnabled: manifest.liveExecutionEnabled,
          }))
          .sort((left, right) => left.venueId.localeCompare(right.venueId)),
      },
      allowedNextActions: ["venue inspect <venue-id>"],
      ok: true,
    });
  }

  if (
    namespace === "venue" &&
    action === "inspect" &&
    venueId !== undefined &&
    extra.length === 0
  ) {
    const manifest = venueRegistry.get(venueId);
    if (manifest === undefined) {
      return createCliEnvelope({
        command: "venue.inspect",
        arguments: [venueId],
        state: null,
        diagnostics: [
          {
            severity: "ERROR",
            code: "VENUE_NOT_FOUND",
            message: `No registered venue has id ${venueId}.`,
          },
        ],
        allowedNextActions: ["venue list"],
        ok: false,
      });
    }
    return createCliEnvelope({
      command: "venue.inspect",
      arguments: [venueId],
      state: manifest,
      allowedNextActions: ["venue list"],
      ok: true,
    });
  }

  return commandNotFound(argv);
}
