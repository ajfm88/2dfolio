# A5b7c2 review — party-menu prompts, field medicine, the HP bar, heal sounds

**2026-10-15 · Claude · Result: two required fixes (F-1, F-2) before the play-test.** The data,
the HP-bar math, the animation schedule, the medicine outcomes and the return path are right.

Reviewed: Grok's `a21d718` (CP1), `188a4a4` (CP2), `eb0d1f3` (CP3), `784607e` (CP4), `461d43f`
(CP5) against `notes/45-a5b7c2-plan.md` and the ASM.

## Gates re-run from `461d43f`

| Gate | Result |
|---|---|
| `ROM_PATH=pokeyellow.gbc npm test` | **1386/1386**, 74 files |
| `npm test` (no ROM) | **1256 pass / 130 skip** |
| `npm run typecheck` / `npm run build` | clean |
| `git diff --check 6aaf611 461d43f` | clean |
| `npm run setup pokeyellow.gbc` re-run | exit 0, **no diff** (generated data matches the extractor) |

## Checked and correct

- **Data:** heal_hp `$02:$41A7`, heal_ailment `$02:$41AA`; their bank-$1f copies match, so the
  guard's differing set is unchanged. `ItemUseNotYoursToUseText` `$03:$6504` → `$2D:$6D92`.
  The Parcel prints "This isn't yours / to use!" (closes note 44 F-1). Note 44's N-1 and N-2 tests
  are in `bag.test.ts`.
- **`hp_bar.ts` vs `GetHPBarLength`:** floor; ÷4 of the product's low word and of max when
  max ≥ 256; the divisor is the low byte; minimum 1; static 0 HP draws 0 px. The colors are
  27/10 px. The fraction is at col 13 (the stats screen's below-bar position is unchanged).
- **`HpBarAnimation` vs `UpdateHPBar2`:**
  - each step shows the pre-step HP for 1 frame;
  - then the bar at old px … new−1, 2 frames each;
  - the `cp $31` stop;
  - the ending: 1 + 2 + 3 frames;
  - the Revive start uses `GetHPBarLength(0) = 1`.
  - Hand-checked: 13→33/39 = 20 + 2·24 + 6 = **74**; 1→21/300 = 20 + 2·2 + 6 = **30**.
- **`applyFieldMedicine` vs `ItemUseMedicine`:**
  - happiness only for the starter, only for items ≤ CALCIUM, before the check;
  - status items check the bit only, so they work on 0 HP;
  - Revive only when fainted (½ max via `>>1`, spawn state 3 for the starter);
  - Full Restore at full HP with a status → Full Heal (heal_ailment);
  - Potion 20 / Super 50 / Hyper 200 / Max and Full Restore to max, clamped;
  - one item removed from the bag index only on success.
- **Return path:** white from P, the bag visible at P+19, first read P+22 (pinned).
- **START → POKéMON:** the prompts come from `PartyMenuNormalText` / `PartyMenuSwapMonText`;
  battle mode is untouched. `item_menu.ts` is deleted.

## Required fixes

**F-1 — the item-use party menu drops most presses.** `FieldMedicine.choose()` reads input and
then sets `input-delay` with `wait = 2` after **every** frame without a selection, so it polls
every third frame. `PartyMenu.update()` uses `isPressed`, a one-tick edge (`updateInput`). A press
whose first frame lands on one of the two skipped frames is lost, no matter how long the key is
held.
- **Proof:** a throwaway test with the real input module (per-tick edges, no mocks) tapped A
  once at offsets 1–5 after the menu was readable. Only offsets 2 and 5 selected the Pokémon.
- **Cartridge:** `HandleMenuInput_` `.loop2` reads every frame. It returns to `.loop1` (another
  Delay3) only after an unwatched key, which here means Up/Down moving the cursor.
- **Fix:** call `partyMenu.update()` every frame once the opening Delay3 is over. Re-arm 3 frames
  only after a frame where the cursor moved.
- **The tests didn't catch it** because the rig in `field_medicine.test.ts` keeps `isPressed`
  true until the next read. Add a regression test with per-tick edge semantics, as the probe did:
  a single-frame tap on each of three consecutive frames must select.

**F-2 — the HP bar changes color during the animation.** `drawTileHpBar` picks its tileset from
the override's live pixel count, so a Potion on a red bar turns yellow, then green, while
filling.
- **Cartridge:** the party-menu bar color is a palette, set per row only by
  `SetPartyMenuHPBarColor` inside `RedrawPartyMenu_`. `UpdateHPBar_AnimateHPBar` → `DrawHPBar`
  writes tile IDs only. So the bar fills in its **pre-heal color** and changes color at the
  result screen's redraw.
- **Fix:** the override carries the row's color from the last static draw (or the party menu
  holds the color per row and recomputes it only on a redraw). Test a heal that crosses 10 and
  27 px: the color stays the same during the animation and changes on the result redraw.

## Reviewer mutations (focused: `src/menus`, `src/story`, `src/pikachu`, `items.test.ts`; 380 tests)

Caught: ceil instead of floor (10), green at 26 px, no per-step print frame (5), post-step HP
shown (5), happiness for any mon, Full Restore's status branch removed, item removed on no
effect, fraction at col 12, item-use A not saving the cursor, the return 3 frames early, Revive
rounding up. **Survived:** result message typed instead of no-delay (N-1). All restored; the tree
was clean afterwards.

## Non-blocking notes

- **N-1:** no test pins that the result messages print with no delay (the M12 survivor). Add one
  with the F-1 work.
- **N-2:** during `.showHealingItemMessage` the cartridge freezes the old screen for E+1..E+6 (the
  transfer is off). The prompt "Use item on which POKéMON?" stays visible, then the redraw (prompt
  gone, cursors erased by `ErasePartyMenuCursors`, new colors) transfers at E+7..E+9. Ours hides
  the prompt at E and keeps ▶. Small and within the party menu's J2 drawing approximation; fix it
  with F-2 if cheap.
- **N-3:** a cure clears `status` only. The old bridge also reset `sleepTurns` / `toxicCounter` /
  `badlyPoisoned`. Harmless: battle resets the toxic fields at the start and on every switch, and
  sleep logic is gated by the status.
- **N-4:** `PartyMenu.show` clamps the saved cursor to the party size; `PartyMenuInit` doesn't.
  It's reachable once the party can shrink (PC deposit, A5b7d). Revisit there.
- **N-5:** the menu test rigs mock `isPressed` as "pressed until read". Prefer the real per-tick
  edge in new input tests (F-1's lesson).

## User play-test

After F-1 and F-2: `notes/45-a5b7c2-plan.md` → Verification, last list. **Z = A, X = B.**

## Fixes (2026-10-15, Claude, at the user's request)

- **F-1 fixed:**
  - `PartyMenu.update(pressed)` takes the caller's read. `FieldMedicine.choose()` calls
    `readJoypad()` and `update(isPassPressed)` every frame, and re-arms Delay3 only after a new
    key it doesn't watch.
  - useItem mode follows HandleMenuInput_ / HandlePartyMenuInput: A suppresses Up/Down (which
    wrap), A or B plays press_ab and saves the cursor, and B wins over A.
  - `menus/field_medicine_input.test.ts` drives the real input module. One-frame taps register
    on three consecutive frames. A tap inside the post-move Delay3 is lost, but a key held into
    the read counts. A+B cancels. Two of its four tests fail on the pre-fix code.
- **F-2 fixed:**
  - `PartyRowOverride` carries `colorPixels` and `status`. `FieldMedicine` freezes the row before
    the effect writes the party data, animates only the bar and the number, and clears the
    override when the transfer comes back on for the redraw.
  - This also keeps an Antidote's "PSN" on screen until the redraw.
- **F-3 (new, found while fixing): the result message never printed.**
  - Nothing ticked the text box during the result phase: `BagSession.present()` ticked it only
    for the bag's own prints, and `FieldMedicine` only on the no-effect path. A real-input probe
    showed the box active but empty from the 50-frame hold until the silent wait.
  - `present()` now ticks the text box whenever field medicine owns it (still one transfer tick
    per frame), and the no-effect path no longer ticks it itself.
  - Tests: the message appears complete on its first frame (no delay, N-1) and stays until a
    press; "cured of poison!" prints.
- **N-2 done:** ▷ on the chosen row; the cursor is erased at the redraw; the prompt goes when
  the result's box is drawn.
- **Each fix reverted once, with its test watched fail:** F-3 (2), F-2 color (1), the status
  freeze (1), typed result (2), the cursor (1), F-1 (5), A-over-B (1).
- **Gates:** ROM **1393/1393** (75 files), no-ROM **1263/130**, typecheck, build and diff check
  clean. No browser play.

**User play-test passed 2026-10-15 ("it all works well"). A5b7c2 is done.** Next: A5b7d.
