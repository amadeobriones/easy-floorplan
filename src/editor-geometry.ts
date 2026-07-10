import type { Floor, Wall } from "./types";

/** Element kinds addressable by the editor's selection model. */
export type SelKind = "wall" | "opening" | "item" | "text" | "furniture" | "tracker" | "room";

export interface Sel {
  kind: SelKind;
  id: string;
}

/** Snapshot of an element's position at drag start, for group translation. */
export type OrigPos =
  | { kind: "wall"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "pt"; x: number; y: number };

/** A rectangle described by two opposite corners (any orientation). */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type WallSegment = Pick<Wall, "x1" | "y1" | "x2" | "y2">;

/** Snap distance (virtual units) for wall endpoints onto each other. */
export const ENDPOINT_SNAP = 26;

/** Nearest existing wall endpoint within `maxDist`, or null. */
export function nearestCorner(
  walls: readonly WallSegment[],
  rawX: number,
  rawY: number,
  maxDist: number
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = maxDist;
  for (const w of walls) {
    for (const e of [
      { x: w.x1, y: w.y1 },
      { x: w.x2, y: w.y2 },
    ]) {
      const d = Math.hypot(rawX - e.x, rawY - e.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: e.x, y: e.y };
      }
    }
  }
  return best;
}

/**
 * Snap a wall's moving endpoint while drawing. Existing corners win (so rooms
 * close/continue); otherwise, unless free-draw is on, apply "gravity" toward
 * horizontal/vertical relative to the start point. The position itself snaps
 * via `snap` (the grid by default, or nothing when Snap is Off) — "straighten"
 * only governs the H/V alignment, not snapping.
 */
export function snapWallEnd(
  walls: readonly WallSegment[],
  x1: number,
  y1: number,
  rawX: number,
  rawY: number,
  snap: (v: number) => number,
  free: boolean,
  axisSnapDeg: number,
  cornerSnap = ENDPOINT_SNAP
): { x: number; y: number } {
  if (free) return { x: snap(rawX), y: snap(rawY) };
  const corner = nearestCorner(walls, rawX, rawY, cornerSnap);
  if (corner) return corner;
  const dx = rawX - x1;
  const dy = rawY - y1;
  const t = Math.tan((axisSnapDeg * Math.PI) / 180);
  // Sticky: align flat to an axis when close; the free coordinate snaps to step.
  if (Math.abs(dy) <= Math.abs(dx) * t) return { x: snap(rawX), y: y1 }; // horizontal
  if (Math.abs(dx) <= Math.abs(dy) * t) return { x: x1, y: snap(rawY) }; // vertical
  return { x: snap(rawX), y: snap(rawY) };
}

/** All floor elements whose reference point lies inside the (any-orientation) rect. */
export function elementsInRect(f: Floor, m: Rect): Sel[] {
  const minX = Math.min(m.x0, m.x1);
  const maxX = Math.max(m.x0, m.x1);
  const minY = Math.min(m.y0, m.y1);
  const maxY = Math.max(m.y0, m.y1);
  const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  const out: Sel[] = [];
  for (const w of f.walls)
    if (inside((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2)) out.push({ kind: "wall", id: w.id });
  for (const o of f.openings) if (inside(o.x, o.y)) out.push({ kind: "opening", id: o.id });
  for (const it of f.items) if (inside(it.x, it.y)) out.push({ kind: "item", id: it.id });
  for (const t of f.texts) if (inside(t.x, t.y)) out.push({ kind: "text", id: t.id });
  for (const fu of f.furniture) if (inside(fu.x, fu.y)) out.push({ kind: "furniture", id: fu.id });
  for (const tr of f.trackers ?? [])
    if (inside(tr.x + tr.w / 2, tr.y + tr.h / 2)) out.push({ kind: "tracker", id: tr.id });
  return out;
}

/** Translate every snapshotted element by (dx, dy). */
export function applyDelta(f: Floor, dx: number, dy: number, orig: Map<string, OrigPos>): Partial<Floor> {
  return {
    walls: f.walls.map((w) => {
      const o = orig.get(`wall:${w.id}`);
      return o && o.kind === "wall"
        ? { ...w, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
        : w;
    }),
    openings: f.openings.map((el) => {
      const o = orig.get(`opening:${el.id}`);
      return o && o.kind === "pt" ? { ...el, x: o.x + dx, y: o.y + dy } : el;
    }),
    items: f.items.map((el) => {
      const o = orig.get(`item:${el.id}`);
      return o && o.kind === "pt" ? { ...el, x: o.x + dx, y: o.y + dy } : el;
    }),
    texts: f.texts.map((el) => {
      const o = orig.get(`text:${el.id}`);
      return o && o.kind === "pt" ? { ...el, x: o.x + dx, y: o.y + dy } : el;
    }),
    furniture: f.furniture.map((el) => {
      const o = orig.get(`furniture:${el.id}`);
      return o && o.kind === "pt" ? { ...el, x: o.x + dx, y: o.y + dy } : el;
    }),
    trackers: (f.trackers ?? []).map((el) => {
      const o = orig.get(`tracker:${el.id}`);
      return o && o.kind === "pt" ? { ...el, x: o.x + dx, y: o.y + dy } : el;
    }),
  };
}
