import { hashCanonical, type Fixed, type Hash } from "@pmh/domain";

export type BookLifecycle =
  | "EMPTY"
  | "SNAPSHOT_VALID"
  | "APPLYING_DELTAS"
  | "STALE"
  | "GAP_DETECTED"
  | "REBUILDING";

export type BookSide = "BID" | "ASK";

export type PriceLevel = Readonly<{
  price: Fixed;
  size: Fixed;
}>;

export type BookSnapshot = Readonly<{
  kind: "SNAPSHOT";
  sequence: bigint;
  tickSize: Fixed;
  bids: readonly PriceLevel[];
  asks: readonly PriceLevel[];
  sourceHash: Hash;
}>;

export type BookDelta = Readonly<{
  kind: "DELTA";
  sequence: bigint;
  previousSequence: bigint;
  changes: readonly (PriceLevel & { side: BookSide })[];
  sourceHash: Hash;
}>;

export type BookEvent =
  | BookSnapshot
  | BookDelta
  | Readonly<{ kind: "MARK_STALE"; reason: string }>
  | Readonly<{ kind: "BEGIN_REBUILD"; reason: string }>;

export type BookProjection = Readonly<{
  instrumentId: string;
  lifecycle: BookLifecycle;
  generation: bigint;
  generationHash?: Hash;
  stateHash?: Hash;
  sequence?: bigint;
  tickSize?: Fixed;
  bids: readonly PriceLevel[];
  asks: readonly PriceLevel[];
  diagnostic?: string;
}>;

function validateLevel(level: PriceLevel, tickSize: Fixed): void {
  if (level.price < 0n || level.size < 0n) {
    throw new Error("price and size must be non-negative");
  }
  if (tickSize <= 0n || level.price % tickSize !== 0n) {
    throw new Error(`price ${level.price} is not aligned to tick ${tickSize}`);
  }
}

function levelsToMap(
  levels: readonly PriceLevel[],
  tickSize: Fixed,
): Map<Fixed, Fixed> {
  const result = new Map<Fixed, Fixed>();
  for (const level of levels) {
    validateLevel(level, tickSize);
    if (level.size === 0n) {
      continue;
    }
    if (result.has(level.price)) {
      throw new Error(`duplicate price level ${level.price}`);
    }
    result.set(level.price, level.size);
  }
  return result;
}

function sortedLevels(
  levels: ReadonlyMap<Fixed, Fixed>,
  side: BookSide,
): readonly PriceLevel[] {
  return [...levels.entries()]
    .sort(([left], [right]) =>
      side === "BID"
        ? left > right
          ? -1
          : left < right
            ? 1
            : 0
        : left < right
          ? -1
          : left > right
            ? 1
            : 0,
    )
    .map(([price, size]) => ({ price, size }));
}

export class DeterministicBook {
  readonly #instrumentId: string;
  #lifecycle: BookLifecycle = "EMPTY";
  #generation = 0n;
  #generationHash: Hash | undefined;
  #sequence: bigint | undefined;
  #tickSize: Fixed | undefined;
  #bids = new Map<Fixed, Fixed>();
  #asks = new Map<Fixed, Fixed>();
  #diagnostic: string | undefined;

  public constructor(instrumentId: string) {
    this.#instrumentId = instrumentId;
  }

  public apply(event: BookEvent): BookProjection {
    switch (event.kind) {
      case "SNAPSHOT":
        this.#applySnapshot(event);
        break;
      case "DELTA":
        this.#applyDelta(event);
        break;
      case "MARK_STALE":
        this.#lifecycle = "STALE";
        this.#diagnostic = event.reason;
        break;
      case "BEGIN_REBUILD":
        this.#lifecycle = "REBUILDING";
        this.#diagnostic = event.reason;
        break;
    }
    return this.projection();
  }

  #applySnapshot(snapshot: BookSnapshot): void {
    if (
      this.#lifecycle !== "EMPTY" &&
      this.#lifecycle !== "REBUILDING" &&
      this.#lifecycle !== "GAP_DETECTED" &&
      this.#lifecycle !== "STALE"
    ) {
      throw new Error(
        `snapshot cannot replace a valid book without entering rebuild`,
      );
    }
    if (snapshot.sequence < 0n) {
      throw new Error("snapshot sequence must be non-negative");
    }
    this.#bids = levelsToMap(snapshot.bids, snapshot.tickSize);
    this.#asks = levelsToMap(snapshot.asks, snapshot.tickSize);
    this.#generation += 1n;
    this.#generationHash = hashCanonical({
      instrumentId: this.#instrumentId,
      generation: this.#generation,
      snapshotSourceHash: snapshot.sourceHash,
    });
    this.#sequence = snapshot.sequence;
    this.#tickSize = snapshot.tickSize;
    this.#lifecycle = "SNAPSHOT_VALID";
    this.#diagnostic = undefined;
  }

  #applyDelta(delta: BookDelta): void {
    if (
      this.#lifecycle !== "SNAPSHOT_VALID" &&
      this.#lifecycle !== "APPLYING_DELTAS"
    ) {
      this.#lifecycle = "GAP_DETECTED";
      this.#diagnostic = `delta ${delta.sequence} arrived without a valid snapshot`;
      return;
    }
    if (this.#sequence === undefined || this.#tickSize === undefined) {
      throw new Error("valid book is missing sequence or tick identity");
    }
    if (delta.sequence === this.#sequence) {
      return;
    }
    if (
      delta.previousSequence !== this.#sequence ||
      delta.sequence <= this.#sequence
    ) {
      this.#lifecycle = "GAP_DETECTED";
      this.#diagnostic =
        `expected delta after ${this.#sequence}, received ` +
        `${delta.sequence} with previous ${delta.previousSequence}`;
      return;
    }

    for (const change of delta.changes) {
      validateLevel(change, this.#tickSize);
      const side = change.side === "BID" ? this.#bids : this.#asks;
      if (change.size === 0n) {
        side.delete(change.price);
      } else {
        side.set(change.price, change.size);
      }
    }
    this.#sequence = delta.sequence;
    this.#lifecycle = "APPLYING_DELTAS";
    this.#diagnostic = undefined;
  }

  public projection(): BookProjection {
    const bids = sortedLevels(this.#bids, "BID");
    const asks = sortedLevels(this.#asks, "ASK");
    const stateHash =
      this.#generationHash === undefined || this.#sequence === undefined
        ? undefined
        : hashCanonical({
            generationHash: this.#generationHash,
            sequence: this.#sequence,
            bids,
            asks,
          });
    return {
      instrumentId: this.#instrumentId,
      lifecycle: this.#lifecycle,
      generation: this.#generation,
      ...(this.#generationHash === undefined
        ? {}
        : { generationHash: this.#generationHash }),
      ...(stateHash === undefined ? {} : { stateHash }),
      ...(this.#sequence === undefined ? {} : { sequence: this.#sequence }),
      ...(this.#tickSize === undefined ? {} : { tickSize: this.#tickSize }),
      bids,
      asks,
      ...(this.#diagnostic === undefined
        ? {}
        : { diagnostic: this.#diagnostic }),
    };
  }
}
