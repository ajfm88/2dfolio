# Unit 06: Player Physics

## Goal

Physics-driven player movement ported from Super Pirate World's `player.py`,
adapted from its sprite-group collision model to our tile-grid architecture.
The Captain runs, jumps with variable height, falls with gravity, wall-slides,
wall-jumps, lands on terrain, stands on semi-solid platforms, and drops through
them — all at a fixed 1/60 s timestep. Coyote time, jump buffering, variable
jump height and terminal velocity are added; neither Python reference has them.

The demo stays a throwaway `main.js`. No App, no scene framework, no health
system, no enemies, no combat, no second theme. The play scene is Unit 07.

## Design

SPW's collision resolver (`player.py:collision`, `player.py:semi_collision`)
iterates pygame sprite groups and compares old-rect to new-rect edges. We port
the same logic but resolve against the `LevelModel` tile grid directly — no
per-tile Sprite objects, no sprite groups. The resolver finds overlapping cells
from the hitbox bounds and checks each occupied cell.

Invariants upheld:
- Invariant 1: fixed 1/60 s timestep. No wall-clock or rAF delta.
- Invariant 3: `update()` never touches canvas or DOM; `draw()` never mutates.
- Invariant 4: all collision is grid-aligned AABB.
- Invariant 8: no `addEventListener` in game code; input from `core/input.js`.
- Invariant 11: `core/` does not import from `game/` or `data/`.

Player hitbox: **18 × 26**, drawn at `(hitbox.x - 23, hitbox.y - 6)`.
Measured from the 64 × 40 idle frame, opaque art at x 20–44, y 4–32.

No wall-slide clip exists for unarmed Captain; the `wall` state reuses
`player/fall`. See `6-progress-tracker.md` standing hazard.

## Implementation

### `src/data/tuning.js`

Single exported `tuning` object. SPW values halved (32 px tiles vs 64 px).
Timers in seconds. All values from `2-architecture.md` § Physics Model:

```js
export const tuning = {
  runSpeed: 100,
  gravity: 650,
  jumpVelocity: 450,
  maxFallSpeed: 400,
  wallSlideGravity: 65,     // gravity / 10
  coyoteTime: 0.09,
  jumpBuffer: 0.12,
  wallJumpLock: 0.4,
  wallSlideBlock: 0.25,
  dropThrough: 0.15,
  stompBounce: 300,
  hitInvuln: 0.7,
};
```

### `src/game/physics.js`

Tile-grid collision resolver. Exports:

- `resolveH(hitbox, oldRect, level)` — horizontal against terrain.
- `resolveV(hitbox, oldRect, level)` → `boolean` — vertical against terrain;
  returns `true` when a push happened (caller should zero `vy`).
- `resolveSemiSolid(hitbox, oldRect, level, dropping)` → `boolean` — platform
  layer, bottom-edge only; returns `true` on landing.
- `checkFloor(hitbox, level)` → `boolean` — 1 px sensor below, terrain +
  platform.
- `checkWallLeft(hitbox, level)` → `boolean` — 1 px sensor left, terrain only.
- `checkWallRight(hitbox, level)` → `boolean` — 1 px sensor right, terrain
  only.

Cell-range helper (not exported):
```
c0 = max(0, floor(x / TILE))
c1 = min(cols - 1, floor((x + w - 0.001) / TILE))
r0 = max(0, floor(y / TILE))
r1 = min(rows - 1, floor((y + h - 0.001) / TILE))
```

Resolution logic (tiles are static, so tile oldRect === tile rect):

Horizontal — for each overlapping terrain cell:
- `hitbox.left < tileRight && old.left >= tileRight` → push right
- `hitbox.right > tileLeft && old.right <= tileLeft` → push left

Vertical — same pattern, top/bottom. Zeroes vy.

Semi-solid — platform layer, bottom only:
- `hitbox.bottom >= tileTop && old.bottom <= tileTop && !dropping` → land

Contact sensors check a 1 px band adjacent to the hitbox edge. No allocation
in the hot path — one module-level scratch rect.

### `src/game/player.js`

Player entity. Follows the engine contract (`update(dt)`, `draw(ctx, cam)`,
`hitbox`, `z`).

**Spawn:** hitbox centered in the spawn cell, feet at cell bottom.

**State machine:** `idle`, `run`, `jump`, `fall`, `wall`. State selects the
atlas clip; clip changes reset `frameIndex`.

**Timers:** five plain number fields, decremented by `dt`:
`coyoteTimer`, `jumpBufferTimer`, `wallJumpLockTimer`, `wallSlideBlockTimer`,
`dropTimer`.

**Update order:**
1. Snapshot `oldRect`
2. Decrement timers
3. Input → horizontal direction (locked during wall-jump), facing, drop-through,
   jump press, jump release (cut `vy` for variable height)
4. Jump: floor/coyote → floor jump; wall + not blocked → wall jump; else buffer
5. Gravity: wall-slide path (zero vy, tiny gravity) or velocity Verlet
6. Terminal velocity clamp
7. Horizontal movement
8. Resolve: `resolveH`, `resolveV`, `resolveSemiSolid`; zero `vy` on push
9. Moving-platform carry (inert — `platform` field stays `null` until Unit 07+)
10. Contact detection via `physics.js` sensors
11. Coyote time: start on floor→air transition
12. Jump buffer landing: trigger if `jumpBufferTimer > 0` on landing
13. State machine → animation advance

**Draw:** sprite at `(hitbox.x - 23, hitbox.y - 6)`, X-flip via
`save/translate/scale(-1,1)/restore`.

### `src/core/input.js`

Add `jump` action bound to `Space`. Three additions: key map entry, `keys.jump`
button, advance-loop entry. Keeps engine concern (key mapping) in `core/` and
gameplay concern (what jump does) in `game/`.

### `src/main.js`

Replace free-movement demo with physics-driven player. Create player at spawn,
call `player.update(dt)` and `player.draw(ctx, cam)`, camera follows hitbox
centre. Remove `DEMO_SPEED`, pointer-drag movement, and manual `facing`.

### `src/data/fixtures/autotile-demo.js`

Add a ceiling overhang (terrain at r=4, c=28–30) for ceiling-collision testing.
Adjust spawn to `(8, 9)` — standing on the terrain floor.

### Tests

`src/game/physics.test.js`: ~20 cases covering `resolveH`, `resolveV`,
`resolveSemiSolid`, contact sensors, grid edges, multi-cell spans.

## Dependencies

Units 02 (engine), 03 (level model), and 04 (autotile + tile rendering).

## Out of scope

Health, damage, hit animation, stomp combat, enemies, collectibles, HUD,
touch controls, audio, scene framework, second theme, palette, codec/schema
changes, inner corners (issue 2 stays open).

## Verify when done

- [ ] `npm test` passes (52 existing + new physics tests)
- [ ] `npm run build` passes
- [ ] No console errors during a normal run
- [ ] Player falls with gravity and lands on terrain
- [ ] Player runs left/right (arrows + WASD)
- [ ] Player jumps (Space and Up arrow)
- [ ] Variable jump height: tap = low, hold = full
- [ ] Coyote time: jump after walking off a ledge
- [ ] Jump buffer: press jump before landing → triggers on land
- [ ] Wall-slide on the column (slower descent)
- [ ] Wall-jump off the column (pushed away, input locked)
- [ ] Stands on semi-solid platforms
- [ ] Drops through platforms with Down
- [ ] Ceiling collision (upward velocity zeroed)
- [ ] Terminal velocity: long falls capped
- [ ] Animation states match movement (idle, run, jump, fall, wall)
- [ ] Identical at 60 Hz and 144 Hz
- [ ] Parallax and autotiling from Units 04–05 unaffected
