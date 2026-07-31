import type { ExecutionPlan } from "./types.js";

export function validateExecutionPlan(plan: ExecutionPlan): ExecutionPlan {
  if (plan.id === "" || plan.intents.length === 0) {
    throw new Error("execution plan requires an id and intents");
  }
  const intentIds = plan.intents.map((intent) => intent.id);
  const clientOrderIds = plan.intents.map((intent) => intent.clientOrderId);
  if (new Set(intentIds).size !== intentIds.length) {
    throw new Error("execution intent ids must be unique");
  }
  if (new Set(clientOrderIds).size !== clientOrderIds.length) {
    throw new Error("client order ids must be unique");
  }
  for (const intent of plan.intents) {
    if (
      intent.id === "" ||
      intent.clientOrderId === "" ||
      intent.quantity <= 0n ||
      intent.quantityScale <= 0n ||
      intent.limitPrice < 0n ||
      intent.maxDebit <= 0n
    ) {
      throw new Error(`execution intent ${intent.id} is invalid`);
    }
  }

  const known = new Set(intentIds);
  const outgoing = new Map<string, string[]>(
    intentIds.map((intentId) => [intentId, []]),
  );
  const incomingCount = new Map<string, number>(
    intentIds.map((intentId) => [intentId, 0]),
  );
  for (const dependency of plan.dependencies) {
    if (
      !known.has(dependency.beforeIntentId) ||
      !known.has(dependency.afterIntentId)
    ) {
      throw new Error("execution dependency references an unknown intent");
    }
    if (dependency.beforeIntentId === dependency.afterIntentId) {
      throw new Error("execution dependency cannot be self-referential");
    }
    outgoing.get(dependency.beforeIntentId)?.push(dependency.afterIntentId);
    incomingCount.set(
      dependency.afterIntentId,
      (incomingCount.get(dependency.afterIntentId) ?? 0) + 1,
    );
  }

  const ready = intentIds.filter((intentId) => incomingCount.get(intentId) === 0);
  let visited = 0;
  while (ready.length > 0) {
    const intentId = ready.shift();
    if (intentId === undefined) {
      break;
    }
    visited += 1;
    for (const next of outgoing.get(intentId) ?? []) {
      const remaining = (incomingCount.get(next) ?? 0) - 1;
      incomingCount.set(next, remaining);
      if (remaining === 0) {
        ready.push(next);
      }
    }
  }
  if (visited !== intentIds.length) {
    throw new Error("execution dependencies contain a cycle");
  }
  return plan;
}
