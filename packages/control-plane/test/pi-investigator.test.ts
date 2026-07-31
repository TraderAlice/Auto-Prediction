import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  createPiInvestigatorRuntime,
  runBoundedPiProcess,
  runPiInvestigatorSmoke,
  type DiscoveryTask,
  type PiProcessRequest,
  type PiProcessRunner,
} from "../src/index.js";

const secret = "test-only-deepseek-key";
const listingRef = "gemini-predictions:BOSTON-TEMP-2026-07-31";

function task(): DiscoveryTask {
  return {
    taskId: "task:pi-investigator:test",
    question: "Compare the Boston temperature ranges",
    venueIds: ["gemini-predictions"],
    maxHypotheses: 3,
    deadlineEpochMs: Date.now() + 30_000,
    catalogContext: {
      schemaVersion: "pmh.discovery-catalog-context.v1",
      source: "VERIFIED_FIXTURE_CATALOGS",
      contextIdentity: hashCanonical({ fixture: "pi-investigator-test" }),
      listings: [
        {
          listingRef,
          venueId: "gemini-predictions",
          venueInstrumentId: "BOSTON-TEMP-2026-07-31",
          title: "Highest temperature in Boston on July 31, 2026?",
          description: "Range market",
          status: "OPEN",
          mechanism: "CLOB",
          closesAt: "2026-08-01T00:00:00.000Z",
          rulesText: "Resolves from the named weather station.",
          outcomes: [{ label: "80-84 F", indicativePrice: "0.40" }],
          sourceFixtureHash: hashCanonical({ fixture: "gemini-catalog" }),
          protocolIdentity: hashCanonical({ protocol: "gemini-test" }),
        },
      ],
    },
  };
}

function jsonl(payload: unknown, toolName = "read"): string {
  return [
    JSON.stringify({ type: "session", version: 3 }),
    JSON.stringify({ type: "tool_execution_end", toolName }),
    JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify(payload) }],
      },
    }),
  ].join("\n");
}

const validPayload = {
  summary: "One fixture-backed range market is available for review.",
  candidateListingRefs: [listingRef],
  findings: [
    {
      listingRefs: [listingRef],
      statement: "The listing is a temperature range contract.",
      severity: "INFO",
    },
  ],
  missingEvidence: ["No second venue listing is present in this task context."],
} as const;

describe("pi investigator", () => {
  it("fails closed without a DeepSeek credential", async () => {
    const runtime = createPiInvestigatorRuntime({});
    expect(runtime.investigator).toBeNull();
    expect(runtime.projection).toMatchObject({
      configured: false,
      credentialEnv: "DEEPSEEK_API_KEY",
      model: "deepseek-v4-flash",
      tools: ["read", "grep", "find", "ls"],
      sessionPersistence: false,
      authority: "PROPOSE_ONLY",
    });
    await expect(runPiInvestigatorSmoke({ environment: {} })).rejects.toThrow(
      "DEEPSEEK_API_KEY is required",
    );
  });

  it("runs pi once in an isolated read-only profile and reconstructs authority", async () => {
    let captured: PiProcessRequest | undefined;
    const runner: PiProcessRunner = async (request) => {
      captured = request;
      return {
        exitCode: 0,
        stdout: jsonl(validPayload),
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      };
    };
    const runtime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: secret },
      { command: "/test/pi", cwd: "/test/repository", runner },
    );
    const report = await runtime.investigator?.investigate(task());

    expect(captured).toBeDefined();
    expect(captured?.command).toBe("/test/pi");
    expect(captured?.cwd).toBe("/test/repository");
    expect(captured?.args).toContain("--no-session");
    expect(captured?.args).toContain("--no-extensions");
    expect(captured?.args).toContain("--no-skills");
    expect(captured?.args).toContain("read,grep,find,ls");
    expect(captured?.args.join(" ")).not.toMatch(/\b(?:bash|edit|write)\b/u);
    expect(captured?.environment).toEqual({
      PATH: process.env.PATH ?? "",
      DEEPSEEK_API_KEY: secret,
      PI_CODING_AGENT_DIR: expect.stringContaining("pmh-pi-investigator-"),
      PI_SKIP_VERSION_CHECK: "1",
      PI_TELEMETRY: "0",
    });
    await expect(
      access(captured?.environment.PI_CODING_AGENT_DIR ?? ""),
    ).rejects.toThrow();
    expect(report).toMatchObject({
      schemaVersion: "pmh.pi-investigation-report.v1",
      status: "PASS",
      result: {
        candidateListingRefs: [listingRef],
        authority: "PROPOSE_ONLY",
        reviewStatus: "UNREVIEWED",
        executionAuthority: false,
      },
      effects: {
        sessionPersistence: false,
        shellAccess: false,
        fileWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(JSON.stringify(report)).not.toContain(secret);
    const { artifactHash, ...body } = report!;
    expect(artifactHash).toBe(hashCanonical(body));
  });

  it("rejects tools and listing references outside the bounded task", async () => {
    const withOutput = (stdout: string): PiProcessRunner => async () => ({
      exitCode: 0,
      stdout,
      stderr: "",
      timedOut: false,
      outputLimitExceeded: false,
    });
    const toolRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: secret },
      { runner: withOutput(jsonl(validPayload, "bash")) },
    );
    await expect(toolRuntime.investigator?.investigate(task())).rejects.toThrow(
      "outside its read-only profile",
    );

    const scopeRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: secret },
      {
        runner: withOutput(
          jsonl({
            ...validPayload,
            candidateListingRefs: ["polymarket-global:not-in-context"],
          }),
        ),
      },
    );
    await expect(scopeRuntime.investigator?.investigate(task())).rejects.toThrow(
      "bounded task scope",
    );
  });

  it("bounds subprocess output and never surfaces provider stderr", async () => {
    const runtime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: secret },
      {
        runner: async () => ({
          exitCode: 23,
          stdout: "",
          stderr: `upstream rejected ${secret}`,
          timedOut: false,
          outputLimitExceeded: false,
        }),
      },
    );
    let diagnostic = "";
    try {
      await runtime.investigator?.investigate(task());
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error);
    }
    expect(diagnostic).toBe("pi investigator failed (exit 23)");
    expect(diagnostic).not.toContain(secret);

    const result = await runBoundedPiProcess({
      command: process.execPath,
      args: ["-e", "process.stdout.write('bounded-ok')"],
      cwd: process.cwd(),
      environment: { PATH: process.env.PATH ?? "" },
      timeoutMs: 5_000,
      maxOutputBytes: 1_000,
    });
    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "bounded-ok",
      timedOut: false,
      outputLimitExceeded: false,
    });
  });
});
