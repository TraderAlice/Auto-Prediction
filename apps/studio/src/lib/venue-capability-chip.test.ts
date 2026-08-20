import { describe, expect, it } from "vitest";
import { presentVenueCapabilityChip } from "./venue-capability-chip.js";

describe("Markets venue capability chips", () => {
  it("marks ORDER_GATEWAY as inert coverage when live execution is disabled", () => {
    expect(presentVenueCapabilityChip("ORDER_GATEWAY", false)).toEqual({
      key: "ORDER_GATEWAY",
      label: "ORDER_GATEWAY · INERT",
      inert: true,
    });
  });

  it("does not restyle catalog coverage as an order surface", () => {
    expect(presentVenueCapabilityChip("MARKET_CATALOG", false)).toEqual({
      key: "MARKET_CATALOG",
      label: "MARKET_CATALOG",
      inert: false,
    });
  });
});
