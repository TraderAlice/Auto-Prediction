import { describe, expect, it } from "vitest";
import {
  filterProjectionCommands,
  stepCommandIndex,
} from "./command-palette.js";

const projections = [
  { id: "archaeologist", label: "Discover" },
  { id: "scouts", label: "Findings" },
  { id: "budgets", label: "Failure budgets" },
  { id: "lifecycle", label: "Review queue" },
  { id: "preflight", label: "Preflight" },
  { id: "venues", label: "Markets" },
  { id: "evidence", label: "Evidence" },
  { id: "overview", label: "System overview" },
  { id: "agents", label: "Agent operations" },
  { id: "radar", label: "Similarity radar" },
  { id: "cases", label: "Research cases" },
  { id: "books", label: "Order books" },
] as const;

describe("command palette projection filter", () => {
  it("keeps every existing projection when the query is empty", () => {
    expect(filterProjectionCommands(projections, "")).toEqual(projections);
    expect(filterProjectionCommands(projections, "   ")).toEqual(projections);
  });

  it("filters visible projection labels as the operator types", () => {
    expect(filterProjectionCommands(projections, "book").map((item) => item.id))
      .toEqual(["books"]);
    expect(filterProjectionCommands(projections, "REVIEW").map((item) => item.label))
      .toEqual(["Review queue"]);
    expect(filterProjectionCommands(projections, "radar")).toEqual([
      projections.find((item) => item.id === "radar"),
    ]);
  });

  it("returns no destinations when nothing matches", () => {
    expect(filterProjectionCommands(projections, "dispatch spend")).toEqual([]);
    expect(filterProjectionCommands(projections, "zzz")).toEqual([]);
  });

  it("does not invent commands from internal view ids", () => {
    expect(filterProjectionCommands(projections, "scouts")).toEqual([]);
    expect(filterProjectionCommands(projections, "lifecycle")).toEqual([]);
  });

  it("wraps keyboard highlight across the filtered rows", () => {
    expect(stepCommandIndex(12, 11, 1)).toBe(0);
    expect(stepCommandIndex(12, 0, -1)).toBe(11);
    expect(stepCommandIndex(1, 0, 1)).toBe(0);
    expect(stepCommandIndex(0, 3, 1)).toBe(0);
  });
});
