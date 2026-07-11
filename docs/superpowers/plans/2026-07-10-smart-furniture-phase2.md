# Smart Furniture — Phase 2: Organized menu + new glyphs

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Fable for glyphs + menu UI; sonnet for wiring.

**Goal:** Reorganize the "+ Add" popover into a searchable, collapsible, scrolling menu grouped by type; add ~13 new furniture glyphs; move tv to Appliances. Continues on `feat/smart-furniture`.

## Global Constraints
- Nothing outward; local commits only; NO AI-authorship footers. Never push `feat/item-kinds-and-aspect`.
- New glyphs match the existing family (top-down, grey `FURNITURE_COLOR` line art, `stroke-width 2`, `fill-opacity 0.08–0.12`). Each is a Fable-designed SVG.
- Adding `FurnitureType` values changes the generated schema → run `npm run schema` and commit the additive diff (the drift test enforces this).
- Landmine: no backticks in `css` comments.
- Run: `npx vitest run src/<f>.test.ts`; full suite; `npx tsc --noEmit`; `npm run build`.

## New types (~13), by group
- Seating & beds: `armchair`, `bench`, `crib`
- Tables & desks: `coffeeTable`, `nightstand`
- Storage: `dresser`, `bookshelf`, `cabinet`
- Appliances: `microwave`
- Fixtures: `shower`, `bidet`
- Decor & misc: `fireplace`

## Category → types map (for the menu; a data table)
- **Seating & beds:** chair, armchair, sofa, sectional, bench, bed, crib
- **Tables & desks:** table, roundTable, desk, coffeeTable, nightstand
- **Storage:** wardrobe, dresser, bookshelf, cabinet
- **Appliances:** fridge, stove, microwave, dishwasher, washer, dryer, waterHeater, airHandler, tv
- **Fixtures:** sink, toilet, bathtub, shower, vanity, bidet
- **Decor & misc:** rug, plant, fireplace, stairs

---

## Task 1 (Fable): Design the new glyphs

**Model: fable. Skill: frontend-design.** Study `renderFurniture` in `src/render.ts` (all cases) to internalize the family. Design each new glyph — `armchair, bench, crib, coffeeTable, nightstand, dresser, bookshelf, cabinet, microwave, shower, bidet, fireplace` — as a top-down symbol in the same visual language (base shape + detail lines, grey `FURNITURE_COLOR`, `stroke-width 2/1.5`, `fill-opacity 0.08–0.12`). For each, produce: the `renderFurniture`-ready `svg\`...\`` base+detail (centred at origin, using `w`/`h`/`hw`/`hh` like existing cases), a sensible `FURNITURE_DEFAULT_SIZE`, and a `FURNITURE_LABELS` string. Write it all to `docs/superpowers/specs/furniture-glyphs.md`. Keep them tasteful and legible at small sizes; distinguishable from neighbours (nightstand vs cabinet vs dresser). Commit that one file (no footer, no push).

## Task 2 (sonnet): Wire the new types

From `docs/superpowers/specs/furniture-glyphs.md`: add each to the `FurnitureType` union (`types.ts`), `FURNITURE_TYPES`/`FURNITURE_LABELS` (`editor-forms.ts`), `FURNITURE_DEFAULT_SIZE` (`types.ts`), the runtime array in `validate.ts`, and a `renderFurniture` case each (paste Fable's svg). TDD: a `render.test.ts` test that each new type renders without throwing and contains `FURNITURE_COLOR`; `validateConfig` accepts each new type; existing furniture unchanged. Run `npm run schema` (new enum values) and commit the additive schema diff. Commit by explicit path.

## Task 3 (Fable): Design the reorganized Add menu

**Model: fable. Skill: frontend-design.** Read the current `_renderAddMenu` (`src/editor.ts` ~2574) and the popover CSS. Design the replacement: a **search box** at top, a top "Devices & text" row (the existing Device/Text buttons), then **collapsible category sections** (the map above) each with a glyph grid, the popover **scrolling** (max-height) when tall; typing filters across sections and auto-expands matches. Deliver to `docs/superpowers/specs/furniture-menu.md`: the markup structure (lit template shape), the CSS (matching the editor's existing token style), the interaction (search filter, collapse state — a `Set<string>` of open categories or all-open-by-default), and the category→types data table. Keep it compact and keyboard-friendly. Commit that file.

## Task 4 (sonnet): Implement the menu

Replace `_renderAddMenu` per `docs/superpowers/specs/furniture-menu.md`: the search state (`@state _addSearch = ""`), collapse state, the category data (a `const FURNITURE_CATEGORIES: { label: string; types: FurnitureType[] }[]`), the sectioned/collapsible/scrolling render, and the CSS. Preserve the Device/Text/`_addFurniture` behaviour. No new unit tests (DOM/UI; verified live); tsc clean + full suite green + build. Commit `src/editor.ts` by explicit path.

## Task 5 (controller): Verify + gate + WORKLOG
- Build + 10+ install markers + suite + tsc.
- Dev harness: open "+ Add" → search box + collapsible type sections + scroll; each new glyph renders and adds its furniture; tv is under Appliances; search filters.
- Update WORKLOG; proceed to Phase 3.
