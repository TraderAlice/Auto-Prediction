import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("preflight stage index circle", () => {
  it("scopes the 22px circle to the step index, not every child span", () => {
    const css = readFileSync(join(studioRoot, "index.css"), "utf8");
    expect(css).toContain(".preflight-stage-index {");
    expect(css).toContain("width: 22px;");
    expect(css).not.toMatch(/\.preflight-stage\s*>\s*span\s*\{/);
  });

  it("marks the step index with preflight-stage-index so Badge stays a pill", () => {
    const app = readFileSync(join(studioRoot, "App.tsx"), "utf8");
    expect(app).toContain('className={stage.status === "PASS" ? "preflight-stage-index" : "preflight-stage-index is-blocked"}');
    expect(app).toContain("<Badge variant={stage.status === \"PASS\" ? \"verified\" : \"shadow\"}>");
  });
});
