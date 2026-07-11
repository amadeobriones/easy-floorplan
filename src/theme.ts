/**
 * Day/night theming (roadmap 4a): a pure day/darkness reading off a sun (or
 * sun-like) entity, kept separate from floorplan-card.ts so it is testable
 * without a DOM. The card only calls this when
 * featureEnabled(config, "dayNightTheme") is true -- a disabled or unbound
 * plan never touches it.
 */

/** Default entity read for the day/night overlay; overridable via config.dayNightEntity. */
export const DEFAULT_SUN_ENTITY = "sun.sun";

/**
 * Elevation (degrees) at which the sun is past civil twilight -- full night
 * for the overlay's purposes. Real dusk/dawn softness lives between 0 and
 * this, in nightFactor.
 */
const CIVIL_TWILIGHT_ELEVATION = -6;

/** Peak opacity of the night wash at full darkness (never a black-out). */
export const NIGHT_MAX_OPACITY = 0.45;

/** A sun-like entity's numeric elevation attribute (degrees), or undefined. */
export function elevationOf(
  st: { attributes?: Record<string, unknown> } | undefined,
): number | undefined {
  const el = st?.attributes?.elevation;
  return typeof el === "number" ? el : undefined;
}

/**
 * Whether the plan should read as night.
 *
 * elevation is the precise signal when present: below the horizon is
 * elevation < 0. The coarser above_horizon / below_horizon state is the
 * fallback for a sun entity that does not carry elevation (or a stand-in
 * helper entity). A missing entity (both args undefined) always reads as
 * day -- the conservative default, matching the rest of the roadmap's
 * off-by-default posture: an absent signal can never make the plan darker
 * than intended.
 */
export function isNight(sunState: string | undefined, elevation?: number): boolean {
  if (typeof elevation === "number") return elevation < 0;
  return sunState === "below_horizon";
}

/**
 * 0 (full day) .. 1 (full night) darkness. With elevation known, night
 * eases in over civil twilight (0deg to CIVIL_TWILIGHT_ELEVATION) so the
 * wash fades in around sunset/sunrise instead of snapping on; state-only
 * input is a hard 0/1 step at the horizon.
 */
export function nightFactor(sunState: string | undefined, elevation?: number): number {
  if (typeof elevation === "number") {
    if (elevation >= 0) return 0;
    if (elevation <= CIVIL_TWILIGHT_ELEVATION) return 1;
    return elevation / CIVIL_TWILIGHT_ELEVATION;
  }
  return isNight(sunState, undefined) ? 1 : 0;
}
