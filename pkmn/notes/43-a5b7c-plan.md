# A5b7c plan: the bag from START, toss, field medicine, party-menu prompts

**2026-10-14 · Claude Opus 5.5 · Approved by the user 2026-10-14 ("yes to all", DECISIONS #56).
2026-10-15: made implementation-ready for Grok (§3.6, CP1 gains F-2). Next: Grok implements A5b7c1.**
Implementer: **Grok** (the user, 2026-10-15; was Sol). Claude reviews; the user play-tests.
**Grok: read §3 including §3.6 before writing code. Claude reviews, not the user; stop after CP5.**

Parent: `notes/39-a5b7-plan.md` §1 (A5b7c row) and §5 (field bag / party contract), DECISIONS
#52, #54 (the bag moves onto the shared list and quantity menus), #55 (order). Baseline:
**1331/1331** with the ROM, 1208/123 without (A5b7b + F-1, `notes/42-a5b7b-review.md`).

## 1. Recommendation: two slices

| Slice | Deliverable |
|---|---|
| **A5b7c1** | START → ITEM on the shared `ListMenu` (saved cursor, shared scroll), the USE/TOSS menu, the whole toss flow, USE for items that aren't party-menu items (Town Map, balls, the Parcel), and the return to the bag list. Note 42's N-1/N-2/N-3. |
| **A5b7c2** | `DisplayPartyMenu`'s prompts as PrintText programs (also START → POKéMON), field medicine as `ItemUseMedicine` runs it (status cures, Potions, Full Heal, Full Restore, Revive/Max Revive), the HP bar animation (`UpdateHPBar2`), and the heal sounds (§8 Q2). |

c1 is fully specified below. c2 is specified at the contract level, and its CP1 is a trace
that writes its frame anchors into this note before any code (§4).

## 2. What is wrong today (`menus/item_menu.ts`, `menus/party_menu.ts`)

| # | Today | Cartridge |
|---|---|---|
| H1 | Own 4-row list; ▲/▼ indicators; cursor resets to the top on every open | `DisplayListMenuID` (A5b7b). The cursor row is kept in `wBagSavedMenuItem`, and the scroll is the **shared** `wListScrollOffset` (the Mart saves and restores it for this reason). No ▲ |
| H2 | USE/TOSS cursor wraps; remembers its row | `USE_TOSS_MENU_TEMPLATE` (13,10)–(19,14), text at (15,11), HandleMenuInput top (14,11), max 1, A/B, **item 0 every time**, no wrap. The list's ▶ cells at (5,4/6/8/10) are blanked and ▷ placed first |
| H3 | Toss: own quantity box at (14,8); "Is it OK to toss" + YES/NO drawn together; "Threw away 3 POTION." | Plain quantity box (15,9) (A5b7b), max = the stack. `IsItOKToTossItemText` ends in a **prompt** (▼, A) **before** YES/NO at (14,7). Then remove the selected slot and `ThrewAwayItemText`: **"Threw away / POTION."**, no count |
| H4 | Toss a key item: "That's too / important to toss!" | No quantity box; `TooImportantToTossText`: "That's too impor- / tant to toss!" (prompt) |
| H5 | USE on a ball, the Parcel, etc.: invented "Can't use that here." | `ItemUseNotTime`: "OAK: <PLAYER>! / This isn't the / time to use that! " (`cont` ▼, then prompt) → back to the bag list |
| H6 | Town Map from the bag returns to the overworld | `ItemUseTownMap` returns into `UseItem` → `jp ItemMenuLoop`: **back to the bag list** |
| H7 | Every bag message is an instant two-line overlay with a beep on dismissal | PrintText programs: Delay3, letter delays (unless the no-delay flag is set), real prompts, `cont` scrolls |
| H8 | Field medicine: own party screen with invented header text; "X recovered by 20!" drawn instantly; HP +1 per 2 frames; no sounds; the "no effect" checks differ (Full Restore at full HP with a status fails) | `DisplayPartyMenu` (USE_ITEM) with `PartyMenuItemUseText`. RemoveUsedItem, SFX_HEAL_HP or SFX_HEAL_AILMENT, `UpdateHPBar2` (**2 frames per bar pixel**), a party redraw with the result message, 50 frames, a silent button wait, a white fade, then the **bag list** |
| H9 | START → POKéMON: "Move to where?" (invented) | `PartyMenuSwapMonText`: "Move #MON / where?"; normal `PartyMenuNormalText`: "Choose a #MON." Both no-delay PrintText |

All of these programs are already in `data/text_programs.json`: PartyMenuNormalText,
PartyMenuItemUseText, PartyMenuSwapMonText, PotionText (`nameBuffer` + `hpDifference`),
Antidote/ParlyzHeal/BurnHeal/IceHeal/Awakening/FullHeal/ReviveText, ItemUseNoEffectText,
ItemUseNotTimeText, IsItOKToTossItemText (`stringBuffer`), ThrewAwayItemText (`nameBuffer`),
and TooImportantToTossText.

## 3. A5b7c1: the bag and toss (fully specified)

Sources: `engine/menus/start_sub_menus.asm` (StartMenu_Item, ItemMenuLoop),
`engine/items/item_effects.asm` (UseItem's table, ItemUseBall, ItemUseTownMap,
UnusableItem, ItemUseNotTime, TossItem_), `data/items/use_party.asm`,
`data/items/use_overworld.asm`, `data/text_boxes.asm`, `home/list_menu.asm`.

### 3.1 Design

- **One bag session** (`menus/bag.ts`, replacing `item_menu.ts`'s list/toss/message parts),
  running in `main.ts`'s existing `item_menu` state. It reuses `ScreenTiles`, `ListMenu`,
  `QuantityMenu`, `MenuInput`, `YesNoMenu` and the shared `textBox` / `textBgTransfer`, with
  the same **one-owner-per-frame** contract as the Mart: one transfer tick and at most one
  Joypad owner per frame, with a test.
- **PrintText outside a display:** the START menu runs outside our DisplayTextID sessions,
  so the bag's messages use `textBox.printStandalone(program, { bindings })`. That's a new box,
  Delay3, then the program, retained on return (A5b7a CP2). Their rows 12–17 are released in
  `ScreenTiles` as in the Mart.
- **Buffer2 = the START menu screen.** `ItemMenuLoop`'s `LoadScreenTilesFromBuffer2DisableBGTransfer`
  becomes: drop the bag's tiles and the retained message box, transfer **off**. The START
  menu stays drawn by `startMenu.render()`. The next `DisplayListMenuID` keeps it off for its
  10 frames, so the restored screen and the new list appear together at +11.
- **`wListScrollOffset` becomes one shared variable.** Move it from `pokemart.ts` into the list
  module, and use it for the bag. `wBagSavedMenuItem` is a new bag-owned value, kept across
  START visits in this session only (it's WRAM, not saved; it does not need to survive
  CONTINUE).

### 3.2 Flow (label by label)

| Label | Behavior |
|---|---|
| `StartMenu_Item` | List ITEMLISTMENU over the bag, item = `wBagSavedMenuItem`, offset = shared. After the list returns, save the cursor row. Cancel/B → `.exitMenu` (existing return to START, cursor on ITEM) |
| `.choseItem` | Blank (5,4),(5,6),(5,8),(5,10); ▷ at the cursor; clear the swap mark. USE/TOSS box and text; MenuInput top (14,11), max 1, item 0, A/B. Then ▷. B → `ItemMenuLoop` |
| USE, item in `UsableItems_PartyMenu` | **c1:** keep today's medicine path working unchanged (bridge). **c2** replaces it |
| USE, item in `UsableItems_CloseMenu` | None obtainable yet: keep the existing behavior, recorded as a gap (Escape Rope is A3) |
| USE, anything else | `UseItem`'s table: TOWN_MAP → DisplayTownMap, then `ItemMenuLoop` (**fix H6**). Balls (out of battle), OAK's PARCEL and other `UnusableItem`s → `ItemUseNotTimeText` (prompt) → `ItemMenuLoop` |
| TOSS, key item or HM | `TossItem_` → `TooImportantToTossText` (prompt) → `ItemMenuLoop`. No quantity box |
| TOSS, other | Plain quantity box, max = stack; B → `ItemMenuLoop`. A → `IsItOKToTossItemText` (`stringBuffer` = name; ends in a prompt) → YES/NO (14,7). NO/B → `ItemMenuLoop`. YES → `bag.removeAt(selectedIndex, qty)` → `ThrewAwayItemText` (`nameBuffer` = name) → `ItemMenuLoop` |
| `ItemMenuLoop` | Buffer2 restore with the transfer off (above), then `StartMenu_Item` again |

### 3.3 Frame anchors c1 pins (symbolic, as note 41 §4.6)

- Bag open (O): the list is written at O and hidden for 10 frames; first visible O+11; first read O+16.
- A on an item (Q, press_ab): ▷, USE/TOSS written at Q; first read Q+3; A/B press_ab.
- TOSS A (R): quantity box at R; first read R+1; silent.
- Quantity A (P): new message box at P (row 12 back to the message border); first glyph P+3;
  the prompt's ▼ after ProtectedDelay3; A beeps.
- After the prompt returns (D): YES/NO at D, first read D+3, 15-frame tail.
- YES: the slot is removed at the tail's end; ThrewAway new box, Delay3, typed, prompt.
- After any prompt (B′): `ItemMenuLoop`. The list and the restored START screen are visible
  at B′+11, with the cursor on the saved row and the scroll kept.
- Town Map close → the bag list as at O.

### 3.4 Checkpoints (c1)

**CP1 — list follow-ups (note 42).** N-1: make the merge-reset assertion observable. N-2:
pin the A/B-held re-arm of 5. N-3: `writeNumber` writes a lone 0 in the ones digit as
PrintNumber does. **Shared list state and F-2 (§3.6.1):** move `wListScrollOffset` out of
`pokemart.ts` into a tiny shared module with `wBagSavedMenuItem` and `wSavedListScrollOffset`,
and reset all three (plus the open list's cursor) when a removal empties a slot, as
`RemoveItemFromInventory_` does. Fix the Mart to use it; add the regression test (a scrolled
SELL list, sell a whole stack → the list reopens at offset 0, row 0; after QUIT the offset is 0).

**CP2 — bag list, USE/TOSS, exit.** Bag session, list with the saved cursor and shared
scroll, the USE/TOSS menu, B/CANCEL to START, `ItemMenuLoop` with Buffer2 and the transfer
switch, one-owner tests through main's `item_menu` dispatch.

**CP3 — toss.** Quantity, IsItOK prompt, YES/NO, removal of the selected slot (a later
duplicate stack stays), ThrewAway, TooImportant (no quantity), all returns. Delete the invented
messages.

**CP4 — USE for non-party items.** NotTime for balls and the Parcel (`cont` ▼ + prompt); the
Town Map returning to the bag (H6). Keep the existing medicine bridge working; regression tests.

**CP5 — integration and handoff.** Full suites, build, a muted browser smoke on a spare port
(open the bag, scroll, toss a stack, toss a key item, USE a ball, USE the Town Map and return,
leave to START), docs, the note's result section, STATUS. Suggested self-mutations: cursor
not saved; scroll reset on reopen; YES/NO shown before the prompt returns; tossing the first
matching stack instead of the selected slot; Town Map returning to the overworld; a quantity
box for a key item; an emptied slot keeping the scroll (F-2); the transfer left disabled after
leaving the bag; the message box dismissed at once at `ItemMenuLoop`; A+B on USE/TOSS choosing USE.

### 3.5 c1 user play-test

START → ITEM: scroll the bag, then close and reopen it, and the cursor is where you left it.
TOSS 2 POTION: "Is it OK to toss POTION?▼", A, YES/NO, YES, "Threw away POTION.". TOSS
TOWN MAP: "That's too impor-tant to toss!". USE a POKé BALL: "OAK: RED! This isn't the
time to use that!". USE TOWN MAP and close it: you're back in the bag. In the Mart, scroll the SELL
list, sell a whole stack: the list comes back at the top (F-2). **Z = A, X = B.**

### 3.6 Implementation details verified 2026-10-15 (read before coding)

Re-checked against `home/start_menu.asm`, `home/tilemap.asm`, `home/palettes.asm`,
`engine/items/inventory.asm`, `engine/items/town_map.asm`, `engine/menus/start_sub_menus.asm`
and today's `main.ts`, `menus/{start_menu,item_menu,pokemart,list_menu,screen_tiles}.ts`.

**3.6.1 — F-2: emptying a slot resets the shared list state (also a fix to A5b7b).**
`RemoveItemFromInventory_` zeroes `wListScrollOffset`, `wCurrentMenuItem`, `wBagSavedMenuItem`
and `wSavedListScrollOffset` whenever the removed quantity empties the slot (a partial removal
changes none of them). It applies to every caller: toss, the Mart's sale, Potions (c2), the PC
(A5b7d), the battle bag and `Bag.remove` (RemoveItemByID → the Parcel). Today `pokemart.ts` keeps
the scroll after selling a whole stack and restores a stale saved offset at `.done`. Put the
three values in one shared module (no imports from menus into `items.ts`; a small module both
can import, or a registered callback). The module must not depend on rendering.

**3.6.2 — The bag session and its owner.** The `item_menu` state's update becomes the bag
session. Per frame, exactly one BG transfer tick: through `textBox.update()` /
`textBox.updateDisplay()` while the message box is active, otherwise `textBgTransfer.tick()`
directly (`ScreenTiles.present()` already does this), copying the bag's third on the same tick.
At most one Joypad owner per frame (the Mart's test pattern, through `main.ts`'s dispatch).
`drawUiLayer`'s `item_menu` case: `startMenu.render()`, then `textBox.render()`, then the bag's
tiles (so the list's row-12 border overlays the message box's top border), then YES/NO.

**3.6.3 — PrintText.** `textBox.printStandalone({ program }, { bindings })`: a new box at T,
first glyph at T+3, a real prompt. Releasing rows 12–17 in `ScreenTiles` works as in the Mart:
a new message box covers the lower rows of the USE/TOSS box (rows 12–14), and its rows 10–11
stay visible. The USE/TOSS box is drawn while no message box exists.

**3.6.4 — `ItemMenuLoop` and the 10 hidden frames.** `LoadScreenTilesFromBuffer2DisableBGTransfer`
restores wTileMap with the transfer **off**, and `DisplayListMenuID` keeps it off for 10 more
frames. VRAM keeps showing the old screen until the transfer comes back:
- the bag's tiles: set the logical map to null (Buffer2 is START + map), and the frozen shown
  copy keeps showing them (free with `ScreenTiles`);
- **the message box must also stay visible** until the first bottom-third transfer after the
  re-enable (B′+11…B′+13 by portion). Don't `dismiss()` the TextBox at once. Give it a
  release-on-next-bottom-transfer (or an equivalent) and test the frame it disappears.

**3.6.5 — Leaving the bag.** `.exitMenu` uses `LoadScreenTilesFromBuffer2`, which turns the
transfer **on**. Every exit from the bag must leave `textBgTransfer.enabled === true` and the
TextBox inactive (test it, or the Mart and every later screen inherit a disabled transfer).
The bag's tiles go at once on exit to START (the ≤3 frames of thirds there are a recorded
approximation). START itself stays as it is today (`start_menu.ts`'s redisplay and input are not
in c1; record the gap: wrap, ▷, Delay3 belong to the START menu audit, A5b7f/J2).

**3.6.6 — The USE/TOSS menu takes B before A.** After its HandleMenuInput, StartMenu_Item tests
`bit B_PAD_B` first: **A+B together cancels** (`ItemMenuLoop`). That's the opposite of
`DoBuySellQuitMenu` (A5b7b F-1). Pin both in tests. `wMenuItemToSwap` is cleared at `.choseItem`,
and the four column-5 blanks erase any swap marker ▷ before the cursor's ▷ is placed again.

**3.6.7 — USE dispatch for c1.** Port `UsableItems_PartyMenu` and `UsableItems_CloseMenu` as data
and the `ItemUsePtrTable` routine *names* for the items in `items.ts`. Implement only:
`ItemUseBall` out of battle → NotTime; `UnusableItem` (OAK's PARCEL and other key items routed
there) → NotTime; `ItemUseTownMap` → DisplayTownMap → `ItemMenuLoop`. Party-menu items take the
**medicine bridge**: move today's party-select, heal animation and result-message code out of
`item_menu.ts` into one temporary module the bag runs full-screen, and return into
`ItemMenuLoop` (c2 deletes it). Any other routine keeps today's behavior and is listed in the
result's gap table. **Heads-up for V2:** Pewter's Mart sells ESCAPE_ROPE
(`UsableItems_CloseMenu`, A3's `ItemUseEscapeRope`). V2's plan must route it.

**3.6.8 — The Town Map from the bag.** Add a `townMapFromBag` return in `main.ts`, beside
`townMapFromScript`. Closing returns to `item_menu` at `ItemMenuLoop`, not the overworld.
`ExitTownMap` clears the screen before that, so the cartridge shows a blank screen until the
list's transfer at +11. That belongs to the deferred Town Map exit audit (A5b6); record it and
don't fake it.

**3.6.9 — Exact c1 anchors** (S = the START menu's A on ITEM; the rest as §3.3):
- **Bag open:** the list is written at S; first visible S+11; first read S+16. Cursor =
  `wBagSavedMenuItem`, offset = shared.
- **A on an item (Q, press_ab):** column-5 blanks, ▷, USE/TOSS at Q; first read Q+3.
- **USE/TOSS:**
  - B, or A+B, at R (press_ab) → `ItemMenuLoop` at R; visible R+11.
  - TOSS A at R → quantity at R; first read R+1, silent. A key item instead gets a TooImportant
    box at R, first glyph R+3.
- **Quantity A (P, silent):** IsItOK box at P, first glyph P+3; prompt ▼ after ProtectedDelay3.
- **The prompt returns (D):** YES/NO; first read D+3; tail to Y+15.
- **YES:** remove at Y+15; ThrewAway box at Y+15, glyph Y+18, prompt. Then `ItemMenuLoop` at B′:
  the old message stays until the bottom-third transfer after B′+10; the list is visible
  B′+11…13; first read B′+16.
- **USE on a ball or the Parcel (R):** NotTime box at R, glyph R+3. "OAK: <PLAYER>!" /
  "This isn't the", then the `cont` ▼ (A, beep, scroll), "time to use that! ", prompt. Then
  `ItemMenuLoop`.
- **List B/CANCEL (X):** `wBagSavedMenuItem` saved, transfer on, back to START at X.

## 4. A5b7c2: party-menu prompts and field medicine (contract level)

Sources: `home/pokemon.asm` (DisplayPartyMenu, PartyMenuInit, HandlePartyMenuInput),
`engine/menus/party_menu.asm` (RedrawPartyMenu_, `.printMessage`, the message tables),
`engine/items/item_effects.asm` (ItemUseMedicine, ItemUseNoEffect, RemoveUsedItem),
`engine/gfx/hp_bar.asm` (UpdateHPBar2, UpdateHPBar_AnimateHPBar).

**CP1 — trace and anchors (no code).** Trace DisplayPartyMenu → DrawPartyMenu →
`.printMessage` (no-delay PrintText, transfer on, Delay3, GBPalNormal) → HandlePartyMenuInput
(wrap on, icon animation flag, saved cursor `wPartyAndBillsPCSavedMenuItem`). Trace each medicine
outcome to its return into `StartMenu_Item`. Write the frame anchors into this note, as note
41 §4.6 did, before any code.

Contract to implement:

1. **Party-menu prompts** (also START → POKéMON): PartyMenuNormalText, PartyMenuItemUseText,
   PartyMenuSwapMonText as no-delay PrintText; delete "Move to where?" and the invented headers.
   Item use goes through the **shared** party menu (a USE_ITEM mode on `PartyMenu`), not
   `item_menu.ts`'s private copy, which is deleted. Keep the existing wrap and cursor behavior;
   the icon animation and the starter-Pikachu branch of HandlePartyMenuInput stay as they are
   (J2 party-menu audit, recorded).
2. **ItemUseMedicine, for the items that exist:** B → cancelled → the bag. A on a mon:
   Pikachu happiness USEDITEM for items ≤ CALCIUM, **before** the effect check (existing
   quirk, kept).
   - Status items: the matching status bit (Full Heal: any) → clear it.
   - HP items: fainted → no effect (unless Revive/Max Revive); full HP → no effect, **except
     Full Restore with a status, which becomes Full Heal** (fixes the bug in note 39 §6).
     Otherwise +20/+50/+200 or max, clamped; Full Restore also clears status; Revive → ½ max.
   - Success: RemoveUsedItem (one, from the selected slot), the heal sound
     (PlaySoundWaitForCurrent), then for HP the `UpdateHPBar2` animation on that row
     (2 frames per bar pixel, HP steps without a pixel change cost nothing, a final redraw,
     Delay3). Then a party redraw with the result message (`nameBuffer` = nickname, Potion's
     `hpDifference`), 50 frames, a silent button wait, white fade, the bag list.
   - No effect: `ItemUseNoEffectText` (typed, prompt) → the same exit.
3. **The HP bar animation** as a small shared module (battle adopts it in A5c).
4. Vitamins, Rare Candy, evolution stones, PP items, drinks, X items: none obtainable yet.
   Keep the existing behavior, recorded as gaps with homes (B/C phases).

c2's own checkpoints and play-test are written in its CP1 trace.

## 5. Out of scope

Battle bag use (A5c), the Bicycle and `UsableItems_CloseMenu` items (A3/C), TMs/HMs (A2),
the party menu's icon animation and starter-Pikachu input branch (J2), Softboiled (field moves).

## 6. Risks

- **PrintText without a display session:** `printStandalone` was built for Oak's speech.
  Retaining and dropping its box at `ItemMenuLoop` must not leave a stale box under the START
  menu. Test the frame it disappears.
- **The shared scroll variable** must keep the Mart's save/restore exact (re-run the Mart's tests).
- **c2's party-menu change** touches START → POKéMON. Its existing tests and the A6e nurse/
  Pikachu fixtures must stay green.

## 7. Verification

Each checkpoint: focused tests, typecheck, local commit. Full ROM/no-ROM suites and build at
the last checkpoint of each slice. Browser smoke on a spare port, never :5173. Review by
Claude, then the user play-test.

## 8. Decisions for the user (O-25)

1. **Split A5b7c into c1 (bag + toss) and c2 (party prompts + medicine).** *Recommended:*
   each is about as big as A5b7b, and c2 touches the shared party menu.
2. **Extract SFX_HEAL_HP and SFX_HEAL_AILMENT in c2** (a small data checkpoint, the A5b3
   precedent, with the bank $02/$1f guard). *Recommended:* otherwise field healing is silent.
   This amends note 39 §6's exclusion for these two sounds only (cries stay excluded).
3. **Port `UpdateHPBar2` now as a shared module** (§4.3). *Recommended:* the current
   1-HP-per-2-frames timing is wrong for nearly every Pokémon, and battle reuses it in A5c.
4. **Fix the Full Restore branch in c2** as part of porting ItemUseMedicine. *Recommended:*
   it's a TypeScript bug, not a cartridge quirk; the cartridge cures the status.
5. **Who:** Sol implements c1 (then c2), Claude reviews each, the user play-tests each.
