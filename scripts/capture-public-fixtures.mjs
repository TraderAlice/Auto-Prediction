import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const fixtures = Object.freeze({
  "polymarket-catalog": {
    venue: "polymarket-global",
    protocolVersion: "gamma-rest:2026-07-31",
    sourceUrl:
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1",
  },
  "polymarket-combo": {
    venue: "polymarket-global",
    protocolVersion: "combo-rfq-rest:2026-07-31",
    sourceUrl:
      "https://combos-rfq-api.polymarket.com/v1/rfq/combo-markets?limit=1",
  },
  "polymarket-trump-out-2027": {
    venue: "polymarket-global",
    protocolVersion: "gamma-rest:2026-07-31",
    sourceUrl:
      "https://gamma-api.polymarket.com/markets?slug=trump-out-as-president-before-2027",
  },
  "polymarket-trump-out-2027-book": {
    venue: "polymarket-global",
    protocolVersion: "clob-book-rest:2026-08-01",
    sourceUrl:
      "https://clob.polymarket.com/book?token_id=59252515735652674747158950210016502214756531287333895140318848923768750410355",
  },
  "polymarket-trump-out-2027-book-rescreen-1": {
    venue: "polymarket-global",
    protocolVersion: "clob-book-rest:2026-08-01",
    sourceUrl:
      "https://clob.polymarket.com/book?token_id=59252515735652674747158950210016502214756531287333895140318848923768750410355",
  },
  "kalshi-catalog": {
    venue: "kalshi",
    protocolVersion: "trade-api-v2:2026-07-31",
    sourceUrl:
      "https://external-api.kalshi.com/trade-api/v2/markets?limit=1&status=open",
  },
  "gemini-binary-catalog": {
    venue: "gemini-predictions",
    protocolVersion: "prediction-markets-v1:2026-07-30",
    sourceUrl:
      "https://api.gemini.com/v1/prediction-markets/events?status=active&category=crypto&limit=1",
  },
  "gemini-range-catalog": {
    venue: "gemini-predictions",
    protocolVersion: "prediction-markets-v1:2026-07-30",
    sourceUrl:
      "https://api.gemini.com/v1/prediction-markets/events?status=active&category=weather&limit=1",
  },
  "opinion-catalog": {
    venue: "opinion",
    protocolVersion: "openapi:2026-07-31",
    sourceUrl:
      "https://openapi.opinion.trade/openapi/market?status=activated&limit=1",
  },
  "opinion-trump-out-2027": {
    venue: "opinion",
    protocolVersion: "openapi:2026-07-31",
    sourceUrl: "https://openapi.opinion.trade/openapi/market/3062",
  },
  "predict-testnet-catalog": {
    venue: "predict-fun-testnet",
    protocolVersion: "rest-v1-beta:2026-06-18",
    sourceUrl: "https://api-testnet.predict.fun/v1/markets?first=1",
  },
  "limitless-catalog": {
    venue: "limitless",
    protocolVersion: "api-v1:2026-07-31",
    sourceUrl: "https://api.limitless.exchange/markets/active?limit=1",
  },
  "limitless-trump-out-2027": {
    venue: "limitless",
    protocolVersion: "api-v1:2026-07-31",
    sourceUrl:
      "https://api.limitless.exchange/markets/trump-out-as-president-before-2027-1768933068297",
  },
  "limitless-trump-out-2027-book": {
    venue: "limitless",
    protocolVersion: "api-v1-orderbook:2026-08-01",
    sourceUrl:
      "https://api.limitless.exchange/markets/trump-out-as-president-before-2027-1768933068297/orderbook",
  },
  "limitless-trump-out-2027-book-rescreen-1": {
    venue: "limitless",
    protocolVersion: "api-v1-orderbook:2026-08-01",
    sourceUrl:
      "https://api.limitless.exchange/markets/trump-out-as-president-before-2027-1768933068297/orderbook",
  },
  "limitless-fees": {
    venue: "limitless",
    protocolVersion: "official-fees-markdown:2026-08-01",
    sourceUrl: "https://docs.limitless.exchange/user-guide/fees.md",
    format: "TEXT",
  },
  "myriad-amm-catalog": {
    venue: "myriad",
    protocolVersion: "api-v2.0.4:2026-07-31",
    sourceUrl:
      "https://api-v2.myriadprotocol.com/markets?page=1&limit=1&state=open",
  },
});

function selectedFixtureNames(arguments_) {
  if (arguments_.length === 0 || arguments_.includes("--all")) {
    return Object.keys(fixtures);
  }
  return arguments_;
}

async function capture(name) {
  const definition = fixtures[name];
  if (definition === undefined) {
    throw new Error(`unknown fixture ${name}`);
  }

  const fetchedAt = new Date().toISOString();
  const response = await fetch(definition.sourceUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "prediction-market-harness-fixture-capture/0.0.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(
      `${name} returned HTTP ${response.status}; response was not persisted`,
    );
  }

  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (definition.format === "TEXT") {
    if (text.trim() === "") throw new Error(`${name} returned an empty document`);
  } else {
    JSON.parse(text);
  }

  const rawHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const date = fetchedAt.slice(0, 10);
  const basePath = resolve(
    repositoryRoot,
    "projects",
    "fixtures",
    definition.venue,
    date,
    name,
  );
  await mkdir(dirname(basePath), { recursive: true });
  await writeFile(`${basePath}.json`, bytes, { flag: "wx" });
  await writeFile(
    `${basePath}.meta.json`,
    `${JSON.stringify(
      {
        schemaVersion: "pmh.raw-fixture.v1",
        name,
        venue: definition.venue,
        protocolVersion: definition.protocolVersion,
        sourceUrl: definition.sourceUrl,
        fetchedAt,
        httpStatus: response.status,
        contentType: response.headers.get("content-type") ?? "unknown",
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        rawHash,
        byteLength: bytes.byteLength.toString(),
        acquisition: {
          method: "GET",
          credentialsUsed: false,
          valueMovingOperation: false,
        },
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  process.stdout.write(`${name} ${rawHash} ${bytes.byteLength} bytes\n`);
}

for (const name of selectedFixtureNames(process.argv.slice(2))) {
  await capture(name);
}
