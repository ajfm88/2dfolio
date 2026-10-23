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

## State as of 2026-10-21

- **The July–August code was lost** (DECISIONS #26). `game/` was re-created from
  vanilla upstream (`gididaf/pokemon-yellow-typescript` @ `05faa114`).
- **24 maps**: upstream's 12 (Pallet Town, the two houses, Oak's Lab, Route 1, Route 22,
  Viridian City + Pokécenter, Mart, School, Nickname House), the 7 Route 2 / Viridian
  Forest maps (V1), and Pewter City + Pokécenter, Mart and two houses (V2a). The Forest
  trainers battle as in the original (V1c); Oak's Pikachu catch runs the original's
  catch demo, which the old man shares (V1d); the real Viridian old men replace
  upstream's demo gates and the walk north is open (V1e) — **V1 done**.
- **4397/4397** tests across 165 files (375 upstream, then every slice since); typecheck, build and the ROM-backed suite re-checked 2026-10-22 (A5c3c checkpoint-06). No-ROM 4189 pass / 208 skip.
- Since A6a (2026-09-28) the overworld moves at the Game Boy's pace: a 2-frame pass, 16 frames a player step, 34 an NPC step (DECISIONS #36). A6b–A6e (done and user-verified by 2026-10-05; A6 complete) port the order inside a pass, NPC wandering and turning, Pikachu's idle behavior, the ledge hop with Pikachu on Yellow's follow buffer, and Pikachu's scripted movement (DECISIONS #37–#39). A1a (2026-10-06, user-verified) ported the item jingles and brought the music engine to `engine_1.asm`: the wave channel an octave lower, perfect pitch, vibrato, silent rests (DECISIONS #40).
- **A1b done 2026-10-06** (implemented by Sol, reviewed by Claude, user-verified; DECISIONS #41): collectible item balls that stay gone in saves, hidden items and Route 1's sample per the ASM, the cartridge's text/sound waits, the slot-order/99 inventory rule and selected-stack removal.
- **A1c done 2026-10-06** (Claude; DECISIONS #43; user-verified): Forest trainers spot the player as `TrainerEngage` does, with the meet music, the "!" and the walk-up. **Milestone A1 is done.** Next: A5, V2.
- **A5a done 2026-10-06** (Sol implemented, Claude reviewed, user-verified; DECISIONS #44): text types, scrolls and ends as the cartridge's printer does; NPC, sign and trainer texts open and close per `DisplayTextID`. Next: A5b.
- The game ticks at the Game Boy's 59.7275 Hz (DECISIONS #33).
- **A5c (the battle) in progress** (`notes/65-a5c-a5f-plan.md`, DECISIONS #70): A5d (transitions) ✅ user-verified 2026-10-18; A5c1 (foundations) and A5c2 (menus) ✅ 2026-10-19; A5c3 (the battle engine from the ASM, note 68, #75) runs as six sub-slices, all built unused until A5c3f switches the game over. **A5c3a (state and plumbing) and A5c3b (the whole turn, MainInBattleLoop down) ✅ 2026-10-20.** Next: A5c3c (move effects, planned in note 69, Codex implements), then A5c3d (faint/switch/EXP), A5c3e (trainer AI), A5c3f (switch-over). The production bundle is unchanged throughout (`index-Dn4MlLpw.js`).
- **A5b planned by Sol 2026-10-06, approved as DECISIONS #45**: seven increments
  (`notes/23-a5b-plan.md`): text, sprite-set and audio extraction, then execution/close,
  story, school/intro and menu texts. **A5b1 done 2026-10-07** (Claude implemented, Sol
  reviewed and signed off): `text_programs.json` holds the cartridge's text programs and each
  map text's call; the runtime is unchanged until A5b4. **A5b2–A5b4 done** (sprite sets, key-item/PC
  SFX, the text runner and exact close; A5b4 user-verified). **A5b5a/b done 2026-10-11** (DECISIONS #49: a
  `(map, textId)` handler registry on the display session; Mom, TV, Daisy, Route 1, Mart, Viridian's
  talkers, Pallet's Oak scene and Oak's Lab; A5b5b user-verified). **A5b5c implemented and reviewed
  2026-10-12** (`notes/36-a5b5c-review.md`: the A5b5b fixes, BUG-1, yes/no timing, the nurse on one
  display; tests 1195/1195; user-verified; F-1 fixed). **A5b6 is done** (`notes/38-a5b6-review.md`, passed; user-approved 2026-10-14). A5b7 is approved as seven slices A5b7a–g (`notes/39-a5b7-plan.md`, DECISIONS #52); **A5b7a is done** (`notes/40-a5b7a-review.md`, user-verified 2026-10-14), with 1299/1299 tests and clean typecheck/build; A5b7b (the Mart) is done (`notes/42-a5b7b-review.md`, user-verified 2026-10-14); A5b7c (the bag, toss, field medicine, the HP bar) is done (`notes/44-a5b7c1-review.md`, `notes/46-a5b7c2-review.md`, user-verified 2026-10-15), with 1393/1393 tests; A5b7d (the item and Pokécenter PCs) is done (`notes/47-a5b7d-plan.md`, `notes/48-a5b7d-review.md`, user-verified 2026-10-15; 1436/1436 tests); A5b7e (Bill's PC) is done (`notes/49-a5b7e-plan.md`, `notes/51-a5b7e-review.md`, user-verified 2026-10-15; 1499/1499 tests); A5b7f (START and SAVE) is done (`notes/52-a5b7f-plan.md`, `notes/53-a5b7f-review.md`, user-verified 2026-10-15; 1563/1563 tests); A5b7g (legacy retirement; hidden events and bookshelves as programs) is done (`notes/54-a5b7g-plan.md`, reviews `55`/`56`, user-verified 2026-10-16; 1604/1604 tests). **A5b7, and so A5b, is complete.** The StatusScreen port is done (note 58, DECISIONS #62, user-verified 2026-10-16), and so is the Pokécenter healing machine (note 59, DECISIONS #63, user-verified 2026-10-16). V2 runs as V2a → V2b → V2c (note 60, DECISIONS #64): **V2a (Pewter City, its Pokécenter, Mart and two houses; Mart lists read from the ROM) V2b (the museum and gym guides, the east block; note 61) and V2c (Jigglypuff and the sleeping Pikachu; note 62) are user-verified 2026-10-17: **V2 is done.** The map-music fade-out (note 63) and the intro animation (Oak's speech frame for frame, note 64) are done and user-verified 2026-10-18. Next: A5c–A5f, re-split by note 65 (DECISIONS #70) as A5d → A5c1 → A5c2 → A5c3 → A5e → A5f, the battle becoming a frame program on a `BattleScreen`; A5d (the transitions) is done and user-verified (2026-10-18), A5c1 (battle foundations, note 66) and A5c2 (the battle's menus, note 67) are done (2026-10-19), and A5c3 (note 68, DECISIONS #75) is in progress: A5c3a and A5c3b are complete (2026-10-20), and A5c3c (the move effects) is planned in note 69 (2026-10-21);
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
4. Full test suite green against generated data. ✅ (**4397**, 2026-10-22)
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

1. `npm run typecheck` + full `npm test` green. ✅ (4397)
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
