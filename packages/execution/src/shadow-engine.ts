import { CapitalLedger } from "@pmh/capital";
import { RiskGovernor, type OpeningRiskInput } from "@pmh/risk";
import { ShadowOrderMachine } from "./order-machine.js";
import { validateExecutionPlan } from "./plan.js";
import type {
  ExecutionLifecycle,
  ExecutionPlan,
  ExecutionProjection,
  OrderLifecycle,
} from "./types.js";

type PlanRuntime = {
  plan: ExecutionPlan;
  lifecycle: ExecutionLifecycle;
  orders: Map<string, ShadowOrderMachine>;
  deployedByVenue: Map<string, bigint>;
  capitalLockedForResolution: boolean;
};

export class ShadowExecutionEngine {
  readonly #capital: CapitalLedger;
  readonly #risk: RiskGovernor;
  readonly #plans = new Map<string, PlanRuntime>();

  public constructor(capital: CapitalLedger, risk: RiskGovernor) {
    this.#capital = capital;
    this.#risk = risk;
  }

  public reservePlan(
    planInput: ExecutionPlan,
    riskInput: OpeningRiskInput,
  ): ExecutionProjection {
    const plan = validateExecutionPlan(planInput);
    if (plan.certificateId !== riskInput.certificate.id) {
      throw new Error("execution plan does not bind the supplied certificate");
    }
    const certificateLegs = new Map(
      riskInput.certificate.legs.map((leg) => [leg.id, leg]),
    );
    for (const intent of plan.intents) {
      const leg = certificateLegs.get(intent.certificateLegId);
      if (
        leg === undefined ||
        leg.venueId !== intent.venueId ||
        leg.listingId !== intent.listingId ||
        leg.action !== intent.side ||
        intent.quantity > leg.quantity ||
        intent.quantityScale !== leg.quantityScale ||
        intent.limitPrice !== leg.unitPrice
      ) {
        throw new Error(
          `execution intent ${intent.id} does not bind an executable certificate leg`,
        );
      }
    }
    if (this.#plans.has(plan.id)) {
      throw new Error(`execution plan ${plan.id} already exists`);
    }
    const decision = this.#risk.evaluateOpening({
      ...riskInput,
      mode: "SHADOW",
      capital: this.#capital.projections(),
    });
    if (!decision.allowed) {
      throw new Error(`risk denied plan: ${decision.diagnostics.join(",")}`);
    }

    const reserved: string[] = [];
    try {
      for (const intent of plan.intents) {
        const reservationId = this.#reservationId(plan.id, intent.id);
        this.#capital.reserve(
          reservationId,
          intent.venueId,
          intent.maxDebit,
        );
        reserved.push(reservationId);
      }
    } catch (error) {
      for (const reservationId of reserved) {
        this.#capital.release(reservationId);
      }
      throw error;
    }

    const runtime: PlanRuntime = {
      plan,
      lifecycle: "RESERVED",
      orders: new Map(
        plan.intents.map((intent) => [
          intent.id,
          new ShadowOrderMachine(intent),
        ]),
      ),
      deployedByVenue: new Map(),
      capitalLockedForResolution: false,
    };
    this.#plans.set(plan.id, runtime);
    return this.#projection(runtime);
  }

  public submit(planId: string, intentId: string): ExecutionProjection {
    const runtime = this.#runtime(planId);
    for (const dependency of runtime.plan.dependencies.filter(
      (item) => item.afterIntentId === intentId,
    )) {
      const prior = this.#order(
        runtime,
        dependency.beforeIntentId,
      ).projection().lifecycle;
      const satisfied =
        dependency.condition === "FILLED"
          ? prior === "FILLED"
          : dependency.condition === "PARTIAL_OR_FILLED"
            ? prior === "PARTIAL" || prior === "FILLED"
            : prior === "ACKNOWLEDGED" ||
              prior === "PARTIAL" ||
              prior === "FILLED";
      if (!satisfied) {
        throw new Error(
          `dependency ${dependency.beforeIntentId} -> ${intentId} is not satisfied`,
        );
      }
    }
    const order = this.#order(runtime, intentId);
    order.beginSubmit();
    runtime.lifecycle = "SUBMITTING";
    return this.#projection(runtime);
  }

  public acknowledge(
    planId: string,
    intentId: string,
    venueOrderId: string,
  ): ExecutionProjection {
    const runtime = this.#runtime(planId);
    this.#order(runtime, intentId).acknowledge(venueOrderId);
    runtime.lifecycle = "ACKNOWLEDGED";
    return this.#projection(runtime);
  }

  public reject(planId: string, intentId: string): ExecutionProjection {
    const runtime = this.#runtime(planId);
    this.#order(runtime, intentId).reject();
    this.#capital.release(this.#reservationId(planId, intentId));
    runtime.lifecycle = "FAILED";
    return this.#projection(runtime);
  }

  public fill(
    planId: string,
    intentId: string,
    quantityDelta: bigint,
    debitConsumed: bigint,
  ): ExecutionProjection {
    const runtime = this.#runtime(planId);
    if (debitConsumed <= 0n) {
      throw new Error("fill debit must be positive");
    }
    const order = this.#order(runtime, intentId);
    order.assertCanFill(quantityDelta);
    const intent = runtime.plan.intents.find((item) => item.id === intentId);
    if (intent === undefined) {
      throw new Error(`unknown intent ${intentId}`);
    }
    this.#capital.consume(
      this.#reservationId(planId, intentId),
      debitConsumed,
    );
    runtime.deployedByVenue.set(
      intent.venueId,
      (runtime.deployedByVenue.get(intent.venueId) ?? 0n) + debitConsumed,
    );
    order.fill(quantityDelta);
    if (order.projection().lifecycle === "FILLED") {
      this.#capital.release(this.#reservationId(planId, intentId));
    }
    this.#refreshLifecycle(runtime);
    return this.#projection(runtime);
  }

  public cancel(planId: string, intentId: string): ExecutionProjection {
    const runtime = this.#runtime(planId);
    this.#order(runtime, intentId).cancel();
    this.#capital.release(this.#reservationId(planId, intentId));
    runtime.lifecycle = "FAILED";
    return this.#projection(runtime);
  }

  public markUnknown(
    planId: string,
    intentId: string,
  ): ExecutionProjection {
    const runtime = this.#runtime(planId);
    this.#order(runtime, intentId).markUnknown();
    runtime.lifecycle = "UNKNOWN";
    return this.#projection(runtime);
  }

  public reconcileUnknown(
    planId: string,
    intentId: string,
    lifecycle: Exclude<OrderLifecycle, "INTENT" | "SUBMITTING" | "UNKNOWN">,
    cumulativeFilledQuantity: bigint,
    additionalDebit: bigint,
    venueOrderId?: string,
  ): ExecutionProjection {
    const runtime = this.#runtime(planId);
    const order = this.#order(runtime, intentId);
    const priorFilled = order.projection().filledQuantity;
    order.assertCanReconcile(lifecycle, cumulativeFilledQuantity);
    if (cumulativeFilledQuantity > priorFilled) {
      if (additionalDebit <= 0n) {
        throw new Error("reconciled fills require a positive exact debit");
      }
      const intent = runtime.plan.intents.find((item) => item.id === intentId);
      if (intent === undefined) {
        throw new Error(`unknown intent ${intentId}`);
      }
      this.#capital.consume(
        this.#reservationId(planId, intentId),
        additionalDebit,
      );
      runtime.deployedByVenue.set(
        intent.venueId,
        (runtime.deployedByVenue.get(intent.venueId) ?? 0n) + additionalDebit,
      );
    } else if (additionalDebit !== 0n) {
      throw new Error("reconciliation without new fills cannot consume debit");
    }
    order.reconcile(lifecycle, cumulativeFilledQuantity, venueOrderId);
    if (
      lifecycle === "FILLED" ||
      lifecycle === "CANCELED" ||
      lifecycle === "REJECTED"
    ) {
      this.#capital.release(this.#reservationId(planId, intentId));
    }
    this.#refreshLifecycle(runtime);
    return this.#projection(runtime);
  }

  public beginUnwind(planId: string): ExecutionProjection {
    const runtime = this.#runtime(planId);
    if (
      runtime.lifecycle !== "PARTIALLY_HEDGED" &&
      runtime.lifecycle !== "UNKNOWN" &&
      runtime.lifecycle !== "LOCKED"
    ) {
      throw new Error(`cannot unwind plan in ${runtime.lifecycle}`);
    }
    runtime.lifecycle = "UNWINDING";
    return this.#projection(runtime);
  }

  public lockCapitalForResolution(planId: string): ExecutionProjection {
    const runtime = this.#runtime(planId);
    if (
      runtime.lifecycle !== "LOCKED" ||
      runtime.capitalLockedForResolution
    ) {
      throw new Error("plan capital cannot be locked for resolution");
    }
    for (const [venueId, amount] of runtime.deployedByVenue) {
      if (this.#capital.venueProjection(venueId).deployed < amount) {
        throw new Error(`plan deployed capital diverged at ${venueId}`);
      }
    }
    for (const [venueId, amount] of runtime.deployedByVenue) {
      if (amount > 0n) {
        this.#capital.markUnresolved(venueId, amount);
      }
    }
    runtime.capitalLockedForResolution = true;
    return this.#projection(runtime);
  }

  public settlePlan(
    planId: string,
    receivableByVenue: ReadonlyMap<string, bigint>,
  ): ExecutionProjection {
    const runtime = this.#runtime(planId);
    if (
      runtime.lifecycle !== "LOCKED" ||
      !runtime.capitalLockedForResolution
    ) {
      throw new Error("plan is not ready for terminal settlement");
    }
    for (const [venueId, costBasis] of runtime.deployedByVenue) {
      const receivable = receivableByVenue.get(venueId);
      if (receivable === undefined || receivable < 0n) {
        throw new Error(`missing settlement receivable for ${venueId}`);
      }
      if (this.#capital.venueProjection(venueId).unresolved < costBasis) {
        throw new Error(`plan unresolved capital diverged at ${venueId}`);
      }
    }
    for (const [venueId, costBasis] of runtime.deployedByVenue) {
      const receivable = receivableByVenue.get(venueId) ?? 0n;
      this.#capital.recognizeSettlement(venueId, costBasis, receivable);
    }
    runtime.lifecycle = "SETTLED";
    return this.#projection(runtime);
  }

  public projection(planId: string): ExecutionProjection {
    return this.#projection(this.#runtime(planId));
  }

  #refreshLifecycle(runtime: PlanRuntime): void {
    const states = [...runtime.orders.values()].map(
      (order) => order.projection().lifecycle,
    );
    if (states.some((state) => state === "UNKNOWN")) {
      runtime.lifecycle = "UNKNOWN";
    } else if (states.every((state) => state === "FILLED")) {
      runtime.lifecycle = "LOCKED";
    } else if (
      states.some((state) => state === "PARTIAL" || state === "FILLED")
    ) {
      runtime.lifecycle = "PARTIALLY_HEDGED";
    } else if (states.some((state) => state === "ACKNOWLEDGED")) {
      runtime.lifecycle = "ACKNOWLEDGED";
    } else if (states.some((state) => state === "REJECTED")) {
      runtime.lifecycle = "FAILED";
    } else {
      runtime.lifecycle = "SUBMITTING";
    }
  }

  #projection(runtime: PlanRuntime): ExecutionProjection {
    return Object.freeze({
      planId: runtime.plan.id,
      lifecycle: runtime.lifecycle,
      orders: [...runtime.orders.values()]
        .map((order) => order.projection())
        .sort((left, right) => left.intentId.localeCompare(right.intentId)),
    });
  }

  #runtime(planId: string): PlanRuntime {
    const runtime = this.#plans.get(planId);
    if (runtime === undefined) {
      throw new Error(`unknown execution plan ${planId}`);
    }
    return runtime;
  }

  #order(runtime: PlanRuntime, intentId: string): ShadowOrderMachine {
    const order = runtime.orders.get(intentId);
    if (order === undefined) {
      throw new Error(`unknown intent ${intentId}`);
    }
    return order;
  }

  #reservationId(planId: string, intentId: string): string {
    return `${planId}:${intentId}`;
  }
}
