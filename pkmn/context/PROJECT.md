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

**Current priority (user):** rebuild the lost work (Phase V), then expand
**vanilla Yellow** (more maps/story/gyms). ROM-free play is done (Phase R).
**Deferred:** sprite randomizer (X1), Netlify (X2). **Dead last:** deploy.

Live status: `STATUS.md`. Roadmap: `PLAN.md`.

## State as of 2026-11-03 — stopped after accepted A5e checkpoint-03b

- **R1, V1, A6, A1 and V2 are done (5/36 milestones).** A5a/b/c/d are done; A5e and A5f remain open.
  The lost July–August code was rebuilt from upstream; the live path now reaches Pewter across24 maps.
- **No ROM at runtime.** Committed196 JSON data files and a static mirror with525 PNGs and3 tilemaps.
  No maps, assets, extraction or dependencies changed today. Vanilla art, local play, no distribution/push.
- The ASM-backed battle engine has been live since A5c3f checkpoint-09b. The old engine is retired.
  Its user play-test passed2026-11-01; today's foundations do not change the visible battle intro.
- **Today: A5e foundations through03b, implemented by Claude Sonnet and independently accepted by Codex.**
  Note75 contains01's inventory/trace and02's unused LCD-off HUD/BG0 helper (6 cases).
  Note76 adds03a's default-disabled third scroll band (8 pixel cases).
  Note77 adds03b's unused full silhouette Program and phase/capture contract (21 cases).
  Total35 new cases; no existing test/snapshot/data changes.03a alone changes the bundle by72 bytes.
- **Accepted commits:**02=115b59d, review6c9a822;03a=67e14ee, review7f5ddb4;
  03b=6dc2536 code/logs +3c201d9 docs, review8861a58. The two-commit03b process deviation is documented.
- **Verified baseline:**6019/6019 ROM; no-ROM5762 pass/257 skip;238 files; default workers, first full runs.
  Typecheck, production build and the existing decoder/no-extractor/no-node marker check pass.
  Bundle index-D4Ol9Anq.js,655166 bytes, SHA25652090ba0af1f07a29ba29d37e790498df4715e928b4d5705f498480442fab55c.
- The overworld remains on the Game Boy's59.7275Hz clock and2-frame pass. The cartridge's Random is shared
  outside battle; missing battle VBlank Random remains backlogged. No mechanics/RNG changes today.
- **Current runtime:** the existing interim intro still runs.03b is outside the runtime import graph;03a's lower
  override is null and no production caller enables it. Growth, starter Pikachu, retreat and slide-offs already
  run from A5c3f10c. Poof/OAM and remaining substitute/minimize/transform carries remain future A5e work.
- **Next session:** Codex traces/spikes/briefs A5e checkpoint-04, then Sonnet implements its concrete brief and
  Codex reviews.04 is not started or briefed. It must bind the real driver/entry phase, partial-raster capture,
  masked-LCD versus palette-held audio and real text, then explicitly audit frame-driven DIV/ledger changes.
  The03b fixture phase contract is not a measurement of cartridge ISR timing and is not a drop-in BattleHost.
- **O-50 remains open:** attack move animations stay on the current OFF path until the scope answer is recorded.
  Resolve before animation-data/routing; intro planning can proceed independently. No answer is inferred.
- The user ended the day. Keep all commits local and the existing data/art protected. After A5e: A5f's catch/demo
  integration, then V3 Gym/Museum, V4 and V5. Full detail: [STATUS](STATUS.md), notes75–77 and battle architecture.

## Goals

1. Run the dev server (`npx vite --host 127.0.0.1 --port 5173 --strictPort`), click, play — no ROM, no emulator, no upload screen. ✅ (R1b)
2. All game data committed to the repo — no ROM in the final product. ✅ (R1c)
3. Preserve the authoritative extractor data contract (same JSON shapes) while porting game behavior faithfully. ✅
4. Full test suite green against generated data. ✅ (**6019**, 2026-11-03; no-ROM5762 pass/257 skip; live count in `STATUS.md`)
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
- A full pret `move_anim` interpreter (v1 category anims are fine).
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
   doors fail gracefully until V3; Route 3 is V4.

After Phase V: … → Route 2 / Forest → Pewter (Brock → BADGE_1, Museum) →
Diglett's Cave → Route 3, the point the lost copy had reached.

## Success criteria

1. `npm run typecheck` + full `npm test` green. ✅ (6019 ROM /5762 no-ROM +257 skip,2026-11-03)
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
