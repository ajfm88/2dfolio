# A5b6 plan: the school notebook and blackboard, the Town Map sign, Oak's speech

**2026-10-13 · Claude (Opus 5.5). Status: approved 2026-10-13 (O-22, DECISIONS #51): all five recommendations;
Claude implements (Codex was unavailable), the user picks the reviewer, then the user play-tests.**

Parent plan: `notes/23-a5b-plan.md` §5 (the Notebook, Blackboard, Town-map sign and Oak speech rows) and §6
(A5b6), DECISIONS #45. Also in scope: A5b4 review N-1 (`notes/31-a5b4-review.md`). This slice reuses A5b5c's
yes/no timing (DECISIONS #50) and A5b4's display session. **No extractor or generated-data change:** A5b1 already
extracted every program this slice needs (§2).

## TL;DR

Five checkpoints, one slice:

1. **CP1, the notebook.** It becomes one display with no outer wait. Pages 1–3 each end with "Turn the page?" on
   A5b5c's yes/no menu. NO ends the reading. After page 4 comes the girl's line, which waits for a button with no
   ▼, then Hold and the 13-frame close. Also fixes N-1: the no-arrow button wait no longer blanks tile (18, 16).
2. **CP2, the blackboard, plus a port of `HandleMenuInput`.**
   - The handler loops: menu box and labels, the question typed instantly, then the menu.
   - The menu waits 3 frames before reading and does not wrap. LEFT and RIGHT switch columns by running the loop
     again.
   - A heading prints its text. B or QUIT restores the screen, then Hold and the 13-frame close.
   - The burn text and the question come from the ROM instead of TypeScript literals.
3. **CP3, the Town Map sign.**
   - "A TOWN MAP." ends with ▼ and a beep. Today it ends with a silent wait and no ▼.
   - Then the white-out and the 17-frame font copy, then today's Town Map screen.
   - Then the cartridge's **double close**: the handler jumps to `CloseTextDisplay` itself, then `DisplayTextID`
     holds and closes again. The second close reloads every sprite picture, so it is longer: 14, 17 or 22
     frames, depending on the house.
4. **CP4, Oak's speech.**
   - Every intro text becomes a standalone `PrintText` of its program: 3 frames, then the letters.
   - The **missing second half of Pikachu's text** comes back ("For some people, POKéMON are pets…"), with the
     cry as a declared cue only (J2).
   - Prompts show ▼. The final "Let's go!" ends on `done`, so the shrink starts at its last letter, with no
     press and no beep.
   - The box stays up through fades and the shrink until the cartridge clears the screen.
   - If D2 is approved, the name menu also gets the `HandleMenuInput` port.
5. **CP5, cleanup.** Retire the legacy `yesNo` command, `BlackboardMenu`, the `blackboard` state,
   `TextBoxOptions.close` and `pendingTownMap`. Mark the inventory rows done; update the docs.

New findings beyond note 23, all checked against the ASM:

- Pikachu's text is missing its second half (2B). This is content, not just timing.
- The Town Map sign closes the display twice.
- The blackboard wraps its rows, and the cartridge does not.
- A press of a key the menu does not watch costs another `Delay3`. B on the intro's name menu is such a key.
- Oak's final `done` text gets an invented press.
- The intro's text boxes vanish before each fade, where the cartridge keeps them up.

## 1. Deliverable and boundary

**In:**

- `ViridianSchoolNotebook` and `ViridianSchoolBlackboard`, as handlers on the display session.
- A shared `HandleMenuInput_` port.
- `TownMapText`: the text, the handoff, both closes, and a full-reload close cost.
- Every standalone `PrintText` of the intro and the naming handoffs; the name menu if D2 is approved.
- N-1, and the cleanup above.

**Out:**

- `DisplayTownMap`'s own internals (D3, §9).
- The intro's animation (D4, §9).
- Cries (J2, #45).
- The naming screen itself (J2).
- Shop, item, PC and save messages (A5b7).
- The healing machine (its own slice, #50).
- `PrintText`'s and the menus' own `UpdateSprites` (J2, as in notes 32 and 35).

## 2. What exists (read this session)

- **Notebook:** `story/hidden_events.ts` builds legacy `text` and `yesNo` commands from `getText('SCHOOL_*')`.
  - Page 1 is the split alias `SCHOOL_NOTEBOOK_LOOKED + '\f' + SCHOOL_NOTEBOOK_PAGE1`.
  - Every page and the girl's line is its own legacy box, closed by an invented press and beep.
  - The yes/no uses the legacy immediate timing.
  - There is no Hold and no close cost; the script just ends. Dispatch: `overworld_controller.ts:321`.
- **Blackboard:** `menus/blackboard_menu.ts`, its own `blackboard` state (`main.ts:1287`, `:1620`, `:1758`,
  `:1901`), reached through `openBlackboard` (`overworld_controller.ts:317`).
  - Legacy boxes; the question is a TypeScript literal; so is the burn text (`blackboard_menu.ts:152,161`).
  - The rows wrap (`:76-78`). It reads on the first tick. B dismisses the box at once, with no Hold and no
    close.
- **Town Map sign:**
  - The text comes from `map.ts:112` (`BOOKSHELF_TEXT.TOWN_MAP = 'A TOWN MAP.'`).
  - `overworld_controller.ts:335` sets `pendingTownMap`. `main.ts:1872` shows it through `MapDialogue` with
    `close: false`, `textbox.ts:264` runs the transitional ending (outer silent wait, Hold, one frame), and
    `main.ts:1444` opens `TownMap`.
  - On exit, `main.ts:1335` goes straight to `overworld`: no `CloseTextDisplay` at all.
  - The bag's Town Map (`main.ts:1264`) shares the `town_map` state.
- **Oak's speech:** `menus/oak_speech.ts` owns a legacy `TextBox` and `getText('OAK_SPEECH_*')`.
  - The opening is one frame, not three. Final pages have no ▼, are protected by no `Delay3`, and close on an
    invented press and beep, `done` included.
  - `OAK_SPEECH_PIKACHU` is only `_OakSpeechText2A`.
  - The box is dismissed before each fade and before the shrink.
  - The name menu wraps, reads every tick, and plays no sound on A (`:542-555`).
  - `main.ts:1097` syncs the joypad every tick in `oak_speech`, because the global `textBox` is inactive there.
- **Programs (all in `data/text_programs.json`, A5b1):**
  - `ViridianSchoolNotebookText1`–`5`, `TurnPageText`.
  - `ViridianSchoolBlackboardText1`/`2`, `ViridianBlackboard{Sleep,Poison,Prlz,Burn,Frozen}Text`.
  - `TownMapText` (`far`, `promptButton`, `asm`).
  - `OakSpeechText1`, `OakSpeechText2` (`far 2A`, `cry PIKACHU`, `far 2B`), `IntroducePlayerText`,
    `YourNameIsText`, `IntroduceRivalText`, `HisNameIsText`, `OakSpeechText3` (`<DONE>`).
- **Where the Town Map can be read:** HOUSE tile `$3D` sits at step (3, 0) in **Blue's House, the Route 2 trade
  house and the Viridian Nickname House**. It is read from (3, 1), facing up (`PrintBookshelfText`'s (8, 7)
  check). The school has none.
- **Session pieces to reuse:** `displayOpen`, `printText` (`box: new|keep`), `displayClose {outerWait}`,
  `displayHide`, `yesNoChoice` (A5b5c timing), `TextBox.print(..., {noDelay})` (A5b4's no-delay mode), the
  runner's `'asm'` return, `currentMapCloseFrames`, `copyFrames`, `allocateSlots` (`overworld/sprite_sets.ts`),
  and the handler splice (`script_controller.ts:242-248`).
- **N-1:** `text_printer.ts:97` always writes `' '` to `buffer[98]`. `TextCommand_WAIT_BUTTON` never touches
  (18, 16); only `PROMPT_BUTTON` and the string controls do.

## 3. Cartridge flows (re-verify each before coding)

### 3.1 The notebook

Hidden event `hidden_text_predef 3, 4, PrintNotebookText, ViridianSchoolNotebook`
(`data/events/hidden_events.asm:350`), any facing. The routines are in
`engine/events/hidden_events/school_notebooks.asm`.

| Step | ASM | Here |
|---|---|---|
| 1 | `PrintNotebookText`: `EnableAutoTextBoxDrawing`, `wDoNotWait… = 1`, `PrintPredefTextID` → `DisplayTextID` (20 frames, border, update) | `displayOpen` in the dispatch tick |
| 2 | `text_asm` → `PrintText Text1` (new box, +3; ends `prompt`) | first glyph **+23** |
| 3 | `TurnPageSchoolNotebook`: `PrintText TurnPageText` (+3; `done`), then `YesNoChoice` | the yes/no opens on the text's return tick (A5b5c: +3 read, 15-frame tail) |
| 4 | NO (`wCurrentMenuItem` 1) → `.doneReading` | → step 7 |
| 5 | YES → `PrintText Text2`, step 3; then `Text3`, step 3 | |
| 6 | after the third YES: `PrintText Text4` (prompt), then `PrintText Text5`: the girl's line, then `text_waitbutton` (no ▼, fresh A/B, sound wait, beep), `text_end` | no ▼ is drawn, and tile (18, 16) is left as it was (N-1) |
| 7 | `TextScriptEnd`; `wDoNotWait` → `HoldTextDisplayOpen` → `CloseTextDisplay` | `displayClose {outerWait: false}`: Hold, **13** (W 4), trailing update |

After NO, the screen shows "Turn the page?" again (`LoadScreenTilesFromBuffer1`) during Hold. A5b5c's menu
already restores it.

### 3.2 The blackboard

Hidden event `hidden_text_predef 3, 0, PrintBlackboardLinkCableText, ViridianSchoolBlackboard`
(`hidden_events.asm:351`). The routine is in `engine/events/hidden_events/school_blackboard.asm`.

| Step | ASM | Here |
|---|---|---|
| 1 | `EnableAutoTextBoxDrawing`, `wDoNotWait… = 1`, `DisplayTextID` (20 frames, border) | `displayOpen` |
| 2 | `SaveScreenTilesToBuffer1`: the empty bottom box, no menu | remember "empty box" |
| 3 | `PrintText Text1` (+3, prompt) | first glyph **+23** |
| 4 | item 0, offset 0, watched keys LEFT, RIGHT, A, B; max 2, top (1, 2) | |
| 5 | **loop:** set `BIT_NO_TEXT_DELAY`. `TextBoxBorder` at (0, 0), 6×10 interior, so 12×8 tiles with the border. `PlaceString` the labels " SLP / PSN / PAR" at (1, 2) and " BRN / FRZ / QUIT" at (6, 2), `next` = 2 rows. Then `PrintText Text2` (+3, **instant letters**, `done`) | the menu box and labels are drawn in the tick; Text2 is typed whole in one CPU frame, and the BG transfer shows it in thirds |
| 6 | `HandleMenuInput` (§3.3) | the first read comes 3 frames after Text2 returns, so **6 frames after step 5** |
| 7 | B → exit (step 10). The A/B sound has already played | |
| 8 | RIGHT → top x 6, offset 3, keep the item, loop to 5. LEFT → top x 1, offset 0, keep the item, loop to 5 (also when already in that column). Neither plays a sound | check in ASM order: B, RIGHT, LEFT, then the item |
| 9 | item + offset = 5 (QUIT) → exit. Otherwise clear `BIT_NO_TEXT_DELAY`, `PrintText` the heading (+3, delayed letters, `prompt`), loop to 5 with the same item | the menu box stays on screen while the heading prints |
| 10 | exit: clear `BIT_NO_TEXT_DELAY`; `LoadScreenTilesFromBuffer1` (the menu disappears and the bottom box is empty); `TextScriptEnd` → Hold → `CloseTextDisplay` | `displayClose {outerWait: false}`: Hold, **13**, trailing update |

**`wMenuWatchMovingOutOfBounds` is read here but never set.** It is 0 on every path I traced: START redraws
clear it, as do the two-option menu, the Mart menu and the battle bag. With 0, UP on the top row and DOWN on the
bottom row do nothing. A path that left a list menu's `CANCELLED_MENU` there would make those presses return, and
print that row's heading. That is a cross-menu question for the J2 menu-input audit. Model 0, and say so in a
comment.

### 3.3 `HandleMenuInput_` (`home/window.asm:1-110`)

1. `PlaceMenuCursor` at (top x, top y + 2 × item), then **`Delay3`**: three frames with no read.
2. One `JoypadLowSensitivity` per frame. With `hJoy7` = 0 (no list menu or Town Map is open; confirm), that
   means newly pressed buttons only. Nothing pressed: read again next frame.
3. A pressed key:
   - **Up/Down move the item** unless A is also pressed. Up at the top and Down at the bottom do nothing.
     Wrapping needs `wMenuWrappingEnabled`, which every return clears and neither of these menus sets.
   - **If no pressed key is watched,** go back to step 1: the cursor is redrawn and another `Delay3` follows.
     This covers Up and Down themselves, and B on the name menu.
   - **A watched key:** A or B plays `SFX_PRESS_AB`. Then return the pressed keys, with no tail. The 15-frame
     tail belongs to `DisplayTwoOptionMenu`, not here.
4. `wMenuJoypadPollCount` stays 0 (no timeout).

A5b5c's yes/no implements a specialised copy of this inline (`menus/yes_no_menu.ts`). **Leave `YesNoMenu`
untouched in A5b6.** A5b7's shop and PC menus will want the shared port. Folding the yes/no onto it is a later
cleanup.

### 3.4 The Town Map sign (`engine/events/hidden_events/town_map.asm`, `home/text_script.asm`)

`PrintBookshelfText` (facing up, tile at (8, 7)) → `EnableAutoTextBoxDrawing` (so `wDoNotWait` = 0) →
`PrintPredefTextID(TownMapText)` → `DisplayTextID`:

| Step | ASM | Here |
|---|---|---|
| 1 | `DisplayTextIDInit` (20 frames, border, update) | `displayOpen` |
| 2 | `PrintText_NoCreatingTextBox`: `text_far _TownMapText` ("A TOWN MAP.@") | `printText TownMapText {box: 'keep'}`; first glyph **+20** |
| 3 | `text_promptbutton`: ▼ at (18, 16), **no** `ProtectedDelay3`, fresh A/B, sound wait, beep, clear ▼ | the runner's `promptButton` |
| 4 | `text_asm`: `wDoNotWait = 1`; set `BIT_NO_TEXT_DELAY` | the runner returns `'asm'`; the handler continues in the same tick |
| 5 | `GBPalWhiteOutWithDelay3`: white at once, then 3 frames | white screen |
| 6 | `hWY = 0`, auto BG transfer on, `LoadFontTilePatterns` (LCD on: `CopyVideoDataDouble` of 128 1bpp tiles, **17 frames**, auto transfer off while it copies) | white, 17 frames |
| 7 | `farcall DisplayTownMap` | today's Town Map screen, unchanged (D3) |
| 8 | clear `BIT_NO_TEXT_DELAY`; push `TextScriptEnd`; **`jp CloseTextDisplay`**, with the font still loaded: `5 + 2W` | **close #1**: the screen stays white (`ExitTownMap` cleared the tiles and sprites), and the map and sprites appear at its trailing `UpdateSprites` |
| 9 | `UpdateSprites` returns into `TextScriptEnd` → `text_end` → `DisplayTextID`: `wDoNotWait` is set → **`HoldTextDisplayOpen`** | Hold. The window is already off, so no box shows |
| 10 | **`CloseTextDisplay` again**, now with the font flag clear: `InitMapSprites` loads both halves of every walking slot and the four-tile pictures | **close #2** (full reload), then its trailing `UpdateSprites` |

Close costs. Close #1 uses A5b4's `1 + 2W + 4`. Close #2 for an indoor map is `1 + 4R + S + 4`: R counts the
non-empty regular slots 0–8, including Pikachu, each copying a 12-tile still half and a 12-tile walking half
(2 + 2 frames). S counts the non-empty four-tile slots 9–10, one frame each. Values computed from
`map_sprite_sets.json`:

| Map | object pictures | R | S | close #1 | close #2 |
|---|---|---:|---:|---:|---:|
| Blue's House | 17, 17, 75 | 2 | 1 | 9 | **14** |
| Route 2 trade house | 32, 55 | 3 | 0 | 11 | **17** |
| Viridian Nickname House | 52, 8, 9, 76 | 4 | 1 | 13 | **22** |

Outdoors, `InitOutsideMapSprites` skips the reload entirely when the font is not loaded and the sprite set
has not changed. A full-reload close there is `1 + 0 + 4 = 5`. No outdoor map can reach this flow; implement
and test the rule anyway, because the function is pure.

Hold is between the two closes. The town map exits on A or B (`DisplayTownMap`'s input loop). After an A exit,
Hold waits for A's release; after a B exit, it passes at once.

### 3.5 Oak's speech (`engine/movie/oak_speech/oak_speech.asm`, `oak_speech2.asm`)

Every text is a standalone `PrintText`, outside any `DisplayTextID`:

- The box is drawn at T, then `UpdateSprites`, then `Delay3`. The first glyph comes at **+3**.
- The text returns with the box kept on screen.
- The box goes only when `ClearScreen` (3 frames) runs, or when the next `PrintText` clears its interior.

| # | ASM (text part in bold) | Today |
|---|---|---|
| 1 | Oak fades in; **`PrintText OakSpeechText1`** (para, prompt) → `GBFadeOutToWhite` with the box still up → `ClearScreen` | 1-frame opening; no ▼ on the last page; the box goes before the fade |
| 2 | Pikachu; **`PrintText OakSpeechText2`**: `_OakSpeechText2A` ends with `@` ("…#MON!"), then **`sound_cry_pikachu`** (`PlayCry`; a cue here, J2), then `_OakSpeechText2B` (`text_start`, then a `para`: ▼ wait, clear, 20 frames; "For some people,…", "Myself...", "I study #MON as a profession." `prompt`) → fade → `ClearScreen` | **2B is missing entirely**; no cry cue |
| 3 | Red; **`PrintText IntroducePlayerText`** (prompt) → `ChoosePlayerName`: slide right, the name menu (`DisplayIntroNameTextBox`: box (0, 0) 12×11, "NAME" at (3, 0), the names at (2, 2), watched keys **A only**, max 3) | the prompt has no ▼; the menu wraps and plays no A sound |
| 4a | preset → `OakSpeechSlidePicLeft` (`ClearScreenArea` rows 0–11 only, so **the bottom box stays**; 10 frames, `Delay3`, slide) → **`PrintText YourNameIsText`** (prompt) | the box is dismissed before the slide back |
| 4b | NEW NAME → `DisplayNamingScreen` (again if the name is empty) → **`ClearScreen` (3) + `Delay3` (3)**, Red's pic, then **`PrintText YourNameIsText`**: box at +6, first glyph at **+9** after the naming screen returns | the text is shown at once |
| 5 | fade, `ClearScreen`, the rival fades in; **`PrintText IntroduceRivalText`** (para, prompt) → `ChooseRivalName` (as 3–4, `HisNameIsText`) | as 3–4 |
| 6 | fade, `ClearScreen`, Red fades in; **`PrintText OakSpeechText3`** (paras, **`done`**) → **`SFX_SHRINK` in the return tick**; the shrink; **the box keeps the text** until the final `GBFadeOutToWhite` + `ClearScreen` | an invented press and beep, and the box goes before the shrink |

`wStatusFlags3` is zero in a new game, so Text3 always prints. Only the bold parts are in A5b6. Everything else in
the column (fades, `MovePicLeft`, the slides, the shrink's frames and sounds) is D4.

## 4. Design

### 4.1 CP1: the notebook, and N-1

- **N-1.** In `TextScreen.manual`, clear `buffer[98]` only when `arrow` is true. Test: a glyph at (18, 16) before
  a `waitButton` is still there after it; `promptButton` still clears ▼.
- **Builder.** Rewrite `getHiddenEventScript('VIRIDIAN_SCHOOL_NOTEBOOK')` from §3.1:
  - Start with `displayOpen` and end with `displayClose {outerWait: false}`.
  - Use `printText` with `box: 'new'` for the five programs and `TurnPageText`.
  - Ask the question with nested `yesNoChoice` commands. The NO branches are empty.
  - No legacy commands and no `getText`.
- Dispatch stays the hidden event's `scriptId`. `startScript` already runs `displayOpen` in the dispatch tick.

### 4.2 CP2: the `HandleMenuInput` port and the blackboard

- **`menus/menu_input.ts`:** a pure port of §3.3.
  - Inputs: watched keys, max item, top x/y, the current item, and the wrapping and out-of-bounds flags
    (default off).
  - Output: the pressed keys and the item when a watched key arrives.
  - Use the same actual-read accounting as `YesNoMenu`'s `actualRead` path (`readJoypad` and
    `isPassPressed`), with one read per frame.
  - Draw ▶ at the current item. Unit-test every rule.
- **Script support.**
  - `printText` gains `noDelay?: boolean`, passed through to `TextBox.print`.
  - A command draws a menu box with labels and keeps it on the UI layer until removed. The UI layer must cover
    sprites the way today's blackboard render does.
  - A command runs the menu input and splices the commands that a pure function returns for the result, the way
    `yesNoChoice` splices its branches. This makes the loop explicit without a second script engine.
  - A command for `LoadScreenTilesFromBuffer1` removes the menu box and empties the bottom box's interior,
    keeping the border.
  - Name them as you like, and keep them out of `TextBox` unless they are display state.
- **Builder** (`story/school.ts` or alongside the notebook) from §3.2. Labels come from the ASM strings (static
  `PlaceString`: no extraction needed). Text2 uses `noDelay`; the headings do not.
- **Remove** `BlackboardMenu`, `getSchoolBlackboardConfig`, `SCHOOL_BLACKBOARD_CONFIG`, the `blackboard` state
  and its render and UI-layer cases, and `openBlackboard`. The scriptId now maps to the builder.
- **If D2 = yes** (CP4 does it): the name menu uses the same port.

### 4.3 CP3: the Town Map sign

- **Dispatch.** The TOWN_MAP bookshelf entry starts a script handler; it no longer opens a `textbox` action.
  Remove `pendingTownMap` (`overworld_controller.ts:335`, `main.ts:167,1444-1449,1872-1873`) and
  `TextBoxOptions.close` with its transitional branch (`textbox.ts:109-110,264-266`). The other bookshelf
  texts keep their current path.
- **Builder** from §3.4:
  1. `displayOpen`.
  2. `printText TownMapText {box: 'keep'}`, which returns at its `asm` op.
  3. The handoff: white at once, 3 frames, then 17 frames. Use the existing white overlay; don't add a fade.
  4. The Town Map.
  5. Close #1.
  6. `displayClose {outerWait: false}` with the full-reload cost.
- **The Town Map from a script.** Return a script action that `main.ts` handles like `catchDemo`: switch to
  `town_map`, then on exit go back to `script` and advance. The bag's Town Map keeps its current return.
- **Pitfall: no spurious `UpdateSprites` on the way back.** Returning from `town_map` to `script` while the
  session is active makes `overworldUiOpen` rise (`main.ts:1643`). That would fire an opening `UpdateSprites`
  the cartridge does not have. Suppress it, and test that it is gone.
- **Close #1 keeps the session open.** It runs a `CloseSequence` of `currentMapCloseFrames`, renders white
  until its trailing `UpdateSprites`, then leaves the session open with no border and no BG transfer, for Hold.
  A session method such as `closeInPlace()` would do; the name is yours.
- **Close #2.** Add `fullReloadCloseFrames(file, mapName, step)` beside `mapCloseFrames` (§3.4 rule, indoor and
  outdoor), and let `finish()` take the cost to use.
- **Facings.** Both closes restore the saved facings as A5b4 does. Nothing turns in this flow, so nothing visible
  changes.
- **BG transfer.** The Town Map screen doesn't drive the shared BG-transfer phase. That is approximate, as the A5a
  decision allows; say so in a comment.

### 4.4 CP4: Oak's speech

- **Standalone `PrintText`.** Add a `TextBox` entry, for example `printText(source, opts)` in mode
  `printText`. It draws the border at T, waits 3 frames, runs the program or string through `printing()`, and
  keeps the box when the program returns.
  - No `DisplayTextIDInit` and no close.
  - `dismiss()` stands for `ClearScreen`.
  - Give `OakSpeech`'s box a host whose `cry()` records the cue, so tests can see it between 2A and 2B.
- **`OakSpeech` texts.** Replace the seven `getText` calls with the programs, and each "wait until the legacy
  box closes" with "wait until the program returns" (`isComplete`).
  - Keep the box through fades. Dismiss it only where the ASM runs `ClearScreen`: after each fade, and on the
    custom-name return.
  - The preset path keeps the old box through the slide back.
  - The custom-name path waits `ClearScreen` (3) + `Delay3` (3), shows Red, then prints.
  - Text3's return starts the shrink in that tick, with the box still up until the final fade. Today's
    animation timings otherwise stay as they are (D4).
- **Input ownership.** In `oak_speech`, `main.ts:1097` must not sync the joypad: `OakSpeech`'s box (and the name
  menu, with D2) own every read. Exclude the state, and test that a held A is still a held A at the first read.
- **D2 = yes:** the name menu uses `menu_input.ts` with watched keys A only, max 3, top (1, 2), and no wrap.
  B re-arms `Delay3` with no sound; A plays `press_ab`.

### 4.5 CP5: cleanup

- Remove the legacy `yesNo` command: its last caller was the notebook. Remove it from the union, from
  `script_controller.ts:905`, and from its `scriptYesNoActive` state and render path. Keep a string-list
  tripwire, as A5b5c did.
- Keep `text`, `textButtonWait` and `closeText`: their last callers are A5b7's.
- `notes/24-a5b1-text-data.md` §4–§5: mark these rows **Done A5b6**:
  - the `SCHOOL_NOTEBOOK_LOOKED` alias;
  - `story/hidden_events.ts`, `menus/blackboard_menu.ts` and `menus/oak_speech.ts`;
  - the blackboard's TypeScript literal.

  The `game_text.json` keys stay. Retire the aliases in one data checkpoint after A5b7, when nothing reads them.
- Docs:
  - `story/ARCHITECTURE.md`: school and Town Map, and the legacy list.
  - `text/ARCHITECTURE.md`: the standalone `PrintText`, the Town Map closes, N-1.
  - `menus/ARCHITECTURE.md`: `menu_input.ts`, `BlackboardMenu` gone, `OakSpeech`.
  - `CONVENTIONS.md`: the test suite.
  - Root `CLAUDE.md`: the baseline only.
  - STATUS.

## 5. Checkpoints and gates

Gates at every checkpoint:

- `npm run typecheck`
- `ROM_PATH=pokeyellow.gbc npm test` (in PowerShell: `$env:ROM_PATH='pokeyellow.gbc'; npm test`)
- the no-ROM run
- `npm run build`
- `git diff --check`, and a clean `git status`

**No setup run should be needed. If any generated file changes, stop and tell the user.**

Stage specific paths. `context/STATUS.md` has mixed line endings, so don't normalise it in passing.

| CP | Commit | Must show |
|---|---|---|
| CP1 | N-1 + notebook | N-1 test; §6 notebook traces |
| CP2 | `menu_input.ts` + blackboard | the menu rules; the blackboard traces |
| CP3 | Town Map sign | both closes per house; the handoff frames; no spurious update |
| CP4 | Oak's speech (+ name menu if D2) | every program and first glyph; 2B and the cue; Text3 with no press |
| CP5 | cleanup + docs + result | no dead command; inventory updated |

## 6. Tests, browser smoke and the play-test

**Tests.** Derive each expected number from the ASM, never from the helper under test. Don't commit
self-mutating "mutation" tests (note 36 N-2). Run mutations against production, revert them, and record them in
the result.

- **CP1:**
  - the first glyph at +23
  - the menu opens on `TurnPageText`'s return tick, with A5b5c's +3 read and 15-frame tail
  - NO after page 1, 2 or 3: Hold, then close 13 with "Turn the page?" showing
  - YES ×3: Text4, then Text5 with a `waitButton` (no ▼, the beep, no protected frames), Hold, close 13
  - no outer wait anywhere
  - N-1
- **CP2:**
  - `menu_input`: Delay3 then one read per frame; Up/Down re-arm Delay3; no wrap; an unwatched key re-arms with
    no sound; A/B sound and return with no tail; A+Up does not move; the ASM check order
  - the blackboard: +23; Text2 instant (whole string in one CPU frame); the first menu read 6 frames after the
    loop starts
  - all five headings, BRN from the ROM; RIGHT/LEFT re-loops, including in the same column; QUIT and B exits
    (the screen restored, the box empty)
  - Hold, close 13
- **CP3:**
  - +20; ▼ and the beep with no protected frames; the beep before the white-out
  - white 3 + 17 frames; the Town Map
  - close #1 = 9 / 11 / 13, white until its update
  - Hold: held A blocks, B passes
  - close #2 = 14 / 17 / 22, two trailing updates in all
  - no opening update on the return; the outdoor full-reload rule (5) as a pure-function test
  - the bag's Town Map still returns as before
- **CP4:**
  - each of the seven programs, with the box at T and the first glyph at +3
  - 2A, the cue, then 2B's para wait
  - prompts have ▼ and protected frames
  - Text3 returns at its last letter and the shrink starts in that tick with no input
  - the box stays through each fade, the preset slide back and the shrink, and goes at `ClearScreen`
  - the custom-name return at +6 / +9
  - no idle joypad sync in `oak_speech`
  - with D2, the name-menu rules (A only, B re-arms silently, no wrap)

**Browser smoke** (required; spare port, isolated profile, muted; no product debug hooks; record ticks):

- **School:**
  - the notebook: all three NO exits and the full read
  - the blackboard: each heading, a column switch each way, UP on the top row, QUIT and B
- **Town Map:** read it in all three houses, exiting once with A held and once with B. Record: first glyph,
  white frames, both close counts, the Hold.
- **New game:** through to Red's room twice: a preset player name with a custom rival name, then the reverse.
  Record: the first glyphs, 2B, the cue, Text3 with no press, and the box at each fade.
- Zero console errors. Clear the storage; close Chrome and the spare server. Leave `:5173` and the user's saves
  untouched.

**User play-test** (after the review; A = **Z**, B = **X**):

1. The school notebook: read all four pages once, and stop at "Turn the page?" once.
2. The blackboard: every heading, both columns, QUIT and B.
3. The Town Map in Blue's House or a Viridian house: there should be a ▼ and a beep before it opens, and a
   moment's pause after it closes.
4. A new game: Pikachu's longer text, the name menus, and "Let's go!" going straight into the shrink.

## 7. Mutation checks (at least five, against production, reverted)

- The arrow-less wait clears (18, 16) again.
- The notebook's close gets an outer wait.
- `menu_input`'s initial `Delay3` is removed.
- The blackboard rows wrap.
- Text2 is typed with delays.
- The Town Map's second close uses the font-loaded cost.
- The spurious opening update on the return comes back.
- Text3 waits for a press.
- 2B is dropped.

## 8. Existing tests expected to change (each with its cartridge reason; do not loosen)

- `text/textbox.test.ts:179` "the Town Map sign retains its one-frame ending…": replaced by the §6 CP3 traces,
  since the transitional option is removed.
- `overworld/item_pickup.test.ts:236,293`: the expected `textbox` action loses `pendingTownMap: undefined`.
  Nothing else changes.
- `overworld/ui_entry.test.ts:66`: `'blackboard'` leaves the UI-state list, because the state is removed.
- `text/text_runner.test.ts:58` passes unchanged; N-1 adds a test beside it.

Anything else that fails is a regression: stop and report it.

## 9. Not in A5b6, each with a home

| Finding | Home |
|---|---|
| `DisplayTownMap` internals: `LoadTownMap`'s white frames (white-out + `Delay3`, `ClearScreen`, LCD off, `Delay3`); `ExitTownMap`'s (`ClearScreen`, the player copy 4, the font copy 17); `SFX_TINK` on A/B/Up/Down (not extracted); held Up/Down auto-repeat (`hJoy7` = 1); the 25/50 blink | J2 Town Map audit (shared with the bag's Town Map), or D3's alternative |
| Intro animation: `FadeInIntroPic` (6 × 10), `GBFadeOutToWhite`/`InFromWhite` (3 × 8), `MovePicLeft` (`rWX` 119 by −8 a frame), the name slides (6 × `Delay3`; the left slide's clear, 10 frames and `Delay3`), the shrink (`SFX_SHRINK`, 4, the sprite copy, 4, music fade-out 10, 20, clear, 50, fade, `ClearScreen`), Pikachu's pic position | D4 |
| An empty custom name reopens the naming screen (`ChoosePlayerName .customName`); the TypeScript refuses the submit | J2 naming-screen audit |
| The Pikachu cry in Text2 (`PlayCry STARTER_PIKACHU`, with its wait) | J2 (#45) |
| `wMenuWatchMovingOutOfBounds` left over from a list menu (§3.2) | J2 menu-input audit |
| Fold `YesNoMenu` onto `menu_input.ts` | A5b7 or later cleanup |
| Retire the `SCHOOL_*`, `BLACKBOARD_*` and `OAK_SPEECH_*` `game_text` aliases | one data checkpoint after A5b7 |
| `LinkCableHelp` (the link-cable blackboard on later maps) | link features: needs a user decision |

## 10. Decisions (O-22), recommendations first

1. **One slice, five checkpoints, one review, one play-test.** Recommended: **yes**. Each piece is small, they
   share the session work, and one play-test covers them. Alternative: A5b6a (school and Town Map), then A5b6b
   (the speech).
2. **The `HandleMenuInput` port drives the blackboard and the intro's name menu.** Recommended: **yes**. The
   blackboard needs it to loop correctly. The name menu is what the speech's prompts return into, and with the
   port in place the fix is a few lines: no wrap, B ignored, a sound on A. This amends #45's J2 placement for
   that one menu. Alternative: the blackboard only, leaving the name menu for J2.
3. **The Town Map boundary.** Recommended: **everything in `TownMapText`**, which is the text, the ▼ and beep,
   the handoff and both closes (the double close is a kept quirk), **while `DisplayTownMap`'s internals wait for
   a Town Map audit** that also covers the bag's Town Map. Alternative: port `LoadTownMap`/`ExitTownMap`'s frames
   now too (`SFX_TINK` would still need extraction, V5).
4. **The intro's animation** (§9 row 2): it needs the music fade-out that the healing-machine slice builds.
   Recommended: **its own slice right after the healing-machine slice**, rather than waiting for J2. The
   intro is the first thing every new game shows. Alternative: leave it in J2, as #45 has it.
5. **Who:** Sol implements; Claude reviews (`notes/38-a5b6-review.md`) when the user says it is done; the user
   play-tests. (Assumed, as before.)

## 11. Handoff for Sol

> Implement **A5b6** from `notes/37-a5b6-plan.md`, with the user's answers to O-22 (see DECISIONS). Claim it in
> `context/STATUS.md` → *In progress* with your model name and the date.
>
> Before each checkpoint, **re-read the ASM it cites and re-derive the sequence.** If anything here disagrees with
> the disassembly, stop and tell the user. The likeliest places are §3.3's re-arm rule, §3.4's two close costs
> (especially R and S), and §3.5's custom-name +6.
>
> Do not touch the audio engines, A6 movement or the Pikachu programs, the A5a printer's timing (apart from N-1),
> the A5b4 close, `YesNoMenu`, or any extractor or generated file. Many files under `game/src` are CRLF: use the
> Edit tool for multi-line changes and run `git diff --check`. Stage specific paths. Never push.
>
> At the end, write the **Implementation result** at the bottom of this note:
> - commits and counts
> - every §8 test edit with its reason
> - the browser numbers
> - the mutations you ran
> - what you confirmed or disproved in §3
> - anything that surprised you
>
> Update `CONVENTIONS.md` (test suite), the subsystem ARCHITECTURE docs, root `CLAUDE.md` (baseline only) and
> STATUS. Then stop for Claude's review.

## Planning verification (what I read and ran; no repository file changed except this note, STATUS and PLAN)

- **Read (ASM):**
  - `engine/events/hidden_events/school_notebooks.asm`, `school_blackboard.asm`, `town_map.asm`,
    `bookshelves.asm`, `book_or_sculpture.asm`
  - `home/text_script.asm` (whole), `home/predef_text.asm`, `home/overworld_text.asm` (`TextScriptEnd`)
  - `home/text.asm`: TCP, `PROMPT_BUTTON`, `WAIT_BUTTON`, `START_ASM`, `SOUND`
  - `home/joypad2.asm`, `home/window.asm` (`HandleMenuInput_`, `PlaceMenuCursor`, `HandleDownArrowBlinkTiming`,
    `PrintText`), `home/yes_no.asm`
  - `home/copy.asm`/`copy2.asm` (`CopyVideoDataAlternate`, `CopyVideoDataDouble`, `ClearScreen`),
    `home/load_font.asm`, `home/palettes.asm`, `home/fade.asm`, `home/list_menu.asm` (its out-of-bounds/`hJoy7`
    writes)
  - `engine/items/town_map.asm` (`DisplayTownMap`, `LoadTownMap`, `ExitTownMap`, the blink)
  - `engine/overworld/map_sprites.asm` (`InitMapSprites`, `LoadMapSpriteTilePatterns`, the still/walking loads)
  - `engine/menus/display_text_id_init.asm`
  - `engine/movie/oak_speech/oak_speech.asm`, `oak_speech2.asm`
  - `data/text/text_2.asm`, `text_3.asm` (all strings above); `data/events/hidden_events.asm`;
    `data/tilesets/bookshelf_tile_ids.asm`
  - the writers of `wMenuWatchMovingOutOfBounds`, `wMenuJoypadPollCount` and `hJoy7`
- **Read (TypeScript):**
  - `story/hidden_events.ts`, `menus/blackboard_menu.ts`, `menus/town_map.ts`, `menus/oak_speech.ts`,
    `menus/yes_no_menu.ts`
  - `text/text_printer.ts`, `text_runner.ts`, `textbox.ts`, `map_dialogue.ts`, `close_sequence.ts`
  - `overworld/sprite_sets.ts`, `overworld_controller.ts` (interaction), `input/input.ts`, `overworld/map.ts`
    (bookshelves), `script/types.ts`
  - `script_controller.ts` (the splice and `yesNoChoice`), the `main.ts` state machine and its render
  - the tests listed in §8
- **Ran:**
  - the extracted programs and `game_text` keys (2B is not in `OAK_SPEECH_PIKACHU`)
  - a block scan for tile `$3D` in the four HOUSE maps
  - the R/S slot allocation and close costs per house from `map_sprite_sets.json`
  - greps for the remaining legacy-command callers and the tests that pin the touched behavior
- **Not run:** typecheck, tests, build, setup, browser. The baseline stays 1195/1195, no-ROM 1072/123.

## Progress and handoff — Claude (Opus 5.5), 2026-10-13: CP1–CP3 done, CP4–CP5 for Codex

The user stopped the session after CP3 and asked that **OpenAI Codex finish A5b6**. The tree is clean at
`3689f23`. Nothing from CP4 is in the repository: an untried `TextBox.printStandalone` was reverted, and its design
is below. Baseline after CP3: **ROM 1225/1225 (63 files), no-ROM 1102 pass / 123 skip**; typecheck, build and
`git diff --check` clean. No generated file changed (none should).

| CP | Commit | Tests | What landed |
|---|---|---|---|
| CP1 | `ad397c2` | +10 | `story/hidden_events.ts` `buildSchoolNotebookScript` (§3.1). N-1: `TextScreen.manual` clears (18,16) only when `arrow`. `story/school.test.ts` (8), `text_runner.test.ts` (+2) |
| CP2 | `8ba1f11` | +10 | `menus/menu_input.ts` (`MenuInput`, §3.3). Script commands `menuBox`, `menuInput` (its `then` splices the next commands), `restoreSavedScreen`; `printText.noDelay`; `TextBox.clearInterior()`; `renderScriptMenu()` in main's UI layer. `buildSchoolBlackboardScript` (§3.2). `BlackboardMenu`, the `blackboard` state and `openBlackboard` removed. `menu_input.test.ts` (5), `school.test.ts` (+5) |
| CP3 | `3689f23` | +10 | `GameMap.getBookshelfScript` → `{scriptId: 'TOWN_MAP_TEXT'}` → `buildTownMapSignScript` (§3.4). Commands `whiteOut {on}`, `townMap` (a `ScriptAction`; `main.ts` sets `townMapFromScript`, and on exit pre-sets `uiEntry.opened(true)`, returns to `script`, advances), `displayCloseInPlace` (`TextBox.closeInPlace()`, then `windowOff`), `displayClose.reload: 'full'` (`TextBox.finish({reload})`, host `closeFrames(reload)`, `sprite_sets.ts` `fullReloadCloseFrames`, `CloseReload`). `pendingTownMap` and `TextBoxOptions.close` removed; `getScriptFadeAlpha()` reports the held white-out. `town_map_sign.test.ts` (10); the transitional textbox test replaced; `item_pickup.test.ts` drops `pendingTownMap: undefined` |

**Confirmed against the ASM while implementing (no plan corrections were needed):** §3.1–§3.4 as written. Close
costs 13 (school), 9/11/13 then 14/17/22 (the three houses), outdoor full reload 5. Main returns from the Town Map
one tick before close #1 starts (the probe shows a single `whiteOut` tick); `ExitTownMap`'s own frames are D3's
audit, so that tick is inside an already-approximate span.

**Mutations run against production and reverted** (all caught unless noted): notebook outer wait (5 tests);
unconditional (18,16) clear (1); blackboard rows wrap (2); Text2 with letter delays (3); no initial `Delay3` (5);
LEFT ignored in its own column (first survived, so CP2 added the "no heading printed" assertion; then 1); second
close at the font-loaded cost (5); no font copy (4); no in-place close (4); Town Map text with PrintText's +3 (3);
four-tile pictures left out of the full reload (5).

**Browser check (CP3).** Muted headless Chrome on a spare port (:5189, isolated profile) through the DevTools
protocol, saves staged in `localStorage` and CONTINUE. A scratch-only per-tick probe wraps `Date.now` (`gameTick`
calls it once per tick) and reads `getActiveScript()` from `import('/src/script/script_controller.ts')`. All three
houses: opening 20, white-out + font copy 20, first close 9/11/13; a B exit gives Hold + full close exactly 17
(Route 2 trade house); zero console errors. The scripts are not in the repo (they lived in Claude's scratchpad),
and the spare Vite server has been stopped. **No browser check yet** for the notebook or the blackboard (unit
traces only); run one with CP5's final smoke.

### CP4 for Codex: Oak's speech (§3.5, §4.4; D2 = yes, so the name menu is in)

Suggested shape (Claude's design, not yet built or tested; re-derive from `oak_speech.asm`/`oak_speech2.asm`):

- **`TextBox.printStandalone(source, {bindings})`**: if the box isn't an active `printText`-mode box,
  `reset('printText')`; then `textComplete = false` and `start(printing(source, {box: 'new', bindings}))`. That
  reuses `printing()` (clear, the deferred sprite hook, `Delay3`, the program) and keeps the screen and Joypad
  history across calls. `printText` mode already transfers BG from the first frame and renders at T. Completion is
  `isComplete`; `dismiss()` stands for `ClearScreen`.
- **`menus/oak_speech.ts`**:
  - Replace the seven `getText('OAK_SPEECH_*')` with the programs, and each "wait for the legacy box to close" with
    `isComplete`.
  - Give its `TextBox` a host whose `cry()` records the cue (`PIKACHU` between 2A and 2B).
  - Keep the box through each fade and dismiss it at the fade's end (the ASM's `ClearScreen`). Remove the
    `dismiss()` on a preset pick, so the box stays through the slide back.
  - The custom-name return waits 6 frames with no pic (`ClearScreen` 3 + `Delay3` 3), then shows Red and prints
    (first glyph +9 after `continueAfterNaming`).
  - Text3 returns on `done` and the shrink starts in that tick, the box still drawn until main's fade.
  - Call `textBox.updateDisplay()` in the retained-box phases (fades, slides, menu, shrink), so the last thirds still
    transfer.
  - The name menu: `new MenuInput({watched: ['a'], maxItem: 3, topX: 1, topY: 2})`, `update(readJoypad, () =>
    playSFX('press_ab'))`; item 0 is NEW NAME. The cursor comes from `menu.cursor`.
- **`main.ts:1097`**: add `state !== 'oak_speech'` to the idle `syncJoypadRead` guard. `OakSpeech`'s box and menu own
  every read, and `MenuInput`'s edges compare against the last actual read.
- **Tests** (`menus/oak_speech.test.ts`, mocking renderer/input/audio as `story/school.test.ts` does):
  - each program with the box at T and the first read +3
  - the cry cue once, after 2A, and 2B's text reached
  - prompts with ▼
  - Text3 into `shrink` with no input and no beep
  - the box active through `fadeout1` and inactive after it
  - the box kept through `player_slide_back`
  - the custom-name +6/+9
  - the name menu: `Delay3`, no wrap, B re-arms silently, A beeps
- **Watch out for:** the `oak_speech` state ticks only through `OakSpeech.update()`, so nothing else advances BG
  transfers. A frame-exact trace needs the same per-tick probe idea as CP3.

### CP5 for Codex: cleanup, docs, result

- **Code cleanup:**
  - Retire the legacy `yesNo` command: no caller is left after CP1. That is the union member,
    `script_controller.ts`'s `case 'yesNo'` and `scriptYesNoActive`/`scriptYesNoPending`, with a string-list
    tripwire, as A5b5c did.
  - Keep `text`, `textButtonWait` and `closeText` (A5b7).
- **The note-24 inventory rows** become "Done A5b6", as §4.5 lists. The `game_text` keys stay.
- **Subsystem docs:**
  - `story/ARCHITECTURE.md`: school, Town Map, the new commands, the legacy list.
  - `text/ARCHITECTURE.md`: `closeInPlace`, the `reload` close, `clearInterior`, the standalone PrintText, N-1. Remove
    the "Town Map sign passes `close: false`" line.
  - `menus/ARCHITECTURE.md`: `menu_input.ts`; `BlackboardMenu` is gone, so drop its section; `OakSpeech`.
  - `overworld/ARCHITECTURE.md:329`: the stale Town Map sentence.
- **`CONVENTIONS.md` → *The test suite*:** add an A5b6 bullet and the new count.
- **Root `CLAUDE.md`:** the baseline only.
- **Final browser smoke** (spare port, muted, isolated; leave `:5173` untouched):
  - the notebook's three NO exits and the full read
  - the blackboard: every heading, both columns, UP at the top, QUIT and B
  - one Town Map
  - a new game through both naming paths
- Append an **Implementation result** here covering CP4–CP5. Then stop for the review (the user picks the reviewer)
  and the play-test in §6 (A = Z, B = X).


## Implementation result - Codex/Sol, 2026-10-13 (CP4-CP5)

A5b6 is implemented. Claude's CP1-CP3 commits remain `ad397c2`, `8ba1f11`, `3689f23`.
Codex's CP4 is `3aa238c`; CP5 is this commit. Stop for the user's chosen reviewer
(note 38), then the user play-test in section 6. Nothing pushed.

### CP4 and CP5

CP4 adds `TextBox.printStandalone`: border at T, clear and Delay3, source program,
retained screen and read history. Oak uses all seven programs, including Text2's
PIKACHU cue and 2B. Each program returns into the next speech phase without a
legacy close. Boxes and BG transfers stay through fades, name menus, preset slides
and shrink, until ClearScreen. Both custom naming returns keep the screen/picture
clear for six frames, then print (+9 first glyph). Name menus use A-only MenuInput,
no wrap, silent B re-arm and an A beep. Main excludes Oak speech from idle input sync.
Cry playback/wait and the existing animation timings/sounds remain deferred as approved.

CP5 removes the unused legacy `yesNo` command, pending/active state and its update
branch; retained `yesNoChoice` still renders. The school's string-list tripwire
already rejects `yesNo` alongside other legacy commands. The CP2/CP3 cleanup was
confirmed: no BlackboardMenu/state/openBlackboard, pendingTownMap or TextBoxOptions.close.
Kept the A5b7/compatibility `text`, `textButtonWait` and `closeText` paths.
Inventory rows are Done A5b6; compatibility aliases stay. Baselines and the four
subsystem docs are current. No extractor, generated-data, audio-engine, A6 movement,
Pikachu-program, YesNoMenu or close-counter change.

### Gates and tests

Final: **1242/1242 ROM tests in 64 files; no-ROM 1119 pass / 123 skip**.
A5b6 adds 47 net tests: Claude +30, Codex +17. Typecheck, build and diff check pass.
Build: 121 modules, 342.82 kB JS, 101.23 kB gzip. No setup needed or run; generated
files are unchanged. One ASM-comparison timeout occurred during the concurrent CP4
build/test run; the unchanged standalone full suite passed, as did the final suite.

`oak_speech.test.ts` is new: every program's border/read/glyph timing; cue and 2B;
retained fades and preset slides; both custom returns; silent done into shrink;
name-menu delay/no-wrap/B/A behavior; held A across the prompt; input-ownership tripwire.
No existing test was weakened in CP4-CP5. The section 8 edits already made by Claude:

- `textbox.test.ts`: replaced the transitional Town Map one-frame-ending case;
  the handler's double-close traces in `town_map_sign.test.ts` supersede it.
- `item_pickup.test.ts`: removed only the obsolete pendingTownMap field from expected actions.
- `ui_entry.test.ts`: dropped blackboard from the state list because CP2 removes that state;
  its script/display now owns entry.
- The text-runner comparison remains; CP1 added two N-1 regressions beside it.

### Final muted browser smoke

One uninterrupted headless Chrome run on isolated **127.0.0.1:5188** passed **14 flows**:

| Path | Verified frame counts and behavior |
|---|---|
| Notebook NO at question 1, 2, 3; full read | First glyph +23; every menu +3 first read and 15-frame tail; close 13; girl's wait has no arrow; no outer wait |
| Blackboard all five headings, both columns, UP at top, QUIT; separate B exit | First glyph +23; complete question at loop +3 in one CPU frame; first menu read at loop +6; no top wrap; restored empty box; close 13 |
| Town Map in all three houses, each with A held and with B | First glyph +20; arrow/beep, then white-out/font copy 20; closes Blue's House 9/14, trade house 11/17, Nickname House 13/22; A Holds and B passes; two trailing updates and only the initial opening update |
| Preset player/custom rival; custom player/preset rival, each through Red's room | Seven programs, every first glyph +3; one PIKACHU cue and 2B; boxes active throughout fades and shrink; custom box +6/glyph +9; name-menu first reads +3; Text3 return and shrink start share a tick; zero idle main syncs during oak_speech |

Canvas snapshots of blackboard, name menu and Pikachu 2B were visually inspected.
Scratch-only response instrumentation wraps real TextBox/MenuInput/gameTick methods;
manual ticks call updateInput, gameTick, checkUiEntry and the renderers. The audio
clock advances at the GB rate during stepped ticks, with yields for async sound
loads. This avoided a harness stall from stepping gameplay while starving audio's
wall clock and pending promises. No product debug hooks committed. Temporary traces,
images and scripts are under the system temp directory's pkmn-a5b6 folder.
Storage cleared; Chrome and spare Vite closed; port 5173 and the user's saves untouched.

### Production mutations (all reverted)

Claude's eleven CP1-CP3 checks and counts are recorded in Progress and handoff above.
Codex ran seven additional mutations against production, using the new sequence tests:

| Mutation | Failing tests |
|---|---|
| Standalone PrintText loses Delay3 | 9 |
| Text2 runs only 2A, dropping cue and 2B | 2 |
| Text3 requires an extra press | 1 |
| Custom-name return at +5 | 2 |
| Name menu watches B | 1 |
| Idle main joypad sync restored during Oak speech | 1 |
| Retained BG transfers removed | 1 |

Every mutation was restored before gates; no self-mutating tests were added.
The ASM confirmed section 3.5's +3, custom +6/+9, retained boxes, cue/FAR order,
A-only menu and done return. CP1-CP3's existing counts were reproduced in the browser.
No plan/disassembly disagreement was found. The deferred Town Map internals and
intro-animation approximation remain exactly the approved boundaries.
