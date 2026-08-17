import { describe, it, expect } from "vitest";
import {
  isMotionTripped, isSafetyTripped, isMarkerTripped, renderAwarenessMarker,
} from "./awareness";
import type { AwarenessMarker } from "./types";

describe("isMotionTripped", () => {
  it("is tripped on the same states as isEntityOn", () => {
    expect(isMotionTripped("on")).toBe(true);
    expect(isMotionTripped("open")).toBe(true);
    expect(isMotionTripped("home")).toBe(true);
    expect(isMotionTripped("playing")).toBe(true);
  });
  it("is not tripped when off, unavailable, or unknown", () => {
    expect(isMotionTripped("off")).toBe(false);
    expect(isMotionTripped("unavailable")).toBe(false);
    expect(isMotionTripped(undefined)).toBe(false);
  });
});

describe("isSafetyTripped", () => {
  it("trips on the alarming words a safety sensor reports", () => {
    expect(isSafetyTripped("on")).toBe(true);       // a plain tripped binary_sensor
    expect(isSafetyTripped("detected")).toBe(true); // smoke/gas wording some integrations use literally
    expect(isSafetyTripped("wet")).toBe(true);       // moisture wording some integrations use literally
    expect(isSafetyTripped("open")).toBe(true);      // door left open
  });
  it("is clear on off/closed/dry", () => {
    expect(isSafetyTripped("off")).toBe(false);
    expect(isSafetyTripped("closed")).toBe(false);
    expect(isSafetyTripped("dry")).toBe(false);
  });
  it("fails closed on an outage -- never alarms because the sensor dropped out", () => {
    expect(isSafetyTripped("unavailable")).toBe(false);
    expect(isSafetyTripped("unknown")).toBe(false);
    expect(isSafetyTripped(undefined)).toBe(false);
  });
});

describe("isMarkerTripped", () => {
  const motion = { kind: "motion" as const };
  const safety = { kind: "safety" as const };
  it("routes a motion marker through isMotionTripped", () => {
    expect(isMarkerTripped(motion, "on")).toBe(true);
    expect(isMarkerTripped(motion, "detected")).toBe(false); // "detected" is not a motion state
  });
  it("routes a safety marker through isSafetyTripped", () => {
    expect(isMarkerTripped(safety, "wet")).toBe(true);
    expect(isMarkerTripped(safety, "off")).toBe(false);
  });
});

// Full recursive serialization (strings interleaved with values, including a
// nested TemplateResult like the foreignObject's ripple) -- same helper used
// by render.test.ts's renderFurniture reactive-glyph tests.
interface TplLike { strings: readonly string[]; values: unknown[] }
const isTpl = (v: unknown): v is TplLike => !!v && typeof v === "object" && "strings" in v && "values" in v;
const serialize = (t: unknown): string => {
  const tpl = t as TplLike;
  let out = tpl.strings[0];
  for (let i = 0; i < tpl.values.length; i++) {
    const v = tpl.values[i];
    out += isTpl(v) ? serialize(v) : String(v);
    out += tpl.strings[i + 1];
  }
  return out;
};

describe("renderAwarenessMarker — motion", () => {
  const marker: AwarenessMarker = { id: "m1", x: 120, y: 80, entity: "binary_sensor.hall_motion", kind: "motion" };

  it("hosts the reused ripple in a foreignObject, 80 canvas units square, centred on the marker", () => {
    const out = serialize(renderAwarenessMarker(marker, false));
    expect(out).toContain("<foreignObject");
    expect(out).toContain("x=80");   // 120 - 80/2
    expect(out).toContain("y=40");   // 80 - 80/2
    expect(out).toContain("width=80");
    expect(out).toContain("height=80");
    expect(out).toContain("ripple");
  });

  it("the ripple is inactive when the motion sensor is clear", () => {
    expect(serialize(renderAwarenessMarker(marker, false))).not.toContain("ripple active");
  });

  it("the ripple animates when the motion sensor has fired", () => {
    expect(serialize(renderAwarenessMarker(marker, true))).toContain("ripple active");
  });
});

describe("renderAwarenessMarker — safety", () => {
  const marker: AwarenessMarker = { id: "s1", x: 50, y: 60, entity: "binary_sensor.kitchen_leak", kind: "safety" };

  it("draws a dim idle marker when clear", () => {
    const out = serialize(renderAwarenessMarker(marker, false));
    expect(out).toContain("fp-awareness-safety-idle");
    expect(out).not.toContain("fp-furn-anim-blink");
    expect(out).toContain("cx=50");
    expect(out).toContain("cy=60");
  });

  it("blinks in the alert palette when tripped, reusing the furniture blink animation", () => {
    const out = serialize(renderAwarenessMarker(marker, true));
    expect(out).toContain("fp-awareness-safety");
    expect(out).toContain("fp-furn-anim-blink");
  });
});
