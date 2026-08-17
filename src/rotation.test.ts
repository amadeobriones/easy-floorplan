import { describe, it, expect } from "vitest";
import { resolveRotation } from "./render";

describe("per-floor rotation", () => {
  it("falls back to the card rotation when the floor sets none", () => {
    expect(resolveRotation({ rotation: 90 }, { id: "f1" })).toBe(90);
  });
  it("lets a floor override the card rotation", () => {
    expect(resolveRotation({ rotation: 90 }, { id: "f1", rotation: 180 })).toBe(180);
  });
  it("normalizes a nonsense value to zero", () => {
    expect(resolveRotation({}, { id: "f1", rotation: 45 })).toBe(0);
  });
  it("treats an explicit floor rotation of 0 as an override, not absence", () => {
    expect(resolveRotation({ rotation: 90 }, { id: "f1", rotation: 0 })).toBe(0);
  });
});
