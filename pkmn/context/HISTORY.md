# HISTORY — session archive

> ⚠ **This is not the live log.**
>
> Current state, the ordered work queue, open questions and recent sessions live in
> **`STATUS.md`** — read that first, and update it before you stop working.
> (DECISIONS #11, #19.)
>
> This file keeps older session entries once `STATUS.md`'s session log gets long,
> so the live log stays short enough that agents actually read it.

Newest first.

## Prior work — code lost (discovered 2026-09-22)

The sessions below (2026-07-27 → 2026-08-04) built this list on a modified copy
of the engine. **That copy no longer exists anywhere** (DECISIONS #26); on
2026-09-22 `game/` was re-created from vanilla upstream. The knowledge survives
in the context files; the code is rebuilt in the slice named in the last column.

| Old ID | What it delivered | Rebuilt in |
|---|---|---|
| P1 | Environment + typecheck | setup 2026-09-22 ✅ |
| P-ROM | ROM verified; setup → 156 JSON | setup 2026-09-22 ✅ |
| P2-1/P2-2 | ASM generators `scripts/gen/` parked (DECISIONS #15) | not rebuilt — only needed for romhack-style edits |
| P2-3 | PSYCHIC chart asymmetric (DECISIONS #10) | **V5** (bug re-confirmed 2026-09-22) |
| P4-1 | PNG dumper → `static/gfx/**` (~518 PNGs) | ✅ R1a (exactly 518) |
| P4-2 | Title `.tilemap` binaries (3 files) | ✅ R1a |
| P4-3 | Asset spot check 52/52 + user play | ✅ R1a (PNGs viewed, pret cross-check) + R1b (user played) |
| P5-1 | `publicDir: 'static'`, mirror data (DECISIONS #16) | ✅ R1a + R1b |
| P5-2 | ROM gate deleted | ✅ R1b |
| P5-3 | Full path smoke + map graph (`scripts/smoke_p5_3.mjs`) | rebuild only if needed |
| Polish | Audio clock; walk FPS max 60; title PKMN; base `/` (#17) | ✅ R1b (title, base); ✅ 2026-09-25 (FPS: the Game Boy rate, DECISIONS #33) |
| Polish | Overworld sprite extract size fix | found in R1a (sheets are 16×768, harmless) — trim is a **V5** candidate |
| Save | Harden + verify on 127.0.0.1 | ✅ save → reload → CONTINUE re-tested from a fresh clone in R1c (upstream save code; the old copy's "harden" changes are unknown) |
| P7 | Final verification baseline | — |
| Stretch v1 | Battle move anims (category-based) | upstream has its own approximation (`battle_ui.ts:326`); revisit later |
| SFX | `SFX_HEADERS` expanded — 49 SFX (was ~10) | **V5** |
| SFX-wire | `playSFX` at faint / level_up / heal / ball / save / shop / ledge / items | **V5** |
| Maps-v1 | Demo gate off; Route 2 + Forest + Pewter (24 maps) | **V1, V2** |
| Maps-v2 | Gym + Museum + Diglett's Cave + Route 3 (30 maps); Brock → BADGE_1 | **V3, V4** |
| — | `scripts/_extract_maps_only.ts` helper | rebuild only if needed |

## Archived session entries

### 2026-10-06 (A1c implemented) — Claude Opus 5.5

The user asked Claude to implement the approved plan (`notes/20-a1c-plan.md`, DECISIONS #43).

- **`58dafde` (checkpoint 1):**
  - `readTrainerHeader` extracts `sightRange`. The regenerated diff is 10 lines: 5 each in
    `data/` and `static/`.
  - `overworld/trainer_sight.ts` is pure.
- **`b20c237` (checkpoints 2–3, built together):**
  - `map_trainers.ts`: the script trio on `w<Map>CurScript`.
  - `emotion_bubble.ts` and the `emotion_bubble` state replace `trainer_approach`.
  - `input/joy_ignore.ts` is `wJoyIgnore`.
  - The seen gates.
  - The walk-up keeps the trainer's movement status.
  - `EnterMap`'s `UpdateSprites` after battles.
  - Removed: the step-end sight loop and Npc's approach code.
  - The pop-in quirk, the `$fc` quirk and the plan's timeline (text at T+133, or T+131 when
    the trainer is ready) all came out of the port, and the tests pin them. Two mutations
    were caught: the latch, and the status rule.
- **Smoke test** on port 5179, with a crafted save, cleared afterwards:
  - the hidden Potion taken from (1,17), unseen;
  - stepping onto (1,18): youngster4's text right away;
  - the battle won, and the player moves again;
  - from (26,32), step down: "!" over youngster2, a 3-step walk-up, its text.
- **Docs:** the overworld and battle ARCHITECTURE files, `context/ARCHITECTURE.md`,
  CONVENTIONS (baseline, the test suite, the map-workflow line), PLAN, PROJECT, CLAUDE.md.

**910/910**; no-ROM 828 pass, 82 skip; typecheck/build clean.
**Next:** the user's play-test (plan §7; A = Z). After that, A1 is done; then A5, V2.

### 2026-10-06 (A1c plan) — Claude Opus 5.5

Planning only, no code. I read the ASM's trainer engine (`home/trainers.asm`,
`engine/overworld/trainer_sight.asm`, `emotion_bubbles.asm`, `MoveSprite_`, `_Joypad`, the loop,
VBlank's OAM order) and our sight path. The plan is `notes/20-a1c-plan.md`. It replaces
`notes/07-a1-plan.md` §2.4.

New findings since the A1 plan:
- **The bubble is on screen for 61 frames**, with two `UpdateSprites` back to back at its end.
- **`MoveSprite_` sets `wJoyIgnore = $ff`.** Only an adjacent trainer leaves A live, and then
  only for hidden events and bookshelves.
- **`EndTrainerBattle` takes the first pass after a battle.** No sight check runs on that pass.
- **Battle returns skip `EnterMap`'s `UpdateSprites`.**
- **A spotting at the hop midpoint would strand the player on the ledge.** It can't happen
  before V4.
- **`startScript`'s forced resting pass** matches Pallet's explicit `$2`, but not
  `MoveSprite` in general.
- **The Forest's youngster4 (sight 1) guards the hidden Potion's own tile, (1,18).**

**Then:** the user said **"go"**, which takes all seven recommendations (DECISIONS #43).
**Next:** Sol implements A1c from checkpoint 1 (plan §6), committing each checkpoint locally.
Claude reviews afterwards in `notes/21-a1c-review.md`.

### 2026-10-06 (root CLAUDE.md slimmed, 45.9k → 12.4k characters) — Claude Opus 5.5

Docs only, no code. Claude Code warned that root `CLAUDE.md` was over its 40k-character
limit, and the user asked to move content into the context files. Every slice had added
1–4k to it.

What moved (DECISIONS #42):
- Module map, state machine, data conventions and extraction system →
  `ARCHITECTURE.md` → *Engine reference*.
- Movement pitfalls → `game/src/overworld/ARCHITECTURE.md`.
- Audio → new `game/src/audio/ARCHITECTURE.md`.
- Pikachu happiness tables → `game/src/pikachu/ARCHITECTURE.md`.
- Battle mechanics merged into `game/src/battle/ARCHITECTURE.md`; the faint slide is
  corrected to 7 rows, and `lastBlackoutWarp` replaces the gone `BLACKOUT_POSITIONS`.
- Testing → `CONVENTIONS.md` → *The test suite*.

*Where things stand* is one paragraph now. Session contract step 5 says a slice no longer
grows CLAUDE.md.

**Next:** unchanged — plan A1c (trainer sight). Update CLAUDE.md only for the baseline and
finished milestones.

### 2026-10-06 (A1b user-verified → done) — Claude Opus 5.5

The user play-tested A1b (plan §7) after the review passed: "everything works perfectly".
Along the way they saw POTION ×99 + ×3 after adding 99 to 3, and a Potion bought at 99 with
free slots: both are the cartridge's per-stack rule (the refusal needs a full bag).
Marked A1b done in STATUS, CLAUDE.md, PROJECT, PLAN, ARCHITECTURE and CONVENTIONS. No code
changes. The user asked about trainers spotting the player with "!" — that is A1c, next.
**Next:** plan A1c (trainer sight).

### 2026-10-06 (A1b independent review passed) — Claude Opus 5.5

Reviewed Sol's A1b (`788ba6b`…`ba291ea`) against `notes/18-a1b-plan.md`, DECISIONS #41 and
the cited ASM: **passes, no blocking findings** (`notes/19-a1b-review.md`). Re-ran
everything myself: typecheck, **864/864** with ROM, **783 pass / 81 skip** without, build,
`git diff --check`; no generated-data, extractor, refs or art changes; the 67 existing
controller tests are unmodified. Two non-blocking notes that predate A1b:
- N-1: typed text completes one letter delay early → A5.
- N-2: wrong-facing hidden events fall through to signs/NPCs → V5.
Sol's Route 2 staged saves checked. Dev server started on 5173 for the play-test.
**Next:** the user's play-test (plan §7); then A1b is done and A1c is next.

### 2026-10-06 (A1b implementation) — Codex/Sol

User requested implementation of `notes/18-a1b-plan.md`; DECISIONS #41 applies.
Started from `5564446` (the user's sequential notes rename). Independently verified the
baseline: 812/812 with ROM, clean typecheck.

Checkpoint 1: `AddItemToInventory_`'s slot-order/99 rule and byte addition, selected-slot
removal in bag/shop/PC/battle menus, add-before-charge/transfer, verbatim save restoration.
18 regression tests cover split stacks, full inventories and the first-overflow quirk,
selected duplicate slots and failed menu transactions. Typecheck clean; no-ROM suite
749 pass / 81 skip (830 total). Commit `788ba6b`. No generated-data changes.

Checkpoint 2: retained `text_end` and protected `prompt`, blocking sound/silent-button/
A-release close commands, persistent HideObject keys and immediate collision refresh.
13 new primitive tests plus the existing 67 controller tests pass unchanged. Typecheck
clean; no-ROM suite 762 pass / 81 skip (843 total). Commit `2e787c3`.

Checkpoint 3: the three pickup builders, hidden-event/bookshelf/sign/NPC priority,
found-item fallthrough, saved `hiddenObjects` and restoration on every map load, new-game
reset, and removal of the unused free-move hidden-item copy. The runtime `NpcData` now
declares the `item` field already emitted by V1a; interaction handling is typed.
16 integration/data tests include ASM strings, real-engine 73/181-update jingle traces,
frozen NPCs, held A, full bags, save/reload and freed collision, Route 1's flag-first quirk,
and a 19-map overlap check. Typecheck clean; no-ROM 778 pass / 81 skip (859 total).
Commit `f7d49ca`.

Checkpoint 4: five more regressions drive selected duplicate stacks through field
toss/healing and battle ball/Potion/Antidote input. Updated CLAUDE, context and
overworld/story/text architecture docs; appended implementation handoff to the plan.
Final verification: **864/864** (36 files) with ROM; **783 pass / 81 skip** without ROM;
strict typecheck and production build clean. `git diff --check` clean; no generated
data, extractor, reference or art changes; no ROM gate/test hooks in the bundle.

Browser: real key input on temporary port 5181, with test-only access injected into
the served module outside the repository. Passed ball/hidden pickups, held A,
full-bag waits, split stacks, flag/follow-up behavior, save/reload/CONTINUE and freed
tiles, both Route 2 balls, Route 1's sample success/failure and the Mart's no-charge
refusal. The 5173 save/server were untouched. Prepared two Route 2 staged saves
(empty bag, Lv5 Pikachu, balls present) and loading/restore instructions in
`C:/Users/ajfm88/AppData/Local/Temp/pkmn-a1b/` (plan §10).

All four checkpoints committed locally; no push. Deferred findings stay in the
plan's §8 (A5 text endings/paging, J2/A3 cursor resets, A2 full item table, later
jingle sites/coins). **Awaiting Claude review, then the user's §7 play-test.**

### 2026-10-06 (notes renumbered) — Claude Opus 5.5

At the user's request, renamed the 18 files in `notes/` in the order they were first
committed, `01-r1a-graphics-export.md` … `18-a1b-plan.md` (`git mv`, history kept), and
rewrote all 207 references in tracked files, code comments included. New files take the next
number (CONVENTIONS → *Free to write*); A1b's review will be `19-a1b-review.md`. No code
changes. Typecheck clean; no-ROM suite 731 pass / 81 skip.
**Next:** unchanged: Sol implements `notes/18-a1b-plan.md`, then Claude reviews.

### 2026-10-06 (A1b plan) — Claude Opus 5.5

Planned A1b at the user's request: `notes/18-a1b-plan.md`. Probed `PickUpItem`, `HiddenItems`,
`DisplayTextID` / `HoldTextDisplayOpen` / `WaitForTextScrollButtonPress`, `TextCommand_SOUND`,
`AddItemToInventory_` / `RemoveItemFromInventory_` / `RemoveItemByID`, the Mart and PC
callers, `Route1PrintYoungster1Text`, and the overworld's A-press order. Findings:
- The bag rule's quirk: the room check happens at the *first* overflowing stack.
- Route 1's sample sets its flag before the give (a full bag loses the Potion); ours sets
  it on success, with invented texts.
- The ASM checks hidden events before signs and sprites; no tile on today's maps differs.
- **Every overworld `done` text closes silently, on A's release**, where ours beeps and
  closes on the press. Logged in the plan's §8 with a proposed home (A5, O-14.5).
No code changed. Tests not run (planning only; baseline 812/812 from A1a).

Five tracked files in `game/` (`index.html`, `package.json`, `tsconfig.json`,
`vite.config.ts`, `vitest.config.ts`) were missing at session start; the user restored them,
and the tree is clean again.
O-14 resolved (DECISIONS #41): Sol implements, Claude reviews; decisions 1–5 as recommended.
**Next:** Sol implements `notes/18-a1b-plan.md` in its four checkpoints (commit each), then
Claude reviews into `notes/19-a1b-review.md`, then the user's play-test (§7).

### 2026-10-06 (A1a independent review passed) — Codex

At the user's request, reviewed Claude Opus 5.5's A1a implementation through
`142f68f` against the approved plan, DECISIONS #40 and pinned Yellow assembly.
**No actionable findings within A1a's agreed scope.** Review:
`notes/17-a1a-review.md`. Independently verified **812/812** with the ROM,
**731 pass / 81 skip** without it, TypeScript + production build, the four-file
generated-data diff and clean diff whitespace. A separate temporary probe of
the actual public API passed preload/synchronous playback, successful pending
loads, failed-load wait cleanup and channel-8 drum cancellation. No engine,
generated-data or committed-test changes.

The documentation-only ear-test commit `142f68f` arrived during the review;
its recorded user verification is preserved. A1a remains done.
**Next:** plan A1b, item balls and hidden items (`notes/07-a1-plan.md` §2.2).

### 2026-10-06 (A1a user-verified → done) — Claude Opus 5.5

Started the dev server on `127.0.0.1:5173` for the ear test (`notes/16-a1a-plan.md` §7). The
user: "yes, i can hear the difference, very high fidelity and very close to what the game boy sounds like". **A1a is done and user-verified.** No separate
code review was requested. Context files updated (STATUS, PLAN, PROJECT, root CLAUDE.md,
the plan's result note). No code changes.

**Next:** A1b, item balls and hidden items (`notes/07-a1-plan.md` §2.2), which uses
`playSFX('get_item1' | 'get_item2')` and `isSoundFinished()`. Plan it first. Then A1c, A5,
V2.

### 2026-10-06 (A1a implemented) — Claude Opus 5.5

The user: "ultrathink and implement the plan yourself… I reply yes for all of them"
(DECISIONS #40, O-13 resolved). Implemented `notes/16-a1a-plan.md` in its four checkpoints,
one commit each:

1. **Data** (`3a4fabb`): music mode after `execute_music`, the two headers. The diff was
   exactly the 2 JSON files and their mirrors; setup ran twice byte-identical. +7 ROM tests
   (the sym addresses, pret's asm parsed directly). The `static_export` timeout.
2. **The move** (`732aa12`): `SoundChannel` extracted. 94 per-update synth traces (every
   track, alone and with SFX) identical before and after.
3. **The rules** (`75166d2`):
   - channel by id, SFX tempo $0100, the note arithmetic;
   - perfect pitch, vibrato (rate 0 included);
   - the wave octave and the per-note wave reload;
   - suppression, release instead of restore, music before SFX;
   - drum occupancy of channel 8;
   - `isSoundFinished()`, the preload, `_playSFX`.

   +18 tests.
4. **The jingles, the wait, drums, SFX-mode timing** (`8b1691e`): +11 tests. Docs.

**Beyond the plan:**
- **Rests now stay silent.** The old fade turned a decaying note back on mid-rest; this was
  demonstrated on the old code.
- **Pitch slides** skip vibrato and end at the next note.
- **Defaults are the init routines'**; checked neutral.

Details are in the plan's result note.

**Checks:** typecheck clean; **812/812** (33 files); no-ROM **731 pass / 81 skip**; build OK
with no test-rig code in the bundle; `git diff --check` clean.

**Browser** (agent, :5179, tab and server closed): the Forest + `_playSFX('get_item1')`
gave exactly the unit tests' register writes, the Forest's notes back from 83 and tempo
144. `get_item2` ended after 181 updates. No console errors. Not checked by ear.

**Next:** the user picks a reviewer, then plays the ear test (`notes/16-a1a-plan.md` §7: the
Forest jingles, deeper bass everywhere, the battle bass's wobble, A-button beeps over music,
the title-screen drums). Then A1b.

### 2026-10-06 (code read → findings logged → A1a plan) — Claude Opus 5.5

**Read** every context file and the engine, then ran the checks:
- typecheck clean;
- first full ROM run **775/776**: the `static_export` flake recurred. The next three
  runs were 776/776, and the test passes alone in 0.46 s.

**Findings logged** (the user: "fix those 5 problems … by noting them in the context
files"), committed as `f6ff8a1`:
- STATUS → *Found during the 2026-10-06 code read*:
  - the damage formula's missing stat scaling and misplaced 997 cap;
  - the garbage `pokefluteinbattle.json`;
  - sprite slot order on three maps, and walking Daisy;
  - the flake's recurrence.
- PLAN's V5 and E1 rows point at them, and PROJECT's stale "Next: A6e" is fixed.

**A1a plan** (planning only, no code): `notes/16-a1a-plan.md`. It is read from the whole of
`audio/engine_1.asm`, the init routines, `home/audio.asm` / `delay.asm` / `text.asm`, and
every bank's copy of both jingles. Key results:
- The jingles last 72 and 180 frames on every channel.
- An SFX's `tempo` never reaches the music (`SetSfxTempo` forces $0100). Our one global
  tempo would make the Forest music run 1.8× after a pickup.
- The interpreter the jingles need ignores perfect pitch, gets vibrato wrong (rate 0 =
  off), and plays the wave channel **an octave high in every track**.
- `WaitForSoundToFinish` waits on channels 5, 6 and 8. Music drums are noise-instrument
  SFX on channel 8, so a drum hit can hold the wait a frame.
- The plan has 7 decisions (O-13) and four checkpoints.

**Next:** the user answers O-13 and names the implementer. Then implement
`notes/16-a1a-plan.md` §6, review, and the user's ear test (§7).

### 2026-10-05 (A6e re-review) — Codex

Re-reviewed Claude's `128d7f8` against R-1/R-2 and Yellow's ASM. Both findings
are resolved; N-1's canvas and draw-order coverage is present, and the EOF
whitespace is cleaned. Independent checks: 776/776 with ROM, 702 pass/74 skip
without, TypeScript/Vite build clean, `git diff --check 0c51262 HEAD` clean.
Verdict and evidence: `notes/15-a6e-review.md` → *Re-review*. No browser check.

**Next:** the user runs `notes/14-a6e-plan.md` §9's play-test. Keep A6e open until
that result is verified; then mark it done before starting A1a.

### 2026-10-05 (A6e independent review) — Codex

Reviewed `f013fd1` against the A6e plan and Yellow source; results are in
`notes/15-a6e-review.md`. Re-ran 767/767 ROM tests, 693 pass/74 skip without ROM,
the production build and setup; tracked generated files stayed unchanged.
Three temporary focused fixtures failed on the two reported source mismatches
and were removed. `git diff --check f4ae41a HEAD` also found a blank EOF line
in `ui_entry.test.ts`; clean it on revision. No browser play-test claimed.

**Next:** Claude fixes R-1/R-2 with regression tests, rechecks sprite-priority
rendering, and requests re-review. Then the user runs the A6e §9 play-test.

### 2026-10-05 (A6e done → A6 done) — Claude Opus 5.5

Codex's re-review of the revision `128d7f8` passed with no blocking findings
(`18732e7`, `notes/15-a6e-review.md` → *Re-review*). The user then play-tested A6e:
**A6e is done and user-verified, and with it milestone A6** (A6a–A6e). Context files
updated (STATUS, PLAN, PROJECT, root CLAUDE.md). No code changes.

**Next:** A1a, music-mode SFX and the item jingles (`notes/07-a1-plan.md` §2.1), then A1b,
A1c (which owns the hop-midpoint map scripts and trainer sight after landing), A5, V2.

### 2026-10-05 (A6e revision: review R-1, R-2, N-1) — Claude Opus 5.5

Fixed Codex's review (`notes/15-a6e-review.md`) in one local commit.

- **R-1:** the nurse's facing save/restore no longer depends on Pikachu being drawn.
- **R-2:** the interpreter now uses screen-pixel and map bytes (+4 border), each write
  wrapping; the follower converts at the call with the player as the fixed anchor.
- **N-1:** `spriteDrawOrder` for the scene's OAM order, and a canvas-spy test of
  `drawShadowUnderSprites`. The EOF blank line is removed.

**Checks:** typecheck clean; **776/776** with ROM_PATH (31 files), **702 pass / 74 skip**
without; build OK; `git diff --check` clean. No browser check.

**Next:** Codex re-reviews; then the user's play-test (plan §9).

### 2026-10-04 (A6e implemented) — Claude Opus 5.5

The user: "notes\14-a6e-plan.md pls ultrathink, plan and implement this plan". Implemented
Codex's plan in its three checkpoints, verifying its claims against the ASM first.

- **1 (`0a89455`):** `pikachu_movement.json` (63 records, SineWave_3f, ten programs) and the
  pure runner. Sol's durations (37/69/67/35), sine traces and the subtimer bug all
  checked by hand. **Correction:** Viridian's program is at 3c:5a0a (the `ld hl` operand
  of `ViridianCityMovePikachu`), not 3c:5e2b.
- **2 (`1a7231f`):** the follower's own map position and step-vector moves; the stand-in
  queue and its arc removed; TryApply for Viridian and the lab (whose step was missing);
  the nurse rebuilt from `DisplayPokemonCenterDialogue_`. **Correction:** spawn state 5
  only places a starter that wasn't out (its readers need movement status 0), so a healthy
  Pikachu stays where its walk ended; CloseTextDisplay restores its saved facing.
- **3 (`89f620b`):** the emotion phases — entry turn, movement prelude, border
  (Delay3, covered update, Delay3), portrait.

**Checks:** typecheck clean; **767/767** with ROM_PATH (30 files), **693 pass / 74 skip**
without; build OK; setup twice byte-identical (only the new JSON); the A6d following
hash still matches. **No browser check was run.**

**Next:** an independent review (the user's choice of agent), then the user's play-test
(plan §9 plus the *Implementation result* notes). Then A1a.

### 2026-10-04 (A6e plan) — Codex (Sol)

Read the updated context, subsystem architecture notes, A6d plan/review and the
full Yellow movement interpreter plus its callers. Wrote `notes/14-a6e-plan.md`:
all 63 records, ten current programs, two-frame command holds and one-frame
return, explicit map/pixel state, the native animation subtimer bug, integer
sine hops, swapped sprite priority, shared shadow composition and caller-owned
refreshes. Includes Viridian, the missing lab parcel-return call, nurse and five
ordinary emotion movement preludes; three implementation checkpoints, exact
timing fixtures, regression checks and a user checklist. O-12 proposes bounded
emotion work and nurse outer choreography; implementation remains unassigned.

Read-only ROM probes matched the entire ASM database uniquely at `fd3b0`,
verified all ten programs and sine data at `fd938`, produced three integer hop
traces and confirmed the two shadow banks have identical bytes. **N-2 timing
correction:** `Func_6ebb(15,0)` directly writes Pikachu's image after fighting-fit
text; the subsequent Delay3 publishes it before the bow, not after its 40-frame
wait. §7 requires a focused image/OAM call trace during implementation/review.

**Verification:** documentation diff/whitespace checked. No setup, engine edits,
game tests or browser play-test performed in this planning session. The reviewed
baseline remains **729/729**, no-ROM **657 pass / 72 skip**. Plan and handoff are
committed locally in this session's A6e planning commit.

**Next:** the user settles O-12 and the implementer; then implement this plan,
independent review and user play-test. A6e stays open; A1a–c follow it.

### 2026-10-04 (A6c + A6d done) — Claude Opus 5.5

The user played the combined A6c/A6d checklist on `http://127.0.0.1:5173/` (the dev
server wasn't running at first; started with `npx vite --host 127.0.0.1 --port 5173
--strictPort`): "it works, it is all looking good". **A6c and A6d are done and
user-verified.** Context files updated (STATUS, PLAN, PROJECT, ARCHITECTURE,
CONVENTIONS, root CLAUDE.md). No code changes.

**Next:** Sol (Codex) plans A6e (`ApplyPikachuMovementData`). Then A1a–c, A5, V2.

### 2026-10-04 (A6d + A6c R-3 review) — Claude Opus 5.5

Reviewed Sol's A6d (`4166071`, `7384386`) against `notes/12-a6d-plan.md` and the ASM, and
A6c's R-3 fix (`9897020`). **Approved, no blocking findings** (`notes/13-a6d-review.md`).

- Re-ran everything: typecheck clean, **729/729** with `ROM_PATH`, 657 pass / 72 skip
  without, build OK, `git diff --check` clean, generated output = `shadow.png` only.
- Reproduced Sol's ordinary-following regression hash on the pre-A6d code in a scratch
  worktree (removed afterwards): identical, 0 of 240 passes differ.
- R-3: bit 7 is served on every eligible update, and talking to Pikachu opens in source
  order. `DisplayTextIDInit` saves facings after its `UpdateSprites`, so closing keeps
  the turn.
- Notes: N-1 (an extra refresh after the nurse walk, not in the ASM, no visible effect)
  and N-2 (when Pikachu reappears after a heal) → A6e. Carry-over: trainer sight before
  the landing → A1c (already its job).

**Next:** the user's combined play-test (`notes/10-a6c-plan.md` §10 + `notes/12-a6d-plan.md`
§9). On success, mark A6c and A6d done, then plan A6e.

### 2026-10-04 (A6d implemented) — Codex

Implemented `notes/12-a6d-plan.md` after the user's go; all three O-11 recommendations
recorded as DECISIONS #38. Kept the concurrently committed start-condition update
`530363c`: Claude reviews A6d and A6c's R-3 on `9897020` together.

- Native 16-command buffer, retained newest command, literal bit-6 toggle at both hop
  halves; no position-buffer teleport. Pikachu stops at takeoff, then crosses two tiles
  in eight flat 4px updates on the next step. Ordinary catch-up threshold matches ASM.
- Landing UpdateSprites at armed+34, 1-frame hold, continuation at +37 and next pass
  at +39. Landing blocks input/map scripts/interaction; script pushes clear the shadow
  before their next command. Both simulated step boundaries stay unchanged.
- Extracted the ROM shadow and composed its mirrored tile with a player alpha mask,
  after grass overlay. Setup: 520 PNGs / 3 tilemaps / 164 JSON. Generated diff is only
  `game/static/gfx/overworld/shadow.png`; no JSON changed.
- Separate script targets retain the nurse arc; state-5 heal placement and completed
  scripted moves refresh native following. Interpreter deferred to A6e as agreed.
- Added 24 tests. The 30-step ordinary pixel trace matches the original committed
  follower; a seeded 200-step walk keeps at most two commands. Temporary probes removed.

**Checks:** typecheck/build clean; ROM suite **729/729**, 29 files; no-ROM suite
**657 pass / 72 skip**; `git diff --check` clean. No browser or user play-test claimed.
Implementation commit **`4166071`** (`A6d (1/2): native Pikachu following, ledge shadow
and landing pass`). The follow-up `A6d (2/2)` commit records this exact hash and handoff.

**Next:** Claude reviews the A6d implementation against the plan and ASM plus A6c R-3.
Then the user play-tests `notes/12-a6d-plan.md` §9 and `notes/10-a6c-plan.md` §10 together.
Keep both slices in progress until those gates pass; do not start A6e or A1 yet.

### 2026-10-04 (A6d plan) — Claude Opus 5.5

Planning only; no engine, data or test changes. The user asked Claude to plan the next
slice for Sol (Codex) to implement, with Claude reviewing afterwards. Wrote
`notes/12-a6d-plan.md` from the ASM (`ledges.asm`, `_HandleMidJump`, `sprite_oam.asm`,
`pikachu_follow.asm`'s buffer routines) and the current code.

What it found:

- **The user's ledge report is the follow model.** Yellow appends one hop command (5–8)
  per ledge, on the first half (`Func_fcc64`'s bit-6 toggle). With nothing behind it,
  the command can't be popped. So Pikachu waits on the takeoff tile and, on the player's
  next step, moves 2 tiles in 8 updates of 4 px with no arc. Upstream queues the ledge
  tile itself, with a sine arc. gen1recomp reads it the same way as this plan.
- **The landing pass runs one more `UpdateSprites`** at a+34, before `Delay3`. Ours
  skips it; the standing pass at a+37 is already right.
- **The shadow:** 06:6893, 8 bytes = pret's `shadow.png`, one tile drawn twice (the
  second mirrored) at screen (64,72). It sits above grass and below every sprite pixel.
  A probe of today's maps: 186 ledge spots, 27 land on grass, none on a warp or across a
  connection.
- **Native fast-follow** needs three or more steps of lag (upstream: two). Every place
  that puts Pikachu somewhere must refresh the buffer; the Pokécenter's `showPikachu`
  doesn't today.
- `ApplyPikachuMovementData` is its own ~1000-line interpreter with four users on our
  maps (one of them, Oak's Lab's Pikachu step, missing from our port) → proposed A6e.

**Next:** the user answers O-11. Sol implements A6d right away; the user dropped Codex's
separate A6c re-review. Claude then reviews A6d, including A6c's R-3 fix, and the user
play-tests A6c (§10) and A6d (§9) together.

### 2026-10-03 (A6c revision 2: re-review R-3) — Claude Opus 5.5

Fixed R-3 from Codex's re-review (`2eff68a`), one local commit.

- The face-player request (bit 7) is now served by the first update that finds Pikachu
  on screen, ordinary or font-loaded (`Func_fc745` sits before both dispatches in
  `SpawnPikachu_`). A box covering Pikachu only defers it.
- Talking to Pikachu opens in source order (`ui_entry.ts` `openOverworldUi`): the
  borderless DisplayTextIDInit update on the bare map (the turn), then the portrait box
  (`PlacePikapicTextBoxBorder`) and its update, which hides Pikachu under it.
- The surrogate test (bottom text box standing in for the portrait) is replaced:
  `ui_entry.test.ts` captures the real `renderPikachuEmotionBox` from all four sides.

**Checks:** typecheck clean; `ROM_PATH` suite **705/705 in 27 files**; without it 634
pass / 71 skip; build OK; `git diff --check` clean.

**User play-test report (same day):** after hopping a ledge, Pikachu lands on the
ledge row and trails a step further behind. Probed through the real controller on both
`1854ef1` and the current code: identical traces, so it predates A6c. It's upstream's
ledge-follow approximation → recorded under **A6d**.

**Next:** Codex re-reviews; then the user's plan §10 play-test.

### 2026-10-03 (A6c re-review — R-1/R-2 resolved, R-3 requested) — Codex

Reviewed Claude's exact revision **`4d3c407`** against parent `47a940e`, the
previous findings and read-only Yellow ASM at `e89ead15`. The original START
clipping and ordinary text/nurse antic-reset cases are fixed. Inspected all
changed files, the actual UI capture/entry path and Pikachu conversation
entry/exit. Added the latest verdict/evidence to `notes/11-a6c-review.md` and the
plan. No engine/data/assets/config changes, reference refresh, browser/server
or save manipulation.

**One new P2 finding, R-3:** the real centered Pikachu face box covers all four
normal adjacent follower positions. The new pending turn returns at the
availability guard, and ordinary updates never handle it afterward. Pikachu
can reappear facing its old direction and turn later during unrelated text.
The new controller test substitutes the bottom dialogue box for the portrait,
so it misses the regression. An independent Node probe used actual
`captureUi(renderPikachuEmotionBox)` and the live follower/UI helpers: two
expected-behavior assertions failed, reproducing the skipped and delayed turn.
Scratch source/bootstrap/bundle lived outside the repository and were removed.
ASM requires the bit-7 branch before ordinary as well as font dispatch, and
initializes Pikachu text without a border before drawing the portrait.

**Independent checks:** typecheck clean; ROM-enabled **699/699 in 27 files**,
default timeout; without ROM **628 pass / 71 skip**; build OK (97 modules,
308.65 kB / 88.56 kB gzip); `git diff --check` clean. No browser/user play-test
claimed. R-1/R-2 retained as resolved; existing deferred issues keep their homes.

**Next:** Claude fixes R-3 using the review's focused instructions and actual
portrait regression tests, then Codex reviews that exact follow-up. User
plan §10 play-test follows a passing review; A6c stays in progress. Commit
review documentation locally; nothing pushed.

### 2026-10-03 (A6c revision: review R-1, R-2) — Claude Opus 5.5

Fixed both findings of `notes/11-a6c-review.md`, one local commit on `47a940e`.

- **R-1:** `pikachuCovered` (`sprite_visibility.ts`) ports `WillPikachuSpawnOnTheScreen`'s
  footprint ((Y + 4) & $f0 rows, (X + 2) >> 3 columns, bounce included). The follower
  checks window + UI before any dispatch (hidden, frozen, no RNG) and its `render` hides
  the whole sprite under UI from the first frame.
- **R-2:** `PikachuFollower.fontLoadedUpdate` = `SpawnPikachu_` with the font loaded:
  the screen check first, then `Func_fc745` for a talked-to Pikachu (bit 7, set by the
  controller's `requestFacePlayer`) or `Func_fc76a` (standing image, screen position
  back on the map position, ready, countdown 0, follow command reseeded). `main.ts`
  runs it once per UI opening (`overworld/ui_entry.ts`: closed → open), with the boxes
  captured in the tick. The nurse's `pikachuToNurse` runs it first, with no UI (the ASM
  reloads the map view before that UpdateSprites).
- A Pikachu covered mid-bounce stays invisible until the bounce ends — `asm_fc87f`
  never redraws the image. Pinned by a test.

**Checks:** typecheck clean; `ROM_PATH` suite **699/699 in 27 files**; without it 628
pass / 71 skip; build OK; `git diff --check` clean. No browser run.

**Next:** Codex re-reviews the revision; then the user's plan §10 play-test.

### 2026-10-03 (A6c independent review — changes requested) — Codex

At the user's request, reviewed Claude's implementation **`22919a7`** against
the A6c plan, engine baseline **`1854ef1`**, and read-only Yellow ASM at
`e89ead15`. Read the changed engine/tests/docs and traced actual menu, text and
script callers. Added **`notes/11-a6c-review.md`** and appended the verdict to the
plan. No engine/data/assets/config changes, reference refresh, browser/server
or save changes.

**Verdict: two P2 fixes required.** R-1: Pikachu has the map-window guard but
omits `WillPikachuSpawnOnTheScreen`'s UI footprint guard; a bounce can expose
opaque pixels beside START, and covered sprite passes lack native hide/freeze
behavior. R-2: text/START entry omits the font-loaded `Func_fc76a` transition;
an uncovered antic remains suspended during UI and resumes afterward. The
nurse's already-above-player path also bypasses direct movement/reset. The
review specifies source ordering, fixes and permanent integration regressions.
Core NPC byte/displacement/rest rules, ordered collision geometry, transient
trainer override, antic helpers and player obstruction gate passed review.

**Independent checks:** typecheck clean; ROM-enabled suite **681/681 in 26
files**, default timeout; without ROM **610 pass / 71 skip**; build OK;
`git diff --check` clean. Four temporary deterministic UI/font probes each
failed an expected-behavior assertion, reproducing R-1/R-2; probes removed,
evidence recorded in the review. Inspected source sprite pixels for the START
edge example. Existing NPC image lag and map metadata discrepancies remain
separate follow-ups; no browser or user play-test was claimed.

**Next:** Claude resolves R-1/R-2, records the exact revision/checks, then Codex
re-reviews before the user's plan §10 play-test. A6c stays in progress. This
review ends in a local documentation commit; nothing pushed.

### 2026-10-03 (A6c implementation) — Claude Opus 5.5

**Implemented `notes/10-a6c-plan.md` in one local commit** (`A6c: …`, on `1854ef1`).
Re-read the plan's ASM anchors first (`movement.asm`, `sprite_collisions.asm`,
`pikachu_follow.asm`, `home/overworld.asm`, `npc_movement_2.asm`).

- NPCs: live movement bytes; the direction byte on every try (STAY and fixed too); STAY
  fails into a random rest, so NONE sprites turn in place; displacement bytes 8/8 with no
  origin box; the screen edge in the GB basis; pixel collision masks in slot order
  (`overworld/sprite_collision.ts`, `sprites.ts`); claimed-tile blocking and the old
  wander rules are gone.
- Beaten map trainers turn at random for the current visit (not rivals, not Tower 7F).
- Pikachu: retained follow command, the 256-then-32 glance countdown, the four antics
  with the reverse bounce table as a screen offset (`pikachu/pikachu_idle.ts`), an image
  latch, equality-compared animation counters; scripts moving Pikachu directly never idle.
- Turning into Pikachu: the counter arms 8, seven blocked checks, B bypasses.

**Checks:** typecheck clean; `ROM_PATH` suite **681/681 in 26 files**; without it 610
pass / 71 skip; build OK; `git diff --check` clean. No browser run — the user
play-tests (§10 of the plan; A = Z, B = X).

**Found:** map metadata that disagrees with pret's `object_event` bytes — Route 1's two
youngsters and the Viridian Pokécenter gentleman should be axis-limited walkers;
Viridian's `oldman2` should be NONE. Data fix, not this slice (detail in the plan's
result note; proposed home V5 or a small data slice).

**Next:** Codex reviews (`notes/11-a6c-review.md`); then the user's play-test. A6c stays
in progress until both are recorded.

### 2026-10-03 (A6c research and implementation handoff) — Codex

**Plan only, at the user's request.** Read the context and project Markdown,
then traced A6c against Yellow ASM and current movement, collision, battle-return,
Pikachu and script code. Added `notes/10-a6c-plan.md`; linked it from the old A6
sketch. The user assigned implementation to Claude Opus and review to Codex.

Key refinements: Yellow removed the positive wander cap but retains unsigned
displacement bytes; direction selection consumes RNG even for fixed STAY;
collisions use pixel/vector geometry and ordered sprite updates; defeated-trainer
turning is transient for the current map visit; Pikachu's four antics use a
retained follow command, byte-wrap idle countdown and immediate entry update;
the bounce retains its displayed image while its live facing changes; interrupted
antics carry byte/equality animation counters into following; the armed
obstruction blocks seven eligible checks before the eighth passes.
No engine/data/assets changed, no browser/server/save changes, no ref refresh.

**Baseline checks:** typecheck clean. Default ROM-enabled tests: 569 pass plus
the previously observed cold static-export 5-second timeout. That file passed
6/6 in isolation with a 20-second CLI timeout; the full suite then passed
**570/570 across 23 files** with the same override. No timeout/config edits.
No production build run was needed for this documentation-only slice.

**Next:** Claude implements `notes/10-a6c-plan.md`, records its exact commit and
validation, and leaves **A6c awaiting Codex review**. Codex then reviews the
implementation and writes `notes/11-a6c-review.md`; user play-test follows. A6c is
not done. This planning slice ends in a local documentation commit with the
project's co-author line.

### 2026-10-01 (A6b review → play-test → done) — Claude Opus 5.5

- **Review:** interim pass on the working tree, then the final review of `eac3dd3`
  (`notes/09-a6b-review.md`, committed `2e9e765`): 570/570, typecheck and build clean.
  Sol fixed R-1 (the menu footprint was one tile row high) and N-1 (Indigo Plateau).
  F-1 (the overworld is drawn 4 px above the Game Boy's), N-2, N-3 and N-5 are logged
  with homes.
- **The user play-tested §5.3-8: "all working well". A6b is done.**
- **Next:** A6c (NPC wandering and turning), another day. Probe `notes/08-a6-plan.md`
  §2.3 against the code first.

### 2026-10-01 (A6b implementation) — Codex

Implemented `notes/08-a6-plan.md` §5.3 and all four approved decisions. Standing passes
run map scripts before input; step end counts → updates Pikachu → rolls → checks
warps/connections. Turn encounters, two calm post-battle steps, simulated hop
halves/door exits, the indoor rule, NPC window/pop-in and whole-sprite UI masking,
retained talk-facing and the fixed STAY delay cycle are wired and tested.

**ASM clarifications:** only EnterMap resets the step counter and active cooldown;
seamless connections preserve them. WALKING's `$80` mood target does nothing, so
the per-step drift is exactly one even when the 256-step bonus wins. Oak's in-step
routine still refreshes animation while the player moves. The result note records
these details and the refreshed gen1recomp cross-check.

**Checks:** typecheck clean; **570/570** with ROM_PATH; production build OK;
without ROM_PATH **499 pass, 71 extraction checks skip**; diff whitespace clean.
68 tests added. Runtime remains static-file-only; no extractor/data/static changes.
The existing refs-refresh commit (`164d4bf`) was preserved.

Claude's interim review file appeared while implementation was in progress. Its
R-1 menu-footprint bug and N-1 classifier omission are fixed and tested; N-4's
catch-demo path is ASM-verified. Off-slice findings are logged above. The review
file itself was left untouched; the final committed diff still needs re-review.

**Claude's final review (2026-10-01): passed.** `notes/09-a6b-review.md` → *Final review*:
570/570, typecheck and build clean; R-1 and N-1 fixed; the WALKING mood and starter
checks verified against `ModifyPikachuHappiness`; the UI capture covers every state the
old render branch drew. The one small gap (the OT check) falls under the already-logged
Pikachu state audit. **A6b now waits only on the user's play-test of §5.3-8.**

**Handoff (as written before the review):** A6b is **awaiting review**. Claude reviews the local implementation diff
from `164d4bf`; then the user performs §5.3-8's browser checks. The agent did not
drive those checks, per §5.5. Log review/play-test outcomes before claiming A6c.

### 2026-10-01 (7th session: repo check → stale-line fixes) — Claude Opus 5.5

**Repo check** (read-only): every *Setup* claim matched — git (`master`, no remote,
clean), ROM SHA1, the 5 refs on their pinned commits, 164 JSON / 19 maps / 57 wild /
47 music / 10 SFX / 520 PNG / 3 tilemaps, typecheck clean, **502/502** (the
`static_export` test that failed once last session passed in 1.7 s).

**Docs only, at the user's request ("pls fix the stale lines"):** the walk speed in
ARCHITECTURE (was 2 px/frame, 8 frames a step); the baseline label in CONVENTIONS
(after A6a, not V1e) and its key-poll note; PLAN's "35 sittings", A6 marked 🔨 and its
NPC step 32 → 34; this file's *Where things stand* date, the key-tap note (was 50 fps),
and the A6 slice note; a ⚠ note on DECISIONS #35 (NPC step 34). No code changed.

**A6a done.** Dev server on `127.0.0.1:5173`; the user played all 8 remaining checks
(`notes/08-a6-plan.md` → *Progress* → "Still to verify") and said "all 8 points work
perfectly". Logged as done, user-verified.

**A6b plan** (no code): `notes/08-a6-plan.md` §5. Key results:
- A6a already fixed the held-key triggers.
- Map scripts run on every standing pass, before input. Pallet's trigger has no facing
  check in the ASM.
- The step-end order is: step count → Pikachu happiness and mood → encounter → warps →
  connections.
- The walking happiness departs three ways: the counter resets per map, it's a 50% roll,
  and the mood drifts 1 toward 128 every step.
- **The post-battle cooldown is 2 calm steps, not 3**: the count reaches 0 before the
  third step's roll.
- The ledge hop is two simulated steps: no count, no encounter.
- Sprites outside the 4/5-step window aren't drawn and pop in after a step. A sprite with
  any tile under a text box or menu is hidden whole.
- NPCs keep facing you after a talk. Fixed-facing STAY NPCs turn back after a random
  1–256-pass delay.
- Grass priority checked: no change needed.
- 4 decisions (O-10).

**Decisions:** the user said yes to all four (DECISIONS #37) and assigned A6b's
implementation to **Sol 6.1**, with Claude reviewing. `notes/08-a6-plan.md` §5.4 is marked
decided, and §5.5 adds notes for the implementer. The dev server was left running on
`127.0.0.1:5173` for the user.

**Refs refreshed** (`./pull-refs.sh`, at the user's request): `gen1recomp` +165 commits
(`20ab97ab`, including changes to its Yellow overworld, Player and Pikachu follower
files, now noted in `notes/08-a6-plan.md` §5.5), `engine` +13 (`79957401`, a Zig toolchain
update with no Gen 1 logic change). The other three were already current. All five are
clean and on their pinned branches.

**Next:** Sol 6.1 implements A6b (`notes/08-a6-plan.md` §5.3 + §5.5) and leaves it
"awaiting review". Then Claude reviews the diff, and the user play-tests §5.3-8.

### 2026-09-27 → 28 (6th session: A1 plan → A6 plan → A6a) — Claude Opus 5.5

**A1 plan** (no engine code): `notes/07-a1-plan.md`. It is read from `pick_up_item.asm`,
`hidden_items.asm`, `inventory.asm`, `trainer_sight.asm`, `home/trainers.asm`,
`emotion_bubbles.asm`, `movement.asm` and `home/overworld.asm`, the item jingles' audio
headers, and gen1recomp's sight and movement code. Key results:
- **The pickup needs its jingle, and nothing can play it yet.**
  - An item ball closes its "found" box by itself when `SFX_GET_ITEM_1` ends; a hidden
    item plays `SFX_GET_ITEM_2`.
  - Both are music-mode SFX (`execute_music`). The extractor misdecodes them after that
    command, and the SFX engine can't play notes. The music engine can, and A1a would
    reuse it.
- **Hidden items depart from the ASM three ways:** the order, the jingle and the
  bag-full text.
- **`GiveItem`'s 99-per-slot rule is missing.** Upstream stacks grow past 99.
- **Trainer sight, as the ASM does it:**
  - It is checked at the start of every overworld pass while the player isn't
    mid-step, before input. So a trainer also spots a player who is standing still,
    for example right after a wild battle.
  - The math is in 8-bit screen pixels, and the trainer must be on screen.
  - Two quirks follow. A down-facing trainer can't see exactly 4 steps (the $fc wrap).
    And a trainer at the window's edge spots a player who keeps walking toward it one
    step closer (the sprite pops in one pass late).
  - The meet music starts at spotting. The "!" lasts 60 + 1 frames, and the walk-up is
    distance − 1 steps with collisions ignored.
- **Found: the overworld runs at 2×** (Notes for later). This is why the plan proposes a
  new milestone, A6, before the sight slice.
- The plan proposes **A1a** (the jingles) → **A1b** (item balls + hidden items) → **A6**
  (overworld pace) → **A1c** (trainer sight), with **6 decisions** (O-8).

**The unexplained test failure from O-5 came back and is fixed.**
- The suite failed 1 of 476 in the first run this session. A background loop caught
  it on run 64 of 150.
- The failing test was `damage.test.ts` › "power-0 moves return damage=0,
  missed=false". It rolled GROWL's accuracy with an unmocked `Math.random`, and Gen 1
  misses 1 in 256.
- Test-only fix: `mockRandomFixed(0.5)`, as its neighbours do. Typecheck is clean and
  the suite is **476/476**.

**Docs:** root `CLAUDE.md` had two stale test counts. Extraction is 65 (not 62), and
71 tests skip without `ROM_PATH` (not 68).

**Decisions:** the user answered "yes, pls do walking speed first, lol, that was bugging
me a lot". That takes all six recommendations, with A6 moved first (DECISIONS #35).
PLAN now has 36 milestones and the queue is A6 → A1a → A1b → A1c → A5 → V2.

**A6 plan** (no code): `notes/08-a6-plan.md`. It is read from `home/overworld.asm`,
`movement.asm`, `facings.asm`, `auto_movement.asm`, `pikachu_follow.asm`, the ledge and
jump code, and the encounter code. Key results:
- **The overworld has two clocks.** Frames drive text, waits, audio and battles. Passes
  of 2 frames drive everything that moves.
- **Per step:** the player 16 frames. A normal NPC takes 34 (a start pass + 16 × 1 px).
  Yellow's fast NPC codes (`$04`–`$07`, the lab rival) take 18. An NPC walking in
  step with the player (Oak's walk to the lab) takes 16. Pikachu 16, catching up at
  4 px per pass. Upstream takes 8 for all of them.
- **Found as well:**
  - Turning costs a pass only from a standstill.
  - The walking frames are mirrored for up and down, so the feet alternate.
  - Pikachu's walking animation is slower below 80 happiness.
  - The ledge hop has a height table and a shadow.
  - Turning in grass rolls an encounter.
  - No encounters for 3 steps after a battle.
  - NPCs keep facing you after a talk; they wander up to 8 steps up/left, unlimited
    down/right, never off screen; STAY NPCs turn in place.
- **The proposed split:** A6a (pace) → A6b (pass order, pop-in, encounters) → A6c (NPC
  wandering and turning) → A6d (ledge hop details), with 4 decisions (O-9).

**A6 decisions:** the user said "go", taking all four (DECISIONS #36). A6a is claimed.

**A6a — the overworld on the ASM's 2-frame pass** (code landed; browser verification
partial; see `notes/08-a6-plan.md` → *Progress*):
- **`overworld/walk_pace.ts`**, pure, with 26 tests: `PassClock`, `PlayerWalk`,
  `NpcWalk` (normal, fast and in-step modes), `WalkAnim` and the jump table.
  `Player`, `Npc` and `PikachuFollower` run it. `overworld/sprites.ts` holds
  `updateSprites()`.
- **Joypad:** `input.ts` reads it the ASM's way (`readJoypad` on standing passes).
- **Scripts** move only on passes. They gained modes for NPC steps and a parallel walk
  whose player part starts partway through.
- **Pallet:** Oak walks to the lab in step with the player.
- **Oak's Lab:** the rival's shove (fast steps, with the push starting on his last step)
  and his exit (2 normal steps, then fast ones).
- **Viridian:** the held-key workaround is removed, because the next step now starts on
  the pass after one ends.
- **Checks:** typecheck clean, **502/502**, build OK.
- **Browser (user's Chrome, temporary server :5179):** measured 2 px a pass, 8 passes a
  step, **15.99 frames a step**, plus the turning pass.
- **The user:** "he walks at a perfect, gb speed".
- **The user's find:** "oak BOLTS" — his legs flickered on the walk to the lab. My
  in-step frame came from the intra counter, following pret's comment; the code reads
  `ANIMFRAMECOUNTER`. Fixed and pinned by a test, not re-played yet.
- **Cleanup:** the temporary measurement hook was removed, the :5179 server stopped and
  its tab closed.
- **Also:** a Bash-classifier outage mid-session; PowerShell ran the same commands.
- **To watch:** after the session restarted, the first full run failed once, in
  `static_export.test.ts` › "static/ is up to date with the extractors". The error text
  wasn't captured. The test has no explicit timeout (vitest's default is 5 s) and reads
  all 848 files, so a cold file cache is the likely cause. It passed alone and in three
  full reruns, and A6a changes no extractor or data. If it shows up again, capture the
  message and consider a longer timeout for that test.

**Next:** finish A6a's browser checks (`notes/08-a6-plan.md` → *Progress* → "Still to
verify"): Oak's walk again, the lab scenes, the old man, the nurse, the Mart, a ledge,
NPC and Pikachu pace. Then log A6a as done and claim **A6b**.

### 2026-09-25 (5th session: O-5 → V1e plan → V1e) — Claude Opus 5.5

**O-5, the frame rate** (the user: "pls match the game boy 59.7"; DECISIONS #33):
- **Found first:** upstream's loop dropped its leftover time on every call, so the
  display refresh capped the rate. Its "50" ran 30 ticks/s at 60 Hz, 40 at 120 Hz,
  48 at 144 and 240 Hz, and 41.6 on the background worker. Changing the constant alone
  would still have given 30 on a 60 Hz display.
- `core/tick_clock.ts` has `GB_FPS = 4194304 / 70224` and a `TickClock` that keeps
  the remainder (the audio clock already did). `-`/`+` now step through multiples of
  5 with the Game Boy rate as a stop between 55 and 60, and the toast shows 59.73.
- +11 tests → **452/452**, typecheck clean, build OK.
- **Measured in the user's Chrome** (240 Hz display): **59.70 ticks/s over 20 s**,
  59.79 over 10 s. Upstream's loop gave 48 there, about 80% of Game Boy speed. This used
  a temporary tick counter on a spare port (:5179), which was removed before the
  commit, along with the test FPS key.
- **One unexplained test failure:** the first full run after the change had 1 failure
  in 452. The next 16 runs were all clean, and the failure wasn't captured.
  `tick_clock.test.ts` is deterministic and had just passed on its own, so this is
  probably an unmocked random roll in an older test. If it shows up again, note which
  test it is.

**V1e plan** (no code): `notes/06-v1e-plan.md`. It is read from `scripts/ViridianCity.asm`,
`ViridianCity_2.asm`, `OaksLab.asm`, `ViridianMart.asm` and the Pikachu movement engine,
and compared with gen1recomp's Yellow old man. Key results:
- **The city runs a saved state machine** (`wViridianCityCurScript`, 11 states). Only 0
  / 1 / 2 can be saved; 3–10 run with input locked. Only a new game resets it.
- **A Gen 1 quirk to keep:** the Gym-door push-back (32,8) sends the city to
  `POST_CATCH_TRAINING` from any state. That turns off the (19,9) old-man check, so
  before the Pokédex you can walk to Route 2 without one. Keeping it needs the state
  index saved (O-7).
- **The walk-away when you're not at x=19** is right *then* down 6 (`MovementData1` falls
  through into `Data2`). Pikachu steps aside (down, left, look right) only when it stands
  on the player's right. gen1recomp gets both wrong, and `notes/02-v1-plan.md` §2.5 had the
  first one wrong.
- **`EVENT_INITIAL_CATCH_TRAINING` stays set after the first demo;** only the repeat demo
  clears it.
- **Also missing upstream:** the sleeping man's push fires from any direction and when you
  talk to him (upstream: facing up only, no push on talk). The walking old man is missing
  `walkDir: left_right`. There is no Gym-door check.
- **Data changes** landing with V1e: +`oldman2`, oldman1's `walkDir`, no Route 22 NPCs,
  −`VIRIDIAN_OLDMAN_DEMO`.

**V1e** (`85b2c6b`; DECISIONS #34):
- The user said "do v1e as one slice". The other two decisions took their recommended
  defaults, and DECISIONS #34 says so.
- **Data:** +`oldman2`, oldman1's `walkDir: left_right`, no Route 22 NPCs,
  −`VIRIDIAN_OLDMAN_DEMO`. The regenerated diff was exactly those 3 files and their
  mirrors.
- **Engine:**
  - `story/viridian_city.ts` holds the state machine and the command lists.
  - `events.ts` gained map-script state, saved as `mapScripts`, with Viridian's state
    derived for old saves.
  - New script commands `clearFlag`, `setMapScript`, `pushPlayer` and `movePikachu`.
  - `player.update` takes a simulated input, and `PikachuFollower.forgetPlayerStep`
    was added.
  - Oak's Pokédex script sets the city to `AFTER_POKEDEX`, and the Mart hook sets
    `SPAWNED_OLD_MAN_1`.
- **Two bugs found in the browser and fixed:**
  - A push into the Gym ledge only bumped, where the ASM hops. That's why `pushPlayer`
    runs through `player.update`.
  - A held key carried the player onto the Gym door tile, because the next step had
    already begun.
- Tests 452 → **476**, build OK.
- **Browser:** the agent checked every row of the plan's verify list except the
  Pikachu step-aside (unit-tested) and the full Forest walk. **The user play-tested the
  forced demo and the repeat demo: "it all works as intended".** Test saves on
  :5179/:5180 were cleared and both servers stopped.
- (20,9) turned out not to be walkable; §1.2 of the plan is corrected.

**Next: A1** (item balls + trainer sight). See its slice note above. Plan first.

### 2026-09-24 (4th session: V1d plan → V1d) — Claude Opus 5.5

**V1d plan** (`bea1bce`, no code): `notes/05-v1d-plan.md`. It traces both battle types
through the ASM: `_InitBattleCommon`, `StartBattle`, `DisplayBattleMenu`
`.doSimulatedMenuInput`, `DisplayListMenuID` and `ItemUseBall`. Key results:
- **The frame counts:** HUD + 40, ▶ FIGHT 20, ▶ ITEM 20, 10 frozen, bag 3, ▶ POKé
  BALL 20, "used" text 20, then the toss.
- **The outcome rule:** PIKACHU is always caught. OLD_MAN fails only while
  `EVENT_INITIAL_CATCH_TRAINING` is set (`$63`: 3 shakes, a poof, the pic back).
- **Upstream's Pikachu catch departs in 8 places,** among them no menu, the HUD shown too
  early, and "caught" ending without an A press.
- **The normal wild catch has invented texts** and no toss animation (logged above).

**Decisions** (`821af24`): the user said "go" to all four (DECISIONS #32).

**V1d** (`1658e96`):
- `battle/catch_demo.ts` holds the rules and step list as tested data.
- `battle/catch_demo_screen.ts` is `pikachu_battle.ts`, moved with `git mv` and
  generalized to walk those steps.
- The script command is now `catchDemo` and the state `catch_demo`.
- `renderItemMenu` gained a `showCursor` option.
- New text key `BATTLE_PROF_OAK_NAME`; the regenerated data diff was that key only.
- Tests 429 → **441** (+11 catch demo, +1 extraction). Build OK.

**Browser check** (agent-driven, temporary server on :5179, test saves cleared, server
stopped). Oak's catch was staged from a Pallet Town save with no flags:
- "Wild PIKACHU / appeared!" with no HUD, then the HUD, ▶ FIGHT, ▶ ITEM, the bag
  "POKé BALL × 1 / CANCEL", ▶ POKé BALL.
- "PROF.OAK used / POKé BALL!" stays up through the throw, poof and shakes. The pic is
  hidden after the poof while the HUD stays.
- "All right! / PIKACHU was" waits for A, then "caught!", then the white screen and
  Oak's "Whew…". The walk to the lab and the lab scene follow unchanged.

The old man, through a **temporary hook** (Pallet's command switched to `OLD_MAN` /
`RATTATA`, reverted before the commit, `git diff` checked):
- With the flag set: the old man's back pic, "OLD MAN used / POKé BALL!", 3 shakes, a
  poof, the Rattata back, "Shoot! It was so / close too!", then back to the script.
- With it clear: "All right! / RATTATA was" → "caught!".
- RATTATA was marked seen (`isSeen(19)` read from the page). No console errors.

The user hasn't play-tested V1b, V1c or V1d yet.

**Next: V1e** (the real Viridian old man). See the V1 slice note above and
`notes/02-v1-plan.md` §2.5 / §3 V1e. Plan first.

### 2026-09-23 → 24 (3rd session: V1c plan → V1c) — Claude Opus 5.5

**V1c plan** (`02fb580`, plan commit, no code): `notes/04-v1c-plan.md`. It is read from the ASM
(`home/trainers.asm`, `TrainerBattleVictory`, `HandlePlayerBlackOut`,
`scroll_draw_trainer_pic.asm`, `scripts/OaksLab.asm`) and set against the upstream
code. Key results:
- **Meet music timing.** It starts when the before-battle text has finished typing,
  before the A press, because the text ends with `done`. On the sight path it starts
  at spotting (for A1).
- **Victory sequence, with frame counts.** The pic scrolls in 6 × 4 frames and stops
  at 112 px with its last column off-screen. After 40 frames comes "NAME: " + the
  won text, then the money. Every end text's first line fits in 18 characters,
  youngster5's exactly.
- **The lost-battle text is never printed** for map trainers. A loss doesn't set the
  beaten flag.
- **Three more upstream departures:**
  - the trainer fanfare plays at the *first* enemy faint;
  - losing to the lab rival blacks you out and strands the lab script;
  - map trainers get no battle transition.
- **Also found:** 5×5 enemy pics and the trainer intro pic sit 8 px right of the ASM;
  battle text isn't typed; beaten trainers should turn at random; the post-battle
  Pikachu mood floor is missing; `wRivalStarter` isn't recorded.
- **4 decisions** put to the user: the lab loss fix, recording `rivalStarter`, the
  meet-evil-trainer typo fixed in V1c, and a new slice **A5 Battle presentation**
  queued after A1.

**V1c decisions** (`439b402`): the user said "go" to all four (DECISIONS #31). A5 was
added after A1, making 35 milestones.

**V1c** (`753e50c`):
- The new module `battle/trainer_flow.ts` holds the rules as tested data.
- `Battle` runs its win/loss steps in a new `trainer_end` state.
- `main.ts` `engageTrainer()` covers talk and sight: text, meet music, battle. The
  beaten flag is set in the battle-finish handler, unless the battle was lost.
- In Oak's Lab the rival's texts are shown, a loss has no blackout, and `rivalStarter`
  is saved.
- `meeteviltrainer` extracts (47 tracks), and 2 text keys were added.

**The browser check found two upstream bugs, and both are fixed:**
- **Trainer pics loaded by display name.** Every Forest battle hung on
  `bug catcher.png`.
- **Species lookup missed pret constants.** The Lass's `NIDORAN_F` hung the game, and
  Route 22's wild Nidorans never appeared.

The user noticed the first hang while watching and asked whether it was a later slice;
it wasn't, so it was fixed here. After that, every row of the verify table passed,
including both Oak's Lab outcomes, which were staged by editing a save. Tests went
409 → **429**, and the build is OK.

Newly logged: Pokémon names show as "NIDORAN-F" where the cartridge says "NIDORAN♀",
and `startTrainerBattle` can hang silently. Both are in *Found during V1c* above.

The user hasn't play-tested V1b or V1c yet.

### 2026-09-22 (2nd session: repo check → doc fixes → V1 plan → V1a → V1b) — Claude Opus 5.5

**Repo check** (read-only, before any edit): every verifiable claim in this file
matched the repo — git (`master`, no remote, clean), ROM SHA1, the 5 refs on their
pinned commits, data counts (156 JSON / 518 PNG / 3 tilemaps / 12 maps / 57 wild /
46 music / 10 SFX), typecheck clean, **381/381**.

**Doc fixes** (`35f18f6`):
- `game/README.md` is upstream's and described the deleted ROM-upload flow. Added a
  "does not describe this copy" banner. The user asked for the fix without picking
  an option; the banner is the least destructive one — replacing it with a pointer
  or deleting it is still the user's call.
- Milestone count **34 → 33** everywhere (R1 + V1–V5 + A1–X2). The old "29" was
  already one too many. DECISIONS #26 annotated.
- CLAUDE.md SFX line: only the 10 `SFX_HEADERS` entries extract.
- Stale pointers: PLAN.md → *What the game has today*; FPS default at
  `main.ts:885`; ARCHITECTURE test baseline 381.

**V1 plan** (plan commit; no code): `notes/02-v1-plan.md`. It is based on the ASM, on
pret's sym file (read with `git show`, matches our ROM), and on a read-only ROM probe
that replicates the map extractor. Key results:
- V1 needs five slices, V1a–V1e.
- The NPC-text fallback returns wrong text for all five Forest trainers, so read
  trainer headers instead.
- The engine's trainer flow departs from the ASM in 4 ways.
- Yellow's old man runs a forced catch demo (Lv5 Rattata, the throw fails) using
  `BATTLE_TYPE_OLD_MAN`, which shares code with Oak's Pikachu catch.
- The Forest's leaving sign has a Yellow bug to keep.
- In-game trades and Route 22's fake Blue aren't in PLAN.

Also: CONVENTIONS → *Map expansion workflow* gained the sym-file recipe and the
text-fallback trap; `src/overworld/ARCHITECTURE.md` FPS lines fixed (10–200,
`p151-f`).

**Decisions** (`307601d`): the user approved the split and all six recommendations
(DECISIONS #29). A1 moved up to right after V1, A4 (in-game trades) was added —
34 milestones — and the queue was rebuilt.

**V1a** (`ca93482`, extraction only). The seven maps are extracted: trainers come
from their headers, item balls carry their item, Viridian has its north connection,
`oldmanb.png` is exported, and 11 text keys are waiting for V1b–V1e.
399/399, setup twice → byte-identical (848 files), build OK. Dev server check: all
new files are served (200); PewterCity / DiglettsCave are real 404s as intended.
What the regenerated-data diff caught:
- **Blue's house regression, avoided.** Yellow's Daisy and Town Map objects are
  item-flagged with item 0 (a stray `, 0` in `objects/BluesHouse.asm`). A plain
  `isItem` check blanked their text. Item balls are now the objects whose text is
  `PickUpItemText` (00:23ef); a test guards Blue's house.
- **Route 22's north connection** to the unextracted Route 23 is unreachable (no
  walkable step on its top row, solid border), so it can't hang the game.

**V1b plan** (no code): `notes/03-v1b-plan.md`. The research is measured, not assumed:
- **Pikachu:** the spawn states are decoded from `pikachu_follow.asm`, and which setter
  runs comes from `WarpFound2`. The branch can be inferred from tilesets because no
  Yellow indoor map warps explicitly to an outside map.
- **Facing:** the ASM never resets it on a warp (`ResetPlayerSpriteData` runs only at
  Continue / new game). Upstream forces `down`; its Mart script works around that.
- **Reachability** (flood fills): Oak's Aide and Route 2's two item balls need Cut; the
  trade house needs Diglett's Cave; the Forest can be walked end to end.
- **Bag:** it has no TM/HM items, so HM05 can't be given yet.

**V1b decisions** (`b862d0c`): the user said "go" to all three (DECISIONS #30). Oak's
Aide moves to A2, facing is kept through warps, and the door SFX rule waits for V5.

**V1b** (`ab89b9b`, engine only):
- Music, the cave palette, and 8 debug warps (the dropdown is now keyed by index).
- Facing is kept through warps.
- `pikachu/pikachu_spawn.ts` ports all three spawn setters with their full map lists,
  plus placement and facing for states 0–7. It replaces upstream's 3-case model, and
  the door step is now an ordinary step for Pikachu, as `PlayerStepOutFromDoor` is.
- NPCs with no text open no text box.

Checks: 409/409, build OK. **Browser-checked by the agent** on a temporary server:
- Route 2 door step: Pikachu in the doorway (3).
- South Gate: right, facing up (1). Forest: right (1).
- Route2Gate, northward: facing up, right (1). Southward: doorway (3).
- Trade house: the scientist's ROM text shows; the Game Boy kid opens no text box.
- Diglett's Cave entrance: CAVE palette, and the cave warp fails gracefully (only the
  expected warning).
- Viridian Pokécenter entry: facing up, Pikachu right.
- Music routes1 → cities1 → dungeon2, from the resource log. No console errors.

The user hasn't play-tested V1b yet.

**Next:** **V1c** (trainer battles per the ASM). See the V1 slice note and
`notes/02-v1-plan.md` §2.4. Plan first (CONVENTIONS → *Working with the user*).

### 2026-09-22 (setup → Phase R done: R1a, R1b, R1c) — Claude Opus 5.5

One long session: setup, discovering the lost work, a new plan, and all of
Phase R. **The game now runs with no ROM, from committed files.** Local commits
`9bf2d7d` → `de355ba` (no remote, never pushed).

**Setup + planning**
- `git init` at the root; user rule: **local-only, never pushed** (Hard rule #9,
  DECISIONS #24). The ROM stays at `game/pokeyellow.gbc`, covered by `*.gbc`;
  `pkmn-sprites/` ignored (#25). `./pull-refs.sh` cloned the 5 refs.
- Copied upstream into `game/` → it is **vanilla** (12 maps, ROM gate, PSYCHIC
  bug, 10 SFX). The July–August modified copy is gone; the user confirmed **no
  copy exists anywhere**. Audited upstream (table above).
- Plan approved: R1 → R1a/b/c; new **Phase V** rebuilds the lost work before A;
  A re-scoped (#26). Upstream `game/CLAUDE.md` folded into root `CLAUDE.md` →
  *Engine reference* and deleted. Docs reset to the verified state. User
  authorized a **local commit at the end of every slice**.

**R1a** (`dbca9d3`) — setup exports `static/` by running the browser's own
`extractRom()` in Node (`node_image_data.ts`, `static_export.ts`): 518 lossless
PNGs + 3 tilemaps + JSON mirror, byte-identical across runs. +6 tests → 381.
`tsconfig` covers `scripts/`; the Pikachu pret pixel test runs again. Probe +
pret cross-check (overworld sheets read 16× too much, padded tileset reads —
harmless, V5 trim candidate) in `notes/01-r1a-graphics-export.md`.

**R1b** (`a319b0d`) — ROM gate deleted; `publicDir: 'static'`, `base: '/'`,
`appType: 'mpa'`; title PKMN; bundle has 0 gate code. **User played it.** At the
user's request the game now **keeps running in background tabs** (worker ticker +
keys released on blur, DECISIONS #27) — user-verified.

**R1c** (`2c3fced` data, `de355ba` docs) — `data/` + `static/` committed;
`.gitattributes` (LF text; PNG/tilemap/ROM binary). **Phase R gate passed** from
a fresh clone with no ROM: byte-identical data, `npm ci` → typecheck → 334 pass /
47 skip → build → played title → Red's house → Pallet → save → reload →
CONTINUE. `game/LICENSE` removed at the user's request (#28).

**Incidents / tips:**
- The user's :5173 dev server crashed once (Vite watcher EBUSY on a transient
  `game/.zip`, not ours) — just restart it.
- Browser automation must hold keys ~100 ms (see slice notes).
- **Shell trap:** never put Markdown with backticks inside a double-quoted
  `node -e "…"` — bash runs every backtick span as a command. It happened once
  this session: every stray command failed harmlessly, and only this log entry
  got garbled (repaired). Write text to a file with the Write tool, or use a
  quoted heredoc (`<<'EOF'`).
- Not done: my own pixel-digest check of browser PNG decoding (the user took
  over testing; the fresh-clone playthrough covered it visually).

**Next:** **V1** (Route 2 + Viridian Forest). Read its slice note above; present
a plan to the user before implementing (see CONVENTIONS → *Working with the user*).

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

### 2026-08-02 (roadmap restructure) — Claude Opus 4.6

Rewrote `PLAN.md` from vague "Maps-vN" estimates to 90 numbered slices
(A1–O1). Updated tracker queue, agent onboarding files. No production code.
**Superseded 2026-08-04:** 90-slice plan replaced by 29-slice plan (R1–X2).

### 2026-07-30 (context sync) — stopped after Maps-v2 (Grok)

User asked to refresh context only (no new code). Synced handoff snapshot,
PROJECT/PLAN/agent overview, test baseline **395**, map list (30), Next Up.

### 2026-07-30 — Vanilla maps-v2: Gym / Museum / Cave / Route3 (Grok)

Added 6 maps (24→**30**): `PewterGym`, `Museum1F/2F`, `DiglettsCave`,
`DiglettsCaveRoute11`, `Route3`. Pewter east→Route3 open.

- Brock/Jr.Trainer are real trainers; **Brock victory → BADGE_1** + gym music
- Digletts Cave walkable Route2↔Route11 entrance (Route11 outdoor not yet)
- Route3 west only (north=Route4 deferred)
- typecheck clean; **395/395** tests

### 2026-07-30 — Vanilla maps-v1: open north of Viridian (Grok)

Demo old-man "thanks for playing" gate removed (path open with GOT_POKEDEX).
Extracted **12 → 24** maps. ViridianCity north → Route2; forest trainers have
`trainerClass`. typecheck clean; **391/391** tests.

### 2026-07-30 — SFX-wire call sites (Grok)

Wired extracted SFX into gameplay (typecheck + 388/388). Files: `battle.ts`,
`save_menu.ts`, `shop_menu.ts`, `player.ts`, `script_controller.ts`,
`overworld_controller.ts`.

### 2026-07-30 — SFX extraction expanded (Grok)

Walked pret `sfxheaders{1–4}.asm`. Filled `SFX_HEADERS` for UI/OW, battle,
intro + aliases. 49 SFX JSON; **388/388** tests.

### 2026-07-30 (note) — Netlify DEAD LAST (user)

User wants a fully working product before any deploy concern.

### 2026-07-30 — battle move anims v1 / P7 / OW sprites / save (Grok)

Crude category anims, final verification, sprite size fix, save harden.
All user-confirmed. Detail archived below.

### 2026-07-29 — ROM-based extraction pivot (Claude Opus 4)

User's cartridge dump verified (SHA1 match). `npm run setup pokeyellow.gbc`
emitted 156 JSON files. Tests went from unrunnable to **375/375**.
DECISIONS #14 (ROM as build-time source), #15 (ASM generators parked).

### 2026-07-27 — Initial project assessment + context system (Claude Opus 4)

Evaluated both repos; chose `pokemon-yellow-typescript-main` as base.
Established six-file context system. DECISIONS #1–#9.
