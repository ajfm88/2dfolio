# A1b — Item balls and hidden items

**2026-10-06 · planned by Claude Opus 5.5. Planning only; no code yet.**

Start from **`d6420d4`** (A1a done, reviewed, user-verified). A1b is the second of A1's three
slices (DECISIONS #35: A1a jingles → **A1b item balls and hidden items** → A1c trainer sight).
It refines `notes/07-a1-plan.md` §1.1, §1.2 and §2.2 with the probes below. The user picks the
implementer; by the alternating pattern, Sol (Codex) implements and Claude reviews. The
recommendations in §9 are proposed, not settled.

Sources: `refs/pokeyellow` @ `e89ead15`. Line numbers are the named file's.

**Implementation handoff (2026-10-06):** all six recommendations below were accepted
in DECISIONS #41. Sol implemented §§3–6; results are in §10. Claude review and user
play-test remain pending. The planning text below is retained as the original spec.

## TL;DR

- **Item balls become collectible, exactly as `PickUpItem` does it.** The ball disappears as
  the box opens, "YELLOW found / POTION!" types, `get_item1` plays (72 frames), and the box
  **closes by itself** once the jingle is over and A is up. No button, no ▼, no beep. A full
  bag: "No more room for / items!", a silent button wait, and the ball stays.
- **Hidden items follow `HiddenItems`:** the text first, then `GiveItem`; `get_item2`
  (180 frames); the box closes by itself. A full bag: "found" waits for a button, then a new
  box, "But, YELLOW has / no more room for ▼ / other items!".
- **The bag gets `AddItemToInventory_`'s exact rule**, quirk included: a full bag whose
  *first* stack of the item is at 99 refuses the item, even if a later stack could take it.
  Shop, PC and the save stop assuming adds succeed; removal goes by slot.
- **Picked-up balls are saved** (`hiddenObjects`, DECISIONS #35) and hidden on every map load.
- **Five new script primitives** (§4) model the parts of `DisplayTextID` the pickups need:
  a text that doesn't end the box, a sound and its wait, the silent button wait, the
  hold-A close, and `HideObject`. Today's `text` command keeps its behavior.
- **Found on the way, not fixed here (§8):** every overworld text box departs from
  `DisplayTextID`'s ending. A `done` text closes silently on the cartridge, and only once A
  is *released*; ours beeps and closes on the press. Proposed home: A5.
- **6 decisions (§9)**, each with a recommendation. Reply **go** to take all six.

## 1. The cartridge's flows

### 1.1 Item ball — `PickUpItemText` → `PickUpItem`

An item ball's text entry is `PickUpItemText` (`home/overworld_text.asm:28`): `text_asm`,
`predef PickUpItem`, `jp TextScriptEnd`. It runs inside `DisplayTextID`
(`home/text_script.asm`).

| # | ASM | Seen |
|---|---|---|
| 1 | `DisplayTextID` → `DisplayTextIDInit` (`engine/menus/display_text_id_init.asm`): box border, `UpdateSprites`, facings saved | an empty box (ui_entry's opening update, A6c) |
| 2 | `PickUpItem` (`engine/events/pick_up_item.asm`): `EnableAutoTextBoxDrawing` (clears `wDoNotWaitForButtonPressAfterDisplayingText`), finds the sprite's toggle index, `GiveItem` item, 1 | — |
| 3 | success: `HideObject` (`engine/overworld/toggleable_objects.asm`) sets the toggle bit, then `UpdateSprites` | the ball disappears |
| 4 | `wDoNotWait…` = 1; `PrintText FoundItemText` (`home/window.asm`: new box, `UpdateSprites`, `Delay3`) | "YELLOW found / POTION!" types (`data/text/text_1.asm:60`, `text_end`) |
| 5 | `sound_get_item_1` → `TextCommand_SOUND` (`home/text.asm:513`): `PlaySound SFX_GET_ITEM_1`, `WaitForSoundToFinish` | the jingle; the box stays |
| 6 | back in `DisplayTextID`: `wDoNotWait…` ≠ 0 → `HoldTextDisplayOpen` (loops while A is held), `CloseTextDisplay` | **the box closes by itself** once A is up |
| 3′ | bag full: `PrintText NoMoreRoomForItemText` (`text_1.asm:67`, `done`); `wDoNotWait…` is still 0 → `AfterDisplayingTextID` → `WaitForTextScrollButtonPress`, then `HoldTextDisplayOpen` | the text, a silent wait for A or B, then the close. **The ball stays**; nothing is saved |

### 1.2 Hidden item — `HiddenItems` (`engine/events/hidden_items.asm`)

Reached from `OverworldLoop` (`home/overworld.asm:83–100`) **before** signs and sprites:
`CheckForHiddenEventOrBookshelfOrCardKeyDoor` (`home/hidden_events.asm:5`) runs the hidden
event in front of the player; with none, the bookshelf check; only then
`IsSpriteOrSignInFrontOfPlayer` (signs first, then sprites, `home/overworld.asm:1059`).

| # | ASM | Seen |
|---|---|---|
| 0 | flag already set → `hItemAlreadyFound` = $ff → the overworld goes on to `IsSpriteOrSignInFrontOfPlayer` (not the bookshelf check) | whatever sign or sprite is there, else nothing |
| 1 | `EnableAutoTextBoxDrawing`, `wDoNotWait…` = 1, `GetItemName`, `tx_pre_jump FoundHiddenItemText` → `PrintPredefTextID` → `DisplayTextID` (Init: box, `UpdateSprites`) | the box |
| 2 | `PrintText_NoCreatingTextBox`: `_FoundHiddenItemText` (`data/text/text_2.asm:796`, `text_end`) | "YELLOW found / POTION!" types |
| 3 | `text_asm`: `GiveItem` item, 1 | — |
| 4 | success: set the hidden-item flag; `PlaySoundWaitForCurrent SFX_GET_ITEM_2` (waits for any current SFX, then plays); `WaitForSoundToFinish`; `TextScriptEnd` → `HoldTextDisplayOpen` | `get_item2`; **the box closes by itself** |
| 4′ | bag full: `WaitForTextScrollButtonPress` (silent, no ▼); `wDoNotWait…` = 0; `PrintText HiddenItemBagFullText` (new box, `UpdateSprites`, `Delay3`): "But, YELLOW has / no more room for" `cont` "other items!" `done` (`text_2.asm:803`); then `AfterDisplayingTextID`'s silent wait and `HoldTextDisplayOpen` | A or B; the new box; ▼ on the `cont`, A or B with `press_ab`, the scroll; a silent wait; close. The flag stays clear |

### 1.3 Route 1's Potion sample — `Route1PrintYoungster1Text` (`scripts/Route1_2.asm:1`)

The one other `sound_get_item_1` on today's maps (decision 9.3).

1. `CheckAndSetEvent EVENT_GOT_POTION_SAMPLE` — **the flag is set before the give.** If it
   was already set: `_Route1Youngster1AlsoGotPokeballsText` ("We also carry…", `done`).
2. `PrintText .MartSampleText` (`text/Route1.asm:1`): three paragraphs ending in **`prompt`**:
   ▼, `ProtectedDelay3`, `ManualTextScroll` (a button, `WaitForSoundToFinish`, `press_ab`).
3. `GiveItem POTION, 1`.
4. Success: `PrintText .GotPotionText`: "YELLOW got / POTION!" (`text/Route1.asm:15`), then
   `sound_get_item_1` (jingle + wait), `text_end`.
   Bag full: "You have too much / stuff with you!" (`text/Route1.asm:28`, `done`).
5. `TextScriptEnd` → `wDoNotWait…` = 0 → the silent button wait, `HoldTextDisplayOpen`.

**Gen 1 quirk, kept (Hard rule 7):** with a full bag the flag is already set, so the Potion
is lost for good and the youngster says "We also carry…" from then on.

### 1.4 `GiveItem` → `AddItemToInventory_` (`home/give.asm:1`, `engine/items/inventory.asm:7`)

`GiveItem` adds to the bag and, on success only, copies the item's name to `wStringBuffer`.
`AddItemToInventory_`, for the bag (capacity 20) or the PC box (50):

```
room := count < capacity                      ; d = count − capacity, tested for 0
for each slot, in order:
  if slot.id == item:
    sum := (slot.qty + q) & $ff               ; 8-bit add (`add b`)
    if sum < 100: slot.qty := sum; return success
    if not room:  return fail                 ; nothing changed
    slot.qty := 99; q := sum − 99             ; keep scanning the next slots
if not room: return fail
append {item, q}; return success
```

- No cap on a new slot's quantity; callers keep `q` ≤ 99.
- **The quirk:** the room check happens at the *first* overflowing stack. A full bag with
  POTION 99 … POTION 50 refuses one Potion, though the second stack could take it.
- `wItemQuantity` is restored at the end, so callers see the quantity they asked for.

**Removal** (`RemoveItemFromInventory_`, `inventory.asm:101`) works on a **slot index**
(`wWhichPokemon`): subtract; at 0 the slot is removed and later slots move up.
`RemoveItemByID` (`engine/menus/pc.asm:118`) removes **1** from the *first* slot with the
id. The Mart buys by adding first and charging only on success (`engine/events/pokemart.asm:181`);
the PC adds to the destination, then removes from the source slot
(`engine/menus/players_pc.asm:123`, `:177`).

## 2. Today's code against that

| Where | Today | Cartridge |
|---|---|---|
| `overworld_controller.ts` ~334 | an item ball has no text, so talking to it does nothing (V1b) | §1.1 |
| `overworld_controller.ts` ~366 | hidden item: gives **first**, "found" + A-wait, full bag shows the *item-ball* text | §1.2 |
| `overworld_controller.ts` ~240 | Route 1: invented "received / a POTION!" and "You have no more / room for items."; the flag is set on success only; no jingle | §1.3 |
| `player.ts` `checkInteraction` 148 | NPCs → signs → hidden events → bookshelf; a found hidden item still wins the check | hidden events → bookshelf → signs → sprites (§1.2) |
| `script_controller.ts` ~863 | a free-move (awaitInteraction) hidden-item copy of the old logic | no map with awaitInteraction (Oak's Lab) has hidden items |
| `items.ts` `addToInventory` | merges into the first stack with no cap | §1.4 |
| `items.ts` `Bag.remove`, `removeFromInventory` | by id, from the first stack, any count | by slot (menus); by id, 1 (scripts) |
| `shop_menu.ts` ~180 | pre-checks "new item and 20 slots", charges, ignores `add`'s result | add, then charge on success |
| `pc_menu.ts` `doWithdraw` ~164 | same pre-check, ignores the result, removes by id | add, then remove the chosen slot |
| `save.ts` `restoreBag` 174 | `bag.add` per saved stack (would now re-split or fail) | the save is the bag's bytes |
| `text/textbox.ts` | every text ends the same way: wait for A/B, `press_ab`, close on the press | §1.1–1.3 need "no wait", "silent wait", "hold-A close", `prompt` |

Nothing in `data/` changes. Item names come from `item_names.json` (`getItemName`).
Today's balls: Viridian Forest `potion1` (25,11), `potion2` (12,29), `poke_ball` (1,31);
Route 2 `moon_stone` (13,54), `hp_up` (13,45), both behind Cut. Hidden items: Viridian Forest
POTION (1,18), ANTIDOTE (16,42); Viridian City POTION (14,4).

## 3. The bag (`items.ts`)

- `addToInventory(items, id, count, capacity)`: the §1.4 loop, exactly, 8-bit sum included.
  Returns success; on failure the array is untouched.
- New `removeFromInventoryAt(items, index, count)` and `Bag.removeAt(index, count)`:
  `RemoveItemFromInventory_`. `Bag.remove(id, count = 1)` stays as `RemoveItemByID` (first
  matching slot), for scripts (`removeItem`, Oak's Parcel).
- Callers that pick a slot use `removeAt` with that slot: `item_menu.ts` (toss 221, use
  271/291/299), `shop_menu.ts` sell 246, `pc_menu.ts` deposit 224 / withdraw 172 / toss 279,
  `battle.ts` 879/909/970 (the battle item list is `bag.items`, so the cursor is the slot).
- `shop_menu.ts` buy: drop the pre-check; `if (!bag.add(...))` → "You can't carry / any more
  items." and no charge; else charge. `pc_menu.ts` withdraw: `if (!bag.add(...))` → its
  existing message; else `removeFromInventoryAt(pcItems, slot, count)`. Deposit already
  checks `addToInventory`'s result; it then removes the chosen bag slot.
- `save.ts` `restoreBag`: copy the saved stacks verbatim (`bag.items = saved.bag.map(...)`).
  The PC items are already copied verbatim (check).
- **Not here:** the cursor and scroll resets `RemoveItemFromInventory_` does when a slot
  empties (§8).

## 4. Text and script primitives

`TextBox.show(text, opts?)` gets one option, `end`:

| `end` | After the last character | Used for |
|---|---|---|
| absent | today's behavior, unchanged | every existing text |
| `'none'` | the box stays drawn and `isComplete` turns true. No input is read | a `text_end` inside a `text_asm` (`FoundItemText`, …) |
| `'prompt'` | ▼ at (18,16), `ProtectedDelay3`, then the first A or B press: wait for the sound to finish, `press_ab`, ▼ cleared, `isComplete`. The text stays | `prompt` (`home/text.asm:209`) |

Inside a text, `cont` and `para` keep today's paging (§8 lists what differs there). A
`text` script command passes `end` through and, when `end` is set, finishes on `isComplete`
**without closing the box**, so the next command runs with the box up and ui_entry sees one
opening. The next `text` replaces the contents (PrintText's fresh box).

New `ScriptCommand`s (`script/types.ts`), each citing its routine:

| Command | Routine | Runs until |
|---|---|---|
| `{ type: 'sound'; name: string; waitForCurrent?: boolean }` | `TextCommand_SOUND` (`PlaySound` + `WaitForSoundToFinish`); with `waitForCurrent`, `PlaySoundWaitForCurrent` first waits for `isSoundFinished()` | `isSoundFinished()` after the play |
| `{ type: 'textButtonWait' }` | `WaitForTextScrollButtonPress` (`home/joypad2.asm:55`): no ▼ (blink count 0), no sound | an A or B press |
| `{ type: 'closeText' }` | `HoldTextDisplayOpen` + `CloseTextDisplay` | the first frame A is not held; then the box is dismissed |
| `{ type: 'hideObject'; map: string; npcId: string }` | `HideObject` | at once: saved, and the NPC hidden (out of drawing and collisions) |

- Every wait reads the joypad each frame (`syncJoypadRead()`), as text waits do today. The
  world stays frozen while they run: no NPC updates, no passes.
- A script that ends with its box still open dismisses it (a guard, not a cartridge rule).
- `giveItem` already splices its success/fail branches. It now passes on the new rule's
  result unchanged.

## 5. The pickups (`overworld/item_pickup.ts`, new, pure)

Builders that return command lists, with the texts transcribed and cited (they carry runtime
values, DECISIONS #29). Use `getPlayerName()` / `getItemName()` template literals.

```ts
// PickUpItem (engine/events/pick_up_item.asm)
itemBallScript(map, npcId, item) = [
  { giveItem item,
    success: [ hideObject(map, npcId),
               text(`${P} found\n${NAME}!`, end 'none'),   // _FoundItemText
               sound('get_item1'),                         // sound_get_item_1
               closeText ],                                // HoldTextDisplayOpen
    fail:    [ text('No more room for\nitems!', end 'none'), // _NoMoreRoomForItemText
               textButtonWait, closeText ] } ]

// HiddenItems / FoundHiddenItemText (engine/events/hidden_items.asm)
hiddenItemScript(flag, item) = [
  text(`${P} found\n${NAME}!`, end 'none'),                // _FoundHiddenItemText
  { giveItem item,
    success: [ setFlag(flag), sound('get_item2', waitForCurrent), closeText ],
    fail:    [ textButtonWait,
               text(`But, ${P} has\nno more room for\nother items!`, end 'none'),
               textButtonWait, closeText ] } ]

// Route1PrintYoungster1Text (scripts/Route1_2.asm)
potionSampleScript() = [
  setFlag('GOT_POTION_SAMPLE'),                            // CheckAndSetEvent, first
  text(getText('ROUTE1_MART_SAMPLE'), end 'prompt'),
  { giveItem POTION,
    success: [ text(`${P} got\nPOTION!`, end 'none'), sound('get_item1'),
               textButtonWait, closeText ],
    fail:    [ text('You have too much\nstuff with you!', end 'none'),
               textButtonWait, closeText ] } ]
```

Wiring (`overworld_controller.ts` `handleInteraction`):
- An NPC with `item` (and not hidden) → `{ type: 'script', commands: itemBallScript(...) }`,
  before the "no text" fallback. Oak's Lab's starter balls have no `item`, so they are
  untouched.
- `'item' in interaction` → `hiddenItemScript`. `checkInteraction` (`player.ts`) checks in
  the ASM's order: hidden events → bookshelf → signs → NPCs. A hidden item whose flag is set
  is skipped and the check goes on to signs and NPCs (not the bookshelf). Pass the flag test
  in (`hiddenItemFound: (flag) => boolean`) so `player.ts` doesn't import `events.ts`.
- Route 1's youngster before the flag → `potionSampleScript()`. The follow-up text is
  already applied by `applyStoryNpcState` once the flag is set.
- `script_controller.ts` ~863: delete the free-move hidden-item branch (decision 9.4).

## 6. Toggled objects (`events.ts`, `story_state.ts`, `save.ts`, `main.ts`)

- `events.ts`, next to `mapScripts`: `hideObject(map, npcId)`, `isObjectHidden(map, npcId)`,
  `getAllHiddenObjects(): string[]`, `restoreHiddenObjects(list)`. Keys `Map:npcId`.
  It models only objects that start ON (all of today's balls,
  `data/maps/toggleable_objects.asm:82`, `:218–220`); a later `ShowObject` user extends it.
- `applyStoryNpcState` hides every NPC whose key is in the set, first, for every map. It
  already runs at map load, after warps and connections, and after scripts end.
- `SaveData.hiddenObjects?: string[]`; `saveGame` takes it (after `mapScripts`); load
  restores `saved.hiddenObjects ?? []`; a new game clears it beside `restoreMapScripts({})`
  (`init_player_data.asm` clears the toggle flags with the rest).

## 7. Checkpoints, tests and verification

Baseline 812/812 with `ROM_PATH`; no-ROM 731 pass / 81 skip. Commit each checkpoint.

1. **Bag** — `items.ts`, `shop_menu.ts`, `pc_menu.ts`, `item_menu.ts`, `battle.ts`,
   `save.ts`. New `src/items.test.ts`:
   - new item into an empty bag; 98 + 1 = 99 in one slot; 99 + 1 → [99, 1]; 50 + 60 →
     [99, 11]; 99 + 99 → [99, 99];
   - full bag: a new item fails; 99 + 1 fails and leaves the bag equal (deep);
   - [P 99, …, P 50] with room + 1 → [99, …, 51] (the leftover goes to the later stack);
   - the quirk: the same bag full → fails;
   - the PC at 50 slots, same rule;
   - `removeAt`: decrement, empty-slot removal and shift; `remove(id)` takes the first slot;
   - shop: 99 Potions in a full bag, buy 1 → message, money unchanged; PC withdraw into a
     full bag → both inventories unchanged; `restoreBag` round-trips [P 99, P 1] verbatim.
2. **Primitives** — `textbox.ts`, `script/types.ts`, `script_controller.ts`. Tests (mock
   `../audio` as the overworld tests do, with `isSoundFinished` and `playSFX` spies):
   - `end: 'none'`: no input read, `isComplete`, still drawn, no `press_ab`;
   - `end: 'prompt'`: ▼ drawn, input ignored for 3 frames, then A → `press_ab` once, ▼ gone;
   - `sound`: `playSFX` once; the command finishes on the frame `isSoundFinished()` turns
     true; `waitForCurrent` plays only after a current SFX finishes;
   - `textButtonWait`: no `press_ab`, no ▼; B works as well as A;
   - `closeText`: with A held it stays; it dismisses on the first frame A is up;
   - `hideObject`: hidden, saved key, absent from `spriteTable`;
   - legacy `text` unchanged (an existing script test still passes untouched).
3. **Pickups** — `item_pickup.ts` (+ test), `overworld_controller.ts`, `player.ts`,
   `story_state.ts`, `events.ts`, `save.ts`, `main.ts`.
   - The three builders as data: each branch's command list, the texts against the ASM
     strings, the Route 1 flag before the give.
   - Controller: facing `potion1` with A → script; run it → bag +1, the ball hidden, key
     `ViridianForest:potion1` saved; reload the map → still hidden; the ball's tile no
     longer blocks. Full bag → the ball stays, nothing saved.
   - Hidden: facing (1,18) in the Forest → text before the bag changes; success sets the
     flag; facing it again → nothing (and with an NPC or sign there, that one answers);
     a full bag leaves the flag clear.
   - Interaction order: a hidden event and an NPC on the same front tile → the hidden
     event; a sign and an NPC → the sign. Plus a data test: no tile on today's 19 maps has
     both (none today — checked while planning), so nothing changes in play.
   - Frame trace: the ball's box closes 73 audio updates after its text completes
     (`get_item1`, rigged `isSoundFinished`), the hidden item's 181.
4. **Docs and verify** — typecheck, the full suite with and without `ROM_PATH`, the build;
   STATUS, CLAUDE.md (*Testing*, *Data conventions*), `src/overworld/ARCHITECTURE.md`
   (interaction order, pickups), `src/script` docs if any. In the browser the agent checks
   one ball, one hidden item and the full bag before handing over.

### Play-test (the user; A = **Z**, B = **X**)

1. Viridian Forest, the POTION at (25,11): face it, Z. The ball disappears with the box,
   "YELLOW found / POTION!" types, the jingle plays (the melody drops out, the drums go on),
   and the box closes by itself. The bag has the Potion.
2. Hold Z through the next ball: the text types fast, and the box stays after the jingle
   until you let go.
3. Save, reload, CONTINUE: the balls you took are gone and you can walk over their tiles.
4. Full bag (debug panel → bag, 20 different items, no Potion): face a ball. "No more room
   for / items!", no ▼; Z closes it **with no beep**; the ball stays.
5. Bag with POTION ×99 and a free slot: take a Potion ball → POTION 99 and POTION 1.
6. The Forest's hidden POTION (face (1,18)): "found", then a longer jingle; the box closes
   by itself. Z there again does nothing.
7. Same with a full bag: "found", Z (no beep), a new box "But, YELLOW has / no more room for"
   ▼, Z (beep), "other items!", Z (no beep). The item is still there after freeing a slot.
8. Viridian City's hidden POTION (face (14,4)).
9. Route 1's Mart worker (a save before the sample): "…Here you go!" ends with ▼; Z (beep);
   "YELLOW got / POTION!" with the jingle, then it waits for Z (no beep). Talk again: "We
   also carry…". With a full bag: "You have too much / stuff with you!", and the next talk
   is "We also carry…" — no Potion, ever (the cartridge does this too).
10. Viridian Mart with a full bag and POTION ×99: buy a Potion → "You can't carry any more
    items." and your money stays.
11. Route 2's MOON STONE and HP UP: a staged save past the Cut tree (the agent prepares it).

## 8. Not in A1b — found while planning, each with a home

| Finding | Anchor | Home |
|---|---|---|
| **Every text box ends differently from `DisplayTextID`.** A `done` text waits silently with no ▼ and closes on A's *release* (`HoldTextDisplayOpen`); ours plays `press_ab` and closes on the press. A `prompt` ending shows ▼ (ours shows none on the last page). `PrintText` waits `Delay3` before typing; `para` clears and waits 20 frames (`home/text.asm:239`); `cont` scrolls in two steps (`ScrollTextUpOneLine`). Fixing it needs each text's terminator from the extractor, so it is a data + engine slice | `home/text_script.asm`, `home/text.asm:188–284`, `home/joypad2.asm:55–97` | **A5** (decision 9.5) |
| The cursor and scroll resets when a slot empties (`RemoveItemFromInventory_` zeroes `wCurrentMenuItem`, `wListScrollOffset`, …) | `inventory.asm:130` | the menu audit, J2 (or earlier with A3's field items) |
| `ITEM_DEFS` is upstream's 22-item table: HP UP and MOON STONE have no price or category, so selling HP UP gives 0 (ROM: 9800, `data/items/prices.asm:37`). Reachable once Route 2's balls are (Cut) | `items.ts` | **A2** (TMs need the full item table anyway) |
| Other jingle call sites: the Viridian fisher's TM42 (`sound_get_item_2`), Daisy and Oak (`sound_get_key_item`) | `ViridianCity_2.asm:115`, STATUS | A2; V5 (already logged) |
| Hidden coins (`HiddenCoins`, Game Corner) | `hidden_items.asm` | D-phase (Celadon) |

## 9. Decisions (O-14)

1. **Scope: §3–§6 as written**, including removal by slot and the shop/PC/save callers, since
   the 99 rule is what creates split stacks. *Recommended: yes.* (Alternative: the add rule
   only, with the callers in J2 — leaves the shop able to charge for nothing.)
2. **Interaction order per the ASM** (hidden events → bookshelf → signs → NPCs, found hidden
   items fall through). No tile on today's maps differs. *Recommended: yes.*
3. **Port Route 1's Potion sample in A1b** (ASM texts, flag first, the jingle, `prompt`).
   It is the only other `sound_get_item_1` on today's maps. *Recommended: yes.*
4. **Delete the free-move hidden-item branch** in `script_controller.ts` rather than port it
   (no awaitInteraction map has a hidden item). *Recommended: yes.*
5. **The text-box ending finding (§8, first row) goes to A5**, renamed "Battle and text
   presentation per the ASM"; A1b's new primitives are what A5 then applies everywhere.
   *Recommended: yes.* (Alternative: its own slice before V2.)
6. **Implementer:** Sol implements, Claude reviews (the alternating pattern; A1a was
   Claude's). *Recommended: yes* — or name another.

**Reply go** to take all six recommendations, or answer by number.

## 10. Implementation handoff — 2026-10-06, Codex/Sol

Implemented the authorized scope, starting from `5564446` (the sequential notes rename):

| Checkpoint | Local commit | Result |
|---|---|---|
| 1. Bag and callers | `788ba6b` | Slot-order/99 rule and 8-bit sum, removal by selected slot, add before charge/transfer, verbatim save restoration |
| 2. Primitives | `2e787c3` | Retained text, protected prompt, sound/silent-button/A-release waits, persistent HideObject and immediate collision refresh |
| 3. Pickups | `f7d49ca` | Three builders, ASM interaction priority/found-item fallthrough, saved object restoration/new-game reset, unused free-move branch removed |
| 4. Docs and verification | Final A1b checkpoint commit | Updated context/engine docs, five more selected-stack menu regressions, full suites/build/browser checks |

**Final checks:** 864/864 in 36 files with `ROM_PATH=pokeyellow.gbc`; 783 pass / 81 skip
without it; strict typecheck and production build clean. The 52 new tests cover the
plan's branches, inventory callers, save/collision state, and real audio-engine
73/181-update traces. Existing 67 overworld-controller tests pass unchanged.
No extractor/generated-data/reference/art changes; the production bundle has no ROM
gate or browser-test hooks. All commits are local; no remote exists.

Browser checks use real key input on a temporary Vite origin (`127.0.0.1:5181`) and
test-only access appended to the served module, outside the repository. The normal
`127.0.0.1:5173` save is untouched. Checked pickup/automatic close, held A, full-bag
failures, split stacks, hidden-item ordering/repeat suppression, save/reload/CONTINUE,
freed tiles, both Route 2 balls, Route 1's success/failure/follow-up, and the Mart's
failed purchase without a charge. Test-origin saves are cleared afterward.

For play-test step 11, two staged saves and loading instructions are prepared at
`C:/Users/ajfm88/AppData/Local/Temp/pkmn-a1b/`: `route2-moon-stone-save.json`,
`route2-hp-up-save.json`, and `route2-playtest.md`. Each save faces its ball from beyond
Cut, has an empty bag and a Lv5 Pikachu, and leaves both Route 2 balls available.

Same-frame routine returns are intentional: retained text advances into `giveItem`,
`setFlag` and `sound` immediately; sound completion advances through `closeText` in
that frame. Hidden collision slots remain indexed but unavailable, preserving the
sprite table's slot order. Waits freeze NPCs and read the joypad every frame.

The findings in §8 remain deferred to their named slices. **Next: Claude's independent
review (`19-a1b-review.md`), then the user's §7 play-test. A1b is not user-verified yet.**
