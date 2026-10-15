# A5b5c review: review fixes, BUG-1, the yes/no menu, the nurse, cleanup

**2026-10-12 · Claude (Opus 5.5) reviewing Sol (GPT-6.1)'s five commits against `notes/35-a5b5c-plan.md`
(approved, DECISIONS #50):**
- `94555e5` CP1, the review fixes
- `659ef0a` CP2, BUG-1
- `4f632fd` CP3, menu timing
- `f07f6c7` CP4, the nurse
- `34f8947` CP5, cleanup and result

## Verdict: passed. One small fix (F-1). It does not block the user's play-test.

F-1 is a quarter-second cursor detail in the yes/no menu, and one of Sol's new tests pins the wrong picture.
The user can play-test now. Sol then lands F-1 in one small commit, together with anything the play-test
finds, and I check only that commit.

## What I checked

### Gates

I re-ran every gate myself from `34f8947`.

- **Setup**, run twice: `npm run setup pokeyellow.gbc`. `git status` stayed clean after each run, so the
  committed `data/` and `static/` are exactly what the extractor produces.
- **Typecheck:** clean.
- **Tests with the ROM:** `ROM_PATH=pokeyellow.gbc` gives **1195/1195** across 60 files.
- **Tests without the ROM:** **1072 pass / 123 skip**.
- **Build:** `npm run build` is clean (121 modules, 342.07 kB JS).

These are the same numbers as Sol's. I did not repeat Sol's browser run.

I counted the committed sprite PNGs:
- 67 are 16×96.
- 9 are 16×16: boulder, clipboard, fossil, gambler_asleep, old_amber, paper, poke_ball, pokedex and snorlax.

Pret's tenth 16×16 picture, `question_mark.png`, is not one of our 76 overworld entries.

### CP1: Oak's facing and the Lab music

- **F-1 (note 34).** The speech now turns the rival (sprite 1) up and never turns `prof_desk`, which
  matches `OaksLabOakChooseMonSpeechScript`.
- **F-2 (note 34).** All four sites use a `restoreMapMusic` command that calls `deps.restoreMapMusic`.
  `main.ts:1342` clears `currentMapMusic` and replays the map's own track. That matches `PlayDefaultMusic`,
  which zeroes `wLastMusicSoundID` and so always restarts the song. The test reads `OaksLab: 'oakslab'` from
  `main.ts`.

### CP2: BUG-1, the sprite sizes

`readSpritePictureMetadata` is the A5b2 check moved into a shared function, not copied. It swaps the nibbles
of the size byte, uses the same Pikachu and `FIRST_STILL_SPRITE` rule, and fails if the size byte and the
picture kind disagree. `extractOverworldSprites` reads:
- 24 contiguous tiles for a walker: the standing half, then the walking half at `+$c0`;
- 4 tiles for a still sprite.

The pret test compares RGBA rows directly. It covers every available row, including the 16×48 standing-only
sheets and the nurse's bow rows 48–63.

`npc.ts` now treats `height === 16` as still: row 0, no flip, whatever the facing or walk frame. That
matches `PrepareOAMData` entry 0. Any height other than 16 or 96 is a load error.

The other sheet users stay inside rows 0–95:
- `player.ts` and `pikachu_follower.ts` (frames 0–80);
- the party icons (BALL and HELIX use `poke_ball` row 0; the walkers use rows 0 and 48);
- the Town Map and Pokédex `red.png`.

### CP3: the yes/no menu

I re-derived the timing from `HandleMenuInput_`, `DisplayTwoOptionMenu`, `_Joypad` and
`JoypadLowSensitivity`:
- With `hJoy7 = 0`, `hJoy5` is exactly `hJoyPressed`.
- `wMenuWatchedKeys = A|B`, so any other key goes back to `.loop1` (`PlaceMenuCursor` then `Delay3`).
- B always picks the second option.
- After the choice comes `DelayFrames 15`, then the tile restore.

The TS matches on every count:
- first read at +3;
- a re-arm of +3 after any non-A/B key;
- a 15-tick tail with no reads, and the branch runs on the 15th tick;
- Up beats Down, there is no wrap, and A+B together gives the second option.

The one exception is F-1 below.

### CP4: the nurse

I compared `story/pokecenter.ts` line by line with `engine/events/pokecenter.asm`:
- Welcome comes first, then the flag test-and-set, then ShallWeHeal on the first visit only.
- The `UpdateSprites` after the menu runs in both branches and sees the box.
- `SetLastBlackoutMap` runs on YES only.
- Both `LoadCurrentMapView` sites are `displayHide`, followed in the same tick by `Delay3`.
- NeedYourPokemon stays up through the machine. Farewell, with its `pause`, is followed by `UpdateSprites`,
  then the outer wait, Hold and the 17-frame close.
- A6e's Pikachu calls and waits (64/6/30/6/3/40) are unchanged.

Some engine details:
- **`displayHide`** clears `border`. `TextBox.render` then draws nothing, glyphs included, which matches
  `LoadCurrentMapView` redrawing the whole view. The next `printText` brings the box back with its clear and
  `Delay3`.
- **Joypad reads** are no longer synced during the machine inside a session (`script_controller.ts:317`).
- **The saved Pikachu facing** is applied at close start, through `restoreFacingAtClose`.
- **Dispatch** goes through `registerTextScript` and the generated `script` call. The test renames the nurse's
  id and still reaches her.

### CP5: cleanup

- `exclamation` (its state, tick and render fallback) and `uiEntryUpdates` are gone. No production source
  names them (grep).
- The census now lists `ViridianPokecenter:4` as the cable club receptionist, and STATUS *Notes for later*
  holds it.
- `renderScriptExclamation` now draws only the `emotionBubble`. Only the name is old.

### My own mutations

I edited production code (not test instances), ran the tests, and reverted each with `git checkout`. The tree
was clean afterwards.

| # | Mutation | Failures |
|---|---|---|
| M1 | Extractor reads `tileCount * 16` again | 2 (the size test and `static/` up to date) |
| M2 | Answer tail 14 instead of 15 | 11 (menu, display commands, caller traces) |
| M3 | Box left up during the bow | 7 nurse tests |
| M4 | `USED_POKECENTER` set after ShallWeHeal | 1 (the first-visit trace) |
| M5 | `isStatic = false` (still sprites use their facing's rows) | 4 renderer tests |

### Existing-test edits

Each edit has a reason, and none weakens a cartridge assertion.
- **`display_commands.test.ts`:** now pins +3 and 15 (§3.3).
- **The census:** now accepts handlers or script kinds, keeping the 30-object count and the XOR between
  registered and excluded entries.
- **The two tripwires:** use string lists now that the type is gone.
- **`overworld_controller.test.ts` `healScript()`:** turns the migrated builder back into legacy quick-text
  commands so the A6e traces still run.
  - This is outside §8, and Sol says so. I accept it, because every A6e assertion below it is unchanged and the
    real session is covered in `pokecenter.test.ts` for both the healthy and the fainted starter.
  - It depends on the legacy `text` command, so it must move to real sessions when A5b7 retires that command
    (N-3).

## Required (does not block the play-test)

- **F-1 (P3) After B, the ▶ jumps to the second option. On the cartridge it stays where it was.**
  - **The cartridge.** On B, `HandleMenuInput_` returns from `.checkIfAButtonOrBButtonPressed` without calling
    `PlaceMenuCursor`. `DisplayTwoOptionMenu .choseSecondMenuItem` writes `wCurrentMenuItem = 1` but draws
    nothing. So for the 15 frames of `DelayFrames 15` the ▶ stays on YES/HEAL if that is where it was, and the
    menu then closes on the NO/CANCEL branch.
  - **The TS.** `yes_no_menu.ts:41` sets `this.cursor = 1` ("B selects and draws the second item"), so `render`
    draws the ▶ on NO for those 15 frames. `yes_no_menu.test.ts` ('b keeps the menu and chosen cursor…')
    asserts y = 80 for B, and `menus/ARCHITECTURE.md` repeats the claim.
  - **Fix.** On B, keep the drawn cursor and set the answer to `'no'` directly. Flip that test so B with the
    cursor on YES still draws ▶ at YES (y = 64) for all 15 frames. Keep "A+B gives the second option". Correct
    the menus doc line.

## Notes (non-blocking)

- **N-1 (P4) The map music now restarts after the machine.**
  - CP4 adds `restoreMapMusic` after `pokecenterHeal`, where the old A6e script had nothing. The cartridge does
    restart the map song there, with a direct `PlaySound` of `wMapMusicSoundID`, so the end state is right.
  - Plan §9 had put that restore with the machine slice. Until that slice lands, the user will hear the
    Pokécenter theme jump back to its start after the silent flashing. On the cartridge it comes back after the
    fade-out and the healed jingle.
  - Accepted, since the step is faithful and the machine slice adds what comes before it.
- **N-2 (P4) Some committed "mutation" tests only mutate their own data.**
  - Examples: `yes_no_menu.test.ts` 'detects initial Delay3 removed in memory' and 'detects the 15-frame answer
    tail removed in memory'; `pokecenter.test.ts` 'detects a NO blackout callback inserted in memory'; the
    second half of the third `overworld_sprites.test.ts` case.
  - Each one sets a private field or pushes a command, then asserts that `expect` throws. It would pass
    whatever production does.
  - Mutation checks belong in the result note, run against production and reverted, not in the suite. They do
    no harm. Sol may drop them in the F-1 commit, and the count changes by the number dropped.
  - Not affected: the real ROM-byte rejection test (still sprite given `$c0`) and the 96-tall-sheet renderer
    case are true tests and should stay.
- **N-3 (P4, A5b7) The A6e fixture depends on legacy `text`.** `overworld_controller.test.ts` `healScript()`
  converts `printText` to legacy `text`. When A5b7 removes `text`, these A6e traces need to run on the real
  session (as `pokecenter.test.ts` does) with the same assertions. Add this to the A5b7 plan.
- **N-4 (docs) Stale comment in `ui_entry.ts:64-68`.** It says the Pokécenter turns opening updates off and on.
  That toggle is now set only by `displayOpen {spriteUpdate}` and reset in `initScript`. One-line fix, F-1
  commit or later.
- **N-5 (play-test expectation) Older saves see "Shall we heal" once.** A save made before this slice has no
  `USED_POKECENTER` flag, even if it has healed before. Its next visit shows "Shall we heal your POKéMON?" once,
  then never again. A cartridge save that had healed would skip it. Nothing to fix.

## State after the review

A5b5c is **done pending F-1** (one small Sol commit). The user can play-test now (A = Z, B = X):

1. **Viridian Forest.** Stand near each item ball and watch it for a while. It must always look like a Poké
   Ball, never a fossil or a boulder.
2. **Oak's Lab** (only from a new game, if you want to check it again). Oak faces you through the "choose a
   POKéMON" speech. After the speech, the rival's exit and the Pokédex scene, the Lab's own theme plays, not
   the Pokécenter's.
3. **Pokécenter, first visit:** "Shall we heal your POKéMON?" appears (see N-5). Choose HEAL:
   - The text box disappears while Pikachu walks to the counter.
   - "OK. We'll need your POKéMON." stays up through the machine.
   - The box disappears again while the nurse bows.
   - Then the farewell appears.
   - The machine is still silent, and the music restarts after it (N-1). Both are expected until the
     healing-machine slice.
4. **Pokécenter, second visit:** no "Shall we heal" line; the HEAL/CANCEL menu appears right after the welcome.
5. **Pokécenter, CANCEL:** no heal, straight to the farewell.
6. **The caterpillar youngster** in Viridian City: answer YES once and NO once. After you press, the menu stays
   for about a quarter of a second before the text continues.

**User play-test 2026-10-12: all six points passed** ("it all went well, all 6 points checked off successfully").

## F-1 check (2026-10-12): closed

Sol's `7839e37` fixes it. On B the answer is NO and `this.cursor` is left alone, so the ▶ stays where it was for all
15 frames (A+B still gives NO). The test now checks the ▶ at y = 64 on every tail frame for both A and B. The menus
doc and the N-4 comment are corrected. N-2 (the self-mutating tests) is left for a later touch of those files.

I re-ran the gates: typecheck clean, ROM 1195/1195, no-ROM 1072/123, build clean (121 modules, 342.06 kB). No
extractor changed, so no setup run. My mutation (put `if (isPassPressed('b')) this.cursor = 1` back) fails exactly
the B render test; reverted, tree clean.

**A5b5c is done.**

**Next (as of the review):** Sol's F-1 commit (with any play-test findings), then A5b6 (school, Town Map, Oak's speech), which
needs a plan.
