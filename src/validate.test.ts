import { describe, it, expect } from "vitest";
import { validateConfig } from "./validate";
import { parseAndValidate, configToText } from "./validate";

const valid = {
  type: "custom:floorplan-card",
  width: 1000,
  height: 600,
  floors: [
    {
      id: "f1",
      name: "Main",
      walls: [{ id: "w1", x1: 0, y1: 0, x2: 100, y2: 0 }],
      areas: [{ id: "r1", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], haArea: "kitchen" }],
      items: [{ id: "i1", x: 50, y: 50, kind: "light", entity: "light.a" }],
      texts: [{ id: "t1", x: 10, y: 10, text: "Hi" }],
      rotation: 90,
    },
  ],
};

describe("validateConfig", () => {
  it("accepts a features block", () => {
    expect(validateConfig({ type: "x", width: 10, height: 10, features: { thermalLayer: true } }).ok).toBe(true);
  });
  it("rejects a non-boolean feature flag", () => {
    const r = validateConfig({ type: "x", width: 10, height: 10, features: { thermalLayer: "yes" } });
    expect(r.ok).toBe(false);
  });
  it("accepts a features block with all five current flags", () => {
    const r = validateConfig({
      type: "x", width: 10, height: 10,
      features: {
        thermalLayer: true, awarenessLayer: true, energyLayer: true,
        radialControls: true, autoPopulateArea: true,
      },
    });
    expect(r.ok).toBe(true);
  });
  it("rejects a feature flag from the old ten-flag list (removed by the port)", () => {
    const r = validateConfig({ type: "x", width: 10, height: 10, features: { lightsLayer: true } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("features.lightsLayer"))).toBe(true);
  });
  it("rejects an unknown feature flag", () => {
    const r = validateConfig({ type: "x", width: 10, height: 10, features: { notARealFlag: true } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("features.notARealFlag"))).toBe(true);
  });
  it("accepts an area's tempEntity", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      areas: [{ id: "r1", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], tempEntity: "sensor.living_room_temp" }],
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("rejects a non-string tempEntity", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      areas: [{ id: "r1", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], tempEntity: 42 }],
    };
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("accepts an area's haArea/filterEntities/highlight fields", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      areas: [{
        id: "r1", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        haArea: "living_room", filterEntities: false, highlight: "border",
      }],
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("rejects a bad highlight enum", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      areas: [{ id: "r1", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], highlight: "everywhere" }],
    };
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("rejects an area whose points are [x, y] tuples (the pre-port shape) instead of {x, y} objects", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      areas: [{ id: "r1", points: [[0, 0], [1, 0], [1, 1]] }],
    };
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("accepts an area's stateColor rule list", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      areas: [{
        id: "r1", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        entity: "binary_sensor.living_room_occupancy",
        stateColor: [{ state: "on", color: "orange" }, { color: "gray" }],
      }],
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("accepts an area with tap_action/hold_action/double_tap_action (rides as allowed-unknown, like furniture's actions)", () => {
    const cfg = {
      type: "x",
      width: 10,
      height: 10,
      areas: [
        {
          id: "r1",
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
          tap_action: { action: "toggle-area-lights" },
          hold_action: { action: "more-info" },
          double_tap_action: { action: "none" },
        },
      ],
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
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
  it("rejects a bad kind enum", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.floors[0].items[0].kind = "toaster";
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("items[0].kind"))).toBe(true);
  });

  it("accepts a non-quarter rotation (the card coerces it, so the validator must not reject it)", () => {
    const cfg = JSON.parse(JSON.stringify(valid));
    cfg.floors[0].rotation = 45;
    expect(validateConfig(cfg).ok).toBe(true);
    // A non-number is still rejected.
    cfg.floors[0].rotation = "spin";
    expect(validateConfig(cfg).ok).toBe(false);
  });

  it("accepts a config-level rotation (issue #33's display rotation, distinct from a floor's)", () => {
    const cfg = JSON.parse(JSON.stringify(valid));
    cfg.rotation = 270;
    expect(validateConfig(cfg).ok).toBe(true);
    cfg.rotation = "spin";
    expect(validateConfig(cfg).ok).toBe(false);
  });

  it("rejects a degenerate area with fewer than 3 points", () => {
    const cfg = { type: "x", width: 10, height: 10, areas: [{ id: "r", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("at least 3 points"))).toBe(true);
  });

  it("validates stateStyles shape (a string is not a rule list)", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      items: [{ id: "i", x: 0, y: 0, kind: "light", stateStyles: "nope" }],
    };
    expect(validateConfig(cfg).ok).toBe(false);
    const good = {
      type: "x", width: 10, height: 10,
      items: [{ id: "i", x: 0, y: 0, kind: "light", stateStyles: [{ state: "on", color: "#fff" }] }],
    };
    expect(validateConfig(good).ok).toBe(true);
  });
  it("validates an item's stateColor shape (StateColorRule, its non-deprecated replacement)", () => {
    const bad = {
      type: "x", width: 10, height: 10,
      items: [{ id: "i", x: 0, y: 0, kind: "light", stateColor: "nope" }],
    };
    expect(validateConfig(bad).ok).toBe(false);
    const good = {
      type: "x", width: 10, height: 10,
      items: [{ id: "i", x: 0, y: 0, kind: "light", stateColor: [{ above: 26, color: "red" }, { color: "white" }] }],
    };
    expect(validateConfig(good).ok).toBe(true);
  });
  it("validates the fork's stateColor extensions: entity, state_not, below, animation", () => {
    const good = {
      type: "x", width: 10, height: 10,
      items: [
        {
          id: "i", x: 0, y: 0, kind: "light",
          stateColor: [
            { entity: "binary_sensor.door", state_not: "off", below: 20, color: "red", animation: "pulse" },
          ],
        },
      ],
    };
    expect(validateConfig(good).ok).toBe(true);
    const bad = {
      type: "x", width: 10, height: 10,
      items: [{ id: "i", x: 0, y: 0, kind: "light", stateColor: [{ color: "red", animation: "blink" }] }],
    };
    expect(validateConfig(bad).ok).toBe(false);
  });
  it("collects multiple errors in one pass", () => {
    const r = validateConfig({ width: "x", height: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
  it("allows unknown extra keys", () => {
    expect(validateConfig({ ...valid, futureKey: 123 }).ok).toBe(true);
  });
  it("accepts a roll (garage) opening, and a swing door with unknown extra fields riding as allowed-unknown", () => {
    const mkOpening = (opening: Record<string, unknown>) => ({
      type: "custom:floorplan-card", width: 100, height: 100,
      floors: [{ id: "f", openings: [{ id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0, ...opening }] }],
    });
    expect(validateConfig(mkOpening({ motion: "roll" })).ok).toBe(true);
    expect(validateConfig(mkOpening({ motion: "swing", doorStyle: "double" })).ok).toBe(true);
  });
  it("rejects a bad opening motion, including the pre-port fork's 'fold' (no longer a valid motion)", () => {
    const bad = (motion: string) => ({
      type: "custom:floorplan-card", width: 100, height: 100,
      floors: [{ id: "f", openings: [{ id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0, motion }] }],
    });
    for (const motion of ["spin", "fold"]) {
      const r = validateConfig(bad(motion));
      expect(r.ok, motion).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.includes("openings[0].motion"))).toBe(true);
    }
  });
  it("accepts an opening's shutter/slider fields (issues #74, #145)", () => {
    const cfg = {
      type: "custom:floorplan-card", width: 100, height: 100,
      floors: [{ id: "f", openings: [{
        id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0, motion: "slide",
        sliderStyle: "biparting-bypass", shutterEntity: "cover.patio_shutter", shutterStyle: "roll",
        flipH: true, flipV: false, tapTarget: "shutter",
      }] }],
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("rejects a bad sliderStyle enum", () => {
    const cfg = {
      type: "custom:floorplan-card", width: 100, height: 100,
      floors: [{ id: "f", openings: [{
        id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0, motion: "slide", sliderStyle: "sideways",
      }] }],
    };
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("rejects a non-positive width or height", () => {
    expect(validateConfig({ ...valid, width: 0 }).ok).toBe(false);
    expect(validateConfig({ ...valid, height: -5 }).ok).toBe(false);
  });
  it("accepts smart-furniture fields", () => {
    const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
      furniture: [{ id: "u1", type: "washer", x: 1, y: 1, w: 10, h: 10, entity: "switch.washer",
        showState: true, stateStyles: [{ state: "on", color: "orange", animation: "pulse" }],
        tap_action: { action: "toggle" } }] }] };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("rejects a furniture piece with a wrong-typed entity, with a path", () => {
    const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
      furniture: [{ id: "u1", type: "washer", x: 1, y: 1, w: 10, h: 10, entity: 123 }] }] };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("furniture[0].entity"))).toBe(true);
  });
  it("still accepts a plain furniture piece with no smart fields", () => {
    const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
      furniture: [{ id: "u1", type: "sofa", x: 1, y: 1, w: 10, h: 10 }] }] };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("accepts a furniture piece of any type string, built-in or custom (Furniture.type is FurnitureType | (string & {}))", () => {
    // "fishTank" / "piano" / "hotTub" are upstream's own built-ins; "roomba_dock"
    // is a made-up id, standing in for a symbol defined in the config's own
    // `symbols:` block (issue #90) — neither list may ever be closed again.
    const newTypes = ["fishTank", "piano", "hotTub", "roomba_dock"];
    for (const type of newTypes) {
      const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
        furniture: [{ id: "u1", type, x: 1, y: 1, w: 10, h: 10 }] }] };
      const r = validateConfig(cfg);
      expect(r.ok, type).toBe(true);
    }
  });
  it("rejects a non-string furniture type", () => {
    const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
      furniture: [{ id: "u1", type: 42, x: 1, y: 1, w: 10, h: 10 }] }] };
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("accepts a furniture piece's hand (L-shaped sectional chaise side)", () => {
    const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
      furniture: [{ id: "u1", type: "sectional", x: 1, y: 1, w: 10, h: 10, hand: "left" }] }] };
    expect(validateConfig(cfg).ok).toBe(true);
  });

  it("accepts every top-level key upstream added (skin, overlayScale, showDeadSpaces, sunDimming, pressEffect, symbols)", () => {
    const cfg = {
      ...valid,
      skin: "tron",
      overlayScale: "plan",
      showDeadSpaces: true,
      sunDimming: true,
      sunBrightnessMin: 0.45,
      sunBrightnessMax: 1,
      pressEffect: "ripple",
      symbols: { my_symbol: { paths: [] } },
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("rejects a bad overlayScale enum", () => {
    expect(validateConfig({ ...valid, overlayScale: "huge" }).ok).toBe(false);
  });
  it("rejects a non-boolean showDeadSpaces", () => {
    expect(validateConfig({ ...valid, showDeadSpaces: "yes" }).ok).toBe(false);
  });
  it("rejects a non-boolean sunDimming", () => {
    expect(validateConfig({ ...valid, sunDimming: "yes" }).ok).toBe(false);
  });
  it("rejects a non-number sunBrightnessMin/Max", () => {
    expect(validateConfig({ ...valid, sunBrightnessMin: "dim" }).ok).toBe(false);
    expect(validateConfig({ ...valid, sunBrightnessMax: "bright" }).ok).toBe(false);
  });
  it("rejects a bad pressEffect enum", () => {
    expect(validateConfig({ ...valid, pressEffect: "wobble" }).ok).toBe(false);
  });
  it("accepts pressEffect: none (the opt-out)", () => {
    expect(validateConfig({ ...valid, pressEffect: "none" }).ok).toBe(true);
  });
  it("rejects a non-string skin", () => {
    expect(validateConfig({ ...valid, skin: 5 }).ok).toBe(false);
  });
  it("rejects a symbols block that isn't an object", () => {
    expect(validateConfig({ ...valid, symbols: "nope" }).ok).toBe(false);
    expect(validateConfig({ ...valid, symbols: [] }).ok).toBe(false);
  });
});

describe("parseAndValidate", () => {
  const json = JSON.stringify(valid);
  const yaml = "type: custom:floorplan-card\nwidth: 1000\nheight: 600\nfloors:\n  - id: f1\n    items:\n      - id: i1\n        x: 5\n        y: 5\n        kind: light\n";
  it("accepts a JSON string", () => {
    expect(parseAndValidate(json).ok).toBe(true);
  });
  it("accepts an equivalent YAML string", () => {
    expect(parseAndValidate(yaml).ok).toBe(true);
  });
  it("reports a syntax error as one error, not a throw", () => {
    const r = parseAndValidate("{ this is: not valid: json or yaml ][");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(1);
  });
  it("reports validation errors for parseable-but-invalid input", () => {
    const r = parseAndValidate('{"width": "big"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((x) => x.startsWith("config.width"))).toBe(true);
  });
});

describe("configToText round-trip", () => {
  it("exports YAML that parses back to an equal config", () => {
    const text = configToText(valid as never);
    const r = parseAndValidate(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(valid);
  });
});

it("accepts an awareness marker list", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    awareness: [{ id: "m1", x: 1, y: 2, entity: "binary_sensor.hall_motion", kind: "motion" }],
  });
  expect(r.ok).toBe(true);
});

it("rejects an awareness marker with an unknown kind", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    awareness: [{ id: "m1", x: 1, y: 2, entity: "binary_sensor.hall_motion", kind: "sideways" }],
  });
  expect(r.ok).toBe(false);
});

it("rejects an awareness marker missing its entity", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    awareness: [{ id: "m1", x: 1, y: 2, kind: "safety" }],
  });
  expect(r.ok).toBe(false);
});

it("accepts an item with a powerEntity", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    items: [{ id: "plug1", x: 1, y: 1, kind: "switch", powerEntity: "sensor.plug_power" }],
  });
  expect(r.ok).toBe(true);
});
it("rejects a non-string powerEntity", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    items: [{ id: "plug1", x: 1, y: 1, kind: "switch", powerEntity: 42 }],
  });
  expect(r.ok).toBe(false);
});

it("accepts a floor with imageLocked", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    floors: [{ id: "f1", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [],
      image: "plan.png", imageOpacity: 0.5, imageLocked: true }],
  });
  expect(r.ok).toBe(true);
});
it("rejects a non-boolean imageLocked", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    floors: [{ id: "f1", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [],
      imageLocked: "yes" }],
  });
  expect(r.ok).toBe(false);
});
