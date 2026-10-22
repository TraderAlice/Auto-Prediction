export type SearchIssueRunNow = Readonly<{
  dispatchEligible: boolean;
  schedulerHint: string;
}>;

export function searchIssueRunNow(input: {
  readonly dispatchEligibility: "ELIGIBLE" | "BLOCKED" | null;
}): SearchIssueRunNow {
  // POST /api/v1/search-issues/:id/runs spends the discovery route, same as
  // the hero scan. Pause/resume is local via requestSearchIssueEnabled.
  const dispatchEligible = input.dispatchEligibility === "ELIGIBLE";
  return Object.freeze({
    dispatchEligible,
    schedulerHint: dispatchEligible
      ? "Automatic dispatch is installed but intentionally explicit. Set PMH_SEARCH_ISSUE_TICK_MS to 1000–60000 and restart the control plane; manual runs work now."
      : "Automatic dispatch is installed but intentionally explicit. Manual Run now stays blocked until discovery can dispatch.",
  });
}
