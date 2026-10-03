# STATUS — the live handoff log

> **Every agent, every session: read this file FIRST and update it LAST.**
> This is the only file that records what is actually happening. If you skip the
> update, the next agent restarts from zero and the user pays twice for the same
> work. An unlogged session is a lost session.
>
> This file is **state, not knowledge**. Facts go in `ARCHITECTURE.md` /
> `DECISIONS.md` / `CONVENTIONS.md`; status goes here. Older session entries are
> archived in `HISTORY.md`.

**Project:** pkmn — Pokemon Yellow playable in the browser, zero ROM dependency.
**Working dir for all commands:** `game/`

**Last updated:** 2026-09-22 · **Phase:** R (Commit Extracted Data) · **Milestones done:** 0 / 34

---

## ⚠ Read this before planning anything

**The code from the July–August sessions was lost** (found 2026-09-22; DECISIONS
#26). Those sessions worked on a modified copy of the engine — 30 maps, ROM gate
removed, `static/` + PNGs, Psychic fix, 49 SFX — and **no copy of it exists
anywhere**. `game/` is a fresh copy of **vanilla upstream**. What those sessions
*learned* survives in `ARCHITECTURE.md` / `CONVENTIONS.md` / `DECISIONS.md`, so
rebuilding is cheaper than the first time. The rebuild is **Phase V**.

If a context file claims "30 maps", "395 tests", "the gate was deleted (P5-2)"
or "PSYCHIC chart implemented" without a *lost* marker, it is stale — trust this
file and the code, and fix the stale line.

**Commit policy (user, 2026-09-22):** commit **locally** at the end of every
slice — `git add` + `git commit` from the root, message ending with the
co-author line. **Never push** — there is no remote and there must never be one
(Hard rule #9, DECISIONS #24).

---

## Current phase

**Phase R — Commit Extracted Data**, split into three slices (DECISIONS #26):
**R1a** export graphics → **R1b** run the browser from files → **R1c** commit
the data. Then **Phase V** rebuilds the lost work, then Phase A.

---

## 📍 Where things stand — 2026-09-22 (verified, not inherited)

### Setup — done

| Item | State |
|---|---|
| Git | Root repo, branch `master`, **no remote**. Baseline commit `9bf2d7d` = docs + vanilla upstream |
| Ignored | `*.gbc`/`*.gb` (the ROM), `refs/`, `pkmn-sprites/`, `node_modules/`, `data/` (upstream `game/.gitignore` — R1c changes this) |
| ROM | `game/pokeyellow.gbc`, SHA1 `cc7d0326…4a38e1` (DECISIONS #14) — re-verified 2026-09-22 |
| `refs/` | All 5 cloned on pinned branches: `pokeyellow` master `e89ead15`, `gen1recomp` dev `78a3defa`, `oldamber` main `268d571`, `engine` main `9b88fd6c`, `dmg` main `5e3b785` |
| `game/` | `gididaf/pokemon-yellow-typescript` `main` @ `05faa114` (2026-03-27), no `.git/`. Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` → *Engine reference*, then deleted |
| `npm run setup` | 156 JSON → `data/` (9.7 MB); since R1a also rebuilds `static/`: 518 PNG + 3 `.tilemap` + 156 JSON mirror (~1.4 s, byte-identical across runs) |
| Typecheck | Clean |
| Tests | **381/381** with `ROM_PATH=pokeyellow.gbc` (334 battle + 41 extraction + 6 static export); without it 334 pass, 47 skip |

### What the game has today (upstream audited 2026-09-22, + R1a/R1b)

| Area | State |
|---|---|
| Runtime data path | ✅ **No ROM** (R1b): the browser loads only `static/` via plain `fetch()` / `<img>`. Upstream's upload gate is deleted; the bundle has no gate code |
| Vite | `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'` (missing file = real 404). Tab title **PKMN** |
| Background tabs | ✅ keeps running unfocused — logic + music (worker ticker, DECISIONS #27). User-verified |
| Maps | **12**: PalletTown, RedsHouse1F/2F, BluesHouse, OaksLab, Route1, Route22, ViridianCity, ViridianPokecenter, ViridianMart, ViridianSchoolHouse, ViridianNicknameHouse |
| Demo gate | Viridian old man: "this is as far as the demo goes!" (`overworld_controller.ts:411`, `story_state.ts:78`) → V1 |
| Route 22 | warp to `Route22Gate` (not extracted) |
| Wild data | 57 `wild/*.json` |
| Music | 46 tracks extract (47 listed) |
| SFX | **10** extract. Wired: `press_ab`, `collision`, `start_menu`, `go_inside`/`go_outside` → V5 |
| Type chart | **PSYCHIC bug present** — chart uses `PSYCHIC_TYPE` on both sides, species use `PSYCHIC`, so Bug→Psychic 2×, Fighting→Psychic ½×, Psychic→Psychic ½×, Ghost→Psychic 0× never apply (DECISIONS #10) → V5 |
| Hidden items | ✅ work (Viridian City hidden Potion) |
| Item balls | ❌ extractor parses `isItem` objects (`maps.ts:619`), nothing picks them up → A1 |
| Trainer sight | Engine ✅ (`npc.ts:204`, `overworld_controller.ts:190`, `trainer_approach` state) but **no map sets `sightRange`** → A1 |
| Whiteout | ✅ `handleBlackoutWarp` — halves money, heals, warps to last Pokécenter |
| Badge stat boosts | ✅ `damage.ts:applyBadgeStatBoosts`. Nothing awards a badge yet → V3 |
| TM/HM teaching | ❌ → A2 |
| Poison walking, Repel, Escape Rope | ❌ (items exist in the price table only) → A3 |
| Evolution, move learning, Pokédex, PC, shops, save | ✅ (see root `CLAUDE.md` → *Engine reference*) |
| Save | `localStorage` key `p151-s` — use **`http://127.0.0.1:5173/`** |
| Sim FPS | `-` / `+`, default **50**, range 10–200 (`main.ts:893`) — see O-5 |

### Controls (upstream)

| Action | Keys |
|---|---|
| D-pad | Arrows or WASD |
| A / B | Z / X |
| Start / Select | Enter / Shift |
| Unlock audio | Click once on "Click to start" |
| Pause | `p` |
| Debug overlay + warps | Backtick (warps: Pallet, Viridian, Route 1, Route 22, Lab, houses, Pokécenter, Mart) |
| Sim FPS | `-` / `+` |

### Scope freezes (user)

- **1:1 vanilla Yellow.** No rebalancing, no improvements, no added content. Gen 1
  bugs reproduced deliberately.
- **Sprites are vanilla Yellow from ROM extraction** for the whole build.
  `pkmn-sprites/` stays untouched.
- **Randomizer = year-two idea** (X1, dead last, DECISIONS #21–#23). Don't start it,
  don't design around it.
- **Local only, never pushed** (DECISIONS #24). Saves on `127.0.0.1`.
- **Timeline: 1–2 years, ~700–800 sessions.** Milestones, not sittings. A session
  that delivers one small verified thing is a good session.

---

## Completed

| Slice | Result |
|---|---|
| Setup | ROM verified, refs cloned, upstream copied, 375/375 — baseline commit `9bf2d7d` |
| **R1a** | setup exports `static/` via the browser's own `extractRom()`; +6 tests (381); `scripts/` now typechecked; Pikachu pret pixel test un-skipped (passes). Details: `notes/r1a-graphics-export.md` — commit `dbca9d3` |
| **R1b** | browser runs from `static/`: ROM gate deleted, `publicDir: 'static'`, `base: '/'`, `appType: 'mpa'`, title PKMN; build bundle has 0 gate code. **User played it with no ROM.** Plus (user request) the game keeps running in background tabs + keys released on blur — DECISIONS #27 |

The July–August work (P1…Maps-v2) is listed in `HISTORY.md` → *Prior work — code
lost*. It does not count here.

## In progress

- **R1c** — Claude Opus 5.5, 2026-09-22 (user confirmed R1b and the plan to continue).

## Next up — queue

Claim the top one, finish it, verify, **commit locally**, log it, stop. Full
roadmap in `PLAN.md`.

| # | Slice | Phase | Notes |
|---|---|---|---|
| 1 | **R1c** Commit the data | R | un-ignore `data/` + `static/`, add `.gitattributes` (binary `*.png` `*.tilemap`), prove with a fresh clone |
| 2 | **V1** Route 2 + Viridian Forest | V | + gates, trade house, Diglett's Cave entrance; drop the demo gate |
| 3 | **V2** Pewter City | V | city + Pokécenter, Mart, 2 houses |
| 4 | **V3** Pewter Gym + Museum | V | Brock → BADGE_1; Museum 1F/2F |
| 5 | **V4** Diglett's Cave + Route 3 | V | cave, Route 11 entrance building, Route 3 |
| 6 | **V5** Recovered fixes | V | PSYCHIC chart, SFX catch-up, O-5, maybe sprite-sheet trim |
| 7 | **A1** Item balls + trainer sight data | A | re-audit against upstream first |

**Phase R gate:** a fresh clone plays with no ROM and no setup; typecheck clean;
381/381 with `ROM_PATH` (without it the 47 ROM tests skip, the rest pass).

### Slice notes (for whoever claims them)

- **R1a, R1b** — done; see *Completed*, `notes/r1a-graphics-export.md`, and
  ARCHITECTURE → *Data flow* / *Game loop & background tabs*.
- **R1c.** Also re-test **save → reload → CONTINUE** from the fresh clone (not
  re-tested since R1b; save code untouched). Confirmed in R1a: 2 of the 3
  `.tilemap` files contain **no NUL byte** — the `.gitattributes` step is required. Upstream's `game/.gitignore` patterns `data/` and `gfx` are unanchored —
  `gfx` would also ignore `static/gfx/`; remove both and confirm with
  `git status --ignored`. Git's `core.autocrlf=true` on this machine would rewrite text-looking
  binaries on checkout — `.tilemap` files may have no NUL bytes, so mark them
  binary in a root `.gitattributes` (also `*.png binary`, `*.sh text eol=lf`).
  Proof: `git clone` the local repo into the scratchpad, `npm install`,
  `npm test` without `ROM_PATH`, `npx vite`, play.

## Open questions

- **O-5: Sim FPS default.** Upstream runs the game loop at **50** fps by default
  (range 10–200); Game Boy hardware is ≈59.73 fps, and the lost copy capped the
  max at 60. Is 50 a deliberate upstream choice or a fidelity bug? Investigate in
  V5 (read `main.ts` gameLoop + `refs/pokeyellow` timing), then ask the user.
- **O-2: Crystal animated GIFs in the randomizer pool?** Not blocking; decide when
  X1 starts. (`DECISIONS.md` → *Open*.)

## Notes for later

### Randomizer / pkmn-sprites — X1, dead last, not needed until year two

Nothing here is required to build the game. Inventory measured 2026-09-05: **6
sets, all covering dex 0001–0151** with matching `back/`; filenames `%04d.png`
(`0019.png` = Rattata):

```
pokemonGen1/Gen1/  red-blue | red-green | yellow    fronts 40×40, backs 32×32
pokemonGen2/Gen2/  gold | silver | crystal          fronts 40×40, backs 48×48 ⚠
```

Unused: Gen 2 dex 0152–0251, all `shiny/`, `crystal/animated/` (252 GIFs — O-2).
Detail + integration traps in `ARCHITECTURE.md` → *The sprite randomizer*.

### Upstream's non-vanilla additions — decide in J2

Upstream adds things the cartridge doesn't have: the "Click to start" splash
(needed — browsers block audio until a click), a **"Skip intro?"** yes/no after
NEW GAME (`menus/main_menu.ts`), the FPS toast and `-`/`+` keys, the `p` pause,
the backtick debug overlay, and mobile touch controls. They're useful during
development; whether each survives into the finished 1:1 game is a J2 audit
question for the user. Don't remove them earlier, don't add more.

### Save origins

`http://127.0.0.1:5173/` and `http://localhost:5173/` do **not** share
`localStorage`. Use **127.0.0.1**.

---

## Session log

Newest first. Keep ~8–10 entries; move older ones to `HISTORY.md`.

### 2026-09-22 (setup, lost-work discovery, plan, docs reset) — Claude Opus 5.5

No slice claimed; setup + planning. No engine code changed.

- **Git:** `git init` at the root (branch `master`). User rule: **local-only,
  never pushed** (Hard rule #9, DECISIONS #24).
- **Ignore rules:** the user's concern was keeping the ROM out of git. After a
  brief detour through a root `rom/` folder, the ROM stays at
  `game/pokeyellow.gbc`, covered by `*.gbc`; `game/` tracked; `pkmn-sprites/`
  ignored (DECISIONS #25).
- **Setup:** `./pull-refs.sh` (5 refs); copied upstream into `game/`;
  `npm install`; `npm run setup` (156 files); typecheck clean; **375/375**.
- **Finding:** `game/` is vanilla upstream — the July–August modified copy is gone
  and the user confirmed **no copy exists anywhere**. Audited upstream (table
  above): 12 maps, ROM gate present, PSYCHIC bug present, 10 SFX, item balls and
  trainer-sight data missing, whiteout and badge boosts already done.
- **Plan approved by the user:** R1 split into R1a/R1b/R1c; new **Phase V**
  (V1–V5) rebuilds the lost work before Phase A; Phase A re-scoped to what
  upstream actually lacks. DECISIONS #26.
- **Upstream `game/CLAUDE.md`** transcribed into root `CLAUDE.md` → *Engine
  reference*, then deleted (user request).
- **Commits (local):** `9bf2d7d` baseline (docs + vanilla upstream), then the docs
  reset. User authorized a local commit at the end of every slice.
- **Docs reset:** every context file brought in line with the verified state —
  stale "30 maps / 395 tests / gate deleted / PSYCHIC fixed" claims fixed or
  marked *lost*; Phase V added to `PLAN.md`; prior-work table moved to
  `HISTORY.md`.

- **R1a probe + plan:** ran `extractRom()` under Node from the scratchpad. It works
  with a tiny `ImageData` stand-in; JSON is byte-identical to `data/`; 518 images
  + 3 tilemaps. Cross-checked against pret: 125 identical, 75 taller-but-identical,
  15 differ only past the real tile data (overworld sheets read 16× too much;
  tilesets read past their end); no render impact. Written up with the plan in
  `notes/r1a-graphics-export.md`.

- **R1a done** (user asked for R1a + R1b this session, incl. optional a/b):
  `src/rom/node_image_data.ts` + `src/rom/static_export.ts` + 6 tests; setup
  writes `static/`; `game/.gitignore` ignores `static/` until R1c; `tsconfig`
  covers `scripts/`; Pikachu pixel test path fixed. 381/381. Results in
  `notes/r1a-graphics-export.md`.

- **R1b done:** `vite.config.ts` (`publicDir: 'static'`, `base: '/'`,
  `appType: 'mpa'`), ROM gate block deleted from `main.ts` `init()`, title PKMN.
  Typecheck clean, 381/381, `npm run build` OK with 0 gate strings in the bundle
  and all 518 PNG / 156 JSON / 3 tilemaps in `dist/`. In Chrome: boots straight to
  "Click to start", no upload overlay, title PKMN. The **user played it** and
  confirmed no ROM is used. I didn't finish my own pixel-digest / playthrough
  check (the user took over testing). Save → CONTINUE not re-tested → R1c note.
- **User request mid-R1b — keep running when unfocused** (DECISIONS #27): tabbing
  away froze game + music (rAF stops in hidden tabs). `runDueTicks()` +
  `startBackgroundTicker()` (inline worker, 8 ms, only while rAF is idle >100 ms)
  in `main.ts`; `input.ts` releases held keys on `blur`. **User-verified.**

**Next:** R1c (commit the data + fresh-clone proof).

### 2026-09-05 (context refactor) — Claude Opus 5

Flattened the two-level context system to one level at the user's request. The
nested `context/agent/` pack (00–06) is gone; its content merged into the
top-level files, and root `CLAUDE.md` is now the single entry point that carries
the reading order.

- `agent/01-progress-tracker.md` → **`STATUS.md`** (this file)
- `agent/02-project-overview.md` → merged into `PROJECT.md`
- `agent/03-architecture.md` + `agent/06-ui-context.md` → merged into `ARCHITECTURE.md`
- `agent/04-code-standards.md` + `agent/05-ai-workflow-rules.md` → merged into `CONVENTIONS.md`
- `agent/00-readme.md` → dissolved into root `CLAUDE.md`
- `PROGRESS.md` → **`HISTORY.md`** (kills the PROGRESS vs progress-tracker name clash)
- `README.md` (third-party article) → `_reference-article.md`, parked
- DECISIONS #19 added; all cross-references updated.

**Then, same session — workspace layout adopted (DECISIONS #20).** Reference
repos move into a gitignored `refs/`, refreshed by `pull-refs.sh` on pinned
branches. Renames: `pokemon-yellow-typescript-main/` → `game/`,
`pokeyellow-master/` → `refs/pokeyellow/`, plus new `notes/`. Created
`pull-refs.sh`, `.gitignore`, and `README.md` with setup + credits.

**The user stated the project vision (DECISIONS #21–#23):** a local-only **1:1
replica of vanilla Yellow** on `gididaf/pokemon-yellow-typescript`, with one
eventual deviation — battle sprites randomized **per encounter** from 6 sets
(#22 supersedes "seeded per save"; #23 admits Gen 2 *art*, not content).
**Clarified 2026-09-06:** the randomizer is a year-two idea, not core. Plan
reframed as milestones; expect **1–2 years, ~700–800 sessions**.

**ROM-free promoted to Hard rule #1 / Invariant #1 (2026-09-06).** The ROM dump
was placed at `game/pokeyellow.gbc` and SHA1-verified against DECISIONS #14.

### 2026-08-04 (commit-data pivot + plan restructure) — Claude Opus 4.6

User requested zero ROM dependency in the final product. Clarified approach: ROM
is available during development for extraction; the extracted output (JSON +
PNG) gets committed. Restructured the plan from 90 slices to **29** (R1–X2).
DECISIONS #18. No production code changed. *(The code state this session
described was later lost — see 2026-09-22.)*

_Older entries (2026-07-27 → 2026-08-02) are archived in `HISTORY.md`._
