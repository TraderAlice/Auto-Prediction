import { describe, expect, it } from "vitest";
import { parseWorkspaceRoute, serializeWorkspaceRoute } from "./workspace-route.js";

const hashes = Array.from({ length: 7 }, (_, index) =>
  `sha256:${String(index).repeat(64)}`
);

describe("Studio workspace routes", () => {
  it("maps stable product route names to internal views", () => {
    expect(parseWorkspaceRoute("?view=findings")).toEqual({
      view: "scouts",
      proposalIds: [],
    });
    expect(parseWorkspaceRoute("?view=review").view).toBe("lifecycle");
    expect(parseWorkspaceRoute("?view=budgets").view).toBe("budgets");
    expect(parseWorkspaceRoute("?view=agents").view).toBe("agents");
    expect(parseWorkspaceRoute("?view=unknown").view).toBe("archaeologist");
  });

  it("retains only five valid unique proposal hashes on review routes", () => {
    const route = parseWorkspaceRoute(
      `?view=review&proposals=${[...hashes, hashes[1], "not-a-hash"].join(",")}`,
    );
    expect(route.proposalIds).toEqual(hashes.slice(0, 5));
  });

  it("drops proposal focus outside focused research routes", () => {
    expect(parseWorkspaceRoute(`?view=findings&proposals=${hashes[0]}`).proposalIds)
      .toEqual([]);
    expect(serializeWorkspaceRoute("scouts", [hashes[0]!])).toBe("?view=findings");
  });

  it("serializes and restores a focused review handoff", () => {
    const search = serializeWorkspaceRoute("lifecycle", hashes.slice(0, 2));
    expect(parseWorkspaceRoute(search)).toEqual({
      view: "lifecycle",
      proposalIds: hashes.slice(0, 2),
    });
  });

  it("serializes and restores a focused evidence handoff", () => {
    const search = serializeWorkspaceRoute("evidence", hashes.slice(0, 2));
    expect(parseWorkspaceRoute(search)).toEqual({
      view: "evidence",
      proposalIds: hashes.slice(0, 2),
    });
  });
});
