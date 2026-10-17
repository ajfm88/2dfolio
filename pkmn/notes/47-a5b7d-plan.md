# A5b7d plan: Red's item PC and the Pokécenter PC, as `players_pc.asm` and `pc.asm` run them

**2026-10-15 · Claude · Approved: the user answered "yes to all" to §8 (O-26 → DECISIONS #57).**
Implementer: **Sol** (the user's pick). Claude reviews; the user play-tests (§7).

Parent: `notes/39-a5b7-plan.md` §1 (A5b7d row) and §5 (direct player PC, Pokécenter PC),
DECISIONS #52. Builds on A5b7b's `ScreenTiles` / `ListMenu` / `QuantityMenu` / `MenuInput` and
the Mart's display-session pattern (notes 41/42), and on A5b7c's shared list state and toss
flow (notes 43–46). Baseline: **1393/1393** with the ROM, 1263/130 without.

## 1. What this slice delivers

- **Red's PC** (RedsHouse2F, `OpenRedsPC`): the direct item PC on one DisplayTextID session,
  with the cartridge's sounds, texts, menus, silent buttons, no-delay text and exit.
- **The Pokécenter PC** (`OpenPokemonCenterPC`, `ActivatePC`): the main menu
  (SOMEONE's/BILL's PC, <PLAYER>'s PC, PROF.OAK's PC once you have the Pokédex, LOG OFF), the
  nested item PC, and the exits.
- **Retired:** `PcMenu`, `PokecenterPcMenu`, the `openPc` / `openPokecenterPc` actions, and
  the `pc` / `pokecenter_pc` states.
- **Bill's PC itself is A5b7e.** Here the main menu runs its real preamble (`enter_pc`, then
  "Accessed someone's PC…") and hands off to today's `BillsPcMenu` as a bridge.

No new extractor work except Oak's PC's three texts (if §8 Q1 is yes). Every item-PC text is
already extracted (checked against `data/text_programs.json`).

## 2. Sources

`engine/menus/players_pc.asm` (PlayerPC, PlayerPCMenu, Exit/Deposit/Withdraw/Toss) ·
`engine/menus/pc.asm` (ActivatePC, PCMainMenu, the child branches, ReloadMainMenu, LogOff) ·
`engine/pokemon/bills_pc.asm` (DisplayPCMainMenu and its strings, BillsPC_'s entry) ·
`engine/menus/oaks_pc.asm` (OpenOaksPC) · `engine/events/pokedex_rating.asm` ·
`engine/events/hidden_events/{reds_room,pokecenter_pc}.asm` · `data/events/hidden_events.asm` ·
`home/map_objects.asm` (TextScript_ItemStoragePC / TextScript_PokemonCenterPC →
`HoldTextDisplayOpen`) · `home/window.asm` (HandleMenuInput's `BIT_NO_MENU_BUTTON_SOUND`) ·
`home/yes_no.asm` · `engine/items/item_effects.asm` (TossItem_) · `data/text/text_3.asm`.
Code: `menus/{pc_menu,pokecenter_pc_menu,bills_pc_menu}.ts`, `overworld_controller.ts` (the
`RED_PC` / `POKECENTER_PC` hidden events), `main.ts` (`openPc`, `openPokecenterPc`, both states),
`story/hidden_events.ts`, `script/script_controller.ts` (the Mart's session slot).

## 3. What is wrong today

| # | Today | Cartridge |
|---|---|---|
| P1 | Legacy `text` "X turned on the PC.", then a separate main state | One DisplayTextID session. Red's PC: auto box **on**, `TextScript_ItemStoragePC` saves Buffer2 with the empty box. Pokécenter: auto box **off**, `ActivatePC` saves a box-less Buffer2. Both end in `HoldTextDisplayOpen`: **no outer button wait** |
| P2 | No PC sounds | `turn_on_pc` starts **before** TurnedOnPC1/2Text (PlaySound). The Pokécenter waits for it **after** the prompt. `enter_pc` + wait before each child. `withdraw_deposit` after a transfer. `turn_off_pc` + wait on exit (direct PC or LOG OFF) |
| P3 | Menus beep on A/B | `BIT_NO_MENU_BUTTON_SOUND` makes every HandleMenuInput **silent** in both PCs: the main menu, PlayerPCMenu, the lists, and even the toss YES/NO and Oak's YES/NO. Only text prompts beep (ManualTextScroll) |
| P4 | PC messages drawn instantly as overlays | Real PrintText programs. **No-delay** inside PlayerPCMenu (`BIT_NO_TEXT_DELAY`, cleared on exit). TurnedOnPC, Accessed…PC and Oak's texts are typed |
| P5 | Own lists and quantity box | `DisplayListMenuID` (ITEMLISTMENU over bag or box, SELECT swap works), the **plain** quantity box at (15,9), "How many?" printed first. A key item skips the quantity (1) |
| P6 | PC menu cursor resets | PlayerPCMenu reopens on the last chosen entry (`wParentMenuItem`). The main menu resets to the top on every redisplay |
| P7 | Main menu has 3 entries | With the Pokédex (you have it by now): **SOMEONE's PC / <PLAYER>'s PC / PROF.OAK's PC / LOG OFF**, a box with an 8-row interior, max item 3 (§8 Q1) |
| P8 | Invented texts / order | Deposit: add to box → remove from bag → `withdraw_deposit` → "<item> was stored via PC.". Withdraw: add to bag → remove from box → sound → "Withdrew <item>.". Failures: "No room left to store items." / "You can't carry any more items.". Empties: "You have nothing to deposit." / "There is nothing stored." |
| P9 | PC toss | `TossItem` on the box: TooImportant for key items/HMs; else "How many?", quantity, IsItOK (prompt) → YES/NO (silent) → ThrewAway, all no-delay |

## 4. Flow (label by label)

### 4.1 Red's PC (direct)

| Step | Behavior |
|---|---|
| `OpenRedsPC` | Hidden event, facing up (already in `maps.ts`). `EnableAutoTextBoxDrawing` → DisplayTextIDInit with the box |
| `TextScript_ItemStoragePC` | SaveScreenTilesToBuffer2 (map + the empty box) |
| `PlayerPC` | `wBagSavedMenuItem` = 0, `wParentMenuItem` = 0. Direct: PlaySound `turn_on_pc` (no wait), PrintText `TurnedOnPC2Text` (typed, prompt) |
| `PlayerPCMenu` | Set no-delay; cursor = `wParentMenuItem`; silent buttons; **LoadScreenTilesFromBuffer2** (the text is gone, the empty box stays); TextBoxBorder (0,0) inner 8×14; entries at (2,2): WITHDRAW ITEM / DEPOSIT ITEM / TOSS ITEM / LOG OFF (2 rows apart); top (1,2), max 3, A/B; `wListScrollOffset` = 0; PrintText `WhatDoYouWantText`; HandleMenuInput. **B is tested first** → Exit. Else ▷, save `wParentMenuItem`, branch |
| Withdraw / Deposit / Toss | cursor 0, offset 0. Source empty → NothingStored / NothingToDeposit (prompt) → PlayerPCMenu. `.loop`: PrintText WhatToWithdraw/Deposit/Toss → list (ITEMLISTMENU over box/bag/box; cancel → PlayerPCMenu) → key item (or HM for toss): quantity 1, no box; else PrintText "How many?" → plain quantity (max = stack; B → `.loop`) |
| Withdraw/Deposit | `AddItemToInventory(destination)`; fail → CantCarryMore / NoRoomToStore (prompt) → `.loop`. Else `RemoveItemFromInventory(source, selected index)` (F-2 reset if it empties), WaitForSoundToFinish, PlaySound `withdraw_deposit`, WaitForSoundToFinish, PrintText WithdrewItem / ItemWasStored (`nameBuffer` = item name, prompt) → `.loop` |
| Toss | `TossItem` on the box (A5b7c1's toss flow with the box as source, silent YES/NO) → `.loop` |
| `ExitPlayerPC` | Direct: PlaySound `turn_off_pc` + WaitForSoundToFinish (no reads). Clear the silent flag; **LoadScreenTilesFromBuffer2** (menus gone, empty box stays); `wListScrollOffset` = 0, `wBagSavedMenuItem` = 0; clear no-delay; return → `HoldTextDisplayOpen` (hold A) → CloseTextDisplay |

### 4.2 The Pokécenter PC

| Step | Behavior |
|---|---|
| `OpenPokemonCenterPC` | Facing up only; auto box **off** (`BIT_NO_AUTO_TEXT_BOX`) |
| `ActivatePC` | SaveScreenTilesToBuffer2 (no box); PlaySound `turn_on_pc`; PrintText `TurnedOnPC1Text` (typed, prompt); **WaitForSoundToFinish** (no reads); set GENERIC; LoadScreenTilesFromBuffer2 (the box is gone); Delay3 |
| `DisplayPCMainMenu` | Transfer off; SaveScreenTilesToBuffer2; box (0,0) inner **8×14** with GOT_POKEDEX (6×14 before it); "SOMEONE's PC" (or "BILL's PC" after MET_BILL) at (2,2); the player name + "'s PC" at (2,4); "PROF.OAK's PC" at (2,6) with the Pokédex; LOG OFF at (2,8) (or (2,6) before it); max 3 (2 before); top (1,2); **cursor 0**; transfer on. Then the silent flag; HandleMenuInput; **B first** → LogOff |
| BILL's/SOMEONE's PC | PlaySound `enter_pc` + wait; PrintText AccessedBillsPC/AccessedSomeonesPC (typed, `\f`, prompt); **bridge** to today's `BillsPcMenu` until A5b7e (it keeps `currentPcBox`); then ReloadMainMenu |
| <PLAYER>'s PC | Clear the silent flag (the next menu sets it again); set GENERIC; `enter_pc` + wait; PrintText `AccessedMyPCText` (typed, `\f`, prompt); `PlayerPC` (4.1 without turn-on/off) → ReloadMainMenu |
| PROF.OAK's PC (§8 Q1) | `enter_pc` + wait; SaveScreenTilesToBuffer2; `AccessedOaksPCText` (typed), `GetDexRatedText` (done), **YesNoChoice** (silent, as the flag is still set). YES → `DisplayDexRating`: **the existing approved gap**, as for Oak in the Lab (`story/lab_text_handlers.ts`). Then `ClosedOaksPCText` (typed, waitbutton), LoadScreenTilesFromBuffer2 → ReloadMainMenu |
| `ReloadMainMenu` | ReloadMapData (LCD off: 0 frames, as recorded in note 45), UpdateSprites, back to DisplayPCMainMenu (cursor 0) |
| `LogOff` (B or LOG OFF) | PlaySound `turn_off_pc` + WaitForSoundToFinish; clear GENERIC and silent; return → `HoldTextDisplayOpen` → close |

### 4.3 Frame anchors (symbolic; T = the A press on the PC)

- **Red's PC:** box at T; `turn_on_pc` and the TurnedOnPC2 box at T+20, first glyph T+23.
  After the prompt (P1): text removed, menu box and entries, "What do you want to do?" box
  at P1, text complete at P1+3, first menu read P1+6.
- **Branch A at M (silent):** "What do you want to withdraw?" at M, complete M+3, list from
  M+3 (hidden 10 frames), first list read M+19.
- **Item A at Q (silent):** "How many?" at Q (complete Q+3), plain quantity box at Q+3,
  first read Q+4, silent.
- **Quantity A at P:** the transfer at P. Then any current sound finishes, `withdraw_deposit`
  plays and finishes (no reads), and the result box appears at the sound's end W, complete
  W+3, prompt.
- **Exit (B or LOG OFF at X):** `turn_off_pc`, no reads until it ends (O); then menus off, the
  empty box stays; Hold A; close.
- **Pokécenter:** no box at T; TurnedOnPC1 box at T+20, first glyph T+23; prompt; then
  `turn_on_pc`'s remaining time; the box removed; Delay3; main menu; first read +3.

Pin these and the sound order in tests. Measure the remaining ones in the trace.

## 5. Design (reuse first)

- **Generalize the Mart's session slot.** `script_controller.ts` has `scriptMart` /
  `martTiles` / `renderMart`. Turn them into one menu-session slot with a small interface
  (`advanceText`, `copyThird`, `frame`, `renderOverlay`, plus a full-screen hand-off for the
  bridge). `PokemartSession` implements it unchanged in behavior; `PcSession` is the second user.
- **`menus/pc.ts` (new) `PcSession`:**
  - Modes `direct` (Red's PC) and `generic` (the main menu with the nested item PC, Oak's PC
    and the Bill's bridge).
  - It owns `ScreenTiles` (Buffer2 = `save()` / `restore()`), `MenuInput` with a no-op press
    sound (the silent flag), `ListMenu`, `QuantityMenu` (plain), `YesNoMenu`, and the shared
    `textBox` (`print` with `noDelay` while in PlayerPCMenu).
  - Sounds use the Mart's PlaySound / WaitForSoundToFinish helpers.
  - It reuses A5b7c1's toss flow (factor `TossItem_` out of `bag.ts` into a shared helper that
    takes the source inventory and the silent flag).
- **`YesNoMenu`:** add a `silent` option (no press_ab on A/B), defaulting off, so the nurse and
  the Mart are unchanged.
- **Entry:** the `RED_PC` and `POKECENTER_PC` hidden events become hidden-event scripts
  (`story/hidden_events.ts`), on a display opening with auto box on (Red) or off (Pokécenter),
  then the PC command, then a close with **no outer wait**.
- **ScriptDeps:** `pcItems`, the boxes, `currentPcBox` get/set, `deserializeBoxed` (for the
  bridge), `hasFlag` (GOT_POKEDEX, MET_BILL; confirm the event name).
- **Shared list state:** `wBagSavedMenuItem` and `wListScrollOffset` are zeroed where 4.1 says
  so. F-2's emptied-slot reset already applies through `removeFromInventoryAt`.
- **Delete** `menus/pc_menu.ts`, `menus/pokecenter_pc_menu.ts`, the two actions, both states,
  their `ui_entry` entries and render cases.

## 6. Checkpoints (each: focused tests, typecheck, local commit)

1. **CP1 — plumbing and data.**
   - Generalize the session slot; the Mart's tests must stay green unchanged.
   - `YesNoMenu.silent`; the shared toss helper (bag behavior unchanged).
   - If Q1 = yes, add Oak's three texts to `rom/text_program_symbols.ts` (from pret's sym, read
     via `git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`):
     - roots `AccessedOaksPCText` $07:$62DF, `GetDexRatedText` $07:$62D4, `ClosedOaksPCText`
       $07:$62D9;
     - far targets `_AccessedOaksPCText` $28:$4741, `_GetDexRatedText` $28:$4704,
       `_ClosedOaksPCText` $28:$4722;
     - then `npm run setup` twice, byte-identical.
2. **CP2 — Red's PC.**
   - Entry, turn-on, PlayerPCMenu (no-delay, silent, saved parent cursor, B first), and the
     exit's sound wait, Buffer2 and Hold/close.
   - Withdraw, deposit and toss with all failures and empties; the selected-slot rules; F-2.
3. **CP3 — the Pokécenter PC.**
   - ActivatePC, DisplayPCMainMenu (both layouts by GOT_POKEDEX, SOMEONE's/BILL's by
     MET_BILL), the nested item PC without turn-on/off, ReloadMainMenu, LogOff.
   - Oak's PC (Q1) and the Bill's PC bridge (preamble, then `BillsPcMenu`, keeping
     `currentPcBox`, back to the main menu).
4. **CP4 — retirement and integration.**
   - Delete the legacy menus, actions and states.
   - Integration through main's dispatch: one transfer tick and ≤ 1 Joypad owner per frame,
     with a real-input test in the style of `field_medicine_input.test.ts` for the PC menus
     (note 46 F-1's lesson).
5. **CP5 — handoff.**
   - Full suites, build, a muted browser smoke on a spare port: Red's PC withdraw / deposit /
     toss / failures / exit; Pokécenter PC, the main menu, <PLAYER>'s PC, Oak's PC both answers,
     SOMEONE's PC bridge and back, LOG OFF.
   - Docs, the result section, STATUS.
   - Suggested self-mutations: a press sound in the PC; text typed inside PlayerPCMenu; remove
     before add; an outer wait at the close; the main-menu cursor kept; turn_on_pc waited
     before the text; the parent cursor not restored.
   - Stop for review.

## 7. User play-test (after review)

`http://127.0.0.1:5173/`, **Z = A, X = B**.

1. **Red's PC (your room, facing it):** the turn-on sound and "RED turned on the PC.". A:
   the menu, "What do you want to do?". Menu presses make **no beep**.
2. **WITHDRAW** the Potion (Oak gives you one at the start): "How many?", the quantity, the
   transfer sound, "Withdrew POTION.". B back to the menu, still on WITHDRAW.
3. **DEPOSIT** an item: "… was stored via PC.". **TOSS** from the PC: "Is it OK to toss …?",
   YES/NO (silent), "Threw away …".
4. **LOG OFF:** the turn-off sound, then one A closes the box.
5. **Viridian Pokécenter PC:** "RED turned on the PC.", then the menu with SOMEONE's PC /
   RED's PC / PROF.OAK's PC / LOG OFF. RED's PC: the enter sound, "Accessed my PC. ▼ Accessed
   Item Storage System.", then the same item PC. PROF.OAK's PC: "Want to get your POKéDEX
   rated?", NO → "Closed link to PROF.OAK's PC.". LOG OFF closes.

## 8. Decisions for the user (O-26)

**Answered 2026-10-15: yes to all (DECISIONS #57).** Sol implements.

1. **Oak's PC: show PROF.OAK's PC and run its YES/NO flow now, with the rating itself as the
   existing approved gap** (shared with Oak in the Lab; a later dex-rating slice fills both).
   *Recommended:* the main menu then has the cartridge's four entries and positions. The
   alternative keeps today's three entries (a visible layout difference) until that slice.
2. **Bill's PC stays a bridge** to today's `BillsPcMenu` until A5b7e, behind the cartridge's
   real preamble. *Recommended.*
3. **Generalize the Mart's session slot** for both sessions (§5). *Recommended:* one owner per
   frame stays in one place.
4. **One slice, five checkpoints.** Who implements: Grok or Sol (your pick). Claude reviews;
   you play-test.

## 9. Implementation result — Codex/Sol, 2026-10-15; awaiting user review

The user reassigned implementation to Codex/Sol. All five checkpoints are
implemented and locally committed; stop here for the user to check STATUS and
review. A5b7e, the healing machine, V2 and later work have not started.

| Checkpoint | Local commit | Verification |
|---|---|---|
| CP1: shared session/toss/silence, Oak text data | `ef19db9` | Menu/Mart 51/51, ROM text/export 14/14, typecheck; setup twice byte-identical |
| CP2: Red's PC | `044618c` | PC/bag/Mart 48/48; source P+6/M+19/Q+4 anchors, transfers/failures/toss/sounds; typecheck |
| CP3: Pokécenter and children | `b0dd53f` | PC/bag/Mart 57/57; layouts/flags, nested exit, Oak answers, Bill bridge/current box, sound waits; typecheck |
| CP4: retirement and actual dispatch | `85a461b` | PC 36/36 including real-input dispatch; no-ROM suite and typecheck; old caller coverage migrated |
| CP5: browser, rendering fix, final gates/docs | this handoff commit | ROM **1433/1433**, no-ROM **1303 pass / 130 skip**, 78 files; typecheck/build/diff check clean |

**Data:** all six Oak-PC symbols independently confirmed against pret's sym
branch, then source-matched by the existing ROM text-program fixture. Only
`data/text_programs.json` and `static/text_programs.json` changed; six records
added (three wrappers and three FAR children). Setup twice produced identical
paths/hashes for all **873** generated files: 175 JSON in each tree, 520 PNGs,
three tilemaps. No ROM/reference/curated-art changes.

**Runtime:** Red and Pokécenter PCs share the retained script-menu host with the
Mart. Hidden-event dispatch, menus, children and Hold/close stay on one display.
Typed power-on/preambles and no-delay item text use source programs, with native
prompts/waits. Choices are silent; text prompts retain their beep. Item lists,
SELECT swap, plain quantities, key/HM protection, remembered parent choice,
source empties/full-inventory failures and duplicate-slot removal use the shared
modules. No old PC menu classes, main states or actions remain. Bill's existing
screen is a bridge, with current-box persistence; source storage mechanics remain
outside this slice. Both Oak answers run the source closing text; rating itself
remains the existing approved gap, as with Oak in the Lab.

**Necessary rendering correction found in CP5:** the ScreenTiles painter used
transparent font glyphs for every cell; spaces did not erase the map and the six
box characters had no font mapping. The first browser image showed an invisible
top menu. Added `drawScreenTile`: paint the cell's light background, use the six
font_extra border tiles, otherwise draw its glyph. PC/Mart and bag tile maps use
this shared painter; static labels retain transparent drawText. This is a local
rendering fix, with no timing/model change. An actual-renderer regression checks
opaque blank/glyph cells and all six border tiles. The browser re-run visually
confirmed Red's menu and the four-entry Pokécenter menu.

**Muted browser smoke, isolated `http://127.0.0.1:5197/`:** actual main state
dispatch, real keyboard events, audio engines running with output muted. Eleven
checks passed: Red withdraw two; deposit; toss YES; exit; full-bag withdrawal
failure; full-PC deposit failure; nested player PC and return at cursor 0; Oak NO;
Oak YES; SOMEONE's PC bridge and return; Pokécenter logoff. Zero runtime errors
and no unexpected failed assets (indoor wild-data probes/favicon excluded).
Browser-only instrumentation and save staging lived in the intercepted response;
no hooks committed. Test origin storage cleared and browser/server closed;
the user's 5173 save origin was untouched.

Screenshots, browser result/printed-program trace, full-suite logs and mutation
logs are local scratch artifacts in `%TEMP%/pkmn-a5b7d/` (`result.json`,
`01-red-menu.png` … `06-bill-bridge.png`, `final-rom.log`, `final-norom.log`,
`mutations.json`). Unit/integration tests additionally cover protected sound
waits, key/HM refusals, toss NO/cancel, SELECT, Bill-name flag, Change Box,
single-frame taps on three consecutive idle frames, first glyph +23, one
transfer tick and no competing text/menu Joypad owners. Render does not tick.

**Eight deliberate production mutations caught and restored:** PC button beep;
typed PlayerPCMenu text; remove before destination add; outer close dismissal;
nonzero top-level cursor; waiting turn-on before its text; lost parent cursor;
transparent tile cells. Final suites ran after restoring all mutations.

**Carry-over N-4 inspected:** PartyMenuInit reads the saved party cursor without
clamping; BillsPCMenu resets that shared byte. Today's bridge still uses its own
cursor model, which belongs to A5b7e. Port those resets with Bill's menu and audit
the PartyMenu clamp there; no storage/party mechanism was changed here.

**Next: user checks STATUS and reviews A5b7d.** After review, §7 is the user
play-test. Nothing pushed; no next slice started.
