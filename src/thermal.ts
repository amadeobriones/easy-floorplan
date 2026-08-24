import { svg, type SVGTemplateResult } from "lit";
import type { Area, RenderHass, FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";
import { LIVE_LAYERS } from "./layers";
import { featureLabel } from "./features";

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

/** Overlay opacity: visible over a room's own fill/stateColor colour without
 * washing it out -- this is a second polygon stacked on top, not a replacement. */
export const THERMAL_FILL_OPACITY = 0.28;

/** A room's temperature tint as its own SVG polygon, stacked over the room's
 * existing fill. Never a click target -- it is decoration over whatever the
 * room / items beneath it already handle. */
export function renderThermalOverlay(
  area: Area,
  celsius: number,
  range?: ThermalRange,
): SVGTemplateResult {
  const pts = area.points.map((p) => `${p.x},${p.y}`).join(" ");
  return svg`<polygon
    class="fp-thermal-room"
    points=${pts}
    fill=${tempColor(celsius, range)}
    fill-opacity=${THERMAL_FILL_OPACITY}
    pointer-events="none"
    style="transition: fill 0.6s ease;"
  />`;
}

/** A finite numeric reading, or undefined for an outage/non-numeric state --
 * mirrors how the rest of this card fails closed on `unavailable`/`unknown`
 * (see the `numeric` guard inside matchStateRuleWith in src/render.ts, which
 * likewise refuses to match a threshold rule against a non-numeric reading)
 * rather than reading an outage as 0. */
/**
 * A room's temperature **in Celsius**, which is the only scale this layer's
 * range speaks ({@link DEFAULT_THERMAL_RANGE} is 16/21/27).
 *
 * The unit matters because the gradient clamps: a Fahrenheit reading taken at
 * face value is always past the 27 maximum, so every room in a Fahrenheit home
 * painted the same flat red and the layer looked broken rather than wrong. HA
 * gives the unit on the entity, so read it instead of assuming the house is
 * metric.
 */
function numericReading(hass: RenderHass | undefined, entityId: string): number | undefined {
  const entity = hass?.states[entityId];
  if (entity?.state === undefined) return undefined;
  const n = Number(entity.state);
  if (!Number.isFinite(n)) return undefined;
  const unit = (entity as { attributes?: Record<string, unknown> }).attributes?.unit_of_measurement;
  // Only °F is converted. Anything else -- °C, K, a bare number from a template
  // sensor -- is taken as Celsius, which is what this layer assumed all along.
  if (typeof unit === "string" && /^\s*°?\s*F\s*$/i.test(unit)) return ((n - 32) * 5) / 9;
  return n;
}

/**
 * The thermal / climate live layer (roadmap 1c): tints every room that carries
 * a `tempEntity` on a blue (cold) -> neutral -> red (hot) gradient. Rendered and
 * gated entirely by the layer framework (src/layers.ts) once registered --
 * this object only needs to answer "what do you draw" and "what do you watch".
 */
export const THERMAL_LAYER: LiveLayer = {
  id: "thermalLayer",
  // See awareness-layer.ts: the label is the feature's, not the layer's.
  label: featureLabel("thermalLayer"),
  icon: "mdi:thermometer",
  render(ctx: LayerRenderCtx): SVGTemplateResult {
    const areas = ctx.floor.areas ?? [];
    const overlays = areas
      .filter((a): a is Area & { tempEntity: string } => !!a.tempEntity)
      .map((a) => {
        const c = numericReading(ctx.hass, a.tempEntity);
        return c === undefined ? svg`` : renderThermalOverlay(a, c);
      });
    return svg`${overlays}`;
  },
  watched(c: FloorplanCardConfig): string[] {
    const ids = new Set<string>();
    for (const f of getFloors(c)) {
      for (const a of f.areas ?? []) {
        if (a.tempEntity) ids.add(a.tempEntity);
      }
    }
    return [...ids];
  },
};

// Registration side effect. Guarded so importing this module more than once
// in the same process (e.g. from more than one entry point) never double-adds
// the layer to the shared registry -- the same guard energy-layer.ts and
// awareness-layer.ts already carry, since all three push into one array.
if (!LIVE_LAYERS.some((l) => l.id === "thermalLayer")) {
  LIVE_LAYERS.push(THERMAL_LAYER);
}
