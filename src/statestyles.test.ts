import { describe, it, expect } from "vitest";
import { addRule, removeRule, setRule } from "./statestyles";
import type { StateStyle } from "./types";

describe("addRule", () => {
  it("appends an empty rule (and handles undefined input)", () => {
    expect(addRule(undefined)).toEqual([{}]);
    expect(addRule([{ state: "on" }])).toEqual([{ state: "on" }, {}]);
  });
});

describe("removeRule", () => {
  it("drops the given index", () => {
    expect(removeRule([{ state: "a" }, { state: "b" }], 0)).toEqual([{ state: "b" }]);
  });
  it("returns undefined when the list empties", () => {
    expect(removeRule([{ state: "a" }], 0)).toBeUndefined();
  });
});

describe("setRule", () => {
  const rules: StateStyle[] = [{ state: "on" }, { color: "red" }];
  it("merges a patch into the given rule only", () => {
    expect(setRule(rules, 1, { color: "blue" })).toEqual([{ state: "on" }, { color: "blue" }]);
  });
  it("drops an emptied string field", () => {
    expect(setRule([{ state: "on", color: "red" }], 0, { color: "" })).toEqual([{ state: "on" }]);
  });
  it("drops a cleared/NaN number field", () => {
    expect(setRule([{ above: 5 }], 0, { above: undefined })).toEqual([{}]);
    expect(setRule([{ above: 5 }], 0, { above: NaN })).toEqual([{}]);
  });
  it("drops animation 'none'", () => {
    expect(setRule([{ animation: "pulse" }], 0, { animation: "none" })).toEqual([{}]);
  });
  it("keeps a rule that normalizes to empty (a valid always-match entry)", () => {
    expect(setRule([{ state: "on" }], 0, { state: "" })).toEqual([{}]);
  });
});
