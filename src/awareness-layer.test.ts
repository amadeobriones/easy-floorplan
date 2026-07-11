import { describe, it, expect } from "vitest";
import { awarenessLayer } from "./awareness-layer";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";
import type { Floor, FloorplanCardConfig, RenderHass } from "./types";

// LayerRenderCtx.hass is required (RenderHass, not optional) -- these two
// tests exercise floors with no markers/no trip lookups, so no real hass is
// needed. Cast rather than construct a fake, mirroring the plan's intent
// that a missing/undefined hass never crashes render() (see the optional
// chaining on ctx.hass? in awareness-layer.ts's renderAwarenessLayer).
const noHass = undefined as unknown as RenderHass;

const baseFloor: Floor = {
  id: "f1", name: "Floor 1", walls: [], openings: [], items: [], texts: [],
  furniture: [], trackers: [],
};

const markerMotion = { id: "m1", x: 10, y: 20, entity: "binary_sensor.hall_motion", kind: "motion" as const };
const markerSafety = { id: "s1", x: 30, y: 40, entity: "binary_sensor.kitchen_leak", kind: "safety" as const };

describe("awarenessLayer", () => {
  it("registers itself in LIVE_LAYERS on import", () => {
    expect(LIVE_LAYERS.some((l) => l.id === "awarenessLayer")).toBe(true);
  });

  it("carries the awarenessLayer feature id, a label, and an icon", () => {
    expect(awarenessLayer.id).toBe("awarenessLayer");
    expect(awarenessLayer.label).toBeTruthy();
    expect(awarenessLayer.icon).toBeTruthy();
  });

  it("watches every awareness marker's entity, across floors", () => {
    const c = {
      type: "x", width: 10, height: 10,
      floors: [
        { ...baseFloor, awareness: [markerMotion] },
        { ...baseFloor, id: "f2", awareness: [markerSafety] },
      ],
    } as unknown as FloorplanCardConfig;
    expect([...awarenessLayer.watched(c)].sort()).toEqual(
      ["binary_sensor.hall_motion", "binary_sensor.kitchen_leak"].sort(),
    );
  });

  it("watches nothing on a floor with no markers", () => {
    const c = { type: "x", width: 10, height: 10, floors: [baseFloor] } as unknown as FloorplanCardConfig;
    expect([...awarenessLayer.watched(c)]).toEqual([]);
  });

  it("renders nothing for a floor with no markers", () => {
    const out = awarenessLayer.render({ floor: baseFloor, hass: noHass, config: {} as FloorplanCardConfig });
    const tpl = out as unknown as { strings: readonly string[]; values: unknown[] };
    expect(tpl.strings).toEqual([""]);
    expect(tpl.values).toEqual([]);
  });

  it("renders a marker per entry on the active floor", () => {
    const floor = { ...baseFloor, awareness: [markerMotion, markerSafety] };
    const out = awarenessLayer.render({ floor, hass: noHass, config: {} as FloorplanCardConfig });
    const tpl = out as unknown as { values: unknown[] };
    expect(tpl.values).toHaveLength(1); // the single ${markers.map(...)} binding
    expect((tpl.values[0] as unknown[]).length).toBe(2); // one rendered marker per entry
  });

  it("end-to-end through the real framework registry: off by default, on when the flag is set", () => {
    const off = {
      type: "x", width: 10, height: 10,
      floors: [{ ...baseFloor, awareness: [markerMotion] }],
    } as unknown as FloorplanCardConfig;
    const on = { ...off, features: { awarenessLayer: true } } as FloorplanCardConfig;
    expect(enabledLayers(off).some((l) => l.id === "awarenessLayer")).toBe(false);
    expect(layerWatchedEntities(off).has("binary_sensor.hall_motion")).toBe(false);
    expect(enabledLayers(on).some((l) => l.id === "awarenessLayer")).toBe(true);
    expect(layerWatchedEntities(on).has("binary_sensor.hall_motion")).toBe(true);
  });
});
