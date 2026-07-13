import { describe, it, expect } from "vitest";
import type { Room, RenderHass, FloorplanCardConfig } from "./types";
import { renderRoomLightWash, ROOM_LIGHT_WASH_OPACITY, lightsLayer } from "./lights";
import { LIVE_LAYERS } from "./layers";

const hass = (states: Record<string, { state: string; attributes?: Record<string, unknown> }>) =>
  ({ states, formatEntityState: (s: { state: string }) => s.state }) as unknown as RenderHass;

const room = (stateStyles?: Room["stateStyles"]): Room => ({
  id: "r",
  points: [[0, 0], [100, 0], [100, 80], [0, 80]],
  stateStyles,
});

const values = (t: unknown): string => JSON.stringify((t as { values: unknown[] }).values);

describe("renderRoomLightWash", () => {
  it("draws nothing for a room with no light-bound rule", () => {
    expect(renderRoomLightWash(room(), hass({}))).toBe("");
  });

  it("does not crash when stateStyles is not an array (malformed config)", () => {
    // validate.ts doesn't check stateStyles' shape, so a pasted `stateStyles: "x"`
    // reaches here; `rules?.find` used to throw on the string.
    const r = { ...room(), stateStyles: "nope" as unknown as Room["stateStyles"] };
    expect(() => renderRoomLightWash(r, hass({}))).not.toThrow();
    expect(renderRoomLightWash(r, hass({}))).toBe("");
  });

  it("draws nothing when the light is off", () => {
    const r = room([{ entity: "light.lamp", color: "rgb" }]);
    const h = hass({ "light.lamp": { state: "off", attributes: {} } });
    expect(renderRoomLightWash(r, h)).toBe("");
  });

  it("draws nothing when the light has no brightness reading", () => {
    const r = room([{ entity: "light.lamp", color: "rgb" }]);
    const h = hass({ "light.lamp": { state: "on", attributes: { rgb_color: [10, 20, 30] } } });
    expect(renderRoomLightWash(r, h)).toBe("");
  });

  it("washes the room's own points with the light's colour, scaled by brightness", () => {
    const r = room([{ entity: "light.lamp", color: "rgb" }]);
    const h = hass({
      "light.lamp": { state: "on", attributes: { rgb_color: [10, 20, 30], brightness: 128 } },
    });
    const v = values(renderRoomLightWash(r, h));
    expect(v).toContain("0,0 100,0 100,80 0,80");
    expect(v).toContain("rgb(10, 20, 30)");
    expect(v).toContain(String(ROOM_LIGHT_WASH_OPACITY * (128 / 255)));
  });

  it("brightness 0 washes at zero opacity rather than being skipped as unlit", () => {
    const r = room([{ entity: "light.lamp", color: "rgb" }]);
    const h = hass({ "light.lamp": { state: "on", attributes: { rgb_color: [1, 2, 3], brightness: 0 } } });
    expect(renderRoomLightWash(r, h)).not.toBe("");
  });

  it("respects the rule's own state condition, not just color: rgb", () => {
    // `above: 100` targets the light's own state text ("on"), which is never
    // numeric, so this rule never matches -- the wash stays off.
    const r = room([{ entity: "light.lamp", color: "rgb", above: 100 }]);
    const h = hass({
      "light.lamp": { state: "on", attributes: { rgb_color: [1, 2, 3], brightness: 200 } },
    });
    expect(renderRoomLightWash(r, h)).toBe("");
  });

  it("ignores a stateStyles rule that isn't a light (no color: rgb)", () => {
    const r = room([{ entity: "sensor.temp", color: "red" }]);
    const h = hass({ "sensor.temp": { state: "31", attributes: {} } });
    expect(renderRoomLightWash(r, h)).toBe("");
  });
});

describe("lightsLayer", () => {
  it("is registered in LIVE_LAYERS", () => {
    expect(LIVE_LAYERS).toContain(lightsLayer);
  });

  it("id is the lightsLayer feature flag", () => {
    expect(lightsLayer.id).toBe("lightsLayer");
  });

  it("watched() reports every room's light-bound entity across floors", () => {
    const cfg = {
      type: "x",
      width: 10,
      height: 10,
      floors: [
        {
          id: "f", name: "F", walls: [], openings: [], items: [], texts: [], furniture: [],
          trackers: [],
          rooms: [
            { id: "r1", points: [], stateStyles: [{ entity: "light.a", color: "rgb" }] },
            { id: "r2", points: [] },
          ],
        },
      ],
    } as unknown as FloorplanCardConfig;
    expect([...lightsLayer.watched(cfg)]).toEqual(["light.a"]);
  });

  it("render() draws nothing for a floor with no light-bound rooms", () => {
    const cfg = { type: "x", width: 10, height: 10 } as unknown as FloorplanCardConfig;
    const floor = {
      id: "f", name: "F", walls: [], openings: [], items: [], texts: [], furniture: [],
      trackers: [], rooms: [room()],
    } as unknown as Parameters<typeof lightsLayer.render>[0]["floor"];
    expect(lightsLayer.render({ floor, hass: hass({}), config: cfg }).strings.join("")).toBe("");
  });

  it("render() draws a wash for a light-bound, lit room", () => {
    const cfg = { type: "x", width: 10, height: 10 } as unknown as FloorplanCardConfig;
    const floor = {
      id: "f", name: "F", walls: [], openings: [], items: [], texts: [], furniture: [],
      trackers: [], rooms: [room([{ entity: "light.lamp", color: "rgb" }])],
    } as unknown as Parameters<typeof lightsLayer.render>[0]["floor"];
    const h = hass({ "light.lamp": { state: "on", attributes: { rgb_color: [1, 2, 3], brightness: 255 } } });
    const out = lightsLayer.render({ floor, hass: h, config: cfg });
    expect(out.strings.join("")).toContain("fp-lights-layer");
  });
});
