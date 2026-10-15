# A5b5a review: handler registry and the small story handlers

**2026-10-11 · Claude (Sonnet 5.5) reviewing Sol (GPT-6.1)'s `0df47e8` (CP1) and `25aa1c2` (CP2) against
`notes/32-a5b5-plan.md` (approved, DECISIONS #49).**

## Verdict: passed. No blocking findings; three non-blocking notes (one is my plan's error).

The user's play-test is not due yet (after A5b5b and A5b5c, plan §6) and is not claimed here.

## What I checked

- **Gates, re-run by me from `25aa1c2`.** Typecheck clean. `ROM_PATH=pokeyellow.gbc npm test` **1113/1113**
  (52 files). Without ROM **993 pass / 120 skip**. `npm run build` clean (337.40 kB JS). `git diff --check`
  clean over the slice. Same numbers as Sol's. The tree was clean before and after my mutations. I did not
  repeat the browser smoke (Sol's 17 flows) and ran no setup (no extractor or generated file changed;
  `git diff --stat` shows none).
- **Scope.** Changes are the registry and envelope (`story/text_handlers.ts`), the nine handlers
  (`story/small_text_handlers.ts`), the new script commands (`yesNoChoice`, `emotionBubble`, `healJingle`),
  `isMusicChannelActive`, the Mart/Route 1/Viridian builders, the removed swaps in `story_state.ts`, the
  TV routing in `player.ts`, and tests. Nothing in the audio engines, A6 movement, the A5a printer or the A5b4
  close was edited. The audio facade gains one read-only query.
- **Flows against the ASM** (read `RedsHouse1F_2.asm`, `BluesHouse.asm`, `Route1_2.asm`, `ViridianMart.asm`,
  `ViridianCity.asm`, `ViridianCity_2.asm`):
  - Mom: `YouShouldRest` → fade out → heal → jingle until `wChannelSoundIDs` clears → map music → fade in →
    `LookingGreat`. The TS order matches, and D4 (the jingle) is fixed.
  - TV: facing up gives StandByMe, else WrongSide, read when the handler runs.
  - Daisy: the order is give → hide → `GotMapText` (bound to the item name) → flag; the bag-full branch is
    `BluesHouseDaisyBagFullText`.
  - Route 1: flag first, so a full bag loses the sample; the repeat branch prints `AlsoGotPokeballs`.
  - Mart: direct text, LEFT ×1, UP ×2, `Delay3` (`wait 3`), one program with the receipt and jingle, close,
    then give and flag. There is no duplicate "got" text (D5, D6 fixed).
  - Gambler: `cp ~(1 << BIT_EARTHBADGE)` is exactly `$7f`. Sol's `every(got === (i < 7))` is exact.
  - Caterpillar, girl and the three old men match the tables, including `DelayFrames 2` inside the first
    display and the yes/no inside the display.
- **Foundation.** The registry throws on a duplicate key. The controller dispatches only when the generated
  call kind is `handler` and an entry exists, so unmigrated callers keep their path. The census test classifies
  all 30 handler/script calls and fails on a new one. `yesNoChoice`, the bubble and `healJingle` hold their
  own state; `initScript` clears all three (a replaced script cannot leave a bubble or a pending choice).
  `healJingle` cannot stall when audio is off or a fetch fails, because `playMusic` resolves on those paths.
  The `isPlaying` latch finding (the browser showed Mom stalling) is real: the engine flag stays true
  after the channels return, and the ASM polls the first channel. Sol's fix polls CHAN1 and a real-music
  test pins `sound_ret` at update 136.
- **N-2 closed.** START's exit and the Mart entry now use `[...npcs, ...getScriptNpcs()]`, as the script
  controller does.
- **My own mutations** (reverted with `git checkout`; tree clean):
  - Gambler mask `i < 7` → `i < 6`: 1 test failed (the exact-mask test).
  - `displayTextID` default `outerWait` true → false: 14 tests failed.
  - Sol's three (girl branch, Mart give order, jingle removed) match the tests I read.
- **Existing-test edits.** Sol listed them with reasons; they are the planned ones (Viridian builders and the
  Route 1 builder). The A6, nurse, printer, close and controller tests passed unedited.

## Notes (non-blocking)

- **N-1 (P2, cartridge departure; the plan's error, now pinned by a test).** Mom's heal calls `onHeal`, which
  records the Pokécenter blackout map. The cartridge does **not**: `SetLastBlackoutMap` is called only from
  `engine/events/pokecenter.asm:27` (`rg SetLastBlackoutMap` finds nothing else), and `RedsHouse1FMomHealScript`
  never touches `wLastBlackoutMap`. Effect today: heal at a Viridian Pokécenter, talk to Mom, black out, and the
  game returns to Pallet instead of Viridian. The behaviour pre-dates A5b5a (`buildMomHealScript(deps.onPokecenterHeal)`),
  but my §3.1 row wrote "`onHeal` records the blackout map" and Sol followed it faithfully; the test at
  `small_text_handlers.test.ts:76` pins it. **Fix in A5b5b CP3 (first commit, small):** drop the `callback` from
  `momText`, drop `onHeal` from the handler context unless the nurse needs it (A5b5c rebuilds the nurse on
  `displayOpen`; keep it available there), and change the test to assert Mom does not call it. Add a test
  with a blackout map already set. Not worth holding A5b5b.
- **N-2 (P4).** `ReloadMapData` after Mom's white-out fade is not modelled. It has no visible effect today
  (the map is already loaded); note it only so a later slice that reads sprite state does not rely on it.
- **N-3 (P4).** `ViridianMartDefaultScript` runs its first `UpdateSprites` from `checkMapEntryScripts`, with the
  map-entry timing of the existing code. Sol's browser numbers (+20 first glyph, 13 + 13 closes) fit the ASM,
  and the user's A5b5b play-test will exercise it with the Pallet and Lab flows. No action.

Carry-forward (not defects): the bubble and `healJingle` are exercised by the Mom flow only. The Pallet and Lab
bubbles are A5b5b, so their tests need the same fidelity as the Mom ones. The migrated `DelayFrames` reads no
joypad inside a display; legacy waits keep their `syncJoypadRead`. A5b5b must not move that boundary.

## State after the review

A5b5a is **done** (no play-test required until after A5b5b). Deferred items stay as in plan §9. **Next: Sol claims
A5b5b** (CP3 Pallet, CP4 the Lab), starting with the N-1 fix above. I review it in `notes/34-a5b5b-review.md`;
the user play-tests the new game from Pallet to the Pokédex.
