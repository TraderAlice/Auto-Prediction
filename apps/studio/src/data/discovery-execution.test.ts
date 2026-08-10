import { describe, expect, it } from "vitest";

import { parseDiscoveryExecutionCapability } from "./discovery-execution";

const capability = {
  schemaVersion: "pmh.discovery-execution-capability.v1",
  workloadRoute: {
    workloadRouteId: "route-1",
    routeKey: "discovery",
    revision: 3,
    taskKind: "DISCOVERY_SCOUT",
    executionProfileId: "profile-1",
    automaticDispatch: false,
  },
  executionProfile: {
    executionProfileId: "profile-1",
    profileKey: "in-process-terra",
    revision: 2,
    runtimeDefinitionId: "runtime-1",
    credentialBindingId: "credential-1",
    modelProfileId: "model-1",
  },
  runtime: {
    runtimeDefinitionId: "runtime-1",
    kind: "HARNESS_IN_PROCESS",
    version: "1",
  },
  model: {
    modelProfileId: "model-1",
    accessDriver: "OPENAI_CODEX_OAUTH",
    model: "gpt-5.6-terra",
    configuration: { reasoningEffort: "high" },
  },
  capability: {
    executionProfileId: "profile-1",
    configurationStatus: "CONFIGURED",
    runtimeStatus: "AVAILABLE",
    serviceCapability: "REJECTED",
    dispatchEligibility: "BLOCKED",
    diagnostic: "preflight returned HTTP 403",
    observation: {
      observedAt: "2026-08-11T00:00:00.000Z",
      validUntil: "2026-08-11T00:05:00.000Z",
    },
    inferenceRequestsStarted: 0,
    modelInvocationsStarted: 0,
    secretMaterialRetained: false,
  },
  providerRequestsStarted: 0,
  modelInvocationsStarted: 0,
  credentialSecretTextRetained: false,
  externalWriteAuthority: false,
  valueMovingAuthority: false,
} as const;

describe("parseDiscoveryExecutionCapability", () => {
  it("accepts one bounded discovery capability projection", () => {
    expect(parseDiscoveryExecutionCapability(capability)).toEqual(capability);
  });

  it("rejects mismatched route identity", () => {
    expect(() => parseDiscoveryExecutionCapability({
      ...capability,
      workloadRoute: { ...capability.workloadRoute, executionProfileId: "profile-2" },
    })).toThrow(/authority boundary/);
  });

  it("rejects a projection that spent model capacity", () => {
    expect(() => parseDiscoveryExecutionCapability({
      ...capability,
      providerRequestsStarted: 1,
    })).toThrow(/authority boundary/);
  });
});
