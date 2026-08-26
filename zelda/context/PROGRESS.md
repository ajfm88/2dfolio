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
