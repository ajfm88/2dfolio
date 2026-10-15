# A5b5b review: Pallet Town and Oak's Lab

**2026-10-11 · Claude (Sonnet 5.5) reviewing Sol (GPT-6.1)'s `0d78633` (Mom blackout fix), `aa4479d` (CP3 Pallet)
and `389fe5f` (CP4 Lab) against `notes/32-a5b5-plan.md` (approved, DECISIONS #49).**

## Verdict: passed, with two small fixes required before the user's play-test.

Both are visible in the play-test path and take a few lines each (F-1, F-2 below). Nothing else blocks. The user
should play-test **after** Sol lands them; I would not ask for a fresh review of the whole slice, only of that fix commit.

## What I checked

- **Gates, re-run by me from `389fe5f`.** Typecheck clean. `ROM_PATH=pokeyellow.gbc npm test` **1152/1152**
  (55 files). Without ROM **1032 pass / 120 skip**. `npm run build` clean (340.64 kB JS). `git diff --check` clean
  over the slice. Same numbers as Sol's. No extractor or generated file changed (`git diff --stat`), so I ran no setup.
  I did not repeat Sol's 27-display browser run.
- **Mom (note 33 N-1).** `momText` no longer calls `onHeal`; the test starts from a Viridian blackout destination and
  proves it survives. `SetLastBlackoutMap` stays with the nurse (A5b5c).
- **Pallet against `PalletTown.asm`.** HEY_WAIT is one display: `HeyWaitDontGoOutText`, `DelayFrames 10`, the player
  faces down, the 61-frame bubble inside the open display, no outer wait. Greeting (`ThatWasClose`) and `Whew` have
  the outer wait; `ComeWithMe` is direct text. The map-script prefix (mask, music, flag) runs into the first display
  in the dispatch tick; `startScript` stops at the first movement or wait.
- **Lab against `OaksLab.asm`.** Verified: the four choose displays with a `Delay3` after each close; the ball display
  (`wDoNotWait… = 1`, bubble, no glyph, close, 96 frames in total); the five snatch prints in one display with the
  outer wait; the gift (`OakGives`, `Received` with the key-item jingle, then `AddPartyMon`, drawing disabled, flag,
  no outer wait, `wJoyIgnore` cleared after); challenge, battle metadata, `healParty`, flag, `DelayFrames 20`, exit
  text, Pikachu's two displays; the parcel display (autoBox off, item removed after the program, outer wait); and the
  Pokédex scene with the box turned on, `DelayFrame` / `Delay3` between the seven direct displays, the Pokédex
  objects hidden after the fourth, and the flags after the last. The Oak talk branches match `OaksLabOak1Text` in
  order (the dex-count / `PALLET_AFTER_GETTING_POKEBALLS` lead-in, Poké Ball in bag, Route 22 gift as a throwing
  tripwire, `GOT_POKEDEX`, rival battled with and without the parcel, started or not). The rival's three
  branches match too. Ordinary Lab talkers use `autoBox: false`.
- **Rival alternate-start music (`audio/rival_start.ts`).** New code, and the plan did not ask for a new file. I
  compared the three prefixes with `audio/music/meetrival.asm` (`Ch1`: tempo 112, volume 7/7, duty 3, vibrato 6/3/4,
  perfect pitch, note type 12/11/3, octave 3, D1 rest3 D1 rest5 A2 G2 A2; `Ch2` and `Ch3` likewise). They match, the
  adapter throws if an entry is missing or ambiguous, and it only runs when `playMusic(name, 'rivalAlternate')` is
  asked for. The three uses match `OaksLab.asm` (arrival, Pokédex-scene exit, post-battle exit). Accepted; it does
  not touch the engines. Route 22 and Silph's `AlternateStartAndTempo` variant is not covered and stays with I1.
- **Display revision.** `TextBox.displayRevision` makes `checkUiEntry` open the UI snapshot once per display, including
  a close and reopen in the same tick. The first-display case calls it once. Reasonable.
- **Free-movement handler splice** (`startFreeDisplay`): inserts the handler body before the retained `awaitInteraction`
  and returns to free movement through a callback; the guard path forces one UP and waits three. Tested in `oaks_lab.test.ts`.
- **My own mutations** (reverted with `git checkout`; tree clean): the Lab `labDisplay` `autoBox` default flipped to
  true: 1 test failed. `AddPartyMon` moved before the gift text: 3 tests failed. Sol's five (bubble after close, extra
  HEY_WAIT outer wait, `PrintText` Delay3 dropped, Lab autoBox, `AddPartyMon` early) match the tests I read.
- **Existing-test edits.** Only `small_text_handlers.test.ts` (per N-1) and the census exclusion list. No assertion
  loosened. All 67 controller tests and the A6, nurse, close and battle tests pass unchanged.

## Required before the play-test

- **F-1 (P2) Oak turns his back during the choose-mon speech.** `labChooseSpeech()` (`oaks_lab.ts:27`) has
  `faceNpc prof_desk up`. In the ASM that block is `wSprite01StateData1MovementStatus = 2; wSprite01StateData1FacingDirection = SPRITE_FACING_UP`.
  **Sprite 1 is the rival** (`object_const_def` starts at 1: `OAKSLAB_RIVAL` first; the player is sprite 0), and the
  rival already faces up from `OaksLabFollowedOakScript`. Oak is `OAKSLAB_OAK1` (sprite 3) and keeps facing down. As
  written, Oak faces away from the player from the third speech display ("What about me?") until the gift scene, and for anyone who talks to him
  in between. My plan wrote "Oak/rival status+facing", which was ambiguous, and the old TS had the same line for the
  rival. Fix: `faceNpc rival up` (a no-op on the screen, but faithful) or drop the line, and add a test that
  `labChooseSpeech()` never turns `prof_desk`.
- **F-2 (P2) The Lab's "default music" plays the wrong track.** `oaks_lab.ts:18`: `mapMusic` does
  `playMusic('pokecenter')`. The cartridge's `PlayDefaultMusic` restores the map's own track, and
  `data/maps/songs.asm` gives `OAKS_LAB` → `MUSIC_OAKS_LAB`; `main.ts` already maps `OaksLab: 'oakslab'`. After the
  speech, the rival's exit and the Pokédex scene the Lab would switch to the Pokécenter theme. (This is new in
  CP4; the old code had no music commands there.) Fix: restore through `ScriptDeps.restoreMapMusic` (added in A5b5a for
  Mom, it re-reads the map table) with a small command or callback, not a hard-coded name, and add a test that the
  restored track for `OaksLab` is `oakslab`. Run it once in the browser (the log line or `currentMapMusic` is enough;
  no ears needed).

## Notes (non-blocking)

- **N-1 (P4).** `followerCanDraw()` derives "drawing disabled" from flags in the Lab (`GOT_STARTER` and not
  `BATTLED_RIVAL_IN_OAKS_LAB`) instead of the cartridge's enable/disable state. It gives the same pictures on every
  reachable path today (post-battle ordering checked), but a real draw flag would be cleaner when the Pikachu work
  returns (J2/A6e). Documented in story/ARCHITECTURE.md.
- **N-2 (P4).** Between Pikachu's two dislike displays the cartridge ends a script pass; the TS runs them back to
  back with the follower-spawn callback between. The 2-frame pass gap is not modelled. No visible effect.
- **N-3 (P4).** The Route 22 flags set on Oak's exit (`EVENT_1ST_ROUTE22_RIVAL_BATTLE` etc.) were absent before and
  still are; they belong to I1 with the Route 22 tripwire.
- **N-4 (docs).** Sol's note says the discarded browser trials needed the door's second DOWN press; worth knowing for
  the next smoke run, nothing to fix.

## State after the review

A5b5b is **done pending F-1 and F-2** (one small Sol commit, plus a one-line mention in the note 32 result). The
user's play-test is then: a brand-new game from Pallet's grass through the Lab to the rival battle, both Pikachu
texts, then the parcel and the Pokédex scene (A = Z, B = X). Please watch: Oak's facing during the speech, the
Lab theme, the "!" over you in Pallet, the empty "!" display over the rival, the five-box rival snatch, and the
missing "advice" text after the gift. **Next: A5b5c** (the nurse and cleanup), planned in note 32 §3.4 and §6 CP5–CP6;
Sol claims it after the play-test.
