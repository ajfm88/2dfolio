# PROJECT — what and why

Reimplement **The Legend of Zelda (NES, 1986)** as a **native TypeScript browser
game**, running on localhost, with **no emulation, no ROM loading, no WASM**. The
game engine lives in `zelda-nes-ts/`.

This is a **reimplementation from reference**, not a port. The NES disassembly is
the behavioral specification; a companion Mesen label file serves as a RAM
variable dictionary; the TypeScript is written from scratch against them. Six
other open-source repos serve as implementation references.

**Scope agreed with the user (2026-08-02):** ~45 atomic slices. Slices are
deliberately small — one per session, each independently verifiable.

Live status: `context/agent/01-progress-tracker.md`. Roadmap: `PLAN.md`.

## Goals

- `npm run dev` → play in a browser at `http://127.0.0.1:5173/`. Nothing else
  installed.
- Feature parity with the original NES game: full overworld (128 screens), all 9
  dungeons, all bosses, all items, Second Quest.
- Behavioral fidelity to the original — the disassembly is the spec, and the
  reference repos inform implementation patterns.
- Any agent can pick up one slice and finish it in a single sitting.

## Non-goals

- **Publishing or hosting.** Localhost only, permanently. The sprites and music
  are Nintendo's; a public URL would distribute them.
- **ROM loading or NES emulation.** This is a ground-up reimplementation, not an
  emulator.
- **Mobile/touch controls in v1.** Desktop keyboard + gamepad only.
- **Level editor or mod support.** Play the game first.

## What exists today

| Thing | Where | State |
|---|---|---|
| NES disassembly (the spec) | `zelda1-disassembly-master/` | ✅ 39,600 lines, 100% of the game |
| Disasm labels (RAM dictionary) | `zelda1-disasm-labels-master/` | ✅ 8,073-line Mesen .mlb |
| TypeScript reference | `ZeldaJS-master/` | ✅ best browser architecture |
| C# reference | `zelda-clone-master/` | ✅ best combat/boss/item patterns |
| JS references (3) | `game-zelda-js-master/`, `zelda-js-master/`, `Legend-Of-Zelda-Javascript-main/` | ✅ sprite sheets, maps, patterns |
| TypeScript engine | `zelda-nes-ts/` | ✅ scaffolded + renderer (A1–A2) |

## Reference material, ranked

1. **`zelda1-disassembly-master/`** — byte-accurate NES disassembly. Authoritative
   for all game data: map layouts, enemy spawns, item tables, damage values, boss
   AI, Second Quest differences. 8 banks of 6502 assembly, ~39,600 lines.
   Companion: **`zelda1-disasm-labels-master/`** — Mesen `.mlb` label file
   (8,073 lines) with rich multi-line descriptions of every RAM variable. Use it
   as a data dictionary when deciphering the assembly.
2. **`ZeldaJS-master/`** (bobbylight) — TypeScript + Vite. Best architecture
   reference: class hierarchy, overworld data (JSON), sprite sheets, sound effects.
3. **`zelda-clone-master/`** (hfiggs) — C# / MonoGame. Best combat/boss reference:
   11 enemy types, 2 bosses, 19 items, collision pipeline, state machines.
4. **`game-zelda-js-master/`** (humbertodias) — vanilla JS. Most weapon variety:
   sword, boomerang, bombs, arrows, candle. Full HUD. Overworld map image.
5. **`zelda-js-master/`** (Matthew-SA) — vanilla JS. Full 128-screen overworld map
   + collision map as PNGs.
6. **`Legend-Of-Zelda-Javascript-main/`** (jdr81394) — vanilla JS. Clean ECS
   pattern, Dijkstra pathfinding for enemy AI.
