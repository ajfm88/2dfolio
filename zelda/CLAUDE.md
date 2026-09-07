j# CLAUDE.md — zelda-nes

*The Legend of Zelda* (NES, 1986) reimplemented as a native TypeScript browser
game. Localhost only, permanently. No emulation, no ROM loading, no WASM.

**You are reading the entry point. Read `context/STATUS.md` next — always.**

## The three rules

1. **`context/STATUS.md` is read first and updated last, every session.** It is
   the only continuity between agents. Skip the update and the next session
   restarts from zero.
2. **The disassembly is the spec.** When the implementation disagrees with
   `zelda1-disassembly-master/`, the implementation is wrong. The reference
   repos are all incomplete — use them for patterns, never for behaviour.
3. **One slice per session.** Claim it from `context/PLAN.md`, finish it, log
   it, stop. Too big? Split it (`G4a`/`G4b`) and log the split.

## Reading order

| When | Read |
|---|---|
| Every session | `context/STATUS.md` |
| New to the project | `context/PROJECT.md`, `context/ARCHITECTURE.md`, `context/CONVENTIONS.md` |
| Before writing code | `context/CONVENTIONS.md`, `context/IMPLEMENTATION.md` |
| About to make a call | `context/DECISIONS.md` — it may already be made |
| Wondering what happened | `context/HISTORY.md` |

## The context folder

One level, ten files. Each fact has exactly one home.

| File | Holds |
|---|---|
| `STATUS.md` | ⚠ **live handoff** — next action, open bugs, recent sessions |
| `PROJECT.md` | what and why — goals, non-goals, success criteria, reference repos |
| `ARCHITECTURE.md` | stack, data flow, layers, invariants, rendering/audio/input |
| `IMPLEMENTATION.md` | what is built and which file owns it |
| `PLAN.md` | the 54 slices, A1 → M2, with status |
| `CONVENTIONS.md` | session contract, code standards, verification, honesty rules |
| `DECISIONS.md` | numbered settled choices + open questions for the user |
| `HISTORY.md` | session archive, oldest first |
| `ENEMY-ROSTER.md` | every NES object type → implemented or parked, and why |
| `JS-MIGRATION.md` | parked plan: strip TypeScript → vanilla JS, after Phase L |

## The folders

| Path | Role | Rule |
|---|---|---|
| `zelda-nes-ts/` | **what we are building** | the only place you write code |
| `context/` | the knowledge base | keep it current |
| `zelda1-disassembly-master/` | **THE spec** — 39,600 lines of 6502 asm | read-only |
| `zelda1-disasm-labels-master/` | Mesen `.mlb` — RAM variable dictionary | read-only |
| `ZeldaJS-master/` | best TypeScript/browser patterns; audio set | read-only |
| `zelda-clone-master/` | best combat/boss/item C# patterns; sheet layouts | read-only |
| `game-zelda-js-master/` | weapon variety, HUD, sprites | read-only |
| `zelda-js-master/` | overworld map images | read-only |
| `Legend-Of-Zelda-Javascript-main/` | ECS pattern, pathfinding | read-only |
| `zelda30tribute-master/` | Scott Lininger's 30th-anniversary tribute; individual sprite PNGs, JS game engine | read-only |
| `sprite-pickers/` | scratch grids used to index sprite sheets | scratch |

## Commands

All run from `zelda-nes-ts/`.

```bash
npm run dev          # http://127.0.0.1:5173/
npm run typecheck    # tsc --noEmit — keep clean at every stop point
npm test             # vitest run — keep green at every stop point
npm run lint         # eslint src/
npm run build        # tsc && vite build
npm run extract:*    # overworld | dungeons | enemy-spawns | items | sprites | secrets | cave-text
```

The `extract:*` scripts parse the disassembly into the committed JSON in
`src/data/`. They are run once per data slice, not per session.

In the browser console, `__zelda` exposes the debug helpers (`giveDungeon`,
`godMode`, `noclip`, `warp`, `goToRoom`, `killAll`, `saveNow`, …).
`STATUS.md` has the full list. Backtick toggles the debug overlay.

## Scope guards

- **Localhost only.** No deploy step, no hosting, no public origin, no CDN, no
  analytics. The assets are Nintendo's.
- **No emulation.** If a task seems to need CPU/PPU emulation, stop and ask.
- **Nothing here is a git repo.** Don't `git init` or commit unless asked.
- Temp and scratch files go to the session scratchpad, not the project.
