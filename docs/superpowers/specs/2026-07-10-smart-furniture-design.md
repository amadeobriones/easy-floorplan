# Smart Furniture + Organized Add Menu + Reactive Glyphs — Design

**Goal:** Turn furniture from static decoration into optionally **live, state-reactive,
controllable** elements (like doors/windows delight the user), reorganize the Add menu into
a searchable, grouped, scrolling picker, expand the catalog, and — for a chosen few — draw
door/window-level **bespoke animated glyphs**. Built in three phases, each shippable.

**Design labor split:** the *visual* work — new furniture SVG glyphs, the bespoke reactive
shapes, any icons, and the Add-menu look — is done by **Fable-model subagents** (`model:
fable`) using the **frontend-design** skill, each given the existing `renderFurniture`
symbols as the style reference. The *plumbing* — types, entity/stateStyles/action wiring,
validator/enum, integration, tests — is done by standard (sonnet) subagents. Same
subagent-per-task + review loop either way.

## Current model (what we're changing)

Three element kinds today:
- **Openings** (doors/windows): entity-bound, the *geometry* reacts (leaf swings by amount,
  cover fills). Bespoke per motion in `renderOpening`. This is the delight to generalize.
- **Items** (devices): entity-bound icon **badge** — tint/pulse via `stateStyles`, state
  text, tap-to-control via `handleAction`. Generic, but a circle marker, not the object.
- **Furniture**: `{id,type,x,y,w,h,angle,color?}`, drawn by `renderFurniture` as a base
  shape + type detail in `color ?? FURNITURE_COLOR`. **No entity, no state.**

The engines to reuse already exist on `main`: `resolveStateStyle`/`stateStyleMatches`
(conditional colour/animation/icon), the `stateStyles` **repeater** (`_renderStateStyleRows`,
room+item), the action-handler + `handleAction` (item tap/hold/double), and the item badge
render.

---

## Phase 1 — Smart furniture (foundation; mostly plumbing, sonnet)

**Data (`src/types.ts`):** `Furniture` gains optional `entity?`, `secondaryEntity?`,
`stateStyles?: StateStyle[]`, `tap_action?`/`hold_action?`/`double_tap_action?`
(`ActionConfig`), `showState?`. No change to existing fields; all additive.

**Render (`src/render.ts` + `src/floorplan-card.ts`):**
- `renderFurniture(f, resolved?)` — accept an optional resolved style. When a `stateStyles`
  rule matches (resolved via `resolveStateStyle(f.stateStyles, hass, f.entity)`), its
  `color` tints the base+detail (replacing `FURNITURE_COLOR`), and its `animation`
  (pulse/blink) adds the same CSS class furniture… items use. With no entity/match, output
  is byte-identical to today.
- The card wraps a furniture piece that has an `entity` in a tappable `<g>` (a transparent
  hit-rect over its bounds, like openings) wired to `handleAction`; and, when `showState`
  (or a resolved `icon`) is set, overlays the **item badge** (icon + optional state text) at
  the furniture centre — reusing the item badge render so it looks consistent.

**Editor (`src/editor-forms.ts` + `src/editor.ts`):** `furnitureForm` gains an `entity`
picker and `showState`; the furniture selection editor renders the **existing stateStyles
repeater** (`_renderStateStyleRows(f.stateStyles ?? [], "furniture", f.id, f.entity)`) and
the action rows — so `_renderStateStyleRows`/`_stateElement`/`_patchStateStyles` extend from
`"room"|"item"` to include `"furniture"` (small union widening + a `furniture` branch in
`_patchStateStyles` → `_updateFurniture`/`_updateFurnitureLive`).

**Validator (`src/validate.ts`):** the furniture shape gains the optional `entity`,
`stateStyles` (an array of the rule shape), and action fields.

**Tests:** `resolveStateStyle` already tested; add tests that `renderFurniture` tints when a
rule matches and is unchanged with no entity (via the `serialize` helper pattern);
`furnitureForm` exposes `entity`/`showState`; validator accepts a smart-furniture config.
The one visual judgment (how the tint/badge/pulse looks on a shape) is a small **Fable**
task with the existing symbols as reference.

---

## Phase 2 — Organized Add menu + catalog additions (Fable visuals + sonnet wiring)

**Menu (`_renderAddMenu`, `src/editor.ts`):** replace the flat grid with a **search box** +
**collapsible category sections** (function/type groups) + a glyph grid per section, the
whole popover **scrolling** when tall. Typing filters across sections and auto-expands
matches. Device + Text become their own top "Devices & text" section. Category → types map
(a data table, so it stays declarative):
- **Seating & beds:** chair, sofa, sectional, bed, `armchair`, `bench`, `crib`
- **Tables & desks:** table, roundTable, desk, `coffee table`, `nightstand`
- **Storage:** wardrobe, `dresser`, `bookshelf`, `cabinet`
- **Appliances:** fridge, stove, dishwasher, washer, dryer, waterHeater, airHandler, **tv**,
  `microwave`
- **Fixtures:** sink, toilet, bathtub, vanity, `shower`, `bidet`
- **Decor & misc:** rug, plant, stairs, `fireplace`

(`code font` = new glyph to draw. `tv` moved to Appliances per request.) The exact final set
of additions is confirmed at plan time; ~12 above.

**Glyphs:** each new `FurnitureType` needs a `renderFurniture` case, a `FURNITURE_DEFAULT_SIZE`,
a `FURNITURE_LABELS` entry, the enum in `types.ts` + the runtime arrays in `editor-forms.ts`
and `validate.ts`. The SVG for each is a **Fable** task (given the family style); a sonnet
task wires it in with the enum/size/label/validator/tests + the `REQUIRED_IN_BUNDLE` install
marker if we want one.

**Menu UI look** (layout, spacing, the search field, collapse affordance): a **Fable** task
(frontend-design skill) producing the markup+CSS, integrated by sonnet.

---

## Phase 3 — Bespoke reactive glyphs (Fable craft + sonnet wiring)

For a chosen few appliances, a door/window-style **state-reactive** shape drawn to animate
with its entity — e.g. washer/dryer drum rotating while running, TV screen glowing when on,
fireplace flickering, robot-vacuum docked/away. Each is a per-type render variant
(`renderFurniture` branches on state when the type has a reactive glyph and an entity),
mirroring how `renderOpening` animates by `amount`. Candidates (final set at plan time):
washer, dryer, tv, fireplace, and a new `robotVacuum`/dock.

**Each reactive glyph is a Fable task** (the animation design + the SVG/CSS), with sonnet
wiring the state→variant selection + a test that the reactive branch fires on the right
state. Landmine (carried from #33/the animations): animate the `scale`/transform on the
inner shape, never on a wrapper the plate/positioning owns; no backticks in `css` comments.

---

## Phase 4 — More door types (openings; Fable craft + sonnet wiring)

Extend openings beyond single swing/slide door + window with a **curated, not-overdone** set
of new door kinds, each a bespoke state-reactive glyph in `renderOpening` (the same
animate-by-`amount` mechanism), bound to a `cover`/`binary_sensor`:
- **Double / French doors** — two leaves swinging from the centre (biparting swing;
  distinct from the existing biparting *slide*).
- **Garage door** — a wide sectional/roll-up opening; drawn as segmented panels, open state
  rolls/clears the span (a `cover` with position).
- Likely also: **pocket door** (slides into the wall, panel vanishes) and/or **bi-fold**
  (folding panels). Final set confirmed at plan time; kept small.

Modeled as new `motion`/`style` values (or a `door` sub-kind) on `Opening`, so it reuses the
existing opening entity/state/tap plumbing. Each glyph + its open/close animation is a
**Fable** task; sonnet wires the type/state selection, the editor `openingForm` options, the
validator enum, and tests.

## Fork hygiene

One branch per phase off `main` (`feat/smart-furniture`, `feat/furniture-menu`,
`feat/furniture-reactive-glyphs`), each droppable. Nothing goes outward — no PR/issue/comment
to upstream. No `Co-Authored-By`/"Generated with" footers. Fable subagents inherit the same
constraints in their dispatch prompts.

## Sequencing

Phase 1 first (unblocks state on furniture), then Phase 2 (catalog + menu — the new smart
appliances slot into the reorganized picker), then Phase 3 (the bespoke delight on top).
Each phase: spec is this doc's section → its own implementation plan → subagent build (Fable
for visuals, sonnet for plumbing) → per-task + whole-branch review → live verification.
