# Architecture Context

Short version for orientation. The full details live in `../ARCHITECTURE.md`.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Game engine | TypeScript (strict) + **Canvas 2D** | Full reimplementation, not emulation |
| Build/dev | Vite | Dev server, bundling, `public/` static serving |
| Tests | vitest | Data validation, gameplay unit tests |
| Audio | Web Audio API | SFX and music playback |
| Storage | IndexedDB | 3 save slots |
| Reference | NES disassembly (39,600 lines 6502 asm) + Mesen labels (8K-line RAM dictionary) | Authoritative for all behavior |

Canvas 2D, not WebGL2 — the NES game has no shader effects (`../DECISIONS.md` #3).

## Data flow

```
zelda1-disassembly-master/     ──extraction scripts──►  src/data/*.json
zelda1-disasm-labels-master/      (read-only)           (committed)
  (6502 asm + Mesen labels)

Reference repos (6)           ──manual curation──►      public/assets/
  (sprites, audio, read-only)                           (committed)

                                                    src/**/*.ts
                                                    (hand-written game logic)
                                                        │
                                                   npm run dev
                                                        ▼
                                              browser @ 127.0.0.1:5173
```

One direction only. Nothing writes back into the reference repos.

## Layer boundaries

```
src/core/      game loop, input, math, constants        ← depends on nothing
src/data/      JSON: maps, enemies, items, dungeons     ← depends on nothing
src/render/    Canvas 2D renderer, camera, animation    ← depends on core
src/world/     screen management, transitions, collision ← depends on data+render
src/objects/   Link, enemies, items, NPCs, bosses       ← depends on world
src/ui/        HUD, inventory, title, menus             ← depends on render+data
src/audio/     Web Audio, SFX, music                    ← depends on core
src/save/      SaveData, IndexedDB                      ← depends on objects
```

Dependencies point **downward only**. An enemy importing from `ui/` is a bug.

## Invariants

1. **Reference repos are read-only.** Never edit. Never delete.
2. **The disassembly is the behavioral authority.** When implementation disagrees
   with the assembly, the implementation is wrong.
3. **Data is JSON, not hardcoded.** Maps, enemies, items, shops — all loaded from
   JSON files in `src/data/`. This is what makes Second Quest a data swap.
4. **Canvas 2D only.** No WebGL2, no shaders. 256×240 internal resolution, scaled
   with nearest-neighbor.
5. **No emulation.** No CPU emulation, no PPU emulation, no ROM loading.

## NES game specs

| Spec | Value |
|---|---|
| Resolution | 256×240 (HUD: top 64px, play area: bottom 176px) |
| Tile size | 16×16 pixels (metatiles) |
| Play area | 16 tiles wide × 11 tiles tall |
| Overworld | 16×8 grid = 128 screens |
| Dungeons | 9 (varying room counts per dungeon) |
| Frame rate | 60 fps (NTSC) |
