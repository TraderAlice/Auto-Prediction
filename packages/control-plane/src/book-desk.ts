import { resolve } from "node:path";
import { formatFixed, type Hash } from "@pmh/domain";
import { loadRawFixture, loadStreamFixture } from "@pmh/evidence";
import {
  DeterministicBook,
  type BookProjection,
  type NormalizedBookUpdate,
} from "@pmh/market-state";
import { decodeGeminiBookStream } from "@pmh/venue-gemini";
import { decodeLimitlessBookStream } from "@pmh/venue-limitless";
import { decodePolymarketBookStream } from "@pmh/venue-polymarket";
import {
  decodePolymarketUsBookSnapshot,
  POLYMARKET_US_PRICE_SCALE,
  POLYMARKET_US_QUANTITY_SCALE,
} from "@pmh/venue-polymarket-us";
import type {
  BookDeskProjection,
  StudioBookProjection,
} from "./types.js";

type BookDisplaySource = Readonly<{
  venueId: string;
  venueName: string;
  priceScale: bigint;
  quantityScale: bigint;
  sequencePolicy: StudioBookProjection["sequencePolicy"];
}>;

type ReplaySource = BookDisplaySource & Readonly<{
  payloadPath: string;
  metadataPath: string;
  decode: (
    fixture: Awaited<ReturnType<typeof loadStreamFixture>>,
  ) => readonly NormalizedBookUpdate[];
}>;

function displayBook(
  source: BookDisplaySource,
  projection: BookProjection,
  evidenceHash: Hash,
  capturedAt: string,
): StudioBookProjection {
  const formatLevel = (level: BookProjection["bids"][number]) => ({
    price: formatFixed(level.price, source.priceScale),
    size: formatFixed(level.size, source.quantityScale),
  });
  const bids = projection.bids.slice(0, 8).map(formatLevel);
  const asks = projection.asks.slice(0, 8).map(formatLevel);
  const bestBid = projection.bids[0];
  const bestAsk = projection.asks[0];
  const spread =
    bestBid === undefined || bestAsk === undefined
      ? undefined
      : formatFixed(bestAsk.price - bestBid.price, source.priceScale);
  return {
    bookId: `${source.venueId}:${projection.instrumentId}`,
    venueId: source.venueId,
    venueName: source.venueName,
    instrumentId: projection.instrumentId,
    lifecycle: projection.lifecycle,
    generation: projection.generation.toString(),
    sequence: projection.sequence?.toString() ?? null,
    stateHash: projection.stateHash ?? null,
    evidenceHash,
    capturedAt,
    sequencePolicy: source.sequencePolicy,
    bestBid: bestBid === undefined ? null : formatLevel(bestBid).price,
    bestAsk: bestAsk === undefined ? null : formatLevel(bestAsk).price,
    spread: spread ?? null,
    bidLevelCount: projection.bids.length,
    askLevelCount: projection.asks.length,
    bids,
    asks,
    diagnostic: projection.diagnostic ?? null,
  };
}

export class ReplayBookDesk {
  readonly #fixtureRoot: string;
  #books: readonly StudioBookProjection[] = [];
  #replayCount = 0;
  #inFlight: Promise<BookDeskProjection> | undefined;

  public constructor(
    fixtureRoot = resolve(import.meta.dirname, "../../../projects/fixtures"),
  ) {
    this.#fixtureRoot = fixtureRoot;
  }

  public projection(): BookDeskProjection {
    return {
      mode: "FIXTURE_REPLAY",
      replayCount: this.#replayCount,
      books: this.#books,
    };
  }

  public replay(): Promise<BookDeskProjection> {
    if (this.#inFlight !== undefined) return this.#inFlight;
    const operation = this.#performReplay().finally(() => {
      this.#inFlight = undefined;
    });
    this.#inFlight = operation;
    return operation;
  }

  async #performReplay(): Promise<BookDeskProjection> {
    const sources: readonly ReplaySource[] = [
      {
        venueId: "polymarket-global",
        venueName: "Polymarket",
        payloadPath: resolve(
          this.#fixtureRoot,
          "polymarket-global/2026-07-31/polymarket-book.stream.json",
        ),
        metadataPath: resolve(
          this.#fixtureRoot,
          "polymarket-global/2026-07-31/polymarket-book.stream.meta.json",
        ),
        priceScale: 100_000_000n,
        quantityScale: 100_000_000n,
        sequencePolicy: "FULL_SNAPSHOT_REBUILD",
        decode: decodePolymarketBookStream,
      },
      {
        venueId: "gemini-predictions",
        venueName: "Gemini",
        payloadPath: resolve(
          this.#fixtureRoot,
          "gemini-predictions/2026-07-31/gemini-book.stream.json",
        ),
        metadataPath: resolve(
          this.#fixtureRoot,
          "gemini-predictions/2026-07-31/gemini-book.stream.meta.json",
        ),
        priceScale: 100_000_000n,
        quantityScale: 100_000_000n,
        sequencePolicy: "NATIVE_RANGE",
        decode: decodeGeminiBookStream,
      },
      {
        venueId: "limitless",
        venueName: "Limitless",
        payloadPath: resolve(
          this.#fixtureRoot,
          "limitless/2026-07-31/limitless-book.stream.json",
        ),
        metadataPath: resolve(
          this.#fixtureRoot,
          "limitless/2026-07-31/limitless-book.stream.meta.json",
        ),
        priceScale: 100_000_000n,
        quantityScale: 1n,
        sequencePolicy: "VERSIONED_SNAPSHOT_REBUILD",
        decode: decodeLimitlessBookStream,
      },
    ];

    const books = await Promise.all(
      sources.map(async (source) => {
        const fixture = await loadStreamFixture(
          source.payloadPath,
          source.metadataPath,
        );
        const states = new Map<string, DeterministicBook>();
        for (const update of source.decode(fixture)) {
          let book = states.get(update.instrumentId);
          if (book === undefined) {
            book = new DeterministicBook(update.instrumentId);
            states.set(update.instrumentId, book);
          }
          if (update.requiresRebuild) {
            book.apply({
              kind: "BEGIN_REBUILD",
              reason: `${source.venueId} supplied a replacement full book`,
            });
          }
          book.apply(update.event);
        }
        return [...states.values()].map((book) =>
          displayBook(
            source,
            book.projection(),
            fixture.rawHash,
            fixture.metadata.closedAt,
          ),
        );
      }),
    );
    const [polymarketUsCatalog, polymarketUsBook] = await Promise.all([
      loadRawFixture(
        resolve(
          this.#fixtureRoot,
          "polymarket-us/2026-08-01/polymarket-us-catalog.json",
        ),
        resolve(
          this.#fixtureRoot,
          "polymarket-us/2026-08-01/polymarket-us-catalog.meta.json",
        ),
      ),
      loadRawFixture(
        resolve(
          this.#fixtureRoot,
          "polymarket-us/2026-08-01/polymarket-us-market-book.json",
        ),
        resolve(
          this.#fixtureRoot,
          "polymarket-us/2026-08-01/polymarket-us-market-book.meta.json",
        ),
      ),
    ]);
    const polymarketUsUpdate = decodePolymarketUsBookSnapshot(
      polymarketUsBook,
      polymarketUsCatalog,
    );
    if (polymarketUsUpdate.event.kind !== "SNAPSHOT") {
      throw new Error("Polymarket US verified book is not a snapshot");
    }
    const polymarketUsState = new DeterministicBook(
      polymarketUsUpdate.instrumentId,
    );
    polymarketUsState.apply(polymarketUsUpdate.event);
    const polymarketUsDisplay = displayBook(
      {
        venueId: "polymarket-us",
        venueName: "Polymarket US",
        priceScale: POLYMARKET_US_PRICE_SCALE,
        quantityScale: POLYMARKET_US_QUANTITY_SCALE,
        sequencePolicy: "FULL_SNAPSHOT_REBUILD",
      },
      polymarketUsState.projection(),
      polymarketUsUpdate.event.sourceHash,
      polymarketUsBook.metadata.fetchedAt,
    );
    this.#books = [...books.flat(), polymarketUsDisplay]
      .sort((left, right) => left.venueId.localeCompare(right.venueId));
    this.#replayCount += 1;
    return this.projection();
  }
}
