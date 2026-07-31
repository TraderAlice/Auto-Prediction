import { createHash } from "node:crypto";

export type Hash = `sha256:${string}`;

function canonicalize(value: unknown): unknown {
  if (typeof value === "bigint") {
    return { $bigint: value.toString() };
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value instanceof Map) {
    return [...value.entries()]
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, item]) => [key, canonicalize(item)]);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashCanonical(value: unknown): Hash {
  const digest = createHash("sha256").update(canonicalJson(value)).digest("hex");
  return `sha256:${digest}`;
}

export function hashBytes(value: Uint8Array): Hash {
  const digest = createHash("sha256").update(value).digest("hex");
  return `sha256:${digest}`;
}
