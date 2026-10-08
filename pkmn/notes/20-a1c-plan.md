# A1c — Trainer sight

**2026-10-06 · planned by Claude Opus 5.5. Planning only; no code yet.**

Start from **`9f3cd81`** (A1b done and user-verified, then the CLAUDE.md slim-down). A1c is the
last of A1's three slices (DECISIONS #35). It replaces `notes/07-a1-plan.md` §2.4, which was
written before A6 existed, and takes over the carry-overs DECISIONS #38 left here: sight after the
landing, map scripts at the hop's midpoint, and N-3 (`notes/09-a6b-review.md`). The user picks the
implementer; the recommendations in §9 are proposed, not settled.

**Approved 2026-10-06:** the user said "go", taking all seven recommendations (DECISIONS #43).
The user then asked Claude to implement it ("pls implement yourself"). **Implemented 2026-10-06; see §10.**

Sources: `refs/pokeyellow` @ `e89ead15`. Line numbers are the named file's.

## TL;DR

- **Sight is a map script.** The Forest's `w<Map>CurScript` table is
  `CheckFightingMapTrainers` → `DisplayEnemyTrainerTextAndStartBattle` → `EndTrainerBattle`. It
  runs from `JoypadOverworld` on every pass where the player stands, before the joypad is read.
  So the check happens on every standing pass: after text, battles and warps, and after a
  ledge landing. It never runs mid-step. Today ours checks only at step end, by tile distance,
  and no map sets `sightRange`, so none of it runs.
- **The geometry is `TrainerEngage`'s, in 8-bit screen pixels.** The trainer must be on screen
  (its image index isn't `$ff`) and on the player's row or column, within `sight × 16` pixels,
  facing the player from in front. The 8-bit math gives two quirks, and both stay:
  - a trainer facing down can't see exactly 4 steps (`$fc`);
  - a trainer at the window's 4-step edge spots a walking player one step closer (pop-in).

  A6's sprite table already has every input: screen bytes, the visibility latch and the facing.
- **Spotting** runs entirely inside that one pass:
  1. the meet music starts;
  2. the "!" stays up 61 frames, everything frozen;
  3. `UpdateSprites` runs;
  4. the walk-up is set up through `MoveSprite`, at NPC pace, ignoring collisions;
  5. the rest of the pass runs, with the joypad masked.

  Once the walk has ended, the next pass shows the text. The battle starts as the text closes,
  and the first pass after the battle runs `EndTrainerBattle`, which checks no sight.
- **The input lockout isn't total**, and A1c ports it exactly:
  - **When the trainer walks**, every button is ignored (`MoveSprite_` sets `wJoyIgnore` to
    `$ff`).
  - **When the trainer is adjacent**, only the d-pad is ignored. `BIT_SEEN_BY_TRAINER` stops
    START, signs, sprites and Pikachu. Hidden events and bookshelves are checked before that
    gate, so A still finds them.
- **Found:**
  - **A trainer that spots you mid-hop strands you on the ledge tile.** `MoveSprite_`
    overwrites the hop's second simulated press. Nothing can reach this until V4 (Route 3), so
    decision 1 defers the midpoint hook behind a tripwire test.
  - **The walk-up must keep the trainer's movement status, as `MoveSprite` does.** Our
    `startScript` always forces a resting pass (decision 2).
  - **Battle returns skip `EnterMap`'s `UpdateSprites`**, so a trainer could spot you one pass
    late after a wild battle (decision 3).
  - **Pallet's and Oak's Lab's "!" bubbles are too short** (decision 5).
- **7 decisions (§9)**, each with a recommendation. Reply **go** to take all seven.

## 1. What the cartridge does

### 1.1 When sight runs

`OverworldLoop` (`home/overworld.asm:43`): `HandleMidJump`, then, if `wWalkCounter` is 0,
`JoypadOverworld` (1579), which runs `RunMapScript` (1711) **before** `Joypad`. The Forest's map
script (`scripts/ViridianForest.asm:1`) is `ExecuteCurMapScriptInTable` over:

| `wViridianForestCurScript` | Routine (`home/trainers.asm`) |
|---|---|
| 0 `SCRIPT_VIRIDIANFOREST_DEFAULT` | `CheckFightingMapTrainers` (123) |
| 1 `…_START_BATTLE` | `DisplayEnemyTrainerTextAndStartBattle` (156) |
| 2 `…_END_BATTLE` | `EndTrainerBattle` (179) |

So the check runs on **every standing pass**:
- after a text box, a battle or a warp;
- on a turning pass;
- on the continuation pass after a ledge landing (a+37, `notes/12-a6d-plan.md` §3).

It never runs mid-step. Consequences:

- **A wild battle comes first.** The encounter roll is in the step-end pass. The trainer looks on
  the first pass after the battle.
- **After a trainer battle, the first pass runs `EndTrainerBattle`**, not the sight check. Both
  ways into a battle leave the script at 2:
  - the sight path: script 1, then `StartTrainerBattle` (166) increments it;
  - the talk path: `TalkToTrainer` (84) increments it and sets `BIT_USE_CUR_MAP_SCRIPT`, then
    `StartTrainerBattle` increments it again.

  `EndTrainerBattle` falls into `ResetButtonPressedAndMapScript` (213), which writes 0. The
  next trainer can look on the **second** pass.
- **After a map load, sprites are invisible on the first pass.** `EnterMap`'s `UpdateSprites`
  meets status 0 and runs `InitializeSpriteStatus` (`movement.asm:397`), which writes image index
  `$ff` and returns. No trainer can engage until that pass's own `UpdateSprites` has run.
  Ours already behaves this way: the `Npc` constructor is the stand-in, and the visibility
  latch starts false.
- **After a battle, sprites are refreshed before the first pass.** `.battleOccurred` → `EnterMap`
  (`home/overworld.asm:36`) runs `UpdateSprites` with no re-init. **Ours has no such call**
  (§3.7, decision 3).
- **At the hop's midpoint** (pass 9, `notes/12-a6d-plan.md` §3) `wWalkCounter` is 0 too, so the
  map script runs there (§1.8).

### 1.2 Which trainer

`CheckForEngagingTrainers` (257) walks the map's trainer headers in order, skips beaten ones (the
event flag) and calls `TrainerEngage` for each; **the first that engages wins** and the loop
stops. Header byte 0 is the sprite slot. `def_trainers N` starts it at N and each `trainer` macro
adds 1 (`macros/scripts/maps.asm:104–127`), so header order is slot order. The Forest:
`def_trainers 2`, slots 2–6 = youngster2, youngster3, youngster4, cooltrainer_f, youngster5. Our
JSON lists them in that order (no `NPC_INDEX_FILTER` on the Forest). Header byte 1 is `sight << 4`:
**4, 4, 1, 0, 4**.

### 1.3 `TrainerEngage` (`engine/overworld/trainer_sight.asm:164`)

The player is always at screen ($40, $3c). The trainer's `XPIXELS`/`YPIXELS` are bytes:
`screenPixels()` in `sprite_collision.ts` (A6c). `d(a, b)` is `CalcDifference`
(`home/pathfinding.asm:2`), the unsigned byte difference |a − b|.

1. **Image index `$ff` → no.** That covers off-window, hidden objects and the latch:
   `CheckSpriteAvailability` (448) refreshes the image only when `wWalkCounter` is 0. In ours this
   is the sprite table's `available` (`!hidden && visibility.visible`).
2. **Lined up:**
   - If `Y == $3c`, then the distance is `d($40, X)`.
   - Else if `X == $40`, then the distance is `d($3c, Y)`.
   - Else no. A distance of 0 is no.
3. **`CheckSpriteCanSeePlayer` (257):** distance ≤ header byte 1. For a facing of up or down it
   also needs `X == $40`; for left or right, `Y == $3c`.
4. **`CheckPlayerIsInFrontOfSprite` (293):** skipped on `POWER_PLANT`. Otherwise Y is taken as
   `$0c` when it is `$fc`, then by facing:

   | Facing | Engages when |
   |---|---|
   | down | `Y < $3c` |
   | up | `Y ≥ $3c` |
   | left | `X ≥ $40` |
   | right | `X < $40` |
5. **Engage.** Set `BIT_SEEN_BY_TRAINER`, then `EngageMapTrainer` (320). That loads the class
   and party and calls `PlayTrainerMusic` (381): `StopAllMusic`, then male, female or evil meet
   music. Rivals and gym leaders get none (`meetMusicFor` already has this rule). **The music
   starts here, before the bubble.**

Quirks that fall out of this, all kept (Hard rule 7):

- **`$fc`: a trainer facing down can't see exactly 4 steps.** It sits at
  `Y = $3c − $40 = $fc`, and `d($3c, $fc) = $c0` = 192 > 64.
  - With 3 steps between them, `d = $30`, so it sees.
  - Step 4's `$fc → $0c` rewrite only matters once step 3 passes, which needs sight ≥ 12, so
    it never matters. Port it anyway.
- **Pop-in: a trainer at the window's 4-step edge spots a walking player one step closer.** The
  window reaches 4 steps up, down and left of the player, and 5 right (`inSpriteWindow`).
  - **Why:** the last moving pass's `UpdateSprites` judges the window from the old
    `wXCoord`/`wYCoord`. The next pass's sight check comes before that pass's own
    `UpdateSprites`.
  - **Walking on:** the step start's `.noDirectionChange → UpdateSprites` refreshes the
    trainer, so it engages at the next step end, at 3.
  - **Stopping:** `.noDirectionButtonsPressed → UpdateSprites` refreshes it, and it engages on
    the next pass, at the full 4.
  - **Entering the line sideways** (from the row above or below) finds the trainer already
    visible, so it engages at 4 at once.
  - The right edge is 5 steps, so a trainer to the player's right is affected only with sight 5.
- **The byte wrap** matters only at `$fc` inside the window.
- **The latch can keep a just-left sprite visible for one standing pass.** For example, walking
  up leaves a trainer 5 steps below at `Y = $8c` (`d = $50`) for that one check, and a sight-5
  trainer facing up would see it. Porting the bytes and the latch reproduces all of this.
- **No line of sight through walls or sprites** (Gen 1 has none).

### 1.4 The spotting pass

`CheckFightingMapTrainers .trainerEngaging` (139), still inside `RunMapScript`:

1. `set BIT_TRAINER_BATTLE`. `wEmotionBubbleSpriteIndex` = the trainer's slot; exclamation.
2. **`EmotionBubble`** (`engine/overworld/emotion_bubbles.asm`):
   1. It writes the "!" at OAM (`YPIXELS`, `XPIXELS + 8`), which is 16 px above the trainer's
      sprite, in the first OAM entries, so it draws over every sprite.
   2. It sets `wUpdateSpritesEnabled = $ff` and waits `DelayFrames 60`. Nothing moves or animates.
   3. It restores sprite updates and waits `DelayFrame`. VBlank copies OAM *before*
      `PrepareOAMData` rebuilds it (`home/vblank.asm:33–38`). So this frame still shows the
      bubble, and the rebuilt OAM without it shows from the next frame. **The bubble is on
      screen for 61 frames.**
   4. It runs **`UpdateSprites`** (an ordinary update for every NPC and Pikachu).
3. `wJoyIgnore = PAD_CTRL_PAD`, `hJoyHeld = 0`.
4. **`TrainerWalkUpToPlayer`** (77): the distance on the facing axis, from the screen bytes and
   the facing saved by `TrainerEngage`.
   - `$10` (adjacent) → return, no walk.
   - Otherwise the step count is `swap(d) − 1`, which is `d/16 − 1` for a standing trainer.
     That many `NPC_MOVEMENT_<facing>` bytes and `$ff` go to `MoveSprite_`.
5. **`MoveSprite_`** (`home/pathfinding.asm:14`):
   - movement byte 1 = 0 (scripted);
   - copies the list;
   - sets `BIT_SCRIPTED_NPC_MOVEMENT`;
   - **`wJoyIgnore = $ff`**;
   - clears `wSimulatedJoypadStatesEnd[0]` and `wOverrideSimulatedJoypadStatesMask` (§1.8).
6. `wCurMapScript` ← 1. Back in `JoypadOverworld`: `Joypad` (masked, below), then the rest of
   `OverworldLoop`. With nothing usable pressed that is `.noDirectionButtonsPressed` →
   **`UpdateSprites`** again. Then `jp OverworldLoop`, so the next pass comes 2 frames later.

Two `UpdateSprites` run back to back at the bubble's end: steps 2 and 6. A trainer that was
resting when spotted can turn ready in the first of them.

### 1.5 The walk-up

- **What `MoveSprite_` doesn't touch: the movement status.** `UpdateNPCSprite` (97) carries on
  from whatever status the sprite had:

  | Status | What happens |
  |---|---|
  | resting (2) | `UpdateSpriteMovementDelay` (334) forces the delay to 0 and makes it ready (one update, standing frame) |
  | ready (1) | starts the first scripted step on the next update |
  | moving (3) | finishes its step, then becomes ready, with no random rest |

  Ours forces a resting pass on every `startScript`. That is right where a script writes the
  status itself: Pallet's Oak gets `MovementStatus = $2` after `ShowObject`
  (`scripts/PalletTown.asm:73`). It is wrong for a sprite left in its own cycle, as the
  trainer is (decision 2).
- **Each scripted step:**
  - a start pass: `TryWalking`, no pixel moved, and **`CanWalkOntoTile` returns at once for
    scripted movement** (554). No terrain, screen-edge or sprite check;
  - then 16 passes of 1 px.
  - **The walk-up passes through Pikachu and any sprite in the way.**
- **The terminator:** the update after the last pixel reads `$ff`. Movement byte 1 becomes STAY
  and `BIT_SCRIPTED_NPC_MOVEMENT` clears. The sprite stays ready, so its next update is an
  ordinary try.
- **Everything else keeps running**, through `UpdateSprites` once per pass: other NPCs wander and
  turn, Pikachu idles. A scripted sprite skips the 4/5-step window (`CheckSpriteAvailability`:
  movement byte 1 < WALK).
- The player doesn't move or turn: no input reaches them.

### 1.6 Input between spotting and the text

`_Joypad` (`engine/joypad.asm:34`) computes `hJoyPressed` from the raw input against `hJoyLast`,
then masks both `hJoyHeld` and `hJoyPressed` with `wJoyIgnore`. `hJoyLast` stays raw.

- **The trainer walks** (`wJoyIgnore = $ff`): nothing gets through.
- **The trainer is adjacent** (`wJoyIgnore` = the d-pad only, for the rest of the spotting pass;
  the next pass shows the text, §1.7):
  - **START, or A at a sign, sprite or Pikachu**, reaches `.displayDialogue` (102). That runs
    `UpdateSprites` and then sees `BIT_SEEN_BY_TRAINER` (108), so nothing opens and the pass
    ends. It skips `.noDirectionButtonsPressed`'s stop bookkeeping: `BIT_TURNING`, the Pikachu
    counter, `wCheckFor180DegreeTurn` and the last stop direction.
  - **A at a hidden event or bookshelf** (`CheckForHiddenEventOrBookshelfOrCardKeyDoor`, 91)
    comes *before* that gate and runs as usual. A hidden item is found and its box shows;
    the trainer's text follows on the next pass.

### 1.7 Text and battle

`DisplayEnemyTrainerTextAndStartBattle` (156):
- **The walk isn't over yet** (`BIT_SCRIPTED_NPC_MOVEMENT` still set) → return.
- **Otherwise:**
  1. `wJoyIgnore = 0`;
  2. `DisplayTextID` with the trainer's slot as the text ID. That runs `TalkToTrainer`, which
     prints the before-battle text and stops at the `BIT_SEEN_BY_TRAINER` check, so there is no
     second `EngageMapTrainer` and no music restart;
  3. it falls into `StartTrainerBattle` (script → 2).

`JoypadOverworld` returns and the loop finds `wCurOpponent` → `.newBattle`, so **the battle starts
in the pass the text closed**. Nothing turns the trainer or the player: `DisplayTextID` sets no
`BIT_FACE_PLAYER` on this path.

Timing:
- **The walk ends** in the update that reads the terminator, during pass P's `UpdateSprites`.
- **The text** opens at the start of pass P+1.
- **Adjacent trainer:** the text opens on the pass after the spotting pass.

### 1.8 The hop's midpoint (pass 9)

`HandleLedges` sets two simulated presses, at indices 0 and 1 with the index at 2. Pass 1 reads
index 1; **pass 9 runs `JoypadOverworld`, so `RunMapScript` runs there**, before
`AreInputsSimulated` reads index 0.

If a trainer engages there and walks up, `MoveSprite_` has just zeroed index 0 (step 5 above).
This is my reading of the ASM, not tested on hardware:
1. The second half never starts, and the player stays on the ledge tile.
2. `HandleMidJump` keeps playing the arc in place up to index 16.
3. On the next pass the simulated input runs out, and `.doneSimulating` writes
   **`wJoyIgnore = 0`**, so the player can walk away during the walk-up.
4. The trainer's text still comes when its walk ends.

If the trainer is adjacent, index 0 survives: the hop finishes, and the text follows the landing.

**Unreachable today:**
- `HandleLedges` runs only on the OVERWORLD tileset;
- the Forest, the only extracted map with trainers, is FOREST;
- no Pallet, Viridian or lab trigger tile is a ledge tile (A6d).

The first map where it can happen is V4's Route 3: OVERWORLD, with trainers and ledges.

### 1.9 After the battle

- **`.battleOccurred`** (269) waits `DelayFrames 10`, then `EnterMap`: `LoadMapData` with no
  sprite re-init (sprites stay where they are), and one `UpdateSprites` (36).
- **A win:** the first pass runs `EndTrainerBattle`. It sets the flag (ours sets it in the
  battle-finish handler, which is equivalent: nothing reads it in between) and clears
  `BIT_SEEN_BY_TRAINER`, `wJoyIgnore` and the script. The trainer stays where it walked to.
  `PrintEndBattleText` has already made it STAY/NONE (A6c), so it turns at random. A map load
  puts it back on its own tile.
- **A loss:** `AllPokemonFainted` (316) runs `RunMapScript` once, which resets the script, then
  `HandleBlackOut`. Coming back, the trainer is on its own tile, unbeaten, and spots you again.

## 2. Today's code against that

| | ASM | Ours |
|---|---|---|
| When | standing passes, before the joypad; not mid-step | step end only (`updateOverworld` tail), including the hop midpoint (N-3) and pass 16 before the landing (A6d carry-over) |
| After a battle | refreshed by `EnterMap`; `EndTrainerBattle` pass first | never re-checked until a step |
| Geometry | screen bytes, latch, `$fc`, in-front | tiles along the facing (`isPlayerInSight`), no screen test |
| Sight data | header byte 1 | not extracted (`sightRange` absent) |
| Music | at spotting | none on this path |
| "!" | 61 frames on screen, everything frozen, then `UpdateSprites` | 20 passes, only the trainer's timer |
| Walk-up | `MoveSprite`, NPC pace, collisions off, world moving | private pixel stepper (`updateApproach`), world frozen |
| Input | `wJoyIgnore` / `BIT_SEEN_BY_TRAINER` (§1.6) | `trainer_approach` state: no overworld pass at all |
| Text → battle | `DisplayTextID` → `TalkToTrainer` (seen) → `StartTrainerBattle` | `engageTrainer(npc, true)` (V1c); keep |

## 3. The plan

### 3.1 Data: `sightRange` (one field, regenerated)

- `rom/extractors/maps.ts`: `readTrainerTexts` becomes `readTrainerHeader` and also returns
  `sightRange = header byte 1 >> 4`. `MapNpc` gains `sightRange?: number`, which every standard
  trainer gets, 0 included. `NpcData.sightRange` already exists (`core/types.ts:35`).
- `npm run setup pokeyellow.gbc`. The regenerated diff must be exactly 5 `sightRange` lines in
  `data/maps/ViridianForest.json` and the same 5 in `static/maps/ViridianForest.json`
  (`git diff --stat -- game/data game/static`). DECISIONS #35 lets this ride with the engine
  slice.

### 3.2 `overworld/trainer_sight.ts` (new, pure)

- `trainerEngages(t, powerPlant)` — §1.3 steps 1–4 on
  `{ x, y, facing, onScreen, engageDistance }`, bytes in, a boolean out.
- `engagingTrainer(trainers)` — header order, beaten ones skipped, first engaging wins.
- `walkUpSteps(t)` — `TrainerWalkUpToPlayer`'s count: 0 at `$10`, else `swap(d) − 1` as a byte.
  `swap` is exact even for a mid-step trainer.
- `byteDiff(a, b)` (`CalcDifference`). No engine imports beyond types.

### 3.3 The trainer map script (`overworld/map_trainers.ts`, new)

- **`TRAINER_MAPS = { ViridianForest }`.** These are the maps whose default script is the
  generic trio. Gyms (V3) add their own phases after 2.
- **The phase is `w<Map>CurScript`,** kept with `getMapScript`/`setMapScript` (DECISIONS #34,
  decision 4). It is 0 whenever saving is possible, because START stays gated until
  `EndTrainerBattle` has run.
- **`trainerMapScript(deps, ow)`** is called from `runMapScript` for a `TRAINER_MAPS` map:
  - **0:** build the sight inputs from the live sprite table (`spriteTable`), in slot order, for
    unbeaten trainers with `sightRange > 0`. On a hit:
    1. set `ow.seenByTrainer`, keep `ow.engagedNpc`, phase → 1;
    2. return `{ type: 'trainerEngage', npc, steps, music }`, where music is
       `meetMusicFor(class)`.
  - **1:** if `engagedNpc`'s scripted walk isn't done, return `null` (the pass carries on
    locked). An adjacent trainer has no walk, which counts as done. Otherwise clear the joypad
    mask and return `{ type: 'trainerText', npc }`.
  - **2:** `EndTrainerBattle`: clear `seenByTrainer`, the mask and `engagedNpc`; phase → 0;
    return `null`. **No sight check on this pass.**
- **The battle start sets phase 2** (`StartTrainerBattle`), for both the sight path and the talk
  path, on a `TRAINER_MAPS` map. The blackout path resets the phase to 0 and clears the seen
  state before warping (`AllPokemonFainted`'s `RunMapScript`).

### 3.4 The spotting pass and the bubble (`main.ts`, `overworld/emotion_bubble.ts`)

- **`trainerEngage`:**
  1. `stopMusic()` and play the meet music, if any;
  2. set the joypad mask to the d-pad;
  3. start an `EmotionBubble` hold on the trainer;
  4. go to state **`emotion_bubble`**, which replaces `trainer_approach`.
- **`EmotionBubble`** is a small frame counter, testable on its own:
  - it holds for 61 frames, with no passes, no `UpdateSprites` and no input;
  - "!" is drawn 16 px above the trainer, **after all sprites** (it is in the first OAM
    entries);
  - the end work runs on the 61st tick.

  Our renderer draws each tick's state after its logic. So "on screen for 61 frames" means
  drawing it on the 61 renders from the spotting tick T to T+60, and not at T+61, when the end
  work's `UpdateSprites` runs.

  It isn't in `PASS_STATES` and **is** in `ui_entry.ts` `MAP_STATES` (no UI opens).
  `drawExclamationBubble` already draws at the sprite's top − 16.
- **At its end, in the same tick** (`finishTrainerEngage` in the controller, so it is testable):
  1. `updateSprites()` (EmotionBubble's);
  2. if `steps > 0`, `npc.startScriptedMove(steps × facing)` and set the mask to all buttons;
  3. **the rest of the pass**, exactly as a standing pass continues after `runMapScript`:
     `readJoypad()` under the mask, then the START check and `runOverworld` with the seen gates
     (§3.5). With nothing usable, that is `.noDirectionButtonsPressed`: a player pass with no
     input, so `UpdateSprites`.

  Then the state returns to `overworld`; `PassClock` restarts the pair, so the next pass comes
  2 frames later. Refactor the overworld branch so "the rest of the pass" is one function that
  both callers use.

### 3.5 The input mask and the seen gates

- **`wJoyIgnore` → `input.ts`:**
  - `setJoyIgnore(mask)`;
  - `readJoypad` keeps the raw edge (`hJoyLast`) and masks both pressed and held;
  - the overworld's direction read (today `isHeld` in `Player.update`) goes through the masked
    held state.

  Menus and text read the joypad per frame and are unaffected. The text opens after the mask
  clears.
- **`ow.seenByTrainer` (`BIT_SEEN_BY_TRAINER`)** gates `.displayDialogue`:
  - **Blocked:** START, signs, NPC sprites and Pikachu. When one of these is pressed, the pass
    runs `updateSprites()` and ends, with no player pass. (Only the adjacent case can see this;
    see §1.6.)
  - **Not blocked:** hidden events and bookshelves (`Player.checkInteraction`'s first two
    branches; tell bookshelf text apart from signs).

### 3.6 The walk-up and the text

- **The walk-up starts the way `MoveSprite_` does** (decision 2). Add a status-keeping start,
  for example `NpcWalk.startScript(steps, { keepStatus: true })` through `Npc.startScriptedMove`:
  - it keeps `status` (resting is made ready by its next update, ready steps at once, moving
    finishes first, init initializes first);
  - it never touches the delay.

  The other `startScript` callers keep today's forced resting pass until their own ASM is
  checked (§8). Everything else in A6c's scripted walk already matches §1.5: scripted tries
  skip `canWalk`, the window exemption, 17 passes a step, and the terminator pass.
- **Remove `Npc.approaching`, `approachDone`, `showExclamation`, `isPlayerInSight`,
  `startApproach` and `updateApproach`**, along with the bubble drawing in `Npc.render`.
  `inSpriteWindow`'s exemption becomes `walk.scripted` alone.
- **`trainerText`** → `engageTrainer(npc, true)` (V1c: the text, no music; closing it starts the
  battle) and sets phase 2.

### 3.7 `EnterMap`'s `UpdateSprites` after a battle (decision 3)

- **Every return to the map from a battle** (wild, trainer, script, catch demo; after any
  evolution) runs `updateSprites(npcs, gameMap, player, pikachuFollower)` once. It runs before
  the first pass, where the existing return paths set `overworld` or `script`.
- **A blackout doesn't:** it warps, and the new map's sprites start invisible (§1.1).
- **Why:** a trainer that came into the window on the step that started a wild battle is visible
  on the first pass back, as on the cartridge.

### 3.8 Where sight runs, and the removals

- **The step-end sight loop in `updateOverworld` goes**, and with it the `trainerApproach`
  action, `ow.approachingNpc` and the `trainer_approach` state. That fixes N-3 and the
  A6d carry-over.
- **Sight now runs only from `runMapScript`:**
  - main.ts already calls it on standing passes, skipping `isMoving` and `isLanding`;
  - so it runs on the a+37 continuation after a landing, as the ASM does;
  - `ow.doorExitStep` keeps its A6b skip.

### 3.9 The hop midpoint: deferred behind a tripwire (decision 1)

- **The midpoint `RunMapScript` (§1.8) isn't built in A1c.** Nothing in the 19 extracted maps
  can fire there, and the aftermath can't be verified without a reachable case.
- **A1c adds `trainer_tripwires.test.ts`:**
  - **(a) Midpoint.** Every extracted map whose tileset is OVERWORLD has no trainer with
    `sightRange > 0`. It fails in V4 (Route 3), with a message pointing to §1.8: port the
    midpoint hook and the stranding, or prove that map can't reach it.
  - **(b) `TRAINER_MAPS`.** The set equals the extracted maps whose
    `refs/pokeyellow/scripts/<Map>.asm` mentions `CheckFightingMapTrainers`. It fails in V3
    (Pewter Gym) and V4. It skips without `refs/`.
- CONVENTIONS' map-expansion workflow gets one line: an OVERWORLD map with ledges must check its
  triggers and trainer lines against the hop midpoint (this note §1.8).

## 4. Files

| File | Change |
|---|---|
| `rom/extractors/maps.ts` | `readTrainerHeader`, `sightRange` |
| `data/maps/ViridianForest.json`, `static/maps/ViridianForest.json` | regenerated (5 fields each) |
| `overworld/trainer_sight.ts` (new) | §3.2 |
| `overworld/map_trainers.ts` (new) | §3.3 |
| `overworld/emotion_bubble.ts` (new) | the hold |
| `overworld/overworld_controller.ts` | `runMapScript` dispatch, `finishTrainerEngage`, seen gates, the step-end loop removed, new actions |
| `overworld/npc.ts` | the approach code and the bubble draw removed |
| `overworld/walk_pace.ts`, `overworld/npc.ts` | a status-keeping scripted start for the walk-up (decision 2) |
| `overworld/ui_entry.ts` | `MAP_STATES`: `emotion_bubble` |
| `input/input.ts` | `wJoyIgnore` |
| `main.ts` | state `emotion_bubble`, the rest-of-pass refactor, the START gate, phase 2 on battle start, the blackout reset, `EnterMap`'s `UpdateSprites`, the bubble render |
| docs | `overworld/ARCHITECTURE.md` (a *Trainer sight* section, pitfalls), `battle/ARCHITECTURE.md` (*Trainer Battles*: the sight path), `context/ARCHITECTURE.md` (state machine: `emotion_bubble`), CONVENTIONS (map workflow line), STATUS, PLAN, DECISIONS, CLAUDE.md (baseline only) |

## 5. Tests (about 50 new)

- **Extraction (ROM):**
  - each Forest trainer's `sightRange` against the `trainer` macros parsed from
    `scripts/ViridianForest.asm` (4, 4, 1, 0, 4);
  - each trainer's 1-based JSON index = `def_trainers` start + header order;
  - non-trainers have no `sightRange`.
- **`trainer_sight.test.ts` (pure):**
  - row and column cases; distance 0; the boundary (`sight × 16` sees, +16 doesn't);
  - behind, and facing along the wrong axis;
  - **`$fc`**: 4 above facing down doesn't see, 3 does; the `$fc → $0c` rewrite with a synthetic
    byte-1 of `$f0`;
  - left-edge `X = $00` sees at 4;
  - off-screen never engages; the Power Plant skip;
  - header order (first wins, a beaten one skipped);
  - `walkUpSteps` 0 / 1 / 3, and a synthetic `d = $31` giving `swap − 1` = `$12`.
- **Controller (`overworld_controller.test.ts`):**
  - the phases 0 → 1 → (text) → 2 → 0;
  - the first pass after a battle runs `EndTrainerBattle` only; a second trainer engages on the
    next pass;
  - the talk path also lands in phase 2; a loss resets.
- **Pop-in, with youngster5's geometry:**
  - walking left from (18,17) without stopping engages at (16,17), 3 away;
  - stopping at (17,17) engages one pass later, 4 away;
  - entering (17,17) from (17,16) engages at once, 4 away;
  - a trainer on the right side engages at its full 4 while walking.
- **Where it runs:**
  - not mid-step; not at either hop half (N-3); not on the landing pass; yes at a+37;
  - after text and warps, but not on a map's first pass (latch);
  - **after a wild battle on the first pass**, through `EnterMap`'s update (decision 3).
- **Spotting timeline** (frames from the spotting pass T; the youngster5-at-3 case, steps = 2):
  - music at T;
  - "!" drawn on renders T…T+60 (61), gone at T+61;
  - no NPC or Pikachu update T+1…T+60;
  - two `UpdateSprites` at T+61;
  - a resting trainer: the lead-in at T+61, step starts at T+63 and T+97, the terminator at
    T+131, the text at T+133;
  - a ready trainer: everything 2 frames earlier;
  - adjacent (youngster4): the text at T+63.
- **During the walk-up:**
  - another NPC still moves;
  - the trainer walks through Pikachu;
  - the player gets no input: START, A and arrows do nothing.
- **Adjacent lockout:**
  - arrows ignored;
  - START and A on a sign or sprite → one `UpdateSprites` and no box;
  - A on a hidden item → the item flow runs, then the trainer text.
- **The status-keeping start:** ready → steps on the next update; resting → one lead-in;
  moving → finishes, then steps; init → initializes, then steps. The default `startScript` and
  its existing tests are unchanged.
- **`EmotionBubble`:** a 61-frame hold, drawn on 61 renders, the target slot, done once.
- **Tripwires (a) and (b).**

## 6. Checkpoints

Commit locally at each one; the game stays playable between them.

1. **Data and the pure module.** §3.1, §3.2, extraction and pure tests. Sight still runs the
   old way.
2. **The map script and input.** §3.3, §3.5, §3.6 (the status-keeping start), `EnterMap`'s
   update; the step-end loop removed. A plain engagement goes straight to the text, with no
   bubble or walk yet.
3. **The bubble and the walk-up.** §3.4, the removals, the render; the timeline tests.
4. **Tripwires, docs, verify.** Typecheck, the full suite with `ROM_PATH`, build, then STATUS.

## 7. Verification

- `npm run typecheck`, `ROM_PATH=pokeyellow.gbc npm test` (864 + new), the no-ROM suite,
  `npm run build`.
- The regenerated diff: only the 10 `sightRange` lines.

### Play-test (the user; A = **Z**, B = **X**)

Debug overlay (backtick) → Skip Intro → warp to Viridian Forest. The panel shows your step x,y.

1. **youngster2** (30,33), facing left, sight 4. Come down onto (26,33) from (26,32).
   - It spots you 4 away.
   - The meet music starts at that moment.
   - "!" for about a second.
   - It walks 3 steps, then the text, then the battle.

   **youngster3** (30,19) does the same.
2. **youngster5** (13,17), facing right, sight 4. Save at (18,17) first.
   - Hold left from (18,17): you are spotted at (16,17), and it walks 2 steps.
   - Reload, then tap left once and let go: you are spotted at (17,17) a moment later, and it
     walks 3.
   - Reload, then from (17,16) step down: you are spotted on arrival at (17,17).
3. **youngster4** (2,18), facing left, sight 1. Walk down column 1 onto (1,18).
   - "!" and then the text straight away. It doesn't walk; it is next to you.
   - The hidden Potion is on that tile. From (1,17), face down and press A: you take it unseen.
4. **During "!" and the walk:**
   - START, A and the arrows do nothing;
   - during "!" everything is frozen, Pikachu included;
   - during the walk, any other NPC on screen keeps turning, Pikachu idles, and the trainer walks
     through Pikachu if it is in the way.
5. **Win a battle.**
   - The trainer stays where it stopped and turns at random.
   - Walking past again starts nothing.
   - Talking to it gives the after text.
   - Leave the Forest and come back: it is back on its own tile.
6. **A wild battle** on a trainer's line (if one starts there): it spots you right after the
   battle.
7. **Talking still works:** talk to youngster4 from (2,17). You get the text, the music after it
   has typed, then the battle (V1c).
8. *(Optional)* **Lose to a trainer that spotted you.** After the blackout, go back: it spots you
   again.

## 8. Found while planning — each with a home

| Finding | Source | Home |
|---|---|---|
| Mid-hop spotting strands the player on the ledge tile and re-enables input (§1.8) | `pathfinding.asm` `MoveSprite_`, `home/overworld.asm` `AreInputsSimulated` | **V4** (tripwire a), if decision 1 |
| Pallet's "!" (`frames: 40`, `story/pallet_town.ts:68`) and Oak's Lab rival's (`frames: 30`, `oaks_lab.ts:46` and `:347`) are `EmotionBubble`: 61 frames on screen, frozen, then `UpdateSprites`. Pallet's also comes 10 frames into its `text_asm` | `scripts/PalletTown.asm:256`, `scripts/OaksLab.asm:797` | **V5** (decision 5); A1c's `EmotionBubble` is the routine to reuse |
| A trainer covered by a text box keeps image `$ff` until a standing `UpdateSprites`; ours hides covered NPCs only at render (A6b). Sight could fire one pass early after a box closes. The case is stepping into a pop-in line and reading a sign below the trainer in the same pass: unreachable with the Forest's fixed-facing trainers | `movement.asm` `CheckSpriteAvailability`, `ui_entry.ts` | **J2** overworld audit, with the NPC font-loaded update |
| `NpcWalk.startScript` forces a resting pass on every scripted walk. `MoveSprite` keeps the sprite's status; some scripts write it first (Pallet's Oak: `$2`, which matches ours). Each cutscene caller needs its own ASM's status write before the default can follow `MoveSprite_` | `home/pathfinding.asm:14`, `scripts/PalletTown.asm:73` | **J2** cutscene audit (decision 2) |
| `PlayTrainerMusic` skips gym leaders by `wGymLeaderNo`; `meetMusicFor` has the flag, nothing sets it | `home/trainers.asm:389` | **V3** |
| `EndTrainerBattle` hides Pokémon "trainers" (Voltorb, Electrode) after a win | `home/trainers.asm:206` | already logged → F/H |

## 9. Decisions (O-15)

1. **Defer the hop-midpoint `RunMapScript` to V4, behind tripwire (a), instead of building it in
   A1c?** **Recommended: yes.** Nothing in today's maps can fire there, and the cartridge's
   aftermath (§1.8) can't be verified without a reachable case. Building it now would be
   untestable state. This changes what DECISIONS #38 handed to A1c. Sight after the landing and
   N-3 are still fixed here.
2. **Start the walk-up with `MoveSprite_`'s status rule, and leave the other scripted walks for
   the J2 audit?** **Recommended: yes.** A trainer is in its own rest cycle when spotted. About
   1 time in 66 it is ready, and the forced resting pass would then delay its walk by 2 frames.
   The cutscenes are another matter: Pallet's Oak gets an explicit `$2` that today's forced pass
   happens to match. Changing the default would need every caller's ASM checked and its verified
   timing re-tested.
3. **Add `EnterMap`'s `UpdateSprites` to every battle return that doesn't black out?**
   **Recommended: yes.** It's what puts a trainer that entered the window on the battle step on
   screen for the first pass. It is one NPC and Pikachu update per return, script battles
   included.
4. **Keep the Forest's trainer phase in `setMapScript` (`w<Map>CurScript`, saved)?**
   **Recommended: yes.** It's DECISIONS #34's mechanism; V3's gym scripts extend the same phase
   numbers. It is 0 at every point where saving is possible.
5. **Leave Pallet's and Oak's Lab's bubbles alone in A1c and log them for V5?**
   **Recommended: yes.** Both cutscenes are user-verified. A1c builds the routine; switching them
   is a small separate change with its own play-test.
6. **One slice, four checkpoints (§6)?** **Recommended: yes.** It's the size of A1b. Each
   checkpoint leaves the game playable.
7. **Who implements?** **Recommended: Sol implements, Claude reviews** (A1b's pattern, since
   Claude planned). Your call.

Reply **go** to take all seven, or answer by number.

## 10. Implementation — 2026-10-06, Claude Opus 5.5

**Commits:** `58dafde` (checkpoint 1), `b20c237` (checkpoints 2 and 3 built together), then the
docs commit. **910/910** with `ROM_PATH` (+46); no-ROM 828 pass, 82 skip; typecheck and
build clean.

**As planned:** §3.1–§3.9, with no departures from the ASM rules in §1.
- The regenerated diff is the 10 `sightRange` lines.
- The pop-in and `$fc` quirks come out of the byte port and the existing visibility latch,
  with no special cases.
- The timeline tests match §5: the text at T+133 for a resting trainer, and T+131 when it is
  ready at `MoveSprite_`.

**Design notes for the reviewer:**
- `main.ts` `restOfPass` is the shared remainder of a standing pass. The spotting pass's end
  calls it after `finishTrainerEngage`.
- `emotion_bubble` is not a pass state, and it skips `syncJoypadRead`. EmotionBubble's
  `DelayFrames` read nothing, so the spotting pass's `Joypad` compares against the read
  before the bubble.
- The mask lives in `input/joy_ignore.ts`, which has no `window`. That lets the controller set
  it under the test mocks of `../input`. `input.ts` applies it to `isHeld`, `isPressed` and
  the pass read, and keeps the raw edge.
- The seen gate uses `Interaction.preDialogue` (hidden-event text and bookshelves), so
  `CheckForHiddenEventOrBookshelfOrCardKeyDoor`'s finds pass and signs and sprites don't.
- `DisplayEnemyTrainerTextAndStartBattle` sets the script to 2 when it returns the text.
  `StartTrainerBattle` runs right after `DisplayTextID` on the cartridge, with no pass in
  between.
- `EnterMap`'s `UpdateSprites` runs in the battle-finish handler after the Pikachu visibility
  update, and before any evolution. Nothing on the map moves while evolutions run, so the
  order is equivalent.

**Smoke test** (port 5179, crafted save, cleared afterwards):
- youngster4: stepping onto (1,18) brings its text at once (adjacent, no walk);
- the hidden Potion taken from (1,17) without being seen;
- a win, and the player moves again;
- youngster2: "!", the 3-step walk-up, its text.

The full play-test (§7) is the user's.

**User-verified 2026-10-06:** the user ran the §7 play-test: "i checked and it all works well".
A1c is done, and with it milestone A1.
