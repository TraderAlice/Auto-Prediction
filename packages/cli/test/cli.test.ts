import { describe, expect, it } from "vitest";
import { CLI_SCHEMA_VERSION, runCli } from "../src/index.js";

describe("versioned CLI envelope", () => {
  it("reports the system's pre-alpha and live-disabled boundary", () => {
    const result = runCli(["system", "status"]);
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
    expect(result.artifacts[0]?.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("inspects validated venue capability evidence", () => {
    const result = runCli(["venue", "inspect", "polymarket-global"]);
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      venueId: "polymarket-global",
      liveExecutionEnabled: false,
    });
  });

  it("fails closed for unknown venues and commands", () => {
    const missingVenue = runCli(["venue", "inspect", "unknown"]);
    expect(missingVenue.ok).toBe(false);
    expect(missingVenue.diagnostics[0]?.code).toBe("VENUE_NOT_FOUND");

    const unknownCommand = runCli(["order", "submit"]);
    expect(unknownCommand.ok).toBe(false);
    expect(unknownCommand.diagnostics[0]?.code).toBe(
      "CLI_COMMAND_NOT_FOUND",
    );
    expect(unknownCommand.effects.valueMovingActions).toBe(false);
  });
});
