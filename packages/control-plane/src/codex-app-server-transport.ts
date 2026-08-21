import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_OUTPUT_BYTES = 8_000_000;

export type CodexAppServerRequestId = string | number;

export type CodexAppServerInbound = Readonly<{
  method: string;
  id?: CodexAppServerRequestId;
  params?: unknown;
}>;

export interface CodexAppServerConnection {
  request(method: string, params: unknown, timeoutMs?: number): Promise<unknown>;
  notify(method: string, params?: unknown): void;
  respond(id: CodexAppServerRequestId, result: unknown): void;
  nextInbound(timeoutMs?: number): Promise<CodexAppServerInbound>;
  close(): Promise<void>;
}

export type CodexAppServerConnectionFactory = () => Promise<CodexAppServerConnection>;

type PendingRequest = Readonly<{
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>;

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < minimum || selected > maximum) {
    throw new Error("Codex app-server process bound is invalid");
  }
  return selected;
}

function processEnvironment(
  input: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> {
  const allowed = [
    "PATH",
    "HOME",
    "CODEX_HOME",
    "TMPDIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ] as const;
  return Object.freeze(Object.fromEntries(allowed.flatMap((key) => {
    const value = input[key];
    return value === undefined ? [] : [[key, value]];
  })));
}

function messageObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Codex app-server emitted a non-object JSONL message");
  }
  return value as Record<string, unknown>;
}

function boundedProtocolError(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "unknown app-server error";
  }
  const error = value as Readonly<Record<string, unknown>>;
  const code = typeof error.code === "number" || typeof error.code === "string"
    ? String(error.code).slice(0, 80)
    : "unknown";
  const message = typeof error.message === "string"
    ? error.message.replace(/\s+/gu, " ").slice(0, 700)
    : "no diagnostic message";
  return `code=${code}; message=${message}`;
}

class ProcessCodexAppServerConnection implements CodexAppServerConnection {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #pending = new Map<CodexAppServerRequestId, PendingRequest>();
  readonly #inbound: CodexAppServerInbound[] = [];
  readonly #inboundWaiters: Array<Readonly<{
    resolve: (value: CodexAppServerInbound) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>> = [];
  readonly #maxOutputBytes: number;
  #nextRequestId = 1;
  #stdoutBuffer = "";
  #retainedOutputBytes = 0;
  #closed = false;
  #terminalError: Error | null = null;

  public constructor(input: Readonly<{
    command: string;
    args: readonly string[];
    cwd: string;
    environment: Readonly<Record<string, string | undefined>>;
    maxOutputBytes: number;
  }>) {
    this.#maxOutputBytes = input.maxOutputBytes;
    this.#child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      env: processEnvironment(input.environment),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child.stdout.on("data", (chunk: Buffer) => this.#consumeStdout(chunk));
    this.#child.stderr.on("data", (chunk: Buffer) => this.#consumeBytes(chunk));
    this.#child.once("error", (error) => this.#fail(
      error instanceof Error ? error : new Error("Codex app-server process failed"),
    ));
    this.#child.once("close", (code) => {
      if (!this.#closed) {
        this.#fail(new Error(`Codex app-server exited unexpectedly (${code ?? -1})`));
      }
    });
  }

  #consumeBytes(chunk: Buffer): boolean {
    this.#retainedOutputBytes += chunk.byteLength;
    if (this.#retainedOutputBytes <= this.#maxOutputBytes) return true;
    this.#fail(new Error("Codex app-server output bound exceeded"));
    return false;
  }

  #consumeStdout(chunk: Buffer): void {
    if (!this.#consumeBytes(chunk) || this.#closed) return;
    this.#stdoutBuffer += chunk.toString("utf8");
    let newline = this.#stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.#stdoutBuffer.slice(0, newline).trim();
      this.#stdoutBuffer = this.#stdoutBuffer.slice(newline + 1);
      if (line !== "") {
        try {
          this.#consumeMessage(messageObject(JSON.parse(line)));
        } catch (error) {
          this.#fail(error instanceof Error
            ? error
            : new Error("Codex app-server JSONL parse failed"));
          return;
        }
      }
      newline = this.#stdoutBuffer.indexOf("\n");
    }
  }

  #consumeMessage(message: Record<string, unknown>): void {
    if (message.id !== undefined && message.method === undefined) {
      const id = message.id as CodexAppServerRequestId;
      const pending = this.#pending.get(id);
      if (pending === undefined) throw new Error("Codex app-server response ID is unknown");
      clearTimeout(pending.timeout);
      this.#pending.delete(id);
      if (message.error !== undefined) {
        pending.reject(new Error(
          `Codex app-server request returned an error: ${boundedProtocolError(message.error)}`,
        ));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (typeof message.method !== "string") {
      throw new Error("Codex app-server message has no method");
    }
    const inbound = Object.freeze({
      method: message.method,
      ...(message.id === undefined ? {} : {
        id: message.id as CodexAppServerRequestId,
      }),
      ...(message.params === undefined ? {} : { params: message.params }),
    });
    const waiter = this.#inboundWaiters.shift();
    if (waiter === undefined) this.#inbound.push(inbound);
    else {
      clearTimeout(waiter.timeout);
      waiter.resolve(inbound);
    }
  }

  #write(value: unknown): void {
    if (this.#terminalError !== null) throw this.#terminalError;
    if (this.#closed || !this.#child.stdin.writable) {
      throw new Error("Codex app-server connection is closed");
    }
    this.#child.stdin.write(`${JSON.stringify(value)}\n`);
  }

  #fail(error: Error): void {
    if (this.#terminalError !== null) return;
    this.#terminalError = error;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.#pending.clear();
    for (const waiter of this.#inboundWaiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    if (!this.#child.killed) this.#child.kill("SIGTERM");
  }

  public request(
    method: string,
    params: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    const id = this.#nextRequestId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        rejectRequest(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);
      this.#pending.set(id, Object.freeze({
        resolve: resolveRequest,
        reject: rejectRequest,
        timeout,
      }));
      try {
        this.#write({ method, id, params });
      } catch (error) {
        clearTimeout(timeout);
        this.#pending.delete(id);
        rejectRequest(error instanceof Error
          ? error
          : new Error("Codex app-server request write failed"));
      }
    });
  }

  public notify(method: string, params?: unknown): void {
    this.#write({ method, ...(params === undefined ? {} : { params }) });
  }

  public respond(id: CodexAppServerRequestId, result: unknown): void {
    this.#write({ id, result });
  }

  public nextInbound(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<CodexAppServerInbound> {
    const next = this.#inbound.shift();
    if (next !== undefined) return Promise.resolve(next);
    if (this.#terminalError !== null) return Promise.reject(this.#terminalError);
    return new Promise((resolveInbound, rejectInbound) => {
      const timeout = setTimeout(() => {
        const index = this.#inboundWaiters.findIndex((item) => item.resolve === resolveInbound);
        if (index >= 0) this.#inboundWaiters.splice(index, 1);
        rejectInbound(new Error("Codex app-server event wait timed out"));
      }, timeoutMs);
      this.#inboundWaiters.push(Object.freeze({
        resolve: resolveInbound,
        reject: rejectInbound,
        timeout,
      }));
    });
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Codex app-server connection closed"));
    }
    this.#pending.clear();
    for (const waiter of this.#inboundWaiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Codex app-server connection closed"));
    }
    if (!this.#child.killed) this.#child.kill("SIGTERM");
    await new Promise<void>((resolveClose) => {
      if (this.#child.exitCode !== null || this.#child.signalCode !== null) resolveClose();
      else {
        const force = setTimeout(() => {
          if (this.#child.exitCode === null && this.#child.signalCode === null) {
            this.#child.kill("SIGKILL");
          }
          resolveClose();
        }, 1_000);
        this.#child.once("close", () => {
          clearTimeout(force);
          resolveClose();
        });
      }
    });
  }
}

export function createCodexAppServerConnectionFactory(input: Readonly<{
  command?: string;
  cwd: string;
  environment?: Readonly<Record<string, string | undefined>>;
  requestTimeoutMs?: number;
  maxOutputBytes?: number;
}>): CodexAppServerConnectionFactory {
  const command = input.command ?? "codex";
  const requestTimeoutMs = boundedInteger(
    input.requestTimeoutMs,
    DEFAULT_REQUEST_TIMEOUT_MS,
    1_000,
    600_000,
  );
  const maxOutputBytes = boundedInteger(
    input.maxOutputBytes,
    DEFAULT_MAX_OUTPUT_BYTES,
    10_000,
    64_000_000,
  );
  const environment = input.environment ?? process.env;
  return async () => {
    const connection = new ProcessCodexAppServerConnection({
      command,
      args: Object.freeze(["app-server", "--stdio"]),
      cwd: input.cwd,
      environment,
      maxOutputBytes,
    });
    await connection.request("initialize", {
      clientInfo: {
        name: "prediction-market-harness",
        title: "Prediction Market Harness",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    }, requestTimeoutMs);
    connection.notify("initialized");
    return connection;
  };
}

export async function probeCodexAppServerAccount(input: Readonly<{
  command?: string;
  cwd: string;
  environment?: Readonly<Record<string, string | undefined>>;
  timeoutMs?: number;
}>): Promise<Readonly<{
  usable: boolean;
  diagnostic: string;
}>> {
  const timeoutMs = boundedInteger(input.timeoutMs, 10_000, 1_000, 60_000);
  const connection = await createCodexAppServerConnectionFactory({
    cwd: input.cwd,
    requestTimeoutMs: timeoutMs,
    ...(input.command === undefined ? {} : { command: input.command }),
    ...(input.environment === undefined ? {} : { environment: input.environment }),
  })();
  try {
    const response = await connection.request("account/read", { refreshToken: false }, timeoutMs);
    const value = response as Readonly<Record<string, unknown>> | null;
    const account = value?.account as Readonly<Record<string, unknown>> | null | undefined;
    const usable = account?.type === "chatgpt";
    return Object.freeze({
      usable,
      diagnostic: usable
        ? "Codex app-server recognized the configured ChatGPT account"
        : "Codex app-server did not expose a ChatGPT account",
    });
  } finally {
    await connection.close();
  }
}
