// @vitest-environment jsdom
/**
 * #33 rotation, dashboard-footprint half.
 *
 * The PR rotates the *stage* to portrait at 90°/270° but `getGridOptions()` and
 * `getCardSize()` returned constant landscape values regardless — so the card
 * tells Home Assistant it wants a landscape cell while displaying portrait, and
 * the plan overflows or is squashed until the user hand-resizes. HA calls both on
 * the card *instance*, after setConfig.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { FloorplanCardConfig } from "./types";

async function cardWith(rotation: unknown) {
  const { FloorplanCard } = await import("./floorplan-card");
  const el = document.createElement("easy-floorplan-card") as InstanceType<typeof FloorplanCard>;
  el.setConfig({ type: "custom:easy-floorplan-card", width: 1000, height: 600, rotation } as unknown as FloorplanCardConfig);
  return el;
}

beforeAll(() => {
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});
afterEach(() => (document.body.innerHTML = ""));

describe("getGridOptions is rotation-aware", () => {
  it("landscape (0°) asks for a wide cell", async () => {
    const g = (await cardWith(0)).getGridOptions();
    expect(g.columns).toBeGreaterThan(g.rows);
    expect(g).toEqual({ columns: 12, rows: 8, min_columns: 6, min_rows: 4 });
  });

  it.each([90, 270])("%s° asks for a tall cell (rows > columns)", async (rot) => {
    const g = (await cardWith(rot)).getGridOptions();
    expect(g.rows).toBeGreaterThan(g.columns);
    expect(g.min_rows).toBeGreaterThan(g.min_columns);
  });

  it("180° stays landscape (aspect unchanged)", async () => {
    const g = (await cardWith(180)).getGridOptions();
    expect(g.columns).toBeGreaterThan(g.rows);
  });

  it("a non-quarter rotation normalises to 0 → landscape", async () => {
    expect((await cardWith(45)).getGridOptions().columns).toBeGreaterThan(
      (await cardWith(45)).getGridOptions().rows
    );
  });
});

describe("getCardSize grows when the plan turns portrait", () => {
  it("is taller at 90°/270° than at 0°", async () => {
    const flat = (await cardWith(0)).getCardSize();
    expect((await cardWith(90)).getCardSize()).toBeGreaterThan(flat);
    expect((await cardWith(270)).getCardSize()).toBeGreaterThan(flat);
    expect((await cardWith(180)).getCardSize()).toBe(flat);
  });
});
