// @vitest-environment jsdom
/**
 * #38 pinch-zoom, the multi-finger edge.
 *
 * The pinch baseline (`d0`, `z0`) was only established when the finger count hit
 * exactly 2. A third finger landing left it stale, and lifting one of three kept
 * the pinch alive on a different pair whose separation was unrelated to `d0` — so
 * the zoom snapped. A resting thumb on a tablet is enough to trigger it.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { FloorplanCardConfig } from "./types";

async function mountEditor() {
  const { FloorplanCardEditor } = await import("./editor");
  const el = document.createElement("easy-floorplan-card-editor") as InstanceType<
    typeof FloorplanCardEditor
  >;
  const p = el as unknown as Record<string, unknown> & { updateComplete: Promise<unknown> };
  p.hass = { states: {}, entities: {}, formatEntityState: () => "" };
  el.setConfig({
    type: "custom:easy-floorplan-card",
    width: 1000,
    height: 600,
    floors: [{ id: "f1", walls: [] }],
  } as unknown as FloorplanCardConfig);
  document.body.appendChild(el);
  await p.updateComplete;
  return el;
}

const touch = (pointerId: number, clientX: number, clientY: number) =>
  ({ pointerType: "touch", pointerId, clientX, clientY, preventDefault() {}, stopPropagation() {} }) as unknown as PointerEvent;

const zoomOf = (el: Element) => (el as unknown as { _zoom: number })._zoom;

beforeAll(() => {
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});
afterEach(() => (document.body.innerHTML = ""));

describe("pinch survives a third finger without a zoom jump", () => {
  it("lifting one of three fingers does not snap the zoom", async () => {
    const el = await mountEditor();
    const p = el as unknown as Record<string, (ev: PointerEvent) => void> & { _zoom: number };
    p._zoom = 1;

    // Three fingers: the tracked pair is f1(0,0) & f2(100,0), separation 100.
    p._onWrapPointerDown(touch(1, 0, 0));
    p._onWrapPointerDown(touch(2, 100, 0));
    p._onWrapPointerDown(touch(3, 50, 50)); // resting thumb

    expect(zoomOf(el)).toBe(1);

    // Lift f1. The remaining pair is f2(100,0) & f3(50,50), separation ~70.7 —
    // unrelated to the original d0 of 100.
    p._onWrapPointerEnd(touch(1, 0, 0));

    // A move with the two remaining fingers held still must NOT change the zoom.
    // Pre-fix, the stale d0=100 vs the new pair's 70.7 snapped it to ~0.707.
    p._onWrapPointerMove(touch(2, 100, 0));
    p._onWrapPointerMove(touch(3, 50, 50));

    expect(zoomOf(el)).toBeCloseTo(1, 5);
  });

  it("a normal two-finger pinch still zooms proportionally", async () => {
    const el = await mountEditor();
    const p = el as unknown as Record<string, (ev: PointerEvent) => void> & { _zoom: number };
    p._zoom = 1;
    p._onWrapPointerDown(touch(1, 0, 0));
    p._onWrapPointerDown(touch(2, 100, 0)); // d0 = 100
    // Spread to 200 → 2× zoom.
    p._onWrapPointerMove(touch(1, 0, 0));
    p._onWrapPointerMove(touch(2, 200, 0));
    expect(zoomOf(el)).toBeCloseTo(2, 5);
  });
});
