import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ReplayBookDesk } from "./book-desk.js";
import { DiscoveryPool, HeuristicDiscoveryWorker } from "./discovery.js";
import { DiscoveryLedger } from "./discovery-ledger.js";
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

export function createControlPlane(options?: {
  bookDesk?: ReplayBookDesk;
  discoveryLedger?: DiscoveryLedger;
}) {
  const worker = new HeuristicDiscoveryWorker();
  const pool = new DiscoveryPool([worker]);
  const bookDesk = options?.bookDesk ?? new ReplayBookDesk();
  const discoveryLedger = options?.discoveryLedger ?? new DiscoveryLedger();
  const ready = bookDesk.replay();
  const subscribers = new Set<ServerResponse>();
  let activeRuns = 0;
  const projection = async () =>
    buildStudioProjection({
      workers: pool.workers,
      activeRuns,
      bookDesk: await ready.then(() => bookDesk.projection()),
      discoveryDesk: discoveryLedger.projection(),
    });

  const broadcastProjection = async (): Promise<void> => {
    const payload = `event: projection\ndata: ${JSON.stringify(
      await projection(),
    )}\n\n`;
    for (const subscriber of subscribers) {
      if (subscriber.destroyed) {
        subscribers.delete(subscriber);
      } else {
        subscriber.write(payload);
      }
    }
  };

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
      writeJson(response, 200, await projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/books") {
      await ready;
      writeJson(response, 200, bookDesk.projection());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/qualification"
    ) {
      const current = await projection();
      writeJson(response, 200, current.qualification);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      writeJson(response, 200, discoveryLedger.projection());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": "http://localhost:5173",
      });
      response.write(
        `event: projection\ndata: ${JSON.stringify(await projection())}\n\n`,
      );
      subscribers.add(response);
      const heartbeat = setInterval(() => {
        response.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
      }, 15_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(response);
      });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/books/replay"
    ) {
      try {
        const books = await bookDesk.replay();
        await broadcastProjection();
        writeJson(response, 200, {
          ok: true,
          effects: {
            externalWrites: false,
            valueMovingActions: false,
            liveExecutionEnabled: false,
          },
          bookDesk: books,
        });
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "book replay failed",
          effects: {
            externalWrites: false,
            valueMovingActions: false,
            liveExecutionEnabled: false,
          },
        });
      }
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/discovery/runs"
    ) {
      let task: DiscoveryTask;
      try {
        task = parseDiscoveryTask(await readJson(request));
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "discovery run failed",
          executionAuthority: false,
        });
        return;
      }
      activeRuns += 1;
      await broadcastProjection();
      try {
        const run = await pool.run(task);
        discoveryLedger.record(task, run);
        writeJson(response, 200, run);
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          diagnostic:
            error instanceof Error ? error.message : "discovery run failed",
          executionAuthority: false,
        });
      } finally {
        activeRuns -= 1;
        await broadcastProjection();
      }
      return;
    }
    writeJson(response, 404, {
      ok: false,
      diagnostic: "route not found",
    });
  });
  return {
    server,
    pool,
    bookDesk,
    discoveryLedger,
    projection,
    ready,
  };
}

export async function startControlPlane(
  port = 4_100,
  host = "127.0.0.1",
): Promise<void> {
  const { server, ready } = createControlPlane();
  await ready;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  process.stdout.write(`control-plane http://${host}:${port}\n`);
}
