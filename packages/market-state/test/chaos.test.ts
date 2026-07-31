import { describe, expect, it } from "vitest";
import { runReplayChaosSuite } from "../src/index.js";

describe("replay chaos qualification", () => {
  it("fails closed on every required replay hazard", () => {
    const report = runReplayChaosSuite();
    expect(report.status).toBe("PASS");
    expect(report.passCount).toBe(6);
    expect(report.cases.map((item) => item.caseId)).toEqual([
      "SEQUENCE_GAP",
      "STALE_MARK",
      "RECONNECT_WITHOUT_SNAPSHOT",
      "OFF_TICK_DELTA",
      "TICK_SIZE_CHANGE",
      "GENERATION_MISMATCH",
    ]);
    expect(report.cases.every((item) => item.passed)).toBe(true);
    expect(new Set(report.cases.map((item) => item.evidenceHash)).size).toBe(6);
    expect(report.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
  });

  it("replays to the same content identity", () => {
    expect(runReplayChaosSuite()).toEqual(runReplayChaosSuite());
    expect(runReplayChaosSuite().suiteHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
