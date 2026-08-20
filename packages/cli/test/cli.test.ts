import { createServer, type IncomingMessage, type Server } from "node:http";
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

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const TARGET_ID = `sha256:${"1".repeat(64)}`;
const TASK_ID = `sha256:${"2".repeat(64)}`;
const PROFILE_ID = `sha256:${"3".repeat(64)}`;
const OTHER_ID = `sha256:${"a".repeat(64)}`;
const TASK_PAYLOAD_HASH = `sha256:${"5".repeat(64)}`;
const PREVIEW_REF = `sha256:${"6".repeat(64)}`;
const RUN_ID = `sha256:${"7".repeat(64)}`;
const OTHER_RUN_ID = `sha256:${"8".repeat(64)}`;
const AUTH_REF = `external-agent:${PREVIEW_REF}`;
const EXECUTE_COMMAND =
  `agent task execute ${TASK_ID} ${PROFILE_ID} ${PREVIEW_REF} ${AUTH_REF}`;

const OPERATOR_READ_EFFECTS = Object.freeze({
  providerRequestsStartedByRead: 0,
  modelInvocationsStartedByRead: 0,
  fetchesStartedByRead: 0,
  writesStartedByRead: 0,
  runsCreatedByRead: 0,
  automaticDispatch: false,
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  externalWriteAuthority: false,
  valueMovingAuthority: false,
});

const TASK_AUTHORITY = Object.freeze({
  modelInvocations: false,
  externalWrites: false,
  semanticDecision: false,
  certificatePublication: false,
  valueMovingActions: false,
});

function operatorTarget(targetId: string) {
  return {
    schemaVersion: "pmh.agent-operator-target.v1",
    target: {
      schemaVersion: "pmh.research-action-target.v1",
      targetId,
      allocationActionId: `sha256:${"4".repeat(64)}`,
      allocationActionKind: "EXPLORE_NEW_FAMILY",
      sourceTaskId: TASK_ID,
      state: "READY_RELATION_DISCOVERY",
      diagnostic: "ready",
      automaticDispatch: false,
      modelInvocationAuthority: false,
      providerRequestAuthority: false,
      fetchAuthority: false,
      campaignAuthority: false,
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
      manualOperation: {
        available: true,
        kind: "RELATION_DISCOVERY_TASK",
        targetId: TASK_ID,
      },
    },
    allocationAction: {
      schemaVersion: "pmh.research-attention-allocation-action.v2",
      actionId: `sha256:${"4".repeat(64)}`,
      kind: "EXPLORE_NEW_FAMILY",
      modelInvocationAuthority: false,
      campaignAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    },
    ...OPERATOR_READ_EFFECTS,
  };
}

function operatorTask(taskId: string, profileId = PROFILE_ID) {
  return {
    schemaVersion: "pmh.agent-operator-task.v1",
    task: {
      schemaVersion: "pmh.agent-task.v1",
      taskId,
      kind: "RELATION_DISCOVERY",
      authority: TASK_AUTHORITY,
    },
    readiness: { status: "RUNNABLE", diagnostic: "current", successorTaskId: null },
    compatibleExecutionProfiles: [{
      executionProfileId: profileId,
      profileKey: "relation-discovery-codex-app-server",
      automaticDispatch: false,
    }],
    runs: [],
    runsTruncated: false,
    ...OPERATOR_READ_EFFECTS,
  };
}

const RUN_BUDGET = Object.freeze({
  maximumModelInvocations: 12,
  maximumToolCalls: 32,
  maximumWallClockMs: 300_000,
  maximumInputTokens: "300000",
  maximumOutputTokens: "30000",
});

function previewDocument(taskId: string, executionProfileId: string, previewRef = PREVIEW_REF) {
  return {
    ok: true,
    mode: "PREVIEW",
    preview: {
      task: {
        schemaVersion: "pmh.agent-task.v1",
        taskId,
        taskPayloadHash: TASK_PAYLOAD_HASH,
        kind: "RELATION_DISCOVERY",
        authority: TASK_AUTHORITY,
      },
      executionProfile: {
        schemaVersion: "pmh.execution-profile.v1",
        executionProfileId,
        profileKey: "relation-discovery-codex-app-server",
        revision: 2,
      },
      nextRunOrdinal: 1,
      maximumModelInvocations: 12,
      providerRequestsStarted: 0,
    },
    binding: {
      schemaVersion: "pmh.agent-manual-run-preview-binding.v1",
      previewRef,
      taskId,
      taskPayloadHash: TASK_PAYLOAD_HASH,
      executionProfileId,
      executionProfileRevision: 2,
      nextRunOrdinal: 1,
      runBudget: RUN_BUDGET,
    },
    providerRequestsStarted: 0,
    modelInvocationsStarted: 0,
    writesStarted: 0,
    runsCreated: 0,
    executionAuthority: false,
    researchRunDispatchAuthorityConsumed: false,
    providerOrModelWorkMayStart: false,
    tradingExecutionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
    liveExecutionEnabled: false,
  };
}

function manualRun(runId: string, taskId: string, executionProfileId: string, status = "PREPARED") {
  return {
    schemaVersion: "pmh.agent-run.v1",
    runId,
    taskId,
    executionProfileId,
    runOrdinal: 1,
    status,
    authorization: {
      kind: "MANUAL",
      authorizationRef: AUTH_REF,
      campaignId: null,
      authorizedAt: "2026-08-20T15:00:00.000Z",
    },
    createdAt: "2026-08-20T15:00:00.000Z",
    completedAt: status === "PREPARED" ? null : "2026-08-20T15:01:00.000Z",
    terminalDiagnostic: status === "PREPARED" ? null : "fixture",
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  };
}

function executeDocument(input: {
  reused: boolean;
  runId?: string;
  taskId?: string;
  executionProfileId?: string;
  previewRef?: string;
  executionAuthority?: boolean;
}) {
  const reused = input.reused;
  const taskId = input.taskId ?? TASK_ID;
  const executionProfileId = input.executionProfileId ?? PROFILE_ID;
  const previewRef = input.previewRef ?? PREVIEW_REF;
  return {
    ok: true,
    mode: "EXECUTE",
    reused,
    run: manualRun(input.runId ?? RUN_ID, taskId, executionProfileId),
    previewRef,
    ...(reused
      ? {}
      : {
          binding: previewDocument(taskId, executionProfileId, previewRef).binding,
          preview: previewDocument(taskId, executionProfileId, previewRef).preview,
        }),
    dispatchStartedByRequest: !reused,
    runCreatedByRequest: !reused,
    executionAuthority: input.executionAuthority ?? !reused,
    researchRunDispatchAuthorityConsumed: !reused,
    providerOrModelWorkMayStart: !reused,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    tradingExecutionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
    liveExecutionEnabled: false,
  };
}

function operatorRun(
  runId: string,
  status = "PREPARED",
  leakedRunId?: string,
  schemaVersion = "pmh.agent-operator-run.v1",
) {
  return {
    schemaVersion,
    run: manualRun(runId, TASK_ID, PROFILE_ID, status),
    task: {
      taskId: TASK_ID,
      kind: "RELATION_DISCOVERY",
      taskPayloadHash: TASK_PAYLOAD_HASH,
      protocol: "RELATION_DISCOVERY_TASK_V4",
    },
    executionProfile: {
      executionProfileId: PROFILE_ID,
      profileKey: "relation-discovery-codex-app-server",
      revision: 2,
    },
    modelInvocations: [],
    modelInvocationCount: 0,
    modelInvocationsTruncated: false,
    toolEffects: [],
    toolEffectCount: 0,
    toolEffectsTruncated: false,
    artifacts: [],
    artifactCount: 0,
    artifactsTruncated: false,
    annotations: leakedRunId === undefined
      ? []
      : [{ runId: leakedRunId, annotationId: OTHER_ID, category: "LEAK" }],
    annotationCount: leakedRunId === undefined ? 0 : 1,
    annotationsTruncated: false,
    resultSelections: [],
    resultSelectionCount: 0,
    resultSelectionsTruncated: false,
    ...OPERATOR_READ_EFFECTS,
    tradingExecutionAuthority: false,
    liveExecutionEnabled: false,
  };
}

function operatorRunWait(
  runId: string,
  status: string,
  waitMs: number,
  waitOutcome: "COMPLETED" | "TIMEOUT" | "ALREADY_TERMINAL" |
    "NOT_AWAITABLE_IN_THIS_PROCESS",
) {
  return {
    ...operatorRun(runId, status, undefined, "pmh.agent-operator-run-wait.v1"),
    waitMs,
    waitedMs: waitOutcome === "ALREADY_TERMINAL" ? 0 : waitMs,
    waitOutcome,
    awaitedInProcess: waitOutcome === "COMPLETED" || waitOutcome === "TIMEOUT",
    researchRunDispatchAuthorityConsumed: false,
    providerOrModelWorkMayStart: false,
  };
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
    expect(result.allowedNextActions).toContain("agent target inspect <target-id>");
    expect(result.allowedNextActions).toContain("agent task inspect <task-id>");
    expect(result.allowedNextActions).toContain(
      "agent task preview <task-id> <execution-profile-id>",
    );
    expect(result.allowedNextActions).toContain(
      "agent task execute <task-id> <execution-profile-id> <preview-ref> <authorization-ref>",
    );
    expect(result.allowedNextActions).toContain("agent run inspect <run-id>");
    expect(result.allowedNextActions).toContain("agent run wait <run-id> [wait-ms]");
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

  it("inspects one research-action target and fills the linked task command", async () => {
    const baseUrl = await serve((request, response) => {
      expect(request.method).toBe("GET");
      expect(request.url).toBe(`/api/v1/agent-operator/targets/${TARGET_ID}`);
      json(response, operatorTarget(TARGET_ID));
    });
    const result = await runCli(
      ["agent", "target", "inspect", TARGET_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.identity).toEqual({
      command: "agent.target.inspect",
      arguments: [TARGET_ID],
    });
    expect(result.state).toMatchObject({
      schemaVersion: "pmh.agent-operator-target.v1",
      target: { targetId: TARGET_ID },
      providerRequestsStartedByRead: 0,
      executionAuthority: false,
      valueMovingAuthority: false,
    });
    expect(result.allowedNextActions).toEqual([
      `agent task inspect ${TASK_ID}`,
      "agent workspace",
      "help",
    ]);
    expect(result.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
  });

  it("rejects a target inspect whose identity does not match the request", async () => {
    const baseUrl = await serve((_request, response) =>
      json(response, operatorTarget(OTHER_ID))
    );
    const result = await runCli(
      ["agent", "target", "inspect", TARGET_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("rejects malformed exact identities before contacting the control plane", async () => {
    let requested = false;
    const result = await runCli(
      ["agent", "target", "inspect", "../readiness"],
      {
        fetchImpl: async () => {
          requested = true;
          throw new Error("must not request");
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "CLI_ARGUMENT_INVALID",
      message: "target-id must be an exact sha256 identity.",
    });
    expect(requested).toBe(false);
  });

  it("retains a target 404 as a stable HTTP diagnostic", async () => {
    const baseUrl = await serve((request, response) => {
      expect(request.url).toBe(`/api/v1/agent-operator/targets/${TARGET_ID}`);
      json(response, {
        ok: false,
        diagnostic: `research-action target ${TARGET_ID} was not found`,
      }, 404);
    });
    const result = await runCli(
      ["agent", "target", "inspect", TARGET_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "CONTROL_PLANE_HTTP_ERROR",
      message: expect.stringContaining(
        `research-action target ${TARGET_ID} was not found`,
      ),
    });
  });

  it("inspects one Agent task and fills exact preview commands", async () => {
    const baseUrl = await serve((request, response) => {
      expect(request.method).toBe("GET");
      expect(request.url).toBe(`/api/v1/agent-operator/tasks/${TASK_ID}`);
      json(response, operatorTask(TASK_ID));
    });
    const result = await runCli(
      ["agent", "task", "inspect", TASK_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.identity.command).toBe("agent.task.inspect");
    expect(result.state).toMatchObject({
      schemaVersion: "pmh.agent-operator-task.v1",
      task: { taskId: TASK_ID },
      compatibleExecutionProfiles: [{
        executionProfileId: PROFILE_ID,
        automaticDispatch: false,
      }],
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      writesStartedByRead: 0,
    });
    expect(result.allowedNextActions).toEqual([
      `agent task preview ${TASK_ID} ${PROFILE_ID}`,
      "agent workspace",
      "help",
    ]);
  });

  it("does not advertise preview for a non-runnable Agent task", async () => {
    const baseUrl = await serve((_request, response) => json(response, {
      ...operatorTask(TASK_ID),
      readiness: {
        status: "HISTORICAL_ONLY",
        diagnostic: "task is retained evidence only",
        successorTaskId: null,
      },
    }));
    const result = await runCli(
      ["agent", "task", "inspect", TASK_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.allowedNextActions).toEqual(["agent workspace", "help"]);
  });

  it("rejects a task inspect whose identity does not match the request", async () => {
    const baseUrl = await serve((_request, response) =>
      json(response, operatorTask(OTHER_ID))
    );
    const result = await runCli(
      ["agent", "task", "inspect", TASK_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("retains a task 404 as a stable HTTP diagnostic", async () => {
    const baseUrl = await serve((_request, response) => json(response, {
      ok: false,
      diagnostic: `Agent task ${TASK_ID} was not found`,
    }, 404));
    const result = await runCli(
      ["agent", "task", "inspect", TASK_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "CONTROL_PLANE_HTTP_ERROR",
      message: expect.stringContaining(`Agent task ${TASK_ID} was not found`),
    });
  });

  it("previews a manual run without execute authority or a created run", async () => {
    const baseUrl = await serve(async (request, response) => {
      expect(request.method).toBe("POST");
      expect(request.url).toBe(`/api/v1/agent-tasks/${TASK_ID}/runs`);
      expect(await readJsonBody(request)).toEqual({
        mode: "PREVIEW",
        executionProfileId: PROFILE_ID,
      });
      json(response, previewDocument(TASK_ID, PROFILE_ID));
    });
    const result = await runCli(
      ["agent", "task", "preview", TASK_ID, PROFILE_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.identity).toEqual({
      command: "agent.task.preview",
      arguments: [TASK_ID, PROFILE_ID],
    });
    expect(result.state).toMatchObject({
      mode: "PREVIEW",
      preview: {
        task: { taskId: TASK_ID, taskPayloadHash: TASK_PAYLOAD_HASH },
        executionProfile: { executionProfileId: PROFILE_ID },
        providerRequestsStarted: 0,
      },
      binding: {
        schemaVersion: "pmh.agent-manual-run-preview-binding.v1",
        previewRef: PREVIEW_REF,
        taskId: TASK_ID,
        executionProfileId: PROFILE_ID,
      },
      previewRef: PREVIEW_REF,
      providerRequestsStarted: 0,
      modelInvocationsStarted: 0,
      writesStarted: 0,
      runsCreated: 0,
      executionAuthority: false,
      researchRunDispatchAuthorityConsumed: false,
      providerOrModelWorkMayStart: false,
      tradingExecutionAuthority: false,
      liveExecutionEnabled: false,
    });
    expect(result.state).not.toHaveProperty("run");
    expect(result.allowedNextActions).toEqual([
      EXECUTE_COMMAND,
      `agent task inspect ${TASK_ID}`,
      "agent workspace",
      "help",
    ]);
    expect(result.effects.liveExecutionEnabled).toBe(false);
  });

  it("rejects a preview whose returned identities do not match the request", async () => {
    const baseUrl = await serve(async (request, response) => {
      await readJsonBody(request);
      json(response, previewDocument(OTHER_ID, PROFILE_ID));
    });
    const result = await runCli(
      ["agent", "task", "preview", TASK_ID, PROFILE_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("retains a preview 404 as a stable HTTP diagnostic", async () => {
    const baseUrl = await serve(async (request, response) => {
      expect(await readJsonBody(request)).toMatchObject({ mode: "PREVIEW" });
      json(response, {
        ok: false,
        diagnostic: "Agent task is unavailable",
      }, 404);
    });
    const result = await runCli(
      ["agent", "task", "preview", TASK_ID, PROFILE_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "CONTROL_PLANE_HTTP_ERROR",
      message: expect.stringContaining("Agent task is unavailable"),
    });
  });

  it("rejects a preview whose binding identities do not match the request", async () => {
    const baseUrl = await serve(async (request, response) => {
      await readJsonBody(request);
      json(response, previewDocument(TASK_ID, OTHER_ID));
    });
    const result = await runCli(
      ["agent", "task", "preview", TASK_ID, PROFILE_ID],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("executes a preview-bound research run without trading authority", async () => {
    const baseUrl = await serve(async (request, response) => {
      expect(request.method).toBe("POST");
      expect(request.url).toBe(`/api/v1/agent-tasks/${TASK_ID}/runs`);
      expect(await readJsonBody(request)).toEqual({
        mode: "EXECUTE",
        executionProfileId: PROFILE_ID,
        previewRef: PREVIEW_REF,
        authorizationRef: AUTH_REF,
      });
      json(response, executeDocument({ reused: false }), 202);
    });
    const result = await runCli(
      ["agent", "task", "execute", TASK_ID, PROFILE_ID, PREVIEW_REF, AUTH_REF],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.identity.command).toBe("agent.task.execute");
    expect(result.state).toMatchObject({
      reused: false,
      run: { runId: RUN_ID, taskId: TASK_ID },
      previewRef: PREVIEW_REF,
      dispatchStartedByRequest: true,
      runCreatedByRequest: true,
      executionAuthority: true,
      researchRunDispatchAuthorityConsumed: true,
      providerOrModelWorkMayStart: true,
      tradingExecutionAuthority: false,
      liveExecutionEnabled: false,
    });
    expect(result.allowedNextActions).toEqual([
      `agent run wait ${RUN_ID}`,
      `agent run inspect ${RUN_ID}`,
      "agent workspace",
      "help",
    ]);
    expect(result.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
  });

  it("reuses an idempotent execute without dispatching another run", async () => {
    const baseUrl = await serve(async (request, response) => {
      expect(await readJsonBody(request)).toMatchObject({
        mode: "EXECUTE",
        previewRef: PREVIEW_REF,
        authorizationRef: AUTH_REF,
      });
      json(response, executeDocument({ reused: true }), 200);
    });
    const result = await runCli(
      ["agent", "task", "execute", TASK_ID, PROFILE_ID, PREVIEW_REF, AUTH_REF],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      reused: true,
      run: { runId: RUN_ID },
      previewRef: PREVIEW_REF,
      dispatchStartedByRequest: false,
      runCreatedByRequest: false,
      executionAuthority: false,
      researchRunDispatchAuthorityConsumed: false,
      providerOrModelWorkMayStart: false,
      tradingExecutionAuthority: false,
    });
    expect(result.allowedNextActions[0]).toBe(`agent run wait ${RUN_ID}`);
    expect(result.effects.liveExecutionEnabled).toBe(false);
  });

  it("rejects execute responses that mix research-run and trading authority", async () => {
    const baseUrl = await serve(async (request, response) => {
      await readJsonBody(request);
      json(response, {
        ...executeDocument({ reused: true, executionAuthority: true }),
      }, 200);
    });
    const result = await runCli(
      ["agent", "task", "execute", TASK_ID, PROFILE_ID, PREVIEW_REF, AUTH_REF],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("rejects an execute whose returned run identity does not match the request", async () => {
    const baseUrl = await serve(async (request, response) => {
      await readJsonBody(request);
      json(response, executeDocument({ reused: false, taskId: OTHER_ID }), 202);
    });
    const result = await runCli(
      ["agent", "task", "execute", TASK_ID, PROFILE_ID, PREVIEW_REF, AUTH_REF],
      { baseUrl },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("inspects a PREPARED run with a polling next action", async () => {
    const baseUrl = await serve((request, response) => {
      expect(request.method).toBe("GET");
      expect(request.url).toBe(`/api/v1/agent-operator/runs/${RUN_ID}`);
      json(response, operatorRun(RUN_ID, "PREPARED"));
    });
    const result = await runCli(["agent", "run", "inspect", RUN_ID], { baseUrl });
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      schemaVersion: "pmh.agent-operator-run.v1",
      run: { runId: RUN_ID, status: "PREPARED" },
      task: { taskId: TASK_ID },
      executionProfile: { executionProfileId: PROFILE_ID },
      modelInvocationCount: 0,
      annotationsTruncated: false,
      providerRequestsStartedByRead: 0,
      tradingExecutionAuthority: false,
      liveExecutionEnabled: false,
    });
    expect(result.allowedNextActions).toEqual([
      `agent run wait ${RUN_ID}`,
      `agent run inspect ${RUN_ID}`,
    ]);
  });

  it("inspects a terminal run and returns exact task inspect next actions", async () => {
    const baseUrl = await serve((_request, response) =>
      json(response, operatorRun(RUN_ID, "FAILED"))
    );
    const result = await runCli(["agent", "run", "inspect", RUN_ID], { baseUrl });
    expect(result.ok).toBe(true);
    expect(result.allowedNextActions).toEqual([
      `agent task inspect ${TASK_ID}`,
      "agent workspace",
      "help",
    ]);
  });

  it("waits for a run with a bounded server-side wait and returns terminal actions", async () => {
    const baseUrl = await serve((request, response) => {
      expect(request.method).toBe("GET");
      expect(request.url).toBe(
        `/api/v1/agent-operator/runs/${RUN_ID}/wait?waitMs=1250`,
      );
      json(response, operatorRunWait(RUN_ID, "SUCCEEDED", 1250, "COMPLETED"));
    });
    const result = await runCli(
      ["agent", "run", "wait", RUN_ID, "1250"],
      { baseUrl },
    );
    expect(result.ok).toBe(true);
    expect(result.identity).toEqual({
      command: "agent.run.wait",
      arguments: [RUN_ID, "1250"],
    });
    expect(result.state).toMatchObject({
      schemaVersion: "pmh.agent-operator-run-wait.v1",
      run: { runId: RUN_ID, status: "SUCCEEDED" },
      waitMs: 1250,
      waitOutcome: "COMPLETED",
      awaitedInProcess: true,
      researchRunDispatchAuthorityConsumed: false,
      providerOrModelWorkMayStart: false,
      tradingExecutionAuthority: false,
      liveExecutionEnabled: false,
    });
    expect(result.allowedNextActions).toEqual([
      `agent task inspect ${TASK_ID}`,
      "agent workspace",
      "help",
    ]);
  });

  it("returns an exact wait action after timeout but never fakes a detached wait", async () => {
    const timeoutUrl = await serve((_request, response) =>
      json(response, operatorRunWait(RUN_ID, "PREPARED", 250, "TIMEOUT"))
    );
    const timedOut = await runCli(
      ["agent", "run", "wait", RUN_ID, "250"],
      { baseUrl: timeoutUrl },
    );
    expect(timedOut.ok).toBe(true);
    expect(timedOut.allowedNextActions).toEqual([
      `agent run wait ${RUN_ID} 250`,
      `agent run inspect ${RUN_ID}`,
    ]);

    const detachedUrl = await serve((_request, response) =>
      json(response, operatorRunWait(
        RUN_ID,
        "PREPARED",
        30_000,
        "NOT_AWAITABLE_IN_THIS_PROCESS",
      ))
    );
    const detached = await runCli(
      ["agent", "run", "wait", RUN_ID],
      { baseUrl: detachedUrl },
    );
    expect(detached.ok).toBe(true);
    expect(detached.allowedNextActions).toEqual([`agent run inspect ${RUN_ID}`]);
  });

  it("rejects a run inspect that leaks another run's records", async () => {
    const baseUrl = await serve((_request, response) =>
      json(response, operatorRun(RUN_ID, "PREPARED", OTHER_RUN_ID))
    );
    const result = await runCli(["agent", "run", "inspect", RUN_ID], { baseUrl });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("CONTROL_PLANE_MALFORMED_RESPONSE");
  });

  it("rejects malformed execute and run identities without HTTP", async () => {
    let requested = false;
    const host = {
      fetchImpl: async () => {
        requested = true;
        throw new Error("must not request");
      },
    };
    const badHash = await runCli(
      ["agent", "task", "execute", "not-a-hash", PROFILE_ID, PREVIEW_REF, AUTH_REF],
      host,
    );
    expect(badHash.ok).toBe(false);
    expect(badHash.diagnostics[0]).toMatchObject({
      code: "CLI_ARGUMENT_INVALID",
      message: "task-id must be an exact sha256 identity.",
    });
    const blankAuth = await runCli(
      ["agent", "task", "execute", TASK_ID, PROFILE_ID, PREVIEW_REF, "  "],
      host,
    );
    expect(blankAuth.diagnostics[0]).toMatchObject({
      code: "CLI_ARGUMENT_INVALID",
      message: "authorization-ref must be a bounded nonblank identifier.",
    });
    const badRun = await runCli(["agent", "run", "inspect", "../runs"], host);
    expect(badRun.diagnostics[0]).toMatchObject({
      code: "CLI_ARGUMENT_INVALID",
      message: "run-id must be an exact sha256 identity.",
    });
    const badWait = await runCli(
      ["agent", "run", "wait", RUN_ID, "60001"],
      host,
    );
    expect(badWait.diagnostics[0]).toMatchObject({
      code: "CLI_ARGUMENT_INVALID",
      message: "wait-ms must be an integer from 1 to 60000.",
    });
    expect(requested).toBe(false);
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
