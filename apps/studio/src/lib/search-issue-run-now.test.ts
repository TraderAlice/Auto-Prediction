import { describe, expect, it } from "vitest";

import { searchIssueRunNow } from "./search-issue-run-now.js";

describe("search issue Run now", () => {
  it("allows Run now only when discovery can dispatch", () => {
    expect(searchIssueRunNow({
      dispatchEligibility: "ELIGIBLE",
    })).toEqual({
      dispatchEligible: true,
      schedulerHint:
        "Automatic dispatch is installed but intentionally explicit. Set PMH_SEARCH_ISSUE_TICK_MS to 1000–60000 and restart the control plane; manual runs work now.",
    });
  });

  it("does not claim manual runs work when dispatch is blocked or unknown", () => {
    for (const dispatchEligibility of ["BLOCKED", null] as const) {
      const result = searchIssueRunNow({ dispatchEligibility });
      expect(result.dispatchEligible).toBe(false);
      expect(result.schedulerHint).toBe(
        "Automatic dispatch is installed but intentionally explicit. Manual Run now stays blocked until discovery can dispatch.",
      );
      expect(result.schedulerHint.toLowerCase()).not.toContain("manual runs work now");
      expect(result.schedulerHint).not.toContain("PMH_SEARCH_ISSUE_TICK_MS");
    }
  });
});
