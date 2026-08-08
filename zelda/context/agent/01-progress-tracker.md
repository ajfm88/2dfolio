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

**Last updated:** 2026-08-06 · **Phase:** B (Data Extraction) · **Slices done:** 8 / 45

---

## ⚠ Read this before planning anything

This is a **reimplementation from reference**, not a port or emulator. You read
6502 assembly (the disassembly) and TypeScript/C#/JS (the reference repos) and
write TypeScript by hand. Nothing is transpiled; nothing is emulated.

**Next action: slice B4** — Item tables: drop tables, shop inventories, cave
contents, heart container locations.

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
| 9 | **B4** Item tables | drop tables, shop inventories, cave contents |
| 10 | **B5** Sprite animation data | frame counts, timing, directional sprites |

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
