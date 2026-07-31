import { z } from "zod";

const IdentifierSchema = z.string().trim().min(1).max(256);
const InstantSchema = z.iso.datetime({ offset: true });
const HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const ResolutionStateSchema = z.object({
  id: IdentifierSchema,
  label: z.string().min(1),
  terminalKind: z.enum(["PAYOUT", "VOID", "CANCELED", "INVALID"]),
  dimensions: z.record(IdentifierSchema, IdentifierSchema).readonly(),
});

const OutcomeSpaceBase = {
  id: IdentifierSchema,
  states: z.array(ResolutionStateSchema).min(1).readonly(),
};

export const OutcomeSpaceSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...OutcomeSpaceBase, kind: z.literal("BINARY") }),
    z.object({
      ...OutcomeSpaceBase,
      kind: z.literal("CATEGORICAL"),
      exhaustive: z.boolean(),
    }),
    z.object({
      ...OutcomeSpaceBase,
      kind: z.literal("SCALAR_RANGE"),
      unit: z.string().min(1),
      ranges: z
        .array(
          z.object({
            stateId: IdentifierSchema,
            lowerInclusive: z.string(),
            upperExclusive: z.string().nullable(),
          }),
        )
        .min(1)
        .readonly(),
    }),
    z.object({
      ...OutcomeSpaceBase,
      kind: z.literal("CONDITIONAL"),
      conditionClaimIds: z.array(IdentifierSchema).min(1).readonly(),
    }),
    z.object({
      ...OutcomeSpaceBase,
      kind: z.literal("MULTIVARIATE"),
      dimensionNames: z.array(IdentifierSchema).min(2).readonly(),
    }),
  ])
  .superRefine((space, context) => {
    const ids = space.states.map((state) => state.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "resolution state ids must be unique",
        path: ["states"],
      });
    }

    if (space.kind === "SCALAR_RANGE") {
      const stateIds = new Set(ids);
      for (const range of space.ranges) {
        if (!stateIds.has(range.stateId)) {
          context.addIssue({
            code: "custom",
            message: `range references unknown state ${range.stateId}`,
            path: ["ranges"],
          });
        }
      }
    }
  });

export const ResolutionSpecificationSchema = z.object({
  id: IdentifierSchema,
  authority: z.object({
    name: z.string().min(1),
    sourceUrl: z.url(),
  }),
  opensAt: InstantSchema.nullable(),
  closesAt: InstantSchema,
  observationStartsAt: InstantSchema.nullable(),
  observationEndsAt: InstantSchema.nullable(),
  resolvesBy: InstantSchema.nullable(),
  timezone: z.string().min(1),
  rules: z.object({
    rawText: z.string().min(1),
    rawHash: HashSchema,
    version: z.string().min(1),
    fetchedAt: InstantSchema,
    sourceUrl: z.url(),
  }),
  exceptionalStates: z.object({
    void: z.string().min(1),
    canceled: z.string().min(1),
    invalid: z.string().min(1),
    ambiguous: z.string().min(1),
    correction: z.string().min(1),
    appeal: z.string().min(1),
  }),
});

export const ClaimSchema = z.object({
  id: IdentifierSchema,
  title: z.string().min(1),
  description: z.string(),
  domain: IdentifierSchema,
  resolutionSpecId: IdentifierSchema,
  outcomeSpaceId: IdentifierSchema,
});

export const ListingSchema = z.object({
  id: IdentifierSchema,
  venueId: IdentifierSchema,
  venueInstrumentId: IdentifierSchema,
  claimId: IdentifierSchema,
  resolutionSpecId: IdentifierSchema,
  outcomeSpaceId: IdentifierSchema,
  collateralScaleById: z.record(IdentifierSchema, z.bigint().positive()).readonly(),
  payoutByState: z
    .record(IdentifierSchema, z.record(IdentifierSchema, z.bigint()).readonly())
    .readonly(),
  ruleHash: HashSchema,
  feeScheduleHash: HashSchema,
  sourceFixtureHash: HashSchema,
});

export type ResolutionState = z.infer<typeof ResolutionStateSchema>;
export type OutcomeSpace = z.infer<typeof OutcomeSpaceSchema>;
export type ResolutionSpecification = z.infer<
  typeof ResolutionSpecificationSchema
>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Listing = z.infer<typeof ListingSchema>;

export function assertCompletePayoutPartition(
  outcomeSpace: OutcomeSpace,
  listing: Listing,
): void {
  const expected = new Set(outcomeSpace.states.map((state) => state.id));
  const actual = new Set(Object.keys(listing.payoutByState));
  if (
    expected.size !== actual.size ||
    [...expected].some((stateId) => !actual.has(stateId))
  ) {
    throw new Error(
      `listing ${listing.id} payout partition does not match outcome space ${outcomeSpace.id}`,
    );
  }

  const collateralIds = new Set(Object.keys(listing.collateralScaleById));
  for (const [stateId, payouts] of Object.entries(listing.payoutByState)) {
    for (const collateralId of Object.keys(payouts)) {
      if (!collateralIds.has(collateralId)) {
        throw new Error(
          `state ${stateId} pays unknown collateral ${collateralId}`,
        );
      }
    }
  }
}
