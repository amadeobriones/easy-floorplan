# Reactive glyphs — bespoke active-state animation

Design spec for Phase 3, Task 1: door/window-level delight for four appliance
types. When a piece's entity is ACTIVE (on / playing — the card computes this
via `isEntityOn`, no config), `renderFurniture(f, resolved?, active)` renders a
bespoke animated variant: washer/dryer drums tumble, the TV screen glows, the
fireplace flames flicker. This is separate from — and composes with — the
Phase-1 `stateStyles` tint (`docs/superpowers/specs/smart-furniture-look.md`).

**Design stance.** Same grey line art, now with one moving part. Each active
variant adds the *smallest* sub-element that makes the state legible — spokes
in a drum, a lit panel, a second flame — and animates only that. Nothing else
moves, nothing gets louder. The animations are slow, continuous, ambient:
status you notice peripherally, not an alert. Alert language stays with
`fp-furn-anim-blink`.

---

## 0. Structure contract

- **`active === false` (or omitted): byte-identical to today.** The reactive
  sub-elements below exist only in the active variant, so the idle/no-entity
  render — and its snapshot — cannot change.
- The reactive classes live on **inner sub-elements of `detail`** — never on
  the outer placement `<g transform="translate(…) rotate(…)">`, and never on
  `g.fp-furn`. Because they are ordinary children of `detail`, **no extra
  wrapper is needed** when a piece is active but has no resolved style: the
  placement group stays bare, exactly as idle.
- When a `stateStyles` rule *also* resolves, the usual Phase-1 nesting applies
  and the reactive sub-elements simply ride inside it:

  ```
  <g transform="translate(x y) rotate(a)">          ← placement; never animated
    <g class="fp-furn fp-furn-anim-pulse">          ← Phase-1 tint + rule animation
      ${base}${detail with reactive sub-elements}   ← Phase-3 lives in here
    </g>
  </g>
  ```

- Animation only ever touches the standalone `rotate` / `scale` / `opacity`
  properties on those inner sub-elements, with `transform-box: fill-box;
  transform-origin: center;` — never the `transform` shorthand, so the
  placement transform cannot be clobbered.
- All reactive sub-elements draw with the same `${color}` binding as the rest
  of the glyph (`resolved?.color ?? f.color ?? FURNITURE_COLOR`), so a tint
  recolours them for free (§6).

Class inventory introduced by this spec:

| class | element | animation |
|---|---|---|
| `fp-furn-drum` | `<g>` around the drum circle + vanes (washer, dryer) | `fp-furn-drum-spin`, 3.6 s/rev linear |
| `fp-furn-drum--reverse` | modifier on the dryer's drum group | same, `animation-direction: reverse` |
| `fp-furn-screen` | inset `<rect>` in the TV panel | `fp-furn-screen-glow`, 3 s opacity swell |
| `fp-furn-flame` | each flame `<path>` (fireplace) | `fp-furn-flame-flicker`, 1.7 s irregular |
| `fp-furn-flame--alt` | modifier on the second flame | same keyframes, 1.3 s period, −0.9 s delay |

---

## 1. Washer — the drum tumbles

A rotating bare circle is invisible, so the active drum gains **three agitator
vanes**: short spokes from 0.30 r to 0.85 r, spaced 120°, drawn at detail
weight (1.5 / opacity 0.7) so the drum rim keeps visual priority. The vanes
exist *only* while active — their appearance alone flips the state read, and
rotation makes it unmistakable. The top control-panel line and the dial circle
(the door/porthole details) stay put outside the rotating group.

The rotating group's bounding box is the drum circle itself (the vanes sit
inside it), so `transform-origin: center` with `transform-box: fill-box` lands
exactly on the drum centre `(0, h*0.06)` — the group spins in place.

Active-variant `detail` for `case "washer"` (idle case unchanged; the 120°
offsets are sin 120° = 0.866 and cos 120° = −0.5 applied to the 0.30/0.85
radii):

```ts
case "washer": {
  const r = Math.min(w, h) * 0.3;
  const cy = h * 0.06;
  detail = svg`
    <line x1=${-hw + w * 0.06} y1=${-hh + h * 0.18} x2=${hw - w * 0.06} y2=${-hh + h * 0.18}
          stroke=${color} stroke-width="1.5" opacity="0.7" />
    <g class="fp-furn-drum">
      <circle cx="0" cy=${cy} r=${r} fill="none" stroke=${color} stroke-width="2" />
      <line x1="0" y1=${cy - r * 0.3} x2="0" y2=${cy - r * 0.85}
            stroke=${color} stroke-width="1.5" opacity="0.7" />
      <line x1=${r * 0.26} y1=${cy + r * 0.15} x2=${r * 0.736} y2=${cy + r * 0.425}
            stroke=${color} stroke-width="1.5" opacity="0.7" />
      <line x1=${-r * 0.26} y1=${cy + r * 0.15} x2=${-r * 0.736} y2=${cy + r * 0.425}
            stroke=${color} stroke-width="1.5" opacity="0.7" />
    </g>
    <circle cx=${-hw + w * 0.16} cy=${-hh + h * 0.09} r=${Math.min(w, h) * 0.045}
            fill="none" stroke=${color} stroke-width="1.5" />`;
  break;
}
```

**Speed.** 3.6 s per revolution, linear, continuous. A real tumble (~45 rpm)
would be ~1.3 s/rev — strobe-like at glyph scale. 3.6 s reads unambiguously as
"turning" while staying calm on a card full of other state.

**Reduced motion:** the vanes render but the drum holds still — a loaded,
paused drum. Idle never shows vanes, so the static pose still reads active.

**Tint composition:** the drum circle and vanes stroke with `${color}`, so a
resolved rule colour recolours the spinning drum along with the body; the
vanes keep their 0.7 opacity, preserving the drawing's hierarchy.

## 2. Dryer — the drum tumbles the other way

Same drum group, two differences that keep the dryer's identity:

- The dryer's existing **inner concentric ring** (r × 0.45, the porthole) is a
  door detail — it stays static, outside the rotating group. The moving parts
  are **three rim baffles**: stubs from 0.60 r to 0.90 r at 120°, hugging the
  drum wall like real dryer baffles and leaving the static ring visually
  undisturbed as they pass behind it.
- The drum carries `fp-furn-drum--reverse`, so a side-by-side laundry pair
  turns in opposite directions and reads as two machines, not a copy-paste.

```ts
case "dryer": {
  const r = Math.min(w, h) * 0.3;
  const cy = h * 0.06;
  detail = svg`
    <line x1=${-hw + w * 0.06} y1=${-hh + h * 0.18} x2=${hw - w * 0.06} y2=${-hh + h * 0.18}
          stroke=${color} stroke-width="1.5" opacity="0.7" />
    <g class="fp-furn-drum fp-furn-drum--reverse">
      <circle cx="0" cy=${cy} r=${r} fill="none" stroke=${color} stroke-width="2" />
      <line x1="0" y1=${cy - r * 0.6} x2="0" y2=${cy - r * 0.9}
            stroke=${color} stroke-width="1.5" opacity="0.7" />
      <line x1=${r * 0.52} y1=${cy + r * 0.3} x2=${r * 0.779} y2=${cy + r * 0.45}
            stroke=${color} stroke-width="1.5" opacity="0.7" />
      <line x1=${-r * 0.52} y1=${cy + r * 0.3} x2=${-r * 0.779} y2=${cy + r * 0.45}
            stroke=${color} stroke-width="1.5" opacity="0.7" />
    </g>
    <circle cx="0" cy=${cy} r=${r * 0.45}
            fill="none" stroke=${color} stroke-width="1.5" opacity="0.7" />`;
  break;
}
```

(120° offsets: 0.866 × 0.6 = 0.52, 0.866 × 0.9 = 0.779, 0.5 × 0.6 = 0.3,
0.5 × 0.9 = 0.45. DOM order preserves today's outer-then-inner circle order.)

**Reduced motion:** baffles shown, drum still — same "loaded" pose as the
washer.

**Tint composition:** identical to the washer — every stroke in the rotating
group uses `${color}`, so the tinted dryer spins in its rule colour.

## 3. TV — the screen glows

No new lines: the panel itself comes alive. An **inset filled rect** — the lit
screen — sits inside the chassis outline with a slow opacity swell. No stroke,
no scale, no scanlines: hatching would alias into noise at typical glyph sizes
(a TV is often 40–70 units wide), while a breathing fill reads as "showing a
picture" at any size. The stand line stays put.

```ts
case "tv":
  detail = svg`
    <rect class="fp-furn-screen" x=${-hw + w * 0.06} y=${-hh + h * 0.18}
          width=${w * 0.88} height=${h * 0.64} rx="2" fill=${color} />
    <line x1=${-w * 0.18} y1=${hh} x2=${w * 0.18} y2=${hh + h}
          stroke=${color} stroke-width="2" />`;
  break;
```

The rect's brightness lives entirely in CSS `opacity` (class default 0.2,
swelling 0.1 ↔ 0.3 over 3 s). On top of the base fill (0.12 idle / 0.30
tinted) the screen area peaks noticeably brighter than the chassis — a lit
panel in a dim room — without ever flashing. Note for tests: without the
component stylesheet the rect paints at full opacity; assertions should target
the class, not the rendered brightness.

**Reduced motion:** the swell stops at the class's resting `opacity: 0.2` — a
steadily lit screen, still clearly distinct from the empty idle panel.

**Tint composition:** the screen rect fills with `${color}`, so a resolved
rule turns both the outline and the glowing panel to the rule colour — the
glow becomes a coloured light wash inside the tinted chassis.

## 4. Fireplace — the flames flicker

Idle already draws one zigzag flame silhouette; active adds a **second,
smaller tongue** nested inside it and flickers both. Flicker means irregular:
the keyframes use uneven stops (27 / 52 / 71 %) so the loop never reads as a
metronome pulse, and the two flames run different periods with a negative
delay so they never synchronise — the beat pattern only repeats every ~22 s.
Amplitude is small (opacity 0.55–1, scale 0.97–1.05): a hearth across the
room, not a bonfire. The firebox side lines stay put.

```ts
case "fireplace":
  detail = svg`
    <line x1=${-w * 0.26} y1=${-hh} x2=${-w * 0.26} y2=${hh}
          stroke=${color} stroke-width="2" />
    <line x1=${w * 0.26} y1=${-hh} x2=${w * 0.26} y2=${hh}
          stroke=${color} stroke-width="2" />
    <path class="fp-furn-flame"
          d="M ${-w * 0.14} ${h * 0.18} L ${-w * 0.05} ${-h * 0.18} L 0 ${h * 0.02} L ${w * 0.05} ${-h * 0.18} L ${w * 0.14} ${h * 0.18}"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />
    <path class="fp-furn-flame fp-furn-flame--alt"
          d="M ${-w * 0.08} ${h * 0.16} L ${-w * 0.03} ${-h * 0.05} L 0 ${h * 0.07} L ${w * 0.03} ${-h * 0.05} L ${w * 0.08} ${h * 0.16}"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.7" />`;
  break;
```

The outer path is today's flame verbatim (plus the class); the inner tongue
echoes its shape at ~60 % scale so the pair reads as one fire. CSS `opacity`
on the element multiplies with nothing here — the flicker range is authored
directly in the keyframes, and the drawn 0.8 / 0.7 hierarchy returns whenever
animation is off.

**Reduced motion:** both tongues render steady at their drawn opacities — a
lit hearth (two flames) versus idle's single silhouette. No movement.

**Tint composition:** both flame paths stroke with `${color}`; under a rule
colour the fire flickers in that colour inside the tinted surround, and a
rule-level `fp-furn-anim-pulse` on `g.fp-furn` multiplies cleanly since it
animates a different element.

---

## 5. CSS

Add to both the card and editor style blocks (keyframes are per-shadow-root,
same as Phase 1). Extends — does not replace — the Phase-1 `.fp-furn` rules.

```css
/* Reactive glyphs: bespoke active-state animation on inner sub-elements of a
   furniture drawing. These classes sit inside the placement transform (and
   inside g.fp-furn when a stateStyles rule resolves) and animate only the
   standalone rotate/scale/opacity properties, so placement is never touched. */

.fp-furn-drum,
.fp-furn-flame {
  transform-box: fill-box;
  transform-origin: center;
}

/* Drum tumble: one revolution every 3.6 s at constant speed. Real drums spin
   faster, but at glyph scale that strobes; this reads as turning, calmly. */
.fp-furn-drum {
  animation: fp-furn-drum-spin 3.6s linear infinite;
}
/* The dryer turns the opposite way, so a laundry pair reads as two machines. */
.fp-furn-drum--reverse {
  animation-direction: reverse;
}
@keyframes fp-furn-drum-spin {
  from { rotate: 0deg; }
  to   { rotate: 360deg; }
}

/* TV screen glow: a slow brightness swell. The resting opacity doubles as the
   reduced-motion pose, so animation: none leaves a steadily lit screen. */
.fp-furn-screen {
  opacity: 0.2;
  animation: fp-furn-screen-glow 3s ease-in-out infinite;
}
@keyframes fp-furn-screen-glow {
  0%, 100% { opacity: 0.1; }
  50%      { opacity: 0.3; }
}

/* Fire flicker: uneven stops so it dances instead of pulsing. The alt flame
   runs a shorter period with a negative delay, so the two tongues never sync
   and the combined pattern only repeats every ~22 s. */
.fp-furn-flame {
  animation: fp-furn-flame-flicker 1.7s ease-in-out infinite;
}
.fp-furn-flame--alt {
  animation-duration: 1.3s;
  animation-delay: -0.9s;
}
@keyframes fp-furn-flame-flicker {
  0%, 100% { opacity: 0.85; scale: 1; }
  27%      { opacity: 0.55; scale: 0.97; }
  52%      { opacity: 1;    scale: 1.05; }
  71%      { opacity: 0.65; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .fp-furn-drum,
  .fp-furn-screen,
  .fp-furn-flame {
    animation: none;
  }
}
```

## 6. Reduced motion — static active poses

`animation: none` deliberately lands each glyph on a pose idle can never show,
so the active state survives without movement:

| type | static active pose |
|---|---|
| washer / dryer | vanes/baffles visible, drum at rest angle — a loaded machine |
| tv | screen rect at steady `opacity: 0.2` — a lit panel |
| fireplace | both flame tongues steady at drawn opacity — a lit hearth |

## 7. Composing with a stateStyles tint

One rule covers all four: every reactive sub-element draws with the shared
`${color}` binding, so when a rule resolves a colour the animated part is
recoloured exactly like the rest of the glyph — spinning drum, glowing screen,
and flickering flames all wear the rule colour. Structurally the reactive
elements live inside `g.fp-furn` (§0), so a rule's `fp-furn-anim-pulse` /
`-blink` group animation multiplies with the sub-element animation without
conflict: they animate different elements and, for opacity, the effects
compose multiplicatively.

## Notes for Task 2 (wiring)

- Gate each variant on `active` inside the existing `case` blocks; the
  non-active branch is today's markup untouched (byte-identical guard).
- No wrapper change is needed for active-without-style: the reactive classes
  are self-contained inside `detail`.
- Snapshot tests: `active: true` asserts the class names
  (`fp-furn-drum`, `fp-furn-drum--reverse`, `fp-furn-screen`,
  `fp-furn-flame`, `fp-furn-flame--alt`); `active: false` / omitted asserts
  byte-identity with the pre-Phase-3 output.
- The standalone `rotate` / `scale` properties are already the Phase-1
  precedent (`.fp-furn` uses standalone `scale`); browser support matches.
