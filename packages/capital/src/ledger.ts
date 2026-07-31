export type CapitalReservation = Readonly<{
  id: string;
  venueId: string;
  initialAmount: bigint;
  remainingAmount: bigint;
  consumedAmount: bigint;
  status: "OPEN" | "CONSUMED" | "RELEASED";
}>;

export type VenueCapitalProjection = Readonly<{
  venueId: string;
  initialCapital: bigint;
  realizedPnl: bigint;
  available: bigint;
  reserved: bigint;
  deployed: bigint;
  unresolved: bigint;
  receivable: bigint;
}>;

type MutableVenueCapital = {
  initialCapital: bigint;
  realizedPnl: bigint;
  available: bigint;
  reserved: bigint;
  deployed: bigint;
  unresolved: bigint;
  receivable: bigint;
};

type MutableReservation = {
  id: string;
  venueId: string;
  initialAmount: bigint;
  remainingAmount: bigint;
  consumedAmount: bigint;
  status: "OPEN" | "CONSUMED" | "RELEASED";
};

export class CapitalLedger {
  readonly #venues = new Map<string, MutableVenueCapital>();
  readonly #reservations = new Map<string, MutableReservation>();

  public constructor(initialCapitalByVenue: ReadonlyMap<string, bigint>) {
    for (const [venueId, amount] of initialCapitalByVenue) {
      if (venueId === "" || amount < 0n) {
        throw new Error("venue id must be non-empty and capital non-negative");
      }
      this.#venues.set(venueId, {
        initialCapital: amount,
        realizedPnl: 0n,
        available: amount,
        reserved: 0n,
        deployed: 0n,
        unresolved: 0n,
        receivable: 0n,
      });
    }
    this.assertConservation();
  }

  public reserve(id: string, venueId: string, amount: bigint): void {
    if (id === "" || amount <= 0n) {
      throw new Error("reservation id and amount must be positive");
    }
    if (this.#reservations.has(id)) {
      throw new Error(`reservation ${id} already exists`);
    }
    const venue = this.#venue(venueId);
    if (venue.available < amount) {
      throw new Error(`insufficient available capital at ${venueId}`);
    }
    venue.available -= amount;
    venue.reserved += amount;
    this.#reservations.set(id, {
      id,
      venueId,
      initialAmount: amount,
      remainingAmount: amount,
      consumedAmount: 0n,
      status: "OPEN",
    });
    this.assertConservation();
  }

  public consume(id: string, amount: bigint): void {
    if (amount <= 0n) {
      throw new Error("consumed amount must be positive");
    }
    const reservation = this.#reservation(id);
    if (reservation.status !== "OPEN" || amount > reservation.remainingAmount) {
      throw new Error(`reservation ${id} cannot consume ${amount}`);
    }
    const venue = this.#venue(reservation.venueId);
    reservation.remainingAmount -= amount;
    reservation.consumedAmount += amount;
    venue.reserved -= amount;
    venue.deployed += amount;
    if (reservation.remainingAmount === 0n) {
      reservation.status = "CONSUMED";
    }
    this.assertConservation();
  }

  public release(id: string): bigint {
    const reservation = this.#reservation(id);
    if (reservation.status === "RELEASED") {
      return 0n;
    }
    const amount = reservation.remainingAmount;
    if (amount > 0n) {
      const venue = this.#venue(reservation.venueId);
      venue.reserved -= amount;
      venue.available += amount;
      reservation.remainingAmount = 0n;
    }
    reservation.status =
      reservation.consumedAmount === reservation.initialAmount
        ? "CONSUMED"
        : "RELEASED";
    this.assertConservation();
    return amount;
  }

  public markUnresolved(venueId: string, amount: bigint): void {
    if (amount <= 0n) {
      throw new Error("unresolved amount must be positive");
    }
    const venue = this.#venue(venueId);
    if (venue.deployed < amount) {
      throw new Error(`insufficient deployed capital at ${venueId}`);
    }
    venue.deployed -= amount;
    venue.unresolved += amount;
    this.assertConservation();
  }

  public recognizeSettlement(
    venueId: string,
    costBasis: bigint,
    receivableAmount: bigint,
  ): void {
    if (costBasis <= 0n || receivableAmount < 0n) {
      throw new Error("settlement amounts are invalid");
    }
    const venue = this.#venue(venueId);
    if (venue.unresolved < costBasis) {
      throw new Error(`insufficient unresolved capital at ${venueId}`);
    }
    venue.unresolved -= costBasis;
    venue.receivable += receivableAmount;
    venue.realizedPnl += receivableAmount - costBasis;
    this.assertConservation();
  }

  public recoverReceivable(venueId: string, amount: bigint): void {
    if (amount <= 0n) {
      throw new Error("recovery amount must be positive");
    }
    const venue = this.#venue(venueId);
    if (venue.receivable < amount) {
      throw new Error(`insufficient receivable capital at ${venueId}`);
    }
    venue.receivable -= amount;
    venue.available += amount;
    this.assertConservation();
  }

  public venueProjection(venueId: string): VenueCapitalProjection {
    const venue = this.#venue(venueId);
    return Object.freeze({ venueId, ...venue });
  }

  public projections(): readonly VenueCapitalProjection[] {
    return [...this.#venues.keys()]
      .sort()
      .map((venueId) => this.venueProjection(venueId));
  }

  public reservation(id: string): CapitalReservation {
    return Object.freeze({ ...this.#reservation(id) });
  }

  public assertConservation(): void {
    for (const [venueId, venue] of this.#venues) {
      const buckets =
        venue.available +
        venue.reserved +
        venue.deployed +
        venue.unresolved +
        venue.receivable;
      const owned = venue.initialCapital + venue.realizedPnl;
      if (buckets !== owned) {
        throw new Error(
          `capital conservation failed at ${venueId}: buckets ${buckets}, owned ${owned}`,
        );
      }
      if (
        venue.available < 0n ||
        venue.reserved < 0n ||
        venue.deployed < 0n ||
        venue.unresolved < 0n ||
        venue.receivable < 0n
      ) {
        throw new Error(`capital bucket became negative at ${venueId}`);
      }
    }
  }

  #venue(venueId: string): MutableVenueCapital {
    const venue = this.#venues.get(venueId);
    if (venue === undefined) {
      throw new Error(`unknown venue ${venueId}`);
    }
    return venue;
  }

  #reservation(id: string): MutableReservation {
    const reservation = this.#reservations.get(id);
    if (reservation === undefined) {
      throw new Error(`unknown reservation ${id}`);
    }
    return reservation;
  }
}
