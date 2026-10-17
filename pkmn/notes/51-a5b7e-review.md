# A5b7e review: Bill's PC (Sol, CP1–CP5)

**2026-10-15 · Claude · Passes. No required fix. User play-test passed 2026-10-15 (note 49 §8): A5b7e is done.**

Reviewed commits `8f05658`…`8db95fd` against approved note 49 (DECISIONS #58), Sol's CP1 plan (note 50) and
the result sections (note 49 §§10–14).

## 1. Gates (re-run by Claude)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `ROM_PATH=pokeyellow.gbc npx vitest run` | **1499/1499**, 83 files |
| `npx vitest run` (no ROM) | **1369 pass / 130 skip** |
| `npm run build` | clean, 353.46 kB (gzip 107.33 kB) |

Working tree clean before and after. No generated-data change after CP1. CP1's two programs (`NoPokemonText`
$3A:$4E1F → `_NoPokemonText` $28:$4C77) match pret's sym.

## 2. Traced against the ASM

`menus/bills_pc.ts` was read line by line against `engine/pokemon/bills_pc.asm`, `engine/menus/save.asm`
(ChangeBox, DisplayChangeBoxMenu), `home/list_menu.asm` and `engine/events/pikachu_happiness.asm`.

| Area | Verdict |
|---|---|
| Entry: flag set, parent 0, offset pushed, 4 + 1 copy frames, menu at +5, first read +11 | matches |
| BillsPCMenu: Buffer2, the bottom box then the main box, UpdateSprites, six entries, the cursor/offset/party-cursor zeroing, BOX No. (1–9 at col 18, 10–12 from col 17), Delay3, silent HandleMenuInput, B first, ▷ only after A | matches |
| Checks and their order: withdraw (empty box, full party), deposit (last mon, then full box), release (empty box), PRINT BOX (empty box) | matches |
| DisplayMonListMenu: the saved row in, the row out; offset carried; two UpdateSprites; levels at (14,y+1), level 100 over `<LV>` | matches |
| DisplayDepositWithdrawMenu: box (9,10) 6×9, labels, top (10,12), offset and party cursor zeroed, B/CANCEL out, STATS round trip with Buffer1, cursor back on STATS at E+6 | matches |
| Deposit: starter + following-disabled check, cry stub, DEPOSITED only for the starter, append then remove, real sound wait, bindings | matches |
| Withdraw: append (deserialized) then remove, wait, MonIsTakenOut | matches |
| Release: starter refusal (no YES/NO, no mutation); OnceReleased (done), silent YES/NO; NO → `.loop` on the same row/offset with the stale question; YES removes after the 15-frame tail | matches |
| Change Box: warning + silent YES/NO; the chooser typed with transfer off; boxes single-spaced (`rowStep: 1`); balls on non-empty boxes; BOX No. at (1,2)/(8–9,2); B → no save; A → wait current, play `save`, wait, switch (even to the same box), save | matches |
| Exit: Buffer2, offset popped, flag cleared, no turn-off, A5b7d's ReloadMainMenu | matches |
| F-1: `text_flags.ts`; ListMenu sets it on open and clears it on A/B; YesNoMenu clears it; PlayerPCMenu sets it on each pass; both exits clear it; `PcDisplay.print` reads it | matches (`list_menu.asm:19,170,329`, `text_box.asm:208,282`) |
| F-2: `monDisplayName` in field medicine, party lists and Bill's PC | matches the plan |
| DEPOSITED mood: `min(mood, $62)` | matches `.decreased` (writes the target unless mood is already lower) |
| N-4: BillsPCMenu and the submenu zero `wPartyAndBillsPCSavedMenuItem`; the PartyMenu clamp is kept as a guard | closed |

Two of Sol's CP1 findings correct my plan, and both are right:
- The first UpdateSprites after a transfer is in the result PrintText, not the next BillsPCMenu.
- The chooser appears over three VBlank thirds, not "at once".

The follower adapter (`reconcileStorageParty` plus a pending status-0 spawn) follows `SpawnPikachu_` /
`TrySpawnPikachu` / `ShouldPikachuSpawn`. I traced it through `main.ts`:
- A withdrawal leaves `visible` true, so the `scriptEnded` re-check doesn't call `spawn()` behind the player.
- A deposit stays hidden.
- A fainted withdrawal stays absent.

## 3. Reviewer mutations (each restored; focused suites of 90 tests)

| # | Mutation | Result |
|---|---|---|
| M1 | No ▷ after a main-menu choice | caught (3) |
| M2 | WITHDRAW/DEPOSIT submenu labels swapped | **survived** (N-1) |
| M3 | BillsPCMenu doesn't zero the party cursor | caught (1) |
| M4 | Chooser double-spaced | caught (2) |
| M5 | Exit leaves no-delay set | caught (1) |
| M6 | Chooser number misplaced | caught (1) |
| M7 | No balls on non-empty boxes | caught (1) |
| M8 | `<LV>` at column 15 | caught (4) |
| M9 | Submenu doesn't zero the party cursor | survived, **equivalent**: BillsPCMenu zeroes it before anything reads it |
| M10 | Empty bottom box (0,12) not drawn | **survived** (N-1) |
| M11 | List B doesn't clear the flag | caught (2) |
| M12 | STATS returns the cursor to DEPOSIT | caught (2) |

That is 9 of 11 non-equivalent mutations caught, plus Sol's 11.

## 4. Notes (none block the play-test)

- **N-1:** two layout lines have no assertion: the submenu's WITHDRAW/DEPOSIT label, and BillsPCMenu's empty
  bottom box at (0,12) 4×18 (M2, M10). The code is right. Add the two assertions in A5b7g, or now if you
  want them.
- **N-2:** `storageSpawnPending` can stay set after a PC visit with an ineligible starter. That happens before
  the lab, or with a fainted Pikachu. It is harmless today, because every path that shows the follower again
  (`spawn`, `spawnAtState`) clears it, and an invisible follower isn't updated. Recheck it in the Pikachu
  state audit, or wherever a new path sets `visible` without spawning.
- **N-3 (already logged, STATUS "Found during A6b"):** the older happiness events nudge the mood by one where
  the ASM writes the target directly. DEPOSITED is ported exactly. The rest belong to the Pikachu audit.

## 5. Verdict

**Passes.** The user can play-test note 49 §8 at `http://127.0.0.1:5173/` (**Z = A, X = B**). Release is
permanent.
