import type { ItemKind, Room } from "./types";
import { kindFromEntity } from "./render";

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

export interface Bbox { minX: number; minY: number; maxX: number; maxY: number }

/** `count` points on a near-square grid inside `bbox`, inset by `gap` of each side. */
export function gridLayout(count: number, bbox: Bbox, gap = 0.15): Array<[number, number]> {
  if (count <= 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const mx = w * gap;
  const my = h * gap;
  const innerW = w - 2 * mx;
  const innerH = h - 2 * my;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = bbox.minX + mx + (cols === 1 ? innerW / 2 : (innerW * c) / (cols - 1));
    const y = bbox.minY + my + (rows === 1 ? innerH / 2 : (innerH * r) / (rows - 1));
    out.push([Math.round(x), Math.round(y)]);
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
  const xs = room.points.map((p) => p[0]);
  const ys = room.points.map((p) => p[1]);
  const bbox = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  const pts = gridLayout(ids.length, bbox);
  return ids.map((entity, i) => ({ entity, x: pts[i][0], y: pts[i][1], kind: kindFromEntity(entity) }));
}
