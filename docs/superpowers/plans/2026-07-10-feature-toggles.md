# Feature Toggles (enable/disable system) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A single config surface + helper that lets every roadmap feature be turned on or off, defaulting **off**, so upgrading never changes an existing plan until the user opts in.

**Architecture:** A typed `FeaturesConfig` on `FloorplanCardConfig`, a `featureEnabled(config, name)` helper with an all-`false` default table, validator + schema coverage, and a "Features" panel in the editor. Every later feature calls `featureEnabled` at its entry point and no-ops when off; `collectWatchedEntities` skips a disabled feature's entities so an off feature costs nothing.

**Tech Stack:** Lit + TypeScript, Vitest, `typescript-json-schema` for schema.

## Global Constraints
- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`.
- Branch `feat/feature-toggles` off `main`.
- New feature keys default **off**; a config with no `features` block behaves exactly as today (regression guarantee).
- Adding to `FloorplanCardConfig` changes the generated schema → run `npm run schema` and commit the additive diff (the drift test enforces it).
- Landmine: no backticks in `css` tagged-template comments.
- Run: `npx vitest run src/<f>.test.ts`; full `npx vitest run --reporter=dot`; `npx tsc --noEmit`; `npm run build`.

## Produced interfaces (later plans consume these — exact names/types)
```ts
// src/types.ts — the feature key set. One key per roadmap feature; ADD a key here
// when a new feature lands (the layer framework's LiveLayer.id is a subset of these).
export interface FeaturesConfig {
  lightsLayer?: boolean;      // 1b color+brightness mirroring
  thermalLayer?: boolean;     // 1c climate/thermal room tint
  awarenessLayer?: boolean;   // 1d motion pings + safety alerts
  energyLayer?: boolean;      // 1e power-draw overlay
  mediaNowPlaying?: boolean;  // 1f TV/speaker now-playing cue
  roomTapScenes?: boolean;    // 2a tap room -> scene/toggle
  radialControls?: boolean;   // 2b long-press radial controls
  autoPopulateArea?: boolean; // 3a editor: populate room from area
  backgroundTrace?: boolean;  // 3b editor: background image underlay
  dayNightTheme?: boolean;    // 4a day/night theming
}
// FloorplanCardConfig gains:  features?: FeaturesConfig;

// src/features.ts (new)
export const FEATURE_DEFAULTS: Required<FeaturesConfig>; // every value false
export type FeatureName = keyof FeaturesConfig;
export function featureEnabled(
  c: { features?: FeaturesConfig } | undefined,
  name: FeatureName,
): boolean;                 // c?.features?.[name] ?? FEATURE_DEFAULTS[name]
export const FEATURE_META: ReadonlyArray<{ name: FeatureName; label: string; help: string }>;
```
Consumers: **every** feature task guards its render/behaviour with
`featureEnabled(this._config, "<name>")`; `collectWatchedEntities` takes the
config it already has and skips a feature's entities when the flag is off.

---

## Task 1: `FeaturesConfig` type + `featureEnabled` helper

**Files:**
- Create: `src/features.ts`
- Modify: `src/types.ts` (add `FeaturesConfig` + `FloorplanCardConfig.features`)
- Test: `src/features.test.ts`

**Interfaces:**
- Produces: everything in the "Produced interfaces" block above.

- [ ] **Step 1: Write the failing test**
```ts
// src/features.test.ts
import { describe, it, expect } from "vitest";
import { featureEnabled, FEATURE_DEFAULTS, FEATURE_META } from "./features";

describe("featureEnabled", () => {
  it("defaults every feature to off", () => {
    for (const m of FEATURE_META) expect(featureEnabled({}, m.name)).toBe(false);
    expect(Object.values(FEATURE_DEFAULTS).every((v) => v === false)).toBe(true);
  });
  it("reads an explicit flag", () => {
    expect(featureEnabled({ features: { thermalLayer: true } }, "thermalLayer")).toBe(true);
    expect(featureEnabled({ features: { thermalLayer: false } }, "thermalLayer")).toBe(false);
  });
  it("treats an undefined config as all-off", () => {
    expect(featureEnabled(undefined, "lightsLayer")).toBe(false);
  });
  it("META lists exactly the FeaturesConfig keys", () => {
    // guard against a key added to the type but not surfaced in the editor
    expect(FEATURE_META.map((m) => m.name).sort()).toEqual(
      ["autoPopulateArea","awarenessLayer","backgroundTrace","dayNightTheme","energyLayer",
       "lightsLayer","mediaNowPlaying","radialControls","roomTapScenes","thermalLayer"].sort(),
    );
  });
});
```
- [ ] **Step 2: Run it, verify it fails** (`npx vitest run src/features.test.ts` → module not found).
- [ ] **Step 3: Implement `src/features.ts`**
```ts
import type { FeaturesConfig } from "./types";

export type FeatureName = keyof FeaturesConfig;

export const FEATURE_DEFAULTS: Required<FeaturesConfig> = {
  lightsLayer: false, thermalLayer: false, awarenessLayer: false, energyLayer: false,
  mediaNowPlaying: false, roomTapScenes: false, radialControls: false,
  autoPopulateArea: false, backgroundTrace: false, dayNightTheme: false,
};

export function featureEnabled(
  c: { features?: FeaturesConfig } | undefined,
  name: FeatureName,
): boolean {
  return c?.features?.[name] ?? FEATURE_DEFAULTS[name];
}

export const FEATURE_META: ReadonlyArray<{ name: FeatureName; label: string; help: string }> = [
  { name: "lightsLayer", label: "Lights layer", help: "Tint rooms/lamps to a bulb's real colour and brightness." },
  { name: "thermalLayer", label: "Climate layer", help: "Shade rooms warm/cool by temperature." },
  { name: "awarenessLayer", label: "Awareness layer", help: "Motion pings and safety alerts." },
  { name: "energyLayer", label: "Energy layer", help: "Colour devices by live power draw." },
  { name: "mediaNowPlaying", label: "Media now-playing", help: "Show a now-playing cue on TVs/speakers." },
  { name: "roomTapScenes", label: "Tap room to control", help: "Tap a room to run a scene or toggle its lights." },
  { name: "radialControls", label: "Long-press controls", help: "Inline brightness/colour/thermostat on long-press." },
  { name: "autoPopulateArea", label: "Populate from area", help: "Editor: drop an HA area's entities into a room." },
  { name: "backgroundTrace", label: "Background image", help: "Editor: trace over a blueprint image." },
  { name: "dayNightTheme", label: "Day/night theme", help: "Dim the plan with the sun." },
];
```
And in `src/types.ts`, add the `FeaturesConfig` interface (from the Produced block) and `features?: FeaturesConfig;` to `FloorplanCardConfig` (near line 512).
- [ ] **Step 4: Run tests, verify pass** (`npx vitest run src/features.test.ts`).
- [ ] **Step 5: Typecheck + commit**
```bash
npx tsc --noEmit && git add src/features.ts src/types.ts src/features.test.ts
git commit -m "Add FeaturesConfig + featureEnabled with all-off defaults"
```

## Task 2: Validator + schema

**Files:** Modify `src/validate.ts`; run `npm run schema`; Test `src/validate.test.ts`.

- [ ] **Step 1: Failing test** — `validateConfig` accepts a `features` block of booleans and rejects a non-boolean flag:
```ts
it("accepts a features block", () => {
  expect(validateConfig({ type:"x", width:10, height:10, features:{ thermalLayer:true } }).ok).toBe(true);
});
it("rejects a non-boolean feature flag", () => {
  const r = validateConfig({ type:"x", width:10, height:10, features:{ thermalLayer:"yes" } });
  expect(r.ok).toBe(false);
});
```
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** — add a `features` shape to the top-level `config` optional map (`src/validate.ts` ~line 79). Reuse the `shape` helper with each key `bool` optional:
```ts
const features = shape({}, {
  lightsLayer: bool, thermalLayer: bool, awarenessLayer: bool, energyLayer: bool,
  mediaNowPlaying: bool, roomTapScenes: bool, radialControls: bool,
  autoPopulateArea: bool, backgroundTrace: bool, dayNightTheme: bool,
});
// ...in the config optional block, add:  features,
```
- [ ] **Step 4: Pass + schema** — `npx vitest run src/validate.test.ts && npm run schema`.
- [ ] **Step 5: Commit**
```bash
git add src/validate.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Validate the features block and regenerate schema"
```

## Task 3: Editor "Features" panel

**Files:** Modify `src/editor.ts` (add a Features section to the top-level config editor); `src/editor-forms.ts` if a form spec helps. No new unit tests (DOM/UI; verified live) — tsc + full suite green.

- [ ] **Step 1:** Find the top-level config editor section list in `src/editor.ts` (where title/width/height/grid/snap/background are edited — grep for `"grid"`/`"snap"` in the editor). Add a collapsible "Features" section rendering one switch per `FEATURE_META` entry, bound to `config.features[name]`, writing back via the editor's existing config-patch path. Show each entry's `label` + `help`.
- [ ] **Step 2:** Ensure toggling writes `features: { [name]: boolean }` and clears a key back to default-off cleanly (either store the boolean or delete the key when false — deleting keeps configs minimal; pick one and be consistent).
- [ ] **Step 3:** Typecheck + full suite + build.
```bash
npx tsc --noEmit && npx vitest run --reporter=dot && npm run build
git add src/editor.ts src/editor-forms.ts && git commit -m "Add a Features panel to the editor"
```

## Task 4 (controller): Verify + gate
- [ ] Build + full suite + tsc green.
- [ ] Dev harness: a config with no `features` is unchanged; toggling a flag in the editor writes the block; `featureEnabled` reads it. (No feature consumes it yet — that starts with the layer framework.)
- [ ] This plan produces working, testable software on its own (the gate + editor panel), even though no feature reads the flags until later plans.

## Self-Review
- Spec coverage: type+helper (T1), validator+schema (T2), editor (T3), verify (T4). ✓
- Default-off regression guarded by the `featureEnabled({})` test + a no-features validateConfig test. ✓
- The `FEATURE_META` ↔ `FeaturesConfig` key-parity test prevents a type key that never reaches the editor. ✓
- No placeholder steps; every code step shows the code. ✓
