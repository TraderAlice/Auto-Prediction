import { createCliEnvelope, type CliEnvelope } from "./envelope.js";
import { venueRegistry } from "./registry.js";

const SUPPORTED_COMMANDS = [
  "system status",
  "venue list",
  "venue inspect <venue-id>",
] as const;

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

export function runCli(argv: readonly string[]): CliEnvelope {
  const [namespace, action, venueId, ...extra] = argv;

  if (namespace === "system" && action === "status" && venueId === undefined) {
    const venues = [...venueRegistry.values()];
    return createCliEnvelope({
      command: "system.status",
      arguments: [],
      state: {
        lifecycle: "PRE_ALPHA",
        venueAdapterCount: venues.length,
        implementedCapabilities: venues.reduce(
          (total, venue) =>
            total +
            venue.capabilities.filter((capability) => capability.implemented)
              .length,
          0,
        ),
        liveExecutionEnabled: false,
        runtimeTarget: {
          node: ">=24",
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
      allowedNextActions: ["venue list", "venue inspect <venue-id>"],
      ok: true,
    });
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
