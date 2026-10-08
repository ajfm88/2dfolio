# A5a review — Claude Opus 5.5, 2026-10-06

Reviewed `7897e8e`…`4565e67` (Sol) against `notes/21-a5-plan.md` and the ASM.

**Re-run:** typecheck clean; 963/963 with `ROM_PATH`; no-ROM 878 pass / 85 skip; build clean.
Regenerated data diff: exactly 8 `<PROMPT>` suffixes (Route1, ViridianCity, ViridianPokecenter,
the Forest's five end-battle texts), mirrored in `static/`.

**Checked against the ASM, all match:**
- `letterDelay`: N frames, 1 when A/B is held, a mid-delay press ends it a frame later, the letter
  placed first (N-1 fixed).
- `cont` / `para` / `prompt`: ▼ before `ProtectedDelay3`, no reads during it (a press made then is
  caught at the first read), `WaitForSoundToFinish` before the beep, rows 14–16 → 13–15 twice with
  5 frames each, rows 13–16 cleared plus 20 frames, `\n`'s auto rule, `<NEXT>` clipped.
- `DisplayTextID`: box at render T+3, first letter at T+20 (T+23 through `PrintText` for trainers),
  silent end with no ▼, a fresh A/B, A's release, the box gone a frame later.
- BG transfer: the portion is frozen during the opening (auto transfer is off until after the font
  load) and persists between boxes.
- Trainers: both paths open with `DisplayTextID` + `PrintText`; the meet music fires on text
  completion (talk only); battle strips the tokens.

**Blocking findings:** none.

**Notes (not regressions, homes given):**
- N-1: Route 1's youngster1 and Viridian's Drowzee man have `dialogue` taken from the first text of
  a `text_asm` handler, so after their scripts the ASM shows other texts. Their new `<PROMPT>` makes
  this visible as a ▼ wait before the silent one. This predates A5a → V5 map-object audit.
- N-2: the `legacy` ending still beeps and closes on the press without `WaitForSoundToFinish`, as
  planned → A5b.

Hand to the user's play-test (plan §7).
