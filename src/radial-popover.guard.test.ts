import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./radial-popover.ts", import.meta.url)), "utf8");

describe("radial-popover source guards", () => {
  it("is a fixed-position portal appended to document.body, so ha-card's/.stage's overflow:hidden never clips it", () => {
    expect(src).toContain("position: fixed");
    expect(src).toContain("document.body.appendChild");
  });
  it("dismisses on Escape and on an outside pointerdown", () => {
    expect(src).toContain('"Escape"');
    expect(src).toContain("_onPointerDown");
  });
  it("dismisses on scroll (a fixed popover would otherwise drift off its anchor)", () => {
    expect(src).toContain("_onScroll");
  });
  it("positions itself via the pure clampPopoverPosition helper, not ad-hoc inline math", () => {
    expect(src).toContain("clampPopoverPosition(");
  });
});
