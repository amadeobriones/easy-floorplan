# Upstream sync log

We run a fork of [`nicosandller/easy-floorplan`](https://github.com/nicosandller/easy-floorplan).
`nicosandller` is the project; [`shauneccles`](https://github.com/shauneccles) is the other
contributor, and much of the editor is his work. **We consume upstream. Traffic flows one way: in.**

This file records what we changed to keep our code compliant with theirs: what upstream
shipped, what we adopted, what we kept instead, and why. It exists because "we already have
that" turned out to be wrong once, expensively, and the reasoning is worth writing down.

---

## Where we stand — 2026-07-12

### Against `shauneccles`: fully in sync, nothing outstanding

He has **no open PRs**. All six of his are merged upstream, and we hold every one of them:

| His PR | What it is | In our `main` |
|---|---|---|
| #22 | Openings: sliding / biparting doors and windows, live cover position | yes |
| #26 | Render entity state at HA's configured display precision | yes (`hass.formatEntityState`) |
| #27 | CI: skip HACS validation on PRs from forks | yes |
| #28 | Accent a cover still in transit | yes |
| #43 | Editor: full-screen mode, input correctness, `editor-geometry` | yes |
| #44 | Editor: `ha-form` schema-driven rows, tap/hold/double-tap actions | yes |

His branches that still read "ahead" of upstream are squash artifacts or superseded
iterations; `feat/ha-form-editor` has a **`+0/-0` content diff** against `upstream/main` —
it *is* upstream now. There is nothing left of his to take.

### Against `nicosandller`: we hold all of upstream's code

`git` reports us "4 behind" `upstream/main`. That is squash noise — we applied his content
against the true ancestor rather than merging his commits. By content we contain every line
of upstream except the code we **deliberately replaced**, listed below.

### Where we intentionally diverge from upstream

These are not drift. Each is a decision, and each would be a regression to "fix" back.

- **`entityIsActive` — we invert the table.** Upstream keeps an `ACTIVE_STATES` **allowlist**
  covering only `lock`, `vacuum`, `camera`; every other domain falls back to the generic
  on/off test. But a `climate` entity's state *is its hvac mode* (`heat`, `cool`, `fan_only`) —
  never the string `on` — so upstream renders **a running thermostat as off, permanently**.
  Same for `water_heater`. A *paused* `media_player` also reads off, where HA itself treats
  paused as on. We list what counts as **inactive** per domain instead (`INACTIVE_STATES`),
  which is correct for every domain including the ones nobody has enumerated yet.
- **Editor key handling.** The capture handler uses our modifier-aware `isTypingTarget`, not
  upstream's `isTypingPath`. Upstream's is modifier-blind; adopting it regresses #37, because
  the floor switcher is a `<select>` that keeps focus and `Cmd+V` then reads as typing.
  Upstream's `isTypingPath` still backs the bubble-phase host listener, where the key is
  always Escape and modifiers are moot.

### Upstream work in flight that will supersede ours

`nicosandller` has three open PRs re-implementing features this fork already carries. When
they merge, per `FORK_STRATEGY.md` we **drop ours whole** rather than untangle them — but note
they are not drop-in, because the designs differ:

| Upstream PR | Closes | Our equivalent | Divergence |
|---|---|---|---|
| #57 | #30 #34 #37 #38 #39 #50 | `editor-walls`, icon anchor, select-focus, zoom, entity-less items | Wall welding: theirs `CORNER_ATTACH_EPS = 0.75` in `editor-geometry`; ours `WELD_EPS = 1` in `editor-walls`. Two modules, one feature. Their #34 also carries the `showIcon: false` guard ours lacked. |
| #58 | #48 | our `stateStyles` `animation` | Theirs is `iconAnimation` (`auto`/`none`/`spin`/`pulse`) with a domain map on `FloorItem`; ours is rule-driven off `stateStyles`. Overlapping, not identical. |
| #60 | #33 | our per-floor `rotation` | Theirs is **top-level** (whole card); ours is **per `Floor`**. Ours is the superset — folding down to theirs loses per-floor rotation. |

**Do not re-send** #30/#34/#37/#38/#39/#50, rotation, or icon animation as patches — upstream is
already building them.

---

## 2026-07-11 — adopt the landed editor base (upstream v0.7.3 + v0.7.4)

### What upstream shipped

| Upstream PR | Author | Landed |
|---|---|---|
| #40 — six item kinds, eight furniture symbols, handed sectional, aspect-ratio trap | us | v0.7.3 |
| #43 — editor: full-screen edit mode, input correctness, HA-norms alignment | shauneccles | v0.7.3 |
| #44 — editor: form rows migrated to `ha-form`/HA selectors; tap/hold/double-tap actions | shauneccles | v0.7.4 |

### The problem this sync fixed

We merged shauneccles's editor branches **while they were still in flight** — `feat/editor-fullscreen`
at `cb759b4`, `feat/ha-form-editor` at `9497931` — and then built ~190 commits on top. He
subsequently pushed four review fixes, and *those* are the versions that landed upstream.

So our fork was carrying an **interim snapshot of his editor that now exists nowhere else**:
not upstream, not on his branches. Getting ahead is how we got behind.

### Why the obvious merge is the wrong tool

`git merge upstream/main` produces **58 conflict hunks, most of them phantom**. Upstream
squash-merges, so our copy of his code shares no history with its own squashed copy; git falls
back to a merge base of `fc759d8` (Release 0.7.2, *before* ha-form existed) and cheerfully
conflicts his ha-form code against our ha-form code as though they were unrelated. It also
manufactures a convincing illusion that we are still on a hand-rolled editor idiom he retired.
We are not — we use his `_renderForm` schema-driven forms throughout.

The fix is to apply his delta against **our true shared ancestor, `9497931`**:

```sh
git diff 9497931 upstream/main -- src/editor.ts | git apply -3
```

Against the correct base his editor delta is **97 insertions, not a rewrite** — because his
final branch is a *continuation of our own lineage*, not a competing implementation.

> **Rule learned:** never let git pick the merge base against a squash-merging upstream.
> Find the commit we actually forked from and diff against that.

### What we adopted (his code, as the base)

- **`d7c8d65` — Escape containment.** The one that mattered. HA 2026.7's redesigned pickers
  (`ha-picker-combo-box` / `wa-input`) hold focus and handle Escape themselves; a capture-phase
  swallow *starves* them, leaving an orphaned dropdown that focus cannot escape. Capture now lets
  typing-path Escapes through so the overlay can absorb them; a new bubble-phase host listener
  contains any Escape nothing absorbed, before it can reach — and close — HA's dialog. He found
  this live on core 2026.7.1, which is what we run.
- **`35982ee`** — a canceled drag restores the redo stack its first movement cleared.
- **`6600e04`** — an empty YAML key (`trackers:`) parses to `null` and is *unset*, not malformed;
  and `pointerdown` ends the live-edit burst, so two drags of one slider are two undo steps.
- **`27a0f4b`** — `getGridOptions` is an **instance** method. HA calls it on the card element, so
  as a `static` it was silently ignored and our sections-view sizing never applied.

### What we kept on top (and why it is not a regression of his)

The capture-phase handler uses **our** modifier-aware `isTypingTarget` rather than his
`isTypingPath`. His has no modifier awareness, and adopting it verbatim would regress our #37
fix: the floor switcher is a `<select>` that keeps focus after you change floors, so a
modifier-blind predicate treats `Cmd+V` as typing and paste dies "between floors". His
`isTypingPath` still backs his host listener, where the key is always Escape and modifiers are moot.

His architecture, our predicate. Both are load-bearing.

### Nothing to take, and worth recording

- **`editor-forms.ts`** — his only delta there is nicosandller's port of *our* #40 furniture
  (the eight types plus the conditional "Chaise side" field) into his form builders. That is our
  own code coming home; we already have it.
- **`entityIsActive`** — ours is *ahead* of upstream. Upstream still tests an **active**-state
  allowlist; we invert it to an **inactive**-state blocklist per domain, because climate reports
  `cool`/`heat`, locks report `unlocked`, vacuums `cleaning`, cameras `recording`. Keeping the
  allowlist would re-break the thermostat, which read as "off" for weeks. **Do not "fix" this
  back toward upstream.**
- **`shauneccles/main`** looks 36 commits ahead of upstream. It is not: that is squash inflation,
  and the content diff is *479 deletions* because his `main` lacks our #40. His only other
  unmerged branch (`claude/card-editor-optimization`) is a superseded 9 July iteration.
  **Upstream `main` is the whole of his finished work.** Never trust ahead/behind.

### Verification

`tsc` clean · **608/608 tests** · build clean (350.98 kB).

Test count is unchanged from before the sync, which is the point: his code went in underneath
ours without displacing any of it.

### Still open

- `fix/39-entityless-items` was built on `actions.ts` + `editor-forms.ts` while those files existed
  only on shauneccles's unlanded branches. They have now landed upstream, so that patch needs
  redoing against the real ones. `FORK_STRATEGY.md` predicted this.
- Our tap-scenes logic and his `actions.ts` are an add/add collision — we each invented the module.
  Converge on **his**; do not maintain two.

### Do not push

`pr/34-icon-alignment` and `pr/registry-icon` are the heads of PRs **#41** and **#42**, which
nicosandller **reopened** on 2026-07-11 after we had closed them. Pushing to either updates the PR
and notifies its subscribers. They are listed in `OPEN_PR_HEADS` in the sync tooling.
