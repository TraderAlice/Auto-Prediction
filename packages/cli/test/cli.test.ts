import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_SCHEMA_VERSION, runCli } from "../src/index.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))
  ));
});

async function serve(
  handler: Parameters<typeof createServer>[0],
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("test server did not bind a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

function json(
  response: Parameters<NonNullable<Parameters<typeof createServer>[0]>>[1],
  value: unknown,
  status = 200,
) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

describe("versioned CLI envelope", () => {
  it("discovers the exact command surface without a running control plane", async () => {
    const result = await runCli([]);
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.identity.command).toBe("help");
    expect(result.state).toMatchObject({
      product: "Auto Prediction",
      interface: "pmh.cli.v1",
    });
    expect(result.allowedNextActions).toContain("agent workspace");
  });

  it("reports the system's Node 22 baseline and live-disabled boundary", async () => {
    const result = await runCli(["system", "status"]);
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
    expect(result.state).toMatchObject({ runtimeTarget: { node: ">=22.19" } });
    expect(result.artifacts[0]?.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("reads startup readiness from a local control plane", async () => {
    const baseUrl = await serve((_request, response) => json(response, {
      schemaVersion: "pmh.startup-readiness.v1",
      status: "READY",
      phase: "READY",
      elapsedMs: 42,
      phaseElapsedMs: 3,
      currentReconciliationStep: null,
      diagnostic: null,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    }));

    const result = await runCli(["control", "status"], { baseUrl });
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      status: "READY",
      controlPlaneUrl: baseUrl,
      workspaceResource: "/api/v1/agent-workspace/routing",
    });
    expect(result.allowedNextActions).toContain("agent workspace");
  });

  it("compresses the Agent workspace into bounded routing state", async () => {
    const baseUrl = await serve((request, response) => {
      expect(request.url).toBe("/api/v1/agent-workspace/routing");
      json(response, {
        schemaVersion: "pmh.agent-operator-workspace.v1",
        execution: {
          schemaVersion: "pmh.agent-execution-registry.v1",
          runtimeDefinitionCount: 3,
          executionProfileCount: 2,
          taskCount: 7,
          runCount: 5,
          activeCampaignCount: 1,
          capabilityObservationCount: 2,
          capabilityOutcomeCounts: { USABLE: 1, REJECTED: 1 },
          credentialSecretTextRetained: false,
        },
        attention: {
          schemaVersion: "pmh.research-attention-allocation.v1",
          projectionIdentity: "sha256:attention",
          familyCount: 4,
          actionableFamilyCount: 1,
          heldFamilyCount: 3,
          laneCounts: { exploration: 1 },
          nextWork: [{
            actionId: "sha256:action",
            lane: "EXPLORATION",
            kind: "RUN",
            taskId: "sha256:task",
            valueStage: "DISCOVERY",
            dispatchableByRelationCampaign: true,
          }],
          nextWorkTruncated: false,
        },
        targets: {
          schemaVersion: "pmh.research-action-target-projection.v1",
          targetCount: 8,
          readyCount: 2,
          inFlightCount: 1,
          blockedNegativeSearchCount: 3,
          unresolvedCount: 2,
          nextTargets: [{
            targetId: "sha256:target",
            allocationActionId: "sha256:action",
            state: "READY_RELATION_DISCOVERY",
            downstreamSystem: "RELATION_DISCOVERY",
            sourceTaskId: "sha256:task",
            currentJobId: null,
            manualOperation: {
              available: true,
              kind: "RELATION_DISCOVERY_TASK",
              targetId: "sha256:task",
            },
            diagnostic: "ready",
          }],
          nextTargetsTruncated: true,
        },
        relationCampaign: {
          schemaVersion: "pmh.relation-discovery-campaign-preview.v1",
          campaignKey: "relation",
          taskIds: ["sha256:task"],
          creationEligible: true,
          dispatchEligible: false,
          diagnostic: "paused",
        },
        discoveryCycle: {
          schemaVersion: "pmh.discovery-cycle.v1",
          enabled: true,
          intervalMs: 60_000,
          tickCount: 9,
          lastCompletedAt: "2026-08-20T00:00:00.000Z",
          lastDiagnostic: null,
        },
        providerRequestsStartedByRead: 0,
        modelInvocationsStartedByRead: 0,
        writesStartedByRead: 0,
        automaticDispatch: false,
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      });
    });

    const result = await runCli(["agent", "workspace"], { baseUrl });
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      schemaVersion: "pmh.agent-operator-workspace.v1",
      execution: {
        taskCount: 7,
        capabilityOutcomeCounts: { USABLE: 1, REJECTED: 1 },
      },
      attention: {
        actionableFamilyCount: 1,
        nextWork: [{ actionId: "sha256:action", taskId: "sha256:task" }],
      },
      targets: {
        readyCount: 2,
        nextTargets: [{ targetId: "sha256:target", state: "READY_RELATION_DISCOVERY" }],
      },
    });
  });

  it("returns stable recovery diagnostics for an unreachable control plane", async () => {
    const result = await runCli(["control", "status"], {
      baseUrl: "http://127.0.0.1:4100",
      fetchImpl: async () => {
        throw new TypeError("connection refused");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_UNREACHABLE");
    expect(result.allowedNextActions).toEqual(["control status", "help"]);
  });

  it("distinguishes timeout from connection failure", async () => {
    const baseUrl = await serve(() => {
      // Deliberately retain the request until the client aborts it.
    });
    const result = await runCli(["control", "status"], {
      baseUrl,
      timeoutMs: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_TIMEOUT");
  });

  it("retains an HTTP failure as a stable diagnostic", async () => {
    const baseUrl = await serve((_request, response) => json(
      response,
      { ok: false, diagnostic: "workspace unavailable" },
      503,
    ));
    const result = await runCli(["agent", "workspace"], { baseUrl });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "CONTROL_PLANE_HTTP_ERROR",
      message: expect.stringContaining("workspace unavailable"),
    });
  });

  it("rejects non-JSON control-plane content", async () => {
    const baseUrl = await serve((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html>not the control plane</html>");
    });
    const result = await runCli(["agent", "workspace"], { baseUrl });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "CONTROL_PLANE_MALFORMED_RESPONSE",
    );
  });

  it("rejects incompatible workspace JSON instead of guessing", async () => {
    const baseUrl = await serve((_request, response) => json(response, {
      schemaVersion: "unexpected",
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    }));
    const result = await runCli(["agent", "workspace"], { baseUrl });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "CONTROL_PLANE_MALFORMED_RESPONSE",
    );
  });

  it("inspects validated venue capability evidence", async () => {
    const result = await runCli(["venue", "inspect", "polymarket-global"]);
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      venueId: "polymarket-global",
      liveExecutionEnabled: false,
    });
  });

  it("fails closed for unknown venues and commands", async () => {
    const missingVenue = await runCli(["venue", "inspect", "unknown"]);
    expect(missingVenue.ok).toBe(false);
    expect(missingVenue.diagnostics[0]?.code).toBe("VENUE_NOT_FOUND");

    const unknownCommand = await runCli(["order", "submit"]);
    expect(unknownCommand.ok).toBe(false);
    expect(unknownCommand.diagnostics[0]?.code).toBe(
      "CLI_COMMAND_NOT_FOUND",
    );
    expect(unknownCommand.effects.valueMovingActions).toBe(false);
  });
});
