# A5b7b review — the Poké Mart, list menu, quantity menu, screen tiles

**2026-10-14 · Claude Opus 5.5 · Result: PASSED with one small required fix (F-1). F-1 fixed by Claude
at the user's request, same day (see the end of this note).**

Reviewed: Grok 4.7's `1aa84e8` (CP1), `7bf1d9e` (CP2), `9568dab` (CP3), `606c775` (CP4),
`2704616` (CP5), `472f902` (CP6) against `notes/41-a5b7b-plan.md` and DECISIONS #54.

## Gates re-run from `472f902`

| Gate | Result |
|---|---|
| `ROM_PATH=pokeyellow.gbc npm test` | **1330/1330**, 70 files |
| `npm test` (no ROM) | **1207 pass / 123 skip** |
| `npm run typecheck` | clean |
| `npm run build` | clean (351.86 kB JS, 104.85 kB gzip) |
| `git diff --check 417c62e 472f902` | clean |

No extractor or generated-data change, so setup was not re-run. I did not repeat the
browser smoke; Grok's (note 41 → *Implementation result*) and the user play-test cover it.

## Checked against the ASM

- **`pokemart.ts` vs `DisplayPokemartDialogue_`:** every label and branch is there.
  `.loop` resets the item and offset. Buffer1 is saved after the buy/sell greetings
  and after the empty-bag prompt. `.returnToMain` restores, redraws MONEY, then
  AnythingElse. Buying checks money, then `bag.add`, then subtracts, then
  PlaySoundWaitForCurrent + WaitForSoundToFinish, then the Bought prompt. Selling
  adds with the ¥999999 cap, redraws MONEY, plays the sound, then removes the selected
  slot (absolute index) with no message. Unsellable is IsKeyItem or IsItemHM.
  ThankYou → UpdateSprites → the saved offset is restored. Box coordinates match
  `data/text_boxes.asm`.
- **`list_menu.ts` vs `DisplayListMenuID` / `PrintListMenuEntries` /
  `HandleItemListSwapping`:**
  - Opening: transfer off, LIST_MENU_BOX, 10 frames, entries, transfer on, Delay3,
    then HandleMenuInput's Delay3, so the first read is at +16.
  - Cells: names at (6,4+2r), prices at name+(5,1), `×qty` at name+(8,1) skipped for
    key items, CANCEL stops the loop with no ▼, otherwise ▼ at (18,11).
  - Input: the 3-row cursor; the scroll condition `offset + 3 ≤ count`; A before B
    before SELECT before Up/Down.
  - Swap: mark, self-ignore, the 20-frame waits, swap, merge (< 100) and split
    (≥ 100).
- **`menu_input.ts` repeat vs `JoypadLowSensitivity`:** a new press reports held keys
  and arms 30. Otherwise it reports nothing until the counter runs out (it keeps
  counting through Delay3), then held keys with a re-arm of 5. A/B held → nothing,
  still re-armed. `watchOutOfBounds` returns without a sound unless A/B is pressed.
  Defaults are unchanged for the blackboard and Oak's name menu.
- **`quantity_menu.ts` vs `DisplayChooseQuantityMenu`:** both layouts, starting at 0
  then incremented, wrap both ways, the total by repeated BCD addition, the
  halving floored on the total, 6 spaces then BCD at (12,10), the quantity with
  leading zeroes at (9,10). A before B. No Delay3, no sound.
- **`screen_tiles.ts` / `bg_transfer.ts`:** the BCD cells match `PrintBCDNumber`.
  Buffer1 carries the message box's tiles and border, not its program. Disabling the
  transfer holds the portion. The Mart's thirds copy on the same tick as the text
  box's; the tiles drop on the close's first frame after the window.
- **Grok's "a letter frame can read Joypad twice"** is cartridge behavior, not a bug.
  Yellow's `PrintLetterDelay` (`home/print_text.asm`) spins on `Joypad` with no
  `DelayFrame` until VBlank zeroes `hFrameCounter`, returns, and the next letter
  reads again in the same frame.

## Required fix

**F-1 — A and B pressed in the same frame on BUY/SELL/QUIT quit instead of choosing.**
`pokemart.ts` `frame()` tests `hit.includes('b')` first. `DoBuySellQuitMenu`
(`engine/menus/text_box.asm`) tests A first. `PlaceUnfilledArrowMenuCursor` preserves
`a`, so with A+B new in one frame the cartridge takes `.pressedA` and buys or sells
the cursor's item (or quits only if the cursor is on QUIT). Ours always prints
ThankYou. Fix: treat B as cancel only when A is not also in `hit`. Add a regression
test: A+B together on BUY opens "Take your time.". The list, quantity box and YES/NO
already order A and B as the cartridge does.

## Reviewer mutations (focused run: `src/menus`, `src/text`, `story/mart.test.ts`, 206 tests)

| Mutation | Result |
|---|---|
| List border not hidden during the 10 frames | caught (4) |
| A/B-held repeat skips the re-arm of 5 | **survived** (N-2) |
| Merge keeps offset and cursor | **survived** (N-1) |
| Sale skips the immediate MONEY redraw | caught (1) |
| Quantity Down from 1 doesn't wrap | caught (1) |
| Buy list doesn't keep its scroll | caught (1) |
| ▼ drawn with CANCEL in view | caught (1) |
| Restore ignores the border flag | caught (1) |
| New PrintText keeps the list's row-12 border | caught (1) |
| Swap marker ▷ not drawn | caught (2) |

All restored; the tree was clean afterwards. Grok's six mutations are in note 41.

## Non-blocking notes

- **N-1 — the merge reset assertion is vacuous.** `list_menu.test.ts` merges with the
  cursor and offset already at 0, so `offset 0 / item 0` can't fail (mutation M3). The
  code is right. Make it observable on a later touch: mark row 0, move to row 1 of the
  same item (or scroll first), merge, then expect 0/0.
- **N-2 — the A/B-held short re-arm isn't pinned.** No test observes that holding A or
  B at the repeat point still re-arms 5 frames. Add one when A5b7c touches the
  list (hold Down, then A at the repeat point, release A: the next Down report comes
  5 frames later, not at once).
- **N-3 — `writeNumber` would print nothing for 0.** PrintNumber always writes the
  ones digit; `ScreenTiles.writeNumber` skips a lone 0 when leading zeroes are off.
  Unreachable today (no stack is 0), but A5b7c/d's callers should get it right. Fix
  it when a 0 can appear.
- **N-4 — the YES/NO box draws immediately**, not by its transfer third (the plan's
  recorded departure). Unchanged.
- `HM_ITEMS` lists HM01–HM05 by name though none are in the item table yet. Harmless,
  and it turns on by itself when A2 adds them.

## User play-test (after F-1)

Note 41 §7, on `http://127.0.0.1:5173/` with a save past Oak's parcel. **Z = A, X = B.**

## F-1 fix (2026-10-14, Claude, at the user's request)

`pokemart.ts` now treats B as cancel only when A is not in the same report. New
regression test in `story/mart.test.ts`: A+B together at the first menu read plays one
press_ab, leaves ▷ on BUY and prints `PokemartBuyingGreetingText` (it fails on the old
line). Gates: ROM **1331/1331** (70 files), no-ROM **1208 pass / 123 skip**, typecheck,
build and diff check clean. **F-1 closed.**

**User play-test passed 2026-10-14 (all seven checks). A5b7b is done.** Next: A5b7c is planned.
