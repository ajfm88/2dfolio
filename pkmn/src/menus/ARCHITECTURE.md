# Menus Architecture

## Pattern

Each menu is a class with `update()` and `render()` methods. State transitions are managed by `main.ts` (the game state machine dispatches to the active menu). Shared rendering utilities live in `menu_render.ts` (`drawBox`, `drawText`).

## START session (A5b7f1 CP2–CP3)

`StartMenuSession` replaces the legacy `StartMenu` in main. It uses `ScreenTiles` and actual-read
`MenuInput`: source opening sound/labels +20, first read +23, immediate
redisplay/read +3. WRAM-only `battleAndStartSavedMenuItem` survives opens
without index adjustment when the Pokédex appears. `MenuInput.lastItem`
records cursor placement before movement for START's special top wrap.
Bag slot removal leaves this byte alone; new game/load reset it to zero.

The session owns the five-frame START-only text-box reload. Its close returns
`exit` after that prefix; the host then starts the unchanged shared close core.
`buffer2()`/`restore()` use tile-only snapshots (including the hollow arrow),
separate from the TextBox-bearing Buffer1 snapshots. `redisplay()` is the direct
redraw primitive; `redisplay(kind)` schedules the START-side CGB tails:
dex 3, party 35, item/option 5, trainer 20, then Delay3 before input.
Party/trainer hold white until completion; dex/options retain their legacy
screen until the tail returns. ITEM's visible tiles are retained during its
five disabled-transfer frames, then restored START thirds replace them.
Active frames own one automatic-transfer tick; suspended frames and `paint()`
own none. Main mirrors the bag's existing tick into the retained START layer;
it never ticks transfer twice. START calls the font-loaded sprite hook itself
at opening and redraw; UiEntry still latches these transitions without adding
a duplicate hook.

## SAVE session (A5b7f2 CP4–CP5)

`SaveSession` replaces legacy SaveMenu and draws into START's tile layer.
Info opens with five disabled-copy frames and 30+10 waits; typed standalone
PrintText starts +45, first glyph +48. YES/NO uses `position: 'left'` at (0,7),
leaving default/nurse placement unchanged. TIME uses `TIME_COLON_GLYPH` from
font_extra tile 13. Source `#DEX` expands to seven visible POKéDEX glyphs.

YES invokes main's existing write at answer+25 before SavingText, then waits
128, types GameSavedText, waits 10/current sound/save sound/30. Both answers
restore hollow SAVE Buffer2 and poll held A. Release returns close directly
to the shared core without a START copy or redisplay. TextBox/tiles share
one BG tick and input owner; main skips its generic sync and UiEntry update.
Main integration tests drive actual storage and reload. The Vitest-only entry
transform exports lexical bindings and skips RAF startup; no testing API is
present in the production bundle. Both SAVE outcomes use the shared close cost
without START's five-frame prefix; main retains the save display until the
close hides the window and dismisses the message box at completion.

## Static glyph rendering (A5b7a)

`drawText` and `textWidth` use charmap's `tokenizeGlyphs`, sharing the printer's
`textGlyphAt` contraction rule. `'d 'l 's 't 'v 'r 'm` each occupy one tile;
spaces/unknown glyphs advance without drawing. `drawChar` selects font_extra for
curly quotes, middle dot and ellipsis; regular font tiles supply contractions,
PK/MN, ASCII and cursors. Static labels draw immediately and do not interpret
control spellings such as `<DONE>` as commands.

`textWidth` returns unscaled game pixels. Later caller migrations should use it
instead of character counts for alignment; A5b7a does not mass-edit existing box
dimensions or `.length` uses. The battle UI's private text renderer remains
unchanged until A5c; menus shared with battle (including PartyMenu) use this
common glyph renderer. `menu_render.test.ts` checks actual Canvas tile calls,
sheet selection, spacing and scaling (6 tests).

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `start_menu.ts` | — | Retained START opening/input/wrap/close and submenu-return tails |
| `party_menu.ts` | — | Party list/switch and battle adapter; StatusScreen and shared-opening handoffs |
| `party_menu_opening.ts` | — | Shared DisplayPartyMenu timing and prompt for START, STATS return and field medicine |
| `party_icons.ts` | 142 | Party menu Pokemon icons: species-to-sprite mapping, 2-frame animation, HP-based speed |
| `field_medicine.ts` | — | Field ItemUseMedicine: white party menu, heal effect, HP bar, return to the bag |
| `pokemart.ts` | 359 | Viridian Mart: DisplayPokemartDialogue |
| `list_menu.ts` | — | DisplayListMenuID: priced, item and Pokémon lists |
| `menu_glyphs.ts` | — | Palette-aware opaque menu glyphs; identifiers in `menu_glyph_ids.ts`, party/status sheets in `party_tile_sheets.ts` |
| `quantity_menu.ts` | 74 | DisplayChooseQuantityMenu |
| `screen_tiles.ts` | — | Borders, PlaceString, BCD/PrintNumber cells, shared PrintLevel, retained thirds and Buffer1 |
| `pc.ts` | — | Retained Red/Pokécenter PC, item storage, Oak and Bill handoffs |
| `menu_session.ts` | — | Shared retained-menu host contract (Mart and PC) |
| `toss_item.ts` | — | Shared TossItem_ protection, confirmation and selected-slot removal |
| `bills_pc.ts` | — | Source Bill's PC on the retained display: withdraw/deposit/release/stats/change box/print box |
| `pc_display.ts` | — | Shared PC PrintText, sound waits, delays and cursor operations |
| `status_screen.ts` | — | StatusScreenSession: retained stats pages for party, battle and Bill's PC |
| `party_tiles.ts` | — | Legacy party HP/LV drawing over shared `party_tile_sheets.ts` assets |
| `pokedex.ts` | 614 | Pokedex list, data (height/weight/description), area screen (town map + nest icons) |
| `trainer_card.ts` | 311 | Player card: name, money, time, badges, Red sprite |
| `town_map.ts` | 151 | Map overlay |
| `title_screen.ts` | 283 | Title screen: Pokemon logo + Pikachu with eye blink animation (3-state OAM sprites) |
| `oak_speech.ts` | 590 | Oak intro: portrait fade/slide, Pikachu reveal, player/rival naming, shrink animation |
| `naming_screen.ts` | 255 | Full keyboard: upper/lower/symbol grids, ED submit button, auto-case toggle |
| `main_menu.ts` | 81 | CONTINUE / NEW GAME / OPTION (save-aware) |
| `option_menu.ts` | 159 | Settings: text speed, animation, battle style, sound |
| `save_menu.ts` | — | Retained SAVE info, typed confirmation/results, source waits and held-A return |
| `yes_no_menu.ts` | 53 | Yes/No prompt |
| `menu_input.ts` | 101 | HandleMenuInput_; blackboard, name menu, and the Mart list |
| `menu_render.ts` | 56 | Shared: drawBox, drawText utilities |

## Retained yes/no choices (A5b5c)

`YesNoMenu` with `actualRead` uses HandleMenuInput's Delay3: first Joypad read
at opening +3, then one per frame until a new key. Any non-A/B key re-arms
three frames. A/B plays the sound and keeps the menu/cursor visible for 15
frames without reads; B chooses the second answer even with A pressed too,
while the drawn cursor stays where it was throughout the tail.
The 15th tick returns into the selected script branch. HEAL/CANCEL uses
the Pokécenter layout. The legacy script `yesNo` command is retired (A5b6).
The menu's own sprite update remains J2.

## HandleMenuInput and Oak speech (A5b6)

`MenuInput` waits Delay3, then reads once each frame. Up/Down do not wrap;
any unwatched key re-arms Delay3 silently. A suppresses Up/Down; a watched
A/B returns with press_ab, with no yes/no tail. `watchOutOfBounds` and
`repeat` default off, so the blackboard and Oak's name menu are unchanged.
The Mart list turns both on: Down past the last row is returned, and a held
Down repeats. The repeat counter keeps elapsing during Delay3. The blackboard
is now a script handler using this port; its old menu class/state are gone.
LinkCableHelp is deferred pending a link-features decision.

`OakSpeech` executes seven standalone source programs: box at T, first glyph
at +3, retained through fades, menus, preset slides and shrink until ClearScreen.
OakSpeechText2 includes 2A, the declared PIKACHU cry cue (playback/wait J2), and 2B.
Text3's done starts shrink in its return tick without another press or beep.
Custom names return through ClearScreen's 3 frames plus Delay3: box +6, glyph +9.
The name menu watches A only, max 3, cursor at (1,2); B re-arms silently.
Animation timings, sounds and picture positioning await the approved intro slice.

## Poké Mart (A5b7b)

`PokemartSession` replaces `ShopMenu` and the shop state. The Viridian clerk's
second text table, after `OAK_GOT_PARCEL`, runs the `mart` script.
BUY/SELL/QUIT and the MONEY box are drawn on the clerk's display. The session
and the message box share one VBlank tick; a disabled transfer holds its
portion. Buffer1 restores the screen under a list, including the message box,
and does not restart a program.

Buying adds the item before taking the money. The MONEY box keeps the old
amount until the list comes back. Selling adds half the total, capped at
¥999999, redraws the MONEY box, then plays the purchase sound and removes that
slot when the sound ends. There is no sold message. A key item or HM01–HM05
prints "I can't put a price on that." and returns to the menu. The quantity
box is silent. YES/NO is the existing menu at (14,7) and draws immediately.
The list's ▼ stays steady; its blink is J2. Selling a whole stack zeroes
`wListScrollOffset`, `wCurrentMenuItem`, `wBagSavedMenuItem` and
`wSavedListScrollOffset`, so the sell list reopens at the top and QUIT
restores 0.

## Bag (A5b7c1)

`BagSession` is the `item_menu` state. START → ITEM opens the shared list on
`wBagSavedMenuItem` and `wListScrollOffset`. USE/TOSS is HandleMenuInput at
(14,11); B is tested before A, so A+B cancels. Toss uses the plain quantity
box, then `IsItOKToTossItemText` and YES/NO. A key item or HM skips the
quantity box. Balls print `ItemUseNotTimeText`. OAK'S PARCEL prints
`ItemUseNotYoursToUseText` ("This isn't yours to use!").
The Town Map returns through `ItemMenuLoop`. Medicine runs `FieldMedicine`:
a white party menu, then the heal, then a white return to this list.
Its party menu (`PartyMenu` useItem mode) reads the joypad itself every frame with
`readJoypad`/`isPassPressed` (HandleMenuInput_ `.loop2`); only a key it does not watch (not
A/B) re-arms Delay3. A suppresses Up/Down and B wins over A. Never poll it less often:
`isPressed` is a one-tick edge, so skipped frames lose presses (note 46 F-1). From the choice
until the result redraw, the target row is drawn from a frozen picture
(`PartyRowOverride`): `UpdateHPBar2` changes only the bar tiles and the HP number, while the
bar color (a palette, `SetPartyMenuHPBarColor`) and the status text change at the redraw (F-2).
The chosen row shows ▷; the redraw erases the cursor. The bag's `present()` ticks the text
box for every field-medicine PrintText; nothing else does (F-3).
`PartyMenuOpening` shares DisplayPartyMenu's white Delay3, four HP/status-copy waits,
ClearScreen Delay3, CGB palette Delay3, no-delay PrintText and final Delay3. Its
host advances VBlank once before its CPU-only `frame()`: the bag during medicine,
`present()` during standalone PartyMenu. START → POKéMON and medicine reveal C+19,
then read C+22. Overworld STATS returns into it at Q+3, hence reveal Q+22/read Q+25.
The prompt's standalone TextBox is created C+13, completes C+16, and is dismissed
C+19 when the legacy party renderer retains those same program-derived lines.
Main skips its generic input sync during the opening, and the accepting frame
uses the real read's edges; later party-list/submenu input remains the J2 adapter.

Medicine's result redraw adds CGB palette E+4..E+6 before PrintText at E+6;
the complete result/transfer-on is E+9. Its 50-frame hold returns directly into
the first silent read at E+62. Medicine's conditional default palette adds three
frames before START's existing 35-frame restore: list entry P+39, bag visible
P+51, first read P+54. Transfer is disabled for copy waits P+7..P+32, then again
for the list's initial wait. Main copies the white flag after the bag update so
the visible frame agrees with the session. Original medicine assertions remain;
tests now include exact per-frame ownership/phase checks and a real no-effect return.
`ItemMenuLoop` leaves the message up until the
next bottom-third transfer. Leaving the bag turns the transfer back on.

## PCs (A5b7d)

`PcSession` shares the script controller's single `MenuSession` slot with the
Mart. The host advances its text and BG transfer once per frame; rendering does
no ticking. `renderMenuSession` uses opaque `drawScreenTile` cells, including
spaces and the six border tiles from font_extra. Bag tiles use the same painter.
The static `drawText` API remains transparent. This fixes the invisible menu
found in the CP5 browser smoke without changing transfer timing.

RED_PC and POKECENTER_PC hidden events dispatch `displayOpen`, `pc`, then
`displayClose` with no outer wait. Red has an automatic box; Pokécenter does not.
Both start turn_on_pc at T+20 and the first typed glyph at T+23. The latter
waits for sound after its prompt, restores the box-less Buffer2 and waits three
frames before DisplayPCMainMenu. Each redisplay starts at row 0, with three or
four entries according to GOT_POKEDEX and SOMEONE/BILL according to MET_BILL.

PlayerPCMenu restores Buffer2, remembers its parent choice, sets the shared
no-text-delay flag on every pass, and uses silent MenuInput/ListMenu/QuantityMenu/YesNoMenu.
Text prompts still beep. WhatDoYouWant's first read is +6; the first branch's list
reads at +19. ListMenu sets the flag on entry and clears it on choice or cancel;
YesNoMenu clears it before its initial Delay3. Quantity questions, results, errors
and retry questions therefore type until PlayerPCMenu is reentered. At fast speed,
HowMany's nine glyphs finish with quantity drawing at +12 and input at +13.
ExitPlayerPC clears the flag, including the nested return. A selected slot adds to the destination before
removing from the source, preserving duplicate IDs and atomic failures. Transfer
waits for current sound, then withdraw_deposit, before its result program.
Toss shares the bag's confirmation/removal helper, but its YES/NO is silent.

Direct exit plays/waits turn_off_pc, restores the empty-box Buffer2 and zeros
the list offset/bag cursor before Hold/close. Nested item-PC exit skips power
cycling and reloads the top-level menu. Oak runs its typed preamble, silent
YES/NO and waitbutton closure; DisplayDexRating remains the approved gap.
Bill's source preamble enters `BillsPc` on the same display (A5b7e). Only STATS
uses the full-screen handoff. Legacy PcMenu, PokecenterPcMenu and BillsPcMenu,
their actions, states and bridge fields have been deleted.

Tests: `menus/pc.test.ts` (30 real-input flows), `story/pc.test.ts` (13 production
hidden-event/controller flows with transfer/input ownership assertions), shared
toss tests (5), silent-choice timing and opaque-cell rendering regressions.

### A5b7e CP2 shared foundations

`ListMenu<'mons'>` takes `{name, level}` entries, returns index/name choices,
prints names at column 6 and levels one row below at column 14. PrintLevel's LV
tile is followed by left-aligned digits at 15; three-digit levels overwrite LV
from column 14. SELECT redraws without changing the entries. Existing scrolling,
CANCEL and +16 first-read behavior are shared with item lists. `MenuInput.rowStep`
defaults to 2; the box chooser uses 1, with unchanged input timing.

`menu_glyphs.ts` loads LV from battle_hud_1 tile 1 through the monochrome font
loader, and the ball from balls tile 0 through the palette-aware 2bpp loader.
`drawScreenTile` paints them over opaque cells. Text initialization and border
palette reload refresh these assets. `pokemon_names.ts:monDisplayName` centralizes
uppercase display names for party, medicine and Bill's lists/bindings;
saved nicknames retain their original case (full MonsterNames handling is V5).

`pokemon_storage.ts` owns BoxedPokemon, the unchanged serialization helper,
12/20 capacities and the boxed species-only starter stand-in (OT checks A4).
Main's `writeSave()` contains the former START save arguments verbatim and is
also supplied to `PcStorage.saveGame`. The following-disabled callback returns
false until V2.

### Bill's PC (A5b7e complete, awaiting review/play-test)

`BillsPc` owns the six-entry menu, BOX No., mon lists and deposit/withdraw
submenu. `PcSession` delegates frame/text/overlay work while Bill's PC runs.
`PcDisplay` implements both PCs' PrintText, cursor and actual sound waits once.
PrintText opens the box, invokes the PC sprite callback, then waits Delay3 before
glyphs. Bill sets no-text-delay once on entry; lists and YES/NO clear it for the
remainder of that visit. Menus are silent; text prompts still beep. Cries/PCM
playback are declared stubs, without invented waits (J2).

Entry copies HP/status tiles for four frames and a ball tile for one: layout
+5, cursor +8, first read +11. Later Bill-menu passes add one copy frame, then
Delay3 plus input Delay3: first read +7. List and submenu first reads are +16
and +3. The parent row persists inside the visit and starts at 0 next visit.
Every Bill-menu pass resets list offset and party/Bill saved cursor to 0; the
entry's saved list offset is popped on exit. Thus a subsequent PartyMenu opens
at row 0; its existing clamp remains a defensive guard (N-4 closed).

Transfers append the destination before removing the selected source. Deposit
checks party count 1 before box count 20, permits a fainted last-but-one, and
applies DEPOSITED only to the starter. The following-disabled branch is wired
but inactive until V2. Starter release is refused. Other release asks YES/NO;
NO reopens the list on the same row/offset with the stale question still up.
YES removes after the answer's 15-frame tail and waits for actual sound before
the result. Deposit/withdraw play no item-transfer SFX. Reconciliation of the
follower occurs at result PrintText, before glyphs; see Pikachu architecture.

STATS uses `StatusScreenSession`, shared with overworld and battle party menus.
Box STATS deserializes a temporary mon and never changes the box. The session
owns one ScreenTiles and one BG-transfer tick per active frame. `PcSession`
forwards `ownsBgTransfer` so the script host skips its text/display tick, including
the session's last frame. Selection S starts white and reduces NR50 to (3,3).
Page 1 reveals S+20; the mirrored, padded picture's seven copy waits end at S+27,
the first read. Its marker cells reveal by transferred thirds, never by rendering.
Fresh A or B silently advances; page 2 waits three frames before reading again.
The last press Q restores NR50 (7,7), whites out and clears. Buffer1 restores at
Q+3 with STATS selected; Bill remains full-screen white until LoadGBPal at Q+6,
and first submenu input is Q+9. Since CP4, overworld party enters the shared
opening at Q+3 and reveals Q+22/reads Q+25 on the same mon. Battle still returns
to its existing list at Q+3; its enemy-picture reload belongs to A5c.

Change Box warns, clears text delay at YES/NO, then types ChooseABoxText while
BG transfer remains disabled. Its 15 glyphs finish before chooser layout and
transfer-on: medium C+48/read C+51. The chooser uses single-spaced BOX 1–BOX12,
right-aligned current number and a 2bpp ball on nonempty boxes. B or warning NO
does not save. A keeps the filled arrow, waits for current sound, plays/waits
save, switches the current box (including same-box A), then calls `writeSave`
through PcStorage. There is no save message. PRINT BOX has the empty-box prompt;
the nonempty printer screen remains J2 and returns directly. B/SEE YA! restores
Buffer2 and the saved list offset, clears text delay, and returns to top-level
PC row 0 without a power-off sound.

Tests: `bills_pc.test.ts` 28, `status_screen.test.ts` 30, actual PC controller
flows in `story/pc.test.ts` (16), actual party/battle dispatch in `main.test.ts`
(44), and six follower lifecycle cases. The active session or its text host
owns each BG-transfer tick; rendering does not tick or read input.

CP5 verified the actual Canvas output in muted Chromium on a fresh spare-port
origin (5193). Pikachu's 40 px picture mirrors at (16,16), Ivysaur's 48 px at
(8,8), Charizard's 56 px at (8,0). Both pages were inspected visually and the
full padded picture region matched an independent full-PNG mirror/palette remap
pixel for pixel, including shade-0 padding. Bill's party and box paths, voluntary
and forced battle party paths, and field Potion use/return passed with no page
errors, failed asset requests or save writes. Browser-only response interception
provided staging/frame controls; no fixture hooks exist in the production source.
The NR50 dip/restore also reached the native master GainNode's automation.
The muted check verifies those writes, not audible loudness. See note 58 §16
for the screenshots, harness, fixture boundaries and two complete gate runs.

V2c CP4 adds the sleeping-starter branch before ordinary and SWITCH-target selection:
`PartyMenuText_12cc` runs as a standalone PrintText with its native prompt wait, then
clears the swap source and returns cancellation. START's party menu owns that TextBox;
field medicine supplies the bag's shared TextBox, whose VBlank/input reads stay with
the bag. The selected item and Pokémon remain untouched. Only the sleeping starter's
row skips its icon; other rows keep their positions. Battle selection/icons retain
their existing behavior. The rest of the party-list audit remains J2.

## Assembly Layout References

For pixel-precise layout specs from assembly source, see `pokeyellow/ARCHITECTURE.md` (Assembly UI Layout Specs section). Key references:
- Pokemart: `data/text_boxes.asm` `BUY_SELL_QUIT_MENU_TEMPLATE`
- Save screen: `engine/menus/save.asm` + `main_menu.asm`
- Option menu: `engine/menus/options.asm`
- Item bag: `data/text_boxes.asm` `LIST_MENU_BOX`
- Trainer card: `engine/menus/start_sub_menus.asm` + `engine/menus/draw_badges.asm`
- Naming screen: `engine/menus/naming_screen.asm`
- Pokedex: `engine/menus/pokedex.asm` + `engine/items/town_map.asm`
- Title screen: `engine/movie/title.asm` + `engine/movie/title_yellow.asm`
- Oak speech: `engine/movie/oak_speech/oak_speech.asm` + `oak_speech2.asm`
- Bill's PC: `engine/pokemon/bills_pc.asm`
