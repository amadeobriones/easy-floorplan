# Areas (#25) — Design

**Goal:** Act on the `Room.areaId` we already store. Give a room a Home Assistant area
picker (mirroring the `Floor.haFloor` link), hard-filter the room's light picker to that
area's entities, and add an **"add the devices in this area"** action that bulk-creates
items for the area's placeable entities, laid out inside the room.

**Non-goals:** associating arbitrary items with rooms (items stay free x/y points — the
only room→area coupling is on the room itself); an area picker anywhere but the room;
filtering item entity pickers by the room that geometrically contains them (considered and
declined — it couples items to room polygons); syncing a room's name from its area (the
floor link does that; a room's name is decorative, leave it alone).

## Approaches considered

- **A. Mirror the `haFloor` link, filter via the entity selector's `include_entities`
  (chosen).** `haAreasOf(hass)` mirrors `haFloorsOf`. The room gains an `areaId` field
  rendered by HA's native `area` selector (`ha-area-picker`) with a `<select>` fallback.
  The room's existing `light` field stays in `roomForm`; when the room has an area, its
  entity selector carries `include_entities = entitiesInArea(hass, areaId)` (native HA
  support) and the fallback picker honours the same list. Cohesive — the room form stays
  one form.
- **B. Move `light`/`lit` to custom rows using the raw `ha-entity-picker`.** Guarantees the
  filter without depending on the selector's `include_entities`, but splits the room form
  and duplicates the `stateStyles`-rule build into a new method. Rejected: more surface for
  the same behaviour; A degrades gracefully to an unfiltered picker if a given HA version
  ignores `include_entities`, and the fallback path routes through the raw picker anyway.
- **C. Soft filter (area entities surfaced, list not narrowed).** Cheapest, but doesn't
  deliver the hard filter. Rejected.

## Architecture

### New pure module `src/areas.ts` (unit-tested, no DOM/Lit)

Mirrors `haFloorsOf`/`HaFloorInfo` in `types.ts`.

- `interface HaAreaInfo { area_id: string; name: string; floor_id?: string | null }`.
- `haAreasOf(hass: unknown): HaAreaInfo[]` — reads `hass.areas` (a `Record<area_id, …>`),
  keeps entries with string `area_id`+`name`, sorts by `name.localeCompare`. `[]` when
  `hass.areas` is absent (dev harness, older HA). Typed loosely like `haFloorsOf`.
- `entitiesInArea(hass: unknown, areaId: string): string[]` — an entity id is in the area
  when `hass.entities[id].area_id === areaId`, **or** when that entity has no own
  `area_id` (`null`/`undefined`) and its device `hass.devices[hass.entities[id].device_id]
  .area_id === areaId`. Entity-level area overrides device-level. Returns a deduped, sorted
  list. `[]` when the registries are absent.
- `gridLayout(count: number, bbox: {minX,minY,maxX,maxY}, gap?: number): Array<[number,
  number]>` — pure. Positions `count` points on a near-square grid inside `bbox`, inset by
  a margin so items are not on the edge. Used to place bulk-added items.

### Data — no schema change

`Room.areaId?: string` already exists. No type change. Nothing is backfilled.

### Area picker on the room (`src/editor-forms.ts` + `src/editor.ts`)

- `roomForm(r: Room, areaEntities?: string[]): FormSpec` — gains an optional second
  argument. New field `{ name: "areaId", label: "Area", selector: { area: {} } }` and
  `data.areaId = r.areaId ?? ""`; `toPatch` maps `areaId` through with `"" → undefined`.
  When `areaEntities` is provided, the existing `light` field's selector becomes
  `{ entity: { filter: [{ domain: ["light","switch"] }], include_entities: areaEntities } }`;
  when absent it is unchanged. `roomForm` stays pure — the editor computes the list.
- Editor: where it renders the room form (the `sel.kind === "room"` branch of
  `_renderSelectionEditor`), compute `const areaEntities = r.areaId ?
  entitiesInArea(this.hass, r.areaId) : undefined;` and call `roomForm(r, areaEntities)`.
- **Fallback renderer** (`_renderForm` in `editor.ts`; `normalizeFormPatch`/the field
  predicate in `editor-forms.ts`) learns the `area` selector: render a `<select>` from
  `haAreasOf(this.hass)` with a `"(no area)"` first option (the same shape as the
  HA-floor `<select>`), value `= data.areaId`, and treat `area` as an optional string on
  patch (`"" → undefined`). Under `ha-form` the native `area` selector renders
  `ha-area-picker` and needs no fallback code.
- **Fallback entity filter:** extend `_renderEntityPicker(value, onChange, includeDomains?,
  includeEntities?)`; `includeEntities` sets `.includeEntities` on `ha-entity-picker`
  (`allow-custom-entity` stays). The `_renderForm` fallback passes a field's selector
  `include_entities` through to this argument so the fallback filters too.

### "Add devices in this area" action

- Pure helper (in `src/areas.ts`, tested): `devicesToAdd(hass, areaId, room, placed:
  Set<string>): Array<{ entity: string; x: number; y: number; kind: ItemKind }>` —
  deterministic placement tuples, **not** full `FloorItem`s (so it stays pure and testable;
  `uid` uses `Math.random` and is added by the editor, not here). Steps: `entitiesInArea` →
  keep an id only if it is **placeable and primary**: `kindFromEntity(id) !== "generic"` (a
  recognized domain — `kindFromEntity` takes the entity string and returns `"generic"` for
  anything else) AND `hass.entities[id].entity_category` is neither `"diagnostic"` nor
  `"config"` AND the entity is not hidden/disabled (`!hidden_by && !disabled_by`) — this is
  what drops battery sensors, connectivity, and config helpers → drop ids already in
  `placed` → `gridLayout` inside the polygon bbox of `room.points` → emit
  `{ entity, x, y, kind: kindFromEntity(id) }` per id. Sorted entity ids, so order and
  positions are deterministic and there is no `Math.random` here.
- Editor: maps each tuple to a full `FloorItem` the way `_addItem` does — `{ id:
  uid("item"), entity, x, y, kind, showState: kind === "sensor", showIcon: true, size:
  DEFAULT_ITEM_SIZE }` — and commits them all via `_commitFloor({ items: [...existing,
  ...added] })` (one undo step).
- Editor: a button in the room selection editor, below the form, shown when
  `haAreasOf(this.hass).length && r.areaId`. Label reflects the count from a dry
  `devicesToAdd(...)`: **"Add N devices from &lt;area name&gt;"**, or disabled **"No new
  devices in &lt;area name&gt;"** when N is 0. Click commits the new items in one
  `_commit` (a single undo step). `placed` is every `entity` already on any item of the
  active floor.

## Testing (TDD, pure-function style — the repo has no DOM harness)

- **`src/areas.test.ts`:** `haAreasOf` (reads `hass.areas`, sorts by name, `[]` when
  absent); `entitiesInArea` (entity-level area; device-level fallback; entity-level
  overrides a differing device area; entity with no area and no device excluded; dedupe);
  `gridLayout` (right count, every point inside the bbox, no exact overlaps); `devicesToAdd`
  (keeps recognized domains, drops `entity_category` diagnostic/config and hidden/disabled,
  skips already-placed, positions inside the room bbox, infers kind via `kindFromEntity`,
  stable order, `[]` when the area has nothing new).
- **`src/editor-forms.test.ts`:** `roomForm` includes the `areaId` field and round-trips it
  (`data.areaId`, `toPatch` `"" → undefined`); with `areaEntities` supplied the `light`
  field's selector carries `include_entities`; the `area` selector normalizes `"" →
  undefined`.

## Fork hygiene

One branch `feat/25-areas` off `main` (the editor/card have diverged ~59 commits from
upstream, so an upstream-based branch would conflict wholesale, as with #33). Nothing goes
outward — no PR, issue, or comment to upstream or anyone. No `Co-Authored-By`/"Generated
with" footers in the public repo.

## Verification note

The `include_entities` hard filter relies on HA's entity selector honouring
`include_entities` (a documented selector option). The plan pins this the way the ha-form
migration pinned selector shapes; if a targeted HA version ignores it, the fallback path
(`ha-entity-picker.includeEntities`, definitely supported) still filters, and under ha-form
it degrades to an unfiltered-but-domain-filtered picker rather than breaking.
