import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const card = readFileSync(fileURLToPath(new URL("./floorplan-card.ts", import.meta.url)), "utf8");
const editor = readFileSync(fileURLToPath(new URL("./editor.ts", import.meta.url)), "utf8");

describe("radial controls wiring guards", () => {
  it("gates all three hold call sites through radialHasHold, not a hand-rolled condition", () => {
    const matches = card.match(/hasHold: radialHasHold\(/g) ?? [];
    expect(matches.length).toBe(3);
  });
  it("routes a qualifying hold through shouldOpenRadial before opening the popover", () => {
    expect(card).toContain("shouldOpenRadial(");
    expect(card).toContain("openRadialPopover(");
  });
  it("never opens the radial popover from the editor's canvas -- editing must not trigger it", () => {
    // The editor has its own separate pointerdown/pointermove drag wiring for
    // items (_renderItemOverlay) and never uses actionHandler's hold gesture;
    // this guard keeps it that way as the two files evolve independently.
    expect(editor).not.toContain("radial-popover");
    expect(editor).not.toContain("radial-controls");
  });
});
