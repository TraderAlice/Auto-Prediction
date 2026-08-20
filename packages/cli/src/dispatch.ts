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

function malformedControlPlaneEnvelope(
  command: string,
  path: string,
): CliEnvelope {
  return createCliEnvelope({
    command,
    arguments: [],
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
): CliEnvelope {
  const diagnostic = error instanceof ControlPlaneRequestError
    ? error
    : new ControlPlaneRequestError(
      "CONTROL_PLANE_UNREACHABLE",
      error instanceof Error ? error.message : "Control-plane request failed.",
    );
  return createCliEnvelope({
    command,
    arguments: [],
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
