# Menus Architecture

## Pattern

Each menu is a class with `update()` and `render()` methods. State transitions are managed by `main.ts` (the game state machine dispatches to the active menu). Shared rendering utilities live in `menu_render.ts` (`drawBox`, `drawText`).

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
| `start_menu.ts` | 77 | Main menu: POKeDEX, POKeMON, ITEM, YELLOW, SAVE, OPTION, EXIT |
| `party_menu.ts` | 583 | Party view, switch, stats pages (1 & 2), tile-based HP bars, DrawLineBox, battle mode switch |
| `party_icons.ts` | 142 | Party menu Pokemon icons: species-to-sprite mapping, 2-frame animation, HP-based speed |
| `item_menu.ts` | 577 | Item selection, usage, toss, HP heal animation (1 HP/2 frames), Pikachu happiness integration |
| `pokemart.ts` | 359 | Viridian Mart: DisplayPokemartDialogue |
| `list_menu.ts` | 218 | DisplayListMenuID: priced list and the bag |
| `quantity_menu.ts` | 74 | DisplayChooseQuantityMenu |
| `screen_tiles.ts` | 180 | Borders, PlaceString, BCD cells, Buffer1 |
| `pc_menu.ts` | 476 | PC item storage (withdraw/deposit/toss) |
| `bills_pc_menu.ts` | 650 | Pokemon storage: withdraw/deposit/release/change box (12 boxes, 20 per box) |
| `pokecenter_pc_menu.ts` | 217 | Pokecenter top-level PC: SOMEONE's PC (Bill's) / PLAYER's PC (items) / LOG OFF |
| `pokedex.ts` | 614 | Pokedex list, data (height/weight/description), area screen (town map + nest icons) |
| `trainer_card.ts` | 311 | Player card: name, money, time, badges, Red sprite |
| `town_map.ts` | 151 | Map overlay |
| `title_screen.ts` | 283 | Title screen: Pokemon logo + Pikachu with eye blink animation (3-state OAM sprites) |
| `oak_speech.ts` | 590 | Oak intro: portrait fade/slide, Pikachu reveal, player/rival naming, shrink animation |
| `naming_screen.ts` | 255 | Full keyboard: upper/lower/symbol grids, ED submit button, auto-case toggle |
| `main_menu.ts` | 81 | CONTINUE / NEW GAME / OPTION (save-aware) |
| `option_menu.ts` | 159 | Settings: text speed, animation, battle style, sound |
| `save_menu.ts` | 135 | Save confirmation + saving animation |
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
The list's ▼ stays steady; its blink is J2.

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
