# Energy Layer (1e) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switches/plugs on the plan are colored (and optionally size-bumped) by their live power draw — a glanceable "what's using power right now" cue — driven by a new per-item `powerEntity`, delivered as ONE registered `LiveLayer` gated on `featureEnabled(config, "energyLayer")`.

**Architecture:** Add `powerEntity?: string` to `FloorItem`. Add a pure `powerColor(watts, {lowW, highW})` value to color ramp helper (neutral to hot, clamped) plus a small size-bump helper, both unit-tested. Register one `LiveLayer` with `id: "energyLayer"` that draws an SVG halo cue under each item that has a `powerEntity`, colored by that entity's current watts, and reports those entities via `watched()`. The layer framework renders it only when the feature flag is on AND the runtime toggle is active, and folds its watched entities into the card's watched set only when enabled — so with the flag off the card is byte-identical and nothing is watched.

**Tech Stack:** Lit + TypeScript, Vitest, `typescript-json-schema` for the generated schema.

## Depends on

These two plans MUST land first (both are currently unimplemented plan docs — `src/features.ts` and `src/layers.ts` do not yet exist):

1. `docs/superpowers/plans/2026-07-10-feature-toggles.md` — provides `FeaturesConfig` (with the `energyLayer?: boolean` key), `FeatureName`, `FEATURE_DEFAULTS`, `FEATURE_META`, and `featureEnabled(config, name)` in `src/features.ts`; and `FloorplanCardConfig.features?: FeaturesConfig`. This plan **consumes** them — it does not redefine them.
2. `docs/superpowers/plans/2026-07-10-layer-framework.md` — provides `src/layers.ts` with the `LiveLayer` / `LayerRenderCtx` types, the `LIVE_LAYERS` registry, `enabledLayers(config)`, and `layerWatchedEntities(config)`; and wires the card `render()` to draw `enabledLayers(...).filter(l => !this._hiddenLayers.has(l.id)).map(l => l.render(ctx))` inside a `<g class="fp-layers">`, plus the toggle-chip row, plus the union of `layerWatchedEntities(config)` into the card's watched set. This plan **appends one entry** to `LIVE_LAYERS` and adds nothing else to the card.

If either prerequisite has not landed, STOP and land it first — do not re-implement its pieces here.

## Global Constraints

- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`.
- Branch `feat/energy-layer` off `main` (after feature-toggles and layer-framework merge).
- **Default off, zero cost when off:** with `energyLayer` unset/false the card is **byte-identical** to today — no DOM added, no toggle chip, and the layer's `powerEntity` entities do **not** appear in the card's watched set (guaranteed because `enabledLayers`/`layerWatchedEntities` filter by `featureEnabled`, which defaults `energyLayer` to `false`).
- **Additive schema:** adding `powerEntity` to `FloorItem` changes the generated schema → run `npm run schema` and commit the additive diff (the drift/schema test enforces it).
- Landmine: **no backticks in `css` tagged-template comments** (they break the Lit template).
- The layer renders into the floor SVG whose `viewBox="0 0 ${c.width} ${c.height}"` (`src/floorplan-card.ts:350`), so an item's `x`/`y` are already in SVG user units — draw the cue at `cx=item.x cy=item.y` directly, no rescaling.
- Run per file: `npx vitest run src/<file>.test.ts`. Full suite: `npx vitest run --reporter=dot`. Typecheck: `npx tsc --noEmit` (aka `npm run typecheck`). Build: `npm run build`. Schema: `npm run schema`.

## Produced interfaces (exact names/types)

```ts
// src/energy-layer.ts (new)
import type { LiveLayer, LayerRenderCtx } from "./layers";
import type { FloorplanCardConfig } from "./types";

export interface EnergyRampOpts {
  lowW: number;    // at/below this many watts the cue is neutral
  highW: number;   // at/above this many watts the cue is fully hot
}
export const DEFAULT_ENERGY_RAMP: EnergyRampOpts;        // { lowW: 5, highW: 500 }

// value -> color ramp. Non-finite / <= lowW -> neutral; >= highW -> hot; linear rgb lerp between.
export function powerColor(watts: number, opts?: Partial<EnergyRampOpts>): string;

// optional badge/cue size bump in px. 0 at/below lowW, +maxBumpPx at/above highW, linear between.
export function powerCueBump(watts: number, maxBumpPx?: number, opts?: Partial<EnergyRampOpts>): number;

// parse a power sensor state string to watts (returns undefined when not a finite number).
export function parseWatts(state: string | undefined): number | undefined;

export const energyLayer: LiveLayer;   // id: "energyLayer"
```

`energyLayer` is appended to `LIVE_LAYERS` inside `src/layers.ts` (a **type-only** import of `LiveLayer`/`LayerRenderCtx` into `energy-layer.ts` avoids any runtime import cycle; the registry file value-imports `energyLayer`).

## File Structure

- `src/types.ts` — add one field `powerEntity?: string` to `FloorItem` (near the other optional entity fields, ~line 183).
- `src/validate.ts` — add `powerEntity: str` to the item optional-shape map (~line 54).
- `src/energy-layer.ts` (new) — the ramp helpers (`parseWatts`, `powerColor`, `powerCueBump`), `DEFAULT_ENERGY_RAMP`, and the `energyLayer: LiveLayer` object (its `render` + `watched`).
- `src/energy-layer.test.ts` (new) — unit tests for the helpers and for `energyLayer.watched` / render gating.
- `src/layers.ts` — append `energyLayer` to the `LIVE_LAYERS` registry array.
- `src/editor.ts` — add a `powerEntity` entity-picker to the item editor form (authoring support; verified live, no unit test).
- `schema/floorplan-card.schema.json` — regenerated (additive) by `npm run schema`.

---

## Task 1: `powerEntity` field on `FloorItem` + validator + schema

**Files:**
- Modify: `src/types.ts` (`FloorItem`, ~line 183)
- Modify: `src/validate.ts` (item optional shape, ~line 54)
- Modify (generated): `schema/floorplan-card.schema.json`
- Test: `src/validate.test.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `FloorItem.powerEntity?: string`.

- [ ] **Step 1: Write the failing test** — append to `src/validate.test.ts`:

```ts
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
```

(If `validateConfig` is imported under a different local name in this test file, match the file's existing import — grep the top of `src/validate.test.ts`.)

- [ ] **Step 2: Run it, verify the reject case fails**

Run: `npx vitest run src/validate.test.ts`
Expected: the "rejects a non-string powerEntity" case FAILS (today the item shape does not check `powerEntity`, so `42` passes and `r.ok` is `true`). The "accepts" case already passes (unknown keys are allowed) — that is fine.

- [ ] **Step 3: Add the field to the type** — in `src/types.ts`, inside `interface FloorItem`, add `powerEntity` next to the other optional entity fields (right after `secondaryEntity?: string;`, ~line 183):

```ts
  /** A power/energy sensor (watts) whose live value colours this item in the energy layer. */
  powerEntity?: string;
```

- [ ] **Step 4: Add the validator check** — in `src/validate.ts`, add `powerEntity: str` to the item optional-field map (~line 54). The item `shape` call becomes:

```ts
const item = shape(
  { id: str, x: num, y: num, kind: oneOf(...ITEM_KINDS) },
  {
    entity: str, secondaryEntity: str, name: str, icon: str, size: num, angle: num,
    showState: bool, showIcon: bool, powerEntity: str,
  },
);
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/validate.test.ts`
Expected: PASS (the non-string case now fails validation → `r.ok === false`).

- [ ] **Step 6: Regenerate the schema**

Run: `npm run schema`
Expected: `schema/floorplan-card.schema.json` gains a `powerEntity` string property under the `FloorItem` definition (additive diff only).

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/types.ts src/validate.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Add FloorItem.powerEntity + validate it and regenerate schema"
```

## Task 2: The `powerColor` ramp + size-bump helpers

**Files:**
- Create: `src/energy-layer.ts`
- Test: `src/energy-layer.test.ts`

**Interfaces:**
- Consumes: nothing yet (helpers are self-contained; the `LiveLayer` export is added in Task 3, same file).
- Produces: `parseWatts`, `powerColor`, `powerCueBump`, `DEFAULT_ENERGY_RAMP`, `EnergyRampOpts` (from the "Produced interfaces" block).

- [ ] **Step 1: Write the failing test** — create `src/energy-layer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseWatts, powerColor, powerCueBump, DEFAULT_ENERGY_RAMP } from "./energy-layer";

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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/energy-layer.test.ts`
Expected: FAIL — "Cannot find module './energy-layer'".

- [ ] **Step 3: Implement the helpers** — create `src/energy-layer.ts` with the pure helpers (the `LiveLayer` object is added in Task 3):

```ts
export interface EnergyRampOpts {
  lowW: number;
  highW: number;
}

export const DEFAULT_ENERGY_RAMP: EnergyRampOpts = { lowW: 5, highW: 500 };

// Ramp endpoints. NEUTRAL = slate (idle); HOT = red (heavy draw).
const NEUTRAL: readonly [number, number, number] = [148, 163, 184];
const HOT: readonly [number, number, number] = [220, 38, 38];

const rgb = (c: readonly [number, number, number]): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// 0 at/below lowW, 1 at/above highW; NaN/Inf -> 0. Shared by colour + size ramps.
function rampT(watts: number, opts?: Partial<EnergyRampOpts>): number {
  if (!Number.isFinite(watts)) return 0;
  const lowW = opts?.lowW ?? DEFAULT_ENERGY_RAMP.lowW;
  const highW = opts?.highW ?? DEFAULT_ENERGY_RAMP.highW;
  if (watts <= lowW) return 0;
  if (highW <= lowW || watts >= highW) return watts >= highW ? 1 : 0;
  return (watts - lowW) / (highW - lowW);
}

export function parseWatts(state: string | undefined): number | undefined {
  if (state === undefined || state === "") return undefined;
  const n = Number(state);
  return Number.isFinite(n) ? n : undefined;
}

export function powerColor(watts: number, opts?: Partial<EnergyRampOpts>): string {
  const t = rampT(watts, opts);
  if (t <= 0) return rgb(NEUTRAL);
  if (t >= 1) return rgb(HOT);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return rgb([lerp(NEUTRAL[0], HOT[0]), lerp(NEUTRAL[1], HOT[1]), lerp(NEUTRAL[2], HOT[2])]);
}

export function powerCueBump(
  watts: number,
  maxBumpPx = 10,
  opts?: Partial<EnergyRampOpts>,
): number {
  return Math.round(rampT(watts, opts) * maxBumpPx);
}
```

Note on the `highW <= lowW` guard: a degenerate/inverted range never interpolates — it is neutral below `highW` and hot at/above it, so `rampT` stays total and never divides by zero.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/energy-layer.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/energy-layer.ts src/energy-layer.test.ts
git commit -m "Add powerColor ramp + power cue helpers with unit tests"
```

## Task 3: The `energyLayer` LiveLayer + register it

**Files:**
- Modify: `src/energy-layer.ts` (add the `LiveLayer` object + a small watched/render test seam)
- Modify: `src/layers.ts` (append `energyLayer` to `LIVE_LAYERS`)
- Test: `src/energy-layer.test.ts` (extend)

**Interfaces:**
- Consumes: `LiveLayer`, `LayerRenderCtx` (types) from `src/layers.ts`; `Floor`, `FloorplanCardConfig`, `RenderHass` from `src/types.ts`; `getFloors` from `src/render.ts` (the same helper `collectWatchedEntities` uses to iterate floors). Confirm the export name with `grep -n "export function getFloors" src/render.ts`.
- Produces: `energyLayer: LiveLayer` (id `"energyLayer"`), appended to `LIVE_LAYERS`.

- [ ] **Step 1: Write the failing test** — extend `src/energy-layer.test.ts` with the layer's `watched()` contract (a pure, unit-testable seam; the SVG render itself is verified live in Task 5):

```ts
import { energyLayer } from "./energy-layer";

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
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/energy-layer.test.ts`
Expected: FAIL — `energyLayer` is not exported yet.

- [ ] **Step 3: Implement the `LiveLayer`** — append to `src/energy-layer.ts`. Use `svg` from `lit` and iterate floors with `getFloors` (matching `collectWatchedEntities`'s traversal). The cue is a soft halo circle drawn under the item's badge; radius = a base plus the power bump; only items with a `powerEntity` that currently reads a finite wattage draw a colored cue (idle/unparseable → neutral, low-opacity, so the layer never lies about draw):

```ts
import { svg, type SVGTemplateResult } from "lit";
import type { LiveLayer, LayerRenderCtx } from "./layers";
import type { FloorplanCardConfig, Floor } from "./types";
import { getFloors } from "./render";

const CUE_BASE_R = 22; // SVG user units; roughly the badge footprint

function* powerItems(floor: Floor) {
  for (const it of floor.items) if (it.powerEntity) yield it;
}

function renderEnergy(ctx: LayerRenderCtx): SVGTemplateResult {
  const cues: SVGTemplateResult[] = [];
  for (const it of powerItems(ctx.floor)) {
    const state = ctx.hass?.states[it.powerEntity as string]?.state;
    const watts = parseWatts(state);
    const color = powerColor(watts ?? 0);
    const r = CUE_BASE_R + powerCueBump(watts ?? 0);
    const opacity = watts && watts > DEFAULT_ENERGY_RAMP.lowW ? 0.55 : 0.2;
    cues.push(svg`<circle cx=${it.x} cy=${it.y} r=${r} fill=${color} opacity=${opacity} />`);
  }
  return svg`<g class="fp-energy-layer">${cues}</g>`;
}

export const energyLayer: LiveLayer = {
  id: "energyLayer",
  label: "Energy",
  icon: "mdi:flash",
  render: renderEnergy,
  *watched(c: FloorplanCardConfig) {
    for (const f of getFloors(c)) for (const it of powerItems(f)) yield it.powerEntity as string;
  },
};
```

- [ ] **Step 4: Register it** — in `src/layers.ts`, value-import and append to `LIVE_LAYERS`:

```ts
import { energyLayer } from "./energy-layer";
// ...
export const LIVE_LAYERS: LiveLayer[] = [energyLayer];
```

(If `LIVE_LAYERS` was declared `= []` by the layer-framework plan, change it to `= [energyLayer]`. The import of `LiveLayer`/`LayerRenderCtx` types back into `energy-layer.ts` is `import type`, so there is no runtime cycle.)

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/energy-layer.test.ts src/layers.test.ts`
Expected: PASS. The layer-framework's own tests (`enabledLayers` filters by flag; `layerWatchedEntities` unions only enabled layers) now exercise a real registered layer — confirm they still pass, proving the energy layer is gated off by default and contributes zero watched entities when off.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/energy-layer.ts src/energy-layer.test.ts src/layers.ts
git commit -m "Register the energy LiveLayer (power-coloured item cues), gated on energyLayer"
```

## Task 4: Editor field for `powerEntity` (authoring)

**Files:**
- Modify: `src/editor.ts` (item editor form — add a `powerEntity` entity picker)

No new unit test (DOM/editor UI is verified live per the existing convention); tsc + full suite + build stay green.

- [ ] **Step 1: Find the item editor form** — grep for where the item's existing entity fields are edited so the new picker sits beside them:

```bash
grep -n "secondaryEntity\|\"entity\"\|entityPicker\|ha-entity-picker" src/editor.ts | head
```

Locate the block that renders the item's `entity` / `secondaryEntity` inputs (the item-detail editor panel).

- [ ] **Step 2: Add the `powerEntity` picker** — mirror the existing `secondaryEntity` field exactly (same picker component, same config-patch write-back path), bound to `item.powerEntity`, labelled "Power sensor (energy layer)". Writing an empty selection must clear the key (delete `powerEntity`) so an item without a power sensor stays minimal — match whatever clear-on-empty pattern the sibling `secondaryEntity` field already uses. Do not invent a new write path; reuse the item editor's existing patch helper.

- [ ] **Step 3: Typecheck + full suite + build**

Run:
```bash
npx tsc --noEmit && npx vitest run --reporter=dot && npm run build
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor.ts
git commit -m "Add a power-sensor picker to the item editor"
```

## Task 5 (controller): Verify + gate

- [ ] Full suite + tsc + build green: `npx vitest run --reporter=dot && npx tsc --noEmit && npm run build`.
- [ ] **Byte-identical off:** with a config that has no `features` block (or `features.energyLayer: false`), confirm the card render is unchanged — no `fp-energy-layer` group in the SVG, no energy toggle chip — and that `powerEntity` values do **not** appear in the card's watched set (grep the layer-framework's watched-union and confirm `layerWatchedEntities` returns empty for a config with `energyLayer` off). This falls out of `enabledLayers` filtering by `featureEnabled`, but verify it live.
- [ ] **On path:** set `features: { energyLayer: true }`, give an item a `powerEntity` pointing at a power sensor in the dev harness. Confirm: a colored halo appears under that item; raising the sensor's watts warms the color toward red and slightly enlarges the halo; the energy toggle chip appears and hides/shows the cue; setting the flag back to false removes both the cue and the watched entity.
- [ ] Schema is committed and the drift/schema test passes (`npx vitest run` picks up the schema test).
- [ ] This plan produces working, testable software on its own: the ramp helpers and the layer's `watched` contract are unit-tested, and the layer renders live once its two prerequisite plans are in place.

## Self-Review

- **Spec coverage (1e):** `powerEntity` on `FloorItem` + validator + schema (T1); value to color ramp `powerColor` with the required 0 to neutral / high to hot / clamp tests plus a size bump (T2); one `LiveLayer` (`id: "energyLayer"`) that overlays a power-colored cue, gated on `featureEnabled(config, "energyLayer")` and contributing watched entities only when enabled (T3); authoring via the editor (T4); verify + gate (T5). Per-item first version, per-room sum explicitly deferred — matches the spec's "keep the first version to per-item." ✓
- **Default-off / byte-identical guarantee:** enforced by the framework's `enabledLayers`/`layerWatchedEntities` filtering on `featureEnabled` (defaults `energyLayer` to false), re-exercised by the layer-framework tests against the now-registered real layer, and checked live in T5. ✓
- **Ramp shared idea, self-contained plan:** `powerColor`/`rampT` live in `src/energy-layer.ts` and could later be hoisted for the thermal layer (1c) if desired, but this plan defines them wholly on its own — no dependency on 1c. ✓
- **Placeholder scan:** every code step shows real code with exact paths; the two "grep to locate" steps (editor form, `getFloors`) are lookups of existing code, not deferred implementation. ✓
- **Type consistency:** `EnergyRampOpts`, `DEFAULT_ENERGY_RAMP`, `powerColor`, `powerCueBump`, `parseWatts`, `energyLayer` are named identically in the interfaces block, the tasks, and the tests; `energyLayer.id` is the exact `FeatureName` literal `"energyLayer"`; `watched` returns `Iterable<string>` (a generator) matching the `LiveLayer.watched` signature. ✓
- **No backticks in css comments; additive schema; no AI-authorship footers; nothing pushed outside `origin`.** ✓
