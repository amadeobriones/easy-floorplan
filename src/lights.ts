import { svg, type SVGTemplateResult } from "lit";
import type { Room, RenderHass, StateStyle } from "./types";
import { lightVisual, stateStyleMatches } from "./render";

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
