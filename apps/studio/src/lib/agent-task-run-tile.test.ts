import { describe, expect, it } from "vitest";
import { agentTaskRunTile } from "./agent-task-run-tile.js";

describe("agentTaskRunTile", () => {
  it("puts retained tasks in the headline and names the other two counts", () => {
    expect(agentTaskRunTile({
      taskCount: 150,
      runCount: 0,
      runnableCount: 128,
    })).toEqual({
      label: "Tasks",
      value: "150",
      detail: "128 runnable · 0 runs",
    });
  });

  it("does not put a slash pair in the value so idle desks do not look stalled", () => {
    const tile = agentTaskRunTile({
      taskCount: 150,
      runCount: 0,
      runnableCount: 128,
    });
    expect(tile.value.includes("/")).toBe(false);
  });
});
