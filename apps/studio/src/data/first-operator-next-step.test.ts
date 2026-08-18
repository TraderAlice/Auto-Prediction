import { describe, expect, it } from "vitest";

import {
  catalogHealthLabel,
  discoverFirstStep,
  discoverSpendAction,
  findingsPrimaryAction,
  inspirationEmptyState,
  isCredentialBlockedDispatch,
} from "./first-operator-next-step";

const emptyCatalog = Object.freeze({
  healthySourceCount: 0,
  sourceCount: 7,
  listingCount: 0,
});

const populatedCatalog = Object.freeze({
  healthySourceCount: 6,
  sourceCount: 7,
  listingCount: 600,
});

describe("first-operator next step", () => {
  it("uses the sidebar System ready words for source health", () => {
    expect(catalogHealthLabel(populatedCatalog)).toBe(
      "System ready · 6/7 sources · 600 markets",
    );
  });

  it("makes Refresh catalogs the Discover first step on an empty desk", () => {
    const step = discoverFirstStep(emptyCatalog);
    expect(step.title).toBe("First step");
    expect(step.primaryAction).toBe("REFRESH_CATALOGS");
    expect(step.primaryLabel).toBe("Refresh catalogs");
    expect(step.sourceHealthLabel).toContain("0/7 sources");
    expect(step.body).toMatch(/Refresh anonymous catalogs/);
    expect(step.body).not.toMatch(/Readiness/);
  });

  it("keeps Refresh catalogs visible after catalogs already exist", () => {
    const step = discoverFirstStep(populatedCatalog);
    expect(step.primaryLabel).toBe("Refresh catalogs");
    expect(step.sourceHealthLabel).toBe(
      "System ready · 6/7 sources · 600 markets",
    );
    expect(step.body).toMatch(/Refresh catalogs/);
    expect(step.body).toMatch(/heuristic scan/);
  });

  it("tells an empty inspiration inbox what to do next", () => {
    expect(inspirationEmptyState(false)).toEqual({
      title: "No useful detours yet",
      body: "Refresh catalogs on this page first, then start a heuristic scan. Cross-lens inspirations appear here after a scan finds a grounded relation outside its assignment.",
    });
    expect(inspirationEmptyState(true).body).toMatch(/Agent operations/);
    expect(inspirationEmptyState(true).body).not.toMatch(/Readiness/);
  });

  it("treats BLOCKED and credential-unavailable diagnostics as blocked dispatch", () => {
    expect(isCredentialBlockedDispatch("BLOCKED", "runtime unavailable")).toBe(true);
    expect(isCredentialBlockedDispatch("ELIGIBLE", "credential unavailable")).toBe(false);
    expect(isCredentialBlockedDispatch(undefined, "Discovery is blocked before model spend: credential unavailable")).toBe(true);
    expect(isCredentialBlockedDispatch("ELIGIBLE", "ready")).toBe(false);
    expect(isCredentialBlockedDispatch(undefined, null)).toBe(false);
  });

  it("replaces Explore next as the Findings primary when dispatch is blocked", () => {
    const action = findingsPrimaryAction({
      dispatchEligibility: "BLOCKED",
      diagnostic: "credential unavailable",
    });
    expect(action.exploreNextPrimary).toBe(false);
    expect(action.kind).toBe("OPEN_AGENT_OPERATIONS");
    expect(action.label).toBe("Open Agent operations");
    expect(action.helper).toMatch(/Codex OAuth session/);
    expect(action.helper).toMatch(/Discover/);
    expect(action.helper).not.toMatch(/Readiness/);
  });

  it("keeps Explore next as the Findings primary when dispatch is eligible", () => {
    const action = findingsPrimaryAction({
      dispatchEligibility: "ELIGIBLE",
      diagnostic: "ready",
    });
    expect(action).toEqual({
      kind: "EXPLORE_NEXT",
      label: "Explore next",
      helper: "",
      exploreNextPrimary: true,
    });
  });

  it("points Discover spend at Agent operations when credentials are blocked", () => {
    expect(discoverSpendAction(true)).toEqual({
      kind: "OPEN_AGENT_OPERATIONS",
      label: "Open Agent operations",
    });
    expect(discoverSpendAction(false)).toEqual({
      kind: "HEURISTIC_SCAN",
      label: "Start heuristic scan",
    });
  });
});
