import { describe, it, expect } from "vitest";
import { parseWatts, powerColor, powerCueBump, DEFAULT_ENERGY_RAMP } from "./energy-layer";

const NEUTRAL = "rgb(148, 163, 184)";
const HOT = "rgb(220, 38, 38)";

describe("parseWatts", () => {
  it("parses a finite number", () => {
    expect(parseWatts("123.5")).toBe(123.5);
    expect(parseWatts("0")).toBe(0);
  });
  it("returns undefined for non-numbers and blanks", () => {
    expect(parseWatts("unavailable")).toBeUndefined();
    expect(parseWatts("")).toBeUndefined();
    expect(parseWatts(undefined)).toBeUndefined();
  });
});

describe("powerColor", () => {
  it("is neutral at or below lowW", () => {
    expect(powerColor(0)).toBe(NEUTRAL);
    expect(powerColor(DEFAULT_ENERGY_RAMP.lowW)).toBe(NEUTRAL);
    expect(powerColor(-50)).toBe(NEUTRAL);
  });
  it("is hot at or above highW (clamps)", () => {
    expect(powerColor(DEFAULT_ENERGY_RAMP.highW)).toBe(HOT);
    expect(powerColor(999999)).toBe(HOT);
  });
  it("is neutral for a non-finite value", () => {
    expect(powerColor(Number.NaN)).toBe(NEUTRAL);
    expect(powerColor(Number.POSITIVE_INFINITY)).toBe(NEUTRAL);
  });
  it("interpolates monotonically between low and high", () => {
    const mid = powerColor(250, { lowW: 0, highW: 500 });
    expect(mid).not.toBe(NEUTRAL);
    expect(mid).not.toBe(HOT);
    expect(mid).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    // a lower draw is closer to neutral: its red channel is <= a higher draw's red channel
    const redOf = (s: string) => Number(s.slice(4, -1).split(",")[0]);
    expect(redOf(powerColor(100, { lowW: 0, highW: 500 })))
      .toBeLessThanOrEqual(redOf(powerColor(400, { lowW: 0, highW: 500 })));
  });
  it("honours custom thresholds", () => {
    expect(powerColor(50, { lowW: 100, highW: 200 })).toBe(NEUTRAL); // below custom lowW
    expect(powerColor(200, { lowW: 100, highW: 200 })).toBe(HOT);    // at custom highW
  });
});

describe("powerCueBump", () => {
  it("is 0 at/below lowW and maxBumpPx at/above highW", () => {
    expect(powerCueBump(0)).toBe(0);
    expect(powerCueBump(DEFAULT_ENERGY_RAMP.highW, 12)).toBe(12);
  });
  it("clamps and handles non-finite as 0", () => {
    expect(powerCueBump(Number.NaN, 12)).toBe(0);
    expect(powerCueBump(999999, 12)).toBe(12);
  });
});
