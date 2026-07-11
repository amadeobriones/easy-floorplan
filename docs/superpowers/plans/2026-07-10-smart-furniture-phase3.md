# Smart Furniture — Phase 3: Bespoke reactive glyphs

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Fable for the reactive shapes; sonnet for wiring.

**Goal:** Door/window-level delight for appliances: **washer/dryer drums rotate**, a **TV glows**, a **fireplace flickers** — automatically when the piece's entity is active (like openings react to their entity, no config), composing with Phase 1's stateStyles tint. Continues on `feat/smart-furniture`.

## Approach
- `renderFurniture(f, resolved?, active?)` gains an optional `active: boolean`. When the type has a reactive glyph AND `active` is true, it renders the bespoke animated variant (else the normal base+detail). `active` is computed by the card from the entity's live state (reuse `isEntityOn` — on/open/home/playing) so it's automatic, exactly how openings self-react.
- The reactive variants are CSS-animated on **inner sub-elements** (a drum `<g>` that `rotate`s, flame paths that flicker opacity, a TV screen that pulses a glow) — never the placement transform (landmine). Honor `prefers-reduced-motion` (freeze to a static "active" pose).
- Phase 1 still applies: a reactive piece can ALSO carry stateStyles tint. The two compose (the drum spins inside a tinted washer).

## Global Constraints
- Nothing outward; local commits only; NO AI footers. No backticks in `css` comments. Animate `scale`/`rotate` on inner sub-elements only.
- Adding `active` param must keep idle/no-entity output byte-identical (regression guard).
- `npx vitest run …`; full suite; `tsc --noEmit`; `npm run build`.

## Reactive types (4)
washer, dryer (rotating drum), tv (screen glow/scanlines), fireplace (flickering flames).

---

## Task 1 (Fable): Design the reactive glyphs

**Model: fable. Skill: frontend-design.** Study the current `washer`/`dryer`/`tv`/`fireplace` cases in `renderFurniture` (the last was added in Phase 2) and the Phase-1 `smart-furniture-look.md` (the tint/animation vocabulary). For each of the 4, design the **active variant**: what animates and how, as an SVG + CSS an engineer can implement. Deliver to `docs/superpowers/specs/reactive-glyphs.md`:
- washer & dryer: a **drum** sub-element (the existing centre circle) that rotates smoothly while active; realistic speed; the door/porthole detail stays put; the base is the normal washer/dryer base.
- tv: the screen area **glows / shows faint scanlines or a soft fill pulse** when on — reads as "playing" without being noisy.
- fireplace: **flame shapes flicker** (a couple of flame paths with offset opacity/scale flickers) inside the firebox when on.
- For each: the exact `svg` variant markup (inner animated sub-element with a class), the CSS keyframes (rotate/flicker/glow), reduced-motion fallback (a static active pose), and how it composes with a stateStyles tint (the tint colour should still apply to the shape). Keep it tasteful — emphasis, not a cartoon. Same line-art family.

Commit only that file (no footer, no push).

## Task 2 (sonnet): Wire the reactive variants

Per `docs/superpowers/specs/reactive-glyphs.md`:
1. `renderFurniture(f, resolved?, active = false)` — add the 3rd param. For `washer`/`dryer`/`tv`/`fireplace`, when `active`, render Fable's reactive variant (still inside the `g.fp-furn` when a style resolves, or a plain wrapper when active-but-no-style — decide so idle stays byte-identical). When not active, the normal case. Idle/no-entity/not-active output byte-identical (snapshot test).
2. Card (`floorplan-card.ts`): at the furniture render site, compute `const active = !!f.entity && isEntityOn(this.hass, f.entity)` (import/confirm `isEntityOn`'s signature — items use it) and pass `renderFurniture(f, st, active)`. Editor also renders furniture — pass `active` there too (or false; the editor has no live hass by default — pass what the card does if hass exists).
3. CSS: add the reactive keyframes/classes to both card and editor style blocks; reduced-motion.
4. Tests (`render.test.ts`): a washer with `active=true` contains the rotating-drum class/animation; `active=false` (or omitted) does NOT and is byte-identical to today; same idea for tv/fireplace. A card-level check that `active` is derived from `isEntityOn` (or unit-test the derivation).

Commit by explicit path. No schema change (no new types).

## Task 3 (controller): Verify + gate + WORKLOG
- Build + markers + suite + tsc.
- Dev harness + mock hass: a washer bound to `switch.x`; `x` off → drum static; `x` on → drum rotates (and if a tint rule is set, tints too); tv/fireplace similar; a no-entity washer is unchanged.
- WORKLOG; proceed to Phase 4.
