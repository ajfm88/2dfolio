# A1a review — passed

2026-10-06 · Codex. Reviewed Claude Opus 5.5's four implementation checkpoints
(`3a4fabb`, `732aa12`, `75166d2`, `8b1691e`) and handoff through `142f68f`,
against `notes/16-a1a-plan.md`, DECISIONS #40 and the pinned Yellow source in
`refs/pokeyellow` (`e89ead15`). The working tree was initially clean; the
documentation-only ear-test commit `142f68f` arrived during this review.

**Verdict: no actionable findings within the agreed A1a scope.** The source
review and independent checks support accepting the implementation. The user's
ear test is already recorded as passed in `142f68f`; A1a remains done.

## Source review

- **Extraction:** the headers and all three decoded channels of both jingles
  match the ROM and `audio/sfx/get_item{1,2}_1.asm`. After `execute_music`, the
  decoder treats `$10` and `$2x` as music notes. The generated-data diff is
  exactly the two new SFX JSON files and their static mirrors.
- **Timing and channel routing:** ids 5/6/7 select pulse 1/pulse 2/wave. SFX
  note lengths use `$0100` without changing the Forest's music tempo. The
  final `sound_ret` updates are 73 and 181. The shared interpreter implements
  the byte counter, fractional byte and 16-bit multiplication from
  `Audio1_note_length`.
- **Pitch and vibrato:** perfect pitch increments the low byte only;
  vibrato uses the delay, rate-plus-one cadence, clamped low-byte extents and
  direction retained across notes in `Audio1_ApplyMusicAffects`. Rate zero
  runs every update. Wave frequency uses half the pulse frequency for the
  same register, and each wave note reloads its own instrument.
- **Suppression and release:** music runs before SFX, including the update
  an SFX ends. Covered music notes count without writing their output or
  running effects. Release stops the software envelope from re-enabling the
  covered music note; the next note or rest takes ownership. Pulse rests
  remain silent. These changes and the slide/vibrato ordering agree with the
  reviewed `engine_1.asm` paths.
- **Sound wait:** channels 5, 6 and 8 determine completion; channel 7 is
  skipped, as in `home/delay.asm`. Music drums occupy channel 8, reject other
  drum hits while busy and are cancelled when a real channel-8 SFX starts.

## Independent verification

| Check | Result |
|---|---|
| Full suite with `ROM_PATH=pokeyellow.gbc` | **812/812**, 33 files |
| Suite without `ROM_PATH` | **731 pass / 81 skip** |
| `npm run build` | TypeScript and Vite pass; 103 modules, 322.69 kB bundle |
| `git diff --check 73a3720..142f68f` | Clean |
| Generated-data scope | Only `get_item1.json`, `get_item2.json` and their static mirrors |
| Public API probe in a temporary directory | Four checks pass, described below |

The separate API probe imported the real `audio/index.ts`, supplied disk-backed
HTTP responses and bypassed only browser audio activation. It verified all
12 SFX are preloaded; a cached jingle starts synchronously without another
fetch and clears the public wait on update 73; an uncached request remains
busy during loading and playback; an HTTP 404 clears the pending wait; and
public `playSFX('start_menu')` cancels an existing drum and occupies channel 8.
The warning for the intentional 404 was expected. Probe code was kept outside
the repository and is not part of the committed test suite.

## Limits and next step

This was a code and automated review, with no new browser or listening check.
The user's listening result is recorded independently in `142f68f`.

The agreed departures in the plan's §8 remain deferred, including pulse
envelope timing and SFX tails, SFX priority, the pitch-slide algorithm and
drum step timing. Acceptance here covers the agreed A1a behavior.

Next: plan A1b's item balls and hidden items using `playSFX` and
`isSoundFinished()` (`notes/07-a1-plan.md` §2.2).
