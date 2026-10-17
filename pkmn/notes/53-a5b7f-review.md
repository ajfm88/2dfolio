# A5b7f review: the START menu and SAVE (Sol, CP2–CP5)

**2026-10-15 · Claude · Passes. No required fix. Next: the user's play-test (note 52 §8, both halves).**

Reviewed commits `0da8f48`…`6fb3c92` against approved note 52 (DECISIONS #59), my CP1 check (`5ea60c7`) and
the result sections (note 52 §§11–14). The user lifted the checkpoint stops during CP3, so A5b7f1 and A5b7f2
are reviewed together here.

## 1. Gates (re-run by Claude)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `ROM_PATH=pokeyellow.gbc npx vitest run` | **1563/1563**, 86 files |
| `npx vitest run` (no ROM) | **1433 pass / 130 skip** |
| `npm run build` | clean, 358.74 kB (gzip 108.73 kB); no `mainTest` hook in the bundle |

Working tree clean before and after. No generated-data or save-schema change.

## 2. Traced against the ASM

`menus/start_menu.ts`, `menus/save_menu.ts`, `MenuInput.lastItem` and main's dispatch were read against
`home/start_menu.asm`, `engine/menus/draw_start_menu.asm`, `home/window.asm` (HandleMenuInput_,
PlaceMenuCursor), `engine/menus/start_sub_menus.asm`, `engine/menus/save.asm`, `engine/menus/main_menu.asm`
(PrintSaveScreenText) and `home/text_script.asm` (HoldTextDisplayOpen).

| Area | Verdict |
|---|---|
| Opening: border at T, transfer off, sprite hook at T; sound, labels and cursor at T+20; first read T+23 | matches |
| DrawStartMenu: (10,0) 14×8 / 12×8, labels at (12,2) two rows apart, no-delay set then cleared, cursor = saved, max 7/6 | matches |
| `wLastMenuItem`: written at each placement (construction, `restart()`), read before the move | matches PlaceMenuCursor |
| Up wraps only at 0 with last 0; Down to the hidden 7/6 wraps to 0; both erase, place, Delay3 | matches `.loop` |
| A + Up/Down: A blocks the move, the loop still takes the Up/Down branch; B + Up still moves and beeps | matches |
| A/B/START: ▷, saved byte on all three; A/B beep, START silent; Buffer2 only on A; EXIT closes like B | matches `.buttonPressed` |
| CloseStartMenu: second Joypad in the same frame (newly pressed A only), 5 copy frames, then the unchanged core: C+10+2W | matches |
| Tails (CGB): dex R+3, party R+35, item R+5, trainer R+20, option R+5; read +3; white palette for party/trainer | matches note 52 §4.4 |
| Empty party: `jp z, RedisplayStartMenu` in the same frame, read +3 | matches |
| Cursor byte: WRAM (`wram.asm:389`, outside every saved range), 0 on new game and load, never saved | matches |
| PrintSaveScreenText: box (4,0) 8×14, 5 copy frames, UpdateSprites, labels incl. the tile spaces, badges (17,4), owned (16,6), hours (13,8), $6D (16,8), minutes with zeros (17,8) | matches |
| SaveMenu: 30 + 10, typed question at S+45 (glyph S+48), YES/NO at (0,7) default YES, read Q+3, the 15-frame tail | matches |
| YES: 10, write at A0+25 **before** SavingText, 128, GameSavedText, 10, wait for the current sound, `save`, wait, 30 | matches |
| Both answers: Buffer2 (▷ on SAVE), held-A poll, then the shared close with no START copy and no redisplay | matches StartMenu_SaveReset |

Three details are equivalent rather than literal, and I accept them:
- The dex/item/option tails call UpdateSprites twice in one frame, as the ASM does. Dropping the first (R9 below)
  changes nothing, because both see the same coverage.
- The party tail leaves out ReloadMapSpriteTilePatterns' UpdateSprites at R+24. The palette is white and the
  coverage is the same as at R+35.
- The script's `openStartMenu` no longer sets `stateBeforeMenu = 'script'`. The old exit already went through
  `menu_closing` to the overworld, so nothing read it.

## 3. Reviewer mutations (each restored; 8 focused files, 114 tests)

| # | Mutation | Result |
|---|---|---|
| R1 | Up wraps without the `wLastMenuItem` check | caught (1) |
| R2 | `restart()` leaves `lastItem` stale | caught (3) |
| R3 | START beeps | caught (2) |
| R4 | Close copy 4 frames | caught (6) |
| R5 | Saved byte only on A | caught (2) |
| R6 | Trainer tail 17 (DMG) | caught (4) |
| R7 | Party tail 32 (DMG) | caught (4) |
| R8 | Option tail 1 | caught (4) |
| R9 | Dex tail's first UpdateSprites dropped | survived, **equivalent** (§2) |
| R10 | No-delay left set after DrawStartMenu | caught (1) |
| R11 | CloseStartMenu loops on held A | caught (2) |
| R12 | No ▷ on A | caught (34) |
| R13 | EXIT skips the close copy | caught (2) |
| R14 | Up/Down without Delay3 | caught (1) |
| R15 | Labels and sound at T+19 | caught (5) |
| V1 | YES/NO defaults to NO | caught (4) |
| V2 | Badges at column 18 | caught (3) |
| V3 | Minutes without leading zeros | caught (3) |
| V4 | No UpdateSprites at S+5 | caught (1) |
| V5 | Info drawn at S+1 | caught (1) |
| V6 | `save` without waiting for the current sound | caught (1) |
| V7 | NO path skips the Buffer2 restore | caught (4) |
| V8 | The lingering message box clears at the top third, not the bottom | **survived** (N-1) |
| V9 | 9 frames instead of 10 before the save sound | **survived** (N-1) |
| V10 | Question at S+44 | caught (1) |
| M1 | `menu_closing` no longer dismisses the text box | **survived** (N-1) |
| M2 | Palette left white after the party | caught (6) |
| M3 | Empty party: no redisplay | caught (1) |
| M4 | SAVE close adds START's 5 copy frames | caught (6) |
| M5 | First close frame paints START instead of the save display | **survived** (N-1) |
| M6 | ITEM return drops the bag's retained scanout | **survived** (N-1) |
| M7 | Load keeps the old START cursor | caught (1) |

That is 26 of 31 non-equivalent mutations caught, on top of Sol's 13.

## 4. Notes (none block the play-test)

- **N-1: five lines have no test.** The code is right in each case.
  - **M1 matters most.** Without `textBox.dismiss()` at the end of `menu_closing`, the message box stays active
    after a SAVE whose A was already released, and the overworld then runs with a text box up. I checked that
    one assertion catches it: `expect(host.textBox.active).toBe(false)` after the close in the main YES test
    fails 3/3 under M1 and passes today.
  - **V9:** the 10 frames after GameSavedText are only tested behind a longer "current sound", which hides them.
    Add a case with no sound playing: `save` starts at R2+10.
  - **M6:** the bag's image held through the 5 ITEM copy frames is tested in `screen_tiles` but not through main.
  - **V8/M5:** the message box's last 1–2 frames during the restore and the first close frame.

  Add these in A5b7g with note 51 N-1, or now if you want them.
- **N-2:** the Pokédex and OPTION returns keep their legacy screen until the tail ends, then show START all at
  once. The cartridge replaces the old screen one third per frame once transfer resumes (dex R+1–R+3, option
  R+6–R+8), so the picture differs for up to 3 frames. Those screens aren't on `ScreenTiles` yet, so this
  belongs to their J2 audits.
- **N-3:** STATUS's *Completed* table had the new A5b7f row above the `|---|---|` line, which breaks the table.
  I fixed it in this review's commit.

## 5. Verdict

**Passes.** The user can play-test note 52 §8 (START, then SAVE) at `http://127.0.0.1:5173/`
(**Z = A, X = B, Enter = START**). SAVE YES overwrites the save on that origin.
