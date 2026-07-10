import type { Rotation } from "./types";

/** Clamp any config value to one of the four quarter turns; anything else is 0. */
export function normalizeRotation(v: unknown): Rotation {
  return v === 90 || v === 180 || v === 270 ? v : 0;
}

/** The stage's display footprint: W/H at 0/180, swapped to H/W at 90/270. */
export function footprintRatio(w: number, h: number, rot: Rotation): [number, number] {
  return rot === 90 || rot === 270 ? [h, w] : [w, h];
}

/** The footprint as a CSS `aspect-ratio` value, e.g. "600 / 1000". */
export function stageAspect(w: number, h: number, rot: Rotation): string {
  const [fw, fh] = footprintRatio(w, h, rot);
  return `${fw} / ${fh}`;
}

/** The `.plate` rotation class. */
export function plateClass(rot: Rotation): "rot0" | "rot90" | "rot180" | "rot270" {
  return `rot${rot}` as "rot0" | "rot90" | "rot180" | "rot270";
}

/** Inline custom properties for the plate: the natural ratio and the rotation. */
export function plateVars(w: number, h: number, rot: Rotation): string {
  return `--fp-arw:${w / h};--fp-rot:${rot}deg;`;
}

/** Degrees to keep a badge or text upright: its own angle minus the plate rotation. */
export function counterRotate(baseAngle: number, rot: Rotation): number {
  return baseAngle - rot;
}
