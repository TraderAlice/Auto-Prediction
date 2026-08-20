export const DEFAULT_CONTROL_PLANE_URL = "http://127.0.0.1:4100";
export const DEFAULT_CONTROL_PLANE_TIMEOUT_MS = 30_000;

export type ControlPlaneDiagnosticCode =
  | "CONTROL_PLANE_UNREACHABLE"
  | "CONTROL_PLANE_TIMEOUT"
  | "CONTROL_PLANE_HTTP_ERROR"
  | "CONTROL_PLANE_MALFORMED_RESPONSE";

export class ControlPlaneRequestError extends Error {
  public readonly code: ControlPlaneDiagnosticCode;

  public constructor(code: ControlPlaneDiagnosticCode, message: string) {
    super(message);
    this.name = "ControlPlaneRequestError";
    this.code = code;
  }
}

export type ControlPlaneClientOptions = Readonly<{
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}>;

function normalizedBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return url.toString().replace(/\/$/u, "");
  } catch {
    throw new ControlPlaneRequestError(
      "CONTROL_PLANE_UNREACHABLE",
      `Control-plane URL is invalid: ${value}`,
    );
  }
}

function responseDiagnostic(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const diagnostic = (value as Record<string, unknown>).diagnostic;
  return typeof diagnostic === "string" ? diagnostic : null;
}

export async function requestControlPlaneJson(
  path: `/${string}`,
  options: ControlPlaneClientOptions & Readonly<{
    acceptedStatuses?: readonly number[];
  }> = {},
): Promise<Readonly<{ baseUrl: string; status: number; value: unknown }>> {
  const baseUrl = normalizedBaseUrl(
    options.baseUrl ?? process.env.PMH_CONTROL_PLANE_URL ??
      DEFAULT_CONTROL_PLANE_URL,
  );
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONTROL_PLANE_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new ControlPlaneRequestError(
      "CONTROL_PLANE_TIMEOUT",
      "Control-plane timeout must be a positive integer number of milliseconds.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ControlPlaneRequestError(
        "CONTROL_PLANE_TIMEOUT",
        `Control plane did not respond within ${timeoutMs} ms at ${baseUrl}.`,
      );
    }
    throw new ControlPlaneRequestError(
      "CONTROL_PLANE_UNREACHABLE",
      `Control plane is unreachable at ${baseUrl}: ${
        error instanceof Error ? error.message : "request failed"
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }

  let value: unknown;
  try {
    value = JSON.parse(await response.text()) as unknown;
  } catch {
    throw new ControlPlaneRequestError(
      "CONTROL_PLANE_MALFORMED_RESPONSE",
      `Control plane returned non-JSON content for ${path}.`,
    );
  }

  const acceptedStatuses = options.acceptedStatuses ?? Object.freeze([200]);
  if (!acceptedStatuses.includes(response.status)) {
    const detail = responseDiagnostic(value);
    throw new ControlPlaneRequestError(
      "CONTROL_PLANE_HTTP_ERROR",
      `Control plane returned HTTP ${response.status} for ${path}${
        detail === null ? "." : `: ${detail}`
      }`,
    );
  }

  return Object.freeze({ baseUrl, status: response.status, value });
}
