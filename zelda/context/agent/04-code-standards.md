# Code Standards

## General

- **The disassembly is the spec.** Before writing a subsystem, find the relevant
  routine in `zelda1-disassembly-master/` and match its behavior exactly. Do not
  invent mechanics, do not "improve" timings, do not simplify AI because it looks
  over-complicated.
- **The reference repos inform patterns, not behavior.** Use bobbylight's
  TypeScript architecture, hfiggs's boss state machines, humbertodias's weapon
  code for *how to structure* the code. But for *what the game should do*, the
  disassembly wins.
- **One concern per file.** One enemy per file. One item per file. Keep things
  greppable.
- **Small, verifiable steps.** Each slice ends with something demonstrable.

## TypeScript

- **Strict everything:** `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`. `npm run typecheck` clean at every stop point.
- **No `any`.** Use `unknown` and narrow.
- **Prefer plain objects and functions** for data. Classes for entities with
  behavior (Link, enemies, bosses). Interfaces for data shapes.
- **`readonly` on loaded data.** JSON-loaded data is frozen; mutation belongs to
  runtime game state.
- Files: `kebab-case.ts`. Types and classes: `PascalCase`. Functions and
  variables: `camelCase`. Constants: `SCREAMING_SNAKE`.

## Data (`src/data/`)

All game data lives in JSON files, never hardcoded:

- `overworld.json` — 128 screens of tile data
- `dungeons/*.json` — 9 dungeon room layouts
- `enemies.json` — spawn tables, HP, damage, AI type
- `items.json` — drop tables, shop inventories, locations
- `second-quest/` — alternate data for Quest 2

JSON is committed to the repo (generated once by extraction scripts in phase B).
The game loads it at runtime via `fetch()`.

## Naming

- **Mirror NES Zelda terminology.** `Octorok`, not `Octopus`. `Darknut`, not
  `ArmoredKnight`. `Dodongo`, not `DinosaurBoss`.
- Enemy files: `src/objects/enemies/octorok.ts`, `darknut.ts`, `gleeok.ts`.
- Boss files: `src/objects/bosses/aquamentus.ts`, `ganon.ts`.
- Item files: `src/objects/items/boomerang.ts`, `bomb.ts`.

## Testing

- **Data validation tests** for phase B: every JSON file parses, every screen has
  valid tile IDs, every enemy spawn references a real enemy type.
- **Gameplay unit tests** where behavior is deterministic: collision resolution,
  damage math, inventory state, save round-trips.
- Do not chase coverage on rendering — test the logic, not the pixels.

## Comments

- Comment **why**, not what.
- When you match a non-obvious behavior from the disassembly, cite the bank and
  routine name. The next agent will otherwise "simplify" it back out.
