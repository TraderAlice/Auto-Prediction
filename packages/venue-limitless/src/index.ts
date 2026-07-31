import { parseFixed } from "@pmh/domain";
import type { VerifiedStreamFixture } from "@pmh/evidence";
import type { NormalizedBookUpdate } from "@pmh/market-state";
import {
  parseJsonWithNumberLexemes,
  type VenueManifest,
} from "@pmh/protocol";
import { z } from "zod";

const LevelSchema = z.object({
  price: z.string(),
  size: z.string(),
  side: z.enum(["BUY", "SELL"]),
});

const OrderbookUpdateSchema = z.object({
  marketSlug: z.string(),
  orderbook: z.object({
    bids: z.array(LevelSchema),
    asks: z.array(LevelSchema),
    tokenId: z.string(),
  }),
  version: z.string().regex(/^\d+$/),
  timestamp: z.string(),
});

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function inferTick(prices: readonly bigint[]): bigint {
  const result = prices.reduce((tick, price) => gcd(tick, price), 0n);
  return result === 0n ? 1n : result;
}

export const limitlessManifest: VenueManifest = {
  venueId: "limitless",
  displayName: "Limitless",
  adapterVersion: "0.0.0",
  protocolIdentity: "markets-socket-io:2026-07-31",
  officialSources: [
    "https://docs.limitless.exchange/developers/websocket-events",
  ],
  mechanisms: ["public CLOB market-price Socket.IO stream"],
  precisionRules: [
    "price lexemes are normalized at scale 1e8",
    "public size values are retained as venue base units",
    "snapshot tick identity is inferred from the observed price lattice",
  ],
  authenticationBoundary:
    "public market-price subscriptions only; authenticated account and order streams excluded",
  capabilities: [
    {
      capability: "REALTIME_BOOK",
      implemented: true,
      qualification: ["DISCOVER", "OBSERVE"],
      evidenceRefs: ["limitless-book"],
      limitations: [
        "orderbookUpdate is treated as a full snapshot",
        "each replacement snapshot must enter rebuild before application",
        "catalog normalization is not implemented",
      ],
    },
  ],
  liveExecutionEnabled: false,
};

export function decodeLimitlessBookStream(
  fixture: VerifiedStreamFixture,
): readonly NormalizedBookUpdate[] {
  if (fixture.metadata.venue !== limitlessManifest.venueId) {
    throw new Error("stream fixture venue does not match Limitless adapter");
  }
  const seen = new Set<string>();
  return fixture.frames.flatMap((frame) => {
    if (frame.eventName !== "orderbookUpdate") return [];
    const message = OrderbookUpdateSchema.parse(
      parseJsonWithNumberLexemes(frame.rawText),
    );
    const bids = message.orderbook.bids.map((level) => ({
      price: parseFixed(level.price, 100_000_000n),
      size: parseFixed(level.size, 1n),
    }));
    const asks = message.orderbook.asks.map((level) => ({
      price: parseFixed(level.price, 100_000_000n),
      size: parseFixed(level.size, 1n),
    }));
    const prices = [...bids, ...asks].map((level) => level.price);
    const instrumentId = message.orderbook.tokenId;
    const requiresRebuild = seen.has(instrumentId);
    seen.add(instrumentId);
    return [
      {
        instrumentId,
        requiresRebuild,
        event: {
          kind: "SNAPSHOT" as const,
          sequence: BigInt(message.version),
          tickSize: inferTick(prices),
          bids,
          asks,
          sourceHash: frame.frameHash,
        },
      },
    ];
  });
}
