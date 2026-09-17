# Unit 11 — Shooters and Projectiles

## What This Unit Builds

Two stationary hazards that shoot: the **Cannon** and the **Seashell**. Each fires
a projectile when the player is near, in front and roughly level with it; the
projectile flies in a straight line, damages on contact, and dies on terrain, on
its lifetime, or at the level edge — each with its own burst particle.

**Depends on:** Unit 10.

## One Class, Not Two — and Why That Is the Opposite Call to Unit 10

Unit 10 gave each enemy its own class because the art forced it: Crabby's `attack`
throws both claws out at once, Fierce Tooth's centroid lunges forward, Pink Star's
curls into a pinwheel. Three different verbs.

The shooters are the opposite, and the art says so just as plainly. Both are
**idle (n=1, static) → fire (n=6) → idle**, and in both, **frame 3 is the shot**:

| | idle opaque | fire f3 opaque | what f3 shows |
| --- | --- | --- | --- |
| `cannon/fire` | x5 w30 | **x0** w39 | barrel at full extension, muzzle open |
| `seashell/fire` | x9 w32 | **x0** w38 | mouth a long open barrel, pearl gone |

Same structure, same fire frame, and frame 3 is exactly where SPW fires
(`enemies.py` `Shell.update`: `if self.state == 'fire' and int(self.frame_index) == 3`).
Two objects with one verb, so: **one `Shooter` class and one `Projectile` class,
configured entirely from the palette**, the way one `Collectible` serves eight
treasure kinds. Manufacturing a behavioural difference the art does not support
would be worse than having none.

The difference that *is* real lives in the ammunition, and it is a good one:

| | pearl | cannonball |
| --- | --- | --- |
| speed | **75 px/s** — slower than the player's 100 run | **150 px/s** — faster than the player can run |
| visible size | 7 px | 15 px |
| cycle | 2.0 s | 3.0 s |
| on terrain | small poof (`pearl/dead`, 16×16) | **54×60 explosion** (`cannon/ball-explode`) |

So a pearl is something you can out-run, and a cannonball is not. That single fact
— which falls straight out of SPW's own halved pearl speed — is the whole
distinction, and it is teachable in one encounter.

## Constraint That Shapes This Unit

Ten clips are packed for these two (`tools/asset-manifest.mjs`): `cannon/idle`,
`fire`, `fire-effect`, `ball`, `ball-explode`, `ball-dead`, `seashell/idle`,
`fire`, `pearl/idle`, `dead`. Unit 11 uses **all ten** and adds none.

The pack also holds `Cannon Hit`, `Cannon Destroyed`, `Seashell Hit`,
`Seashell Destroyed`, `Seashell Opening`, `Seashell Bite` and the whole `Totems`
tree. Those are **not packed** and are already claimed by **Beyond v1**
(destructible turrets, and a shell that bites at close range). As in Unit 10, this
unit does not touch `tools/` or `public/assets/`.

## Deliverables

### `src/game/sense.js` — pure proximity helpers, extracted

Unit 10 put `playerNear` and `playerInFront` on `WalkerEnemy` as methods. Shooters
need the identical tests and must not inherit patrol, turning or stomp-death, so
the pair moves to a small pure module both can import:

```js
/** @returns {boolean} within `range` horizontally and `height` vertically, centre to centre */
export function playerNear(hitbox, playerHitbox, range, height) {}
/** @returns {boolean} the player is on the `dir` side */
export function playerInFront(hitbox, playerHitbox, dir) {}
```

`WalkerEnemy.playerNear` / `.playerInFront` become one-line delegations; no walker
behaviour changes and the Unit 10 tests must keep passing untouched. This is the
second consumer arriving, not a speculative abstraction.

Both are SPW `Shell.state_management`'s `near` / `front` / `level` triple. Callers
pass `tuning.enemySenseHeight` as `height`, so the module stays free of tuning
imports and is trivially testable.

### `src/game/physics.js` — one new query

```js
/** @returns {boolean} true when any terrain tile overlaps the rect */
export function checkSolid(rect, level) {}
```

Everything already there *resolves* (pushes a body out); a projectile only needs to
ask. It joins the `check*` family, iterates the overlapping cell range like its
siblings, and treats out-of-grid cells as empty.

**Terrain only, not platforms.** A semi-solid platform is a thin ledge you jump
through from below; making it stop projectiles would contradict that. A pearl
passing under a platform reads correctly.

### `src/game/hazards/shooter.js` — the `Shooter` class

Shooters are hazards, not entities that can be defeated, so they sit beside
`spikes.js` in `src/game/hazards/`.

```js
constructor(world, rec, entry)
```

- Placement follows `Player` and `WalkerEnemy`: hitbox bottom-aligned to the cell
  bottom, horizontally centred, sprite drawn at `hitbox + drawOffset`.
- `dir` from `rec.p?.dir === 1 ? 1 : -1`, narrowed at the boundary. This is SPW's
  `reverse` Tiled property, expressed the way walkers already express facing.
- **`damages = false`.** The body never hurts the player. This is a direct port:
  SPW adds `Shell` to `(all_sprites, collision_sprites)` and **not** to
  `damage_sprites` (`level.py` setup). Only the projectile hurts. It also gives the
  player a real tactic — close the distance and the shooter is harmless — and it
  keeps the hazard roster legible: spikes are static damage, walkers are mobile
  damage, shooters are ranged damage with a safe body.
- **Not solid either**, which *is* a deliberate deviation from SPW, where `Shell`
  is in `collision_sprites` and can be stood on. We have no entity-vs-player
  collision resolution — `physics.js` resolves against the `LevelModel` grid — and
  adding one would push against invariant 4. Record the deviation; do not build it.

**Two states, timer-free.** `idle` (clip `idle`, n=1) and `fire` (clip `fire`,
n=6). A `cooldown` timer counts down in `idle`; when it reaches 0 and
`playerNear(entry.senseRange, tuning.enemySenseHeight)` and
`playerInFront(dir)` are both true, enter `fire` with `frameIndex = 0` and
`hasFired = false`. `fire` ends when `frameIndex >= clip.n`, which resets
`cooldown = entry.cooldown`.

**Firing is frame-gated, and guarded.** While in `fire`, when
`Math.floor(frameIndex) === entry.fireFrame` and `!hasFired`: spawn the projectile
and set `hasFired = true`. **The guard is not optional** — frame 3 spans 0.1 s,
which is six ticks at 60 Hz, so without it one trigger fires six projectiles. SPW
carries the same `has_fired` flag for the same reason.

**The muzzle flash is drawn, not spawned.** `cannon/fire-effect` is 6 frames and
`cannon/fire` is 6 frames — the artist drew them as a matched pair. So the shooter
draws the effect itself, on top of its body, at the muzzle, sharing the body's
`frameIndex` and the body's flip. That needs no timer, no `spawnFx`, and **no
change to `PickupFx`**, which has no flip parameter and does not grow one here.
`entry.fireFx` is optional; the Seashell has no such clip and omits it.

**`draw`** mirrors `WalkerEnemy.draw`, including `artFacing` / `flipOffsetX` — both
shooters are drawn facing left, so both flip when `dir > 0`.

### `src/game/hazards/projectile.js` — the `Projectile` class

```js
constructor(world, x, y, dir, spec)   // x, y = muzzle point in world px
```

Positioned by its **hitbox centre** on the muzzle, not by a cell. A projectile in
flight is a runtime position, exactly like the player's — invariant 4 governs
authored placement and the shape of collision geometry (grid-aligned AABB against
the tile grid), which this respects. It is not a free-floating *placement*.

- `damages = true`, `z = Z.main`, `alive`, `hitbox`, `life = spec.lifetime`.
- `update(dt)`: move `dir * spec.speed * dt` horizontally. **No gravity** — both
  barrels are drawn horizontal and the ball sprite is a static sphere with no
  rotation or arc frames, so nothing in the art implies a trajectory.
- Then, in order:
  1. player overlap → `world.stats.hurt(tuning.hazardDamage)` and die via `hitFx`
  2. `checkSolid(hitbox, level)` → die via `spec.hitFx`
  3. `life -= dt`, `life <= 0` → die via `spec.endFx`
  4. outside `[0, worldW]` → die via `spec.endFx`
- Dying is `alive = false` plus one `world.spawnFx(clip, …)` centred on the
  hitbox. `PickupFx` already does one-shot playback and all four clips here are
  symmetric, so none needs a flip.

The cannonball uses **both** of its packed death clips, which is what they are for:
`ball-explode` (54×60, a bright blast) on a terrain hit, `ball-dead` (16×16, three
tumbling fragments) when it simply runs out. The pearl has only `pearl/dead` and
uses it for both.

### `src/game/world.js` — two small changes

1. **`spawnEntity(ent)` on the spawn handle**, pushing into `entities`. The
   existing `compactAlive(entities)` already reaps `alive === false`, and the draw
   loop already covers them, so nothing else changes.
2. **Snapshot the entity count before the update loop** (`const n = entities.length`).
   Without it, a projectile spawned by a shooter at index *i* is updated in the
   same frame it was created and starts life one step downrange. One line, and it
   makes every future runtime spawner behave the same way.

**Projectiles cannot leak across a restart** because `createWorld` builds fresh
`entities` / `fx` arrays on every enter, and nothing in this unit holds
module-level mutable state — no shared pool, no cache. That is the guarantee the
build plan asks for; the test below is what stops it regressing.

### `src/data/palette.js` — two entries

Kind ids **`cannon`** and **`seashell`** — full descriptive names, matching the
convention every existing id follows. Each entry carries a nested `projectile`
object: a projectile is never placeable, so it must not become a palette row of its
own, and its stats belong to the thing that fires it.

Each entry: `group: 'hazards'`, `placement: 'entity'`, `layer: null`, `z: Z.main`,
`icon: '<clips>/idle'`, `spawn(world, rec) { return new Shooter(world, rec, this); }`.

| field | `cannon` | `seashell` |
| --- | --- | --- |
| `label` | Cannon | Seashell |
| `clips` | `cannon` | `seashell` |
| `senseRange` px | 208 | 176 |
| `cooldown` s | 3 | 2 |
| `fireFrame` | 3 | 3 |
| `artFacing` | −1 | −1 |
| `fireFx` | `cannon/fire-effect` | — |

Both sense ranges stay under **256 px**, half the *narrowest* viewport (512), so a
shooter is always on screen when it fires at you. Off-screen damage is not a
mechanic this game has.

Bodies, measured from idle frame 0 opaque bounds and inset by the margin the player
uses (24×28 → 18×26):

| Kind | canvas | idle f0 opaque | feet y | hitbox | drawOffset | flipOffsetX |
| --- | --- | --- | --- | --- | --- | --- |
| `cannon` | 40 × 26 | x5 y3 w30 h23 | 26 | 24 × 21 | −8, −5 | −8 |
| `seashell` | 48 × 38 | x9 y17 w32 h21 | 38 | 26 × 19 | −12, −19 | −10 |

The cannon's art is exactly centred on its canvas (5 px margin each side), so its
`flipOffsetX` equals its `drawOffsetX`; the seashell's is 2 px off and needs the
correction, as Fierce Tooth did.

**Muzzle**, measured from **fire frame 3**, taking the leftmost opaque column and
its vertical midpoint — the mouth the shot leaves from:

| Kind | fire f3 muzzle (canvas) | `muzzleX` | `muzzleY` |
| --- | --- | --- | --- |
| `cannon` | x0, y8–14, mid **y11** | −8 | 6 |
| `seashell` | x0, y25–31, mid **y28** | −12 | 9 |

Both are offsets from `hitbox` top-left with `dir === -1`; facing right mirrors
about the body centre (`hitbox.x + hitbox.w - muzzleX`). `muzzleY` is unchanged by
facing.

Worth noting as a check on the measurement: the seashell muzzle lands **25 px** from
its hitbox centre, and SPW spawns its pearl at `center + vector(50 * direction, 0)`
— 50 at 64 px scale, which halves to exactly 25. The measurement and the reference
agree without being made to.

`fireFx` anchoring: the flash's persistent column sits at canvas x≈11 and its
frames centre on y≈14, so the effect canvas is placed at
`(muzzle.x − 11, muzzle.y − 14)` facing left, mirrored about the muzzle facing
right. That puts the source of the blast on the muzzle and lets it expand outward.

Projectiles, measured the same way but centred on **both** axes, since a projectile
has no feet: `drawOffset = -(opaque + (opaqueSize - hitboxSize) / 2)` per axis.

| | clip | canvas | opaque | hitbox | drawOffset | speed | lifetime | hitFx | endFx |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cannonball | `cannon/ball` | 16×16 | x0 y1 w15 h15 | 11 × 11 | −2, −3 | 150 | 3 s | `cannon/ball-explode` | `cannon/ball-dead` |
| pearl | `pearl/idle` | 16×16 | x5 y4 w7 h7 | 5 × 5 | −6, −5 | 75 | 5 s | `pearl/dead` | `pearl/dead` |

The pearl's 75 px/s is SPW's `create_pearl(..., 150)` halved like every other
spatial constant. Its 5 s lifetime is **not** halved — lifetime is not a spatial
quantity, and with the speed halved the pearl covers the same distance *in tiles*
as SPW's does. The cannonball's numbers are ours; SPW has no cannon.

### Tests

**`src/game/sense.test.js`** — in and out of horizontal range; inside and outside
the height band; in front and behind for both `dir`; the exactly-aligned case.

**`src/game/physics.test.js`** (existing file) — `checkSolid`: overlapping a solid
cell, in empty space, straddling a boundary, partially outside the grid, fully
outside the grid, and **not** triggered by a platform-layer tile.

**`src/game/hazards/shooter.test.js`** — stub handle collecting `spawnEntity` and
`spawnFx` calls, the `walker-enemy.test.js` harness reused (real frame counts from
`atlas.json`, minimum-legal 40 × 12 level):

- does not fire when the player is behind, out of range, or above the height band
- fires when near + in front + level
- **fires exactly one projectile per cycle** — step the whole 6-frame clip at 60 Hz
  and assert one spawn, the `hasFired` regression
- fires on `fireFrame`, not on entry to `fire`
- does not fire again until `cooldown` elapses
- the projectile appears at the muzzle, on the correct side, for both `dir`
- body contact does no damage
- projectile travels `dir * speed`
- projectile dies on terrain and spawns `hitFx`
- projectile dies on lifetime and spawns `endFx` (a different clip for the cannon)
- projectile dies at the level edge
- projectile hurts the player once, then invulnerability swallows it
- **two shooters on two stub handles never see each other's projectiles** — the
  no-leak-across-restart guarantee, tested where it can actually be tested

### `src/data/fixtures/play-demo.js`

Two shooters, plus **one 2-cell terrain pillar** so a projectile has something to
explode against — the fixture currently has exactly one vertical surface (the
col-10 wall) and the build plan requires proving terrain despawn.

| Add | Where | Proves |
| --- | --- | --- |
| `seashell` | (19, 12) `p: { dir: -1 }` | pearls fly left toward the col-10 wall — 9 tiles at 75 px/s is 3.8 s, inside the 5 s lifetime, so they **burst on terrain**. The lane is cols 11–19, which the player enters right after wall-jumping the col-10 wall |
| terrain | col 49, rows 11–12 | a 2-tile pillar the player hops; the cannon's backstop |
| `cannon` | (53, 12) `p: { dir: -1 }` | balls fly left and **explode on the pillar** 3 tiles away. Standing left of the pillar is safe, which demonstrates terrain blocking a shot; the lane is cols 50–53, on the run-up to the flag |

Dodge the cannon out of range and the ball reaches its lifetime instead, showing
`ball-dead` — so the fixture exercises both death clips.

The pillar touches no cell `world.test.js` uses — it places the player at (5,12),
(7,12), (12,12) and (14,12) and checks the pit, water and flag — and it sits clear
of Crabby's patrol around (46,12).

## Not Built

- `Cannon Hit` / `Destroyed`, `Seashell Hit` / `Destroyed` / `Opening` / `Bite`,
  and all `Totems` — **not packed**, and already claimed by Beyond v1.
- Destructible or stompable shooters. They are indestructible in v1.
- Solid shooters (SPW's `Shell` is; see above for why ours are not).
- Blast **damage** from `ball-explode`. It is a particle, not a hitbox.
- Arcing or gravity-affected projectiles. Nothing in the art implies one.
- Projectiles colliding with enemies, with each other, with semi-solid platforms,
  or with water.
- Reflecting or destroying a projectile. SPW's `Pearl.reverse` exists for its
  attack; combat here is stomp-only.
- Line of sight beyond the terrain the projectile itself hits.
- A `flip` parameter on `PickupFx`, and any rename or move of it. It is now used by
  pickups, Crabby and these bursts, so its name and home are worth revisiting —
  **log that as an issue, do not fold it into this unit.**
- Firing audio (Unit 12; SPW plays `pearl_sound` in `create_pearl`).
- Changes to `core/`, `schema.js`, `codec.js`, `collectibles.js`, `spikes.js`,
  `player.js`, `play-scene.js`, `main.js`, `tools/`, `public/assets/`.

## Docs To Update In The Same Change

- `context/4-code-standards.md` § File Organization — `src/game/` gains `sense.js`.
- `context/2-architecture.md` — the spawn handle now also carries `spawnEntity`,
  and entities can be created at runtime rather than only from `level.entities`.
- `context/6-progress-tracker.md` — unit complete, decisions taken.
- `context/7-current-issues.md` — the `PickupFx` naming/home question, plus
  anything found and deliberately not fixed.

## Verification Checklist

- [ ] `npm test` — 122 prior plus the sense, `checkSolid` and shooter tests
- [ ] `npm run build` — no errors; `getDiagnostics` clean on every touched file
- [ ] Walker enemies unchanged after the `sense.js` extraction — Unit 10's tests
      pass without being edited
- [ ] Each shooter fires only when the player is near, in front and level; walking
      up behind one is completely safe
- [ ] Exactly one projectile per fire cycle, launched on frame 3, from the muzzle,
      on the correct side for both `dir`
- [ ] Standing against a shooter's body costs nothing
- [ ] Pearls burst on the col-10 wall; cannonballs explode on the col-49 pillar;
      a dodged cannonball dies on lifetime showing `ball-dead` instead
- [ ] A projectile costs exactly one heart and cannot chain-damage through invuln
- [ ] The cannon's muzzle flash sits on the barrel mouth and mirrors correctly
- [ ] Dying and restarting leaves no projectile in flight
- [ ] Everything from Units 07–10 still behaves: pit, water, flag, wall-jump,
      coyote, buffer, drop-through, treasure, spikes, all three enemies, HUD
- [ ] No console errors; no frame-time regression with both shooters firing
- [ ] Verified at a phone-sized viewport and a desktop viewport
- [ ] Docs above updated in the same change
