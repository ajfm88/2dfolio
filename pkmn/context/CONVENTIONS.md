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
2. `ROM_PATH=pokeyellow.gbc npm test` — **baseline 988/988** as of 2026-10-09
   (A5b2 implementation). Anything less is a regression; new tests raise the
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

988 tests in 46 files (vitest, `environment: 'node'`); without ROM, 888 pass / 100 skip.

**How it runs**

- **Setup** (`src/test/setup.ts`) stubs `fetch` to serve `data/*.json`, and calls
  `process.exit(1)` if `data/` is missing.

- **Helpers** (`src/test/helpers.ts`): `makePokemon(overrides?)`,
  `mockRandom(values[])`, `mockRandomFixed(value)`, `restoreRandom()`.

- **Battle messages** are `string[][]` — `result.messages[0][0]` or
  `result.messages[0].join(' ')`.

**By area**

- **Extraction** — 76 in `src/rom/__tests__/extraction.test.ts`; compares each
  extractor with the JSON in `data/`. Needs `ROM_PATH`, skipped otherwise.
  Its Pikachu and old-man pixel tests compare against pret's PNGs in
  `refs/pokeyellow/gfx/` and return early if `refs/` isn't cloned. The V1 block
  (added in V1a) checks the new maps against values transcribed from the ASM:
  trainer headers, NPC ids and facing parsed from `data/maps/objects/*.asm`,
  item balls, and the leaving-sign bug.

- **Static export** — 7 in `src/rom/__tests__/static_export.test.ts` (R1a, plus A5b2's
  explicit `map_sprite_sets.json` registration check): key shape, the four grays,
  lossless PNG round-trip of all 520 images, extracted JSON
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

- **A5b2** adds 18: `rom/__tests__/map_sprite_sets.test.ts` (17; 7 need `ROM_PATH`
  and throw if `refs/pokeyellow` is missing) and one registration check in
  `static_export.test.ts`. Without ROM the file checks the committed ids, picture
  classes, split selection, slot allocation and the 19 current walking-half counts.
  With ROM it compares the three tables, all 82 sheet sizes and the current object
  lists to pret. Selection, allocation and close-frame counts are test references
  for A5b4, not shipped runtime. ROM mutations stay in memory.

- **A5a** adds 53:
  - `text/text_printer.test.ts` (24): place-then-delay and final delay, held input,
    actual-read edges, controls, protected/sound waits, 5+5 scroll, 20-frame para,
    30/30 blink, contraction tiles, clipping and no word wrap.
  - `text/bg_transfer.test.ts` (3): persistent third-frame phase and fast/medium traces.
  - `text/textbox.test.ts` (15): DisplayTextID / PrintText openings, silent ending,
    fresh A/B and A release, prompt's two waits, legacy overrides, retained transfer,
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
  - `script/text_commands.test.ts` (13): retained text, the protected prompt,
    sound waits, silent A/B waits, held-A close, saved HideObject/collision state,
    UI opening and legacy text behavior.
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
