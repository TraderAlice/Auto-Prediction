import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DiscoveryPool, HeuristicDiscoveryWorker } from "./discovery.js";
import { buildStudioProjection } from "./projection.js";
import type { DiscoveryTask } from "./types.js";

const MAX_BODY_BYTES = 64 * 1024;

function writeJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "http://localhost:5173",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes =
      typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    length += bytes.byteLength;
    if (length > MAX_BODY_BYTES) {
      throw new Error("request body exceeds 64 KiB");
    }
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseDiscoveryTask(value: unknown): DiscoveryTask {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as { question?: unknown }).question !== "string" ||
    !Array.isArray((value as { venueIds?: unknown }).venueIds)
  ) {
    throw new Error("discovery request requires question and venueIds");
  }
  const now = Date.now();
  return {
    taskId:
      typeof (value as { taskId?: unknown }).taskId === "string"
        ? (value as { taskId: string }).taskId
        : `task:${now}`,
    question: (value as { question: string }).question,
    venueIds: (value as { venueIds: unknown[] }).venueIds.map(String),
    maxHypotheses: 10,
    deadlineEpochMs: now + 10_000,
  };
}

export function createControlPlane() {
  const worker = new HeuristicDiscoveryWorker();
  const pool = new DiscoveryPool([worker]);
  let activeRuns = 0;
  const projection = () =>
    buildStudioProjection({ workers: pool.workers, activeRuns });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://control-plane.local");
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "http://localhost:5173",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        liveExecutionEnabled: false,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/projection") {
      writeJson(response, 200, projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": "http://localhost:5173",
      });
      response.write(`event: projection\ndata: ${JSON.stringify(projection())}\n\n`);
      const heartbeat = setInterval(() => {
        response.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
      }, 15_000);
      request.on("close", () => clearInterval(heartbeat));
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      activeRuns += 1;
      try {
        const task = parseDiscoveryTask(await readJson(request));
        writeJson(response, 200, await pool.run(task));
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "discovery run failed",
          executionAuthority: false,
        });
      } finally {
        activeRuns -= 1;
      }
      return;
    }
    writeJson(response, 404, {
      ok: false,
      diagnostic: "route not found",
    });
  });
  return { server, pool, projection };
}

export async function startControlPlane(
  port = 4_100,
  host = "127.0.0.1",
): Promise<void> {
  const { server } = createControlPlane();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  process.stdout.write(`control-plane http://${host}:${port}\n`);
}
