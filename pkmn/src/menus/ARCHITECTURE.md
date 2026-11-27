# Menus Architecture

Repel, Super Repel and Max Repel use their 100/200/250-step field effects in BagSession. The item-use program binds the selected item name; the heal-ailment sound and scroll-button wait precede removal of one item from the selected stack and the ordinary ItemMenuLoop return.

A2 checkpoint-04c adds a field machine-use session owned by BagSession. It
drives the boot and teach text, YES/NO and the TM/HM party chooser, including
per-species ABLE labels and retry messages, before delegating successful
choices to the shared FieldLearnMove frame adapter. The machine session owns
the single BG/input tick while active; the bag resumes after it finishes. A
successful TM use removes one item, while HMs and unsuccessful attempts are
retained. Starter Pikachu's USEDTMHM event and Thunderbolt/Thunder mood are
applied only after success. Field audio now preloads SFX_DENIED in banks 02/1f.

The battle-prompt checkpoint (note 102, user-verified) passes the menu type at `openBattleChoice` / `goBackToChoice` to one `listMessage` for opening, redraw and retained text: NORMAL for PKMN, BATTLE for faint replacement and SHIFT; `show()` resets it to normal, and battle context binds the byte through `A.wPartyMenuTypeOrMessageID` at `$D07C` without moving any timing.

V5f checkpoint-02 (2026-11-14, note 97, #125) adds `ItemMenuLoop`'s missing default-palette
command on every ordinary return to the field bag: two held frames, then three ordinary
frames, before `DisplayListMenuID`. The list border is logical at R+5, entries print and
transfer enables at R+15, and the first list read is R+21. Initial entry still builds the
list at S (first top-third copy S+11 when the portion is 0, first read S+16). Medicine's
return calls `itemMenuLoop(false)` and keeps its own timing. Checkpoint-01's hold
(`core/vblank_hold.ts`) still covers START's party/trainer returns, field medicine and
Bill's PC.

V5f checkpoint-03a (reviewed and user-verified 2026-11-14, note 98 §11, #126) holds the full `DisplayPartyMenu` in every host.
Field and battle full openings, and field medicine's opening, reveal at C+21 and take
the first read at C+24. A field-owned opening arms `holdVBlank()` at CPU age 10; its
standalone `present()` consumes the two held frames, and the bag already consumes them
during medicine. A battle-owned opening exposes `paletteCommandDue` at age 10 and never
touches the field counter. `advanceBattlePartyFrame` runs `setPalPartyMenu()` for PKMN,
SHIFT and faint. Battle medicine keeps its existing `setPalPartyMenu()` timing (reveal 21,
read 24) and does not arm the field hold. `GoBackToPartyMenu` now first reads at R+18
(03b, note 99; user-verified). `partyPaletteDue` exposes redraw
age 4 as well as the opening boundary; the shared `advanceBattlePartyFrame` runs the palette
generator for PKMN, faint replacement and SHIFT, with R+5..6 held and no field hold.
Field submenu returns remain unmodelled (J2).
StatusScreen now first reads S+29, with S+15..16 held (03c, note 100;
user-verified). `StatusScreenOptions.paletteOwner` defaults to `field`: the session
arms the field hold after S+14 and takes those two frames instead of presenting. START's
party and Bill's PC already leave the BG tick to the session. Battle PKMN passes `battle`:
`advanceBattleStatusFrame` runs `BattleScreen.setPalStatusScreen` once, installing the HP-bar,
mon, ROUTE and ROUTE palettes, yielding two held frames and three session frames. Battle
frames never touch the field counter. Page 2 and all P/Q return timings are unchanged.

V5e checkpoint-01 shares the single `MonsterNames` copy in `battle/data.ts` through `speciesDisplayName` for the Pokédex and field status page 2. The Pokédex fetches two tables of its own (note 95).

A5c3f checkpoint-10f adds optional `StatusScreenSession` option `page2Name`. It is called
at page2's name placement, never during construction/page1. Only the battle session supplies
it through its existing createStatusScreen seam: internal species → wNamedObjectIndex →
GetMonName → decoded wNameBuffer. Field callers retain upstream page2 names until V5.
Page1/nicknames and timing are unchanged; note72 §10.27 records WRAM/Pay Day controls.

A5c3f checkpoint-08e adds two stand-in entries under O-45.2, without changing callers.
NamingScreen's nickname mode requires a subject, permits ten letters and an empty submit,
draws the species/header and full-HP party icon, and accepts the caller's pressSound.
Its eleven-cell stringBuffer retains letter/@ writes and uses null for untouched cells.
Player/rival behavior and the Pokédex list are pinned by pre-edit full-trace hashes.
PokedexMenu.load preloads tables/tiles; showData takes the caller's owned flag and sound,
then closes to that caller. show clears that state and retains the list's side-menu return.
Front-sprite loading stays asynchronous. These remain stand-ins: the screen-frame, input,
auto-lowercase, cry and volume departures await J2. The catch wiring/outer frames are08f.
Evidence: note72 §10.16.

A5c3f checkpoint-08d gives PartyMenu an optional TextDisplayHost constructor argument for
openingTextBox. The unused battle session shares its own text/audio host with BattleMenuScreen;
AlreadyOutText, NoWillText and the existing sleepingText fallback inherit that owner. Field
callers pass nothing and keep their default facade. Foreground observation stays in the session
subclass, with no other PartyMenu API or renderer change. Note72 §10.15.

## Pattern

A5c2 CP5 adds PartyMenu's unused `openBattleChoice` / `goBackToChoice` API and `frameBattleChoice`.
The original timing was C+22 and redraw16 (ASM24/18; #73); V5f 03a/03b now provide C+24/R+18 as above. The mode reuses the common item chooser's wrapping, raw
B-over-A rule, cursor save and sleeping-starter rejection, with a force-A-only watch. `choiceOverlay` retains
opaque submenu/clear writes over the existing pixel list and copies one third per session frame; its null cells
show that list. Legacy battle/battle_forced modes remain unchanged. `battle/battle_party_menu.ts` owns the
SWITCH/STATS/CANCEL logic. Refusal PrintText commits its border/glyphs into the retained layer before dismissal;
the shown thirds stay frozen through GoBack's HP-copy4 and release on actual transfers. The underlying pixel
party-row partial redraw limit remains #74. CP5's two completion fixes and passing gates are in note67 §11.18.

`tile_surface.ts` holds shared tile/number/string writers and cartridge cursor routines. ScreenTiles keeps
its methods as delegates and owns retained/visible copies; ListMenu accepts the structural TileSurface.
The battle adapter preserves numeric cells/string glyphs with explicit opaque clears. A5c2 CP3's move chooser
uses this seam but is not wired into the game (note 67 §11.12).

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
Custom names return through ClearScreen3 + Delay3 + picture-copy7: logical box/pic IDs +13, glyph/read +16;
scanout follows the inherited third (+19/+18/+17 for the first glyph at p0/1/2).
The name menu watches A only, max 3, cursor at (1,2); B re-arms silently.
The note64 CP4 generator mirrors the ASM routines; each yield is one VBlank, followed by CPU work. Only
`IntroScreen.vblank(box, printing)` advances display/text; PrintText captures its CPU border immediately.
Inspection returns defensive snapshots of CPU/visible maps, slots, registers, shared phase, text/menu, OAM
and speech audio requests. Its frame count pauses while the naming screen owns the clock.

Main holds the menu20 before priming the speech at F20 (SA + PM Routes2). `MainMenu.saveTiles()` seeds the
visible map so ClearScreen removes the menu in thirds. The speech owns register fades/window movement,
shrink's two seven-batch wipes, its same-tick sound at R, and fade control10 at R24. Sprite preparation at R49
produces shadow at R50 and first DMA-visible Red at R51, drawn after BG shading through cached OBP0 variants.
It dismisses the box R123 and returns R126. Main loads during white40, then today's map entry/music at R166,
or later if loading is not ready. Both holds read no input. The existing down-facing map entry is unchanged.
Pictures/border/OBJ variants preload in MEWMON; `useBorderTiles` synchronously selects the cached border.
Routes2 warms after audio unlock, before the title, so E2's request uses cached music. No async load is awaited
inside the speech program.

### Intro screen model (note 64 CP3–CP4)

`intro_screen.ts` has a separate 20×18 logical/visible map: strings are glyphs, numbers are vFrontPic IDs.
It reuses ScreenTiles' glyph writers via temporary write buffers, preserving the other menus' string/null
snapshot contract. Its 49 slots hold picture names and column-major source tile IDs, so replacing eight slots
per VBlank produces the shrink wipes. `copyVideoData` yields seven waits with transfer off and restores the
caller's enable state on return/cancellation. `placePicture` writes IDs only after the caller finishes the copy.
`slidePicture` performs the literal 125-byte move, including tile-zero quirks, resetting the shared portion for
each of six three-frame steps. ClearScreen/clearArea are CPU writes; callers own their following waits.

`vblank(box, advanceText)` uses the existing `textBgTransfer`: it copies the selected third and any VRAM batch
before resuming CPU text. An active standalone TextBox owns that one tick via update/updateDisplay; otherwise
the model ticks it. Never tick the box again in the caller. `captureText` imports logical text/border writes
without a transfer (also call after starting PrintText in the CPU program). `clearScreen`'s caller dismisses
the retained box. `cells`, `visibleCells`, `slots`, registers BGP/OBP0/WX and cell readers support inspection;
rendering uses only scanout/current VRAM. No second portion counter exists. Optional constructor cells seed
the menu handoff. `adoptBlankWindow()` represents the opaque naming exit's already cleared scanout without
resetting front slots or phase; it consumes no speech VBlank.

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
The Town Map returns through `ItemMenuLoop`, which now pays the five-frame palette
command before the list exists. An ordinary return keeps the old shown tiles through
R+15 and dismisses retained text on the first real bottom-third copy. Medicine runs `FieldMedicine`:
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
`present()` during standalone PartyMenu. START → POKéMON and field medicine reveal
C+21, then read C+24. A field owner arms the hold at age 10; a battle owner only
reports `paletteCommandDue` and leaves the field counter alone. Overworld STATS
returns into it at Q+3, hence reveal Q+24/read Q+27. The prompt's standalone TextBox
is created at PrintText C+15, runs its no-delay Delay3 through C+18, and is dismissed
at C+21 with GBPalNormal, when the party renderer retains those program-derived lines.
`GoBackToPartyMenu` stays a 16-frame redraw. StatusScreen's own first read is S+29 (03c; held S+15..16).
Main skips its generic input sync during the opening, and the accepting frame
uses the real read's edges; later party-list/submenu input remains the J2 adapter.

Medicine's result redraw adds CGB palette E+4..E+6 before PrintText at E+6;
the complete result/transfer-on is E+9. Its 50-frame hold returns directly into
the first silent read at E+62. Medicine's return calls `itemMenuLoop(false)`, so
it skips `ItemMenuLoop`'s command and keeps list at P+43, bag visible at P+55 and
first read at P+58. Transfer is disabled for copy waits P+7..P+32, then again
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
palette reload refresh these assets. The menus print `mon.nickname` as the record holds it (V5e checkpoint-02);
`pokemon_names.ts` is gone.

`pokemon_storage.ts` owns BoxedPokemon, the unchanged serialization helper,
12/20 capacities and the boxed species-only starter stand-in (OT checks A4).
Main's `writeSave()` contains the former START save arguments verbatim and is
also supplied to `PcStorage.saveGame`. The following-disabled callback returns
false until V2.

### Bill's PC (A5b7e complete, user-verified 2026-10-15)

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
Page 1 reveals S+22 after held S+15..16; the mirrored, padded picture's seven copy waits end at S+29,
the first read. Its marker cells reveal by transferred thirds, never by rendering.
Fresh A or B silently advances; page 2 waits three frames before reading again.
The last press Q restores NR50 (7,7), whites out and clears. Buffer1 restores at
Q+3 with STATS selected; Bill remains full-screen white until LoadGBPal at Q+6,
and first submenu input is Q+9. Since CP4, overworld party enters the shared
opening at Q+3 on the same mon. Checkpoint-03a adds that opening's two frames, so
the return now reveals Q+24 and reads Q+27. The status page's first read is S+29 (03c).
Battle still returns
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
`SleepingPikachuText1` runs as a standalone PrintText with its native prompt wait, then
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

## Title screen

Opening checkpoint-08a (note 118; reviewed and user-verified) inserts `Boot` between `jp Init` and
PrepareTitleScreen. The click, idle reset and both clear-save answers call `cartridgeInit(previous)`: Random's bytes,
the BG transfer's third and its enable byte clear at once, while `previous` draws the picture in tick T. T+1 through
T+10 are dark (no Random, joypad read or audio update; audio clock re-based); the LCD goes off in T+1's step and
comes back with StopAllSounds in T+10's. LoadSGB runs 51 serviced frames (T+11 through T+61). The clear-save song's
notes hold through the first ten ticks, then stop. The main menu's B rebuilds the title directly through display().

Opening checkpoint-08b (note 119 §9; implemented, review pending) delegates to `menus/shooting_star.ts` for
PlayShootingStar's copyright screen, between LoadSGB and the star. In T+61's step the transfer
turns on and SET_PAL_GAME_FREAK_INTRO selects GAMEFREAK/REDMON/VIRIDIAN/BLUEMON, with the same 18×32 attribute block
on both BG maps. T+62–63 are held; T+64–66 service SendSGBPackets' Delay3, transferring Init's $00 tilemap. In
T+66's step hWY becomes 0 and ClearScreen fills spaces; T+67–69 service its Delay3. LoadTextBoxTilePatterns copies
32 tiles to vChars2 tile $60 in T+70–74 (8,8,8,8,0); LoadCopyrightTiles copies 30 in T+75–78 (8,8,8,6).
OpeningScreen's VideoCopyQueue runs after AutoBgMapTransfer in VBlank, with BG transfer off during these copies.
The 30-tile span includes the copyright's 19 tiles, GameFreakLogoGraphics' 9, NineTile and TextBoxGraphics' first
tile: the cartridge's overflow bug leaves $7D as font_extra tile 0, and $7E/$7F as text-box tiles 30/31.
PlaceString writes rows 7/9/11 from column 2 in T+78's step, followed by BGP $E4. UpdateCGBPal_BGP's late VBlank
is serviced at T+79 (third 0); the copyright appears with third 1 at T+80. DelayFrames 180 runs T+80–259, with
no button read. Checkpoint-09 now supplies the second ClearScreen in T+259's step, ending the copyright at
T+259 (180 visible frames); 08b's extra visible frame and third-1 title start have ended.

Opening checkpoint-09 (note 120 §10–§11; reviewed and user-verified) extends `menus/shooting_star.ts` to the whole
PlayShootingStar. T+260 through T+262 service ClearScreen's Delay3; T+260's third 1 erases the copyright. T+263
services DisableLCD's deferred VBlank; its step draws the bars in wTileMap and vBGMap1, fills BG tiles 0/1 white/black,
and copies GameFreakIntro's 20 tiles (13 presents, 6 logo, 1 blank) to BG $60 and objects $80 with the LCD off.
T+264 is dark; its step enables the LCD with $CB (window off, BG map 1). T+265 through T+328 show the bars alone for
64 frames. T+328's step sets OBP0 $F9 and OBP1 $A4; T+329 through T+331 copy the three one-tile star images, then
T+331's step loads the logo and big-star OAM tables, plays shooting_star ($C2, Audio 3) and makes the first move.
The logo and big star appear at T+332, Y 4/X 156. The big star moves Y+4/X-4 for 40 frames, through T+371; steps
T+371, T+381 and T+391 rotate OBP0 right twice ($7E/$9F/$E7) for three ten-frame flashes. T+401's step initializes
24 small-star sprites and the first wave. T+402 through T+545 run four real waves and two empty waves, each eight
one-pixel moves with three-frame waits and OBP1 toggles. The +6 count bug and OAM shift are preserved. T+546 through
T+585 hold for 40 frames unless skipped. T+585's step clears the middle and sprites; T+586 through T+588 service
Delay3 (no logo from T+586). PlayIntro's tail runs in T+588's step with its DelayFrame at T+589; T+590 services
Init's deferred VBlank; T+591 through T+593 are dark, then PrepareTitleScreen runs in T+593's step. The title's
first frame is T+594. There are 577 serviced VBlanks and 512 BG transfers; the title starts on third 2. The movie
(10-14) will move that phase again.

Opening checkpoint-10 (note 121 §9; data only, independently reviewed) extracts PlayIntroScene's assets and does not load them. `yellow_intro.json` holds 11 spawn rows, 11 framesets (one `$fe` or `$ff` terminator), 20 OAM sets of raw unsigned coordinates and attributes, eight speed-bar triples, the 32-byte sea wave, 32 fixed-point sine words, and the thunderbolt and fade sequences including `$ff`. Graphics are `yellow_intro_1.png` (128 tiles), `yellow_intro_2.png` (256 tiles) and `clouds.png` (two four-tile frames), plus the three raw cloud tilemaps. `InitYellowIntroGFXAndMusic` copies 255 of Graphics2's 256 tiles; the extractor keeps the whole sheet. Checkpoints 12–14 own the scenes.

Opening checkpoint-11 (note 122 §8; unused until checkpoint-12) ports `animated_objects.asm` and Yellow's six callbacks into `menus/intro_objects.ts`. `IntroObjectEngine` keeps ten 16-byte structs and ten scratch bytes. `clear` zeroes engine state and keeps the caller's tables and shadow OAM. `spawn` uses the first index-zero slot, increments the byte counter (a wrap to zero leaves the new slot inactive), copies spawn bytes 0 and 1, skips byte 2, and returns null when the pool is full. `mask` clears only the index. `setFrameset` writes byte 1 and resets duration, duration offset and frame index; the ASM name says callback. `run(oam, scene)` runs the callback before the frame. The caller owns the 160-byte shadow buffer and the OAM cursor. A duration of 4 lasts five updates. `$fe` restarts immediately; `$ff` subtracts two from the frame index and replays the last pair. A flip uses `-(relative + 8)`. Attributes keep flip, priority and palette, then OR 4 when palette bit `$10` is set. Scene 7 skips the attribute store. A full buffer returns at once, before later entries and later callbacks. A normal finish zeroes the unused OAM tail. Callback 3 stores Y as the updated X plus 1, so at X `$f8` the pairs are `$fc/$fd` then `$00/$01`, and Y stays `$55` once X is `$58`. Flying bob uses the old field C, then increments it. `introSine` is the fixed-point half-wave: high byte of amplitude times the 8.8 word, negated on phases 32–63. Nothing in the game calls this module yet.

Opening checkpoint-12a (note 123 §8; unused until checkpoint-12b) adds `loadIntroMovieAssets`. One call fetches `/gfx/intro/yellow_intro_2.png` (objects, all 256 tiles), `/gfx/intro/yellow_intro_1.png` (background, 128 tiles) and `yellow_intro.json`, and awaits `preloadMusic('yellowintro')`. The returned sheets keep their stored sizes; the later copy still uses 255 object tiles. Clouds stay unloaded. There is no cache and no Boot or main caller.

Opening checkpoint-12b1 (note 124, reviewed in `e14c82d1`) adds `runWrites(oam, scene)`. It yields
after every actual committed store, including individual tail zeroes; scene 7 skips attribute yields. Callback
and frame state advance once per object update. Resume the same iterator through its final full-buffer carry
return; the last store precedes cursor update/return. `run()` drains it synchronously. Yields have no time cost
of their own. Neither writer nor timing iterator has a game caller; Boot still skips PlayIntroScene.

Opening checkpoint-12b2a (note 125 §9; reviewed in `63e85c8e`, no play-test; unused until checkpoint-12b2c2) adds `introObjectWriteTimes`. The first `.next()` snapshots the ten structs and never writes objects, scratch, OAM or tables. Each yielded number is the machine cycles from `RunObjectAnimations` entry through the end of that store, including already-zero tail stores. Scene 7 yields no attribute-store time. The generator's return is total cycles and OAM-full carry, including `RET` and excluding the caller's `CALL`. Interrupt, DMA, PPU and audio cost stay outside this module. Prime it before the first `runWrites` resume. Nothing in the game calls it yet.

Opening checkpoint-12b2b (note 126 §9; reviewed in 43b56cb6; unused until checkpoint-12b2c2) adds `introObjectCpuSteps`. The first `.next()` snapshots the ten structs and never writes objects, scratch, OAM or tables. Each yield is one native instruction: its own machine-cycle cost, not a cumulative timestamp, with `store` set only on an actual shadow-OAM byte store (always two cycles). Helpers, internal calls and returns, and the final `RET` are included. The incoming `CALL`, interrupt dispatch and handlers, audio, and PPU/DMA stalls are excluded. The generator returns OAM-full carry. Adjacent instructions stay separate even when their sum matches a store timestamp. Prime it before the paired writer. It does not advance `runWrites` or `introObjectWriteTimes`, and nothing in the game calls it yet.

Opening checkpoint-12b2c1 (note 127 §9; Nemotron review PASS 961e1dec; unused until checkpoint-12b2c2-3) adds `IntroMovieClock`. Construction requires a copied 144-entry mode-0 edge profile; there is no default. `advance` moves elapsed time always and LCD phase only while the LCD is on, requesting edges in `(old, new]`. `takeInterrupt` prefers VBlank over STAT, clears only the accepted bit, and charges no dispatch or handler cycles. Disabling the LCD stops phase progression and leaves pending bits. Only off-to-on resets the phase. `cyclesUntilRequest` does not advance time. Frame, line and VBlank constants are 17556, 114 and 16416 machine cycles. The owner supplies handler work, including the five-cycle dispatch. Nothing in the game calls it yet.

Opening checkpoint-12b2c2-1 (note 129; review PASS, no play-test; unused) adds `IntroDisplayClock` in dots, four per machine cycle. It places LCDC/STAT store effects, the enabling frame, readable LY/STAT, the mode-0 level, per-line scroll/window/object stretch, and the first instruction boundary at or after a request. `takeInterrupt` samples once and does not model HALT, EI, RETI, or a vector change during dispatch. Unsupported states throw: BG or objects off, window plus selected objects, a register write in mode 2/3, and an OAM DMA within 12 dots of a scan. Scene 0 does not write `rLCDC`; `$E3` is `PrepareNextScenePalette`. A supported line can raise STAT fewer than 200 dots before VBlank. Nothing in the game calls it yet.

Opening checkpoint-12b2c2-2a (note 130) adds `IntroCpu` over `IntroDisplayClock`. Dispatch takes 20 dots, with a vector re-check at +14. HALT retries when a request lands during its four-dot instruction. Otherwise it wakes at the first CPU boundary at or after the request and adds four dispatch dots. EI enables interrupts after the next instruction. DI and RETI take effect immediately, and IF stores take effect three dots before the instruction ends. The helper refuses HALT with IME off, DI/HALT/RETI with EI pending, instructions when dispatch is due, unwakeable HALTs, and out-of-range inputs. Nothing in the game calls it yet.

Opening checkpoint-12b2c2-2b (note 131) adds `introVBlankSteps` and `introLcdcSteps`. They yield instruction costs from the vector jump through RETI, with one opaque audio callee step in VBlank. The SCX, SCY, WY, DMA, and NR50 markers identify stores that take effect four dots before the instruction ends. Unsupported handler branches and nonzero LCDC pointers raise `RangeError` before the first step. Nothing in the game calls these generators yet.

Opening checkpoint-12b2c2-2c2 (note 133) adds `intro_helper_timing.ts`. Each helper starts at its first instruction and includes its returning instruction. The owner supplies LY, STAT, joypad and flag reads between steps, and HALT's retry or woke reply. A GDMA stall is 2,052 dots with no opcode, emitted after `rVDMA_LEN` and not passed to `IntroCpu.exec()`. An audio step is the callee from its first instruction through RET; manual calls use the setup predictor and `UpdateMusicCTimes` uses the movie predictor after PlayMusic publishes a music channel. PlayMusic's CHAN5–8 clears are visible before those music-channel stores. EI in these helpers is followed by RET. Nothing in the game calls these generators yet.

Notes 134–137 exercise the foreground runner in tests and a standalone Vite development preview. The runner resumes
the program after servicing pending interrupts. The display clock copies shadow OAM at DMA start and makes the
snapshot visible at the exact completion dot. The program polls input before stage entry and runs one cleanup path
on either exit. At VBlank entry the runner captures the predictor, cost and audio version for that service.
The preview in `game/scripts/foreground_preview.ts` anchors each Start/Replay with `TickClock.reset(now)`, advances
absolute dot deadlines, and presents visible OAM. Its original geometric scene and synthetic audio stay outside
the game's boot and production import graph.

Review `64afc3ce` (Grok), implementation `d09c218f` (Sonnet), is the authoritative correction to the original
report/source comments. Four trailing dots applies to the measured single-write LCDC paths; tile-select-off
glitch paths/arbitrary I/O stores need separate timing, and STAT's two writes must distinguish first effect
from the probe's second callback. The probe does not independently prove dispatch duration or re-evaluation.
For line143 the natural STAT/VBlank gap is `204 − extra` dots; a mode-0 select write can request STAT one dot
before VBlank. Unit2 must handle/prove CPU-control and dispatch behavior without assuming a200-dot minimum.
`PrepareNextScenePalette` sets hWY=$90 before LCDC=$E3, but hardware rWY is latched later: stale-WY/window plus
objects reachability remains open for units2/3. Scene0 attribution is corrected, not a reachability proof.

The skip follows the release build's CheckForUserInterruption: after each DelayFrame in the fall, flashes and
small stars, A or START newly pressed, or Up+Select+B held exactly, returns carry. SELECT alone and that chord with
an extra direction do nothing. Boot clears hJoyLast at Init, so a button already held before T+332 skips at that
first check. A skip seen in tick k reaches PrepareTitleScreen in k+8, omitting the 40-frame hold. Boot also models
the first serviced VBlank's HideSprites after the OAM DMA, selects Audio 3 after LoadSGB and restores LCDC_DEFAULT
in Init's tail. The soft reset remains outside this slice.

The oracle is the cartridge's recorded frames digest (note 120 section 2.2): every serviced VBlank's 160 OAM bytes,
BGP, OBP0, OBP1 and LCDC & $7F. The full run matches SHA256
`c16f211addf5efaf5cc1682ecb147d1c7ea36681df070aca9dbd82af7094b592`; six skip runs also match their recorded tick,
serviced count and digest. OBJ palette transfers are modelled for the whole frame; their hardware H-blank changes
finish above the objects they affect (note 120 section 2.4).

Opening checkpoint-07b (note 117; implemented, review pending) connects the title's Up+Select+B exit to
`ClearSaveDialogue` on `IntroScreen`. ClearScreen waits frames 1-3; MEWMON is selected in 3's step, frames 4-5 are
palette-held, and 6-8 wait. LCD-on font and text-box copies take frames 9-25 and 26-30 with BG transfer disabled;
PrintText draws the box at 30 and its first glyph at 33. PrepareTitleScreen clears BIT_FAST_TEXT_DELAY, so the boot
path types one frame a letter and opens the menu at 53; main-menu entry sets the bit, and B's `display()` preserves
it, so that path uses the options' speed (menu at 93 medium, 133 slow). Held A or B gives one frame per letter.
The NO/YES box at (14,7) starts on NO; PAD_B is masked until the menu closes. A plays press_ab and waits 15 frames,
then restores the menu's tiles and clears the mask. NO keeps the save and returns through cartridgeInit in that
step; YES removes only `p151-s`, waits 13 more frames, then returns through cartridgeInit. The fixed 13-frame wait
represents the measured 12-or-13 split. Since 08a, the title song holds until Init's tenth tick stops it; the boot
path above then reaches the title. 07b's user play-test passed (note 117 section 11); its review is still owed.

Opening checkpoint-05 (note 114; reviewed and user-verified 2026-11-17) rewrites `TitleScreen` as a frame program
over `OpeningScreen`: 384 VRAM tiles, two BG maps and CGB attribute maps, latched scroll/window registers, shadow
and DMA'd OAM, palette registers and LCD state. `renderOpeningScreen` is a pure scanout; the model uses the shared
`TileMap` thirds. The LCD-off copies load only 115 logo tiles, leaving the PNG's padded tail untouched.

From `start()`, frames 1-3 clear the screen, frame 4 services DisableLCD's VBlank, and 5-8 are four dark frames
with no Random, joypad or audio update (the audio clock is re-based). EnableLCD's first frame stays white.
Frames 9-14 transfer the Pikachu and logo maps; 15-16 are the palette command's two held frames; 17-19 wait,
with colour first appearing at 19. The 32-frame bounce runs at 20-51 (crash at 39), then waits 36 frames; at 87
the whoosh and bubble start. Delay3 and the clip's three waits lead to clip 1 at 93, 46 frozen ticks, then the
next serviced update (94) stops all music and starts the preloaded title song: 140 physical ticks from start.

The loop ports `DoTitleScreenFunction`: read the timer before incrementing, trigger at 0/$80/$90, update the
eight eye entries, and show them after the next DMA.

Opening checkpoint-06 (note 115; reviewed and user-verified 2026-11-17) ports the rest of the loop and its exits.
`IncrementResetCounter` counts before each `DelayFrame`; then `joyHeld()` (`hJoyHeld`, a held button, not a press)
leaves on exactly Up+Select+B (`$46`) or anything with A or START (`$09`), else the title function runs. The exit
plays clip 11 (36 frozen ticks), whites out (`e+4`), clears OAM and sets `hWY = 0` (`e+7`), blanks the screen into
`$9800` and then `$9C00`, waits, and runs `LoadGBPal` (`FadePal4`) at `e+19`: 55 ticks. The jump tests Up+Select+B
masked on the loop's byte: `'clear_save'` (the dialogue, since checkpoint-07b) or `'main_menu'`.
The 3,071st loop frame starts the idle reset: `fadeOutAndStopMusic($0C)`, a spin until the fade ends (104 frames),
then `'reset'`, which main answers with `cartridgeInit(previous)` (Random's bytes and the transfer clear, then
the boot path above, including StopAllSounds at tick 10, then `start()`). The main menu's B calls `display()`: the build without `PrepareTitleScreen`, on a fresh model, with
the song still playing. `update()` returns the exit in the step that jumps and drops the program. Still to come:
the movie (10–14); the clips' frozen counts are fixed (O-59).
