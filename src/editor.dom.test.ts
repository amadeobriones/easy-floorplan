// @vitest-environment jsdom
/**
 * The editor's *render path*, exercised for real.
 *
 * Everything else in this suite tests pure modules, or reads the source as text.
 * Nothing mounts the editor — so `_renderForm`, the keyboard ladder, and the undo
 * discipline have never once been executed by a test. Every fix we took from
 * upstream on 2026-07-11 lives in exactly that gap.
 *
 * The `<ha-form>` here is a stub, and a deliberately strict one: it rejects any
 * selector outside Home Assistant's vocabulary. A selector HA does not know
 * renders as a blank row in a real dashboard and throws nothing — the failure is
 * silent, which is precisely the kind we cannot afford to discover in production.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { FloorplanCardConfig } from "./types";

/** Selector keys Home Assistant actually implements, of the ones we emit. */
const HA_SELECTORS = new Set([
  "entity",
  "icon",
  "text",
  "number",
  "boolean",
  "select",
  "ui_action",
  "area",
]);

/**
 * Validate one field the way HA would. Exported so the all-builders test uses the
 * *same* rules as the mounted stub — one definition of "valid", not two that drift.
 *
 * The stub can only ever prove *our* side of the contract. It cannot prove HA
 * accepts these selectors, because HA does not publish its frontend components to
 * npm (checked: `home-assistant-frontend` is unpublished; `custom-card-helpers`
 * carries no selector types). So the vocabulary below is hand-maintained, and the
 * live check in docs/UPSTREAM_SYNC.md is what closes the remaining gap.
 */
export function selectorProblem(f: {
  name?: string;
  label?: string;
  selector?: Record<string, unknown>;
}): string | null {
  if (!f.name) return "a field with no name cannot round-trip a value";
  if (!f.label) return `field "${f.name}": no label — computeLabel would render it blank`;

  const keys = Object.keys(f.selector ?? {});
  if (keys.length !== 1) {
    return `field "${f.name}": a selector must have exactly one key, got [${keys}]`;
  }
  const kind = keys[0];
  if (!HA_SELECTORS.has(kind)) {
    return `field "${f.name}": HA has no "${kind}" selector — it would render as a blank row`;
  }

  // A well-named selector with a malformed body still fails, just later and quieter.
  const body = (f.selector as Record<string, Record<string, unknown>>)[kind];
  if (kind === "select") {
    const options = body?.options as Array<{ value?: unknown; label?: unknown }> | undefined;
    if (!Array.isArray(options) || options.length === 0) {
      return `field "${f.name}": a select with no options renders an empty dropdown`;
    }
    for (const o of options) {
      if (typeof o?.value !== "string" || typeof o?.label !== "string") {
        return `field "${f.name}": select options must be {value,label} strings, got ${JSON.stringify(o)}`;
      }
    }
  }
  if (kind === "number") {
    const { min, max } = (body ?? {}) as { min?: number; max?: number };
    if (min !== undefined && max !== undefined && min > max) {
      return `field "${f.name}": number selector has min ${min} > max ${max}`;
    }
  }
  return null;
}

/** Fields ha-form was handed, per instance, so tests can assert on the schema. */
class HaFormStub extends HTMLElement {
  public hass: unknown;
  public data: Record<string, unknown> = {};
  private _schema: Array<{ name: string; selector: Record<string, unknown> }> = [];

  set schema(fields: Array<{ name: string; selector: Record<string, unknown> }>) {
    for (const f of fields) {
      const problem = selectorProblem(f);
      if (problem) throw new Error(problem);
    }
    this._schema = fields;
  }
  get schema() {
    return this._schema;
  }

  /** What HA's ha-form emits: the *whole* data object, not the one field that changed. */
  public edit(patch: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...this.data, ...patch } },
        bubbles: true,
        composed: true,
      })
    );
  }
}

const CONFIG: FloorplanCardConfig = {
  type: "custom:easy-floorplan-card",
  width: 1000,
  height: 600,
  walls: [],
  items: [
    { id: "i1", entity: "light.kitchen", kind: "light", x: 100, y: 100, angle: 0 },
  ],
  furniture: [],
  openings: [],
  texts: [],
  trackers: [],
} as unknown as FloorplanCardConfig;

const HASS = { states: {}, entities: {}, formatEntityState: () => "on" };

/**
 * Mount the editor with an element selected — the ELEMENT panel (and therefore
 * any `ha-form`) only renders for a selection, exactly as the real editor says:
 * "Select an element on the canvas to edit its properties here."
 */
async function mountEditor(sel: { kind: string; id: string } | null = { kind: "item", id: "i1" }) {
  const { FloorplanCardEditor } = await import("./editor");
  const el = document.createElement("easy-floorplan-card-editor") as InstanceType<
    typeof FloorplanCardEditor
  >;
  const priv = el as unknown as {
    hass: unknown;
    _selection: unknown[];
    updateComplete: Promise<unknown>;
  };
  priv.hass = HASS;
  el.setConfig(structuredClone(CONFIG));
  document.body.appendChild(el);
  await priv.updateComplete;
  if (sel) {
    priv._selection = [sel];
    await priv.updateComplete;
  }
  return el;
}

beforeAll(() => {
  customElements.define("ha-form", HaFormStub);
  // jsdom implements neither; the editor calls both on the fullscreen host.
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the editor renders through HA's ha-form, not our fallback", () => {
  it("mounts and uses <ha-form> once it is registered", async () => {
    const el = await mountEditor();
    const forms = el.shadowRoot!.querySelectorAll("ha-form");
    expect(forms.length).toBeGreaterThan(0);
  });

  it("hands ha-form a schema HA can actually render", async () => {
    // The stub throws on an unknown selector, so mounting at all is the assertion.
    const el = await mountEditor();
    const form = el.shadowRoot!.querySelector("ha-form") as HaFormStub;
    expect(form.schema.length).toBeGreaterThan(0);
    for (const f of form.schema) {
      expect(HA_SELECTORS.has(Object.keys(f.selector)[0])).toBe(true);
    }
  });
});

describe("every form builder emits a schema HA can render", () => {
  // Mounting only renders the *selected* element's form, so the check above sees
  // itemForm and nothing else. Nine other builders reach real dashboards. A
  // selector HA does not implement fails silently there — a blank row, no error.
  it("no builder emits a selector outside HA's vocabulary", async () => {
    const f = await import("./editor-forms");
    const specs = [
      f.openingForm({ id: "o", kind: "door", x: 0, y: 0, w: 40, angle: 0 } as never),
      f.itemForm({ id: "i", entity: "light.a", kind: "light", x: 0, y: 0 } as never),
      f.textForm({ id: "t", text: "hi", x: 0, y: 0 } as never),
      f.roomForm({ id: "r", name: "R", points: [] } as never, true, true),
      f.furnitureForm({ id: "f", type: "sectional", x: 0, y: 0, w: 10, h: 10 } as never),
      f.trackerForm({ id: "tr", entity: "device_tracker.a", x: 0, y: 0 } as never),
      f.wallForm({ id: "w", x1: 0, y1: 0, x2: 10, y2: 0 } as never),
      f.projectForm(structuredClone(CONFIG)),
      f.featuresForm(structuredClone(CONFIG)),
      f.floorImageForm({ id: "fl", name: "F" } as never, true),
    ];

    const offenders: string[] = [];
    for (const spec of specs) {
      for (const field of spec.fields as Array<Parameters<typeof selectorProblem>[0]>) {
        const problem = selectorProblem(field);
        if (problem) offenders.push(problem);
      }
    }
    expect(offenders).toEqual([]);
    // Guard the guard: if a builder ever returns nothing, the loop above is vacuous.
    expect(specs.every((s) => s.fields.length > 0)).toBe(true);
  });
});

describe("value-changed from ha-form", () => {
  it("does not escape the editor — HA's dialog must never see it", async () => {
    const el = await mountEditor();
    const form = el.shadowRoot!.querySelector("ha-form") as HaFormStub;

    const leaked = vi.fn();
    document.addEventListener("value-changed", leaked);

    form.edit({ [form.schema[0].name]: form.data[form.schema[0].name] ?? "x" });

    // ha-form's event is consolidated and re-fired; if it bubbles out of the editor
    // it reaches HA's card-config dialog, which treats it as a config edit.
    expect(leaked).not.toHaveBeenCalled();
    document.removeEventListener("value-changed", leaked);
  });
});

describe("upstream fixes we adopted on 2026-07-11 (previously untested)", () => {
  it("getGridOptions is an instance method — HA calls it on the element", async () => {
    const { FloorplanCard } = await import("./floorplan-card");
    const card = new FloorplanCard();
    // As a `static` this was silently ignored and sections-view sizing never applied.
    expect(typeof (card as unknown as { getGridOptions?: unknown }).getGridOptions).toBe(
      "function"
    );
    expect(
      (card as unknown as { getGridOptions: () => unknown }).getGridOptions()
    ).toMatchObject({ columns: 12, rows: 8 });
  });

  it("an empty YAML key ('trackers:') is unset, not malformed", async () => {
    const { FloorplanCard } = await import("./floorplan-card");
    const card = new FloorplanCard();
    const cfg = { ...structuredClone(CONFIG), trackers: null } as unknown as FloorplanCardConfig;
    // Before 6600e04 this threw: null !== undefined, and null is not an Array.
    expect(() => card.setConfig(cfg)).not.toThrow();
  });
});

describe("editor icon preview matches the card (registry-icon override)", () => {
  it("uses the entity-registry icon in the editor preview, as the card does", async () => {
    const { FloorplanCardEditor } = await import("./editor");
    const el = document.createElement("easy-floorplan-card-editor") as InstanceType<
      typeof FloorplanCardEditor
    >;
    const priv = el as unknown as { hass: unknown; updateComplete: Promise<unknown> };
    // A user's Settings→Entities icon override lives at hass.entities[id].icon,
    // never in the state attributes — the editor preview ignored it before.
    priv.hass = {
      states: { "light.kitchen": { state: "on", attributes: {} } },
      entities: { "light.kitchen": { icon: "mdi:registry-override" } },
      formatEntityState: () => "on",
    };
    el.setConfig(structuredClone(CONFIG));
    document.body.appendChild(el);
    await priv.updateComplete;

    const icons = [...el.shadowRoot!.querySelectorAll("ha-icon")].map((n) => n.getAttribute("icon"));
    expect(icons).toContain("mdi:registry-override");
  });
});
