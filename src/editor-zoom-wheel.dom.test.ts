// @vitest-environment jsdom
/**
 * Integration test for Ctrl/Cmd+wheel zoom anchoring in the editor's canvas
 * wheel handler (`_onCanvasWheel` in editor.ts).
 *
 * `zoomAnchoredScroll` itself is a pure function and is fully covered in
 * editor-zoom.test.ts. What that test cannot see is the wiring bug this file
 * exists to catch: the handler must capture the *pre-zoom* scroll offset
 * synchronously, before calling `_setZoom`. Reading `wrap.scrollLeft`/`Top`
 * only after the deferred re-render is wrong on zoom-**out**, because a real
 * browser clamps scrollLeft/Top down the moment the (now smaller) stage
 * shrinks past the old scroll offset — so a post-render read sees the
 * clamped value, not the value the anchor math needs. jsdom does no layout
 * and so never clamps scrollLeft/Top on its own; this test simulates that
 * clamp by hand between dispatching the wheel event and awaiting the
 * deferred callback, exactly where a real browser's layout pass would land.
 */
import { describe, it, expect, afterEach } from "vitest";
import "./editor";
import { zoomAnchoredScroll } from "./editor-zoom";
import type { FloorplanCardConfig } from "./types";

type EditorEl = HTMLElement & {
  setConfig(c: FloorplanCardConfig): void;
  updateComplete: Promise<unknown>;
  _zoom: number;
};

function mkConfig(): FloorplanCardConfig {
  return {
    type: "custom:easy-floorplan-card",
    width: 400,
    height: 300,
    grid: 5,
    walls: [],
    openings: [],
    items: [],
    texts: [],
    furniture: [],
    trackers: [],
    areas: [],
  };
}

async function mount(): Promise<{ el: EditorEl; wrap: HTMLElement }> {
  const el = document.createElement("easy-floorplan-card-editor") as unknown as EditorEl;
  document.body.appendChild(el);
  el.setConfig(mkConfig());
  await el.updateComplete;
  const wrap = el.shadowRoot!.querySelector(".canvas-wrap") as HTMLElement;
  // jsdom has no layout: stub a fixed viewport rect so cursor coordinates
  // are predictable (offsets from the rect's top-left).
  wrap.getBoundingClientRect = () =>
    ({ left: 10, top: 20, right: 410, bottom: 320, width: 400, height: 300, x: 10, y: 20 }) as DOMRect;
  return { el, wrap };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Ctrl+wheel zoom-out anchoring", () => {
  it("anchors to the pre-zoom scroll offset, not a browser-clamped post-render one", async () => {
    const { el, wrap } = await mount();
    expect(el._zoom).toBe(1);

    // Scrolled well into the canvas before the zoom-out.
    wrap.scrollLeft = 500;
    wrap.scrollTop = 300;
    const prevZoom = el._zoom;
    const cursor = { x: 120, y: 80 }; // clientX/Y - rect.left/top
    const preZoomScroll = { left: wrap.scrollLeft, top: wrap.scrollTop };

    const ev = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: 100, // positive deltaY -> zoom out
      clientX: 10 + cursor.x,
      clientY: 20 + cursor.y,
      bubbles: true,
      cancelable: true,
    });
    wrap.dispatchEvent(ev);

    // Simulate the browser's own layout pass clamping scrollLeft/Top down
    // now that the stage has shrunk — this happens synchronously as part of
    // a real browser's reflow, before any deferred JS callback runs. The
    // clamped values are deliberately smaller than the true pre-zoom offset
    // captured above, so a handler that re-reads scroll after the render
    // would compute a different (wrong) target.
    wrap.scrollLeft = 40;
    wrap.scrollTop = 15;

    await el.updateComplete;

    expect(el._zoom).toBeLessThan(prevZoom); // sanity: this was actually a zoom-out

    const expected = zoomAnchoredScroll(prevZoom, el._zoom, preZoomScroll, cursor);
    expect(wrap.scrollLeft).toBe(expected.left);
    expect(wrap.scrollTop).toBe(expected.top);
  });
});
