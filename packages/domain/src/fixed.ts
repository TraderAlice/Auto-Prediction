const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.(\d+))?$/;

export type Fixed = bigint;
export type Scale = bigint;

export class FixedPointError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FixedPointError";
  }
}

export function decimalPlaces(scale: Scale): number {
  if (scale < 1n) {
    throw new FixedPointError("scale must be positive");
  }

  let remaining = scale;
  let places = 0;
  while (remaining > 1n && remaining % 10n === 0n) {
    remaining /= 10n;
    places += 1;
  }

  if (remaining !== 1n) {
    throw new FixedPointError("scale must be a power of ten");
  }
  return places;
}

export function parseFixed(value: string, scale: Scale): Fixed {
  const places = decimalPlaces(scale);
  const match = DECIMAL_PATTERN.exec(value);
  if (match === null) {
    throw new FixedPointError(`invalid decimal string: ${value}`);
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  if (fraction.length > places) {
    throw new FixedPointError(
      `decimal has ${fraction.length} places but scale permits ${places}`,
    );
  }

  const paddedFraction = fraction.padEnd(places, "0");
  const magnitude =
    BigInt(whole) * scale + (paddedFraction === "" ? 0n : BigInt(paddedFraction));
  return negative ? -magnitude : magnitude;
}

export function formatFixed(value: Fixed, scale: Scale): string {
  const places = decimalPlaces(scale);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / scale;
  if (places === 0) {
    return `${negative ? "-" : ""}${whole}`;
  }

  const fraction = (magnitude % scale)
    .toString()
    .padStart(places, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

export function divideFloor(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new FixedPointError("denominator must be positive");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder < 0n ? quotient - 1n : quotient;
}

export function divideCeil(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new FixedPointError("denominator must be positive");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder > 0n ? quotient + 1n : quotient;
}

export function multiplyFixedFloor(
  left: Fixed,
  right: Fixed,
  scale: Scale,
): Fixed {
  decimalPlaces(scale);
  return divideFloor(left * right, scale);
}

export function multiplyFixedCeil(
  left: Fixed,
  right: Fixed,
  scale: Scale,
): Fixed {
  decimalPlaces(scale);
  return divideCeil(left * right, scale);
}
