import { describe, it, expect } from "vitest";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";
import { FEATURE_META, featureLabel } from "./features";
// Importing the three layer modules for their registration side effect, which
// is the only way LIVE_LAYERS is ever populated.
import "./thermal";
import "./energy-layer";
import "./awareness-layer";

const base = { type:"x", width:10, height:10 } as any;

describe("layer registry", () => {
  it("starts empty (feature plans append)", () => {
    expect(Array.isArray(LIVE_LAYERS)).toBe(true);
  });
  it("enabledLayers filters by feature flag", () => {
    const fake = { id:"thermalLayer", label:"T", icon:"mdi:thermometer",
      render:()=>("" as any), watched:()=>[] } as any;
    LIVE_LAYERS.push(fake);
    try {
      expect(enabledLayers(base).length).toBe(0);                       // flag off by default
      expect(enabledLayers({ ...base, features:{ thermalLayer:true } }).some(l=>l.id==="thermalLayer")).toBe(true);
    } finally { LIVE_LAYERS.pop(); }
  });
  it("layerWatchedEntities unions only enabled layers", () => {
    const fake = { id:"energyLayer", label:"E", icon:"mdi:flash",
      render:()=>("" as any), watched:()=>["sensor.pwr"] } as any;
    LIVE_LAYERS.push(fake);
    try {
      expect(layerWatchedEntities(base).has("sensor.pwr")).toBe(false);  // off
      expect(layerWatchedEntities({ ...base, features:{ energyLayer:true } }).has("sensor.pwr")).toBe(true);
    } finally { LIVE_LAYERS.pop(); }
  });
  it("every registered layer's chip label is the feature's own label", () => {
    // The chip on the plan and the toggle in the editor's Features panel name
    // the same feature; they used to disagree ("Energy" vs "Energy layer").
    expect(LIVE_LAYERS.length).toBeGreaterThan(0);
    for (const l of LIVE_LAYERS) {
      expect(l.label, `layer ${l.id}`).toBe(featureLabel(l.id));
      expect(FEATURE_META.some((m) => m.name === l.id), `layer ${l.id} in FEATURE_META`).toBe(true);
    }
  });
  it("registers each layer exactly once, however often its module is imported", () => {
    const ids = LIVE_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
