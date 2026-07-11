import { svg, type SVGTemplateResult } from "lit";
import type { Room } from "./types";

/** A comfort band: `min`/`max` are where the gradient saturates to pure
 * cold/hot; `mid` is the "neutral" comfort point the room reads as unstyled. */
export interface ThermalRange {
  min: number;
  mid: number;
  max: number;
}

/** Celsius. 16 = cold, 21 = comfortable, 27 = hot -- a generic home comfort band. */
export const DEFAULT_THERMAL_RANGE: ThermalRange = { min: 16, mid: 21, max: 27 };

type Rgb = [number, number, number];

// Material Design blue 500 / blue-grey 200 / red 500 -- cold, neutral, hot.
const COLD_RGB: Rgb = [33, 150, 243];
const NEUTRAL_RGB: Rgb = [176, 190, 197];
const HOT_RGB: Rgb = [244, 67, 54];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * A temperature reading (Celsius) as a CSS colour on a blue (cold) -> neutral
 * (comfort midpoint) -> red (hot) gradient. Clamps outside `[min, max]` so an
 * outlier reading saturates instead of extrapolating into nonsense colours.
 */
export function tempColor(celsius: number, range: ThermalRange = DEFAULT_THERMAL_RANGE): string {
  const { min, mid, max } = range;
  const c = Math.max(min, Math.min(max, celsius));
  if (c <= mid) {
    const span = mid - min;
    const t = span === 0 ? 1 : (c - min) / span;
    return rgbToCss(lerpRgb(COLD_RGB, NEUTRAL_RGB, t));
  }
  const span = max - mid;
  const t = span === 0 ? 1 : (c - mid) / span;
  return rgbToCss(lerpRgb(NEUTRAL_RGB, HOT_RGB, t));
}

/** Overlay opacity: visible over a room's own fill/stateStyles colour without
 * washing it out -- this is a second polygon stacked on top, not a replacement. */
export const THERMAL_FILL_OPACITY = 0.28;

/** A room's temperature tint as its own SVG polygon, stacked over the room's
 * existing fill. Never a click target -- it is decoration over whatever the
 * room / items beneath it already handle. */
export function renderThermalOverlay(
  room: Room,
  celsius: number,
  range?: ThermalRange,
): SVGTemplateResult {
  const pts = room.points.map(([x, y]) => `${x},${y}`).join(" ");
  return svg`<polygon
    class="fp-thermal-room"
    points=${pts}
    fill=${tempColor(celsius, range)}
    fill-opacity=${THERMAL_FILL_OPACITY}
    pointer-events="none"
    style="transition: fill 0.6s ease;"
  />`;
}
