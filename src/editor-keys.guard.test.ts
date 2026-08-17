import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const editor = readFileSync(fileURLToPath(new URL("./editor.ts", import.meta.url)), "utf8");

/**
 * `isTypingTarget`'s two call sites in editor.ts are not interchangeable, and
 * nothing in editor-keys.test.ts can tell them apart -- those tests call
 * `isTypingTarget` directly with hand-built tag arrays, so they'd pass just
 * as happily if someone flipped which argument goes to which site. That flip
 * is not hypothetical: an earlier draft of the plan that introduced this
 * module specified exactly that, and it took reading the surrounding
 * Escape-containment logic (not a test failure) to catch it. These guards
 * read editor.ts as source text and pin the wiring so a regression fails
 * loudly instead of shipping green.
 *
 * Why the two sites take different arguments:
 * - `:861`, the shortcut guard (`_handleKeyDown`) -- decides whether a
 *   keyboard shortcut belongs to the focused field or the canvas. A held
 *   Ctrl/Cmd means "not the field's keystroke" (a `<select>`/`ha-form` has no
 *   use for `Cmd+V`), so this site must pass the real modifier flag.
 * - `:334`, Escape containment (`_onHostKeyDown`) -- not a shortcut guard.
 *   The line above it already pins `ev.key === "Escape"`, and its condition
 *   is inverted (`if (!isTypingTarget(...)) return;`): it proceeds *when*
 *   the path is a typing target, to contain an Escape no overlay absorbed
 *   before it reaches -- and closes -- HA's dialog underneath the fullscreen
 *   workspace (see the comment above it). Passing the real modifier here
 *   would let `Cmd+Escape` inside an `ha-form` flip the test to false, skip
 *   containment, and reproduce that exact failure. This site must always
 *   pass `false`.
 */
describe("isTypingTarget call-site wiring guards", () => {
  it("Escape containment (_onHostKeyDown) always passes false, never the modifier flag", () => {
    expect(editor).toMatch(/!isTypingTarget\(pathTags\(ev\.composedPath\(\)\),\s*false\)/);
  });

  it("the shortcut guard (_handleKeyDown) passes the real modifier flag", () => {
    expect(editor).toMatch(
      /isTypingTarget\(pathTags\(path\),\s*ev\.ctrlKey \|\| ev\.metaKey\)/
    );
  });

  it("isTypingPath is not reintroduced as a function", () => {
    expect(editor).not.toMatch(/function isTypingPath/);
  });
});
