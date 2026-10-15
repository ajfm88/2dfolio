# A5b3 review — key-item jingle and PC sounds

**2026-10-11 · Claude (Sonnet 5.5) reviewing Sol (GPT-6.1)'s `ad423e1`, `d90aaad`, `2e3c653`
against `notes/28-a5b3-plan.md` (approved, DECISIONS #47).**

## Verdict: passed. No blocking findings, no changes requested.

## What I checked

- **Scope.** The source diff is exactly the plan: four `SFX_HEADERS` rows with the sym labels
  (addresses match §3.1), `extractSfxAt` split out of `extractSfx` with an unchanged body,
  `SFX_HEADERS` exported for the guard, the four preload names, and the corrected comments.
  `decodeChannelCommands`, both setup name lists, the audio engines and the synthesizer are
  untouched. No call site plays any of the four sounds (grep).
- **Generated data.** I ran `npm run setup pokeyellow.gbc` twice: `git status` stayed clean
  both times, so the committed files are exactly what setup writes. 173 JSON in each tree,
  696 files under `static/`, and the 12 existing SFX files are unchanged.
- **Gates, re-run by me.** Typecheck clean. `ROM_PATH=pokeyellow.gbc npm test`
  **1015/1015** (47 files). Without ROM **898 pass / 117 skip**. `git diff --check` clean.
  (The build and the :5187 browser smoke are Sol's; I did not repeat them. Neither touches
  anything but the preload list.)
- **Tests read, not just run.** The ASM-parser extension (`square_note`, raw fade nibble,
  unknown macros still throw) is right. The §5 fixtures are literal, source-derived numbers
  rather than engine output echoed back. The bank guard iterates the real table, so a later
  SFX with a differing bank-`$1f` copy fails it; it also pins the per-bank return updates
  (save 40/37, turn_on_pc 70/81, enter_pc 22/18). The Forest hand-off test is source-derived
  (wave `.sub2` lengths) and correctly distinguishes pulse resume (136) from wave resume (149).
- **My own mutation.** I changed `turn_on_pc`'s first frequency 1984 → 1985 in `data/` and
  reran the suite: 4 tests failed (the timing/register trace, the JSON-equality test and both
  static-export tests). Restored with `git checkout`; tree clean.

## Notes (non-blocking)

- **N-1 (P4).** The A1a parser moved from inside the jingle `describe` to file scope. That is a
  fine refactor and the A1a tests still pass; just noting it changed.
- **N-2 (P4).** `extractSfxAt` returns the decoded channels even for a bank that does not
  contain the sound. The guard is only meaningful because all 16 header addresses are shared by
  banks `$02` and `$1f` (checked in the plan, and stated in the test comment). If V5 adds an SFX
  that exists only in bank `$02`, the guard must be extended, not trusted.
- **Optional ear test** (`_playSFX('get_key_item')` etc.) was not run. It checks the data
  only and nothing depends on it.

## State after the review

A5b3 is done. The deferred items stay as logged in the plan §8 and STATUS: the bank-aware
lookup (V5), `save` timing in bank-`$1f` maps (A5b7 must say so), Silph Co. 11F's PC (G1).
**Next: A5b4**, the text command runner and exact close, not yet planned or assigned.
