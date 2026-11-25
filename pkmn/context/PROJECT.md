# PROJECT — what we're building and why

**A local-only, 1:1 replica of vanilla Pokemon Yellow in TypeScript/JavaScript.**

This is a port — a remake of the original game for the browser. We are not
designing a game. Gameplay, balance, text, maps, mechanics, sprites and Gen 1 bugs
are all reproduced as they are; the repos in `refs/` are how we get them right.
Personal hobby project, never distributed, runs on `127.0.0.1`.

**It is a real TypeScript implementation, not an emulator.** The game must run
with **no ROM at all** — no upload screen, no ROM file, no emulation layer. The
cartridge dump exists purely as a development-time reference and asset source: we
extract from it, commit the output, and the shipped game loads plain static JSON
and PNG. Anything the game needs at runtime must be a committed file.
(Invariant #1 in `ARCHITECTURE.md`; DECISIONS #2, #14, #18.)

We build on **`gididaf/pokemon-yellow-typescript`** (copied into `game/`) because
that author already did so much of the work: battle, menus, overworld, audio,
save/load, Pikachu follower and the initial playable world. We maintain that copy, expand the world and port
behavior from the disassembly wherever fidelity requires it; A5c replaced its battle engine with ASM-backed ports.

**Sprites are vanilla Yellow**, extracted from the ROM to
`/gfx/sprites/front/<dex>.png`. That already works and it is what the game uses
for the entire build. `pkmn-sprites/` is not needed for any of it.

**Scale.** Deliberately ambitious — realistically **one to two years and on the
order of 700–800 sessions.** The 36 milestones in `PLAN.md` are not sessions;
each subdivides many times over. Nobody expects a Yellow port in two
weeks, and no session should feel behind for finishing one small verified thing.

## The randomizer is a year-two idea

Eventually we want one deviation from vanilla: battle sprites rolled per
encounter from six art sets (Gen 1 red-blue/red-green/yellow, Gen 2
gold/silver/crystal, first 151 only) — see a Rattata, get one of its six looks.

**It is Phase X1: dead last**, after the game is beatable (I2) and audited (J2).
Do not start it, do not design engine work around it, do not let it justify any
change to how sprites load today. The research is banked in DECISIONS #21–#23 and
`ARCHITECTURE.md` so the eventual session is cheap; until then it is a footnote.

During development the ROM (`pokeyellow.gbc`, from the user's own cartridge) is
used to extract game data via `npm run setup pokeyellow.gbc`. The extracted JSON +
PNG output is committed to the repo so the final product needs no ROM at all.

**Current priority:** A2 checkpoint-02 after the machine-data extraction in
checkpoint-01 passed review. The battle-mechanics audit closed through
checkpoint-11; Phase R and Phase V are complete. The remaining
opening timing work is parked until after the main game (DECISIONS #171/#174).
**Deferred:** sprite randomizer (X1), Netlify (X2). **Dead last:** deploy.

Live status: `STATUS.md`. Roadmap: `PLAN.md`.

## State as of 2026-11-24 — Phase V complete (9/36 milestones)

- **R1, V1, A6, A1, V2, A5, V3, V4 and V5 are done (9/36 milestones); Phase V is complete** (DECISIONS #139, note
  109 §10). The game runs with no ROM from 30 runtime-wired maps, Pallet Town through Pewter, Route 3 and Diglett's
  Cave, with Brock's badge and TM34 and the ASM-ported battle engine.
- **No ROM at runtime.** 263 committed JSON files and their static mirror, 536 PNGs and 6 tilemaps (1068 generated
  files total). Vanilla art, local play, no remote and no push. The intro movie's JSON, PNGs and tilemaps are extracted and unused until checkpoints 11–14.
- **V5, the recovered fixes, all reviewed and, where a player sees or hears the change, user-verified:**
  V5a the type chart's Psychic rows pinned (note 91); V5b the battle return (note 92); V5c the map-object audit
  (note 93); V5d the land tile pairs (note 94); V5e species names and nicknames (note 95); V5f the CGB
  palette-command hold in every menu host (notes 96–100); the battle chooser's prompt (note 102); V5g the SFX
  catch-up: the bank-aware `SFX_FILES` lookup with Audio 3's copies and the battle's text sounds (notes 101,
  103, 104), the field's priority and two SFX at once (note 105), and the call sites: the door sound by tile, the
  ledge hop, the Town Map's tinks, the field's text sounds (notes 106–109).
- **Pokémon cries are live** in battle, Oak's speech, named field scenes, status,
  Pokédex and Bill's PC; the five-checkpoint slice closed 2026-11-23 (note 140).
  The battle-mechanics audit now has nine reviewed checkpoints: damage/hit/Counter
  (`17651c7`), turn/status/residual (`08b014d`), effect dispatch/status handlers
  (`3a2d4ae`), stat effects (`e39878f`), turn effects (`2734993`), HP/copy
  effects (`8f8461a`), stat arithmetic/names/loaders (`238272a`), and trainer AI
  (`2be1c48`), and items/catch plus faint/EXP/end (`36b2efe`, `5baa462`). See
  `notes/141-battle-mechanics-audit-plan.md`. Checkpoint-10a (`1d27f50`) adds
  battle VBlank `Random`; checkpoint-10b re-recorded its RNG ledger, reconciled
  the full failure census, and passed independent review. Checkpoint-11 closed
  the bounded audit after a move census and glitch triage; unreachable glitch
  paths remain at J2. Attack
  move animations (#94) and the evolution screen port (note 57)
  are separate work.
- **Tests:** last full green ROM **7959/7959**, no-ROM **7573 pass / 386 skip**, 308 files
  (2026-11-24, `--maxWorkers=2`, A2 checkpoint-01). Typecheck and focused tests pass;
  the changed RNG ledger and test expectations are reviewed. Production bundle
  last measured at the cries baseline `index-Bh1w6Q55.js`, 708,471 bytes; no new build was run.
- **Opening:** 07b/08b reviews and notes 134–137 are closed. The development preview exercises the reusable
  foreground program with an original geometric cutscene. The game still reaches the title after the shooting star.
  The original 2c3 timing, live unit 3 integration, combined unit 4 audit, and O-59 remain open.
  `STATUS.md` holds the next task and the verified build hash.

## Goals

1. Run the dev server (`npx vite --host 127.0.0.1 --port 5173 --strictPort`), click, play — no ROM, no emulator, no upload screen. ✅ (R1b)
2. All game data committed to the repo — no ROM in the final product. ✅ (R1c)
3. Preserve the authoritative extractor data contract (same JSON shapes) while porting game behavior faithfully. ✅
4. Full test suite green against generated data. ✅ (live counts in `STATUS.md`)
5. Get back to the lost 30-map state (Phase V), then expand to **all of Kanto,
   1:1 with vanilla Yellow** (B–I phases, then J).
6. Any agent can pick this up mid-stream and make progress in one sitting.
7. *(Someday, after all of the above: the sprite randomizer — X1, dead last.)*

## Non-goals

- Distribution/publishing — personal hobby project only. Local play on `127.0.0.1`.
- **Any change to the game itself.** No rebalancing, no "improvements", no new
  content, no quality-of-life additions. Gen 1 bugs are reproduced deliberately.
  If it isn't in the original, it doesn't go in — the *only* exception is the
  sprite randomizer (DECISIONS #21).
- Full Kanto in one session — expand in story-order slices.
- Pushing the repo anywhere — it is local-only (DECISIONS #24).
- Gen 2 *content* — Johto dex, Unown, Gen 2 mechanics. (Gen 2 *art* is in the
  randomizer pool, skins for the 151 only — DECISIONS #23.)
- Shinies; Crystal animated GIFs (open question O-2).
- Deploy/hosting until the user says the product is fully working.

## Core user flow

Today (vanilla upstream's content, running ROM-free since R1b):

1. Open **`http://127.0.0.1:5173/`** (prefer this host for saves) → "Click to
   start" (unlocks browser audio) → title screen. No ROM prompt.
2. NEW GAME or CONTINUE. NEW GAME asks upstream's (non-vanilla) "Skip intro?" —
   yes starts in Red's room as YELLOW/BLUE, no plays the Oak intro + naming.
3. Pallet → Oak's Lab (Pikachu) → Route 1 → Viridian (Pokécenter, Mart parcel
   quest, school, nickname house) → back to Oak → Pokédex. Route 22 is walkable.
4. North of Viridian: the old man's catch demo (Yellow's, since V1e), then Route 2 →
   Viridian Forest → its north gate → Pewter City (V2a): Pokécenter, Mart, two houses.
   The guides and Jigglypuff's sleeping-Pikachu scene work (V2b/V2c). The Museum and Gym
   doors open since V3 checkpoint-01; Route 3 is V3 checkpoint-04 (DECISIONS #106).

After Phase V: … → Route 2 / Forest → Pewter (Brock → BADGE_1, Museum) →
Diglett's Cave → Route 3, the point the lost copy had reached.

## Success criteria

1. `npm run typecheck` + full `npm test` green. ✅ (7,959 ROM; 7,573 no-ROM pass / 386 skip, 2026-11-24)
2. Fresh browser: play without a ROM upload. ✅ (R1b, user-verified)
3. Save/load works on the same origin (`127.0.0.1`). ✅ (save → reload → CONTINUE
   re-tested in R1c from a fresh clone)
4. Game works from committed files with no setup step. ✅ (R1c = Phase R gate)
5. Keep expanding maps until the vanilla path feels complete. 🔨 (V, then B–I)
6. **The end state:** start a new game, play Pallet Town → Elite Four → credits
   → postgame, and have it match the original throughout, vanilla sprites and
   all. 🔨 (I2 gate, then J2 audit). Everything after that is optional.

## Background (historical)

Originally planned as ASM-from-pret generators (no dump). The user later dumped
their own Yellow cartridge (DECISIONS #14) and that became the build-time source.
On 2026-08-04 the user decided to commit all extracted data so the final product
is ROM-free (DECISIONS #18). The ROM is still used during development for
extraction. On 2026-09-22 the modified code from those sessions turned out to be
lost; the project restarted from vanilla upstream with the knowledge intact
(DECISIONS #26).
