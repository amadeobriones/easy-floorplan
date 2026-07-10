# Plan Rotation (#33) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a floor rotated by a quarter turn (`Floor.rotation ∈ {0,90,180,270}`), with the drawing and its HTML overlay letterboxed together and badges/text staying upright — the letterbox wrapper landing first as its own revertible commit.

**Architecture:** A `.plate` wraps the `<svg>` and the `.items` overlay and letterboxes them together against the stage's real size, so `preserveAspectRatio="none"` is finally correct. Rotation is pure geometry in `src/rotation.ts` (footprint swap, plate class, CSS custom-property strings, counter-rotation angle); `render()`/`_renderItem`/`_renderText` are thin wiring. The editor is untouched — floors already round-trip `rotation` through a spread.

**Tech Stack:** TypeScript, Lit, vitest (node, no DOM harness — pure functions and Lit-template serialization, mirroring `renderOpening`), CSS container-query units.

## Global Constraints

- **Nothing goes out.** No PR, issue, comment, reply, or `@`-mention to upstream or anyone, ever, without Amadeo asking for that specific action that time. Local commits only; do not push unless asked.
- **Never push `feat/item-kinds-and-aspect`** — it is the head of OPEN PR #40 (`merge_upstream.py:OPEN_PR_HEADS`). Irrelevant to this plan's branches but do not confuse them.
- **No AI-authorship footers** in this public repo — no `Co-Authored-By: Claude`, no "Generated with Claude Code".
- **Landmine — `preserveAspectRatio="none"` is correct and stays.** Never change it to `"meet"`. A source-guard test enforces this.
- **Landmine — no backticks inside a `css` tagged-template comment**; they terminate the literal. Guard comments in that block use `/* */` without backticks.
- **Landmine — `normalizeFloor` must not backfill `rotation`.** A missing rotation stays missing (mirrors `rooms`).
- **Landmine — animate the `scale` property, never `transform: scale()`.** The plate owns `transform`.
- Branches are cut from `main` (not `upstream/main`): `render()` has diverged ~59 commits from upstream, so an upstream-based branch would conflict wholesale. Keep each commit isolated so it can be `git revert`-ed if upstream ships its own aspect fix.
- Run one test file with `npx vitest run src/<file>.test.ts`; the full suite with `npx vitest run --reporter=dot`. Baseline today: 298 passing across the `src/*.test.ts` files. Typecheck with `npx tsc --noEmit`.

---

## File Structure

- `src/rotation.ts` — **create.** Pure rotation geometry: `normalizeRotation`, `footprintRatio`, `stageAspect`, `plateClass`, `plateVars`, `counterRotate`. No DOM, no Lit.
- `src/rotation.test.ts` — **create.** Unit tests for every `rotation.ts` export.
- `src/types.ts` — **modify.** Add `export type Rotation` and `Floor.rotation?: Rotation`.
- `src/types.test.ts` — **modify.** Two tests: `getFloors` preserves `rotation`; `normalizeFloor` never injects it.
- `src/floorplan-card.ts` — **modify.** `.plate` wrapper + CSS (Commit 1); rotation wiring + rot CSS + counter-rotation (Commit 2). Rewrite the `preserveAspectRatio` guard comment.
- `src/floorplan-card.guard.test.ts` — **create.** Source-guard: `preserveAspectRatio="none"` present, `"meet"` absent.

Two commits, two branches:
- **`fix/aspect-letterbox`** (off `main`): Tasks 1–2. The rotation-agnostic plate.
- **`feat/33-rotation`** (off `fix/aspect-letterbox`): Tasks 3–6. Rotation stacked on the plate.

---

## Task 1: The `.plate` letterbox wrapper

Branch: `fix/aspect-letterbox` off `main`. Wrap `<svg>` + `.items` in a centred plate that letterboxes them together against the stage's actual size, making `preserveAspectRatio="none"` correct regardless of the stage box.

**Files:**
- Modify: `src/floorplan-card.ts` (the `render()` `.stage` block ~lines 267–343, the `preserveAspectRatio` guard comment ~274–287, the `.stage` CSS ~373–377, add `.plate` CSS after the `svg` rule ~414)
- Create: `src/floorplan-card.guard.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: DOM structure `.stage > .plate > (svg, .items)`; `.plate` carries inline `--fp-arw`. Task 3 adds `plateClass`/`--fp-rot` to this same `.plate`.

- [ ] **Step 1: Create the branch**

```bash
cd ~/src/easy-floorplan
git checkout main
git checkout -b fix/aspect-letterbox
```

- [ ] **Step 2: Write the failing source-guard test**

Create `src/floorplan-card.guard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./floorplan-card.ts", import.meta.url)), "utf8");

describe("floorplan-card source guards", () => {
  it("keeps preserveAspectRatio=none and never regresses to meet", () => {
    expect(src).toContain('preserveAspectRatio="none"');
    expect(src).not.toContain('preserveAspectRatio="meet"');
  });

  it("wraps the svg and the overlay in a single .plate", () => {
    expect(src).toContain('class="plate');
  });
});
```

- [ ] **Step 3: Run it to verify the `.plate` assertion fails**

Run: `npx vitest run src/floorplan-card.guard.test.ts`
Expected: FAIL — the `.plate` assertion fails (no plate yet); the preserveAspectRatio assertions pass.

- [ ] **Step 4: Add the `.plate` wrapper in `render()`**

In `src/floorplan-card.ts` `render()`, replace the `<svg>`-plus-`<div class="items">` children of `.stage` so they are wrapped in a `.plate`. The `.stage` opening tag keeps its inline `aspect-ratio`/`background`. Insert `<div class="plate" style="--fp-arw:${c.width / c.height};">` immediately before `<svg ...>` and its closing `</div>` immediately after `</div>` (the `.items` close), leaving the `svg`, `.items`, and floor-switcher content exactly as-is. Result:

```ts
        <div
          class="stage"
          style="aspect-ratio: ${c.width} / ${c.height}; background:${c.background ??
          "var(--card-background-color, #fff)"};"
        >
          <div class="plate" style="--fp-arw:${c.width / c.height};">
            <svg viewBox="0 0 ${c.width} ${c.height}" preserveAspectRatio="none">
              <!-- unchanged svg children -->
            </svg>
            <div class="items">
              <!-- unchanged items/texts -->
            </div>
          </div>
          ${floors.length > 1 ? this._renderFloorSwitcher(floors, active) : nothing}
        </div>
```

- [ ] **Step 5: Rewrite the guard comment (no backticks)**

Replace the existing `preserveAspectRatio` comment block (the one that begins `preserveAspectRatio="none" is correct here...`) with one describing the plate. Keep it inside the HTML template as an `<!-- -->` comment, no backticks:

```html
<!-- preserveAspectRatio="none" is correct, and now provably so. The .plate box
     always carries the natural width/height ratio (aspect-ratio: var(--fp-arw)),
     so the SVG's box equals its viewBox and "none" never distorts. .plate also
     holds the .items HTML overlay, so both layers letterbox and rotate as one
     unit -- the badges can no longer drift off their walls when card-mod or a
     grid row-count overrides the .stage box. Do not change this to "meet". -->
```

- [ ] **Step 6: Add the `.stage`/`.plate` CSS**

In the `styles` block, change the `.stage` rule and add a `.plate` rule (place `.plate` right after the existing `svg { ... }` rule). Use a plain `/* */` comment, no backticks:

```css
    .stage {
      position: relative;
      width: 100%;
      padding: 0;
      container-type: size;
      overflow: hidden;
    }
    /* The plate always has the natural W/H ratio, is centred, and is sized by
       min() to the largest natural-ratio box that fits the stage -- a letterbox
       that holds even when the stage box is overridden. */
    .plate {
      position: absolute;
      top: 50%;
      left: 50%;
      aspect-ratio: var(--fp-arw);
      width: min(100cqw, 100cqh * var(--fp-arw));
      transform: translate(-50%, -50%);
      transform-origin: center;
    }
```

The existing `svg { position:absolute; inset:0; width:100%; height:100%; }` and `.items { position:absolute; inset:0; pointer-events:none; }` rules are unchanged — they now fill `.plate` instead of `.stage`.

- [ ] **Step 7: Run the guard test and the full suite**

Run: `npx vitest run src/floorplan-card.guard.test.ts`
Expected: PASS (both tests).
Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: typecheck clean; 300 tests pass (298 prior + 2 new).

- [ ] **Step 8: Commit**

```bash
git add src/floorplan-card.ts src/floorplan-card.guard.test.ts
git commit -m "Letterbox the svg and the overlay together in one .plate"
```

---

## Task 2: Verify the letterbox in the running card

Behavioural verification of Task 1 before rotation stacks on it. No new file; this is the dev-harness check the pure tests can't cover (there is no DOM test harness in this repo).

**Files:** none changed.

- [ ] **Step 1: Build and open the dev harness**

Run: `npm run build`
Expected: build succeeds; `dist/easy-floorplan-card.js` written.

- [ ] **Step 2: Confirm alignment holds under a distorted stage**

Open the dev harness (`dev/` — see `README.md` for the exact command) and, in devtools, force the stage to a wrong ratio (e.g. set `.stage { aspect-ratio: 1 / 1 }` on a wide plan). Confirm the drawing letterboxes inside the square and every badge stays on its wall (before this change the badges drifted). Confirm the normal, un-overridden view looks identical to `main`.

- [ ] **Step 3: Note the result**

No commit. If alignment is wrong, stop and fix Task 1 before proceeding — rotation depends on this holding.

---

## Task 3: `rotation.ts` pure geometry + `Rotation` type

Branch: `feat/33-rotation` off `fix/aspect-letterbox`. All rotation logic as pure, fully-tested functions.

**Files:**
- Modify: `src/types.ts` (add `Rotation` type ~before `Floor`; add `Floor.rotation?` ~line 434 near `rooms`)
- Create: `src/rotation.ts`
- Create: `src/rotation.test.ts`

**Interfaces:**
- Produces:
  - `type Rotation = 0 | 90 | 180 | 270`
  - `normalizeRotation(v: unknown): Rotation`
  - `footprintRatio(w: number, h: number, rot: Rotation): [number, number]`
  - `stageAspect(w: number, h: number, rot: Rotation): string` — e.g. `"600 / 1000"`
  - `plateClass(rot: Rotation): "rot0" | "rot90" | "rot180" | "rot270"`
  - `plateVars(w: number, h: number, rot: Rotation): string` — e.g. `"--fp-arw:1.6666666666666667;--fp-rot:90deg;"`
  - `counterRotate(baseAngle: number, rot: Rotation): number` — `baseAngle - rot`
- Consumed by Task 4 (`render()`), Task 5 (`_renderItem`/`_renderText`).

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/33-rotation
```

- [ ] **Step 2: Add the `Rotation` type and `Floor.rotation`**

In `src/types.ts`, add the type just before `export interface Floor`:

```ts
/** A quarter-turn display rotation for a floor. Absent means 0. */
export type Rotation = 0 | 90 | 180 | 270;
```

Inside `interface Floor`, next to `rooms?`, add:

```ts
  /**
   * Display-only quarter-turn rotation. Coordinates are always canonical; this
   * rotates the drawn plan (and swaps the stage footprint at 90/270). The editor
   * edits unrotated and preserves this field untouched.
   */
  rotation?: Rotation;
```

- [ ] **Step 3: Write the failing tests**

Create `src/rotation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeRotation,
  footprintRatio,
  stageAspect,
  plateClass,
  plateVars,
  counterRotate,
} from "./rotation";

describe("normalizeRotation", () => {
  it("passes the four quarter turns through", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });
  it("clamps anything else to 0", () => {
    for (const bad of [45, -90, 360, "90", null, undefined, NaN, {}]) {
      expect(normalizeRotation(bad as unknown)).toBe(0);
    }
  });
});

describe("footprintRatio", () => {
  it("keeps W/H at 0 and 180", () => {
    expect(footprintRatio(1000, 600, 0)).toEqual([1000, 600]);
    expect(footprintRatio(1000, 600, 180)).toEqual([1000, 600]);
  });
  it("swaps to H/W at 90 and 270", () => {
    expect(footprintRatio(1000, 600, 90)).toEqual([600, 1000]);
    expect(footprintRatio(1000, 600, 270)).toEqual([600, 1000]);
  });
});

describe("stageAspect", () => {
  it("renders the footprint as a CSS ratio", () => {
    expect(stageAspect(1000, 600, 0)).toBe("1000 / 600");
    expect(stageAspect(1000, 600, 90)).toBe("600 / 1000");
  });
});

describe("plateClass", () => {
  it("names the rotation class", () => {
    expect(plateClass(0)).toBe("rot0");
    expect(plateClass(270)).toBe("rot270");
  });
});

describe("plateVars", () => {
  it("emits the arw and rot custom properties", () => {
    expect(plateVars(1000, 600, 90)).toBe(`--fp-arw:${1000 / 600};--fp-rot:90deg;`);
    expect(plateVars(1000, 600, 0)).toBe(`--fp-arw:${1000 / 600};--fp-rot:0deg;`);
  });
});

describe("counterRotate", () => {
  it("subtracts the plate rotation from the base angle", () => {
    expect(counterRotate(0, 90)).toBe(-90);
    expect(counterRotate(0, 0)).toBe(0);
    expect(counterRotate(30, 180)).toBe(-150);
    expect(counterRotate(45, 270)).toBe(-225);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/rotation.test.ts`
Expected: FAIL — `Cannot find module "./rotation"`.

- [ ] **Step 5: Implement `rotation.ts`**

Create `src/rotation.ts`:

```ts
import type { Rotation } from "./types";

/** Clamp any config value to one of the four quarter turns; anything else is 0. */
export function normalizeRotation(v: unknown): Rotation {
  return v === 90 || v === 180 || v === 270 ? v : 0;
}

/** The stage's display footprint: W/H at 0/180, swapped to H/W at 90/270. */
export function footprintRatio(w: number, h: number, rot: Rotation): [number, number] {
  return rot === 90 || rot === 270 ? [h, w] : [w, h];
}

/** The footprint as a CSS `aspect-ratio` value, e.g. "600 / 1000". */
export function stageAspect(w: number, h: number, rot: Rotation): string {
  const [fw, fh] = footprintRatio(w, h, rot);
  return `${fw} / ${fh}`;
}

/** The `.plate` rotation class. */
export function plateClass(rot: Rotation): "rot0" | "rot90" | "rot180" | "rot270" {
  return `rot${rot}` as "rot0" | "rot90" | "rot180" | "rot270";
}

/** Inline custom properties for the plate: the natural ratio and the rotation. */
export function plateVars(w: number, h: number, rot: Rotation): string {
  return `--fp-arw:${w / h};--fp-rot:${rot}deg;`;
}

/** Degrees to keep a badge or text upright: its own angle minus the plate rotation. */
export function counterRotate(baseAngle: number, rot: Rotation): number {
  return baseAngle - rot;
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/rotation.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/rotation.ts src/rotation.test.ts
git commit -m "Add per-floor rotation geometry and the Rotation type"
```

---

## Task 4: Wire rotation into the stage and plate

Feed `rotation.ts` into `render()` so the stage footprint swaps and the plate carries the class and rotation.

**Files:**
- Modify: `src/floorplan-card.ts` (`render()` — imports, the `active` line area, the `.stage`/`.plate` opening tags; the `.plate` CSS to add the rotate transform and the 90/270 axis swap)

**Interfaces:**
- Consumes: `normalizeRotation`, `stageAspect`, `plateClass`, `plateVars` from `./rotation`.
- Produces: `.stage` inline `aspect-ratio` from `stageAspect`; `.plate` `class="plate ${plateClass(rot)}"` and `style="${plateVars(...)}"`. `rot` is available for Task 5.

- [ ] **Step 1: Import the helpers**

At the top of `src/floorplan-card.ts`, add to the existing `./rotation`-less imports:

```ts
import { normalizeRotation, stageAspect, plateClass, plateVars } from "./rotation";
```

- [ ] **Step 2: Compute `rot` and rewrite the `.stage`/`.plate` tags**

In `render()`, after `active` is resolved, add:

```ts
    const rot = normalizeRotation(active.rotation);
```

Change the `.stage` inline `aspect-ratio` to use `stageAspect`, and the `.plate` to carry the class and vars:

```ts
        <div
          class="stage"
          style="aspect-ratio: ${stageAspect(c.width, c.height, rot)}; background:${c.background ??
          "var(--card-background-color, #fff)"};"
        >
          <div class="plate ${plateClass(rot)}" style="${plateVars(c.width, c.height, rot)}">
```

- [ ] **Step 3: Extend the `.plate` CSS for rotation**

Change the `.plate` rule's `transform` to apply `--fp-rot`, and add the 90/270 axis-swap after it (plain `/* */` comment, no backticks):

```css
    .plate {
      position: absolute;
      top: 50%;
      left: 50%;
      aspect-ratio: var(--fp-arw);
      width: min(100cqw, 100cqh * var(--fp-arw));
      transform: translate(-50%, -50%) rotate(var(--fp-rot, 0deg));
      transform-origin: center;
    }
    /* At 90/270 the plate's rotated box must fill the swapped stage footprint,
       so bound the natural-ratio width by the stage's height instead. */
    .plate.rot90,
    .plate.rot270 {
      width: min(100cqh, 100cqw * var(--fp-arw));
    }
```

- [ ] **Step 4: Update the source guard for the class-with-rotation**

The guard test's `class="plate` assertion still holds (the class attribute now starts `class="plate `). No test change needed. Run it:

Run: `npx vitest run src/floorplan-card.guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: clean; all tests pass (no new tests this task; behaviour is CSS/template, verified live in Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/floorplan-card.ts
git commit -m "Rotate the plate and swap the stage footprint by Floor.rotation"
```

---

## Task 5: Counter-rotate badges and text; preserve rotation in the editor round-trip

Keep icon+label upright at every rotation, and prove a floor's `rotation` survives the editor's read/write.

**Files:**
- Modify: `src/floorplan-card.ts` (`_renderItem` container style ~line 228; `_renderText` transform ~line 252; import `counterRotate`)
- Modify: `src/types.test.ts` (two preservation tests)

**Interfaces:**
- Consumes: `counterRotate(baseAngle, rot)`, `normalizeRotation` from `./rotation`; `getFloors` from `./types`.
- Produces: at `rot===0`, item and text markup identical to today (no inline transform added to `.item`, text transform equals `rotate(${t.angle}deg)`). The badge's own `rotate(item.angle)` is never touched.

- [ ] **Step 1: Write the failing editor-preservation tests**

In `src/types.test.ts`, add (mirroring the existing `normalizeFloor`/`rooms` note near line 315). Use a minimal `floors`-shaped config so `getFloors` takes the `c.floors` branch:

```ts
import { getFloors } from "./types";
// ...
describe("getFloors — rotation round-trip", () => {
  const floor = (extra: Record<string, unknown>) => ({
    id: "f1", name: "F1", walls: [], openings: [], items: [], texts: [],
    furniture: [], trackers: [], ...extra,
  });

  it("preserves a floor's rotation", () => {
    const c = { type: "custom:floorplan-card", width: 1000, height: 600,
                floors: [floor({ rotation: 270 })] } as never;
    expect(getFloors(c)[0].rotation).toBe(270);
  });

  it("never injects rotation onto a floor that lacks it", () => {
    const c = { type: "custom:floorplan-card", width: 1000, height: 600,
                floors: [floor({})] } as never;
    expect("rotation" in getFloors(c)[0]).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify the preservation tests pass already**

Run: `npx vitest run src/types.test.ts`
Expected: PASS — `normalizeFloor` already spreads `{...f}`, so `rotation` survives and is never added. (These tests lock that in; the landmine is a regression guard, not a change.)

- [ ] **Step 3: Write the counter-rotation wiring**

Import the helper at the top of `src/floorplan-card.ts` (extend the existing `./rotation` import):

```ts
import { normalizeRotation, stageAspect, plateClass, plateVars, counterRotate } from "./rotation";
```

`_renderItem` and `_renderText` need `rot`. Pass it in. Change their signatures and call sites:

- In `render()`, the overlay maps become:
  ```ts
            <div class="items">
              ${active.texts.map((t) => this._renderText(t, c, rot))}
              ${active.items.map((it) => this._renderItem(it, c, rot))}
            </div>
  ```
- `_renderText(t: FloorText, c: FloorplanCardConfig, rot: Rotation)` — change its transform line:
  ```ts
                 transform:translate(-50%,-50%) rotate(${counterRotate(t.angle ?? 0, rot)}deg);"
  ```
- `_renderItem(item: FloorItem, c: FloorplanCardConfig, rot: Rotation)` — the `.item` container style becomes:
  ```ts
        style="left:${(item.x / c.width) * 100}%; top:${(item.y / c.height) * 100}%;${
          rot ? ` transform: translate(-50%, -50%) rotate(${counterRotate(0, rot)}deg);` : ""
        }"
  ```
  (When `rot === 0` no inline transform is emitted, so the CSS `.item { transform: translate(-50%, -50%) }` applies and the markup is unchanged from today. The inner `.badge` `rotate(item.angle)` is left exactly as-is.)

Add the `Rotation` type import if not already present:

```ts
import type { FloorplanCardConfig, Floor, FloorItem, FloorText, Rotation } from "./types";
```

- [ ] **Step 4: Typecheck and full suite**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: clean; all tests pass (298 prior + 2 rotation.test additions already counted + 2 new types.test = the suite total grows accordingly).

- [ ] **Step 5: Commit**

```bash
git add src/floorplan-card.ts src/types.test.ts
git commit -m "Keep badges and text upright under rotation; lock rotation round-trip"
```

---

## Task 6: Verify rotation in the running card and the generated dashboard

Behavioural verification across all four angles, plus the deploy-time symbol check.

**Files:** none changed.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 2: Exercise each rotation in the dev harness**

Open the dev harness. For a wide plan (e.g. 1000×600), set the active floor's `rotation` to 90, 180, 270, and back to 0 (via the harness config). Confirm at each:
- 90/270: the card footprint is portrait; the plan fills it with no distortion and no clipping.
- Every badge and text label is upright and still sits on its wall/coordinate.
- 0: identical to before the feature.

- [ ] **Step 3: Confirm the merge/verify gate is clean**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot && npm run build`
Expected: all green. Confirm `dist/easy-floorplan-card.js` still contains the dashboard-required symbols (the same set `install_ha.py` checks): `sectional`, `waterHeater`, `airHandler`, `bathtub`, `vanity`, `media_player`, `label-only`, `fan_only`, `Detect rooms`.

- [ ] **Step 4: Stop before deploy**

Do **not** run `install_ha.py` or push. Report the branch state to Amadeo and let him choose whether to deploy to his live HA. Update `06_Deliverables/home_assistant/WORKLOG.md` (on the YUMI workspace) with the two new commits and mark #33 done, its verification, and the remaining next items (#25 areas, #35 schema).

---

## Self-Review

**Spec coverage:**
- Plate wrapper letterboxing both layers → Task 1. ✓
- `preserveAspectRatio="none"` stays, guard comment rewritten → Task 1 (steps 4–5) + guard test. ✓
- `Floor.rotation ∈ {0,90,180,270}` → Task 3 (type). ✓
- `normalizeRotation`, `footprintRatio` pure/tested → Task 3. ✓
- Stage footprint swap; plate class + vars → Task 4. ✓
- Container-unit letterbox / 90-270 axis swap → Task 1 (`.plate`) + Task 4 (`.rot90/.rot270`). ✓
- Counter-rotate whole item container + text, upright at 180 → Task 5. ✓
- Editor config-only, preserves `rotation`, no backfill → Task 5 (tests) + no editor code (spread already preserves). ✓
- Two droppable commits → `fix/aspect-letterbox` (Task 1), `feat/33-rotation` (Tasks 3–5). ✓
- Nothing outward, no footers → Global Constraints. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command shows expected output. ✓

**Type consistency:** `Rotation` defined in Task 3, imported in Tasks 4–5. `normalizeRotation`/`stageAspect`/`plateClass`/`plateVars`/`counterRotate` signatures identical across `rotation.ts` (Task 3), `render()` (Task 4), and `_renderItem`/`_renderText` (Task 5). `--fp-arw`/`--fp-rot` names match between `plateVars` (Task 3), the `.plate` CSS (Tasks 1, 4), and the wiring (Task 4). ✓

**Note on TDD altitude:** the letterbox and rotation CSS/template are verified by pure-function tests (`rotation.ts`), a source-guard test, the round-trip tests, and live dev-harness checks (Tasks 2, 6) — this repo has no DOM render harness and this patch deliberately does not add one (small-patch rule). That is the honest test boundary, called out rather than faked.
