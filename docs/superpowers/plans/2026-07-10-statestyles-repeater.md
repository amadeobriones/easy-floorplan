# Editor stateStyles Repeater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit all of an element's `StateStyle[]` rules in the GUI — a repeater for rooms and items, replacing the room's `light`/`lit` shorthand.

**Architecture:** Pure `src/statestyles.ts` add/remove/set helpers (tested); a `_renderStateStyleRows` custom sub-editor in the editor (mirroring the tracker sensor rows); rooms drop `light`/`lit` from `roomForm`; both room and item selection editors render the repeater.

**Tech Stack:** TypeScript, Lit, vitest (pure-function tests; no DOM harness).

## Global Constraints

- **Nothing goes out.** No PR/issue/comment. Local commits only; do not push unless asked. **No AI-authorship footers.**
- **Never push `feat/item-kinds-and-aspect`** (open PR #40 head).
- Branch `feat/editor-statestyles` off `main`.
- Pure helpers (`statestyles.ts`) are DOM-free and deterministic.
- Field-edit UX mirrors existing patterns: text/number/select/entity via `@change` → commit (one undo); the colour **swatch** via `@input` → live; the colour **text** via `@change` → commit (as the existing colour rows do).
- `StateStyle` fields: `entity?`, `state?`, `state_not?`, `above?`, `below?`, `icon?`, `color?` (a CSS colour or the literal `"rgb"`), `animation?` (`none`|`pulse`|`blink`).
- `removeRule` returns `undefined` when the list empties (never store `[]`); `setRule` drops `""`/`NaN`/`"none"` to keep configs minimal.
- Run one test file: `npx vitest run src/<file>.test.ts`; full suite `npx vitest run --reporter=dot`; typecheck `npx tsc --noEmit`; build `npm run build`.

---

## File Structure

- `src/statestyles.ts` — **create.** `addRule`, `removeRule`, `setRule`. Pure.
- `src/statestyles.test.ts` — **create.** Unit tests.
- `src/editor-forms.ts` — **modify.** `roomForm` loses `light`/`lit` (fields, data, toPatch).
- `src/editor-forms.test.ts` — **modify.** `roomForm` no longer exposes `light`/`lit`.
- `src/editor.ts` — **modify.** `_renderStateStyleRows` + `_renderStateStyleRule` + `_stateElement`/`_addStateStyleRule`/`_removeStateStyleRule`/`_updateStateStyleRule`; render in the room and item selection branches; CSS for `.statestyles`/`.rule`.

One branch `feat/editor-statestyles` off `main`.

---

## Task 1: `statestyles.ts` — pure rule helpers

Branch: `feat/editor-statestyles` off `main`.

**Files:** Create `src/statestyles.ts`, `src/statestyles.test.ts`.

**Interfaces:**
- Produces: `addRule(rules?: StateStyle[]): StateStyle[]`; `removeRule(rules: StateStyle[], i: number): StateStyle[] | undefined`; `setRule(rules: StateStyle[], i: number, patch: Partial<StateStyle>): StateStyle[]`. Consumed by Task 3.

- [ ] **Step 1: Create the branch**

```bash
cd ~/src/easy-floorplan && git checkout main && git checkout -b feat/editor-statestyles
```

- [ ] **Step 2: Write the failing tests**

Create `src/statestyles.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/statestyles.test.ts`
Expected: FAIL — `Cannot find module "./statestyles"`.

- [ ] **Step 4: Implement `src/statestyles.ts`**

```ts
import type { StateStyle } from "./types";

/** Append an empty rule (a rule with no conditions is a valid "always matches" entry). */
export function addRule(rules?: StateStyle[]): StateStyle[] {
  return [...(rules ?? []), {}];
}

/** Drop rule `i`; `undefined` when the list empties (so the key is dropped, never `[]`). */
export function removeRule(rules: StateStyle[], i: number): StateStyle[] | undefined {
  const next = rules.filter((_, idx) => idx !== i);
  return next.length ? next : undefined;
}

const STRING_FIELDS = new Set(["entity", "state", "state_not", "icon", "color"]);
const NUMBER_FIELDS = new Set(["above", "below"]);

/** Merge `patch` into rule `i`, normalized: empty strings, NaN numbers and `animation:"none"` are dropped. */
export function setRule(rules: StateStyle[], i: number, patch: Partial<StateStyle>): StateStyle[] {
  return rules.map((rule, idx) => {
    if (idx !== i) return rule;
    const next = { ...rule } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if (STRING_FIELDS.has(k)) {
        if (v === "" || v == null) delete next[k];
        else next[k] = v;
      } else if (NUMBER_FIELDS.has(k)) {
        const n = typeof v === "string" && v !== "" ? Number(v) : v;
        if (typeof n !== "number" || !Number.isFinite(n)) delete next[k];
        else next[k] = n;
      } else if (k === "animation") {
        if (v === "none" || v == null) delete next.animation;
        else next.animation = v;
      } else if (v == null) {
        delete next[k];
      } else {
        next[k] = v;
      }
    }
    return next as StateStyle;
  });
}
```

- [ ] **Step 5: Run to verify pass; typecheck; commit**

Run: `npx vitest run src/statestyles.test.ts` → PASS. `npx tsc --noEmit` → clean.

```bash
git add src/statestyles.ts src/statestyles.test.ts
git commit -m "Add pure add/remove/set helpers for stateStyles rules"
```

---

## Task 2: `roomForm` drops the light/lit shorthand

**Files:** Modify `src/editor-forms.ts` (`roomForm`), `src/editor-forms.test.ts`.

**Interfaces:**
- Produces: `roomForm(r: Room): FormSpec` with fields `name`/`areaId`/`fill`/`fillOpacity` only (no `light`/`lit`), and a `toPatch` that passes its fields through (no `stateStyles` synthesis). Consumed by the room selection editor (Task 3 renders the repeater alongside it).

- [ ] **Step 1: Write the failing tests**

Append to `src/editor-forms.test.ts`:

```ts
describe("roomForm — no light/lit shorthand", () => {
  const room = { id: "r1", points: [[0, 0], [10, 0], [10, 10]] } as never;
  it("no longer exposes light or lit fields", () => {
    const names = roomForm(room).fields.map((f) => f.name);
    expect(names).not.toContain("light");
    expect(names).not.toContain("lit");
    expect(names).toEqual(expect.arrayContaining(["name", "areaId", "fill", "fillOpacity"]));
  });
  it("toPatch passes fields through without synthesizing stateStyles", () => {
    const patch = roomForm(room).toPatch({ fill: "#fff" });
    expect(patch).toEqual({ fill: "#fff" });
    expect("stateStyles" in patch).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/editor-forms.test.ts`
Expected: FAIL — `light`/`lit` still present; `toPatch` still synthesizes `stateStyles`.

- [ ] **Step 3: Rewrite `roomForm`**

Replace `roomForm` in `src/editor-forms.ts` with (note: `rule`/the `stateStyles` build are gone; `toPatch` just returns its patch):

```ts
export function roomForm(r: Room): FormSpec {
  return {
    fields: [
      { name: "name", label: "Name", selector: { text: {} } },
      { name: "areaId", label: "Area", selector: { area: {} } },
      { name: "fill", label: "Colour", selector: { text: {} } },
      {
        name: "fillOpacity",
        label: "Opacity",
        helper: "0 is invisible, 1 is solid. The walls are drawn over the room.",
        selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } },
      },
    ],
    data: {
      name: r.name ?? "",
      areaId: r.areaId ?? "",
      fill: r.fill ?? "",
      fillOpacity: r.fillOpacity ?? ROOM_FILL_OPACITY,
    },
    toPatch(patch) {
      return patch;
    },
  };
}
```

(If `ROOM_FILL_OPACITY` was the only reason for an import that is now otherwise unused, leave the import — it is still used here. Do not remove the `areaId` field; it is not part of this change.)

- [ ] **Step 4: Run to verify pass; typecheck; full suite; commit**

Run: `npx vitest run src/editor-forms.test.ts` → PASS. `npx tsc --noEmit` → clean. `npx vitest run --reporter=dot` → green (some prior `roomForm` light/lit tests may need deleting — remove any test that asserts the old `light`/`lit` behaviour, since that shorthand is intentionally gone).

```bash
git add src/editor-forms.ts src/editor-forms.test.ts
git commit -m "Drop the room light/lit shorthand; the repeater owns room rules"
```

---

## Task 3: The repeater UI, update methods, and wiring

**Files:** Modify `src/editor.ts` (add the render + update methods; render in the room and item branches; add CSS; import the helpers and `StateStyle`).

**Interfaces:**
- Consumes: `addRule`/`removeRule`/`setRule` from `./statestyles`; `_renderEntityPicker`, `_updateRoom(id,patch,live)`, `_updateItem`/`_updateItemLive`, `_floor()`.
- Produces: the repeater rendered under `roomForm` (room branch) and `itemForm` (item branch).

- [ ] **Step 1: Imports**

At the top of `src/editor.ts`:
```ts
import { addRule, removeRule, setRule } from "./statestyles";
import type { StateStyle } from "./types";
```

- [ ] **Step 2: The update plumbing**

Add near the other element-update helpers:
```ts
  private _stateElement(kind: "room" | "item", id: string): Room | FloorItem | undefined {
    return kind === "room"
      ? (this._floor().rooms ?? []).find((r) => r.id === id)
      : this._floor().items.find((x) => x.id === id);
  }

  private _patchStateStyles(
    kind: "room" | "item",
    id: string,
    stateStyles: StateStyle[] | undefined,
    live: boolean
  ): void {
    if (kind === "room") this._updateRoom(id, { stateStyles }, live);
    else if (live) this._updateItemLive(id, { stateStyles });
    else this._updateItem(id, { stateStyles });
  }

  private _addStateStyleRule(kind: "room" | "item", id: string): void {
    const el = this._stateElement(kind, id);
    if (el) this._patchStateStyles(kind, id, addRule(el.stateStyles), false);
  }

  private _removeStateStyleRule(kind: "room" | "item", id: string, i: number): void {
    const el = this._stateElement(kind, id);
    if (el) this._patchStateStyles(kind, id, removeRule(el.stateStyles ?? [], i), false);
  }

  private _updateStateStyleRule(
    kind: "room" | "item",
    id: string,
    i: number,
    patch: Partial<StateStyle>,
    live = false
  ): void {
    const el = this._stateElement(kind, id);
    if (el) this._patchStateStyles(kind, id, setRule(el.stateStyles ?? [], i, patch), live);
  }
```

- [ ] **Step 3: The repeater render**

Add:
```ts
  private _renderStateStyleRows(
    rules: StateStyle[],
    kind: "room" | "item",
    id: string,
    defaultEntity?: string
  ): TemplateResult {
    return html`
      <div class="statestyles">
        <div class="statestyles-head">Conditional styles</div>
        ${rules.map((rule, i) => this._renderStateStyleRule(rule, kind, id, i, defaultEntity))}
        <button class="add-rule" @click=${() => this._addStateStyleRule(kind, id)}>+ Add rule</button>
      </div>
    `;
  }

  private _renderStateStyleRule(
    rule: StateStyle,
    kind: "room" | "item",
    id: string,
    i: number,
    defaultEntity?: string
  ): TemplateResult {
    const set = (patch: Partial<StateStyle>, live = false) =>
      this._updateStateStyleRule(kind, id, i, patch, live);
    const numOrUndef = (s: string) => (s === "" ? undefined : Number(s));
    return html`
      <div class="rule">
        <div class="row wide">
          <label>When entity</label>
          ${this._renderEntityPicker(rule.entity ?? "", (v) => set({ entity: v }))}
          <button class="rule-remove" title="Remove rule" @click=${() =>
            this._removeStateStyleRule(kind, id, i)}>✕</button>
        </div>
        <div class="row">
          <label>State</label>
          <input type="text" placeholder=${defaultEntity ? "is…" : "any"} .value=${rule.state ?? ""}
            @change=${(e: Event) => set({ state: (e.target as HTMLInputElement).value })} />
          <input type="text" placeholder="is not…" .value=${rule.state_not ?? ""}
            @change=${(e: Event) => set({ state_not: (e.target as HTMLInputElement).value })} />
        </div>
        <div class="row">
          <label>Range</label>
          <input class="num" type="number" placeholder="above" .value=${String(rule.above ?? "")}
            @change=${(e: Event) => set({ above: numOrUndef((e.target as HTMLInputElement).value) })} />
          <input class="num" type="number" placeholder="below" .value=${String(rule.below ?? "")}
            @change=${(e: Event) => set({ below: numOrUndef((e.target as HTMLInputElement).value) })} />
        </div>
        <div class="row wide">
          <label>Icon</label>
          <input type="text" placeholder="mdi:… (optional)" .value=${rule.icon ?? ""}
            @change=${(e: Event) => set({ icon: (e.target as HTMLInputElement).value })} />
        </div>
        <div class="row">
          <label>Colour</label>
          <input type="color" .value=${rule.color && rule.color !== "rgb" ? rule.color : "#03a9f4"}
            @input=${(e: Event) => set({ color: (e.target as HTMLInputElement).value }, true)} />
          <input type="text" placeholder='colour or "rgb"' .value=${rule.color ?? ""}
            @change=${(e: Event) => set({ color: (e.target as HTMLInputElement).value })} />
        </div>
        <div class="row">
          <label>Animation</label>
          <select @change=${(e: Event) => set({ animation: (e.target as HTMLSelectElement).value as StateStyle["animation"] })}>
            <option value="none" ?selected=${(rule.animation ?? "none") === "none"}>None</option>
            <option value="pulse" ?selected=${rule.animation === "pulse"}>Pulse</option>
            <option value="blink" ?selected=${rule.animation === "blink"}>Blink</option>
          </select>
        </div>
      </div>
    `;
  }
```

- [ ] **Step 4: Render the repeater in the room and item branches**

In `_renderSelectionEditor`, the `sel.kind === "room"` branch — after the `_renderForm(roomForm(r), …)`:
```ts
        ${this._renderStateStyleRows(r.stateStyles ?? [], "room", r.id)}
```
The `sel.kind === "item"` branch — after the ripple-color row (at the end of that branch's template):
```ts
        ${this._renderStateStyleRows(it.stateStyles ?? [], "item", it.id, it.entity)}
```

- [ ] **Step 5: CSS**

Add to the `styles` block (plain `/* */` comments, no backticks):
```css
    .statestyles {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 8px;
    }
    .statestyles-head {
      font-weight: 600;
      font-size: 12px;
      color: var(--secondary-text-color, #888);
    }
    .rule {
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rule-remove {
      border: none;
      background: none;
      cursor: pointer;
      color: var(--secondary-text-color, #888);
    }
    .add-rule {
      align-self: flex-start;
      cursor: pointer;
      border: 1px dashed var(--divider-color, #ccc);
      background: none;
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 4px 10px;
    }
```

- [ ] **Step 6: Typecheck, full suite, build, commit**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot && npm run build`
Expected: clean; all tests pass; build succeeds (no new tests this task — the repeater is verified live in Task 4).

```bash
git add src/editor.ts
git commit -m "Add a stateStyles repeater to the room and item editors"
```

---

## Task 4: Live verification and gate

**Files:** none changed.

- [ ] **Step 1: Build and gate**

Run: `npm run build && npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: build succeeds; typecheck clean; all tests pass. Confirm `dist/easy-floorplan-card.js` still contains the dashboard-required symbols (`sectional`, `waterHeater`, `airHandler`, `bathtub`, `vanity`, `media_player`, `label-only`, `fan_only`, `Detect rooms`).

- [ ] **Step 2: Exercise in the dev harness**

Serve (`npm run serve`). Confirm:
- Select an item → the "Conditional styles" repeater shows; **+ Add rule** adds a rule block; set entity/state/colour/animation → the emitted item config carries a `stateStyles: [{…}]`; the ✕ removes it and `stateStyles` disappears from the config.
- Select a room → the same repeater appears; the old **Lights up with** / **Lit colour** rows are gone; a rule set through the repeater lands in the room's `stateStyles`.

- [ ] **Step 3: Stop before deploy**

Do not run `install_ha.py` or push. Report the branch state to Amadeo. Update `06_Deliverables/home_assistant/WORKLOG.md` — mark the editor-gaps item done, and record the **#25 merge note** (thread #25's `areaEntities` into the room repeater's per-rule entity pickers when both land, since this branch removed the area-filtered light picker).

## Self-Review

**Spec coverage:** pure add/remove/set helpers → Task 1; room `light`/`lit` removal → Task 2; repeater UI + update methods + room/item wiring + CSS → Task 3; verification → Task 4. ✓

**Placeholder scan:** every code step is complete; every command has expected output. ✓

**Type consistency:** `addRule`/`removeRule`/`setRule` signatures match between `statestyles.ts` (Task 1) and the editor's update methods (Task 3); `_renderStateStyleRows`/`_updateStateStyleRule` signatures are consistent across their definitions and call sites; `StateStyle["animation"]` cast matches the type. ✓

**Test altitude:** the rule mutation/normalization is unit-tested (`statestyles.test.ts`) and the `roomForm` change is unit-tested; the repeater DOM is verified live (Task 4), per the repo's no-DOM-harness convention. ✓
