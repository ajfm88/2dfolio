# Unit 16 — Test-Play Round Trip

## What This Unit Builds

The loop that makes the maker a maker: build, press **Play**, play the level in the
real play scene with the real HUD and touch controls, press **Back to editor**, and
land in the maker exactly as you left it. That covers:

- `maker/validate.js`, which lists the reasons a level cannot be played. The
  first reason is shown inline in the toolbar, and Play stays disabled while any
  reason exists.
- Test-play **through the codec**. The maker serialises its model and play
  deserialises a fresh copy, so a level that test-plays is a level that will load
  from storage.
- A **maker session** that survives the round trip: the level, the undo/redo
  stack, camera, zoom, palette tab, selected tool, eraser and paint/pan mode.
- The **expanding-circle transition** ported from Pirate Maker, with a
  reduced-motion fade, and the DOM veiled while it runs.
- **Back to editor** in the pause overlay and the results panel, and `M`
  promoted from a throwaway bridge key to the test-play shortcut.

**Depends on:** Unit 15. **Installs:** none.

## Constraint That Shapes This Unit

Invariant 2 says play and maker consume the same schema through the same loader.
Today the dev bridge hands the maker's live `LevelModel` object straight to the
play scene. Nothing goes through `serialise` / `deserialise`, so the maker could
produce a level that plays but can never be saved. This unit closes that gap
instead of adding more on top of it. The test-play entry point is
`deserialise(serialise(model))`, and nothing else.

## Decisions Settled Here

These were open in the progress tracker's Session Notes. Each one is decided below
and carried into the relevant context file when the unit is implemented.

| Question | Decision |
| --- | --- |
| Portrait (Open Question 6) | Decided 2026-09-23: ask the player to rotate. That fix is **issue 16's own change**, not this unit. |
| What survives the round trip | Level, undo **and** redo stack, camera x/y, zoom, active palette tab, selected tool, eraser state, paint/pan mode. |
| Where kind-in-registry checks live | `maker/validate.js`. `level/schema.js` stays palette-free, because importing `data/palette.js` there would pull `game/` classes into `level/`. Unit 17's import path runs `findProblems` on an imported level, since `ui/` may import `maker/`. |
| What `validate.js` checks beyond the flag | The rules table below. Spawn and goal are singular by construction, so "exactly one spawn" always holds, and "at least one goal" means `goal !== null`. |
| Quick tap on touch | Out of scope. Logged as **issue 18**, its own change. |
| The `console.warn` on Play without a goal | Replaced by the toolbar status message. |
| The `M` key | Kept, and promoted. In the maker it does what Play does, through the same gate. In test-play it does what Back to editor does. It does nothing in a play scene that has no `onEdit`, which is the campaign case in Unit 18. |
| Where Back to editor lives | The pause overlay and the results panel. There is no new persistent HUD button, because the HUD layout at phone width is still open (issue 4). |
| Death during test-play | Unchanged: the level restarts at the spawn. It restarts from a fresh `deserialise` of the same data. |

## Scope Boundary

This unit covers: `maker/validate.js`, a `revision` counter on `CommandStack`, the
maker session (snapshot and restore), test-play through the codec, the real HUD
and touch controls in test-play, Back to editor, `M` as the test-play shortcut,
the toolbar status message, `core/transition.js` (circle wipe plus the
reduced-motion fade), and the DOM veil during a transition.

This unit does **not** cover:

- the rotate prompt (issue 16)
- tap-to-place (issue 18)
- persisting the session or autosave (Unit 17)
- the Back button's destination, title and level select (Units 17–18)
- a transition on death restart
- jumping the camera to a problem cell, or highlighting it on the canvas
- non-blocking warnings such as "the flag may be unreachable"
- level name editing (Unit 17)
- any change to the level schema, the codec, the entity registry, `world.js`,
  `gestures.js` or `core/input.js`

---

## Files

### New

| File | Role |
| --- | --- |
| `src/maker/validate.js` | `findProblems(level)`: pure, reads `data/palette.js` and schema limits |
| `src/maker/validate.test.js` | Every rule, rule order, a valid level returns `[]` |
| `src/core/transition.js` | Circle-wipe and fade state machine, plus its draw |
| `src/core/transition.test.js` | Timeline, single `onCover`/`onEnd`, re-entry guard, reduced-motion timeline |

### Modified

| File | Change |
| --- | --- |
| `src/settings.js` | `WIPE_CLOSE`, `WIPE_HOLD`, `WIPE_OPEN`, `WIPE_FADE`, `WIPE_COLOR` |
| `src/maker/commands.js` | `CommandStack.revision` |
| `src/maker/commands.test.js` | Revision cases |
| `src/maker/maker-scene.js` | Session restore in `enter`, `snapshot`, Play gate, live validation, `M` |
| `src/game/play-scene.js` | Optional `onEdit` param, `M` → edit, forwards `onEdit` to the HUD |
| `src/ui/hud.js` | Back to editor button in the pause overlay and the results panel when `onEdit` is given |
| `src/ui/maker-toolbar.js` + `styles/maker-toolbar.css` | Status slot; `sync` takes `problem` instead of `canPlay` |
| `src/ui/maker-palette.js` | `initial` option, `getGroup()` |
| `src/ui/maker-toggle.js` | Optional initial pan mode |
| `src/ui/dom.js` | `setVeiled(root, on)`, `prefersReducedMotion()` |
| `src/ui/styles/base.css` | `#ui.ui--veiled` opacity rule |
| `src/main.js` | Bridge becomes a two-mode App: session hand-off, codec round trip, transition, real HUD and touch |

### Not modified

`src/level/*`, `src/data/*`, `src/game/world.js`, `src/game/player.js`,
`src/maker/gestures.js`, `src/maker/tools.js`, `src/core/input.js`,
`src/core/viewport.js`, `tools/*`, `public/assets/*`.

---

## `src/maker/validate.js`

### API

```js
/**
 * @typedef {{ code: ProblemCode, message: string }} Problem
 * @param {LevelModel} level
 * @returns {Problem[]} empty when the level can be played; ordered by the table
 */
export function findProblems(level) {}
```

It is pure: it reads the model, `byId` from `data/palette.js`, and `ENTITIES_MAX`
from `level/schema.js`. It allocates its result, so it must **not** run per frame.
The scene calls it only when `stack.revision` changes (see Scene Integration).

### Rules, in reporting order

| Code | Fails when | Message |
| --- | --- | --- |
| `no-goal` | `level.goal === null` | `Place the finish flag to play.` |
| `spawn-in-terrain` | terrain at the spawn cell | `The spawn point is buried in terrain.` |
| `spawn-in-water` | water at the spawn cell | `The spawn point is underwater.` |
| `goal-in-terrain` | terrain at the goal cell | `The finish flag is buried in terrain.` |
| `spawn-on-goal` | spawn and goal share a cell | `The spawn point and the finish flag share a cell.` |
| `too-many-entities` | `entities.length > ENTITIES_MAX` | `Too many objects: {n} of {ENTITIES_MAX}.` |
| `unknown-kind` | an entity whose `byId(k)` is missing or not `placement: 'entity'`, or a decor record not `placement: 'decor'` | `Unknown object "{k}".` Report it once per distinct `k`. |

Why each rule exists. Each one was checked against the code, not guessed:

- **Spawn in terrain.** `Player` places its 18 × 26 hitbox inside the spawn cell,
  with its feet on the cell's bottom edge. Inside a solid cell the resolver has no
  clean old-rect edge to push against, so the player starts stuck. Painting a
  ground row straight through the default spawn (`rows − 6`) is the common way
  to hit this.
- **Spawn in water.** `world.update` returns `'dead'` on the first frame, so
  test-play would restart forever.
- **Goal in terrain.** `Flag`'s hitbox is 16 × 32 inside its cell, and
  `rect.intersects` is strict, so a player resolved against the surrounding solid
  can never overlap it. The level cannot be finished.
- **Spawn on goal.** The player completes on frame 1.
- **Too many entities.** The maker places without a cap, but `validateLevel`
  rejects more than 400. Without this rule the failure would appear as a codec
  error at Play time instead of a live reason.
- **Unknown kind.** The maker cannot produce one, but a level from a fixture or a
  future import can. This is the kind-in-registry check the architecture deferred
  to "Unit 16". It lives here, not in `schema.js`.

`DECOR_MAX` is not checked. Nothing in v1 places decor, and `validateLevel` still
guards it at the codec boundary.

---

## `CommandStack.revision` (`src/maker/commands.js`)

A plain integer, starting at `0`, incremented by `_record` (so both `execute` and
`push`) and by a successful `undo` or `redo`. A no-op `undo`/`redo` on an empty
side does not increment it. The maker uses it to re-validate only when the level
could have changed, which keeps `findProblems` out of the per-frame path.

Edits made mid-drag are not re-validated until release, because nothing is
pushed until then. That is acceptable: the status message updates when the finger
or mouse lifts.

---

## Maker Session (`src/maker/maker-scene.js`)

### Shape

```js
/**
 * Everything the maker needs to come back exactly as it was left.
 * @typedef {{
 *   level: LevelModel,
 *   stack: CommandStack,
 *   zoom: number,
 *   camX: number,
 *   camY: number,
 *   group: string,           // active palette tab
 *   toolId: string | null,   // selected palette entry, null when none
 *   erasing: boolean,
 *   panMode: boolean,        // paint/pan toggle
 * }} MakerSession
 */
```

Unit 17's `cc:v1:maker:last` (`{ levelId, camX, camY, zoom, tool }`) is a
serialisable subset of this shape. The names are chosen to match it. Nothing is
persisted in this unit.

### `snapshot` (internal)

This returns a `MakerSession` built from the live scene and its mounted UI:
`palette.getGroup()`, `palette.getSelectedEntry()?.id ?? null`,
`palette.isErasing()`, `toggle ? toggle.isPanMode() : false`. The palette is read
directly rather than through the scene's per-frame copy, so a tool picked just
before Play is tapped is the one restored. The **same** `stack` and `level`
objects are handed over. They are not copied, because play never touches them.

*As built:* it is a private helper that only `requestPlay` calls, not a public
scene method, since nothing else needs it. It never sees an in-flight drag,
because `requestPlay` refuses while one is open.

### `enter(params)` changes

`MakerSceneParams` gains `session?: MakerSession`.

- **With a session:** `level`, `stack` and `zoom` come from it. `activeTool` is
  `byId(toolId) ?? null` and `erasing` is `session.erasing`. The camera is set to
  `camX` / `camY` and then clamped with `panBy(0, 0, …)`, because the viewport
  may have changed size during play. `frameCameraOnSpawn` is **not** called.
- **Without a session** (a new level): the current behaviour, plus `zoom = 1`.
  Zoom now belongs to the session, not to the scene instance, so a new level no
  longer inherits the previous one's zoom. This replaces the Unit 14 decision
  "zoom persists on the scene across `M`".
- In both cases the level is validated in `enter` itself (`lastRevision = -1`,
  then `refreshProblems()`). A frame can render before the first fixed step, and
  Play must never show as enabled on an unplayable level.

`ResizeCommand`'s `onResize` closure reads the scene's current `params` and
`level`, so a restored stack's resize undo/redo works after re-entry without any
change.

### `mountUI(root)` changes

- The palette is created with `initial: { group, toolId, erasing }` from the
  session when there is one.
- The toggle is created with `{ panMode }` from the session when there is one.
- The toolbar's `onPlay` calls the Play gate below.

### Play gate — `requestPlay()` (internal)

`requestPlay()` is the one path used by both the Play button and `M`:

1. Call `refreshProblems()`, because a toolbar Undo can land between frames. Then,
   if `dragState` is set, `problems.length > 0`, or `params.onPlay` is missing,
   do nothing. The status message already says why.
2. Otherwise `data = serialise(level)`, then `deserialise(data)` once as a
   proof-load, inside a `try`. A `LevelError` sets `loadError = err.message`,
   which names the field, and stops. This should be unreachable once the rules
   pass. It is the boundary catch the code standards require, not a second
   validator.
3. Call `params.onPlay(data, snapshot())`. The App only records the request (see
   App). No DOM is touched here.

### `update(dt)` changes

- `refreshProblems()`: if `stack.revision !== lastRevision`, set
  `problems = findProblems(level)`, `loadError = null`, and
  `lastRevision = stack.revision`. It is called at the **end** of `update`, so a
  drag that closed this frame shows in this frame's render. (As first written it
  ran at the top of `update`, which left the status one frame stale after every
  drag. A round-trip harness caught that during implementation.)
- After `input.advance()`: if `keys.modeSwitch.pressed` and `requestPlay()`
  succeeds, return at once. Anything painted after the snapshot would be in the
  maker's level but not in the one being played.

The bridge's own `M` handling in `main.js` goes away.

### `render(ctx, cam)` changes

`toolbar.sync({ canUndo, canRedo, problem })`, where `problem` is
`loadError ?? problems[0]?.message ?? null`. This call stays above the cursor
early-return (issue 10).

### Removed

`getLevel()` has no caller once the App uses sessions, so it is deleted
(dead-code rule).

---

## Toolbar Status (`src/ui/maker-toolbar.js`)

- `sync(state)` becomes `{ canUndo: boolean, canRedo: boolean, problem: string | null }`.
  Play is disabled exactly when `problem !== null`.
- There is a new centre element between the two button groups:
  `div.maker-toolbar__status`, `role="status"`, `aria-live="polite"`. It holds the
  problem text, or nothing when the level is valid.
- Its `textContent` and `title` are set only when the string changes. It is
  diff-based like the button states, and `textContent` is used, never
  `innerHTML`.
- CSS: `flex: 1 1 auto`, `min-inline-size: 0`, centred text, `--fs-sm`,
  `--text` on the board, one line with `text-overflow: ellipsis`, and the full
  text in `title`. It is not interactive, so it has no 44 px rule and no focus
  style. It has a small `--danger` pip before the text, drawn in CSS, so the
  message reads as a blocker rather than a hint. No hex values and no
  `border-radius`.

On a fresh level this shows "Place the finish flag to play." That doubles as the
first-run hint Goal 2 wants.

---

## Palette and Toggle Restore

### `createMakerPalette(root, { atlas, onSelect, initial? })`

- `initial` has the shape `{ group: string, toolId: string | null, erasing: boolean }`.
- When `initial` is given: `switchTab(initial.group)` if that group is visible,
  otherwise the first visible group. Set `selected = byId(toolId) ?? null` and
  `erasing`, then `paintSelected()`. **Do not** call `onSelect`, because the
  scene already restored its own state from the session.
- New controller method `getGroup()` returns `activeGroup`.

### `createPaintPanToggle(root, input, opts?)`

`opts.panMode` (default `false`) seeds the initial state and runs `paint()`. It is
still hidden until the first touch, and `onTouchDetected` fires immediately once a
touch has been seen, so a touch user sees it straight away on return.

---

## Play Scene (`src/game/play-scene.js`)

- `PlaySceneParams` gains `onEdit?: () => void`. Its presence is what the
  architecture calls `Play(returnTo: maker)`. The game still knows nothing about
  the maker.
- `update`: after `input.advance()`, if `params.onEdit` and
  `keys.modeSwitch.pressed`, call `params.onEdit()` and return. This is checked
  before the pause handling, so `M` works while paused and on the results screen.
- `mountUI`: pass `onEdit` through to `createHud`.
- `enter`: frame the camera on the player immediately (`followPlayer()`, now
  shared with `update`). The wipe draws this scene under the opening iris before
  its first update, and without this the level would show at the maker's camera
  position and then jump. (Added during implementation.)

## HUD (`src/ui/hud.js`)

- `HudOpts` gains `onEdit?: () => void`.
- The pause overlay's actions become `[Resume (.btn--primary), Back to editor (.btn)]`
  when `onEdit` is given. Resume keeps focus, so Enter still resumes.
- The results panel's actions become `[Play again (.btn--primary), Back to editor (.btn)]`
  when `onEdit` is given. Play again keeps focus.
- Without `onEdit` both panels are unchanged. That is the campaign case.

---

## Transition (`src/core/transition.js`)

### Port

This ports `reference/pirate-maker/28_finish/main.py` `Transition`: a ring
centred on the view, with outer radius equal to the half-diagonal, and a border
that grows inward at a constant rate until the screen is covered. The modes swap
while it is covered, then the ring shrinks back. Two deliberate deviations:

- **Time, not speed.** Pirate Maker grows the border at 1000 px/s, so its
  duration depends on window size. Here each phase has a fixed duration in
  `settings.js`, so the wipe takes the same time on a 512-wide phone and a
  768-wide desktop.
- **Fixed timestep.** The state advances only in `update(FIXED_DT)` (invariant
  1). `draw` reads it and mutates nothing (invariant 3).

### Settings

| Constant | Value | Why |
| --- | --- | --- |
| `WIPE_CLOSE` | `0.4` s | Iris closes. Pirate Maker takes ~0.83 s; halved because test-play is a tight loop |
| `WIPE_HOLD` | `0.1` s | Fully covered, the swap happens at its start. Pirate Maker's `threshold = radius + 100` at 1000 px/s |
| `WIPE_OPEN` | `0.4` s | Iris opens |
| `WIPE_FADE` | `0.05` s | Each half of the reduced-motion fade (100 ms total) |
| `WIPE_COLOR` | `'#33323d'` | `--ink`; the canvas cannot read CSS variables (same reason as the 2026-09-07 theme colours) |

### API

```js
export function createTransition() {
  return {
    get active() {},          // true from start until onEnd has fired
    /** @param {{ reducedMotion: boolean, onCover: () => void, onEnd: () => void }} opts
     *  @returns {boolean} false (and does nothing) if already active */
    start(opts) {},
    /** @param {number} dt */
    update(dt) {},            // fires onCover once at close end, onEnd once at open end
    /** @param {CanvasRenderingContext2D} ctx @param {number} viewW @param {number} viewH */
    draw(ctx, viewW, viewH) {},
  };
}
```

- **Wipe timeline:** close `[0, C)` → `onCover` → hold `[C, C+H)` → open
  `[C+H, C+H+O)` → `onEnd`, inactive.
- **Hole radius:** `R·(1 − t/C)` during close, `0` during hold, and
  `R·(t'/O)` during open. `R = hypot(viewW/2, viewH/2)`.
- **Draw (wipe):** `beginPath`, `rect(0, 0, viewW, viewH)`, `arc(cx, cy, r, 0, 2π)`,
  `fill('evenodd')` in `WIPE_COLOR`. When `r ≤ 0`, a plain `fillRect`. There is
  no `save`/`restore`, which code standards reserve for flipped sprites.
- **Reduced motion:** the timeline is `WIPE_FADE` → `onCover` → `WIPE_FADE`, with
  no hold. It draws `fillRect` at `globalAlpha = t/F`, then `1 − t'/F`, and resets
  `globalAlpha = 1` afterwards. `3-ui-context.md` calls this a "100 ms
  cross-fade". With one scene alive at a time a true cross-fade is impossible, so
  it is a fade **through** `--ink`. The UI doc's wording is corrected to match.
- It imports only `settings.js`, so invariant 11 holds.

---

## App (`src/main.js`)

The bridge becomes a two-mode App. It still boots straight into the maker with
`createEmptyModel()`, because title and level select are Unit 18.

### State

```js
let mode = 'maker';              // 'maker' | 'play'
let session = null;              // MakerSession while in play; null otherwise
let playData = null;             // LevelData from serialise(); fresh deserialise per (re)start
let request = null;              // 'play' | 'maker' | null — set by callbacks, consumed in update
let pendingRestart = false;      // unchanged
```

### Requests, not actions

The maker's `onPlay(data, snap)` sets `playData`, `session` and
`request = 'play'`. The play scene's `onEdit()` sets `request = 'maker'`. Both
can arrive from a DOM click or from inside a scene's `update`, so they only flip
state. The App acts on them after the scene update returns. This follows the
2026-09-13 restart pattern (invariant 3).

### `update(dt)`

1. If `transition.active`: call `input.advance()` so edges do not pile up
   (no scene is updating), then `transition.update(dt)`, and return. Neither
   scene steps while the wipe runs. The old scene is frozen under the closing
   iris and the new one is frozen under the opening iris.
2. Otherwise update the current scene, then handle `pendingRestart` as now.
3. If `request` is set, clear it and call `transition.start(…)`:
   - `reducedMotion: prefersReducedMotion()`, read at each start so a
     system-setting change applies.
   - Call `setVeiled(uiRoot, true)` first. When heading to the maker, call
     `audio.stopMusic()` too, so its fade overlaps the close.
   - `onCover`: unmount and exit the current scene, set `mode`, enter and mount
     the other.
     - **Play:** `playScene.enter({ level: deserialise(playData), …,
       ui: { createHud: createPlayHud, createTouch: createTouchControls },
       onDeath, onReplay, onEdit })`.
     - **Maker:** `makerScene.enter({ …, session })`, then `session = null` and
       `playData = null`.
   - `onEnd`: `setVeiled(uiRoot, false)`.
4. `restartPlay` deserialises `playData` again, so every attempt starts from the
   same bytes the maker handed over.

### `render()`

`viewport.apply(ctx)`, render the scene, then `viewport.apply(ctx)` **again**
(the maker leaves a `ctx.scale(zoom)` behind), then `transition.draw(ctx,
viewport.viewW, VIEW_H)` when active.

### Removed

`createStubHud`, `createStubTouch`, `switchToPlay`'s `console.warn`, the
`makerCamX`/`makerCamY`/`hasMakerCam` stash (the session replaces it), and the
bridge's `modeSwitch` handling (the scenes own `M` now).

## DOM Veil (`src/ui/dom.js`, `base.css`)

- `setVeiled(root, on)`: `root.inert = on`, and toggle the class `ui--veiled`.
  `inert` stops clicks and focus in the whole overlay, so a second Play tap or a
  stray Undo cannot land mid-wipe.
- `prefersReducedMotion()`:
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- CSS: `#ui { transition: opacity 120ms ease-out; }`,
  `#ui.ui--veiled { opacity: 0; }`, and `0ms` under `prefers-reduced-motion`.
  That follows 3-ui-context Motion: "DOM panels fade to match".

---

## Implementation Order

Each step is verified before the next starts.

0. **Before this unit (separate change): issue 16's rotate prompt.** It is not
   required for the round trip. Without it, the portrait rows of the
   verification checklist are skipped and noted rather than failed.
1. **Pure modules and tests.** `validate.js`, `CommandStack.revision` and
   `transition.js`, each with tests. `npm test` green.
2. **Session round trip, no wipe yet.** Snapshot and restore, palette and toggle
   `initial`, and the App switching instantly through `request`. Verify the
   lossless round trip by hand.
3. **Codec path and real play UI.** `deserialise(serialise())`, the real HUD and
   touch controls, `onEdit`, Back to editor, and `M` in both scenes.
4. **Live validation.** Revision-driven `findProblems`, the toolbar status slot,
   Play gating, and removal of the `console.warn`.
5. **Transition.** Circle wipe, veil, and the reduced-motion fade.
6. **Verify and update docs.** The full checklist below, then the doc list.

## Not Built

- The portrait rotate prompt (issue 16) and tap-to-place on touch (issue 18).
- Where the maker's Back button goes (Unit 17/18). It stays a no-op.
- Persisting the session, autosave, and level names (Unit 17).
- A transition on death restart, or into and out of level select (Unit 18).
- Highlighting or jumping to the cell a problem refers to, and non-blocking
  warnings.
- A persistent Edit button on the HUD.
- Any change to what counts as a valid saved level. `schema.js` is untouched, and
  `findProblems` is a playability check, not a format rule.

## Docs To Update In The Same Change

| File | Update |
| --- | --- |
| `2-architecture.md` | `maker/` gains `validate.js`; `core/` gains the transition; Scene and Mode Model describes the session (level, stack, camera, zoom, tab, tool, eraser, pan mode) and play-via-codec; replace "the throwaway `M` mode-switch" with the test-play shortcut; replace "Kind-in-registry schema checks wait until … (Unit 16)" with where they live now |
| `1-project-overview.md` | Maker features: "a level needs a spawn and a finish flag in playable cells" instead of "exactly one spawn and at least one flag" |
| `3-ui-context.md` | Motion: reduced-motion is a 100 ms fade through `--ink`. Layout: the toolbar's centre status slot |
| `4-code-standards.md` | Constants list gains `WIPE_*`; File Organization: `core/transition.js`, `maker/validate.js` (drop "is Unit 16") |
| `specs/00-build-plan.md` | Unit 16 line matches this spec's rules |
| `6-progress-tracker.md` | Unit entry, decisions (session shape, play via codec, `M` promoted, zoom now per-session), Session Notes |
| `7-current-issues.md` | Anything found and not fixed |

---

## Verification Checklist

### Validation

- [ ] Fresh level: Play disabled, status reads "Place the finish flag to play."
- [ ] Place the flag: status clears, Play enables
- [ ] Paint terrain over the spawn: "buried in terrain", Play disabled; undo clears it
- [ ] Spawn in water, flag in terrain, flag on the spawn cell: each shows its own message
- [ ] Two problems at once: the first in table order is shown; fixing it reveals the next
- [ ] `M` on an invalid level does nothing and throws nothing
- [ ] The status text never exceeds one line; its `title` shows the full text
- [ ] `findProblems` runs only when `stack.revision` changes (checked with a temporary counter, removed after)

### Round trip — lossless ten times in a row

Before each Play: paint something, select a tool on a tab other than the first,
zoom to 2×, pan away from the spawn, and undo once so a redo tail exists. After
each Back to editor:

- [ ] Camera x/y is identical (or clamped, if the viewport changed size)
- [ ] Zoom is identical
- [ ] The same tab is active and the same tool is highlighted; the eraser is restored when it was active
- [ ] The paint/pan toggle keeps its mode (touch emulation)
- [ ] Undo steps back through edits made **before** the test-play; Redo still works
- [ ] The level is byte-identical: `toJsonString` before and after match
- [ ] Ten consecutive round trips with no drift and no console errors

### Test-play

- [ ] Plays the deserialised copy: coins collected in play are still in the maker afterwards
- [ ] Real HUD: hearts, coin count, pause button; touch controls appear on touch
- [ ] Pause → Back to editor returns to the maker; Resume still resumes; Enter still resumes
- [ ] Results → Back to editor returns to the maker; Play again restarts; Enter replays
- [ ] `M` in play (running, paused, results) returns to the maker
- [ ] Death restarts in place; the next attempt is identical to the first
- [ ] Music starts in play and fades out on the way back; no restart on death

### Transition

- [ ] Iris closes on the current scene, holds, the scene swaps, iris opens (both directions)
- [ ] Same duration at 512- and 768-wide viewports
- [ ] Neither scene simulates during the wipe (the player does not move under the opening iris)
- [ ] DOM fades out at start and back in at end; buttons cannot be clicked or focused mid-wipe
- [ ] Double-clicking Play or mashing `M` starts exactly one transition
- [ ] `prefers-reduced-motion: reduce` (DevTools rendering emulation): a 100 ms fade through ink, and no DOM fade
- [ ] Held keys do not stick across a switch; a key pressed mid-wipe is not replayed afterwards

### Regression and build

- [ ] Painting, erasing, markers, resize (with undo and redo, including after a round trip), gestures, eyedropper
- [ ] `npm test`: the prior 201 plus the new validate, transition and revision tests
- [ ] `npm run build`: no errors; `getDiagnostics` is clean on every touched file
- [ ] No console errors or warnings in a full session
- [ ] Phone landscape (844 × 390) and desktop, touch emulation on and off. Portrait shows the rotate prompt if issue 16 has landed; otherwise it is skipped and noted.
