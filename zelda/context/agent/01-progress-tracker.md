# Progress Tracker — THE live handoff log

> **Every agent, every session: read this file FIRST and update it LAST.**
> This is the only file that records what is actually happening. If you skip
> the update, the next agent restarts from zero and wastes the user's credits.
>
> Deep reference lives in `../ARCHITECTURE.md`, `../DECISIONS.md`,
> `../CONVENTIONS.md`, `../PLAN.md`. This file is state, not knowledge —
> put facts there, put status here.

**Project:** zelda-nes — *The Legend of Zelda (NES)* as native TypeScript in the
browser.
**Working dir for all commands:** `zelda-nes-ts/`

**Last updated:** 2026-08-10 · **Phase:** C (Rendering) in progress · **Slices done:** 12 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: slice C3** — HUD / status bar: hearts, rupees, keys, bombs,
minimap dot, equipped item slots (A + B).

---

## What is ready and verified (2026-08-02)

| Thing | Path | State |
|---|---|---|
| NES disassembly | `zelda1-disassembly-master/` | ✅ 39,600 lines, 100% coverage |
| Disasm labels | `zelda1-disasm-labels-master/` | ✅ Mesen .mlb, 8K-line RAM dictionary |
| TypeScript reference | `ZeldaJS-master/` | ✅ best browser architecture |
| C# reference | `zelda-clone-master/` | ✅ best combat/boss patterns |
| JS references (3) | `game-zelda-js-master/`, `zelda-js-master/`, `Legend-Of-Zelda-Javascript-main/` | ✅ sprites, maps, patterns |
| Context system | `context/` | ✅ 15 files written |
| TS project | `zelda-nes-ts/` | ✅ scaffolded (A1) |
| Renderer | `src/render/renderer.ts` | ✅ Canvas 2D, integer-scaled, HUD/play area split (A2) |
| Assets | `public/assets/` | ✅ 62 files: 19 sprites, 7 tiles, 3 UI, 3 maps, 30 SFX, 2 music (A3) |
| Asset manifest | `src/data/asset-manifest.ts` | ✅ typed manifest + loader (A3) |
| Input system | `src/core/input.ts` | ✅ InputManager: keyboard + Gamepad API, action-name abstraction, remappable, edge detection (A4) |
| Debug overlay | `src/core/debug-overlay.ts` | ✅ DebugOverlay: backtick toggle, FPS counter, input states, placeholder coords/entities (A5) |
| Overworld data | `src/data/overworld.json` | ✅ 128 screens × 11×16 tile grids + square table, extracted from ROM + disassembly (B1) |
| Dungeon data | `src/data/dungeons.json` | ✅ 4 level blocks × 128 rooms, 42 unique room tile grids, 2 cellars, 9 dungeon metadata entries (B2) |
| Enemy spawns | `src/data/enemy-spawns.json` | ✅ 83 object types, 30 heterogeneous lists, 4 spawn position lists, 128 OW spawn entries, OW foeCounts (B3) |
| Item tables | `src/data/items.json` | ✅ 36 item names, drop tables (4×10), 20 cave/shop inventories with prices, cave types, OW heart container, 7 secret Armos, 11 flute secrets, 38 HP pairs, money game data (B4) |
| Dungeon positions | `src/data/dungeons.json` | ✅ updated: added itemPositionIndex per room + shortcutOrItemPositions per dungeon (B4) |
| Sprite animation | `src/data/sprites.json` | ✅ core animation system (127 anim indices, 204-entry frame/attr heaps), 95 object type attrs, Link head tiles, 37 item frame offsets + 48 tiles, weapon directional tables, boomerang 9-frame cycle, bomb cloud offsets, 7 boss sprite layouts (Aquamentus/Dodongo/Digdogger/Gleeok/Ganon/Patra/Manhandla), enemy anim timing (Leever/Wallmaster) (B5) |
| Tile renderer | `src/render/tile-renderer.ts` | ✅ TileRenderer: renders 16×11 play area from overworld.json + overworld-map.png, per-screen palette-correct tiles, arrow-key navigation across all 128 screens (C1) |
| Sprite renderer | `src/render/sprite-renderer.ts` | ✅ SpriteSheet: sprite sheet extraction with auto transparency key, flip/mirror support. WalkAnimationController: NES-faithful 2-frame walk cycle (6-frame counter). directionToSpriteCol mapping. Link sprite animates on screen (C2) |

---

## Queue — next 8 slices

Claim the top one, finish it, log it, stop. Full list of 45 in `../PLAN.md`.

| # | Slice | Notes |
|---|---|---|
| ~~1~~ | ~~**A1** Scaffold project~~ | ✅ done 2026-08-03 |
| ~~2~~ | ~~**A2** Canvas + game loop~~ | ✅ done 2026-08-04 |
| ~~3~~ | ~~**A3** Asset curation~~ | ✅ done 2026-08-04 |
| ~~4~~ | ~~**A4** Input system~~ | ✅ done 2026-08-05 |
| ~~5~~ | ~~**A5** Debug overlay + test harness~~ | ✅ done 2026-08-05 |
| ~~6~~ | ~~**B1** Overworld map data~~ | ✅ done 2026-08-05 |
| ~~7~~ | ~~**B2** Dungeon room data~~ | ✅ done 2026-08-06 |
| ~~8~~ | ~~**B3** Enemy spawn tables~~ | ✅ done 2026-08-06 |
| ~~9~~ | ~~**B4** Item tables~~ | ✅ done 2026-08-07 |
| ~~10~~ | ~~**B5** Sprite animation data~~ | ✅ done 2026-08-08 |
| ~~11~~ | ~~**C1** Tile renderer~~ | ✅ done 2026-08-09 |
| ~~12~~ | ~~**C2** Sprite renderer + animation~~ | ✅ done 2026-08-10 |
| 13 | **C3** HUD / status bar | hearts, rupees, keys, bombs, minimap, equipped items |

**Phase A gate:** blank canvas renders at a stable 60 fps, `npm run typecheck` and
`npm test` clean, sprites load from `public/assets/`.

---

## Open questions for the user

Answer cheaply, unblock later work. **None of these block A1.**

1. **Asset gaps.** If a reference repo lacks a sprite we need, should we extract
   from another repo, create manually, or defer?
2. **Second Quest priority.** Currently the last slice (L2). Move it earlier?
3. **Music source.** Reference repos have some OGG/MP3 tracks. Sufficient?

---

## Notes worth carrying

- **The disassembly is the behavioral authority.** The reference repos are all
  incomplete (5–35%) and may have bugs. Use them for patterns, not behavior.
- **Data-driven design.** All map data, enemy tables, item tables in JSON. This is
  what makes Second Quest a data swap, not a code fork.
- **Canvas 2D, not WebGL2.** The NES game has no shader effects. Canvas 2D with
  `image-rendering: pixelated` gives pixel-perfect nearest-neighbor scaling.
- **Reference repos surveyed** (2026-08-02): aldonunez (100%), bobbylight
  (15–20%), hfiggs (30–35%), humbertodias (15%), Matthew-SA (10–15%),
  jdr81394 (5–10%).

---

## Session log

Newest first. Keep entries to one short paragraph. Archive to `../PROGRESS.md`
once this passes ~10 entries.

### 2026-08-10 — C2 Sprite renderer + animation system (Claude Opus 4.6)

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

### 2026-08-09 — C1 Tile renderer (Claude Opus 4.6)

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

### 2026-08-08 — B5 Sprite animation data (Claude Opus 4.6)

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

### 2026-08-07 — B4 Item tables (Claude Opus 4.6)

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

### 2026-08-06 — B3 Enemy spawn tables (Claude Opus 4.6)

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

### 2026-08-06 — B2 Dungeon room data (Claude Opus 4.6)

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

### 2026-08-05 — B1 Overworld map data (Claude Opus 4.6)

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

### 2026-08-05 — A5 Debug overlay + test harness (Claude Opus 4.6)

Created `src/core/fps-counter.ts` — FpsCounter class with configurable sample
interval, takes `now` parameter for testability. Created `src/core/debug-overlay.ts`
— DebugOverlay class with backtick key toggle (separate from InputManager since
it's a meta key, not a game action). Updated `main.ts`: replaced always-visible
`renderInputDebug()` with `renderDebugOverlay()` gated on `debug.enabled`. Overlay
shows status bar (FPS, frame count, screen coord placeholder, entity count
placeholder) + input action states. Hidden by default, backtick toggles on/off.
19 new tests (119 total). Typecheck clean. Visually verified toggle in browser.
**Phase A complete. Next: B1.**

### 2026-08-05 — A4 Input system (Claude Opus 4.6)

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

### 2026-08-04 — A3 Asset curation (Claude Opus 4.6)

Curated 62 assets from reference repos into `public/assets/`: 19 sprite sheets
(Link, enemies, bosses, items, NPCs, etc.), 7 tilesets (overworld + dungeon),
3 UI images (HUD, title, crest), 3 reference maps, 30 SFX (kebab-case WAV),
2 music tracks (OGG). Primary source: ZeldaJS-master (native 16x16, web-ready).
Supplemented from zelda-clone-master (items, projectiles, particles) and
game-zelda-js-master (full maps). Created `src/data/asset-manifest.ts` with
typed maps + `loadAllAssets()` preloader. 77 tests pass (64 new manifest file
checks). Zero 404s, zero console errors. **Next: A4.**

### 2026-08-04 — A2 Canvas renderer + game loop (Claude Opus 4.6)

Created `src/render/renderer.ts` — Renderer class that owns the canvas and 2D
context, handles integer scaling on resize, disables image smoothing, and
provides `clear()`, `fillRect()`, `drawImage()`, `beginPlayArea()`/
`endPlayArea()` (translate to HUD offset). Updated `main.ts` to use Renderer
with a hue-cycling play area demo. 7 new renderer tests (13 total). Typecheck
clean, all tests pass. Game loop from A1 needed no changes. **Next: A3.**

### 2026-08-03 — A1 Scaffold project (Claude Opus 4.6)

Scaffolded `zelda-nes-ts/`: Vite 8 + TypeScript 6 (strict, noUnusedLocals,
noUnusedParameters, noUncheckedIndexedAccess), vitest 4, ESLint with
typescript-eslint. Folder skeleton per ARCHITECTURE (`src/core`, `src/data`,
`src/render`, `src/world`, `src/objects/{enemies,bosses,items,npcs,projectiles}`,
`src/ui`, `src/audio`, `src/save`, `public/assets/{sprites,tiles,audio}`).
Created `game-loop.ts` (fixed-timestep, pause on blur), `constants.ts` (NES
specs), `types.ts` (Vec2, Rect, Direction), `main.ts` (canvas setup + test
render). 6 tests pass, typecheck clean, dev server runs on 5173. **Next: A2.**

### 2026-08-02 — Context system created (Claude Opus 4.6)

Surveyed all 6 reference repos. Established 45-slice plan across 12 phases.
Rewrote all 15 context files from Link's Awakening DX HD to NES Legend of Zelda.
Key decisions: Canvas 2D (not WebGL2), data-driven JSON (not hardcoded),
disassembly as behavioral authority, sprites from reference repos. Credits file
created with all 6 source URLs. **No production code written. Next: A1.**
