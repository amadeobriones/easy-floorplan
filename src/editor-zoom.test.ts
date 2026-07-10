import { describe, it, expect } from "vitest";
import { clampZoom, zoomAnchoredScroll, MIN_ZOOM, MAX_ZOOM } from "./editor-zoom";

describe("clampZoom", () => {
  it("stays inside the supported range", () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("rounds to whole percent so the readout does not jitter", () => {
    expect(clampZoom(1.23456)).toBe(1.23);
    expect(clampZoom(0.90000001)).toBe(0.9);
  });
});

describe("zoomAnchoredScroll", () => {
  const scroll = { left: 100, top: 50 };

  // The content point under the cursor is (scroll + cursor). After scaling by k it
  // sits at k*(scroll + cursor), so the viewport must start k*(scroll+cursor) - cursor
  // for that same point to remain under the cursor.
  it("keeps the point under the cursor under the cursor", () => {
    const cursor = { x: 40, y: 30 };
    expect(zoomAnchoredScroll(1, 2, scroll, cursor)).toEqual({
      left: 2 * (100 + 40) - 40,
      top: 2 * (50 + 30) - 30,
    });
  });

  it("is the identity when the zoom does not change", () => {
    expect(zoomAnchoredScroll(1.5, 1.5, scroll, { x: 10, y: 10 })).toEqual(scroll);
  });

  it("zooming out undoes zooming in", () => {
    const cursor = { x: 40, y: 30 };
    const zoomedIn = zoomAnchoredScroll(1, 2, scroll, cursor);
    expect(zoomAnchoredScroll(2, 1, zoomedIn, cursor)).toEqual(scroll);
  });

  it("never scrolls to a negative offset", () => {
    expect(zoomAnchoredScroll(2, 0.5, { left: 0, top: 0 }, { x: 100, y: 80 })).toEqual({
      left: 0,
      top: 0,
    });
  });

  it("anchoring on the origin is plain scaling", () => {
    expect(zoomAnchoredScroll(1, 3, scroll, { x: 0, y: 0 })).toEqual({ left: 300, top: 150 });
  });
});
