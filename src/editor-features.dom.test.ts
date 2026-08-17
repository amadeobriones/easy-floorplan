// @vitest-environment jsdom
/**
 * The editor UI for the four fork features (issue #35) — *wiring*, not form
 * shapes.
 *
 * `editor-forms.test.ts` covers `featuresForm` / `itemPowerForm` /
 * `areaTempForm` as pure functions, and every one of them would pass with the
 * editor never calling any of them. That is precisely what shipped: the
 * v1.4.1 port ported the four features, their tests and their card wiring,
 * but no task owned the editor forms, so `FEATURE_META` had zero non-test
 * consumers and `powerEntity`/`tempEntity` appeared nowhere in editor.ts. A
 * GUI user could not switch a flag on, and hand-editing YAML to set
 * `energyLayer: true` still left no field to bind the sensor the layer draws
 * from.
 *
 * So these tests mount the real editor and look for the controls, following
 * `editor-area-populate.dom.test.ts`. Under jsdom neither `ha-form` nor
 * `ha-entity-picker` is registered, so the forms render through the editor's
 * plain-input fallback — a `<label>` plus an `<input>` in the same `.row`.
 */
import { describe, it, expect, afterEach } from "vitest";
import "./editor";
import { FEATURE_META } from "./features";
import type { FloorplanCardConfig, HomeAssistant, Area, FloorItem, FeaturesConfig } from "./types";

type EditorEl = HTMLElement & {
  setConfig(c: FloorplanCardConfig): void;
  updateComplete: Promise<unknown>;
  hass?: HomeAssistant;
  _selection: Array<{ kind: string; id: string }>;
  _featuresOpen: boolean;
  _config: FloorplanCardConfig;
};

const AREA_ID = "a1";
const ITEM_ID = "i1";

const area = (extra: Partial<Area> = {}): Area => ({
  id: AREA_ID,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ],
  ...extra,
});

const item = (extra: Partial<FloorItem> = {}): FloorItem =>
  ({ id: ITEM_ID, x: 10, y: 10, kind: "switch", entity: "switch.plug", ...extra }) as FloorItem;

function mkConfig(features?: FeaturesConfig, extra: Partial<FloorplanCardConfig> = {}): FloorplanCardConfig {
  return {
    type: "custom:easy-floorplan-card",
    width: 400,
    height: 300,
    walls: [],
    openings: [],
    items: [item()],
    texts: [],
    furniture: [],
    trackers: [],
    areas: [area()],
    features,
    ...extra,
  } as FloorplanCardConfig;
}

const hass = () => ({ areas: {}, entities: {}, devices: {}, states: {} }) as unknown as HomeAssistant;

async function mount(config: FloorplanCardConfig, selection?: { kind: string; id: string }) {
  const el = document.createElement("easy-floorplan-card-editor") as unknown as EditorEl;
  document.body.appendChild(el);
  el.setConfig(config);
  el.hass = hass();
  if (selection) el._selection = [selection];
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

/** Every `<label>` the editor is currently showing, trimmed. */
const labels = (el: EditorEl): string[] =>
  [...el.shadowRoot!.querySelectorAll("label")].map((l) => l.textContent!.trim());

/** The input sitting in the same `.row` as the label reading `text`. */
function rowInput(el: EditorEl, text: string): HTMLInputElement {
  const label = [...el.shadowRoot!.querySelectorAll("label")].find(
    (l) => l.textContent!.trim() === text
  );
  if (!label) throw new Error(`no field labelled "${text}" — have: ${labels(el).join(", ")}`);
  const input = label.parentElement!.querySelector("input");
  if (!input) throw new Error(`field "${text}" has no input`);
  return input as HTMLInputElement;
}

/** The Features section's collapsed one-line summary. */
function featuresSummary(el: EditorEl): string {
  const toggle = [...el.shadowRoot!.querySelectorAll(".section-toggle")].find((b) =>
    b.textContent!.includes("Features")
  );
  if (!toggle) throw new Error("no Features section");
  return toggle.querySelector(".section-summary")!.textContent!.trim();
}

describe("the Features panel", () => {
  it("exists, collapsed, reporting that nothing is on", async () => {
    const el = await mount(mkConfig());
    expect(featuresSummary(el)).toBe("All off");
  });

  it("counts what is enabled without being expanded", async () => {
    const el = await mount(mkConfig({ energyLayer: true, radialControls: true }));
    expect(featuresSummary(el)).toBe(`2 of ${FEATURE_META.length} enabled`);
  });

  it("offers a toggle for every feature the card has, once expanded", async () => {
    const el = await mount(mkConfig());
    el._featuresOpen = true;
    await el.updateComplete;
    // The whole point: a flag with no toggle is a feature nobody can reach.
    for (const m of FEATURE_META) expect(labels(el)).toContain(m.label);
  });

  it("switching a toggle on writes the flag into the config", async () => {
    const el = await mount(mkConfig());
    el._featuresOpen = true;
    await el.updateComplete;

    const box = rowInput(el, "Energy layer");
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await el.updateComplete;

    expect(el._config.features).toEqual({ energyLayer: true });
  });

  it("switching the last one off drops the features block rather than storing false", async () => {
    const el = await mount(mkConfig({ energyLayer: true }));
    el._featuresOpen = true;
    await el.updateComplete;

    const box = rowInput(el, "Energy layer");
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    await el.updateComplete;

    expect(el._config.features).toBeUndefined();
  });
});

describe("the per-element bindings the layers read", () => {
  const selectedItem = { kind: "item", id: ITEM_ID };
  const selectedArea = { kind: "area", id: AREA_ID };

  it("offers a device no Power sensor field while the energy layer is off", async () => {
    const el = await mount(mkConfig(), selectedItem);
    expect(labels(el)).not.toContain("Power sensor");
  });

  it("offers one once the energy layer is on", async () => {
    const el = await mount(mkConfig({ energyLayer: true }), selectedItem);
    expect(labels(el)).toContain("Power sensor");
  });

  it("binds the sensor the energy layer actually reads", async () => {
    const el = await mount(mkConfig({ energyLayer: true }), selectedItem);
    const input = rowInput(el, "Power sensor");
    input.value = "sensor.plug_power";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el._config.floors![0]!.items[0]!.powerEntity).toBe("sensor.plug_power");
  });

  it("keeps showing a binding that already exists, even with the layer off", async () => {
    // Otherwise a hand-written config's powerEntity would be invisible in the
    // editor and impossible to clear.
    const el = await mount(
      mkConfig(undefined, { items: [item({ powerEntity: "sensor.plug_power" })] }),
      selectedItem
    );
    expect(rowInput(el, "Power sensor").value).toBe("sensor.plug_power");
  });

  it("offers a room no Temperature sensor field while the climate layer is off", async () => {
    const el = await mount(mkConfig(), selectedArea);
    expect(labels(el)).not.toContain("Temperature sensor");
  });

  it("binds the sensor the climate layer actually reads", async () => {
    const el = await mount(mkConfig({ thermalLayer: true }), selectedArea);
    const input = rowInput(el, "Temperature sensor");
    input.value = "sensor.hall_temperature";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el._config.floors![0]!.areas![0]!.tempEntity).toBe("sensor.hall_temperature");
  });

  it("keeps showing a room's existing binding with the layer off", async () => {
    const el = await mount(
      mkConfig(undefined, { areas: [area({ tempEntity: "sensor.hall_temperature" })] }),
      selectedArea
    );
    expect(rowInput(el, "Temperature sensor").value).toBe("sensor.hall_temperature");
  });
});
