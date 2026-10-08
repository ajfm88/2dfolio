# pkmn — Pokemon Yellow in the browser, no ROM in the final product

A local-only, **1:1 replica of vanilla Pokemon Yellow** in browser TypeScript,
built on `gididaf/pokemon-yellow-typescript` (copied into `game/`). Personal
hobby project, never distributed.

**We are porting, not designing.** Nothing about the game changes — no
rebalancing, no improvements, no added content; Gen 1 bugs are reproduced
deliberately. The repos in `refs/` are how we get it right.

**Sprites: vanilla Yellow, extracted from the ROM.** That is the baseline and it
already works — `/gfx/sprites/front/<dex>.png` (decoded in the browser today,
committed PNGs after Phase R). Build the whole game on those.

Game data is extracted from the user's own cartridge dump during development,
then committed to the repo so the final product needs no ROM at all.

**Scale:** ~1–2 years, on the order of **700–800 sessions**. The 36 milestones in
`context/PLAN.md` are not sittings — split them freely, log every session.
Nobody is expecting a Yellow port in two weeks.

> A per-encounter sprite randomizer (`pkmn-sprites/`) is the one deviation from
> vanilla we eventually want — but it is **Phase X1, dead last**, after the game
> is beatable and audited. Realistically year two. Don't design around it, don't
> start it, don't let it shape engine work. DECISIONS #21–#23 have the detail for
> when that day comes.

**This file is the entry point.** Everything else lives in `context/` — seven
flat files, no nesting.

## ⚠ The one rule: `context/STATUS.md`

That file is **the live handoff log** — current phase, the ordered queue of work
slices, open questions, and the session log. This project is built a little at a
time by whichever agent is available (Claude, Grok, GPT), so:

- **Read it first, every session.** It tells you what actually happened last time.
- **Claim one slice** from its _Next up_ table. One slice per session — don't batch.
- **Update it, then commit locally, before you stop.** An unlogged session is a
  lost session: the next agent restarts from zero and the user pays twice for the
  same work. Every finished slice ends in a local commit (never pushed) —
  `CONVENTIONS.md` → *The session contract*, step 6.

## The context system — `context/`

Read in this order. Skim what your slice needs; don't re-explore what
`ARCHITECTURE.md` already answers — that research is already paid for.

| File | Role | When |
|---|---|---|
| **`STATUS.md`** | ⚠ live handoff log: phase, queue, open questions, session log | **always, first** |
| `PROJECT.md` | what we're building and why; goals, non-goals, success criteria | new to the project |
| `ARCHITECTURE.md` | data pipeline, the data contract, invariants, verified format findings, Game Boy rendering + asset rules; the **engine reference** (module map, state machine, data conventions, extraction system) | before touching data, assets, rendering or engine code |
| `PLAN.md` | the phased roadmap — 36 milestones (R1, V1–V5, A1–A6, B1–X2; R1 ran as slices R1a–c, V1 runs as V1a–e) | when picking or sizing work |
| `CONVENTIONS.md` | session contract (incl. the per-slice local commit), code standards, naming traps, verification workflow, the test suite | before writing code |
| `DECISIONS.md` | settled choices and rationale (#1–#43), plus open questions that need the user | before proposing a change to a settled choice |
| `HISTORY.md` | archived session entries + the table of lost prior work | rarely — background only |

`context/_reference-article.md` is a third-party article (JavaScript Mastery's
context-engineering playbook) that the original template came from — human
background reading. **Agents: skip it.**

For engine internals, read **_Engine reference_** at the bottom of this file before
touching engine code. It holds the house rule and a table of where each topic lives:
`context/ARCHITECTURE.md` and the per-subsystem
`game/src/{audio,battle,menus,overworld,pikachu,renderer,story,text}/ARCHITECTURE.md`.

## Workspace layout

This root is the git repo. `refs/` holds read-only clones of the spec repos and
is **gitignored** — it is never committed, never edited, never pushed to.

```
pkmn/                    ← the git repo
  README.md              what this is + credits to our sources
  CLAUDE.md              you are here — the entry point
  context/               the 7 context files (see above)
  notes/                 our spec notes, numbered oldest first: NN-<slice>-<kind>.md
  game/                  our copy of gididaf/pokemon-yellow-typescript — the thing we change
    pokeyellow.gbc       the ROM — GITIGNORED (*.gbc), development-time extraction only
  pkmn-sprites/          GITIGNORED — user-curated randomizer art (ours)
  refs/                  GITIGNORED clones of the reference repos
    pokeyellow/  gen1recomp/  oldamber/  engine/  dmg/
  pull-refs.sh           refresh every clone in refs/ on its correct branch
  .gitignore
```

`game/` is a **copy, not a remote.** We cannot push back upstream, so the files
were copied into this repo and we own them from here.

## Reference repos — `refs/` (read-only, gitignored)

Consult these; never edit them, never commit them. Each is pinned to a specific
branch — **do not use `origin/master` blindly**, most of these don't develop there.

| Dir | Repo | Branch | Consult it for |
| --- | --- | --- | --- |
| `refs/pokeyellow/` | [pret/pokeyellow](https://github.com/pret/pokeyellow) | `master` | The cartridge itself — the disassembly. Ground truth for maps, text, data layout, engine behavior |
| `refs/gen1recomp/` | [bryanthaboi/gen1recomp](https://github.com/bryanthaboi/gen1recomp) | **`dev`** | Lua full-game recomp + `gen1_faithful` — a working end-to-end implementation to compare against |
| `refs/oldamber/` | [spiritsnails/oldamber](https://github.com/spiritsnails/oldamber) | `main` | C implementation of full Red/Blue — reach for it when implementing past Viridian |
| `refs/engine/` | [pkmn/engine](https://github.com/pkmn/engine) | `main` | **Battle oracle.** Best Gen 1 battle sim for cartridge + Showdown fidelity. Don't reinvent 1/256 crits or the wrap/counter/psywave mess from memory |
| `refs/dmg/` | [pkmn/dmg](https://github.com/pkmn/dmg) | `main` | One-move damage math — settle a single calculation |

Refresh them all with `./pull-refs.sh` (fetch + checkout + ff-only pull, and it
clones anything missing). First-time setup is in `README.md`.

## Hard rules

1. **The game must run with no ROM. Ever.** This is a full TypeScript
   implementation of Pokemon Yellow — **not an emulator**, and not a wrapper that
   loads a ROM. `pokeyellow.gbc` exists for one purpose: development-time
   reference and asset/data extraction. It is never read at runtime, never
   shipped, never required to play. Everything the game needs is committed static
   JSON + PNG. Upstream shipped a ROM upload gate in `main.ts` `init()`; it was
   removed in R1b (2026-09-22) and must never come back — no ROM-loading, upload, or
   emulation path, ever. DECISIONS #2, #14, #18.
2. **Never write into `refs/**`** — read-only clones. Never edit, never commit,
   never push. If a ref needs updating, run `./pull-refs.sh`.
3. Never modify `pkmn-sprites/` — it is the user's curated source data.
4. Generated JSON must match the existing extractor schemas exactly.
   `src/rom/extractors/*.ts` is the authoritative contract; consumers in
   `src/battle/data.ts` and the tests prove it.
5. **ASM fidelity.** Read the relevant `refs/pokeyellow/` ASM *before* writing
   engine code, and match it exactly — see *Engine reference → Fidelity rules*.
6. Leave `src/rom/` in place — it is the extraction system and schema authority.
7. Gen 1 bugs are features. Do not fix them.
8. Update `context/STATUS.md` before ending a session. Not optional.
9. **This repo is local-only. Never push it anywhere.** No `git remote add`, no
   `git push`, no GitHub/GitLab repo, no `gh repo create`, no uploading the code
   to any service. Commits stay on this machine. DECISIONS #24.

## Commands

Refresh the reference clones from the root: `./pull-refs.sh`

Everything else runs inside `game/`:

- `npm install` — first time only
- `npm run typecheck` — strict tsc (`noUnusedLocals`, `noUnusedParameters`) over
  `src/` and `scripts/`, must stay clean
- `npm run setup pokeyellow.gbc` — extract from the ROM (development): JSON →
  `data/`, then rebuild `static/` (520 PNGs + 3 tilemaps + a JSON mirror). ~1.5 s
- `npm test` — vitest (needs `data/`; the suite exits if it is missing). Without
  `ROM_PATH` the 92 ROM tests skip
- `npm run test:watch` — vitest in watch mode
- `ROM_PATH=pokeyellow.gbc npm test` — full suite incl. extraction + static-export
  tests. **Baseline 2026-10-07 (A5b1 review fix): 970/970.**
- `npx vite --host 127.0.0.1 --port 5173 --strictPort` — dev server serving `static/`
  (no ROM involved). Plain `npx vite` binds IPv6 `::1` on this machine, so
  `127.0.0.1` won't connect; saves live on `http://127.0.0.1:5173/` (origin-scoped). Missing files are real 404s
  (`appType: 'mpa'`)
- `npm run build` — typecheck + production bundle in `dist/` (includes `static/`)

Lost with the old copy (rebuild only if needed): `scripts/_extract_maps_only.ts`,
`scripts/smoke_p5_3.mjs`.

## Where things stand

**2026-10-06:** milestones **R1, V1, A6 and A1 are done**: A1 covers the item jingles and the music engine (A1a),
item balls, hidden items and the inventory rules (A1b), and trainer sight (A1c), all
user-verified. The game runs with no ROM, from committed `data/` + `static/` (Phase R).
It has 19 maps, upstream's 12 plus Route 2 and Viridian Forest (V1). It ticks at the
Game Boy's 59.7275 Hz, and the overworld moves on the ASM's 2-frame pass (DECISIONS #33,
#36). **970/970** tests; no-ROM 878 pass, 92 skip; typecheck/build clean.
A5 is under way: A5a (the text printer) is done and user-verified. A5b (script and menu texts)
runs as seven increments (DECISIONS #45); A5b1 (text programs, data only) is done and
signed off by Sol. Next: A5b2 (sprite sets), A5b3–A5b7, then A5c–A5f, V2.

⚠ The earlier sessions' modified copy (30 maps) was **lost** (DECISIONS #26). Phase V
rebuilds it.

The slice-by-slice detail is in `context/STATUS.md` (live) and `PROJECT.md` → *State*.
**Keep this section this short.** A finished milestone changes a line here; a slice
changes STATUS.md. Claude Code loads this file into every session and warns past 40k
characters (DECISIONS #42).

Git: local repo, commit per slice, never pushed.

**Generated data is committed but never hand-edited.** To change it: edit the
extractor → `npm run setup pokeyellow.gbc` → commit the regenerated `data/` +
`static/` with the code. `static_export.test.ts` fails if you forget the re-run.

---

## Engine reference

Read this before touching engine code: the house rule below, then the doc for your
subsystem. The rest of the engine reference moved out of this file on 2026-10-06
(DECISIONS #42):

| Topic | Where it lives |
|---|---|
| Module map; game state machine, game loop and overworld pass; data conventions; ROM extraction system | `context/ARCHITECTURE.md` → *Engine reference* |
| Rendering, palettes, coordinates, asset rules | `context/ARCHITECTURE.md` → *Rendering & asset conventions* |
| Overworld movement pitfalls, the pass, NPCs, maps | `game/src/overworld/ARCHITECTURE.md` |
| Audio: the engine files, the interpreter's rules, SFX over music, known departures | `game/src/audio/ARCHITECTURE.md` |
| Battle mechanics, trainer battles, the catch demo | `game/src/battle/ARCHITECTURE.md` |
| Pikachu: happiness tables (implemented and not yet), follower, scripted movement | `game/src/pikachu/ARCHITECTURE.md` |
| Menus, renderer, story scripts, text | `game/src/{menus,renderer,story,text}/ARCHITECTURE.md` |
| The test suite, file by file | `context/CONVENTIONS.md` → *The test suite* |

### Fidelity rules — the engine's house rule

A pixel-perfect, logic-exact port. Every implementation must:

1. **Read the relevant ASM first** — never assume how something looks, works or
   what text it shows.
2. **Match the original exactly** — no invented UI, no added text, no modified
   layouts, no "improvements".
3. **Preserve all Gen 1 bugs and quirks.**
4. **Verify coordinates, dimensions, text and flow** against the ASM before
   writing TypeScript.
5. **Never add content that isn't in the original** — no extra labels, helper
   text or UI enhancements.

Where to look in `refs/pokeyellow/`: `engine/` logic · `data/text/text_*.asm`
strings · `gfx/` sprites/tiles (`gfx/pokemon/front/*.png` to debug sprites) ·
`data/maps/headers/*.asm` + `data/maps/objects/*.asm` for new maps ·
`constants/` constants.
