import { describe, it, expect } from "vitest";
import { awarenessLayer } from "./awareness-layer";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";
import type { Floor, FloorplanCardConfig, RenderHass } from "./types";
// Raw source text, not the FloorplanCard class -- see the test below for why.
import cardSrc from "./floorplan-card.ts?raw";

// LayerRenderCtx.hass is required (RenderHass, not optional) -- these two
// tests exercise floors with no markers/no trip lookups, so no real hass is
// needed. Cast rather than construct a fake, mirroring the plan's intent
// that a missing/undefined hass never crashes render() (see the optional
// chaining on ctx.hass? in awareness-layer.ts's renderAwarenessLayer).
const noHass = undefined as unknown as RenderHass;

const baseFloor: Floor = {
  id: "f1", name: "Floor 1", walls: [], openings: [], items: [], texts: [],
  furniture: [], trackers: [], areas: [],
};

const markerMotion = { id: "m1", x: 10, y: 20, entity: "binary_sensor.hall_motion", kind: "motion" as const };
const markerSafety = { id: "s1", x: 30, y: 40, entity: "binary_sensor.kitchen_leak", kind: "safety" as const };

// Full recursive serialization (strings interleaved with values, including
// nested TemplateResults and the `${markers.map(...)}` array binding) --
// same technique as awareness.test.ts's helper, extended to flatten arrays.
interface TplLike { strings: readonly string[]; values: unknown[] }
const isTpl = (v: unknown): v is TplLike => !!v && typeof v === "object" && "strings" in v && "values" in v;
const serialize = (t: unknown): string => {
  if (Array.isArray(t)) return t.map(serialize).join("");
  const tpl = t as TplLike;
  let out = tpl.strings[0];
  for (let i = 0; i < tpl.values.length; i++) {
    const v = tpl.values[i];
    out += isTpl(v) || Array.isArray(v) ? serialize(v) : String(v);
    out += tpl.strings[i + 1];
  }
  return out;
};

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

  it("threads overlayScale from the render context into the motion ripple (upstream #148)", () => {
    // renderRipple's `scale` param is defaulted, so a missed threading bug
    // compiles clean and every other test here still passes -- this is the
    // one that would actually catch it.
    const floor = { ...baseFloor, awareness: [markerMotion] };
    const fixed = serialize(awarenessLayer.render({
      floor, hass: noHass, config: { overlayScale: "fixed" } as FloorplanCardConfig,
    }));
    const plan = serialize(awarenessLayer.render({
      floor, hass: noHass, config: { overlayScale: "plan" } as FloorplanCardConfig,
    }));
    expect(fixed).not.toEqual(plan);
    expect(fixed).toContain("width:80px");
    expect(plan).toContain("width:calc(80 * var(--fp-u, 1px))");
  });

  it("defines a CSS rule and keyframe for the class the safety marker actually emits", () => {
    // renderSafetyMarker emits the class name as a plain string -- nothing
    // type-checks it against a real selector, so a renamed/typo'd class
    // compiles clean and every markup-only test (e.g. the "blinks in the
    // alert palette" test in awareness.test.ts) still passes. This is the
    // test that would catch an emitted class with no matching rule.
    //
    // Imported as raw source text (Vite's `?raw` suffix, typed by
    // vite/client.d.ts) rather than importing the FloorplanCard class: this
    // suite runs in vitest's default node environment (no jsdom/happy-dom
    // configured anywhere in this repo, and no @types/node either), and
    // importing the class evaluates `class ActionHandler extends
    // HTMLElement` at module load (action-handler.ts, pulled in
    // transitively) -- which throws "HTMLElement is not defined" outside a
    // DOM. A source-text check on the real static-styles rule/keyframe
    // declarations still catches the actual failure mode (an emitted class
    // name with no matching selector).
    expect(cardSrc).toMatch(/\.fp-awareness-blink\s*\{/);
    expect(cardSrc).toMatch(/@keyframes fp-awareness-blink\s*\{/);
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
