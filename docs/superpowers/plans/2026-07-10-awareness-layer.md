# Awareness / Security Layer (1d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live overlay layer that pings a ripple at a motion sensor's position when it fires, and blinks a safety marker (leak / smoke / door-left-open) in an alert palette when it trips — registered as a single `LiveLayer` (`id: "awarenessLayer"`), gated by the `awarenessLayer` feature flag, costing nothing when off.

**Architecture:** A small `AwarenessMarker` config (`{ id, x, y, entity, kind: "motion" | "safety" }`) lives per-floor, mirroring how `rooms` is an optional per-floor list. `src/awareness.ts` holds pure trip-logic (`isMotionTripped`, `isSafetyTripped`) and pure rendering (`renderAwarenessMarker`) — motion markers reuse `renderRipple` (HTML) hosted in an SVG `<foreignObject>` so it can live inside the layer's required `SVGTemplateResult`; safety markers are a small SVG circle that reuses the existing `fp-furn-blink` keyframe with a new red/alert fill. `src/awareness-layer.ts` wires those into ONE `LiveLayer` object and registers it into the layer framework's `LIVE_LAYERS` registry as an import side effect; `floorplan-card.ts` gains exactly one new line (`import "./awareness-layer";`) plus the alert-red CSS.

**Tech Stack:** Lit + TypeScript, Vitest.

## Depends on
- `docs/superpowers/plans/2026-07-10-feature-toggles.md` — consumes `FeaturesConfig["awarenessLayer"]`, `featureEnabled`. Must land first.
- `docs/superpowers/plans/2026-07-10-layer-framework.md` — consumes `LiveLayer`, `LayerRenderCtx`, `LIVE_LAYERS`, `enabledLayers`, `layerWatchedEntities` from `src/layers.ts`. Must land first.

Both are prerequisites per the roadmap's recommended sequence (`1a` before `1d`); this plan does not touch `src/features.ts` or `src/layers.ts`.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push.
- Branch `feat/awareness-layer` off `main`, created after `feat/feature-toggles` and `feat/layer-framework` have merged.
- **Byte-identical + zero watched entities when off.** This plan does NOT re-check `featureEnabled` inside the layer's own `render`/`watched` — the framework's `enabledLayers`/`layerWatchedEntities` already gate every layer on its flag (proven in the layer-framework plan's own tests), so `awarenessLayer` only needs to behave correctly when the framework calls it. Task 5's tests re-verify this end-to-end through the REAL registered layer, not a fake one, closing the loop.
- Adding `AwarenessMarker` + the `awareness` list to `FloorplanCardConfig`/`Floor` changes the generated schema → run `npm run schema` and commit the additive diff (the drift test in `src/schema.test.ts` enforces it). The new fields are optional, so no existing config's schema validity changes.
- Landmine: **no backticks in `css` tagged-template comments.**
- `awareness` on `Floor` follows the existing `rooms?: Room[]` convention exactly: optional, and `normalizeFloor` (in `src/types.ts`) deliberately does **not** backfill `awareness: []` on an explicit floor that omits it — only the legacy single-floor synthesis in `getFloors` defaults it to `[]`. Do not touch `normalizeFloor`.
- Run: `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.

## Produced interfaces (nothing downstream depends on this plan yet, but keep these names stable)
```ts
// src/types.ts
export type AwarenessKind = "motion" | "safety";
export interface AwarenessMarker {
  id: string;
  x: number;
  y: number;
  entity: string;
  kind: AwarenessKind;
}
// Floor gains:               awareness?: AwarenessMarker[];
// FloorplanCardConfig gains: awareness?: AwarenessMarker[];  (legacy flat array, same pattern as `rooms`)

// src/awareness.ts (new)
export function isMotionTripped(state: string | undefined): boolean;
export function isSafetyTripped(state: string | undefined): boolean;
export function isMarkerTripped(marker: Pick<AwarenessMarker, "kind">, state: string | undefined): boolean;
export function renderAwarenessMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult;

// src/awareness-layer.ts (new)
export const awarenessLayer: LiveLayer;   // id: "awarenessLayer" — also self-registers into LIVE_LAYERS on import
```

## File Structure
- `src/types.ts` — `AwarenessKind`, `AwarenessMarker`, `Floor.awareness`, `FloorplanCardConfig.awareness`, `getFloors`'s legacy-wrap default.
- `src/validate.ts` — `awarenessMarker` shape, added to the shared `elementLists` (covers both `floor` and top-level `config` shapes for free).
- `src/awareness.ts` — pure trip-logic + pure per-marker SVG rendering. No dependency on the layer framework; fully unit-testable on its own.
- `src/awareness-layer.ts` — the one `LiveLayer` object (`id: "awarenessLayer"`), its `render`/`watched` hooks (thin wrappers around `src/awareness.ts` + `getFloors`), and the registration side effect.
- `src/floorplan-card.ts` — one new import line (registers the layer) + the alert-red safety CSS.
- `src/editor.ts` — the same alert-red safety CSS (mirrors the existing per-shadow-root CSS duplication for `fp-furn-anim-blink` etc.), no logic changes — placing/editing markers in the GUI editor is out of scope for this plan.

---

## Task 1: `AwarenessMarker` type + per-floor list

**Files:**
- Modify: `src/types.ts:468` (new types, before `Floor`), `src/types.ts:504-510` (`Floor.awareness`), `src/types.ts:541-547` (`FloorplanCardConfig.awareness`), `src/types.ts:694-701` (`getFloors` legacy wrap)
- Test: `src/types.test.ts`

**Interfaces:**
- Produces: `AwarenessKind`, `AwarenessMarker`, `Floor.awareness?`, `FloorplanCardConfig.awareness?`.

- [ ] **Step 1: Write the failing tests**

Add to `src/types.test.ts` (near the existing `describe("getFloors carries rooms (#6)", ...)` block):
```ts
describe("getFloors carries awareness markers", () => {
  const awareness = [
    { id: "m1", x: 10, y: 20, entity: "binary_sensor.hall_motion", kind: "motion" as const },
  ];

  it("a flat config's awareness markers reach the synthesised floor", () => {
    const [floor] = getFloors({ awareness } as unknown as FloorplanCardConfig);
    expect(floor.awareness).toEqual(awareness);
  });

  it("a flat config with no awareness markers gets an empty list, not undefined", () => {
    expect(getFloors({} as FloorplanCardConfig)[0].awareness).toEqual([]);
  });

  // normalizeFloor deliberately does NOT backfill `awareness: []`, matching the
  // existing `rooms` behaviour: it would add the key to every explicit floor
  // that saved without one, drifting a hand-written config on every load.
  it("an explicit floor keeps its own markers, and one without stays without", () => {
    const cfg = {
      floors: [
        { id: "a", name: "A", awareness, walls: [], openings: [], items: [], texts: [], furniture: [] },
        { id: "b", name: "B", walls: [], openings: [], items: [], texts: [], furniture: [] },
      ],
    } as unknown as FloorplanCardConfig;
    const [a, b] = getFloors(cfg);
    expect(a.awareness).toHaveLength(1);
    expect(b.awareness).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/types.test.ts
```
Expected: FAIL — `floor.awareness` / `getFloors(...)[0].awareness` are `undefined`, not matching.

- [ ] **Step 3: Implement**

In `src/types.ts`, right before the `Floor` interface (after the `FURNITURE_DEFAULT_SIZE` map, before the `Rotation` type comment at line 470), add:
```ts
/** What a placement marker on the awareness/security layer watches for. */
export type AwarenessKind = "motion" | "safety";

/**
 * A placement point for the awareness/security layer (feature flag
 * "awarenessLayer", see src/features.ts): a motion marker pings a ripple
 * where its sensor fires; a safety marker (leak, smoke, door left open)
 * blinks in an alert palette when its sensor trips. One entity per marker;
 * `kind` selects which visual and which trip rule apply — see
 * isMarkerTripped in awareness.ts.
 */
export interface AwarenessMarker {
  id: string;
  x: number;
  y: number;
  entity: string;
  kind: AwarenessKind;
}
```

In the `Floor` interface, change:
```ts
  walls: Wall[];
  openings: Opening[];
  items: FloorItem[];
  texts: FloorText[];
  furniture: Furniture[];
  trackers: Tracker[];
}
```
to:
```ts
  walls: Wall[];
  openings: Opening[];
  items: FloorItem[];
  texts: FloorText[];
  furniture: Furniture[];
  trackers: Tracker[];
  /**
   * Awareness/security markers (feature flag "awarenessLayer"): motion pings
   * and safety alerts. Optional, like `rooms` — an older config simply has
   * none, and normalizeFloor deliberately does not backfill an empty array
   * here (see the `rooms` handling in normalizeFloor, unchanged by this).
   */
  awareness?: AwarenessMarker[];
}
```

In `FloorplanCardConfig`, change:
```ts
  walls?: Wall[];
  openings?: Opening[];
  items?: FloorItem[];
  texts?: FloorText[];
  furniture?: Furniture[];
  trackers?: Tracker[];
}
```
to:
```ts
  walls?: Wall[];
  openings?: Opening[];
  items?: FloorItem[];
  texts?: FloorText[];
  furniture?: Furniture[];
  trackers?: Tracker[];
  awareness?: AwarenessMarker[];
}
```

In `getFloors`'s legacy single-floor wrap, change:
```ts
      rooms: c.rooms ?? [],
      walls: c.walls ?? [],
      openings: c.openings ?? [],
      items: c.items ?? [],
      texts: c.texts ?? [],
      furniture: c.furniture ?? [],
      trackers: c.trackers ?? [],
    },
  ];
}
```
to:
```ts
      rooms: c.rooms ?? [],
      walls: c.walls ?? [],
      openings: c.openings ?? [],
      items: c.items ?? [],
      texts: c.texts ?? [],
      furniture: c.furniture ?? [],
      trackers: c.trackers ?? [],
      awareness: c.awareness ?? [],
    },
  ];
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run src/types.test.ts
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/types.ts src/types.test.ts
git commit -m "Add AwarenessMarker type and per-floor awareness list"
```

## Task 2: Validator + schema

**Files:**
- Modify: `src/validate.ts:62-72`
- Test: `src/validate.test.ts`
- Regenerate: `schema/floorplan-card.schema.json` (via `npm run schema`)

**Interfaces:**
- Consumes: nothing new (the `shape`/`arrayOf`/`oneOf`/`num`/`str` helpers already in `src/validate.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/validate.test.ts`:
```ts
it("accepts an awareness marker list", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    awareness: [{ id: "m1", x: 1, y: 2, entity: "binary_sensor.hall_motion", kind: "motion" }],
  });
  expect(r.ok).toBe(true);
});

it("rejects an awareness marker with an unknown kind", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    awareness: [{ id: "m1", x: 1, y: 2, entity: "binary_sensor.hall_motion", kind: "sideways" }],
  });
  expect(r.ok).toBe(false);
});

it("rejects an awareness marker missing its entity", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    awareness: [{ id: "m1", x: 1, y: 2, kind: "safety" }],
  });
  expect(r.ok).toBe(false);
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/validate.test.ts
```
Expected: FAIL — `awareness` is an unknown key today (allowed, since unknown keys are forward-compat), so the "accepts" test currently passes but the "rejects" tests fail (nothing validates the shape yet, so a bad `kind`/missing `entity` is silently accepted).

- [ ] **Step 3: Implement**

In `src/validate.ts`, change:
```ts
const room = shape({ id: str, points: arrayOf(point) }, { name: str, areaId: str, fill: str, fillOpacity: num });

const elementLists = {
  walls: arrayOf(wall),
  openings: arrayOf(opening),
  items: arrayOf(item),
  texts: arrayOf(text),
  furniture: arrayOf(furniture),
  trackers: arrayOf(tracker),
  rooms: arrayOf(room),
};
```
to:
```ts
const room = shape({ id: str, points: arrayOf(point) }, { name: str, areaId: str, fill: str, fillOpacity: num });
const AWARENESS_KINDS = ["motion", "safety"];
const awarenessMarker = shape({ id: str, x: num, y: num, entity: str, kind: oneOf(...AWARENESS_KINDS) });

const elementLists = {
  walls: arrayOf(wall),
  openings: arrayOf(opening),
  items: arrayOf(item),
  texts: arrayOf(text),
  furniture: arrayOf(furniture),
  trackers: arrayOf(tracker),
  rooms: arrayOf(room),
  awareness: arrayOf(awarenessMarker),
};
```
`elementLists` is spread into both the `floor` shape and the top-level `config` shape, so this one change covers per-floor AND the legacy flat array.

- [ ] **Step 4: Pass + regenerate schema**

```bash
npx vitest run src/validate.test.ts
npm run schema
npx vitest run src/schema.test.ts
```
Expected: all pass. `schema/floorplan-card.schema.json` gains an `AwarenessMarker`/`AwarenessKind` definition and an `awareness` property on `Floor` and the root schema, additive (the new fields are optional in TS, so no existing config's validity changes).

- [ ] **Step 5: Commit**

```bash
git add src/validate.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Validate the awareness marker list and regenerate schema"
```

## Task 3: Trip logic + per-marker rendering (`src/awareness.ts`)

**Files:**
- Create: `src/awareness.ts`
- Test: `src/awareness.test.ts`

**Interfaces:**
- Consumes: `isEntityOn`, `renderRipple` from `src/render.ts`; `AwarenessMarker`, `DEFAULT_RIPPLE_SIZE` from `src/types.ts`.
- Produces: `isMotionTripped`, `isSafetyTripped`, `isMarkerTripped`, `renderAwarenessMarker` (all from the Produced interfaces block above).

- [ ] **Step 1: Write the failing tests**

Create `src/awareness.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  isMotionTripped, isSafetyTripped, isMarkerTripped, renderAwarenessMarker,
} from "./awareness";
import type { AwarenessMarker } from "./types";

describe("isMotionTripped", () => {
  it("is tripped on the same states as isEntityOn", () => {
    expect(isMotionTripped("on")).toBe(true);
    expect(isMotionTripped("open")).toBe(true);
    expect(isMotionTripped("home")).toBe(true);
    expect(isMotionTripped("playing")).toBe(true);
  });
  it("is not tripped when off, unavailable, or unknown", () => {
    expect(isMotionTripped("off")).toBe(false);
    expect(isMotionTripped("unavailable")).toBe(false);
    expect(isMotionTripped(undefined)).toBe(false);
  });
});

describe("isSafetyTripped", () => {
  it("trips on the alarming words a safety sensor reports", () => {
    expect(isSafetyTripped("on")).toBe(true);       // a plain tripped binary_sensor
    expect(isSafetyTripped("detected")).toBe(true); // smoke/gas wording some integrations use literally
    expect(isSafetyTripped("wet")).toBe(true);       // moisture wording some integrations use literally
    expect(isSafetyTripped("open")).toBe(true);      // door left open
  });
  it("is clear on off/closed/dry", () => {
    expect(isSafetyTripped("off")).toBe(false);
    expect(isSafetyTripped("closed")).toBe(false);
    expect(isSafetyTripped("dry")).toBe(false);
  });
  it("fails closed on an outage -- never alarms because the sensor dropped out", () => {
    expect(isSafetyTripped("unavailable")).toBe(false);
    expect(isSafetyTripped("unknown")).toBe(false);
    expect(isSafetyTripped(undefined)).toBe(false);
  });
});

describe("isMarkerTripped", () => {
  const motion = { kind: "motion" as const };
  const safety = { kind: "safety" as const };
  it("routes a motion marker through isMotionTripped", () => {
    expect(isMarkerTripped(motion, "on")).toBe(true);
    expect(isMarkerTripped(motion, "detected")).toBe(false); // "detected" is not a motion state
  });
  it("routes a safety marker through isSafetyTripped", () => {
    expect(isMarkerTripped(safety, "wet")).toBe(true);
    expect(isMarkerTripped(safety, "off")).toBe(false);
  });
});

// Full recursive serialization (strings interleaved with values, including a
// nested TemplateResult like the foreignObject's ripple) -- same helper used
// by render.test.ts's renderFurniture reactive-glyph tests.
interface TplLike { strings: readonly string[]; values: unknown[] }
const isTpl = (v: unknown): v is TplLike => !!v && typeof v === "object" && "strings" in v && "values" in v;
const serialize = (t: unknown): string => {
  const tpl = t as TplLike;
  let out = tpl.strings[0];
  for (let i = 0; i < tpl.values.length; i++) {
    const v = tpl.values[i];
    out += isTpl(v) ? serialize(v) : String(v);
    out += tpl.strings[i + 1];
  }
  return out;
};

describe("renderAwarenessMarker — motion", () => {
  const marker: AwarenessMarker = { id: "m1", x: 120, y: 80, entity: "binary_sensor.hall_motion", kind: "motion" };

  it("hosts the reused ripple in a foreignObject, 80 canvas units square, centred on the marker", () => {
    const out = serialize(renderAwarenessMarker(marker, false));
    expect(out).toContain("<foreignObject");
    expect(out).toContain("x=80");   // 120 - 80/2
    expect(out).toContain("y=40");   // 80 - 80/2
    expect(out).toContain("width=80");
    expect(out).toContain("height=80");
    expect(out).toContain("ripple");
  });

  it("the ripple is inactive when the motion sensor is clear", () => {
    expect(serialize(renderAwarenessMarker(marker, false))).not.toContain("ripple active");
  });

  it("the ripple animates when the motion sensor has fired", () => {
    expect(serialize(renderAwarenessMarker(marker, true))).toContain("ripple active");
  });
});

describe("renderAwarenessMarker — safety", () => {
  const marker: AwarenessMarker = { id: "s1", x: 50, y: 60, entity: "binary_sensor.kitchen_leak", kind: "safety" };

  it("draws a dim idle marker when clear", () => {
    const out = serialize(renderAwarenessMarker(marker, false));
    expect(out).toContain("fp-awareness-safety-idle");
    expect(out).not.toContain("fp-furn-anim-blink");
    expect(out).toContain("cx=50");
    expect(out).toContain("cy=60");
  });

  it("blinks in the alert palette when tripped, reusing the furniture blink animation", () => {
    const out = serialize(renderAwarenessMarker(marker, true));
    expect(out).toContain("fp-awareness-safety");
    expect(out).toContain("fp-furn-anim-blink");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/awareness.test.ts
```
Expected: FAIL — module `./awareness` does not exist.

- [ ] **Step 3: Implement `src/awareness.ts`**

```ts
import { svg, type SVGTemplateResult } from "lit";
import type { AwarenessMarker } from "./types";
import { DEFAULT_RIPPLE_SIZE } from "./types";
import { isEntityOn, renderRipple } from "./render";

/**
 * Whether a motion marker's entity currently reads as "movement seen".
 * Reuses the card's general on/open/home/playing test -- a motion
 * binary_sensor's "on" state IS "motion detected" in Home Assistant's own
 * wording.
 */
export function isMotionTripped(state: string | undefined): boolean {
  return isEntityOn(state);
}

/**
 * Literal state strings a safety sensor might report when it is alarming --
 * a leak (wet), smoke/gas (detected), a plain binary_sensor tripped (on), or
 * a door/window left open (open). Fails closed: an outage never alarms, only
 * a definite reading does -- same reasoning as entityIsActive and
 * trackerPresenceDetected in render.ts.
 */
const SAFETY_TRIPPED_STATES = new Set(["on", "detected", "wet", "open"]);

export function isSafetyTripped(state: string | undefined): boolean {
  if (state === undefined || state === "unavailable" || state === "unknown") return false;
  return SAFETY_TRIPPED_STATES.has(state);
}

/** Whether a marker's own entity is tripped, dispatching on its kind. */
export function isMarkerTripped(
  marker: Pick<AwarenessMarker, "kind">,
  state: string | undefined,
): boolean {
  return marker.kind === "motion" ? isMotionTripped(state) : isSafetyTripped(state);
}

/**
 * A motion marker's ripple, in canvas units rather than the fixed screen
 * pixels the per-item ripple display uses -- an awareness marker is a point
 * on the floor plan, so its ping should scale with the plan the way the
 * tracker's own rings do, not stay a fixed on-screen size regardless of
 * zoom. Reuses DEFAULT_RIPPLE_SIZE's numeric value as that canvas-unit
 * diameter.
 */
const AWARENESS_RIPPLE_SIZE = DEFAULT_RIPPLE_SIZE;

/**
 * renderRipple returns HTML (a div tree). To reuse it verbatim inside the
 * layer's required SVGTemplateResult, it is hosted in a foreignObject sized
 * and centred on the marker -- the standard way to embed HTML content
 * inside SVG.
 */
function renderMotionMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  const half = AWARENESS_RIPPLE_SIZE / 2;
  return svg`
    <foreignObject x=${marker.x - half} y=${marker.y - half}
                   width=${AWARENESS_RIPPLE_SIZE} height=${AWARENESS_RIPPLE_SIZE}>
      ${renderRipple(
        tripped,
        "var(--fp-awareness-motion-color, var(--primary-color, #03a9f4))",
        AWARENESS_RIPPLE_SIZE,
      )}
    </foreignObject>`;
}

const SAFETY_MARKER_RADIUS = 10;

/**
 * A safety marker: a small dim dot at rest, or a red/alert dot blinking with
 * the existing furniture blink animation (fp-furn-blink, defined in
 * floorplan-card.ts and editor.ts) once its sensor trips. See the
 * .fp-awareness-safety / .fp-awareness-safety-idle rules added alongside
 * that keyframe.
 */
function renderSafetyMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  return svg`<circle
    class="${tripped ? "fp-awareness-safety fp-furn-anim-blink" : "fp-awareness-safety-idle"}"
    cx=${marker.x} cy=${marker.y} r=${SAFETY_MARKER_RADIUS} />`;
}

/** Render one awareness marker, dispatching on its kind. */
export function renderAwarenessMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  return marker.kind === "motion"
    ? renderMotionMarker(marker, tripped)
    : renderSafetyMarker(marker, tripped);
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run src/awareness.test.ts
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/awareness.ts src/awareness.test.ts
git commit -m "Add awareness trip logic and per-marker rendering"
```

## Task 4: Alert-red safety CSS in both style blocks

**Files:**
- Modify: `src/floorplan-card.ts` (its `static styles = css\`...\`` block, right after the `fp-furn-blink` keyframes)
- Modify: `src/editor.ts` (its own `static styles` block, same insertion point)

No unit tests here — this is pure CSS, referenced by class name only (already covered by Task 3's serialized-markup assertions on `fp-awareness-safety` / `fp-awareness-safety-idle` / `fp-furn-anim-blink`). Verified by `tsc` + full suite + `build` staying green, and by the manual check in Task 6.

- [ ] **Step 1: `src/floorplan-card.ts`**

Find (inside `static styles`):
```
    @keyframes fp-furn-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0.25; }
    }
    @media (prefers-reduced-motion: reduce) {
      /* Every animation this card draws, not just the conditional ones. */
      .item.anim-pulse .badge,
      .item.anim-blink .badge,
      .fp-furn-anim-pulse,
      .fp-furn-anim-blink,
      .ripple.active .ring,
```
Replace with:
```
    @keyframes fp-furn-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0.25; }
    }
    /* Awareness layer (feature flag "awarenessLayer"): a safety marker
       (leak, smoke, door left open) reuses the fp-furn-blink keyframe above
       so it reads as the same alert language, tinted red/alert instead of
       the piece's own colour. Idle markers stay a faint neutral dot so the
       sensor is still visible on the plan at rest. */
    .fp-awareness-safety {
      fill: var(--fp-awareness-alert-color, #d32f2f);
    }
    .fp-awareness-safety-idle {
      fill: var(--disabled-text-color, #9e9e9e);
      fill-opacity: 0.35;
    }
    @media (prefers-reduced-motion: reduce) {
      /* Every animation this card draws, not just the conditional ones. */
      .item.anim-pulse .badge,
      .item.anim-blink .badge,
      .fp-furn-anim-pulse,
      .fp-furn-anim-blink,
      .ripple.active .ring,
```
(the rest of that media query — `.tracker-dot, .tracker-ring, .tracker-band { animation: none; } }` — is unchanged; `.fp-awareness-safety` needs no entry there because its only animation comes from the already-listed `.fp-furn-anim-blink` class applied alongside it).

- [ ] **Step 2: `src/editor.ts`**

Find (inside its `static styles`):
```
    @keyframes fp-furn-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0.25; }
    }
    @media (prefers-reduced-motion: reduce) {
      .fp-furn-anim-pulse,
      .fp-furn-anim-blink {
        animation: none;
      }
    }
```
Replace with:
```
    @keyframes fp-furn-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0.25; }
    }
    /* Awareness layer -- see the matching comment in floorplan-card.ts. The
       editor's own canvas does not yet place/animate these markers (that is
       future editor work), but this rule set is duplicated here per the
       existing convention (see the smart-furniture comment above) so any
       later preview render already has the styling available. */
    .fp-awareness-safety {
      fill: var(--fp-awareness-alert-color, #d32f2f);
    }
    .fp-awareness-safety-idle {
      fill: var(--disabled-text-color, #9e9e9e);
      fill-opacity: 0.35;
    }
    @media (prefers-reduced-motion: reduce) {
      .fp-furn-anim-pulse,
      .fp-furn-anim-blink {
        animation: none;
      }
    }
```

- [ ] **Step 3: Typecheck + full suite + build**

```bash
npx tsc --noEmit
npx vitest run --reporter=dot
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/floorplan-card.ts src/editor.ts
git commit -m "Add the awareness layer's alert-red safety CSS to both style blocks"
```

## Task 5: The `LiveLayer` (`src/awareness-layer.ts`) + registration

**Files:**
- Create: `src/awareness-layer.ts`
- Modify: `src/floorplan-card.ts` (one import line)
- Test: `src/awareness-layer.test.ts`

**Interfaces:**
- Consumes: `LiveLayer`, `LayerRenderCtx`, `LIVE_LAYERS`, `enabledLayers`, `layerWatchedEntities` from `src/layers.ts`; `getFloors`, `FloorplanCardConfig` from `src/types.ts`; `isMarkerTripped`, `renderAwarenessMarker` from `src/awareness.ts`.
- Produces: `awarenessLayer` (the Produced interfaces block above).

- [ ] **Step 1: Write the failing tests**

Create `src/awareness-layer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { awarenessLayer } from "./awareness-layer";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";
import type { Floor, FloorplanCardConfig } from "./types";

const baseFloor: Floor = {
  id: "f1", name: "Floor 1", walls: [], openings: [], items: [], texts: [],
  furniture: [], trackers: [],
};

const markerMotion = { id: "m1", x: 10, y: 20, entity: "binary_sensor.hall_motion", kind: "motion" as const };
const markerSafety = { id: "s1", x: 30, y: 40, entity: "binary_sensor.kitchen_leak", kind: "safety" as const };

describe("awarenessLayer", () => {
  it("registers itself in LIVE_LAYERS on import", () => {
    expect(LIVE_LAYERS.some((l) => l.id === "awarenessLayer")).toBe(true);
  });

  it("carries the awarenessLayer feature id, a label, and an icon", () => {
    expect(awarenessLayer.id).toBe("awarenessLayer");
    expect(awarenessLayer.label).toBeTruthy();
    expect(awarenessLayer.icon).toBeTruthy();
  });

  it("watches every awareness marker's entity, across floors", () => {
    const c = {
      type: "x", width: 10, height: 10,
      floors: [
        { ...baseFloor, awareness: [markerMotion] },
        { ...baseFloor, id: "f2", awareness: [markerSafety] },
      ],
    } as unknown as FloorplanCardConfig;
    expect([...awarenessLayer.watched(c)].sort()).toEqual(
      ["binary_sensor.hall_motion", "binary_sensor.kitchen_leak"].sort(),
    );
  });

  it("watches nothing on a floor with no markers", () => {
    const c = { type: "x", width: 10, height: 10, floors: [baseFloor] } as unknown as FloorplanCardConfig;
    expect([...awarenessLayer.watched(c)]).toEqual([]);
  });

  it("renders nothing for a floor with no markers", () => {
    const out = awarenessLayer.render({ floor: baseFloor, hass: undefined, config: {} as FloorplanCardConfig });
    const tpl = out as unknown as { strings: readonly string[]; values: unknown[] };
    expect(tpl.strings).toEqual([""]);
    expect(tpl.values).toEqual([]);
  });

  it("renders a marker per entry on the active floor", () => {
    const floor = { ...baseFloor, awareness: [markerMotion, markerSafety] };
    const out = awarenessLayer.render({ floor, hass: undefined, config: {} as FloorplanCardConfig });
    const tpl = out as unknown as { values: unknown[] };
    expect(tpl.values).toHaveLength(1); // the single ${markers.map(...)} binding
    expect((tpl.values[0] as unknown[]).length).toBe(2); // one rendered marker per entry
  });

  it("end-to-end through the real framework registry: off by default, on when the flag is set", () => {
    const off = {
      type: "x", width: 10, height: 10,
      floors: [{ ...baseFloor, awareness: [markerMotion] }],
    } as unknown as FloorplanCardConfig;
    const on = { ...off, features: { awarenessLayer: true } } as FloorplanCardConfig;
    expect(enabledLayers(off).some((l) => l.id === "awarenessLayer")).toBe(false);
    expect(layerWatchedEntities(off).has("binary_sensor.hall_motion")).toBe(false);
    expect(enabledLayers(on).some((l) => l.id === "awarenessLayer")).toBe(true);
    expect(layerWatchedEntities(on).has("binary_sensor.hall_motion")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/awareness-layer.test.ts
```
Expected: FAIL — module `./awareness-layer` does not exist.

- [ ] **Step 3: Implement `src/awareness-layer.ts`**

```ts
import { svg, type SVGTemplateResult } from "lit";
import type { FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";
import { LIVE_LAYERS } from "./layers";
import { isMarkerTripped, renderAwarenessMarker } from "./awareness";

/** Every awareness marker's entity, across all floors -- what the card must
 * watch for this layer to redraw when a sensor changes state. */
function awarenessWatchedEntities(c: FloorplanCardConfig): string[] {
  const ids: string[] = [];
  for (const f of getFloors(c)) {
    for (const m of f.awareness ?? []) ids.push(m.entity);
  }
  return ids;
}

/** The active floor's awareness markers, each resolved against `hass` and
 * drawn via renderAwarenessMarker. Empty floor -> empty svg (no group). */
function renderAwarenessLayer(ctx: LayerRenderCtx): SVGTemplateResult {
  const markers = ctx.floor.awareness ?? [];
  if (!markers.length) return svg``;
  return svg`<g class="fp-awareness" pointer-events="none">
    ${markers.map((m) =>
      renderAwarenessMarker(m, isMarkerTripped(m, ctx.hass?.states[m.entity]?.state)),
    )}
  </g>`;
}

export const awarenessLayer: LiveLayer = {
  id: "awarenessLayer",
  label: "Awareness",
  icon: "mdi:motion-sensor",
  render: renderAwarenessLayer,
  watched: awarenessWatchedEntities,
};

// Registration side effect. Guarded so importing this module more than once
// in the same process (e.g. from more than one entry point) never double-adds
// the layer to the shared registry.
if (!LIVE_LAYERS.some((l) => l.id === "awarenessLayer")) {
  LIVE_LAYERS.push(awarenessLayer);
}
```

In `src/floorplan-card.ts`, add one import near the top (after the existing `import { normalizeRotation, stageAspect, plateClass, plateVars, counterRotate } from "./rotation";` line):
```ts
// Side-effect import: registers the awareness layer into the layer
// framework's LIVE_LAYERS registry. Nothing else in this file changes --
// the framework renders/toggles/watches it generically once registered.
import "./awareness-layer";
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run src/awareness-layer.test.ts
```

- [ ] **Step 5: Typecheck + full suite + build + commit**

```bash
npx tsc --noEmit
npx vitest run --reporter=dot
npm run build
git add src/awareness-layer.ts src/awareness-layer.test.ts src/floorplan-card.ts
git commit -m "Register the awareness layer with the live-layer framework"
```

## Task 6 (controller): Verify + gate

- [ ] Full suite, `tsc`, and `build` all green (`npx vitest run --reporter=dot && npx tsc --noEmit && npm run build`).
- [ ] Confirm zero cost when off, at both levels:
  - Unit: Task 5's "off by default, on when the flag is set" test, run against the REAL registered `awarenessLayer` via the real `enabledLayers`/`layerWatchedEntities` — not a fake layer — so this is an end-to-end proof, not just a framework-level one.
  - Manual: temporarily add a `features: { awarenessLayer: true }` block and 1-2 `awareness` markers (one `motion`, one `safety`, entities that exist in the dev harness's fake `hass`) to the sample config in `dev/dev.ts`, run `npm run serve`, confirm the motion ripple pings and the safety marker blinks red when its entity is toggled tripped/clear in the harness. Then set the flag back to `false` (or remove the temporary block) before committing anything — the harness config is not part of this plan's deliverable.
- [ ] Confirm a config with `awareness` markers present but `features.awarenessLayer` unset (or `false`) draws no `fp-awareness` group and adds none of the markers' entities to the card's watched set — covered by the automated end-to-end test above; no separate manual step needed.
- [ ] Confirm the schema diff (`schema/floorplan-card.schema.json`) is additive-only: existing example configs still validate (`npx vitest run src/schema.test.ts`, specifically the "the worked example validates" case).

## Self-Review
- Spec coverage: `LiveLayer` registration gated on `featureEnabled` via the framework's `enabledLayers` (Task 5) ✓; `AwarenessMarker` type + per-floor list in `types.ts` + validator + schema (Tasks 1-2) ✓; `renderRipple` reused for motion pings via a `foreignObject` host, blink CSS reused (`fp-furn-blink`) with a new alert-red variant in both card+editor style blocks (Tasks 3-4) ✓; trip logic (motion: `isEntityOn`; safety: on/detected/wet/open) with unit tests (Task 3) ✓.
- No backticks appear in any `css` comment added (Task 4) ✓.
- Byte-identical + nothing watched when off: guaranteed by the framework's existing flag-gated `enabledLayers`/`layerWatchedEntities`, re-verified end-to-end against the real registered layer (Task 5), not re-implemented per-layer ✓.
- `awareness` follows the `rooms` optional-list convention exactly, including `normalizeFloor`'s deliberate non-backfill, with a regression test locking that in (Task 1) ✓.
- Type consistency: `AwarenessMarker`/`AwarenessKind` (Task 1) match the shape validated in Task 2, rendered in Task 3, and consumed by `awareness-layer.ts` in Task 5 — same field names throughout (`id`, `x`, `y`, `entity`, `kind`). `isMarkerTripped`'s signature (`Pick<AwarenessMarker, "kind">`, `state: string | undefined`) matches every call site in Tasks 3 and 5.
- No placeholder steps; every code step shows the code; every file path is exact.
