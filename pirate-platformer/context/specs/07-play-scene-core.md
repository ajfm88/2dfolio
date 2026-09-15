# Unit 07 — Play Scene Core

## What This Unit Builds

The first real play session: a scene system, a World that spawns entities from a
LevelModel, a flag goal, two death conditions (pit and water), and restart. This
replaces the throwaway `main.js` demo with the architecture described in
`2-architecture.md`.

**Depends on:** Unit 06 (player physics).

## Deliverables

### `src/data/palette.js` — Entity registry

The single source of truth for everything placeable. Unit 07 registers only the
entries the play scene needs. Shape per entry:

```js
{
  id: string,            // stable string written into level files
  group: string,         // maker palette tab
  label: string,
  icon: string,          // atlas clip for the palette button and preview
  placement: string,     // 'tile' | 'entity' | 'decor' | 'marker'
  layer: string | null,  // tile layer name when placement is 'tile'
  z: number,
}
```

Entries for this unit:

| `id`         | `group`      | `placement` | `layer`      |
| ------------ | ------------ | ----------- | ------------ |
| `'spawn'`    | `'markers'`  | `'marker'`  | `null`       |
| `'goal'`     | `'markers'`  | `'marker'`  | `null`       |
| `'terrain'`  | `'terrain'`  | `'tile'`    | `'terrain'`  |
| `'platform'` | `'platforms'` | `'tile'`    | `'platform'` |
| `'water'`    | `'water'`    | `'tile'`    | `'water'`    |

Exports: `palette` (the array), `byId(id)` (lookup helper).

No `spawn` factory functions yet — tile entries are layers, marker entries are
structural. Entity entries with `spawn` functions arrive in Units 08–11.

### `src/game/flag.js` — Flag entity

Animated flag placed at `level.goal`. Follows the engine contract:

- `constructor(cell, clip)` — `clip` is `atlas.get('flag')`.
- `update(dt)` — advance animation frame.
- `draw(ctx, cam)` — draw the current frame.
- `hitbox` — `{ x, y, w, h }`, 16 × 32 filling the goal cell.
- `z` — `Z.main`.

The flag sprite is 34 × 93 px (9 frames at 10 FPS). The hitbox fills the goal cell
(16 wide, 32 tall, centered and bottom-aligned). The draw offset positions the full
sprite so the pole base sits at the cell bottom:
`drawOffsetX = -9`, `drawOffsetY = -61`.

The flag does not collide with terrain. Completion is checked by
`intersects(player.hitbox, flag.hitbox)` in the World.

### `src/game/world.js` — World container

Created fresh on each level enter or restart. Factory function:

```js
createWorld(level, theme, atlas, keys)
```

**Owns:** the LevelModel, the Player, an entities array, and the Parallax.

**`update(dt, camX, viewW)`** — returns `'playing'`, `'dead'`, or `'complete'`:

1. `player.update(dt)`
2. For each entity: `entity.update(dt)`
3. `parallax.update(dt, camX, viewW)`
4. Death checks:
   - Bottom border: `player.hitbox.y > level.rows * TILE`
   - Water: center-bottom of the player hitbox is inside a water cell
5. Goal check: `intersects(player.hitbox, flag.hitbox)`

**`draw(ctx, cam, viewW, viewH)`:**

1. `drawLevel(ctx, cam, viewW, viewH, level, theme, atlas, parallax)`
2. Draw each entity (just the flag for now).
3. `player.draw(ctx, cam)`

Does **not** own the camera, input, or viewport.

### `src/game/play-scene.js` — Play scene

Implements the scene interface from `2-architecture.md`:

```
enter(params)  exit()  update(dt)  render(ctx, cam)  mountUI(root)  unmountUI()
```

**`enter({ level, theme, atlas, input, camera, viewport, onDeath, onComplete })`:**
Creates the World. Stores references.

**`update(dt)`:**
1. `input.advance()`
2. `world.update(dt, camera.x, viewport.viewW)` → status
3. Camera follow on the player center.
4. On `'dead'` → `onDeath()`. On `'complete'` → `onComplete()`.

**`render(ctx, cam)`:**
`world.draw(ctx, cam, viewport.viewW, VIEW_H)`

**`mountUI` / `unmountUI`:** stubs (Unit 09).
**`exit()`:** null out references.

### `src/main.js` — Minimal App

Replaces the throwaway demo. Owns canvas, viewport, input, camera, loop, atlas.
Loads the atlas, deserialises the fixture level, creates and enters the PlayScene.

The loop delegates to `scene.update(dt)` / `scene.render(ctx, cam)` via closures.
No changes to `core/loop.js`.

On death or completion, calls a `restart()` function that exits and re-enters the
scene with a fresh LevelModel (re-deserialised from the same fixture data).

### `src/data/fixtures/play-demo.js` — Fixture level

A ~60 × 16 fixture that exercises every Unit 07 mechanic:

- Terrain floor with a gap (pit death).
- Water in the bottom row (drowning death).
- Semi-solid platforms above gaps.
- Spawn on the left, goal/flag on the right.
- Big enough for camera scrolling.

Built as a LevelData object passed through `deserialise()`. The old
`autotile-demo.js` stays (tests reference it).

## Not Built

- No HUD, no hearts, no coin counter (Unit 09).
- No enemies or collectibles (Units 08–11).
- No transition wipe (Unit 16).
- No scene manager class or multi-scene routing — `main.js` runs one scene.
- No DOM UI beyond what already exists.
- No audio (Unit 12).
- No tests for new code — new modules are scene/entity wiring, not pure logic.
  Existing 74 tests must still pass.

## Verification Checklist

- [ ] `npm run dev` — level renders with terrain, water, platforms, parallax, and
  an animated flag at the goal.
- [ ] Player runs from spawn to flag; touching the flag restarts the level.
- [ ] Player falls through a terrain gap past the bottom; level restarts.
- [ ] Player falls into water; level restarts.
- [ ] Camera follows the player and clamps at level edges.
- [ ] Wall-slide, wall-jump, coyote time, jump buffering, drop-through all work.
- [ ] `npm test` — 74 tests pass.
- [ ] `npm run build` — no errors.
- [ ] No console errors or warnings during a normal run.
