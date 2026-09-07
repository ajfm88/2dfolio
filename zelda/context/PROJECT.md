# PROJECT — what and why

Reimplement **The Legend of Zelda (NES, 1986)** as a **native TypeScript browser
game**, running on localhost, with **no emulation, no ROM loading, no WASM**. The
engine lives in `zelda-nes-ts/`.

`npm run dev` → open `http://127.0.0.1:5173/` → play the game. TypeScript,
Canvas 2D and Web Audio only. Nothing else installed.

This is a **reimplementation from reference**, not a port. The NES disassembly is
the behavioural specification; a companion Mesen label file is the RAM variable
dictionary; the TypeScript is written from scratch against them. Five other
open-source repos serve as implementation references. Nothing is transpiled and
nothing is emulated — you read 6502 assembly and TypeScript/C#/JS, and write
TypeScript by hand.

Live status: `STATUS.md`. Roadmap: `PLAN.md`.

## Goals

- Feature parity with the original: the full 128-screen overworld, all 9
  dungeons, all bosses, all items, the complete enemy roster, 3-slot save, and
  Second Quest.
- Behavioural fidelity to the original — the disassembly is the spec, and the
  reference repos inform implementation patterns only.
- Any agent can pick up one slice and finish it in a single sitting.

## Non-goals

- **Publishing or hosting.** Localhost only, permanently (`DECISIONS.md` #1).
  The sprites and music are Nintendo's; a public URL would distribute them.
- **ROM loading or NES emulation.** Ground-up reimplementation, not an emulator.
- **Level editor or mod support.** Play the game first.
- **Mobile/touch controls** were out of scope for v1 and are now Phase M, to be
  done after the game is otherwise complete. Still localhost-only.

## Success criteria

| # | Criterion |
|---|---|
| 1 | Full playthrough: start → Ganon defeated → Second Quest, in a browser |
| 2 | Behavioural parity with the NES original; documented deviations only |
| 3 | 60 fps stable |
| 4 | `npm run typecheck` and `npm test` clean at every stop point |
| 5 | All game data loaded from JSON, not hardcoded |
| 6 | Any agent can claim a slice and finish it in one session |

## Scope

**Scope agreed with the user (2026-08-02):** ~45 atomic slices, one per session,
each independently verifiable. The count is a target, not a contract — slices
that proved too big were split with a letter suffix. The plan now runs to 53
slots across phases A–M (`PLAN.md`).

## Reference material, ranked

Seven repos sit alongside `zelda-nes-ts/` in this folder. **All of them are
read-only** — never edit, never delete, never write into them.

1. **`zelda1-disassembly-master/`** — byte-accurate NES disassembly, 8 banks of
   6502 assembly, ~39,600 lines. Authoritative for all game data: map layouts,
   enemy spawns, item tables, damage values, boss AI, Second Quest differences.
   Companion: **`zelda1-disasm-labels-master/`** — the Mesen `.mlb` label file
   (8,073 lines), a data dictionary describing every RAM variable. Together,
   100% coverage of the game.
2. **`ZeldaJS-master/`** (bobbylight, ~15–20% complete) — TypeScript + Vite.
   Best architecture reference: class hierarchy, overworld JSON, sprite sheets,
   and the most complete audio set (~30 WAV SFX + OGG music).
3. **`zelda-clone-master/`** (hfiggs, ~30–35%) — C# / MonoGame. Best
   combat/boss reference: 11 enemy types, 2 bosses, 19 items, collision
   pipeline, state machines. Ships several sprite sheets byte-identical to ours,
   so its code is the authority on their cell layouts.
4. **`game-zelda-js-master/`** (humbertodias, ~15%) — vanilla JS. Most weapon
   variety: sword, boomerang, bombs, arrows, candle. Full HUD. Overworld map.
5. **`zelda-js-master/`** (Matthew-SA, ~10–15%) — vanilla JS. Full 128-screen
   overworld map + collision map as PNGs.
6. **`Legend-Of-Zelda-Javascript-main/`** (jdr81394, ~5–10%) — vanilla JS. Clean
   ECS pattern, Dijkstra pathfinding for enemy AI.

Completeness percentages are from the 2026-08-02 survey. They are why the
disassembly wins every dispute: the reference repos are all partial and may have
bugs or invented behaviour.

## Why this is tractable

The NES Legend of Zelda is a well-understood game with finite scope: 128
overworld screens, ~80 dungeon rooms, ~30 enemy types, 9 bosses, ~25 items. The
disassembly provides exact behavioural specs, the reference repos provide tested
patterns and ready-to-use sprites, and the game logic is straightforward — no
physics engine, no complex animation, no shader effects.
