# Upstream sync log

## v1.5.4.ab002 — climate layer: Fahrenheit readings

No upstream change; a fork fix on top of `v1.5.4.ab001`.

The climate layer maps a room's temperature onto a Celsius range (16 / 21 / 27) and read the
entity's state at face value. A Fahrenheit reading is therefore always past the maximum, and the
gradient clamps — so in a Fahrenheit home *every* shaded room painted the identical hot red. The
layer looked broken rather than miscalibrated, and there is no range setting to compensate with.

Home Assistant publishes the unit on the entity, so it is now read: a `°F` reading is converted to
Celsius before it is mapped. `°C`, kelvin, and a bare number from a template sensor are unchanged —
all still taken as Celsius, which is what the layer assumed from the start.

Found while binding real per-room sensors: all four ambient sensors in the test home report `°F`,
and all four would have rendered the same colour.


## v1.5.4.ab001 — merged upstream v1.5.4

Upstream released `v1.5.4`, 48 commits ahead of the `v1.4.1` base this fork was rebuilt on. This
release merges that work in rather than rebuilding again.

### Why a merge was possible this time

The previous release rebuilt the fork because a trial merge produced 16 conflicting files including
whole-file add/add collisions. That reflected how large the fork's delta had grown, not something
permanent: after the rebuild the delta is roughly 1,030 lines across five shared files, and a trial
merge against `v1.5.4` produced 10 conflicts with no add/add collisions. None of them touched the
fork's own modules — the conflicts were confined to the five shared files the fork hooks into, plus
their tests and packaging. Merging keeps a single continuous history.

Nothing was dropped: none of the fork's four features were re-implemented upstream in this range.

### What upstream brings

- **Sunlight**, substantially reworked: radial falloff and a penumbra, per-opening gradients, a
  bounded reach on a slider, and fixes where the falloff was never drawn and where turning shade off
  removed the softness.
- **Stairs are clickable** to change floor.
- **Editor**: the plan can be applied to the dashboard without closing the editor, and every element
  panel's fields are now organised into collapsible groups that start collapsed.
- **Openings read locks**, rooms answer tap/hold/double-tap actions, and a lock jam no longer reads
  as an open door.
- Ripple from vibration sensors; entities can be bound to a device without being printed on its
  label; the overlay-scale default applies to new configs only.

### How the fork adapted

- `render.ts`: upstream replaced the single `secondaryEntity` watch with a generalised
  `itemReadings()` loop that subsumes it. The fork's separate watch on a state rule's own `entity`
  is kept alongside it — both are needed, or a label updates only when something else on the plan
  happens to change.
- `editor.ts`: the fork's two per-element layer bindings were moved into upstream's new groups. A
  device's power sensor and a room's temperature sensor are both readings, so both now sit under
  "What it reads" alongside the element's own entity.
- Tests: collapsed groups render no content at all, so fork DOM tests that assert on a grouped field
  now open the group first. Without that, a field being absent from the DOM is indistinguishable
  from the feature not offering it.
- `js-yaml` remains a runtime dependency of the fork. Upstream carries it as a devDependency because
  it does not ship it; the fork's `validate.ts` imports it into the bundle.


## v1.4.1.ab001 — rebuilt on upstream v1.4.1

This fork was previously based on upstream `0.7.4`. Upstream then released `v1.4.1`, 56 commits
ahead, and this release adopts that base wholesale rather than merging onto the old one.

### Why a rebuild rather than a merge

A trial merge produced 16 conflicting files, including whole-file add/add collisions: upstream
squash-merges, so the merge base git selects (`Release 0.7.2`) predates several files existing
upstream at all, and git therefore treats our copy of that work and upstream's squash-merged copy
as two unrelated additions.

Instead, the branch was cut fresh from `upstream/main` and the fork's surviving delta re-applied on
top, one feature at a time, each with its tests as the gate.

The previous fork is preserved on `archive/v0.7.109`.

### What upstream now provides, and this fork therefore dropped

Upstream independently built most of what this fork previously added on its own. Those modules were
removed rather than carried forward — where upstream ships an implementation, that is the one this
fork uses:

| Dropped from the fork | Upstream's replacement |
|---|---|
| conditional styling engine (`statestyles`) | `StateColorRule` (#68, #79, #82, #92, #97, #125) |
| room polygons derived from walls (`rooms-from-walls`) | Areas (#83 → #158) and dead-space tracing (#88) |
| day/night theming (`theme`) | sun dimming (#113, #118, #119, #120) |
| room light wash (`lights`) | light pools with wall occlusion (#108, #123, #143) |
| whole-plan rotation (`rotation`) | `config.rotation` (#33) |
| HA-area helpers (`areas`) | `haAreasOf`, `entityIdsInHaArea`, area auto-populate |
| shared element animation CSS (`element-styles`) | `IconAnimation` (#48) and skins (#122) |

### What this fork adds on top of v1.4.1

Live layers, off by default and byte-identical when off:

- **Thermal** — shades an area by a temperature entity (`Area.tempEntity`)
- **Energy** — colours a device by live power draw (`FloorItem.powerEntity`)
- **Awareness** — motion pings and safety alerts (`Floor.awareness`)
- **Radial controls** — long-press an item for inline brightness, colour or setpoint

Always-on additions:

- **State rules gain four capabilities** upstream's lack: `entity` (style one element by another
  entity's state), `state_not`, `below`, and per-rule `animation`
- **Per-floor rotation** — `Floor.rotation` overrides `config.rotation` for one floor, for a plan
  where a single storey was scanned sideways. An explicit `0` pins a floor upright.
- **Config import** — paste a YAML or JSON config into the editor with field-level validation
- **Cursor-anchored wheel zoom** in the editor. Upstream anchors pinch zoom; wheel zoom previously
  pulled the drawing toward the top-left.
- **Modifier-aware editor shortcuts** — a `Cmd/Ctrl` combination is never treated as a keystroke
  belonging to a focused `<select>` or `ha-form`
- **Area auto-populate filters** — hidden, disabled, diagnostic/config and unrecognised-kind
  entities are excluded when adding a linked HA area's devices

### Two upstream behaviours corrected

- **A climate entity could never read as active.** `entityIsActive` used an allowlist of active
  states covering only `lock`, `vacuum` and `camera`; every other domain fell back to a generic
  on/off test. A climate entity's state *is* its hvac mode (`heat`, `cool`, `auto`, `dry`,
  `fan_only`, `off`), none of which is `on`. Because that predicate has no domain filter, a
  thermostat drew as off, never showed its active-state icon, never animated, never took
  `activeColor` — and with `hideWhenInactive` was hidden from the plan permanently. The table is now
  inverted to list *inactive* states, which is the correct shape for a domain whose states are an
  open set.
- **Modifier keystrokes were swallowed by focused pickers.** Upstream works around the specific case
  of the floor switcher by returning focus to the canvas; this generalises the fix so every
  `<select>` and `ha-form` behaves correctly.

### Bundle size

| Build | Bytes |
|---|---|
| `v0.7.109` (previous fork release) | 355,204 |
| upstream `v1.4.1`, no fork code | 362,113 |
| `v1.4.1.ab001` | 455974 |
| `v1.5.4.ab001` | 519203 |

The increase over the previous fork release is driven by upstream's own growth between `0.7.4` and
`v1.4.1` — skins, dead-space hatching, user-definable symbols, light pools, sun dimming, areas and
sliders — not by the fork's additions. The previous fork release, which contained every fork feature
plus the same runtime dependency, was smaller than upstream `v1.4.1` on its own.

This fork adds one runtime dependency beyond upstream's `custom-card-helpers` and `lit`: `js-yaml`,
for the config import box.

### Tests

Upstream `v1.4.1` at the branch point: 954 across 11 files. This release: 1234 across 30 files.
Every upstream source and test file is retained; no upstream test was removed.
