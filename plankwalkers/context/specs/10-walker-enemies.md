# Unit 10 — Walker Enemies

## What This Unit Builds

Three enemies that patrol, turn at ledges and walls, cost a heart on contact, and
die to a stomp — on one shared `WalkerEnemy` base. Per the Open Question 5
decision (2026-09-13) each one plays **genuinely differently**, not the same
behaviour reskinned:

| Enemy | Reads as | What it actually does |
| --- | --- | --- |
| **Crabby** | a sentry | Strikes **both sides at once** with a wide, short pulse. Has no facing. Its top is always safe, so the answer is to go over it. |
| **Fierce Tooth** | a charger | **Lunges** forward at nearly twice the player's run speed, then is winded and helpless. Only triggers on what is in front of it. |
| **Pink Star** | an anti-air turret | Spins up when the player is **above** it and is **un-stompable while spinning**. The one enemy that punishes a lazy stomp. |

The behaviours are read off the art, not invented — see **Why These Three
Behaviours** below. Each enemy is one palette entry plus one class
(success criterion 7); the maker picks them up automatically from the registry.

**Depends on:** Unit 09.

## Constraint That Shapes This Unit

The asset build packs **eight clips** per enemy: `idle`, `run`, `anticipation`,
`attack`, `hit`, `dead-hit`, `dead-ground`, `attack-effect`
(`tools/asset-manifest.mjs` `walker()`). The pack also contains `03-Jump`,
`04-Fall` and `05-Ground` for all three, and **those are not packed**.

Every behaviour below is designed to need only the eight packed clips. Adding a
clip means editing `tools/asset-manifest.mjs` and re-running `npm run assets`,
and "asset pipeline changes and runtime code that reads the new output" is a
split trigger in `5-ai-workflow-rules.md`. **Unit 10 does not touch the asset
pipeline.** No hop, no knockback arc, no airborne enemy state.

## Why These Three Behaviours

Measured from the packed strips, not guessed:

- **Crabby is drawn face-on with a claw on each side** (opaque centroid sits
  within 0.7 px of canvas centre in every clip). Its `attack` frame 0 throws both
  claws out to x4 and x71 of a 72-wide canvas **simultaneously**, and its
  `attack-effect` is a single **118 × 24** frame holding a chevron pointing
  *outward at each end*, expanding over 3 frames. The artist drew a symmetric,
  two-sided, wide strike. So Crabby has no facing and no safe side.
- **Fierce Tooth is drawn in profile facing left** — the opaque centroid sits at
  +0.4 idle and +0.5 run but swings to **−1.1 during `attack`**, because the
  lunging head pushes the mass forward. `anticipation` opens the mouth over
  3 frames; `attack` frame 0 is the mouth at full gape at x0. That is a committed
  forward bite: a lunge.
- **Pink Star is drawn face-on** (centroid +0.0 idle, +0.1 run) and its `attack`
  is **4 frames of the arms curled into a spinning pinwheel** — a buzzsaw, with
  the `attack-effect` reduced to flecks of kicked-up dust. A spinning blade is the
  one thing in this game you should not be able to land on.

Silhouette mirror-symmetry is *not* how facing was determined — the player scores
5.6 % asymmetric and is plainly directional. Centroid shift under `attack` is.

## Deliverables

### `src/data/tuning.js` — two new keys

Everything else reuses what is already there: `gravity`, `maxFallSpeed`,
`stompBounce` (300), `hazardDamage` (1, the same one heart spikes cost).

| Key | Value | Source |
| --- | --- | --- |
| `enemySenseHeight` | `15` | SPW `enemies.py` `Shell.state_management` `player_level = abs(dy) < 30`, halved for 32 px art |
| `enemyTurnCooldown` | `0.1` | debounce, so an enemy on a one-tile island paces instead of vibrating at 60 Hz. Same idea as SPW `Tooth.reverse`'s 250 ms `hit_timer`, shortened because ours guards only the terrain probe |

Patrol speeds, sense ranges and cooldowns are **per-enemy** and live in the
palette entry (`4-code-standards.md` § Constants). They are **not** ported: SPW's
`Tooth` is a single-speed 200 (→ 100) walker with no states at all, which is
exactly the player's run speed. A three-state design needs a patrol speed below
the player's and an attack speed above it, so these are new tuned numbers.

### `src/game/entities/walker-enemy.js` — the shared base

`src/game/entities/` is the folder named in `2-architecture.md` § Entity Registry
and in success criterion 7. `flag.js` stays where it is; do not move it.

```js
export class WalkerEnemy {
  /** @param {WorldHandle} world @param {EntityRecord} rec @param {WalkerEntry} entry */
  constructor(world, rec, entry) {}
}
```

**Placement follows `Player`, not `Collectible`.** `Collectible` bottom-aligns the
*sprite canvas* to the cell; these sprites carry 1–3 px of transparent padding
below the feet, so that would float them. Instead:

```js
hitbox.x = rec.c * TILE + (TILE - entry.hitboxW) / 2;
hitbox.y = (rec.r + 1) * TILE - entry.hitboxH;   // hitbox bottom = feet = cell bottom
```

and the sprite draws at `hitbox + drawOffset`, exactly as `player.js` does.

**Fields:** `z = Z.main`, `alive = true`, `damages = true`, `stompable = true`,
`hitbox`, `oldRect`, `damageBox` (defaults to `hitbox`), `dir`, `vy`, `state`,
`stateTimer`, `turnCooldown`, `frameIndex`, `clip`.

**Initial direction** comes from the level record: `rec.p?.dir === 1 ? 1 : -1`.
Validate it at the boundary — `p` is a free-form `Record<string, unknown>` that
`schema.js` preserves but does not type-check. Never `Math.random()`: SPW's
`choice((-1,1))` would make a level replay differently every load.

**One state machine, one mechanism.** Every state except `patrol` carries a
`stateTimer` and exits when it reaches 0. Every clip wraps its `frameIndex`.
There are no clip-end callbacks and no per-state animation special cases.

| State | Clip | Timer | Moves | Exits to |
| --- | --- | --- | --- | --- |
| `patrol` | `run` | — | `dir * entry.speed` | `anticipation` when `shouldAttack()` and cooldown is up |
| `anticipation` | `anticipation` | clip length (`n / fps`) | no | `attack` |
| `attack` | `attack` | `this.attackTime` (default: clip length) | subclass, via `attackVx()` | `recover` |
| `recover` | `idle` | `entry.cooldown` | no | `patrol` |
| `dying` | `dead-ground` | clip length | no | `alive = false` |

Because the timer and the clip length agree by default, `anticipation` and
`attack` play through exactly once; Pink Star's longer spin simply wraps its clip,
which is what a spin should do anyway.

**`update(dt)` order:**

1. `dying` short-circuits: tick `stateTimer`, animate, `alive = false` at 0, return.
2. `copy(hitbox, oldRect)`; tick `stateTimer` and `turnCooldown`.
3. State decisions (table above). `shouldAttack()` is a subclass hook; default `false`.
4. Horizontal: `hitbox.x += this.vx() * dt`, then `resolveH`.
5. Gravity: the same half-step form as `Player.applyGravity` so the game has one
   gravity, clamped to `maxFallSpeed`; then `resolveV` (zero `vy` on a push) and
   `resolveSemiSolid(..., false)` so enemies stand on platforms too.
6. Turn, in `patrol` only and only when `turnCooldown <= 0`: flip `dir` and set
   `turnCooldown = tuning.enemyTurnCooldown` when blocked ahead.
7. `hitbox.y > worldH` → `alive = false`, return. A maker mistake despawns quietly
   instead of falling forever.
8. `touchPlayer()`.
9. `animate(dt)`.

**Blocked-ahead probe.** Wall: the existing `checkWallLeft` / `checkWallRight`
(they sample the middle 50 % of the hitbox against terrain — better than SPW's
1 px band at head height). Ledge: a **module-level scratch rect**, 1 px wide, at
`dir > 0 ? hitbox.x + hitbox.w : hitbox.x - 1`, same top and height as the
hitbox, passed to the existing `checkFloor` — which already accepts terrain *or*
platform, so platform ledges work for free. This is SPW's `floor_rect_right` /
`floor_rect_left` position exactly. **No new export in `physics.js`, no new tests
for it.**

**`touchPlayer()`** — the split that makes this readable:

- **Stomp** tests the **body**: `stompable`, `player.vy > 0`,
  `player.oldRect.bottom <= this.oldRect.top`, and `intersects(player.hitbox, this.hitbox)`.
  Both `oldRect`s are last frame's, so they are comparable. On a stomp:
  `world.player.bounce()`, `state = 'dying'`, `damages = false`.
- **Damage** tests the **`damageBox`**: `intersects(player.hitbox, this.damageBox)`
  → `world.stats.hurt(tuning.hazardDamage)`. `Stats.hurt` already no-ops during
  invulnerability, so holding contact costs one heart, not five.
- Stomp wins; they are `if` / `else if`.

Enemies are **not solid** — the player passes through them, as in SPW, where
`Tooth` is not in `collision_sprites`. There is no standing on an enemy's head.

**`draw(ctx, cam)`** mirrors `player.draw`: frame from `frameIndex`, destinations
`Math.round`ed, and the flip guarded by `entry.artFacing` —
`flip = entry.artFacing !== 0 && this.dir !== entry.artFacing`. Crabby and Pink
Star are drawn face-on and never flip; only Fierce Tooth does. A flip mirrors
about the **sprite canvas**, so art that is not centred on that canvas jumps when
the enemy turns — Fierce Tooth's opaque box sits 3 px right of its canvas centre,
which would shift it 3 px left when flipped. Entries that flip therefore carry a
measured `flipOffsetX` (`drawOffsetX + (2*opaqueX + opaqueW - fw)`) used in place
of `drawOffsetX` on the flipped path only. The flip uses the
`save` / `translate` / `scale(-1,1)` / `restore` pattern from the 2026-09-06
decision. Mutates nothing.

**No allocation in `update` or `draw`** — the ledge probe and Crabby's strike rect
are persistent objects, not literals.

### `src/game/entities/crabby.js` — the sentry

- `shouldAttack()`: `playerNear(entry.senseRange)` — horizontal centre distance
  within range **and** `|dyCentre| <= tuning.enemySenseHeight`. No facing test.
  This is SPW's `near` + `level` pair without its `front`.
- On entering `attack`, spawn the `attack-effect` once through the existing
  `world.spawnFx`, centred on the body: it is a single symmetric frame holding
  both chevrons, so it needs no flip and `PickupFx` needs no changes.
- While `frameIndex < 2` (frames 0–1, 0.2 s of the 0.4 s clip), point `damageBox`
  at a persistent strike rect: **width `entry.strikeW` (118), height `hitboxH`,
  centred on the hitbox centre**. Outside that window, `damageBox = hitbox`.
  Measured: `attack` frame 0 spans x4–x71 of the 72-wide canvas at y10–y28, and
  the effect adds 23 px past each end — so 118 px at body height is what is drawn.
- Does not move during `anticipation` or `attack`. `attackVx()` returns 0.

The strike ignores terrain — it will reach through a one-tile wall. Accepted for
v1 (there is no line-of-sight anywhere in this game); the fixture placement keeps
Crabby clear of walls. Log it as an issue only if it actually reads wrong in play.

### `src/game/entities/fierce-tooth.js` — the charger

- `shouldAttack()`: `playerNear(entry.senseRange)` **and** the player is in front —
  `Math.sign(playerCentreX - centreX) === dir`. SPW's full `near` + `front` +
  `level` triple.
- `attackVx()` returns `dir * entry.lungeSpeed` — 170 px/s against a 45 px/s
  patrol and the player's 100 px/s run. Over the 0.5 s clip that covers ~85 px,
  about 2.7 tiles.
- **The lunge ends early** when blocked ahead (the same wall/ledge probe): set
  `stateTimer = 0`. It commits, but it does not run off a ledge — "never walks off
  the level" holds in every state.
- `recover` is the tell: 1.0 s stationary on the `idle` clip. That is the window
  to stomp it.

### `src/game/entities/pink-star.js` — the anti-air turret

- `shouldAttack()` is the **only vertical trigger**: `|dxCentre| <= entry.senseRange`,
  the player's `hitbox` bottom is at or above this hitbox's top, and the gap is
  within `entry.senseRange`. Approaching on the ground does not set it off.
- On entering `attack`: `stompable = false`, `attackTime = entry.spinTime` (0.8 s,
  two wraps of the 4-frame clip). On leaving: `stompable = true`.
- `attackVx()` returns 0 — it spins in place. It is a turret, not a charge; Fierce
  Tooth already owns charging.
- A player who dives onto the spin gets `hurt` instead of a kill **and still gets
  `player.bounce()`**, so they are knocked clear rather than left grinding against
  it. That reads as bouncing off a blade, and invulnerability covers the rest.
- The counterplay is real and teachable: 0.3 s of `anticipation` with full air
  control to steer away, or stomp it during `recover`, or approach along the ground
  and stomp from the side at the edge of its range.

### `src/data/palette.js` — three entries

Kind ids are **`crabby`, `fierce_tooth`, `pink_star`** — each enemy's own name in
snake_case. **These ids are permanent**: they are written into every saved level and
every share code, and renaming one is a breaking format change (known-risk
watchlist 9). `crabby` is already the id used in `2-architecture.md`'s schema
example and in `codec.test.js`.

The tempting alternative was `tooth` / `star`, matching the atlas clip prefixes so
clips could derive as `` `${id}/idle` ``. The existing palette rules it out twice
over. Id and clip path are **already separate namespaces** bridged by an explicit
field — `coin_gold` → `coin/gold`, `diamond_red` → `diamond/red`, `potion_red` →
`potion/red` — so derivation is not the convention here and never has been. And
every id already in the registry is a **full descriptive name**, never an
abbreviation; `tooth` and `star` would be the only shortened ones. A level file
reading `{"k":"fierce_tooth"}` also says what it is without a lookup.

Each entry: `group: 'enemies'`, `placement: 'entity'`, `layer: null`, `z: Z.main`,
`clips` (the atlas prefix — `'crabby'`, `'tooth'`, `'star'`, exactly as
`clip: 'coin/gold'` bridges `coin_gold` today), `icon` (`'<clips>/idle'`), and
`spawn(world, rec) { return new X(world, rec, this); }`. The base builds its five
clip references off `entry.clips`; nothing reads the id at runtime.

| field | `crabby` | `fierce_tooth` | `pink_star` |
| --- | --- | --- | --- |
| `label` | Crabby | Fierce Tooth | Pink Star |
| `clips` | `crabby` | `tooth` | `star` |
| `speed` px/s | 30 | 45 | 60 |
| `senseRange` px | 64 | 96 | 56 |
| `cooldown` s | 1.2 | 1.0 | 0.9 |
| `artFacing` | 0 | −1 | 0 |
| extra | `strikeW: 118` | `lungeSpeed: 170` | `spinTime: 0.8` |

Hitboxes and draw offsets, measured from **idle frame 0** opaque bounds and
tightened by the same margin the player uses (24 × 28 → 18 × 26, i.e. −3 px per
side in x, −2 px in y). Comment each measurement next to the value.

| Kind | canvas | idle f0 opaque | feet y | hitbox | drawOffset |
| --- | --- | --- | --- | --- | --- |
| `crabby` | 72 × 32 | x17 y6 w42 h23 | 29 | 36 × 21 | −20, −8 |
| `fierce_tooth` | 34 × 30 | x7 y5 w23 h23 | 28 | 17 × 21 | −10, −7 |
| `pink_star` | 34 × 30 | x3 y4 w27 h25 | 29 | 21 × 23 | −6, −6 |

Derivation, which reproduces the player's own `(−23, −6)` exactly:
`drawOffsetX = -(opaqueX + (opaqueW - hitboxW) / 2)`,
`drawOffsetY = hitboxH - feetY`.

No `spriteW` / `spriteH` on these entries — nothing reads them for an enemy, and
the canvas size is in the measurement comment.

### `src/game/world.js` — one line

Add `level` to the spawn handle. Enemies need the grid for `resolveH` / `resolveV` /
`checkFloor`; `worldH` derives from `level.rows * TILE`. `Collectible` and `Spikes`
declare their own handle typedefs and are unaffected. Nothing else in `world.js`
changes — spawning, `alive` compaction and draw order already work.

### `src/game/player.js` — one method

```js
/** Stomp bounce. Called by an enemy the player killed from above. */
bounce() {
  this.vy = -tuning.stompBounce;
  this.coyoteTimer = 0;
  this.jumpBufferTimer = 0;
}
```

Mirrors `doJump`. Keeps the impulse in the object that owns the player's physics
instead of having enemies write `player.vy` from outside. Nothing else in
`player.js` changes.

### `src/game/entities/walker-enemy.test.js`

Pure logic against a `LevelModel`, no canvas — the `world.test.js` pattern. The
mock atlas here must return the **real** `fw`/`fh`/`n`/`fps` from
`src/data/atlas.json` (with a stub `image`), because state durations are clip
lengths; a flat `n: 4` mock would silently test the wrong timings. Build a small
purpose-made level (flat floor, one ledge, one wall, one semi-solid platform)
rather than reusing `play-demo`. Leave `world.test.js`'s own mock alone.

Cover: patrol direction from `p.dir`; patrol speed; turn at a wall; turn at a
ledge; stand and turn on a semi-solid platform; side contact hurts once and is
then swallowed by invulnerability; stomp kills, bounces, and stops damaging;
stomp while `stompable === false` hurts and does **not** kill; Crabby triggers
from the left *and* from the right; Crabby's strike reaches where its body does
not; Fierce Tooth triggers only from the front; the lunge is faster than the
patrol and stops at a ledge; Pink Star triggers only from above and restores
`stompable` after the spin; an enemy below the world despawns.

### `src/data/fixtures/play-demo.js` — four records

Geometry unchanged (`world.test.js` places the player at hard-coded cells). Add:

| Kind | Cell | Proves |
| --- | --- | --- |
| `fierce_tooth` | (17, 12) `p: { dir: -1 }` | turns at the col-10 **wall** going west and at the col-20 **pit ledge** going east; lunges along the flat |
| `pink_star` | (25, 12) | dive onto it off the row-11 platform (cols 19–24) and meet the spin block. 25, not 26: a `coin_gold` already sits on (26, 12) and would be swept up mid-fight |
| `crabby` | (39, 10) | rides the **semi-solid platform** (row 11, cols 37–41) and turns at both platform ledges |
| `crabby` | (46, 12) | guards the `skull` at (44, 12) — taking the treasure means stepping into the strike |

## Not Built

- `hit`, `dead-hit` and the `tooth` / `star` `attack-effect` clips — packed but
  deliberately unused. Two-phase death and directional slash trails are polish;
  `PickupFx` has no flip parameter and this unit does not add one.
- `03-Jump` / `04-Fall` / `05-Ground` for any enemy — **not packed**, and packing
  them is an asset-pipeline change (see Constraint above).
- Enemy-vs-enemy collision, enemy-vs-projectile, enemies as moving platforms.
- Coins or score for a kill. Neither reference awards them.
- Knockback on the player, a player hit/death state, screen shake (Unit 19).
- Stomp, death or alert audio (Unit 12).
- Line-of-sight for Crabby's strike.
- Awareness bubbles — the `!` / `?` / skull dialogue art is **Beyond v1**.
- Shooters, projectiles, the Seashell and the Cannon (Unit 11).
- Kind-in-registry validation in `schema.js` (still Unit 16).
- Changes to `core/`, `physics.js`, `schema.js`, `codec.js`, `collectibles.js`,
  `spikes.js`, `play-scene.js`, `main.js`, `flag.js`, `tools/`, `public/assets/`.

## Docs To Update In The Same Change

- `context/specs/00-build-plan.md` — Unit 10 currently reads "lunge on proximity
  using the Anticipation and Attack clips" for all three, which predates the
  2026-09-13 decision. Rewrite it to the three distinct behaviours.
- `context/4-code-standards.md` § Rendering — "One `ctx.save()`/`restore()` pair
  per frame at most" is already untrue: `player.draw` opens a pair per flipped
  sprite, accepted by the 2026-09-06 X-flip decision, and Fierce Tooth will do the
  same. State the real rule (a pair per flipped sprite; no other `save`/`restore`).
- `context/6-progress-tracker.md` — unit complete, decisions taken.
- `context/7-current-issues.md` — anything found and deliberately not fixed.

## Verification Checklist

- [x] `npm test` — 122 passing (95 prior + 27 walker)
- [x] `npm run build` — no errors; `getDiagnostics` clean
- [x] Each enemy patrols, turns at a wall, turns at a ledge, and stays on the
      semi-solid platform without walking off either end
- [x] Side contact costs exactly one heart; holding contact does not shred the row
- [x] A stomp kills, bounces the player, plays `dead-ground` once, and despawns
- [x] **Crabby:** stopping beside it on *either* side gets hit; the effect sprite
      lands on the strike zone; its top is safe; the skull at (44, 12) is only
      reachable by timing the pulse
- [x] **Fierce Tooth:** ignores the player behind it, lunges on approach from the
      front, stops at the col-20 ledge instead of walking into the pit, and is
      stompable during `recover`
- [x] **Pink Star:** ignores a ground approach, spins when dived on, the dive is
      punished rather than rewarded, and it is stompable again after the spin
- [x] Only Fierce Tooth ever flips; Crabby and Pink Star never do
- [x] Pit, water, flag, wall-jump, coyote, buffer, drop-through, treasure, spikes,
      HUD hearts and coins all still behave (nothing above them changed)
- [x] No console errors; no frame-time regression with all four enemies on screen
- [x] Verified at a phone-sized viewport and a desktop viewport
- [x] Docs above updated in the same change
