import type { SVGTemplateResult } from "lit";
import type { FloorplanCardConfig, Floor, RenderHass } from "./types";
import { featureEnabled, type FeatureName } from "./features";

export interface LayerRenderCtx {
  hass: RenderHass;
  config: FloorplanCardConfig;
  floor: Floor;
}

export interface LiveLayer {
  id: FeatureName;
  label: string;
  icon: string;
  render(ctx: LayerRenderCtx): SVGTemplateResult;
  watched(c: FloorplanCardConfig): string[];
}

export const LIVE_LAYERS: LiveLayer[] = [];

export function enabledLayers(c: FloorplanCardConfig): LiveLayer[] {
  return LIVE_LAYERS.filter((l) => featureEnabled(c, l.id));
}

export function layerWatchedEntities(c: FloorplanCardConfig): Set<string> {
  return new Set(enabledLayers(c).flatMap((l) => [...l.watched(c)]));
}
