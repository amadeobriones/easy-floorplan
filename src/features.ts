import type { FeaturesConfig } from "./types";

export type FeatureName = keyof FeaturesConfig;

export const FEATURE_DEFAULTS: Required<FeaturesConfig> = {
  thermalLayer: false, awarenessLayer: false, energyLayer: false,
  radialControls: false,
};

export function featureEnabled(
  c: { features?: FeaturesConfig } | undefined,
  name: FeatureName,
): boolean {
  return c?.features?.[name] ?? FEATURE_DEFAULTS[name];
}

export const FEATURE_META: ReadonlyArray<{ name: FeatureName; label: string; help: string }> = [
  { name: "thermalLayer", label: "Climate layer", help: "Shade rooms warm/cool by temperature." },
  { name: "awarenessLayer", label: "Awareness layer", help: "Motion pings and safety alerts." },
  { name: "energyLayer", label: "Energy layer", help: "Colour devices by live power draw." },
  { name: "radialControls", label: "Long-press controls", help: "Inline brightness/colour/thermostat on long-press." },
];
