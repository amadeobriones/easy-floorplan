# easy-floorplan — Vision Roadmap

Planning artifact (not an implementation spec). Captures the next wave of
features and how they sequence. Each sub-project below gets its own
brainstorm → spec → plan → build cycle when it is picked up. Nothing here is
built yet.

## North star
The floorplan is not a static diagram — it is a **live, glanceable, controllable
picture of the actual house**. v0.7.101 made furniture and doors react to their
entities (tint, pulse, drums spin, lights glow). The next wave pushes that in
three directions: **more of the home made live** (layers), **more control from
the plan** (tap/long-press), and **less work to author** (areas, tracing).

## Out of scope (explicitly dropped)
- Robot-vacuum live position / dock animation.
- Blinds slat-angle / partial-tilt rendering.

---

## Cross-cutting principle: every feature can be enabled or disabled

The user must be able to turn each of these features on or off — the plan
should never gain behaviour they didn't ask for. This is a **first-class design
requirement across the whole roadmap**, delivered at three levels:

1. **Config-level feature flags.** A single `features` block in the card config,
   one key per feature, so a feature can be switched off entirely:
   ```yaml
   type: custom:floorplan-card
   features:
     lightsLayer:    true
     thermalLayer:   false
     awarenessLayer: true
     energyLayer:    false
     roomTapScenes:  true
     dayNightTheme:  false
   ```
   **Defaults are conservative:** every new overlay/behaviour defaults to
   **off**, so an existing plan upgrading to a new version looks exactly the same
   until the user opts in. (This mirrors the v0.7.101 rule that a no-entity piece
   is byte-identical to before.) A missing `features` block = all defaults.
2. **Runtime layer toggles** (Track 1a). For the live overlays, an on-plan
   switcher shows/hides *enabled* layers without editing config — the config flag
   says "this layer may appear," the toggle says "show it right now."
3. **Editor "Features" panel.** A section in the GUI editor listing every
   feature as a labelled switch, so none of this needs hand-written YAML. Writes
   the same `features` block.

**Design notes for the framework task (Track 1a owns this):**
- One typed `FeaturesConfig` interface + a `featureEnabled(config, name)` helper
  with the conservative default baked in; every feature task consults it at its
  render/behaviour entry point and no-ops when off.
- The flag gate must be cheap and total: a disabled feature adds zero DOM and
  zero watched entities (it must not appear in `collectWatchedEntities`), so
  turning it off fully removes its cost.
- Validator + generated schema gain the `features` block (additive); the
  drift/schema test covers it.
- The runtime toggle state is view state, not persisted config, unless we later
  decide a default-visible set is worth storing.

This section is a dependency of Track 1a and a checklist item for **every**
sub-project below: "expose an enable/disable flag; default off; zero cost when
off."

---

## Track 1 — Live overlay layers (core vision extension)

The heart of the roadmap. Four overlays share one shape — an entity-driven
visual layer over rooms/pieces — so a small framework, built once, carries all
of them and keeps them from cluttering each other.

### 1a. Layer framework + toggle UI  *(foundation)*
- **Goal:** named live layers, per-layer show/hide, a compact on-plan mode
  switcher; plus the cross-cutting `features` gating above.
- **Approach:** a registry of layers (id, label, icon, render hook, watched
  entities); a toggle chip row (or menu) on the plan; each layer renders only
  when its feature flag is on AND its toggle is active.
- **Reuse:** the existing render pipeline + `collectWatchedEntities`; the
  editor's existing toggle/section idioms.
- **Unlocks:** 1b–1f. **Dependency for the rest of Track 1.**

### 1b. Lights layer — color + brightness mirroring
- **Goal:** lamp/ceiling-light glow scales radius/opacity with brightness;
  rooms/pieces tint to the bulb's *actual* rgb, not just on/off.
- **Approach:** extend the Phase-5 `fp-furn-glow` + the `color:"rgb"` stateStyle
  path to read `brightness` and `rgb_color`; map brightness → glow intensity.
- **Reuse:** reactive-glyph glow infra, `rgbColorOf`. **Cheapest big win — can
  ship standalone before 1a, then adopt the layer toggle after.**

### 1c. Climate / thermal layer
- **Goal:** rooms breathe warm↔cool from their temperature sensor; setpoint vs.
  actual readable at a glance.
- **Approach:** a numeric→gradient room fill (blue↔red band around a comfort
  midpoint); optional setpoint chip. New per-room `tempEntity` (or reuse area).
- **Reuse:** room `stateStyles`/fill; a new numeric gradient helper.

### 1d. Awareness / security layer
- **Goal:** motion ripples where a motion sensor fires; blink-red safety alerts
  (leak / smoke / door-left-open).
- **Approach:** reuse the tracker **ripple** for motion pings; reuse the
  **blink** animation + an alert palette for safety states; a placement point
  per sensor.
- **Reuse:** `renderRipple`, `fp-*-anim-blink`, the tracker positioning.

### 1e. Energy layer
- **Goal:** switches/plugs colored or sized by live power draw — "what's using
  power right now."
- **Approach:** map a power/energy sensor value → badge color ramp and/or size;
  optional per-room sum. New per-item `powerEntity`.
- **Reuse:** item badge sizing + a value→color ramp (shared with 1c/1e).

### 1f. Media now-playing
- **Goal:** a small playing indicator / tint on a TV or speaker when active.
- **Approach:** extend the `tv`/`smartSpeaker` reactive path with a
  now-playing cue (already glows when active; add a subtle indicator).
- **Reuse:** Phase-3/5 reactive glyphs. Small; folds into Track 1.

---

## Track 2 — Control from the plan

### 2a. Tap a room → scene / toggle
- **Goal:** tapping a room runs a scene or toggles all its lights.
- **Approach:** a room-level `tap_action` (reuse the item/furniture action
  engine) + an "all lights in area" convenience action.
- **Reuse:** `actionHandler`/`handleAction`, area membership (#25).

### 2b. Long-press radial quick controls
- **Goal:** brightness/color/thermostat controls inline on a piece via
  long-press, without leaving the plan.
- **Approach:** a small radial/popover control surface anchored to the piece;
  domain-aware control set. **Largest UI task in Track 2.**
- **Reuse:** hold_action wiring; HA more-info control components.

---

## Track 3 — Authoring

### 3a. Auto-populate a room from its HA area
- **Goal:** pull every entity in a room's HA area onto the plan at once.
- **Approach:** an editor action that reads the area's entities and scatters
  them as items inside the room polygon (kind inferred from domain).
- **Reuse:** the areas work (#25), `kindFromEntity`, the item add-flow. **Biggest
  setup time-saver.**

### 3b. Background-image trace underlay  *(+ stretch: scan import, isometric)*
- **Goal:** draw over a real blueprint/scan image; a stretch is importing room
  geometry from a RoomPlan/CAD scan (ties into the dollhouse project); the far
  horizon is an isometric / 2.5-D mode.
- **Approach:** a background raster layer with opacity + lock; snapping stays as
  today. Scan import and isometric are separate, later sub-projects.
- **Reuse:** existing background/stage handling; the CAD/RoomPlan pipeline for
  the stretch.

---

## Track 4 — Ambience

### 4a. Day/night theming
- **Goal:** the plan dims / shifts with the sun.
- **Approach:** read `sun.sun` (or a time helper) → a global theme modifier over
  fills/strokes; respects the feature flag.
- **Reuse:** the card theme variables.

---

## Recommended sequence
`1a` (framework + the enable/disable system) → `1b`/`1c`/`1d`/`1e` (independent
once the framework exists; `1b` can even precede `1a`) → `1f` → `3a` → `2a` →
`4a` → `2b` → `3b`. Each is a single release. Every one ships behind its
feature flag, default off.

## Definition of done, per sub-project
- Feature flag exposed (config + editor switch), **default off**, zero cost when
  off (no DOM, no watched entities).
- Byte-identical to the prior version when the feature is off / unbound.
- Tests + tsc + build green; schema additive; no AI-authorship footers; nothing
  pushed outside `origin`.
