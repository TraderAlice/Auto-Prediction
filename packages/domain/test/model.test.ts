import { describe, expect, it } from "vitest";
import {
  ListingSchema,
  OutcomeSpaceSchema,
  assertCompletePayoutPartition,
  hashCanonical,
} from "../src/index.js";

const yesNo = OutcomeSpaceSchema.parse({
  id: "outcome:rain",
  kind: "BINARY",
  states: [
    {
      id: "yes",
      label: "Yes",
      terminalKind: "PAYOUT",
      dimensions: { answer: "yes" },
    },
    {
      id: "no",
      label: "No",
      terminalKind: "PAYOUT",
      dimensions: { answer: "no" },
    },
    {
      id: "void",
      label: "Void",
      terminalKind: "VOID",
      dimensions: { answer: "void" },
    },
  ],
});

const fixtureHash = hashCanonical({ fixture: "test" });

describe("outcome partition", () => {
  it("requires a payout vector for every canonical terminal state", () => {
    const listing = ListingSchema.parse({
      id: "listing:rain",
      venueId: "venue:test",
      venueInstrumentId: "RAIN-YES",
      claimId: "claim:rain",
      resolutionSpecId: "rules:rain",
      outcomeSpaceId: yesNo.id,
      collateralScaleById: { usd: 100_000_000n },
      payoutByState: {
        yes: { usd: 100_000_000n },
        no: { usd: 0n },
        void: { usd: 50_000_000n },
      },
      ruleHash: fixtureHash,
      feeScheduleHash: fixtureHash,
      sourceFixtureHash: fixtureHash,
    });
    expect(() => assertCompletePayoutPartition(yesNo, listing)).not.toThrow();

    const incomplete = {
      ...listing,
      payoutByState: { yes: { usd: 100_000_000n }, no: { usd: 0n } },
    };
    expect(() => assertCompletePayoutPartition(yesNo, incomplete)).toThrow(
      /does not match/,
    );
  });

  it("rejects duplicate state ids", () => {
    expect(() =>
      OutcomeSpaceSchema.parse({
        id: "duplicate",
        kind: "BINARY",
        states: [yesNo.states[0], yesNo.states[0]],
      }),
    ).toThrow(/unique/);
  });
});
