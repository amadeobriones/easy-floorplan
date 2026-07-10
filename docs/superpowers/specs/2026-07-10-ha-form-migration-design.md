# ha-form Migration — Design

**Goal:** Replace the editor's hand-rolled form rows (`<input>`, `<select>`, `<input type=checkbox>`) with schema-driven `ha-form` + HA selectors, and wire in the functionality the move enables — native HA look/density/a11y, reliable picker loading, filtered entity selectors, number fields with units, helper text, and standard `tap_action`/`hold_action`/`double_tap_action` support on items.

**Non-goals (unchanged from the audit follow-up list):** localization, monolith decomposition beyond what this migration needs, canvas/toolbar/context-bar changes, tracker sensor sub-editor restructure, per-floor empty-array stripping.

## Approaches considered

- **A. ha-form only, no fallback.** Simplest, but the dev harness (no HA) loses the whole form UI, and a failed component load in HA leaves dead rows. Rejected.
- **B. One schema source with a plain-input fallback renderer (chosen).** A `_renderForm(schema, data, onChange)` helper renders `<ha-form>` when the element is defined, else maps the same schema to plain inputs (the pattern the icon/entity fallbacks already use). Dev harness and Playwright keep working; HA users get native components; a load failure degrades instead of breaking.
- **C. Hybrid — keep old rows, ha-form only for new fields.** Lowest risk, but fails the migration goal (two form systems forever). Rejected.

## Architecture

### New module: `src/editor-forms.ts` (pure, unit-tested)

- `FormField` — our internal schema item: `{ name, label, helper?, selector, live? }` where `selector` is a HA selector object (`{ text | number | boolean | select | entity | icon | ui_action }`) and `live: true` marks continuous fields (text typing, sliders) that route through the burst-history path.
- Schema builders (pure functions of the element + context):
  - `openingSchema(o: Opening): FormField[]` — type, motion, length, conditional hinge/opens/slide/style, entity (domains `binary_sensor`,`cover`), conditional invert. Encodes today's conditionals (swing vs slide vs biparting) exactly.
  - `itemSchema(it: FloorItem): FormField[]` — entity, secondaryEntity, icon (placeholder = kind default), name, size, angle, display, conditional rippleSize, showIcon, showState, plus `tap_action`/`hold_action`/`double_tap_action` (ui_action selector).
  - `textSchema(t)`, `furnitureSchema(f)` (type select from `FURNITURE_TYPES`, w/h, angle), `trackerSchema(tr)` (w/h, x, y, angle, dotSize), `wallSchema(w)` (x1/y1/x2/y2), `projectSchema(config, floor)` (title, width, height, grid with helper text, floor image, conditional imageOpacity).
- `diffFormValue(prev, next, fields): Partial` — the changed keys from an `ha-form` `value-changed` payload (full data object) restricted to the schema's field names.
- `normalizeFormPatch(patch, fields): Partial` — per-field cleanup: `"" → undefined` for optional strings; numeric keep-old-value guards (reject `NaN`/empty, clamp to selector min); angle wrap to 0..360.

Color rows are NOT in the schemas: HA has no CSS-color-string selector, and our colors accept `var(--x)` / empty-for-theme-default. The existing swatch + free-text rows stay custom, rendered after the form.

The tracker's X/Y sensor sub-editors (nested objects, add/remove, presence pairing) stay custom, using the existing `_renderEntityPicker`. The wall "Length" row (a computed resize control, not a config field) stays custom. The snap segmented control stays in the context bar.

### Editor changes (`src/editor.ts`)

- `_renderForm(fields, data, apply)`:
  - **ha-form branch** (when `customElements.get("ha-form")`): renders `<ha-form .hass .data .schema .computeLabel .computeHelper @value-changed>`. The handler stops propagation, diffs `ev.detail.value` against `data`, normalizes, and calls `apply(patch, liveFieldName?)`.
  - **fallback branch:** maps each field's selector to a plain input (`text`→text input, `number`→range+number pair honoring `mode`, `boolean`→checkbox, `select`→`<select>`, `entity`/`icon`→the existing fallback inputs, `ui_action`→omitted in fallback), firing the same `apply` path.
- `apply` routing preserves the history-burst discipline: patches whose (single) key is a `live` field go through `_updateXLive` (one undo snapshot per burst, keyed `kind:id:field`); everything else commits via `_updateX`.
- Per-field side effects stay in the editor (not the pure module): entity → `kindFromEntity` / `openingFromDeviceClass` inference; opening motion → `sliderStyle` cleanup; grid → `_setGrid` snap rescale.
- `_ensurePickers` grows into `_ensureHaComponents`: same entities-editor trick (it defines `ha-form` too), `whenDefined("ha-form")` → `requestUpdate` added, so the fallback upgrades in place. Selectors inside ha-form lazy-load their own implementations (this is what makes the icon picker reliable at last).
- `value-changed` events from ha-form are stopped at our handler so they never bubble into HA's dialog.

### Card changes (`src/floorplan-card.ts` + `src/types.ts`)

New item fields (HA-conventional snake_case, since users hand-write YAML actions): `tap_action?`, `hold_action?`, `double_tap_action?` typed as `ActionConfig` from `custom-card-helpers` (already a dependency).

- Item badges get the standard action treatment: an `actionHandler` directive (the canonical ~80-line implementation used by community cards — detects hold and double-tap, fires `action` events) plus `handleAction(this, hass, actionCfg, ev.detail.action)` from `custom-card-helpers`.
- **Backward compatibility:** when no `tap_action` is configured, the default reproduces today's behavior exactly — `toggle` for controllable domains (`light`, `switch`, `cover`, `fan`, `input_boolean`), `more-info` otherwise; `hold_action`/`double_tap_action` default to `none`. Implemented as `defaultItemAction(entity): ActionConfig` (pure, tested) so editor previews and the card agree.
- Openings keep their purpose-built tap (cover toggle / more-info) — actions apply to items only.
- New file `src/action-handler.ts` for the directive (isolated, no editor coupling).

### Dev harness

No harness changes required: the fallback renderer covers every field except `ui_action` (edit actions in YAML outside HA — acceptable for a dev harness).

## History/undo integration

`ha-form` fires `value-changed` for every inner change; text fields fire per keystroke and sliders per tick. The diff → `live` routing maps these onto the existing burst discipline unchanged: one undo snapshot per field-burst, discrete controls commit. Selection changes and gestures already reset bursts.

## Error handling

- Cleared/invalid numeric fields keep the old value (parity with current guards) via `normalizeFormPatch`.
- A missing `ha-form` (load failure, dev harness) renders the fallback; `whenDefined` upgrades live.
- Unknown/legacy action configs pass through `handleAction` untouched.

## Testing

- Unit (vitest, node): schema builders (conditional branches: swing/slide/biparting opening; ripple visibility; image opacity presence), `diffFormValue`, `normalizeFormPatch` guards, `defaultItemAction`.
- Behavioral (Playwright on dev harness, fallback path): form renders per kind, select commit → one undo step, text burst → one undo step, numeric guard keeps old value, emitted config carries snake_case action keys only when set.
- Real-HA sanity is deferred to manual testing in HA (ha-form branch is the same routing code as the fallback past the diff).

## Compatibility (verified against home-assistant/frontend 2024.1 tag and dev)

- `ha-form` consolidates inner events: one `value-changed` per change, `detail.value` = full data object (top-level spread merge). Text/number-box fields fire per keystroke; number sliders fire **on release only** (live-drag preview is lost for slider fields — accepted, matches core editors).
- Selector shapes pinned to 2024.1-compatible forms: entity `{ entity: { filter: [{ domain: [...] }] } }`; no `flatten` (use `name: ""` if grouping is ever needed); no select `mode: "box"`; no `slider_ticks`.
- `ui_action` selector (underscore key) needs only `hass` — verified to work inside custom card editors; emits `perform-action` configs on ≥2024.8 and `call-service` on older versions, so the card ships its own executor handling both spellings (custom-card-helpers' `handleAction` silently drops `perform-action` — not used).
- **Loading:** the entities-editor trick does NOT define `ha-form` (verified — `hui-entities-card-editor` doesn't import it). `_ensureHaComponents` loads the **button** card editor (statically imports ha-form + the ui_action chain) plus the entities editor (defines ha-entity-picker for the custom tracker rows). Selectors inside ha-form lazy-load their own pickers.
