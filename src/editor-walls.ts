/**
 * Welded wall corners: drag a corner, and every wall that meets there comes too.
 *
 * `Wall` is an independent segment. Two walls that meet at a corner do so only by
 * both happening to end at the same coordinate — nothing records that they are
 * joined. So moving one wall's endpoint tore the corner open and left a gap, and
 * moving a wall detached it from its neighbours entirely.
 *
 * A *vertex* is the set of wall ends that share a point. Move a vertex and every
 * end in it moves; move a wall and the vertices at both of its ends move, which
 * stretches whatever else was attached to them.
 *
 * Every function takes the walls **as they were when the drag began** and the
 * drag's total displacement, never the current walls and a per-frame delta. A
 * drag is a function of where the pointer started and where it is now; accumulate
 * deltas instead and the corner drifts, and a vertex lookup against already-moved
 * walls finds nothing.
 */
import type { Wall } from "./types";

/**
 * How close two endpoints must be to count as one corner, in canvas units.
 *
 * Small on purpose. The wall tool already snaps a new endpoint onto an existing
 * corner (see `snapWallEnd`), so walls that meet are usually exactly coincident.
 * A generous epsilon would silently weld two corners the user can see are apart,
 * and there is no way to unweld something you never knew was welded.
 */
export const WELD_EPS = 1;

export interface WallEnd {
  id: string;
  end: 1 | 2;
}

export interface Vertex {
  x: number;
  y: number;
  ends: WallEnd[];
}

export interface Point {
  x: number;
  y: number;
}

function endPoint(w: Wall, end: 1 | 2): Point {
  return end === 1 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
}

function near(a: Point, b: Point, eps: number): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

/**
 * Group every wall end that shares a point. Walls are few, so this is the plain
 * quadratic sweep rather than a spatial index.
 *
 * A vertex sits where its *first* end sat, not at the average of its ends:
 * averaging would nudge a corner every time another wall joined it.
 */
export function weldVertices(walls: readonly Wall[], eps: number = WELD_EPS): Vertex[] {
  const vertices: Vertex[] = [];
  for (const w of walls) {
    for (const end of [1, 2] as const) {
      const p = endPoint(w, end);
      const hit = vertices.find((v) => near(v, p, eps));
      if (hit) hit.ends.push({ id: w.id, end });
      else vertices.push({ x: p.x, y: p.y, ends: [{ id: w.id, end }] });
    }
  }
  return vertices;
}

/** The vertex a point lands on, or null. */
export function vertexAt(vertices: Vertex[], p: Point, eps: number = WELD_EPS): Vertex | null {
  return vertices.find((v) => near(v, p, eps)) ?? null;
}

/** Move every wall end in `ends` to `to`. Whatever is attached there stretches. */
export function moveEnds(walls: readonly Wall[], ends: readonly WallEnd[], to: Point): Wall[] {
  return walls.map((w) => {
    let out = w;
    for (const e of ends) {
      if (e.id !== w.id) continue;
      out = e.end === 1 ? { ...out, x1: to.x, y1: to.y } : { ...out, x2: to.x, y2: to.y };
    }
    return out;
  });
}

/**
 * Drag the corner at `from` to `to`, taking every wall that meets there.
 *
 * `original` is the wall list as it was when the drag started. Returns it
 * unchanged when no corner is at `from`, so a stray drag cannot silently move a
 * wall it never touched.
 */
export function dragVertex(
  original: readonly Wall[],
  from: Point,
  to: Point,
  eps: number = WELD_EPS,
): Wall[] {
  const v = vertexAt(weldVertices(original, eps), from, eps);
  return v ? moveEnds(original, v.ends, to) : [...original];
}

/**
 * Translate one wall by (dx, dy), carrying the corners at both of its ends.
 *
 * Every other wall that met it at a corner keeps meeting it: only the shared end
 * moves, so that wall stretches. A wall joined at *both* ends translates whole,
 * because both of its ends are carried. A degenerate wall whose two ends are the
 * same corner is moved once, not twice.
 */
export function dragWallWelded(
  original: readonly Wall[],
  wallId: string,
  dx: number,
  dy: number,
  eps: number = WELD_EPS,
): Wall[] {
  const wall = original.find((w) => w.id === wallId);
  if (!wall) return [...original];

  const vertices = weldVertices(original, eps);
  const seen = new Set<Vertex>();
  let walls: Wall[] = [...original];

  for (const end of [1, 2] as const) {
    const from = endPoint(wall, end);
    const v = vertexAt(vertices, from, eps);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    walls = moveEnds(walls, v.ends, { x: v.x + dx, y: v.y + dy });
  }
  return walls;
}

/** `${wallId}:${end}` — the key an exclusion set is built from. */
export function endKey(e: WallEnd): string {
  return `${e.id}:${e.end}`;
}

/**
 * The nearest wall corner to `p`, ignoring the ends being dragged.
 *
 * `nearestCorner` in editor-geometry searches every endpoint, including the one
 * under the cursor. During a drag that end sits where the last frame left it, a
 * few units away, so it is always the nearest corner and the handle snaps back
 * onto itself: the corner cannot be moved unless the pointer jumps further than
 * the snap radius between two events.
 *
 * Search the walls as they were when the drag began. Every other corner is
 * standing still, and the ones that are not are excluded.
 */
export function nearestCornerExcluding(
  walls: readonly Wall[],
  p: Point,
  maxDist: number,
  exclude: ReadonlySet<string>,
): Point | null {
  let best: Point | null = null;
  let bestDist = maxDist;
  for (const w of walls) {
    for (const end of [1, 2] as const) {
      if (exclude.has(endKey({ id: w.id, end }))) continue;
      const e = endPoint(w, end);
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: e.x, y: e.y };
      }
    }
  }
  return best;
}
