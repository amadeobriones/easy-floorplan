import { describe, it, expect } from "vitest";
import { featureEnabled, FEATURE_DEFAULTS, FEATURE_META } from "./features";

describe("featureEnabled", () => {
  it("defaults every feature to off", () => {
    for (const m of FEATURE_META) expect(featureEnabled({}, m.name)).toBe(false);
    expect(Object.values(FEATURE_DEFAULTS).every((v) => v === false)).toBe(true);
  });
  it("reads an explicit flag", () => {
    expect(featureEnabled({ features: { thermalLayer: true } }, "thermalLayer")).toBe(true);
    expect(featureEnabled({ features: { thermalLayer: false } }, "thermalLayer")).toBe(false);
  });
  it("treats an undefined config as all-off", () => {
    expect(featureEnabled(undefined, "lightsLayer")).toBe(false);
  });
  it("META lists exactly the FeaturesConfig keys", () => {
    // guard against a key added to the type but not surfaced in the editor
    expect(FEATURE_META.map((m) => m.name).sort()).toEqual(
      ["autoPopulateArea","awarenessLayer","backgroundTrace","dayNightTheme","energyLayer",
       "lightsLayer","mediaNowPlaying","radialControls","roomTapScenes","thermalLayer"].sort(),
    );
  });
});
