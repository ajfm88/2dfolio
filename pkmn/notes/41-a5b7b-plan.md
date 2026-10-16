# A5b7b plan: the Poké Mart, as `pokemart.asm` runs it

**2026-10-14 · Claude Opus 5.5 · Approved by the user 2026-10-14 ("yes to all", DECISIONS #54).**
Implementer: Sol or Grok (the user's choice). Claude reviews; the user play-tests.

Parent: `notes/39-a5b7-plan.md` §1 (A5b7b row), §3 (architecture), §5 (Mart contract),
§6 (scope limits); DECISIONS #52. Baseline: 1299/1299 with the ROM, 1176/123 without,
typecheck and build clean (A5b7a, `notes/40-a5b7a-review.md`).

## 1. What this slice delivers

Talking to the Viridian Mart clerk after Oak gets his parcel runs
`DisplayPokemartDialogue` and `DisplayPokemartDialogue_` exactly: the greeting, the
MONEY box, BUY/SELL/QUIT, the cartridge's list menu and quantity box, the price
questions with YES/NO, the purchase and sale effects and sounds, every failure branch,
the screen restores, and the exit through `AfterDisplayingTextID`. The current
`ShopMenu` and the `openShop` path are retired.

Three shared pieces come first, because the Mart cannot be 1:1 without them and the bag
(A5b7c) and PCs (A5b7d) reuse them:

1. **A screen tile model** for menus: wTileMap writes in source order, the
   `wTileMapBackup` save/restore (Buffer1) including the message box, and the
   auto-transfer switch.
2. **`DisplayListMenuID`** for the two item list kinds (`ITEMLISTMENU`,
   `PRICEDITEMLISTMENU`), with the cartridge's cursor, scrolling, auto-repeat and
   SELECT swap.
3. **`DisplayChooseQuantityMenu`**, both layouts.

No extractor or generated-data change. No change to inventory rules (`items.ts`
already matches `AddItemToInventory_`/`RemoveItemFromInventory_`, A1b).

## 2. Sources read for this plan (all `refs/pokeyellow/`)

`engine/events/pokemart.asm` · `home/text_script.asm` (DisplayTextID,
DisplayPokemartDialogue, LoadItemList, AfterDisplayingTextID, HoldTextDisplayOpen) ·
`home/list_menu.asm` (DisplayListMenuID, DisplayChooseQuantityMenu, ExitListMenu,
PrintListMenuEntries) · `engine/menus/swap_items.asm` · `engine/menus/text_box.asm`
(DisplayTextBoxID, DisplayMoneyBox, DoBuySellQuitMenu, DisplayTwoOptionMenu, its 5×6
save/restore) · `data/text_boxes.asm` · `home/window.asm` (HandleMenuInput_,
PlaceMenuCursor, HandleDownArrowBlinkTiming) · `home/joypad2.asm`
(JoypadLowSensitivity) · `engine/joypad.asm` · `home/tilemap.asm` (Buffer1) ·
`home/inventory.asm` (AddAmountSoldToMoney) · `engine/items/inventory.asm` ·
`engine/math/bcd.asm` (AddBCD's cap) · `home/print_bcd.asm`, `home/print_num.asm` ·
`data/text/text_7.asm` (the eleven Mart texts) · `data/items/marts.asm`.

Code read: `menus/shop_menu.ts`, `menus/menu_input.ts`, `menus/yes_no_menu.ts`,
`menus/menu_render.ts`, `text/{textbox,text_printer,text_runner,bg_transfer}.ts`,
`script/script_controller.ts` (display commands, Town Map handoff, ScriptDeps),
`story/{text_handlers,pokecenter}.ts`, `overworld/{overworld_controller,story_state}.ts`
(clerk dispatch, table selection), `items.ts`, `main.ts` (shop state, drawUiLayer),
committed `data/text_programs.json` (all Mart programs and `ViridianMart_TextPointers2`).

## 3. What is wrong today (the gap list)

| # | Today (`shop_menu.ts`) | Cartridge |
|---|---|---|
| G1 | Opens as its own `shop` state, outside any display | DisplayTextID session: greeting PrintText, menus, ThankYou, then **AfterDisplayingTextID** (silent button wait, Hold, close) |
| G2 | BUY/SELL/QUIT keeps the last cursor | `.loop` resets `wCurrentMenuItem` to 0 (BUY) every time; ▷ (unfilled) stays on the choice after A/B |
| G3 | Item list box at (3,2), 4-row cursor, price `¥`+number right-aligned by string length | `LIST_MENU_BOX` (4,2)–(19,12); 4 names, **cursor reaches only the 3rd row**; prices 3-byte BCD right-aligned at name+(5,1); ▼ at (18,11); CANCEL as an entry |
| G4 | Quantity box at the bottom right; up/down clamp at 1..affordable; A/B beep | Priced box (7,9)–(19,11): `×01` at (8,10), price at (12,10); **wraps 1..99** (buy) or 1..stack (sell); **no sounds**; no Delay3 |
| G5 | No price question, no YES/NO | `PokemartTellBuyPriceText` (with a `cont` ▼ after "That will be") or `PokemartTellSellPriceText`, then TWO_OPTION at (14,7) |
| G6 | Buy: no sound | Add to bag, subtract money, `SFX_PURCHASE` (wait for current, then wait to finish), then `PokemartBoughtItemText` (prompt) |
| G7 | Sell list filters out ¥0 items | Whole bag; key items show no `×qty`; selecting a key item or HM → `PokemartUnsellableItemText` → back to BUY/SELL/QUIT |
| G8 | Sell prints an invented "Sold X for ¥Y!" | **No message.** AddAmountSoldToMoney (cap ¥999999, MONEY box redrawn, `SFX_PURCHASE` with waits), remove the selected slot, back to the list |
| G9 | Money box redraws instantly every frame | MONEY box redrawn at specific points only; after a purchase the old amount stays until the Bought prompt is dismissed |
| G10 | Box overlap drawn as independent layers | One BG tilemap: the list's bottom border (row 12) sits on the message box's top border until the next PrintText redraws it; Buffer1 restores bring back "Take your time." / "What would you like to sell?" |
| G11 | List has no SELECT swap, no auto-repeat | SELECT swaps bag slots (also inside the Mart's SELL list); held Up/Down repeats after 30 frames, then every 5 |

## 4. Design

### 4.1 Entry and exit (G1)

- Register a **`mart` text script** (`registerTextScript('mart', …)`, as the nurse does
  in `story/pokecenter.ts`). `handlerAction` already resolves `ViridianMart_TextPointers2`
  after OAK_GOT_PARCEL, which keeps the parcel-before-shop table selection. The handler
  needs the clerk's inventory: add `shopItems` (from the interacted NPC's data) to
  `TextHandlerContext`.
- Commands: `displayOpen` → `printText PokemartGreetingText` (box `new`) →
  **`{ type: 'pokemart', items }`** → `displayClose { outerWait: true }`. The greeting's
  first glyph lands at T+23, as the nurse's does.
- The `pokemart` command creates a `PokemartSession` that the script controller ticks
  **once per frame** until it returns. It uses the script's shared `textBox` for every
  PrintText. The session ends on the tick after ThankYou's `done` and the explicit
  `UpdateSprites` (`ld a, 1 / wUpdateSpritesEnabled`, then `UpdateSprites`). The script
  then runs the outer wait, Hold and close. No second display, no `initScript()` per
  message (note 39 §3).
- Money: add a money port to `ScriptDeps` (`getMoney()` / `setMoney(n)`, backed by
  `main.ts`'s `playerMoney`). The session reads it at the source's reads.
- Retire: the `openShop` OverworldAction and its controller branch, `main.ts`'s
  `shop` state (update, render, `drawUiLayer` case), `ShopMenu`, and the now-redundant
  clerk `shopItems` toggling in `story_state.ts`. The inventory stays on the clerk's data
  so the handler can read it. Before OAK_GOT_PARCEL the clerk still says
  `ViridianMartClerkSayHiToOakText` from table 1 (existing branch, keep it).

### 4.2 The screen tile model (G9, G10)

New `menus/screen_tiles.ts` (name is the implementer's choice): a 20×18 logical
**wTileMap** of glyph tokens or `null`. `null` means no menu wrote there: rows 0–11 show
the map, rows 12–17 show the TextBox.

- `textBoxBorder(x, y, innerH, innerW)` writes border tiles and blanks the interior
  (TextBoxBorder). `placeString(x, y, text)` writes glyph tokens (A5b7a's
  `tokenizeGlyphs`), `next` = +2 rows. `clearArea`, `put(x, y, glyph)`, and the BCD and
  number cell writers reuse A5b7a's semantics: suppressed cells are **skipped, not
  blanked**.
- **The message box:** when the session's PrintText draws a new MESSAGE_BOX, it
  first nulls rows 12–17 (TextBoxBorder for (0,12)–(19,17) overwrites them). The list's
  bottom border then lives in row 12 until that happens.
- **Buffer1:** `save()` copies the logical map **and** the TextBox's retained screen
  (buffer and border). `restore()` writes both back. This needs a small TextBox API
  (`saveScreen()` / `restoreScreen(s)`), the general form of today's `clearInterior()`.
  `restore()` is LoadScreenTilesFromBuffer1, so it also turns auto-transfer off, then
  back on.
- **Transfer:** the visible copy changes only through `AutoBgMapTransfer` thirds. Extend
  `bg_transfer.ts` (it already says "portion survives disabling") with
  `hAutoBGTransferEnabled`. While off, nothing transfers and the portion does not
  advance. Each VBlank's single tick copies one third (rows 0–5, 6–11, 12–17) of the
  Mart's logical map, and the TextBox keeps copying its rows on the bottom third. That
  way `DisplayListMenuID` hides the list, the restored money box and the restored
  message for its 10 frames, as the cartridge does. **One tick per frame across both
  owners** (test it). Render does no ticking.
- **Rendering:** in `drawUiLayer`'s script case, draw the Mart's visible non-null cells
  *after* `textBox.render()` (so row 12's list border overlays the message box's top
  border), then the YES/NO. Sprite cover follows the **logical** cells, as
  `TextBox.uiTileAt` does. The exact frame each menu's own `UpdateSprites` hides sprites
  stays J2 (A5b5c precedent for YES/NO).
- The existing `YesNoMenu` keeps drawing itself immediately (A5b5c). The 5×6
  `TwoOptionMenu_SaveScreenTiles`/`Restore` is implicit: the session must not write
  under (14,7)–(19,11) while it is open. A known small departure: the YES/NO box itself
  does not wait for its third to transfer.

### 4.3 `DisplayListMenuID` (G3, G11), `menus/list_menu.ts`

Scope: `ITEMLISTMENU` (the bag; SELL) and `PRICEDITEMLISTMENU` (`wItemList`; BUY).
`PCPOKEMONLISTMENU`/`MOVESLISTMENU` are not built (Bill's PC and battle own them later).

- **Entry:** transfer off; `BIT_NO_TEXT_DELAY`; `wMenuItemToSwap` = 0; `LIST_MENU_BOX`
  border (4,2)–(19,12); `wMaxMenuItem` = 2 if count ≥ 2, else 1;
  `wMenuWatchMovingOutOfBounds` = 1; top (5,4); watched A, B, SELECT; **`DelayFrames 10`**.
- **Loop:** transfer off, PrintListMenuEntries, transfer on, Delay3, then
  HandleMenuInput (its own PlaceMenuCursor + Delay3). First read = list start +16.
- **PrintListMenuEntries:** clear (5,3) 9×14; four rows from (6,4), 2 rows apart: name;
  priced → 3-byte BCD `LEADING_ZEROES|MONEY_SIGN` at name+(5,+1); item list → unless the
  item is a key item, `×` at name+(8,+1) then a 2-digit right-aligned PrintNumber.
  A swap-marked entry gets `▷` at (5, row). The `$ff` terminator prints `CANCEL` and
  stops, with **no ▼**. Four entries without reaching CANCEL put **▼ at (18,11)**.
- **HandleMenuInput additions** (`menu_input.ts`, defaults unchanged for current
  callers):
  - `watchOutOfBounds`: Up at item 0 or Down at max returns the key, with no sound
    unless A/B.
  - `repeat` (hJoy7 = 1, JoypadLowSensitivity): report *held* keys on a new press and
    arm 30 frames. With no new press, report nothing until the counter (decremented
    every frame, Delay3s included) reaches 0, then report held keys and re-arm 5. A or B
    held at that moment → report nothing.
  - Quirk to keep: in repeat mode a new Down while A is held reports A|Down, so the
    item is **selected** (press_ab).
- **Scrolling:** Down at max: if offset+3 ≤ count, offset++ (else nothing), then back
  to the loop (PrintListMenuEntries + two Delay3s). Up at 0: offset-- if > 0. Held,
  that gives one scroll per 6 frames once the repeat has started.
- **A:** `▷` at the cursor. If count is 0, or offset+item > count−1, it is CANCEL →
  ExitListMenu (carry). Otherwise return the entry (id, list index, price, and for
  ITEMLISTMENU the stack size as the max quantity), `BIT_NO_TEXT_DELAY` and hJoy7 off.
- **B:** ExitListMenu (cancelled). The press_ab comes from HandleMenuInput.
- **SELECT:** HandleItemListSwapping (ITEMLISTMENU only; the CANCEL row is ignored).
  The first press marks the item, waits 20 frames and re-loops. A second press on the
  same item is ignored. On another item, wait 20 frames, then:
  - Different IDs: swap the two slots.
  - Same ID, sum < 100: merge into the second slot, delete the first, count−1,
    `wMaxMenuItem` = 1 if the count drops to 1, **offset and cursor reset to 0**.
  - Same ID, sum ≥ 100: the second slot becomes 99 and the first the remainder.
  - Then clear the mark and re-loop. SELECT plays no sound.
- **Cursor and scroll persistence:** the caller owns `wListScrollOffset`. The Mart's
  `.loop` zeroes it; `.buyMenuLoop`/`.sellMenuLoop` do **not**, so after a purchase or
  sale the list stays scrolled and the cursor is back on the top visible row
  (`wCurrentMenuItem` = 0). The Mart saves the offset on entry and restores it at
  `.done` (`wSavedListScrollOffset`). The bag's own offset is unaffected.
- **The ▼ blink:** HandleDownArrowBlinkTiming counts `.loop2` iterations, a CPU spin
  loop, not frames, so its rate cannot be expressed in frames. Draw ▼ **steady** and
  record the departure (J2). Do not invent a frame rate for it.

### 4.4 `DisplayChooseQuantityMenu` (G4), `menus/quantity_menu.ts`

- **Layouts:** priced (PRICEDITEMLISTMENU): border at (7,9) inner 1×11, `×01` at
  (8,10). Plain: border (15,9) inner 1×3, `×01` at (16,10). Plain is for toss and PC,
  later slices; build and test both now.
- Quantity starts at 0 and enters via increment, so it shows 1. **Up:** +1, past max →
  1. **Down:** −1, at 0 → max. Each change reprints immediately.
- **Priced:** total = quantity × unit price (repeated 3-byte BCD add). For selling,
  halve the **total** with BCD division (floor of the total, not the sum of halves).
  Write 6 spaces at (12,10), then the total as 3-byte BCD `LEADING_ZEROES|MONEY_SIGN`
  at (12,10), then the quantity with PrintNumber 1 byte, 2 digits, LEADING_ZEROES at
  (9,10). Plain: the quantity at (17,10).
- **Input:** one read per frame of *new* presses only (hJoy7 is 0 here). The first read
  is the frame after the list's A. **No Delay3, no press_ab** on A or B. A returns the
  quantity and the total; B returns cancelled. Both clear `wMenuItemToSwap`.

### 4.5 The Mart session, `menus/pokemart.ts` (replaces `shop_menu.ts`)

A per-frame state machine that follows the labels of `DisplayPokemartDialogue_`. Every
PrintText is `textBox.print({ program }, { box: 'new', bindings })` and waits for the
program's return. Every sound wait is a CPU wait: BG transfer continues, Joypad is not
read.

| Label | Behavior |
|---|---|
| entry | save `wListScrollOffset`; `UpdateSprites` |
| `.loop` | offset 0, item 0; MONEY box: template (11,0)–(19,2), `MONEY` at (13,0), clear (13,1) 1×6, money 3-byte BCD `LEADING_ZEROES|MONEY_SIGN` at (12,1), no delay. BUY/SELL/QUIT template (0,0)–(10,6), labels at (2,1)/(2,3)/(2,5). MenuInput: watched A/B, max 2, top (1,1). Then `▷` at the item. B or QUIT → `.done`; BUY → `.buyMenu`; SELL → `.sellMenu` |
| `.buyMenu` | PrintText `PokemartBuyingGreetingText`; **save Buffer1** |
| `.buyMenuLoop` | restore Buffer1; MONEY box; list PRICEDITEMLISTMENU over the inventory. Cancel → `.returnToMain`. Quantity (max 99, not halved); B → `.buyMenuLoop`. PrintText `PokemartTellBuyPriceText` with `stringBuffer` = the item name, `money` = total. YES/NO at (14,7) (`actualRead`, 15-frame tail). NO/B → `.buyMenuLoop`. YES: money < total → `.notEnoughMoney`; else `bag.add` fails → `.bagFull`; else subtract money, purchase sound (wait for current, play, wait to finish), PrintText `PokemartBoughtItemText` (prompt) → `.buyMenuLoop` |
| `.sellMenu` | bag empty → PrintText `PokemartItemBagEmptyText` (prompt), save Buffer1, `.returnToMain`. Else PrintText `PokemonSellingGreetingText`, **save Buffer1** |
| `.sellMenuLoop` | restore Buffer1; MONEY box; list ITEMLISTMENU over the bag (no prices). Cancel → `.returnToMain`. Key item or HM → `.unsellable`. Quantity priced, halved, max = stack; B → `.sellMenuLoop`. PrintText `PokemartTellSellPriceText` (`money` = halved total). YES/NO; NO/B → `.sellMenuLoop`. YES: money += total, **capped at 999999** (AddBCD fills $99); MONEY box redrawn now; purchase sound with both waits; `bag.removeAt(selectedIndex, qty)` → `.sellMenuLoop`. **No message** |
| `.unsellable` | PrintText `PokemartUnsellableItemText` (prompt) → `.returnToMain` |
| `.notEnoughMoney` / `.bagFull` | PrintText `PokemartNotEnoughMoneyText` / `PokemartItemBagFullText` (prompt) → `.returnToMain` |
| `.returnToMain` | restore Buffer1; MONEY box; PrintText `PokemartAnythingElseText` → `.loop` |
| `.done` | PrintText `PokemartThankYouText` (`done`); `UpdateSprites`; restore the saved offset; return. BUY/SELL/QUIT (with ▷) and MONEY stay on screen through the outer wait and vanish with the close |

`wBoughtOrSoldItemInMart` is write-only in the ROM. Don't model it.

### 4.6 Frame anchors the tests pin

Symbolic anchors (letter timing varies with text speed): T = the talk dispatch tick.

| Event | Frame |
|---|---|
| Greeting first glyph | T+23 |
| Greeting `done` returns (G); MONEY + BUY/SELL/QUIT written | G; visible by thirds from G+1; first read **G+3** |
| A on BUY (R), press_ab, ▷ | R; "Take your time." new box, first glyph R+3 |
| Its `done` (L): Buffer1 save/restore, MONEY, list border written, transfer off | L; list, MONEY and message first visible **L+11** (thirds L+11…L+13); first list read **L+16** |
| Scroll (Down at the 3rd row) | entries reprinted; next read 6 frames later |
| A on an item (Q), press_ab, ▷ | quantity box at Q; first quantity read **Q+1** |
| A in the quantity box (P), **silent** | price text new box at P (row 12 back to the message border); first glyph P+3; `cont` ▼ (ProtectedDelay3, wait, beep, scroll) |
| Price `done` (D) | YES/NO at D; first read D+3; A at Y (press_ab); restore at Y+15 |
| YES on a purchase | bag and money change at Y+15; purchase sound; no reads until it ends; Bought box, Delay3, typed; prompt |
| Bought prompt dismissed (B′) | as L, measured from B′: the **new money** amount appears at B′+11 with the list |
| YES on a sale | money and MONEY box change at Y+15 (visible by thirds); sound; slot removed when the sound ends; then as L |
| ThankYou `done` | UpdateSprites; script outer silent wait; Hold; close; the Mart's tiles vanish on the frame the message box does |

## 5. Checkpoints

Each checkpoint: focused tests, strict typecheck, a local commit. The full ROM/no-ROM
suites and the build run at CP3 and CP6.

**CP1: screen tiles, transfer switch, quantity menu.** `screen_tiles.ts`;
`bg_transfer.ts` enable/disable (the portion holds while disabled); TextBox
`saveScreen`/`restoreScreen`; `quantity_menu.ts`, both layouts. Tests: border/interior
writes; BCD/number cells skip, not blank; Buffer1 round trip including the message box;
transfer off for 10 frames shows nothing new and doesn't advance the portion; thirds
order; quantity wrap 1↔max at 99 and at a stack size; priced total and halving (odd
total floors); exact cells for both layouts; no sound on A/B; reads only new presses;
first read Q+1. Existing TextBox, Oak and nurse tests unchanged.

**CP2: list menu and HandleMenuInput additions.** `list_menu.ts`; `menu_input.ts`
`watchOutOfBounds` + `repeat`. Tests: layouts of both kinds (names, prices at
name+(5,1), `×qty` at name+(8,1), key items without qty, CANCEL, ▼ only without CANCEL
in view); 3-row cursor; scroll arithmetic with 1, 2, 3, 4 and 10 items; first read +16;
6 frames per scroll; repeat at 30 then every 5; A/B held suppresses repeat; A held + new
Down selects; CANCEL by A, empty list, B; ▷ on A; SELECT: mark, self-ignore, swap,
merge < 100 (count, max item, reset), split ≥ 100, CANCEL ignored, 20-frame waits, no
sound. Blackboard and intro name menu keep their assertions (defaults unchanged).

**CP3: entry, frame and exit.** `mart` text script, `TextHandlerContext.shopItems`, the
`pokemart` command and session skeleton, the money port in ScriptDeps, rendering order.
`.loop`, `.done`, `.returnToMain` (via B on BUY/SELL/QUIT, QUIT, and an empty-bag SELL).
Retire `openShop`, the `shop` state and `ShopMenu`. Tests through actual dispatch: table
1 vs table 2 by OAK_GOT_PARCEL; greeting at T+23; menus at G and first read G+3; cursor
back on BUY after AnythingElse; ▷ kept during ThankYou; outer silent wait, Hold, close;
the Mart's tiles go with the close; one transfer tick and one Joypad read per frame;
`wListScrollOffset` restored. Full suites and build.

**CP4: buying.** `.buyMenu`/`.buyMenuLoop`, price question, YES/NO, money check,
add-before-subtract, sound waits, Bought prompt, both failures. Tests: committed
programs with real bindings (`stringBuffer`, `money`); the `cont` ▼ after "That will
be"; YES/NO at (14,7) restoring the quantity box; NO/B → list without a transaction;
exact money/bag on success; not enough money (bag unchanged); bag full (money
unchanged, add atomic, retry charges once, the migrated `items.test.ts` case); old
money until B′, new at B′+11; list scroll kept, cursor at the top visible row; the
row-12 border handoff; no reads during the sound wait. The existing duplicate-stack
rule (99 + overflow into a new slot) through a purchase.

**CP5: selling.** `.sellMenu`/`.sellMenuLoop`, empty bag, unsellable, halving, cap,
money box timing, selected-slot removal, no message. Tests: TOWN_MAP and OAK's PARCEL
unsellable with no quantity shown; selling a later duplicate removes **that** slot (the
migrated `items.test.ts` case, now without filtering); selling the last item leaves a
CANCEL-only list (no "nothing to sell" until the next SELL entry); cap at 999999; the
MONEY box changes at Y+15, before the sound; removal after the sound; SELECT swap inside
the SELL list changes the bag order. Cross-check the `key` category against
`data/items/key_items.asm` for every item defined today.

**CP6: integration, cleanup, handoff.** Browser smoke on a spare origin (e.g. :5188,
disposable save, muted). Stage a save in Viridian Mart after OAK_GOT_PARCEL with money,
a TOWN_MAP, duplicate POTION stacks and a near-full bag. Run: BUY (scroll, cancel,
NO, YES, not enough money, bag full), SELL (unsellable, a duplicate slot, swap, last
item), B and QUIT exits, walk away after the close. Zero console errors; :5173 and its
saves untouched. Update `menus/ARCHITECTURE.md`, `text/ARCHITECTURE.md` (transfer
switch, save/restore), the test-suite docs, the note 41 result section and STATUS.
Suggested self-mutations: repeat counter not decremented during Delay3; scroll
condition off by one; halving per item; money box redrawn before the YES; purchase
subtract before add; a press_ab in the quantity box. Commit, then stop for review.

## 6. Out of scope (with homes)

- **Bag, toss and PC callers on the new list/quantity menus:** A5b7c and A5b7d. Their
  current lists stay as they are in this slice.
- **TM prices** (GetItemPrice's TM table) and HM item IDs: A2. The unsellable check is
  written as `isKeyItem || isHM`; until A2 defines HMs, it is the key-item check.
- **Other marts' inventories:** Viridian's list is hard-coded in the extractor's map
  metadata and matches `data/items/marts.asm`. **V2 should extract the `script_mart`
  bytes** after TX_SCRIPT_MART rather than hard-code Pewter's.
- **The ▼ blink rate**, each menu box's own `UpdateSprites` timing, the YES/NO box's
  transfer third: J2 (documented departures, not silent).
- **Other list kinds** (Pokémon, moves) and the Old Man battle's list branch: their
  owning slices.
- **Audio:** `purchase` is identical in banks $02 and $1f (`src/audio/ARCHITECTURE.md`),
  so the Mart has no bank caveat.

## 7. User play-test (after review)

`http://127.0.0.1:5173/`, a save past Oak's parcel. **Z = A, X = B.**

1. Talk to the clerk: greeting, then BUY/SELL/QUIT and MONEY at the top.
2. BUY: list at the right with prices; the cursor stops at the 3rd row and the list
   scrolls; ▼ when more is below.
3. Pick POTION: quantity box with the price; Up past 99 wraps to 1.
4. A: "POTION? That will be ▼" → A → "¥300. OK?" with YES/NO. NO returns to the list.
5. YES: purchase sound, "Here you are! Thank you!", then the money updates.
6. SELL: your whole bag, TOWN MAP with no count. Selecting it: "I can't put a price on
   that." Sell a POTION: half price, sound, money goes up, no extra message.
7. QUIT: "Thank you!", one more A, and the box closes.

## 8. Risks

- **One owner per frame.** The session, the script controller's idle `updateDisplay`,
  YES/NO and the TextBox must not double-tick the transfer or double-read Joypad.
  Integration tests through actual dispatch, not only unit tests.
- **Buffer1 and the TextBox:** restoring the message box's buffer must not restart a
  finished program or replay a prompt. Restore tiles only.
- **Scope:** if CP2's list exceeds a session, split it at the SELECT swap (CP2a list,
  CP2b swap) rather than trimming fidelity.

## 9. Decisions for the user (O-24)

1. **Port `DisplayListMenuID` and `DisplayChooseQuantityMenu` now, as shared modules
   (§4.3–4.4).** *Recommended.* This amends #52's placement of list scrolling and
   repeat input in J2, for this list menu only. Without it the Mart can't match the
   cartridge (3-row cursor, scrolling, quantity wrap, silent quantity box). The
   alternative is to keep today's approximate list and fix only text and flow.
2. **Include the SELECT item swap in the list module now.** *Recommended:* the Mart's
   SELL list is the bag, so SELECT swaps there on the cartridge, and the bag gets it for
   free in A5b7c. Alternative: SELECT does nothing until A5b7c (a recorded temporary
   gap).
3. **The screen tile model with Buffer1 and the transfer switch (§4.2).** *Recommended.*
   Without it, the restores of "Take your time." and the row-12 border overlap can't be
   reproduced. YES/NO keeps its existing immediate drawing.
4. **The list's ▼ stays steady;** its CPU-paced blink goes to J2. *Recommended.*
5. **One slice, six checkpoints, one review, one play-test.** Sol or Grok implements
   (your pick), Claude reviews, you play-test (§7). No DECISIONS entry until you answer.

## Implementation result (2026-10-14, Grok 4.7)

CP1 `1aa84e8` screen tiles, the transfer switch, and the quantity menu. CP2 `7bf1d9e`
list menu and HandleMenuInput (`watchOutOfBounds`, repeat). CP3 `9568dab` entry, the
BUY/SELL/QUIT frame, and exit; `ShopMenu` is gone. CP4 `606c775` buying. CP5 `2704616`
selling. CP6 is this handoff.

Browser smoke on `http://127.0.0.1:5188/` (muted headless Chrome, its own profile, so
`http://127.0.0.1:5173/` was not touched). The disposable save stood in front of the
Viridian clerk after both parcel flags. BUY scrolled and cancelled, NO left the bag
alone, YES bought an antidote (¥350 to ¥250), a potion was refused for money, and a
new ball was refused on a full bag. SELL refused TOWN MAP with no quantity box, sold
the later POTION slot (the MONEY digit changed before that slot left the bag), swapped
POTION above TOWN MAP with SELECT, and sold the remaining stack of 99. B then Thank
You closed the script, and the player stepped right. Down from that tile is a wall.
The console logged the Vite connect lines and "Debug mode: ON", and no errors.

The six suggested mutations were each caught by an existing test and reverted: the
repeat counter not elapsing during Delay3; `offset + 3 < length`; halving the unit
price instead of the total (three of a ¥15 item became 21, not 22); money added when
the sell price was asked; the purchase subtracted before `bag.add`; quantity A played
`press_ab`.

ROM **1330/1330** in 70 files. No-ROM **1207 pass / 123 skip**. Typecheck and build
clean. One full ROM pass timed out the pret text-macro comparison while the machine
was busy; the file then passed alone in 72ms, and the suite rerun was 1330/1330.

**Stop for review.** The play-test is §7 (A = Z, B = X, `http://127.0.0.1:5173/`).
Do not start A5b7c, the healing machine, or the intro animation. Nothing pushed.
