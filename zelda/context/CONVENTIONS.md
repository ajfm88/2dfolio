# CONVENTIONS — working rules

## Session discipline (read this even if you skip the rest)

- **Live state lives in `context/agent/01-progress-tracker.md`.** Read it at the
  start of every session; update it before you stop. It holds the current phase,
  the ordered slice queue, open questions, and the session log.
- **One slice per session.** Slices are numbered in `PLAN.md` (A1, B4, G3, …).
  Claim the top of the queue, finish it, log it, stop. Do not batch slices.
- **Record decisions in `DECISIONS.md`**, numbered and dated. Do not relitigate an
  existing entry without new evidence — but say so loudly when you find some.
- If a slice turns out bigger than one session, **split it** (`G4a`/`G4b`), log
  the split, and keep going. Don't half-finish and don't silently expand.

## Behavioral fidelity — the rule that matters most

**The disassembly is the spec.** When in doubt about how anything should work,
read the assembly.

1. Find the relevant routine in `zelda1-disassembly-master/` (bank 4 for enemies,
   bank 5 for player, bank 7 for core engine).
2. Understand the behavior — state transitions, timing, values.
3. Implement the same behavior in TypeScript.
4. Cross-check against the reference repos for implementation patterns.

The reference repos are **not authoritative for behavior** — they are all
incomplete and may have bugs. Use them for code structure and patterns, not for
"how the game should work."

## TypeScript standards

- **Strict everything.** `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`. Keep `npm run typecheck` clean at every stop point.
- **No `any`.** Use `unknown` and narrow.
- **Prefer plain objects and functions** for data. Classes for entities with
  behavior (Link, enemies, bosses). Interfaces for data shapes (map data, spawn
  tables).
- **Data is JSON, logic is TypeScript.** Map layouts, enemy tables, item tables,
  shop contents — all loaded from JSON files, never hardcoded.
- Files: `kebab-case.ts`. Types and classes: `PascalCase`. Functions and
  variables: `camelCase`. Constants: `SCREAMING_SNAKE`.

## Repo hygiene

- **Reference repos: never write into them.** Read-only, always.
- `zelda-nes-ts/` is the only place you write code.
- Temp/scratch files go to the session scratchpad, not the project.
- Nothing is a git repo yet. Don't `git init` or commit unless asked.

## Verification workflow

1. `npm run typecheck` after every meaningful change.
2. `npm test` — full suite. Never leave it red at a stop point.
3. Manual: `npm run dev` at `http://127.0.0.1:5173/`. From phase C onward, every
   slice should end with something you can *see*.
4. When comparing against the NES original, check edge cases — screen transitions,
   enemy spawn timing, damage interactions — not just the happy path.

## Naming conventions

- Mirror NES Zelda terminology. If the disassembly calls it `Dodongo`, don't
  rename it `SnakeBoss`. If the community calls it `Darknut`, use `Darknut`.
- Enemy class names match the enemy: `Octorok.ts`, `Darknut.ts`, `Gleeok.ts`.
- Keep names greppable across the disassembly and reference repos.
