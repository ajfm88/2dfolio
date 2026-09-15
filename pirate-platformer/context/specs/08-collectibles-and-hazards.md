# Unit 08 — Collectibles and Static Hazards

## What This Unit Builds

Treasure you can pick up, spikes that cost a heart, invulnerability flicker, and
a health/coin data model with property setters. Health reaching zero ends the
run through the same `'dead'` path as pit and water. The fixture from Unit 07
gains every collectible kind and a jumpable spike strip.

**Depends on:** Unit 07 (play scene, palette, World).

## Deliverables

### `src/data/tuning.js` — new keys only

Existing physics values are unchanged. `hitInvuln: 0.7` is already correct.
Add:

| Key | Value | Source |
| --- | --- | --- |
| `startHealth` | `5` | SPW `Data._health` |
| `hazardDamage` | `1` | SPW `player.get_damage` |
| `coinSilver` | `1` | SPW `Item.activate` |
| `coinGold` | `5` | same |
| `coinDiamond` | `20` | same; red, green, and blue |
| `coinSkull` | `50` | same |
| `potionHeal` | `1` | same; red and blue |
| `coinExtraLife` | `100` | SPW coins setter |
| `invulnFlicker` | `0.05` | flicker half-period in seconds |

Do not halve the coin values — they are scores, not 64 px physics. Do not copy
SPW's 400 ms hit timer.

### `src/game/stats.js` — health and coin model

Port of `reference/super-pirate-world/code_complete/data.py`, without UI side
effects. Class with real getters/setters:

```js
export class Stats {
  constructor() {
    this._coins = 0;
    this._health = tuning.startHealth;
    this.invuln = 0;
  }
  get coins() { return this._coins; }
  set coins(value) { /* assign; while >= coinExtraLife, subtract and health += 1 */ }
  get health() { return this._health; }
  set health(value) { this._health = value < 0 ? 0 : value; } // no max cap
  get dead() { return this._health <= 0; }
  hurt(amount) { /* gated; see below */ }
  tick(dt) { /* invuln countdown, floor at 0 */ }
}
```

- Start at 5 hearts. No maximum — potions and the 100-coin bonus can grow the
  row. Unit 09 HUD must render `stats.health` hearts, not a hardcoded 3.
- Coins wrap at 100 → extra heart, intra-run only. A fresh `Stats` on each
  `createWorld` (including restart) resets both. Campaign persistence is Unit 18.
- Setters must not touch the DOM or the canvas.
- `hurt(amount)`: if `invuln > 0` or `dead`, return `false`. Otherwise subtract
  `amount` via the health setter. If still alive, set `invuln = tuning.hitInvuln`.
  If this hit killed, leave `invuln` at 0 (the run ends the same frame). Return
  `true` when damage applied.
- `tick(dt)` counts `invuln` down in fixed-timestep seconds. Never read
  `performance.now()` or a rAF delta.

### `src/game/stats.test.js`

Pure module tests. Cover:

- starts at coins 0, health 5, invuln 0
- `coins += 1` sticks
- `coins += 100` → coins 0, health 6
- `coins += 250` from 0 → coins 50, health 7 (while-loop wrap)
- `health += 1` has no max
- `health = -3` clamps to 0
- `hurt(1)` decrements, starts `invuln === hitInvuln`, returns true
- second `hurt` while invuln returns false, health unchanged
- `tick` reduces invuln; at 0, `hurt` works again
- `hurt` at health 1 → health 0, `dead === true`, invuln stays 0
- further `hurt` when dead returns false

### `src/game/world.test.js`

Mock-atlas wiring tests (no canvas): gold coin awards, spikes hurt once then
ignore contact during invuln, potion restores a heart, health 0 returns
`'dead'`, unknown kinds are skipped.

### `src/data/palette.js` — entity entries with `spawn`

Kind ids are snake_case strings written into `EntityRecord.k`. Each entity
entry has `placement: 'entity'`, `layer: null`, `z: Z.main`, `icon` equal to
its idle clip, and `spawn(world, cell)` that constructs the class with
`this` as the spec.

| `id` | `group` | clip | fx | award |
| --- | --- | --- | --- | --- |
| `coin_gold` | `treasure` | `coin/gold` | `fx/coin` | `tuning.coinGold` |
| `coin_silver` | `treasure` | `coin/silver` | `fx/coin` | `tuning.coinSilver` |
| `diamond_red` | `treasure` | `diamond/red` | `fx/diamond` | `tuning.coinDiamond` |
| `diamond_green` | `treasure` | `diamond/green` | `fx/diamond` | `tuning.coinDiamond` |
| `diamond_blue` | `treasure` | `diamond/blue` | `fx/diamond` | `tuning.coinDiamond` |
| `skull` | `treasure` | `skull/idle` | `fx/skull` | `tuning.coinSkull` |
| `potion_red` | `treasure` | `potion/red` | `fx/potion` | `heal: tuning.potionHeal` |
| `potion_blue` | `treasure` | `potion/blue` | `fx/potion` | `heal: tuning.potionHeal` |
| `spikes` | `hazards` | `spikes` | — | damages |

Hitbox and draw offset are measured from idle-frame opaque bounds. Collectible
sprites are horizontally centred in the cell and bottom-aligned (same formula
as Player/Flag). Spikes fill the cell; the hitbox is the bottom 16 px.

| Kind | canvas | opaque union | hitbox | drawOffset (hitbox → sprite) |
| --- | --- | --- | --- | --- |
| gold/silver coin | 16×16 | x3 y3 w11 h11 | 11×11 | −3, −3 |
| diamonds | 24×24 | x5 y5 w13 h13 | 13×13 | −5, −5 |
| skull | 24×28 | x5 y1 w16 h25 | 16×25 | −5, −1 |
| potion_red | 13×17 | x2 y3 w9 h14 | 9×14 | −2, −3 |
| potion_blue | 13×17 | x3 y4 w7 h13 | 7×13 | −3, −4 |
| spikes | 32×32 | x0 y16 w31 h16 | 32×16 at y+16 | 0, −16 |

Comment each measurement next to the constants.

`palette.js` importing `Collectible` / `Spikes` is the architecture's documented
`spawn: (world, cell) => new Crabby(...)` pattern. `collectibles.js` must not
import `palette.js` (cycle).

Do not add kind-in-registry validation in `schema.js`. Codec tests use
`k: 'crabby'` / `'keep'`; unknown kinds are skipped at spawn.

### `src/game/collectibles.js`

One class for all eight treasure kinds.

```js
constructor(world, cell, entry)
```

- `collectible = true` (capability flag for Unit 10; World does not branch on it).
- Hitbox from `entry` + cell using the centre/bottom-align formula.
- `update(dt)`: advance looping idle animation (Flag-style `frameIndex`); if
  `intersects(this.hitbox, world.player.hitbox)`, award via stats setters
  (`coins +=` and/or `health +=`), `world.spawnFx` at the sprite centre, set
  `alive = false`. Do not mutate `level.entities`.
- `draw(ctx, cam)`: current frame at `hitbox + drawOffset`, destinations
  `Math.round`. Does not mutate.

`PickupFx` in the same file: one-shot clip, `z = Z.fx`. Constructor takes clip
and world top-left. `update` advances `frameIndex`; when `frameIndex >= n`,
`alive = false`. Does not loop. `createSprite` always loops — do not use it,
and do not change `core/sprite.js`.

### `src/game/hazards/spikes.js`

```js
constructor(world, cell, entry)
```

- `damages = true`, `stompable = false`.
- Sprite fills the cell. Hitbox is the bottom 16 px of the cell (32×16).
- `update(dt)`: if `intersects(this.hitbox, world.player.hitbox)`, call
  `world.stats.hurt(tuning.hazardDamage)`. No movement, no particle (player
  flicker is the feedback).
- `draw`: static `spikes` clip, `n = 1`.

### `src/game/world.js`

Build a spawn handle **before** iterating `level.entities` so factories receive
`{ atlas, player, stats, spawnFx }`.

1. `stats = new Stats()`
2. `player = new Player(..., clips including player/hit, stats)`
3. `entities = [new Flag(level.goal, atlas.get('flag'))]` — flag stays a
   marker, not palette-spawned. Keep the `flag` reference for the goal check.
4. For each `level.entities` record: `byId(rec.k)?.spawn?(handle, rec)`. Skip
   missing entries and entries without `spawn`. No `switch` on kind.
5. `fx = []`. `spawnFx(clip, x, y)` pushes a `PickupFx`.

**`update(dt, camX, viewW)`** returns `'playing' | 'dead' | 'complete'`:

1. `player.update(dt)`
2. `stats.tick(dt)`
3. Each entity `update(dt)`
4. Compact `entities` where `alive === false` (write-index loop, not `filter`)
5. Each fx `update(dt)`, then compact fx
6. `parallax.update(dt, camX, viewW)`
7. Pit: `player.hitbox.y > worldH` → `'dead'` (bypasses hearts and invuln)
8. Water: center-bottom cell in the water layer → `'dead'` (same)
9. `stats.dead` → `'dead'`
10. Flag AABB → `'complete'`

A spike on the flag cell therefore kills rather than completes.

**`draw`:** `drawLevel` → entities in insertion order → player → fx.

Return `{ level, player, stats, worldW, worldH, update, draw }` so Unit 09 can
read `stats` without a reshape. Do not z-sort this unit. Do not put the player
in `entities`. Do not mutate `level.entities` on pickup.

### `src/game/player.js`

Constructor gains `stats` and `clips.hit`. Physics, input, and the five-state
machine (`idle | run | jump | fall | wall`) do not change. No `hit` or `dead`
state, no knockback, no `player/dead-hit` / `player/dead-ground`.

**`draw`:** if `stats.invuln > 0` and
`Math.floor(stats.invuln / tuning.invulnFlicker) % 2 === 1`, draw `clips.hit`
frame 0 (packed white silhouette) at the existing 64×40 offset `(−23, −6)`.
Otherwise draw the current movement clip. Flicker is a read of `invuln`
(invariant 3). Drive it from remaining invuln vs `dt`, never wall-clock.

### `src/data/fixtures/play-demo.js`

Keep the Unit 07 geometry. Fill `entities` so every kind is on the path:

| Kind | Cell |
| --- | --- |
| `coin_gold` | (5, 12) |
| `coin_silver` | (7, 12) |
| `spikes` | (12, 12) |
| `potion_red` | (14, 12) |
| `diamond_red` | (14, 8) |
| `diamond_green` | (15, 8) |
| `diamond_blue` | (16, 8) |
| `potion_blue` | (21, 10) |
| `coin_gold` | (26, 12) |
| `spikes` | (33, 12), (34, 12), (35, 12) |
| `skull` | (44, 12) |
| `coin_silver` | (48, 12), (50, 12) |

Row 12 sits on terrain row 13. Diamonds sit on the high platform (row 9).
`potion_blue` sits on the first-gap platform (row 11). The 33–35 spike strip
is jumpable. Pit 20–23, water 38–40, wall col 10, flag at 55 stay.

Path treasure: 2×5 + 3×1 + 3×20 + 50 = 123 → wraps to 23 coins and +1 heart.
That wrap is proven by `stats.test.js`; it is not visually countable until
Unit 09.

## Not Built

- DOM HUD, hearts row, coin counter, pause, results (Unit 09)
- Touch controls (Unit 09)
- Walker enemies, stomp, `stompBounce` (Unit 10)
- Shooters / projectiles (Unit 11)
- Audio (Unit 12)
- Maker, undo, gestures (Units 13–15)
- Kind-in-registry schema checks (codec tests still use `'crabby'`; Unit 16)
- Death animation, hit state, knockback, ceiling spikes, dust (Unit 19)
- Green bottle, chests, maps, totems (Beyond v1)
- Moving platforms (stub stays `null`)
- Refactoring Flag to `constructor(world, cell)`
- Z-sorting the entity list
- Changes to `core/`, `schema.js`, `codec.js`, `physics.js`, `play-scene.js`,
  `main.js`, `flag.js`

## Verification Checklist

- [x] `npm test` — 91 passing (74 prior + 11 stats + 6 world spawn/collect/hurt)
- [x] `npm run build` — no errors
- [ ] Each treasure id appears, animates, vanishes on touch, replaced by its
      fx clip which does not loop (play — needs a browser)
- [x] Standing on spikes: first overlap costs 1 heart; holding contact does
      not shred all hearts in one frame (`world.test.js`)
- [x] Grab `potion_red` after the first spike: survive a fifth contact
      (`world.test.js` restores a heart)
- [x] Health 0 returns `'dead'` (`world.test.js`; App still restarts)
- [ ] Pit gap 20–23, water gap 38–40, flag at 55 still work (unchanged paths;
      confirm in play)
- [ ] Wall-slide, wall-jump, coyote, buffer, drop-through, parallax, autotile
      unchanged (confirm in play)
- [ ] No console errors. No HUD. No sound
- [x] `2-architecture.md`, `4-code-standards.md`, `6-progress-tracker.md`
      updated in the same change
