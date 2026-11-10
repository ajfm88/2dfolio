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

## State as of 2026-11-08 (end of day) - V3 complete

- **R1, V1, A6, A1, V2, A5 and V3 are done (7/36 milestones).** The playable path reaches Route 3 across 28 maps, and Brock can be beaten for the Boulder Badge and TM34. The ASM-backed battle engine is live.
- **No ROM at runtime.** 204 committed JSON files and their static mirror, 527 PNGs and 3 tilemaps. Vanilla art, local play, no remote and no push.
- **Next: V4** (Diglett's Cave and the hop-midpoint `RunMapScript`), then V5's fixes.
- **Unscheduled:** attack move animations (#94), the evolution screen's port (no tests pin its drawing; note 57).
- **Tests:** ROM **6260/6260**; no-ROM **5970 pass / 290 skip**; 249 files. Bundle `index-DtAwi9SA.js`.
- Full handoff: STATUS.md; V3's record is note 88.

## Goals

1. Run the dev server (`npx vite --host 127.0.0.1 --port 5173 --strictPort`), click, play — no ROM, no emulator, no upload screen. ✅ (R1b)
2. All game data committed to the repo — no ROM in the final product. ✅ (R1c)
3. Preserve the authoritative extractor data contract (same JSON shapes) while porting game behavior faithfully. ✅
4. Full test suite green against generated data. ✅ (**6131**, 2026-11-05; no-ROM 5854 pass / 277 skip; live count in `STATUS.md`)
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

1. `npm run typecheck` + full `npm test` green. ✅ (6131 ROM / 5854 no-ROM + 277 skip, 2026-11-05)
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
