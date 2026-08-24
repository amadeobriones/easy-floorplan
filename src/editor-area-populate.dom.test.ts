// @vitest-environment jsdom
/**
 * DOM coverage for the "Add all devices in this HA area" button's *filtering
 * composition* in editor.ts: `_pendingAreaEntities`, `_unplacedAreaEntities`,
 * `_areaHasFilteredOutEntities`, and the button's three-way disabled title.
 *
 * `entityIsPlaceable` itself is unit-tested byte-for-byte in types.test.ts.
 * What nothing covered before this file is the *composition* around it — the
 * `&&` chain in `_pendingAreaEntities`, the "already placed" vs "filtered
 * out" distinction, and the three template branches for the button's
 * title/label. A regression flipping `&&` to `||`, inverting
 * `entityIsPlaceable`'s result, or breaking a title branch would pass the
 * full suite without a test like this one — the predicate is borrowed from
 * the retired fork, but the wiring is what this task actually contributed.
 *
 * `src/editor-zoom-wheel.dom.test.ts` is the precedent for mounting the
 * editor under jsdom and reaching its private `@state` fields directly.
 */
import { describe, it, expect, afterEach } from "vitest";
import "./editor";
import type { FloorplanCardConfig, HomeAssistant, Area, FloorItem } from "./types";

type EditorEl = HTMLElement & {
  setConfig(c: FloorplanCardConfig): void;
  updateComplete: Promise<unknown>;
  hass?: HomeAssistant;
  _selection: Array<{ kind: string; id: string }>;
  _config: FloorplanCardConfig;
};

const AREA_ID = "a1";
const HA_AREA_ID = "kitchen";

function area(): Area {
  return {
    id: AREA_ID,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    haArea: HA_AREA_ID,
  };
}

function mkConfig(items: FloorItem[] = []): FloorplanCardConfig {
  return {
    type: "custom:easy-floorplan-card",
    width: 400,
    height: 300,
    grid: 5,
    walls: [],
    openings: [],
    items,
    texts: [],
    furniture: [],
    trackers: [],
    areas: [area()],
  };
}

/** A minimal registry-shaped `hass`: entities keyed by id, all in `kitchen`. */
function mkHass(entities: Record<string, Record<string, unknown>>): HomeAssistant {
  return {
    areas: { [HA_AREA_ID]: { area_id: HA_AREA_ID, name: "Kitchen" } },
    entities,
    devices: {},
    states: {},
  } as unknown as HomeAssistant;
}

function placedItem(id: string, entity: string): FloorItem {
  return { id, entity, x: 10, y: 10, kind: "light", showIcon: true, size: 34 };
}

async function mount(config: FloorplanCardConfig, hass: HomeAssistant): Promise<EditorEl> {
  const el = document.createElement("easy-floorplan-card-editor") as unknown as EditorEl;
  document.body.appendChild(el);
  el.setConfig(config);
  el.hass = hass;
  el._selection = [{ kind: "area", id: AREA_ID }];
  await el.updateComplete;
  // Upstream's config groups (issue #205) start collapsed and render nothing
  // while closed, and the add-devices button now lives inside "Home Assistant
  // area". Every test here targets that group, so open it once on mount —
  // otherwise the button is absent and each assertion would fail (or worse,
  // an absence assertion would pass for the wrong reason).
  const groupBtn = [...el.shadowRoot!.querySelectorAll("button.cfg-group-title")].find(
    (b) => b.textContent!.trim() === "Home Assistant area"
  ) as HTMLButtonElement | undefined;
  if (!groupBtn) throw new Error("no 'Home Assistant area' config group in the area panel");
  groupBtn.click();
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

/** The "Add all devices in this HA area" button in the selected area's panel. */
function addButton(el: EditorEl): HTMLButtonElement {
  const icon = el.shadowRoot!.querySelector('ha-icon[icon="mdi:shape-square-plus"]');
  const btn = icon?.closest("button");
  if (!btn) throw new Error("Add-devices button not found in the area panel");
  return btn as HTMLButtonElement;
}

describe("area 'Add all devices' filtering composition", () => {
  it("offers only the placeable entity out of a placeable/disabled/diagnostic/generic-kind mix", async () => {
    const hass = mkHass({
      "light.good": { area_id: HA_AREA_ID },
      "light.disabled": { area_id: HA_AREA_ID, disabled_by: "user" },
      "sensor.diag": { area_id: HA_AREA_ID, entity_category: "diagnostic" },
      // "automation" isn't one of kindFromEntity's recognized domains -> "generic".
      "automation.thing": { area_id: HA_AREA_ID },
    });
    const el = await mount(mkConfig(), hass);
    const btn = addButton(el);

    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe("Add 1 device from this HA area, spread out across the room");
    expect(btn.textContent).toContain("Add all devices in this HA area (1)");

    // Confirm the composition all the way through the click handler too: only
    // the one placeable entity actually lands on the floor as an item.
    btn.click();
    await el.updateComplete;
    const floorItems = el._config.floors![0]!.items;
    expect(floorItems.map((i) => i.entity)).toEqual(["light.good"]);
  });

  it("titles the button 'already placed' when every entity is placed", async () => {
    const hass = mkHass({ "light.good": { area_id: HA_AREA_ID } });
    const el = await mount(mkConfig([placedItem("i1", "light.good")]), hass);
    const btn = addButton(el);

    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe("Every entity in this HA area is already placed on this floor");
  });

  it("titles the button 'filtered out' — not 'already placed' — when unplaced entities exist but none qualify", async () => {
    const hass = mkHass({
      "light.disabled": { area_id: HA_AREA_ID, disabled_by: "user" },
      "sensor.diag": { area_id: HA_AREA_ID, entity_category: "diagnostic" },
      "number.cfg": { area_id: HA_AREA_ID, entity_category: "config" },
      "light.hidden": { area_id: HA_AREA_ID, hidden_by: "user" },
    });
    const el = await mount(mkConfig(), hass);
    const btn = addButton(el);

    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe(
      "Every unplaced entity in this HA area is hidden, disabled, diagnostic/config, or an unrecognized device type"
    );
  });

  it("reports the true remaining count — not the raw registry count — when some entities are placed and some are filtered out", async () => {
    const hass = mkHass({
      "light.good": { area_id: HA_AREA_ID },
      "light.extra": { area_id: HA_AREA_ID },
      "sensor.diag": { area_id: HA_AREA_ID, entity_category: "diagnostic" },
    });
    // "light.good" already placed; "light.extra" is the one true remaining
    // candidate; "sensor.diag" is unplaced but filtered out. Naive raw
    // "unplaced" counting would say 2 (extra + diag); the true count is 1.
    const el = await mount(mkConfig([placedItem("i1", "light.good")]), hass);
    const btn = addButton(el);

    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe("Add 1 device from this HA area, spread out across the room");
    expect(btn.textContent).toContain("Add all devices in this HA area (1)");
  });
});
