# Schema + Validating Import (#35) — Design

**Goal:** A config you can paste in — JSON **or** YAML — that is validated and either loads
whole or is refused with clear errors (never half-applied); an export that produces
HA-ready YAML; a JSON Schema generated from the TS types for external tooling; and a worked
example. The editor becomes the external config editor the upstream issue asks for.

**Non-goals:** a full HA-YAML feature set (anchors/tags/multi-doc — `js-yaml`'s defaults are
plenty); schema-driven runtime validation (the runtime validator is hand-rolled and
independent of the generated schema — see the drift note); migrating the TS interfaces to a
runtime schema library (zod/typebox) — the types stay the source of truth.

## Decisions (from brainstorming)

- **Runtime validator: hand-rolled, dep-free.** It is safe to hand-roll (a bounded, known
  config shape) and keeps the runtime lean.
- **YAML: use `js-yaml` (runtime dep).** A hand-rolled YAML parser would risk silently
  mis-parsing a config — unacceptable for an import whose whole point is correctness. This
  is the one place a trusted dependency earns its ~12–15KB gzipped.
- **Schema: generated from the TS types** via a dev-dep `typescript-json-schema`, committed,
  drift-guarded by a regenerate-and-diff test.

## Architecture

### `src/validate.ts` — the validator + parse (pure, unit-tested, no DOM/Lit)

- Combinators keep per-kind checks compact: `num`, `str`, `bool`, `oneOf(...values)`,
  `arrayOf(itemValidator)`, `optional(validator)`, each `(value, path) => string[]`
  (returns error messages, empty when valid).
- `validateConfig(raw: unknown): { ok: true; config: FloorplanCardConfig } | { ok: false;
  errors: string[] }`. Checks:
  - top level: `type` string; `width`/`height` positive numbers; optional `grid`/`snap`
    numbers; optional `title`/`background`/`defaultFloor` strings; the legacy flat element
    arrays and `floors` are arrays when present.
  - each floor: `id` string; optional `name`/`haFloor`/`image` strings; optional
    `imageOpacity` number 0–1; `rotation` ∈ {0,90,180,270} when present; each element array
    (`walls`/`openings`/`items`/`texts`/`furniture`/`trackers`/`rooms`) an array of its kind.
  - each element kind's **required** fields and enums, path-prefixed: Wall
    (`id`,`x1`,`y1`,`x2`,`y2` numbers); Opening (`id`,`type`∈{door,window},`x`,`y`,`length`,
    `angle`; optional `entity`/`motion`/…); Item (`id`,`x`,`y`,`kind`∈ItemKind); Text
    (`id`,`x`,`y`,`text`); Furniture (`id`,`type`∈FurnitureType,`x`,`y`,`w`,`h`); Tracker
    (`id`,`x`,`y`,`w`,`h`); Room (`id`,`points` array of `[number,number]`; optional
    `areaId`/`fill`/`fillOpacity`/`stateStyles`).
  - **Unknown/extra keys are allowed** (forward-compat with newer card versions).
  - Collects **all** errors (e.g. `floors[0].items[2].x: expected number`), refuses if any.
- `parseConfig(text: string): unknown` — `yaml.load(text)` (handles JSON and YAML; JSON is a
  YAML subset). Throws are caught by the caller.
- `parseAndValidate(text: string): { ok: true; config } | { ok: false; errors: string[] }`
  — `parseConfig` in a try/catch (a syntax error becomes a single `errors: ["…"]`), then
  `validateConfig`. Pure and fully testable.
- `configToText(config): string` — `yaml.dump(config, { noRefs: true })`, for export.

The validator mirrors the TS types by hand; it is the **runtime gate** and is tested
against a known-good example plus each breakage. The generated JSON Schema (below) is a
separate docs/tooling artifact; both derive from the types.

### Import / Export panel (`src/editor.ts`)

A collapsible **Import / Export** section in the project panel:
- A `<textarea>`; an **Import** button; an **Export** button; a **Load example** button.
- Import: `parseAndValidate(textarea.value)` → if `ok`, `_commit(config)` — one undo step,
  the whole config replaced; the editor re-renders on the new config. If not `ok`, set an
  error-list state and render it; **change nothing** (refuse rather than half-load).
- Export: set the textarea to `configToText(this._config)` (HA-ready YAML) for copy.
- Load example: set the textarea to the bundled example (imported as a string), so a user
  sees a valid shape to edit.
- The error list clears on the next successful import or when the panel is collapsed.

### Schema artifact (`schema/`, `package.json`)

- Dev-dep `typescript-json-schema`; script `"schema": "typescript-json-schema tsconfig.json
  FloorplanCardConfig --required --noExtraProps false --out
  schema/floorplan-card.schema.json"`. Committed output: `schema/floorplan-card.schema.json`.
- `schema/example.yaml` — a small, complete, valid config (one floor: a wall, a room with an
  area, an item, a text). Bundled into the card as a string (a `?raw` import or a generated
  `.ts` constant) for the **Load example** button.
- Runtime deps grow by `js-yaml`; dev deps by `@types/js-yaml` and `typescript-json-schema`.

## Testing (TDD)

- **`src/validate.test.ts`:** a valid config → `ok` with the parsed config; each breakage —
  missing `width`, non-array `floors`, item missing `x`, `kind`/`rotation` out of enum,
  malformed YAML/JSON syntax — → `ok:false` with the expected error path; multiple errors
  collected in one pass; `parseAndValidate` accepts both a JSON string and the equivalent
  YAML; `configToText` output round-trips back through `parseAndValidate` to an equal config;
  the bundled `example.yaml` passes `validateConfig`.
- **`src/schema.test.ts` (drift guard):** run `typescript-json-schema` in-process against the
  types and assert the result deep-equals the committed `schema/floorplan-card.schema.json`
  — fails if the types changed without a `npm run schema`. (Uses the dev-dep, no runtime
  cost.)
- The editor Import/Export panel is thin over `parseAndValidate`/`configToText`; verified
  live by the controller (dev harness: paste a valid config → loads; paste a broken one →
  errors shown, config unchanged; Export → YAML; Load example → valid).

## Fork hygiene

One branch `feat/35-schema-import` off `main` (the `package.json`/lockfile change is like the
`@types/node` add; editor is already diverged from upstream). Nothing goes outward — no PR,
issue, or comment. No `Co-Authored-By`/"Generated with" footers.
