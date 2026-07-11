import { svg, type SVGTemplateResult } from "lit";
import type { FloorplanCardConfig } from "./types";
import { getFloors } from "./types";
import type { LayerRenderCtx, LiveLayer } from "./layers";
import { LIVE_LAYERS } from "./layers";
import { isMarkerTripped, renderAwarenessMarker } from "./awareness";

/** Every awareness marker's entity, across all floors -- what the card must
 * watch for this layer to redraw when a sensor changes state. */
function awarenessWatchedEntities(c: FloorplanCardConfig): string[] {
  const ids: string[] = [];
  for (const f of getFloors(c)) {
    for (const m of f.awareness ?? []) ids.push(m.entity);
  }
  return ids;
}

/** The active floor's awareness markers, each resolved against `hass` and
 * drawn via renderAwarenessMarker. Empty floor -> empty svg (no group). */
function renderAwarenessLayer(ctx: LayerRenderCtx): SVGTemplateResult {
  const markers = ctx.floor.awareness ?? [];
  if (!markers.length) return svg``;
  return svg`<g class="fp-awareness" pointer-events="none">
    ${markers.map((m) =>
      renderAwarenessMarker(m, isMarkerTripped(m, ctx.hass?.states[m.entity]?.state)),
    )}
  </g>`;
}

export const awarenessLayer: LiveLayer = {
  id: "awarenessLayer",
  label: "Awareness",
  icon: "mdi:motion-sensor",
  render: renderAwarenessLayer,
  watched: awarenessWatchedEntities,
};

// Registration side effect. Guarded so importing this module more than once
// in the same process (e.g. from more than one entry point) never double-adds
// the layer to the shared registry.
if (!LIVE_LAYERS.some((l) => l.id === "awarenessLayer")) {
  LIVE_LAYERS.push(awarenessLayer);
}
