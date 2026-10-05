# CONVENTIONS — how to work on this project

Applies to every agent — Claude, Grok, GPT, whoever is next. This project is
built in **small paid increments across many sessions by different agents**. The
rules below exist so a session is never wasted re-deriving what the last one
already knew.

## The session contract

1. **Read `STATUS.md` first.** It is the live handoff log: current phase, the
   ordered queue, open questions, session history. Skim `PLAN.md` to see where
   your slice sits in the roadmap.
2. **Claim one slice** from the *Next Up — Queue* table in `STATUS.md`. Note it
   under *In progress* with your model name and the date.
3. **Do that slice and only that slice.** Do not opportunistically start the next
   one because you have room left. One slice per session — don't batch.
4. **Verify** (see below).
5. **Update `STATUS.md`**: move the slice to *Completed* with a one-line result
   and the commit hash, refresh *Next up*, and add a *Session log* entry saying
   exactly where you stopped and what the next agent should do.
6. **Commit locally — last step, every slice** (user standing instruction,
   2026-09-22; DECISIONS #26). From the root: check `git status` (the ROM must
   never appear), `git add` the slice's files including `STATUS.md`, commit with a
   message naming the slice and ending with the co-author line. **Never push** —
   no remote exists and none may be added (Hard rule #9). If a slice is split
   mid-way, commit what is verified and say so in the log.

An unlogged session is a lost session. Treat the log and the commit as part of
the slice, not as optional paperwork. (The July–August code was never committed
to this repo, and none of it survived — DECISIONS #26.)

## Approach

Spec-driven, not improvised. The context files define what to build and the
extractor interfaces define the exact output shape. Implement against those
specs — do not infer behavior from memory of how Pokemon games work, and do not
guess a JSON shape. Open the extractor.

- The schema is the spec. Before adding data or maps, open the matching
  `src/rom/extractors/<name>.ts` and its consumer, and match the shape exactly.
  Do not invent fields, rename keys, or "improve" the format.
- Fix root causes. If extracted data does not load, the extractor or the engine
  wiring is wrong — do not work around it.
- Small, verifiable steps. Extract one JSON file, eyeball a hard entry, move on.

## Scoping rules

- One unit of work per session. `PLAN.md` slices are milestones — split them
  (`V1a`, `V1b`…) whenever one won't fit a sitting.
- Prefer small verifiable increments to large speculative ones.
- Do not mix an extractor change with an engine change in the same step.
- If a change cannot be verified end to end quickly, the scope is too broad — split it.

**Split a slice if it combines:** more than two unrelated output files;
extraction work *and* engine wiring; or anything not clearly specified in the
context files. Split with a letter suffix (`D4a`, `D4b`), log the split in
`STATUS.md`, and note it in `DECISIONS.md`.

## Handling missing requirements

- Do not invent game behavior, text, or data shapes. The disassembly is the source
  of truth; the extractors are the schema of truth.
- **Which reference to consult** (all in `refs/`, see `ARCHITECTURE.md` for the
  full table): `pokeyellow/` for anything cartridge-shaped — maps, text, data
  layout, engine behavior. `engine/` for battle mechanics, `dmg/` for a single
  damage calculation. `gen1recomp/` (branch `dev`) and `oldamber/` when you want to
  see a complete working implementation of something we haven't built yet.
  Where they disagree, **`pokeyellow/` wins** — it is the cartridge; the rest are
  implementations of it.
- If a requirement is ambiguous, resolve it in the relevant context file *before*
  implementing, so the resolution survives the session.
- If something is genuinely undecided, add it to *Open questions* in `STATUS.md`
  and work around it. Do not silently pick and move on.
- Record decisions in `DECISIONS.md`, numbered and dated. Do not relitigate an
  existing entry without new evidence — but *do* say so loudly when you find some.

## Protected files

**Never modify:**

- `refs/**` — read-only clones of the five reference repos. Gitignored by design.
  Never edit, never commit, never push. To update one, run `./pull-refs.sh` from
  the root; it checks out each repo's **pinned branch** (`pokeyellow` → `master`,
  `gen1recomp` → **`dev`**, `oldamber`/`engine`/`dmg` → `main`). Never assume
  `origin/master`.
- `pkmn-sprites/**` — the user's curated source art.

**Free to write:** `notes/` — our own spec notes, comparisons and probe results.
Put anything you learn from `refs/` here rather than in the clone.

**Touch carefully (with a claimed slice + tests):**

- `src/rom/**` — schema authority **and** extraction code. Prefer additive changes
  (e.g. adding maps to `EXTRACTABLE_MAPS`); do not delete or restructure.
- Engine `src/**` — allowed when the slice requires it (item pickup, trainer
  sight, gym rewards, etc.). Prefer minimal surface area; record a DECISIONS entry
  if the change is architectural.

## TypeScript

- Strict mode, with `noUnusedLocals` and `noUnusedParameters`. `npm run typecheck`
  must be clean before you stop working — no exceptions.
- No `any` in committed code. Model data with explicit interfaces.
- Pixel-perfect ASM fidelity is the house rule of the engine — read root
  `CLAUDE.md` → *Engine reference* before touching anything in `src/`.
  **Gen 1 bugs are features; do not fix them.**

## Schema fidelity

- `src/rom/extractors/*.ts` interfaces are the contract. All game data must match
  these shapes exactly (key names, array-index-0-null patterns, string constant
  styles). When in doubt, read the extractor and its consumers
  (`src/battle/data.ts`, `src/rom/__tests__/extraction.test.ts`), not memory.
- Extractors are idempotent: running twice produces identical bytes. Write output
  with `JSON.stringify(data, null, 2) + '\n'`.
- One documented exception exists: the PSYCHIC type chart (DECISIONS #10).
  Deviations require a DECISIONS entry — never an undocumented judgment call.

## Map expansion workflow

Adding new maps (Phases V, B–I) follows this pattern:

1. Add the map to `EXTRACTABLE_MAPS` + `MAP_METADATA` in
   `src/rom/extractors/maps.ts` and `MAP_TEXT_PTRS` in `src/rom/rom_offsets.ts`
   (`MAP_METADATA` holds hand-curated NPC ids and ordering — DECISIONS #13).
2. Re-run `npm run setup pokeyellow.gbc` (rewrites `data/` and `static/`).
3. Engine side: `MAP_MUSIC` (from `data/maps/songs.asm`) and, for outdoor maps,
   `OUTDOOR_MAPS` in `main.ts`; a debug warp in `debug.ts` `WARP_DESTINATIONS`;
   connections, scripts and events per the ASM.
4. Verify: typecheck + tests + play-test.
5. Commit the extracted output together with the code that uses it.

Two things learned planning V1 (`notes/v1-plan.md`):

- **Offsets come from pret's sym file**, which is already fetched in the clone:
  `git -C refs/pokeyellow show origin/symbols:pokeyellow.sym > <scratchpad>/pokeyellow.sym`.
  `git show` doesn't write to `refs/`. It matches our ROM (checked against the
  offsets upstream already hardcodes).
- **Never trust the NPC-text fallback for `text_asm` handlers.** `readMapText()`
  grabs the first `text_far` within 80 bytes, which for V1 gave the wrong line to
  all five Forest trainers and to Oak's Aide. Check every NPC's text against the ASM;
  read trainer texts from the trainer header (`text_asm; ld hl, <header>`).

## Naming traps (learned the hard way — trust these)

- **PSYCHIC family**: species types use `PSYCHIC` (`pokemon.ts` converts); move
  `type` fields use `PSYCHIC_TYPE`; the *move* named Psychic is keyed `PSYCHIC_M`
  in `moves.json`. The type chart **today** has `PSYCHIC_TYPE` on both sides (the
  bug in DECISIONS #10); after V5 it uses `PSYCHIC_TYPE` for attackers and
  `PSYCHIC` for defenders.
- **Species specials** (ASM filename → display name): `nidoranm`→`Nidoran-M`,
  `nidoranf`→`Nidoran-F`, `mrmime`→`Mr. Mime`, `farfetchd`→`Farfetch'd`. gfx
  filenames differ again: `nidoranm.png`, `mr.mime.png`, `farfetchd.png`.
- **Back sprite files** in pret carry a `b` suffix: `bulbasaurb.png`, `pikachub.png`.
- **Pokemon sprite paths use dex numbers** (`/gfx/sprites/front/25.png`), never
  species names.
- **Accuracy**: ASM `move` macro takes percent directly (`100`), ROM stores ×255/100
  — the ROM extractors handle this conversion.
- **Trainer parties**: default format `db level, MON, MON, 0`; leading `$FF`
  switches to `db $FF, lvl, MON, lvl, MON, ..., 0` (rivals/leaders). Classes that
  share a data pointer with a later class have zero parties.
- **Tileset PNG width is load-bearing**: `drawTile()` derives tiles-per-row from
  image width. 128 px = 16 tiles. Change the width and every map silently scrambles.
- **Tileset ids share files**: MART→`pokecenter`, DOJO→`gym`, MUSEUM→`gate`,
  REDS_HOUSE_1/2→`reds_house`. Mappings are in `src/overworld/map.ts`.
- **An item flag doesn't make an item ball.** Yellow's Blue's house Daisy and Town
  Map objects end in a stray `, 0` (`objects/BluesHouse.asm`), so they are
  item-flagged with item 0. An item ball is an item-flagged object whose
  TextPointers entry is `PickUpItemText` (00:23ef). V1a nearly blanked Daisy's text
  over this; the regenerated-data diff caught it.
- **Diff the regenerated data after any extractor change** (`git diff --stat --
  game/data`). The tests compare the extractor with `data/`, which setup just
  rewrote, so only the diff shows an unintended change to an existing map.
- **pret text tokens are already engine tokens**: `<PLAYER>`, `<RIVAL>` appear
  literally in the ASM source, and `#` means `POKé`. Don't invent a substitution layer.
- Evolution targets in ASM are plain tokens; nothing evolves into a special-named
  species, so simple TitleCase suffices there.

## File organization

- `scripts/extract_dev_data.ts` — the setup runner (`npm run setup pokeyellow.gbc`).
  Upstream's only script. (The lost copy also had `_extract_maps_only.ts`,
  `smoke_p5_3.mjs` and parked ASM generators in `scripts/gen/` — none exist now.)
- `data/` — extracted JSON output (committed; regenerate, never hand-edit).
- `static/` — Vite `publicDir` for the browser (JSON mirror + gfx; committed;
  regenerate, never hand-edit).
- `pokeyellow.gbc` — ROM, gitignored (`*.gbc`), development only.
- Scratch files, experiments, one-off probes — session scratchpad, never the repos.
- `pkmn/` root is the git repo (branch `master`, local-only). Commit at the end of
  every slice (session contract step 6); never push.

## Verification (before you call a slice done)

1. `npm run typecheck` — must be clean.
2. `ROM_PATH=pokeyellow.gbc npm test` — **baseline 409/409** as of 2026-09-22
   (V1b). Anything less is a regression; new tests raise the
   baseline — record the new number in `STATUS.md`. If the *whole* suite dies at
   once, `data/` is missing: run `npm run setup pokeyellow.gbc`.
3. For anything visible: `npx vite` at **`http://127.0.0.1:5173/`** (the save
   origin) and play the path the slice touches. Today that is Pallet → Viridian
   (north is blocked by the demo gate until V1). Debug overlay: backtick key, with
   warps to every extracted map — add one for each new map.
4. Spot-check hard entries when comparing generated JSON against expectations —
   Nidoran-F, Farfetch'd, Eevee's three item evolutions, Kadabra's trade
   evolution, a `$FF`-format trainer party — not just Bulbasaur.
5. No invariant in `ARCHITECTURE.md` was violated.
6. `STATUS.md` reflects reality — completed, next up, open questions, session log.
7. Committed locally; `git status` clean apart from ignored files; nothing pushed.

## Working with the user

- Hobby project, never distributed. No polish pressure, no deadline.
- The user is **credits-conscious** and works in short bursts. Prefer targeted
  reads over broad re-exploration — the expensive research is already distilled
  into `ARCHITECTURE.md`. Do not re-run exploration agents for what it already
  answers.
- They write casually and with typos. Read for intent.
- The ROM is available during development (`game/pokeyellow.gbc`). Use it freely for
  extraction. The final product must not require it.
- Prefer `http://127.0.0.1:5173/` when discussing saves.
- **Plan first.** Before implementing a slice, the user wants a plan (asked for it
  twice on 2026-09-22). Probe the unknowns, write the plan (a `notes/` file when
  it's substantial), present it, and wait for the go-ahead.
- **The user play-tests.** When they say they're testing in the browser, stop
  driving it: hand over the URL, controls and what to check, and let them report.
  Their "it works" is part of verification — log it as user-verified.
- **Local only, commit every slice** (Hard rule #9; session contract step 6).
  Stage specific paths — never sweep in changes you didn't make without asking.

## Tooling traps (this machine: Windows, Git Bash + PowerShell)

- **Never put backtick-laden text in a double-quoted shell string** (e.g.
  `node -e "…"`): bash runs every `` `…` `` span as a command. To write Markdown,
  use the Write/Edit tools, or a quoted heredoc (`node - <<'EOF'`).
- Git Bash `grep` with a literal CR pattern gives false positives — count CR bytes
  with `tr -cd '\r' < f | wc -c` or Node.
- Node ESM `import()` needs `file://` URLs for absolute Windows paths
  (`pathToFileURL`).
- Browser automation: hold synthetic keys ~100 ms — the engine polls key state
  once per tick, so shorter taps are lost.
- Vite's dev watcher can crash on a locked file appearing in `game/` (EBUSY) —
  just restart `npx vite`.
