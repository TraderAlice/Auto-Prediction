export const MODEL_FAILURE_CATEGORIES = Object.freeze([
  "TIMEOUT",
  "TASK_DEADLINE",
  "RETRYABLE_PROVIDER",
  "REJECTED_PROVIDER",
  "INVALID_PROVIDER_OUTPUT",
  "INVALID_MODEL_OUTPUT",
  "NETWORK_OR_UNKNOWN",
] as const);

export type ModelFailureCategory =
  (typeof MODEL_FAILURE_CATEGORIES)[number];

const MODEL_FAILURE_MARKER = Symbol.for(
  "pmh.model-request-failure.v1",
);

export class ModelRequestFailure extends Error {
  readonly [MODEL_FAILURE_MARKER] = true;

  public constructor(
    public readonly provider: "DEEPSEEK" | "OPENAI" | "MODEL",
    public readonly category: ModelFailureCategory,
    public readonly requestAttemptCount: number,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(`${provider} model request failed [${category}]`, {
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "ModelRequestFailure";
    if (
      !Number.isSafeInteger(requestAttemptCount) ||
      requestAttemptCount < 0 ||
      requestAttemptCount > 16
    ) {
      throw new Error("model request attempt count is invalid or unbounded");
    }
  }

  public static isInstance(error: unknown): error is ModelRequestFailure {
    return error !== null && typeof error === "object" &&
      (error as Record<PropertyKey, unknown>)[MODEL_FAILURE_MARKER] === true;
  }
}

export function modelFailureTelemetry(
  error: unknown,
  workerKind: "HEURISTIC" | "MODEL",
): Readonly<{
  requestAttemptCount: number;
  category: ModelFailureCategory | null;
}> {
  if (workerKind === "HEURISTIC") {
    return Object.freeze({ requestAttemptCount: 0, category: null });
  }
  if (ModelRequestFailure.isInstance(error)) {
    return Object.freeze({
      requestAttemptCount: error.requestAttemptCount,
      category: error.category,
    });
  }
  return Object.freeze({
    requestAttemptCount: 1,
    category: "INVALID_MODEL_OUTPUT",
  });
}
