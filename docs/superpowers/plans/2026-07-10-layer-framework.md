# Live Layer Framework (1a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A small framework that lets the Track-1 overlays (lights, thermal, awareness, energy, media) register as named **live layers**, render into the card, contribute watched entities, and be shown/hidden by an on-plan toggle — each gated by its feature flag.

**Architecture:** A `LiveLayer` descriptor (id tied to a `FeatureName`, label, icon, a `render` hook, a `watched` hook), a registry array the card iterates, a toggle-chip row in the card, and runtime `_hiddenLayers` view state. The card renders a layer only when `featureEnabled(config, id)` **and** the layer is not runtime-hidden; `collectWatchedEntities` folds in each **enabled** layer's `watched()`.

**Tech Stack:** Lit + TypeScript, Vitest.

## Depends on
`docs/superpowers/plans/2026-07-10-feature-toggles.md` — consumes `FeaturesConfig`, `FeatureName`, `featureEnabled`, `FEATURE_META`. That plan must land first.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`.
- Branch `feat/layer-framework` off `main` (after feature-toggles merges).
- With no layers registered (this plan registers none — later plans do), the card renders **byte-identically** to today and the toggle row does not appear.
- Animate only inner sub-elements; no backticks in `css` comments.
- `npx vitest run src/<f>.test.ts`; full suite; `npx tsc --noEmit`; `npm run build`.

## Produced interfaces (Track-1 feature plans consume these — exact names/types)
```ts
// src/layers.ts (new)
import type { SVGTemplateResult } from "lit";
import type { FloorplanCardConfig, Floor, RenderHass } from "./types";
import type { FeatureName } from "./features";

export interface LayerRenderCtx {
  floor: Floor;                 // the active floor (resolved via getFloors + defaultFloor)
  hass: RenderHass | undefined;
  config: FloorplanCardConfig;
}
export interface LiveLayer {
  id: FeatureName;              // must be a feature key; gate uses featureEnabled(config, id)
  label: string;               // toggle chip text (falls back to FEATURE_META label)
  icon: string;                // mdi icon for the chip
  render(ctx: LayerRenderCtx): SVGTemplateResult;      // "" when nothing to draw
  watched(c: FloorplanCardConfig): Iterable<string>;   // entities this layer needs live
}

export const LIVE_LAYERS: LiveLayer[];   // registry; empty in this plan, appended by feature plans
export function enabledLayers(c: FloorplanCardConfig): LiveLayer[]; // filters LIVE_LAYERS by featureEnabled
export function layerWatchedEntities(c: FloorplanCardConfig): Set<string>; // union of enabled layers' watched()
```
A Track-1 feature plan (e.g. thermal) adds ONE `LiveLayer` object to `LIVE_LAYERS` and nothing else in the card — the framework renders it and wires its toggle + watched entities automatically.

## File Structure
- `src/layers.ts` — the `LiveLayer` type, `LIVE_LAYERS` registry, `enabledLayers`, `layerWatchedEntities`.
- `src/floorplan-card.ts` — render the enabled+visible layers in the SVG (a `<g class="fp-layers">` above rooms, below walls, order TBD per layer); render the toggle chip row (HTML overlay); `_hiddenLayers: Set<FeatureName>` state + a toggle handler; fold `layerWatchedEntities` into the card's watched set.
- `src/render.ts` — `collectWatchedEntities` gains the enabled layers' entities (import from layers.ts, guarded so no circular-import surprise — if layers.ts imports render helpers, keep `collectWatchedEntities` unaware of concrete layers and instead have the card union the two sets; DECIDE in Task 2 and document).

---

## Task 1: The layer registry module

**Files:** Create `src/layers.ts`; Test `src/layers.test.ts`.

**Interfaces:** Produces the "Produced interfaces" block.

- [ ] **Step 1: Failing test**
```ts
// src/layers.test.ts
import { describe, it, expect } from "vitest";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";

const base = { type:"x", width:10, height:10 } as any;

describe("layer registry", () => {
  it("starts empty (feature plans append)", () => {
    expect(Array.isArray(LIVE_LAYERS)).toBe(true);
  });
  it("enabledLayers filters by feature flag", () => {
    const fake = { id:"thermalLayer", label:"T", icon:"mdi:thermometer",
      render:()=>("" as any), watched:()=>[] } as any;
    LIVE_LAYERS.push(fake);
    try {
      expect(enabledLayers(base).length).toBe(0);                       // flag off by default
      expect(enabledLayers({ ...base, features:{ thermalLayer:true } }).some(l=>l.id==="thermalLayer")).toBe(true);
    } finally { LIVE_LAYERS.pop(); }
  });
  it("layerWatchedEntities unions only enabled layers", () => {
    const fake = { id:"energyLayer", label:"E", icon:"mdi:flash",
      render:()=>("" as any), watched:()=>["sensor.pwr"] } as any;
    LIVE_LAYERS.push(fake);
    try {
      expect(layerWatchedEntities(base).has("sensor.pwr")).toBe(false);  // off
      expect(layerWatchedEntities({ ...base, features:{ energyLayer:true } }).has("sensor.pwr")).toBe(true);
    } finally { LIVE_LAYERS.pop(); }
  });
});
```
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement `src/layers.ts`** — the types, `export const LIVE_LAYERS: LiveLayer[] = [];`, `enabledLayers(c)` = `LIVE_LAYERS.filter((l) => featureEnabled(c, l.id))`, `layerWatchedEntities(c)` = union of `enabledLayers(c).flatMap((l) => [...l.watched(c)])`.
- [ ] **Step 4: Pass + typecheck.**
- [ ] **Step 5: Commit** `git add src/layers.ts src/layers.test.ts && git commit -m "Add the live-layer registry"`.

## Task 2: Watched-entity integration

**Files:** Modify `src/floorplan-card.ts` (union the card's watched set with `layerWatchedEntities(config)`), or `src/render.ts` `collectWatchedEntities` — decide to avoid a circular import (layers.ts → render.ts). Recommended: the **card** unions the two, keeping `collectWatchedEntities` layer-agnostic. Test `src/render.test.ts` or `src/floorplan-card` behaviour.

- [ ] **Step 1: Failing test** — a config with `energyLayer:true` and a registered energy layer surfaces the layer's watched entity in whatever the card uses for `shouldUpdate`. (If the card computes `collectWatchedEntities(config) ∪ layerWatchedEntities(config)`, unit-test that union at the card's watched-set accessor.)
- [ ] **Step 2-4:** Implement the union at the single place the card builds its watched set (grep `collectWatchedEntities(` in `floorplan-card.ts`); a disabled layer contributes nothing. Pass, typecheck.
- [ ] **Step 5: Commit** by explicit path.

## Task 3: Render enabled layers + toggle chips

**Files:** Modify `src/floorplan-card.ts` (`render()` ~line 327), plus its style block for the chip row CSS.

- [ ] **Step 1:** In `render()`, after resolving the active floor `c`/`active`, insert `${enabledLayers(this._config).filter((l) => !this._hiddenLayers.has(l.id)).map((l) => l.render({ floor: activeFloor, hass: this.hass, config: this._config }))}` at the chosen z-position (a `<g class="fp-layers">`; layer order = registry order). With no registered layers this renders nothing → byte-identical.
- [ ] **Step 2:** Add `@state() private _hiddenLayers = new Set<FeatureName>();` and a `_toggleLayer(id)` handler that adds/removes from the set and requests an update.
- [ ] **Step 3:** Render an HTML toggle-chip row (only when `enabledLayers(this._config).length > 0`): one chip per enabled layer (icon + label), pressed/greyed by `_hiddenLayers`. Reuse the editor/card token styles; position it as a small overlay (corner). CSS in the card style block (no backticks in comments).
- [ ] **Step 4:** Typecheck + full suite + build. No new unit tests for the DOM chips (verified live); the registry/union logic is unit-tested in T1/T2.
- [ ] **Step 5: Commit** by explicit path.

## Task 4 (controller): Verify + gate
- [ ] Build + full suite + tsc green; byte-identical with no layers registered.
- [ ] Dev harness: temporarily register a trivial layer that draws a marker rect gated on `thermalLayer`; enable the flag → the marker + a toggle chip appear; toggle hides/shows it; disable the flag → both gone and the entity unwatched. Remove the temp layer before committing.
- [ ] This plan stands alone: the framework is testable even though the first real layer arrives in plan 1b/1c.

## Self-Review
- Spec coverage: registry+filters (T1), watched union (T2), render+toggle (T3), verify (T4). ✓
- Byte-identity with empty registry guarded (T1 empty registry + T4 live). ✓
- Circular-import risk called out and resolved (card unions the sets). ✓
- Consumes the feature-toggles contract precisely (`featureEnabled`, `FeatureName`). ✓
