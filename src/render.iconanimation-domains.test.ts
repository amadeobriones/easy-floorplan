/**
 * `iconAnimation` gates on `entityIsActive`, so a forced spin/pulse can only play
 * for entities that predicate calls active. An allowlist of {lock, vacuum, camera}
 * left a running thermostat, a heating water heater, and a paused media player all
 * reading "off" — so a user who set `iconAnimation: spin` on them got silently
 * nothing, no error, in a feature whose headline case is a spinning fan.
 *
 * With the inactive-state inversion these animate as configured.
 */
import { describe, it, expect } from "vitest";
import { resolveIconAnimation } from "./render";

const item = (entity: string, iconAnimation?: string) =>
  ({ entity, iconAnimation }) as Parameters<typeof resolveIconAnimation>[0];

describe("forced icon animation reaches the domains an allowlist missed", () => {
  it.each([
    ["climate.hvac", "cool"],
    ["climate.hvac", "heat"],
    ["climate.hvac", "fan_only"], // a literally spinning fan
    ["water_heater.tank", "eco"],
    ["media_player.tv", "paused"], // HA treats paused as on
  ])("%s in %s honours a forced spin", (entity, state) => {
    expect(resolveIconAnimation(item(entity, "spin"), state)).toBe("spin");
  });

  it("still fails closed on a genuinely inactive entity", () => {
    // A forced spin must not run on something that is off/unavailable.
    expect(resolveIconAnimation(item("climate.hvac", "spin"), "off")).toBeUndefined();
    expect(resolveIconAnimation(item("media_player.tv", "spin"), "off")).toBeUndefined();
    expect(resolveIconAnimation(item("light.k", "spin"), "unavailable")).toBeUndefined();
  });

  it("leaves the generic on/off domains unchanged", () => {
    expect(resolveIconAnimation(item("light.k", "spin"), "on")).toBe("spin");
    expect(resolveIconAnimation(item("light.k", "spin"), "off")).toBeUndefined();
  });
});

describe("a cover animates while moving, not while parked", () => {
  // A cover's active state is `open`, but an icon animation reads as motion — a
  // parked-open door is not moving. So animation tracks transit, not open/closed.
  it.each(["opening", "closing"])("%s (in transit) honours a forced spin", (state) => {
    expect(resolveIconAnimation(item("cover.garage", "spin"), state)).toBe("spin");
  });

  it.each(["open", "closed"])("%s (parked) does not animate", (state) => {
    // Pre-fix, forced spin ran forever on an `open` cover and nothing while moving.
    expect(resolveIconAnimation(item("cover.garage", "spin"), state)).toBeUndefined();
  });

  it("valves behave the same", () => {
    expect(resolveIconAnimation(item("valve.water", "pulse"), "opening")).toBe("pulse");
    expect(resolveIconAnimation(item("valve.water", "pulse"), "open")).toBeUndefined();
  });
});
