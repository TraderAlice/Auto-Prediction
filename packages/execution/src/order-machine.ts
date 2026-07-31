import type { OrderIntent, OrderLifecycle, OrderProjection } from "./types.js";

export class ShadowOrderMachine {
  readonly #intent: OrderIntent;
  #lifecycle: OrderLifecycle = "INTENT";
  #venueOrderId: string | undefined;
  #filledQuantity = 0n;

  public constructor(intent: OrderIntent) {
    this.#intent = intent;
  }

  public beginSubmit(): OrderProjection {
    if (this.#lifecycle === "SUBMITTING") {
      return this.projection();
    }
    this.#require("INTENT");
    this.#lifecycle = "SUBMITTING";
    return this.projection();
  }

  public acknowledge(venueOrderId: string): OrderProjection {
    this.#require("SUBMITTING");
    if (venueOrderId === "") {
      throw new Error("venue order id must be non-empty");
    }
    this.#venueOrderId = venueOrderId;
    this.#lifecycle = "ACKNOWLEDGED";
    return this.projection();
  }

  public fill(quantityDelta: bigint): OrderProjection {
    this.assertCanFill(quantityDelta);
    this.#filledQuantity += quantityDelta;
    this.#lifecycle =
      this.#filledQuantity === this.#intent.quantity ? "FILLED" : "PARTIAL";
    return this.projection();
  }

  public assertCanFill(quantityDelta: bigint): void {
    if (
      this.#lifecycle !== "ACKNOWLEDGED" &&
      this.#lifecycle !== "PARTIAL"
    ) {
      throw new Error(`cannot fill order in ${this.#lifecycle}`);
    }
    if (
      quantityDelta <= 0n ||
      this.#filledQuantity + quantityDelta > this.#intent.quantity
    ) {
      throw new Error("fill quantity is invalid");
    }
  }

  public cancel(): OrderProjection {
    if (
      this.#lifecycle !== "ACKNOWLEDGED" &&
      this.#lifecycle !== "PARTIAL"
    ) {
      throw new Error(`cannot cancel order in ${this.#lifecycle}`);
    }
    this.#lifecycle = "CANCELED";
    return this.projection();
  }

  public reject(): OrderProjection {
    this.#require("SUBMITTING");
    this.#lifecycle = "REJECTED";
    return this.projection();
  }

  public markUnknown(): OrderProjection {
    if (
      this.#lifecycle !== "SUBMITTING" &&
      this.#lifecycle !== "ACKNOWLEDGED" &&
      this.#lifecycle !== "PARTIAL"
    ) {
      throw new Error(`cannot mark order unknown from ${this.#lifecycle}`);
    }
    this.#lifecycle = "UNKNOWN";
    return this.projection();
  }

  public reconcile(
    lifecycle: Exclude<OrderLifecycle, "INTENT" | "SUBMITTING" | "UNKNOWN">,
    cumulativeFilledQuantity: bigint,
    venueOrderId?: string,
  ): OrderProjection {
    this.assertCanReconcile(lifecycle, cumulativeFilledQuantity);
    this.#filledQuantity = cumulativeFilledQuantity;
    this.#lifecycle = lifecycle;
    if (venueOrderId !== undefined) {
      this.#venueOrderId = venueOrderId;
    }
    return this.projection();
  }

  public assertCanReconcile(
    lifecycle: Exclude<OrderLifecycle, "INTENT" | "SUBMITTING" | "UNKNOWN">,
    cumulativeFilledQuantity: bigint,
  ): void {
    this.#require("UNKNOWN");
    if (
      cumulativeFilledQuantity < this.#filledQuantity ||
      cumulativeFilledQuantity > this.#intent.quantity
    ) {
      throw new Error("reconciled fill quantity is invalid");
    }
    if (
      lifecycle === "FILLED" &&
      cumulativeFilledQuantity !== this.#intent.quantity
    ) {
      throw new Error("filled reconciliation must cover the full quantity");
    }
    if (
      lifecycle === "PARTIAL" &&
      (cumulativeFilledQuantity <= 0n ||
        cumulativeFilledQuantity >= this.#intent.quantity)
    ) {
      throw new Error("partial reconciliation quantity is invalid");
    }
    if (
      lifecycle === "ACKNOWLEDGED" &&
      cumulativeFilledQuantity !== this.#filledQuantity
    ) {
      throw new Error("acknowledged reconciliation cannot add fills");
    }
  }

  public projection(): OrderProjection {
    return Object.freeze({
      intentId: this.#intent.id,
      clientOrderId: this.#intent.clientOrderId,
      lifecycle: this.#lifecycle,
      ...(this.#venueOrderId === undefined
        ? {}
        : { venueOrderId: this.#venueOrderId }),
      filledQuantity: this.#filledQuantity,
      totalQuantity: this.#intent.quantity,
    });
  }

  #require(expected: OrderLifecycle): void {
    if (this.#lifecycle !== expected) {
      throw new Error(`expected order ${expected}, received ${this.#lifecycle}`);
    }
  }
}
