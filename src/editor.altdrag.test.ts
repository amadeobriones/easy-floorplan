// @vitest-environment jsdom
/**
 * #30 wall-corner dragging — the Alt-detach path.
 *
 * The endpoint-drag branch builds its snap-*exclusion* set from `attach`, which is
 * emptied when Alt is held. So with Alt down the coincident neighbour corner — at
 * identical coordinates — stays a snap candidate at distance ~0 and yanks the
 * dragged endpoint straight back onto it for the whole ENDPOINT_SNAP (26u) radius.
 * The Alt-detach feature the PR advertises is dead for any detachment under 26u —
 * the exact dead zone the PR claims to have removed, relocated onto Alt.
 *
 * Driven through the real `_applyDrag`; only `_toVirtual` (SVG CTM, absent in jsdom)
 * is stubbed to identity — the code under test is the exclusion-set construction.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { attachedCorners } from "./editor-geometry";
import type { FloorplanCardConfig } from "./types";

const ROOM = {
  type: "custom:easy-floorplan-card",
  width: 1000,
  height: 600,
  snap: 1, // step 1 → _snap is effectively identity, so assertions read raw coords
  floors: [
    {
      id: "f1",
      walls: [
        { id: "n", x1: 0, y1: 0, x2: 100, y2: 0 }, // endpoint 2 == (100,0)
        { id: "e", x1: 100, y1: 0, x2: 100, y2: 80 }, // endpoint 1 == (100,0), coincident
      ],
    },
  ],
} as unknown as FloorplanCardConfig;

async function mountAtCorner() {
  const { FloorplanCardEditor } = await import("./editor");
  const el = document.createElement("easy-floorplan-card-editor") as InstanceType<
    typeof FloorplanCardEditor
  >;
  const p = el as unknown as Record<string, unknown> & { updateComplete: Promise<unknown> };
  p.hass = { states: {}, entities: {}, formatEntityState: () => "" };
  el.setConfig(structuredClone(ROOM));
  document.body.appendChild(el);
  await p.updateComplete;

  // Only DOM dependency in the drag path: map client coords straight to virtual.
  p._toVirtual = (ev: PointerEvent) => ({ x: ev.clientX, y: ev.clientY });

  // Drag wall "n"'s endpoint 2, which coincides with wall "e"'s endpoint 1.
  p._selection = [{ kind: "wall", id: "n" }];
  const walls = (p._config as { floors: { walls: unknown[] }[] }).floors[0].walls;
  p._drag = {
    primary: { kind: "wall", id: "n" },
    endpoint: 2,
    start: { x: 100, y: 0 },
    orig: (p._snapshotSelection as () => unknown)(),
    attached: attachedCorners(walls as never, "n", 2),
    moved: false,
  };

  let emitted: FloorplanCardConfig | undefined;
  el.addEventListener("config-changed", (e) => {
    emitted = (e as CustomEvent).detail.config;
  });
  const apply = (clientX: number, clientY: number, altKey: boolean) =>
    (p._applyDrag as (ev: unknown) => void)({ clientX, clientY, altKey, pointerId: 1 });

  type W = { id: string; x1: number; y1: number; x2: number; y2: number };
  const wall = (id: string) =>
    (emitted as { floors: { walls: W[] }[] }).floors[0].walls.find((w) => w.id === id)!;
  return { apply, wall, hasEmit: () => emitted !== undefined };
}

beforeAll(() => {
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("#30 Alt-detach must actually detach", () => {
  it("Alt-dragging an endpoint 7u off its neighbour moves it — not snaps it back", async () => {
    const { apply, wall } = await mountAtCorner();
    // Cursor at (105,5): ~7u from the shared corner (100,0), well inside 26u.
    apply(105, 5, true);
    const n = wall("n");
    // The bug parks it back at exactly the neighbour (100,0). Detached, it should
    // have moved toward the cursor instead.
    expect({ x: n.x2, y: n.y2 }).not.toEqual({ x: 100, y: 0 });
    expect(n.x2).toBeGreaterThan(100);
  });

  it("without Alt, the neighbour corner travels along (stretch is preserved)", async () => {
    const { apply, wall } = await mountAtCorner();
    // A clear move so it isn't swallowed by another corner's snap: (160,40).
    apply(160, 40, false);
    const n = wall("n");
    const e = wall("e");
    // n's endpoint 2 and e's endpoint 1 both follow — the room stretches, not tears.
    expect({ x: n.x2, y: n.y2 }).toEqual({ x: 160, y: 40 });
    expect({ x: e.x1, y: e.y1 }).toEqual({ x: 160, y: 40 });
  });
});

describe("#30 group drag stretches, does not tear", () => {
  const THREE_WALL = {
    type: "custom:easy-floorplan-card",
    width: 1000,
    height: 600,
    snap: 1,
    floors: [
      {
        id: "f1",
        walls: [
          { id: "n", x1: 0, y1: 0, x2: 100, y2: 0 },
          { id: "e", x1: 100, y1: 0, x2: 100, y2: 80 }, // e:2 == (100,80)
          { id: "s", x1: 100, y1: 80, x2: 0, y2: 80 }, // s:1 == (100,80), coincident with e:2
        ],
      },
    ],
  } as unknown as FloorplanCardConfig;

  it("dragging a two-wall selection carries the corner shared with an unselected wall", async () => {
    const { FloorplanCardEditor } = await import("./editor");
    const el = document.createElement("easy-floorplan-card-editor") as InstanceType<
      typeof FloorplanCardEditor
    >;
    const p = el as unknown as Record<string, unknown> & { updateComplete: Promise<unknown> };
    p.hass = { states: {}, entities: {}, formatEntityState: () => "" };
    el.setConfig(structuredClone(THREE_WALL));
    document.body.appendChild(el);
    await p.updateComplete;
    // Stub the two DOM touchpoints of a drag that jsdom lacks.
    p._toVirtual = (ev: PointerEvent) => ({ x: ev.clientX, y: ev.clientY });
    el.setPointerCapture = () => {};

    // Select walls n and e; then grab n (already selected → selection preserved).
    p._selection = [
      { kind: "wall", id: "n" },
      { kind: "wall", id: "e" },
    ];
    (p._startDrag as (ev: unknown, sel: unknown) => void)(
      { clientX: 0, clientY: 0, pointerId: 1, stopPropagation() {} },
      { kind: "wall", id: "n" }
    );

    let emitted: FloorplanCardConfig | undefined;
    el.addEventListener("config-changed", (e) => (emitted = (e as CustomEvent).detail.config));
    // Translate the group by (0, -10).
    (p._applyDrag as (ev: unknown) => void)({ clientX: 0, clientY: -10, altKey: false, pointerId: 1 });

    type W = { id: string; x1: number; y1: number; x2: number; y2: number };
    const walls = (emitted as { floors: { walls: W[] }[] }).floors[0].walls;
    const e = walls.find((w) => w.id === "e")!;
    const s = walls.find((w) => w.id === "s")!;
    // e is selected → its endpoint 2 translated to (100,70).
    expect({ x: e.x2, y: e.y2 }).toEqual({ x: 100, y: 70 });
    // s is NOT selected, but its endpoint 1 shared e's corner → must follow, or the
    // room tears at (100,80). The bug (attached from primary n only) left it behind.
    expect({ x: s.x1, y: s.y1 }).toEqual({ x: 100, y: 70 });
  });
});
