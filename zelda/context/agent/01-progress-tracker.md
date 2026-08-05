# Progress Tracker — THE live handoff log

> **Every agent, every session: read this file FIRST and update it LAST.**
> This is the only file that records what is actually happening. If you skip
> the update, the next agent restarts from zero and wastes the user's credits.
>
> Deep reference lives in `../ARCHITECTURE.md`, `../DECISIONS.md`,
> `../CONVENTIONS.md`, `../PLAN.md`. This file is state, not knowledge —
> put facts there, put status here.

**Project:** zelda — *Link's Awakening DX HD* as native TypeScript in the browser.
**Working dir for all commands:** `zelda-links-awakening-ts/`

**Last updated:** 2026-08-02 · **Phase:** A (Foundation) · **Slices done:** 1 / 90

---

## ⚠ Read this before planning anything

This is a **rewrite, not a port**. You read C# and write TypeScript by hand.
Nothing is transpiled; nothing is compiled to WASM (`../DECISIONS.md` #2).

The project is **pre-code**. The asset pipeline is solved and verified; no
TypeScript exists yet. `zelda-links-awakening-ts/` is an empty folder.

**Next action: slice A1** — scaffold the Vite + TypeScript project.

---

## What is ready and verified (2026-08-01)

| Thing | Path | State |
|---|---|---|
| v2.0.2 assets | `_fixtest/ladxhd_game_source_code/ProjectZ.Core/{Content,Data}` | ✅ 225 + 852 files, 0 corrupt |
| C# spec | `ladxhd_updated-main/ladxhd_game_source_code/ProjectZ.Core/` | ✅ 631 files / 110,243 lines |
| Migration inputs | `_fixtest/assets_original/` | ✅ **only copy** — irreplaceable |
| Re-run capability | `ladxhd_updated-main/{assets_patches,LADXHD-Migrater.exe}` | ✅ 457 patches |
| Behavior history | `ladxhd_updated-main/CHANGELOG.md` | ✅ 169 KB |
| Toolchain | node v24.12.0, npm 11.6.2 | ✅ confirmed |
| TS project | `zelda-links-awakening-ts/` | ✅ scaffolded (A1) |

---

## Queue — next 8 slices

Claim the top one, finish it, log it, stop. Full list of 90 in `../PLAN.md`.

| # | Slice | Notes |
|---|---|---|
| 1 | **~~A1~~** ✅ Scaffold project | done 2026-08-02 |
| 2 | **A2** Canvas + WebGL2 + fixed-timestep loop | pause on blur |
| 3 | **A3** `npm run assets` pipeline | idempotent; verify 225 + 852 counts |
| 4 | **A4** `BinaryReader` | LE ints/floats, strings, **CRLF-aware** |
| 5 | **A5** Input abstraction | keyboard + Gamepad API, action names |
| 6 | **A6** Debug overlay | backtick toggle, fps/entities/camera |
| 7 | **A7** Golden-fixture test harness | unblocks all of phase B |
| 8 | **B1** `.atlas` parser | 21 files · spec: `DictAtlasEntry.cs` |
| 9 | **B2** `.ani` structure | 285 files · spec: `AnimatorSaveLoad.cs` |

**Phase A gate:** blank canvas renders at a stable 60 fps, `npm run typecheck` and
`npm test` clean, asset pipeline reproducible from scratch.

---

## Open questions for the user

Answer cheaply, unblock later work. **None of these block A1.**

1. **Rename `_fixtest/` → `assets-v2.0.2/`?** Leftover debugging name. Cheap now,
   annoying once slice A3 hard-codes the path.
2. **Delete `context/README.md`?** 33 KB third-party article from the previous
   project. Nothing in this system references it.
3. **WebGL2 confirmed?** Assumed throughout. Flag before C1 if you want WebGPU.

*Resolved 2026-08-01:* language scope → **English + Spanish only** for v1
(`../DECISIONS.md` #11). Affects A3, B1, B7, B12.

---

## Notes worth carrying

- **The assets have no backups.** Both source folders and both Desktop zips are
  gone. `_fixtest/assets_original/` is the only copy of the corrected inputs. The
  originals are re-downloadable, but the CRLF repair would need redoing.
- **CRLF is load-bearing.** Read and write `.map`, `.atlas`, `.mgcb`, `.fx`,
  `.spritefont`, `.txt` as **bytes**. Any text-normalizing round-trip corrupts them
  silently. This broke the asset migration for two sessions — `../DECISIONS.md` #5.
- **The roster is the bulk.** `GameObjects/` is 454 files / 72,013 lines — 65% of
  the engine. Phases F–J are wide but shallow. The hard, narrow work is B
  (parsers), C7–C9 (shaders), E2 (threading), L3–L5 (GB audio).
- **`CHANGELOG.md` explains the weird stuff.** Search it before "fixing" behavior
  that looks wrong — years of deliberate accuracy fixes live there.
- **Two wrong diagnoses were made and corrected** during asset recovery (see
  `../PROGRESS.md`). Both were plausible narratives disproven by byte-level
  evidence. Expect the same during phase B: check the bytes, not the story.

---

## Session log

Newest first. Keep entries to one short paragraph. Archive to `../PROGRESS.md`
once this passes ~10 entries.

### 2026-08-02 — A1 complete: project scaffolded (Claude Opus 4.6)

Scaffolded `zelda-links-awakening-ts/`: Vite 8.2 + TypeScript 6 strict
(`noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`) + vitest 4.1
+ ESLint 10 with typescript-eslint. Folder skeleton matches ARCHITECTURE.md:
`src/{core,formats,render,world,objects,ui,audio,save}`, `public/assets/`,
`tests/fixtures/`. All three gates pass: `npm run typecheck` clean, `npm run test`
1/1, `npm run lint` clean. Dev server serves at localhost:5173. **Next: A2.**

### 2026-08-01 — Context system rewritten for Zelda (Claude)

The 6-file context system plus 7-file agent pack was written for a Pokemon Yellow
port; the user repurposed it for this project and asked for a full rewrite. All 13
files rewritten from scratch. Scope agreed with the user: **90 atomic slices,
~3 months, localhost only, never published.** Target folder
`zelda-links-awakening-ts/` confirmed empty; node/npm confirmed present. Earlier
sessions the same day covered version triage, ~1.1 GB of cleanup, and the asset
migration — that history is in `../PROGRESS.md`. **No production code written.
Next: A1.**
