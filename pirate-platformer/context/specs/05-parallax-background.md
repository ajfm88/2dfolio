# Unit 05: Parallax Background

## Goal

The background half of `level/render.js`: sky fill, sea and horizon bands, the
`BG Image` parallax layer, a tiled scrolling Big Clouds band, drifting small
clouds on a repeating timer, and animated water reflections. Layers scroll at
distinct rates with no seams or popping at either end of a level. The horizon
sits correctly at every camera position.

The Captain demo stays a throwaway walk-around. No physics, no App/scene
framework, no schema change, no second theme, no `water/top` animation.

## Design

Neither Python reference draws Treasure Hunters’ `BG Image` or water-reflect
strips. Super Pirate World (`groups.py`) fills sky/sea, draws a horizon line,
tiles a large cloud on the horizon, and spawns small clouds. Pirate Maker
(`28_finish/editor.py`) adds the three horizon bands. Port those ideas onto the
clips Unit 01 packed, at native 32 px (half SPW’s 64 px numbers).

Draw order: sky/sea/horizon/BG Image (`Z.bg`) → big and small clouds
(`Z.clouds`) → existing tiles → reflections (`Z.fx`) → Captain (demo).

Invariant 3: cloud positions and animation clocks advance in `update`, never in
`draw`. Invariant 11: this lives in `level/`, not `core/`.

Horizon is **derived**, not stored. Format 1 has no `horizon` field; do not add
one. `horizonY(level)` is `TILE * r` of the topmost row that contains any water
cell. Empty water layer → `level.rows * TILE`. A mid-level pool still sets one
global horizon. Per-column horizon and Pirate Maker’s sky handle are out of
scope.

World colours and motion rates live on `islandTheme` so Unit 20 can swap them.
No `tuning.js`, no new `settings.js` keys, no `core/rng.js`. Canvas cannot read
CSS custom properties; hexes match the tokens in `3-ui-context.md`.

Fixed pools. No allocation in the per-frame path. Positive modulo wrap so a
negative camera offset (level smaller than the view) does not pop.

## Implementation

### `data/themes.js`

Extend `islandTheme` with:

- `sky` `#ddc6a1`, `sea` `#92a9ce`, `horizon` `#f5f1de`, `horizonBand` `#d1aa9d`
- Horizon bands, Pirate Maker `10/16/20` + line `3` halved: offsets/heights
  `[5,5]`, `[8,2]`, `[10,1]`, `horizonLine` `2`
- Parallax: `bgParallax` `0.25`, `bigCloudParallax` `0.5`,
  `smallCloudParallax` `0.85`
- Speeds (SPW halved): `bigCloudSpeed` `25`, `smallCloudSpeedMin` `25`,
  `smallCloudSpeedMax` `60`, `cloudTimer` `2.5`
- Clip ids: `bgImage` `bg/image`, `bigClouds` `bg/clouds-big`,
  `smallClouds` `['bg/cloud-1','bg/cloud-2','bg/cloud-3']`,
  `reflects` `['fx/reflect-big','fx/reflect-mid','fx/reflect-small']`

`getTheme` still falls back to island.

### `level/parallax.js`

`horizonY(level)`, `wrap(x, w)`.

`createParallax(level, theme, atlas)`:

- Seed a tiny LCG from `level.id` (not `Math.random` in the loop).
- 20 small clouds: clip, x, height-above-horizon, speed. Torus width
  `max(worldW, 768) + 2 * widest small cloud`.
- 6 reflections (2 of each clip) along the horizon, 10 FPS via `createSprite`.
- `bigCloudX` drift scalar.
- `update(dt, camX, viewW)` advances drift, cloud x, wrap, sprite clocks. Every
  `cloudTimer` seconds recycle the leftmost small cloud to the right of the
  view. `draw` never mutates.

### `level/render.js`

`drawBackground` then existing `drawTiles` then reflections, composed as
`drawLevel`. Destinations `Math.round`. Tile BG Image (384) and Big Clouds
(448) with `wrap(offset, width) - width` as the first dest, then step by width
until past `viewW`. Sea fill ports Pirate Maker `display_sky`: no sea if
horizon is below the view; full sea if above; otherwise fill from `hy` down.
No extra `save`/`restore`.

### `main.js`

Create parallax once. `parallax.update(dt, camera.x, viewport.viewW)` in
`update`. Replace the solid-sky `fillRect` with `drawLevel`. Do not grow into
an App.

### Tests

`parallax.test.js`: `horizonY` (row 11, mid-grid, empty → `rows * TILE`, row 0)
and `wrap` (`0`, positive, negative, `x === w`). Rendering is not unit-tested.

## Dependencies

Units 02 and 04.

## Out of scope

`bg/sky-tile`, `water/top`, palms, BG tiles, ship theme, physics, palette,
schema/codec/autotile changes, inner corners (issue 2 stays open).

## Verify when done

- [x] Sky above the water line, sea below; horizon sits on the water row at
      every camera Y
- [x] `BG Image` sits on the horizon and lags the camera
- [x] Big cloud band tiles without a seam, drifts, lags tiles
- [x] Small clouds drift and wrap instead of popping at either end
- [x] Water reflects animate at 10 FPS on the sea near the horizon
- [x] Unit 04 autotile fixture still looks correct
- [x] Captain idle still walks; no gravity
- [x] `/atlas.html` unchanged
- [x] `npm test` and `npm run build` pass; no console errors
- [x] Player sign-off 2026-09-07: `/` looks right
