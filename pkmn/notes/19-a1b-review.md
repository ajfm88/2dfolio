# A1b — independent review

**2026-10-06 · Claude Opus 5.5 reviewing Sol's (Codex) implementation of
`notes/18-a1b-plan.md` (DECISIONS #41).** Commits `788ba6b`, `2e787c3`, `f7d49ca`,
`ba291ea`, from `5564446`.

## Verdict

**Passes. No blocking findings.** The implementation follows the plan's §3–§6 and the
cartridge routines it cites. Two non-blocking notes below, both about code that predates
A1b and both with homes. Ready for the user's play-test (plan §7).

## Checks re-run

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `ROM_PATH=pokeyellow.gbc npx vitest run` | **864/864**, 36 files |
| `npx vitest run` (no ROM) | **783 pass / 81 skip** |
| `npm run build` | clean |
| `git diff --check 5564446..HEAD` | clean |
| `game/data/`, `game/static/`, extractors, `refs/`, `pkmn-sprites/` | untouched |

These match Sol's numbers.

## Against the plan and the ASM

- **Bag (`items.ts`)**: `addToInventory` is `AddItemToInventory_`. It checks for room once,
  up front (`d = count − capacity`), scans the slots in order, adds in 8 bits, and splits at
  99 only when a slot is free. It fails at the first overflowing stack with no writes, which
  keeps the full-bag quirk. `removeFromInventoryAt` is `RemoveItemFromInventory_`.
  `Bag.remove(id)` takes the first matching slot (`RemoveItemByID`).
- **Callers**:
  - The shop adds first and charges only on success (`pokemart.asm:181`).
  - PC withdraw and deposit add to the destination, then remove the selected source slot
    (`players_pc.asm:123/177`).
  - Every index passed to `removeAt` is the absolute selected slot. I checked the PC's
    `listCursor` against `scrollOffset`, the battle's `itemCursor` at use time, the item
    menu's `selectedItemIndex`, and the shop's `indexOf(item)`.
  - `restoreBag` restores the stacks as saved.
- **Text endings (`textbox.ts`)**:
  - `end: 'none'` completes on the last page and then reads no input.
  - `end: 'prompt'` shows ▼, waits 3 frames (`ProtectedDelay3`), and remembers a press made
    while a sound still plays. It then plays `press_ab` and clears ▼, as `ManualTextScroll`
    does.
  - Text without `end` behaves as before.
- **Script routines (`script_controller.ts`)**:
  - `sound` (+ `waitForCurrent`), `textButtonWait` (A or B, no sound, no ▼) and `closeText`
    (the first frame A is up) all read the joypad every frame and freeze the world.
  - Routines that return in the same frame chain within that frame, by recursion. The
    recursion ends; every chained command advances.
  - `JoypadLowSensitivity` with `hJoy7` = 0 reports only new presses, so the edge-triggered
    `isPressed` is right.
- **`hideObject`**: it saves the key, hides the live NPC and refreshes the player's
  collision mask. That matches `HideObject` → `UpdateSprites` → `UpdatePlayerSprite` →
  `DetectCollisionBetweenSprites` (`movement.asm:27`). NPCs don't move there, because the
  font is loaded.
- **Pickups (`item_pickup.ts`)**: all three builders follow `PickUpItem`, `HiddenItems` /
  `FoundHiddenItemText` and `Route1PrintYoungster1Text` command for command. The success
  order is give → hide → text; the hidden item's text comes before the give; Route 1 sets
  its flag first. A test reads every string against the `.asm` macros.
- **Interaction order (`player.ts`)**: hidden events, then the bookshelf, signs and NPCs, as
  `home/overworld.asm:83–100` does. A found hidden item skips the bookshelf
  (`hItemAlreadyFound`), and a test confirms no tile on today's 19 maps overlaps.
- **Toggled objects**: they are saved and restored, a new game clears them, and
  `applyStoryNpcState` applies them on every load. Old saves start empty.
- **Tests**: they're good, not just green. The 73/181-update traces run A1a's real jingle
  interpreter. The full-bag, held-A, save/reload and freed-tile cases go through the
  controller. I checked that the existing 67 controller tests are unmodified.

## Notes (non-blocking)

- **N-1: typed text completes one letter delay early.** This predates A1b. `TextBox` reveals
  a character and then waits; `PrintLetterDelay` places it and then waits. So a retained
  text completes up to one text-speed delay before the cartridge's does. A button pressed on
  that exact frame satisfies the next `textButtonWait`. The window is at most 1–5 frames.
  → **A5**, with the other text-ending work (plan §8).
- **N-2: wrong-facing hidden events fall through.** This predates A1b. In our data the
  `facing` field is a lookup filter (`map.ts` `getHiddenEventAt`). On the cartridge it is the
  routine's argument (`data/events/hidden_events.asm`, e.g. `:328`), and each routine
  decides for itself:
  - `PrintBookcaseText` ignores the argument;
  - Red's PC returns early from the wrong side;
  - in both cases the overworld then does nothing else.

  Ours falls through to the bookshelf, signs and NPCs. Nothing on today's maps changes,
  per the overlap test. → **V5**, with the map-object audit.

## Play-test

The user's list is plan §7. For step 11 (Route 2's balls, behind Cut), Sol prepared two
staged saves and a console snippet that backs up the current save first:
`C:/Users/ajfm88/AppData/Local/Temp/pkmn-a1b/route2-playtest.md`. I checked both saves:
Route 2 at (13,55) and (13,46), facing up, empty bag, Pikachu, `hiddenObjects` empty.
