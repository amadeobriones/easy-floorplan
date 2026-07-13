import type { ItemKind, Room, ActionConfig } from "./types";
import { kindFromEntity } from "./render";
import { actionForGesture } from "./actions";

/** A Home Assistant area-registry entry (the subset this card uses). */
export interface HaAreaInfo {
  area_id: string;
  name: string;
  floor_id?: string | null;
}

/** List HA areas from a `hass` object, sorted by name. `[]` when absent. */
export function haAreasOf(hass: unknown): HaAreaInfo[] {
  const areas = (hass as { areas?: Record<string, HaAreaInfo> } | null | undefined)?.areas;
  if (!areas || typeof areas !== "object") return [];
  return Object.values(areas)
    .filter((a): a is HaAreaInfo => !!a && typeof a.area_id === "string" && typeof a.name === "string")
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface EntityReg {
  area_id?: string | null;
  device_id?: string | null;
  entity_category?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
}
interface DeviceReg { area_id?: string | null }

function registries(hass: unknown): { entities: Record<string, EntityReg>; devices: Record<string, DeviceReg> } {
  const h = hass as { entities?: Record<string, EntityReg>; devices?: Record<string, DeviceReg> } | null | undefined;
  return { entities: h?.entities ?? {}, devices: h?.devices ?? {} };
}

/**
 * Entity ids in an area. An entity is in the area by its own `area_id`, or —
 * when it has none — by its device's `area_id`. Entity-level wins. Sorted.
 */
export function entitiesInArea(hass: unknown, areaId: string): string[] {
  const { entities, devices } = registries(hass);
  const out: string[] = [];
  for (const [id, e] of Object.entries(entities)) {
    if (!e) continue;
    const own = e.area_id;
    const inArea =
      own === areaId || (own == null && !!e.device_id && devices[e.device_id]?.area_id === areaId);
    if (inArea) out.push(id);
  }
  return out.sort();
}

/** Sentinel action value: the room "toggle all lights in this room's area" convenience (2a). */
export const TOGGLE_AREA_LIGHTS_ACTION = "toggle-area-lights";

/** Light entities (domain `light.*`) in an area — the room "toggle area lights" convenience. */
export function lightsInArea(hass: unknown, areaId: string): string[] {
  return entitiesInArea(hass, areaId).filter((id) => id.startsWith("light."));
}

export type RoomActionResolution =
  | { kind: "toggle-lights"; entityIds: string[] }
  | { kind: "generic"; config: ActionConfig | undefined };

/**
 * Resolve a room gesture (tap/hold/double_tap) into either the built-in
 * "toggle area lights" convenience or a generic {@link ActionConfig} for
 * `executeAction`. Pure and registry-driven, so the room-tap behaviour is
 * fully unit-testable without mounting the card.
 */
export function resolveRoomAction(
  room: {
    tap_action?: ActionConfig;
    hold_action?: ActionConfig;
    double_tap_action?: ActionConfig;
    areaId?: string;
  },
  gesture: "tap" | "hold" | "double_tap",
  hass: unknown,
): RoomActionResolution {
  const config = actionForGesture(
    { tap_action: room.tap_action, hold_action: room.hold_action, double_tap_action: room.double_tap_action },
    gesture,
  );
  if (config?.action === TOGGLE_AREA_LIGHTS_ACTION) {
    return { kind: "toggle-lights", entityIds: room.areaId ? lightsInArea(hass, room.areaId) : [] };
  }
  return { kind: "generic", config };
}

export interface Point { x: number; y: number }

/**
 * `n` points scattered inside a polygon's bounding box, on a near-square
 * grid, inset by `gap` of each side. Pure and deterministic — same inputs,
 * same output, no Math.random — so it's safe to unit-test and to call on
 * every render. Uses the bbox rather than true point-in-polygon containment:
 * good enough for "stays within bounds" (an L-shaped room's scatter can sit
 * in its bbox's empty notch) and keeps this O(n) instead of rejection-
 * sampling against polygon edges.
 */
export function scatterInPolygon(
  points: Array<[number, number]>,
  n: number,
  gap = 0.15
): Point[] {
  if (n <= 0 || !points.length) return [];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const w = maxX - minX;
  const h = maxY - minY;
  const mx = w * gap;
  const my = h * gap;
  const innerW = w - 2 * mx;
  const innerH = h - 2 * my;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = minX + mx + (cols === 1 ? innerW / 2 : (innerW * c) / (cols - 1));
    const y = minY + my + (rows === 1 ? innerH / 2 : (innerH * r) / (rows - 1));
    out.push({ x: Math.round(x), y: Math.round(y) });
  }
  return out;
}

const SKIP_CATEGORY = new Set(["diagnostic", "config"]);

/**
 * The placeable, primary entities in an area that are not already on the plan,
 * each with a grid position inside the room. Deterministic (sorted, no random);
 * the caller assigns the id and item defaults.
 */
export function devicesToAdd(
  hass: unknown,
  areaId: string,
  room: Room,
  placed: Set<string>
): Array<{ entity: string; x: number; y: number; kind: ItemKind }> {
  const { entities } = registries(hass);
  const ids = entitiesInArea(hass, areaId).filter((id) => {
    if (placed.has(id)) return false;
    if (kindFromEntity(id) === "generic") return false;
    const e = entities[id];
    if (e?.entity_category && SKIP_CATEGORY.has(e.entity_category)) return false;
    if (e?.hidden_by || e?.disabled_by) return false;
    return true;
  });
  const pts = scatterInPolygon(room.points, ids.length);
  // A room with no polygon (empty `points`) yields no scatter points; place only
  // as many devices as we have positions for rather than dereferencing past the end.
  return ids
    .slice(0, pts.length)
    .map((entity, i) => ({ entity, x: pts[i].x, y: pts[i].y, kind: kindFromEntity(entity) }));
}
