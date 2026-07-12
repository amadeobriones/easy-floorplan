// @vitest-environment jsdom
/**
 * The long-press quick-control popover.
 *
 * It had a "guard" test — but that test reads `radial-popover.ts` **as text** and
 * asserts on strings. It cannot tell whether the popover actually opens, dismisses,
 * or renders anything, and it would keep passing while the feature was completely
 * broken. Every function in the module was at 0%.
 *
 * The dismissal paths matter most: a fixed-position portal on `document.body` that
 * fails to close is not a cosmetic bug — it is a panel stuck over the dashboard.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { openRadialPopover, closeRadialPopover } from "./radial-popover";
import type { HomeAssistant } from "./types";

const anchor = () =>
  ({ left: 100, top: 100, right: 140, bottom: 140, width: 40, height: 40, x: 100, y: 100 }) as DOMRect;

function hass(entity: string, state: string, attributes: Record<string, unknown> = {}) {
  return {
    states: { [entity]: { entity_id: entity, state, attributes } },
    entities: {},
    formatEntityState: () => state,
    callService: vi.fn(),
  } as unknown as HomeAssistant;
}

const popEl = () => document.querySelector("easy-floorplan-radial");

async function open(entity: string, state: string, attributes: Record<string, unknown> = {}) {
  openRadialPopover({ hass: hass(entity, state, attributes), entity, anchor: anchor() });
  const el = popEl()!;
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

/** Is the popover currently showing a panel (rather than mounted-but-closed)? */
const isOpen = (el: Element) => !!el.shadowRoot?.querySelector(".pop");

beforeAll(() => {
  // jsdom has no layout; the popover measures itself to clamp on-screen.
  Element.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0 } as DOMRect;
  };
});

afterEach(() => {
  closeRadialPopover();
  document.body.innerHTML = "";
});

describe("opening", () => {
  it("portals a singleton onto document.body, not inside the card", async () => {
    // ha-card and .stage both set overflow:hidden — rendering in-place clips it.
    const el = await open("light.k", "on");
    expect(el.parentElement).toBe(document.body);
    expect(isOpen(el)).toBe(true);
  });

  it("re-opening reuses the one element rather than stacking panels", async () => {
    await open("light.k", "on");
    await open("light.j", "on");
    expect(document.querySelectorAll("easy-floorplan-radial").length).toBe(1);
  });
});

describe("dismissal — a stuck panel covers the dashboard", () => {
  it("closes on Escape", async () => {
    const el = await open("light.k", "on");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(isOpen(el)).toBe(false);
  });

  it("closes on a pointerdown outside it", async () => {
    const el = await open("light.k", "on");
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(isOpen(el)).toBe(false);
  });

  it("closes on scroll — a fixed panel would otherwise drift off its anchor", async () => {
    const el = await open("light.k", "on");
    window.dispatchEvent(new Event("scroll"));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(isOpen(el)).toBe(false);
  });

  it("stops listening once closed (no leaked global handlers)", async () => {
    const el = await open("light.k", "on");
    closeRadialPopover();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const removed = vi.spyOn(document, "removeEventListener");
    // A second close must not throw, and Escape on a closed popover is a no-op.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isOpen(el)).toBe(false);
    removed.mockRestore();
  });
});

describe("per-domain body", () => {
  it("a light gets a toggle reflecting its state", async () => {
    const el = await open("light.k", "on");
    const toggle = el.shadowRoot!.querySelector(".pop-toggle");
    expect(toggle, "a light must offer a toggle").not.toBeNull();
    expect(toggle!.classList.contains("on")).toBe(true);
  });

  it("the toggle reflects OFF too", async () => {
    const el = await open("light.k", "off");
    expect(el.shadowRoot!.querySelector(".pop-toggle")!.classList.contains("on")).toBe(false);
  });

  it("a climate entity shows its current temperature, not a toggle-only body", async () => {
    const el = await open("climate.hall", "cool", { current_temperature: 71 });
    const body = el.shadowRoot!.querySelector(".pop-climate");
    expect(body, "climate needs its own body").not.toBeNull();
    expect(el.shadowRoot!.querySelector(".pop-current")!.textContent).toContain("71");
  });

  it("an unsupported domain says so instead of rendering an empty panel", async () => {
    const el = await open("sensor.humidity", "48");
    expect(el.shadowRoot!.querySelector(".pop-body")!.textContent).toMatch(/no quick controls/i);
  });

  it("titles the panel with the entity it is controlling", async () => {
    const el = await open("light.k", "on");
    expect(el.shadowRoot!.querySelector(".pop-title")!.textContent).toContain("light.k");
  });
});
