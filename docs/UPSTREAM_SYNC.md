# Upstream sync log

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

The increase over the previous fork release is driven by upstream's own growth between `0.7.4` and
`v1.4.1` — skins, dead-space hatching, user-definable symbols, light pools, sun dimming, areas and
sliders — not by the fork's additions. The previous fork release, which contained every fork feature
plus the same runtime dependency, was smaller than upstream `v1.4.1` on its own.

This fork adds one runtime dependency beyond upstream's `custom-card-helpers` and `lit`: `js-yaml`,
for the config import box.

### Tests

Upstream `v1.4.1` at the branch point: 954 across 11 files. This release: 1234 across 30 files.
Every upstream source and test file is retained; no upstream test was removed.
