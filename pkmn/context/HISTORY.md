# HISTORY — session archive

> ⚠ **This is not the live log.**
>
> Current state, the ordered work queue, open questions and recent sessions live in
> **`STATUS.md`** — read that first, and update it before you stop working.
> (DECISIONS #11, #19.)
>
> This file keeps older session entries once `STATUS.md`'s session log gets long,
> so the live log stays short enough that agents actually read it.

Newest first.

## Prior work — code lost (discovered 2026-09-22)

The sessions below (2026-07-27 → 2026-08-04) built this list on a modified copy
of the engine. **That copy no longer exists anywhere** (DECISIONS #26); on
2026-09-22 `game/` was re-created from vanilla upstream. The knowledge survives
in the context files; the code is rebuilt in the slice named in the last column.

| Old ID | What it delivered | Rebuilt in |
|---|---|---|
| P1 | Environment + typecheck | setup 2026-09-22 ✅ |
| P-ROM | ROM verified; setup → 156 JSON | setup 2026-09-22 ✅ |
| P2-1/P2-2 | ASM generators `scripts/gen/` parked (DECISIONS #15) | not rebuilt — only needed for romhack-style edits |
| P2-3 | PSYCHIC chart asymmetric (DECISIONS #10) | **V5** (bug re-confirmed 2026-09-22) |
| P4-1 | PNG dumper → `static/gfx/**` (~518 PNGs) | ✅ R1a (exactly 518) |
| P4-2 | Title `.tilemap` binaries (3 files) | ✅ R1a |
| P4-3 | Asset spot check 52/52 + user play | ✅ R1a (PNGs viewed, pret cross-check) + R1b (user played) |
| P5-1 | `publicDir: 'static'`, mirror data (DECISIONS #16) | ✅ R1a + R1b |
| P5-2 | ROM gate deleted | ✅ R1b |
| P5-3 | Full path smoke + map graph (`scripts/smoke_p5_3.mjs`) | rebuild only if needed |
| Polish | Audio clock; walk FPS max 60; title PKMN; base `/` (#17) | ✅ R1b (title, base); **V5** (FPS — O-5) |
| Polish | Overworld sprite extract size fix | found in R1a (sheets are 16×768, harmless) — trim is a **V5** candidate |
| Save | Harden + verify on 127.0.0.1 | ✅ save → reload → CONTINUE re-tested from a fresh clone in R1c (upstream save code; the old copy's "harden" changes are unknown) |
| P7 | Final verification baseline | — |
| Stretch v1 | Battle move anims (category-based) | upstream has its own approximation (`battle_ui.ts:326`); revisit later |
| SFX | `SFX_HEADERS` expanded — 49 SFX (was ~10) | **V5** |
| SFX-wire | `playSFX` at faint / level_up / heal / ball / save / shop / ledge / items | **V5** |
| Maps-v1 | Demo gate off; Route 2 + Forest + Pewter (24 maps) | **V1, V2** |
| Maps-v2 | Gym + Museum + Diglett's Cave + Route 3 (30 maps); Brock → BADGE_1 | **V3, V4** |
| — | `scripts/_extract_maps_only.ts` helper | rebuild only if needed |

## Archived session entries

### 2026-08-02 (roadmap restructure) — Claude Opus 4.6

Rewrote `PLAN.md` from vague "Maps-vN" estimates to 90 numbered slices
(A1–O1). Updated tracker queue, agent onboarding files. No production code.
**Superseded 2026-08-04:** 90-slice plan replaced by 29-slice plan (R1–X2).

### 2026-07-30 (context sync) — stopped after Maps-v2 (Grok)

User asked to refresh context only (no new code). Synced handoff snapshot,
PROJECT/PLAN/agent overview, test baseline **395**, map list (30), Next Up.

### 2026-07-30 — Vanilla maps-v2: Gym / Museum / Cave / Route3 (Grok)

Added 6 maps (24→**30**): `PewterGym`, `Museum1F/2F`, `DiglettsCave`,
`DiglettsCaveRoute11`, `Route3`. Pewter east→Route3 open.

- Brock/Jr.Trainer are real trainers; **Brock victory → BADGE_1** + gym music
- Digletts Cave walkable Route2↔Route11 entrance (Route11 outdoor not yet)
- Route3 west only (north=Route4 deferred)
- typecheck clean; **395/395** tests

### 2026-07-30 — Vanilla maps-v1: open north of Viridian (Grok)

Demo old-man "thanks for playing" gate removed (path open with GOT_POKEDEX).
Extracted **12 → 24** maps. ViridianCity north → Route2; forest trainers have
`trainerClass`. typecheck clean; **391/391** tests.

### 2026-07-30 — SFX-wire call sites (Grok)

Wired extracted SFX into gameplay (typecheck + 388/388). Files: `battle.ts`,
`save_menu.ts`, `shop_menu.ts`, `player.ts`, `script_controller.ts`,
`overworld_controller.ts`.

### 2026-07-30 — SFX extraction expanded (Grok)

Walked pret `sfxheaders{1–4}.asm`. Filled `SFX_HEADERS` for UI/OW, battle,
intro + aliases. 49 SFX JSON; **388/388** tests.

### 2026-07-30 (note) — Netlify DEAD LAST (user)

User wants a fully working product before any deploy concern.

### 2026-07-30 — battle move anims v1 / P7 / OW sprites / save (Grok)

Crude category anims, final verification, sprite size fix, save harden.
All user-confirmed. Detail archived below.

### 2026-07-29 — ROM-based extraction pivot (Claude Opus 4)

User's cartridge dump verified (SHA1 match). `npm run setup pokeyellow.gbc`
emitted 156 JSON files. Tests went from unrunnable to **375/375**.
DECISIONS #14 (ROM as build-time source), #15 (ASM generators parked).

### 2026-07-27 — Initial project assessment + context system (Claude Opus 4)

Evaluated both repos; chose `pokemon-yellow-typescript-main` as base.
Established six-file context system. DECISIONS #1–#9.
