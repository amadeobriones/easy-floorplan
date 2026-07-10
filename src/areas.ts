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
