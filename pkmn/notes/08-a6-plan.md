# A6 — Overworld pace per the ASM: probe results + plan

2026-09-27, Claude Opus 5.5. **Status: A6a done — code 2026-09-28, user-verified in the
browser 2026-10-01 (see *Progress*). A6b done 2026-10-01 — reviewed
(`notes/09-a6b-review.md`) and user-verified (see *A6b result*). A6c and A6d done and
user-verified 2026-10-04 (`notes/10-a6c-plan.md`, `notes/12-a6d-plan.md`, reviews beside them).
A6e (Pikachu's scripted movement) is next; Sol plans it.**
**2026-10-03: A6c's detailed, ASM-reprobed handoff is `notes/10-a6c-plan.md`.
Claude Opus implements it; Codex reviews afterward. No A6c engine code yet.**
The plan was approved "go" (DECISIONS #36).
A6 is new (DECISIONS #35): the A1 research found that the overworld moves at 2× the Game
Boy's speed (`notes/07-a1-plan.md` §1.6). The user asked for it first: "pls do walking speed
first".

**Sources:** `refs/pokeyellow` @ `e89ead15`:
- the loop and the player: `home/overworld.asm`,
  `engine/overworld/advance_player_sprite.asm`, `engine/overworld/player_animations.asm`
  (`_HandleMidJump`, `PlayerJumpingYScreenCoords`), `engine/overworld/ledges.asm`;
- NPCs and animation: `engine/overworld/movement.asm`, `data/sprites/facings.asm`,
  `engine/overworld/auto_movement.asm`;
- Pikachu: `engine/pikachu/pikachu_follow.asm`;
- battles and encounters: `engine/battle/init_battle.asm`,
  `engine/battle/wild_encounters.asm`, `engine/battle/end_of_battle.asm`;
- cutscenes: `scripts/PalletTown.asm`, `OaksLab.asm`, `ViridianCity.asm`.

Compared with gen1recomp (`src/world/Player.lua`, `NPC.lua`, `PikachuFollower.lua`).

Upstream code read: `overworld/player.ts`, `npc.ts`, `pikachu/pikachu_follower.ts`,
`overworld_controller.ts`, `script/script_controller.ts`, `main.ts` (`gameTick`,
`runDueTicks`), and the story scripts.

## TL;DR

- **The overworld has two clocks.**
  - Text, waits, fades, audio and battles count **frames**. These are right since
    DECISIONS #33.
  - Everything that moves in the overworld counts **passes** of the overworld loop, and
    one pass is 2 frames.
  - Upstream runs everything once per frame, so everything that moves goes too fast.
- **What moves, per the ASM:**

  | Who | ASM | Upstream (at 59.7 ticks/s) |
  |---|---|---|
  | Player | 2 px per pass: **16 frames per step** | 2 px per tick: 8 frames (2×) |
  | Pikachu | 2 px per pass: **16 frames per step**; catch-up 4 px per pass | 8 frames (2×) |
  | NPC, normal walk | 1 start pass + 16 × 1 px: **34 frames per step** | 8 frames (4×) |
  | NPC, Yellow's fast codes (`$04`–`$07`) | 1 start pass + 8 × 2 px: **18 frames per step** | — |
  | NPC walking in step with the player (Oak to the lab) | 2 px per pass: **16 frames** | — |
  | Ledge hop | 2 steps with the jump height table: **32 frames**, then 3 more | 16 frames, a sine arc |

- **Four slices:**
  - **A6a — the pace** (what you asked for): all of the above, the walk animations, and
    every cutscene walk re-timed against its ASM.
  - **A6b — the order inside a pass:**
    - map triggers run before input, which fixes the held-key trigger bugs;
    - sprites pop in at the screen edges;
    - NPCs keep facing you after a talk;
    - two encounter rules: turning in place in grass rolls an encounter, and there are no
      encounters for 3 steps after a battle.
  - **A6c — NPC wandering and turning:** how far they roam, turning at random, and beaten
    trainers spinning.
  - **A6d — ledge hop details:** the shadow and Pikachu's hop.
- **4 decisions (§4)**, each with a recommendation. Reply **go** to take all four.

## Progress

### A6a — done: code landed 2026-09-28, user-verified 2026-10-01

**2026-10-01:** the user played every item of "Still to verify" below: "all 8 points
work perfectly".

Approved "go" (DECISIONS #36). The code is committed and tested, but not every cutscene
has been played yet. The next session finishes §2.1's verify list before claiming A6b.

**What landed:**
- **`overworld/walk_pace.ts`** (pure; 26 tests in `walk_pace.test.ts`):
  - `PassClock`;
  - `PlayerWalk` (the loop's player: 2 px a pass, the turn rule, `UpdateSprites` call
    points, bumps, the ledge hop with the jump table);
  - `NpcWalk` (`UpdateNPCSprite`'s statuses: normal, fast and in-step modes, the start
    pass, the lead-in, the terminator pass, wanderers' 1–256 pass rests, no step start
    while the player is mid-step);
  - `WalkAnim` (`Func_5274`, the mirrored up/down frame) and Pikachu's
    happiness-dependent animation period.
- **The classes that draw use it:** `Player`, `Npc` and `PikachuFollower` (one update per
  pass; a step starts and moves in the same update). `overworld/sprites.ts` holds
  `updateSprites()` (`UpdateSprites`) and `recordStepForPikachu()` (from the step's
  start position).
- **Input** (`input.ts`): `readJoypad` / `syncJoypadRead` / `isPassPressed`. The overworld
  reads the joypad on standing passes; menus and text boxes read it every frame.
- **`main.ts`:** the pass clock for `overworld` / `script` / `trainer_approach`; START
  only on standing passes; `Delay3` after a hop lands.
- **Scripts:** movement only on passes, with `UpdateSprites` running (everyone moves, as
  in the ASM's loop). `moveNpc` `modes`; `moveParallel` gets `npcInStep`, `npcModes` and
  `playerFromNpcStep`.
  - **Pallet:** Oak walks to the lab in step.
  - **Oak's Lab:** the rival's shove is one parallel walk (DOWN, then fast RIGHT ×3; the
    player's two RIGHTs start once he has begun his last step,
    `wNPCNumScriptedSteps == 1`). His exit after the battle is 2 normal steps, then fast.
- **Held-key triggers are fixed:** the next step now starts on the pass after one ends,
  so Viridian's `cancelMovement` / `forgetPlayerStep` workaround is gone, and Pallet's
  and Oak's Lab's triggers no longer let a held key carry the player on.

**Verified so far:**
- Typecheck clean; **502/502**; build OK.
- **Measured in the browser:** holding LEFT gave 2 px a pass, a new step every 8 passes,
  33.5 ms a pass, **15.99 frames a step**, and one turning pass first.
- **The user played it:** "he walks at a perfect, gb speed".
- **The user found a bug, now fixed:** "oak BOLTS" — Oak's legs flickered while walking
  to the lab. I had drawn the in-step frame from the intra counter, following pret's
  comment in `AdvanceScriptedNPCAnimFrameCounter`. That code reads offset `$8`, which is
  `SPRITESTATEDATA1_ANIMFRAMECOUNTER`: the normal frame. A test now pins it. **The fix
  hasn't been re-played yet.**

**Still to verify (next session):**
- Oak's walk to the lab again, after the fix.
- The Oak's Lab intro, the shove and the rival's exit.
- The old man's walk-away and Pikachu's step-aside.
- The nurse and Pikachu's walk to her; the Mart parcel walk; door exits.
- A ledge on Route 1.
- NPC and Pikachu pace, measured the same way as the player's (34 / 16 frames).
- START held across a step.

**Correction to §1.2:** the turn rule is not "only from a standstill". The ASM turns
whenever `wCheckFor180DegreeTurn` is set and the new direction isn't
`wPlayerLastStopDirection`. A pass with nothing pressed sets the flag, and only a turn
clears it. So after starting a walk in the last stop direction (no turn), the first
change of direction mid-walk still takes a turning pass; later changes don't.

**Found while building A6a** (logged in STATUS):
- **Pikachu's idle antics** (`pikachu_follow.asm` `Func_fc803`): while you stand still it
  faces a random direction every 32 passes, and sometimes hops, walks in place or spins.
  → A6c. **Refined 2026-10-03:** fresh zero countdown wraps for 256 updates;
  antics depend on the retained follow command and include a separate shuffle.
  Exact timing and guards: `notes/10-a6c-plan.md` §6.
- **Walking into Pikachu:** it blocks you for 8 passes after a turn (holding B lets you
  straight through, `wPikachuCollisionCounter`, `CollisionCheckOnLand`). → A6c.
  **Refined 2026-10-03:** armed 8 means seven blocked eligible collision checks,
  then the eighth can pass; B bypasses only the following Pikachu, not terrain.
  See `notes/10-a6c-plan.md` §7.
- **The ledge hop's steps are simulated**, so they don't count as steps (`StepCountCheck`)
  and can't start an encounter. Upstream counts the hop as one step and rolls on landing.
  → A6b.
- **Pikachu's scripted moves** (the step-aside, the nurse) run
  `ApplyPikachuMovementData`, a frame-driven engine with hops and shadows. They keep
  upstream's approximation at pass pace. → A6d.
- **Oak's Lab logic departures** (not timing):
  - the rival's Pokédex-scene exit should repeat his entry's step count (upstream: 8
    downs);
  - the player should turn to watch the rival leave after the battle;
  - the shove happens only when the player is at y = 4.
- **Cutscene waits and bubbles** upstream invented: many `wait` 10/15/20s, and "!" for
  30–40 frames where `EmotionBubble` holds 60. → a cutscene timing audit (new; see
  STATUS).

## 1. Probe results

### 1.1 The pass (`home/overworld.asm`)

- `OverworldLoop` calls `DelayFrame` twice before it does anything (lines 43–46), so **one
  pass = 2 frames**.
- **Walking passes** go through `jp nz, .moveAhead` → `UpdateSprites` →
  `AdvancePlayerSprite` → `CheckMapConnections`, and back to `jp OverworldLoop` (line 663).
- **Standing passes** go through `JoypadOverworld` → `RunMapScript` → joypad → A/START →
  direction handling → `UpdateSprites` → back to `jp OverworldLoop`.
- **`UpdateSprites` runs once per pass.** It moves every NPC and Pikachu one update.
- **While a text box, menu or script `DelayFrames` is running, the loop is blocked.**
  Sprites don't update during it; only the frame count advances.

### 1.2 The player

- **A step** takes 8 passes of 2 px (`wWalkCounter` = 8, step vector doubled with
  `add a`): **16 frames**.
  - Held continuously, a new step starts in the pass after the last one ends, and moves
    in that same pass, so there's no gap.
  - The player's map coordinates change only at the end of the step
    (`_AdvancePlayerSprite`).
- **Turning** only happens from a standstill.
  - A new direction there costs one pass: `BIT_TURNING`, then `jp OverworldLoop`.
  - The gate is `wCheckFor180DegreeTurn`, which is set only on a pass with nothing
    pressed. So changing direction while walking continuously costs nothing.
  - Upstream takes a turn tick on **every** direction change.
- **The turn pass also calls `NewBattle`**, so turning in place in grass rolls a wild
  encounter (§1.7, A6b).
- **Walk animation:** `Func_5274` runs once per `UpdateSprites`. Every 4 calls, the
  animation frame advances through 0–3.
  - Frames 0–3 are *stand, walk, stand, walk mirrored* for up and down
    (`WalkingDown2` / `WalkingUp2` are x-flipped), and *stand, walk, stand, walk* for
    left and right.
  - The player makes 8 calls per step, so a step shows one walking frame and the
    mirrored one comes on the next step: **the feet alternate**.
  - Stopping resets the counters.
  - Upstream shows 4 phases per step with the same unmirrored walking frame every time.
- **Bumping into a wall:** each pass with the direction held animates the walk in place
  (`UpdatePlayerSprite` `.moving`). `CollisionCheckOnLand` replays `SFX_COLLISION`
  whenever it isn't already playing.
- **Door exit step and scripted player moves** (`StartSimulatingJoypadStates`) are
  ordinary steps, 16 frames each.

### 1.3 NPCs — three ways to walk

1. **Normal** (`movement.asm`), used by random walkers and by `MoveSprite` with
   `NPC_MOVEMENT_*` codes:
   - **The start pass:** `TryWalking` sets the facing, moves the NPC's *map* position at
     once (`Func_5349`), sets a 16-count walk counter and status 3, but doesn't move a
     pixel.
   - **The walk:** the next 16 passes move 1 px each (`UpdateSpriteInWalkingAnimation`).
     That's **17 passes = 34 frames per step**; gen1recomp rounds it to 32.
   - **Waiting for the player:** a new step can't start while the player is mid-step
     (status 1: `ret nz` on `wWalkCounter`).
   - **Random walkers** then wait a random 0–127 passes (0 counts as 256). Upstream
     waits 60–180 ticks.
2. **Fast** (Yellow only, `Func_5288` → status 4, `Func_5357`): movement codes `$04`–`$07`
   (down, up, left, right). A start pass, then 8 passes of 2 px: **18 frames per step**.
   Oak's Lab uses them for the rival shoving you from the Eevee ball (`$07` ×3) and
   for his exit (`$04` ×5).
3. **In step with the player** (`DoScriptedNPCMovement`, `auto_movement.asm`): 2 px per
   pass, for "when the player is following the NPC somewhere": Oak's walk to the lab
   (later, the Pewter Museum and Gym guides).

- **NPC walk animation:** `Func_5274` runs on each moving pass, so an NPC shows all four
  frames (stand, walk, stand, walk mirrored) within one step. Upstream draws 4 phases
  per step with no mirrored frame.

### 1.4 Pikachu (`pikachu_follow.asm`)

- **Normal follow:** walk counter 8, and each update adds the step vector twice, so 2 px
  per pass: **16 frames per step**, the player's pace.
- **Fast follow** (catching up): counter 4, 4 px per pass.
- **Hop** (`Func_fca0a`): counter 8, 4 px per pass, 32 px. That's A6d.
- **Pikachu's walking animation depends on its happiness**
  (`GetPikachuWalkingAnimationSpeed`). At happiness 80 or more the frame advances every
  2 updates; below 80, every 5. Upstream animates Pikachu like everyone else.

### 1.5 Ledge hop (`ledges.asm`, `player_animations.asm`)

- **The hop itself:** `HandleLedges` simulates two ordinary steps (16 passes). Each pass,
  `_HandleMidJump` sets the player's screen Y from `PlayerJumpingYScreenCoords`: $38, $36,
  $34, $32, $31, $30, $30, $30, $31, $32, $33, $34, $36, $38, $3C, $3C.
- **The landing:** once the hop ends, it runs `UpdateSprites` and then `Delay3`.
- **The shadow:** during the hop, two 8×8 tiles (`gfx/overworld/shadow.1bpp`) sit fixed
  at screen tile (9, 11). Upstream has no shadow and uses a 10 px sine arc.
- **The sound:** `SFX_LEDGE` plays, which V5 covers.

### 1.6 Cutscene walks in the game today (A6a re-times each)

| Cutscene | ASM | Mode |
|---|---|---|
| Pallet: Oak walks up to you | `PalletTown.asm:98` `MoveSprite` + `FindPathToPlayer` | normal |
| Pallet: Oak lines up with you, you step left | `auto_movement.asm` `PalletMovementScript_OakMoveLeft` / `_PlayerMoveLeft` | Oak normal, then the player (simulated) |
| Pallet: the walk to the lab | `PalletMovementScript_WalkToLab` | Oak in step (2 px per pass), player simulated |
| Oak's Lab: Oak enters | `OakEntryMovement` (UP ×3) | normal |
| Oak's Lab: the rival shoves you from the Eevee ball | `$00`, `$07` ×3 | normal down, then fast right |
| Oak's Lab: the rival walks up for the battle | `FindPathToPlayer` → `MoveSprite` | normal |
| Oak's Lab: the rival leaves | `NPC_CHANGE_FACING`, down, `$04` ×5 | fast down |
| Oak's Lab: the Pokédex scene, the rival walks up and leaves | `MoveSprite` (lines 522, 609) | normal |
| Oak's Lab: "Don't go away yet!", the Viridian pushes | `StartSimulatingJoypadStates` | player steps |
| Viridian: the old man walks away | `ViridianCityOldManMovementData1/2` | normal |
| Pikachu stepping aside, Pikachu to the nurse | `pikachu_movement.asm` scripts | Pikachu's own pace (checked in A6a) |
| Door exit step | `PlayerStepOutFromDoor` | player step |

- **23 scripted moves** in `story/*.ts` and `overworld_controller.ts` use `moveNpc`,
  `movePlayer`, `moveParallel`, `pushPlayer`, `movePikachu` and `pikachuToNurse`.
- **Structural difference:** upstream's script engine runs one move command at a time.
  The ASM often moves an NPC while the player waits or walks.
- A6a re-times each move by its mode, and makes moves concurrent where the ASM's are.
  Anything wrong beyond timing (paths, texts) gets logged, not fixed.

### 1.7 Loop behaviour for A6b and A6c

- **Map scripts run before input.** A trigger fires before a held direction starts the
  next step, which fixes STATUS's held-key trigger bugs in Pallet and Oak's Lab. Trainer
  sight (A1c) needs the same order.
- **The player's map coordinates change at the end of a step.** So sprites that scroll
  into view during a step stay hidden until the next standing `UpdateSprites`: they
  **pop in** at the screen edges. A sprite outside the window (4 steps up, down or left,
  5 right) is never drawn (`CheckSpriteAvailability`).
- **Talking to an NPC:** `DisplayTextIDInit` turns the NPC to face you, then saves that
  as its "original" facing and restores it when the text closes. So the NPC keeps
  facing you. A fixed-facing STAY NPC turns back only when its random delay runs out.
  Upstream turns it back after 120 ticks.
- **Wandering** (`CanWalkOntoTile`):
  - how far: up to 8 steps up or left of the start, unlimited down or right (a
    displacement check Yellow disabled), and **never off the visible screen**;
  - sprites block each other (`DetectCollisionBetweenSprites`);
  - `Func_5337` sets the facing before the walk check, so a STAY NPC turns in place;
  - upstream: ±2 steps, never turns.
- **Beaten trainers turn at random** (`SetEnemyTrainerToStayAndFaceAnyDirection`).
- **Encounters:**
  - **Turning in place rolls.** The turn pass runs `NewBattle` →
    `DetermineWildOpponent` → `TryDoWildEncounter`, so turning in grass can start a
    battle (a Gen 1 quirk).
  - **Three calm steps after a battle.** `end_of_battle.asm:74` sets
    `BIT_WILD_ENCOUNTER_COOLDOWN`; `EnterMap` gives 3 steps with no encounter, and
    `StepCountCheck` counts them down.
  - Upstream has neither.

## 2. The plan

Each slice ends with verify, a STATUS update and a local commit.

### 2.1 A6a — The pace (engine only)

1. **The pass clock** (`core/overworld_pass.ts`, pure and tested).
   - The overworld's moving parts advance on every second tick: the player, NPCs,
     Pikachu, scripted moves and the camera.
   - Text, `wait`, fades, the audio clock and battles keep running every tick.
   - The first pass after entering the overworld comes after 2 frames, as `jp
     OverworldLoop` does.
2. **Player** (`player.ts`):
   - 2 px per pass;
   - a turn pass only from a standstill (`wCheckFor180DegreeTurn`);
   - bumps animate per pass, and `SFX_COLLISION` replays when it has ended;
   - the walk animation per `Func_5274`, with mirrored up/down walking frames;
   - the ledge hop per the jump table over 16 passes, then `Delay3`;
   - the door exit step and pushes are ordinary steps.
3. **NPCs** (`npc.ts`):
   - the three modes from §1.3, with the start pass;
   - a normal NPC doesn't start a step while the player is mid-step;
   - random walkers wait 0–127 passes (0 = 256);
   - the 4-frame animation per step.

   Their bounds and turning stay upstream's until A6c.
4. **Pikachu** (`pikachu_follower.ts`): 2 px per pass, catch-up 4 px per pass, and the
   happiness-dependent animation speed.
5. **Scripts** (`script_controller.ts` + `story/*.ts`):
   - `moveNpc` gains a mode (normal, fast, in step);
   - every row of §1.6 is ported with its mode and concurrency;
   - `wait` keeps counting frames.
6. **Tests** (pure, no browser):
   - frames per step for the player (16), a normal NPC (34), a fast NPC (18), an in-step
     NPC (16) and Pikachu (16), plus Pikachu's catch-up;
   - the turn rule;
   - the animation frame sequence over two steps, with mirroring;
   - the jump table;
   - the random delay's range.
7. **Verify:**
   - Typecheck, the full suite and the build.
   - **Measured in the browser** with a temporary counter, removed before the commit:
     frames per step for each mover, and the tick rate still 59.7.
   - **Each cutscene** of §1.6 played through: Oak's walk to the lab, the lab scenes, the
     old man, the nurse, door exits, a ledge on Route 1.
   - **Then your play-test.** Does it feel like the Game Boy?

### 2.2 A6b — The order inside a pass, sprites, encounters (engine only)

> **Superseded by §5 (2026-10-01)**, which re-probes this slice after A6a and refines
> it. A6a already fixed the held-key triggers. The original sketch is kept below.

- **The ASM's order inside a pass:** map script and triggers, then joypad, A/START,
  direction and turn, `UpdateSprites`, advance, and the step-complete checks.
  - This fixes the held-key triggers in Pallet and Oak's Lab, and replaces Viridian's
    `cancelMovement` workaround.
- **Sprite visibility:** the ASM's image-index rule with the pop-in. Off-window sprites
  aren't drawn.
- **Talking to an NPC:** it faces you and keeps facing you. Upstream's 120-tick restore
  goes.
- **Encounters:** the turn roll and the 3-step cooldown after a battle.
- **Tests and browser checks:**
  - the trigger/held-key cases;
  - the pop-in, with a trainer at the edge;
  - an NPC keeps its facing after a talk;
  - the cooldown after a battle.

### 2.3 A6c — NPC wandering and turning (engine only)

> **Superseded by `notes/10-a6c-plan.md` (2026-10-03).** The handoff re-probes this
> sketch against A6b's committed code and Yellow ASM, adds the deferred Pikachu
> idle/collision work, and defines tests and the Claude → Codex review workflow.
> Fixed-facing turn-back was already completed in A6b. Original sketch below.

- **How NPCs roam** (`CanWalkOntoTile`): the displacement limits, never off the screen,
  and sprites blocking each other.
- **Turning:** STAY/NONE NPCs turn at random, and fixed-facing ones turn back when their
  delay runs out.
- **Beaten trainers spin** (`SetEnemyTrainerToStayAndFaceAnyDirection`).
- **Tests;** the browser check is Viridian's and the Forest's NPCs, and a beaten Bug
  Catcher.

### 2.4 A6d — Ledge hop details

> **Superseded by `notes/12-a6d-plan.md` (2026-10-04).** The handoff adds the landing
> pass's extra `UpdateSprites` and the shadow's layering. It replaces upstream's
> position buffer with Yellow's follow-command buffer, which fixes the user's ledge
> report, and proposes moving `ApplyPikachuMovementData` to a new A6e. Original sketch
> below.

- **The shadow:** extract `gfx/overworld/shadow.1bpp` and draw it at screen tile (9, 11)
  during a hop. This is a data change riding with its engine code, as DECISIONS #35
  allows; the regenerated diff must be that one PNG.
- **Pikachu's hop** (`Func_fca0a`).
- **Browser check:** Route 1's and Route 22's ledges, with Pikachu.

### 2.5 Order and size

- **A6a:** 1–2 sessions. It's the largest, because every cutscene gets checked.
- **A6b:** 1 session. **A6c:** original estimate 1; the expanded 2026-10-03 plan
  includes pixel collisions and Pikachu idle behavior, so use verified checkpoints
  if needed and keep A6c incomplete until all of it is implemented/reviewed.
  **A6d:** less than 1.
- **Then A1a → A1b → A1c.** A1c needs A6a and A6b.

## 3. Found on the way — not A6

| Finding | ASM | Proposed home |
|---|---|---|
| A hop plays `SFX_LEDGE`, which isn't extracted (not in `SFX_HEADERS`) | `ledges.asm` `HandleLedges` | V5 (SFX catch-up) |
| Grass priority: the ASM sets it by the tile the sprite **stands on** (`wGrassTile`, lower half only); upstream overlays grass tiles on both rows a sprite covers. Probably equivalent on real maps; to confirm | `movement.asm` `.notInGrass`, `facings.asm` `UNDER_GRASS` | check during A6b |

## 4. Decisions

1. **Split A6 into A6a (pace), A6b (pass order, sprites, encounters), A6c (NPC
   wandering and turning), A6d (ledge hop details)?** **Recommended: yes.**
   - A6a is the fix you asked for, and it's big enough alone: it touches every cutscene.
   - The rest are separate behaviours, each with its own checks.
2. **Model the pass itself, so positions change every 2 frames as on the Game Boy, rather
   than halving speeds per frame?** **Recommended: the pass.**
   - It's what the hardware shows: 2 px every 2 frames for the player, 1 px every 2 for
     NPCs.
   - The ASM's turn, bump, animation and trigger timings are all counted in passes, so
     they port as they are.
   - Halving would move more smoothly than the original, and would need fractional
     pixels for NPCs.
3. **Do A6a, A6b, A6c and A6d back to back, then A1a–c?** **Recommended: yes.** A1c needs
   A6a and A6b. A6c and A6d are small and fix the same overworld you play-test every
   slice. The alternative is A1 right after A6b, with A6c and A6d before V2.
4. **In A6a, port every cutscene walk with the ASM's mode and concurrency, rather than
   only changing speeds?** **Recommended: yes.** Changing the speeds alone would make
   the cutscenes that mix modes fall out of step: the rival's fast shove, Oak's walk
   beside you. Wrong paths or texts found on the way get logged, not fixed.

Reply **go** to take all four, or answer by number.

*(Answered 2026-09-27: "go" — DECISIONS #36.)*

## 5. A6b — probe results + plan (2026-10-01)

Re-probed after A6a, from `home/overworld.asm` (`OverworldLoop`, `JoypadOverworld`,
`StepCountCheck`, `NewBattle`, `CheckWarpsNoCollision`), `engine/overworld/movement.asm`
(`UpdateNPCSprite`, `CheckSpriteAvailability`, `MakeNPCFacePlayer`, `CanWalkOntoTile`,
`UpdateSpriteMovementDelay`), `engine/menus/display_text_id_init.asm`,
`home/text_script.asm` (`CloseTextDisplay`), `engine/battle/wild_encounters.asm`,
`engine/battle/init_battle.asm`, `engine/battle/end_of_battle.asm`,
`engine/events/poison.asm`, `engine/overworld/clear_variables.asm`,
`home/npc_movement.asm`, `scripts/PalletTown.asm` and `scripts/OaksLab.asm`. Code read:
`overworld_controller.ts`, `npc.ts`, `sprites.ts`, `player.ts`, `battle/encounter.ts`,
`map.ts` `isGrassTile`, and `main.ts`'s overworld pass.

### 5.1 What A6a already settled

- **Held-key triggers:** fixed by A6a. The next step starts on the pass after one ends,
  so `handleStepComplete`'s triggers already run before any held direction moves the
  player on. Viridian's workaround is gone.

### 5.2 Probe results

**1. Map scripts run on every standing pass, before input.** `JoypadOverworld` calls
`RunMapScript` and then `Joypad`. A coordinate trigger therefore fires:
- on the standing pass after the step ends, not inside it;
- also when the player is standing still, for example right after a battle, a text box
  or a warp. Trainer sight (A1c) is a map script too (`CheckFightingMapTrainers`).

Ours checks the three triggers (Pallet, Viridian, Oak's Lab) once, in `handleStepComplete`.
Pallet's also needs `direction === 'up'`, which `PalletTownDefaultScript` doesn't check:
it only tests `wYCoord == 0` and `EVENT_FOLLOWED_OAK_INTO_LAB`.

**2. The step-end order.** The last moving pass of a step runs, in this order:
1. `StepCountCheck`: counts the step, and the encounter cooldown, unless inputs are
   simulated;
2. `ApplyOutOfBattlePoisonDamage` (poison is A3), which also runs
   `UpdatePikachuHappinessAndMood`;
3. `NewBattle`: the wild encounter roll;
4. `CheckWarpsNoCollision`, then `CheckMapConnections`.

Ours runs warps, triggers, connections, the encounter and then happiness.

**3. Pikachu's walking happiness departs three ways** (`UpdatePikachuHappinessAndMood`):
- The step counter `wStepCounter` is reset on every map entry (`ClearVariablesOnEnterMap`),
  so the bonus needs 256 steps **on one map**. Ours counts across maps.
- It fires only on a 50% roll. Ours always fires.
- **Every step moves the mood 1 toward 128.** Ours never does.

**4. Wild encounters** (`TryDoWildEncounter`, `DetermineWildOpponent`):
- **No encounter** while the game moves the player (scripts, the door exit), during a
  ledge hop, on a door or warp tile, or on the step just outside the map.
- **The tile** is the bottom-left tile of the step (screen tile 8,9). Ours checks the same
  one (`isGrassTile` → `tileY + 1`).
- **Indoor maps with wild data roll on any tile**, except the FOREST tileset (Viridian
  Forest, Safari Zone). No map extracted today needs this (the caves start at V4). It can
  be unit-tested now.
- **The turn roll:** a turning pass calls `NewBattle`, so turning in place in grass can
  start a battle.
- **The cooldown after a battle is 2 calm steps, not 3.**
  - `end_of_battle.asm` sets `BIT_WILD_ENCOUNTER_COOLDOWN`. `EnterMap` then sets 3 steps.
  - `StepCountCheck` counts down **before** `NewBattle` in the same pass. So the third
    step's count reaches 0, clears the flag, and that step can already roll.
  - Every map entry while the flag is set resets the count to 3.
  - Turning in place doesn't count down, and can't roll while the count is non-zero.
- Ours has no cooldown and no turn roll.

**5. The ledge hop.** It is two simulated steps (`HandleLedges`), so:
- neither step counts (`StepCountCheck`);
- neither can start an encounter (`IsPlayerCharacterBeingControlledByGame`, and the
  `wMovementFlags` ledge bit);
- warps and connections are checked after each step.

Ours models the hop as one 32 px move: one step-end check on landing, one encounter roll
and one happiness count.

**6. Sprite visibility** (`CheckSpriteAvailability`, every `UpdateSprites`):
- **The window:** a non-scripted sprite is drawn only within 4 steps up, down or left of
  the player, or 5 right. That is exactly the screen while standing.
- **The pop-in:** the window uses the player's map coordinates, which change only at the
  end of a step. The image is also only refreshed when the player isn't walking. So a
  sprite that scrolls into view during a step appears on the next pass; it doesn't slide
  in. A scripted sprite skips the window test.
- **Hidden under a text box or menu:** a sprite with **any** of its four tiles on a
  text-box or menu tile (tile id ≥ `$60`) is hidden whole. `DisplayTextIDInit` runs
  `UpdateSprites` right after drawing the box. So an NPC half under the START menu
  vanishes, where ours draws it and lets the menu cover part of it.
- Ours draws every NPC everywhere.

**7. Talking to an NPC:**
- `MakeNPCFacePlayer` turns it.
- `DisplayTextIDInit` then saves every sprite's *current* facing as its original, and
  `CloseTextDisplay` restores it. So the NPC **keeps facing you**.
- **A fixed-facing STAY NPC turns back** the next time its movement cycle runs:
  - status 1 → `TryWalking` sets its map facing → `CanWalkOntoTile` refuses
    (`MOVEMENTBYTE1 = $ff`);
  - → status 2 with a delay of `Random & $7f` passes (0 = 256) → status 1 again.
  - So it turns back within 1–256 passes (up to about 8.5 s), and not while the player
    is mid-step.
- Ours turns it back after 60 passes (upstream's 120 frames).
- The random turning of STAY NPCs facing `NONE` uses the same cycle. That part stays in
  A6c.

**8. Grass priority (§3), checked:** the ASM sets a sprite's grass priority from the tile
it stands on (`wGrassTile`), and only for its lower half (`UNDER_GRASS`). Ours overlays
grass on the sprite's lower half, judged by tile. On Route 1, Route 2, Route 22 and the
Forest the two agree. Nothing to change.

### 5.3 The plan

1. **A map-script hook per standing pass** (`main.ts`, before `readJoypad`). It gets a
   `runMapScript()` that returns an action or null.
   - Pallet's, Viridian's and the Oak's Lab triggers move into it, on their ASM conditions
     (Pallet: `y == 0`, no facing check).
   - `handleStepComplete` keeps only the step-end checks.
   - Trainer sight moves into the hook in A1c.
2. **The step-end order of §5.2-2**, as a pure function with tests:
   - step count → happiness and mood → the encounter roll → warps → connections;
   - the walking happiness of §5.2-3: the counter reset on map entry, the 50% roll, and
     the mood moving 1 toward 128.
3. **Encounters** (`battle/encounter.ts` + the controller):
   - `TryDoWildEncounter`'s conditions;
   - the indoor rule, unit-tested;
   - the turn roll;
   - the 2-step cooldown, with the reset on map entry.
4. **The ledge hop:** after each half, the warp and connection checks only. No step
   count, no roll.
5. **Sprite visibility** (`npc.ts` + `sprites.ts`):
   - the window, and the pop-in from the image refresh;
   - scripted sprites exempt;
   - hidden whole when any tile is under a text box or menu.

   The visibility rule is a pure predicate with tests.
6. **Talking:** the NPC keeps facing you. STAY NPCs with a fixed facing run the status
   1 ↔ 2 cycle, so they turn back after their random delay. Upstream's 60-pass timer goes.
7. **Tests** for all of the above, then typecheck, the full suite and the build.
8. **Browser checks (your play-test):**
   - Pallet's Oak, the Oak's Lab rival and Viridian's old man still trigger, also when
     walking into them with the key held.
   - Walking toward a townsperson, they pop in at the screen edge instead of sliding in.
   - Open START with an NPC just left of the menu's edge: it disappears whole.
   - Talk to a fixed-facing NPC (a Pokécenter or Mart customer): they keep facing you,
     then turn back after a while.
   - Turning in place in Route 1's grass can start a battle.
   - After a wild battle, the first two steps in grass never start one.
   - Hop a Route 1 ledge: no battle on landing.

**Size:** 1 session, maybe 2. The pieces are small, but they touch `main.ts`'s pass,
the controller, `npc.ts` and the encounter code.

### 5.4 Decisions — ✅ all four answered yes (2026-10-01, DECISIONS #37)

The user said yes to all four on 2026-10-01: "mark those 4 decisions as yes". Implement
§5.3 as written, all four included. The implementer is Sol 6.1, and Claude reviews the
result before the slice is called done.

1. **Move the three map triggers into a per-pass map-script hook, as the ASM runs them,
   rather than keeping them at step end?** ✅ **Decided: yes.** **Recommended: yes.** A1c needs the hook for
   trainer sight anyway. It also gets the details right: triggers fire when you stand
   still, and Pallet's has no facing check.
2. **Fix Pikachu's walking happiness and the per-step mood drift in A6b?**
   ✅ **Decided: yes.** **Recommended: yes.** They run in the step-end function A6b rewrites, and each is a few
   lines with a test. The alternative is logging them for a Pikachu slice.
3. **Bring the fixed-facing NPCs' turn-back (the status 1 ↔ 2 cycle) forward from A6c?**
   ✅ **Decided: yes.** **Recommended: yes.** Otherwise, between A6b and A6c, NPCs you talk to would keep
   facing you until the map reloads. Random turning (`NONE`) and wandering stay in A6c.
4. **Hide sprites under text boxes and menus (the START menu edge) in A6b?**
   ✅ **Decided: yes.** **Recommended: yes.** It is the same `CheckSpriteAvailability`
   routine as the pop-in, and visible in every play-test. The alternative is logging it
   for J2's audit.

### 5.5 Notes for the implementer

- **Read first:** root `CLAUDE.md` → *Engine reference* (especially *The overworld pass*
  and *Overworld movement pitfalls*), `game/src/overworld/ARCHITECTURE.md` → *Pace*, and
  `CONVENTIONS.md` → *The session contract*. Read the ASM routines named in §5 before
  writing each piece. Where this note and the ASM disagree, the ASM wins: say so in the
  result.
- **gen1recomp was refreshed** on 2026-10-01 (`78a3defa` → `20ab97ab`). This plan's
  comparisons were made at `78a3defa`. Since then its `src/world/OverworldController.lua`,
  `PikachuFollower.lua` and `Player.lua` have changed, so cross-check against the new
  versions where useful. pret still wins on any disagreement.
- **Engine only.** No extractor or `data/` change is expected. If one turns out to be
  needed, stop and log it.
- **Baseline:** typecheck clean and `ROM_PATH=pokeyellow.gbc npm test` at **502/502**.
  The new tests raise that number; record the new count.
- **Keep A6c's part out:** random turning for `NONE`-facing STAY NPCs, the wander limits
  and beaten trainers spinning all stay in A6c. Trainer sight stays where it is until
  A1c.
- **Don't fix what you only find.** Log anything off-plan in STATUS → *Notes for later*
  with a proposed home.
- **Finish:** a result section here (*A6b result*), STATUS updated, and a local commit
  (never pushed). Leave the browser checks of §5.3-8 for the user's play-test, and leave
  A6b marked "awaiting review" until Claude has reviewed the diff.

## A6b result — 2026-10-01, Codex — ✅ done

**Closed 2026-10-01:** Claude's final review passed (`notes/09-a6b-review.md`), and the
user played every §5.3-8 check: "all working well".

Implemented §5.3, with all four §5.4 decisions included. Engine only: no extractor,
`data/`, `static/`, ROM, reference repo or curated sprite changes.

- `main.ts` runs `runMapScript()` before `readJoypad()` on standing overworld passes.
  Pallet, Viridian and the lab triggers moved out of step end. Pallet checks exactly
  y=0 and FOLLOWED_OAK_INTO_LAB, without facing or GOT_STARTER gates; the lab checks
  y=6 exactly. Trainer sight remains at its existing call site for A1c.
- `overworld/step_end.ts` holds the tested order: count → Pikachu → encounter → warp
  → connection. The byte step counter, the 256-step coin flip and mood convergence
  are wired into the controller. Walking's bonus requires a healthy party Pikachu;
  its `$80` mood-table entry leaves mood alone, so the ordinary drift remains one unit.
- `battle/encounter.ts` checks controlled movement, movement flags represented by
  door exits/hops, door/warp tiles, off-map steps, disabled encounters and cooldown
  before rolling. Grass/water use the bottom-left tile; non-FOREST indoor maps can
  roll anywhere. Turning rolls without counting. Every battle return, including
  catch demos, arms 3 before StepCountCheck: the first two steps cannot roll, the third can.
- Both hop halves report a boundary at passes 8 and 16. They check warps/connections
  without step count, mood, happiness or encounters, including the scripted Gym-door
  push. Door exit steps are also simulated. A6d's shadow and follower hop are untouched.
- NPCs use the 4-up/down/left, 5-right window and stable player map coordinates. Hidden
  images stay latched until a standing update; scripted sprites skip the window.
  Canvas UI draws once to a transparent layer first and records tile coverage; an NPC
  with any footprint tile under a menu/text box is omitted whole before UI compositing.
- The 60-pass restore timer is gone. Talk-facing persists. Fixed-facing STAY sprites
  run the ready/resting cycle with `Random & $7f` (zero means 256), and wait for the
  player to stand before trying again. NONE turning, wandering and trainer spinning
  remain A6c.

**ASM clarifications, taking precedence over the plan's shorthand (§5.5):**

1. `ClearVariablesOnEnterMap` and the active-cooldown reset run on **EnterMap**: warps,
   Continue/new game and battle returns. `CheckMapConnections .loadNewMap` bypasses
   EnterMap, so seamless connections **preserve both counters**. The "256 steps on
   one map" wording in §5.2-3 excludes this connection exception; battle returns reset
   the step counter even when staying on the same map.
2. `ModifyPikachuHappiness`'s WALKING mood byte is `$80`, an immediate return. Upstream
   nudged mood even for WALKING; this slice corrects that event only. The coin flip
   still consumes a random byte if Pikachu is fainted/absent, but no bonus is applied.
   `ApplyOutOfBattlePoisonDamage` skips the walking mood update when the party is empty.
3. `DoScriptedNPCMovement` writes IMAGEINDEX on every update, including mid-step.
   Oak's in-step animation therefore keeps advancing; the ordinary pop-in latch
   does not freeze his legs. A regression test pins the rendered walking frame.

Cross-checked the refreshed gen1recomp Player, NPC, PikachuFollower and relevant
OverworldController paths; pret remains authoritative (its counter/reset and delay
rules are used where the implementations differ).

**Interim review:** Claude's `notes/09-a6b-review.md` appeared during implementation.
R-1 is fixed: the NPC menu-footprint check converts our scene's sprite Y to GB
YPIXELS (+4); four render tests cover START's bottom edge with/without the Pokédex.
The wider 4px camera offset (F-1) remains for a separate slice. N-1 is fixed
(Indigo Plateau is outdoor), N-4's catch-demo cooldown is verified against
`_InitBattleCommon` → `EndOfBattle`, and N-2/N-3/N-5 are logged in STATUS with homes.
The review file remains untouched; this final version still requires re-review.

**Verification:** typecheck clean; ROM-backed suite **570/570 across 23 files**
(68 added tests); production build OK; `git diff --check` clean. The tests cover the
pure order/counters/visibility rules, actual controller turns/steps/hops/door exits,
stationary and held-key story triggers, NPC rendering and in-step animation, fixed
STAY delays, indoor/FOREST/water conditions, and the UI layer's context/compositing.
Without ROM_PATH: **499 pass, 71 extraction/static-export tests skip**.

**Still required:** Claude reviews the diff, then the user plays every §5.3-8 check.
These browser checks were deliberately left to the user as §5.5 directs. A6b is
awaiting review, not marked done. Then continue with A6c, one slice at a time.
