import { load, dump } from "js-yaml";
import type { FloorplanCardConfig } from "./types";

export type ValidationResult =
  | { ok: true; config: FloorplanCardConfig }
  | { ok: false; errors: string[] };

type Errs = string[];
type Check = (v: unknown, path: string) => Errs;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const e = (path: string, msg: string): Errs => [`${path}: ${msg}`];

const num: Check = (v, p) => (isNum(v) ? [] : e(p, "expected a number"));
const posNum: Check = (v, p) => (isNum(v) && v > 0 ? [] : e(p, "expected a positive number"));
const str: Check = (v, p) => (typeof v === "string" ? [] : e(p, "expected a string"));
const bool: Check = (v, p) => (typeof v === "boolean" ? [] : e(p, "expected a boolean"));
const oneOf =
  (...vals: unknown[]): Check =>
  (v, p) =>
    vals.includes(v) ? [] : e(p, `expected one of: ${vals.map(String).join(", ")}`);
const arrayOf =
  (c: Check): Check =>
  (v, p) =>
    Array.isArray(v) ? v.flatMap((it, i) => c(it, `${p}[${i}]`)) : e(p, "expected a list");
const point: Check = (v, p) =>
  Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) ? [] : e(p, "expected [x, y]");

/** required fields + optional fields; unknown keys are allowed (forward-compat). */
const shape =
  (req: Record<string, Check>, opt: Record<string, Check> = {}): Check =>
  (v, p) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return e(p, "expected an object");
    const o = v as Record<string, unknown>;
    const errs: Errs = [];
    for (const [k, c] of Object.entries(req)) {
      if (o[k] === undefined) errs.push(...e(`${p}.${k}`, "is required"));
      else errs.push(...c(o[k], `${p}.${k}`));
    }
    for (const [k, c] of Object.entries(opt)) if (o[k] !== undefined) errs.push(...c(o[k], `${p}.${k}`));
    return errs;
  };

const ITEM_KINDS = ["light","switch","sensor","binary_sensor","climate","cover","media_player","fan","camera","lock","humidifier","vacuum","generic"];
const FURNITURE_TYPES = ["table","roundTable","desk","chair","sofa","bed","wardrobe","rug","plant","fridge","stove","sink","toilet","stairs","tv","washer","dryer","dishwasher","waterHeater","airHandler","bathtub","vanity","sectional","armchair","bench","crib","coffeeTable","nightstand","dresser","bookshelf","cabinet","microwave","shower","bidet","fireplace","ceilingFan","ceilingLight","lamp","coffeeMaker","toaster","rangeHood","smartSpeaker"];

const wall = shape({ id: str, x1: num, y1: num, x2: num, y2: num });
const opening = shape(
  { id: str, type: oneOf("door", "window"), x: num, y: num, length: num, angle: num },
  { motion: oneOf("swing", "slide", "roll", "fold"), entity: str, activeColor: str }
);
// A conditional-style rule. Every field is optional; a bad shape here otherwise
// reaches the render/lights path unchecked (where a non-array `stateStyles` threw).
const stateStyle = shape(
  {},
  {
    entity: str, state: str, state_not: str, above: num, below: num,
    icon: str, color: str, animation: oneOf("none", "pulse", "blink"),
  }
);
const stateStyles = arrayOf(stateStyle);
// A polygon that actually encloses area: fewer than 3 points is a degenerate
// "room" that scatters no devices and draws nothing.
const polyPoints: Check = (v, p) => {
  if (!Array.isArray(v)) return e(p, "expected a list of [x, y] points");
  const errs = v.flatMap((pt, i) => point(pt, `${p}[${i}]`));
  if (v.length < 3) errs.push(...e(p, "a room needs at least 3 points"));
  return errs;
};

const item = shape(
  { id: str, x: num, y: num, kind: oneOf(...ITEM_KINDS) },
  {
    entity: str, secondaryEntity: str, name: str, icon: str, size: num, angle: num,
    showState: bool, showIcon: bool, powerEntity: str, stateStyles,
  }
);
const text = shape({ id: str, x: num, y: num, text: str }, { size: num, color: str, angle: num });
const furniture = shape(
  { id: str, type: oneOf(...FURNITURE_TYPES), x: num, y: num, w: num, h: num },
  { angle: num, entity: str, secondaryEntity: str, showState: bool, stateStyles }
);
const tracker = shape({ id: str, x: num, y: num, w: num, h: num }, { angle: num });
const room = shape(
  { id: str, points: polyPoints },
  { name: str, areaId: str, fill: str, fillOpacity: num, tempEntity: str, stateStyles },
);
const AWARENESS_KINDS = ["motion", "safety"];
const awarenessMarker = shape({ id: str, x: num, y: num, entity: str, kind: oneOf(...AWARENESS_KINDS) });

const elementLists = {
  walls: arrayOf(wall),
  openings: arrayOf(opening),
  items: arrayOf(item),
  texts: arrayOf(text),
  furniture: arrayOf(furniture),
  trackers: arrayOf(tracker),
  rooms: arrayOf(room),
  awareness: arrayOf(awarenessMarker),
};

const floor = shape(
  { id: str },
  // The card coerces any number to the nearest quarter turn (normalizeRotation),
  // so accept any number here rather than rejecting e.g. 45 that the card renders.
  { name: str, haFloor: str, image: str, imageOpacity: num, imageLocked: bool, rotation: num, ...elementLists }
);

const features = shape(
  {},
  {
    lightsLayer: bool, thermalLayer: bool, awarenessLayer: bool, energyLayer: bool,
    mediaNowPlaying: bool, roomTapScenes: bool, radialControls: bool,
    autoPopulateArea: bool, backgroundTrace: bool, dayNightTheme: bool,
  }
);

const config = shape(
  {},
  {
    type: str, title: str, width: posNum, height: posNum, grid: num, snap: num,
    background: str, dayNightEntity: str, defaultFloor: str, floors: arrayOf(floor), features, ...elementLists,
  }
);

export function validateConfig(raw: unknown): ValidationResult {
  const errors = config(raw, "config");
  return errors.length ? { ok: false, errors } : { ok: true, config: raw as FloorplanCardConfig };
}

/** Parse (YAML, a superset of JSON) then validate. A parse error is one error, not a throw. */
export function parseAndValidate(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = load(text);
  } catch (err) {
    return { ok: false, errors: [`Could not parse: ${(err as Error).message}`] };
  }
  return validateConfig(parsed);
}

/** Serialize a config to YAML for export (HA's config format). */
export function configToText(config: FloorplanCardConfig): string {
  return dump(config, { noRefs: true, lineWidth: 120 });
}
