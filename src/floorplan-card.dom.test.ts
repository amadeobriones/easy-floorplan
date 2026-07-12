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
