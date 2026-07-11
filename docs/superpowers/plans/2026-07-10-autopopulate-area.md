# Auto-Populate Room from HA Area (3a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In the room editor, a room with an `areaId` gets a "populate from
area" action — gated behind `featureEnabled(config, "autoPopulateArea")`,
default off — that reads every entity in the room's HA area, infers a
placeable `kind` per domain, scatters unplaced ones inside the room polygon,
and skips anything already on the plan.

**Architecture:** Most of this already exists on `main`, ungated:
`src/areas.ts` (`haAreasOf`, `entitiesInArea`, `devicesToAdd`, `gridLayout`)
and `src/editor.ts` (`_renderAddDevicesRow` / `_addDevicesFromArea`, wired
into the room branch at `src/editor.ts:3067`) implement area lookup, domain
filtering, kind inference, placement, and idempotency end-to-end. This plan
does **not** rebuild that pipeline. It does two things: (1) generalizes the
placement helper from a bbox-shaped internal (`gridLayout(count, bbox)`) to
the spec's polygon-based pure-function contract, `scatterInPolygon(points, n)
-> {x,y}[]`, with its own unit tests; (2) gates the whole action — button and
handler — behind `featureEnabled(this._config, "autoPopulateArea")`, so an
existing plan with no `features` block (or the flag off) shows nothing,
matching the roadmap's "default off, zero cost when off" rule.

**Tech Stack:** Lit + TypeScript, Vitest.

## Prerequisite (hard dependency — check before starting)

This plan consumes `featureEnabled` from `src/features.ts`, produced by
`docs/superpowers/plans/2026-07-10-feature-toggles.md` Task 1. That file does
**not exist yet** on `main` (checked at plan-writing time). Before Task 2:

```bash
grep -n "export function featureEnabled" src/features.ts
```

If this fails (file missing or symbol absent), stop and execute Task 1 of
`2026-07-10-feature-toggles.md` first (it produces `src/features.ts` with
`featureEnabled`, `FeatureName`, `FEATURE_DEFAULTS`, `FEATURE_META`, and adds
`features?: FeaturesConfig` to `FloorplanCardConfig` in `src/types.ts`,
already including the `autoPopulateArea` key). Do not reimplement any of that
here — Task 2 below only imports and calls it.

## Global Constraints

- Nothing outward; local commits only; **no AI-authorship footers**; never push.
- Branch `feat/autopopulate-area` off `main`.
- This plan touches only `src/areas.ts`, `src/areas.test.ts`, and
  `src/editor.ts` — never `src/render.ts`. The rendered floorplan SVG a
  viewer sees is unaffected by this plan whether the flag is on or off (it
  only changes what the *editor* lets an author add to the config).
- Default-off regression: after this plan, a config with no `features` block,
  or `features.autoPopulateArea` unset/false, must show **no** "populate from
  area" row for any room — even one with an `areaId`. (This supersedes
  today's `main` behavior, where the row always shows; the roadmap's
  conservative-default rule wins.)
- A room editor is DOM/Lit-rendered; there is no `editor.test.ts` that drives
  its shadow DOM (see `src/editor-forms.test.ts` / `editor-geometry.test.ts` /
  `editor-keys.test.ts` for the project's actual pattern: pure logic gets
  extracted and unit-tested, the Lit rendering itself is verified live via
  `npm run serve`). Follow that split: `scatterInPolygon` is pure and
  unit-tested (Task 1); the button gating in `editor.ts` is verified live
  (Task 2).
- Landmine: no backticks inside `css` tagged-template comments anywhere in
  this codebase.
- Run: `npx vitest run src/areas.test.ts`; full `npx vitest run --reporter=dot`;
  `npx tsc --noEmit`; `npm run build`; live check via `npm run serve`.

---

## Produced interfaces (both tasks, for reference)

```ts
// src/areas.ts — placement helper, renamed/refactored from gridLayout
export interface Point { x: number; y: number }

/**
 * `n` points scattered inside a polygon's bounding box, on a near-square
 * grid, inset by `gap` of each side. Pure and deterministic (same inputs,
 * same output; no Math.random), so it's safe to unit-test and to call on
 * every render.
 */
export function scatterInPolygon(
  points: Array<[number, number]>,
  n: number,
  gap?: number, // default 0.15
): Point[];

// devicesToAdd — signature and return shape UNCHANGED, now backed by scatterInPolygon
export function devicesToAdd(
  hass: unknown,
  areaId: string,
  room: Room,
  placed: Set<string>,
): Array<{ entity: string; x: number; y: number; kind: ItemKind }>;

// src/editor.ts — gating (Task 2 consumes featureEnabled from src/features.ts,
// produced by the feature-toggles plan)
import { featureEnabled } from "./features";
// _renderAddDevicesRow(r) and _addDevicesFromArea(r) both no-op unless
// featureEnabled(this._config, "autoPopulateArea") is true AND r.areaId is set.
```

---

## Task 1: `scatterInPolygon` — polygon-based pure placement helper

**Files:**
- Modify: `src/areas.ts` (replace `Bbox`/`gridLayout` with `Point`/`scatterInPolygon`; update `devicesToAdd`)
- Modify: `src/areas.test.ts` (replace the `gridLayout` describe block with `scatterInPolygon`)

**Interfaces:**
- Consumes: nothing new — pure geometry over `Room.points: Array<[number, number]>` (`src/types.ts:143`).
- Produces: `scatterInPolygon(points, n, gap?) -> Point[]` (see above). `devicesToAdd`'s public signature and return shape are unchanged; only its internal placement call changes.

`gridLayout` and its `Bbox` interface are used nowhere outside `src/areas.ts`
and `src/areas.test.ts` (verified: `grep -rn "gridLayout\|Bbox\b" src/*.ts`
returns only those two files), so this is a safe rename, not a compatibility
shim.

- [ ] **Step 1: Write the failing test** — replace the `describe("gridLayout", ...)` block (currently `src/areas.test.ts:51-78`) and its import with:

```ts
// src/areas.test.ts — replace the existing import line 2 with:
import { haAreasOf, entitiesInArea, scatterInPolygon, devicesToAdd } from "./areas";

// ...and replace the whole `describe("gridLayout", ...)` block with:
describe("scatterInPolygon", () => {
  const square: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
  it("returns the requested count", () => {
    expect(scatterInPolygon(square, 5)).toHaveLength(5);
    expect(scatterInPolygon(square, 0)).toEqual([]);
  });
  it("keeps every point inside the polygon's bbox", () => {
    for (const { x, y } of scatterInPolygon(square, 7)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
  it("does not stack every point on one spot", () => {
    const pts = scatterInPolygon(square, 4).map((p) => `${p.x},${p.y}`);
    expect(new Set(pts).size).toBe(4);
  });
  it("handles a single item (1x1) and a single row (2 items)", () => {
    expect(scatterInPolygon(square, 1)).toHaveLength(1);
    const two = scatterInPolygon(square, 2);
    expect(two).toHaveLength(2);
    for (const { x, y } of [...scatterInPolygon(square, 1), ...two]) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
    }
  });
  it("is deterministic given the same inputs (no Math.random)", () => {
    expect(scatterInPolygon(square, 6)).toEqual(scatterInPolygon(square, 6));
  });
  it("handles a non-rectangular (L-shaped) polygon via its bbox", () => {
    const lshape: Array<[number, number]> = [
      [0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100],
    ];
    for (const { x, y } of scatterInPolygon(lshape, 5)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/areas.test.ts`
Expected: FAIL — `scatterInPolygon` is not exported from `./areas` (the file still exports `gridLayout`).

- [ ] **Step 3: Implement `scatterInPolygon` in `src/areas.ts`**

Replace the existing `Bbox` interface and `gridLayout` function
(`src/areas.ts:51-73`) with:

```ts
export interface Point { x: number; y: number }

/**
 * `n` points scattered inside a polygon's bounding box, on a near-square
 * grid, inset by `gap` of each side. Pure and deterministic — same inputs,
 * same output, no Math.random — so it's safe to unit-test and to call on
 * every render. Uses the bbox rather than true point-in-polygon containment:
 * good enough for "stays within bounds" (an L-shaped room's scatter can sit
 * in its bbox's empty notch) and keeps this O(n) instead of rejection-
 * sampling against polygon edges.
 */
export function scatterInPolygon(
  points: Array<[number, number]>,
  n: number,
  gap = 0.15,
): Point[] {
  if (n <= 0 || !points.length) return [];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const w = maxX - minX;
  const h = maxY - minY;
  const mx = w * gap;
  const my = h * gap;
  const innerW = w - 2 * mx;
  const innerH = h - 2 * my;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = minX + mx + (cols === 1 ? innerW / 2 : (innerW * c) / (cols - 1));
    const y = minY + my + (rows === 1 ? innerH / 2 : (innerH * r) / (rows - 1));
    out.push({ x: Math.round(x), y: Math.round(y) });
  }
  return out;
}
```

Then update `devicesToAdd` (`src/areas.ts:82-102`) to call it:

```ts
export function devicesToAdd(
  hass: unknown,
  areaId: string,
  room: Room,
  placed: Set<string>,
): Array<{ entity: string; x: number; y: number; kind: ItemKind }> {
  const { entities } = registries(hass);
  const ids = entitiesInArea(hass, areaId).filter((id) => {
    if (placed.has(id)) return false;
    if (kindFromEntity(id) === "generic") return false;
    const e = entities[id];
    if (e?.entity_category && SKIP_CATEGORY.has(e.entity_category)) return false;
    if (e?.hidden_by || e?.disabled_by) return false;
    return true;
  });
  const pts = scatterInPolygon(room.points, ids.length);
  return ids.map((entity, i) => ({ entity, x: pts[i].x, y: pts[i].y, kind: kindFromEntity(entity) }));
}
```

(`SKIP_CATEGORY`, `registries`, and the rest of `src/areas.ts` are unchanged.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/areas.test.ts`
Expected: PASS — all `scatterInPolygon` and `devicesToAdd` tests (the
`devicesToAdd` describe block at `src/areas.test.ts:95-122` needs no source
changes; it exercises the same public shape).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/areas.ts src/areas.test.ts
git commit -m "Generalize area placement to a polygon-based scatterInPolygon helper"
```

---

## Task 2: Gate "populate from area" behind `autoPopulateArea`

**Files:**
- Modify: `src/editor.ts`

**Interfaces:**
- Consumes: `featureEnabled(c, name)` from `src/features.ts` (see Prerequisite above); `Point`/`scatterInPolygon`/`devicesToAdd` from Task 1 (already imported at `src/editor.ts:1`, unchanged).
- Produces: nothing new for later tasks — this is the end of the 3a chain.

No new unit test file: `_renderAddDevicesRow` and `_addDevicesFromArea` are
private Lit-rendering / DOM-event methods on `FloorplanCardEditor`, verified
live per this codebase's established split (see Global Constraints). tsc +
full suite + build gate this task instead.

- [ ] **Step 1: Confirm the prerequisite is met**

```bash
grep -n "export function featureEnabled" src/features.ts
```

Expected: one match. If it fails, stop — go run
`docs/superpowers/plans/2026-07-10-feature-toggles.md` Task 1 first, then
resume here.

- [ ] **Step 2: Import `featureEnabled`**

In `src/editor.ts`, next to the existing `./areas` import (`src/editor.ts:1`):

```ts
import { haAreasOf, entitiesInArea, devicesToAdd } from "./areas";
import { featureEnabled } from "./features";
```

- [ ] **Step 3: Gate the render method**

Change `_renderAddDevicesRow` (`src/editor.ts:1339-1341`) from:

```ts
  private _renderAddDevicesRow(r: Room): TemplateResult {
    const areas = haAreasOf(this.hass);
    if (!areas.length || !r.areaId) return html`${nothing}`;
```

to:

```ts
  private _renderAddDevicesRow(r: Room): TemplateResult {
    if (!featureEnabled(this._config, "autoPopulateArea")) return html`${nothing}`;
    const areas = haAreasOf(this.hass);
    if (!areas.length || !r.areaId) return html`${nothing}`;
```

The rest of the method (`src/editor.ts:1342-1352`) is unchanged.

- [ ] **Step 4: Gate the handler (defense in depth)**

Change `_addDevicesFromArea` (`src/editor.ts:1354-1355`) from:

```ts
  private _addDevicesFromArea(r: Room): void {
    if (!r.areaId) return;
```

to:

```ts
  private _addDevicesFromArea(r: Room): void {
    if (!r.areaId || !featureEnabled(this._config, "autoPopulateArea")) return;
```

The rest of the method (`src/editor.ts:1356-1372`) is unchanged. (The button
that calls this handler only renders when Step 3's gate already passed, so
this can't be reached through the UI while off — this guard just means the
handler is safe to call directly too, e.g. from a future keyboard shortcut.)

- [ ] **Step 5: Typecheck, full suite, build**

```bash
npx tsc --noEmit && npx vitest run --reporter=dot && npm run build
```

Expected: all green. No test in the suite currently asserts on
`_renderAddDevicesRow`'s output (it's DOM-bound, per Global Constraints), so
this step is the only automated signal for Task 2 — Step 6 below is where the
actual behavior gets checked.

- [ ] **Step 6: Live verification** (`npm run serve`, opens `/dev/`)

Using the dev harness:
1. Load a fixture floor with a room that has `areaId` set, and a card config
   with **no** `features` block. Select that room in the editor. Confirm:
   **no** "Add devices…" row appears under the room's form (this is the
   regression check — on `main` today it always appears).
2. Edit the config (via the editor's import/export textarea, or the fixture)
   to add `features: { autoPopulateArea: true }`. Re-select the room.
   Confirm: the row reappears, its count matches the number of the area's
   entities not yet on the plan, and clicking it adds one item per entity,
   each with `kind` matching its domain (e.g. a `light.*` entity becomes a
   `light` item), positioned inside the room's bounds (not stacked on one
   point).
3. Click the button again with everything now placed. Confirm: it reads "No
   new devices in `<area>`", is disabled, and clicking does nothing — no
   duplicate items are added (idempotency).
4. Select a room with **no** `areaId` (with the flag on). Confirm: the row
   never appears, regardless of the flag.
5. Turn the flag back off (`features: { autoPopulateArea: false }` or delete
   the key). Confirm the row disappears again.

- [ ] **Step 7: Commit**

```bash
git add src/editor.ts
git commit -m "Gate 'populate from area' behind the autoPopulateArea feature flag"
```

---

## Task 3 (controller): Verify + gate

- [ ] Build + full suite + tsc green, run fresh from a clean tree:
  ```bash
  npx tsc --noEmit && npx vitest run --reporter=dot && npm run build
  ```
- [ ] `git diff main --stat` touches only `src/areas.ts`, `src/areas.test.ts`,
  `src/editor.ts` (plus whatever `2026-07-10-feature-toggles.md` Task 1
  already landed as its own commits, if run in the same branch). No changes
  to `src/render.ts` or `schema/floorplan-card.schema.json` — this plan adds
  no new config fields; `features.autoPopulateArea` was already covered by
  the feature-toggles plan's own validator/schema task.
- [ ] Task 2 Step 6's live walkthrough passes end to end.
- [ ] Confirm the default-off regression once more directly: a config with
  no `features` block, loaded fresh, shows no "populate from area" row for
  any room, including one with an `areaId` — this is the one behavior change
  from today's `main` (which shows the row unconditionally) and it's the
  entire point of the flag.

## Self-Review

- **Spec coverage:**
  - Editor button shown only when `featureEnabled(config, "autoPopulateArea")` AND `r.areaId` — Task 2, Steps 3–4. ✓
  - Entities resolved from `hass` area/entity registry — already built and reused via `haAreasOf`/`entitiesInArea` (`src/areas.ts:12-49`); Task 1 doesn't touch this, Task 2 doesn't duplicate it. ✓
  - Filtered to placeable domains, `kind` via `kindFromEntity` — already in `devicesToAdd`'s filter (drops `kindFromEntity(id) === "generic"`, diagnostic/config categories, hidden/disabled) — unchanged by Task 1's refactor. ✓
  - Scatter placement as a pure, unit-tested helper, no `Math.random`, deterministic — `scatterInPolygon(points, n) -> Point[]`, Task 1, with an explicit "is deterministic" test and bbox-containment tests including a non-rectangular polygon. ✓
  - Skip already-placed entities / idempotent — already in `devicesToAdd`'s `placed` set (`src/areas.ts:89-90`, covered by the existing "skips already-placed entities" test); Task 2 Step 6.3 verifies live idempotency (clicking twice adds nothing new). ✓
  - Feature-flag gate, default off — Task 2, consuming the exact `featureEnabled(config, "autoPopulateArea")` signature from the feature-toggles plan; Prerequisite section makes the dependency explicit and checkable. ✓
- **Placeholder scan:** none — every step shows the real diff (before/after code blocks) or an exact command with expected output.
- **Type consistency:** `Point { x, y }` is the return type of `scatterInPolygon` in both the Produced Interfaces block and Task 1's implementation; `devicesToAdd`'s consuming code uses `.x`/`.y` (object access) consistently, not the old tuple indexing. `featureEnabled(this._config, "autoPopulateArea")` matches the feature-toggles plan's produced signature (`c?: { features?: FeaturesConfig } | undefined`) verbatim — `this._config: FloorplanCardConfig` is structurally compatible once that plan's Task 1 adds `features?: FeaturesConfig` to it.
- **Scope note:** this plan deliberately does not touch `src/render.ts`, add new config fields, or rename the button's copy (the existing "Add N devices from `<area>`" / "No new devices in `<area>`" text already communicates a "populate from area" action; renaming it was judged unnecessary UI churn for this plan).
