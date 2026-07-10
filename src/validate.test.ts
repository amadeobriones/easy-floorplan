import { describe, it, expect } from "vitest";
import { validateConfig } from "./validate";

const valid = {
  type: "custom:floorplan-card",
  width: 1000,
  height: 600,
  floors: [
    {
      id: "f1",
      name: "Main",
      walls: [{ id: "w1", x1: 0, y1: 0, x2: 100, y2: 0 }],
      rooms: [{ id: "r1", points: [[0, 0], [100, 0], [100, 100]], areaId: "kitchen" }],
      items: [{ id: "i1", x: 50, y: 50, kind: "light", entity: "light.a" }],
      texts: [{ id: "t1", x: 10, y: 10, text: "Hi" }],
      rotation: 90,
    },
  ],
};

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    const r = validateConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.floors![0].id).toBe("f1");
  });
  it("rejects a non-object", () => {
    expect(validateConfig(42).ok).toBe(false);
    expect(validateConfig(null).ok).toBe(false);
  });
  it("rejects a wrong-typed top-level field with a path", () => {
    const r = validateConfig({ ...valid, width: "big" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("config.width"))).toBe(true);
  });
  it("rejects a non-array element list", () => {
    const r = validateConfig({ ...valid, floors: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("config.floors"))).toBe(true);
  });
  it("rejects an item missing a required coordinate, with a deep path", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    delete bad.floors[0].items[0].x;
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("config.floors[0].items[0].x"))).toBe(true);
  });
  it("rejects a bad kind enum and a bad rotation enum", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.floors[0].items[0].kind = "toaster";
    bad.floors[0].rotation = 45;
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("items[0].kind"))).toBe(true);
      expect(r.errors.some((e) => e.includes("rotation"))).toBe(true);
    }
  });
  it("collects multiple errors in one pass", () => {
    const r = validateConfig({ width: "x", height: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
  it("allows unknown extra keys", () => {
    expect(validateConfig({ ...valid, futureKey: 123 }).ok).toBe(true);
  });
});
