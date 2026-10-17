# Findings backlog (moved from STATUS.md → *Notes for later*, 2026-10-16)

Verbatim. Each finding names its proposed home (a slice id such as V5, J2, A5c). When planning a slice,
search this file for its id and fold the matching findings into the plan; mark them done here when they
land. New findings go here too, under a dated heading.

- Cable club receptionist (`ViridianPokecenter:4`, cableClubReceptionist): link features need a user decision; not a PC and no slice is invented for it.


### Found during V1 research (2026-09-22) — not V1, each needs a home

Detail and suggested homes are in `notes/02-v1-plan.md` §5 and §4:
- **Route 22 has a second upstream demo gate:** a fake Blue with invented "end of the
  demo" text (`blue_blocking` in `maps.ts`). **Decided: removed in V1e** (DECISIONS #29).
- **In-game trades were missing from PLAN.md.** Route 2's is the first and needs a
  Clefairy (Mt. Moon). **Decided: new slice A4** (DECISIONS #29).
- The Viridian Fisher's text promises TM42, but he never gives it.
- Stationary NPCs facing NONE should turn in place at random; upstream never turns
  them. → **done in A6c (user-verified 2026-10-04)**.
- No tile animation (water, flowers) anywhere in the engine.
- ~~The Oak's Lab rival never shows his win/lose texts~~ — **fixed in V1c**.
- Door SFX is chosen by destination map, but the ASM chooses by the tile under the
  player.
- ~~The music list typo `meetevilttrainer`~~ — **fixed in V1c** (DECISIONS #31).

### Found during V1c (2026-09-23) — each has a proposed home

Detail in `notes/04-v1c-plan.md` §1.6 and *Result*:
- **Battle transitions, enemy pic positions and typed battle text** → **A5**
  (DECISIONS #31). Map-trainer battles cut straight in until then.
- **Species display names are `pokemon.json`'s**: "NIDORAN-F" / "NIDORAN-M" /
  "MR. MIME" in battle, the Pokédex and the party screen, where the cartridge's
  `MonsterNames` say "NIDORAN♀" / "NIDORAN♂" / "MR.MIME". → **V5**, decided in #44.
- **`startTrainerBattle` hangs silently** if a load fails, because it sets
  `transition` first. Both known causes are fixed; the path is still fragile.
- **Beaten trainers should start turning at random**
  (`SetEnemyTrainerToStayAndFaceAnyDirection`) → **done in A6c (user-verified 2026-10-04)**.
- **Post-battle Pikachu mood floor** (≥ 130 after any battle not lost) is missing →
  in `game/src/pikachu/ARCHITECTURE.md`'s "not yet implemented" table.
- **Pokémon placed as trainers** (Power Plant's Voltorbs and similar) must be hidden
  after the battle (`EndTrainerBattle` → `HideObject`) → phases F/H.
- **Gym leaders:** no meet music (`wGymLeaderNo`), the `defeatedgymleader` fanfare,
  `gymleaderbattle` music → V3. The `trainer_flow.ts` helpers take `isGymLeader`.

### Found during V1d (2026-09-24) — each has a proposed home

Detail in `notes/05-v1d-plan.md` §1.4 and §4:
- **The normal wild catch departs from `ItemUseBall`.** Its texts are invented
  ("POKé BALL thrown!", "Gotcha!"). There's no toss animation, no caught-mon jingle,
  and no "New POKéDEX data" page. The ball also leaves the bag before the throw,
  where the ASM removes it after. → **A5f**, decided in #44. It can reuse the
  catch demo's toss drawing.
- **The normal wild intro shows the enemy HUD during "Wild X appeared!"** and no party
  pokéballs. The ASM draws the pokéballs during the text and the HUD after it → A5.
- **Both battle intros slide in over 40 eased frames**; the ASM slides linearly for 72
  → A5.
- **The toss, poof and shake timings are upstream's approximations**; the exact ones
  are in `data/battle_anims` → with the normal-catch finding.
- **The Pikachu battle's transition** runs `GetBattleTransitionID_CompareLevels` with
  an empty party → A5 must work out what it yields.
- **Cries** (the enemy's at "appeared!", the Pikachu clip in Oak's catch) → J2;
  **the caught-mon jingle** (`SFX_Caught_Mon`) → V5.

### Found during V1e (2026-09-25) — each has a proposed home

Detail in `notes/06-v1e-plan.md` → *Result* and §3:
- **Step triggers vs. a held key.** `player.update` starts the next step in the same
  frame one finishes, before `handleStepComplete` runs the map's trigger. Viridian's
  triggers now take that step back (`cancelMovement` + `forgetPlayerStep`). Pallet's
  Oak grass trigger and the Oak's Lab rival trigger still don't, so Pikachu can end
  under the player there. Home: the next slice that touches either, or A1 (trainer
  sight is also a step trigger).
- **The gambler at (30,8)** should say "GYM leader returned" with 7 badges or after
  Giovanni → I1.
- **Pushes as simulated joypad steps**: upstream's other forced one-step moves (the
  Oak's Lab "Don't go away yet!" guard step, the Pallet grass) use `movePlayer`,
  which ignores collision and ledges. Check each against its ASM when next touched.

### Found during the A1 research (2026-09-27) — each has a proposed home

Detail in `notes/07-a1-plan.md` §1.6 and §3:
- **The overworld runs at twice the Game Boy's speed.**
  - The ASM's overworld loop takes 2 frames per pass. The player walks one step in 16
    frames, and NPCs in 32.
  - Ours takes 8 ticks per step for the player, NPCs and Pikachu alike, and since
    DECISIONS #33 a tick is one frame. So the player and Pikachu walk at 2×, and NPCs at
    4×.
  - On a 60 Hz display, upstream's old loop ran at 30 ticks/s, which hid this.
  - Text, battles and audio count real frames and are right.
  - ~~Proposed home: A6~~ — **fixed by A6a (2026-09-28), measured at 15.99 frames a step.**
- **Sprites pop in at the screen edges one loop pass after a step** (`CheckSpriteAvailability`
  judges the window from map coordinates, which change only at the end of a step).
  Upstream draws every NPC all the time. → **done in A6b (2026-10-01)**.
- **After a text box the ASM leaves the NPC facing the player.** A fixed-facing STAY NPC
  turns back only when its random movement delay runs out; upstream turns it back after
  120 ticks. → **both done in A6b (2026-10-01)** (fixed-facing turn-back
  was approved early in DECISIONS #37; NONE turning remains A6c).
- **More jingle call sites once A1a lands:**
  - `sound_get_item_1`: Route 1's Potion sample.
  - `sound_get_key_item`: Daisy's Town Map, and Oak's parcel, Poké Balls and Pokédex.

  → V5.

### Found while building A6a (2026-09-28) — each has a proposed home

Detail in `notes/08-a6-plan.md` → *Progress*:
- **Pikachu's idle antics** (`pikachu_follow.asm` `Func_fc803`): while you stand still
  it faces a random direction every 32 passes, and sometimes hops, walks in place or
  spins. Upstream's Pikachu just stands. → A6c.
  **Re-probed 2026-10-03:** first idle zero wraps for 256 eligible updates; later
  glances wait 32; four antics depend on the retained follow command. Exact rules
  and scope are in `notes/10-a6c-plan.md` §6. → **done in A6c (user-verified 2026-10-04)**.
- **Walking into Pikachu:** a turn arms 8; seven eligible collision checks block,
  the eighth passes if terrain allows, and holding B bypasses only the following
  Pikachu (`wPikachuCollisionCounter`, `CollisionCheckOnLand`). → A6c,
  `notes/10-a6c-plan.md` §7 (2026-10-03 correction to the earlier “8 passes” shorthand). → **done in A6c (user-verified 2026-10-04)**.
- **A ledge hop's two steps are simulated presses.** So they don't count as steps
  (`StepCountCheck`), can't start an encounter, and run the step-complete checks after
  each step. Upstream treats the hop as one step and rolls an encounter on landing.
  → **done in A6b (2026-10-01)**.
- **Pikachu's scripted moves** (Viridian's step-aside, the walk to the nurse) are
  `ApplyPikachuMovementData`, a frame-driven engine with hops and shadows. They keep
  upstream's approximation at pass pace. → A6d.
- **Oak's Lab logic departures** (not timing, left as they are):
  - the rival's Pokédex-scene exit should repeat his entry's step count (upstream: 8);
  - after the lab battle the player turns to watch the rival leave;
  - the Eevee-ball shove only happens with the player at y = 4.

  → the next slice that touches Oak's Lab.
- **Invented cutscene timings:** upstream's cutscenes have many `wait` 10/15/20s and "!"
  bubbles of 30–40 frames, where `EmotionBubble` holds 60. **Proposed: a cutscene timing
  audit** (a new small slice; decide its place with the user), porting each cutscene's
  `DelayFrames` and bubbles from its ASM.
- **pret's comment** in `AdvanceScriptedNPCAnimFrameCounter` says "intra-animation frame
  counter", but the code reads `ANIMFRAMECOUNTER` (offset `$8`). Trusting the comment
  gave Oak flickering legs, which the user caught.
- **Working copies with CRLF:** many files under `game/src` are CRLF on disk, while git
  keeps LF. A `node` string-replace across lines misses them, so use the Edit tool (added
  to CONVENTIONS' tooling traps).

### Found during A6b (2026-10-01) — each has a proposed home

`engine/events/pikachu_happiness.asm` sets non-neutral mood targets directly, with
starter/OT/health guards. Upstream's shared `modifyPikachuHappiness` nudges by one
and omits some guards. A6b corrects WALKING only (neutral target = no mood change,
healthy party Pikachu required). Audit the other event callers and the emotion
modifier separately; they were deliberately left outside A6b.
→ **Pikachu state audit / J2**. The unimplemented `wPikachuEmotionModifier`
also clears when walking mood reaches 128 (`poison.asm .clearEmotionModifier`).

Claude's interim review (`notes/09-a6b-review.md`) additionally found:

- **F-1: the whole overworld sits 4px above Yellow.** Upstream's camera uses
  `player.y - 60`: the player's block is at y=60 and sprite at 56, instead of
  Yellow's 64 and 60. Correcting it touches the camera and screen-relative overlays
  (grass, emotion bubbles, nurse healing and Pikachu emotion box).
  → **A separate camera slice, placed with the user.** A6b only converts the NPC
  coverage predicate's input to GB YPIXELS; it does not move the scene.
- **N-2: the previous warp-tile step suppresses the next encounter check.**
  `CheckWarpsNoCollision` sets BIT_STANDING_ON_WARP; `.newBattle` clears it only
  *after* `NewBattle`. Our current-tile gate does not reproduce that extra check's
  suppression after walking off a non-instant warp. → **Encounter audit / J2**.
- **N-3: trainer sight currently checks the simulated hop midpoint too**, since
  `justFinishedStep` now reports both halves. No current trainer is near a ledge.
  → **A1c**, when sight moves to the standing map-script hook.

Review R-1 is fixed: NPC coverage converts our sprite Y to Yellow's YPIXELS (+4),
with four render regressions at START's lower edge, with/without the Pokédex.
N-1 is fixed (Indigo Plateau is outdoor); N-4 was verified in `_InitBattleCommon`,
which calls `EndOfBattle` after `StartBattle` for catch demos as well.

### Found during A6e (2026-10-04) — where Sol's plan was wrong, and what remains

Claude checked Codex's `notes/14-a6e-plan.md` against the ASM and ROM before and while
implementing it. Most of it held (all program durations, the sine traces, the subtimer
animation bug, the turn tables, the HRAM aliasing behind `Func_6ebb`, the N-2
correction). These parts did not:

- **Wrong ROM address for Viridian's program.** The plan said `3c:5e2b` and warned
  *not* to use the first pattern match. The game reads `3c:5a0a`:
  `ViridianCityMovePikachu` (3c:5a01) assembles to `21 0a 5a` (`ld hl, $5a0a`), and
  pret's sym file agrees. The plan found the address by searching for the bytes, and
  another map stores identical bytes at 3c:5e2b. The output JSON is the same; the
  committed offset is now the real one. Lesson added to CONVENTIONS.
- **Spawn state 5 after a heal does not place a healthy Pikachu.** The plan (and A6d)
  treated `wPikachuSpawnState = 5` as "Pikachu reappears above the player". Its only
  readers (`CalculatePikachuPlacementCoords` / `CalculatePikachuFacingDirection`, via
  `TrySpawnPikachu`) run only at movement status 0, and a following Pikachu is at 1 after
  its walk. So a healthy Pikachu stays where `PikachuWalksToNurseJoy` left it (one that
  started diagonally above the player stays diagonal). Only a starter that wasn't out (it
  had fainted, and the heal revived it) spawns at state 5.
- **The plan left out the farewell's facing restore.** `CloseTextDisplay` writes every
  slot's `ORIGFACINGDIRECTION` back, Pikachu's included, and `DisplayTextIDInit` saved
  it when the conversation began. So after the nurse's farewell, Pikachu turns back to its
  pre-talk facing at the next update. Implemented (`pikachuFacing` save/restore).
- **The plan didn't cover an antic's bounce at a call.** `asm_fc87f` subtracts its last
  offset from YPIXELS and adds the next, so the interpreter must see the drawn pixels and
  hand them back without the offset (folding it in would double-count).

Codex's review then found two faults in the implementation itself (both fixed,
`notes/14-a6e-plan.md` → *A6e revision*):
- **R-1:** the nurse saved Pikachu's facing only when it was drawn; Yellow saves every
  slot's, so a healed fainted starter ended facing down instead of its old facing.
- **R-2:** Claude ran the interpreter in world pixels on the grounds that today's
  programs never wrap. The plan required bytes, and the reviewer was right: a complete
  interpreter must wrap screen and map coordinates as `add` does (X 250 + 3 × 4 → 6).

Still open, each with a home:
- **A fainted starter's `Func_6ebb(15, 0)` image isn't drawn.** On the cartridge it
  flashes for about 9 frames at the slot's stale pixels before the spawn places it.
  → J2 Pokécenter audit (needs evidence of what those pixels are).
- **Grass priority during a call** decides only whether Pikachu gets the engine's grass
  overlay, not every background tile's priority. This is the A6a §3 approximation. →
  the grass-priority check already listed for A6a.
- **Each script command still takes a dispatch frame** (except the frame a movement call
  returns). The nurse's waits are exact; the heal's total time is not. → J2 Pokécenter
  audit, with the healing machine's internals.
- **Cries, emote bubbles and the portrait's exit sequence** around the emotion preludes →
  V5 (audio) and the J2 emotion audit.

### Found during the 2026-10-06 code read — each has a proposed home

Claude read the whole engine before planning A1a. Each finding was checked against
`refs/pokeyellow`, not recalled:

- **The damage formula departs from `engine/battle/core.asm` in two ways** (upstream's
  `battle/damage.ts`):
  - *No stat scaling.* When either attack or defense is 256 or more, `.scaleStats`
    (core.asm:4278, and the enemy's at :4391) divides both by 4. It bumps only the
    offensive stat to 1, so a defense that scales to 0 divides by zero and freezes the
    game (a Gen 1 bug to keep). `damage.ts` never scales, and its `Math.max(1, defense)`
    removes the freeze.
  - *The cap is in the wrong place.* `CalculateDamage` caps the base formula at 997 and
    adds 2 (core.asm:4559–4625, `MAX_NEUTRAL_DAMAGE − MIN_NEUTRAL_DAMAGE`) before STAB
    and type effectiveness. `damage.ts` adds the 2 inside the formula and clamps to 997
    after type effectiveness.

  Invisible at today's levels; both matter once a stat passes 255 (badge boosts get
  there sooner). No milestone owns battle math. **Proposed: a battle-mechanics audit**
  (`damage.ts`, `effects.ts`, `status.ts` against core.asm, with `refs/engine` as the
  oracle) before Phase C. Place it with the user.
- **`data/audio/music/pokefluteinbattle.json` is garbage.** Its header address, 08:59cf,
  is `Music_PokeFluteInBattle`, which is Z80 code (`audio/poke_flute.asm`), not a music
  header. It decodes as one channel with id 15. Nothing plays it. The real routine plays
  `SFX_CAUGHT_MON`, then repoints channels 5–7 to `SFX_Pokeflute_Ch5/6/7`, which are
  music-mode SFX, so it needs A1a's mechanism. → **E1** (Poké Flute); drop the bogus
  entry from both music lists then.
- **Sprite slot order isn't the cartridge's on three maps.** Since A6c, sprite collisions
  (`overworld/sprites.ts` `spriteTable`) give NPCs their slots in the map JSON's order.
  `maps.ts` `NPC_INDEX_FILTER` reorders two maps and drops an object from a third, so
  slots differ from `data/maps/objects/*.asm`:
  - **Viridian City:** the fisher is slot 5 (ROM 6), the walking old man 6 (ROM 7), the
    sleeping old man 7 (ROM 5).
  - **Oak's Lab:** ours starts Oak, rival, ball; the ROM's rival, ball, Oak. OAK2 (ROM
    slot 6) is dropped, so the girl and both scientists sit one slot low.
  - **Blue's House:** the Town Map is slot 2 (ROM 3), because walking Daisy is dropped.

  Slot order decides which NPCs have already moved in a pass and which sprite
  `IsSpriteInFrontOfPlayer` finds first. No visible effect on today's maps.
  → **V5**, with A6c's map-metadata findings (Route 1's youngsters, the Pokécenter
  gentleman, `oldman2`): one map-object audit, data and slots together.
- **Walking Daisy is missing.** `PalletTownDaisyScript` (scripts/PalletTown.asm:203)
  hides the sitting Daisy and shows the walking one (`TOGGLE_DAISY_WALKING`, Blue's House
  object 2, WALK UP_DOWN) once `EVENT_GOT_TOWN_MAP` and `EVENT_ENTERED_BLUES_HOUSE` are
  both set. Our Blue's House drops that object (`NPC_INDEX_FILTER`), and nothing sets
  `EVENT_ENTERED_BLUES_HOUSE` (scripts/BluesHouse.asm:14 sets it on entry). → **V5**, with the slot-order fix above (it needs the same object).
- **The `static_export` › "static/ is up to date" flake recurred.** It failed the first
  full run of the session (775/776) and passed the next three (776/776), and in 0.46 s
  alone. The error text was cut off, but vitest pointed at the test's declaration, which
  fits its default 5 s timeout on a cold file cache (see the 2026-09-28 entry). →
  **A1a**, which reruns setup anyway: an explicit timeout on that one test
  (`notes/16-a1a-plan.md`).
- **Audio, found while planning A1a** (detail in `notes/16-a1a-plan.md` §3 and §8):
  - Fixed in A1a (DECISIONS #40), because the jingles exercise them:
    - the wave channel plays an octave high in every track (hardware ch3 runs at
      65536/(2048−x); gen1recomp's #429 found the same);
    - `toggle_perfect_pitch` is ignored (43 tracks);
    - vibrato rate 0 is treated as off, though it means every frame (the bass of the
      battle themes and Route 3);
    - an SFX restores the music mid-note when it ends.
  - The rest have homes in V5, J2 or before D2. Among them, `.wave5` (Lavender, Pokémon
    Tower) isn't extracted, and the decoder reads past a channel's final infinite loop
    into the next track.

### Found while planning A1c (2026-10-06) — each has a home

Detail: `notes/20-a1c-plan.md` §8.
- **Mid-hop spotting** strands the player on the ledge tile and re-enables input (§1.8). This
  is my reading of the ASM, not tested on hardware. → **V4**; `trainer_tripwires.test.ts`
  fails first.
- **Pallet's "!" (40 frames) and the Oak's Lab rival's (30)** are EmotionBubble: 61 frames on
  screen, frozen, then `UpdateSprites`. Pallet's also comes 10 frames into its `text_asm`.
  → **V5**, reusing `overworld/emotion_bubble.ts`.
- **`NpcWalk.startScript` forces a resting pass on every cutscene walk**, where `MoveSprite_`
  keeps the status. Some scripts write the status first (Pallet's Oak: `$2`, which matches).
  → **J2** cutscene audit: each caller against its ASM.
- **A text box over a trainer** latches its image to `$ff` on the cartridge; ours hides it only
  at render. Sight could fire one pass early after the box closes. It is unreachable with the
  Forest's fixed-facing trainers. → **J2**, with the NPC font-loaded update.
- **`.displayDialogue`'s `UpdateSprites`** on an ordinary A press isn't modelled outside the
  seen gate (A6c's "no extra pass at the interaction"). → **J2**.
- **Gym leaders get no meet music** (`wGymLeaderNo`); `meetMusicFor` has the flag, and
  nothing sets it yet. → **V3**.

### Found while planning A5b3 (2026-10-11) — each has a home

Detail: `notes/28-a5b3-plan.md` §3.3 and §8.
- **SFX are read from the audio bank of the current map's music** (`wAudioROMBank`,
  `DetermineAudioFunction`), and banks `$02` and `$1f` differ for `save`, `turn_on_pc` and
  `enter_pc`. We have always extracted bank `$02`. Oak's Lab, Viridian Forest and Diglett's
  Cave (Route 2) are bank `$1f` music, so `save` there is 3 updates too long today. →
  **V5 SFX catch-up** designs the bank-aware lookup (music → bank, plus the
  `wAudioROMBank` rules around fades and battles); **A5b7** says in its result that it uses
  the bank-`$02` `save` unless that exists; **G1** needs the bank-`$1f` PC sounds for
  Silph Co. 11F, the only PC not under bank `$02` music.
- **Out of A5b3 on purpose** (decision #45 limits the audio to key item and PC):
  `SFX_SHRINK` in Oak's speech, `SFX_TINK` / `SFX_HEAL_AILMENT` in the Town Map UI,
  `SFX_HEALING_MACHINE` in the nurse's heal, the Itemfinder pair and `SFX_DENIED` for a TM
  refusal. → V5, J2 (Pokécenter audit), A3, A2.

### Randomizer / pkmn-sprites — X1, dead last, not needed until year two

Nothing here is required to build the game. Inventory measured 2026-09-05: **6
sets, all covering dex 0001–0151** with matching `back/`; filenames `%04d.png`
(`0019.png` = Rattata):

```
pokemonGen1/Gen1/  red-blue | red-green | yellow    fronts 40×40, backs 32×32
pokemonGen2/Gen2/  gold | silver | crystal          fronts 40×40, backs 48×48 ⚠
```

Unused: Gen 2 dex 0152–0251, all `shiny/`, `crystal/animated/` (252 GIFs — O-2).
Detail + integration traps in `ARCHITECTURE.md` → *The sprite randomizer*.

### Upstream's non-vanilla additions — decide in J2

Upstream adds things the cartridge doesn't have: the "Click to start" splash
(needed — browsers block audio until a click), a **"Skip intro?"** yes/no after
NEW GAME (`menus/main_menu.ts`), the FPS toast and `-`/`+` keys, the `p` pause,
the backtick debug overlay, and mobile touch controls. They're useful during
development; whether each survives into the finished 1:1 game is a J2 audit
question for the user. Don't remove them earlier, don't add more.

### Save origins

`http://127.0.0.1:5173/` and `http://localhost:5173/` do **not** share
`localStorage`. Use **127.0.0.1**.

---

