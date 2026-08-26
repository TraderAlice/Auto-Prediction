import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("preflight disposition fact labels", () => {
  it("does not ellipsize POST-FEE UPPER BOUND", () => {
    const css = readFileSync(join(studioRoot, "index.css"), "utf8");
    const start = css.indexOf(".preflight-disposition-facts span {");
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("}", start) + 1);
    expect(block).toContain("white-space: normal");
    expect(block).not.toContain("ellipsis");
    expect(block).not.toContain("nowrap");
  });

  it("keeps the Post-fee upper bound copy on the current-snapshot row", () => {
    const app = readFileSync(join(studioRoot, "App.tsx"), "utf8");
    expect(app).toContain("<span>Post-fee upper bound</span>");
    expect(app).toContain("className=\"preflight-disposition-facts\"");
  });
});
