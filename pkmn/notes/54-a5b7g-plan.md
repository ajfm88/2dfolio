# A5b7g plan: retire the legacy text paths, and finish A5b's caller census

**2026-10-15 · Claude · Approved: the user answered "yea to all" to §9 (O-29 → DECISIONS #60).**
Implementer: **Sol**, g1 first (§4: CP1, then CP2), then g2 (§5). Claude reviews each.

Parent: `notes/39-a5b7-plan.md` §1 (A5b7g row: "remaining caller census, justified legacy-command
retirement, A6e fixture migration and final regression"), §6 *Cleanup*; note 36 N-3; note 51 N-1;
note 53 N-1; `notes/24-a5b1-text-data.md` §5 (the `getText()` consumer table). DECISIONS #52.
Baseline: **1563/1563** with the ROM (86 files), **1433 pass / 130 skip** without it; typecheck clean.

## 1. Recommendation

The census (§3) finds two kinds of work:

- **Dead code with no production caller:** script `text` and `closeText`, the Lab guard's `guardText`
  branch, the non-display `textButtonWait` fallback, TextBox's `legacy` mode and `end` option, and
  upstream's never-set `commandState`. Removing them needs only test migration and changes nothing on
  screen, apart from F-1 (§4).
- **Texts that never moved to the cartridge's programs:** bookshelves (`getText` keys plus one
  hand-written line) and hidden-event texts (flattened strings). Here the census found three visible
  departures on today's maps (§3.3).

So split A5b7g into two sub-slices, both specified here (§9 Q1):

| Sub-slice | Deliverable | Visible? |
|---|---|---|
| **A5b7g1: retirement and test debt** | The A6e fixture on the real session (note 36 N-3), legacy-test migration, the seven missing assertions (notes 51/53 N-1), census tripwires, legacy removal, F-1, the final A5b regression | F-1 only |
| **A5b7g2: hidden events and bookshelves as programs** | A data checkpoint for the predef programs, then one interaction→display builder shared by the overworld and the Lab's free movement: the right poster's branch, `PrintBookshelfText`'s facing-up and one-tile rule, `BookOrSculptureText` / `IndigoPlateauStatues` as handlers | Yes |

**Why g2 belongs here and not in V5:** V2 comes next and adds a Pokécenter bench guy, Mart shelves and
house bookshelves. On the program path they are data entries. On today's path each one would be another
flattened string or `getText` key that someone later has to migrate.

## 2. Sources

All in `refs/pokeyellow/`:
- `home/text_script.asm` (DisplayTextID, PrintPredefTextID).
- `home/window.asm:268` (Enable/DisableAutoTextBoxDrawing).
- `engine/menus/display_text_id_init.asm` (`BIT_NO_AUTO_TEXT_BOX`).
- `home/joypad2.asm:55` (WaitForTextScrollButtonPress, HandleDownArrowBlinkTiming).
- `engine/events/hidden_items.asm`.
- `engine/events/hidden_events/`: `bookshelves.asm`, `book_or_sculpture.asm`, `elevator.asm`,
  `indigo_plateau_statues.asm`, `pokemon_stuff.asm`, `blues_room.asm`, `oaks_lab_posters.asm`,
  `oaks_lab_email.asm`, `reds_room.asm`, `bench_guys.asm`.
- `data/events/hidden_events.asm:107–110, 322–351`, `data/tilesets/bookshelf_tile_ids.asm`.
- `scripts/OaksLab.asm:1–11` (the map script sets `BIT_NO_AUTO_TEXT_BOX` every pass).

Addresses come from pret's sym file (`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`), listed
in §6.1.

Runtime read:
- `script/{types,engine,index,script_controller}.ts`, `text/{textbox,map_dialogue,map_text_calls}.ts`;
- `overworld/{player,map,overworld_controller,item_pickup}.ts`, `story/{oaks_lab,pokecenter,text_handlers}.ts`;
- `rom/text_program_symbols.ts`, `rom/extractors/maps.ts` (hidden events);
- the tests `script/text_commands.test.ts`, `text/textbox.test.ts`, `overworld/overworld_controller.test.ts`
  (A6e and A6d blocks), and `story/pokecenter.test.ts`.

## 3. The census

### 3.1 Script commands (`script/types.ts`)

| Command / state | Production emitters | Verdict |
|---|---|---|
| `text` (+ `scriptTextWaiting`) | **none** (Lab, nurse, Mart, Viridian, pickups all emit `printText`) | **Retire** (g1). Tests: `text_commands.test.ts`, the A6e fixture, the A6d pushed hop |
| `closeText` (+ its `scriptClosingText` use) | **none** | **Retire** (g1). `displayClose {outerWait: false}` is the same `TextBox.finish`; its tests move there |
| `textButtonWait`, display path | `item_pickup.ts:36` (hidden item, full bag) | **Keep.** It is the cartridge's `WaitForTextScrollButtonPress`. The routine blinks ▼ only if the tile at (18,16) is already ▼ (`hDownArrowBlinkCount1` = 0), so for this caller it is silent and draws no arrow, as `waitSilent()` does |
| `textButtonWait`, non-display path (`scriptButtonWaiting`, `syncJoypadRead`) | none (the hidden-item script always opens a display first) | **Retire** (g1). Without an open display, throw, as `hideDisplay` does |
| `awaitInteraction.guardText`, sub-states `guard_text` and `target`, the `{}` fallbacks (`script_controller.ts:1164–1176, 1198`) | none (both `oaks_lab.ts` callers pass `guardProgram`) | **Retire** (g1). Make `guardProgram` required; `guard_step` always ends in `guard_delay` |
| Free-move NPC fallback `textBox.show(...)` (`:1164`) | unreachable: every Lab NPC has a handler or a plain call (rival/ball/Oak handlers 1–3; pokedex/girl/scientists `printText` 4,5,7,8,9) | **Retire** (g1), behind a tripwire: every object on a map that uses `awaitInteraction` must resolve |
| Free-move hidden-text fallback (`:1174`) | reachable: Lab posters, e-mail and LAB bookshelves during the starter choice | **F-1 in g1** (§4), then replaced by the shared builder in g2 |
| Free-move `'scriptId'` ignore (`:1171`) | Lab has none today | g2: dispatch through the shared builder (the right poster becomes a script id) |
| `commandState`, `CommandState`, `isCommandDone` (`engine.ts`, `index.ts`) | never set or read (upstream scaffolding; its `text` variant is the old model) | **Retire** (g1) |

Out of scope, stated so nobody removes them by sweep:
- Battle and catch-demo `text` steps are separate unions (A5c).
- `legacyBattleProgram` stays until A5c.
- Pre-display wait/fade input ownership (`script_controller.ts:385`) is A6-verified movement timing, not
  text.
- `fadeOut`/`fadeIn`, `healParty` and `pokecenterHeal` belong to the healing-machine slice and Mom's
  approved gap.

### 3.2 TextBox entry points

| Entry | Callers | Verdict |
|---|---|---|
| `show(text, {mode: 'displayTextID', …})` | `MapDialogue` (NPCs, signs, trainers, hidden texts), the free-move fallbacks | Keep. See §3.4 for why the string source is equivalent today |
| `show(text)` with the default `legacy` mode, and the `end` option | only script `text` and the dead free-move fallbacks | **Retire** (g1). The invented press-and-beep dismissal, `TextBoxEnd` and the `<PROMPT>/<DONE>` strip all go |
| `show(text, {mode: 'printText'})` | none | Retire (g1). `printStandalone` keeps the `printText` mode internally |
| `open` / `print` / `printStandalone` / `waitSilent` / `finish` / `closeInPlace` | all migrated callers | Keep |

A5c audit (note 39 §6 asked for one): no battle file uses TextBox. `battle_ui.ts` only mentions
`TextBoxBorder` in comments. A5c will run battle text on the printer/runner (`printStandalone`/`print`
semantics), not on an invented press-and-beep ending. So nothing in A5c needs `legacy`.

### 3.3 Overworld texts not on programs (g2)

| Source on the cartridge | Today | Departure |
|---|---|---|
| `PrintBookshelfText` → `BookOrSculptureText` (text_asm, inner `PrintText PokemonBooksText`) | `getText('BOOKSHELF_BOOKS')` | No inner PrintText: first glyph **+20 instead of +23**. Diglett branch missing |
| → `PokemonStuffText` | `getText('BOOKSHELF_POKEMON_STUFF')` | String only |
| → `ElevatorText` | the hand-written literal `'This is an\nelevator.'` (`map.ts:113`) | Hand-written game text |
| → `IndigoPlateauStatues` (text_asm, two PrintTexts, `wXCoord` parity) | `getText('BOOKSHELF_STATUES')` | Wrong structure (not on a current map) |
| `PrintBookshelfText`'s gate: **facing up only, the one tile at (8,7)** | any facing, two tiles (`player.ts:176–183`), the Town Map shelf too | **Visible:** shelves read from the side or from below. Note 37 traced the rule; it was never implemented |
| `DisplayOakLabRightPoster`: `SaveOptionText` when < 2 owned, else `StrengthsAndWeaknessesText` | always the SAVE string | **Visible:** wrong text once 2 are owned |
| `PrintBookcaseText`, `DisplayOakLabLeftPoster`, `DisplayOakLabEmailText` (returns unless facing up), `PrintRedSNESText`, `PrintBenchGuyText` (facing from `BenchGuyTextPointers`) | flattened `text` strings via `textOffset` | Strings match (Blue's bookcase reads `_PokemonBooksText`'s address; it has the same words as `_BookcaseText`). Moves to programs for provenance and for V2 |

`RedsHouse1FTVText` already runs as a handler (A5b5a).

### 3.4 What stays, verified

- **Ordinary NPC and sign `dialogue` strings through `MapDialogue`:** of the 80 plain `text`/`printText`
  calls on the 19 maps, 78 have text-only programs. The other two (`OaksLabOakGotPokedexText`,
  `ViridianMartClerkParcelQuestText`, both with a `sound` op) are dispatched by handlers. So the
  flattened string shows exactly what the program would. g1 adds a tripwire so a V2 map can't break this
  silently.
- **`getText()` after g2:** battle (`battle.ts`, `effects.ts`, `PARTY_CHOOSE` in battle mode) is A5c, and
  the catch-demo names are labels. Alias retirement in `game_text.json` stays a later data-only change
  (note 39 §6).

## 4. A5b7g1: retirement and test debt

### F-1: Lab hidden texts are invisible during the starter choice

`OaksLab_Script` sets `BIT_NO_AUTO_TEXT_BOX` every pass. But every hidden-event and bookshelf routine calls
`EnableAutoTextBoxDrawing` first, so its DisplayTextID draws the border. The free-move fallback passes
`autoBox: false` for these texts (`script_controller.ts:1174`), and `TextBox.render()` draws nothing
without a border. So reading a poster, the e-mail or a Lab bookshelf before choosing a starter blocks the
game with no box and no text. **Fix:** `autoBox: true` for the `'text'` interaction, with a test. (g2
replaces this line; the fix stands on its own if g2 is declined.)

### CP1: tests first (no production change; all pass on today's code)

1. **The A6e fixture (note 36 N-3).**
   - Replace `healScript()`'s rewrite with the real yes branch on the real `TextBox`, using the host and
     program spy that `pokecenter.test.ts` `trace()` uses (`textBox.print` spied, frames recorded per
     program).
   - Keep every assertion, with program names instead of messages:
     - **healthy:** 69 walk frames ending before `NeedYourPokemonText`; no image while
       `PokemonFightingFitText` prints; the image is back more than 40 frames before
       `PokemonCenterFarewellText`, at player.y − 16; the facing restored to `up`; follow `[1, 1]`;
     - **fainted, three facings:** the visible / image / position / facing tuple, and the render
       frame/flip after the next UpdateSprites;
     - **no starter:** ends, follower invisible.
   - Delete the `quickText` stub. Import `buildNurseScript` from `story/pokecenter` and delete the
     re-export at `overworld_controller.ts:464`.
2. **The A6d pushed hop:** end it with `displayOpen` + a real `printText` (any one-line program) instead
   of `text 'Landed.'`. Keep the landing/input assertions.
3. **`text_commands.test.ts`:** rewrite on displays.
   - sound (both `waitForCurrent`), `textButtonWait` A/B silent with no arrow, Hold-while-A then the
     7-frame close (as `displayClose {outerWait: false}`), `hideObject`, and the retained-display
     dismissal at script end.
   - Delete the four explicit-ending cases (`end: 'none'`/`'prompt'`, legacy beep). In the test file's
     header comment, map each to the existing program-path test that covers it:
     - prompt's 3 protected frames and one beep, and the button remembered during a sound wait:
       `text_printer.test.ts`;
     - none returning without reads: the `printText` return cases in `textbox.test.ts`;
     - paging: `text_printer.test.ts` / `text_runner.test.ts`.
   - Where no equivalent exists, port the case to a program instead of deleting it.
4. **`textbox.test.ts`:** remove the legacy-strip and explicit-ending cases (lines 69, 74, 78) the same
   way.
5. **Missing assertions** (each verified by its reviewer mutation, which must fail):
   - note 53 **M1**: `host.textBox.active === false` after the main YES close;
   - **V9**: with no sound playing, `save` starts at R2+10;
   - **M6**: the bag's retained image through the 5 ITEM-tail copy frames, through main;
   - **V8/M5**: the message box's last frames during the restore and the first close frame;
   - note 51 **M2**: the WITHDRAW/DEPOSIT submenu label;
   - **M10**: BillsPCMenu's empty bottom box at (0,12), 4×18.
6. **Census tripwires** (new `text/text_census.test.ts`, no ROM):
   - every plain current-map call reached through `MapDialogue` has a text-only program (§3.4);
   - every object on a map that uses `awaitInteraction` resolves to a handler or a plain call;
   - `getText(` appears only in the files allowed after g1 (the list in §3.4 plus `overworld/map.ts`,
     which g2 removes).

### CP2: retirement, then the final A5b regression

1. Remove from `script/types.ts` and `script_controller.ts`: `text`, `closeText`, `scriptTextWaiting`,
   `scriptButtonWaiting` with its fallback, `guardText`, `guard_text`, `target`, the two `{}` fallbacks
   and the NPC fallback; plus `CommandState`, `commandState` and `isCommandDone`. Simplify the
   `!(guardProgram && …)` condition at `:282`. Apply F-1.
2. TextBox: delete the `legacy` mode, `TextBoxEnd`, `TextBoxOptions.end`, `show()`'s `mode` and its
   non-DisplayTextID branch. `show()` becomes the DisplayTextID wrapper. `printStandalone` keeps
   `printText` internally.
3. Docs:
   - `story/ARCHITECTURE.md`: the command list (it also names `movePikachu`, which doesn't exist), the A1b
     table and the "legacy `text` remains" paragraph;
   - `text/ARCHITECTURE.md`: the TextBox wrapper table;
   - `overworld/ARCHITECTURE.md:322`: the re-export;
   - `audio/ARCHITECTURE.md:86`: "legacy textboxes";
   - `CONVENTIONS.md` → *The test suite*.
4. Gates: typecheck, ROM and no-ROM suites (**three cold runs**; name any intermittent failure; one
   unnamed failure appeared in 1 of 9 runs on 2026-10-15), build, `git diff --check`. No extractor
   change, no setup run.
5. Mutations, temporary and restored:
   - re-add the invented beep on a display close;
   - make `textButtonWait` sync input without a display;
   - drop F-1;
   - drop the M1 dismiss;
   - plus each N-1 line.
6. **Muted browser smoke on a spare port** (e.g. :5189, fresh storage):
   - a hidden item with a full bag (both silent waits);
   - an item ball;
   - Oak's Lab before the choice: guard, girl, poster and e-mail, which now show (F-1);
   - the nurse with a following Pikachu;
   - Mom's heal; a sign; a Forest trainer; START → SAVE → CONTINUE.

   Zero page errors; :5173 untouched.

## 5. A5b7g2: hidden events and bookshelves as source programs

### 5.1 Flow (from the ASM)

- **Order** (`home/overworld.asm`, A1b): hidden event → (none) `PrintBookshelfText` → (no match)
  `PrintCardKeyText` → signs → sprites.
- **`PrintBookshelfText`:** only when facing **up**; reads the one tile at screen (8,7), the tile
  directly above the player's step (today's `adjTx/adjTy` for UP); matches `(tileset, tile)` in
  `BookshelfTileIDs`; `EnableAutoTextBoxDrawing`; `PrintPredefTextID` → DisplayTextID with the border.
- **Plain predefs** (`text_far` + `text_end`): open +4, first glyph **+20**, outer wait, Hold, close.
  These are `PokemonStuffText`, `ElevatorText`, `BookcaseText`, `PushStartText`, `SaveOptionText`,
  `StrengthsAndWeaknessesText`, `OakLabEmailText`, `RedBedroomSNESText` and
  `ViridianCityPokecenterBenchGuyText`.
- **`BookOrSculptureText`** (text_asm):
  - `PrintText PokemonBooksText`: a new box, clear, Delay3, so the first glyph is at **+23**;
  - except on the MANSION tileset with tile $38 at screen (8,6) (the tile two above), which prints
    `DiglettSculptureText`;
  - then `TextScriptEnd`, outer wait and close.
- **`IndigoPlateauStatues`** (text_asm): `PrintText Text1`, then `PrintText Text2` if `wXCoord` is odd,
  else `Text3`.
- **`DisplayOakLabRightPoster`:** CountSetBits(wPokedexOwned) ≥ 2 → `StrengthsAndWeaknessesText`, else
  `SaveOptionText`. Use the handler context's `ownedCount`.
- **The Lab's free movement:** the overworld loop runs as usual, so the same DisplayTextIDs and borders
  apply (§4 F-1).

### 5.2 CP1: data (extractor only)

1. **Symbols** (`rom/text_program_symbols.ts`; roots, then `text_far` children, from the sym file):

   | Label | Address | Root |
   |---|---|---|
   | `PushStartText` | 07:62F9 | yes |
   | `SaveOptionText` | 07:6317 | yes |
   | `StrengthsAndWeaknessesText` | 07:631C | yes |
   | `OakLabEmailText` | 07:6693 | yes |
   | `RedBedroomSNESText` | 17:5BB6 | yes |
   | `ViridianCityPokecenterBenchGuyText` | 18:667B | yes |
   | `BookcaseText` | 18:66E9 | yes |
   | `IndigoPlateauStatuesText1` / `2` / `3` | 03:7A67 / 03:7A6C / 03:7A71 | yes |
   | `PokemonBooksText` | 03:7A91 | yes |
   | `DiglettSculptureText` | 03:7A96 | yes |
   | `ElevatorText` | 03:7A9B | yes |
   | `PokemonStuffText` | 03:7AD3 | yes |
   | `_ViridianCityPokecenterGuyText` | 27:60A0 | no |
   | `_BookcaseText` | 27:6492 | no |
   | `_PushStartText` | 27:64C5 | no |
   | `_SaveOptionText` | 27:64E3 | no |
   | `_StrengthsAndWeaknessesText` | 27:650B | no |
   | `_OakLabEmailText` | 27:6911 | no |
   | `_RedBedroomSNESText` | 27:6DD8 | no |
   | `_IndigoPlateauStatuesText1` / `2` / `3` | 27:742F / 27:743F / 27:746E | no |
   | `_PokemonBooksText` | 27:7499 | no |
   | `_DiglettSculptureText` | 27:74B6 | no |
   | `_ElevatorText` | 27:74D3 | no |
   | `_PokemonStuffText` | 27:74F7 | no |

   The two text_asm routines aren't listed (the file's own rule); their PrintText targets are.
   Confirm each `ld hl, Label` operand in the ROM (CONVENTIONS: never find an address by its bytes).
2. **Hidden events** (`extractors/maps.ts`, additive):
   - `program?: string` on `MapHiddenEvent` for the plain entries:
     - Blue's House ×3 → `BookcaseText`;
     - Lab (4,0) → `PushStartText`;
     - Lab e-mail ×2 → `OakLabEmailText`;
     - Red's House 2F SNES → `RedBedroomSNESText`;
     - Viridian Pokécenter bench → `ViridianCityPokecenterBenchGuyText`.
   - The Lab's (5,0) gets `scriptId: 'OAKS_LAB_RIGHT_POSTER'` instead of its text.
   - `text`/`textOffset` stay (no alias cleanup).
3. Setup twice: byte-identical. The diff is limited to `text_programs.json`, the four map JSONs and their
   `static/` mirrors. The existing op-for-op program test covers the new labels. Add a pinned test of each
   hidden event's routine → program against `data/events/hidden_events.asm` and the routine files.

### 5.3 CP2: runtime

1. **One builder,** `interactionDisplay(interaction, ctx) → ScriptCommand[] | null`:
   - hidden-event programs: `displayTextID([printText {box: 'keep'}])`, outer wait;
   - hidden-event script ids: the right poster, the TV, the notebook/blackboard/PCs as today;
   - bookshelf predefs: the plain ones as programs; `BookOrSculptureText` and `IndigoPlateauStatues` as
     handlers with `box: 'new'` PrintTexts.

   `overworld_controller.handleInteraction` and `updateScriptFreeMove` both use it. The free-move path
   runs it through `startFreeDisplay`, as NPC handlers already do. Delete the last `textBox.show`
   fallback and the "scripted hidden event — ignore" branch in the controller. (Note 39 §3: one owner, no
   second interpreter.)
2. **Bookshelf gate:** facing up and the one tile, for the Town Map shelf too. `BOOKSHELF_TILES` maps to
   predef labels. Delete `BOOKSHELF_TEXT`, the elevator literal and the three `getText('BOOKSHELF_*')`.
   Tighten the g1 `getText` tripwire.
3. **Tests:**
   - each plain predef +20, `BookOrSculpture` +23, statues 2 PrintTexts with parity, Diglett tile and
     tileset, and the closes;
   - the right poster at 1 and 2 owned;
   - a bookshelf: nothing facing left, right or down, and nothing on the second tile up;
   - the Town Map shelf facing up only;
   - Lab free movement: poster, e-mail and bookshelf as nested displays that return to the await, and
     the right poster dispatched (not ignored);
   - order: a hidden event still wins over a shelf.
4. **Mutations:** facing gate removed, second tile restored, +20 on the books, the owned threshold at 1,
   the free-move scriptId ignored again.
5. Gates as in g1, plus the muted browser checks on a spare port: Lab shelves and posters (side and
   front), Viridian Mart/Pokécenter shelves, the bench, the SNES, Blue's bookcase, the Town Map shelf.

## 6. Gaps this slice keeps (each with a home)

| Gap | Home |
|---|---|
| Hidden-event `facing` as a lookup filter instead of the routine's argument (Blue's bookcases from the side, note 19 N-2) | V5 map-object audit (unchanged) |
| `PrintCardKeyText` after a missed bookshelf | G1 (Silph Co) |
| Other maps' `BenchGuyTextPointers` entries | each map's slice (V2 adds Pewter's) |
| `MapDialogue` showing the flattened `dialogue` string for plain calls (equivalent today, tripwired) | J2, if ever a plain program gains a non-text op |
| Battle text, `legacyBattleProgram`, battle `getText` callers | A5c |
| `game_text.json` alias retirement | later data-only change (note 39 §6) |
| Pre-display wait/fade input ownership | A6-verified; not text |

## 7. Checkpoint summary

| Sub-slice | CP | Commit content | Stop for |
|---|---|---|---|
| g1 | CP1 | test migration, the seven assertions, tripwires (all green on today's code) | — |
| g1 | CP2 | removal, F-1, docs, final regression, browser smoke | Claude's review |
| g2 | CP1 | symbols, hidden-event fields, regenerated data | — |
| g2 | CP2 | builder, bookshelf gate, handlers, tests, browser smoke | Claude's review, then the user's play-test |

## 8. User play-tests

**g1** changes one visible thing. In Oak's Lab before choosing a starter, read a poster and the e-mail:
the text box now appears. Optionally replay a hidden item with a full bag, a nurse heal with Pikachu, and
a save.

**g2** (Z = A, X = B):
1. Oak's Lab right poster: the SAVE line with 1 owned; after catching a second Pokémon, "All POKéMON
   types have strong and weak points…".
2. Lab bookshelves, Red's House 1F shelf, a gate shelf: the text appears only when facing **up**, and the
   books text starts a beat later than a sign's (+23).
3. Viridian Mart and Pokécenter shelves: "Wow! Tons of POKéMON stuff!" only facing up.
4. Blue's House Town Map shelf: only facing up.
5. The Pokécenter bench (facing left), the SNES, Blue's bookcases and the e-mail read as before.
6. During the starter choice: posters, e-mail and shelves show, and you can still walk afterwards.

## 9. Decisions for the user (O-29)

1. **Split A5b7g into g1 (retirement and test debt) and g2 (hidden events and bookshelves as programs),**
   in that order, before the StatusScreen port. *Recommended.* The alternative is g1 only, with g2's
   departures sent to V5.
2. **g2's data:** additive `program` fields on hidden events, a script id for the right poster, and all
   four bookshelf predefs extracted (including the elevator, statues and Diglett, which aren't on today's
   maps), so the hand-written line and the `getText` keys go. *Recommended.*
3. **The bookshelf facing-up, one-tile rule in g2.** Shelves stop reading from the side. The hidden-event
   facing filter stays in V5. *Recommended.*
4. **Who:** Sol implements g1 (two checkpoints), then g2 (two). Claude reviews each; the user play-tests
   g2 and glances at F-1. *Assumed from the standing workflow.*

## 10. A5b7g1 CP1 result — 2026-10-15, Codex/Sol

**CP1 complete, tests only. Stopped at the user's requested boundary; CP2 has not started.**

- The A6e nurse fixture uses the unmodified `buildNurseScript` imported from `story/pokecenter`,
  including the actual YES menu branch, a real hosted TextBox and the `trace()` program-print spy.
  `healScript()` and `quickText` are gone. Every earlier assertion remains: the 69 walk frames and
  their ordering, hidden fighting-fit image, image before the bow/farewell, Y placement, saved facing,
  follow `[1, 1]`, all three fainted facings and next-update render/flip tuples, and no-starter completion.
  The hidden-image check also spans the full fighting-fit print. The production re-export remains for CP2.
- The A6d pushed-hop fixture opens a display and runs committed `WhatText`; its landing, input and
  ledge-flag assertions remain, and a spy confirms real program dispatch after the opening.
- `script/text_commands.test.ts` now exercises display sound waits (both waitForCurrent branches),
  silent A/B `textButtonWait`, held-A/direct seven-frame `displayClose`, saved HideObject/collision state,
  retained UI across programs and dismissal at script end. The six legacy/explicit-ending test instances
  were removed with header pointers to existing printer/runner/TextBox coverage.
- `text/textbox.test.ts` removes three legacy-strip/explicit-ending cases with the same coverage map.
  The other wrapper fixtures use standalone PrintText instead of `end` or `show(mode: 'printText')`.
- Sixteen new cases cover the review gaps and the census: main +6, SAVE +4, Bill's PC +3, census +3.
  With nine obsolete cases removed, the net baseline increase is **+7**. Existing main YES cases gain M1.
- `text/text_census.test.ts` needs no ROM. It recursively checks text/FAR-only programs for unhandled
  NPC/sign calls actually reachable from current-map object IDs (including alternate tables), checks every
  object on maps whose story builder emits `awaitInteraction`, and checks the approved `getText` caller
  files using TypeScript ASTs. Internal Lab program IDs run by handlers are not flattened MapDialogue calls.

### Reviewer mutations: all seven caught, then restored

Each mutation changed the actual production line temporarily, ran only the corresponding test selection,
and failed with an assertion in the intended test. Original bytes were restored in a `finally` block and
SHA-256 checked after each mutation; no mutation remains in the diff.

| Review ID | Temporary mutation | Catch |
|---|---|---|
| note 53 M1 | Remove `textBox.dismiss()` at shared close completion | main YES close: **3 failures** (idle offsets 0/1/2) |
| note 53 V9 | Save sound delay 9 instead of 10 | no-current-sound R2+10 case: **1 failure** |
| note 53 M6 | Drop main's retained bag scanout restore | actual ITEM return: **3 failures** (offsets 0/1/2) |
| note 53 V8 | Dismiss the lingering message on transfer third 0 instead of 2 | Buffer2/bottom-third cases: **3 failures** |
| note 53 M5 | Paint START instead of SAVE in the first shared-close frame | retained message glyph/background render: **3 failures** |
| note 51 M2 | Swap WITHDRAW/DEPOSIT submenu labels | both submenu branches: **2 failures** |
| note 51 M10 | Drop the empty bottom box | border-call and exposed-cell layout case: **1 failure** |

Mutation logs and restoration hashes: `%TEMP%/pkmn-g1-cp1-mutations/` (`results.json` and one verbose log
per ID). The assertion names include their review IDs, except M1, which extends the existing main YES test.

### Gates on restored production code

| Gate | Result |
|---|---|
| `npm run typecheck` in `game/` | clean |
| Focused seven changed test files | **185/185** |
| `ROM_PATH=pokeyellow.gbc npm test -- --reporter=verbose`, fresh process 1 | **1570/1570**, 87 files |
| Same ROM command, fresh process 2 | **1570/1570**, 87 files |
| `npm test -- --reporter=verbose`, ROM_PATH absent | **1440 pass / 130 skip**, 87 files |
| `git diff --check` | clean |

No intermittent failure occurred in either full ROM run. Full verbose gate logs are
`%TEMP%/pkmn-g1-cp1-rom-1.log`, `pkmn-g1-cp1-rom-2.log` and `pkmn-g1-cp1-no-rom.log`.
Focused development failures were corrected in fixtures/assertions before these gates; production did not
change. No build, browser smoke or setup was run: those are CP2 gates, and CP1 changes no runtime/data.
No writes to `refs/`, `pkmn-sprites/`, extractors, `data/` or `static/`. Local commit only; nothing pushed.

**Next: wait for the user.** CP2 remains separate, including retirement, F-1, the nurse re-export removal,
subsystem documentation, three cold regression runs, build and browser checks. A5b7g1 is not yet complete.

## 11. A5b7g1 CP2 result — 2026-10-15, Codex/Sol

**Implemented and verified; stop for Claude's g1 review. No g2 work started.** The user requested the
next part after CP1 (`4cb3f57`) and allowed a stop at a verified checkpoint if needed. This completes g1's
implementation; it does not mark the independent review or user check complete.

### Production change

- Retired script `text`/`closeText`, `scriptTextWaiting`, the non-display `scriptButtonWaiting` fallback,
  `guardText`, `guard_text`, `target`, the optional-guard fallbacks and free-move NPC text fallback.
  `guardProgram` is required. A target interaction advances in the same tick; the guard always runs
  its existing one-step return and Delay3. Unresolved free-move NPCs now fail explicitly behind CP1's
  census, instead of opening legacy text. Pre-display movement/fade waits retain their input behavior.
- Removed unused `CommandState`, `commandState`, `isCommandDone` and their exports, plus the nurse's
  compatibility re-export and now-empty helper section in the overworld controller.
- `TextBox.show()` is solely DisplayTextID. Removed its mode/end options, legacy terminator stripping
  and invented press/beep dismissal. Standalone PrintText retains its internal mode, shared screen and
  read history. MapDialogue and its tests no longer pass a mode option. The retained close flag remains
  because `displayClose` actively uses it; only its dead `closeText` entry was removed.
- **F-1:** free-move hidden-event/bookshelf text uses `autoBox: true`. Read the actual ASM first:
  `home/text_script.asm`, `home/joypad2.asm`, `home/window.asm`, DisplayTextIDInit, OaksLab's map script,
  and the poster/e-mail/bookshelf routines. The Lab map disables automatic boxes; each hidden routine
  enables them before DisplayTextID. This fix preserves that distinction for ordinary Lab NPCs.
- Five new cases: invalid closed/standalone `textButtonWait` calls throw without reads (2), both Lab
  posters and e-mail use real hidden-event lookup, draw border/glyphs and return to await/ball (3).
  Pickup test inspection drops an unreachable legacy branch; the small-handler test keeps its negative
  command census without comparing a deleted union member. All CP1 assertions remain.
- Updated story/text/overworld/audio architecture and the test-suite documentation. No extractor,
  schema, data, static-asset, audio-engine or battle-union change; no setup run. Gen 1 quirks unchanged.

### Mutation verification

Ten actual production mutations were applied separately, tested and restored byte-for-byte with
SHA-256 checks in `finally` blocks. `%TEMP%/pkmn-g1-cp2/mutations.json` records hashes and exact failed
test names; the matching `.log` files retain verbose output.

| Mutation | Intended assertion failures |
|---|---|
| Add `press_ab` after the display close | 1: TextBox B bypass/full reload test |
| Replace the invalid-display throw with `syncJoypadRead()`/return | 2: closed and standalone rejection |
| Revert F-1 to `autoBox: false` | 3: left poster, right poster, e-mail |
| note 53 M1: remove main's final TextBox dismissal | 3 |
| note 53 V9: save delay 9 | 1 |
| note 53 M6: drop retained ITEM scanout | 3 |
| note 53 V8: clear message on top instead of bottom third | 3 |
| note 53 M5: paint START instead of SAVE on first close frame | 3 |
| note 51 M2: swap WITHDRAW/DEPOSIT | 2 |
| note 51 M10: omit the bottom box | 1 |

### Regression gates

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| Focused script/text/story/overworld migration suite | **316/316**, 13 files |
| ROM suite, three fresh processes with verbose reporter | **1575/1575 each**, 87 files |
| No-ROM suite, three fresh processes with verbose reporter | **1445 pass / 130 skip each**, 87 files |
| `npm run build` (includes final typecheck) | clean; 135 modules, 357.36 kB JS / 108.36 kB gzip |
| `git diff --check` | clean |

Net **+5** from CP1. No intermittent test failure occurred in any of the six full-suite runs. Logs:
`%TEMP%/pkmn-g1-cp2/{typecheck,rom-1,rom-2,rom-3,no-rom-1,no-rom-2,no-rom-3,build}.log`.
The final build was repeated after removing the empty helper header/EOF whitespace; bundle hash and size
were unchanged. Strict typechecking also identified two leftover test-only legacy branches, removed above.

### Muted browser smoke and handoff

Fresh headless Chrome profiles at **127.0.0.1:5189**, audio muted, actual production modules. Test state
and observation hooks were added only to intercepted Vite responses, never repository code. Staged saves
provide each starting state; keyboard input drives the actual interactions. Random wild encounters were
disabled only in the intercepted debug module. The renderer, text/input, scripts, sound waits and menu
dispatch remained real.

**13 checks passed:** hidden item/full bag with both silent waits and unchanged bag/flag; item-ball give/
hide/close; both Lab posters and e-mail visibly return to await; girl program/return; guard program/forced
step/Delay3; nurse heals a following Pikachu and returns; Mom heal/jingle; ordinary sign; Forest trainer
before-text → battle entry; START → SAVE's real sound wait and automatic close; reload → CONTINUE at the
saved map/position. Trainer smoke ends at battle entry, not a full combat play-through. **Zero page errors
and zero unexpected failed resources** across the core and tail passes. Expected favicon/absent wild-map
probes remain excluded. Screenshots of the hidden wait, Lab poster, nurse return and CONTINUE were viewed.

Browser evidence: `%TEMP%/pkmn-g1-cp2/browser-summary.json`, `browser-core.log`, `browser-tail.log`,
`smoke.cjs`, and `01-…08-*.png`. Harness corrections are recorded separately: one attempt was interrupted
by Vite reloading a source-comment edit; the core pass later selected `youngster1` (a non-trainer), so its
trainer timeout was corrected to BUG_CATCHER `youngster2` in the tail pass. A duplicate harness launch was
stopped with its owned Chrome process tree. These were harness issues; no runtime fix was needed.
Successful profiles' storage was cleared and Chrome closed. The owned :5189 server is stopped. The user's
**:5173 server and saves were untouched**. No permanent probe, debug hook or generated change remains.

**Next:** Claude reviews g1 against note 54 §§4/10/11 and DECISIONS #60; the user can glance at a Lab
poster/e-mail before choosing a starter (Z = A, X = B). Do not start g2 before the review boundary is cleared.
Bookshelf rules, right-poster branching and hidden-event program extraction remain g2, not this commit.
Updated STATUS and baselines; local commit only, never pushed.

## 12. A5b7g2 CP1 result — 2026-10-15, Claude (Sol was out of usage; the user asked Claude to implement)

**Data checkpoint done. No runtime change.**

- **Symbols** (`rom/text_program_symbols.ts`): the 14 roots and 14 `text_far` children in §5.2. Before
  listing them, I checked every root in the ROM:
  - the 10 `TextPredefs` pointers (00:3F67, IDs 04–08, 10, 11, 3C, 42–44) match the sym addresses;
  - `BookOrSculptureText`'s `ld hl` operands point to `PokemonBooksText` (+1) and `DiglettSculptureText`
    (+18);
  - `IndigoPlateauStatues`' three `ld hl` operands point to Text1/2/3.

  `BenchGuyTextPointers` rows are 3 bytes (map, facing, predef ID, not a pointer). Viridian's row is
  `$29, LEFT, $11` → 18:667B.
- **Hidden events** (`extractors/maps.ts`, additive `program?: string`):
  - Blue's House ×3 → `BookcaseText`;
  - Lab (4,0) → `PushStartText`;
  - Lab e-mail ×2 → `OakLabEmailText`;
  - Red's House 2F SNES → `RedBedroomSNESText`;
  - Viridian Pokécenter bench → `ViridianCityPokecenterBenchGuyText`.

  `text`/`textOffset` stay. The runtime ignores `program` until CP2.
- **Deviation from §5.2:** the right poster's `scriptId: 'OAKS_LAB_RIGHT_POSTER'` moves to CP2. Today's
  `getHiddenEventScript` has no entry for it, so changing it now would leave the poster doing nothing until
  CP2 lands. The CONVENTIONS map workflow (step 5) commits data with the code that uses it, so CP2 makes
  that one-line extractor change and re-runs setup together with the handler.
- **Data:** setup twice, byte-identical (same SHA-1 over every JSON/PNG). The diff is additions only:
  `text_programs.json` (+28 programs), `BluesHouse`, `OaksLab`, `RedsHouse2F` and `ViridianPokecenter` map
  JSON, and their `static/` mirrors. 175 JSON files, as before.
- **Tests:** new `rom/__tests__/hidden_event_programs.test.ts` (2, no ROM; the ASM part returns early
  without `refs/`):
  - it derives each current map's hidden-event predef from `data/events/hidden_events.asm`, the routine
    bodies and `bench_guys.asm`, and compares it with the committed `program`. Exactly 8 are checked; the
    right poster is pinned as a branch for CP2;
  - every committed hidden-event program, and every `BookshelfTileIDs` predef or its `text_asm`
    PrintText targets, is extracted.

  The existing ROM program test checks the 28 new labels op for op against pret's macros. Mutation: giving
  Blue's bookcase `PokemonBooksText` (same words, wrong label) fails the new test.
- **Gates:** typecheck/build clean. ROM **1577/1577** (two runs, 88 files), no-ROM **1447 pass / 130 skip**,
  `git diff --check` clean. Not run in the browser; nothing visible changed.

## 13. A5b7g2 CP2 result — 2026-10-15, Grok

**Checkpoint 2 is implemented. Stop for Claude's review.**

Commits, in order: data `8fd0111`, builder `13fd2f6`, bookshelves `269d8c2`, then the tests commit.

- **Data.** Oaks Lab (5,0) is `scriptId` `OAKS_LAB_RIGHT_POSTER`. The extractor still stores `textOffset`;
  a script id does not decode text, so the committed JSON drops the flattened SAVE string. Setup twice was
  byte-identical. The diff is `OaksLab.json` and its static mirror.
- **Builder.** `interactionDisplay` is the one display for a hidden-event `program` or `scriptId`, used by
  the overworld and by Lab free movement. Plain predefs keep the box (first glyph +20). The right poster
  prints `SaveOptionText` when the owned count is under 2, otherwise `StrengthsAndWeaknessesText`. TV,
  notebook, blackboard, PCs, and the Town Map keep their handlers. Free movement no longer ignores script
  ids or falls through to `textBox.show`. N-1 restores Pikachu's facing only when the text box is active
  and in a display session.
- **Bookshelves.** Facing up only, the one tile directly above the player's step, including the Town Map.
  `getBookshelfText`, the hand-written elevator line, and the three `getText('BOOKSHELF_*')` calls are gone.
  `overworld/map.ts` is off the census list. Books and statues are `text_asm` (new box, first glyph +23).
  `PokemonStuffText` and `ElevatorText` are plain programs.
- **Tests.** 25 in `bookshelf_display.test.ts`, plus N-2 and N-3 in `oaks_lab.test.ts`. Oak's Lab's header
  tileset is DOJO, so the real shelf is tile `$1D` on `blockset_gym`. Five mutations failed a test and were
  restored: the facing gate, the second tile, a book at +20, an owned threshold of 1, and free-move script
  ids ignored again.
- **Gates.** Typecheck and build clean. ROM **1604/1604** (89 files). No-ROM **1474 pass / 130 skip**.
  Not run in the browser. Nothing pushed. No later checkpoint was started.

**Next: CP2** (§5.3), plus the right poster's `scriptId` (above) and note 55's N-2/N-3 assertions.
