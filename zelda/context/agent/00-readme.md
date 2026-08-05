# Agent onboarding — read this pack before doing anything

This folder (`context/agent/`) is the **entry point for any agent** (Claude, Grok,
GPT, other) picking up the Zelda TypeScript project. It is the workflow layer:
what we are building, how we work, and what state the work is in. The deep
knowledge base is one level up in `../` — this pack points at it rather than
duplicating it.

**The filenames are numbered in reading order** — just work down the directory.

- **`01-progress-tracker.md`** — ⚠ **START HERE, ALWAYS.** Current phase, what is
  done, the ordered queue of slices, open questions, and the session log. This is
  the only file that tells you what actually happened last session.
- `02-project-overview.md` — what we are building and why; scope and success criteria.
- `03-architecture.md` — how the pieces fit; boundaries; invariants.
- `04-code-standards.md` — implementation rules and the traps.
- `05-ai-workflow-rules.md` — the session contract, scoping, verification.
- `06-ui-context.md` — rendering, asset formats, and the shader/audio specifics.

If you are resuming known work, `01` alone may be enough. If you are new to the
project, read `01`–`05`; `06` matters once you touch rendering, assets or audio.

Deeper reference, one level up (`../`): `PROJECT.md`, `ARCHITECTURE.md`,
`PLAN.md` (the 90 slices), `DECISIONS.md` (settled choices and why, plus open
questions that need the user), `CONVENTIONS.md`, `PROGRESS.md` (archived session
history). `../README.md` is a leftover third-party article from the previous
project — **ignore it**.

## The two trees you will be working between

| Tree | Role | Rule |
|---|---|---|
| `ladxhd_updated-main/ladxhd_game_source_code/ProjectZ.Core/` | The **spec**: 631 C# files, 110,243 lines | read-only, never edit |
| `_fixtest/ladxhd_game_source_code/ProjectZ.Core/{Content,Data}` | The **assets**: 225 + 852 files, verified | read-only, never edit |
| `zelda-links-awakening-ts/` | What you are **building** | the only place you write |

This is a **rewrite, not a port**. You read C# and write TypeScript. Nothing is
transpiled, nothing is compiled to WASM.

## The one rule that matters most

**Update `01-progress-tracker.md` before you stop working.** Every session. This
project is built a little at a time by whichever agent is available, and the
tracker is the only continuity between them. If you do not update it, the next
agent starts from scratch and the user pays twice for the same work.

Also update the relevant context file whenever implementation changes the
architecture, scope, or standards documented here — and add a numbered, dated
entry to `../DECISIONS.md` for any architectural choice you make.

## Second-most important rule

**Never guess an asset format.** Every parser is derived from the C# that writes
it, and every parser slice must handle *all* files of its type before it is done.
`../CONVENTIONS.md` explains the procedure. Guessing is the single most likely way
this project stalls.
