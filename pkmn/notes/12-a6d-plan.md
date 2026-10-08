# A6d — The ledge hop: shadow, landing, and Pikachu's native follow buffer

2026-10-04 · Claude Opus 5.5 plan; Codex implementation.
**Implemented, awaiting Claude's review (including A6c R-3), then user play-test.**

The user assigned **Sol (Codex) to implement this plan and Claude to review the
implementation**. Leave the implemented slice **awaiting Claude's review**, followed by
the user's play-test (§9). This document is the implementation handoff. It supersedes
`notes/08-a6-plan.md` §2.4 and the A6d row in STATUS.

**Start condition (the user, 2026-10-04):** start now, on top of `9897020` (A6c
revision 2). Codex's separate re-review of A6c is dropped: Claude's review of the A6d
diff also covers A6c's R-3 fix (`notes/11-a6c-review.md` → *Re-review*). The user's A6c
play-test (`notes/10-a6c-plan.md` §10) can run together with this plan's §9. Read `context/STATUS.md` first, then root `CLAUDE.md`, `context/CONVENTIONS.md`,
`src/overworld/ARCHITECTURE.md` and `src/pikachu/ARCHITECTURE.md`. Check the working tree
before starting and keep any later changes the user has made.

## 1. Result and boundaries

A6d makes the ledge hop look and sequence as Yellow does:

1. **The shadow.** A 16×8 ellipse sits under the player's feet for the whole hop. It is
   extracted from the ROM.
2. **The landing pass.** The ASM runs one more `UpdateSprites` before the `Delay3`. We
   skip it today.
3. **Pikachu follows through Yellow's own follow-command buffer**
   (`wPikachuFollowCommandBuffer`), which replaces upstream's buffer of player positions.
   This fixes the user's report (2026-10-03): after a hop, Pikachu now waits on the tile
   the player took off from. On the player's next step it crosses the ledge in one 2-tile
   move, at 4 px a pass and with no arc. Today it lands on the ledge row, then trails a
   step further behind.

**One small data change** rides with the engine code (DECISIONS #35 allows it):
`/gfx/overworld/shadow.png`. The regenerated diff must be that PNG and its `static/`
copy, and nothing else.

Keep the verified A6a–A6c behavior:

- One pass is 2 frames, and steps take 16 frames for the player and Pikachu, 34 for an
  NPC.
- The hop is still an armed collision pass, then 16 passes on the jump table. Both
  halves still report step boundaries, are simulated, and never count steps or roll
  encounters.
- Pikachu still follows one pass behind the player.
- Pikachu's idle glances and antics, its UI hiding, the font-loaded reset and the talk
  turn all stay as they are. They read the follow command, which now comes from the real
  buffer.
- The scripted Pikachu moves (Viridian's step-aside, the walk to the nurse) keep
  upstream's approximation. That approximation now lives in its own queue (§6.6).

**Not A6d:**

- **`ApplyPikachuMovementData`**, Pikachu's scripted-movement interpreter, becomes a new
  slice, **A6e** (decision 1, §11). The A6c plan had given it to A6d.
- **`SFX_LEDGE`** → V5. It isn't extracted.
- **`RunMapScript` at the hop's midpoint** → A1c (decision 3).
- **F-1** (the camera sits 4 px above Yellow's) → its own slice. The shadow is placed
  relative to the player, so it moves with the camera fix later (§4.3).

## 2. Evidence

Primary source: `refs/pokeyellow` master **`e89ead15`**. Line numbers refer to that
revision; the routine names are the stable anchors. Symbols come from pret's sym file
(`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`).

| Behavior | Source |
|---|---|
| Hop setup: flag, two simulated presses, shadow OAM, sound | `engine/overworld/ledges.asm` `HandleLedges`, `LoadHoppingShadowOAM`, `LedgeHoppingShadowOAM` |
| Shadow graphic | `LedgeHoppingShadow` **06:6893–06:689b** (8 bytes, 1 tile 1bpp) = pret `gfx/overworld/shadow.png` (8×8) |
| OAM slots 36–39 kept while the flag is set; slot order | `engine/gfx/sprite_oam.asm` `PrepareOAMData` (`.asm_4a41`, lines 141–150); it runs every VBlank (`home/vblank.asm:38`) |
| The hop's passes and landing | `engine/overworld/player_animations.asm` `_HandleMidJump` (498), `PlayerJumpingYScreenCoords`; `home/overworld.asm` `OverworldLoop` (43–49), `HandleMidJump` (2117) |
| Where a step starts and `Func_fcc08` runs | `home/overworld.asm` `.noDirectionChange` → `CollisionCheckOnLand` → `.noCollision` (228–232) |
| The ledge flag skips collisions | `home/overworld.asm` `CollisionCheckOnLand` (1215), `CheckForJumpingAndTilePairCollisions` (1287) |
| The follow buffer | `engine/pikachu/pikachu_follow.asm` `ClearPikachuFollowCommandBuffer` (1154), `AppendPikachuFollowCommandToBuffer` (1165), `RefreshPikachuFollow` (1175), `ComputePikachuFollowCommand` (1182), `Func_fcc92` (1362, pop), `GetPikachuFollowCommand` (1429), `GetPikachuFollowCommandIfBufferSizeNonzero` (1445), `AreThereAtLeastTwoStepsInPikachuFollowCommandBuffer` (1463) |
| The command the player's step appends | same file: `Func_fcc08` (1257), `Func_fcc23` (1274), `Func_fcc42` (1294), `Func_fcc64` (1324, the bit-6 toggle) |
| How a command executes | same file: `Func_fc7aa` (484), `Pointer_fc7e3` (521), `NormalPikachuFollow` (827), `FastPikachuFollow` (850), `Func_fca0a` / `asm_fca1c` (873, the hop), `DoubleAddPikachuStepVectorToScreenPixelCoords` (921), `ComputePikachuFacingDirection` (1389) |
| A refresh after a scripted Pikachu move | `engine/events/try_pikachu_movement.asm` (`RefreshPikachuFollow` after `ApplyPikachuMovementData`) |

A secondary comparison, `refs/gen1recomp` dev `20ab97ab` `src/world/PikachuFollower.lua`
(around lines 640–720), reads the ASM the same way. Its notes say there is "no arc and
no shadow, the hop command only doubles the step vector", that the hop "fires from the
cell on top of the ledge, a step late", and that "the hop is never a Fast step". Its
`Player.lua` (around 390) puts Yellow's shadow at the sprite's top + 12. Its "far > 1 →
fast" rule is its own approximation. The ASM's rule is in §6.3.

**What the code does today:**

| Current code | Change required |
|---|---|
| `pikachu_follower.ts`: a buffer of player positions; the ledge tile is queued as a separate "pending hop" target with a 10 px sine arc at normal speed; fast whenever ≥1 more is queued; teleports at 16 | The native command buffer (§6). Hops are one 2-tile command at 4 px per update with no arc. Fast only when ≥2 remain after the pop. No teleport |
| `sprites.ts` `recordStepForPikachu`: runs once per hop and queues both tiles | `Func_fcc08` at every step start, including the hop's second half, with the bit-6 toggle |
| `walk_pace.ts` `PlayerWalk`: the landing is a frame delay of 3 added on the last moving pass | A landing pass: the player's sprite update and `UpdateSprites`, then a hold of 1 frame (§5) |
| No shadow anywhere | Extract it, track the ledge flag, draw it (§4) |
| `script_controller.ts` `showPikachu`: puts Pikachu above the player and clears the buffer | Spawn state 5 with a refresh (§6.5). With the native buffer, a bare clear would leave Pikachu two steps behind |
| `script_controller.ts` `movePikachu`: ends without a refresh | `RefreshPikachuFollow` at the end, as `TryApplyPikachuMovementData` does |

**A probe of today's maps** (this session, from `data/maps` + `blockset_overworld.json`):

| Map | Ledge spots | Land on grass | Land on a warp | Land off the map |
|---|---|---|---|---|
| Route1 | 42 | 8 | 0 | 0 |
| Route2 | 52 | 10 | 0 | 0 |
| Route22 | 56 | 9 | 0 | 0 |
| ViridianCity | 36 | 0 | 0 | 0 |

Grass landings exist, so the shadow's layering over grass matters (§4.3). No hop lands
on a warp or crosses a connection, and the midpoint is always the ledge tile itself, so
nothing in today's data can cut a hop between its halves.

## 3. The hop, pass by pass

`a` is the frame of the armed pass. In the "Pikachu" column, Pikachu starts one step
behind the player and the buffer holds `[c]`, the player's previous step.

| Pass | Frame | ASM | Pikachu | Shadow |
|---|---|---|---|---|
| armed | a | `.noDirectionChange`: `UpdateSprites` → `CollisionCheckOnLand` → `HandleLedges` (flag set, 2 simulated presses, shadow OAM, `SFX_LEDGE`) → the ledge tile is impassable → collision | idle update | on from this pass |
| 1 | a+2 | `HandleMidJump` (Y $38). Walk counter 0 → `JoypadOverworld` (simulated press) → `UpdateSprites` → no collision (flag set) → `wWalkCounter` = 8 → **`Func_fcc08` → `Func_fcc64`: bit 6 clear → set it and append 5–8** → first 2 px | idle; pop refused (one entry) | on |
| 2–8 | a+4 … a+16 | `.moveAhead`: `UpdateSprites`, advance | pops `c`: a normal walk to the **takeoff tile**, 8 updates (passes 2–9) | on |
| 9 | a+18 | Walk counter 0 → `JoypadOverworld` (the second simulated press; **`RunMapScript` runs here** → A1c) → `UpdateSprites` → `wWalkCounter` = 8 → **`Func_fcc64`: bit 6 set → clear it, append nothing** → advance | its 8th update: arrives | on |
| 10–15 | … | moving | idle (buffer `[hop]`, one entry) | on |
| 16 | a+32 | `HandleMidJump` leaves the index at 15 (counter ≠ 0, Y stays $3C) → advance → counter 0 → step end (simulated: no count, no encounter; warps/connections checked) | idle | on |
| 17 | **a+34** | `HandleMidJump .finishedJump`: **`UpdateSprites`**, `Delay3` | idle update | on |
| (17 cont.) | **a+37** | clears the joypad bytes, the flag, `BIT_SCRIPTED_MOVEMENT_STATE` and `wJoyIgnore`, then the rest of the pass: `JoypadOverworld`, … | idle update | **off** |
| next | a+39 | the next pass | | |

Then, on the player's next step, the buffer is `[hop, d]` and Pikachu pops the hop. It
moves 2 tiles in 8 updates of 4 px, from the takeoff tile to the landing tile, and ends
one step behind the player. While the player stands still before that, Pikachu idles two
steps behind, with the retained hop command. Under A6c's rules, that makes it eligible
for the antics (`Func_fc803`: command ≥ 5).

## 4. The shadow

### 4.1 Extraction

- `rom_offsets.ts`: `LEDGE_HOPPING_SHADOW = symToOffset(0x06, 0x6893)`, with the comment
  `// LedgeHoppingShadow — 1bpp, 1 tile`.
- `extractors/graphics.ts`: `extractLedgeHoppingShadow(rom)` = `decode1bpp(8 bytes, 1)`,
  registered as `images['/gfx/overworld/shadow.png']` next to `heal_machine.png`. It
  needs no wiring in `index.ts` or the setup script, because `extractRom()` already
  collects this manifest. Confirm that while implementing.
- Run `npm run setup pokeyellow.gbc`. `git diff --stat -- game/data game/static` must show
  only `static/gfx/overworld/shadow.png` as new.
- Tests:
  - `static_export.test.ts`: 519 → **520** images, with a comment line like the V1a
    note.
  - `extraction.test.ts`: the 8×8 image matches pret's `gfx/overworld/shadow.png` pixel
    for pixel. Return early when `refs/` is absent, like the existing Pikachu and
    old-man tests. Its rows are `.....###`, `...#####`, `..######`, `.#######`,
    `.#######`, `..######`, `...#####`, `.....###` (`#` = set = black).

### 4.2 The flag: when the shadow shows

The shadow mirrors `BIT_LEDGE_OR_FISHING`:

- It is set on the armed pass.
- It is still set through all 16 moving passes, the landing pass, and the landing pass's
  hold.
- It is cleared when the landing's continuation runs. That is the next player pass at
  a+37, or `Player.finishLanding()` (§5).

`cancel()` clears it too. Warps and connections call `cancel()`. No hop in today's maps
reaches one (§2 probe).

This is an OAM object, not a sprite-state sprite. The A6b/A6c visibility rules (the
window, UI coverage) don't apply to it.

### 4.3 Drawing and layering

**Position.** OAM (Y 88, X 72) is screen (64, 72), two 8×8 tiles: the tile, then its X
mirror at x + 8. In Yellow that is the player's sprite top ($3C = 60) + 12: the lower
half of the player's step square. It stays fixed on screen while the map scrolls under
it. In our coordinates, draw it at `x = player.x − camX`, `y = player.y − camY + 8`. Our
player sprite is drawn at `player.y − camY − 4`, so this keeps Yellow's +12 and inherits
F-1's 4 px, which the camera slice will fix for both.

**Palette.** Load it like the player's sheet: `loadSprite('/gfx/overworld/shadow.png')`,
inside `Player.loadSprite()`, so every map's palette reload picks it up. Set bits become
OBJ colour 3 through OBP0. Clear bits are transparent.

**Layering.** These are hardware rules, and they matter on the grass landings:

- OAM 36/37 come after every sprite's entries, so **any sprite pixel beats the shadow**.
- Its attribute is 0, with no BG-priority bit, so **the shadow is above every map tile,
  grass included**.
- When the player's opaque pixel overlaps the shadow, the hardware picks the player's
  pixel first. That pixel's grass priority then decides between the player and the
  grass. So a player pixel hidden by grass still hides the shadow there.

Implementation:

- Add `Player.renderLedgeShadow(camX, camY)`. `main.ts` calls it in the general
  overworld render branch, right after the player's `renderGrassOverlay` (and before
  the heal and "!" overlays).
- Compose the 16×8 shadow on a small offscreen canvas.
- Punch out the player's current frame (same frame and flip as `Player.render`, drawn
  at offset `(0, −12 + hopOffset)`) with `destination-out`.
- Draw the result scaled. The result: the shadow shows over grass, the player covers it,
  and grass over the player's feet stays over them.
- Only the player can overlap the shadow (Pikachu is ≥ 1 step behind; NPCs can't stand
  in the player's square). Say so in the code comment rather than masking every sprite.

## 5. The landing pass

`PlayerWalk` gets two pieces of state: `ledge` (the flag above) and `landingPending`.

- **The last moving pass (16)** stays as today: `finishedStep`, `landedHop`, the step-end
  checks. It no longer adds the 3-frame delay. It sets `landingPending`.
- **The next `pass()` call is the landing pass:**
  - `spriteUpdate()` runs. With the walk counter at 0, `UpdatePlayerSprite` uses
    `wPlayerMovingDirection`, still the hop's direction, so the walk animation ticks
    once more.
  - Then `updateSprites()` runs.
  - Then `landingPending` clears, and `Player` asks for a hold of
    `HOP_LANDING_FRAMES − FRAMES_PER_PASS` = **1** frame through `takeFrameDelay()`.
  - The pass reads no input and starts nothing.
  - Expose it as `Player.isLanding`. `isBusy` includes it; `isMoving` doesn't, because
    the walk counter is 0 and NPCs see a standing player.
- **The continuation** is the next pass, at a+37: `PassClock` holds 1 frame, then its
  normal pair. That pass clears `ledge` at its start, then runs as an ordinary standing
  pass. The script push path calls `Player.finishLanding()` when it sees the push done
  (§7), because its next command may not run a player pass for a while (a text box).
- **Gates in the callers.** While `player.isLanding`, these must not run on the landing
  pass:
  - `main.ts`'s `runMapScript` + `readJoypad` (the overworld branch, ~1120);
  - START;
  - the Pikachu A-press check in `updateOverworld` (it uses `!player.isMoving` today and
    must use `!player.isBusy`);
  - the script controller's `readJoypad` for moves.

  `JoypadOverworld` only comes after `Delay3`.
- **Frame check:** the armed pass at a, `updateSprites` at a+2 … a+32 (16 calls), the
  landing `updateSprites` at **a+34**, the next standing pass's `updateSprites` at
  **a+37**, and the next pass at **a+39**. Today the standing pass is also at a+37. The
  only change is the extra update at a+34.

Hard-reset paths (`cancel()`) clear `landingPending`, `ledge`, the hop and the arming.

## 6. Pikachu: the native follow buffer

### 6.1 A pure module: `pikachu/follow_buffer.ts`

Port the buffer exactly. It is 16 bytes, and a size byte holds the **index of the newest
entry**, $ff when empty.

| Operation | ASM | Rule |
|---|---|---|
| `clear()` | `ClearPikachuFollowCommandBuffer` | empty (size $ff) |
| `append(cmd)` | `AppendPikachuFollowCommandToBuffer` | size+1, store at that index |
| `pop()` | `Func_fcc92` | **refused (null) with 0 or 1 entries**; otherwise returns entry 0, shifts the rest down by one, size−1 |
| `newest` | `GetPikachuFollowCommand` | entry[size], or 0 when empty |
| `newestQueued` | `GetPikachuFollowCommandIfBufferSizeNonzero` | entry[size] when size ≥ 1, else 0 |
| `fast` | `AreThereAtLeastTwoSteps…` (after the pop) | size ≥ 2, i.e. ≥ 3 entries remain |

Entry 0 is the command Pikachu executes next. With one entry it stays, retained: the
command A6c's idle code reads.

**Overflow.** The ASM never checks bounds. Appending past 16 entries would write into the
WRAM after the buffer. That can't be reproduced, and in normal play it can't happen
(Pikachu drains the buffer as fast as the player fills it; §8 pins this). Cap the buffer
at 16: ignore further appends, with a one-time `console.warn`. Document the cap as a
guard, not a behavior.

`followCommandFor`, `commandFacing` and `seedFollowCommand` in `pikachu_idle.ts` already
implement `Func_fcc42` / `Func_fcc64`'s values, `Pointer_fc7e3`'s facing and
`ComputePikachuFollowCommand`. Reuse them.

### 6.2 What a player step appends: `Func_fcc08`

- `PikachuFollower.playerStepStarted(dir, ledge)`:
  - Without the ledge flag, append `followCommandFor(dir, false)` (1–4).
  - With it, run **`Func_fcc64`'s toggle literally:** a private `hopToggle` (bit 6 of
    `wPikachuOverworldStateFlags`). If it is clear, set it and append
    `followCommandFor(dir, true)` (5–8). If it is set, clear it and append nothing.
  - The toggle isn't saved, and nothing else resets it. That reproduces the ASM's stale
    bit if a hop is ever cut between its halves.
- **Call sites.** `Func_fcc08` runs wherever the loop sets `wWalkCounter` to 8: every
  ordinary or simulated step, and **each half of a hop**.
  - `PlayerWalk` gets `startedFollowStep` (exposed by `Player`): true on any pass that
    starts a step, on the hop's first moving pass (1) and on the pass that starts its
    second half (9). The second half is detected when the hop's progress is exactly
    `STEP_PX` before the pass's advance.
  - `recordStepForPikachu(player, follower)` becomes `if (player.startedFollowStep)
    follower.playerStepStarted(player.direction, player.ledgeHopFlag)`.
  - Its callers keep their `visible` gate (`Func_fcc23`). Each caller that keys on
    `player.justStartedStep` today switches to the new flag: `overworld_controller.ts`
    (door exit, normal update) and `script_controller.ts` (push, guard step, free
    movement, scripted moves).
  - The blackout deferred spawn still keys on `justStartedStep`.
- The append happens after `player.update()` returns, which is after that pass's
  `UpdateSprites`. So Pikachu still pops one pass later, as today.

### 6.3 Executing a command: `Func_fc7aa`

In `updateSprite` (the `UpdateSprites` path), when no move is under way and no antic
runs:

1. **Pop.** If refused, idle in the same update (`jp c, Func_fc803`), as today.
2. Set the facing to `commandFacing(cmd)` and the step vector ±1 on one axis
   (`Pointer_fc7e3`).
3. **A hop (5–8):** the map position moves **2 steps at once**: `mapStepX/Y` report the
   target while moving, which is already how they work. Then **8 updates of 4 px** (32
   px), never fast and with no arc (`Func_fca0a` → `asm_fca1c`).
4. **A walk (1–4):** the map position moves 1 step, then:
   - **fast if `fast`** (≥ 2 left after the pop): 4 updates of 4 px;
   - otherwise 8 updates of 2 px.
5. Every update ticks the happiness-paced animation (`tickExact`, unchanged), refreshes
   the image, and sets the collision vector (±1).
6. **The first update moves in the same call** as the pop, as today.
7. When the move ends, reset the vector and set the live facing with
   `followEndFacing(buffer.newestQueued !== 0, buffer.newestQueued, …)`
   (`ComputePikachuFacingDirection`). Zero the idle countdown, as today.

Moves interpolate along one axis only. Upstream's diagonal interpolation stays only on
the scripted-target path (§6.6).

### 6.4 Refresh: `RefreshPikachuFollow`

`refreshFollow(playerMapStep)`: `clear()`, then
`seedFollowCommand(pikachuMapStep, playerMapStep)`, and append it unless it is 0 (they
overlap). It replaces the inline clear + seed in:

- `refresh()` (`spawn`, `spawnAtState`; `Func_fc793` after a spawn);
- `fontLoadedUpdate()` (`Func_fc76a`).

A seed of 2 steps gives 5–8, so a START menu opened after a hop keeps Pikachu's pending
hop.

### 6.5 Everywhere Pikachu is placed must refresh

With the native buffer, Pikachu replays commands. A placement without a refresh leaves
an old or empty buffer, and Pikachu ends up the wrong distance behind for good.

- **`showPikachu`** (`script_controller.ts`, after the Pokécenter heal): use
  `spawnAtState(player.x, player.y, player.direction, 5)`. State 5 is above the player,
  facing down (`pikachu_spawn.ts`), and `EnablePikachuOverworldSpriteDrawing` + spawn
  state 5 is what the ASM does. It replaces the hand-set x/y/direction + `clearBuffer()`
  + `stopIdle()`. Keep `visible = true` and the `pokecenterHealHidPikachu` bookkeeping.
- **`movePikachu`'s end:** after setting the final facing, `refreshFollow(player map
  step)` (`TryApplyPikachuMovementData` → `RefreshPikachuFollow`).
- Grep for every other write of `pikachuFollower.x/y` or `direction` outside the
  follower. Each must be followed by a spawn or refresh, or be justified in a comment.

### 6.6 The scripted stand-ins keep their own queue (until A6e)

`pushPosition` / `update()` / `bufferLength` are upstream's stand-in for
`ApplyPikachuMovementData`: the Viridian step-aside and the walk to the nurse.

- Move them to a separate `scriptTargets` queue: `pushScriptTarget(x, y, hop)`,
  `scriptMoving`.
- Keep their current interpolation, speed and **the sine arc, for script hops only**.
  The nurse hop is a real hop in `pikachu_movement.asm`; A6e ports it.
- `update()` consumes `scriptTargets` only. `updateSprite()` consumes the follow buffer
  only.
- Update `script_controller.ts`'s two waits (the step-aside's
  `!isMoving && bufferLength === 0`, the nurse's) to the new names.
- Delete `recordPlayerPosition`, `setLedgeHopPending`, `pendingLedgeHop`, the position
  buffer and the 16-entry teleport.

### 6.7 What changes on screen besides the hop

- Pikachu catches up at 4 px only when it is **three or more steps** behind, where
  upstream did it at two. In ordinary walking it never falls behind, so this is rare.
- No teleport.
- Straight walks and turns must trace exactly as before (§8, regression test).

## 7. Implementation sequence and file ownership

1. `pikachu/follow_buffer.ts` + tests (pure).
2. `pikachu_follower.ts`: the buffer, `playerStepStarted`, the execution in §6.3,
   `refreshFollow`, the `scriptTargets` split, and no arc on follow hops. Update
   `pikachu_follower.test.ts` and `pikachu_idle.test.ts` for the new API.
3. `walk_pace.ts` / `player.ts`: `ledge`, `startedFollowStep`, `landingPending` /
   `isLanding` / `finishLanding()`, the 1-frame hold, `cancel()`. Update the
   `walk_pace.test.ts` hop test.
4. `overworld/sprites.ts` `recordStepForPikachu`, and the callers in
   `overworld_controller.ts` / `script_controller.ts`.
   - The push completion (`scriptPush.started && !player.isBusy`) calls
     `player.finishLanding()`.
   - Make `showPikachu` and `movePikachu` refresh.
5. `main.ts`: the landing gates (§5) and the shadow render call.
6. Extraction: the offset, the extractor, the manifest, setup, and the two extraction
   tests. Check that the regenerated diff is exactly the one PNG.
7. `Player.renderLedgeShadow` + its load in `Player.loadSprite()`.
8. Docs:
   - `src/overworld/ARCHITECTURE.md` (*Pace*, the landing pass, the shadow);
   - `src/pikachu/ARCHITECTURE.md` (the follow buffer);
   - root `CLAUDE.md` (the *Overworld movement pitfalls* line "Pikachu follows from
     `player.stepStartX/Y`" becomes "Pikachu follows the native command buffer (A6d)";
     add `follow_buffer.ts` to the module map; the test counts);
   - STATUS.

Commit locally when verified (one commit, or verified checkpoints named `A6d (1/n)`).
Never push.

## 8. Deterministic verification

New and updated tests, with no browser:

**Buffer (`follow_buffer.test.ts`):**
- the empty, one, two and three-entry states;
- pop refused at 0 and 1 entries;
- pop returns entry 0 and shifts;
- `newest` / `newestQueued` at every size;
- `fast` exactly at ≥ 3 remaining;
- the 16-cap guard.

**`Func_fcc08` / `Func_fcc64`:**
- no flag → 1–4;
- with the flag, half 1 appends 5–8 and half 2 nothing;
- a hop cut after half 1 leaves the toggle set, and the next hop then appends on its
  second half only.

**Player (`walk_pace.test.ts` / a controller test with a `PassClock` harness):**
- `startedFollowStep` on passes 1 and 9 of a hop and on every ordinary step;
- `ledge` from the armed pass until the continuation;
- the frame list in §5 (a+2 … a+32, a+34, a+37, a+39) with `updateSprites` counted;
- the landing pass ticks the walk animation, reads no input and skips the map script;
- `cancel()` mid-hop clears everything.

**Pikachu through the real controller** (`overworld_controller.test.ts`'s `world()`
fixture, a ledge mocked as in the existing hop test):
- **The user's report, inverted.** Per pass: Pikachu reaches the takeoff tile by pass 9,
  never stands on the ledge tile, and holds `followCommand` = 5 after landing. On the
  next step it moves 4 px an update for 8 updates and arrives on the landing tile one
  step behind the player.
- **No arc:** a render spy shows the drawn y = base y on every update of the follow hop.
- A turn after landing (sideways step): the hop runs first, then Pikachu follows the
  side step.
- Two ledges in a row: Pikachu stays two behind after each landing and catches up with
  the next step.
- **START after landing:** `fontLoadedUpdate`'s refresh seeds 5, and the next step still
  hops.

**Regression:**
- A 30-step scripted path with turns, no ledges: Pikachu's map position after each
  player step equals the player's previous step position. Its pixel trace per pass
  equals today's (record it from the current code before changing it).
- A 200-step random walk keeps ≤ 2 entries.
- The A6c idle, antic, UI, talk and font-loaded tests all pass, adjusted only for API
  names.

**Scripts:**
- `showPikachu` → state 5 and a refresh; after two player steps Pikachu is exactly one
  behind.
- `movePikachu` → refreshed at the end.
- The nurse hop still arcs.

**Extraction:** §4.1.

**Shadow render** (spy):
- two draws at `(player.x − camX, player.y − camY + 8)` and +8 x, the second mirrored;
- only while the flag is set;
- drawn after the player's grass overlay;
- the player's opaque pixels are punched out.

Then:
- `npm run typecheck` clean;
- `ROM_PATH=pokeyellow.gbc npm test`, with the new total recorded;
- `npm test` without the ROM;
- `npm run build`;
- `git diff --check`.

## 9. User play-test and review handoff

After Claude's review, the user plays at `http://127.0.0.1:5173/`. The A button is
**Z** (X is B). Debug overlay: backtick → Skip Intro (Pikachu) → warp to Route 1 or
Route 22.

1. **Route 1 ledges, Pikachu following.** Hop down a ledge.
   - The shadow, a black oval at the feet, stays under you for the whole hop and
     disappears just after you land.
   - Pikachu stops on the tile you jumped from (not on the ledge), waits there, and on
     your next step slides over the ledge in one quick move, with no bounce. It ends one
     step behind you.
2. **Stand still after a hop** for ~10 s. Pikachu, two steps back, may do one of its
   antics (bounce, walk in place, shuffle, spin).
3. **A grass landing** (Route 1 has eight). The shadow shows on top of the grass.
4. **Hop, then turn sideways right away.** Pikachu hops, then follows the turn.
5. **Hop, then open START, close it, walk.** Pikachu still hops.
6. **Ordinary walking and turning** look exactly as before.
7. **Viridian's locked Gym door push** (it hops the ledge): the shadow appears, and the
   text and flow are unchanged.
8. **A Pokécenter heal,** then walk off: Pikachu is one step behind, not two.
9. **The old man's walk-away with the Pikachu step-aside** (a save after the Pokédex):
   Pikachu then follows you normally.

**Review handoff:** Sol leaves A6d *implemented, awaiting Claude's review* in STATUS,
with the commit hash and the exact test counts. Claude reviews the diff against this
plan and the ASM anchors, then hands the §9 list to the user.

## 10. Found on the way: homes

| Finding | Source | Home |
|---|---|---|
| `ApplyPikachuMovementData` is a full interpreter (`pikachu_movement.asm`, ~1000 lines: its own step table, sine jumps, its own shadow tile `LedgeHoppingShadowGFX_3F` 3f:583d). Users in today's maps: Viridian's step-aside (`ViridianCity_2.asm`), the walk to the nurse (`PikachuWalksToNurseJoy`), **Oak's Lab** `OaksLabPikachuMovementScript` (`OaksLab.asm:506`, two variants, **missing from our port entirely**), and the emotion box's movement commands (`StarterPikachuEmotionCommand_movement`) | as listed | **A6e** (new, decision 1) |
| `RunMapScript` runs at the hop's midpoint (pass 9), so trainer sight and triggers can fire on the ledge tile. Our map script hook skips moving passes. No trigger in today's maps sits on a ledge tile | `home/overworld.asm` 1579 `JoypadOverworld` | **A1c**, with N-3 (`notes/09-a6b-review.md`) |
| Trainer sight today runs at the step end of pass 16, *before* the landing. In the ASM it runs in the map script, after the landing. No current map sets `sightRange` | `home/overworld.asm`, A1c plan | **A1c** |
| The armed pass plays `SFX_LEDGE`, then `CollisionCheckOnLand` asks for `SFX_COLLISION` in the same pass. Which one is heard depends on the audio engine's SFX priority | `ledges.asm`, `home/overworld.asm` 1255–1262 | **V5** (SFX catch-up) |
| `wPikachuOverworldStateFlags` bit 6 and other Pikachu flags aren't saved. Saving mid-hop is impossible (START is blocked), so nothing observable is lost | — | none |

## 11. Decisions: reply "go" to take all three recommendations

1. **Split `ApplyPikachuMovementData` off into a new slice, A6e?** **Recommended: yes.**
   - It is a separate ~1000-line interpreter with four users already on our maps,
     including Oak's Lab's Pikachu step, which we don't have at all.
   - A6d stays focused on the hop and the follow buffer, and fits one Sol session.
   - A6 becomes five slices. The milestone count stays 36.
2. **Port Yellow's follow-command buffer for all following, not just patch the hop?**
   **Recommended: yes.**
   - The hop is wrong because the follower has upstream's model, not Yellow's. The
     buffer is what makes Pikachu wait at the takeoff tile and cross the ledge one step
     late.
   - It also brings Yellow's catch-up rule (double speed only at three or more steps
     behind) and drops upstream's teleport.
   - The alternative, a hop-only patch on the position buffer, would leave A6c's idle
     code reading a mirrored command byte instead of the real one.
   - Ordinary walking is checked to trace exactly as before (§8).
3. **Leave `RunMapScript` at the hop's midpoint, and trainer sight after the landing, to
   A1c?** **Recommended: yes.** A1c moves trainer sight into that same map-script hook.
   The probe shows no trigger in today's maps can fire on a ledge tile, so nothing
   visible changes before then.

Already settled, not a question: Sol implements and Claude reviews (the user,
2026-10-04).

## Implementation result — 2026-10-04, Codex

Implementation commit **`4166071`** (`A6d (1/2)`); `A6d (2/2)` records the review handoff.

Implemented all three O-11 recommendations (DECISIONS #38). The shadow extraction,
OAM composition and mask, landing update and hold, native follow buffer, hop-half
toggle, refresh placements and script-target split are in place. Native follow hops
have no arc; scripted nurse hops keep theirs for A6e.

Verification: typecheck and production build clean; **729/729** with `ROM_PATH`,
**657 pass / 72 skip** without it; `git diff --check` clean. Added 24 tests including
the exact +34/+37/+39 timing, both command starts, takeoff wait, eight flat 4px updates,
two ledges, sideways turn, START refresh, script push and healing, buffer overflow guard,
stale hop toggle and shadow composition. The shadow matches pret's PNG pixel for pixel.
The ordinary 30-step path's 240 pixel samples match the original committed follower
(SHA-256 `3d29d4e59b91a7a6e3442f9222b0e08c9522ee96fceaeece35a9ea79e5eb63c4`);
a seeded 200-step path never holds more than two commands. The temporary baseline
module and probe were removed.

Setup exports **520 PNGs, 3 tilemaps, 164 JSON**. Only the new
`game/static/gfx/overworld/shadow.png` changes in generated output; no JSON changes.
The shadow is loaded from committed assets at runtime, with no ROM dependency.

**No browser play-test performed or claimed.** Claude reviews A6d and A6c's R-3 fix
on `9897020`, then the user runs §9 together with A6c's §10. SFX, camera correction,
midpoint scripts/trainer sight and the scripted-movement interpreter keep their stated
homes. See STATUS for the implementation commit and review handoff.
