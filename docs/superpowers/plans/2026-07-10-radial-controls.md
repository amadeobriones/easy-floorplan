# Long-Press Radial Quick Controls (2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-pressing an entity-bound item or furniture piece opens a small HTML popover, anchored to the tapped piece, with domain-aware quick controls (light toggle+brightness, switch toggle, climate setpoint +/-) — without leaving the plan or opening HA's more-info dialog.

**Architecture:** Two new modules. `src/radial-controls.ts` is pure logic — no DOM, no Lit — that decides *whether* a hold should open the popover (an explicit `hold_action` always wins; the popover only fills the gap when none is configured) and does the small math (service-call payloads, viewport-clamped positioning). `src/radial-popover.ts` is a tiny singleton `LitElement` appended to `document.body` (the same portal pattern `action-handler.ts` already uses for its own singleton), so the popover is never clipped by `.stage`'s or `ha-card`'s `overflow: hidden`. `src/floorplan-card.ts` wires the existing `actionHandler({ hasHold })` call sites to the gating logic and opens the popover on a qualifying hold.

This is explicitly the **largest UI task in the roadmap** (per `docs/superpowers/specs/2026-07-10-vision-roadmap.md`, Track 2 §2b) and ships in four increments: (1) pure gating + math, (2) the popover shell (positioning/dismiss, generic body), (3) wiring the real hold gesture to it, (4) the light/switch/climate control bodies. **Scope for v1 is deliberately light/switch/climate only** — see "Out of scope" in the Self-Review.

**Tech Stack:** Lit + TypeScript, Vitest, the existing `actionHandler`/`action-handler.ts` gesture directive, `hass.callService`.

## Global Constraints
- Nothing outward: local commits only, never push, no PRs/issues opened. **No AI-authorship footers** on any commit.
- **Prerequisite:** this plan consumes `featureEnabled(config, "radialControls")` and `FeaturesConfig.radialControls` from `docs/superpowers/plans/2026-07-10-feature-toggles.md`. As of this writing `src/features.ts` does not exist in the repo — **Task 0 below is a hard gate**: if that plan hasn't landed, execute it first (or stop and say so). Do not hand-roll a local copy of `featureEnabled`.
- **Byte-identical when off:** with `radialControls` unset or `false`, every `actionHandler({ hasHold: ... })` call site and every hold-gesture code path must produce the exact same behaviour as today — same `hasHold` value, same `executeAction` call, same DOM. This is verified by a dedicated test in Task 1 (`radialHasHold` reduces to `hasAction(hold_action)` when the flag is off) plus the wiring guard test in Task 3.
- An explicit `hold_action` on an item/furniture piece always wins over the popover, flag on or off — the popover only fills the gap where no `hold_action` is configured. This is a deliberate design choice to never silently override a user's own wiring; call it out in review if it should be revisited.
- Landmine: no backticks inside `css` tagged-template comments (existing repo rule — breaks the template).
- Branch: create `feat/radial-controls` off `main`. Local only.
- Run: `npx vitest run src/<f>.test.ts` per task; full suite `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.
- **No DOM-mounting test harness exists in this repo** (confirmed: no jsdom/happy-dom config, no test mounts a `LitElement`). Every existing test is either a pure-function unit test or a grep-based "guard test" against the raw source (see `src/floorplan-card.guard.test.ts`). This plan follows the same convention: push all decision logic into pure, unit-tested functions (Task 1); verify the Lit-rendered popover shell and controls **live**, via `npm run serve` and the `dev/` harness, backed by grep-based guard tests for structural invariants that would otherwise silently regress (e.g. "still opens via `document.body`", "still gates through `radialHasHold`"). Every DOM-bound step below says so explicitly and gives the exact manual check.

---

## Produced interfaces (later tasks in this plan consume these — exact names/types)
```ts
// src/radial-controls.ts (Task 1) — pure, no DOM
export type RadialDomain = "light" | "switch" | "climate";
export function radialDomainFor(entity: string | undefined): RadialDomain | undefined;
export function shouldOpenRadial(
  config: { features?: FeaturesConfig } | undefined,
  entity: string | undefined,
  holdAction: ActionConfig | undefined,
): boolean;
export function radialHasHold(
  config: { features?: FeaturesConfig } | undefined,
  entity: string | undefined,
  holdAction: ActionConfig | undefined,
): boolean;
export interface RadialServiceCall { domain: string; service: string; data: Record<string, unknown>; }
export function lightBrightnessCall(entity: string, brightnessPct: number): RadialServiceCall;
export function climateSetpointCall(entity: string, temperature: number): RadialServiceCall;
export function climateStep(current: number, direction: 1 | -1, step: number, min: number, max: number): number;
export interface PopoverRect { left: number; top: number; width: number; height: number; }
export function clampPopoverPosition(
  anchor: PopoverRect,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
  margin?: number,
): { left: number; top: number };

// src/radial-popover.ts (Task 2 shell, Task 4 fills in the domain bodies)
export interface RadialPopoverRequest { hass: HomeAssistant; entity: string; anchor: DOMRect; }
export function openRadialPopover(req: RadialPopoverRequest): void;
export function closeRadialPopover(): void;
```
Consumer: `src/floorplan-card.ts` (Task 3) imports `radialHasHold`/`shouldOpenRadial` from `./radial-controls` and `openRadialPopover` from `./radial-popover`, and is the *only* production call site — `src/editor.ts` must never import either module (guarded in Task 3).

---

## Task 0 (gate, not a deliverable): confirm the prerequisite landed

- [ ] **Step 1: Check `src/features.ts` exists and exports what this plan needs**
```bash
test -f /Users/amadeo/src/easy-floorplan/src/features.ts && grep -n "export function featureEnabled\|export interface FeaturesConfig\|radialControls" /Users/amadeo/src/easy-floorplan/src/features.ts /Users/amadeo/src/easy-floorplan/src/types.ts
```
Expected: `src/features.ts` exports `featureEnabled`, and `radialControls?: boolean;` appears in `FeaturesConfig` in `src/types.ts` (per `docs/superpowers/plans/2026-07-10-feature-toggles.md`). If either is missing, **stop this plan** and execute the feature-toggles plan first — do not proceed to Task 1 without it.

---

## Task 1: `src/radial-controls.ts` — pure gating, service-call, and positioning logic

**Files:**
- Create: `src/radial-controls.ts`
- Test: `src/radial-controls.test.ts`

**Interfaces:**
- Consumes: `featureEnabled` from `./features`, `hasAction` from `./actions`, `ActionConfig`/`FeaturesConfig`/`HomeAssistant` from `./types`.
- Produces: everything in the "Produced interfaces" block above under `radial-controls.ts`.

- [ ] **Step 1: Write the failing tests**
```ts
// src/radial-controls.test.ts
import { describe, it, expect } from "vitest";
import {
  radialDomainFor, shouldOpenRadial, radialHasHold,
  lightBrightnessCall, climateSetpointCall, climateStep, clampPopoverPosition,
} from "./radial-controls";

describe("radialDomainFor", () => {
  it("recognizes the three supported domains", () => {
    expect(radialDomainFor("light.lamp")).toBe("light");
    expect(radialDomainFor("switch.fan")).toBe("switch");
    expect(radialDomainFor("climate.hall")).toBe("climate");
  });
  it("returns undefined for an unsupported domain or no entity", () => {
    expect(radialDomainFor("lock.front_door")).toBeUndefined();
    expect(radialDomainFor(undefined)).toBeUndefined();
  });
});

describe("shouldOpenRadial", () => {
  const on = { features: { radialControls: true } };
  it("is false when the feature flag is off or unset", () => {
    expect(shouldOpenRadial({ features: { radialControls: false } }, "light.lamp", undefined)).toBe(false);
    expect(shouldOpenRadial(undefined, "light.lamp", undefined)).toBe(false);
    expect(shouldOpenRadial({}, "light.lamp", undefined)).toBe(false);
  });
  it("is false for an unsupported domain even with the flag on", () => {
    expect(shouldOpenRadial(on, "lock.front_door", undefined)).toBe(false);
  });
  it("is false with no entity", () => {
    expect(shouldOpenRadial(on, undefined, undefined)).toBe(false);
  });
  it("is false when an explicit hold_action is configured -- it always wins", () => {
    expect(shouldOpenRadial(on, "light.lamp", { action: "toggle" })).toBe(false);
  });
  it("is true for a supported domain, flag on, no (or none) hold_action", () => {
    expect(shouldOpenRadial(on, "light.lamp", undefined)).toBe(true);
    expect(shouldOpenRadial(on, "light.lamp", { action: "none" })).toBe(true);
  });
});

describe("radialHasHold", () => {
  it("matches hasAction(hold_action) when the flag is off -- byte-identical gating", () => {
    const off = { features: { radialControls: false } };
    expect(radialHasHold(off, "light.lamp", undefined)).toBe(false);
    expect(radialHasHold(off, "light.lamp", { action: "toggle" })).toBe(true);
    expect(radialHasHold(off, "light.lamp", { action: "none" })).toBe(false);
  });
  it("is true for a supported domain even with no hold_action when the flag is on", () => {
    const on = { features: { radialControls: true } };
    expect(radialHasHold(on, "light.lamp", undefined)).toBe(true);
  });
  it("stays true when a hold_action is ALSO configured (the handler routes to hold_action, not the popover)", () => {
    const on = { features: { radialControls: true } };
    expect(radialHasHold(on, "light.lamp", { action: "toggle" })).toBe(true);
  });
});

describe("lightBrightnessCall / climateSetpointCall", () => {
  it("builds a light.turn_on brightness_pct call, clamped to 1..100", () => {
    expect(lightBrightnessCall("light.lamp", 55)).toEqual({
      domain: "light", service: "turn_on", data: { entity_id: "light.lamp", brightness_pct: 55 },
    });
    expect(lightBrightnessCall("light.lamp", 0)).toEqual({
      domain: "light", service: "turn_on", data: { entity_id: "light.lamp", brightness_pct: 1 },
    });
    expect(lightBrightnessCall("light.lamp", 250)).toEqual({
      domain: "light", service: "turn_on", data: { entity_id: "light.lamp", brightness_pct: 100 },
    });
  });
  it("builds a climate.set_temperature call", () => {
    expect(climateSetpointCall("climate.hall", 21.5)).toEqual({
      domain: "climate", service: "set_temperature", data: { entity_id: "climate.hall", temperature: 21.5 },
    });
  });
});

describe("climateStep", () => {
  it("steps up and down by the given increment", () => {
    expect(climateStep(20, 1, 0.5, 7, 35)).toBe(20.5);
    expect(climateStep(20, -1, 0.5, 7, 35)).toBe(19.5);
  });
  it("clamps to min/max", () => {
    expect(climateStep(35, 1, 0.5, 7, 35)).toBe(35);
    expect(climateStep(7, -1, 0.5, 7, 35)).toBe(7);
  });
});

describe("clampPopoverPosition", () => {
  const viewport = { width: 400, height: 800 };
  it("centers above the anchor when there is room", () => {
    const anchor = { left: 150, top: 300, width: 40, height: 40 };
    const pos = clampPopoverPosition(anchor, { width: 200, height: 100 }, viewport);
    expect(pos.top).toBe(192); // 300 - 100 - 8
    expect(pos.left).toBe(70); // (150 + 20) - 100
  });
  it("flips below the anchor when there is no room above", () => {
    const anchor = { left: 150, top: 20, width: 40, height: 40 };
    const pos = clampPopoverPosition(anchor, { width: 200, height: 100 }, viewport);
    expect(pos.top).toBe(68); // 20 + 40 + 8
  });
  it("clamps left so the popover never spills past the viewport margin", () => {
    const anchor = { left: 0, top: 300, width: 10, height: 10 };
    const pos = clampPopoverPosition(anchor, { width: 200, height: 100 }, viewport);
    expect(pos.left).toBe(8);
  });
});
```
- [ ] **Step 2: Run it, verify it fails** — `npx vitest run src/radial-controls.test.ts` should fail with "Cannot find module './radial-controls'".
- [ ] **Step 3: Implement `src/radial-controls.ts`**
```ts
import type { ActionConfig, FeaturesConfig, HomeAssistant } from "./types";
import { featureEnabled } from "./features";
import { hasAction } from "./actions";

/** Domains with a quick-control body in the radial popover (v1: light, switch, climate). */
export type RadialDomain = "light" | "switch" | "climate";

const RADIAL_DOMAINS: ReadonlySet<string> = new Set(["light", "switch", "climate"]);

export function radialDomainFor(entity: string | undefined): RadialDomain | undefined {
  if (!entity) return undefined;
  const domain = entity.split(".")[0];
  return RADIAL_DOMAINS.has(domain) ? (domain as RadialDomain) : undefined;
}

/**
 * Whether a long-press on this entity should open the radial quick-control
 * popover. An explicit `hold_action` is the user's own wiring and always
 * wins -- the popover only fills the gap: an entity in a supported domain,
 * with no `hold_action` configured, while the feature flag is on.
 */
export function shouldOpenRadial(
  config: { features?: FeaturesConfig } | undefined,
  entity: string | undefined,
  holdAction: ActionConfig | undefined,
): boolean {
  if (!featureEnabled(config, "radialControls")) return false;
  if (hasAction(holdAction)) return false;
  return radialDomainFor(entity) !== undefined;
}

/**
 * The `hasHold` value the action-handler needs so it even starts the
 * hold timer. With the flag off this is exactly `hasAction(hold_action)` --
 * today's behaviour, unchanged. With the flag on it is also true for a
 * supported-domain entity that has a hold_action configured, so the
 * gesture still resolves to "hold" and the handler (not this function)
 * decides whether that hold opens the popover or runs hold_action.
 */
export function radialHasHold(
  config: { features?: FeaturesConfig } | undefined,
  entity: string | undefined,
  holdAction: ActionConfig | undefined,
): boolean {
  return hasAction(holdAction) || shouldOpenRadial(config, entity, holdAction);
}

export interface RadialServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

/** `light.turn_on` with a brightness percentage, clamped to HA's valid 1..100 range. */
export function lightBrightnessCall(entity: string, brightnessPct: number): RadialServiceCall {
  const pct = Math.min(100, Math.max(1, Math.round(brightnessPct)));
  return { domain: "light", service: "turn_on", data: { entity_id: entity, brightness_pct: pct } };
}

export function climateSetpointCall(entity: string, temperature: number): RadialServiceCall {
  return { domain: "climate", service: "set_temperature", data: { entity_id: entity, temperature } };
}

/** One +/- press of a climate setpoint, clamped to the entity's own min/max. */
export function climateStep(
  current: number,
  direction: 1 | -1,
  step: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, current + direction * step));
}

export interface PopoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where to place the popover: centered above the anchor when there's room,
 * flipped below when there isn't, clamped so it never spills past the
 * viewport (minus `margin`). Pure geometry -- no DOM -- so it's unit
 * testable without mounting the popover element that uses it.
 */
export function clampPopoverPosition(
  anchor: PopoverRect,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  const anchorCenterX = anchor.left + anchor.width / 2;
  const rawLeft = anchorCenterX - popover.width / 2;
  const left = Math.min(Math.max(rawLeft, margin), viewport.width - popover.width - margin);

  const above = anchor.top - popover.height - margin;
  const below = anchor.top + anchor.height + margin;
  const rawTop = above >= margin ? above : below;
  const top = Math.min(Math.max(rawTop, margin), viewport.height - popover.height - margin);

  return { left, top };
}
```
Type note: `HomeAssistant` is imported here only because `RadialPopoverRequest` in Task 2 re-exports it from this module's sibling file, not used directly in `radial-controls.ts` itself -- if `tsc` flags it as an unused import, drop it from this file's import list (it is not otherwise needed here).
- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/radial-controls.test.ts`.
- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/radial-controls.ts src/radial-controls.test.ts
git commit -m "Add pure gating/service-call/positioning logic for radial quick controls"
```

---

## Task 2: `src/radial-popover.ts` — the popover shell (portal, positioning, dismiss)

**Files:**
- Create: `src/radial-popover.ts`
- Test: `src/radial-popover.guard.test.ts` (grep-based guard test, see the Global Constraints note on why -- no DOM harness exists)

**Interfaces:**
- Consumes: `clampPopoverPosition`, `radialDomainFor`, `RadialDomain` from `./radial-controls` (Task 1); `HomeAssistant` from `./types`.
- Produces: `RadialPopoverRequest`, `openRadialPopover(req)`, `closeRadialPopover()` (Produced interfaces block above). Task 4 extends this file's `render()` with real per-domain bodies -- the shell in this task renders a generic placeholder body.

This task's deliverable is code-reviewable on its own (shell structure, dismiss wiring, positioning) but **cannot be meaningfully live-tested in isolation** — nothing calls `openRadialPopover` yet. Live verification of the shell happens in Task 3, once the real hold gesture reaches it.

- [ ] **Step 1: Write the guard test first (it will fail until the file exists)**
```ts
// src/radial-popover.guard.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./radial-popover.ts", import.meta.url)), "utf8");

describe("radial-popover source guards", () => {
  it("is a fixed-position portal appended to document.body, so ha-card's/.stage's overflow:hidden never clips it", () => {
    expect(src).toContain("position: fixed");
    expect(src).toContain("document.body.appendChild");
  });
  it("dismisses on Escape and on an outside pointerdown", () => {
    expect(src).toContain('"Escape"');
    expect(src).toContain("_onPointerDown");
  });
  it("dismisses on scroll (a fixed popover would otherwise drift off its anchor)", () => {
    expect(src).toContain("_onScroll");
  });
  it("positions itself via the pure clampPopoverPosition helper, not ad-hoc inline math", () => {
    expect(src).toContain("clampPopoverPosition(");
  });
});
```
- [ ] **Step 2: Run it, verify it fails** — `npx vitest run src/radial-popover.guard.test.ts` fails (file not found).
- [ ] **Step 3: Implement `src/radial-popover.ts`**
```ts
import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { HomeAssistant } from "./types";
import { clampPopoverPosition, radialDomainFor } from "./radial-controls";

export interface RadialPopoverRequest {
  hass: HomeAssistant;
  entity: string;
  /** The tapped piece's screen rect at hold time (`getBoundingClientRect()`). */
  anchor: DOMRect;
}

/**
 * The long-press quick-control popover. A singleton appended to
 * `document.body` -- the same portal pattern `action-handler.ts` already
 * uses for its own singleton element -- so it is never clipped by
 * `ha-card`'s or `.stage`'s `overflow: hidden`, and sits above the card's
 * own stacking context regardless of where the card lives in a dashboard.
 */
@customElement("easy-floorplan-radial")
export class RadialPopover extends LitElement {
  @state() private _req?: RadialPopoverRequest;
  @state() private _pos = { left: 0, top: 0 };
  @state() private _measured = false;

  private readonly _onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") this.close();
  };

  private readonly _onPointerDown = (ev: PointerEvent): void => {
    if (ev.composedPath().includes(this)) return;
    this.close();
  };

  private readonly _onScroll = (): void => {
    this.close();
  };

  public open(req: RadialPopoverRequest): void {
    this._req = req;
    this._measured = false;
    // Provisional position at the anchor's own corner; `updated()` measures
    // the now-rendered popover box and repositions precisely below, so the
    // popover is hidden (see render()) until that second, accurate pass.
    this._pos = { left: req.anchor.left, top: req.anchor.top };
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("pointerdown", this._onPointerDown, true);
    window.addEventListener("scroll", this._onScroll, true);
  }

  public close(): void {
    if (!this._req) return;
    this._req = undefined;
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("pointerdown", this._onPointerDown, true);
    window.removeEventListener("scroll", this._onScroll, true);
    this.dispatchEvent(new CustomEvent("radial-closed"));
  }

  protected updated(): void {
    if (!this._req) return;
    const box = this.shadowRoot?.querySelector(".pop") as HTMLElement | null;
    if (!box) return;
    const measured = { width: box.offsetWidth, height: box.offsetHeight };
    this._pos = clampPopoverPosition(this._req.anchor, measured, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (!this._measured) this._measured = true;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._req) return nothing;
    const domain = radialDomainFor(this._req.entity);
    return html`
      <div
        class="pop"
        style="left:${this._pos.left}px; top:${this._pos.top}px; visibility:${
          this._measured ? "visible" : "hidden"
        };"
      >
        <div class="pop-title">${this._req.entity}</div>
        <div class="pop-body">${domain ?? "No quick controls for this entity yet."}</div>
      </div>
    `;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 500;
      pointer-events: none;
    }
    .pop {
      position: fixed;
      pointer-events: auto;
      min-width: 180px;
      max-width: 260px;
      padding: 10px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      font-size: 13px;
    }
    .pop-title {
      font-weight: 500;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
}

let _singleton: RadialPopover | undefined;

function getPopover(): RadialPopover {
  if (_singleton && _singleton.isConnected) return _singleton;
  _singleton = document.createElement("easy-floorplan-radial") as RadialPopover;
  document.body.appendChild(_singleton);
  return _singleton;
}

export function openRadialPopover(req: RadialPopoverRequest): void {
  getPopover().open(req);
}

export function closeRadialPopover(): void {
  _singleton?.close();
}

declare global {
  interface HTMLElementTagNameMap {
    "easy-floorplan-radial": RadialPopover;
  }
}
```
- [ ] **Step 4: Run the guard test, verify it passes** — `npx vitest run src/radial-popover.guard.test.ts`.
- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit
git add src/radial-popover.ts src/radial-popover.guard.test.ts
git commit -m "Add the radial popover shell: portal, positioning, dismiss"
```

---

## Task 3: Wire the real hold gesture in `src/floorplan-card.ts`

**Files:**
- Modify: `src/floorplan-card.ts`
- Test: `src/radial-wiring.guard.test.ts` (new, grep-based)

**Interfaces:**
- Consumes: `radialHasHold`, `shouldOpenRadial` from `./radial-controls` (Task 1); `openRadialPopover` from `./radial-popover` (Task 2).
- Produces: the only production call sites for the two consumed functions — later tasks (and the guard test) rely on there being exactly three `hasHold: radialHasHold(...)` occurrences in this file.

There are three `actionHandler({ hasHold: ... })` call sites in `src/floorplan-card.ts` today, all reading `hasHold: hasAction(<piece>.hold_action)`:
1. `_renderItem` (item badge div), around line 260.
2. `_renderFurnitureBadge` (furniture's state badge div), around line 303.
3. `render()`'s furniture SVG tap group (`<g class="fp-furn-tap">`), around line 377.

And two hold-consuming handlers: `_handleItemAction` (line 155) and `_handleFurnitureAction` (line 163), both of which currently just call `executeAction(this, this.hass, piece, actionForGesture(piece, ev.detail.action))` for every gesture, hold included.

- [ ] **Step 1: Write the failing guard test**
```ts
// src/radial-wiring.guard.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const card = readFileSync(fileURLToPath(new URL("./floorplan-card.ts", import.meta.url)), "utf8");
const editor = readFileSync(fileURLToPath(new URL("./editor.ts", import.meta.url)), "utf8");

describe("radial controls wiring guards", () => {
  it("gates all three hold call sites through radialHasHold, not a hand-rolled condition", () => {
    const matches = card.match(/hasHold: radialHasHold\(/g) ?? [];
    expect(matches.length).toBe(3);
  });
  it("routes a qualifying hold through shouldOpenRadial before opening the popover", () => {
    expect(card).toContain("shouldOpenRadial(");
    expect(card).toContain("openRadialPopover(");
  });
  it("never opens the radial popover from the editor's canvas -- editing must not trigger it", () => {
    // The editor has its own separate pointerdown/pointermove drag wiring for
    // items (_renderItemOverlay) and never uses actionHandler's hold gesture;
    // this guard keeps it that way as the two files evolve independently.
    expect(editor).not.toContain("radial-popover");
    expect(editor).not.toContain("radial-controls");
  });
});
```
- [ ] **Step 2: Run it, verify it fails** — `npx vitest run src/radial-wiring.guard.test.ts` (0 of 3 matches, no `shouldOpenRadial`/`openRadialPopover` yet).
- [ ] **Step 3: Add the import**

In `src/floorplan-card.ts`, after the existing `actions`/`action-handler` imports (around line 37):
```ts
import { actionForGesture, executeAction, hasAction } from "./actions";
import { actionHandler } from "./action-handler";
import { radialHasHold, shouldOpenRadial } from "./radial-controls";
import { openRadialPopover } from "./radial-popover";
```
- [ ] **Step 4: Add an `_openRadial` helper and route hold through it**

Replace `_handleItemAction` and `_handleFurnitureAction` (lines 155-169):
```ts
  private _handleItemAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    item: FloorItem
  ): void {
    if (!this.hass) return;
    if (ev.detail.action === "hold" && shouldOpenRadial(this._config, item.entity, item.hold_action)) {
      this._openRadial(ev, item.entity!);
      return;
    }
    executeAction(this, this.hass, item, actionForGesture(item, ev.detail.action));
  }

  private _handleFurnitureAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    f: Furniture
  ): void {
    if (!this.hass) return;
    if (ev.detail.action === "hold" && shouldOpenRadial(this._config, f.entity, f.hold_action)) {
      this._openRadial(ev, f.entity!);
      return;
    }
    executeAction(this, this.hass, f, actionForGesture(f, ev.detail.action));
  }

  /**
   * Opens the radial popover anchored to the piece that was held. The
   * anchor is the DOM element the gesture fired on -- `.item`/`.badge` div
   * or the furniture's `<g class="fp-furn-tap">` -- so `getBoundingClientRect()`
   * works the same for both the HTML overlay and the SVG tap target.
   */
  private _openRadial(ev: CustomEvent, entity: string): void {
    if (!this.hass) return;
    const anchor = (ev.currentTarget as Element).getBoundingClientRect();
    openRadialPopover({ hass: this.hass, entity, anchor });
  }
```
- [ ] **Step 5: Update the three `hasHold` call sites**

In `_renderItem` (around line 259-262):
```ts
        .actionHandler=${actionHandler({
          hasHold: radialHasHold(this._config, item.entity, item.hold_action),
          hasDoubleClick: hasAction(item.double_tap_action),
        })}
```
In `_renderFurnitureBadge` (around line 302-305):
```ts
        .actionHandler=${actionHandler({
          hasHold: radialHasHold(this._config, f.entity, f.hold_action),
          hasDoubleClick: hasAction(f.double_tap_action),
        })}
```
In `render()`'s furniture SVG tap group (around line 376-379):
```ts
                  .actionHandler=${actionHandler({
                    hasHold: radialHasHold(this._config, f.entity, f.hold_action),
                    hasDoubleClick: hasAction(f.double_tap_action),
                  })}>
```
- [ ] **Step 6: Run the guard test, verify it passes** — `npx vitest run src/radial-wiring.guard.test.ts`.
- [ ] **Step 7: Run the full suite + typecheck + build**
```bash
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
```
- [ ] **Step 8: LIVE verification (DOM-bound — this is the point where the shell from Task 2 first becomes reachable)**

Run `npm run serve` (opens `dev/index.html`). In the editor pane:
  1. Confirm `radialControls` is **unset** in the harness config (`dev/dev.ts`'s `config` has no `features` block yet — added in Task 4). Add an item, bind its Entity to `light.living_room` (already a mock state), leave `hold_action` unset. Long-press it in the **live card preview** pane: nothing new happens (today's behaviour — no `hold_action`, so hold does nothing). This is the flag-off regression check.
  2. Temporarily set `features: { radialControls: true }` in `dev/dev.ts`'s `config` object (uncommitted, just for this check — Task 4 makes it permanent). Reload `npm run serve`. Long-press the same `light.living_room` item: the popover appears, anchored near the item, showing `light.living_room` and the word `light` (the Task-2 placeholder body).
  3. Tap anywhere outside the popover: it closes. Reopen it; press Escape: it closes. Reopen it; scroll the page (if the harness page is tall enough, or resize the window to force a scrollbar): it closes.
  4. Set that same item's `hold_action` to `{ action: "toggle" }` in the editor. Long-press it again: the popover does **not** open (the explicit hold_action wins); the entity toggles instead, exactly as before this plan.
  5. Revert the temporary `features` edit before moving on (Task 4 re-adds it permanently, deliberately).

- [ ] **Step 9: Commit**
```bash
git add src/floorplan-card.ts src/radial-wiring.guard.test.ts
git commit -m "Wire the long-press gesture to the radial popover, gated on radialControls"
```

---

## Task 4: Domain-aware control bodies (light, switch, climate) + `hass.callService` wiring

**Files:**
- Modify: `src/radial-popover.ts` (replace the Task-2 placeholder body with real per-domain controls)
- Modify: `dev/dev.ts` (add `switch`/`climate` mock entities and turn `radialControls` on by default in the harness, so the feature is exercisable without hand-editing config every time)
- Test: extend `src/radial-popover.guard.test.ts`

**Interfaces:**
- Consumes: `lightBrightnessCall`, `climateSetpointCall`, `climateStep`, `radialDomainFor` from `./radial-controls` (Task 1); `executeAction` from `./actions` (existing — reused verbatim for both light and switch toggling, so there is exactly one toggle code path in the whole card).
- Produces: nothing new for later tasks — this is the leaf of the feature.

**Scope for v1 (explicit):** light gets a toggle + a brightness slider; switch gets a toggle; climate gets a current-temperature readout + a +/- setpoint stepper. No color picker, no fan-speed, no hvac-mode switch, no media_player transport controls, no lock/cover/vacuum bodies. See the Self-Review "Out of scope" list.

**On reusing HA's own more-info control elements:** the roadmap spec suggests preferring HA's built-in more-info controls (e.g. the internal `ha-state-control-light-brightness`-style elements) over hand-rolled ones. Investigated: this codebase has **no existing use** of any HA-internal more-info element anywhere (checked via `grep -rn "ha-state-control\|more-info-light\|ha-more-info" src/`), and those elements are undocumented internals of `home-assistant-frontend` — not a published API, with tag names and props that have changed across HA releases without notice. Depending on them would make this HACS-distributed card brittle across HA versions for a feature that only needs a toggle, a range input, and two buttons. **Decision: ship minimal custom controls (below) as the only path for v1.** Revisiting HA-native reuse is a named follow-up, not a blocker.

- [ ] **Step 1: Extend the guard test for the new domain bodies**
```ts
// append to src/radial-popover.guard.test.ts's existing describe block
it("renders a distinct body per supported domain and reuses executeAction for toggling", () => {
  expect(src).toContain("_renderLight");
  expect(src).toContain("_renderSwitch");
  expect(src).toContain("_renderClimate");
  expect(src).toContain("executeAction(");
  expect(src).toContain("lightBrightnessCall(");
  expect(src).toContain("climateSetpointCall(");
});
```
- [ ] **Step 2: Run it, verify it fails** — `npx vitest run src/radial-popover.guard.test.ts` (no `_renderLight` etc. yet).
- [ ] **Step 3: Implement the domain bodies in `src/radial-popover.ts`**

Add the import (alongside the existing `radial-controls` import):
```ts
import { clampPopoverPosition, radialDomainFor, lightBrightnessCall, climateSetpointCall, climateStep } from "./radial-controls";
import { executeAction } from "./actions";
```
Replace `render()`'s body line (`${domain ?? "No quick controls for this entity yet."}`) and add the three renderers as class methods:
```ts
  protected render(): TemplateResult | typeof nothing {
    if (!this._req) return nothing;
    const domain = radialDomainFor(this._req.entity);
    const body =
      domain === "light" ? this._renderLight() :
      domain === "switch" ? this._renderSwitch() :
      domain === "climate" ? this._renderClimate() :
      html`<div class="pop-body">No quick controls for this entity yet.</div>`;
    return html`
      <div
        class="pop"
        style="left:${this._pos.left}px; top:${this._pos.top}px; visibility:${
          this._measured ? "visible" : "hidden"
        };"
      >
        <div class="pop-title">${this._req.entity}</div>
        ${body}
      </div>
    `;
  }

  private _toggle(): void {
    if (!this._req) return;
    executeAction(this, this._req.hass, { entity: this._req.entity }, { action: "toggle" });
  }

  private _renderLight(): TemplateResult {
    const req = this._req!;
    const state = req.hass.states[req.entity];
    const on = state?.state === "on";
    const brightness = (state?.attributes?.brightness as number | undefined) ?? 0;
    const pct = Math.round((brightness / 255) * 100);
    return html`
      <div class="pop-row">
        <button class="pop-toggle ${on ? "on" : ""}" @click=${() => this._toggle()}>
          <ha-icon icon=${on ? "mdi:lightbulb" : "mdi:lightbulb-off-outline"}></ha-icon>
        </button>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          .value=${String(pct)}
          @change=${(e: Event) => {
            const value = Number((e.target as HTMLInputElement).value);
            const call = lightBrightnessCall(req.entity, value);
            req.hass.callService(call.domain, call.service, call.data);
          }}
        />
      </div>
    `;
  }

  private _renderSwitch(): TemplateResult {
    const req = this._req!;
    const on = req.hass.states[req.entity]?.state === "on";
    return html`
      <button class="pop-toggle pop-toggle-wide ${on ? "on" : ""}" @click=${() => this._toggle()}>
        <ha-icon icon=${on ? "mdi:toggle-switch" : "mdi:toggle-switch-off-outline"}></ha-icon>
        ${on ? "On" : "Off"}
      </button>
    `;
  }

  private _renderClimate(): TemplateResult {
    const req = this._req!;
    const attrs = req.hass.states[req.entity]?.attributes ?? {};
    const current = attrs.current_temperature as number | undefined;
    const target = (attrs.temperature as number | undefined) ?? 20;
    const min = (attrs.min_temp as number | undefined) ?? 7;
    const max = (attrs.max_temp as number | undefined) ?? 35;
    const step = (attrs.target_temp_step as number | undefined) ?? 0.5;
    const setTarget = (next: number) => {
      const call = climateSetpointCall(req.entity, next);
      req.hass.callService(call.domain, call.service, call.data);
    };
    return html`
      <div class="pop-climate">
        <div class="pop-current">${current !== undefined ? `${current}°` : "—"}</div>
        <div class="pop-setpoint">
          <button @click=${() => setTarget(climateStep(target, -1, step, min, max))}>
            <ha-icon icon="mdi:minus"></ha-icon>
          </button>
          <span>${target}°</span>
          <button @click=${() => setTarget(climateStep(target, 1, step, min, max))}>
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }
```
Add matching styles to the existing `static styles = css\`...\`` block (append inside, before the closing backtick — remember: no backticks inside these comments):
```css
    .pop-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pop-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 8px;
      padding: 6px 8px;
      cursor: pointer;
    }
    .pop-toggle.on {
      background: var(--state-light-active-color, var(--state-active-color, #fdd835));
      border-color: var(--state-light-active-color, var(--state-active-color, #fdd835));
      color: var(--text-primary-color, #212121);
    }
    .pop-toggle-wide {
      width: 100%;
      justify-content: center;
    }
    .pop-row input[type="range"] {
      flex: 1;
      min-width: 0;
    }
    .pop-climate {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .pop-current {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .pop-setpoint {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
    }
    .pop-setpoint button {
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
```
- [ ] **Step 4: Run the guard test, verify it passes** — `npx vitest run src/radial-popover.guard.test.ts`.
- [ ] **Step 5: Extend `dev/dev.ts` with switch/climate mock entities and turn the flag on**

Add to the `hass.states` object (around the existing `"light.living_room"` entry):
```ts
    "switch.kitchen_lamp": {
      entity_id: "switch.kitchen_lamp",
      state: "off",
      attributes: { friendly_name: "Kitchen Lamp" },
    },
    "climate.hall": {
      entity_id: "climate.hall",
      state: "heat",
      attributes: {
        friendly_name: "Hall Thermostat",
        current_temperature: 19.5,
        temperature: 21,
        min_temp: 7,
        max_temp: 30,
        target_temp_step: 0.5,
      },
    },
```
Add to the `config` object (near `defaultFloor`/`floors`):
```ts
  features: { radialControls: true },
```
- [ ] **Step 6: LIVE verification (DOM-bound)**

Run `npm run serve`. In the editor pane, add three items and set their Entity fields to `light.living_room`, `switch.kitchen_lamp`, and `climate.hall` respectively (leave `hold_action` unset on all three). In the **live card preview** pane:
  1. Long-press the light item: popover shows a bulb toggle + a brightness slider. Click the toggle: `[mock hass] callService homeassistant toggle {entity_id: "light.living_room"}` logs in the browser console and the item's badge reflects the new on/off state on the next render. Drag the slider and release: `[mock hass] callService light turn_on {entity_id: "light.living_room", brightness_pct: <n>}` logs.
  2. Long-press the switch item: popover shows a single wide toggle button reading "Off"/"On". Click it: the same `homeassistant.toggle` call logs, now for `switch.kitchen_lamp`.
  3. Long-press the climate item: popover shows "19.5°" as the current reading and "21°" as the setpoint with +/- buttons. Click +: `[mock hass] callService climate set_temperature {entity_id: "climate.hall", temperature: 21.5}` logs. Click - twice: watch it step down by 0.5 each press.
  4. Confirm the popover repositions sensibly (flips below instead of above) for an item placed near the top edge of the canvas, and stays fully on-screen for one placed near the left/right edge.
- [ ] **Step 7: Full suite + typecheck + build**
```bash
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
```
- [ ] **Step 8: Commit**
```bash
git add src/radial-popover.ts src/radial-popover.guard.test.ts dev/dev.ts
git commit -m "Add light/switch/climate quick-control bodies to the radial popover"
```

---

## Task 5 (controller): verify + gate

- [ ] Full suite green: `npx vitest run --reporter=dot`.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.
- [ ] Re-run the flag-off regression check from Task 3 Step 8.1 one more time on the final code: an item/furniture piece with no `hold_action`, feature flag unset, long-press does nothing new (no popover, no console output) — confirms "byte-identical when off" end to end, not just at the `radialHasHold`/`shouldOpenRadial` unit level.
- [ ] Re-run the three domain live checks from Task 4 Step 6 one more time on the final code.
- [ ] Confirm `git log` shows no AI-authorship footers and nothing was pushed (`git status` shows the local branch ahead of nothing, or check `git remote -v` was never touched).

## Self-Review
- **Spec coverage** (against the four bullets in the 2b ask):
  - "reuse hasHold/hold_action wiring, byte-identical off" — Task 1 (`radialHasHold`/`shouldOpenRadial` reduce to today's `hasAction` check when off) + Task 3 (all three call sites route through it) + Task 5's regression re-check. ✓
  - "HTML popover anchored to the tapped piece, domain-aware, start small (light/switch/climate), note others as follow-ups" — Task 2 (shell + anchoring) + Task 4 (the three domain bodies) + the "Out of scope" list below. ✓
  - "dismissal (tap outside / esc), positioning, not during drag/edit" — Task 2 (Escape/outside-pointerdown/scroll dismiss, `clampPopoverPosition`) + Task 3's editor-isolation guard test and live check. ✓
  - "multi-task breakdown: gate+trigger / shell+positioning+dismiss / per-domain controls / hass.callService wiring; explicit scope limits" — Tasks 1/2/3/4 map onto exactly that split; scope limits are the "Scope for v1" note in Task 4 and the list below. ✓
- **Out of scope (named follow-ups, not silently dropped):**
  - Color picker / color temperature for lights (brightness only in v1).
  - Fan speed, cover position, media_player transport controls, lock, vacuum, humidifier bodies — `radialDomainFor` only recognizes light/switch/climate; everything else falls through to the "no quick controls" placeholder and keeps its old hold_action-or-nothing behaviour via `shouldOpenRadial`'s domain check.
  - Climate `hvac_mode` switching (heat/cool/off/auto) — setpoint only.
  - Reusing HA's internal more-info control elements — investigated and deliberately deferred (see Task 4's "On reusing HA's own more-info control elements" note); custom controls are the v1 (and likely permanent) path.
  - Keyboard-only activation of the popover — `action-handler.ts`'s `handleKeyDown` fires Enter/Space as an immediate "tap", never sets `held`, so there is no keyboard path to a "hold". Existing limitation of the shared action-handler, not introduced by this plan; worth a dedicated accessibility follow-up.
  - Debounced/live-updating brightness while dragging (v1 calls `light.turn_on` once on slider release via the `change` event, not on every `input` tick, to avoid spamming `hass.callService`).
- **Type consistency check:** `RadialDomain`, `RadialPopoverRequest`, `RadialServiceCall`, `openRadialPopover`/`closeRadialPopover`, `radialHasHold`/`shouldOpenRadial`, `clampPopoverPosition`, `lightBrightnessCall`/`climateSetpointCall`/`climateStep` are named and typed identically everywhere they're declared (Tasks 1-2) and consumed (Tasks 3-4). ✓
- **No placeholders:** every code step above is complete, runnable code; the Task 2 "generic body" is a real, intentional interim state (explicitly not live-testable until Task 3), not a TODO. ✓
- **DOM-bound work verified live, not unit-tested:** called out explicitly in Global Constraints and at every Lit-rendering step (Task 2 Step verification note, Task 3 Step 8, Task 4 Step 6, Task 5) with exact manual click-throughs and expected console output, since this repo has no jsdom/happy-dom harness to mount a `LitElement` in a unit test.
