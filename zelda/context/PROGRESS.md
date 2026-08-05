# PROGRESS — session archive

> ⚠ **This is not the live log.**
>
> Current state, the ordered slice queue, open questions and recent sessions live
> in **`context/agent/01-progress-tracker.md`** — read that first, and update it
> before you stop working.
>
> This file keeps older session entries once the tracker's Session Log gets long,
> so the tracker stays short enough that agents actually read it.

Newest first.

## 2026-08-01 — Project reset: Pokemon → Zelda (Claude)

The context system was originally written for a Pokemon Yellow TypeScript port.
The user repurposed it for a new project — a native TypeScript browser
reimplementation of *Link's Awakening DX HD* — and asked for a full rewrite. All
13 context files were rewritten from scratch on this date. **No Pokemon-era
content remains** except this archive note and the unreferenced `README.md`.

Work completed in the sessions leading up to the rewrite (all pre-code):

- **Version triage.** Identified `ladxhd_updated-main` (v2.0.2, .NET 8, MonoGame
  3.8.4.1, 631 files) as the current upstream, vs the older `master` fork (.NET 6,
  MonoGame 3.8.1.303, 565 files, ~v1.0.0).
- **Disk cleanup.** ~1.1 GB removed across two passes: the stale 1.9.7 patcher
  binary, `ladxhd_patcher_source_code` (512 MB of `.xnb` patches), released mods,
  migration tool builds, vcdiff source, launcher source, plus both superseded
  asset trees once their contents were preserved. 186.8 MB → then the TS target
  folder was added.
- **Asset migration solved.** The 457-patch v1.0.0 → v2.0.2 migration initially
  failed outright. Root cause diagnosed as git CRLF→LF normalization in the
  mirrored fork, **not** the suspected Migrater version gap. Fix: pristine `Data`
  from the v1.0.0 release + fork `Content` with CRLF restored on 25 text files.
  Result: exit 0, 225 Content + 852 Data files, zero corrupt. Full detail in
  `DECISIONS.md` #5.
- **Feasibility assessed.** Blazor/KNI (C#→WASM) evaluated and rejected in favour
  of a native TS rewrite (`DECISIONS.md` #2). Hard parts identified up front:
  four OS threads, 20 HLSL shaders, a full Game Boy CPU+APU emulator, and ~110k
  lines of gameplay logic with no library support for any of its asset formats.
- **Scope agreed.** 90 atomic slices, ~3 months, localhost only, never published.

Production code written: **none**. `zelda-links-awakening-ts/` is empty and slice
A1 is the next action.

### Corrections made during this work, kept for the record

Two wrong calls were made and then disproven by evidence. Both are worth
remembering, because both were plausible:

1. **"`master`'s assets aren't pristine v1.0.0."** Inferred from `/platform:MacOSX`
   in its `Content.mgcb`. Wrong — the file was line-ending-mangled, not
   content-edited. That `/platform` line is in the genuine v1.0.0 file too.
2. **"The Migrater 2.0.0 / patches 2.0.2 gap is the likely failure."** Wrong — that
   combination migrates cleanly. Flagged as the top risk for two sessions before
   the byte-level evidence pointed elsewhere.

The lesson generalizes to the port: **check the bytes before trusting the
narrative.** It applies directly to every parser slice in phase B.
