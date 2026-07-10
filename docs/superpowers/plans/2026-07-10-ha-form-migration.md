# ha-form Migration + Item Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's hand-rolled form rows with schema-driven `ha-form` + HA selectors (plain-input fallback outside HA), and add standard `tap_action`/`hold_action`/`double_tap_action` to items with behavior-preserving defaults.

**Architecture:** New pure module `src/editor-forms.ts` produces a `FormSpec` (fields + form data + patch mapping) per element kind; the editor renders it through one `_renderForm` helper (real `<ha-form>` when defined, plain inputs otherwise) and routes patches through the existing commit/live-burst history discipline. New `src/actions.ts` (pure action resolution/execution) + `src/action-handler.ts` (canonical tap/hold/double-tap directive) wire actions on the card.

**Tech Stack:** Lit 3, TypeScript, Vitest (node env — pure functions only), HA selectors verified compatible 2024.1 → dev.

## Global Constraints

- Branch: `feat/ha-form-editor`. Verify after every task: `npm run typecheck && npm test && npm run build`.
- No new dependencies.
- Selector shapes must stay 2024.1-compatible: entity filter form `{ entity: { filter: [{ domain: [...] }] } }`; NO `flatten`, NO select `mode: "box"`, NO `slider_ticks`.
- History discipline is inviolable: text/number fields route through `_updateXLive` (burst), everything else through the committing `_updateX` helpers.
- Kept custom (do NOT migrate): color swatch+text rows, tracker X/Y sensor sub-editors, wall Length resize row, snap segmented control, canvas/toolbar/context bar.
- Comments explain constraints, not narration. Commit per task.

---

### Task 1: editor-forms core — FormField, diff, normalize

**Files:**
- Create: `src/editor-forms.ts`
- Test: `src/editor-forms.test.ts`

**Interfaces (produced):**
```ts
export interface FormField {
  name: string;
  label: string;
  helper?: string;
  required?: boolean;
  selector: Record<string, unknown>;
}
export function isLiveField(f: FormField): boolean;               // text | number selectors
export function diffFormValue(prev, next, fields): Record<string, unknown>;
export function normalizeFormPatch(patch, fields): Record<string, unknown>;
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { isLiveField, diffFormValue, normalizeFormPatch } from "./editor-forms";
import type { FormField } from "./editor-forms";

const fields: FormField[] = [
  { name: "name", label: "Name", selector: { text: {} } },
  { name: "text", label: "Text", required: true, selector: { text: {} } },
  { name: "size", label: "Size", selector: { number: { min: 16, max: 160, mode: "slider" } } },
  { name: "length", label: "Length", required: true, selector: { number: { min: 1, mode: "box" } } },
  { name: "angle", label: "Angle", selector: { number: { min: 0, max: 360, mode: "slider" } } },
  { name: "display", label: "Display", selector: { select: { options: [] } } },
  { name: "showIcon", label: "Show icon", selector: { boolean: {} } },
  { name: "icon", label: "Icon", selector: { icon: {} } },
  { name: "entity", label: "Entity", selector: { entity: {} } },
];
const f = (n: string) => fields.find((x) => x.name === n)!;

describe("isLiveField", () => {
  it("marks text and number selectors live, others discrete", () => {
    expect(isLiveField(f("name"))).toBe(true);
    expect(isLiveField(f("size"))).toBe(true);
    expect(isLiveField(f("display"))).toBe(false);
    expect(isLiveField(f("showIcon"))).toBe(false);
    expect(isLiveField(f("entity"))).toBe(false);
  });
});

describe("diffFormValue", () => {
  it("returns only schema keys whose value identity changed", () => {
    const prev = { name: "a", size: 20, id: "x" };
    const next = { name: "b", size: 20, id: "y" };
    expect(diffFormValue(prev, next, fields)).toEqual({ name: "b" });
  });
});

describe("normalizeFormPatch", () => {
  it("maps empty optional strings to undefined, keeps required ones", () => {
    expect(normalizeFormPatch({ name: "" }, fields)).toEqual({ name: undefined });
    expect(normalizeFormPatch({ text: "" }, fields)).toEqual({ text: "" });
    expect(normalizeFormPatch({ icon: "" }, fields)).toEqual({ icon: undefined });
  });
  it("drops invalid required numbers (keep-old), passes undefined optionals", () => {
    expect(normalizeFormPatch({ length: undefined }, fields)).toEqual({});
    expect(normalizeFormPatch({ length: Number.NaN }, fields)).toEqual({});
    expect(normalizeFormPatch({ size: undefined }, fields)).toEqual({ size: undefined });
  });
  it("clamps numbers to the selector range and wraps angle", () => {
    expect(normalizeFormPatch({ length: 0 }, fields)).toEqual({ length: 1 });
    expect(normalizeFormPatch({ size: 999 }, fields)).toEqual({ size: 160 });
    expect(normalizeFormPatch({ angle: 360 }, fields)).toEqual({ angle: 0 });
  });
  it("coerces booleans", () => {
    expect(normalizeFormPatch({ showIcon: undefined }, fields)).toEqual({ showIcon: false });
  });
});
```

- [ ] **Step 2: Run to fail** — `npm test` → editor-forms module missing.

- [ ] **Step 3: Implement**

```ts
/** One ha-form schema item, extended with our label/helper (read by computeLabel). */
export interface FormField {
  name: string;
  label: string;
  helper?: string;
  required?: boolean;
  selector: Record<string, unknown>;
}

/** Continuous controls (typing, sliders) — routed through the burst-history path. */
export function isLiveField(f: FormField): boolean {
  return "text" in f.selector || "number" in f.selector;
}

/** The changed schema keys from ha-form's full-object value-changed payload. */
export function diffFormValue(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  fields: readonly FormField[]
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    if (next[f.name] !== prev[f.name]) patch[f.name] = next[f.name];
  }
  return patch;
}

/**
 * Per-field cleanup between the form and the config: empty optional strings
 * become undefined; invalid required numbers are dropped (keep the old
 * value); numbers clamp to the selector range; angle wraps to 0..360.
 */
export function normalizeFormPatch(
  patch: Record<string, unknown>,
  fields: readonly FormField[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.name in patch)) continue;
    let v = patch[field.name];
    if ("text" in field.selector || "icon" in field.selector || "entity" in field.selector) {
      if (v === "" || v == null) v = field.required ? "" : undefined;
    } else if ("number" in field.selector) {
      const n = typeof v === "string" ? Number(v) : (v as number | undefined);
      if (typeof n !== "number" || !Number.isFinite(n)) {
        if (field.required) continue;
        v = undefined;
      } else {
        const sel = field.selector.number as { min?: number; max?: number };
        let num = field.name === "angle" ? ((n % 360) + 360) % 360 : n;
        if (sel.min !== undefined && num < sel.min) num = sel.min;
        if (sel.max !== undefined && num > sel.max) num = sel.max;
        v = num;
      }
    } else if ("boolean" in field.selector) {
      v = !!v;
    }
    out[field.name] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run to pass** — `npm test`.
- [ ] **Step 5: Commit** — `feat(editor): form-field schema core with diff and normalization`

---

### Task 2: actions module — resolution + execution

**Files:**
- Modify: `src/types.ts` (ActionConfig + FloorItem action fields)
- Create: `src/actions.ts`
- Test: `src/actions.test.ts`

**Interfaces (produced):**
```ts
// types.ts
export interface ActionConfig { action: string; /* loose passthrough, see below */ }
// FloorItem += tap_action?: ActionConfig; hold_action?: ActionConfig; double_tap_action?: ActionConfig;
// actions.ts
export function defaultItemAction(entity: string | undefined): ActionConfig;
export function hasAction(config?: ActionConfig): boolean;
export function actionForGesture(item, gesture: "tap" | "hold" | "double_tap"): ActionConfig | undefined;
export function serviceFromAction(config: ActionConfig): ServiceCall | null;
export function executeAction(node: HTMLElement, hass, item: { entity?: string }, config?: ActionConfig): void;
```

- [ ] **Step 1: types.ts additions**

After the `FloorplanCardConfig` interface:

```ts
/**
 * A Lovelace action (tap/hold/double_tap). Typed loosely on purpose: HA has
 * renamed fields over time (call-service→perform-action, service_data→data)
 * and unknown fields must pass through untouched.
 */
export interface ActionConfig {
  action: string;
  entity?: string;
  navigation_path?: string;
  url_path?: string;
  perform_action?: string;
  service?: string;
  data?: Record<string, unknown>;
  service_data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  confirmation?: { text?: string } | boolean;
  [key: string]: unknown;
}
```

In `FloorItem` (after `showIcon`): 

```ts
  /** Lovelace actions. Defaults: tap = toggle (controllable domains) or more-info; hold/double = none. */
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
```

- [ ] **Step 2: Failing tests (`src/actions.test.ts`)**

```ts
import { describe, it, expect, vi } from "vitest";
import {
  defaultItemAction,
  hasAction,
  actionForGesture,
  serviceFromAction,
  executeAction,
} from "./actions";
import type { FloorItem } from "./types";

describe("defaultItemAction", () => {
  it("toggles controllable domains, more-info otherwise", () => {
    for (const e of ["light.a", "switch.a", "cover.a", "fan.a", "input_boolean.a"]) {
      expect(defaultItemAction(e)).toEqual({ action: "toggle" });
    }
    expect(defaultItemAction("sensor.a")).toEqual({ action: "more-info" });
    expect(defaultItemAction(undefined)).toEqual({ action: "more-info" });
  });
});

describe("hasAction", () => {
  it("false for undefined and none", () => {
    expect(hasAction(undefined)).toBe(false);
    expect(hasAction({ action: "none" })).toBe(false);
    expect(hasAction({ action: "toggle" })).toBe(true);
  });
});

describe("actionForGesture", () => {
  const item = { entity: "light.a" } as FloorItem;
  it("tap falls back to the behavioral default; hold/double default to nothing", () => {
    expect(actionForGesture(item, "tap")).toEqual({ action: "toggle" });
    expect(actionForGesture(item, "hold")).toBeUndefined();
    expect(actionForGesture(item, "double_tap")).toBeUndefined();
  });
  it("configured actions win", () => {
    const it2 = { ...item, tap_action: { action: "none" }, hold_action: { action: "more-info" } } as FloorItem;
    expect(actionForGesture(it2, "tap")).toEqual({ action: "none" });
    expect(actionForGesture(it2, "hold")).toEqual({ action: "more-info" });
  });
});

describe("serviceFromAction", () => {
  it("accepts both perform-action and legacy call-service spellings", () => {
    expect(
      serviceFromAction({ action: "perform-action", perform_action: "light.turn_on", data: { brightness: 10 } })
    ).toEqual({ domain: "light", service: "turn_on", data: { brightness: 10 }, target: undefined });
    expect(
      serviceFromAction({ action: "call-service", service: "fan.toggle", service_data: { x: 1 } })
    ).toEqual({ domain: "fan", service: "toggle", data: { x: 1 }, target: undefined });
    expect(serviceFromAction({ action: "perform-action" })).toBeNull();
  });
});

describe("executeAction", () => {
  const node = document ? document.createElement?.("div") : null;
  // node-env: build a minimal EventTarget stand-in
  const makeNode = () => {
    const events: string[] = [];
    return {
      events,
      dispatchEvent(ev: Event) {
        events.push(ev.type);
        return true;
      },
    } as unknown as HTMLElement & { events: string[] };
  };
  const makeHass = () => {
    const calls: unknown[][] = [];
    return { calls, callService: (...a: unknown[]) => calls.push(a) } as never;
  };

  it("toggle calls homeassistant.toggle on the item entity", () => {
    const hass = makeHass();
    executeAction(makeNode(), hass, { entity: "light.a" }, { action: "toggle" });
    expect((hass as { calls: unknown[][] }).calls[0]).toEqual([
      "homeassistant",
      "toggle",
      { entity_id: "light.a" },
    ]);
  });

  it("perform-action and call-service both invoke callService", () => {
    const hass = makeHass();
    executeAction(makeNode(), hass, {}, { action: "perform-action", perform_action: "light.turn_on" });
    executeAction(makeNode(), hass, {}, { action: "call-service", service: "light.turn_off" });
    expect((hass as { calls: unknown[][] }).calls.length).toBe(2);
  });

  it("more-info fires hass-more-info with the override or item entity", () => {
    const n = makeNode();
    executeAction(n, makeHass(), { entity: "light.a" }, { action: "more-info" });
    expect(n.events).toEqual(["hass-more-info"]);
  });

  it("none and undefined do nothing", () => {
    const hass = makeHass();
    const n = makeNode();
    executeAction(n, hass, { entity: "light.a" }, undefined);
    executeAction(n, hass, { entity: "light.a" }, { action: "none" });
    expect((hass as { calls: unknown[][] }).calls.length).toBe(0);
    expect(n.events.length).toBe(0);
  });
});
```

- [ ] **Step 3: Run to fail**, then implement `src/actions.ts`:

```ts
import type { ActionConfig, HomeAssistant } from "./types";

/** Domains where a bare tap toggles instead of opening more-info (legacy card behavior). */
const TOGGLE_DOMAINS = new Set(["light", "switch", "cover", "fan", "input_boolean"]);

/** The action an item performs when no tap_action is configured. */
export function defaultItemAction(entity: string | undefined): ActionConfig {
  const domain = entity?.split(".")[0] ?? "";
  return TOGGLE_DOMAINS.has(domain) ? { action: "toggle" } : { action: "more-info" };
}

export function hasAction(config?: ActionConfig): boolean {
  return config !== undefined && config.action !== "none";
}

export function actionForGesture(
  item: { entity?: string; tap_action?: ActionConfig; hold_action?: ActionConfig; double_tap_action?: ActionConfig },
  gesture: "tap" | "hold" | "double_tap"
): ActionConfig | undefined {
  if (gesture === "tap") return item.tap_action ?? defaultItemAction(item.entity);
  return gesture === "hold" ? item.hold_action : item.double_tap_action;
}

export interface ServiceCall {
  domain: string;
  service: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
}

/** Both spellings of the service action; HA renamed call-service → perform-action in 2024.8. */
export function serviceFromAction(config: ActionConfig): ServiceCall | null {
  const svc = config.perform_action ?? config.service;
  if (!svc || !svc.includes(".")) return null;
  const [domain, service] = svc.split(".", 2);
  return { domain, service, data: config.data ?? config.service_data, target: config.target };
}

/** Execute a Lovelace action. Mirrors HA's handle-action for the shapes the card supports. */
export function executeAction(
  node: HTMLElement,
  hass: HomeAssistant,
  item: { entity?: string },
  config: ActionConfig | undefined
): void {
  if (!config || config.action === "none") return;
  if (config.confirmation) {
    const text =
      (typeof config.confirmation === "object" && config.confirmation.text) ||
      `Are you sure you want to ${config.action}?`;
    if (!globalThis.confirm?.(text)) return;
  }
  switch (config.action) {
    case "toggle":
      if (item.entity) hass.callService("homeassistant", "toggle", { entity_id: item.entity });
      break;
    case "more-info": {
      const entityId = config.entity ?? item.entity;
      if (entityId) {
        node.dispatchEvent(
          new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true })
        );
      }
      break;
    }
    case "navigate":
      if (config.navigation_path) {
        history.pushState(null, "", config.navigation_path);
        const ev = new Event("location-changed") as Event & { detail: { replace: boolean } };
        ev.detail = { replace: false };
        window.dispatchEvent(ev);
      }
      break;
    case "url":
      if (config.url_path) window.open(config.url_path);
      break;
    case "perform-action":
    case "call-service": {
      const call = serviceFromAction(config);
      if (call) hass.callService(call.domain, call.service, call.data as never, call.target as never);
      break;
    }
    case "fire-dom-event":
      node.dispatchEvent(new CustomEvent("ll-custom", { detail: config, bubbles: true, composed: true }));
      break;
  }
}
```

Note: `CustomEvent`/`Event` exist in the vitest node environment via jsdom-less lit setup — if `new CustomEvent` is unavailable in node, the executeAction tests instead assert via the stand-in node's dispatchEvent receiving `{ type: "hass-more-info" }` objects; adjust with a plain object event if needed (verify at run time).

- [ ] **Step 4: Run to pass, typecheck, commit** — `feat(card): action resolution and execution supporting both service-action spellings`

---

### Task 3: form specs per element kind

**Files:**
- Modify: `src/editor-forms.ts`
- Test: `src/editor-forms.test.ts`

**Interfaces (produced):**
```ts
export interface FormSpec {
  fields: FormField[];
  data: Record<string, unknown>;
  toPatch(patch: Record<string, unknown>): Record<string, unknown>;
}
export function openingForm(o: Opening): FormSpec;
export function itemForm(it: FloorItem): FormSpec;
export function textForm(t: FloorText): FormSpec;
export function furnitureForm(f: Furniture): FormSpec;
export function trackerForm(tr: Tracker): FormSpec;
export function wallForm(w: Wall): FormSpec;
export function projectForm(c: FloorplanCardConfig): FormSpec;   // title/width/height/grid
export function floorImageForm(f: Floor): FormSpec;              // image + conditional opacity
```

Imports: `openingMotion`, `sliderStyleOf`, `defaultIcon` from `./render`; `defaultItemAction` from `./actions`; defaults (`DEFAULT_ITEM_SIZE` etc.) from `./types`. Constants `FURNITURE_TYPES` and `FURNITURE_LABELS` MOVE from `src/editor.ts` into `src/editor-forms.ts` (exported; editor imports them back — the Add-popover still uses them).

- [ ] **Step 1: Failing tests (add to `src/editor-forms.test.ts`)**

```ts
import { openingForm, itemForm, wallForm, projectForm, floorImageForm } from "./editor-forms";
import type { Opening, FloorItem } from "./types";

const door = { id: "o1", type: "door", x: 0, y: 0, length: 90, angle: 0 } as Opening;

describe("openingForm", () => {
  it("swing door shows hinge + opens, no slide fields", () => {
    const names = openingForm(door).fields.map((f) => f.name);
    expect(names).toContain("hinge");
    expect(names).toContain("opens");
    expect(names).not.toContain("style");
  });
  it("sliding opening shows slide + style, hides hinge; biparting hides slide", () => {
    const slide = openingForm({ ...door, motion: "slide" } as Opening).fields.map((f) => f.name);
    expect(slide).toContain("slide");
    expect(slide).toContain("style");
    expect(slide).not.toContain("hinge");
    const bi = openingForm({ ...door, motion: "slide", sliderStyle: "biparting" } as Opening);
    expect(bi.fields.map((f) => f.name)).not.toContain("slide");
  });
  it("invert only offered with an entity; entity filter targets covers and binary_sensors", () => {
    expect(openingForm(door).fields.map((f) => f.name)).not.toContain("invert");
    const bound = openingForm({ ...door, entity: "cover.x" } as Opening);
    expect(bound.fields.map((f) => f.name)).toContain("invert");
    const entity = bound.fields.find((f) => f.name === "entity")!;
    expect(entity.selector).toEqual({ entity: { filter: [{ domain: ["binary_sensor", "cover"] }] } });
  });
  it("maps view-model patches back to config shape", () => {
    const form = openingForm(door);
    expect(form.toPatch({ motion: "swing" })).toEqual({ motion: undefined, sliderStyle: undefined });
    expect(form.toPatch({ motion: "slide" })).toEqual({ motion: "slide" });
    expect(form.toPatch({ hinge: "right" })).toEqual({ flipH: true });
    expect(form.toPatch({ hinge: "left" })).toEqual({ flipH: undefined });
    expect(form.toPatch({ opens: "other" })).toEqual({ flipV: true });
    expect(form.toPatch({ slide: "left" })).toEqual({ flipH: undefined });
    expect(form.toPatch({ style: "single" })).toEqual({ sliderStyle: undefined });
    expect(form.toPatch({ style: "bypass" })).toEqual({ sliderStyle: "bypass" });
    expect(form.toPatch({ invert: false })).toEqual({ invert: undefined });
    expect(form.toPatch({ length: 50, angle: 10 })).toEqual({ length: 50, angle: 10 });
  });
  it("exposes derived view-model values in data", () => {
    const d = openingForm({ ...door, flipH: true } as Opening).data;
    expect(d.motion).toBe("swing");
    expect(d.hinge).toBe("right");
    expect(d.opens).toBe("this");
  });
});

describe("itemForm", () => {
  const item = { id: "i", entity: "light.a", kind: "light", x: 0, y: 0 } as FloorItem;
  it("hides ripple size for badge display, shows it otherwise", () => {
    expect(itemForm(item).fields.map((f) => f.name)).not.toContain("rippleSize");
    expect(itemForm({ ...item, display: "ripple" } as FloorItem).fields.map((f) => f.name)).toContain(
      "rippleSize"
    );
  });
  it("offers the three action fields with behavior-preserving defaults", () => {
    const fields = itemForm(item).fields;
    const tap = fields.find((f) => f.name === "tap_action")!;
    expect(tap.selector).toEqual({ ui_action: { default_action: "toggle" } });
    expect(fields.find((f) => f.name === "hold_action")!.selector).toEqual({
      ui_action: { default_action: "none" },
    });
  });
  it("data presents effective defaults", () => {
    const d = itemForm(item).data;
    expect(d.showIcon).toBe(true);
    expect(d.showState).toBe(false);
    expect(d.display).toBe("badge");
  });
});

describe("wallForm / projectForm / floorImageForm", () => {
  it("wall exposes rounded coordinates", () => {
    const d = wallForm({ id: "w", x1: 1.4, y1: 2.6, x2: 3, y2: 4 }).data;
    expect(d).toMatchObject({ x1: 1, y1: 3, x2: 3, y2: 4 });
  });
  it("project fields are required numbers with min 1", () => {
    const form = projectForm({ type: "t", width: 1000, height: 600 } as never);
    const width = form.fields.find((f) => f.name === "width")!;
    expect(width.required).toBe(true);
    expect((width.selector.number as { min: number }).min).toBe(1);
  });
  it("image opacity appears only when an image is set", () => {
    expect(floorImageForm({ image: "x.png" } as never).fields.map((f) => f.name)).toContain("imageOpacity");
    expect(floorImageForm({} as never).fields.map((f) => f.name)).not.toContain("imageOpacity");
  });
});
```

- [ ] **Step 2: Run to fail, then implement.** Key code (full builders; `identityPatch` is the default `toPatch`):

```ts
const identity = (patch: Record<string, unknown>) => patch;

const angleField = (): FormField => ({
  name: "angle",
  label: "Angle",
  selector: { number: { min: 0, max: 360, step: 1, mode: "slider", unit_of_measurement: "°" } },
});

const opt = (value: string, label: string) => ({ value, label });
const dropdown = (...options: { value: string; label: string }[]) => ({
  select: { mode: "dropdown", options },
});

export function openingForm(o: Opening): FormSpec {
  const motion = openingMotion(o);
  const style = sliderStyleOf(o);
  const fields: FormField[] = [
    { name: "type", label: "Type", selector: dropdown(opt("door", "Door"), opt("window", "Window")) },
    { name: "motion", label: "Motion", selector: dropdown(opt("swing", "Swing"), opt("slide", "Slide")) },
    { name: "length", label: "Length", required: true, selector: { number: { min: 1, mode: "box" } } },
  ];
  if (o.type === "door" && motion === "swing")
    fields.push({ name: "hinge", label: "Hinge", selector: dropdown(opt("left", "Left"), opt("right", "Right")) });
  if (motion === "swing")
    fields.push({ name: "opens", label: "Opens", selector: dropdown(opt("this", "This side"), opt("other", "Other side")) });
  if (motion === "slide") {
    if (style !== "biparting")
      fields.push({ name: "slide", label: "Slide", selector: dropdown(opt("left", "To left"), opt("right", "To right")) });
    fields.push({
      name: "style",
      label: "Style",
      selector: dropdown(opt("single", "Single"), opt("bypass", "Bypass (stack)"), opt("biparting", "Biparting (split)")),
    });
  }
  fields.push({
    name: "entity",
    label: "Entity",
    helper: "Type and motion follow the entity's device class",
    selector: { entity: { filter: [{ domain: ["binary_sensor", "cover"] }] } },
  });
  if (o.entity) fields.push({ name: "invert", label: "Invert", selector: { boolean: {} } });
  fields.push(angleField());
  return {
    fields,
    data: {
      type: o.type,
      motion,
      length: o.length,
      hinge: o.flipH ? "right" : "left",
      opens: o.flipV ? "other" : "this",
      slide: o.flipH ? "right" : "left",
      style,
      entity: o.entity ?? "",
      invert: o.invert ?? false,
      angle: o.angle,
    },
    toPatch(patch) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (k === "motion") {
          out.motion = v === "slide" ? "slide" : undefined;
          if (v !== "slide") out.sliderStyle = undefined;
        } else if (k === "hinge" || k === "slide") out.flipH = v === "right" || undefined;
        else if (k === "opens") out.flipV = v === "other" || undefined;
        else if (k === "style") out.sliderStyle = v === "single" ? undefined : v;
        else if (k === "invert") out.invert = v || undefined;
        else if (k === "entity") out.entity = v || undefined;
        else out[k] = v;
      }
      return out;
    },
  };
}

export function itemForm(it: FloorItem): FormSpec {
  const display = it.display ?? "badge";
  const fields: FormField[] = [
    { name: "entity", label: "Entity", required: true, selector: { entity: {} } },
    { name: "secondaryEntity", label: "Second entity", helper: "Shown next to the primary state", selector: { entity: {} } },
    { name: "icon", label: "Icon", selector: { icon: { placeholder: defaultIcon(it.kind) } } },
    { name: "name", label: "Name", selector: { text: {} } },
    { name: "size", label: "Size", selector: { number: { min: 16, max: 160, step: 2, mode: "slider", unit_of_measurement: "px" } } },
    angleField(),
    { name: "display", label: "Display", selector: dropdown(opt("badge", "Icon badge"), opt("ripple", "Ripple"), opt("iconRipple", "Icon + ripple")) },
  ];
  if (display !== "badge")
    fields.push({ name: "rippleSize", label: "Ripple size", selector: { number: { min: 40, max: 400, step: 4, mode: "slider", unit_of_measurement: "px" } } });
  fields.push(
    { name: "showIcon", label: "Show icon", selector: { boolean: {} } },
    { name: "showState", label: "Show state", selector: { boolean: {} } },
    { name: "tap_action", label: "Tap action", selector: { ui_action: { default_action: defaultItemAction(it.entity).action } } },
    { name: "hold_action", label: "Hold action", selector: { ui_action: { default_action: "none" } } },
    { name: "double_tap_action", label: "Double-tap action", selector: { ui_action: { default_action: "none" } } }
  );
  return {
    fields,
    data: {
      entity: it.entity,
      secondaryEntity: it.secondaryEntity ?? "",
      icon: it.icon ?? "",
      name: it.name ?? "",
      size: it.size ?? DEFAULT_ITEM_SIZE,
      angle: it.angle ?? 0,
      display,
      rippleSize: it.rippleSize ?? DEFAULT_RIPPLE_SIZE,
      showIcon: it.showIcon ?? true,
      showState: it.showState ?? false,
      tap_action: it.tap_action,
      hold_action: it.hold_action,
      double_tap_action: it.double_tap_action,
    },
    toPatch: identity,
  };
}
```

`textForm`, `furnitureForm`, `trackerForm`, `wallForm`, `projectForm`, `floorImageForm` follow the same shape:

```ts
export function textForm(t: FloorText): FormSpec {
  return {
    fields: [
      { name: "text", label: "Text", required: true, selector: { text: {} } },
      { name: "size", label: "Size", selector: { number: { min: 8, max: 200, mode: "slider", unit_of_measurement: "px" } } },
      angleField(),
    ],
    data: { text: t.text, size: t.size ?? DEFAULT_TEXT_SIZE, angle: t.angle ?? 0 },
    toPatch: identity,
  };
}

export function furnitureForm(f: Furniture): FormSpec {
  return {
    fields: [
      { name: "type", label: "Type", selector: { select: { mode: "dropdown", options: FURNITURE_TYPES.map((t) => ({ value: t, label: FURNITURE_LABELS[t] })) } } },
      { name: "w", label: "Width", required: true, selector: { number: { min: 10, mode: "box" } } },
      { name: "h", label: "Height", required: true, selector: { number: { min: 10, mode: "box" } } },
      angleField(),
    ],
    data: { type: f.type, w: f.w, h: f.h, angle: f.angle ?? 0 },
    toPatch: identity,
  };
}

export function trackerForm(tr: Tracker): FormSpec {
  return {
    fields: [
      { name: "w", label: "Width", required: true, selector: { number: { min: 10, mode: "box" } } },
      { name: "h", label: "Height", required: true, selector: { number: { min: 10, mode: "box" } } },
      { name: "x", label: "X", required: true, selector: { number: { mode: "box" } } },
      { name: "y", label: "Y", required: true, selector: { number: { mode: "box" } } },
      angleField(),
      { name: "dotSize", label: "Dot size", selector: { number: { min: 6, max: 80, mode: "slider", unit_of_measurement: "px" } } },
    ],
    data: { w: tr.w, h: tr.h, x: Math.round(tr.x), y: Math.round(tr.y), angle: tr.angle ?? 0, dotSize: tr.dotSize ?? DEFAULT_TRACKER_DOT_SIZE },
    toPatch: identity,
  };
}

export function wallForm(w: Wall): FormSpec {
  const coord = (name: string, label: string): FormField => ({
    name, label, required: true, selector: { number: { mode: "box" } },
  });
  return {
    fields: [coord("x1", "Start X"), coord("y1", "Start Y"), coord("x2", "End X"), coord("y2", "End Y")],
    data: { x1: Math.round(w.x1), y1: Math.round(w.y1), x2: Math.round(w.x2), y2: Math.round(w.y2) },
    toPatch: identity,
  };
}

export function projectForm(c: FloorplanCardConfig): FormSpec {
  return {
    fields: [
      { name: "title", label: "Title", selector: { text: {} } },
      { name: "width", label: "Canvas width", required: true, selector: { number: { min: 1, mode: "box" } } },
      { name: "height", label: "Canvas height", required: true, selector: { number: { min: 1, mode: "box" } } },
      { name: "grid", label: "Grid size", required: true, helper: `Gap between grid lines, in canvas units (canvas is ${c.width}×${c.height})`, selector: { number: { min: 1, mode: "box" } } },
    ],
    data: { title: c.title ?? "", width: c.width, height: c.height, grid: c.grid ?? DEFAULT_GRID },
    toPatch: identity,
  };
}

export function floorImageForm(f: Floor): FormSpec {
  const fields: FormField[] = [
    { name: "image", label: "Bg image", helper: "/local/floorplan.png or URL", selector: { text: {} } },
  ];
  if (f.image)
    fields.push({ name: "imageOpacity", label: "Image opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } });
  return { fields, data: { image: f.image ?? "", imageOpacity: f.imageOpacity ?? 1 }, toPatch: identity };
}
```

Move `FURNITURE_TYPES` + `FURNITURE_LABELS` here (export both; update `src/editor.ts` imports).

- [ ] **Step 3: Run to pass, typecheck, commit** — `feat(editor): schema builders for every element kind and the project panel`

---

### Task 4: card wiring — actionHandler directive + item actions

**Files:**
- Create: `src/action-handler.ts` (canonical HA directive: singleton `<action-handler>` on document.body; touchstart/touchend/touchcancel/mousedown/click/keydown; 500ms hold timer; 250ms double-tap window; fires `action` event with `{ action: "tap"|"hold"|"double_tap" }`; exports `actionHandler(options: { hasHold?: boolean; hasDoubleClick?: boolean })` lit directive — vendor the implementation used by Mushroom/HA verbatim, adapted to plain lit imports)
- Modify: `src/floorplan-card.ts`

**Steps:**

- [ ] **Step 1:** Vendor the directive into `src/action-handler.ts` (implementation is the standard ~120-line community pattern; no tests — covered behaviorally).
- [ ] **Step 2:** In `src/floorplan-card.ts`: import `{ actionHandler }` from `./action-handler` and `{ actionForGesture, executeAction, hasAction }` from `./actions`. Replace the item hit-target binding (`@click=${() => this._onItemClick(item)}` around line 207) with:

```ts
@action=${(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>) =>
  this._handleItemAction(ev, item)}
.actionHandler=${actionHandler({
  hasHold: hasAction(item.hold_action),
  hasDoubleClick: hasAction(item.double_tap_action),
})}
```

Add the handler and delete `_onItemClick` + the now-unused `ACTIVE_DOMAINS` set (grep first — if `ACTIVE_DOMAINS` has other users, keep it):

```ts
private _handleItemAction(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>, item: FloorItem): void {
  if (!this.hass) return;
  executeAction(this, this.hass, item, actionForGesture(item, ev.detail.action));
}
```

- [ ] **Step 3:** Verify + commit — `feat(card): standard tap/hold/double-tap actions on items with behavior-preserving defaults`

---

### Task 5: editor `_renderForm` + patch routing + component loading

**Files:**
- Modify: `src/editor.ts`

- [ ] **Step 1: `_renderForm`** (place near `_renderEntityPicker`):

```ts
private _renderForm(
  spec: FormSpec,
  apply: (patch: Record<string, unknown>, live: boolean) => void
): TemplateResult {
  if (customElements.get("ha-form")) {
    return html`<ha-form
      .hass=${this.hass}
      .data=${spec.data}
      .schema=${spec.fields}
      .computeLabel=${formLabel}
      .computeHelper=${formHelper}
      @value-changed=${(ev: CustomEvent) => {
        // ha-form re-fires a consolidated event; keep it out of HA's dialog.
        ev.stopPropagation();
        const raw = diffFormValue(spec.data, ev.detail.value as Record<string, unknown>, spec.fields);
        const patch = normalizeFormPatch(raw, spec.fields);
        const names = Object.keys(patch);
        if (!names.length) return;
        const live = names.length === 1 && isLiveField(spec.fields.find((f) => f.name === names[0])!);
        apply(spec.toPatch(patch), live);
      }}
    ></ha-form>`;
  }
  // Same schema through plain inputs (dev harness / load failure); ha-form
  // upgrades in place via the whenDefined hook in firstUpdated.
  return html`${spec.fields.map((f) => this._renderFallbackField(spec, f, apply))}`;
}
```

Module-level (near other consts): `const formLabel = (s: FormField) => s.label;` and `const formHelper = (s: FormField) => s.helper;`

- [ ] **Step 2: `_renderFallbackField`** — one `.row` per field, mirroring today's markup:

```ts
private _applyFallback(
  spec: FormSpec,
  field: FormField,
  value: unknown,
  live: boolean,
  apply: (patch: Record<string, unknown>, live: boolean) => void
): void {
  const patch = normalizeFormPatch({ [field.name]: value }, spec.fields);
  if (field.name in patch) apply(spec.toPatch(patch), live && isLiveField(field));
}

private _renderFallbackField(
  spec: FormSpec,
  f: FormField,
  apply: (patch: Record<string, unknown>, live: boolean) => void
): TemplateResult {
  const value = spec.data[f.name];
  const sel = f.selector;
  if ("select" in sel) {
    const options = (sel.select as { options: { value: string; label: string }[] }).options;
    return html`<div class="row">
      <label>${f.label}</label>
      <select
        .value=${String(value ?? "")}
        @change=${(e: Event) => this._applyFallback(spec, f, (e.target as HTMLSelectElement).value, false, apply)}
      >
        ${options.map((o) => html`<option value=${o.value} ?selected=${o.value === value}>${o.label}</option>`)}
      </select>
    </div>`;
  }
  if ("boolean" in sel) {
    return html`<div class="row">
      <label>${f.label}</label>
      <input
        type="checkbox"
        .checked=${!!value}
        @change=${(e: Event) => this._applyFallback(spec, f, (e.target as HTMLInputElement).checked, false, apply)}
      />
    </div>`;
  }
  if ("number" in sel) {
    const n = sel.number as { min?: number; max?: number; step?: number; mode?: string };
    const slider = n.mode === "slider";
    return html`<div class="row">
      <label>${f.label}</label>
      ${slider
        ? html`<input
            type="range"
            min=${n.min ?? 0}
            max=${n.max ?? 100}
            step=${n.step ?? 1}
            .value=${String(value ?? n.min ?? 0)}
            @input=${(e: Event) => this._applyFallback(spec, f, Number((e.target as HTMLInputElement).value), true, apply)}
          />`
        : nothing}
      <input
        class="num"
        type="number"
        min=${n.min ?? nothing}
        max=${n.max ?? nothing}
        step=${n.step ?? nothing}
        .value=${String(value ?? "")}
        @change=${(e: Event) => {
          const input = e.target as HTMLInputElement;
          this._applyFallback(spec, f, input.value === "" ? undefined : Number(input.value), false, apply);
          input.value = String(spec.data[f.name] ?? "");
        }}
      />
    </div>`;
  }
  if ("entity" in sel) {
    const filter = (sel.entity as { filter?: { domain?: string[] }[] }).filter;
    return html`<div class="row wide">
      <label>${f.label}</label>
      ${this._renderEntityPicker(String(value ?? ""), (v) => this._applyFallback(spec, f, v, false, apply), filter?.[0]?.domain)}
    </div>`;
  }
  if ("icon" in sel) {
    return html`<div class="row wide">
      <label>${f.label}</label>
      <input
        type="text"
        placeholder=${(sel.icon as { placeholder?: string }).placeholder ?? "mdi:…"}
        .value=${String(value ?? "")}
        @change=${(e: Event) => this._applyFallback(spec, f, (e.target as HTMLInputElement).value, false, apply)}
      />
    </div>`;
  }
  if ("ui_action" in sel) return html`${nothing}`; // YAML-only outside HA
  // text
  return html`<div class="row">
    <label>${f.label}</label>
    <input
      type="text"
      .value=${String(value ?? "")}
      @input=${(e: Event) => this._applyFallback(spec, f, (e.target as HTMLInputElement).value, true, apply)}
    />
  </div>`;
}
```

Note the numeric `@change` re-syncs `input.value` from `spec.data` after apply, reproducing the keep-old-value behavior when `normalizeFormPatch` drops an invalid required number.

- [ ] **Step 3: `_ensureHaComponents`** — replace `_ensurePickers` body and `firstUpdated`:

```ts
/**
 * `ha-form`, `ha-entity-picker` and friends are only defined once HA loads an
 * editor that imports them. The button-card editor statically imports ha-form
 * (and the ui_action selector chain); the entities editor defines
 * ha-entity-picker for the custom tracker rows. Every selector rendered by
 * ha-form lazy-loads its own picker after that.
 */
private async _ensureHaComponents(): Promise<void> {
  if (customElements.get("ha-form") && customElements.get("ha-entity-picker")) return;
  const helpers = await (window as unknown as { loadCardHelpers?: () => Promise<any> })
    .loadCardHelpers?.();
  if (!helpers) return;
  for (const config of [{ type: "button" }, { type: "entities", entities: [] }]) {
    try {
      const card = await helpers.createCardElement(config);
      await card?.constructor?.getConfigElement?.();
    } catch {
      // Fall back to plain inputs; whenDefined below upgrades late arrivals.
    }
  }
  this.requestUpdate();
}

protected firstUpdated(): void {
  void this._ensureHaComponents();
  for (const tag of ["ha-form", "ha-entity-picker", "ha-icon-picker"]) {
    if (!customElements.get(tag)) {
      void customElements.whenDefined(tag).then(() => this.requestUpdate());
    }
  }
}
```

(Delete `_ensurePickers`; update its call site and doc comment.)

- [ ] **Step 4:** typecheck (expect unused warnings only if sections not yet wired — tolerated until Task 6 in the same working tree; do NOT commit yet if typecheck fails, fold Step 5 commit into Task 6's if needed). Otherwise commit — `feat(editor): schema-driven form renderer with plain-input fallback`

---

### Task 6: replace editor sections with forms

**Files:**
- Modify: `src/editor.ts` (`_renderSelectionEditor` ~2370-3010, `_renderPanelBody` ~2232-2323, delete `_renderAngleRow`)

Per-kind apply helpers (place near the `_updateX` sextet):

```ts
private _applyElementPatch(
  kind: "opening" | "item" | "text" | "furniture" | "tracker" | "wall",
  id: string,
  patch: Record<string, unknown>,
  live: boolean
): void {
  const commit = {
    opening: (p: never) => this._updateOpening(id, p),
    item: (p: never) => this._updateItem(id, p),
    text: (p: never) => this._updateText(id, p),
    furniture: (p: never) => this._updateFurniture(id, p),
    tracker: (p: never) => this._updateTracker(id, p),
    wall: (p: never) => this._updateWall(id, p),
  }[kind];
  const liveUpdate = {
    opening: (p: never) => this._updateOpeningLive(id, p),
    item: (p: never) => this._updateItemLive(id, p),
    text: (p: never) => this._updateTextLive(id, p),
    furniture: (p: never) => this._updateFurnitureLive(id, p),
    tracker: (p: never) => this._updateTrackerLive(id, p),
    wall: (p: never) => this._updateWallLive(id, p),
  }[kind];
  (live ? liveUpdate : commit)(patch as never);
}
```

Add the missing `_updateWallLive` (mirrors the other live helpers):

```ts
private _updateWallLive(id: string, partial: Partial<Wall>): void {
  this._beginLive("wall", id, partial);
  this._emitFloor({
    walls: this._floor().walls.map((w) => (w.id === id ? { ...w, ...partial } : w)),
  });
}
```

- [ ] **Step 1: Opening section.** Replace the entire opening branch of `_renderSelectionEditor` (the Type/Motion/Length/Hinge/Opens/Slide/Style/Entity/Invert rows and angle row — KEEP the Active-color rows) with:

```ts
if (sel.kind === "opening") {
  const o = this._floor().openings.find((x) => x.id === sel.id);
  if (!o) return html`${nothing}`;
  return html`
    ${this._renderForm(openingForm(o), (patch, live) => {
      // Infer type/motion from the entity's device class, as before.
      if ("entity" in patch) {
        const entity = patch.entity as string | undefined;
        const dc = entity
          ? (this.hass?.states[entity]?.attributes?.device_class as string | undefined)
          : undefined;
        patch = { ...patch, ...(dc ? openingFromDeviceClass(dc) : {}) };
      }
      this._applyElementPatch("opening", o.id, patch, live);
    })}
    ${o.entity
      ? html`<div class="row">
          <label>Active color</label>
          <!-- existing color swatch + text pair, unchanged -->
        </div>`
      : nothing}
  `;
}
```

(Keep the existing Active-color row markup verbatim — only the migrated rows are removed.)

- [ ] **Step 2: Item section.** Replace entity/2nd-entity/icon/name/size/angle/display/ripple-size/showIcon/showState rows (KEEP the Ripple-color rows) with:

```ts
if (sel.kind === "item") {
  const it = this._floor().items.find((x) => x.id === sel.id);
  if (!it) return html`${nothing}`;
  return html`
    ${this._renderForm(itemForm(it), (patch, live) => {
      if ("entity" in patch && typeof patch.entity === "string" && patch.entity) {
        patch = { ...patch, kind: kindFromEntity(patch.entity) };
      }
      this._applyElementPatch("item", it.id, patch, live);
    })}
    ${(it.display ?? "badge") !== "badge"
      ? html`<!-- existing Ripple color row, unchanged -->`
      : nothing}
  `;
}
```

- [ ] **Step 3: Text / Furniture / Tracker / Wall sections.** Same pattern: form first, kept-custom rows after.
  - text: `${this._renderForm(textForm(t), (p, l) => this._applyElementPatch("text", t.id, p, l))}` + existing Color row.
  - furniture: form + existing Color row.
  - tracker: existing `_renderTrackerSensorRows` (both axes) FIRST, then form, then existing Color row.
  - wall: form + existing Length resize row (keep verbatim, including its direction math).
- [ ] **Step 4: Project panel.** `_renderPanelBody` becomes:

```ts
private _renderPanelBody(): TemplateResult {
  const floor = this._floor();
  return html`
    <div class="rows panel-body">
      ${this._renderForm(projectForm(this._config), (patch, live) => {
        if ("grid" in patch && typeof patch.grid === "number") {
          this._setGrid(patch.grid);
          return;
        }
        if (live) this._patchConfigLive(patch as Partial<FloorplanCardConfig>);
        else this._patchConfig(patch as Partial<FloorplanCardConfig>);
      })}
      <!-- existing Background color row, unchanged -->
      ${this._renderForm(floorImageForm(floor), (patch, live) => {
        if (live) this._patchFloorLive(patch as Partial<Floor>);
        else this._commitFloor(patch as Partial<Floor>);
      })}
    </div>
  `;
}
```

Normalization detail: `title: "" → undefined` comes from `normalizeFormPatch` (optional text); `image: "" → undefined` likewise.

- [ ] **Step 5:** Delete `_renderAngleRow` and any now-unused imports/constants (`DEFAULT_ITEM_SIZE` etc. — keep the ones the Add popover still uses; `FURNITURE_TYPES`/`FURNITURE_LABELS` now import from `./editor-forms`).
- [ ] **Step 6:** Full verify (`npm run typecheck && npm test && npm run build`) + commit — `feat(editor): migrate element and project rows to schema-driven ha-form`

---

### Task 7: end-to-end verification + review + push

- [ ] **Step 1:** Full suite green.
- [ ] **Step 2:** Update the Playwright script (scratchpad `pw/verify.mjs`) for the new markup and re-run against `npm run serve`:
  - existing checks must still pass (text field burst-undo, slider burst, icon fallback input, entity stub row, keyboard scoping, drag history, fullscreen);
  - ADD: changing the item Display select (fallback `<select>`) commits and is one undo step; clearing the wall Start X number box keeps the old value; item click in the CARD preview still toggles (assert via harness `hass.callService` stub if available, else skip with a note).
- [ ] **Step 3:** superpowers:requesting-code-review on `feat/ha-form-editor` vs `feat/editor-fullscreen` (base `30a7966`); fix findings; re-verify.
- [ ] **Step 4:** Push: `git push -u origin feat/ha-form-editor`.
