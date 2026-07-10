import { describe, it, expect } from "vitest";
import { haAreasOf, entitiesInArea, gridLayout } from "./areas";

const hass = {
  areas: {
    kitchen: { area_id: "kitchen", name: "Kitchen" },
    bath: { area_id: "bath", name: "Bathroom" },
    bad: { name: "no id" },
  },
  entities: {
    "light.k": { area_id: "kitchen" },
    "light.viadev": { area_id: null, device_id: "d1" },
    "sensor.other": { area_id: "bath" },
    "light.nowhere": { area_id: null, device_id: "dX" },
    "light.override": { area_id: "bath", device_id: "d1" },
  },
  devices: { d1: { area_id: "kitchen" }, dX: {} },
};

describe("haAreasOf", () => {
  it("lists valid areas sorted by name", () => {
    expect(haAreasOf(hass).map((a) => a.area_id)).toEqual(["bath", "kitchen"]);
  });
  it("returns [] when hass has no areas", () => {
    expect(haAreasOf({})).toEqual([]);
    expect(haAreasOf(null)).toEqual([]);
  });
});

describe("entitiesInArea", () => {
  it("includes entity-level area matches", () => {
    expect(entitiesInArea(hass, "kitchen")).toContain("light.k");
  });
  it("includes device-level area when the entity has no own area", () => {
    expect(entitiesInArea(hass, "kitchen")).toContain("light.viadev");
  });
  it("entity-level area overrides the device area", () => {
    expect(entitiesInArea(hass, "bath")).toContain("light.override");
    expect(entitiesInArea(hass, "kitchen")).not.toContain("light.override");
  });
  it("excludes an entity with no area and an area-less device", () => {
    expect(entitiesInArea(hass, "kitchen")).not.toContain("light.nowhere");
  });
  it("returns a sorted list", () => {
    const r = entitiesInArea(hass, "kitchen");
    expect(r).toEqual([...r].sort());
  });
});

describe("gridLayout", () => {
  const bbox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  it("returns the requested count", () => {
    expect(gridLayout(5, bbox)).toHaveLength(5);
    expect(gridLayout(0, bbox)).toEqual([]);
  });
  it("keeps every point inside the bbox", () => {
    for (const [x, y] of gridLayout(7, bbox)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
  it("does not stack every point on one spot", () => {
    const pts = gridLayout(4, bbox).map((p) => p.join(","));
    expect(new Set(pts).size).toBe(4);
  });
});
