import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOVERY_CYCLE_INTERVAL_MS,
  parseDiscoveryCycleInterval,
} from "../src/index.js";

describe("persistent discovery cycle configuration", () => {
  it("defaults to a bounded provider-free wake-up cadence", () => {
    expect(parseDiscoveryCycleInterval({})).toBe(DEFAULT_DISCOVERY_CYCLE_INTERVAL_MS);
    expect(parseDiscoveryCycleInterval({ PMH_DISCOVERY_CYCLE_INTERVAL_MS: "60000" }))
      .toBe(60_000);
  });

  it("can be disabled and rejects unsafe timer values", () => {
    expect(parseDiscoveryCycleInterval({ PMH_DISCOVERY_CYCLE_INTERVAL_MS: "0" }))
      .toBeNull();
    expect(() => parseDiscoveryCycleInterval({
      PMH_DISCOVERY_CYCLE_INTERVAL_MS: "999",
    })).toThrow(/PMH_DISCOVERY_CYCLE_INTERVAL_MS/);
    expect(() => parseDiscoveryCycleInterval({
      PMH_DISCOVERY_CYCLE_INTERVAL_MS: "not-a-number",
    })).toThrow(/PMH_DISCOVERY_CYCLE_INTERVAL_MS/);
  });
});
