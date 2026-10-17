# A5b7c1 review — the bag from START, toss, field USE, shared list state

**2026-10-15 · Claude · Result: PASSED. No code fix required. One text defect from the plan
(F-1) goes to A5b7c2's data checkpoint; two test gaps (N-1, N-2).**

Reviewed: Grok's `bb1846b` (CP1), `ef24017` (CP2), `aecdc3d` (CP3+CP4), `6df094f` (CP5) against
`notes/43-a5b7c-plan.md` §3 and §3.6, and DECISIONS #56.

## Gates re-run from `6df094f`

| Gate | Result |
|---|---|
| `ROM_PATH=pokeyellow.gbc npm test` | **1348/1348**, 71 files |
| `npm test` (no ROM) | **1225 pass / 123 skip** |
| `npm run typecheck` | clean |
| `npm run build` | clean |
| `git diff --check 0fab5de 6df094f` | clean |

## Checked against the ASM and the plan

- **F-2 (shared list state):** `list_state.ts` holds `wListScrollOffset`, `wCurrentMenuItem`,
  `wBagSavedMenuItem` and `wSavedListScrollOffset`. `removeFromInventoryAt` zeroes all four only
  when the slot empties, as `RemoveItemFromInventory_` does, and an open list picks the reset up
  through a generation counter. The Mart saves and restores through it, so selling a whole stack
  now reopens at the top and QUIT restores 0. `items.ts` imports only the rendering-free module.
- **`StartMenu_Item` / `.choseItem`:**
  - The list opens on `wBagSavedMenuItem` and the shared scroll; the row is saved on every return.
  - The column-5 cells are blanked, then ▷ is placed.
  - USE/TOSS is (13,10)–(19,14) with its text at (15,11); MenuInput top (14,11), max 1, item 0.
  - **B is tested before A**, so A+B cancels.
- **Toss:**
  - A key item or HM goes straight to TooImportant, with no quantity box.
  - Otherwise: the plain quantity box (max = the stack), then IsItOK (`stringBuffer`, ends in a
    prompt), then YES/NO, then removal of the **selected** slot, then ThrewAway (`nameBuffer`).
  - NO, B and quantity B all go to `ItemMenuLoop`.
- **`ItemMenuLoop`:**
  - The logical tiles are released, the transfer is off, and the list is rebuilt.
  - The old message box lingers until the first bottom-third transfer after re-enable (pinned).
  - `.exitMenu` turns the transfer on and dismisses the box.
- **One owner per frame:** `item_menu` no longer calls `syncJoypadRead`; the session ticks the
  transfer once, through the TextBox or `ScreenTiles.present` (pinned).
- **USE:** balls → NotTime; the Town Map → `townMapFromBag` → `ItemMenuLoop`; party-menu items →
  the `ItemMenu` bridge, returning to `ItemMenuLoop` (c2 replaces it); others are listed gaps.
- `writeNumber` now always writes the ones digit (note 42 N-3). Note 42's N-1/N-2 tests are now
  observable.

## F-1 — OAK's PARCEL prints the wrong line (plan error; fix in A5b7c2)

`ItemUseOaksParcel` is `jp ItemUseNotYoursToUse` → **"This isn't yours / to use!"** (prompt),
not ItemUseNotTime. Note 43 (H5, §3.6.7) told Grok to print NotTime; Grok implemented the plan
and flagged the discrepancy correctly. `ItemUseNotYoursToUseText` isn't in
`text_programs.json`: its root has to be added in `rom/text_program_symbols.ts`, then setup
re-run. **Fold it into c2's data checkpoint** (with the heal SFX), then route OAKS_PARCEL to it.
It's reachable only between getting the Parcel and delivering it.

## Reviewer mutations (focused: `src/menus`, `src/story`, `src/text`, `items.test.ts`; 389 tests)

| Mutation | Result |
|---|---|
| `.exitMenu` leaves the transfer disabled | survived: **equivalent** (the only path, a list cancel, already re-enabled it) |
| A before B on USE/TOSS | caught |
| Message dismissed at once at `ItemMenuLoop` | caught |
| List state reset on a partial removal | caught (5) |
| Open list ignores an emptied slot | caught |
| Toss removes slot 0 instead of the selected one | caught |
| Key item gets a quantity box | caught |
| Lone 0 skipped by `writeNumber` | caught |
| **`wBagSavedMenuItem` not saved** | **survived** (N-1) |
| **Toss quantity ignored (always 1)** | **survived** (N-2) |

All restored; the tree was clean afterwards.

## Non-blocking notes

- **N-1 — "the cursor stays where you left it" isn't pinned.** The B test starts on a preset
  saved row and never moves the cursor, so deleting `setBagSavedMenuItem` passes. Add: move
  Down, B, reopen, ▶ on the new row. The code is right.
- **N-2 — tossing more than one isn't pinned.** Every toss test tosses 1. Add: Up to 2, YES,
  stack −2. The code is right.
- The bridge's medicine and party screen are today's approximations until c2, as planned.
- The plan's recorded gaps stand (START menu, Town Map exit frames, `UsableItems_CloseMenu`
  incl. ESCAPE_ROPE for V2, Repels, YES/NO drawing).

## User play-test

Note 43 §3.5 on `http://127.0.0.1:5173/`, **Z = A, X = B**. Expect the Parcel's USE to show
Oak's "not the time" line until c2 (F-1).

**User play-test passed 2026-10-15. A5b7c1 is done.** Next: A5b7c2 (Grok or Sol), whose data checkpoint also closes F-1
and should add the N-1/N-2 tests.
