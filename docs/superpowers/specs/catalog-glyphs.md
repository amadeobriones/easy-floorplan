# Catalog glyphs — seven new furniture types

Design spec for the smart-furniture catalog expansion: seven new top-down
glyphs for `renderFurniture(f, resolved?, active)`. Three are **reactive**
(ceiling fan, ceiling light, lamp) with a bespoke active-state animation in
the idiom of `docs/superpowers/specs/reactive-glyphs.md`; four are **static**
line art (coffee maker, toaster, range hood, smart speaker) that stay
entity-bindable and tintable through the Phase-1 `stateStyles` layer like any
other piece.

**Design stance.** Same grey architectural line art as the rest of the
family: `FURNITURE_COLOR` stroke, weight 2 for primary structure, 1.5 at
opacity 0.6–0.8 for secondary detail, everything centred at the origin inside
the placement transform. Each glyph is built from the two or three strokes
that make it nameable at menu-thumbnail size, and each reads differently from
its nearest existing neighbour (the fan from the plant, the ceiling light
from the water heater, the toaster from the bench, the hood from the cabinet
and air handler, the speaker from the nightstand). Reactive variants follow
the reactive-glyphs contract exactly: idle/`active === false` output is
byte-identical to the plain glyph, the animated sub-element is an inner child
of `detail`, and only the standalone `rotate` / `opacity` properties ever
animate, with `transform-box: fill-box; transform-origin: center`.

---

## 0. Catalog wiring summary

New `FurnitureType` values (add to the union in `types.ts` and to
`FURNITURE_TYPES` in `editor-forms.ts`):

| type | `FURNITURE_LABELS` | category | `FURNITURE_DEFAULT_SIZE` | reactive |
|---|---|---|---|---|
| `ceilingFan` | `"ceiling fan"` | Lighting & fans | `{ w: 90, h: 90 }` | blades spin (`fp-furn-fan`) |
| `ceilingLight` | `"ceiling light"` | Lighting & fans | `{ w: 36, h: 36 }` | disc glows (`fp-furn-glow`) |
| `lamp` | `"lamp"` | Lighting & fans | `{ w: 40, h: 40 }` | shade glows (`fp-furn-glow`) |
| `coffeeMaker` | `"coffee maker"` | Appliances | `{ w: 34, h: 40 }` | — |
| `toaster` | `"toaster"` | Appliances | `{ w: 34, h: 22 }` | — |
| `rangeHood` | `"range hood"` | Appliances | `{ w: 70, h: 48 }` | — |
| `smartSpeaker` | `"smart speaker"` | Appliances | `{ w: 28, h: 28 }` | — |

Sizes are in the family's cm-flavoured virtual units and sit sensibly against
neighbours: the fan's 90 is its blade-sweep circle (a 36-inch fan, small
enough not to carpet a room by default), the flush mount at 36 tucks beside a
44 chair, the counter appliances cluster under the 50 × 35 microwave, and the
hood at 70 × 48 caps the 64 × 64 stove.

**Add-menu categories** (`FURNITURE_CATEGORIES` in `editor-forms.ts`): a new
category between Appliances and Fixtures — lighting is neither an appliance
nor a plumbing fixture, and these three are the pieces most likely to carry
an entity, so they earn a shelf of their own:

```ts
{ label: "Lighting & fans", types: ["ceilingFan", "ceilingLight", "lamp"] },
```

Appliances gains the four kitchen/counter pieces, clustered with their
kin so the menu scans as cooking → counter → cleaning → utility → media:

```ts
{
  label: "Appliances",
  types: ["fridge", "stove", "rangeHood", "microwave", "coffeeMaker", "toaster",
          "dishwasher", "washer", "dryer", "waterHeater", "airHandler", "tv", "smartSpeaker"],
},
```

(Reordering only regroups the Add menu; nothing else keys off array order.)

**Round bases.** Four of the seven are circular fixtures; they join the
`roundBase` set so the shared ellipse base (fill-opacity 0.12 idle / 0.3
tinted) doubles as their silhouette and hit target:

```ts
const roundBase =
  f.type === "roundTable" || f.type === "plant" || f.type === "waterHeater" ||
  f.type === "ceilingFan" || f.type === "ceilingLight" || f.type === "lamp" ||
  f.type === "smartSpeaker";
```

For the fan the base ellipse **is** the blade-sweep circle — the faint disc a
plan drawing uses to reserve clearance. The other three (coffee maker,
toaster, range hood) keep the default rounded rect.

Class inventory introduced by this spec:

| class | element | animation |
|---|---|---|
| `fp-furn-fan` | `<g>` around the fan blades + trail arcs | `fp-furn-drum-spin` (reused), 1.8 s/rev linear |
| `fp-furn-glow` | lit `<circle>` disc (ceiling light, lamp) | `fp-furn-glow-swell`, 2.6 s opacity swell |

---

## 1. ceilingFan — the blades spin (reactive)

Top-down fan: the base ellipse is the sweep circle, four tapered blades
reach from a static hub to just inside the rim. **Four blades, not three, on
purpose:** the rotating group centres on its `fill-box`, and a 3-fold-
symmetric blade set has an off-centre bounding box — it would visibly wobble.
A 4-blade set (two 180° pairs) has a bounding box centred exactly on the hub,
so the group spins in place with no correction geometry.

One blade is drawn pointing up, gently swept so its trailing edge bows left
(the sweep tells you which way it turns); the other three are static
`rotate()` copies about the glyph centre. Static transform attributes on
inner elements are fine — the reactive contract only forbids *animating* the
transform shorthand and touching the placement group.

Active wraps the blades in `<g class="fp-furn-fan">` and adds **two faint
motion-trail arcs** at tip radius, trailing a blade on each side (a 180° pair,
preserving the centred bounding box). While spinning they read as motion
blur; under reduced motion they are the static cue that idle can never show —
the same role the washer's active-only vanes play. The hub circle stays
outside the group, drawn last so it caps the blade roots.

```ts
case "ceilingFan": {
  const r = Math.min(hw, hh);
  // One blade pointing up, trailing edge bowed left; three rotate() copies.
  const blade = `M ${-r * 0.08} ${-r * 0.2} C ${-r * 0.2} ${-r * 0.45} ${-r * 0.24} ${-r * 0.68} ${-r * 0.14} ${-r * 0.88} Q ${-r * 0.02} ${-r * 0.98} ${r * 0.06} ${-r * 0.85} C ${r * 0.12} ${-r * 0.62} ${r * 0.1} ${-r * 0.4} ${r * 0.06} ${-r * 0.2} Z`;
  // Trail arc at 0.88 r spanning 235..262 deg, just behind the up blade for
  // clockwise rotation (cos/sin of 235 and 262 deg premultiplied by 0.88:
  // -0.574/-0.819 -> -0.505/-0.721, -0.139/-0.990 -> -0.122/-0.871).
  const trail = `M ${-r * 0.505} ${-r * 0.721} A ${r * 0.88} ${r * 0.88} 0 0 1 ${-r * 0.122} ${-r * 0.871}`;
  const blades = svg`
    <path d=${blade} fill="none" stroke=${color} stroke-width="2" />
    <path d=${blade} transform="rotate(90)" fill="none" stroke=${color} stroke-width="2" />
    <path d=${blade} transform="rotate(180)" fill="none" stroke=${color} stroke-width="2" />
    <path d=${blade} transform="rotate(270)" fill="none" stroke=${color} stroke-width="2" />`;
  detail = active
    ? svg`
    <g class="fp-furn-fan">
      ${blades}
      <path d=${trail} fill="none" stroke=${color} stroke-width="1.5" opacity="0.45" />
      <path d=${trail} transform="rotate(180)" fill="none" stroke=${color} stroke-width="1.5" opacity="0.45" />
    </g>
    <circle cx="0" cy="0" r=${r * 0.15} fill="none" stroke=${color} stroke-width="2" />`
    : svg`
    ${blades}
    <circle cx="0" cy="0" r=${r * 0.15} fill="none" stroke=${color} stroke-width="2" />`;
  break;
}
```

**Speed.** 1.8 s per revolution, linear, continuous — twice the washer drum's
3.6 s, which is the point: air moves faster than laundry, and the pair should
never be mistaken for each other on one card. With four blades a blade passes
a fixed point every 0.45 s — unmistakably "spinning", still well short of
strobing at glyph scale. The keyframes are the drum's own full-revolution
`fp-furn-drum-spin`, reused at the shorter duration rather than duplicated.

**Reduced motion:** blades hold still but the trail arcs render — a fan
carrying its motion cue. Idle never shows the arcs, so the static pose still
reads active.

**Tint composition:** blades, trails and hub all stroke with `${color}`; a
resolved rule colour spins the whole rotor in the rule colour.

## 2. ceilingLight — the disc glows (reactive)

A flush mount seen from below-the-plan: the base ellipse is the fixture rim,
inside it a concentric diffuser ring, four short orthogonal ticks from ring
to rim (the canopy mounting), and a small centre circle for the bulb. The
orthogonal ticks and the ring keep it apart from the water heater (single
small inner ring), the shower (corner diagonals) and the smart speaker (dot
grille).

Active slips a **lit disc** under the line work — a filled circle inside the
diffuser ring with the new `fp-furn-glow` class, swelling in opacity exactly
the way the TV's `fp-furn-screen` does. Drawn first in `detail` so the ring,
ticks and bulb stay crisp on top of the light.

```ts
case "ceilingLight": {
  const m = Math.min(hw, hh);
  const ring = svg`
    <circle cx="0" cy="0" r=${m * 0.6} fill="none" stroke=${color} stroke-width="1.5" opacity="0.7" />
    <line x1="0" y1=${-m * 0.6} x2="0" y2=${-m * 0.86} stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${m * 0.6} y1="0" x2=${m * 0.86} y2="0" stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1="0" y1=${m * 0.6} x2="0" y2=${m * 0.86} stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${-m * 0.6} y1="0" x2=${-m * 0.86} y2="0" stroke=${color} stroke-width="1.5" opacity="0.6" />
    <circle cx="0" cy="0" r=${m * 0.1} fill="none" stroke=${color} stroke-width="1.5" />`;
  detail = active
    ? svg`
    <circle class="fp-furn-glow" cx="0" cy="0" r=${m * 0.5} fill=${color} />
    ${ring}`
    : ring;
  break;
}
```

**Reduced motion:** the swell stops at the class's resting `opacity: 0.25` —
a steadily lit fixture, clearly distinct from the empty idle ring.

**Tint composition:** the disc fills with `${color}`, so a rule colour makes
the fixture pour that colour — the natural pairing with a room polygon tinted
by the same light entity.

## 3. lamp — the shade glows (reactive)

A table/floor lamp from above: the base ellipse is the shade, four diagonal
seam ribs (45°-family, from 0.38 r to 0.80 r; 0.27/0.57 are those radii times
cos 45°) and a centre circle for the column/finial. Diagonal ribs versus the
ceiling light's orthogonal ticks — the two lighting glyphs stay tellable at a
squint, and the ribs are straight hairlines so nobody confuses them with the
fan's fat curved petals.

Active lights the **whole shade**: a `fp-furn-glow` disc at 0.78 r under the
ribs, because a lampshade glows across its surface where a flush mount glows
in its lens. Same class, same swell; the silhouette does the distinguishing.

```ts
case "lamp": {
  const m = Math.min(hw, hh);
  const shade = svg`
    <line x1=${m * 0.27} y1=${m * 0.27} x2=${m * 0.57} y2=${m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${-m * 0.27} y1=${m * 0.27} x2=${-m * 0.57} y2=${m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${m * 0.27} y1=${-m * 0.27} x2=${m * 0.57} y2=${-m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${-m * 0.27} y1=${-m * 0.27} x2=${-m * 0.57} y2=${-m * 0.57} stroke=${color} stroke-width="1.5" opacity="0.6" />
    <circle cx="0" cy="0" r=${m * 0.14} fill="none" stroke=${color} stroke-width="1.5" />`;
  detail = active
    ? svg`
    <circle class="fp-furn-glow" cx="0" cy="0" r=${m * 0.78} fill=${color} />
    ${shade}`
    : shade;
  break;
}
```

**Reduced motion:** steady lit shade at `opacity: 0.25`, ribs intact on top.

**Tint composition:** disc and ribs share `${color}` — a warm-white or
colour-loop rule tints the glowing shade directly.

## 4. coffeeMaker — static

Drip machine on the counter, tower at the back (-y, matching the family's
back-at-top convention): a full-width line marks the reservoir tower's front
edge, a circle is the carafe sitting under the brew head, and a stub off the
carafe's right side is its handle. The handle stub and the smaller,
lower-set circle keep it well away from the washer (top line + large centred
drum + corner dial).

```ts
case "coffeeMaker": {
  const cr = Math.min(w, h) * 0.28;
  detail = svg`
    <line x1=${-hw + w * 0.08} y1=${-hh + h * 0.28} x2=${hw - w * 0.08} y2=${-hh + h * 0.28}
          stroke=${color} stroke-width="1.5" opacity="0.7" />
    <circle cx="0" cy=${h * 0.18} r=${cr} fill="none" stroke=${color} stroke-width="2" />
    <line x1=${cr} y1=${h * 0.18} x2=${cr + w * 0.12} y2=${h * 0.18}
          stroke=${color} stroke-width="1.5" />`;
  break;
}
```

## 5. toaster — static

Two rounded slots running lengthwise, offset toward the left so the lever
knob (a small circle) gets the right end to itself. Slot *rectangles* with
visible width — not hairlines — so it never reads as the bench's two slat
lines, and the knob breaks the symmetry the bench keeps.

```ts
case "toaster":
  detail = svg`
    <rect x=${-hw + w * 0.08} y=${-h * 0.24} width=${w * 0.64} height=${h * 0.16} rx="2"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />
    <rect x=${-hw + w * 0.08} y=${h * 0.08} width=${w * 0.64} height=${h * 0.16} rx="2"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />
    <circle cx=${hw - w * 0.12} cy="0" r=${Math.min(w, h) * 0.09}
            fill="none" stroke=${color} stroke-width="1.5" />`;
  break;
```

## 6. rangeHood — static

A canopy hood seen from above: a small duct box centred at the back wall
edge, and two funnel lines running from the front corners up to the duct's
base — the trapezoid convergence is what says "extractor over a range" rather
than "cabinet" (one diagonal) or "air handler" (an X). Place it overlapping
the stove and the pairing is immediate.

```ts
case "rangeHood":
  detail = svg`
    <rect x=${-w * 0.14} y=${-hh + h * 0.1} width=${w * 0.28} height=${h * 0.34} rx="2"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />
    <line x1=${-hw + w * 0.08} y1=${hh - h * 0.1} x2=${-w * 0.14} y2=${-hh + h * 0.44}
          stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${hw - w * 0.08} y1=${hh - h * 0.1} x2=${w * 0.14} y2=${-hh + h * 0.44}
          stroke=${color} stroke-width="1.5" opacity="0.6" />`;
  break;
```

## 7. smartSpeaker — static

A round puck with a quincunx of grille dots — centre dot plus four at the
cardinal points. At 28 units the dots render as a fabric-mesh cue no other
glyph has: the nightstand has one centred circle, the plant three large
overlapping ones, the dresser a row of three on a rectangle. Stroked circles
at dot scale paint as solid dots, keeping the all-stroke family rule.

```ts
case "smartSpeaker": {
  const m = Math.min(hw, hh);
  detail = svg`
    <circle cx="0" cy="0" r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
    <circle cx="0" cy=${-m * 0.5} r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
    <circle cx=${m * 0.5} cy="0" r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
    <circle cx="0" cy=${m * 0.5} r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
    <circle cx=${-m * 0.5} cy="0" r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />`;
  break;
}
```

---

## 8. CSS

Add to **both** the card and editor style blocks (keyframes are
per-shadow-root, same as the reactive-glyphs classes). Extends — does not
replace — the existing `.fp-furn-drum` / `.fp-furn-screen` / `.fp-furn-flame`
rules, and the fan reuses the drum's full-revolution keyframes rather than
duplicating them.

```css
/* Fan spin: one revolution every 1.8 s, twice the washer drum's speed, so a
   fan and a laundry pair on one card never read as the same motion. Four
   blades pass a fixed point every 0.45 s: clearly spinning, not strobing.
   Reuses the drum's full-revolution keyframes at a shorter duration. */
.fp-furn-fan {
  transform-box: fill-box;
  transform-origin: center;
  animation: fp-furn-drum-spin 1.8s linear infinite;
}

/* Light glow: a slow brightness swell on a lit disc (ceiling light, lamp).
   The resting opacity doubles as the reduced-motion pose, so animation: none
   leaves a steadily lit fixture. The 2.6 s period is deliberately out of
   step with the TV screen's 3 s so co-located glyphs do not pulse in
   lockstep. */
.fp-furn-glow {
  opacity: 0.25;
  animation: fp-furn-glow-swell 2.6s ease-in-out infinite;
}
@keyframes fp-furn-glow-swell {
  0%, 100% { opacity: 0.12; }
  50%      { opacity: 0.35; }
}
```

Extend the existing reduced-motion block with the two new selectors:

```css
@media (prefers-reduced-motion: reduce) {
  .fp-furn-drum,
  .fp-furn-screen,
  .fp-furn-flame,
  .fp-furn-fan,
  .fp-furn-glow {
    animation: none;
  }
}
```

## 9. Reduced motion — static active poses

As with the reactive-glyphs family, `animation: none` lands each glyph on a
pose idle can never show:

| type | static active pose |
|---|---|
| ceilingFan | blades at rest **with trail arcs** — a fan wearing its motion cue |
| ceilingLight | inner disc steady at `opacity: 0.25` — a lit fixture |
| lamp | shade disc steady at `opacity: 0.25` — a lit shade |

## 10. Composing with a stateStyles tint

Every stroke and fill in all seven glyphs uses the shared `${color}` binding
(`resolved?.color ?? f.color ?? FURNITURE_COLOR`), so a matched rule
recolours the spinning rotor, the glowing disc, and the static line art
alike; the four static glyphs get their state read entirely from the Phase-1
tint + `fp-furn-anim-*` layer. Reactive sub-elements sit inside `g.fp-furn`
when a rule also resolves, exactly per the reactive-glyphs structure
contract — a rule-level pulse multiplies with the glow swell on different
elements without conflict.

## Notes for the wiring task

- Gate the three reactive variants on `active` inside their `case` blocks;
  the non-active branch is the plain glyph (byte-identical guard, same as
  washer/dryer/tv/fireplace).
- Add the seven types to: the `FurnitureType` union and
  `FURNITURE_DEFAULT_SIZE` (`types.ts`); `FURNITURE_TYPES`,
  `FURNITURE_LABELS`, `FURNITURE_CATEGORIES` (`editor-forms.ts`); the
  `roundBase` set in `renderFurniture` (`render.ts`).
- Static child `transform="rotate(…)"` attributes (fan blades, trail arc)
  are static geometry — the no-animated-transform rule is untouched, and the
  animated group still uses only the standalone `rotate` property.
- Snapshot tests: `active: true` asserts `fp-furn-fan` (fan) and
  `fp-furn-glow` (ceiling light, lamp); `active: false` / omitted asserts
  the class names are absent. Without the component stylesheet the glow disc
  paints at full opacity — assert the class, not rendered brightness (same
  caveat as `fp-furn-screen`).
- The fan's rotating group must keep 180° rotational symmetry (blade pairs +
  trail-arc pair); anything added to it one-sided will shift the fill-box
  centre and make the rotor wobble.
