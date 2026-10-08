# V1c — Trainer battles per the ASM: probe results + plan

2026-09-23, Claude Opus 5.5. **Status: done** (see *Result*) — approved with all four §3 recommendations (DECISIONS #31).
§1–§3 are the research done before any code; *Result* records the slice. Builds on `notes/02-v1-plan.md` §2.3–§2.4 and
§3 V1c.

**Sources:** `refs/pokeyellow` @ `e89ead15`, mainly `home/trainers.asm`,
`engine/battle/core.asm` (`TrainerBattleVictory`, `HandlePlayerBlackOut`),
`engine/battle/scroll_draw_trainer_pic.asm`, `data/trainers/encounter_types.asm`,
`scripts/OaksLab.asm`, `engine/battle/battle_transitions.asm`, `home/pics.asm`, and
pret's sym file (`git show origin/symbols:pokeyellow.sym`). Upstream code read:
`overworld_controller.ts` `handleInteraction`, `main.ts` (`startTrainerBattle`, the
`trainer_approach`, `textbox` and `battle` states), `battle.ts` (faint, EXP, victory,
render), `battle_ui.ts`, `script_controller.ts`, `story/oaks_lab.ts`, `textbox.ts`.

## TL;DR

- **V1c is engine work plus a small data change.** It's about one long session, with a
  clean cut point if it runs over (§2.3).
- **The four fixes from the V1 plan:**
  1. Talking to a trainer shows the before-battle text first. Meet music starts once
     it has finished typing, and the battle starts after you close the text.
  2. On a win, "RED defeated BUG CATCHER!" is followed by the trainer's picture
     sliding back in from the right. After a 40-frame pause come
     "BUG CATCHER: No! / CATERPIE can't / cut it!" and then the money.
  3. The trainer counts as beaten only after a win, on both the talk path and the
     sight path.
  4. A beaten trainer says their after-battle text, not the invented "I lost to you...".
- **Three more departures turned up in the same code:**
  - **The victory fanfare is early.** It plays when a trainer's *first* Pokémon
    faints, so the rest of the fight runs to the fanfare. In the ASM it plays only
    once the trainer's whole party is beaten. Fixed here, since it's part of fix 2.
  - **Losing to your rival in Oak's Lab blacks you out.** It halves your money, warps
    you away, and leaves the lab script unfinished. In the ASM there's no blackout
    there: he says "Yeah! Am I great or what?" and the scene carries on. See
    decision 1.
  - **Map trainers get no battle transition at all.** The screen cuts straight to the
    battle. The ASM picks one of 8 transitions, and upstream has only 2 of them. See
    decision 4.
- **4 decisions (§3), each with a recommendation.** Reply **go** to take all four.

## Result — done 2026-09-23, commit `753e50c`

It landed as planned in §2.1, with all four §3 decisions (DECISIONS #31). **429/429**:
+16 in `battle/trainer_flow.test.ts` plus 1 trainer-pic test there, +2 extraction, +1
`data.test.ts`. Typecheck clean; build OK. The regenerated data diff was exactly
`game_text.json` (+2 keys) plus `meeteviltrainer.json`, giving 164 JSON.

**Two upstream bugs surfaced in the browser check and were fixed.** Neither was
visible before V1c, because no map trainer had ever been fought:
- **Trainer pics were loaded by display name.** "BUG CATCHER" became
  `bug catcher.png`, the file doesn't exist, and `startTrainerBattle` sat in
  `transition` forever. Eleven classes were affected, including JR.TRAINER♀,
  COOLTRAINER♀ and POKéMANIAC. Pics now load by class key (`trainerPicName`), with
  `UNUSED_JUGGLER` → juggler and `PSYCHIC_TR` → psychic from
  `pic_pointers_money.asm`. A test resolves every class except CHIEF, whose pic isn't
  exported and whose class no map or script uses.
- **Species lookup compared names exactly.** Trainer parties and wild tables use pret
  constants (`NIDORAN_F`, `MR_MIME`, `FARFETCHD`), while `pokemon.json` uses
  `Nidoran-F`, `Mr. Mime` and `Farfetch'd`. So the Forest Lass (two Nidoran) hung the
  game, and **Route 22's wild Nidorans silently never appeared** because the encounter
  returned null. `getSpecies()` now ignores case and punctuation, and a test resolves
  every trainer and wild species. Route 22's encounter mix is now the vanilla one.
- Also, `Battle` threw its trainer pic away when the intro ended. It's kept now for the
  scroll-in.

**Browser check (agent-driven, temporary server on :5179, its test saves cleared).**

| Check | Result |
|---|---|
| youngster2: text → meet music | ✓ `meetmaletrainer` loaded only once the last line had typed, and before the A press |
| youngster3 (3 Pokémon) | ✓ no fanfare after the 1st or 2nd faint. After the 3rd: fanfare, "YELLOW defeated / BUG CATCHER!", pic caught mid-scroll and at rest flush right, "BUG CATCHER: Huh? / I ran out of" → "POKéMON!", "¥60" |
| Talk again | ✓ "Darn! I'm going / to catch some…" |
| Save → reload → CONTINUE | ✓ youngster3 still beaten (after-battle text) |
| Lose to youngster2 (HP 1) | ✓ blackout to Pallet. Warped back, he challenges again |
| Lass | ✓ `meetfemaletrainer`, "LASS: Oh no, / really?", ¥90, then her after-battle text |
| Wild Caterpie | ✓ `defeatedwildmon` still plays at the faint |
| Oak's Lab, win (a save written just before the battle) | ✓ "YELLOW defeated BLUE!", pic, "BLUE: WHAT? / Unbelievable!" → "I picked the / wrong POKéMON!", ¥175, the scene continues. Saved `rivalStarter: 2`, money 3175 |
| Oak's Lab, lose | ✓ enemy side cleared, pic slides in, "BLUE: Yeah! Am / I great or what?", **no blackout**. Still in the lab, money 3000, party healed, `BATTLED_RIVAL_IN_OAKS_LAB` set, `rivalStarter: 3` |
| Console | no errors after the pic fix |

**Found on the way** (not fixed; logged in STATUS):
- **Species display names are `pokemon.json`'s, not the cartridge's.** The Lass's
  Nidoran shows as "NIDORAN-F" / "NIDORAN-M"; the ROM's `MonsterNames` say
  "NIDORAN♀" / "NIDORAN♂", and "MR.MIME" is written without a space. Every battle,
  the Pokédex and the party screen use these names.
- **A failed `startTrainerBattle` hangs silently.** It sets `state = "transition"`
  before loading, and there's no recovery if a load fails or `createPokemon` returns
  null. Both known causes are fixed, but the path stays fragile.

## 1. Probe results

### 1.1 Talking to a trainer — `TalkToTrainer` (`home/trainers.asm:84`)

| # | ASM | What the player sees | Upstream today |
|---|---|---|---|
| 1 | beaten flag set? → `PrintText` after-battle text | "Ssh! You'll scare the bugs away!" | "I lost to you..." (invented) |
| 2 | not beaten → `PrintText` before-battle text | the text types out | skipped — no text at all |
| 3 | `SaveEndBattleTextPointers` (won text; the lost text is saved too, never printed — §1.3) | — | no end texts |
| 4 | `EngageMapTrainer` → `PlayTrainerMusic` | **meet music starts as soon as the last line has typed** — the text ends with `done`, which doesn't wait, and the A-press wait comes afterwards in `DisplayTextID` | no meet music |
| 5 | `StartTrainerBattle` sets flags; the text box waits for A, closes, and the overworld loop starts the battle | A → battle (the battle music replaces the meet music) | battle starts at once |

`PlayTrainerMusic` (`home/trainers.asm:381`, lists in `data/trainers/encounter_types.asm`):
- **No meet music** for RIVAL1/2/3, or when `wGymLeaderNo` is set.
- **Evil music** for UNUSED_JUGGLER, GAMBLER, ROCKER, JUGGLER, CHIEF, SCIENTIST,
  GIOVANNI and ROCKET.
- **Female music** for LASS, JR_TRAINER_F, BEAUTY and COOLTRAINER_F.
- **Male music** for everyone else.

The evil track is `Music_MeetEvilTrainer`. `audio.ts` `MUSIC_HEADERS` has it as
`meeteviltrainer`, but both name lists (`rom/index.ts`, `scripts/extract_dev_data.ts`)
spell it `meetevilttrainer`, so it never extracts. That typo is why we have 46 of 47
tracks. No V1 trainer uses it; Gamblers and Rockets do (see decision 3).

`TextBox` already exposes the moment we need: `isWaitingForInput && !hasMorePages` is
"last page fully typed, waiting for A".

### 1.2 Winning — `TrainerBattleVictory` (`engine/battle/core.asm:929`)

Before this runs, `FaintEnemyPokemon` has handled each enemy faint. In a trainer
battle it plays the faint SFX (V5) and **no music**, then "Enemy X fainted!" and EXP.
Only a wild battle gets its fanfare at the faint (`.wild_win`). Upstream plays the
trainer fanfare there too (`battle.ts` `updateFaintAnimation` → `onVictory`), on
*every* enemy faint, and nothing restarts the battle music. Youngster3 has three
Pokémon, so two thirds of his fight would run to the victory fanfare.

The sequence, once the last Pokémon is down:

| # | ASM | Detail |
|---|---|---|
| 1 | `PlayBattleVictoryMusic` | `defeatedtrainer`. It's `defeatedgymleader` for a gym leader or RIVAL3 (RIVAL3 also sets `BIT_NO_MAP_MUSIC`) |
| 2 | `TrainerDefeatedText`, `prompt` | "RED defeated / BUG CATCHER!", then wait for A. The text stays on screen through steps 3–4 |
| 3 | `ScrollTrainerPicAfterBattle` | the pic scrolls in from the right. Step k = 1…6 draws pic columns 0…k−1 at tile x = 20−k…19, then waits 4 frames: **6 × 4 = 24 frames**, ending at tile x 14 (**112 px**) with column 6 off-screen |
| 4 | `DelayFrames 40` | |
| 5 | `PrintEndBattleText` | `_TrainerNameText` (`text_ram wNameBuffer`, then `": "`) is followed by the saved won text on the same line: **"BUG CATCHER: No!"** / "CATERPIE can't" / "cut it!". It prints only if `BIT_PRINT_END_BATTLE_TEXT` is set, which `StartTrainerBattle` (map trainers) and scripts like Oak's Lab do |
| 6 | `MoneyForWinningText`, `prompt` | "RED got ¥70 / for winning!", then the money is added. Money is base × the last Pokémon's level (`read_trainer_party.asm` `.LastLoop`), which upstream already computes |

`SaveTrainerName` copies from `TrainerNamePointers`. In English every entry equals the
class name, and the rivals' entry is `wTrainerName`, the rival's name. So the prefix
is the `trainerName` that upstream's `Battle` already holds.

Every end text's first line has to fit the 18-character line with its prefix. They
all do, and a test will keep it that way:

| Trainer | First line | Chars |
|---|---|---|
| youngster2 | BUG CATCHER: No! | 16 |
| youngster3 | BUG CATCHER: Huh? | 17 |
| youngster4 | BUG CATCHER: I | 14 |
| cooltrainer_f | LASS: Oh no, | 12 |
| youngster5 | BUG CATCHER: After | **18** |
| Oak's Lab rival | BLUE: WHAT? (a 7-letter name gives 14) | ≤ 14 |

Prize money for the verify step: youngster2 ¥70, youngster3 ¥60, youngster4 ¥100,
Lass ¥90, youngster5 ¥80, lab rival ¥175.

**Upstream's battle text** shows each 2-line page whole and pages instead of scrolling
on `cont`. V1c shows the end text with that same convention: ["BUG CATCHER: No!",
"CATERPIE can't"], then ["cut it!"]. The real typing and scrolling are part of the
proposed A5 (§1.6).

### 1.3 Losing — `HandlePlayerBlackOut` (`core.asm:1171`) + `EndTrainerBattle` (`home/trainers.asm:179`)

- **A map trainer:** "RED is out of useable POKéMON! / RED blacked out!", then the
  usual blackout. **The trainer's lost-battle text is never printed:** only
  `PrintEndBattleText` reads the saved pointers, and it runs only from
  `TrainerBattleVictory`. That's why V1a's `endBattleText` (the won text) is all V1c
  needs.
- **Not beaten:** `.battleOccurred` sets `wIsInBattle = LOST_BATTLE`, and
  `EndTrainerBattle` then skips setting the flag (`home/overworld.asm:317`). Upstream
  marks the trainer beaten when the battle *starts* (`main.ts` `startTrainerBattle`
  action and the `trainer_approach` state).
- **RIVAL1 is special-cased:**
  1. The top 8 rows are cleared, the rival's pic scrolls in (24 frames), then 40
     frames pass.
  2. Then `_Rival1WinText` (27:7602): "BLUE: Yeah! Am / I great or what?".
  3. **In `OAKS_LAB` the routine returns there: no blackout.** `.battleOccurred` also
     skips the faint check in `OAKS_LAB` (`home/overworld.asm:287`). Elsewhere (Route
     22, later) it goes on to the blackout.
- **Upstream has no RIVAL1 case.** A loss in the lab goes through its generic
  blackout: money halved, party healed, warp to the last Pokécenter door, and
  `clearScriptBattlePending()`. The lab script never reaches
  `BATTLED_RIVAL_IN_OAKS_LAB` or "Smell you later".
- **After the lab battle** (`scripts/OaksLab.asm:366`): `wBattleResult` sets
  `wRivalStarter`. A win gives **FLAREON (2)** and a loss **VAPOREON (3)**. The Eevee
  pick set JOLTEON (1), and a later Route 22 win turns FLAREON into JOLTEON.
  - The rival's team in every later rival battle depends on this value (Route 22,
    Pokémon Tower 2F, Silph Co 7F, Champion).
  - Upstream doesn't record it anywhere (decision 2).
  - `RemoveFaintedPlayerMon` sets `wBattleResult` = 1 and each enemy faint resets it
    to 0, so in practice a win means 0 and a loss means 1.
- `EndOfBattle` skips evolution and Pay Day money when the battle was lost.

### 1.4 The sight path (for A1)

`TrainerEngage` (`engine/overworld/trainer_sight.asm:226`) runs when a trainer spots
you. It sets `BIT_SEEN_BY_TRAINER` and calls `EngageMapTrainer`, so **the meet music
starts at the moment you're spotted**. Then come the "!" bubble and the walk up, and
`DisplayEnemyTrainerTextAndStartBattle` runs the same text handler. `TalkToTrainer`
prints the before text, sees `BIT_SEEN_BY_TRAINER`, returns before
`EngageMapTrainer` (the music is already playing), and the battle starts. The beaten
flag works the same as on the talk path.

Upstream's `trainer_approach` goes straight into the battle, with no text. No map
sets `sightRange` yet (`npc.ts` `isPlayerInSight` returns false at range 0), so this
path can't fire until A1.

### 1.5 Where the upstream code sits

- **`overworld_controller.ts` `handleInteraction`:** an unbeaten trainer sets
  `npcData.defeated = true` and returns `startTrainerBattle`. A beaten one returns
  "I lost to you..." (also `script_controller.ts:672`, in free-movement scripts).
- **`main.ts`:**
  - `case 'startTrainerBattle'` calls `markDefeated` and then `startTrainerBattle()`.
  - `trainer_approach` does the same.
  - `startTrainerBattle()` sets `state = "transition"` with no animation: the last
    overworld frame stays up until `battle.init()` resolves.
  - `battle.onVictory` → `defeatedtrainer`.
  - The `battle` state's finish handler covers the blackout, evolutions, and the
    return to a script (`isScriptBattlePending`).
- **`battle.ts`:** `handleTrainerVictory()` reuses `gain_exp` to show "defeated" and
  money. The trainer pic is only drawn in `trainer_intro`. `Battle` has no test
  harness, since no test constructs one.
- **`story/oaks_lab.ts`:** `{ type: 'startBattle', trainerClass: 'RIVAL1', … }`. The
  win and loss texts aren't extracted: `_OaksLabRivalIPickedTheWrongPokemonText` is at
  2A:4EAF and `_Rival1WinText` at 27:7602.

### 1.6 Found in the same code: not the four fixes

| Finding | ASM | Proposed home |
|---|---|---|
| **Battle transitions.** The ASM chooses from 8 using 3 bits: trainer, enemy ≥ your lead + 3 levels, dungeon map. The dungeon list has a known bug (it misses Victory Road 2F/3F, Rocket Hideout, Seafoam B1F–B4F, Power Plant, Diglett's Cave, …). Animations: DoubleCircle, Circle, Spiral (two directions), Horizontal / Vertical stripes, Shrink, Split. Upstream has only the spiral and flash + horizontal stripes, and uses the stripes for **every** wild battle, though Route 1/2/22 should get DoubleCircle or Circle. Map trainers get nothing. The Forest is a dungeon map, so its trainers should get Shrink (or Split when stronger) | `engine/battle/battle_transitions.asm`, `data/maps/dungeon_maps.asm` | **A5** (decision 4) |
| **Enemy pic x.** The ASM centres a w-wide pic at tile 12 + ⌊(8−w)/2⌋ (`LoadUncompressedSpriteData`). Upstream right-aligns (`GB_WIDTH − w − 8`), so **all 47 5×5 front pics** (Caterpie, Metapod, Weedle, …) sit 8 px too far right. The 6×6 and 7×7 pics are correct | `home/pics.asm:58`, `battle_ui.ts:210,254` | A5 |
| **Trainer intro pic x.** It's drawn at tile 12 (`init_battle.asm:46`, 96 px); upstream uses 104 | `battle_ui.ts:690` | A5 |
| **Battle text shows whole**, and `cont` pages instead of scrolling. The ASM types it out and scrolls | `home/text.asm` | A5 |
| **Beaten trainers start turning at random.** `PrintEndBattleText` → `SetEnemyTrainerToStayAndFaceAnyDirection` sets STAY/NONE until the map reloads | `engine/overworld/npc_movement_2.asm:1` | joins the existing "STAY/NONE NPCs turn at random" finding (`02-v1-plan.md` §5) |
| **Post-battle Pikachu mood floor.** After any battle not lost, mood is raised to at least 130 ($82) if the starter Pikachu is alive in the party | `end_of_battle.asm` → `pikachu_status.asm:117` | the Pikachu "not yet implemented" table (root `CLAUDE.md`); V5 or when happiness is next touched |
| **Pokémon placed as trainers** (class < 200, like Power Plant's Voltorbs) are hidden after the battle | `EndTrainerBattle` → `HideObject` | note for F/H, when those maps arrive |
| **Gym leaders:** no meet music (`wGymLeaderNo`), the `defeatedgymleader` fanfare, and `gymleaderbattle` battle music | `PlayTrainerMusic`, `TrainerBattleVictory`, `audio/play_battle_music.asm` | V3 (Brock). V1c's helpers take an `isGymLeader` flag so V3 only has to pass it |

## 2. The plan — V1c

### 2.1 Steps

1. **Pure module `src/battle/trainer_flow.ts`** (new, ASM-cited, no DOM), holding the
   rules as data so they can be unit-tested (no test constructs a `Battle`):
   - `meetMusicFor(trainerClass, isGymLeader)`: evil, female or male track, or `null`
     for a rival or gym leader.
   - `victoryMusicFor(trainerClass, isGymLeader)`: `defeatedtrainer` or
     `defeatedgymleader`.
   - `endBattleTextPages(trainerName, text)`: the `"NAME: "` prefix, then pages of 2
     lines, starting a new page at `\f`.
   - `victorySequence(opts)`: the ordered steps of §1.2 (text / pic scroll with its x
     per frame / delay 40 / end text if any / money).
   - `lossSequence(trainerClass, mapName)`: for RIVAL1, the pic scroll, 40 frames,
     `RIVAL1_WIN`, and `blackout: mapName !== 'OaksLab'`. Otherwise just the blackout.
   - `rivalStarterAfterLabBattle(won)`: 2 or 3.
2. **Types.** `NpcData` gains `endBattleText?` and `afterBattleText?`. They're already in
   the JSON.
3. **The talk path.**
   - `handleInteraction`: an unbeaten trainer returns a new `talkToTrainer` action and
     no longer sets `defeated`. A beaten one shows `afterBattleText`.
   - Remove "I lost to you..." from both sites.
   - `main.ts` gets one `engageTrainer(npc, seen)`:
     - it shows the before text, and when the last page has typed, plays
       `meetMusicFor(...)` (skipped if `seen`);
     - when the text closes, it calls `startTrainerBattle(..., { endBattleText,
       engaged: { map, npc } })`.
   - The pending encounter lives in module state next to `ow.interactedNpc`.
4. **Beaten only on a win.**
   - Drop both early `markDefeated` calls.
   - In the `battle` finish handler: if there was an engaged map trainer and it
     wasn't a loss, set `npc.data.defeated` and call `recordDefeated`. This happens
     before any evolution starts.
   - Saves are unchanged: same `defeatedTrainers` set.
5. **The sight path.** After the approach, `trainer_approach` calls `engageTrainer(npc,
   true)`: before text, then the battle. The spotting-time meet music and the "!"
   bubble stay with A1, which can verify them. Until then this path is unreachable
   (§1.4).
6. **`battle.ts` victory.**
   - For trainer battles, `onVictory` moves from the faint animation to the start of
     the victory sequence. Wild battles keep it at the faint.
   - `handleTrainerVictory()` plays `victorySequence()`, with one small state per
     step.
   - `Battle` gets `endBattleText?` from `startTrainerBattle`.
   - `render()` draws the trainer pic at the scroll x, clipped at the screen edge,
     from the step-3 scroll onwards. It uses the colored sprite, since
     `SET_PAL_BATTLE` runs before the scroll.
   - The enemy side stays empty and the "defeated" text stays in the box during the
     scroll and the pause.
7. **`battle.ts` loss.**
   - When the party is wiped by RIVAL1, run `lossSequence()` before (Route 22) or
     instead of (Oak's Lab) the blackout text.
   - In the lab: `isBlackout` stays false and a new `playerLost` flag is set.
   - `main.ts` then skips the blackout warp and evolutions, and returns to the lab
     script, which heals the party as it does already.
8. **Oak's Lab** (`story/oaks_lab.ts`):
   - `startBattle` passes `endBattleText: getText('LAB_RIVAL_WRONG_POKEMON')`. The
     `startBattle` script command and the `startBattleTransition` action gain an
     optional `endBattleText`.
   - After the battle, record `rivalStarter`. **Decision 2.**
9. **Data** (extractor, then `npm run setup pokeyellow.gbc`, then diff the regenerated
   data):
   - `game_text.ts` gains `LAB_RIVAL_WRONG_POKEMON` (2A:4EAF) and `RIVAL1_WIN`
     (27:7602).
   - Fix the `meetevilttrainer` typo in both lists (**decision 3**), which gives 47
     tracks and 164 JSON.
   - The expected diff is `game_text.json` plus one new music file, and nothing else.
10. **Docs:**
    - `battle/ARCHITECTURE.md` (the victory and loss sequences) and
      `overworld/ARCHITECTURE.md` (the talk flow);
    - root `CLAUDE.md` (baseline, music count, Pikachu table + mood floor);
    - STATUS, PLAN (A5 if approved), DECISIONS #31;
    - the findings from §1.6.

### 2.2 Tests (≈ +14, 409 → ~423)

- `src/battle/trainer_flow.test.ts`:
  - meet music: male by default, all 4 female classes, all 8 evil classes, `null`
    for RIVAL1/2/3 and gym leaders;
  - victory music: normal, gym leader, RIVAL3;
  - end-text pages, including a `\f` split;
  - **every map trainer's end text** (read from `data/maps/*.json`) keeps its first
    line within 18 characters once prefixed;
  - the victory sequence: step order, scroll x 152 → 112 in 6 steps of 4 frames,
    then 40, with no end-text step when there's no text;
  - the loss sequence: a plain trainer, RIVAL1 in the lab (no blackout), RIVAL1
    elsewhere (blackout);
  - `rivalStarterAfterLabBattle`.
- `extraction.test.ts`: the two new text keys match the ASM strings. The existing
  "extracted JSON == `data/`" test covers the music file.

### 2.3 Size and cut point

It's one long session. If it runs over, stop after step 5: the overworld side is
done (text, meet music, beaten timing, after text), with tests and a commit, and
steps 6–8 (the battle-side sequences and the rival) become V1c-2. Nothing half-done
gets committed.

### 2.4 Verify

Automated checks: typecheck, the full suite with the ROM, and `npm run build`.

**In the browser, agent-driven, then your play-test.** Debug-warp to the Forest,
Skip Intro for the Pikachu:

| Check | Expected |
|---|---|
| Talk to each of the 5 trainers | Before text, then meet music once it has typed (male; **female** for the Lass). A → battle |
| youngster3 (3 Pokémon) | No fanfare until the third faints |
| Each win | Fanfare → "RED defeated / BUG CATCHER!" → A → pic slides in from the right → pause → "BUG CATCHER: …" end text → "RED got ¥… / for winning!" (money per §1.2) → overworld, map music |
| Talk again | The after-battle text (youngster4's has two paragraphs) |
| Lose on purpose (debug overlay: HP to 1) | Blackout text only → Pokécenter; the trainer still battles you afterwards |
| Save → reload → CONTINUE | Beaten trainers stay beaten |
| Oak's Lab, win (new game) | "BLUE: WHAT? / Unbelievable!" → "I picked the / wrong POKéMON!" → ¥175 → "Smell you later" scene |
| Oak's Lab, lose | Pic slides in → "BLUE: Yeah! Am / I great or what?" → **no blackout**, money kept → the scene continues, party healed |
| Wild battle on Route 2 | Fanfare still at the faint (unchanged) |

### 2.5 Not in V1c

- Battle transitions, pic positions, battle text typing (A5, decision 4).
- Spotting-time meet music and the "!" bubble (A1).
- Random turning after a battle (the NPC-turning finding).
- Faint SFX (V5).
- Gym-leader music (V3).
- Route 22's rival battle (its own slice, which will read `rivalStarter`).

## 3. Decisions

1. **Fix the Oak's Lab loss in V1c?** **Recommended: yes.** It's the same code path as
   the rival's win text. Today a loss there blacks you out and leaves the lab scene
   unfinished, which the original never does. The fix is `lossSequence()` plus
   "no blackout in `OaksLab`".
2. **Record the rival's starter (`wRivalStarter`) now?** **Recommended: yes.** The lab
   battle is the only time its result is known. Every later rival team depends on it:
   Route 22, Pokémon Tower, Silph Co, the Champion.
   - It would be stored as a small `rivalStarter` value, saved alongside the rival's
     name: FLAREON (2) on a win, VAPOREON (3) on a loss.
   - Saves made before V1c won't have it. The Route 22 slice picks a fallback.
3. **Fix the `meetevilttrainer` typo in V1c instead of V5?** **Recommended: yes.** V1c
   implements `PlayTrainerMusic` whole, and the fix is one word in two lists plus a
   regenerated music file. Otherwise the function would point at a track that
   doesn't exist until V5.
4. **Add a new slice, A5 "Battle presentation per the ASM"?** It covers:
   - all 8 transitions and the choice between them, keeping the dungeon-list bug;
   - the pic positions (47 Pokémon and the trainer intro, §1.6);
   - battle text that types out and scrolls on `cont`.

   **Recommended: yes, queued right after A1 (before V2).** It's 1–2 sessions, has no
   map dependency, and makes every battle from V2 on look right while you play-test.
   The alternative is the end of Phase A, which keeps Phase V moving sooner but leaves
   every V-phase battle with the wrong transition. Until A5, map-trainer battles keep
   today's instant cut rather than borrowing the spiral: the Forest's correct
   transition is Shrink or Split, so the spiral would be just as wrong.
