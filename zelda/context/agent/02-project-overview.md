# zelda-nes — The Legend of Zelda (NES) in the browser, native TypeScript

## Overview

A personal hobby project (never distributed) that reimplements the original 1986
NES *Legend of Zelda* as pure browser TypeScript. The engine is being written from
scratch using a complete NES disassembly as the behavioral specification, a Mesen
label file as a RAM dictionary, and 6 open-source repos as implementation
references.

**As of 2026-08-04:**

- Seven reference repos surveyed and assessed (5–100% completeness).
- NES disassembly secured: 39,600 lines of 6502 assembly, 100% of the game.
- Mesen label file: 8,073-line RAM variable dictionary with rich descriptions.
- Foundation in place: project scaffolded (A1), renderer + game loop (A2).
- Scope agreed: **45 atomic slices** (2 done).

## What we are building

`npm run dev` → open `http://127.0.0.1:5173/` → play the game. No emulator, no
ROM, no WASM. TypeScript, Canvas 2D, and Web Audio only.

Target is **feature parity with the original NES game**: the full 128-screen
overworld, all 9 dungeons, all bosses, all items, the complete enemy roster,
3-slot save system, and Second Quest.

## Success criteria

| # | Criterion |
|---|---|
| 1 | Full playthrough start → Ganon defeated → Second Quest in a browser |
| 2 | Behavioral parity with the NES original; documented deviations only |
| 3 | 60 fps stable |
| 4 | `npm run typecheck` and `npm test` clean at every stop point |
| 5 | All game data loaded from JSON, not hardcoded |
| 6 | Any agent can claim a slice and finish it in one session |

## Scope boundaries

**In:** the game. Full overworld, 9 dungeons, all bosses, all items, all enemies,
save/load, Second Quest, title/ending screens, audio.

**Out — permanently:** publishing or hosting of any kind (`../DECISIONS.md` #1).
This runs on localhost and nowhere else.

**Out — for now:** level editor, mod support, mobile/touch controls.

## Why this is tractable

The NES Legend of Zelda is a well-understood game with finite scope: 128 overworld
screens, ~80 dungeon rooms, ~30 enemy types, 9 bosses, ~25 items. The
disassembly provides exact behavioral specs. The reference repos provide tested
implementation patterns and ready-to-use sprites. The game logic is
straightforward — no physics engine, no complex animation, no shader effects.
45 slices is a realistic estimate.
