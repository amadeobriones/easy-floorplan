import { describe, it, expect } from "vitest";
import { isTypingTarget, pathTags } from "./editor-keys";

describe("isTypingTarget", () => {
  it("a text field owns every key, modifier or not", () => {
    for (const tag of ["input", "textarea", "ha-entity-picker", "ha-icon-picker"]) {
      expect(isTypingTarget([tag], false), tag).toBe(true);
      expect(isTypingTarget([tag], true), `${tag} + mod`).toBe(true);
    }
  });

  // The floor switcher is a <select> and keeps focus after you change floors.
  // Treating it as a text field left Cmd+V dead until you clicked elsewhere.
  it("a select owns bare keys but not modifier combinations", () => {
    expect(isTypingTarget(["select"], false)).toBe(true);
    expect(isTypingTarget(["select"], true)).toBe(false);
  });

  // ha-select inside an ha-form puts no native input on the path, so bare arrows
  // and Escape must not reach the canvas — but Cmd+V over a dropdown is a paste.
  it("an ha-form owns bare keys but not modifier combinations", () => {
    expect(isTypingTarget(["ha-form", "ha-select"], false)).toBe(true);
    expect(isTypingTarget(["ha-form", "ha-select"], true)).toBe(false);
  });

  it("a text field inside an ha-form still owns Cmd+V", () => {
    expect(isTypingTarget(["ha-form", "ha-textfield", "input"], true)).toBe(true);
  });

  it("the canvas owns everything", () => {
    expect(isTypingTarget(["svg", "div", "easy-floorplan-card-editor"], false)).toBe(false);
    expect(isTypingTarget(["svg", "div"], true)).toBe(false);
  });

  it("an input anywhere on the path wins, even beside a select", () => {
    expect(isTypingTarget(["input", "select"], true)).toBe(true);
    expect(isTypingTarget(["select", "input"], true)).toBe(true);
  });

  it("is not fooled by an empty path", () => {
    expect(isTypingTarget([], false)).toBe(false);
    expect(isTypingTarget([""], true)).toBe(false);
  });
});

describe("pathTags", () => {
  const el = (tagName: string, isContentEditable = false) =>
    ({ tagName, isContentEditable }) as unknown as EventTarget;

  it("lower-cases tag names", () => {
    expect(pathTags([el("SELECT"), el("DIV")])).toEqual(["select", "div"]);
  });

  it("treats a contentEditable element as an input", () => {
    expect(pathTags([el("DIV", true)])).toEqual(["input"]);
  });

  it("survives a node with no tagName (window, document)", () => {
    expect(pathTags([{} as EventTarget])).toEqual([""]);
  });
});
