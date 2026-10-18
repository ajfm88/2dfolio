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
   **Don't grow root `CLAUDE.md`** (DECISIONS #42). Claude Code loads it into every
   session and warns past 40k characters. A slice changes it only for the test
   baseline, plus a milestone's line in *Where things stand* when one finishes. Put the
   detail where it belongs: the result in STATUS.md, engine facts in `ARCHITECTURE.md`
   or the subsystem's `ARCHITECTURE.md`, and new tests in *The test suite* below.
6. **Commit locally — last step, every slice** (user standing instruction,
   2026-09-22; DECISIONS #26). From the root: check `git status` (the ROM must
   never appear), `git add` the slice's files including `STATUS.md`, commit with a
   message naming the slice and ending with the co-author line. **Never push** —
   no remote exists and none may be added (Hard rule #9). If a slice is split
   mid-way, commit what is verified and say so in the log.

**Keep STATUS.md short (DECISIONS #61).** Log a session in a few lines; put the detail in the slice's `notes/`
file. If STATUS.md passes ~40 KB, move the oldest session entries verbatim to `HISTORY.md` → *Recent session
archive* in a docs-only commit. Findings for later slices go in `notes/57-findings-backlog.md`.

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

**Free to write:** `notes/` — our own spec notes, comparisons and probe results. **Name each new file with the next sequence number**, oldest first: `NN-<slice>-<kind>.md` (`18-a1b-plan.md`, then `19-a1b-review.md`). Never renumber an existing file.
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
   If the map is OVERWORLD with ledges, check its triggers and trainer lines against a
   hop's midpoint: `RunMapScript` there isn't built yet (`notes/20-a1c-plan.md` §1.8;
   `trainer_tripwires.test.ts` fails for a sight trainer on an OVERWORLD map).
5. Commit the extracted output together with the code that uses it.

Two things learned planning V1 (`notes/02-v1-plan.md`):

- **Offsets come from pret's sym file**, which is already fetched in the clone:
  `git -C refs/pokeyellow show origin/symbols:pokeyellow.sym > <scratchpad>/pokeyellow.sym`.
  `git show` doesn't write to `refs/`. It matches our ROM (checked against the
  offsets upstream already hardcodes).
- **Never find a ROM address by searching for its bytes.** Identical data repeats across
  maps (A6e: Viridian's Pikachu program also appears at 3c:5e2b, while the game reads
  3c:5a0a). Take the label from the sym file, and when a routine loads it, confirm with
  its `ld hl, …` operand in the ROM.
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
- **Text widths count glyph tiles, not string characters.** The seven apostrophe
  contractions are single tiles. Map extraction preserves `<PROMPT>` and exceptional
  cursor controls; do not strip them in TextBox's DisplayTextID mode or add word wrap.
  A leading $00 in a map text is TX_START, not a glyph; unknown bytes inside strings throw.
- **Printer waits own Joypad reads.** Don't synchronize input globally during
  ProtectedDelay3, scroll delays or sound waits. A release/press entirely between
  reads produces no new edge. Retained script text still needs one BG transfer per frame.
- Evolution targets in ASM are plain tokens; nothing evolves into a special-named
  species, so simple TitleCase suffices there.
- **Species names come in two spellings.** `trainers.json` and `wild/*.json` use pret
  constants (`NIDORAN_F`, `MR_MIME`, `FARFETCHD`); `pokemon.json` uses display names
  (`Nidoran-F`, `Mr. Mime`, `Farfetch'd`). Always resolve through `getSpecies()`, which
  compares without case or punctuation since V1c. Before that, the Forest Lass's
  Nidoran hung the game and Route 22's wild Nidorans silently never appeared.
- **Trainer pics are keyed by class key, not display name** (`trainerPicName()` in
  `battle/trainer_flow.ts`): `BUG_CATCHER` → `bugcatcher.png`, while "BUG CATCHER" has
  no file. A failed pic load leaves `startTrainerBattle` stuck in `transition`
  forever — no error on screen, only in the console.

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
2. `ROM_PATH=pokeyellow.gbc npm test` — **baseline 1722/1722** as of 2026-10-16 (V2a CP3)
   (V2a CP2). Anything less is a regression; new tests raise the
   baseline — record the new number in `STATUS.md`. If the *whole* suite dies at
   once, `data/` is missing: run `npm run setup pokeyellow.gbc`.
3. For anything visible: `npx vite --host 127.0.0.1 --port 5173 --strictPort` at **`http://127.0.0.1:5173/`** (the save
   origin) and play the path the slice touches. Today that is Pallet → Viridian →
   Route 2 → Viridian Forest (the north opens after the old man's demo, V1e). Debug
   overlay: backtick key, with warps to every extracted map — add one for each new
   map. When the user play-tests, remind them the A button is **Z** (X is B).
4. Spot-check hard entries when comparing generated JSON against expectations —
   Nidoran-F, Farfetch'd, Eevee's three item evolutions, Kadabra's trade
   evolution, a `$FF`-format trainer party — not just Bulbasaur.
5. No invariant in `ARCHITECTURE.md` was violated.
6. `STATUS.md` reflects reality — completed, next up, open questions, session log.
7. Committed locally; `git status` clean apart from ignored files; nothing pushed.

## The test suite

Moved here from root `CLAUDE.md` on 2026-10-06 (DECISIONS #42). A slice that adds tests
adds its bullet under *Added per slice* and updates the count; root `CLAUDE.md` gets only
the new baseline.

1722 tests in 96 files (vitest, `environment: 'node'`); without ROM, 1569 pass / 153 skip.

Healing-machine CP4 (2026-10-16, note 59 §15) re-ran typecheck, production build,
the full ROM suite and the no-ROM suite **twice each**: both ROM runs **1687/1687**,
both no-ROM runs **1550 pass / 137 skip**, both typechecks/builds clean. No timeout,
rerun or test edit was needed. Muted Chromium on spare port 5194 verified the actual
Viridian nurse with parties 1 and 6, screenshots through J+170 and audio-call traces;
normal RAF/audio-clock runs matched too. No runtime/test/data changes or shipped hooks.
The user separately play-tested the machine successfully; Claude checked CP4 and closed the slice (2026-10-16).

**A5b7g1 CP1 (tests only)** migrates the A6e nurse fixture to the real nurse YES
branch/hosted TextBox and program spy, preserving all movement, image, facing,
follow-buffer and rendering assertions. The A6d pushed hop now dispatches a real
display/program. `script/text_commands.test.ts` (7) uses displays for sound,
silent A/B waits, Hold/direct close, HideObject and end-of-script dismissal;
`text/textbox.test.ts` (31) uses standalone PrintText instead of legacy endings.
Their headers map nine removed test instances to existing source-path coverage.
Sixteen new cases: `main.test.ts` +6 (first SAVE-close picture, retained ITEM
scanout, each at three offsets), `menus/save_menu.test.ts` +4 (unmasked R2+10
sound delay, bottom-third message removal at three offsets), `menus/bills_pc.test.ts`
+3 (both submenu labels and the empty bottom box), `text/text_census.test.ts` +3
(reachable plain calls are text/FAR-only; awaitInteraction objects resolve;
approved getText consumers, AST-based and no ROM). Existing main YES tests also
assert final TextBox dismissal. All seven reviewer mutations caught and restored
byte-for-byte (notes 51 M2/M10 and 53 M1/V9/M6/V8/M5). Net **+7**; two fresh
ROM runs **1570/1570**, no-ROM **1440/130**, typecheck/diff clean. Note 54 §10.
CP2 retirement/F-1 and its verification are recorded in the following entry.

**A5b7g1 CP2** adds five source-path cases: `script/text_commands.test.ts` +2
(now 9), requiring `textButtonWait` to reject both a closed box and standalone
PrintText without reading input; `story/oaks_lab.test.ts` +3 (now 35), opening
both posters and e-mail through real hidden-event lookup during the starter await,
checking logical coverage, visible border/glyphs, dismissal and return to the same
await/ball interaction. Pickup text inspection drops its unreachable legacy
branch, the small-handler census retains its negative command assertion without
narrowing to a deleted union case, and TextBox fixtures use the default
DisplayTextID wrapper. All CP1 coverage remains. Three fresh ROM processes pass
**1575/1575**; three no-ROM processes pass **1445/130**; typecheck/build clean.
Ten temporary production mutations caught/restored (the seven CP1 reviewer
lines plus close beep, invalid non-display input fallback and F-1). Browser
results and final handoff: note 54 ?11. No extractor/generated-data change.

A5b7f2 CP5 adds 6 main SAVE integration cases: YES taps at three idle offsets,
actual localStorage save/reload, NO/B without writes and held-A release/direct
seven-frame close. All nine SAVE production mutations were caught/restored:
early/duplicate write, redisplay, right chooser, early question, short 128,
outer acknowledgement, ASCII colon, short final 30. Final ROM **1563/1563**,
no-ROM **1433/130**, build clean. Muted browser verified actual save sound,
YES/reload/title/CONTINUE at saved coordinates, NO and walking (note 52 §14).

A5b7f2 CP4 adds 10: `menus/save_menu.test.ts` (8, actual input/typed text,
opening/write anchors, info cells, no-save answers, all waits and held-A
release), left YES/NO placement and narrow-colon rendering. ROM **1557/1557**,
no-ROM **1427/130**. Shared chooser defaults remain unchanged.

A5b7f1 CP3 adds 31: `main.test.ts` (25, actual main dispatch and input,
three idle offsets on every return, close counts, sprites, WRAM resets,
legacy SAVE bridge), `menus/start_menu.test.ts` (+5 tail/transfer cases),
`menus/screen_tiles.test.ts` (+1 retained overlay scanout). Vitest alone
exposes main's lexical bindings and omits automatic startup; the production
entry has no test controls. Four production mutations caught and restored.
ROM **1547/1547**, no-ROM **1417/130**; muted browser passed (note 52 §12).

A5b7f1 CP2 adds 17: `menus/start_menu.test.ts` (15 real-input cases for
opening +20/+23, both layouts, idle taps, source wrap/Delay3, arrows/sound,
five-frame closes, raw saved row, Buffer2 and immediate redisplay) and
`menus/menu_input.test.ts` (+2 last-placed-row cases). Main integration and
browser verification remain CP3. ROM **1516/1516**, no-ROM **1386/130**.

**How it runs**

- **Setup** (`src/test/setup.ts`) stubs `fetch` to serve `data/*.json`, and calls
  `process.exit(1)` if `data/` is missing.

- **Helpers** (`src/test/helpers.ts`): `makePokemon(overrides?)`,
  `mockRandom(values[])`, `mockRandomFixed(value)`, `restoreRandom()`.

- **Battle messages** are `string[][]` — `result.messages[0][0]` or
  `result.messages[0].join(' ')`.

**By area**

- **Extraction** — 100 in `src/rom/__tests__/extraction.test.ts`; compares each
  extractor with the JSON in `data/`. Needs `ROM_PATH`, skipped otherwise.
  Its Pikachu and old-man pixel tests compare against pret's PNGs in
  `refs/pokeyellow/gfx/` and return early if `refs/` isn't cloned. The V1 block
  (added in V1a) checks the new maps against values transcribed from the ASM:
  trainer headers, NPC ids and facing parsed from `data/maps/objects/*.asm`,
  item balls, and the leaving-sign bug.

- **Static export** — 8 in `src/rom/__tests__/static_export.test.ts` (R1a, plus A5b2's
  explicit `map_sprite_sets.json` and StatusScreen CP2's `move_names.json` registration checks): key shape, the four grays,
  lossless PNG round-trip of all 521 images, extracted JSON
  == `data/`, and **`static/` not stale**. If that last one fails after an
  extractor edit, re-run `npm run setup pokeyellow.gbc`. Needs `ROM_PATH`.

- **Battle** — 373 tests across 13 files in `src/battle/`. `encounter.test.ts` adds the
  A6b encounter gates and indoor/FOREST/water rules. `catch_demo.test.ts` (V1d, 11)
  covers the catch demo: the outcome rule, back pics and names, the one-ball bag, the
  toss animations, and the step list with its ASM frame counts. `trainer_flow.test.ts` (V1c)
  covers the trainer rules as data: meet/victory music, end-text pages (every map
  trainer's first line fits), the pic scroll, the win/loss step lists, and that every
  trainer class resolves to an exported pic. `data.test.ts` checks every trainer-party
  and wild species resolves (V1c).

- **Walk pace** — 29 in `src/overworld/walk_pace.test.ts` (A6a + A6b): the pass clock and `Delay3`,
  frames per step for the player (16), a normal NPC (34), a fast NPC (18) and an NPC in
  step with the player, the turn rule, the `UpdateSprites` call points, the walk
  animation with the mirrored frame, the ledge hop's jump table, wanderers' rests, and
  Pikachu's happiness-dependent animation.

- **Tick clock** — 11 in `src/core/tick_clock.test.ts` (2026-09-25): the Game Boy rate
  held on 60/120/144/165 Hz displays and the background worker, the leftover time kept,
  the backlog dropped after a long gap, and the `-`/`+` stops.

- **Viridian City** — 21 in `src/story/viridian_city.test.ts` (V1e): the city's map
  script as data (which check fires per resting state, the Gym-door quirk, the badge
  rule), every command list (sleeping push, Gym push, forced demo, walk-aways, Pikachu
  stepping aside, repeat demo), old-save state derivation, and a guard that no "demo"
  text is back in `data/`.

- **Pikachu spawn** — 10 in `src/pikachu/pikachu_spawn.test.ts` (V1b): Yellow's
  spawn states per warp, and placement + facing per state.

**Added per slice (newest first)**

- **V2a CP2** adds 16 ROM extraction tests: five full-map comparisons and eleven source/structure,
  stock and malformed-payload checks. ROM **1703/1703**, no-ROM **1550 pass / 153 skip**, 95 files;
  typecheck/build clean. The user approved four omitted fixtures' new Pewter rows/counts and the
  generated map_sprite_sets additions; all existing assertions retained (note 60 §14). Setup twice:
  all 888 files identical, 872 prior files unchanged; no runtime wiring. Initial unchanged text-source
  timeout passed on unchanged rerun; final gates passed without a timeout. Stop for review before CP3.

- **Healing-machine CP3** adds 14: `overworld/healing_machine.test.ts` (9: every one/six-member render/call/return anchor, positions/flips, channel-driven wait, late/unready audio, zero-party guard, saved OBP1, awaited map art); `renderer/obj_palette.test.ts` (2: register mappings, real RGBA/cache/transparency); nurse +2 (same-tick update/heal/restart, no reads, one BG tick, retained OAM); bookshelf display +1 (real TV routing, note 56 N-2). The old A5b5c/A6e nurse assertions remain, on the real audio rig. The facade test now pins preloading/cached synchronous start. Eleven mutations caught/restored byte for byte. ROM **1687/1687**, no-ROM **1550/137**, typecheck/build clean; no timeout. No generated changes. Note 59 §14; browser remains CP4.

- **Healing-machine CP2** adds 17: `audio/fade_audio.test.ts` (12: fade steps, exact update-40 stop/restore, completion before SFX interpretation on all four channels, immediate/no-music/second stops, NR50 reads/reload/underflow, idle StatusScreen ownership, track latch, real gain write, machine SFX commands and update 11); `audio/index.test.ts` (1: public API, pre-unlock safety, real clock and synchronous preload); extraction +3 (header/pointer, source/data, bank-$1f equivalence); static export +1 (177 JSON and the SFX). Six mutations caught/restored byte for byte. Setup twice: all 878 outputs identical, all 876 prior files unchanged. ROM **1673/1673**, no-ROM **1536/137**, typecheck/build clean. One unchanged text-source comparison timed out on the first full ROM run, then passed on rerun; note 59 §13. Nurse wiring remains CP3.

- **StatusScreen CP5 (verification only)** adds no tests or runtime hooks. All four gates ran twice: ROM **1656/1656**, no-ROM **1523 pass / 133 skip** (91 files), clean typecheck and build. Fresh muted Chromium on **127.0.0.1:5193** exercised three party pictures (Pikachu 5×5, Ivysaur 6×6, Charizard 7×7), both Bill branches, both battle party modes, and Potion's result/return. Visual inspection of both pages and the contact sheet found no seams/clipping; independent full-PNG mirror/remap comparisons matched every pixel of the padded picture region on both pages. NR50 and native master-gain automation dip/restore were recorded without audible output. No page errors, failed assets or save writes. Source/data unchanged; evidence and fixture limits in note 58 §16.

- **StatusScreen CP4** adds 12: `menus/party_menu_opening.test.ts` (6: both hosts/prompts at all three BG phases), `menus/field_medicine.test.ts` +1 (exact result palette/PrintText/hold and return phases), `menus/field_medicine_input.test.ts` +1 (real no-effect prompt/return), `main.test.ts` +4 (START opening at three offsets and actual medicine white/reveal). The existing overworld STATS test also enforces Q+22 reveal / Q+25 read. Every prior medicine assertion is preserved, with +7/+3/+32 timing changes. Eleven temporary mutations caught/restored byte for byte; note 58 §15. ROM **1656/1656**, no-ROM **1523/133**, typecheck/build clean. CP5 browser verification remains pending.

- **StatusScreen CP3** adds a net 35: `menus/status_screen.test.ts` (30, replacing the two legacy stats tests), `menus/screen_tiles.test.ts` +1 (multi-byte numbers and shared PrintLevel), `main.test.ts` +3 (actual overworld/voluntary/forced battle dispatch), `story/pc.test.ts` +3 (actual host timing/ownership at three offsets). Both Bill STATS tests now require white through Q+6, Buffer1 at Q+3 and first read Q+9. Ten temporary production mutations caught and restored byte for byte; note 58 §14. ROM **1644/1644**, no-ROM **1511/133**, typecheck/build clean. CP4 and CP5 remain pending.

- **A5b7g2 CP2** adds 27: `story/bookshelf_display.test.ts` (25: plain predefs at +20, books/Diglett/statues at +23, closes, owned 1 vs 2 through the controller, facing-up one tile, Town Map, hidden-event priority, Lab free-move poster/e-mail/shelf) and `oaks_lab.test.ts` N-2 (guard Delay3) plus N-3 (borderless free-move NPC). Five mutations were caught and restored: facing gate, second tile, book box keep, owned threshold 1, free-move script ids ignored. ROM **1604/1604** (89 files), no-ROM **1474/130**.

- **StatusScreen CP2** adds 5: `rom/__tests__/status_screen_data.test.ts` (4: all 165 display-name keys/spellings and the static mirror, independent ASM move IDs/names without ROM, unchanged ROM constant-name IDs plus display strings, bold P at 04:5682 against independent 1bpp expansion and committed/pret PNG pixels); `static_export.test.ts` +1 (move-name JSON registration; the existing image guard/round-trip/staleness checks include the new P tile). Two new cases need ROM; the three new skips include registration. Setup twice is byte-identical, all 873 prior generated files unchanged. ROM **1609/1609** (90 files), no-ROM **1476/133**; typecheck/build clean.

- **A5b7g2 CP1** adds 2, no ROM: `rom/__tests__/hidden_event_programs.test.ts` derives each current map's hidden-event predef from refs' table, routines and `bench_guys.asm` (8 checked; the right poster pinned as a branch for CP2), and checks every hidden-event program and `BookshelfTileIDs` target is extracted. The ROM program test covers the 28 new labels op for op. ROM **1577/1577** (88 files), no-ROM **1447/130**.

- **A5b7e CP3–CP5** adds 37: `menus/bills_pc.test.ts` (25, retained layout/timing, text flags, source checks, add-before-remove, happiness/release, stats/chooser/save); `pikachu/pc_follower.test.ts` (6, eligibility vs coverage/status 0, old pixels/antic offsets, healthy/fainted withdrawal, consumed spawn states); `menus/stats_screen.test.ts` (2, shared pages and silence/render input); `story/pc.test.ts` +4 real-input controller flows (now 13, per-tick taps, follower before glyphs/through close, Change Box save). Prior bridge cases now check retained entry/return. Final ROM **1499/1499**, no-ROM **1369/130**, 83 files. Eleven temporary production mutations were caught and restored: menu beep, instant post-list text, release-NO reset, starter release, remove-before-add, missing save, B saves, lost offset, nonstarter happiness, eager covered initialization, missing result sprite update. Browser evidence/result: note 49 §14.

- **A5b7e CP2** adds 26: mon-list LV/100 layout, choice/cancel flag clears and SELECT redraw (+8); single-spaced menu input (+1); YES/NO flag timing (+1); LV/ball opaque rendering (+1); medicine species/custom-name capitals (+2); storage serialization/starter stand-in (new `pokemon_storage.test.ts`, 2); DEPOSITED tier/clamp/direct mood behavior (new `pikachu/pikachu_happiness.test.ts`, 11). Existing PC/controller tests now require typed post-list questions/results/retries, fast quantity draw +12/read +13, and no-delay reset on parent reentry/exit. ROM **1462/1462**, no-ROM **1332/130**, 80 files.

- **A5b7d** adds 43 net (incl. review F-1's 3 cursor tests): `menus/pc.test.ts` (30, real input and PC source flows), `story/pc.test.ts` (9, actual hidden-event/controller dispatch, +20/+23 anchors, transfer/input ownership and bridge/close), `menus/toss_item.test.ts` (5), one silent-choice timing regression and one opaque tile-rendering regression. Three legacy PcMenu caller tests moved from `items.test.ts` into the PC suite. ROM **1433/1433**, no-ROM **1303/130**, 78 files. The existing ROM text-program fixture independently source-matches the six added Oak-PC records.

- **A5b7c2** adds 38 net. No-ROM: `menus/hp_bar.test.ts` (16), `menus/party_menu.test.ts` (6), `menus/field_medicine.test.ts` (8), and 3 `menus/bag.test.ts` cases (the saved cursor, a toss of 2, and the parcel's NotYours line). `items.test.ts` drops its two `ItemMenu` field-use cases (the selected-slot check moved into field medicine). ROM: 7 heal-SFX cases in `extraction.test.ts` (now 100). ROM **1386/1386** in 74 files, no-ROM **1256/130**. The review fixes (note 46 F-1–F-3, by Claude) add 7: `menus/field_medicine_input.test.ts` (4, the real input module with per-tick edges, not the mocked "pressed until read" rig) and 3 result-screen cases in `field_medicine.test.ts` (now 11). ROM **1393/1393** in 75 files, no-ROM **1263/130**.

- **A5b7c1** adds 17, all no-ROM: `menus/bag.test.ts` (12), one `list_menu` re-arm case, one emptied-slot list case, one `items.test.ts` empty-slot case, one field-use case, one use-routine case, and one `story/mart.test.ts` whole-stack sale. `writeNumber` and the merge reset are extra assertions on existing tests. ROM **1348/1348** in 71 files, no-ROM **1225/123**.

- **A5b7b** adds 31, all no-ROM: `menus/screen_tiles.test.ts` (5), `menus/quantity_menu.test.ts` (3), `menus/list_menu.test.ts` (6), `story/mart.test.ts` (16), two more `menu_input` cases (now 7), and one `bg_transfer` case (now 4). Two ShopMenu cases left `items.test.ts`. CP6's six mutations were caught and reverted: the repeat counter skipping Delay3, a scroll off by one, halving each price instead of the total, the MONEY box changing before YES, subtracting before the bag add, and `press_ab` in the quantity box. ROM **1330/1330** in 70 files, no-ROM **1207/123**. The review's F-1 fix adds one `story/mart.test.ts` case (A+B together on BUY takes A): **1331/1331**, no-ROM **1208/123**.

- **A5b7a** adds 57 net: 49 in `text/text_numbers.test.ts` (BCD flags/cursor/
  frames, immediate decimals, typed bindings and committed programs), four
  standalone no-delay integration cases in `text/textbox.test.ts` (now 34), six
  Canvas glyph/spacing/sheet/scale cases in `menus/menu_render.test.ts`.
  Removes two obsolete unsupported-number cases from `text_runner.test.ts`
  (now 21). All 57 are no-ROM. ROM **1299/1299**, no-ROM **1176/123**.

- **A5b6** adds 47: notebook/N-1 +10; menu input and blackboard +10; Town Map double-close +10; Oak standalone programs, cue/2B, retained boxes, naming returns and input +17. `school.test.ts` (13), `menu_input.test.ts` (5), `town_map_sign.test.ts` (10), `oak_speech.test.ts` (17), and two text-runner regressions. The old transitional textbox case was replaced. The implementer's production mutations are in note 37; the review passed in `notes/38-a5b6-review.md`. Neither committed self-mutating tests.

- **A5b5c** adds 43: two Lab review regressions; `rom/__tests__/overworld_sprites.test.ts`
  (3 ROM-dependent), `overworld/npc_sheets.test.ts` (6), `menus/yes_no_menu.test.ts`
  (12), `story/choice_timing.test.ts` (4), `story/pokecenter.test.ts` (16).
  Tests cover all sprite sizes/pret pixels, every still-sprite facing, invalid
  sheets, menu +3 reads/+15 answer tails, real caterpillar/old-man branch timing,
  first/repeat/CANCEL nurse programs, saved first-use flag, coverage/box hides,
  69-frame Pikachu walk, 40-frame bow, fainted slot facings, pause/held-input
  behavior, actual-script dispatch, 17-frame close and Pewter tripwire.
  Five in-memory mutations cover old sprite decoding, still classification,
  both menu delays and NO's blackout callback. Only the old A6e quick-text
  fixture adapts its command vocabulary; its original assertions are unchanged.

- **A5b5b** adds 39: `story/pallet_town.test.ts` (7),
  `story/oaks_lab.test.ts` (30), `audio/rival_start.test.ts` (2).
  Coverage includes source programs and grouped displays, live Lab branches,
  borderless opening, +20/+23 glyphs, 23/15 closes, both 61-frame bubbles,
  real gift jingle before party/flag changes, nested free-movement handlers,
  the guard, successive display revisions, unchanged movement arrays and
  battle metadata, the I1 gift-flag tripwire, and five in-memory mutations.
  The alternate rival music entry matches independently parsed ASM and retains
  the committed track unchanged. Existing small-handler tests now require
  Mom to preserve the blackout destination and classify Pallet/Lab as migrated;
  all A6/controller/nurse timing tests remain unchanged.

- **A5b5a** adds 49: `story/text_handlers.test.ts` (2),
  `script/display_commands.test.ts` (7), `story/small_text_handlers.test.ts` (40).
  Coverage includes live dispatch, envelope options, retained YES/NO and
  HEAL/CANCEL positions, 61-frame bubble, asynchronous healing music and the
  real CHAN1 return at update 136, migrated DelayFrames input ownership,
  all small-handler branches, exact first-write/close costs, give/hide/flag
  order, full bags, TV hidden-event routing, no-legacy-text and 30-object census
  tripwires, plus three in-memory mutations. Existing Route 1 and Viridian
  builder tests now assert source programs and display envelopes; the A6/nurse
  timing tests remain unchanged.

- **A5b4** adds 49: three ROM data/ASM tests in `map_sprite_sets.test.ts`
  (now 20, ten ROM-dependent), 21 pure runner tests in `text_runner.test.ts`,
  15 session/close tests in `textbox.test.ts` (now 30), eight pickup/controller
  tests in `item_pickup.test.ts` (now 24), and two `map_text_calls.test.ts` tests.
  All emitted sprite sets compare against ASM, including an in-memory set-3
  mutation. Runtime selection/allocation shares the independent 19-map fixtures.
  Session mutations check close +1, missing UI coverage, and keep gaining +3.
  Existing printer/BG tests remain unchanged; existing close/pickup assertions
  now include cartridge reload costs, opening order and sound input ownership.

- **A5b3** adds 27: 17 ROM-dependent tests in `rom/__tests__/extraction.test.ts`
  (four SFX headers, committed JSON, independently parsed ASM commands, music/SFX
  kind, all-header bank comparison, and both banks' differing return updates),
  plus 10 no-ROM tests in `audio/sfx_key_item_pc.test.ts` (key-item note starts,
  perfect-pitch/wave registers, three PC traces, 121/70/18/22-update waits and
  the actual Forest track's silent hand-off/tempo preservation). The existing
  preload-list test covers the four added names. ASM comparisons return early
  when refs are absent, matching A1a; bank/ROM assertions still run with ROM_PATH.

- **A5b2** adds 18: `rom/__tests__/map_sprite_sets.test.ts` (17; 7 need `ROM_PATH`
  and throw if `refs/pokeyellow` is missing) and one registration check in
  `static_export.test.ts`. Without ROM the file checks the committed ids, picture
  classes, split selection, slot allocation and the 19 current walking-half counts.
  With ROM it compares the three tables, all 82 sheet sizes and the current object
  lists to pret. Since A5b4, selection, allocation and close-frame counts are imported from
  the runtime `overworld/sprite_sets.ts`. ROM mutations stay in memory.

- **A5a** adds 53:
  - `text/text_printer.test.ts` (24): place-then-delay and final delay, held input,
    actual-read edges, controls, protected/sound waits, 5+5 scroll, 20-frame para,
    30/30 blink, contraction tiles, clipping and no word wrap.
  - `text/bg_transfer.test.ts` (3): persistent third-frame phase and fast/medium traces.
  - `text/textbox.test.ts` (15): DisplayTextID / PrintText openings, silent ending,
    fresh A/B and A release, prompt's two waits, retained transfer,
    font-extra rendering, render independence and trainer music callback timing.
  - `rom/__tests__/text_decoder.test.ts` (11, three require ROM): strict byte decoding,
    cursor controls, glyphs, the game_text SHA256 (with A5b1's trailing `<PROMPT>`s
    stripped), map widths and all current map strings against pret's text macros.
  - Existing text/pickup assertions now use held input at actual reads; A1b's
    73 / 181 updates from completed text to close remain unchanged.

- **A5b1** adds 7: `rom/__tests__/text_programs.test.ts` (ROM-dependent; the ASM checks
  return early without `refs/`): every listed label extracted; every program op for op
  against pret's macros; the JSON equals the extractor; every TextPointers entry's call
  reproduced from pret's statements; every current medicine result of
  `PartyMenuItemUseMessagePointers` listed; pinned calls (both Mart tables, the forest sign bug,
  nurse, Mart sign) and programs (FAR return, key-item sound, Potion's operands).

- **A1c** adds 46:
  - `overworld/trainer_sight.test.ts` (12): `TrainerEngage` in screen bytes (range, axis,
    behind, the $fc quirk and its unreachable rewrite, the left edge at X = $00, the latch, the
    Power Plant), header order, `swap(d) − 1`.
  - `overworld/map_trainers.test.ts` (23): the pop-in quirk on youngster5's geometry, where
    sight runs (not mid-step, not a map's first pass, after a battle through `EnterMap`'s
    update), the script phases, the T+133 / T+131 walk-up timeline, the adjacent case, the
    talk path, the reset, the seen gates (hidden items pass), `EmotionBubble`.
  - `input/joy_ignore.test.ts` (4, with a stubbed `window`): the mask on held and pressed,
    the raw edge.
  - `overworld/trainer_tripwires.test.ts` (3): no OVERWORLD sight trainer (the hop
    midpoint, V4), `TRAINER_MAPS` against pret's scripts.
  - `walk_pace.test.ts` (+3): `MoveSprite_`'s status rule; extraction (+1): the Forest's
    sight ranges and header order = slot order.

- **A1b** adds 52:
  - `items.test.ts` (23): slot-order/99/byte rules for bag and PC, selected-stack
    removal, verbatim save restoration, failed buys/transfers, and duplicate-stack
    consumption through field and battle menu input.
  - `script/text_commands.test.ts` (originally 13; 7 after A5b7g1 CP1): retained
    displays, sound waits, silent A/B waits, held-A close, saved HideObject/collision
    state and UI lifetime. Printer/runner/TextBox tests own prompt/paging coverage;
    the header maps the deleted legacy fixtures to those source-path cases.
  - `overworld/item_pickup.test.ts` (16): builder branches and ASM strings,
    interaction priority/found-item fallthrough, Route 1's flag-first quirk,
    save/reload/freed tiles, held A and full bags. The real audio rig checks
    73 / 181 updates from completed text to closing; NPCs stay frozen.
  - ROM-dependent suites still skip 81 without `ROM_PATH`. ASM-string tests skip
    when the read-only `refs/pokeyellow` clone is absent.

- **A1a** adds 36:
  - `audio/sound_channel.test.ts` (18): channels by id, the wave octave, perfect pitch,
    vibrato (period, rate 0, clamps, direction across notes), the note arithmetic (with a
    whole-library zero-delay check), silent rests, suppression, the SFX tempo, the hand-off
    and the update order (mutation-checked).
  - `audio/sfx_jingles.test.ts` (11): both jingles' note and end updates; the wait
    (73 / 181, channel 7 skipped, drums, channel 8, loading); drum drop and cancel;
    `press_ab` timing; a stopped SFX's release; the preload list.
  - 7 extraction tests: the headers against the sym file, and every channel against
    pret's asm parsed directly.
  - The rig is `src/test/audio_rig.ts`: a logging `GBSynthesizer` and `audioUpdate()`.
    Audio tests import the engines, never `audio/index.ts` (it touches `window`).

- **A6e** adds 38 (net): `pikachu/pikachu_movement.test.ts` (21: every opcode family,
  durations 37/69/67/35, the sine traces, the subtimer animation bug, turns, shadow and
  grass, no-init programs, the side check); 2 extraction tests (the JSON, and every
  record against the disassembly); controller tests for TryApply's guard and refresh on
  both pass parities, both lab branches, the nurse's three walks and a whole-heal trace
  (healthy, fainted and no starter), and the frozen world; `ui_entry.test.ts` for the
  emotion phases (entry turn, prelude, border 3 + 3, render frequency).

- **A6d** adds 24 tests: native buffer states and guard, hop-half toggle, flat hop and
  catch-up speeds, landing timing and input gates, shadow composition, two consecutive
  ledges, START refresh, healing and script completion. A 30-step pixel trace matches
  the committed position-buffer follower; a 200-step seeded walk keeps at most two
  entries. The ROM shadow matches pret's PNG pixel for pixel.

- **A6c** — `walk_pace.test.ts` grew to 55 (the direction byte, displacement bytes, the
  rewritten NPC block, the player's vector and Pikachu counter);
  `overworld/sprite_collision.test.ts` (29: geometry, screen edge, sprite in front, the
  counter rule); `pikachu/pikachu_idle.test.ts` (25) and `pikachu/pikachu_follower.test.ts`
  (23, render spy, UI coverage and the font-loaded reset); `overworld/ui_entry.test.ts`
  (9, the real START menu and Pikachu portrait through `captureUi`); 22 more controller tests (walking into
  Pikachu, slot order, beaten trainers, text and nurse openings).

- **A6b** — 15 step-end/Pikachu tests, 16 sprite visibility tests, 23 controller/NPC
  integration tests and 1 UI capture test. Covers the check order, counters, walking
  bonus/mood, turns, both hop halves, door exits, stationary/held-key triggers, pop-in,
  whole-sprite UI hiding and Oak's in-step animation. Walk pace adds fixed STAY delays.

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
  once per tick (once per standing pass in the overworld since A6a), so shorter taps
  are lost.
- Vite's dev watcher can crash on a locked file appearing in `game/` (EBUSY) —
  just restart `npx vite`.
- **Many working copies under `game/src` are CRLF** (git stores LF, `.gitattributes`
  normalizes on commit). A `node` string-replace that spans lines misses them and
  throws. Edit those files with the Edit tool; `Write` replaces a whole file with LF,
  which is fine.
- **Measuring timing in the browser:** `requestAnimationFrame` doesn't run in a hidden
  tab, but the game keeps ticking on its worker, so an rAF sampler logs nothing. Wrap
  the per-pass method instead: a temporary `window` hook to `player`, then patch
  `player.update` to log `performance.now()` and `x` per call (A6a measured 15.99
  frames a step that way). Remove the hook before committing.
- **A Bash-classifier outage** can refuse every Bash call for a while. PowerShell runs
  the same `npx` / `npm` commands.
