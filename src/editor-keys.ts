/**
 * Which keystrokes belong to a focused control rather than to the canvas.
 *
 * The editor listens for keys on `window`, so it must decide whether a key was
 * meant for a field the user is typing in. Swallowing too little steals the
 * user's typing; swallowing too much makes the shortcuts mysteriously dead.
 */

/** Controls that consume a keystroke themselves — including `Cmd/Ctrl+V`. */
const TEXT_ENTRY_TAGS: ReadonlySet<string> = new Set([
  "input",
  "textarea",
  "ha-entity-picker",
  "ha-icon-picker",
]);

/**
 * A `<select>` consumes bare keys — it jumps to the option starting with the
 * letter typed, and the arrows move the selection. It has no use for a modifier
 * combination, and `Cmd/Ctrl+V` in a `<select>` does nothing at all.
 *
 * This matters because the floor switcher *is* a `<select>`, and it keeps focus
 * after you change floors. Treating it as a text field left every shortcut —
 * paste, delete, undo, the arrows — dead until the user clicked somewhere else,
 * which reads as "copy and paste doesn't work between floors".
 *
 * `ha-form` is here for the same reason: an `ha-select` inside it puts no native
 * input on the event path, so bare arrows and Escape must not reach the canvas —
 * but `Cmd+V` over a dropdown is still a paste. When the focused control *is* a
 * text field, that field appears on the path in its own right and is caught above.
 */
const BARE_KEY_TAGS: ReadonlySet<string> = new Set(["select", "ha-form"]);

/**
 * Does a focused control own this keystroke?
 *
 * @param tags       tag names on the event's composed path, lower-cased
 * @param hasModifier whether Ctrl or Meta was held
 */
export function isTypingTarget(tags: readonly string[], hasModifier: boolean): boolean {
  for (const tag of tags) {
    if (TEXT_ENTRY_TAGS.has(tag)) return true;
    if (!hasModifier && BARE_KEY_TAGS.has(tag)) return true;
  }
  return false;
}

/** The composed path's tag names, lower-cased. `contentEditable` counts as an input. */
export function pathTags(path: readonly EventTarget[]): string[] {
  return path.map((el) => {
    const node = el as HTMLElement;
    if (node.isContentEditable === true) return "input";
    return node.tagName?.toLowerCase() ?? "";
  });
}
