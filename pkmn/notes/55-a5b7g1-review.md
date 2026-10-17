# A5b7g1 review: legacy text retirement and test debt

**2026-10-15 · Claude · Passes, no required fix.**

Reviewed: CP1 `4cb3f57` and CP2 `81f80ad`, implemented by Sol against `notes/54-a5b7g-plan.md` §4
(DECISIONS #60).

## 1. Gates (re-run by the reviewer)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run build` | clean |
| ROM suite (two runs) | **1575/1575**, 87 files, both runs |
| No-ROM suite | **1445 pass / 130 skip** |
| Working tree | clean before and after the mutation runs |

The intermittent failure seen once on 2026-10-15 didn't recur in my two runs or Sol's three.

## 2. What I checked

- **Removal (CP2), against the census in note 54 §3:**
  - Script `text` and `closeText` are gone, with `scriptTextWaiting` and the non-display
    `scriptButtonWaiting` path.
  - `guardText`, the `guard_text` and `target` sub-states and the `{}` fallbacks are gone, and
    `guardProgram` is required.
  - `CommandState`, `commandState` and `isCommandDone` are gone.
  - TextBox's `legacy` mode, `TextBoxEnd`, `end` and `show()`'s `mode` are gone. `show()` is now
    DisplayTextID only.
  - `printStandalone` keeps `printText` internally.
  - `show()` no longer calls `substituteNames` itself, but `printing()` still does, so names still
    resolve.
- **`textButtonWait`:** kept, and it now throws without an open display, as the plan asked. The
  hidden-item full-bag path always opens a display first.
- **The free-movement NPC fallback:** now throws for an unresolved object. The census test proves every
  object on the one map that uses `awaitInteraction` (Oak's Lab) resolves.
- **F-1:** the free-movement hidden text opens with `autoBox: true`. This matches the cartridge: each
  hidden-event and bookshelf routine calls `EnableAutoTextBoxDrawing` after `OaksLab_Script` has set
  `BIT_NO_AUTO_TEXT_BOX` (`home/window.asm:268`, `scripts/OaksLab.asm:4`). The test covers both posters
  and the e-mail: border at +3, first glyph at +20, rendered glyphs, return to the await, and the ball's
  display after it.
- **The A6e fixture (note 36 N-3):** now runs the real nurse script on a real `TextBox`, including the
  welcome text and the YES menu, with a program spy. Every original assertion is kept. The fighting-fit
  check is stronger: no Pikachu image on any printing frame, not just the first. The `buildNurseScript`
  re-export is deleted.
- **The A6d pushed hop:** ends on a real `displayOpen` + `printText`.
- **The deleted explicit-ending tests:** I checked the coverage map in `text_commands.test.ts`' header
  against the named tests. Each behavior has a program-path test, and the invented legacy beep has no
  source to preserve.
- **The seven review gaps:**
  - note 53 M1 (dismiss after the SAVE close), M5 (first close frame), M6 (bag scanout through the ITEM
    tail), V8 (message held until its bottom-third transfer), V9 (save sound at +10 with no current
    sound);
  - note 51 M2 (the WITHDRAW/DEPOSIT label), M10 (the empty bottom box).

  Each asserts the source value.
- **Census tripwires** (`text/text_census.test.ts`): AST-based, so comments and test literals don't
  count.
  - every plain current-map call reached through `MapDialogue` is text/FAR only;
  - every object on an `awaitInteraction` map resolves;
  - `getText` callers are exactly the approved set, which still includes `overworld/map.ts` until g2.

## 3. Reviewer mutations (temporary, restored with `git checkout`)

| # | Mutation | Result |
|---|---|---|
| 1 | F-1 reverted (`autoBox: false` for free-move hidden text) | caught |
| 2 | `menu_closing` no longer dismisses the text box (note 53 M1) | caught |
| 3 | an invented `press_ab` beep before Hold on every display close | caught |
| 4 | `textButtonWait` silently advances without a display | caught |
| 5 | the guard's step no longer followed by Delay3 | **survived** (N-2) |
| 6 | free-movement NPC display opens with the automatic border | **survived** (N-3) |
| 7 | the nurse's `showPikachu` leaves no spawn state | caught |

## 4. Notes (none blocks)

- **N-1:** `pikachuFacing` restore (`script_controller.ts:916`) checks `displaySession` but not
  `active`. Since CP2 a box that has never opened reports `displaySession` true. Before CP2 the same was
  already true after any display, so nothing changed in practice. The only caller (the nurse) restores
  inside its display. Use `textBox.active && textBox.displaySession` if a caller ever restores outside
  one. g2 or later.
- **N-2:** `OaksLabPlayerForcedToWalkBackScript`'s Delay3 after the guard's step (`scripts/OaksLab.asm:196`)
  has no assertion. This predates g1, which only simplified the surrounding branch. Add one in g2, which
  rewrites the free-movement path anyway.
- **N-3:** the free-movement NPC display's borderless +20 opening (`autoBox: false`, from
  `BIT_NO_AUTO_TEXT_BOX`) isn't asserted. Every Lab NPC call is a `printText`, so the box appears at +3
  either way and only frames +4 to +23 differ. This predates g1. Add it in g2 with N-2.

## 5. Play-test

Note 54 §8, g1: in Oak's Lab before choosing a starter, read both posters and the e-mail. The text box now
appears, and you can walk again afterwards. Controls: **Z = A, X = B**. After that, g2 can start.
