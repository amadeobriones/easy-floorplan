# Smart furniture — the live/active look

Design spec for entity-bound furniture: what a piece looks like when its
`stateStyles` resolves a style, and how its entity's state is shown. The
implementation target is `renderFurniture(f, resolved)` in `src/render.ts`
plus a badge overlay in `src/floorplan-card.ts`.

**Design stance.** Furniture stays line art. A live appliance is the same grey
diagram wearing the resolved colour — emphasis, not a redesign. The one new
element is a small state badge that straddles the shape's corner, borrowed
directly from the item badge so the whole card keeps one visual vocabulary.

---

## 0. Structure contract (idle must not change)

- **No entity, or entity with no matched rule:** `renderFurniture(f)` /
  `renderFurniture(f, undefined)` returns **byte-identical** markup to today —
  same single `<g transform="translate(…) rotate(…)">` wrapper, no extra
  group, no class, no style attribute. The idle plan must not re-render
  differently after this feature lands.
- **A rule matched (`resolved` defined):** wrap base + detail in one inner
  group, *inside* the placement transform:

  ```
  <g transform="translate(x y) rotate(a)">          ← placement owns this; never animated
    <g class="fp-furn ${anim ? `fp-furn-anim-${anim}` : ""}">
      ${base}${detail}
    </g>
  </g>
  ```

  All tint and animation lives on the inner `g.fp-furn`. The outer transform
  is untouched, so nothing this feature does can move a piece.

## 1. Tint

When `resolved.color` is set (call it `C`; may be a CSS var or `rgb(…)` from
`color: "rgb"`):

- **Recolour everything with `C`** — the base shape's `stroke` and `fill`,
  and every detail line's `stroke`. The glyph stays monochrome line art, just
  in the accent colour. Detail strokes that carry their own `opacity`
  (0.6–0.8 in several symbols) **keep** those values, so the internal
  hierarchy of the drawing is preserved.
- **Line weights never change.** `stroke-width` stays exactly as drawn
  (2 base / 1.5 detail). Weight is the family's identity; colour is the state.
- **Fill-opacity steps up** so an active piece reads as "lit" against the
  floor, sitting just above a tinted room (rooms tint at 0.25):

  | | idle (today) | active (rule matched, colour set) |
  |---|---|---|
  | solid bases (rect / ellipse / sectional) | 0.12 | **0.30** |
  | rug (dashed base) | 0.08 | **0.20** |

- **Rule matched but no `color`** (animation-only rule): keep the grey
  `FURNITURE_COLOR` / `f.color` and the idle fill-opacity; only the animation
  applies. Colour is opt-in per rule, exactly as for items.
- `f.color` remains the piece's *idle* colour; a matched rule's colour beats
  it (same precedence as everywhere else in the card).

## 2. State badge

Shown when the furniture has an entity **and** (`showState` is true **or**
the matched rule resolves an `icon`). Rendered by the card in the HTML
`.items` overlay — not inside the SVG — reusing `_renderBadge()` and the
existing `.badge` / `.label` styles verbatim, so a live washer and a light
switch wear the same jewellery.

- **Size: 22 px** diameter (item badges are 34 px). The badge is subordinate:
  this is furniture with a state, not a device item. Icon size follows the
  existing 0.62 ratio (≈ 14 px). Allow the item-style `size` override.
- **Position: straddling the top-right corner** of the piece's bounding box,
  centred on the corner point so half the disc sits outside the outline —
  the notification-badge idiom. The glyph's centre (drum, burners, basin)
  stays fully visible; on small pieces the badge overhangs rather than
  covers. With `θ = (f.angle ?? 0)` in radians:

  ```
  badgeX = f.x + (w/2)·cosθ + (h/2)·sinθ
  badgeY = f.y + (w/2)·sinθ − (h/2)·cosθ
  ```

  (the local corner `(+w/2, −h/2)` pushed through the placement rotation).
- **Upright always.** The badge does not inherit `f.angle`; counter-rotate
  against the floor rotation exactly as items do (`counterRotate(0, rot)`).
- **Tint:** as `_renderBadge` already does — a resolved `color` fills the
  badge background + border; otherwise the neutral card-background disc.
- **State text:** when `showState`, the standard `.label` pill hangs below
  the badge (same `top: calc(100% + 2px)` pattern as items), showing
  `itemStateText`. No badge without an icon source is invented: icon comes
  from `resolved.icon` → the entity's registry/attribute icon → domain
  default, the existing `resolveItemIcon` chain.
- The badge is the tap target (more-info / actions), matching item
  behaviour; the SVG shape itself stays `pointer-events: none` decoration.

## 3. Animation

Applied via the `fp-furn-anim-pulse` / `fp-furn-anim-blink` class on the
**inner** group (§0). The inner group needs `transform-box: fill-box;
transform-origin: center;` and animates the standalone `scale` property —
never `transform` — the same trick `.badge` uses so the placement rotation
is never clobbered.

```css
.fp-furn { transform-box: fill-box; transform-origin: center; }

/* Breathing: the appliance inhales — same 1.6 s period as fp-item-pulse,
   so a badge and its shape pulse in phase. Scale is gentle (1.03): these
   are big shapes; the badge's 1.18 would look like the sofa levitating. */
.fp-furn-anim-pulse {
  animation: fp-furn-pulse 1.6s ease-in-out infinite;
}
@keyframes fp-furn-pulse {
  0%, 100% { scale: 1;    opacity: 0.78; }
  50%      { scale: 1.03; opacity: 1; }
}

/* Blink: alert language, identical timing/curve to fp-item-blink. */
.fp-furn-anim-blink {
  animation: fp-furn-blink 1s steps(1, end) infinite;
}
@keyframes fp-furn-blink {
  0%, 49%   { opacity: 1; }
  50%, 100% { opacity: 0.25; }
}

@media (prefers-reduced-motion: reduce) {
  .fp-furn-anim-pulse,
  .fp-furn-anim-blink { animation: none; }
}
```

**Reduced motion** falls back to the *peak* static state: with `animation:
none` the group sits at its CSS defaults (`scale: 1`, `opacity: 1`), i.e. the
full active tint of §1. The tint alone is the static emphasis — no extra
outline or halo is added.

If the badge also carries the animation (rule sets both), the existing
`.anim-pulse`/`.anim-blink` item classes handle it unchanged; the shared
periods keep shape and badge in sync.

## 4. Worked example — washer, idle vs running

60×60 piece at the origin. Idle is exactly today's output; running shows a
rule like `{ state: "running", color: "var(--primary-color, #03a9f4)", animation: "pulse" }`
with `showState: true`.

```svg
<!-- IDLE: byte-identical to current renderFurniture output -->
<g transform="translate(120 80) rotate(0)">
  <rect x="-30" y="-30" width="60" height="60" rx="4"
        fill="#9e9e9e" fill-opacity="0.12" stroke="#9e9e9e" stroke-width="2"/>
  <line x1="-26.4" y1="-19.2" x2="26.4" y2="-19.2"
        stroke="#9e9e9e" stroke-width="1.5" opacity="0.7"/>
  <circle cx="0" cy="3.6" r="18" fill="none" stroke="#9e9e9e" stroke-width="2"/>
  <circle cx="-20.4" cy="-24.6" r="2.7" fill="none" stroke="#9e9e9e" stroke-width="1.5"/>
</g>

<!-- RUNNING: same geometry, tinted #03a9f4, fill-opacity 0.30, breathing -->
<g transform="translate(120 80) rotate(0)">
  <g class="fp-furn fp-furn-anim-pulse">
    <rect x="-30" y="-30" width="60" height="60" rx="4"
          fill="#03a9f4" fill-opacity="0.30" stroke="#03a9f4" stroke-width="2"/>
    <line x1="-26.4" y1="-19.2" x2="26.4" y2="-19.2"
          stroke="#03a9f4" stroke-width="1.5" opacity="0.7"/>
    <circle cx="0" cy="3.6" r="18" fill="none" stroke="#03a9f4" stroke-width="2"/>
    <circle cx="-20.4" cy="-24.6" r="2.7" fill="none" stroke="#03a9f4" stroke-width="1.5"/>
  </g>
</g>
<!-- Plus, in the HTML .items overlay (not SVG): a 22 px .badge centred on the
     corner point (150, 50) — background/border #03a9f4, mdi:washing-machine
     at 14 px — with a .label pill "Running" hanging below it. -->
```

What the eye gets: idle, the washer is furniture — quiet grey line art.
Running, the same drawing glows primary-blue a shade brighter than a tinted
room, breathes once every 1.6 s, and carries a small blue corner badge naming
the state. Nothing moved, nothing was redrawn — the appliance simply woke up.

## Implementation checklist (Task 4)

- [ ] `renderFurniture(f, resolved?)` — inner `g.fp-furn` only when `resolved`
      is defined; idle output byte-identical (assert with a snapshot test).
- [ ] Tint: colour every `stroke`/`fill` with `resolved.color` when set;
      fill-opacity 0.30 (0.20 rug); preserve per-line `opacity` and widths.
- [ ] CSS above added to both card and editor styles (keyframes are
      per-shadow-root); reduced-motion block extended.
- [ ] Card overlays the 22 px corner badge + label for entity-bound furniture
      with `showState`/resolved icon, using `_renderBadge` sizing rules.
- [ ] `collectWatchedEntities` must include furniture `entity` +
      `stateStyleEntities` so hass ticks reach the shape.
