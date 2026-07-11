import { describe, it, expect } from "vitest";
import {
  tempColor,
  DEFAULT_THERMAL_RANGE,
  renderThermalOverlay,
  THERMAL_FILL_OPACITY,
  THERMAL_LAYER,
} from "./thermal";
import type { Room, Floor, RenderHass, FloorplanCardConfig } from "./types";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";

function fakeHass(states: Record<string, { state: string }>): RenderHass {
  return { states, formatEntityState: (s: { state: string }) => s.state } as unknown as RenderHass;
}

function fakeFloor(rooms: Room[]): Floor {
  return { id: "f1", name: "F1", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [], rooms };
}

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

describe("renderThermalOverlay", () => {
  const room: Room = {
    id: "r1",
    points: [[0, 0], [100, 0], [100, 80], [0, 80]],
  };
  const values = (t: unknown) => JSON.stringify((t as { values: unknown[] }).values);

  it("draws the room's polygon tinted by tempColor", () => {
    const v = values(renderThermalOverlay(room, DEFAULT_THERMAL_RANGE.mid));
    expect(v).toContain("0,0 100,0 100,80 0,80");
    expect(v).toContain("rgb(176, 190, 197)");
  });

  it("uses the fixed overlay opacity, not the room's own fillOpacity", () => {
    const v = values(renderThermalOverlay({ ...room, fillOpacity: 0.9 }, DEFAULT_THERMAL_RANGE.min));
    expect(v).toContain(String(THERMAL_FILL_OPACITY));
    expect(v).not.toContain("0.9");
  });

  it("never intercepts clicks (pointer-events: none)", () => {
    const html = (renderThermalOverlay(room, DEFAULT_THERMAL_RANGE.max).strings ?? []).join("");
    expect(html).toContain('pointer-events="none"');
  });
});

describe("THERMAL_LAYER", () => {
  it("has the layer-chip identity", () => {
    expect(THERMAL_LAYER.id).toBe("thermalLayer");
    expect(THERMAL_LAYER.icon).toBe("mdi:thermometer");
    expect(THERMAL_LAYER.label).toBe("Climate layer");
  });

  it("render: draws an overlay for each room with a tempEntity and a numeric reading", () => {
    const rooms: Room[] = [
      { id: "warm", points: [[0, 0], [10, 0], [10, 10], [0, 10]], tempEntity: "sensor.warm" },
      { id: "no-sensor", points: [[20, 20], [30, 20], [30, 30], [20, 30]] }, // no tempEntity
    ];
    const hass = fakeHass({ "sensor.warm": { state: "26" } });
    const out = THERMAL_LAYER.render({ floor: fakeFloor(rooms), hass, config: {} as FloorplanCardConfig });
    const html = JSON.stringify(out);
    expect(html).toContain("0,0 10,0 10,10 0,10"); // the shaded room's polygon is drawn
    expect(html).toContain("rgb("); // a colour was resolved
    expect(html).not.toContain("20,20 30,20 30,30 20,30"); // the sensor-less room is skipped entirely
  });

  it("render: skips a room whose sensor is unavailable/unknown/non-numeric", () => {
    const rooms: Room[] = [
      { id: "r1", points: [[0, 0], [10, 0], [10, 10], [0, 10]], tempEntity: "sensor.dead" },
    ];
    const hass = fakeHass({ "sensor.dead": { state: "unavailable" } });
    const out = THERMAL_LAYER.render({ floor: fakeFloor(rooms), hass, config: {} as FloorplanCardConfig });
    expect(JSON.stringify(out)).not.toContain("rgb(");
  });

  it("render: skips a room with no tempEntity even with hass present", () => {
    const rooms: Room[] = [{ id: "r1", points: [[0, 0], [10, 0], [10, 10], [0, 10]] }];
    const out = THERMAL_LAYER.render({
      floor: fakeFloor(rooms), hass: fakeHass({}), config: {} as FloorplanCardConfig,
    });
    expect(JSON.stringify(out)).not.toContain("rgb(");
  });

  it("watched: every room's tempEntity, across all floors", () => {
    const cfg = {
      floors: [
        fakeFloor([
          { id: "a", points: [], tempEntity: "sensor.a" },
          { id: "b", points: [] }, // no tempEntity -- not watched
        ]),
        fakeFloor([{ id: "c", points: [], tempEntity: "sensor.c" }]),
      ],
    } as unknown as FloorplanCardConfig;
    expect([...THERMAL_LAYER.watched(cfg)].sort()).toEqual(["sensor.a", "sensor.c"]);
  });

  it("watched: empty when no room has a tempEntity", () => {
    const cfg = { floors: [fakeFloor([{ id: "a", points: [] }])] } as unknown as FloorplanCardConfig;
    expect([...THERMAL_LAYER.watched(cfg)]).toEqual([]);
  });
});

describe("thermalLayer registration", () => {
  const cfg = {
    type: "x",
    width: 10,
    height: 10,
    floors: [fakeFloor([{ id: "r1", points: [[0, 0], [1, 1]], tempEntity: "sensor.living_temp" }])],
  } as unknown as FloorplanCardConfig;

  it("is registered in LIVE_LAYERS", () => {
    expect(LIVE_LAYERS).toContain(THERMAL_LAYER);
  });

  it("is excluded by default (flag off) -- byte-identical, zero watched entities", () => {
    expect(enabledLayers(cfg).some((l) => l.id === "thermalLayer")).toBe(false);
    expect(layerWatchedEntities(cfg).has("sensor.living_temp")).toBe(false);
  });

  it("is included and watched once the flag is on", () => {
    const on = { ...cfg, features: { thermalLayer: true } };
    expect(enabledLayers(on).some((l) => l.id === "thermalLayer")).toBe(true);
    expect(layerWatchedEntities(on).has("sensor.living_temp")).toBe(true);
  });
});
