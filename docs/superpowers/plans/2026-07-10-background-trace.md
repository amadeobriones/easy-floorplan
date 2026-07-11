# Background-Image Trace Underlay (3b) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between what `Floor.image`/`Floor.imageOpacity` already do (they are fully implemented — rendered on both the live card and the editor canvas, and already editable through a form) and what feature 3b asks for: a genuine trace workflow, which is missing exactly one thing — a way to lock the image's controls so opacity/URL can't be fat-fingered while the user is heads-down drawing walls over it.

**Architecture:** Add one new optional field, `Floor.imageLocked?: boolean`. Extend the existing `floorImageForm` (already wired into the editor's Project panel) to show a "Lock image" checkbox once an image is set, and to mark the image-URL and image-opacity fields `disabled` while locked. The lock checkbox itself and a new "Clear background image" button are gated behind `featureEnabled(config, "backgroundTrace")` (default off); the pre-existing URL + opacity fields are **not** newly gated — they predate this plan and must keep working exactly as they do today regardless of the flag. The live card (`floorplan-card.ts`) is untouched: locking is a pure editor-time affordance with no rendering effect, so it costs nothing on the live card in any configuration.

**Tech Stack:** Lit + TypeScript, Vitest, `typescript-json-schema` for the generated schema.

## Depends on

This plan MUST land after (currently unimplemented — `src/features.ts` does not yet exist):

1. `docs/superpowers/plans/2026-07-10-feature-toggles.md` — provides `FeaturesConfig` (with the `backgroundTrace?: boolean` key already reserved in that plan's `Produced interfaces` block), `FeatureName`, `FEATURE_DEFAULTS`, `FEATURE_META`, and `featureEnabled(config, name)` in `src/features.ts`; and `FloorplanCardConfig.features?: FeaturesConfig`. This plan **consumes** `featureEnabled` — it does not redefine it.

Before starting Task 3, run `ls src/features.ts`. If it does not exist, STOP and land the feature-toggles plan first (at minimum its Task 1) — do not re-implement `featureEnabled` here.

Unlike the live-overlay tracks (1b–1f), this plan does **not** depend on a layer-framework plan: the background image is a per-floor config field with its own dedicated editor form, not an entity-driven `LiveLayer`, so there is no `LIVE_LAYERS` registration and no runtime toggle chip involved.

## Explicitly out of scope

These are named in the roadmap doc (`docs/superpowers/specs/2026-07-10-vision-roadmap.md`, section 3b) as later, separate sub-projects. Nothing below is planned or built here:

- **RoomPlan/CAD scan geometry import** (auto-generating walls/rooms from a scan, tying into the dollhouse project). This plan only lets a user look at a static raster image while manually drawing over it.
- **Isometric / 2.5-D display mode.** Out of scope entirely; the plan does not touch `rotation` or projection.
- Multiple images per floor, image pan/zoom/reposition independent of the canvas, and image-file upload (the field is a URL string today; it stays a URL string).

## Global Constraints

- Nothing outward; local commits only; **no AI-authorship footers**; never push `feat/item-kinds-and-aspect`.
- Branch `feat/background-trace` off `main` (after feature-toggles merges).
- **Default off, zero cost when off:** with `backgroundTrace` unset/false, the editor's image controls are **byte-identical** to today — no lock checkbox, no "Clear background image" button, and the URL/opacity fields are never `disabled`. The live card (`floorplan-card.ts`) never reads `imageLocked` at all, in any configuration, so it is byte-identical regardless of the flag.
- **Additive schema:** adding `Floor.imageLocked` changes the generated schema → run `npm run schema` and commit the additive diff (the drift/schema test enforces it).
- Landmine: **no backticks in `css` tagged-template comments** (they break the Lit template). This plan does not need to touch the `css` template, but if a step ends up near one, keep this in mind.
- Run per file: `npx vitest run src/<file>.test.ts`. Full suite: `npx vitest run --reporter=dot`. Typecheck: `npx tsc --noEmit` (aka `npm run typecheck`). Build: `npm run build`. Schema: `npm run schema`.

## Produced interfaces (exact names/types)

```ts
// src/types.ts — Floor gains one field (image/imageOpacity already exist, unchanged):
export interface Floor {
  // ...existing fields unchanged (image?: string; imageOpacity?: number; ...)
  /**
   * Editor-only: when true and the `backgroundTrace` feature is on, the
   * image URL and opacity controls are disabled in the editor so they can't
   * be changed by accident while tracing. Has no effect on the live card —
   * `floorplan-card.ts` never reads this field.
   */
  imageLocked?: boolean;
}

// src/editor-forms.ts — FormField gains one optional flag:
export interface FormField {
  // ...existing fields unchanged...
  disabled?: boolean; // renders/forwards a disabled control in both the ha-form and fallback paths
}

// floorImageForm gains a second, defaulted parameter — existing call sites/tests
// that omit it are unaffected (traceEnabled defaults to false, identical to today):
export function floorImageForm(f: Floor, traceEnabled?: boolean): FormSpec;
// When traceEnabled is false (default): behaves exactly as today — no
// "imageLocked" field ever appears, and image/imageOpacity are never disabled.
// When traceEnabled is true and f.image is set: adds an "imageLocked" boolean
// field; image/imageOpacity carry disabled: true whenever f.imageLocked is true.
```

Consumer: `src/editor.ts`'s Project panel body, which already calls
`floorImageForm(this._floor())` at `editor.ts:2979` — it starts passing
`featureEnabled(this._config, "backgroundTrace")` as the second argument, and
gains one new plain button ("Clear background image") gated the same way.

## File Structure

- `src/types.ts` — add `imageLocked?: boolean` to `Floor` (next to `image`/`imageOpacity`, ~line 495).
- `src/validate.ts` — add `imageLocked: bool` to the floor optional-shape map (~line 76).
- `src/editor-forms.ts` — add `disabled?: boolean` to `FormField`; extend `floorImageForm` (~line 582) to accept `traceEnabled` and add the lock field + `disabled` wiring.
- `src/editor.ts` — import `featureEnabled` from `./features`; update the `floorImageForm(...)` call site (~line 2979); thread `disabled` through the plain-input fallback renderer's number/range/text branches (~lines 2391–2477); add a gated "Clear background image" button next to the form.
- `src/validate.test.ts`, `src/editor-forms.test.ts` — new/extended tests.
- `schema/floorplan-card.schema.json` — regenerated (additive) by `npm run schema`.
- `floorplan-card.ts` — **not modified.** Confirmed in Task 1 that the live card has no interaction to lock; the lock is purely an editor safety toggle over the existing form fields.

---

## Task 1: Current-state audit (no code change)

**Files:** none modified. This task's "test" is confirming the baseline is green and the assumptions below hold in the checked-out tree before any edit is made — if any grep below returns something different from what's documented, STOP and re-scope before continuing to Task 2.

**Interfaces:**
- Consumes: nothing.
- Produces: the confirmed baseline that every later task assumes.

- [ ] **Step 1: Confirm the type already exists**

```bash
grep -n "image" src/types.ts
```

Expected (already true as of this plan's audit): `Floor` has `image?: string` (~line 493, "Optional background image URL … handy for tracing over a real floor plan") and `imageOpacity?: number` (~line 495, "Background image opacity, 0–1. Default 1."). No `imageLocked` field exists yet — that is the gap this plan closes.

- [ ] **Step 2: Confirm the validator already accepts it**

```bash
grep -n "image" src/validate.ts
```

Expected: the `floor` shape (~line 76) already lists `image: str, imageOpacity: num` as optional fields. `imageLocked` is not listed — gap.

- [ ] **Step 3: Confirm the live card already renders it**

```bash
grep -n "image" src/floorplan-card.ts
```

Expected: `floorplan-card.ts:351-354` — inside `render()`, the active floor's SVG draws
`active.image ? svg`<image href=${active.image} x="0" y="0" width=${c.width} height=${c.height} preserveAspectRatio="none" opacity=${active.imageOpacity ?? 1} />` : nothing`
as the first element in the floor's `<svg>` (before rooms/furniture/walls), so it is already the backmost layer — everything else already draws on top of it. There is no pointer/drag handler on this `<image>` element and no code path that could move or resize it from the live card. **Conclusion: the live card needs zero changes for this feature.**

- [ ] **Step 4: Confirm the editor canvas already previews it**

```bash
grep -n "image" src/editor.ts
```

Expected: `editor.ts:2225-2228` — the editor's own canvas SVG draws the identical `<image>` element (same opacity/z-order logic) directly beneath the grid/rooms/walls. **Conclusion: no new render code is needed for the image itself — it is already visible while editing.**

- [ ] **Step 5: Confirm the editor already has a working set/clear/opacity control**

```bash
grep -n "floorImageForm" src/editor-forms.ts src/editor.ts
```

Expected: `editor-forms.ts:582-594` defines `floorImageForm(f: Floor): FormSpec` — a "Bg image" text field (always shown) plus an "Image opacity" slider field (shown only once `f.image` is truthy). It is wired into the editor's Project panel at `editor.ts:2979-2982` via `this._renderForm(floorImageForm(this._floor()), ...)`, patching through `_patchFloorLive`/`_commitFloor` (live-drag vs. discrete-commit, matching every other form in the editor).

Also confirm the empty-string-clears-cleanly behavior (`editor-forms.ts:57-95`, `normalizeFormPatch`): for a `text` selector that is not `required`, an empty value normalizes to `undefined`, not `""`. So clearing the "Bg image" field today already removes the `image` key from the floor cleanly (and `active.image ? … : nothing` in both render paths already treats a falsy value as "no image"). **Conclusion: set + clear + opacity adjustment already work end-to-end. No new field is needed to "add" this — it already exists.**

- [ ] **Step 6: Confirm there is no lock and nothing gated behind a feature flag**

```bash
grep -n "imageLocked\|locked" src/types.ts src/validate.ts src/editor.ts src/editor-forms.ts
ls src/features.ts 2>/dev/null || echo "features.ts does not exist yet — feature-toggles plan not landed"
```

Expected: no `imageLocked`/`locked` hits anywhere (confirms the one real gap), and `src/features.ts` is absent until the feature-toggles plan lands (confirms the dependency noted above).

- [ ] **Step 7: Baseline green**

```bash
npx vitest run --reporter=dot && npx tsc --noEmit
```

Expected: PASS, 0 failures, clean typecheck — this is the baseline every later task's regression claims are measured against.

**Summary of the gap (carried into Tasks 2–4):** `Floor.image`/`imageOpacity` are fully implemented and already editable. The only missing piece is a lock: `Floor.imageLocked?: boolean`, an editor-only checkbox (shown once an image is set) that disables the URL/opacity fields while true, plus a convenience "Clear background image" button — both gated behind `featureEnabled(config, "backgroundTrace")` since they are new, trace-specific affordances. The pre-existing URL/opacity fields stay ungated (they are not new, and hiding them behind a flag would be a regression for anyone already using `image` today).

## Task 2: `Floor.imageLocked` field + validator + schema

**Files:**
- Modify: `src/types.ts` (`Floor`, ~line 495)
- Modify: `src/validate.ts` (floor optional shape, ~line 76)
- Modify (generated): `schema/floorplan-card.schema.json`
- Test: `src/validate.test.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `Floor.imageLocked?: boolean`.

- [ ] **Step 1: Write the failing test** — append to `src/validate.test.ts` (match the file's existing `validateConfig` import; grep its top if unsure):

```ts
it("accepts a floor with imageLocked", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    floors: [{ id: "f1", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [],
      image: "plan.png", imageOpacity: 0.5, imageLocked: true }],
  });
  expect(r.ok).toBe(true);
});
it("rejects a non-boolean imageLocked", () => {
  const r = validateConfig({
    type: "x", width: 10, height: 10,
    floors: [{ id: "f1", walls: [], openings: [], items: [], texts: [], furniture: [], trackers: [],
      imageLocked: "yes" }],
  });
  expect(r.ok).toBe(false);
});
```

- [ ] **Step 2: Run it, verify the reject case fails**

Run: `npx vitest run src/validate.test.ts`
Expected: the "rejects a non-boolean imageLocked" case FAILS (today the floor shape does not check `imageLocked`, so `"yes"` passes and `r.ok` is `true`). The "accepts" case already passes (unknown keys are allowed) — that is fine.

- [ ] **Step 3: Add the field to the type** — in `src/types.ts`, inside `interface Floor`, add directly after `imageOpacity?: number;` (~line 495):

```ts
  /**
   * Editor-only: when true and the `backgroundTrace` feature is on, the
   * image URL and opacity controls are disabled in the editor so they can't
   * be changed by accident while tracing. Has no effect on the live card —
   * `floorplan-card.ts` never reads this field.
   */
  imageLocked?: boolean;
```

- [ ] **Step 4: Add the validator check** — in `src/validate.ts`, add `imageLocked: bool` to the floor optional-field map (~line 76). The `floor` shape call becomes:

```ts
const floor = shape(
  { id: str },
  {
    name: str, haFloor: str, image: str, imageOpacity: num, imageLocked: bool,
    rotation: oneOf(0, 90, 180, 270), ...elementLists,
  },
);
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/validate.test.ts`
Expected: PASS (the non-boolean case now fails validation → `r.ok === false`).

- [ ] **Step 6: Regenerate the schema**

Run: `npm run schema`
Expected: `schema/floorplan-card.schema.json` gains an `imageLocked` boolean property under the `Floor` definition (additive diff only — no removed/renamed properties elsewhere).

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/types.ts src/validate.ts src/validate.test.ts schema/floorplan-card.schema.json
git commit -m "Add Floor.imageLocked, validate it, and regenerate schema"
```

## Task 3: Lock field + disabled wiring in `floorImageForm`

**Files:**
- Modify: `src/editor-forms.ts` (`FormField` interface, `floorImageForm`, ~lines 31-37, 582-594)
- Test: `src/editor-forms.test.ts` (extend the `floorImageForm` describe block, ~line 205)

**Interfaces:**
- Consumes: `Floor.imageLocked` (Task 2).
- Produces: `FormField.disabled?: boolean`; `floorImageForm(f: Floor, traceEnabled?: boolean): FormSpec` (exact signature from the "Produced interfaces" block above).

- [ ] **Step 1: Write the failing tests** — extend the `describe("wallForm / projectForm / floorImageForm", ...)` block in `src/editor-forms.test.ts` (after the existing "image opacity appears only when an image is set" test, ~line 223):

```ts
  it("omits the lock field and never disables anything when traceEnabled is false (default)", () => {
    const locked = { image: "x.png", imageOpacity: 0.5, imageLocked: true } as Floor;
    const spec = floorImageForm(locked); // traceEnabled omitted — must match today exactly
    expect(spec.fields.map((x) => x.name)).not.toContain("imageLocked");
    expect(spec.fields.find((x) => x.name === "image")!.disabled).toBeFalsy();
    expect(spec.fields.find((x) => x.name === "imageOpacity")!.disabled).toBeFalsy();
  });

  it("adds the lock field only once an image is set and traceEnabled is true", () => {
    expect(floorImageForm({ image: "x.png" } as Floor, true).fields.map((x) => x.name)).toContain(
      "imageLocked"
    );
    expect(floorImageForm({} as Floor, true).fields.map((x) => x.name)).not.toContain("imageLocked");
  });

  it("disables the URL/opacity fields (not the lock field itself) while locked and traceEnabled", () => {
    const locked = { image: "x.png", imageOpacity: 0.5, imageLocked: true } as Floor;
    const spec = floorImageForm(locked, true);
    expect(spec.fields.find((x) => x.name === "image")!.disabled).toBe(true);
    expect(spec.fields.find((x) => x.name === "imageOpacity")!.disabled).toBe(true);
    expect(spec.fields.find((x) => x.name === "imageLocked")!.disabled).toBeFalsy();
  });

  it("leaves the URL/opacity fields enabled when traceEnabled but not locked", () => {
    const unlocked = { image: "x.png", imageOpacity: 0.5 } as Floor;
    const spec = floorImageForm(unlocked, true);
    expect(spec.fields.find((x) => x.name === "image")!.disabled).toBeFalsy();
    expect(spec.fields.find((x) => x.name === "imageOpacity")!.disabled).toBeFalsy();
  });
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/editor-forms.test.ts`
Expected: FAIL — `floorImageForm` does not yet accept a second argument and never produces an `imageLocked` field or a `disabled` property (TypeScript may also flag the extra argument once `noImplicitAny`/strict checks run through `tsc`, but Vitest's transpile is lenient — the assertions themselves fail).

- [ ] **Step 3: Add `disabled` to `FormField`** — in `src/editor-forms.ts`, extend the interface (~line 31):

```ts
export interface FormField {
  name: string;
  label: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  selector: Record<string, unknown>;
}
```

- [ ] **Step 4: Extend `floorImageForm`** — replace the existing function (`editor-forms.ts:582-594`) with:

```ts
export function floorImageForm(f: Floor, traceEnabled = false): FormSpec {
  const locked = traceEnabled && !!f.imageLocked;
  const fields: FormField[] = [
    {
      name: "image",
      label: "Bg image",
      helper: "/local/floorplan.png or URL",
      selector: { text: {} },
      disabled: locked,
    },
  ];
  if (f.image) {
    fields.push({
      name: "imageOpacity",
      label: "Image opacity",
      selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } },
      disabled: locked,
    });
    if (traceEnabled) {
      fields.push({
        name: "imageLocked",
        label: "Lock image",
        helper: "Disable the URL/opacity controls above so they can't be changed by accident while tracing.",
        selector: { boolean: {} },
      });
    }
  }
  return {
    fields,
    data: { image: f.image ?? "", imageOpacity: f.imageOpacity ?? 1, imageLocked: !!f.imageLocked },
    toPatch: identity,
  };
}
```

(`identity` is already imported/defined in this file for the sibling forms — reuse it, do not redefine it. Confirm with `grep -n "^const identity\|identity =" src/editor-forms.ts` if the exact name differs.)

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/editor-forms.test.ts`
Expected: PASS, including the pre-existing "image opacity appears only when an image is set" test (unaffected — it omits the second argument, which defaults to `false`).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/editor-forms.ts src/editor-forms.test.ts
git commit -m "Add an editor-only image lock field, gated by traceEnabled"
```

## Task 4: Wire the lock into the editor UI (feature-gated)

**Files:**
- Modify: `src/editor.ts` (imports; the `floorImageForm` call site ~line 2979; the plain-input fallback renderer ~lines 2391–2477; a new "Clear background image" button next to the form)

No new unit test — this is DOM/editor UI, verified live per this repo's existing convention (see `docs/superpowers/plans/2026-07-10-feature-toggles.md` Task 3 and `2026-07-10-energy-layer.md` Task 4, both DOM-only with no new test file). tsc + full suite + build stay green as the regression gate; the live-verification checklist in Task 5 covers the actual behavior.

**Interfaces:**
- Consumes: `featureEnabled` from `./features` (Task 2 of the feature-toggles plan — confirm `ls src/features.ts` succeeds before starting, per "Depends on" above); `floorImageForm(f, traceEnabled)` and `FormField.disabled` (Task 3, this plan).
- Produces: nothing new for other tasks to consume — this is the plan's UI leaf.

- [ ] **Step 1: Import `featureEnabled`** — in `src/editor.ts`, add to the existing import block from `./features` (create the import if none exists yet — check first with `grep -n "from \"./features\"" src/editor.ts`):

```ts
import { featureEnabled } from "./features";
```

- [ ] **Step 2: Update the `floorImageForm` call site** — in `_renderPanelBody` (`editor.ts:2979-2982`), replace:

```ts
        ${this._renderForm(floorImageForm(this._floor()), (patch, live) => {
          if (live) this._patchFloorLive(patch as Partial<Floor>);
          else this._commitFloor(patch as Partial<Floor>);
        })}
```

with:

```ts
        ${this._renderForm(
          floorImageForm(this._floor(), featureEnabled(this._config, "backgroundTrace")),
          (patch, live) => {
            if (live) this._patchFloorLive(patch as Partial<Floor>);
            else this._commitFloor(patch as Partial<Floor>);
          }
        )}
        ${featureEnabled(this._config, "backgroundTrace") && this._floor().image
          ? html`<div class="row">
              <label></label>
              <button
                ?disabled=${!!this._floor().imageLocked}
                title="Remove the background image, its opacity, and its lock"
                @click=${() =>
                  this._commitFloor({ image: undefined, imageOpacity: undefined, imageLocked: undefined })}
              >
                Clear background image
              </button>
            </div>`
          : nothing}
```

(`this._floor()` returns the active `Floor`, already used throughout this file — `editor.ts:298-301`. `_commitFloor` is the discrete/undo-tracked patch helper — `editor.ts:304-306`, same one every other floor-level edit in this panel uses.)

- [ ] **Step 3: Thread `disabled` through the plain-input fallback renderer** — in `_renderFallbackField` (`editor.ts:2354-2478`), the two branches this feature touches are the number/slider branch and the default (bare) text-input branch. Update the range input and the number input inside the `if ("number" in sel)` branch (~lines 2391-2424):

```ts
        ${slider
          ? html`<input
              type="range"
              min=${n.min ?? 0}
              max=${n.max ?? 100}
              step=${n.step ?? 1}
              .value=${String(value ?? n.min ?? 0)}
              ?disabled=${f.disabled ?? false}
              @input=${(e: Event) =>
                this._applyFallback(spec, f, Number((e.target as HTMLInputElement).value), true, apply)}
            />`
          : nothing}
        <input
          class="num"
          type="number"
          min=${n.min ?? nothing}
          max=${n.max ?? nothing}
          step=${n.step ?? nothing}
          .value=${String(value ?? "")}
          ?disabled=${f.disabled ?? false}
          @change=${(e: Event) => {
```

(Only the two `<input>` tags gain `?disabled=${f.disabled ?? false}`; the surrounding `@change` handler body is unchanged.)

And the default (bare) text branch at the end of the function (~lines 2469-2477), which is what "Bg image" actually falls through to (it has no `"text" in sel` early-return in this function — confirm with `grep -n '"text" in sel' src/editor.ts`, expected: no match, it hits the catch-all):

```ts
    return html`<div class="row">
      <label>${f.label}</label>
      <input
        type="text"
        .value=${String(value ?? "")}
        ?disabled=${f.disabled ?? false}
        @input=${(e: Event) =>
          this._applyFallback(spec, f, (e.target as HTMLInputElement).value, true, apply)}
      />
    </div>`;
```

Leave the `select`/`boolean`/`entity`/`area`/`icon` branches untouched — no field this plan adds uses them (the `imageLocked` field's own checkbox is never disabled, so its `boolean` branch needs no change).

Note: the `ha-form` branch of `_renderForm` (`editor.ts:2319-2339`) needs no code change — it passes `spec.fields` straight through as `.schema`, and HA's `ha-form` natively honors a `disabled` property on each schema row. This is the one part of this task that can only be exercised inside a real Home Assistant frontend (`customElements.get("ha-form")` is false in the Vitest/Node test environment, so the fallback path above is what the automated tests cover) — verify it live in Task 5.

- [ ] **Step 4: Typecheck + full suite + build**

```bash
npx tsc --noEmit && npx vitest run --reporter=dot && npm run build
```

Expected: all green, and no existing test's assertions about `_renderFallbackField`'s number/text branches change shape (they only gain an attribute that defaults to `false`/absent).

- [ ] **Step 5: Commit**

```bash
git add src/editor.ts
git commit -m "Gate an image-lock toggle and a clear button behind backgroundTrace"
```

## Task 5 (controller): Verify + gate

- [ ] Full suite + tsc + build green: `npx vitest run --reporter=dot && npx tsc --noEmit && npm run build`.
- [ ] Schema is committed and the drift/schema test passes (`npx vitest run src/schema.test.ts`).
- [ ] **Byte-identical off (regression guard):** open the dev harness with a config that has `floors: [{ ..., image: "some.png", imageOpacity: 0.8 }]` and no `features` block (or `features: { backgroundTrace: false }`). Confirm: the "Bg image" field and "Image opacity" slider render exactly as before this plan (both fully editable, neither shows a disabled state); no "Lock image" checkbox appears; no "Clear background image" button appears. This is the literal "an existing plan upgrading to a new version looks exactly the same" guarantee from the roadmap doc.
- [ ] **On path:** set `features: { backgroundTrace: true }` on the same config. Confirm: setting an image reveals the opacity slider (unchanged prior behavior) and now also a "Lock image" checkbox and a "Clear background image" button. Check "Lock image": the URL field and opacity slider visibly disable (grey out, refuse focus/typing) while the checkbox itself stays clickable; uncheck it and confirm both re-enable. Click "Clear background image" while unlocked: image, opacity, and the lock all clear and the image disappears from the canvas preview; while locked, confirm the button is disabled and does nothing.
- [ ] Confirm the live card (not the editor) is unaffected in every combination above — `floorplan-card.ts` was not modified, so there is nothing to check beyond "the card still renders the image + opacity exactly as it always has" with the flag in any state.
- [ ] This plan produces working, testable software on its own: the type/validator/schema (Task 2) and the pure `floorImageForm` gating logic (Task 3) are unit-tested; Task 4's DOM wiring is covered by the full suite staying green plus this live checklist.

## Self-Review

- **Spec coverage (3b, in-scope part):** current-state audit before any code (Task 1) confirms `image`/`imageOpacity` are already rendered on both the live card and the editor canvas, and already editable end-to-end (set, adjust opacity, clear) — so the plan does not reinvent them. The one real gap, a lock that prevents accidental edits to those controls while tracing, is added as `Floor.imageLocked` (Task 2) and a gated editor affordance (Tasks 3–4). Explicitly out of scope: RoomPlan/CAD scan import and isometric/2.5-D mode, called out by name with a pointer to where they'll live as future sub-projects. ✓
- **Enable/disable requirement:** the pre-existing image/opacity fields are deliberately left ungated (gating them would be a regression for existing users of `image`); only the two new affordances (lock checkbox, clear button) are gated behind `featureEnabled(config, "backgroundTrace")`, defaulting off via the feature-toggles plan's `FEATURE_DEFAULTS`. Byte-identical-when-off is checked live in Task 5 and structurally guaranteed by `floorImageForm`'s `traceEnabled = false` default (Task 3's first test asserts this directly). ✓
- **Zero cost when off / when no image set:** no entities are involved in this feature at all (a static image URL, not an HA entity), so there is no `collectWatchedEntities` concern to guard — noted in the Architecture section. When no image is set, `floorImageForm` never adds the opacity or lock fields (pre-existing behavior, unchanged). ✓
- **Live-card untouched:** confirmed in Task 1 Step 3 that `floorplan-card.ts` has no interaction to lock and needs no edit; Task 5 explicitly re-verifies this for every flag/lock combination. ✓
- **Editor DOM steps verified live:** Task 4 calls out that the `ha-form` path can only be exercised inside real Home Assistant (not the Node test environment) and defers that check to Task 5's live checklist; the fallback-path DOM changes are covered by the full automated suite staying green. ✓
- **Placeholder scan:** every code step shows real code with exact paths and line numbers; the two "confirm with grep" asides (`identity` name, `"text" in sel` absence) are lookups against existing code the implementer must reconcile, not deferred implementation. ✓
- **Type consistency:** `Floor.imageLocked`, `FormField.disabled`, `floorImageForm(f, traceEnabled)`, and the `imageLocked`/`image`/`imageOpacity` field names are identical across the Produced-interfaces block, every task, and every test. ✓
- **No backticks in css comments (n/a — no css template touched); additive schema; no AI-authorship footers; nothing pushed outside `origin`.** ✓
