import { describe, it, expect } from "vitest";
import { parseWatts, powerColor, powerCueBump, DEFAULT_ENERGY_RAMP, energyLayer } from "./energy-layer";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";
import type { Floor, FloorplanCardConfig, RenderHass } from "./types";

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

function fakeHass(states: Record<string, { state: string }>): RenderHass {
  return { states, formatEntityState: (s: { state: string }) => s.state } as unknown as RenderHass;
}

const baseFloor: Floor = {
  id: "f1", name: "Floor 1", walls: [], openings: [], items: [], texts: [],
  furniture: [], trackers: [],
};

const cfg = (items: any[]) =>
  ({ type: "x", width: 100, height: 100, items } as any);

describe("energyLayer.watched", () => {
  it("collects powerEntity from items across the floor", () => {
    const c = cfg([
      { id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.a_w" },
      { id: "b", x: 2, y: 2, kind: "switch" },
      { id: "c", x: 3, y: 3, kind: "switch", powerEntity: "sensor.c_w" },
    ]);
    const got = new Set(energyLayer.watched(c));
    expect(got.has("sensor.a_w")).toBe(true);
    expect(got.has("sensor.c_w")).toBe(true);
    expect(got.size).toBe(2); // item b contributes nothing
  });
  it("has the energyLayer id so the framework gates it", () => {
    expect(energyLayer.id).toBe("energyLayer");
  });
  it("watches every item's powerEntity, across floors", () => {
    const c = {
      type: "x", width: 10, height: 10,
      floors: [
        { ...baseFloor, items: [{ id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.a" }] },
        { ...baseFloor, id: "f2", items: [{ id: "c", x: 3, y: 3, kind: "switch", powerEntity: "sensor.c" }] },
      ],
    } as unknown as FloorplanCardConfig;
    expect([...energyLayer.watched(c)].sort()).toEqual(["sensor.a", "sensor.c"]);
  });
  it("watches nothing on a floor with no powerEntity items", () => {
    const c = { type: "x", width: 10, height: 10, floors: [baseFloor] } as unknown as FloorplanCardConfig;
    expect([...energyLayer.watched(c)]).toEqual([]);
  });
});

describe("energyLayer.render", () => {
  it("renders nothing for a floor with no powerEntity items", () => {
    const out = energyLayer.render({ floor: baseFloor, hass: fakeHass({}), config: {} as FloorplanCardConfig });
    const tpl = out as unknown as { strings: readonly string[]; values: unknown[] };
    expect(tpl.strings).toEqual([""]);
    expect(tpl.values).toEqual([]);
  });

  it("renders a cue per item with a powerEntity", () => {
    const floor: Floor = {
      ...baseFloor,
      items: [
        { id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.a_w" } as any,
        { id: "b", x: 2, y: 2, kind: "switch" } as any,
        { id: "c", x: 3, y: 3, kind: "switch", powerEntity: "sensor.c_w" } as any,
      ],
    };
    const hass = fakeHass({ "sensor.a_w": { state: "10" }, "sensor.c_w": { state: "600" } });
    const out = energyLayer.render({ floor, hass, config: {} as FloorplanCardConfig });
    const html = JSON.stringify(out);
    expect(html).toContain("fp-energy-layer");
    // 2 cues (a, c) -- item b has no powerEntity and draws nothing
    const tpl = out as unknown as { values: unknown[] };
    expect((tpl.values[0] as unknown[]).length).toBe(2);
  });

  it("colours a high-wattage item hot and a low-wattage item neutral", () => {
    const floor: Floor = {
      ...baseFloor,
      items: [
        { id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.a_w" } as any,
        { id: "c", x: 3, y: 3, kind: "switch", powerEntity: "sensor.c_w" } as any,
      ],
    };
    const hass = fakeHass({ "sensor.a_w": { state: "0" }, "sensor.c_w": { state: "9999" } });
    const out = energyLayer.render({ floor, hass, config: {} as FloorplanCardConfig });
    const html = JSON.stringify(out);
    expect(html).toContain("rgb(148, 163, 184)"); // neutral
    expect(html).toContain("rgb(220, 38, 38)"); // hot
  });

  it("treats an unavailable/non-numeric power sensor as neutral, not a crash", () => {
    const floor: Floor = {
      ...baseFloor,
      items: [{ id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.dead" } as any],
    };
    const hass = fakeHass({ "sensor.dead": { state: "unavailable" } });
    expect(() => energyLayer.render({ floor, hass, config: {} as FloorplanCardConfig })).not.toThrow();
    const html = JSON.stringify(energyLayer.render({ floor, hass, config: {} as FloorplanCardConfig }));
    expect(html).toContain("rgb(148, 163, 184)");
  });
});

describe("energyLayer registration", () => {
  it("registers itself in LIVE_LAYERS on import", () => {
    expect(LIVE_LAYERS.some((l) => l.id === "energyLayer")).toBe(true);
  });

  it("carries the energyLayer feature id, a label, and an icon", () => {
    expect(energyLayer.id).toBe("energyLayer");
    expect(energyLayer.label).toBeTruthy();
    expect(energyLayer.icon).toBeTruthy();
  });

  it("is excluded by default (flag off) -- byte-identical, zero watched entities", () => {
    const off = {
      type: "x", width: 10, height: 10,
      floors: [{ ...baseFloor, items: [{ id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.plug_w" }] }],
    } as unknown as FloorplanCardConfig;
    expect(enabledLayers(off).some((l) => l.id === "energyLayer")).toBe(false);
    expect(layerWatchedEntities(off).has("sensor.plug_w")).toBe(false);
  });

  it("is included and watched once the flag is on", () => {
    const on = {
      type: "x", width: 10, height: 10,
      features: { energyLayer: true },
      floors: [{ ...baseFloor, items: [{ id: "a", x: 1, y: 1, kind: "switch", powerEntity: "sensor.plug_w" }] }],
    } as unknown as FloorplanCardConfig;
    expect(enabledLayers(on).some((l) => l.id === "energyLayer")).toBe(true);
    expect(layerWatchedEntities(on).has("sensor.plug_w")).toBe(true);
  });
});
