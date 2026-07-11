# Room Tap Scenes (2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping (or holding / double-tapping) a room runs a Lovelace action, with a built-in "toggle all lights in this room's area" convenience — mirroring how furniture is already tappable, gated behind `featureEnabled(config, "roomTapScenes")`.

**Architecture:** `Room` gains the same `tap_action?/hold_action?/double_tap_action?: ActionConfig` trio `Furniture` already has. A pure gate function `roomIsTappable(config, room)` (in `render.ts`) decides, per room, whether to wrap its decoration polygon in a `<g class="fp-room-tap">` + transparent `<polygon class="fp-room-hit">` — exactly the `.fp-furn-tap`/`.fp-furn-hit` pattern `floorplan-card.ts` already uses for furniture. A pure resolver `resolveRoomAction` (in `areas.ts`) turns a gesture into either the generic `ActionConfig` path (reusing `actionForGesture`/`executeAction` verbatim) or the new `"toggle-area-lights"` convenience, which calls a new `lightsInArea` helper.

**Tech Stack:** Lit + TypeScript, Vitest, `typescript-json-schema` for schema.

## Global Constraints

- Nothing outward; local commits only; **no AI-authorship footers**; nothing pushed anywhere.
- **Hard dependency:** this plan consumes `featureEnabled` / `FeaturesConfig` from `docs/superpowers/plans/2026-07-10-feature-toggles.md` (specifically its Task 1: `src/features.ts` + `FeaturesConfig.roomTapScenes` on `src/types.ts`). Task 0 below is a gate that verifies this landed before any other task starts — do not reimplement `src/features.ts` here.
- Branch `feat/room-tap-scenes` off `main` (or off `feat/feature-toggles` if that branch hasn't merged into `main` yet — check with `git log main..feat/feature-toggles` before deciding).
- **Byte-identical when off / when a room has no action.** A room with `featureEnabled(config, "roomTapScenes")` false, or one with no `tap_action`/`hold_action`/`double_tap_action` set, renders the exact same `renderRoom(...)` output as today — no wrapping `<g>`, no hit polygon, no new DOM.
- Zero cost when off: the feature adds no watched entities. The "toggle area lights" convenience resolves the area's light entities live from the HA registries (`hass.entities`/`hass.devices`/`hass.areas`) at click time, not via reactive state-watching, so `collectWatchedEntities` needs **no** change.
- Adding fields to `Room` changes the generated schema → run `npm run schema` and commit the additive diff (the `schema.test.ts` drift test enforces it).
- The validator (`src/validate.ts`) already lets unknown keys through its `shape()` helper (forward-compat) — this is how `Furniture.tap_action` etc. validate today with **no** dedicated check in `furniture`'s shape. Confirmed by reading `src/validate.ts:57-60`: `furniture`'s optional map has no `tap_action` entry at all. Rooms get the same treatment: **no validator code changes**, only a regression-lock test proving it.
- Editor GUI for actions is out of scope. Confirmed by `grep -n "tap_action" src/editor.ts` returning nothing — furniture and items have no action-editing UI either; actions are YAML-only today. This plan does not add one for rooms.
- Landmine: no backticks in `css` tagged-template comments (`src/floorplan-card.ts`'s `static styles = css\`...\``).
- Run: `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.

## Produced interfaces (later tasks in this plan consume these — exact names/types)

```ts
// src/types.ts — Room gains the same action trio as Furniture (Task 1)
export interface Room {
  // ...existing fields unchanged...
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

// src/actions.ts (Task 2 adds this one export; everything else already exists)
export function hasAnyAction(item: {
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}): boolean;

// src/areas.ts (Task 3 adds these)
export const TOGGLE_AREA_LIGHTS_ACTION = "toggle-area-lights";

export function lightsInArea(hass: unknown, areaId: string): string[];

export type RoomActionResolution =
  | { kind: "toggle-lights"; entityIds: string[] }
  | { kind: "generic"; config: ActionConfig | undefined };

export function resolveRoomAction(
  room: {
    tap_action?: ActionConfig;
    hold_action?: ActionConfig;
    double_tap_action?: ActionConfig;
    areaId?: string;
  },
  gesture: "tap" | "hold" | "double_tap",
  hass: unknown,
): RoomActionResolution;

// src/render.ts (Task 4 adds this one export)
export function roomIsTappable(c: FloorplanCardConfig, r: Room): boolean;
// = featureEnabled(c, "roomTapScenes") && hasAnyAction(r)
```

Consumers: `src/floorplan-card.ts` (Task 5) imports `roomIsTappable` from `./render` and `resolveRoomAction` from `./areas`, and reuses `actionHandler`/`hasAction`/`executeAction` exactly as the furniture path already does.

---

## Task 0: Confirm the feature-toggles dependency landed

**Files:** none (verification only).

**Interfaces:**
- Consumes: `src/features.ts` (`featureEnabled`, `FeaturesConfig`) as produced by `docs/superpowers/plans/2026-07-10-feature-toggles.md` Task 1.

- [ ] **Step 1: Check the dependency exists**

```bash
test -f src/features.ts && grep -n "roomTapScenes" src/features.ts src/types.ts
```

Expected: `src/features.ts` exists and `roomTapScenes` appears in both `FEATURE_DEFAULTS`/`FEATURE_META` (in `src/features.ts`) and the `FeaturesConfig` interface (in `src/types.ts`).

- [ ] **Step 2: If the check fails, stop**

Do not proceed with this plan. Implement `docs/superpowers/plans/2026-07-10-feature-toggles.md` (at least its Task 1) first, then restart this plan from Task 1 below.

- [ ] **Step 3: If the check passes, continue to Task 1.** No commit for this task (nothing changed).

---

## Task 1: `Room` gains action fields + validator regression-lock + schema

**Files:**
- Modify: `src/types.ts` (`Room` interface, ~line 139-152)
- Modify: `src/validate.test.ts` (regression-lock test — no `src/validate.ts` change)
- Modify: `schema/floorplan-card.schema.json` (regenerated, not hand-edited)

**Interfaces:**
- Produces: `Room.tap_action` / `Room.hold_action` / `Room.double_tap_action` (see Produced interfaces block).

- [ ] **Step 1: Write the failing test** — a room with all three action fields must still validate, exactly like furniture does today. Add to `src/validate.test.ts` inside (or near) the existing `describe("validateConfig", ...)` block:

```ts
it("accepts a room with tap_action/hold_action/double_tap_action (rides as allowed-unknown, like furniture's actions)", () => {
  const cfg = {
    type: "x",
    width: 10,
    height: 10,
    rooms: [
      {
        id: "r1",
        points: [[0, 0], [1, 0], [1, 1], [0, 1]],
        tap_action: { action: "toggle-area-lights" },
        hold_action: { action: "more-info" },
        double_tap_action: { action: "none" },
      },
    ],
  };
  expect(validateConfig(cfg).ok).toBe(true);
});
```

- [ ] **Step 2: Run it, verify it ALREADY passes**

```bash
npx vitest run src/validate.test.ts
```

Expected: PASS immediately. `shape()`'s forward-compat rule (unknown keys pass through) already accepts these fields on a room object at the JS level — this test only locks that behavior in as a regression guard. **Do not add a `tap_action`/`hold_action`/`double_tap_action` entry to `room`'s `shape()` call in `src/validate.ts`** — furniture doesn't have one either (verify: `grep -n "^const furniture" -A2 src/validate.ts` shows no action keys in its optional map).

- [ ] **Step 3: Add the fields to the `Room` type** — in `src/types.ts`, the `Room` interface currently ends:

```ts
export interface Room {
  id: string;
  name?: string;
  /** Closed polygon in canvas units; the closing edge is implicit. */
  points: Array<[number, number]>;
  /** A CSS colour. Default: none. */
  fill?: string;
  /** 0..1. Default 0.25 — a room tint must not fight the walls drawn over it. */
  fillOpacity?: number;
  /** Conditional fill, first match wins. `color: "rgb"` follows a light. */
  stateStyles?: StateStyle[];
  /** Home Assistant area id. Stored, not yet acted on (see Floor.haFloor). */
  areaId?: string;
}
```

Change the trailing field + closing brace to:

```ts
export interface Room {
  id: string;
  name?: string;
  /** Closed polygon in canvas units; the closing edge is implicit. */
  points: Array<[number, number]>;
  /** A CSS colour. Default: none. */
  fill?: string;
  /** 0..1. Default 0.25 — a room tint must not fight the walls drawn over it. */
  fillOpacity?: number;
  /** Conditional fill, first match wins. `color: "rgb"` follows a light. */
  stateStyles?: StateStyle[];
  /** Home Assistant area id. Stored, not yet acted on (see Floor.haFloor). */
  areaId?: string;
  /**
   * Lovelace actions (see {@link ActionConfig}), mirroring `Furniture`. Unlike
   * items/furniture, a room has no entity of its own, so there is no implicit
   * default tap action — an unconfigured room stays a non-interactive shape.
   * `{ action: "toggle-area-lights" }` is a card-specific convenience: toggle
   * every `light.*` entity in the room's `areaId` (see {@link resolveRoomAction}
   * in `./areas`).
   */
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}
```

- [ ] **Step 4: Run the test again + typecheck**

```bash
npx vitest run src/validate.test.ts && npx tsc --noEmit
```

Expected: both PASS.

- [ ] **Step 5: Regenerate the schema**

```bash
npm run schema
git diff --stat schema/floorplan-card.schema.json
```

Expected: the diff adds `tap_action`/`hold_action`/`double_tap_action` (each `$ref: "#/definitions/ActionConfig"`) to the `Room` definition, additive only.

- [ ] **Step 6: Confirm the schema drift test passes**

```bash
npx vitest run src/schema.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Add tap/hold/double_tap actions to Room (2a)"
```

---

## Task 2: `hasAnyAction` helper

**Files:**
- Modify: `src/actions.ts` (add the export, alongside `hasAction`)
- Modify: `src/actions.test.ts`

**Interfaces:**
- Consumes: `ActionConfig` (`./types`), `hasAction` (already in this file).
- Produces: `hasAnyAction` (see Produced interfaces block).

- [ ] **Step 1: Write the failing test** — add to `src/actions.test.ts`, near the existing `describe("hasAction", ...)` block:

```ts
describe("hasAnyAction", () => {
  it("false with no actions configured", () => {
    expect(hasAnyAction({})).toBe(false);
  });
  it("false when every configured action is explicitly none", () => {
    expect(hasAnyAction({ tap_action: { action: "none" } })).toBe(false);
  });
  it("true when tap_action is a real action", () => {
    expect(hasAnyAction({ tap_action: { action: "toggle-area-lights" } })).toBe(true);
  });
  it("true when only hold_action or double_tap_action is set", () => {
    expect(hasAnyAction({ hold_action: { action: "more-info" } })).toBe(true);
    expect(hasAnyAction({ double_tap_action: { action: "navigate" } })).toBe(true);
  });
});
```

Add `hasAnyAction` to the existing `import { ... } from "./actions";` line at the top of `src/actions.test.ts`.

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/actions.test.ts
```

Expected: FAIL — `hasAnyAction` is not exported.

- [ ] **Step 3: Implement** — in `src/actions.ts`, directly below the existing `hasAction` function:

```ts
export function hasAction(config?: ActionConfig): boolean {
  return config !== undefined && config.action !== "none";
}

/**
 * Whether an action-bearing item explicitly configures at least one gesture.
 * Used to gate an *optional* tap target (currently: rooms) on there being
 * something to do — unlike items/furniture, a room has no entity-driven
 * default action, so "has an action" only ever means "the config set one".
 */
export function hasAnyAction(item: {
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}): boolean {
  return hasAction(item.tap_action) || hasAction(item.hold_action) || hasAction(item.double_tap_action);
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run src/actions.test.ts
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/actions.ts src/actions.test.ts
git commit -m "Add hasAnyAction, gates optional tap targets like rooms (2a)"
```

---

## Task 3: `lightsInArea` + `resolveRoomAction` in `areas.ts`

**Files:**
- Modify: `src/areas.ts` (add exports; add `import type { ActionConfig } from "./types";` and `import { actionForGesture } from "./actions";`)
- Modify: `src/areas.test.ts`

**Interfaces:**
- Consumes: `entitiesInArea` (already in this file), `actionForGesture` (`./actions`), `ActionConfig` (`./types`).
- Produces: `TOGGLE_AREA_LIGHTS_ACTION`, `lightsInArea`, `RoomActionResolution`, `resolveRoomAction` (see Produced interfaces block).

- [ ] **Step 1: Write the failing tests** — add to `src/areas.test.ts`. The file already defines a `hass` fixture (top of file) with `light.k` and `light.viadev` both in `"kitchen"`, `light.override` in `"bath"`, and `sensor.other` in `"bath"` — reuse it as-is:

```ts
describe("lightsInArea", () => {
  it("keeps only light.* entities in the area", () => {
    expect(lightsInArea(hass, "kitchen")).toEqual(["light.k", "light.viadev"]);
  });
  it("returns [] for an area with no lights", () => {
    expect(lightsInArea(hass, "bath")).toEqual([]);
  });
});

describe("resolveRoomAction", () => {
  it("resolves the toggle-area-lights convenience to the area's light entities", () => {
    const room = { tap_action: { action: TOGGLE_AREA_LIGHTS_ACTION }, areaId: "kitchen" };
    expect(resolveRoomAction(room, "tap", hass)).toEqual({
      kind: "toggle-lights",
      entityIds: ["light.k", "light.viadev"],
    });
  });
  it("resolves to [] entity ids when the room has no areaId", () => {
    const room = { tap_action: { action: TOGGLE_AREA_LIGHTS_ACTION } };
    expect(resolveRoomAction(room, "tap", hass)).toEqual({ kind: "toggle-lights", entityIds: [] });
  });
  it("falls through to the generic ActionConfig path for a normal action", () => {
    const room = { tap_action: { action: "more-info" }, areaId: "kitchen" };
    expect(resolveRoomAction(room, "tap", hass)).toEqual({
      kind: "generic",
      config: { action: "more-info" },
    });
  });
  it("resolves per-gesture, like actionForGesture", () => {
    const room = { hold_action: { action: "navigate", navigation_path: "/x" } };
    expect(resolveRoomAction(room, "hold", hass)).toEqual({
      kind: "generic",
      config: { action: "navigate", navigation_path: "/x" },
    });
  });
  it("an unconfigured gesture resolves to no action (rooms have no implicit default)", () => {
    expect(resolveRoomAction({}, "tap", hass)).toEqual({ kind: "generic", config: { action: "none" } });
  });
});
```

Add `lightsInArea, resolveRoomAction, TOGGLE_AREA_LIGHTS_ACTION` to the existing `import { ... } from "./areas";` line at the top of `src/areas.test.ts`.

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/areas.test.ts
```

Expected: FAIL — the three new exports don't exist yet.

- [ ] **Step 3: Implement** — in `src/areas.ts`, add the import and the new exports. Change the top imports:

```ts
import type { ItemKind, Room, ActionConfig } from "./types";
import { kindFromEntity } from "./render";
import { actionForGesture } from "./actions";
```

Add after `entitiesInArea` (after line 49, before `export interface Bbox`):

```ts
/** Sentinel action value: the room "toggle all lights in this room's area" convenience (2a). */
export const TOGGLE_AREA_LIGHTS_ACTION = "toggle-area-lights";

/** Light entities (domain `light.*`) in an area — the room "toggle area lights" convenience. */
export function lightsInArea(hass: unknown, areaId: string): string[] {
  return entitiesInArea(hass, areaId).filter((id) => id.startsWith("light."));
}

export type RoomActionResolution =
  | { kind: "toggle-lights"; entityIds: string[] }
  | { kind: "generic"; config: ActionConfig | undefined };

/**
 * Resolve a room gesture (tap/hold/double_tap) into either the built-in
 * "toggle area lights" convenience or a generic {@link ActionConfig} for
 * `executeAction`. Pure and registry-driven, so the room-tap behaviour is
 * fully unit-testable without mounting the card.
 */
export function resolveRoomAction(
  room: {
    tap_action?: ActionConfig;
    hold_action?: ActionConfig;
    double_tap_action?: ActionConfig;
    areaId?: string;
  },
  gesture: "tap" | "hold" | "double_tap",
  hass: unknown,
): RoomActionResolution {
  const config = actionForGesture(
    { tap_action: room.tap_action, hold_action: room.hold_action, double_tap_action: room.double_tap_action },
    gesture,
  );
  if (config?.action === TOGGLE_AREA_LIGHTS_ACTION) {
    return { kind: "toggle-lights", entityIds: room.areaId ? lightsInArea(hass, room.areaId) : [] };
  }
  return { kind: "generic", config };
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run src/areas.test.ts
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/areas.ts src/areas.test.ts
git commit -m "Add lightsInArea + resolveRoomAction, the toggle-area-lights convenience (2a)"
```

---

## Task 4: `roomIsTappable` gate in `render.ts`

**Files:**
- Modify: `src/render.ts` (add the export; add `import { featureEnabled } from "./features";` and `import { hasAnyAction } from "./actions";`)
- Modify: `src/render.test.ts`

**Interfaces:**
- Consumes: `featureEnabled` (`./features`, produced by the feature-toggles plan — see Task 0 gate), `hasAnyAction` (`./actions`, Task 2), `Room`/`FloorplanCardConfig` (`./types`).
- Produces: `roomIsTappable` (see Produced interfaces block).

- [ ] **Step 1: Write the failing test** — add to `src/render.test.ts`, near the existing `describe("renderRoom (#6)", ...)` block. Add `roomIsTappable` to the file's `import { ... } from "./render";` line, and `FloorplanCardConfig` to its `import type { ... } from "./types";` line if not already present:

```ts
describe("roomIsTappable (2a)", () => {
  const tapRoom: Room = {
    id: "r",
    points: [[0, 0], [10, 0], [10, 10], [0, 10]],
    tap_action: { action: "toggle-area-lights" },
  };
  const bareRoom: Room = { id: "r2", points: [[0, 0], [10, 0], [10, 10], [0, 10]] };
  const cfgOff = { type: "x", width: 10, height: 10 } as FloorplanCardConfig;
  const cfgOn = { type: "x", width: 10, height: 10, features: { roomTapScenes: true } } as FloorplanCardConfig;

  it("off by default (no features block) even with an action configured", () => {
    expect(roomIsTappable(cfgOff, tapRoom)).toBe(false);
  });
  it("feature on but no action configured stays untappable", () => {
    expect(roomIsTappable(cfgOn, bareRoom)).toBe(false);
  });
  it("feature on + an explicit tap_action makes the room tappable", () => {
    expect(roomIsTappable(cfgOn, tapRoom)).toBe(true);
  });
  it("feature on + only a hold_action is enough", () => {
    expect(roomIsTappable(cfgOn, { ...bareRoom, hold_action: { action: "more-info" } })).toBe(true);
  });
  it("feature explicitly off overrides an action being configured", () => {
    const cfgExplicitOff = { ...cfgOn, features: { roomTapScenes: false } };
    expect(roomIsTappable(cfgExplicitOff, tapRoom)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/render.test.ts
```

Expected: FAIL — `roomIsTappable` is not exported.

- [ ] **Step 3: Implement** — in `src/render.ts`, add the two imports at the top (extend the existing `import type {...} from "./types"` block is not needed; these are new module imports):

```ts
import { featureEnabled } from "./features";
import { hasAnyAction } from "./actions";
```

Add the function directly above `renderRoom` (before line 915's `/** Default tint... */` comment, i.e. right after the closing of the previous export and before `export const ROOM_FILL_OPACITY`):

```ts
/**
 * Whether a room should get the tap-to-run-scene hit polygon (2a): the
 * `roomTapScenes` feature is on AND the room explicitly configures at least
 * one gesture. A room with the feature on but no action stays a plain,
 * non-interactive shape — nothing to tap means nothing should look tappable.
 */
export function roomIsTappable(c: FloorplanCardConfig, r: Room): boolean {
  return featureEnabled(c, "roomTapScenes") && hasAnyAction(r);
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run src/render.test.ts
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/render.ts src/render.test.ts
git commit -m "Add roomIsTappable gate (featureEnabled + hasAnyAction) (2a)"
```

---

## Task 5: Wire the room hit polygon + click handling into `floorplan-card.ts`

**Files:**
- Modify: `src/floorplan-card.ts`:
  - imports (lines 1-38)
  - a new `_handleRoomAction` method, next to `_handleFurnitureAction` (~line 163-169)
  - the rooms render block (~line 355-357)
  - the `styles` `css` block, next to `.fp-furn-hit` (~line 590-593)
- Modify: `src/floorplan-card.guard.test.ts` (source-guard tests — this component has no DOM-mounting tests in this repo; see the existing `preserveAspectRatio`/`.plate` guards for the established pattern)

**Interfaces:**
- Consumes: `roomIsTappable` (`./render`, Task 4), `resolveRoomAction` (`./areas`, Task 3), `actionHandler`/`hasAction`/`executeAction` (existing, unchanged).

- [ ] **Step 1: Write the failing guard tests** — add to `src/floorplan-card.guard.test.ts`, inside the existing `describe("floorplan-card source guards", ...)` block:

```ts
it("gates the room hit-polygon on roomIsTappable and reuses the furniture action wiring (2a)", () => {
  expect(src).toContain("roomIsTappable(c, r)");
  expect(src).toContain('class="fp-room-tap"');
  expect(src).toContain('class="fp-room-hit"');
  expect(src).toContain("resolveRoomAction(");
  expect(src).toContain("_handleRoomAction");
});

it("styles the room hit polygon as an invisible, clickable overlay (2a)", () => {
  expect(src).toContain(".fp-room-tap {");
  expect(src).toContain(".fp-room-hit {");
});
```

- [ ] **Step 2: Run it, verify it fails**

```bash
npx vitest run src/floorplan-card.guard.test.ts
```

Expected: FAIL — none of these strings exist in `src/floorplan-card.ts` yet.

- [ ] **Step 3: Update the imports** — in `src/floorplan-card.ts`, change the `type` import from `./types` (currently line 3-5) to include `Room`:

```ts
import type {
  HomeAssistant, FloorplanCardConfig, FloorItem, FloorText, Floor, Rotation, Furniture, ItemKind, Room,
} from "./types";
```

Add `roomIsTappable` to the existing `import { ... } from "./render";` block (currently lines 15-34) — insert it alphabetically-ish next to `renderRoom`:

```ts
  renderRoom,
  roomIsTappable,
```

Add a new import line directly after the `./actions` import (currently line 36):

```ts
import { actionForGesture, executeAction, hasAction } from "./actions";
import { actionHandler } from "./action-handler";
import { resolveRoomAction } from "./areas";
```

- [ ] **Step 4: Add `_handleRoomAction`** — directly below the existing `_handleFurnitureAction` method (currently lines 163-169):

```ts
  private _handleFurnitureAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    f: Furniture
  ): void {
    if (!this.hass) return;
    executeAction(this, this.hass, f, actionForGesture(f, ev.detail.action));
  }

  /**
   * Tapping a room (2a): resolve either the built-in "toggle area lights"
   * convenience or a generic action, reusing `executeAction` exactly as
   * furniture does for the generic path.
   */
  private _handleRoomAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    r: Room
  ): void {
    if (!this.hass) return;
    const resolved = resolveRoomAction(r, ev.detail.action, this.hass);
    if (resolved.kind === "toggle-lights") {
      if (resolved.entityIds.length) {
        this.hass.callService("homeassistant", "toggle", { entity_id: resolved.entityIds });
      }
      return;
    }
    executeAction(this, this.hass, { entity: undefined }, resolved.config);
  }
```

- [ ] **Step 5: Wire the hit polygon into the rooms render block** — replace (currently lines 355-357):

```ts
            ${(active.rooms ?? []).map((r) =>
              renderRoom(r, resolveStateStyle(r.stateStyles, this.hass, undefined)),
            )}
```

with:

```ts
            ${(active.rooms ?? []).map((r) => {
              const shape = renderRoom(r, resolveStateStyle(r.stateStyles, this.hass, undefined));
              if (!roomIsTappable(c, r)) return shape;
              // A transparent hit polygon over the room, mirroring .fp-furn-hit --
              // the decoration polygon stays non-interactive (.room {pointer-events:
              // none}), this sibling carries the click. Same points as the room
              // itself: unlike furniture (a fixed local box), a room is an
              // arbitrary polygon, so the hit target is its own outline.
              const pts = r.points.map(([x, y]) => `${x},${y}`).join(" ");
              return svg`<g class="fp-room-tap"
                  @action=${(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>) =>
                    this._handleRoomAction(ev, r)}
                  .actionHandler=${actionHandler({
                    hasHold: hasAction(r.hold_action),
                    hasDoubleClick: hasAction(r.double_tap_action),
                  })}>
                  ${shape}
                  <polygon class="fp-room-hit" points=${pts} />
                </g>`;
            })}
```

- [ ] **Step 6: Add the CSS** — in the `static styles = css\`...\`` block, directly after the existing `.fp-furn-hit` rule (currently lines 590-593):

```css
    .fp-furn-hit {
      fill: transparent;
      pointer-events: all;
    }
    .fp-room-tap {
      cursor: pointer;
    }
    .fp-room-hit {
      fill: transparent;
      pointer-events: all;
    }
```

(No backticks anywhere in this comment/CSS — landmine from Global Constraints.)

- [ ] **Step 7: Run the guard tests, verify pass**

```bash
npx vitest run src/floorplan-card.guard.test.ts
```

- [ ] **Step 8: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/floorplan-card.ts src/floorplan-card.guard.test.ts
git commit -m "Make rooms tappable behind roomTapScenes: hit polygon + action wiring (2a)"
```

---

## Task 6 (controller): Verify + gate

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: all green, including every test added in Tasks 1-5.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds, `dist/easy-floorplan-card.js` produced.

- [ ] **Step 4: Manual byte-identical spot-check** — confirm the regression guarantee by reasoning through the code path (no test framework needed beyond what Task 4 already covers): with no `features` block, `roomIsTappable` returns `false` for every room regardless of `tap_action` (Task 4's first test proves this), so `floorplan-card.ts`'s `.map` always takes the `return shape;` branch — the exact same `renderRoom(...)` call as before this plan. Confirm by rereading the diff from Task 5 Step 5: the `if (!roomIsTappable(c, r)) return shape;` guard is the only new branch point, and `shape` is computed identically to the old single-line version.

- [ ] **Step 5: Self-Review against the spec** — reread `docs/superpowers/specs/2026-07-10-vision-roadmap.md` §2a and confirm:
  - "a room-level `tap_action` ... + an 'all lights in area' convenience action" — Tasks 1 + 3. ✓
  - "Reuse: `actionHandler`/`handleAction`, area membership (#25)" — Task 5 reuses `actionHandler`/`hasAction`/`executeAction` verbatim; Task 3 reuses `entitiesInArea` (the #25 area-membership helper) verbatim. ✓
  - Feature flag default off, zero cost when off — Global Constraints + Task 4's tests + Task 6 Step 4. ✓

- [ ] No commit for this task (verification only, nothing to stage).

## Self-Review

- **Spec coverage:** `Room` action fields + validator/schema (Task 1); hit polygon mirroring `.fp-furn-hit` gated on `featureEnabled(config,"roomTapScenes")` AND an action (Tasks 4-5); "toggle all lights in this room's area" convenience with a helper + unit test (Task 3's `lightsInArea` + `resolveRoomAction` tests); reuse of `actionHandler`/`handleAction` exactly as furniture (Task 5 Step 4-5, same `actionHandler({hasHold, hasDoubleClick})` + `@action` + `executeAction` calls). ✓
- **Placeholder scan:** every step shows real code (no "add appropriate handling" placeholders); Task 0 is intentionally a check-only gate, not a placeholder. ✓
- **Type consistency:** `RoomActionResolution`'s `kind: "toggle-lights" | "generic"` is used identically in Task 3's tests and Task 5's `_handleRoomAction`; `roomIsTappable(c, r)` signature matches its Task 4 definition and Task 5's call site; `hasAnyAction` takes the same three-field shape in Task 2 and is called with a full `Room` in Task 4 (structurally compatible — `Room` is a superset of the required shape). ✓
- **Validator finding, made explicit:** rooms need **zero** `src/validate.ts` changes for the action fields (Task 1 Step 2 proves the test already passes) — this mirrors furniture, which also validates actions by allowing unknown keys through rather than a dedicated check. ✓
- **Editor scope, made explicit:** no editor GUI task, because none exists for furniture/item actions either (verified by grep in Global Constraints). ✓
