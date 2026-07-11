import { svg, type SVGTemplateResult } from "lit";
import type { Room, RenderHass, StateStyle, FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import { lightVisual, stateStyleMatches } from "./render";
import type { LiveLayer, LayerRenderCtx } from "./layers";
import { LIVE_LAYERS } from "./layers";

/**
 * Default extra opacity, at full brightness, this wash adds on top of whatever
 * `renderRoom`'s own `color: "rgb"` tint already drew (that tint is fixed-opacity
 * -- see docs/superpowers/plans/2026-07-10-lights-layer.md for why this is a
 * separate additive overlay rather than a change to renderRoom itself).
 */
export const ROOM_LIGHT_WASH_OPACITY = 0.25;

/**
 * A room has no entity of its own (unlike furniture/items), so a `color: "rgb"`
 * rule that follows a light must name it explicitly -- this mirrors
 * `resolveStateStyle`'s `rule.entity ?? ownEntity` with `ownEntity` always
 * undefined for a room.
 */
function roomLightRule(rules: StateStyle[] | undefined): StateStyle | undefined {
  return rules?.find((r) => r.color === "rgb" && r.entity);
}

/**
 * The brightness-aware wash for one room, or `""` when the room is not
 * light-bound, its rule does not currently match, or the light has no
 * brightness reading yet.
 */
export function renderRoomLightWash(r: Room, hass: RenderHass | undefined): SVGTemplateResult | "" {
  const rule = roomLightRule(r.stateStyles);
  if (!rule?.entity) return "";
  const st = hass?.states[rule.entity];
  if (!stateStyleMatches(rule, st)) return "";
  const visual = lightVisual(st);
  if (!visual.color || visual.intensity === undefined) return "";
  const pts = r.points.map(([x, y]) => `${x},${y}`).join(" ");
  return svg`<polygon class="fp-room-light-wash" points=${pts} fill=${visual.color}
                       fill-opacity=${ROOM_LIGHT_WASH_OPACITY * visual.intensity} />`;
}

/** Every entity a floor's rooms follow via a `color: "rgb"` rule. */
function roomLightEntities(floor: { rooms?: Room[] }): string[] {
  const out: string[] = [];
  for (const r of floor.rooms ?? []) {
    const rule = roomLightRule(r.stateStyles);
    if (rule?.entity) out.push(rule.entity);
  }
  return out;
}

/**
 * The room-tint half of the lights layer (1b) -- see
 * docs/superpowers/plans/2026-07-10-lights-layer.md. The furniture-glow half
 * lives directly in renderFurniture/floorplan-card.ts, not here: a lamp/
 * ceilingLight is already a single entity-bound piece with its entity already
 * watched, so it needs no layer machinery. A room, in contrast, has no entity
 * of its own to watch, which is exactly what a LiveLayer's `watched()` is for.
 */
export const lightsLayer: LiveLayer = {
  id: "lightsLayer",
  label: "Lights",
  icon: "mdi:lightbulb-multiple-outline",
  render(ctx: LayerRenderCtx): SVGTemplateResult {
    const washes = (ctx.floor.rooms ?? [])
      .map((r) => renderRoomLightWash(r, ctx.hass))
      .filter((t): t is SVGTemplateResult => t !== "");
    return washes.length ? svg`<g class="fp-lights-layer">${washes}</g>` : svg``;
  },
  watched(c: FloorplanCardConfig): string[] {
    const ids = new Set<string>();
    for (const f of getFloors(c)) for (const id of roomLightEntities(f)) ids.add(id);
    return [...ids];
  },
};

LIVE_LAYERS.push(lightsLayer);
