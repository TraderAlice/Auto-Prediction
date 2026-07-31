import { hashCanonical, type Hash } from "@pmh/domain";
import { z } from "zod";

export const InertGatewayAcknowledgementSchema = z.object({
  schemaVersion: z.literal("pmh.inert-order-ack.v1"),
  venueId: z.string().min(1),
  targetEnvironment: z.enum(["DEMO", "SANDBOX"]),
  targetBaseUrl: z.string().url(),
  targetPath: z.string().startsWith("/"),
  targetMethod: z.enum(["GET", "POST", "DELETE"]),
  operation: z.enum(["SUBMIT", "CANCEL", "RECONCILE"]),
  requestHash: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .transform((value) => value as Hash),
  status: z.literal("REJECTED_INERT"),
  liveExecutionEnabled: z.literal(false),
  networkAttempted: z.literal(false),
  credentialsUsed: z.literal(false),
  valueMovingOperation: z.literal(false),
  reason: z.literal(
    "Order gateway is inert; request shape recorded, transport intentionally absent.",
  ),
});

export type InertGatewayAcknowledgement = z.infer<
  typeof InertGatewayAcknowledgementSchema
>;

export function createInertGatewayAcknowledgement(input: {
  venueId: string;
  targetEnvironment: "DEMO" | "SANDBOX";
  targetBaseUrl: string;
  targetPath: string;
  targetMethod: "GET" | "POST" | "DELETE";
  operation: "SUBMIT" | "CANCEL" | "RECONCILE";
  request: unknown;
}): InertGatewayAcknowledgement {
  return InertGatewayAcknowledgementSchema.parse({
    schemaVersion: "pmh.inert-order-ack.v1",
    venueId: input.venueId,
    targetEnvironment: input.targetEnvironment,
    targetBaseUrl: input.targetBaseUrl,
    targetPath: input.targetPath,
    targetMethod: input.targetMethod,
    operation: input.operation,
    requestHash: hashCanonical({
      method: input.targetMethod,
      path: input.targetPath,
      request: input.request,
    }),
    status: "REJECTED_INERT",
    liveExecutionEnabled: false,
    networkAttempted: false,
    credentialsUsed: false,
    valueMovingOperation: false,
    reason:
      "Order gateway is inert; request shape recorded, transport intentionally absent.",
  });
}
