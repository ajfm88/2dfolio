# A5b7d review: Red's item PC and the Pokécenter PC

**2026-10-15 · Claude · Reviewed Sol's implementation of `notes/47-a5b7d-plan.md`
(CP1 `ef19db9` … CP5 `d53349f`). Verdict: passes, with one small required fix (F-1) before the
play-test.**

## Gates (re-run by Claude from `d53349f`)

- `npm run typecheck`: clean.
- `ROM_PATH=pokeyellow.gbc npm test`: **1433/1433** (78 files).
- `npm test`: **1303 pass / 130 skip**.
- `npm run build`: clean. `git diff --check d6142c2..HEAD`: clean.

## Traced against the ASM

`engine/menus/players_pc.asm`, `engine/menus/pc.asm`, `engine/menus/oaks_pc.asm`,
`DisplayPCMainMenu` (`engine/pokemon/bills_pc.asm`), `TossItem_`, `ReloadMapData`.

These match:
- PlayerPC: `wBagSavedMenuItem` / `wParentMenuItem` zeroed; `turn_on_pc` before `TurnedOnPC2Text`
  (direct only).
- PlayerPCMenu: no-delay text, restored parent cursor, Buffer2 restore, the 8×14 box, entries,
  scroll offset zeroed, B tested first.
- The branches: cursor and offset zeroed; empties checked once at entry (an emptied list at
  `.loop` shows just CANCEL, as the cartridge); key items and HMs skip "How many?";
  add → remove (the selected slot) → wait → `withdraw_deposit` → wait → message; failures back
  to `.loop`.
- PC toss: TooImportant for key items / HMs, IsItOK + silent YES/NO, NO back to `.loop` with no
  message.
- ExitPlayerPC: `turn_off_pc` + wait only when direct; Buffer2; offset and bag cursor zeroed.
- ActivatePC: the box-less Buffer2, the turn-on sound, typed text, the wait after the prompt,
  Delay3.
- DisplayPCMainMenu: both layouts by GOT_POKEDEX; SOMEONE's / BILL's by MET_BILL; cursor 0; the
  transfer turned off while drawing.
- The children: `enter_pc` + wait; typed Accessed texts; nested PlayerPC without power sounds.
- Oak's PC: its own Buffer2, two typed texts, a silent YES/NO, the closing text with
  waitbutton, the restore, then ReloadMainMenu.
- LogOff: `turn_off_pc` + wait.
- Both entries close with no outer wait (HoldTextDisplayOpen); auto box on for Red, off for the
  Pokécenter.
- The YES/NO box sits at (14,7), as `InitYesNoTextBoxParameters` / TWO_OPTION_MENU place it.

I also checked one edge case. After Oak's PC, Buffer2 holds the main menu. In the cartridge,
ReloadMapData's `LoadCurrentMapView` rewrites wTileMap before DisplayPCMainMenu saves it again;
ours never does that rewrite. It is harmless: the next menu's TextBoxBorder blanks the whole
8×14 interior, so nothing stale shows. A probe confirmed the item menu draws clean after Oak's PC.

## Mutations

Sol ran eight; all were caught. Claude ran seven more, and the PC tests caught all seven. Each
was reverted:

1. The withdraw/deposit sound plays without waiting for the current one.
2. The PC toss YES/NO beeps.
3. A key item asks "How many?".
4. The transfer removes slot 0 instead of the selected slot.
5. Oak's YES/NO beeps.
6. The nested item PC plays `turn_off_pc` on exit.
7. The main menu always uses the Pokédex layout.

## Findings

### F-1 (required, small): the PC menus draw ▷ where the cartridge keeps ▶

`pc.ts` `frame()` draws `▷` on any A or B press in both menus (`drawCursor(hit ? '▷' : '▶')`).

- **The main menu:** `PCMainMenu` never calls `PlaceUnfilledArrowMenuCursor`, and
  HandleMenuInput leaves the cursor as it was. So the main menu keeps a **filled ▶** while the
  `enter_pc` wait, the Accessed text, Oak's text and YES/NO, and LOG OFF's `turn_off_pc` wait
  are on screen. Ours shows ▷; Sol's screenshot `05-oak-choice.png` shows it next to PROF.OAK's
  PC.
- **PlayerPCMenu:** `PlaceUnfilledArrowMenuCursor` runs only *after* `bit B_PAD_B` /
  `jp nz, ExitPlayerPC`. So **B** keeps ▶ during the `turn_off_pc` wait; A (including A on LOG
  OFF) draws ▷. Ours draws ▷ on B too.

**Fix:**
- In the main menu, never draw ▷.
- In PlayerPCMenu, draw ▷ only when the hit has A and not B.
- Add tests: A on PROF.OAK's PC keeps ▶; B in Red's PC keeps ▶ during the turn-off wait; A on
  LOG OFF shows ▷.

### Notes (no action needed now)

- **N-1: the menu painter changed for the Mart and the bag too.** CP5's `drawScreenTile` paints
  every wTileMap cell opaque and draws the six border characters from the border sheet. Before
  this, those characters had no font mapping. That is the cartridge's behavior and a correct
  fix, but it changes how two user-verified screens are drawn. **Play-test addition:** glance at
  the Mart's BUY/SELL/QUIT box and the bag list once.
- **N-2:** the `MET_BILL` flag is never set yet (Bill is on Route 25). When it arrives, it must
  use this same name.
- **N-3:** note 46 N-4 (the party cursor clamp) moves to A5b7e with Bill's menu, as Sol
  recorded.
- The bridge reads the joypad once per frame on top of BillsPcMenu's own `isPressed`. That is
  acceptable for an approved bridge; A5b7e replaces it.

## F-1 fixed (Claude, at the user's request)

`pc.ts` now draws ▷ only for `hit && !this.mainMenu && !hit.includes('b')`. Three tests in `menus/pc.test.ts`:
A on PROF.OAK's PC keeps ▶; B keeps ▶ through the turn-off sound; A on LOG OFF shows ▷. With the fix reverted,
the first two fail; the third guards against never drawing ▷. Gates: ROM **1436/1436**, no-ROM 1306/130,
typecheck/build/diff check clean.

## Next

1. ~~Fix F-1~~ done.
2. ~~The user play-test~~ **passed 2026-10-15 ("all works well"). A5b7d is done.** Was: the user play-test (note 47 §7), plus N-1's glance at the Mart and the bag.
