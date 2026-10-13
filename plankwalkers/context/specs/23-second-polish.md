# Unit 23 — Second Polish Pass

> **Status: COMPLETE, 2026-10-11.**
> - Grok implemented parts A–D (`091dee6`–`5e9ade6`), and Claude reviewed them.
> - The review moved `isButtonActivation`'s JSDoc back above its function and
>   typed two new tests' parameters (`b89af43`).
> - The player signed the unit off.
> - Holding ▶ and Jump together is checked on a phone in the deploy step.
>
> Every decision below is the player's unless it is marked **Proposed**. The
> proposed items are approved when the player hands this spec to the
> implementer.

## Goal

Four open issues, fixed as four small parts, each verified and committed on its
own:

| Part | Issue | What changes for the player |
| --- | --- | --- |
| A | 31 | The left and right edges of a level stop the player like a wall |
| B | 43 | The maker's sea, horizon and clouds follow the water as it is painted |
| C | 24 | The maker zooms with the mouse wheel and the `+` / `−` keys |
| D | 4 | The on-screen touch controls are rearranged for two thumbs |

Nothing else changes. No level format change, no new dependency, no asset
pipeline run.

## Before You Start

1. Read `CLAUDE.md` and the context files in order, then this spec end to end.
2. `git status` must be clean. If it is not, stop and ask.
3. `npm test` (399 tests in 34 files) and `npm run build` must pass before you
   change anything. Record both.
4. Mark Unit 23 **in progress** in `context/6-progress-tracker.md` (Current
   Phase, Current Goal, In Progress).
5. This repository has **no git remote, and must not get one**. Commit locally;
   never add a remote and never push. Do not touch any other folder on this PC.
6. Do not run `npm run assets`. Nothing here changes the art.

**Stop and ask** rather than inventing behaviour:
- if anything in this spec contradicts the code;
- if a step needs a new npm package;
- if a test outside the files a part names starts failing;
- if Part B's step 0 does not reproduce issue 43.

Do not touch any other open issue (5, 6, 8, 9, 21, 25, 27, 35, 36, 41, 44, 45),
and do not refactor code a part does not name.

## Decisions

| # | Decision | Choice | By |
| --- | --- | --- | --- |
| 1 | Level side edges (issue 31) | An invisible wall at both side edges, ported from Super Pirate World `code_complete/level.py` `check_constraint`. Not a wall for wall slide or wall jump, as in SPW. The bottom stays open | Player, 2026-10-11 |
| 2 | Desktop zoom input (issue 24) | A plain mouse wheel (and a trackpad swipe or pinch) zooms, about the pointer. `+` / `−` keys zoom about the view centre | Player, 2026-10-11 |
| 3 | Touch layout (issue 4) | Split: ◀ ▶ bottom-left, side by side; ▼ and a larger Jump bottom-right, with Jump in the corner | Player, 2026-10-11 |
| 4 | Wheel pacing | One zoom step per wheel *burst*: the first event of a burst steps, and the wheel must then be quiet for `WHEEL_ZOOM_REARM` (0.2 s) before it can step again. A mouse notch is one step; a trackpad swipe, inertia included, is one step | **Proposed** |
| 5 | Zoom keys | `Equal`, `NumpadAdd` (and a `+` or `=` key) zoom in; `Minus`, `NumpadSubtract` (and `-`) zoom out. **Never** with Ctrl, Cmd or Alt held, so the browser's own Ctrl `+` / `−` page zoom keeps working | **Proposed** |
| 6 | Zoom mid-stroke | Ignored while a paint drag is open, like undo | **Proposed** |
| 7 | When the maker horizon updates (issue 43) | When the command stack's revision changes (the end of a stroke, undo, redo, resize, theme). The parallax is recreated only if the derived horizon actually moved. Mid-stroke, the horizon waits for the release | **Proposed** |
| 8 | Recreating the parallax | Accepted: when the horizon moves, the clouds go back to their seeded starting positions. The horizon itself jumps at that moment, so the reset is masked. Play already starts every level this way | **Proposed** |
| 9 | Touch sizes | ◀ ▶ ▼ stay 64 px; Jump grows to 80 px; 16 px between buttons in a cluster (all × `--ui-scale`) | **Proposed** |

## Measured Facts

- **SPW's edge rule** (`reference/super-pirate-world/code_complete/level.py:223`):
  ```python
  if self.player.hitbox_rect.left <= 0: self.player.hitbox_rect.left = 0
  if self.player.hitbox_rect.right >= self.level_width:
      self.player.hitbox_rect.right = self.level_width
  ```
  It runs every frame after the player moves. The bottom border is death.
- **The campaign is unaffected by Part A:** all six levels have a full-height
  terrain wall in their first and last columns (issue 31 notes).
- **Enemies and projectiles already stay in:** walkers treat out-of-grid cells
  as no floor and turn back; projectiles die at `x < 0` or `x >= worldW`.
- **Issue 43's cause, from the code:** `createParallax` captures
  `horizonY(level)` once (`src/level/parallax.js`). The maker recreates the
  parallax only in `syncTheme` (enter, theme change) and in the resize
  command's callback (`src/maker/maker-scene.js`). Play creates a fresh world,
  and so a fresh parallax, on every enter.
- **Maker zoom today:** `ZOOM_LEVELS = [0.5, 1, 2]` and a private
  `neighbourZoom(current, dir)` in `src/maker/gestures.js`. Only a two-finger
  pinch sets `gestures.zoomSnap`, which the maker applies through
  `applyZoom(newZoom, centerVx, centerVy)`. That keeps the world point under
  the centre fixed. `centerVx` and `centerVy` are virtual screen pixels, the
  same space as `input.pointer.x` and `y`.
- **Wheel over the DOM:** the maker palette's tool strip scrolls sideways
  (`src/ui/styles/maker-palette.css`), so a wheel over the UI must keep its
  default. Only a wheel aimed at the canvas belongs to the game.
- **Touch layout today** (`src/ui/styles/touch-controls.css`): a 2 × 2 grid
  bottom-left, ◀ ▶ on top and ▼ centred under them, 136 px tall at
  `--ui-scale` 1, with Jump alone bottom-right. On a 390 px tall landscape phone
  the left cluster covers more than a third of the screen height, and the two
  most-used buttons sit above the rarely used ▼.

## Delivery Order

A → B → C → D. Each part ends with `npm test` and `npm run build` passing, its
docs updated, and one local commit. Do not start a part before the previous one
is committed.

---

### A — Level Side Edges (issue 31)

**Files:** `src/game/world.js`, `src/game/world.test.js`.

**Tests first.** In `src/game/world.test.js`, add
`describe('level side edges', …)` with two tests. Run them and watch both fail
on today's code before changing `world.js`.

- Build the level with `deserialise(createBlankLevel({ cols: 40, rows: 12 }))`
  (imports from `../level/codec.js` and `../level/schema.js`). Fill its bottom
  row with terrain: `level.layers.terrain.fill(1, 11 * 40, 12 * 40)`. The
  spawn is (4, 6) and the goal (32, 4), so the flag is out of the player's
  way.
- Create the world with the file's existing `mockAtlas()` and `idleKeys()`.
  Hold one key by setting `keys.left.held = true` or `keys.right.held = true`.
- Step with `world.update(1 / 60, 0, 768)`.
- **Left:** hold left for 300 frames. After every frame, `world.player.hitbox.x`
  is `>= 0` and the status is `'playing'`. At the end, `hitbox.x === 0`.
- **Right:** hold right for 900 frames. After every frame,
  `hitbox.x + hitbox.w <= 40 * TILE`, and the status is `'playing'`. At the
  end, `hitbox.x === 40 * TILE - hitbox.w`.

**The change.** In `createWorld`'s `update`, immediately after
`player.update(dt);`:

```js
// The side edges hold the player like a wall; the bottom stays open (the pit).
// Ported from Super-Pirate-World code_complete/level.py check_constraint.
const hb = player.hitbox;
if (hb.x < 0) hb.x = 0;
if (hb.x + hb.w > worldW) hb.x = worldW - hb.w;
```

Nothing else changes: `physics.js`, `player.js` and the wall sensors are left
alone. The edge is deliberately not a wall for wall slide or wall jump (SPW).

**Verify in the browser** (`npm run dev -- --port 5174 --strictPort`):
1. Maker → New Level. Paint a terrain floor across the whole width, place the
   flag, test-play. Walk left from the spawn: the captain stops at the level's
   edge and does not fall. Walk to the right end: the same.
2. Jump against an edge: no wall slide, no wall jump, no sticking.
3. Castaway Beach plays as before.
4. No console errors.

**Docs:**
- `2-architecture.md`, Physics Model: add a bullet saying the level's left and
  right edges clamp the player's hitbox after it moves (SPW `check_constraint`),
  that they are not terrain (no wall slide or wall jump), and that the bottom
  stays open.
- `1-project-overview.md`, Play mode, the Hazards bullet: after "a bottom death
  border", add that the level's sides hold the player.
- `7-current-issues.md`: move issue 31 to Resolved with the date, what changed,
  the test count and the commit.
- `6-progress-tracker.md`: a Part A entry.

**Commit:** `Unit 23 part A: hold the player at a level's side edges (#31)`

---

### B — The Maker Follows the Horizon (issue 43)

**Files:** `src/maker/maker-scene.js`.

**Step 0, confirm the bug first.** Maker → New Level. Paint a row of water
about halfway up the level and release. Today the sea and horizon stay at the
level's bottom. Test-play, then come back to the editor: now the horizon is on
the water row. Record what you saw. If the horizon already follows the water,
**stop and ask**.

**The change.**
1. Import `horizonY` alongside `createParallax`:
   `import { createParallax, horizonY } from '../level/parallax.js';`
2. Next to `lastRevision`, add:
   ```js
   // The stack revision whose horizon the parallax was last checked against.
   let horizonRevision = -1;
   ```
3. Add a function next to `syncTheme`:
   ```js
   /**
    * The horizon is derived from the water layer, and the parallax captures it
    * when created. Re-check it when the stack says the level may have changed,
    * and rebuild only if it moved (issue 43).
    */
   function syncHorizon() {
     if (!params || !level || !stack || !parallax) return;
     if (stack.revision === horizonRevision) return;
     horizonRevision = stack.revision;
     if (horizonY(level) !== parallax.horizonY) {
       parallax = createParallax(level, theme, params.atlas);
     }
   }
   ```
4. In `enter`, after `syncTheme();`, set `horizonRevision = stack.revision;`.
   The parallax that `syncTheme` just created is current.
5. In `update`, call `syncHorizon();` immediately **before**
   `parallax.update(dt, params.camera.x, d.eW);`. That is after the paint has
   been processed, so a stroke released this frame, or an undo, is seen this
   frame.

`horizonY` scans the water layer, so it runs only when the revision changes,
never every frame. `createParallax` allocates, so it runs only when the horizon
moved. Do not change `parallax.js`, `render.js` or play.

**Tests:** none. Scenes are verified by running the game
(`4-code-standards.md`, Testing). `npm test` must still pass unchanged.

**Verify in the browser:**
1. Repeat step 0. On release, the sea, horizon line, BG Image, cloud bank and
   reflections move to the water row.
2. Undo: they go back to the bottom. Redo: back to the row.
3. Paint a second water row higher up: the horizon moves up to it. Erase that
   row with the eraser: it moves back down.
4. Mid-stroke, the horizon does not move. It moves on release.
5. Switch to Pirate Ship and paint water: no error. That theme draws the back
   wall.
6. Test-play and return: the horizon is the same in play and in the maker.
7. No console errors.

**Docs:**
- `2-architecture.md`, the `src/maker/` bullet: "recreates parallax on
  changes" now includes "and whenever the derived horizon moves (checked on each
  stack revision)".
- `7-current-issues.md`: issue 43 to Resolved.
- `6-progress-tracker.md`: a Part B entry, with what step 0 showed.

**Commit:** `Unit 23 part B: keep the maker's horizon on the water (#43)`

---

### C — Desktop Zoom (issue 24)

**Files:** `src/settings.js`, `src/core/input.js`, `src/core/input.test.js`,
`src/maker/gestures.js`, `src/maker/gestures.test.js`,
`src/maker/maker-scene.js`.

**Tests first.** Write these, and watch them fail (the exports do not exist
yet), before changing the source.

- `src/core/input.test.js`: `describe('hasCommandModifier', …)`. It is true for
  `{ ctrlKey: true }`, `{ metaKey: true }` and `{ altKey: true }` (each with the
  other two `false`), and false when all three are `false`. Shift does not count.
- `src/maker/gestures.test.js`:
  - `describe('neighbourZoom', …)`: `(1, 1)` → 2, `(2, 1)` → 2, `(1, -1)` → 0.5,
    `(0.5, -1)` → 0.5, `(0.5, 1)` → 1.
  - `describe('wheelZoomStep', …)`, with `rearm = 0.2` and `dt = 1 / 60`:
    - **Fresh state.** `{ armed: true, quiet: 0 }`. A negative `wheelY`
      returns `1`, and the next frame's negative `wheelY` returns `0` (the same
      burst).
    - **A positive `wheelY`** on a fresh state returns `-1`.
    - **Re-arming.** After one step, six quiet frames (`wheelY` 0) do not
      re-arm: the next event returns `0`. Thirteen quiet frames do re-arm: the
      next event steps. Use thirteen, not twelve: twelve times `1 / 60` is a
      hair under 0.2 in floating point.
    - **`wheelY` 0** on a fresh state returns `0`.

**1. `src/settings.js`.** After the `AUTOSAVE_*` constants:

```js
// Maker wheel zoom, in seconds: the wheel must be quiet this long before its
// next burst can step the zoom again, so one mouse notch or one trackpad swipe
// (inertia included) is one step.
export const WHEEL_ZOOM_REARM = 0.2;
```

**2. `src/core/input.js`.**
- Add `'zoomIn' | 'zoomOut'` to the `Action` typedef and to `ACTIONS`. Add both
  keys to each of the four per-action objects (`want`, `virtual`, `latched`,
  `keys`), exactly like the existing actions.
- `KEY_TO_DIR`: `Equal: 'zoomIn'`, `NumpadAdd: 'zoomIn'`, `Minus: 'zoomOut'`,
  `NumpadSubtract: 'zoomOut'`.
- `dirFromEvent`'s `e.key` fallback: `'+'` or `'='` → `'zoomIn'`; `'-'` →
  `'zoomOut'`.
- New exported pure helper, with JSDoc:
  ```js
  /**
   * True while Ctrl, Cmd or Alt is held. With one of them, + and − belong to the
   * browser (page zoom), never to the game.
   *
   * @param {{ ctrlKey: boolean, metaKey: boolean, altKey: boolean }} e
   * @returns {boolean}
   */
  export function hasCommandModifier(e) {
    return e.ctrlKey || e.metaKey || e.altKey;
  }
  ```
- In `onKeyDown`, after `const dir = dirFromEvent(e); if (!dir) return;`, add:
  `if ((dir === 'zoomIn' || dir === 'zoomOut') && hasCommandModifier(e)) return;`.
  This comes before `press` and `preventDefault`, so the browser keeps its page
  zoom. `onKeyUp` is unchanged; a release always clears.
- **Wheel.** A module-closure accumulator and an output object:
  ```js
  // Summed deltaY of wheel events aimed at the canvas since the last advance().
  let wheelRaw = 0;
  /** Per-frame wheel: `y` is the summed deltaY (negative = away from the user). */
  const wheel = { y: 0 };
  ```
  A listener:
  ```js
  /**
   * Only a wheel over the canvas is the game's. Over the DOM (the palette strip
   * scrolls sideways) it keeps its default.
   * @param {WheelEvent} e
   */
  function onWheel(e) {
    if (e.target !== canvas || e.deltaY === 0) return;
    wheelRaw += e.deltaY;
    e.preventDefault();
  }
  ```
  Register it with the others:
  `window.addEventListener('wheel', onWheel, { capture: true, passive: false });`.
  `passive: false` is required, or `preventDefault` is ignored and Ctrl + wheel
  (and a trackpad pinch) zooms the page.
  In `advance()`, after the pointer block: `wheel.y = wheelRaw; wheelRaw = 0;`.
  In `onBlur`: `wheelRaw = 0;`. Return `wheel` from `createInput` next to
  `pointer`.

**3. `src/maker/gestures.js`.**
- Export the existing `neighbourZoom`, unchanged apart from `export` and a JSDoc
  `@returns {number}`.
- Add, with JSDoc:
  ```js
  /**
   * One zoom step per wheel burst. The first event of a burst steps; the wheel
   * must then be quiet for `rearm` seconds before it can step again. Mutates
   * `state`, allocates nothing.
   *
   * @param {{ armed: boolean, quiet: number }} state  start as { armed: true, quiet: 0 }
   * @param {number} wheelY  this frame's summed deltaY; negative zooms in
   * @param {number} dt
   * @param {number} rearm  seconds
   * @returns {1 | -1 | 0}  1 zooms in, -1 out
   */
  export function wheelZoomStep(state, wheelY, dt, rearm) {
    if (wheelY === 0) {
      state.quiet += dt;
      if (state.quiet >= rearm) state.armed = true;
      return 0;
    }
    state.quiet = 0;
    if (!state.armed) return 0;
    state.armed = false;
    return wheelY < 0 ? 1 : -1;
  }
  ```

**4. `src/maker/maker-scene.js`.**
- Imports: add `WHEEL_ZOOM_REARM` to the settings import; add `neighbourZoom`
  and `wheelZoomStep` to the `./gestures.js` import.
- Scene state, next to `zoom`:
  `const wheelZoom = { armed: true, quiet: 0 };`
- In `enter`, next to `dragState = null;`: `wheelZoom.armed = true;
  wheelZoom.quiet = 0;`
- Next to `applyZoom`:
  ```js
  /**
   * One step along ZOOM_LEVELS about a virtual screen point. Nothing at the ends.
   * @param {1 | -1} dir
   * @param {number} centerVx
   * @param {number} centerVy
   */
  function zoomBy(dir, centerVx, centerVy) {
    const next = neighbourZoom(zoom, dir);
    if (next !== zoom) applyZoom(next, centerVx, centerVy);
  }
  ```
- In `update`, immediately after the `if (gestures.zoomSnap !== null) { … }`
  block:
  ```js
  // Desktop zoom (issue 24): + and − about the view centre, the wheel about the
  // pointer. Not mid-stroke, like undo. The wheel is always stepped, so its burst
  // state stays true while a stroke is open.
  const wheelStep = wheelZoomStep(wheelZoom, params.input.wheel.y, dt, WHEEL_ZOOM_REARM);
  if (!dragState) {
    const keys = params.input.keys;
    const keyStep = keys.zoomIn.pressed ? 1 : keys.zoomOut.pressed ? -1 : 0;
    if (keyStep !== 0) zoomBy(keyStep, d.viewW / 2, VIEW_H / 2);
    else if (wheelStep !== 0) zoomBy(wheelStep, params.input.pointer.x, params.input.pointer.y);
  }
  ```
  `d` is the `dims()` already computed above it. A stale `d.eW` after a zoom is
  the same one-frame lag the pinch path already has, and is harmless.

The test-play session and the resume point already carry `zoom`. Nothing else
changes.

**Verify in the browser** (desktop Chrome, mouse):
1. Maker. Wheel up (away from you) over the canvas: 2×, and the cell under the
   pointer stays under it. Keep spinning in the same burst: no further step.
   Pause, then wheel down: 1×, then after another pause 0.5×. At 0.5× wheel
   down does nothing, and at 2× wheel up does nothing.
2. A wheel over the palette's tool strip scrolls the strip and does not zoom.
3. `=`, `+` (Shift + `=`), numpad `+`, `-` and numpad `-` step the zoom about the
   view centre.
4. Ctrl + `=` / Ctrl + `-` still zoom the browser page, not the maker. Reset the
   page zoom with Ctrl + `0`.
5. Ctrl + wheel over the canvas zooms the maker, not the page. On a trackpad, a
   pinch and a two-finger swipe each give one step.
6. Rename a level (My Levels → ⋯ → Rename) and type `a-b=c`: the field gets the
   text.
7. Hold the left button to paint and press `+` mid-stroke: no zoom.
8. Zoom to 2×, test-play and come back: still 2×. Back to My Levels and reopen
   the level: still 2× (resume point).
9. In play, the wheel and `+` / `−` do nothing.
10. No console errors.

**Docs:**
- `2-architecture.md`:
  - The `src/core/` input description: add the `zoomIn` / `zoomOut` actions
    (never with Ctrl, Cmd or Alt) and `wheel.y`, the per-frame summed deltaY of
    wheel events aimed at the canvas, which are preventDefaulted.
  - The `src/maker/` bullet: zoom is reached by pinch, by the wheel (one step
    per burst, about the pointer) and by `+` / `−` (about the centre).
- `4-code-standards.md`:
  - Constants: add `WHEEL_ZOOM_REARM` next to the `AUTOSAVE_*` timings.
  - Input: note that a `wheel` listener in `input.js` is the one non-pointer
    mouse input. There is no pointer-event equivalent.
- `1-project-overview.md`, Maker mode: "Pan and zoom at 0.5×, 1× and 2×" says
  how: pinch on touch, the mouse wheel or `+` / `−` on desktop.
- `7-current-issues.md`: issue 24 to Resolved.
- `6-progress-tracker.md`: a Part C entry.

**Commit:** `Unit 23 part C: zoom the maker with the wheel and + / - (#24)`

---

### D — Touch Control Layout (issue 4)

**Files:** `src/ui/touch-controls.js`, `src/ui/styles/touch-controls.css`.

This is layout only. `input.bindVirtualButton` and every action stay exactly as
they are. Moving the ▼ button into the other cluster is a DOM move inside
`ui/`, not an input change.

**1. `src/ui/touch-controls.js`.** Two clusters:

```js
const pad = el('div', { class: 'touch__pad' }, [
  btn('touch-btn--left', 2, 'left', 'Left'),
  btn('touch-btn--right', 3, 'right', 'Right'),
]);
const actions = el('div', { class: 'touch__actions' }, [
  btn('touch-btn--down', 0, 'down', 'Drop through'),
  btn('touch-btn--jump', 1, 'jump', 'Jump'),
]);

const container = el('div', { class: 'touch' }, [pad, actions]);
```

**2. `src/ui/styles/touch-controls.css`.**
- Replace the `.touch__pad` grid and the `.touch__jump` rule with:
  ```css
  .touch__pad,
  .touch__actions {
    position: absolute;
    bottom: calc(env(safe-area-inset-bottom) + 12px * var(--ui-scale));
    display: flex;
    align-items: flex-end;
    gap: calc(16px * var(--ui-scale));
  }

  .touch__pad { left: calc(env(safe-area-inset-left) + 12px * var(--ui-scale)); }
  .touch__actions { right: calc(env(safe-area-inset-right) + 12px * var(--ui-scale)); }
  ```
- Delete `.touch-btn--left`, `.touch-btn--right` and `.touch-btn--down` (their
  only job was grid placement).
- After the `.touch-btn` rule, so it wins at equal specificity:
  ```css
  /* The primary action, under the right thumb in the corner. */
  .touch-btn--jump {
    width: calc(80px * var(--ui-scale));
    height: calc(80px * var(--ui-scale));
  }
  ```
  The glyph stays 56 px, centred.
- Update the header comment: ◀ ▶ bottom-left; ▼ and a larger Jump
  bottom-right, Jump in the corner.

**Verify in the browser** (Chrome device emulation with touch, landscape):
1. At 844 × 390 and 667 × 375 (`--ui-scale` 1): ◀ ▶ sit side by side on the
   bottom-left with a 16 px gap; ▼ (64) and Jump (80) on the bottom-right, all
   bottom-aligned, Jump in the corner. Nothing overlaps the hearts, the coin
   counter or the pause button. Measure the boxes with DevTools.
2. At 1280 × 720 (`--ui-scale` 2) with Settings → Touch: On, the layout is the
   same at double size.
3. Each button still works: ◀ ▶ move, Jump jumps, ▼ drops through a platform
   (the first campaign level has platforms).
4. Settings → Touch: Off hides both clusters, and Auto shows them after a touch.
5. A notched phone profile (an iPhone in landscape) keeps the clusters inside
   the safe area.
6. No console errors.

Holding ▶ while tapping Jump needs real multi-touch, which emulation cannot do.
Note it for the player's phone check.

**Docs:**
- `3-ui-context.md`, Layout Patterns, **Touch controls**: replace "a directional
  cluster bottom-left and a jump button bottom-right, both at least 64px at
  `--ui-scale: 1`" with the split layout: ◀ ▶ bottom-left; ▼ and Jump
  bottom-right, Jump in the corner; 64 px buttons, an 80 px Jump, 16 px apart,
  bottom-aligned, all × `--ui-scale`.
- `1-project-overview.md`, Input and platform, the Touch bullet: left and right
  under the left thumb; jump and drop-through under the right.
- `7-current-issues.md`: issue 4 to Resolved.
- `6-progress-tracker.md`: a Part D entry.

**Commit:** `Unit 23 part D: split the touch controls between the thumbs (#4)`

---

## Planned File Scope

| Part | Source | Tests | Docs |
| --- | --- | --- | --- |
| A | `game/world.js` | `game/world.test.js` | architecture, overview, issues, tracker |
| B | `maker/maker-scene.js` | none (scene) | architecture, issues, tracker |
| C | `settings.js`, `core/input.js`, `maker/gestures.js`, `maker/maker-scene.js` | `core/input.test.js`, `maker/gestures.test.js` | architecture, code standards, overview, issues, tracker |
| D | `ui/touch-controls.js`, `ui/styles/touch-controls.css` | none (DOM) | UI context, overview, issues, tracker |

Any file outside this table is out of scope. If one seems to need a change, stop
and ask.

## Acceptance

- Issues 31, 43, 24 and 4 are in Resolved, each with its commit.
- `npm test` passes: 399 plus the new tests. Report the real count after each
  part. `npm run build` passes.
- Every browser check above is done, or listed as not done with the reason.
- No console errors or warnings on the screens touched.
- Four local commits, A to D, and no remote.
- The tracker records the unit as built and awaiting the player's sign-off. Do
  not mark it complete: the player signs off, and Claude reviews first.

## As Built

Complete 2026-10-11, signed off by the player after Claude's review (see the
status above). Four local commits, no remote. `npm test` is 408 tests in 34 files after Part C;
Part D added none. `npm run build` passed after each part.

### Part A — issue 31

Commit `091dee6`, message `Unit 23 part A: hold the player at a level's side edges (#31)`. 401 tests in 34 files (two new). The hitbox is clamped to the level's left and right edges after it moves. The edges are not terrain, so there is no wall slide or wall jump, and the bottom stays open. In Chrome, on a 40-column floor, the captain stops at both edges and jumps in place at the left edge. Castaway Beach still plays. A fresh page logs "The AudioContext was not allowed to start" because the scripted click is not a user gesture. That is the driver, not the game.

### Part B — issue 43

Commit `0e75598`, message `Unit 23 part B: keep the maker's horizon on the water (#43)`. 401 tests, unchanged. No new tests: the maker scene is verified by running it. Step 0, before the change, reproduced the bug: a water row halfway up left the sea at the bottom of the level, and test-play then M was the first time the sea and the cloud bank jumped onto the water. After `syncHorizon`, the sea, cloud bank and reflections follow the top water row on release. Undo, Redo, a higher row and erasing that row move the horizon with it. A stroke waits for mouse-up, because the stack revision changes in `finalizeDrag`. Pirate Ship still draws its back wall. Test-play of that island level is entirely sea because the camera sits below the water line, and returning keeps the same horizon.

### Part C — issue 24

Commit `e5e28bb`, message `Unit 23 part C: zoom the maker with the wheel and + / - (#24)`. 408 tests in 34 files (seven new: `hasCommandModifier`, `neighbourZoom`, `wheelZoomStep`). The seven failed before the source existed. In Chrome, on a fresh profile:

- One wheel step per burst, about the pointer. The water sprite's blue sits above the click; that offset doubled when the zoom went 1× → 2× (width 60 → 126). Further wheels in the burst stayed, and a wheel up at 2× after a pause stayed. After pauses the wheel stepped 2× → 1× → 0.5×, and a further wheel down at 0.5× stayed. At 0.5× the camera clamps, so the next step has to be aimed at the cell's new centre.
- `=`, Shift + `=`, numpad `+`, `-` and numpad `-` step about the view centre. `=` moved the cell 65px and doubled it; `-` restored it.
- An empty eraser stroke ignored `=`. After release, `=` doubled the cell (width 62 → 122).
- That 2× survived test-play and Back → Edit. The rename field, focused, received `a-b=c`.
- In play, the wheel and `+` / `−` left the page scale at 1. They have no zoom to change there.
- Ctrl + `=` left the maker zoom unchanged. The DevTools protocol cannot fire Chrome's browser page-zoom shortcut, so the page zoom itself was not shown. Ctrl + wheel doubled the maker zoom and left the page scale at 1.
- At desktop width the tool strip does not overflow, so a vertical wheel has nothing to scroll. With the strip forced narrower, a wheel over a palette button was not `preventDefault`ed, and a horizontal wheel scrolled it (0 → 240) without zooming.
- A trackpad pinch and a two-finger swipe were not tried. There is no trackpad on this check.

### Part D — issue 4

Commit message `Unit 23 part D: split the touch controls between the thumbs (#4)`. 408 tests, unchanged. In Chrome, landscape, touch revealed the controls:

- 844×390 and 667×375, `--ui-scale` 1. ◀ and ▶ are 64×64 with a 16px gap, 12px from the left and the bottom. ▼ is 64×64 and Jump is 80×80, 16px apart, bottoms aligned with the left pair, Jump's right edge 12px from the screen edge. Glyphs are 56×56 and centred. Nothing overlaps the hearts, the coin counter or the pause button.
- 1280×720, Settings → Touch: On, `--ui-scale` 2. The same layout at double size (128 / 160, gap 32, inset 24).
- Touch: Off hides both clusters. On a fresh load, Auto hides them; a touch shows them, and Auto keeps them once a touch has been seen.
- Safe-area insets of 47 left, 47 right and 21 bottom (Chrome's `Emulation.setSafeAreaInsetsOverride`, iPhone landscape) move the clusters in: left edge 59, Jump's right edge 785, bottoms 357, on an 844×390 screen.
- On Castaway Beach, ▶ moved the captain right (canvas x 111 → 156), ◀ brought him back, and Jump lifted him (canvas y 222 → 181).
- ▼ was checked on a maker level, not by walking Castaway Beach. That level's first platform is about 40 tiles and two jumps from the spawn. The maker level puts a platform under a spawn raised one cell, with ground two cells below. After he landed, ▼ dropped him 64 world pixels (canvas y 380 → 508) onto that ground. The button is the same control.
- Holding ▶ while tapping Jump was not tried. Emulation cannot press two controls at once. That stays for the player's phone check.

Two declarations were added beyond the spec's CSS. A 64px border-box button keeps the browser's default padding, and the glyph is a flex item, so the 56px icon was squeezed to 48×56. `padding: 0` on `.touch-btn` and `flex-shrink: 0` on `.touch-btn__glyph` let it stay 56×56 and centred, which is what the spec asks. Jump was already 80px, so its glyph was 56px either way.
