# A5b7e plan: Bill's PC, as `bills_pc.asm` runs it

**2026-10-15 · Claude · Approved: the user answered yes to all five §9 decisions (O-27 → DECISIONS #58).**
Implementer: **Sol** (the user's pick). Claude reviews; the user play-tests (§8). The StatusScreen port is
its own slice right after A5b7g.

Parent: `notes/39-a5b7-plan.md` §1 (A5b7e row), §5 (Bill's PC) and §6 (the Bill's PC and Change Box
boundaries), DECISIONS #52. A5b7d (`notes/47-a5b7d-plan.md`, #57) built the PC session this slice plugs
into: `menus/pc.ts` `PcSession`, the retained display, `ScreenTiles`, `ListMenu`, `MenuInput`, silent
`YesNoMenu`, the sound helpers and the main-menu bridge this slice replaces.
Baseline: **1436/1436** with the ROM, 1306/130 without.

## 1. What this slice delivers

- **Bill's PC** (`BillsPC_` and everything under it), reached from the Pokécenter PC's SOMEONE's/BILL's
  PC entry, on A5b7d's retained display. It covers:
  - the main menu with its six entries and the BOX No. box;
  - WITHDRAW, DEPOSIT and RELEASE through the cartridge's Pokémon list and its DEPOSIT/WITHDRAW–STATS–CANCEL
    menu;
  - the starter-Pikachu rules;
  - CHANGE BOX with its warning, box chooser and save;
  - PRINT BOX's empty-box branch;
  - the exit back to the PC main menu.
- **Retired:** `menus/bills_pc_menu.ts` (`BillsPcMenu`) and `PcSession`'s bridge. `BoxedPokemon`,
  `NUM_BOXES`, `MONS_PER_BOX` and `pokemonToBoxed` move to a small storage module.
- **Carried in:** note 46 N-4 / note 48 N-3 (the party cursor clamp, §5.6), and two fixes found while planning:
  - **F-1:** A5b7d's item PC types nothing after a list, but it should (§2.1).
  - **F-2:** field medicine prints mixed-case Pokémon names (§2.2).
- **Data:** one program pair, `NoPokemonText` → `_NoPokemonText` (PRINT BOX's empty box). Every other Bill's PC
  text is already extracted (checked against `data/text_programs.json`, including `ChooseABoxText`'s <PKMN>
  glyphs).

Decision §9 Q1 sets the scope. This plan is written for the recommended answer: the cartridge's Bill's PC
now, with three named gaps (§7). That amends #52's "messages only" boundary.

## 2. Two fixes found while planning

### 2.1 F-1: the text-delay flag is cleared by every list and YES/NO (A5b7d)

`BIT_NO_TEXT_DELAY` (wStatusFlags5) is one shared flag. It is not a per-call property:

| Who | What it does to the flag | Source |
|---|---|---|
| PlayerPCMenu | **sets** it on every pass | `players_pc.asm:19` |
| `BillsPC_` | **sets** it once, on entry | `bills_pc.asm:94` |
| `DisplayListMenuID` | sets it on entry; **clears** it on a choice (`.storeChosenEntry`) and on cancel (`ExitListMenu`) | `home/list_menu.asm:19,170,329` |
| `DisplayTwoOptionMenu` (YES/NO) | sets it to draw; **clears** it before HandleMenuInput | `engine/menus/text_box.asm:208,282` |
| ExitPlayerPC / ExitBillsPC | **clear** it | `players_pc.asm:80`, `bills_pc.asm:203` |

`PrintLetterDelay` returns at once while the flag is set; otherwise letters type.

- **In Red's PC and the nested item PC, only these are instant:** WhatDoYouWantText, Nothing… and a branch's
  **first** WhatToWithdraw/Deposit/Toss.
- **Everything after a list returns types** until the next PlayerPCMenu pass: "How many?", the results, the
  failures, the toss texts, and the loop's WhatTo… again.

Today `PcSession.print` defaults to `noDelay = true` for all of them. This is a plan error: note 47 P4 said
"no-delay inside PlayerPCMenu" and missed the list and YES/NO clears. The review missed it too.

**Fix:** model the flag as shared state, like `list_state.ts`.
- `ListMenu` clears it on choice and cancel; `YesNoMenu` clears it as its input starts.
- PlayerPCMenu and `BillsPC_` set it; the exits clear it.
- `PcSession.print` reads the flag instead of taking a per-call default.

Bill's PC needs the same model (§4.8), so it is built once here.

### 2.2 F-2: Pokémon names in bound texts (A5b7c2)

`createPokemon` defaults a nickname to the species name, which is title case ("Pikachu"). The party menu
draws `nickname.toUpperCase()`. `field_medicine.ts:291` binds the raw nickname into `nameBuffer`, so the
medicine result very likely reads "Pikachu recovered by 20!" where the cartridge reads "PIKACHU". Bill's PC
binds names into five texts.

**Fix:** add one helper, `monDisplayName(mon)`, that does what the party menu draws (uppercase today; V5's
MonsterNames work replaces it, DECISIONS #44). Use it in Bill's PC bindings and lists, in the party menu, and
in field medicine. Confirm the medicine text in the browser in CP2.

## 3. What is wrong today (`BillsPcMenu`, the bridge)

| # | Today | Cartridge |
|---|---|---|
| B1 | Full-screen legacy overlay, per-tick `isPressed`, wrapping cursors | Drawn into wTileMap on the retained display. HandleMenuInput: no wrap, Delay3, **silent** (`BIT_NO_MENU_BUTTON_SOUND` stays set from PCMainMenu: Bill's branch never clears it). Text prompts still beep |
| B2 | 5 entries; "What do you want to do?" box | **6 entries:** WITHDRAW <PKMN> / DEPOSIT <PKMN> / RELEASE <PKMN> / CHANGE BOX / PRINT BOX / SEE YA!, in box (0,0) inner 12×12. An **empty** text box at (0,12) inner 4×18, then the BOX No. box at (9,14) inner 2×9. No question text (WhatText, DepositWhichMonText and ReleaseWhichMonText are unreferenced in Yellow) |
| B3 | Cursor resets to the top every time | `wParentMenuItem`: zero on entry to Bill's PC, then each choice is remembered while inside. ▷ after a choice (not after B) |
| B4 | Own list, `:L` drawn as text, invented "Which POKéMON…" prompts | `DisplayListMenuID`, PCPOKEMONLISTMENU: nicknames at (6,y) and PrintLevel at (14,y+1). Starts at `wPartyAndBillsPCSavedMenuItem` with the current `wListScrollOffset`. SELECT only redraws. No prompt text |
| B5 | Invented YES/NO confirmations for withdraw/deposit | `DisplayDepositWithdrawMenu`: box (9,10) inner 6×9 with DEPOSIT or WITHDRAW, STATS, CANCEL; HandleMenuInput (silent), cursor 0. B/CANCEL → BillsPCMenu; STATS → the status screen and back to this menu |
| B6 | Invented texts: "Withdrew X." / "X was stored in Box N." with mixed case | `MonIsTakenOutText`, `MonWasStoredText` (`wBoxNumString`), `MonWasReleasedText`, the checks' texts, `OnceReleasedText` (done) + silent YES/NO. NO → **back to the list on the same row** |
| B7 | No starter rules: Pikachu can be released | Release of the starter → cry clip + "<name> looks unhappy about it!", no release. Deposit with Pikachu's following disabled → "There isn't any response...". Depositing the starter → `PIKAHAPPY_DEPOSITED` |
| B8 | No cries | `PlayCry` of the species (or a Pikachu PCM clip) before the move; `WaitForSoundToFinish` before the result. **Cries stay J2 (§7)** |
| B9 | CHANGE BOX = a free picker, no save | `ChangeBox` (`engine/menus/save.asm`): WhenYouChangeBoxText + silent YES/NO → chooser (BOX 1…BOX12, single-spaced, ● on non-empty boxes, BOX No. box, "Choose a <PKMN> BOX." typed **while BG transfer is off**) → A: `save` (wait current, play, wait) → switch → **SaveGameData**. B: no save. A on the current box still saves |
| B10 | No PRINT BOX | `PrintPCBox`: empty box → NoPokemonText. Otherwise the Game Boy Printer screen (gap, §7) |
| B11 | Box list wraps; list cursor/offset own state | Shared `wListScrollOffset` is pushed on entry and popped on exit. BillsPCMenu zeroes it and `wPartyAndBillsPCSavedMenuItem` on every pass |
| B12 | Text instant everywhere | Instant until the first list or YES/NO in this visit, **typed after** (§4.8) |

## 4. Flow (label by label)

Sources: `engine/pokemon/bills_pc.asm` (all of it), `engine/menus/pc.asm` (BillsPC, ReloadMainMenu),
`engine/menus/save.asm` (ChangeBox, DisplayChangeBoxMenu), `home/list_menu.asm`,
`engine/menus/swap_items.asm` (SELECT guard), `home/pokemon.asm` (PrintLevel, PartyMenuInit),
`engine/pikachu/pikachu_status.asm` (IsThis…StarterPikachu), `home/pikachu.asm`
(CheckPikachuFollowingPlayer), `engine/events/pikachu_happiness.asm`, `engine/printer/printer.asm`
(PrintPCBox), `engine/pokemon/add_mon.asm` (`_MoveMon`: appends at the end), `data/text/text_3.asm`,
`text_4.asm`.

### 4.1 Entry, main menu, exit

| Step | Behavior |
|---|---|
| (A5b7d) | PCMainMenu set the silent flag; BillsPC: `enter_pc` + wait; AccessedSomeones/BillsPCText (typed, prompt). Keep as is |
| `BillsPC_` | **Set** the no-delay flag; `wParentMenuItem` = 0; LoadHpBarAndStatusTilePatterns (CopyVideoData, 30 tiles, transfer off while copying: **trace the frames**); push `wListScrollOffset`. Generic → no "Switch on!" |
| `BillsPCMenu` | Cursor = `wParentMenuItem`. Copy the Poké Ball tile to $78 (CopyVideoData, 1 tile: **trace**). LoadScreenTilesFromBuffer2 with transfer **off** (Buffer2 = the plain map, from DisplayPCMainMenu). Box (0,12) 4×18, box (0,0) 12×12, UpdateSprites, the entries at (2,2) two rows apart. Menu: top (1,2), max 5, A/B, `wLastMenuItem` 0. Zero `wPartyAndBillsPCSavedMenuItem`, `wListScrollOffset`, out-of-bounds and `wPlayerMonNumber`. Box (9,14) 2×9; "BOX No." at (10,16); the number at (18,16), with '1' at (17,16) for boxes 10–12. Transfer on; **Delay3**; HandleMenuInput (silent). **B first** → exit. Else ▷, `wParentMenuItem` = item, branch |
| `ExitBillsPC` (B or SEE YA!) | Generic: no turn-off sound. Clear the silent flag; LoadScreenTilesFromBuffer2 (the plain map); **pop** `wListScrollOffset`; clear the no-delay flag; return → A5b7d's `ReloadMainMenu` (cursor 0, silent again) |

### 4.2 The shared pieces

| Piece | Behavior |
|---|---|
| `DisplayMonListMenu(list)` | `wCurrentMenuItem` = `wPartyAndBillsPCSavedMenuItem`; DisplayListMenuID (PCPOKEMONLISTMENU). After it: `wPartyAndBillsPCSavedMenuItem` = the list's row (0–3) |
| The list (PCPOKEMONLISTMENU) | As `ListMenu` does for items: box (4,2) 9×14, 10 frames, the CANCEL entry, ▼, scrolling, out-of-bounds, repeat, ▷ on A. Entries: `monDisplayName` at (6,y) and **PrintLevel** at (14,y+1): `<LV>` then the left-aligned level, 2 digits. At level 100, the 3 digits write over `<LV>`. SELECT: `HandleItemListSwapping` returns to the loop (a redraw only). **Clears the no-delay flag** on A and on cancel |
| `DisplayDepositWithdrawMenu` | Box (9,10) 6×9, drawn over the list. "WITHDRAW" (parent 0) or "DEPOSIT" at (11,12); "STATS"/"CANCEL" at (11,14)/(11,16). Top (10,12), max 2, A/B, cursor 0, `wLastMenuItem` 0, offset 0, out-of-bounds 0, `wPartyAndBillsPCSavedMenuItem` 0. Loop: HandleMenuInput (silent). B or CANCEL → not chosen. Item 0 → chosen. STATS → SaveScreenTilesToBuffer1, the status screen (party data for deposit, box data for withdraw), LoadScreenTilesFromBuffer1, tiles/palette reload (**trace frames**), back to the loop with the cursor on STATS |
| Name binding | `wStringBuffer` = the selected mon's nickname (`GetPartyMonName` → `CopyToStringBuffer`), through `monDisplayName` |
| Starter test | `IsThisPartyMonStarterPikachu` / `IsThisBoxMonStarterPikachu`: STARTER_PIKACHU species, OT ID equal, and the first **5** bytes of the OT name equal (a Gen 1 quirk; matters from A4). Today's stand-in is `isStarterPikachu` (species 25); add a box-mon form |

### 4.3 WITHDRAW

Box empty → NoMonText (prompt) → BillsPCMenu. Party full → CantTakeMonText (prompt) → BillsPCMenu.
List over the box (cancel → BillsPCMenu) → DisplayDepositWithdrawMenu (not chosen → BillsPCMenu). Then:
cry (starter: PCM clip 35; else PlayCry; **both J2**). MoveMon BOX_TO_PARTY (append; stats from level and DVs,
current HP and status kept: today's `deserialize`). RemovePokemon from the box. WaitForSoundToFinish.
MonIsTakenOutText (prompt) → BillsPCMenu.

### 4.4 DEPOSIT

Party count 1 → CantDepositLastMonText. Box full (20) → BoxFullText. Both are prompts, then BillsPCMenu, and
**that order** applies. A fainted last-but-one mon is allowed (Gen 1 has no healthy check; keep it).
- List over the party (cancel → BillsPCMenu).
- If the selected mon is the starter **and** `CheckPikachuFollowingPlayer` is nz (bit 1 of
  wPikachuOverworldStateFlags, set only by DisablePikachuFollowingPlayer in three map scripts):
  SleepingPikachuText2 → BillsPCMenu.
- DisplayDepositWithdrawMenu (not chosen → BillsPCMenu).
- Cry (starter: clip 28; else PlayCry; J2).
- `ModifyPikachuHappiness(DEPOSITED)`: it fires only if the selected party mon is the starter;
  tiers −3/−3/−5, mood from PikachuMoods.
- MoveMon PARTY_TO_BOX (append), then RemovePokemon from the party.
- WaitForSoundToFinish; `wBoxNumString` = "1"…"12"; MonWasStoredText (prompt) → BillsPCMenu.

### 4.5 RELEASE

Box empty → NoMonText → BillsPCMenu. `.loop`: the list over the box (cancel → BillsPCMenu).
- **Starter:** name → `wNameBuffer`; clip 40 (J2); PikachuUnhappyText (prompt) → BillsPCMenu.
- **Otherwise:** OnceReleasedText (**done**), then YesNoChoice (silent).
  - **NO/B → `.loop`:** the list reopens on the same row and offset, and the old question stays visible below it.
  - **YES:** RemovePokemon from the box; WaitForSoundToFinish; PlayCry (J2; PlayCry waits for itself);
    MonWasReleasedText (prompt) → BillsPCMenu.

### 4.6 CHANGE BOX (§9 Q2)

| Step | Behavior |
|---|---|
| Question | PrintText WhenYouChangeBoxText (`\f`, done), then YesNoChoice (silent). NO/B → BillsPCMenu (nothing saved) |
| `DisplayChangeBoxMenu` | Transfer **off**. Menu: A/B, max 11, top (12,1), cursor = the current box, `wLastMenuItem` = the same, out-of-bounds 0. Box (0,0) 2×9. **PrintText ChooseABoxText**: no-delay is clear after the YES/NO, so it types, but transfer is off, so nothing shows until the end (pin it). Box (11,0) 12×7; BOX 1…BOX12 **single-spaced** at (13,1). "BOX No." at (1,2), the number at (9,2) ('1' at (8,2) for 10–12). The Poké Ball tile at (18,1+i) for every non-empty box. Transfer on |
| Input | UpdateSprites; the single-spaced cursor (`BIT_DOUBLE_SPACED_MENU`, which is misnamed); HandleMenuInput (silent); B → BillsPCMenu, no save |
| A | `save`: PlaySoundWaitForCurrent, then WaitForSoundToFinish. Switch the current box (even to the same box). **SaveGameData**: our save write, the same one START → SAVE does. No text. → BillsPCMenu |

`EmptyAllSRAMBoxes` and `BIT_HAS_CHANGED_BOXES` have no observable effect in our all-boxes-in-memory model.
`ChangeBox` never calls `CheckPreviousSaveFile`, which matches our no-identity-check save (#52).

### 4.7 PRINT BOX

Box empty → NoPokemonText ("There are no #MON here!", prompt; programs to extract) → BillsPCMenu.
Otherwise the printer screen runs: printer music, the page drawings, "Press B to Cancel" and the status
messages. That is the gap in §7. Until then it returns straight to BillsPCMenu.

### 4.8 Which texts type (the flag, §2.1)

Set on entry to `BillsPC_`; BillsPCMenu does **not** set it again; lists and YES/NO clear it.
- **Instant:** NoMonText, CantTakeMonText, CantDepositLastMonText, BoxFullText, WhenYouChangeBoxText and
  PRINT BOX's NoPokemonText, **while no list or YES/NO has run in this visit**.
- **Typed:** after any list or YES/NO, those same texts, and always everything printed after a list:
  SleepingPikachuText2, MonWasStored, MonIsTakenOut, PikachuUnhappy, OnceReleased, MonWasReleased,
  ChooseABox.
- Leaving through the main menu and coming back sets it again.

Pin both cases for NoMonText (first action versus after a cancelled list).

### 4.9 Frame anchors (CP1 source trace, Codex/Sol, 2026-10-15)

These are **source-traced frame waits**, not hardware measurements or a CPU-cycle
emulation. An event at F executes CPU work at F; a Delay3 resumes at F+3, with
no invented dispatch/return tick. CopyData, text-box drawing, bank switches,
LCD-off copying and save serialization add no explicit DelayFrame in this
engine's existing model. DisableLCD does synchronize to LY 145 on hardware;
that subframe/CPU cost is not presented here as an exact wall-clock zero.

The palette restoration below is the **CGB path**: LoadSGB sets wOnSGB on CGB,
and `SendSGBPackets` takes Delay3 with the LCD on. DMG skips the palette command;
SGB uses packet transmission and Wait7000 rather than this CGB frame count.

Sources: `engine/pokemon/bills_pc.asm`, `engine/menus/{pc,save,text_box}.asm`,
`home/{copy2,load_font,tilemap,window,list_menu,delay,print_text,text,joypad2,
reload_tiles,palettes,fade,lcd}.asm`, `engine/gfx/palettes.asm` and
`engine/pokemon/status_screen.asm`.

| Anchor | CPU writes, return and first read |
|---|---|
| Entry, T = Accessed… prompt returns into BillsPC_ | HP/status graphics are `$04:4a20..4c00`: 480 bytes = 30 tiles. CopyVideoData waits **4** frames (8+8+8+6). The ball tile waits **1** more. Bill's menu is written at **T+5**; its explicit Delay3 ends at **T+8**, when HandleMenuInput places the cursor; the first read is **T+11**. Each later BillsPCMenu redraw, measured from return R into that label, writes at **R+1** and first reads at **R+7**. No cry or power-on wait is added. |
| Branch A at M, nonempty mon list | At **M**, transfer off, list border, UpdateSprites **twice** (PCPOKEMONLISTMENU). The 10-frame opening ends with entries at **M+10**, transfer on; explicit Delay3 ends at **M+13**, cursor placement then HandleMenuInput Delay3 gives first read **M+16**. SELECT and scroll return to DisplayListMenuIDLoop: entries rewritten immediately, first read **+6**, with no new 10-frame opening. |
| Branch A at M, empty/full rejection | PrintText's box and UpdateSprites at **M**, first glyph at **M+3**. With no-delay set the entire text body writes at M+3; otherwise letters retain their 1/3/5-frame or held-button delays. A prompt still protects **3** frames and owns its button/sound wait. Returning to BillsPCMenu adds the normal **1+3+3** above. |
| Mon A at L, deposit/withdraw submenu | List clears no-delay and returns at **L**. The submenu box/labels/cursor are written at L; first read **L+3**. Deposit's following-disabled rejection instead starts its PrintText at L, first glyph **L+3**. B/CANCEL return to BillsPCMenu in the accepted-read frame. |
| DEPOSIT/WITHDRAW at D | With cry playback stubbed, destination append and selected-source removal occur at **D** (deposit happiness precedes the move). Let **W** be the frame the following real WaitForSoundToFinish returns. Result PrintText's box **and UpdateSprites** run at W; first glyph **W+3**, typed. W=D only when channels 5/6/8, music drums and pending loads are already idle. There is no withdraw_deposit SFX for Pokémon transfers. |
| RELEASE YES/NO | OnceReleasedText is typed after the list and ends with done. If it returns at Q, YES/NO draws and clears no-delay at Q, first reads **Q+3**. YES read at **Y** removes the mon at **Y+15**, after the answer tail. At the following sound-wait return W, the cry stub adds zero and result PrintText starts; first glyph **W+3**. NO/B at N reopens the list at **N+15**, same row/offset, first read **N+31**; the old question is not cleared. Starter refusal skips YES/NO and starts its typed result directly on list return, plus the declared zero-duration cry gap. |
| CHANGE BOX warning and chooser | Warning PrintText starts at branch M, first glyph **M+3**; its cont/para and user waits prevent a single fixed total. Warning return Q draws YES/NO, first read **Q+3**. YES at Y reaches DisplayChangeBoxMenu at **C=Y+15**. Transfer stays off throughout ChooseABoxText's Delay3 and all letters. It has **15 glyph tiles**, including two PK/MN tiles. With fixed letter delay d, chooser layout/transfer-on is **C+3+15d** and first input read **C+6+15d**: medium **C+48 / C+51**, fast or continuously held A/B **C+18 / C+21**, slow **C+78 / C+81**. Varying input uses the actual sum of letter delays. |
| CHANGE BOX A/B after chooser | A at A0 waits for current sound, starts save, waits for its actual completion; at that completion S, switch current box and SaveGameData occur in source order, even for the same box. First Bill's-menu read **S+7**. No save text or fixed invented sound delay. B returns straight to BillsPCMenu: first read **B+7**, no save. NO at warning returns after its 15-frame tail: first read **N+22**. |
| STATS | Selection S enters the approved existing-page handoff in that tick; source StatusScreen's own fades, graphics/cry waits and both user waits remain the explicitly deferred StatusScreen port, not invented waits around the existing pages. From E = return of both pages: Buffer1 restore and LCD-off tileset reload have no explicit DelayFrame; CGB RunDefaultPaletteCommand waits **3**, LoadGBPal adds none, then HandleMenuInput's Delay3 gives first submenu read **E+6** on STATS (DMG **E+3**). No HP/status or ball-tile copy is called on this return path; BillsPCMenu restores the ball on its next pass. |
| Generic exit, B/SEE YA! at X | At **X**, restore Buffer2, pop saved list offset, clear no-delay/silent flags; no turn-off sound. ReloadMapData then UpdateSprites and DisplayPCMainMenu run without an explicit frame wait, reset top-level cursor to 0 and re-enable silence. First top-level read **X+3**. Later LOG OFF retains A5b7d's actual turn-off wait and Hold/close. |

**Transfer/input contract:** both entry copies disable BG transfer and restore
its prior setting; BillsPCMenu then keeps it off while restoring/drawing.
Once enabled, newly written rows arrive over the next **1–3 VBlanks**, according
to the retained third phase; a whole layout is present after three enabled
transfers. In Change Box, all chooser writes finish before enabling transfer,
but it is **not an atomic whole-screen scanout**: the next three VBlanks reveal
its thirds. This clarifies §3 B9/§4.6's "appears at once" wording.
Only the printer/menu/button routines read Joypad; copy waits, DelayFrames,
answer tails and sound waits do not. Prompt's A acceptance starts press_ab;
routine return does not wait for that newly started beep to finish, so later
WaitForSoundToFinish must remain a real condition, not an assumed zero.

### 4.10 The Pikachu follower (CP1 trace)

**CP1 finding, 2026-10-15:** the first post-transfer UpdateSprites is actually
inside **the result PrintText**, before its Delay3 and first glyph. The main
menu's update is later, after the result prompt returns and its one-tile copy.
This corrects the original description above; do not delay reconciliation until
Bill's menu return, or run it at selection before party membership changes.

Source chain: `_UpdateSprites` (`engine/overworld/sprite_collisions.asm`)
visits slot 15, `SpawnPikachu_` → `TrySpawnPikachu` → `ShouldPikachuSpawn`
(`engine/pikachu/pikachu_follow.asm:1,351,403`). Eligibility tests live party
membership/HP before the screen/UI check. Failing it writes IMAGEINDEX=$ff and
movement status=0; being covered only hides the image and does not remove
eligibility. These are different states.

| Operation | Required source behavior at and after the result-box update |
|---|---|
| Deposit an out starter | After append-to-box/remove-from-party, the result PrintText update finds no living starter in the party and sets image $ff/status 0. Keep it absent during later Bill/top-level menus, their text prompts, and the final map-close update. No temporary visible sprite or spawn is created by the transfer. |
| Withdraw a healthy starter | After append-to-party/remove-from-box, the result PrintText update finds the starter alive. At status 0 it runs CalculatePikachuSpawnCoordsAndFacing, using the current spawn state, then consumes that state to 0. On the ordinary settled PC path this is **state 0: player map position, copying player facing**, not behind-player state 2 or nurse state 5. WillPikachuSpawnOnTheScreen still checks the screen/UI before font-loaded initialization. An overlapping sprite remains image $ff under Func_fcae2; do not force a visible portrait on the map. Later parent-menu updates preserve eligibility but respect their tile coverage. After LOG OFF and the existing Hold/close, following resumes through the existing command buffer once the player steps off. |
| Withdraw a fainted starter | _MoveMon preserves boxed current HP/status. ShouldPikachuSpawn still fails at HP=0: image $ff/status 0 at the result, menu returns and map close. Do not heal or spawn as a side effect of withdrawal. |

Bill's PC and MoveMon/RemovePokemon do not set a spawn state. Normal map spawn
consumes it in CalculatePikachuSpawnCoordsAndFacing; SchedulePikachuSpawnForAfterText
belongs to map loading, not this menu. A6e's pending nurse **state 5** is a direct
heal caller and must not be reused for storage. Existing final text-close facing
restoration remains in force; do not replace it with a PC-only facing reset.

**CP1 runtime gap (resolved in CP3, §12):** `updateSprites` and
`fontLoadedUpdateSprites` both skip a follower whose `visible` is false, and
neither receives the party to re-evaluate eligibility. The menu-session callbacks
therefore cannot hide a deposited follower or initialize a withdrawn one on
their own. `main.ts` re-evaluates on script completion/battle/map entry, too late
for the intermediate PC updates, and its `spawn()` places behind the player.

Existing `visible`, `hideImage`, `spawnAtState(..., 0)` and `fontLoadedUpdate`
provide the placement/coverage primitives, but **exact status-0 lifecycle needs
additional integration**: reconcile the party before each relevant PC sprite
update, distinguish an eligible-but-covered image from an uninitialized slot,
and retain initialization until the source screen check permits it. The source
screen check reads the slot's existing pixel coordinates before its subsequent
InitializeSpriteScreenPosition; eagerly calling spawnAtState also changes those
pixels and is not automatically an exact substitute. The global spawn-state
value currently written by field medicine is not consumed by those helpers;
do not treat a leftover value as evidence that the PC should use state 3 or 5.

**Historical CP1 gate (user authorized CP3–CP5; §§12–14):** CP1 implements none of this machinery. Before CP3, confirm
a narrow follower lifecycle adapter and its tests (deposit, healthy/fainted
withdrawal, covered initialization, result/menu/top-level/close updates) with
the user, or obtain an explicit decision about any approximation. CP2's shared
plumbing is separate. No general movement rewrite or implicit A6e change is
authorized by this trace.

## 5. Design (reuse first)

### 5.1 Shared state and modules

- **`text_flags.ts` (new):** `getNoTextDelay` / `setNoTextDelay`, the wStatusFlags5 bit (§2.1).
- **`ListMenu`:**
  - Clears the flag on choice and cancel.
  - New `kind: 'mons'`, with entries `{ name, level }`, PrintLevel, and SELECT as redraw only (it already
    redraws for non-item kinds).
  - The `ListChoice` for mons carries `index` and `name`.
- **`YesNoMenu`:** clears the flag as its input starts. Behavior is otherwise unchanged.
- **`MenuInput`:** a `rowStep: 1 | 2` option (default 2) for the chooser's single-spaced cursor.
- **Tile painter (`drawScreenTile`):** add `<LV>`, from the same tile the party menu uses, and the Poké Ball
  glyph (tile $78 = `balls.png` tile 0).
- **`pokemon_storage.ts` (new):** `BoxedPokemon`, `NUM_BOXES`, `MONS_PER_BOX`, `pokemonToBoxed`, moved
  unchanged; `main.ts`, `save.ts` and `menus/index.ts` import from it. Add
  `isStarterPikachuBoxed(boxed)`, the species stand-in.
- **`monDisplayName(mon)`** (§2.2).
- **`pikachu_happiness.ts`:** add `DEPOSITED`, tiers −3/−3/−5, with the mood target read from the ASM's
  PikachuMoods table, not taken from this note.
- **`main.ts`:** factor the START → SAVE `saveGame(...)` argument list into one `writeSave()`. The save
  menu and `PcStorage.saveGame` both call it. A5b7f will reuse it.

### 5.2 `menus/bills_pc.ts` (new): `BillsPc`

- Created by `PcSession` when SOMEONE's/BILL's PC's preamble ends, in place of the bridge. It owns the Bill's
  state machine on the same `ScreenTiles`, `textBox`, `transfer` and sound helpers.
- `PcSession` delegates `frame` / `advanceText` / `renderOverlay` to it while it runs. The calls are the
  same as A5b7d's: one Joypad owner per frame, and the host ticks the transfer.
- Factor `PcSession`'s `print` / `waitSound` / `drawCursor` helpers so both use one copy; don't duplicate
  them.
- **Cries:** call a `playCry(species)` stub that does nothing (J2). The `WaitForSoundToFinish` that follows
  is the real helper. No invented durations.
- **ScriptDeps / `PcStorage`:**
  - `saveGame()` and `isPikachuFollowingDisabled()`, which returns `false` until V2 wires the Pewter
    Pokécenter Jigglypuff scene (`scripts/PewterPokecenter_2.asm:67`).
  - The party, boxes, current box get/set and `deserialize` (exist).

### 5.3 The STATS screen (§9 Q3)

Move the existing stats pages out of `PartyMenu` into `menus/stats_screen.ts` unchanged (page 1/2,
rendering, input). `PartyMenu` and `BillsPc` both use it. In Bill's PC it runs as a full-screen hand-off,
reusing `MenuSession.fullScreen`, with the same per-frame `readJoypad` guard as A5b7d's bridge. Silence its
press sound if it has one.

Withdraw shows a `deserialize`d box mon; it must not change the box.

### 5.4 Retire

Delete `bills_pc_menu.ts`, the bridge fields in `PcSession` and their tests. Port the bridge tests'
intent: the MET_BILL preamble and the current box surviving the visit. The `PC_*` `game_text` keys go to
A5b7g's census.

### 5.5 Tests (each against the source branch it names)

- Every §3 row.
- Both no-delay cases.
- The NO-returns-to-the-same-row release loop with the stale question visible.
- The offset push/pop.
- The parent cursor kept inside the visit and zero on re-entry.
- BOX No. for 1, 9, 10 and 12.
- The chooser's balls and single-spaced cursor.
- Saving on A to the same box, and no save on B or NO.
- The starter release refusal and happiness only for the starter.
- The fainted-last-but-one deposit.
- Add before remove.
- No beep anywhere except the prompts.
- **Real-input dispatch** through main, in the style of `field_medicine_input.test.ts`, with a real per-tick
  edge (note 46 F-1/N-5).
- A ≤ 1 Joypad owner per frame check and render-does-not-tick.

### 5.6 N-4: the party-menu cursor clamp (§9 Q4)

`PartyMenuInit` loads `wPartyAndBillsPCSavedMenuItem` without clamping. Every Bill's PC pass zeroes it
(BillsPCMenu, DisplayDepositWithdrawMenu), and no vanilla path shrinks the party without passing there.
So `PartyMenu.show`'s `Math.min` clamp is unobservable.

Recommendation: keep it as a documented guard. Add tests that a deposit leaves the saved cursor at 0 and
that the party menu then opens on row 0. Close N-4.

## 6. Checkpoints (each: focused tests, typecheck, local commit)

1. **CP1 — trace and data.**
   - Write §4.9's numbers and §4.10's answer into this note, from the ASM; no code.
   - Add `NoPokemonText` ($3A:$4E1F, root) and `_NoPokemonText` ($28:$4C77, far) to
     `rom/text_program_symbols.ts`. These are confirmed against pret's sym
     (`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`).
   - `npm run setup pokeyellow.gbc` twice, byte-identical; only the two text-program mirrors change.
2. **CP2 — shared plumbing and the carried-in fixes.**
   - `text_flags.ts` with the ListMenu and YesNoMenu clears.
   - **F-1** in `PcSession`: update the A5b7d tests that assumed instant text, each to the source line that
     decides it.
   - **F-2** `monDisplayName`.
   - `kind: 'mons'`, `rowStep`, the two tile glyphs, `pokemon_storage.ts`, DEPOSITED, `writeSave()`.
   - The Mart, bag, item PC and party tests stay green except the F-1 updates.
3. **CP3 — Bill's PC: the menu, WITHDRAW, DEPOSIT, RELEASE.**
   - §4.1–4.5 and §4.8, with the Pikachu follower behavior from CP1, the starter rules and happiness.
   - STATS can be a no-op stub in this checkpoint only.
4. **CP4 — STATS, CHANGE BOX, PRINT BOX, retirement.**
   - §5.3, §4.6 with the real save, §4.7, §5.4 and N-4.
   - Integration through main's dispatch with real input.
5. **CP5 — handoff.**
   - Full suites, build, diff check.
   - A muted browser smoke on a spare port (staged save with 3+ party mons and a box): every §8 check
     plus a Change Box save → reload → CONTINUE.
   - Docs: menus/pikachu ARCHITECTURE, CONVENTIONS' test list, STATUS, and the result section in this note.
   - Suggested self-mutations:
     - a beep in Bill's menus;
     - text instant after a list;
     - the release NO resets the row;
     - releasing the starter allowed;
     - remove before add;
     - no save on Change Box A, or a save on B;
     - `wListScrollOffset` not restored;
     - the parent cursor not zeroed on re-entry;
     - happiness on a non-starter deposit.
   - Stop for review.

## 7. Gaps this slice keeps (named, each with a home)

| Gap | What the player sees instead | Home |
|---|---|---|
| Cries and Pikachu PCM clips (deposit 28, withdraw 35, release refusal 40) | Silence; their sound waits end at once, so results come a cry's length early | J2 (DECISIONS #44/#52) |
| STATS shows the existing (upstream) stats pages, not a StatusScreen/StatusScreen2 port | The same pages as START → POKéMON → STATS | §9 Q3 |
| PRINT BOX with Pokémon in the box (the printer screen, music, Press B to Cancel) | Returns to the menu | J2 |
| `DisablePikachuFollowingPlayer` state | The "There isn't any response..." branch exists but never fires | V2 (Pewter Pokécenter) |
| Direct `BillsPC_` ("Switch on!", turn on/off) | Not built: only the unreferenced `UnusedOpenBillsPC` reaches it | none |
| Box data model (no stat exp anywhere in the engine; box→party recalculates stats from level and DVs) | Unchanged | J2 |
| The OT-name/ID part of the starter test | Species stand-in | A4 (trades) |

## 8. User play-test (after review)

`http://127.0.0.1:5173/`, **Z = A, X = B**. You need two or more Pokémon (catch one on Route 1 first).
**RELEASE is real.** Release only a Pokémon you don't want, or answer NO.

1. **Viridian Pokécenter PC → SOMEONE's PC:** "Accessed someone's PC…", then the menu with six entries and
   "BOX No. 1" at the bottom right. Menu presses make **no beep**.
2. **WITHDRAW** with an empty box: "What? There are no POKéMON here!" appears **at once**.
3. **DEPOSIT:**
   - The party list shows names and **:L** levels.
   - Choosing a Pokémon opens DEPOSIT/STATS/CANCEL. STATS shows its stats and comes back.
   - DEPOSIT gives "<NAME> was stored in Box 1.", **typed** this time.
   - With one Pokémon left: "You can't deposit the last POKéMON!".
4. **WITHDRAW** it back: "<NAME> is taken out. Got <NAME>.".
5. **RELEASE:** "Once released, … OK?". **NO** brings the list back on the same Pokémon. If you deposit
   PIKACHU and try to release it: "PIKACHU looks unhappy about it!", and it stays.
6. **CHANGE BOX:**
   - "When you change a POKéMON BOX, data will be saved. Is that okay?" → YES.
   - The box list shows a ball next to non-empty boxes. Pick BOX 2: the save sound, then BOX No. 2.
   - Reload the page, CONTINUE: you're at the PC, and Bill's PC shows BOX No. 2.
7. **PRINT BOX** in an empty box: "There are no POKéMON here!".
8. **SEE YA!** returns to the PC menu; LOG OFF closes.
9. **Regression (F-1):** in your PC's WITHDRAW ITEM, "How many?" and "Withdrew …" now **type** after
   the list. A Potion on PIKACHU says "PIKACHU recovered by …!" in capitals (F-2).

## 9. Decisions for the user (O-27)

1. **Build the cartridge's Bill's PC now:**
   - the six-entry menu;
   - the DEPOSIT/WITHDRAW–STATS–CANCEL menu;
   - the starter-Pikachu rules and DEPOSITED happiness;
   - Change Box with its save;
   - PRINT BOX's empty-box branch;
   - only the §7 gaps left.

   *Recommended.* This amends #52's "messages only" limit and its "no Change Box autosave / full Bill's PC
   mechanics stay with J2/E2". PLAN's E2 drops Bill's PC and DEPOSITED and keeps fishing, evolution,
   Daycare and Name Rater.

   The alternative keeps #52 literally: source texts on today's operations. That leaves invented YES/NO
   prompts, a 5-entry menu and a releasable starter. It can't avoid invented UI, which #52 itself forbids.
2. **Change Box saves the game,** through the same save write as START → SAVE. *Recommended:* on the
   cartridge, a deposit followed by a box change survives a reset. Without the save it wouldn't, and the
   warning text would be false.
3. **STATS shows the existing stats pages** (moved into a shared module) until a StatusScreen port.
   *Recommended:* it's what the party menu shows today. The StatusScreen/StatusScreen2 port then fixes both
   at once. Place that port: **its own slice right after A5b7g** (recommended; the party menu, Bill's PC and
   later battle all show it), or with A5c.
4. **Fix F-1 (text speed after lists, A5b7d) and F-2 (Pokémon names in capitals, A5b7c2) in this slice;**
   keep the party cursor clamp as a guard and close N-4 (§5.6). *Recommended.*
5. **One slice, five checkpoints.** Who implements: Sol or Grok (your pick). Claude reviews; you play-test.

## 10. CP1 result — Codex/Sol, 2026-10-15

**CP1 complete (CP2 subsequently completed in §11).** The user explicitly authorized only CP1
and requires confirmation before continuing. Starting commit: `8f05658`.

- **Trace:** §4.9 now pins entry +5/menu-read +11, list +16, submenu +3,
  redraw +7, release's +15 answer tail, the typed/transfer-disabled chooser
  (15 glyphs; medium layout +48/read +51), CGB STATS restoration +6 and generic
  exit +3. Conditional text, current-sound and transfer-phase costs remain
  explicit rather than invented constants. A scratch run of the committed
  ChooseABoxText through TextProgramRunner independently confirmed 15/45/75
  letter frames at fast/medium/slow. The existing StatusScreen pages remain
  the approved gap; no screen port or new runtime delay was implemented.
- **Follower dependency:** §4.10 corrects the first update to the result
  PrintText, before its first glyph. Party eligibility and covered images are
  distinct; a healthy withdrawal normally consumes spawn state 0, not the
  nurse's 5. Exact pending/status-0 integration needs a narrow adapter beyond
  simply toggling visible or calling the behind-player spawn. Reported for
  confirmation **before CP3**, with no follower code changed in CP1.
- **Data:** confirmed `3a:4e1f NoPokemonText` and `28:4c77 _NoPokemonText`
  against pret's symbol branch, and the root/FAR child against their ASM.
  Added only those two registry rows. Generated program count **547 → 549**;
  the root calls the child, which preserves `There are no\nPOKéMON here!<PROMPT>`.
- **Regeneration:** setup twice, **873** paths/hashes byte-identical. Only
  `data/text_programs.json` and `static/text_programs.json` changed from the
  starting tree; exactly two programs added, every prior program and pointer
  table preserved, and the mirrors identical. All PNGs/tilemaps/other JSON
  unchanged. Scratch manifests/logs: `%TEMP%/pkmn-a5b7e-cp1/`.
- **Verification:** baseline and final strict typecheck clean; baseline and
  final ROM suite **1436/1436** across 78 files; final no-ROM **1306 pass /
  130 skip**. Final source-parsed text-program/static-export fixtures **14/14**.
  Existing exhaustive independent ASM/ROM fixtures cover the pair, so no
  implementation-mirroring test was added. Diff/whitespace checked. No runtime
  change, browser test or production build in this data-only checkpoint.

This result, trace, registry and generated mirrors are committed locally with
the STATUS handoff. Nothing pushed. **STOP: wait for the user's confirmation
before CP2; the parent's approval does not lift this checkpoint stop.**

## 11. CP2 result — Codex/Sol, 2026-10-15

**CP2 complete; stop before CP3.** The user explicitly authorized CP2 after
the CP1 pause. Starting commit: `a7a6edd`. No generated data changed.

- **F-1:** `text/text_flags.ts` holds shared no-text-delay state. ListMenu sets
  it on entry and clears it on selection/B/CANCEL. YesNoMenu clears before
  HandleMenuInput, including Delay3. PcSession reads it at every print;
  PlayerPCMenu sets it each pass and ExitPlayerPC clears it. The first branch
  question stays instant; post-list quantities/results/errors/retry questions
  type until parent reentry. `players_pc.asm`/`list_menu.asm` determine these
  transitions. At fast speed, the nine-glyph HowMany question draws the quantity
  at Q+12 and first reads at Q+13, replacing the old instant +3/+4 assumption.
- **F-2:** `pokemon_names.ts:monDisplayName` supplies uppercase names to party
  lists/stats, field-medicine bindings and the legacy Bill lists/bindings.
  Saved nicknames retain their case; full MonsterNames support remains V5.
- **List/input/render foundations:** `kind: 'mons'` has name/level entries and
  index/name results, source list timing/scroll/CANCEL, and SELECT redraw only.
  LV is at column 14, digits at 15; level 100 overwrites LV from column 14.
  MenuInput accepts stride 1 or 2, default 2, without changing reads/delays.
  Opaque menu cells support LV (battle_hud_1 tile 1) and ball (balls tile 0).
  The ball uses the palette-aware 2bpp loader, preserving both middle shades;
  its sheet refreshes with the text border on map palette changes.
- **Storage/save foundations:** moved BoxedPokemon, 12/20 capacities and
  pokemonToBoxed to `pokemon_storage.ts`, preserving the serialization fields
  and deep-copied moves. Added a boxed species-only starter stand-in (OT checks
  A4). `main.ts:writeSave()` holds the former START save arguments unchanged
  and is passed as PcStorage.saveGame. Following-disabled returns false until V2.
- **DEPOSITED:** the source tier row is −3/−3/−5 and the mood target is **$62**.
  The ASM's decrease writes the target directly if current mood is at least
  that target; it never raises an already lower mood. The new event follows
  that branch, rather than the older events' existing one-unit nudge gap.
  Selected-starter gating and the deposit call remain CP3 work.
- **Tests:** +26 covering these foundations. Existing PC tests now check typed
  post-list text, retry/empty-list/parent reentry transitions, fast quantity
  frames and retained silence; production hidden-event tests use the revised
  quantity timing. Existing Mart/bag/party flows remain green.
- **Gates:** strict typecheck and production build clean; ROM **1462/1462** in
  80 files; no-ROM **1332 pass / 130 skip**; whitespace/diff checked. Baseline
  before changes was 1436/1436. Logs: `%TEMP%/pkmn-a5b7e-cp2/`.
- **Browser:** muted isolated Chrome on spare `127.0.0.1:5198`, temporary
  response instrumentation only. Real keyboard input exercised item-PC withdraw:
  first question instant, quantity/result/retry typed, including intermediate
  `H`/`W` logical buffers. Potion result displayed PIKACHU while the stored
  nickname stayed Pikachu. START → SAVE preserved party HP/OT, money, current
  box/contents, PC items and flags; reload → CONTINUE restored the healed party.
  No page errors or unexpected failed requests (the existing absent indoor wild
  file is excluded). Test origin storage cleared; user's :5173 save untouched.

Bill's legacy UI/bridge remains. No new deposit/release/withdraw UI, shared STATS,
box chooser, autosave trigger or follower lifecycle integration was implemented.
CP1's §4.10 follower adapter remains a dependency to confirm before CP3. Updated
subsystem docs, test inventory and STATUS are committed locally with this result.
**Wait for the user's explicit confirmation; do not continue into CP3.**

## 12. CP3 result — Codex/Sol, 2026-10-15

The user subsequently authorized **all remaining checkpoints without stops**,
including the narrow §4.10 follower adapter. Starting commit `2c2f3de`.

`BillsPc` now owns the retained six-entry menu, mon lists, deposit/withdraw
submenu and source withdraw/deposit/release checks/texts. Entry writes/read
anchors are +5/+11, list +16 and submenu +3; sound waits remain real. Parent
row survives the visit, list offset is pushed/popped, and returning through
BillsPCMenu resets the shared party cursor to 0. Release NO preserves its row,
offset and stale question. Transfers append before removing; fainted deposit
and boxed HP/status/PP are preserved. Only starter deposit changes happiness;
starter release is refused. Menu choices are silent; prompt beeps remain.

`PcDisplay` factors both PC menus' PrintText/sound/delay/cursor helpers. Its
PrintText invokes the PC's font-loaded sprite callback after opening the box
and before Delay3/glyphs. Script dispatch reconciles live party eligibility at
each PC sprite update. The follower retains pending status-0 initialization,
calculates map placement/facing without changing old pixels before the screen
test, and initializes only once coverage permits. Deposit hides immediately;
healthy withdrawal uses settled spawn state 0 and remains hidden on the player;
fainted withdrawal stays absent. Existing placement helpers now consume their
spawn state to avoid reusing a stale medicine/nurse state. No movement rewrite.

Focused **490/490** across 35 files and strict typecheck pass. Added 17 Bill
flows and 5 follower lifecycle cases; old bridge tests now check the retained
preamble/display return. No generated changes. STATS is the explicitly allowed
CP3 stub; CHANGE/PRINT BOX and legacy-file retirement remain CP4. Committed
locally with this progress record; continuing directly into CP4 as authorized.

## 13. CP4 result — Codex/Sol, 2026-10-15

From `837a4fe`, implemented shared `StatsScreen` and `party_tiles.ts`, with
PartyMenu delegating to the same existing pages and Bill's PC using silent
full-screen input. An independent comparison against CP3's original file
confirmed both rendering bodies/front-sprite drawing unchanged after replacing
the selected-mon field and shared tile helper. Withdraw STATS deserializes a
temporary mon without mutating the box. Buffer1 restores the submenu on STATS;
CGB palette Delay3 plus input Delay3 gives first read E+6.

Change Box runs the warning/YES-NO and typed, transfer-disabled chooser. All 15
glyph delays complete before layout/transfer-on (medium C+48; first read C+51).
Rows are single-spaced, occupied boxes use the ball tile, numbers right-align
through BOX12. NO/B never save. A waits current sound, starts save, waits actual
completion, switches even to the current box and invokes the shared save write,
with no invented text. PRINT BOX has the empty-box program; nonempty returns
as the named J2 printer gap. Deleted `bills_pc_menu.ts` and its export; no bridge
remains. The old PC game_text keys stay for A5b7g's census.

Strict typecheck and focused **505/505** in 36 files pass. Added 8 Bill cases,
2 shared-page cases and 4 real-input hidden-event/controller flows. These check
one menu/printer input owner and one BG transfer per frame, render-does-not-tick,
deposit/withdraw follower reconciliation before result glyphs, final close,
and the Change Box save callback after switching. Existing checks also cover
N-4's reset-to-0 party entry. Committed locally; continuing directly to CP5's
full suites/build, mutations, browser smoke and final docs as authorized.

## 14. CP5 result — Codex/Sol, 2026-10-15

**All five checkpoints implemented; ready for Claude review and the user's
§8 play-test.** CP1 `a7a6edd`, CP2 `2c2f3de`, CP3 `837a4fe`, CP4 `af55f0c`;
CP5 is the local commit containing this handoff. The user explicitly lifted
the earlier intermediate checkpoint stops. No A5b7f or later slice started.

Final source audit kept Change Box's filled cursor through its save wait and
preserved a deposited follower's old antic offset as well as its pixels until
the status-0 screen check succeeds. Both now have regression assertions.

- **Final gates:** strict typecheck/build clean; ROM **1499/1499** in 83 files;
  no-ROM **1369 pass / 130 skip**. No data/static changes since CP1. Diff and
  whitespace checked. Total slice increase: **63 tests** from 1436, including
  CP2's 26 and CP3–CP5's 37. The production bundle is 353.46 kB / gzip 107.33 kB.
- **Mutations:** eleven temporary production changes each caused assertion
  failures, then were restored: beep in Bill's menus (4 tests), forced instant
  text (7), release NO resets selection (1), starter release allowed (1),
  remove before add (2), missing Change Box save (2), B saves (1), lost saved
  offset (1), nonstarter happiness (2), eager covered initialization (3), and
  missing result PrintText sprite update (3). Final suites run after restoration.
- **Browser:** muted isolated Chrome on spare `127.0.0.1:5199`, real keyboard
  input through main's dispatch, temporary response instrumentation only.
  All §8 behaviors exercised, plus healthy/fainted follower lifecycles and
  same-box save/cancel branches. Thirteen recorded checks cover retained menu,
  initial instant empty withdrawal, LV/level 100 list, both STATS pages from
  deposit/withdraw, named typed results, starter happiness/refusal, release
  NO/YES, last-mon rejection, empty/nonempty PRINT BOX, chooser balls/spacing,
  warning NO/chooser B preserving the existing save, A/same-box A saving,
  SEE YA!/LOG OFF, reload → CONTINUE retaining BOX No. 2/contents, nested item-PC
  typed text and capitalized Potion output. Healthy Pikachu stayed hidden on
  the player until walking away and resumed through the existing follow
  commands; fainted Pikachu retained zero HP/PSN and stayed absent through close.
  No page errors or unexpected failed requests (existing absent indoor wild
  files/favicon excluded). The temporary origin storage is cleared; :5173 and
  the user's save were untouched. Scratch scripts/logs/screenshots:
  `%TEMP%/pkmn-a5b7e-cp5/`.
- **Handoff:** menus/text/Pikachu architecture, module map, roadmap/project
  status, test inventory/baselines and STATUS updated. N-4 is closed: Bill
  resets the saved party cursor to 0; PartyMenu's clamp remains a guard.

Approved §7 gaps remain unchanged: cries/PCM and printer screen J2, the separate
StatusScreen port after A5b7g, following-disabled state V2, OT starter checks
A4, and the existing box/stat-exp model J2. Legacy PC game_text keys remain for
A5b7g's census. Local commits only, never pushed. **Next is review/play-test;
this implementation is not yet marked user-verified.**
