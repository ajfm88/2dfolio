# Menus Architecture

## Pattern

Each menu is a class with `update()` and `render()` methods. State transitions are managed by `main.ts` (the game state machine dispatches to the active menu). Shared rendering utilities live in `menu_render.ts` (`drawBox`, `drawText`).

## Key Files

| File | LOC | Purpose |
|------|-----|---------|
| `start_menu.ts` | 77 | Main menu: POKeDEX, POKeMON, ITEM, YELLOW, SAVE, OPTION, EXIT |
| `party_menu.ts` | 583 | Party view, switch, stats pages (1 & 2), tile-based HP bars, DrawLineBox, battle mode switch |
| `party_icons.ts` | 142 | Party menu Pokemon icons: species-to-sprite mapping, 2-frame animation, HP-based speed |
| `item_menu.ts` | 577 | Item selection, usage, toss, HP heal animation (1 HP/2 frames), Pikachu happiness integration |
| `shop_menu.ts` | 410 | Pokemart BUY/SELL/QUIT |
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
| `blackboard_menu.ts` | 174 | Interactive menus (school blackboard, link cable help) |
| `menu_render.ts` | 56 | Shared: drawBox, drawText utilities |

## BlackboardMenu

Reusable interactive menu board with configurable columns, descriptions, and cursor navigation. Uses `BlackboardConfig` interface — designed to support ViridianSchoolHouse (status ailments) and ViridianNicknameHouse (Link Cable Help).

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
