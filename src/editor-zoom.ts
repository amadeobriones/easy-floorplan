/** Zoom arithmetic for the editor's scrolling canvas viewport. */

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

/** Clamp to the supported range, rounded to whole percent so the readout is stable. */
export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
}

export interface Scroll {
  left: number;
  top: number;
}

/**
 * Where to scroll so that the point under the cursor stays under the cursor.
 *
 * Without this, zooming pulls the drawing toward the top-left corner: the stage
 * grows from its origin while the scroll offset stays put, so whatever you were
 * looking at slides away and you have to chase it. Every map does it this way.
 *
 * @param cursor cursor position *within the viewport*, not the page
 */
export function zoomAnchoredScroll(
  prevZoom: number,
  nextZoom: number,
  scroll: Scroll,
  cursor: { x: number; y: number },
): Scroll {
  const k = nextZoom / prevZoom;
  return {
    left: Math.max(0, (scroll.left + cursor.x) * k - cursor.x),
    top: Math.max(0, (scroll.top + cursor.y) * k - cursor.y),
  };
}
