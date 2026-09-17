# Unit 09 — HUD and Touch Controls

## What This Unit Builds

The first DOM UI in the project. A play-mode HUD (a hearts row, a coin counter, a
level-name flash, a pause button), the on-screen touch controls (a left/right/down
cluster and a jump button), control-scheme detection that reveals the touch controls
only once a touch pointer is seen, a pause that freezes and resumes the run, and a
results panel on level completion. `src/core/input.js` grows a small virtual-input
API so the on-screen buttons feed the same `keys` the player already reads — no new
input path in game code.

**Depends on:** Unit 08 (Stats, World, play scene, collectibles/spikes).

This unit is pure runtime + DOM. It does **not** touch the asset pipeline, the level
schema, the codec, physics, or the entity registry.

## Decisions (resolved while scoping; see "Context Updates")

1. **The hearts row is cropped from the life-bar asset, not a per-heart sprite.**
   `ui/hearts` (`Life Bars/Big Bars`, 4×32×32) is a segmented life *bar*, not a set
   of per-heart frames: frame 0 is a red-heart medallion with a rail stub, frame 1 a
   skull medallion, frames 2–3 are rail. The heart medallion's opaque region is
   **x0–14, y7–23** (measured). The HUD shows one cropped heart medallion per point
   of `stats.health`, so the row grows and shrinks with health (no maximum, per the
   Stats model). `3-ui-context.md`'s Life-bar section is corrected to match.

2. **DOM chrome is flat token styling this unit; nine-slice is still Unit 15.**
   Issue #1 in `7-current-issues.md` (the board/button PNGs are the kit *guide*
   composites, not clean nine-slices) first bites here, because this is the first
   `border-image` candidate. Per that issue's assignment, the nine-slice fix stays in
   Unit 15. The results panel, the paused overlay and the buttons use flat fills from
   the colour tokens with a `calc(2px * var(--ui-scale))` `--ink` border and no
   border-radius. Sprite-backed chrome (hearts, coin, control glyphs) uses the real,
   clean strips.

3. **The pause button freezes and resumes; the pause *menu* is Unit 19.** Tapping
   pause halts `world.update` and shows a minimal overlay with a Resume button.
   Settings, quit-to-select and the full menu are Unit 19. **Added during
   implementation (player request):** the **Enter** key toggles pause/resume, and
   on the results screen Enter triggers Play again. Enter is an edge-triggered
   `pause` action in `core/input.js` (keyboard still flows only through the input
   module) and is `preventDefault`ed so a focused overlay button never double-fires
   with the app-level handling.

4. **The results panel shows on completion only.** Death (pit, water, health 0)
   keeps the existing immediate restart from Units 07–08, because level select is
   Unit 18. The completion panel's button restarts the same level for now.

5. **The coin counter shows live `stats.coins`.** A non-wrapping "total collected"
   score is not tracked (no scoring/leaderboards in scope); the counter and the
   results panel both read `stats.coins`, which is coins toward the next extra life.

6. **HUD DOM is reconciled in the render phase, never in `update`.** Invariant 3
   forbids `update()` touching the DOM; it permits `render()` to read game state and
   drive the DOM as long as it does not mutate game state. The scene calls the HUD
   controller's diff-based `sync(stats)` from its render step. **`update()` only
   flips state** — `paused`/`finished`, and coins/health via `stats`. The paused and
   results overlays are opened/closed in the render reconcile from that state, and a
   restart (death or Play again) is *requested* from `update` via a flag and executed
   by the App loop after `scene.update` returns — the restart mounts/unmounts DOM, so
   it must not run inside `update`. All `document` access lives in `src/ui/` (game
   code never touches the DOM).

   Two bugs were found and fixed while verifying this unit, both recorded in
   `6-progress-tracker.md`: (a) `input.js` captured the pointer to the canvas on every
   `pointerdown`, swallowing clicks on DOM buttons — fixed by engaging the world
   pointer only when `e.target === canvas`; (b) `showResults` and the death/replay
   restart were originally triggered from `update()` — moved to the render reconcile
   and the deferred App-loop restart as described above.

7. **UI factories are injected into the scene, not imported by it.** Dependencies
   point inward (`ui → game → level → core`), so `game/play-scene.js` must not import
   from `ui/`. The App (`main.js`, the composition root) imports `createPlayHud` /
   `createTouchControls` and passes them to the scene as
   `params.ui = { createHud, createTouch }`; the scene calls them in `mountUI` with
   its own pause/resume/replay callbacks. (Corrected from the first draft of this
   spec, which had the scene importing `ui/` — that would reverse the dependency.)

## Deliverables

### `src/core/input.js` — virtual buttons, button binding, touch detection

Extend the existing module. Do not change the keyboard or window-pointer behaviour.

- Add a `virtual` record parallel to `want`:
  `{ left:false, right:false, up:false, down:false, jump:false }`.
- In `advance()`, the merged desired state for each action is `want[dir] ||
  virtual[dir]` (keyboard OR on-screen). Everything downstream (`pressed`,
  `released`, `held`) is unchanged.
- `setVirtual(action, isDown)` — set `virtual[action]`; ignore unknown actions.
- `bindVirtualButton(el, action)` — attach the pointer listeners **inside the input
  module** (invariant 8: no input wiring in `ui/`, `game/` or scene code) and return
  an unbind function:
  - `pointerdown`: `setVirtual(action, true)`, record the `pointerId`, call
    `el.setPointerCapture(id)` in a try/catch, `e.preventDefault()`.
  - `pointerup` / `pointercancel` / `lostpointercapture`: if it is the tracked
    pointer, `setVirtual(action, false)` and clear the id.
  - Each bound element tracks its **own** `pointerId` so a finger on jump and a
    finger on the D-pad work at once (multi-touch). Do not funnel these through the
    single window drag-pointer.
- Touch detection: in the existing `onPointerDown`, when `e.pointerType === 'touch'`
  and touch has not yet been seen, set an internal `hasTouch = true` and invoke any
  registered callbacks once. Expose `get hasTouch()` and `onTouchDetected(cb)` (fires
  immediately if touch was already seen, otherwise on first touch).
- The window-level drag pointer (`pointerWantId` etc.) is unchanged. In play mode it
  is unused by gameplay, so a touch that also lands on a control is harmless; do not
  add target filtering here (that is a maker concern, Unit 13+).

No change to `KEY_TO_DIR`, `dirFromEvent`, or the `keys`/`pointer` shapes returned.

### `src/ui/dom.js` — DOM factory helpers

Small, dependency-free helpers so no module builds DOM with interpolated
`innerHTML` (code standards). At minimum:

- `el(tag, opts?, children?)` where `opts` may carry `class`, `text` (set via
  `textContent`), `attrs`, `style`, and event handlers passed as `on: { click, ... }`.
- `clear(node)` — remove all children.

`el` sets text with `textContent`, never `innerHTML`. No template-string HTML with
user data anywhere in this unit.

### `src/ui/hud.js` — the play HUD controller

`export function createPlayHud(root, opts)` builds the HUD into `root` (the `#ui`
element) and returns a controller. `opts`: `{ levelName, onPause, onResume,
onReplay }`. All elements re-enable `pointer-events` on themselves (the `#ui` layer
is `pointer-events: none`). Every interactive element is at least 44×44 CSS px and
has a `:focus-visible` style. Edge-anchored elements pad with `env(safe-area-inset-*)`.

Structure and anchoring (per `3-ui-context.md` "Play HUD"):

- **Hearts** — top-left. One heart element per point of `stats.health`. Each heart
  is the cropped medallion from `/assets/ui/hearts.png`: source rect x0 y6 w16 h18,
  shown via `background-image` + `background-size` + `background-position`, rendered
  pixel-doubled (2× art) and scaled by `--ui-scale`, `image-rendering: pixelated`.
  `syncHearts(n)` adds/removes elements only when `n` changes (diff against a cached
  count) — no per-frame rebuild.
- **Coin counter** — top-right. A static gold-coin glyph (first frame of
  `/assets/sprites/coin-gold.png`, source rect x0 y0 w16 h16, same pixel-doubled
  scaling) followed by the count text in `--font-ui`. `syncCoins(n)` updates the
  `textContent` only when `n` changes.
- **Level name** — top-centre, shown on mount, then fades out. Implement as a CSS
  animation (visible ~2 s, then a ~500 ms opacity fade) so no JS timer runs in the
  loop. Under `@media (prefers-reduced-motion: reduce)` it appears then disappears
  with no transition.
- **Pause button** — top-right, below the coin counter. A flat stone button
  (`--stone` fill, `--ink` border) whose glyph is two vertical `--ink` bars drawn in
  CSS (the mobile-icon sheet has no pause glyph; a CSS glyph avoids inventing a
  sprite). Calls `opts.onPause`.

Controller API:

```
{
  syncHearts(n), syncCoins(n),          // diff-based, called each frame
  setPaused(isPaused),                  // show/hide the paused overlay
  showResults({ coins, timeMs }),       // show the completion panel
  destroy(),                            // remove all HUD DOM and listeners
}
```

- **Paused overlay** (`setPaused(true)`) — a centred flat `.panel--board`-styled box
  over a `--scrim` backdrop, titled "Paused", with a single **Resume** primary
  button calling `opts.onResume`. `setPaused(false)` hides it. Focus moves to Resume
  when shown; Escape and a backdrop tap also resume.
- **Results panel** (`showResults`) — a centred flat panel over `--scrim`, titled
  "Level Complete", showing coins collected and the run time formatted `m:ss.cs`
  (from `timeMs`), and a primary **Play again** button calling `opts.onReplay`.
  Focus moves to Play again when shown.

`hud.js` is the only place that reads these DOM APIs; it does not import from
`game/`. It receives plain numbers and callbacks.

### `src/ui/touch-controls.js` — on-screen controls

`export function createTouchControls(root, input)` builds the controls into `root`
and binds each button through `input.bindVirtualButton(el, action)`. Returns
`{ show(), hide(), destroy() }`, starting **hidden**.

- **Directional cluster** — bottom-left: **left** (`ui/icons` frame 2), **right**
  (frame 3), **down** (frame 0, for drop-through). Bound to actions `left`, `right`,
  `down`.
- **Jump button** — bottom-right: an up-arrow glyph (`ui/icons` frame 1, cosmetic)
  bound to the `jump` action.
- Each button is a flat stone button at least **64×64 CSS px at `--ui-scale: 1`**
  (per `3-ui-context.md`), scaling with `--ui-scale`, with the icon glyph cropped
  from `/assets/ui/icons.png` (28×28 frames), pixel-doubled, `image-rendering:
  pixelated`.
- CSS per control: `touch-action: none`, `user-select: none`,
  `-webkit-user-select: none`, `-webkit-touch-callout: none`, `pointer-events: auto`.
  These, plus `bindVirtualButton` treating `pointercancel`/`lostpointercapture` as a
  release, satisfy Watchlist #1 (iOS touch).
- No `up` control: jump is dedicated, so the touch player never needs `up`.

`touch-controls.js` calls only `input.bindVirtualButton` — it never adds its own
listeners (all input wiring lives in `core/input.js`).

### `src/ui/styles/` — component CSS

One file per component, imported by its module (code standards): `hud.css`,
`touch-controls.css`, and `dialog.css` (shared panel/overlay/button styling for the
paused and results panels). Rules:

- Every dimension is `calc(<base> * var(--ui-scale))`. No hardcoded hex (use the
  tokens from `3-ui-context.md`), no `border-radius`, no magic pixel sizes.
- Buttons: rest / `:hover` (translate −1px Y) / `:active` (translate +1px) /
  `:disabled` (60% opacity, no pointer events) / `:focus-visible` (2px
  `--paper-light` outline offset 2px). Minimum 44×44.
- DOM motion limited to 120 ms ease-out opacity/translate; overlays fade in.
  `@media (prefers-reduced-motion: reduce)` drops transitions to 0 ms.
- Nine-slice `border-image` is intentionally **not** used yet (Decision 2 / Issue #1).

### `src/game/play-scene.js` — mount, pause, timer, HUD sync

`PlaySceneParams` gains `uiRoot: HTMLElement`, `onReplay: () => void`. Keep
`onDeath`/`onComplete`.

- **`mountUI(root)`** (called by the App after `enter`): create the HUD via the
  **injected** `params.ui.createHud(root, { levelName, onPause, onResume, onReplay })`
  and the touch controls via `params.ui.createTouch(root, input)` (see Decision 7 —
  the factories are injected so `game/` never imports `ui/`). Register
  `input.onTouchDetected(() => touch.show())` so the controls appear the first time a
  touch pointer is seen (already-touch devices reveal immediately); keep its
  unsubscribe and call it in `unmountUI` so callbacks do not accumulate across
  restarts. Store both controllers. The scene does not touch `document` — it only
  calls these injected factories.
- **`unmountUI()`**: `hud.destroy()` and `touch.destroy()`; clear the references.
- **Pause**: an internal `paused` flag. `onPause` sets it and calls
  `hud.setPaused(true)`; `onResume` clears it and calls `hud.setPaused(false)`.
  While `paused`, `update(dt)` still calls `input.advance()` but **skips**
  `world.update`, the camera follow, and the death/complete checks — the simulation
  is frozen. (The fixed-timestep loop and its 5-step cap already absorb the long
  delta on resume; do not special-case it.)
- **Run timer**: accumulate `elapsedMs += dt * 1000` only while status is `'playing'`
  and not paused. Reset in `enter`. Pass it to `hud.showResults` on completion.
- **Completion**: on `status === 'complete'`, show the results panel
  (`hud.showResults({ coins: world.stats.coins, timeMs: elapsedMs })`) and set an
  internal `finished` flag that freezes the sim like pause (so the world stops behind
  the panel). Do **not** call `onComplete` immediately; the panel's **Play again**
  (wired to `onReplay`) drives the restart. Death still calls `onDeath` as before.
- **HUD sync**: at the end of `render(ctx, cam)` (after `world.draw`), call
  `hud.syncHearts(world.stats.health)` and `hud.syncCoins(world.stats.coins)`. This
  reads game state and drives DOM without mutating game state (Decision 6). Nothing
  DOM-related runs in `update`.

### `src/main.js` — wire the UI factories, root and replay

- Grab `#ui` (`document.getElementById('ui')`) once.
- Import `createPlayHud` and `createTouchControls` from `ui/` (the App is the
  composition root and may import both `game/` and `ui/`) and pass them to the scene
  as `ui: { createHud, createTouch }` (Decision 7), plus `onReplay() { restart(); }`.
  After `scene.enter(...)` call `scene.mountUI(uiRoot)`.
- In `restart`, call `scene.unmountUI()` before `scene.exit()` so HUD DOM and its
  listeners are removed before the next level mounts.
- `onComplete` is removed from the params (completion is handled by the results panel
  + `onReplay`); `onDeath` still restarts.

## Context Updates (apply in this unit's implementation change)

- **`3-ui-context.md`** — rewrite the "Life bar" subsection: the hearts row is a
  per-`stats.health` row of the heart medallion cropped from `ui/hearts`
  (source rect x0 y6 w16 h18), not "one frame per heart, swapping on damage". Note
  the coin counter (cropped `coin/gold` frame 0), the CSS pause glyph, and the touch
  control glyph indices (left 2, right 3, down 0, jump/up 1).
- **`7-current-issues.md`** — Issue #1: note that Unit 09 is the first DOM UI and
  deliberately ships flat token-styled panels/buttons; the nine-slice `border-image`
  work remains assigned to Unit 15.
- **`2-architecture.md`** — extend the input description to mention the virtual-button
  API (`setVirtual`, `bindVirtualButton`, `hasTouch`/`onTouchDetected`). This is a
  module-API note, not an invariant change.
- **`6-progress-tracker.md`** — mark Unit 09 complete with decisions.

## Not Built

- The pause **menu** (settings, quit-to-select), settings screen (Unit 19).
- Level select / return-to-select on death or after results (Unit 18).
- Nine-slice `border-image` chrome (Unit 15 / Issue #1).
- Persisted settings, control-scheme override setting, volume sliders (Unit 17).
- Audio, including UI sfx (Unit 12).
- Walker enemies, shooters (Units 10–11).
- Any change to the asset pipeline, `atlas.json`, the level schema, `codec.js`,
  `schema.js`, `physics.js`, `world.js`, `stats.js`, the entity registry, or `core/`
  beyond the additive `input.js` API above.
- A non-wrapping total-score accumulator (out of scope; see Decision 5).
- Gamepad support.

## Verification Checklist

- [x] `npm run build` passes; `npm test` still green (95). No pure module added;
      `getDiagnostics` clean on all changed files.
- [x] Keyboard-only: fixture completed start to finish; hearts and coin counter track
      `stats.health` / `stats.coins` through pickups and spike hits; results panel
      shows coins and a running time; Play again restarts. (Player sign-off.)
- [x] Touch-only (emulation on): controls stay hidden until the first touch, then
      appear; left/right/down and jump work; multi-touch (direction + jump) works.
- [x] Pause freezes the sim and Resume continues where it left off; Escape and
      backdrop tap resume. **Enter** toggles pause/resume; Enter on the results panel
      triggers Play again. (Player sign-off.)
- [x] Every interactive element ≥ 44×44 CSS px; touch buttons ≥ 64×64 at
      `--ui-scale: 1`; `:focus-visible` on each.
- [~] Desktop viewport verified. Phone width: controls function correctly but the
      layout looks off — deferred to the responsive pass as **Issue #4** (player's
      call), not a blocker for this unit.
- [x] Level name flashes then fades; `prefers-reduced-motion` makes it stepped, not
      eased.
- [x] No console errors during a normal (visible-tab) run. No sound (Unit 12).
- [x] `3-ui-context.md`, `7-current-issues.md`, `2-architecture.md` and
      `6-progress-tracker.md` updated in the same change.
