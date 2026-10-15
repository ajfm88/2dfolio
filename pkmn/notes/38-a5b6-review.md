# A5b6 review: the school notebook, the blackboard, the Town Map sign, Oak's speech

**2026-10-13 · Grok 4.7 reviewing Claude's CP1–CP3 and Codex/Sol's CP4–CP5 against `notes/37-a5b6-plan.md`
(approved, DECISIONS #51).** Claude was unavailable, so this review stands in for the one the plan stopped for.

- `ad397c2` CP1, the notebook and N-1
- `8ba1f11` CP2, `HandleMenuInput_` and the blackboard
- `3689f23` CP3, the Town Map sign
- `2bbe6ba` the CP3 handoff (docs only; the unfinished CP4 start was reverted)
- `3aa238c` CP4, Oak's speech
- `2f08803` CP5, cleanup and the implementation result

## Verdict: passed. No required fix.

The user can play-test now (checklist at the bottom; A = Z, B = X, on `http://127.0.0.1:5173/`).
Nothing in this review starts A5b7, the healing-machine slice, or the intro-animation slice.

## What I checked

### Gates

Re-run from `2f08803`. No extractor or generated file is in `20a1c01..2f08803`, and the ROM suite's
static-export test passed, so setup was not run.

- **Typecheck:** clean.
- **Tests with the ROM:** `ROM_PATH=pokeyellow.gbc` gives **1242/1242** across 64 files.
- **Tests without the ROM:** **1119 pass / 123 skip** (60 files passed, 4 skipped).
- **Build:** `npm run build` is clean (121 modules, 342.82 kB JS, gzip 101.23 kB).
- **`git diff --check`:** clean. `git status` was `## master` with no remote.

These match the implementation result at the bottom of note 37. I did not repeat the muted browser run
on `:5188`.

### CP1: the notebook, and the arrow-less wait

`DisplayTextID` opens in 20 frames. A new `PrintText` adds `Delay3`, so the first glyph is at +23.
The builder is one display: four page programs, three `TurnPageText` questions through `yesNoChoice`
(empty NO), then Text5. Text5's program ends in `text_waitbutton`, which is `manual(0, false)`: no ▼,
and tile (18, 16) is left alone. The arrow form still clears it. `outerWait` is false, so the display
goes to Hold and the school close (13 frames: font-loaded `1 + 2×4 + 4`) on the question's return tick
when the answer is NO, and after Text5 when the answer is YES. `YesNoMenu` is unchanged: first read at
+3, 15-frame tail, B selects NO and leaves the drawn cursor where it was.

### CP2: `HandleMenuInput_` and the blackboard

`menus/menu_input.ts` matches `home/window.asm` `HandleMenuInput_` for the callers this slice has:

- Delay starts at 3. `if (delay > 0 && --delay > 0) return null`, then one read. An unwatched key sets
  the delay back to 3.
- Up and Down move only when A is not also pressed. No wrap.
- A or B in the returned set plays the press sound. There is no 15-frame tail. That tail stays on
  `DisplayTwoOptionMenu` / `YesNoMenu`.

The blackboard is one hidden-event display. Text1 uses letter delay. Each loop draws the menu, prints
Text2 with `noDelay` (PrintText's own Delay3 already happened), then reads. The result order is B,
RIGHT, LEFT, then the item. Item 5 is QUIT. Headings use letter delay, and the menu box stays up
through them. `drawBox` covers sprites the same way the text box does. Exit restores the empty bordered
box, then Hold and the 13-frame close. `BlackboardMenu`, the `blackboard` state and `openBlackboard`
are gone.

### CP3: the Town Map sign

The bookshelf dispatches the script id, so the sign is `TownMapText` and not an instant text box.
The direct print has no extra `Delay3`: first glyph at +20, then ▼ and the beep. White-out is immediate,
then 3 frames, then the doubled font copy. `CopyVideoDataDouble` of 128 1bpp tiles also delays on the
final `c = 0` pass, so that copy is 17 frames and the white span is 20.

The handler's `jp CloseTextDisplay` runs while the font is still loaded (Blue's House 9, the Route 2
trade house 11, the Nickname House 13). The screen stays white until that close's trailing sprite
update. Hold waits for A to be released; B passes. The second close reloads the font and the sprites
(`reload: 'full'`): Blue's House 14, trade house 17, Nickname House 22. Outdoors, an unchanged sprite
set is 5. Those costs match `map_sprite_sets.json` (walking pictures 12 tiles, still pictures 4).

Returning to the script sets the UI-entry edge before `checkUiEntry`, so the open display does not get
a new opening `UpdateSprites`. `town_map` is not a UI state, which is why the edge would otherwise look
new. The bag's Town Map leaves `townMapFromScript` false and returns to the overworld.

`DisplayTownMap` itself (its own white frames, the tink, the blink, auto-repeat) is still the later
audit, as the plan set it.

### CP4: Oak's speech

`syncJoypadRead` skips `oak_speech`, so the box and the name menu own every read. Seven programs go
through `printStandalone`: border at T, first glyph at +3. Text2 is the far of 2A, the PIKACHU cry cue,
then the far of 2B. The cue is recorded. Playback and the wait stay J2. Boxes and the background
transfer stay up through the fades, the preset slide, the name menu and the shrink, and clear only at
`ClearScreen`. A custom-name return is `ClearScreen` 3 plus `Delay3` 3: blank for 6 frames, box and
portrait at +6, glyph at +9. Text3 is `done`. Shrink starts on the tick that program returns. The name
menu watches A only, max item 3, top (1, 2), no wrap; B re-arms Delay3 and makes no sound. The name box
is 11×12 (`lb bc, 10, 9`). The fade, slide and shrink lengths are the ones already in the tree. The
intro-animation slice owns them.

### CP5: cleanup

The legacy `yesNo` command is gone from the union, the controller and the pending state. `yesNoChoice`,
`text`, `textButtonWait` and `closeText` remain. The school tripwire rejects `yesNo`. No
`BlackboardMenu`, `pendingTownMap` or `TextBoxOptions.close` remains. No extractor and no generated
file changed.

### My own mutations

Each edit was production code. I ran the affected tests, then `git checkout --` that path. After the
last revert, `git status` was `## master`.

| # | Mutation | Failures |
|---|---|---|
| M1 | `manual` always clears tile (18, 16) | 1 (the N-1 test; the school tests still passed) |
| M2 | `MenuInput` delay starts at 0 | 6 (menu, blackboard first read, Oak name menu) |
| M3 | Up from 0 wraps to `maxItem`; Down from `maxItem` wraps to 0 | 3 (menu, name menu, blackboard top) |
| M4 | Town Map's second close omits `reload: 'full'` | 5, all of `town_map_sign.test.ts` |
| M5 | Text3's completion requires `frame < 0`, so shrink never starts | 1 |
| M6 | `cry` returns immediately and drops the following ops | 2 (2B, and the runner's cue-then-asm case) |
| M7 | Remove `uiEntry.opened(true)` on the Town Map return | 0. See N-1 |

## Notes (non-blocking)

- **N-1. No committed test fails if the Town Map return latch is removed.**
  `main.ts` sets `uiEntry.opened(true)` before `checkUiEntry` when `DisplayTownMap` returns into the
  sign's script. Without that line the next entry check treats the still-open display as a new opening
  and runs `UpdateSprites`. The plan listed that spurious update as a mutation. `town_map_sign.test.ts`
  and `ui_entry.test.ts` still passed 25/25 after the line was deleted. The trace above is what the
  cartridge does (`jp CloseTextDisplay` returns into the same display), and note 37's browser smoke
  recorded two trailing updates and no return opening update. A later touch of the Town Map tests can
  drive this return. It does not block the play-test.
- **N-2. Wrapping and out-of-bounds are hardcoded off.** Plan §4.2 asked for those two inputs, defaulting
  off. `MenuInput` keeps both off in the body, with a comment that no current caller sets them and that a
  leftover `wMenuWatchMovingOutOfBounds` is the J2 menu-input audit. The blackboard and the name menu
  match the cartridge with both flags clear. Add the parameters when a caller needs them.

## State after the review

A5b6 is **done pending the user's play-test**. No code fix is waiting.

Play-test on `http://127.0.0.1:5173/` (A = Z, B = X):

1. **The school notebook.** Read all four pages once, and stop at "Turn the page?" once. The girl's
   "Huh? There's something written here!" has no ▼. Closing does not wait for an extra press after the
   last answer.
2. **The blackboard.** Every heading, both columns, QUIT and B. Up on the top row stays there. The menu
   box stays up while a heading types.
3. **The Town Map** in Blue's House or a Viridian house. There is a ▼ and a beep before it opens, and a
   short pause after it closes.
4. **A new game.** Pikachu's text includes the second half (the world waiting, Red and Pikachu as
   partners). The name menus accept A and ignore B. "Let's go!" goes straight into the shrink, with no
   extra press. The picture boxes stay up through the fades.

**Next:** the user play-test. Then A5b7. The healing-machine slice (#50) still comes after A5b7, and the
intro-animation slice (#51) after that. Do not start any of them from this review.
