// @vitest-environment jsdom
/**
 * The tap / hold / double-tap gesture engine.
 *
 * This module came from upstream and sat at 0% coverage, which is a strange place
 * for it: every interactive thing we ship rides it — item taps, room tap-scenes,
 * and the radial controls' long-press. A regression here is silent (a gesture
 * simply stops firing) and only ever surfaces on a real dashboard, under a finger.
 *
 * Timing is faked, so these assert the *state machine*, not the clock.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { actionHandlerBind, type ActionHandlerDetail } from "./action-handler";

const HOLD_TIME = 500;
const DOUBLE_TAP_TIME = 250;

/** Bind a fresh element and record every `action` event it fires. */
function bound(options: Record<string, boolean> = {}) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const fired: string[] = [];
  el.addEventListener("action", (e) =>
    fired.push((e as CustomEvent<ActionHandlerDetail>).detail.action)
  );
  actionHandlerBind(el, options);
  return { el, fired };
}

const down = (el: Element) => el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
const click = (el: Element, detail = 1) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("tap", () => {
  it("a press and release fires exactly one tap", () => {
    const { el, fired } = bound();
    down(el);
    click(el);
    expect(fired).toEqual(["tap"]);
  });
});

describe("hold", () => {
  it("holding past the threshold fires hold, not tap", () => {
    const { el, fired } = bound({ hasHold: true });
    down(el);
    vi.advanceTimersByTime(HOLD_TIME + 1);
    click(el);
    expect(fired).toEqual(["hold"]);
  });

  it("releasing before the threshold is still a tap", () => {
    const { el, fired } = bound({ hasHold: true });
    down(el);
    vi.advanceTimersByTime(HOLD_TIME - 50);
    click(el);
    expect(fired).toEqual(["tap"]);
  });

  it("a scroll during the press cancels the hold timer", () => {
    // Dragging the dashboard past a button must not arm a hold.
    const { el, fired } = bound({ hasHold: true });
    down(el);
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(HOLD_TIME + 1);
    click(el);
    // The hold never armed, so the release reads as a tap.
    expect(fired).toEqual(["tap"]);
  });
});

describe("double tap", () => {
  it("a lone tap waits out the double-tap window, then fires tap", () => {
    const { el, fired } = bound({ hasDoubleClick: true });
    down(el);
    click(el, 1);
    // Deliberately deferred: the card cannot know yet whether a second tap is coming.
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(DOUBLE_TAP_TIME + 1);
    expect(fired).toEqual(["tap"]);
  });

  it("a second click inside the window fires double_tap and suppresses the tap", () => {
    const { el, fired } = bound({ hasDoubleClick: true });
    down(el);
    click(el, 1);
    vi.advanceTimersByTime(DOUBLE_TAP_TIME - 50);
    down(el);
    click(el, 2);
    expect(fired).toEqual(["double_tap"]);
    // And the pending single tap must never arrive late.
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual(["double_tap"]);
  });
});

describe("keyboard", () => {
  it.each(["Enter", " "])("%s activates the element", (key) => {
    const { el, fired } = bound();
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(fired).toEqual(["tap"]);
  });

  it("Space is prevented so it cannot scroll the dashboard instead", () => {
    const { el } = bound();
    const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("an unrelated key does nothing", () => {
    const { el, fired } = bound();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(fired).toEqual([]);
  });
});

describe("disabled", () => {
  it("fires nothing at all", () => {
    const { el, fired } = bound({ disabled: true });
    down(el);
    click(el);
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });
});

describe("rebinding", () => {
  it("re-binding the same options does not double-fire", () => {
    // Lit re-runs the directive on every render; a leaked listener would turn one
    // tap into two service calls — the kind of bug that toggles a light back off.
    const el = document.createElement("div");
    document.body.appendChild(el);
    const fired: string[] = [];
    el.addEventListener("action", (e) =>
      fired.push((e as CustomEvent<ActionHandlerDetail>).detail.action)
    );
    for (let i = 0; i < 5; i++) actionHandlerBind(el, { hasHold: true });
    down(el);
    click(el);
    expect(fired).toEqual(["tap"]);
  });

  it("re-binding with new options replaces the old behaviour", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const fired: string[] = [];
    el.addEventListener("action", (e) =>
      fired.push((e as CustomEvent<ActionHandlerDetail>).detail.action)
    );
    actionHandlerBind(el, { hasHold: true });
    actionHandlerBind(el, { disabled: true });
    down(el);
    click(el);
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });
});
