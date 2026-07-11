# Door Types — Phase 4

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Fable designs the symbols; sonnet wires the model + render + form.

**Goal:** Add three new, non-overdone door kinds to the existing opening system — **double doors** (two swinging leaves), a **garage door** (sectional/roll), and a **bi-fold door** (accordion) — each reactive to its entity's open/closed state exactly like today's doors/windows, `amt`-driven partial open where it makes sense. Continues on `feat/smart-furniture`.

## Why these three
The opening model already covers single swing doors, double-casement windows, and sliders (single/bypass/biparting). The gaps a real floor plan hits: a **double door** (front/patio double leaf — includes French doors visually), a **garage door** (its own symbol; upstream #45 asks for it; cover `device_class: garage` should pick it automatically), and a **bi-fold** (closet/patio accordion). **Pocket doors are intentionally omitted** — a single slider already reads as a pocket/barn door; adding it would be overdone.

## Data model (the smallest additive change)
- Widen `Opening.motion` from `"swing" | "slide"` to `"swing" | "slide" | "roll" | "fold"`. `roll` = garage sectional; `fold` = bi-fold accordion. Both are doors (`type: "door"`).
- Add `Opening.swingStyle?: "single" | "double"` (default `single`), mirroring `sliderStyle`. Applies to **swing doors**: `double` renders two leaves. (Windows keep their existing automatic double-casement swing — unchanged.)
- Add `Opening.foldPanels?: 2 | 4` (default `4`) — how many leaves a bi-fold has. Optional; keep it small.
- `openingFromDeviceClass`: a cover with `device_class: "garage"` should return `motion: "roll"` (today it returns `slide`). Other rolling classes (shutter/awning/blind/curtain/shade) stay `slide`.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`. (Commit signing is OFF for this autonomous run — do not re-enable it.)
- New symbols reuse the opening visual language: centered at origin, jambs at `±half`, `cutH = WALL_THICKNESS + 4`, leaf rects `height 2.5` (solid) / `1.5` (glass), `tone = active ? accent : color`, `amt` (0..1) drives partial open via CSS `transform` + `stroke-dashoffset`, moving parts carry CSS classes (`fp-door-leaf`, `fp-slide-panel`, `fp-door-arc`, …) so the host transitions them. Mirrors via the existing `openingMirror` scale wrapper — do NOT add your own placement transform.
- Adding enum values changes the generated schema → `npm run schema` and commit the additive diff (drift test enforces it).
- Landmine: animate/position moving parts on inner sub-elements only; never the outer `<g transform="translate rotate">`. No backticks in `css` comments.
- `npx vitest run src/<f>.test.ts`; full suite; `npx tsc --noEmit`; `npm run build`.

## Existing code to reuse (read before touching)
- `src/render.ts:602` `renderOpening(o, style)` — the swing-door, double-casement-window, and slider bodies are the templates to copy the idiom from. `openingMotion` (415), `openingDefaultOpen` (426), `openingMirror` (437), `sliderStyleOf` (445), `SLIDING_DEVICE_CLASSES` (451), `openingFromDeviceClass` (468), `resolveOpeningOpen` (514).
- `src/types.ts:49` `OpeningType`, `:55` `Opening`.
- `src/validate.ts` — the opening shape validator.
- `src/editor-forms.ts` — `openingForm` (motion/sliderStyle selects).
- CSS: opening classes live in both `src/floorplan-card.ts` and `src/editor.ts` style blocks (`fp-door-leaf`, `fp-leaf-r`, `fp-slide-panel`, `fp-door-arc`).

---

## Task 1 (Fable): Design the three door symbols

**Model: fable. Skill: frontend-design.** Read `renderOpening` (`src/render.ts:602-731`) in full to internalize the idiom (jambs, leaf rects, swing arcs drawn on via `stroke-dashoffset`, `amt`-driven `transform`, `tone`, CSS classes, the `openingMirror` scale wrapper applied by the caller — you design only the centered `body`). Design each, open↔closed, `amt`-aware, in the same language. Deliver paste-ready `body` SVG + any new CSS classes/keyframes to `docs/superpowers/specs/reactive-doors.md`:

- **Double door** (`door`, `swing`, `swingStyle: "double"`): two solid leaves, one hinged at each jamb, meeting at the centre when closed and each swinging to −90°·`amt` into the room (opposite senses, so they open like the existing double-casement window but as solid doors). Two swing arcs drawn from centre outward via `stroke-dashoffset` (reuse the window-casement arc maths: `arcLen = (π/2)·half`). Left leaf class `fp-door-leaf`, right leaf class `fp-leaf-r`, matching today so transitions work.
- **Garage door** (`door`, `motion: "roll"`): a sectional door filling the opening. Closed = the full `o.length` span drawn as a panel with ~3–4 evenly spaced **section lines** across it (segmented look) between the jambs. Open (`amt`→1) = the panel clears the opening (it rolls up out of plane) — represent "cleared" tastefully in top-down 2D: fade/retract the panel to a thin residual line at one jamb, or reduce its opacity toward 0, whatever reads as "car can pass." `amt` drives it continuously (a `cover` at 50% shows a half-cleared door). New class e.g. `fp-garage-panel`. Keep the segment lines part of the moving panel so they clear with it.
- **Bi-fold door** (`door`, `motion: "fold"`, `foldPanels` 2 or 4): equal-width leaves hinged in a chain; closed they lie flat across the opening, open (`amt`→1) they concertina against one jamb (alternating fold directions — the classic zigzag). Design for `foldPanels: 4` (and note how it degrades to 2). Use CSS `transform` on nested `<g>` hinge groups so `amt` folds them; new class(es) e.g. `fp-fold-panel`. Solid leaf weight (2.5).

For each: the exact centered `body` template (using `half`, `cutH`, `amt`, `tone`, `color`), the new CSS classes/transitions for both style blocks, a `prefers-reduced-motion` note (openings already transition; state that partial-open still renders statically), and one line on how `active`/`accent` tint applies (moving parts use `tone`). Commit only that file, no footer, no push.

## Task 2 (sonnet): Data model + editor form

Per `docs/superpowers/specs/reactive-doors.md` and the model section above:
1. `src/types.ts`: widen `Opening.motion` union to add `"roll" | "fold"`; add `swingStyle?: "single" | "double"` and `foldPanels?: 2 | 4` with doc comments.
2. `src/render.ts`: widen `openingMotion`'s return type; add `swingStyleOf(o): "single" | "double"` (returns `o.swingStyle ?? "single"` only for swing doors, else `"single"`) mirroring `sliderStyleOf`; add `foldPanelsOf(o): 2 | 4` (`o.foldPanels ?? 4`). Update `openingFromDeviceClass` so `device_class: "garage"` returns `{ motion: "roll" }` (add a `GARAGE_DEVICE_CLASSES`/branch; keep the other rolling classes on `slide`). Leave `openingDefaultOpen` as-is (roll/fold are non-swing → default closed, correct).
3. `src/validate.ts`: extend the opening validator — `motion` oneOf now includes `roll`/`fold`; add optional `swingStyle` oneOf(single,double) and `foldPanels` oneOf(2,4).
4. `src/editor-forms.ts` `openingForm`: add `roll`/`fold` to the motion select; add a `swingStyle` select shown for swing doors and a `foldPanels` select shown for fold — mirror how `sliderStyle` is conditionally surfaced.
5. `npm run schema` → commit the additive diff. TDD: `validate.test.ts` accepts a garage (`motion:"roll"`) and a double door (`swingStyle:"double"`) and a bifold; `render.test.ts`/helper tests for `swingStyleOf`/`foldPanelsOf`/`openingFromDeviceClass("garage")`. Commit by explicit path.

## Task 3 (sonnet): Render the three symbols

Per the spec, in `renderOpening` (`src/render.ts`):
1. Add a **double-swing** branch: when `o.type === "door" && openingMotion(o) === "swing" && swingStyleOf(o) === "double"`, emit Fable's two-leaf body (before the existing single-door `else`). The existing single swing-door path stays the default.
2. Add a **`motion === "roll"`** branch (garage) and a **`motion === "fold"`** branch (bifold), each emitting Fable's body. Place them alongside the existing `slide` branch.
3. Add the new CSS classes/transitions to BOTH `src/floorplan-card.ts` and `src/editor.ts` opening style blocks. No backticks in css comments.
4. Tests (`render.test.ts`): a double door renders two leaves (`fp-door-leaf` + `fp-leaf-r`) and two arcs; a garage (`motion:"roll"`) renders the segmented panel and clears with `amt`; a bifold renders `foldPanels` leaves; each closed vs open (`amount` 0 vs 1) differs; a plain single door is unchanged. Reuse the existing renderOpening test helpers. Commit by explicit path. `npm run build` must stay green.

## Task 4 (controller): Verify live + gate + WORKLOG
- Build + install markers + full suite + tsc.
- Dev harness + mock hass: drop a double door, a garage door bound to a `cover` (device_class garage → motion roll auto), a bi-fold; toggle the cover open/closed and confirm each animates (leaves swing / panel clears / leaves fold) and tints via `active`. A pre-existing single door/window is visually unchanged.
- WORKLOG; proceed to Phase 5.
