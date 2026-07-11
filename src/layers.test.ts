import { describe, it, expect } from "vitest";
import { LIVE_LAYERS, enabledLayers, layerWatchedEntities } from "./layers";

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
});
