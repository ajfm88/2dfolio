# Unit 02: Engine Core

## Goal

Extract the Unit 00 loop and viewport into `src/core/`, then add camera, input,
atlas loading, sprite playback and rect helpers. The game canvas draws an
animated unarmed Captain idle that moves with arrow/WASD keys and a pointer
drag; the camera follows and clamps. Animation speed is identical at 60 Hz and
120 Hz. `npm run build` passes.

This unit does **not** port player physics, tiles, HUD, audio, or the scene
graph.

## Design

Sky-coloured canvas as before, plus one looping idle sprite. A 1 px world-bounds
rectangle makes camera clamp visible. No DOM HUD. `/atlas.html` stays.

`core/` imports nothing from the project except `settings.js`. `main.js` imports
`src/data/atlas.json` and passes it into `loadAtlas`.

## Implementation

### `core/loop.js`

Unit 00 accumulator: rAF delta in seconds, clamped to 200 ms; `update(FIXED_DT)`
while `acc >= FIXED_DT` and steps `< 5`; leftover discarded after the cap.
`createLoop({ update, render })` → `{ start, stop }`. One `render()` per frame.

### `core/viewport.js`

Virtual height `VIEW_H`. Width `clamp(round(VIEW_H * aspect), VIEW_W_MIN,
VIEW_W_MAX)`. `pixelScale` capped at 2. Backing store `viewW * pixelScale` ×
`VIEW_H * pixelScale`. Re-assert `imageSmoothingEnabled = false` after every
resize. `apply(ctx)` sets the scale transform once per frame. `toVirtual(clientX,
clientY)` writes a module scratch point. `onResize` callback; `main.js` sets
`--ui-scale` there. Viewport does not set CSS variables.

### `core/camera.js`

World-space top-left. Follow target, then clamp. If the world is smaller than
the view, centre (offset may be negative). `Math.round` camera x/y before use.

### `core/input.js`

Pointer Events on the canvas; keyboard on `window`. `pointercancel` is a
release. `advance()` once per fixed update: `held` / `pressed` / `released` for
`left`, `right`, `up`, `down` (arrows and WASD). Pointer: `down`, `pressed`,
`released`, virtual `x/y`. Does not import camera.

### `core/atlas.js`

`loadAtlas(manifest)` loads every clip from `/assets/<src>`. `atlas.get(id)`
returns `{ image, fw, fh, n, fps }`. Missing id throws. No import from `data/`.

### `core/sprite.js`

`createSprite(clip)`. `update(dt)` does `frameIndex += fps * dt`. `draw` uses
`Math.floor(frameIndex % n)`, source x `frame * fw`, dest `Math.round`. Flip
with negative `drawImage` width. `draw` does not mutate `frameIndex`.

### `core/rect.js`

Plain `{ x, y, w, h }`. `set`, `copy`, `intersects`. No `Rect` class.

### `src/main.js`

Boot: viewport, input, camera, `await loadAtlas`, loop. Sky paints immediately;
sprite appears when the atlas is ready. Demo world 80 × 24 tiles. Captain uses
`player/idle`. Keys move at 100 px/s (demo-only). Pointer down follows world
position with a grab offset. Camera follows sprite centre. Remove `ticks/s`
logging.

## Dependencies

None.

## Verify when done

- [ ] `/` shows sky + animated idle Captain (5 frames).
- [ ] Arrows and WASD move him; sprite flips when moving left.
- [ ] Pointer drag moves him; camera follows.
- [ ] Walking to a world edge clamps the camera; bounds rect stays visible.
- [ ] Animation and move speed match at 60 Hz and 120 Hz.
- [ ] Returning to a backgrounded tab does not spiral the simulation.
- [ ] Resize fills the viewport with no letterbox and no errors.
- [ ] `/atlas.html` still works.
- [ ] `core/` imports only `settings.js` from the project.
- [ ] `npm run build` passes; no console errors on `/`.
