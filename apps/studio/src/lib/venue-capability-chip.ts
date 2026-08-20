export type VenueCapabilityChip = Readonly<{
  key: string;
  label: string;
  inert: boolean;
}>;

export function presentVenueCapabilityChip(
  capability: string,
  liveExecutionEnabled: boolean,
): VenueCapabilityChip {
  if (capability === "ORDER_GATEWAY" && liveExecutionEnabled !== true) {
    return {
      key: capability,
      label: "ORDER_GATEWAY · INERT",
      inert: true,
    };
  }
  return {
    key: capability,
    label: capability,
    inert: false,
  };
}

export function presentVenueCapabilityChips(
  capabilities: readonly string[],
  liveExecutionEnabled: boolean,
): readonly VenueCapabilityChip[] {
  return capabilities.map((capability) =>
    presentVenueCapabilityChip(capability, liveExecutionEnabled),
  );
}
