import type { FeaturesConfig } from "./types";

export type FeatureName = keyof FeaturesConfig;

export const FEATURE_DEFAULTS: Required<FeaturesConfig> = {
  lightsLayer: false, thermalLayer: false, awarenessLayer: false, energyLayer: false,
  mediaNowPlaying: false, roomTapScenes: false, radialControls: false,
  autoPopulateArea: false, backgroundTrace: false, dayNightTheme: false,
};

export function featureEnabled(
  c: { features?: FeaturesConfig } | undefined,
  name: FeatureName,
): boolean {
  return c?.features?.[name] ?? FEATURE_DEFAULTS[name];
}

export const FEATURE_META: ReadonlyArray<{ name: FeatureName; label: string; help: string }> = [
  { name: "lightsLayer", label: "Lights layer", help: "Tint rooms/lamps to a bulb's real colour and brightness." },
  { name: "thermalLayer", label: "Climate layer", help: "Shade rooms warm/cool by temperature." },
  { name: "awarenessLayer", label: "Awareness layer", help: "Motion pings and safety alerts." },
  { name: "energyLayer", label: "Energy layer", help: "Colour devices by live power draw." },
  { name: "mediaNowPlaying", label: "Media now-playing", help: "Show a now-playing cue on TVs/speakers." },
  { name: "roomTapScenes", label: "Tap room to control", help: "Tap a room to run a scene or toggle its lights." },
  { name: "radialControls", label: "Long-press controls", help: "Inline brightness/colour/thermostat on long-press." },
  { name: "autoPopulateArea", label: "Populate from area", help: "Editor: drop an HA area's entities into a room." },
  { name: "backgroundTrace", label: "Background image", help: "Editor: trace over a blueprint image." },
  { name: "dayNightTheme", label: "Day/night theme", help: "Dim the plan with the sun." },
];
