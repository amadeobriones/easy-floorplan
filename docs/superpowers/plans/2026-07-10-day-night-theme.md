# Day/Night Theme (roadmap 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The floorplan dims to a night wash when `sun.sun` (or a configured stand-in) is below the horizon, gated entirely behind `featureEnabled(config, "dayNightTheme")` and off (zero DOM, zero watched entities) by default.

**Architecture:** A new pure module `src/theme.ts` turns a sun-like entity's state/`elevation` into a boolean (`isNight`) and a continuous 0..1 darkness (`nightFactor`), unit-tested with no DOM involved. `render.ts`'s `collectWatchedEntities` adds the sun entity to the watched set only when the feature is on, so the card re-renders as the sun crosses the horizon and otherwise never wakes for it. `floorplan-card.ts` reads the entity, computes darkness, and paints one absolutely-positioned overlay `div` (`pointer-events: none`) over the `.plate`, opacity driven by `nightFactor`. An optional `dayNightEntity` config string lets a user point at a different sensor; it defaults to `sun.sun`.

**Tech Stack:** Lit + TypeScript, Vitest, `typescript-json-schema` for schema.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push anywhere but stay local (do not push to `origin`).
- Branch `feat/day-night-theme` off `main` — but only after the **Prerequisite** below is satisfied.
- Feature is gated by `featureEnabled(config, "dayNightTheme")`, which defaults **off**. A config with no `features` block (or `features.dayNightTheme` unset/false) renders **byte-identical** to today: no overlay `div`, no `sun.sun` (or configured entity) in `collectWatchedEntities`.
- Adding `dayNightEntity` to `FloorplanCardConfig` changes the generated schema → run `npm run schema` and commit the additive diff (`src/schema.test.ts` enforces no drift).
- Landmine: no backticks inside `css` tagged-template comments.
- Run: `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.
- Reduced motion is irrelevant here: the wash is a state change (its opacity moves via a CSS `transition`, not a looping `@keyframes` animation), so it does not need a `prefers-reduced-motion` guard — consistent with the codebase's own convention (compare `.fp-door-leaf { transition: transform 0.5s ease; }` in `src/floorplan-card.ts`, which is likewise unguarded, versus the guarded `@keyframes` animations further down the same style block).

## Prerequisite (check before branching)
This plan **consumes** `featureEnabled` from `src/features.ts`, produced by `docs/superpowers/plans/2026-07-10-feature-toggles.md`. That plan has not landed in this checkout as of this writing (`src/features.ts` does not exist yet).

- [ ] **Step 1: Confirm the prerequisite is present**
```bash
test -f src/features.ts && grep -n "export function featureEnabled" src/features.ts
```
Expected: prints the `featureEnabled` export line. If the file is missing, **stop** — execute `docs/superpowers/plans/2026-07-10-feature-toggles.md` first (it produces `src/features.ts`, `FeaturesConfig` on `FloorplanCardConfig`, and the `dayNightTheme` key in `FEATURE_DEFAULTS`/`FEATURE_META`), merge it to `main`, then start this plan from `main`.

---

## Produced interfaces (used across this plan's own tasks)
```ts
// src/theme.ts (new)
export const DEFAULT_SUN_ENTITY: string; // "sun.sun"
export const NIGHT_MAX_OPACITY: number;  // peak overlay opacity at full darkness, 0 < n < 1

export function elevationOf(
  st: { attributes?: Record<string, unknown> } | undefined,
): number | undefined; // numeric `elevation` attribute, or undefined if absent/non-numeric

export function isNight(sunState: string | undefined, elevation?: number): boolean;
// elevation, when given, wins (below horizon = elevation < 0); otherwise falls back to
// sunState === "below_horizon". Missing state AND missing elevation => false (day).

export function nightFactor(sunState: string | undefined, elevation?: number): number;
// 0 (day) .. 1 (night). With elevation known, eases linearly from 0 at 0deg to 1 at
// -6deg (civil twilight) instead of snapping. Without elevation, hard 0/1 on sunState.
```
Consumers: `src/render.ts`'s `collectWatchedEntities` (Task 3) and `src/floorplan-card.ts`'s render path (Task 4) both import from `./theme` and `./features`.

---

## Task 1: `src/theme.ts` — pure day/night helpers

**Files:**
- Create: `src/theme.ts`
- Test: `src/theme.test.ts`

**Interfaces:**
- Produces: everything in the "Produced interfaces" block above.

- [ ] **Step 1: Write the failing test**
```ts
// src/theme.test.ts
import { describe, it, expect } from "vitest";
import { isNight, nightFactor, elevationOf, DEFAULT_SUN_ENTITY, NIGHT_MAX_OPACITY } from "./theme";

describe("elevationOf", () => {
  it("reads a numeric elevation attribute", () => {
    expect(elevationOf({ attributes: { elevation: -12.5 } })).toBe(-12.5);
  });
  it("is undefined when absent, non-numeric, or the state itself is missing", () => {
    expect(elevationOf(undefined)).toBeUndefined();
    expect(elevationOf({ attributes: {} })).toBeUndefined();
    expect(elevationOf({ attributes: { elevation: "low" } })).toBeUndefined();
  });
});

describe("isNight", () => {
  it("reads a plain above_horizon state as day", () => {
    expect(isNight("above_horizon")).toBe(false);
  });
  it("reads a plain below_horizon state as night", () => {
    expect(isNight("below_horizon")).toBe(true);
  });
  it("prefers elevation over state when both are given", () => {
    expect(isNight("above_horizon", -2)).toBe(true);
    expect(isNight("below_horizon", 5)).toBe(false);
  });
  it("treats elevation exactly at the horizon as day", () => {
    expect(isNight(undefined, 0)).toBe(false);
  });
  it("treats a missing entity (no state, no elevation) as day", () => {
    expect(isNight(undefined, undefined)).toBe(false);
    expect(isNight(undefined)).toBe(false);
  });
  it("treats an unrecognised state string as day, not night", () => {
    expect(isNight("unavailable")).toBe(false);
    expect(isNight("unknown")).toBe(false);
  });
});

describe("nightFactor", () => {
  it("is 0 at or above the horizon", () => {
    expect(nightFactor(undefined, 10)).toBe(0);
    expect(nightFactor(undefined, 0)).toBe(0);
  });
  it("is 1 at or past civil twilight's end (-6deg)", () => {
    expect(nightFactor(undefined, -6)).toBe(1);
    expect(nightFactor(undefined, -20)).toBe(1);
  });
  it("eases linearly between the horizon and civil twilight", () => {
    expect(nightFactor(undefined, -3)).toBeCloseTo(0.5);
    expect(nightFactor(undefined, -1.5)).toBeCloseTo(0.25);
  });
  it("without elevation, steps hard on the state", () => {
    expect(nightFactor("above_horizon")).toBe(0);
    expect(nightFactor("below_horizon")).toBe(1);
  });
  it("a missing entity is full day", () => {
    expect(nightFactor(undefined, undefined)).toBe(0);
  });
});

describe("DEFAULT_SUN_ENTITY / NIGHT_MAX_OPACITY", () => {
  it("defaults to HA's own sun entity and keeps the wash short of opaque", () => {
    expect(DEFAULT_SUN_ENTITY).toBe("sun.sun");
    expect(NIGHT_MAX_OPACITY).toBeGreaterThan(0);
    expect(NIGHT_MAX_OPACITY).toBeLessThan(1);
  });
});
```
- [ ] **Step 2: Run it, verify it fails**
```bash
npx vitest run src/theme.test.ts
```
Expected: FAIL — `Cannot find module './theme'` (file does not exist yet).
- [ ] **Step 3: Implement `src/theme.ts`**
```ts
/**
 * Day/night theming (roadmap 4a): a pure day/darkness reading off a sun (or
 * sun-like) entity, kept separate from `floorplan-card.ts` so it is testable
 * without a DOM. The card only calls this when
 * `featureEnabled(config, "dayNightTheme")` is true -- a disabled or unbound
 * plan never touches it.
 */

/** Default entity read for the day/night overlay; overridable via `config.dayNightEntity`. */
export const DEFAULT_SUN_ENTITY = "sun.sun";

/**
 * Elevation (degrees) at which the sun is past civil twilight -- full night
 * for the overlay's purposes. Real dusk/dawn softness lives between 0 and
 * this, in nightFactor.
 */
const CIVIL_TWILIGHT_ELEVATION = -6;

/** Peak opacity of the night wash at full darkness (never a black-out). */
export const NIGHT_MAX_OPACITY = 0.45;

/** A sun-like entity's numeric `elevation` attribute (degrees), or undefined. */
export function elevationOf(
  st: { attributes?: Record<string, unknown> } | undefined,
): number | undefined {
  const el = st?.attributes?.elevation;
  return typeof el === "number" ? el : undefined;
}

/**
 * Whether the plan should read as night.
 *
 * `elevation` is the precise signal when present: below the horizon is
 * elevation < 0. The coarser `above_horizon` / `below_horizon` state is the
 * fallback for a sun entity that does not carry elevation (or a stand-in
 * helper entity). A missing entity (both args undefined) always reads as
 * day -- the conservative default, matching the rest of the roadmap's
 * off-by-default posture: an absent signal can never make the plan darker
 * than intended.
 */
export function isNight(sunState: string | undefined, elevation?: number): boolean {
  if (typeof elevation === "number") return elevation < 0;
  return sunState === "below_horizon";
}

/**
 * 0 (full day) .. 1 (full night) darkness. With `elevation` known, night
 * eases in over civil twilight (0deg to CIVIL_TWILIGHT_ELEVATION) so the
 * wash fades in around sunset/sunrise instead of snapping on; state-only
 * input is a hard 0/1 step at the horizon.
 */
export function nightFactor(sunState: string | undefined, elevation?: number): number {
  if (typeof elevation === "number") {
    if (elevation >= 0) return 0;
    if (elevation <= CIVIL_TWILIGHT_ELEVATION) return 1;
    return elevation / CIVIL_TWILIGHT_ELEVATION;
  }
  return isNight(sunState, undefined) ? 1 : 0;
}
```
- [ ] **Step 4: Run tests, verify pass**
```bash
npx vitest run src/theme.test.ts
```
Expected: all PASS.
- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/theme.ts src/theme.test.ts
git commit -m "Add pure day/night helpers (isNight, nightFactor)"
```

---

## Task 2: `dayNightEntity` config field + validation + schema

**Files:**
- Modify: `src/types.ts` (add `dayNightEntity?: string;` to `FloorplanCardConfig`)
- Modify: `src/validate.ts` (accept it in the top-level config shape)
- Test: `src/validate.test.ts`
- Modify: `schema/floorplan-card.schema.json` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing new.
- Produces: `FloorplanCardConfig.dayNightEntity?: string`, read by Task 3 and Task 4.

- [ ] **Step 1: Write the failing tests**
```ts
// add to src/validate.test.ts
it("accepts an optional dayNightEntity string", () => {
  const r = validateConfig({ ...valid, dayNightEntity: "sensor.porch_darkness" });
  expect(r.ok).toBe(true);
});
it("rejects a non-string dayNightEntity", () => {
  const r = validateConfig({ ...valid, dayNightEntity: 5 });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.startsWith("config.dayNightEntity"))).toBe(true);
});
```
- [ ] **Step 2: Run it, verify it fails**
```bash
npx vitest run src/validate.test.ts
```
Expected: FAIL — the accept case fails because `dayNightEntity` is an unknown-but-currently-allowed key (so that one may already pass; the reject case fails because there is no check yet, so a non-string sails through as `ok: true`). Confirm the reject-case assertion is the one failing.
- [ ] **Step 3: Add the field to `FloorplanCardConfig`**

In `src/types.ts`, find the `background?: string;` line (grep: `grep -n "Canvas background color" src/types.ts`) and add directly after it:
```ts
  /**
   * Entity read by the day/night theme (roadmap 4a) -- normally a `sun.sun`
   * sensor, but any entity whose state is `above_horizon`/`below_horizon`
   * (or that carries a numeric `elevation` attribute) works, e.g. a template
   * sensor mirroring a different sun/darkness source. Defaults to `sun.sun`
   * (theme.ts's DEFAULT_SUN_ENTITY) when unset. Read only when
   * `features.dayNightTheme` is on.
   */
  dayNightEntity?: string;
```
- [ ] **Step 4: Validate it**

In `src/validate.ts`, find the top-level `config` shape (grep: `grep -n "background: str, defaultFloor" src/validate.ts`) and add `dayNightEntity: str,` next to `background: str,`:
```ts
const config = shape(
  {},
  {
    type: str, title: str, width: posNum, height: posNum, grid: num, snap: num,
    background: str, dayNightEntity: str, defaultFloor: str, floors: arrayOf(floor), ...elementLists,
  }
);
```
- [ ] **Step 5: Run tests, verify pass**
```bash
npx vitest run src/validate.test.ts
```
- [ ] **Step 6: Regenerate the schema**
```bash
npm run schema
npx vitest run src/schema.test.ts
git diff schema/floorplan-card.schema.json
```
Expected: `src/schema.test.ts` passes; the diff is additive (a new `dayNightEntity` string property plus its description), no removals.
- [ ] **Step 7: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/types.ts src/validate.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Add optional dayNightEntity config field"
```

---

## Task 3: Watch the sun entity only when the feature is on

**Files:**
- Modify: `src/render.ts` (`collectWatchedEntities`)
- Test: `src/render.test.ts`

**Interfaces:**
- Consumes: `featureEnabled` from `./features` (Prerequisite); `DEFAULT_SUN_ENTITY` from `./theme` (Task 1); `FloorplanCardConfig.dayNightEntity` (Task 2).
- Produces: no new export; changes `collectWatchedEntities`'s behaviour only when `features.dayNightTheme` is set.

- [ ] **Step 1: Write the failing tests**

Add to `src/render.test.ts`, inside (or right after) the existing `describe("collectWatchedEntities", ...)` block:
```ts
it("does not watch sun.sun when dayNightTheme is off or unset", () => {
  const off = collectWatchedEntities({
    items: [{ id: "i", kind: "light", x: 0, y: 0, entity: "light.legacy" }],
  } as unknown as FloorplanCardConfig);
  expect(off.has("sun.sun")).toBe(false);

  const explicitOff = collectWatchedEntities({
    items: [],
    features: { dayNightTheme: false },
  } as unknown as FloorplanCardConfig);
  expect(explicitOff.has("sun.sun")).toBe(false);
});

it("watches sun.sun when dayNightTheme is on", () => {
  const got = collectWatchedEntities({
    items: [],
    features: { dayNightTheme: true },
  } as unknown as FloorplanCardConfig);
  expect(got.has("sun.sun")).toBe(true);
});

it("watches the configured dayNightEntity instead of sun.sun when set", () => {
  const got = collectWatchedEntities({
    items: [],
    features: { dayNightTheme: true },
    dayNightEntity: "sensor.porch_darkness",
  } as unknown as FloorplanCardConfig);
  expect(got.has("sensor.porch_darkness")).toBe(true);
  expect(got.has("sun.sun")).toBe(false);
});
```
- [ ] **Step 2: Run it, verify it fails**
```bash
npx vitest run src/render.test.ts -t "dayNightTheme"
```
Expected: FAIL — `sun.sun` (or the configured entity) is never added today.
- [ ] **Step 3: Implement**

In `src/render.ts`, add the imports (grep: `grep -n "^import" src/render.ts` to find the top of the import block) alongside the existing `./types` import:
```ts
import { featureEnabled } from "./features";
import { DEFAULT_SUN_ENTITY } from "./theme";
```
Then, in `collectWatchedEntities` (grep: `grep -n "export function collectWatchedEntities" src/render.ts`), add the gate as the function's first line, before the floor loop:
```ts
export function collectWatchedEntities(c: FloorplanCardConfig): Set<string> {
  const ids = new Set<string>();
  if (featureEnabled(c, "dayNightTheme")) ids.add(c.dayNightEntity ?? DEFAULT_SUN_ENTITY);
  for (const f of getFloors(c)) {
    // ...unchanged...
```
- [ ] **Step 4: Run tests, verify pass**
```bash
npx vitest run src/render.test.ts
```
Expected: full file PASS, including the pre-existing `"skips unset entities and handles a legacy flat config"` test (`got.size` stays `1`) -- that test has no `features` block, so the new gate stays closed and does not regress it.
- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/render.ts src/render.test.ts
git commit -m "Watch the sun entity only when dayNightTheme is enabled"
```

---

## Task 4: Render the night overlay in the card

**Files:**
- Modify: `src/floorplan-card.ts`
- Modify: `src/floorplan-card.guard.test.ts` (source-text guard assertions -- this file's existing pattern, since the card has no shadow-DOM render test harness)

**Interfaces:**
- Consumes: `featureEnabled` from `./features`; `isNight`, `nightFactor`, `elevationOf`, `DEFAULT_SUN_ENTITY`, `NIGHT_MAX_OPACITY` from `./theme` (Task 1); `FloorplanCardConfig.dayNightEntity` (Task 2).
- Produces: a `.fp-night-overlay` `div` inside `.plate`, present only when the feature is on and it is currently night for the resolved entity.

- [ ] **Step 1: Write the failing guard tests**

Add to `src/floorplan-card.guard.test.ts`:
```ts
it("gates the night overlay behind featureEnabled(dayNightTheme)", () => {
  expect(src).toContain('featureEnabled(c, "dayNightTheme")');
  expect(src).toContain("fp-night-overlay");
});

it("keeps the night overlay non-interactive (pointer-events: none)", () => {
  const overlayRule = src.slice(src.indexOf(".fp-night-overlay {"), src.indexOf(".fp-night-overlay {") + 200);
  expect(overlayRule).toContain("pointer-events: none");
});
```
- [ ] **Step 2: Run it, verify it fails**
```bash
npx vitest run src/floorplan-card.guard.test.ts
```
Expected: FAIL — neither string exists yet.
- [ ] **Step 3: Implement**

Add the imports at the top of `src/floorplan-card.ts`, alongside the existing `./render` and `./rotation` imports (grep: `grep -n '^import.*"./rotation"' src/floorplan-card.ts`):
```ts
import { featureEnabled } from "./features";
import { isNight, nightFactor, elevationOf, DEFAULT_SUN_ENTITY, NIGHT_MAX_OPACITY } from "./theme";
```

Add a private method near the other per-render helpers (grep: `grep -n "_renderFloorSwitcher" src/floorplan-card.ts` to place it just before that method):
```ts
  /**
   * The night wash: an absolutely-positioned, pointer-events:none div over
   * the whole `.plate`, opacity driven by how far the sun (or the
   * configured stand-in) is below the horizon. `nothing` when the feature
   * is off, or when it is currently day, so a disabled or daytime plan never
   * carries the extra DOM node.
   */
  private _nightOverlay(c: FloorplanCardConfig): TemplateResult | typeof nothing {
    if (!featureEnabled(c, "dayNightTheme")) return nothing;
    const entityId = c.dayNightEntity ?? DEFAULT_SUN_ENTITY;
    const st = this.hass?.states[entityId];
    const elevation = elevationOf(st);
    if (!isNight(st?.state, elevation)) return nothing;
    const opacity = nightFactor(st?.state, elevation) * NIGHT_MAX_OPACITY;
    return html`<div class="fp-night-overlay" style="opacity:${opacity}"></div>`;
  }
```

Wire it into `render()`: find the closing of the `.items` div inside `.plate` (grep: `grep -n '<div class="items">' src/floorplan-card.ts`) and add the overlay as the next sibling, still inside `.plate` and before that `div`'s own closing tag:
```html
          <div class="items">
            ${active.texts.map((t) => this._renderText(t, c, rot))}
            ${active.items.map((it) => this._renderItem(it, c, rot))}
            ${active.furniture.map((f) =>
              this._renderFurnitureBadge(f, resolveStateStyle(f.stateStyles, this.hass, f.entity), c, rot),
            )}
          </div>
          ${this._nightOverlay(c)}
          </div>
```
(The second `</div>` above is the pre-existing `.plate` close -- only the `${this._nightOverlay(c)}` line is new.)

Add the CSS rule. Find the `.plate.rot90, .plate.rot270 { ... }` block (grep: `grep -n "plate.rot90" src/floorplan-card.ts`) and add directly after its closing brace:
```css
    .fp-night-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: var(--fp-night-color, #0a1330);
      transition: opacity 1s ease;
    }
```
- [ ] **Step 4: Run tests, verify pass**
```bash
npx vitest run src/floorplan-card.guard.test.ts
```
- [ ] **Step 5: Full suite + typecheck + build**
```bash
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
```
Expected: all green; the build step catches any Lit template/CSS syntax slip the unit tests would not.
- [ ] **Step 6: Commit**
```bash
git add src/floorplan-card.ts src/floorplan-card.guard.test.ts
git commit -m "Render a night wash overlay behind the dayNightTheme feature flag"
```

---

## Task 5 (optional): Dev harness demo

Not required for the feature to work or for this plan's tests to pass -- purely so a human can eyeball the wash in the existing manual dev harness (`npm run serve`) instead of only trusting unit tests. Skip this task if time-boxed; nothing later depends on it.

**Files:**
- Modify: `dev/dev.ts`

- [ ] **Step 1:** Find the mock `hass.states` object (grep: `grep -n "^const hass = {" dev/dev.ts`) and add a `sun.sun` entry alongside the existing mock entities:
```ts
    "sun.sun": {
      entity_id: "sun.sun",
      state: "below_horizon",
      attributes: { friendly_name: "Sun", elevation: -8, azimuth: 270 },
    },
```
- [ ] **Step 2:** Find where the demo floorplan config is built (grep: `grep -n "features" dev/dev.ts` -- if the feature-toggles editor work already added a demo `features` block, add `dayNightTheme: true` to it; otherwise add `features: { dayNightTheme: true }` to the top-level demo config object next to `background`/`width`).
- [ ] **Step 3:** `npm run serve`, open the printed local URL, and confirm a subtle dark wash covers the plan. Flip `state` to `"above_horizon"` (or delete the `elevation` attribute and set state to `"above_horizon"`) in the mock and reload to confirm the wash disappears.
- [ ] **Step 4:** Commit.
```bash
git add dev/dev.ts
git commit -m "Demo the day/night theme in the dev harness"
```

---

## Task 6 (controller): Verify + gate
- [ ] Full suite green: `npx vitest run --reporter=dot`.
- [ ] Typecheck green: `npx tsc --noEmit`.
- [ ] Build green: `npm run build`.
- [ ] `git diff schema/floorplan-card.schema.json` (from Task 2) is additive only.
- [ ] Regression check: a config with no `features` block, or `features.dayNightTheme` absent/false, produces the exact same rendered output as before this plan (no `.fp-night-overlay` node, `sun.sun` absent from `collectWatchedEntities`) -- covered by the Task 3 tests plus `_nightOverlay` returning `nothing` in that case (Task 4).
- [ ] This plan produces working, testable software on its own: `isNight`/`nightFactor` are independently useful and tested (Task 1), the config surface validates and round-trips through the schema (Task 2), and turning `features.dayNightTheme: true` on in a real config makes the plan dim at night today, without any later plan.

## Self-Review
- **Spec coverage:** watch `sun.sun` only when enabled + re-render at sunrise/sunset (Task 3); night modifier as a dark wash overlay (Task 4); pure `isNight`/darkness-factor helper with the exact test matrix asked for -- above→day, below→night, elevation thresholds, missing entity→day (Task 1); no backticks in css comments and CSS lives in the card style block (Task 4, `.fp-night-overlay` rule); optional entity override defaulting to `sun.sun` (Task 2 + Task 1's `DEFAULT_SUN_ENTITY`); writing-plans header, Global Constraints, TDD tasks with real code and exact/grep-able paths, Interfaces blocks, Self-Review (this document). ✓
- **Byte-identical when off:** `featureEnabled` gate is the first line of both `collectWatchedEntities`'s new behaviour and `_nightOverlay`; both no-op to their prior behaviour (nothing added / `nothing` returned) when the flag is off, verified by dedicated tests in Tasks 3 and 4 plus the pre-existing `collectWatchedEntities` regression test that has no `features` block at all. ✓
- **Additive schema:** Task 2 only adds `dayNightEntity?: string`; nothing is removed or retyped; the schema-drift test (`src/schema.test.ts`) gates it. ✓
- **Reduced motion:** explicitly addressed in Global Constraints -- a CSS `transition`, not a `@keyframes` animation, matching unguarded precedent already in the file. ✓
- **No placeholders:** every code step shows the real code (helpers, imports, template diff, CSS rule, tests); the only "optional" task (5) is explicitly non-blocking and still shows real code, not a TBD. ✓
- **Type consistency:** `isNight(sunState, elevation?)`, `nightFactor(sunState, elevation?)`, `elevationOf(st)`, `DEFAULT_SUN_ENTITY`, `NIGHT_MAX_OPACITY` are defined once in Task 1 and used with the identical names/signatures in Tasks 3 and 4; `FloorplanCardConfig.dayNightEntity?: string` defined once in Task 2 and read the same way in Tasks 3 and 4. ✓
- **Prerequisite risk:** `src/features.ts` does not exist in the current checkout; flagged up front so this plan is not started (or branched) before `2026-07-10-feature-toggles.md` has landed on `main`. ✓
