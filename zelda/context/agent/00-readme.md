# Agent onboarding — read this pack before doing anything

This folder (`context/agent/`) is the **entry point for any agent** (Claude, Grok,
GPT, other) picking up the Zelda NES TypeScript project. It is the workflow layer:
what we are building, how we work, and what state the work is in. The deep
knowledge base is one level up in `../` — this pack points at it rather than
duplicating it.

**The filenames are numbered in reading order** — just work down the directory.

- **`01-progress-tracker.md`** — ⚠ **START HERE, ALWAYS.** Current phase, what is
  done, the ordered queue of slices, open questions, and the session log. This is
  the only file that tells you what actually happened last session.
- `02-project-overview.md` — what we are building and why; scope and success criteria.
- `03-architecture.md` — how the pieces fit; boundaries; invariants.
- `04-code-standards.md` — implementation rules.
- `05-ai-workflow-rules.md` — the session contract, scoping, verification.
- `06-ui-context.md` — NES rendering, sprites, audio specifics.

If you are resuming known work, `01` alone may be enough. If you are new to the
project, read `01`–`05`; `06` matters once you touch rendering, sprites or audio.

Deeper reference, one level up (`../`): `PROJECT.md`, `ARCHITECTURE.md`,
`PLAN.md` (the 45 slices), `DECISIONS.md` (settled choices and why, plus open
questions that need the user), `CONVENTIONS.md`, `PROGRESS.md` (archived session
history).

## The reference material

| Repo | Role | Rule |
|---|---|---|
| `zelda1-disassembly-master/` | **THE spec**: full NES ROM, 39,600 lines of 6502 asm | read-only |
| `ZeldaJS-master/` | Best TypeScript/browser patterns | read-only |
| `zelda-clone-master/` | Best combat/boss/item C# patterns | read-only |
| `game-zelda-js-master/` | Weapon variety, HUD, sprites | read-only |
| `zelda-js-master/` | Overworld map images | read-only |
| `Legend-Of-Zelda-Javascript-main/` | ECS pattern, pathfinding | read-only |
| `zelda-nes-ts/` | What you are **building** | the only place you write |

## The one rule that matters most

**Update `01-progress-tracker.md` before you stop working.** Every session. This
project is built a little at a time by whichever agent is available, and the
tracker is the only continuity between them. If you do not update it, the next
agent starts from scratch and the user pays twice for the same work.

Also update the relevant context file whenever implementation changes the
architecture, scope, or standards documented here — and add a numbered, dated
entry to `../DECISIONS.md` for any architectural choice you make.
