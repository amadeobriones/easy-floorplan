import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./floorplan-card.ts", import.meta.url)), "utf8");

describe("floorplan-card source guards", () => {
  it("keeps preserveAspectRatio=none and never regresses to meet", () => {
    expect(src).toContain('preserveAspectRatio="none"');
    expect(src).not.toContain('preserveAspectRatio="meet"');
  });

  it("wraps the svg and the overlay in a single .plate", () => {
    expect(src).toContain('class="plate');
  });
});
