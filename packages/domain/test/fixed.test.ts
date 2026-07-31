import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  FixedPointError,
  formatFixed,
  multiplyFixedCeil,
  multiplyFixedFloor,
  parseFixed,
} from "../src/index.js";

describe("fixed-point conversion", () => {
  it("parses and formats exact decimals without number coercion", () => {
    expect(parseFixed("0.12345678", 100_000_000n)).toBe(12_345_678n);
    expect(parseFixed("-12.5", 100n)).toBe(-1_250n);
    expect(formatFixed(12_340_000n, 100_000_000n)).toBe("0.1234");
  });

  it.each(["NaN", "Infinity", "1e-3", "+1", "01", ".1", "1.000000001"])(
    "rejects invalid or over-precision input %s",
    (value) => {
      expect(() => parseFixed(value, 100_000_000n)).toThrow(FixedPointError);
    },
  );

  it("rounds costs conservatively and never silently promotes a loss", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 18n }),
        fc.bigInt({ min: 0n, max: 100_000_000n }),
        (quantity, price) => {
          const floor = multiplyFixedFloor(quantity, price, 100_000_000n);
          const ceil = multiplyFixedCeil(quantity, price, 100_000_000n);
          expect(floor).toBeLessThanOrEqual(ceil);
          expect(ceil - floor).toBeLessThanOrEqual(1n);
        },
      ),
    );
  });
});
