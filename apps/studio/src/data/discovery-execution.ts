import { useCallback, useEffect, useState } from "react";

export type DiscoveryExecutionCapability = Readonly<{
  schemaVersion: "pmh.discovery-execution-capability.v1";
  workloadRoute: Readonly<{
    workloadRouteId: string;
    routeKey: string;
    revision: number;
    taskKind: "DISCOVERY_SCOUT";
    executionProfileId: string;
    automaticDispatch: false;
  }>;
  executionProfile: Readonly<{
    executionProfileId: string;
    profileKey: string;
    revision: number;
    runtimeDefinitionId: string;
    credentialBindingId: string;
    modelProfileId: string;
  }>;
  runtime: Readonly<{
    runtimeDefinitionId: string;
    kind: "PI" | "CODEX" | "HARNESS_IN_PROCESS";
    version: string;
  }>;
  model: Readonly<{
    modelProfileId: string;
    accessDriver: string;
    model: string;
    configuration: unknown;
  }>;
  capability: Readonly<{
    executionProfileId: string;
    configurationStatus: "CONFIGURED" | "MISSING";
    runtimeStatus: "AVAILABLE" | "UNAVAILABLE";
    serviceCapability: "USABLE" | "REJECTED" | "TRANSIENT_FAILURE" | "UNVERIFIED" | "STALE";
    dispatchEligibility: "ELIGIBLE" | "BLOCKED";
    diagnostic: string;
    observation: null | Readonly<{ observedAt: string; validUntil: string }>;
    inferenceRequestsStarted: 0;
    modelInvocationsStarted: 0;
    secretMaterialRetained: false;
  }>;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  credentialSecretTextRetained: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export function parseDiscoveryExecutionCapability(
  value: unknown,
): DiscoveryExecutionCapability {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Discovery execution capability is malformed");
  }
  const candidate = value as DiscoveryExecutionCapability;
  if (
    candidate.schemaVersion !== "pmh.discovery-execution-capability.v1" ||
    candidate.workloadRoute?.taskKind !== "DISCOVERY_SCOUT" ||
    candidate.workloadRoute.executionProfileId !==
      candidate.executionProfile?.executionProfileId ||
    candidate.capability?.executionProfileId !==
      candidate.executionProfile.executionProfileId ||
    candidate.providerRequestsStarted !== 0 ||
    candidate.modelInvocationsStarted !== 0 ||
    candidate.credentialSecretTextRetained !== false ||
    candidate.externalWriteAuthority !== false ||
    candidate.valueMovingAuthority !== false
  ) throw new Error("Discovery execution capability crossed its authority boundary");
  return candidate;
}

async function requestCapability(): Promise<DiscoveryExecutionCapability> {
  const response = await fetch("/api/v1/discovery-execution-capability", {
    headers: { accept: "application/json" },
  });
  const value = await response.json() as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(value.diagnostic ?? `Discovery capability returned HTTP ${response.status}`);
  }
  return parseDiscoveryExecutionCapability(value);
}

export function useDiscoveryExecutionCapability() {
  const [data, setData] = useState<DiscoveryExecutionCapability | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setData(await requestCapability());
      setDiagnostic(null);
    } catch (error) {
      setData(null);
      setDiagnostic(
        error instanceof Error ? error.message : "Discovery execution capability is unavailable",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preflight = useCallback(async (): Promise<void> => {
    if (data === null) return;
    setPreflightBusy(true);
    setDiagnostic(null);
    try {
      const response = await fetch(
        `/api/v1/execution-profiles/${data.executionProfile.executionProfileId}/preflight`,
        { method: "POST", headers: { accept: "application/json" } },
      );
      const result = await response.json() as { ok?: boolean; diagnostic?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.diagnostic ?? `Capability preflight returned HTTP ${response.status}`);
      }
      await refresh();
    } catch (error) {
      setData(null);
      setDiagnostic(error instanceof Error ? error.message : "Capability preflight failed");
    } finally {
      setPreflightBusy(false);
    }
  }, [data, refresh]);

  return Object.freeze({ data, diagnostic, preflightBusy, refresh, preflight });
}
