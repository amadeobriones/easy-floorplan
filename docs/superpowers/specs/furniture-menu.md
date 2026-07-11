# Add menu: searchable, collapsible furniture categories

Design spec for the reorganized "+ Add" popover (`_renderAddMenu`, `src/editor.ts`).
Today it is a flat 5-column grid of all 35 glyphs under the Device/Text buttons —
tall, unscannable, and it will only get worse as types are added. The replacement
keeps the exact same visual vocabulary (same `.pop`/`.add-entry`/`.furn-cell`
tokens, same `renderFurniture` previews) and adds three things: a search field,
six collapsible category sections, and a scrolling body.

```
┌─────────────────────────────────┐
│ [🔍 Search furniture…        ]  │  ← sticky while the body scrolls
├─────────────────────────────────┤
│ 💡 Device                       │  ← existing .add-entry buttons,
│ T  Text                         │    hidden while a search is active
│ ─────────────────────────────── │
│ ▾ Seating & beds             7  │  ← .cat-head (caret + label + count)
│  [ch] [ar] [so] [se] [be]       │  ← existing .furn-cell grid, 5 cols
│  [bd] [cr]                      │
│ ▸ Tables & desks             5  │  ← collapsed: grid not rendered
│ ▾ Storage                    4  │
│  [wa] [dr] [bo] [ca]            │
│ …                            ⇕  │  ← popover max-height, overflow-y auto
└─────────────────────────────────┘
```

## 1. Category data

Lives in `src/editor-forms.ts` next to `FURNITURE_TYPES` / `FURNITURE_LABELS`
(exported; the editor imports it alongside them). Grouped by function, kitchen →
laundry → mechanical reading order inside Appliances, and every one of the 35
types appears exactly once (7 + 5 + 4 + 9 + 6 + 4 = 35 — keep a unit test or a
dev assertion that the flattened categories equal `FURNITURE_TYPES` as sets).

```ts
/** The Add-menu grouping. Every FurnitureType appears in exactly one category. */
export const FURNITURE_CATEGORIES: { label: string; types: FurnitureType[] }[] = [
  { label: "Seating & beds", types: ["chair", "armchair", "sofa", "sectional", "bench", "bed", "crib"] },
  { label: "Tables & desks", types: ["table", "roundTable", "desk", "coffeeTable", "nightstand"] },
  { label: "Storage", types: ["wardrobe", "dresser", "bookshelf", "cabinet"] },
  { label: "Appliances", types: ["fridge", "stove", "microwave", "dishwasher", "washer", "dryer", "waterHeater", "airHandler", "tv"] },
  { label: "Fixtures", types: ["sink", "toilet", "bathtub", "shower", "vanity", "bidet"] },
  { label: "Decor & misc", types: ["rug", "plant", "fireplace", "stairs"] },
];
```

Category `label` doubles as the collapse-state key — labels are unique and there
is no separate id to keep in sync.

## 2. Layout & interaction

**New editor state** (two `@state` fields next to `_addMenuOpen`):

```ts
@state() private _addSearch = "";
/** Categories the user collapsed. Empty set = everything open (the default). */
@state() private _addClosedCats: Set<string> = new Set();
```

Storing the **closed** set (not the open set) makes all-open the zero-config
default: nothing is hidden the first time the menu opens, and no initialisation
from `FURNITURE_CATEGORIES` is needed. Collapsing is the user's tidy-up gesture,
so `_addClosedCats` persists across popover open/close within an editor session;
`_addSearch` resets to `""` every time the menu opens (a stale filter would look
like missing furniture).

**Structure, top to bottom:**

1. **Search field** — a full-width `<input type="search">` in a sticky header
   row so it stays reachable while the body scrolls. Placeholder:
   `Search furniture…`. Focus it when the popover opens (after
   `this.updateComplete`, from the + Add toggle handler).
2. **Devices & text row** — the two existing `.add-entry` buttons, unchanged,
   followed by the existing divider. Hidden while a search is active: the
   search scopes the furniture library, and keeping non-matching rows above the
   results reads as noise.
3. **Six category sections** — each a `.cat-head` toggle button plus (when
   open) the familiar `.add-furn-grid` of `.furn-cell` buttons.

**Category header** (`.cat-head`): a full-width button — caret icon, category
label, then a right-aligned count. The count shows the number of *visible*
glyphs, so during a search it doubles as a match count ("Appliances 2").
Clicking toggles that label in `_addClosedCats` (copy the Set so lit re-renders).
`aria-expanded` reflects the open state and also drives the caret rotation in
CSS — one source of truth, no extra class.

**Scroll**: `.add-pop` gets `max-height: min(62vh, 480px)` and
`overflow-y: auto` (plus `overscroll-behavior: contain` so the wheel does not
bleed into the page). Short states — a filtered search, everything collapsed —
shrink naturally below the cap.

**Search behaviour** (`q = this._addSearch.trim().toLowerCase()`):

- Case-insensitive substring match against `FURNITURE_LABELS[t]` (the labels
  are already lowercase, human-worded strings — "round table" matches `tab`).
- While `q` is non-empty the collapse state is *overridden, not overwritten*:
  every category with at least one match renders open, categories with zero
  matches are omitted entirely. Clearing the search restores the user's
  manual open/closed arrangement untouched.
- Zero matches anywhere: render a single quiet hint row in the body,
  `No furniture matches "<q>"` (`.add-empty`, secondary text, 12px).
- **Enter** while exactly one glyph matches across all categories adds that
  furniture and closes the popover — type "cri", Enter, done. With ≠ 1 match,
  Enter does nothing.
- **Escape** in the input: if `q` is non-empty, clear the search (and stop
  propagation); otherwise let the existing global Escape handling close the
  popover as it does today.

## 3. Lit template shape

Pseudo-lit for `_renderAddMenu` — an engineer should be able to transcribe this
directly. Cell markup and the viewBox padding math are the *existing* code,
unchanged, just relocated inside the category map.

```ts
private _toggleCat(label: string): void {
  const next = new Set(this._addClosedCats);
  next.has(label) ? next.delete(label) : next.add(label);
  this._addClosedCats = next; // new Set => lit re-render
}

private _renderAddMenu(): TemplateResult {
  const close = () => { this._addMenuOpen = false; };
  const q = this._addSearch.trim().toLowerCase();
  const searching = q.length > 0;

  // One pass over the categories; reused by Enter-to-add below.
  const visible = FURNITURE_CATEGORIES.map((cat) => ({
    ...cat,
    shown: searching
      ? cat.types.filter((t) => FURNITURE_LABELS[t].toLowerCase().includes(q))
      : cat.types,
  }));
  const matches = searching ? visible.flatMap((c) => c.shown) : [];

  return html`
    <div class="pop left add-pop">
      <div class="add-search">
        <input
          type="search"
          placeholder="Search furniture…"
          .value=${this._addSearch}
          @input=${(e: Event) => { this._addSearch = (e.target as HTMLInputElement).value; }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" && matches.length === 1) {
              this._addFurniture(matches[0]);
              close();
            } else if (e.key === "Escape" && searching) {
              e.stopPropagation();
              this._addSearch = "";
            }
          }}
        />
      </div>
      <div class="add-body">
        ${searching
          ? nothing
          : html`
              <button class="add-entry" @click=${() => { this._addItem("generic"); close(); }}>
                <ha-icon icon="mdi:lightbulb-outline"></ha-icon> Device
              </button>
              <button class="add-entry" @click=${() => { this._addText(); close(); }}>
                <ha-icon icon="mdi:format-text"></ha-icon> Text
              </button>
              <div class="add-sep"></div>
            `}
        ${searching && matches.length === 0
          ? html`<p class="add-empty">No furniture matches "${this._addSearch.trim()}"</p>`
          : nothing}
        ${visible.map((cat) => {
          if (searching && cat.shown.length === 0) return nothing;
          const open = searching || !this._addClosedCats.has(cat.label);
          return html`
            <section class="add-cat">
              <button
                class="cat-head"
                aria-expanded=${open}
                @click=${() => this._toggleCat(cat.label)}
              >
                <ha-icon class="caret" icon="mdi:chevron-down"></ha-icon>
                <span>${cat.label}</span>
                <span class="cat-count">${cat.shown.length}</span>
              </button>
              ${open
                ? html`
                    <div class="add-furn-grid">
                      ${cat.shown.map((t) => {
                        const size = FURNITURE_DEFAULT_SIZE[t];
                        const pad = Math.max(size.w, size.h) * 0.25 + 6;
                        const vb = `${-size.w / 2 - pad} ${-size.h / 2 - pad} ${size.w + pad * 2} ${size.h + pad * 2}`;
                        return html`
                          <button
                            class="furn-cell"
                            title=${FURNITURE_LABELS[t]}
                            @click=${() => { this._addFurniture(t); close(); }}
                          >
                            <svg viewBox=${vb}>
                              ${renderFurniture({ id: "preview", type: t, x: 0, y: 0, w: size.w, h: size.h })}
                            </svg>
                            <span>${FURNITURE_LABELS[t]}</span>
                          </button>
                        `;
                      })}
                    </div>
                  `
                : nothing}
            </section>
          `;
        })}
      </div>
    </div>
  `;
}
```

Open-focus wiring, in the + Add toolbar toggle handler (where
`_addMenuOpen = !_addMenuOpen` lives today, ~line 2107):

```ts
this._addMenuOpen = !this._addMenuOpen;
if (this._addMenuOpen) {
  this._addSearch = "";
  this.updateComplete.then(() =>
    (this.renderRoot.querySelector(".add-search input") as HTMLInputElement | null)?.focus()
  );
}
```

Keyboard path end to end: + Add → input focused → type → Enter (single match)
or Tab onto the grid — `.cat-head` and `.furn-cell` are real buttons, so
Tab/Enter/Space already work; the browser default focus ring stays on.

## 4. CSS

Changes to the editor `styles` block. `.add-entry` and `.furn-cell` are
untouched; `.add-furn-grid` loses its divider job (the per-category header now
separates groups); the divider between the Devices & text row and the first
category becomes an explicit `.add-sep` element.

```css
/* The popover becomes a scroll container; the search row stays put. */
.add-pop {
  min-width: 300px;
  max-height: min(62vh, 480px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0; /* padding moves to .add-search and .add-body so sticky sits flush */
}
.add-search {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px;
  background: var(--card-background-color, #fff);
  border-bottom: 1px solid var(--divider-color, #eee);
}
.add-search input {
  width: 100%;
  box-sizing: border-box;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--divider-color, #ccc);
  background: var(--card-background-color, #fff);
  color: var(--primary-text-color);
  font-size: 13px;
}
.add-search input:focus {
  outline: none;
  border-color: var(--primary-color);
}
.add-body {
  padding: 6px 8px 8px;
}
.add-sep {
  height: 1px;
  margin: 6px 0;
  background: var(--divider-color, #eee);
}
.cat-head {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  border: none;
  background: none;
  padding: 6px 4px;
  border-radius: 6px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--secondary-text-color);
  cursor: pointer;
}
.cat-head:hover {
  background: var(--secondary-background-color, #f5f5f5);
}
.cat-head .caret {
  --mdc-icon-size: 16px;
  transition: transform 0.15s ease;
}
.cat-head[aria-expanded="false"] .caret {
  transform: rotate(-90deg);
}
.cat-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.7;
}
.add-empty {
  margin: 8px 4px;
  font-size: 12px;
  color: var(--secondary-text-color);
}
/* Grid keeps its 5 columns; the border-top divider role moved to .cat-head. */
.add-furn-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 0 0 4px;
}
@media (prefers-reduced-motion: reduce) {
  .cat-head .caret {
    transition: none;
  }
}
```

## Decisions, stated

- **All sections open by default** (closed-set state): nothing is hidden from a
  first-time user; collapsing is an opt-in tidy-up that persists for the session.
- **Search overrides, never mutates, collapse state** — clearing the query gives
  back exactly the arrangement the user made.
- **Device/Text hide during search** so results are only results.
- **Count doubles as match count**; no separate "2 matches" chrome.
- **No new dependencies, no new components** — two `@state` fields, one exported
  const, CSS in the existing block.
