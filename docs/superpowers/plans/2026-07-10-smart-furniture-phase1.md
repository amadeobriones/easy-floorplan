# Smart Furniture — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make a furniture piece optionally entity-bound and state-reactive — its shape tints/pulses, can show a state badge, and is tap-to-control — reusing the room/item stateStyles + action engines. No entity ⇒ byte-identical to today.

**Architecture:** `Furniture` gains optional `entity`/`stateStyles`/actions/`showState`. `renderFurniture` tints from a resolved `stateStyles`. The card wraps an entity-furniture in a tappable hit-`<g>` (`handleAction`) and overlays the item badge. The editor reuses the existing stateStyles repeater (widened to `"furniture"`) + action rows.

**Design labor:** the *look* (tint intensity, badge placement, animation) is a **Fable** task (Task 1). Plumbing is sonnet.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**. Never push `feat/item-kinds-and-aspect` (open PR #40 head).
- Branch `feat/smart-furniture` off `main`.
- **No-entity furniture must render byte-identically to today** (regression guarantee).
- Landmine: animate the `scale`/`transform` on the shape's inner group, not a wrapper; no backticks in `css` tagged-template comments.
- Reuse, don't reinvent: `resolveStateStyle(rules, hass, ownEntity)`, `_renderBadge`, `actionHandler`+`handleAction`, the `.fp-opening-hit` tappable pattern, `_updateFurniture`/`_updateFurnitureLive`, the stateStyles repeater.
- `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.

---

## Task 1 (Fable): Design the smart-furniture look

**Model: fable. Skill: frontend-design.** No code commit — produces a design artifact.

- [ ] **Step 1: Branch + brief**

```bash
cd ~/src/easy-floorplan && git checkout main && git checkout -b feat/smart-furniture
```

- [ ] **Step 2: Fable designs the appearance**

Given the existing `renderFurniture` symbols (top-down, grey `FURNITURE_COLOR` stroke at `fill-opacity 0.08–0.12`, `stroke-width 2`), design how a **live** furniture piece should look when its `stateStyles` resolves a colour/animation, and how to show its entity's state. Produce, to `docs/superpowers/specs/smart-furniture-look.md`: the exact values/approach for (a) **tint** — how the resolved colour recolours base+detail and at what fill-opacity when "active" vs idle; (b) **badge** — whether/where to overlay the item badge (icon + state text) on the shape, size relative to the shape, so it reads without hiding the glyph; (c) **animation** — how pulse/blink should feel on a shape (opacity/scale, respecting `prefers-reduced-motion`); (d) a tiny SVG mock of one appliance (e.g. washer) idle vs active. Keep it consistent with the existing symbol family. This artifact is the spec Task 4 implements.

- [ ] **Step 3: Commit the design artifact**

```bash
git add docs/superpowers/specs/smart-furniture-look.md
git commit -m "Design the live/active look for smart furniture"
```

---

## Task 2 (sonnet): Types + validator

**Files:** Modify `src/types.ts` (Furniture interface), `src/validate.ts` (furniture shape), `src/types.test.ts`/`src/validate.test.ts`.

- [ ] **Step 1: Failing test** — a Furniture with `entity`/`stateStyles`/`tap_action`/`showState` typechecks and validates; a plain furniture still validates.

```ts
// src/validate.test.ts (append)
it("accepts smart-furniture fields", () => {
  const cfg = { type: "custom:floorplan-card", width: 100, height: 100, floors: [{ id: "f",
    furniture: [{ id: "u1", type: "washer", x: 1, y: 1, w: 10, h: 10, entity: "switch.washer",
      showState: true, stateStyles: [{ state: "on", color: "orange", animation: "pulse" }] }] }] };
  expect(validateConfig(cfg).ok).toBe(true);
});
```

- [ ] **Step 2: Verify fail** (`npx vitest run src/validate.test.ts` — the `stateStyles`/`entity`/`showState` on furniture aren't validated yet, so a wrong-typed one wouldn't be caught; add a negative test for `entity` non-string).

- [ ] **Step 3: Types** — in `src/types.ts` `Furniture`, add:

```ts
  /** Optional entity: with one, the piece is a live, controllable appliance. */
  entity?: string;
  secondaryEntity?: string;
  /** Conditional colour/animation/icon, first match wins (same engine as rooms/items). */
  stateStyles?: StateStyle[];
  /** Show the entity's state text on the piece. */
  showState?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
```
(Import `ActionConfig` from `custom-card-helpers` as the item types do.)

- [ ] **Step 4: Validator** — in `src/validate.ts`, extend the `furniture` shape's optional fields with `entity: str, secondaryEntity: str, showState: bool, stateStyles: arrayOf(stateStyle)` where `stateStyle` is a `shape` for a rule (`{}` required, optional `entity/state/state_not/icon/color`: str, `above/below`: num, `animation`: oneOf("none","pulse","blink")). Reuse or add a shared `stateStyle` validator (rooms/items should use it too — extract if not present).

- [ ] **Step 5: Pass, typecheck, commit**

```bash
npx vitest run src/validate.test.ts && npx tsc --noEmit
git add src/types.ts src/validate.ts src/validate.test.ts src/types.test.ts
git commit -m "Give furniture optional entity, stateStyles, actions, showState"
```

---

## Task 3 (sonnet): Widen the stateStyles repeater + update plumbing to furniture

**Files:** Modify `src/editor.ts` (`_stateElement`, `_patchStateStyles`, `_add/_remove/_updateStateStyleRule`, `_renderStateStyleRows`/`_renderStateStyleRule` signatures).

- [ ] **Step 1:** Change every `kind: "room" | "item"` in the stateStyles methods to `kind: "room" | "item" | "furniture"`.
- [ ] **Step 2:** `_stateElement` gains a furniture branch: `kind === "furniture" ? this._floor().furniture.find((x) => x.id === id) : …`. Its return type widens to include `Furniture`.
- [ ] **Step 3:** `_patchStateStyles` routes furniture:
```ts
    else if (kind === "furniture") {
      if (live) this._updateFurnitureLive(id, { stateStyles });
      else this._updateFurniture(id, { stateStyles });
    }
```
- [ ] **Step 4:** Typecheck + full suite (no new tests — verified live).
```bash
npx tsc --noEmit && npx vitest run --reporter=dot
git add src/editor.ts && git commit -m "Extend the stateStyles repeater to furniture"
```

---

## Task 4 (sonnet): Render smart furniture (implements Task 1's design)

**Files:** Modify `src/render.ts` (`renderFurniture`), `src/floorplan-card.ts` (furniture render site + a tappable/badge wrapper), `src/render.test.ts`. Read `docs/superpowers/specs/smart-furniture-look.md` first and use its values.

- [ ] **Step 1: Failing test** — `renderFurniture` tints when given a resolved style; unchanged with none.
```ts
// serialize(renderFurniture(f, {color:"orange"})) contains "orange"; without → contains FURNITURE_COLOR
```
- [ ] **Step 2:** `renderFurniture(f: Furniture, resolved?: ResolvedStyle)` — `const color = resolved?.color ?? f.color ?? FURNITURE_COLOR;` and add the animation class from `resolved?.animation` to the group, per the design artifact. No-resolved output identical to today.
- [ ] **Step 3:** In `floorplan-card.ts`, the `active.furniture.map(...)` site: resolve `const st = resolveStateStyle(f.stateStyles, this.hass, f.entity);`, call `renderFurniture(f, st)`; when `f.entity`, wrap in a tappable `<g>` with a transparent hit-rect over its bounds (mirror `.fp-opening-hit` + `actionHandler`/`handleAction` from items) and, when `f.showState` or `st?.icon`, overlay the badge per the design.
- [ ] **Step 4:** Pass, typecheck, build, commit.
```bash
npx vitest run src/render.test.ts && npx tsc --noEmit && npm run build
git add src/render.ts src/floorplan-card.ts src/render.test.ts
git commit -m "Render furniture with stateStyles tint, a state badge, and tap-to-control"
```

---

## Task 5 (sonnet): Editor form — entity + repeater + actions on furniture

**Files:** Modify `src/editor-forms.ts` (`furnitureForm`), `src/editor.ts` (furniture selection branch), `src/editor-forms.test.ts`.

- [ ] **Step 1: Failing test** — `furnitureForm` exposes an `entity` field and `showState`.
- [ ] **Step 2:** `furnitureForm` prepends an `entity` field (`selector: { entity: {} }`) and adds `showState` (`boolean`); `data`/`toPatch` carry them.
- [ ] **Step 3:** In `_renderSelectionEditor`'s `sel.kind === "furniture"` branch, after the form, render `${this._renderStateStyleRows(fu.stateStyles ?? [], "furniture", fu.id, fu.entity)}` and the action rows (reuse the item action UI/`ui_action` selectors in the form, or a custom row as items do).
- [ ] **Step 4:** Pass, typecheck, full suite, commit.
```bash
npx vitest run src/editor-forms.test.ts && npx tsc --noEmit && npx vitest run --reporter=dot
git add src/editor-forms.ts src/editor.ts src/editor-forms.test.ts
git commit -m "Edit a furniture piece's entity, rules and actions in the GUI"
```

---

## Task 6 (controller): Verify live + gate + WORKLOG

- [ ] **Step 1:** `npm run build && npx tsc --noEmit && npx vitest run --reporter=dot`; confirm the 9 install markers.
- [ ] **Step 2:** Dev harness with a mock hass: add a washer, bind an entity, add a `stateStyles` rule (state `on` → orange + pulse), set the entity `on` → the washer tints orange and pulses; tap → fires the action; `showState` overlays the badge; a furniture piece with no entity is unchanged.
- [ ] **Step 3:** Stop before deploy; update the WORKLOG; hand off to Phase 2.

## Self-Review
- Spec coverage: types/validator (T2), repeater widening (T3), render tint+badge+tap (T4), editor (T5), the look (T1 Fable), verify (T6). ✓
- Byte-identity for no-entity furniture guarded by a render test (T4) + live check (T6). ✓
- Reuse: `resolveStateStyle`, `_renderBadge`, `actionHandler`/`handleAction`, `.fp-opening-hit`, the repeater — none reinvented. ✓
