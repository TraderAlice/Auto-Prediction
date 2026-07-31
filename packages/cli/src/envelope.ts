import { hashCanonical, type Hash } from "@pmh/domain";

export const CLI_SCHEMA_VERSION = "pmh.cli.v1" as const;

export type CliDiagnostic = Readonly<{
  severity: "INFO" | "WARNING" | "ERROR";
  code: string;
  message: string;
}>;

export type CliEnvelope<TState = unknown> = Readonly<{
  schemaVersion: typeof CLI_SCHEMA_VERSION;
  identity: Readonly<{
    command: string;
    arguments: readonly string[];
  }>;
  state: TState | null;
  diagnostics: readonly CliDiagnostic[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifacts: readonly Readonly<{
    kind: "STATE_SNAPSHOT";
    contentHash: Hash;
  }>[];
  allowedNextActions: readonly string[];
  ok: boolean;
}>;

export function createCliEnvelope<TState>(input: {
  command: string;
  arguments: readonly string[];
  state: TState | null;
  diagnostics?: readonly CliDiagnostic[];
  allowedNextActions?: readonly string[];
  ok: boolean;
}): CliEnvelope<TState> {
  const diagnostics = input.diagnostics ?? [];
  const allowedNextActions = input.allowedNextActions ?? [];
  return Object.freeze({
    schemaVersion: CLI_SCHEMA_VERSION,
    identity: Object.freeze({
      command: input.command,
      arguments: Object.freeze([...input.arguments]),
    }),
    state: input.state,
    diagnostics: Object.freeze([...diagnostics]),
    effects: Object.freeze({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    }),
    artifacts:
      input.state === null
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              kind: "STATE_SNAPSHOT" as const,
              contentHash: hashCanonical(input.state),
            }),
          ]),
    allowedNextActions: Object.freeze([...allowedNextActions]),
    ok: input.ok,
  });
}
