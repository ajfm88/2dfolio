# A6c — NPC movement, turning and Pikachu idle behavior

2026-10-03 · Codex. **Plan ready; implementation has not started.**

The user assigned **Claude Opus to implement this plan, then Codex to review the
implementation**. Leave the implemented slice **awaiting Codex review**, followed
by the user's play-test. This document is the implementation handoff; it supersedes
`notes/08-a6-plan.md` §2.3 and the short A6a discovery notes about Pikachu.

**Engine baseline:** `1854ef1813162ed6c55c258f4250f640b6b5b107` — A6b done,
reviewed and user-verified. Read `context/STATUS.md` first, then root `CLAUDE.md`,
`context/CONVENTIONS.md`, and the overworld/Pikachu subsystem architecture files.
Check the actual working tree before starting; preserve any later user changes.

## 1. Result and boundaries

A6c makes ordinary NPCs choose directions, turn, rest and wander as Yellow does;
uses Yellow's sprite collision geometry; lets a just-defeated trainer turn at
random; adds Pikachu's idle glances and four antics; and implements the player's
brief obstruction when turning toward Pikachu.

This is **engine only**. Existing extracted movement fields, sprites and trainer
classes are enough. No extractor, JSON, PNG, ROM, save-format or new map changes
are expected. Keep the runtime ROM-free, `refs/` and `pkmn-sprites/` read-only,
and commit locally only. No dependency or plugin is needed.

Preserve the already verified A6a/A6b behavior:

- One overworld pass is two Game Boy frames. Player/follower normal steps remain
  16 frames, ordinary NPC steps 34, fast scripted NPC steps 18, and in-step NPC
  walks 16. Do not introduce another half-rate clock or update sprites twice.
- Map scripts precede standing input; a turning pass skips `UpdateSprites`;
  step-end order, encounter gates, mood drift and cooldown remain intact.
- NPC visibility/pop-in and whole-sprite UI coverage, retained talk-facing,
  fixed-facing turn-back, scripted movement modes and terminator timing remain.
- Direct scripted Pikachu movement and the existing ledge approximation still
  work. Idle animation must never delay their completion or consume their targets.

**Later slices:** A6d owns the ledge shadow, exact follower ledge hop and
`ApplyPikachuMovementData`; A1c owns trainer sight/approach. The four-pixel camera
finding F-1 in `notes/09-a6b-review.md` stays separate. Also leave starter/OT checks,
other happiness events, emotion modifiers, battle presentation, cutscene paths
and waits, and the encounter warp finding N-2 in their recorded homes. The idle
bounce below uses its own table and belongs in A6c, even though it looks like a
hop; it is not the A6d ledge animation.

## 2. Evidence and current gaps

Primary source: `refs/pokeyellow` master **`e89ead15`**. Routine names are the
stable anchors; the line numbers below refer to that revision.

| Behavior | Primary source |
|---|---|
| NPC direction selection and state dispatch | `engine/overworld/movement.asm`: `UpdateNPCSprite` (97), `.randomMovement`, `.determineDirection`, `TryWalking` |
| Initialization, rest, screen conversion | Same file: `InitializeSpriteStatus`, `InitializeSpriteScreenPosition`, `UpdateSpriteMovementDelay`, `NotYetMoving` |
| NPC terrain, edges, displacement counters | Same file: `CanWalkOntoTile` (554), `_IsTilePassable` |
| Pixel collision geometry and slot order | `engine/overworld/sprite_collisions.asm`: `_UpdateSprites`, `DetectCollisionBetweenSprites`, `SetSpriteCollisionValues`, `Func_4d0a` |
| Post-battle movement override | `home/trainers.asm`: `PrintEndBattleText`; `engine/overworld/npc_movement_2.asm`: `SetEnemyTrainerToStayAndFaceAnyDirection`; `home/map_objects.asm`: `SetSpriteMovementBytesToFF` |
| Reset versus battle re-entry | `home/overworld.asm`: map sprite loading and `InitSprites`, including `BIT_BATTLE_OVER_OR_BLACKOUT` |
| Pikachu idle state dispatch and animations | `engine/pikachu/pikachu_follow.asm`: `SpawnPikachu_`, `PointerTable_fc710`, `Func_fc793`, `Func_fc7aa`, `Func_fc803` (539), `Func_fc835`, `Func_fc842`, `Pointer_fc8d6`, `asm_fc904`, `asm_fc937`, `asm_fc969` |
| Pikachu retained command and gates | Same file: `RefreshPikachuFollow`, `ComputePikachuFollowCommand`, `Func_fcc08`, `Func_fcc92`, `GetPikachuFollowCommand`, `Func_fcae2`, `WillPikachuSpawnOnTheScreen` |
| Player/Pikachu obstruction | `home/overworld.asm`: direction handling (142 onward), `.noDirectionButtonsPressed`, `.moveAhead2`, `JoypadOverworld`, `IsSpriteInFrontOfPlayer` (1084), `CollisionCheckOnLand` (1215) |
| Random byte meaning | `home/random.asm`: `Random` returns `hRandomAdd` in A |

Secondary comparison: `refs/gen1recomp` dev **`20ab97ab`**, chiefly
`src/world/NPC.lua` and `PikachuFollower.lua`. Its origin bounds, extra movement
coin flip, idle distance heuristic and timing are not substitutes for the ASM.
Port the instructions, including removed Yellow branches and byte wrap; several
comments describe Red/Blue or round the timings.

| Current code | Change required |
|---|---|
| `npc.ts`: uniform direction arrays, two-step origin box | Byte-range direction selection; two displacement bytes; separate pixel edge check |
| `walk_pace.ts`: STAY/NONE rests forever; fixed STAY only draws a delay byte | All ordinary STAY sprites run the attempted-step/rest cycle, including the direction RNG read |
| `npc.ts` / `player.ts`: target tile reservations block sprites | Use movement vectors, screen pixels and image availability; retain target coordinates for map/visibility semantics |
| `sprites.ts`: tile-only Pikachu collision argument | Supply ordered sprite state and player/follower context |
| `main.ts`: win sets only the defeated flag | Apply a transient STAY/NONE override to the live engaged trainer |
| `pikachu_follower.ts`: empty queue resets to standing | Add retained follow-command metadata and the idle state machine |
| `player.ts`: no follower collision gate | Add the turn-armed collision counter and the special Pikachu rules |

## 3. NPC rules to implement

### 3.1 Movement bytes, direction and random reads

Keep the NPC's **live movement mode** separate from immutable extracted data.
Movement byte 1 means STAY/WALK/scripted; byte 2 means a fixed facing, NONE/ANY,
UP_DOWN or LEFT_RIGHT. A defeated trainer changes these live bytes, not the map
definition. A scripted terminator changes byte 1 to STAY and preserves byte 2.
Reading that terminator sets script completion on the established terminator
pass, leaves the sprite ready, and consumes no random byte. Its later ordinary
ready update begins the STAY attempt/rest cycle; do not draw a synthetic rest
delay at the terminator or leave a NONE-facing sprite asleep forever.

At a normal ready attempt, `UpdateNPCSprite` calls `Random` **even for STAY and
fixed-facing sprites**. Use one injected byte for this selection:

| Byte | NONE / ANY | UP_DOWN | LEFT_RIGHT |
|---|---|---|---|
| `00..3f` | down | down | left |
| `40..7f` | up | up | right |
| `80..bf` | left | up | left |
| `c0..ff` | right | down | right |

For a fixed byte-2 facing, use that facing after drawing the byte. Data mapping:
explicit `direction` is fixed; otherwise `walkDir` supplies the axis/ANY;
otherwise use NONE for STAY and ANY for WALK. Do not treat the constructor's
default down-facing as an explicit fixed byte. Static objects still run their
cartridge movement logic, but use their existing single-frame image and never
acquire talk-facing behavior.

`TryWalking` writes facing and candidate unit step vectors **before** checking
passability. Thus blocked wander attempts visibly turn. STAY always fails the
translation check and enters a random rest, even on an otherwise walkable tile.
STAY/NONE turns in place; STAY/fixed eventually returns to its default facing,
preserving the A6b interaction behavior.

On failure, draw another byte and store `byte & 0x7f` as the delay; clear the
step vectors. On successful ordinary movement, draw the delay byte when the
last movement pixel is applied, then clear the step vectors. Scripted steps
keep their established path and do not add those random draws.

Rest decrements an unsigned byte: zero wraps to 255, so raw zero waits **256
rest updates**. Reachable waits are **1..127 or 256**, not every value 1..256.
The rest update that reaches zero only makes the sprite ready; the attempt is
on a later update. During rest, reset the visible animation frame to zero as
`NotYetMoving` does; do not automatically reset its intra-frame counter.

The player-walking gate applies to **ready attempts**, not existing movement or
rest countdowns. Invisible/unavailable ordinary sprites keep the A6b freeze.
Initialization itself is the special first update: initialize ready status,
invisible image, screen position and displacement bytes, without an attempt or
random draw. Check its ordering against `InitializeSpriteStatus` rather than
letting an off-window guard prevent initialization forever.

Keep RNG injectable and test draw counts. This slice ports the selection masks
and branch order, using the project's random-byte source; it does not emulate
the hardware DIV-based global RNG or promise identical seeded playthroughs.

### 3.2 Terrain, screen edges and displacement bytes

Ordinary attempted movement checks, in order:

1. Destination bottom-left terrain tile (`_IsTilePassable`). Existing
   `GameMap.isWalkable(tx, ty)` already examines `(tx, ty + 1)`; reuse it.
2. STAY rejects translation.
3. Screen edge predicate below.
4. Chosen direction against the sprite collision mask (§4).
5. Candidate displacement bytes; store both only if every check succeeds.

Scripted `MoveSprite` steps bypass these ordinary checks; preserve normal/fast
and in-step script behavior. Do not apply wander bounds to cutscene paths.

Use Yellow screen pixels for the edge predicate, not target-tile visibility:

```text
u8(npcYPixels + 4 + unitDeltaY) < 0x80
u8(npcXPixels     + unitDeltaX) < 0x90
```

`u8(v) = v & 0xff`; deltas are -1, 0, 1, not the full 16-pixel destination.
The predicate is independent of A6b's inclusive map-coordinate visibility
window. An NPC may be visible but unable to attempt movement in some directions.
For example, aligned Y=0 blocks up by underflow; aligned Y=128 only permits up
through the Y test, and X=144 only permits left through the X test. Do not change
the camera to get these results; convert to the GB coordinate basis (§4).

Initialize **X displacement = 8, Y displacement = 8** per new map sprite.
For each ordinary successful step, adjust the chosen axis by one:

- Up/left from zero fails on subtraction borrow.
- Down/right uses unsigned addition, including `255 -> 0`.
- An unchanged axis stays unchanged; its zero value does not block motion along
  the other axis.
- Yellow removed the conditional jumps after `cp 5`; there is no two-step origin
  box and no positive origin cap. Terrain and the screen still constrain motion.
- On any blocked attempt, commit neither displacement byte. Scripted movements
  do not update these wander bytes. Ordinary reversal does.

Do not recompute these bytes from distance to the original position. That loses
wrap, scripted displacements and the negative-direction limit.

## 4. Sprite collision: geometry and update order

Implement a small pure collision helper rather than another tile reservation
rule. A snapshot needs native slot identity, active/image availability,
GB screen X/Y pixels, and stored X/Y unit step vectors. Player is slot 0;
ordinary NPCs follow map order; Pikachu is slot 15. Skip self, unused slots and
other sprites whose image is `ff`. Hidden and unavailable sprites do not block.

Convert world pixels relative to the current player into the GB basis:

```text
GB XPIXELS = u8(spriteWorldX - playerWorldX + 64 + screenOffsetX)
GB YPIXELS = u8(spriteWorldY - playerWorldY + 60 + screenOffsetY)
```

Player anchor is X=64, Y=60. The current renderer draws four pixels higher; keep
that separate camera finding unchanged. Pikachu's idle screen offsets must be
included in its collision pixels, but never in logical map positions. Account
for stored screen-vector semantics on scripted/fast steps rather than dividing
the most recent pixel delta and assuming it is the collision vector.

For each axis, align Y first with `u8(YPIXELS + 4)`; X is used directly.
`SetSpriteCollisionValues` gives this adjusted coordinate:

```text
adjust(coord, delta) = ((u8(coord + (delta == -1 ? -1 : 0))) & 0xf0)
                      | (delta == 0 ? 0 : delta == -1 ? 9 : 7)
```

The current sprite's half-width is 7 if its adjusted low nibble is zero, else 9.
The other sprite's half-width is 7 if its stored axis vector is zero, else 9.
An axis overlaps when the absolute adjusted-coordinate difference is **at most**
the sum: inclusive thresholds 14/16/18. The subtraction uses unsigned byte
coordinates, but its absolute difference is not a shortest torus distance.

If both axes overlap, choose X when the current Y half-width is less than the
current X half-width; otherwise choose Y. Use other < current for left/up, and
other >= current for right/down. Mask bits are right=1, left=2, down=4, up=8.
OR all ordinary collision bits; gate the attempted direction, not every bit.

**Player/Pikachu is special:** `Func_4d0a` records their directional overlap in
`wd433` and skips adding it to the player's ordinary blocking mask. The exact
sprite-in-front check then applies §7. NPC/Pikachu collision is ordinary and
must still block an NPC. No need to emulate unused collision registers, but
preserve the special route and availability rules.

Keep the ASM's two observations of the world distinct:

1. Within `UpdateSprites`, update the player's collision mask **before** ordinary
   NPCs, then process NPCs sequentially, then Pikachu. Each NPC attempt reads the
   earlier slots' updated state and the later slots' previous state; do not make
   an atomic array of destination reservations. Its own candidate vectors have
   already been written by `TryWalking`.
2. After those updates, `CollisionCheckOnLand` reads the player's previously
   computed mask, then `IsSpriteInFrontOfPlayer` scans the now-current screen
   pixels in native slot order. It compares exact X/Y at a 16-pixel offset from
   the player, not rounded tiles or the NPC's claimed target.

On a standing input pass, `JoypadOverworld` clears the player's stored vectors
then direction handling sets the chosen unit vector **before** `UpdateSprites`.
During walking updates the stored direction continues. No input means zero
vectors, even though the player retains its facing. Expose this explicitly in
`PlayerWalk`/`Player`; `isMoving` alone cannot represent bump attempts.

`Player.checkStep` currently executes after the sprite callback. Have that
callback capture the player mask at its first stage and expose the result to
the later check; do not silently recompute that mask after NPC/Pikachu movement.
Use the same helper for ordinary player sprite blocking plus the exact-front
fallback. Keep collision SFX gating and the current terrain/ledge order.
Do not broaden this into an interaction, trainer-sight or rendering rewrite.

Collision availability must come from simulation state, not whether `render()`
happened. Preserve A6b's image latch, especially sprites coming into range while
the player walks. Reuse existing window/UI predicates where appropriate; read
Pikachu's `WillPikachuSpawnOnTheScreen` before using the NPC footprint, because
its Y alignment and X adjustment differ. Keep follower eligibility (`visible`
today) separate from its transient image availability.

## 5. A trainer's turning override

`PrintEndBattleText` calls `SetEnemyTrainerToStayAndFaceAnyDirection`, which sets
the **live** movement bytes to STAY/NONE. It does not force a direction, reset
movement status/delay, reinitialize displacement, or clear the defeated flag.
The trainer then uses §3's ordinary STAY turning cycle. Do not add a continuous
spin animation: the visible behavior is delayed random changes of facing.

Exclude RIVAL1/RIVAL2/RIVAL3 and map `PokemonTower7F`, exactly as the ASM does.
Use the engine's actual trainer class/map identifiers, not display names.

Wire a clearly named method on the live `Npc` into the map-trainer battle finish
path in `main.ts` beside `engagedTrainer` handling. Applying it after the win
sequence finishes is observationally equivalent to the end-text call for the
current engine because overworld sprites do not tick during battle, money,
evolution or return transitions. Verify that premise when wiring it. Preserve
the existing won/lost flag handling; a blackout reloads the map rather than
creating an enduring movement override. The scripted lab rival remains excluded.

The override survives the current battle return because native map sprite state
is retained. A **new map load/re-entry/CONTINUE recreates the original map
movement bytes**. Only the defeated flag persists. Do not derive the override
from `NpcData.defeated`, change `applyDefeatedTrainers`, or serialize it. Talking
to an already-beaten trainer after re-entry prints its after-text and does not
reapply this override. Test both current-visit and recreated-NPC behavior.

## 6. Pikachu idle state machine

### 6.1 Retain command metadata without rewriting following

The antics gate is **`GetPikachuFollowCommand() >= 5`**, not a new distance test
on every idle pass. Commands 1/2/3/4 are down/up/left/right; 5/6/7/8 are the
corresponding two-step commands. An empty refreshed buffer returns zero.

The ASM buffer size is a last index: `ff` means empty; **zero means one retained
byte, with no executable movement left**. `Func_fcc92` refuses to pop at size
zero. With additional commands it removes the oldest, shifts the others, and
eventually leaves the newest appended command at index zero. Idle reads that
retained command. It is not necessarily the direction of the last pixels moved.

Keep the existing position-target follow implementation for A6c, adding enough
metadata to represent that retained command correctly:

- At spawn/refresh, compute the seed from logical map steps with **Y priority**,
  then X. A one-step difference gives commands 1..4; magnitude >=2 gives 5..8;
  overlap gives zero/no retained command. Use move-toward-player signs.
- Each recorded ordinary player step appends its direction command 1..4, even
  when its queued target is the player's old position and Pikachu must walk a
  different direction to get there. At the player's ledge-hop start, record the
  corresponding 5..8 command, once for the two-step hop, alongside the existing
  pending-hop integration. Do not wait until Pikachu consumes its pending hop
  to set that metadata. Ordinary commands later overwrite the retained tail as
  the native buffer would.
- A retained-tail field updated on append, or queue metadata plus a retained
  tail, is sufficient; do not infer it from `directionFromDelta(target - pika)`.
  Example: Pikachu starts left of the player, then the player walks up. Pikachu
  moves right to the player's old tile, but the retained command is **up (2)**.
- Clear/refresh/reset the metadata with the appropriate buffer lifecycle. Direct
  script targets are a separate mode and must not invent ordinary follow
  commands or trigger idle antics on completion. Preserve capacity and step
  timing; a wholesale native follow-buffer/ledge rewrite belongs to A6d.

Test this bridge at spawn, a corner, a zero-distance target, a hop, a clear and
a script. An empty queue by itself is not enough information to choose an antic.

At ordinary follow completion, preserve the boundary into idle:
`ComputePikachuFacingDirection` changes the live facing after the last movement
image was written. With executable queued commands it uses the newest command
direction; otherwise it faces the player using logical Y first, then X, or
copies player facing on overlap. The image remains latched until the next image
update. This matters at corners: idle must not keep the direction of the last
physical segment until its first random glance.

### 6.2 Counter and dispatch

A pure `pikachu_idle.ts` is recommended. Model ready/idle and four antic states
with byte countdown, facing, animation frame/intra counter and screen offsets.
Use the existing follower for the movement states. Keep state transitions
explicit so the helper does not add an unintentional start/end pass.

`Func_fc793` initializes/refreshes and makes the image invisible; the next ready
update tries a follow command. If there is no executable command,
`Func_fc7aa` **jumps into idle on the same call**. Idle (`Func_fc803`):

1. If Pikachu and the player's **logical map positions** overlap, set its image
   unavailable and return before counting or RNG (`Func_fcae2`). Do not turn this
   into a pixel-rounding check during a move.
2. Decrement the unsigned animation countdown. With nonzero result, reset
   animation frame/intra to zero and draw the standing image.
3. At zero, read the retained command. If it is <5, reload **32 passes**, draw one
   random byte and use `byte & 0x0c` for down/up/left/right (0/4/8/12). Reset the
   animation counters to zero and draw. If >=5, draw a byte, use `byte & 3`, and
   enter one of the four antics below, executing its first update **immediately**.

Freshly initialized and normal-walk-completed countdowns are zero: the first
idle decrement wraps, so it takes **256 eligible idle decrements** to roll.
Do not initialize every idle entry to 32. Subsequent ordinary glances wait 32;
antic exit follows the distinct 16/ready transition below. Trace no-target,
normal-follow and interrupted-antic entry paths with tests.

Only actual sprite updates advance this machine. A turn with no `UpdateSprites`,
text/menu frames and waits do not count. Off-window/ineligible follower state
does not roll. The font/follow-disabled branch `Func_fc76a` suppresses antics,
resets the animation, returns to ready with countdown zero and refreshes the
follow command. Translate that into the engine's available context; do not add
new eligibility/OT mechanics or let script-only `update()` calls run idle RNG.

### 6.3 The four antics

| `byte & 3` | ASM state | Updates, including entry | Behavior |
|---|---|---|---|
| 0 | 6, bounce/wriggle | 17 | Face the retained command direction and apply the table below |
| 1 | 7, walk in place | 48 | Every eight updates advance animation frame modulo four |
| 2 | 8, shuffle | 32 | Every eight updates XOR animation frame with one |
| 3 | 9, spin | 32 | Every eight updates turn down → left → up → right → down |

All four check `wWalkCounter` **before** their update. If the player is walking,
abort to ready with countdown **16** (`Func_fc835`), without an RNG draw. On
natural completion, do the same transition. On the next ready update, a queued
follow command takes priority; without one, ready jumps to idle on that same
call, whose decrement changes 16 to 15. Do not add a standalone dispatch wait.
Walk/shuffle/spin retain frame/intra on exit until the next relevant routine
resets them; ordinary idle had already reset them before selection.
If an interrupted antic resumes following before another idle reset, its
intra-frame counter can exceed the ordinary 2/5 period. Native Pikachu increments
that byte and compares for **equality**, not greater-or-equal, wrapping at 256.
Preserve this carry into normal follow rather than silently resetting or using
`WalkAnim.tick()`'s current `>=` behavior for that path. Pin a mid-antic abort
with a queued follow command; any shared-helper adjustment must preserve the
existing ordinary NPC/player animation tests.

The bounce writes the live facing from the retained command, but `asm_fc87f`
does **not** call `UpdatePikachuWalkingSprite`: its image facing/frame remain
latched while the screen pixels bounce. Preserve that difference between live
facing and the displayed image, as the NPC renderer already does. Walk, shuffle,
spin and ordinary idle do refresh the image. Do not derive every rendered image
directly from the idle machine's latest live facing.

The bounce reads `Pointer_fc8d6` at **countdown - 1**, in reverse table order.
These are stored `(Y, X)` offsets, indexed 0..16:

```text
( 0,  0), (-2,  1), (-4,  2), (-2,  3), ( 0,  4),
(-2,  3), (-4,  2), (-2,  1), ( 0,  0), (-2, -1),
(-4, -2), (-2, -3), ( 0, -4), (-2, -3), (-4, -2),
(-2, -1), ( 0,  0)
```

With a count of 17, entry draws index 16, then 15 down to 0. The ASM subtracts
the previous offset before adding the new one. A renderer offset gives the
same result without moving logical world/map coordinates; clear it on abort,
spawn, refresh and script takeover. Expose it to collision snapshots (§4).
Do not accumulate offsets, transpose X/Y, play an invented SFX, use a sine wave,
or draw an A6d shadow. The other antics use `UpdatePikachuWalkingSprite` with
normal mirrored frame lookup; their eight-update cadence is independent of
happiness. Ordinary follow walking keeps the happiness-dependent cadence.

The player starts moving **after** `UpdateSprites` and appends its follow command
after that callback. An antic can legitimately take one more update on the
player's step-start pass and abort on the next walking pass. Supply the current
walk counter state, not a prediction based on held input. Script takeover,
fainting/visibility changes and new spawn must leave no stale bounce offset.

## 7. Walking into Pikachu

Add a player-owned byte counter corresponding to `wPikachuCollisionCounter`.
Do not use frames, wall-clock time, a cooldown decremented on every pass, or
Pikachu's tile reservation.

- An actual nonsimulated A6a **turning pass** sets the counter to **8**, even if
  Pikachu is not in front. This still skips sprite updates and retains the turn
  encounter check. A direction change that is not an actual turn does not arm it.
- A standing pass with no direction clears it to zero after sprite updates.
- Successful movement / `.moveAhead2`, including subsequent moving passes,
  clears it. Scripted/simulated input skips the turn arm as it does today.
- Merely waiting, opening text, colliding with a wall or a different NPC does
  not spend this counter. Spend it only in the Pikachu branch below.

`CollisionCheckOnLand` first handles its existing ledge/script collision bypass,
then the ordinary sprite mask, then the exact-front fallback (§4). If the first
visible sprite at the exact front position is Pikachu:

1. If ordinary following is disabled (`CheckPikachuFollowingPlayer` nonzero),
   it is an ordinary hard obstruction, including while B is held.
2. Otherwise held **B (keyboard X)** bypasses this follower obstruction.
3. Otherwise counter zero bypasses it.
4. Otherwise decrement the counter. A **nonzero result blocks**; zero passes on
   to ordinary terrain/ledge checks.

Thus an armed 8 counter gives **seven blocked eligible collision checks; the
eighth permits a step if terrain is passable**. The turning pass itself is an
additional pass. This corrects the earlier “blocks for 8 passes” shorthand.
Holding B never bypasses walls, ordinary NPCs or tile-pair restrictions. A hidden
or off-window Pikachu cannot enter this exact-front branch. Moving/wriggling
Pikachu must match exact screen pixels; do not round it onto a blocking tile.

Thread an optional follower/collision context through the player's update path
and `OverworldController`, retaining existing direct/script callers. The gate
must run at the real check point after sprite updates, not by prechecking an
old follower position. Keep the current distinction between direct scripted
walks, door exits and collision-aware `pushPlayer`; inspect the callers before
changing signatures. No blanket “all simulated movement collides” policy is
part of A6c: native bypass depends on the simulated index, and current scripts
already expose approximations that this slice must not disturb.

## 8. Suggested implementation sequence and file ownership

Keep new modules small and pure. Names below are suggestions; behavior and
tests matter more than naming. A broader framework is unnecessary.

1. **Pure NPC rules and `NpcWalk`.** Add a direction selector and displacement
   candidate helper in `overworld/npc_movement.ts` or beside the current walker.
   Give `NpcWalk` mutable live movement settings, remove the STAY/NONE Infinity
   path, share the blocked-attempt/rest cycle and preserve script termination.
   Expose stored collision vectors separately from per-pass pixel deltas.
2. **Collision helper and ordinary NPC integration.** Add
   `overworld/sprite_collision.ts`; remove the origin box and claimed-tile
   blocking in `npc.ts`. Add the edge test and commit displacement only on
   success. Extend `sprites.ts` with ordered simulation snapshots and a player
   mask captured before NPC updates. Include follower availability and offsets.
3. **Trainer hook.** Add the live override method and exception predicate;
   connect the successful engaged-trainer finish in `main.ts`. Keep saved defeat
   handling unchanged. A pure predicate plus a live-NPC lifecycle test makes
   the hook reviewable without mocking the entire main loop.
4. **Pikachu idle.** Implement/test `pikachu/pikachu_idle.ts`, then wire retained
   command metadata, logical positions, render offsets and ordinary-follow
   context into `pikachu_follower.ts` and `sprites.ts`. Direct script movement
   suppresses idle and clears offsets on takeover. Inspect all follower callers
   in `script/script_controller.ts`, `main.ts` and the nurse path.
5. **Player gate and controller wiring.** Add the counter at the turn/no-input/
   movement events in `walk_pace.ts` or `Player`, and the collision branch in
   `player.ts`. Update `overworld_controller.ts` and script callers as necessary;
   preserve callback ordering and optional no-follower cases.
6. **Integrate, validate, document and commit.** Update the two subsystem
   architecture files with verified live-state/collision/idle contracts; append
   implementation results here and update `context/STATUS.md` last. Commit
   specific paths with the project's co-author line. Leave awaiting Codex review.

Do not rush this into the older sketch's “one session” estimate. If a verified
checkpoint is needed, commit it locally and leave A6c explicitly incomplete with
the remaining steps recorded. Do not claim A6d or mark A6c done with only NPCs
implemented. No sub-agents are required for this handoff.

## 9. Deterministic verification

Add meaningful behavior tests with controlled byte streams. Prefer routine
fixtures and observed positions/facing/render arguments over tests that merely
restate private assignments. Update stale existing STAY/NONE expectations rather
than retaining Infinity behavior to keep a test green.

| Area | Required cases |
|---|---|
| Direction selection | All four intervals, especially `3f/40`, `7f/80`, `bf/c0`, and `00/ff`; every axis constraint; fixed facing consumes the direction byte |
| STAY/rest | NONE turns without translation; fixed STAY returns after talk; blocked WALK turns; failure consumes direction then delay; raw delays 0/1/127/128/255; zero needs 256 updates; ready attempt happens after rest reaches zero |
| Gate/pace | Ready attempts wait for player motion; rest/moving continue; invisible freeze and first initialization; existing normal/fast/in-step start and terminator timing; terminator draws no RNG and next ordinary ready call uses STAY; no extra RNG on scripted steps |
| Displacement | Starting 8 permits eight negative moves, ninth fails; reverse restores budget; positive movement beyond old two-step box; `255 -> 0`; unchanged zero axis; terrain/sprite/edge failure commits neither byte; script steps leave bytes alone |
| Screen edge | Underflow at aligned Y=0/X=0; boundaries Y=127/128 and X=143/144; all four directions; visible edge NPC can fail horizontal movement on bottom row; use pixel predicate, not target window |
| Collision helper | Stationary/moving combinations; inclusive 14/16/18 edges and one pixel outside; negative adjustment across a 16 boundary; vertical/horizontal mask selection and ties; byte-coordinate wrap without torus distance; OR masks; self/hidden/inactive/image-ff exclusions |
| Collision integration | NPC against player/NPC/Pikachu; candidate direction set before detection; two NPC slots attempting adjacent/crossing paths; prior slots updated/later slots old; player mask before NPC updates but exact-front after; off-window and pop-in latch cases |
| Trainer lifecycle | Live ordinary winner becomes STAY/NONE without forcing face/resetting delay; rival and Tower exceptions; persisted defeated flag still uses original movement on recreation; already-beaten dialogue does not reapply override |
| Idle metadata | Fresh one-step and far seeds; Y priority; overlap; corner example in §6.1; retained newest appended command differs from last physical movement; follow-completion live facing versus last movement image; ledge tag; ordinary later tag; zero-distance queued target; clear/spawn/script lifecycle |
| Idle timing | First roll after 256 eligible decrements; later glance at 32; masked facing; no RNG before expiry; all four selection values; immediate entry update; durations 17/48/32/32; eight-update frame/turn cadence; 16 countdown after natural completion/abort with same-call ready→idle decrement |
| Idle rendering | Exact reverse bounce table (including negative X side first), no offset accumulation; bounce changes live facing but retains its image facing/frame; abort mid-bounce restores ground; facing/mirroring/frame source; logical positions stay fixed; collision sees screen offset; ordinary happy/unhappy walking remains unchanged |
| Idle guards | Hidden/ineligible/off-window/overlap freezes or suppresses as the corresponding routine does; menus/text/turns do not advance; player step-start antic update then walking abort; abort with queued follow preserves intra-counter byte/equality semantics; script/nurse takeover, fainting and respawn clear offsets; script completion never waits for idle |
| Player obstruction | Turn arms 8; seven eligible blocks then eighth move; no fresh arm allows through; release clears; actual turn rearms; non-Pikachu block does not decrement; B bypasses only following Pikachu; walls/ordinary NPCs still block; disabled following hard-blocks; exact-pixel and hidden cases; simulated/door/ledge regressions |

Extend existing `walk_pace.test.ts`, `overworld_controller.test.ts` and relevant
visibility/spawn tests; add collision/NPC/idle tests beside new pure modules.
At least one render-spy test must exercise the wired follower, and at least one
controller test must exercise the real turn → sprite updates → Pikachu gate
sequence. Helpers passing alone do not prove integration.

From `game/`, run:

```powershell
npm run typecheck
$env:ROM_PATH = 'pokeyellow.gbc'
npm test
npm run build
Remove-Item Env:ROM_PATH
npm test
```

Use these as sequential commands, not a script that continues after a failed
check without inspecting it. Without ROM_PATH the extractor checks skip; do not
mistake skipped extraction for full validation. Run `git diff --check` and inspect
the actual changed paths from the repo root. No setup run is needed for an
engine-only change. Do not edit generated data or a test timeout to make A6c pass.

**Baseline checked while preparing this plan:** typecheck passed. The default
ROM-enabled suite had 569 passes plus a cold static-export 5-second timeout; that
file then passed 6/6 in isolation with `--testTimeout=20000`, and the full suite
passed **570/570 in 23 files** with that CLI override. No code/config changes.
If the known timeout recurs, report it and retry the affected check with a CLI
timeout; do not hide an assertion failure or label the first run clean.

## 10. User play-test and review handoff

The existing user preference is to perform the browser play-test personally.
Provide a short list with concrete maps and expected behavior after automated
checks. Keep the user's `http://127.0.0.1:5173/` save/server intact. If automated
browser investigation becomes necessary, use a spare port and a disposable save;
remove temporary counters/hooks before committing. Do not commit debug buttons,
forced RNG or save manipulation helpers.

Suggested user checks, in order:

1. **Viridian stationary NPC:** after talking, a NONE-facing person eventually
   turns in place; a fixed-facing person returns to its original facing. Neither
   walks away. A slow random zero delay can be about 8.6 seconds, so this is not
   a universal one-second reset.
2. **Route 1 / Forest wanderer:** retain the 34-frame walking pace, face blocked
   terrain, avoid player/other sprites/Pikachu and stay within the screen movement
   boundary. The old two-step origin tether is gone. Timing varies with RNG.
3. **Forest Bug Catcher:** win a talk-initiated battle; after returning he may turn
   at random. Leave the map and re-enter: defeated dialogue persists, but his
   original fixed facing/behavior is restored until another actual battle hook.
4. **Pikachu nearby:** stop and wait; it eventually glances in different directions,
   stays in place and does not flicker under text/menu transitions. A fresh idle
   roll can take about 8.6 seconds; later normal glances take about 1.1 seconds.
5. **Pikachu antics:** test a retained 5..8 command in a deterministic fixture and
   provide a reproducible manual setup if the current ledge/warp paths allow it.
   Do not promise all four will appear just by waiting one tile apart. Watch all
   four frames/offsets in automated render tests; then walk to interrupt a bounce
   and confirm it resumes following without displacement.
6. **Turn into Pikachu:** place it directly behind the player, stop, turn back and
   keep holding the direction. There are seven blocked checks then movement on
   the eighth; release/retry and B/X should follow §7. Walls and other NPCs still
   obstruct while X is held.
7. **Regressions:** Oak's in-step walk; lab shove/exit; the old man's Pikachu
   step-aside; the nurse's Pikachu walk; a normal ledge; START held across a step;
   A6b edge pop-in/UI hiding and a map boundary. A=Z, B=X.

When Claude finishes, append a result note here containing the implementation
commit(s), test commands/counts, browser checks actually performed, differences
from this plan justified by specific ASM, and any remaining work. Update STATUS
to **A6c implemented, awaiting Codex review**, not done/user-verified.

Codex's subsequent review should record the exact reviewed head and compare the
engine diff against baseline `1854ef1`, reread the key ASM routines, verify tests
and integration, and write `notes/11-a6c-review.md`. In particular check:

- No symmetric origin box, extra movement coin flip, unreachable delay values,
  missing fixed-STAY RNG draw or immediate attempt on rest expiry.
- Byte wrap and sprite geometry match instructions; screen edge math uses the
  GB basis without moving the camera; image availability and slot order are
  simulated rather than inferred from rendering or destination reservations.
- Trainer override is live/transient with exclusions and no save/data mutation.
- Idle uses retained command metadata, zero-countdown wrap, immediate entry,
  reverse Y/X table and correct exit dispatch; scripts and ordinary follow pace
  are preserved, with no happiness-dependent antic speed or stale offset.
- Player obstruction blocks seven eligible checks, respects B/terrain/follow
  state, and shares the correct pass ordering; no frame-timer substitution.
- No off-slice data/assets, camera correction, trainer sight rewrite, ROM
  runtime dependency or committed debug hook. A6a/A6b regressions pass.

Resolve review findings before marking the slice done. Record the user's actual
play-test outcome in STATUS afterward; do not infer approval from tests or from
the earlier A6b approval. Next up remains A6c until this handoff is completed.

## A6c result (2026-10-03, Claude Opus 5.5) — implemented, awaiting Codex review

Implemented in one local commit on top of `1854ef1` (message "A6c: …"; find it with
`git log --grep "A6c:"`). Engine and tests only: no extractor, `data/`, `static/`, save
format or dependency change. Not user play-tested yet; no browser automation was run.

**Checks.** `npm run typecheck` clean. `ROM_PATH=pokeyellow.gbc npx vitest run`:
**681/681 in 26 files** (no static-export timeout this time). Without `ROM_PATH`: 610
pass, 71 skip. `npm run build` OK. `git diff --check` clean.

**Where it lives.**

| Plan § | Code | Tests |
|---|---|---|
| 3.1–3.2 NPC bytes, rest, edge, displacement | `walk_pace.ts` `npcDirection`, `npcDisplacement`, `NpcWalk` (live `movement1/2`, `delay`, `dispX/Y`, `vx/vy`); `npc.ts` `canWalk` | `walk_pace.test.ts` (direction table, displacement, NPC block rewritten) |
| 4 collisions | `sprite_collision.ts` (pure); `sprites.ts` `spriteTable`, ordered `updateSprites`; `Player.detectSpriteCollisions`, `checkStep` | `sprite_collision.test.ts`; controller tests for slot order and the player's vector |
| 5 trainer | `Npc.stayAndFaceAnyDirection`, `turnsAfterLosing`; `main.ts` battle finish | controller tests (live, exceptions, reload, after-text) |
| 6 Pikachu idle | `pikachu/pikachu_idle.ts` (pure); `PikachuFollower.updateSprite` / `update`, `followCommand`, image latch, `WalkAnim.tickExact` | `pikachu_idle.test.ts`, `pikachu_follower.test.ts` (render spy) |
| 7 walking into Pikachu | `PlayerWalk.pikachuCollisionCounter`, `pikachuInFront`, `Player.checkStep` | `walk_pace.test.ts`; controller turn → UpdateSprites → gate tests |

**Choices the plan left open, with their ASM basis.**

- *Initialization.* The `Npc` constructor runs `InitializeSpriteStatus` (EnterMap calls
  UpdateSprites once before `OverworldLoop`), so map NPCs are ready on the first pass and
  A6b's pop-in timing is unchanged. `NpcWalk` still starts in `init` for pure use, and
  `Npc.update` runs a pending init before the availability check.
- *In-step NPCs hold* after `DoScriptedNPCMovement` ends instead of entering the STAY
  cycle: `UpdateNonPlayerSprite` keeps routing that slot to `DoScriptedNPCMovement`, which
  returns while not scripting. Only Pallet's Oak uses it, and he is hidden next.
- *Scripted steps keep their vector* at their end (status 1, no `.initNextMovementCounter`),
  so a sprite just after a script still has a nonzero vector until its next try.
- *Pikachu spawn* runs `Func_fc793` at once (the EnterMap UpdateSprites again): image
  hidden until the first pass. `spawnAtState` 0/3 therefore hides Pikachu until the
  player's map position moves off it, where V1b drew it under the player.
- *Pikachu off the window* freezes entirely (`WillPikachuSpawnOnTheScreen` returns before
  the dispatch), image hidden.
- *Direct script movement* (`update()`) resets the idle state on every pass, as
  `Func_fc76a` does while following is disabled (countdown 0, no antic, no offset). The
  nurse's `showPikachu` also calls `stopIdle()`.
- *CheckPikachuFollowingPlayer* is always "following" in this engine: no state keeps a
  visible follower that stops following without a script driving it. The pure rule takes
  the flag; `Player.checkStep` passes `false`.
- *Scripted pushes*: the script controller's `player.update` calls pass no sprite table,
  so the exact-front check sees map NPCs only and Pikachu never obstructs a push (the ASM
  skips all collisions for simulated input; this keeps the existing approximation).
- *Hiding Pikachu* (`visible = false`) resets idle, so a battle or faint leaves no offset.

**Known small deviation (pre-existing, A6b).** `Npc.update` refreshes the image after
the movement update, so a blocked try's new facing shows on the same pass; the ASM's
`CheckSpriteAvailability` refreshes before `TryWalking`, showing it one pass (2 frames)
later. Left as A6b reviewed it.

**Finding — map metadata disagrees with `object_event` bytes** (data, not this slice):
matched by coordinates against `refs/pokeyellow/data/maps/objects/*.asm`, the visible
ones are Route 1 `youngster1` (pret WALK UP_DOWN, data ANY), `youngster2` (WALK
LEFT_RIGHT, data ANY), Viridian Pokécenter `gentleman1` (WALK UP_DOWN, data ANY) and
Viridian City `oldman2` (STAY NONE, data DOWN). Objects with the same kind of mismatch
(Blue's house town map, Oak's Lab ball and Pokédexes, the sleeping old man) are
single-frame sprites, so their facing never shows. Fixing them means `MAP_METADATA` +
`npm run setup`; proposed home: V5 or a small data slice.

**Remaining.** Codex review (`notes/11-a6c-review.md`), then the user's play-test (§10).
A6d keeps the ledge shadow, Pikachu's exact hop and `ApplyPikachuMovementData`.

## Codex review result (2026-10-03) — changes requested

Reviewed implementation **`22919a7`** against engine baseline `1854ef1` and the
pinned Yellow ASM. Typecheck, **681/681** ROM-enabled tests, **610 pass / 71 skip**
without the ROM, and the build pass. The core movement/collision/idle work follows
the plan closely. Four independent probes reproduced two P2 integration gaps:
Pikachu's native whole-sprite UI availability guard is missing (R-1), and an
uncovered antic is not reset by the font-loaded/text/menu entry branch (R-2,
including the nurse's no-move route).

Full evidence, code/source locations, revision instructions and required
regressions are in [11-a6c-review.md](11-a6c-review.md). Claude fixes these, Codex
re-reviews the exact revision, then the user play-tests. No engine changes or
browser play-test were made during this review; A6c remains in progress.

## A6c revision (R-1, R-2) — 2026-10-03, Claude Opus 5.5 — awaiting Codex re-review

One local commit on `47a940e` (`A6c revision: …`; `git log --grep "A6c revision"`).
Engine and tests only, as before.

**Checks.** `npm run typecheck` clean. `ROM_PATH` suite **699/699 in 27 files**;
without it 628 pass, 71 skip. `npm run build` OK. `git diff --check` clean. No browser
run; the user play-tests after the re-review.

**R-1 — Pikachu's UI footprint guard.**

- `sprite_visibility.ts` `pikachuCovered(gbX, gbY, tileAt)`: `.GetNPCCurrentTile` —
  rows `(u8(Y + 4) & $f0) >> 3` and the next, columns `u8(X + 2) >> 3` and the next, any
  tile ≥ $60. Screen pixels include the bounce offset.
- `PikachuFollower.onScreen` (window, then the footprint when the context carries UI
  tiles) runs before every dispatch in `updateSprite` and `fontLoadedUpdate`. Failing it
  only sets the image to $ff: no move, countdown, offset, animation or RNG changes.
  `visible` stays the separate follower eligibility; collision snapshots read the image.
- `render` also tests the footprint against `uiTiles`, from `screenY + 4` (YPIXELS; the
  F-1 camera offset untouched), so the first UI frame never shows a sliver beside a box.
- Ordinary overworld passes carry no UI tiles (no box is up while the map runs), so
  simulation never reads coverage left over from rendering.

**R-2 — the font-loaded transition.**

- `PikachuFollower.fontLoadedUpdate(ctx)` is `SpawnPikachu_` with `BIT_FONT_LOADED`: the
  screen check above, then the movement-status bit 7 branch (`Func_fc745`) or
  `Func_fc76a`:
  - `Func_fc76a`: animation counters cleared, the standing image (hidden if on the
    player's map position), screen position back on the map position when the player
    stands (ends a bounce, finishes a move), ready with countdown 0, then
    `RefreshPikachuFollow` (queue cleared, command reseeded from map positions). A
    retained command below 5 then means a fresh 256-update wait.
  - `Func_fc745` (talking to Pikachu): the controller now calls `requestFacePlayer()`
    (bit 7) instead of turning it directly; the update faces Pikachu opposite the
    player, clears the animation and sets the countdown to A — 0, or $80 when Pikachu
    stands on the grass tile (`WillPikachuSpawnOnTheScreen` leaves its priority byte in
    A). One departure: the ASM keeps an antic's status there; this ends it, since a
    countdown of 0/$80 would index outside `Pointer_fc8d6` (a talked-to Pikachu is on
    exact pixels, so no offset remains either way).
- `overworld/ui_entry.ts`: `overworldUiOpen(state, textBoxActive)` (text boxes — in
  `textbox` or over a running script —, START, the emotion box, shop, PCs, blackboard,
  item/save menus; full-screen menus excluded, as returning from one redraws START and
  runs UpdateSprites again) and `UiEntry`, which reports each closed → open change once.
  `main.ts` `checkUiEntry` runs after every tick: on an opening it draws the UI layer
  (`captureUi(drawUiLayer)`, the same function rendering uses) to register the boxes,
  then `fontLoadedUpdateSprites`. Frames while the UI stays up run nothing; no ordinary
  movement pass is added.
- The nurse: `pokecenter.asm` calls `LoadCurrentMapView`, `Delay3` and `UpdateSprites`
  (font still loaded) before `PikachuWalksToNurseJoy`. `pikachuToNurse` now runs
  `fontLoadedUpdateSprites` with no UI tiles first, so the above-player route that needs
  no steps also leaves no antic; the moving routes then push their targets as before.
- A Pikachu that a box covered mid-bounce keeps bouncing afterwards with its image still
  $ff, because `asm_fc87f` never calls `UpdatePikachuWalkingSprite`; idle redraws it once
  the bounce ends. That is the ASM and is pinned by a test.

**New tests (18).** `sprite_visibility.test.ts`: footprint boundaries (X + 2, Y
alignment, byte wrap, the NPC rule's difference). `pikachu_follower.test.ts` (9): the
review's START fixture (no draw at screen 78/52, drawn when uncovered), a covered pass
freezing everything incl. RNG and collision availability, each antic ending on an
uncovered text box with the 256 wait after, a move finished on its map position, the
talk branch with and without grass, the same-tile case. `ui_entry.test.ts` (4): the
state predicate, the once-per-opening trigger, and the real START menu drawn through
`captureUi` — covered Pikachu frozen, uncovered one reset. Controller tests (4): an NPC
text opening (no extra pass at the interaction, reset at the box, nothing on later text
frames), talking to Pikachu, both nurse routes through `updateScript`.

**Not changed (noted by the review as later work):** NPCs' own `NotYetMoving` under a
font-loaded update (their whole-sprite hiding stays at render, as A6b reviewed it), the
NPC image refresh timing, the map metadata discrepancies.

## Codex re-review (2026-10-03) — R-1/R-2 resolved; R-3 changes requested

Reviewed exact revision **`4d3c407`**. The original START clipping and ordinary
text/nurse reset reproductions are fixed; **699/699** tests, typecheck and build
pass independently. One new P2 interaction regression blocks approval: the real
centered Pikachu portrait covers the follower before its pending turn is served,
and ordinary sprite updates never serve that flag. It reappears facing its old
direction; an unrelated later text can trigger the stale turn. The new test uses
a bottom dialogue box for this interaction and misses the actual coverage.

[11-a6c-review.md](11-a6c-review.md) → *Re-review* records the real-renderer reproduction,
ASM sequence, R-3 locations and focused revision instructions. Claude fixes R-3,
Codex reviews the exact follow-up, then the user play-tests. No engine changes or
browser play-test were made during re-review; A6c remains in progress.

## A6c revision 2 (R-3) — 2026-10-03, Claude Opus 5.5 — awaiting Codex re-review

One local commit on `2eff68a` (`A6c revision 2: …`). Engine and tests only.

**Checks.** typecheck clean; `ROM_PATH` suite **705/705 in 27 files**; without it 634
pass, 71 skip; build OK; `git diff --check` clean.

**Fix.**

- `PikachuFollower.facePlayer` is `Func_fc745`, run by both `updateSprite` and
  `fontLoadedUpdate` right after the screen check whenever bit 7 is pending, as
  `SpawnPikachu_` tests bit 7 before the font and status dispatch. It clears the
  request, sets the countdown to A (0, or $80 on grass, so ordinary contexts now carry
  `inGrass` too), faces opposite the player, clears the animation counters and redraws
  (hidden only when the font is loaded and Pikachu overlaps the player). A covered or
  off-window Pikachu keeps the request for the next eligible update; nothing bypasses
  the coverage check.
- `ui_entry.ts` `openOverworldUi(state, …, captureLayer)` runs one opening in source
  order. For `pikachu_emotion`: first a font-loaded update with no UI tiles
  (`InitializePikachuTextID` sets `wAutoTextBoxDrawingControl`, so
  `DisplayTextIDInit` draws no border), which serves the turn; then the portrait is
  captured and the second update (`PlacePikapicTextBoxBorder`) hides Pikachu under it.
  Other states capture their layer and update once, as before. `main.ts` `checkUiEntry`
  calls it.
- Closing: `CloseTextDisplay` reloads the map view; the next ordinary pass sees no UI and
  redraws Pikachu, already turned. (Its trailing ordinary `UpdateSprites` on every text
  close is not modelled, as before; the facing it restores is the one saved after the
  turn, so it changes nothing here.)
- The `Func_fc745` antic simplification stays: with the real entry order a talk reaches
  it on the bare map, and this engine's tile-based talk check can still pick a bouncing
  Pikachu, whose countdown of 0/$80 would index outside `Pointer_fc8d6`.

**Tests (+6, one replaced).** `ui_entry.test.ts`: the real portrait from all four sides
(turn, hidden under the box, reappears turned, no change on a later unrelated text) and
the 256-update wait after the turn. `pikachu_follower.test.ts`: a request deferred
under START, served by the first uncovered ordinary pass (that pass does nothing else).
The controller's surrogate test now checks the interaction pass leaves the facing alone,
an ordinary pass serves it, and a later text doesn't turn it again.

**User play-test note.** The user reported Pikachu trailing an extra step after a ledge
hop. A controller probe gave identical traces on `1854ef1` and on this code: upstream's
ledge-follow approximation, not A6c. Recorded under A6d in STATUS.
