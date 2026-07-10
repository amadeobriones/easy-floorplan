import { describe, it, expect } from "vitest";
import {
  weldVertices,
  vertexAt,
  moveEnds,
  dragVertex,
  dragWallWelded,
  nearestCornerExcluding,
  endKey,
  WELD_EPS,
} from "./editor-walls";
import type { Wall } from "./types";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number): Wall =>
  ({ id, x1, y1, x2, y2 });

/** An L: `a` runs east along the top, `b` runs south from a's far end. */
const L = [wall("a", 0, 0, 100, 0), wall("b", 100, 0, 100, 80)];

/** A closed square, four walls, four corners. */
const SQUARE = [
  wall("n", 0, 0, 100, 0),
  wall("e", 100, 0, 100, 100),
  wall("s", 100, 100, 0, 100),
  wall("w", 0, 100, 0, 0),
];

describe("weldVertices", () => {
  it("finds the shared corner of an L, and the two loose ends", () => {
    const v = weldVertices(L);
    expect(v).toHaveLength(3);
    const corner = vertexAt(v, { x: 100, y: 0 })!;
    expect(corner.ends).toEqual([
      { id: "a", end: 2 },
      { id: "b", end: 1 },
    ]);
  });

  it("a closed square has four corners, each shared by two walls", () => {
    const v = weldVertices(SQUARE);
    expect(v).toHaveLength(4);
    expect(v.every((x) => x.ends.length === 2)).toBe(true);
  });

  it("welds within the epsilon and not beyond it", () => {
    const nearly = [wall("a", 0, 0, 100, 0), wall("b", 100 + WELD_EPS, 0, 100, 80)];
    expect(weldVertices(nearly)).toHaveLength(3);
    const apart = [wall("a", 0, 0, 100, 0), wall("b", 100 + WELD_EPS + 0.01, 0, 100, 80)];
    expect(weldVertices(apart)).toHaveLength(4);
  });

  // Averaging coincident ends would nudge the corner every time a wall joined it.
  it("puts the vertex where the first end was, not at the average", () => {
    const v = weldVertices([wall("a", 0, 0, 100, 0), wall("b", 100.6, 0, 100, 80)], 1);
    expect(vertexAt(v, { x: 100, y: 0 })!.x).toBe(100);
  });

  it("a zero-length wall is one vertex holding both its ends", () => {
    const v = weldVertices([wall("dot", 5, 5, 5, 5)]);
    expect(v).toHaveLength(1);
    expect(v[0].ends).toHaveLength(2);
  });
});

describe("dragVertex", () => {
  it("drags an L's corner and both walls follow", () => {
    const out = dragVertex(L, { x: 100, y: 0 }, { x: 130, y: 20 });
    expect(out.find((w) => w.id === "a")).toMatchObject({ x1: 0, y1: 0, x2: 130, y2: 20 });
    expect(out.find((w) => w.id === "b")).toMatchObject({ x1: 130, y1: 20, x2: 100, y2: 80 });
  });

  it("leaves the walls alone when no corner is there", () => {
    const out = dragVertex(L, { x: 50, y: 50 }, { x: 0, y: 0 });
    expect(out).toEqual(L);
  });

  it("does not mutate the input", () => {
    const before = structuredClone(L);
    dragVertex(L, { x: 100, y: 0 }, { x: 130, y: 20 });
    expect(L).toEqual(before);
  });

  it("dragging a square's corner stretches its two walls and leaves the other two", () => {
    const out = dragVertex(SQUARE, { x: 0, y: 0 }, { x: -40, y: -40 });
    expect(out.find((w) => w.id === "n")).toMatchObject({ x1: -40, y1: -40, x2: 100, y2: 0 });
    expect(out.find((w) => w.id === "w")).toMatchObject({ x1: 0, y1: 100, x2: -40, y2: -40 });
    expect(out.find((w) => w.id === "e")).toEqual(SQUARE[1]);
    expect(out.find((w) => w.id === "s")).toEqual(SQUARE[2]);
  });

  it("is a function of where the drag ends, not how it got there", () => {
    const once = dragVertex(L, { x: 100, y: 0 }, { x: 130, y: 20 });
    const twice = dragVertex(dragVertex(L, { x: 100, y: 0 }, { x: 110, y: 5 }), { x: 110, y: 5 }, { x: 130, y: 20 });
    expect(once).toEqual(twice);
  });
});

describe("dragWallWelded", () => {
  it("moves the wall and stretches its neighbour rather than tearing the corner", () => {
    const out = dragWallWelded(L, "a", 0, -30);
    expect(out.find((w) => w.id === "a")).toMatchObject({ x1: 0, y1: -30, x2: 100, y2: -30 });
    // b's shared end came along; its far end stayed put, so b got longer.
    expect(out.find((w) => w.id === "b")).toMatchObject({ x1: 100, y1: -30, x2: 100, y2: 80 });
  });

  it("a wall joined at both ends translates whole", () => {
    const pair = [wall("a", 0, 0, 100, 0), wall("b", 0, 0, 100, 0)];
    const out = dragWallWelded(pair, "a", 10, 10);
    expect(out.find((w) => w.id === "b")).toMatchObject({ x1: 10, y1: 10, x2: 110, y2: 10 });
  });

  it("dragging one side of a square keeps the square closed", () => {
    const out = dragWallWelded(SQUARE, "n", 0, -25);
    const corners = weldVertices(out);
    expect(corners).toHaveLength(4);
    expect(corners.every((c) => c.ends.length === 2)).toBe(true);
  });

  it("a degenerate wall whose ends share a corner moves once, not twice", () => {
    const out = dragWallWelded([wall("dot", 5, 5, 5, 5)], "dot", 10, 0);
    expect(out[0]).toMatchObject({ x1: 15, y1: 5, x2: 15, y2: 5 });
  });

  it("an unknown id changes nothing", () => {
    expect(dragWallWelded(L, "nope", 10, 10)).toEqual(L);
  });

  it("a lone wall just translates", () => {
    const out = dragWallWelded([wall("a", 0, 0, 10, 0)], "a", 5, 5);
    expect(out[0]).toMatchObject({ x1: 5, y1: 5, x2: 15, y2: 5 });
  });

  it("does not mutate the input", () => {
    const before = structuredClone(SQUARE);
    dragWallWelded(SQUARE, "n", 3, 4);
    expect(SQUARE).toEqual(before);
  });
});

describe("moveEnds", () => {
  it("moves only the named ends", () => {
    const out = moveEnds(L, [{ id: "b", end: 2 }], { x: 7, y: 7 });
    expect(out.find((w) => w.id === "a")).toEqual(L[0]);
    expect(out.find((w) => w.id === "b")).toMatchObject({ x1: 100, y1: 0, x2: 7, y2: 7 });
  });

  it("moves both ends of the same wall when both are named", () => {
    const out = moveEnds(L, [{ id: "a", end: 1 }, { id: "a", end: 2 }], { x: 1, y: 2 });
    expect(out[0]).toMatchObject({ x1: 1, y1: 2, x2: 1, y2: 2 });
  });
});

describe("nearestCornerExcluding", () => {
  const none = new Set<string>();

  it("finds the nearest corner within range", () => {
    expect(nearestCornerExcluding(L, { x: 96, y: 3 }, 26, none)).toEqual({ x: 100, y: 0 });
  });

  it("returns null when everything is out of range", () => {
    expect(nearestCornerExcluding(L, { x: 500, y: 500 }, 26, none)).toBeNull();
  });

  // Without this the dragged end -- sitting a few units away, where the last frame
  // left it -- is always the nearest corner, and the handle snaps back onto itself.
  it("ignores the ends being dragged", () => {
    const cursor = { x: 98, y: 2 };
    expect(nearestCornerExcluding(L, cursor, 26, none)).toEqual({ x: 100, y: 0 });
    const dragging = new Set([endKey({ id: "a", end: 2 }), endKey({ id: "b", end: 1 })]);
    expect(nearestCornerExcluding(L, cursor, 26, dragging)).toBeNull();
  });

  it("still snaps to a different wall's corner while dragging", () => {
    const walls = [...L, wall("c", 90, 10, 90, 60)];
    const dragging = new Set([endKey({ id: "a", end: 2 }), endKey({ id: "b", end: 1 })]);
    expect(nearestCornerExcluding(walls, { x: 92, y: 8 }, 26, dragging)).toEqual({ x: 90, y: 10 });
  });

  it("endKey distinguishes the two ends of one wall", () => {
    expect(endKey({ id: "a", end: 1 })).not.toBe(endKey({ id: "a", end: 2 }));
  });
});
