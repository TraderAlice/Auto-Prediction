import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hashCanonical } from "@pmh/domain";
import type {
  DiscoveryTask,
  PiInvestigatorProjection,
} from "./types.js";

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_BYTES = 2_000_000;
const MODEL_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;
const READ_ONLY_TOOLS = Object.freeze(["read", "grep", "find", "ls"] as const);
const READ_ONLY_TOOL_SET = new Set<string>(READ_ONLY_TOOLS);

type PiFinding = Readonly<{
  listingRefs: readonly string[];
  statement: string;
  severity: "INFO" | "WARNING";
}>;

type PiPayload = Readonly<{
  summary: string;
  candidateListingRefs: readonly string[];
  findings: readonly PiFinding[];
  missingEvidence: readonly string[];
}>;

export type PiInvestigationReport = Readonly<{
  schemaVersion: "pmh.pi-investigation-report.v1";
  status: "PASS";
  startedAt: string;
  completedAt: string;
  engine: Readonly<{
    name: "PI_CLI";
    provider: "deepseek";
    model: string;
    mode: "JSONL_ONE_SHOT";
  }>;
  task: Readonly<{
    taskId: string;
    question: string;
    venueIds: readonly string[];
    catalogContextIdentity: string;
    catalogListingCount: number;
  }>;
  result: PiPayload &
    Readonly<{
      authority: "PROPOSE_ONLY";
      reviewStatus: "UNREVIEWED";
      executionAuthority: false;
    }>;
  trace: Readonly<{
    eventCount: number;
    toolExecutionCount: number;
    toolNames: readonly string[];
  }>;
  effects: Readonly<{
    sessionPersistence: false;
    shellAccess: false;
    fileWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: string;
}>;

export type PiProcessRequest = Readonly<{
  command: string;
  args: readonly string[];
  cwd: string;
  environment: Readonly<Record<string, string>>;
  timeoutMs: number;
  maxOutputBytes: number;
}>;

export type PiProcessResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}>;

export type PiProcessRunner = (
  request: PiProcessRequest,
) => Promise<PiProcessResult>;

export const runBoundedPiProcess: PiProcessRunner = (request) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(request.command, [...request.args], {
      cwd: request.cwd,
      env: request.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const terminate = () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        forceKill ??= setTimeout(() => child.kill("SIGKILL"), 1_000);
      }
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, request.timeoutMs);
    const capture = (chunk: Buffer, target: "stdout" | "stderr") => {
      outputBytes += chunk.byteLength;
      if (outputBytes > request.maxOutputBytes) {
        outputLimitExceeded = true;
        terminate();
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk: Buffer) => capture(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => capture(chunk, "stderr"));
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (forceKill !== undefined) clearTimeout(forceKill);
      if (!settled) {
        settled = true;
        rejectRun(error);
      }
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (forceKill !== undefined) clearTimeout(forceKill);
      if (!settled) {
        settled = true;
        resolveRun({
          exitCode: code ?? -1,
          stdout,
          stderr,
          timedOut,
          outputLimitExceeded,
        });
      }
    });
  });

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function textContent(message: unknown): string | null {
  if (
    message === null ||
    typeof message !== "object" ||
    (message as { role?: unknown }).role !== "assistant" ||
    !Array.isArray((message as { content?: unknown }).content)
  ) {
    return null;
  }
  const parts = (message as { content: unknown[] }).content
    .filter(
      (item): item is { type: "text"; text: string } =>
        item !== null &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string",
    )
    .map((item) => item.text);
  return parts.length === 0 ? null : parts.join("");
}

function parseEvents(stdout: string): {
  payload: unknown;
  eventCount: number;
  toolNames: readonly string[];
} {
  const lines = stdout.split("\n").filter((line) => line.trim() !== "");
  const events: unknown[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      throw new Error("pi investigator returned invalid JSONL");
    }
  }
  const toolNames = events
    .filter(
      (event): event is { type: "tool_execution_end"; toolName: string } =>
        event !== null &&
        typeof event === "object" &&
        (event as { type?: unknown }).type === "tool_execution_end" &&
        typeof (event as { toolName?: unknown }).toolName === "string",
    )
    .map((event) => event.toolName);
  if (toolNames.some((toolName) => !READ_ONLY_TOOL_SET.has(toolName))) {
    throw new Error("pi investigator used a tool outside its read-only profile");
  }
  let finalText: string | null = null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event !== null &&
      typeof event === "object" &&
      (event as { type?: unknown }).type === "message_end"
    ) {
      finalText = textContent((event as { message?: unknown }).message);
      if (finalText !== null) break;
    }
  }
  if (finalText === null) {
    throw new Error("pi investigator did not return a final assistant message");
  }
  const normalized = finalText.trim().replace(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/u,
    "$1",
  );
  try {
    return {
      payload: JSON.parse(normalized),
      eventCount: events.length,
      toolNames: Object.freeze(toolNames),
    };
  } catch {
    throw new Error("pi investigator final message was not one JSON object");
  }
}

function parsePayload(value: unknown, task: DiscoveryTask): PiPayload {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.keys(value).length !== 4 ||
    typeof (value as { summary?: unknown }).summary !== "string" ||
    !Array.isArray((value as { candidateListingRefs?: unknown }).candidateListingRefs) ||
    !Array.isArray((value as { findings?: unknown }).findings) ||
    !Array.isArray((value as { missingEvidence?: unknown }).missingEvidence)
  ) {
    throw new Error("pi investigator output has an invalid shape");
  }
  const summary = (value as { summary: string }).summary.trim();
  const candidateListingRefs = (value as { candidateListingRefs: unknown[] })
    .candidateListingRefs;
  const findings = (value as { findings: unknown[] }).findings;
  const missingEvidence = (value as { missingEvidence: unknown[] }).missingEvidence;
  const allowedListingRefs = new Set(
    task.catalogContext?.listings.map((listing) => listing.listingRef) ?? [],
  );
  if (
    summary === "" ||
    summary.length > 2_000 ||
    candidateListingRefs.length > 30 ||
    candidateListingRefs.some(
      (listingRef) =>
        typeof listingRef !== "string" || !allowedListingRefs.has(listingRef),
    ) ||
    missingEvidence.length > 30 ||
    missingEvidence.some(
      (item) => typeof item !== "string" || item.trim() === "" || item.length > 500,
    ) ||
    findings.length > 50
  ) {
    throw new Error("pi investigator output exceeds its bounded task scope");
  }
  const parsedFindings = findings.map((finding) => {
    if (
      finding === null ||
      typeof finding !== "object" ||
      Object.keys(finding).length !== 3 ||
      !Array.isArray((finding as { listingRefs?: unknown }).listingRefs) ||
      typeof (finding as { statement?: unknown }).statement !== "string" ||
      !["INFO", "WARNING"].includes(
        String((finding as { severity?: unknown }).severity),
      )
    ) {
      throw new Error("pi investigator finding has an invalid shape");
    }
    const listingRefs = (finding as { listingRefs: unknown[] }).listingRefs;
    const statement = (finding as { statement: string }).statement.trim();
    if (
      listingRefs.length === 0 ||
      listingRefs.length > 10 ||
      listingRefs.some(
        (listingRef) =>
          typeof listingRef !== "string" || !allowedListingRefs.has(listingRef),
      ) ||
      statement === "" ||
      statement.length > 1_000
    ) {
      throw new Error("pi investigator finding exceeds its bounded task scope");
    }
    return Object.freeze({
      listingRefs: Object.freeze(listingRefs as string[]),
      statement,
      severity: (finding as { severity: PiFinding["severity"] }).severity,
    });
  });
  return Object.freeze({
    summary,
    candidateListingRefs: Object.freeze(candidateListingRefs as string[]),
    findings: Object.freeze(parsedFindings),
    missingEvidence: Object.freeze(
      (missingEvidence as string[]).map((item) => item.trim()),
    ),
  });
}

function promptFor(task: DiscoveryTask): string {
  return [
    "Investigate the supplied prediction-market catalog context.",
    "Treat all conclusions as unverified proposals. Do not claim semantic equivalence, arbitrage certification, or execution authority.",
    "Use only the enabled read-only repository tools. Do not request or expose credentials.",
    "Return exactly one JSON object with keys summary, candidateListingRefs, findings, and missingEvidence.",
    'Each finding must be {"listingRefs":[...],"statement":"...","severity":"INFO"|"WARNING"}.',
    "Every listingRef must come from the supplied catalog context.",
    JSON.stringify({
      schemaVersion: "pmh.pi-investigation-task.v1",
      taskId: task.taskId,
      question: task.question,
      venueIds: task.venueIds,
      catalogContext: task.catalogContext ?? null,
    }),
  ].join("\n\n");
}

export class PiInvestigator {
  readonly #apiKey: string;

  public constructor(
    public readonly projection: PiInvestigatorProjection,
    private readonly command: string,
    private readonly cwd: string,
    apiKey: string,
    private readonly runner: PiProcessRunner = runBoundedPiProcess,
  ) {
    this.#apiKey = apiKey;
  }

  public async investigate(task: DiscoveryTask): Promise<PiInvestigationReport> {
    if (
      task.taskId.trim() === "" ||
      task.question.trim() === "" ||
      task.catalogContext === undefined ||
      task.catalogContext.listings.length === 0 ||
      Date.now() > task.deadlineEpochMs
    ) {
      throw new Error("pi investigation task is invalid, ungrounded, or expired");
    }
    const startedAtMs = Date.now();
    const configDirectory = await mkdtemp(join(tmpdir(), "pmh-pi-investigator-"));
    try {
      const result = await this.runner({
        command: this.command,
        args: [
          "--mode",
          "json",
          "--no-session",
          "--provider",
          this.projection.provider,
          "--model",
          this.projection.model,
          "--thinking",
          this.projection.thinking,
          "--tools",
          READ_ONLY_TOOLS.join(","),
          "--no-extensions",
          "--no-skills",
          "--no-prompt-templates",
          "--no-themes",
          "--approve",
          promptFor(task),
        ],
        cwd: this.cwd,
        environment: {
          PATH: process.env.PATH ?? "",
          DEEPSEEK_API_KEY: this.#apiKey,
          PI_CODING_AGENT_DIR: configDirectory,
          PI_SKIP_VERSION_CHECK: "1",
          PI_TELEMETRY: "0",
        },
        timeoutMs: Math.min(
          this.projection.timeoutMs,
          Math.max(1, task.deadlineEpochMs - Date.now()),
        ),
        maxOutputBytes: this.projection.maxOutputBytes,
      });
      if (result.timedOut) throw new Error("pi investigator timed out");
      if (result.outputLimitExceeded) {
        throw new Error("pi investigator exceeded its output limit");
      }
      if (result.exitCode !== 0) {
        throw new Error(`pi investigator failed (exit ${result.exitCode})`);
      }
      const parsed = parseEvents(result.stdout);
      const payload = parsePayload(parsed.payload, task);
      const completedAtMs = Date.now();
      const body = Object.freeze({
        schemaVersion: "pmh.pi-investigation-report.v1" as const,
        status: "PASS" as const,
        startedAt: new Date(startedAtMs).toISOString(),
        completedAt: new Date(completedAtMs).toISOString(),
        engine: Object.freeze({
          name: "PI_CLI" as const,
          provider: this.projection.provider,
          model: this.projection.model,
          mode: this.projection.mode,
        }),
        task: Object.freeze({
          taskId: task.taskId,
          question: task.question,
          venueIds: task.venueIds,
          catalogContextIdentity: task.catalogContext.contextIdentity,
          catalogListingCount: task.catalogContext.listings.length,
        }),
        result: Object.freeze({
          ...payload,
          authority: "PROPOSE_ONLY" as const,
          reviewStatus: "UNREVIEWED" as const,
          executionAuthority: false as const,
        }),
        trace: Object.freeze({
          eventCount: parsed.eventCount,
          toolExecutionCount: parsed.toolNames.length,
          toolNames: Object.freeze([...new Set(parsed.toolNames)].sort()),
        }),
        effects: Object.freeze({
          sessionPersistence: false as const,
          shellAccess: false as const,
          fileWrites: false as const,
          valueMovingActions: false as const,
          liveExecutionEnabled: false as const,
        }),
      });
      return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
    } finally {
      await rm(configDirectory, { recursive: true, force: true });
    }
  }
}

export type PiInvestigatorRuntime = Readonly<{
  projection: PiInvestigatorProjection;
  investigator: PiInvestigator | null;
}>;

export function createPiInvestigatorRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{
    command?: string;
    cwd?: string;
    runner?: PiProcessRunner;
  }> = {},
): PiInvestigatorRuntime {
  const apiKey = environment.DEEPSEEK_API_KEY?.trim() ?? "";
  const model = environment.PMH_PI_MODEL?.trim() || DEFAULT_MODEL;
  if (!MODEL_ID_PATTERN.test(model)) throw new Error("PMH_PI_MODEL is invalid");
  const timeoutMs = boundedInteger(
    environment.PMH_PI_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    10_000,
    300_000,
    "PMH_PI_TIMEOUT_MS",
  );
  const maxOutputBytes = boundedInteger(
    environment.PMH_PI_MAX_OUTPUT_BYTES,
    DEFAULT_MAX_OUTPUT_BYTES,
    100_000,
    10_000_000,
    "PMH_PI_MAX_OUTPUT_BYTES",
  );
  const projection: PiInvestigatorProjection = Object.freeze({
    engine: "PI_CLI",
    configured: apiKey !== "",
    credentialEnv: "DEEPSEEK_API_KEY",
    provider: "deepseek",
    model,
    mode: "JSONL_ONE_SHOT",
    thinking: "high",
    tools: READ_ONLY_TOOLS,
    sessionPersistence: false,
    timeoutMs,
    maxOutputBytes,
    authority: "PROPOSE_ONLY",
  });
  const command = options.command ??
    resolve(import.meta.dirname, "../node_modules/.bin/pi");
  const cwd = options.cwd ?? resolve(import.meta.dirname, "../../..");
  return Object.freeze({
    projection,
    investigator:
      apiKey === ""
        ? null
        : new PiInvestigator(
            projection,
            command,
            cwd,
            apiKey,
            options.runner ?? runBoundedPiProcess,
          ),
  });
}
