import { describe, it, expect } from "vitest";
import {
  faces,
  detectRooms,
  signedArea,
  centroid,
  pointInPolygon,
  splitAtTJunctions,
  MIN_ROOM_AREA,
} from "./rooms-from-walls";
import type { Wall } from "./types";

const w = (id: string, x1: number, y1: number, x2: number, y2: number): Wall =>
  ({ id, x1, y1, x2, y2 });

/** One 100x100 room. */
const SQUARE = [
  w("n", 0, 0, 100, 0),
  w("e", 100, 0, 100, 100),
  w("s", 100, 100, 0, 100),
  w("w", 0, 100, 0, 0),
];

/** A 200x100 rectangle split down the middle: two 100x100 rooms. */
const TWO_ROOMS = [
  w("n1", 0, 0, 100, 0),
  w("n2", 100, 0, 200, 0),
  w("e", 200, 0, 200, 100),
  w("s2", 200, 100, 100, 100),
  w("s1", 100, 100, 0, 100),
  w("west", 0, 100, 0, 0),
  w("mid", 100, 0, 100, 100),
];

const areaOf = (p: Array<[number, number]>) => Math.abs(signedArea(p));

describe("signedArea", () => {
  it("is the shoelace area, and its sign is the winding", () => {
    const cw: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(signedArea(cw)).toBe(100);
    expect(signedArea([...cw].reverse())).toBe(-100);
  });
});

describe("faces", () => {
  it("a square has two faces: the room and the world outside it", () => {
    expect(faces(SQUARE)).toHaveLength(2);
  });

  // Not by size. A square room has exactly the area of its own outer face.
  it("the outer face is the negative one", () => {
    const areas = faces(TWO_ROOMS).map(signedArea).sort((a, b) => a - b);
    expect(areas).toEqual([-20000, 10000, 10000]);
    expect(faces(SQUARE).map(signedArea).sort((a, b) => a - b)).toEqual([-10000, 10000]);
  });

  it("walls that enclose nothing produce no face", () => {
    expect(faces([w("a", 0, 0, 100, 0)])).toHaveLength(0);
    expect(faces([w("a", 0, 0, 100, 0), w("b", 100, 0, 100, 100)])).toHaveLength(0);
  });

  it("ignores a zero-length wall rather than looping on it", () => {
    expect(faces([...SQUARE, w("dot", 50, 50, 50, 50)])).toHaveLength(2);
  });

  it("two walls between the same corners are one edge", () => {
    expect(faces([...SQUARE, w("n-again", 0, 0, 100, 0)])).toHaveLength(2);
  });
});

describe("detectRooms", () => {
  it("finds the one room a square encloses", () => {
    const rooms = detectRooms(SQUARE);
    expect(rooms).toHaveLength(1);
    expect(areaOf(rooms[0])).toBe(10000);
    expect(rooms[0]).toHaveLength(4);
  });

  it("finds both rooms of a split rectangle, and not the rectangle", () => {
    const rooms = detectRooms(TWO_ROOMS);
    expect(rooms).toHaveLength(2);
    expect(rooms.map(areaOf)).toEqual([10000, 10000]);
  });

  it("finds nothing in walls that enclose nothing", () => {
    expect(detectRooms([w("a", 0, 0, 100, 0)])).toEqual([]);
    expect(detectRooms([])).toEqual([]);
  });

  it("drops a sliver too thin to be a room", () => {
    // 3 units tall: wider than WELD_EPS, so the corners survive, and 300 < 400.
    const sliver = [
      w("a", 0, 0, 100, 0),
      w("b", 100, 0, 100, 3),
      w("c", 100, 3, 0, 3),
      w("d", 0, 3, 0, 0),
    ];
    expect(areaOf(faces(sliver)[0])).toBe(300);
    expect(300).toBeLessThan(MIN_ROOM_AREA);
    expect(detectRooms(sliver)).toEqual([]);
  });

  // WELD_EPS is 1 unit: corners closer than that are the same corner, so a
  // one-unit-tall "room" is not a room, it is a wall drawn twice.
  it("a gap narrower than the weld epsilon is not a room at all", () => {
    const hair = [
      w("a", 0, 0, 100, 0),
      w("b", 100, 0, 100, 1),
      w("c", 100, 1, 0, 1),
      w("d", 0, 1, 0, 0),
    ];
    expect(faces(hair)).toEqual([]);
  });

  // The wall tool snaps endpoints onto existing corners, so this is the normal case.
  it("welds corners that are within the epsilon, and finds the room anyway", () => {
    const nearly = [
      w("n", 0, 0, 100, 0),
      w("e", 100.5, 0, 100, 100),
      w("s", 100, 100, 0, 100),
      w("w", 0, 100, 0, 0),
    ];
    expect(detectRooms(nearly)).toHaveLength(1);
  });

  // A wall that reaches only halfway across divides nothing: you can walk round it.
  it("a stub wall that reaches nothing leaves one room", () => {
    const rooms = detectRooms([...SQUARE, w("stub", 50, 0, 50, 60)]);
    expect(rooms).toHaveLength(1);
    expect(areaOf(rooms[0])).toBe(10000);
  });

  // The partition wall of every real floor plan: it meets the walls it divides
  // mid-span, at a T, not at a corner. Without splitting, this reads as one room.
  it("a partition wall that meets its neighbours at T-junctions splits the room", () => {
    const rooms = detectRooms([...SQUARE, w("mid", 50, 0, 50, 100)]);
    expect(rooms).toHaveLength(2);
    expect(rooms.map(areaOf).sort()).toEqual([5000, 5000]);
  });

  it("an L-shaped room comes back with all six corners", () => {
    const L = [
      w("a", 0, 0, 100, 0),
      w("b", 100, 0, 100, 50),
      w("c", 100, 50, 50, 50),
      w("d", 50, 50, 50, 100),
      w("e", 50, 100, 0, 100),
      w("f", 0, 100, 0, 0),
    ];
    const rooms = detectRooms(L);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toHaveLength(6);
    expect(areaOf(rooms[0])).toBe(7500);
  });
});

describe("centroid / pointInPolygon", () => {
  const sq: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];

  it("a square's centroid is its middle, whichever way it winds", () => {
    expect(centroid(sq)).toEqual([50, 50]);
    expect(centroid([...sq].reverse())).toEqual([50, 50]);
  });

  it("an L's centroid is inside the L, not in its notch", () => {
    const L: Array<[number, number]> = [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]];
    expect(pointInPolygon(centroid(L), L)).toBe(true);
  });

  it("falls back to the vertex mean for a degenerate polygon", () => {
    expect(centroid([[0, 0], [10, 0], [20, 0]])).toEqual([10, 0]);
    expect(centroid([])).toEqual([0, 0]);
  });

  it("knows inside from outside", () => {
    expect(pointInPolygon([50, 50], sq)).toBe(true);
    expect(pointInPolygon([150, 50], sq)).toBe(false);
    expect(pointInPolygon([50, -1], sq)).toBe(false);
  });

  // This is how detectRooms skips a room the user already has.
  it("a detected face's centroid lands inside that face", () => {
    for (const poly of detectRooms([
      { id: "a", x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: "b", x1: 100, y1: 0, x2: 100, y2: 100 },
      { id: "c", x1: 100, y1: 100, x2: 0, y2: 100 },
      { id: "d", x1: 0, y1: 100, x2: 0, y2: 0 },
    ])) {
      expect(pointInPolygon(centroid(poly), poly)).toBe(true);
    }
  });
});

describe("splitAtTJunctions", () => {
  it("cuts a wall where another wall's endpoint lands on it", () => {
    const out = splitAtTJunctions([w("n", 0, 0, 100, 0), w("t", 50, 0, 50, 60)]);
    const pieces = out.filter((x) => x.id.startsWith("n#"));
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toMatchObject({ x1: 0, y1: 0, x2: 50, y2: 0 });
    expect(pieces[1]).toMatchObject({ x1: 50, y1: 0, x2: 100, y2: 0 });
  });

  it("leaves a wall alone when nothing lands in its middle", () => {
    const walls = [w("a", 0, 0, 100, 0), w("b", 100, 0, 100, 50)];
    expect(splitAtTJunctions(walls)).toEqual(walls);
  });

  it("does not cut at its own endpoints, which are corners already", () => {
    const walls = [w("a", 0, 0, 100, 0), w("b", 100, 0, 100, 50), w("c", 0, 0, 0, 50)];
    expect(splitAtTJunctions(walls).filter((x) => x.id.includes("#"))).toEqual([]);
  });

  it("cuts a wall twice when two walls land on it, in order along the wall", () => {
    const out = splitAtTJunctions([
      w("n", 0, 0, 100, 0),
      w("t2", 70, 0, 70, 30),
      w("t1", 30, 0, 30, 30),
    ]);
    const pieces = out.filter((x) => x.id.startsWith("n#"));
    expect(pieces.map((x) => [x.x1, x.x2])).toEqual([[0, 30], [30, 70], [70, 100]]);
  });

  it("gives the pieces distinct ids, so nothing mistakes one for the drawn wall", () => {
    const out = splitAtTJunctions([w("n", 0, 0, 100, 0), w("t", 50, 0, 50, 60)]);
    expect(new Set(out.map((x) => x.id)).size).toBe(out.length);
    expect(out.some((x) => x.id === "n")).toBe(false);
  });
});
