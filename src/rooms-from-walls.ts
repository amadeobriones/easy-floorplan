/**
 * Find the rooms enclosed by a set of walls.
 *
 * This exists because not everyone has a LiDAR scan with a room layer in it. You
 * draw walls; this reads off the spaces they enclose.
 *
 * It is **not** automatic. The card never derives rooms while rendering: the
 * moment one wall fails to quite meet its neighbour, a derived room silently
 * vanishes, and a plan that loses a room because a corner is one pixel out is
 * worse than one with no rooms at all. This is a one-shot assist the user asks
 * for, and what it produces is an ordinary editable polygon they then own.
 *
 * ## How
 *
 * The walls form a planar graph once coincident endpoints are welded into
 * vertices (see `editor-walls`). Every edge is walked twice, once in each
 * direction, and each directed edge belongs to exactly one face. Standing at the
 * far end of a directed edge and turning as tightly as possible — taking the next
 * edge clockwise from the one you came in on — traces the boundary of a single
 * face and comes back where it started.
 *
 * Do that from every directed edge and you get every face, including the outer
 * one: the infinite region surrounding the whole plan. It is the only face whose
 * signed area has the opposite sign to all the others, which is how it is dropped.
 *
 * Walls need not meet at their endpoints. A wall that ends in the middle of another
 * — a T-junction, which is what a partition wall almost always is — would leave the
 * graph unsplit there and read the two spaces on either side as one. So the walls
 * are first split at every such junction.
 *
 * What it finds is what the walls enclose, which is not always what a person would
 * call a room. On the plan this project generates, 37 walls enclose 10 spaces while
 * the LiDAR scan labelled 11: no wall at all separates the kitchen from the laundry,
 * because a 2.17 m double door spans the whole boundary. The detector is right and
 * the scan is right; they are answering different questions. Rooms it produces are
 * ordinary editable polygons, so the user splits or merges them as they see fit.
 */
import type { Wall } from "./types";
import { weldVertices, WELD_EPS, type Vertex } from "./editor-walls";

export type Poly = Array<[number, number]>;

/** Smaller than this and it is a sliver between two nearly-parallel walls. */
export const MIN_ROOM_AREA = 400;

/** Shoelace. Positive or negative depending on winding; the sign is what we use. */
export function signedArea(points: Poly): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Distance from `p` to segment `a`-`b`, and how far along it the foot lies (0..1). */
function projectOnSegment(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): { dist: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { dist: Math.hypot(p[0] - a[0], p[1] - a[1]), t: 0 };
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  const clamped = Math.max(0, Math.min(1, t));
  const fx = a[0] + clamped * dx;
  const fy = a[1] + clamped * dy;
  return { dist: Math.hypot(p[0] - fx, p[1] - fy), t };
}

/**
 * Split every wall wherever another wall's endpoint lands in the middle of it.
 *
 * A partition wall meets the wall it divides at a T, not at a corner. Left alone,
 * the T-junction is invisible to the graph -- the crossbar is one edge, the stem
 * touches it nowhere -- and the two spaces either side of the stem read as one.
 *
 * Splitting is a view of the walls, not an edit of them: the ids gain a `#n`
 * suffix so nothing downstream mistakes a piece for the wall the user drew.
 */
export function splitAtTJunctions(walls: readonly Wall[], eps: number = WELD_EPS): Wall[] {
  const corners = weldVertices(walls, eps).map((v) => [v.x, v.y] as [number, number]);
  const out: Wall[] = [];

  for (const w of walls) {
    const a: [number, number] = [w.x1, w.y1];
    const b: [number, number] = [w.x2, w.y2];
    const cuts: Array<{ t: number; p: [number, number] }> = [];
    for (const c of corners) {
      const { dist, t } = projectOnSegment(c, a, b);
      // On the segment, and not at either end -- an endpoint is already a corner.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const margin = len > 0 ? eps / len : 1;
      if (dist <= eps && t > margin && t < 1 - margin) cuts.push({ t, p: c });
    }
    if (!cuts.length) {
      out.push(w);
      continue;
    }
    cuts.sort((p, q) => p.t - q.t);
    let from = a;
    cuts.forEach((cut, i) => {
      out.push({ ...w, id: `${w.id}#${i}`, x1: from[0], y1: from[1], x2: cut.p[0], y2: cut.p[1] });
      from = cut.p;
    });
    out.push({ ...w, id: `${w.id}#${cuts.length}`, x1: from[0], y1: from[1], x2: b[0], y2: b[1] });
  }
  return out;
}

interface Edge {
  from: number;
  to: number;
  angle: number;
  /** This edge's position in `out.get(from)`, once that list is sorted. */
  slot: number;
}

const key = (from: number, to: number) => `${from}>${to}`;

/**
 * Every face of the planar graph the walls describe, as a polygon of vertices.
 *
 * Returned in no particular order, and including the outer face.
 */
export function faces(input: readonly Wall[], eps: number = WELD_EPS): Poly[] {
  const walls = splitAtTJunctions(input, eps);
  const vertices: Vertex[] = weldVertices(walls, eps);
  const indexOf = (x: number, y: number) =>
    vertices.findIndex((v) => Math.abs(v.x - x) <= eps && Math.abs(v.y - y) <= eps);

  // Directed edges, deduplicated: two walls between the same pair of corners are
  // one edge of the graph, and a zero-length wall is no edge at all.
  const out = new Map<number, Edge[]>();
  const byKey = new Map<string, Edge>();
  const addEdge = (from: number, to: number) => {
    if (from === to || byKey.has(key(from, to))) return;
    const angle = Math.atan2(vertices[to].y - vertices[from].y, vertices[to].x - vertices[from].x);
    const e: Edge = { from, to, angle, slot: -1 };
    byKey.set(key(from, to), e);
    if (!out.has(from)) out.set(from, []);
    out.get(from)!.push(e);
  };
  for (const w of walls) {
    const a = indexOf(w.x1, w.y1);
    const b = indexOf(w.x2, w.y2);
    if (a < 0 || b < 0) continue;
    addEdge(a, b);
    addEdge(b, a);
  }
  // Sort each vertex's outgoing edges by angle, then record where each one landed.
  for (const list of out.values()) {
    list.sort((p, q) => p.angle - q.angle);
    list.forEach((e, i) => (e.slot = i));
  }

  /**
   * The edge leaving `e.to` that turns most tightly back from `e`.
   *
   * Found through the reverse edge's own recorded slot, never by searching for an
   * angle: two collinear edges leaving one vertex have the *same* angle, so an
   * angle search can match the wrong one — or match nothing, and then an
   * unguarded `(i - 1 + n) % n` quietly returns `list[n - 2]`.
   */
  const nextEdge = (e: Edge): Edge => {
    const list = out.get(e.to)!;
    const back = byKey.get(key(e.to, e.from))!;
    return list[(back.slot - 1 + list.length) % list.length];
  };

  const visited = new Set<string>();
  const result: Poly[] = [];
  for (const list of out.values()) {
    for (const start of list) {
      if (visited.has(key(start.from, start.to))) continue;
      const poly: Poly = [];
      let e = start;
      // A malformed graph must not spin forever: every face is at most as long as
      // the number of directed edges.
      for (let guard = 0; guard < byKey.size + 1; guard++) {
        visited.add(key(e.from, e.to));
        poly.push([vertices[e.from].x, vertices[e.from].y]);
        e = nextEdge(e);
        if (e === start) break;
      }
      // A tree of walls encloses nothing: its single face walks out and back along
      // every edge, so it has vertices but no area. That is not a face.
      if (poly.length >= 3 && Math.abs(signedArea(poly)) > 1e-9) result.push(poly);
    }
  }
  return result;
}

/**
 * The enclosed rooms: every face but the outer one, and nothing degenerate.
 *
 * **The outer face is the negative one.** That is a property of the traversal rule
 * — turn one step clockwise from the edge you came in on — and not of the shape,
 * so it holds for any plan. It cannot be found by size: a single square room has
 * exactly the same area as its own outer face, wound the other way, and two equal
 * rooms would defeat a largest-area test too. `test_the_outer_face_is_negative`
 * pins it against a two-room plan, where the outer face is -20000 and each room
 * is +10000.
 */
export function detectRooms(
  walls: readonly Wall[],
  eps: number = WELD_EPS,
  minArea: number = MIN_ROOM_AREA,
): Poly[] {
  return faces(walls, eps).filter((p) => signedArea(p) >= minArea);
}

/** Area centroid. Falls back to the vertex mean for a degenerate polygon. */
export function centroid(points: Poly): [number, number] {
  const a = signedArea(points);
  if (Math.abs(a) < 1e-9) {
    const n = points.length || 1;
    return [
      points.reduce((t, p) => t + p[0], 0) / n,
      points.reduce((t, p) => t + p[1], 0) / n,
    ];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

/** Ray casting. Points exactly on an edge may fall either way; nothing relies on it. */
export function pointInPolygon(p: [number, number], points: Poly): boolean {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
