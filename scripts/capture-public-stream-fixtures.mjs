import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { io } from "socket.io-client";

const FIXTURE_DATE = "2026-07-31";
const TIMEOUT_MS = 15_000;

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function makeFrame(rawText, eventName, ordinal) {
  return {
    ordinal: ordinal.toString(),
    receivedAt: new Date().toISOString(),
    eventName,
    rawText,
    frameHash: sha256(rawText),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "prediction-market-harness/0.1.0" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function captureWebSocket({ url, subscription, accept }) {
  const frames = [];
  const connectedAt = await new Promise((resolveConnection, rejectConnection) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      rejectConnection(new Error(`${url} timed out`));
    }, TIMEOUT_MS);

    socket.addEventListener("open", () => {
      const openedAt = new Date().toISOString();
      socket.send(JSON.stringify(subscription));
      resolveConnection(
        new Promise((resolveFrames, rejectFrames) => {
          socket.addEventListener("message", (event) => {
            if (typeof event.data !== "string") return;
            frames.push(makeFrame(event.data, null, frames.length));
            if (accept(event.data)) {
              clearTimeout(timer);
              socket.close();
              resolveFrames({ connectedAt: openedAt, frames });
            }
          });
          socket.addEventListener("error", () => {
            clearTimeout(timer);
            rejectFrames(new Error(`${url} WebSocket failed`));
          });
        }),
      );
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      rejectConnection(new Error(`${url} WebSocket failed before opening`));
    });
  });
  return connectedAt;
}

async function captureLimitless({ url, subscription }) {
  const frames = [];
  return new Promise((resolveCapture, rejectCapture) => {
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: false,
      timeout: TIMEOUT_MS,
    });
    const timer = setTimeout(() => {
      socket.close();
      rejectCapture(new Error(`${url} timed out`));
    }, TIMEOUT_MS);
    let connectedAt;

    socket.on("connect", () => {
      connectedAt = new Date().toISOString();
      socket.emit(subscription.event, subscription.payload);
    });
    socket.onAny((eventName, ...args) => {
      const value = args.length === 1 ? args[0] : args;
      frames.push(
        makeFrame(JSON.stringify(value), eventName, frames.length),
      );
      if (eventName === "orderbookUpdate") {
        clearTimeout(timer);
        socket.close();
        resolveCapture({
          connectedAt: connectedAt ?? new Date().toISOString(),
          frames,
        });
      }
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      rejectCapture(error);
    });
  });
}

async function persist({
  venue,
  name,
  protocolVersion,
  sourceUrl,
  transport,
  subscription,
  instrumentIds,
  capture,
}) {
  const directory = resolve(
    "projects/fixtures",
    venue,
    FIXTURE_DATE,
  );
  await mkdir(directory, { recursive: true });

  const acquisition = {
    schemaVersion: "pmh.stream-acquisition.v1",
    frames: capture.frames,
  };
  const payload = `${JSON.stringify(acquisition, null, 2)}\n`;
  const metadata = {
    schemaVersion: "pmh.stream-fixture.v1",
    name,
    venue,
    protocolVersion,
    sourceUrl,
    connectedAt: capture.connectedAt,
    closedAt: new Date().toISOString(),
    transport,
    subscription,
    subscriptionHash: sha256(
      JSON.stringify(canonicalize(subscription)),
    ),
    instrumentIds,
    frameCount: capture.frames.length.toString(),
    rawHash: sha256(payload),
    byteLength: Buffer.byteLength(payload).toString(),
    acquisition: {
      credentialsUsed: false,
      valueMovingOperation: false,
    },
  };
  await Promise.all([
    writeFile(resolve(directory, `${name}.stream.json`), payload, {
      flag: "wx",
    }),
    writeFile(
      resolve(directory, `${name}.stream.meta.json`),
      `${JSON.stringify(metadata, null, 2)}\n`,
      { flag: "wx" },
    ),
  ]);
  console.log(`${venue}: captured ${capture.frames.length} frame(s)`);
}

const polymarketCatalog = await fetchJson(
  "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1",
);
const polymarketToken = JSON.parse(polymarketCatalog[0].clobTokenIds)[0];
const polymarketUrl =
  "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const polymarketSubscription = {
  assets_ids: [polymarketToken],
  type: "market",
  custom_feature_enabled: true,
};
const polymarketCapture = await captureWebSocket({
  url: polymarketUrl,
  subscription: polymarketSubscription,
  accept: (text) => text.includes('"event_type":"book"'),
});
await persist({
  venue: "polymarket-global",
  name: "polymarket-book",
  protocolVersion: "clob-market-wss:2026-07-31",
  sourceUrl: polymarketUrl,
  transport: "WEBSOCKET",
  subscription: polymarketSubscription,
  instrumentIds: [polymarketToken],
  capture: polymarketCapture,
});

const geminiCatalog = await fetchJson(
  "https://api.gemini.com/v1/prediction-markets/events?status=active&limit=5",
);
const geminiContract =
  geminiCatalog.data
    .flatMap((event) => event.contracts)
    .find((contract) => contract.marketState === "open") ??
  geminiCatalog.data[0].contracts[0];
const geminiSymbol = geminiContract.instrumentSymbol;
const geminiUrl = "wss://ws.gemini.com?snapshot=-1";
const geminiSubscription = {
  id: "1",
  method: "SUBSCRIBE",
  params: [`${geminiSymbol}@depth`],
};
const geminiCapture = await captureWebSocket({
  url: geminiUrl,
  subscription: geminiSubscription,
  accept: (text) => text.includes('"e":"depthUpdate"'),
});
await persist({
  venue: "gemini-predictions",
  name: "gemini-book",
  protocolVersion: "market-data-wss:2026-07-31",
  sourceUrl: geminiUrl,
  transport: "WEBSOCKET",
  subscription: geminiSubscription,
  instrumentIds: [geminiSymbol],
  capture: geminiCapture,
});

const limitlessCatalog = await fetchJson(
  "https://api.limitless.exchange/markets/active?limit=5",
);
const limitlessMarket =
  limitlessCatalog.data.find((market) => market.tradeType === "clob") ??
  limitlessCatalog.data[0];
const limitlessUrl = "wss://ws.limitless.exchange/markets";
const limitlessSubscription = {
  event: "subscribe_market_prices",
  payload: { marketSlugs: [limitlessMarket.slug] },
};
const limitlessCapture = await captureLimitless({
  url: limitlessUrl,
  subscription: limitlessSubscription,
});
await persist({
  venue: "limitless",
  name: "limitless-book",
  protocolVersion: "markets-socket-io:2026-07-31",
  sourceUrl: limitlessUrl,
  transport: "SOCKET_IO_WEBSOCKET",
  subscription: limitlessSubscription,
  instrumentIds: [limitlessMarket.slug],
  capture: limitlessCapture,
});
