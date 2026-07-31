import { z } from "zod";

export const VenueCapabilitySchema = z.enum([
  "MARKET_CATALOG",
  "CONTRACT_RULES",
  "REALTIME_BOOK",
  "TRADE_TAPE",
  "ORDER_GATEWAY",
  "POSITION_GATEWAY",
  "BALANCE_GATEWAY",
  "SETTLEMENT_GATEWAY",
  "CONDITIONAL_TOKEN",
  "LIQUIDITY_PROVISION",
  "COMBO_RFQ",
  "AMM_POOL",
]);

export const QualificationStageSchema = z.enum([
  "DISCOVER",
  "OBSERVE",
  "PRICE",
  "EXECUTE",
  "HEDGE",
  "MAKE",
  "SETTLE",
]);

export const CapabilityEvidenceSchema = z.object({
  capability: VenueCapabilitySchema,
  implemented: z.boolean(),
  qualification: z.array(QualificationStageSchema).readonly(),
  evidenceRefs: z.array(z.string().min(1)).readonly(),
  limitations: z.array(z.string().min(1)).readonly(),
});

export const VenueManifestSchema = z.object({
  venueId: z.string().min(1),
  displayName: z.string().min(1),
  adapterVersion: z.string().min(1),
  protocolIdentity: z.string().min(1),
  officialSources: z.array(z.url()).min(1).readonly(),
  mechanisms: z.array(z.string().min(1)).min(1).readonly(),
  precisionRules: z.array(z.string().min(1)).min(1).readonly(),
  authenticationBoundary: z.string().min(1),
  capabilities: z.array(CapabilityEvidenceSchema).min(1).readonly(),
  liveExecutionEnabled: z.literal(false),
});

export type VenueCapability = z.infer<typeof VenueCapabilitySchema>;
export type QualificationStage = z.infer<typeof QualificationStageSchema>;
export type CapabilityEvidence = z.infer<typeof CapabilityEvidenceSchema>;
export type VenueManifest = z.infer<typeof VenueManifestSchema>;

const STAGE_ORDER: Readonly<Record<QualificationStage, number>> = {
  DISCOVER: 0,
  OBSERVE: 1,
  PRICE: 2,
  EXECUTE: 3,
  HEDGE: 4,
  MAKE: 5,
  SETTLE: 6,
};

export function assertQualificationChain(
  evidence: CapabilityEvidence,
): void {
  const stages = new Set(evidence.qualification);
  for (const stage of stages) {
    const stageIndex = STAGE_ORDER[stage];
    for (const [required, requiredIndex] of Object.entries(STAGE_ORDER)) {
      if (requiredIndex < stageIndex && !stages.has(required as QualificationStage)) {
        throw new Error(
          `${evidence.capability} qualification ${stage} lacks prerequisite ${required}`,
        );
      }
    }
  }
  if (!evidence.implemented && evidence.qualification.length > 0) {
    throw new Error(
      `${evidence.capability} cannot be qualified without an implementation`,
    );
  }
}

export function assertManifest(manifest: VenueManifest): VenueManifest {
  const parsed = VenueManifestSchema.parse(manifest);
  const capabilities = parsed.capabilities.map((item) => item.capability);
  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error("venue manifest contains duplicate capabilities");
  }
  parsed.capabilities.forEach(assertQualificationChain);
  return parsed;
}
