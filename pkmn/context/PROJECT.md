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
save/load, Pikachu follower, hundreds of tests. Our job is feeding that engine
correct data and expanding the world — not rewriting it.

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

## State as of 2026-10-06

- **The July–August code was lost** (DECISIONS #26). `game/` was re-created from
  vanilla upstream (`gididaf/pokemon-yellow-typescript` @ `05faa114`).
- **12 playable maps**: Pallet Town, the two houses, Oak's Lab, Route 1, Route 22,
  Viridian City + Pokécenter, Mart, School, Nickname House. The 7 Route 2 / Viridian
  Forest maps are extracted (V1a) and playable through the debug warps (V1b); the Forest
  trainers battle as in the original (V1c); Oak's Pikachu catch runs the original's
  catch demo, which the old man shares (V1d); the real Viridian old men replace
  upstream's demo gates and the walk north is open (V1e) — **V1 done**.
- **970/970** tests (375 upstream, then V1a–e, the tick clock, A6a–e, A1a–c, A5a and A5b1), typecheck/build clean; no-ROM 878 pass / 92 skip.
- Since A6a (2026-09-28) the overworld moves at the Game Boy's pace: a 2-frame pass, 16 frames a player step, 34 an NPC step (DECISIONS #36). A6b–A6e (done and user-verified by 2026-10-05; A6 complete) port the order inside a pass, NPC wandering and turning, Pikachu's idle behavior, the ledge hop with Pikachu on Yellow's follow buffer, and Pikachu's scripted movement (DECISIONS #37–#39). A1a (2026-10-06, user-verified) ported the item jingles and brought the music engine to `engine_1.asm`: the wave channel an octave lower, perfect pitch, vibrato, silent rests (DECISIONS #40).
- **A1b done 2026-10-06** (implemented by Sol, reviewed by Claude, user-verified; DECISIONS #41): collectible item balls that stay gone in saves, hidden items and Route 1's sample per the ASM, the cartridge's text/sound waits, the slot-order/99 inventory rule and selected-stack removal.
- **A1c done 2026-10-06** (Claude; DECISIONS #43; user-verified): Forest trainers spot the player as `TrainerEngage` does, with the meet music, the "!" and the walk-up. **Milestone A1 is done.** Next: A5, V2.
- **A5a done 2026-10-06** (Sol implemented, Claude reviewed, user-verified; DECISIONS #44): text types, scrolls and ends as the cartridge's printer does; NPC, sign and trainer texts open and close per `DisplayTextID`. Next: A5b.
- The game ticks at the Game Boy's 59.7275 Hz (DECISIONS #33).
- **A5b planned by Sol 2026-10-06, approved as DECISIONS #45**: seven increments
  (`notes/23-a5b-plan.md`): text, sprite-set and audio extraction, then execution/close,
  story, school/intro and menu texts. **A5b1 done 2026-10-07** (Claude implemented, Sol
  reviewed and signed off): `text_programs.json` holds the cartridge's text programs and each
  map text's call; the runtime is unchanged until A5b4. Next: A5b2. A5c–f follow in order;
  species display names belong to V5.
- **Runs with no ROM, from committed files** (Phase R done): the browser loads
  only `static/`, upstream's upload gate is deleted, and `data/` + `static/` are
  in git. A fresh clone plays with no ROM and no setup.
- The game keeps running in background tabs (DECISIONS #27).
- Git: local repo, baseline commit, never pushed (DECISIONS #24).
- Plan: **36 milestones** — R (split R1a–c), **V** (rebuild the lost 30-map
  state), A (core systems), B–I (story order), J (postgame), X (extras).

## Goals

1. Run the dev server (`npx vite --host 127.0.0.1 --port 5173 --strictPort`), click, play — no ROM, no emulator, no upload screen. ✅ (R1b)
2. All game data committed to the repo — no ROM in the final product. ✅ (R1c)
3. Feed the engine's existing data contract exactly (same JSON shapes) — we feed
   it, we don't rewrite it. ✅
4. Full test suite green against generated data. ✅ (**970**)
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
   Viridian Forest → its north gate. Pewter (V2) isn't extracted yet, so Route 2's
   north edge is a wall.

After Phase V: … → Route 2 / Forest → Pewter (Brock → BADGE_1, Museum) →
Diglett's Cave → Route 3, the point the lost copy had reached.

## Success criteria

1. `npm run typecheck` + full `npm test` green. ✅ (970)
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
