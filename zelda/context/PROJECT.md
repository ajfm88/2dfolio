# PROJECT — what and why

Reimplement **The Legend of Zelda: Link's Awakening DX HD** as a **native
TypeScript browser game**, running on localhost, with **no C#, no .NET, no WASM
runtime, and no MonoGame** at runtime. The new engine lives in
`zelda-links-awakening-ts/`.

This is a **rewrite**, not a port. The C# source is the specification; the
TypeScript is written from scratch against it.

**As of 2026-08-01 the asset pipeline is solved and the code is unwritten.**
Migrated v2.0.2 assets exist and verify clean (225 Content + 852 Data files, zero
corrupt). `zelda-links-awakening-ts/` is empty. Slice **A1** is the next action.

**Scope agreed with the user (2026-08-01):** ~3 months, **90 atomic slices**.
Slices are deliberately small — one per session, each independently verifiable.

Live status: `context/agent/01-progress-tracker.md`. Roadmap: `PLAN.md`.

## Goals

- `npm run dev` → play in a browser at `http://127.0.0.1:5173/`. Nothing else installed.
- Feature parity with **v2.0.2**, the final upstream release.
- Behavioral fidelity to the C# original — it is the reference implementation, and
  where the two disagree, the C# is right unless `DECISIONS.md` says otherwise.
- Any agent can pick up one slice and finish it in a single sitting.

## Non-goals

- **Publishing or hosting.** Localhost only, permanently. The assets are
  Nintendo's; a public URL would distribute them. Explicit user decision — see
  `DECISIONS.md` #1.
- Compiling the C# to WASM (Blazor/KNI). Evaluated and rejected — `DECISIONS.md` #2.
- Shipping compiled `.xnb` content. Unusable in a browser — `DECISIONS.md` #3.
- Mobile/touch controls in v1. The upstream Android head is a useful reference for
  later, not a v1 target.
- The level editor (`Editor/` in the C# tree). Play the game first.
- Mod support (`.lahdmod` / `.lahdpak`). Out of scope until the base game runs.

## What exists today

| Thing | Where | State |
|---|---|---|
| v2.0.2 game assets | `_fixtest/ladxhd_game_source_code/ProjectZ.Core/{Content,Data}` | ✅ verified clean |
| C# reference source | `ladxhd_updated-main/ladxhd_game_source_code/ProjectZ.Core/` | ✅ 631 files, 110,243 lines |
| Migration inputs (corrected) | `_fixtest/assets_original/` | ✅ only copy — do not delete |
| Re-run capability | `ladxhd_updated-main/{assets_patches,LADXHD-Migrater.exe}` | ✅ |
| Behavior history | `ladxhd_updated-main/CHANGELOG.md` | ✅ 169 KB, v1.0.0 → v2.0.2 |
| TypeScript engine | `zelda-links-awakening-ts/` | ⬜ empty |

## Background (historical)

An anonymous developer released a MonoGame PC port on itch.io; it was taken down,
but the release included source. `bighead.0` forked and maintained it on GitLab
through **v2.0.2**, the final release. This project is a third-generation
descendant: C# → TypeScript, desktop → browser.

Assets ship stripped upstream. Recovering them required applying 457 `.vcdiff`
patches to pristine v1.0.0 files. That migration initially failed on every text
asset; the cause was **git CRLF→LF normalization** in a mirrored copy, not
version drift. Diagnosis and fix are recorded in `DECISIONS.md` #5. Reproducing
it is a solved, scripted problem — see `PLAN.md` slice A3.
