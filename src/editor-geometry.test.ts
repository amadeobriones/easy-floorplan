import { describe, it, expect } from "vitest";
import { nearestCorner, snapWallEnd, elementsInRect, applyDelta } from "./editor-geometry";
import type { OrigPos } from "./editor-geometry";
import type { Floor } from "./types";

const walls = [{ x1: 0, y1: 0, x2: 100, y2: 0 }];

describe("nearestCorner", () => {
  it("finds an endpoint within range", () => {
    expect(nearestCorner(walls, 3, 4, 26)).toEqual({ x: 0, y: 0 });
  });

  it("returns null when out of range", () => {
    expect(nearestCorner(walls, 50, 50, 26)).toBeNull();
  });

  it("prefers the closest endpoint", () => {
    expect(nearestCorner(walls, 95, 2, 26)).toEqual({ x: 100, y: 0 });
  });
});

describe("snapWallEnd", () => {
  const snap = (v: number) => Math.round(v / 10) * 10;

  it("snaps flat to horizontal within the axis-gravity angle", () => {
    expect(snapWallEnd(walls, 0, 50, 80, 53, snap, false, 10)).toEqual({ x: 80, y: 50 });
  });

  it("snaps flat to vertical within the axis-gravity angle", () => {
    expect(snapWallEnd(walls, 0, 50, 3, 120, snap, false, 10)).toEqual({ x: 0, y: 120 });
  });

  it("keeps the free angle outside the gravity zone", () => {
    expect(snapWallEnd(walls, 0, 0, 52, 48, snap, false, 10)).toEqual({ x: 50, y: 50 });
  });

  it("an existing corner beats axis gravity", () => {
    expect(snapWallEnd(walls, 0, 50, 98, 3, snap, false, 10)).toEqual({ x: 100, y: 0 });
  });

  it("free mode only grid-snaps (corners and axes ignored)", () => {
    expect(snapWallEnd(walls, 0, 0, 52, 48, snap, true, 10)).toEqual({ x: 50, y: 50 });
    // (95, 12) is within corner-snap range of (100, 0): free mode must ignore
    // the corner and yield the plain grid snap instead.
    expect(snapWallEnd(walls, 0, 50, 95, 12, snap, true, 10)).toEqual({ x: 100, y: 10 });
  });
});

const floor = {
  id: "f",
  name: "F",
  walls: [{ id: "w", x1: 0, y1: 0, x2: 100, y2: 0 }],
  openings: [{ id: "o", type: "door", x: 10, y: 10 }],
  items: [{ id: "i", kind: "light", x: 200, y: 200, entity: "light.a" }],
  texts: [],
  furniture: [],
  trackers: [{ id: "t", x: 0, y: 0, w: 20, h: 20 }],
} as unknown as Floor;

describe("elementsInRect", () => {
  it("selects wall by midpoint, tracker by center, point elements by anchor", () => {
    const hits = elementsInRect(floor, { x0: 0, y0: 0, x1: 60, y1: 60 });
    expect(hits).toEqual([
      { kind: "wall", id: "w" },
      { kind: "opening", id: "o" },
      { kind: "tracker", id: "t" },
    ]);
  });

  it("handles inverted rects", () => {
    const hits = elementsInRect(floor, { x0: 60, y0: 60, x1: 0, y1: 0 });
    expect(hits.length).toBe(3);
  });
});

describe("applyDelta", () => {
  it("translates only snapshotted elements; walls by all four coords", () => {
    const f = {
      id: "f",
      name: "F",
      walls: [
        { id: "w", x1: 0, y1: 0, x2: 100, y2: 0 },
        { id: "w2", x1: 5, y1: 5, x2: 6, y2: 6 },
      ],
      openings: [],
      items: [],
      texts: [],
      furniture: [],
      trackers: [],
    } as unknown as Floor;
    const orig = new Map<string, OrigPos>([
      ["wall:w", { kind: "wall", x1: 0, y1: 0, x2: 100, y2: 0 }],
    ]);
    const out = applyDelta(f, 10, 20, orig);
    expect(out.walls![0]).toMatchObject({ x1: 10, y1: 20, x2: 110, y2: 20 });
    expect(out.walls![1]).toMatchObject({ x1: 5, y1: 5 });
  });

  it("translates point elements from their snapshot, not their current position", () => {
    const f = {
      ...floor,
      openings: [{ id: "o", type: "door", x: 999, y: 999 }],
    } as unknown as Floor;
    const orig = new Map<string, OrigPos>([["opening:o", { kind: "pt", x: 10, y: 10 }]]);
    const out = applyDelta(f, 5, 5, orig);
    expect(out.openings![0]).toMatchObject({ x: 15, y: 15 });
  });
});
