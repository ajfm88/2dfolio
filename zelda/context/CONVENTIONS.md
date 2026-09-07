# CONVENTIONS — how to work on this project

Applies to every agent — Claude, Grok, GPT, whoever is next. This game is built
in small increments across many sessions by different agents. The rules below
exist so a session is never spent re-deriving what the last one already knew.

## The session contract

1. **Read `STATUS.md` first.** If you are new, read `PROJECT.md` and
   `ARCHITECTURE.md` too, and skim `PLAN.md` for where your slice sits.
2. **Claim one slice** from `PLAN.md`, starting with what `STATUS.md` names as
   the next action. Note it as in progress with your model name and the date.
3. **Do that slice and only that slice.** Do not opportunistically start the
   next one. Do not refactor code a different slice owns.
4. **Verify before you claim it is done** — see the checklist below.
5. **Update `STATUS.md` before you stop.** Change the next action, add a
   session-log paragraph, record anything the next agent needs.
6. **Add a `DECISIONS.md` entry** for any architectural choice, numbered and
   dated.

Steps 1 and 5 are the whole reason this system exists. Everything else is detail.

Also update the file that owns a fact when your work changes it: a new system
gets a row in `IMPLEMENTATION.md`; a changed boundary or invariant belongs in
`ARCHITECTURE.md`; a changed scope belongs in `PROJECT.md`.

## Scoping

- **One slice per session.** Slices are numbered in `PLAN.md` (A1, B4, G3, …).
  Claim the top of the queue, finish it, log it, stop. Do not batch slices.
- **If it turns out too big, split it** (`G4a`/`G4b`), log the split, finish the
  first half properly and stop. Don't half-finish and don't silently expand.
- **If it turns out too small, stop anyway** — the next agent takes the next one.
- **Do not reorder the critical path.** A → B → C → D → E was sequential.
  Phases F–I could be reordered freely once E landed.
- **Blocked?** Write the blocker into `STATUS.md`, pick the next unblocked
  slice, and say clearly what you skipped and why.
- **Record decisions in `DECISIONS.md`**, numbered and dated. Do not relitigate
  an existing entry without new evidence — but say so loudly when you find some.

## Behavioural fidelity — the rule that matters most

**The disassembly is the spec.** When in doubt about how anything should work,
read the assembly.

1. Find the relevant routine in `zelda1-disassembly-master/` (bank 4 for
   enemies, bank 5 for player, bank 7 for core engine).
2. Understand the behaviour — state transitions, timing, values.
3. Implement the same behaviour in TypeScript.
4. Cross-check the reference repos for implementation patterns.

The reference repos are **not authoritative for behaviour** — they are all
incomplete (5–35%) and may have bugs or invented mechanics. Use them for code
structure and patterns, not for "how the game should work". Do not invent
mechanics, do not "improve" timings, do not simplify AI because it looks
over-complicated. When behaviour looks arbitrary it probably encodes a quirk of
the original — check the disassembly before "fixing" it.

## Research discipline

- **`ARCHITECTURE.md` is already paid for.** Reference repo assessments, game
  specs, data sources — read them, don't re-derive them.
- **`IMPLEMENTATION.md` names the file that owns a behaviour.** Check it before
  grepping `src/`.
- **Targeted reads over sweeps.** `PLAN.md` names the disassembly source for
  each slice. Open that file, not the whole tree.
- **Grep before you read.** The disassembly is ~39,600 lines. Find the label,
  then read around it.

## TypeScript standards

- **Strict everything.** `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`. Keep `npm run typecheck` clean at every stop point.
- **No `any`.** Use `unknown` and narrow.
- **Prefer plain objects and functions** for data. Classes for entities with
  behaviour (Link, enemies, bosses). Interfaces for data shapes (map data, spawn
  tables).
- **`readonly` on loaded data.** JSON-loaded data is frozen; mutation belongs to
  runtime game state.
- **One concern per file.** One enemy per file, one item per file. Keep things
  greppable.
- Files: `kebab-case.ts`. Types and classes: `PascalCase`. Functions and
  variables: `camelCase`. Constants: `SCREAMING_SNAKE`.

## Data

**Data is JSON, logic is TypeScript.** Map layouts, enemy tables, item tables,
shop contents, dungeon rooms — all loaded from JSON in `src/data/`, never
hardcoded. This is what makes Second Quest a data swap instead of a code fork
(`DECISIONS.md` #4).

JSON is committed, generated once by the extraction scripts in `scripts/`
(`npm run extract:*`). The game loads it at runtime.

## Naming

- **Mirror NES Zelda terminology.** If the disassembly calls it `Dodongo`, don't
  rename it `SnakeBoss`. `Octorok`, not `Octopus`. `Darknut`, not
  `ArmoredKnight`. If the community calls it a Darknut, use `Darknut`.
- Enemy files: `src/objects/enemies/octorok.ts`, `darknut.ts`, `gleeok.ts`.
  Boss files: `src/objects/bosses/aquamentus.ts`, `ganon.ts`.
  Item files: `src/objects/items/boomerang.ts`, `bomb.ts`.
- Keep names greppable across the disassembly and the reference repos.

## Comments

- Comment **why**, not what.
- When you match a non-obvious behaviour from the disassembly, **cite the bank
  and routine name** (`Z_05.asm:362 UpdateMenuActive`). The next agent will
  otherwise "simplify" it back out.

## Testing

- **Data validation tests** for the extracted JSON: every file parses, every
  screen has valid tile IDs, every enemy spawn references a real enemy type.
- **Gameplay unit tests** where behaviour is deterministic: collision
  resolution, damage math, inventory state, save round-trips.
- Do not chase coverage on rendering — test the logic, not the pixels.

## Verification checklist

Before claiming a slice is done:

- [ ] `npm run typecheck` clean
- [ ] `npm test` green — no regressions
- [ ] For data slices: **every** expected entry exists in the JSON
- [ ] You actually ran it and *saw* it work at `http://127.0.0.1:5173/`
- [ ] Non-obvious NES-matching behaviour is commented and cited
- [ ] `STATUS.md` updated; `DECISIONS.md` entry added if you made a call
- [ ] `IMPLEMENTATION.md` row added or amended if you shipped or changed a system

When comparing against the NES original, check edge cases — screen transitions,
enemy spawn timing, damage interactions — not just the happy path.

## Honesty rules

- **Report what actually happened.** If tests fail, say so. If you skipped part
  of a slice, say which part and why.
- **"Done" means verified**, not "written and it looks right".
- **Do not fabricate progress.** An honest "I got 60% through B1 and here is
  exactly where it stops" is worth far more than a false completion.
- **Correct the record when you find an error** in earlier context, including
  your own.

## Repo hygiene and scope guards

- **Reference repos are read-only.** Never edit, never delete, never write into
  them. `zelda-nes-ts/` is the only place you write code.
- **Localhost only, permanently** (`DECISIONS.md` #1). No deploy step, no
  hosting, no public origin, no CDN, no analytics endpoint.
- **No emulation.** If a task seems to call for CPU/PPU emulation, stop and ask.
- **Nothing here is a git repo.** Don't `git init` or commit unless asked.
- Temp and scratch files go to the session scratchpad, not the project.
