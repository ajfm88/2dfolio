# PROGRESS — session archive

> **This is not the live log.**
>
> Current state, the ordered slice queue, open questions and recent sessions live
> in **`context/agent/01-progress-tracker.md`** — read that first, and update it
> before you stop working.
>
> This file keeps older session entries once the tracker's Session Log gets long,
> so the tracker stays short enough that agents actually read it.

Newest first.

## 2026-08-02 — Project setup: reference repo survey (Claude Opus 4.6)

Surveyed all 6 reference repos to assess completeness and determine which to use
as primary references:

- **aldonunez/Loz** — full NES disassembly, 39,600 lines of 6502 assembly, 100%
  game coverage. THE behavioral specification.
- **bobbylight/ZeldaJS** — TypeScript/Vite, ~15-20% complete, best architecture.
  4 enemies, overworld JSON data, sprite sheets, 30+ SFX.
- **hfiggs/zelda-clone** — C#/MonoGame, ~30-35% complete (Dungeon 1 focused).
  11 enemies, 2 bosses, 19 items, full collision pipeline.
- **humbertodias/game-zelda-js** — vanilla JS, ~15% complete. Most weapon
  variety (sword, boomerang, bombs, arrows, candle), full HUD.
- **Matthew-SA/zelda-js** — vanilla JS, ~10-15% complete. Full 128-screen
  overworld map + collision map as PNGs.
- **jdr81394/Legend-Of-Zelda-Javascript** — vanilla JS, ~5-10% complete. Clean
  ECS architecture, Dijkstra enemy pathfinding.

Context system written (all 15 files). 45-slice plan established. Credits file
created. **No production code written. Next: A1.**
