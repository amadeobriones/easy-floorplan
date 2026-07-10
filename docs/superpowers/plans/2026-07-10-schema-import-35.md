# Schema + Validating Import (#35) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hand-rolled dep-free config validator; a paste import that accepts JSON *or* YAML, validates, and loads-whole-or-refuses; a YAML export; a generated JSON Schema with a drift-guard; and a worked example.

**Architecture:** `src/validate.ts` holds pure validation combinators + `validateConfig`; then `parseAndValidate`/`configToText` wrap `js-yaml`. The editor's project panel gets an Import/Export section. A devDep generates `schema/floorplan-card.schema.json` from the TS types, drift-guarded by a test.

**Tech Stack:** TypeScript, Lit, vitest, `js-yaml` (runtime), `typescript-json-schema` + `@types/js-yaml` (dev).

## Global Constraints

- **Nothing goes out.** No PR/issue/comment to upstream or anyone. Local commits only; do not push unless asked. **No AI-authorship footers.**
- **Never push `feat/item-kinds-and-aspect`** (open PR #40 head).
- Branch `feat/35-schema-import` off `main`.
- Runtime validator stays **dep-free**; `js-yaml` is the only new runtime dep (for parsing/serializing). No `ajv`.
- Validator **collects all errors**, path-prefixed, and **refuses on any** — never half-loads. **Unknown extra keys are allowed** (forward-compat).
- Enum value lists are runtime `as const` arrays in `validate.ts` (TS unions don't exist at runtime); they must match the `types.ts` unions exactly. `ItemKind`: light, switch, sensor, binary_sensor, climate, cover, media_player, fan, camera, lock, humidifier, vacuum, generic. `OpeningType`: door, window. `FurnitureType`: table, roundTable, desk, chair, sofa, bed, wardrobe, rug, plant, fridge, stove, sink, toilet, stairs, tv, washer, dryer, dishwasher, waterHeater, airHandler, bathtub, vanity, sectional. `rotation`: 0, 90, 180, 270.
- `tsconfig.json` has `resolveJsonModule: true` — the example is a `.json` imported as an object (no `?raw`); the UI shows it as YAML via `configToText`.
- Run one test file: `npx vitest run src/<file>.test.ts`; full suite `npx vitest run --reporter=dot`; typecheck `npx tsc --noEmit`; build `npm run build`.

---

## File Structure

- `src/validate.ts` — **create.** Combinators + `validateConfig` (Task 1); `parseConfig`/`parseAndValidate`/`configToText` over `js-yaml` (Task 2).
- `src/validate.test.ts` — **create.** Validator tests (Task 1); parse/round-trip tests (Task 2).
- `schema/floorplan-card.schema.json` — **create (generated).** Committed schema (Task 3).
- `schema/example.json` — **create.** Worked example (Task 3).
- `src/schema.test.ts` — **create.** Drift guard + example-validates (Task 3).
- `package.json` — **modify.** `js-yaml` dep; `@types/js-yaml` + `typescript-json-schema` devDeps; `schema` script (Tasks 2–3).
- `src/editor.ts` — **modify.** Import/Export section in `_renderPanelBody`; `_importConfig`/`_exportConfig`/`_loadExample` + error state (Task 4).

One branch `feat/35-schema-import` off `main`.

---

## Task 1: `validate.ts` — the dep-free validator

Branch: `feat/35-schema-import` off `main`.

**Files:** Create `src/validate.ts`, `src/validate.test.ts`.

**Interfaces:**
- Produces: `type ValidationResult = { ok: true; config: FloorplanCardConfig } | { ok: false; errors: string[] }`; `validateConfig(raw: unknown): ValidationResult`. Consumed by Task 2 (`parseAndValidate`), Task 4 (editor).

- [ ] **Step 1: Create the branch**

```bash
cd ~/src/easy-floorplan && git checkout main && git checkout -b feat/35-schema-import
```

- [ ] **Step 2: Write the failing tests**

Create `src/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateConfig } from "./validate";

const valid = {
  type: "custom:floorplan-card",
  width: 1000,
  height: 600,
  floors: [
    {
      id: "f1",
      name: "Main",
      walls: [{ id: "w1", x1: 0, y1: 0, x2: 100, y2: 0 }],
      rooms: [{ id: "r1", points: [[0, 0], [100, 0], [100, 100]], areaId: "kitchen" }],
      items: [{ id: "i1", x: 50, y: 50, kind: "light", entity: "light.a" }],
      texts: [{ id: "t1", x: 10, y: 10, text: "Hi" }],
      rotation: 90,
    },
  ],
};

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    const r = validateConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.floors![0].id).toBe("f1");
  });
  it("rejects a non-object", () => {
    expect(validateConfig(42).ok).toBe(false);
    expect(validateConfig(null).ok).toBe(false);
  });
  it("rejects a wrong-typed top-level field with a path", () => {
    const r = validateConfig({ ...valid, width: "big" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("config.width"))).toBe(true);
  });
  it("rejects a non-array element list", () => {
    const r = validateConfig({ ...valid, floors: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("config.floors"))).toBe(true);
  });
  it("rejects an item missing a required coordinate, with a deep path", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    delete bad.floors[0].items[0].x;
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("config.floors[0].items[0].x"))).toBe(true);
  });
  it("rejects a bad kind enum and a bad rotation enum", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.floors[0].items[0].kind = "toaster";
    bad.floors[0].rotation = 45;
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("items[0].kind"))).toBe(true);
      expect(r.errors.some((e) => e.includes("rotation"))).toBe(true);
    }
  });
  it("collects multiple errors in one pass", () => {
    const r = validateConfig({ width: "x", height: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
  it("allows unknown extra keys", () => {
    expect(validateConfig({ ...valid, futureKey: 123 }).ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/validate.test.ts`
Expected: FAIL — `Cannot find module "./validate"`.

- [ ] **Step 4: Implement the validator**

Create `src/validate.ts`:

```ts
import type { FloorplanCardConfig } from "./types";

export type ValidationResult =
  | { ok: true; config: FloorplanCardConfig }
  | { ok: false; errors: string[] };

type Errs = string[];
type Check = (v: unknown, path: string) => Errs;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const e = (path: string, msg: string): Errs => [`${path}: ${msg}`];

const num: Check = (v, p) => (isNum(v) ? [] : e(p, "expected a number"));
const posNum: Check = (v, p) => (isNum(v) && v > 0 ? [] : e(p, "expected a positive number"));
const str: Check = (v, p) => (typeof v === "string" ? [] : e(p, "expected a string"));
const bool: Check = (v, p) => (typeof v === "boolean" ? [] : e(p, "expected a boolean"));
const oneOf =
  (...vals: unknown[]): Check =>
  (v, p) =>
    vals.includes(v) ? [] : e(p, `expected one of: ${vals.map(String).join(", ")}`);
const arrayOf =
  (c: Check): Check =>
  (v, p) =>
    Array.isArray(v) ? v.flatMap((it, i) => c(it, `${p}[${i}]`)) : e(p, "expected a list");
const point: Check = (v, p) =>
  Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) ? [] : e(p, "expected [x, y]");

/** required fields + optional fields; unknown keys are allowed (forward-compat). */
const shape =
  (req: Record<string, Check>, opt: Record<string, Check> = {}): Check =>
  (v, p) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return e(p, "expected an object");
    const o = v as Record<string, unknown>;
    const errs: Errs = [];
    for (const [k, c] of Object.entries(req)) {
      if (o[k] === undefined) errs.push(...e(`${p}.${k}`, "is required"));
      else errs.push(...c(o[k], `${p}.${k}`));
    }
    for (const [k, c] of Object.entries(opt)) if (o[k] !== undefined) errs.push(...c(o[k], `${p}.${k}`));
    return errs;
  };

const ITEM_KINDS = ["light","switch","sensor","binary_sensor","climate","cover","media_player","fan","camera","lock","humidifier","vacuum","generic"];
const FURNITURE_TYPES = ["table","roundTable","desk","chair","sofa","bed","wardrobe","rug","plant","fridge","stove","sink","toilet","stairs","tv","washer","dryer","dishwasher","waterHeater","airHandler","bathtub","vanity","sectional"];

const wall = shape({ id: str, x1: num, y1: num, x2: num, y2: num });
const opening = shape(
  { id: str, type: oneOf("door", "window"), x: num, y: num, length: num, angle: num },
  { motion: oneOf("swing", "slide"), entity: str, activeColor: str }
);
const item = shape(
  { id: str, x: num, y: num, kind: oneOf(...ITEM_KINDS) },
  { entity: str, secondaryEntity: str, name: str, icon: str, size: num, angle: num, showState: bool, showIcon: bool }
);
const text = shape({ id: str, x: num, y: num, text: str }, { size: num, color: str, angle: num });
const furniture = shape({ id: str, type: oneOf(...FURNITURE_TYPES), x: num, y: num, w: num, h: num }, { angle: num });
const tracker = shape({ id: str, x: num, y: num, w: num, h: num }, { angle: num });
const room = shape({ id: str, points: arrayOf(point) }, { name: str, areaId: str, fill: str, fillOpacity: num });

const elementLists = {
  walls: arrayOf(wall),
  openings: arrayOf(opening),
  items: arrayOf(item),
  texts: arrayOf(text),
  furniture: arrayOf(furniture),
  trackers: arrayOf(tracker),
  rooms: arrayOf(room),
};

const floor = shape(
  { id: str },
  { name: str, haFloor: str, image: str, imageOpacity: num, rotation: oneOf(0, 90, 180, 270), ...elementLists }
);

const config = shape(
  {},
  {
    type: str, title: str, width: posNum, height: posNum, grid: num, snap: num,
    background: str, defaultFloor: str, floors: arrayOf(floor), ...elementLists,
  }
);

export function validateConfig(raw: unknown): ValidationResult {
  const errors = config(raw, "config");
  return errors.length ? { ok: false, errors } : { ok: true, config: raw as FloorplanCardConfig };
}
```

- [ ] **Step 5: Run to verify pass; typecheck; commit**

Run: `npx vitest run src/validate.test.ts` → PASS. `npx tsc --noEmit` → clean.

```bash
git add src/validate.ts src/validate.test.ts
git commit -m "Add a dep-free config validator that collects all errors"
```

---

## Task 2: JSON/YAML parse, validate, and export via js-yaml

**Files:** Modify `src/validate.ts`, `src/validate.test.ts`, `package.json`.

**Interfaces:**
- Consumes: `validateConfig` (Task 1); `js-yaml`.
- Produces: `parseAndValidate(text: string): ValidationResult`; `configToText(config: FloorplanCardConfig): string`. Consumed by Task 4.

- [ ] **Step 1: Add js-yaml**

```bash
npm install js-yaml && npm install -D @types/js-yaml
```
Confirm `js-yaml` lands in `dependencies` and `@types/js-yaml` in `devDependencies` of `package.json`.

- [ ] **Step 2: Write the failing tests**

Append to `src/validate.test.ts`:

```ts
import { parseAndValidate, configToText } from "./validate";

describe("parseAndValidate", () => {
  const json = JSON.stringify(valid);
  const yaml = "type: custom:floorplan-card\nwidth: 1000\nheight: 600\nfloors:\n  - id: f1\n    items:\n      - id: i1\n        x: 5\n        y: 5\n        kind: light\n";
  it("accepts a JSON string", () => {
    expect(parseAndValidate(json).ok).toBe(true);
  });
  it("accepts an equivalent YAML string", () => {
    expect(parseAndValidate(yaml).ok).toBe(true);
  });
  it("reports a syntax error as one error, not a throw", () => {
    const r = parseAndValidate("{ this is: not valid: json or yaml ][");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(1);
  });
  it("reports validation errors for parseable-but-invalid input", () => {
    const r = parseAndValidate('{"width": "big"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((x) => x.startsWith("config.width"))).toBe(true);
  });
});

describe("configToText round-trip", () => {
  it("exports YAML that parses back to an equal config", () => {
    const text = configToText(valid as never);
    const r = parseAndValidate(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(valid);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/validate.test.ts`
Expected: FAIL — `parseAndValidate`/`configToText` not exported.

- [ ] **Step 4: Implement**

Add to the top of `src/validate.ts`:

```ts
import { load, dump } from "js-yaml";
```

Append to `src/validate.ts`:

```ts
/** Parse (YAML, a superset of JSON) then validate. A parse error is one error, not a throw. */
export function parseAndValidate(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = load(text);
  } catch (err) {
    return { ok: false, errors: [`Could not parse: ${(err as Error).message}`] };
  }
  return validateConfig(parsed);
}

/** Serialize a config to YAML for export (HA's config format). */
export function configToText(config: FloorplanCardConfig): string {
  return dump(config, { noRefs: true, lineWidth: 120 });
}
```

- [ ] **Step 5: Run to verify pass; typecheck; full suite; commit**

Run: `npx vitest run src/validate.test.ts` → PASS. `npx tsc --noEmit` → clean. `npx vitest run --reporter=dot` → green.

```bash
git add src/validate.ts src/validate.test.ts package.json package-lock.json
git commit -m "Parse JSON or YAML on import and export config as YAML"
```

---

## Task 3: Generated schema + worked example + drift guard

**Files:** Create `schema/floorplan-card.schema.json`, `schema/example.json`, `src/schema.test.ts`. Modify `package.json`.

**Interfaces:**
- Consumes: `validateConfig` (Task 1). Produces: the committed schema + example; `example` is imported by Task 4's Load-example button.

- [ ] **Step 1: Add the generator devDep and script**

```bash
npm install -D typescript-json-schema
```
Add to `package.json` `scripts`:
```json
"schema": "typescript-json-schema tsconfig.json FloorplanCardConfig --required --out schema/floorplan-card.schema.json"
```

- [ ] **Step 2: Generate and commit the schema**

Run: `npm run schema`
Expected: writes `schema/floorplan-card.schema.json`. Open it and confirm it has `"$schema"`, `"type": "object"`, and `properties.width`/`properties.height`.

- [ ] **Step 3: Write the worked example**

Create `schema/example.json`:

```json
{
  "type": "custom:floorplan-card",
  "title": "Example floor",
  "width": 1000,
  "height": 600,
  "floors": [
    {
      "id": "floor_main",
      "name": "Main",
      "rotation": 0,
      "walls": [{ "id": "w1", "x1": 100, "y1": 100, "x2": 900, "y2": 100 }],
      "rooms": [{ "id": "r1", "name": "Living", "points": [[100, 100], [900, 100], [900, 500], [100, 500]], "areaId": "living_room", "fill": "#e3f2fd" }],
      "items": [{ "id": "i1", "x": 500, "y": 300, "kind": "light", "entity": "light.living_room" }],
      "texts": [{ "id": "t1", "x": 200, "y": 200, "text": "Living Room" }]
    }
  ]
}
```

- [ ] **Step 4: Write the drift guard + example test**

Create `src/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as TJS from "typescript-json-schema";
import { validateConfig } from "./validate";
import example from "../schema/example.json";

const schemaPath = fileURLToPath(new URL("../schema/floorplan-card.schema.json", import.meta.url));
const tsconfigPath = fileURLToPath(new URL("../tsconfig.json", import.meta.url));

describe("schema", () => {
  it("the committed schema matches the current types (run `npm run schema` if this fails)", () => {
    // Use the SAME config-driven program the `npm run schema` CLI uses, so the
    // in-test generation and the committed file can't diverge on compiler opts.
    const program = TJS.programFromConfig(tsconfigPath);
    const generated = TJS.generateSchema(program, "FloorplanCardConfig", { required: true });
    const committed = JSON.parse(readFileSync(schemaPath, "utf8"));
    expect(generated).toEqual(committed);
  });

  it("the worked example validates", () => {
    expect(validateConfig(example).ok).toBe(true);
  });
});
```

If TypeScript complains about importing `../schema/example.json` from outside the `src` include, add `"schema"` to `tsconfig.json`'s `include` array (it stays out of the runtime bundle either way — only `example.json` is imported, and only into the editor).

- [ ] **Step 5: Run; commit**

Run: `npx vitest run src/schema.test.ts` → PASS (if the drift test fails, run `npm run schema` and re-commit the schema). `npx tsc --noEmit` → clean.

```bash
git add schema/floorplan-card.schema.json schema/example.json src/schema.test.ts package.json package-lock.json
git commit -m "Generate a JSON Schema from the types, with a drift guard and an example"
```

---

## Task 4: Editor Import / Export panel

**Files:** Modify `src/editor.ts` (`_renderPanelBody` gains the section; add `_importText`/`_importErrors` state, `_importConfig`/`_exportConfig`/`_loadExample`; import `parseAndValidate`/`configToText` from `./validate` and `example` from `../schema/example.json`).

**Interfaces:**
- Consumes: `parseAndValidate`, `configToText` (Task 2); `example` (Task 3); `_commit`.
- Produces: the Import/Export UI.

- [ ] **Step 1: Imports and state**

At the top of `src/editor.ts`:
```ts
import { parseAndValidate, configToText } from "./validate";
import example from "../schema/example.json";
```
Add reactive state near the other `@state()` fields:
```ts
  @state() private _importText = "";
  @state() private _importErrors: string[] = [];
```

- [ ] **Step 2: The handlers**

Add near the other project helpers:
```ts
  private _importConfig(): void {
    const r = parseAndValidate(this._importText);
    if (!r.ok) {
      this._importErrors = r.errors;
      return; // refuse: change nothing
    }
    this._importErrors = [];
    this._commit(r.config);
  }

  private _exportConfig(): void {
    this._importText = configToText(this._config);
    this._importErrors = [];
  }

  private _loadExample(): void {
    this._importText = configToText(example as never);
    this._importErrors = [];
  }
```

- [ ] **Step 3: The UI in `_renderPanelBody`**

Add, at the end of the `.rows.panel-body` div in `_renderPanelBody`, before its closing `</div>`:
```ts
        <div class="row wide import-export">
          <label>Import / Export</label>
          <textarea
            rows="8"
            placeholder="Paste a card config (JSON or YAML) and press Import"
            .value=${this._importText}
            @input=${(e: Event) => (this._importText = (e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <div class="ie-buttons">
            <button @click=${() => this._importConfig()}>Import</button>
            <button @click=${() => this._exportConfig()}>Export</button>
            <button @click=${() => this._loadExample()}>Load example</button>
          </div>
          ${this._importErrors.length
            ? html`<ul class="import-errors">
                ${this._importErrors.map((x) => html`<li>${x}</li>`)}
              </ul>`
            : nothing}
        </div>
```

- [ ] **Step 4: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: clean; all tests pass (no new tests this task — verified live in Task 5).

```bash
git add src/editor.ts
git commit -m "Add an Import/Export panel that validates and refuses bad configs"
```

---

## Task 5: Live verification and gate

**Files:** none changed.

- [ ] **Step 1: Build and gate**

Run: `npm run build && npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: build succeeds; typecheck clean; all tests pass. Confirm `dist/easy-floorplan-card.js` still contains the dashboard-required symbols (`sectional`, `waterHeater`, `airHandler`, `bathtub`, `vanity`, `media_player`, `label-only`, `fan_only`, `Detect rooms`).

- [ ] **Step 2: Exercise in the dev harness**

Serve (`npm run serve`). Open the PROJECT panel's Import/Export section and confirm:
- **Load example** fills the textarea with YAML; **Import** loads it (the canvas/preview shows the example floor).
- Paste a broken config (e.g. change an item's `x` to `"nope"`); **Import** shows an error list naming the path and the config does **not** change.
- **Export** fills the textarea with the current config as YAML that re-imports cleanly.

- [ ] **Step 3: Stop before deploy**

Do not run `install_ha.py` or push. Report the branch state to Amadeo. Update `06_Deliverables/home_assistant/WORKLOG.md` with the commits and #35's status, and move to the editor `stateStyles` repeater (item 3).

## Self-Review

**Spec coverage:** dep-free `validateConfig` collecting all errors → Task 1; JSON+YAML `parseAndValidate` + YAML `configToText` → Task 2; generated schema + drift guard + worked example → Task 3; Import/Export panel that refuses-don't-half-load → Task 4; verification → Task 5. ✓

**Placeholder scan:** every code step has complete code; every command has expected output. ✓

**Type consistency:** `ValidationResult` defined in Task 1, returned by `parseAndValidate` (Task 2) and consumed in Task 4; `validateConfig`/`parseAndValidate`/`configToText` signatures match across `validate.ts` and the editor; the enum arrays in `validate.ts` match the `types.ts` unions listed in Global Constraints. ✓

**Test altitude:** the validator, parse/round-trip, and schema drift are unit-tested; the editor panel is DOM wiring verified live (Task 5), per the repo's no-DOM-harness convention. The drift test runs `typescript-json-schema` in-process (a devDep) — if slow or environment-sensitive, it is the one heavier test, and is the price of closing the schema-vs-types drift gap. ✓
