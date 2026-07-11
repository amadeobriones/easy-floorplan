# Climate / Thermal Layer (1c) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rooms with a bound temperature sensor shade warm↔cool (blue↔red around a
comfort midpoint) as a live overlay, registered as the `thermalLayer` `LiveLayer`
from the layer framework — off by default, zero cost when off.

**Architecture:** A pure numeric→CSS-colour gradient helper (`tempColor`) plus a
per-room overlay renderer (`renderThermalOverlay`) live in a new `src/thermal.ts`,
alongside the `THERMAL_LAYER: LiveLayer` object that wires them into the
`render`/`watched` shape the layer framework expects. `src/layers.ts` gains a
one-line import + push to register it. Each room that wants shading declares a new
`tempEntity?: string` field (an explicit binding, not derived from the room's
`areaId` — see "Design decision" below). The overlay is a second, independent SVG
polygon drawn by the layer framework's own layer group; it stacks visually over a
room's existing `fill`/`stateStyles` colour rather than replacing it.

**Tech Stack:** Lit + TypeScript, Vitest, `typescript-json-schema` for schema.

## Depends on
- `docs/superpowers/plans/2026-07-10-feature-toggles.md` — consumes `featureEnabled`,
  `FeatureName` (via `LiveLayer.id`). Must be merged first.
- `docs/superpowers/plans/2026-07-10-layer-framework.md` — consumes `LiveLayer`,
  `LayerRenderCtx`, `LIVE_LAYERS`, `enabledLayers`, `layerWatchedEntities` from
  `src/layers.ts`. Must be merged first.

As of 2026-07-10, grep confirms neither `src/features.ts` nor `src/layers.ts`
exists yet — both are still plans. **Execute those two plans (in order) before
this one.** Every code snippet below assumes their exact produced interfaces,
reproduced here for reference:
```ts
// from feature-toggles: src/features.ts
export type FeatureName = keyof FeaturesConfig; // includes "thermalLayer"
export function featureEnabled(c: { features?: FeaturesConfig } | undefined, name: FeatureName): boolean;

// from layer-framework: src/layers.ts
export interface LayerRenderCtx {
  floor: Floor;
  hass: RenderHass | undefined;
  config: FloorplanCardConfig;
}
export interface LiveLayer {
  id: FeatureName;
  label: string;
  icon: string;
  render(ctx: LayerRenderCtx): SVGTemplateResult;
  watched(c: FloorplanCardConfig): Iterable<string>;
}
export const LIVE_LAYERS: LiveLayer[];
export function enabledLayers(c: FloorplanCardConfig): LiveLayer[];
export function layerWatchedEntities(c: FloorplanCardConfig): Set<string>;
```

## Design decision: explicit `tempEntity`, not area-derived
The roadmap entry (1c) allows either "a new per-room `tempEntity`" or reusing the
room's area's climate/temperature entity. This plan picks the **explicit field**:
- `Room` currently has no general "own entity" concept (unlike `FloorItem` /
  `Furniture`) — its only entity-shaped field is `stateStyles[].entity`, and
  `resolveStateStyle` is called with `ownEntity: undefined` for rooms
  (`src/floorplan-card.ts:356`). A dedicated `tempEntity` avoids overloading that
  path with a second, layer-specific meaning.
- Area-derivation would require picking *which* of possibly several
  temperature-class entities in an area to use, silently, at render time — a
  correctness footgun. An explicit field is unambiguous and directly testable.
- `src/areas.ts` already has `entitiesInArea(hass, areaId)` for a *future*
  "auto-fill tempEntity from area" editor convenience (Track 3a territory) — out
  of scope here; this plan does not add that lookup.
- **Out of scope (explicit):** a setpoint-vs-actual chip. The roadmap calls it
  optional ("optionally with a setpoint-vs-actual cue"); nothing in the task
  checklist requires it, and it is not needed for a working, testable overlay.
  Left as a natural follow-up.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push
  `feat/item-kinds-and-aspect`.
- Branch `feat/thermal-layer` off `main`, after `feat/feature-toggles` and
  `feat/layer-framework` have both merged.
- The `thermalLayer` feature flag defaults **off** (inherited from
  `FEATURE_DEFAULTS.thermalLayer = false`); a config with no `features` block, or
  `features.thermalLayer` unset/false, renders **byte-identically** to today and
  contributes **zero** watched entities, even if rooms carry a `tempEntity`.
- Adding `tempEntity` to `Room` changes the generated schema → run `npm run schema`
  and commit the additive diff.
- Landmine: no backticks in `css` tagged-template comments (this plan does not
  touch any `css` tagged template, but keep it in mind if a later task does).
- Run: `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`;
  `npx tsc --noEmit`; `npm run build`.

## File Structure
- `src/thermal.ts` (new) — `ThermalRange`, `DEFAULT_THERMAL_RANGE`, `tempColor()`,
  `THERMAL_FILL_OPACITY`, `renderThermalOverlay()`, `THERMAL_LAYER: LiveLayer`.
  One file: the gradient math, the room-overlay draw, and the layer wiring are
  small and only ever change together.
- `src/thermal.test.ts` (new) — unit tests for all of the above.
- `src/types.ts` — add `tempEntity?: string` to `Room` (near `areaId`, `src/types.ts:151`).
- `src/validate.ts` — add `tempEntity: str` to the `room` shape (`src/validate.ts:62`).
- `schema/floorplan-card.schema.json` — regenerated via `npm run schema` (additive).
- `src/layers.ts` — import `THERMAL_LAYER` from `./thermal`, push it onto
  `LIVE_LAYERS` at module scope. This is the only card-adjacent file this plan
  touches — the framework already renders/gates/watches whatever is registered.
- `src/layers.test.ts` — one new `describe` block asserting the real
  `THERMAL_LAYER` is registered and correctly gated (does not touch the
  framework's own fake-layer tests).

**Circular-import note:** `src/thermal.ts` needs the `LiveLayer` / `LayerRenderCtx`
*types* from `src/layers.ts`, and `src/layers.ts` needs the `THERMAL_LAYER`
*value* from `src/thermal.ts`. This is safe: `thermal.ts` imports those two names
with `import type { ... } from "./layers"` (fully erased at compile time, no
runtime edge), while `layers.ts` does a normal value import of `THERMAL_LAYER`.
Only one runtime edge exists (`layers.ts → thermal.ts`), so there is no cycle at
runtime.

---

## Task 1: `tempColor` gradient helper

**Files:**
- Create: `src/thermal.ts`
- Test: `src/thermal.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no dependency on layers.ts yet).
- Produces: `ThermalRange`, `DEFAULT_THERMAL_RANGE`, `tempColor(celsius, range?)` —
  consumed by Task 2 (`renderThermalOverlay`) and Task 4 (`THERMAL_LAYER.render`).

- [ ] **Step 1: Write the failing test**
```ts
// src/thermal.test.ts
import { describe, it, expect } from "vitest";
import { tempColor, DEFAULT_THERMAL_RANGE } from "./thermal";

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
```
- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/thermal.test.ts`
Expected: FAIL — `Cannot find module './thermal'` (file does not exist yet).

- [ ] **Step 3: Implement `src/thermal.ts`**
```ts
// src/thermal.ts
import { svg, type SVGTemplateResult } from "lit";
import type { Room, RenderHass, FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";

/** A comfort band: `min`/`max` are where the gradient saturates to pure
 * cold/hot; `mid` is the "neutral" comfort point the room reads as unstyled. */
export interface ThermalRange {
  min: number;
  mid: number;
  max: number;
}

/** Celsius. 16 = cold, 21 = comfortable, 27 = hot -- a generic home comfort band. */
export const DEFAULT_THERMAL_RANGE: ThermalRange = { min: 16, mid: 21, max: 27 };

type Rgb = [number, number, number];

// Material Design blue 500 / blue-grey 200 / red 500 -- cold, neutral, hot.
const COLD_RGB: Rgb = [33, 150, 243];
const NEUTRAL_RGB: Rgb = [176, 190, 197];
const HOT_RGB: Rgb = [244, 67, 54];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * A temperature reading (Celsius) as a CSS colour on a blue (cold) -> neutral
 * (comfort midpoint) -> red (hot) gradient. Clamps outside `[min, max]` so an
 * outlier reading saturates instead of extrapolating into nonsense colours.
 */
export function tempColor(celsius: number, range: ThermalRange = DEFAULT_THERMAL_RANGE): string {
  const { min, mid, max } = range;
  const c = Math.max(min, Math.min(max, celsius));
  if (c <= mid) {
    const span = mid - min;
    const t = span === 0 ? 1 : (c - min) / span;
    return rgbToCss(lerpRgb(COLD_RGB, NEUTRAL_RGB, t));
  }
  const span = max - mid;
  const t = span === 0 ? 1 : (c - mid) / span;
  return rgbToCss(lerpRgb(NEUTRAL_RGB, HOT_RGB, t));
}
```
(`LayerRenderCtx`/`LiveLayer` are imported here already because Task 4 extends
this same file; unused imports would fail `tsc --noEmit` with `noUnusedLocals`
were it on, so leave them out of this step's diff if your linter is strict --
they are introduced for real in Task 4. For this step, import only what Step 3
uses: drop the `LayerRenderCtx`/`LiveLayer`/`svg`/`Room`/`RenderHass`/
`FloorplanCardConfig`/`getFloors` imports and add them back in Task 2/4.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/thermal.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/thermal.ts src/thermal.test.ts
git commit -m "Add tempColor: a temperature-to-gradient-colour helper"
```

## Task 2: `renderThermalOverlay` — per-room tint

**Files:**
- Modify: `src/thermal.ts`
- Test: `src/thermal.test.ts`

**Interfaces:**
- Consumes: `tempColor(celsius, range?)` (Task 1); `Room` (`src/types.ts`).
- Produces: `THERMAL_FILL_OPACITY`, `renderThermalOverlay(room, celsius, range?)` —
  consumed by Task 4 (`THERMAL_LAYER.render`).

- [ ] **Step 1: Write the failing test**
```ts
// append to src/thermal.test.ts
import { renderThermalOverlay, THERMAL_FILL_OPACITY } from "./thermal";

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
```
Add `import type { Room } from "./types";` to the test file's imports if not
already present (it is needed for the `Room` annotation above).
- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/thermal.test.ts`
Expected: FAIL — `renderThermalOverlay`/`THERMAL_FILL_OPACITY` not exported.

- [ ] **Step 3: Implement in `src/thermal.ts`**

Add the `svg`, `Room` imports to the top of the file (from Task 1's parenthetical
note) and append:
```ts
/** Overlay opacity: visible over a room's own fill/stateStyles colour without
 * washing it out -- this is a second polygon stacked on top, not a replacement. */
export const THERMAL_FILL_OPACITY = 0.28;

/** A room's temperature tint as its own SVG polygon, stacked over the room's
 * existing fill. Never a click target -- it is decoration over whatever the
 * room / items beneath it already handle. */
export function renderThermalOverlay(
  room: Room,
  celsius: number,
  range?: ThermalRange,
): SVGTemplateResult {
  const pts = room.points.map(([x, y]) => `${x},${y}`).join(" ");
  return svg`<polygon
    class="fp-thermal-room"
    points=${pts}
    fill=${tempColor(celsius, range)}
    fill-opacity=${THERMAL_FILL_OPACITY}
    pointer-events="none"
    style="transition: fill 0.6s ease;"
  />`;
}
```
Update the file's top imports to:
```ts
import { svg, type SVGTemplateResult } from "lit";
import type { Room, RenderHass, FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";
```
(`RenderHass`, `FloorplanCardConfig`, `getFloors`, `LayerRenderCtx`, `LiveLayer`
are still unused until Task 4 — if your `tsc` config has `noUnusedLocals`, defer
adding them until Task 4's Step 3 instead of here.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/thermal.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/thermal.ts src/thermal.test.ts
git commit -m "Add renderThermalOverlay: a room's temperature tint as an SVG polygon"
```

## Task 3: `Room.tempEntity` — type, validator, schema

**Files:**
- Modify: `src/types.ts` (`Room` interface, `src/types.ts:139-152`)
- Modify: `src/validate.ts` (`room` shape, `src/validate.ts:62`)
- Test: `src/validate.test.ts`
- Regenerate: `schema/floorplan-card.schema.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Room.tempEntity?: string` — consumed by Task 4
  (`THERMAL_LAYER.render`/`.watched`, which read `room.tempEntity`).

- [ ] **Step 1: Write the failing test**

Grep first to confirm the exact existing `validateConfig` room-acceptance test to
extend, and the exact `describe` name in use:
```bash
grep -n "describe(\"room\|areaId" src/validate.test.ts
```
Then add (adjusting to the file's existing style if the grep shows a different
shape):
```ts
// src/validate.test.ts — inside (or alongside) the room-validation describe block
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
```
- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/validate.test.ts`
Expected: FAIL — the "rejects a non-string tempEntity" case currently passes
validation (unknown keys are allowed), so the *accept* test passes but nothing
guards the bad-type case. Confirm by running: the reject test should currently
report `ok: true` when it expects `false` — i.e. it fails for the right reason
(no type-checking of `tempEntity` yet).

- [ ] **Step 3: Implement**

In `src/types.ts`, add to `Room` (right after `areaId`, `src/types.ts:151`):
```ts
  /** Home Assistant area id. Stored, not yet acted on (see Floor.haFloor). */
  areaId?: string;
  /**
   * Temperature-class entity (e.g. a `sensor` with `device_class: temperature`)
   * that drives this room's thermal-layer tint. Unset = the room is not shaded
   * by the thermal layer, even when the feature is on (see
   * docs/superpowers/plans/2026-07-10-thermal-layer.md).
   */
  tempEntity?: string;
```

In `src/validate.ts`, change the `room` shape (`src/validate.ts:62`):
```ts
const room = shape(
  { id: str, points: arrayOf(point) },
  { name: str, areaId: str, fill: str, fillOpacity: num, tempEntity: str },
);
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate schema + typecheck + commit**
```bash
npm run schema
npx tsc --noEmit
git add src/types.ts src/validate.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Add Room.tempEntity: the thermal layer's per-room sensor binding"
```

## Task 4: `THERMAL_LAYER` — the `LiveLayer` object

**Files:**
- Modify: `src/thermal.ts`
- Test: `src/thermal.test.ts`

**Interfaces:**
- Consumes: `LiveLayer`, `LayerRenderCtx` (`src/layers.ts`, from the layer-framework
  plan); `tempColor`, `renderThermalOverlay`, `DEFAULT_THERMAL_RANGE` (Tasks 1-2);
  `Room.tempEntity` (Task 3); `getFloors` (`src/types.ts`).
- Produces: `THERMAL_LAYER: LiveLayer` — consumed by Task 5 (registration into
  `LIVE_LAYERS`).

- [ ] **Step 1: Write the failing test**
```ts
// append to src/thermal.test.ts
import { THERMAL_LAYER } from "./thermal";
import type { Floor, RenderHass } from "./types";

function fakeHass(states: Record<string, { state: string }>): RenderHass {
  return { states, formatEntityState: (s: { state: string }) => s.state } as unknown as RenderHass;
}

function fakeFloor(rooms: Room[]): Floor {
  return { id: "f1", name: "F1", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [], rooms };
}

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
```
- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/thermal.test.ts`
Expected: FAIL — `THERMAL_LAYER` is not exported yet.

- [ ] **Step 3: Implement in `src/thermal.ts`**

Ensure the top-of-file imports now include everything (finalize the imports left
pending in Tasks 1-2):
```ts
import { svg, type SVGTemplateResult } from "lit";
import type { Room, RenderHass, FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";
```
Append:
```ts
/** A finite numeric reading, or undefined for an outage/non-numeric state --
 * mirrors how the rest of this card fails closed on `unavailable`/`unknown`
 * (see stateStyleMatches in src/render.ts) rather than reading an outage as 0. */
function numericReading(hass: RenderHass | undefined, entityId: string): number | undefined {
  const state = hass?.states[entityId]?.state;
  if (state === undefined) return undefined;
  const n = Number(state);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The thermal / climate live layer (roadmap 1c): tints every room that carries
 * a `tempEntity` on a blue (cold) -> neutral -> red (hot) gradient. Rendered and
 * gated entirely by the layer framework (src/layers.ts) once registered --
 * this object only needs to answer "what do you draw" and "what do you watch".
 */
export const THERMAL_LAYER: LiveLayer = {
  id: "thermalLayer",
  label: "Climate layer",
  icon: "mdi:thermometer",
  render(ctx: LayerRenderCtx): SVGTemplateResult {
    const rooms = ctx.floor.rooms ?? [];
    const overlays = rooms
      .filter((r): r is Room & { tempEntity: string } => !!r.tempEntity)
      .map((r) => {
        const c = numericReading(ctx.hass, r.tempEntity);
        return c === undefined ? svg`` : renderThermalOverlay(r, c);
      });
    return svg`${overlays}`;
  },
  watched(c: FloorplanCardConfig): Iterable<string> {
    const ids = new Set<string>();
    for (const f of getFloors(c)) {
      for (const r of f.rooms ?? []) {
        if (r.tempEntity) ids.add(r.tempEntity);
      }
    }
    return ids;
  },
};
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/thermal.test.ts`
Expected: PASS (15 tests total).

- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/thermal.ts src/thermal.test.ts
git commit -m "Add THERMAL_LAYER: the thermal-layer LiveLayer object"
```

## Task 5: Register `THERMAL_LAYER` in `LIVE_LAYERS`

**Files:**
- Modify: `src/layers.ts` (grep-confirm exact current contents first — it is
  created by the layer-framework plan; this task only appends an import + push)
- Test: `src/layers.test.ts`

**Interfaces:**
- Consumes: `LIVE_LAYERS: LiveLayer[]`, `enabledLayers`, `layerWatchedEntities`
  (`src/layers.ts`, layer-framework plan); `THERMAL_LAYER` (Task 4).
- Produces: nothing further — this is the last wiring step. `THERMAL_LAYER` is now
  live end-to-end (card renders it via the framework once `feat/layer-framework`'s
  Task 3 render-site change is in place).

- [ ] **Step 1: Confirm the exact current `src/layers.ts` contents**
```bash
grep -n "^import\|^export const LIVE_LAYERS" src/layers.ts
```
Expect to see `export const LIVE_LAYERS: LiveLayer[] = [];` per the
layer-framework plan's Task 1. If the array is declared with an inline `[]`
literal (not built up via `.push`), add the push as a separate statement right
after the declaration — do not try to inline `THERMAL_LAYER` into the array
literal, since that would require editing a line owned by the framework's own
tests (Task 1 of the layer-framework plan asserts `LIVE_LAYERS` starts empty
*before* any feature registers into it; that test runs before this plan's import
executes and is unaffected by a `.push` appended after the declaration).

- [ ] **Step 2: Write the failing test**
```ts
// append to src/layers.test.ts
import { THERMAL_LAYER } from "./thermal";

describe("thermalLayer registration", () => {
  const cfg = {
    type: "x", width: 10, height: 10,
    floors: [
      {
        id: "f", name: "F", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [],
        rooms: [{ id: "r1", points: [[0, 0], [1, 1]], tempEntity: "sensor.living_temp" }],
      },
    ],
  } as unknown as FloorplanCardConfig;

  it("is registered in LIVE_LAYERS", () => {
    expect(LIVE_LAYERS.some((l) => l.id === "thermalLayer")).toBe(true);
    expect(LIVE_LAYERS.find((l) => l.id === "thermalLayer")).toBe(THERMAL_LAYER);
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
```
Add `import type { FloorplanCardConfig } from "./types";` if `src/layers.test.ts`
does not already import it.
- [ ] **Step 3: Run it, verify it fails**

Run: `npx vitest run src/layers.test.ts`
Expected: FAIL — `LIVE_LAYERS` does not yet contain a `thermalLayer` entry.

- [ ] **Step 4: Implement — register the layer**

In `src/layers.ts`, add near the top (after the existing imports) and right
after the `LIVE_LAYERS` declaration:
```ts
import { THERMAL_LAYER } from "./thermal";
```
```ts
export const LIVE_LAYERS: LiveLayer[] = [];
LIVE_LAYERS.push(THERMAL_LAYER);
```
- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/layers.test.ts`
Expected: PASS (all `layers.test.ts` tests, including the framework's own
empty-registry/fake-layer tests from the layer-framework plan and this task's
three new ones).

- [ ] **Step 6: Full suite + typecheck + build + commit**
```bash
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
git add src/layers.ts src/layers.test.ts
git commit -m "Register the thermal layer in LIVE_LAYERS"
```

## Task 6 (controller): Verify + gate

- [ ] Full suite green: `npx vitest run --reporter=dot`.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.
- [ ] Byte-identical when off: take any existing example config (e.g.
  `schema/example.json`, or the dev harness's default), confirm it has no
  `features.thermalLayer: true`, and confirm the rendered card is unchanged from
  before this plan (no thermal overlay, no toggle-chip change beyond whatever the
  layer-framework plan already added for a zero-layer state — this plan does not
  add a second chip unless the flag is on).
- [ ] Dev harness (or a scratch config): add a room with `tempEntity` pointing at
  a real/fake temperature sensor, set `features: { thermalLayer: true }`. Confirm:
  the room tints blue/red/neutral depending on the reading; changing the sensor's
  state re-tints it (the framework's watched-entity wiring from
  `layer-framework`'s Task 2 picks up `THERMAL_LAYER.watched()`); toggling the
  flag off removes the tint and the entity drops out of the watched set (check via
  whatever debug hook the layer-framework plan exposed, or by confirming the card
  does not re-render for a state change on that entity when the flag is off).
- [ ] Confirm `git log` shows one commit per task, no AI-authorship footers, and
  nothing was pushed anywhere.

## Self-Review
- **Spec coverage:** `LiveLayer` registration gated by `featureEnabled` (Task 5)
  with byte-identical + zero-watched-entities-when-off (Task 5's registration test
  + Task 6's harness check) ✓. Numeric→gradient helper with cold/comfort/hot/clamp
  unit tests (Task 1) ✓. `tempEntity?: string` on `Room` + validator + schema
  (Task 3) ✓. Writing-plans header + Global Constraints present, covering nothing
  outward / no AI-authorship footers / byte-identical-when-off / additive schema /
  no-backticks-in-css-comments (n/a here, no `css` template touched) /
  vitest+tsc+build ✓. Bite-sized TDD tasks with exact paths, Interfaces blocks, and
  this Self-Review ✓.
- **Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N" language;
  every code step shows complete code, including the two "finalize the imports"
  notes in Tasks 2 and 4, which name the exact final import block rather than
  saying "add the needed imports."
- **Type consistency check:** `tempColor(celsius: number, range?: ThermalRange)`
  (Task 1) is called identically in Task 2 (`renderThermalOverlay`) and Task 4
  (indirectly, via `renderThermalOverlay`). `THERMAL_LAYER: LiveLayer` (Task 4)
  matches the `LiveLayer` interface's `render(ctx: LayerRenderCtx): SVGTemplateResult`
  and `watched(c: FloorplanCardConfig): Iterable<string>` signatures exactly as
  produced by the layer-framework plan. `Room.tempEntity?: string` (Task 3) is the
  field read by both `THERMAL_LAYER.render` and `.watched` (Task 4) — same name,
  same optionality, no drift.
- **Scope check:** setpoint-vs-actual cue and area-derived `tempEntity` lookup are
  both explicitly out of scope (see "Design decision" above) rather than silently
  dropped — a deliberate YAGNI cut, not a gap.
