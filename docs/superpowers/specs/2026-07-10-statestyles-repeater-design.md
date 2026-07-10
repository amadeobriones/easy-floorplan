# Editor stateStyles Repeater — Design

**Goal:** Edit **all** of an element's conditional-style rules (`StateStyle[]`) in the GUI,
for rooms and items. Replace the room's `light`/`lit` shorthand (which only reached rule 0)
with a general repeater, and give items their first GUI for rules (currently YAML-only).

**Non-goals:** rule **reorder** (a clean follow-up; v1 is add/remove, top-down first-match
order); any change to `StateStyle` semantics or to `resolveStateStyle`/`stateStyleMatches`
(render is untouched); a repeater for openings/furniture/trackers (they carry no
`stateStyles`).

## Approaches considered

- **A. Custom sub-editor mirroring `_renderTrackerSensorRows` (chosen).** The tracker's
  X/Y-sensor sub-editor is the established pattern for a nested add/remove object editor in
  this codebase — entity pickers, number/text inputs, checkboxes, committing through
  `_update…` methods. A `stateStyles` repeater is the same shape.
- **B. ha-form array/repeater selector.** `ha-form` has no native array-of-mixed-objects
  repeater that fits `StateStyle` (entity + four condition fields + icon + colour +
  animation), and colour rows already live outside the schema (no CSS-colour selector).
  Rejected — it would fight the schema model.
- **C. Leave rules YAML-only, add a "N rules" indicator.** Doesn't fix the gap. Rejected.

## Architecture

### Pure rule helpers (`src/statestyles.ts`, unit-tested, no DOM)

`StateStyle` fields: `entity?`, `state?`, `state_not?`, `above?`, `below?`, `icon?`,
`color?`, `animation?` (`none`|`pulse`|`blink`).

- `addRule(rules: StateStyle[] | undefined): StateStyle[]` — append an empty `{}` rule.
- `removeRule(rules: StateStyle[], i: number): StateStyle[] | undefined` — drop rule `i`;
  return `undefined` when the list becomes empty (so the key is dropped, never `[]`).
- `setRule(rules: StateStyle[], i: number, patch: Partial<StateStyle>): StateStyle[]` —
  merge `patch` into rule `i`, normalized: `"" → undefined` for the string fields
  (`entity`/`state`/`state_not`/`icon`/`color`); a cleared/`NaN` number → the key removed;
  `animation: "none" → undefined`. A rule that normalizes to `{}` stays in the list (an
  empty rule is a valid "always matches" last entry — the user removes it explicitly).

Kept pure so the mutation/normalization is fully testable; the editor only wires them.

### Repeater UI (`src/editor.ts`)

`_renderStateStyleRows(rules: StateStyle[], kind: "room" | "item", id: string,
defaultEntity?: string)`:
- One bordered block per rule, each with: an entity picker (`_renderEntityPicker`,
  placeholder "= this element's entity" via `defaultEntity`); condition inputs `state`
  (text), `state_not` (text), `above` (number), `below` (number); `icon` (text, `mdi:…`);
  a colour swatch + text row (reusing the existing colour-row pattern, accepting the
  special `"rgb"`); an `animation` `<select>` (none/pulse/blink); and a **Remove** button.
- An **"+ Add rule"** button below the list.
- Commits through `_updateStateStyleRule(kind, id, i, patch, live)` /
  `_addStateStyleRule(kind, id)` / `_removeStateStyleRule(kind, id, i)`, which call the pure
  helpers and then the existing per-kind update path (`_updateRoom`/`_updateItem` with a
  `{ stateStyles }` patch). Text/number field edits use the live-burst path (one undo per
  burst), matching the tracker sub-editor and the ha-form live fields.

### Room and item selection editors (`src/editor.ts`, `src/editor-forms.ts`)

- **Room:** remove the `light` and `lit` fields from `roomForm` and the `light`/`lit →
  stateStyles[0]` block from its `toPatch` (the repeater now owns rules). `roomForm` keeps
  `name`/`areaId`/`fill`/`fillOpacity`. The `sel.kind === "room"` branch renders
  `roomForm(r)` then `_renderStateStyleRows(r.stateStyles ?? [], "room", r.id)`.
- **Item:** the `sel.kind === "item"` branch renders `itemForm(it)` then
  `_renderStateStyleRows(it.stateStyles ?? [], "item", it.id, it.entity)`.

## Testing (TDD)

- **`src/statestyles.test.ts`:** `addRule` (appends `{}`; handles `undefined` input);
  `removeRule` (drops the right index; returns `undefined` when emptied); `setRule`
  (merges; `"" →` key removed; `NaN`/cleared number removed; `animation "none" → undefined`;
  an empty rule is retained). Deterministic, no DOM.
- The repeater UI is verified live (dev harness): add a rule to an item, set
  entity/state/colour/animation, confirm the emitted config carries the rule; remove it;
  confirm a room's rules edit through the repeater and the removed `light`/`lit` fields are
  gone. (No DOM test harness in this repo.)

## Fork hygiene

Branch `feat/editor-statestyles` off `main` (droppable, independent). Nothing goes outward —
no PR/issue/comment. No `Co-Authored-By`/"Generated with" footers.

**Merge note (#25 interaction):** #25 (`feat/25-areas`) added an area filter
(`include_entities`) to the room's light entity picker. This feature *replaces* that picker
with the repeater, so when #25 and this branch both land on `main`, thread #25's area entity
list into the room repeater's per-rule entity pickers (an `areaEntities?` param on
`_renderStateStyleRows`, passed for `kind === "room"`). Documented, not done here (this
branch is off `main`, without #25) — the same cross-branch pattern as #33↔#35.
