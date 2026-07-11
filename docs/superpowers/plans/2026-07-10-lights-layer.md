# Lights Layer (1b) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lit `ceilingLight`/`lamp`'s glow scales its radius/opacity with the bound light's real `brightness`, and a room whose `color: "rgb"` rule follows a light gets an extra brightness-scaled colour wash on top of its existing tint — both off by default behind the `lightsLayer` feature flag.

**Architecture:** One small pure helper, `lightVisual(state)`, reads `brightness`/`rgb_color` off a light's HA state and returns a 0..1 `intensity` plus its `color`. The **furniture glow** is not a layer: it extends `renderFurniture` with an optional `glowIntensity` parameter that the card computes inline (the piece's own entity is already watched — no new watched entities). The **room tint** *is* a layer: a new `LiveLayer` (`src/lights.ts`) draws an extra translucent wash polygon over a light-bound room, registered into `LIVE_LAYERS` so the layer framework (from `2026-07-10-layer-framework.md`) renders it, toggles it, and folds its watched entity into the card automatically — this plan adds nothing to `floorplan-card.ts` for that path except one side-effect import.

**Tech Stack:** Lit + TypeScript, Vitest.

## Depends on
- `docs/superpowers/plans/2026-07-10-feature-toggles.md` — consumes `featureEnabled`, `FeatureName`. Must land first.
- `docs/superpowers/plans/2026-07-10-layer-framework.md` — consumes `LiveLayer`, `LayerRenderCtx`, `LIVE_LAYERS`. Must land first.

Neither dependency plan is implemented yet as of this writing (`git branch -a` shows no `feat/feature-toggles` or `feat/layer-framework`, and `src/features.ts` / `src/layers.ts` do not exist). Do not start this plan's tasks until both are merged to `main`.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`.
- Branch `feat/lights-layer` off `main` (after feature-toggles and layer-framework merge).
- `featureEnabled(config, "lightsLayer")` gates every new behaviour in this plan; default **off**. With the flag off (or a config with no `features` block), floorplan-card output is byte-identical to today and no new entity is watched.
- This plan adds **no** new fields to `FloorplanCardConfig`, `Room`, or `Furniture` — `features.lightsLayer` already exists from the feature-toggles plan, and `Room.stateStyles`'s `color: "rgb"` already exists from Phase 5. **`npm run schema` is not needed.**
- Landmine: no backticks inside `css` tagged-template comments.
- Run: `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.

## Produced interfaces
```ts
// src/render.ts — new export, next to rgbColorOf
export interface LightVisual {
  color?: string;      // same shape as rgbColorOf's return
  intensity?: number;  // 0..1 from `brightness` (0-255); undefined when off / no reading
}
export function lightVisual(
  st: { state: string; attributes?: Record<string, unknown> } | undefined,
): LightVisual;

// src/render.ts — renderFurniture gains a 4th optional param
export function renderFurniture(
  f: Furniture,
  resolved?: ResolvedStyle,
  active = false,
  glowIntensity?: number,   // 0..1; undefined = today's fixed glow, byte-identical
): SVGTemplateResult;

// src/lights.ts (new)
export const ROOM_LIGHT_WASH_OPACITY: number;
export function renderRoomLightWash(
  r: Room,
  hass: RenderHass | undefined,
): SVGTemplateResult | "";
export const lightsLayer: LiveLayer;   // id: "lightsLayer"; self-registers into LIVE_LAYERS
```
Consumers: `floorplan-card.ts`'s furniture render call computes `glowIntensity` inline via `lightVisual` and passes it to `renderFurniture`; it does **not** call anything from `lights.ts` directly — a bare `import "./lights";` is enough for the layer framework to pick up `lightsLayer`.

## File Structure
- `src/render.ts` — `lightVisual` (new, next to `rgbColorOf`); `renderFurniture` (new 4th param, used only by the `ceilingLight`/`lamp` cases).
- `src/render.test.ts` — tests for `lightVisual` and the glow-scaling behaviour of `renderFurniture`.
- `src/lights.ts` (new) — the room-wash pure helpers + the `lightsLayer` `LiveLayer`, self-registered into `LIVE_LAYERS`.
- `src/lights.test.ts` (new) — tests for the wash helpers and the layer's `watched`/`render`.
- `src/floorplan-card.ts` — CSS: `.fp-furn-glow`/`@keyframes fp-furn-glow-swell` gain a `--fp-glow-intensity` custom property (default 1, so unset = identical to today); `render()`: the furniture map computes `glowIntensity` gated by `featureEnabled`; imports gain `featureEnabled` from `./features`, `lightVisual` from `./render`, and a side-effect `import "./lights";`.
- `src/floorplan-card.guard.test.ts` — two new source-text guards pinning the gate call and the registration import (this file has no DOM harness for `floorplan-card.ts`, so wiring-level changes are guarded this way, matching its existing convention).

---

## Task 1: `lightVisual` helper

**Files:**
- Modify: `src/render.ts` (add after `rgbColorOf`, which ends at line 276)
- Test: `src/render.test.ts` (add a `describe("lightVisual", ...)` block after the existing `describe("rgbColorOf", ...)` block, which ends at line 1165; add `lightVisual` to the import list at line 36)

**Interfaces:**
- Consumes: `rgbColorOf` (`src/render.ts:270`), already in scope in the same file.
- Produces: `LightVisual`, `lightVisual` — consumed by Task 2 (furniture) and Task 3 (room wash).

- [ ] **Step 1: Write the failing tests**

In `src/render.test.ts`, add `lightVisual` to the existing import from `"./render"` (line 36, next to `rgbColorOf`):
```ts
  rgbColorOf,
  lightVisual,
```
Then, immediately after the `describe("rgbColorOf", ...)` block (after line 1165):
```ts
describe("lightVisual", () => {
  it("yields nothing for a light that is off, unavailable, or missing", () => {
    expect(lightVisual(undefined)).toEqual({});
    expect(lightVisual({ state: "off", attributes: { brightness: 200 } })).toEqual({});
    expect(lightVisual({ state: "unavailable", attributes: { brightness: 200 } })).toEqual({});
  });

  it("reads colour and a 0..1 intensity from a lit bulb", () => {
    const v = lightVisual({
      state: "on",
      attributes: { rgb_color: [10, 20, 30], brightness: 128 },
    });
    expect(v.color).toBe("rgb(10, 20, 30)");
    expect(v.intensity).toBeCloseTo(128 / 255);
  });

  it("intensity is undefined when brightness is absent, even while on", () => {
    const v = lightVisual({ state: "on", attributes: { rgb_color: [1, 2, 3] } });
    expect(v.color).toBe("rgb(1, 2, 3)");
    expect(v.intensity).toBeUndefined();
  });

  it("brightness 0 is a real reading of zero, not a missing one", () => {
    expect(lightVisual({ state: "on", attributes: { brightness: 0 } }).intensity).toBe(0);
  });

  it("clamps an out-of-range brightness into 0..1", () => {
    expect(lightVisual({ state: "on", attributes: { brightness: 500 } }).intensity).toBe(1);
    expect(lightVisual({ state: "on", attributes: { brightness: -50 } }).intensity).toBe(0);
  });

  it("colour is undefined when the light is on but has no rgb_color", () => {
    expect(lightVisual({ state: "on", attributes: { brightness: 100 } }).color).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/render.test.ts -t lightVisual`
Expected: FAIL — `lightVisual` is not exported from `./render`.

- [ ] **Step 3: Implement in `src/render.ts`**

Insert directly after `rgbColorOf` (after line 276, before `stateStyleMatches` at line 278):
```ts
/**
 * A light's actual look right now: its colour (same as {@link rgbColorOf}) and a
 * 0..1 intensity from `brightness` (0-255). Off/unavailable/missing yields `{}`
 * rather than a fabricated dim reading, matching `rgbColorOf`'s own "no colour
 * rather than black" rule. `brightness: 0` is a real reading, not a missing one.
 */
export function lightVisual(
  st: { state: string; attributes?: Record<string, unknown> } | undefined,
): LightVisual {
  if (!st || st.state !== "on") return {};
  const b = st.attributes?.brightness;
  const intensity =
    typeof b === "number" && Number.isFinite(b) ? Math.max(0, Math.min(1, b / 255)) : undefined;
  return { color: rgbColorOf(st), intensity };
}

export interface LightVisual {
  color?: string;
  intensity?: number;
}
```
(TypeScript allows a function to reference an interface declared later in the same module — either order compiles. Placing the interface right after the function keeps them together for a reader.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/render.test.ts -t lightVisual`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/render.ts src/render.test.ts
git commit -m "Add lightVisual: brightness/rgb_color reading for the lights layer"
```

---

## Task 2: Furniture glow scales with brightness

**Files:**
- Modify: `src/render.ts` (`renderFurniture` signature at line 939, `ceilingLight` case at line 1319, `lamp` case at line 1335; add `nothing` to the `"lit"` import at line 1)
- Modify: `src/floorplan-card.ts` (CSS at lines 754-761; furniture render call at lines 358-364; imports at lines 1, 17-34)
- Test: `src/render.test.ts` (extend the existing `ceilingLight`/`lamp` glow tests, lines 896-912)
- Test: `src/floorplan-card.guard.test.ts` (one new guard)

**Interfaces:**
- Consumes: `lightVisual` (Task 1); `featureEnabled` from `src/features.ts` (produced by the feature-toggles plan — exact signature `featureEnabled(c: { features?: FeaturesConfig } | undefined, name: FeatureName): boolean`).
- Produces: `renderFurniture`'s 4th parameter, consumed by nothing else in this plan (it's the leaf of this path).

- [ ] **Step 1: Write the failing tests**

In `src/render.test.ts`, replace the two existing tests at lines 896-912 (`"ceilingLight: active true adds fp-furn-glow..."` and `"lamp: active true adds fp-furn-glow..."`) — keep their bodies exactly, and add new cases directly after each:
```ts
  it("ceilingLight: active true adds fp-furn-glow; omitted/false is byte-identical", () => {
    const withoutParam = serialize(renderFurniture(ceilingLight, undefined));
    const explicitFalse = serialize(renderFurniture(ceilingLight, undefined, false));
    const active = serialize(renderFurniture(ceilingLight, undefined, true));
    expect(withoutParam).not.toContain("fp-furn-glow");
    expect(explicitFalse).toEqual(withoutParam);
    expect(active).toContain("fp-furn-glow");
  });

  it("ceilingLight: glowIntensity omitted keeps the exact fixed-radius glow", () => {
    const noGlowIntensity = serialize(renderFurniture(ceilingLight, undefined, true));
    const explicitUndefined = serialize(renderFurniture(ceilingLight, undefined, true, undefined));
    expect(explicitUndefined).toEqual(noGlowIntensity);
    expect(noGlowIntensity).not.toContain("--fp-glow-intensity");
  });

  // Extracts the numeric r="..." on the glow circle specifically (it is the
  // first attribute-bearing element with class="fp-furn-glow" in the markup).
  const glowRadius = (markup: string): number => {
    const m = markup.match(/class="fp-furn-glow"[^>]*\sr="([-\d.]+)"/);
    return Number(m?.[1]);
  };

  it("ceilingLight: glowIntensity scales the glow radius (m=18: 0.55x..1x of r=9)", () => {
    const dim = serialize(renderFurniture(ceilingLight, undefined, true, 0));
    const bright = serialize(renderFurniture(ceilingLight, undefined, true, 1));
    expect(glowRadius(dim)).toBeCloseTo(18 * 0.5 * 0.55); // 4.95
    expect(dim).toContain("--fp-glow-intensity:0.55");
    // Full brightness reproduces the exact pre-feature radius.
    expect(glowRadius(bright)).toBeCloseTo(18 * 0.5); // 9
  });

  it("ceilingLight: glowIntensity clamps out-of-range values into 0..1", () => {
    const over = serialize(renderFurniture(ceilingLight, undefined, true, 2));
    const under = serialize(renderFurniture(ceilingLight, undefined, true, -1));
    expect(glowRadius(over)).toBeCloseTo(18 * 0.5); // 9, same as intensity 1
    expect(glowRadius(under)).toBeCloseTo(18 * 0.5 * 0.55); // 4.95, same as intensity 0
  });

  it("lamp: active true adds fp-furn-glow; omitted/false is byte-identical", () => {
    const withoutParam = serialize(renderFurniture(lamp, undefined));
    const explicitFalse = serialize(renderFurniture(lamp, undefined, false));
    const active = serialize(renderFurniture(lamp, undefined, true));
    expect(withoutParam).not.toContain("fp-furn-glow");
    expect(explicitFalse).toEqual(withoutParam);
    expect(active).toContain("fp-furn-glow");
  });

  it("lamp: glowIntensity scales the glow radius (m=20: 0.55x..1x of r=15.6)", () => {
    const dim = serialize(renderFurniture(lamp, undefined, true, 0));
    const bright = serialize(renderFurniture(lamp, undefined, true, 1));
    expect(glowRadius(dim)).toBeCloseTo(20 * 0.78 * 0.55); // ~8.58
    expect(glowRadius(bright)).toBeCloseTo(20 * 0.78); // ~15.6
  });
```
(`ceilingLight`/`lamp` fixtures already exist at lines 836-837; `serialize` already exists at line 819.)

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/render.test.ts -t "glowIntensity"`
Expected: FAIL — `renderFurniture` does not accept a 4th argument yet (TS error) and the radii/`--fp-glow-intensity` token do not appear.

- [ ] **Step 3: Implement**

In `src/render.ts`, add `nothing` to the `"lit"` import (line 1):
```ts
import { svg, html, nothing, type SVGTemplateResult, type TemplateResult } from "lit";
```

Change the `renderFurniture` signature (line 939-943):
```ts
export function renderFurniture(
  f: Furniture,
  resolved?: ResolvedStyle,
  active = false,
  glowIntensity?: number,
): SVGTemplateResult {
```

Right after the existing `const color = ...`/`const tinted = ...`/`const fillOpacity = ...` block (lines 944-949), add:
```ts
  // Lights layer (off by default; see docs/superpowers/plans/2026-07-10-lights-layer.md):
  // a lit ceilingLight/lamp's glow scales with its bulb's real brightness instead
  // of the fixed idle/active look. Omitted (feature off, no entity, or no
  // brightness reading) keeps glowScale at 1 and adds no style attribute at all,
  // so the markup is byte-identical to the pre-feature output.
  const glowScale =
    glowIntensity === undefined ? 1 : 0.55 + 0.45 * Math.max(0, Math.min(1, glowIntensity));
  const glowStyle = glowIntensity === undefined ? nothing : `--fp-glow-intensity:${glowScale}`;
```

Change the `ceilingLight` case (lines 1319-1334):
```ts
    case "ceilingLight": {
      const m = Math.min(hw, hh);
      const ring = svg`
        <circle cx="0" cy="0" r=${m * 0.6} fill="none" stroke=${color} stroke-width="1.5" opacity="0.7" />
        <line x1="0" y1=${-m * 0.6} x2="0" y2=${-m * 0.86} stroke=${color} stroke-width="1.5" opacity="0.6" />
        <line x1=${m * 0.6} y1="0" x2=${m * 0.86} y2="0" stroke=${color} stroke-width="1.5" opacity="0.6" />
        <line x1="0" y1=${m * 0.6} x2="0" y2=${m * 0.86} stroke=${color} stroke-width="1.5" opacity="0.6" />
        <line x1=${-m * 0.6} y1="0" x2=${-m * 0.86} y2="0" stroke=${color} stroke-width="1.5" opacity="0.6" />
        <circle cx="0" cy="0" r=${m * 0.1} fill="none" stroke=${color} stroke-width="1.5" />`;
      detail = active
        ? svg`
        <circle class="fp-furn-glow" cx="0" cy="0" r=${m * 0.5 * glowScale} fill=${color}
                style=${glowStyle} />
        ${ring}`
        : ring;
      break;
    }
```

Change the `lamp` case (lines 1335-1349):
```ts
    case "lamp": {
      const m = Math.min(hw, hh);
      const shade = svg`
        <line x1=${m * 0.27} y1=${m * 0.27} x2=${m * 0.57} y2=${m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
        <line x1=${-m * 0.27} y1=${m * 0.27} x2=${-m * 0.57} y2=${m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
        <line x1=${m * 0.27} y1=${-m * 0.27} x2=${m * 0.57} y2=${-m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
        <line x1=${-m * 0.27} y1=${-m * 0.27} x2=${-m * 0.57} y2=${-m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
        <circle cx="0" cy="0" r=${m * 0.14} fill="none" stroke=${color} stroke-width="1.5" />`;
      detail = active
        ? svg`
        <circle class="fp-furn-glow" cx="0" cy="0" r=${m * 0.78 * glowScale} fill=${color}
                style=${glowStyle} />
        ${shade}`
        : shade;
      break;
    }
```

In `src/floorplan-card.ts`, update the `"./render"` import (lines 17-34) to add `lightVisual`:
```ts
import {
  WALL_THICKNESS,
  renderOpening,
  renderWallMask,
  resolveOpeningAmount,
  openingIsActive,
  openingClickAction,
  renderRipple,
  renderFurniture,
  renderRoom,
  renderTracker,
  trackerSensorReading,
  itemStateText,
  resolveStateStyle,
  type ResolvedStyle,
  hassRenderInputsChanged,
  collectWatchedEntities,
  entityIsActive,
  resolveItemIcon,
  lightVisual,
} from "./render";
```
Add a new import line after it (this also does Task 4's registration; see the note there):
```ts
import { featureEnabled } from "./features";
```

Update the CSS block (lines 754-761):
```css
    /* Light glow: a slow brightness swell on a lit disc (ceiling light, lamp).
       The resting opacity doubles as the reduced-motion pose, so animation: none
       leaves a steadily lit fixture. The 2.6 s period is deliberately out of
       step with the TV screen's 3 s so co-located glyphs do not pulse in
       lockstep. --fp-glow-intensity (set inline by renderFurniture only when the
       lightsLayer feature is on and the light reports a brightness reading)
       scales both the radius and this opacity together; it is unset everywhere
       else, so var(...,1) keeps every existing look identical. */
    .fp-furn-glow {
      opacity: calc(0.25 * var(--fp-glow-intensity, 1));
      animation: fp-furn-glow-swell 2.6s ease-in-out infinite;
    }
    @keyframes fp-furn-glow-swell {
      0%, 100% { opacity: calc(0.12 * var(--fp-glow-intensity, 1)); }
      50%      { opacity: calc(0.35 * var(--fp-glow-intensity, 1)); }
    }
```
(This replaces the existing comment above `.fp-furn-glow` at lines 749-753 as well as the rule itself — no backticks used.)

Update the furniture render call (lines 358-364):
```ts
            ${active.furniture.map((f) => {
              const style = resolveStateStyle(f.stateStyles, this.hass, f.entity);
              // Domain-aware active state (same as items' _isOn), so a reactive
              // glyph bound to e.g. a climate/media_player animates on its real
              // active states, not only literal on/open/home/playing.
              const isActive = !!f.entity && entityIsActive(f.entity, this.hass?.states[f.entity]?.state);
              // Lights layer (off by default): a lit ceilingLight/lamp's glow
              // scales with its bulb's real brightness. The piece's own entity is
              // already in this._watchedEntities (collectWatchedEntities), so
              // this needs no new watched entity.
              const glowIntensity =
                featureEnabled(c, "lightsLayer") && f.entity
                  ? lightVisual(this.hass?.states[f.entity]).intensity
                  : undefined;
              const shape = renderFurniture(f, style, isActive, glowIntensity);
              if (!f.entity) return shape;
```
(Everything from `if (!f.entity) return shape;` onward, lines 365-384, is unchanged.)

- [ ] **Step 4: Add the guard test**

In `src/floorplan-card.guard.test.ts`, add after the existing `it("wraps the svg and the overlay in a single .plate"...)` block:
```ts
  it("gates the furniture light glow behind the lightsLayer feature flag", () => {
    expect(src).toContain('featureEnabled(c, "lightsLayer")');
  });
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/render.test.ts src/floorplan-card.guard.test.ts`
Expected: PASS. Note: `npx tsc --noEmit` will still fail after this step because `./features` does not exist yet in isolation-testing order — since this plan assumes feature-toggles already landed on `main`, `src/features.ts` exists in the working tree and this compiles. If running this plan against a tree where it does not, stop and land that plan first (see Depends on).

- [ ] **Step 6: Typecheck + full suite + commit**
```bash
npx tsc --noEmit
npx vitest run --reporter=dot
git add src/render.ts src/render.test.ts src/floorplan-card.ts src/floorplan-card.guard.test.ts
git commit -m "Scale ceilingLight/lamp glow with brightness behind lightsLayer"
```

---

## Task 3: Room light-wash pure helpers

**Files:**
- Create: `src/lights.ts`
- Test: `src/lights.test.ts`

**Interfaces:**
- Consumes: `rgbColorOf`... actually `lightVisual` (Task 1), `stateStyleMatches` (`src/render.ts:279`), types `Room`, `RenderHass`, `StateStyle` (`src/types.ts`).
- Produces: `ROOM_LIGHT_WASH_OPACITY`, `renderRoomLightWash` — consumed by Task 4's `lightsLayer.render`.

- [ ] **Step 1: Write the failing tests**

Create `src/lights.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { Room, RenderHass } from "./types";
import { renderRoomLightWash, ROOM_LIGHT_WASH_OPACITY } from "./lights";

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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lights.test.ts`
Expected: FAIL — module `./lights` does not exist.

- [ ] **Step 3: Implement `src/lights.ts`**
```ts
import { svg, type SVGTemplateResult } from "lit";
import type { Room, RenderHass, StateStyle } from "./types";
import { lightVisual, stateStyleMatches } from "./render";

/**
 * Default extra opacity, at full brightness, this wash adds on top of whatever
 * `renderRoom`'s own `color: "rgb"` tint already drew (that tint is fixed-opacity
 * -- see docs/superpowers/plans/2026-07-10-lights-layer.md for why this is a
 * separate additive overlay rather than a change to renderRoom itself).
 */
export const ROOM_LIGHT_WASH_OPACITY = 0.25;

/**
 * A room has no entity of its own (unlike furniture/items), so a `color: "rgb"`
 * rule that follows a light must name it explicitly -- this mirrors
 * `resolveStateStyle`'s `rule.entity ?? ownEntity` with `ownEntity` always
 * undefined for a room.
 */
function roomLightRule(rules: StateStyle[] | undefined): StateStyle | undefined {
  return rules?.find((r) => r.color === "rgb" && r.entity);
}

/**
 * The brightness-aware wash for one room, or `""` when the room is not
 * light-bound, its rule does not currently match, or the light has no
 * brightness reading yet.
 */
export function renderRoomLightWash(r: Room, hass: RenderHass | undefined): SVGTemplateResult | "" {
  const rule = roomLightRule(r.stateStyles);
  if (!rule?.entity) return "";
  const st = hass?.states[rule.entity];
  if (!stateStyleMatches(rule, st)) return "";
  const visual = lightVisual(st);
  if (!visual.color || visual.intensity === undefined) return "";
  const pts = r.points.map(([x, y]) => `${x},${y}`).join(" ");
  return svg`<polygon class="fp-room-light-wash" points=${pts} fill=${visual.color}
                       fill-opacity=${ROOM_LIGHT_WASH_OPACITY * visual.intensity} />`;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/lights.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/lights.ts src/lights.test.ts
git commit -m "Add the room light-wash helper (pure, not yet wired into a layer)"
```

---

## Task 4: Register `lightsLayer` and wire it into the card

**Files:**
- Modify: `src/lights.ts` (append the `LiveLayer`)
- Modify: `src/lights.test.ts` (append layer tests)
- Modify: `src/floorplan-card.ts` (one side-effect import; the `featureEnabled`/`lightVisual` imports were already added in Task 2)
- Test: `src/floorplan-card.guard.test.ts` (one new guard)

**Interfaces:**
- Consumes: `LiveLayer`, `LayerRenderCtx`, `LIVE_LAYERS` from `src/layers.ts` (produced by the layer-framework plan — exact shape: `{ id: FeatureName; label: string; icon: string; render(ctx: LayerRenderCtx): SVGTemplateResult; watched(c: FloorplanCardConfig): Iterable<string> }`); `getFloors` from `src/types.ts`; `renderRoomLightWash` (Task 3).
- Produces: `lightsLayer: LiveLayer` — the layer framework's own `render()`/toggle-chip/`layerWatchedEntities` machinery consumes it automatically once it is in `LIVE_LAYERS`; nothing else in this codebase calls it directly.

- [ ] **Step 1: Write the failing tests**

Append to `src/lights.test.ts` (new imports at the top, alongside the existing ones):
```ts
import type { FloorplanCardConfig } from "./types";
import { lightsLayer } from "./lights";
import { LIVE_LAYERS } from "./layers";
```
(Add `lightsLayer` to the existing `from "./lights"` import line instead of a second import statement.)

```ts
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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lights.test.ts -t lightsLayer`
Expected: FAIL — `lightsLayer` is not exported and `./layers` does not exist (until the layer-framework plan lands; per Depends on it must already be on `main` before this task runs, so this failure is "not implemented yet in `lights.ts`", not a missing dependency).

- [ ] **Step 3: Implement**

Append to `src/lights.ts` (new imports merged into the existing ones at the top):
```ts
import type { Room, RenderHass, StateStyle, FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LiveLayer, LayerRenderCtx } from "./layers";
import { LIVE_LAYERS } from "./layers";
```
And at the bottom of the file:
```ts
/** Every entity a floor's rooms follow via a `color: "rgb"` rule. */
function roomLightEntities(floor: { rooms?: Room[] }): string[] {
  const out: string[] = [];
  for (const r of floor.rooms ?? []) {
    const rule = roomLightRule(r.stateStyles);
    if (rule?.entity) out.push(rule.entity);
  }
  return out;
}

/**
 * The room-tint half of the lights layer (1b) -- see
 * docs/superpowers/plans/2026-07-10-lights-layer.md. The furniture-glow half
 * lives directly in renderFurniture/floorplan-card.ts, not here: a lamp/
 * ceilingLight is already a single entity-bound piece with its entity already
 * watched, so it needs no layer machinery. A room, in contrast, has no entity
 * of its own to watch, which is exactly what a LiveLayer's `watched()` is for.
 */
export const lightsLayer: LiveLayer = {
  id: "lightsLayer",
  label: "Lights",
  icon: "mdi:lightbulb-multiple-outline",
  render(ctx: LayerRenderCtx): SVGTemplateResult {
    const washes = (ctx.floor.rooms ?? [])
      .map((r) => renderRoomLightWash(r, ctx.hass))
      .filter((t): t is SVGTemplateResult => t !== "");
    return washes.length ? svg`<g class="fp-lights-layer">${washes}</g>` : svg``;
  },
  watched(c: FloorplanCardConfig): Iterable<string> {
    const ids = new Set<string>();
    for (const f of getFloors(c)) for (const id of roomLightEntities(f)) ids.add(id);
    return ids;
  },
};

LIVE_LAYERS.push(lightsLayer);
```
Note: `FloorplanCardConfig`, `RenderHass` were already imported for Task 3; add only what's new (`getFloors`, `LiveLayer`, `LayerRenderCtx`, `LIVE_LAYERS`) to avoid duplicate-import errors.

In `src/floorplan-card.ts`, add the side-effect import next to the `"./features"` import added in Task 2:
```ts
import { featureEnabled } from "./features";
// Registers the room-tint overlay into the live-layer registry; the layer
// framework (src/layers.ts) renders it, gives it a toggle chip, and folds its
// watched entity into the card automatically once features.lightsLayer is on.
// Nothing else in this file references lights.ts directly.
import "./lights";
```

- [ ] **Step 4: Add the guard test**

In `src/floorplan-card.guard.test.ts`, add after the guard from Task 2:
```ts
  it("registers the lights layer with the live-layer framework", () => {
    expect(src).toContain('import "./lights"');
  });
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/lights.test.ts src/floorplan-card.guard.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + full suite + build + commit**
```bash
npx tsc --noEmit
npx vitest run --reporter=dot
npm run build
git add src/lights.ts src/lights.test.ts src/floorplan-card.ts src/floorplan-card.guard.test.ts
git commit -m "Register lightsLayer: brightness-scaled room tint via the live-layer framework"
```

---

## Task 5 (controller): Verify + gate

- [ ] Full suite green: `npx vitest run --reporter=dot`.
- [ ] `npx tsc --noEmit` green.
- [ ] `npm run build` succeeds.
- [ ] Confirm `npm run schema` was **not** needed and the schema file is untouched (`git status schema/` shows nothing) — this plan added no config fields.
- [ ] Dev harness, flag off (no `features` block, or `features: { lightsLayer: false }`): a `ceilingLight`/`lamp` bound to a light shows the same fixed glow as before; a room with a `color: "rgb"` rule shows the same fixed-opacity tint as before; no toggle chip for "Lights" appears (the layer framework only shows chips for enabled layers); `light.<x>`'s brightness changing does not trigger any markup change beyond what already happened via the existing rgb/on-off tint.
- [ ] Dev harness, flag on (`features: { lightsLayer: true }`): dim the bound light — the ceilingLight/lamp glow shrinks and the room's wash fades; brighten it — both grow; a "Lights" toggle chip appears (from the layer framework) and hides/shows the room wash without touching the furniture glow (that path is not layer-gated by the runtime toggle, only by the config flag — confirm this is the intended, documented split, not an oversight).
- [ ] Confirm byte-identical output with the flag off by diffing a snapshot of `floorplan-card.ts`'s rendered SVG for a config with a light-bound room + a `ceilingLight` furniture piece, flag off, against the same config on `main` before this branch — should be identical.

## Self-Review
- Spec coverage: `featureEnabled(config, "lightsLayer")` gate (Tasks 2 & 4, default off, byte-identical off per Task 2 Step 3's `glowScale`/`glowStyle` and Task 4's flag-gated framework rendering) ✓; furniture glow extends `renderFurniture` (Task 2) vs. room tint registers a `LiveLayer` (Task 4) — decided and specified precisely, with the rationale (room has no entity of its own to watch; furniture does) documented inline in `lightsLayer`'s doc comment ✓; `brightness`/`rgb_color` reading via `lightVisual` with tests (Task 1) ✓; reuses `fp-furn-glow` (Task 2 extends its CSS rather than adding a new class) and `color: "rgb"` (Task 3's `roomLightRule` requires it) ✓.
- Zero cost when off: furniture glow adds no new watched entity (reuses `f.entity`, already in `_watchedEntities`); the `lightsLayer` `LiveLayer` only contributes to `layerWatchedEntities` when `featureEnabled` is true (the layer framework's own `enabledLayers` filter, consumed not reimplemented here) ✓.
- No schema change — call out explicit in Global Constraints and Task 5 ✓. No backticks in the `css` comment edited in Task 2 ✓.
- No placeholder steps; every code step shows real code with exact file paths/line numbers grepped from the current tree ✓.
- Type consistency: `renderFurniture`'s new 4th param is named `glowIntensity` everywhere (Task 2's signature, call site, and tests); `lightVisual`'s return type `LightVisual` and field names (`color`, `intensity`) are identical across Tasks 1, 2, and 3; `lightsLayer.id`/`watched`/`render` match the `LiveLayer` shape from the layer-framework plan's Produced Interfaces block exactly (`id: FeatureName`, `watched(c): Iterable<string>`, `render(ctx): SVGTemplateResult`) ✓.
