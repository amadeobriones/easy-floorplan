# Plan Rotation (#33) — Design

**Goal:** Display a floor rotated by a quarter turn without moving the data. A new
per-floor field `rotation ∈ {0, 90, 180, 270}` rotates the drawn plan; badges and
text counter-rotate so labels stay upright. The prerequisite — a single box that
letterboxes the `<svg>` and the `.items` overlay **together** — lands first, on its
own, because it is the real fix for what the `preserveAspectRatio` revert worked
around.

**Non-goals:** free-angle rotation (quarter turns only); a rotate button or any
rotation rendering in the editor (config-only this pass — the editor edits in the
canonical, unrotated coordinate space); rotating the `.floor-switcher` or any card
chrome; card-level (whole-card) rotation — rotation is per-floor.

## Approaches considered

- **A. CSS "rotated plate" with container units (chosen).** Wrap the svg and the
  overlay in one `.plate` that always carries the natural `width/height` ratio, is
  centred in the stage, and is sized with a `min()` of container-query units so it
  letterboxes to the largest natural-ratio box that fits — then `rotate()`d about its
  centre. The `rotN` class picks which container axis bounds the fit, giving the
  90°/270° footprint swap for free. `.stage` reserves the display footprint as its own
  `aspect-ratio`, but alignment no longer depends on that holding. No JS, no
  `ResizeObserver`, no pixel math.
- **B. JS-computed scale.** A `ResizeObserver` on `.stage` measures pixels and applies
  `rotate(a) scale(s)` to the plate. More moving parts (an observer, reflow-on-resize,
  retained state) for something CSS does declaratively. Rejected.
- **C. Bake rotation into coordinates.** Rotate every wall/item/room/tracker coordinate
  at render time and swap `width`/`height`. Invasive: hit-testing, tracker span math,
  and the editor's coordinate space all have to account for it everywhere, and it
  contradicts the config-only-display decision. Rejected.

## Architecture

### The plate is the prerequisite (`fix/aspect-letterbox`, lands first, rotation-independent)

Today `.stage` pins `aspect-ratio: W/H` inline and the svg + overlay align only because
each fills `.stage`. When card-mod or a grid row-count overrides the stage ratio, the
svg (`preserveAspectRatio="none"`) and the HTML overlay stop agreeing and every badge
drifts off its wall. Moving both layers into a `.plate` that *owns* the `W/H` ratio makes
`preserveAspectRatio="none"` genuinely correct: the plate box always equals the viewBox
ratio, so "none" never distorts and the overlay cannot drift, whatever the stage's own
box becomes.

- `.stage` — `position: relative; width: 100%; container-type: size; overflow: hidden;`
  and `aspect-ratio: <footprint ratio>` (inline). The footprint ratio reserves sensible
  space in the card layout, but alignment no longer depends on it holding.
- `.plate` — child of `.stage`, holds the `<svg>` and `.items`. It is absolutely
  centred and **letterboxes against the stage's actual pixel size**, not against the
  stage's declared ratio — so if card-mod or a grid row-count overrides the stage box,
  the plate still fits-and-centres at the natural `W/H` and the overlay cannot drift.
  In the normal (un-overridden) case at 0° the plate exactly fills the stage, so the
  drawing looks identical to today; the only structural change is the wrapping div.
- The root svg keeps `preserveAspectRatio="none"`. **The guard comment is rewritten to
  describe the plate (why "none" is now correct because the plate pins the ratio), not
  deleted.** Landmine: backticks inside a `css` tagged-template comment terminate the
  literal — the comment lives in the HTML template or in a plain `/* */` block, never
  with backticks in a `css``` comment.
- `.floor-switcher` stays a child of `.stage`, outside `.plate`, so controls never
  rotate and never letterbox.

### Data (`src/types.ts`)

`Floor.rotation?: 0 | 90 | 180 | 270`. Absent means 0. Documented as display-only:
coordinates are always canonical; rotation is a view transform.

### Rotation helper (`src/rotation.ts`, pure, unit-tested, no DOM)

- `normalizeRotation(v: unknown): 0 | 90 | 180 | 270` — clamps anything that is not one
  of the four quarter turns to `0` (a config HA has not validated must not throw or tilt
  the plan by a stray degree).
- `footprintRatio(w: number, h: number, rot): [number, number]` — returns `[w, h]` for
  0°/180° and `[h, w]` for 90°/270°. This is the value `.stage`'s `aspect-ratio` uses.

Kept pure and separate so the card, and later the editor if it ever renders rotation,
share one source of truth for the swap.

### Card render (`src/floorplan-card.ts`)

- `render()` reads `rot = normalizeRotation(active.rotation)`, sets the stage
  `aspect-ratio` from `footprintRatio(c.width, c.height, rot)`, and on `.plate` sets the
  `rot{0,90,180,270}` class plus inline `--fp-arw: ${c.width / c.height}` and
  `--fp-rot: ${rot}deg`.
- The svg and `.items` become children of `.plate` (they were direct children of
  `.stage`).
- **Counter-rotation.** Item containers and standalone texts already carry
  `transform: translate(-50%,-50%) rotate(angle)`. The angle becomes `angle − rot`
  (mod 360), so the whole item (icon **and** its label, as one unit) and each text stay
  upright at every rotation, 180° included. Positions are untouched — they ride the
  plate's rotation and stay on their walls.
- Decision, per the worklog ("counter-rotate item badges and text so labels stay
  upright"): the **whole item container** counter-rotates, so a directional icon a user
  aimed along a wall becomes viewer-upright rather than wall-aligned. Confirmed with
  Amadeo. If wall-aligned icons are ever wanted, counter-rotate only the `.label`/`.text`
  and leave the badge's own `angle` — a localised change.

### CSS (`src/floorplan-card.ts` styles)

The plate is always the natural `W/H` box, centred, sized by `min()` so it fits inside
the stage, and rotated. `--fp-arw` (= `width / height`, unitless) and `--fp-rot`
(= `<angle>deg`) are injected inline from the config; the `rotN` class only picks which
container axis bounds the fit (the 90°/270° swap):

```
.stage { position: relative; width: 100%; container-type: size; overflow: hidden;
         /* aspect-ratio: <fw> / <fh>  set inline from footprintRatio */ }
.plate {
  position: absolute; top: 50%; left: 50%;
  aspect-ratio: var(--fp-arw);                 /* natural W/H, height derives */
  transform: translate(-50%, -50%) rotate(var(--fp-rot, 0deg));
  transform-origin: center;
}
.plate.rot0,  .plate.rot180 { width: min(100cqw, 100cqh * var(--fp-arw)); }
.plate.rot90, .plate.rot270 { width: min(100cqh, 100cqw * var(--fp-arw)); }
svg, .items { position: absolute; inset: 0; width: 100%; height: 100%; }
.items { pointer-events: none; }
```

`min(100cqw, 100cqh * var(--fp-arw))` is the largest natural-ratio width that fits the
stage box in both dimensions — a letterbox that holds even when the stage box is
overridden. `cqw`/`cqh` resolve because `.stage` has a definite size (`width:100%` +
`aspect-ratio`). `preserveAspectRatio="none"` on the svg now never distorts because the
plate box equals the viewBox ratio exactly. Landmine: animate the `scale` property,
never `transform: scale()` — the plate owns `transform`, so any future animated scale on
badges must not stomp it.

### Editor (`src/editor.ts`) — config-only, but must preserve the field

No rotation rendering, no button. The one hard requirement: a floor carrying `rotation`
must round-trip through the editor unchanged. Verify how floors are serialised: if the
editor spreads the whole floor object, `rotation` survives for free; if it whitelists
keys (like the `rooms`/`normalizeFloor` path), add `rotation` to the carried set.
Landmine, mirroring `rooms`: `normalizeFloor` must **not** backfill `rotation: 0` — that
would stamp the key onto every floor the editor writes back and enlarge every diff.

## Testing (TDD)

- **`rotation.ts` (vitest, node):** `footprintRatio` swaps at 90/270 and not at 0/180;
  `normalizeRotation` clamps `45`, `-90`, `"90"`, `undefined`, `360` correctly.
- **Card render:** `rotation: 90` → stage `aspect-ratio` is `H/W`, `.plate` carries
  `rot90` and `--fp-rot: 90deg`; a badge's transform carries the `−90` counter-rotation.
  `rotation: 0` (and absent) → stage `aspect-ratio` is `W/H`, `.plate` carries `rot0`,
  the svg and every item's markup and position are unchanged from today apart from the
  wrapping `.plate` (the regression guard asserts the drawing and positions, not literal
  markup equality — the wrapper is new), and no counter-rotation is applied (item
  transforms equal `item.angle`). An explicit assertion that the root svg still has
  `preserveAspectRatio="none"` (landmine guard). `rotation: 180` → footprint unchanged,
  badge counter-rotated 180. Existing card tests that assert `.stage > svg` structure are
  updated for the wrapper.
- **Editor round-trip:** a floor with `rotation: 270` serialises and parses back with
  `rotation: 270`, and a floor **without** rotation never gains a `rotation` key.

## Fork hygiene

Two small, droppable commits per `FORK_STRATEGY.md`, cut from `upstream/main` where the
files allow:

- `fix/aspect-letterbox` — the `.plate` wrapper. A general fix upstream may one day ship
  itself; keeping it separate means we drop it whole rather than untangle it.
- `feat/33-rotation` — per-floor rotation, stacked on the plate (it depends on it).

Nothing goes outward: no PR, no issue, no comment to upstream or anyone. Never push to a
branch that heads an open PR (`OPEN_PR_HEADS` is empty today; re-check before any push).
No `Co-Authored-By`/"Generated with" footers in the public repo.
