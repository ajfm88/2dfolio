# A5b7a review — number printing, standalone no-delay text, menu glyphs

**2026-10-14 · Claude Opus 5.5 · Result: PASSED, no required fix. User check passed 2026-10-14 (all three points).**

Reviewed: `1cfead5` (CP1), `943ac7f` (CP2), `936bcee` (CP3) against note 39 §4 and
DECISIONS #52. Implementer: Codex/Sol. Handoff: note 39 → *A5b7a implementation result*.

## Gates re-run from `936bcee`

| Gate | Result |
|---|---|
| `ROM_PATH=pokeyellow.gbc npm test` | **1299/1299**, 66 files |
| `npm test` (no ROM) | **1176 pass / 123 skip** |
| `npm run typecheck` | clean |
| `npm run build` | clean, 344.33 kB JS (101.63 kB gzip), matches the handoff |
| `git diff --check 7b52426 HEAD` | clean |

No extractor or generated-data change, so setup was not re-run.

## Checked against the ASM

**`PrintBCDNumber` / `PrintBCDDigit` (`home/print_bcd.asm`)** — the `bcd` case in
`text/text_runner.ts` matches branch by branch:

- Leading `¥` only when the money bit is set and the suppress bit (bit 7, extracted as
  `leadingZeroes: true`) is clear; written with no letter delay.
- A suppressed zero: left-aligned → nothing; right-aligned → `inc hl` only
  (`moveCursor(1)`, no tile written, no delay, no read).
- First non-zero digit under suppression writes the deferred `¥` (once) and clears
  suppression; every printed digit calls `PrintLetterDelay` (`writeGlyph(digit, noDelay)`).
- All-zero fallback: right-aligned backs up one cell, optional `¥`, then `0` with a
  letter delay. The cartridge's one-cell overhang past the field is reproduced.
- Range: value < 10^(2·bytes).

**`TextCommand_NUM` / `PrintNumber` (`home/text.asm`, `home/print_num.asm`)** — forced
`LEFT_ALIGN`, no leading zeroes, no `PrintLetterDelay` anywhere in the routine; the
cursor ends after the last digit for the following text. `String(value)` with no delay
is exactly that, including `0`.

**`printStandalone({ noDelay })`** — only letter delays are skipped. `Delay3`, pauses,
prompts and sound waits are unchanged, matching `BIT_NO_TEXT_DELAY`'s single use in
`PrintLetterDelay`. Oak's default path is untouched.

**`drawText` / `drawChar`** — one tile per cartridge glyph (longest-match contractions,
shared with the printer through `textGlyphAt`); `font_extra` for quotes, middle dot and
ellipsis, the same sheet/tile choice `TextBox` already makes. Uppercase `'D`
(FARFETCH'D) is not a contraction, correctly.

## Reviewer mutations (all caught, all restored; tree clean afterwards)

Focused run over `src/text` + `src/menus` (173 tests):

| Mutation | Failures |
|---|---|
| All-zero fallback without the one-cell back-up | 3 |
| `¥` takes a letter delay | 4 |
| Decimal digits take letter delays | 8 |
| Suppressed zero writes a blank instead of skipping | 2 |
| `drawChar` draws extra glyphs from the regular font | 2 |
| Deferred `¥` condition broken | 5 |

The implementer's three mutations (flag polarity, noDelay forwarding, tokenization)
are recorded in note 39. Removing the two "unsupported bcd/decimal" tests is correct:
those ops are now supported, and the op-census test still pins the extracted set.

## Non-blocking notes

- **N-1 — visible beyond the PC (expected, and correct).** `battle/battle_ui.ts` draws
  its messages through `drawText`, so battle lines such as "It doesn't affect" and
  "X's attack missed!" now use the cartridge's single `'t`/`'s` glyphs and are one tile
  shorter. That is what the ROM does. The user check below adds one battle look.
- **N-2 — row wrap past the box is clipped, not wrapped.** On the cartridge `inc hl`
  past column 19 runs into the next tilemap row; `TextScreen.put` clips at column 18
  and keeps the logical cursor. No extracted number program reaches it (note 39 §4 kept
  this contract deliberately). Revisit only if a later caller does.
- **N-3 — out-of-range decimals throw.** `PrintNumber` would print an overflowing top
  digit for a value ≥ 10^digits; the runner rejects it instead, as the plan specified.
  Gen 1 HP differences stay below 1000, so no in-game value reaches it.

## User check (after this review)

Run the dev server on `http://127.0.0.1:5173/`. **Z = A, X = B.**

1. Viridian Pokécenter PC: `SOMEONE's PC` and `<your name>'s PC` — the `'s` sits in one
   tile, the space and `PC` right after it.
2. Any YES/NO box (e.g. the nurse) looks as before.
3. A battle message with a contraction (a miss, or "doesn't affect") — `'s`/`'t` in one tile.

**Next after the user check: Sol implements A5b7b (Mart).** It needs its own detailed
caller plan per note 39 §1 before code.
