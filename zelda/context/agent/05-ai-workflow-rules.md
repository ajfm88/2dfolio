# AI Workflow Rules

Applies to every agent working on this project — Claude, Grok, GPT, whoever is
next. This project is built in **small paid increments across many sessions by
different agents**. The rules below exist so that a session is never wasted
re-deriving what the previous one already knew.

## The session contract

1. **Read `01-progress-tracker.md` first.** Then `02-project-overview.md` and
   `03-architecture.md` if you are new. Skim `../PLAN.md` for where your slice
   sits among the 90.
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

- **One slice per session.** If it turns out too big, split it (`H4a`, `H4b`), log
  the split, finish the first half properly and stop. Do not half-finish both.
- **If it turns out too small,** stop anyway and say so — the next agent takes the
  next slice with full context rather than you burning yours on a second one.
- **Do not reorder the critical path.** A → B → C → D → E is sequential; nothing is
  playable until E. Phases F–J can be reordered freely once E lands.
- **Blocked?** Write the blocker into the tracker's open questions, pick the next
  unblocked slice, and say clearly what you skipped and why.

## Research discipline

The user is credits-conscious. Broad re-exploration is the main way sessions get
wasted.

- **`../ARCHITECTURE.md` is already paid for.** Subsystem sizes, asset counts,
  file paths, known hard parts — read it, don't re-derive it.
- **Targeted reads over sweeps.** `../PLAN.md` names the C# authority for each
  slice. Open that file, not the whole tree.
- **Grep before you read.** 631 files. Find the symbol, then read around it.
- **Do not re-measure what the tracker records.** If it says 285 `.ani` files,
  that is the number.

## Verification checklist

Before claiming a slice is done:

- [ ] `npm run typecheck` clean
- [ ] `npm test` green — no regressions
- [ ] For parser slices: **every** file of that type parses, wired as a test
- [ ] For phases D onward: you actually ran it and *saw* it work at
      `http://127.0.0.1:5173/`
- [ ] Non-obvious C#-matching behavior is commented and cited
- [ ] Tracker updated; `DECISIONS.md` entry added if you made a call

## Honesty rules

These matter more than usual here, because nobody is checking your work between
sessions.

- **Report what actually happened.** If tests fail, say so and paste the output.
  If you skipped part of a slice, say which part and why.
- **"Done" means verified**, not "written and it looks right."
- **Do not fabricate progress.** An honest "I got 60% through B4 and here is
  exactly where it stops" is worth far more than a confident false completion.
  The next agent trusts the tracker completely — it is the only continuity.
- **Correct the record when you find an error** in earlier context, including your
  own. Two wrong diagnoses were made and corrected during asset recovery
  (`../PROGRESS.md`); catching them early saved real time.

## Working with the C# reference

- **Read it, don't transpile it.** Mechanical translation produces TypeScript that
  is C#-shaped and wrong for a browser. Understand the behavior, then write idiomatic
  TS.
- **Check `CHANGELOG.md` when behavior looks arbitrary.** 169 KB, mostly entries of
  the form "fix X to match the original game." That odd one-frame delay is
  probably deliberate.
- **The C# wins disputes.** When your implementation disagrees with
  `ProjectZ.Core`, yours is wrong until proven otherwise. Deliberate deviations
  need a `DECISIONS.md` entry.
- **Never write into the reference trees.** `ladxhd_updated-main/` and `_fixtest/`
  are read-only. `_fixtest/assets_original/` is irreplaceable — the only copy.

## Scope guards

- **Localhost only, permanently** (`../DECISIONS.md` #1). No deploy step, no
  hosting, no public origin. If a task seems to call for it, stop and ask.
- **Parked means parked:** the level editor, mod support, touch controls, and GB
  sound emulation (L3–L5). Do not pull them forward without the user asking.
- **No `git init`, no commits** unless the user asks.
