import { load, dump } from "js-yaml";
import type { FeaturesConfig, FloorplanCardConfig } from "./types";
import { FEATURE_DEFAULTS } from "./features";

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
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * A key this card no longer reads. Unknown keys pass (forward-compat), but a
 * key we *used* to honour is different: silence there reads as "accepted",
 * and the config would go on doing nothing with no way to find out why. Used
 * as an `opt` entry, so it only fires when the key is actually present.
 */
const removed =
  (why: string): Check =>
  (_v, p) =>
    e(p, why);

/** required fields + optional fields; unknown keys are allowed (forward-compat). */
const shape =
  (req: Record<string, Check>, opt: Record<string, Check> = {}): Check =>
  (v, p) => {
    if (!isPlainObject(v)) return e(p, "expected an object");
    const o = v;
    const errs: Errs = [];
    for (const [k, c] of Object.entries(req)) {
      if (o[k] === undefined) errs.push(...e(`${p}.${k}`, "is required"));
      else errs.push(...c(o[k], `${p}.${k}`));
    }
    for (const [k, c] of Object.entries(opt)) if (o[k] !== undefined) errs.push(...c(o[k], `${p}.${k}`));
    return errs;
  };

const ITEM_KINDS = ["light","switch","sensor","binary_sensor","climate","cover","media_player","fan","camera","lock","humidifier","vacuum","generic"];

/**
 * A conditional-style rule shared by items/furniture/areas' `stateColor`
 * (StateColorRule in types.ts). `color` is the only required field; a rule
 * matches a threshold (`above`/`below`), a state check (`state`/`state_not`),
 * or neither (the default) — plus the fork's own `entity` override and
 * `animation`, which ride along on whichever condition matched.
 */
const stateColorRule = shape(
  { color: str },
  {
    above: num, below: num, state: str, state_not: str, icon: str,
    entity: str, animation: oneOf("auto", "none", "spin", "pulse"),
  }
);
const stateColorRules = arrayOf(stateColorRule);
// The pre-port fork's own conditional-rule list, replaced by `stateColor`
// (StateColorRule above) and read by nothing on this base. A saved v0.7.109
// config may still carry it, so say so rather than passing it through as an
// unknown key: every rule in it is inert, which is exactly the failure a
// validator exists to catch.
const stateStyles = removed(
  "stateStyles was replaced by stateColor — rename the key; its rules take the same above/below/state/state_not/color/icon fields"
);

const wall = shape({ id: str, x1: num, y1: num, x2: num, y2: num });
const opening = shape(
  { id: str, type: oneOf("door", "window"), x: num, y: num, length: num, angle: num },
  {
    // "roll" is a garage/shutter-style opening; "slide" a sliding door/window.
    motion: oneOf("swing", "slide", "roll"),
    entity: str, secondaryEntity: str, invert: bool, activeColor: str,
    flipH: bool, flipV: bool, sash: oneOf("single", "double"),
    shutterEntity: str, shutterStyle: oneOf("roll", "swing"), shutterInvert: bool,
    shutterActiveColor: str, shutterFlipV: bool, showShutterIcon: bool, shutterIcon: str,
    tapTarget: oneOf("opening", "shutter"),
    sliderStyle: oneOf("single", "bypass", "biparting", "biparting-bypass", "converging"),
  }
);
const item = shape(
  { id: str, x: num, y: num, kind: oneOf(...ITEM_KINDS) },
  {
    entity: str, secondaryEntity: str, attribute: str, secondaryAttribute: str,
    name: str, icon: str, size: num, angle: num,
    showState: bool, showName: bool, labelSize: num, showIcon: bool,
    badgeContent: oneOf("icon", "value", "none"), badgeEntity: oneOf("primary", "secondary"),
    hideWhenInactive: bool, display: oneOf("badge", "ripple", "iconRipple"),
    iconAnimation: oneOf("auto", "none", "spin", "pulse"),
    activeColor: str, rippleColor: str, rippleSize: num,
    glow: bool, glowRadius: num, glowColor: str,
    powerEntity: str, stateColor: stateColorRules, stateStyles,
  }
);
const text = shape({ id: str, x: num, y: num, text: str }, { size: num, color: str, angle: num });
// `showState`/`secondaryEntity` are deliberately absent: the Furniture
// interface declares neither, so neither is a field to bless. They fall
// through the unknown-key allowance like any other key we simply don't know.
const furniture = shape(
  { id: str, type: str, x: num, y: num, w: num, h: num },
  {
    hand: oneOf("left", "right"), angle: num, color: str,
    entity: str, stateColor: stateColorRules, activeColor: str, stateStyles,
  }
);
const tracker = shape({ id: str, x: num, y: num, w: num, h: num }, { angle: num });
// Area.points is a list of {x, y} objects (not [x, y] tuples). A polygon
// that actually encloses area: fewer than 3 points is a degenerate "room"
// that scatters no devices and draws nothing.
const areaPoint = shape({ x: num, y: num });
const areaPoints: Check = (v, p) => {
  if (!Array.isArray(v)) return e(p, "expected a list of {x, y} points");
  const errs = v.flatMap((pt, i) => areaPoint(pt, `${p}[${i}]`));
  if (v.length < 3) errs.push(...e(p, "an area needs at least 3 points"));
  return errs;
};
const area = shape(
  { id: str, points: areaPoints },
  {
    name: str, showName: bool, labelSize: num, color: str, opacity: num,
    haArea: str, filterEntities: bool, entity: str, stateColor: stateColorRules,
    activeColor: str, activeOpacity: num, borderColor: str, borderWidth: num,
    highlight: oneOf("fill", "border", "both"), tempEntity: str,
  }
);
const AWARENESS_KINDS = ["motion", "safety"];
const awarenessMarker = shape({ id: str, x: num, y: num, entity: str, kind: oneOf(...AWARENESS_KINDS) });

/**
 * The element lists a *legacy single-floor* config may carry at the top
 * level — exactly the seven `getFloors` wraps into its implicit floor
 * (types.ts). Awareness markers are deliberately not among them: `getFloors`
 * does not read a top-level `awareness`, so blessing one here would validate
 * a config whose markers never reach the canvas.
 */
const legacyElementLists = {
  walls: arrayOf(wall),
  openings: arrayOf(opening),
  items: arrayOf(item),
  texts: arrayOf(text),
  furniture: arrayOf(furniture),
  trackers: arrayOf(tracker),
  areas: arrayOf(area),
};

/** A floor carries the seven above plus its awareness markers. */
const elementLists = {
  ...legacyElementLists,
  awareness: arrayOf(awarenessMarker),
};

const floor = shape(
  { id: str },
  // The card coerces any number to the nearest quarter turn (normalizeRotation),
  // so accept any number here rather than rejecting e.g. 45 that the card renders.
  { name: str, haFloor: str, image: str, imageOpacity: num, rotation: num, ...elementLists }
);

/**
 * FeaturesConfig is a closed set (issue #35 follow-up). Unlike everything
 * else in this file, an unknown key here is rejected rather than passed
 * through — a typo'd or since-removed flag (the pre-port fork had ten)
 * should tell the user, not silently do nothing.
 *
 * Derived from {@link FEATURE_DEFAULTS} rather than hand-listed. That object
 * is typed `Required<FeaturesConfig>`, so adding a flag to the interface and
 * forgetting it here is a *compile* error in features.ts instead of a
 * runtime "unknown feature flag" on a config that is in fact correct — the
 * drift this list had already suffered once, when `autoPopulateArea` was
 * dropped and four separate files had to be edited by hand to keep up.
 */
const FEATURE_FLAGS = Object.keys(FEATURE_DEFAULTS) as (keyof FeaturesConfig)[];
const features: Check = (v, p) => {
  if (!isPlainObject(v)) return e(p, "expected an object");
  const errs: Errs = [];
  for (const k of FEATURE_FLAGS) if (v[k] !== undefined) errs.push(...bool(v[k], `${p}.${k}`));
  for (const k of Object.keys(v)) {
    if ((FEATURE_FLAGS as readonly string[]).includes(k)) continue;
    // Removed in the v1.4.1 port: upstream's own "Add all devices in this HA
    // area" button is unconditional now, so the flag that used to gate it
    // has nothing left to gate. Name the specific reason rather than making
    // a config saved before the removal (e.g. an older exported YAML) hit
    // the generic "unknown feature flag" with no explanation.
    if (k === "autoPopulateArea") {
      errs.push(
        ...e(`${p}.${k}`, "autoPopulateArea was removed: adding an HA area's devices is now always available")
      );
      continue;
    }
    errs.push(...e(`${p}.${k}`, "unknown feature flag"));
  }
  return errs;
};

/** `FloorplanCardConfig.symbols` values are untrusted geometry `normalizeSymbol` validates on the way in; just require an object here. */
const symbols: Check = (v, p) => (isPlainObject(v) ? [] : e(p, "expected an object"));

const config = shape(
  {},
  {
    type: str, title: str, width: posNum, height: posNum, grid: num, snap: num, rotation: num,
    skin: str, overlayScale: oneOf("fixed", "plan"), background: str, showDeadSpaces: bool,
    sunDimming: bool, sunBrightnessMin: num, sunBrightnessMax: num,
    pressEffect: oneOf("scale", "ripple", "flash", "none"),
    defaultFloor: str, floors: arrayOf(floor), features, symbols, ...legacyElementLists,
    // Awareness markers only ever reach the canvas from inside a floor: the
    // legacy single-floor fallback in `getFloors` builds its floor from the
    // seven lists above and no others. A top-level `awareness:` is therefore
    // read by nothing — and it *was* honoured by the pre-port fork, so a
    // config that has one is following instructions that used to be true.
    awareness: removed("awareness markers live on a floor, not at the top level — move them under floors: [{ id: …, awareness: [...] }]"),
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
