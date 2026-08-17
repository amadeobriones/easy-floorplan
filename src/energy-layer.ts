import { svg, type SVGTemplateResult } from "lit";
import type { FloorItem, FloorplanCardConfig, RenderHass } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";
import { LIVE_LAYERS } from "./layers";

export interface EnergyRampOpts {
  lowW: number;
  highW: number;
}

export const DEFAULT_ENERGY_RAMP: EnergyRampOpts = { lowW: 5, highW: 500 };

// Ramp endpoints. NEUTRAL = slate (idle); HOT = red (heavy draw).
const NEUTRAL: readonly [number, number, number] = [148, 163, 184];
const HOT: readonly [number, number, number] = [220, 38, 38];

const rgb = (c: readonly [number, number, number]): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// 0 at/below lowW, 1 at/above highW; NaN/Inf -> 0. Shared by colour + size ramps.
function rampT(watts: number, opts?: Partial<EnergyRampOpts>): number {
  if (!Number.isFinite(watts)) return 0;
  const lowW = opts?.lowW ?? DEFAULT_ENERGY_RAMP.lowW;
  const highW = opts?.highW ?? DEFAULT_ENERGY_RAMP.highW;
  if (watts <= lowW) return 0;
  if (highW <= lowW || watts >= highW) return watts >= highW ? 1 : 0;
  return (watts - lowW) / (highW - lowW);
}

export function parseWatts(state: string | undefined): number | undefined {
  if (state === undefined || state === "") return undefined;
  const n = Number(state);
  return Number.isFinite(n) ? n : undefined;
}

export function powerColor(watts: number, opts?: Partial<EnergyRampOpts>): string {
  const t = rampT(watts, opts);
  if (t <= 0) return rgb(NEUTRAL);
  if (t >= 1) return rgb(HOT);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return rgb([lerp(NEUTRAL[0], HOT[0]), lerp(NEUTRAL[1], HOT[1]), lerp(NEUTRAL[2], HOT[2])]);
}

export function powerCueBump(
  watts: number,
  maxBumpPx = 10,
  opts?: Partial<EnergyRampOpts>,
): number {
  return Math.round(rampT(watts, opts) * maxBumpPx);
}

const CUE_BASE_R = 22; // SVG user units; roughly the badge footprint

/** A single item's power cue: a soft halo under its badge, coloured/sized by
 * live wattage. An unavailable/non-numeric reading draws neutral at low
 * opacity rather than lying about draw or skipping the item entirely. */
function renderEnergyCue(it: FloorItem & { powerEntity: string }, hass: RenderHass): SVGTemplateResult {
  const watts = parseWatts(hass.states[it.powerEntity]?.state);
  const color = powerColor(watts ?? 0);
  const r = CUE_BASE_R + powerCueBump(watts ?? 0);
  const opacity = watts !== undefined && watts > DEFAULT_ENERGY_RAMP.lowW ? 0.55 : 0.2;
  return svg`<circle cx=${it.x} cy=${it.y} r=${r} fill=${color} opacity=${opacity} />`;
}

/**
 * The energy live layer (roadmap 1e): overlays a power-coloured halo under
 * every item that carries a `powerEntity`. Rendered and gated entirely by the
 * layer framework (src/layers.ts) once registered -- this object only needs
 * to answer "what do you draw" and "what do you watch".
 */
export const energyLayer: LiveLayer = {
  id: "energyLayer",
  label: "Energy",
  icon: "mdi:flash",
  render(ctx: LayerRenderCtx): SVGTemplateResult {
    const items = ctx.floor.items.filter(
      (it): it is FloorItem & { powerEntity: string } => !!it.powerEntity,
    );
    if (!items.length) return svg``;
    return svg`<g class="fp-energy-layer" pointer-events="none">
      ${items.map((it) => renderEnergyCue(it, ctx.hass))}
    </g>`;
  },
  watched(c: FloorplanCardConfig): string[] {
    const ids = new Set<string>();
    for (const f of getFloors(c)) {
      for (const it of f.items) {
        if (it.powerEntity) ids.add(it.powerEntity);
      }
    }
    return [...ids];
  },
};

// Registration side effect. Guarded so importing this module more than once
// in the same process (e.g. from more than one entry point) never double-adds
// the layer to the shared registry.
if (!LIVE_LAYERS.some((l) => l.id === "energyLayer")) {
  LIVE_LAYERS.push(energyLayer);
}
