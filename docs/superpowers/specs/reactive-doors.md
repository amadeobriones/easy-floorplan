# Reactive doors — double, garage, bi-fold

Design spec for three new door symbols rendered by `renderOpening(o, style)`
(`src/render.ts`). Each is a centered `body` in the existing opening language:
jambs at `x = ±half`, moving parts in `tone`, open↔closed driven continuously
by `amt` (0..1) via inline CSS transforms on CSS-classed groups that the host
stylesheets transition over 0.5 s. This spec delivers the `body` templates, the
new CSS classes for **both** style blocks (card + editor), and the config
surface that selects each symbol. Wiring (types, editor UI, entity inference)
is out of scope here beyond the notes in §0.

**Design stance.** Same clean line-art as the single swing door and the
sliders: solid leaves at weight 2.5, jambs static in `color`, one honest plan
convention per symbol. The double door borrows the double-casement window's
butterfly. The garage door leans on the architectural "dashed = above the cut
plane" convention: as the panel rolls up out of the 2D plane it retracts and
fades, leaving a dashed header line that says *drive through*. The bi-fold is
a true hinged concertina — every intermediate `amt` is an exact fold pose, and
so is every frame of the 0.5 s tween (see §3, this is the one place the spec
departs from naive nesting, for a load-bearing reason).

Validated geometry: all three symbols were rendered at `amt` = 0 / 0.35 / 0.7 /
1 with the exact math below (attribute-transform equivalents) and read
correctly at floorplan scale, including the fully-open poses.

---

## 0. Shared contract and config surface

- Everything below is the **centered `body` only**. The caller wraps it in
  `translate(o.x o.y) rotate(o.angle)` and the `openingMirror` `scale(sx sy)`
  wrapper — no template adds its own placement transform. `flipH` / `flipV`
  therefore come for free (per-symbol reads in each section).
- `half = o.length / 2`, `cutH = WALL_THICKNESS + 4`, `tone = active ? accent
  : color`, `amt = clamp(style.amount ?? (open ? 1 : 0), 0, 1)` — all already
  computed at the top of `renderOpening`.
- The card's tap target (`.fp-opening-hit`, a static rect over the opening
  span) is untouched; all three symbols stay tappable at any `amt`.

Config surface (additions to `Opening` in `src/types.ts`, mirroring the
`motion` / `sliderStyle` pattern):

```ts
/** How the opening moves. New: "roll" (sectional/garage), "fold" (bi-fold). */
motion?: "swing" | "slide" | "roll" | "fold";
/**
 * Swing doors only: leaf arrangement. "double" draws two half-width leaves,
 * one hinged at each jamb, meeting at the centre (French doors). Ignored for
 * windows and for non-swing motions.
 */
doorStyle?: "single" | "double";
/**
 * Folding openings only ("fold"): number of equal leaves in the hinge chain.
 * Must be even so the free end rides the track; 2 (default) or 4.
 */
foldPanels?: 2 | 4;
```

Resolvers, alongside `sliderStyleOf`:

```ts
export function doorStyleOf(o: Opening): "single" | "double" {
  return o.type === "door" && openingMotion(o) === "swing"
    ? (o.doorStyle ?? "single")
    : "single";
}

export function foldPanelsOf(o: Opening): 2 | 4 {
  return o.foldPanels === 4 ? 4 : 2;
}
```

Branch order inside `renderOpening` (double door slots into the existing swing
logic; roll and fold are new `openingMotion` branches before the final
single-swing fallback):

- `o.type === "window" && swing` → existing casement (unchanged; §1 notes the
  intentional geometry share).
- `swing && doorStyleOf(o) === "double"` → §1.
- `slide` → existing sliders (unchanged).
- `roll` → §2.
- `fold` → §3.
- fallback → existing single swing door (unchanged).

Entity inference note: `openingDefaultsForDeviceClass` should map the HA
`cover` device class `garage` to `{ type: "door", motion: "roll" }` the same
way the sliding classes map to `slide` today. Nothing infers `fold` or
`double` — those are explicit config.

Class inventory introduced by this spec:

| class | element | drive |
|---|---|---|
| `fp-door-leaf`, `fp-leaf-r`, `fp-door-arc` | double-door leaves + arcs | reused as-is, no CSS changes |
| `fp-garage-panel` | `<g>` holding the sectional panel + its joint ticks | `transform: scaleX(1-amt)` + `opacity: 1-amt` |
| `fp-fold-panel` | one `<g>` per bi-fold leaf (flat siblings) | chained `rotate() translate() rotate()...` transform list |

---

## 1. Double door — two leaves, butterfly open

**How it reads.** Closed: one solid bar across the opening, a hairline meeting
seam at centre. Opening: both leaves swing into the room in opposite senses
(`-90·amt` about the left jamb, `+90·amt` about the right — same signs as the
casement window, which the SVG mirror wrapper flips per `flipV`), while two
quarter-circle arcs of radius `half` draw on from the meeting stile outward.
Fully open: a butterfly — both leaves flat against the wall, arcs landing on
the jambs.

This is deliberately the same geometry as the double-casement window body
(`render.ts` swing-window branch): a French door and a casement pair *are* the
same plan symbol. Implementation may either extend that branch's condition to
`(o.type === "window" || doorStyleOf(o) === "double")` or extract a shared
`doubleSwingBody(half, cutH, amt, tone, color)` — either way, byte-identical
output for existing windows.

```ts
// Double door: two solid leaves, one hinged at each jamb, meeting at centre.
const arcLen = (Math.PI / 2) * half;
body = svg`
    <!-- jambs -->
    <line x1=${-half} y1=${-cutH / 2} x2=${-half} y2=${cutH / 2}
          stroke=${color} stroke-width="2" />
    <line x1=${half} y1=${-cutH / 2} x2=${half} y2=${cutH / 2}
          stroke=${color} stroke-width="2" />
    <!-- swing arcs, drawn from the meeting stile outward -->
    <path class="fp-door-arc" d="M 0 0 A ${half} ${half} 0 0 0 ${-half} ${-half}"
          fill="none" stroke-width="1.5" stroke-dasharray=${arcLen}
          style="stroke:${tone};stroke-dashoffset:${arcLen * (1 - amt)};" />
    <path class="fp-door-arc" d="M 0 0 A ${half} ${half} 0 0 1 ${half} ${-half}"
          fill="none" stroke-width="1.5" stroke-dasharray=${arcLen}
          style="stroke:${tone};stroke-dashoffset:${arcLen * (1 - amt)};" />
    <!-- left leaf, hinged at left jamb -->
    <g transform="translate(${-half} 0)">
      <g class="fp-door-leaf" style="transform:rotate(${-90 * amt}deg);">
        <rect x="0" y="-1.25" width=${half} height="2.5" style="fill:${tone};" />
      </g>
    </g>
    <!-- right leaf, hinged at right jamb -->
    <g transform="translate(${half} 0)">
      <g class="fp-leaf-r" style="transform:rotate(${90 * amt}deg);">
        <rect x=${-half} y="-1.25" width=${half} height="2.5" style="fill:${tone};" />
      </g>
    </g>
  `;
```

- **CSS**: none new. `fp-door-leaf` / `fp-leaf-r` / `fp-door-arc` transitions
  (already in both style blocks) apply unchanged.
- **Mirrors**: `flipH` is a visual no-op (the symbol is symmetric); `flipV`
  swings the pair into the other room.
- **Tint**: both leaf rects and both arcs carry `tone`, so an active entity
  turns the whole moving pair accent while the jambs stay `color`.
- **Reduced motion**: nothing to add — see §5.

---

## 2. Garage door (`motion: "roll"`) — sectional panel that clears

**How it reads.** Closed: a solid full-span panel between the jambs, divided
by three evenly spaced joint ticks into four sections — unmistakably a
sectional garage door, not a wall. Opening: the panel retracts toward the left
jamb (`scaleX(1-amt)` about the jamb) while fading (`opacity: 1-amt`); the
ticks live inside the scaling group, so the sections visibly bunch up toward
the jamb like a door gathering onto its roll. As the panel thins, a faint
dashed line across the span emerges from underneath — the standard plan
convention for something overhead. Fully open: jambs + dashed header only; the
gap reads "car can pass". A cover at position 0.5 shows the right half of the
opening clear.

The ticks run `y = -2.5 .. 2.5` — proud of the 2.5-weight panel for the
segmented read, still well inside the wall cut (`cutH/2 = 6`). Three ticks are
fixed: this is a symbol, not a scale drawing, and four sections read as
"garage" at any plausible opening length.

```ts
// Sectional roll-up door (garage). Closed: a full-span panel with section
// joints. Open: the panel rolls up out of the cut plane -- drawn as a
// retract-toward-the-jamb + fade, uncovering the dashed overhead-track line.
const seg = o.length / 4;
const clear = 1 - amt;
body = svg`
    <!-- jambs -->
    <line x1=${-half} y1=${-cutH / 2} x2=${-half} y2=${cutH / 2}
          stroke=${color} stroke-width="2" />
    <line x1=${half} y1=${-cutH / 2} x2=${half} y2=${cutH / 2}
          stroke=${color} stroke-width="2" />
    <!-- overhead track: dashed = above the cut plane; shows once the panel clears -->
    <line x1=${-half} y1="0" x2=${half} y2="0" stroke=${color}
          stroke-width="0.75" stroke-dasharray="4 3" opacity="0.35" />
    <!-- sectional panel: joints ride inside so the sections clear with it -->
    <g class="fp-garage-panel" style="transform:scaleX(${clear});opacity:${clear};">
      <rect x=${-half} y="-1.25" width=${o.length} height="2.5" style="fill:${tone};" />
      ${[1, 2, 3].map(
        (k) => svg`<line x1=${-half + k * seg} y1="-2.5" x2=${-half + k * seg}
              y2="2.5" stroke-width="1" style="stroke:${tone};" />`
      )}
    </g>
  `;
```

- **New CSS** (§4): `.fp-garage-panel` with `transform-box: fill-box;
  transform-origin: left center` — the group's content is static (rect spans
  `-half..half`, ticks are symmetric about `y = 0`), so the fill-box is
  constant and "left center" is exactly the left jamb at every `amt`.
- **Mirrors**: `flipH` retracts toward the other jamb; `flipV` is a visual
  no-op (symmetric across the wall line).
- **Tint**: panel rect and joint ticks carry `tone` (a garage cover in motion
  or open glows accent); jambs and the dashed header stay `color`.
- **Reduced motion**: nothing to add — the fade is part of the same one-shot
  state transition; see §5.

---

## 3. Bi-fold door (`motion: "fold"`) — hinged concertina

**How it reads.** Closed: `n` equal leaves lying flat across the opening over
a thin track line (the slider-family cue — a bi-fold is track-borne, and the
track keeps the closed symbol distinguishable from the garage panel). Opening:
the chain concertinas against the left jamb in the classic alternating zigzag
— leaf 1 tips into the room, leaf 2 folds back against it, and every
even-numbered hinge knuckle stays gliding along the track, exactly like the
real mechanism. Fully open: a compact zigzag bundle at the jamb occupying
about a sixth of the span, with the track line showing the cleared doorway.

**Fold angle.** `a = 80 * amt` degrees, not 90: at a full 90° the leaves
collapse into a single perpendicular bar and the concertina identity vanishes.
Capping at 80° keeps a legible zigzag fully open (the classic architectural
bi-fold symbol) while clearly reading "clear" — the bundle hugs the jamb.
Name it `FOLD_MAX_DEG = 80` next to the template.

**Kinematics — why flat siblings with transform lists, not nested hinge
groups.** The obvious structure (each leaf's `<g>` nested inside the previous
leaf, each rotating `±2a` about its hinge) breaks the family's
`transform-box: fill-box` idiom: a rotating group that contains downstream
panels has an `amt`-dependent bounding box, so `transform-origin: left center`
drifts off the hinge pin and the chain shears. Instead each leaf is a **flat
sibling** `<g class="fp-fold-panel">` containing *only its own rect*
(fill-box = the rect, so "left center" is exactly the leaf's hinge end,
always), and the whole hinge chain is expressed as a CSS **transform list**:

- leaf 1: `rotate(-a)`
- leaf 2: `rotate(-a) translate(L, 0) rotate(2a)`
- leaf 3: `... translate(L, 0) rotate(-2a)`
- leaf 4: `... translate(L, 0) rotate(2a)`

This is the same matrix chain nesting would produce — leaves land at
alternating absolute angles `-a, +a, -a, +a` — with one decisive bonus: CSS
transitions interpolate matching transform lists **function by function**. The
`translate(L, 0)` terms are constant and the `rotate()` angles lerp, so every
frame of the 0.5 s tween is an *exact* bi-fold pose at the eased angle. Hinges
cannot tear, ever. (Interpolating a flattened `translate(hx, hy) rotate(ak)`
per leaf, by contrast, tears hinges by up to ~0.3·L mid-tween.) The list
structure per leaf is identical between renders — only the angle numbers
change — which is precisely the condition for per-function interpolation.

Invariant for future editors: a `.fp-fold-panel` group must contain exactly
its own leaf rect and nothing else, or the fill-box origin moves off the
hinge.

```ts
// Bi-fold: n equal leaves hinged in a chain, concertina against the left
// jamb. Each leaf is a flat sibling whose CSS transform is the full hinge
// chain up to that leaf; matching list structures make the 0.5s transition
// interpolate every frame as an exact fold pose (see reactive-doors spec).
const FOLD_MAX_DEG = 80; // full open keeps a legible zigzag, not a flat bar
const n = foldPanelsOf(o); // 2 | 4
const L = o.length / n;
const a = FOLD_MAX_DEG * amt;
let chain = "";
const leaves: SVGTemplateResult[] = [];
for (let k = 1; k <= n; k++) {
  chain +=
    k === 1
      ? `rotate(${-a}deg)`
      : ` translate(${L}px, 0px) rotate(${(k % 2 ? -2 : 2) * a}deg)`;
  leaves.push(svg`
      <g class="fp-fold-panel" style="transform:${chain};">
        <rect x="0" y="-1.25" width=${L} height="2.5" style="fill:${tone};" />
      </g>`);
}
body = svg`
    <!-- jambs -->
    <line x1=${-half} y1=${-cutH / 2} x2=${-half} y2=${cutH / 2}
          stroke=${color} stroke-width="2" />
    <line x1=${half} y1=${-cutH / 2} x2=${half} y2=${cutH / 2}
          stroke=${color} stroke-width="2" />
    <!-- track -->
    <line x1=${-half} y1="0" x2=${half} y2="0"
          stroke=${color} stroke-width="0.75" opacity="0.6" />
    <g transform="translate(${-half} 0)">${leaves}</g>
  `;
```

- **`foldPanels: 2` degrade**: the same loop emits two half-span leaves —
  one fold peak instead of two, taller (peak height `L·sin80° ≈ 0.49·o.length`
  vs `≈ 0.25` for four panels). Nothing else changes; `n` stays even so the
  free end rides the track. Default is 2 (the archetypal bi-fold); 4 suits
  wide closet/patio runs.
- **New CSS** (§4): `.fp-fold-panel`, same recipe as `fp-door-leaf`.
- **Mirrors**: `flipH` stacks the concertina against the right jamb; `flipV`
  folds it into the far room.
- **Tint**: every leaf rect carries `tone`; jambs and track stay `color`, so
  an active bi-fold is an accent-colored zigzag over a quiet track.
- **Reduced motion**: nothing to add — see §5.

---

## 4. CSS additions — both style blocks

Add to `src/floorplan-card.ts` static styles immediately after the
`.fp-slide-panel rect` rule, and to `src/editor.ts` static styles immediately
after the `.fp-door-arc` rule (the two blocks that already carry the
`fp-door-leaf` / `fp-leaf-r` / `fp-slide-panel` recipes — keep the two copies
identical, as today):

```css
/* Garage panel: retracts toward the hinge-side jamb (scaleX about the left
   jamb via fill-box left center; the group content is static so the box is
   stable) and fades as the door rolls up out of the cut plane. */
.fp-garage-panel {
  transform-box: fill-box;
  transform-origin: left center;
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.fp-garage-panel rect {
  transition: fill 0.5s ease;
}
.fp-garage-panel line {
  transition: stroke 0.5s ease;
}
/* Bi-fold leaf: each group holds exactly one leaf rect, so fill-box left
   center is the hinge end; the transform is the whole chained hinge list,
   which transitions per-function -- every tween frame is a true fold pose. */
.fp-fold-panel {
  transform-box: fill-box;
  transform-origin: left center;
  transition: transform 0.5s ease;
}
.fp-fold-panel rect {
  transition: fill 0.5s ease;
}
```

No changes to the existing `fp-door-leaf` / `fp-leaf-r` / `fp-door-arc` /
`fp-slide-panel` rules.

---

## 5. `prefers-reduced-motion`

Family precedent: the card's and editor's reduced-motion blocks disable only
the *infinite ambient* animations (badge pulse/blink, furniture pulse, drum
spin, ripple). The one-shot 0.5 s open/close transition on `fp-door-leaf` and
`fp-slide-panel` is deliberately left running — it is a single state-change
cue, not continuous motion. The three new symbols follow that precedent
exactly: **no additions to either reduced-motion block.** If the project ever
decides doors should snap under reduced motion, all six door/slide/fold/garage
classes must move together in one change — do not special-case the new ones.

---

## 6. State reads at a glance

| symbol | closed (`amt = 0`) | partial (`amt ≈ 0.5`) | open (`amt = 1`) |
|---|---|---|---|
| double | solid bar, centre seam | leaves part from centre, arcs drawing outward | butterfly: leaves on the walls, arcs jamb-to-jamb |
| garage | segmented 4-section panel | panel bunched into left half at half opacity, right half clear over dashes | jambs + dashed overhead line only |
| bi-fold | flat leaves over a track line | shallow zigzag walking toward the jamb, knuckles on the track | compact accent zigzag bundle at the jamb, track shows the cleared doorway |
