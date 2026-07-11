import { describe, it, expect } from "vitest";
import { isNight, nightFactor, elevationOf, DEFAULT_SUN_ENTITY, NIGHT_MAX_OPACITY } from "./theme";

describe("elevationOf", () => {
  it("reads a numeric elevation attribute", () => {
    expect(elevationOf({ attributes: { elevation: -12.5 } })).toBe(-12.5);
  });
  it("is undefined when absent, non-numeric, or the state itself is missing", () => {
    expect(elevationOf(undefined)).toBeUndefined();
    expect(elevationOf({ attributes: {} })).toBeUndefined();
    expect(elevationOf({ attributes: { elevation: "low" } })).toBeUndefined();
  });
});

describe("isNight", () => {
  it("reads a plain above_horizon state as day", () => {
    expect(isNight("above_horizon")).toBe(false);
  });
  it("reads a plain below_horizon state as night", () => {
    expect(isNight("below_horizon")).toBe(true);
  });
  it("prefers elevation over state when both are given", () => {
    expect(isNight("above_horizon", -2)).toBe(true);
    expect(isNight("below_horizon", 5)).toBe(false);
  });
  it("treats elevation exactly at the horizon as day", () => {
    expect(isNight(undefined, 0)).toBe(false);
  });
  it("treats a missing entity (no state, no elevation) as day", () => {
    expect(isNight(undefined, undefined)).toBe(false);
    expect(isNight(undefined)).toBe(false);
  });
  it("treats an unrecognised state string as day, not night", () => {
    expect(isNight("unavailable")).toBe(false);
    expect(isNight("unknown")).toBe(false);
  });
});

describe("nightFactor", () => {
  it("is 0 at or above the horizon", () => {
    expect(nightFactor(undefined, 10)).toBe(0);
    expect(nightFactor(undefined, 0)).toBe(0);
  });
  it("is 1 at or past civil twilight's end (-6deg)", () => {
    expect(nightFactor(undefined, -6)).toBe(1);
    expect(nightFactor(undefined, -20)).toBe(1);
  });
  it("eases linearly between the horizon and civil twilight", () => {
    expect(nightFactor(undefined, -3)).toBeCloseTo(0.5);
    expect(nightFactor(undefined, -1.5)).toBeCloseTo(0.25);
  });
  it("without elevation, steps hard on the state", () => {
    expect(nightFactor("above_horizon")).toBe(0);
    expect(nightFactor("below_horizon")).toBe(1);
  });
  it("a missing entity is full day", () => {
    expect(nightFactor(undefined, undefined)).toBe(0);
  });
});

describe("DEFAULT_SUN_ENTITY / NIGHT_MAX_OPACITY", () => {
  it("defaults to HA's own sun entity and keeps the wash short of opaque", () => {
    expect(DEFAULT_SUN_ENTITY).toBe("sun.sun");
    expect(NIGHT_MAX_OPACITY).toBeGreaterThan(0);
    expect(NIGHT_MAX_OPACITY).toBeLessThan(1);
  });
});
