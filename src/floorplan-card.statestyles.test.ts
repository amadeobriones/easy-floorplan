// @vitest-environment jsdom
/**
 * Conditional styles (`stateStyles`) — our answer to upstream #8, and the engine
 * two open upstream issues (#54, #55) are actually asking for.
 *
 * `statestyles.ts` (the rule *editor* helpers) was at 100% and `resolveStateStyle`
 * had unit tests, but nothing checked the card puts the resolved icon and colour on
 * the element. A rule that resolves correctly and never reaches the DOM is a
 * feature that does not exist.
 *
 * The rule that matters most and is easiest to break: **first match wins, rules
 * never merge.** A "helpful" refactor that merged them would still pass every
 * single-rule test.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { FloorplanCardConfig, StateStyle } from "./types";

function mountWith(
  stateStyles: StateStyle[],
  states: Record<string, { state: string; attributes?: Record<string, unknown> }>,
  itemEntity = "light.k"
) {
  return (async () => {
    const { FloorplanCard } = await import("./floorplan-card");
    const el = document.createElement("easy-floorplan-card") as InstanceType<typeof FloorplanCard>;
    const priv = el as unknown as { hass: unknown; updateComplete: Promise<unknown> };
    const entities: Record<string, unknown> = {};
    for (const [id, v] of Object.entries(states)) {
      entities[id] = { entity_id: id, state: v.state, attributes: v.attributes ?? {} };
    }
    priv.hass = {
      states: entities,
      entities: {},
      formatEntityState: (o: { state: string }) => o.state,
      callService: () => {},
    };
    el.setConfig({
      type: "custom:easy-floorplan-card",
      width: 1000,
      height: 600,
      walls: [],
      rooms: [],
      items: [
        { id: "i1", entity: itemEntity, kind: "light", x: 10, y: 10, icon: "mdi:base", stateStyles },
      ],
      furniture: [],
      openings: [],
      texts: [],
      trackers: [],
    } as unknown as FloorplanCardConfig);
    document.body.appendChild(el);
    await priv.updateComplete;
    return el;
  })();
}

const badge = (el: Element) => el.shadowRoot!.querySelector(".badge") as HTMLElement;
const iconOf = (el: Element) =>
  el.shadowRoot!.querySelector(".badge ha-icon")!.getAttribute("icon");

beforeAll(() => {
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a matched rule reaches the DOM", () => {
  it("overrides the icon — a rule is more specific than the item's own icon", async () => {
    const el = await mountWith([{ state: "on", icon: "mdi:matched" }], {
      "light.k": { state: "on" },
    });
    expect(iconOf(el)).toBe("mdi:matched");
  });

  it("paints the badge with the rule's colour", async () => {
    const el = await mountWith([{ state: "on", color: "#ff0000" }], {
      "light.k": { state: "on" },
    });
    const style = badge(el).getAttribute("style") ?? "";
    expect(style).toContain("background:#ff0000");
    expect(style).toContain("border-color:#ff0000");
  });

  it("leaves the item alone when nothing matches", async () => {
    const el = await mountWith([{ state: "on", icon: "mdi:matched", color: "#ff0000" }], {
      "light.k": { state: "off" },
    });
    expect(iconOf(el)).toBe("mdi:base");
    expect(badge(el).getAttribute("style") ?? "").not.toContain("background:#ff0000");
  });
});

describe("first match wins — rules never merge", () => {
  it("takes the first matching rule whole, ignoring later ones", async () => {
    // Both rules match. A merging implementation would take `icon` from the first
    // and `color` from the second, and every single-rule test would still pass.
    const el = await mountWith(
      [
        { state: "on", icon: "mdi:first" },
        { state: "on", icon: "mdi:second", color: "#00ff00" },
      ],
      { "light.k": { state: "on" } }
    );
    expect(iconOf(el)).toBe("mdi:first");
    expect(badge(el).getAttribute("style") ?? "").not.toContain("#00ff00");
  });

  it("falls through a non-matching rule to a later matching one", async () => {
    const el = await mountWith(
      [
        { state: "unavailable", icon: "mdi:never" },
        { state: "on", icon: "mdi:reached" },
      ],
      { "light.k": { state: "on" } }
    );
    expect(iconOf(el)).toBe("mdi:reached");
  });
});

describe("numeric thresholds", () => {
  it("above fires only over the threshold", async () => {
    const hot = await mountWith([{ above: 25, icon: "mdi:hot" }], {
      "sensor.t": { state: "30" },
    }, "sensor.t");
    expect(iconOf(hot)).toBe("mdi:hot");

    const cold = await mountWith([{ above: 25, icon: "mdi:hot" }], {
      "sensor.t": { state: "20" },
    }, "sensor.t");
    expect(iconOf(cold)).toBe("mdi:base");
  });

  it("a non-numeric state satisfies neither above nor below", async () => {
    // `unavailable` must not read as 0 and silently trip a `below` rule.
    const el = await mountWith([{ below: 25, icon: "mdi:low" }], {
      "sensor.t": { state: "unavailable" },
    }, "sensor.t");
    expect(iconOf(el)).toBe("mdi:base");
  });
});

describe("state_not", () => {
  it("matches every state except the named one", async () => {
    const el = await mountWith([{ state_not: "off", icon: "mdi:alive" }], {
      "light.k": { state: "on" },
    });
    expect(iconOf(el)).toBe("mdi:alive");
  });

  it("does not match the named state", async () => {
    const el = await mountWith([{ state_not: "off", icon: "mdi:alive" }], {
      "light.k": { state: "off" },
    });
    expect(iconOf(el)).toBe("mdi:base");
  });
});

describe("a rule can watch a different entity than the item it styles", () => {
  it("styles the item from another entity's state", async () => {
    // Colour the front door badge by the alarm's state, not the door's.
    const el = await mountWith([{ entity: "alarm.house", state: "triggered", icon: "mdi:alert" }], {
      "light.k": { state: "off" },
      "alarm.house": { state: "triggered" },
    });
    expect(iconOf(el)).toBe("mdi:alert");
  });
});

describe('color: "rgb" takes the light\'s own colour', () => {
  it("reads rgb_color off the entity", async () => {
    const el = await mountWith([{ state: "on", color: "rgb" }], {
      "light.k": { state: "on", attributes: { rgb_color: [255, 128, 0] } },
    });
    expect(badge(el).getAttribute("style") ?? "").toContain("rgb(255, 128, 0)");
  });
});

describe("hidden: renders nothing while the rule matches", () => {
  const itemDiv = (el: Element) => el.shadowRoot!.querySelector(".items .item");

  it("draws no element at all when the matched rule is hidden", async () => {
    // The only-when-active idiom: hide unless the entity is on.
    const el = await mountWith(
      [
        { state: "on" },
        { hidden: true },
      ],
      { "light.k": { state: "off" } }
    );
    expect(itemDiv(el)).toBeNull();
  });

  it("draws the item normally when a non-hidden rule matches first", async () => {
    const el = await mountWith(
      [
        { state: "on", icon: "mdi:awake" },
        { hidden: true },
      ],
      { "light.k": { state: "on" } }
    );
    expect(itemDiv(el)).not.toBeNull();
    expect(iconOf(el)).toBe("mdi:awake");
  });
});
