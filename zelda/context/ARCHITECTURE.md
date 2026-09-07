# ARCHITECTURE — how the pieces fit

Seven reference repos, one direction of flow. **Nothing ever writes into the
reference repos.**

What is actually built and which file owns it: `IMPLEMENTATION.md`.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Game engine | TypeScript (strict) + **Canvas 2D** | Full reimplementation, not emulation |
| Build/dev | Vite | Dev server, bundling, `public/` static serving |
| Tests | vitest | Data validation, gameplay unit tests |
| Audio | Web Audio API | SFX and music playback |
| Storage | **localStorage** | 3 save slots (`DECISIONS.md` #10 amends #8) |
| Reference | NES disassembly (39,600 lines of 6502 asm) + Mesen labels (8K-line RAM dictionary) | Authoritative for all behaviour |

## Data flow

```
zelda1-disassembly-master/     ──extraction scripts──►  src/data/*.json
zelda1-disasm-labels-master/      (npm run extract:*)      (committed)
  (6502 asm + Mesen labels, read-only)

Reference repos (5)           ──manual curation──►      public/assets/
  (sprites, audio, read-only)                            (committed)

                                                        src/**/*.ts
                                                    (hand-written game logic)
                                                             │
                                                        npm run dev
                                                             ▼
                                                 browser @ 127.0.0.1:5173
```

One direction only. Nothing writes back into the reference repos.

## Project layout

```
zelda-nes-ts/
├── public/assets/         sprites, tiles, audio (committed)
├── scripts/               extract-*.ts — disassembly parsers, run via tsx
├── src/
│   ├── core/              game loop, input, math, constants
│   ├── data/              map data, enemy tables, item tables (JSON)
│   ├── render/            Canvas 2D renderer, camera, animation
│   ├── world/             screen management, transitions, collision
│   ├── objects/           Link, enemies, items, NPCs, bosses, projectiles
│   ├── ui/                HUD, inventory, title screen, menus
│   ├── audio/             Web Audio, SFX, music
│   └── save/              save/load, localStorage
└── tests/                 vitest
```

## Layer boundaries

```
src/core/      game loop, input, math, constants          ← depends on nothing
src/data/      JSON: maps, enemies, items, dungeons       ← depends on nothing
src/render/    Canvas 2D renderer, camera, animation      ← depends on core
src/world/     screen management, transitions, collision  ← depends on data+render
src/objects/   Link, enemies, items, NPCs, bosses         ← depends on world
src/ui/        HUD, inventory, title, menus               ← depends on render+data
src/audio/     Web Audio, SFX, music                      ← depends on core
src/save/      SaveManager, localStorage                  ← depends on objects
```

Dependencies point **downward only**. An enemy importing from `ui/` is a bug.

## Invariants

1. **Reference repos are read-only.** Never edit. Never delete.
2. **The disassembly is the behavioural authority.** When the implementation
   disagrees with the assembly, the implementation is wrong.
3. **Data is JSON, not hardcoded.** Maps, enemies, items, shops — all loaded
   from JSON in `src/data/`. This is what makes Second Quest a data swap.
4. **Canvas 2D only.** No WebGL2, no shaders. 256×240 internal resolution,
   scaled with nearest-neighbor.
5. **No emulation.** No CPU emulation, no PPU emulation, no ROM loading.

---

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
| Frame rate | 60 fps (NTSC) |

## The disassembly (the spec)

`zelda1-disassembly-master/` — **39,600 lines** of ca65 6502 assembly.
Reassembles into a byte-identical NES ROM.

`zelda1-disasm-labels-master/` — the Mesen `.mlb` label file (8,073 lines) used
to generate the disassembly. Acts as a **RAM data dictionary**: every memory
address has a name and often a multi-line description of its purpose. Use it
when the assembly names a variable and you need to know what it does.

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

Data extracted from these into `src/data/`: overworld map columns (banks 3/6),
dungeon room layouts (bank 6), enemy spawn tables, item drop tables, damage
tables, shop inventories.

## Asset sources

There are no bespoke binary formats to parse. Assets come from the reference
repos or are produced during data extraction.

| Asset type | Source | Format |
|---|---|---|
| Sprite sheets | Reference repos (bobbylight, humbertodias, Matthew-SA) | PNG |
| Tile sheets | Reference repos | PNG |
| Overworld / dungeon / enemy / item data | Extracted from disassembly | JSON |
| Sound effects | Reference repos (bobbylight) | WAV |
| Music | Reference repos | OGG |

**Sprites are committed, not generated.** No build-time asset pipeline — curated
once in slice A3, used directly.

Two sprite-sheet traps, both found the hard way (`HISTORY.md`, 2026-09-04):

- **Sheet grids are not uniform.** `projectiles.png` is 6×4 cells of 40×40, not
  15 columns of 16×16. Check the source repo's own code for a sheet's layout
  before assuming; measure second; guess never.
- **Some sheets carry a second background colour** — a grey `#747474` backing
  box behind each sprite. `src/render/transparency.ts` edge-flood-fills it away
  while preserving grey *inside* sprites.

---

## Rendering

This is not a web app. There is no design system, no CSS framework, no component
library. The entire UI is drawn to one `<canvas>` through Canvas 2D, and its
visual language comes from the original 1986 game. **If it is not in the NES
game, it does not go on screen.**

- **Canvas 2D, not WebGL2** (`DECISIONS.md` #3). The NES game has no shader
  effects — just sprites, tiles, palette swaps and screen flashes, all of which
  Canvas 2D does natively.
- **Internal resolution 256×240**, scaled up to fill the viewport with
  `image-rendering: pixelated` for crisp nearest-neighbor upscaling.
- **Layout:** HUD is the top 64 pixels. Play area is the bottom 176 pixels
  (256×176) = 16×11 tiles at 16×16 each.
- **Fixed timestep** for gameplay (60 fps NTSC), decoupled from render. Logic
  assumes a fixed update rate — do not scale movement by a variable delta.
- **Draw order:** background tiles → object sprites (depth-sorted by Y) → HUD
  overlay. Enemies draw behind Link when above him, in front when below.

### Screen transitions

The play area push-scrolls when Link walks off screen:

- **Horizontal / vertical:** ~32 frames, play area slides in that direction.
- Link continues walking in the transition direction during the scroll.
- **No diagonal transitions.** One axis at a time.

### Sprites

Sheets live in `public/assets/sprites/`.

- **Link:** 4-direction walk cycle (2 frames each), sword swing (4 directions),
  sword beam, shield, pickup pose, damage flash, death spin.
- **Enemies:** directional variants + attack frames + death poof per type.
- **Bosses:** multi-frame attack patterns, damage states.
- **Items:** pickup sprites, inventory icons, in-world representations.
- **Effects:** explosions, sword slash, projectile impacts, sparkles.

**Colour:** NES palette. Link is green by default, white with the blue ring, red
with the red ring — done by pixel replacement in `src/render/link-tint.ts`.
Enemies have red/blue variants: different stats, same sprite recoloured.

Still drawn procedurally rather than from a sheet (deliberate, documented in L0c):
rocks, whirlwind, push block, Ganon's ash pile, arrow spark, shield deflection.

### HUD (top 64 pixels)

```
┌─────────────────────────────────────────────────────┐
│  INVENTORY       -LIFE-                             │
│  B [item]  A     ♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥                   │
│            □     (half-heart granularity)           │
│  ×XX RUPEES       [minimap]                         │
│  ×XX KEYS                                           │
│  ×XX BOMBS                                          │
└─────────────────────────────────────────────────────┘
```

- **Hearts:** 3 starting → 16 max, half-heart granularity.
- **Rupees:** 0–255. **Keys:** per-dungeon count, or Magic Key = infinite.
  **Bombs:** 0→8, upgradeable to 12 then 16.
- **Minimap:** overworld = dot on the 16×8 grid; dungeon = explored rooms, with
  Map and Compass changing what it shows.
- **Item slots:** B = equipped item, A = always the sword.
- In a dungeon the overworld dot is replaced by "LEVEL-N" plus the room map.

### Inventory subscreen

Opens on Start. Grid of collected items; D-pad to select, Start to equip to B.
Items are greyed out until acquired; sword upgrades show the current tier.

The mid-game save chord lives here: with the subscreen open, hold Up + A to
reach the SAVE/CONTINUE/RETRY screen (`Z_05.asm:362`, `DECISIONS.md` #12).

## Audio

Web Audio API for both SFX and music, via `src/audio/audio-manager.ts` — lazy
`AudioContext`, WAV buffers preloaded, OGG music decoded on demand, `GainNode`
fade-out, M key mutes.

- **SFX (~30):** sword swing and beam, bomb place/explode, item and rupee
  pickup, damage taken, enemy hit and death, secret reveal, door unlock, low
  health beep, text crawl, stairs, shield block, boomerang, arrow, candle,
  recorder, fairy heal.
- **Music (~10 tracks intended; 2 present):** `overworld.ogg` and
  `dungeon.ogg`. Title, boss, ending, game-over and fairy tracks play silence —
  the engine is ready for them, the files are not there.
- **Transitions:** immediate cut on area-type change (overworld ↔ dungeon);
  cave entry pauses and exit resumes; death and Triforce stop the music.

## Input

Keyboard + Gamepad API, abstracted to **action names**, remappable
(`src/core/input.ts`). `InputManager` merges every connected device into one
action set.

| Action | Default key | NES equivalent |
|---|---|---|
| `up`/`down`/`left`/`right` | Arrow keys / WASD | D-pad |
| `attack` | X / Space | A button (sword) |
| `item` | Z | B button (equipped item) |
| `start` | Enter | Start (pause / inventory) |
| `select` | Shift | Select |

Gamepad mapping follows the Xbox layout: A = attack, B/X = item, Start = start.
Backtick toggles the debug overlay; M mutes audio.
