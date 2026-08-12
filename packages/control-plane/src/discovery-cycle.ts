export const DEFAULT_DISCOVERY_CYCLE_INTERVAL_MS = 60_000;

export type DiscoveryCycleProjection = Readonly<{
  schemaVersion: "pmh.discovery-cycle.v1";
  enabled: boolean;
  intervalMs: number | null;
  tickCount: number;
  membershipChangeCount: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastMembershipChanged: boolean | null;
  lastDiagnostic: string | null;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  campaignActivationAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export function parseDiscoveryCycleInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_DISCOVERY_CYCLE_INTERVAL_MS?.trim();
  if (raw === "0") return null;
  if (raw === undefined || raw === "") return DEFAULT_DISCOVERY_CYCLE_INTERVAL_MS;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 86_400_000) {
    throw new Error(
      "PMH_DISCOVERY_CYCLE_INTERVAL_MS must be 0 or an integer from 1000 to 86400000",
    );
  }
  return value;
}
