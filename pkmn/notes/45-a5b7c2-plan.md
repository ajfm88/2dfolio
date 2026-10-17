# A5b7c2 plan: party-menu prompts, field medicine, the HP bar, heal sounds

**2026-10-15 · Claude · Approved by the user 2026-10-15 ("i approve it"). Implementer: Grok.
Claude reviews; the user play-tests (Verification, last list).**
Parent: `notes/43-a5b7c-plan.md` §4 (this note supersedes its contract-level c2), DECISIONS #56.
**Grok: read the whole note before coding, commit per checkpoint, stop after CP5 for Claude's
review (not the user's). Baseline: 1348/1348 with the ROM, 1225/123 without.**

## Context

A5b7c1 (the bag, toss and field USE) is done: reviewed in note 44 and user-verified
2026-10-15. Using a Potion from the bag still runs a temporary bridge, the old `ItemMenu`
party screen:
- an invented header;
- the result drawn instantly;
- HP rising 1 point per 2 frames, with no sound;
- "no effect" keeps you in the party menu;
- after use it returns to the bag without the cartridge's white-out sequence.

START → POKéMON shows an invented "Move to where?". The party HP bar rounds the wrong way and
draws its HP fraction one column too far left. USE on OAK's PARCEL prints Oak's "not the time"
line instead of "This isn't yours to use!" (note 44 F-1, a planning error of mine).

Note 43 §4 left c2 at contract level, with a trace as its first step. I did that trace now
(below), so c2 is fully specified. DECISIONS #56 already approves c2's scope: the heal SFX
extraction, the `UpdateHPBar2` port, the Full Restore fix, and the shared party menu.

Filed 2026-10-15 at the user's request. The implementer is **Grok**, as for c1.

## Findings from the trace (all `refs/pokeyellow/`)

1. **The HP bar is wrong today, beyond its timing.**
   - **Length:** `GetHPBarLength` (`engine/gfx/hp_bar.asm`) is floor(48·hp/max). When max ≥ 256,
     both values are divided by 4 first. A result of 0 becomes 1, so even 0 HP gives 1 inside
     the animation. The static `DrawHP_` draws 0 px for 0 HP. Ours uses `Math.ceil`.
   - **Color:** `GetHealthBarColor` (`home/palettes.asm`) goes by pixels: green ≥ 27, yellow ≥ 10,
     else red. Ours uses ratios > 0.5 / > 0.25.
   - **Party row (`DrawHP2`):** "HP:" at col 4, bracket col 5, 6 fill tiles cols 6–11, end tile
     `$6C` at col 12, then the fraction at **col 13**: 3-digit right-aligned current, '/' at
     col 16, 3-digit max. Ours draws the fraction from col 12.
2. **`UpdateHPBar2`'s real timing.** Note 43 §4 was wrong here: an HP step without a pixel
   change *does* cost a frame. For old→new, one HP at a time:
   - `UpdateHPBar_PrintHPNumber` writes the **pre-step** HP: 3 blanks, then 2-byte/3-digit
     right-aligned at col 13 of the bar row. Then `DelayFrame`: 1 frame.
   - Then, if the step changes the pixel count, `UpdateHPBar_AnimateHPBar` draws the bar at
     old px, old+1, …, new−1. Each draw is `DelayFrames 2`. It stops early if px reaches 49
     (`cp $31`).
   - At the end: print the final HP (1 frame), draw the final px (2 frames), `Delay3`.
   - So a heal costs: (HP steps) + 2·(pixels gained) + 6 frames.
   - The bar row is `hlcoord 4, 1 + 2·slot`. Party data already holds the new HP before the
     animation starts.
3. **`DisplayPartyMenu` (USE_ITEM) runs under a white palette.**
   - **Opening, from USE's A at R:**
     - `GBPalWhiteOutWithDelay3`, white from R: R+1..R+3.
     - `DrawPartyMenu_`: transfer off, `ClearScreen` + Delay3 (R+4..R+6),
       `LoadMonPartySpriteGfxWithLCDDisabled` (LCD-off: counted as 0 frames, see Approximations).
     - `RedrawPartyMenu_`: the entries, then `.printMessage` with BIT_NO_TEXT_DELAY: PrintText
       `PartyMenuItemUseText` (box + Delay3, R+7..R+9, transfer still off).
     - Transfer on + Delay3 (R+10..R+12), then **GBPalNormal: visible at R+12**.
     - `HandlePartyMenuInput`: wrap on, Delay3, **first read R+15**. A/B play press_ab.
   - On return it saves the cursor in `wPartyAndBillsPCSavedMenuItem`. `PartyMenuInit` reloads
     it the next time the menu opens, from START or from the bag.
4. **`ItemUseMedicine` for items that exist** (`engine/items/item_effects.asm`):
   - **Cancel (B):** `.canceledItemUse` → `.done`.
   - **A on a mon, for items ≤ CALCIUM:** `ModifyPikachuHappiness(USEDITEM)` runs **before** the
     effect check, and only if the target is the **starter Pikachu**
     (`IsThisPartyMonStarterPikachu` in `engine/events/pikachu_happiness.asm`). Ours checks
     species 25.
   - **Status items:** Antidote PSN, Burn Heal BRN, Ice Heal FRZ, Awakening SLP (any sleep
     count), Parlyz Heal PAR, Full Heal any. They check only the status bit, **not HP**.
     Match → clear the status.
   - **HP items:**
     - Fainted → no effect, except Revive/Max Revive.
     - Revive/Max Revive on a live mon → no effect.
     - Full HP → no effect, **except Full Restore with a status, which becomes Full Heal**
       (status branch, FULL_HEAL_MSG, heal_ailment). Ours fails here.
     - Otherwise add Potion 20, Super 50, Hyper 200; Full Restore and Max Potion go to max
       (and Full Restore clears the status); clamp at max.
     - Revive → ½ max (`srl`/`rr`), Max Revive → max. A revived starter Pikachu sets
       `wPikachuSpawnState = 3` (`RespawnOverworldPikachu`).
   - **Success:**
     - `RemoveUsedItem` removes 1 from the **bag slot index**; an emptied slot resets the list
       state (F-2, already in `list_state.ts`).
     - Then `PlaySoundWaitForCurrent`: wait for the A's press_ab to finish, with no reads. Then
       SFX_HEAL_HP plus the `UpdateHPBar2` animation (HP items), or SFX_HEAL_AILMENT (status
       items and Full Restore → Full Heal).
     - `.showHealingItemMessage` (from frame E):
       - transfer off;
       - `ClearScreen` + Delay3 (frozen, E+1..E+3);
       - `RedrawPartyMenu`: cursors erased, entries, then a no-delay PrintText of the result
         message (Delay3, frozen, E+4..E+6);
       - transfer on + Delay3 (E+7..E+9, thirds);
       - `DelayFrames 50`;
       - `WaitForTextScrollButtonPress` (silent, no ▼).
     - The messages (party_menu.asm `PartyMenuItemUseMessagePointers`) use `nameBuffer` = the
       target's nickname; PotionText also uses `hpDifference` = new − old.
   - **No effect:** `ItemUseNoEffectText` as PrintText, typed (HandlePartyMenuInput cleared
     no-delay), with a prompt, over the party menu.
   - **`.done` → back in `StartMenu_Item`** (from frame P: B on cancel, the silent wait's press,
     or the no-effect prompt's press):
     - `GBPalWhiteOut` (white from P), `ReloadMapData` (LCD-off: 0 frames);
     - `GBPalWhiteOutWithDelay3` (P+1..P+3);
     - `RestoreScreenTilesAndReloadTilePatterns` (Buffer2 with transfer on, Delay3: P+4..P+6);
     - `StartMenu_Item`: the list's 10 frames (P+7..P+16), entries, transfer on, Delay3
       (P+17..P+19);
     - **`LoadGBPal` at P+19: the START screen and the bag list appear together.** First read
       P+22. `RunDefaultPaletteCommand` does nothing off SGB, so the screen stays white until
       `LoadGBPal`. The bag reopens on the saved row (or at the top if F-2 emptied a slot).
5. **START → POKéMON prompts** (`engine/menus/start_sub_menus.asm` StartMenu_Pokemon,
   party_menu.asm `.printMessage`):
   - `PartyMenuNormalText` "Choose a #MON." on open and after each return;
   - `PartyMenuSwapMonText` "Move #MON / where?" after SWITCH (`RedrawPartyMenu_` with
     SWAP_MONS jumps straight to `.printMessage`).
   - Both print no-delay. All of these programs are already in `data/text_programs.json`;
     the extractor expands `#` to POKé.
6. **The Parcel.** `ItemUseOaksParcel` is `jp ItemUseNotYoursToUse` → `ItemUseNotYoursToUseText`
   ("This isn't yours / to use!", prompt). It isn't extracted.
   - From `rom/text_program_symbols.ts`, `ItemUseNotTimeText` is `$03:$64FF` and
     `ItemUseNoEffectText` is `$03:$6509`, so the root is **`$03:$6504`**.
   - `_ItemUseNotTimeText` (`$2D:$6D68`) is 42 encoded bytes, so the far target
     `_ItemUseNotYoursToUseText` is **`$2D:$6D92`** (`_ItemUseNoEffectText` = `$2D:$6DAB`
     agrees).
   - Confirm both against pret's sym (`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`),
     as that file's header says.
7. **Heal SFX headers (bank $02):**
   - `SFX_Heal_HP_1` and `SFX_Heal_Ailment_1` sit just before `SFX_Start_Menu_1` (`$41AD`) in
     `audio/headers/sfxheaders1.asm`, one 3-byte channel each.
   - So **`heal_hp` = `$02:$41A7`** and **`heal_ailment` = `$02:$41AA`** (`Tink_1` = `$41A4` =
     get_item2 `$419B` + 9, which checks out). Confirm against the sym file.

## Design (reuse first)

- **`menus/hp_bar.ts` (new, shared; battle adopts it in A5c):**
  - `getHpBarLength(hp, max)`: the quirk-exact `GetHPBarLength`, min 1.
  - `staticHpBarPixels(hp, max)`: `DrawHP_`, 0 for 0 HP.
  - `hpBarColor(px)`.
  - `class HpBarAnimation`: one `tick()` per frame, exposing `{ pixels, shownHp, done }` on the
     schedule in finding 2 (increase only; decrease and the "fainted" end belong to A5c).
  - `party_menu.ts`'s `drawTileHpBar` and the row's fraction switch to these, with the fraction
    at col 13.
- **`PartyMenu` (`menus/party_menu.ts`):**
  - Add a `'useItem'` mode beside `'overworld'`/`'battle'`: A returns the chosen slot, B
    cancels, press_ab on both, wrap kept, no submenu.
  - Add an HP override per slot (`{ pixels, shownHp }`) for the animation.
  - The overworld modes open on the saved cursor `wPartyAndBillsPCSavedMenuItem` (add it to
    `list_state.ts`) and save it on every return.
  - START → POKéMON draws its prompts from `PartyMenuNormalText` / `PartyMenuSwapMonText`
    (static no-delay text; the menu's own frame timing is J2), deleting "Move to where?" and
    `getText('PARTY_CHOOSE')` in the overworld.
  - **Battle mode is unchanged** (A5c owns "Bring out which #MON?").
- **`menus/field_medicine.ts` (new), run by `BagSession` in place of the `ItemMenu` bridge:**
  - A per-frame state machine over finding 3's opening, finding 4's effect/sound/animation/
    message/no-effect/cancel, and the return path.
  - It uses the shared `textBox` (`printStandalone`, with `noDelay` for the prompt and results),
    `playSFX`/`isSoundFinished` (the Mart's PlaySoundWaitForCurrent pattern), and the bag's
    single transfer tick and single Joypad owner.
  - It exposes `paletteWhite`; `main.ts` maps it onto the existing full-white `fadeAlpha`
    overlay, as the script `whiteOut` command does.
  - Effect logic is a pure function `applyFieldMedicine(itemId, mon) → outcome` (message
    program, sound, HP old/new, status change, respawn), unit-tested per item.
  - **Delete `menus/item_menu.ts`** and its `menus/index.ts` export (the bag's bridge was its
    last user).
- **Starter Pikachu:** one helper, `isStarterPikachu(mon)` in `pikachu/`, used by the happiness
  call and the respawn. It keeps the codebase's existing approximation (species 25, the same as
  `shouldPikachuFollow`), documented. Yellow's only Pikachu is the starter unless traded, so a
  full OT-ID check waits for trades (A4).
- **Data (extractor + `npm run setup` twice):**
  - Add `heal_hp` / `heal_ailment` to `SFX_HEADERS` in `rom/extractors/audio.ts`, and extend the
    bank-$1f guard in `rom/__tests__/extraction.test.ts`. If the $1f copies differ, pin them
    like save/turn_on_pc and record the bank caveat (V5).
  - Add `ItemUseNotYoursToUseText` (root) and `_ItemUseNotYoursToUseText` to
    `rom/text_program_symbols.ts`.
  - Route OAKS_PARCEL in `bag.ts` to it.

## Checkpoints (each: focused tests, typecheck, local commit)

1. **CP1 — data and c1 follow-ups.**
   - The two SFX and the NotYours program: setup twice, byte-identical, bank guard.
   - The Parcel prints "This isn't yours / to use!".
   - Note 44 N-1 (move the cursor, B, reopen → ▶ on the new row) and N-2 (toss 2 → stack −2).
2. **CP2 — `hp_bar.ts`.**
   - Length and color tables at max 20, 48, 64, 120, 255, 256, 300, 703.
   - Static vs. animation for 0 HP.
   - Full animation schedules: e.g. 13→33 of 39; 1→21 of 300; a step with no pixel change; the
     49-pixel cap.
   - The party row's cells (fraction at col 13).
   - Then `PartyMenu` rendering on it.
3. **CP3 — `PartyMenu`.**
   - `useItem` mode, the saved cursor, the HP override.
   - START → POKéMON prompts from the programs, including the SWITCH prompt.
   - Battle-mode tests unchanged.
4. **CP4 — `field_medicine.ts` in the bag.**
   - Every finding-3/4 anchor: white R..R+12, read R+15; E+1..E+9; 50 frames; silent wait;
     P+19 visible, read P+22.
   - Each item outcome: Potion, Super/Hyper/Max, Full Restore with HP / at full HP with a
     status / at full HP without, the status items with match and mismatch, a status item on a
     0-HP mon, Revive on fainted/live (with the respawn state for the starter).
   - Happiness only for the starter.
   - One item removed from the selected slot; F-2 when it empties.
   - The no-effect prompt and cancel returning to the bag; press_ab then heal sound ordering.
   - One transfer tick and ≤ 1 Joypad owner per frame.
   - Delete `item_menu.ts`.
5. **CP5 — integration and handoff.**
   - Full ROM / no-ROM suites, build.
   - Muted browser smoke on a spare port (never 5173): a damaged and a poisoned party, Potion,
     Antidote, a no-effect Potion, B out of the party menu, START → POKéMON SWITCH prompt.
   - Docs (menus/text/audio ARCHITECTURE, CONVENTIONS test list), the note's result section,
     STATUS.
   - Suggested self-mutations: ceil instead of floor; color by ratio; skipping the per-step
     `DelayFrame`; printing the post-step HP; happiness for any Pikachu or after a no-effect;
     removing before the effect check on failure; returning to the bag without the white/+19
     sequence.
   - Stop for review.

## Approximations recorded (not silently faked)

- LCD-off periods (`LoadMonPartySpriteGfxWithLCDDisabled`, `ReloadMapData`) count as 0 frames,
  inside already-white phases. They're a candidate for the emulator measuring tool.
- Party-menu icon animation, the starter-Pikachu `.asm_128f` input branch, and START →
  POKéMON's own frame timing: J2 party-menu audit.
- Vitamins, Rare Candy, stones, drinks, PP and X items: none obtainable yet; existing behavior,
  listed as gaps (B/C phases).

## Files

New: `game/src/menus/hp_bar.ts`, `game/src/menus/field_medicine.ts` (+ tests).
Changed: `menus/party_menu.ts`, `menus/bag.ts`, `list_state.ts`, `main.ts` (item_menu render,
white overlay), `rom/extractors/audio.ts`, `rom/text_program_symbols.ts`,
`rom/__tests__/extraction.test.ts`, regenerated `data/` + `static/`, `pikachu/` (helper).
Deleted: `menus/item_menu.ts`.

## Verification

- `npm run typecheck`, `ROM_PATH=pokeyellow.gbc npm test` (expect 1348 + new), `npm test`,
  `npm run build`, `git diff --check`. `npm run setup pokeyellow.gbc` twice, with no diff on
  the second run.
- The browser smoke above. Claude's review: re-run the gates, trace against the ASM, run
  mutations.
- User play-test (`http://127.0.0.1:5173/`, Z = A, X = B):
  - **Potion** on a hurt Pokémon: the screen whites out, then "Use item on which POKéMON?". Pick
    it: the heal sound, the bar fills step by step with the HP number counting up, then
    "X recovered by N!". Press A: back in the bag after a moment of white.
  - **Antidote** on a poisoned one: the cure sound, then "X was cured of poison!".
  - **Potion on a full-HP Pokémon:** "It won't have any effect.".
  - **START → POKéMON, SWITCH:** "Move POKéMON where?".
  - **USE OAK's PARCEL** (if still held): "This isn't yours to use!".

## Result (Grok, 2026-10-15)

Implemented and stopped for Claude's review. Commits: CP1 `a21d718`, CP2 `188a4a4`, CP3 `eb0d1f3`, CP4 `784607e`, CP5 this handoff.

- Heal headers confirmed against pret's sym. Bank `$1f` copies of both heal sounds match `$02`, so the guard's differing set stays save / turn_on_pc / enter_pc.
- The parcel prints `ItemUseNotYoursToUseText`. N-1 and N-2 are in `bag.test.ts`.
- `getHpBarLength` is floor, with the ÷4 path at max ≥ 256, minimum 1. Static 0 HP is 0 px. Color is by pixels. The 13→33/39 schedule is 74 frames; 1→21/300 is 30; a flat step still costs its print frame; a walk that would pass 48 px stops at 49.
- Party fraction is column 13. `useItem` returns the slot or cancels. The overworld cursor is `wPartyAndBillsPCSavedMenuItem`. Battle still opens on row 0. Prompts are the extracted programs.
- Field medicine: white through R+12, read R+15, press_ab then the heal sound, bag visible again at P+19, read P+22. Happiness is the starter only, and only for an item at or below Calcium, before the effect check. Full Restore at full HP with a status becomes Full Heal. Revive uses floor(max/2) and sets spawn state 3 for the starter. `item_menu.ts` is deleted.
- ROM **1386/1386** (74 files). No-ROM **1256 pass / 130 skip**. Typecheck and build clean.
- The spare-port check loaded `http://127.0.0.1:5199/` and did not play the canvas. The play-test above is for the user, after review.
- Approximations stand: LCD-off counts as 0 frames, party-icon animation and START → POKéMON frame timing are J2, and vitamins / drinks / PP / X items are gaps. `isStarterPikachu` is species 25 until trades (A4).
