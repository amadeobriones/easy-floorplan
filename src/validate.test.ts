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
      rooms: [{ id: "r1", points: [[0, 0], [100, 0], [100, 100]], areaId: "kitchen" }],
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
  it("accepts a room's tempEntity", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      rooms: [{ id: "r1", points: [[0, 0], [1, 1]], tempEntity: "sensor.living_room_temp" }],
    };
    expect(validateConfig(cfg).ok).toBe(true);
  });
  it("rejects a non-string tempEntity", () => {
    const cfg = {
      type: "x", width: 10, height: 10,
      rooms: [{ id: "r1", points: [[0, 0], [1, 1]], tempEntity: 42 }],
    };
    expect(validateConfig(cfg).ok).toBe(false);
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
  it("accepts roll (garage) and fold (bi-fold) openings, and a double-style swing door", () => {
    const mkOpening = (opening: Record<string, unknown>) => ({
      type: "custom:floorplan-card", width: 100, height: 100,
      floors: [{ id: "f", openings: [{ id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0, ...opening }] }],
    });
    expect(validateConfig(mkOpening({ motion: "roll" })).ok).toBe(true);
    expect(validateConfig(mkOpening({ motion: "fold", foldPanels: 4 })).ok).toBe(true);
    expect(validateConfig(mkOpening({ motion: "swing", doorStyle: "double" })).ok).toBe(true);
  });
  it("rejects a bad opening motion", () => {
    const bad = {
      type: "custom:floorplan-card", width: 100, height: 100,
      floors: [{ id: "f", openings: [{ id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0, motion: "spin" }] }],
    };
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("openings[0].motion"))).toBe(true);
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
  it("accepts a furniture piece of each of the 12 Phase-2 types", () => {
    const newTypes = [
      "armchair", "bench", "crib", "coffeeTable", "nightstand", "dresser",
      "bookshelf", "cabinet", "microwave", "shower", "bidet", "fireplace",
    ];
    for (const type of newTypes) {
      const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
        furniture: [{ id: "u1", type, x: 1, y: 1, w: 10, h: 10 }] }] };
      const r = validateConfig(cfg);
      expect(r.ok, type).toBe(true);
    }
  });
  it("accepts a furniture piece of each of the 7 catalog-glyphs types", () => {
    const newTypes = [
      "ceilingFan", "ceilingLight", "lamp", "coffeeMaker", "toaster",
      "rangeHood", "smartSpeaker",
    ];
    for (const type of newTypes) {
      const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
        furniture: [{ id: "u1", type, x: 1, y: 1, w: 10, h: 10 }] }] };
      const r = validateConfig(cfg);
      expect(r.ok, type).toBe(true);
    }
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
