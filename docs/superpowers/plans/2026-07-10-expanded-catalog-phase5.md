# Expanded Furniture Catalog — Phase 5

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Fable designs glyphs; sonnet wires.

**Goal:** Add seven smart-home-relevant furniture/fixture shapes the user asked for — a **ceiling fan** (blades spin when on), a **table/floor lamp** and a **ceiling light** (both glow when on), and static glyphs for a **coffee maker**, **toaster**, **range hood**, and **smart speaker** — plus a new "Lighting & fans" menu category. Continues on `feat/smart-furniture`.

## Why these / reactivity
The user named "coffee makers, fans/ceiling fans, Lights." The three lighting/fan pieces become **reactive** by plugging into the Phase-3 `active` mechanism already in `renderFurniture(f, resolved?, active)`: the card already computes `active = !!f.entity && isEntityOn(state)` for every furniture piece, so a ceiling fan bound to `fan.x` spins when on and a lamp bound to `light.x` glows when on — automatically, no config, like doors/windows. The other four are ordinary line-art glyphs (still entity-bindable + stateStyles-tintable via the Phase-1 smart layer). Note: `light`/`fan` already exist as ITEM kinds (entity badges); these are furniture SHAPES with distinct names (`ceilingFan`, `ceilingLight`, `lamp`) — no collision.

## New types (7)
| type | category | reactive active-variant |
|---|---|---|
| `ceilingFan` | Lighting & fans | blades rotate while `active` |
| `ceilingLight` | Lighting & fans | soft glow while `active` |
| `lamp` | Lighting & fans | soft glow while `active` |
| `coffeeMaker` | Appliances | — (static; tint via stateStyles) |
| `toaster` | Appliances | — |
| `rangeHood` | Appliances | — |
| `smartSpeaker` | Appliances | — |

## Menu categories (additive to the Phase-2 `FURNITURE_CATEGORIES`)
- **New group "Lighting & fans":** `ceilingFan`, `ceilingLight`, `lamp`.
- **Appliances** gains: `coffeeMaker`, `toaster`, `rangeHood`, `smartSpeaker`.
The set-equality guard test (every `FurnitureType` appears in exactly one category) must still pass — update its expected total (35 → 42).

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`. (Commit signing OFF for this run — do not re-enable.)
- New glyphs match the family: top-down, grey `FURNITURE_COLOR` line art, `stroke-width 2` (1.5 detail), `fill-opacity 0.08–0.12` idle. Each is a Fable-designed SVG centred at origin using `w`/`h`/`hw`/`hh`.
- Reactive active-variants follow the Phase-3 contract (`docs/superpowers/specs/reactive-glyphs.md`): the animated sub-element is an inner child of `detail` with a CSS class, animating only standalone `rotate`/`scale`/`opacity` (`transform-box: fill-box; transform-origin: center`); idle / `!active` output byte-identical; composes with a stateStyles tint (moving parts use the shared `color`). New CSS classes go in BOTH card and editor style blocks. No backticks in css comments.
- Adding `FurnitureType` values changes the generated schema → `npm run schema`, commit the additive diff (drift test enforces).
- `npx vitest run src/<f>.test.ts`; full suite; `npx tsc --noEmit`; `npm run build`.

## Files to touch (established Phase-2 pattern)
`src/types.ts` (`FurnitureType` union + `FURNITURE_DEFAULT_SIZE`), `src/editor-forms.ts` (`FURNITURE_TYPES`, `FURNITURE_LABELS`), `src/validate.ts` (runtime `FURNITURE_TYPES` array), `src/editor.ts` (`FURNITURE_CATEGORIES` + set-equality test), `src/render.ts` (`renderFurniture` cases + active-variants), CSS in `src/floorplan-card.ts` + `src/editor.ts`.

---

## Task 1 (Fable): Design the seven glyphs (+ 3 reactive variants)

**Model: fable. Skill: frontend-design.** Read `renderFurniture` (`src/render.ts`) — all cases — and `docs/superpowers/specs/reactive-glyphs.md` (the Phase-3 active-variant contract + existing `fp-furn-drum`/`fp-furn-screen` classes you may echo). Design each of the 7 as a top-down symbol in the family. For the three reactive ones ALSO design the `active` variant:
- **ceilingFan**: a central hub + 3–4 curved/tapered blades. Active: blades rotate smoothly (a fan spins visibly faster than the washer drum — pick a tasteful speed, faster than `fp-furn-drum`'s 3.6 s). Put the blades in a classed inner `<g>` (e.g. `fp-furn-fan`) that rotates; hub stays put. Reduced-motion → blades static.
- **ceilingLight**: a ceiling-mount fixture (e.g. a flush-mount disc or a simple pendant seen top-down). Active: a soft radial/opacity glow (echo `fp-furn-screen`'s opacity swell, or a new `fp-furn-glow`). Reduced-motion → steady lit.
- **lamp**: a table/floor lamp (base + shade circle top-down). Active: soft glow like ceilingLight. Reduced-motion → steady lit.
- **coffeeMaker, toaster, rangeHood, smartSpeaker**: static glyphs, distinguishable from each other and from existing appliances (fridge/stove/microwave/dishwasher). rangeHood reads as a hood over a cooktop; smartSpeaker as a round/pill speaker with a grille cue.

Deliver to `docs/superpowers/specs/catalog-glyphs.md`: for each type the `renderFurniture`-ready `svg` base+detail, a `FURNITURE_DEFAULT_SIZE`, a `FURNITURE_LABELS` string, its category; and for the 3 reactive ones the active-variant `svg` + the new CSS class(es)/keyframes for both style blocks + reduced-motion note. Commit only that file, no footer, no push.

## Task 2 (sonnet): Wire the seven types (+ reactive variants + menu)

From `docs/superpowers/specs/catalog-glyphs.md`:
1. `src/types.ts`: add the 7 to the `FurnitureType` union and `FURNITURE_DEFAULT_SIZE`.
2. `src/editor-forms.ts`: add to `FURNITURE_TYPES` and `FURNITURE_LABELS`.
3. `src/validate.ts`: add to the runtime `FURNITURE_TYPES` array.
4. `src/editor.ts`: add the "Lighting & fans" group to `FURNITURE_CATEGORIES` and the 4 appliances to the Appliances group; update the set-equality guard's expected count (→ 42).
5. `src/render.ts` `renderFurniture`: add a `case` for each (paste Fable's base svg). For `ceilingFan`/`ceilingLight`/`lamp`, gate the active-variant on the existing `active` param exactly like washer/tv (idle byte-identical). No card change needed — `active` is already computed and passed for all furniture.
6. CSS: add Fable's new reactive class(es)/keyframes to BOTH `src/floorplan-card.ts` and `src/editor.ts` style blocks; reduced-motion.
7. `npm run schema` → commit additive diff.
8. TDD (`src/render.test.ts`): each new type renders without throwing and contains `FURNITURE_COLOR`; `validateConfig` accepts each; `ceilingFan` with `active:true` contains its spin class and `active:false` doesn't (and is byte-identical to omitted); `lamp`/`ceilingLight` active contains the glow class; the 4 static ones render identically active or not. Commit by explicit path.

## Task 3 (controller): Verify + gate + WORKLOG
- Build + install markers + full suite + tsc.
- Dev harness: the "+ Add" menu shows the new "Lighting & fans" category and the new Appliances; each glyph renders + adds; a ceiling fan bound to a `fan` entity spins when on; a lamp/ceiling light glows when on; the 4 static glyphs read distinctly.
- WORKLOG; this is the last feature phase — hand to merge/deploy.
