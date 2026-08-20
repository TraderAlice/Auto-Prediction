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
  if (
    document?.ok !== true ||
    document.run !== undefined ||
    preview === null ||
    task?.schemaVersion !== "pmh.agent-task.v1" ||
    task.taskId !== taskId ||
    executionProfile?.schemaVersion !== "pmh.execution-profile.v1" ||
    executionProfile.executionProfileId !== executionProfileId ||
    preview.providerRequestsStarted !== 0 ||
    document.providerRequestsStarted !== 0 ||
    document.modelInvocationsStarted !== 0 ||
    document.writesStarted !== 0 ||
    document.runsCreated !== 0 ||
    document.executionAuthority !== false ||
    document.externalWriteAuthority !== false ||
    document.valueMovingAuthority !== false ||
    authority?.modelInvocations !== false ||
    authority.externalWrites !== false ||
    authority.semanticDecision !== false ||
    authority.certificatePublication !== false ||
    authority.valueMovingActions !== false ||
    document.mode !== "PREVIEW"
  ) return null;
  return Object.freeze({ document, preview, task, executionProfile });
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
          providerRequestsStarted: 0 as const,
          modelInvocationsStarted: 0 as const,
          writesStarted: 0 as const,
          runsCreated: 0 as const,
          executionAuthority: false as const,
          externalWriteAuthority: false as const,
          valueMovingAuthority: false as const,
        }),
        allowedNextActions: Object.freeze([
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
