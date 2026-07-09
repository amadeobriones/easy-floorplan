import { describe, it, expect } from "vitest";
import {
  snapToWall,
  openingDefaultOpen,
  kindFromEntity,
  defaultIcon,
  entityDefaultIcon,
  trackerSensorReading,
} from "./render";
import type { Opening } from "./types";

describe("snapToWall", () => {
  const hWall = { x1: 0, y1: 0, x2: 100, y2: 0 }; // horizontal
  const vWall = { x1: 0, y1: 0, x2: 0, y2: 100 }; // vertical

  it("projects a nearby point onto a horizontal wall (angle 0)", () => {
    const r = snapToWall(50, 5, [hWall], 35);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(50);
    expect(r!.y).toBeCloseTo(0);
    expect(r!.angle).toBeCloseTo(0);
  });

  it("reports a 90° angle for a vertical wall", () => {
    const r = snapToWall(5, 50, [vWall], 35);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(0);
    expect(r!.y).toBeCloseTo(50);
    expect(Math.abs(r!.angle)).toBeCloseTo(90);
  });

  it("clamps the projection to the wall's endpoints", () => {
    // A point just past the right end snaps to the endpoint, not beyond it.
    const r = snapToWall(110, 5, [hWall], 35);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(100);
    expect(r!.y).toBeCloseTo(0);
  });

  it("returns null when no wall is within the threshold", () => {
    expect(snapToWall(50, 200, [hWall], 35)).toBeNull();
  });

  it("picks the closest of several walls", () => {
    const r = snapToWall(50, 8, [hWall, { x1: 0, y1: 100, x2: 100, y2: 100 }], 35);
    expect(r!.y).toBeCloseTo(0); // nearer to the top wall
  });

  it("ignores zero-length walls", () => {
    expect(snapToWall(0, 0, [{ x1: 10, y1: 10, x2: 10, y2: 10 }], 35)).toBeNull();
  });
});

describe("openingDefaultOpen", () => {
  it("draws doors open and windows closed by default", () => {
    expect(openingDefaultOpen({ type: "door" } as Opening)).toBe(true);
    expect(openingDefaultOpen({ type: "window" } as Opening)).toBe(false);
  });
});

describe("kindFromEntity", () => {
  it("maps known domains to their kind", () => {
    expect(kindFromEntity("light.kitchen")).toBe("light");
    expect(kindFromEntity("binary_sensor.door")).toBe("binary_sensor");
    expect(kindFromEntity("cover.garage")).toBe("cover");
  });
  it("falls back to generic for unknown domains", () => {
    expect(kindFromEntity("media_player.tv")).toBe("generic");
    expect(kindFromEntity("weird")).toBe("generic");
  });
});

describe("trackerSensorReading", () => {
  const states = {
    "sensor.x": { state: "2.5" },
    "sensor.bad": { state: "unavailable" },
    "sensor.text": { state: "open" },
  };
  it("parses a numeric entity state", () => {
    expect(trackerSensorReading(states, "sensor.x")).toBe(2.5);
  });
  it("returns null for missing entity, missing state, or non-numeric reading", () => {
    expect(trackerSensorReading(states, undefined)).toBeNull();
    expect(trackerSensorReading(undefined, "sensor.x")).toBeNull();
    expect(trackerSensorReading(states, "sensor.missing")).toBeNull();
    expect(trackerSensorReading(states, "sensor.bad")).toBeNull();
    expect(trackerSensorReading(states, "sensor.text")).toBeNull();
  });
});

describe("entityDefaultIcon", () => {
  it("maps a binary_sensor shown as a Lock to lock icons per state (issue #29)", () => {
    // on = unlocked for HA's lock device class
    expect(entityDefaultIcon("binary_sensor.front_door_lock", "lock", true)).toBe("mdi:lock-open");
    expect(entityDefaultIcon("binary_sensor.front_door_lock", "lock", false)).toBe("mdi:lock");
  });

  it("is state-aware for other binary_sensor device classes", () => {
    expect(entityDefaultIcon("binary_sensor.d", "door", true)).toBe("mdi:door-open");
    expect(entityDefaultIcon("binary_sensor.d", "door", false)).toBe("mdi:door-closed");
    expect(entityDefaultIcon("binary_sensor.m", "motion", true)).toBe("mdi:motion-sensor");
    expect(entityDefaultIcon("binary_sensor.w", "window", false)).toBe("mdi:window-closed");
  });

  it("maps sensor device classes (state-independent)", () => {
    expect(entityDefaultIcon("sensor.t", "temperature", false)).toBe("mdi:thermometer");
    expect(entityDefaultIcon("sensor.h", "humidity", true)).toBe("mdi:water-percent");
  });

  it("maps cover device classes per state", () => {
    expect(entityDefaultIcon("cover.g", "garage", true)).toBe("mdi:garage-open");
    expect(entityDefaultIcon("cover.g", "garage", false)).toBe("mdi:garage");
  });

  it("returns undefined for unknown device classes, missing class, or unmapped domains", () => {
    expect(entityDefaultIcon("binary_sensor.x", "made_up", true)).toBeUndefined();
    expect(entityDefaultIcon("binary_sensor.x", undefined, true)).toBeUndefined();
    expect(entityDefaultIcon("light.x", "lock", true)).toBeUndefined();
  });
});

describe("defaultIcon", () => {
  it("returns a sensible mdi icon per kind", () => {
    expect(defaultIcon("light")).toBe("mdi:lightbulb");
    expect(defaultIcon("cover")).toBe("mdi:window-shutter");
    expect(defaultIcon("generic")).toBe("mdi:circle");
  });
});
