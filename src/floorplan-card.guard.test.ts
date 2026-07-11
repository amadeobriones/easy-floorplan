import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { collectWatchedEntities } from "./render";
import { LIVE_LAYERS, layerWatchedEntities } from "./layers";
import type { FloorplanCardConfig } from "./types";

const src = readFileSync(fileURLToPath(new URL("./floorplan-card.ts", import.meta.url)), "utf8");

describe("floorplan-card source guards", () => {
  it("keeps preserveAspectRatio=none and never regresses to meet", () => {
    expect(src).toContain('preserveAspectRatio="none"');
    expect(src).not.toContain('preserveAspectRatio="meet"');
  });

  it("wraps the svg and the overlay in a single .plate", () => {
    expect(src).toContain('class="plate');
  });

  it("gates the furniture light glow behind the lightsLayer feature flag", () => {
    expect(src).toContain('featureEnabled(c, "lightsLayer")');
  });

  it("registers the lights layer with the live-layer framework", () => {
    expect(src).toContain('import "./lights"');
  });

  it("gates the room hit-polygon on roomIsTappable and reuses the furniture action wiring (2a)", () => {
    expect(src).toContain("roomIsTappable(c, r)");
    expect(src).toContain('class="fp-room-tap"');
    expect(src).toContain('class="fp-room-hit"');
    expect(src).toContain("resolveRoomAction(");
    expect(src).toContain("_handleRoomAction");
  });

  it("styles the room hit polygon as an invisible, clickable overlay (2a)", () => {
    expect(src).toContain(".fp-room-tap {");
    expect(src).toContain(".fp-room-hit {");
  });

  it("gates the night overlay behind featureEnabled(dayNightTheme)", () => {
    expect(src).toContain('featureEnabled(c, "dayNightTheme")');
    expect(src).toContain("fp-night-overlay");
  });

  it("keeps the night overlay non-interactive (pointer-events: none)", () => {
    const overlayRule = src.slice(src.indexOf(".fp-night-overlay {"), src.indexOf(".fp-night-overlay {") + 200);
    expect(overlayRule).toContain("pointer-events: none");
  });
});

// Task 2 (layer framework): the card's watched-entity set must union in
// enabled live layers' entities, so a layer-only entity still triggers
// shouldUpdate. floorplan-card.ts can't be imported under Vitest's node
// environment (Lit's ActionHandler extends HTMLElement, which isn't
// polyfilled here — see the "probe" spike in task-2-report.md), so the wiring
// is proven two ways: a source guard that the card's setConfig calls both
// collectWatchedEntities and layerWatchedEntities on this._config, and a
// behavioural test of the exact union expression the card uses.
describe("floorplan-card watched-entity union (Task 2)", () => {
  it("setConfig folds layerWatchedEntities into the watched set alongside collectWatchedEntities", () => {
    expect(src).toMatch(/collectWatchedEntities\(this\._config\)/);
    expect(src).toMatch(/layerWatchedEntities\(this\._config\)/);
  });

  it("a disabled layer contributes nothing to the union; an enabled one does", () => {
    const fake = {
      id: "energyLayer" as const,
      label: "E",
      icon: "mdi:flash",
      render: () => "" as unknown as ReturnType<(typeof LIVE_LAYERS)[number]["render"]>,
      watched: () => ["sensor.pwr"],
    };
    LIVE_LAYERS.push(fake);
    try {
      const config = { type: "x", width: 10, height: 10 } as unknown as FloorplanCardConfig;
      const unionOf = (c: FloorplanCardConfig) =>
        new Set([...collectWatchedEntities(c), ...layerWatchedEntities(c)]);

      expect(unionOf(config).has("sensor.pwr")).toBe(false);

      const enabled = { ...config, features: { energyLayer: true } } as FloorplanCardConfig;
      expect(unionOf(enabled).has("sensor.pwr")).toBe(true);
    } finally {
      LIVE_LAYERS.pop();
    }
  });
});
