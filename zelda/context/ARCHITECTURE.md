# ARCHITECTURE — how the pieces fit

Seven reference repos, one direction of flow. **Nothing ever writes into the
reference repos.**

```
zelda1-disassembly-master/     ← SPEC: all game data & behavior (read-only)
zelda1-disasm-labels-master/   ← SPEC: Mesen label file — RAM variable dictionary (read-only)
ZeldaJS-master/                ← REFERENCE: TypeScript patterns (read-only)
zelda-clone-master/            ← REFERENCE: C# patterns (read-only)
game-zelda-js-master/          ← REFERENCE: sprites, HUD (read-only)
zelda-js-master/               ← REFERENCE: overworld map (read-only)
Legend-Of-Zelda-Javascript-main/ ← REFERENCE: ECS patterns (read-only)
              │
              │  read by a human + data extraction scripts
              ▼
zelda-nes-ts/
├── public/assets/         sprites, tiles, audio (committed)
├── src/
│   ├── core/              game loop, input, math, constants
│   ├── data/              map data, enemy tables, item tables (JSON)
│   ├── render/            Canvas 2D renderer, camera, animation
│   ├── world/             screen management, transitions, collision
│   ├── objects/           Link, enemies, items, NPCs, bosses, projectiles
│   ├── ui/                HUD, inventory, title screen, menus
│   ├── audio/             Web Audio, SFX, music
│   └── save/              save/load, IndexedDB
└── tests/                 vitest
```

## The NES game's vital stats

| Stat | Value |
|---|---|
| Resolution | 256×240 (NTSC); HUD 256×64 top, play area 256×176 bottom |
| Tile size | 16×16 pixels (metatiles; NES hardware uses 8×8) |
| Play area | 16 tiles wide × 11 tiles tall |
| Overworld | 16×8 grid = 128 screens |
| Dungeons | 9, each a grid of rooms (varies per dungeon) |
| Enemy types | ~30 (overworld + dungeon) |
| Boss types | 9 unique (some repeated across dungeons) |
| Items | ~25 collectible + consumable types |
| Music tracks | ~10 (overworld, dungeon, boss, title, ending, etc.) |
| SFX | ~30 distinct sounds |
| Save slots | 3 |

## The disassembly (the spec)

`zelda1-disassembly-master/` — **39,600 lines** of ca65 6502 assembly.
Reassembles into a byte-identical NES ROM.

`zelda1-disasm-labels-master/` — The Mesen `.mlb` label file (8,073 lines)
used to generate the disassembly. Acts as a **RAM data dictionary**: every
memory address has a name and often a multi-line description of its purpose.
Useful when the assembly uses a variable name and you need to understand what
it does.

| Bank | File | Contents |
|---|---|---|
| 0 | `Z_00.asm` | Audio engine, song scripts |
| 1 | `Z_01.asm` | Shared RAM routines |
| 2 | `Z_02.asm` | Mode handling, menus, patterns |
| 3 | `Z_03.asm` | Pattern data, overworld column tables |
| 4 | `Z_04.asm` | **All enemy/boss AI** (~12K lines) |
| 5 | `Z_05.asm` | Player logic, world systems |
| 6 | `Z_06.asm` | Save data, tile maps, dungeon layouts |
| 7 | `Z_07.asm` | Fixed bank: core engine, object dispatch, room loading |

**Key data tables to extract:**

- Overworld map columns (bank 3/6) — compressed column-based encoding
- Dungeon room layouts (bank 6) — room tiles and object placement
- Enemy spawn tables — per-screen enemy type/count assignments
- Item drop tables — what enemies drop and cave contents
- Damage tables — attack/defense values for all entities
- Shop inventories — prices and items per shop

## Asset sources

Unlike the Link's Awakening project, there are no bespoke binary formats to parse.
Assets come from the reference repos or are created during data extraction:

| Asset type | Source | Format |
|---|---|---|
| Sprite sheets | Reference repos (bobbylight, humbertodias, Matthew-SA) | PNG |
| Tile sheets | Reference repos | PNG |
| Overworld map data | Extracted from disassembly → JSON | JSON |
| Dungeon data | Extracted from disassembly → JSON | JSON |
| Enemy/item tables | Extracted from disassembly → JSON | JSON |
| Sound effects | Reference repos (bobbylight) | WAV/OGG |
| Music | Reference repos | OGG |

**Sprites are committed, not generated.** No build-time asset pipeline needed
(unlike the LA project). Curate once in phase A3, use directly.

## Rendering: Canvas 2D

Canvas 2D, not WebGL2. The NES game has no shader effects — just palette swaps
and screen flashes, which Canvas 2D handles natively. The rendering model:

- Internal canvas: 256×240 pixels
- Scaled up to fill viewport with `image-rendering: pixelated` (nearest-neighbor)
- Fixed timestep for game logic (60 fps), decoupled from render
- Draw order: background tiles → sprites (depth-sorted) → HUD overlay

## Boundaries and invariants

1. **Reference repos are read-only.** Never edit, never delete.
2. **The disassembly is the behavioral authority.** When the implementation
   disagrees with the disassembly, the implementation is wrong.
3. **Data is JSON, not hardcoded.** Map data, enemy tables, item tables — all
   loaded from JSON. This is what makes Second Quest a data swap, not a code fork.
4. **Canvas 2D only.** No WebGL2, no shader effects. The NES didn't have them.
5. **No emulation.** This is a reimplementation. No CPU emulation, no PPU
   emulation, no ROM loading.
