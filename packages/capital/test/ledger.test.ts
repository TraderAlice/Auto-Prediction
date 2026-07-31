import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CapitalLedger } from "../src/index.js";

describe("per-venue capital ledger", () => {
  it("conserves capital through partial consumption and release", () => {
    const ledger = new CapitalLedger(new Map([["venue:a", 100n]]));
    ledger.reserve("order:1", "venue:a", 80n);
    ledger.consume("order:1", 30n);
    expect(ledger.release("order:1")).toBe(50n);
    expect(ledger.venueProjection("venue:a")).toMatchObject({
      available: 70n,
      reserved: 0n,
      deployed: 30n,
    });
    ledger.assertConservation();
  });

  it("tracks terminal settlement and capital recovery without mark-to-market", () => {
    const ledger = new CapitalLedger(new Map([["venue:a", 100n]]));
    ledger.reserve("order:1", "venue:a", 40n);
    ledger.consume("order:1", 40n);
    ledger.markUnresolved("venue:a", 40n);
    ledger.recognizeSettlement("venue:a", 40n, 55n);
    ledger.recoverReceivable("venue:a", 55n);
    expect(ledger.venueProjection("venue:a")).toMatchObject({
      available: 115n,
      realizedPnl: 15n,
      unresolved: 0n,
      receivable: 0n,
    });
  });

  it("conserves arbitrary partial fills", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (reserved, proposedFill) => {
          const fill = Math.min(reserved, proposedFill);
          const ledger = new CapitalLedger(
            new Map([["venue:a", BigInt(reserved)]]),
          );
          ledger.reserve("order:1", "venue:a", BigInt(reserved));
          if (fill > 0) {
            ledger.consume("order:1", BigInt(fill));
          }
          ledger.release("order:1");
          ledger.assertConservation();
          const projection = ledger.venueProjection("venue:a");
          expect(projection.available + projection.deployed).toBe(
            BigInt(reserved),
          );
        },
      ),
    );
  });

  it("never crosses venue silos", () => {
    const ledger = new CapitalLedger(
      new Map([
        ["venue:a", 10n],
        ["venue:b", 1_000n],
      ]),
    );
    expect(() => ledger.reserve("too-large", "venue:a", 11n)).toThrow(
      /insufficient/,
    );
  });
});
