import { describe, it, expect } from "vitest";
import { tempColor, DEFAULT_THERMAL_RANGE } from "./thermal";

describe("tempColor", () => {
  it("renders the cold colour at/below the range minimum", () => {
    expect(tempColor(DEFAULT_THERMAL_RANGE.min)).toBe("rgb(33, 150, 243)");
    expect(tempColor(-40)).toBe("rgb(33, 150, 243)"); // clamps below min
  });

  it("renders the neutral colour at the comfort midpoint", () => {
    expect(tempColor(DEFAULT_THERMAL_RANGE.mid)).toBe("rgb(176, 190, 197)");
  });

  it("renders the hot colour at/above the range maximum", () => {
    expect(tempColor(DEFAULT_THERMAL_RANGE.max)).toBe("rgb(244, 67, 54)");
    expect(tempColor(200)).toBe("rgb(244, 67, 54)"); // clamps above max
  });

  it("interpolates between cold and neutral below the midpoint", () => {
    // Halfway between min (16) and mid (21) -> halfway between cold and neutral.
    const half = tempColor(18.5);
    expect(half).not.toBe("rgb(33, 150, 243)");
    expect(half).not.toBe("rgb(176, 190, 197)");
    expect(half).toBe("rgb(105, 170, 220)");
  });

  it("interpolates between neutral and hot above the midpoint", () => {
    // Halfway between mid (21) and max (27) -> halfway between neutral and hot.
    const half = tempColor(24);
    expect(half).toBe("rgb(210, 129, 126)");
  });

  it("honours a custom range", () => {
    const range = { min: 0, mid: 50, max: 100 };
    expect(tempColor(0, range)).toBe("rgb(33, 150, 243)");
    expect(tempColor(50, range)).toBe("rgb(176, 190, 197)");
    expect(tempColor(100, range)).toBe("rgb(244, 67, 54)");
  });
});
