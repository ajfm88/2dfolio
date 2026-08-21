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
