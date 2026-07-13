import { describe, it, expect } from "vitest";
import {
  haAreasOf,
  entitiesInArea,
  scatterInPolygon,
  devicesToAdd,
  lightsInArea,
  resolveRoomAction,
  TOGGLE_AREA_LIGHTS_ACTION,
} from "./areas";
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

describe("lightsInArea", () => {
  it("keeps only light.* entities in the area", () => {
    expect(lightsInArea(hass, "kitchen")).toEqual(["light.k", "light.viadev"]);
  });
  it("returns [] for an area with no lights", () => {
    // "bath" isn't usable here: this fixture's light.override entity-level
    // overrides its device's area to "bath" (see the devicesToAdd tests
    // below), so bath does have one light. Use an area absent from the
    // fixture entirely instead -- no entities means no lights.
    expect(lightsInArea(hass, "attic")).toEqual([]);
  });
});

describe("resolveRoomAction", () => {
  it("resolves the toggle-area-lights convenience to the area's light entities", () => {
    const room = { tap_action: { action: TOGGLE_AREA_LIGHTS_ACTION }, areaId: "kitchen" };
    expect(resolveRoomAction(room, "tap", hass)).toEqual({
      kind: "toggle-lights",
      entityIds: ["light.k", "light.viadev"],
    });
  });
  it("resolves to [] entity ids when the room has no areaId", () => {
    const room = { tap_action: { action: TOGGLE_AREA_LIGHTS_ACTION } };
    expect(resolveRoomAction(room, "tap", hass)).toEqual({ kind: "toggle-lights", entityIds: [] });
  });
  it("falls through to the generic ActionConfig path for a normal action", () => {
    const room = { tap_action: { action: "more-info" }, areaId: "kitchen" };
    expect(resolveRoomAction(room, "tap", hass)).toEqual({
      kind: "generic",
      config: { action: "more-info" },
    });
  });
  it("resolves per-gesture, like actionForGesture", () => {
    const room = { hold_action: { action: "navigate", navigation_path: "/x" } };
    expect(resolveRoomAction(room, "hold", hass)).toEqual({
      kind: "generic",
      config: { action: "navigate", navigation_path: "/x" },
    });
  });
  it("an unconfigured gesture resolves to no action (rooms have no implicit default)", () => {
    expect(resolveRoomAction({}, "tap", hass)).toEqual({ kind: "generic", config: { action: "none" } });
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

describe("scatterInPolygon", () => {
  const square: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
  it("returns the requested count", () => {
    expect(scatterInPolygon(square, 5)).toHaveLength(5);
    expect(scatterInPolygon(square, 0)).toEqual([]);
  });
  it("keeps every point inside the polygon's bbox", () => {
    for (const { x, y } of scatterInPolygon(square, 7)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
  it("does not stack every point on one spot", () => {
    const pts = scatterInPolygon(square, 4).map((p) => `${p.x},${p.y}`);
    expect(new Set(pts).size).toBe(4);
  });
  it("handles a single item (1x1) and a single row (2 items)", () => {
    expect(scatterInPolygon(square, 1)).toHaveLength(1);
    const two = scatterInPolygon(square, 2);
    expect(two).toHaveLength(2);
    for (const { x, y } of [...scatterInPolygon(square, 1), ...two]) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
    }
  });
  it("is deterministic given the same inputs (no Math.random)", () => {
    expect(scatterInPolygon(square, 6)).toEqual(scatterInPolygon(square, 6));
  });
  it("handles a non-rectangular (L-shaped) polygon via its bbox", () => {
    const lshape: Array<[number, number]> = [
      [0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100],
    ];
    for (const { x, y } of scatterInPolygon(lshape, 5)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
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
  it("returns nothing (does not crash) when the room has no polygon", () => {
    // validate.ts accepts `points: []`, so a pasted config reaches here; the
    // empty polygon yields no scatter points and used to throw on `pts[i].x`.
    const empty: Room = { id: "r", points: [] };
    expect(() => devicesToAdd(dHass, "kitchen", empty, new Set())).not.toThrow();
    expect(devicesToAdd(dHass, "kitchen", empty, new Set())).toEqual([]);
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
