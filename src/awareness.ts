import { svg, type SVGTemplateResult } from "lit";
import type { AwarenessMarker } from "./types";
import { DEFAULT_RIPPLE_SIZE } from "./types";
import { isEntityOn, renderRipple } from "./render";

/**
 * Whether a motion marker's entity currently reads as "movement seen".
 * Reuses the card's general on/open/home/playing test -- a motion
 * binary_sensor's "on" state IS "motion detected" in Home Assistant's own
 * wording.
 */
export function isMotionTripped(state: string | undefined): boolean {
  return isEntityOn(state);
}

/**
 * Literal state strings a safety sensor might report when it is alarming --
 * a leak (wet), smoke/gas (detected), a plain binary_sensor tripped (on), or
 * a door/window left open (open). Fails closed: an outage never alarms, only
 * a definite reading does -- same reasoning as entityIsActive and
 * trackerPresenceDetected in render.ts.
 */
const SAFETY_TRIPPED_STATES = new Set(["on", "detected", "wet", "open"]);

export function isSafetyTripped(state: string | undefined): boolean {
  if (state === undefined || state === "unavailable" || state === "unknown") return false;
  return SAFETY_TRIPPED_STATES.has(state);
}

/** Whether a marker's own entity is tripped, dispatching on its kind. */
export function isMarkerTripped(
  marker: Pick<AwarenessMarker, "kind">,
  state: string | undefined,
): boolean {
  return marker.kind === "motion" ? isMotionTripped(state) : isSafetyTripped(state);
}

/**
 * A motion marker's ripple, in canvas units rather than the fixed screen
 * pixels the per-item ripple display uses -- an awareness marker is a point
 * on the floor plan, so its ping should scale with the plan the way the
 * tracker's own rings do, not stay a fixed on-screen size regardless of
 * zoom. Reuses DEFAULT_RIPPLE_SIZE's numeric value as that canvas-unit
 * diameter.
 */
const AWARENESS_RIPPLE_SIZE = DEFAULT_RIPPLE_SIZE;

/**
 * renderRipple returns HTML (a div tree). To reuse it verbatim inside the
 * layer's required SVGTemplateResult, it is hosted in a foreignObject sized
 * and centred on the marker -- the standard way to embed HTML content
 * inside SVG.
 */
function renderMotionMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  const half = AWARENESS_RIPPLE_SIZE / 2;
  return svg`
    <foreignObject x=${marker.x - half} y=${marker.y - half}
                   width=${AWARENESS_RIPPLE_SIZE} height=${AWARENESS_RIPPLE_SIZE}>
      ${renderRipple(
        tripped,
        "var(--fp-awareness-motion-color, var(--primary-color, #03a9f4))",
        AWARENESS_RIPPLE_SIZE,
      )}
    </foreignObject>`;
}

const SAFETY_MARKER_RADIUS = 10;

/**
 * A safety marker: a small dim dot at rest, or a red/alert dot blinking with
 * the existing furniture blink animation (fp-furn-blink, defined in
 * floorplan-card.ts and editor.ts) once its sensor trips. See the
 * .fp-awareness-safety / .fp-awareness-safety-idle rules added alongside
 * that keyframe.
 */
function renderSafetyMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  return svg`<circle
    class="${tripped ? "fp-awareness-safety fp-furn-anim-blink" : "fp-awareness-safety-idle"}"
    cx=${marker.x} cy=${marker.y} r=${SAFETY_MARKER_RADIUS} />`;
}

/** Render one awareness marker, dispatching on its kind. */
export function renderAwarenessMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  return marker.kind === "motion"
    ? renderMotionMarker(marker, tripped)
    : renderSafetyMarker(marker, tripped);
}
