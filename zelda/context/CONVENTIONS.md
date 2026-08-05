# CONVENTIONS — working rules

## Session discipline (read this part even if you skip the rest)

- **Live state lives in `context/agent/01-progress-tracker.md`.** Read it at the
  start of every session; update it before you stop. It holds the current phase,
  the ordered slice queue, open questions and the session log.
- **One slice per session.** Slices are numbered in `PLAN.md` (A1, B4, H7, …).
  Claim the top of the queue, finish it, log it, stop. Do not batch slices.
- **Record decisions in `DECISIONS.md`**, numbered and dated. Do not relitigate an
  existing entry without new evidence — but say so loudly when you find some.
- The user is credits-conscious: prefer targeted reads over broad re-exploration.
  The research in `ARCHITECTURE.md` is already paid for — reuse it, don't redo it.
- If a slice turns out bigger than one session, **split it** (`H4a`/`H4b`), log
  the split, and keep going. Don't half-finish and don't silently expand.

## Format fidelity — the rule that matters most

**Every parser is derived from the C# writer, never guessed.**

The asset formats are bespoke and undocumented. There is no spec but the code.

1. Find the C# that reads/writes the format (`PLAN.md` names it per slice).
2. Read it. Note field order, sizes, endianness, string encoding, sentinels.
3. Write the TS parser to match, citing the C# file and line range in a comment.
4. Prove it: parse **every** file of that type, not one. 285 `.ani` files means
   285 must parse.
5. Cross-check a sample against C# behavior — counts, dimensions, names.

A parser that works on one file and dies on file 40 is the default outcome of
guessing. The audit step in each B slice exists to catch exactly that.

## Behavioral fidelity

- **The C# is right.** When your implementation disagrees with `ProjectZ.Core`,
  yours is wrong until proven otherwise.
- **Check `CHANGELOG.md` before "fixing" odd behavior.** 169 KB of entries, most
  of the form "fix X to match the original game." That weird one-frame delay is
  probably load-bearing.
- Deliberate deviations require a `DECISIONS.md` entry. Never an undocumented
  judgment call.

## TypeScript standards

- **Strict everything.** `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`. Keep `npm run typecheck` clean at every stop point.
- **No `any`.** Use `unknown` and narrow. A parser returning `any` defeats the
  purpose of the phase.
- **Parsers are pure.** `(bytes: Uint8Array) => ParsedThing`. No DOM, no globals,
  no fetch, no side effects. This is what makes them testable in Node.
- **No classes where a plain object works.** The C# is deeply OO because C# is;
  don't inherit that structure reflexively. Entities warrant classes; parsed data
  does not.
- Name things after the C# concept so cross-referencing stays cheap — if the C#
  calls it `ObjAnimatedTile`, don't rename it `TileSprite`.

## Repo hygiene

- `ladxhd_updated-main/`, `_fixtest/`: **never write into these.** Read-only
  reference and assets.
- `zelda-links-awakening-ts/public/assets/` is **generated**. Never hand-edit.
  `npm run assets` must reproduce it from scratch, idempotently.
- Temp/scratch files go to the session scratchpad, not the project.
- Nothing is a git repo yet. Don't `git init` or commit unless asked.
- `_fixtest/assets_original/` is the **only copy** of the corrected migration
  inputs. Treat it as irreplaceable.

## Verification workflow

1. `npm run typecheck` after every meaningful change.
2. `npm test` — full suite. Never leave it red at a stop point.
3. For parser slices: the "all N files parse" check is the real gate, not the
   unit tests. Wire it as a test so it stays enforced.
4. Manual: `npm run dev` at `http://127.0.0.1:5173/`. From phase D onward, every
   slice should end with something you can *see*.
5. When comparing against the C#, spot-check something awkward — a boss with
   phases, a map with sidecar `.data`, a multi-language `.lng` — not the simplest
   case that happens to work.

## Naming traps (add to this list as you hit them)

*Empty at 2026-08-01 — the Pokemon-era entries were removed as irrelevant.*

This section earned its keep on the previous project. Expect it to fill up fast
once the parsers land: asset-name/id mismatches, files that share a tileset,
derivative language files, sentinel values that mean "absent" rather than zero.
**When something costs you an hour, write it here.**

One is already known:

- **CRLF is load-bearing** in the original asset text files. Any tooling that
  round-trips `.map`, `.atlas`, `.mgcb`, `.fx`, `.spritefont` or `.txt` through a
  text-normalizing layer (git, an editor, a naive `readFile`/`writeFile`) will
  silently corrupt them. See `DECISIONS.md` #5. Read and write these as **bytes**.
