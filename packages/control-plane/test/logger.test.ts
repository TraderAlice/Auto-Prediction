import { describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.js";

const fixedNow = () => new Date("2026-10-22T03:00:00.000Z");

describe("createLogger", () => {
  it("writes one JSON line per event with name, time and fields", () => {
    const lines: string[] = [];
    const log = createLogger("probe", { sink: (line) => lines.push(line), now: fixedNow });

    log.info("capability probe finished", { outcome: "USABLE", runtime: "CODEX" });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      level: "info",
      time: "2026-10-22T03:00:00.000Z",
      name: "probe",
      message: "capability probe finished",
      fields: { outcome: "USABLE", runtime: "CODEX" },
    });
  });

  it("drops events below the configured level", () => {
    const lines: string[] = [];
    const log = createLogger("probe", { level: "warn", sink: (line) => lines.push(line), now: fixedNow });

    log.debug("hidden");
    log.info("hidden");
    log.warn("shown");
    log.error("shown too");

    expect(lines.map((line) => JSON.parse(line).message)).toEqual(["shown", "shown too"]);
  });

  it("defaults fields to an empty object", () => {
    const lines: string[] = [];
    const log = createLogger("probe", { sink: (line) => lines.push(line), now: fixedNow });

    log.error("plain");

    expect(JSON.parse(lines[0]!).fields).toEqual({});
  });
});
