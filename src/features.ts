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

/**
 * The one place a feature's user-facing wording lives: the editor's Features
 * panel and the card's layer chips both read it from here, so the toggle a
 * user switches on and the chip that then appears on the plan can never say
 * two different things. (They did: the chips said "Awareness"/"Energy" while
 * this table said "Awareness layer"/"Energy layer".)
 *
 * Typed `Record<FeatureName, ...>`, so a flag added to {@link FeaturesConfig}
 * and forgotten here is a compile error rather than an unlabelled toggle.
 */
const FEATURE_INFO: Record<FeatureName, { label: string; help: string }> = {
  thermalLayer: { label: "Climate layer", help: "Shade rooms warm/cool by temperature." },
  awarenessLayer: { label: "Awareness layer", help: "Motion pings and safety alerts." },
  energyLayer: { label: "Energy layer", help: "Colour devices by live power draw." },
  radialControls: {
    label: "Long-press controls",
    help: "Inline brightness/colour/thermostat on long-press.",
  },
};

/** A feature's display name. Total by construction — see {@link FEATURE_INFO}. */
export function featureLabel(name: FeatureName): string {
  return FEATURE_INFO[name].label;
}

/**
 * Every feature, in the order the editor offers them. Derived from
 * {@link FEATURE_DEFAULTS} (itself `Required<FeaturesConfig>`) rather than
 * hand-listed, so the panel cannot silently omit a flag the card supports.
 */
export const FEATURE_META: ReadonlyArray<{ name: FeatureName; label: string; help: string }> = (
  Object.keys(FEATURE_DEFAULTS) as FeatureName[]
).map((name) => ({ name, ...FEATURE_INFO[name] }));
