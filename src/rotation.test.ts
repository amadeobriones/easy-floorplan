import { describe, it, expect } from "vitest";
import {
  normalizeRotation,
  footprintRatio,
  stageAspect,
  plateClass,
  plateVars,
  counterRotate,
} from "./rotation";

describe("normalizeRotation", () => {
  it("passes the four quarter turns through", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });
  it("clamps anything else to 0", () => {
    for (const bad of [45, -90, 360, "90", null, undefined, NaN, {}]) {
      expect(normalizeRotation(bad as unknown)).toBe(0);
    }
  });
});

describe("footprintRatio", () => {
  it("keeps W/H at 0 and 180", () => {
    expect(footprintRatio(1000, 600, 0)).toEqual([1000, 600]);
    expect(footprintRatio(1000, 600, 180)).toEqual([1000, 600]);
  });
  it("swaps to H/W at 90 and 270", () => {
    expect(footprintRatio(1000, 600, 90)).toEqual([600, 1000]);
    expect(footprintRatio(1000, 600, 270)).toEqual([600, 1000]);
  });
});

describe("stageAspect", () => {
  it("renders the footprint as a CSS ratio", () => {
    expect(stageAspect(1000, 600, 0)).toBe("1000 / 600");
    expect(stageAspect(1000, 600, 90)).toBe("600 / 1000");
  });
});

describe("plateClass", () => {
  it("names the rotation class", () => {
    expect(plateClass(0)).toBe("rot0");
    expect(plateClass(270)).toBe("rot270");
  });
});

describe("plateVars", () => {
  it("emits the arw and rot custom properties", () => {
    expect(plateVars(1000, 600, 90)).toBe(`--fp-arw:${1000 / 600};--fp-rot:90deg;`);
    expect(plateVars(1000, 600, 0)).toBe(`--fp-arw:${1000 / 600};--fp-rot:0deg;`);
  });
});

describe("counterRotate", () => {
  it("subtracts the plate rotation from the base angle", () => {
    expect(counterRotate(0, 90)).toBe(-90);
    expect(counterRotate(0, 0)).toBe(0);
    expect(counterRotate(30, 180)).toBe(-150);
    expect(counterRotate(45, 270)).toBe(-225);
  });
});
