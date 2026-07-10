import { describe, it, expect } from "vitest";
import { haAreasOf, entitiesInArea, gridLayout, devicesToAdd } from "./areas";
import type { Room } from "./types";

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
  it("handles a single item (1x1) and a single row (2 items)", () => {
    expect(gridLayout(1, { minX: 0, minY: 0, maxX: 100, maxY: 100 })).toHaveLength(1);
    const two = gridLayout(2, { minX: 0, minY: 0, maxX: 100, maxY: 100 });
    expect(two).toHaveLength(2);
    for (const [x, y] of [...gridLayout(1, { minX: 0, minY: 0, maxX: 100, maxY: 100 }), ...two]) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100);
    }
  });
});

const room: Room = { id: "r1", points: [[0, 0], [100, 0], [100, 100], [0, 100]] };
const dHass = {
  entities: {
    "light.lamp": { area_id: "kitchen" },
    "switch.kettle": { area_id: "kitchen" },
    "sensor.temp": { area_id: "kitchen" },
    "sensor.batt": { area_id: "kitchen", entity_category: "diagnostic" },
    "number.cfg": { area_id: "kitchen", entity_category: "config" },
    "light.hidden": { area_id: "kitchen", hidden_by: "user" },
    "weird.thing": { area_id: "kitchen" },
    "light.other": { area_id: "bath" },
  },
  devices: {},
};

describe("devicesToAdd", () => {
  it("keeps recognized domains, drops diagnostic/config/hidden and unknown domains", () => {
    const out = devicesToAdd(dHass, "kitchen", room, new Set());
    expect(out.map((d) => d.entity).sort()).toEqual(["light.lamp", "sensor.temp", "switch.kettle"]);
  });
  it("infers the kind from the entity", () => {
    const out = devicesToAdd(dHass, "kitchen", room, new Set());
    expect(out.find((d) => d.entity === "sensor.temp")!.kind).toBe("sensor");
  });
  it("skips already-placed entities", () => {
    const out = devicesToAdd(dHass, "kitchen", room, new Set(["light.lamp"]));
    expect(out.map((d) => d.entity)).not.toContain("light.lamp");
  });
  it("positions inside the room bbox and is deterministic", () => {
    const a = devicesToAdd(dHass, "kitchen", room, new Set());
    const b = devicesToAdd(dHass, "kitchen", room, new Set());
    expect(a).toEqual(b);
    for (const d of a) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(100);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThanOrEqual(100);
    }
  });
  it("returns [] when nothing qualifies", () => {
    expect(devicesToAdd(dHass, "empty", room, new Set())).toEqual([]);
  });
});
