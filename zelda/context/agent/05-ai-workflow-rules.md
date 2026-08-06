# AI Workflow Rules

Applies to every agent working on this project — Claude, Grok, GPT, whoever is
next. This project is built in **small increments across many sessions by
different agents**. The rules below exist so that a session is never wasted
re-deriving what the previous one already knew.

## The session contract

1. **Read `01-progress-tracker.md` first.** Then `02-project-overview.md` and
   `03-architecture.md` if you are new. Skim `../PLAN.md` for where your slice
   sits among the 45.
2. **Claim one slice** from the tracker's *Queue* table. Note it as in-progress
   with your model name and the date.
3. **Do that slice and only that slice.** Do not opportunistically start the next
   one. Do not refactor code a different slice owns.
4. **Verify before you claim it is done** — see the checklist below.
5. **Update `01-progress-tracker.md` before you stop.** Move the slice out of the
   queue, add a session-log paragraph, record anything the next agent needs.
6. **Add a `../DECISIONS.md` entry** for any architectural choice, numbered and
   dated.

Steps 1 and 5 are the whole reason this system exists. Everything else is detail.

## Scoping

- **One slice per session.** If it turns out too big, split it (`G4a`, `G4b`), log
  the split, finish the first half properly and stop.
- **If it turns out too small,** stop anyway — the next agent takes the next slice.
- **Do not reorder the critical path.** A → B → C → D → E is sequential; nothing is
  playable until E. Phases F–I can be reordered freely once E lands.
- **Blocked?** Write the blocker into the tracker's open questions, pick the next
  unblocked slice, and say clearly what you skipped and why.

## Research discipline

- **`../ARCHITECTURE.md` is already paid for.** Reference repo assessments, game
  specs, data sources — read them, don't re-derive them.
- **Targeted reads over sweeps.** `../PLAN.md` names the disassembly source for
  each slice. Open that file, not the whole tree.
- **Grep before you read.** The disassembly is ~39,600 lines. Find the label, then
  read around it.

## Verification checklist

Before claiming a slice is done:

- [ ] `npm run typecheck` clean
- [ ] `npm test` green — no regressions
- [ ] For data slices: **every** expected entry exists in the JSON
- [ ] For phases C onward: you actually ran it and *saw* it work at
      `http://127.0.0.1:5173/`
- [ ] Non-obvious NES-matching behavior is commented and cited
- [ ] Tracker updated; `DECISIONS.md` entry added if you made a call

## Honesty rules

- **Report what actually happened.** If tests fail, say so. If you skipped part
  of a slice, say which part and why.
- **"Done" means verified**, not "written and it looks right."
- **Do not fabricate progress.** An honest "I got 60% through B1 and here is
  exactly where it stops" is worth far more than a false completion.
- **Correct the record when you find an error** in earlier context, including your
  own.

## Working with the references

- **The disassembly wins disputes.** When your implementation disagrees with the
  6502 assembly, yours is wrong until proven otherwise. The reference repos may
  have bugs — they are all incomplete.
- **Read assembly for behavior, read TypeScript/C# for patterns.** The disassembly
  tells you *what* to do; the reference repos show *how* to structure it in a
  high-level language.
- **Never write into the reference repos.** All 6 are read-only.

## Scope guards

- **Localhost only, permanently** (`../DECISIONS.md` #1). No deploy step, no
  hosting, no public origin.
- **No emulation.** If a task seems to call for CPU/PPU emulation, stop and ask.
- **No `git init`, no commits** unless the user asks.
