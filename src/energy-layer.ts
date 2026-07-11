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
