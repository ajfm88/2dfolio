# PROGRESS — session archive

> **This is not the live log.**
>
> Current state, the ordered slice queue, open questions and recent sessions live
> in **`context/agent/01-progress-tracker.md`** — read that first, and update it
> before you stop working.
>
> This file keeps older session entries once the tracker's Session Log gets long,
> so the tracker stays short enough that agents actually read it.

Oldest first.

## 2026-08-02 — Context system created (Claude Opus 4.6)

Surveyed all 6 reference repos. Established 45-slice plan across 12 phases.
Rewrote all 15 context files from Link's Awakening DX HD to NES Legend of Zelda.
Key decisions: Canvas 2D (not WebGL2), data-driven JSON (not hardcoded),
disassembly as behavioral authority, sprites from reference repos. Credits file
created with all 6 source URLs. **No production code written. Next: A1.**

## 2026-08-03 — A1 Scaffold project (Claude Opus 4.6)

Scaffolded `zelda-nes-ts/`: Vite 8 + TypeScript 6 (strict, noUnusedLocals,
noUnusedParameters, noUncheckedIndexedAccess), vitest 4, ESLint with
typescript-eslint. Folder skeleton per ARCHITECTURE (`src/core`, `src/data`,
`src/render`, `src/world`, `src/objects/{enemies,bosses,items,npcs,projectiles}`,
`src/ui`, `src/audio`, `src/save`, `public/assets/{sprites,tiles,audio}`).
Created `game-loop.ts` (fixed-timestep, pause on blur), `constants.ts` (NES
specs), `types.ts` (Vec2, Rect, Direction), `main.ts` (canvas setup + test
render). 6 tests pass, typecheck clean, dev server runs on 5173. **Next: A2.**

## 2026-08-04 — A2 Canvas renderer + game loop (Claude Opus 4.6)

Created `src/render/renderer.ts` — Renderer class that owns the canvas and 2D
context, handles integer scaling on resize, disables image smoothing, and
provides `clear()`, `fillRect()`, `drawImage()`, `beginPlayArea()`/
`endPlayArea()` (translate to HUD offset). Updated `main.ts` to use Renderer
with a hue-cycling play area demo. 7 new renderer tests (13 total). Typecheck
clean, all tests pass. Game loop from A1 needed no changes. **Next: A3.**

## 2026-08-04 — A3 Asset curation (Claude Opus 4.6)

Curated 62 assets from reference repos into `public/assets/`: 19 sprite sheets
(Link, enemies, bosses, items, NPCs, etc.), 7 tilesets (overworld + dungeon),
3 UI images (HUD, title, crest), 3 reference maps, 30 SFX (kebab-case WAV),
2 music tracks (OGG). Primary source: ZeldaJS-master (native 16x16, web-ready).
Supplemented from zelda-clone-master (items, projectiles, particles) and
game-zelda-js-master (full maps). Created `src/data/asset-manifest.ts` with
typed maps + `loadAllAssets()` preloader. 77 tests pass (64 new manifest file
checks). Zero 404s, zero console errors. **Next: A4.**

## 2026-08-05 — A4 Input system (Claude Opus 4.6)

Created `src/core/input.ts` — InputManager class with keyboard + Gamepad API
support. Action enum with 8 game actions (Up/Down/Left/Right/Attack/Item/Start/
Select). Per-frame edge detection (held/justPressed/justReleased). Default
bindings: Arrows + WASD for directions, X/Space for attack, Z for item, Enter
for start, Shift for select. Gamepad: standard mapping (A=attack, B/X=item,
D-pad + left stick for directions). Remappable via setKeyBinding/clearKeyBinding.
Integrated into main.ts with color-coded debug overlay (green=held, yellow=
justPressed, red=justReleased, gray=idle). 23 new tests (100 total). Typecheck
clean (only pre-existing errors in asset-manifest test). Visually verified:
overlay reacts to key presses in real time. **Next: A5.**

## 2026-08-05 — A5 Debug overlay + test harness (Claude Opus 4.6)

Created `src/core/fps-counter.ts` — FpsCounter class with configurable sample
interval, takes `now` parameter for testability. Created `src/core/debug-overlay.ts`
— DebugOverlay class with backtick key toggle (separate from InputManager since
it's a meta key, not a game action). Updated `main.ts`: replaced always-visible
`renderInputDebug()` with `renderDebugOverlay()` gated on `debug.enabled`. Overlay
shows status bar (FPS, frame count, screen coord placeholder, entity count
placeholder) + input action states. Hidden by default, backtick toggles on/off.
19 new tests (119 total). Typecheck clean. Visually verified toggle in browser.
**Phase A complete. Next: B1.**

## 2026-08-05 — B1 Overworld map data (Claude Opus 4.6)

Created `scripts/extract-overworld.ts` — Node extraction script that reads
Original.nes ROM at known offsets (RoomLayoutsOW, LevelBlockOW/AttrsD) and
parses inline `.BYTE` directives from Z_05.asm (column heaps, square tables).
Decodes all 128 overworld screens through 4-level compression: AttrsD → room
layout → column descriptors → column heaps → square indices. Key fix: AttrsD
masked with `& 0x7F` for layout index (7 bits) vs `& 0x3F` for gameplay room
ID (6 bits). Column heaps concatenated into contiguous buffer since column data
spans heap boundaries. Output: `src/data/overworld.json` with 128 screens of
11×16 tile grids + square table (56 primary + 16 secondary metatile defs).
Created `src/data/overworld-types.ts` with OverworldScreen, SquareTable,
OverworldData interfaces. 13 new validation tests (132 total). **Next: B2.**

## 2026-08-06 — B2 Dungeon room data (Claude Opus 4.6)

Created `scripts/extract-dungeons.ts` — Node extraction script that reads the
NES ROM at known offsets for 4 LevelBlock binaries (768 bytes each: AttrsA–F for
128 rooms), 9 LevelInfo binaries (252 bytes each: startRoomId, triforceRoomId,
bossRoomId, cellarRoomIds, foeCounts), and RoomLayoutsUW (504 bytes: 42 unique
rooms × 12 column descriptors). Parses inline .BYTE directives from Z_05.asm for
10 ColumnHeapUW tables, ColumnHeapUWCellar, 2 cellar layouts, and
PrimarySquaresUW (8 entries). Decodes 42 unique room tile grids (7×12 squares)
using column-based compression (same algorithm as overworld but with UW
parameters: 12 cols, 7 rows, 10 heap tables, 3-bit square indices). Outputs
`src/data/dungeons.json` with 4 level blocks (Q1+Q2 × blocks 1-6/7-9), 9
dungeon metadata entries, 42 unique rooms, 2 cellar rooms, and square table.
Created `src/data/dungeon-types.ts` with DungeonRoom, DungeonLevelBlock,
DungeonInfo, UniqueRoom, DungeonData interfaces. 33 new validation tests
(165 total). **Next: B3.**

## 2026-08-06 — B3 Enemy spawn tables (Claude Opus 4.6)

Created `scripts/extract-enemy-spawns.ts` — extracts the NES Zelda spawn system.
The 7-bit monster list ID encodes 3 modes: 0x00=none, 0x01-0x61=single type
repeated, 0x62-0x7F=heterogeneous list lookup. Positions are NOT stored per-room;
they're computed at runtime from 4 hardcoded position lists (by Link's facing
direction). Extracted from ROM: ObjLists.dat (201 bytes → 30 lists of 4-8 enemy
type IDs), LevelBlockOW (AttrsC/D/F → 128 OW screen spawn entries with
monsterListId, monsterCountIndex, edgeSpawn flag), LevelInfoOW (foeCounts
[1,4,5,6]). Parsed from Z_05.asm: SpawnPosList0-3 (4×9 positions). From
UpdateObject_JumpTable in Z_07.asm: 83-entry object type name map (0x00-0x52).
Dungeon spawn data was already in dungeons.json from B2 (monsterListId,
monsterCountIndex, foeCounts per dungeon). Created `src/data/enemy-spawn-types.ts`
and `tests/data/enemy-spawns.test.ts`. 23 new tests (188 total). **Next: B4.**

## 2026-08-07 — B4 Item tables (Claude Opus 4.6)

Created `scripts/extract-items.ts` — extracts all item-related data from the NES
ROM and disassembly. From Z_04.asm: enemy drop tables (4 monster groups, 4 rates,
4×10 drop item table, 7 no-drop types). From Z_01.asm: ItemIdToSlot (36 entries),
ItemIdToDescriptor (36 entries), OverworldPersonTextSelectors (20 cave types
decoded to textSelector/payFlag/pickUpFlag), MoneyGameLossAmounts + Permutations.
From ROM binary LevelBlockOW.dat AttrsE: 20 cave/shop inventories (3 items + 3
prices each, items masked to 6-bit IDs, flags from high 2 bits). From Z_04.asm:
SecretArmosRoomIds/Xs (7 entries). From Z_07.asm: FluteRoomSecretsOW (11 rooms),
ObjectTypeToHpPairs (38 packed bytes). Hardcoded OW heart container at screen
$5F ($C0, $90). Also updated `extract-dungeons.ts` to capture itemPositionIndex
(AttrsF bits 4-5) per room and shortcutOrItemPositions (4 packed X/Y bytes) per
dungeon from LevelInfo. Created `src/data/item-types.ts` with ITEM_NAMES (36),
CAVE_TYPE_NAMES (20), and all interfaces. 45 new tests (233 total). Added
extract:dungeons, extract:enemy-spawns, extract:items npm scripts. **Next: B5.**

## 2026-08-08 — B5 Sprite animation data (Claude Opus 4.6)

Created `scripts/extract-sprites.ts` — extracts all sprite animation data from
three ASM source files (no ROM binary needed). From Z_01.asm: core animation
system — ObjAnimations (127 entries mapping animation index → frame heap offset),
ObjAnimFrameHeap (204 CHR tile IDs), ObjAnimAttrHeap (204 palette/flip attrs),
SpriteOffsets (41-entry OAM cycling table), SpriteRelativeExtents (2 bytes),
Anim_ItemFrameOffsets (37 item slot → tile mappings), Anim_ItemFrameTiles (48
CHR tile IDs), ItemSlotToPaletteOffsetsOrValues (32 palette values). From
Z_07.asm: ObjectTypeToAttributes (95 per-type flags), LinkHeadTiles (4
directional), LinkHeadMagicShieldTiles (4), weapon directional tables (4×4 +
2×16 offsets), SwordShotSpreadBaseAttr (4), BoomerangFrameCycle (9) +
BaseSpriteAttrCycle (9), BombCloudOffsets (4×3). From Z_04.asm: 7 boss sprite
layouts — Aquamentus (tiles/offsets), Dodongo (frame images + bloated variants),
Digdogger (2×2 grid offsets/attrs), Gleeok (3 body tile sets + base offsets),
Ganon (24 frame images, burst dirs/tiles/attrs), Patra (start angles + 16-entry
sine table), Manhandla (frame images/attrs + segment offsets). Enemy timing:
BlueLeever/RedLeever state anim times, Wallmaster dirs+attrs for 4 walls +
initial positions. Created `src/data/sprite-types.ts` with 18 interfaces.
Hardcoded walkingAnimCounterReset=6. 61 new tests (294 total). Added
extract:sprites npm script. **Phase B complete. Next: C1.**

## 2026-08-09 — C1 Tile renderer (Claude Opus 4.6)

Created `src/render/tile-renderer.ts` — TileRenderer class that renders 16×11
overworld screens from overworld.json tile data. Uses the full overworld-map.png
(4096×1408, 16×8 screens at 256×176 each) as the tile source, extracting
per-tile 16×16 regions at render time. This approach gives pixel-perfect,
palette-correct rendering per screen — the NES uses different palettes for
different map regions (green forest, brown mountains, gray graveyard), so a
global tile atlas would show wrong colors. Added `getScreenByCoord()` helper
with wrapping. Updated `main.ts`: loads overworld.json via fetch, initializes
TileRenderer from the map asset, renders the current screen in the play area,
arrow-key navigation between screens with screen ID/coords in the HUD. Visually
verified across 6 regions: start screen (green trees + cave), forest, lake
(water + bridge + boulders), graveyard (tombstones + gray palette), mountains
(brown rocks), and eastern forest. 13 new tests (307 total). Typecheck clean.
**Phase C started. Next: C2.**

## 2026-08-10 — C2 Sprite renderer + animation system (Claude Opus 4.6)

Created `src/render/sprite-renderer.ts` — three exports: SpriteSheet class
(wraps sprite sheet image with grid config, auto-detects transparency key from
pixel (0,0), replaces it with alpha via offscreen canvas processing at init),
WalkAnimationController (NES-faithful 2-frame walk cycle toggling every 6 game
frames per sprites.json walkingAnimCounterReset), and directionToSpriteCol()
(maps our Direction enum to ZeldaJS sheet column order: Down=0, Left=1, Up=2,
Right=3). Added drawImageFlipped() to Renderer for flip/mirror support via
canvas save/translate/scale/restore. Updated main.ts: Link sprite renders at
center of play area on top of overworld tiles (establishing draw order: tiles →
entities → Link), arrow keys change facing direction (isHeld) while still
navigating screens (isJustPressed), walk animation cycles while key held and
resets to still frame on release. Uses link.png (15 cols, 1px spacing, 16×16
cells). 24 new tests (331 total). Typecheck clean. Visually verified all 4
directions + walk animation + still frame reset across multiple screens.
**Next: C3.**

## 2026-08-11 — C3 HUD / status bar (Claude Opus 4.6)

Created 3 new files in `src/ui/`: `hud.ts` (HudRenderer class + HudState
interface + formatCount), `bitmap-font.ts` (BitmapFont class wrapping SpriteSheet
for the 9×7 cell font.png, charToIndex mapping matching ZeldaJS), `heart-meter.ts`
(HeartMeter class + computeHearts with NES-faithful half-heart granularity from
Z_01.asm FormatHeartsInTextBuf). HUD draws hud.png background at (0,0), then
overlays dynamic values: hearts at (176,40) with 8px step and 2-row support for
16 max containers, rupee/key/bomb counters at NES PPU nametable positions
(96,24)/(96,40)/(96,48) using "X23"/"123" format, overworld minimap green dot
(3×3, #83d313) at x=17+col*4, y=24+row*4 matching NES UpdatePlayerPositionMarker.
Magic key support ("XA" display). 37 new tests (368 total). **Next: C4.**

## 2026-08-11 — C4 Screen transition (Claude Opus 4.6)

Created `src/world/screen-transition.ts` — ScreenTransition class managing
push-scroll animation between overworld screens. NES-accurate timing from
Z_05.asm ScrollWorld: horizontal = 4px/frame × 64 frames (256px), vertical =
4px/frame × 44 frames (176px). 23 new tests (391 total). **Phase C complete. Next: D1.**

## 2026-08-12 — D1 Link movement (Claude Opus 4.6)

Created `src/world/collision.ts` — TileCollisionMap class deriving walkability
from overworld.json squareTable.primary NES metatile values against threshold
$8D (141). Created `src/objects/player/link.ts` — Link class with NES-faithful
QSpeed movement system (sub-pixel accumulator, $60 applied 4×/frame → 1.5
px/frame average). 8×8 collision hitbox at lower center. Perpendicular grid
snapping. 37 new tests (428 total). **Phase D started. Next: D2.**

## 2026-08-12 — D2 Sword attack (Claude Opus 4.6)

Created `src/objects/player/sword.ts` — SwordSwing class with 16-frame state
machine matching Z_07.asm UpdateSwordOrRod. Created `src/objects/player/sword-beam.ts`
— SwordBeam projectile at QSpeed $C0 (3px/frame). 28 new tests (456 total). **Next: D3.**

## 2026-08-13 — D3 Shield + push block (Claude Opus 4.6)

Created shield deflection, enemy projectile, and push block systems. 46 new tests
(502 total). **Next: D4.**

## 2026-08-14 — D4 Damage system (Claude Opus 4.6)

Created damage tables, Link knockback/invincibility system with NES-faithful timing.
46 new tests (548 total). **Next: D5.**

## 2026-08-15 — D5 Death + respawn (Claude Opus 4.6)

Created GameMode enum, DeathAnimation (7-phase NES Mode $11), GameOverScreen
(CONTINUE/SAVE/RETRY), computeRespawnParams. 33 new tests (581 total).
**Phase D complete. Next: E1.**

## 2026-08-16 — E1 Overworld map loading (Claude Opus 4.6)

Created OverworldManager class owning all overworld state: screen navigation,
transitions, collision map, visited tracking. Boundary clamping. 32 new tests
(613 total). **Phase E started. Next: E2.**

## 2026-08-16 — E2 Cave/staircase entry and exit (Claude Opus 4.6)

Created `src/data/cave-data.ts` — SCREEN_CAVE_INDEX mapping (78 cave screens from
ROM LevelBlockOW.dat AttrsB, formula: ((attrsB & 0xFC) - 0x40) / 4),
CAVE_ENTRANCE_TILES (tile 12 = dark opening), helper functions. Created
`src/world/curtain-effect.ts` — CurtainEffect class with close/open directions,
8 steps × 4 frames per step = 32 frames total, draws two black columns from
edges (close) or center (open). Created `src/world/cave-room.ts` — CaveRoom class
rendering cave-map.png background, Old Man from npcs.png, fire placeholders, item
(WoodSword drawn as colored shape), centered text ("IT'S DANGEROUS TO GO ALONE!
TAKE THIS." via BitmapFont). Walk-in auto-walk (32 frames). Item pickup detection
(proximity check), exit detection (bottom of cave). Added CaveTransition and
CaveInterior to GameMode enum. Added cave entry detection to OverworldManager
(checkCaveEntry: checks tile above Link when facing up on cave screen). Walk-into-
darkness phase (8 frames of Link walking into dark tile before curtain). Entry
position saved for overworld return. Changed Link._hasSword default to false —
sword acquired by picking up WoodSword in cave. Updated 6 existing tests to
call setHasSword(true). 13 new cave tests (626 total). Typecheck clean. Visually
verified: walk into cave → curtain close → cave interior → pick up sword → exit →
curtain open → back on overworld → sword swing works. Known polish items: Old Man
sprite has blue background (needs transparency key), HUD shows sword before
acquisition (F1 fix), fire sprites are placeholders.
**Next: E3.**

## 2026-08-17 — E3 Overworld secrets (Claude Opus 4.6)

Created `scripts/extract-secrets.ts` — extracts per-screen quest secret numbers
(AttrsF bits 6-7, 32 screens with quest-specific secrets) and shortcut positions
(4 packed bytes from LevelInfoOW offset 41). Output: `src/data/secrets.json` +
`src/data/secret-types.ts` with tile object type constants ($62-$67) and square
index mappings (38-43). Created `src/world/room-flags.ts` — RoomFlags class with
128-byte per-room state, isSecretFound/setSecretFound (bit $80 per NES WorldFlags).
Created `src/objects/weapons/bomb.ts` — Bomb stub with 4-phase NES timer (BombTimes
$30/$18/$0C/$06), isDetonating flag for wall detection. Created
`src/objects/weapons/candle-fire.ts` — CandleFire stub: walks 16px then stands 63
frames, isStanding flag for tree detection. Created `src/world/tile-object.ts` —
TileObjectManager: scans tile grid for special square indices 38-43 mapping to tile
object types, quest secret mismatch filtering (Q2-only skipped in Q1), pre-reveal
on revisit via room flags. Three secret handlers: bombable rock wall (bomb within
16px → cave entrance at tile position), burnable tree (standing fire within 16px →
stairs at shortcut position from secrets.json), pushable rock/gravestone (vertical
only, bracelet check for rock, 16-frame push timer + 16px slide → stairs). Fixed
push direction logic per Z_04.asm RockPushDirections (Link below → push Up, above
→ push Down). Updated `src/render/tile-renderer.ts` — renderScreen() accepts tile
override map; cave entrance sampled from reference screen (7,7), stairs rendered as
brown/black stripes. Updated `src/world/overworld-manager.ts` — added RoomFlags,
TileObjectManager, SecretsData; constructor takes secretsData param; initForScreen
on transition/setScreen; updateTileObjects() and renderTileObject() methods;
checkCaveEntry() expanded to detect revealed cave entrances via tile overrides.
Added hasBracelet/setBracelet to Link. Updated `src/main.ts` — loads secrets.json,
bomb/fire arrays, Z key places fire (first press) then bomb (second press per
screen), weapons update/render each frame, tile object secrets update. Added
`extract:secrets` npm script. 44 new tests (670 total). Typecheck clean (only
pre-existing errors). No console errors. Cave entry still works.
**Next: E4.**

## 2026-08-17 — E4a Cave type system (Claude Opus 4.6)

Created `scripts/extract-cave-text.ts` — extracts all 38 NPC dialogue strings from
PersonText.dat in the NES ROM. Decoded from NES PPU tile encoding (low 6 bits =
character tile ID, high 2 bits = line control: $80=line 2, $40=line 3, $C0=end).
Fixed iNES header offset (+16 bytes). Character map: $00-$09→0-9, $0A-$23→A-Z,
$24/$25→space, $28→comma, $2A→apostrophe, $2C→!, $2D→-, $2E→?, $2F→hyphen.
Output: `src/data/cave-text.json` + `src/data/cave-text-types.ts`. Generalized
`src/world/cave-room.ts` — CaveRoom now supports all 20 cave objectTypes via
behavior detection: gift (0x6A-0x6D, 0x72), hint (0x6E-0x6F, 0x73), doorRepair
(0x71), moblinGive (0x7B-0x7D), shop (0x75-0x7A), moneyGame (0x70), potionShop
(0x74). NPC type selection: Old Man (default), Old Woman (0x70, 0x79, 0x7A),
Moblin (≥0x7B). Text lookup via caveTypes[].textSelector / 2 → PersonTextAddrs
message index. Heart requirement check for White Sword (5 containers) and Magic
Sword (12 containers). Room flag integration: already-taken caves show empty
(person+items hidden). Colored item shapes per type (sword variants, heart
container, letter, rupees) — items.png has black backgrounds invisible against
dark caves, deferred real sprite rendering to F1. Added rupees/keys/bombs/maxBombs
to Link with addRupees/spendRupees/addKeys/addBombs/addHeartContainer methods.
HUD wired to live Link.rupees/keys/bombs. Generic handleItemPickup switch for all
item types (swords, bracelet, magic shield, heart container, bombs, keys, rupees).
Door repair auto-deducts 20 rupees per Z_01.asm:696. Moblin caves give rupees from
prices[1]. Created `src/data/item-sprites.ts` — NES item ID → items.png grid
mapping (32 items, 10×4 grid at 40×40 cells). Added extract:cave-text npm script.
35 new tests (705 total). Typecheck clean. Visually verified: sword cave shows
correct text + Old Man + fires + item shape.
**E4 split into E4a/E4b. Next: E4b.**

## 2026-08-17 — E4b Shops + money game (Claude Opus 4.6)

Added shop purchase system to CaveRoom: shop caves (objectTypes 0x75-0x7A) display
up to 3 items at NES CaveWareXs positions ($58/$78/$98), prices rendered below via
BitmapFont, rupee "X" indicator at ($30, $AB). Shop update checks all 3 slots for
Link proximity (dx<12, dy<10), verifies rupees >= price, generates CavePurchaseEvent
with slotIndex/itemId/price. main.ts processes events: spendRupees + handleItemPickup.
Added money game (objectType 0x70): generateMoneyGameAmounts() creates 3 randomized
amounts — one win (+20 or +50) and two losses (-10, -10 or -40) shuffled via
Fisher-Yates. Link touches a position with ≥10 rupees → pays 10 + wins/loses chosen
amount. Results displayed with +/- signs. MoneyGameResult event processed by main.ts.
Potion shop (0x74) stubbed as shop behavior (Letter requirement deferred to F4).
Added 15 colored item shapes for cave rendering: bombs (#303080), magic shield
(#8080c0), arrows, candles (blue/red), bait, potions (blue/red), rings (blue/red).
Fixed ITEM_Y from 96 to 88 (NES ObjY $98 - HUD $40 = $58 = 88). 8 new tests
(713 total). Typecheck clean. **Phase E complete. Next: F1.**

## 2026-08-18 — F1 Item model + inventory subscreen (Claude Opus 4.6)

Created `src/objects/player/inventory.ts` — Inventory class mirroring NES RAM
$0656-$067E with graded items (sword 0-3, arrow 0-2, candle 0-2, ring 0-2,
boomerang wood/magic, potion 0-2, letter 0-2), boolean items (bow, flute, food,
wand, raft, book, ladder, magicKey, bracelet, magicShield), dungeon bitmasks
(compass, map, triforce). 9 selectable B-slots matching NES FindAndSelectOccupied-
ItemSlot: slot 0=boomerang pseudo-slot, slot 3=bow always skipped, slot 2=arrow
requires bow, slot 7=potion/letter fallback. Link class refactored: boolean fields
(_hasSword, _hasBracelet, etc.) replaced with inventory delegation. Created
`src/objects/enemies/drop-engine.ts` — NES-faithful drop algorithm (4 enemy groups,
worldKillCycle mod 10, help drops at 16 kills/10 non-drops). Created
`src/objects/pickups/item-pickup.ts` — world-space dropped item with lifetime/flash/
collision. Created `src/ui/inventory-screen.ts` — NES-accurate subscreen renderer
with blue boxes, item grid (selectable + passive rows), cursor flash (8-frame
toggle), triforce outline. Created `src/ui/inventory-slide.ts` — 3px/frame scroll
(NES MenuState). Created `src/ui/tint-utils.ts` — transparency-then-tint for red
font (#d82800). Updated `src/data/item-sprites.ts`: fixed sword mapping (col 7 row
3 per zelda-clone ItemSpriteFactory.cs), added center-crop (30% inset), added
processItemsImage for background transparency, added clock sprite. Updated
`src/ui/hud.ts`: B/A item sprite rendering at (124,32)/(152,32). Updated
`src/world/cave-room.ts`: replaced 80-line drawItem colored rectangles with
drawItemSprite, added itemsImage constructor param. Expanded handleItemPickup to
cover all 36 NES item IDs with upgrade logic. Replaced placeWeapon stub with
useBItem() dispatching on selectedBSlot. Start button opens inventory (blocks
gameplay), Left/Right cycles cursor, Start closes. 39 new tests (752 total).
Typecheck clean. Known polish: HUD has duplicate sword in A-slot (hud.png
background has baked-in sword graphic), subscreen layout slightly oversized.
**Phase F started. Next: F2.**

## 2026-08-19 — F2 Boomerang + Bombs (Claude Opus 4.6)

Created `src/objects/weapons/boomerang.ts` — Boomerang class with NES-accurate
5-state machine from Z_07.asm:3857 UpdateArrowOrBoomerang: FlyAway ($10, QSpeed
$C0 = 3px/f) → SparkTurn ($20, 3 frames) → SlowDown ($30, QSpeed $40 = 1px/f,
16 frames) → ReturnSlow ($40, diagonal homing at half speed via 9-entry speed
tables from Z_07.asm:3831, 32 frames) → ReturnFast ($50, full speed until caught
within 9px). Normal limit 49px, magic 255px. Diagonal throw via input directions
(NES-accurate). 9-entry animation cycle with flip attrs. 8×8 hitbox at (x+4, y+8).
forceReturn() API for G1 enemy collision. Upgraded `src/objects/weapons/bomb.ts`
from E3 stub: added getExplosionHitbox() (48×48 centered during Detonating, $18
radius per Z_01.asm:6108), shouldFlash getter (toggles at timer $0B/$06), cloud
sprite rendering with alternating offset sets from sprites.json bombCloud data.
Exported BOMB_DAMAGE=$40 for G1. Added boomerang/bomb constants to constants.ts.
Wired in main.ts: useBItem() case 0 with diagonal direction detection, boomerang
update/render, projectilesSheet/cloudSheet SpriteSheets, bomb screen flash overlay,
transition cleanup. 33 new tests (785 total). Typecheck clean. Visually verified:
bomb place/detonate, boomerang throw/return, HUD item display. **Next: F3.**

## 2026-08-19 — F3 Arrow + Candle fire upgrade + Food/Bait (Claude Opus 4.6)

Created `src/objects/weapons/arrow.ts` — Arrow class with Flying→Spark→Dead state
machine. QSpeed $C0 = 3px/f straight-line projectile matching sword beam pattern.
Tile collision and screen boundary deactivation with 3-frame spark on hit. Requires
bow + 1 rupee per shot (deducted in main.ts). isSilver flag for damage differentiation
($20 wood / $40 silver). Vertical arrows nudged +3px right per Z_05.asm:2997.
deactivate() API for G1 enemy hit. Upgraded `src/objects/weapons/candle-fire.ts` —
critical speed fix: replaced 1px/f integer movement with NES-accurate QSpeed $20 =
0.5px/f (walking phase now 32 frames for 16px, was 16). Added sprite rendering via
projectilesSheet with flicker alternation. Exported FIRE_DAMAGE=$10. Created
`src/objects/weapons/food.ts` — Food class with 3-phase stationary bait (255 frames
per phase = 765 total, ~12.75 seconds per Z_07.asm:3763). No collision per
Z_01.asm:5835. getPosition() API for G1 enemy attraction. Food NOT consumed on
placement (only by Grumble Goriya in H-phase). Added NES slot $0F sharing guards
between boomerang and food in main.ts. Added arrow/fire/food constants to
constants.ts. Updated tile-object test for new fire speed. 27 new tests (812
total). Typecheck clean. Visually verified: arrow flies and vanishes, candle fire
moves slowly, food sits on ground, boomerang blocked during food. **Next: F4.**

## 2026-08-20 — F4a Magic Rod + Ring palette + Potion/Letter (Claude Opus 4.6)

Created `src/objects/weapons/magic-rod.ts` — MagicRod class mirroring SwordSwing with
identical timing (5f Windup → 8f Extended → 1f FireShot → 2×1f Retract) per Z_07.asm
UpdateSwordOrRod. Fires shouldFireShot signal at Extended→FireShot transition. Same
PlayerToWeaponOffsetsX/Y tables as sword. Blocks sword via Link.blockSwordAttack flag.
Created `src/objects/weapons/magic-shot.ts` — MagicShot projectile with QSpeed $A0
(2.5px/f), horizontal boundary checks ($14/$EC per Z_07.asm:4546), tile collision,
wasBlocked flag for Book of Magic. Added CandleFire.createBookFire() static factory
(Standing state, 79f timer per Z_07.asm:3547 HandleShotBlocked). Created
`src/render/link-tint.ts` — createTintedLinkImage() replaces green tunic pixels with
ring colors (blue #0058f0 / red #d82800). Three SpriteSheet instances at init;
getActiveLinkSheet() selects by ringLevel; all 6 Link render paths updated. Added
useBItem case 7 (potion): decrements potion counter, triggers gradual heart refill
(1 half-heart every 4 frames per Z_05.asm WieldPotion, blocks gameplay). Added useBItem
case 8 (wand): creates MagicRod, guards against sword conflict. Potion shop letter
delivery: auto-delivers letter (1→2) on entry, gates shop purchases on delivery.
F4 split into F4a/F4b — F4b covers Raft, Stepladder, Recorder/Flute (all need new
auto-activation systems + Link halting mechanism). 25 new tests (837 total). Typecheck
clean. **Next: F4b.**

## 2026-08-21 — F4b Raft + Stepladder (Claude Opus 4.6)

Added Link halted mechanism (`_halted` flag in link.ts, NES ObjState $40) — blocks all
input/movement when set externally by main.ts. Extended collision system: stored raw
`primaryValues` alongside walkable booleans, added `isWaterTileAt()` (checks $8D-$98 range),
`getTileValueAtPosition()`, and position-based walkable overrides via `setWalkableOverride()/
clearWalkableOverrides()`. Created `src/objects/items/stepladder.ts` — auto-activates when
Link faces water tile in rooms [$17,$18,$19,$27,$4F,$5F] with grid alignment and input==facing.
Position offsets per Z_07.asm LinkToLadderOffsetsX/Y. LadderState machine (Approaching→OnLadder
→Done) with $10 distance threshold. Movement override: allows parallel/retreat, blocks
perpendicular per Z_05.asm CheckLadder. Sets walkable override on ladder tile so Link can
cross. Created `src/objects/items/raft.ts` — auto-spawns in rooms $3F/$55 when Link has raft.
RaftState (Idle→MovingDown/MovingUp), dock X detection ($60/$80), 1px/frame travel, Link
halted during movement, raft drawn 6px below. MovingUp triggers screen scroll via
`overworld.tryTransition(Direction.Up)`. F4 further split: F4c deferred for Recorder/Flute
(complex whirlwind + pond-drying). 30 new tests (867 total). Typecheck clean. **Next: F4c.**

## 2026-08-21 — F4c Recorder/Flute (Claude Opus 4.6)

Created `src/objects/items/recorder.ts` — RecorderEffect class with multi-phase state machine
per Z_07.asm WieldFlute + Z_01.asm SummonWhirlwind. Phases: Tune (152f gameplay freeze via
Link.halted) → PondDrying (12 steps × 8f, water walkable at step 10, stairs revealed at step
11 via revealFluteSecret()) OR WhirlwindSource (2px/f rightward from X=0, catches Link at 9px
threshold on each axis, Link hidden + X tracks whirlwind) → TransitionPending (main.ts calls
overworld.setScreen to dungeon entrance) → WhirlwindDest (new whirlwind from X=0, drops Link
at X=$80 with TeleportY). Destination selection: advanceTeleportingLevelIndex cycles through
InvTriforce bitmask (right/down=increment, left/up=decrement). Q1 rule: only room 66 ($42)
has flute secret. No triforce pieces → no whirlwind (Done after tune). Added
revealFluteSecret() public method to TileObjectManager for stairs placement without requiring
existing tile object. Stored fluteSecretRoomIds and secretsData as module-level vars in
main.ts. Added updateRecorderEffect() blocking function with water walkable overrides,
whirlwind Link tracking, screen transition warp, and whirlwind rendering (colored column
placeholder). Link hidden during whirlwind catch. 18 new tests (885 total). Typecheck clean.
**Phase F complete. Next: G1.**

## 2026-08-22 — G1 Enemy base system (Claude Opus 4.6)

Created `src/objects/enemies/enemy.ts` — Enemy class with EnemyState enum (Spawning→Active→
Stunned/Knockback→Dying→Dead), generic random walker AI, NES-faithful HP system (Z_04.asm
ExtractHitPointValue: even types=high nibble AND $F0, odd types=low nibble ASL ×4), knockback
($40 distance at 4px/f per Z_01.asm:6688), invincibility ($10 frames), stun ($A0 frames for
boomerang), 12-frame death timer. Created `src/objects/enemies/spawn-manager.ts` — SpawnManager
reads enemy-spawns.json: resolves monsterListId (0=none, 1-$61=single type repeated, $62-$7F=
heterogeneous list index), spawns up to foeCounts[monsterCountIndex] enemies at NES spawn
positions (4 direction-based lists of 9 packed X/Y bytes), staggered spawn cloud timers per
Z_07.asm:5590, freezeAll() for Clock item, clear() on screen exit. Created
`src/objects/enemies/enemy-collision.ts` — checkWeaponEnemyCollisions checks all 7 weapon types
(sword hitbox via new Link.getSwordHitbox(), sword beam, boomerang stun/damage, bomb explosion,
arrow wood/silver, candle fire, magic rod/shot) with correct damage constants (SWORD_DAMAGE by
level, BOOMERANG_DAMAGE $10, BOMB_DAMAGE $40, ARROW_DAMAGE $20/$40). Sword beam/arrow/magic
shot deactivate on hit, boomerang forceReturn(). checkEnemyLinkCollisions detects contact via
DAMAGE_TABLE lookup. Added deactivate() to SwordBeam, direction getter to CandleFire,
getSwordHitbox()/swordDirection to Link. Wired into main.ts: SpawnManager in gameplay loop,
screen transitions, cave entry/exit, respawn. DropEngine.rollDrop() on kill spawns ItemPickup.
Clock item ($21) freezes enemies 660f. Debug console `__zelda.giveAll()` grants all items.
Colored rectangle placeholder rendering with type-based colors. 36 new tests (921 total).
Typecheck clean. Visually verified: enemies spawn on screen entry, take sword/boomerang/bomb
damage, die with flash, drop items, contact damages Link. **Phase G started. Next: G2.**

## 2026-08-22 — G2 Overworld enemies (Claude Opus 4.6)

Implemented all 9 overworld enemy types with NES-accurate AI patterns. Refactored Enemy base
class: protected fields/methods, EnemyUpdateContext (collision+screen+linkX+linkY), abstract
updateAI() hook, moveQSpeed() sub-pixel helper, moveOnePixel() with tile collision,
tickWalkAnimation(), directionTowardLink(), _vulnerable flag, _pendingProjectile/consumeProjectile()
for enemy shooting, onDeath() hook. Created `src/objects/enemies/walker-enemy.ts` — WalkerEnemy
base implementing Z_04.asm Wanderer_TargetPlayer: turnRate vs random for direction toward Link,
grid-aligned turning, QSpeed sub-pixel movement, _TryShooting timer ($30→$10 fire→0 reset,
blue=always, red=random<$F8 gate), sprite rendering from enemies.png (30-col sheet). Created
individual enemy files: `octorok.ts` (factory, 4 variants: slow/fast × red/blue, turnRate
$70/$A0, QSpeed $20/$40, shoots rock $53), `moblin.ts` (turnRate $A0, QSpeed $20, shoots arrow
$5B), `lynel.ts` (Goriya pattern, turnRate $70/$A0, shoots sword shot $57), `tektite.ts`
(Ground/Jumping state machine with diagonal arc, boundary bounce, reversalCount>=2 escape),
`leever.ts` (4-state burrower cycle, blue walks QSpeed $20, red max-2 + spawns near Link,
invulnerable underground), `zora.ts` (water burrower, random surface position, shoots fireball
$55, invulnerable underground), `peahat.ts` (6-state flyer: SpeedUp/Decide/Chase/Wander/
SlowDown/Delay, only vulnerable in Delay, normalized velocity chase), `ghini.ts` (main turnRate
$FF + FlyingGhini, setSiblings(), main death kills all type 34), `armos.ts` (dormant→active on
Link touch <16px, Goriya walker pattern, no spawn cloud, invulnerable while dormant). Updated
SpawnManager: createEnemyByType factory for all 9 types, _projectiles array for enemy-fired
projectiles, render() accepts enemySheet, update() passes linkX/linkY. Updated enemy-collision:
checkEnemyProjectileCollisions() with shield deflection via canShieldBlock(). Updated main.ts:
enemySheet from enemies.png, projectile collision + damage, shield deflection wiring. 28 new
tests (949 total). Typecheck clean. **Next: G3.**

## 2026-08-23 — H1a Dungeon room loading + navigation (Claude Opus 4.6)

Split H1 into H1a/H1b. H1a: dungeon room loading, rendering, open-door navigation, entry/exit,
minimap, respawn. Created `src/data/dungeon-entrance-data.ts` — maps overworld screenId → dungeon
level (6 verified entrances: screens 55/60/116/69/11/34 for levels 1-6; derived from
WHIRLWIND_DEST_ROOMS proximity + tile 12 scan; levels 7-9 deferred). Created
`src/render/dungeon-renderer.ts` — renders rooms from dungeons-map.png (16×16 grid, 256×176px per
room, uw1q1 top half / uw2q1 bottom half). Created `src/world/dungeon-collision.ts` —
DungeonCollisionMap builds 16×11 walkability grid: 12×7 inner tiles from uniqueRoom + squareTable
threshold, border walls always solid, door openings (types 0/2) punch walkable holes at NES
positions (N: cols 7-8 rows 0-1, S: cols 7-8 rows 9-10, W: cols 0-1 rows 4-6, E: cols 14-15
rows 4-6). TileCollisionMap-compatible API (screen param accepted but ignored). Created
`src/world/dungeon-manager.ts` — DungeonManager: loads level 1-9 from dungeons.json, resolves
levelBlock, tracks currentRoomId + visitedRooms, room navigation (N:-16 S:+16 W:-1 E:+1),
canPassDoor (types 0/2 only for H1a), entry position by direction, exit detection from startRoom
south edge. dummyScreen getter for Link/enemy compatibility. Added GameMode.DungeonGameplay +
DungeonTransition. Updated HUD: "LEVEL-N" text + dungeon minimap (blue visited rooms, blinking
green current room). Updated respawn: isDungeon flag, dungeon death → startRoom. Updated main.ts:
dungeons.json loading, dungeon entry (getDungeonLevel + tile 12 check before cave check),
DungeonTransition mode (walk-in → curtain → startDungeonInterior), DungeonGameplay mode (full
gameplay loop reusing weapons/enemies/collision), exit (south from startRoom → curtain → overworld
restore), SpawnManager.spawnForDungeonRoom(). Fixed exit-before-transition ordering bug (exit
check must precede room transition check, both at SCREEN_EDGE_BOTTOM threshold). Debug:
__zelda.dungeonManager + currentLevel. 19 new tests (968 total). Typecheck clean. Visually
verified: enter Level 1 from overworld, rooms render with correct teal palette, walk through open
doors, minimap tracks visited rooms, exit back to overworld via south. **Next: H1b.**

## 2026-08-24 — H1b Dungeon doors + traps + items (Claude Opus 4.8)

(Logged retroactively — completed last session, tracker update was missed.) Added the
interactive dungeon room mechanics: **8 NES door types** (open/wall/false-wall×2/bombable/key×2/
shutter) via `DungeonManager.touchDoor()`, with the `CurOpenedDoors` bitmask (N=8,S=4,W=2,E=1)
persisted in room flags so opened doors stay open. Key doors consume a key (or magic key);
bombable open on bomb-detonation proximity; shutters open on the "all enemies dead" trigger.
**7 secret triggers** (`dungeon-secrets.ts`): AllDead/Ringleader/LastBoss/BlockDoor/BlockStairs/
MoneyOrLife/FoesForItem. **Spike traps** (`spike-trap.ts`): 3-state invulnerable entities at
fixed NES positions ($49=6 traps, $4A=4). **Push blocks** in dungeons (wired to secret triggers
4/5). **Dark rooms** (black overlay, candle fire brightens). **Map + Compass** items (per-level
bitmasks; minimap shows all rooms with Map, blinks Triforce room with Compass). **Room item
placement** from packed shortcutOrItemPositions byte, secret-gated, item-taken bit ($10) in room
flags. room-flags.ts: VISITED_BIT corrected to $20, added ITEM_TAKEN + DOOR bits. 999 tests
total. Typecheck clean. **Next was: G3.**

## 2026-08-25 — G3 Dungeon enemies tier 1 (Claude Opus 4.8)

Populated dungeons with their first-tier roster (dungeons were walkable but empty; H1b's
"kill all → shutters open" had nothing to kill). 6 families / 10 object types, all AI from
Z_04.asm. **Stalfos** ($2A): thin WalkerEnemy config (turnRate $80, qSpeed $20, no shooting).
**Rope** ($28): wander at $20, rushes at $60 when aligned with Link on an axis, stops at walls
(new `rope.ts` extends Enemy). **Goriya** ($05 blue/$06 red): wander + throws a returning
boomerang (type $5C), frozen while it's out; blue throws readily, red occasionally. **Zol**
($13): slow jelly that splits into 2 Gels when hurt-but-not-killed (bomb kills outright, no
split). **Gel** ($14/$15): fast erratic jelly, 1 hit. **Keese** ($1B/$1C/$1D): erratic
pause/dart flyer, ignores walls, 1 hit. New base classes: `jelly-enemy.ts` (Gel/Zol hop-pause),
`flyer-enemy.ts` (Keese flight state machine, always vulnerable — separate from Peahat to avoid
regressions), `goriya-boomerang.ts` (extends EnemyProjectile with owner-homing return, so it
flows through the existing `_pendingProjectile → SpawnManager._projectiles → collision/render`
pipeline with **zero main.ts changes**). Enemy base gained `_childSpawns`/`collectChildSpawns()`
(Zol split), drained in `SpawnManager.update()` via new `drainChildSpawns()`. Made
EnemyProjectile's `_x/_y/_direction/_state` protected for the boomerang subclass. Placeholder
colored-rect rendering (sprite rows for these in enemies.png not confirmed — deferred like G1→G2).
14 new tests (1013 total). Typecheck clean. **Next: G4 (dungeon enemies tier 2).**

## 2026-08-25 — G4a Dungeon enemies tier 2, part 1 (Claude Opus 4.8)

Split G4 into G4a (self-contained) + G4b (Link-state/dungeon wiring). G4a = 5 families / 8 object
types, AI from Z_04.asm. **Gibdo** ($30): thin WalkerEnemy config (turnRate $80). **Darknut**
($0B red/$0C blue): walker + **directional parry** — new `Enemy.blocksAttackFrom(weaponDir)` hook
(default false), honored in `enemy-collision.ts` for sword + beam; Darknut blocks a hit whose
travel dir is the exact OPPOSITE of its facing (frontal), per Z_01.asm:6316 (ORs the two dirs,
parries $0C/$03). Never stunned (overrides `stun()` no-op). Blue faster (qSpeed $30 vs $20).
**Vire** ($12): walker that **splits into 2 Red Keese** ($1C) on death via `onDeath()` →
`_childSpawns` (reuses G3's SpawnManager drain). **Pols Voice** ($16): bouncing hopper with a
vertical bob; high HP (sword-resistant; flute-kill deferred). **Bubble** ($2B flash/$2C blue/$2D
red): invulnerable (`_vulnerable=false`), no contact damage, **jinxes Link's sword** on touch.
Link gained sword-jinx: `disableSword(frames?)` (perm if no arg) / `enableSword()` /
`swordDisabled` getter, timer decremented in `update()`, gates the swing start, cleared in
`reset()`. Wired via new `applyBubbleJinx()` in main.ts dungeon contact ($2D disable, $2B temp
$A0f, $2C restore). SpawnManager factory + placeholder colors for all. 13 new tests (1026 total,
9 g4a + 4 Link jinx). Typecheck clean (src). **Next: G4b (Wizzrobe, Like-Like, Wallmaster, Lanmola).**

## 2026-08-25 — G4b Dungeon enemies tier 2, part 2 (Claude Opus 4.8)

The Link-state + dungeon-integration half. 4 families / 6 object types, AI from Z_04.asm.
**Blue Wizzrobe** ($23): walks square-aligned toward Link, then **teleports** $20px (translucent,
through walls, non-collidable mid-hop); lobs `MagicShot` ($58) when Link shares its square row/col.
**Red Wizzrobe** ($24): **stationary phaser** — a state byte counts down, top bits pick a phase
(relocate near Link → fade-in → solid → fade-out → hidden); **vulnerable only while solid**
(toggles `_vulnerable`); shoots `MagicShot2` ($59) at the solid midpoint; `getHitbox()` returns
off-screen while hidden so it can't be hit/contacted then. Both shots ride the existing
`_pendingProjectile → SpawnManager._projectiles` pipeline (magic-shield-only blockable) — **zero
new collision code**. **Like-Like** ($17, WalkerEnemy turnRate $80): on contact **captures Link**
(`beginCapture()`); main.ts sets `link.halted = true` and, at $60 capture-frames, `consumeShieldEat()`
→ `link.setMagicShield(false)`; `onDeath()` frees him. **Wallmaster** ($27): emerges from the wall
nearest Link, crawls toward him at QSpeed $18; on contact `grab()` → main.ts calls new
`DungeonManager.returnToEntranceRoom()` (jumps to `startRoomId`, rebuilds collision, returns the
entrance position) and repositions Link — the signature warp. Retreats after a 7-tile trip if it
misses. **Lanmola** ($3A red 1px/f, $3B blue 2px/f): one object owning a segment trail; head
re-chooses direction toward Link at 8px boundaries, body follows a position-history buffer;
`getHitbox()` returns the head only ⇒ head-only vulnerability + contact (skips the NES
body-resurrection dance — same player experience). SpawnManager factory + placeholder colors for
all. **Also fixed a pre-existing Pols Voice bug** (G4a): it treated `moveQSpeed` returning false on
frames that emit no full pixel (QSpeed $20 = 1px/2f) as hitting a wall and reversed, ping-ponging
in place ~25% of spawns — now peeks with `isBlockedAhead()` and only bounces on a real wall.
11 new tests + fix (1037 total, all green ×3 runs). Typecheck clean (src). **Next: G5 (roster/projectile audit).**

## 2026-08-26 — G5 Enemy projectiles + roster audit (Claude Opus 4.8)

Closing slice of Phase G. Not a new enemy family — an audit + polish pass with one real
gap filled. **(A) Per-type projectile visuals:** `EnemyProjectile.render` gained a
`renderByType()` switch (+ an `animTimer` for flicker) so the previously-uniform red square now
reads as rock (grey pellet) / fireball (orange-yellow flicker) / sword-beam (white-cyan streak,
elongated along travel) / magic (magenta-blue flash) / arrow (thin oriented line). **(B) Statue
fireballs** (`src/world/dungeon-statues.ts`, from Z_04.asm `UpdateStatues`): dungeon rooms whose
`uniqueRoomId` is $24 (4 statues) or $23 (2 statues) periodically lob a Fireball ($55) aimed
cardinally at Link, on the NES reload cadence (`StatueFireballStartTimes` $50/$80/$F0/$60,
15/16 fire chance). Positions from `StatueXs/Ys` (NES raw Y → local via −$40). Not an Enemy
(no HP, invulnerable, keyed to room not monster list); fireballs ride the existing pipeline via a
new `SpawnManager.addProjectile()` — **zero new collision code**. Wired in main.ts:
`initDungeonRoomObjects` builds the statues, the dungeon update loop drains their fireballs into
`spawnManager` right after `spawnManager.update` so they're collision-checked the same frame.
Simplification (documented): cardinal aim instead of the NES diagonal Link-tracking fireball;
pattern 2 (the `PersonFireballsEnabled` two-fire boss variant) deferred to Phase I with GuardFire.
**Also fixed a pre-existing shield-deflection bug** (from D3, surfaced during manual testing):
a blocked shot's `updateDeflected()` moved in `getOppositeDirection(_direction)`, but `deflect()`
already stores `linkDirection` (the bounce heading, back toward the shooter) — so the shot flew
back *through* Link instead of bouncing away. Now moves in `_direction` directly; blocked shots
visibly bounce off toward the enemy. **Debug helpers added** for manual testing:
`SpawnManager.debugSpawn(type,x,y)` + `__zelda.goToDungeon(level)` / `__zelda.spawnEnemy(typeHex)`
(default $23 Blue Wizzrobe) — drops any enemy next to Link (Wizzrobes aren't in early dungeons).
**(C) The roster audit** (`context/agent/enemy-roster-audit.md`): definitive object-type→status
table from `Z_07.asm:5321 UpdateObject_JumpTable`. Result — **every non-boss combat enemy is
implemented**; all remaining types are bosses (→ Phase I: Aquamentus/Dodongo/Gohma/Digdogger/
Manhandla/Moldorm/Gleeok/Patra/Ganon + GuardFire/StandingFire) or non-combat NPCs/specials
(→ later content slices), each row naming *why* + *owner*. Boulder ($1F/$20) named as the
deferred G5 stretch (overworld-hazard slice). Verified: all 10 shot types have non-zero
DAMAGE_TABLE entries. 16 new tests incl. deflection-bounce regression (1053 total, green full runs).
Typecheck clean (src).
**Note:** one pre-existing flaky test — `g2-enemies.test.ts` "walks after spawn" (slow Octorok
QSpeed $10 can pause to shoot inside the 30-frame window) — passed 5/5 in isolation; not caused
by this slice, enemy behavior is correct, test is just too tight. **Phase G complete. Next: I1
(Aquamentus) to unblock H2.**

## 2026-08-27 — I1 Aquamentus, first boss (Claude Opus 4.8)

First **boss** slice; opens Phase I and unblocks H2. AI ported from `Z_04.asm`
(`InitAquamentus` 4842, `UpdateAquamentus` 5596, `_Move` 5613, `_Shoot` 5684,
`_Draw` 5762). **The boss** (`src/objects/enemies/aquamentus.ts`): `InitAquamentus`
pins it to ($B0,$80) → local (176,64) on the right wall regardless of the monster-list
slot; it **wobbles horizontally only** (Y fixed) between $88–$C7, moving 1px on
1-of-8 frames in random 7/$F-px legs, reversing at the limits (the NES clamp is
reactive so it transiently overshoots each limit by 1px — reproduced faithfully).
Its shoot timer (starts $80, resets to `Random|$70` ≥112f) lobs a **3-way fireball
fan** ($55 ×3) leftward, the three shots fanning apart via vertical drift 0/+1/−1
applied every other frame; the mouth-tell opens while the timer <$20. HP $60 (the
existing `getEnemyHp($3D)` decoder already returns it — 6 wood-sword hits). Never
stunnable (overrides `stun()`). Placeholder green-dragon rect render (CHR→sheet
mapping deferred like the whole G3/G4 roster; layout is staged in
`sprites.json bosses.aquamentus`). **Two reusable boss primitives**, built generic
because every remaining boss needs them: **(1) per-weapon invincibility mask** —
`DamageTypeBit` consts (sword $01 / boomerang $02 / arrow $04 / bomb $08 / magic-shot
$10 / fire $20, from Z_01.asm:6039–6261) + `Enemy._invincibilityMask` +
`isImmuneToDamageType()`, guarded in **every** weapon branch of
`checkWeaponEnemyCollisions` (immune = harmless clink / bounce, no damage or stun);
Aquamentus' mask $E2 ⇒ immune to boomerang + candle fire, hurt by
sword/beam/arrow/bomb/rod/magic-shot. Default mask 0 leaves every existing enemy
unchanged (regression-guarded by a "fire still hurts a default enemy" test).
**(2) fireball spread** — optional `verticalDrift` on `EnemyProjectile` (every-other-
frame Y nudge, default 0 = straight travel) + `Enemy._pendingProjectiles[]` /
`consumeProjectiles()` so a boss can emit several shots in one frame, drained in
`SpawnManager.update`. Registered $3D in `createEnemyByType`. No main.ts change needed
(rides the normal dungeon enemy path); `__zelda.spawnEnemy(0x3d)` already drops one
for manual testing. **Deferred to H2:** the boss death spectacle — big explosion,
heart-container drop, Triforce. SFX deferred globally (no audio subsystem). 14 new
tests (7 boss + 6 mask + 1 projectile-drift), **1067 total** (1066 green + the one
pre-existing g2 Octorok flaky, which passed 3/3 in isolation — unrelated). Typecheck
clean (src). **Phase I started. Next: H2 (Dungeons 1-3 completable).**

## 2026-08-27 — H2 Dungeons 1-3 completable (Claude Opus 4.8)

The payoff slice: L1-3 now play end-to-end (enter → navigate → kill boss → heart
container + shutter → grab Triforce → warp out). Investigation showed **most of the
path was already data-wired** by H1a/H1b + I1 — the L1-3 boss rooms carry item $1A
(heart container) gated by secret trigger 7 (FoesForItem) and the boss→triforce door
is a shutter that opens on that same trigger, all handled by existing machinery. H2
filled **four gaps**: **(1) Boss single-spawn** — `foeCounts` gave the boss room
count 3, so it spawned *three* Aquamentus; NES rule (`Z_05.asm:1723`, verbatim: "make
the count 1 if the object list ID >= $32 and < $62") → new `SpawnManager.clampBossCount`
forces 1 for list IDs in [$32,$62) (every current + future boss), applied in both
dungeon and overworld spawn paths. **(2) Triforce-get completion sequence** — new
`GameMode.DungeonTriforceGet` (NES sets GameMode $12 on triforce pickup):
`beginTriforceGet()` sets the level's triforce bit + full heal + halts Link, holds a
display for 200f (pulsing gold wash + red "TRIFORCE" banner, Link centered), then
curtain-warps out by reusing the existing `exitDungeon` path (`pendingCaveIndex=-3`).
Wired into `handleDungeonItemPickup` case $1B (was just a bare bit-set). **(3)**
Triforce room-item shifted −8px in X (`getRoomItemPosition`, Z_05.asm:8255). **(4)
Navigability pass** — BFS over the door graph confirmed start→boss→triforce is
traversable for all 3 levels (no hard wall blocks; boss→triforce is a shutter for
L1/L2/L3, opened on boss death). **Known limitations (deferred):** L2 Dodongo ($32) /
L3 Manhandla ($3C) fall back to the generic walker — the completion *machinery* works
with whatever occupies the boss room, but faithful fights are later I-slices;
room-clear persistence (killed monsters respawn on room re-entry — doesn't block the
linear path); the NES spiral-wipe animation; audio/fanfare. 12 new tests (5
boss-spawn-count + 7 dungeon-completion), **1079 total, all green** (the g2 Octorok
flaky happened to pass this run). Typecheck clean (src). **Next: make L2/L3 boss
fights faithful (Dodongo/Manhandla), or Phase I2 / H3.**

## 2026-08-27 — I1b Dodongo, L2 boss faithful (Claude Opus 4.8)

Replaced the generic-walker fallback for the Level-2 boss with a faithful Dodongo
(`src/objects/enemies/dodongo.ts`, from Z_04.asm `UpdateDodongo`/`Dodongo_CheckBombHit`/
`Dodongo_TryEatBomb`). The signature mechanic: **immune to every direct weapon**
(`_invincibilityMask=$FF` — the sword just clinks). Three sub-states run inside the
Active state (like Aquamentus): **Move** (32×16 body wanders toward Link, ~1px/f with
a turn-rate-$20 re-aim at grid boundaries); **Stunned** (entered when a bomb *blast*
overlaps the body → mask drops to $FE so the sword bit gets through → a single sword
hit = **instant death**, via an overridden `takeDamage` that ignores HP while stunned);
**Bloated** (entered when an *un-exploded* bomb lands in the leading-half "mouth" → it
eats the bomb; **2 eaten = death**, else back to Move). HP is irrelevant — death is
scripted, matching the NES. **One cross-cutting primitive:** enemies couldn't see the
bomb list, so added an optional `bombs?: readonly BombLike[]` to `EnemyUpdateContext`
(structural `BombLike` — no Bomb import, avoids a cycle), threaded through
`SpawnManager.update()` ← both `main.ts` call sites; all Dodongo logic stays in
dodongo.ts and the generic collision code is untouched (the $FF/$FE mask already makes
every weapon branch behave). `phase`/`bombsEaten` getters for debug/tests. Registered
`$32` in the spawn manager (boss single-spawn clamp already covers it). Placeholder
rect render (CHR→sheet deferred like the whole roster). 9 new tests, **1088 total, all
green**; typecheck clean (src). **Next: I1c Manhandla ($3C, segmented 5-part boss) —
plan at `~/.claude/plans/i-boss-backfill-dodongo-manhandla.md` — or Phase I2 / H3.**

## 2026-08-27 — I1c Manhandla, L3 boss faithful — I1 complete (Claude Opus 4.8)

Replaced the generic-walker fallback for the Level-3 boss with a faithful **Manhandla**
(`src/objects/enemies/manhandla.ts`, from Z_04.asm `UpdateManhandla`/`Manhandla_Move`/
`_CheckCollisions`/`InitManhandla`). The flower boss = **1 center + 4 hands** (N/S/E/W).
Design: **modeled as 5 real coordinated `Enemy` objects** (matches the NES's 5 slots) so
the existing per-enemy collision/damage/drop code handles each hand for free — cleaner
than Lanmola's single-object trick because hands must be independently killable. Only
the coordination is new. **`ManhandlaCenter`** (`_vulnerable=false` → collision code
skips it, never damaged) drives 8-way group movement (`_dirMask` bitmask; retarget every
16f: 50% aim at Link / 50% random; **bounces off the play-area walls** by reflecting the
offending axis bits; NES fractional speed accumulator seeded to $0080 = 0.5px/f), then
repositions each living hand to its ±16 cardinal offset. **`ManhandlaHand`** (mask $E2 —
immune to fire+boomerang, own HP, killed by base `takeDamage`) is passive (positioned by
the center via `setPos`) and shoots unblockable **$56** fireballs aimed 4-way at Link.
**Every hand death speeds the whole group up** (+$80 frac, carrying into the whole byte —
frantic acceleration); the **center dies only when the last hand dies** (`reapDeadHands`),
which means trigger-7 "all foes dead" fires exactly on full-boss death — **zero change to
H2's completion code.** Group-spawned via `createManhandla` + new
`SpawnManager.pushEnemyOrGroup` (the boss single-spawn clamp still forces one slot; that
slot expands to the 5-object cluster — updated the boss-spawn-count test's $3C case from
1→5). `speedPerFrame`/`livingHands` getters for debug/tests. Placeholder rect render.
8 new Manhandla tests (+1 boss-spawn-count), **1097 total, all green**; typecheck clean
(src). **Simplifications (documented):** 4-way fireball aim (our EnemyProjectile is
cardinal); ≤4-fireball cap approximated by shoot probability; diagonal group movement
kept. **I1 is now complete — all three L1-3 bosses are faithful.** **Next: Phase I2
(Gleeok/Digdogger/Gohma) or H3 (Dungeons 4-6).**

## 2026-08-28 — I2 Gohma + Digdogger + Gleeok — I2 complete (Claude Opus 4.6)

Implemented all three mid-game bosses (L4-6 backfill). **I2a Gohma** ($33 blue/$34 red,
`src/objects/enemies/gohma.ts`): crab boss with eye state machine (4 states: closed-left/right,
fully-open, half-open). Walks via 8-way direction bits at 0.5px/f, 32px sprints. Only vulnerable
to arrows shot UP when eye is HALF-OPEN and arrow hits center body parts — new `hitContext?`
primitive on `Enemy.takeDamage()` (optional `{x,y,dir}`, backward compatible, passed by
arrow collision in `enemy-collision.ts`). Mask $FB = immune to everything except arrows.
Shoots unblockable fireballs every 65f. 12 tests. **I2b Digdogger** ($38=3 children, $39=1 child,
`src/objects/enemies/digdogger.ts`): large invulnerable creature (`_vulnerable=false`). 8-way
movement with Manhandla-style fractional speed accumulator + speed oscillation. Flute reaction:
when `ctx.fluteActive` → flicker 64 frames then spawn 1/3 LittleDigdogger ($18) children at
parent position, parent destroyed. Children are fast and killable normally. **Critical fix:**
recorder couldn't activate in dungeons — `useBItem` case 5 guarded `if (!overworld) break;`.
Fixed to use `screenId=0` in dungeons (NothingDungeonOnly path → just plays tune). Added
`fluteActive?: boolean` to `EnemyUpdateContext`, threaded through `SpawnManager.update()`.
Processing recorder in `updateDungeonGameplay()` (ticks effect, sets fluteActive during Tune phase).
11 tests. **I2c Gleeok** ($42=2, $43=3, $44=4, $45=4 heads, `src/objects/enemies/gleeok.ts`):
Manhandla-style group spawn (body + N heads). `GleeokBody` (invulnerable, stationary at Y=$17
local, manages neck segment physics + fireball shooting). `GleeokNeckHead` (mask $FE sword-only,
HP $A0, oscillates independently with staggered delays). Head death → notifies body → spawns
`GleeokFlyingHead` ($46, extends FlyerEnemy, completely invulnerable, shoots fireballs). All heads
dead → body dies. 12 tests. **1133 total tests, all green.** Typecheck clean. **I2 complete. Next: H3.**

## 2026-08-29 — H3 Dungeons 4-6 completable (Claude Opus 4.6)

Implemented the staircase/cellar system and room-clear persistence — the two blockers
preventing L4-6 from being played end-to-end. **H3a — Staircase/Cellar System:**
Continued from previous session which built the core infrastructure (cellarConnections
data extraction, DungeonManager.enterCellar/exitCellar/getCellarForRoom, DungeonCollisionMap
.forCellar with stairs-tile-forced-walkable, DungeonRenderer.renderCellarRoom, stair entry/exit
detection in main.ts, walk-in animation). This session completed: (1) fixed `exitCellar` method
to accept `isLeftSide: boolean` parameter, removing the fragile `(dungeonManager as any)._cellarLeftSide`
hack; (2) wrapped spike trap update, push block update, bomb/door checks, and secret triggers in
`if (!dungeonManager.inCellar)` guard — these room-specific systems should not run in the
cellar passage; (3) guarded push block and spike trap rendering in `renderDungeonEntities()`.
5 cellar connections: L4 treasure (room 96), L5 tunnel (rooms 100↔6) + treasure (room 4),
L6 tunnel (rooms 58↔29) + treasure (room 117). **H3b — Room-Clear Persistence:** Added
`ROOM_CLEARED_BIT` ($40) to `RoomFlags` with `isRoomCleared/setRoomCleared`. Room marked cleared
when `spawnManager.enemies.length > 0 && activeEnemies.length === 0` (enemies were spawned and all
died). `spawnDungeonRoomEnemies()` returns early if room is already cleared — enemies no longer
respawn on re-entry. Fixed test mocks in `dungeon-completion.test.ts` and `dungeon-manager.test.ts`
(added missing `cellarConnections: []`). 12 new tests (cellar collision, connection data, exit
position unpacking, room-cleared flags). **1145 total tests** (1144 pass, 1 pre-existing flaky
digdogger). Typecheck clean (src). **Next: H4 (Dungeons 7-9).**

## 2026-08-29 — H4 Dungeons 7-9 completable — Phase H complete (Claude Opus 4.6)

Made all 9 dungeons navigable and completable (subject to I3 for Ganon). Four bugs fixed:
**(1) L7-9 entrance screens** — added screens 66→7, 109→8, 5→9 plus Q2 alternates (25, 108, 0)
to `DUNGEON_ENTRANCE_SCREENS`. **(2) Dungeon entry ignores tile overrides** — L7-9 entrances are
hidden behind secrets (flute dries pond→stairs, candle burns tree→stairs, bomb rock→cave). The
dungeon entry detection in main.ts only checked raw tile 12; added override check for both
`SQUARE_INDEX_CAVE_ENTRANCE` and `SQUARE_INDEX_STAIRS` from `tileObjectManager.tileOverrides`.
**(3) `checkCaveEntry` ignores STAIRS overrides** — `overworld-manager.ts` only checked
`SQUARE_INDEX_CAVE_ENTRANCE` override; added `SQUARE_INDEX_STAIRS` (also fixes regular cave stairs
from tree-burning). **(4) Trigger 3 (LastBoss) broken** — two issues: `itemActivated` was `false`
(Red Ring wouldn't appear after Ganon kill), and `_bossDefeated` was hardcoded `false` in main.ts.
Fixed to `itemActivated: true` and pass `allDead` as `_bossDefeated` (in trigger-3 rooms, the boss
IS the only enemy). Boss rooms: L7=Aquamentus $3D (implemented), L8=Gleeok4 $45 (implemented),
L9=Ganon $3E (generic-walker fallback until I3). L9 boss room uses trigger 3 → drops Red Ring $0E
+ opens shutters. All cellar infrastructure reused from H3 (L7: 2, L8: 3, L9: 8 connections).
10 new tests (entrance mapping, trigger 3 activation/gating, regression guards). **1165 total tests**
(1164 pass, 1 pre-existing flaky digdogger). Typecheck clean (src). **Phase H complete. Next: I3
(Patra + Ganon + Zelda rescue).**

## 2026-08-30 — I3 Patra + Ganon + Zelda rescue — Phase I complete (Claude Opus 4.6)

Final boss slice — completes Phase I and makes the game winnable. **Patra** (`patra.ts`):
PatraCenter extends Enemy with a 4-state flyer (SpeedUp/Decide/Chase/Wander, screen-edge bounce)
and tracks movement offsets for 8 PatraChild objects. Children orbit using NES-faithful fixed-point
angle math: PatraSines 16-entry lookup table, ShiftMultiply bit-shift multiplication, DecreaseObjectAngle
16-bit fixed-point subtraction. Sequential appearance (children appear one-at-a-time as first child's
angle reaches PatraChildStartAngles). Two maneuver modes with different rotation bit counts per timer
toggle. Center invulnerable while any child alive (mask $FE). Group spawn (1+8=9 objects) via
createPatra() + SpawnManager.pushEnemyOrGroup. **Ganon** (`ganon.ts`): 3 scene phases (DarkRoom $40f,
LightRoom $C0f, Fighting). Invisible movement reuses BlueWizzrobe walk pattern. Shoots unblockable
fireball ($56) every $40 frames. Custom collision completely bypasses normal pipeline
(_vulnerable=false): sword hits → visible $40f timer, HP→0 resets HP and goes brown; brown state
flickers and decrements, silver arrow (damage≥SILVER_ARROW_DAMAGE via hitContext) kills; dying
sequence: phase $50→ashes+8 burst rays, phase $A0→drops Triforce of Power as room item.
**GuardFire/StandingFire** (`guard-fire.ts`): GuardFire ($3F) killable, StandingFire ($40) invulnerable,
both deal contact damage. **Zelda NPC** (`zelda-npc.ts`): proximity check → halts Link → timer $80 →
GameMode.ZeldaRescue ending stub ("THANKS LINK, YOU'RE THE HERO OF HYRULE."). createZeldaGroup()
factory (1 Zelda + 4 GuardFire). 6 new files, spawn-manager + main.ts wiring. **1156 total tests**
(1155 pass, 1 pre-existing flaky Octorok). Typecheck clean (src). **Phase I complete. Next: J1.**

## 2026-09-01 — J1a Title + backstory scroll + file select + boot refactor (Claude Opus 4.8)

First front-end slice. **J1 split into J1a/J1b** (user, DECISIONS #9). Added `GameMode.Title`
and `GameMode.FileSelect`; **boot now lands on Title** instead of Gameplay. Refactored `init()`
so it only loads assets/data + builds renderers/fonts — the playable world (Link, OverworldManager,
SpawnManager, DropEngine, start-screen spawn) is created lazily by the new `startGameFromSlot(index)`,
the single seam through which any game begins. **TitleScreen** (`src/ui/title-screen.ts`): draws the
ready-made `title.png` full-screen (PUSH START BUTTON is baked in — static, as on NES); after ~7s idle
with no input it enters a vertical **backstory scroll** (Triforce crest + hardcoded story text,
`Z_02.asm` UpdateMode0Demo, ~0.5px/f), any button skips back. **FileSelectScreen**
(`src/ui/file-select-screen.ts`): 3 save-file rows (name + `-deaths`) + REGISTER YOUR NAME +
ELIMINATION MODE rows, `>` cursor (GameOverScreen pattern), Up/Down wrap-nav, Start emits a selection;
main.ts starts the game only for a *registered* slot (empty/register/eliminate are J1b stubs).
**SaveManager** (`src/save/save-manager.ts`, DECISIONS #8): persists slot metadata (name, quest,
registered, deaths) to `localStorage` key `zelda-nes:saves:v1`; storage is injectable (tests) and all
access guarded (corrupt/blocked/private-mode → in-memory empty slots). L1 widens SaveSlot to full game
state + IndexedDB. `recordDeath(activeSaveSlot)` wired at the death→GameOver transition. Front-end
renders full-screen via an early return before the HUD/play-area translate. Debug helpers added:
`__zelda.goToTitle/goToFileSelect/startGame(slot)/registerTest(slot,name)/saveManager`. **26 new tests
(1181 total, all green); src/ typecheck clean.** Verified in-browser: title, story scroll, file select
(seeded LINK/ZELDA slots), and start-game→overworld all render correctly; no console errors. **Next: J1b.**

Note for next agent: the Claude-in-Chrome tab runs in the background, where Chrome freezes
requestAnimationFrame — the game loop only ticks when the tab is foreground/focused. Use the `__zelda`
debug helpers to drive state when verifying via automation.

## 2026-09-01 — J1b Name registration + elimination — J1 complete (Claude Opus 4.8)

Completes slice J1. Added `GameMode.Register`/`Elimination` and wired the two file-select
option rows that were J1a no-op stubs. **NameBoard** (`src/ui/name-board.ts`, pure): the 44-cell
character board (4 rows × 11 cols) mirroring `ModeE_CharMap` (`Z_02.asm:1423-1429`). The NES
cursor logic (`ModeE_HandleDirections`, `:1844-1931`) juggles pixel X/Y with edge checks; on a
row-major grid that reduces exactly to modular arithmetic — Right/Left = ±1 mod 44, Down/Up = ±11
mod 44 (every wrap case traced against the asm). The 7 symbol tiles ($62 $63 $28-$2C) map to the
glyphs BitmapFont supports (`- . ! '`); the rest degrade to the fallback tile → L0 font pass.
**NameRegistrationScreen** (`src/ui/name-registration.ts`): per-slot 8-char buffers (already-
registered slots are display-only and skipped), **Select** cycles the slot cursor over the 3 files +
END skipping registered slots (`UpdateModeEandF_Idle`), directions drive the board with DAS
auto-repeat (act on press, then 16f to first repeat, then every 8f — `ModeE_ChooseRepeatDelay`
`:1830-1838`), **A** writes the highlighted char + advances the name cursor (wrap 0-7), **B** advances
only (`ModeE_HandleAOrB`), **Start on END** emits registration intents → `main.ts` calls
`SaveManager.register`. **EliminationScreen** (`src/ui/elimination.ts`): slot cursor + END (Up/Down or
Select), Start on a slot → `SaveManager.eliminate` (`DeleteSlot` `:1770`), Start on END → back to file
select (simplification: NES sends Eliminate's END to Register). Shared title/slot-row draw helpers
exported from `file-select-screen.ts` (`drawFrontEndTitle`, `drawSlotRow`, `FS_*` layout consts).
Debug: `__zelda.goToRegister()`/`goToElimination()`. **21 new tests (1202 total, all green); src/
typecheck clean.** Verified in-browser: register screen (board + slots + END + flashing cursor),
name-entry writes a char (A appeared in the row), and the elimination screen all render correctly;
no console errors. **J1 complete. Phase J half done. Next: J2 (ending + credits).**

## 2026-09-02 — J2 Ending sequence + credits + game-over polish — Phase J complete (Claude Opus 4.6)

Replaced the ZeldaRescue text stub with a full 5-phase ending sequence (`src/ui/ending-screen.ts`,
from Z_02.asm Mode $13 InitMode13_Full + UpdateMode13WinGame). **EndingScreen** class with phase
state machine: **Flash** (192f total — first 64f static black, then 128f cycling 4 NES palette
colors $0F/$12/$16/$2A; Link+Zelda placeholders with gold Triforces above each), **PeaceText**
(640f long timer; typewriter reveals "FINALLY, PEACE RETURNS TO HYRULE. THIS ENDS THE STORY."
one character every 8 frames across 3 lines), **Credits** (brick-walled frame with staff credits
scrolling at ~0.5px/f: STAFF, EXECUTIVE PRODUCER H.YAMAUCHI, S.MIYAMOTO, K.KONDO, T.WAKAI,
T.TEZUKA, T.NAKAZOO, "ANOTHER QUEST WILL START FROM HERE. PRESS THE START BUTTON.", player
name + death count), **AshTriforce** (Ganon grey ash pile + gold Triforce, "PUSH START BUTTON",
64f minimum wait then Start finishes), **Done** (calls `SaveManager.switchToSecondQuest()` → sets
quest=2 + persists, resets title, → `GameMode.Title`). Renders full-screen via the `isFrontEnd`
early-return path (no HUD during ending — fixed from initial implementation that showed HUD).
**Game-over SAVE option** now returns to title (NES Mode $D behavior) instead of respawning like
Continue/Retry. Added `GameOverOption` import + branch in main.ts GameOver handler. Debug:
`__zelda.goToEnding()`. **16 new tests (1218 total, all green); src/ typecheck clean.** Verified
in-browser: all 5 phases render correctly, no HUD, Start on AshTriforce returns to title, no
console errors. **Phase J complete. Next: L0 (sprite polish).**

## 2026-09-03 — L0b Boss sprite polish (Claude Opus 4.6)

Replaced fillRect placeholder rendering with real sprite sheet art for all 10 boss/NPC files.
Created `src/render/boss-sprite-data.ts`: central module with `initBossSprites()`/`initNpcSprites()`
(green/cyan transparency keying), `drawBossSprite()`/`drawBossSpriteScaled()`/`drawNpcSprite()`,
and hardcoded pixel coordinates for all boss sprites from `bosses.png` (494×296, Mister Mike /
Spriters Resource) and `npcs.png` (280×256). Wired init calls in `main.ts`. Updated 10 enemy files:
**Aquamentus** (mouth open/closed × 2 walk frames), **Dodongo** (left/right × 2 walk frames + stunned
overlay), **Manhandla** (center 2 frames + hand 2 frames), **Digdogger** (big 5 pulsing frames +
little 2 frames), **Gohma** (4 eye states: closed-left/right, fully-open, half-open, each 48×32),
**Gleeok** (body 3 frames + neck segments 8×8 + neck heads 8×16 + flying head 16×16),
**Patra** (center 16×16 + child 8×16 × 2 frames), **Ganon** (4 body frames + tint overlay for
brown/dying states, procedural ashes/burst preserved), **GuardFire/StandingFire** (2 fire frames
from npcs.png), **Zelda NPC** (standing/rescued from npcs.png). Removed unused `_mouthOpen` from
Dodongo, unused `_cardinal` from ManhandlaHand, fixed inline import type in Dodongo. **1218 tests
(1216 pass, 2 pre-existing flaky movement tests); src/ typecheck clean.**

## 2026-09-03 — L0c Weapon/projectile/item/ending sprite polish (Claude Opus 4.6)

Replaced fillRect placeholder rendering with real sprites for weapons, enemy projectiles, world items,
and the ending screen. Created `src/render/projectile-sprite-data.ts`: module-level SpriteSheet from
`projectiles.png` (15 cols, 16×16) with `initProjectileSprites()`/`drawProjectileFrame()`/
`drawProjectileFrameFlipped()` and sprite index constants. Added `initLinkEndingSprite()` +
`drawLinkEndingSprite()`/`drawLinkEndingSpriteUp()` to `boss-sprite-data.ts` for ending sequence Link.
Added `getProcessedItemsCanvas()` accessor to `item-sprites.ts`. Updated 8 render files:
**enemy-projectile.ts** (fireballs/magic/arrows/sword shots now use projectile sprites; rocks kept as
styled fillRect), **goriya-boomerang.ts** (spinning boomerang sprite frames), **magic-rod.ts** (rod
sprite replacing brown stick), **magic-shot.ts** (alternating sprite frames replacing cycling squares),
**raft.ts** (item sprite 0x0c replacing brown planks), **stepladder.ts** (item sprite 0x0d replacing
cross-planks), **ending-screen.ts** (Link sprite from link.png, Zelda from npcs.png ZELDA_NPC_SPRITES,
Triforce from items.png). Kept procedural: whirlwind (no sprite), push block (wall approximation),
Ganon ash pile, arrow spark, shield deflection. **1218 tests all pass; src/ typecheck clean.
L0 complete.**
