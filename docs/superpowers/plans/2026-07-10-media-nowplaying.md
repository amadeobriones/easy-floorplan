# Media Now-Playing (feature 1f) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TV or smart-speaker piece bound to a `media_player` shows a tiny animated equalizer cue when — and only when — its player is literally `playing`, distinct from merely `on`/`paused`. It extends the existing v0.7.101 reactive glyph (the TV screen already glows when active) and is gated behind the `mediaNowPlaying` feature flag, default off.

**Architecture:** Thread a **new, separate `playing` boolean** into `renderFurniture` (the existing `active` param stays untouched). The card computes `playing = featureEnabled(config,"mediaNowPlaying") && entity && state === "playing"` at the same render site that already computes `active`, and passes it fourth. In `renderFurniture`, the `tv` and `smartSpeaker` cases append three equalizer bars (`fp-furn-eq`) **only** when `playing` is true — so a not-playing / flag-off render is byte-identical to today. CSS goes in **both** the card and editor style blocks and is reduced-motion safe.

**Tech Stack:** Lit + TypeScript, Vitest.

## Why a separate `playing` flag, not a reuse of `active`

`active` for a `media_player` is `true` for every state except `off`/`standby`
(`INACTIVE_STATES.media_player = new Set(["off","standby"])`, `src/render.ts:266`) —
so **paused, idle, buffering, and on all count as `active`**, and the TV's existing
`fp-furn-screen` glow already fires on all of them. The now-playing cue must be
**narrower** ("literally playing") and **independently gated** by the feature flag.
Overloading `active` would (a) conflate paused with playing and (b) make it
impossible to gate the cue without also disturbing the TV's existing glow. A fourth
param `playing = false`, computed independently, keeps `active` (and therefore the
v0.7.101 glow) byte-for-byte unchanged and lets the flag toggle only the cue.

## Why this is NOT a LiveLayer

Track 1a's LiveLayer framework is for **overlay layers over rooms/pieces** with their
own registry (id/label/icon/render-hook/watched-entities) and an on-plan show/hide
toggle. Media now-playing is not an overlay — it is a **per-furniture reactive
extension** that rides *inside* an existing furniture drawing (`renderFurniture`'s
`tv`/`smartSpeaker` cases), exactly like the Phase-3 reactive glyphs (drum spin,
screen glow, flame flicker). It watches no new entity (the piece's `entity` is
already in `collectWatchedEntities`, `src/render.ts:69`) and needs no layer registry.
So it is gated by the config-level `featureEnabled` flag (per the roadmap's
cross-cutting rule) but is **not** registered as a LiveLayer.

## Global Constraints

- **Nothing outward:** local commits only; never push outside `origin`; no PR/issue/comment to upstream; **no AI-authorship footers** (no `Co-Authored-By`, no "Generated with").
- Branch `feat/media-nowplaying` off `main` (do not push).
- **Byte-identical when off / not-playing:** with `mediaNowPlaying` off OR the player not in state `playing`, the card passes `playing = false`, `renderFurniture` never emits the cue, and output matches the pre-1f glyph exactly (idle *and* the existing active glow both unchanged). This is the regression guarantee.
- **Zero cost when off:** the cue adds zero DOM when not playing and **zero new watched entities** ever — the piece's `entity` is already watched for its tap/glow, so the flag introduces no new subscription.
- **No schema change:** this plan adds no config field. It **consumes** `mediaNowPlaying` from the already-shipped `FeaturesConfig` (see Dependency) and `Furniture.entity` (already exists, `src/types.ts:329`). Do **not** run `npm run schema`; there is nothing additive.
- **Landmine (carried from the reactive-glyph work):** no backticks in `css` tagged-template comments; animate only the standalone `scale`/`rotate`/`opacity` properties on **inner sub-elements** of `detail`, never the `transform` shorthand and never `g.fp-furn` or the placement `<g>`.
- **Do not restructure the existing `tv`/`smartSpeaker` case bodies.** Keep the existing `active ? … : …` markup verbatim and only *append* the cue when `playing`, so the not-playing serialization is unchanged.
- Run: `npx vitest run src/render.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.

## Dependency (must land first)

This plan consumes the feature-toggles work
(`docs/superpowers/plans/2026-07-10-feature-toggles.md`): `src/features.ts` exporting
`featureEnabled(config, name)` and `FeaturesConfig.mediaNowPlaying?: boolean`
(default off). Confirm before starting:

```bash
grep -n "export function featureEnabled" src/features.ts
grep -n "mediaNowPlaying" src/types.ts
```

Both must return a hit. If not, land the feature-toggles plan first.

## Produced interfaces (exact names/types)

```ts
// src/render.ts — signature GAINS a fourth param (append-only; existing callers unaffected):
export function renderFurniture(
  f: Furniture,
  resolved?: ResolvedStyle,
  active?: boolean,          // unchanged: domain-aware "not off/standby" -> existing glyphs
  playing?: boolean,         // NEW, default false: media_player literally "playing" -> now-playing cue
): SVGTemplateResult;

// src/render.ts — NEW module-private helper (equalizer bars), NOT exported:
//   function nowPlayingBars(cx, baseY, bw, bh, color): SVGTemplateResult

// src/render.ts — NEW exported pure predicate the card uses at its render site:
export function furnitureNowPlaying(
  config: { features?: FeaturesConfig } | undefined,
  state: string | undefined,
  entity: string | undefined,
): boolean;   // !!entity && state === "playing" && featureEnabled(config, "mediaNowPlaying")
```

Consumers: `src/floorplan-card.ts` computes `isPlaying = furnitureNowPlaying(this._config, this.hass?.states[f.entity ?? ""]?.state, f.entity)` and passes it as the 4th arg to `renderFurniture`.

CSS class introduced: `fp-furn-eq` (each bar), modifiers `fp-furn-eq--2` / `fp-furn-eq--3` (staggered animation-delay), keyframes `fp-furn-eq-bounce`.

---

## Task 1: `playing` param + the equalizer cue in `renderFurniture`

**Files:**
- Modify: `src/render.ts` — signature (`939-943`), add module-private `nowPlayingBars` helper, `tv` case (`1044-1053`), `smartSpeaker` case (`1378-1387`)
- Test: `src/render.test.ts`

**Interfaces:**
- Consumes: `Furniture` (`src/types.ts`), the existing `svg` / `SVGTemplateResult` already imported in `render.ts`.
- Produces: `renderFurniture(f, resolved?, active?, playing?)`; module-private `nowPlayingBars`.

- [ ] **Step 1: Write the failing tests** — append to `src/render.test.ts`. Follow the file's existing `serialize`/string-assert pattern (the reactive-glyph tests already assert class names for `active`). If a local `serialize` helper is in scope use it; otherwise assert on `.strings.join("")` of the returned template as the neighboring tests do.

```ts
import { renderFurniture } from "./render";
import type { Furniture } from "./types";

describe("feature 1f -- media now-playing cue", () => {
  const tv: Furniture = { id: "t", type: "tv", x: 0, y: 0, w: 60, h: 40, entity: "media_player.lr" };
  const spk: Furniture = { id: "s", type: "smartSpeaker", x: 0, y: 0, w: 28, h: 28, entity: "media_player.k" };
  const str = (f: Furniture, active: boolean, playing: boolean) =>
    // the family's existing tests read the raw template strings; mirror them.
    renderFurniture(f, undefined, active, playing).strings.join("|");

  it("adds the equalizer cue to a playing TV", () => {
    expect(str(tv, true, true)).toContain("fp-furn-eq");
    expect(str(tv, true, true)).toContain("fp-furn-eq--2");
    expect(str(tv, true, true)).toContain("fp-furn-eq--3");
  });

  it("adds the equalizer cue to a playing smart speaker", () => {
    expect(str(spk, true, true)).toContain("fp-furn-eq");
  });

  it("a NOT-playing TV is byte-identical to the pre-1f render (active glow only, no cue)", () => {
    // Same active glyph as before feature 1f: screen glows, but NO eq bars.
    const before = renderFurniture(tv, undefined, true).strings.join("|"); // 3-arg call = today
    const now = renderFurniture(tv, undefined, true, false).strings.join("|");
    expect(now).toBe(before);
    expect(now).not.toContain("fp-furn-eq");
  });

  it("an idle (inactive, not-playing) speaker is byte-identical and cue-free", () => {
    const before = renderFurniture(spk, undefined, false).strings.join("|");
    const now = renderFurniture(spk, undefined, false, false).strings.join("|");
    expect(now).toBe(before);
    expect(now).not.toContain("fp-furn-eq");
  });

  it("playing defaults to false (omitted 4th arg = no cue)", () => {
    expect(renderFurniture(tv, undefined, true).strings.join("|")).not.toContain("fp-furn-eq");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/render.test.ts -t "media now-playing"`
Expected: FAIL — the `fp-furn-eq` assertions fail (no cue emitted yet). The byte-identity assertions pass trivially (still useful as guards once the cue lands).

- [ ] **Step 3: Add the `playing` param + the `nowPlayingBars` helper**

In `src/render.ts`, change the signature (currently `939-943`) to add the fourth param:

```ts
export function renderFurniture(
  f: Furniture,
  resolved?: ResolvedStyle,
  active = false,
  playing = false,
): SVGTemplateResult {
```

Update the doc-comment above the signature (`934-937`) to mention the cue, e.g. append:
`When \`playing\` is true, tv/smartSpeaker append a media now-playing equalizer cue (feature 1f) -- see docs/superpowers/specs/2026-07-10-vision-roadmap.md 1f.`

Add this module-private helper near the other `render.ts` furniture helpers (above `renderFurniture`, alongside where `FURNITURE_COLOR` etc. live). No backticks inside the comment:

```ts
/*
 * Three equalizer bars for the media now-playing cue (feature 1f). Drawn as
 * inner sub-elements so the placement transform is untouched; the fp-furn-eq
 * classes animate a standalone scale (see the media CSS block in
 * floorplan-card.ts / editor.ts). Every bar strokes with the glyph color, so a
 * stateStyles tint recolours the cue for free. Emitted ONLY when the caller
 * passes playing=true, so a not-playing / flag-off render is byte-identical to
 * the pre-1f glyph.
 */
function nowPlayingBars(
  cx: number,
  baseY: number,
  bw: number,
  bh: number,
  color: string,
): SVGTemplateResult {
  const gap = bw * 1.6;
  return svg`<rect class="fp-furn-eq" x=${cx - gap - bw / 2} y=${baseY - bh} width=${bw} height=${bh} fill=${color} />
    <rect class="fp-furn-eq fp-furn-eq--2" x=${cx - bw / 2} y=${baseY - bh} width=${bw} height=${bh} fill=${color} />
    <rect class="fp-furn-eq fp-furn-eq--3" x=${cx + gap - bw / 2} y=${baseY - bh} width=${bw} height=${bh} fill=${color} />`;
}
```

- [ ] **Step 4: Append the cue in the `tv` case (do NOT touch the existing ternary)**

The `tv` case (`1044-1053`) keeps its exact `active ? … : …` body; add the append **after** it, before `break`:

```ts
    case "tv":
      detail = active
        ? svg`
        <rect class="fp-furn-screen" x=${-hw + w * 0.06} y=${-hh + h * 0.18}
              width=${w * 0.88} height=${h * 0.64} rx="2" fill=${color} />
        <line x1=${-w * 0.18} y1=${hh} x2=${w * 0.18} y2=${hh + h}
              stroke=${color} stroke-width="2" />`
        : svg`<line x1=${-w * 0.18} y1=${hh} x2=${w * 0.18} y2=${hh + h}
                         stroke=${color} stroke-width="2" />`;
      if (playing) {
        // Lower-centre of the screen; bars span y in [-hh+h*0.48, -hh+h*0.78],
        // inside the screen rect (y in [-hh+h*0.18, -hh+h*0.82]).
        detail = svg`${detail}${nowPlayingBars(0, -hh + h * 0.78, w * 0.05, h * 0.3, color)}`;
      }
      break;
```

- [ ] **Step 5: Append the cue in the `smartSpeaker` case (do NOT touch the existing markup)**

The `smartSpeaker` case (`1378-1387`) keeps its five-circle body verbatim; add the append before `break`:

```ts
    case "smartSpeaker": {
      const m = Math.min(hw, hh);
      detail = svg`
        <circle cx="0" cy="0" r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
        <circle cx="0" cy=${-m * 0.5} r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
        <circle cx=${m * 0.5} cy="0" r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
        <circle cx="0" cy=${m * 0.5} r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />
        <circle cx=${-m * 0.5} cy="0" r=${m * 0.12} fill="none" stroke=${color} stroke-width="1.5" />`;
      if (playing) {
        // Centred bars sized to the speaker radius m; the fabric dots stay put.
        detail = svg`${detail}${nowPlayingBars(0, m * 0.45, m * 0.16, m * 0.7, color)}`;
      }
      break;
    }
```

Note: `smartSpeaker` did not previously read `active` at all — that is fine; the
cue is gated on `playing`, independent of `active`. The speaker gains no active
glow from this plan (out of scope); only the now-playing cue.

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run src/render.test.ts`
Expected: PASS (the new `media now-playing` block and the whole existing file — the append-only change must not disturb any existing furniture snapshot).

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit && git add src/render.ts src/render.test.ts
git commit -m "Add media now-playing equalizer cue to tv/smartSpeaker (playing flag)"
```

## Task 2: `furnitureNowPlaying` predicate + wire the card render site

**Files:**
- Modify: `src/render.ts` — add + export `furnitureNowPlaying`; import `featureEnabled` from `./features` and the `FeaturesConfig` type from `./types`
- Modify: `src/floorplan-card.ts` — the furniture map render site (`358-364`); import `furnitureNowPlaying` from `./render`
- Test: `src/render.test.ts`

**Interfaces:**
- Consumes: `featureEnabled` (`src/features.ts`), `FeaturesConfig` (`src/types.ts`), `renderFurniture(…, playing)` from Task 1.
- Produces: `furnitureNowPlaying(config, state, entity): boolean` (exported).

- [ ] **Step 1: Write the failing test** — append to `src/render.test.ts`:

```ts
import { furnitureNowPlaying } from "./render";

describe("furnitureNowPlaying (feature 1f gate)", () => {
  const on = { features: { mediaNowPlaying: true } };
  it("true only when flag on AND entity set AND state is exactly playing", () => {
    expect(furnitureNowPlaying(on, "playing", "media_player.lr")).toBe(true);
  });
  it("false when the flag is off, even while playing (default off)", () => {
    expect(furnitureNowPlaying({}, "playing", "media_player.lr")).toBe(false);
    expect(furnitureNowPlaying(undefined, "playing", "media_player.lr")).toBe(false);
  });
  it("false for paused/on/idle -- distinct from merely active", () => {
    expect(furnitureNowPlaying(on, "paused", "media_player.lr")).toBe(false);
    expect(furnitureNowPlaying(on, "on", "media_player.lr")).toBe(false);
    expect(furnitureNowPlaying(on, "idle", "media_player.lr")).toBe(false);
  });
  it("false when there is no entity or no state", () => {
    expect(furnitureNowPlaying(on, "playing", undefined)).toBe(false);
    expect(furnitureNowPlaying(on, undefined, "media_player.lr")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/render.test.ts -t "furnitureNowPlaying"`
Expected: FAIL — `furnitureNowPlaying` is not exported.

- [ ] **Step 3: Implement the predicate in `src/render.ts`**

Add the import near the top of `src/render.ts` (with the other `./features` / `./types` imports; add a new import line if none exists yet):

```ts
import { featureEnabled } from "./features";
import type { FeaturesConfig } from "./types";
```

Add the exported predicate (near `entityIsActive`, `src/render.ts:355-360`):

```ts
/**
 * Feature-1f gate: should a media-bound furniture piece show the now-playing
 * cue? True only when the mediaNowPlaying flag is on, the piece has an entity,
 * and that entity is literally "playing" -- narrower than entityIsActive, which
 * also treats paused/on/idle as active. Flag off (or no features block) => false,
 * so the cue is byte-identical-absent by default.
 */
export function furnitureNowPlaying(
  config: { features?: FeaturesConfig } | undefined,
  state: string | undefined,
  entity: string | undefined,
): boolean {
  return !!entity && state === "playing" && featureEnabled(config, "mediaNowPlaying");
}
```

- [ ] **Step 4: Run the predicate tests, verify pass**

Run: `npx vitest run src/render.test.ts -t "furnitureNowPlaying"`
Expected: PASS.

- [ ] **Step 5: Wire the card render site** — in `src/floorplan-card.ts`, add `furnitureNowPlaying` to the existing `from "./render"` import (line ends at `34`), then extend the furniture map (`358-364`). Keep the existing `isActive`/`shape` lines; add `isPlaying` and pass it fourth:

```ts
            ${active.furniture.map((f) => {
              const style = resolveStateStyle(f.stateStyles, this.hass, f.entity);
              const isActive = !!f.entity && entityIsActive(f.entity, this.hass?.states[f.entity]?.state);
              // Feature 1f: literally "playing" (narrower than isActive), flag-gated.
              const isPlaying = furnitureNowPlaying(
                this._config,
                f.entity ? this.hass?.states[f.entity]?.state : undefined,
                f.entity,
              );
              const shape = renderFurniture(f, style, isActive, isPlaying);
              if (!f.entity) return shape;
              // ... rest of the tappable-wrapper block unchanged ...
```

(The `if (!f.entity) return shape;` line and everything below it, `365-383`, are unchanged.)

- [ ] **Step 6: Typecheck + full suite + commit**

```bash
npx tsc --noEmit && npx vitest run --reporter=dot
git add src/render.ts src/render.test.ts src/floorplan-card.ts
git commit -m "Gate the now-playing cue with furnitureNowPlaying at the card render site"
```

Expected: tsc clean; full suite green (no existing furniture/card test regresses — the 4th arg defaults false everywhere else).

## Task 3: CSS for the cue in BOTH style blocks (reduced-motion safe)

**Files:**
- Modify: `src/floorplan-card.ts` — the card furniture CSS block (reactive-glyph rules `692-770`, reduced-motion at `762-770`)
- Modify: `src/editor.ts` — the mirrored editor CSS block (`3773-3847`, reduced-motion at `3839-3847`)
- No unit test (CSS/DOM behaviour; verified by tsc/build in Task 4 + live check). The `fp-furn-eq` class presence is already asserted by Task 1.

**Interfaces:**
- Consumes: the `fp-furn-eq` / `fp-furn-eq--2` / `fp-furn-eq--3` classes emitted by Task 1.

- [ ] **Step 1: Add the cue rules to the card block** — in `src/floorplan-card.ts`, insert this **immediately before** the reactive-glyph reduced-motion `@media` block (currently `762`). No backticks in the comment:

```css
/* Media now-playing cue (feature 1f): a tiny equalizer on a TV or smart
   speaker whose media_player is playing. Extends the reactive glyph -- the
   bars are inner sub-elements of the drawing, animating only the standalone
   scale, so the placement transform is never touched. Gated upstream by the
   mediaNowPlaying flag; a not-playing render never emits these. */
.fp-furn-eq {
  transform-box: fill-box;
  transform-origin: center bottom;
  scale: 1 0.7;
  animation: fp-furn-eq-bounce 0.9s ease-in-out infinite;
}
.fp-furn-eq--2 { animation-delay: -0.3s; }
.fp-furn-eq--3 { animation-delay: -0.6s; }
@keyframes fp-furn-eq-bounce {
  0%, 100% { scale: 1 0.4; }
  50%      { scale: 1 1; }
}
```

- [ ] **Step 2: Add `fp-furn-eq` to the card reduced-motion rule** — in the same file, the existing reduced-motion selector list (`763`) is:

```css
  .fp-furn-drum, .fp-furn-screen, .fp-furn-flame, .fp-furn-fan, .fp-furn-glow { animation: none; }
```

Change it to include `.fp-furn-eq`:

```css
  .fp-furn-drum, .fp-furn-screen, .fp-furn-flame, .fp-furn-fan, .fp-furn-glow, .fp-furn-eq { animation: none; }
```

With animation off the bars rest at `scale: 1 0.7` — three short, static, equal
bars: still a legible "now playing" glyph, no movement.

- [ ] **Step 3: Mirror both additions into the editor block** — in `src/editor.ts`, insert the **same** `.fp-furn-eq` rules + `@keyframes fp-furn-eq-bounce` immediately before the editor's reactive-glyph reduced-motion `@media` block (currently `3839`), and add `.fp-furn-eq` to that block's selector list (`3840`):

```css
  .fp-furn-drum, .fp-furn-screen, .fp-furn-flame, .fp-furn-fan, .fp-furn-glow, .fp-furn-eq { animation: none; }
```

The editor's `renderFurniture` previews are always idle (never `playing`), but the
keyframes are per-shadow-root, so the block belongs in both roots — consistent with
the existing reactive-glyph CSS which is duplicated the same way.

- [ ] **Step 4: Typecheck + build + full suite + commit**

```bash
npx tsc --noEmit && npx vitest run --reporter=dot && npm run build
git add src/floorplan-card.ts src/editor.ts
git commit -m "Add fp-furn-eq now-playing cue CSS to card + editor blocks (reduced-motion safe)"
```

Expected: tsc clean, full suite green, build succeeds.

## Task 4 (controller): Verify + gate

- [ ] `npx tsc --noEmit`, `npx vitest run --reporter=dot`, and `npm run build` all green.
- [ ] Re-read the byte-identity guard: `renderFurniture(tv, undefined, true)` (3-arg, today) === `renderFurniture(tv, undefined, true, false)` and neither contains `fp-furn-eq` — Task 1's test covers this; confirm it is green.
- [ ] Dev-harness / live check: a `media_player`-bound TV and a smart speaker —
  - flag **off**: no cue in any state (idle, on, paused, playing) — the TV still glows when active exactly as v0.7.101;
  - flag **on**, player **playing**: equalizer bars appear and bounce; tinted via a `stateStyles` colour, the bars wear the tint;
  - flag **on**, player **paused/on/idle**: no bars (the cue is playing-only);
  - `prefers-reduced-motion`: bars render static (short, steady) — still legible.
- [ ] Confirm `collectWatchedEntities` is unchanged and the media entity was already watched (no new subscription introduced by this plan).
- [ ] This plan produces working, testable software on its own on top of the feature-toggles dependency.

## Self-Review

- **Spec coverage (roadmap 1f):** playing signal threaded into `renderFurniture` for tv/smartSpeaker, computed at the card site as `media_player` state `=== "playing"` (T1 param + cue, T2 predicate + wiring); flag-gated by `mediaNowPlaying` so off === v0.7.101 glyph (T2 gate); CSS in both card + editor blocks, reduced-motion safe, no backticks in comments (T3); not-a-LiveLayer choice explained (header). ✓
- **Decision recorded:** separate `playing` flag (not reuse `active`), with the paused-vs-playing and independent-gating rationale. ✓
- **Byte-identical-when-off:** guaranteed by append-only case bodies + `playing` default false + the T1 identity tests; no new watched entities, no schema change. ✓
- **No placeholders:** every code step shows real code and exact paths/line numbers. ✓
- **Type consistency:** `renderFurniture(f, resolved?, active?, playing?)`, `furnitureNowPlaying(config, state, entity)`, and the `fp-furn-eq` class names are used identically across T1/T2/T3. ✓
- **Dependency flagged:** consumes `featureEnabled` + `FeaturesConfig.mediaNowPlaying` from the feature-toggles plan; pre-flight grep included. ✓
