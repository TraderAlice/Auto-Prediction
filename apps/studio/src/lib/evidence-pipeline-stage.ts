export type VerifiedClaimsCounts = Readonly<{
  passedCount: number;
  pendingCount: number;
  activeCount: number;
}>;

export function verifiedClaimsPipelineState(
  claims: VerifiedClaimsCounts,
): "INTERPRETED" | "RUNNING" | "WAITING" {
  if (claims.passedCount > 0) return "INTERPRETED";
  if (claims.pendingCount + claims.activeCount > 0) return "RUNNING";
  return "WAITING";
}
