// @vitest-environment jsdom
/**
 * The card's render path — what a user actually sees on the dashboard.
 *
 * `render.ts` is at ~100% and `floorplan-card.ts` was at 11%: every predicate was
 * unit-tested, and nothing checked that the card *wires them to the DOM*. That gap
 * is where our most important divergence from upstream lives.
 *
 * Upstream keeps an ACTIVE_STATES allowlist (lock, vacuum, camera) and falls back to
 * `on|open|home|playing` for everything else. A climate entity's state IS its hvac
 * mode — `cool`, `heat`, `fan_only` — so upstream renders a running thermostat as
 * OFF, permanently. We invert the table (INACTIVE_STATES). These tests pin that on
 * the rendered element, so nobody can "simplify" it back toward upstream and watch
 * the unit tests stay green.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { FloorplanCardConfig } from "./types";

type Item = Record<string, unknown>;

function config(items: Item[]): FloorplanCardConfig {
  return {
    type: "custom:easy-floorplan-card",
    width: 1000,
    height: 600,
    walls: [],
    rooms: [],
    items,
    furniture: [],
    openings: [],
    texts: [],
    trackers: [],
  } as unknown as FloorplanCardConfig;
}

function hassWith(states: Record<string, string>) {
  const entities: Record<string, { state: string; attributes: Record<string, unknown> }> = {};
  for (const [id, state] of Object.entries(states)) {
    entities[id] = { state, attributes: { friendly_name: id } };
  }
  return {
    states: entities,
    entities: {},
    formatEntityState: (o: { state: string }) => o.state,
    callService: () => {},
  };
}

async function mountCard(items: Item[], states: Record<string, string>) {
  const { FloorplanCard } = await import("./floorplan-card");
  const el = document.createElement("easy-floorplan-card") as InstanceType<typeof FloorplanCard>;
  const priv = el as unknown as { hass: unknown; updateComplete: Promise<unknown> };
  priv.hass = hassWith(states);
  el.setConfig(config(items));
  document.body.appendChild(el);
  await priv.updateComplete;
  return el;
}

/** The rendered `.item` div for an id — the thing the user's eye lands on. */
function itemEl(el: Element, id: string): HTMLElement | null {
  const all = el.shadowRoot!.querySelectorAll<HTMLElement>(".items .item");
  return all[Number(id.replace("i", "")) - 1] ?? null;
}

beforeAll(() => {
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("active state reaches the DOM, per domain", () => {
  // Each case is a domain whose "on" is NOT the string `on`. Upstream renders every
  // one of these as off. The table is the point; the assertion is that it renders.
  const cases: Array<[string, string, string, boolean, string]> = [
    ["climate", "climate.hall", "cool", true, "a thermostat cooling is running"],
    ["climate", "climate.hall", "heat", true, "so is one heating"],
    ["climate", "climate.hall", "fan_only", true, "fan_only is still not off"],
    ["climate", "climate.hall", "off", false, "off is off"],
    ["water_heater", "water_heater.tank", "eco", true, "eco is a running mode"],
    ["lock", "lock.front", "unlocked", true, "an unlocked lock is active"],
    ["lock", "lock.front", "jammed", true, "a jammed lock is NOT closed"],
    ["lock", "lock.front", "locked", false, "locked is inactive"],
    ["media_player", "media_player.tv", "paused", true, "HA treats paused as on"],
    ["media_player", "media_player.tv", "off", false, "off is off"],
    ["vacuum", "vacuum.roomba", "cleaning", true, "cleaning is active"],
    ["vacuum", "vacuum.roomba", "docked", false, "docked is not"],
    ["light", "light.k", "on", true, "the generic path still works"],
    ["light", "light.k", "off", false, "and still says off"],
  ];

  for (const [domain, entity, state, active, why] of cases) {
    it(`${domain} "${state}" renders ${active ? "on" : "off"} — ${why}`, async () => {
      const el = await mountCard([{ id: "i1", entity, kind: "sensor", x: 10, y: 10 }], {
        [entity]: state,
      });
      const item = itemEl(el, "i1");
      expect(item, "the item must render at all").not.toBeNull();
      expect(item!.className).toContain(active ? "on" : "off");
      // Guard against the class string containing both (`"on off"` would pass a
      // naive contains() for either).
      expect(item!.classList.contains("on")).toBe(active);
      expect(item!.classList.contains("off")).toBe(!active);
    });
  }

  it("an unavailable entity is never active, whatever the domain", async () => {
    const el = await mountCard([{ id: "i1", entity: "lock.front", kind: "sensor", x: 10, y: 10 }], {
      "lock.front": "unavailable",
    });
    // A stale "unlocked" during a dropout is worse than showing locked.
    expect(itemEl(el, "i1")!.classList.contains("off")).toBe(true);
  });
});

describe("items without an entity", () => {
  it("render as a static marker rather than vanishing", async () => {
    // The card used to filter these out, so unbound hardware disappeared at runtime
    // while still showing in the editor (upstream #39).
    const el = await mountCard([{ id: "i1", kind: "smoke", x: 10, y: 10 }], {});
    const item = itemEl(el, "i1");
    expect(item, "an entity-less item must still be drawn").not.toBeNull();
    expect(item!.classList.contains("on")).toBe(false);
  });
});

describe("showIcon: false", () => {
  it("renders the label without an icon badge", async () => {
    const el = await mountCard(
      [{ id: "i1", entity: "light.k", kind: "light", x: 10, y: 10, showIcon: false, showState: true }],
      { "light.k": "on" }
    );
    const item = itemEl(el, "i1");
    expect(item!.classList.contains("label-only")).toBe(true);
    expect(item!.querySelector(".stack-icon"), "no icon badge when showIcon is false").toBeNull();
  });
});

describe("setConfig refuses configs that would crash or silently break the card", () => {
  async function setConfigOf(cfg: unknown) {
    const { FloorplanCard } = await import("./floorplan-card");
    const el = document.createElement("easy-floorplan-card") as InstanceType<typeof FloorplanCard>;
    return () => (el as unknown as { setConfig: (c: unknown) => void }).setConfig(cfg);
  }
  const base = () => config([{ id: "i1", entity: "light.k", kind: "light", x: 10, y: 10 }]);

  it("rejects a null array entry (a stray '-' in the YAML list) instead of crashing in render", async () => {
    // Before: `items:[null]` threw "Cannot read properties of null" deep in render.
    for (const key of ["items", "walls", "openings", "texts", "furniture", "trackers"]) {
      const run = await setConfigOf({ ...base(), [key]: [null] });
      expect(run, key).toThrow(/must be an object/);
    }
  });

  it("rejects a null entry inside the floors model (the canonical model)", async () => {
    // The crash class the guard exists for, previously left live for `floors[]`.
    for (const key of ["walls", "rooms", "openings", "furniture", "items"]) {
      const run = await setConfigOf({
        type: "custom:easy-floorplan-card",
        floors: [{ id: "f1", [key]: [null] }],
      });
      expect(run, key).toThrow(new RegExp(`floors\\[0\\]\\.${key}\\[0\\]`));
    }
  });

  it("rejects a non-array floor list and a null floor", async () => {
    expect(await setConfigOf({ type: "x", floors: [{ id: "f1", walls: "nope" }] })).toThrow(
      /floors\[0\]\.walls" must be a list/
    );
    expect(await setConfigOf({ type: "x", floors: [null] })).toThrow(/floors\[0\]" must be an object/);
  });

  it("still accepts a valid floors config", async () => {
    const ok = await setConfigOf({
      type: "custom:easy-floorplan-card",
      floors: [{ id: "f1", walls: [{ id: "w", x1: 0, y1: 0, x2: 10, y2: 0 }] }],
    });
    expect(ok).not.toThrow();
  });

  it("rejects duplicate floor ids (the second would be unreachable)", async () => {
    const run = await setConfigOf({
      type: "custom:easy-floorplan-card",
      floors: [{ id: "dup" }, { id: "dup" }],
    });
    expect(run).toThrow(/duplicate floor id "dup"/);
  });

  it("rejects top-level geometry alongside a populated floors[] (it would be silently dropped)", async () => {
    const run = await setConfigOf({
      type: "custom:easy-floorplan-card",
      walls: [{ id: "w", x1: 0, y1: 0, x2: 10, y2: 0 }],
      floors: [{ id: "f1" }],
    });
    expect(run).toThrow(/ignored when "floors" is set/);
  });

  it("names the offending index", async () => {
    const run = await setConfigOf({ ...base(), items: [{ id: "ok", kind: "light", x: 0, y: 0 }, null] });
    expect(run).toThrow(/items\[1\]/);
  });

  it.each([0, -1000, NaN, Infinity])("rejects width %s (would render Infinity%%/NaN%% positions)", async (w) => {
    const run = await setConfigOf({ ...base(), width: w });
    expect(run).toThrow(/must be a positive number/);
  });

  it.each([0, -600, NaN])("rejects height %s", async (h) => {
    const run = await setConfigOf({ ...base(), height: h });
    expect(run).toThrow(/must be a positive number/);
  });

  it("still accepts a valid config and an unset (null) list", async () => {
    const ok = await setConfigOf({ ...base(), trackers: null });
    expect(ok).not.toThrow();
  });
});

describe("a hostile colour cannot break out of the style attribute (CSS injection)", () => {
  const OVERLAY = "red;position:fixed;inset:0;z-index:99999";
  const BEACON = "red;background-image:url(https://evil.example/x.png)";

  it("a stateStyles colour is dropped, not injected into the badge", async () => {
    const el = await mountCard(
      [{ id: "i1", entity: "light.k", kind: "light", x: 10, y: 10, stateStyles: [{ state: "on", color: OVERLAY }] }],
      { "light.k": "on" }
    );
    const badge = el.shadowRoot!.querySelector(".badge") as HTMLElement;
    // The declaration never lands: no position/z-index leaked onto the element.
    expect(badge.style.position).toBe("");
    expect(badge.getAttribute("style") ?? "").not.toContain("position:fixed");
  });

  it("a text colour beacon never becomes a background-image fetch", async () => {
    const { FloorplanCard } = await import("./floorplan-card");
    const el = document.createElement("easy-floorplan-card") as InstanceType<typeof FloorplanCard>;
    const priv = el as unknown as { hass: unknown; updateComplete: Promise<unknown> };
    priv.hass = hassWith({});
    el.setConfig({
      ...config([]),
      texts: [{ id: "t1", text: "hi", x: 10, y: 10, color: BEACON }],
    } as unknown as FloorplanCardConfig);
    document.body.appendChild(el);
    await priv.updateComplete;
    const html = el.shadowRoot!.innerHTML;
    expect(html).not.toContain("background-image");
    expect(html).not.toContain("evil.example");
  });

  it("the card background cannot become a full-viewport overlay", async () => {
    const { FloorplanCard } = await import("./floorplan-card");
    const el = document.createElement("easy-floorplan-card") as InstanceType<typeof FloorplanCard>;
    const priv = el as unknown as { hass: unknown; updateComplete: Promise<unknown> };
    priv.hass = hassWith({});
    el.setConfig({ ...config([]), background: OVERLAY } as unknown as FloorplanCardConfig);
    document.body.appendChild(el);
    await priv.updateComplete;
    const stage = el.shadowRoot!.querySelector(".stage") as HTMLElement;
    expect(stage.style.position).toBe("");
    expect(stage.getAttribute("style") ?? "").not.toContain("z-index");
  });

  it("still lets a legitimate colour through", async () => {
    const el = await mountCard(
      [{ id: "i1", entity: "light.k", kind: "light", x: 10, y: 10, stateStyles: [{ state: "on", color: "#ff0000" }] }],
      { "light.k": "on" }
    );
    const badge = el.shadowRoot!.querySelector(".badge") as HTMLElement;
    expect(badge.getAttribute("style") ?? "").toContain("#ff0000");
  });
});
