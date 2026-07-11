import { describe, it, expect } from "vitest";
import {
  radialDomainFor, shouldOpenRadial, radialHasHold,
  lightBrightnessCall, climateSetpointCall, climateStep, clampPopoverPosition,
} from "./radial-controls";

describe("radialDomainFor", () => {
  it("recognizes the three supported domains", () => {
    expect(radialDomainFor("light.lamp")).toBe("light");
    expect(radialDomainFor("switch.fan")).toBe("switch");
    expect(radialDomainFor("climate.hall")).toBe("climate");
  });
  it("returns undefined for an unsupported domain or no entity", () => {
    expect(radialDomainFor("lock.front_door")).toBeUndefined();
    expect(radialDomainFor(undefined)).toBeUndefined();
  });
});

describe("shouldOpenRadial", () => {
  const on = { features: { radialControls: true } };
  it("is false when the feature flag is off or unset", () => {
    expect(shouldOpenRadial({ features: { radialControls: false } }, "light.lamp", undefined)).toBe(false);
    expect(shouldOpenRadial(undefined, "light.lamp", undefined)).toBe(false);
    expect(shouldOpenRadial({}, "light.lamp", undefined)).toBe(false);
  });
  it("is false for an unsupported domain even with the flag on", () => {
    expect(shouldOpenRadial(on, "lock.front_door", undefined)).toBe(false);
  });
  it("is false with no entity", () => {
    expect(shouldOpenRadial(on, undefined, undefined)).toBe(false);
  });
  it("is false when an explicit hold_action is configured -- it always wins", () => {
    expect(shouldOpenRadial(on, "light.lamp", { action: "toggle" })).toBe(false);
  });
  it("is true for a supported domain, flag on, no (or none) hold_action", () => {
    expect(shouldOpenRadial(on, "light.lamp", undefined)).toBe(true);
    expect(shouldOpenRadial(on, "light.lamp", { action: "none" })).toBe(true);
  });
});

describe("radialHasHold", () => {
  it("matches hasAction(hold_action) when the flag is off -- byte-identical gating", () => {
    const off = { features: { radialControls: false } };
    expect(radialHasHold(off, "light.lamp", undefined)).toBe(false);
    expect(radialHasHold(off, "light.lamp", { action: "toggle" })).toBe(true);
    expect(radialHasHold(off, "light.lamp", { action: "none" })).toBe(false);
  });
  it("is true for a supported domain even with no hold_action when the flag is on", () => {
    const on = { features: { radialControls: true } };
    expect(radialHasHold(on, "light.lamp", undefined)).toBe(true);
  });
  it("stays true when a hold_action is ALSO configured (the handler routes to hold_action, not the popover)", () => {
    const on = { features: { radialControls: true } };
    expect(radialHasHold(on, "light.lamp", { action: "toggle" })).toBe(true);
  });
});

describe("lightBrightnessCall / climateSetpointCall", () => {
  it("builds a light.turn_on brightness_pct call, clamped to 1..100", () => {
    expect(lightBrightnessCall("light.lamp", 55)).toEqual({
      domain: "light", service: "turn_on", data: { entity_id: "light.lamp", brightness_pct: 55 },
    });
    expect(lightBrightnessCall("light.lamp", 0)).toEqual({
      domain: "light", service: "turn_on", data: { entity_id: "light.lamp", brightness_pct: 1 },
    });
    expect(lightBrightnessCall("light.lamp", 250)).toEqual({
      domain: "light", service: "turn_on", data: { entity_id: "light.lamp", brightness_pct: 100 },
    });
  });
  it("builds a climate.set_temperature call", () => {
    expect(climateSetpointCall("climate.hall", 21.5)).toEqual({
      domain: "climate", service: "set_temperature", data: { entity_id: "climate.hall", temperature: 21.5 },
    });
  });
});

describe("climateStep", () => {
  it("steps up and down by the given increment", () => {
    expect(climateStep(20, 1, 0.5, 7, 35)).toBe(20.5);
    expect(climateStep(20, -1, 0.5, 7, 35)).toBe(19.5);
  });
  it("clamps to min/max", () => {
    expect(climateStep(35, 1, 0.5, 7, 35)).toBe(35);
    expect(climateStep(7, -1, 0.5, 7, 35)).toBe(7);
  });
});

describe("clampPopoverPosition", () => {
  const viewport = { width: 400, height: 800 };
  it("centers above the anchor when there is room", () => {
    const anchor = { left: 150, top: 300, width: 40, height: 40 };
    const pos = clampPopoverPosition(anchor, { width: 200, height: 100 }, viewport);
    expect(pos.top).toBe(192); // 300 - 100 - 8
    expect(pos.left).toBe(70); // (150 + 20) - 100
  });
  it("flips below the anchor when there is no room above", () => {
    const anchor = { left: 150, top: 20, width: 40, height: 40 };
    const pos = clampPopoverPosition(anchor, { width: 200, height: 100 }, viewport);
    expect(pos.top).toBe(68); // 20 + 40 + 8
  });
  it("clamps left so the popover never spills past the viewport margin", () => {
    const anchor = { left: 0, top: 300, width: 10, height: 10 };
    const pos = clampPopoverPosition(anchor, { width: 200, height: 100 }, viewport);
    expect(pos.left).toBe(8);
  });
});
