import { svg, type SVGTemplateResult } from "lit";
import type { AwarenessMarker, OverlayScale } from "./types";
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
 *
 * `scale` is threaded through to renderRipple (upstream #148) so the marker
 * honours `overlayScale` like every other HTML overlay on the plan, rather
 * than staying pinned to a fixed on-screen size. The foreignObject itself is
 * native SVG in canvas units and needs no such treatment.
 */
function renderMotionMarker(
  marker: AwarenessMarker,
  tripped: boolean,
  scale: OverlayScale,
): SVGTemplateResult {
  const half = AWARENESS_RIPPLE_SIZE / 2;
  return svg`
    <foreignObject x=${marker.x - half} y=${marker.y - half}
                   width=${AWARENESS_RIPPLE_SIZE} height=${AWARENESS_RIPPLE_SIZE}>
      ${renderRipple(
        tripped,
        "var(--fp-awareness-motion-color, var(--primary-color, #03a9f4))",
        AWARENESS_RIPPLE_SIZE,
        3,
        scale,
      )}
    </foreignObject>`;
}

const SAFETY_MARKER_RADIUS = 10;

/**
 * A safety marker: a small dim dot at rest, or a red/alert dot blinking once
 * its sensor trips. `fp-awareness-blink` is this layer's own animation class
 * (not the old fork's furniture-namespaced `fp-furn-blink` -- this marker
 * isn't furniture, and every other furniture animation is being dropped from
 * this port in favor of upstream's `IconAnimation`/skins system). See the
 * `.fp-awareness-safety` / `.fp-awareness-safety-idle` / `.fp-awareness-blink`
 * rules and the `fp-awareness-blink` keyframe in floorplan-card.ts.
 */
function renderSafetyMarker(marker: AwarenessMarker, tripped: boolean): SVGTemplateResult {
  return svg`<circle
    class="${tripped ? "fp-awareness-safety fp-awareness-blink" : "fp-awareness-safety-idle"}"
    cx=${marker.x} cy=${marker.y} r=${SAFETY_MARKER_RADIUS} />`;
}

/**
 * Render one awareness marker, dispatching on its kind. `scale` only matters
 * to the motion marker's HTML ripple (see renderMotionMarker); the safety
 * marker is a plain SVG circle in canvas units and scales with the viewBox
 * on its own. Defaults to "fixed" -- the pre-#148 behaviour -- so existing
 * callers that render a marker without an overlay context keep working.
 */
export function renderAwarenessMarker(
  marker: AwarenessMarker,
  tripped: boolean,
  scale: OverlayScale = "fixed",
): SVGTemplateResult {
  return marker.kind === "motion"
    ? renderMotionMarker(marker, tripped, scale)
    : renderSafetyMarker(marker, tripped);
}
