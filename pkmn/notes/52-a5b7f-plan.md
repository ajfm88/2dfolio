# A5b7f plan: the START menu and SAVE, as `start_menu.asm` and `save.asm` run them

**2026-10-15 · Claude · Approved: the user answered "yes to all" to §9 (O-28 → DECISIONS #59).**
Implementer: **Sol** (the user's pick, 2026-10-15). Claude reviews; the user play-tests each sub-slice (§8).

Parent: `notes/39-a5b7-plan.md` §1 (A5b7f row: "save presentation, actual sound wait and automatic
return… source START exit"), §2 items 11–12, §5 (Save row), §6 (older-file question). DECISIONS #52.
Note 43's gap table already sends "START menu wrap, ▷, Delay3" here (A5b7f/J2).
Baseline: **1499/1499** with the ROM, 1369/130 without.

**CP1 trace correction (Codex/Sol, 2026-10-15):** a 32-tile text-box reload
costs **5**, not 4, explicit VBlank waits. CopyVideoData also waits for its final
zero-tile remainder. Opening stays +20/+23; close and affected submenu/SAVE
anchors below are corrected. Derivation and runtime audit: §4.6. No code changed.

## 1. Recommendation

The save screen opens from inside the START menu and returns through it. Its first and last frames are the
START menu's: `SaveScreenTilesToBuffer2` at the choice, then `LoadScreenTilesFromBuffer2` →
`HoldTextDisplayOpen` at the end. Today's START menu is still upstream's: drawn at once, wrapping freely,
cursor reset on every open, no ▷, beeping on START, no Delay3.

So split A5b7f into two sub-slices, both specified here (§9 Q1):

| Sub-slice | Deliverable |
|---|---|
| **A5b7f1 — the START menu** | `DisplayTextID(0)` → `DisplayStartMenu`: the opening, `DrawStartMenu`, the input loop (wrap rules, saved cursor, ▷, sounds), `CloseStartMenu`, and `RedisplayStartMenu` with each submenu's START-side tail |
| **A5b7f2 — SAVE** | `StartMenu_SaveReset` → `SaveMenu`: the info box, the typed question, the left YES/NO, the save, "Saving…", "<PLAYER> saved the game!", the real save sound, then the restored START screen, Hold and close |

Each sub-slice gets its own review and play-test. **No extractor work:** `WouldYouLikeToSaveText`,
`SavingText` and `GameSavedText` are already in `data/text_programs.json`, and START's labels are static
strings.

## 2. Sources

- `home/start_menu.asm` (DisplayStartMenu, RedisplayStartMenu, CloseStartMenu)
- `engine/menus/draw_start_menu.asm` (DrawStartMenu)
- `engine/menus/start_sub_menus.asm` (each StartMenu_X tail; StartMenu_SaveReset)
- `engine/menus/display_text_id_init.asm`, `home/text_script.asm` (DisplayTextID, HoldTextDisplayOpen,
  CloseTextDisplay)
- `home/window.asm` (HandleMenuInput_, PlaceMenuCursor, EraseMenuCursor)
- `engine/menus/save.asm` (SaveMenu, SaveTheGame_YesOrNo, CheckPreviousSaveFile)
- `engine/menus/main_menu.asm` (PrintSaveScreenText, PrintNumBadges/OwnedMons/PlayTime)
- `engine/menus/text_box.asm` (DisplayTwoOptionMenu)
- `home/load_font.asm` (LoadTextBoxTilePatterns: 32 tiles, CopyVideoData = **5 frames** with the LCD on; §4.6)
- `home/overworld.asm` (the START press)
- `engine/battle/core.asm:1776,2140,2226` (the shared cursor byte)
- `data/text/text_4.asm`

Code: `menus/{start_menu,save_menu,yes_no_menu,menu_input,screen_tiles,menu_glyphs,bag}.ts`, `main.ts`
(`start_menu`, `save_menu`, `menu_closing`, the submenu returns, `openStartMenu`, `drawUiLayer`), `list_state.ts`,
`overworld/ui_entry.ts`, `text/{textbox,close_sequence}.ts`.

## 3. What is wrong today

| # | Today | Cartridge |
|---|---|---|
| T1 | START press: the sound and the whole menu at once | `DisplayTextID` with text ID 0. DisplayTextIDInit draws the **START border** (not the bottom box) and runs the same opening as an NPC text (A5a: border shown about +4, handler at **+20**). Then DisplayStartMenu: **SFX `start_menu` at +20**, DrawStartMenu, UpdateSprites, HandleMenuInput (cursor, Delay3): first read **+23** |
| T2 | Cursor 0 on every open | `wBattleAndStartSavedMenuItem`, saved on **every** A/B/START (`home/start_menu.asm:55`), WRAM (not saved, 0 at power-on). Battle zeroes it and stores its own choice there (§7) |
| T3 | Free wrap on every press, no Delay3 | HandleMenuInput (watched: A, B, START, Up, Down; max **7** with the Pokédex, 6 without; top (11,2)). Up wraps to the last entry only when the cursor is at 0 **and** `wLastMenuItem` is 0. Down past the last entry goes to the hidden index 7/6, which the loop turns into 0 with **EraseMenuCursor**. Each pass is PlaceMenuCursor + **Delay3** |
| T4 | ▶ stays | **▷** (`PlaceUnfilledArrowMenuCursor`) after **every** A, B or START, before the dispatch or the close |
| T5 | B and START beep | HandleMenuInput beeps on A or B only. **START closes silently** |
| T6 | Close: one read, then CloseTextDisplay | CloseStartMenu: one Joypad call (normally exits at once), **LoadTextBoxTilePatterns (5 frames, transfer off)**, then CloseTextDisplay; the separate reload is missing from today's close cost (§4.6) |
| T7 | Returning from a submenu redraws at once and reads at once | Each StartMenu_X **tail** (§4.4), then RedisplayStartMenu: DrawStartMenu (cursor = saved), UpdateSprites, HandleMenuInput's Delay3 |
| T8 | POKéMON with an empty party does nothing | `jp z, RedisplayStartMenu`: a full redraw, UpdateSprites, Delay3 |
| S1 | Info box after a fixed 30 frames | PrintSaveScreenText: transfer off, box (4,0) 8×14, **LoadTextBoxTilePatterns 5 frames**, UpdateSprites, labels and numbers, transfer on, **30**; then SaveMenu's **10** |
| S2 | Instant question; legacy YES/NO, press per tick | `WouldYouLikeToSaveText` through **PrintText, typed** (DrawStartMenu cleared no-delay), `done`, then the two-option YES/NO at **(0,7)** (left): beeps, actual reads, the **15-frame** answer tail |
| S3 | NO returns to the START menu | NO/B → `ret nz` → **LoadScreenTilesFromBuffer2** (the START screen with ▷ on SAVE) → **HoldTextDisplayOpen** → CloseTextDisplay. START is **not** redisplayed |
| S4 | Writes on A, 60 frames, invented "press A" at the end, back to START | YES → **10** → **SaveGameData** (before any text) → "Saving..." (typed, `done`) → **128** → "<PLAYER> saved / the game!" (typed, `done`) → **10** → `save` SFX (wait for the current sound, play, wait) → **30** → Buffer2 → Hold → close |
| S5 | TIME's colon is the font ':' | Tile **$6D**, `font_extra` tile 13, a narrow colon. Hours: 3 digits right-aligned at (13,8); minutes 2 digits with leading zeros at (17,8) |

## 4. Flow

### 4.1 Opening (A5b7f1)

T = the START press. `hJoyPressed`, or `hJoyHeld` while simulating, as today's `restOfPass` and the script
`openStartMenu`.

| Frame | Behavior |
|---|---|
| T | DisplayTextIDInit writes the START border, (10,0) inner 14×8 with GOT_POKEDEX or 12×8 without. Font-loaded UpdateSprites (today's UiEntry rising edge), then the sprites' stand-still pass. CopyScreenTileBufferToVRAM takes 3 frames; hWY becomes 0 at **T+3**, the existing NPC model's render T+3 / first window scanout **T+4**. LoadFontTilePatterns then takes 17 more frames; no items, cursor or START sound during this opening. |
| T+20 | DisplayStartMenu: PlaySound `start_menu`. DrawStartMenu: the border again; items at (12,2), two rows apart: [POKéDEX], POKéMON, ITEM, <PLAYER>, SAVE, OPTION, EXIT (no-delay set around the strings). Menu: top (11,2), max 7/6, watched A/B/START/Up/Down, cursor and `wLastMenuItem` = saved, out-of-bounds 0. UpdateSprites (font-loaded). HandleMenuInput: PlaceMenuCursor ▶, Delay3 |
| T+23 | First read |

### 4.2 The loop

Each HandleMenuInput return goes through RedisplayStartMenu's `.loop`:

- **Up** at 0 with last 0 → cursor = 6 (5 without the Pokédex), EraseMenuCursor.
- **Down** to 7 (6 without) → cursor = 0, EraseMenuCursor.
- Otherwise HandleMenuInput again: PlaceMenuCursor, Delay3, read.
- **A/B/START:** ▷ at the cursor, saved cursor = current. B/START → close (§4.3).
- **A:** `SaveScreenTilesToBuffer2` (the START screen with ▷), then dispatch. Without the Pokédex the index
  is +1. EXIT falls through to the close.

If a watched Up/Down returns at **R**, wrapping/EraseMenuCursor and the next
PlaceMenuCursor execute in R; the next read is **R+3**. Ordinary movement and
an out-of-bounds wrap have the same cost. An unwatched key likewise restarts
Delay3; idle stays in `.loop2` (the port polls once per frame). There is no
30/5 repeat wait for this new-press-only menu and no extra dispatch frame.
PlaceMenuCursor updates `wLastMenuItem` when it places the cursor. Thus Up from
row 1 to row 0 has last=1 and does **not** immediately wrap; after placement at
row 0, another Up may wrap. Never substitute the newly moved row for last.

### 4.3 Close (B, START, EXIT)

Let **C** be the accepted B/START/EXIT read. `CloseStartMenu` calls Joypad again
in C; it tests **newly pressed A**, not held A. Normally that second read clears
the already accepted A edge (EXIT) and the loop returns immediately, so holding
A on EXIT does not add HoldTextDisplayOpen. LoadTextBoxTilePatterns then takes
**5** frames with transfer disabled and no reads. At **C+5**, CloseTextDisplay
starts its existing window/sprite/player close sequence; its final UpdateSprites
and return are at **C+10+2W**, where W is the current walking-picture count.
A/B beep at acceptance; START is silent. There is no sound-completion wait here.

**The prefix is not already counted.** `currentMapCloseFrames` returns
`1 + 2W + 4 = 5 + 2W`: one window frame, walking sprite reloads, and the player's
two 12-tile copies (2+2). Its `+4` is player graphics, not text-box graphics.
Keep that shared helper unchanged; START's own prefix needs 5 additional frames.
Examples: Red's 2F W=1: 7 → **12** total; Oak's Lab W=5: 15 → **20**;
Viridian Pokécenter W=6: 17 → **22**; outdoor W=9 sets: 23 → **28**.

### 4.4 The START-side tails (back into RedisplayStartMenu)

The submenus' own screens stay as they are (§7). Only the code after each submenu routine returns is ported:

Let **R** be the submenu routine's return into its START-side tail. These are
the **CGB** counts (the current palette model); submenus' internal waits are
outside R. DMG variants are given where RunDefaultPaletteCommand differs.

| Entry | Tail and cursor/redraw time relative to R | First START read |
|---|---|---|
| POKéDEX | LoadScreenTilesFromBuffer2 (0), Delay3 (3), LoadGBPal (0), UpdateSprites (0), RedisplayStartMenu. Redraw/cursor **R+3** | **R+6** |
| POKéMON (empty party) | `jp z, RedisplayStartMenu`: no tail; redraw/cursor in **R** (R is the A selection here) | **R+3** |
| POKéMON (`.exitMenu`) | White-out+Delay3 **3**; RestoreScreenTilesAndReloadTilePatterns **32** = LCD-off map-sprite reload 0 + player 4 + font 17 + Buffer2 0 + text-box tiles 5 + CGB palette 3 + explicit final Delay3 3; LoadGBPal 0. Redraw/cursor **R+35**. DMG: restore 29, redraw R+32 | **R+38** (DMG R+35) |
| ITEM | `.exitMenu`: Buffer2 0, text-box tiles **5**, UpdateSprites 0, RedisplayStartMenu. Redraw/cursor **R+5**. Bag internals stay unchanged; today's BagSession.exitMenu has no such copy wait, so assign this missing tail once to START's `redisplay('item')` | **R+8** |
| <PLAYER> (trainer card) | GBPalWhiteOut 0; font **17**; Buffer2 0; CGB default palette **3**; ReloadMapData **0 explicit waits** (LCD off, including its text-box/tileset reload); DrawStartMenu, LoadGBPal and DoNotDrawStartMenu. Redraw/cursor **R+20**. DMG: R+17 | **R+23** (DMG R+20) |
| OPTION | Buffer2 0; text-box tiles **5**; UpdateSprites 0; RedisplayStartMenu. Redraw/cursor **R+5** | **R+8** |
| SAVE | Buffer2 0 → HoldTextDisplayOpen (user-dependent A-held polls) → CloseTextDisplay **5+2W**; no CloseStartMenu text-box prefix, and **no START redisplay** | none |

RedisplayStartMenu: DrawStartMenu (cursor = saved), UpdateSprites, HandleMenuInput (Delay3 → read +3).

### 4.5 SAVE (A5b7f2)

S = the A on SAVE. ▷ placed, Buffer2 saved (§4.2).

| Step | Behavior |
|---|---|
| S | PrintSaveScreenText: transfer **off**; box (4,0) inner 8×14 (rows 0–9, cols 4–19, over START's top) |
| S…S+5 | LoadTextBoxTilePatterns: **5** frames, no reads (CP1 correction, §4.6) |
| S+5 | UpdateSprites (font-loaded). Strings at (5,2), two rows apart: `PLAYER` / `BADGES    ` / `#DEX    ` / `TIME` (the trailing spaces are tiles). <PLAYER> at (12,2). Badges: PrintNumber 1 byte, 2 digits, right-aligned at (17,4). Pokédex owned: 3 digits at (16,6). Hours: 3 digits at (13,8), **$6D** at (16,8), minutes: 2 digits with leading zeros at (17,8). Transfer on. START's SAVE row (▷), OPTION and EXIT stay visible below the box |
| S+35 | (after 30) SaveMenu: 10 more |
| S+45 | SaveTheGame_YesOrNo: PrintText WouldYouLikeToSave: box (0,12), UpdateSprites, Delay3, then typed (first glyph **S+48**), `done`. At its return Q: two-option YES/NO at **(0,7)**: box cols 0–5 rows 7–11, YES (2,8), NO (2,10), cursor (1,8), default YES. Labels with no-delay, then no-delay cleared, HandleMenuInput (beeps): first read **Q+3** |
| Answer A0 | 15 frames, then the YES/NO tiles restored. **NO/B** (A0+15): LoadScreenTilesFromBuffer2 (info box and text box gone; START with ▷ on SAVE), HoldTextDisplayOpen (reads while A is held), CloseTextDisplay |
| YES | A0+15 → 10 → **A0+25: write the save** (`writeSave()`, before any text). PrintText SavingText: box, UpdateSprites, Delay3, typed "Saving...", `done` (returns at R1) |
| R1+128 | PrintText GameSavedText: "<PLAYER> saved\nthe game!" typed, `done` (R2) |
| R2+10 | PlaySoundWaitForCurrent `save`, WaitForSoundToFinish (real), no reads (W) |
| W+30 | LoadScreenTilesFromBuffer2 → HoldTextDisplayOpen → CloseTextDisplay (no LoadTextBoxTilePatterns here, unlike §4.3) |

No `OlderFileWillBeErasedText` (§9 Q2). `ChangeBox`'s save (A5b7e) shares `writeSave()` and has no
presentation. Neither does `CheckPreviousSaveFile`.

### 4.6 CP1 derivation and runtime audit (Codex/Sol, 2026-10-15)

Counts above are **explicit source frame waits**, using the existing NPC
opening/CloseSequence convention; they are not hardware or CPU-cycle
measurements. DisableLCD synchronizes to LY 145, SGB packet delivery has its
own cost, and CPU work/palette HBlank writes are not modeled as fixed additional
DelayFrames. The CGB path is identified separately from DMG; SGB packet timing
is not claimed by the CGB numbers. LoadSGB sets wOnSGB on CGB, so the default
palette command reaches SendSGBPackets and its LCD-on Delay3. LoadGBPal and
GBPalWhiteOut themselves contain no explicit frame delay.

**Tile-copy proof:** pret's symbol branch gives bank $04 FontGraphics
$4600–$4A00: 1024 bytes / 8 = 128 1bpp tiles; TextBoxGraphics $4E18–$5018:
512 bytes / 16 = 32 2bpp tiles. `gfx/font.asm` defines these as the complete
font/font_extra assets. In `home/copy2.asm`, both CopyVideoData variants branch
to `.keepgoing` for **c >= 8**, wait, subtract 8 and loop. The final **c < 8**
branch also waits even at c=0. Thus the formula is **floor(c/8)+1**, not ceil:
font 128 → **17**, text-box 32 → **5** (batches 8+8+8+8+0). The copy helpers
disable BG transfer throughout and restore its saved setting after the final
wait. `home/vblank.asm:DelayFrame` waits for the next VBlank on every call.
CopyScreenTileBufferToVRAM's three waits plus font 17 give **20**, then
HandleMenuInput's Delay3 gives the opening **23**.

**Close proof:** `home/text_script.asm:CloseTextDisplay` has DelayFrame 1,
font-loaded walking sprite halves 2W (`engine/overworld/map_sprites.asm`), and
LoadPlayerSpriteGraphicsCommon's two 12-tile copies, 2+2. Neither it nor
`game/src/overworld/sprite_sets.ts:{closeFrames,currentMapCloseFrames}` reloads
text-box tiles. `main.ts` constructs CloseSequence directly after its one exit
read, so the separate CloseStartMenu copy is currently absent. Do not add 5 to
the shared close helper: NPC text, PCs and SAVE's direct Hold/close do not all
run CloseStartMenu.

**Tail sources:** `engine/menus/start_sub_menus.asm` labels StartMenu_Pokedex,
StartMenu_Pokemon.exitMenu, StartMenu_Item.exitMenu, StartMenu_TrainerInfo and
StartMenu_Option; `home/{palettes,reload_sprites,reload_tiles,load_font,copy2,
tilemap,fade}.asm`; `engine/gfx/palettes.asm:SendSGBPackets`. ReloadMapSpriteTilePatterns
disables LCD for map sprite copies, reenables it, then loads player graphics
(4) and font (17). RestoreScreenTilesAndReloadTilePatterns subsequently adds
text-box tiles (5), CGB palette (3), and its own trailing Delay3 (3): **32**.
The preceding white-out's Delay3 makes the party tail **35**, then the START
menu read adds 3. Buffer restores and LCD-off copies have no explicit frame
wait. This is also why the trainer's ReloadMapData adds no second text-box
copy delay. ITEM's source tail was not fully timed in BagSession; it needs the
5-frame START-side adapter recorded in §4.4, without changing bag mechanics.

**MenuInput capability:** it can already return Up/Down when included in
`watched`, and `maxItem: 7/6` permits the hidden bottom index. Its default
non-repeat path and initial Delay3 are suitable. It **does not expose or track
wLastMenuItem**: `item` is mutated before returning, and its cursor getter only
reports the new row. CP2 must retain/expose the last *placed* row (or snapshot
it before update), apply START's wrap checks, then call `restart()` on every
returned Up/Down so the next HandleMenuInput pass costs 3. Do not use ordinary
free-wrap logic or enable repeat. `home/window.asm:PlaceMenuCursor` is the
authority for when last is written; START checks that value before calling it
again. No MenuInput or runtime changes are made in CP1.

The five-vs-four correction also shifts SAVE's future opening to **S+5, S+35,
S+45 and S+48** (§4.5), while its later answer-relative A0+25 and 128/10/sound/30
waits remain unchanged. This is a source-count correction, not a change to the
approved two-sub-slice scope or §9 decisions.

## 5. Design (reuse first)

- **`menus/start_menu.ts`: `StartMenuSession`** (replaces the legacy `StartMenu`). It runs in main's
  existing `start_menu` state, like the bag: it is **not** a script `MenuSession`, so the bag's standalone
  PrintText keeps working unchanged.
  - It owns a `ScreenTiles` layer (the START display's wTileMap) on `textBgTransfer`.
  - It uses `MenuInput` (watched A/B/START/Up/Down, max 7/6), plus the §4.2 wrap check on
    `wLastMenuItem`, which MenuInput must expose if it doesn't already.
  - It owns the font-loaded sprite hook (the `fontLoadedUpdateSprites` callback, like PCs' `onSprites`).
  - API: `open()`, `frame(readJoypad)` returning an action, `redisplay(tail)` for §4.4,
    `buffer2()` / `restore(buffer2)`.
  - One Joypad owner and one transfer tick per frame (the A5b7b–e contract), with a test.
- **`list_state.ts`:** `battleAndStartSavedMenuItem` (WRAM; not in the save; reset on load like the
  others).
- **`main.ts`:**
  - `restOfPass` and `openStartMenu` call `open()`.
  - The submenu returns call `redisplay(kind)`.
  - `menu_closing` gets the **5** copy frames first (for B/START/EXIT only; CP1 correction).
  - `drawUiLayer` paints the START layer under the bag (`item_menu`) and the save.
  - `ui_entry.ts` keeps one rising edge per opening.
- **`menus/save_menu.ts`: `SaveSession`** (replaces the legacy `SaveMenu`).
  - It draws into the **START layer** (Buffer2 = its snapshot), prints through
    `textBox.printStandalone(..., { noDelay: false })`, and uses `YesNoMenu.show({ actualRead: true,
    position: 'left' })`.
  - It uses the real sound wait (the PcDisplay helper pattern) and calls `writeSave()` at A0+25.
  - It returns `'close'` for both answers; main then restores Buffer2 and runs Hold and close.
- **`YesNoMenu`:** add `position: 'left'` (box (0,7), labels (2,8)/(2,10), cursor (1,8)/(1,10)). The nurse,
  Mart, PC and notebook stay at (14,7) unchanged.
- **`menu_glyphs.ts`:** a `TIME_COLON_GLYPH` for $6D (font_extra tile 13).
- **`ScreenTiles`:** writes the numbers with the existing A5b7a primitives (right-aligned, no leading zeros;
  minutes with leading zeros).
- **Hold and close:** reuse the existing hold-A and `CloseSequence` (as `menu_closing`), started from the
  SAVE end without the 5 copy frames.

## 6. Checkpoints (each: focused tests, typecheck, local commit)

### A5b7f1 — the START menu

1. **CP1 — trace, no code (complete; §10).** Write the numbers into this note (§4.1–4.4):
   - when the START border shows (the NPC opening model);
   - T+20/T+23;
   - the loop's per-pass cost;
   - the close (the original 4-frame assumption is **5**, and it is absent from `currentMapCloseFrames`; §4.6);
   - each §4.4 tail in frames, with sources.

   Check that `MenuInput` can report Up/Down hits and `wLastMenuItem`.
2. **CP2 — `StartMenuSession` (complete; §11).**
   - §4.1–4.3 and the redisplay API, plus `battleAndStartSavedMenuItem`.
   - Tests: open +20/+23 and the sound at +20; both layouts; the saved cursor across opens (within a
     session) and after the Pokédex is obtained (the raw index is kept, so it may point at a different
     entry: preserve it); the wrap rules including the "last ≠ 0" no-wrap; ▷ on A/B/START; silent START;
     the 5 close-copy frames; the empty-party redisplay.
3. **CP3 — integration and handoff (complete; §12).**
   - Wire main (§5), each §4.4 tail, and `openStartMenu`. Retire the legacy class.
   - Real-input dispatch tests through main (single-frame taps at 3 idle offsets).
   - A muted browser smoke on a spare port: open/close by B/START/EXIT; the cursor remembered;
     ITEM/POKéMON/POKéDEX/trainer card/OPTION and back; the bag still correct (A5b7c1); SAVE still reachable
     on today's legacy flow.
   - Docs, STATUS. Stop for review (user lifted checkpoint stops during CP3; continue CP4–CP5).

### A5b7f2 — SAVE

4. **CP4 — `SaveSession` (complete; §13).**
   - §4.5, `YesNoMenu` left, the colon glyph. Retire the legacy `SaveMenu` and the `save_menu` render path.
   - Tests:
     - S+45/S+48/Q+3 (CP1 correction); the info box cells, incl. 0 and 2–3-digit numbers and minutes 05;
     - NO and B close without saving and without returning to START;
     - YES writes exactly once at A0+25, before "Saving...";
     - 128 / 10 / the real save-sound wait / 30;
     - Hold A keeps the display; the close;
     - START's ▷ on SAVE visible under the info box and after the restore.
5. **CP5 — integration and handoff (complete; §14).**
   - Real-input dispatch. A muted browser smoke: SAVE YES → reload → CONTINUE at the same spot; SAVE NO; the
     save sound; walking after the close.
   - Mutation suggestions:
     - a write before YES, or two writes;
     - a redisplay of START after the save;
     - the YES/NO on the right;
     - an instant question;
     - a missing 128;
     - an outer press at the end;
     - ':' instead of $6D.
   - Docs, STATUS. Stop for review.

## 7. Gaps this slice keeps (each with a home)

| Gap | Home |
|---|---|
| **Older-file question** (`CheckPreviousSaveFile` compares the saved player ID). The engine has **no player ID** yet (`InitPlayerData`'s random ID; every OT ID is 0) | A4 (trades need real OT IDs), §9 Q2 |
| **Battle and the shared cursor:** battle zeroes `wBattleAndStartSavedMenuItem` at its start and stores its menu choice there, so START opens on the battle's last choice | A5c (battle menu), §9 Q3 |
| Submenu screens themselves (Pokédex, party screen, trainer card, options): their own openings, fades and inputs | their audits (the StatusScreen slice for STATS; J2 for the rest) |
| Play time: `TrackPlayTime` counts Game Boy frames and stops at 255:59; ours counts milliseconds | J2 |
| The `save` SFX bank in Oak's Lab, Viridian Forest and Diglett's Cave (Route 2) | V5 (already logged) |
| Link RESET entry, Safari steps | none (not in the game yet) |

## 8. User play-tests (after each review)

`http://127.0.0.1:5173/`, **Z = A, Enter = START, X = B**.

**A5b7f1 (START):**
1. Press START: the box appears, then a moment later the menu and its sound.
2. Move to ITEM, close with B (a beep), open again: the cursor is still on ITEM.
3. Close with START: no beep. Up on the top entry jumps to EXIT; down from EXIT goes to the top.
4. After choosing an entry, the arrow turns hollow (▷).
5. Visit the Pokédex, the party, your trainer card, OPTION and ITEM: each comes back to START with the cursor
   where it was.

**A5b7f2 (SAVE):**
1. START → SAVE: the info box (PLAYER/BADGES/POKéDEX/TIME), then "Would you like to SAVE the game?" types
   out, with YES/NO on the **left**.
2. NO: the menu closes completely (no START menu).
3. YES: "Saving..." for about two seconds, then "RED saved the game!", the save jingle, and the menu closes
   by itself.
4. Reload the page, CONTINUE: you're where you saved.

## 9. Decisions for the user (O-28)

1. **Split A5b7f into A5b7f1 (the START menu) and A5b7f2 (SAVE),** both as specified here, each reviewed and
   play-tested. *Recommended:* SAVE starts and ends through START, and note 43 already put the START audit
   here. The alternative ports SAVE alone on today's START, leaves START's look and feel to J2, and needs
   SAVE's ends adapted twice.
2. **The older-file question stays out** until a player ID exists. *Recommended:* A4 adds `InitPlayerData`'s
   ID (trades need OT IDs) and the question with it. This keeps #52's "no save-identity check" for now.
3. **The START menu gets the shared cursor byte now; battle wires it in A5c.** *Recommended:* A5c is
   battle's own presentation slice. Until then, a battle doesn't move START's cursor.
4. **Sol implements** (already your pick): f1 in three checkpoints, then f2 in two. Claude reviews each;
   you play-test each.

## 10. A5b7f1 CP1 result — Codex/Sol, 2026-10-15

**CP1 complete; trace only.** Starting commit `18700fe`. No runtime, test or
generated file changed. §4.1 pins logical border T, window T+3 / scanout T+4,
sound/items/cursor +20 and first read +23. §4.2 pins the 3-frame loop passes
and last-placed-row semantics. §4.3 proves the separate copy is missing from
the current close budget; it also corrects that copy from **4 to 5** explicit
waits. §4.4 records every submenu tail, including the missing ITEM return copy,
with CGB/DMG distinctions. §4.6 gives the symbol/ASM derivation and MenuInput
audit. The same copy correction is propagated to future SAVE opening anchors
and checkpoint expectations so CP4 does not inherit an off-by-one plan.

Validation: pret symbol sizes and final-zero copy branch independently checked
with a read-only scratch calculation; strict typecheck clean; existing focused
MenuInput/TextBox/map-sprite-set tests **62/62** (ROM-enabled, 3 files). Full
suites/build/browser were not rerun for this documentation-only checkpoint;
the unchanged full baseline is 1499/1499, no-ROM 1369/130. STATUS and this plan
committed locally, nothing pushed. **CP2 has not started. Stop here pending the
user's next instruction.**

## 11. A5b7f1 CP2 result — Codex/Sol, 2026-10-15

**CP2 complete; main integration remains CP3.** Starting commit `5ea60c7`
includes Claude's confirmation of the CP1 trace. Added `StartMenuSession`
beside the still-live legacy class, the WRAM-only shared saved START row,
`MenuInput.lastItem` (last cursor placement, updated on restart), and tile-only
screen snapshots for Buffer2. The shared close cost and bag are unchanged.

The session owns opening +20/+23, both layouts, the source priority/wrap/Delay3
loop, filled/hollow arrows, silent START, and its private five-frame close copy.
`frame(readJoypad)` returns submenu actions at dispatch. For B/START/EXIT it
returns `exit` only at C+5: CP3 must then start the existing shared CloseSequence
on that same CPU frame, **without adding another text-box copy**. `closing`
identifies the prefix; `paint()` retains the display throughout the later core.
The accepting input frame includes CloseStartMenu's second Joypad call; its
same-frame edge clearing means held EXIT A does not block the copy.

`buffer2()` returns a copied logical snapshot containing the hollow arrow;
`restore()` copies it with transfer off/on without moving the BG portion.
`redisplay()` currently implements the immediate RedisplayStartMenu primitive:
redraw, sprite update, filled saved-row cursor, first read +3. CP3 will add the
§4.4 tail scheduling/`redisplay(kind)` routing at the integration boundary;
empty-party return calls this primitive immediately. Suspended sessions do not
tick BG or read input, so the active submenu owns those operations. Rendering
never advances the session. Opening's explicit three-third copy is separate
from the disabled automatic transfer and does not reset its portion.

Tests: 15 new real-input session cases cover both layouts, border/sound/input
anchors, taps at three idle offsets, last-row wrapping and cursor erasure,
held-arrow suppression, unwatched-key Delay3, simultaneous A/Up priority,
A/B/START hollows/sounds/saved byte, all three five-frame closes, unchanged
shared close handoff, raw row persistence after Pokédex acquisition, bag reset
independence, empty-party redisplay and logical Buffer2 restoration. Two shared
MenuInput cases protect last-placed state on watched/unwatched movement.

Validation: full ROM **1516/1516** across 84 files; no-ROM **1386 pass / 130 skip**;
strict typecheck and production build pass. No generated changes. Browser and
real-input **main** dispatch checks remain CP3 because the new session is not
yet wired. CP3 also owns cursor reset on new game/load and legacy retirement;
SAVE remains CP4–CP5. **Stop here pending the user's next instruction.**

## 12. A5b7f1 CP3 result — Codex/Sol, 2026-10-15

START is integrated into main from both ordinary and script opening paths.
The legacy class/export is retired. START owns its actual reads and sprite
hooks; main no longer syncs away its input or duplicates its UiEntry update.
The shared WRAM cursor resets on new game/load, never in save data or bag slot
removal. Its close remains in start_menu during the private five-frame copy,
then enters menu_closing at C+5 and the unchanged shared core returns at
C+10+2W. This keeps exactly the CP1 timing without a duplicate copy/read.

`redisplay(kind)` owns every §4.4 CGB tail and enables input three frames after
redraw. Party: white/Delay3, player+font 21, Buffer2 at +24, textbox copy through
+29, palette/final delays through +35. Trainer: white/font 17, Buffer2/palette
through +20. ITEM/OPTION: restore and disabled copy 5. Dex: restore/Delay3 3.
The party/trainer palette stays white until the tail completes; existing
dex/options screens stay painted during their return waits. The bag is unchanged:
main shares its VBlank with the START layer and retains its departing scanout
while the five-frame copy stops transfer. SAVE is reachable through its existing
flow and temporary immediate START redisplay until CP4 replaces it.

Verification adds 31 cases: 25 through actual main (including single-frame
taps at all three idle offsets after each return), five tail/transfer cases,
one retained overlay case. Existing Pikachu coverage tests now open the actual
session. Tests use a Vitest-only transform to expose main bindings and omit
automatic startup, with no shipped test API. ROM **1547/1547** (85 files),
no-ROM **1417 pass / 130 skip**, strict typecheck/production build pass.
Four temporary mutations were caught and restored: competing START sync,
omitted cursor resets, duplicate UiEntry update and a four-frame ITEM tail.

Muted browser on fresh :5187 storage passed B/START/EXIT closes, remembered raw
cursor, dex/party/item/trainer/options and back, legacy SAVE NO, unchanged bag
quantity and walking after close; zero page exceptions. Playwright routed a
temporary hook into main; no hook shipped and :5173 storage was untouched.
Screenshot inspected: `%TEMP%/pkmn-cp3-start.png`. An initial repeat smoke hook
missed Vite's timestamped main URL; broadening its route fixed the harness.
No generated files changed. Local commit only. **The user lifted checkpoint
stops during the handoff: continue CP4–CP5 without waiting for confirmation.**

## 13. A5b7f2 CP4 result — Codex/Sol, 2026-10-15

SaveSession replaces legacy SaveMenu/export/main path and shares START's
tiles/Buffer2 with standalone typed TextBox programs. Implements §4.5's
+5/+45/+48, left YES/NO/Delay3/15, write at A0+25 before SavingText, 128,
GameSavedText, 10, prior-sound/save-sound waits, 30, Buffer2, held-A polls and
direct shared close. No fresh outer press, START redisplay or extra START
close copy. Retained question text clears when the restored bottom transfers.

Shared YES/NO defaults unchanged; SAVE selects left position. TIME colon is
font_extra tile 13 ($6d), rather than ASCII ':'. PlaceString's source `#DEX`
expands to POKéDEX. Older-file/player-ID question remains A4 as approved.
Ten new cases cover number cells 0/12/151/255 and minutes 05, opening/write
anchors, left chooser, NO/B, write once/order, 128/10/controlled sound/30,
restored hollow SAVE and held-A release. Focused **103/103**, ROM **1557/1557**
(86 files), no-ROM **1427/130**, typecheck/build pass. Local commit, no
generated changes. Continuing CP5 under the user's lifted checkpoint stops.

## 14. A5b7f2 CP5 result — Codex/Sol, 2026-10-15

**A5b7f implementation complete; ready for review and user play-test.**
CP3 is `86a990e`, CP4 `d413bf2`, CP5 this handoff commit. The user explicitly
lifted checkpoint stops and authorized continuing through completion.

Six added main-dispatch cases exercise actual input/storage: YES taps at three
idle offsets, the sole write at answer+25, serialization and reload at the
same coordinates, NO/B with no write, held-A restore/release, and the direct
seven-frame Red's Room close without START redisplay or its copy prefix.
Tests still assert one input owner and at most one BG tick per frame.
Full ROM **1563/1563** across 86 files; no-ROM **1433 pass / 130 skip**;
strict typecheck/production build pass. No generated or save-schema changes.

Nine temporary SAVE production mutations were caught and restored: write
before YES, duplicate write, START redisplay at the end, right-hand chooser,
question one frame early, 127 instead of 128, outer acknowledgement required,
ASCII colon and final wait 29 instead of 30. Alongside CP3's four, thirteen
regressions were caught. The final full suites/build ran after restoration.

Muted Chromium on fresh :5187 storage passed: source info/typed question and
left chooser; exactly one write at +25; actual audio engine unlocked with
muted output; waiting for current sound then the extracted save jingle; 30 and
automatic close; page reload, actual title/main-menu CONTINUE, same map/x/y;
NO with identical saved bytes; held-A retains hollow SAVE until release;
walking after close. Zero page exceptions. The audio-wait phase took 25
sampled wall-clock audio polls (not a hardcoded jingle duration).
Screenshot `%TEMP%/pkmn-cp5-save-question.png` inspected: correct info labels,
left YES/NO, narrow colon, hollow SAVE underneath and typed question.
Temporary main/audio/storage hooks existed only through Playwright routing;
no hook shipped, and the user's :5173 save was untouched.

All five checkpoints are implemented; both legacy classes are retired. The
approved gaps remain §7 (older-file identity A4, battle cursor A5c, submenu
internals and frame-counted play time J2, save SFX bank lookup V5). No A5b7g
work started. **Next: review, then the user's §8 play-test.**
